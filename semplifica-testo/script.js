/* Semplifica un testo.

   Prima misura, poi chiede aiuto. La misura è l'indice Gulpease, che esiste
   apposta per l'italiano (le formule inglesi contano le sillabe e da noi
   sbagliano): dipende solo da quanto sono lunghe le parole e le frasi.

       89 + (300 × frasi − 10 × lettere) / parole

   Le soglie che si leggono sotto il numero sono quelle del gruppo che l'ha
   costruito: sotto 80 è difficile per chi ha la licenza elementare, sotto 60
   per chi ha la licenza media, sotto 40 per chi ha il diploma.

   L'indice non dice se un testo è bello né se è giusto: dice quanta fatica
   costa leggerlo. Un testo tecnico che deve restare tecnico può stare a 45 e
   andare benissimo — perciò qui non c'è nessuna bocciatura, c'è un numero. */

var testoEl   = document.getElementById('testo');
var misuraBox = document.getElementById('misuraBox');
var votoN     = document.getElementById('votoN');
var votoDice  = document.getElementById('votoDice');
var barraDentro = document.getElementById('barraDentro');
var nPar      = document.getElementById('nPar');
var nFrasi    = document.getElementById('nFrasi');
var nMedia    = document.getElementById('nMedia');
var lungheBox = document.getElementById('lungheBox');
var lungheEl  = document.getElementById('lunghe');
var promptEl  = document.getElementById('prompt');

// Oltre questa lunghezza una frase va quasi sempre spezzata: il lettore ha
// perso il soggetto per strada.
var FRASE_LUNGA = 25;

var PUBBLICO = [
  { id: 'chiunque', nome: 'a chiunque',        regola: 'deve capirlo chiunque, anche chi legge di fretta dal telefono' },
  { id: 'cliente',  nome: 'a un cliente',      regola: 'parla a un cliente: dagli il vantaggio concreto, non la descrizione del prodotto' },
  { id: 'estraneo', nome: 'a chi non è del mestiere', regola: 'chi legge non conosce il mestiere: ogni termine tecnico va spiegato la prima volta con parole comuni, oppure sostituito' },
  { id: 'ufficio',  nome: 'a un ufficio',      regola: 'resta formale ma smetti di essere burocratico: via le formule fisse, i verbi al passivo e le frasi che nessuno pronuncerebbe mai' }
];

var VINCOLI = [
  { id: 'numeri',  nome: 'numeri e date',  regola: 'lascia intatti tutti i numeri, le date, gli importi e i nomi propri', on: true },
  { id: 'termini', nome: 'termini tecnici', regola: 'i termini tecnici indispensabili restano, ma la prima volta si spiegano in mezza riga', on: false },
  { id: 'corto',   nome: 'più corto',       regola: 'accorcia: punta a un terzo di parole in meno', on: false },
  { id: 'lunghezza', nome: 'stessa lunghezza', regola: 'tieni più o meno la stessa lunghezza: qui non serve tagliare, serve chiarire', on: false }
];

var pubblico = PUBBLICO[0];
var vincoliOn = {};
VINCOLI.forEach(function (v) { vincoliOn[v.id] = v.on; });

// --- La misura --------------------------------------------------------------

/* Si contano le lettere, non i caratteri: spazi e punteggiatura non fanno
   fatica a nessuno.  \p{L} prende anche le accentate, che in italiano sono
   ovunque. */
function lettere(t) {
  var m = t.match(/\p{L}/gu);
  return m ? m.length : 0;
}

function parole(t) {
  var m = t.match(/[\p{L}\p{N}'’-]+/gu);
  return m ? m : [];
}

/* Le abbreviazioni che in italiano portano il punto in mezzo alla frase.
   Senza questo elenco ognuna di esse spezzava la frase in due — e il conto
   delle frasi è metà della formula di Gulpease. */
var ABBREVIAZIONI = [
  // rimandi a leggi e articoli: sono il pane del testo amministrativo
  'art', 'artt', 'cpv', 'lett', 'nn', 'prot', 'reg', 'cost',
  'd.lgs', 'dlgs', 'd.l', 'd.p.r', 'dpr', 'd.m', 'l.r',
  // misure, tempi, quantità
  'gg', 'kg', 'km', 'mq', 'mc', 'ca', 'max', 'min',
  // rimandi al testo
  'pag', 'pagg', 'cfr', 'es', 'ecc', 'etc', 'vs', 'all', 'seg', 'segg',
  // titoli e persone
  'sig', 'sig.ra', 'dott', 'dott.ssa', 'prof', 'prof.ssa', 'ing', 'avv',
  'geom', 'rag', 'egr', 'spett', 'on',
  // forme societarie
  's.p.a', 'spa', 's.r.l', 'srl', 's.n.c', 's.a.s', 'soc',
  // contatti
  'tel', 'fax', 'cell', 'int'
];

/* Una frase finisce con . ! ? oppure con l'a capo: gli elenchi puntati sono
   fatti di righe che sono frasi a tutti gli effetti, e senza questo pezzo un
   elenco di dieci voci risulterebbe una frase sola lunghissima.

   ⚠️ MA NON OGNI PUNTO FINISCE UNA FRASE, e qui stava un difetto grosso
   (corretto il 23/08/2026). Tagliando su ogni punto, «art. 5», «D.Lgs. n.
   33/2013» ed «euro 1.500,00» diventavano cinque frasi invece di una. Il conto
   delle frasi è metà della formula di Gulpease, quindi il punteggio si
   gonfiava — e si gonfiava proprio sul testo BUROCRATICO, cioè sull'unico
   testo per cui questo strumento esiste. Misurato:

     «Ai sensi dell'art. 5, comma 2, del D.Lgs. n. 33/2013, il richiedente è
      tenuto a produrre la documentazione entro 30 gg. dalla notifica.»

   → sei frasi, media quattro parole, 100 su 100, «facile per tutti, anche per
   chi ha finito le elementari». Vale 61: si legge col diploma. Uno strumento
   che promette di misurare la difficoltà dava il punteggio più alto possibile
   alla frase più difficile che gli si può dare.

   Le tre trappole, in ordine di frequenza: le abbreviazioni qui sopra, i punti
   fra cifre (importi e date), le iniziali puntate dei nomi propri.

   Fuori dall'elenco restano di proposito «n.» e «c.»: una lettera sola seguita
   dal punto la prende già la maschera delle iniziali, e metterle qui vorrebbe
   dire spegnere il punto fermo dopo ogni parola che finisce per quella
   lettera. */
/* Il segnaposto che prende il posto dei punti «finti» durante il taglio:
   un carattere che in un testo scritto da una persona non compare mai.
   Scritto in escape e non a mano, perché nel sorgente sarebbe invisibile e
   la prima ricerca-e-sostituisci lo porterebbe via senza che nessuno se ne
   accorga. */
var SEGNO = '\u0001';

function frasi(t) {
  // 1.500,00 e 33/2013: il punto fra due cifre non finisce niente
  var mascherato = t.replace(/(\d)\.(\d)/g, '$1' + SEGNO + '$2');

  /* Le abbreviazioni PRIMA delle iniziali, e l'ordine non è un dettaglio:
     «D.Lgs.» contiene già un punto dopo una lettera sola. Mascherando prima le
     iniziali diventava «D⟨segno⟩Lgs.», che non somiglia più a nessuna
     abbreviazione dell'elenco — e quel punto finale tornava a spezzare la
     frase. Misurato: la frase di prova restava tagliata in due invece di una. */
  ABBREVIAZIONI.forEach(function (a) {
    var r = new RegExp('(^|[^\\p{L}])' + a.replace(/\./g, '\\.') + '\\.', 'giu');
    /* TUTTI i punti dell'abbreviazione, non solo l'ultimo: «S.r.l.» ne ha tre,
       e mascherandone uno solo gli altri due tagliavano lo stesso — «La S.r» /
       «l. ha sede…». Il difetto si vedeva solo sulle sigle a più punti, che
       sono proprio quelle del testo amministrativo. */
    mascherato = mascherato.replace(r, function (m) { return m.split('.').join(SEGNO); });
  });

  // «M. Rossi», e anche il «n.» di «n. 33»: una lettera sola, poi il punto
  mascherato = mascherato.replace(/(^|[\s(«"])(\p{L})\./gu, '$1$2' + SEGNO);
  return mascherato.split(/[.!?…]+[\s"»)]*|\n+/)
          .map(function (s) { return s.split(SEGNO).join('.').trim(); })
          .filter(function (s) { return parole(s).length > 0; });
}

function gulpease(t) {
  var p = parole(t).length;
  if (!p) return null;
  var f = frasi(t).length;
  var l = lettere(t);
  var g = 89 + (300 * f - 10 * l) / p;
  return Math.max(0, Math.min(100, Math.round(g)));
}

function commento(g) {
  if (g >= 80) return { t: 'Facile per tutti, anche per chi ha finito le elementari.', c: 'bene' };
  if (g >= 60) return { t: 'Si legge senza fatica con la licenza media: per un testo pubblico va bene.', c: 'bene' };
  if (g >= 40) return { t: 'Chiede il diploma. Se scrivi a un pubblico largo, conviene alleggerirlo.', c: 'medio' };
  return { t: 'Faticoso anche per chi ha studiato: frasi lunghe, parole lunghe, o tutte e due.', c: 'male' };
}

// --- Aggiornamento ----------------------------------------------------------

var frasiLunghe = [];

function aggiorna() {
  var t = testoEl.value;
  var g = gulpease(t);

  misuraBox.classList.toggle('hidden', g === null);

  if (g !== null) {
    var f = frasi(t);
    var p = parole(t).length;
    var c = commento(g);

    votoN.textContent = g;
    votoN.className = 'voto-n ' + c.c;
    votoDice.textContent = c.t;
    barraDentro.style.width = g + '%';
    barraDentro.className = c.c;

    nPar.textContent = p.toLocaleString('it-IT');
    nFrasi.textContent = f.length.toLocaleString('it-IT');
    nMedia.textContent = f.length ? Math.round(p / f.length) : 0;

    // Le peggiori tre: più di così diventa un elenco che non si legge.
    frasiLunghe = f.map(function (s) { return { testo: s, n: parole(s).length }; })
                   .filter(function (x) { return x.n > FRASE_LUNGA; })
                   .sort(function (a, b) { return b.n - a.n; })
                   .slice(0, 3);
  } else {
    frasiLunghe = [];
  }

  lungheBox.classList.toggle('hidden', frasiLunghe.length === 0);
  lungheEl.innerHTML = '';
  frasiLunghe.forEach(function (x) {
    var li = document.createElement('li');
    var n = document.createElement('span');
    n.className = 'n-frase';
    n.textContent = x.n + ' parole';
    var s = document.createElement('span');
    s.className = 't-frase';
    s.textContent = x.testo.length > 160 ? x.testo.slice(0, 160) + '…' : x.testo;
    li.appendChild(n); li.appendChild(s);
    lungheEl.appendChild(li);
  });

  var pr = costruisciPrompt();
  promptEl.textContent = pr || 'Incolla un testo qui sopra.';
  promptEl.classList.toggle('vuoto', !pr);
  document.getElementById('vai').disabled = !pr;
  document.getElementById('copia').disabled = !pr;
}

// --- Il prompt --------------------------------------------------------------

function costruisciPrompt() {
  var t = testoEl.value.trim();
  if (!t) return '';

  var g = gulpease(t);
  var obiettivo = g !== null && g >= 60 ? 70 : 60;

  var p = [];
  p.push('Riscrivi il testo qui sotto in italiano più chiaro.');
  p.push('');
  p.push('Chi legge: ' + pubblico.regola + '.');
  p.push('');
  p.push('Regole:');
  p.push('- frasi corte: una cosa per frase, e sotto le venti parole');
  p.push('- verbi attivi, mai il passivo quando puoi evitarlo');
  p.push('- parole di tutti i giorni al posto di quelle lunghe («usare» invece di «utilizzare», «dopo» invece di «successivamente»)');
  p.push('- via le formule vuote: «si rende noto che», «al fine di», «nell\'ambito di»');
  p.push('- l\'ordine è: la cosa importante prima, il contorno dopo');
  VINCOLI.forEach(function (v) { if (vincoliOn[v.id]) p.push('- ' + v.regola); });
  p.push('- non aggiungere niente che non ci sia già: se un passaggio è oscuro perché manca un\'informazione, segnalamelo in fondo invece di inventarla');
  p.push('');

  if (g !== null) {
    p.push('Punto di partenza: indice Gulpease ' + g + ' su 100 (89 + (300 × frasi − 10 × lettere) / parole).');
    p.push('Obiettivo: portarlo sopra ' + obiettivo + ' senza perdere niente di quello che dice.');
  }

  if (frasiLunghe.length) {
    p.push('');
    p.push('Queste frasi sono le più pesanti, spezzale:');
    frasiLunghe.forEach(function (x) {
      p.push('- (' + x.n + ' parole) ' + (x.testo.length > 200 ? x.testo.slice(0, 200) + '…' : x.testo));
    });
  }

  p.push('');
  p.push('Rispondi con il testo riscritto e basta. Sotto, in una riga, dimmi cosa hai tolto.');
  p.push('');
  p.push('Testo:');
  p.push('"""');
  p.push(t);
  p.push('"""');

  return p.join('\n');
}

// --- Le pillole -------------------------------------------------------------

function pillola(contenitore, etichetta, acceso, alClic) {
  var b = document.createElement('button');
  b.type = 'button';
  b.className = 'chip' + (acceso ? ' on' : '');
  b.textContent = etichetta;
  b.addEventListener('click', function () { alClic(b); });
  contenitore.appendChild(b);
  return b;
}

var pubblicoEl = document.getElementById('pubblico');
var vincoliEl = document.getElementById('vincoli');

PUBBLICO.forEach(function (v) {
  pillola(pubblicoEl, v.nome, v === pubblico, function (b) {
    pubblico = v;
    [].forEach.call(pubblicoEl.children, function (x) { x.classList.toggle('on', x === b); });
    aggiorna();
  });
});

VINCOLI.forEach(function (v) {
  pillola(vincoliEl, v.nome, vincoliOn[v.id], function (b) {
    vincoliOn[v.id] = !vincoliOn[v.id];
    // «più corto» e «stessa lunghezza» si contraddicono: accendere uno spegne l'altro.
    if (vincoliOn[v.id] && (v.id === 'corto' || v.id === 'lunghezza')) {
      var opposto = v.id === 'corto' ? 'lunghezza' : 'corto';
      vincoliOn[opposto] = false;
      VINCOLI.forEach(function (w, i) {
        if (w.id === opposto) vincoliEl.children[i].classList.remove('on');
      });
    }
    b.classList.toggle('on', vincoliOn[v.id]);
    aggiorna();
  });
});

// --- Avvio ------------------------------------------------------------------

testoEl.addEventListener('input', aggiorna);

PROMPT.collega({
  vai: 'vai', copia: 'copia', toast: 'toast', evento: 'Semplifica',
  testo: function () { return costruisciPrompt(); }
});

document.getElementById('claude').addEventListener('click', function () {
  var t = costruisciPrompt();
  if (!t) return;
  PROMPT.apri('claude');
  PROMPT.copia(t);
  var toast = document.getElementById('toast');
  toast.textContent = 'Prompt copiato: incollalo nella casella';
  toast.classList.add('show');
  setTimeout(function () { toast.classList.remove('show'); }, 2200);
  if (window.track) track('click', 'Semplifica:claude');
});

aggiorna();
