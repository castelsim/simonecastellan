/* Bando in chiaro — da un PDF di quaranta pagine a una scheda leggibile.

   Il lavoro vero di questo strumento è doppio e sta tutto prima dell'assistente:

   1. tirare fuori il testo dal PDF senza mandarlo da nessuna parte (pdf.js
      gira nel browser, il file resta sul dispositivo);
   2. scrivere le istruzioni giuste. È la parte che nessuno ha voglia di fare
      e che decide la qualità della risposta: voci fisse, divieto esplicito di
      inventare, obbligo di scrivere «non indicato» dove il dato manca.

   Il testo non viaggia dentro l'indirizzo — un bando supera di molto la
   lunghezza che un URL regge — quindi finisce negli appunti e lo incolla
   l'utente. Due gesti invece di uno, ma funziona sempre. */

/* ── pdf.js arriva quando serve, non prima ─────────────────────────────────
   Erano 313 KB scaricati aprendo la pagina — nove volte il peso di tutto il
   resto — pagati anche da chi incolla il testo e un PDF non lo apre mai.
   Stessa cura già applicata al compressore: la libreria si carica al primo
   file scelto. Se la rete cade a metà, la promessa si azzera, altrimenti lo
   strumento resterebbe rotto fino al ricaricamento della pagina. */
var pdfPronto = null;

function preparaPdfJs() {
  if (pdfPronto) return pdfPronto;
  pdfPronto = new Promise(function (ok, no) {
    if (typeof pdfjsLib !== 'undefined') return ok();
    var s = document.createElement('script');
    s.src = '/comprimi-pdf/vendor/pdf.min.js';
    s.onload = ok;
    s.onerror = function () { no(new Error('pdf.min.js')); };
    document.head.appendChild(s);
  }).then(function () {
    if (typeof pdfjsLib === 'undefined') throw new Error('pdf.js caricato ma non disponibile');
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/comprimi-pdf/vendor/pdf.worker.min.js';
  }).catch(function (e) {
    pdfPronto = null;
    throw e;
  });
  return pdfPronto;
}

var MAX_CARATTERI = 45000;   // oltre, conviene tagliare: nessun assistente legge bene un muro

var dropZone  = document.getElementById('dropZone');
var pickBtn   = document.getElementById('pickBtn');
var fileInput = document.getElementById('fileInput');
var testo     = document.getElementById('testo');
var conta     = document.getElementById('conta');
var statusBox = document.getElementById('status');
var statusText= document.getElementById('statusText');
var erroreBox = document.getElementById('error');
var erroreMsg = document.getElementById('erroreMsg');
var apriBtn   = document.getElementById('apriBtn');
var copiaBtn  = document.getElementById('copiaBtn');
var anteprima = document.getElementById('anteprimaPrompt');
var toast     = document.getElementById('toast');

function mostra(el, si) { if (el) el.classList.toggle('hidden', !si); }

function avvisa(t) {
  toast.textContent = t;
  toast.classList.add('show');
  setTimeout(function () { toast.classList.remove('show'); }, 1800);
}

/* Le istruzioni. Sono la parte che vale: senza, si ottiene un riassunto
   generico; con, una scheda che si legge in trenta secondi. */
var ISTRUZIONI =
  'Sei davanti al testo di un bando pubblico italiano. Riscrivilo come una scheda che si legge ' +
  'in trenta secondi, usando esattamente queste voci, in questo ordine:\n\n' +
  'COS\'È\nA CHI È RIVOLTO\nCOSA OFFRE\nREQUISITI\nSCADENZA\nCOME PARTECIPARE\nLINK\nCONTATTI\n\n' +
  'Regole:\n' +
  '- Usa parole di tutti i giorni: niente «di cui al comma», niente «il sottoscritto».\n' +
  '- Ogni voce sta in poche righe. Elenchi puntati dove aiutano.\n' +
  '- Non inventare NULLA. Se un\'informazione non è nel testo, scrivi «non indicato».\n' +
  '- La scadenza riportala esattamente come sta scritta, con l\'ora se c\'è.\n' +
  '- Se ci sono più scadenze o più graduatorie, dillo invece di sceglierne una.\n' +
  '- Alla fine aggiungi una riga «DA VERIFICARE NEL DOCUMENTO» con i due o tre punti che ' +
  'conviene rileggere per intero prima di partecipare.\n\n' +
  'Ecco il testo del bando:\n\n';

function prompt() {
  return ISTRUZIONI + testo.value.trim();
}

// toLocaleString non mette sempre i separatori (dipende dai dati di lingua
// che il browser si porta dietro): meglio farlo a mano e sapere cosa esce.
function migliaia(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function aggiorna() {
  var n = testo.value.trim().length;
  var pronto = n > 200;
  apriBtn.disabled = !pronto;
  copiaBtn.disabled = !pronto;

  if (!n) conta.textContent = '';
  else if (!pronto) conta.textContent = n + ' caratteri: sembra poco, incolla il testo del bando.';
  else if (n > MAX_CARATTERI) conta.textContent = migliaia(n) +
    ' caratteri: è tanto. Se la risposta viene troncata, riprova tenendo solo le pagine che contano.';
  else conta.textContent = migliaia(n) + ' caratteri, pronti.';
  conta.classList.toggle('avviso', n > MAX_CARATTERI);
}

testo.addEventListener('input', aggiorna);

// --- Estrazione dal PDF -----------------------------------------------------

async function daPdf(file) {
  mostra(erroreBox, false);
  mostra(statusBox, true);
  statusText.textContent = 'Preparo il lettore di PDF…';

  try {
    await preparaPdfJs();
  } catch (e) {
    mostra(statusBox, false);
    erroreMsg.textContent = 'Non sono riuscito a caricare il lettore di PDF. Controlla la connessione e riprova, ' +
                            'oppure incolla il testo qui sotto.';
    return mostra(erroreBox, true);
  }

  statusText.textContent = 'Apro il PDF…';

  var doc;
  try {
    var buf = await file.arrayBuffer();
    doc = await pdfjsLib.getDocument({ data: buf }).promise;
  } catch (e) {
    mostra(statusBox, false);
    erroreMsg.textContent = 'Non riesco ad aprire questo PDF: potrebbe essere protetto da password.';
    return mostra(erroreBox, true);
  }

  var pezzi = [];
  for (var i = 1; i <= doc.numPages; i++) {
    statusText.textContent = 'Leggo la pagina ' + i + ' di ' + doc.numPages + '…';
    var pagina = await doc.getPage(i);
    var tc = await pagina.getTextContent();
    // Gli spazi di fine riga li perde pdf.js: si ricompongono dagli elementi.
    var riga = tc.items.map(function (it) { return it.str; }).join(' ').replace(/\s+/g, ' ').trim();
    if (riga) pezzi.push(riga);
  }
  await doc.destroy();
  mostra(statusBox, false);

  var tutto = pezzi.join('\n\n');
  /* La soglia va rapportata alle pagine, non fissa: un avviso di una pagina
     sola ha poco testo ma ce l'ha, e con una soglia unica veniva scambiato
     per una scansione — con un messaggio pure sbagliato. In una scansione
     vera di testo non ce n'è quasi per niente. */
  if (tutto.replace(/\s/g, '').length < 25 * doc.numPages) {
    erroreMsg.textContent = 'Dentro questo PDF non c\'è testo da estrarre: le pagine sono ' +
      'immagini, cioè una scansione. Servirebbe un riconoscimento del testo, che qui non faccio.';
    return mostra(erroreBox, true);
  }

  testo.value = tutto;
  aggiorna();
  avvisa('Testo estratto da ' + doc.numPages + (doc.numPages === 1 ? ' pagina' : ' pagine'));
  testo.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// --- Uscite -----------------------------------------------------------------

/* Due strade, in quest'ordine: la moderna, e se il browser la rifiuta —
   succede senza https, o quando i permessi sono chiusi — quella vecchia con
   la casella di testo nascosta. Prima il ripiego non scattava mai, perché il
   rifiuto della prima non veniva raccolto. */
function negliAppunti(t) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(t).catch(function () { return conCasella(t); });
  }
  return conCasella(t);
}

function conCasella(t) {
  return new Promise(function (risolvi, rifiuta) {
    var ta = document.createElement('textarea');
    ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
    ok ? risolvi() : rifiuta();
  });
}

copiaBtn.addEventListener('click', function () {
  negliAppunti(prompt()).then(
    function () { avvisa('Copiato: istruzioni e testo del bando'); },
    function () { avvisa('Non riesco a copiare: seleziona il testo a mano'); }
  );
});

apriBtn.addEventListener('click', function () {
  /* Prima si copia, poi si apre: se si aprisse prima, la finestra nuova
     toglierebbe il fuoco alla pagina e la copia negli appunti fallirebbe. */
  negliAppunti(prompt()).then(function () {
    avvisa('Copiato. Ora incolla nella chat che si è aperta.');
    setTimeout(function () { window.open('https://chatgpt.com/', '_blank', 'noopener'); }, 350);
  }, function () {
    avvisa('Non riesco a copiare da solo: usa «Copia soltanto» e incolla a mano');
  });
});

// --- Ingresso file ----------------------------------------------------------

function accetta(list) {
  var f = [].slice.call(list).filter(function (x) {
    return x.type === 'application/pdf' || /\.pdf$/i.test(x.name);
  })[0];
  if (f) daPdf(f);
  else {
    erroreMsg.textContent = 'Serve un PDF. Se hai un altro formato, incolla il testo qui sotto.';
    mostra(erroreBox, true);
  }
}

pickBtn.addEventListener('click', function (e) { e.stopPropagation(); fileInput.click(); });
dropZone.addEventListener('click', function () { fileInput.click(); });
dropZone.addEventListener('keydown', function (e) {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
});
fileInput.addEventListener('change', function () {
  if (fileInput.files[0]) accetta(fileInput.files);
  fileInput.value = '';
});

['dragenter', 'dragover'].forEach(function (ev) {
  dropZone.addEventListener(ev, function (e) { e.preventDefault(); dropZone.classList.add('dragover'); });
});
['dragleave', 'drop'].forEach(function (ev) {
  dropZone.addEventListener(ev, function (e) { e.preventDefault(); dropZone.classList.remove('dragover'); });
});
dropZone.addEventListener('drop', function (e) {
  if (e.dataTransfer && e.dataTransfer.files.length) accetta(e.dataTransfer.files);
});
window.addEventListener('dragover', function (e) { e.preventDefault(); });
window.addEventListener('drop', function (e) { e.preventDefault(); });

anteprima.textContent = ISTRUZIONI.trim();
aggiorna();
