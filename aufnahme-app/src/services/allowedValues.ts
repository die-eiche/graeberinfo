import allowedValues from "../data/allowedValues.json";
import { parseNoteFields } from "./discoveries";

type AllowedCatalog = {
  urnen: string[];
  bestatter: string[];
  graeber: string[];
};

const catalog = allowedValues as AllowedCatalog;

const GRAVE_SET = new Set(catalog.graeber);
const URN_LIST = catalog.urnen;
const UNDERTAKER_LIST = catalog.bestatter;

export function getAllowedUrns(): string[] {
  return URN_LIST;
}

export function getAllowedUndertakers(): string[] {
  return UNDERTAKER_LIST;
}

export function isAllowedGrave(value: string): boolean {
  return GRAVE_SET.has(value.trim());
}

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "");
}

/** Leichte Schreibweisen-Korrektur; ohne Treffer Original behalten. */
export function softMatchAllowed(value: string, allowed: string[]): string {
  const raw = value.trim();
  if (!raw) return "";
  const exact = allowed.find((item) => item === raw);
  if (exact) return exact;
  const key = normalizeKey(raw);
  if (!key) return raw;
  const byKey = allowed.find((item) => normalizeKey(item) === key);
  if (byKey) return byKey;
  const contains = allowed.find(
    (item) => normalizeKey(item).includes(key) || key.includes(normalizeKey(item))
  );
  return contains || raw;
}

function setTableField(markdown: string, field: string, value: string): string {
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^(\\|\\s*${escaped}\\s*\\|\\s*)(.*?)(\\s*\\|)$`, "m");
  if (!pattern.test(markdown)) return markdown;
  return markdown.replace(pattern, `$1${value}$3`);
}

/**
 * Nach der KI-Auswertung:
 * - Urne / Bestatter: Schreibweise an Liste anlehnen, andere Werte erlaubt
 * - Grab: nur exakte Treffer aus der Gräberliste; sonst leeren
 */
export function applyAllowedValueRules(noteMarkdown: string): string {
  const fields = parseNoteFields(noteMarkdown);
  let next = noteMarkdown;

  const urn = fields["Urne"];
  if (urn) {
    next = setTableField(next, "Urne", softMatchAllowed(urn, URN_LIST));
  }

  const undertaker = fields["Bestatter"];
  if (undertaker) {
    next = setTableField(next, "Bestatter", softMatchAllowed(undertaker, UNDERTAKER_LIST));
  }

  const grave = fields["Grab"];
  if (grave) {
    const trimmed = grave.trim();
    next = setTableField(next, "Grab", isAllowedGrave(trimmed) ? trimmed : "");
  }

  return next;
}

/** Prompt-Abschnitt mit Listen (ohne die große Gräberliste). */
export function buildAllowedValuesPromptSection(): string {
  const urnLines = URN_LIST.map((u) => `- ${u}`).join("\n");
  const undertakerLines = UNDERTAKER_LIST.map((u) => `- ${u}`).join("\n");
  return `## Zulässige / bevorzugte Werte

### Urne (Schreibweisen-Orientierung)
Bevorzuge eine der folgenden Schreibweisen, wenn erkennbar dieselbe Urne gemeint ist.
Andere Urnenangaben sind erlaubt, wenn sie eindeutig genannt werden und nicht zur Liste passen.
${urnLines}

### Bestatter (Schreibweisen-Orientierung)
Bevorzuge eine der folgenden Schreibweisen, wenn erkennbar derselbe Bestatter gemeint ist.
Andere Bestatter sind erlaubt, wenn sie eindeutig genannt werden und nicht zur Liste passen.
${undertakerLines}

### Grab (streng)
- Nur eine Grabnummer übernehmen, die exakt so genannt wurde und im Format mit Punkten vorliegt (z. B. „1.01.01.04“ oder „1.06.20.06.01“).
- Keine Umschreibungen, keine Näherungen, keine „ähnlichen“ Nummern.
- Wenn die genannte Grabnummer nicht eindeutig und exakt ist: Feld Grab leer lassen.
- Die App prüft Grabnummern zusätzlich gegen die offizielle Gräberliste und verwirft Nicht-Treffer.`;
}
