export type Discovery = {
  id: string;
  field: string;
  value: string;
  at: number;
};

/** Reihenfolge der Aufnahme-Felder (wie im System-Prompt / leere Notiz). */
export const NOTE_FIELDS = [
  "Mieter Vorname",
  "Mieter Nachname",
  "Mieter Verwandtschaftsverhältnis zum Verstorbenen",
  "Mieter Straße",
  "Mieter PLZ Ort",
  "Mieter Telefon 1",
  "Mieter Telefon 2",
  "Mieter E-Mail",
  "Mieter Überweisung oder SEPA",
  "Mieter IBAN",
  "Mieter Kontoinhaber",
  "Verstorbener Vorname",
  "Verstorbener Nachname",
  "Verstorbener Straße",
  "Verstorbener PLZ Ort",
  "Verstorbener Geburtstag",
  "Verstorbener Todestag",
  "Bestatter",
  "Bestatter-Aufwand",
  "Grab",
  "Urne",
  "TF-Wunschtermin",
  "TF-Ideen",
] as const;

export type NoteFieldName = (typeof NOTE_FIELDS)[number];

export type NoteTableRow = {
  field: string;
  value: string;
  /** Genannt, aber nicht eindeutig → roter Punkt in der UI. */
  uncertain: boolean;
};

const UNCERTAIN_VALUE = "?";

/** Baut die volle Tabelle inkl. leerer Felder. */
export function buildNoteTableRows(noteMarkdown: string): NoteTableRow[] {
  const values = parseNoteFields(noteMarkdown);
  return NOTE_FIELDS.map((field) => {
    const raw = values[field] ?? "";
    const uncertain = raw === UNCERTAIN_VALUE;
    return {
      field,
      // Unsicherheit nur als roter Punkt, Feldwert leer lassen (kein "?")
      value: uncertain ? "" : raw,
      uncertain,
    };
  });
}

/** Parst die Markdown-Tabelle `| Feld | Wert |` in ein Map. */
export function parseNoteFields(noteMarkdown: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const lines = noteMarkdown.split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\|\s*(.+?)\s*\|\s*(.*?)\s*\|$/);
    if (!match) continue;
    const field = match[1].trim();
    const value = match[2].trim();
    if (!field || field === "Feld" || /^-+$/.test(field.replace(/\s/g, ""))) continue;
    if (value) fields[field] = value;
  }
  return fields;
}

/**
 * Vergleicht alten und neuen Notizstand und liefert neu gefüllte
 * oder geänderte Felder als Discovery-Einträge (Reihenfolge wie in der Tabelle).
 */
export function diffDiscoveries(
  previousMarkdown: string,
  nextMarkdown: string,
  previousTitle: string,
  nextTitle: string,
  idSeed: number
): Discovery[] {
  const prev = parseNoteFields(previousMarkdown);
  const next = parseNoteFields(nextMarkdown);
  const found: Discovery[] = [];
  let n = 0;

  if (nextTitle && nextTitle !== "Aufnahme" && nextTitle !== previousTitle) {
    found.push({
      id: `d-${idSeed}-${n++}`,
      field: "Notiz-Titel",
      value: nextTitle,
      at: Date.now(),
    });
  }

  for (const [field, value] of Object.entries(next)) {
    if (prev[field] === value) continue;
    found.push({
      id: `d-${idSeed}-${n++}`,
      field,
      value,
      at: Date.now(),
    });
  }

  return found;
}
