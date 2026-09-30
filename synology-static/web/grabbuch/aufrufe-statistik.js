/* Aufrufzählung dienste.html: Summen der letzten 7 Tage ab Anzeigedatum. */
(function () {
  var TEILE = [
    { key: 'gesamt', label: 'Gesamtprogramm', id: 'aufrufe-gesamt' },
    { key: 'gedenken', label: 'Unterprogramm Geburts- und Sterbetage', id: 'aufrufe-gedenken' },
    { key: 'besucher', label: 'Unterprogramm Eintrag Besuchergruppe', id: 'aufrufe-besucher' }
  ];

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function resourceUrl(rel) {
    try { return new URL(rel, window.location.href).toString(); }
    catch (e) { return rel; }
  }

  function berlinIso(d) {
    var src = d || new Date();
    var s = src.toLocaleString('sv-SE', { timeZone: 'Europe/Berlin' });
    var m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? m[1] + '-' + m[2] + '-' + m[3] : src.toISOString().slice(0, 10);
  }

  function addDaysIso(iso, add) {
    var p = String(iso).split('-').map(Number);
    var dt = new Date(Date.UTC(p[0], p[1] - 1, p[2] + add));
    return dt.getUTCFullYear() + '-' + pad2(dt.getUTCMonth() + 1) + '-' + pad2(dt.getUTCDate());
  }

  function germanDate(iso) {
    var p = String(iso).split('-');
    return p[2] + '.' + p[1] + '.' + p[0];
  }

  function anzeigeDatumIso() {
    try {
      var params = new URLSearchParams(window.location.search || '');
      var raw = (params.get('d') || params.get('datum') || '').trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    } catch (e) {}
    return berlinIso(new Date());
  }

  function parseTsIso(raw) {
    var s = String(raw || '').trim().replace('T', ' ');
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[1] + '-' + m[2] + '-' + m[3];
    m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (m) return m[3] + '-' + pad2(m[2]) + '-' + pad2(m[1]);
    return '';
  }

  function emptySums() {
    var out = {};
    TEILE.forEach(function (t) { out[t.label] = 0; });
    return out;
  }

  function parseCsv(text) {
    var rows = [];
    var lines = String(text || '').replace(/^\uFEFF/, '').split(/\r\n|\n|\r/);
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var trim = line.trim();
      if (!trim || trim.charAt(0) === '#') continue;
      var parts = line.split(';');
      var first = (parts[0] || '').trim().toLowerCase();
      if (first === 'timestamp') continue;
      if (parts.length < 2) continue;
      rows.push({
        timestamp: (parts[0] || '').trim(),
        programmteil: (parts[1] || '').trim(),
        ip: (parts[2] || '').trim()
      });
    }
    return rows;
  }

  function sumWeek(rows, startIso, endIso) {
    var sums = emptySums();
    (rows || []).forEach(function (row) {
      var iso = parseTsIso(row.timestamp);
      if (!iso || iso < startIso || iso > endIso) return;
      var teil = row.programmteil;
      if (Object.prototype.hasOwnProperty.call(sums, teil)) sums[teil] += 1;
    });
    return sums;
  }

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function render(rows, source) {
    var endIso = anzeigeDatumIso();
    var startIso = addDaysIso(endIso, -6);
    var sums = sumWeek(rows, startIso, endIso);
    TEILE.forEach(function (t) {
      setText(t.id, (sums[t.label] || 0).toLocaleString('de-DE'));
    });
    var bits = [
      'Summe ' + germanDate(startIso) + '–' + germanDate(endIso),
      '7 Tage bis Anzeigedatum'
    ];
    if (source) bits.push(source);
    setText('aufrufe-sub', bits.join(' · '));
  }

  function fail(err) {
    TEILE.forEach(function (t) { setText(t.id, '—'); });
    setText('aufrufe-sub', 'Aufrufe nicht geladen' + (err && err.message ? ': ' + err.message : ''));
  }

  function loadRows() {
    if (window.location.protocol === 'file:') {
      var embed = document.getElementById('aufrufe-data-csv');
      return Promise.resolve(parseCsv(embed ? embed.textContent : ''));
    }
    return fetch(resourceUrl('zaehlung.php'), { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (json) {
      if (!json || !json.ok) throw new Error((json && json.error) || 'load');
      return json.rows || [];
    }).catch(function () {
      return fetch(resourceUrl('Historie/Dienste/aufrufe.csv?_=' + Date.now()), { cache: 'no-store' })
        .then(function (r) {
          if (!r.ok) throw new Error('csv ' + r.status);
          return r.text();
        })
        .then(parseCsv);
    });
  }

  function start() {
    if (!document.getElementById('aufrufe-card')) return;
    loadRows().then(function (rows) { render(rows); }).catch(fail);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
