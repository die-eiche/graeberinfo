import allowedValues from "../data/allowedValues.json";
import { NOTE_FIELDS, parseNoteFields } from "./discoveries";

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

function renderFieldsMarkdown(fields: Record<string, string>): string {
  const rows = NOTE_FIELDS.map((field) => {
    const value = (fields[field] ?? "").trim();
    return `| ${field} | ${value} |`;
  }).join("\n");
  return `Aufnahme\n\n| Feld | Wert |\n|---|---|\n${rows}\n`;
}

const GRAVE_KEYWORD =
  /\b(grab(?:nummer|stelle|platz)?|grabraum|urnengrab|wahlgrab|reihengrab)\b/i;

/** Starke Hinweise, dass eine Grabnummer gemeint war (auch ohne parsebare Ziffern). */
const STRONG_GRAVE_REF =
  /\b(grabnummer|grabstelle|grab\s*nr\.?|grab\s*nummer|nummer\s+(?:vom\s+)?grab)\b/i;

const SPOKEN_DIGIT: Record<string, string> = {
  null: "0",
  zero: "0",
  eins: "1",
  ein: "1",
  zwei: "2",
  zwo: "2",
  drei: "3",
  vier: "4",
  fuenf: "5",
  fünf: "5",
  sechs: "6",
  sieben: "7",
  acht: "8",
  neun: "9",
};

/**
 * Sucht Grab-Kandidaten im Transkript (Punkte, Ziffernfolgen, gesprochene Ziffern).
 * Rückgabe:
 * - gültige Grabnummer, wenn eindeutig auflösbar
 * - "?" wenn Grab angesprochen / Grabmuster erkannt, aber nicht in der Liste
 * - null wenn kein Grab-Bezug erkennbar
 */
export function resolveGraveFromTranscript(transcript: string): string | null {
  const text = transcript.trim();
  if (!text) return null;

  const hasKeyword = GRAVE_KEYWORD.test(text);
  const strongRef = STRONG_GRAVE_REF.test(text);
  const candidates: string[] = [];

  // Punktiertes Grabformat ist charakteristisch genug
  for (const match of text.matchAll(/\b\d(?:\.\d{2}){3,4}\b/g)) {
    candidates.push(match[0]);
  }

  // Rohe Ziffernfolgen / gesprochene Ziffern nur mit Grab-Kontext
  if (hasKeyword) {
    for (const match of text.matchAll(/\b\d(?:[\s./-]*\d){6,8}\b/g)) {
      const digits = match[0].replace(/\D/g, "");
      if (digits.length === 7 || digits.length === 9) {
        candidates.push(digits);
      }
    }

    const afterGrab = text.split(GRAVE_KEYWORD).slice(1).join(" ");
    const spoken = extractSpokenDigits(afterGrab.slice(0, 160));
    if (spoken.length >= 4) {
      candidates.push(spoken);
    }
  }

  const resolved = candidates
    .map((c) => normalizeGraveValue(c))
    .filter((v) => v.length > 0);

  const valid = resolved.find((v) => v !== UNCERTAIN_MARK);
  if (valid) return valid;

  if (resolved.some((v) => v === UNCERTAIN_MARK)) {
    return UNCERTAIN_MARK;
  }

  // „Grabnummer …“ ohne parsebare Ziffern → unsicher markieren
  if (strongRef) {
    return UNCERTAIN_MARK;
  }

  // „Grab“ + Ziffern, die nicht zum Muster passen → unsicher
  if (hasKeyword && /\d/.test(text)) {
    return UNCERTAIN_MARK;
  }

  return null;
}

function extractSpokenDigits(chunk: string): string {
  const tokens = chunk
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  let digits = "";
  for (const token of tokens) {
    if (/^\d+$/.test(token)) {
      digits += token;
      continue;
    }
    const mapped = SPOKEN_DIGIT[token];
    if (mapped) {
      digits += mapped;
      continue;
    }
    // nach ersten Nicht-Ziffern abbrechen, sobald schon Ziffern gesammelt
    if (digits.length > 0) break;
  }
  return digits;
}

/**
 * Nach der KI-Auswertung:
 * - Urne / Bestatter: Schreibweise an Liste anlehnen, andere Werte erlaubt
 * - Grab: Punkte ergänzen, nur exakte Listen-Treffer; sonst "?"
 * - Transkript: wenn Grab erkennbar, aber KI leer ließ → "?" bzw. gültige Nummer setzen
 */
export function applyAllowedValueRules(
  noteMarkdown: string,
  transcript?: string
): string {
  const fields = { ...parseNoteFields(noteMarkdown) };

  if (fields["Urne"]) {
    fields["Urne"] = softMatchAllowed(fields["Urne"], URN_LIST);
  }

  if (fields["Bestatter"]) {
    fields["Bestatter"] = softMatchAllowed(fields["Bestatter"], UNDERTAKER_LIST);
  }

  let grave = (fields["Grab"] ?? "").trim();
  if (grave) {
    grave = normalizeGraveValue(grave);
    if (grave) fields["Grab"] = grave;
    else delete fields["Grab"];
  }

  if (transcript) {
    const fromTranscript = resolveGraveFromTranscript(transcript);
    if (fromTranscript !== null) {
      // Transkript setzt, wenn KI leer ließ; gültige Nummer ersetzt "?";
      // "?" überschreibt keine bereits gültige Listennummer.
      if (!grave) {
        fields["Grab"] = fromTranscript;
      } else if (grave === UNCERTAIN_MARK && fromTranscript !== UNCERTAIN_MARK) {
        fields["Grab"] = fromTranscript;
      } else if (grave === UNCERTAIN_MARK) {
        fields["Grab"] = UNCERTAIN_MARK;
      }
    }
  }

  return renderFieldsMarkdown(fields);
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
