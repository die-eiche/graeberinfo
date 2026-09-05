import {
  parseRelativeDatePhrase,
  resolveRelativeDatePhrase,
  resolveWeekdayFromToday,
  parseWeekdayName,
} from "./relativeDates";
import { UNCERTAIN_MARK } from "./allowedValues";

const MONTHS: Record<string, number> = {
  januar: 1,
  jan: 1,
  februar: 2,
  feb: 2,
  maerz: 3,
  märz: 3,
  marz: 3,
  mrz: 3,
  april: 4,
  apr: 4,
  mai: 5,
  juni: 6,
  jun: 6,
  juli: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sept: 9,
  sep: 9,
  oktober: 10,
  okt: 10,
  november: 11,
  nov: 11,
  dezember: 12,
  dez: 12,
};

export type DateEnrichContext = {
  /** Referenzzeitpunkt (i. d. R. jetzt). */
  now?: Date;
};

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Wählt Jahr um den Jahreswechsel herum (Todestag / Trauerfeier). */
export function resolveImpliedYear(month: number, day: number, now = new Date()): number {
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();

  // Explizit nur Monat/Tag bekannt: nahe am Jahreswechsel sinnvoll wählen
  const candidateThis = new Date(currentYear, month - 1, day);
  const candidatePrev = new Date(currentYear - 1, month - 1, day);
  const candidateNext = new Date(currentYear + 1, month - 1, day);

  // Wenn Datum in diesem Jahr noch ≤ ~60 Tage in der Zukunft oder Vergangenheit liegt → aktuelles Jahr
  const msDay = 86_400_000;
  const diffThis = (candidateThis.getTime() - now.getTime()) / msDay;

  // Jahreswechsel-Heuristik:
  // - Ende Nov/Dez + Datum Jan–März → eher kommendes Jahr (TF) bzw. aktuelles/letztes für Tod
  // - Jan–Feb + Datum Nov/Dez → eher letztes Jahr
  if (currentMonth >= 11 && month <= 3) {
    // Spät im Jahr, frühes Kalenderdatum → kommendes Jahr, wenn nicht klar vergangen
    if (diffThis < -30) return currentYear + 1;
    if (diffThis > 90) return currentYear + 1;
    return diffThis >= -7 ? currentYear + 1 : currentYear;
  }
  if (currentMonth <= 2 && month >= 11) {
    return currentYear - 1;
  }

  // Standard: aktuelles Jahr, außer Datum liegt >120 Tage in der Zukunft → eher letztes Jahr
  if (diffThis > 120) {
    const diffPrev = (candidatePrev.getTime() - now.getTime()) / msDay;
    if (Math.abs(diffPrev) < Math.abs(diffThis)) return currentYear - 1;
  }
  // Datum > 60 Tage in der Vergangenheit im aktuellen Jahr bleibt aktuelles Jahr
  // Sehr weit in der Zukunft (>180) und nächstes Jahr näher → nächstes
  if (diffThis > 180) {
    const diffNext = (candidateNext.getTime() - now.getTime()) / msDay;
    if (Math.abs(diffNext) < Math.abs(diffThis)) return currentYear + 1;
  }

  void currentDay;
  return currentYear;
}

function normalizeMonthToken(token: string): number | null {
  const key = token
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\./g, "");
  // restore ä/ö/ü roughly after NFD strip: maerz already handled
  const mapped = MONTHS[key] ?? MONTHS[token.toLowerCase().replace(/\./g, "")];
  return mapped ?? null;
}

/**
 * Einheitliches Anzeige-/Speicherformat: TT.MM.JJJJ
 * (unbekannter Tag als 00, z. B. 00.10.1934).
 */
export function toGermanDateFormat(day: number, month: number, year: number): string {
  return `${pad2(day)}.${pad2(month)}.${year}`;
}

/**
 * Wandelt ISO/Teilangaben ins einheitliche deutsche Datumsformat.
 * - nur Jahr → bleibt Jahr
 * - Tag+Monat ohne Jahr → Jahr ergänzen → TT.MM.JJJJ
 * - JJJJ-MM-TT / JJJJ-MM-00 → TT.MM.JJJJ (00 = Tag unbekannt)
 */
export function enrichPartialDate(raw: string, now = new Date()): string {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === UNCERTAIN_MARK) return trimmed;

  const fromPhrase = resolveRelativeDatePhrase(trimmed, now);
  if (fromPhrase) return fromPhrase;

  const relative = resolveRelativeDateToken(trimmed, now);
  if (relative) return relative;

  // schon deutsches Datum TT.MM.JJJJ (Tag darf 00 sein)
  if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(trimmed)) {
    const [d, m, y] = trimmed.split(".").map(Number);
    if (m >= 1 && m <= 12 && d >= 0 && d <= 31) {
      return toGermanDateFormat(d, m, y);
    }
  }

  // ISO JJJJ-MM-TT (auch Tag 00 = unbekannt)
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    if (month >= 1 && month <= 12 && day >= 0 && day <= 31) {
      return toGermanDateFormat(day, month, year);
    }
  }

  // ISO ohne Tag: JJJJ-MM
  const isoYm = /^(\d{4})-(\d{2})$/.exec(trimmed);
  if (isoYm) {
    const year = Number(isoYm[1]);
    const month = Number(isoYm[2]);
    if (month >= 1 && month <= 12) {
      return toGermanDateFormat(0, month, year);
    }
  }

  // nur Jahr
  if (/^\d{4}$/.test(trimmed)) {
    return trimmed;
  }

  // TT.MM. oder TT.MM (ohne Jahr)
  const dm = /^(\d{1,2})\.(\d{1,2})\.?$/.exec(trimmed);
  if (dm) {
    const day = Number(dm[1]);
    const month = Number(dm[2]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const year = resolveImpliedYear(month, day, now);
      return toGermanDateFormat(day, month, year);
    }
  }

  // "15. März" / "15 März" ohne/mit Jahr
  const named = /^(\d{1,2})\.?\s+([A-Za-zÄÖÜäöü.]+)(?:\s+(\d{4}))?$/.exec(trimmed);
  if (named) {
    const day = Number(named[1]);
    const month = normalizeMonthToken(named[2]);
    if (month && day >= 1 && day <= 31) {
      const year = named[3] ? Number(named[3]) : resolveImpliedYear(month, day, now);
      return toGermanDateFormat(day, month, year);
    }
  }

  // "März 2026" / "Oktober 1934" → Tag unbekannt → 00.MM.JJJJ
  const monthYear = /^([A-Za-zÄÖÜäöü.]+)\s+(\d{4})$/.exec(trimmed);
  if (monthYear) {
    const month = normalizeMonthToken(monthYear[1]);
    const year = Number(monthYear[2]);
    if (month) return toGermanDateFormat(0, month, year);
  }

  return trimmed;
}


const RELATIVE_DAY_OFFSET: Record<string, number> = {
  vorgestern: -2,
  gestern: -1,
  heute: 0,
  morgen: 1,
  ubermorgen: 2,
  uebermorgen: 2,
};

function formatGermanDate(d: Date): string {
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  d.setDate(d.getDate() + days);
  return d;
}

/** Löst reine Relativangaben wie „vorgestern“ zu TT.MM.JJJJ auf. */
export function resolveRelativeDateToken(raw: string, now = new Date()): string | null {
  const key = raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z]/g, "");
  if (!(key in RELATIVE_DAY_OFFSET)) return null;
  return formatGermanDate(addDays(now, RELATIVE_DAY_OFFSET[key]));
}

/**
 * Setzt Verstorbener Todestag aus Transkript-Relativangaben
 * („vorgestern verstorben“, „ist gestern gestorben“, …),
 * wenn noch kein brauchbares Datum gesetzt ist.
 */
export function applyRelativeDeathDateFromTranscript(
  fields: Record<string, string>,
  transcript: string,
  now = new Date()
): Record<string, string> {
  const next = { ...fields };
  const current = (next["Verstorbener Todestag"] ?? "").trim();

  const text = transcript.replace(/\s+/g, " ");
  const birthdayAgeContext = /\b\d{1,3}\s*(?:Jahre?(?:n)?\s+)?(?:alt\s+)?geworden\b/i.test(text)
    || /\b(vorgestern|gestern|heute)\b[^.!?]{0,40}\b(geburtstag|geboren)\b/i.test(text);

  // Feldwert selbst ist Relativwort – nicht bei Alters-/Geburtstagskontext
  if (current && !birthdayAgeContext) {
    const resolved = resolveRelativeDateToken(current, now);
    if (resolved) {
      next["Verstorbener Todestag"] = resolved;
      return next;
    }
  }

  const patterns = [
    /\b(vorgestern|gestern|heute|morgen|übermorgen|uebermorgen)\b[^.!?]{0,40}\b(verstorben|gestorben|todestag)\b/i,
    /\b(verstorben|gestorben|todestag)\b[^.!?]{0,40}\b(vorgestern|gestern|heute|morgen|übermorgen|uebermorgen)\b/i,
    /\bist\s+(vorgestern|gestern|heute)\s+(verstorben|gestorben)\b/i,
  ];

  // Spätere Relativangaben gewinnen (Korrektur: „vorgestern … nein gestern“)
  let token: string | null = null;
  for (const pattern of patterns) {
    const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g");
    let match: RegExpExecArray | null;
    while ((match = re.exec(text))) {
      for (const g of match.slice(1)) {
        if (g && resolveRelativeDateToken(g, now)) {
          token = g;
          break;
        }
      }
    }
  }

  if (!token) return next;
  if (birthdayAgeContext && !transcriptHasExplicitDeath(text)) {
    return next;
  }
  const resolved = resolveRelativeDateToken(token, now);
  if (!resolved) return next;

  // Transkript-Relativangabe hat Vorrang vor geratenem/falschem Kalenderdatum
  next["Verstorbener Todestag"] = resolved;
  return next;
}



const WEEKDAY_INDEX: Record<string, number> = {
  sonntag: 0,
  montag: 1,
  dienstag: 2,
  mittwoch: 3,
  donnerstag: 4,
  freitag: 5,
  samstag: 6,
};

/** @deprecated Name historisch – delegiert an resolveWeekdayFromToday. */
export function resolveNthWeekday(
  weekdayName: string,
  which: "next" | "after-next" | "this",
  now = new Date()
): string {
  const weekday = parseWeekdayName(weekdayName);
  if (weekday == null) throw new Error(`Unbekannter Wochentag: ${weekdayName}`);
  const date = resolveWeekdayFromToday(weekday, which, now);
  return formatGermanDate(date);
}

/**
 * Löst TF-Wunschtermin aus Transkript:
 * „übernächsten Sonntag“, „nächsten Freitag“, „also den 13.“ usw.
 * Überschreibt falsche KI-Daten, wenn eine klare Angabe erkennbar ist.
 */
export function applyRelativeTfDateFromTranscript(
  fields: Record<string, string>,
  transcript: string,
  now = new Date()
): Record<string, string> {
  const next = { ...fields };
  const text = transcript.replace(/\s+/g, " ");

  // Strukturelle Auflösung: Ordinal-im-Monat vor „nächster Sonntag“ vor „den 13.“
  const parsed = parseRelativeDatePhrase(text, now);
  if (parsed?.kind === "weekday-in-month") {
    next["TF-Wunschtermin"] = formatGermanDate(parsed.date);
    return next;
  }

  let resolved: string | null = null;
  if (parsed?.kind === "weekday-from-today") {
    resolved = formatGermanDate(parsed.date);
  }

  // „also den 13.“ bestätigt / ergänzt – bei Widerspruch zum Wochentag den genannten Tag nehmen
  const dayOnly = /\b(?:also\s+)?(?:am|den|zum)\s+(\d{1,2})\.?(?:\s|$)/i.exec(text);
  if (dayOnly?.[1]) {
    const day = Number(dayOnly[1]);
    if (day >= 1 && day <= 31) {
      if (resolved) {
        const resolvedDay = Number(resolved.split(".")[0]);
        if (resolvedDay !== day) {
          const month = now.getMonth();
          const year = now.getFullYear();
          let candidate = new Date(year, month, day);
          if (candidate.getTime() < new Date(year, month, now.getDate()).getTime()) {
            candidate = new Date(year, month + 1, day);
          }
          resolved = formatGermanDate(candidate);
        }
      } else if (parsed?.kind === "day-of-month") {
        resolved = formatGermanDate(parsed.date);
      } else {
        const month = now.getMonth();
        const year = now.getFullYear();
        let candidate = new Date(year, month, day);
        if (candidate.getDate() !== day) {
          candidate = new Date(year, month + 1, day);
        }
        if (candidate.getTime() < new Date(year, month, now.getDate()).getTime()) {
          candidate = new Date(year, month + 1, day);
        }
        resolved = formatGermanDate(candidate);
      }
    }
  } else if (!resolved && parsed) {
    resolved = formatGermanDate(parsed.date);
  }

  if (!resolved) return next;
  next["TF-Wunschtermin"] = resolved;
  return next;
}


/**
 * „gestern 84 geworden“ / „84 geworden gestern“ → Verstorbener Geburtstag.
 * Jahrestag = Relativtag; Geburtsjahr = Jahrestag.Jahr − Alter.
 * Fälschlich auf denselben Kalendertag gesetzter Todestag wird entfernt,
 * wenn im Transkript kein echter Todesbeleg steht.
 */
export function applyBirthdayFromAgeInTranscript(
  fields: Record<string, string>,
  transcript: string,
  now = new Date()
): Record<string, string> {
  const next = { ...fields };
  const text = transcript.replace(/\s+/g, " ").trim();
  if (!text) return next;

  const patterns: RegExp[] = [
    /\b(vorgestern|gestern|heute)\b[^.!?]{0,48}?\b(\d{1,3})\s*(?:Jahre?(?:n)?\s+)?(?:alt\s+)?geworden\b/gi,
    /\b(\d{1,3})\s*(?:Jahre?(?:n)?\s+)?(?:alt\s+)?geworden\b[^.!?]{0,48}?\b(vorgestern|gestern|heute)\b/gi,
    /\b(vorgestern|gestern|heute)\b[^.!?]{0,24}?\b(\d{1,3})\.?\s*(?:Geburtstag|Geburtstag)\b/gi,
    /\bwäre?\s+(?:sie|er)\s+(vorgestern|gestern|heute)\s+(\d{1,3})\s*(?:Jahre?(?:n)?)?\s*(?:alt\s+)?geworden\b/gi,
  ];

  let relativeToken: string | null = null;
  let age: number | null = null;

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text))) {
      const g1 = match[1] ?? "";
      const g2 = match[2] ?? "";
      const rel = /\d/.test(g1) ? g2 : g1;
      const ageRaw = /\d/.test(g1) ? g1 : g2;
      const parsedAge = Number(ageRaw);
      if (!resolveRelativeDateToken(rel, now)) continue;
      if (!Number.isFinite(parsedAge) || parsedAge < 1 || parsedAge > 120) continue;
      relativeToken = rel;
      age = parsedAge;
    }
  }

  if (!relativeToken || age == null) return next;

  const anniversary = (() => {
    const key = relativeToken
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/[^a-z]/g, "");
    const offset = RELATIVE_DAY_OFFSET[key];
    if (offset === undefined) return null;
    return addDays(now, offset);
  })();
  if (!anniversary) return next;

  const birthYear = anniversary.getFullYear() - age;
  const birthday = toGermanDateFormat(
    anniversary.getDate(),
    anniversary.getMonth() + 1,
    birthYear
  );
  next["Verstorbener Geburtstag"] = birthday;

  const anniversaryDe = formatGermanDate(anniversary);
  const death = (next["Verstorbener Todestag"] ?? "").trim();
  if (death && (death === anniversaryDe || resolveRelativeDateToken(death, now) === anniversaryDe)) {
    if (!transcriptHasExplicitDeath(text)) {
      delete next["Verstorbener Todestag"];
    }
  }

  return next;
}

/** Todesbeleg außerhalb von „X geworden“-/Geburtstag-Kontext. */
function transcriptHasExplicitDeath(transcript: string): boolean {
  const stripped = transcript
    .replace(/\b(vorgestern|gestern|heute)\b[^.!?]{0,48}?\b\d{1,3}\s*(?:Jahre?(?:n)?\s+)?(?:alt\s+)?geworden\b/gi, " ")
    .replace(/\b\d{1,3}\s*(?:Jahre?(?:n)?\s+)?(?:alt\s+)?geworden\b[^.!?]{0,48}?\b(vorgestern|gestern|heute)\b/gi, " ");
  return /\b(verstorben|gestorben|todestag|tot\s+aufgefunden|verstorben\s+am)\b/i.test(stripped);
}


const DATE_FIELDS = [
  "Verstorbener Geburtstag",
  "Verstorbener Todestag",
  "TF-Wunschtermin",
] as const;

/** Wendet Jahres-/Datums-Ergänzung auf Notizfelder an. */
export function enrichNoteDates(
  fields: Record<string, string>,
  now = new Date(),
  transcript = ""
): Record<string, string> {
  let next = { ...fields };
  for (const field of DATE_FIELDS) {
    const value = (next[field] ?? "").trim();
    if (!value) continue;
    next[field] = enrichPartialDate(value, now);
  }
  if (transcript.trim()) {
    // Alter+Relativtag zuerst (sonst landet „gestern 84 geworden“ fälschlich im Todestag)
    next = applyBirthdayFromAgeInTranscript(next, transcript, now);
    next = applyRelativeDeathDateFromTranscript(next, transcript, now);
    next = applyRelativeTfDateFromTranscript(next, transcript, now);
  }
  return next;
}
