import {
  AudioModule,
  AudioQuality,
  IOSOutputFormat,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  type RecordingOptions,
} from "expo-audio";
import { File } from "expo-file-system";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform, type AppStateStatus } from "react-native";
import { sendAudioSegment, startSession, stopSession } from "../services/api";
import { hasApiKey } from "../services/apiKey";
import { diffDiscoveries, type Discovery } from "../services/discoveries";
import { shareNoteToSystemNotes, upsertNoteFile } from "../services/notes";
import type { SessionStatus } from "../types/session";
import {
  METER_POLL_MS,
  evaluateSegmentCut,
} from "../services/segmentPolicy";

/** WAV/PCM auf iOS – von Mistral zuverlässig dekodierbar. Android: AAC/M4A. */
const RECORDING_OPTIONS: RecordingOptions =
  Platform.OS === "ios"
    ? {
        isMeteringEnabled: true,
        extension: ".wav",
        sampleRate: 16000,
        numberOfChannels: 1,
        bitRate: 256000,
        android: {
          extension: ".m4a",
          outputFormat: "mpeg4",
          audioEncoder: "aac",
        },
        ios: {
          extension: ".wav",
          outputFormat: IOSOutputFormat.LINEARPCM,
          audioQuality: AudioQuality.HIGH,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: "audio/wav",
          bitsPerSecond: 128000,
        },
      }
    : {
        isMeteringEnabled: true,
        extension: ".m4a",
        sampleRate: 44100,
        numberOfChannels: 1,
        bitRate: 128000,
        android: {
          extension: ".m4a",
          outputFormat: "mpeg4",
          audioEncoder: "aac",
        },
        ios: {
          extension: ".m4a",
          outputFormat: IOSOutputFormat.MPEG4AAC,
          audioQuality: AudioQuality.HIGH,
        },
        web: {
          mimeType: "audio/mp4",
          bitsPerSecond: 128000,
        },
      };

async function waitUntilFileReady(uri: string | null): Promise<string | null> {
  if (!uri) return null;
  const file = new File(uri);
  let lastSize = -1;
  for (let i = 0; i < 15; i++) {
    if (file.exists && file.size > 0 && file.size === lastSize) {
      return uri;
    }
    lastSize = file.exists ? file.size : -1;
    await new Promise((r) => setTimeout(r, 120));
  }
  return file.exists && file.size > 0 ? uri : null;
}

function createSessionId() {
  return `s-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

export function useAufnahmeSession() {
  const [status, setStatus] = useState<SessionStatus>("idle");
  const [title, setTitle] = useState("Aufnahme");
  const [noteMarkdown, setNoteMarkdown] = useState("");
  const [discoveries, setDiscoveries] = useState<Discovery[]>([]);
  const [focusFields, setFocusFields] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [keyConfigured, setKeyConfigured] = useState(false);

  const sessionIdRef = useRef<string | null>(null);
  const recorderRef = useRef<InstanceType<typeof AudioModule.AudioRecorder> | null>(null);
  const notePathRef = useRef<string | null>(null);
  const statusRef = useRef<SessionStatus>("idle");
  const interruptedRef = useRef(false);
  const processingRef = useRef(false);
  const queueRef = useRef<string[]>([]);
  const noteMarkdownRef = useRef("");
  const titleRef = useRef("Aufnahme");
  const discoverySeqRef = useRef(0);
  const segmentTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const silenceSinceRef = useRef<number | null>(null);
  const rotatingRef = useRef(false);
  const transcriptChunksRef = useRef<string[]>([]);

  const refreshKeyState = useCallback(async () => {
    setKeyConfigured(await hasApiKey());
  }, []);

  useEffect(() => {
    void refreshKeyState();
  }, [refreshKeyState]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    noteMarkdownRef.current = noteMarkdown;
  }, [noteMarkdown]);

  useEffect(() => {
    titleRef.current = title;
  }, [title]);

  const clearSegmentTimer = useCallback(() => {
    if (segmentTimerRef.current) {
      clearInterval(segmentTimerRef.current);
      segmentTimerRef.current = null;
    }
  }, []);

  const applyNoteUpdate = useCallback(async (nextTitle: string, markdown: string) => {
    const found = diffDiscoveries(
      noteMarkdownRef.current,
      markdown,
      titleRef.current,
      nextTitle,
      discoverySeqRef.current++
    );
    if (found.length > 0) {
      setDiscoveries((prev) => [...prev, ...found]);
      setFocusFields(found.map((d) => d.field).filter((f) => f !== "Notiz-Titel"));
    }
    setTitle(nextTitle);
    setNoteMarkdown(markdown);
    notePathRef.current = await upsertNoteFile(notePathRef.current, nextTitle, markdown);
  }, []);

  const stopRecorder = useCallback(async (): Promise<string | null> => {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (!recorder) return null;
    try {
      await recorder.stop();
      // Datei muss vollständig geschrieben sein, bevor wir hochladen
      return waitUntilFileReady(recorder.uri);
    } catch {
      return null;
    }
  }, []);

  const drainQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    try {
      while (queueRef.current.length > 0) {
        const uri = queueRef.current.shift();
        if (!uri || !sessionIdRef.current) continue;
        try {
          const result = await sendAudioSegment(
            sessionIdRef.current,
            uri,
            noteMarkdownRef.current,
            transcriptChunksRef.current
          );
          if (result.transcriptChunks) {
            transcriptChunksRef.current = result.transcriptChunks;
          }
          if (!result.skipped) {
            await applyNoteUpdate(result.title, result.noteMarkdown);
            setError(null);
          }
        } catch (e) {
          setError(e instanceof Error ? e.message : "Verarbeitung fehlgeschlagen");
        }
      }
    } finally {
      processingRef.current = false;
      if (queueRef.current.length > 0) {
        void drainQueue();
      }
    }
  }, [applyNoteUpdate]);

  const processUri = useCallback(
    (uri: string | null) => {
      if (!uri || !sessionIdRef.current) return;
      queueRef.current.push(uri);
      void drainQueue();
    },
    [drainQueue]
  );

  const beginRecording = useCallback(async () => {
    await setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
      allowsBackgroundRecording: true,
    });

    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setError("Mikrofon-Berechtigung fehlt.");
      return false;
    }

    const recorder = new AudioModule.AudioRecorder(RECORDING_OPTIONS);
    await recorder.prepareToRecordAsync();
    recorder.record();
    recorderRef.current = recorder;
    return true;
  }, []);

  const rotateSegment = useCallback(async () => {
    if (statusRef.current !== "recording") return;
    if (rotatingRef.current) return;
    rotatingRef.current = true;
    silenceSinceRef.current = null;
    try {
      const uri = await stopRecorder();
      const ok = await beginRecording();
      if (!ok) {
        setStatus("paused");
        clearSegmentTimer();
      }
      await processUri(uri);
    } finally {
      rotatingRef.current = false;
      silenceSinceRef.current = null;
    }
  }, [beginRecording, clearSegmentTimer, processUri, stopRecorder]);

  const startSegmentTimer = useCallback(() => {
    clearSegmentTimer();
    silenceSinceRef.current = null;
    segmentTimerRef.current = setInterval(() => {
      if (statusRef.current !== "recording") return;
      if (rotatingRef.current) return;
      const recorder = recorderRef.current;
      if (!recorder) return;
      let durationMillis = 0;
      let metering: number | undefined;
      try {
        const status = recorder.getStatus();
        durationMillis = status.durationMillis ?? 0;
        metering = status.metering;
      } catch {
        return;
      }
      const now = Date.now();
      const decision = evaluateSegmentCut(
        { durationMillis, metering },
        silenceSinceRef.current,
        now
      );
      silenceSinceRef.current = decision.nextSilenceSinceMs;
      if (decision.shouldCut) {
        void rotateSegment();
      }
    }, METER_POLL_MS);
  }, [clearSegmentTimer, rotateSegment]);

  const pauseInternal = useCallback(async () => {
    if (statusRef.current !== "recording") return;
    clearSegmentTimer();
    const uri = await stopRecorder();
    setStatus("paused");
    await processUri(uri);
  }, [clearSegmentTimer, processUri, stopRecorder]);

  const resumeInternal = useCallback(async () => {
    if (statusRef.current !== "paused" && statusRef.current !== "idle") return;
    const ok = await beginRecording();
    if (!ok) return;
    interruptedRef.current = false;
    setStatus("recording");
    setError(null);
    startSegmentTimer();
  }, [beginRecording, startSegmentTimer]);

  const toggleStartPause = useCallback(async () => {
    if (busy) return;
    setError(null);

    if (status === "idle" || status === "stopped") {
      if (!(await hasApiKey())) {
        setError("Bitte zuerst unter Einstellungen den Mistral-Schlüssel speichern.");
        return;
      }
      const sessionId = createSessionId();
      sessionIdRef.current = sessionId;
      setBusy(true);
      try {
        setDiscoveries([]);
        setFocusFields([]);
        transcriptChunksRef.current = [];
        discoverySeqRef.current = 0;
        notePathRef.current = null;
        const started = await startSession(sessionId);
        setTitle(started.title);
        setNoteMarkdown(started.noteMarkdown || "Aufnahme\n");
        noteMarkdownRef.current = started.noteMarkdown || "Aufnahme\n";
        titleRef.current = started.title;
        notePathRef.current = await upsertNoteFile(
          null,
          started.title,
          started.noteMarkdown || "Aufnahme\n"
        );
        const ok = await beginRecording();
        if (!ok) return;
        setStatus("recording");
        startSegmentTimer();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Start fehlgeschlagen");
        setStatus("idle");
      } finally {
        setBusy(false);
      }
      return;
    }

    if (status === "recording") {
      await pauseInternal();
      return;
    }

    if (status === "paused") {
      await resumeInternal();
    }
  }, [beginRecording, busy, pauseInternal, resumeInternal, startSegmentTimer, status]);

  const stop = useCallback(async () => {
    if (statusRef.current === "idle" || statusRef.current === "stopped") return;
    setBusy(true);
    setError(null);
    interruptedRef.current = false;
    clearSegmentTimer();
    try {
      const uri = await stopRecorder();
      await processUri(uri);
      if (sessionIdRef.current) {
        const finalState = await stopSession(sessionIdRef.current, {
          title: titleRef.current,
          noteMarkdown: noteMarkdownRef.current,
        });
        await applyNoteUpdate(finalState.title, finalState.noteMarkdown);
        sessionIdRef.current = null;
      }
      if (notePathRef.current) {
        try {
          await shareNoteToSystemNotes(notePathRef.current);
        } catch {
          // Teilen optional
        }
      }
      setStatus("stopped");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Stop fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }, [applyNoteUpdate, clearSegmentTimer, processUri, stopRecorder]);

  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      if (next !== "active" && statusRef.current === "recording") {
        interruptedRef.current = true;
        void pauseInternal();
        return;
      }
      if (next === "active" && interruptedRef.current && statusRef.current === "paused") {
        interruptedRef.current = false;
        void resumeInternal();
      }
    };
    const sub = AppState.addEventListener("change", onChange);
    return () => sub.remove();
  }, [pauseInternal, resumeInternal]);

  useEffect(() => {
    return () => {
      clearSegmentTimer();
      void stopRecorder();
    };
  }, [clearSegmentTimer, stopRecorder]);

  return {
    status,
    title,
    noteMarkdown,
    discoveries,
    focusFields,
    error,
    busy,
    keyConfigured,
    refreshKeyState,
    platformLabel: Platform.OS,
    toggleStartPause,
    stop,
  };
}
