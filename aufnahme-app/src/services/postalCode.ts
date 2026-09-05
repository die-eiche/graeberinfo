import { parseNoteFields } from "./discoveries";
import { renderNoteMarkdown } from "./noteMerge";
import { UNCERTAIN_MARK } from "./allowedValues";

const OPENPLZ_BASE = "https://openplzapi.org/de";

type StreetHit = {
  name: string;
  postalCode: string;
  locality: string;
};

type LocalityHit = {
  postalCode: string;
  name: string;
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

/** Vergleichsschlüssel für Ortsnamen (Kleinbuchstaben, ohne Diakritika). */
export function foldPlaceName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Bereinigt Ortsangaben aus dem Gespräch
 * („in Eutin“, „Eutin Stadt“, „Stadt Eutin“ …) für OpenPLZ.
 */
export function normalizeLocalityQuery(ort: string): string {
  let s = ort.trim();
  if (!s || s === UNCERTAIN_MARK) return "";
  s = s.replace(/^(in|bei|nahe|im|aus)\s+/iu, "");
  s = s.replace(/\b(stadt|gemeinde|ort)\b/giu, " ");
  s = s.replace(/[(),]/g, " ");
  return s.replace(/\s+/g, " ").trim();
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

function streetNameCandidates(streetNorm: string): string[] {
  const candidates = [streetNorm];
  if (streetNorm.endsWith(".")) {
    candidates.push(streetNorm.slice(0, -1));
  }
  return candidates;
}

async function fetchStreets(name: string, localityPattern: string): Promise<StreetHit[]> {
  const params = new URLSearchParams({
    name,
    locality: localityPattern,
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

async function fetchLocalities(name: string): Promise<LocalityHit[]> {
  const params = new URLSearchParams({
    name,
    page: "1",
    pageSize: "50",
  });
  const response = await fetch(`${OPENPLZ_BASE}/Localities?${params.toString()}`, {
    headers: { Accept: "text/json" },
  });
  if (!response.ok) {
    return [];
  }
  const data = (await response.json()) as LocalityHit[];
  return Array.isArray(data) ? data : [];
}

/**
 * Findet kanonische Ortsnamen in OpenPLZ, wenn die gesprochene Form
 * nicht 1:1 als locality matcht.
 */
export async function resolveLocalityNamesFromOpenPlz(ort: string): Promise<string[]> {
  const query = normalizeLocalityQuery(ort);
  if (!query) return [];

  const hits = await fetchLocalities(query);
  if (hits.length === 0) return [];

  const foldedQuery = foldPlaceName(query);
  const ranked: Array<{ name: string; score: number }> = [];

  for (const hit of hits) {
    const foldedName = foldPlaceName(hit.name);
    let score = 0;
    if (foldedName === foldedQuery) score = 100;
    else if (foldedName.startsWith(foldedQuery) || foldedQuery.startsWith(foldedName)) score = 80;
    else if (foldedName.includes(foldedQuery) || foldedQuery.includes(foldedName)) score = 50;
    else continue;
    ranked.push({ name: hit.name, score });
  }

  ranked.sort((a, b) => b.score - a.score);
  const best = ranked[0]?.score ?? 0;
  if (best < 50) return [];

  const names: string[] = [];
  for (const row of ranked) {
    if (row.score < best) break;
    if (!names.includes(row.name)) names.push(row.name);
  }
  return names;
}

function uniquePostalFromHits(
  hits: StreetHit[],
  preferredLocality?: string
): { postalCode: string; locality: string } | null {
  if (hits.length === 0) return null;
  const plzSet = new Set(hits.map((h) => h.postalCode).filter(Boolean));
  if (plzSet.size !== 1) return null;

  const postalCode = [...plzSet][0];
  const preferredFold = preferredLocality ? foldPlaceName(preferredLocality) : "";
  const localityName =
    (preferredFold
      ? hits.find((h) => foldPlaceName(h.locality) === preferredFold)?.locality
      : undefined) ||
    hits[0].locality ||
    preferredLocality ||
    "";

  return { postalCode, locality: localityName };
}

async function lookupStreetsForLocality(
  streetNorm: string,
  locality: string
): Promise<StreetHit[]> {
  const exact = `^${escapeRegexLiteral(locality)}$`;
  for (const name of streetNameCandidates(streetNorm)) {
    const hits = await fetchStreets(name, exact);
    if (hits.length > 0) return hits;
  }
  return [];
}

/**
 * Ermittelt die eindeutige PLZ zu Straße + Ort über OpenPLZ.
 * Nutzt bei unscharfem Ortsnamen zuerst das OpenPLZ-Ortsverzeichnis.
 * Mehrere Treffer mit unterschiedlicher PLZ → null (nicht raten).
 */
export async function lookupPostalCode(
  street: string,
  locality: string
): Promise<{ postalCode: string; locality: string } | null> {
  const ortRaw = locality.trim();
  const streetNorm = normalizeStreetForLookup(street);
  if (!ortRaw || !streetNorm) return null;

  const ortQuery = normalizeLocalityQuery(ortRaw) || ortRaw;

  // 1) Direkter Versuch mit dem genannten Ort
  let hits = await lookupStreetsForLocality(streetNorm, ortQuery);
  let resolved = uniquePostalFromHits(hits, ortQuery);
  if (resolved) return resolved;

  // 2) Ort über OpenPLZ-Localities auflösen (Schreibweise / Stadtzusatz / ASR)
  const localityNames = await resolveLocalityNamesFromOpenPlz(ortQuery);
  for (const name of localityNames) {
    if (foldPlaceName(name) === foldPlaceName(ortQuery) && hits.length > 0) {
      continue;
    }
    hits = await lookupStreetsForLocality(streetNorm, name);
    resolved = uniquePostalFromHits(hits, name);
    if (resolved) return resolved;
  }

  // 3) Straße mit weichem Ortsfilter, dann auf OpenPLZ-Ort eingrenzen
  const localityHints =
    localityNames.length > 0 ? localityNames : [ortQuery];
  for (const name of streetNameCandidates(streetNorm)) {
    for (const hint of localityHints) {
      const loose = await fetchStreets(name, hint);
      if (loose.length === 0) continue;
      const foldedHints = new Set(
        localityHints.map((h) => foldPlaceName(h)).concat(foldPlaceName(ortQuery))
      );
      const filtered = loose.filter((h) => foldedHints.has(foldPlaceName(h.locality)));
      resolved = uniquePostalFromHits(filtered.length > 0 ? filtered : loose, hint);
      if (resolved) return resolved;
    }
  }

  return null;
}

/**
 * Setzt/korrigiert „PLZ Ort“, wenn Straße + Ort im Feld stehen.
 * Vorhandene, aber falsche PLZ wird anhand OpenPLZ überschrieben.
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
  // PLZ stimmt, Ort-Schreibweise aus Verzeichnis übernehmen
  if (plzOrt.trim() !== next) {
    return next;
  }
  return null;
}

const PLZ_ORT_PAIRS = [
  { street: "Mieter Straße", plzOrt: "Mieter PLZ Ort" },
  { street: "Verstorbener Straße", plzOrt: "Verstorbener PLZ Ort" },
] as const;

/**
 * Ergänzt/korrigiert PLZ in der Notiz anhand Straße + bereits gesetztem Ort.
 * OpenPLZ ist maßgeblich für Ortserkennung und PLZ-Korrektur.
 */
export async function enrichNotePostalCodes(noteMarkdown: string): Promise<string> {
  const fields = parseNoteFields(noteMarkdown);
  let changed = false;

  for (const pair of PLZ_ORT_PAIRS) {
    const street = (fields[pair.street] ?? "").trim();
    const plzOrt = (fields[pair.plzOrt] ?? "").trim();
    // Straße vorhanden und Ort (ggf. mit falscher PLZ) im Feld → OpenPLZ befragen
    if (!street || street === UNCERTAIN_MARK) continue;
    if (!plzOrt || plzOrt === UNCERTAIN_MARK) continue;
    const { ort } = parsePlzOrt(plzOrt);
    if (!ort) continue;

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
