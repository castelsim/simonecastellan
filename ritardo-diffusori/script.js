/* Ritardo diffusori — dalla distanza ai millisecondi e viceversa.
   Il suono viaggia a 331,3 + 0,606·T metri al secondo: a 0 °C sono 331 m/s,
   a 30 °C sono 349. Su 40 metri il ballo vale più di 3 ms, per questo la
   temperatura è un campo e non una costante nascosta nel codice. */

var HAAS_MS = 10;          // il "di più" che tiene il suono sul palco
var SR_KHZ = 48;           // campioni mostrati alla frequenza dei mixer digitali

var distInp = document.getElementById('dist');
var msInp   = document.getElementById('ms');
var tempInp = document.getElementById('temp');
var tempVal = document.getElementById('tempVal');
var subOut  = document.getElementById('subOut');
var haasBtn = document.getElementById('haas');
var haasTxt = document.getElementById('haasText');
var toast   = document.getElementById('toast');

var temp = 20;
var dist = 20;             // metri
var ms = 0;

function speed() { return 331.3 + 0.606 * temp; }          // m/s

function num(v) {
  // In italiano si scrive con la virgola: la accetto e la traduco.
  var n = parseFloat(String(v).replace(',', '.').replace(/[^0-9.\-]/g, ''));
  return isFinite(n) ? n : 0;
}

function fmt(n, dec) {
  return n.toFixed(dec === undefined ? 1 : dec).replace('.', ',');
}

function render(fromMs) {
  var v = speed();
  if (fromMs) dist = ms * v / 1000;
  else ms = dist / v * 1000;

  if (document.activeElement !== distInp) distInp.value = fmt(dist, dist >= 100 ? 0 : 1);
  if (document.activeElement !== msInp) msInp.value = fmt(ms, 1);

  subOut.textContent = fmt(dist * 3.28084, 1) + ' ft · ' +
                       Math.round(ms * SR_KHZ) + ' campioni a 48 kHz';
  tempVal.textContent = temp + ' °C · ' + fmt(v, 1) + ' m/s';
  // Il pulsante dice il verbo e il numero che finisce negli appunti; il perché
  // sta scritto sotto, che dentro una pillola non ci sta e non si legge.
  haasTxt.innerHTML = 'Copia <b>' + fmt(ms + HAAS_MS, 1) + ' ms</b>, con ' +
                      HAAS_MS + ' ms in più';
}

function setDist(d) {
  dist = Math.min(500, Math.max(0, d));
  render(false);
}

// --- Interfaccia -----------------------------------------------------------

distInp.addEventListener('input', function () { dist = Math.min(500, Math.max(0, num(distInp.value))); render(false); });
distInp.addEventListener('blur', function () { render(false); });
msInp.addEventListener('input', function () { ms = Math.min(2000, Math.max(0, num(msInp.value))); render(true); });
msInp.addEventListener('blur', function () { render(true); });

document.getElementById('dDown').addEventListener('click', function () { setDist(Math.round((dist - 1) * 10) / 10); });
document.getElementById('dUp').addEventListener('click', function () { setDist(Math.round((dist + 1) * 10) / 10); });

tempInp.addEventListener('input', function () {
  temp = Number(tempInp.value);
  render(false);                       // la distanza è il dato fisico: resta lei
});

function copia(testo, el) {
  function ok() {
    toast.textContent = 'Copiato: ' + testo + ' ms';
    toast.classList.add('show');
    setTimeout(function () { toast.classList.remove('show'); }, 1100);
    if (el) {
      el.classList.add('copied');
      setTimeout(function () { el.classList.remove('copied'); }, 500);
    }
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(testo).then(ok, function () {});
    return;
  }
  var ta = document.createElement('textarea');
  ta.value = testo; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); ok(); } catch (e) {}
  document.body.removeChild(ta);
}

haasBtn.addEventListener('click', function () { copia(fmt(ms + HAAS_MS, 1), haasBtn); });

render(false);
