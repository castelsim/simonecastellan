/* Le prove del riconoscimento della tonalità — da riga di comando:

       node tools/prova-tonalita.js

   Un riconoscitore di tonalità sbagliato non se ne accorge: una risposta esce
   sempre, e ha la stessa faccia sicura di quella giusta. Perciò qui gli si dà
   in pasto musica finta ma di tonalità NOTA, e si guarda se la trova.

   La musica è costruita con le note vere degli accordi, armoniche comprese:
   un'onda pura non somiglia a niente di quello che il microfono sentirà. */

var ASCOLTA = require('../tonalita/ascolta.js');

var passate = 0, fallite = 0;

function prova(nome, fn) {
  try { fn(); passate++; console.log('  ok   ' + nome); }
  catch (e) { fallite++; console.log('  ✗    ' + nome + '\n         ' + e.message); }
}

var NOMI = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];
var FS = 48000, DIM = 8192;

function hzDi(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

/* Un accordo con le sue armoniche, come lo sentirebbe un microfono: la
   fondamentale più cinque parziali che calano di ampiezza. */
function accordo(midiNote, campioni, ampiezza) {
  var x = new Float32Array(campioni);
  midiNote.forEach(function (m) {
    var f0 = hzDi(m);
    for (var arm = 1; arm <= 5; arm++) {
      var f = f0 * arm;
      if (f > FS / 2) break;
      var a = (ampiezza || 1) / (arm * arm);
      for (var i = 0; i < campioni; i++) {
        x[i] += a * Math.sin(2 * Math.PI * f * i / FS);
      }
    }
  });
  return x;
}

function rumore(campioni, ampiezza, seme) {
  var s = seme >>> 0, x = new Float32Array(campioni);
  for (var i = 0; i < campioni; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    x[i] = ((s / 4294967296) * 2 - 1) * ampiezza;
  }
  return x;
}

function somma(a, b) {
  var x = new Float32Array(a.length);
  for (var i = 0; i < a.length; i++) x[i] = a[i] + (b[i] || 0);
  return x;
}

/* Suona una giro di accordi e restituisce il profilo delle dodici note. */
function ascoltaGiro(giro) {
  ASCOLTA.azzera();
  giro.forEach(function (note) {
    /* Cinque blocchi per accordo, cioè circa mezzo secondo tenuto: sotto i
       quattro blocchi lo strumento si rifiuta di rispondere, e giustamente —
       ma allora le prove devono dargli il materiale che chiede. */
    for (var v = 0; v < 5; v++) ASCOLTA.analizza(accordo(note, DIM), FS);
  });
  return ASCOLTA.profilo();
}

function piuForte(profilo) {
  var i, piu = 0;
  for (i = 1; i < 12; i++) if (profilo[i] > profilo[piu]) piu = i;
  return piu;
}

/* Le tre note di un accordo, dal nome: 60 = Do centrale */
var DO = 60;
function maggiore(fondamentale) { return [fondamentale, fondamentale + 4, fondamentale + 7]; }
function minore(fondamentale) { return [fondamentale, fondamentale + 3, fondamentale + 7]; }

console.log('\nRiconoscere le note che suonano\n');

prova('un Do maggiore da solo mette il Do in cima', function () {
  var p = ascoltaGiro([maggiore(DO)]);
  var vinc = piuForte(p);
  if (vinc !== 0) throw new Error('in cima c\'è ' + NOMI[vinc] + ', non Do');
  // e le altre due note dell'accordo devono essere ben presenti
  if (p[4] < 20) throw new Error('il Mi dell\'accordo pesa solo ' + Math.round(p[4]));
  if (p[7] < 20) throw new Error('il Sol dell\'accordo pesa solo ' + Math.round(p[7]));
});

prova('un La minore mette il La in cima', function () {
  var p = ascoltaGiro([minore(DO + 9)]);
  var vinc = piuForte(p);
  if (vinc !== 9) throw new Error('in cima c\'è ' + NOMI[vinc] + ', non La');
});

prova('CONTROPROVA: le note che NON suonano restano in fondo', function () {
  /* Senza questa, un profilo che risponde «tutto uguale» passerebbe la prova
     di sopra per caso, dato che una qualche nota in cima c'è sempre. */
  var p = ascoltaGiro([maggiore(DO)]);   // Do, Mi, Sol
  [1, 3, 6, 8, 10].forEach(function (pc) {   // le cinque nere: nessuna suona
    if (p[pc] > 25) {
      throw new Error(NOMI[pc] + ' pesa ' + Math.round(p[pc]) + ' pur non suonando');
    }
  });
});

console.log('\nRiconoscere la tonalità di un giro di accordi\n');

/* Il giro più comune della musica leggera: I–V–vi–IV. In Do maggiore è
   Do–Sol–Lam–Fa. */
function giroPop(tonica) {
  return [maggiore(tonica), maggiore(tonica + 7), minore(tonica + 9), maggiore(tonica + 5)];
}

prova('Do–Sol–Lam–Fa: le sette note della scala di Do stanno sopra le altre', function () {
  var p = ascoltaGiro(giroPop(DO));
  var dentro = [0, 2, 4, 5, 7, 9, 11];          // la scala di Do maggiore
  var fuori = [1, 3, 6, 8, 10];
  var minDentro = Math.min.apply(null, dentro.map(function (i) { return p[i]; }));
  var maxFuori = Math.max.apply(null, fuori.map(function (i) { return p[i]; }));
  if (maxFuori >= minDentro) {
    throw new Error('una nota fuori scala (' + Math.round(maxFuori) + ') pesa quanto una dentro (' +
                    Math.round(minDentro) + ')');
  }
});

prova('lo stesso giro trasportato in Re dà le note di Re', function () {
  /* Se il riconoscimento funzionasse «per caso» sul Do — per esempio perché
     la prima riga della FFT ci cade dentro — trasportando andrebbe a pezzi. */
  var p = ascoltaGiro(giroPop(DO + 2));
  var dentro = [2, 4, 6, 7, 9, 11, 1];          // la scala di Re maggiore
  var fuori = [0, 3, 5, 8, 10];
  var minDentro = Math.min.apply(null, dentro.map(function (i) { return p[i]; }));
  var maxFuori = Math.max.apply(null, fuori.map(function (i) { return p[i]; }));
  if (maxFuori >= minDentro) {
    throw new Error('in Re una nota fuori scala (' + Math.round(maxFuori) +
                    ') pesa quanto una dentro (' + Math.round(minDentro) + ')');
  }
});

console.log('\nQuando la stanza è rumorosa\n');

prova('con rumore di fondo forte la tonalità si trova lo stesso', function () {
  ASCOLTA.azzera();
  giroPop(DO).forEach(function (note) {
    for (var v = 0; v < 3; v++) {
      ASCOLTA.analizza(somma(accordo(note, DIM), rumore(DIM, 0.35, 7 + v)), FS);
    }
  });
  var p = ASCOLTA.profilo();
  var dentro = [0, 2, 4, 5, 7, 9, 11];
  var fuori = [1, 3, 6, 8, 10];
  var minDentro = Math.min.apply(null, dentro.map(function (i) { return p[i]; }));
  var maxFuori = Math.max.apply(null, fuori.map(function (i) { return p[i]; }));
  if (maxFuori >= minDentro) {
    throw new Error('col rumore le note fuori scala (' + Math.round(maxFuori) +
                    ') raggiungono quelle dentro (' + Math.round(minDentro) + ')');
  }
});

prova('LA PROVA CHE CONTA: su rumore soltanto dice che non sa', function () {
  /* Il modo peggiore di sbagliare: un telefono appoggiato in una stanza
     silenziosa che mostra una tonalità con la stessa faccia sicura di una
     vera. Succedeva davvero — qualche riga superava la soglia per caso, il
     profilo si normalizzava su quella, e una nota andava a 100. */
  ASCOLTA.azzera();
  for (var i = 0; i < 12; i++) ASCOLTA.analizza(rumore(DIM, 0.5, 100 + i), FS);
  if (ASCOLTA.affidabile()) {
    throw new Error('si dichiara affidabile su rumore puro (' +
                    Math.round(ASCOLTA.votiPerBlocco()) + ' voti per blocco)');
  }
  if (ASCOLTA.profilo() !== null) throw new Error('restituisce un profilo invece di niente');
});

prova('CONTROPROVA: sulla musica invece si dichiara affidabile', function () {
  /* Senza questa, una soglia messa troppo in alto zittirebbe lo strumento
     sempre — e la prova di sopra passerebbe lo stesso. */
  ASCOLTA.azzera();
  giroPop(DO).forEach(function (note) {
    for (var v = 0; v < 3; v++) ASCOLTA.analizza(accordo(note, DIM), FS);
  });
  if (!ASCOLTA.affidabile()) {
    throw new Error('non si fida nemmeno di un giro di accordi pulito (' +
                    Math.round(ASCOLTA.votiPerBlocco()) + ' voti per blocco)');
  }
  if (!ASCOLTA.profilo()) throw new Error('non restituisce il profilo');
});

console.log('\n' + passate + ' passate, ' + fallite + ' fallite\n');
process.exit(fallite ? 1 : 0);
