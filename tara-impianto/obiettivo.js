/* La curva a cui puntare.

   Un impianto in sala NON deve essere piatto, e questo è l'errore che fa
   sbagliare quasi tutte le tarature fatte a occhio: si guarda la curva, la si
   vede scendere in alto, e si alzano gli acuti finché il grafico è dritto.
   Il risultato è un impianto che stanca in mezz'ora.

   Il motivo è che in una sala l'orecchio riceve il suono diretto più il
   riverbero, e il riverbero è più ricco di acuti di quanto sembri: un impianto
   misurato piatto suona brillante. Da qui la pendenza discendente — la stessa
   idea della «X-curve» del cinema, che scende dopo i 2 kHz.

   Queste curve sono PUNTI DI PARTENZA, non leggi: cambiano con la sala, con la
   distanza e con la musica. Servono a dare un bersaglio ai consigli, che senza
   assumerebbero il piatto — cioè il bersaglio sbagliato. */

var OBIETTIVO = (function () {

  /* Ogni curva è una lista di punti (frequenza, dB) e si interpola in mezzo,
     in scala logaritmica: fra un punto e l'altro il valore cambia dolcemente
     come cambia la percezione, non a scalini. */
  var CURVE = {
    piatta: {
      nome: 'Piatta',
      spiega: 'Nessuna preferenza: la curva a cui puntare è una riga dritta. ' +
              'Va bene per lo studio e per una misura di controllo.',
      punti: [[20, 0], [20000, 0]]
    },
    live: {
      nome: 'Live',
      spiega: 'Bassi un po\' avanti e acuti in discesa dolce. È la forma che in ' +
              'sala suona naturale: un impianto misurato piatto suona brillante ' +
              'e stanca dopo mezz\'ora.',
      punti: [[20, 4], [60, 4], [120, 2], [300, 0], [1000, 0],
              [4000, -2.5], [10000, -5], [20000, -7]]
    },
    parlato: {
      nome: 'Parlato',
      spiega: 'Sotto i 100 Hz si toglie: lì c\'è solo il rimbombo della sala e il ' +
              'rumore di fondo. Un tocco sui 2-4 kHz, dove stanno le consonanti ' +
              'che fanno capire le parole.',
      punti: [[20, -9], [60, -6], [125, -1], [500, 0], [2000, 1.5],
              [4000, 1.5], [8000, -1], [20000, -4]]
    }
  };

  function interpola(punti, f) {
    if (f <= punti[0][0]) return punti[0][1];
    var ultimo = punti[punti.length - 1];
    if (f >= ultimo[0]) return ultimo[1];
    for (var i = 1; i < punti.length; i++) {
      if (f <= punti[i][0]) {
        var a = punti[i - 1], b = punti[i];
        // in ottave, non in hertz: fra 100 e 200 c'è lo stesso spazio che fra
        // 1000 e 2000, ed è così che si sente
        var t = Math.log(f / a[0]) / Math.log(b[0] / a[0]);
        return a[1] + t * (b[1] - a[1]);
      }
    }
    return ultimo[1];
  }

  return {
    elenco: function () {
      return Object.keys(CURVE).map(function (k) {
        return { chiave: k, nome: CURVE[k].nome, spiega: CURVE[k].spiega };
      });
    },

    a: function (chiave, f) {
      var c = CURVE[chiave] || CURVE.piatta;
      return interpola(c.punti, f);
    },

    spiega: function (chiave) {
      return (CURVE[chiave] || CURVE.piatta).spiega;
    },

    /* La curva disegnata sul grafico, alle stesse frequenze della misura. */
    curva: function (chiave, frequenze) {
      var self = this;
      return frequenze.map(function (f) { return { f: f, db: self.a(chiave, f) }; });
    },

    /* Lo SCARTO: quanto la misura sta sopra o sotto il bersaglio. È questo che
       va guardato per correggere, non la curva nuda — e allineato in modo che
       la media fra 200 Hz e 2 kHz sia zero, o un impianto semplicemente più
       forte sembrerebbe tutto da tagliare. */
    scarto: function (chiave, curva) {
      var self = this;
      var diff = curva.map(function (p) {
        return { f: p.f, db: p.db - self.a(chiave, p.f), coerenza: p.coerenza };
      });
      var somma = 0, quanti = 0;
      diff.forEach(function (p) {
        if (p.f >= 200 && p.f <= 2000) { somma += p.db; quanti++; }
      });
      var medio = quanti ? somma / quanti : 0;
      return diff.map(function (p) {
        return { f: p.f, db: p.db - medio, coerenza: p.coerenza };
      });
    }
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = OBIETTIVO;
