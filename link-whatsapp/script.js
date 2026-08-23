/* Link WhatsApp — un indirizzo che apre la chat col messaggio già scritto.

   Serve perché la strada normale è assurda: per scriverti, uno deve copiare
   il numero, aprire la rubrica, salvarti, tornare su WhatsApp e cercarti. Tre
   quarti si fermano prima. Con un link tocca e scrive.

   La parte che sbaglia tutti è il numero. WhatsApp lo vuole in forma
   internazionale, senza il più, senza spazi e senza lo zero iniziale; in
   rubrica invece sta scritto in dieci modi diversi. Qui si incolla com'è. */

var FRASI = [
  'Ciao! Vorrei informazioni su…',
  'Ciao, ti scrivo dal sito.',
  'Buongiorno, sarei interessato a un preventivo.',
  'Ciao, sei disponibile per una data?'
];

// Lunghezze plausibili del numero, prefisso escluso. Servono a insospettirsi,
// non a rifiutare: le regole cambiano da paese a paese e non le so tutte.
var ATTESE = { '39': [9, 11], '41': [9, 9], '33': [9, 9], '49': [10, 11], '34': [9, 9], '44': [10, 10], '1': [10, 10] };

var paeseEl = document.getElementById('paese');
var numEl   = document.getElementById('num');
var numErr  = document.getElementById('numErr');
var msgEl   = document.getElementById('msg');
var chipsEl = document.getElementById('chips');
var linkEl  = document.getElementById('link');
var htmlEl  = document.getElementById('html');
var copiaBtn = document.getElementById('copia');
var provaBtn = document.getElementById('prova');
var qrBtn   = document.getElementById('qr');
var copiaHtmlBtn = document.getElementById('copiaHtml');
var toast   = document.getElementById('toast');

var linkPronto = '', htmlPronto = '';

function avvisa(t) {
  toast.textContent = t;
  toast.classList.add('show');
  setTimeout(function () { toast.classList.remove('show'); }, 1800);
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* Il numero si ripulisce senza indovinare. Il prefisso internazionale si toglie
   solo se chi scrive l'ha dichiarato con «+» o con «00»: un cellulare italiano
   può cominciare per 39 (3391234567) e tagliarlo a naso lo distruggerebbe. */
function pulisci(grezzo, paese) {
  var dichiarato = /^\s*(\+|00)/.test(grezzo);
  var cifre = grezzo.replace(/\D/g, '');

  if (cifre.indexOf('00') === 0) cifre = cifre.slice(2);
  if (dichiarato && cifre.indexOf(paese) === 0) cifre = cifre.slice(paese.length);

  // Lo zero della numerazione nazionale non esiste in forma internazionale.
  cifre = cifre.replace(/^0+/, '');
  return cifre;
}

/* Se uno incolla «+41 79…» con l'Italia scelta nel menu, il prefisso svizzero
   non viene tolto e finisce appiccicato dopo il 39: wa.me/3941791234567, un
   numero che non esiste. Lunghezza 11, dentro l'intervallo italiano, nessun
   avviso. Qui il paese dichiarato col «+» vince sul menu, e il menu lo segue. */
function paeseDichiarato(grezzo) {
  if (!/^\s*(\+|00)/.test(grezzo)) return null;
  var cifre = grezzo.replace(/\D/g, '').replace(/^00/, '');
  var trovato = null;
  [].forEach.call(paeseEl.options, function (o) {
    if (cifre.indexOf(o.value) === 0 && (!trovato || o.value.length > trovato.length)) {
      trovato = o.value;                 // il più lungo vince: 351 prima di 3
    }
  });
  return trovato;
}

/* Il primo avviso del giro è quello che si vede: vince la CAUSA, non
   l'ultimo controllo eseguito. Prima i tre controlli qui sotto chiamavano
   `avviso()` uno dopo l'altro e l'ultimo cancellava i precedenti — con un
   prefisso fuori elenco (per esempio +998) si leggeva «I numeri fissi non
   hanno WhatsApp», che è falso e manda a cercare il problema dalla parte
   sbagliata, mentre il messaggio giusto era già stato scritto e buttato via. */
var dettoInQuestoGiro = false;

function costruisci() {
  var grezzo = numEl.value;
  numErr.classList.add('hidden');
  dettoInQuestoGiro = false;

  if (!grezzo.trim()) return null;

  // Il «+» dichiarato dall'utente comanda: il menu si sposta da solo, così non
  // si vede più un paese e se ne manda un altro.
  var dichiarato = paeseDichiarato(grezzo);
  if (dichiarato && dichiarato !== paeseEl.value) paeseEl.value = dichiarato;
  var paese = paeseEl.value;

  var cifre = pulisci(grezzo, paese);
  if (cifre.length < 6) return avviso('Questo numero sembra troppo corto.', null);

  // Un «+» che non è di nessun paese dell'elenco: il prefisso resterebbe
  // attaccato dopo quello scelto e il link porterebbe da nessuno.
  if (/^\s*(\+|00)/.test(grezzo) && !dichiarato) {
    avviso('Il prefisso che hai scritto non è nell\'elenco. Scegli il paese qui '
      + 'accanto e scrivi il numero senza prefisso.', null);
  }

  var att = ATTESE[paese];
  if (att && (cifre.length < att[0] || cifre.length > att[1])) {
    avviso('Di solito qui il numero ha ' +
      (att[0] === att[1] ? att[0] : att[0] + '–' + att[1]) +
      ' cifre e a te ne risultano ' + cifre.length + '. Controlla il prefisso.', null);
  }
  // In Italia WhatsApp sta sui cellulari, che cominciano per 3.
  if (paese === '39' && cifre.charAt(0) !== '3') {
    avviso('I numeri fissi non hanno WhatsApp. Serve un cellulare, che comincia per 3.', null);
  }

  var url = 'https://wa.me/' + paese + cifre;
  var msg = msgEl.value.trim();
  if (msg) url += '?text=' + encodeURIComponent(msg);
  return url;
}

// L'avviso non ferma niente: mostra e restituisce quello che gli si passa.
function avviso(t, ritorno) {
  if (!dettoInQuestoGiro) {
    dettoInQuestoGiro = true;
    numErr.textContent = t;
    numErr.classList.remove('hidden');
  }
  return ritorno;
}

function aggiorna() {
  var url = costruisci();

  if (!url) {
    linkPronto = htmlPronto = '';
    linkEl.textContent = 'il link comparirà qui';
    linkEl.classList.add('vuoto');
    htmlEl.textContent = 'prima serve il numero';
    htmlEl.classList.add('vuoto');
    copiaBtn.disabled = provaBtn.disabled = qrBtn.disabled = copiaHtmlBtn.disabled = true;
    return;
  }

  linkPronto = url;
  linkEl.classList.remove('vuoto');
  htmlEl.classList.remove('vuoto');

  // Il messaggio codificato si vede in grassetto: si capisce dove finisce il
  // numero e comincia il testo, che è la parte che si continua a ritoccare.
  var taglio = url.indexOf('?text=');
  if (taglio > 0) {
    linkEl.innerHTML = esc(url.slice(0, taglio)) + '<b>' + esc(url.slice(taglio)) + '</b>';
  } else {
    linkEl.textContent = url;
  }

  // Un pulsante che non ha bisogno di CSS altrove: tutto in linea, così si
  // incolla dentro qualsiasi sito senza toccare il foglio di stile.
  htmlPronto = '<a href="' + esc(url) + '" target="_blank" rel="noopener"\n' +
    '   style="display:inline-block;background:#25D366;color:#fff;font-family:sans-serif;\n' +
    '          font-size:16px;font-weight:600;text-decoration:none;padding:13px 22px;\n' +
    '          border-radius:999px">Scrivimi su WhatsApp</a>';
  htmlEl.textContent = htmlPronto;

  copiaBtn.disabled = provaBtn.disabled = qrBtn.disabled = copiaHtmlBtn.disabled = false;
}

// --- Frasi pronte -----------------------------------------------------------

FRASI.forEach(function (f) {
  var b = document.createElement('button');
  b.type = 'button';
  b.className = 'chip';
  // Nella pillola sta la prima parte: per riconoscerla basta, e la riga resta corta.
  b.textContent = f.length > 26 ? f.slice(0, 25).trim() + '…' : f;
  b.title = f;
  b.addEventListener('click', function () { msgEl.value = f; aggiorna(); });
  chipsEl.appendChild(b);
});

// --- Azioni -----------------------------------------------------------------

/* Il ripiego va agganciato dentro il .catch: senza gesto utente o senza https
   writeText rigetta, e se non si intercetta non copia e non lo dice. */
function copiaTesto(t) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(t).catch(function () { return conCasella(t); });
  }
  return conCasella(t);
}
function conCasella(t) {
  var a = document.createElement('textarea');
  a.value = t;
  a.style.position = 'fixed';
  a.style.opacity = '0';
  document.body.appendChild(a);
  a.select();
  try { document.execCommand('copy'); } catch (e) { /* niente da fare */ }
  document.body.removeChild(a);
}

copiaBtn.addEventListener('click', function () {
  if (!linkPronto) return;
  copiaTesto(linkPronto);
  avvisa('Link copiato');
  if (window.track) track('click', 'WhatsApp:copia');
});

copiaHtmlBtn.addEventListener('click', function () {
  if (!htmlPronto) return;
  copiaTesto(htmlPronto);
  avvisa('Codice copiato');
  if (window.track) track('click', 'WhatsApp:html');
});

// Apre la chat con il messaggio già dentro: non manda niente, si vede e basta.
provaBtn.addEventListener('click', function () {
  if (!linkPronto) return;
  if (window.track) track('click', 'WhatsApp:prova');
  window.open(linkPronto, '_blank', 'noopener');
});

/* Il link non passa dall'indirizzo: resterebbe scritto nella cronologia insieme
   al numero. Passa da sessionStorage, che muore con la scheda. */
qrBtn.addEventListener('click', function () {
  if (!linkPronto) return;
  try { sessionStorage.setItem('qr:precompila', linkPronto); } catch (e) { /* pazienza */ }
  if (window.track) track('click', 'WhatsApp:qr');
  location.href = '/qrcode/';
});

// --- Avvio ------------------------------------------------------------------

[numEl, msgEl].forEach(function (el) { el.addEventListener('input', aggiorna); });
paeseEl.addEventListener('change', aggiorna);
aggiorna();
