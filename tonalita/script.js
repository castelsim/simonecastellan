'use strict';

// ============================================================
// Tonalità — strumento manuale d'ascolto.
// Carica un brano, suona note/accordi sopra l'audio e trova a
// orecchio la tonalità. Tutto client-side.
//   - Player <audio> minimale (play/pausa, avanzamento, volume), 1x.
//   - Tastiera Web Audio, oscillatori sinusoidali puri.
//   - Le note restano in "hold" (drone): cliccando un'altra nota
//     si sostituisce, ricliccando la stessa si spegne. Stop ferma tutto.
// Nessun riconoscimento automatico, nessuna AI, nessun backend.
// ============================================================

// --- Note (italiano) e intervalli ---
var WHITE = [
  { pc: 0,  name: 'Do'  },
  { pc: 2,  name: 'Re'  },
  { pc: 4,  name: 'Mi'  },
  { pc: 5,  name: 'Fa'  },
  { pc: 7,  name: 'Sol' },
  { pc: 9,  name: 'La'  },
  { pc: 11, name: 'Si'  }
];
var BLACK = [
  { pc: 1,  name: 'Do#',  pos: 1 },
  { pc: 3,  name: 'Re#',  pos: 2 },
  { pc: 6,  name: 'Fa#',  pos: 4 },
  { pc: 8,  name: 'Sol#', pos: 5 },
  { pc: 10, name: 'La#',  pos: 6 }
];

// Note aggiunte (oltre alla tonica) per la sola visualizzazione dell'accordo.
var CHORD_TONES = {
  major: [4, 7],
  minor: [3, 7]
};

var MIN_OCT = 2, MAX_OCT = 6;

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
var chordView = null;   // null | 'major' | 'minor' — solo evidenziazione
var octave = 3;
var counts = [0,0,0,0,0,0,0,0,0,0,0,0];   // peso accumulato per ogni nota
var heldStart = null;                      // istante (ms) in cui è iniziata la nota tenuta
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
function baseMidi(pc, oct) { return 12 * (oct + 1) + pc; }   // Do4 = 60

function freqFor(pc, oct) {
  return freqOf(baseMidi(pc, oct));   // sempre una nota singola
}

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

// --- Nota tenuta (drone) ---
var heldVoice = null, heldPc = null;

// --- Tastiera ---
var keyEls = {};
function buildKeyboard() {
  var kb = document.getElementById('keyboard');
  WHITE.forEach(function (k) {
    var el = document.createElement('button');
    el.type = 'button';
    el.className = 'key white';
    el.textContent = k.name;
    el.dataset.pc = k.pc;
    kb.appendChild(el);
    keyEls[k.pc] = el;
    bindKey(el, k.pc);
  });
  BLACK.forEach(function (k) {
    var el = document.createElement('button');
    el.type = 'button';
    el.className = 'key black';
    el.textContent = k.name;
    el.dataset.pc = k.pc;
    el.style.left = 'calc(' + (k.pos * 100 / 7) + '% - 4.5%)';
    kb.appendChild(el);
    keyEls[k.pc] = el;
    bindKey(el, k.pc);
  });
}

function highlight(pc) { if (keyEls[pc]) keyEls[pc].classList.add('on'); }
function unhighlight(pc) { if (keyEls[pc]) keyEls[pc].classList.remove('on'); }

// Evidenzia in tenue le note dell'accordo (oltre alla tonica suonata).
function clearGhost() {
  Object.keys(keyEls).forEach(function (pc) { keyEls[pc].classList.remove('ghost'); });
}
function updateChordHighlight() {
  clearGhost();
  if (!chordView || heldPc === null) return;
  CHORD_TONES[chordView].forEach(function (iv) {
    var pc = (heldPc + iv) % 12;
    if (pc !== heldPc && keyEls[pc]) keyEls[pc].classList.add('ghost');
  });
}

function bindKey(el, pc) {
  el.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    audio();
    toggleHold(pc);
  });
}

// Click su una nota: la tiene; altra nota = sostituisce; stessa nota = spegne.
function toggleHold(pc) {
  if (heldPc === pc) {
    commitHeld();                // accredita la durata finora tenuta
    heldVoice.stop();
    unhighlight(heldPc);
    heldVoice = null; heldPc = null; heldStart = null;
    updateChordHighlight();
    updateKeyGuess();
    return;
  }
  if (heldVoice) { commitHeld(); heldVoice.stop(); unhighlight(heldPc); }
  heldVoice = makeVoice([freqFor(pc, octave)]);
  heldPc = pc;
  heldStart = performance.now();
  counts[pc] += BASE_W;          // piccolo peso d'avvio
  highlight(pc);
  updateChordHighlight();
  updateKeyGuess();
}

// --- Stima della tonalità dalle note suonate ---
// Accredita alla nota tenuta il tempo trascorso da heldStart (più la tieni, più pesa).
function commitHeld() {
  if (heldPc === null || heldStart === null) return;
  var now = performance.now();
  counts[heldPc] += (now - heldStart) / 1000 * SUSTAIN_W;
  heldStart = now;
}
// Mentre tieni una nota, accumula peso e aggiorna la stima in tempo reale.
setInterval(function () {
  if (heldPc !== null) { commitHeld(); updateKeyGuess(); }
}, 300);

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
  // confidenza: softmax sulle correlazioni (per tutti i candidati)
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
  // se la seconda ipotesi è quasi identica (tipico magg ↔ relativa min), mostrale insieme
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
  // se una nota è tenuta, riparte da ora ad accumulare peso
  heldStart = (heldPc !== null) ? performance.now() : null;
  resultEl.classList.add('hidden');
  keyGuessEl.innerHTML = '';
}
document.getElementById('resetGuess').addEventListener('click', resetGuess);

// Riavvia la nota tenuta (dopo cambio ottava)
function refreshHeld() {
  if (heldVoice && heldPc !== null) {
    heldVoice.stop();
    heldVoice = makeVoice([freqFor(heldPc, octave)]);
  }
}


// --- Controlli UI ---
var modeBtns = document.querySelectorAll('.seg-btn');
modeBtns.forEach(function (btn) {
  btn.addEventListener('click', function () {
    var v = btn.dataset.chord;
    chordView = (v === 'none') ? null : v;   // "Nota" = nessuna evidenziazione
    modeBtns.forEach(function (b) { b.classList.toggle('active', b === btn); });
    updateChordHighlight();
  });
});

var octLabel = document.getElementById('octLabel');
function setOctave(v) {
  octave = Math.max(MIN_OCT, Math.min(MAX_OCT, v));
  octLabel.textContent = 'Ott. ' + octave;
  refreshHeld();
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
  resetGuess();   // nuova canzone, nuova stima
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
setOctave(3);
