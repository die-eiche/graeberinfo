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

/** Marker in der Markdown-Zelle für „genannt, aber nicht eindeutig“. */
export const UNCERTAIN_MARK = "?";

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
  if (!raw || raw === UNCERTAIN_MARK) return raw;
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

/**
 * Formatiert Ziffernfolgen als Grabnummer:
 * 1 Ziffer + Gruppen à 2 Ziffern → z. B. 2010101 → 2.01.01.01
 */
export function formatGraveDigits(digits: string): string | null {
  if (!/^\d+$/.test(digits)) return null;
  if (digits.length === 7) {
    return `${digits[0]}.${digits.slice(1, 3)}.${digits.slice(3, 5)}.${digits.slice(5, 7)}`;
  }
  if (digits.length === 9) {
    return `${digits[0]}.${digits.slice(1, 3)}.${digits.slice(3, 5)}.${digits.slice(5, 7)}.${digits.slice(7, 9)}`;
  }
  return null;
}

/**
 * Normalisiert eine Grab-Angabe:
 * - Punkte ergänzen, wenn nur Ziffern/gesprochene Gruppen kommen
 * - nur exakte Listen-Treffer behalten
 * - sonst "?" (genannt, aber nicht eindeutig/gültig)
 */
export function normalizeGraveValue(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (trimmed === UNCERTAIN_MARK) return UNCERTAIN_MARK;

  const alreadyDotted = /^\d(\.\d{2}){3,4}$/.test(trimmed);
  if (alreadyDotted) {
    return GRAVE_SET.has(trimmed) ? trimmed : UNCERTAIN_MARK;
  }

  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return UNCERTAIN_MARK;

  const formatted = formatGraveDigits(digits);
  if (!formatted) return UNCERTAIN_MARK;
  return GRAVE_SET.has(formatted) ? formatted : UNCERTAIN_MARK;
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
 * - Grab: Punkte ergänzen, nur exakte Listen-Treffer; sonst "?"
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
    next = setTableField(next, "Grab", normalizeGraveValue(grave));
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
Unklar → \`?\`.
${urnLines}

### Bestatter (Schreibweisen-Orientierung)
Bevorzuge eine der folgenden Schreibweisen, wenn erkennbar derselbe Bestatter gemeint ist.
Andere Bestatter sind erlaubt, wenn sie eindeutig genannt werden und nicht zur Liste passen.
Unklar → \`?\`.
${undertakerLines}

### Grab (streng, Punkte ggf. ergänzen)
- Muster: erste Gruppe **1 Ziffer**, alle weiteren Gruppen **2 Ziffern**, mit Punkten (z. B. \`2.01.01.01\` oder \`2.01.01.01.04\`).
- Wenn Punkte nicht mitgesprochen wurden: Punkte nach diesem Muster ergänzen.
- Danach nur übernehmen, wenn die Nummer **exakt** in der offiziellen Gräberliste vorkommt.
- Keine Umschreibungen, keine Näherungen, keine „ähnlichen“ Nummern.
- Nicht eindeutig / nicht in der Liste → Zellenwert genau \`?\`.
- Die App prüft Grabnummern zusätzlich und setzt ungültige Werte auf \`?\`.`;
}
