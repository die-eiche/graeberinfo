/**
 * Normalisiert E-Mail-Adressen aus ASR/Extrakt/Tippfehlern.
 * Typische Fehler:
 * - „at“/„ät“ statt @
 * - @ als Punkt (Michael.angern.de statt Michael@angern.de)
 * - TLD als Extra-Wort („Angern DE“ → angern.de)
 */

const EMAIL_PROVIDERS = [
  "gmail.com",
  "googlemail.com",
  "gmx.de",
  "gmx.net",
  "gmx.at",
  "web.de",
  "t-online.de",
  "outlook.com",
  "outlook.de",
  "hotmail.com",
  "hotmail.de",
  "icloud.com",
  "me.com",
  "mac.com",
  "yahoo.de",
  "yahoo.com",
  "freenet.de",
  "arcor.de",
  "posteo.de",
  "mailbox.org",
  "proton.me",
  "protonmail.com",
  "online.de",
  "aol.com",
  "live.de",
  "live.com",
  "mail.de",
] as const;

const EMAIL_FIELDS = ["Mieter E-Mail"] as const;

const COMMON_TLDS = new Set([
  "de",
  "com",
  "net",
  "org",
  "at",
  "ch",
  "eu",
  "info",
  "biz",
  "io",
  "me",
  "online",
]);

function isPlausibleLabel(label: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,61}$/i.test(label);
}

function isPlausibleTld(tld: string): boolean {
  const t = tld.toLowerCase();
  return COMMON_TLDS.has(t) || /^[a-z]{2,24}$/i.test(t);
}

/**
 * Stellt @ wieder her und bereinigt getippte/gesprochene E-Mail-Formen.
 * Beispiele:
 * - Michael@Angern DE → michael@angern.de
 * - Michael. angern.de → michael@angern.de
 * - max.mustermann.gmail.com → max.mustermann@gmail.com
 * - info at web.de → info@web.de
 */
export function normalizeEmailValue(raw: string): string {
  let value = raw.trim().replace(/\s+/g, " ");
  if (!value) return value;

  // 1) Gesprochenes „at“/„ät“ zuerst zu @ – sonst frisst die TLD-Regel „Michael at …“
  value = value
    .replace(/\s*(?:klammeraffe|at-zeichen|atzeichen)\s*/gi, "@")
    .replace(/\s+(?:at|ät|aet)\s+/gi, "@")
    .replace(/\s+punkt\s+/gi, ".")
    .replace(/\s+minus\s+/gi, "-")
    .replace(/\s+unterstrich\s+/gi, "_");

  // 2) TLD als separates Wort: „Angern DE“ → angern.de (ohne „at“, sonst Konflikt)
  value = value.replace(
    /\b([A-Za-z0-9][A-Za-z0-9-]{0,61})\s+(de|com|net|org|ch|eu|info|biz|io|me)\b/gi,
    (_m, domain: string, tld: string) => `${domain}.${tld.toLowerCase()}`
  );
  // Österreich: „firma AT“ nur direkt nach @
  value = value.replace(
    /(@[A-Za-z0-9][A-Za-z0-9-]{0,61})\s+at\b/gi,
    (_m, localAtDomain: string) => `${localAtDomain}.at`
  );

  // Leerzeichen um @ und Punkte (Michael. angern.de)
  value = value.replace(/\s*@\s*/g, "@").replace(/\s*\.\s*/g, ".");
  value = value.replace(/\s+/g, "");

  if (!value) return value;

  // bereits mit @: Domain säubern (Michael@Angern.de / Michael@AngernDE)
  if (value.includes("@")) {
    const [local, ...rest] = value.split("@");
    let domain = rest.join("").replace(/@/g, "");
    if (!domain.includes(".")) {
      for (const tld of COMMON_TLDS) {
        const match = new RegExp(`^([a-z0-9][a-z0-9-]{1,60})${tld}$`, "i").exec(domain);
        if (match?.[1]) {
          domain = `${match[1]}.${tld}`;
          break;
        }
      }
    }
    if (!local || !domain) return value.toLowerCase();
    return `${local}@${domain}`.toLowerCase().replace(/\.{2,}/g, ".");
  }

  const lower = value.toLowerCase();

  // bekannte Provider (auch mit Punkten im Local-Part)
  for (const provider of EMAIL_PROVIDERS) {
    const suffix = `.${provider}`;
    if (lower.endsWith(suffix)) {
      const local = value.slice(0, value.length - suffix.length);
      if (local.length >= 1) return `${local}@${provider}`.toLowerCase();
    }
  }

  const parts = value.split(".").filter(Boolean);

  // name.firma.de → name@firma.de  (genau der Fall Michael.angern.de)
  if (parts.length === 3) {
    const [local, domain, tld] = parts;
    if (isPlausibleLabel(local) && isPlausibleLabel(domain) && isPlausibleTld(tld)) {
      return `${local}@${domain}.${tld}`.toLowerCase();
    }
  }

  // vorname.nachname.firma.de → vorname.nachname@firma.de
  if (parts.length >= 4) {
    const tld = parts[parts.length - 1];
    if (isPlausibleTld(tld)) {
      const domain = `${parts[parts.length - 2]}.${tld}`.toLowerCase();
      const local = parts.slice(0, -2).join(".");
      if (local.length >= 1) return `${local}@${domain}`;
    }
  }

  return value.toLowerCase();
}

/** Kleinbuchstaben ohne Umlaute/Diakritika für Namensvergleiche. */
export function foldNameToken(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Phonetik-Faltung für deutsche Namensvarianten:
 * Meyer/Meier/Maier/Mayer → gleiche Basis.
 */
export function foldGermanNamePhonetic(raw: string): string {
  let s = foldNameToken(raw);
  // Mehrfach ersetzen, Reihenfolge: längere Digraphen zuerst
  s = s.replace(/ey/g, "ei").replace(/ay/g, "ai");
  s = s.replace(/ck/g, "k");
  return s;
}

export function germanNamesSoundAlike(a: string, b: string): boolean {
  const fa = foldGermanNamePhonetic(a);
  const fb = foldGermanNamePhonetic(b);
  return Boolean(fa) && fa === fb;
}

function emailLocalSeparator(local: string): string {
  if (local.includes(".")) return ".";
  if (local.includes("_")) return "_";
  if (local.includes("-")) return "-";
  return "";
}

/**
 * Richtet den Local-Part an bekannte Vor-/Nachnamen aus.
 * „heinzmeier@web.de“ + Nachname Meyer → „heinzmeyer@web.de“.
 * Andere Adressen (info@…, Firmenkürzel) bleiben unangetastet.
 */
export function alignEmailLocalPartToKnownNames(
  email: string,
  firstName: string,
  lastName: string
): string {
  const trimmed = email.trim();
  if (!trimmed.includes("@")) return trimmed;

  const at = trimmed.indexOf("@");
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  if (!local || !domain) return trimmed;

  const first = foldNameToken(firstName);
  const last = foldNameToken(lastName);
  if (!first && !last) return trimmed;

  const localCompact = foldNameToken(local);
  if (!localCompact) return trimmed;

  const sep = emailLocalSeparator(local);

  // vorname+nachname (mit/ohne Trenner), Nachname nur phonetisch falsch
  if (first && last && localCompact.startsWith(first) && localCompact.length > first.length) {
    const rest = localCompact.slice(first.length);
    if (germanNamesSoundAlike(rest, last) && rest !== last) {
      return `${first}${sep}${last}@${domain}`;
    }
    if (rest === last) return trimmed.toLowerCase();
  }

  // nur Nachname als Local-Part
  if (last && germanNamesSoundAlike(localCompact, last) && localCompact !== last) {
    return `${last}@${domain}`;
  }

  // nachname+vorname (selten, aber ASR/Modell vertauscht manchmal)
  if (first && last && localCompact.startsWith(last) === false) {
    // no-op
  }
  if (first && last && localCompact.endsWith(first) && localCompact.length > first.length) {
    const head = localCompact.slice(0, localCompact.length - first.length);
    if (germanNamesSoundAlike(head, last) && head !== last) {
      return `${last}${sep}${first}@${domain}`;
    }
  }

  return trimmed;
}

/** Normalisiert bekannte E-Mail-Felder in der Notiz. */
export function normalizeNoteEmails(
  fields: Record<string, string>
): Record<string, string> {
  const next = { ...fields };
  const firstName = (next["Mieter Vorname"] ?? "").trim();
  const lastName = (next["Mieter Nachname"] ?? "").trim();
  for (const field of EMAIL_FIELDS) {
    const value = (next[field] ?? "").trim();
    if (!value) continue;
    const normalized = normalizeEmailValue(value);
    next[field] = alignEmailLocalPartToKnownNames(normalized, firstName, lastName);
  }
  return next;
}
