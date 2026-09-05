import { File, Paths, UploadType } from "expo-file-system";
import { getApiKey } from "./apiKey";
import { emptyNoteMarkdown, renderNoteMarkdown, titleFromMieter } from "./noteMerge";
import { NOTE_FIELDS, parseNoteFields } from "./discoveries";
import {
  normalizeExistingNote,
  runNotePipeline,
  type NotePipelineMode,
} from "./notePipeline";
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

/**
 * Einziger Commit-Pfad: Modell-Extrakt → Validate/Normalize-Pipeline → Notiz.
 * Live-Segmente: mode "segment" (Altbestand bleibt).
 * Stop-Review: mode "full" (Beleg gegen gesamtes Transkript).
 */
async function finalizeNote(
  raw: string,
  transcript: string,
  previousNote: string,
  mode: NotePipelineMode = "segment",
  lockedFields: readonly string[] = []
): Promise<NoteSnapshot> {
  return runNotePipeline({
    rawMarkdown: raw,
    transcript,
    previousNote: previousNote || EMPTY_NOTE,
    mode,
    lockedFields,
  });
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


/** Kompakte Ist-Notiz für den Extraktions-Prompt (nur gesetzte Felder). */
function formatNoteStateForPrompt(noteMarkdown: string): string {
  const fields = parseNoteFields(noteMarkdown || "");
  const lines = NOTE_FIELDS
    .map((field) => {
      const value = (fields[field] ?? "").trim();
      return value ? `- ${field}: ${value}` : "";
    })
    .filter(Boolean);
  return lines.length ? lines.join("\n") : "(noch leer)";
}

export async function extractFromTranscript(
  sessionId: string,
  transcript: string,
  previousNote: string,
  lockedFields: readonly string[] = []
): Promise<NoteSnapshot & { transcript: string }> {
  const apiKey = await requireKey();
  const userContent = [
    `Session-ID: ${sessionId}`,
    `Heute (lokales Datum der Aufnahme): ${formatTodayDe()}`,
    "",
    "Gebundener Gesprächstext (letzte Abschnitte an Pausen geschnitten und zusammengefügt):",
    transcript,
    "",
    "Aktueller Notizstand (Ist) – Korrekturen im Text müssen betroffene Felder mit dem NEUEN Wert überschreiben:",
    formatNoteStateForPrompt(previousNote),
    "",
    "Extrahiere aus diesem gebundenen Text. Spätere Aussagen und Korrekturen haben Vorrang.",
    "Felder, die im Text nicht klar vorkommen, leer lassen.",
    "Verwandter ≠ Mieter ≠ Verstorbener ≠ Bestatter. Namen strikt dem genannten Rolle-Feld zuordnen.",
    "Explizite Mieter-Angabe in Mieter-Felder; Verstorbenennamen nur in Verstorbener; Bestatter nur in Bestatter.",
    "Korrekturen gelten für ALLE Felder: „nicht X sondern Y“, „richtig ist …“, „ich meinte …“ → NEUEN Wert schreiben, alten nicht stehen lassen.",
    "Adresse: Straße und Ort getrennt; vollständigen Straßennamen (nicht nur Kontext). Ohne PLZ nur Ort – App prüft Straße/PLZ gegen OpenPLZ und korrigiert ASR-Fehler.",
    "Gleiche Adresse Verstorbener/Mieter ausdrücklich übernehmen (Straße + PLZ Ort kopieren).",
    "Bestatter-Name (z. B. „Bestatter Söhnlein“) NUR in Feld Bestatter – NIEMALS in Verwandtschaftsverhältnis.",
    "Verwandtschaftsverhältnis nur echte Beziehungswörter (Sohn, Tochter, Ehefrau, …).",
    "Relativdaten: vorgestern/gestern/heute anhand „Heute …“ als konkretes TT.MM.JJJJ in Verstorbener Todestag.",
    "Todestag und TF-Wunschtermin: wenn nur Tag/Monat ohne Jahr → Tag.Monat. ohne Jahr schreiben (Jahr ergänzt die App).",
    "Nur extrahieren, nicht normalisieren: Relativdaten/Straße/PLZ/Rollen korrigiert die App-Pipeline.",
    "E-Mail immer mit @ (nie nur Punkt zwischen Name und Domain; ASR at/ät → @). Local-Part an bekannte Namensschreibung (Meyer nicht Meier).",
    "gestern/vorgestern/heute X geworden → Verstorbener Geburtstag (Jahrestag minus Alter), NICHT Todestag.",
    "Datumsformat ausschließlich TT.MM.JJJJ (kein ISO JJJJ-MM-TT; unbekannter Tag 00.MM.JJJJ).",
    "Nur explizit Gesagtes – keine erfundenen Namen/Grab/Urne. ? nur wenn das Feld wirklich angesprochen und unklar ist.",
    "Kalender: erster/zweiter/letzter Wochentag im Monat = n-ter Wochentag (erster Sonntag im Oktober ist nicht der 01.10.). Die App loest das deterministisch.",
    "geboren am ersten Sonntag im Mai 1934 → Verstorbener Geburtstag (nicht TF-Wunschtermin).",
    "Relativtermine: uebernaechsten Sonntag / also den 13. anhand Heute als konkretes TT.MM.JJJJ in TF-Wunschtermin.",
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
  return { ...(await finalizeNote(raw, transcript, previousNote, "segment", lockedFields)), transcript };
}

export async function transcribeAndExtract(
  sessionId: string,
  audioUri: string,
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
    const extracted = await extractFromTranscript(sessionId, rolling, previousNote, lockedFields);
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
  currentNote: string,
  lockedFields: readonly string[] = []
): Promise<NoteSnapshot> {
  const fullTranscript = buildFullTranscript(transcriptChunks);
  if (!fullTranscript.trim()) {
    return normalizeExistingNote(currentNote || EMPTY_NOTE, "");
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
    "Verwandter ≠ Mieter ≠ Verstorbener ≠ Bestatter. Namen strikt rollenweise zuordnen; keine Vermischung.",
    "Straßennamen vollständig und gegen OpenPLZ plausibel; keine Kontext-Fragmente als Straße.",
    "Korrigiere falsche/fehlende Werte. Spätere Aussagen haben Vorrang.",
    "Wenn der Verstorbene dieselbe Adresse wie der Mieter hatte: Verstorbener Straße und PLZ Ort vom Mieter übernehmen.",
    "Bestatter-Name (z. B. „Bestatter Söhnlein“) NUR in Feld Bestatter – NIEMALS in Verwandtschaftsverhältnis.",
    "Verwandtschaftsverhältnis nur echte Beziehungswörter (Sohn, Tochter, Ehefrau, …).",
    "E-Mail immer mit @ (nie nur Punkt zwischen Name und Domain; ASR at/ät → @). Local-Part an bekannte Namensschreibung (Meyer nicht Meier).",
    "gestern/vorgestern/heute X geworden → Verstorbener Geburtstag (Jahrestag minus Alter), NICHT Todestag.",
    "Datumsformat ausschließlich TT.MM.JJJJ (kein ISO). Relativdaten: vorgestern/gestern/heute anhand Heute als TT.MM.JJJJ in Verstorbener Todestag.",
    "Todestag / TF-Wunschtermin ohne Jahr: nur Tag.Monat. schreiben (Jahr ergänzt die App).",
    "Nur extrahieren, nicht normalisieren: Relativdaten/Straße/PLZ/Rollen korrigiert die App-Pipeline.",
    "E-Mail immer mit @ (nie nur Punkt zwischen Name und Domain; ASR at/ät → @). Local-Part an bekannte Namensschreibung (Meyer nicht Meier).",
    "gestern/vorgestern/heute X geworden → Verstorbener Geburtstag (Jahrestag minus Alter), NICHT Todestag.",
    "Datumsformat ausschließlich TT.MM.JJJJ (kein ISO JJJJ-MM-TT; unbekannter Tag 00.MM.JJJJ).",
    "Nur explizit Gesagtes – keine erfundenen Namen/Grab/Urne. ? nur wenn das Feld wirklich angesprochen und unklar ist.",
    "Kalender: erster/zweiter/letzter Wochentag im Monat = n-ter Wochentag (erster Sonntag im Oktober ist nicht der 01.10.). Die App loest das deterministisch.",
    "geboren am ersten Sonntag im Mai 1934 → Verstorbener Geburtstag (nicht TF-Wunschtermin).",
    "Relativtermine: übernächsten Sonntag / „also den 13.“ anhand Heute als konkretes TT.MM.JJJJ in TF-Wunschtermin.",
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
  // Volles Transkript: Halluzinationen gegen Gesamtbeleg streichen, Altbestand sonst erhalten
  return finalizeNote(raw, fullTranscript, currentNote || EMPTY_NOTE, "full", lockedFields);
}
