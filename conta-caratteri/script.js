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

function aggiornaRighe(quanti) {
  SOCIAL_TESTO.forEach(function (v) {
    var r = righe[v.id];
    // Dove non c'è un massimo dichiarato (l'oggetto di una mail) il metro è
    // il punto di taglio: è l'unico numero che significa qualcosa lì.
    var metro = v.massimo || v.taglio;
    var quota = Math.min(1, quanti / metro);

    r.dentro.style.width = (quota * 100).toFixed(1) + '%';
    r.n.textContent = v.massimo
      ? quanti + ' / ' + v.massimo.toLocaleString('it-IT', { useGrouping: true })
      : quanti + ' / ~' + v.taglio;

    r.riga.classList.remove('ok', 'giusto', 'fuori');
    if (v.massimo && quanti > v.massimo) r.riga.classList.add('fuori');
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

  // X e i contatori di molte piattaforme lavorano sulle unità UTF-16: un emoji
  // che qui vale 1 lì ne pesa 2 o più. Se i due numeri divergono va detto.
  var unita = t.length;
  if (unita > quanti) {
    notaEmoji.textContent = 'Attenzione agli emoji: qui contano ' + quanti +
      ', ma alcune piattaforme — X in testa — li contano come ' + unita + '.';
    notaEmoji.classList.remove('hidden');
  } else {
    notaEmoji.classList.add('hidden');
  }

  aggiornaRighe(quanti);

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

document.getElementById('agg').textContent = 'Limiti controllati ' + ilGiorno(SOCIAL_TESTO_AGGIORNATO) + '.';
costruisciRighe();
pillole();
testoEl.addEventListener('input', aggiorna);
aggiorna();
