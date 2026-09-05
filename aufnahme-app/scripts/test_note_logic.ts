/**
 * Schnelltests für Merge + Grab-Logik (ohne Jest).
 * Ausführen: cd aufnahme-app && node --experimental-strip-types scripts/test_note_logic.ts
 */
import {
  applyAllowedValueRules,
  normalizeGraveValue,
  resolveGraveFromTranscript,
  UNCERTAIN_MARK,
} from "../src/services/allowedValues";
import { buildNoteTableRows, parseNoteFields } from "../src/services/discoveries";
import { mergeNoteMarkdown, titleFromMieter } from "../src/services/noteMerge";

let failed = 0;

function assert(cond: unknown, msg: string) {
  if (!cond) {
    failed += 1;
    console.error("FAIL:", msg);
  } else {
    console.log("ok:", msg);
  }
}

const prev = `Aufnahme

| Feld | Wert |
|---|---|
| Mieter Vorname | Max |
| Mieter Nachname | Mustermann |
| Mieter Verwandtschaftsverhältnis zum Verstorbenen | Sohn |
| Mieter Straße |  |
| Mieter PLZ Ort |  |
| Mieter Telefon 1 |  |
| Mieter Telefon 2 |  |
| Mieter E-Mail |  |
| Mieter Überweisung oder SEPA |  |
| Mieter IBAN |  |
| Mieter Kontoinhaber |  |
| Verstorbener Vorname |  |
| Verstorbener Nachname |  |
| Verstorbener Straße |  |
| Verstorbener PLZ Ort |  |
| Verstorbener Geburtstag |  |
| Verstorbener Todestag |  |
| Bestatter |  |
| Bestatter-Aufwand |  |
| Grab |  |
| Urne |  |
| TF-Wunschtermin |  |
| TF-Ideen |  |
`;

const incoming = `Aufnahme

| Feld | Wert |
|---|---|
| Mieter Vorname | Thomas |
| Mieter Nachname | Berger |
| Mieter Verwandtschaftsverhältnis zum Verstorbenen |  |
| Mieter Straße |  |
| Mieter PLZ Ort |  |
| Mieter Telefon 1 |  |
| Mieter Telefon 2 |  |
| Mieter E-Mail |  |
| Mieter Überweisung oder SEPA |  |
| Mieter IBAN |  |
| Mieter Kontoinhaber |  |
| Verstorbener Vorname |  |
| Verstorbener Nachname |  |
| Verstorbener Straße |  |
| Verstorbener PLZ Ort |  |
| Verstorbener Geburtstag |  |
| Verstorbener Todestag |  |
| Bestatter |  |
| Bestatter-Aufwand |  |
| Grab |  |
| Urne |  |
| TF-Wunschtermin |  |
| TF-Ideen |  |
`;

const merged = mergeNoteMarkdown(prev, incoming);
const fields = parseNoteFields(merged);
assert(fields["Mieter Vorname"] === "Thomas", "expliziter Mieter überschreibt Vorname");
assert(fields["Mieter Nachname"] === "Berger", "expliziter Mieter überschreibt Nachname");
assert(fields["Mieter Verwandtschaftsverhältnis zum Verstorbenen"] === "Sohn", "leeres Segment löscht Verwandtschaft nicht");
assert(titleFromMieter(fields) === "Berger, Thomas", "Titel aus korrigiertem Mieter");

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

const emptySeg = `Aufnahme

| Feld | Wert |
|---|---|
| Mieter Vorname |  |
| Mieter Nachname |  |
| Mieter Verwandtschaftsverhältnis zum Verstorbenen |  |
| Mieter Straße |  |
| Mieter PLZ Ort |  |
| Mieter Telefon 1 |  |
| Mieter Telefon 2 |  |
| Mieter E-Mail |  |
| Mieter Überweisung oder SEPA |  |
| Mieter IBAN |  |
| Mieter Kontoinhaber |  |
| Verstorbener Vorname |  |
| Verstorbener Nachname |  |
| Verstorbener Straße |  |
| Verstorbener PLZ Ort |  |
| Verstorbener Geburtstag |  |
| Verstorbener Todestag |  |
| Bestatter |  |
| Bestatter-Aufwand |  |
| Grab |  |
| Urne |  |
| TF-Wunschtermin |  |
| TF-Ideen |  |
`;

const withGrave = applyAllowedValueRules(emptySeg, "Die Grabnummer ist 8.88.88.88");
assert(parseNoteFields(withGrave)["Grab"] === UNCERTAIN_MARK, "KI leer + Transkript ungültig → Grab=?");

const rows = buildNoteTableRows(withGrave);
const grabRow = rows.find((r) => r.field === "Grab");
assert(grabRow?.uncertain === true, "Grab-Zeile uncertain für roten Punkt");
assert(grabRow?.value === "?", "Grab-Wert zeigt ?");

if (failed > 0) {
  console.error(`\n${failed} Test(s) fehlgeschlagen`);
  process.exit(1);
}
console.log("\nAlle Tests ok");
