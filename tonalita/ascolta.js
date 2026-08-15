/* Ascolta la musica dal microfono e riempie il profilo delle dodici note.

   Perché esiste: su un iPhone il brano sta in Apple Music o in Spotify, non è
   un file che si possa scegliere. «Carica il brano» lì è una promessa che non
   si può mantenere. Ma il telefono ce l'hai in mano mentre la musica suona —
   dalla cassa, dalle casse del locale, da un altro telefono — e il microfono
   sente benissimo.

   Cambia anche cosa fa lo strumento: prima indovinava la tonalità da quello
   che TU suonavi sui tasti, adesso può ascoltare e dirtela lui. Il cervello
   però è lo stesso — i profili di Krumhansl in `estimateKey()` — e questo file
   si limita a riempire lo stesso vettore di dodici pesi che prima riempivano
   i tasti.

   ── Come si arriva dalle frequenze alle dodici note ──
   Ogni riga della FFT corrisponde a una frequenza; da quella si ricava la nota
   con il logaritmo in base due (un'ottava = raddoppio), e la si porta dentro
   una sola ottava con il resto della divisione per dodici. L'energia di quella
   riga si somma al peso di quella nota.

   Tre accorgimenti che cambiano il risultato, in ordine di importanza:

   1. SI GUARDA SOLO DOVE STANNO LE FONDAMENTALI, fra 65 Hz (Do2) e 1046 Hz
      (Do6). Sopra ci sono soprattutto armonici, che appartengono a note
      diverse dalla nota suonata e sporcano il profilo; sotto c'è il rimbombo
      della stanza.

   2. SI IGNORA IL RUMORE DI FONDO. Solo le righe che superano di parecchio la
      mediana del blocco votano: in un locale il condizionatore e il vociare
      riempirebbero tutte e dodici le caselle allo stesso modo, e il risultato
      sarebbe una tonalità qualunque con la stessa faccia di una vera.

   3. SI PESA CON LA RADICE, non con l'energia piena. Una nota di basso ha
      molta più energia di un accordo di chitarra, e senza questo il profilo
      diventerebbe il ritratto del basso invece che del brano. */

var ASCOLTA = (function (DSP) {

  var LA = 440;
  var MIN_HZ = 65;      // Do2: sotto ci sono rimbombo e rumore
  var MAX_HZ = 1046;    // Do6: sopra dominano gli armonici
  var DIM = 8192;       // righe della FFT: ~5,9 Hz a 48 kHz, mezzo semitono in basso

  var ctx = null, stream = null, sorgente = null, nodo = null;
  var attivo = false;
  var quandoAggiorna = null;
  var pesi = new Float64Array(12);
  var blocchiVisti = 0;
  var votiTotali = 0;
  var ultimoPicco = 0, piccoMassimo = 0;

  /* Quanti contributi servono, in media per blocco, perché ci sia davvero
     della musica. Sotto, la pagina deve dire che non sa — vedi `affidabile()`.
     Il numero viene da una prova: con rumore soltanto se ne raccolgono pochi
     e sparsi, con un giro di accordi decine. */
  var VOTI_MINIMI_PER_BLOCCO = 6;
  var BLOCCHI_MINIMI = 4;

  function classeDiNota(hz) {
    // 69 è il numero MIDI del LA: da lì si contano i semitoni
    var midi = 69 + 12 * Math.log2(hz / LA);
    return ((Math.round(midi) % 12) + 12) % 12;
  }

  function mediana(a) {
    var b = Array.prototype.slice.call(a).sort(function (x, y) { return x - y; });
    return b[b.length >> 1];
  }

  function unBlocco(campioni, fs) {
    var n = DIM;
    var w = DSP.hann(n);
    var re = new Float64Array(n), im = new Float64Array(n);
    for (var i = 0; i < n; i++) re[i] = (campioni[i] || 0) * w[i];
    DSP.fft(re, im);

    var righe = n >> 1;
    var mag = new Float64Array(righe);
    for (i = 1; i < righe; i++) mag[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]);

    /* La soglia si ricava dal blocco stesso: quattro volte la mediana lascia
       passare le note e taglia il fondo. Una soglia fissa non funzionerebbe,
       perché dipende da quanto è forte la musica e da quanto è lontano il
       telefono. */
    var soglia = mediana(mag) * 4;
    var passo = fs / n;
    var votanti = 0;

    /* ── Perché si conta per NOTA e non per riga ──────────────────────────
       Il modo ingenuo — prendere ogni riga della FFT e sommarla alla nota che
       le corrisponde — sbaglia in modo sistematico, e la prova l'ha
       dimostrato: su un Do maggiore vinceva il SOL.

       Il motivo è fisico. La terza armonica di una nota è la sua quinta:
       suonando un Do, a 785 Hz c'è un Sol che il Do stesso ha prodotto.
       Attribuendo quella riga al Sol, si regala alla quinta l'energia della
       fondamentale — e in un accordo maggiore, dove la quinta suona già per
       conto suo, quella vince.

       Il conto si rovescia: per ogni nota si va a guardare quanta energia c'è
       alle SUE armoniche, con peso che cala. Così il Do incassa anche il Sol
       che ha generato, e resta lui in cima. È la stessa idea del «prodotto
       spettrale armonico», scritta in somma perché regge meglio le note che
       mancano. */
    for (var midi = 36; midi <= 84; midi++) {          // Do2 → Do6
      var f0 = LA * Math.pow(2, (midi - 69) / 12);
      if (f0 < MIN_HZ || f0 > MAX_HZ) continue;
      var somma = 0;
      for (var arm = 1; arm <= 6; arm++) {
        var f = f0 * arm;
        if (f > fs / 2) break;
        var riga = Math.round(f / passo);
        if (riga < 1 || riga >= righe) continue;

        /* Quanto si guarda attorno alla riga esatta: un quarto di semitono,
           non un numero fisso di righe. Un semitono in basso vale pochi hertz
           e in alto parecchi — con una tolleranza fissa, giù il Do sconfinava
           nel Do# e la controprova lo ha colto (il Do# pesava 27 senza che
           nessuno lo suonasse), mentre su ci si perdeva le note appena
           calanti, che nella musica vera sono la norma. */
        var largo = Math.floor((f * 0.0146) / passo);   // 0,0146 ≈ un quarto di semitono
        var m = 0;
        for (var d = -largo; d <= largo; d++) {
          var r = riga + d;
          if (r >= 1 && r < righe && mag[r] > m) m = mag[r];
        }
        if (m < soglia) continue;
        somma += Math.sqrt(m) / arm;
        votanti++;
      }
      pesi[((midi % 12) + 12) % 12] += somma;
    }
    blocchiVisti++;
    votiTotali += votanti;
    return votanti;
  }

  return {
    disponibile: function () {
      return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia &&
                typeof DSP !== 'undefined');
    },

    inAscolto: function () { return attivo; },

    /* Quanto arriva dal microfono, adesso e al massimo finora. Serve a
       distinguere «il microfono non arriva» da «arriva ma non è musica»:
       due guasti diversi, con due rimedi diversi. */
    livello: function () { return ultimoPicco; },
    livelloMassimo: function () { return piccoMassimo; },
    silenzio: function () { return piccoMassimo < 0.005; },
    blocchi: function () { return blocchiVisti; },

    /* Esposta apposta: è il modo per provare il riconoscimento con note di cui
       si conosce la risposta, senza microfono e senza musica. Le prove stanno
       in `tools/prova-tonalita.js` e girano da riga di comando. */
    analizza: unBlocco,

    /* C'è abbastanza musica per rispondere?

       Serve, e la prova l'ha dimostrato: con del rumore soltanto, qualche riga
       supera la soglia per caso, e siccome il profilo si normalizza sul
       massimo, quell'unica nota andava a 100 e le altre a zero. Il risultato
       aveva la faccia di una tonalità fortissima ed era il nulla. Un telefono
       appoggiato in una stanza silenziosa non deve dire una tonalità: deve
       dire che non sente niente. */
    affidabile: function () {
      if (blocchiVisti < BLOCCHI_MINIMI) return false;
      return (votiTotali / blocchiVisti) >= VOTI_MINIMI_PER_BLOCCO;
    },

    votiPerBlocco: function () {
      return blocchiVisti ? votiTotali / blocchiVisti : 0;
    },

    /* I pesi accumulati, normalizzati: è la stessa forma che `estimateKey()`
       si aspetta, così il cervello dello strumento non cambia di una riga.
       Se non c'è abbastanza musica torna `null`: meglio niente che una
       risposta inventata. */
    profilo: function () {
      if (!this.affidabile()) return null;
      var max = 0, i;
      for (i = 0; i < 12; i++) if (pesi[i] > max) max = pesi[i];
      var out = [];
      for (i = 0; i < 12; i++) out[i] = max ? (pesi[i] / max) * 100 : 0;
      return out;
    },

    azzera: function () {
      pesi = new Float64Array(12);
      blocchiVisti = 0;
      votiTotali = 0;
      ultimoPicco = 0;
      piccoMassimo = 0;
    },

    avvia: function (contesto, aggiorna) {
      if (attivo) return Promise.resolve();
      quandoAggiorna = aggiorna;
      /* Le tre cose da spegnere: sono fatte per far capire la voce al
         telefono, e su una musica falsano tutto — il guadagno automatico da
         solo appiattisce gli accordi. */
      return navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      }).then(function (s) {
        stream = s;
        ctx = contesto;
        sorgente = ctx.createMediaStreamSource(s);
        nodo = ctx.createAnalyser();
        nodo.fftSize = DIM;
        nodo.smoothingTimeConstant = 0;
        sorgente.connect(nodo);
        attivo = true;

        var buf = new Float32Array(DIM);
        (function giro() {
          if (!attivo) return;
          nodo.getFloatTimeDomainData(buf);
          /* Quanto forte arriva, prima di qualunque analisi: senza questo
             numero «non funziona» e «non sento musica» sono indistinguibili,
             e chi guarda non sa se avvicinare il telefono o smettere. */
          var picco = 0;
          for (var i = 0; i < buf.length; i++) {
            var a = buf[i] < 0 ? -buf[i] : buf[i];
            if (a > picco) picco = a;
          }
          ultimoPicco = picco;
          if (picco > piccoMassimo) piccoMassimo = picco;

          unBlocco(buf, ctx.sampleRate);
          if (quandoAggiorna) quandoAggiorna();
          /* setTimeout e non requestAnimationFrame: con la pagina in secondo
             piano rAF si ferma, e uno che appoggia il telefono vicino alla
             cassa e guarda altrove smetterebbe di misurare senza saperlo. */
          setTimeout(giro, 120);
        })();
      });
    },

    ferma: function () {
      attivo = false;
      if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
      if (sorgente) { try { sorgente.disconnect(); } catch (e) {} sorgente = null; }
      nodo = null;
    }
  };
})(typeof require !== 'undefined' ? require('../comune/dsp.js') : DSP);

if (typeof module !== 'undefined' && module.exports) module.exports = ASCOLTA;
