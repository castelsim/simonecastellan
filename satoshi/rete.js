/* Variante «metropolitana». © 2026 Simone Castellan.
   Una sola idea in due orientamenti: su schermo largo il tempo scorre in
   orizzontale e i nomi delle corsie inseguono la loro linea da sinistra;
   sul telefono la mappa gira, il tempo scende e i nomi inseguono dall'alto.
   In tutti e due i casi, dove le linee si uniscono resta un nome solo. */
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const $ = id => document.getElementById(id);
  const svg = $('rete'), mappa = $('mappa'), foglio = $('foglio');
  const corsieFisse = $('corsieFisse'), legenda = $('legenda');
  const doveSono = $('doveSono'), cursore = $('cursore');

  const VICINI = 15;            // sotto questa distanza due nomi sono lo stesso punto
  const ANCORA = 150;           // dove i nomi leggono la posizione della loro linea

  /* misure dei due orientamenti */
  const ORIZZ = { inizio: 172, corsia0: 96, passoCorsia: 34, coda: 200, livelli: [-15, -34] };
  const VERT  = { inizio: 54,  corsia0: 30, passoCorsia: 44, coda: 140, testo: 26 };

  const ordinati = NODI.map((n, i) => ({ ...n, _i: i }))
                       .sort((a, b) => a.anno - b.anno || a._i - b._i);
  const iConv = ordinati.findIndex(n => n.id === 'whitepaper');

  const fai = (tag, attr, testo) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attr) e.setAttribute(k, attr[k]);
    if (testo != null) e.textContent = testo;
    return e;
  };
  const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c;
    if (x != null) e.textContent = x; return e; };

  const vert = () => window.matchMedia('(max-width: 900px)').matches;
  const indice = new Map();
  const percorsi = {};
  let PASSO = 96, modo = 'tutta', filtro = null, scelto = null, apertoIdx = -1;
  let corsie = {}, tronco = 0, misure = ORIZZ;

  /* ── disegno ──────────────────────────────────────────────────────── */
  function disegna() {
    const V = vert();
    misure = V ? VERT : ORIZZ;
    document.body.classList.toggle('verticale', V);

    corsie = {};
    TRACCE.forEach((t, k) => { corsie[t.id] = misure.corsia0 + k * misure.passoCorsia; });
    tronco = misure.corsia0 + 2 * misure.passoCorsia;
    corsie.tronco = tronco;

    const T = i => misure.inizio + i * PASSO;               // asse del tempo
    const P = (i, c) => V ? { x: c, y: T(i) } : { x: T(i), y: c };

    const tConv = T(iConv), tUlt = T(ordinati.length - 1);
    let coda = misure.coda;
    if (!V) coda = Math.max(200, mappa.clientWidth - (tUlt - tConv) - ANCORA + 90);
    const lungo = tUlt + coda;
    const largo = misure.corsia0 + (TRACCE.length - 1) * misure.passoCorsia + (V ? 190 : 58);

    const w = V ? Math.max(largo, mappa.clientWidth || 360) : lungo;
    const h = V ? lungo : largo;
    svg.innerHTML = '';
    indice.clear();
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    if (V) { svg.style.width = '100%'; svg.style.height = 'auto'; }
    else { svg.style.width = ''; svg.style.height = ''; }

    const defs = fai('defs');
    defs.innerHTML = `<linearGradient id="sfumaFine" x1="0" y1="0" x2="${V ? 0 : 1}" y2="${V ? 1 : 0}">` +
      '<stop offset="0%" stop-color="#14161a"/><stop offset="72%" stop-color="#14161a"/>' +
      '<stop offset="100%" stop-color="#14161a" stop-opacity="0"/></linearGradient>';
    svg.appendChild(defs);

    /* le cinque corsie, che confluiscono */
    TRACCE.forEach(t => {
      const suoi = ordinati.map((n, i) => ({ n, i })).filter(o => o.n.traccia === t.id);
      if (!suoi.length) return;
      const c = corsie[t.id], tUltimo = T(suoi[suoi.length - 1].i);
      const a = V ? `M ${c} 0 L ${c} ${tUltimo}` : `M 0 ${c} L ${tUltimo} ${c}`;
      const m1 = tUltimo + (tConv - tUltimo) * .45, m2 = tConv - (tConv - tUltimo) * .45;
      const b = V ? ` C ${c} ${m1} ${tronco} ${m2} ${tronco} ${tConv}`
                  : ` C ${m1} ${c} ${m2} ${tronco} ${tConv} ${tronco}`;
      const p = fai('path', { d: a + b, class: 'linea' });
      p.dataset.traccia = t.id;
      svg.appendChild(p);
      percorsi[t.id] = campiona(p);
    });

    /* il tronco, che poi si dissolve */
    const fine = tUlt + (V ? 90 : 76);
    svg.appendChild(fai('path', {
      d: V ? `M ${tronco} ${tConv} L ${tronco} ${fine}` : `M ${tConv} ${tronco} L ${fine} ${tronco}`,
      class: 'linea linea-viva', stroke: 'url(#sfumaFine)'
    }));

    /* le stazioni */
    let annoScritto = null;
    const xTesto = misure.corsia0 + (TRACCE.length - 1) * misure.passoCorsia + VERT.testo;
    ordinati.forEach((n, i) => {
      const c = (n.traccia === 'tronco' || i >= iConv) ? tronco : corsie[n.traccia];
      const pt = P(i, c);
      const g = fai('g', { class: 'stazione', role: 'button', tabindex: '0',
                           'aria-pressed': 'false', id: 's-' + n.id });
      g.dataset.id = n.id; g.dataset.traccia = n.traccia;
      if (n.traccia === 'tronco') g.dataset.tronco = '1';
      if (n.cardine) g.dataset.cardine = '1';

      g.appendChild(fai('rect', { class: 'presa',
        x: V ? pt.x - 20 : pt.x - PASSO / 2, y: V ? pt.y - PASSO / 2 : pt.y - 46,
        width: V ? w - pt.x + 20 : PASSO, height: V ? PASSO : 70 }));
      g.appendChild(fai('circle', { class: 'bolla', cx: pt.x, cy: pt.y,
        r: n.cardine ? 7.5 : (n.traccia === 'tronco' ? 6 : 5.5) }));

      if (V) {
        g.appendChild(fai('text', { x: xTesto, y: pt.y - 6, class: 'anno' }, n.data && n.data.length < 17 ? n.data : String(n.anno)));
        g.appendChild(fai('text', { x: xTesto, y: pt.y + 11, class: 'nome' }, n.breve || n.titolo));
      } else {
        if (n.anno !== annoScritto) {
          g.appendChild(fai('text', { x: pt.x, y: pt.y + 22, 'text-anchor': 'middle', class: 'anno' }, n.anno));
          annoScritto = n.anno;
        }
        g.appendChild(fai('text', { x: pt.x, y: pt.y + ORIZZ.livelli[i % 2],
                                    'text-anchor': 'middle', class: 'nome' }, n.breve || n.titolo));
      }
      g.addEventListener('click', () => apri(i));
      g.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); apri(i); }
      });
      svg.appendChild(g);
      indice.set(n.id, { dato: n, nodo: g, t: T(i), i });
    });
    if (filtro) accendi(filtro);
  }

  function campiona(path, n = 240) {
    const L = path.getTotalLength(), out = [];
    for (let k = 0; k <= n; k++) { const p = path.getPointAtLength(L * k / n); out.push({ x: p.x, y: p.y }); }
    return out;
  }
  /* dato un punto sull'asse del tempo, dov'è la linea sull'asse delle corsie */
  function corsiaAlTempo(camp, t) {
    if (!camp || !camp.length) return null;
    const V = vert();
    const T = p => V ? p.y : p.x, C = p => V ? p.x : p.y;
    if (t <= T(camp[0])) return C(camp[0]);
    if (t >= T(camp[camp.length - 1])) return C(camp[camp.length - 1]);
    let a = 0, b = camp.length - 1;
    while (b - a > 1) { const m = (a + b) >> 1; (T(camp[m]) <= t) ? a = m : b = m; }
    const k = (t - T(camp[a])) / ((T(camp[b]) - T(camp[a])) || 1);
    return C(camp[a]) + (C(camp[b]) - C(camp[a])) * k;
  }

  /* ── i nomi che inseguono la loro linea ───────────────────────────── */
  const bandiere = [];
  TRACCE.forEach(t => {
    const b = el('button', null, t.nome);
    b.type = 'button';
    b.dataset.lungo = t.nome; b.dataset.corto = t.corto || t.nome;
    b.setAttribute('aria-pressed', 'false');
    b.title = t.sintesi; b.dataset.traccia = t.id;
    b.addEventListener('click', () => filtra(t.id));
    corsieFisse.appendChild(b);
    bandiere.push({ id: t.id, nodo: b });
  });
  const unione = el('button', 'unione svanita', 'Bitcoin');
  unione.type = 'button'; unione.dataset.traccia = 'tronco';
  unione.setAttribute('aria-pressed', 'false');
  unione.title = 'Dal 2008 in poi le cinque strade sono una sola';
  unione.addEventListener('click', () => filtra('tronco'));
  corsieFisse.appendChild(unione);

  function muoviNomi() {
    const V = vert();
    const r = svg.getBoundingClientRect();
    const scala = V ? (r.width / (+svg.getAttribute('width') || 1))
                    : (r.height / (+svg.getAttribute('height') || 1));
    if (!scala) return;

    /* il punto della mappa in cui i nomi "leggono" la loro linea */
    const tLettura = V
      ? (corsieFisse.getBoundingClientRect().bottom - r.top) / scala + 26
      : (mappa.scrollLeft + ANCORA) / scala;

    const punti = bandiere.map(b => ({ b, c: corsiaAlTempo(percorsi[b.id], tLettura) }))
                          .filter(p => p.c != null)
                          .sort((a, b) => a.c - b.c);
    const tutteFuse = punti.length > 0 && punti.every(p => Math.abs(p.c - tronco) < 1.2);

    let precedente = -999;
    punti.forEach(p => {
      const px = p.c * scala;
      p.b.nodo.style[V ? 'left' : 'top'] = px + 'px';
      p.b.nodo.style[V ? 'top' : 'left'] = '';
      p.b.nodo.textContent = V ? p.b.nodo.dataset.corto : p.b.nodo.dataset.lungo;
      const sovrapposto = (px - precedente) < (V ? 40 : VICINI);
      p.b.nodo.classList.toggle('svanita', tutteFuse || sovrapposto);
      if (!sovrapposto) precedente = px;
    });
    unione.style[V ? 'left' : 'top'] = (tronco * scala) + 'px';
    unione.style[V ? 'top' : 'left'] = '';
    unione.classList.toggle('svanita', !tutteFuse);

    /* righello e avanzamento */
    const tCentro = V
      ? (-r.top + window.innerHeight / 2) / scala
      : (mappa.scrollLeft + mappa.clientWidth / 2) / scala;
    let vicino = ordinati[0];
    for (const n of ordinati) { const v = indice.get(n.id); if (v && v.t <= tCentro) vicino = n; else break; }
    if (doveSono) doveSono.textContent = vicino.anno;
    if (cursore && !V) {
      const tot = mappa.scrollWidth - mappa.clientWidth;
      cursore.style.width = (tot > 0 ? (mappa.scrollLeft / tot) * 100 : 0) + '%';
    }
  }

  let inCoda = false;
  const aggiorna = () => {
    if (inCoda) return;
    inCoda = true;
    requestAnimationFrame(() => { inCoda = false; muoviNomi(); });
  };
  mappa.addEventListener('scroll', aggiorna, { passive: true });
  addEventListener('scroll', aggiorna, { passive: true });
  let ridisegna;
  addEventListener('resize', () => {
    clearTimeout(ridisegna);
    ridisegna = setTimeout(() => { adatta(); muoviNomi(); }, 120);
  });

  /* ── zoom (solo in orizzontale) ───────────────────────────────────── */
  const btnTutta = $('tutta'), btnDetta = $('detta');
  function adatta() {
    if (vert()) PASSO = 76;
    else if (modo === 'tutta') {
      const utile = mappa.clientWidth - ORIZZ.inizio - 200;
      PASSO = Math.max(52, Math.min(96, utile / (ordinati.length - 1)));
    } else PASSO = 112;
    disegna();
  }
  const cambiaModo = m => {
    modo = m;
    btnTutta.setAttribute('aria-pressed', String(m === 'tutta'));
    btnDetta.setAttribute('aria-pressed', String(m === 'detta'));
    adatta(); muoviNomi();
  };
  btnTutta.addEventListener('click', () => cambiaModo('tutta'));
  btnDetta.addEventListener('click', () => cambiaModo('detta'));

  /* ── filtro ───────────────────────────────────────────────────────── */
  function accendi(t) {
    mappa.classList.add('filtra');
    indice.forEach(v => v.nodo.classList.toggle('acceso',
      v.dato.traccia === t || v.dato.traccia === 'tronco'));
    svg.querySelectorAll('.linea').forEach(p => p.classList.toggle('acceso', p.dataset.traccia === t));
  }
  function filtra(t) {
    const spegni = filtro === t;
    filtro = spegni ? null : t;
    [...bandiere.map(b => b.nodo), unione].forEach(b =>
      b.setAttribute('aria-pressed', String(b.dataset.traccia === filtro)));
    legenda.querySelectorAll('button').forEach(b =>
      b.setAttribute('aria-pressed', String(b.dataset.traccia === filtro)));
    if (spegni) {
      mappa.classList.remove('filtra');
      indice.forEach(v => v.nodo.classList.remove('acceso'));
      svg.querySelectorAll('.linea').forEach(p => p.classList.remove('acceso'));
    } else accendi(t);
  }
  TRACCE.forEach(t => {
    const b = el('button'); b.type = 'button'; b.dataset.traccia = t.id;
    b.setAttribute('aria-pressed', 'false');
    b.appendChild(el('b', null, t.nome));
    b.addEventListener('click', () => filtra(t.id));
    legenda.appendChild(b);
  });

  /* ── dettaglio ────────────────────────────────────────────────────── */
  function apri(i, fermo) {
    const n = ordinati[i]; if (!n) return;
    const v = indice.get(n.id); if (!v) return;
    if (scelto) { const p = indice.get(scelto); if (p) p.nodo.setAttribute('aria-pressed', 'false'); }
    scelto = n.id; apertoIdx = i;
    v.nodo.setAttribute('aria-pressed', 'true');

    foglio.innerHTML = '';
    const sx = el('div'), dx = el('div');
    sx.appendChild(el('span', 'data', n.data || String(n.anno)));
    sx.appendChild(el('h2', null, n.titolo));
    if (n.chi) sx.appendChild(el('span', 'attore', n.chi));
    dx.appendChild(el('p', 'corpo', n.testo));
    if (n.perche) { const w = el('div', 'perche'); w.appendChild(el('b', null, 'Perché conta'));
      w.appendChild(document.createTextNode(n.perche)); dx.appendChild(w); }
    if (n.fonte) { const a = el('a', 'fonte', n.fonte.testo); a.href = n.fonte.url;
      a.target = '_blank'; a.rel = 'noopener'; dx.appendChild(a); }
    foglio.appendChild(sx); foglio.appendChild(dx);

    const passi = el('div', 'passi');
    const pre = el('button', null, '← Prima'), pro = el('button', null, 'Dopo →');
    pre.type = pro.type = 'button';
    pre.disabled = i === 0; pro.disabled = i === ordinati.length - 1;
    pre.addEventListener('click', () => apri(i - 1));
    pro.addEventListener('click', () => apri(i + 1));
    passi.appendChild(pre); passi.appendChild(pro);
    foglio.appendChild(passi);
    history.replaceState(null, '', '#' + n.id);

    if (!fermo && !vert() && mappa.scrollWidth > mappa.clientWidth) {
      mappa.scrollTo({ left: Math.max(0, v.t - mappa.clientWidth / 2), behavior: 'smooth' });
    }
  }

  document.addEventListener('keydown', e => {
    const avanti = vert() ? 'ArrowDown' : 'ArrowRight';
    const indietro = vert() ? 'ArrowUp' : 'ArrowLeft';
    if (e.key !== avanti && e.key !== indietro) return;
    if (apertoIdx < 0 && !document.activeElement.classList.contains('stazione')) return;
    e.preventDefault();
    const i = apertoIdx >= 0 ? apertoIdx
            : ordinati.findIndex(n => n.id === document.activeElement.dataset.id);
    const k = i + (e.key === avanti ? 1 : -1);
    if (ordinati[k]) { apri(k); const v = indice.get(ordinati[k].id);
      if (v) v.nodo.focus({ preventScroll: true }); }
  });

  /* trascinare la mappa, solo dove scorre in orizzontale */
  let giu = false, x0 = 0, s0 = 0;
  mappa.addEventListener('pointerdown', e => {
    if (vert() || e.target.closest('.stazione')) return;
    giu = true; x0 = e.clientX; s0 = mappa.scrollLeft; mappa.classList.add('trascino');
  });
  addEventListener('pointerup', () => { giu = false; mappa.classList.remove('trascino'); });
  addEventListener('pointermove', e => { if (giu) mappa.scrollLeft = s0 - (e.clientX - x0); });

  /* ── le schede in fondo: i nomi che ricorrono, e le piste chiuse ──── */
  const box = document.querySelector('.schede');
  CANDIDATI.forEach(k => {
    const s = el('article', 'scheda');
    const h = el('h3', null, k.nome); h.appendChild(el('span', null, k.vissuto));
    s.appendChild(h);
    s.appendChild(el('p', 'cosa', k.cosa));
    const bil = el('div', 'bilancia');
    bil.appendChild(el('div', 'pro', k.a_favore));
    bil.appendChild(el('div', 'contro', k.contro));
    s.appendChild(bil);
    if (k.fonte) { const a = el('a', 'fonte-s', k.fonte.testo); a.href = k.fonte.url;
      a.target = '_blank'; a.rel = 'noopener'; s.appendChild(a); }
    box.appendChild(s);
  });
  const boxC = document.querySelector('.chiuse');
  CHIUSE.forEach(k => {
    const d = el('div', 'chiusa');
    const h = el('h3', null, k.nome); h.appendChild(el('span', null, k.anno));
    d.appendChild(h);
    d.appendChild(el('p', null, k.testo));
    boxC.appendChild(d);
  });

  const parti = () => {
    adatta(); muoviNomi();
    const anc = location.hash.slice(1);
    const k = ordinati.findIndex(n => n.id === anc);
    if (k >= 0) setTimeout(() => apri(k), 200);
  };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(parti);
  else addEventListener('load', parti);
})();
