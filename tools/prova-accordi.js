/* Le prove del trasporto degli accordi — da riga di comando:

       node tools/prova-accordi.js

   Un trasportatore sbagliato non si vede leggendo: gli accordi ci sono, sono
   plausibili, e la canzone suona storta solo quando qualcuno la prova. Perciò
   qui i casi difficili vengono prima di quelli facili.

   I due modi di sbagliare che contano:
   · riconoscere come accordo una parola («La chitarra», «Mi ha detto», «Do
     tutto»): il testo della canzone viene riscritto, ed è irreparabile;
   · perdere l'allineamento: gli accordi stanno sopra la sillaba in cui si
     cambia, e se scivolano di due caratteri il documento è sbagliato pur
     restando bello da vedere. */

var A = require('../trasporta-accordi/accordi.js');

var passate = 0, fallite = 0;

function prova(nome, fn) {
  try { fn(); passate++; console.log('  ok   ' + nome); }
  catch (e) { fallite++; console.log('  ✗    ' + nome + '\n         ' + e.message); }
}

function uguali(avuto, atteso, quando) {
  if (avuto !== atteso) {
    throw new Error(quando + '\n         atteso: ' + JSON.stringify(atteso) +
                    '\n         avuto:  ' + JSON.stringify(avuto));
  }
}

console.log('Trasporto degli accordi (trasporta-accordi/accordi.js)');

// ── Il caso che conta più di tutti ─────────────────────────────────────────
prova('le parole italiane non vengono scambiate per accordi', function () {
  var testo = [
    'La chitarra era appoggiata al muro',
    'Mi ha detto che non sarebbe tornato',
    'Do tutto quello che ho',
    'Fa freddo stasera'
  ].join('\n');
  uguali(A.trasporta(testo, 2), testo, 'un testo di parole non si tocca');
});

prova('una riga di soli accordi viene trasportata', function () {
  uguali(A.trasporta('Do Sol Lam Fa', 2), 'Re La Sim Sol', 'da Do a Re');
});

prova('la stessa riga in notazione inglese', function () {
  uguali(A.trasporta('C G Am F', 2), 'D A Bm G', 'da C a D');
});

// ── L'allineamento ─────────────────────────────────────────────────────────
prova('gli accordi restano sopra la loro sillaba', function () {
  var testo = 'Do          Sol         Lam        Fa\n' +
              'Nel blu   dipinto     di      blu';
  var fuori = A.trasporta(testo, 1);
  var righe = fuori.split('\n');
  // le colonne di partenza: 0, 12, 24, 35
  [0, 12, 24, 35].forEach(function (c, i) {
    if (righe[0].charAt(c) === ' ') {
      throw new Error('alla colonna ' + c + ' non comincia più nessun accordo:\n         ' +
                      JSON.stringify(righe[0]));
    }
  });
  uguali(righe[1], 'Nel blu   dipinto     di      blu', 'la riga di testo non si tocca');
});

prova('un accordo che si allunga non spinge via gli altri', function () {
  /* «Do» diventa un accordo di tre caratteri: senza cura, tutto quello che
     segue scivola a destra. Si guardano le COLONNE, non i nomi — la grafia
     (diesis o bemolle) la sceglie il motore secondo la tonalità d'arrivo, e
     qui non è quello che si sta provando. */
  var testo = 'Do    Sol   Fa\nnel blu dipinto';
  var riga = A.trasporta(testo, 1).split('\n')[0];
  [0, 6, 12].forEach(function (c) {
    if (riga.charAt(c) === ' ' || riga.charAt(c) === '') {
      throw new Error('alla colonna ' + c + ' non comincia più un accordo: ' + JSON.stringify(riga));
    }
    if (c > 0 && riga.charAt(c - 1) !== ' ') {
      throw new Error('alla colonna ' + c + ' l\'accordo è attaccato al precedente: ' +
                      JSON.stringify(riga));
    }
  });
});

prova('due accordi non finiscono mai appiccicati', function () {
  var fuori = A.trasporta('Do Re', 1);          // Do#Re# senza spazio sarebbe illeggibile
  if (/[a-z#b][A-Z]/.test(fuori.replace(/\s/g, 'X').replace(/X/g, ' ')) &&
      !/ /.test(fuori)) {
    throw new Error('accordi attaccati: ' + JSON.stringify(fuori));
  }
  if (fuori.indexOf(' ') < 0) throw new Error('manca lo spazio: ' + JSON.stringify(fuori));
});

// ── Diesis o bemolle: la scelta che fa il musicista ────────────────────────
prova('in una tonalità di bemolli si scrive coi bemolli', function () {
  // Do → Fa (5 semitoni): Fa maggiore vuole il Sib, non il La#
  uguali(A.trasporta('Do Sol Lam Fa', 5), 'Fa Do Rem Sib', 'da Do a Fa');
});

prova('in una tonalità di diesis si scrive coi diesis', function () {
  // Do → Mi (4 semitoni): Mi maggiore vuole il Fa#, non il Solb
  uguali(A.trasporta('Do Fa Sol', 4), 'Mi La Si', 'da Do a Mi');
  uguali(A.trasporta('Do Re Mi', 4), 'Mi Fa# Sol#', 'le alterazioni di Mi maggiore');
});

// ── Gli accordi veri, non solo le triadi ──────────────────────────────────
prova('i suffissi restano intatti', function () {
  uguali(A.trasporta('Do7 Rem7 Solsus4 Lamaj7 Sim7b5', 2),
         'Re7 Mim7 Lasus4 Simaj7 Do#m7b5', 'i suffissi non si toccano');
});

prova('il basso dopo la barra si trasporta anche lui', function () {
  uguali(A.trasporta('Do/Mi Fa/La Sol/Si', 2), 'Re/Fa# Sol/Si La/Do#', 'accordi con basso');
});

prova('«Sib» è un accordo, «Si» seguito da «b» non diventa altro', function () {
  uguali(A.trasporta('Sib Mib Lab', 2), 'Do Fa Sib', 'i bemolli salgono di un tono');
});

// ── Le righe miste, che nella vita reale ci sono ──────────────────────────
prova('una riga con la stanghetta resta una riga di accordi', function () {
  uguali(A.trasporta('| Do | Sol | Lam | Fa |', 2), '| Re | La | Sim | Sol |', 'con le stanghette');
});

prova('le righe vuote e i titoli restano dove sono', function () {
  var testo = 'Strofa\n\nDo Sol\nnel blu dipinto di blu\n\nRitornello\nLam Fa';
  var fuori = A.trasporta(testo, 2);
  uguali(fuori.split('\n')[0], 'Strofa', 'il titolo non si tocca');
  uguali(fuori.split('\n')[2], 'Re La', 'la riga di accordi sì');
  uguali(fuori.split('\n')[3], 'nel blu dipinto di blu', 'il testo no');
  uguali(fuori.split('\n')[5], 'Ritornello', 'anche «Ritornello» resta');
});

// ── Le proprietà che devono valere sempre ─────────────────────────────────
prova('salire di dodici semitoni riporta agli stessi accordi', function () {
  var t = 'Do Sol Lam Fa Mi7 Rem';
  uguali(A.trasporta(t, 12), t, 'un\'ottava intera');
});

prova('salire e poi scendere della stessa quantità torna al punto', function () {
  var t = 'Do Sol Lam Fa';
  for (var n = 1; n <= 11; n++) {
    var andata = A.trasporta(t, n);
    var ritorno = A.trasporta(andata, -n);
    // il ritorno può cambiare grafia (Fa# / Solb) ma non le note
    var classi = function (s) {
      return s.split(/\s+/).map(function (p) { return A.leggiAccordo(p).nota.classe; }).join(',');
    };
    if (classi(ritorno) !== classi(t)) {
      throw new Error('con ' + n + ' semitoni: ' + t + ' → ' + andata + ' → ' + ritorno);
    }
  }
});

prova('le dodici trasposizioni danno dodici risultati diversi', function () {
  var visti = {};
  for (var n = 0; n < 12; n++) visti[A.trasporta('Do', n)] = true;
  var quanti = Object.keys(visti).length;
  if (quanti !== 12) throw new Error('solo ' + quanti + ' accordi diversi su 12: ' +
                                     Object.keys(visti).join(' '));
});

// ── Il capotasto ─────────────────────────────────────────────────────────
prova('il capotasto dice il tasto giusto', function () {
  if (A.capotasto(2) !== 2) throw new Error('salendo di 2 il capotasto va al 2° tasto');
  if (A.capotasto(0) !== null) throw new Error('senza trasporto non serve il capotasto');
  if (A.capotasto(-2) !== 10) throw new Error('scendere di 2 = salire di 10, cioè 10° tasto');
});

// ── Il riconoscimento della notazione ────────────────────────────────────
prova('capisce in che notazione è scritto', function () {
  if (A.notazioneDi('Do Sol Lam Fa') !== 'it') throw new Error('«Do Sol Lam Fa» è italiano');
  if (A.notazioneDi('C G Am F') !== 'en') throw new Error('«C G Am F» è inglese');
});

prova('si può chiedere il risultato nell\'altra notazione', function () {
  uguali(A.trasporta('Do Sol Lam Fa', 0, { notazione: 'en' }), 'C G Am F', 'da italiano a inglese');
  uguali(A.trasporta('C G Am F', 0, { notazione: 'it' }), 'Do Sol Lam Fa', 'da inglese a italiano');
});

prova('la distanza fra due tonalità', function () {
  if (A.semitoniFra('Do', 'Re') !== 2) throw new Error('da Do a Re ci sono 2 semitoni');
  if (A.semitoniFra('La', 'Do') !== 3) throw new Error('da La a Do ce ne sono 3');
  if (A.semitoniFra('Do', 'Do') !== 0) throw new Error('da Do a Do, zero');
  if (A.semitoniFra('pippo', 'Re') !== null) throw new Error('quello che non è una nota dà null');
});

console.log('\n' + passate + ' passate, ' + fallite + ' fallite');
process.exit(fallite ? 1 : 0);
