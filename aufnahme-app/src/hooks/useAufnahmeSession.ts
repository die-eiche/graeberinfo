import { Audio } from "expo-av";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform, type AppStateStatus } from "react-native";
import { sendAudioSegment, startSession, stopSession } from "../services/api";
import { hasApiKey } from "../services/apiKey";
import { diffDiscoveries, type Discovery } from "../services/discoveries";
import { shareNoteToSystemNotes, upsertNoteFile } from "../services/notes";
import type { SessionStatus } from "../types/session";

const SEGMENT_MS = 30_000;

function createSessionId() {
  return `s-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

export function useAufnahmeSession() {
  const [status, setStatus] = useState<SessionStatus>("idle");
  const [title, setTitle] = useState("Aufnahme");
  const [noteMarkdown, setNoteMarkdown] = useState("");
  const [discoveries, setDiscoveries] = useState<Discovery[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [keyConfigured, setKeyConfigured] = useState(false);

  const sessionIdRef = useRef<string | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const notePathRef = useRef<string | null>(null);
  const statusRef = useRef<SessionStatus>("idle");
  const interruptedRef = useRef(false);
  const processingRef = useRef(false);
  const noteMarkdownRef = useRef("");
  const titleRef = useRef("Aufnahme");
  const discoverySeqRef = useRef(0);
  const segmentTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    }
    setTitle(nextTitle);
    setNoteMarkdown(markdown);
    notePathRef.current = await upsertNoteFile(notePathRef.current, nextTitle, markdown);
  }, []);

  const stopRecorder = useCallback(async (): Promise<string | null> => {
    const recording = recordingRef.current;
    recordingRef.current = null;
    if (!recording) return null;
    try {
      await recording.stopAndUnloadAsync();
      return recording.getURI();
    } catch {
      return null;
    }
  }, []);

  const processUri = useCallback(
    async (uri: string | null) => {
      if (!uri || !sessionIdRef.current || processingRef.current) return;
      processingRef.current = true;
      setBusy(true);
      try {
        const result = await sendAudioSegment(
          sessionIdRef.current,
          uri,
          noteMarkdownRef.current
        );
        if (!result.skipped) {
          await applyNoteUpdate(result.title, result.noteMarkdown);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Verarbeitung fehlgeschlagen");
      } finally {
        processingRef.current = false;
        setBusy(false);
      }
    },
    [applyNoteUpdate]
  );

  const beginRecording = useCallback(async () => {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
    });

    const permission = await Audio.requestPermissionsAsync();
    if (!permission.granted) {
      setError("Mikrofon-Berechtigung fehlt.");
      return false;
    }

    const recording = new Audio.Recording();
    await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    await recording.startAsync();
    recordingRef.current = recording;
    return true;
  }, []);

  const rotateSegment = useCallback(async () => {
    if (statusRef.current !== "recording") return;
    const uri = await stopRecorder();
    const ok = await beginRecording();
    if (!ok) {
      setStatus("paused");
      clearSegmentTimer();
    }
    await processUri(uri);
  }, [beginRecording, clearSegmentTimer, processUri, stopRecorder]);

  const startSegmentTimer = useCallback(() => {
    clearSegmentTimer();
    segmentTimerRef.current = setInterval(() => {
      void rotateSegment();
    }, SEGMENT_MS);
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
    error,
    busy,
    keyConfigured,
    refreshKeyState,
    platformLabel: Platform.OS,
    toggleStartPause,
    stop,
  };
}
