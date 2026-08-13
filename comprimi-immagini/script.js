/* Comprimi immagini — porta una o più foto sotto il peso richiesto.
   Nasce da un problema concreto: allegati di email, moduli e domande che
   rifiutano i file oltre un certo peso. Tutto in locale, niente upload. */

var targetKB = 1024;
var modo = 'invisibile';    // «invisibile» = più leggera possibile, «peso» = sotto un limite
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
var avvisoFile = document.getElementById('avvisoFile');

// Scale provate in ordine: prima si abbassa la qualità, poi le dimensioni.
// Una foto da telefono è quasi sempre più grande di quanto serva a chi la guarda.
var LATI = [4000, 3000, 2400, 2000, 1600, 1280, 1024, 800];
var QUALITA = [0.85, 0.75, 0.65, 0.55, 0.45, 0.35];

function pesa(b) {
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return Math.round(b / 1024) + ' KB';
  return (Math.round(b / 1024 / 102.4) / 10).toString().replace('.', ',') + ' MB';
}

/* «Da X a Y, tanto in meno»: la stessa frase, con le stesse parole, nei tre
   compressori. Chi passa dalle immagini al PDF deve riconoscere il risultato
   senza rileggerlo. */
function daA(prima, dopo) {
  var meno = Math.max(0, Math.round((1 - dopo / prima) * 100));
  return pesa(prima) + ' → <b>' + pesa(dopo) + '</b> · ' + meno + '% in meno';
}

function avvisa(testo) {
  avvisoFile.textContent = testo || '';
  avvisoFile.classList.toggle('hidden', !testo);
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

/* --- Modo «più leggera possibile» -----------------------------------------

   Qui non c'è un peso da rispettare: c'è da trovare il punto in cui la foto
   pesa il meno possibile senza che la differenza si veda. «Non si vede» va
   misurato, non deciso a occhio, quindi si confronta la versione compressa
   con l'originale su una copia piccola e si guardano due cose: quanto in
   media cambia ogni pixel, e quanti pixel cambiano abbastanza da accorgersene.
   Si scende di qualità finché uno dei due supera la soglia. */

var SOGLIA_MEDIA = 1.6;      // livelli di luminosità, su 255
var SOGLIA_PIXEL = 0.02;     // quota di pixel che cambiano di oltre 6 livelli

function luminanze(canvas) {
  var g = canvas.getContext('2d');
  var d = g.getImageData(0, 0, canvas.width, canvas.height).data;
  var out = new Uint8Array(canvas.width * canvas.height);
  for (var i = 0, j = 0; i < d.length; i += 4, j++) {
    out[j] = (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8;
  }
  return out;
}

function riduciPer(img, lato) {
  var scala = Math.min(1, lato / Math.max(img.width, img.height));
  var c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.width * scala));
  c.height = Math.max(1, Math.round(img.height * scala));
  var g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

function differenza(a, b) {
  var somma = 0, oltre = 0;
  for (var i = 0; i < a.length; i++) {
    var d = Math.abs(a[i] - b[i]);
    somma += d;
    if (d > 6) oltre++;
  }
  return { media: somma / a.length, quota: oltre / a.length };
}

async function piuLeggeraPossibile(img) {
  /* Il confronto ha bisogno di rileggere il JPEG appena scritto, e per farlo
     serve createImageBitmap. Dove non c'è (browser vecchi) non si può misurare
     niente: si tiene una qualità alta e si va avanti. Prima questo caso faceva
     fallire ogni immagine con «non leggibile», e questo è il modo predefinito. */
  if (!window.createImageBitmap) {
    return codifica(disegna(img, Math.max(img.width, img.height)), 0.82);
  }

  var riferimento = riduciPer(img, 480);
  var base = luminanze(riferimento);

  // Dalla qualità alta si scende: la prima che sfora dice che la precedente
  // era il limite. Sette prove al massimo, su immagini piccole: è veloce.
  var scala = [0.92, 0.86, 0.8, 0.74, 0.68, 0.62, 0.56, 0.5];
  var migliore = null;
  var pieno = disegna(img, Math.max(img.width, img.height));

  for (var i = 0; i < scala.length; i++) {
    var blob = await codifica(pieno, scala[i]);
    if (!blob) break;
    var bmp = await createImageBitmap(blob);
    var prova = luminanze(riduciPer(bmp, 480));
    bmp.close && bmp.close();
    var d = differenza(base, prova);
    if (d.media > SOGLIA_MEDIA || d.quota > SOGLIA_PIXEL) break;
    migliore = blob;
  }

  pieno.width = pieno.height = 0;
  riferimento.width = riferimento.height = 0;
  // Se perfino la qualità più alta si vede (succede con le grafiche piatte e
  // il testo), si tiene quella: è il meglio che il JPEG sa fare qui.
  return migliore || await codifica(disegna(img, Math.max(img.width, img.height)), 0.92);
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

/* Il nome deve restare riconoscibile: chi scarica dieci foto non sa più quale
   è quale se diventano tutte «immagine.jpg». Si tiene il nome di partenza e si
   aggiunge «(leggera)», come fanno gli altri due con «(leggero)» — serve anche
   a non far litigare l'originale e la copia nella cartella dei download.
   Un nome senza estensione o pieno di punti passa di qui senza problemi; se
   dell'originale non resta niente (un file chiamato «.jpg») si ripiega su un
   nome qualsiasi, perché un file che si chiama solo « (leggera).jpg» è peggio. */
function nomeJpg(base) {
  var senza = base.replace(/\.[^.]+$/, '').trim() || 'immagine';
  var nome = senza + ' (leggera).jpg';
  var n = 2;
  while (jobs.some(function (j) { return j.name === nome; })) {
    nome = senza + ' (leggera ' + n + ').jpg';
    n++;
  }
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
  var tutti = [].slice.call(list);
  var files = tutti.filter(function (f) {
    return /^image\//.test(f.type) || /\.(jpe?g|png|webp|gif|bmp|heic|heif|avif)$/i.test(f.name);
  });

  /* Prima un file che non era un'immagine spariva senza una parola: nessuna
     riga, nessun messaggio, la pagina identica a un secondo prima. Chi trascina
     un PDF qui dentro deve sapere perché non succede niente. */
  if (!files.length) {
    avvisa(tutti.length === 1
      ? "Questo non è un'immagine. Vanno bene JPG, PNG, WEBP, GIF e HEIC."
      : 'Qui dentro non ci sono immagini. Vanno bene JPG, PNG, WEBP, GIF e HEIC.');
    return;
  }
  avvisa(files.length < tutti.length
    ? 'Ho lasciato fuori ' + (tutti.length - files.length) + ' file: non sono immagini.'
    : '');

  result.classList.remove('hidden');
  actionsBox.classList.add('hidden');
  files.forEach(function (f) {
    var job = { file: f, name: nomeJpg(f.name), blob: null, failed: false, intatta: false };
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

  /* Un file da zero byte non è un'immagine rotta, è un file vuoto: dirlo con
     parole sue evita di far cercare colpe al browser. */
  if (prossimo.file.size === 0) {
    prossimo.failed = true;
    prossimo.li.classList.add('ko');
    prossimo.stateEl.textContent = 'il file è vuoto (0 byte)';
    return setTimeout(coda, 0);
  }

  /* Già sotto il peso richiesto: non si tocca. Ricomprimere un JPEG sopra un
     JPEG toglie qualità e certe volte fa perfino crescere il file — è successo
     davvero, ed è la ragione per cui questo controllo esiste in tutti e tre gli
     strumenti. Vale per qualunque formato: se il peso va già bene, l'unica cosa
     da fare è niente. */
  if (modo === 'peso' && prossimo.file.size <= limite) {
    prossimo.blob = prossimo.file;
    prossimo.intatta = true;
    fatta(prossimo);
    return setTimeout(coda, 0);
  }

  decode(prossimo.file).then(function (img) {
    if (modo === 'invisibile') return piuLeggeraPossibile(img);
    return comprimi(img, limite);
  }).then(function (blob) {
    if (!blob) throw new Error('vuoto');
    /* Se il risultato non pesa meno dell'originale non c'è niente da
       consegnare: si tiene il file di partenza, con il suo nome. Prima si
       scriveva «era già al minimo» e intanto si scaricava la copia più
       pesante. */
    if (blob.size >= prossimo.file.size) {
      prossimo.blob = prossimo.file;
      prossimo.intatta = true;
    } else {
      prossimo.blob = blob;
    }
    fatta(prossimo);
  }).catch(function (e) {
    prossimo.failed = true;
    prossimo.li.classList.add('ko');
    prossimo.stateEl.textContent = /heic|heif/i.test(prossimo.file.name)
      ? 'formato HEIC: questo browser non lo apre'
      : (prossimo.file.size > 60 * 1024 * 1024
          ? 'immagine troppo grande per questo browser'
          : 'immagine non leggibile');
  }).then(function () { setTimeout(coda, 0); });
}

function fatta(job) {
  var prima = job.file.size, dopo = job.blob.size;
  var risparmio = Math.max(0, Math.round((1 - dopo / prima) * 100));
  var testo = pesa(prima) + ' → <b>' + pesa(dopo) + '</b>';
  if (modo === 'invisibile') {
    testo += dopo >= prima ? ' · era già al minimo' : ' · −' + risparmio + '%, senza differenze visibili';
  }
  else if (dopo > targetKB * 1024) testo += ' · più giù non scende';
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

document.getElementById('modoSeg').addEventListener('click', function (e) {
  var b = e.target.closest('.seg-btn');
  if (!b) return;
  modo = b.dataset.modo;
  [].forEach.call(this.querySelectorAll('.seg-btn'), function (x) { x.classList.toggle('active', x === b); });
  targetSeg.classList.toggle('hidden', modo !== 'peso');
  document.getElementById('modoNota').textContent = modo === 'peso'
    ? 'Scendo fin sotto il peso che scegli, togliendo prima qualità e poi dimensioni.'
    : 'Cerca il punto in cui la foto pesa il meno possibile senza che la differenza si veda.';
  rifaiTutte();
});

function rifaiTutte() {
  if (!jobs.length || busy) return;
  jobs.forEach(function (j) { j.blob = null; j.failed = false; j.stateEl.textContent = 'in attesa…'; });
  [].forEach.call(fileList.querySelectorAll('.f-dl'), function (b) { b.remove(); });
  actionsBox.classList.add('hidden');
  coda();
}

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
