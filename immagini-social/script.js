/* Immagini per i social — una foto, tutti i formati.

   Tre idee tengono in piedi tutto il resto:

   1. UN SOLO PUNTO FOCALE. Sedici formati regolati uno per uno sarebbero un
      lavoro, non uno strumento. Si dice una volta sola dov'è il soggetto —
      trascinando una qualsiasi anteprima — e tutte si allineano.

   2. CHI SI TOCCA, SI STACCA. Appena si usa un comando su una destinazione
      (zoom, Adatta, Ruota) quella diventa indipendente: da lì in poi si muove
      da sola e lo dichiara con l'etichetta «da sola». «Azzera» la rimette nel
      gruppo. Così il caso veloce resta veloce e il caso difficile è possibile.

   3. NON SI DEFORMA MAI. «Riempi» taglia mantenendo le proporzioni del formato;
      «Adatta» mette la foto intera dentro il formato su uno sfondo a tinta
      unita. In nessuno dei due casi l'immagine viene stirata. E se la foto ha
      pochi pixel non viene ingrandita oltre il doppio: esce più piccola e lo
      si scrive.

   Niente librerie: bastano createImageBitmap, canvas e una manciata di righe
   per scrivere uno ZIP. */

var sorgente = null;        // ImageBitmap a piena risoluzione, per l'esportazione
var lavoro = null;          // copia ridotta, per disegnare le anteprime senza far fumare il telefono
var nomeBase = '';
var haTrasparenza = false;
var formatoScelto = 'auto';

var attiva = 'tutte';       // una piattaforma alla volta, oppure «tutte»
var fuoco = { x: 0.5, y: 0.5 };
var soli = {};              // chiave voce → stato di chi si è staccato dal gruppo
var ALTEZZA_TELA = 172;     // px dell'anteprima; la larghezza segue le proporzioni
var SFONDI = [['#ffffff', 'bianco'], ['#0d1313', 'nero'], ['#8ca39e', 'grigio']];
var mostraCoperto = false;  // il velo sulle zone che la piattaforma si prende
var voci = [];              // una per anteprima disegnata

var LATO_LAVORO = 1600;     // oltre non serve: le anteprime sono piccole
var MAX_PIXEL = 80e6;       // ~80 megapixel: oltre, il browser rischia di non farcela

var dropZone  = document.getElementById('dropZone');
var pickBtn   = document.getElementById('pickBtn');
var fileInput = document.getElementById('fileInput');
var statusBox = document.getElementById('status');
var statusText= document.getElementById('statusText');
var erroreBox = document.getElementById('error');
var erroreMsg = document.getElementById('erroreMsg');
var lavoroBox = document.getElementById('lavoro');
var scelteBox = document.getElementById('scelte');
var risultati = document.getElementById('risultati');
var nomeFoto  = document.getElementById('nomeFoto');
var zipBtn    = document.getElementById('zipBtn');
var condividiBtn = document.getElementById('condividiBtn');
var formatoSeg= document.getElementById('formatoSeg');
var toast     = document.getElementById('toast');

function mostra(el, si) { if (el) el.classList.toggle('hidden', !si); }
function avvisa(testo) {
  toast.textContent = testo;
  toast.classList.add('show');
  setTimeout(function () { toast.classList.remove('show'); }, 1600);
}
function pesa(b) {
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return Math.round(b / 1024) + ' KB';
  return (Math.round(b / 1024 / 102.4) / 10).toString().replace('.', ',') + ' MB';
}

// --- Ritaglio ---------------------------------------------------------------

/* Il rettangolo più grande con le proporzioni chieste che sta dentro la foto,
   stretto dallo zoom e centrato sul punto focale. Non esce mai dai bordi:
   niente bande nere, niente immagine stirata. */
function ritaglio(sw, sh, tw, th, fx, fy, z) {
  var r = tw / th, cw, ch;
  if (sw / sh > r) { ch = sh; cw = ch * r; } else { cw = sw; ch = cw / r; }
  cw /= z; ch /= z;
  var x = fx * sw - cw / 2;
  var y = fy * sh - ch / 2;
  x = Math.max(0, Math.min(sw - cw, x));
  y = Math.max(0, Math.min(sh - ch, y));
  return { x: x, y: y, w: cw, h: ch };
}

/* Lo stato di una destinazione: quello del gruppo finché non si stacca. */
function statoDi(chiave) {
  return soli[chiave] || { x: fuoco.x, y: fuoco.y, zoom: 1, modo: 'riempi',
                           sfondo: '#ffffff', ruota: 0 };
}
/* Toccare un comando stacca la destinazione dal gruppo: da lì in poi vive di
   vita propria. Restituisce lo stato scrivibile. */
function stacca(chiave) {
  if (!soli[chiave]) {
    var s = statoDi(chiave);
    soli[chiave] = { x: s.x, y: s.y, zoom: s.zoom, modo: s.modo,
                     sfondo: s.sfondo, ruota: s.ruota };
  }
  return soli[chiave];
}

// --- Le voci da mostrare ----------------------------------------------------

function costruisciVoci() {
  voci = [];
  SOCIAL_FORMATI.forEach(function (p) {
    if (attiva !== 'tutte' && attiva !== p.id) return;
    p.formati.forEach(function (f) {
      voci.push({
        chiave: p.id + '/' + f.id,
        piattaforma: p.nome,
        piattaformaId: p.id,
        etichetta: f.etichetta,
        nota: f.nota || '',
        w: f.w, h: f.h,
        coperto: zonaCoperta(p.id, f.uso)     // null dove non c'è niente da coprire
      });
    });
  });
}

/* Ruotare la sorgente una volta sola costa meno che ruotare a ogni disegno, e
   soprattutto lascia intatto tutto il resto del codice: ritaglio, misure e
   riduzione lavorano su un'immagine normale, che sia girata o no. */
var cacheRuota = {};
function ruotata(img, gradi) {
  gradi = ((gradi % 360) + 360) % 360;
  if (!gradi) return img;
  var k = (img === sorgente ? 'S' : 'L') + gradi;
  if (cacheRuota[k]) return cacheRuota[k];
  var giro = gradi % 180 !== 0;
  var c = document.createElement('canvas');
  c.width = giro ? img.height : img.width;
  c.height = giro ? img.width : img.height;
  var g = c.getContext('2d');
  g.translate(c.width / 2, c.height / 2);
  g.rotate(gradi * Math.PI / 180);
  g.drawImage(img, -img.width / 2, -img.height / 2);
  cacheRuota[k] = c;
  return c;
}
function scordaRotazioni() {
  Object.keys(cacheRuota).forEach(function (k) { cacheRuota[k].width = 0; });
  cacheRuota = {};
}

/* Il disegno vero, uguale per l'anteprima e per il file esportato: cambia solo
   la sorgente (ridotta o piena) e la misura del bersaglio. Se le due strade
   fossero separate, l'anteprima mentirebbe. */
function componi(g, cw, ch, img, voce, s) {
  var src = ruotata(img, s.ruota);
  if (s.modo === 'adatta') {
    g.fillStyle = s.sfondo;
    g.fillRect(0, 0, cw, ch);
    var k = Math.min(cw / src.width, ch / src.height) * s.zoom;
    var dw = src.width * k, dh = src.height * k;
    // x/y spostano l'immagine dentro la cornice, ma solo per la parte che sborda
    var x = (cw - dw) / 2 + (s.x - 0.5) * Math.max(0, dw - cw);
    var y = (ch - dh) / 2 + (s.y - 0.5) * Math.max(0, dh - ch);
    g.imageSmoothingQuality = 'high';
    g.drawImage(src, x, y, dw, dh);
  } else {
    var r = ritaglio(src.width, src.height, voce.w, voce.h, s.x, s.y, s.zoom);
    g.imageSmoothingQuality = 'high';
    g.drawImage(src, r.x, r.y, r.w, r.h, 0, 0, cw, ch);
  }
}

function disegnaAnteprima(voce) {
  var c = voce.canvas;
  var s = statoDi(voce.chiave);
  var g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  componi(g, c.width, c.height, lavoro, voce, s);
  if (mostraCoperto && voce.coperto) velo(g, c, voce.coperto);
}

/* Il velo sulle zone dove la piattaforma mette la sua roba addosso: in una
   Story il nome di chi pubblica sta in alto e la barra per rispondere in
   basso, su TikTok c'è anche la colonna dei pulsanti a destra. Serve a
   guardare, non finisce mai nel file esportato. */
function velo(g, c, z) {
  g.save();
  g.fillStyle = 'rgba(20,20,20,.55)';
  var alto = Math.round(c.height * (z.alto || 0));
  var basso = Math.round(c.height * (z.basso || 0));
  var sin = Math.round(c.width * (z.sinistra || 0));
  var des = Math.round(c.width * (z.destra || 0));
  if (alto) g.fillRect(0, 0, c.width, alto);
  if (basso) g.fillRect(0, c.height - basso, c.width, basso);
  if (sin) g.fillRect(0, alto, sin, c.height - alto - basso);
  if (des) g.fillRect(c.width - des, alto, des, c.height - alto - basso);
  // L'angolo dove YouTube stampa la durata del video.
  if (z.angoloDurata) {
    var w = Math.round(c.width * 0.22), h = Math.round(c.height * 0.14);
    g.fillRect(c.width - w - 4, c.height - h - 4, w, h);
  }
  g.strokeStyle = 'rgba(255,255,255,.75)';
  g.lineWidth = 1;
  g.setLineDash([3, 3]);
  g.strokeRect(sin + 0.5, alto + 0.5, c.width - sin - des - 1, c.height - alto - basso - 1);
  g.restore();
}

function disegnaTutte() { voci.forEach(disegnaAnteprima); }

var INGRANDIMENTO_MAX = 2;   // oltre il doppio si vede, sotto no

/* Misura vera dell'uscita.

   Una foto orizzontale ritagliata a 9:16 lascia una striscia stretta: se non
   la si ingrandisse mai, una Story uscirebbe 608×1080 invece di 1080×1920 e
   nessuno capirebbe perché. Quindi si ingrandisce fino alla misura giusta, ma
   non oltre il doppio: da lì in poi si vedrebbe, e allora si esce più piccoli
   dicendolo. */
function misuraUscita(voce) {
  var s = statoDi(voce.chiave);
  var src = ruotata(sorgente, s.ruota);
  if (s.modo === 'adatta') {
    /* Con lo sfondo la cornice è sempre piena: non c'è niente da ridurre. Resta
       da dire se la foto dentro viene ingrandita troppo per reggere. */
    var k = Math.min(voce.w / src.width, voce.h / src.height) * s.zoom;
    return { w: voce.w, h: voce.h, piena: k <= INGRANDIMENTO_MAX, adatta: true };
  }
  var r = ritaglio(src.width, src.height, voce.w, voce.h, s.x, s.y, s.zoom);
  var massimo = Math.round(r.w * INGRANDIMENTO_MAX);
  var w = Math.min(voce.w, Math.max(Math.round(r.w), massimo));
  var h = Math.round(w * voce.h / voce.w);
  return { w: w, h: h, ritaglio: r, piena: w >= voce.w, ingrandita: w > Math.round(r.w) };
}

/* Una riga per destinazione: l'anteprima a sinistra, il nome e i comandi a
   destra. I comandi stanno sempre in vista — sono quattro, e nasconderli
   dietro un clic per «pulizia» costa più di quanto renda. */
function schedaVoce(voce) {
  var box = document.createElement('div');
  box.className = 'dest';

  var telaBox = document.createElement('div');
  telaBox.className = 'telaBox';
  /* L'altezza passa da una variabile CSS e non da uno stile inline: così il
     foglio di stile può rimetterla ad «auto» sul telefono, dove l'anteprima va
     a piena larghezza. Con lo stile inline vincerebbe sempre lui e il riquadro
     taglierebbe l'immagine. */
  telaBox.style.setProperty('--h', ALTEZZA_TELA + 'px');

  var c = document.createElement('canvas');
  /* Le proporzioni devono essere ESATTE. Arrotondando larghezza e altezza
     separatamente il rapporto si sposta di qualche millesimo e un post 4:5 non
     è più 4:5: si riduce il formato ai minimi termini (1080×1350 → 4×5) e lo si
     moltiplica per un intero. La larghezza sullo schermo la calcola il browser
     dal rapporto del canvas (width:auto), così non si può sbagliare. */
  var g = mcd(voce.w, voce.h), rw = voce.w / g, rh = voce.h / g;
  var n = Math.max(1, Math.round(ALTEZZA_TELA * 2 / rh));   // ×2 per gli schermi fitti
  c.width = rw * n; c.height = rh * n;
  c.className = 'tela';
  c.setAttribute('role', 'img');
  c.setAttribute('tabindex', '0');
  c.setAttribute('aria-label', voce.piattaforma + ' ' + voce.etichetta +
                 ': trascina per spostare l\'inquadratura');
  telaBox.appendChild(c);
  box.appendChild(telaBox);
  voce.canvas = c;

  var dx = document.createElement('div');
  dx.className = 'dest-dx';

  var testa = document.createElement('div');
  testa.className = 'dest-testa';
  var nome = document.createElement('div');
  nome.className = 'dest-nome';
  nome.textContent = voce.etichetta;
  var mis = document.createElement('div');
  mis.className = 'dest-misura';
  testa.appendChild(nome);
  testa.appendChild(mis);
  if (voce.nota) {
    var nt = document.createElement('span');
    nt.className = 'dest-nota';
    nt.textContent = voce.nota;
    testa.appendChild(nt);
  }
  var sola = document.createElement('span');
  sola.className = 'dest-sola';
  sola.textContent = 'da sola';
  sola.hidden = true;
  testa.appendChild(sola);
  dx.appendChild(testa);
  voce.misuraEl = mis;
  voce.solaEl = sola;

  var st = statoDi(voce.chiave);

  var mods = document.createElement('div');
  mods.className = 'mods';

  var seg = document.createElement('div');
  seg.className = 'seg';
  [['riempi', 'Riempi'], ['adatta', 'Adatta']].forEach(function (m) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'mini' + (st.modo === m[0] ? ' on' : '');
    b.textContent = m[1];
    b.title = m[0] === 'riempi' ? 'Taglia per riempire il formato'
                                : 'Tiene tutta la foto e riempie il resto di colore';
    b.addEventListener('click', function () { stacca(voce.chiave).modo = m[0]; rifaiRisultati(); });
    seg.appendChild(b);
  });
  mods.appendChild(seg);

  var sf = document.createElement('span');
  sf.className = 'sfondi';
  sf.hidden = st.modo !== 'adatta';
  SFONDI.forEach(function (col) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'pastiglia' + (st.sfondo === col[0] ? ' on' : '');
    b.style.background = col[0];
    b.setAttribute('aria-label', 'Sfondo ' + col[1]);
    b.title = 'Sfondo ' + col[1];
    b.addEventListener('click', function () { stacca(voce.chiave).sfondo = col[0]; rifaiRisultati(); });
    sf.appendChild(b);
  });
  mods.appendChild(sf);

  var rot = document.createElement('button');
  rot.type = 'button';
  rot.className = 'mini';
  rot.textContent = 'Ruota';
  rot.setAttribute('aria-label', 'Ruota la foto di 90 gradi');
  rot.addEventListener('click', function () {
    var s2 = stacca(voce.chiave);
    s2.ruota = (s2.ruota + 90) % 360;
    disegnaAnteprima(voce);
    aggiornaEtichette();
  });
  mods.appendChild(rot);

  var azz = document.createElement('button');
  azz.type = 'button';
  azz.className = 'mini';
  azz.textContent = 'Azzera';
  azz.setAttribute('aria-label', 'Rimetti questa destinazione insieme alle altre');
  azz.addEventListener('click', function () { delete soli[voce.chiave]; rifaiRisultati(); });
  mods.appendChild(azz);

  var scarica = document.createElement('button');
  scarica.type = 'button';
  scarica.className = 'mini';
  scarica.textContent = 'Scarica';
  scarica.addEventListener('click', function () { scaricaUna(voce); });
  mods.appendChild(scarica);
  dx.appendChild(mods);

  var zr = document.createElement('div');
  zr.className = 'zoomriga';
  var lab = document.createElement('label');
  lab.textContent = 'Zoom';
  lab.setAttribute('for', 'zoom-' + voce.chiave.replace('/', '-'));
  var rng = document.createElement('input');
  rng.type = 'range'; rng.min = '100'; rng.max = '300'; rng.step = '1';
  rng.id = 'zoom-' + voce.chiave.replace('/', '-');
  rng.value = Math.round(st.zoom * 100);
  var val = document.createElement('span');
  val.className = 'zoomval';
  val.textContent = Math.round(st.zoom * 100) + '%';
  rng.addEventListener('input', function () {
    stacca(voce.chiave).zoom = Number(rng.value) / 100;
    val.textContent = rng.value + '%';
    disegnaAnteprima(voce);
    aggiornaEtichette();
  });
  zr.appendChild(lab); zr.appendChild(rng); zr.appendChild(val);
  dx.appendChild(zr);

  box.appendChild(dx);
  collegaTrascinamento(voce);
  return box;
}

function mcd(a, b) { return b ? mcd(b, a % b) : a; }

function aggiornaEtichette() {
  voci.forEach(function (v) {
    var m = misuraUscita(v);
    var testo = m.w + '×' + m.h;
    if (!m.piena) testo += m.adatta
      ? ' · la tua foto è piccola: dentro questa cornice si vedrà sgranata'
      : ' · la tua foto non ha abbastanza pixel per ' + v.w + '×' + v.h +
        ': più grande di così verrebbe sgranata';
    v.misuraEl.textContent = testo;
    v.misuraEl.classList.toggle('scarsa', !m.piena);
    v.solaEl.hidden = !soli[v.chiave];
  });
}

function rifaiRisultati() {
  costruisciVoci();
  risultati.innerHTML = '';
  var perPiattaforma = {};
  voci.forEach(function (v) {
    if (!perPiattaforma[v.piattaformaId]) {
      var g = document.createElement('div');
      g.className = 'gruppo';
      var h = document.createElement('h2');
      h.className = 'gruppo-nome';
      h.textContent = v.piattaforma;
      g.appendChild(h);
      var lista = document.createElement('div');
      lista.className = 'formati';
      g.appendChild(lista);
      risultati.appendChild(g);
      perPiattaforma[v.piattaformaId] = lista;
    }
    perPiattaforma[v.piattaformaId].appendChild(schedaVoce(v));
  });
  disegnaTutte();
  aggiornaEtichette();
  zipBtn.textContent = voci.length > 1 ? 'Scarica tutto (' + voci.length + ')' : 'Scarica';
  mostra(condividiBtn, !!navigator.canShare);
}

// --- Trascinamento ----------------------------------------------------------

function collegaTrascinamento(voce) {
  var c = voce.canvas;
  var attivo = false, ultimo = null;

  function muovi(dx, dy) {
    var s = statoDi(voce.chiave);
    var r = ritaglio(lavoro.width, lavoro.height, voce.w, voce.h, s.x, s.y, s.zoom);
    // Un dito che attraversa tutta l'anteprima sposta il ritaglio di tutta la
    // sua larghezza: il gesto corrisponde a quello che si vede.
    var nx = s.x - (dx / c.clientWidth) * (r.w / lavoro.width);
    var ny = s.y - (dy / c.clientHeight) * (r.h / lavoro.height);
    nx = Math.max(0, Math.min(1, nx));
    ny = Math.max(0, Math.min(1, ny));
    if (soli[voce.chiave]) {
      soli[voce.chiave].x = nx;
      soli[voce.chiave].y = ny;
      disegnaAnteprima(voce);
    } else {
      fuoco.x = nx; fuoco.y = ny;
      // Tutte insieme: è questo il punto: si dice una volta dov'è il soggetto.
      voci.forEach(function (v) { if (!soli[v.chiave]) disegnaAnteprima(v); });
    }
    aggiornaEtichette();
  }

  c.addEventListener('pointerdown', function (e) {
    attivo = true; ultimo = { x: e.clientX, y: e.clientY };
    c.setPointerCapture(e.pointerId);
    c.classList.add('in-mano');
  });
  c.addEventListener('pointermove', function (e) {
    if (!attivo) return;
    e.preventDefault();
    muovi(e.clientX - ultimo.x, e.clientY - ultimo.y);
    ultimo = { x: e.clientX, y: e.clientY };
  });
  ['pointerup', 'pointercancel'].forEach(function (ev) {
    c.addEventListener(ev, function () { attivo = false; c.classList.remove('in-mano'); });
  });

  // Da tastiera: le frecce spostano l'inquadratura di un passo.
  c.addEventListener('keydown', function (e) {
    var p = e.shiftKey ? 24 : 8;
    var d = { ArrowLeft: [p, 0], ArrowRight: [-p, 0], ArrowUp: [0, p], ArrowDown: [0, -p] }[e.key];
    if (!d) return;
    e.preventDefault();
    muovi(d[0], d[1]);
  });
}

// --- Esportazione -----------------------------------------------------------

function tipoUscita() {
  if (formatoScelto === 'jpg') return ['image/jpeg', '.jpg'];
  if (formatoScelto === 'png') return ['image/png', '.png'];
  if (formatoScelto === 'webp') return ['image/webp', '.webp'];
  return haTrasparenza ? ['image/png', '.png'] : ['image/jpeg', '.jpg'];
}

/* Rimpicciolire di colpo da 6000 a 1080 pixel lascia i bordi seghettati:
   si scende dimezzando, che è il modo in cui il browser interpola meglio. */
function riduciAGradini(sorgenteImg, r, w, h) {
  var cw = Math.round(r.w), ch = Math.round(r.h);
  var c = document.createElement('canvas');
  c.width = cw; c.height = ch;
  var g = c.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(sorgenteImg, r.x, r.y, r.w, r.h, 0, 0, cw, ch);

  while (cw > w * 2) {
    var nw = Math.max(w, Math.round(cw / 2));
    var nh = Math.max(h, Math.round(ch / 2));
    var c2 = document.createElement('canvas');
    c2.width = nw; c2.height = nh;
    var g2 = c2.getContext('2d');
    g2.imageSmoothingQuality = 'high';
    g2.drawImage(c, 0, 0, cw, ch, 0, 0, nw, nh);
    c.width = c.height = 0;
    c = c2; cw = nw; ch = nh; g = g2;
  }

  var fin = document.createElement('canvas');
  fin.width = w; fin.height = h;
  var gf = fin.getContext('2d');
  if (tipoUscita()[0] === 'image/jpeg') {           // il JPEG non ha trasparenza
    gf.fillStyle = '#ffffff';
    gf.fillRect(0, 0, w, h);
  }
  gf.imageSmoothingQuality = 'high';
  gf.drawImage(c, 0, 0, cw, ch, 0, 0, w, h);
  c.width = c.height = 0;
  return fin;
}

function nomeFile(voce, estensione) {
  return nomeBase + '_' + voce.piattaformaId + '-' + voce.chiave.split('/')[1] + estensione;
}

async function generaBlob(voce) {
  var m = misuraUscita(voce);
  var st = statoDi(voce.chiave);
  var tipo = tipoUscita();
  var canvas;
  if (m.adatta) {
    canvas = document.createElement('canvas');
    canvas.width = m.w; canvas.height = m.h;
    componi(canvas.getContext('2d'), m.w, m.h, sorgente, voce, st);
  } else {
    // il ritaglio è già calcolato sulla sorgente ruotata: qui si passa la stessa
    canvas = riduciAGradini(ruotata(sorgente, st.ruota), m.ritaglio, m.w, m.h);
  }
  var blob = await new Promise(function (r) {
    canvas.toBlob(function (b) { r(b); }, tipo[0], tipo[0] === 'image/png' ? undefined : 0.9);
  });
  canvas.width = canvas.height = 0;
  return { blob: blob, nome: nomeFile(voce, tipo[1]) };
}

/* Due voci che chiedono la stessa misura con lo stesso ritaglio danno lo
   stesso identico file: lo si calcola una volta e lo si salva con due nomi. */
async function generaTutti(passo) {
  var fatti = [], cache = {};
  for (var i = 0; i < voci.length; i++) {
    var v = voci[i];
    var m = misuraUscita(v);
    var st = statoDi(v.chiave);
    /* Due voci danno lo stesso file solo se coincidono anche i modificatori:
       senza questi pezzi nella chiave, una Story regolata a mano si ritroverebbe
       il file di un'altra identica per misura ma non per contenuto. */
    var chiave = m.w + 'x' + m.h + '|' + st.modo + '|' + st.ruota + '|' + st.sfondo + '|' +
                 (m.ritaglio ? Math.round(m.ritaglio.x) + ',' + Math.round(m.ritaglio.y) +
                               ',' + Math.round(m.ritaglio.w) : 'pieno') + '|' +
                 Math.round(st.x * 1000) + ',' + Math.round(st.y * 1000) + ',' + Math.round(st.zoom * 100);
    if (!cache[chiave]) cache[chiave] = (await generaBlob(v)).blob;
    fatti.push({ blob: cache[chiave], nome: nomeFile(v, tipoUscita()[1]) });
    if (passo) passo(i + 1, voci.length);
  }
  return fatti;
}

function scaricaBlob(blob, nome) {
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
}

async function scaricaUna(voce) {
  try {
    var f = await generaBlob(voce);
    scaricaBlob(f.blob, f.nome);
    avvisa(f.nome);
  } catch (e) { avvisa('non sono riuscito a salvare il file'); }
}

// --- ZIP (senza compressione: i JPEG sono già compressi) --------------------

var TABELLA_CRC = (function () {
  var t = new Uint32Array(256);
  for (var n = 0; n < 256; n++) {
    var c = n;
    for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  var c = 0xFFFFFFFF;
  for (var i = 0; i < bytes.length; i++) c = TABELLA_CRC[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/* Uno ZIP «store»: nessuna compressione, perché comprimere dei JPEG non
   guadagna niente e costerebbe una libreria intera. */
function creaZip(file) {
  var pezzi = [], centrale = [], offset = 0;
  var enc = new TextEncoder();

  function u16(v) { return [v & 0xFF, (v >>> 8) & 0xFF]; }
  function u32(v) { return [v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF]; }

  file.forEach(function (f) {
    var nome = enc.encode(f.nome);
    var crc = crc32(f.bytes);
    var testa = [].concat(
      u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(f.bytes.length), u32(f.bytes.length), u16(nome.length), u16(0)
    );
    pezzi.push(new Uint8Array(testa), nome, f.bytes);

    centrale.push({
      testa: [].concat(
        u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(crc), u32(f.bytes.length), u32(f.bytes.length), u16(nome.length),
        u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset)
      ),
      nome: nome
    });
    offset += testa.length + nome.length + f.bytes.length;
  });

  var inizioCentrale = offset, lunghezzaCentrale = 0;
  centrale.forEach(function (c) {
    pezzi.push(new Uint8Array(c.testa), c.nome);
    lunghezzaCentrale += c.testa.length + c.nome.length;
  });
  pezzi.push(new Uint8Array([].concat(
    u32(0x06054b50), u16(0), u16(0), u16(file.length), u16(file.length),
    u32(lunghezzaCentrale), u32(inizioCentrale), u16(0)
  )));

  return new Blob(pezzi, { type: 'application/zip' });
}

zipBtn.addEventListener('click', async function () {
  if (!voci.length) return;
  zipBtn.disabled = true;
  var testoPrima = zipBtn.textContent;
  try {
    var fatti = await generaTutti(function (i, n) { zipBtn.textContent = 'Preparo ' + i + ' di ' + n + '…'; });
    if (fatti.length === 1) {
      scaricaBlob(fatti[0].blob, fatti[0].nome);
    } else {
      zipBtn.textContent = 'Metto insieme lo zip…';
      var dentro = [];
      for (var i = 0; i < fatti.length; i++) {
        dentro.push({ nome: fatti[i].nome, bytes: new Uint8Array(await fatti[i].blob.arrayBuffer()) });
      }
      var zip = creaZip(dentro);
      scaricaBlob(zip, nomeBase + '_social.zip');
      avvisa(fatti.length + ' immagini · ' + pesa(zip.size));
    }
  } catch (e) {
    avvisa('non sono riuscito a preparare i file');
  }
  zipBtn.textContent = testoPrima;
  zipBtn.disabled = false;
});

condividiBtn.addEventListener('click', async function () {
  condividiBtn.disabled = true;
  try {
    var fatti = await generaTutti();
    var files = fatti.map(function (f) { return new File([f.blob], f.nome, { type: f.blob.type }); });
    if (navigator.canShare && navigator.canShare({ files: files })) {
      await navigator.share({ files: files, title: 'Immagini per i social' });
    } else {
      avvisa('questo dispositivo non sa condividere i file');
    }
  } catch (e) { /* annullato dall'utente */ }
  condividiBtn.disabled = false;
});

// --- Caricamento della foto -------------------------------------------------

function pulisci() {
  try { if (sorgente) sorgente.close(); } catch (e) {}
  try { if (lavoro && lavoro !== sorgente) lavoro.close(); } catch (e) {}
  sorgente = null; lavoro = null;
  soli = {};
  fuoco = { x: 0.5, y: 0.5 };
  // Le copie ruotate appartengono alla foto di prima: tenerle sarebbe una perdita
  // di memoria e, peggio, il rischio di disegnare la foto sbagliata.
  scordaRotazioni();
}

async function apri(file) {
  if (!/^image\//.test(file.type) && !/\.(jpe?g|png|webp|gif|bmp|avif|heic|heif)$/i.test(file.name)) {
    return errore('Questo non sembra un file di immagine.');
  }
  pulisci();
  mostra(erroreBox, false);
  mostra(lavoroBox, false);
  mostra(statusBox, true);
  statusText.textContent = 'Apro la foto…';

  var bmp;
  try {
    // «from-image» rispetta l'orientamento EXIF: senza, le foto scattate in
    // verticale escono coricate.
    bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch (e) {
    return errore(/heic|heif/i.test(file.name)
      ? 'Questo browser non sa aprire i file HEIC: esporta la foto in JPEG e riprova.'
      : 'Non riesco ad aprire questa immagine: potrebbe essere danneggiata.');
  }

  if (bmp.width * bmp.height > MAX_PIXEL) {
    bmp.close();
    return errore('Questa foto è enorme (' + Math.round(bmp.width * bmp.height / 1e6) +
                  ' megapixel): riducila un po\' e riprova.');
  }

  sorgente = bmp;
  nomeBase = file.name.replace(/\.[^.]+$/, '').replace(/[^\w\-. ]+/g, '').trim() || 'immagine';

  // Copia ridotta per le anteprime: si disegna decine di volte durante il
  // trascinamento, e trascinare un bitmap da 40 megapixel fa scattare tutto.
  var scala = Math.min(1, LATO_LAVORO / Math.max(bmp.width, bmp.height));
  lavoro = scala < 1
    ? await createImageBitmap(bmp, { resizeWidth: Math.round(bmp.width * scala), resizeQuality: 'high' })
    : bmp;

  haTrasparenza = /png|webp|gif|avif/i.test(file.type) && cercaTrasparenza(lavoro);

  nomeFoto.textContent = file.name + ' · ' + bmp.width + '×' + bmp.height;
  mostra(statusBox, false);
  mostra(lavoroBox, true);
  mostra(dropZone, false);
  document.querySelector('.claims').classList.add('hidden');
  rifaiRisultati();
}

/* Un'occhiata su una miniatura basta: se c'è trasparenza vera si vede subito,
   e non si paga il costo di leggere trenta megapixel. */
function cercaTrasparenza(img) {
  try {
    var c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    var g = c.getContext('2d');
    g.drawImage(img, 0, 0, 64, 64);
    var d = g.getImageData(0, 0, 64, 64).data;
    for (var i = 3; i < d.length; i += 4) if (d[i] < 250) return true;
  } catch (e) {}
  return false;
}

function errore(testo) {
  mostra(statusBox, false);
  mostra(lavoroBox, false);
  mostra(dropZone, true);
  erroreMsg.textContent = testo;
  mostra(erroreBox, true);
}

document.getElementById('erroreBtn').addEventListener('click', function () {
  mostra(erroreBox, false);
  fileInput.click();
});
document.getElementById('cambiaBtn').addEventListener('click', function () { fileInput.click(); });

// --- Comandi ----------------------------------------------------------------

/* Una piattaforma alla volta. «Tutte» resta in testa per chi pubblica lo stesso
   post su più social: senza, il caso più comune costerebbe due giri. */
function chip(id, nome) {
  var b = document.createElement('button');
  b.type = 'button';
  b.className = 'chip';
  b.textContent = nome;
  b.setAttribute('aria-pressed', attiva === id ? 'true' : 'false');
  b.addEventListener('click', function () {
    attiva = id;
    [].forEach.call(scelteBox.children, function (x) {
      x.setAttribute('aria-pressed', x === b ? 'true' : 'false');
    });
    rifaiRisultati();
  });
  return b;
}

function costruisciChip() {
  scelteBox.innerHTML = '';
  scelteBox.appendChild(chip('tutte', 'Tutte'));
  SOCIAL_FORMATI.forEach(function (p) { scelteBox.appendChild(chip(p.id, p.nome)); });
}
costruisciChip();

document.getElementById('copertoCheck').addEventListener('change', function () {
  mostraCoperto = this.checked;
  disegnaTutte();
});

document.getElementById('centraBtn').addEventListener('click', function () {
  fuoco = { x: 0.5, y: 0.5 };
  soli = {};
  rifaiRisultati();
});

formatoSeg.addEventListener('click', function (e) {
  var b = e.target.closest('.seg-btn');
  if (!b) return;
  formatoScelto = b.dataset.fmt;
  [].forEach.call(formatoSeg.querySelectorAll('.seg-btn'), function (x) { x.classList.toggle('active', x === b); });
});

// --- Ingresso file ----------------------------------------------------------

pickBtn.addEventListener('click', function (e) { e.stopPropagation(); fileInput.click(); });
dropZone.addEventListener('click', function () { fileInput.click(); });
dropZone.addEventListener('keydown', function (e) {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
});
fileInput.addEventListener('change', function () {
  if (fileInput.files[0]) apri(fileInput.files[0]);
  fileInput.value = '';
});

['dragenter', 'dragover'].forEach(function (ev) {
  dropZone.addEventListener(ev, function (e) { e.preventDefault(); dropZone.classList.add('dragover'); });
});
['dragleave', 'drop'].forEach(function (ev) {
  dropZone.addEventListener(ev, function (e) { e.preventDefault(); dropZone.classList.remove('dragover'); });
});
dropZone.addEventListener('drop', function (e) {
  if (e.dataTransfer && e.dataTransfer.files[0]) apri(e.dataTransfer.files[0]);
});
window.addEventListener('dragover', function (e) { e.preventDefault(); });
window.addEventListener('drop', function (e) { e.preventDefault(); });
