/* Le prove della misura di leggibilità — da riga di comando:

       node tools/prova-leggibilita.js

   ── PERCHÉ ESISTONO (23/08/2026) ─────────────────────────────────────────
   `/semplifica-testo/` misura un testo italiano con l'indice Gulpease:

       89 + (300 × frasi − 10 × lettere) / parole

   Metà della formula è il CONTO DELLE FRASI, e le frasi si contano tagliando
   sui punti. Ma non ogni punto finisce una frase: «art. 5», «D.Lgs. n.
   33/2013», «euro 1.500,00», «S.r.l.» ne portano dentro uno o tre.

   Tagliando su tutti, questa frase sola

     «Ai sensi dell'art. 5, comma 2, del D.Lgs. n. 33/2013, il richiedente è
      tenuto a produrre la documentazione entro 30 gg. dalla notifica.»

   diventava SEI frasi da quattro parole l'una, e prendeva 100 su 100 con il
   commento «facile per tutti, anche per chi ha finito le elementari».
   Vale 64: si legge col diploma. Lo strumento dava il punteggio più alto
   possibile alla frase più difficile che gli si può dare — e proprio sul testo
   burocratico, cioè l'unico per cui esiste.

   Un difetto così non si vede guardando: un numero esce sempre, e chi legge
   non ha modo di sapere che è sbagliato. Perciò qui i casi sono scritti col
   numero di frasi ATTESO, calcolato a mano prima.

   Le funzioni si leggono dal file vivo (`semplifica-testo/script.js`), non da
   una copia: `frasi` e `gulpease` non toccano il DOM, quindi si possono
   interrogare così com'è. Se qui passa e in pagina no, la differenza è
   altrove. */

var fs = require('fs');
var path = require('path');

var sorgente = fs.readFileSync(
  path.join(__dirname, '..', 'semplifica-testo', 'script.js'), 'utf8'
);
var inizio = sorgente.indexOf('function lettere');
var fine = sorgente.indexOf('function commento');
if (inizio < 0 || fine < 0) {
  console.log('  ✗    non trovo le funzioni di misura in semplifica-testo/script.js');
  process.exit(1);
}
eval(sorgente.slice(inizio, fine));

var passate = 0, fallite = 0;

function prova(nome, fn) {
  try { fn(); passate++; console.log('  ok   ' + nome); }
  catch (e) { fallite++; console.log('  ✗    ' + nome + '\n         ' + e.message); }
}

function contaFrasi(t, atteso, perche) {
  var f = frasi(t);
  if (f.length !== atteso) {
    throw new Error(perche + ': ' + f.length + ' frasi invece di ' + atteso +
                    '\n         ' + JSON.stringify(f));
  }
}

console.log('Leggibilità (semplifica-testo/script.js)');

prova('un rimando di legge non spezza la frase', function () {
  contaFrasi("Ai sensi dell'art. 5, comma 2, del D.Lgs. n. 33/2013, il richiedente è " +
             "tenuto a produrre la documentazione entro 30 gg. dalla notifica.", 1,
             'la frase di prova');
});

prova('un importo in euro non spezza la frase', function () {
  contaFrasi("Il contributo concesso ammonta a euro 1.500,00 e sarà erogato in un'unica " +
             "soluzione.", 1, 'importo con le migliaia');
});

prova('una sigla a più punti non spezza la frase', function () {
  contaFrasi('La S.r.l. ha sede in via Roma. Il capitale è di euro 10.000,00.', 2,
             'S.r.l. porta dentro tre punti');
});

prova('le iniziali dei nomi non spezzano la frase', function () {
  contaFrasi('Il prof. Rossi ha scritto a M. Bianchi il 3 marzo. Poi è partito.', 2,
             'titolo abbreviato più iniziale puntata');
});

/* La controprova, ed è quella che conta: se la maschera dei punti fosse troppo
   larga, il punto fermo smetterebbe di funzionare e OGNI testo risulterebbe una
   frase sola — cioè il difetto opposto, con lo stesso effetto sul punteggio. */
prova('il punto fermo continua a finire le frasi', function () {
  contaFrasi('Prima frase. Seconda frase. Terza frase.', 3, 'tre frasi normali');
  contaFrasi('Il piano è pronto. Lo firmiamo domani.', 2, 'due frasi normali');
});

prova('una parola che finisce come un\'abbreviazione non è un\'abbreviazione', function () {
  contaFrasi('Ha studiato arte. Poi ha smesso.', 2, '«arte.» non è «art.»');
});

prova('l\'a capo finisce la frase, perché gli elenchi sono fatti di righe', function () {
  contaFrasi("Una riga.\nUn'altra riga.", 2, 'due righe');
  contaFrasi('Consegnare i documenti\nFirmare il modulo\nAttendere la risposta', 3,
             'elenco senza punti');
});

/* Il punteggio, non solo il conto: la formula si ricalcola qui a mano sui
   numeri che lo strumento stesso dichiara, così un errore nella formula non si
   nasconde dietro un conto di frasi giusto. */
prova('il punteggio è quello della formula di Gulpease', function () {
  var t = "Ai sensi dell'art. 5, comma 2, del D.Lgs. n. 33/2013, il richiedente è " +
          "tenuto a produrre la documentazione entro 30 gg. dalla notifica.";
  var p = parole(t).length, f = frasi(t).length, l = lettere(t);
  var atteso = Math.max(0, Math.min(100, Math.round(89 + (300 * f - 10 * l) / p)));
  var suo = gulpease(t);
  if (suo !== atteso) throw new Error('lo strumento dice ' + suo + ', la formula dà ' + atteso);
  if (suo >= 80) {
    throw new Error('la frase burocratica prende ' + suo + ': è il punteggio di un testo ' +
                    'facile, e questa non lo è');
  }
});

prova('senza testo non esce un punteggio', function () {
  if (gulpease('') !== null) throw new Error('con il vuoto risponde ' + gulpease(''));
});

console.log('\n' + passate + ' passate, ' + fallite + ' fallite');
process.exit(fallite ? 1 : 0);
