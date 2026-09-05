import { UNCERTAIN_MARK } from "./allowedValues";

const RELATIONSHIP_WORDS = new Set(
  [
    "sohn",
    "tochter",
    "ehefrau",
    "ehemann",
    "gattin",
    "gatte",
    "witwe",
    "witwer",
    "mutter",
    "vater",
    "bruder",
    "schwester",
    "enkel",
    "enkelin",
    "neffe",
    "nichte",
    "schwager",
    "schwägerin",
    "schwiegertochter",
    "schwiegersohn",
    "schwiegermutter",
    "schwiegervater",
    "lebenspartner",
    "lebenspartnerin",
    "partner",
    "partnerin",
    "freund",
    "freundin",
    "angehöriger",
    "angehörige",
  ].map((w) => w.toLowerCase())
);

const RELATION_KEY = "Mieter Verwandtschaftsverhältnis zum Verstorbenen";
const UNDERTAKER_KEY = "Bestatter";

function normalizePersonName(value: string): string {
  const cleaned = value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.,;:!?]+$/g, "");
  if (!cleaned) return "";
  // ASR liefert oft Kleinbuchstaben → erste Buchstaben groß
  return cleaned
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function fold(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function looksLikeRelationship(value: string): boolean {
  return RELATIONSHIP_WORDS.has(fold(value));
}

/**
 * Extrahiert Bestatternamen aus dem Transkript
 * („Bestatter heißt Söhnlein“, „Bestatter Söhnlein“, …).
 * ASR kann Kleinbuchstaben liefern.
 */
export function extractUndertakerFromTranscript(transcript: string): string | null {
  const text = transcript.replace(/\s+/g, " ").trim();
  if (!text) return null;

  const nameToken = "([A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß\\-]{1,}(?:\\s+[A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß\\-]{1,})?)";
  const patterns = [
    new RegExp(`\\bBestatter(?:in)?\\s+(?:heißt|ist|war|namens|name(?:ns)?)\\s+${nameToken}`, "i"),
    new RegExp(`\\bBestatter(?:in)?\\s+${nameToken}`, "i"),
    new RegExp(`\\b(?:beim|von|über)\\s+(?:den|dem|die)?\\s*Bestatter(?:in)?\\s+${nameToken}`, "i"),
  ];

  const stop = /^(der|die|das|ein|eine|und|mit|für|heißt|ist|war|namens|name)$/i;

  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (!match?.[1]) continue;
    const name = normalizePersonName(match[1]);
    if (!name || looksLikeRelationship(name) || stop.test(name)) continue;
    return name;
  }
  return null;
}

/**
 * Korrigiert typische Fehlzuordnungen:
 * - Bestatter-Name landet fälschlich in Verwandtschaftsverhältnis
 * - Bestatter-Feld bleibt leer, obwohl im Transkript genannt
 */
export function rescueMisplacedFields(
  fields: Record<string, string>,
  transcript: string
): Record<string, string> {
  const next = { ...fields };

  const fromTranscript = extractUndertakerFromTranscript(transcript);
  const currentUndertaker = (next[UNDERTAKER_KEY] ?? "").trim();
  const currentRelation = (next[RELATION_KEY] ?? "").trim();

  if (fromTranscript) {
    if (!currentUndertaker || currentUndertaker === UNCERTAIN_MARK) {
      next[UNDERTAKER_KEY] = fromTranscript;
    }
    // Falsch in Verwandtschaft gelandet (gleicher Name, kein Beziehungswort)
    if (
      currentRelation &&
      !looksLikeRelationship(currentRelation) &&
      fold(currentRelation) === fold(fromTranscript)
    ) {
      delete next[RELATION_KEY];
    }
  }

  // Fallback: Transkript erwähnt Bestatter, Name sitzt nur in Verwandtschaft
  const undertakerNow = (next[UNDERTAKER_KEY] ?? "").trim();
  const relationNow = (next[RELATION_KEY] ?? "").trim();
  if (
    /\bbestatter/i.test(transcript) &&
    relationNow &&
    !looksLikeRelationship(relationNow) &&
    (!undertakerNow || undertakerNow === UNCERTAIN_MARK)
  ) {
    next[UNDERTAKER_KEY] = normalizePersonName(relationNow);
    delete next[RELATION_KEY];
  }

  return next;
}
