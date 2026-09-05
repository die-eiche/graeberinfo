/**
 * Zentrale Notiz-Pipeline (Extract → Validate/Normalize → Commit).
 *
 * Architektur (Dauerweg, keine Einzelfall-Releases):
 * 1. EXTRACT   – Mistral liefert nur explizit Gesagtes (Markdown-Tabelle).
 * 2. VALIDATE  – App prüft Belege (Transkript), Listen, OpenPLZ.
 * 3. NORMALIZE – Relativdaten, Rollenrettung, Straßen/PLZ, Adresskopie.
 * 4. COMMIT    – Nur der validierte Stand wird in die Notiz geschrieben.
 *
 * Neue Fehlertypen gehören als Regelklasse hierher, nicht als Prompt-Sonderfall.
 */
import { applyAllowedValueRules } from "./allowedValues";
import { applySameAddressFromTenant } from "./addressInference";
import { enrichNoteDates } from "./dateEnrichment";
import { parseNoteFields } from "./discoveries";
import { clearUngroundedFields } from "./fieldGrounding";
import { rescueMisplacedFields } from "./fieldRescue";
import {
  emptyNoteMarkdown,
  mergeNoteMarkdown,
  renderNoteMarkdown,
  titleFromMieter,
} from "./noteMerge";
import { enrichNotePostalCodes } from "./postalCode";
import type { NoteSnapshot } from "../types/session";

const EMPTY_NOTE = emptyNoteMarkdown();

export type NotePipelineInput = {
  /** Rohe Modell-Ausgabe (Titel + Markdown-Tabelle) oder bisheriger Stand. */
  rawMarkdown: string;
  /** Transkript-Beleg für Grounding und Rescue (Segment oder Vollsitzung). */
  transcript: string;
  /** Bisheriger Notizstand; leere Segment-Zellen löschen nichts. */
  previousNote?: string;
  /** Referenzzeit für Relativdaten (Tests). */
  now?: Date;
};

export type NotePipelineStage =
  | "merge_allowed_values"
  | "enrich_dates"
  | "rescue_roles"
  | "clear_ungrounded"
  | "same_address"
  | "openplz_street_plz";

/**
 * Feste Stufenreihenfolge. Jede Stufe ist deterministisch und testbar.
 * Mistral gehört bewusst nicht hier hinein – nur Extraktion davor.
 */
export const NOTE_PIPELINE_STAGES: readonly NotePipelineStage[] = [
  "merge_allowed_values",
  "enrich_dates",
  "rescue_roles",
  "clear_ungrounded",
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

  // 1) Listen/Grab-Regeln auf Segment, dann Merge (nicht-leer überschreibt)
  const segmentNormalized = applyAllowedValueRules(input.rawMarkdown, transcript);
  let merged = mergeNoteMarkdown(previous, segmentNormalized);
  let fields = parseNoteFields(merged);

  // 2) Relativdaten deterministisch (vorgestern, übernächster Sonntag, …)
  fields = enrichNoteDates(fields, now, transcript);

  // 3) Rollen aus Transkript retten (Bestatter/Mieter/Verstorbener)
  fields = rescueMisplacedFields(fields, transcript);

  // 4) Nur belegte Werte behalten (keine Halluzinationen)
  fields = clearUngroundedFields(fields, transcript);

  // 5) Explizite „gleiche Adresse“-Ableitung
  fields = applySameAddressFromTenant(fields, transcript);

  merged = renderNoteMarkdown(fields);

  // 6) OpenPLZ: Straße kanonisieren + PLZ setzen/korrigieren
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
  });
}
