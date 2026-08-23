/* Le prove del conteggio di X — da riga di comando:

       node tools/prova-peso-x.js

   ── PERCHÉ (23/08/2026) ──────────────────────────────────────────────────
   X non conta i caratteri come tutti gli altri, e `/conta-caratteri/` lo
   dichiarava con un numero SBAGLIATO: mostrava le unità UTF-16 dicendo «X li
   conta così». Sulla famiglia 👨‍👩‍👧‍👦 diceva 11; X ne conta 2.

   I numeri attesi qui sotto NON sono dedotti dalla documentazione: sono stati
   misurati con `twitter-text` 3.1.0, la libreria che X pubblica e usa. Se un
   giorno cambiassero le regole, questi numeri diventerebbero vecchi — perciò
   ognuno porta scritto accanto da dove viene.

   Se la libreria è installata (in un ambiente di sviluppo, non nel sito) il
   confronto si fa contro di lei, caso per caso; altrimenti si usano i valori
   misurati e riportati qui. */

var PESO = require('../conta-caratteri/peso-x.js');

var tw = null;
try { tw = require('twitter-text'); } catch (e) { /* non installata: si usano i valori misurati */ }

var passate = 0, fallite = 0;

function prova(nome, fn) {
  try { fn(); passate++; console.log('  ok   ' + nome); }
  catch (e) { fallite++; console.log('  ✗    ' + nome + '\n         ' + e.message); }
}

/* Ogni caso: il testo e quanto pesa per X, misurato con twitter-text. */
var CASI = [
  ['a', 1],
  ['ciao mondo', 10],
  ['àèìòù', 5],                                   // le accentate pesano 1
  ['é', 1],                                  // é precomposta
  ['é', 1],                                 // e + accento combinante: NFC le unisce
  ['\u{1F44D}', 2],                               // 👍
  ['\u{1F468}‍\u{1F469}‍\u{1F467}‍\u{1F466}', 2],  // famiglia: 11 in UTF-16
  ['\u{1F1EE}\u{1F1F9}', 2],                      // bandiera italiana: 4 in UTF-16
  ['\u{1F44D}\u{1F3FD}', 2],                      // pollice con tonalità: 4 in UTF-16
  ['日本語', 6],                      // giapponese: 2 a carattere
  ['—', 1],                                  // trattino lungo
  ['…', 2],                                  // puntini di sospensione
  ['https://simonecastellan.com', 23],
  ['https://simonecastellan.com/tools/e/un/percorso/molto/lungo/davvero', 23],
  ['link http://x.co e testo', 36],               // 5 + 23 + 8
  ['#hashtag @menzione', 18],
  [new Array(281).join('a'), 280]
];

console.log('Quanto pesa un testo per X (conta-caratteri/peso-x.js)');
if (tw) console.log('  (confronto vivo con twitter-text)');

prova('i casi misurati con la libreria di X tornano tutti', function () {
  var sbagliati = [];
  CASI.forEach(function (c) {
    var mio = PESO.peso(c[0]);
    var atteso = tw ? tw.parseTweet(c[0]).weightedLength : c[1];
    if (mio !== atteso) {
      sbagliati.push(JSON.stringify(c[0]).slice(0, 30) + ': mio ' + mio + ', X ' + atteso);
    }
  });
  if (sbagliati.length) throw new Error(sbagliati.join('\n         '));
});

/* La prova che discrimina davvero: se qualcuno tornasse a contare le unità
   UTF-16 — il difetto di partenza — questi tre casi lo direbbero subito. */
prova('non sta contando le unità UTF-16', function () {
  var famiglia = '\u{1F468}‍\u{1F469}‍\u{1F467}‍\u{1F466}';
  if (famiglia.length !== 11) throw new Error('la famiglia non è più 11 unità UTF-16: caso da rifare');
  if (PESO.peso(famiglia) === famiglia.length) {
    throw new Error('la famiglia pesa ' + PESO.peso(famiglia) + ', cioè le unità UTF-16: X ne conta 2');
  }
});

prova('non sta contando i grafemi', function () {
  // se contasse i grafemi, il giapponese peserebbe 3 invece di 6 e le emoji 1
  if (PESO.peso('日本語') === 3) throw new Error('il giapponese pesa 3: sono i grafemi, non il peso di X');
  if (PESO.peso('\u{1F44D}') === 1) throw new Error('l\'emoji pesa 1: sono i grafemi, non il peso di X');
});

prova('un link lungo e uno corto pesano uguale', function () {
  var corto = PESO.peso('https://x.co');
  var lungo = PESO.peso('https://simonecastellan.com/tools/comprimi-pdf/?molto=lungo&davvero=si');
  if (corto !== lungo) throw new Error('corto ' + corto + ', lungo ' + lungo + ': X li riscrive tutti a 23');
  if (corto !== PESO.COSTO_LINK) throw new Error('un link pesa ' + corto + ' invece di ' + PESO.COSTO_LINK);
});

prova('il testo vuoto pesa zero', function () {
  if (PESO.peso('') !== 0) throw new Error('il vuoto pesa ' + PESO.peso(''));
});

/* Il caso che ha fatto scoprire la contraddizione in pagina: 279 lettere più
   un pollice davano «280 / 280» in verde mentre la nota diceva 281. */
prova('279 lettere più un\'emoji sforano i 280 di X', function () {
  var t = new Array(280).join('a') + '\u{1F44D}';
  var p = PESO.peso(t);
  if (p !== 281) throw new Error('pesa ' + p + ' invece di 281');
});

console.log('\n' + passate + ' passate, ' + fallite + ' fallite');
process.exit(fallite ? 1 : 0);
