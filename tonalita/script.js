'use strict';

// ============================================================
// Tonalità — strumento manuale d'ascolto.
// Carica un brano, suona note sopra l'audio e trova a orecchio la
// tonalità. Tutto client-side.
//   - Player <audio> minimale (play/pausa, avanzamento, volume), 1x.
//   - Tastiera Web Audio a 1 ottava; +/− cambia "pagina" di ottava.
//   - Note premute restano al loro pitch assoluto anche cambiando ottava.
//   - Clic = nota sostenuta (polifonica); riclic = spegne; STOP chiude tutto.
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
var BLACK = [
  { off: 1,  name: 'Do#',  pos: 1 },
  { off: 3,  name: 'Re#',  pos: 2 },
  { off: 6,  name: 'Fa#',  pos: 4 },
  { off: 8,  name: 'Sol#', pos: 5 },
  { off: 10, name: 'La#',  pos: 6 }
];
var WHITES = 7;

var MIN_OCT = 2, MAX_OCT = 6;

// Nomi delle tonalità con lo spelling convenzionale (bemolli/diesis per chiave).
var MAJOR_NAMES = ['Do', 'Re♭', 'Re', 'Mi♭', 'Mi', 'Fa', 'Fa♯', 'Sol', 'La♭', 'La', 'Si♭', 'Si'];
var MINOR_NAMES = ['Do', 'Do♯', 'Re', 'Mi♭', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'Si♭', 'Si'];
function keyName(c) {
  var arr = (c.mode === 'major') ? MAJOR_NAMES : MINOR_NAMES;
  return arr[c.t] + (c.mode === 'major' ? ' maggiore' : ' minore');
}

// Profili di Krumhansl-Schmuckler (tonica in posizione 0).
/* I profili di Krumhansl, la correlazione e la stima stanno in `stima.js`:
   lì si possono provare con `node`, qui dentro no. */

// --- Stato ---
var octave = 4;   // si parte dall'ottava del Do centrale
var counts = [0,0,0,0,0,0,0,0,0,0,0,0];   // peso accumulato per ogni classe di nota
var SUSTAIN_W = 1.0;                        // peso per secondo di nota tenuta
var BASE_W = 0.4;                           // piccolo peso d'avvio a ogni nota suonata

// --- Web Audio ---
var ctx = null, master = null;

/* Contesto, categoria di iOS, frammento di silenzio, ripresa dopo il secondo
   piano: tutto in /comune/audio.js. Erano sessanta righe qui dentro, e le
   stesse tre righe di apertura — senza il resto — anche negli altri due
   strumenti che suonano. Qui resta solo quello che è di questa pagina: il
   guadagno d'uscita della tastiera. */
function audio() {
  var c = AUDIO.contesto();
  if (!c) return null;
  if (!master) {
    ctx = c;
    master = ctx.createGain();
    master.gain.value = 0.8;
    master.connect(ctx.destination);
  }
  return ctx;
}

/* Se l'audio non parte, la pagina lo dice invece di restare muta: una tastiera
   rotta e un contesto bloccato hanno esattamente lo stesso aspetto. La riga è
   la stessa dell'avviso sul silenzioso — è lo stesso momento, quello in cui
   premi un tasto e non senti niente. */
AUDIO.seNonParte(function (msg) {
  var e = document.getElementById('avvisoSilenzioso');
  if (!e) return;
  e.textContent = msg;
  e.hidden = false;
});

function freqOf(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }
function midiForIdx(idx) { return 12 * (octave + 1) + idx; }   // idx 0..11 nella pagina corrente

function makeVoice(freq) {
  var t = audio().currentTime;
  var g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.18, t + 0.012);   // attacco morbido
  g.connect(master);
  var o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.value = freq;
  o.connect(g);
  o.start(t);
  var stopped = false;
  return {
    stop: function () {
      if (stopped) return;
      stopped = true;
      var n = ctx.currentTime;
      g.gain.cancelScheduledValues(n);
      g.gain.setValueAtTime(g.gain.value, n);
      g.gain.exponentialRampToValueAtTime(0.0001, n + 0.04);   // release: niente click
      try { o.stop(n + 0.06); } catch (e) {}
      setTimeout(function () { try { g.disconnect(); } catch (e) {} }, 120);
    }
  };
}

// --- Note attive: midi assoluto -> { voice, start } ---
var notes = {};

// --- Tastiera (1 ottava) ---
var keyEls = {};
function addCls(idx, c) { if (keyEls[idx]) keyEls[idx].classList.add(c); }
function rmCls(idx, c)  { if (keyEls[idx]) keyEls[idx].classList.remove(c); }

function buildKeyboard() {
  var kb = document.getElementById('keyboard');
  WHITE.forEach(function (w) {
    var idx = w.off;
    var el = document.createElement('button');
    el.type = 'button';
    el.className = 'key white';
    el.textContent = w.name;
    el.dataset.idx = idx;
    kb.appendChild(el);
    keyEls[idx] = el;
    bindKey(el, idx);
  });
  BLACK.forEach(function (b) {
    var idx = b.off;
    var el = document.createElement('button');
    el.type = 'button';
    el.className = 'key black';
    el.textContent = b.name;
    el.dataset.idx = idx;
    /* Il «meno metà larghezza» che centra il tasto nero sul confine fra due
       bianchi NON è più scritto qui: sta in una variabile del foglio di stile,
       perché sotto il dito il nero cambia misura (44 px invece dell'8%) e il
       centraggio deve cambiare con lui. Scrivendo «- 4%» qui dentro, i tasti
       si spostavano di venti pixel appena si allargavano. */
    el.style.left = 'calc(' + (b.pos * 100 / WHITES) + '% - var(--mezzo-nero))';
    kb.appendChild(el);
    keyEls[idx] = el;
    bindKey(el, idx);
  });
}

function bindKey(el, idx) {
  el.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    if (!audio()) return;          // niente Web Audio: l'avviso l'ha già scritto
    toggleNote(idx);
  });
  // Da tastiera (Invio o barra) pointerdown non scatta mai e il tasto restava
  // muto.  I click veri hanno e.detail > 0: così col dito non suona due volte.
  el.addEventListener('click', function (e) {
    if (e.detail !== 0) return;
    if (!audio()) return;
    toggleNote(idx);
  });
}

// Clic su una nota: la accende (sostenuta) oppure la spegne se è già attiva.
function toggleNote(idx) {
  var midi = midiForIdx(idx);
  if (notes[midi]) {
    commitNote(midi);
    notes[midi].voice.stop();
    rmCls(idx, 'on');
    delete notes[midi];
    updateKeyGuess();
    return;
  }
  notes[midi] = { voice: makeVoice(freqOf(midi)), start: performance.now() };
  counts[midi % 12] += BASE_W;
  addCls(idx, 'on');
  updateKeyGuess();
}

// Accredita a una nota il tempo trascorso da start (più la tieni, più pesa).
function commitNote(midi) {
  var nt = notes[midi];
  if (!nt) return;
  var now = performance.now();
  counts[midi % 12] += (now - nt.start) / 1000 * SUSTAIN_W;
  nt.start = now;
}

// STOP: chiude tutte le note in tutte le ottave.
function stopAll() {
  Object.keys(notes).forEach(function (midi) {
    var m = Number(midi);
    commitNote(m);
    notes[m].voice.stop();
    var idx = m - 12 * (octave + 1);
    if (idx >= 0 && idx < 12) rmCls(idx, 'on');
  });
  notes = {};
  updateKeyGuess();
}

function estimateKey() { return STIMA.stima(counts); }

// Pallini sulle note della tonalità stimata (scala maggiore / minore naturale):
// si vede a colpo d'occhio quali tasti «stanno dentro» e si verifica a orecchio.
function markScale(cand) {
  var inkey = STIMA.noteDellaScala(cand);
  for (var i = 0; i < 12; i++) {
    if (inkey && inkey[i]) addCls(i, 'inkey'); else rmCls(i, 'inkey');
  }
}

var resultEl = document.getElementById('result');
var keyGuessEl = document.getElementById('keyGuess');
var resultNoteEl = document.getElementById('resultNote');
function updateKeyGuess() {
  var total = 0, distinct = 0;
  counts.forEach(function (c) { total += c; if (c > 0) distinct++; });
  if (total < 3 || distinct < 2) {
    resultEl.classList.add('hidden');
    resultNoteEl.classList.add('hidden');
    markScale(null);
    return;
  }
  var cands = estimateKey();
  var top = cands[0], second = cands[1];
  // Quanto la prima stacca la seconda, non la percentuale: la percentuale si
  // spartisce fra 24 tonalità, e la scala nuda di Do maggiore — risposta esatta —
  // usciva al 26%, cioè etichettata «incerta» (misurato).
  var scarto = top.r - second.r;
  if (scarto < 0.05) {
    keyGuessEl.innerHTML = 'Può essere <b>' + keyName(top) + '</b> o <b>' + keyName(second) + '</b>' +
      '<span class="alt">si somigliano: decidi a orecchio</span>';
  } else {
    keyGuessEl.innerHTML = (scarto >= 0.15 ? 'Quasi di sicuro ' : 'Probabile ') +
      '<b>' + keyName(top) + '</b>' +
      '<span class="alt">altrimenti ' + keyName(second) + '</span>';
  }
  markScale(top);
  resultEl.classList.remove('hidden');
  resultNoteEl.classList.remove('hidden');
}

function resetGuess() {
  counts = [0,0,0,0,0,0,0,0,0,0,0,0];
  var now = performance.now();
  Object.keys(notes).forEach(function (midi) { notes[midi].start = now; });
  resultEl.classList.add('hidden');
  resultNoteEl.classList.add('hidden');
  keyGuessEl.innerHTML = '';
  markScale(null);
}

document.getElementById('resetGuess').addEventListener('click', resetGuess);
document.getElementById('stopBtn').addEventListener('click', stopAll);

// Mentre tieni note, accumula peso e aggiorna la stima in tempo reale.
setInterval(function () {
  var active = false;
  Object.keys(notes).forEach(function (midi) { commitNote(Number(midi)); active = true; });
  if (active) updateKeyGuess();
}, 300);

// --- Ottava: +/− cambia pagina; le note già attive restano al loro pitch ---
var octNumEl = document.getElementById('octNum');
function setOctave(v) {
  octave = Math.max(MIN_OCT, Math.min(MAX_OCT, v));
  octNumEl.innerHTML = 'Do' + octave + '–Si' + octave + '<small>ottava ' + octave + '</small>';
  // Aggiorna la visualizzazione: .on solo sulle note attive nella pagina corrente
  for (var i = 0; i < 12; i++) {
    var midi = midiForIdx(i);
    if (notes[midi]) { addCls(i, 'on'); } else { rmCls(i, 'on'); }
  }
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

var fileMsg = document.getElementById('fileMsg');

function mostraMsg(testo) {
  player.classList.add('hidden');
  fileMsg.textContent = testo;
  fileMsg.classList.remove('hidden');
}

/* La guardia: se dopo quindici secondi il brano non è né partito né fallito, il
   lettore resterebbe lì a 0:00 per sempre, senza una parola. Meglio dire che non
   ce l'ho fatta che lasciare una pagina che finge di lavorare. */
var guardia = null;
function fermaGuardia() { if (guardia) { clearTimeout(guardia); guardia = null; } }

var objUrl = null;
/* Qui il campo prende un file solo (niente «multiple», niente trascinamento):
   più file insieme non possono arrivare, e infatti non c'è niente da dire. */
fileIn.addEventListener('change', function () {
  var f = fileIn.files && fileIn.files[0];
  // Riscegliere lo stesso file dopo un errore non faceva scattare niente,
  // perché il valore del campo non cambiava: la pagina restava muta.
  fileIn.value = '';
  if (!f) return;
  fileName.textContent = f.name;

  /* Tre cose si sanno prima ancora di provare a suonarlo. Prima finivano tutte
     e tre su «questo file non si apre qui», e solo dopo qualche secondo. */
  if (f.size === 0) {
    return mostraMsg('Questo file è vuoto: dentro non c\'è nessun brano. Se te l\'hanno mandato, fattelo rimandare.');
  }
  var pareAudio = /^(audio|video)\//.test(f.type) ||
                  /\.(mp3|wav|aiff?|flac|m4a|aac|ogg|oga|opus|wma|mp4|mov|webm|caf|amr)$/i.test(f.name);
  if (!pareAudio) {
    return mostraMsg('Questo non sembra un brano: qui vanno i file audio (MP3, WAV, M4A, FLAC).');
  }

  if (objUrl) URL.revokeObjectURL(objUrl);
  objUrl = URL.createObjectURL(f);
  au.src = objUrl;
  au.playbackRate = 1;
  au.load();
  fermaGuardia();
  guardia = setTimeout(function () {
    if (!au.duration || !isFinite(au.duration)) {
      mostraMsg('Non riesco ad aprire questo brano: il browser non risponde. ' +
                'Prova con un MP3 o con un WAV.');
    }
  }, 15000);
  fileMsg.classList.add('hidden');
  player.classList.remove('hidden');
  resetGuess();
});

// Un formato che questo browser non legge (un FLAC su iPhone, per dire) lasciava
// il lettore fermo a 0:00 senza dire niente: sembrava rotto lo strumento.
au.addEventListener('error', function () {
  if (!au.src) return;
  fermaGuardia();
  mostraMsg('Questo file non si apre qui: dentro non c\'è musica, oppure è in un formato ' +
            'che il browser non legge. Prova con un MP3 o con un WAV.');
});

playBtn.addEventListener('click', function () {
  if (au.paused) au.play(); else au.pause();
});
au.addEventListener('play',  function () { playBtn.textContent = '❚❚'; });
au.addEventListener('pause', function () { playBtn.textContent = '▶'; });
au.addEventListener('ended', function () { playBtn.textContent = '▶'; });

au.addEventListener('loadedmetadata', function () {
  fermaGuardia();
  durEl.textContent = fmtTime(au.duration);
});
// Mentre il dito trascina il cursore, timeupdate NON deve riposizionarlo:
// altrimenti la maniglia salta via da sotto il dito a ogni aggiornamento.
var seeking = false;
seek.addEventListener('pointerdown', function () { seeking = true; });
window.addEventListener('pointerup',  function () { seeking = false; });
au.addEventListener('timeupdate', function () {
  curEl.textContent = fmtTime(au.currentTime);
  if (au.duration && !seeking) seek.value = Math.round((au.currentTime / au.duration) * 1000);
});
seek.addEventListener('input', function () {
  if (au.duration) au.currentTime = (seek.value / 1000) * au.duration;
});

volEl.addEventListener('input', function () { au.volume = volEl.value / 100; });

// --- Avvio ---
buildKeyboard();
setOctave(octave);

/* L'avviso sulla levetta, e QUANDO si mostra.
   ────────────────────────────────────────────────────────────────────────
   Prima compariva solo se il sistema NON lasciava spostare l'audio in
   «playback», partendo dal presupposto che dove la categoria si imposta il
   suono esca comunque. Il presupposto è sbagliato: il 15/08/2026 Simone ha
   segnalato che sul suo iPhone la tastiera non suona, e quel telefono la
   categoria la imposta — quindi non vedeva nessuna spiegazione. Restava con
   uno strumento muto e nessun perché.

   Verificato che la nota è generata bene: in un contesto offline l'oscillatore
   rende un suono vero (picco 0,144). Il silenzio, quando c'è, arriva DOPO
   Web Audio — dalla levetta o dal volume dei media.

   Ora l'avviso compare a chi può incontrare quella levetta appena preme il
   primo tasto: non prima, che sarebbe rumore per tutti, e non «mai», che era
   il caso di Simone. Chi il suono lo sente lo legge e tira dritto; chi non lo
   sente ha finalmente la risposta sotto gli occhi. */
(function avvisaChiPuoIncontrarla() {
  var e = document.getElementById('avvisoSilenzioso');
  if (!e || !AUDIO.dispositivoApple()) return;

  if (!AUDIO.categoriaDiSistema()) { e.hidden = false; return; }   // iOS vecchi: subito

  var mostrato = false;
  function alPrimoTasto() {
    if (mostrato) return;
    mostrato = true;
    e.hidden = false;
    document.removeEventListener('pointerdown', ascolta, true);
  }
  function ascolta(ev) {
    if (ev.target && ev.target.closest && ev.target.closest('.keyboard')) alPrimoTasto();
  }
  document.addEventListener('pointerdown', ascolta, true);
})();
