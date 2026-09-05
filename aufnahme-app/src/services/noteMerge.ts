import {
  NOTE_FIELDS,
  parseNoteFields,
  type NoteFieldName,
} from "./discoveries";
import { UNCERTAIN_MARK } from "./allowedValues";

const EMPTY_TABLE_ROWS = NOTE_FIELDS.map((field) => `| ${field} |  |`).join("\n");

/** Baut Titel + Markdown-Tabelle aus Feldwerten. */
export function renderNoteMarkdown(fields: Partial<Record<string, string>>): string {
  const title = titleFromMieter(fields);
  const rows = NOTE_FIELDS.map((field) => {
    const value = (fields[field] ?? "").trim();
    return `| ${field} | ${value} |`;
  }).join("\n");
  return `${title}\n\n| Feld | Wert |\n|---|---|\n${rows}\n`;
}

export function titleFromMieter(fields: Partial<Record<string, string>>): string {
  const nach = (fields["Mieter Nachname"] ?? "").trim();
  const vor = (fields["Mieter Vorname"] ?? "").trim();
  if (
    nach &&
    vor &&
    nach !== UNCERTAIN_MARK &&
    vor !== UNCERTAIN_MARK
  ) {
    return `${nach}, ${vor}`;
  }
  return "Aufnahme";
}

/**
 * Merged Segment-Extrakt in den bisherigen Stand.
 * Nicht-leere Werte (inkl. "?") überschreiben IMMER – für jedes Feld
 * (Adresse, Telefon, Grab, Verstorbener, …), nicht nur Mieter-Namen.
 * Leere Zellen im Segment lassen den bisherigen Wert unberührt.
 */
export function mergeNoteFields(
  previous: Record<string, string>,
  incoming: Record<string, string>
): Record<string, string> {
  const merged: Record<string, string> = { ...previous };
  for (const field of NOTE_FIELDS) {
    const next = (incoming[field] ?? "").trim();
    if (next) {
      merged[field] = next;
    }
  }
  return merged;
}

export function mergeNoteMarkdown(previousMarkdown: string, incomingMarkdown: string): string {
  const previous = parseNoteFields(previousMarkdown);
  const incoming = parseNoteFields(incomingMarkdown);
  return renderNoteMarkdown(mergeNoteFields(previous, incoming));
}

export function emptyNoteMarkdown(): string {
  return `Aufnahme\n\n| Feld | Wert |\n|---|---|\n${EMPTY_TABLE_ROWS}\n`;
}

export function setNoteField(
  markdown: string,
  field: NoteFieldName | string,
  value: string
): string {
  const fields = parseNoteFields(markdown);
  fields[field] = value.trim();
  // leere Werte entfernen, damit render sie als leer ausgibt
  if (!fields[field]) {
    delete fields[field];
  }
  return renderNoteMarkdown(fields);
}
