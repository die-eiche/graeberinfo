(function () {
  var LONG_PRESS_MS = 560;
  var MOVE_CANCEL_PX = 12;
  var MIN = 1;
  var MAX = 30;
  var ITEM_H = 56;
  var pressTimer = null;
  var pressStart = null;
  var suppressClick = false;
  var count = 1;
  var visitorType = 'hinterbliebene';
  var TYPE_LABELS = {
    hinterbliebene: 'Hinterbliebene',
    hausfuehrung: 'Hausführung',
    grabverkauf: 'Grabverkauf'
  };
  var selectedIso = '';
  var selectedLabel = '';
  var wheelReady = false;
  var toastTimer = null;

  function apiUrl() {
    if (window.BESUCHER_API) return window.BESUCHER_API;
    try {
      return new URL('besucher.php', window.location.href).toString();
    } catch (e) {
      return '/grabbuch/besucher.php';
    }
  }

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function berlinNowParts() {
    var s = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Berlin' });
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/);
    return { iso: m[1] + '-' + m[2] + '-' + m[3], h: +m[4] };
  }

  function isoFromGerman(dateText) {
    var m = String(dateText || '').trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (!m) return '';
    return m[3] + '-' + pad2(m[2]) + '-' + pad2(m[1]);
  }

  function timestampFor(iso) {
    var now = berlinNowParts();
    var h = now.iso === iso ? now.h : 12;
    if (h < 8) h = 8;
    if (h > 19) h = 19;
    return iso + ' ' + pad2(h) + ':00';
  }

  function ensureUi() {
    if (document.getElementById('besucher-dialog')) return;
    var style = document.createElement('style');
    style.textContent =
      '.besucher-dialog{position:fixed;inset:0;z-index:10000;background:rgba(20,28,24,.55);display:none;align-items:center;justify-content:center;padding:1rem}' +
      '.besucher-dialog.open{display:flex}' +
      '.besucher-card{width:min(420px,100%);background:#fff;border-radius:1rem;padding:1.15rem;box-shadow:0 18px 50px rgba(16,24,40,.28);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif}' +
      '.besucher-card h2{margin:0;font-size:1.2rem;color:#2f5d3a}' +
      '.besucher-date{margin:.25rem 0 .9rem;color:#7b8794}' +
      '.besucher-wheel-wrap{position:relative;height:168px;margin:0 auto 1rem;max-width:180px}' +
      '.besucher-wheel{height:168px;overflow-y:auto;scroll-snap-type:y mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none}' +
      '.besucher-wheel::-webkit-scrollbar{display:none}' +
      '.besucher-wheel-pad{height:56px}' +
      '.besucher-wheel-item{height:56px;scroll-snap-align:center;display:flex;align-items:center;justify-content:center;font-size:2rem;font-weight:650;color:#9aa5b1}' +
      '.besucher-wheel-item.is-active{color:#1f2933;font-size:2.35rem}' +
      '.besucher-wheel-overlay{pointer-events:none;position:absolute;inset:0;background:linear-gradient(#fff 0%,rgba(255,255,255,0) 28%,rgba(255,255,255,0) 72%,#fff 100%)}' +
      '.besucher-wheel-window{pointer-events:none;position:absolute;left:8px;right:8px;top:56px;height:56px;border-radius:.6rem;border:1px solid #c5d4c8;background:rgba(47,93,58,.06)}' +
      '.besucher-types,.besucher-actions{display:grid;grid-template-columns:1fr 1fr;gap:.55rem;margin-bottom:.85rem}' +
      '.besucher-types{grid-template-columns:1fr}' +
      '.besucher-card button{border:1px solid #d9e2ec;background:#fff;border-radius:.5rem;padding:.75rem .5rem;font-size:1rem;cursor:pointer}' +
      '.besucher-types button.is-on[data-type="hinterbliebene"]{background:#2f5d3a;color:#fff;border-color:#2f5d3a}' +
      '.besucher-types button.is-on[data-type="hausfuehrung"]{background:#1d4e89;color:#fff;border-color:#1d4e89}' +
      '.besucher-types button.is-on[data-type="grabverkauf"]{background:#8a5a12;color:#fff;border-color:#8a5a12}' +
      '.besucher-save{background:#2f5d3a;color:#fff;border-color:#2f5d3a;font-weight:650}' +
      '.besucher-status{min-height:1.2rem;margin:0;font-size:.9rem;color:#b42318;text-align:center}' +
      '.besucher-toast{position:fixed;left:50%;bottom:1.4rem;transform:translateX(-50%);background:#1f2933;color:#fff;padding:.7rem 1rem;border-radius:999px;opacity:0;z-index:10001;transition:opacity .2s}' +
      '.besucher-toast.show{opacity:1}' +
      '.day-card{-webkit-touch-callout:none;-webkit-user-select:none;user-select:none}' +
      '.day-card.is-pressing{background:#eef6ef}';
    document.head.appendChild(style);

    var html = '<div class="besucher-dialog" id="besucher-dialog">' +
      '<div class="besucher-card">' +
      '<h2>Besucher eintragen</h2>' +
      '<p class="besucher-date" id="besucher-date"></p>' +
      '<div class="besucher-wheel-wrap"><div class="besucher-wheel" id="besucher-wheel"></div>' +
      '<div class="besucher-wheel-overlay"></div><div class="besucher-wheel-window"></div></div>' +
      '<div class="besucher-types">' +
      '<button type="button" data-type="hinterbliebene">Hinterbliebene</button>' +
      '<button type="button" data-type="hausfuehrung">Hausführung</button>' +
      '<button type="button" data-type="grabverkauf">Grabverkauf</button></div>' +
      '<div class="besucher-actions">' +
      '<button type="button" id="besucher-cancel">Abbrechen</button>' +
      '<button type="button" class="besucher-save" id="besucher-save">Speichern</button></div>' +
      '<p class="besucher-status" id="besucher-status"></p></div></div>' +
      '<div class="besucher-toast" id="besucher-toast"></div>';
    document.body.insertAdjacentHTML('beforeend', html);

    var wheel = document.getElementById('besucher-wheel');
    var pad = '<div class="besucher-wheel-pad"></div>';
    var items = '';
    for (var n = MIN; n <= MAX; n++) items += '<div class="besucher-wheel-item" data-n="' + n + '">' + n + '</div>';
    wheel.innerHTML = pad + items + pad;

    wheel.addEventListener('scroll', function () {
      if (!wheelReady) return;
      setCount(Math.max(MIN, Math.min(MAX, Math.round(wheel.scrollTop / ITEM_H) + MIN)), false);
    });
    var dlg = document.getElementById('besucher-dialog');
    dlg.addEventListener('wheel', function (ev) {
      if (!dlg.classList.contains('open')) return;
      ev.preventDefault();
      setCount(count + (ev.deltaY > 0 ? 1 : -1), true);
    }, { passive: false });
    dlg.querySelectorAll('.besucher-types button').forEach(function (btn) {
      btn.addEventListener('click', function () { setType(btn.getAttribute('data-type')); });
    });
    document.getElementById('besucher-cancel').addEventListener('click', closeDialog);
    document.getElementById('besucher-save').addEventListener('click', saveVisitor);
    dlg.addEventListener('click', function (ev) { if (ev.target === dlg) closeDialog(); });
    document.addEventListener('keydown', function (ev) {
      if (!dlg.classList.contains('open')) return;
      if (ev.key === 'Escape') closeDialog();
      if (ev.key === 'ArrowUp') { ev.preventDefault(); setCount(count - 1, true); }
      if (ev.key === 'ArrowDown') { ev.preventDefault(); setCount(count + 1, true); }
      if (ev.key === 'Enter') saveVisitor();
    });
  }

  function setCount(n, scroll) {
    count = Math.max(MIN, Math.min(MAX, n | 0));
    var wheel = document.getElementById('besucher-wheel');
    wheel.querySelectorAll('.besucher-wheel-item').forEach(function (el) {
      el.classList.toggle('is-active', +el.getAttribute('data-n') === count);
    });
    if (scroll) {
      wheelReady = false;
      wheel.scrollTop = (count - MIN) * ITEM_H;
      requestAnimationFrame(function () { wheelReady = true; });
    }
  }

  function setType(t) {
    visitorType = TYPE_LABELS[t] ? t : 'hinterbliebene';
    document.querySelectorAll('.besucher-types button').forEach(function (btn) {
      if (btn.getAttribute('data-type') === visitorType) btn.classList.add('is-on');
      else btn.classList.remove('is-on');
    });
  }

  function openDialog(iso, label) {
    ensureUi();
    selectedIso = iso;
    selectedLabel = label;
    document.getElementById('besucher-date').textContent = label;
    document.getElementById('besucher-status').textContent = '';
    document.getElementById('besucher-save').disabled = false;
    setType('hinterbliebene');
    document.getElementById('besucher-dialog').classList.add('open');
    setCount(1, true);
  }

  function closeDialog() {
    var dlg = document.getElementById('besucher-dialog');
    if (dlg) dlg.classList.remove('open');
    selectedIso = '';
  }

  function showToast(msg) {
    ensureUi();
    var el = document.getElementById('besucher-toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2600);
  }

  function saveVisitor() {
    var saveBtn = document.getElementById('besucher-save');
    if (!selectedIso || saveBtn.disabled) return;
    var body = {
      action: 'append',
      kategorie: visitorType,
      anzahl: count,
      zeitstempel: timestampFor(selectedIso)
    };
    saveBtn.disabled = true;
    document.getElementById('besucher-status').textContent = 'Speichere…';
    fetch(apiUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json().then(function (j) { return { json: j }; }); })
      .then(function (res) {
        if (!res.json || !res.json.ok) throw new Error((res.json && res.json.error) || 'Speichern fehlgeschlagen');
        var label = count + ' ' + (TYPE_LABELS[visitorType] || visitorType);
        closeDialog();
        showToast('Gespeichert: ' + label);
      })
      .catch(function (err) {
        document.getElementById('besucher-status').textContent = err.message || String(err);
        saveBtn.disabled = false;
      });
  }

  function clearPress() {
    if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    pressStart = null;
    document.querySelectorAll('.day-card.is-pressing').forEach(function (el) {
      el.classList.remove('is-pressing');
    });
  }

  function bindCard(card) {
    if (card.getAttribute('data-besucher-bound') === '1') return;
    card.setAttribute('data-besucher-bound', '1');
    card.addEventListener('pointerdown', function (ev) {
      if (ev.button && ev.button !== 0) return;
      clearPress();
      pressStart = { x: ev.clientX, y: ev.clientY };
      card.classList.add('is-pressing');
      try { card.setPointerCapture(ev.pointerId); } catch (e1) {}
      pressTimer = setTimeout(function () {
        pressTimer = null;
        suppressClick = true;
        var iso = card.getAttribute('data-iso') || isoFromGerman(card.getAttribute('data-date') || '');
        var label = card.getAttribute('data-label') || (card.querySelector('.day-title') || {}).textContent || iso;
        if (iso) openDialog(iso, label);
        clearPress();
      }, LONG_PRESS_MS);
    });
    card.addEventListener('pointermove', function (ev) {
      if (!pressStart) return;
      var dx = ev.clientX - pressStart.x;
      var dy = ev.clientY - pressStart.y;
      if ((dx * dx + dy * dy) > MOVE_CANCEL_PX * MOVE_CANCEL_PX) clearPress();
    });
    card.addEventListener('pointerup', clearPress);
    card.addEventListener('pointercancel', clearPress);
    card.addEventListener('contextmenu', function (ev) {
      ev.preventDefault();
      clearPress();
      var iso = card.getAttribute('data-iso') || isoFromGerman(card.getAttribute('data-date') || '');
      var label = card.getAttribute('data-label') || (card.querySelector('.day-title') || {}).textContent || iso;
      if (iso) openDialog(iso, label);
    });
    card.addEventListener('click', function (ev) {
      if (suppressClick) {
        ev.preventDefault();
        ev.stopPropagation();
        suppressClick = false;
      }
    });
  }

  function scan() {
    ensureUi();
    document.querySelectorAll('.day-card').forEach(bindCard);
  }

  window.BesucherErfassung = {
    scan: scan,
    isoFromGerman: isoFromGerman,
    openDialog: openDialog
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scan);
  } else {
    scan();
  }
  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
})();
