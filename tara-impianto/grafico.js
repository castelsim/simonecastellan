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

    var ultimaCongelata = null, ultimoObiettivo = null;

    function disegna(curva, congelata, obiettivo) {
      ultimaCurva = curva; ultimaCongelata = congelata; ultimoObiettivo = obiettivo;
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

      /* Il bersaglio si disegna PRIMA e più sottile: è un riferimento, non una
         misura, e non deve competere con la curva vera. */
      if (obiettivo && obiettivo.length) {
        c.setLineDash([6, 5]);
        c.strokeStyle = '#c9a227';
        c.lineWidth = 1.5;
        c.beginPath();
        obiettivo.forEach(function (p, i) {
          var xx = x(p.f, w), yy = y(Math.max(-ampiezza, Math.min(ampiezza, p.db)), h);
          if (i) c.lineTo(xx, yy); else c.moveTo(xx, yy);
        });
        c.stroke();
        c.setLineDash([]);
      }

      if (congelata && congelata.length) traccia(c, congelata, w, h, '#c2c6cc', 1.5, true);
      if (curva && curva.length) traccia(c, curva, w, h, '#0d9488', 2.5, false);

      if (segnaposto && curva && curva.length) disegnaSegnaposto(c, w, h);
    }

    /* ── Il cursore ────────────────────────────────────────────────────────
       Toccare la curva e leggere il numero esatto. I consigli dicono le cose
       grosse; qui si controlla un punto preciso, che è quello che si fa
       quando si sta già muovendo un cursore sull'equalizzatore. */
    var segnaposto = null, ultimaCurva = null, quandoLegge = null;

    function disegnaSegnaposto(c, w, h) {
      var p = segnaposto;
      var xx = x(p.f, w), yy = y(Math.max(-ampiezza, Math.min(ampiezza, p.db)), h);
      c.strokeStyle = '#0f1614';
      c.lineWidth = 1;
      c.setLineDash([2, 3]);
      c.beginPath(); c.moveTo(xx, 0); c.lineTo(xx, h - 14); c.stroke();
      c.setLineDash([]);
      c.fillStyle = '#0d9488';
      c.beginPath(); c.arc(xx, yy, 4, 0, 6.2832); c.fill();
      c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.stroke();
    }

    function frequenzaDa(px, w) {
      return minF * Math.pow(maxF / minF, Math.max(0, Math.min(1, px / w)));
    }

    function leggi(clientX) {
      if (!ultimaCurva || !ultimaCurva.length) return;
      var r = canvas.getBoundingClientRect();
      var f = frequenzaDa(clientX - r.left, r.width);
      var piu = ultimaCurva[0], dist = Infinity;
      ultimaCurva.forEach(function (p) {
        var d = Math.abs(Math.log(p.f / f));
        if (d < dist) { dist = d; piu = p; }
      });
      segnaposto = piu;
      disegna(ultimaCurva, ultimaCongelata, ultimoObiettivo);
      if (quandoLegge) quandoLegge(piu);
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

    /* ── La risposta all'impulso ───────────────────────────────────────────
       Cosa fa l'impianto a un colpo secco. Qui il tempo è lineare, non
       logaritmico: si guarda QUANDO arrivano le cose. Il picco è il suono
       diretto; i baffi dopo sono le riflessioni della sala, e la loro
       distanza dal picco dice da quanto lontano tornano. */
    function impulso(ir, msVisibili) {
      var dpr = window.devicePixelRatio || 1;
      var w = canvas.clientWidth, h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      var c = canvas.getContext('2d');
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, w, h);
      if (!ir || !ir.campioni || !ir.campioni.length) return;

      var ms = msVisibili || 50;
      var quanti = Math.min(ir.campioni.length, Math.round(ir.fs * ms / 1000));
      var mezzo = h / 2;

      c.strokeStyle = '#eef2f1'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(0, mezzo + 0.5); c.lineTo(w, mezzo + 0.5); c.stroke();

      c.fillStyle = '#8b9793';
      c.font = '11px ui-monospace, Menlo, monospace';
      for (var t = 0; t <= ms; t += (ms > 40 ? 10 : 5)) {
        var xx = Math.round(t / ms * w) + 0.5;
        c.strokeStyle = '#f2f6f5';
        c.beginPath(); c.moveTo(xx, 0); c.lineTo(xx, h - 14); c.stroke();
        c.fillText(t + ' ms', Math.min(w - 34, xx + 3), h - 3);
      }

      c.strokeStyle = '#0d9488'; c.lineWidth = 1.5;
      c.beginPath();
      for (var i = 0; i < quanti; i++) {
        var px = i / quanti * w;
        var py = mezzo - ir.campioni[i] * (mezzo - 16);
        if (i) c.lineTo(px, py); else c.moveTo(px, py);
      }
      c.stroke();
    }

    /* ── La fase ───────────────────────────────────────────────────────────
       Si disegna «avvolta» fra −180° e +180°, come fanno tutti: srotolarla
       farebbe una scala che esce dal foglio. I salti verticali non sono
       guasti, sono il giro che ricomincia. */
    function fase(punti) {
      var dpr = window.devicePixelRatio || 1;
      var w = canvas.clientWidth, h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      var c = canvas.getContext('2d');
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, w, h);

      c.font = '11px ui-monospace, Menlo, monospace';
      [-180, -90, 0, 90, 180].forEach(function (g) {
        var yy = Math.round(h / 2 - (g / 200) * (h / 2)) + 0.5;
        c.strokeStyle = (g === 0) ? '#ccd6d3' : '#eef2f1';
        c.beginPath(); c.moveTo(0, yy); c.lineTo(w, yy); c.stroke();
        if (g !== 0) { c.fillStyle = '#8b9793'; c.fillText(g + '°', 2, yy - 3); }
      });
      TACCHE.forEach(function (f) {
        var xx = Math.round(x(f, w)) + 0.5;
        c.strokeStyle = '#f2f6f5';
        c.beginPath(); c.moveTo(xx, 0); c.lineTo(xx, h - 14); c.stroke();
        c.fillStyle = '#8b9793';
        var t = etichetta(f), lw = c.measureText(t).width;
        c.fillText(t, Math.min(w - lw, Math.max(0, xx - lw / 2)), h - 2);
      });

      /* A punti e non a linea: fra un punto e l'altro la fase può fare un
         salto di 360°, e unirli con una riga disegnerebbe pendenze che non
         esistono. */
      punti.forEach(function (p) {
        if (p.f < 20 || p.f > 20000) return;
        var op = Math.max(0.08, Math.min(1, (p.coerenza - 0.3) / 0.5));
        c.globalAlpha = op;
        c.fillStyle = '#0d9488';
        c.fillRect(x(p.f, w) - 1, h / 2 - (p.gradi / 200) * (h / 2) - 1, 2, 2);
      });
      c.globalAlpha = 1;
    }

    /* Il dito e il mouse leggono la curva. «passive» perché non si annulla
       niente: la pagina deve poter scorrere anche partendo dal grafico. */
    canvas.addEventListener('pointermove', function (e) { leggi(e.clientX); });
    canvas.addEventListener('pointerdown', function (e) { leggi(e.clientX); });
    canvas.addEventListener('pointerleave', function () {
      segnaposto = null;
      if (ultimaCurva) disegna(ultimaCurva, ultimaCongelata, ultimoObiettivo);
      if (quandoLegge) quandoLegge(null);
    });

    return {
      disegna: disegna,
      barre: barre,
      impulso: impulso,
      fase: fase,
      allaLettura: function (fn) { quandoLegge = fn; }
    };
  }

  return { crea: crea };
})();
