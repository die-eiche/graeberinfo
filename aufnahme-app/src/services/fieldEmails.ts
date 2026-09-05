/**
 * Normalisiert E-Mail-Adressen aus ASR/Extrakt.
 * Typische Fehler: „at“/„ät“ statt @, oder @ als Punkt (name.gmail.com).
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

function stripSpokenSeparators(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s*(?:klammeraffe|at-zeichen|atzeichen)\s*/gi, "@")
    .replace(/\s+(?:at|ät|aet)\s+/gi, "@")
    .replace(/\s+punkt\s+/gi, ".")
    .replace(/\s+minus\s+/gi, "-")
    .replace(/\s+unterstrich\s+/gi, "_")
    .replace(/\s+/g, "");
}

/**
 * Stellt @ wieder her, wenn ASR nur Punkte geliefert hat
 * (z. B. max.mustermann.gmail.com → max.mustermann@gmail.com).
 */
export function normalizeEmailValue(raw: string): string {
  let value = stripSpokenSeparators(raw);
  if (!value) return value;

  // bereits mit @: Kleinbuchstaben, doppelte Punkte bereinigen
  if (value.includes("@")) {
    const [local, ...rest] = value.split("@");
    const domain = rest.join("@").replace(/@/g, "");
    if (!local || !domain) return value.toLowerCase();
    return `${local}@${domain}`.toLowerCase().replace(/\.{2,}/g, ".");
  }

  const lower = value.toLowerCase();
  for (const provider of EMAIL_PROVIDERS) {
    const suffix = `.${provider}`;
    if (lower.endsWith(suffix)) {
      const local = value.slice(0, value.length - suffix.length);
      if (local.length >= 1) return `${local}@${provider}`.toLowerCase();
    }
  }

  // z. B. name.firma.de mit ≥4 Segmenten (vorname.nachname.firma.de)
  const parts = value.split(".").filter(Boolean);
  if (parts.length >= 4) {
    const tld = parts[parts.length - 1];
    if (/^[a-z]{2,24}$/i.test(tld)) {
      const domain = `${parts[parts.length - 2]}.${tld}`.toLowerCase();
      const local = parts.slice(0, -2).join(".");
      if (local.length >= 1) return `${local}@${domain}`;
    }
  }

  return value.toLowerCase();
}

/** Normalisiert bekannte E-Mail-Felder in der Notiz. */
export function normalizeNoteEmails(
  fields: Record<string, string>
): Record<string, string> {
  const next = { ...fields };
  for (const field of EMAIL_FIELDS) {
    const value = (next[field] ?? "").trim();
    if (!value) continue;
    next[field] = normalizeEmailValue(value);
  }
  return next;
}
