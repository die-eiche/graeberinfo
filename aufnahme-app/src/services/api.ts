import { API_BASE_URL } from "../theme/config";
import type { NoteSnapshot } from "../types/session";

async function parseJson(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || `HTTP ${response.status}`);
  }
  return data;
}

export async function startSession(sessionId: string): Promise<NoteSnapshot & { sessionId: string }> {
  const response = await fetch(`${API_BASE_URL}/session/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
  });
  return parseJson(response);
}

export async function stopSession(sessionId: string): Promise<NoteSnapshot & { sessionId: string }> {
  const response = await fetch(`${API_BASE_URL}/session/stop`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
  });
  return parseJson(response);
}

export async function sendAudioSegment(
  sessionId: string,
  uri: string
): Promise<NoteSnapshot & { transcript?: string; skipped?: boolean }> {
  const form = new FormData();
  form.append("sessionId", sessionId);
  form.append("audio", {
    uri,
    name: `segment-${Date.now()}.m4a`,
    type: "audio/m4a",
  } as unknown as Blob);

  const response = await fetch(`${API_BASE_URL}/session/segment-audio`, {
    method: "POST",
    body: form,
  });
  return parseJson(response);
}

export async function sendTextSegment(
  sessionId: string,
  transcript: string
): Promise<NoteSnapshot & { transcript?: string }> {
  const response = await fetch(`${API_BASE_URL}/session/segment-text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, transcript }),
  });
  return parseJson(response);
}
