/**
 * Tests: Jahresergänzung, Relativdaten, Bestatter-Rettung, gleiche Adresse, Unsicherheit.
 * npx --yes tsx scripts/test_date_address_ui.ts
 */
import { applySameAddressFromTenant, transcriptImpliesSameAddress } from "../src/services/addressInference";
import {
  enrichNoteDates,
  enrichPartialDate,
  resolveImpliedYear,
  resolveNthWeekday,
  resolveRelativeDateToken,
} from "../src/services/dateEnrichment";
import { clearUngroundedFields } from "../src/services/fieldGrounding";
import { buildNoteTableRows } from "../src/services/discoveries";
import {
  extractUndertakerFromTranscript,
  rescueMisplacedFields,
} from "../src/services/fieldRescue";
import { renderNoteMarkdown } from "../src/services/noteMerge";

let failed = 0;
function assert(cond: unknown, msg: string) {
  if (!cond) {
    failed += 1;
    console.error("FAIL:", msg);
  } else console.log("ok:", msg);
}

const now = new Date("2026-09-05T12:00:00");
assert(enrichPartialDate("15.03.", now) === "15.03.2026", "Tag.Monat. → aktuelles Jahr");
assert(enrichPartialDate("15. März", now) === "15.03.2026", "Tag Monat → aktuelles Jahr");
assert(resolveRelativeDateToken("vorgestern", now) === "03.09.2026", "vorgestern → 03.09.2026");
assert(enrichPartialDate("vorgestern", now) === "03.09.2026", "Feldwert vorgestern aufgelöst");
assert(enrichPartialDate("1934-10-00", now) === "00.10.1934", "ISO mit Tag 00 → TT.MM.JJJJ");
assert(enrichPartialDate("1934-10-15", now) === "15.10.1934", "ISO-Datum → deutsches Format");
assert(enrichPartialDate("2026-09-03", now) === "03.09.2026", "ISO Todestag → TT.MM.JJJJ");
const birthday = enrichNoteDates({ "Verstorbener Geburtstag": "1934-10-00" }, now);
assert(birthday["Verstorbener Geburtstag"] === "00.10.1934", "Geburtstag in Notiz vereinheitlicht");


const nearNewYear = new Date("2026-12-20T12:00:00");
assert(resolveImpliedYear(1, 10, nearNewYear) >= 2026, "Jahreswechsel: Jan-Datum aus Dez");

const nearJan = new Date("2026-01-10T12:00:00");
assert(resolveImpliedYear(12, 15, nearJan) === 2025, "Jahreswechsel: Dez-Datum aus Jan → Vorjahr");

assert(
  transcriptImpliesSameAddress("Der Verstorbene hatte die gleiche Adresse wie der Mieter."),
  "gleiche Adresse erkannt"
);

const fields = applySameAddressFromTenant(
  {
    "Mieter Straße": "Bahnhofstr. 1",
    "Mieter PLZ Ort": "23701 Eutin",
  },
  "Verstorbener wohnte auch dort, gleiche Adresse."
);
assert(fields["Verstorbener Straße"] === "Bahnhofstr. 1", "Straße übernommen");
assert(fields["Verstorbener PLZ Ort"] === "23701 Eutin", "PLZ Ort übernommen");

const dated = enrichNoteDates({ "Verstorbener Todestag": "3.1.", "TF-Wunschtermin": "20. Februar" }, now);
assert(dated["Verstorbener Todestag"] === "03.01.2026", "Todestag Jahr ergänzt");
assert(dated["TF-Wunschtermin"] === "20.02.2026", "TF-Termin Jahr ergänzt");

// Relativangabe im Transkript überschreibt falsches KI-Datum
const deathFixed = enrichNoteDates(
  { "Verstorbener Todestag": "29.05.2026" },
  now,
  "Die Verstorbene ist vorgestern verstorben und der Bestatter heißt Söhnlein."
);
assert(deathFixed["Verstorbener Todestag"] === "03.09.2026", "vorgestern überschreibt falsches Datum");

assert(
  extractUndertakerFromTranscript("bestatter söhnlein") === "Söhnlein",
  "Bestatter aus Kleinbuchstaben-ASR"
);
assert(
  extractUndertakerFromTranscript("Der Bestatter heißt Söhnlein.") === "Söhnlein",
  "Bestatter heißt …"
);

const rescued = rescueMisplacedFields(
  {
    "Mieter Verwandtschaftsverhältnis zum Verstorbenen": "Söhnlein",
    Bestatter: "",
  },
  "vorgestern verstorben, Bestatter Söhnlein"
);
assert(rescued.Bestatter === "Söhnlein", "Bestatter gerettet");
assert(
  !rescued["Mieter Verwandtschaftsverhältnis zum Verstorbenen"],
  "falsche Verwandtschaft entfernt"
);

const md = renderNoteMarkdown({ Grab: "?", "Mieter Vorname": "Thomas" });
const rows = buildNoteTableRows(md);
const grab = rows.find((r) => r.field === "Grab");
const vor = rows.find((r) => r.field === "Mieter Vorname");
assert(grab?.uncertain === true && grab.value === "", "Grab: roter Punkt, kein ?-Text");
assert(vor?.value === "Thomas" && vor.uncertain === false, "Name normal sichtbar");


assert(resolveNthWeekday("Sonntag", "after-next", now) === "13.09.2026", "übernächster Sonntag ab Sa 05.09. → 13.09.");
assert(resolveNthWeekday("Sonntag", "next", now) === "06.09.2026", "nächster Sonntag ab Sa 05.09. → 06.09.");

const tfFixed = enrichNoteDates(
  { "TF-Wunschtermin": "09.09.2026" },
  now,
  "Trauerfeier am übernächsten Sonntag, also den 13."
);
assert(tfFixed["TF-Wunschtermin"] === "13.09.2026", "übernächster Sonntag überschreibt 09.09.");

assert(
  !clearUngroundedFields(
    { Grab: "?", Urne: "?", "Verstorbener Vorname": "Anna" },
    "Die Verstorbene ist vorgestern verstorben, Bestatter Söhnlein, übernächsten Sonntag den 13."
  )["Grab"],
  "Grab ohne Erwähnung entfernt"
);
assert(
  !clearUngroundedFields(
    { Grab: "?", Urne: "Patera gold", "Verstorbener Vorname": "Anna" },
    "Die Verstorbene ist vorgestern verstorben, Bestatter Söhnlein."
  )["Urne"],
  "Urne ohne Erwähnung entfernt"
);
assert(
  !clearUngroundedFields(
    { "Verstorbener Vorname": "Anna" },
    "Die Verstorbene ist vorgestern verstorben."
  )["Verstorbener Vorname"],
  "Anna ohne Erwähnung entfernt"
);
assert(
  clearUngroundedFields(
    { Grab: "2.01.01.01", Urne: "Patera gold" },
    "Grab 2.01.01.01 und Urne Patera gold"
  )["Grab"] === "2.01.01.01",
  "Grab mit Erwähnung bleibt"
);

if (failed) {
  console.error(`\n${failed} fehlgeschlagen`);
  process.exit(1);
}
console.log("\nAlle Date/Address/UI-Tests ok");
