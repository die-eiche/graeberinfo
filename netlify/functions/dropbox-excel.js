const XLSX = require('xlsx');
const { mapRow } = require('./lib/column-mapping');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS'
};

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify(body)
  };
}

async function downloadFromDropbox(accessToken, filePath) {
  const response = await fetch('https://content.dropboxapi.com/2/files/download', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Dropbox-API-Arg': JSON.stringify({ path: filePath })
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Dropbox-Download fehlgeschlagen (${response.status}): ${errorText}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

function parseWorkbook(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error('Die Excel-Datei enthält keine Arbeitsblätter.');
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
  const columns = rows.length
    ? Object.keys(rows[0])
    : XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })[0] || [];

  return {
    sheetName,
    columns,
    rows,
    mappedRows: rows.map(mapRow)
  };
}

exports.handler = async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: ''
    };
  }

  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { error: 'Nur GET-Anfragen werden unterstützt.' });
  }

  const accessToken = process.env.DROPBOX_ACCESS_TOKEN;
  const filePath = process.env.DROPBOX_FILE_PATH;

  if (!accessToken || !filePath) {
    return jsonResponse(500, {
      error: 'Dropbox ist nicht konfiguriert.',
      hint: 'Setzen Sie DROPBOX_ACCESS_TOKEN und DROPBOX_FILE_PATH als Umgebungsvariablen in Netlify.'
    });
  }

  try {
    const fileBuffer = await downloadFromDropbox(accessToken, filePath);
    const parsed = parseWorkbook(fileBuffer);

    return jsonResponse(200, {
      source: 'dropbox',
      filePath,
      ...parsed,
      rowCount: parsed.rows.length,
      fetchedAt: new Date().toISOString()
    });
  } catch (error) {
    return jsonResponse(500, {
      error: error.message || 'Unbekannter Fehler beim Lesen der Excel-Datei.'
    });
  }
};
