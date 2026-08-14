/* Comprimi PDF — porta un documento sotto il peso che chiedono moduli, PEC e portali.

   Come funziona, in ordine di rispetto per il documento:

   1. PRIMA STRADA (quella buona): si toccano solo le immagini dentro al PDF.
      Ogni foto o scansione viene ridisegnata più piccola e ricompressa, mentre
      testo, font e disegni vettoriali restano esattamente dove sono: il
      documento resta selezionabile, ricercabile e nitido alla stampa. Nel peso
      di un PDF sono quasi sempre le immagini a fare il grosso.

   2. ULTIMA SPIAGGIA (solo se la chiedi): trasformare ogni pagina in una
      fotografia. Comprime di più ma il testo smette di essere testo. Resta
      dietro un pulsante, con l'avviso davanti. */

pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
var L = PDFLib;

var targetKB = 5120;
var fileScelto = null;
var bytesOriginali = null;   // Uint8Array del file com'è arrivato
var risultato = null;        // Uint8Array di ciò che si scarica
var nomeUscita = '';
var docTesto = null;         // documento aperto con pdf.js, per la rasterizzazione

var dropZone   = document.getElementById('dropZone');
var pickBtn    = document.getElementById('pickBtn');
var fileInput  = document.getElementById('fileInput');
var warnBox    = document.getElementById('warnBox');
// statusBox, non 'status': una variabile globale di nome status finisce su
// window.status, che accetta solo stringhe — l'elemento veniva convertito in
// testo e ogni classList.toggle esplodeva (stesso inciampo evitato in audio-mp3).
var statusBox  = document.getElementById('status');
var statusText = document.getElementById('statusText');
var progressBar= document.getElementById('progressBar');
var result     = document.getElementById('result');
var fName      = document.getElementById('fName');
var fState     = document.getElementById('fState');
var shareBtn   = document.getElementById('shareBtn');
var downloadBtn= document.getElementById('downloadBtn');
var resetBtn   = document.getElementById('resetBtn');
var forceBtn   = document.getElementById('forceBtn');
var rasterBtn  = document.getElementById('rasterBtn');
var targetSeg  = document.getElementById('targetSeg');
var avvisoFile = document.getElementById('avvisoFile');

/* Oltre questo peso non si prova nemmeno. Non è un capriccio: un PDF da 300 MB
   va letto tutto in memoria e poi riscritto, e il browser resta fermo su «Apro
   il documento…» senza mai arrivare in fondo (misurato: oltre un minuto senza
   una parola). Meglio dirlo in mezzo secondo. */
var PESO_MAX = 150 * 1024 * 1024;

// Se sono arrivati più file insieme, la frase che lo dice: sopravvive
// all'apertura del primo, ma cede il posto a un errore vero.
var notaScelta = '';

function pesa(b) {
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return Math.round(b / 1024) + ' KB';
  return (Math.round(b / 1024 / 102.4) / 10).toString().replace('.', ',') + ' MB';
}

function mostra(el, si) { if (el) el.classList.toggle('hidden', !si); }

/* Un messaggio sopra il riquadro, per le cose che si capiscono prima ancora di
   aprire il file. Se il posto per scriverlo non c'è, si ripiega sulla riga del
   risultato: l'importante è che qualcosa venga detto. */
function avvisa(testo) {
  if (avvisoFile) {
    avvisoFile.textContent = testo || '';
    mostra(avvisoFile, !!testo);
    if (testo) { mostra(statusBox, false); mostra(warnBox, false); }
  } else if (testo) {
    risultato = null;
    mostraEsito('', testo, { errore: true });
  }
}

function avanzamento(testo, frazione) {
  statusText.textContent = testo;
  progressBar.style.width = Math.round(Math.max(0, Math.min(1, frazione)) * 100) + '%';
}

// --- Strada 1: si toccano solo le immagini ---------------------------------

function nome(k) { return L.PDFName.of(k); }
function valore(dict, k) { var v = dict.get(nome(k)); return v === undefined ? null : v; }

/* Le maschere di trasparenza sono immagini anche loro, ma ricomprimerle con
   perdita sporca i bordi di ciò che mascherano: si lasciano stare. */
function refDelleMaschere(doc) {
  var maschere = {};
  doc.context.enumerateIndirectObjects().forEach(function (v) {
    var obj = v[1];
    if (!obj || !obj.dict) return;
    ['SMask', 'Mask'].forEach(function (k) {
      var m = obj.dict.get && obj.dict.get(nome(k));
      if (m && m.toString) maschere[m.toString()] = true;
    });
  });
  return maschere;
}

function jpegDaCanvas(canvas, q) {
  return new Promise(function (r) { canvas.toBlob(function (b) { r(b); }, 'image/jpeg', q); });
}

/* Rifà una singola immagine: la rimpicciolisce fino a latoMax e la salva in
   JPEG. Restituisce null se il browser non sa aprirla (JPEG 2000, CMYK
   esotici, fax in bianco e nero): in quel caso l'originale resta intatto,
   che è sempre meglio di un'immagine rovinata. */
async function rifaiImmagine(stream, latoMax, qualita) {
  var d = stream.dict;
  var filtro = String(valore(d, 'Filter') || '');
  var w = Number(valore(d, 'Width')), h = Number(valore(d, 'Height'));
  if (!w || !h) return null;
  if (valore(d, 'ImageMask')) return null;                 // stencil in bianco e nero
  if (filtro.indexOf('DCTDecode') === -1) return null;      // per ora solo JPEG: è il 90% del peso vero

  var bmp;
  try {
    bmp = await createImageBitmap(new Blob([stream.contents], { type: 'image/jpeg' }));
  } catch (e) { return null; }

  var scala = Math.min(1, latoMax / Math.max(bmp.width, bmp.height));
  // Se non c'è niente da guadagnare né in dimensioni né in qualità, la si lascia com'è.
  var cw = Math.max(1, Math.round(bmp.width * scala));
  var ch = Math.max(1, Math.round(bmp.height * scala));
  var c = document.createElement('canvas');
  c.width = cw; c.height = ch;
  var g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, cw, ch);
  g.drawImage(bmp, 0, 0, cw, ch);
  bmp.close && bmp.close();

  var blob = await jpegDaCanvas(c, qualita);
  c.width = c.height = 0;
  var bytes = new Uint8Array(await blob.arrayBuffer());
  if (bytes.length >= stream.contents.length) return null;  // ci si guadagna solo se pesa meno

  return { bytes: bytes, w: cw, h: ch };
}

async function comprimiImmagini(latoMax, qualita, quale, quante) {
  var doc = await L.PDFDocument.load(bytesOriginali.slice(0), { updateMetadata: false });
  var maschere = refDelleMaschere(doc);
  var voci = doc.context.enumerateIndirectObjects();
  var candidate = voci.filter(function (v) {
    var o = v[1];
    if (!(o instanceof L.PDFRawStream)) return false;
    var s = valore(o.dict, 'Subtype');
    return !!(s && s.asString && s.asString() === '/Image') && !maschere[v[0].toString()];
  });

  var fatte = 0;
  for (var i = 0; i < candidate.length; i++) {
    var ref = candidate[i][0], stream = candidate[i][1];
    var nuova = await rifaiImmagine(stream, latoMax, qualita);
    if (nuova) {
      var nd = doc.context.obj({});
      nd.set(nome('Type'), nome('XObject'));
      nd.set(nome('Subtype'), nome('Image'));
      nd.set(nome('Width'), L.PDFNumber.of(nuova.w));
      nd.set(nome('Height'), L.PDFNumber.of(nuova.h));
      nd.set(nome('ColorSpace'), nome('DeviceRGB'));
      nd.set(nome('BitsPerComponent'), L.PDFNumber.of(8));
      nd.set(nome('Filter'), nome('DCTDecode'));
      // La maschera di trasparenza, se c'era, continua a valere: sta in un
      // oggetto suo e il PDF la ridimensiona da solo.
      var sm = valore(stream.dict, 'SMask');
      if (sm) nd.set(nome('SMask'), sm);
      doc.context.assign(ref, L.PDFRawStream.of(nd, nuova.bytes));
      fatte++;
    }
    avanzamento('Immagine ' + (i + 1) + ' di ' + candidate.length +
                (quante > 1 ? ' · passata ' + quale + ' di ' + quante : ''),
                ((quale - 1) + (i + 1) / candidate.length) / quante);
  }
  var out = await doc.save({ useObjectStreams: true });
  return { bytes: out, immagini: candidate.length, rifatte: fatte };
}

/* Tre passate al massimo: la prima misura, la seconda corregge in base a
   quanto si è sbagliato, la terza stringe i denti. */
async function comprimiConservandoTesto(limite) {
  var giri = [[2000, 0.72], [1500, 0.55], [1100, 0.4]];
  var migliore = null, immagini = 0;
  for (var i = 0; i < giri.length; i++) {
    var r = await comprimiImmagini(giri[i][0], giri[i][1], i + 1, giri.length);
    immagini = r.immagini;
    if (!migliore || r.bytes.length < migliore.length) migliore = r.bytes;
    if (migliore.length <= limite) break;
    if (r.rifatte === 0) break;              // non c'è niente su cui lavorare
  }
  return { bytes: migliore, immagini: immagini };
}

// --- Ultima spiaggia: le pagine diventano fotografie ------------------------

async function rasterizza(doc, dpi, qualita, giro, giri) {
  var nuovo = await L.PDFDocument.create();
  var scala = dpi / 72;
  for (var i = 1; i <= doc.numPages; i++) {
    var page = await doc.getPage(i);
    var vp1 = page.getViewport({ scale: 1 });          // misure vere della pagina, in punti
    var vp = page.getViewport({ scale: scala });
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(vp.width));
    c.height = Math.max(1, Math.round(vp.height));
    var g = c.getContext('2d');
    // Il PDF può avere pagine trasparenti: senza fondo bianco escono nere.
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: g, viewport: vp }).promise;

    var blob = await jpegDaCanvas(c, qualita);
    var img = await nuovo.embedJpg(new Uint8Array(await blob.arrayBuffer()));
    var p = nuovo.addPage([vp1.width, vp1.height]);
    p.drawImage(img, { x: 0, y: 0, width: vp1.width, height: vp1.height });

    c.width = c.height = 0;                            // libero subito: i PDF lunghi mangiano memoria
    avanzamento('Pagina ' + i + ' di ' + doc.numPages + (giri > 1 ? ' · passata ' + giro + ' di ' + giri : ''),
                ((giro - 1) + i / doc.numPages) / giri);
  }
  return await nuovo.save();
}

async function comprimiRasterizzando(limite) {
  var migliore = await rasterizza(docTesto, 150, 0.72, 1, 3);
  if (migliore.length <= limite) return migliore;
  var eccesso = migliore.length / limite;
  var dpi = Math.max(72, Math.round(150 / Math.sqrt(eccesso)));
  var q = Math.max(0.32, Math.min(0.72, 0.72 / (eccesso > 2 ? 1.6 : 1.25)));
  var secondo = await rasterizza(docTesto, dpi, q, 2, 3);
  if (secondo.length < migliore.length) migliore = secondo;
  if (migliore.length <= limite) return migliore;
  var terzo = await rasterizza(docTesto, 72, 0.3, 3, 3);
  if (terzo.length < migliore.length) migliore = terzo;
  return migliore;
}

// --- Flusso ----------------------------------------------------------------

function mostraEsito(nomeFile, html, opzioni) {
  opzioni = opzioni || {};
  mostra(statusBox, false);
  mostra(warnBox, false);
  mostra(result, true);
  document.getElementById('row').classList.toggle('ko', !!opzioni.errore);
  fName.textContent = nomeFile;
  fState.innerHTML = html;
  mostra(downloadBtn, !!risultato);
  mostra(shareBtn, !!risultato && !!condivisibile());
  mostra(forceBtn, !!opzioni.forza);
  mostra(rasterBtn, !!opzioni.raster);
}

async function apri(file) {
  fileScelto = file;
  risultato = null;

  /* Due controlli che costano niente e si fanno prima di leggere il file: un
     documento vuoto e uno troppo pesante finivano tutti e due nello stesso
     messaggio sbagliato («protetto da password?»), o peggio in un'attesa senza
     fine. */
  if (file.size === 0) {
    mostra(statusBox, false);
    mostra(result, false);
    avvisa('Questo file è vuoto: dentro non c\'è niente. Riprova con il PDF giusto.');
    return;
  }
  if (file.size > PESO_MAX) {
    mostra(statusBox, false);
    mostra(result, false);
    avvisa('Questo PDF pesa ' + pesa(file.size) + ': troppo perché il browser lo apra senza bloccarsi. ' +
           'Il limite qui è ' + pesa(PESO_MAX) + '. Se sono tante pagine, dividilo in due e riprova.');
    return;
  }
  avvisa(notaScelta);

  // Il documento di prima va chiuso: pdf.js tiene un solo lavoratore in
  // sottofondo e i documenti dimenticati se lo mangiano.
  if (docTesto) { try { docTesto.destroy(); } catch (e) {} }
  docTesto = null;
  mostra(warnBox, false);
  mostra(result, false);
  mostra(statusBox, true);
  avanzamento('Apro il documento…', 0.03);

  try {
    bytesOriginali = new Uint8Array(await file.arrayBuffer());
    docTesto = await pdfjsLib.getDocument({ data: bytesOriginali.slice(0) }).promise;
    await lavora();
  } catch (e) {
    risultato = null;
    /* Prima finiva tutto sotto «protetto da password?», anche un file di testo
       rinominato .pdf: chi lo leggeva andava a cercare una password che non
       esisteva. I tre casi sono diversi e si distinguono. */
    var nomeErr = String((e && (e.name || e.message)) || '');
    var messaggio;
    if (/Password/i.test(nomeErr)) {
      messaggio = 'questo PDF è protetto da password: toglila e riprova';
    } else if (/InvalidPDF/i.test(nomeErr)) {
      messaggio = 'questo file non è un PDF, o è rovinato: apri il documento originale e salvalo di nuovo in PDF';
    } else {
      messaggio = 'non riesco ad aprire questo documento: prova a salvarlo di nuovo in PDF e riprova';
    }
    mostraEsito(file.name, messaggio, { errore: true });
  }
}

async function lavora(forza) {
  var limite = targetKB * 1024;
  var prima = fileScelto.size;
  nomeUscita = fileScelto.name.replace(/\.pdf$/i, '') + ' (leggero).pdf';

  /* Se sta già sotto il limite non si tocca: ricomprimere una seconda volta
     toglie qualità e può perfino far crescere il file. */
  if (!forza && prima <= limite) {
    risultato = null;
    mostraEsito(fileScelto.name,
      '<b>' + pesa(prima) + '</b> · è già sotto il limite di ' + pesa(limite) + ': non serve toccarlo',
      { forza: true });
    return;
  }

  mostra(result, false);
  mostra(statusBox, true);
  avanzamento('Cerco le immagini dentro il documento…', 0.05);

  var r = await comprimiConservandoTesto(limite);
  var dopo = r.bytes.length;

  if (r.immagini === 0) {
    risultato = null;
    mostraEsito(fileScelto.name,
      pesa(prima) + ' · qui dentro non ci sono immagini da alleggerire: è tutto testo, e il testo pesa già pochissimo',
      { raster: true });
    return;
  }

  if (dopo >= prima) {
    risultato = null;
    mostraEsito(fileScelto.name,
      pesa(prima) + ' · le immagini sono già al minimo: comprimerle ancora non farebbe guadagnare niente',
      { raster: true });
    return;
  }

  risultato = r.bytes;
  var risparmio = Math.round((1 - dopo / prima) * 100);
  var testo = pesa(prima) + ' → <b>' + pesa(dopo) + '</b> · −' + risparmio + '%';
  var sopra = dopo > limite;
  testo += sopra
    ? '<br><span class="f-hint">più giù non si scende senza toccare il testo</span>'
    : '<br><span class="f-hint">testo e disegni intatti: restano selezionabili</span>';
  mostraEsito(nomeUscita, testo, { raster: sopra });
}

/* La rasterizzazione la si chiede: prima l'avviso, poi si procede. */
async function viaRasterizzazione() {
  mostra(result, false);
  mostra(warnBox, false);
  mostra(statusBox, true);
  avanzamento('Trasformo le pagine in immagini…', 0.05);
  var bytes;
  try {
    bytes = await comprimiRasterizzando(targetKB * 1024);
  } catch (e) {
    // Senza questo, un errore qui lasciava la barra ferma per sempre e
    // l'utente davanti a una pagina che non diceva niente.
    risultato = null;
    mostraEsito(fileScelto.name, 'non sono riuscito a trasformare le pagine in immagini', { errore: true });
    return;
  }
  var prima = fileScelto.size, dopo = bytes.length;
  if (dopo >= prima) {
    risultato = new Uint8Array(bytesOriginali);
    nomeUscita = fileScelto.name;
    mostraEsito(nomeUscita, pesa(prima) + ' · non si guadagna niente nemmeno così: questo PDF è già al minimo');
    return;
  }
  risultato = bytes;
  nomeUscita = fileScelto.name.replace(/\.pdf$/i, '') + ' (immagini).pdf';
  var testo = pesa(prima) + ' → <b>' + pesa(dopo) + '</b> · −' + Math.round((1 - dopo / prima) * 100) + '%';
  testo += '<br><span class="f-hint">pagine trasformate in immagini: il testo non è più selezionabile</span>';
  mostraEsito(nomeUscita, testo);
}

function blobRisultato() { return new Blob([risultato], { type: 'application/pdf' }); }

function condivisibile() {
  try {
    if (!risultato) return null;
    var f = new File([blobRisultato()], nomeUscita, { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [f] })) return f;
  } catch (e) {}
  return null;
}

downloadBtn.addEventListener('click', function () {
  var url = URL.createObjectURL(blobRisultato());
  var a = document.createElement('a');
  a.href = url; a.download = nomeUscita;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
});

shareBtn.addEventListener('click', function () {
  var f = condivisibile();
  if (f) navigator.share({ files: [f], title: nomeUscita }).catch(function () {});
});

forceBtn.addEventListener('click', function () { lavora(true); });
rasterBtn.addEventListener('click', function () {
  mostra(result, false);
  mostra(warnBox, true);          // qui si perde qualcosa: lo si dice prima
});
document.getElementById('goAnyway').addEventListener('click', viaRasterizzazione);
document.getElementById('cancelBtn').addEventListener('click', function () {
  mostra(warnBox, false);
  mostra(result, true);
});

resetBtn.addEventListener('click', function () {
  risultato = null; fileScelto = null; bytesOriginali = null; docTesto = null;
  notaScelta = '';
  avvisa('');
  mostra(result, false); mostra(warnBox, false); mostra(statusBox, false);
  fileInput.value = '';
});

// --- Ingresso file ---------------------------------------------------------

function accetta(list) {
  var tutti = [].slice.call(list || []);
  // Dialogo aperto e chiuso senza scegliere: non è successo niente, e niente
  // va detto. Un messaggio d'errore qui sarebbe un rimprovero immotivato.
  if (!tutti.length) return;

  var pdf = tutti.filter(function (x) {
    return x.type === 'application/pdf' || /\.pdf$/i.test(x.name);
  });

  /* Qui stava il silenzio peggiore: un file che non era un PDF veniva scartato
     senza una parola, con la pagina identica a un secondo prima — e se c'era
     già un risultato di prima restava lì, a far credere che riguardasse il
     file appena scelto. */
  if (!pdf.length) {
    mostra(result, false);
    avvisa(tutti.length === 1
      ? 'Questo non è un PDF. Qui dentro vanno solo i file .pdf.'
      : 'Fra questi file non c\'è nessun PDF. Qui dentro vanno solo i file .pdf.');
    return;
  }

  // Uno alla volta: se ne arrivano tanti si lavora il primo, e lo si dice.
  notaScelta = pdf.length > 1
    ? 'Un PDF alla volta: ho preso «' + pdf[0].name + '», ' +
      (pdf.length === 2 ? 'l\'altro lo' : 'gli altri ' + (pdf.length - 1) + ' li') + ' puoi fare dopo.'
    : '';
  apri(pdf[0]);
}

pickBtn.addEventListener('click', function (e) { e.stopPropagation(); fileInput.click(); });
dropZone.addEventListener('click', function () { fileInput.click(); });
dropZone.addEventListener('keydown', function (e) {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
});
fileInput.addEventListener('change', function () { accetta(fileInput.files); fileInput.value = ''; });

['dragenter', 'dragover'].forEach(function (ev) {
  dropZone.addEventListener(ev, function (e) { e.preventDefault(); dropZone.classList.add('dragover'); });
});
['dragleave', 'drop'].forEach(function (ev) {
  dropZone.addEventListener(ev, function (e) { e.preventDefault(); dropZone.classList.remove('dragover'); });
});
dropZone.addEventListener('drop', function (e) { if (e.dataTransfer) accetta(e.dataTransfer.files); });
window.addEventListener('dragover', function (e) { e.preventDefault(); });
window.addEventListener('drop', function (e) { e.preventDefault(); });

targetSeg.addEventListener('click', function (e) {
  var b = e.target.closest('.seg-btn');
  if (!b) return;
  targetKB = Number(b.dataset.kb);
  [].forEach.call(targetSeg.querySelectorAll('.seg-btn'), function (x) { x.classList.toggle('active', x === b); });
  if (bytesOriginali) lavora();          // limite cambiato: si rifanno i conti sullo stesso file
});
