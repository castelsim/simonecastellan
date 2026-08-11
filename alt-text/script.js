/* Alt text.

   La prima domanda non è «cosa scrivo», è «questa immagine dice qualcosa?».
   Se è lì per far bello il testo alternativo va lasciato VUOTO, e quasi nessuno
   lo sa: si scrive «immagine decorativa» e si costringe chi ascolta a sentirsi
   leggere una riga inutile per ogni riquadro della pagina.

   Le tre cose che rovinano un alt text, in ordine di frequenza:
     1. comincia con «immagine di» — il lettore di schermo ha già annunciato che
        è un'immagine, quindi si sente «immagine, immagine di un chitarrista»;
     2. descrive i pixel invece di dire la cosa per cui l'immagine sta lì;
     3. se dentro l'immagine c'è del testo, quel testo non viene riportato: per
        chi non vede, semplicemente non esiste.

   I 125 caratteri non sono una legge: sono la soglia oltre la quale alcuni
   lettori di schermo più vecchi troncano, ed è comunque un limite sano — se
   servono tre righe, l'immagine va spiegata nella pagina, non nell'attributo. */

var MAX = 125;

var RUOLI = [
  { id: 'informativa', nome: 'dice qualcosa',   spiega: 'Racconta cosa mostra e perché è lì. Descrivi la cosa che conta, non ogni dettaglio.' },
  { id: 'decorativa',  nome: 'sta lì per bello', spiega: 'Non aggiunge niente al testo intorno: sfondo, texture, riempimento.' },
  { id: 'link',        nome: 'è un pulsante',   spiega: 'Descrivi dove porta, non com\'è fatta: chi ascolta deve sapere cosa succede se la tocca.' },
  { id: 'testo',       nome: 'contiene scritte', spiega: 'Le parole dentro l\'immagine vanno riportate: per chi non vede, altrimenti non esistono.' }
];

var ruolo = RUOLI[0];

var ruoloEl   = document.getElementById('ruolo');
var spiegaEl  = document.getElementById('spiegaRuolo');
var vuotoBox  = document.getElementById('vuotoBox');
var pienoEl   = document.getElementById('pieno');
var descrEl   = document.getElementById('descr');
var dentroEl  = document.getElementById('dentro');
var testoBox  = document.getElementById('testoBox');
var nCar      = document.getElementById('nCar');
var avvisiEl  = document.getElementById('avvisi');
var codiceEl  = document.getElementById('codice');
var promptEl  = document.getElementById('prompt');
var copiaAlt  = document.getElementById('copiaAlt');
var toast     = document.getElementById('toast');

function avvisa(t) {
  toast.textContent = t;
  toast.classList.add('show');
  setTimeout(function () { toast.classList.remove('show'); }, 2200);
}

// --- Le pillole -------------------------------------------------------------

RUOLI.forEach(function (r) {
  var b = document.createElement('button');
  b.type = 'button';
  b.className = 'chip' + (r === ruolo ? ' on' : '');
  b.textContent = r.nome;
  b.addEventListener('click', function () {
    ruolo = r;
    [].forEach.call(ruoloEl.children, function (x) { x.classList.toggle('on', x === b); });
    aggiorna();
  });
  ruoloEl.appendChild(b);
});

// --- Il testo alternativo ---------------------------------------------------

/* Le virgolette dentro un attributo lo chiudono a metà e rompono la pagina:
   diventano l'entità.  Anche le & vanno tradotte, o un «&amp;» scritto a mano
   viene letto due volte. */
function perAttributo(s) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function altScritto() {
  var d = descrEl.value.trim().replace(/\s+/g, ' ');
  var dentro = dentroEl.value.trim().replace(/\s+/g, ' ');
  if (ruolo.id === 'testo' && dentro) {
    // Il testo dentro l'immagine va per primo: è la parte che si perde.
    return d ? dentro + ' — ' + d : dentro;
  }
  return d;
}

var CATTIVI_INIZI = [
  { re: /^(l')?immagine (di|che|con)?/i, dice: 'Togli «immagine di»: chi ascolta sa già che è un\'immagine, se lo sentirebbe dire due volte.' },
  { re: /^(una |la |un )?foto( di| che| del| della)?/i, dice: 'Togli «foto di»: si arriva prima al contenuto.' },
  { re: /^(uno )?screenshot( di| della)?/i, dice: 'Invece di «screenshot», di\' cosa mostra la schermata.' },
  { re: /^(l')?icona( di| del)?/i, dice: 'Invece di «icona», di\' cosa rappresenta o dove porta.' }
];

var GENERICHE = ['immagine', 'foto', 'logo', 'grafica', 'banner', 'copertina', 'img', 'photo'];

function controlla(alt) {
  var problemi = [];
  var pulito = alt.trim();

  if (!pulito) return problemi;

  CATTIVI_INIZI.forEach(function (c) {
    if (c.re.test(pulito)) problemi.push(c.dice);
  });

  if (GENERICHE.indexOf(pulito.toLowerCase().replace(/[.!]$/, '')) >= 0) {
    problemi.push('«' + pulito + '» non dice niente a chi non vede: è come non scrivere nulla.');
  }

  if (pulito.length > MAX) {
    problemi.push('Sono ' + pulito.length + ' caratteri: oltre i ' + MAX + ' alcuni lettori di schermo tagliano. Se serve dire di più, dillo nella pagina.');
  }

  if (ruolo.id === 'testo' && !dentroEl.value.trim()) {
    problemi.push('Hai detto che dentro ci sono delle scritte: riportale, sono la parte che si perde.');
  }

  if (ruolo.id === 'link' && !/\b(porta|apri|apre|vai|scarica|torna|verso|pagina|profilo|sito)\b/i.test(pulito)) {
    problemi.push('È un pulsante: chi ascolta deve capire dove finisce se lo tocca.');
  }

  return problemi;
}

// --- Il prompt --------------------------------------------------------------

function costruisciPrompt() {
  var p = [];
  p.push('Scrivimi il testo alternativo (alt text) in italiano per l\'immagine che ti allego.');
  p.push('');
  p.push('Regole:');
  p.push('- una frase sola, massimo ' + MAX + ' caratteri');
  p.push('- non cominciare con «immagine di», «foto di», «screenshot di»: chi ascolta lo sa già');
  p.push('- descrivi quello che conta, non ogni dettaglio: se dovessi togliere l\'immagine, cosa andrebbe perso?');

  if (ruolo.id === 'link') {
    p.push('- l\'immagine è un pulsante o un link: di\' dove porta, non com\'è fatta');
  }
  if (ruolo.id === 'testo') {
    p.push('- dentro l\'immagine c\'è del testo: riportalo per intero, è la parte che altrimenti si perde');
  }

  p.push('- niente elenchi di colori e di posizioni se non servono a capire');
  p.push('- non inventare nomi di persone, luoghi o marchi: se non li riconosci con certezza, descrivi e basta');
  p.push('');

  var d = descrEl.value.trim();
  if (d) {
    p.push('Quello che so io dell\'immagine: ' + d);
    p.push('');
  }

  p.push('Rispondi con il solo testo alternativo, senza virgolette e senza commenti.');

  return p.join('\n');
}

// --- Aggiornamento ----------------------------------------------------------

function aggiorna() {
  spiegaEl.textContent = ruolo.spiega;

  var decorativa = ruolo.id === 'decorativa';
  vuotoBox.classList.toggle('hidden', !decorativa);
  pienoEl.classList.toggle('hidden', decorativa);
  testoBox.classList.toggle('hidden', ruolo.id !== 'testo');

  if (decorativa) return;

  var alt = altScritto();
  var n = alt.length;

  nCar.textContent = n;
  nCar.className = n > MAX ? 'fuori' : (n > MAX * 0.8 ? 'giusto' : '');

  var problemi = controlla(alt);
  avvisiEl.innerHTML = '';
  problemi.forEach(function (t) {
    var li = document.createElement('li');
    li.textContent = t;
    avvisiEl.appendChild(li);
  });

  codiceEl.textContent = alt
    ? '<img src="…" alt="' + perAttributo(alt) + '">'
    : '<img src="…" alt="…">';
  codiceEl.classList.toggle('vuoto', !alt);
  copiaAlt.disabled = !alt;

  promptEl.textContent = costruisciPrompt();
}

// --- Azioni -----------------------------------------------------------------

copiaAlt.addEventListener('click', function () {
  PROMPT.copia(codiceEl.textContent);
  avvisa('Codice copiato');
  if (window.track) track('click', 'AltText:copia');
});

document.getElementById('copiaVuoto').addEventListener('click', function () {
  PROMPT.copia('<img src="…" alt="">');
  avvisa('Codice copiato');
  if (window.track) track('click', 'AltText:vuoto');
});

PROMPT.collega({
  vai: 'vai', copia: 'copia', toast: 'toast', evento: 'AltText',
  testo: function () { return costruisciPrompt(); }
});

document.getElementById('claude').addEventListener('click', function () {
  PROMPT.apri('claude');
  PROMPT.copia(costruisciPrompt());
  avvisa('Prompt copiato: incollalo nella casella');
  if (window.track) track('click', 'AltText:claude');
});

descrEl.addEventListener('input', aggiorna);
dentroEl.addEventListener('input', aggiorna);

aggiorna();
