export type Discovery = {
  id: string;
  field: string;
  value: string;
  at: number;
};

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
