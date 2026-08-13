'use strict';

// ============================================================
// Audio to MP3 Light — tutto client-side, nessun upload.
// Pipeline per OGNI file: decodeAudioData -> resample 48kHz stereo
//           -> Int16 -> Web Worker (lamejs) -> MP3 128kbps CBR
// Più file insieme: coda SEQUENZIALE — un decode alla volta tiene
// bassa la memoria (i WAV decodificati pesano), e l'istanza ffmpeg
// di fallback è comunque una sola.
// ============================================================

var TARGET_RATE = 48000;

// --- Riferimenti DOM ---
var dropZone   = document.getElementById('dropZone');
var fileInput  = document.getElementById('fileInput');
var pickBtn    = document.getElementById('pickBtn');
var statusBox  = document.getElementById('status');
var statusText = document.getElementById('statusText');
var progressEl = document.getElementById('progress');
var progressBar= document.getElementById('progressBar');
var resultBox  = document.getElementById('result');
var fileListEl = document.getElementById('fileList');
var actionsBox = document.getElementById('actionsBox');
var sendBtn    = document.getElementById('sendBtn');
var sendHint   = document.getElementById('sendHint');
var downloadBtn= document.getElementById('downloadBtn');
var errorBox   = document.getElementById('error');
var resetBtn   = document.getElementById('resetBtn');

// La coda: un elemento per ogni file scelto.
// { file, name, blob|null, failed, started, li, stateEl }
var jobs = [];
var queueRunning = false;

// --- Utility ---
function show(el)  { el.classList.remove('hidden'); }
function hide(el)  { el.classList.add('hidden'); }

function setProgress(p) {
  var pct = Math.round(p * 100);
  progressBar.style.width = pct + '%';
  progressEl.setAttribute('aria-valuenow', String(pct));
}

function setStatus(msg) {
  statusText.textContent = msg;
}

function resetUI() {
  hide(statusBox); hide(resultBox); hide(errorBox); hide(actionsBox); hide(sendHint);
  setProgress(0);
  jobs = [];
  fileListEl.innerHTML = '';
  fileInput.value = '';
  show(dropZone);
}

// --- Decodifica audio ---
function decode(arrayBuffer) {
  var Ctx = window.AudioContext || window.webkitAudioContext;
  var ctx = new Ctx();
  return new Promise(function (resolve, reject) {
    // Su alcuni browser scattano SIA la callback SIA la promise: un guard
    // evita di risolvere due volte e di chiudere due volte il contesto.
    var settled = false;
    function ok(buf)  { if (settled) return; settled = true; try { ctx.close(); } catch (e) {} resolve(buf); }
    function ko(err)  { if (settled) return; settled = true; try { ctx.close(); } catch (e) {} reject(err || new Error('decode')); }
    // Forma con callback per compatibilita' Safari.
    var ret = ctx.decodeAudioData(arrayBuffer, ok, ko);
    if (ret && typeof ret.then === 'function') { ret.then(ok, ko); }
  });
}

// --- Resample a 48kHz stereo tramite OfflineAudioContext ---
function resample(audioBuffer) {
  var duration = audioBuffer.duration;
  var length = Math.ceil(duration * TARGET_RATE);
  var OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  var offline = new OfflineCtx(2, length, TARGET_RATE);
  var src = offline.createBufferSource();
  src.buffer = audioBuffer;          // mono viene up-mixato a stereo automaticamente
  src.connect(offline.destination);
  src.start(0);
  return offline.startRendering();   // ritorna una Promise<AudioBuffer> a 48kHz stereo
}

// --- Float32 [-1,1] -> Int16 ---
function floatToInt16(float32) {
  var out = new Int16Array(float32.length);
  for (var i = 0; i < float32.length; i++) {
    var s = float32[i];
    s = s < -1 ? -1 : (s > 1 ? 1 : s);
    out[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return out;
}

// --- Codifica via worker ---
function encode(left, right) {
  return new Promise(function (resolve, reject) {
    var worker = new Worker('worker.js');
    worker.onmessage = function (e) {
      var d = e.data;
      if (d.type === 'progress') {
        // la codifica occupa la seconda meta' della barra (50% -> 100%)
        setProgress(0.5 + d.value * 0.5);
      } else if (d.type === 'done') {
        worker.terminate();
        resolve(d.blob);
      } else if (d.type === 'error') {
        worker.terminate();
        reject(new Error(d.message));
      }
    };
    worker.onerror = function (err) {
      worker.terminate();
      reject(new Error(err.message || 'worker'));
    };
    // Trasferisco i buffer (zero-copy) per non duplicare la memoria.
    worker.postMessage(
      { left: left, right: right, sampleRate: TARGET_RATE },
      [left.buffer, right.buffer]
    );
  });
}

// --- Fallback universale: ffmpeg.wasm ---
// Decodifica QUALSIASI formato che la Web Audio API non gestisce
// (FLAC/OGG/OPUS su iPhone, WMA, AMR, AC3, video-con-audio, ecc.).
var ffmpegInstance = null;

function getFfmpeg() {
  if (ffmpegInstance) return Promise.resolve(ffmpegInstance);
  if (!window.FFmpeg || !window.FFmpeg.createFFmpeg) {
    return Promise.reject(new Error('engine-missing'));
  }
  if (typeof window.SharedArrayBuffer === 'undefined' || !self.crossOriginIsolated) {
    // Il service worker non ha ancora attivato l'isolamento: serve un ricaricamento.
    return Promise.reject(new Error('needs-reload'));
  }
  setStatus('Preparo il convertitore… succede solo la prima volta.');
  // corePath ASSOLUTO: ffmpeg.min.js ha un publicPath sbagliato hardcoded,
  // un URL assoluto evita che venga anteposto un percorso inesistente.
  var base = location.href.substring(0, location.href.lastIndexOf('/') + 1);
  var ff = window.FFmpeg.createFFmpeg({
    corePath: base + 'vendor/ffmpeg/ffmpeg-core.js',
    log: false
  });
  return ff.load().then(function () {
    ffmpegInstance = ff;
    return ff;
  });
}

function convertWithFfmpeg(file) {
  return getFfmpeg().then(function (ff) {
    setProgress(0.1);
    ff.setProgress(function (p) {
      if (p && typeof p.ratio === 'number' && p.ratio >= 0 && p.ratio <= 1) {
        setProgress(0.1 + p.ratio * 0.9);
      }
    });
    // Conservo l'estensione originale: aiuta ffmpeg a riconoscere il formato.
    var ext = (file.name.match(/\.([a-z0-9]+)$/i) || [, 'bin'])[1].toLowerCase();
    var inName = 'in_' + Date.now() + '.' + ext;
    return window.FFmpeg.fetchFile(file)
      .then(function (bytes) {
        ff.FS('writeFile', inName, bytes);
        // estrae l'audio, forza 48kHz / stereo / 128kbps CBR
        return ff.run('-i', inName, '-vn', '-ar', '48000', '-ac', '2', '-b:a', '128k', '-f', 'mp3', 'out.mp3');
      })
      .then(function () {
        var data = ff.FS('readFile', 'out.mp3');
        try { ff.FS('unlink', inName); ff.FS('unlink', 'out.mp3'); } catch (e) {}
        return new Blob([data.buffer], { type: 'audio/mpeg' });
      });
  });
}

// --- Conversione di UN file: prima la via veloce, poi ffmpeg ---
function convertFile(file) {
  return file.arrayBuffer()
    .then(function (ab) {
      setProgress(0.15);
      return decode(ab);
    })
    .then(function (audioBuffer) {
      // VIA VELOCE: Web Audio + lamejs
      setProgress(0.3);
      return resample(audioBuffer).then(function (rendered) {
        setProgress(0.5);
        var left  = floatToInt16(rendered.getChannelData(0));
        var right = floatToInt16(rendered.getChannelData(1));
        return encode(left, right);
      });
    })
    .catch(function (decodeErr) {
      // Formato non gestito dal browser → FALLBACK ffmpeg (qualsiasi formato).
      console.warn('Via veloce non disponibile, uso ffmpeg:', decodeErr);
      return convertWithFfmpeg(file);
    });
}

// --- Righe dell'elenco ---
function mp3NameFor(file) {
  var base = (file.name.replace(/\.[^.]+$/, '') || 'audio');
  var name = base + '.mp3', n = 2;
  // Due file con lo stesso nome darebbero due MP3 indistinguibili nei download.
  while (jobs.some(function (j) { return j.name === name; })) {
    name = base + ' (' + n + ').mp3'; n++;
  }
  return name;
}

function addRow(job) {
  var li = document.createElement('li');
  li.className = 'f-row';
  var nm = document.createElement('span');
  nm.className = 'f-name';
  // Finche' non e' convertito il file resta quello originale: il nome .mp3
  // comparirebbe anche sulle righe fallite, dove non esiste nessun MP3.
  nm.textContent = job.file.name;
  job.nameEl = nm;
  var st = document.createElement('span');
  st.className = 'f-state';
  st.textContent = 'in attesa';
  li.appendChild(nm); li.appendChild(st);
  fileListEl.appendChild(li);
  job.li = li; job.stateEl = st;
}

function rowDone(job) {
  job.li.classList.add('ok');
  job.nameEl.textContent = job.name;
  job.stateEl.textContent = '';
  var b = document.createElement('button');
  b.type = 'button';
  b.className = 'f-dl';
  b.textContent = 'Scarica';
  b.addEventListener('click', function () { downloadBlob(job.blob, job.name); });
  job.stateEl.appendChild(b);
}

function rowError(job, msg) {
  job.li.classList.add('ko');
  job.stateEl.textContent = msg;
}

// --- Coda ---
function handleFiles(list) {
  var files = Array.prototype.slice.call(list || []);
  if (!files.length) return;
  hide(errorBox); hide(actionsBox); hide(sendHint);
  hide(dropZone);
  show(resultBox); show(statusBox);
  files.forEach(function (f) {
    var job = { file: f, name: mp3NameFor(f), blob: null, failed: false, started: false };
    jobs.push(job);
    addRow(job);
  });
  if (!queueRunning) runQueue();
}

function runQueue() {
  var next = null;
  for (var i = 0; i < jobs.length; i++) {
    if (!jobs[i].started) { next = jobs[i]; break; }
  }
  if (!next) {
    queueRunning = false;
    finishBatch();
    return;
  }
  queueRunning = true;
  next.started = true;
  var pos = jobs.indexOf(next) + 1;
  setProgress(0);
  setStatus(jobs.length > 1
    ? 'File ' + pos + ' di ' + jobs.length + ' — ' + next.file.name
    : 'Sto convertendo…');
  next.stateEl.textContent = 'in lavorazione…';
  convertFile(next.file).then(
    function (blob) {
      next.blob = blob;
      rowDone(next);
      runQueue();
    },
    function (err) {
      next.failed = true;
      if (scheduleReloadIfNeeded(err)) return;   // la pagina sta per ricaricarsi
      console.error(err);
      rowError(next, shortErrorFor(err));
      runQueue();
    }
  );
}

function scheduleReloadIfNeeded(err) {
  var name = String((err && (err.message || err.name)) || err);
  // Il service worker che abilita l'isolamento non controlla ancora la pagina
  // (prima visita, o hard-refresh che lo bypassa). Ricarico UNA volta da solo:
  // al reload normale il SW si attiva. I file vanno riscelti, come prima.
  if (name !== 'needs-reload' || sessionStorage.getItem('a2m_reloaded')) return false;
  sessionStorage.setItem('a2m_reloaded', '1');
  setStatus('Accendo il convertitore. Ricarico la pagina, poi riscegli i file.');
  setTimeout(function () { location.reload(); }, 600);
  return true;
}

function shortErrorFor(err) {
  var name = String((err && (err.message || err.name)) || err);
  if (name === 'needs-reload' || name === 'engine-missing') {
    return 'questo browser non ce la fa';
  }
  return 'non riuscito';
}

function finishBatch() {
  hide(statusBox);
  var ok = jobs.filter(function (j) { return j.blob; });
  if (!ok.length) {
    hide(resultBox);
    fileListEl.innerHTML = '';
    jobs = [];
    errorBox.querySelector('.error-msg').textContent =
      'Controlla che siano file audio o video. WAV, MP3, M4A, AAC e AIFF riescono sempre.';
    show(errorBox);
    return;
  }
  downloadBtn.textContent = ok.length > 1 ? 'Scarica tutti (' + ok.length + ')' : 'Scarica l’MP3';
  // «Manda» compare solo dove il sistema sa davvero allegare i file (di norma il
  // telefono).  Altrove il pulsante prometteva un invio che non poteva fare.
  sendBtn.textContent = ok.length > 1 ? 'Manda gli MP3' : 'Manda l’MP3';
  if (shareableFiles()) show(sendBtn); else hide(sendBtn);
  show(actionsBox);
}

// --- Download ---
function downloadBlob(blob, name) {
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
}

function downloadAll() {
  var ok = jobs.filter(function (j) { return j.blob; });
  // Un download alla volta, distanziati: al primo giro il browser può chiedere
  // il permesso per i download multipli — è normale, basta un sì.
  ok.forEach(function (j, i) {
    setTimeout(function () { downloadBlob(j.blob, j.name); }, i * 350);
  });
}

// --- Mandare i file a qualcuno ---
// Un link wa.me non puo' allegare niente: l'unico modo, dal browser, e' il menu
// di condivisione del sistema (Web Share). Dove non c'e' — quasi tutti i computer
// — il pulsante resta nascosto: prima apriva una mail gia' indirizzata all'autore
// del sito, cosa che nessuno si aspetta da un pulsante che dice «Condividi».
function shareableFiles() {
  try {
    var fs = jobs.filter(function (j) { return j.blob; }).map(function (j) {
      return new File([j.blob], j.name, { type: 'audio/mpeg' });
    });
    if (fs.length && navigator.canShare && navigator.canShare({ files: fs })) return fs;
  } catch (e) {}
  return null;
}

sendBtn.addEventListener('click', function () {
  var fs = shareableFiles();
  if (!fs) {
    // Il menu di condivisione è sparito fra la fine della coda e il clic: meglio
    // scaricare che lasciare il pulsante muto.
    downloadAll();
    sendHint.textContent = 'Qui non si può condividere: ho scaricato i file.';
    show(sendHint);
    return;
  }
  // Menu di condivisione di sistema: scegliendo Mail o WhatsApp i file sono
  // GIA' allegati. Unico modo per allegare file dal browser.
  navigator.share({
    files: fs,
    title: fs.length > 1 ? fs.length + ' file audio' : fs[0].name,
    text: fs.length > 1 ? 'File audio convertiti.' : 'File audio convertito.'
  }).catch(function () { /* annullato dall'utente: ignoro */ });
});

// --- Eventi UI ---
// Il pulsante e' dentro la drop zone: fermo il bubbling per non aprire
// il selettore file due volte.
pickBtn.addEventListener('click', function (e) { e.stopPropagation(); fileInput.click(); });
dropZone.addEventListener('click', function () { fileInput.click(); });
fileInput.addEventListener('change', function () {
  if (fileInput.files && fileInput.files.length) handleFiles(fileInput.files);
  fileInput.value = '';   // riscegliere gli stessi file deve ri-scattare il change
});

['dragenter', 'dragover'].forEach(function (ev) {
  dropZone.addEventListener(ev, function (e) {
    e.preventDefault(); e.stopPropagation();
    dropZone.classList.add('dragover');
  });
});
['dragleave', 'drop'].forEach(function (ev) {
  dropZone.addEventListener(ev, function (e) {
    e.preventDefault(); e.stopPropagation();
    dropZone.classList.remove('dragover');
  });
});
dropZone.addEventListener('drop', function (e) {
  var dt = e.dataTransfer;
  if (dt && dt.files && dt.files.length) handleFiles(dt.files);
});

downloadBtn.addEventListener('click', downloadAll);
resetBtn.addEventListener('click', resetUI);

// Evita che il browser apra il file se rilasciato fuori dalla drop zone.
window.addEventListener('dragover', function (e) { e.preventDefault(); });
window.addEventListener('drop', function (e) { e.preventDefault(); });
