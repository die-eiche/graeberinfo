import { File, Paths, UploadType } from "expo-file-system";
import { applyAllowedValueRules } from "./allowedValues";
import { getApiKey } from "./apiKey";
import { emptyNoteMarkdown, mergeNoteMarkdown, renderNoteMarkdown, titleFromMieter } from "./noteMerge";
import { enrichNoteDates } from "./dateEnrichment";
import { rescueMisplacedFields } from "./fieldRescue";
import { applySameAddressFromTenant } from "./addressInference";
import { enrichNotePostalCodes } from "./postalCode";
import { parseNoteFields } from "./discoveries";
import { getSystemPrompt } from "./systemPrompt";
import {
  appendTranscriptChunk,
  buildFullTranscript,
  buildRollingTranscript,
} from "./transcriptBuffer";
import type { NoteSnapshot } from "../types/session";

const EXTRACT_MODEL = "open-mistral-nemo";
const TRANSCRIBE_MODEL = "voxtral-mini-latest";

const EMPTY_NOTE = emptyNoteMarkdown();

function formatTodayDe(now = new Date()): string {
  const d = String(now.getDate()).padStart(2, "0");
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${d}.${m}.${now.getFullYear()}`;
}

function snapshotFromMarkdown(markdown: string): NoteSnapshot {
  const fields = parseNoteFields(markdown);
  const title = titleFromMieter(fields);
  const noteMarkdown = markdown.replace(/^[^\n]+/, title);
  return {
    title,
    noteMarkdown: noteMarkdown.endsWith("\n") ? noteMarkdown : `${noteMarkdown}\n`,
  };
}

/** Segment normalisieren, mergen, Daten/Adresse/PLZ anreichern, Titel aus Mieter ableiten. */
async function finalizeNote(
  raw: string,
  transcript: string,
  previousNote: string
): Promise<NoteSnapshot> {
  const segmentNormalized = applyAllowedValueRules(raw, transcript);
  let merged = mergeNoteMarkdown(previousNote || EMPTY_NOTE, segmentNormalized);
  let fields = parseNoteFields(merged);
  fields = enrichNoteDates(fields, new Date(), transcript);
  fields = rescueMisplacedFields(fields, transcript);
  fields = applySameAddressFromTenant(fields, transcript);
  merged = renderNoteMarkdown(fields);
  const withPlz = await enrichNotePostalCodes(merged);
  return snapshotFromMarkdown(withPlz);
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
    `Heute (lokales Datum der Aufnahme): ${formatTodayDe()}`,
    "",
    "Gebundener Gesprächstext (letzte Abschnitte an Pausen geschnitten und zusammengefügt):",
    transcript,
    "",
    "Extrahiere aus diesem gebundenen Text. Spätere Aussagen und Korrekturen haben Vorrang.",
    "Felder, die im Text nicht klar vorkommen, leer lassen.",
    "Verwandter ≠ Mieter. Explizite Mieter-Angabe in die Mieter-Felder.",
    "Korrekturen gelten für ALLE Felder: jeden neu genannten/korrigierten Wert in das passende Feld schreiben.",
    "Adresse: Straße und Ort getrennt; ohne genannte PLZ nur den Ort in PLZ Ort (PLZ ergänzt die App).",
    "Gleiche Adresse Verstorbener/Mieter ausdrücklich übernehmen (Straße + PLZ Ort kopieren).",
    "Bestatter-Name (z. B. „Bestatter Söhnlein“) NUR in Feld Bestatter – NIEMALS in Verwandtschaftsverhältnis.",
    "Verwandtschaftsverhältnis nur echte Beziehungswörter (Sohn, Tochter, Ehefrau, …).",
    "Relativdaten: vorgestern/gestern/heute anhand „Heute …“ als konkretes TT.MM.JJJJ in Verstorbener Todestag.",
    "Todestag und TF-Wunschtermin: wenn nur Tag/Monat ohne Jahr → Tag.Monat. ohne Jahr schreiben (Jahr ergänzt die App).",
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
  return { ...(await finalizeNote(raw, transcript, previousNote)), transcript };
}

export async function transcribeAndExtract(
  sessionId: string,
  audioUri: string,
  previousNote: string,
  priorTranscriptChunks: string[] = []
): Promise<
  NoteSnapshot & {
    transcript?: string;
    transcriptChunks?: string[];
    skipped?: boolean;
  }
> {
  const apiKey = await requireKey();

  const source = new File(audioUri);
  const sourceSize = await waitForFile(source);
  if (!source.exists || sourceSize < 500) {
    return {
      ...snapshotFromMarkdown(previousNote || EMPTY_NOTE),
      transcript: "",
      transcriptChunks: priorTranscriptChunks,
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
        transcriptChunks: priorTranscriptChunks,
        skipped: true,
      };
    }

    const transcriptChunks = appendTranscriptChunk(priorTranscriptChunks, transcript);
    const rolling = buildRollingTranscript(transcriptChunks);
    const extracted = await extractFromTranscript(sessionId, rolling, previousNote);
    return {
      ...extracted,
      // Roh-Transkript dieses Segments für die UI/Diagnose; Chunks für den nächsten Durchlauf
      transcript,
      transcriptChunks,
    };
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

/**
 * Schlussprüfung nach Stop: gesamtes Sitzungs-Transkript gegen aktuellen Notizstand
 * prüfen und Korrekturen / Ableitungen (z. B. gleiche Adresse) zurückgeben.
 */
export async function reviewNoteFromFullTranscript(
  sessionId: string,
  transcriptChunks: string[],
  currentNote: string
): Promise<NoteSnapshot> {
  const fullTranscript = buildFullTranscript(transcriptChunks);
  if (!fullTranscript.trim()) {
    // trotzdem Datums-/Adress-Nachbearbeitung
    let fields = parseNoteFields(currentNote || EMPTY_NOTE);
    fields = enrichNoteDates(fields, new Date(), "");
    let merged = renderNoteMarkdown(fields);
    merged = await enrichNotePostalCodes(merged);
    return snapshotFromMarkdown(merged);
  }

  const apiKey = await requireKey();
  const userContent = [
    `Session-ID: ${sessionId}`,
    `Heute (lokales Datum der Aufnahme): ${formatTodayDe()}`,
    "",
    "VOLLSTÄNDIGES Sitzungs-Transkript (gesamter Mitschnitt bis Stop):",
    fullTranscript,
    "",
    "Aktueller Notizstand:",
    currentNote || EMPTY_NOTE,
    "",
    "Prüfe den Notizstand am vollständigen Transkript.",
    "Korrigiere falsche/fehlende Werte. Spätere Aussagen haben Vorrang.",
    "Wenn der Verstorbene dieselbe Adresse wie der Mieter hatte: Verstorbener Straße und PLZ Ort vom Mieter übernehmen.",
    "Bestatter-Name (z. B. „Bestatter Söhnlein“) NUR in Feld Bestatter – NIEMALS in Verwandtschaftsverhältnis.",
    "Verwandtschaftsverhältnis nur echte Beziehungswörter (Sohn, Tochter, Ehefrau, …).",
    "Relativdaten: vorgestern/gestern/heute anhand „Heute …“ als konkretes TT.MM.JJJJ in Verstorbener Todestag (falsche Kalenderdaten überschreiben).",
    "Todestag / TF-Wunschtermin ohne Jahr: nur Tag.Monat. schreiben (Jahr ergänzt die App).",
    "Unklare, aber angesprochene Felder als genau ?.",
    "Gib Titel + vollständige Tabelle mit dem korrigierten Gesamtstand aus.",
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
    throw new Error(`Schlussprüfung fehlgeschlagen (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  const raw = data.choices?.[0]?.message?.content?.trim() || "";
  // Als neuer Stand mergen (nicht-leere Korrekturen überschreiben)
  return finalizeNote(raw, fullTranscript, currentNote || EMPTY_NOTE);
}
