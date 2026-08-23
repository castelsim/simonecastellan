/* Conta caratteri — ma il numero non è la cosa importante.

   Il limite di una piattaforma quasi non si tocca: 2.200 caratteri di
   didascalia non li scrive nessuno. Quello che succede sempre, invece, è
   che dopo un centinaio di caratteri compare «altro…» e da lì in poi il
   testo esiste solo per chi tocca. Perciò qui il numero c'è, ma il pezzo
   forte è vedere il taglio sul proprio testo: dove finisce quello che
   verrà letto e dove comincia quello che quasi nessuno aprirà.

   I limiti stanno in /comune/specifiche.js insieme a tutti gli altri:
   qui dentro non c'è un solo numero di piattaforma. */

var testoEl  = document.getElementById('testo');
var nCar     = document.getElementById('nCar');
var nPar     = document.getElementById('nPar');
var nHash    = document.getElementById('nHash');
var notaEmoji = document.getElementById('notaEmoji');
var notaInvisibili = document.getElementById('notaInvisibili');
var anteprimaBox = document.getElementById('anteprimaBox');
var chipsEl  = document.getElementById('chips');
var prevEl   = document.getElementById('prev');
var prevNota = document.getElementById('prevNota');
var righeEl  = document.getElementById('righe');
var copiaBtn = document.getElementById('copia');
var tagliaBtn = document.getElementById('tagliaBtn');
var toast    = document.getElementById('toast');

/* L'anteprima si può fare su tutte le voci, non solo su quelle con «altro…»:
   dove il taglio non c'è (X, le biografie) il confine è il limite stesso, e
   vederlo sul proprio testo serve altrettanto. Tenerle fuori aveva un effetto
   assurdo — su X, la piattaforma con il limite più stretto di tutte, non si
   poteva né vedere il confine né usare il pulsante che taglia. */
// Si parte dalla didascalia di Instagram: è il caso che capita più spesso,
// ed è quello dove il taglio morde davvero.
var scelta = SOCIAL_TESTO.filter(function (v) { return v.id === 'instagram-cap'; })[0] || SOCIAL_TESTO[0];

// Il confine da disegnare: dove la gente smette di leggere se esiste, altrimenti
// dove la piattaforma smette di accettare.
function confineDi(v) { return v.taglio || v.massimo; }

function avvisa(t) {
  toast.textContent = t;
  toast.classList.add('show');
  setTimeout(function () { toast.classList.remove('show'); }, 1800);
}

/* Un carattere è quello che si vede, non quello che sta in memoria.
   «👍🏽» è un solo carattere per chi scrive ed è quattro unità per il
   computer: contarlo a unità dà numeri che nessuno riconosce. */
var segmentatore = null;
try {
  if (window.Intl && Intl.Segmenter) segmentatore = new Intl.Segmenter('it', { granularity: 'grapheme' });
} catch (e) { /* browser vecchio: si ripiega sui punti di codice */ }

function grafemi(t) {
  if (!t) return [];
  if (segmentatore) {
    var out = [];
    var it = segmentatore.segment(t)[Symbol.iterator]();
    for (var s = it.next(); !s.done; s = it.next()) out.push(s.value.segment);
    return out;
  }
  return Array.from(t);
}

function contaParole(t) {
  var p = t.trim();
  return p ? p.split(/\s+/).length : 0;
}

// Un hashtag vero comincia a inizio parola e ha almeno una lettera.
function contaHashtag(t) {
  var m = t.match(/(^|\s)#[\p{L}\p{N}_]+/gu);
  return m ? m.length : 0;
}

/* Caratteri che non si vedono ma si contano: arrivano incollando da Word o da
   una pagina web, e il social li conta come tutti gli altri. Chi non lo sa vede
   un numero che non torna e non capisce perché.
   Lo ZWJ (U+200D) resta fuori apposta: è quello che tiene insieme le emoji
   composte, e segnalarlo sarebbe un falso allarme su «👨‍👩‍👧‍👦». */
var INVISIBILI = /[\u00AD\u200B\u200C\u2060\uFEFF]/g;

function contaInvisibili(t) {
  var m = t.match(INVISIBILI);
  return m ? m.length : 0;
}

/* Il pulsante che li toglie vive dentro la nota, non nella pagina: quando non
   c'è niente di invisibile non ha niente da fare, e una riga in meno da leggere
   è una riga guadagnata. */
var puliscibtn = document.createElement('button');
puliscibtn.type = 'button';
puliscibtn.className = 'link';
puliscibtn.textContent = 'Toglili';
puliscibtn.addEventListener('click', function () {
  testoEl.value = testoEl.value.replace(INVISIBILI, '');
  aggiorna();
  avvisa('Caratteri invisibili tolti');
  if (window.track) track('click', 'Caratteri:invisibili');
});

// --- Righe dei limiti -------------------------------------------------------

var righe = {};

function costruisciRighe() {
  SOCIAL_TESTO.forEach(function (v) {
    var r = document.createElement('div');
    r.className = 'riga';

    var nm = document.createElement('span');
    nm.className = 'riga-nm';
    nm.textContent = v.piattaforma + ' ';
    var i = document.createElement('i');
    i.textContent = v.nome.toLowerCase();
    nm.appendChild(i);

    var barra = document.createElement('span');
    barra.className = 'barra';
    var dentro = document.createElement('span');
    barra.appendChild(dentro);

    var n = document.createElement('span');
    n.className = 'riga-n';

    r.appendChild(nm); r.appendChild(barra); r.appendChild(n);
    righeEl.appendChild(r);
    righe[v.id] = { riga: r, dentro: dentro, n: n, voce: v };
  });
}

/* X ha un conto suo, e va fatto — non descritto in una nota.
   Le emoji pesano 2, il giapponese 2 a carattere, un collegamento 23 comunque
   sia lungo. Fino al 23/08/2026 la riga di X mostrava lo stesso numero di
   tutte le altre e una nota accanto diceva «X li conta come N», dove N erano
   le unità UTF-16: sulla famiglia 👨‍👩‍👧‍👦 diceva 11, e X ne conta 2. Il
   risultato era una riga verde «280 / 280» accanto a una nota che diceva 281.
   Vedi conta-caratteri/peso-x.js e le prove in tools/prova-peso-x.js. */
function quantiPer(v, t, quanti) {
  return v.piattaforma === 'X' ? PESO_X.peso(t) : quanti;
}

function aggiornaRighe(quanti, testo) {
  SOCIAL_TESTO.forEach(function (v) {
    var r = righe[v.id];
    var suoi = quantiPer(v, testo, quanti);
    // Dove non c'è un massimo dichiarato (l'oggetto di una mail) il metro è
    // il punto di taglio: è l'unico numero che significa qualcosa lì.
    var metro = v.massimo || v.taglio;
    var quota = Math.min(1, suoi / metro);

    r.dentro.style.width = (quota * 100).toFixed(1) + '%';
    r.n.textContent = v.massimo
      ? suoi + ' / ' + v.massimo.toLocaleString('it-IT', { useGrouping: true })
      : suoi + ' / ~' + v.taglio;

    r.riga.classList.remove('ok', 'giusto', 'fuori');
    if (v.massimo && suoi > v.massimo) r.riga.classList.add('fuori');
    else if (quota >= 0.8) r.riga.classList.add('giusto');
    else r.riga.classList.add('ok');
  });
}

// --- Anteprima del taglio ---------------------------------------------------

function pillole() {
  SOCIAL_TESTO.forEach(function (v) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (v === scelta ? ' on' : '');
    b.textContent = v.piattaforma + ' · ' + v.nome.toLowerCase();
    b.addEventListener('click', function () {
      scelta = v;
      [].forEach.call(chipsEl.children, function (x) { x.classList.toggle('on', x === b); });
      aggiorna();
    });
    chipsEl.appendChild(b);
  });
}

function disegnaAnteprima(g) {
  prevEl.innerHTML = '';
  var confine = confineDi(scelta);
  var eTaglio = !!scelta.taglio;      // «altro…» oppure il limite duro

  if (g.length <= confine) {
    prevEl.textContent = g.join('');
    prevNota.textContent = eTaglio
      ? 'Si legge tutto: sei sotto i ' + confine + ' caratteri oltre i quali ' +
        scelta.piattaforma + ' mette «altro…».'
      : 'Ci sta tutto: ' + scelta.piattaforma + ' accetta fino a ' +
        confine.toLocaleString('it-IT', { useGrouping: true }) + ' caratteri.';
    return;
  }

  var visibile = document.createElement('span');
  visibile.textContent = g.slice(0, confine).join('');
  var etichetta = document.createElement('span');
  etichetta.className = 'altro';
  etichetta.textContent = eTaglio ? 'altro…' : 'taglia qui';
  var resto = document.createElement('span');
  resto.className = 'dopo';
  resto.textContent = g.slice(confine).join('');

  prevEl.appendChild(visibile);
  prevEl.appendChild(etichetta);
  prevEl.appendChild(resto);

  prevNota.textContent = eTaglio
    ? 'Da qui in poi legge solo chi tocca «altro…»: ' +
      (g.length - confine) + ' caratteri su ' + g.length + '.'
    : 'Questa parte non viene pubblicata: ' + (g.length - confine) +
      ' caratteri di troppo su ' + g.length + '.';
}

// --- Aggiornamento ----------------------------------------------------------

function aggiorna() {
  var t = testoEl.value;
  var g = grafemi(t);
  var quanti = g.length;

  nCar.textContent = quanti.toLocaleString('it-IT');
  nPar.textContent = contaParole(t).toLocaleString('it-IT');
  nHash.textContent = contaHashtag(t);

  /* La riga di X ora porta il SUO numero: qui si spiega solo perché è diverso,
     e solo quando lo è davvero. Prima questa nota dichiarava un conteggio
     sbagliato (le unità UTF-16) su un numero che nessuno stava usando. */
  var perX = PESO_X.peso(t);
  if (perX !== quanti) {
    var causa = [];
    if (/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(t)) causa.push('le emoji contano 2');
    if (/(https?:\/\/|www\.)/i.test(t)) causa.push('ogni link conta 23, corto o lungo');
    if (/[\u3000-\u9FFF\uAC00-\uD7AF]/.test(t)) causa.push('gli ideogrammi contano 2');
    notaEmoji.textContent = 'Su X questo testo pesa ' + perX + ' invece di ' + quanti +
      (causa.length ? ': ' + causa.join(', ') + '.' : '.');
    notaEmoji.classList.remove('hidden');
  } else {
    notaEmoji.classList.add('hidden');
  }

  var invisibili = contaInvisibili(t);
  if (invisibili) {
    // Uno solo è il caso più frequente — un carattere invisibile incollato da
    // Word — e leggere «Ci sono 1 caratteri» fa sembrare rotto lo strumento
    // proprio mentre sta dicendo una cosa giusta.
    notaInvisibili.textContent = invisibili === 1
      ? "C'è 1 carattere che non si vede, arrivato da un copia e incolla. Occupa posto lo stesso. "
      : 'Ci sono ' + invisibili + ' caratteri che non si vedono, ' +
        'arrivati da un copia e incolla. Occupano posto lo stesso. ';
    notaInvisibili.appendChild(puliscibtn);
    notaInvisibili.classList.remove('hidden');
  } else {
    notaInvisibili.classList.add('hidden');
  }

  aggiornaRighe(quanti, t);

  anteprimaBox.classList.toggle('hidden', quanti === 0);
  if (quanti) disegnaAnteprima(g);

  copiaBtn.disabled = quanti === 0;

  var sfora = scelta.massimo && quanti > scelta.massimo;
  tagliaBtn.classList.toggle('hidden', !sfora);
  if (sfora) tagliaBtn.textContent = 'Taglia a ' + scelta.massimo;
}

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
  if (!testoEl.value) return;
  copiaTesto(testoEl.value);
  avvisa('Testo copiato');
  if (window.track) track('click', 'Caratteri:copia');
});

// Taglia sull'ultimo spazio prima del limite: troncare a metà parola si vede.
tagliaBtn.addEventListener('click', function () {
  var g = grafemi(testoEl.value);
  var pezzo = g.slice(0, scelta.massimo).join('');
  var spazio = pezzo.lastIndexOf(' ');
  if (spazio > pezzo.length - 20) pezzo = pezzo.slice(0, spazio);
  testoEl.value = pezzo.replace(/[\s,;:.-]+$/, '');
  aggiorna();
  avvisa('Tagliato a ' + grafemi(testoEl.value).length + ' caratteri');
});

// --- Avvio ------------------------------------------------------------------

costruisciRighe();
pillole();
testoEl.addEventListener('input', aggiorna);
aggiorna();

/* La data va per ultima, ed è l'unica riga che si può permettere di mancare.
   Subito dopo la pubblicazione un browser può trovarsi in mano lo script nuovo
   e la copia vecchia di specifiche.js, ancora in cache: se `ilGiorno` non c'è e
   la riga sta in cima, l'errore ferma tutto e lo strumento resta muto — niente
   limiti, niente pillole — per una frase di servizio. */
document.getElementById('agg').textContent = 'Limiti controllati ' +
  (typeof ilGiorno === 'function' ? ilGiorno(SOCIAL_TESTO_AGGIORNATO) : 'il ' + SOCIAL_TESTO_AGGIORNATO) + '.';
