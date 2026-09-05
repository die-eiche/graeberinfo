import { File, Paths, UploadType } from "expo-file-system";
import { applyAllowedValueRules } from "./allowedValues";
import { getApiKey } from "./apiKey";
import { emptyNoteMarkdown, mergeNoteMarkdown, titleFromMieter } from "./noteMerge";
import { parseNoteFields } from "./discoveries";
import { getSystemPrompt } from "./systemPrompt";
import type { NoteSnapshot } from "../types/session";

const EXTRACT_MODEL = "open-mistral-nemo";
const TRANSCRIBE_MODEL = "voxtral-mini-latest";

const EMPTY_NOTE = emptyNoteMarkdown();

function snapshotFromMarkdown(markdown: string): NoteSnapshot {
  const fields = parseNoteFields(markdown);
  const title = titleFromMieter(fields);
  const noteMarkdown = markdown.replace(/^[^\n]+/, title);
  return {
    title,
    noteMarkdown: noteMarkdown.endsWith("\n") ? noteMarkdown : `${noteMarkdown}\n`,
  };
}

/** Segment normalisieren, mit bisherigem Stand mergen, Titel aus Mieter ableiten. */
function finalizeNote(raw: string, transcript: string, previousNote: string): NoteSnapshot {
  const segmentNormalized = applyAllowedValueRules(raw, transcript);
  const merged = mergeNoteMarkdown(previousNote || EMPTY_NOTE, segmentNormalized);
  return snapshotFromMarkdown(merged);
}

async function requireKey(): Promise<string> {
  const key = await getApiKey();
  if (!key) {
    throw new Error("Bitte zuerst den Mistral-Schlüssel unter Einstellungen speichern.");
  }
  return key;
}

function extensionOf(uri: string): string {
  const clean = uri.split("?")[0] || uri;
  const match = /\.([a-z0-9]+)$/i.exec(clean);
  return (match?.[1] || "wav").toLowerCase();
}

function mimeForExtension(ext: string): string {
  switch (ext) {
    case "wav":
      return "audio/wav";
    case "m4a":
      return "audio/m4a";
    case "mp4":
      return "audio/mp4";
    case "caf":
      return "audio/x-caf";
    case "mp3":
      return "audio/mpeg";
    default:
      return "application/octet-stream";
  }
}

async function waitForFile(file: File, attempts = 12): Promise<number> {
  let last = -1;
  for (let i = 0; i < attempts; i++) {
    if (file.exists && file.size > 0 && file.size === last) {
      return file.size;
    }
    last = file.exists ? file.size : -1;
    await new Promise((r) => setTimeout(r, 100));
  }
  return file.exists ? file.size : 0;
}

export function createEmptyNote(): NoteSnapshot {
  return snapshotFromMarkdown(EMPTY_NOTE);
}

export async function extractFromTranscript(
  sessionId: string,
  transcript: string,
  previousNote: string
): Promise<NoteSnapshot & { transcript: string }> {
  const apiKey = await requireKey();
  const userContent = [
    `Session-ID: ${sessionId}`,
    "",
    "Gesprächsabschnitt (nur dieser Text):",
    transcript,
    "",
    "Extrahiere NUR aus diesem Abschnitt. Felder, die hier nicht klar vorkommen, leer lassen.",
    "Verwandter ≠ Mieter. Explizite Mieter-Angabe in die Mieter-Felder.",
    "Unklare, aber angesprochene Angaben (inkl. unverstandene Grabnummer) als genau ? ausgeben.",
    "Gib Titel + vollständige Tabelle aus.",
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
        { role: "system", content: getSystemPrompt() },
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
  return { ...finalizeNote(raw, transcript, previousNote), transcript };
}

export async function transcribeAndExtract(
  sessionId: string,
  audioUri: string,
  previousNote: string
): Promise<NoteSnapshot & { transcript?: string; skipped?: boolean }> {
  const apiKey = await requireKey();

  const source = new File(audioUri);
  const sourceSize = await waitForFile(source);
  if (!source.exists || sourceSize < 500) {
    return {
      ...snapshotFromMarkdown(previousNote || EMPTY_NOTE),
      transcript: "",
      skipped: true,
    };
  }

  const ext = extensionOf(audioUri);
  const mimeType = mimeForExtension(ext);
  const uploadFile = new File(Paths.cache, `segment-${Date.now()}.${ext}`);

  // WICHTIG: copy() ist async – ohne await wurde eine leere Datei hochgeladen
  // und Mistral antwortete mit "Audio input could not be decoded" (3310).
  await source.copy(uploadFile);

  const uploadSize = await waitForFile(uploadFile);
  if (!uploadFile.exists || uploadSize < 500) {
    throw new Error("Audiodatei ist leer oder noch nicht fertig geschrieben.");
  }

  try {
    const uploadResult = await uploadFile.upload(
      "https://api.mistral.ai/v1/audio/transcriptions",
      {
        uploadType: UploadType.MULTIPART,
        fieldName: "file",
        mimeType,
        parameters: {
          model: TRANSCRIBE_MODEL,
          language: "de",
        },
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (uploadResult.status < 200 || uploadResult.status >= 300) {
      throw new Error(
        `Spracherkennung fehlgeschlagen (${uploadResult.status}): ${uploadResult.body}`
      );
    }

    const transcribed = JSON.parse(uploadResult.body) as { text?: string };
    const transcript = (transcribed.text || "").trim();
    if (!transcript) {
      return {
        ...snapshotFromMarkdown(previousNote || EMPTY_NOTE),
        transcript: "",
        skipped: true,
      };
    }

    return extractFromTranscript(sessionId, transcript, previousNote);
  } finally {
    try {
      if (uploadFile.exists) {
        uploadFile.delete();
      }
    } catch {
      // Temp-Datei optional löschen
    }
  }
}
