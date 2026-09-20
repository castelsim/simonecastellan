/* ══════════════════════════════════════════════════════════════════════
   simonecastellan.com/satoshi — costruzione dell'albero e interazione.
   © 2026 Simone Castellan.
   Le linee non sono disegnate a mano: si calcolano dalla posizione vera
   dei nodi dopo il layout, così restano giuste a ogni larghezza.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const $  = (s, c) => (c || document).querySelector(s);
  const el = (tag, cls, testo) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (testo != null) n.textContent = testo;
    return n;
  };

  const albero   = $('.albero');
  const griglia  = $('.griglia');
  const svg      = $('.rami');
  const pannello = $('.pannello');
  const capTracce = $('.tracce-riga');

  /* ordine cronologico: anno, poi ordine di dichiarazione */
  const ordinati = NODI.map((n, i) => ({ ...n, _i: i }))
                       .sort((a, b) => a.anno - b.anno || a._i - b._i);

  const CONVERGENZA = 'whitepaper';   // il punto in cui le tracce si chiudono
  const indice = new Map();           // id → { dato, bottone }
  let scelto = null;
  let traccaFiltrata = null;

  /* ── 1. Le intestazioni delle cinque tracce ─────────────────────────── */
  TRACCE.forEach(t => {
    const b = el('button', 'traccia-cap');
    b.type = 'button';
    b.setAttribute('aria-pressed', 'false');
    b.dataset.traccia = t.id;
    b.appendChild(el('b', null, t.nome));
    b.appendChild(el('span', null, t.sintesi));
    b.addEventListener('click', () => filtra(t.id));
    capTracce.appendChild(b);
  });
  capTracce.style.gridTemplateColumns = `repeat(${TRACCE.length}, minmax(0, 1fr))`;

  /* ── 2. La griglia dei nodi ─────────────────────────────────────────── */
  /* Due nodi dello stesso anno su tracce diverse condividono la riga:
     la mappa si accorcia senza che nulla si sovrapponga. Il tronco,
     che occupa tutta la larghezza, prende sempre una riga sua. */
  let riga = 0, annoDellaRiga = null, occupate = new Set();
  ordinati.forEach(n => {
    const condivide = n.anno === annoDellaRiga && n.traccia !== 'tronco'
                   && !occupate.has(n.traccia) && !occupate.has('tronco');
    if (!condivide) { riga++; occupate = new Set(); annoDellaRiga = n.anno; }
    occupate.add(n.traccia);
    n._riga = riga;
  });

  let annoPrecedente = null;
  ordinati.forEach(n => {
    const r = n._riga;

    if (n.anno !== annoPrecedente) {
      const a = el('div', 'anno' + (n.cardine ? ' cardine' : ''), String(n.anno));
      a.style.gridRow = r;
      griglia.appendChild(a);
      annoPrecedente = n.anno;
    }

    const b = el('button', 'nodo');
    b.type = 'button';
    b.id = 'n-' + n.id;
    b.dataset.id = n.id;
    b.dataset.tipo = n.tipo;
    b.dataset.traccia = n.traccia;
    b.setAttribute('aria-pressed', 'false');
    b.style.gridRow = r;

    if (n.traccia === 'tronco') {
      b.classList.add('tronco');
      if (n.cardine) b.classList.add('cardine');
      b.style.gridColumn = '2 / -1';
    } else {
      b.style.gridColumn = TRACCE.findIndex(t => t.id === n.traccia) + 2;
    }

    b.appendChild(el('i', 'segno'));
    b.appendChild(el('span', 'etichetta', n.titolo));
    if (n.chi) b.appendChild(el('span', 'chi', n.chi));

    b.addEventListener('click', () => apri(n.id));
    griglia.appendChild(b);
    indice.set(n.id, { dato: n, bottone: b });
  });

  /* ── 3. Le linee ────────────────────────────────────────────────────── */
  function centro(id) {
    const v = indice.get(id);
    if (!v) return null;
    const segno = $('.segno', v.bottone);
    const rs = segno.getBoundingClientRect();
    const rg = griglia.getBoundingClientRect();
    return { x: rs.left - rg.left + rs.width / 2, y: rs.top - rg.top + rs.height / 2 };
  }

  function disegna(anima) {
    const rg = griglia.getBoundingClientRect();
    if (!rg.height) return;
    svg.setAttribute('viewBox', `0 0 ${rg.width} ${rg.height}`);
    svg.innerHTML = '';

    const stretto = window.matchMedia('(max-width: 1000px)').matches;
    const conv = centro(CONVERGENZA);
    if (!conv) return;

    /* definizione dello sfumato finale: la linea si dissolve = la scomparsa */
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML =
      '<linearGradient id="dissolve" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="var(--inchiostro)"/>' +
      '<stop offset="62%" stop-color="var(--inchiostro)"/>' +
      '<stop offset="100%" stop-color="var(--inchiostro)" stop-opacity="0"/></linearGradient>';
    svg.appendChild(defs);

    const path = (d, cls) => {
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', d);
      p.setAttribute('class', cls);
      svg.appendChild(p);
      return p;
    };

    /* a) le cinque tracce della preistoria, che convergono */
    TRACCE.forEach(t => {
      const punti = ordinati.filter(n => n.traccia === t.id).map(n => centro(n.id)).filter(Boolean);
      if (!punti.length) return;

      let d = `M ${punti[0].x} ${punti[0].y}`;
      for (let i = 1; i < punti.length; i++) {
        const a = punti[i - 1], b = punti[i];
        d += (Math.abs(a.x - b.x) < 1)
          ? ` L ${b.x} ${b.y}`
          : ` C ${a.x} ${a.y + (b.y - a.y) * .5} ${b.x} ${b.y - (b.y - a.y) * .5} ${b.x} ${b.y}`;
      }
      /* dall'ultimo nodo della traccia, la curva verso il punto di convergenza */
      const u = punti[punti.length - 1];
      const dy = conv.y - u.y;
      d += stretto
        ? ` L ${u.x} ${conv.y}`
        : ` C ${u.x} ${u.y + dy * .55} ${conv.x} ${conv.y - dy * .42} ${conv.x} ${conv.y}`;

      const p = path(d, 'ramo');
      p.dataset.traccia = t.id;
      if (anima) {
        p.style.setProperty('--len', Math.ceil(p.getTotalLength()));
        p.classList.add('disegna');
      }
    });

    /* b) il tronco nero: dal white paper in giù, e poi si dissolve */
    const dopo = ordinati.filter(n => n.traccia === 'tronco' && n.anno >= 2008)
                         .filter(n => ordinati.findIndex(x => x.id === n.id) >=
                                      ordinati.findIndex(x => x.id === CONVERGENZA));
    const pt = dopo.map(n => centro(n.id)).filter(Boolean);
    if (pt.length > 1) {
      let d = `M ${pt[0].x} ${pt[0].y}`;
      pt.slice(1).forEach(p => { d += ` L ${p.x} ${p.y}`; });
      d += ` L ${pt[pt.length - 1].x} ${pt[pt.length - 1].y + 74}`;   // la coda che sfuma
      const p = path(d, 'ramo-vivo');
      p.setAttribute('stroke', 'url(#dissolve)');
      if (anima) {
        p.style.setProperty('--len', Math.ceil(p.getTotalLength()));
        p.classList.add('disegna');
      }
    }
    if (traccaFiltrata) accendi(traccaFiltrata);
  }

  /* ── 4. Il pannello ─────────────────────────────────────────────────── */
  function apri(id, muovi) {
    const v = indice.get(id);
    if (!v) return;
    const n = v.dato;

    if (scelto) {
      const p = indice.get(scelto);
      if (p) p.bottone.setAttribute('aria-pressed', 'false');
    }
    scelto = id;
    v.bottone.setAttribute('aria-pressed', 'true');

    pannello.innerHTML = '';
    const chiudi = el('button', 'chiudi', '×');
    chiudi.type = 'button';
    chiudi.setAttribute('aria-label', 'Chiudi');
    chiudi.addEventListener('click', chiudiPannello);
    pannello.appendChild(chiudi);

    pannello.appendChild(el('span', 'pannello-data', n.data || String(n.anno)));
    pannello.appendChild(el('h2', null, n.titolo));
    if (n.chi) pannello.appendChild(el('span', 'attore', n.chi));
    pannello.appendChild(el('p', 'corpo', n.testo));

    if (n.perche) {
      const w = el('div', 'perche');
      w.appendChild(el('b', null, 'Perché conta'));
      w.appendChild(document.createTextNode(n.perche));
      pannello.appendChild(w);
    }
    if (n.fonte) {
      const a = el('a', 'fonte', n.fonte.testo);
      a.href = n.fonte.url;
      a.target = '_blank';
      a.rel = 'noopener';
      pannello.appendChild(a);
    }
    pannello.classList.add('aperto');
    history.replaceState(null, '', '#' + id);

    if (muovi) v.bottone.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function chiudiPannello() {
    pannello.classList.remove('aperto');
    if (scelto) {
      const p = indice.get(scelto);
      if (p) p.bottone.setAttribute('aria-pressed', 'false');
    }
    scelto = null;
    history.replaceState(null, '', location.pathname);
  }

  /* ── 5. Il filtro per traccia ───────────────────────────────────────── */
  function accendi(t) {
    albero.classList.add('filtra');
    indice.forEach(v => v.bottone.classList.toggle('acceso',
      v.dato.traccia === t || v.dato.traccia === 'tronco'));
    svg.querySelectorAll('.ramo').forEach(p => p.classList.toggle('acceso', p.dataset.traccia === t));
  }

  function filtra(t) {
    const spegni = traccaFiltrata === t;
    traccaFiltrata = spegni ? null : t;
    capTracce.querySelectorAll('.traccia-cap').forEach(b =>
      b.setAttribute('aria-pressed', String(b.dataset.traccia === traccaFiltrata)));
    if (spegni) {
      albero.classList.remove('filtra');
      indice.forEach(v => v.bottone.classList.remove('acceso'));
      svg.querySelectorAll('.ramo').forEach(p => p.classList.remove('acceso'));
    } else {
      accendi(t);
    }
  }

  /* ── 6. Tastiera: si percorre la cronologia con le frecce ───────────── */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && scelto) { chiudiPannello(); return; }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const dentro = document.activeElement && document.activeElement.classList.contains('nodo');
    if (!dentro && !scelto) return;
    e.preventDefault();
    const i = ordinati.findIndex(n => n.id === (scelto || document.activeElement.dataset.id));
    const p = ordinati[i + (e.key === 'ArrowDown' ? 1 : -1)];
    if (p) { apri(p.id, true); indice.get(p.id).bottone.focus({ preventScroll: true }); }
  });

  /* ── 7. Avvio ───────────────────────────────────────────────────────── */
  const fermo = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const parti = () => {
    disegna(!fermo);
    const ancora = location.hash.slice(1);
    if (ancora && indice.has(ancora)) setTimeout(() => apri(ancora, true), 260);
  };

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(parti);
  else window.addEventListener('load', parti);

  let attesa;
  window.addEventListener('resize', () => {
    clearTimeout(attesa);
    attesa = setTimeout(() => disegna(false), 140);
  });

  /* ── 8. Le schede in fondo: candidati e piste chiuse ────────────────── */
  const box = $('.schede');
  CANDIDATI.forEach(c => {
    const s = el('article', 'scheda');
    const h = el('h3', null, c.nome);
    h.appendChild(el('span', null, c.vissuto));
    s.appendChild(h);
    s.appendChild(el('p', 'cosa', c.cosa));
    const b = el('div', 'bilancia');
    b.appendChild(el('div', 'pro', c.a_favore));
    b.appendChild(el('div', 'contro', c.contro));
    s.appendChild(b);
    if (c.fonte) {
      const a = el('a', 'fonte-s', c.fonte.testo);
      a.href = c.fonte.url; a.target = '_blank'; a.rel = 'noopener';
      s.appendChild(a);
    }
    box.appendChild(s);
  });

  const boxC = $('.chiuse');
  CHIUSE.forEach(c => {
    const d = el('div', 'chiusa');
    const h = el('h4', null, c.nome);
    h.appendChild(el('span', null, c.anno));
    d.appendChild(h);
    d.appendChild(el('p', null, c.testo));
    boxC.appendChild(d);
  });
})();
