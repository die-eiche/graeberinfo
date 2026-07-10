const express = require('express');
const { getExcelFilePath, readExcelFile } = require('./lib/excel-file');
const { parseDutySchedule } = require('./lib/dienstplan');

const app = express();
const port = Number(process.env.PORT || 3080);
const dayCount = Number(process.env.DAY_COUNT || 10);

let cachedResult = null;
let cachedAt = 0;
const cacheMs = Number(process.env.CACHE_MS || 5 * 60 * 1000);

app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    excelFile: getExcelFilePath()
  });
});

app.get('/api/dienste', (_req, res) => {
  try {
    const now = Date.now();
    if (!cachedResult || now - cachedAt > cacheMs) {
      const buffer = readExcelFile();
      cachedResult = {
        ...parseDutySchedule(buffer, dayCount),
        source: 'local',
        excelFile: getExcelFilePath()
      };
      cachedAt = now;
    }

    res.json(cachedResult);
  } catch (error) {
    res.status(500).json({
      error: error.message || 'Unbekannter Fehler'
    });
  }
});

app.listen(port, () => {
  console.log(`Ehrenamt-Abfrage läuft auf Port ${port}`);
  console.log(`Excel-Datei: ${getExcelFilePath()}`);
});
