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

// Righe della tabella: etichetta, nome esteso, denominatore (rispetto al 4/4).
var NOTES = [
  { label: '1/1',  name: 'Intero',          denom: 1  },
  { label: '1/2',  name: 'Mezza',           denom: 2  },
  { label: '1/4',  name: 'Quarto',          denom: 4  },
  { label: '1/8',  name: 'Ottavo',          denom: 8  },
  { label: '1/16', name: 'Sedicesimo',      denom: 16 },
  { label: '1/32', name: 'Trentaduesimo',   denom: 32 },
  { label: '1/64', name: 'Pre-delay',       denom: 64 }
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
var unitBtns  = document.querySelectorAll('.unit');
var toastEl   = document.getElementById('toast');

var unit = 'ms';   // 'ms' | 'hz'

// --- Stato BPM ---
function getBpm() {
  var v = parseFloat(bpmInput.value);
  if (!isFinite(v)) v = 120;
  return v;
}

function clamp(v) {
  v = Math.round(v);
  if (v < MIN_BPM) v = MIN_BPM;
  if (v > MAX_BPM) v = MAX_BPM;
  return v;
}

function setBpm(v) {
  bpmInput.value = clamp(v);
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
    note.innerHTML = n.label + '<small>' + n.name + '</small>';
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

// Aggiorna solo i numeri (senza ricostruire il DOM).
function render() {
  var bpm = getBpm();
  var cells = rowsEl.querySelectorAll('.cell');
  cells.forEach(function (cell) {
    var ms = noteMs(bpm, parseFloat(cell.dataset.denom), cell.dataset.kind);
    cell.textContent = fmt(ms);
  });
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
    tapHint.textContent = 'Tocca a ritmo per ricavare il BPM.';
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

tapBtn.addEventListener('click', onTap);
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

// --- Toggle Avanzate ---
advBtn.addEventListener('click', function () {
  var open = !advPanel.classList.contains('hidden');
  advPanel.classList.toggle('hidden', open);
  advBtn.textContent = open ? 'Avanzate' : 'Chiudi';
});

// --- Avvio ---
buildRows();
render();
