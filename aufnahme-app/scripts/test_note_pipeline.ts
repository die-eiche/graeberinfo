/**
 * Pipeline-Architektur: Extract → Validate/Normalize → Commit.
 * npx --yes tsx scripts/test_note_pipeline.ts
 */
import { NOTE_PIPELINE_STAGES, runNotePipeline } from "../src/services/notePipeline";
import { parseNoteFields } from "../src/services/discoveries";
import { emptyNoteMarkdown, renderNoteMarkdown } from "../src/services/noteMerge";

let failed = 0;
function assert(cond: unknown, msg: string) {
  if (!cond) {
    failed += 1;
    console.error("FAIL:", msg);
  } else console.log("ok:", msg);
}

async function main() {
  assert(NOTE_PIPELINE_STAGES.length >= 6, "feste Pipeline-Stufen vorhanden");
  assert(
    NOTE_PIPELINE_STAGES.join(">") ===
      "ground_incoming>merge_allowed_values>enrich_dates>rescue_roles>clear_ungrounded_full>same_address>openplz_street_plz",
    "Stufenreihenfolge stabil"
  );

  const raw = renderNoteMarkdown({
    "Verstorbener Vorname": "Anna",
    "Verstorbener Todestag": "29.05.2026",
    Grab: "?",
    Urne: "?",
    Bestatter: "",
    "Mieter Verwandtschaftsverhältnis zum Verstorbenen": "Söhnlein",
    "Mieter Straße": "Untertrafe 7",
    "Mieter PLZ Ort": "Lübeck",
    "TF-Wunschtermin": "09.09.2026",
  });

  const now = new Date("2026-09-05T12:00:00");
  const transcript =
    "Die Verstorbene ist vorgestern verstorben. Bestatter Söhnlein. " +
    "Trauerfeier am übernächsten Sonntag, also den 13. " +
    "Adresse An der Untertrave in Lübeck.";

  const snap = await runNotePipeline({
    rawMarkdown: raw,
    transcript,
    previousNote: emptyNoteMarkdown(),
    now,
    mode: "segment",
  });
  const fields = parseNoteFields(snap.noteMarkdown);

  assert(!fields["Verstorbener Vorname"], "Halluzination Anna ohne Beleg entfernt");
  assert(!fields["Verstorbener Nachname"], "kein Pseudo-Name aus vorgestern/verstorben");
  assert(!fields.Grab, "Grab ohne Erwähnung entfernt");
  assert(!fields.Urne, "Urne ohne Erwähnung entfernt");
  assert(fields.Bestatter === "Söhnlein", "Bestatter aus Transkript gerettet");
  assert(
    !fields["Mieter Verwandtschaftsverhältnis zum Verstorbenen"],
    "Bestatter nicht in Verwandtschaft"
  );
  assert(fields["Verstorbener Todestag"] === "03.09.2026", "vorgestern deterministisch");
  assert(fields["TF-Wunschtermin"] === "13.09.2026", "übernächster Sonntag deterministisch");
  assert(
    fields["Mieter Straße"] === "An der Untertrave 7",
    "Straße via OpenPLZ kanonisiert"
  );
  assert(fields["Mieter PLZ Ort"].startsWith("23552"), "PLZ via OpenPLZ gesetzt");

  // Regression: bereits korrekte Werte dürfen durch ein späteres Segment nicht geleert werden
  const previous = renderNoteMarkdown({
    "Mieter Vorname": "Thomas",
    "Mieter Nachname": "Berger",
    "Verstorbener Vorname": "Anna",
    "Verstorbener Nachname": "Berger",
    Grab: "1.01.01.01",
    Bestatter: "Söhnlein",
  });
  const laterSegment = renderNoteMarkdown({
    "TF-Wunschtermin": "20.09.2026",
    // Modell halluziniert leeren/anderen Kram nicht – aber nennt die alten Namen nicht erneut
  });
  const laterTranscript =
    "Die Trauerfeier soll am 20. September stattfinden."; // ohne Namen/Grab
  const preserved = await runNotePipeline({
    rawMarkdown: laterSegment,
    transcript: laterTranscript,
    previousNote: previous,
    now,
    mode: "segment",
  });
  const kept = parseNoteFields(preserved.noteMarkdown);
  assert(kept["Mieter Vorname"] === "Thomas", "Segment-Mode: Mieter Vorname bleibt");
  assert(kept["Mieter Nachname"] === "Berger", "Segment-Mode: Mieter Nachname bleibt");
  assert(kept["Verstorbener Vorname"] === "Anna", "Segment-Mode: Verstorbener Vorname bleibt");
  assert(kept.Grab === "1.01.01.01", "Segment-Mode: Grab bleibt");
  assert(kept.Bestatter === "Söhnlein", "Segment-Mode: Bestatter bleibt");
  assert(kept["TF-Wunschtermin"] === "20.09.2026", "neues Segment aktualisiert TF");

  // Full-Mode: unbelegte Halluzination gegen Gesamttranskript streichen
  const hallucinated = renderNoteMarkdown({
    "Mieter Vorname": "Thomas",
    "Verstorbener Vorname": "Anna",
    Grab: "?",
  });
  const full = await runNotePipeline({
    rawMarkdown: emptyNoteMarkdown(),
    transcript: "Der Mieter ist Thomas Berger. Bestatter Söhnlein.",
    previousNote: hallucinated,
    now,
    mode: "full",
  });
  const fullFields = parseNoteFields(full.noteMarkdown);
  assert(fullFields["Mieter Vorname"] === "Thomas", "Full-Mode: belegter Mieter bleibt");
  assert(!fullFields["Verstorbener Vorname"], "Full-Mode: unbelegte Anna entfernt");
  assert(!fullFields.Grab, "Full-Mode: unbelegtes Grab entfernt");

  if (failed) {
    console.error(`\n${failed} fehlgeschlagen`);
    process.exit(1);
  }
  console.log("\nPipeline-Tests ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
