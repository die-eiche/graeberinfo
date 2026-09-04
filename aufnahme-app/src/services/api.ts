import { createEmptyNote, transcribeAndExtract } from "./mistral";
import type { NoteSnapshot } from "../types/session";

/** Lokale Session – kein eigener Server mehr nötig. */

export async function startSession(sessionId: string): Promise<NoteSnapshot & { sessionId: string }> {
  const empty = createEmptyNote();
  return { sessionId, ...empty };
}

export async function stopSession(sessionId: string, current: NoteSnapshot): Promise<NoteSnapshot & { sessionId: string }> {
  return { sessionId, ...current };
}

export async function sendAudioSegment(
  sessionId: string,
  uri: string,
  previousNote: string
): Promise<NoteSnapshot & { transcript?: string; skipped?: boolean }> {
  return transcribeAndExtract(sessionId, uri, previousNote);
}
