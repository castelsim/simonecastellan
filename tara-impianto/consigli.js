/* Dalla curva alle mosse sull'equalizzatore.

   Qui sta la parte che un grafico da solo non dà, e anche quella dove è più
   facile dire sciocchezze con aria sicura. Tre regole, tutte e tre nate dal
   mestiere e non dalla matematica:

   1) SI TAGLIA, NON SI ALZA. Alzare aumenta il livello e avvicina il ritorno;
      togliere fa lo stesso lavoro e lascia margine.

   2) UN BUCO STRETTO NON SI RIEMPIE. Quasi sempre è un'interferenza fra due
      sorgenti o con una parete: in quel punto il suono si cancella, e alzare
      il cursore vuol dire mandare più energia dentro una cancellazione —
      scalda gli amplificatori e non si sente niente. Peggio: basta spostarsi
      di un metro e il buco è altrove. Questa è la regola che separa chi tara
      da chi muove cursori.

   3) DOVE LA MISURA NON SA, NON SI CONSIGLIA. Sotto la coerenza minima le
      bande non entrano nemmeno in valutazione. */

var CONSIGLI = (function () {

  var COERENZA_MINIMA = 0.5;
  var SOGLIA_DB = 3;          // sotto i 3 dB non vale la pena toccare niente
  var STRETTO = 0.4;          // in ottave: sotto, è un'interferenza

  /* ── La banda in cui ha senso correggere ──────────────────────────────
     Fuori da qui i consigli non solo sono inutili: fanno danno.

     Sotto i 40 Hz un PA non arriva, e la misura è quasi solo rumore. Sopra i
     16 kHz siamo al bordo della banda del microfono e dell'udito, e un taglio
     lì non si sente.

     E soprattutto: SOTTO GLI 80 Hz NON SI ALZA MAI. Alzare i bassi profondi
     manda potenza dove i diffusori non riescono a produrre suono — la
     dissipano in calore ed escursione, e i woofer si rompono. È il modo più
     comune di distruggere un impianto credendo di migliorarlo. La prima
     versione di questo file consigliava «alza di 3,5 dB a 23 Hz»: l'ha
     scoperto l'autoprova, non io. */
  var BANDA_MIN = 40, BANDA_MAX = 16000;
  var NIENTE_ALZATE_SOTTO = 80;

  /* Da larghezza in ottave a Q, la formula che sta dietro ai filtri a campana. */
  function qDaOttave(ott) {
    var r = Math.pow(2, ott);
    return Math.sqrt(r) / (r - 1);
  }

  function arrotonda(f) {
    if (f < 100) return Math.round(f);
    if (f < 1000) return Math.round(f / 5) * 5;
    if (f < 10000) return Math.round(f / 50) * 50;
    return Math.round(f / 500) * 500;
  }

  /* Le zone dove la curva sta sopra (o sotto) la soglia per un tratto
     continuo. Una riga sola oltre soglia non è una gobba, è un sussulto. */
  function zone(curva, segno) {
    var fuori = [], corrente = null;
    for (var i = 0; i < curva.length; i++) {
      var p = curva[i];
      var dentro = p.coerenza >= COERENZA_MINIMA &&
                   p.f >= BANDA_MIN && p.f <= BANDA_MAX &&
                   segno * p.db >= SOGLIA_DB;
      if (dentro) {
        if (!corrente) corrente = { da: p.f, a: p.f, punti: [] };
        corrente.a = p.f;
        corrente.punti.push(p);
      } else if (corrente) {
        fuori.push(corrente);
        corrente = null;
      }
    }
    if (corrente) fuori.push(corrente);

    return fuori.map(function (z) {
      var ott = Math.log2(z.a / z.da);
      var peggio = z.punti[0];
      for (var i = 1; i < z.punti.length; i++) {
        if (segno * z.punti[i].db > segno * peggio.db) peggio = z.punti[i];
      }
      return {
        centro: Math.sqrt(z.da * z.a),
        picco: peggio.f,
        db: peggio.db,
        ottave: ott,
        q: ott > 0.02 ? qDaOttave(ott) : 8
      };
    }).filter(function (z) { return z.ottave >= 0.08; });
  }

  function dai(curva) {
    if (!curva || !curva.length) return { mosse: [], note: [] };

    var mosse = [], note = [];

    zone(curva, +1).forEach(function (z) {
      mosse.push({
        tipo: 'togli',
        hz: arrotonda(z.picco),
        db: Math.round(z.db * 2) / 2,
        q: Math.round(z.q * 10) / 10,
        testo: 'Togli ' + (Math.round(z.db * 2) / 2).toFixed(1).replace('.', ',') +
               ' dB a ' + arrotonda(z.picco) + ' Hz, con Q ' +
               (Math.round(z.q * 10) / 10).toString().replace('.', ',') + '.'
      });
    });

    zone(curva, -1).forEach(function (z) {
      if (z.ottave < STRETTO) {
        note.push({
          tipo: 'non-toccare',
          hz: arrotonda(z.picco),
          testo: 'A ' + arrotonda(z.picco) + ' Hz c\'è un buco stretto (' +
                 Math.abs(Math.round(z.db)) + ' dB). Non riempirlo: è una ' +
                 'cancellazione, e alzando il cursore mandi più energia dove il ' +
                 'suono si annulla. Si cura spostando una cassa, non con l\'EQ.'
        });
      } else if (z.picco < NIENTE_ALZATE_SOTTO) {
        /* Un avvallamento largo nei bassi profondi NON si corregge alzando:
           lì il diffusore ha finito la corsa, e più segnale vuol dire solo
           più calore e più escursione. Si risolve con un sub, o accettando
           che quell'ottava non c'è. */
        note.push({
          tipo: 'non-alzare-bassi',
          hz: arrotonda(z.picco),
          testo: 'Sotto gli ' + NIENTE_ALZATE_SOTTO + ' Hz manca ' +
                 Math.abs(Math.round(z.db)) + ' dB, ma non alzarli: lì i diffusori ' +
                 'hanno finito la corsa e il segnale in più diventa calore ed ' +
                 'escursione, non suono. Se servono quei bassi, serve un sub.'
        });
      } else {
        mosse.push({
          tipo: 'alza',
          hz: arrotonda(z.picco),
          db: Math.min(4, Math.round(Math.abs(z.db) * 2) / 2),
          q: Math.round(z.q * 10) / 10,
          testo: 'Alza di ' + Math.min(4, Math.round(Math.abs(z.db) * 2) / 2)
                   .toFixed(1).replace('.', ',') + ' dB a ' + arrotonda(z.picco) +
                 ' Hz, con Q ' + (Math.round(z.q * 10) / 10).toString().replace('.', ',') +
                 ' — è un avvallamento largo, quello si può correggere. Non di più: ' +
                 'alzare mangia margine.'
        });
      }
    });

    // le mosse più grosse per prime: si fa quella e si rimisura
    mosse.sort(function (a, b) { return Math.abs(b.db) - Math.abs(a.db); });

    var incerte = curva.filter(function (p) { return p.coerenza < COERENZA_MINIMA; });
    if (incerte.length > curva.length * 0.3) {
      note.push({
        tipo: 'poco-affidabile',
        testo: 'Buona parte della misura non è affidabile: c\'è troppo rumore ' +
               'in sala, o il segnale era troppo piano. Alza il volume di qualche ' +
               'dB, fai silenzio e rimisura.'
      });
    }

    return { mosse: mosse, note: note };
  }

  return { dai: dai, COERENZA_MINIMA: COERENZA_MINIMA };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = CONSIGLI;
