const DEFAULT_MAX_CHUNKS = 3;
const DEFAULT_MAX_CHARS = 1800;

/** Hängt einen neuen Transkript-Chunk an und begrenzt die Historie. */
export function appendTranscriptChunk(
  previous: string[],
  chunk: string,
  maxChunks = DEFAULT_MAX_CHUNKS
): string[] {
  const trimmed = chunk.trim();
  if (!trimmed) return previous;
  return [...previous, trimmed].slice(-Math.max(1, maxChunks));
}

/** Findet Zeichen-Überlappung zwischen Ende von `left` und Anfang von `right`. */
export function findTranscriptOverlap(left: string, right: string, maxCheck = 80): number {
  const a = left.trimEnd().toLowerCase();
  const b = right.trimStart().toLowerCase();
  const max = Math.min(maxCheck, a.length, b.length);
  for (let n = max; n >= 8; n--) {
    if (a.slice(-n) === b.slice(0, n)) return n;
  }
  // kürzere Wort-Überlappung am Rand
  for (let n = Math.min(7, max); n >= 3; n--) {
    if (a.slice(-n) === b.slice(0, n) && /\s/.test(a.slice(-n - 1, -n) || " ")) {
      return n;
    }
  }
  return 0;
}

/** Fügt Abschnitte zu einem gebundenen Text zusammen (Überlappungen entfernen). */
export function stitchTranscriptChunks(chunks: string[]): string {
  let out = "";
  for (const raw of chunks) {
    const chunk = raw.trim().replace(/\s+/g, " ");
    if (!chunk) continue;
    if (!out) {
      out = chunk;
      continue;
    }
    const overlap = findTranscriptOverlap(out, chunk);
    if (overlap > 0) {
      out = `${out}${chunk.slice(overlap)}`;
    } else {
      const needsSpace = !/\s$/.test(out) && !/^[.,;:!?]/.test(chunk);
      out = needsSpace ? `${out} ${chunk}` : `${out}${chunk}`;
    }
  }
  return out.replace(/\s+/g, " ").trim();
}

/** Rollierendes Transkript für die Extraktion (letzte Abschnitte, längenbegrenzt). */
export function buildRollingTranscript(
  chunks: string[],
  maxChars = DEFAULT_MAX_CHARS
): string {
  const stitched = stitchTranscriptChunks(chunks);
  if (stitched.length <= maxChars) return stitched;
  return stitched.slice(stitched.length - maxChars).trim();
}

/** Gesamtes Sitzungs-Transkript ohne Längenbegrenzung (für Schlussprüfung). */
export function buildFullTranscript(chunks: string[]): string {
  return stitchTranscriptChunks(chunks);
}
