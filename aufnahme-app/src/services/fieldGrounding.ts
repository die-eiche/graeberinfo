import { UNCERTAIN_MARK } from "./allowedValues";

const GRAVE_MENTION =
  /\b(grab(?:nummer|stelle|platz)?|grabraum|urnengrab|wahlgrab|reihengrab)\b/i;
const URN_MENTION = /\burne\b/i;

/** Felder, deren Wert im Transkript vorkommen muss (sonst Halluzination). */
const VALUE_MUST_APPEAR_IN_TRANSCRIPT = [
  "Verstorbener Vorname",
  "Verstorbener Nachname",
  "Mieter Vorname",
  "Mieter Nachname",
] as const;

function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function transcriptContainsValue(transcript: string, value: string): boolean {
  const v = fold(value).trim();
  if (v.length < 2) return false;
  const t = fold(transcript);
  const escaped = v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9äöüß])${escaped}([^a-z0-9äöüß]|$)`, "i").test(t);
}

/**
 * Entfernt KI-Halluzinationen:
 * - Grab / Urne (inkl. "?") nur behalten, wenn im Transkript angesprochen
 * - Namen nur behalten, wenn der Wert im Transkript vorkommt
 */
export function clearUngroundedFields(
  fields: Record<string, string>,
  transcript: string
): Record<string, string> {
  const next = { ...fields };
  const text = transcript.replace(/\s+/g, " ").trim();

  const grave = (next["Grab"] ?? "").trim();
  if (grave) {
    const spokenGraveNumber = /\b\d(?:\.\d{2}){3,4}\b/.test(text);
    if (!GRAVE_MENTION.test(text) && !spokenGraveNumber) {
      delete next["Grab"];
    }
  }

  const urn = (next["Urne"] ?? "").trim();
  if (urn && !URN_MENTION.test(text)) {
    delete next["Urne"];
  }

  for (const field of VALUE_MUST_APPEAR_IN_TRANSCRIPT) {
    const value = (next[field] ?? "").trim();
    if (!value || value === UNCERTAIN_MARK) continue;
    if (!text || !transcriptContainsValue(text, value)) {
      delete next[field];
    }
  }

  return next;
}
