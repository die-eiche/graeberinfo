/** Pausenbasierte Segment-Grenzen (statt starrem 10s-Schnitt). */
export const MIN_SEGMENT_MS = 5_000;
export const MAX_SEGMENT_MS = 22_000;
/** Fallback ohne Metering (kein Pegel verfügbar). */
export const FALLBACK_SEGMENT_MS = 12_000;
export const SILENCE_HOLD_MS = 800;
export const METER_POLL_MS = 250;
/**
 * expo-audio liefert Metering typischerweise in dBFS (negativ).
 * Unter diesem Wert gilt die Aufnahme als Pause/Stille.
 */
export const SILENCE_DBFS = -40;

export type MeterSample = {
  durationMillis: number;
  metering?: number;
};

/**
 * Entscheidet, ob das aktuelle Audio-Segment rotiert werden soll.
 * - Vor MIN_SEGMENT_MS nie schneiden
 * - Ab MIN: nach anhaltender Stille schneiden
 * - Spätestens bei MAX_SEGMENT_MS schneiden
 * - Ohne Metering: Fallback-Dauer
 */
export function evaluateSegmentCut(
  sample: MeterSample,
  silenceSinceMs: number | null,
  nowMs: number
): { shouldCut: boolean; nextSilenceSinceMs: number | null } {
  const duration = Math.max(0, sample.durationMillis || 0);

  if (duration >= MAX_SEGMENT_MS) {
    return { shouldCut: true, nextSilenceSinceMs: null };
  }

  if (duration < MIN_SEGMENT_MS) {
    // Stille vor der Mindestdauer nicht als Schnittkandidat zählen
    return { shouldCut: false, nextSilenceSinceMs: null };
  }

  if (sample.metering === undefined || Number.isNaN(sample.metering)) {
    return {
      shouldCut: duration >= FALLBACK_SEGMENT_MS,
      nextSilenceSinceMs: null,
    };
  }

  const isSilent = sample.metering <= SILENCE_DBFS;
  if (!isSilent) {
    return { shouldCut: false, nextSilenceSinceMs: null };
  }

  if (silenceSinceMs === null) {
    return { shouldCut: false, nextSilenceSinceMs: nowMs };
  }

  if (nowMs - silenceSinceMs >= SILENCE_HOLD_MS) {
    return { shouldCut: true, nextSilenceSinceMs: null };
  }

  return { shouldCut: false, nextSilenceSinceMs: silenceSinceMs };
}
