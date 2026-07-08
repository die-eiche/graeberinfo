const express = require('express');
const path = require('path');
const { downloadExcelFile } = require('./lib/dropbox');
const { parseDutySchedule } = require('./lib/dienstplan');

const app = express();
const port = Number(process.env.PORT || 3080);
const dayCount = Number(process.env.DAY_COUNT || 10);

let cachedResult = null;
let cachedAt = 0;
const cacheMs = Number(process.env.CACHE_MS || 5 * 60 * 1000);

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/dienste', async (_req, res) => {
  try {
    const now = Date.now();
    if (!cachedResult || now - cachedAt > cacheMs) {
      const buffer = await downloadExcelFile();
      cachedResult = parseDutySchedule(buffer, dayCount);
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
  console.log(`Ehrenamt-Dienstplan läuft auf Port ${port}`);
});
