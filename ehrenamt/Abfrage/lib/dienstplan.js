const XLSX = require('xlsx');

const TIME_ZONE = process.env.TZ || 'Europe/Berlin';
const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

function getLocalToday(timeZone = TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());

  const year = Number(parts.find(part => part.type === 'year').value);
  const month = Number(parts.find(part => part.type === 'month').value);
  const day = Number(parts.find(part => part.type === 'day').value);

  return new Date(year, month - 1, day);
}

function getLocalDayKey(date = new Date(), timeZone = TIME_ZONE) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

function isFilled(value) {
  if (value === null || value === undefined) {
    return false;
  }

  return String(value).trim() !== '';
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function formatGermanDate(date) {
  return `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}.${date.getFullYear()}`;
}

function buildDateHeaderVariants(date) {
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const dayPadded = pad2(day);
  const monthPadded = pad2(month);

  return new Set([
    `${dayPadded}.${monthPadded}.`,
    `${day}.${month}.`,
    `${dayPadded}/${monthPadded}/`,
    `${day}/${month}/`,
    `${dayPadded}.${monthPadded}`,
    `${day}.${month}`,
    `${dayPadded}/${monthPadded}`,
    `${day}/${month}`
  ]);
}

function normalizeHeader(header) {
  return String(header || '').trim().toLowerCase();
}

function findColumnIndex(headers, variants) {
  for (let index = 0; index < headers.length; index += 1) {
    const header = String(headers[index] || '').trim();
    if (variants.has(header) || variants.has(header.replace(/\s+/g, ''))) {
      return index;
    }
  }

  return -1;
}

function findRequiredColumnIndex(headers, expectedName) {
  const normalizedExpected = normalizeHeader(expectedName);

  for (let index = 0; index < headers.length; index += 1) {
    if (normalizeHeader(headers[index]) === normalizedExpected) {
      return index;
    }
  }

  return -1;
}

function getCategories(row, schluesselIndex, bereitschaftIndex) {
  const categories = [];

  if (schluesselIndex >= 0 && isFilled(row[schluesselIndex])) {
    categories.push('Schlüssel');
  }

  if (bereitschaftIndex >= 0 && isFilled(row[bereitschaftIndex])) {
    categories.push('Bereitschaft');
  }

  return categories;
}

function formatPerson(name, categories) {
  if (!categories.length) {
    return name;
  }

  return `${name} (${categories.join(', ')})`;
}

function sheetToMatrix(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    return null;
  }

  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    raw: false
  });
}

function getNextDays(count, startDate = getLocalToday()) {
  const days = [];
  const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());

  for (let offset = 0; offset < count; offset += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + offset);
    days.push(date);
  }

  return days;
}

function buildDayEntry(date, matrix) {
  const sheetName = String(date.getFullYear());
  const headers = matrix?.[0] || [];
  const rows = matrix?.slice(1) || [];

  if (!headers.length) {
    return {
      weekday: WEEKDAYS[date.getDay()],
      date: formatGermanDate(date),
      sheetName,
      staff: [],
      note: `Arbeitsblatt "${sheetName}" nicht gefunden oder leer.`
    };
  }

  const dateVariants = buildDateHeaderVariants(date);
  const dateColumnIndex = findColumnIndex(headers, dateVariants);
  const nameIndex = findRequiredColumnIndex(headers, 'Name');
  const schluesselIndex = findRequiredColumnIndex(headers, 'Schlüssel');
  const bereitschaftIndex = findRequiredColumnIndex(headers, 'Bereitschaft');

  if (dateColumnIndex < 0) {
    return {
      weekday: WEEKDAYS[date.getDay()],
      date: formatGermanDate(date),
      sheetName,
      staff: [],
      note: `Keine Datumsspalte für ${formatGermanDate(date)} im Blatt "${sheetName}" gefunden.`
    };
  }

  if (nameIndex < 0) {
    return {
      weekday: WEEKDAYS[date.getDay()],
      date: formatGermanDate(date),
      sheetName,
      staff: [],
      note: `Spalte "Name" im Blatt "${sheetName}" nicht gefunden.`
    };
  }

  const staff = [];

  for (const row of rows) {
    const name = String(row[nameIndex] || '').trim();
    if (!name) {
      continue;
    }

    if (!isFilled(row[dateColumnIndex])) {
      continue;
    }

    const categories = getCategories(row, schluesselIndex, bereitschaftIndex);
    staff.push(formatPerson(name, categories));
  }

  return {
    weekday: WEEKDAYS[date.getDay()],
    date: formatGermanDate(date),
    sheetName,
    staff,
    note: staff.length ? '' : 'Kein Dienst eingetragen.'
  };
}

function parseDutySchedule(buffer, dayCount = 10, startDate = getLocalToday()) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetCache = {};

  for (const sheetName of workbook.SheetNames) {
    sheetCache[sheetName] = sheetToMatrix(workbook, sheetName);
  }

  const days = getNextDays(dayCount, startDate).map(date => {
    const sheetName = String(date.getFullYear());
    return buildDayEntry(date, sheetCache[sheetName]);
  });

  return {
    generatedAt: new Date().toISOString(),
    timeZone: TIME_ZONE,
    fromDate: days[0]?.date || formatGermanDate(startDate),
    toDate: days[days.length - 1]?.date || formatGermanDate(startDate),
    dayCount,
    days
  };
}

module.exports = {
  getLocalToday,
  getLocalDayKey,
  parseDutySchedule
};
