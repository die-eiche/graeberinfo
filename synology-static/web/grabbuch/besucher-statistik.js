/* Besucherstatistik: drei Wochentag-Stunden-Heatmaps (Hinterbliebene, Hausführung, Grabverkauf).
   Öffentlich, ohne Parameter u=2004. Demo-Daten bis 1.1.2027 00:00 Europe/Berlin.
   Jeder Eintrag ist genau eine Besuchergruppe. */
(function () {
  var PALETTE = [
    '#f8696b', '#f97b6e', '#fa8e72', '#fba075', '#fcb379',
    '#fdc57c', '#fed880', '#ffeb84', '#e9e583', '#d3df82',
    '#bdd881', '#a6d27f', '#90cb7e', '#7ac57d', '#63be7b'
  ];
  var WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  var HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
  var CUTOFF_MS = Date.parse('2027-01-01T00:00:00+01:00');
  var SNAPSHOT_KEY = 'eiche_besucher_snapshot_month';
  var CATEGORIES = [
    { key: 'hinterbliebene', label: 'Hinterbliebene' },
    { key: 'hausfuehrung', label: 'Hausführung' },
    { key: 'grabverkauf', label: 'Grabverkauf' }
  ];

  function normalizeKategorie(raw) {
    var k = String(raw || '').trim().toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
    if (k === 'hinterbliebene' || k === 'grabbesucher') return 'hinterbliebene';
    if (k === 'hausfuehrung' || k === 'hausfuhrung' || k === 'fuehrung') return 'hausfuehrung';
    if (k === 'grabverkauf' || k === 'interessenten' || k === 'interessent') return 'grabverkauf';
    return '';
  }

  function emptyCounts() {
    return { hinterbliebene: 0, hausfuehrung: 0, grabverkauf: 0 };
  }

  function countsFromRow(row) {
    var out = emptyCounts();
    var kat = normalizeKategorie(row.kategorie || row.label || '');
    var n = Math.max(0, parseInt(row.anzahl, 10) || 0);
    if (kat && n) {
      out[kat] = n;
      return out;
    }
    out.hinterbliebene = Math.max(0, parseInt(row.hinterbliebene != null ? row.hinterbliebene : row.grabbesucher, 10) || 0);
    out.hausfuehrung = Math.max(0, parseInt(row.hausfuehrung, 10) || 0);
    out.grabverkauf = Math.max(0, parseInt(row.grabverkauf != null ? row.grabverkauf : row.interessenten, 10) || 0);
    return out;
  }

  function berlinNow() {
    try {
      var s = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Berlin' });
      return new Date(s.replace(' ', 'T'));
    } catch (e) {
      return new Date();
    }
  }

  function cutoffReached() {
    return berlinNow().getTime() >= CUTOFF_MS;
  }

  function resourceUrl(rel) {
    try {
      return new URL(rel, window.location.href).toString();
    } catch (e) {
      return rel;
    }
  }

  function parseTs(raw) {
    var s = String(raw || '').trim().replace('T', ' ');
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2})/);
    if (m) {
      return {
        y: +m[1], mo: +m[2], d: +m[3], h: +m[4]
      };
    }
    m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})[ T](\d{1,2})/);
    if (m) {
      return {
        y: +m[3], mo: +m[2], d: +m[1], h: +m[4]
      };
    }
    return null;
  }

  function weekdayIndex(y, mo, d) {
    var js = new Date(y, mo - 1, d).getDay();
    return (js + 6) % 7;
  }

  function parseCsv(text) {
    var demo = /DEMO\s*=\s*1/i.test(text || '');
    var rows = [];
    var lines = String(text || '').replace(/^\uFEFF/, '').split(/\r\n|\n|\r/);
    var headerSeen = false;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var trim = line.trim();
      if (!trim || trim.charAt(0) === '#') continue;
      var parts = line.split(';');
      var first = (parts[0] || '').trim().toLowerCase();
      if (!headerSeen && (first === 'interessenten' || first === 'zeitstempel' || first === 'kategorie' || first === 'hinterbliebene')) {
        headerSeen = true;
        continue;
      }
      if (parts.length < 3) continue;
      var ts = parseTs(parts[parts.length - 1]);
      if (!ts) continue;
      if (ts.h < 8 || ts.h > 19) continue;
      var kat = normalizeKategorie(parts[0]);
      var counts = emptyCounts();
      if (kat) {
        counts[kat] = Math.max(0, parseInt(parts[1], 10) || 0);
      } else {
        counts.grabverkauf = Math.max(0, parseInt(parts[0], 10) || 0);
        counts.hinterbliebene = Math.max(0, parseInt(parts[1], 10) || 0);
      }
      if (!counts.hinterbliebene && !counts.hausfuehrung && !counts.grabverkauf) continue;
      rows.push({
        hinterbliebene: counts.hinterbliebene,
        hausfuehrung: counts.hausfuehrung,
        grabverkauf: counts.grabverkauf,
        y: ts.y, mo: ts.mo, d: ts.d, h: ts.h
      });
    }
    return { demo: demo, rows: rows };
  }

  function embeddedCsv() {
    var el = document.getElementById('besucher-data-csv');
    return el ? (el.textContent || '') : '';
  }

  function loadRows() {
    var local = parseCsv(embeddedCsv());
    if (window.location.protocol === 'file:') {
      return Promise.resolve(applyCutoff(local, 'eingebettet'));
    }
    var url = resourceUrl('besucher.php?action=load&_=' + Date.now());
    return fetch(url, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (json) {
      if (!json || !json.ok) throw new Error((json && json.error) || 'load');
      var rows = (json.rows || []).map(function (row) {
        var ts = parseTs(row.zeitstempel);
        if (!ts) return null;
        var counts = countsFromRow(row);
        return {
          hinterbliebene: counts.hinterbliebene,
          hausfuehrung: counts.hausfuehrung,
          grabverkauf: counts.grabverkauf,
          y: ts.y, mo: ts.mo, d: ts.d, h: ts.h
        };
      }).filter(Boolean);
      return applyCutoff({ demo: !!json.demo, rows: rows }, 'besucher.php');
    }).catch(function () {
      var csvUrl = resourceUrl('Historie/Besucher/besucher.csv?_=' + Date.now());
      return fetch(csvUrl, { cache: 'no-store' }).then(function (r) {
        if (!r.ok) throw new Error('csv ' + r.status);
        return r.text();
      }).then(function (text) {
        return applyCutoff(parseCsv(text), 'besucher.csv');
      }).catch(function () {
        return applyCutoff(local, 'eingebettet');
      });
    });
  }

  function applyCutoff(parsed, source) {
    if (parsed.demo && cutoffReached()) {
      return { demo: false, rows: [], source: source, wiped: true };
    }
    return { demo: parsed.demo, rows: parsed.rows, source: source, wiped: false };
  }

  function emptyGrid() {
    var g = [];
    for (var d = 0; d < 7; d++) {
      g[d] = [];
      for (var i = 0; i < HOURS.length; i++) g[d][HOURS[i]] = 0;
    }
    return g;
  }

  function aggregate(rows, field) {
    var grid = emptyGrid();
    var dates = [{}, {}, {}, {}, {}, {}, {}];
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var wd = weekdayIndex(row.y, row.mo, row.d);
      var val = row[field] || 0;
      grid[wd][row.h] += val;
      dates[wd][row.y + '-' + row.mo + '-' + row.d] = true;
    }
    var nDays = [];
    for (var d = 0; d < 7; d++) nDays[d] = Object.keys(dates[d]).length;
    return { grid: grid, nDays: nDays };
  }

  function dayAverage(grid, nDays, d) {
    if (!nDays[d]) return 0;
    var sum = 0;
    for (var i = 0; i < HOURS.length; i++) sum += grid[d][HOURS[i]];
    return sum / nDays[d];
  }

  function gridMax(grid) {
    var m = 0;
    for (var d = 0; d < 7; d++) {
      for (var i = 0; i < HOURS.length; i++) {
        if (grid[d][HOURS[i]] > m) m = grid[d][HOURS[i]];
      }
    }
    return m;
  }

  function colorFor(value, max) {
    if (max <= 0 || value <= 0) return PALETTE[PALETTE.length - 1];
    var t = value / max;
    if (t > 1) t = 1;
    var idx = Math.round((1 - t) * (PALETTE.length - 1));
    return PALETTE[idx];
  }

  function fmtAvg(n) {
    return n.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }

  function hourLabel(h) {
    var a = (h < 10 ? '0' : '') + h;
    var b = ((h + 1) < 10 ? '0' : '') + (h + 1);
    return a + '–' + b;
  }

  function renderHeatmap(container, agg, title) {
    var max = gridMax(agg.grid);
    var html = '<div class="visitor-heatmap-wrap">';
    html += '<div class="visitor-hours" aria-hidden="true">';
    for (var r = 0; r < HOURS.length; r++) {
      html += '<div class="visitor-hour">' + hourLabel(HOURS[r]) + '</div>';
    }
    html += '</div><div class="visitor-cols">';
    for (var d = 0; d < 7; d++) {
      html += '<div class="visitor-col">';
      html += '<div class="visitor-cells">';
      for (var r2 = 0; r2 < HOURS.length; r2++) {
        var h = HOURS[r2];
        var v = agg.grid[d][h];
        var titleCell = WEEKDAYS[d] + ' ' + hourLabel(h) + ': ' + v + ' ' + title;
        html += '<div class="visitor-cell" style="background:' + colorFor(v, max) + '" title="' + titleCell + '"></div>';
      }
      html += '</div>';
      html += '<div class="visitor-day"><span>' + WEEKDAYS[d] + '</span><span>(' + fmtAvg(dayAverage(agg.grid, agg.nDays, d)) + ')</span></div>';
      html += '</div>';
    }
    html += '</div></div>';
    container.innerHTML = html;
  }

  function setSub(id, parsed, field) {
    var el = document.getElementById(id);
    if (!el) return;
    var n = 0;
    for (var i = 0; i < parsed.rows.length; i++) {
      var row = parsed.rows[i];
      n += row[field] || 0;
    }
    var bits = [];
    if (parsed.wiped) bits.push('Demo-Daten am 1.1.2027 geleert');
    else if (parsed.demo) bits.push('Fantasiewerte zum Üben, Leerung am 1.1.2027');
    else bits.push('Erfassung ab 1.1.2027');
    bits.push('Summe ' + n.toLocaleString('de-DE'));
    if (parsed.source) bits.push(parsed.source);
    el.textContent = bits.join(' · ');
  }

  function drawSnapshotCanvas(parsed) {
    var specs = CATEGORIES.map(function (c) { return { title: c.label, field: c.key }; });
    var cell = 14;
    var labelW = 52;
    var headH = 36;
    var dayH = 36;
    var gap = 28;
    var colW = 22;
    var width = labelW + 7 * colW + 16;
    var blockH = headH + HOURS.length * cell + dayH;
    var height = 12 + specs.length * (blockH + gap);
    var c = document.createElement('canvas');
    c.width = width * 2;
    c.height = height * 2;
    var ctx = c.getContext('2d');
    ctx.scale(2, 2);
    ctx.fillStyle = '#f5f7fb';
    ctx.fillRect(0, 0, width, height);
    ctx.font = '12px sans-serif';
    for (var s = 0; s < specs.length; s++) {
      var y0 = 8 + s * (blockH + gap);
      var agg = aggregate(parsed.rows, specs[s].field);
      var max = gridMax(agg.grid);
      ctx.fillStyle = '#1c1c1e';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(specs[s].title, 8, y0 + 16);
      ctx.font = '10px sans-serif';
      for (var r = 0; r < HOURS.length; r++) {
        var yi = y0 + headH + r * cell;
        ctx.fillStyle = '#636366';
        ctx.fillText(hourLabel(HOURS[r]), 4, yi + 11);
        for (var d = 0; d < 7; d++) {
          var v = agg.grid[d][HOURS[r]];
          ctx.fillStyle = colorFor(v, max);
          ctx.fillRect(labelW + d * colW, yi, cell, cell - 1);
        }
      }
      ctx.fillStyle = '#1c1c1e';
      ctx.font = '10px sans-serif';
      for (var d2 = 0; d2 < 7; d2++) {
        var label = WEEKDAYS[d2] + ' (' + fmtAvg(dayAverage(agg.grid, agg.nDays, d2)) + ')';
        ctx.save();
        ctx.translate(labelW + d2 * colW + 7, y0 + headH + HOURS.length * cell + 4);
        ctx.rotate(-Math.PI / 2.8);
        ctx.fillText(label, 0, 0);
        ctx.restore();
      }
    }
    return c;
  }

  function maybeSnapshot(parsed) {
    if (window.location.protocol === 'file:') return;
    if (!parsed.rows.length && parsed.demo) return;
    var month = berlinNow().toISOString().slice(0, 7);
    try {
      if (localStorage.getItem(SNAPSHOT_KEY) === month) return;
    } catch (e) {}
    var canvas = drawSnapshotCanvas(parsed);
    var png = canvas.toDataURL('image/png');
    fetch(resourceUrl('besucher.php?action=snapshot'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'snapshot', month: month, png: png })
    }).then(function (r) { return r.json(); }).then(function (json) {
      if (json && json.ok) {
        try { localStorage.setItem(SNAPSHOT_KEY, month); } catch (e2) {}
      }
    }).catch(function () {});
  }

  function show() {
    var neu = document.getElementById('visitor-hinterbliebene-card');
    ['visitor-hinterbliebene-card', 'visitor-hausfuehrung-card', 'visitor-grabverkauf-card'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.hidden = false;
    });
    ['visitor-interessenten-card', 'visitor-grab-card', 'visitor-gesamt-card'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.hidden = !!neu;
    });
  }

  function render(parsed) {
    show();
    var map = [
      { heat: 'visitor-hinterbliebene-heatmap', sub: 'visitor-hinterbliebene-sub', field: 'hinterbliebene', title: 'Hinterbliebene' },
      { heat: 'visitor-hausfuehrung-heatmap', sub: 'visitor-hausfuehrung-sub', field: 'hausfuehrung', title: 'Hausführung' },
      { heat: 'visitor-grabverkauf-heatmap', sub: 'visitor-grabverkauf-sub', field: 'grabverkauf', title: 'Grabverkauf' }
    ];
    for (var i = 0; i < map.length; i++) {
      var spec = map[i];
      var el = document.getElementById(spec.heat);
      if (el) renderHeatmap(el, aggregate(parsed.rows, spec.field), spec.title);
      setSub(spec.sub, parsed, spec.field);
    }
    maybeSnapshot(parsed);
  }

  function start() {
    loadRows().then(render).catch(function (err) {
      show();
      var sub = document.getElementById('visitor-hinterbliebene-sub') || document.getElementById('visitor-interessenten-sub');
      if (sub) sub.textContent = 'Besucherdaten nicht geladen: ' + (err && err.message ? err.message : String(err));
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
