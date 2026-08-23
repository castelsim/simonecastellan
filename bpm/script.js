'use strict';

// ============================================================
// Calcolatore Delay — dal BPM ai tempi di delay/riverbero.
// Tutto client-side, nessun dato esce dal dispositivo.
//   ms di una nota = (60000 / BPM) * (4 / denominatore)
//   puntato  = ms * 1.5      terzina = ms * 2/3
//   Hz       = 1000 / ms
// ============================================================

var MIN_BPM = 20;
var MAX_BPM = 300;

// Righe della tabella: sigla, denominatore (rispetto al 4/4) e la stessa cosa
// detta in battiti — «1/8» è chiaro solo a chi legge la musica.
var NOTES = [
  { label: '1/1',  denom: 1,  plain: 'una battuta' },
  { label: '1/2',  denom: 2,  plain: 'mezza battuta' },
  { label: '1/4',  denom: 4,  plain: 'un battito' },
  { label: '1/8',  denom: 8,  plain: 'mezzo battito' },
  { label: '1/16', denom: 16, plain: 'un quarto di battito' },
  { label: '1/32', denom: 32, plain: 'un ottavo di battito' }
];

// --- Riferimenti DOM ---
var bpmInput  = document.getElementById('bpm');
var minusBtn  = document.getElementById('minusBtn');
var plusBtn   = document.getElementById('plusBtn');
var tapBtn    = document.getElementById('tapBtn');
var tapHint   = document.getElementById('tapHint');
var advBtn    = document.getElementById('advBtn');
var advPanel  = document.getElementById('advanced');
var rowsEl    = document.getElementById('rows');
var fuoriEl   = document.getElementById('fuoriScala');
var unitBtns  = document.querySelectorAll('.unit');
var toastEl   = document.getElementById('toast');

var unit = 'ms';   // 'ms' | 'hz'

// --- Stato BPM ---
// Il valore per il CALCOLO è sempre dentro i limiti: mentre si scrive, il campo
// passa per «0» e per il vuoto, e senza questa rete la tabella mostrava
// «Infinity ms» (provato: 0 → 60000/0).  Il campo però non si tocca finché si
// scrive, altrimenti il numero salta sotto le dita.
function getBpm() {
  var v = parseFloat(bpmInput.value);
  if (!isFinite(v)) v = 120;
  return clamp(v);
}

/* Il valore si limita, NON si arrotonda (corretto il 23/08/2026).
   Prima ogni BPM passava da Math.round, e i mezzi BPM sparivano in silenzio:
   scritto 93,5, il campo mostrava 93,5 e la tabella calcolava su 94 — 638,3 ms
   sul quarto invece di 641,7, cioè 13,7 ms di scarto su una battuta intera.
   Su un delay ritmico quella deriva si sente, e chi guarda non ha modo di
   accorgersene: il numero che ha scritto è ancora lì.
   I BPM interi sono una convenzione dei metronomi, non della musica: i
   programmi di registrazione li danno con i decimali, e un brano registrato a
   93,5 resta a 93,5. */
function clamp(v) {
  if (v < MIN_BPM) v = MIN_BPM;
  if (v > MAX_BPM) v = MAX_BPM;
  return v;
}

/* Nel CAMPO ci va un numero leggibile: un decimale basta (il TAP produce
   valori come 120,3718…), e lo zero inutile non si scrive. Il conto però usa
   il valore pieno, non questo. */
function perIlCampo(v) {
  // Col PUNTO, non con la virgola: questo è un <input type="number">, e un
  // valore che lui non sa leggere lo fa restare vuoto. Chi scrive la virgola
  // la può scrivere — è il browser a convertirla — ma noi non gliela mettiamo.
  return String(Math.round(v * 10) / 10);
}

function setBpm(v) {
  bpmInput.value = perIlCampo(clamp(v));
  render();
}

// --- Calcolo ---
function noteMs(bpm, denom, kind) {
  var ms = (60000 / bpm) * (4 / denom);
  if (kind === 'dot') ms *= 1.5;
  else if (kind === 'trip') ms *= 2 / 3;
  return ms;
}

// Formatta un valore in ms oppure nel suo equivalente in Hz.
function fmt(ms) {
  if (unit === 'hz') {
    var hz = 1000 / ms;
    return (hz >= 100 ? hz.toFixed(0) : hz.toFixed(2)) + ' Hz';
  }
  return (ms >= 100 ? ms.toFixed(0) : ms.toFixed(1)) + ' ms';
}

// --- Costruzione tabella ---
function buildRows() {
  rowsEl.innerHTML = '';
  NOTES.forEach(function (n) {
    var row = document.createElement('div');
    row.className = 'grid-row';

    var note = document.createElement('span');
    note.className = 'note';
    note.textContent = n.label;
    var plain = document.createElement('small');
    plain.textContent = n.plain;
    note.appendChild(plain);
    row.appendChild(note);

    ['straight', 'dot', 'trip'].forEach(function (kind) {
      var cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cell';
      cell.dataset.denom = n.denom;
      cell.dataset.kind = kind;
      cell.addEventListener('click', function () { copyCell(cell); });
      row.appendChild(cell);
    });

    rowsEl.appendChild(row);
  });
}

// Il campo non si tocca mentre si scrive (vedi getBpm), quindi può restare a
// video un numero diverso da quello su cui la tabella calcola: scritto 9999, la
// tabella lavorava su 300 senza dirlo, e i millisecondi sembravano sbagliati.
// Il rimedio non è forzare il campo — il numero salterebbe sotto le dita — ma
// dichiarare quale valore si sta usando.
function diciSeFuoriScala() {
  var scritto = parseFloat(bpmInput.value);
  var usato = getBpm();
  // Si confronta il valore VERO, non arrotondato: da quando i decimali
  // contano, «93,5» e «93,5» sono uguali e non c'è niente da dichiarare.
  if (bpmInput.value.trim() === '' || !isFinite(scritto) || scritto === usato) {
    fuoriEl.classList.add('hidden');
    fuoriEl.textContent = '';
    return;
  }
  fuoriEl.textContent = scritto > MAX_BPM
    ? 'Sto calcolando su ' + MAX_BPM + ' BPM, il massimo.'
    : 'Sto calcolando su ' + MIN_BPM + ' BPM, il minimo.';
  fuoriEl.classList.remove('hidden');
}

// Aggiorna solo i numeri (senza ricostruire il DOM).
function render() {
  var bpm = getBpm();
  var cells = rowsEl.querySelectorAll('.cell');
  cells.forEach(function (cell) {
    var ms = noteMs(bpm, parseFloat(cell.dataset.denom), cell.dataset.kind);
    cell.textContent = fmt(ms);
  });
  diciSeFuoriScala();
}

// --- Copia negli appunti ---
function copyCell(cell) {
  var text = cell.textContent;
  var done = function () {
    cell.classList.add('copied');
    setTimeout(function () { cell.classList.remove('copied'); }, 350);
    showToast('Copiato: ' + text);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text, done); });
  } else {
    fallbackCopy(text, done);
  }
}

function fallbackCopy(text, done) {
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); done(); } catch (e) {}
  document.body.removeChild(ta);
}

var toastTimer = null;
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 1200);
}

// --- Batti il tempo ---
var taps = [];
var tapReset = null;
function onTap() {
  var now = performance.now();
  // Dopo 2s di pausa ricomincio una nuova serie.
  if (taps.length && now - taps[taps.length - 1] > 2000) taps = [];
  taps.push(now);

  // Feedback visivo a ogni battito.
  tapBtn.classList.add('beat');
  setTimeout(function () { tapBtn.classList.remove('beat'); }, 90);

  if (taps.length >= 2) {
    // Media degli ultimi intervalli (max 8 battiti) per stabilità.
    var recent = taps.slice(-8);
    var sum = 0;
    for (var i = 1; i < recent.length; i++) sum += recent[i] - recent[i - 1];
    var avg = sum / (recent.length - 1);
    var bpm = clamp(60000 / avg);
    bpmInput.value = bpm;
    render();
    tapHint.textContent = bpm + ' BPM da ' + recent.length + ' battiti';
  } else {
    tapHint.textContent = 'Continua a battere…';
  }

  clearTimeout(tapReset);
  tapReset = setTimeout(function () {
    tapHint.textContent = 'Non sai la velocità? Batti il tempo qui col dito.';
    taps = [];
  }, 2500);
}

// --- Eventi UI ---
minusBtn.addEventListener('click', function () { setBpm(getBpm() - 1); });
plusBtn.addEventListener('click', function () { setBpm(getBpm() + 1); });

bpmInput.addEventListener('input', render);
bpmInput.addEventListener('change', function () { setBpm(getBpm()); });
// Le frecce su/giù muovono il BPM anche tenendo il focus nel campo.
bpmInput.addEventListener('keydown', function (e) {
  if (e.key === 'ArrowUp')   { e.preventDefault(); setBpm(getBpm() + 1); }
  if (e.key === 'ArrowDown') { e.preventDefault(); setBpm(getBpm() - 1); }
});

// Il battito conta quando il dito TOCCA (pointerdown), non quando si stacca:
// il rilascio ha una durata variabile che sporcherebbe il tempo misurato.
// Il click resta solo per la tastiera (Enter): quei click hanno e.detail === 0.
if (window.PointerEvent) {
  tapBtn.addEventListener('pointerdown', onTap);
  tapBtn.addEventListener('click', function (e) { if (e.detail === 0) onTap(); });
} else {
  tapBtn.addEventListener('click', onTap);
}
// La barra spaziatrice batte il tempo (comodo da tastiera).
window.addEventListener('keydown', function (e) {
  if (e.code === 'Space' && document.activeElement !== bpmInput) {
    e.preventDefault();
    onTap();
  }
});

unitBtns.forEach(function (btn) {
  btn.addEventListener('click', function () {
    unit = btn.dataset.unit;
    unitBtns.forEach(function (b) { b.classList.toggle('active', b === btn); });
    render();
  });
});

// --- Mostra / nascondi i tempi (animato) ---
advBtn.addEventListener('click', function () {
  var open = advPanel.classList.toggle('open');
  tapBtn.classList.toggle('compact', open);
  advBtn.textContent = open ? 'Nascondi i tempi' : 'Mostra i tempi';
});

// --- Avvio ---
buildRows();
render();
