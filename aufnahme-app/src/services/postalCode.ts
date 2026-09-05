import { parseNoteFields } from "./discoveries";
import { renderNoteMarkdown } from "./noteMerge";
import { UNCERTAIN_MARK } from "./allowedValues";

const OPENPLZ_BASE = "https://openplzapi.org/de";

type StreetHit = {
  name: string;
  postalCode: string;
  locality: string;
};

/** Zerlegt „12345 Ort“ bzw. nur Ort. */
export function parsePlzOrt(value: string): { plz: string; ort: string } {
  const trimmed = value.trim();
  if (!trimmed || trimmed === UNCERTAIN_MARK) {
    return { plz: "", ort: "" };
  }
  const match = /^(\d{5})\s+(.+)$/.exec(trimmed);
  if (match) {
    return { plz: match[1], ort: match[2].trim() };
  }
  if (/^\d{5}$/.test(trimmed)) {
    return { plz: trimmed, ort: "" };
  }
  return { plz: "", ort: trimmed };
}

/** Hausnummer entfernen und „Straße“ → „str.“ für OpenPLZ. */
export function normalizeStreetForLookup(street: string): string {
  let s = street.trim();
  if (!s || s === UNCERTAIN_MARK) return "";
  // typische Hausnummer am Ende: 12, 12a, 12-14
  s = s.replace(/\s+\d+[a-zA-Z]?(?:\s*[-–]\s*\d+[a-zA-Z]?)?$/u, "");
  s = s.replace(/stra(?:ss|ß)e\b/giu, "str.");
  s = s.replace(/\bstr(?!\.)\b/giu, "str.");
  return s.trim().replace(/\s+/g, " ");
}

function escapeRegexLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function fetchStreets(name: string, locality: string): Promise<StreetHit[]> {
  const params = new URLSearchParams({
    name,
    locality: `^${escapeRegexLiteral(locality)}$`,
    page: "1",
    pageSize: "50",
  });
  const response = await fetch(`${OPENPLZ_BASE}/Streets?${params.toString()}`, {
    headers: { Accept: "text/json" },
  });
  if (!response.ok) {
    return [];
  }
  const data = (await response.json()) as StreetHit[];
  return Array.isArray(data) ? data : [];
}

/**
 * Ermittelt die eindeutige PLZ zu Straße + Ort über OpenPLZ.
 * Mehrere Treffer mit unterschiedlicher PLZ → null (nicht raten).
 */
export async function lookupPostalCode(
  street: string,
  locality: string
): Promise<{ postalCode: string; locality: string } | null> {
  const ort = locality.trim();
  const streetNorm = normalizeStreetForLookup(street);
  if (!ort || !streetNorm) return null;

  const candidates = [streetNorm];
  // zusätzlich Variante ohne Punkt: "Bahnhofstr" falls "Bahnhofstr." nichts liefert
  if (streetNorm.endsWith(".")) {
    candidates.push(streetNorm.slice(0, -1));
  }

  let hits: StreetHit[] = [];
  for (const name of candidates) {
    hits = await fetchStreets(name, ort);
    if (hits.length > 0) break;
  }

  if (hits.length === 0) return null;

  const plzSet = new Set(hits.map((h) => h.postalCode).filter(Boolean));
  if (plzSet.size !== 1) return null;

  const postalCode = [...plzSet][0];
  const localityName =
    hits.find((h) => h.locality.toLowerCase() === ort.toLowerCase())?.locality ||
    hits[0].locality ||
    ort;

  return { postalCode, locality: localityName };
}

/**
 * Setzt/korrigiert „PLZ Ort“, wenn Straße + Ort bekannt und PLZ eindeutig.
 */
export async function resolvePlzOrtValue(
  street: string,
  plzOrt: string
): Promise<string | null> {
  const { plz, ort } = parsePlzOrt(plzOrt);
  if (!ort || !street.trim() || street.trim() === UNCERTAIN_MARK) {
    return null;
  }

  const found = await lookupPostalCode(street, ort);
  if (!found) return null;

  const next = `${found.postalCode} ${found.locality}`;
  // bereits korrekt
  if (plz === found.postalCode && plzOrt.trim() === next) {
    return null;
  }
  // PLZ fehlt oder weicht ab → korrigieren
  if (!plz || plz !== found.postalCode) {
    return next;
  }
  // PLZ stimmt, Ort-Schreibweise aus Verzeichnis übernehmen falls sinnvoll
  if (plzOrt.trim() !== next) {
    return next;
  }
  return null;
}

const PLZ_ORT_PAIRS = [
  { street: "Mieter Straße", plzOrt: "Mieter PLZ Ort" },
  { street: "Verstorbener Straße", plzOrt: "Verstorbener PLZ Ort" },
] as const;

/** Ergänzt/korrigiert PLZ in der Notiz anhand Straße + Ort. */
export async function enrichNotePostalCodes(noteMarkdown: string): Promise<string> {
  const fields = parseNoteFields(noteMarkdown);
  let changed = false;

  for (const pair of PLZ_ORT_PAIRS) {
    const street = (fields[pair.street] ?? "").trim();
    const plzOrt = (fields[pair.plzOrt] ?? "").trim();
    if (!street || !plzOrt || plzOrt === UNCERTAIN_MARK) continue;

    try {
      const resolved = await resolvePlzOrtValue(street, plzOrt);
      if (resolved) {
        fields[pair.plzOrt] = resolved;
        changed = true;
      }
    } catch {
      // Netzwerkfehler: Stand unverändert lassen
    }
  }

  if (!changed) return noteMarkdown;
  return renderNoteMarkdown(fields);
}
