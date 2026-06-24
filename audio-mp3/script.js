'use strict';

// ============================================================
// Audio to MP3 Light — tutto client-side, nessun upload.
// Pipeline: file -> decodeAudioData -> resample 48kHz stereo
//           -> Int16 -> Web Worker (lamejs) -> MP3 128kbps CBR
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
var fileNameEl = document.getElementById('fileName');
var sendBtn    = document.getElementById('sendBtn');
var sendHint   = document.getElementById('sendHint');
var downloadBtn= document.getElementById('downloadBtn');
var errorBox   = document.getElementById('error');
var resetBtn   = document.getElementById('resetBtn');

var currentBlob = null;
var currentName = 'audio.mp3';

// Email di Simone, usata come ripiego quando manca la condivisione di file.
var MAIL_TO = 'castellansimone@gmail.com';

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
  hide(statusBox); hide(resultBox); hide(errorBox);
  setProgress(0);
  currentBlob = null;
  fileInput.value = '';
  dropZone.classList.remove('hidden');
}

function fail(msg) {
  hide(statusBox); hide(resultBox);
  errorBox.querySelector('.error-msg').textContent = msg;
  show(errorBox);
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
  setStatus('Preparazione del convertitore… (solo la prima volta)');
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
    setStatus('Conversione in corso…');
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

// --- Mostra il risultato ---
function finish(blob, origSize) {
  currentBlob = blob;
  setProgress(1);
  fileNameEl.textContent = currentName;
  hide(sendHint);
  hide(statusBox);
  show(resultBox);
  setupSend();
}

// --- Flusso principale: prima la via veloce, poi ffmpeg ---
function handleFile(file) {
  if (!file) return;
  hide(errorBox);
  hide(dropZone);
  show(statusBox);
  hide(resultBox);
  setProgress(0);
  setStatus('Lettura del file…');

  var origSize = file.size;
  currentName = (file.name.replace(/\.[^.]+$/, '') || 'audio') + '.mp3';

  file.arrayBuffer()
    .then(function (ab) {
      setStatus('Decodifica audio…');
      setProgress(0.15);
      return decode(ab);
    })
    .then(function (audioBuffer) {
      // VIA VELOCE: Web Audio + lamejs
      setStatus('Conversione in corso…');
      setProgress(0.3);
      return resample(audioBuffer).then(function (rendered) {
        setProgress(0.5);
        setStatus('Creazione MP3…');
        var left  = floatToInt16(rendered.getChannelData(0));
        var right = floatToInt16(rendered.getChannelData(1));
        return encode(left, right);
      });
    })
    .catch(function (decodeErr) {
      // Formato non gestito dal browser → FALLBACK ffmpeg (qualsiasi formato).
      console.warn('Via veloce non disponibile, uso ffmpeg:', decodeErr);
      return convertWithFfmpeg(file);
    })
    .then(function (blob) {
      finish(blob, origSize);
    })
    .catch(function (err) {
      console.error(err);
      var name = String((err && (err.message || err.name)) || err);
      var msg;
      if (name === 'needs-reload') {
        // Il service worker che abilita l'isolamento non controlla ancora la
        // pagina (prima visita, o dopo un hard-refresh che lo bypassa).
        // Ricarico UNA volta da solo: al reload normale il SW si attiva.
        if (!sessionStorage.getItem('a2m_reloaded')) {
          sessionStorage.setItem('a2m_reloaded', '1');
          setStatus('Attivazione del convertitore… ricarico la pagina.');
          setTimeout(function () { location.reload(); }, 600);
          return;
        }
        msg = 'Convertitore avanzato non attivabile in questo browser. ' +
              'Prova con WAV, MP3, M4A, AAC o AIFF, che funzionano sempre.';
      } else if (name === 'engine-missing') {
        msg = 'Convertitore avanzato non disponibile. Prova con WAV, MP3, M4A, AAC o AIFF.';
      } else {
        msg = 'Impossibile convertire questo file. Assicurati che sia un file audio valido.';
      }
      fail(msg);
    });
}

// --- Download ---
function doDownload() {
  if (!currentBlob) return;
  var url = URL.createObjectURL(currentBlob);
  var a = document.createElement('a');
  a.href = url;
  a.download = currentName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
}

// --- Invio a Simone (default) ---
// Obiettivo del tool: far arrivare il file a Simone, di norma via WhatsApp.
// I link wa.me NON possono allegare un file, quindi:
//  - se il dispositivo supporta la condivisione di file (tipico mobile),
//    uso la Web Share API: l'utente passa il file e sceglie WhatsApp -> Simone;
//  - altrimenti (desktop) scarico l'MP3 e apro la chat di Simone gia' pronta,
//    con l'istruzione di allegare il file appena scaricato.
function canShareFile() {
  try {
    var f = new File([currentBlob], currentName, { type: 'audio/mpeg' });
    return !!(navigator.canShare && navigator.canShare({ files: [f] }));
  } catch (e) { return false; }
}

// Solo su mobile la condivisione di sistema include Mail/WhatsApp e allega il
// file da sola. Su desktop (Chrome in primis) non e' affidabile: meglio aprire
// la mail a Simone e far allegare il file scaricato.
function isMobile() {
  if (navigator.userAgentData && typeof navigator.userAgentData.mobile === 'boolean') {
    return navigator.userAgentData.mobile;
  }
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
}

function setupSend() {
  sendBtn.onclick = function () {
    if (isMobile() && canShareFile()) {
      // MOBILE: il file viene gia' allegato; l'utente sceglie Mail o WhatsApp.
      var f = new File([currentBlob], currentName, { type: 'audio/mpeg' });
      navigator.share({ files: [f], title: currentName, text: 'File audio convertito.' })
        .catch(function () { /* annullato dall'utente: ignoro */ });
    } else {
      // DESKTOP: scarico e apro la mail gia' indirizzata a Simone;
      // l'allegato lo aggiunge l'utente trascinando il file scaricato.
      doDownload();
      var subject = encodeURIComponent('File audio: ' + currentName);
      var body = encodeURIComponent('Ciao Simone, ti allego il file audio (' + currentName + ').');
      window.location.href = 'mailto:' + MAIL_TO + '?subject=' + subject + '&body=' + body;
      sendHint.textContent = 'File scaricato. Trascina il file appena scaricato nell’email che si è aperta.';
      show(sendHint);
    }
  };
}

// --- Eventi UI ---
// Il pulsante e' dentro la drop zone: fermo il bubbling per non aprire
// il selettore file due volte.
pickBtn.addEventListener('click', function (e) { e.stopPropagation(); fileInput.click(); });
dropZone.addEventListener('click', function () { fileInput.click(); });
fileInput.addEventListener('change', function () {
  if (fileInput.files && fileInput.files[0]) handleFile(fileInput.files[0]);
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
  if (dt && dt.files && dt.files[0]) handleFile(dt.files[0]);
});

downloadBtn.addEventListener('click', doDownload);
resetBtn.addEventListener('click', resetUI);

// Evita che il browser apra il file se rilasciato fuori dalla drop zone.
window.addEventListener('dragover', function (e) { e.preventDefault(); });
window.addEventListener('drop', function (e) { e.preventDefault(); });
