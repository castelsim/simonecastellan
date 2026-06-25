'use strict';

// ============================================================
// Trova tonalità da audio — strumento manuale d'ascolto.
// Carica un brano, suona note/accordi/scale sopra l'audio e
// trova a orecchio la tonalità. Tutto client-side.
//   - Player <audio> con velocità a intonazione costante.
//   - Tastiera Web Audio, oscillatori sinusoidali puri.
//   - Hold (drone), Stop globale, Ottava, Suona scala.
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
// pos = confine tra tasti bianchi (0..7) su cui appoggiare il tasto nero
var BLACK = [
  { pc: 1,  name: 'Do#',  pos: 1 },
  { pc: 3,  name: 'Re#',  pos: 2 },
  { pc: 6,  name: 'Fa#',  pos: 4 },
  { pc: 8,  name: 'Sol#', pos: 5 },
  { pc: 10, name: 'La#',  pos: 6 }
];

var CHORD = {            // intervalli (semitoni) per modalità
  note:  [0],
  major: [0, 4, 7],
  minor: [0, 3, 7]
};
var SCALE = {            // scala su un'ottava, nota finale inclusa
  major: [0, 2, 4, 5, 7, 9, 11, 12],
  minor: [0, 2, 3, 5, 7, 8, 10, 12]   // minore naturale
};

var MIN_OCT = 2, MAX_OCT = 6;

// --- Stato ---
var mode = 'note';       // 'note' | 'major' | 'minor'
var hold = false;
var octave = 4;
var lastTonic = null;    // { pc, octave } — ultima nota selezionata

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

// Frequenze per una nota in base alla modalità (nota o accordo).
function freqsFor(pc, oct) {
  var base = baseMidi(pc, oct);
  return CHORD[mode].map(function (i) { return freqOf(base + i); });
}

// Una voce = uno o più oscillatori sinusoidali con inviluppo morbido.
function makeVoice(freqs) {
  var t = audio().currentTime;
  var g = ctx.createGain();
  var peak = 0.22 / Math.sqrt(freqs.length);   // headroom per gli accordi
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.012);   // attacco
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
      g.gain.exponentialRampToValueAtTime(0.0001, n + 0.04);  // release: niente click
      oscs.forEach(function (o) { try { o.stop(n + 0.06); } catch (e) {} });
      setTimeout(function () { try { g.disconnect(); } catch (e) {} }, 120);
    }
  };
}

// --- Voci attive ---
var pressVoice = null, pressPc = null;   // nota premuta (Hold spento)
var heldVoice = null,  heldPc = null;    // nota in Hold

function setTonic(pc) { lastTonic = { pc: pc, octave: octave }; }

// --- Tastiera ---
var keyEls = {};   // pc -> elemento
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

function highlight(pc, cls) { if (keyEls[pc]) keyEls[pc].classList.add(cls); }
function unhighlight(pc, cls) { if (keyEls[pc]) keyEls[pc].classList.remove(cls); }

function bindKey(el, pc) {
  el.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    audio();
    setTonic(pc);
    if (hold) toggleHold(pc);
    else startPress(pc);
  });
  // Hold spento: il suono si ferma al rilascio (anche uscendo dal tasto).
  var release = function () { if (!hold) stopPress(pc); };
  el.addEventListener('pointerup', release);
  el.addEventListener('pointerleave', release);
  el.addEventListener('pointercancel', release);
}

// Hold spento — nota mentre premo
function startPress(pc) {
  if (pressVoice) { pressVoice.stop(); unhighlight(pressPc, 'on'); }
  pressVoice = makeVoice(freqsFor(pc, octave));
  pressPc = pc;
  highlight(pc, 'on');
}
function stopPress(pc) {
  if (pressVoice && pressPc === pc) {
    pressVoice.stop();
    unhighlight(pressPc, 'on');
    pressVoice = null; pressPc = null;
  }
}

// Hold acceso — la nota resta; stessa nota = spegne; altra nota = sostituisce
function toggleHold(pc) {
  if (heldPc === pc) {
    heldVoice.stop();
    unhighlight(heldPc, 'on');
    heldVoice = null; heldPc = null;
    return;
  }
  if (heldVoice) { heldVoice.stop(); unhighlight(heldPc, 'on'); }
  heldVoice = makeVoice(freqsFor(pc, octave));
  heldPc = pc;
  highlight(pc, 'on');
}

// Riavvia la nota tenuta (dopo cambio modalità o ottava)
function refreshHeld() {
  if (heldVoice && heldPc !== null) {
    heldVoice.stop();
    heldVoice = makeVoice(freqsFor(heldPc, octave));
  }
}

// --- Stop globale ---
function stopAll() {
  stopScale();
  if (pressVoice) { pressVoice.stop(); unhighlight(pressPc, 'on'); pressVoice = null; pressPc = null; }
  if (heldVoice)  { heldVoice.stop();  unhighlight(heldPc, 'on');  heldVoice = null;  heldPc = null; }
}

// --- Suona scala ---
var scaleTimers = [];
var scaleVoice = null;
var scalePlaying = false;
function playScale() {
  stopScale();
  // ferma droni/note per ascoltare la scala pulita
  if (pressVoice) { pressVoice.stop(); unhighlight(pressPc, 'on'); pressVoice = null; pressPc = null; }
  if (heldVoice)  { heldVoice.stop();  unhighlight(heldPc, 'on');  heldVoice = null;  heldPc = null; }

  audio();
  var tonic = lastTonic || { pc: 0, octave: octave };
  var intervals = (mode === 'minor') ? SCALE.minor : SCALE.major;  // 'note' → maggiore
  var base = baseMidi(tonic.pc, tonic.octave);
  var step = 420, len = 360;

  scalePlaying = true;
  document.getElementById('scaleBtn').classList.add('playing');

  intervals.forEach(function (iv, i) {
    var t = setTimeout(function () {
      var keyPc = (tonic.pc + iv) % 12;
      highlight(keyPc, 'play');
      if (scaleVoice) scaleVoice.stop();
      scaleVoice = makeVoice([freqOf(base + iv)]);
      var off = setTimeout(function () { unhighlight(keyPc, 'play'); }, len);
      scaleTimers.push(off);
    }, i * step);
    scaleTimers.push(t);
  });

  var end = setTimeout(function () {
    if (scaleVoice) { scaleVoice.stop(); scaleVoice = null; }
    scalePlaying = false;
    document.getElementById('scaleBtn').classList.remove('playing');
  }, intervals.length * step + 40);
  scaleTimers.push(end);
}
function stopScale() {
  scaleTimers.forEach(clearTimeout);
  scaleTimers = [];
  if (scaleVoice) { scaleVoice.stop(); scaleVoice = null; }
  Object.keys(keyEls).forEach(function (pc) { keyEls[pc].classList.remove('play'); });
  scalePlaying = false;
  document.getElementById('scaleBtn').classList.remove('playing');
}

// --- Controlli UI ---
var modeBtns = document.querySelectorAll('.seg-btn');
modeBtns.forEach(function (btn) {
  btn.addEventListener('click', function () {
    mode = btn.dataset.mode;
    modeBtns.forEach(function (b) { b.classList.toggle('active', b === btn); });
    refreshHeld();   // la modalità influenza anche la nota in Hold
  });
});

var holdBtn = document.getElementById('holdBtn');
holdBtn.addEventListener('click', function () {
  hold = !hold;
  holdBtn.setAttribute('aria-pressed', hold ? 'true' : 'false');
  // passando in modalità non-Hold, eventuali note premute restano gestite dal rilascio
  if (!hold && heldVoice) { heldVoice.stop(); unhighlight(heldPc, 'on'); heldVoice = null; heldPc = null; }
});

document.getElementById('stopBtn').addEventListener('click', stopAll);

var octLabel = document.getElementById('octLabel');
function setOctave(v) {
  octave = Math.max(MIN_OCT, Math.min(MAX_OCT, v));
  octLabel.textContent = 'Ottava ' + octave;
  refreshHeld();   // cambia l'altezza reale della nota tenuta
}
document.getElementById('octDown').addEventListener('click', function () { setOctave(octave - 1); });
document.getElementById('octUp').addEventListener('click', function () { setOctave(octave + 1); });

document.getElementById('scaleBtn').addEventListener('click', playScale);

// --- Player audio ---
var au       = document.getElementById('audio');
var fileIn   = document.getElementById('fileInput');
var fileName = document.getElementById('fileName');
var player   = document.getElementById('player');
var playBtn  = document.getElementById('playBtn');
var seek     = document.getElementById('seek');
var curEl    = document.getElementById('cur');
var durEl    = document.getElementById('dur');
var volEl    = document.getElementById('vol');
var rateBtns = document.querySelectorAll('.rate');

var objUrl = null;
function fmtTime(s) {
  if (!isFinite(s)) s = 0;
  var m = Math.floor(s / 60);
  var ss = Math.floor(s % 60);
  return m + ':' + (ss < 10 ? '0' : '') + ss;
}

fileIn.addEventListener('change', function () {
  var f = fileIn.files && fileIn.files[0];
  if (!f) return;
  if (objUrl) URL.revokeObjectURL(objUrl);
  objUrl = URL.createObjectURL(f);
  au.src = objUrl;
  au.load();
  fileName.textContent = f.name;
  player.classList.remove('hidden');
  // mantiene velocità a intonazione costante quando supportato
  applyRate(parseFloat(document.querySelector('.rate.active').dataset.rate));
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

function applyRate(r) {
  au.playbackRate = r;
  au.preservesPitch = true;
  au.mozPreservesPitch = true;
  au.webkitPreservesPitch = true;
}
rateBtns.forEach(function (btn) {
  btn.addEventListener('click', function () {
    rateBtns.forEach(function (b) { b.classList.toggle('active', b === btn); });
    applyRate(parseFloat(btn.dataset.rate));
  });
});

// --- Avvio ---
buildKeyboard();
setOctave(4);
