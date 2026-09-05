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
 * Reichert Todestag / TF-Wunschtermin an:
 * - nur Jahr → bleibt Jahr (oder wird als Jahr behalten)
 * - Tag+Monat ohne Jahr → Jahr ergänzen
 * - nur Monat+Jahr etc. unverändert lassen wenn unklar
 */
export function enrichPartialDate(raw: string, now = new Date()): string {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === UNCERTAIN_MARK) return trimmed;

  const relative = resolveRelativeDateToken(trimmed, now);
  if (relative) return relative;

  // schon volles Datum TT.MM.JJJJ oder JJJJ-MM-TT
  if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(trimmed)) {
    const [d, m, y] = trimmed.split(".").map(Number);
    return `${pad2(d)}.${pad2(m)}.${y}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

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
      return `${pad2(day)}.${pad2(month)}.${year}`;
    }
  }

  // "15. März" / "15 März" / "15. März  " ohne Jahr
  const named = /^(\d{1,2})\.?\s+([A-Za-zÄÖÜäöü.]+)(?:\s+(\d{4}))?$/.exec(trimmed);
  if (named) {
    const day = Number(named[1]);
    const month = normalizeMonthToken(named[2]);
    if (month && day >= 1 && day <= 31) {
      const year = named[3] ? Number(named[3]) : resolveImpliedYear(month, day, now);
      return `${pad2(day)}.${pad2(month)}.${year}`;
    }
  }

  // "März 2026" → unvollständig für Tag, unverändert
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

  // Feldwert selbst ist Relativwort
  if (current) {
    const resolved = resolveRelativeDateToken(current, now);
    if (resolved) {
      next["Verstorbener Todestag"] = resolved;
      return next;
    }
  }

  const text = transcript.replace(/\s+/g, " ");
  const patterns = [
    /\b(vorgestern|gestern|heute|morgen|übermorgen|uebermorgen)\b[^.!?]{0,40}\b(verstorben|gestorben|todestag)\b/i,
    /\b(verstorben|gestorben|todestag)\b[^.!?]{0,40}\b(vorgestern|gestern|heute|morgen|übermorgen|uebermorgen)\b/i,
    /\bist\s+(vorgestern|gestern|heute)\s+(verstorben|gestorben)\b/i,
  ];

  let token: string | null = null;
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (!match) continue;
    for (const g of match.slice(1)) {
      if (g && resolveRelativeDateToken(g, now)) {
        token = g;
        break;
      }
    }
    if (token) break;
  }

  if (!token) return next;
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

/** Nächster / übernächster Wochentag relativ zu now (JS: So=0). */
export function resolveNthWeekday(
  weekdayName: string,
  which: "next" | "after-next" | "this",
  now = new Date()
): string {
  const key = weekdayName
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z]/g, "");
  const target = WEEKDAY_INDEX[key];
  if (target === undefined) {
    throw new Error(`Unbekannter Wochentag: ${weekdayName}`);
  }
  const current = now.getDay();
  let delta = (target - current + 7) % 7;
  if (which === "next") {
    if (delta === 0) delta = 7;
  } else if (which === "after-next") {
    if (delta === 0) delta = 14;
    else delta += 7;
  }
  // which === "this": delta===0 bleibt heute
  return formatGermanDate(addDays(now, delta));
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

  // Expliziter Tag im Monat, oft nach „also den 13.“
  const dayOnly = /\b(?:also\s+)?(?:am|den|zum)\s+(\d{1,2})\.?(?:\s|$)/i.exec(text);
  // „übernächste[n|r|m]? Sonntag“
  const afterNext = /\b(?:am\s+)?(?:übernächste[nrms]?|uebernächste[nrms]?|uebernaechste[nrms]?)\s+(Sonntag|Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag)\b/i.exec(
    text
  );
  const nextWd = /\b(?:am\s+)?(?:nächste[nrms]?|kommende[nrms]?)\s+(Sonntag|Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag)\b/i.exec(
    text
  );
  const thisWd = /\b(?:an?\s+)?diese[nrms]?\s+(Sonntag|Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag)\b/i.exec(
    text
  );

  let resolved: string | null = null;
  if (afterNext?.[1]) {
    resolved = resolveNthWeekday(afterNext[1], "after-next", now);
  } else if (nextWd?.[1]) {
    resolved = resolveNthWeekday(nextWd[1], "next", now);
  } else if (thisWd?.[1]) {
    resolved = resolveNthWeekday(thisWd[1], "this", now);
  }

  // „den 13.“ bestätigt / setzt Tag – wenn Wochentag schon resolved und Tag passt: ok;
  // wenn nur Tag genannt: Tag im aktuellen/nächsten Monat
  if (dayOnly?.[1]) {
    const day = Number(dayOnly[1]);
    if (day >= 1 && day <= 31) {
      if (resolved) {
        // Wenn Wochentag-Auflösung denselben Tag hat → behalten; sonst Tag aus „den 13.“ bevorzugen
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
      } else {
        const month = now.getMonth();
        const year = now.getFullYear();
        let candidate = new Date(year, month, day);
        if (candidate.getDate() !== day) {
          // ungültiger Tag im Monat
          candidate = new Date(year, month + 1, day);
        }
        if (candidate.getTime() < new Date(year, month, now.getDate()).getTime()) {
          candidate = new Date(year, month + 1, day);
        }
        resolved = formatGermanDate(candidate);
      }
    }
  }

  if (!resolved) return next;
  next["TF-Wunschtermin"] = resolved;
  return next;
}


const DATE_FIELDS = ["Verstorbener Todestag", "TF-Wunschtermin"] as const;

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
    next = applyRelativeDeathDateFromTranscript(next, transcript, now);
    next = applyRelativeTfDateFromTranscript(next, transcript, now);
  }
  return next;
}
