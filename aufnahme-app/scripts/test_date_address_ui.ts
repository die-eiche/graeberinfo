/**
 * Tests: Jahresergänzung, Relativdaten, Bestatter-Rettung, gleiche Adresse, Unsicherheit.
 * npx --yes tsx scripts/test_date_address_ui.ts
 */
import { applySameAddressFromTenant, transcriptImpliesSameAddress } from "../src/services/addressInference";
import {
  enrichNoteDates,
  enrichPartialDate,
  resolveImpliedYear,
  resolveRelativeDateToken,
} from "../src/services/dateEnrichment";
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

if (failed) {
  console.error(`\n${failed} fehlgeschlagen`);
  process.exit(1);
}
console.log("\nAlle Date/Address/UI-Tests ok");
