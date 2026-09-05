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

/** Vergleichsschlüssel für Orts-/Straßennamen. */
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

/** Trennt Hausnummer vom Straßennamen. */
export function splitStreetAndHouseNumber(street: string): { name: string; house: string } {
  const trimmed = street.trim();
  if (!trimmed || trimmed === UNCERTAIN_MARK) return { name: "", house: "" };
  const match = /^(.*?)(?:\s+(\d+[a-zA-Z]?(?:\s*[-–]\s*\d+[a-zA-Z]?)?))$/u.exec(trimmed);
  if (!match) return { name: trimmed, house: "" };
  return { name: match[1].trim(), house: match[2].trim() };
}

/** Hausnummer entfernen und „Straße“ → „str.“ für OpenPLZ. */
export function normalizeStreetForLookup(street: string): string {
  let s = splitStreetAndHouseNumber(street).name;
  if (!s) return "";
  s = s.replace(/stra(?:ss|ß)e\b/giu, "str.");
  s = s.replace(/\bstr(?!\.)\b/giu, "str.");
  return s.trim().replace(/\s+/g, " ");
}

/**
 * Kern eines Straßennamens ohne Präpositionen/Suffixe
 * („An der Untertrave“ → „untertrave“).
 */
export function streetNameCore(street: string): string {
  let s = foldPlaceName(normalizeStreetForLookup(street));
  if (!s) return "";
  s = s.replace(
    /^(an|am|auf|im|in|bei|zu|zum|zur|unter|ueber|uber|hinter|vor|neben)\s+(der|dem|den|die)?\s*/u,
    ""
  );
  s = s.replace(
    /\b(str|strasse|allee|weg|platz|gasse|ring|damm|ufer|bruecke|brucke|promenade|chaussee)\b/gu,
    " "
  );
  return s.replace(/\s+/g, "");
}

function escapeRegexLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const cur = [i + 1];
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      cur.push(Math.min(prev[j + 1] + 1, cur[j] + 1, prev[j] + cost));
    }
    for (let j = 0; j < prev.length; j++) prev[j] = cur[j];
  }
  return prev[b.length];
}

/** Ähnlichkeit 0..1 zwischen zwei Straßennamen (Kern + Vollstring). */
export function streetSimilarity(a: string, b: string): number {
  const fa = foldPlaceName(a);
  const fb = foldPlaceName(b);
  if (!fa || !fb) return 0;
  if (fa === fb) return 1;

  const ca = streetNameCore(a);
  const cb = streetNameCore(b);
  let best = 0;
  if (ca && cb) {
    const dist = levenshtein(ca, cb);
    best = Math.max(best, 1 - dist / Math.max(ca.length, cb.length));
    if (ca.includes(cb) || cb.includes(ca)) {
      best = Math.max(best, Math.min(ca.length, cb.length) / Math.max(ca.length, cb.length));
    }
  }

  const compactA = fa.replace(/\s+/g, "");
  const compactB = fb.replace(/\s+/g, "");
  const distFull = levenshtein(compactA, compactB);
  best = Math.max(best, 1 - distFull / Math.max(compactA.length, compactB.length));
  return best;
}

/** Typische ASR-Verwechslungen für Suchvarianten. */
export function asrStreetVariants(core: string): string[] {
  const base = core.toLowerCase();
  if (!base) return [];
  const out = new Set<string>([base]);
  const swaps: Array<[string, string]> = [
    ["f", "v"],
    ["v", "f"],
    ["p", "b"],
    ["b", "p"],
    ["d", "t"],
    ["t", "d"],
    ["k", "g"],
    ["g", "k"],
    ["m", "n"],
    ["n", "m"],
    ["ie", "i"],
    ["i", "ie"],
  ];
  for (const [from, to] of swaps) {
    if (!base.includes(from)) continue;
    out.add(base.replace(from, to));
  }
  for (let len = Math.min(8, base.length); len >= 4; len--) {
    out.add(base.slice(0, len));
  }
  return [...out];
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
  if (!response.ok) return [];
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
  if (!response.ok) return [];
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
): { postalCode: string; locality: string; streetName?: string } | null {
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

  const streetNames = [...new Set(hits.map((h) => h.name).filter(Boolean))];
  return {
    postalCode,
    locality: localityName,
    streetName: streetNames.length === 1 ? streetNames[0] : undefined,
  };
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

async function collectStreetHitsForLocality(
  street: string,
  locality: string
): Promise<StreetHit[]> {
  const streetNorm = normalizeStreetForLookup(street);
  if (!streetNorm) return [];
  const exact = `^${escapeRegexLiteral(locality)}$`;
  const byKey = new Map<string, StreetHit>();

  const addHits = (hits: StreetHit[]) => {
    for (const hit of hits) {
      const key = `${hit.name}|${hit.postalCode}|${hit.locality}`;
      if (!byKey.has(key)) byKey.set(key, hit);
    }
  };

  addHits(await lookupStreetsForLocality(streetNorm, locality));

  const core = streetNameCore(streetNorm);
  const queries = new Set<string>([
    ...streetNameCandidates(streetNorm),
    ...asrStreetVariants(core),
  ]);
  for (const token of foldPlaceName(streetNorm).split(" ")) {
    if (token.length >= 4) queries.add(token);
  }

  for (const q of queries) {
    if (!q || q.length < 3) continue;
    addHits(await fetchStreets(q, exact));
  }

  return [...byKey.values()];
}

/**
 * Gleicht einen gesprochenen/ASR-Straßennamen hart gegen OpenPLZ ab.
 * „Untertrafe“ in Lübeck → „An der Untertrave“, sonst null.
 */
export async function resolveStreetFromOpenPlz(
  street: string,
  locality: string
): Promise<{ name: string; postalCode: string; locality: string; score: number } | null> {
  const ortRaw = locality.trim();
  const streetNorm = normalizeStreetForLookup(street);
  if (!ortRaw || !streetNorm) return null;

  const ortQuery = normalizeLocalityQuery(ortRaw) || ortRaw;
  const localityNames = await resolveLocalityNamesFromOpenPlz(ortQuery);
  const localities = localityNames.length > 0 ? localityNames : [ortQuery];

  const scored: Array<{ hit: StreetHit; score: number }> = [];
  for (const loc of localities) {
    const hits = await collectStreetHitsForLocality(streetNorm, loc);
    for (const hit of hits) {
      scored.push({ hit, score: streetSimilarity(streetNorm, hit.name) });
    }
  }

  if (scored.length === 0) return null;
  scored.sort((a, b) => b.score - a.score);

  const best = scored[0];
  const second = scored.find((row) => foldPlaceName(row.hit.name) !== foldPlaceName(best.hit.name));

  if (best.score < 0.82) return null;
  if (second && second.score >= best.score - 0.05 && best.score < 0.97) return null;

  return {
    name: best.hit.name,
    postalCode: best.hit.postalCode,
    locality: best.hit.locality,
    score: best.score,
  };
}

/**
 * ASR-/Tippvarianten für Ortsnamen (z. B. Dunkelstorf → Dunkelsdorf).
 */
export function localitySpellingVariants(ort: string): string[] {
  const base = normalizeLocalityQuery(ort) || ort.trim();
  if (!base) return [];
  const out: string[] = [];
  const add = (value: string) => {
    const next = value.trim();
    if (!next) return;
    if (out.some((x) => foldPlaceName(x) === foldPlaceName(next))) return;
    out.push(next);
  };
  add(base);
  if (/storf$/i.test(base)) add(base.replace(/storf$/i, "sdorf"));
  if (/sdorf$/i.test(base)) add(base.replace(/sdorf$/i, "storf"));
  if (/stedt$/i.test(base)) add(base.replace(/stedt$/i, "städt"));
  if (/städt$/i.test(base) || /staedt$/i.test(base)) {
    add(base.replace(/städt$/i, "stedt").replace(/staedt$/i, "stedt"));
  }
  return out;
}

type NominatimHit = {
  address?: {
    postcode?: string;
    village?: string;
    hamlet?: string;
    suburb?: string;
    town?: string;
    city?: string;
    municipality?: string;
    city_district?: string;
    road?: string;
  };
};

function nominatimPlaceName(address: NonNullable<NominatimHit["address"]>, fallback: string): string {
  return (
    address.village ||
    address.hamlet ||
    address.suburb ||
    address.city_district ||
    address.town ||
    address.city ||
    address.municipality ||
    fallback
  );
}

function nominatimMatchesLocality(
  address: NonNullable<NominatimHit["address"]>,
  localityVariants: string[]
): boolean {
  const hay = foldPlaceName(
    [
      address.village,
      address.hamlet,
      address.suburb,
      address.city_district,
      address.town,
      address.city,
      address.municipality,
    ]
      .filter(Boolean)
      .join(" ")
  );
  if (!hay) return false;
  return localityVariants.some((variant) => {
    const needle = foldPlaceName(variant);
    return Boolean(needle) && (hay === needle || hay.includes(needle) || needle.includes(hay));
  });
}

/**
 * Fallback für Ortsteile, die OpenPLZ nicht als Locality kennt
 * (z. B. Dunkelsdorf → PLZ über Straße + Ort via Nominatim).
 */
export async function lookupPostalCodeViaNominatim(
  street: string,
  locality: string
): Promise<{ postalCode: string; locality: string; streetName?: string } | null> {
  const { name, house } = splitStreetAndHouseNumber(street);
  if (!name) return null;
  const variants = localitySpellingVariants(locality);
  if (!variants.length) return null;

  const streetPart = house ? `${name} ${house}` : name;
  const accepted: Array<{ postalCode: string; locality: string; streetName?: string }> = [];

  for (const loc of variants) {
    const params = new URLSearchParams({
      q: `${streetPart}, ${loc}, Deutschland`,
      format: "json",
      addressdetails: "1",
      limit: "5",
      countrycodes: "de",
    });
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "GraeberinfoAufnahme/1.0 (https://github.com/die-eiche/graeberinfo)",
      },
    });
    if (!response.ok) continue;
    const data = (await response.json()) as NominatimHit[];
    if (!Array.isArray(data) || data.length === 0) continue;

    for (const hit of data) {
      const address = hit.address;
      const postcode = address?.postcode?.trim() ?? "";
      if (!/^\d{5}$/.test(postcode) || !address) continue;
      if (!nominatimMatchesLocality(address, variants)) continue;
      accepted.push({
        postalCode: postcode,
        locality: nominatimPlaceName(address, loc),
        streetName: address.road?.trim() || undefined,
      });
    }
    if (accepted.length) break;
  }

  if (!accepted.length) return null;
  const plzSet = new Set(accepted.map((row) => row.postalCode));
  if (plzSet.size !== 1) return null;
  return accepted[0];
}

/**
 * Ermittelt die eindeutige PLZ zu Straße + Ort.
 * 1) OpenPLZ (Gemeinde/Stadt)
 * 2) Orts-Tippvarianten in OpenPLZ
 * 3) Nominatim-Fallback für Ortsteile (Straße + Ort reichen)
 */
export async function lookupPostalCode(
  street: string,
  locality: string
): Promise<{ postalCode: string; locality: string; streetName?: string } | null> {
  const ortRaw = locality.trim();
  const streetNorm = normalizeStreetForLookup(street);
  if (!ortRaw || !streetNorm) return null;

  const variants = localitySpellingVariants(ortRaw);
  for (const variant of variants) {
    const resolved = await resolveStreetFromOpenPlz(street, variant);
    if (resolved) {
      return {
        postalCode: resolved.postalCode,
        locality: resolved.locality,
        streetName: resolved.name,
      };
    }

    let hits = await lookupStreetsForLocality(streetNorm, variant);
    let exact = uniquePostalFromHits(hits, variant);
    if (exact) return exact;

    const localityNames = await resolveLocalityNamesFromOpenPlz(variant);
    for (const name of localityNames) {
      hits = await lookupStreetsForLocality(streetNorm, name);
      exact = uniquePostalFromHits(hits, name);
      if (exact) return exact;
    }
  }

  return lookupPostalCodeViaNominatim(street, ortRaw);
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
  if (plz === found.postalCode && plzOrt.trim() === next) return null;
  if (!plz || plz !== found.postalCode) return next;
  if (plzOrt.trim() !== next) return next;
  return null;
}

const PLZ_ORT_PAIRS = [
  { street: "Mieter Straße", plzOrt: "Mieter PLZ Ort" },
  { street: "Verstorbener Straße", plzOrt: "Verstorbener PLZ Ort" },
] as const;

/**
 * Ergänzt/korrigiert Straße + PLZ in der Notiz anhand OpenPLZ.
 * ASR-Straßennamen (z. B. „Untertrafe“) werden auf den Listen-Namen
 * (z. B. „An der Untertrave“) korrigiert, wenn Ort bekannt und Treffer eindeutig.
 */
export async function enrichNotePostalCodes(noteMarkdown: string): Promise<string> {
  const fields = parseNoteFields(noteMarkdown);
  let changed = false;

  for (const pair of PLZ_ORT_PAIRS) {
    const street = (fields[pair.street] ?? "").trim();
    const plzOrt = (fields[pair.plzOrt] ?? "").trim();
    if (!street || street === UNCERTAIN_MARK) continue;
    if (!plzOrt || plzOrt === UNCERTAIN_MARK) continue;
    const { ort } = parsePlzOrt(plzOrt);
    if (!ort) continue;

    try {
      const streetResolved = await resolveStreetFromOpenPlz(street, ort);
      if (streetResolved) {
        const { house } = splitStreetAndHouseNumber(street);
        const canonical = house ? `${streetResolved.name} ${house}` : streetResolved.name;
        if (foldPlaceName(canonical) !== foldPlaceName(street)) {
          fields[pair.street] = canonical;
          changed = true;
        }
        const nextPlzOrt = `${streetResolved.postalCode} ${streetResolved.locality}`;
        if ((fields[pair.plzOrt] ?? "").trim() !== nextPlzOrt) {
          fields[pair.plzOrt] = nextPlzOrt;
          changed = true;
        }
        continue;
      }

      // Ortsteile / ASR-Ort: Straße + Ort reichen (OpenPLZ-Varianten + Nominatim)
      const found = await lookupPostalCode(street, ort);
      if (!found) continue;
      const nextPlzOrt = `${found.postalCode} ${found.locality}`;
      if ((fields[pair.plzOrt] ?? "").trim() !== nextPlzOrt) {
        fields[pair.plzOrt] = nextPlzOrt;
        changed = true;
      }
      if (found.streetName) {
        const { house } = splitStreetAndHouseNumber(street);
        const canonical = house ? `${found.streetName} ${house}` : found.streetName;
        if (foldPlaceName(canonical) !== foldPlaceName(street)) {
          fields[pair.street] = canonical;
          changed = true;
        }
      }
    } catch {
      // Netzwerkfehler: Stand unverändert lassen
    }
  }

  if (!changed) return noteMarkdown;
  return renderNoteMarkdown(fields);
}
