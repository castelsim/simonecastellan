/* Comprimi PDF — porta un documento sotto il peso che chiedono moduli, PEC e portali.

   Come funziona: ogni pagina viene ridisegnata a una risoluzione più bassa e
   salvata come JPEG dentro un PDF nuovo. È l'unica strada affidabile dentro un
   browser, e su un documento scansionato (che è già fatto di immagini) non si
   perde niente. Su un PDF nato digitale il testo diventa immagine: per questo,
   se il testo c'è, prima si avvisa. */

pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';

var targetKB = 5120;
var fileScelto = null;
var risultato = null;      // Uint8Array del PDF compresso
var nomeUscita = '';

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
var targetSeg  = document.getElementById('targetSeg');

function pesa(b) {
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return Math.round(b / 1024) + ' KB';
  return (Math.round(b / 1024 / 102.4) / 10).toString().replace('.', ',') + ' MB';
}

function mostra(el, si) { el.classList.toggle('hidden', !si); }

function avanzamento(testo, frazione) {
  statusText.textContent = testo;
  progressBar.style.width = Math.round(Math.max(0, Math.min(1, frazione)) * 100) + '%';
}

// --- Analisi ---------------------------------------------------------------

/* Qualche carattere lo restituisce anche una scansione passata per l'OCR: la
   soglia serve a non spaventare per tre parole storte. */
async function haTesto(doc) {
  var pagine = Math.min(doc.numPages, 3), caratteri = 0;
  for (var i = 1; i <= pagine; i++) {
    var tc = await (await doc.getPage(i)).getTextContent();
    for (var j = 0; j < tc.items.length; j++) caratteri += (tc.items[j].str || '').trim().length;
  }
  return caratteri > 120;
}

// --- Compressione ----------------------------------------------------------

function jpegDaCanvas(canvas, q) {
  return new Promise(function (r) { canvas.toBlob(function (b) { r(b); }, 'image/jpeg', q); });
}

async function rasterizza(doc, dpi, qualita, giro, giri) {
  var nuovo = await PDFLib.PDFDocument.create();
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
    var buf = new Uint8Array(await blob.arrayBuffer());
    var img = await nuovo.embedJpg(buf);
    var p = nuovo.addPage([vp1.width, vp1.height]);
    p.drawImage(img, { x: 0, y: 0, width: vp1.width, height: vp1.height });

    c.width = c.height = 0;                            // libero subito: i PDF lunghi mangiano memoria
    avanzamento('Pagina ' + i + ' di ' + doc.numPages + (giri > 1 ? ' · passata ' + giro + ' di ' + giri : ''),
                ((giro - 1) + i / doc.numPages) / giri);
  }
  return await nuovo.save();
}

/* Al massimo tre passate: la prima misura, la seconda corregge in base a quanto
   si è sbagliato, la terza è l'ultima spiaggia. Rifare venti pagine sei volte
   costerebbe minuti per guadagnare qualche decina di kilobyte. */
async function comprimi(doc, limite) {
  var migliore = await rasterizza(doc, 150, 0.72, 1, 3);
  if (migliore.length <= limite) return migliore;

  var eccesso = migliore.length / limite;
  var dpi = Math.max(72, Math.round(150 / Math.sqrt(eccesso)));
  var q = Math.max(0.32, Math.min(0.72, 0.72 / (eccesso > 2 ? 1.6 : 1.25)));
  var secondo = await rasterizza(doc, dpi, q, 2, 3);
  if (secondo.length < migliore.length) migliore = secondo;
  if (migliore.length <= limite) return migliore;

  var terzo = await rasterizza(doc, 72, 0.3, 3, 3);
  if (terzo.length < migliore.length) migliore = terzo;
  return migliore;
}

// --- Flusso ----------------------------------------------------------------

async function apri(file) {
  fileScelto = file;
  risultato = null;
  mostra(warnBox, false);
  mostra(result, false);
  mostra(statusBox, true);
  avanzamento('Apro il documento…', 0.03);

  try {
    var buf = await file.arrayBuffer();
    var doc = await pdfjsLib.getDocument({ data: buf }).promise;
    window.__doc = doc;
    if (await haTesto(doc)) {
      mostra(statusBox, false);
      mostra(warnBox, true);        // decide l'utente: qui si perde qualcosa
      return;
    }
    await lavora(doc);
  } catch (e) {
    mostra(statusBox, false);
    mostra(result, true);
    document.getElementById('row').classList.add('ko');
    fName.textContent = file.name;
    fState.textContent = 'documento non leggibile (protetto da password?)';
    mostra(shareBtn, false);
    downloadBtn.classList.add('hidden');
  }
}

async function lavora(doc, forza) {
  mostra(warnBox, false);
  var limite = targetKB * 1024;
  var prima = fileScelto.size;
  nomeUscita = fileScelto.name.replace(/\.pdf$/i, '') + ' (leggero).pdf';

  /* Se sta già sotto il limite non si tocca: ricomprimerlo lo peggiorerebbe e
     basta — un JPEG rifatto da un JPEG perde qualità e può perfino crescere
     (provato: 1,7 MB diventavano 2,3 MB). Chi vuole rimpicciolirlo comunque
     ha il pulsante. */
  if (!forza && prima <= limite) {
    mostra(statusBox, false);
    mostra(result, true);
    document.getElementById('row').classList.remove('ko');
    fName.textContent = fileScelto.name;
    fState.innerHTML = '<b>' + pesa(prima) + '</b> · è già sotto il limite di ' + pesa(limite) + ': non serve toccarlo';
    risultato = null;
    downloadBtn.classList.add('hidden');
    mostra(shareBtn, false);
    mostra(forceBtn, true);
    return;
  }

  mostra(forceBtn, false);
  mostra(result, false);
  mostra(statusBox, true);
  var bytes = await comprimi(doc, limite);

  var testo, dopo = bytes.length;
  if (dopo >= prima) {
    // Comprimendo si è ottenuto un file più grosso: tengo l'originale.
    risultato = new Uint8Array(await fileScelto.arrayBuffer());
    nomeUscita = fileScelto.name;
    testo = pesa(prima) + ' · non si guadagna niente, questo PDF è già al minimo';
  } else {
    risultato = bytes;
    var risparmio = Math.round((1 - dopo / prima) * 100);
    testo = pesa(prima) + ' → <b>' + pesa(dopo) + '</b>';
    testo += (dopo > limite) ? ' · più giù non scende' : ' · −' + risparmio + '%';
  }

  mostra(statusBox, false);
  mostra(result, true);
  document.getElementById('row').classList.remove('ko');
  fName.textContent = nomeUscita;
  fState.innerHTML = testo;
  downloadBtn.classList.remove('hidden');
  mostra(shareBtn, !!condivisibile());
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

document.getElementById('goAnyway').addEventListener('click', function () { lavora(window.__doc); });
forceBtn.addEventListener('click', function () { lavora(window.__doc, true); });
document.getElementById('cancelBtn').addEventListener('click', function () {
  mostra(warnBox, false);
  fileInput.value = '';
});

resetBtn.addEventListener('click', function () {
  risultato = null; fileScelto = null;
  mostra(result, false); mostra(warnBox, false); mostra(statusBox, false);
  fileInput.value = '';
});

// --- Ingresso file ---------------------------------------------------------

function accetta(list) {
  var f = [].slice.call(list).filter(function (x) {
    return x.type === 'application/pdf' || /\.pdf$/i.test(x.name);
  })[0];
  if (f) apri(f);
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
  // Limite cambiato a lavoro fatto: si rifà sullo stesso documento.
  if (window.__doc && risultato) lavora(window.__doc);
});
