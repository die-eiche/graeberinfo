import { UNCERTAIN_MARK } from "./allowedValues";
import type { NoteFieldName } from "./discoveries";
import { NOTE_FIELDS } from "./discoveries";

/**
 * Deterministische Korrekturen aus dem Transkript.
 * Ziel: „nicht X sondern Y“ / „richtig ist …“ überschreiben den Notizstand,
 * auch wenn das Extraktionsmodell die Korrektur ignoriert oder den alten Wert erneut schreibt.
 */

export type SpokenCorrection = {
  from?: string;
  to: string;
  /** Explizites Zielfeld, wenn aus dem Kontext erkennbar. */
  field?: NoteFieldName;
  /** Weicher Hinweis: Vorname / Nachname / Rolle. */
  namePart?: "first" | "last";
  role?: "mieter" | "verstorbener" | "bestatter";
};

function fold(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

const STOP_VALUES = new Set(
  [
    "der",
    "die",
    "das",
    "den",
    "dem",
    "ein",
    "eine",
    "einer",
    "eines",
    "und",
    "oder",
    "mit",
    "von",
    "vom",
    "für",
    "ist",
    "war",
    "wird",
    "heißt",
    "namens",
    "name",
    "richtig",
    "korrektur",
    "nochmal",
    "bitte",
    "also",
    "nein",
  ].map((w) => fold(w))
);

function normalizeValue(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^[„“"'\s]+|[„“"'\s.,;:!?]+$/g, "");
}

function looksUsableValue(value: string): boolean {
  const v = normalizeValue(value);
  if (v.length < 2 || v.length > 48) return false;
  if (STOP_VALUES.has(fold(v))) return false;
  if (/^(nicht|sondern|richtig|korrektur)$/i.test(v)) return false;
  return true;
}

function capitalizeName(value: string): string {
  return normalizeValue(value)
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function valuesMatch(a: string, b: string): boolean {
  const fa = fold(a);
  const fb = fold(b);
  if (!fa || !fb) return false;
  if (fa === fb) return true;
  const aParts = fa.split(/\s+/);
  const bParts = fb.split(/\s+/);
  // Nachname allein vs. voller Name / Vorname allein
  if (aParts.length === 1 && bParts.includes(aParts[0])) return true;
  if (bParts.length === 1 && aParts.includes(bParts[0])) return true;
  return false;
}

function contextBefore(text: string, index: number, chars = 48): string {
  return text.slice(Math.max(0, index - chars), index);
}

function inferHints(prefix: string): Pick<SpokenCorrection, "field" | "namePart" | "role"> {
  const p = fold(prefix);
  const role: SpokenCorrection["role"] | undefined = /\bmieter/.test(p)
    ? "mieter"
    : /\bverstorben/.test(p)
      ? "verstorbener"
      : /\bbestatter/.test(p)
        ? "bestatter"
        : undefined;

  if (/\bgrab/.test(p)) return { field: "Grab", role };
  if (/\burne/.test(p)) return { field: "Urne", role };
  if (/\btodestag|\bgestorben|\bverstorben/.test(p) && !/\bvorname|\bnachname|\bheisst|\bheißt/.test(p)) {
    return { field: "Verstorbener Todestag", role: "verstorbener" };
  }
  if (/\bgeburtstag|\bgeboren/.test(p)) return { field: "Verstorbener Geburtstag", role: "verstorbener" };
  if (/\bwunschtermin|\btrauerfeier|\btf\b/.test(p)) return { field: "TF-Wunschtermin", role };
  if (/\bbestatter/.test(p)) return { field: "Bestatter", role: "bestatter" };
  if (/\bstrasse|\bstraße/.test(p)) {
    if (role === "verstorbener") return { field: "Verstorbener Straße", role };
    return { field: "Mieter Straße", role: role ?? "mieter" };
  }
  if (/\bplz|\bort\b/.test(p)) {
    if (role === "verstorbener") return { field: "Verstorbener PLZ Ort", role };
    return { field: "Mieter PLZ Ort", role: role ?? "mieter" };
  }
  if (/\bvorname/.test(p)) {
    if (role === "verstorbener") return { field: "Verstorbener Vorname", namePart: "first", role };
    if (role === "mieter") return { field: "Mieter Vorname", namePart: "first", role };
    return { namePart: "first", role };
  }
  if (/\bnachname|\bfamilienname/.test(p)) {
    if (role === "verstorbener") return { field: "Verstorbener Nachname", namePart: "last", role };
    if (role === "mieter") return { field: "Mieter Nachname", namePart: "last", role };
    return { namePart: "last", role };
  }
  if (role === "bestatter") return { field: "Bestatter", role };
  if (role) return { role };
  return {};
}

function pushCorrection(out: SpokenCorrection[], partial: SpokenCorrection) {
  const to = normalizeValue(partial.to);
  if (!looksUsableValue(to)) return;
  const from = partial.from ? normalizeValue(partial.from) : undefined;
  if (from && !looksUsableValue(from)) return;
  if (from && fold(from) === fold(to)) return;
  out.push({ ...partial, from, to });
}

/**
 * Extrahiert Korrekturpaare aus dem Transkript (Reihenfolge = Sprechreihenfolge).
 */
export function extractSpokenCorrections(transcript: string): SpokenCorrection[] {
  const text = transcript.replace(/\s+/g, " ").trim();
  if (!text) return [];

  const out: SpokenCorrection[] = [];

  const sondern =
    /\bnicht\s+([^,.!?]{1,40}?)\s*,?\s*sondern\s+([^,.!?]{1,40}?)(?=(?:[.!?,;]|\s+nicht\s+|\s+und\s+|$))/gi;
  let match: RegExpExecArray | null;
  while ((match = sondern.exec(text))) {
    // Nur enger Kontext direkt vor „nicht … sondern …“, sonst klebt z. B. „Bestatter“ an Namenskorrekturen
    const hints = inferHints(contextBefore(text, match.index, 28));
    pushCorrection(out, { from: match[1], to: match[2], ...hints });
  }

  const heisstNicht =
    /\b(?:heißt|heisst|ist|war)\s+nicht\s+([^,.!?]{1,40}?)\s*,?\s*sondern\s+([^,.!?]{1,40}?)(?=(?:[.!?,;]|\s+nicht\s+|$))/gi;
  while ((match = heisstNicht.exec(text))) {
    const hints = inferHints(contextBefore(text, match.index));
    pushCorrection(out, { from: match[1], to: match[2], ...hints });
  }

  const richtig =
    /\b(?:richtig\s+ist|richtig|korrektur|ich\s+meinte|nochmal)\s*[:\-]?\s+([^,.!?]{2,40}?)(?=(?:[.!?,;]|$))/gi;
  while ((match = richtig.exec(text))) {
    const hints = inferHints(contextBefore(text, match.index));
    // ohne "from" nur mit Feld-/Rollenhinweis anwenden
    if (!hints.field && !hints.role && !hints.namePart) continue;
    pushCorrection(out, { to: match[1], ...hints });
  }

  const nein =
    /\b([A-Za-zÄÖÜäöüß0-9][A-Za-zÄÖÜäöüß0-9.\-]{1,30})\s*[,–—-]?\s*nein\s+([A-Za-zÄÖÜäöüß0-9][A-Za-zÄÖÜäöüß0-9.\-\s]{1,40}?)(?=(?:[.!?,;]|$))/gi;
  while ((match = nein.exec(text))) {
    const hints = inferHints(contextBefore(text, match.index));
    pushCorrection(out, { from: match[1], to: match[2], ...hints });
  }

  return out;
}

function resolveTargetFields(
  fields: Record<string, string>,
  correction: SpokenCorrection
): NoteFieldName[] {
  const targets: NoteFieldName[] = [];

  // 1) Vorrang: Ist-Wert entspricht dem alten Korrekturwert (schützt vor falschem Kontext-Hint)
  if (correction.from) {
    for (const field of NOTE_FIELDS) {
      const value = (fields[field] ?? "").trim();
      if (!value || value === UNCERTAIN_MARK) continue;
      if (valuesMatch(value, correction.from)) targets.push(field);
    }
  }
  if (targets.length) return targets;

  // 2) Explizites Zielfeld aus Sprachkontext
  if (correction.field) return [correction.field];

  if (correction.role === "bestatter") return ["Bestatter"];

  if (correction.namePart === "first") {
    if (correction.role === "mieter") return ["Mieter Vorname"];
    if (correction.role === "verstorbener") return ["Verstorbener Vorname"];
  }
  if (correction.namePart === "last") {
    if (correction.role === "mieter") return ["Mieter Nachname"];
    if (correction.role === "verstorbener") return ["Verstorbener Nachname"];
  }

  if (correction.role === "mieter" && correction.from) {
    // Fallback: unspezifische Mieter-Korrektur → beide Namensfelder prüfen
    return ["Mieter Vorname", "Mieter Nachname"];
  }
  if (correction.role === "verstorbener" && correction.from) {
    return ["Verstorbener Vorname", "Verstorbener Nachname"];
  }

  return targets;
}

function formatForField(field: NoteFieldName, value: string): string {
  if (
    field === "Mieter Vorname" ||
    field === "Mieter Nachname" ||
    field === "Verstorbener Vorname" ||
    field === "Verstorbener Nachname" ||
    field === "Bestatter" ||
    field === "Mieter Kontoinhaber"
  ) {
    return capitalizeName(value);
  }
  return normalizeValue(value);
}

function applyOneCorrection(
  fields: Record<string, string>,
  correction: SpokenCorrection
): Record<string, string> {
  const next = { ...fields };
  const targets = resolveTargetFields(next, correction);
  if (!targets.length) {
    // Kein Treffer im Ist-Stand: bei klarer Rolle + Namenskorrektur trotzdem setzen
    if (correction.role === "bestatter") {
      next.Bestatter = formatForField("Bestatter", correction.to);
    } else if (correction.role === "verstorbener" && correction.namePart === "first") {
      next["Verstorbener Vorname"] = formatForField("Verstorbener Vorname", correction.to);
    } else if (correction.role === "verstorbener" && correction.namePart === "last") {
      next["Verstorbener Nachname"] = formatForField("Verstorbener Nachname", correction.to);
    } else if (correction.role === "mieter" && correction.namePart === "first") {
      next["Mieter Vorname"] = formatForField("Mieter Vorname", correction.to);
    } else if (correction.role === "mieter" && correction.namePart === "last") {
      next["Mieter Nachname"] = formatForField("Mieter Nachname", correction.to);
    } else if (correction.field) {
      next[correction.field] = formatForField(correction.field, correction.to);
    }
    return next;
  }

  for (const field of targets) {
    const current = (next[field] ?? "").trim();
    if (correction.from && current && !valuesMatch(current, correction.from)) {
      // Feld passt nicht zum alten Wert – überspringen, außer explizites Zielfeld
      if (!correction.field) continue;
    }
    // Einteilige Korrektur auf voller Name: nur den treffenden Teil ersetzen
    if (
      correction.from &&
      (field.endsWith("Vorname") || field.endsWith("Nachname")) &&
      current &&
      fold(current).includes(" ") === false
    ) {
      next[field] = formatForField(field, correction.to.split(/\s+/)[0] ?? correction.to);
      continue;
    }
    if (
      correction.from &&
      valuesMatch(current, correction.from) &&
      current.includes(" ") &&
      !correction.to.includes(" ")
    ) {
      // „nicht Berger sondern Meier“ bei „Anna Berger“ → Nachname-Feld bevorzugen
      if (field.endsWith("Nachname")) {
        next[field] = formatForField(field, correction.to);
        continue;
      }
      if (field.endsWith("Vorname") && valuesMatch(current, correction.from)) {
        // Vorname war exakt der from-Wert
        next[field] = formatForField(field, correction.to);
        continue;
      }
    }
    next[field] = formatForField(field, correction.to);
  }
  return next;
}

/**
 * Wendet alle erkannten Korrekturen auf den Notizstand an (spätere gewinnen).
 */
export function applySpokenCorrections(
  fields: Record<string, string>,
  transcript: string
): Record<string, string> {
  const corrections = extractSpokenCorrections(transcript);
  if (!corrections.length) return fields;

  let next = { ...fields };
  for (const correction of corrections) {
    next = applyOneCorrection(next, correction);
  }
  return next;
}

/** Alias für Pipeline-Stufe. */
export function applyTranscriptCorrections(
  fields: Record<string, string>,
  transcript: string
): Record<string, string> {
  return applySpokenCorrections(fields, transcript);
}
