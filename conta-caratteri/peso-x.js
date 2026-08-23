/* Quanto pesa un testo PER X, che non conta i caratteri come tutti gli altri.

   ── PERCHÉ ESISTE (23/08/2026) ───────────────────────────────────────────
   Questa pagina conta i grafemi, cioè quello che una persona chiama
   «carattere»: 👨‍👩‍👧‍👦 è uno. Fin qui è giusto, ed è il numero che serve per
   Instagram, TikTok, LinkedIn e Facebook.

   X però ha una regola sua, e la pagina la dichiarava SBAGLIATA: mostrava il
   numero di unità UTF-16 dicendo «X li conta così». Misurato con la libreria
   ufficiale di X (twitter-text 3.1.0):

     testo                     la nota diceva     X davvero
     👨‍👩‍👧‍👦 (famiglia)        11                 2
     🇮🇹 (bandiera)              4                 2
     👍🏽 (con la tonalità)       4                 2
     «e» + accento combinante    2                 1
     https://un-link-lungo…     67                23

   Un numero sbagliato è peggio di nessun numero: chi ci crede accorcia un
   post che stava dentro, o ne pubblica uno che viene tagliato.

   ── LE REGOLE VERE ───────────────────────────────────────────────────────
   1. Il testo si normalizza in NFC: «é» scritta in due modi pesa uguale.
   2. Ogni collegamento pesa 23, sempre — anche lunghissimo — perché X lo
      riscrive con un accorciatore. Un link corto pesa 23 lo stesso.
   3. Le emoji pesano 2, comprese quelle composte da più pezzi.
   4. Gli altri caratteri pesano 1 se stanno nei quattro intervalli «leggeri»
      dichiarati da X, 2 altrimenti: le lettere latine e accentate pesano 1, il
      cinese e il giapponese 2.

   Tutti i numeri qui sopra sono stati verificati contro twitter-text, non
   dedotti dalla documentazione: le prove stanno in tools/prova-peso-x.js. */

var PESO_X = (function () {

  /* I quattro intervalli che X considera «leggeri» (peso 1). Tutto quello che
     resta pesa 2. Sono esattamente quelli della sua configurazione pubblica. */
  var LEGGERI = [
    [0x0000, 0x10FF],
    [0x2000, 0x200D],
    [0x2010, 0x201F],
    [0x2032, 0x2037]
  ];

  /* I collegamenti, come li riconosce chi scrive: con lo schema davanti, con
     «www.», oppure un dominio nudo seguito da una barra o dalla fine. Non è la
     regola completa di X — la sua accetta anche «esempio.it» in mezzo a una
     frase — ma è quella che non prende per link una parola qualsiasi con un
     punto dentro. Dove sbaglia, sbaglia per difetto: il conto risulta più
     largo, mai più stretto. */
  var LINK = /\b(?:https?:\/\/|www\.)[^\s<>"]+|\b[a-z0-9][a-z0-9-]*\.(?:com|it|org|net|eu|io|dev|me|co|info|tv|app)(?:\/[^\s<>"]*)?/gi;

  var COSTO_LINK = 23;

  function leggero(cp) {
    for (var i = 0; i < LEGGERI.length; i++) {
      if (cp >= LEGGERI[i][0] && cp <= LEGGERI[i][1]) return true;
    }
    return false;
  }

  /* Un grafema è un'emoji se contiene un simbolo pittografico o una coppia di
     indicatori regionali (le bandiere). In quel caso pesa 2 tutto intero, non
     due per pezzo: è la differenza fra 2 e 11 sulla famiglia. */
  var PITTOGRAFICO = /\p{Extended_Pictographic}/u;
  var BANDIERA = /\p{Regional_Indicator}/u;

  function pesoGrafema(g) {
    if (PITTOGRAFICO.test(g) || BANDIERA.test(g)) return 2;
    var somma = 0;
    for (var i = 0; i < g.length; ) {
      var cp = g.codePointAt(i);
      somma += leggero(cp) ? 1 : 2;
      i += cp > 0xFFFF ? 2 : 1;
    }
    return somma;
  }

  /* Senza Intl.Segmenter (browser vecchi) si ricade sui code point: sbaglia
     solo sulle emoji composte, e sbaglia in eccesso — meglio di un numero
     ottimista che fa pubblicare un post troncato. */
  function grafemiDi(t) {
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      var seg = new Intl.Segmenter('it', { granularity: 'grapheme' });
      return Array.from(seg.segment(t), function (s) { return s.segment; });
    }
    return Array.from(t);
  }

  function peso(t) {
    if (!t) return 0;
    var testo = t.normalize ? t.normalize('NFC') : t;

    // i link si tolgono di mezzo e si contano a parte, a 23 l'uno
    var link = 0;
    var senzaLink = testo.replace(LINK, function () { link += COSTO_LINK; return ''; });

    var somma = link;
    grafemiDi(senzaLink).forEach(function (g) { somma += pesoGrafema(g); });
    return somma;
  }

  return { peso: peso, COSTO_LINK: COSTO_LINK };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = PESO_X;
