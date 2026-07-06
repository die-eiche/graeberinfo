(function () {
  var BILDER_PFAD = '../bilder/';
  var DATEN_DATEI = 'suche-daten.json';

  var params = new URLSearchParams(window.location.search);
  var sucheView = document.getElementById('suche-view');
  var bildView = document.getElementById('bild-view');
  var suchfeld = document.getElementById('suchfeld');
  var trefferliste = document.getElementById('trefferliste');
  var keineTreffer = document.getElementById('keine-treffer');
  var zurueck = document.getElementById('zurueck');
  var viewport = document.getElementById('viewport');
  var bild = document.getElementById('plan-bild');
  var positionInfo = document.getElementById('position-info');
  var panzoomInstance = null;
  var eintraege = [];

  function assetUrl(relativ) {
    return new URL(relativ, window.location.href).href;
  }

  function formatPosition(spalte, reihe) {
    return String(spalte) + ' | ' + String(reihe);
  }

  function setPosition(spalte, reihe) {
    if (spalte === null || spalte === undefined || spalte === '') {
      positionInfo.classList.add('hidden');
      positionInfo.textContent = '';
      return;
    }
    if (reihe === null || reihe === undefined || reihe === '') {
      positionInfo.classList.add('hidden');
      positionInfo.textContent = '';
      return;
    }
    positionInfo.textContent = formatPosition(spalte, reihe);
    positionInfo.classList.remove('hidden');
  }

  function destroyPanzoom() {
    if (panzoomInstance) {
      panzoomInstance.destroy();
      panzoomInstance = null;
    }
  }

  function initPanzoom() {
    if (!bild.naturalWidth) {
      return;
    }
    destroyPanzoom();
    panzoomInstance = Panzoom(bild, {
      maxScale: 6,
      minScale: 1,
      step: 0.4,
      canvas: true,
      contain: 'outside',
      touchAction: 'none',
      panOnlyWhenZoomed: true,
      animate: true
    });
    panzoomInstance.reset({ animate: false });
  }

  function onWheel(event) {
    if (panzoomInstance) {
      panzoomInstance.zoomWithWheel(event);
    }
  }

  function bildUrl(eintrag) {
    if (eintrag.bild) {
      return assetUrl(eintrag.bild.indexOf('/') >= 0 ? eintrag.bild : BILDER_PFAD + eintrag.bild);
    }
    if (eintrag.src) {
      return assetUrl(eintrag.src);
    }
    if (eintrag.boden) {
      return assetUrl(BILDER_PFAD + eintrag.boden);
    }
    return '';
  }

  function showBild(eintrag) {
    var url = typeof eintrag === 'string' ? assetUrl(eintrag) : bildUrl(eintrag);
    var spalte = typeof eintrag === 'object'
      ? (eintrag.spalte != null ? eintrag.spalte : eintrag.Spalte)
      : params.get('spalte');
    var reihe = typeof eintrag === 'object'
      ? (eintrag.reihe != null ? eintrag.reihe : eintrag.Reihe)
      : params.get('reihe');

    if (!url) {
      return;
    }

    sucheView.classList.add('hidden');
    bildView.classList.remove('hidden');
    setPosition(spalte, reihe);

    destroyPanzoom();
    bild.onload = function () {
      initPanzoom();
    };
    bild.src = url;
    if (bild.complete && bild.naturalWidth > 0) {
      initPanzoom();
    }
  }

  function showSuche() {
    bildView.classList.add('hidden');
    sucheView.classList.remove('hidden');
    destroyPanzoom();
    bild.removeAttribute('src');
    setPosition(null, null);
  }

  function renderTreffer(filter) {
    var suchtext = (filter || '').trim().toLowerCase();
    trefferliste.innerHTML = '';
    var treffer = eintraege.filter(function (e) {
      return !suchtext || String(e.name || '').toLowerCase().indexOf(suchtext) >= 0;
    });

    treffer.forEach(function (eintrag) {
      var li = document.createElement('li');
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = eintrag.name || 'Unbekannt';
      btn.addEventListener('click', function () {
        showBild(eintrag);
      });
      li.appendChild(btn);
      trefferliste.appendChild(li);
    });

    keineTreffer.classList.toggle('hidden', treffer.length > 0);
  }

  function direktaufruf() {
    var src = params.get('src') || params.get('bild') || params.get('img') || '';
    var boden = params.get('boden') || '';
    var spalte = params.get('spalte') || params.get('Spalte') || '';
    var reihe = params.get('reihe') || params.get('Reihe') || '';
    var url = src || (boden ? BILDER_PFAD + boden : '');

    if (!url) {
      return false;
    }

    showBild({ bild: url, spalte: spalte, reihe: reihe });
    return true;
  }

  function ladeDaten() {
    return fetch(assetUrl(DATEN_DATEI), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : []; })
      .catch(function () { return []; })
      .then(function (data) {
        eintraege = Array.isArray(data) ? data : [];
        renderTreffer('');
      });
  }

  suchfeld.addEventListener('input', function () {
    renderTreffer(suchfeld.value);
  });

  zurueck.addEventListener('click', showSuche);
  viewport.addEventListener('wheel', onWheel, { passive: false });

  bild.addEventListener('error', function () {
    bild.alt = 'Bild konnte nicht geladen werden';
  });

  if (!direktaufruf()) {
    ladeDaten();
    suchfeld.focus();
  }
})();
