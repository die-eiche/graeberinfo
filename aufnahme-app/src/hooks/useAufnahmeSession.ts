import { Audio } from "expo-av";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform, type AppStateStatus } from "react-native";
import { sendAudioSegment, startSession, stopSession } from "../services/api";
import { shareNoteToSystemNotes, upsertNoteFile } from "../services/notes";
import type { SessionStatus } from "../types/session";

function createSessionId() {
  return `s-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

export function useAufnahmeSession() {
  const [status, setStatus] = useState<SessionStatus>("idle");
  const [title, setTitle] = useState("Aufnahme");
  const [noteMarkdown, setNoteMarkdown] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sessionIdRef = useRef<string | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const notePathRef = useRef<string | null>(null);
  const statusRef = useRef<SessionStatus>("idle");
  const interruptedRef = useRef(false);
  const processingRef = useRef(false);
  const noteMarkdownRef = useRef("");

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    noteMarkdownRef.current = noteMarkdown;
  }, [noteMarkdown]);

  const persistNote = useCallback(async (nextTitle: string, markdown: string) => {
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
        const result = await sendAudioSegment(sessionIdRef.current, uri);
        if (!result.skipped) {
          await persistNote(result.title, result.noteMarkdown);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Verarbeitung fehlgeschlagen");
      } finally {
        processingRef.current = false;
        setBusy(false);
      }
    },
    [persistNote]
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

  const pauseInternal = useCallback(
    async () => {
      if (statusRef.current !== "recording") return;
      const uri = await stopRecorder();
      setStatus("paused");
      await processUri(uri);
    },
    [processUri, stopRecorder]
  );

  const resumeInternal = useCallback(async () => {
    if (statusRef.current !== "paused" && statusRef.current !== "idle") return;
    const ok = await beginRecording();
    if (!ok) return;
    interruptedRef.current = false;
    setStatus("recording");
    setError(null);
  }, [beginRecording]);

  const toggleStartPause = useCallback(async () => {
    if (busy) return;
    setError(null);

    if (status === "idle" || status === "stopped") {
      const sessionId = createSessionId();
      sessionIdRef.current = sessionId;
      setBusy(true);
      try {
        const started = await startSession(sessionId);
        await persistNote(started.title, started.noteMarkdown || "Aufnahme\n");
        const ok = await beginRecording();
        if (!ok) return;
        setStatus("recording");
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
  }, [beginRecording, busy, pauseInternal, persistNote, resumeInternal, status]);

  const stop = useCallback(async () => {
    if (statusRef.current === "idle" || statusRef.current === "stopped") return;
    setBusy(true);
    setError(null);
    interruptedRef.current = false;
    try {
      const uri = await stopRecorder();
      await processUri(uri);
      if (sessionIdRef.current) {
        const finalState = await stopSession(sessionIdRef.current);
        await persistNote(
          finalState.title,
          finalState.noteMarkdown || noteMarkdownRef.current
        );
        sessionIdRef.current = null;
      }
      if (notePathRef.current) {
        try {
          await shareNoteToSystemNotes(notePathRef.current);
        } catch {
          // Teilen optional – Datei bleibt lokal erhalten
        }
      }
      setStatus("stopped");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Stop fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }, [persistNote, processUri, stopRecorder]);

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
      void stopRecorder();
    };
  }, [stopRecorder]);

  return {
    status,
    title,
    noteMarkdown,
    error,
    busy,
    platformLabel: Platform.OS,
    toggleStartPause,
    stop,
  };
}
