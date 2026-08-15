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
var KS_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
var KS_MINOR = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

// --- Stato ---
var octave = 4;   // si parte dall'ottava del Do centrale
var counts = [0,0,0,0,0,0,0,0,0,0,0,0];   // peso accumulato per ogni classe di nota
var SUSTAIN_W = 1.0;                        // peso per secondo di nota tenuta
var BASE_W = 0.4;                           // piccolo peso d'avvio a ogni nota suonata

// --- Web Audio ---
var ctx = null, master = null;

/* ── Perché su iPhone la tastiera non suonava ──────────────────────────────
   Questa pagina ha due sorgenti audio e iOS le tratta in modo opposto:

     il brano caricato   passa da un elemento <audio> → categoria «playback»,
                         suona anche con la levetta del silenzioso alzata;
     la tastiera         è Web Audio puro (un oscillatore) → categoria
                         «ambient», che il silenzioso ZITTISCE.

   Il sintomo è quello che confonde di più: il brano si sente e i tasti no,
   così sembra rotta la tastiera mentre è una levetta sul fianco del telefono.

   `navigator.audioSession` (Safari da iOS 16.4) permette di dire che questa
   pagina fa «playback», e allora anche gli oscillatori suonano in silenzioso.
   Dove non esiste, resta l'avviso scritto in pagina. */
function categoriaAudioDiSistema() {
  try {
    if (navigator.audioSession && 'type' in navigator.audioSession) {
      navigator.audioSession.type = 'playback';
      return true;
    }
  } catch (e) {}
  return false;
}

/* Dichiarare la categoria non basta: provato su un iPhone vero, la tastiera
   restava muta lo stesso. Serve anche far partire davvero qualcosa dal lettore
   di sistema — un frammento di silenzio è sufficiente — perché iOS sposti la
   sessione. Da lì in poi si sentono anche gli oscillatori.

   Costa un decimo di secondo e succede una volta sola, dentro il primo tocco:
   fuori da un gesto dell'utente iOS non lo lascerebbe partire. */
var sessioneSpostata = false;
function spostaLaSessione() {
  if (sessioneSpostata) return;
  sessioneSpostata = true;
  try {
    var fs = 8000, n = Math.floor(fs * 0.12);
    var buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    var t = function (o, s) { for (var i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    t(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); t(8, 'WAVEfmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, fs, true); v.setUint32(28, fs * 2, true); v.setUint16(32, 2, true);
    v.setUint16(34, 16, true); t(36, 'data'); v.setUint32(40, n * 2, true);
    // campioni tutti a zero: silenzio vero, nessuno lo sente
    var a = new Audio(URL.createObjectURL(new Blob([buf], { type: 'audio/wav' })));
    a.volume = 0.01;
    var p = a.play();
    if (p && p.catch) p.catch(function () {});
  } catch (e) {}
}

function audio() {
  if (!ctx) {
    categoriaAudioDiSistema();
    spostaLaSessione();
    var AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.8;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

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
    el.style.left = 'calc(' + (b.pos * 100 / WHITES) + '% - 4%)';
    kb.appendChild(el);
    keyEls[idx] = el;
    bindKey(el, idx);
  });
}

function bindKey(el, idx) {
  el.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    audio();
    toggleNote(idx);
  });
  // Da tastiera (Invio o barra) pointerdown non scatta mai e il tasto restava
  // muto.  I click veri hanno e.detail > 0: così col dito non suona due volte.
  el.addEventListener('click', function (e) {
    if (e.detail !== 0) return;
    audio();
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
  // Ordinate per somiglianza (r): conta chi vince e di quanto, e il «di quanto»
  // si legge sul distacco fra le prime due, non su una percentuale.
  cands.sort(function (a, b) { return b.r - a.r; });
  return cands;
}

// Pallini sulle note della tonalità stimata (scala maggiore / minore naturale):
// si vede a colpo d'occhio quali tasti «stanno dentro» e si verifica a orecchio.
var MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
var MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];
function markScale(cand) {
  var inkey = null;
  if (cand) {
    inkey = {};
    var iv = (cand.mode === 'major') ? MAJOR_SCALE : MINOR_SCALE;
    iv.forEach(function (s) { inkey[(cand.t + s) % 12] = true; });
  }
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

/* ── Ascoltare la musica invece di caricarla ──────────────────────────────
   Il cervello non cambia: `estimateKey()` confronta il vettore `counts` con i
   profili di Krumhansl. Cambia solo chi lo riempie — prima i tasti che premi,
   ora anche le note che il microfono sente. */
(function ascoltoDalVivo() {
  var btn = document.getElementById('ascoltaBtn');
  var stato = document.getElementById('ascoltaStato');
  if (!btn || typeof ASCOLTA === 'undefined') return;

  if (!ASCOLTA.disponibile()) {
    btn.hidden = true;
    return;
  }

  function scrivi(t) { stato.hidden = !t; stato.textContent = t || ''; }

  /* Una barretta di livello: senza, «non funziona» e «non sento musica» sono
     la stessa frase, e chi guarda non sa se avvicinare il telefono o smettere. */
  function barretta(v) {
    var n = Math.max(0, Math.min(20, Math.round(v * 60)));
    return '▁'.repeat(20 - n) + '█'.repeat(n);
  }

  function aggiorna() {
    var liv = ASCOLTA.livello();

    /* Tre stati diversi, e prima erano tutti la stessa riga.
       1) dal microfono non arriva NIENTE: è un guasto o un permesso;
       2) arriva del suono ma non è musica riconoscibile;
       3) tutto bene. */
    if (ASCOLTA.silenzio() && ASCOLTA.blocchi() > 8) {
      scrivi('Dal microfono non arriva niente. Su iPhone controlla il permesso in ' +
             'Impostazioni → Safari → Microfono, e che nessun\'altra app lo stia usando.');
      return;
    }

    var p = ASCOLTA.profilo();
    if (!p) {
      /* Non è un errore: è lo strumento che ammette di non sentire abbastanza.
         Meglio dirlo che mostrare una tonalità inventata — su rumore puro
         succedeva, e aveva la stessa faccia sicura di una risposta vera. */
      scrivi(barretta(liv) + '  sento qualcosa, ma non abbastanza musica.\n' +
             'Avvicina il telefono alla cassa, o alza il volume.');
      return;
    }
    counts = p;
    updateKeyGuess();
    scrivi(barretta(liv) + '  ascolto… ' + ASCOLTA.blocchi() +
           ' letture. Più aspetti, più è sicura.');
  }

  btn.addEventListener('click', function () {
    if (ASCOLTA.inAscolto()) {
      ASCOLTA.ferma();
      btn.textContent = 'Ascolta la musica';
      scrivi('');
      return;
    }
    ASCOLTA.azzera();
    resetGuess();
    scrivi('Chiedo il microfono…');
    ASCOLTA.avvia(audio(), aggiorna).then(function () {
      btn.textContent = 'Basta ascoltare';
      scrivi('Sto ascoltando…');
    }).catch(function (e) {
      var negato = e && e.name === 'NotAllowedError';
      scrivi(negato
        ? 'Senza microfono non posso ascoltare. Il permesso si dà dall\'icona nella barra dell\'indirizzo.'
        : 'Non sono riuscito ad aprire il microfono. Controlla che non lo stia usando un\'altra applicazione.');
    });
  });
})();

/* L'avviso sulla levetta si mostra solo a chi può incontrarla — un iPhone o un
   iPad — e solo se il sistema NON lascia spostare l'audio in «playback». Su
   iOS aggiornati la categoria si imposta e la tastiera suona lo stesso: lì la
   riga sarebbe un allarme per un problema che non c'è. */
(function avvisaSoloSeServe() {
  var e = document.getElementById('avvisoSilenzioso');
  if (!e) return;
  var apple = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
              (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (apple && !categoriaAudioDiSistema()) e.hidden = false;
})();
