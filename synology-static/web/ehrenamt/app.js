const content = document.getElementById('content');
const titleButton = document.getElementById('title-button');
const nameDialog = document.getElementById('name-dialog');
const nameForm = document.getElementById('name-form');
const viewerNameInput = document.getElementById('viewer-name');
const memorialDialog = document.getElementById('memorial-dialog');
const memorialTitle = document.getElementById('memorial-title');
const memorialBody = document.getElementById('memorial-body');
const memorialClose = document.getElementById('memorial-close');

const DISPLAY_DAYS = 10;
const VIEWER_NAME_KEY = 'ehrenamt-viewer-name';
const GRABBUCH_CSV_URL = '../grabbuch/daten.csv';
const DOUBLE_TAP_MS = 350;
const LONG_PRESS_MS = 560;
const MOVE_CANCEL_PX = 12;
const HINT_LANGTAP_KEY = 'ehrenamt-hint-langtap-v2';
const BESUCHER_API = '../grabbuch/besucher.php';
const VISITOR_LABELS = {
  hinterbliebene: 'Angehörige',
  hausfuehrung: 'Interessierte',
  grabverkauf: 'Grabverkauf'
};
const featureHint = document.getElementById('feature-hint');
const featureHintDismiss = document.getElementById('feature-hint-dismiss');
const visitorDialog = document.getElementById('visitor-dialog');
const visitorForm = document.getElementById('visitor-form');
const visitorDate = document.getElementById('visitor-date');
const visitorStatus = document.getElementById('visitor-status');
const visitorCancel = document.getElementById('visitor-cancel');
const visitorSave = document.getElementById('visitor-save');

let cachedDays = [];
let viewerName = '';
let loadInProgress = false;
let focusRefreshTimer = null;
let memorialRows = null;
let memorialLoadPromise = null;
let lastDayTapAt = 0;
let lastDayTapKey = '';

function parseGermanDate(value) {
  const text = String(value || '').trim();
  let m = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (m) {
    return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  }
  m = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  const parts = text.split('.');
  if (parts.length < 3) {
    return null;
  }
  return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
}

function startOfToday() {
  const s = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Berlin' });
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function getVisibleDays(days) {
  const list = Array.isArray(days) ? days : [];
  const today = startOfToday();
  const upcoming = list.filter(day => {
    const date = parseGermanDate(day && day.date);
    return date && !Number.isNaN(date.getTime()) && date >= today;
  });
  if (upcoming.length) {
    return upcoming.slice(0, DISPLAY_DAYS);
  }
  return list.slice(0, DISPLAY_DAYS);
}

function normalizeName(value) {
  return String(value).trim().toLowerCase().replace(/\s+/g, ' ');
}

function extractStaffName(entry) {
  return String(entry).replace(/\s*\([^)]*\)\s*$/, '').trim();
}

function buildNameVariants(name) {
  const normalized = normalizeName(name);
  const variants = new Set([normalized]);

  if (normalized.includes(',')) {
    const [last, first] = normalized.split(',').map(part => part.trim());
    if (last && first) {
      variants.add(`${first} ${last}`);
    }
    return variants;
  }

  const parts = normalized.split(' ').filter(Boolean);
  if (parts.length >= 2) {
    const first = parts[0];
    const last = parts.slice(1).join(' ');
    variants.add(`${last}, ${first}`);
  }

  return variants;
}

function isMyEntry(entry) {
  if (!viewerName) {
    return false;
  }

  const viewerVariants = buildNameVariants(viewerName);
  const entryVariants = buildNameVariants(extractStaffName(entry));

  for (const viewerVariant of viewerVariants) {
    if (entryVariants.has(viewerVariant)) {
      return true;
    }
  }

  return false;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderStaffEntry(entry) {
  const className = isMyEntry(entry) ? ' class="staff-me"' : '';
  return `<li${className}>${escapeHtml(entry)}</li>`;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ';') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch !== '\r') {
      field += ch;
    }
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter(r => r.some(cell => String(cell).trim() !== ''));
}

function monthDayKey(dateValue) {
  const d = parseGermanDate(dateValue);
  if (!d || Number.isNaN(d.getTime())) {
    return '';
  }
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}-${dd}`;
}

async function loadMemorialRows() {
  if (memorialRows) {
    return memorialRows;
  }
  if (memorialLoadPromise) {
    return memorialLoadPromise;
  }

  memorialLoadPromise = (async () => {
    const response = await fetch(`${GRABBUCH_CSV_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Grabbuch-Daten konnten nicht geladen werden.');
    }
    const text = await response.text();
    const rows = parseCsv(text);
    if (!rows.length) {
      memorialRows = [];
      return memorialRows;
    }

    const headers = rows[0].map(h => String(h).trim());
    const idx = name => {
      const needle = String(name).toLowerCase();
      return headers.findIndex(h => h.toLowerCase() === needle);
    };

    const iName = idx('Name');
    const iGeb = idx('Geburtstag');
    const iSter = Math.max(idx('Sterbetag'), idx('Todestag'));
    const iGrab = idx('Grab');
    const iGrabstelle = idx('Grabstelle');

    memorialRows = rows.slice(1).map(cols => {
      const name = iName >= 0 ? String(cols[iName] || '').trim() : '';
      const geburtstag = iGeb >= 0 ? String(cols[iGeb] || '').trim() : '';
      const sterbetag = iSter >= 0 ? String(cols[iSter] || '').trim() : '';
      const grab = iGrabstelle >= 0 && String(cols[iGrabstelle] || '').trim()
        ? String(cols[iGrabstelle]).trim()
        : (iGrab >= 0 ? String(cols[iGrab] || '').trim() : '');
      return { name, geburtstag, sterbetag, grab };
    }).filter(row => row.name && (row.geburtstag || row.sterbetag));

    return memorialRows;
  })().catch(error => {
    memorialLoadPromise = null;
    throw error;
  });

  return memorialLoadPromise;
}

function findMemorialsForDate(germanDate) {
  const key = monthDayKey(germanDate);
  if (!key || !memorialRows) {
    return { birthdays: [], deathdays: [] };
  }

  const birthdays = [];
  const deathdays = [];
  const seenBirth = new Set();
  const seenDeath = new Set();

  for (const row of memorialRows) {
    if (row.geburtstag && monthDayKey(row.geburtstag) === key) {
      const id = `${normalizeName(row.name)}|${row.geburtstag}|${row.grab}`;
      if (!seenBirth.has(id)) {
        seenBirth.add(id);
        birthdays.push(row);
      }
    }
    if (row.sterbetag && monthDayKey(row.sterbetag) === key) {
      const id = `${normalizeName(row.name)}|${row.sterbetag}|${row.grab}`;
      if (!seenDeath.has(id)) {
        seenDeath.add(id);
        deathdays.push(row);
      }
    }
  }

  const byName = (a, b) => a.name.localeCompare(b.name, 'de');
  birthdays.sort(byName);
  deathdays.sort(byName);
  return { birthdays, deathdays };
}

function renderMemorialList(title, rows, kindLabel) {
  if (!rows.length) {
    return '';
  }

  const items = rows.map(row => {
    const dateValue = kindLabel === 'Geburtstag' ? row.geburtstag : row.sterbetag;
    const grab = row.grab ? `<span class="memorial-grab">Grab ${escapeHtml(row.grab)}</span>` : '';
    return `<li>
      <strong>${escapeHtml(row.name)}</strong>
      <span class="memorial-meta">${escapeHtml(kindLabel)}: ${escapeHtml(dateValue)}</span>
      ${grab}
    </li>`;
  }).join('');

  return `<section class="memorial-section">
    <h3>${escapeHtml(title)} (${rows.length})</h3>
    <ul class="memorial-list">${items}</ul>
  </section>`;
}

function openMemorialDialog() {
  if (typeof memorialDialog.showModal === 'function') {
    memorialDialog.showModal();
  } else {
    memorialDialog.setAttribute('open', 'open');
  }
}

function closeMemorialDialog() {
  if (typeof memorialDialog.close === 'function') {
    memorialDialog.close();
  } else {
    memorialDialog.removeAttribute('open');
  }
}

async function showMemorialsForDay(day) {
  memorialTitle.textContent = `Gedenken · ${day.weekday}, ${day.date}`;
  memorialBody.innerHTML = '<p class="memorial-loading">Lade Verstorbene…</p>';
  openMemorialDialog();

  try {
    await loadMemorialRows();
    const { birthdays, deathdays } = findMemorialsForDate(day.date);
    const html = [
      renderMemorialList('Geburtstag', birthdays, 'Geburtstag'),
      renderMemorialList('Todestag', deathdays, 'Todestag')
    ].join('');

    if (!html) {
      memorialBody.innerHTML = '<p class="note">An diesem Tag keine Geburtstage oder Todestage in den Grabbuch-Daten.</p>';
    } else {
      memorialBody.innerHTML = html;
    }
  } catch (error) {
    memorialBody.innerHTML = `<div class="error"><strong>Fehler:</strong> ${escapeHtml(error.message)}</div>`;
  }
}

function isoFromGermanDate(value) {
  const d = parseGermanDate(value);
  if (!d || Number.isNaN(d.getTime())) {
    return '';
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function berlinClock() {
  const s = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Berlin' });
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/);
  return m
    ? { iso: `${m[1]}-${m[2]}-${m[3]}`, h: +m[4], min: +m[5] }
    : { iso: '', h: 12, min: 0 };
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function visitorTimestamp(germanDate) {
  const clock = berlinClock();
  const iso = isoFromGermanDate(germanDate);
  if (iso !== clock.iso) {
    return '';
  }
  return `${clock.iso} ${pad2(clock.h)}:${pad2(clock.min)}`;
}

function isTodayCard(day) {
  const iso = isoFromGermanDate(day && day.date);
  return Boolean(iso && iso === berlinClock().iso);
}

function visitorRowIsoDate(row) {
  const ts = String((row && row.zeitstempel) || '').trim();
  const iso = ts.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) {
    return iso[1];
  }
  const german = ts.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (german) {
    return `${german[3]}-${pad2(german[2])}-${pad2(german[1])}`;
  }
  return '';
}

function visitorRowCount(row, key) {
  if (!row || !key) {
    return 0;
  }
  if (row.kategorie === key) {
    const n = Number(row.anzahl);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }
  const n = Number(row[key]);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function visitorDayTotals(rows, isoDate) {
  const totals = {
    hinterbliebene: 0,
    hausfuehrung: 0,
    grabverkauf: 0
  };
  if (!isoDate || !Array.isArray(rows)) {
    return totals;
  }
  rows.forEach(row => {
    if (visitorRowIsoDate(row) !== isoDate) {
      return;
    }
    Object.keys(totals).forEach(key => {
      totals[key] += visitorRowCount(row, key);
    });
  });
  return totals;
}

function setVisitorCounts(totals, state) {
  document.querySelectorAll('[data-visitor-count]').forEach(el => {
    const key = el.getAttribute('data-visitor-count');
    el.classList.remove('is-loading', 'is-empty');
    if (state === 'loading') {
      el.textContent = '…';
      el.classList.add('is-loading');
      return;
    }
    if (state === 'error' || !totals || totals[key] == null) {
      el.textContent = '–';
      el.classList.add('is-empty');
      return;
    }
    el.textContent = String(totals[key]);
  });
}

async function loadVisitorDayCounts(isoDate) {
  setVisitorCounts(null, 'loading');
  try {
    const response = await fetch(`${BESUCHER_API}?action=load&_=${Date.now()}`, { cache: 'no-store' });
    const json = await response.json();
    if (!response.ok || !json || !json.ok) {
      throw new Error((json && json.error) || 'Zähler nicht geladen');
    }
    setVisitorCounts(visitorDayTotals(json.rows, isoDate));
  } catch (error) {
    setVisitorCounts(null, 'error');
  }
}

function openVisitorDialog(day) {
  if (!visitorDialog) {
    return;
  }
  visitorDialog.dataset.date = day.date || '';
  if (visitorDate) {
    visitorDate.textContent = `${day.weekday}, ${day.date}`;
  }
  if (visitorStatus) {
    visitorStatus.textContent = '';
    visitorStatus.className = 'visitor-status';
  }
  if (visitorForm) {
    visitorForm.reset();
  }
  if (visitorSave) {
    visitorSave.disabled = false;
  }
  setVisitorCounts(null, 'loading');
  loadVisitorDayCounts(isoFromGermanDate(day.date));
  if (typeof visitorDialog.showModal === 'function') {
    visitorDialog.showModal();
  } else {
    visitorDialog.setAttribute('open', 'open');
  }
}

function closeVisitorDialog() {
  if (!visitorDialog) {
    return;
  }
  if (typeof visitorDialog.close === 'function' && visitorDialog.open) {
    visitorDialog.close();
  } else {
    visitorDialog.removeAttribute('open');
  }
}

async function saveVisitor(event) {
  event.preventDefault();
  const chosen = visitorForm && visitorForm.querySelector('input[name="visitor-type"]:checked');
  const kategorie = chosen ? chosen.value : '';
  if (!VISITOR_LABELS[kategorie]) {
    if (visitorStatus) {
      visitorStatus.textContent = 'Bitte eine Art auswählen.';
      visitorStatus.className = 'visitor-status';
    }
    return;
  }

  if (visitorSave) {
    visitorSave.disabled = true;
  }
  if (visitorStatus) {
    visitorStatus.textContent = 'Speichere…';
    visitorStatus.className = 'visitor-status';
  }

  try {
    const ts = visitorTimestamp(visitorDialog.dataset.date);
    if (!ts) {
      throw new Error('Einträge nur für den heutigen Tag.');
    }
    const response = await fetch(BESUCHER_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'append',
        kategorie: kategorie,
        anzahl: 1,
        zeitstempel: ts
      })
    });
    const json = await response.json();
    if (!response.ok || !json || !json.ok) {
      throw new Error((json && json.error) || 'Speichern fehlgeschlagen');
    }
    closeVisitorDialog();
  } catch (error) {
    if (visitorStatus) {
      visitorStatus.textContent = error.message || String(error);
      visitorStatus.className = 'visitor-status';
    }
    if (visitorSave) {
      visitorSave.disabled = false;
    }
  }
}

function initVisitorDialog() {
  if (!visitorDialog) {
    return;
  }
  if (visitorForm) {
    visitorForm.addEventListener('submit', saveVisitor);
  }
  if (visitorCancel) {
    visitorCancel.addEventListener('click', closeVisitorDialog);
  }
  visitorDialog.addEventListener('click', event => {
    if (event.target === visitorDialog) {
      closeVisitorDialog();
    }
  });
}

function bindDayCardInteractions() {
  content.querySelectorAll('.day-card').forEach(card => {
    let pressTimer = null;
    let pressStart = null;
    let longPressFired = false;

    const day = () => ({
      date: card.dataset.date,
      weekday: card.dataset.weekday
    });

    const openMemorial = () => {
      showMemorialsForDay(day());
    };

    const clearPress = () => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
      pressStart = null;
      card.classList.remove('is-pressing');
    };

    const openVisitor = () => {
      if (!isTodayCard(day())) {
        return false;
      }
      openVisitorDialog(day());
      return true;
    };

    card.addEventListener('pointerdown', ev => {
      if (ev.button && ev.button !== 0) {
        return;
      }
      longPressFired = false;
      if (!isTodayCard(day())) {
        return;
      }
      clearPress();
      pressStart = { x: ev.clientX, y: ev.clientY };
      card.classList.add('is-pressing');
      try {
        card.setPointerCapture(ev.pointerId);
      } catch (e1) {}
      pressTimer = setTimeout(() => {
        pressTimer = null;
        longPressFired = true;
        lastDayTapAt = 0;
        lastDayTapKey = '';
        clearPress();
        openVisitor();
      }, LONG_PRESS_MS);
    });

    card.addEventListener('pointermove', ev => {
      if (!pressStart) {
        return;
      }
      const dx = ev.clientX - pressStart.x;
      const dy = ev.clientY - pressStart.y;
      if ((dx * dx + dy * dy) > MOVE_CANCEL_PX * MOVE_CANCEL_PX) {
        clearPress();
      }
    });

    card.addEventListener('pointerup', clearPress);
    card.addEventListener('pointercancel', clearPress);

    card.addEventListener('contextmenu', ev => {
      ev.preventDefault();
      if (!isTodayCard(day())) {
        return;
      }
      clearPress();
      longPressFired = true;
      lastDayTapAt = 0;
      lastDayTapKey = '';
      openVisitor();
    });

    card.addEventListener('dblclick', event => {
      event.preventDefault();
      if (longPressFired) {
        return;
      }
      openMemorial();
    });

    card.addEventListener('click', () => {
      if (longPressFired) {
        longPressFired = false;
        return;
      }
      const key = card.dataset.date || '';
      const now = Date.now();
      if (key && key === lastDayTapKey && now - lastDayTapAt < DOUBLE_TAP_MS) {
        lastDayTapAt = 0;
        lastDayTapKey = '';
        openMemorial();
        return;
      }
      lastDayTapAt = now;
      lastDayTapKey = key;
    });
  });
}

function renderDays(days) {
  const visibleDays = getVisibleDays(days);

  if (!visibleDays.length) {
    content.innerHTML = '<div class="error"><strong>Hinweis:</strong> Keine aktuellen Dienste in den exportierten Daten.</div>';
    return;
  }

  content.innerHTML = visibleDays.map(day => `
    <section class="day-card" data-date="${escapeHtml(day.date)}" data-weekday="${escapeHtml(day.weekday)}" title="${isTodayCard(day) ? 'Doppeltippen: Gedenken · Lange drücken: Besucher' : 'Doppeltippen: Gedenken'}">
      <div class="day-title">${escapeHtml(day.weekday)}, ${escapeHtml(day.date)}</div>
      <div class="staff">
        ${day.staff.length
          ? `<ol class="staff-list">${day.staff.map(renderStaffEntry).join('')}</ol>`
          : `<span class="note">${escapeHtml(day.note || 'Kein Dienst eingetragen.')}</span>`}
      </div>
    </section>
  `).join('');

  bindDayCardInteractions();
}

function loadViewerName() {
  viewerName = String(localStorage.getItem(VIEWER_NAME_KEY) || '').trim();
  return viewerName;
}

function saveViewerName(name) {
  viewerName = String(name || '').trim();
  if (viewerName) {
    localStorage.setItem(VIEWER_NAME_KEY, viewerName);
  } else {
    localStorage.removeItem(VIEWER_NAME_KEY);
  }
}

function openNameDialog() {
  viewerNameInput.value = viewerName;
  if (typeof nameDialog.showModal === 'function') {
    nameDialog.showModal();
  } else {
    nameDialog.setAttribute('open', 'open');
  }
  viewerNameInput.focus();
}

function closeNameDialog() {
  if (typeof nameDialog.close === 'function') {
    nameDialog.close();
  } else {
    nameDialog.removeAttribute('open');
  }
}

function ensureNameDialogIfNeeded() {
  if (!viewerName) {
    openNameDialog();
  }
}

function initNameDialog() {
  loadViewerName();

  titleButton.addEventListener('click', openNameDialog);

  nameForm.addEventListener('submit', event => {
    event.preventDefault();
    saveViewerName(viewerNameInput.value);
    closeNameDialog();
    renderDays(cachedDays);
  });

  ensureNameDialogIfNeeded();
}

function initMemorialDialog() {
  memorialClose.addEventListener('click', closeMemorialDialog);
  memorialDialog.addEventListener('click', event => {
    if (event.target === memorialDialog) {
      closeMemorialDialog();
    }
  });
}

function dismissFeatureHint() {
  try {
    localStorage.setItem(HINT_LANGTAP_KEY, '1');
  } catch (e) {}
  if (featureHint) {
    featureHint.hidden = true;
  }
}

function maybeShowFeatureHint() {
  if (!featureHint) {
    return;
  }

  let seen = false;
  try {
    seen = Boolean(localStorage.getItem(HINT_LANGTAP_KEY));
  } catch (e) {}

  if (seen) {
    featureHint.hidden = true;
    return;
  }

  featureHint.hidden = false;
}

function initFeatureHint() {
  if (featureHintDismiss) {
    featureHintDismiss.addEventListener('click', dismissFeatureHint);
  }
  maybeShowFeatureHint();
}

async function loadData(options = {}) {
  const silent = Boolean(options.silent);

  if (loadInProgress) {
    return;
  }

  loadInProgress = true;

  if (!silent) {
    content.innerHTML = '<p>Lade Dienste…</p>';
  }

  try {
    const response = await fetch(`dienstplan.json?t=${Date.now()}`, { cache: 'no-store' });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Fehler beim Laden');
    }

    cachedDays = data.days || [];
    renderDays(cachedDays);
    maybeShowFeatureHint();
    ensureNameDialogIfNeeded();
  } catch (error) {
    if (!silent || !cachedDays.length) {
      content.innerHTML = `<div class="error"><strong>Fehler:</strong> ${error.message}</div>`;
    }
  } finally {
    loadInProgress = false;
  }
}

function refreshOnFocus() {
  loadViewerName();
  memorialRows = null;
  memorialLoadPromise = null;

  if (cachedDays.length) {
    renderDays(cachedDays);
  }

  loadData({ silent: cachedDays.length > 0 });
}

function scheduleRefreshOnFocus() {
  if (focusRefreshTimer) {
    clearTimeout(focusRefreshTimer);
  }

  focusRefreshTimer = setTimeout(() => {
    focusRefreshTimer = null;
    refreshOnFocus();
  }, 150);
}

function initFocusRefresh() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      scheduleRefreshOnFocus();
    }
  });

  window.addEventListener('pageshow', event => {
    if (event.persisted) {
      scheduleRefreshOnFocus();
    }
  });

  window.addEventListener('focus', () => {
    if (document.visibilityState === 'visible') {
      scheduleRefreshOnFocus();
    }
  });
}

initNameDialog();
initMemorialDialog();
initVisitorDialog();
initFeatureHint();
initFocusRefresh();
loadData();
