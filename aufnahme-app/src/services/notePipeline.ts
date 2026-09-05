/**
 * Zentrale Notiz-Pipeline (Extract → Validate/Normalize → Commit).
 *
 * Architektur (Dauerweg, keine Einzelfall-Releases):
 * 1. EXTRACT   – Mistral liefert nur explizit Gesagtes (Markdown-Tabelle).
 * 2. VALIDATE  – App prüft Belege (Transkript), Listen, OpenPLZ.
 * 3. NORMALIZE – Relativdaten, Rollenrettung, Straßen/PLZ, Adresskopie.
 * 4. COMMIT    – Nur der validierte Stand wird in die Notiz geschrieben.
 *
 * Wichtig gegen „Werte verschwinden“:
 * - Live-Segment: Grounding nur auf dem **neuen Extrakt**, danach Merge.
 *   Bereits bestätigte Felder bleiben, auch wenn das aktuelle Segment sie nicht nennt.
 * - Stop/Full: Grounding auf dem Gesamtstand gegen das **volle** Transkript.
 *
 * Neue Fehlertypen gehören als Regelklasse hierher, nicht als Prompt-Sonderfall.
 */
import { applyAllowedValueRules } from "./allowedValues";
import { applySameAddressFromTenant } from "./addressInference";
import { enrichNoteDates } from "./dateEnrichment";
import { parseNoteFields } from "./discoveries";
import { clearUngroundedFields } from "./fieldGrounding";
import { applySpokenCorrections } from "./fieldCorrections";
import { rescueMisplacedFields } from "./fieldRescue";
import {
  emptyNoteMarkdown,
  mergeNoteFields,
  mergeNoteMarkdown,
  renderNoteMarkdown,
  titleFromMieter,
} from "./noteMerge";
import { enrichNotePostalCodes } from "./postalCode";
import type { NoteSnapshot } from "../types/session";

const EMPTY_NOTE = emptyNoteMarkdown();

export type NotePipelineMode = "segment" | "full";

export type NotePipelineInput = {
  /** Rohe Modell-Ausgabe (Titel + Markdown-Tabelle) oder bisheriger Stand. */
  rawMarkdown: string;
  /** Transkript-Beleg für Grounding und Rescue (Segment/Rolling oder Vollsitzung). */
  transcript: string;
  /** Bisheriger Notizstand; leere Segment-Zellen löschen nichts. */
  previousNote?: string;
  /** Referenzzeit für Relativdaten (Tests). */
  now?: Date;
  /**
   * segment = Live: Halluzinationen nur im neuen Extrakt streichen, Altbestand schützen.
   * full = Stop: Gesamtstand gegen volles Transkript belegen.
   */
  mode?: NotePipelineMode;
};

export type NotePipelineStage =
  | "ground_incoming"
  | "merge_allowed_values"
  | "enrich_dates"
  | "rescue_roles"
  | "apply_corrections"
  | "clear_ungrounded_full"
  | "same_address"
  | "openplz_street_plz";

/**
 * Feste Stufenreihenfolge. Jede Stufe ist deterministisch und testbar.
 * Mistral gehört bewusst nicht hier hinein – nur Extraktion davor.
 */
export const NOTE_PIPELINE_STAGES: readonly NotePipelineStage[] = [
  "ground_incoming",
  "merge_allowed_values",
  "enrich_dates",
  "rescue_roles",
  "apply_corrections",
  "clear_ungrounded_full",
  "same_address",
  "openplz_street_plz",
] as const;

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
 * Führt Validate/Normalize/Commit auf einem Extrakt aus.
 * Einziger Schreibpfad für Live-Segmente und Stop-Review.
 */
export async function runNotePipeline(input: NotePipelineInput): Promise<NoteSnapshot> {
  const now = input.now ?? new Date();
  const transcript = input.transcript ?? "";
  const previous = input.previousNote || EMPTY_NOTE;
  const mode: NotePipelineMode = input.mode ?? "segment";

  // 1) Listen/Grab-Regeln nur auf dem neuen Extrakt
  const segmentNormalized = applyAllowedValueRules(input.rawMarkdown, transcript);
  let incomingFields = parseNoteFields(segmentNormalized);

  // 2) Live: Halluzinationen nur im Extrakt entfernen – nicht den Altbestand anfassen
  if (mode === "segment") {
    incomingFields = clearUngroundedFields(incomingFields, transcript);
  }

  // 3) Merge: nicht-leere Incoming-Werte überschreiben, leere Incoming-Zellen erhalten Previous
  let fields = mergeNoteFields(parseNoteFields(previous), incomingFields);

  // 4) Relativdaten deterministisch
  fields = enrichNoteDates(fields, now, transcript);

  // 5) Rollen aus Transkript retten (füllt/korrigiert, löscht keinen belegten Altbestand ohne Anlass)
  fields = rescueMisplacedFields(fields, transcript);

  // 6) Gesprochene Korrekturen (nicht X sondern Y) – gewinnen gegen Altbestand und Modell-Wiederholung
  fields = applySpokenCorrections(fields, transcript);

  // 6b) Nach Korrekturen Datumsfelder nochmals anreichern (z. B. „gestern“ → TT.MM.JJJJ)
  fields = enrichNoteDates(fields, now, "");

  // 7) Stop/Full: Gesamtstand gegen volles Transkript belegen
  if (mode === "full") {
    fields = clearUngroundedFields(fields, transcript);
  }

  // 7) Explizite „gleiche Adresse“-Ableitung
  fields = applySameAddressFromTenant(fields, transcript);

  const merged = renderNoteMarkdown(fields);

  // 8) OpenPLZ: Straße kanonisieren + PLZ setzen/korrigieren
  const withPlz = await enrichNotePostalCodes(merged);
  return snapshotFromMarkdown(withPlz);
}

/**
 * Nur Normalisierung ohne neues Modell-Extrakt
 * (z. B. leeres Transkript nach Stop).
 */
export async function normalizeExistingNote(
  noteMarkdown: string,
  transcript = "",
  now = new Date()
): Promise<NoteSnapshot> {
  return runNotePipeline({
    rawMarkdown: emptyNoteMarkdown(),
    transcript,
    previousNote: noteMarkdown || EMPTY_NOTE,
    now,
    // Ohne volles Transkript keinen Altbestand leeren
    mode: transcript.trim() ? "full" : "segment",
  });
}
