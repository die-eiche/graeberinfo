(function () {
  var TYPE_LABELS = {
    hinterbliebene: 'Hinterbliebene',
    hausfuehrung: 'Hausführung',
    grabverkauf: 'Grabverkauf'
  };
  var GROUPS = [
    { type: 'hinterbliebene', label: 'Hinterbliebene' },
    { type: 'hausfuehrung', label: 'Hausführung' },
    { type: 'grabverkauf', label: 'Grabverkauf' }
  ];
  var saving = false;
  var toastTimer = null;

  function zaehlungUrl() {
    if (window.ZAEHLUNG_API) return window.ZAEHLUNG_API;
    try {
      if (window.BESUCHER_API) {
        return String(window.BESUCHER_API).replace(/besucher\.php.*$/i, 'zaehlung.php');
      }
      return new URL('zaehlung.php', window.location.href).toString();
    } catch (e) {
      return '/grabbuch/zaehlung.php';
    }
  }

  function logAufruf(teil) {
    fetch(zaehlungUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ programmteil: teil })
    }).catch(function () {});
  }

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
    if (document.getElementById('besucher-erfassung-style')) return;
    var style = document.createElement('style');
    style.id = 'besucher-erfassung-style';
    style.textContent =
      '.group-actions{display:grid;grid-template-columns:1fr;gap:.45rem;margin-top:.7rem}' +
      '.group-actions button{border:1px solid #d9e2ec;background:#fff;border-radius:.5rem;padding:.85rem .5rem;font-size:1rem;font-weight:650;cursor:pointer}' +
      '.group-actions button[data-type="hinterbliebene"]{background:#eef6ef;border-color:#cde3d1;color:#2f5d3a}' +
      '.group-actions button[data-type="hausfuehrung"]{background:#eef3f8;border-color:#c5d4e4;color:#1d4e89}' +
      '.group-actions button[data-type="grabverkauf"]{background:#f7f1e6;border-color:#e4d4b8;color:#8a5a12}' +
      '.group-actions button:disabled{opacity:.55;cursor:not-allowed}' +
      '.besucher-toast{position:fixed;left:50%;bottom:1.4rem;transform:translateX(-50%);background:#1f2933;color:#fff;padding:.7rem 1rem;border-radius:999px;opacity:0;z-index:10001;transition:opacity .2s;pointer-events:none}' +
      '.besucher-toast.show{opacity:1}' +
      '@media (min-width:560px){.group-actions{grid-template-columns:1fr 1fr 1fr}}';
    document.head.appendChild(style);
    if (!document.getElementById('besucher-toast')) {
      document.body.insertAdjacentHTML('beforeend', '<div class="besucher-toast" id="besucher-toast"></div>');
    }
  }

  function showToast(msg) {
    ensureUi();
    var el = document.getElementById('besucher-toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2600);
  }

  function saveGroup(card, type) {
    var iso = card.getAttribute('data-iso') || isoFromGerman(card.getAttribute('data-date') || '');
    if (!iso || saving || !TYPE_LABELS[type]) return;
    saving = true;
    card.querySelectorAll('.group-save').forEach(function (btn) { btn.disabled = true; });
    logAufruf('Unterprogramm Eintrag Besuchergruppe');
    fetch(apiUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'append',
        kategorie: type,
        anzahl: 1,
        zeitstempel: timestampFor(iso)
      })
    }).then(function (r) { return r.json().then(function (j) { return { json: j }; }); })
      .then(function (res) {
        if (!res.json || !res.json.ok) throw new Error((res.json && res.json.error) || 'Speichern fehlgeschlagen');
        showToast('Gespeichert: ' + TYPE_LABELS[type]);
      })
      .catch(function (err) {
        showToast(err.message || String(err));
      })
      .then(function () {
        saving = false;
        card.querySelectorAll('.group-save').forEach(function (btn) { btn.disabled = false; });
      });
  }

  function bindCard(card) {
    if (card.getAttribute('data-besucher-bound') === '1') return;
    card.setAttribute('data-besucher-bound', '1');
    if (card.closest && card.closest('#gedenken-dialog')) return;
    if (!card.querySelector('.group-actions')) {
      var wrap = document.createElement('div');
      wrap.className = 'group-actions';
      GROUPS.forEach(function (g) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'group-save';
        btn.setAttribute('data-type', g.type);
        btn.textContent = g.label;
        wrap.appendChild(btn);
      });
      card.appendChild(wrap);
    }
    card.querySelectorAll('.group-save').forEach(function (btn) {
      btn.addEventListener('click', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        saveGroup(card, btn.getAttribute('data-type'));
      });
    });
  }

  function scan() {
    ensureUi();
    document.querySelectorAll('.day-card').forEach(bindCard);
  }

  window.BesucherErfassung = {
    scan: scan,
    isoFromGerman: isoFromGerman,
    saveGroup: saveGroup
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scan);
  } else {
    scan();
  }
  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
})();
