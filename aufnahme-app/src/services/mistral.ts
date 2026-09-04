import { getApiKey } from "./apiKey";
import { SYSTEM_PROMPT } from "./systemPrompt";
import type { NoteSnapshot } from "../types/session";

const EXTRACT_MODEL = "open-mistral-nemo";
const TRANSCRIBE_MODEL = "voxtral-mini-latest";

const EMPTY_NOTE = `Aufnahme

| Feld | Wert |
|---|---|
| Mieter Vorname |  |
| Mieter Nachname |  |
| Mieter Verwandtschaftsverhältnis zum Verstorbenen |  |
| Mieter Straße |  |
| Mieter PLZ Ort |  |
| Mieter Telefon 1 |  |
| Mieter Telefon 2 |  |
| Mieter E-Mail |  |
| Mieter Überweisung oder SEPA |  |
| Mieter IBAN |  |
| Mieter Kontoinhaber |  |
| Verstorbener Vorname |  |
| Verstorbener Nachname |  |
| Verstorbener Straße |  |
| Verstorbener PLZ Ort |  |
| Verstorbener Geburtstag |  |
| Verstorbener Todestag |  |
| Bestatter |  |
| Bestatter-Aufwand |  |
| Grab |  |
| Urne |  |
| TF-Wunschtermin |  |
| TF-Ideen |  |
`;

function parseNote(raw: string): NoteSnapshot {
  const lines = raw.trim().split(/\r?\n/);
  const title = (lines[0] || "Aufnahme").trim() || "Aufnahme";
  const body = lines.slice(1).join("\n").trim();
  return {
    title,
    noteMarkdown: `${title}\n\n${body}`.trim() + "\n",
  };
}

async function requireKey(): Promise<string> {
  const key = await getApiKey();
  if (!key) {
    throw new Error("Bitte zuerst den Mistral-Schlüssel unter Einstellungen speichern.");
  }
  return key;
}

export function createEmptyNote(): NoteSnapshot {
  return parseNote(EMPTY_NOTE);
}

export async function extractFromTranscript(
  sessionId: string,
  transcript: string,
  previousNote: string
): Promise<NoteSnapshot & { transcript: string }> {
  const apiKey = await requireKey();
  const userContent = [
    `Session-ID: ${sessionId}`,
    "Bisheriger Stand (falls vorhanden):",
    previousNote || "",
    "",
    "Neuer Gesprächsabschnitt:",
    transcript,
    "",
    "Aktualisiere den Stand gemäß Systemregeln und gib Titel + vollständige Tabelle aus.",
  ].join("\n");

  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EXTRACT_MODEL,
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`KI-Auswertung fehlgeschlagen (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  const raw = data.choices?.[0]?.message?.content?.trim() || "";
  return { ...parseNote(raw), transcript };
}

export async function transcribeAndExtract(
  sessionId: string,
  audioUri: string,
  previousNote: string
): Promise<NoteSnapshot & { transcript?: string; skipped?: boolean }> {
  const apiKey = await requireKey();

  const form = new FormData();
  form.append("model", TRANSCRIBE_MODEL);
  form.append("language", "de");
  form.append("file", {
    uri: audioUri,
    name: `segment-${Date.now()}.m4a`,
    type: "audio/m4a",
  } as unknown as Blob);

  const transcribeResponse = await fetch("https://api.mistral.ai/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });

  if (!transcribeResponse.ok) {
    const text = await transcribeResponse.text();
    throw new Error(`Spracherkennung fehlgeschlagen (${transcribeResponse.status}): ${text}`);
  }

  const transcribed = (await transcribeResponse.json()) as { text?: string };
  const transcript = (transcribed.text || "").trim();
  if (!transcript) {
    return {
      title: parseNote(previousNote || EMPTY_NOTE).title,
      noteMarkdown: previousNote || EMPTY_NOTE,
      transcript: "",
      skipped: true,
    };
  }

  return extractFromTranscript(sessionId, transcript, previousNote);
}
