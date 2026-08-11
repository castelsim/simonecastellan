/* Da comunicato a post.

   Il lavoro vero non è «riscrivi questo per Instagram»: quello lo sa chiedere
   chiunque. È dire all'assistente i due numeri che nessuno ha in testa — dove
   la piattaforma taglia e pubblicare non si può più, e dove compare «altro…» e
   la gente smette di leggere — e vietargli di aggiungere quello che nel testo
   di partenza non c'è.

   I numeri vengono da /comune/specifiche.js: qui dentro non ce n'è nessuno. */

var testoEl  = document.getElementById('testo');
var misuraEl = document.getElementById('misura');
var doveEl   = document.getElementById('dove');
var tonoEl   = document.getElementById('tono');
var extraEl  = document.getElementById('extra');
var promptEl = document.getElementById('prompt');

/* Le voci di SOCIAL_TESTO che sono davvero un post: fuori le biografie, i
   sommari del profilo e l'oggetto di una mail, che non c'entrano nulla con un
   comunicato da spezzare. */
var DA_POST = ['instagram-cap', 'facebook-post', 'linkedin-post', 'x-post', 'tiktok-cap', 'youtube-descr'];

var POSTI = SOCIAL_TESTO.filter(function (v) { return DA_POST.indexOf(v.id) >= 0; });

var TONI = [
  { id: 'diretto',   nome: 'diretto',    regola: 'tono diretto e asciutto, frasi corte, verbi attivi' },
  { id: 'caldo',     nome: 'caldo',      regola: 'tono caldo e vicino, come si parla a qualcuno che conosci, senza sdolcinature' },
  { id: 'sobrio',    nome: 'sobrio',     regola: 'tono sobrio e professionale, senza enfasi e senza superlativi' },
  { id: 'divertito', nome: 'divertito',  regola: 'tono leggero e con un po\' di ironia, mai a spese di nessuno' }
];

var EXTRA = [
  { id: 'hashtag', nome: 'hashtag',        regola: 'da tre a cinque hashtag pertinenti in fondo, mai dentro le frasi', on: true },
  { id: 'invito',  nome: 'invito a fare',  regola: 'chiudi con una cosa precisa da fare (dove, quando, come)',        on: true },
  { id: 'emoji',   nome: 'emoji',          regola: 'qualche emoji, con misura',                                        on: false },
  { id: 'titoli',  nome: 'più versioni',   regola: 'per ogni piattaforma proponi due versioni diverse fra cui scegliere', on: false }
];

// Instagram e LinkedIn sono i due che capitano quasi sempre a chi ha un comunicato.
var scelti = { 'instagram-cap': true, 'linkedin-post': true };
var tono = TONI[0];
var extraOn = {};
EXTRA.forEach(function (e) { extraOn[e.id] = e.on; });

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

function costruisciPillole() {
  POSTI.forEach(function (v) {
    pillola(doveEl, v.piattaforma + ' · ' + v.nome.toLowerCase(), !!scelti[v.id], function (b) {
      scelti[v.id] = !scelti[v.id];
      b.classList.toggle('on', scelti[v.id]);
      aggiorna();
    });
  });

  TONI.forEach(function (t) {
    pillola(tonoEl, t.nome, t === tono, function (b) {
      tono = t;
      [].forEach.call(tonoEl.children, function (x) { x.classList.toggle('on', x === b); });
      aggiorna();
    });
  });

  EXTRA.forEach(function (e) {
    pillola(extraEl, e.nome, extraOn[e.id], function (b) {
      extraOn[e.id] = !extraOn[e.id];
      b.classList.toggle('on', extraOn[e.id]);
      aggiorna();
    });
  });
}

// --- Il prompt --------------------------------------------------------------

/* Il punto delle migliaia va chiesto: in italiano Intl lo mette da cinque cifre
   in su, e nella stessa lista uscivano «massimo 2200» accanto a «massimo
   63.206». */
function numero(n) { return n.toLocaleString('it-IT', { useGrouping: true }); }

/* Una riga per piattaforma, con i due numeri distinti.  Dove il punto di taglio
   è osservato e non dichiarato si scrive «circa»: è la verità, e chi legge
   capisce che non deve trattarlo come una soglia esatta. */
function rigaLimite(v) {
  var r = '- ' + v.piattaforma + ', ' + v.nome.toLowerCase() + ': ';
  if (v.massimo) r += 'massimo ' + numero(v.massimo) + ' caratteri';
  if (v.taglio) {
    if (v.massimo) r += ', ';
    r += 'ma si legge solo fino a ' + (v.taglioIncerto ? 'circa ' : '') + v.taglio +
         ' caratteri, poi compare «altro…»: quello che conta va lì dentro';
  }
  if (v.nota) r += ' (' + v.nota + ')';
  return r + '.';
}

function elencoScelti() {
  return POSTI.filter(function (v) { return scelti[v.id]; });
}

function costruisciPrompt() {
  var quali = elencoScelti();
  var testo = testoEl.value.trim();

  if (!quali.length) return '';

  var p = [];
  p.push('Fai il lavoro di chi cura la comunicazione: dal testo qui sotto ricava un post per ognuna di queste destinazioni.');
  p.push('');
  p.push('Le destinazioni, con i limiti da rispettare:');
  quali.forEach(function (v) { p.push(rigaLimite(v)); });
  p.push('');
  p.push('Come devono essere:');
  p.push('- ' + tono.regola);
  p.push('- comincia dal fatto, non dal contesto: chi legge decide sulla prima riga');
  p.push('- niente formule da comunicato («si comunica che», «in occasione di», «siamo lieti»)');
  EXTRA.forEach(function (e) { if (extraOn[e.id]) p.push('- ' + e.regola); });
  if (!extraOn.emoji) p.push('- nessun emoji');
  p.push('- scrivi in italiano');
  p.push('- non aggiungere niente che non sia nel testo di partenza: se manca un dato che serve (data, ora, luogo, prezzo, indirizzo) scrivi [manca] al posto suo invece di inventarlo');
  p.push('');
  p.push('Rispondi con i post separati dal nome della destinazione, e sotto ognuno il numero di caratteri. Nessun commento.');
  p.push('');
  p.push('Testo di partenza:');
  p.push('"""');
  p.push(testo || '[incolla qui il testo]');
  p.push('"""');

  return p.join('\n');
}

// --- Aggiornamento ----------------------------------------------------------

function aggiorna() {
  var testo = testoEl.value.trim();
  var parole = testo ? testo.split(/\s+/).length : 0;
  misuraEl.textContent = parole
    ? parole.toLocaleString('it-IT') + ' parole da spremere'
    : '';

  var quali = elencoScelti();
  var p = costruisciPrompt();
  promptEl.textContent = p || 'Scegli almeno una destinazione.';
  promptEl.classList.toggle('vuoto', !p);

  var pronto = !!p;
  document.getElementById('vai').disabled = !pronto;
  document.getElementById('copia').disabled = !pronto;
}

// --- Avvio ------------------------------------------------------------------

document.getElementById('agg').textContent = 'Limiti controllati ' + ilGiorno(SOCIAL_TESTO_AGGIORNATO) + '.';

costruisciPillole();
testoEl.addEventListener('input', aggiorna);

PROMPT.collega({
  vai: 'vai', copia: 'copia', toast: 'toast', evento: 'Comunicato',
  testo: function () { return costruisciPrompt(); }
});

document.getElementById('claude').addEventListener('click', function () {
  var t = costruisciPrompt();
  if (!t) return;
  PROMPT.apri('claude');
  PROMPT.copia(t);
  document.getElementById('toast').textContent = 'Prompt copiato: incollalo nella casella';
  document.getElementById('toast').classList.add('show');
  setTimeout(function () { document.getElementById('toast').classList.remove('show'); }, 2200);
  if (window.track) track('click', 'Comunicato:claude');
});

aggiorna();
