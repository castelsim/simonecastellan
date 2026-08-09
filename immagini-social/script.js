/* Immagini per i social — una foto, tutti i formati.

   Due idee tengono in piedi tutto il resto:

   1. UN SOLO RITAGLIO. Sei piattaforme fanno sedici formati: regolarli uno per
      uno sarebbe un lavoro, non uno strumento. Qui c'è un punto focale solo —
      dove sta il soggetto — e ogni formato ci si allinea. Trascini dentro
      un'anteprima qualsiasi e si spostano tutte insieme; se un formato proprio
      non va, lo si stacca con «solo questa».

   2. SI TAGLIA, NON SI DEFORMA. Il ritaglio ha sempre le proporzioni del
      formato richiesto, e se la foto è più piccola non viene ingrandita: si
      esporta alla misura massima possibile e lo si scrive.

   Niente librerie: bastano createImageBitmap, canvas e una manciata di righe
   per scrivere uno ZIP. */

var sorgente = null;        // ImageBitmap a piena risoluzione, per l'esportazione
var lavoro = null;          // copia ridotta, per disegnare le anteprime senza far fumare il telefono
var nomeBase = '';
var haTrasparenza = false;
var formatoScelto = 'auto';

var attive = PIATTAFORME_INIZIALI.slice();
var fuoco = { x: 0.5, y: 0.5 };
var zoom = 1;
var staccati = {};          // chiave voce → { x, y, zoom } per chi è stato ritoccato da solo
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
var zoomInput = document.getElementById('zoom');
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

function statoDi(chiave) {
  return staccati[chiave] || { x: fuoco.x, y: fuoco.y, zoom: zoom };
}

// --- Le voci da mostrare ----------------------------------------------------

function costruisciVoci() {
  voci = [];
  PIATTAFORME.forEach(function (p) {
    if (attive.indexOf(p.id) === -1) return;
    p.formati.forEach(function (f) {
      voci.push({
        chiave: p.id + '/' + f.id,
        piattaforma: p.nome,
        piattaformaId: p.id,
        etichetta: f.etichetta,
        nota: f.nota || '',
        w: f.w, h: f.h
      });
    });
  });
}

function disegnaAnteprima(voce) {
  var c = voce.canvas;
  var s = statoDi(voce.chiave);
  var r = ritaglio(lavoro.width, lavoro.height, voce.w, voce.h, s.x, s.y, s.zoom);
  var g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  g.imageSmoothingQuality = 'high';
  g.drawImage(lavoro, r.x, r.y, r.w, r.h, 0, 0, c.width, c.height);
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
  var r = ritaglio(sorgente.width, sorgente.height, voce.w, voce.h, s.x, s.y, s.zoom);
  var massimo = Math.round(r.w * INGRANDIMENTO_MAX);
  var w = Math.min(voce.w, Math.max(Math.round(r.w), massimo));
  var h = Math.round(w * voce.h / voce.w);
  return { w: w, h: h, ritaglio: r, piena: w >= voce.w, ingrandita: w > Math.round(r.w) };
}

function schedaVoce(voce) {
  var box = document.createElement('div');
  box.className = 'formato';

  var c = document.createElement('canvas');
  // L'anteprima è piccola per davvero: quello che si vede non deve costare memoria.
  var latoMax = 132;
  var scala = Math.min(latoMax / voce.w, latoMax / voce.h);
  c.width = Math.max(1, Math.round(voce.w * scala));
  c.height = Math.max(1, Math.round(voce.h * scala));
  c.className = 'anteprima';
  c.setAttribute('role', 'img');
  c.setAttribute('tabindex', '0');
  c.setAttribute('aria-label', voce.piattaforma + ' ' + voce.etichetta +
                 ': trascina o usa le frecce per spostare l\'inquadratura');
  box.appendChild(c);
  voce.canvas = c;

  var testo = document.createElement('div');
  testo.className = 'formato-testo';
  var t1 = document.createElement('div');
  t1.className = 'formato-nome';
  t1.textContent = voce.etichetta;
  var t2 = document.createElement('div');
  t2.className = 'formato-misura';
  var t3 = document.createElement('div');
  t3.className = 'formato-azioni';

  var scarica = document.createElement('button');
  scarica.type = 'button';
  scarica.className = 'f-dl';
  scarica.textContent = 'Scarica';
  scarica.addEventListener('click', function () { scaricaUna(voce); });

  var stacca = document.createElement('button');
  stacca.type = 'button';
  stacca.className = 'link-piccolo';
  t3.appendChild(scarica);
  t3.appendChild(stacca);

  testo.appendChild(t1);
  if (voce.nota) {
    var t0 = document.createElement('div');
    t0.className = 'formato-nota';
    t0.textContent = voce.nota;
    testo.appendChild(t0);
  }
  testo.appendChild(t2);
  testo.appendChild(t3);
  box.appendChild(testo);

  voce.misuraEl = t2;
  voce.staccaEl = stacca;
  stacca.addEventListener('click', function () {
    if (staccati[voce.chiave]) { delete staccati[voce.chiave]; }
    else { staccati[voce.chiave] = { x: fuoco.x, y: fuoco.y, zoom: zoom }; }
    aggiornaEtichette();
    disegnaAnteprima(voce);
  });

  collegaTrascinamento(voce);
  return box;
}

function aggiornaEtichette() {
  voci.forEach(function (v) {
    var m = misuraUscita(v);
    var testo = m.w + '×' + m.h;
    if (!m.piena) testo += ' · la tua foto non ha abbastanza pixel per ' + v.w + '×' + v.h +
                           ': più grande di così verrebbe sgranata';
    v.misuraEl.textContent = testo;
    v.misuraEl.classList.toggle('scarsa', !m.piena);
    var staccata = !!staccati[v.chiave];
    v.staccaEl.textContent = staccata ? 'segui le altre' : 'solo questa';
    v.canvas.classList.toggle('staccata', staccata);
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
    if (staccati[voce.chiave]) {
      staccati[voce.chiave].x = nx;
      staccati[voce.chiave].y = ny;
      disegnaAnteprima(voce);
    } else {
      fuoco.x = nx; fuoco.y = ny;
      // Tutte insieme: è questo il punto: si dice una volta dov'è il soggetto.
      voci.forEach(function (v) { if (!staccati[v.chiave]) disegnaAnteprima(v); });
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
  var tipo = tipoUscita();
  var canvas = riduciAGradini(sorgente, m.ritaglio, m.w, m.h);
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
    var chiave = m.w + 'x' + m.h + '|' + Math.round(m.ritaglio.x) + ',' + Math.round(m.ritaglio.y) +
                 ',' + Math.round(m.ritaglio.w);
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
  staccati = {};
  fuoco = { x: 0.5, y: 0.5 };
  zoom = 1;
  zoomInput.value = 100;
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

function chip(p) {
  var b = document.createElement('button');
  b.type = 'button';
  b.className = 'chip' + (attive.indexOf(p.id) > -1 ? ' on' : '');
  b.textContent = p.nome;
  b.setAttribute('aria-pressed', attive.indexOf(p.id) > -1 ? 'true' : 'false');
  b.addEventListener('click', function () {
    var i = attive.indexOf(p.id);
    if (i > -1) attive.splice(i, 1); else attive.push(p.id);
    b.classList.toggle('on', i === -1);
    b.setAttribute('aria-pressed', i === -1 ? 'true' : 'false');
    rifaiRisultati();
  });
  return b;
}

PIATTAFORME.forEach(function (p) { scelteBox.appendChild(chip(p)); });

zoomInput.addEventListener('input', function () {
  zoom = Number(zoomInput.value) / 100;
  voci.forEach(function (v) { if (!staccati[v.chiave]) disegnaAnteprima(v); });
  aggiornaEtichette();
});

document.getElementById('centraBtn').addEventListener('click', function () {
  fuoco = { x: 0.5, y: 0.5 };
  zoom = 1;
  zoomInput.value = 100;
  staccati = {};
  disegnaTutte();
  aggiornaEtichette();
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
