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
const TENANT_FIRST = "Mieter Vorname";
const TENANT_LAST = "Mieter Nachname";
const DECEASED_FIRST = "Verstorbener Vorname";
const DECEASED_LAST = "Verstorbener Nachname";

const NAME_TOKEN =
  "([A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß\\-]{1,}(?:\\s+[A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß\\-]{1,})?)";

function normalizePersonName(value: string): string {
  const cleaned = value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.,;:!?]+$/g, "");
  if (!cleaned) return "";
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

const NON_PERSON_NAME_WORDS = new Set(
  [
    "vorgestern",
    "gestern",
    "heute",
    "morgen",
    "uebermorgen",
    "ubermorgen",
    "verstorben",
    "gestorben",
    "verstorbene",
    "verstorbener",
    "verstorbenes",
    "todestag",
    "bestatter",
    "bestatterin",
    "mieter",
    "mieterin",
    "grab",
    "urne",
  ].map((w) => fold(w))
);

function looksLikeNonPersonName(value: string): boolean {
  const parts = fold(value).split(/\s+/).filter(Boolean);
  if (!parts.length) return true;
  if (NON_PERSON_NAME_WORDS.has(parts.join(" "))) return true;
  return parts.every((p) => NON_PERSON_NAME_WORDS.has(p));
}

function splitPersonName(full: string): { first: string; last: string } {
  const parts = normalizePersonName(full).split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

function samePerson(a: string, b: string): boolean {
  const fa = fold(a);
  const fb = fold(b);
  if (!fa || !fb) return false;
  if (fa === fb) return true;
  // Nachname allein vs. voller Name
  const aParts = fa.split(/\s+/);
  const bParts = fb.split(/\s+/);
  return aParts[aParts.length - 1] === bParts[bParts.length - 1] && aParts.length !== bParts.length;
}

/**
 * Extrahiert Bestatternamen aus dem Transkript
 * („Bestatter heißt Söhnlein“, „Bestatter Söhnlein“, …).
 */
export function extractUndertakerFromTranscript(transcript: string): string | null {
  const text = transcript.replace(/\s+/g, " ").trim();
  if (!text) return null;

  const patterns = [
    new RegExp(`\\bBestatter(?:in)?\\s+(?:heißt|ist|war|namens|name(?:ns)?)\\s+${NAME_TOKEN}`, "i"),
    new RegExp(`\\bBestatter(?:in)?\\s+${NAME_TOKEN}`, "i"),
    new RegExp(`\\b(?:beim|von|über)\\s+(?:den|dem|die)?\\s*Bestatter(?:in)?\\s+${NAME_TOKEN}`, "i"),
  ];

  const stop = /^(der|die|das|ein|eine|und|mit|für|heißt|ist|war|namens|name)$/i;

  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (!match?.[1]) continue;
    const name = normalizePersonName(match[1]);
    if (!name || looksLikeRelationship(name) || looksLikeNonPersonName(name) || stop.test(name)) continue;
    return name;
  }
  return null;
}

/** Explizite Mieter-Angabe im Transkript. */
export function extractTenantNameFromTranscript(transcript: string): string | null {
  const text = transcript.replace(/\s+/g, " ").trim();
  if (!text) return null;
  const patterns = [
    new RegExp(
      `\\b(?:der\\s+)?Mieter(?:in)?\\s+(?:ist|wird|heißt|namens|name(?:ns)?)\\s+${NAME_TOKEN}`,
      "i"
    ),
    new RegExp(
      `\\b(?:den\\s+)?Vertrag\\s+(?:macht|macht\\s+der|übernimmt)\\s+${NAME_TOKEN}`,
      "i"
    ),
    new RegExp(`\\bGrabmieter(?:in)?\\s+(?:ist|wird|heißt)\\s+${NAME_TOKEN}`, "i"),
    new RegExp(
      `\\b(?:mein(?:e)?\\s+)?(?:Vater|Mutter|Sohn|Tochter)\\s+(?:ist|wird)\\s+(?:der\\s+)?Mieter(?:in)?[^.!?]{0,20}${NAME_TOKEN}?`,
      "i"
    ),
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    // Spezialfall: „Mein Vater ist der Mieter Thomas Berger“
    if (pattern.source.includes("Vater|Mutter")) {
      const explicit = new RegExp(
        `\\b(?:mein(?:e)?\\s+)?(?:Vater|Mutter)\\s+ist\\s+(?:der\\s+)?Mieter(?:in)?\\s+${NAME_TOKEN}`,
        "i"
      ).exec(text);
      if (explicit?.[1]) {
        const name = normalizePersonName(explicit[1]);
        if (name && !looksLikeRelationship(name) && !looksLikeNonPersonName(name)) return name;
      }
      continue;
    }
    if (!match?.[1]) continue;
    const name = normalizePersonName(match[1]);
    if (!name || looksLikeRelationship(name) || looksLikeNonPersonName(name)) continue;
    return name;
  }
  return null;
}

/** Verstorbenennamen aus klaren Transkript-Formeln (keine Datums-/Statuswörter). */
export function extractDeceasedNameFromTranscript(transcript: string): string | null {
  const text = transcript.replace(/\s+/g, " ").trim();
  if (!text) return null;

  const patterns = [
    // „Verstorbene heißt Anna Berger“ – nicht „ist vorgestern verstorben“
    new RegExp(
      `\\bVerstorbene[rn]?\\s+(?:heißt|namens|name(?:ns)?)\\s+${NAME_TOKEN}`,
      "i"
    ),
    new RegExp(
      `\\b(?:die|der)\\s+Verstorbene[rn]?\\s+(?:heißt|namens|name(?:ns)?)\\s+${NAME_TOKEN}`,
      "i"
    ),
    new RegExp(
      `\\b(?:mein(?:e)?|unser(?:e)?)\\s+(?:Vater|Mutter|Mann|Frau|Sohn|Tochter|Bruder|Schwester)\\s+${NAME_TOKEN}\\s+(?:ist\\s+)?(?:gestorben|verstorben)\\b`,
      "i"
    ),
    new RegExp(
      `\\b(?:mein(?:e)?|unser(?:e)?)\\s+(?:Vater|Mutter|Mann|Frau|Sohn|Tochter|Bruder|Schwester)\\s+(?:ist\\s+)?(?:gestorben|verstorben)\\b[^.!?]{0,40}?\\b(?:heißt|namens)\\s+${NAME_TOKEN}`,
      "i"
    ),
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (!match) continue;
    const groups = match.slice(1).filter(Boolean);
    const nameRaw = groups[groups.length - 1];
    if (!nameRaw) continue;
    const name = normalizePersonName(nameRaw);
    if (!name || looksLikeRelationship(name) || looksLikeNonPersonName(name)) continue;
    if (/^(ist|war|wurde|der|die|das)$/i.test(name)) continue;
    return name;
  }
  return null;
}


function applySplitName(
  next: Record<string, string>,
  firstKey: string,
  lastKey: string,
  fullName: string,
  overwriteEmptyOnly: boolean
): void {
  const { first, last } = splitPersonName(fullName);
  if (!first) return;
  const curFirst = (next[firstKey] ?? "").trim();
  const curLast = (next[lastKey] ?? "").trim();
  if (overwriteEmptyOnly) {
    if (!curFirst || curFirst === UNCERTAIN_MARK) next[firstKey] = first;
    if (last && (!curLast || curLast === UNCERTAIN_MARK)) next[lastKey] = last;
    return;
  }
  next[firstKey] = first;
  if (last) next[lastKey] = last;
  else if (!curLast || curLast === UNCERTAIN_MARK) {
    // einteiliger Name → Nachname nicht erzwingen
  }
}

/**
 * Korrigiert typische Fehlzuordnungen von Namen/Rollen:
 * - Bestatter ≠ Verwandtschaft ≠ Mieter ≠ Verstorbener
 * - Explizite Transkript-Rollen überschreiben falsche Feldzuordnung
 */
export function rescueMisplacedFields(
  fields: Record<string, string>,
  transcript: string
): Record<string, string> {
  const next = { ...fields };
  const text = transcript.replace(/\s+/g, " ").trim();

  const undertaker = extractUndertakerFromTranscript(text);
  const tenant = extractTenantNameFromTranscript(text);
  const deceased = extractDeceasedNameFromTranscript(text);

  const currentUndertaker = (next[UNDERTAKER_KEY] ?? "").trim();
  const currentRelation = (next[RELATION_KEY] ?? "").trim();
  const tenantFirst = (next[TENANT_FIRST] ?? "").trim();
  const tenantLast = (next[TENANT_LAST] ?? "").trim();
  const tenantFull = [tenantFirst, tenantLast].filter(Boolean).join(" ");
  const deceasedFirst = (next[DECEASED_FIRST] ?? "").trim();
  const deceasedLast = (next[DECEASED_LAST] ?? "").trim();
  const deceasedFull = [deceasedFirst, deceasedLast].filter(Boolean).join(" ");

  if (undertaker) {
    if (!currentUndertaker || currentUndertaker === UNCERTAIN_MARK) {
      next[UNDERTAKER_KEY] = undertaker;
    }
    if (
      currentRelation &&
      !looksLikeRelationship(currentRelation) &&
      fold(currentRelation) === fold(undertaker)
    ) {
      delete next[RELATION_KEY];
    }
    // Bestatter-Name darf nicht als Verstorbener/Mieter stehen, wenn Rolle klar ist
    if (deceasedFull && samePerson(deceasedFull, undertaker) && undertaker) {
      // nur löschen wenn Transkript den Bestatter explizit nennt und Verstorbener anders belegt ist
      if (deceased && !samePerson(deceased, undertaker)) {
        delete next[DECEASED_FIRST];
        delete next[DECEASED_LAST];
      }
    }
    if (tenantFull && samePerson(tenantFull, undertaker) && tenant && !samePerson(tenant, undertaker)) {
      delete next[TENANT_FIRST];
      delete next[TENANT_LAST];
    }
    if (!tenant && tenantFull && samePerson(tenantFull, undertaker)) {
      delete next[TENANT_FIRST];
      delete next[TENANT_LAST];
    }
    if (!deceased && deceasedFull && samePerson(deceasedFull, undertaker)) {
      delete next[DECEASED_FIRST];
      delete next[DECEASED_LAST];
    }
  }

  // Fallback: Transkript erwähnt Bestatter, Name sitzt nur in Verwandtschaft
  const undertakerNow = (next[UNDERTAKER_KEY] ?? "").trim();
  const relationNow = (next[RELATION_KEY] ?? "").trim();
  if (
    /\bbestatter/i.test(text) &&
    relationNow &&
    !looksLikeRelationship(relationNow) &&
    (!undertakerNow || undertakerNow === UNCERTAIN_MARK)
  ) {
    next[UNDERTAKER_KEY] = normalizePersonName(relationNow);
    delete next[RELATION_KEY];
  }

  if (deceased) {
    applySplitName(next, DECEASED_FIRST, DECEASED_LAST, deceased, false);
    // Verstorbenennamen fälschlich im Mieter → entfernen, wenn kein expliziter Mieter gleiches heißt
    const tFirst = (next[TENANT_FIRST] ?? "").trim();
    const tLast = (next[TENANT_LAST] ?? "").trim();
    const tFull = [tFirst, tLast].filter(Boolean).join(" ");
    if (tFull && samePerson(tFull, deceased) && (!tenant || !samePerson(tenant, deceased))) {
      delete next[TENANT_FIRST];
      delete next[TENANT_LAST];
    }
  }

  if (tenant) {
    applySplitName(next, TENANT_FIRST, TENANT_LAST, tenant, false);
  }

  // Beziehungswort im Verwandtschaftsfeld erzwingen: reine Namen dort entfernen/verschieben
  const relation = (next[RELATION_KEY] ?? "").trim();
  if (relation && !looksLikeRelationship(relation)) {
    if (undertaker && fold(relation) === fold(undertaker)) {
      delete next[RELATION_KEY];
    } else if (/\bbestatter/i.test(text)) {
      if (!(next[UNDERTAKER_KEY] ?? "").trim() || (next[UNDERTAKER_KEY] ?? "") === UNCERTAIN_MARK) {
        next[UNDERTAKER_KEY] = normalizePersonName(relation);
      }
      delete next[RELATION_KEY];
    }
  }

  return next;
}
