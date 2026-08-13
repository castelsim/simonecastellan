/* Il motore: da due flussi di campioni alla risposta dell'impianto.

   Riceve il segnale che abbiamo MANDATO (il riferimento) e quello che il
   microfono ha SENTITO, e ne ricava tre cose:

     magnitudo  quanto l'impianto alza o abbassa ogni frequenza
     fase       di quanto la sposta nel tempo
     coerenza   quanto di ciò che il microfono sente viene davvero da noi

   La terza è quella che rende credibile il resto. In una sala vera il
   microfono sente anche il condizionatore, il traffico, la gente e la coda di
   riverbero: dove la coerenza è bassa, la curva NON va creduta, e lo strumento
   deve dirlo invece di disegnare una linea inventata.

   ── Perché serve mediare su più blocchi ──
   Su un blocco solo la coerenza vale 1 SEMPRE, per costruzione: |Sxy|² è
   identico a Sxx·Syy quando non c'è media. Un misuratore che analizza un
   blocco per volta mostrerebbe coerenza piena anche puntando il microfono nel
   vuoto. La media sui blocchi è ciò che la rende un'informazione.

   Qui dentro non c'è niente del browser, apposta: le prove girano da riga di
   comando (`node tools/prova-dsp.js`). */

var MISURA = (function (DSP) {

  function crea(opz) {
    opz = opz || {};
    var fs = opz.fs || 48000;
    var n = opz.dimensione || 8192;       // punti per blocco
    var meta = n >> 1;                     // sovrapposizione del 50%
    var righe = n >> 1;

    var Sxx = new Float64Array(righe);
    var Syy = new Float64Array(righe);
    var SxyR = new Float64Array(righe);
    var SxyI = new Float64Array(righe);
    var blocchi = 0;

    var w = DSP.hann(n);
    var freq = new Float64Array(righe);
    for (var i = 0; i < righe; i++) freq[i] = i * fs / n;

    /* Un blocco per volta: finestra, FFT dei due segnali, e si sommano gli
       spettri. La divisione per il numero di blocchi si fa alla fine. */
    function unBlocco(rif, mic, da) {
      var xr = new Float64Array(n), xi = new Float64Array(n);
      var yr = new Float64Array(n), yi = new Float64Array(n);
      for (var i = 0; i < n; i++) {
        xr[i] = rif[da + i] * w[i];
        yr[i] = mic[da + i] * w[i];
      }
      DSP.fft(xr, xi);
      DSP.fft(yr, yi);
      for (i = 0; i < righe; i++) {
        var ar = xr[i], ai = xi[i], br = yr[i], bi = yi[i];
        Sxx[i] += ar * ar + ai * ai;
        Syy[i] += br * br + bi * bi;
        // Sxy = coniugato(X) · Y
        SxyR[i] += ar * br + ai * bi;
        SxyI[i] += ar * bi - ai * br;
      }
      blocchi++;
    }

    function aggiungi(rif, mic) {
      var quanti = Math.min(rif.length, mic.length);
      for (var da = 0; da + n <= quanti; da += meta) unBlocco(rif, mic, da);
    }

    function svuota() {
      Sxx.fill(0); Syy.fill(0); SxyR.fill(0); SxyI.fill(0); blocchi = 0;
    }

    /* La lettura a una frequenza precisa. Si media su un ventiquattresimo di
       ottava attorno al punto: una riga sola di FFT balla di qualche decimo
       di dB per il caso, e su una misura di rumore quel ballo è rumore, non
       informazione. */
    function attorno(f, fn) {
      var fatt = Math.pow(2, 1 / 48);
      var da = f / fatt, a = f * fatt;
      var somma = 0, quanti = 0;
      for (var i = 1; i < righe; i++) {
        if (freq[i] >= da && freq[i] <= a) { somma += fn(i); quanti++; }
      }
      if (!quanti) {                                   // frequenza fra due righe
        var vicino = Math.max(1, Math.min(righe - 1, Math.round(f * n / fs)));
        return fn(vicino);
      }
      return somma / quanti;
    }

    function magnitudo(i) {
      if (!blocchi || Sxx[i] === 0) return 0;
      // H1 = Sxy / Sxx  — lo stimatore che regge il rumore SUL MICROFONO,
      // che è dove il rumore sta davvero (il riferimento lo generiamo noi)
      var hr = SxyR[i] / Sxx[i], hi = SxyI[i] / Sxx[i];
      return Math.sqrt(hr * hr + hi * hi);
    }

    function coerenza(i) {
      if (blocchi < 2) return 1;    // con un blocco solo è 1 per costruzione
      var num = SxyR[i] * SxyR[i] + SxyI[i] * SxyI[i];
      var den = Sxx[i] * Syy[i];
      if (den <= 0) return 0;
      return Math.min(1, num / den);
    }

    function risultato() {
      return {
        blocchi: blocchi,
        frequenze: freq,

        dbA: function (f) {
          return 20 * Math.log10(attorno(f, magnitudo) + 1e-12);
        },
        coerenzaA: function (f) {
          return attorno(f, coerenza);
        },
        faseA: function (f) {
          var i = Math.max(1, Math.min(righe - 1, Math.round(f * n / fs)));
          return Math.atan2(SxyI[i], SxyR[i]) * 180 / Math.PI;
        },

        /* La curva pronta per il grafico: frequenza, decibel, coerenza.
           I decibel sono relativi alla media fra 200 Hz e 2 kHz, la zona che
           in una sala è la più affidabile: quello che interessa è la FORMA
           della curva, non un livello assoluto che senza fonometro non
           sapremmo comunque dare. */
        curva: function (lisciatura) {
          var f = [], db = [], co = [];
          for (var i = 1; i < righe; i++) {
            if (freq[i] < 20 || freq[i] > 20000) continue;
            f.push(freq[i]);
            db.push(20 * Math.log10(magnitudo(i) + 1e-12));
            co.push(coerenza(i));
          }
          var lisci = DSP.liscia(f, db, lisciatura || 6);
          var rif = 0, quanti = 0;
          for (i = 0; i < f.length; i++) {
            if (f[i] >= 200 && f[i] <= 2000) { rif += lisci[i]; quanti++; }
          }
          rif = quanti ? rif / quanti : 0;
          var fuori = [];
          for (i = 0; i < f.length; i++) {
            fuori.push({ f: f[i], db: lisci[i] - rif, coerenza: co[i] });
          }
          return fuori;
        }
      };
    }

    return { aggiungi: aggiungi, risultato: risultato, svuota: svuota,
             get blocchi() { return blocchi; } };
  }

  return { crea: crea };

})(typeof require !== 'undefined' ? require('../comune/dsp.js') : DSP);

if (typeof module !== 'undefined' && module.exports) module.exports = MISURA;
