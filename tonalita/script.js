'use strict';

// ============================================================
// Tonalità — strumento manuale d'ascolto.
// Carica un brano, suona note tenute (drone) sopra l'audio e trova
// a orecchio la tonalità. Tutto client-side.
//   - Player <audio> minimale (play/pausa, avanzamento, volume), 1x.
//   - Tastiera Web Audio a 2 ottave, oscillatori sinusoidali puri.
//   - HOLD: blocca l'ultima nota selezionata come pedale fisso; si
//     possono suonare altre note sopra per confrontarle.
//   - Stima probabilistica della tonalità (Krumhansl, pesata per durata).
// Nessun riconoscimento automatico, nessuna AI, nessun backend.
// ============================================================

// --- Pattern di un'ottava (offset in semitoni dal Do) ---
var WHITE = [
  { off: 0,  name: 'Do'  },
  { off: 2,  name: 'Re'  },
  { off: 4,  name: 'Mi'  },
  { off: 5,  name: 'Fa'  },
  { off: 7,  name: 'Sol' },
  { off: 9,  name: 'La'  },
  { off: 11, name: 'Si'  }
];
// pos = confine tra tasti bianchi (1..6) su cui appoggiare il tasto nero
var BLACK = [
  { off: 1,  name: 'Do#',  pos: 1 },
  { off: 3,  name: 'Re#',  pos: 2 },
  { off: 6,  name: 'Fa#',  pos: 4 },
  { off: 8,  name: 'Sol#', pos: 5 },
  { off: 10, name: 'La#',  pos: 6 }
];
var OCTAVES_SHOWN = 2;
var WHITES = 7 * OCTAVES_SHOWN;   // 14

var MIN_OCT = 2, MAX_OCT = 5;

// Nomi delle tonalità con lo spelling convenzionale (bemolli/diesis per chiave).
var MAJOR_NAMES = ['Do', 'Re♭', 'Re', 'Mi♭', 'Mi', 'Fa', 'Fa♯', 'Sol', 'La♭', 'La', 'Si♭', 'Si'];
var MINOR_NAMES = ['Do', 'Do♯', 'Re', 'Mi♭', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'Si♭', 'Si'];
function keyName(c) {
  var arr = (c.mode === 'major') ? MAJOR_NAMES : MINOR_NAMES;
  return arr[c.t] + (c.mode === 'major' ? ' maggiore' : ' minore');
}

// Profili di Krumhansl-Schmuckler (tonica in posizione 0).
var KS_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
var KS_MINOR = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

// --- Stato ---
var octave = 3;
var counts = [0,0,0,0,0,0,0,0,0,0,0,0];   // peso accumulato per ogni classe di nota
var heldStart = null;
var SUSTAIN_W = 1.0;                        // peso per secondo di nota tenuta
var BASE_W = 0.4;                           // piccolo peso d'avvio a ogni nota suonata

// --- Web Audio ---
var ctx = null, master = null;
function audio() {
  if (!ctx) {
    var AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.85;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function freqOf(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }
function midiForIdx(idx) { return 12 * (octave + 1) + idx; }   // idx 0..23 dal Do di "octave"
function freqForIdx(idx) { return freqOf(midiForIdx(idx)); }

function makeVoice(freqs) {
  var t = audio().currentTime;
  var g = ctx.createGain();
  var peak = 0.22 / Math.sqrt(freqs.length);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.012);
  g.connect(master);
  var oscs = freqs.map(function (f) {
    var o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    o.connect(g);
    o.start(t);
    return o;
  });
  var stopped = false;
  return {
    stop: function () {
      if (stopped) return;
      stopped = true;
      var n = ctx.currentTime;
      g.gain.cancelScheduledValues(n);
      g.gain.setValueAtTime(g.gain.value, n);
      g.gain.exponentialRampToValueAtTime(0.0001, n + 0.04);
      oscs.forEach(function (o) { try { o.stop(n + 0.06); } catch (e) {} });
      setTimeout(function () { try { g.disconnect(); } catch (e) {} }, 120);
    }
  };
}

// --- Voci attive ---
var heldVoice = null, heldIdx = null;   // nota di prova (drone monofonico)
var pedals = {};                        // note bloccate da HOLD: idx -> { voice, start }
var lastIdx = null;                     // ultima nota selezionata (persiste)

// --- Tastiera (2 ottave) ---
var keyEls = {};
function addCls(idx, c) { if (keyEls[idx]) keyEls[idx].classList.add(c); }
function rmCls(idx, c)  { if (keyEls[idx]) keyEls[idx].classList.remove(c); }

function buildKeyboard() {
  var kb = document.getElementById('keyboard');
  for (var o = 0; o < OCTAVES_SHOWN; o++) {
    WHITE.forEach(function (w) {
      var idx = w.off + 12 * o;
      var el = document.createElement('button');
      el.type = 'button';
      el.className = 'key white';
      el.textContent = w.name;
      el.dataset.idx = idx;
      kb.appendChild(el);
      keyEls[idx] = el;
      bindKey(el, idx);
    });
  }
  for (var o2 = 0; o2 < OCTAVES_SHOWN; o2++) {
    BLACK.forEach(function (b) {
      var idx = b.off + 12 * o2;
      var boundary = b.pos + 7 * o2;            // 1..13 nella griglia di 14 bianchi
      var el = document.createElement('button');
      el.type = 'button';
      el.className = 'key black';
      el.textContent = b.name;
      el.dataset.idx = idx;
      el.style.left = 'calc(' + (boundary * 100 / WHITES) + '% - 2.3%)';
      kb.appendChild(el);
      keyEls[idx] = el;
      bindKey(el, idx);
    });
  }
}

function bindKey(el, idx) {
  el.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    audio();
    toggleHold(idx);
  });
}

// Click su una nota:
//  - se è una nota bloccata (pedale) → la disattiva;
//  - altrimenti è il drone di prova monofonico (altra nota = sostituisce, stessa = spegne).
function toggleHold(idx) {
  if (pedals[idx]) {                      // nota tenuta → disattiva
    commitPedal(idx);
    pedals[idx].voice.stop();
    delete pedals[idx];
    rmCls(idx, 'pedal');
    updateKeyGuess();
    return;
  }
  if (heldIdx === idx) {                   // stessa nota di prova → spegne
    commitHeld();
    heldVoice.stop();
    rmCls(idx, 'on');
    heldVoice = null; heldIdx = null; heldStart = null;
    updateKeyGuess();
    return;
  }
  if (heldVoice) { commitHeld(); heldVoice.stop(); rmCls(heldIdx, 'on'); }
  heldVoice = makeVoice([freqForIdx(idx)]);
  heldIdx = idx;
  heldStart = performance.now();
  lastIdx = idx;
  counts[idx % 12] += BASE_W;
  addCls(idx, 'on');
  updateKeyGuess();
}

// Cambio ottava: ri-aggancia tutte le voci attive (prova + pedali) alla nuova ottava.
function refreshVoices() {
  if (heldVoice && heldIdx !== null) { heldVoice.stop(); heldVoice = makeVoice([freqForIdx(heldIdx)]); }
  Object.keys(pedals).forEach(function (k) {
    pedals[k].voice.stop();
    pedals[k].voice = makeVoice([freqForIdx(Number(k))]);
  });
}

// --- Stima della tonalità dalle note suonate (pesata per durata) ---
function commitHeld() {
  if (heldIdx === null || heldStart === null) return;
  var now = performance.now();
  counts[heldIdx % 12] += (now - heldStart) / 1000 * SUSTAIN_W;
  heldStart = now;
}
function commitPedal(idx) {
  var p = pedals[idx];
  if (!p) return;
  var now = performance.now();
  counts[Number(idx) % 12] += (now - p.start) / 1000 * SUSTAIN_W;
  p.start = now;
}

// HOLD: aggiunge l'ultima nota selezionata al set di note tenute (pedali).
// Premendolo più volte su note diverse, le tiene tutte insieme.
function addPedal() {
  var idx = (heldIdx !== null) ? heldIdx : lastIdx;
  if (idx === null || pedals[idx]) return;   // niente da tenere o già tenuta
  if (heldIdx === idx) {                      // trasferisce il drone che sta suonando
    commitHeld();
    pedals[idx] = { voice: heldVoice, start: performance.now() };
    rmCls(idx, 'on');
    heldVoice = null; heldIdx = null; heldStart = null;
  } else {                                    // l'ultima nota non suona più: la riattacca
    pedals[idx] = { voice: makeVoice([freqForIdx(idx)]), start: performance.now() };
  }
  addCls(idx, 'pedal');
  updateKeyGuess();
}

// Stop: ferma tutto (pedali + nota di prova).
function stopAll() {
  Object.keys(pedals).forEach(function (k) {
    commitPedal(k);
    pedals[k].voice.stop();
    rmCls(k, 'pedal');
  });
  pedals = {};
  if (heldVoice) { commitHeld(); heldVoice.stop(); rmCls(heldIdx, 'on'); heldVoice = null; heldIdx = null; heldStart = null; }
  updateKeyGuess();
}

function pearson(x, p) {
  var n = 12, sx = 0, sp = 0, sxp = 0, sxx = 0, spp = 0;
  for (var i = 0; i < n; i++) {
    sx += x[i]; sp += p[i];
    sxp += x[i] * p[i]; sxx += x[i] * x[i]; spp += p[i] * p[i];
  }
  var den = Math.sqrt((n * sxx - sx * sx) * (n * spp - sp * sp));
  return den === 0 ? 0 : (n * sxp - sx * sp) / den;
}

function estimateKey() {
  var cands = [];
  for (var t = 0; t < 12; t++) {
    ['major', 'minor'].forEach(function (m) {
      var base = (m === 'major') ? KS_MAJOR : KS_MINOR;
      var prof = [];
      for (var pc = 0; pc < 12; pc++) prof[pc] = base[(pc - t + 12) % 12];
      cands.push({ t: t, mode: m, r: pearson(counts, prof) });
    });
  }
  cands.sort(function (a, b) { return b.r - a.r; });
  var temp = 0.18, maxr = cands[0].r, sum = 0;
  cands.forEach(function (c) { c.conf = Math.exp((c.r - maxr) / temp); sum += c.conf; });
  cands.forEach(function (c) { c.conf /= sum; });
  return cands;
}

var resultEl = document.getElementById('result');
var keyGuessEl = document.getElementById('keyGuess');
function updateKeyGuess() {
  var total = 0, distinct = 0;
  counts.forEach(function (c) { total += c; if (c > 0) distinct++; });
  if (total < 3 || distinct < 2) { resultEl.classList.add('hidden'); return; }
  var cands = estimateKey();
  var top = cands[0], second = cands[1];
  var pct = Math.round(top.conf * 100);
  var label = top.conf >= 0.55 ? 'netta' : (top.conf >= 0.35 ? 'probabile' : 'incerta');
  var conf = '<span class="conf">' + label + ' · ' + pct + '%</span>';
  var ratio = top.r > 0 ? second.r / top.r : 0;
  if (ratio > 0.92) {
    keyGuessEl.innerHTML = 'Tonalità probabile: <b>' + keyName(top) + '</b> o <b>' + keyName(second) + '</b>' + conf;
  } else {
    keyGuessEl.innerHTML = 'Tonalità probabile: <b>' + keyName(top) + '</b>' + conf +
      '<span class="alt">oppure ' + keyName(second) + '</span>';
  }
  resultEl.classList.remove('hidden');
}

function resetGuess() {
  counts = [0,0,0,0,0,0,0,0,0,0,0,0];
  var now = performance.now();
  heldStart = (heldIdx !== null) ? now : null;
  Object.keys(pedals).forEach(function (k) { pedals[k].start = now; });
  resultEl.classList.add('hidden');
  keyGuessEl.innerHTML = '';
}
document.getElementById('resetGuess').addEventListener('click', resetGuess);
document.getElementById('holdBtn').addEventListener('click', addPedal);
document.getElementById('stopBtn').addEventListener('click', stopAll);

// Mentre tieni note (pedali e/o prova), accumula peso e aggiorna la stima live.
setInterval(function () {
  var active = false;
  Object.keys(pedals).forEach(function (k) { commitPedal(k); active = true; });
  if (heldIdx !== null) { commitHeld(); active = true; }
  if (active) updateKeyGuess();
}, 300);

// --- Ottava (solo − / +) ---
function setOctave(v) {
  octave = Math.max(MIN_OCT, Math.min(MAX_OCT, v));
  refreshVoices();
}
document.getElementById('octDown').addEventListener('click', function () { setOctave(octave - 1); });
document.getElementById('octUp').addEventListener('click', function () { setOctave(octave + 1); });

// --- Player audio (play/pausa + avanzamento + volume, sempre 1x) ---
var au       = document.getElementById('audio');
var fileIn   = document.getElementById('fileInput');
var fileName = document.getElementById('fileName');
var player   = document.getElementById('player');
var playBtn  = document.getElementById('playBtn');
var volEl    = document.getElementById('vol');
var seek     = document.getElementById('seek');
var curEl    = document.getElementById('cur');
var durEl    = document.getElementById('dur');

function fmtTime(s) {
  if (!isFinite(s)) s = 0;
  var m = Math.floor(s / 60);
  var ss = Math.floor(s % 60);
  return m + ':' + (ss < 10 ? '0' : '') + ss;
}

var objUrl = null;
fileIn.addEventListener('change', function () {
  var f = fileIn.files && fileIn.files[0];
  if (!f) return;
  if (objUrl) URL.revokeObjectURL(objUrl);
  objUrl = URL.createObjectURL(f);
  au.src = objUrl;
  au.playbackRate = 1;
  au.load();
  fileName.textContent = f.name;
  player.classList.remove('hidden');
  resetGuess();
});

playBtn.addEventListener('click', function () {
  if (au.paused) au.play(); else au.pause();
});
au.addEventListener('play',  function () { playBtn.textContent = '❚❚'; });
au.addEventListener('pause', function () { playBtn.textContent = '▶'; });
au.addEventListener('ended', function () { playBtn.textContent = '▶'; });

au.addEventListener('loadedmetadata', function () { durEl.textContent = fmtTime(au.duration); });
au.addEventListener('timeupdate', function () {
  curEl.textContent = fmtTime(au.currentTime);
  if (au.duration) seek.value = Math.round((au.currentTime / au.duration) * 1000);
});
seek.addEventListener('input', function () {
  if (au.duration) au.currentTime = (seek.value / 1000) * au.duration;
});

volEl.addEventListener('input', function () { au.volume = volEl.value / 100; });

// --- Avvio ---
buildKeyboard();
