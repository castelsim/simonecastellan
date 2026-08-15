/* Rumore rosa e toni di test — tutto generato in Web Audio, niente file.
   Nato per il palco: rosa per tarare il PA, sinusoide per cercare il fischio,
   sweep per sentire i buchi, Solo L / Solo R per capire quale cassa suona. */

var ctx = null;
var master = null, gainL = null, gainR = null, merger = null;
var source = null;                 // BufferSource o Oscillator, secondo il segnale
var playing = false;

var kind = 'pink';                 // pink | white | sine | sweep
var freq = 440;
var levelDb = -20;
var route = 'stereo';              // stereo | left | right

var SWEEP_SEC = 8;                 // durata di una spazzata 20 Hz → 20 kHz
var sweepAt = 0, sweepTimer = null, sweepStart = 0, sweepUi = null;
// Ripartenza dopo un cambio di segnale: va tenuta per nome, altrimenti premendo
// PLAY dentro quei 170 ms partono DUE sorgenti e la seconda non si spegne più.
var restartTimer = null;
var wakeLock = null;

var NAMES = { pink: 'Rumore rosa', white: 'Rumore bianco', sine: 'Sinusoide', sweep: 'Sweep 20 Hz → 20 kHz' };

// A che serve ognuno: il nome del segnale non lo dice a chi non fa il mestiere.
var USI = {
  pink:  'Tiene dentro tutte le frequenze insieme. È il suono con cui si tara un impianto.',
  white: 'Come il rosa, ma più acuto e sibilante. Va bene per una prova veloce.',
  sine:  'Una frequenza sola, pulita. Serve a trovare il fischio o a provare i bassi.',
  sweep: 'Sale piano dal grave all’acuto. Se qualcosa vibra o sparisce, lo senti passare.'
};

var playBtn  = document.getElementById('playBtn');
var readout  = document.getElementById('readout');
var useHint  = document.getElementById('useHint');
var kindSeg  = document.getElementById('kindSeg');
var routeSeg = document.getElementById('routeSeg');
var freqBox  = document.getElementById('freqBox');
var freqInp  = document.getElementById('freq');
var levelInp = document.getElementById('level');
var levelVal = document.getElementById('levelVal');

// --- Grafo audio -----------------------------------------------------------

/* Il contesto lo tiene /comune/audio.js: lo crea una volta sola, lo sblocca
   dentro il gesto, sposta la categoria audio di iOS e lo riprende quando si
   torna sulla pagina. Qui resta il grafo, che è di questo strumento: un
   guadagno generale che si sdoppia in sinistra e destra, per il Solo L / R. */
function ensureCtx() {
  if (!ctx) {
    ctx = AUDIO.contesto();
    if (!ctx) return false;
    master = ctx.createGain();
    master.gain.value = 0;                       // si entra sempre da zero
    gainL = ctx.createGain();
    gainR = ctx.createGain();
    merger = ctx.createChannelMerger(2);
    master.connect(gainL);
    master.connect(gainR);
    gainL.connect(merger, 0, 0);
    gainR.connect(merger, 0, 1);
    merger.connect(ctx.destination);
    applyRoute();
  } else {
    AUDIO.contesto();                            // riprende se era sospeso
  }
  return true;
}

/* Il rumore rosa lo genera SEGNALI, insieme a «Tara un impianto»: era la stessa
   funzione scritta due volte, e due copie divergono sempre. Se un giorno si
   corregge il filtro, si corregge per tutti e due. */
function noise(pink) {
  return pink ? SEGNALI.rosa(ctx) : SEGNALI.bianco(ctx);
}

function amp() { return Math.pow(10, levelDb / 20); }

function applyRoute() {
  if (!gainL) return;
  gainL.gain.value = (route === 'right') ? 0 : 1;
  gainR.gain.value = (route === 'left') ? 0 : 1;
}

// --- Sweep -----------------------------------------------------------------

function scheduleSweep(osc) {
  function cycle(at) {
    osc.frequency.setValueAtTime(20, at);
    osc.frequency.exponentialRampToValueAtTime(20000, at + SWEEP_SEC);
  }
  sweepAt = ctx.currentTime;
  sweepStart = sweepAt;
  cycle(sweepAt);
  sweepAt += SWEEP_SEC;
  // Le rampe si programmano in anticipo: il browser le esegue anche se la
  // pagina è in secondo piano, dove i timer rallentano.
  sweepTimer = setInterval(function () {
    while (sweepAt < ctx.currentTime + 2 * SWEEP_SEC) { cycle(sweepAt); sweepAt += SWEEP_SEC; }
  }, 1000);
  tickSweep();
}

/* Un timer, non requestAnimationFrame: con il telefono appoggiato o la pagina
   non in primo piano i frame si fermano, e la lettura resterebbe congelata. */
function tickSweep() {
  if (sweepUi) clearInterval(sweepUi);
  sweepUi = setInterval(function () {
    if (!playing || kind !== 'sweep') { clearInterval(sweepUi); sweepUi = null; return; }
    var p = ((ctx.currentTime - sweepStart) % SWEEP_SEC) / SWEEP_SEC;
    readout.textContent = 'Sweep · ' + fmtHz(20 * Math.pow(1000, p));
  }, 120);
}

function fmtHz(f) {
  return f >= 1000 ? (Math.round(f / 100) / 10).toString().replace('.', ',') + ' kHz'
                   : Math.round(f) + ' Hz';
}

// --- Avvio e arresto -------------------------------------------------------

function start() {
  if (restartTimer) { clearTimeout(restartTimer); restartTimer = null; }
  if (playing) return;              // già in riproduzione: niente seconda sorgente
  if (!ensureCtx()) return;         // niente Web Audio: l'avviso l'ha già scritto
  if (kind === 'pink' || kind === 'white') {
    source = ctx.createBufferSource();
    source.buffer = noise(kind === 'pink');
    source.loop = true;
  } else {
    source = ctx.createOscillator();
    source.type = 'sine';
    source.frequency.value = (kind === 'sine') ? freq : 20;
  }
  source.connect(master);
  source.start();
  // playing PRIMA dello sweep: l'animazione della frequenza viva si ferma da
  // sola se non risulta in riproduzione, e non ripartirebbe più.
  playing = true;
  if (kind === 'sweep') scheduleSweep(source);

  // Rampa breve: senza, l'attacco secco fa un colpo sui coni.
  master.gain.cancelScheduledValues(ctx.currentTime);
  master.gain.setValueAtTime(0.0001, ctx.currentTime);
  master.gain.exponentialRampToValueAtTime(amp(), ctx.currentTime + 0.08);

  playBtn.textContent = 'STOP';
  playBtn.classList.add('on');
  playBtn.setAttribute('aria-pressed', 'true');
  updateReadout();
  keepAwake();
}

function stop() {
  playing = false;
  if (sweepTimer) { clearInterval(sweepTimer); sweepTimer = null; }
  if (sweepUi) { clearInterval(sweepUi); sweepUi = null; }
  if (ctx && master) {
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
    master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
  }
  var s = source;
  source = null;
  if (s) setTimeout(function () { try { s.stop(); s.disconnect(); } catch (e) {} }, 150);

  playBtn.textContent = 'PLAY';
  playBtn.classList.remove('on');
  playBtn.setAttribute('aria-pressed', 'false');
  updateReadout();
  releaseAwake();
}

/* In sala il telefono resta acceso sul leggio: se lo schermo si spegne, su iOS
   il suono si ferma. Dove c'è, tengo la pagina sveglia mentre suona. */
function keepAwake() {
  try {
    if (navigator.wakeLock && !wakeLock) {
      navigator.wakeLock.request('screen').then(function (l) { wakeLock = l; }, function () {});
    }
  } catch (e) {}
}
function releaseAwake() {
  try { if (wakeLock) { wakeLock.release(); wakeLock = null; } } catch (e) {}
}

// --- Interfaccia -----------------------------------------------------------

function updateReadout() {
  if (kind === 'sweep') {
    if (!playing) readout.textContent = NAMES.sweep;
    return;                                   // durante lo sweep scrive tickSweep
  }
  readout.textContent = (kind === 'sine') ? 'Sinusoide · ' + fmtHz(freq) : NAMES[kind];
}

function setKind(k) {
  if (k === kind) return;
  var wasPlaying = playing;
  if (wasPlaying) stop();
  kind = k;
  [].forEach.call(kindSeg.querySelectorAll('.seg-btn'), function (b) {
    b.classList.toggle('active', b.dataset.kind === k);
  });
  freqBox.classList.toggle('hidden', k !== 'sine');
  updateReadout();
  // Il cambio di segnale mentre suona non deve costringere a ripremere PLAY.
  if (wasPlaying) setTimeout(start, 170);
}

function setFreq(f, fromInput) {
  f = Math.min(20000, Math.max(20, Math.round(f || 0)));
  freq = f;
  if (!fromInput) freqInp.value = f;
  [].forEach.call(document.querySelectorAll('.pset'), function (b) {
    b.classList.toggle('active', Number(b.dataset.f) === f);
  });
  if (playing && kind === 'sine' && source) {
    source.frequency.setTargetAtTime(f, ctx.currentTime, 0.01);
  }
  updateReadout();
}

function setLevel(db) {
  levelDb = db;
  levelVal.textContent = '−' + Math.abs(db) + ' dBFS';
  if (playing && master) master.gain.setTargetAtTime(amp(), ctx.currentTime, 0.02);
}

playBtn.addEventListener('click', function () { playing ? stop() : start(); });

kindSeg.addEventListener('click', function (e) {
  var b = e.target.closest('.seg-btn');
  if (b) setKind(b.dataset.kind);
});

routeSeg.addEventListener('click', function (e) {
  var b = e.target.closest('.seg-btn');
  if (!b) return;
  route = b.dataset.route;
  [].forEach.call(routeSeg.querySelectorAll('.seg-btn'), function (x) {
    x.classList.toggle('active', x === b);
  });
  applyRoute();
});

document.getElementById('presets').addEventListener('click', function (e) {
  var b = e.target.closest('.pset');
  if (b) setFreq(Number(b.dataset.f));
});

freqInp.addEventListener('input', function () { setFreq(Number(freqInp.value), true); });
freqInp.addEventListener('blur', function () { setFreq(Number(freqInp.value)); });
document.getElementById('fDown').addEventListener('click', function () { setFreq(freq / 2); });
document.getElementById('fUp').addEventListener('click', function () { setFreq(freq * 2); });

levelInp.addEventListener('input', function () { setLevel(Number(levelInp.value)); });

// Barra spaziatrice: le mani sono sul mixer, non sul telefono.
document.addEventListener('keydown', function (e) {
  if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
    e.preventDefault();
    playing ? stop() : start();
  }
});

/* Se l'audio non parte, il pulsante diceva STOP e dalle casse non usciva
   niente: la pagina fingeva di suonare, e in sala si cerca il guasto sul
   mixer. La riga grande — quella che di solito dice il nome del segnale — è
   il posto dove uno sta già guardando. */
AUDIO.seNonParte(function (msg) {
  if (playing) stop();
  readout.textContent = msg;
});

setFreq(440);
setLevel(-20);
updateReadout();
