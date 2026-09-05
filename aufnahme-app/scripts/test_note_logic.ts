/**
 * Schnelltests für Merge, Grab- und PLZ-Logik (ohne Jest).
 * Ausführen: cd aufnahme-app && npx --yes tsx scripts/test_note_logic.ts
 */
import {
  applyAllowedValueRules,
  normalizeGraveValue,
  resolveGraveFromTranscript,
  UNCERTAIN_MARK,
} from "../src/services/allowedValues";
import { buildNoteTableRows, parseNoteFields } from "../src/services/discoveries";
import {
  emptyNoteMarkdown,
  mergeNoteMarkdown,
  renderNoteMarkdown,
  titleFromMieter,
} from "../src/services/noteMerge";
import {
  enrichNotePostalCodes,
  normalizeLocalityQuery,
  normalizeStreetForLookup,
  parsePlzOrt,
  resolveLocalityNamesFromOpenPlz,
} from "../src/services/postalCode";

let failed = 0;

function assert(cond: unknown, msg: string) {
  if (!cond) {
    failed += 1;
    console.error("FAIL:", msg);
  } else {
    console.log("ok:", msg);
  }
}

function noteWith(values: Record<string, string>): string {
  return renderNoteMarkdown(values);
}

async function main() {
  const prev = noteWith({
    "Mieter Vorname": "Max",
    "Mieter Nachname": "Mustermann",
    "Mieter Verwandtschaftsverhältnis zum Verstorbenen": "Sohn",
  });
  const incoming = noteWith({
    "Mieter Vorname": "Thomas",
    "Mieter Nachname": "Berger",
  });
  const merged = mergeNoteMarkdown(prev, incoming);
  const fields = parseNoteFields(merged);
  assert(fields["Mieter Vorname"] === "Thomas", "expliziter Mieter überschreibt Vorname");
  assert(fields["Mieter Nachname"] === "Berger", "expliziter Mieter überschreibt Nachname");
  assert(
    fields["Mieter Verwandtschaftsverhältnis zum Verstorbenen"] === "Sohn",
    "leeres Segment löscht Verwandtschaft nicht"
  );
  assert(titleFromMieter(fields) === "Berger, Thomas", "Titel aus korrigiertem Mieter");

  const prevMore = noteWith({
    "Mieter Straße": "Falschestr. 1",
    "Mieter PLZ Ort": "11111 Falschstadt",
    "Mieter Telefon 1": "012345",
    "Mieter E-Mail": "alt@example.com",
    "Mieter Überweisung oder SEPA": "Überweisung",
    Bestatter: "Altbestatter",
    Grab: "1.01.01.01",
  });
  const corrMore = noteWith({
    "Mieter Straße": "Bahnhofstr. 12",
    "Mieter PLZ Ort": "Eutin",
    "Mieter Telefon 1": "0452123456",
    "Mieter E-Mail": "neu@example.com",
    "Mieter Überweisung oder SEPA": "SEPA",
    Bestatter: "Schäfer",
    Grab: "2.02.02.02",
  });
  const corrFields = parseNoteFields(mergeNoteMarkdown(prevMore, corrMore));
  assert(corrFields["Mieter Straße"] === "Bahnhofstr. 12", "Straße-Korrektur überschreibt");
  assert(corrFields["Mieter Telefon 1"] === "0452123456", "Telefon-Korrektur überschreibt");
  assert(corrFields["Mieter E-Mail"] === "neu@example.com", "E-Mail-Korrektur überschreibt");
  assert(corrFields["Mieter Überweisung oder SEPA"] === "SEPA", "Zahlungsart-Korrektur überschreibt");
  assert(corrFields["Bestatter"] === "Schäfer", "Bestatter-Korrektur überschreibt");
  assert(corrFields["Grab"] === "2.02.02.02", "Grab-Korrektur überschreibt");

  assert(normalizeGraveValue("9.99.99.99") === UNCERTAIN_MARK, "ungültige Grabnummer → ?");
  assert(normalizeGraveValue("1.01.01.01") === "1.01.01.01", "gültige Grabnummer bleibt");
  assert(normalizeGraveValue("1010101") === "1.01.01.01", "Punkte ergänzen + Listen-Treffer");

  assert(
    resolveGraveFromTranscript("Die Grabnummer ist 9.99.99.99") === UNCERTAIN_MARK,
    "Transkript: unbekannte Grabnummer → ?"
  );
  assert(
    resolveGraveFromTranscript("Wir nehmen Grab 1.01.01.01") === "1.01.01.01",
    "Transkript: gültige Grabnummer"
  );
  assert(
    resolveGraveFromTranscript("Meine Telefonnummer ist 040123456") === null,
    "Telefon ohne Grab-Kontext → kein Grab"
  );
  assert(
    resolveGraveFromTranscript("Die Grabnummer habe ich gesagt") === UNCERTAIN_MARK,
    "Grabnummer erwähnt ohne klare Nummer → ?"
  );
  assert(
    resolveGraveFromTranscript("Wir waren gestern am Grab") === null,
    "bloßes „am Grab“ ohne Nummer → kein Marker"
  );

  const withGrave = applyAllowedValueRules(emptyNoteMarkdown(), "Die Grabnummer ist 8.88.88.88");
  assert(parseNoteFields(withGrave)["Grab"] === UNCERTAIN_MARK, "KI leer + Transkript ungültig → Grab=?");
  const grabRow = buildNoteTableRows(withGrave).find((r) => r.field === "Grab");
  assert(grabRow?.uncertain === true, "Grab-Zeile uncertain für roten Punkt");
  assert(grabRow?.value === "", "Grab-Wert leer, Unsicherheit nur als Punkt");

  assert(normalizeStreetForLookup("Bahnhofstraße 12") === "Bahnhofstr.", "Straße normalisieren");
  assert(parsePlzOrt("Eutin").ort === "Eutin" && parsePlzOrt("Eutin").plz === "", "nur Ort parsen");
  assert(parsePlzOrt("23701 Eutin").plz === "23701", "PLZ+Ort parsen");

  const enriched = await enrichNotePostalCodes(
    noteWith({
      "Mieter Straße": "Bahnhofstraße 12",
      "Mieter PLZ Ort": "Eutin",
    })
  );
  assert(
    parseNoteFields(enriched)["Mieter PLZ Ort"] === "23701 Eutin",
    "PLZ aus Straße+Ort ermittelt"
  );

  // falsche PLZ korrigieren
  const fixed = await enrichNotePostalCodes(
    noteWith({
      "Mieter Straße": "Bahnhofstraße 12",
      "Mieter PLZ Ort": "11111 Eutin",
    })
  );
  assert(
    parseNoteFields(fixed)["Mieter PLZ Ort"] === "23701 Eutin",
    "falsche PLZ anhand Straße+Ort korrigiert"
  );

  assert(normalizeLocalityQuery("in Eutin") === "Eutin", "Ort-Präfix entfernen");
  assert(
    (await resolveLocalityNamesFromOpenPlz("Eutin")).includes("Eutin"),
    "OpenPLZ kennt Ort Eutin"
  );

  // Ort mit Präposition / unscharfer Form + Straße → PLZ nachziehen
  const softOrt = await enrichNotePostalCodes(
    noteWith({
      "Mieter Straße": "Bahnhofstraße 12",
      "Mieter PLZ Ort": "in Eutin",
    })
  );
  assert(
    parseNoteFields(softOrt)["Mieter PLZ Ort"] === "23701 Eutin",
    "PLZ aus Straße + unscharfem Ort via OpenPLZ"
  );


  if (failed > 0) {
    console.error(`\n${failed} Test(s) fehlgeschlagen`);
    process.exit(1);
  }
  console.log("\nAlle Tests ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
