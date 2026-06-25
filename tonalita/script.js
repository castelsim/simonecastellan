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

var CHORD = {
  note:  [0],
  major: [0, 4, 7],
  minor: [0, 3, 7]
};

var MIN_OCT = 2, MAX_OCT = 6;

// --- Stato ---
var mode = 'note';
var octave = 3;

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

function freqsFor(pc, oct) {
  var base = baseMidi(pc, oct);
  return CHORD[mode].map(function (i) { return freqOf(base + i); });
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
    heldVoice.stop();
    unhighlight(heldPc);
    heldVoice = null; heldPc = null;
    return;
  }
  if (heldVoice) { heldVoice.stop(); unhighlight(heldPc); }
  heldVoice = makeVoice(freqsFor(pc, octave));
  heldPc = pc;
  highlight(pc);
}

// Riavvia la nota tenuta (dopo cambio modalità o ottava)
function refreshHeld() {
  if (heldVoice && heldPc !== null) {
    heldVoice.stop();
    heldVoice = makeVoice(freqsFor(heldPc, octave));
  }
}

function stopAll() {
  if (heldVoice) { heldVoice.stop(); unhighlight(heldPc); heldVoice = null; heldPc = null; }
}

// --- Controlli UI ---
var modeBtns = document.querySelectorAll('.seg-btn');
modeBtns.forEach(function (btn) {
  btn.addEventListener('click', function () {
    mode = btn.dataset.mode;
    modeBtns.forEach(function (b) { b.classList.toggle('active', b === btn); });
    refreshHeld();
  });
});

document.getElementById('stopBtn').addEventListener('click', stopAll);

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
