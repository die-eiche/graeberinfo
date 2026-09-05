/**
 * Tests für Pausen-Schnitt und Transkript-Stitching.
 * npx --yes tsx scripts/test_segment_transcript.ts
 */
import {
  evaluateSegmentCut,
  FALLBACK_SEGMENT_MS,
  MAX_SEGMENT_MS,
  MIN_SEGMENT_MS,
  SILENCE_DBFS,
  SILENCE_HOLD_MS,
} from "../src/services/segmentPolicy";
import {
  appendTranscriptChunk,
  buildRollingTranscript,
  findTranscriptOverlap,
  stitchTranscriptChunks,
} from "../src/services/transcriptBuffer";

let failed = 0;
function assert(cond: unknown, msg: string) {
  if (!cond) {
    failed += 1;
    console.error("FAIL:", msg);
  } else {
    console.log("ok:", msg);
  }
}

// Zu früh: nie schneiden
assert(
  evaluateSegmentCut({ durationMillis: 2000, metering: SILENCE_DBFS - 5 }, null, 1000).shouldCut === false,
  "vor MIN keine Schnitt"
);

// Stille starten
const start = evaluateSegmentCut(
  { durationMillis: MIN_SEGMENT_MS + 500, metering: SILENCE_DBFS - 1 },
  null,
  10_000
);
assert(start.shouldCut === false && start.nextSilenceSinceMs === 10_000, "Stille beginnt zu zählen");

// Stille gehalten
const held = evaluateSegmentCut(
  { durationMillis: MIN_SEGMENT_MS + 1500, metering: SILENCE_DBFS - 1 },
  10_000,
  10_000 + SILENCE_HOLD_MS
);
assert(held.shouldCut === true, "nach Stille-Hold schneiden");

// Sprache setzt Stille zurück
const speech = evaluateSegmentCut(
  { durationMillis: MIN_SEGMENT_MS + 1500, metering: -10 },
  10_000,
  10_500
);
assert(speech.shouldCut === false && speech.nextSilenceSinceMs === null, "Sprache bricht Stille ab");

// Max erzwingen
assert(
  evaluateSegmentCut({ durationMillis: MAX_SEGMENT_MS, metering: -10 }, null, 1).shouldCut === true,
  "MAX erzwingt Schnitt"
);

// Ohne Metering: Fallback
assert(
  evaluateSegmentCut({ durationMillis: FALLBACK_SEGMENT_MS, metering: undefined }, null, 1).shouldCut ===
    true,
  "ohne Metering Fallback-Dauer"
);

assert(findTranscriptOverlap("mein name ist thomas ber", "ber und ich wohne in eutin") >= 3, "Overlap findet ber");
assert(
  stitchTranscriptChunks(["Mein Name ist Thomas Ber", "Berger und ich wohne in Eutin"]).includes(
    "Thomas Berger"
  ),
  "Stitch fügt an Schnittstelle zusammen"
);

const chunks = appendTranscriptChunk([], "Eins.");
const chunks2 = appendTranscriptChunk(chunks, "Zwei.");
const chunks3 = appendTranscriptChunk(chunks2, "Drei.");
const chunks4 = appendTranscriptChunk(chunks3, "Vier.");
assert(chunks4.length === 3 && chunks4[0] === "Zwei.", "Chunk-Historie begrenzt");
assert(buildRollingTranscript(["Hallo", "Welt"]).includes("Hallo Welt"), "Rolling baut Text");

if (failed) {
  console.error(`\n${failed} fehlgeschlagen`);
  process.exit(1);
}
console.log("\nAlle Segment/Transkript-Tests ok");
