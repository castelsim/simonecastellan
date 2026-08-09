/* Comprimi immagini — porta una o più foto sotto il peso richiesto.
   Nasce da un problema concreto: allegati di email, moduli e domande che
   rifiutano i file oltre un certo peso. Tutto in locale, niente upload. */

var targetKB = 1024;
var jobs = [];
var busy = false;

var dropZone   = document.getElementById('dropZone');
var pickBtn    = document.getElementById('pickBtn');
var fileInput  = document.getElementById('fileInput');
var result     = document.getElementById('result');
var fileList   = document.getElementById('fileList');
var actionsBox = document.getElementById('actionsBox');
var shareBtn   = document.getElementById('shareBtn');
var downloadBtn= document.getElementById('downloadBtn');
var resetBtn   = document.getElementById('resetBtn');
var targetSeg  = document.getElementById('targetSeg');

// Scale provate in ordine: prima si abbassa la qualità, poi le dimensioni.
// Una foto da telefono è quasi sempre più grande di quanto serva a chi la guarda.
var LATI = [4000, 3000, 2400, 2000, 1600, 1280, 1024, 800];
var QUALITA = [0.85, 0.75, 0.65, 0.55, 0.45, 0.35];

function pesa(b) {
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return Math.round(b / 1024) + ' KB';
  return (Math.round(b / 1024 / 102.4) / 10).toString().replace('.', ',') + ' MB';
}

// --- Decodifica ------------------------------------------------------------

function decode(file) {
  return new Promise(function (risolvi, rifiuta) {
    if (window.createImageBitmap) {
      // «from-image»: rispetta l'orientamento EXIF, altrimenti le foto scattate
      // in verticale escono coricate.
      createImageBitmap(file, { imageOrientation: 'from-image' }).then(risolvi, tenta);
    } else {
      tenta();
    }
    function tenta() {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { URL.revokeObjectURL(url); risolvi(img); };
      img.onerror = function () { URL.revokeObjectURL(url); rifiuta(new Error('decode')); };
      img.src = url;
    }
  });
}

function disegna(img, lato) {
  var w = img.width, h = img.height;
  var scala = Math.min(1, lato / Math.max(w, h));
  var cw = Math.max(1, Math.round(w * scala));
  var ch = Math.max(1, Math.round(h * scala));
  var c = document.createElement('canvas');
  c.width = cw; c.height = ch;
  var g = c.getContext('2d');
  // Il JPEG non ha trasparenza: senza il fondo bianco i PNG trasparenti
  // uscirebbero con lo sfondo nero.
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, cw, ch);
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, 0, 0, cw, ch);
  return c;
}

function codifica(canvas, q) {
  return new Promise(function (risolvi) {
    canvas.toBlob(function (b) { risolvi(b); }, 'image/jpeg', q);
  });
}

/* Prova qualità e dimensioni finché non sta sotto il peso richiesto.
   Restituisce comunque il risultato più piccolo raggiunto, anche se il limite
   non si tocca: meglio una foto da 1,2 MB che nessuna foto. */
function comprimi(img, limite) {
  var lati = LATI.filter(function (l) { return l < Math.max(img.width, img.height); });
  lati.unshift(Math.max(img.width, img.height));       // prima si tenta a piena risoluzione
  var migliore = null;
  var i = 0, j = 0;

  function passo() {
    if (i >= lati.length) return Promise.resolve(migliore);
    var canvas = disegna(img, lati[i]);
    return codifica(canvas, QUALITA[j]).then(function (b) {
      if (b && (!migliore || b.size < migliore.size)) migliore = b;
      if (b && b.size <= limite) return b;
      j++;
      if (j >= QUALITA.length) { j = 0; i++; }
      return passo();
    });
  }
  return passo();
}

// --- Coda ------------------------------------------------------------------

function nomeJpg(base) {
  var senza = base.replace(/\.[^.]+$/, '');
  var nome = senza + '.jpg';
  var n = 2;
  while (jobs.some(function (j) { return j.name === nome; })) { nome = senza + ' (' + n + ').jpg'; n++; }
  return nome;
}

function riga(job) {
  var li = document.createElement('li');
  li.className = 'f-row';
  var th = document.createElement('img');
  th.className = 'f-thumb';
  th.alt = '';
  var txt = document.createElement('div');
  txt.className = 'f-txt';
  var nm = document.createElement('div');
  nm.className = 'f-name';
  nm.textContent = job.file.name;
  var st = document.createElement('div');
  st.className = 'f-state';
  st.textContent = 'in attesa…';
  txt.appendChild(nm); txt.appendChild(st);
  li.appendChild(th); li.appendChild(txt);
  fileList.appendChild(li);
  job.li = li; job.thumbEl = th; job.nameEl = nm; job.stateEl = st;
}

function bottoneScarica(job) {
  var b = document.createElement('button');
  b.type = 'button';
  b.className = 'f-dl';
  b.textContent = 'Scarica';
  b.addEventListener('click', function () { scarica(job.blob, job.name); });
  job.li.appendChild(b);
}

function handleFiles(list) {
  var files = [].slice.call(list).filter(function (f) {
    return /^image\//.test(f.type) || /\.(jpe?g|png|webp|gif|bmp|heic|heif|avif)$/i.test(f.name);
  });
  if (!files.length) return;

  result.classList.remove('hidden');
  actionsBox.classList.add('hidden');
  files.forEach(function (f) {
    var job = { file: f, name: nomeJpg(f.name), blob: null, failed: false };
    jobs.push(job);
    riga(job);
  });
  if (!busy) coda();
}

function coda() {
  var prossimo = jobs.filter(function (j) { return !j.blob && !j.failed; })[0];
  if (!prossimo) { busy = false; return fine(); }
  busy = true;
  prossimo.stateEl.textContent = 'compressione…';

  var limite = targetKB * 1024;
  decode(prossimo.file).then(function (img) {
    // Già leggera e già JPEG: non la ricomprimo, la perderei di qualità per nulla.
    if (prossimo.file.size <= limite && /jpe?g/i.test(prossimo.file.type)) {
      return prossimo.file;
    }
    return comprimi(img, limite);
  }).then(function (blob) {
    if (!blob) throw new Error('vuoto');
    prossimo.blob = blob;
    fatta(prossimo);
  }).catch(function (e) {
    prossimo.failed = true;
    prossimo.li.classList.add('ko');
    prossimo.stateEl.textContent = /heic|heif/i.test(prossimo.file.name)
      ? 'formato HEIC: questo browser non lo apre'
      : 'immagine non leggibile';
  }).then(function () { setTimeout(coda, 0); });
}

function fatta(job) {
  var prima = job.file.size, dopo = job.blob.size;
  var risparmio = Math.max(0, Math.round((1 - dopo / prima) * 100));
  var testo = pesa(prima) + ' → <b>' + pesa(dopo) + '</b>';
  if (dopo > targetKB * 1024) testo += ' · più giù non scende';
  else if (risparmio > 0) testo += ' · −' + risparmio + '%';
  else testo += ' · era già leggera';
  job.stateEl.innerHTML = testo;
  job.nameEl.textContent = job.name;
  job.thumbEl.src = URL.createObjectURL(job.blob);
  bottoneScarica(job);
}

function fine() {
  var ok = jobs.filter(function (j) { return j.blob; });
  if (!ok.length) return;            // tutte fallite: restano le righe con il motivo
  actionsBox.classList.remove('hidden');
  downloadBtn.textContent = ok.length > 1 ? 'Scarica tutte (' + ok.length + ')' : 'Scarica';
  // Con una sola immagine i due «Scarica» farebbero la stessa cosa a due dita
  // di distanza: resta quello grande, il pulsantino della riga sparisce.
  [].forEach.call(fileList.querySelectorAll('.f-dl'), function (b) {
    b.classList.toggle('hidden', ok.length < 2);
  });
  var fs = condivisibili();
  shareBtn.classList.toggle('hidden', !fs);
}

// --- Uscite ----------------------------------------------------------------

function scarica(blob, nome) {
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
}

function condivisibili() {
  try {
    var fs = jobs.filter(function (j) { return j.blob; }).map(function (j) {
      return new File([j.blob], j.name, { type: 'image/jpeg' });
    });
    if (fs.length && navigator.canShare && navigator.canShare({ files: fs })) return fs;
  } catch (e) {}
  return null;
}

downloadBtn.addEventListener('click', function () {
  // Uno alla volta, distanziati: al primo giro il browser può chiedere il
  // permesso per i download multipli — basta un sì.
  jobs.filter(function (j) { return j.blob; }).forEach(function (j, i) {
    setTimeout(function () { scarica(j.blob, j.name); }, i * 350);
  });
});

shareBtn.addEventListener('click', function () {
  var fs = condivisibili();
  if (!fs) return;
  navigator.share({
    files: fs,
    title: fs.length > 1 ? fs.length + ' immagini' : fs[0].name
  }).catch(function () { /* annullato: va bene così */ });
});

resetBtn.addEventListener('click', function () {
  jobs = [];
  fileList.innerHTML = '';
  result.classList.add('hidden');
  actionsBox.classList.add('hidden');
  fileInput.value = '';
});

// --- Ingresso file ---------------------------------------------------------

pickBtn.addEventListener('click', function (e) { e.stopPropagation(); fileInput.click(); });
dropZone.addEventListener('click', function () { fileInput.click(); });
dropZone.addEventListener('keydown', function (e) {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
});
fileInput.addEventListener('change', function () {
  handleFiles(fileInput.files);
  fileInput.value = '';            // così si può ricaricare lo stesso file
});

['dragenter', 'dragover'].forEach(function (ev) {
  dropZone.addEventListener(ev, function (e) { e.preventDefault(); dropZone.classList.add('dragover'); });
});
['dragleave', 'drop'].forEach(function (ev) {
  dropZone.addEventListener(ev, function (e) { e.preventDefault(); dropZone.classList.remove('dragover'); });
});
dropZone.addEventListener('drop', function (e) {
  if (e.dataTransfer && e.dataTransfer.files) handleFiles(e.dataTransfer.files);
});
// Trascinare fuori dal riquadro non deve aprire l'immagine al posto della pagina.
window.addEventListener('dragover', function (e) { e.preventDefault(); });
window.addEventListener('drop', function (e) { e.preventDefault(); });

targetSeg.addEventListener('click', function (e) {
  var b = e.target.closest('.seg-btn');
  if (!b) return;
  targetKB = Number(b.dataset.kb);
  [].forEach.call(targetSeg.querySelectorAll('.seg-btn'), function (x) {
    x.classList.toggle('active', x === b);
  });
  // Cambiare il limite a lavoro fatto rifà i conti sulle stesse immagini.
  if (jobs.length && !busy) {
    jobs.forEach(function (j) { j.blob = null; j.failed = false; j.stateEl.textContent = 'in attesa…'; });
    [].forEach.call(fileList.querySelectorAll('.f-dl'), function (b2) { b2.remove(); });
    actionsBox.classList.add('hidden');
    coda();
  }
});
