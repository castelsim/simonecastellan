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

        /* La risposta all'impulso: cosa fa l'impianto a un colpo secco.
           È la stessa informazione della curva, vista nel tempo invece che in
           frequenza — e nel tempo si leggono cose che in frequenza non si
           vedono: quanto tardi arriva la prima riflessione, e quanto è forte
           rispetto al suono diretto.

           Si ottiene riportando indietro H(f). Le righe dove non c'è segnale
           si azzerano: normalizzando il rumore di fondo si otterrebbe una coda
           di erba che nasconde le riflessioni vere. */
        impulso: function (quanti) {
          var n = righe * 2;
          var re = new Float64Array(n), im = new Float64Array(n);
          var soglia = 0;
          for (var i = 1; i < righe; i++) soglia = Math.max(soglia, Sxx[i]);
          soglia *= 1e-8;

          for (i = 1; i < righe; i++) {
            if (Sxx[i] < soglia) continue;
            var hr = SxyR[i] / Sxx[i], hi = SxyI[i] / Sxx[i];
            re[i] = hr; im[i] = hi;
            re[n - i] = hr; im[n - i] = -hi;      // simmetria: esce un segnale reale
          }
          DSP.fft(re, im, true);

          var quantiPunti = Math.min(quanti || 2048, n);
          var out = new Float64Array(quantiPunti);
          var max = 0;
          for (i = 0; i < quantiPunti; i++) {
            out[i] = re[i];
            if (Math.abs(out[i]) > max) max = Math.abs(out[i]);
          }
          if (max > 0) for (i = 0; i < quantiPunti; i++) out[i] /= max;
          return { campioni: out, fs: fs };
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

  /* ── La media fra più posizioni ──────────────────────────────────────────
     Un punto solo non descrive una sala: le cancellazioni si spostano di metro
     in metro, e quello che a un posto è un buco di 12 dB, due metri più in là
     non c'è. Si misura in tre o cinque punti e si media.

     SI MEDIANO LE POTENZE, NON I DECIBEL. È la trappola di questo conto: i
     decibel sono logaritmi, e la loro media aritmetica pesa i buchi profondi
     molto più di quanto meritino. Un buco di −30 dB in una sola posizione, su
     tre posizioni, tira giù la media di 10 dB in media logaritmica — e uno
     finirebbe per correggere un problema che esiste in un punto solo della
     sala. In potenza quel buco pesa per quello che è: quasi niente.

     Le fasi invece NON si mediano fra posizioni diverse: a un metro di
     distanza sono già scorrelate, e la loro media tende a zero senza
     significato. Si tiene la fase della prima misura, che è l'unica ancorata
     a un punto vero. */
  function media(risultati) {
    var buoni = (risultati || []).filter(Boolean);
    if (!buoni.length) return null;
    if (buoni.length === 1) return buoni[0];

    var curve = buoni.map(function (r) { return r.curva(6); });
    var quante = curve.length;
    var lunghezza = curve[0].length;

    var fuori = [];
    for (var i = 0; i < lunghezza; i++) {
      var pot = 0, coe = 0, quanti = 0;
      for (var k = 0; k < quante; k++) {
        var p = curve[k][i];
        if (!p) continue;
        pot += Math.pow(10, p.db / 10);      // dai dB alla potenza
        coe += p.coerenza;
        quanti++;
      }
      if (!quanti) continue;
      fuori.push({
        f: curve[0][i].f,
        db: 10 * Math.log10(pot / quanti),   // e ritorno ai dB
        /* La coerenza media è quella giusta: se in una posizione su tre la
           misura non valeva niente, il risultato è meno affidabile e si deve
           vedere. */
        coerenza: coe / quanti
      });
    }

    return {
      posizioni: quante,
      blocchi: buoni.reduce(function (s, r) { return s + r.blocchi; }, 0),
      curva: function () { return fuori; },
      dbA: function (f) { return leggi(fuori, f, 'db'); },
      coerenzaA: function (f) { return leggi(fuori, f, 'coerenza'); },
      faseA: function (f) { return buoni[0].faseA(f); },
      impulso: function () { return buoni[0].impulso(); }
    };
  }

  function leggi(curva, f, campo) {
    var piu = curva[0], dist = Infinity;
    for (var i = 0; i < curva.length; i++) {
      var d = Math.abs(Math.log(curva[i].f / f));
      if (d < dist) { dist = d; piu = curva[i]; }
    }
    return piu ? piu[campo] : 0;
  }

  return { crea: crea, media: media };

})(typeof require !== 'undefined' ? require('../comune/dsp.js') : DSP);

if (typeof module !== 'undefined' && module.exports) module.exports = MISURA;
