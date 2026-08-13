/* Le prove del motore di misura — si eseguono da riga di comando:

       node tools/prova-dsp.js

   Un misuratore che sbaglia non ha modo di accorgersene da solo: la curva esce
   comunque, e sembra una misura. Perciò qui gli si dà in pasto roba di cui
   conosciamo la risposta esatta, e si guarda se la trova.

   Ogni prova ha dentro il suo contrario, dove serve: se la coerenza resta alta
   anche su rumore scorrelato, il calcolo è sbagliato e nessuno se ne
   accorgerebbe mai guardando un grafico. */

var DSP = require('../comune/dsp.js');
var MISURA = require('../tara-impianto/misura.js');
var CONSIGLI = require('../tara-impianto/consigli.js');
var OBIETTIVO = require('../tara-impianto/obiettivo.js');

var passate = 0, fallite = 0;

function prova(nome, fn) {
  try {
    fn();
    passate++;
    console.log('  ok   ' + nome);
  } catch (e) {
    fallite++;
    console.log('  ✗    ' + nome + '\n         ' + e.message);
  }
}

function vicino(avuto, atteso, tolleranza, che) {
  if (Math.abs(avuto - atteso) > tolleranza) {
    throw new Error((che || '') + ' atteso ' + atteso + ' ± ' + tolleranza +
                    ', avuto ' + (Math.round(avuto * 1000) / 1000));
  }
}

/* Un generatore di numeri casuali con seme: senza, una prova che fallisce una
   volta su venti non si riesce a ripetere. */
function casuale(seme) {
  var s = seme >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return (s / 4294967296) * 2 - 1;
  };
}

function rumore(n, seme) {
  var r = casuale(seme), a = new Float32Array(n);
  for (var i = 0; i < n; i++) a[i] = r();
  return a;
}

/* Una campana di equalizzatore, per costruire una risposta nota. Formule del
   Cookbook di Robert Bristow-Johnson. */
function campana(x, fs, f0, guadagnoDb, q) {
  var A = Math.pow(10, guadagnoDb / 40);
  var w0 = 2 * Math.PI * f0 / fs;
  var alfa = Math.sin(w0) / (2 * q);
  var b0 = 1 + alfa * A, b1 = -2 * Math.cos(w0), b2 = 1 - alfa * A;
  var a0 = 1 + alfa / A, a1 = -2 * Math.cos(w0), a2 = 1 - alfa / A;
  b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;
  var y = new Float32Array(x.length);
  var x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (var i = 0; i < x.length; i++) {
    var v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}

console.log('\nMotore di calcolo\n');

prova('la FFT dà lo stesso risultato del calcolo lento', function () {
  var n = 64, re = new Float64Array(n), im = new Float64Array(n);
  var r = casuale(7);
  for (var i = 0; i < n; i++) re[i] = r();
  var orig = Array.from(re);
  DSP.fft(re, im);
  // il calcolo lento, quello che nessuno userebbe ma di cui ci si fida
  for (var k = 0; k < 6; k++) {
    var sr = 0, si = 0;
    for (var t = 0; t < n; t++) {
      var ang = -2 * Math.PI * k * t / n;
      sr += orig[t] * Math.cos(ang);
      si += orig[t] * Math.sin(ang);
    }
    vicino(re[k], sr, 1e-6, 'parte reale di k=' + k);
    vicino(im[k], si, 1e-6, 'parte immaginaria di k=' + k);
  }
});

prova('una sinusoide a 1 kHz finisce nella banda dei 1000 Hz', function () {
  var fs = 48000, n = 8192, x = new Float32Array(n);
  for (var i = 0; i < n; i++) x[i] = Math.sin(2 * Math.PI * 1000 * i / fs);
  var bande = DSP.terziDiOttava();
  var liv = DSP.livelliPerBanda(x, fs, bande);
  var piu = 0;
  for (var b = 1; b < bande.length; b++) if (liv[b] > liv[piu]) piu = b;
  vicino(bande[piu].centro, 1000, 1, 'la banda più forte');
  // e le vicine devono stare sotto di parecchio, o non sta separando niente
  if (liv[piu] - liv[piu - 1] < 15) throw new Error('la banda accanto è troppo vicina di livello: non separa');
});

prova('il ritardo si trova al campione giusto', function () {
  var n = 16384, rif = rumore(n, 3), ritardo = 250;
  var mic = new Float32Array(n);
  for (var i = ritardo; i < n; i++) mic[i] = rif[i - ritardo];
  vicino(DSP.trovaRitardo(rif, mic), ritardo, 0, 'il ritardo');
});

prova('il ritardo si trova anche con la sala addosso (eco e rumore)', function () {
  var n = 16384, rif = rumore(n, 11), ritardo = 431;
  var mic = new Float32Array(n), sporco = casuale(99);
  for (var i = 0; i < n; i++) {
    var v = 0;
    if (i >= ritardo) v += rif[i - ritardo];
    if (i >= ritardo + 900) v += 0.6 * rif[i - ritardo - 900];   // un'eco forte
    if (i >= ritardo + 2100) v += 0.4 * rif[i - ritardo - 2100]; // e un'altra
    mic[i] = v + 0.3 * sporco();                                 // e il condizionatore
  }
  vicino(DSP.trovaRitardo(rif, mic), ritardo, 1, 'il ritardo dentro la sala');
});

prova('una riflessione più forte del diretto non sposta il ritardo', function () {
  /* Capita col microfono vicino a una parete o sotto un soffitto basso: la
     riflessione arriva più forte del suono diretto. Il ritardo giusto resta
     quello del diretto — è il primo suono che arriva, non il più forte. */
  var n = 16384, rif = rumore(n, 11), ritardo = 431;
  var mic = new Float32Array(n);
  for (var i = 0; i < n; i++) {
    var v = 0;
    if (i >= ritardo) v += 1.0 * rif[i - ritardo];
    if (i >= ritardo + 900) v += 1.3 * rif[i - ritardo - 900];   // più forte del diretto
    mic[i] = v;
  }
  vicino(DSP.trovaRitardo(rif, mic), ritardo, 1, 'il ritardo del suono diretto');
});

prova('CONTROPROVA: col picco massimo si prenderebbe la riflessione', function () {
  /* Se questa NON fallisce senza la ricerca del primo arrivo, allora quella
     ricerca non serve a niente e va tolta. Ha già trovato un errore vero: il
     massimo cadeva 900 campioni dopo, 19 ms di ritardo sbagliato. */
  var n = 16384, rif = rumore(n, 11), ritardo = 431;
  var mic = new Float32Array(n);
  for (var i = 0; i < n; i++) {
    var v = 0;
    if (i >= ritardo) v += 1.0 * rif[i - ritardo];
    if (i >= ritardo + 900) v += 1.3 * rif[i - ritardo - 900];
    mic[i] = v;
  }
  var colMassimo = DSP.trovaRitardo(rif, mic, { primoArrivo: false });
  if (Math.abs(colMassimo - ritardo) <= 1) {
    throw new Error('anche col picco massimo esce giusto: la ricerca del primo arrivo non serve');
  }
  vicino(colMassimo, ritardo + 900, 1, 'il massimo cade sulla riflessione');
});

prova('con un impianto che taglia gli acuti, PHAT tiene il ritardo giusto', function () {
  /* Il caso che giustifica PHAT, trovato provando: un sistema che sopra i
     150 Hz non dà quasi niente. Senza PHAT il ritardo usciva 481 invece di
     431 — un millisecondo di errore. Se un giorno la riga «senza» esce
     giusta, PHAT non serve più e va tolto. */
  var n = 32768, ritardo = 431, rif = rumore(n, 11);
  var sentito = Float32Array.from(rif);
  for (var q = 0; q < 2; q++) {
    var p = 0;
    for (var i = 0; i < n; i++) { p = 0.98 * p + 0.02 * sentito[i]; sentito[i] = p; }
  }
  var mic = new Float32Array(n);
  for (i = ritardo; i < n; i++) mic[i] = sentito[i - ritardo];

  vicino(DSP.trovaRitardo(rif, mic), ritardo, 3, 'con PHAT');
  var senza = DSP.trovaRitardo(rif, mic, { phat: false });
  if (Math.abs(senza - ritardo) <= 3) {
    throw new Error('anche senza PHAT esce giusto (' + senza + '): PHAT non serve più');
  }
});

console.log('\nMisura: magnitudo, fase, coerenza\n');

prova('una campana di +6 dB a 1 kHz esce come +6 dB a 1 kHz', function () {
  var fs = 48000, n = 1 << 17;
  var rif = rumore(n, 5);
  var mic = campana(rif, fs, 1000, 6, 1.4);
  var m = MISURA.crea({ fs: fs, dimensione: 8192 });
  m.aggiungi(rif, mic);
  var r = m.risultato();
  vicino(r.dbA(1000), 6, 0.7, 'guadagno a 1 kHz');
  vicino(r.dbA(100), 0, 0.7, 'guadagno a 100 Hz (deve restare piatto)');
  vicino(r.dbA(10000), 0, 0.7, 'guadagno a 10 kHz (deve restare piatto)');
});

prova('con lo stesso segnale la coerenza è piena', function () {
  var fs = 48000, n = 1 << 16, rif = rumore(n, 8);
  var m = MISURA.crea({ fs: fs, dimensione: 8192 });
  m.aggiungi(rif, rif);
  var r = m.risultato();
  if (r.coerenzaA(1000) < 0.98) throw new Error('coerenza a 1 kHz solo ' + r.coerenzaA(1000));
});

prova('LA PROVA CHE CONTA: su rumore scorrelato la coerenza crolla', function () {
  /* Se questa non crolla, il calcolo è sbagliato e la pagina disegnerebbe
     curve inventate senza che nessuno se ne accorga. */
  var fs = 48000, n = 1 << 17;
  var rif = rumore(n, 5), mic = rumore(n, 5000);
  var m = MISURA.crea({ fs: fs, dimensione: 8192 });
  m.aggiungi(rif, mic);
  var r = m.risultato();
  var c = r.coerenzaA(1000);
  if (c > 0.25) throw new Error('coerenza ' + Math.round(c * 100) / 100 + ': troppo alta per due rumori estranei');
});

prova('mezzo segnale e mezzo rumore: la coerenza sta in mezzo', function () {
  var fs = 48000, n = 1 << 17;
  var rif = rumore(n, 5), sporco = rumore(n, 777);
  var mic = new Float32Array(n);
  for (var i = 0; i < n; i++) mic[i] = rif[i] + sporco[i];
  var m = MISURA.crea({ fs: fs, dimensione: 8192 });
  m.aggiungi(rif, mic);
  var c = m.risultato().coerenzaA(1000);
  if (c < 0.35 || c > 0.75) throw new Error('coerenza ' + Math.round(c * 100) / 100 + ': attesa intorno a 0,5');
});

console.log('\nConsigli sull\'equalizzatore\n');

/* Una curva finta con dentro quello che voglio farmi trovare. Coerenza piena
   ovunque tranne dove serve provare il contrario. */
function curvaFinta(fn, coerenza) {
  var out = [];
  for (var i = 0; i < 400; i++) {
    var f = 20 * Math.pow(1000, i / 399);           // 20 Hz → 20 kHz
    out.push({ f: f, db: fn(f), coerenza: coerenza ? coerenza(f) : 1 });
  }
  return out;
}

function campanaDb(f, f0, db, ottave) {
  var x = Math.log2(f / f0) / ottave;
  return db * Math.exp(-x * x * 4);
}

prova('una gobba di 6 dB a 200 Hz diventa «togli 6 dB a 200 Hz»', function () {
  var c = CONSIGLI.dai(curvaFinta(function (f) { return campanaDb(f, 200, 6, 0.5); }));
  var t = c.mosse.filter(function (m) { return m.tipo === 'togli'; });
  if (!t.length) throw new Error('nessun taglio consigliato');
  vicino(t[0].hz, 200, 25, 'la frequenza del taglio');
  vicino(t[0].db, 6, 1, 'i decibel da togliere');
});

prova('un buco STRETTO non si riempie: si dice di non toccarlo', function () {
  var c = CONSIGLI.dai(curvaFinta(function (f) { return campanaDb(f, 1200, -12, 0.12); }));
  var alza = c.mosse.filter(function (m) { return m.tipo === 'alza'; });
  var stop = c.note.filter(function (n) { return n.tipo === 'non-toccare'; });
  if (alza.length) throw new Error('consiglia di alzare dentro una cancellazione');
  if (!stop.length) throw new Error('non avverte che il buco stretto va lasciato stare');
});

prova('un avvallamento LARGO invece si può correggere', function () {
  var c = CONSIGLI.dai(curvaFinta(function (f) { return campanaDb(f, 3000, -6, 1.2); }));
  var alza = c.mosse.filter(function (m) { return m.tipo === 'alza'; });
  if (!alza.length) throw new Error('un avvallamento largo si corregge, e non lo dice');
  if (alza[0].db > 4) throw new Error('alza di ' + alza[0].db + ' dB: troppo, mangia margine');
});

prova('dove la coerenza è bassa non si consiglia niente', function () {
  var c = CONSIGLI.dai(curvaFinta(
    function (f) { return campanaDb(f, 200, 8, 0.5); },
    function (f) { return f < 400 ? 0.2 : 1; }        // sotto i 400 Hz non sappiamo
  ));
  var t = c.mosse.filter(function (m) { return m.tipo === 'togli' && m.hz < 400; });
  if (t.length) throw new Error('consiglia un taglio dove la misura non è affidabile');
});

prova('CONTROPROVA: la stessa gobba, con coerenza buona, viene consigliata', function () {
  /* Senza questa, la prova di sopra passerebbe anche se i consigli non
     uscissero mai — per esempio se avessi sbagliato la soglia in dB. */
  var c = CONSIGLI.dai(curvaFinta(function (f) { return campanaDb(f, 200, 8, 0.5); }));
  var t = c.mosse.filter(function (m) { return m.tipo === 'togli' && m.hz < 400; });
  if (!t.length) throw new Error('con coerenza piena non consiglia comunque niente: soglia sbagliata');
});

prova('una curva già piatta non fa dire niente', function () {
  var c = CONSIGLI.dai(curvaFinta(function () { return 0; }));
  if (c.mosse.length) throw new Error('inventa correzioni su una curva piatta');
});


console.log('\nCurva obiettivo e media fra posizioni\n');

/* Una misura finta con una campana nota, per le prove sulla media. */
function finta(fs, n, f0, db) {
  var rif = rumore(n, 5 + Math.abs(Math.round(f0 + db)));
  var mic = campana(rif, fs, f0, db, 1.0);
  var m = MISURA.crea({ fs: fs, dimensione: 8192 });
  m.aggiungi(rif, mic);
  return m.risultato();
}

prova('la curva «live» alza i bassi e scende in alto', function () {
  var b = OBIETTIVO.a('live', 50), m = OBIETTIVO.a('live', 1000), a = OBIETTIVO.a('live', 10000);
  if (!(b > m)) throw new Error('i bassi non stanno sopra i medi: ' + b + ' vs ' + m);
  if (!(a < m)) throw new Error('gli acuti non scendono: ' + a + ' vs ' + m);
  vicino(m, 0, 0.01, 'i medi devono essere il riferimento');
});

prova('la curva «piatta» è piatta davvero', function () {
  [20, 100, 1000, 10000, 20000].forEach(function (f) {
    vicino(OBIETTIVO.a('piatta', f), 0, 0.001, 'a ' + f + ' Hz');
  });
});

prova('l\'interpolazione va in ottave, non in hertz', function () {
  /* Va provata dove la curva PENDE: fra 300 e 1000 Hz è piatta e qualunque
     interpolazione darebbe lo stesso numero — il primo tentativo cadeva lì e
     falliva per colpa della prova, non del codice.

     Fra 4000 (−2,5 dB) e 10000 (−5 dB) il mezzo percettivo è la media
     geometrica, 6325 Hz, e lì il valore deve essere esattamente a metà:
     −3,75 dB. Interpolando in hertz uscirebbe −3,47. */
  vicino(OBIETTIVO.a('live', Math.sqrt(4000 * 10000)), -3.75, 0.05,
         'il valore a metà ottava fra 4 e 10 kHz');
});

prova('contro il piatto, un avvallamento resta un avvallamento', function () {
  var s = OBIETTIVO.scarto('piatta', curvaFinta(function (f) { return campanaDb(f, 4000, -6, 1.2); }));
  var p = s.filter(function (x) { return x.f > 3500 && x.f < 4500; })[0];
  if (p.db > -3) throw new Error('lo scarto dal piatto non vede l\'avvallamento: ' + p.db);
});

prova('LA COSA CHE CAMBIA TUTTO: contro «live» quell\'avvallamento non c\'è', function () {
  /* Un impianto che scende in alto è GIUSTO per il live. Contro il piatto
     sembra da correggere; contro il bersaglio vero non lo è. Senza curva
     obiettivo i consigli direbbero di alzare gli acuti — l'errore che rende
     un impianto stancante. */
  var curva = curvaFinta(function (f) { return OBIETTIVO.a('live', f); });
  OBIETTIVO.scarto('live', curva).forEach(function (p) {
    if (Math.abs(p.db) > 0.5) {
      throw new Error('a ' + Math.round(p.f) + ' Hz lo scarto è ' + p.db.toFixed(1) +
                      ': una curva uguale al bersaglio non deve avere scarti');
    }
  });
});

prova('la media fra due posizioni sta in mezzo', function () {
  var fs = 48000, n = 1 << 16;
  var m = MISURA.media([finta(fs, n, 1000, 6), finta(fs, n, 1000, -6)]);
  vicino(m.dbA(1000), 0, 2.5, 'la media fra +6 e −6 dB');
  if (m.posizioni !== 2) throw new Error('non conta le posizioni');
});

prova('SI MEDIANO LE POTENZE: un buco in UNA posizione non affossa la media', function () {
  /* La trappola di questo conto. Un buco profondissimo in un punto solo, in
     media di decibel, tirerebbe giù il risultato di una decina di dB, e uno
     correggerebbe un problema che a due metri non esiste. In potenza pesa per
     quello che è: quasi niente. Se questa prova fallisce con un numero molto
     negativo, sta mediando i logaritmi. */
  var fs = 48000, n = 1 << 16;
  var m = MISURA.media([finta(fs, n, 1000, 0), finta(fs, n, 1000, 0), finta(fs, n, 1000, -30)]);
  var r = m.dbA(1000);
  if (r < -6) {
    throw new Error('media a ' + r.toFixed(1) + ' dB: sta mediando i decibel, non le ' +
                    'potenze — un buco in un punto solo affossa tutta la sala');
  }
});

prova('la risposta all\'impulso ha il picco dove arriva il suono', function () {
  var fs = 48000, n = 1 << 16, ritardo = 96;   // 2 ms
  var rif = rumore(n, 21);
  var mic = new Float32Array(n);
  for (var i = ritardo; i < n; i++) mic[i] = rif[i - ritardo];
  var m = MISURA.crea({ fs: fs, dimensione: 8192 });
  m.aggiungi(rif, mic);
  var ir = m.risultato().impulso(4096);
  var piu = 0;
  for (i = 1; i < ir.campioni.length; i++) {
    if (Math.abs(ir.campioni[i]) > Math.abs(ir.campioni[piu])) piu = i;
  }
  vicino(piu, ritardo, 2, 'il picco della risposta all\'impulso');
});


prova('MAI alzare i bassi profondi: si rompono i woofer', function () {
  /* Il difetto che ha trovato l'autoprova, non io: consigliava «alza di 3,5 dB
     a 23 Hz». Sotto gli 80 Hz il diffusore ha finito la corsa e il segnale in
     più diventa calore ed escursione. È il modo più comune di distruggere un
     impianto credendo di migliorarlo. */
  var c = CONSIGLI.dai(curvaFinta(function (f) { return campanaDb(f, 35, -8, 1.5); }));
  var alza = c.mosse.filter(function (m) { return m.tipo === 'alza'; });
  if (alza.length) {
    throw new Error('consiglia di alzare a ' + alza[0].hz + ' Hz: si rompono i woofer');
  }
  if (!c.note.filter(function (n) { return n.tipo === 'non-alzare-bassi'; }).length) {
    throw new Error('non spiega perché quei bassi non si alzano');
  }
});

prova('niente consigli fuori dalla banda utile', function () {
  /* A 20 kHz e a 25 Hz un consiglio non serve a nessuno: sotto un PA non
     arriva, sopra siamo al bordo del microfono e dell'udito. */
  var c = CONSIGLI.dai(curvaFinta(function (f) {
    return campanaDb(f, 19000, 8, 0.8) + campanaDb(f, 25, 8, 0.8);
  }));
  c.mosse.forEach(function (m) {
    if (m.hz > 16000 || m.hz < 40) {
      throw new Error('consiglia a ' + m.hz + ' Hz, fuori dalla banda in cui ha senso');
    }
  });
});

prova('CONTROPROVA: dentro la banda gli stessi difetti si consigliano', function () {
  /* Senza questa, il filtro di banda potrebbe zittire tutto e sembrerebbe che
     funzioni. */
  var c = CONSIGLI.dai(curvaFinta(function (f) { return campanaDb(f, 500, 8, 0.8); }));
  if (!c.mosse.filter(function (m) { return m.tipo === 'togli'; }).length) {
    throw new Error('non consiglia niente nemmeno a 500 Hz: il filtro di banda taglia troppo');
  }
});

console.log('\n' + passate + ' passate, ' + fallite + ' fallite\n');
process.exit(fallite ? 1 : 0);
