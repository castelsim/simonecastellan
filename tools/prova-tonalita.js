/* Le prove del riconoscimento della tonalità — da riga di comando:

       node tools/prova-tonalita.js

   Un riconoscitore di tonalità sbagliato non se ne accorge: una risposta esce
   sempre, e ha la stessa faccia sicura di quella giusta. Perciò qui gli si dà
   in pasto un giro di accordi di tonalità NOTA e si guarda se la trova.

   ── COSA PROVANO ADESSO, E PERCHÉ È CAMBIATO (23/08/2026) ────────────────
   Fino a ieri queste prove interrogavano `tonalita/ascolta.js`, cioè il
   riconoscimento delle note dal microfono. Il microfono è uscito dallo
   strumento per scelta di Simone, e con lui quel file: erano prove su codice
   che non gira più, la peggior specie di verde.

   Adesso provano `tonalita/stima.js`, che è il cervello vero e unico di quello
   che resta — da dodici pesi alla tonalità. È lo stesso file che carica la
   pagina, non una copia: se qui passa e in pagina no, la differenza è nel DOM,
   non nel conto. */

var STIMA = require('../tonalita/stima.js');

var passate = 0, fallite = 0;

function prova(nome, fn) {
  try { fn(); passate++; console.log('  ok   ' + nome); }
  catch (e) { fallite++; console.log('  ✗    ' + nome + '\n         ' + e.message); }
}

var NOMI = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];
var DO = 0, RE = 2, MI = 4, FA = 5, SOL = 7, LA = 9;

/* Chi suona sulla tastiera accumula PESO su ogni classe di nota, non conteggi:
   un tasto tenuto due secondi pesa il doppio di uno sfiorato. Qui si simula
   come fa la pagina — un peso per nota — perché è il vettore che `stima()`
   riceve davvero. */
function suonato(note, peso) {
  var c = [0,0,0,0,0,0,0,0,0,0,0,0];
  note.forEach(function (n) { c[((n % 12) + 12) % 12] += (peso || 1); });
  return c;
}

function maggiore(t) { return [t, t + 4, t + 7]; }
function minore(t)   { return [t, t + 3, t + 7]; }

/* Il giro più suonato della musica leggera: I–V–vi–IV.
   In Do: Do, Sol, La minore, Fa. */
function giroPop(t) {
  return [].concat(maggiore(t), maggiore(t + 7), minore(t + 9), maggiore(t + 5));
}

function nome(c) { return NOMI[c.t] + (c.mode === 'major' ? ' maggiore' : ' minore'); }

function deveDire(counts, atteso, quando) {
  var vinta = STIMA.stima(counts)[0];
  if (nome(vinta) !== atteso) {
    throw new Error(quando + ': atteso «' + atteso + '», risponde «' + nome(vinta) + '»');
  }
}

console.log('Riconoscimento della tonalità (tonalita/stima.js)');

prova('un accordo di Do maggiore dice Do maggiore', function () {
  deveDire(suonato(maggiore(DO)), 'Do maggiore', 'accordo isolato');
});

prova('un accordo di La minore dice La minore', function () {
  deveDire(suonato(minore(LA)), 'La minore', 'accordo isolato');
});

prova('il giro I-V-vi-IV in Do dice Do maggiore', function () {
  deveDire(suonato(giroPop(DO)), 'Do maggiore', 'giro pop');
});

prova('lo stesso giro trasportato in Re dice Re maggiore', function () {
  deveDire(suonato(giroPop(RE)), 'Re maggiore', 'giro pop trasportato');
});

/* La prova che vale più delle altre: le dodici trasposizioni devono dare
   dodici risposte diverse. Un riconoscitore che risponde sempre la stessa cosa
   passerebbe le prove qui sopra una volta su dodici — e le passa TUTTE se
   quella volta è Do. */
prova('le dodici trasposizioni danno dodici tonalità diverse', function () {
  var viste = {};
  for (var t = 0; t < 12; t++) {
    var vinta = STIMA.stima(suonato(giroPop(t)))[0];
    if (vinta.t !== t % 12 || vinta.mode !== 'major') {
      throw new Error('giro in ' + NOMI[t] + ': risponde «' + nome(vinta) + '»');
    }
    viste[nome(vinta)] = true;
  }
  if (Object.keys(viste).length !== 12) {
    throw new Error('solo ' + Object.keys(viste).length + ' risposte diverse su 12');
  }
});

/* Il peso conta: la stessa nota tenuta a lungo deve spostare la risposta.
   Se non la sposta, la pagina sta contando i tasti invece del tempo. */
prova('il peso sposta la risposta', function () {
  var pari = suonato([DO, RE, MI, FA, SOL, LA, 11]);        // scala di Do, tutte uguali
  var caricoSuFa = suonato([DO, RE, MI, FA, SOL, LA, 11]);
  caricoSuFa[FA] += 40;                                     // il Fa tenuto a lungo
  var a = STIMA.stima(pari)[0], b = STIMA.stima(caricoSuFa)[0];
  if (nome(a) === nome(b)) {
    throw new Error('caricare il Fa non cambia niente: risponde «' + nome(a) + '» in tutti e due i casi');
  }
});

/* Il silenzio non deve produrre una tonalità con la faccia sicura: con tutti i
   pesi a zero la correlazione non è definita, e deve valere 0 — non un numero
   qualsiasi che poi vince la classifica. */
prova('senza niente di suonato nessuna tonalità stacca le altre', function () {
  var c = STIMA.stima([0,0,0,0,0,0,0,0,0,0,0,0]);
  if (c[0].r !== 0) throw new Error('con zero note la somiglianza vale ' + c[0].r + ', non 0');
});

/* I pallini sui tasti: sono la verifica a orecchio di chi legge, quindi devono
   essere le note giuste della scala, non «più o meno». */
prova('le note segnate in Do maggiore sono quelle dei tasti bianchi', function () {
  var dentro = STIMA.noteDellaScala({ t: DO, mode: 'major' });
  var attese = [0, 2, 4, 5, 7, 9, 11];
  attese.forEach(function (n) { if (!dentro[n]) throw new Error('manca il ' + NOMI[n]); });
  if (Object.keys(dentro).length !== 7) throw new Error('sono ' + Object.keys(dentro).length + ' note, non 7');
});

prova('in La minore le note sono le stesse di Do maggiore', function () {
  var la = STIMA.noteDellaScala({ t: LA, mode: 'minor' });
  var doM = STIMA.noteDellaScala({ t: DO, mode: 'major' });
  if (Object.keys(la).sort().join() !== Object.keys(doM).sort().join()) {
    throw new Error('le due scale relative dovrebbero avere le stesse note');
  }
});

console.log('\n' + passate + ' passate, ' + fallite + ' fallite');
process.exit(fallite ? 1 : 0);
