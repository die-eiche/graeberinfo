import {
  createEmptyNote,
  reviewNoteFromFullTranscript,
  transcribeAndExtract,
} from "./mistral";
import type { NoteSnapshot } from "../types/session";

/** Lokale Session – kein eigener Server mehr nötig. */

export async function startSession(sessionId: string): Promise<NoteSnapshot & { sessionId: string }> {
  const empty = createEmptyNote();
  return { sessionId, ...empty };
}

export async function stopSession(
  sessionId: string,
  current: NoteSnapshot,
  transcriptChunks: string[] = [],
  lockedFields: readonly string[] = []
): Promise<NoteSnapshot & { sessionId: string }> {
  const reviewed = await reviewNoteFromFullTranscript(
    sessionId,
    transcriptChunks,
    current.noteMarkdown,
    lockedFields
  );
  return { sessionId, ...reviewed };
}

export async function sendAudioSegment(
  sessionId: string,
  uri: string,
  previousNote: string,
  priorTranscriptChunks: string[] = [],
  lockedFields: readonly string[] = []
): Promise<
  NoteSnapshot & {
    transcript?: string;
    transcriptChunks?: string[];
    skipped?: boolean;
  }
> {
  return transcribeAndExtract(sessionId, uri, previousNote, priorTranscriptChunks, lockedFields);
}
