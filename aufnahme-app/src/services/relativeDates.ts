/**
 * Relative Datumsangaben – strukturelle Auflösung (deterministisch).
 *
 * Abgedeckt:
 * - Relativtage: vorgestern / gestern / heute / morgen / übermorgen
 * - Relativ zum Heute: nächster / übernächster / dieser Wochentag
 * - Ordinal im Monat: „erster Sonntag im Oktober“ ≠ 01.10., sondern erster Sonntag
 * - „letzter Freitag im März“, „2. Samstag im November“
 *
 * Jahr: für Terminangaben der nächste passende Monat (vergangene Monate → Folgejahr).
 */

export type WeekdayOccurrence = 1 | 2 | 3 | 4 | "last";
export type WeekdayRelativeWhich = "this" | "next" | "after-next";

const WEEKDAYS: Record<string, number> = {
  sonntag: 0,
  montag: 1,
  dienstag: 2,
  mittwoch: 3,
  donnerstag: 4,
  freitag: 5,
  samstag: 6,
};

const MONTHS: Record<string, number> = {
  januar: 1,
  jan: 1,
  februar: 2,
  feb: 2,
  maerz: 3,
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

const RELATIVE_DAY_OFFSET: Record<string, number> = {
  vorgestern: -2,
  gestern: -1,
  heute: 0,
  morgen: 1,
  ubermorgen: 2,
  uebermorgen: 2,
};

const ORDINAL_WORDS: Record<string, WeekdayOccurrence> = {
  erste: 1,
  erster: 1,
  ersten: 1,
  erstes: 1,
  zweite: 2,
  zweiter: 2,
  zweiten: 2,
  zweites: 2,
  dritte: 3,
  dritter: 3,
  dritten: 3,
  drittes: 3,
  vierte: 4,
  vierter: 4,
  vierten: 4,
  viertes: 4,
  letzte: "last",
  letzter: "last",
  letzten: "last",
  letztes: "last",
};

const WEEKDAY_ALT = "Sonntag|Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag";
const MONTH_ALT =
  "Januar|Februar|März|Maerz|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember|Jan|Feb|Mrz|Apr|Jun|Jul|Aug|Sep|Sept|Okt|Nov|Dez";

function foldKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]/g, "");
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function formatGermanDate(d: Date): string {
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
}

export function addDays(base: Date, days: number): Date {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  d.setDate(d.getDate() + days);
  return d;
}

export function parseWeekdayName(name: string): number | null {
  const key = foldKey(name);
  return WEEKDAYS[key] ?? null;
}

export function parseMonthName(name: string): number | null {
  const key = foldKey(name);
  return MONTHS[key] ?? null;
}

export function parseOrdinalWord(raw: string): WeekdayOccurrence | null {
  const key = foldKey(raw);
  if (key in ORDINAL_WORDS) return ORDINAL_WORDS[key];
  const num = /^(\d+)(?:st|nd|rd|th|te[rnms]?)?$/.exec(key);
  if (num) {
    const n = Number(num[1]);
    if (n >= 1 && n <= 4) return n as WeekdayOccurrence;
  }
  return null;
}

/**
 * Jahr für einen Monatsnamen bei Terminen:
 * ist der Monat in diesem Jahr schon vorbei → nächstes Jahr.
 */
export function implyYearForMonthName(month: number, now = new Date()): number {
  const year = now.getFullYear();
  const startOfMonth = new Date(year, month - 1, 1);
  const startOfThisMonth = new Date(year, now.getMonth(), 1);
  if (startOfMonth.getTime() < startOfThisMonth.getTime()) return year + 1;
  return year;
}

/**
 * n-ter Wochentag in einem Monat (1=erster, last=letzter).
 * „erster Sonntag im Oktober“ → erster Sonntag, nicht der 1. Oktober.
 */
export function resolveWeekdayInMonth(
  weekday: number,
  occurrence: WeekdayOccurrence,
  month: number,
  year: number
): Date {
  if (weekday < 0 || weekday > 6) throw new Error(`weekday out of range: ${weekday}`);
  if (month < 1 || month > 12) throw new Error(`month out of range: ${month}`);

  if (occurrence === "last") {
    // Letzter Tag des Monats, rückwärts bis Wochentag
    const lastDay = new Date(year, month, 0); // Tag 0 des Folgemonats
    const delta = (lastDay.getDay() - weekday + 7) % 7;
    return addDays(lastDay, -delta);
  }

  const first = new Date(year, month - 1, 1);
  const deltaToFirst = (weekday - first.getDay() + 7) % 7;
  const firstOccurrence = addDays(first, deltaToFirst);
  const result = addDays(firstOccurrence, (occurrence - 1) * 7);
  // Sicherheit: noch im gewünschten Monat?
  if (result.getMonth() !== month - 1) {
    throw new Error(
      `Kein ${occurrence}. Wochentag ${weekday} in ${month}/${year}`
    );
  }
  return result;
}

/** dieser / nächster / übernächster Wochentag ab now. */
export function resolveWeekdayFromToday(
  weekday: number,
  which: WeekdayRelativeWhich,
  now = new Date()
): Date {
  const current = now.getDay();
  let delta = (weekday - current + 7) % 7;
  if (which === "next") {
    if (delta === 0) delta = 7;
  } else if (which === "after-next") {
    if (delta === 0) delta = 14;
    else delta += 7;
  }
  return addDays(now, delta);
}

/** vorgestern/gestern/heute/morgen/übermorgen → Date. */
export function resolveRelativeDayToken(raw: string, now = new Date()): Date | null {
  const key = foldKey(raw);
  if (!(key in RELATIVE_DAY_OFFSET)) return null;
  return addDays(now, RELATIVE_DAY_OFFSET[key]);
}

export type ParsedRelativeDate = {
  date: Date;
  kind:
    | "relative-day"
    | "weekday-from-today"
    | "weekday-in-month"
    | "day-of-month";
};

/**
 * Parst eine Phrase oder einen Transkript-Ausschnitt zu einem konkreten Datum.
 * Spezifischere Muster (Ordinal im Monat) haben Vorrang vor „nächster Sonntag“.
 */
export function parseRelativeDatePhrase(
  phrase: string,
  now = new Date()
): ParsedRelativeDate | null {
  const text = phrase.replace(/\s+/g, " ").trim();
  if (!text) return null;

  // 1) „(am )erste(n) Sonntag im Oktober [2026]“
  const ordinalInMonth = new RegExp(
    `\\b(?:am\\s+)?(\\d{1,2}\\.?|erste[rnms]?|zweite[rnms]?|dritte[rnms]?|vierte[rnms]?|letzte[rnms]?)\\s+(${WEEKDAY_ALT})\\s+im\\s+(${MONTH_ALT})(?:\\s+(\\d{4}))?\\b`,
    "i"
  ).exec(text);
  if (ordinalInMonth) {
    const occurrence = parseOrdinalWord(ordinalInMonth[1].replace(/\.$/, ""));
    const weekday = parseWeekdayName(ordinalInMonth[2]);
    const month = parseMonthName(ordinalInMonth[3]);
    if (occurrence != null && weekday != null && month != null) {
      const year = ordinalInMonth[4]
        ? Number(ordinalInMonth[4])
        : implyYearForMonthName(month, now);
      try {
        const date = resolveWeekdayInMonth(weekday, occurrence, month, year);
        return { date, kind: "weekday-in-month" };
      } catch {
        // z. B. 5. Sonntag existiert nicht
      }
    }
  }

  // Variante: „Sonntag, der erste im Oktober“
  const weekdayThenOrdinal = new RegExp(
    `\\b(${WEEKDAY_ALT})\\s*,?\\s*(?:der\\s+)?(\\d{1,2}\\.?|erste[rnms]?|zweite[rnms]?|dritte[rnms]?|vierte[rnms]?|letzte[rnms]?)\\s+im\\s+(${MONTH_ALT})(?:\\s+(\\d{4}))?\\b`,
    "i"
  ).exec(text);
  if (weekdayThenOrdinal) {
    const weekday = parseWeekdayName(weekdayThenOrdinal[1]);
    const occurrence = parseOrdinalWord(weekdayThenOrdinal[2].replace(/\.$/, ""));
    const month = parseMonthName(weekdayThenOrdinal[3]);
    if (occurrence != null && weekday != null && month != null) {
      const year = weekdayThenOrdinal[4]
        ? Number(weekdayThenOrdinal[4])
        : implyYearForMonthName(month, now);
      try {
        const date = resolveWeekdayInMonth(weekday, occurrence, month, year);
        return { date, kind: "weekday-in-month" };
      } catch {
        /* ignore */
      }
    }
  }

  // 2) übernächster / nächster / dieser Wochentag
  const afterNext = new RegExp(
    `\\b(?:am\\s+)?(?:übernächste[nrms]?|uebernächste[nrms]?|uebernaechste[nrms]?)\\s+(${WEEKDAY_ALT})\\b`,
    "i"
  ).exec(text);
  if (afterNext?.[1]) {
    const weekday = parseWeekdayName(afterNext[1]);
    if (weekday != null) {
      return {
        date: resolveWeekdayFromToday(weekday, "after-next", now),
        kind: "weekday-from-today",
      };
    }
  }
  const nextWd = new RegExp(
    `\\b(?:am\\s+)?(?:nächste[nrms]?|kommende[nrms]?)\\s+(${WEEKDAY_ALT})\\b`,
    "i"
  ).exec(text);
  if (nextWd?.[1]) {
    const weekday = parseWeekdayName(nextWd[1]);
    if (weekday != null) {
      return {
        date: resolveWeekdayFromToday(weekday, "next", now),
        kind: "weekday-from-today",
      };
    }
  }
  const thisWd = new RegExp(
    `\\b(?:an?\\s+)?diese[nrms]?\\s+(${WEEKDAY_ALT})\\b`,
    "i"
  ).exec(text);
  if (thisWd?.[1]) {
    const weekday = parseWeekdayName(thisWd[1]);
    if (weekday != null) {
      return {
        date: resolveWeekdayFromToday(weekday, "this", now),
        kind: "weekday-from-today",
      };
    }
  }

  // 3) reiner Relativtag
  const onlyRelative = /^(vorgestern|gestern|heute|morgen|übermorgen|uebermorgen)$/i.exec(
    text
  );
  if (onlyRelative) {
    const date = resolveRelativeDayToken(onlyRelative[1], now);
    if (date) return { date, kind: "relative-day" };
  }

  // 4) „also den 13.“ / „am 13.“ – Tag im aktuellen/nächsten Monat
  const dayOnly = /\b(?:also\s+)?(?:am|den|zum)\s+(\d{1,2})\.?(?:\s|$)/i.exec(text);
  if (dayOnly?.[1]) {
    const day = Number(dayOnly[1]);
    if (day >= 1 && day <= 31) {
      const month = now.getMonth();
      const year = now.getFullYear();
      let candidate = new Date(year, month, day);
      if (candidate.getDate() !== day) {
        candidate = new Date(year, month + 1, day);
      }
      const startToday = new Date(year, month, now.getDate());
      if (candidate.getTime() < startToday.getTime()) {
        candidate = new Date(year, month + 1, day);
      }
      return { date: candidate, kind: "day-of-month" };
    }
  }

  return null;
}

/** Komfort: Phrase → TT.MM.JJJJ oder null. */
export function resolveRelativeDatePhrase(
  phrase: string,
  now = new Date()
): string | null {
  const parsed = parseRelativeDatePhrase(phrase, now);
  return parsed ? formatGermanDate(parsed.date) : null;
}
