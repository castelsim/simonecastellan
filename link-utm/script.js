/* Link UTM — un indirizzo che dice da dove è arrivato il clic.

   Costruire un link UTM è banale: si attaccano cinque parametri in fondo.
   Quello che non è banale è farlo sempre allo stesso modo. Analytics non
   sa che «Estate 2026», «estate-2026» e «Estate2026» sono la stessa cosa:
   le conta come tre campagne, e i numeri che dovevano dire com'è andata
   si spezzano in tre pezzi che non dicono niente.

   Perciò qui il lavoro vero è due cose: la provenienza si sceglie invece
   di scriverla, e tutto quello che si scrive viene normalizzato — minuscole,
   niente accenti, spazi che diventano trattini. I nomi già usati restano
   su questo dispositivo e si ripropongono: riusare un nome è più facile
   che riscriverlo, ed è esattamente quello che serve. */

/* Le provenienze che capitano davvero, con dentro la coppia sorgente/mezzo
   che si sbaglia sempre. La convenzione è quella riconosciuta da Analytics:
   il mezzo dice COME (social, email, qrcode), la sorgente dice CHI. */
var PROVENIENZE = [
  { et: 'Instagram · bio',    src: 'instagram', med: 'social',   cont: 'bio' },
  { et: 'Instagram · storia', src: 'instagram', med: 'social',   cont: 'storia' },
  { et: 'Facebook',           src: 'facebook',  med: 'social' },
  { et: 'LinkedIn',           src: 'linkedin',  med: 'social' },
  { et: 'WhatsApp',           src: 'whatsapp',  med: 'messaggio' },
  { et: 'Newsletter',         src: 'newsletter', med: 'email' },
  { et: 'QR su carta',        src: 'volantino', med: 'qrcode' },
  { et: 'Firma della mail',   src: 'firma',     med: 'email' }
];

var CHIAVE_CAMPAGNE = 'utm:campagne';
var MAX_CAMPAGNE = 8;

var urlEl   = document.getElementById('url');
var urlErr  = document.getElementById('urlErr');
var srcEl   = document.getElementById('src');
var medEl   = document.getElementById('med');
var campEl  = document.getElementById('camp');
var contEl  = document.getElementById('cont');
var termEl  = document.getElementById('term');
var linkEl  = document.getElementById('link');
var notaEl  = document.getElementById('nota');
var copiaBtn = document.getElementById('copia');
var qrBtn   = document.getElementById('qr');
var chipsEl = document.getElementById('chips');
var recenti = document.getElementById('recenti');
var chipsCamp = document.getElementById('chipsCamp');
var toast   = document.getElementById('toast');

var linkPronto = '';

function avvisa(t) {
  toast.textContent = t;
  toast.classList.add('show');
  setTimeout(function () { toast.classList.remove('show'); }, 1800);
}

/* La regola sola che tiene insieme i numeri: minuscole, niente accenti,
   niente spazi. «Città di Padova» e «citta-di-padova» devono finire nella
   stessa riga del rapporto. */
function normalizza(s) {
  return String(s || '')
    .trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')    // «à» diventa «a»
    .toLowerCase()
    .replace(/[^\w\s.-]+/g, '')                          // via punteggiatura e simboli
    .replace(/[\s_]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// --- Costruzione del link ---------------------------------------------------

function costruisci() {
  var grezzo = urlEl.value.trim();
  urlErr.classList.add('hidden');

  if (!grezzo) return null;

  // Chi incolla un indirizzo dalla barra spesso lascia fuori «https://».
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(grezzo)) grezzo = 'https://' + grezzo;

  var u;
  try {
    u = new URL(grezzo);
  } catch (e) {
    return mostraErrore('Questo non sembra un indirizzo web.');
  }
  if (!/^https?:$/.test(u.protocol) || u.hostname.indexOf('.') === -1) {
    return mostraErrore('Questo non sembra un indirizzo web.');
  }

  // Se il link ne portava già, si rifanno da capo: due utm_source nello stesso
  // indirizzo non si sommano, vince quello che capita e non si sa mai quale.
  var vecchi = [];
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(function (k) {
    if (u.searchParams.has(k)) { vecchi.push(k); u.searchParams.delete(k); }
  });

  var src = normalizza(srcEl.value);
  var med = normalizza(medEl.value);
  var camp = normalizza(campEl.value);
  var cont = normalizza(contEl.value);
  var term = normalizza(termEl.value);

  if (!src && !med && !camp) return { url: u.toString(), nudo: true, vecchi: vecchi };

  if (src) u.searchParams.set('utm_source', src);
  if (med) u.searchParams.set('utm_medium', med);
  if (camp) u.searchParams.set('utm_campaign', camp);
  if (cont) u.searchParams.set('utm_content', cont);
  if (term) u.searchParams.set('utm_term', term);

  return { url: u.toString(), vecchi: vecchi, manca: (!src && 'sorgente') || (!med && 'mezzo') || '' };
}

function mostraErrore(t) {
  urlErr.textContent = t;
  urlErr.classList.remove('hidden');
  return null;
}

function nota(t) {
  notaEl.textContent = t || '';
  notaEl.classList.toggle('hidden', !t);
}

function aggiorna() {
  var r = costruisci();

  if (!r) {
    linkPronto = '';
    linkEl.textContent = urlEl.value.trim() ? 'controlla l\'indirizzo' : 'il link comparirà qui';
    linkEl.classList.add('vuoto');
    copiaBtn.disabled = qrBtn.disabled = true;
    nota('');
    return;
  }

  linkPronto = r.url;
  linkEl.classList.remove('vuoto');

  // La parte aggiunta si vede in grassetto: si capisce a colpo d'occhio
  // dove finisce la pagina e dove comincia il tracciamento.
  var taglio = r.url.indexOf('utm_');
  if (taglio > 0) {
    linkEl.innerHTML = esc(r.url.slice(0, taglio)) + '<b>' + esc(r.url.slice(taglio)) + '</b>';
  } else {
    linkEl.textContent = r.url;
  }

  copiaBtn.disabled = qrBtn.disabled = !!r.nudo;

  /* Quello che manca si dice, e si dice cosa comporta. Il link senza sorgente
     o senza mezzo funziona benissimo — porta dove deve — ma in Analytics
     quei clic finiscono in un mucchio chiamato «(none)», cioè esattamente il
     posto da cui si voleva tirarli fuori: si scopre a fine campagna, quando
     non si può più rifare il volantino. Il codice se ne accorgeva già (era
     `r.mancano`) e non lo diceva a nessuno: la nota in pagina restava vuota. */
  if (r.manca === 'mezzo') {
    nota('Manca il mezzo. Il link funziona, ma in Analytics questi clic finiranno '
       + 'sotto «(none)» invece che sotto il canale giusto.');
  } else if (r.manca === 'sorgente') {
    nota('Manca la sorgente: è il campo da cui Analytics capisce da dove arriva '
       + 'il clic. Senza, il resto conta poco.');
  } else {
    nota('');
  }

  if (r.vecchi && r.vecchi.length) {
    urlErr.textContent = 'Questo indirizzo aveva già dei parametri UTM: li ho rifatti da capo.';
    urlErr.classList.remove('hidden');
  }
}

// --- Provenienze ------------------------------------------------------------

function pillole() {
  PROVENIENZE.forEach(function (p) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = p.et;
    b.addEventListener('click', function () {
      srcEl.value = p.src;
      medEl.value = p.med;
      if (p.cont) contEl.value = p.cont;
      [].forEach.call(chipsEl.children, function (x) { x.classList.toggle('on', x === b); });
      aggiorna();
    });
    chipsEl.appendChild(b);
  });
}

// Se si scrive a mano, nessuna pillola è più quella giusta.
function spegniPillole() {
  [].forEach.call(chipsEl.children, function (x) { x.classList.remove('on'); });
}

// --- Campagne già usate -----------------------------------------------------

function leggiCampagne() {
  try { return JSON.parse(localStorage.getItem(CHIAVE_CAMPAGNE)) || []; }
  catch (e) { return []; }
}

function ricordaCampagna(nome) {
  if (!nome) return;
  var l = leggiCampagne().filter(function (x) { return x !== nome; });
  l.unshift(nome);
  try { localStorage.setItem(CHIAVE_CAMPAGNE, JSON.stringify(l.slice(0, MAX_CAMPAGNE))); }
  catch (e) { /* navigazione privata: pazienza, il link si fa lo stesso */ }
  disegnaCampagne();
}

function disegnaCampagne() {
  var l = leggiCampagne();
  recenti.classList.toggle('hidden', l.length === 0);
  chipsCamp.innerHTML = '';
  l.forEach(function (nome) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = nome;
    b.addEventListener('click', function () { campEl.value = nome; aggiorna(); });
    chipsCamp.appendChild(b);
  });
}

// --- Azioni -----------------------------------------------------------------

/* Il ripiego va agganciato dentro il .catch: senza gesto utente o senza https
   writeText rigetta, e se non si intercetta il rifiuto non copia niente e non
   lo dice nemmeno. */
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
  ricordaCampagna(normalizza(campEl.value));
  avvisa('Link copiato');
  if (window.track) track('click', 'UTM:copia');
});

/* Il link non passa dall'indirizzo: resterebbe scritto nella cronologia e nel
   registro di chiunque. Passa da sessionStorage, che muore con la scheda. */
qrBtn.addEventListener('click', function () {
  if (!linkPronto) return;
  ricordaCampagna(normalizza(campEl.value));
  try { sessionStorage.setItem('qr:precompila', linkPronto); } catch (e) { /* pazienza */ }
  if (window.track) track('click', 'UTM:qr');
  location.href = '/qrcode/';
});

// --- Avvio ------------------------------------------------------------------

[urlEl, campEl, contEl, termEl].forEach(function (el) {
  el.addEventListener('input', aggiorna);
});
[srcEl, medEl].forEach(function (el) {
  el.addEventListener('input', function () { spegniPillole(); aggiorna(); });
});

pillole();
disegnaCampagne();
aggiorna();
