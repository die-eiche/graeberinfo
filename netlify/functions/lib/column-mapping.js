/**
 * Maps common German Excel column headers to DataModel property names.
 * Unknown columns are kept under their original header name.
 */
const COLUMN_ALIASES = {
  grab: 'grave',
  grabstellen: 'burialPlotCount',
  bemerkung: 'remark',
  artikelnummer: 'itemNo',
  'preis / jahr': 'pricePerYear',
  'preis/jahr': 'pricePerYear',
  preis: 'pricePerYear',
  sonderpreis: 'specialPrice',
  auftrag: 'orderNo',
  auftragsnummer: 'orderNo',
  kreditor: 'creditorNo',
  kreditorennummer: 'creditorNo',
  'gemietet von': 'rentalFrom',
  'belegt ab': 'occupiedFrom',
  'gemietet bis': 'rentalUntil',
  verstorbener: 'deceasedName',
  name: 'deceasedName',
  geburtsdatum: 'dateOfBirth',
  sterbedatum: 'dateOfDeath',

  grave: 'grave',
  burialplotcount: 'burialPlotCount',
  remark: 'remark',
  itemno: 'itemNo',
  priceperyear: 'pricePerYear',
  specialprice: 'specialPrice',
  orderno: 'orderNo',
  creditorno: 'creditorNo',
  rentalfrom: 'rentalFrom',
  occupiedfrom: 'occupiedFrom',
  rentaluntil: 'rentalUntil',
  deceasedname: 'deceasedName',
  dateofbirth: 'dateOfBirth',
  dateofdeath: 'dateOfDeath'
};

const NUMERIC_FIELDS = new Set([
  'burialPlotCount',
  'pricePerYear',
  'specialPrice',
  'orderNo',
  'creditorNo'
]);

function normalizeHeader(header) {
  return String(header || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function mapHeader(header) {
  const normalized = normalizeHeader(header);
  return COLUMN_ALIASES[normalized] || String(header || '').trim();
}

function coerceValue(fieldName, value) {
  if (value === null || value === undefined || value === '') {
    return NUMERIC_FIELDS.has(fieldName) ? 0 : '';
  }

  if (NUMERIC_FIELDS.has(fieldName)) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value).trim();
}

function mapRow(row) {
  const mapped = {};

  for (const [header, value] of Object.entries(row)) {
    const fieldName = mapHeader(header);
    mapped[fieldName] = coerceValue(fieldName, value);
  }

  return mapped;
}

module.exports = {
  COLUMN_ALIASES,
  mapHeader,
  mapRow
};
