/* Metriche social — metti i numeri che hai, esce quello che si può calcolare.

   L'idea è tutta qui: nessun campo obbligatorio. Ogni metrica dichiara di
   quali numeri ha bisogno e come si calcola; la pagina guarda cosa hai
   scritto e mostra solo ciò che regge. Aggiungerne una vuol dire aggiungere
   una riga all'elenco, non toccare l'interfaccia. */

var CAMPI = [
  { id: 'follower',    nome: 'Follower',    aiuto: 'quante persone ti seguono' },
  { id: 'copertura',   nome: 'Copertura',   aiuto: 'persone che hanno visto il contenuto' },
  { id: 'impression',  nome: 'Impression',  aiuto: 'quante volte è stato mostrato' },
  { id: 'like',        nome: 'Like' },
  { id: 'commenti',    nome: 'Commenti' },
  { id: 'condivisioni',nome: 'Condivisioni' },
  { id: 'salvataggi',  nome: 'Salvataggi' },
  { id: 'clic',        nome: 'Clic' },
  { id: 'spesa',       nome: 'Spesa', unita: '€' },
  { id: 'conversioni', nome: 'Conversioni', aiuto: 'iscrizioni, acquisti, richieste…' }
];

/* Ogni metrica: cosa le serve, come si calcola, come si scrive e cosa vuol
   dire in una riga di italiano. */
var METRICHE = [
  {
    id: 'engagement',
    nome: 'Engagement rate',
    serve: function (d) {
      return interazioni(d) !== null && (d.copertura > 0 || d.follower > 0);
    },
    calcola: function (d) {
      var base = d.copertura > 0 ? d.copertura : d.follower;
      return interazioni(d) / base * 100;
    },
    formato: 'percento',
    spiega: function (d, v) {
      var suCosa = d.copertura > 0 ? 'chi ha visto il contenuto' : 'chi ti segue';
      return 'su 100 persone fra ' + suCosa + ', circa ' + arrotonda(v, 0) +
             ' hanno fatto qualcosa (like, commenti, condivisioni, salvataggi)';
    }
  },
  {
    id: 'ctr',
    nome: 'CTR',
    esteso: 'quanti cliccano fra quelli che lo vedono',
    serve: function (d) { return d.clic > 0 && d.impression > 0; },
    calcola: function (d) { return d.clic / d.impression * 100; },
    formato: 'percento',
    spiega: function (d, v) {
      return 'ogni 100 volte che è stato mostrato, ' + arrotonda(v, 1) + ' hanno portato a un clic';
    }
  },
  {
    id: 'cpc',
    nome: 'Costo per clic',
    esteso: 'CPC',
    serve: function (d) { return d.spesa > 0 && d.clic > 0; },
    calcola: function (d) { return d.spesa / d.clic; },
    formato: 'euro',
    spiega: function (d, v) { return 'ogni persona che ha cliccato ti è costata ' + euro(v); }
  },
  {
    id: 'cpm',
    nome: 'Costo per mille',
    esteso: 'CPM',
    serve: function (d) { return d.spesa > 0 && d.impression > 0; },
    calcola: function (d) { return d.spesa / d.impression * 1000; },
    formato: 'euro',
    spiega: function (d, v) { return 'mostrare il contenuto mille volte ti costa ' + euro(v); }
  },
  {
    id: 'conversione',
    nome: 'Tasso di conversione',
    serve: function (d) { return d.conversioni > 0 && d.clic > 0; },
    calcola: function (d) { return d.conversioni / d.clic * 100; },
    formato: 'percento',
    spiega: function (d, v) {
      return 'su 100 persone che hanno cliccato, ' + arrotonda(v, 1) + ' sono arrivate fino in fondo';
    }
  },
  {
    id: 'cpa',
    nome: 'Costo per conversione',
    serve: function (d) { return d.spesa > 0 && d.conversioni > 0; },
    calcola: function (d) { return d.spesa / d.conversioni; },
    formato: 'euro',
    spiega: function (d, v) { return 'ogni risultato ottenuto ti è costato ' + euro(v); }
  },
  {
    id: 'frequenza',
    nome: 'Frequenza',
    serve: function (d) { return d.impression > 0 && d.copertura > 0; },
    calcola: function (d) { return d.impression / d.copertura; },
    formato: 'volte',
    spiega: function (d, v) {
      var n = arrotonda(v, 1);
      return 'ogni persona lo ha visto in media ' + n + ' volte' +
             (v > 3 ? ' — oltre le tre volte di solito la gente si stufa' : '');
    }
  },
  {
    id: 'coperturaSuFollower',
    nome: 'Quanti dei tuoi lo hanno visto',
    serve: function (d) { return d.copertura > 0 && d.follower > 0; },
    calcola: function (d) { return d.copertura / d.follower * 100; },
    formato: 'percento',
    spiega: function (d, v) {
      return v > 100
        ? 'il contenuto è uscito dal tuo pubblico: lo ha visto più gente di quanta ti segua'
        : 'su 100 persone che ti seguono, ' + arrotonda(v, 0) + ' lo hanno visto';
    }
  }
];

function interazioni(d) {
  var somma = 0, trovato = false;
  ['like', 'commenti', 'condivisioni', 'salvataggi'].forEach(function (k) {
    if (d[k] !== null) { somma += d[k]; trovato = true; }
  });
  return trovato ? somma : null;
}

function arrotonda(v, dec) {
  return v.toFixed(dec).replace('.', ',');
}
function euro(v) {
  return (v >= 10 ? v.toFixed(2) : v.toFixed(3)).replace('.', ',') + ' €';
}
function scrivi(v, formato) {
  if (formato === 'percento') return arrotonda(v, v >= 10 ? 1 : 2) + '%';
  if (formato === 'euro') return euro(v);
  if (formato === 'volte') return arrotonda(v, 1) + '×';
  return arrotonda(v, 2);
}

// --- Interfaccia ------------------------------------------------------------

var modulo = document.getElementById('modulo');
var risultati = document.getElementById('risultati');
var vuoto = document.getElementById('vuoto');
var copiaBtn = document.getElementById('copiaBtn');
var puliciBtn = document.getElementById('puliciBtn');
var toast = document.getElementById('toast');

CAMPI.forEach(function (c) {
  var wrap = document.createElement('label');
  wrap.className = 'campo';
  var nome = document.createElement('span');
  nome.className = 'campo-nome';
  nome.textContent = c.nome;
  var inp = document.createElement('input');
  // «text» e non «number»: in Italia si scrive 1.200 o 12,50 e un campo
  // numerico con la virgola resta vuoto senza dire niente.
  inp.type = 'text';
  inp.inputMode = 'decimal';
  inp.id = 'c-' + c.id;
  inp.className = 'campo-input';
  inp.placeholder = c.unita ? c.unita : '';
  inp.setAttribute('aria-label', c.nome + (c.aiuto ? ' — ' + c.aiuto : ''));
  wrap.appendChild(nome);
  if (c.aiuto) {
    var a = document.createElement('span');
    a.className = 'campo-aiuto';
    a.textContent = c.aiuto;
    wrap.appendChild(a);
  }
  wrap.appendChild(inp);
  modulo.appendChild(wrap);
});

function leggi() {
  var d = {};
  CAMPI.forEach(function (c) {
    var t = document.getElementById('c-' + c.id).value.trim();
    if (!t) { d[c.id] = null; return; }
    /* Il punto è la trappola: in «4.200» separa le migliaia, in «4.2» i
       decimali. Si distingue dalla forma — gruppi di tre cifre — perché
       leggere quattromiladuecento come quattro virgola due falsa ogni conto
       che segue, in silenzio. */
    var pulito = t.replace(/[^\d.,-]/g, '');
    if (/,/.test(pulito)) {
      pulito = pulito.replace(/\./g, '').replace(',', '.');       // stile italiano: 1.200,50
    } else if (/^-?\d{1,3}(\.\d{3})+$/.test(pulito)) {
      pulito = pulito.replace(/\./g, '');                          // 4.200 → 4200
    }
    var n = parseFloat(pulito);
    d[c.id] = isFinite(n) ? n : null;
  });
  return d;
}

function aggiorna() {
  var d = leggi();
  var quanti = CAMPI.filter(function (c) { return d[c.id] !== null; }).length;
  risultati.innerHTML = '';

  var uscite = METRICHE.filter(function (m) {
    try { return m.serve(d); } catch (e) { return false; }
  });

  uscite.forEach(function (m) {
    var v = m.calcola(d);
    if (!isFinite(v)) return;
    var box = document.createElement('div');
    box.className = 'metrica';
    var testa = document.createElement('div');
    testa.className = 'metrica-testa';
    var nome = document.createElement('span');
    nome.className = 'metrica-nome';
    nome.textContent = m.nome;
    var val = document.createElement('span');
    val.className = 'metrica-valore';
    val.textContent = scrivi(v, m.formato);
    testa.appendChild(nome);
    testa.appendChild(val);
    var sp = document.createElement('p');
    sp.className = 'metrica-spiega';
    sp.textContent = m.spiega(d, v);
    box.appendChild(testa);
    box.appendChild(sp);
    risultati.appendChild(box);
    box.dataset.testo = m.nome + ': ' + val.textContent;
  });

  vuoto.textContent = uscite.length ? '' :
    (quanti === 0 ? 'Compila anche solo due campi: le metriche compaiono da sole.'
                  : 'Con questi numeri non si calcola ancora niente: aggiungine un altro, per esempio le impression o la spesa.');
  vuoto.classList.toggle('hidden', !!uscite.length);
  copiaBtn.classList.toggle('hidden', !uscite.length);
  puliciBtn.classList.toggle('hidden', quanti === 0);
}

modulo.addEventListener('input', aggiorna);

copiaBtn.addEventListener('click', function () {
  var righe = [].map.call(risultati.querySelectorAll('.metrica'), function (b) { return b.dataset.testo; });
  var testo = righe.join('\n');
  function fatto() {
    toast.textContent = 'copiato';
    toast.classList.add('show');
    setTimeout(function () { toast.classList.remove('show'); }, 1200);
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(testo).then(fatto, function () {});
    return;
  }
  var ta = document.createElement('textarea');
  ta.value = testo; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); fatto(); } catch (e) {}
  document.body.removeChild(ta);
});

puliciBtn.addEventListener('click', function () {
  CAMPI.forEach(function (c) { document.getElementById('c-' + c.id).value = ''; });
  aggiorna();
});

aggiorna();
