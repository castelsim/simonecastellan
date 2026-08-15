/* I segnali di prova, condivisi da «Rumore rosa» e «Tara un impianto».

   Stanno qui e non dentro uno dei due perché devono essere LO STESSO segnale:
   se un giorno si corregge il rumore rosa, si corregge per entrambi. Prima
   erano una copia sola, dentro /rumore-rosa/; il secondo strumento avrebbe
   fatto nascere la seconda, e le due copie divergono sempre. */

var SEGNALI = (function () {

  /* Rumore in un buffer che si richiude su sé stesso: la coda sfuma dentro la
     testa, così il punto di giunzione non fa «tac» a ogni giro. */
  function rumore(ctx, rosa) {
    var sr = ctx.sampleRate;
    var len = Math.floor(sr * 10);
    var cf = Math.floor(sr * 0.5);
    var raw = new Float32Array(len + cf);
    var b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

    for (var i = 0; i < raw.length; i++) {
      var w = Math.random() * 2 - 1;
      if (!rosa) { raw[i] = w; continue; }
      // Filtro di Paul Kellett: da bianco a rosa (−3 dB per ottava).
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.96900 * b2 + w * 0.1538520;
      b3 = 0.86650 * b3 + w * 0.3104856;
      b4 = 0.55000 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.0168980;
      raw[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
      b6 = w * 0.115926;
    }

    var out = new Float32Array(len);
    for (var j = 0; j < len; j++) out[j] = raw[j];
    for (var k = 0; k < cf; k++) {
      var t = k / cf;
      out[k] = out[k] * t + raw[len + k] * (1 - t);
    }

    /* Normalizzato a valore efficace 1: così il dBFS scelto è l'RMS, il modo
       in cui si legge il rumore rosa su un fonometro o sul misuratore del
       mixer. */
    var sum = 0;
    for (var m = 0; m < len; m++) sum += out[m] * out[m];
    var rms = Math.sqrt(sum / len) || 1;
    for (var n = 0; n < len; n++) out[n] /= rms;

    /* Il picco che resta DOPO la normalizzazione: normalizzare al valore
       efficace non dice niente su quanto sale la punta più alta. Il rosa che
       esce da Kellett ha un fattore di cresta fra 12,5 e 13,4 dB (misurato su
       dieci realizzazioni), quindi a −12 dBFS di RMS la punta arriva a 1,175 —
       distorce. Chi usa il segnale ha bisogno di questo numero per non
       chiedere un livello impossibile, e siccome cambia a ogni rigenerazione
       va misurato, non indovinato. */
    var picco = 0;
    for (var p = 0; p < len; p++) {
      var a = out[p] < 0 ? -out[p] : out[p];
      if (a > picco) picco = a;
    }

    var buf = ctx.createBuffer(1, len, sr);
    if (buf.copyToChannel) buf.copyToChannel(out, 0);
    else buf.getChannelData(0).set(out);
    buf.__picco = picco;
    return buf;
  }

  /* Cache per contesto: rifare dieci secondi di rumore rosa a ogni play
     costa mezzo secondo di attesa senza motivo. */
  function conCache(ctx, chiave, fai) {
    if (!ctx.__segnali) ctx.__segnali = {};
    if (!ctx.__segnali[chiave]) ctx.__segnali[chiave] = fai();
    return ctx.__segnali[chiave];
  }

  return {
    rosa: function (ctx) { return conCache(ctx, 'rosa', function () { return rumore(ctx, true); }); },
    bianco: function (ctx) { return conCache(ctx, 'bianco', function () { return rumore(ctx, false); }); },

    /* Una sorgente pronta da far partire, con il suo guadagno. Chi chiama
       decide dove mandarla: nelle casse, nel misuratore, o in tutti e due. */
    sorgente: function (ctx, tipo) {
      var s = ctx.createBufferSource();
      s.buffer = (tipo === 'bianco') ? this.bianco(ctx) : this.rosa(ctx);
      s.loop = true;
      return s;
    },

    /* Da dBFS a fattore di moltiplicazione. −20 dBFS è il punto da cui si
       parte a tarare: lascia margine e non fa male a nessuno. */
    ampiezza: function (dbfs) { return Math.pow(10, dbfs / 20); },

    /* Il livello efficace più alto che il segnale regge senza che la punta
       superi lo zero, in dBFS (numero negativo). Sopra questo valore lo
       strumento con cui si misura un impianto distorce da solo — e la
       distorsione la si sentirebbe attribuendola all'impianto. */
    massimoSenzaClip: function (ctx, tipo) {
      var buf = (tipo === 'bianco') ? this.bianco(ctx) : this.rosa(ctx);
      if (!buf.__picco) return -12;
      return -20 * Math.log10(buf.__picco);
    }
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = SEGNALI;
