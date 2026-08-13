/* Il disegno della curva.

   Due scelte che vengono dal mestiere, non dalla grafica:

   1) La frequenza va in scala logaritmica. Un'ottava deve occupare sempre lo
      stesso spazio, o la metà destra del grafico si mangia tutto e i bassi —
      dove stanno quasi tutti i problemi di una sala — si schiacciano in un
      centimetro.

   2) Dove la coerenza è bassa la curva SBIADISCE. Non è un vezzo: è il modo
      di dire «qui non ti so rispondere» senza smettere di disegnare. Una
      curva tutta uguale mentirebbe, e una curva interrotta sembrerebbe un
      guasto. */

var GRAFICO = (function () {

  var TACCHE = [31.5, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

  function etichetta(f) {
    return f >= 1000 ? (f / 1000) + 'k' : String(f);
  }

  function crea(canvas, opz) {
    opz = opz || {};
    var minF = 20, maxF = 20000, ampiezza = opz.ampiezza || 18;  // ±18 dB

    function x(f, w) {
      return (Math.log(f / minF) / Math.log(maxF / minF)) * w;
    }
    function y(db, h) {
      return h / 2 - (db / ampiezza) * (h / 2);
    }

    function disegna(curva, congelata) {
      var dpr = window.devicePixelRatio || 1;
      var w = canvas.clientWidth, h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      var c = canvas.getContext('2d');
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, w, h);

      // griglia orizzontale, ogni 6 dB
      c.strokeStyle = '#e3e8e6'; c.lineWidth = 1;
      c.fillStyle = '#8b9793';
      c.font = '11px ui-monospace, Menlo, monospace';
      for (var db = -ampiezza + 6; db < ampiezza; db += 6) {
        var yy = Math.round(y(db, h)) + 0.5;
        c.beginPath();
        c.strokeStyle = (db === 0) ? '#ccd6d3' : '#eef2f1';
        c.moveTo(0, yy); c.lineTo(w, yy); c.stroke();
        if (db !== 0) c.fillText((db > 0 ? '+' : '') + db, 2, yy - 3);
      }

      // griglia verticale, alle frequenze che stanno sugli equalizzatori
      c.strokeStyle = '#eef2f1';
      TACCHE.forEach(function (f) {
        var xx = Math.round(x(f, w)) + 0.5;
        c.beginPath(); c.moveTo(xx, 0); c.lineTo(xx, h - 14); c.stroke();
        c.fillStyle = '#8b9793';
        var t = etichetta(f), lw = c.measureText(t).width;
        c.fillText(t, Math.min(w - lw, Math.max(0, xx - lw / 2)), h - 2);
      });

      if (congelata && congelata.length) traccia(c, congelata, w, h, '#c2c6cc', 1.5, true);
      if (curva && curva.length) traccia(c, curva, w, h, '#0d9488', 2.5, false);
    }

    /* La curva si disegna a pezzi: ogni tratto prende la sua trasparenza dalla
       coerenza del punto. Un tratto solo, con un colore solo, non potrebbe
       dire dove la misura vale e dove no. */
    function traccia(c, curva, w, h, colore, spessore, tratteggio) {
      c.lineWidth = spessore;
      c.lineCap = 'round'; c.lineJoin = 'round';
      if (tratteggio) c.setLineDash([4, 4]); else c.setLineDash([]);
      for (var i = 1; i < curva.length; i++) {
        var a = curva[i - 1], b = curva[i];
        if (a.f < 20 || b.f > 20000) continue;
        var co = Math.min(a.coerenza, b.coerenza);
        // sotto 0,4 quasi invisibile, sopra 0,8 piena: in mezzo sfuma
        var op = Math.max(0.12, Math.min(1, (co - 0.3) / 0.5));
        c.globalAlpha = op;
        c.strokeStyle = colore;
        c.beginPath();
        c.moveTo(x(a.f, w), y(Math.max(-ampiezza, Math.min(ampiezza, a.db)), h));
        c.lineTo(x(b.f, w), y(Math.max(-ampiezza, Math.min(ampiezza, b.db)), h));
        c.stroke();
      }
      c.globalAlpha = 1;
      c.setLineDash([]);
    }

    /* Le barre dell'RTA, mentre la misura è in corso: servono a far vedere
       che qualcosa sta arrivando davvero nel microfono. */
    function barre(livelli, bande) {
      var dpr = window.devicePixelRatio || 1;
      var w = canvas.clientWidth, h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      var c = canvas.getContext('2d');
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, w, h);

      var max = -Infinity, min = Infinity;
      for (var i = 0; i < livelli.length; i++) {
        if (livelli[i] > max) max = livelli[i];
        if (livelli[i] > -200 && livelli[i] < min) min = livelli[i];
      }
      var span = Math.max(30, max - min);
      var larg = w / bande.length;

      for (i = 0; i < bande.length; i++) {
        var v = (livelli[i] - (max - span)) / span;
        v = Math.max(0.01, Math.min(1, v));
        var alt = v * (h - 18);
        c.fillStyle = '#14b8a6';
        c.globalAlpha = 0.25 + 0.75 * v;
        c.fillRect(i * larg + 1, h - 18 - alt, larg - 2, alt);
      }
      c.globalAlpha = 1;
      c.fillStyle = '#8b9793';
      c.font = '10px ui-monospace, Menlo, monospace';
      TACCHE.forEach(function (f) {
        var xx = x(f, w), t = etichetta(f), lw = c.measureText(t).width;
        c.fillText(t, Math.min(w - lw, Math.max(0, xx - lw / 2)), h - 4);
      });
    }

    return { disegna: disegna, barre: barre };
  }

  return { crea: crea };
})();
