/* Le prove della gestione audio comune — si eseguono da riga di comando:

       node tools/prova-audio.js

   Un audio che non parte non si distingue da un audio che parte e non si
   sente: la pagina è muta in tutti e due i casi. Perciò qui il browser è
   finto, e il finto browser si comporta MALE apposta — un contesto che si
   rifiuta di riprendere, uno che non esiste, una scheda che va in secondo
   piano — per vedere se il modulo se ne accorge e lo dice.

   Ogni prova ha dentro il suo contrario: se il testimone del guasto venisse
   chiamato sempre, nessuna prova fallirebbe e la pagina griderebbe al lupo
   anche quando il suono esce. */

var CAMMINO = require.resolve('../comune/audio.js');

var passate = 0, fallite = 0;
var daAspettare = [];

function bene(nome) { passate++; console.log('  ok   ' + nome); }
function male(nome, e) { fallite++; console.log('  ✗    ' + nome + '\n         ' + e.message); }

/* Una prova può finire dopo, quando il finto `resume()` risponde. Se non si
   aspettasse la promessa, una prova rotta risulterebbe passata: il conto
   verrebbe stampato prima che fallisca. */
function prova(nome, fn) {
  var esito;
  try {
    esito = fn();
  } catch (e) {
    return male(nome, e);
  }
  if (esito && esito.then) {
    daAspettare.push(esito.then(function () { bene(nome); },
                                function (e) { male(nome, e); }));
  } else {
    bene(nome);
  }
}

function uguale(avuto, atteso, che) {
  if (avuto !== atteso) {
    throw new Error((che || '') + ' atteso ' + JSON.stringify(atteso) +
                    ', avuto ' + JSON.stringify(avuto));
  }
}

function vero(cosa, che) {
  if (!cosa) throw new Error(che);
}

/* ── Il finto browser ──────────────────────────────────────────────────────
   Il minimo indispensabile perché comune/audio.js si creda in una pagina:
   un AudioContext che conta quante volte lo si costruisce, un documento che
   sa nascondersi e riapparire, un elemento <audio> che conta quante volte
   parte. Tutto quello che succede lo scrive in `registro`, così le prove
   guardano i fatti e non le impressioni. */
function caricaModulo(opzioni) {
  opzioni = opzioni || {};
  var registro = { contesti: 0, riprese: 0, suonati: 0, avvisi: [] };

  function FintoContesto() {
    registro.contesti++;
    this.state = opzioni.stato || 'suspended';
    this.destination = {};
    var io = this;
    this.resume = function () {
      registro.riprese++;
      // «rifiuta» è il caso che conta: il browser accetta la richiesta e
      // lascia il contesto sospeso lo stesso. È quello che fa iOS fuori da
      // un gesto, ed è il caso in cui la pagina resta muta senza dirlo.
      if (!opzioni.rifiuta) io.state = 'running';
      return Promise.resolve();
    };
  }

  var ascoltatori = [];
  var doc = {
    hidden: false,
    addEventListener: function (tipo, fn) { if (tipo === 'visibilitychange') ascoltatori.push(fn); },
    // per le prove: nascondi e riappari, come farebbe una scheda vera
    vaiInSecondoPiano: function () { doc.hidden = true; ascoltatori.forEach(function (f) { f(); }); },
    torna: function () { doc.hidden = false; ascoltatori.forEach(function (f) { f(); }); },
    quantiAscoltatori: function () { return ascoltatori.length; }
  };

  function FintoAudio() {
    registro.suonati++;
    this.volume = 1;
    this.play = function () { return Promise.resolve(); };
  }

  global.window = opzioni.senzaWebAudio ? {} : { AudioContext: FintoContesto };
  global.document = doc;
  global.Audio = FintoAudio;
  Object.defineProperty(global, 'navigator', {
    value: opzioni.navigator || { userAgent: 'finto', platform: 'finto' },
    configurable: true, writable: true
  });

  // ricaricato da zero: il modulo tiene lo stato del contesto, e una prova non
  // deve ereditare quello della precedente
  delete require.cache[CAMMINO];
  var A = require(CAMMINO);
  A.seNonParte(function (msg, motivo) { registro.avvisi.push(motivo + ': ' + msg); });
  return { AUDIO: A, registro: registro, documento: doc };
}

// le promesse in coda vanno smaltite prima di guardare l'esito: `resume()`
// risponde dopo, come nel browser
function dopoLePromesse(fn) {
  return Promise.resolve().then(function () {}).then(function () {}).then(fn);
}

/* ── 1. Il contesto, una volta sola ─────────────────────────────────────── */

prova('il contesto si crea una volta sola, anche chiamandolo dieci volte', function () {
  var b = caricaModulo();
  var primo = b.AUDIO.contesto();
  for (var i = 0; i < 9; i++) {
    if (b.AUDIO.contesto() !== primo) throw new Error('alla chiamata ' + (i + 2) + ' è un altro contesto');
  }
  uguale(b.registro.contesti, 1, 'contesti costruiti');
});

prova('CONTROPROVA: il finto contesto li conta davvero', function () {
  /* Senza questa, un contatore fermo a 1 per un errore del finto browser
     farebbe passare la prova di sopra anche con dieci contesti veri. */
  var a = caricaModulo();
  a.AUDIO.contesto();
  uguale(a.registro.contesti, 1, 'contesti del primo caricamento');
  var b = caricaModulo();          // modulo nuovo: il contatore riparte da zero
  b.AUDIO.contesto();
  b.AUDIO.contesto();
  uguale(b.registro.contesti, 1, 'il secondo caricamento ne ha creato uno suo');
  uguale(a.registro.contesti, 1, 'il primo non ne ha creati altri');
});

prova('il frammento di silenzio parte una volta sola', function () {
  var b = caricaModulo();
  b.AUDIO.contesto();
  b.AUDIO.contesto();
  uguale(b.AUDIO.spostaLaSessione(), false, 'la seconda volta non deve rifarlo');
  uguale(b.registro.suonati, 1, 'elementi <audio> fatti partire');
});

/* ── 2. Riprendere ──────────────────────────────────────────────────────── */

prova('un contesto sospeso viene ripreso', function () {
  var b = caricaModulo({ stato: 'suspended' });
  var c = b.AUDIO.contesto();
  uguale(b.registro.riprese, 1, 'chiamate a resume');
  uguale(c.state, 'running', 'stato dopo la ripresa');
});

prova('CONTROPROVA: se il browser rifiuta, resta sospeso e si sa', function () {
  var b = caricaModulo({ stato: 'suspended', rifiuta: true });
  var c = b.AUDIO.contesto();
  uguale(c.state, 'suspended', 'stato dopo il rifiuto');
  return dopoLePromesse(function () {
    uguale(b.AUDIO.partito(), false, 'partito()');
  });
});

/* ── 3. Il ritorno da secondo piano ─────────────────────────────────────── */

prova('tornando sulla scheda il contesto torna a suonare', function () {
  var b = caricaModulo({ stato: 'suspended' });
  var c = b.AUDIO.contesto();
  uguale(c.state, 'running', 'stato dopo il primo sblocco');
  c.state = 'suspended';                    // è quello che fa il browser da solo
  b.documento.vaiInSecondoPiano();
  uguale(c.state, 'suspended', 'da nascosta non deve riprendere niente');
  b.documento.torna();
  uguale(c.state, 'running', 'stato al ritorno');
});

prova('CONTROPROVA: da nascosta non riprende (se no la prova sopra non prova niente)', function () {
  var b = caricaModulo({ stato: 'suspended' });
  b.AUDIO.contesto();
  var prima = b.registro.riprese;
  b.documento.vaiInSecondoPiano();
  uguale(b.registro.riprese, prima, 'riprese mentre la scheda è nascosta');
});

prova('l\'aggancio a visibilitychange è uno solo, non uno per chiamata', function () {
  var b = caricaModulo();
  for (var i = 0; i < 5; i++) b.AUDIO.contesto();
  uguale(b.documento.quantiAscoltatori(), 1, 'ascoltatori di visibilitychange');
});

/* ── 4. Dirlo, invece di restare muti ───────────────────────────────────── */

prova('se resta sospeso, chi ascolta viene avvisato', function () {
  var b = caricaModulo({ stato: 'suspended', rifiuta: true });
  b.AUDIO.contesto();
  return dopoLePromesse(function () {
    uguale(b.registro.avvisi.length, 1, 'avvisi ricevuti');
    vero(/^sospeso: /.test(b.registro.avvisi[0]), 'il motivo non è «sospeso»: ' + b.registro.avvisi[0]);
    vero(b.registro.avvisi[0].length > 40, 'il messaggio è troppo corto per spiegare qualcosa');
  });
});

prova('CONTROPROVA: se parte, nessuno viene avvisato', function () {
  /* Un testimone chiamato sempre farebbe passare la prova di sopra e
     riempirebbe di allarmi una pagina che funziona. */
  var b = caricaModulo({ stato: 'suspended' });
  b.AUDIO.contesto();
  return dopoLePromesse(function () {
    uguale(b.registro.avvisi.length, 0, 'avvisi con l\'audio funzionante');
  });
});

prova('senza Web Audio il contesto è null e viene detto', function () {
  var b = caricaModulo({ senzaWebAudio: true });
  uguale(b.AUDIO.contesto(), null, 'contesto in un browser senza Web Audio');
  uguale(b.AUDIO.stato(), 'assente', 'stato()');
  uguale(b.registro.avvisi.length, 1, 'avvisi ricevuti');
  vero(/^assente: /.test(b.registro.avvisi[0]), 'motivo sbagliato: ' + b.registro.avvisi[0]);
});

prova('tornando visibile senza aver mai suonato non si allarma nessuno', function () {
  /* Chi non ha ancora chiesto un suono non ha niente da sapere: un avviso lì
     è un allarme per un problema che non esiste ancora. */
  var b = caricaModulo({ stato: 'suspended', rifiuta: true });
  b.documento.torna();
  uguale(b.registro.avvisi.length, 0, 'avvisi senza aver mai chiesto un suono');
});

prova('i tre guasti hanno tre spiegazioni diverse, e nessuna è vuota', function () {
  var b = caricaModulo();
  var a = b.AUDIO.messaggio('assente'), s = b.AUDIO.messaggio('sospeso'),
      c = b.AUDIO.messaggio('chiuso');
  vero(a !== s && s !== c && a !== c, 'due motivi diversi danno lo stesso testo');
  [a, s, c].forEach(function (t) { vero(t && t.length > 40, 'spiegazione troppo corta: ' + t); });
  uguale(b.AUDIO.messaggio('boh'), s, 'un motivo sconosciuto deve ricadere sul sospeso');
});

/* ── 5. Il frammento di silenzio, byte per byte ─────────────────────────── */

function leggi(v, o, n) {
  var s = '';
  for (var i = 0; i < n; i++) s += String.fromCharCode(v.getUint8(o + i));
  return s;
}

prova('il WAV di silenzio è un WAV valido', function () {
  var b = caricaModulo();
  var buf = b.AUDIO.wavDiSilenzio(0.12, 8000);
  var n = Math.floor(8000 * 0.12);
  uguale(buf.byteLength, 44 + n * 2, 'lunghezza totale');
  var v = new DataView(buf);
  uguale(leggi(v, 0, 4), 'RIFF', 'firma iniziale');
  uguale(leggi(v, 8, 8), 'WAVEfmt ', 'tipo e blocco fmt');
  uguale(leggi(v, 36, 4), 'data', 'blocco dei campioni');
  uguale(v.getUint32(4, true), 36 + n * 2, 'lunghezza dichiarata nell\'intestazione');
  uguale(v.getUint16(20, true), 1, 'formato PCM');
  uguale(v.getUint16(22, true), 1, 'canali');
  uguale(v.getUint32(24, true), 8000, 'frequenza di campionamento');
  uguale(v.getUint32(28, true), 16000, 'byte al secondo');
  uguale(v.getUint16(34, true), 16, 'bit per campione');
  uguale(v.getUint32(40, true), n * 2, 'byte di campioni dichiarati');
});

prova('dentro c\'è silenzio vero, non rumore', function () {
  var b = caricaModulo();
  var v = new DataView(b.AUDIO.wavDiSilenzio(0.12, 8000));
  for (var i = 44; i < v.byteLength; i += 2) {
    if (v.getInt16(i, true) !== 0) throw new Error('campione diverso da zero a ' + i);
  }
});

prova('CONTROPROVA: la durata conta davvero', function () {
  /* Se la lunghezza fosse fissa, le due prove sopra passerebbero lo stesso
     con un file che non dura quello che dice. */
  var b = caricaModulo();
  uguale(b.AUDIO.wavDiSilenzio(0.24, 8000).byteLength,
         44 + Math.floor(8000 * 0.24) * 2, 'un WAV di durata doppia');
});

/* ── 6. Chi incontra la levetta del silenzioso ──────────────────────────── */

prova('l\'iPhone e l\'iPad si riconoscono, il Mac no', function () {
  var A = caricaModulo().AUDIO;
  vero(A.dispositivoApple({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' }),
       'un iPhone non è stato riconosciuto');
  // gli iPad recenti si dichiarano Mac: si distinguono dal touch screen
  vero(A.dispositivoApple({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
                            platform: 'MacIntel', maxTouchPoints: 5 }),
       'un iPad travestito da Mac non è stato riconosciuto');
  vero(!A.dispositivoApple({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
                             platform: 'MacIntel', maxTouchPoints: 0 }),
       'un Mac da scrivania è stato scambiato per un iPad: mostrerebbe un avviso inutile');
  vero(!A.dispositivoApple({ userAgent: 'Mozilla/5.0 (Windows NT 10.0)', platform: 'Win32' }),
       'un PC Windows è stato scambiato per un dispositivo Apple');
});

prova('la categoria di sistema si imposta dove c\'è, e si ammette dove non c\'è', function () {
  var sessione = { type: 'auto' };
  var b = caricaModulo({ navigator: { userAgent: 'iPhone', audioSession: sessione } });
  uguale(b.AUDIO.categoriaDiSistema(), true, 'con navigator.audioSession');
  uguale(sessione.type, 'playback', 'categoria impostata');

  // CONTROPROVA: dove non c'è non deve mentire, o l'avviso scritto sparirebbe
  var senza = caricaModulo({ navigator: { userAgent: 'iPhone' } });
  uguale(senza.AUDIO.categoriaDiSistema(), false, 'senza navigator.audioSession');
});

Promise.all(daAspettare).then(function () {
  console.log('\n' + passate + ' passate, ' + fallite + ' fallite\n');
  process.exit(fallite ? 1 : 0);
});
