/* Il cervello di «Tonalità»: da dodici pesi alla tonalità più probabile.

   Sta in un file a parte dal 23/08/2026, e non per ordine.  Fino a ieri questa
   funzione viveva dentro `script.js`, intrecciata al DOM, e non era provabile
   da riga di comando: le uniche prove automatiche riguardavano il
   riconoscimento dal microfono (`ascolta.js`), che oggi non c'è più.  Sarebbe
   rimasto uno strumento il cui unico cervello non era coperto da nessuna prova
   — e un riconoscitore di tonalità sbagliato non se ne accorge da solo: una
   risposta esce sempre, con la stessa faccia sicura di quella giusta.

   Qui dentro non si tocca niente che riguardi la pagina: entrano dodici
   numeri, esce una classifica.  Così lo stesso codice che gira nel browser si
   può interrogare con `node`, invece di provarne una copia. */

/* I profili di Krumhansl-Kessler: quanto «pesa» ciascuna delle dodici note in
   una tonalità maggiore e in una minore, misurato su ascoltatori veri (1982).
   Sono il metro: la tonalità stimata è quella il cui profilo somiglia di più a
   quello che si è suonato. */
var KS_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
var KS_MINOR = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

/* Correlazione di Pearson fra due profili di dodici valori: 1 = identici,
   0 = niente in comune.  Serve la CORRELAZIONE e non la semplice distanza
   perché conta la FORMA del profilo, non quanto forte si è suonato. */
function pearson(x, p) {
  var n = 12, sx = 0, sp = 0, sxp = 0, sxx = 0, spp = 0;
  for (var i = 0; i < n; i++) {
    sx += x[i]; sp += p[i];
    sxp += x[i] * p[i]; sxx += x[i] * x[i]; spp += p[i] * p[i];
  }
  var den = Math.sqrt((n * sxx - sx * sx) * (n * spp - sp * sp));
  return den === 0 ? 0 : (n * sxp - sx * sp) / den;
}

/* Le ventiquattro tonalità in classifica, dalla più probabile alla meno.
   Il «quanto è sicura» non è una percentuale: è il distacco fra la prima e la
   seconda.  Due tonalità vicine (Do maggiore e La minore hanno le stesse note)
   restano vicine anche qui, ed è giusto così — la differenza la fa l'orecchio,
   non il conto. */
function stima(counts) {
  var cands = [];
  for (var t = 0; t < 12; t++) {
    ['major', 'minor'].forEach(function (m) {
      var base = (m === 'major') ? KS_MAJOR : KS_MINOR;
      var prof = [];
      for (var pc = 0; pc < 12; pc++) prof[pc] = base[(pc - t + 12) % 12];
      cands.push({ t: t, mode: m, r: pearson(counts, prof) });
    });
  }
  cands.sort(function (a, b) { return b.r - a.r; });
  return cands;
}

/* Le note che «stanno dentro» la tonalità: sono quelle che si accendono sui
   tasti, e servono a verificare a orecchio se la risposta regge. */
var MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
var MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];

function noteDellaScala(cand) {
  if (!cand) return null;
  var dentro = {};
  var iv = (cand.mode === 'major') ? MAJOR_SCALE : MINOR_SCALE;
  iv.forEach(function (s) { dentro[(cand.t + s) % 12] = true; });
  return dentro;
}

var STIMA = {
  KS_MAJOR: KS_MAJOR,
  KS_MINOR: KS_MINOR,
  pearson: pearson,
  stima: stima,
  noteDellaScala: noteDellaScala,
  MAJOR_SCALE: MAJOR_SCALE,
  MINOR_SCALE: MINOR_SCALE
};

if (typeof module !== 'undefined' && module.exports) module.exports = STIMA;
