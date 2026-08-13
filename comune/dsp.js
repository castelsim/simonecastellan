/* Il calcolo che sta sotto alla misura di un impianto.

   Qui dentro non c'è niente del browser: nessun AudioContext, nessun canvas,
   nessuna finestra. È voluto — così le prove girano da riga di comando
   (`node tools/prova-dsp.js`) e un errore di formula si vede subito, invece di
   nascondersi dentro un grafico che «sembra giusto».

   Il metodo è quello di Smaart e di Open Sound Meter (GPL-3, che si è studiato
   ma non copiato: le formule sono pubbliche, il loro codice no). */

var DSP = (function () {

  /* ── FFT ────────────────────────────────────────────────────────────────
     Radix-2 con decimazione nel tempo, in posto. La lunghezza deve essere una
     potenza di due: chi chiama passa blocchi da 4096 o 8192, non numeri a
     caso. */

  function fft(re, im, inversa) {
    var n = re.length, i, j, k;
    if ((n & (n - 1)) !== 0) throw new Error('la FFT vuole una potenza di due, non ' + n);

    // riordino a bit invertiti
    for (i = 1, j = 0; i < n; i++) {
      var bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        var tr = re[i]; re[i] = re[j]; re[j] = tr;
        var ti = im[i]; im[i] = im[j]; im[j] = ti;
      }
    }

    for (var len = 2; len <= n; len <<= 1) {
      var ang = (inversa ? 2 : -2) * Math.PI / len;
      var wr = Math.cos(ang), wi = Math.sin(ang);
      for (i = 0; i < n; i += len) {
        var cr = 1, ci = 0;
        for (k = 0; k < len / 2; k++) {
          var ar = re[i + k], ai = im[i + k];
          var br = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
          var bi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
          re[i + k] = ar + br; im[i + k] = ai + bi;
          re[i + k + len / 2] = ar - br; im[i + k + len / 2] = ai - bi;
          var nr = cr * wr - ci * wi;
          ci = cr * wi + ci * wr; cr = nr;
        }
      }
    }
    if (inversa) for (i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
  }

  /* ── Finestre ──────────────────────────────────────────────────────────
     Senza finestra ogni blocco comincia e finisce di netto, e quel gradino la
     FFT lo legge come energia sparsa su tutte le frequenze: la curva esce
     sporca ovunque. Hann è il compromesso di sempre. */

  var cacheHann = {};
  function hann(n) {
    if (cacheHann[n]) return cacheHann[n];
    var w = new Float64Array(n);
    for (var i = 0; i < n; i++) w[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (n - 1)));
    cacheHann[n] = w;
    return w;
  }

  /* ── Bande di terzo d'ottava ───────────────────────────────────────────
     Le frequenze centrali della norma ISO, da 20 Hz a 20 kHz. Sono quelle
     scritte sugli equalizzatori: chi legge la curva ritrova i suoi cursori. */

  function terziDiOttava() {
    var bande = [], k;
    for (k = -17; k <= 13; k++) {
      var centro = 1000 * Math.pow(2, k / 3);
      // arrotondamento alle nominali ISO, quelle stampate sui pannelli
      var nom = nominale(centro);
      bande.push({
        centro: nom,
        esatta: centro,
        basso: centro / Math.pow(2, 1 / 6),
        alto: centro * Math.pow(2, 1 / 6)
      });
    }
    return bande;
  }

  var NOMINALI = [20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400,
                  500, 630, 800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000,
                  6300, 8000, 10000, 12500, 16000, 20000];
  function nominale(f) {
    var piu = NOMINALI[0];
    for (var i = 0; i < NOMINALI.length; i++) {
      if (Math.abs(Math.log(NOMINALI[i] / f)) < Math.abs(Math.log(piu / f))) piu = NOMINALI[i];
    }
    return piu;
  }

  /* Livello per banda, in dB, di un blocco di campioni. Serve all'RTA: la
     lettura immediata, quella che si guarda mentre si muove un cursore. */
  function livelliPerBanda(x, fs, bande) {
    var n = 1;
    while (n < x.length) n <<= 1;
    if (n > x.length) n >>= 1;              // si usa la potenza di due che ci sta
    var w = hann(n);
    var re = new Float64Array(n), im = new Float64Array(n);
    for (var i = 0; i < n; i++) re[i] = x[i] * w[i];
    fft(re, im);

    var pot = new Float64Array(n / 2);
    for (i = 0; i < n / 2; i++) pot[i] = re[i] * re[i] + im[i] * im[i];

    var passo = fs / n;
    var out = new Float64Array(bande.length);
    for (var b = 0; b < bande.length; b++) {
      var da = Math.max(1, Math.round(bande[b].basso / passo));
      var a = Math.min(n / 2 - 1, Math.round(bande[b].alto / passo));
      var somma = 0;
      for (i = da; i <= a; i++) somma += pot[i];
      out[b] = 10 * Math.log10(somma + 1e-20);
    }
    return out;
  }

  /* ── Ritardo ───────────────────────────────────────────────────────────
     Il microfono sente dopo: latenza in uscita, volo nell'aria, latenza in
     ingresso. Va trovato, o la fase ruota su sé stessa e la coerenza crolla.

     Due accorgimenti, e il secondo l'ha imposto una prova fallita.

     PHAT (phase transform) normalizza ogni riga di frequenza prima di tornare
     indietro: conta quando arriva ogni frequenza, non quanto è forte. Serve
     quando il rumore della sala è concentrato in basso — un condizionatore, il
     traffico — perché senza, quelle frequenze pesano nella correlazione in
     proporzione alla loro energia e sporcano il picco.

     PRIMO ARRIVO, non picco massimo. Il picco più alto NON è il suono
     diretto: è il più forte. Con il microfono vicino a una parete la
     riflessione può superare il diretto, e prendere il massimo sposta il
     ritardo di decine di millisecondi — provato, sbagliava di 19 ms. Si cerca
     quindi il PRIMO picco che arriva a metà del massimo (−6 dB), che è il
     suono diretto anche quando qualcosa dopo suona più forte. */

  function trovaRitardo(rif, mic, opz) {
    opz = opz || {};
    var phat = opz.phat !== false;
    var primoArrivo = opz.primoArrivo !== false;
    var quanti = Math.min(rif.length, mic.length);
    var n = 1;
    while (n < quanti * 2) n <<= 1;

    var ar = new Float64Array(n), ai = new Float64Array(n);
    var br = new Float64Array(n), bi = new Float64Array(n);
    for (var i = 0; i < quanti; i++) { ar[i] = rif[i]; br[i] = mic[i]; }
    fft(ar, ai); fft(br, bi);

    // spettro incrociato: mic × coniugato del riferimento
    var incR = new Float64Array(n), incI = new Float64Array(n), massimo = 0;
    for (i = 0; i < n; i++) {
      incR[i] = br[i] * ar[i] + bi[i] * ai[i];
      incI[i] = bi[i] * ar[i] - br[i] * ai[i];
      var m = incR[i] * incR[i] + incI[i] * incI[i];
      if (m > massimo) massimo = m;
    }

    /* PHAT normalizza ogni riga: dove l'impianto non manda niente resta solo
       rumore numerico, e normalizzarlo lo promuove al livello del segnale
       vero. Con un impianto che sotto i 150 Hz dà tutto e sopra nulla, il
       ritardo usciva 6 invece di 431. Quindi si normalizza solo dove c'è
       davvero qualcosa: sotto un millesimo del massimo, la riga non vota. */
    var soglia = massimo * 1e-6;
    for (i = 0; i < n; i++) {
      var re = incR[i], im = incI[i];
      var pot = re * re + im * im;
      if (phat) {
        if (pot < soglia) { re = 0; im = 0; }
        else { var mod = Math.sqrt(pot); re /= mod; im /= mod; }
      }
      ar[i] = re; ai[i] = im;
    }
    fft(ar, ai, true);

    var piu = 0, max = -Infinity;
    var limite = Math.min(n, quanti);           // ritardi in avanti soltanto
    var forza = new Float64Array(limite);
    for (i = 0; i < limite; i++) {
      forza[i] = ar[i] * ar[i] + ai[i] * ai[i];
      if (forza[i] > max) { max = forza[i]; piu = i; }
    }
    if (!primoArrivo) return piu;

    // il primo che arriva a metà del massimo in ampiezza (un quarto in potenza)
    var soglia = max * 0.25;
    for (i = 0; i <= piu; i++) {
      if (forza[i] < soglia) continue;
      // dev'essere una cima, non il fianco in salita di quella dopo
      if (i > 0 && forza[i - 1] > forza[i]) continue;
      if (i + 1 < limite && forza[i + 1] > forza[i]) continue;
      return i;
    }
    return piu;
  }

  /* ── Lisciatura ────────────────────────────────────────────────────────
     Una curva a piena risoluzione, in una sala, è un pettine illeggibile: le
     interferenze fanno buchi profondi e strettissimi che non si possono
     correggere e che non si sentono nemmeno. Si media su una frazione di
     ottava — un sesto è quello che usano quasi tutti per l'occhio. */

  function liscia(freq, valori, frazione) {
    var out = new Float64Array(valori.length);
    var fatt = Math.pow(2, 1 / (2 * (frazione || 6)));
    for (var i = 0; i < valori.length; i++) {
      var f = freq[i];
      if (!f) { out[i] = valori[i]; continue; }
      var da = f / fatt, a = f * fatt, somma = 0, quanti = 0;
      for (var j = 0; j < valori.length; j++) {
        if (freq[j] >= da && freq[j] <= a) { somma += valori[j]; quanti++; }
      }
      out[i] = quanti ? somma / quanti : valori[i];
    }
    return out;
  }

  return {
    fft: fft,
    hann: hann,
    terziDiOttava: terziDiOttava,
    livelliPerBanda: livelliPerBanda,
    trovaRitardo: trovaRitardo,
    liscia: liscia
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = DSP;
