/* Estrai un fotogramma — una foto presa dal video, alla risoluzione piena.

   Qui non serve nessuna libreria: un <video> sa già decodificare, e un canvas
   sa già disegnare quello che il video mostra in quel momento. Il lavoro sta
   nel rendere facile scegliere l'istante — una striscia di anteprime per
   arrivare vicino, i passi da un fotogramma per centrare — e nel dare in mano
   un file con le misure vere del video, non uno screenshot. */

var PASSO = 1 / 25;          // un fotogramma a venticinque al secondo: buono per tutti

// Il <video> si prende subito, insieme agli altri elementi: prima lo si
// riempiva solo all'apertura del file, ma più in basso c'è chi gli attacca
// un ascoltatore appena lo script parte — e su «undefined» non si attacca
// niente, l'errore fermava tutto il resto della pagina.
var video = document.getElementById('video');
var urlVideo = null, formato = 'jpg', nomeBase = '';
var scartati = 0;            // quanti file sono stati lasciati fuori dalla scelta

var dropZone  = document.getElementById('dropZone');
var pickBtn   = document.getElementById('pickBtn');
var fileInput = document.getElementById('fileInput');
var erroreBox = document.getElementById('error');
var erroreMsg = document.getElementById('erroreMsg');
var lavoroBox = document.getElementById('lavoro');
var scheda    = document.getElementById('schedaVideo');
var barra     = document.getElementById('barra');
var tempoEl   = document.getElementById('tempo');
var striscia  = document.getElementById('striscia');
var salvaBtn  = document.getElementById('salvaBtn');
var condividiBtn = document.getElementById('condividiBtn');
var playBtn   = document.getElementById('playBtn');
var toast     = document.getElementById('toast');

function mostra(el, si) { if (el) el.classList.toggle('hidden', !si); }
function avvisa(t) {
  toast.textContent = t;
  toast.classList.add('show');
  setTimeout(function () { toast.classList.remove('show'); }, 1800);
}

function orologio(s) {
  s = Math.max(0, s);
  var m = Math.floor(s / 60);
  var r = Math.floor(s % 60);
  return m + ':' + (r < 10 ? '0' : '') + r;
}
function perIlNome(s) {
  var m = Math.floor(s / 60), r = Math.floor(s % 60), c = Math.floor((s % 1) * 100);
  return (m < 10 ? '0' : '') + m + '-' + (r < 10 ? '0' : '') + r + '-' + (c < 10 ? '0' : '') + c;
}

// --- Apertura ---------------------------------------------------------------

function apri(file) {
  mostra(erroreBox, false);

  /* Un file vuoto finiva su «potrebbe essere danneggiato», che manda a cercare
     un guasto dove il guasto non c'è: il file non contiene niente, e succede
     quando un trasferimento si interrompe. */
  if (file.size === 0) {
    return errore('Questo file è vuoto: dentro non c\'è nessun video. ' +
                  'Se te l\'hanno mandato, fattelo rimandare.');
  }

  if (urlVideo) URL.revokeObjectURL(urlVideo);
  urlVideo = URL.createObjectURL(file);
  nomeBase = file.name.replace(/\.[^.]+$/, '').replace(/[^\w\-. ]+/g, '').trim() || 'video';

  /* Fra la scelta del file e la prima immagine possono passare quindici
     secondi, e finora la pagina non diceva niente: restava com'era, come se il
     pulsante non avesse funzionato. Adesso lo dice, e se ci mette troppo lo
     ripete spiegando perché. */
  var risolto = false;
  avvisa('Apro il video…');
  var lenta = setTimeout(function () {
    if (!risolto) avvisa('Ci sto mettendo più del solito: forse è un formato che il browser non conosce…');
  }, 4000);

  var scaduto = setTimeout(function () {
    if (!risolto) errore('Questo browser non riesce ad aprire il video: prova con un MP4.');
  }, 15000);

  video.onloadedmetadata = function () {
    risolto = true;
    clearTimeout(scaduto);
    clearTimeout(lenta);
    scheda.textContent = file.name + ' · ' + video.videoWidth + '×' + video.videoHeight +
                         ' · ' + orologio(video.duration) +
                         // Se ne erano arrivati tanti, si lavora il primo e lo si dice.
                         (scartati > 0
                           ? ' · un video alla volta: ' + (scartati === 1 ? 'l\'altro lo' : 'gli altri ' + scartati + ' li') + ' puoi fare dopo'
                           : '');
    barra.max = Math.max(1, Math.round(video.duration * 100));
    barra.value = 0;
    mostra(lavoroBox, true);
    mostra(dropZone, false);
    document.querySelector('.claims').classList.add('hidden');
    mostra(condividiBtn, !!navigator.canShare);
    vaiA(Math.min(0.1, video.duration / 2));      // il primo fotogramma è spesso nero
    costruisciStriscia();
  };
  video.onerror = function () {
    risolto = true;
    clearTimeout(scaduto);
    clearTimeout(lenta);
    errore('Non riesco ad aprire questo video: dentro non c\'è un filmato, oppure è rovinato. ' +
           'Se puoi, esporta un MP4 e riprova.');
  };
  video.src = urlVideo;
}

function errore(t) {
  mostra(lavoroBox, false);
  mostra(dropZone, true);
  erroreMsg.textContent = t;
  mostra(erroreBox, true);
}

// --- Spostarsi nel video ----------------------------------------------------

function vaiA(t) {
  t = Math.max(0, Math.min(video.duration - 0.01, t));
  video.currentTime = t;
  barra.value = Math.round(t * 100);
  tempoEl.textContent = orologio(t);
}

barra.addEventListener('input', function () { vaiA(Number(barra.value) / 100); });
video.addEventListener('timeupdate', function () {
  if (video.paused) return;                       // mentre si trascina comanda la barra
  barra.value = Math.round(video.currentTime * 100);
  tempoEl.textContent = orologio(video.currentTime);
});

document.getElementById('indietro').addEventListener('click', function () { vaiA(video.currentTime - PASSO); });
document.getElementById('avanti').addEventListener('click', function () { vaiA(video.currentTime + PASSO); });
document.getElementById('indietroMolto').addEventListener('click', function () { vaiA(video.currentTime - 1); });
document.getElementById('avantiMolto').addEventListener('click', function () { vaiA(video.currentTime + 1); });

playBtn.addEventListener('click', function () {
  if (video.paused) { video.play(); playBtn.textContent = '⏸'; }
  else { video.pause(); playBtn.textContent = '▶'; }
});
video.addEventListener('pause', function () { playBtn.textContent = '▶'; });
video.addEventListener('play', function () { playBtn.textContent = '⏸'; });

/* Sei anteprime lungo il video: si arriva vicino con un tocco, invece di
   trascinare alla cieca una barra. Si disegnano una alla volta, aspettando
   che il video sia davvero arrivato dove gli si è chiesto. */
function costruisciStriscia() {
  striscia.innerHTML = '';
  var quante = 6;
  var istanti = [];
  for (var i = 0; i < quante; i++) istanti.push(video.duration * (i + 0.5) / quante);

  var lettore = document.createElement('video');
  lettore.muted = true;
  lettore.playsInline = true;
  lettore.preload = 'metadata';
  lettore.src = urlVideo;

  lettore.onloadedmetadata = function () {
    var i = 0;
    function prossima() {
      if (i >= istanti.length) { lettore.src = ''; return; }
      var t = istanti[i];
      lettore.onseeked = function () {
        var c = document.createElement('canvas');
        var h = 74;
        c.height = h;
        c.width = Math.max(1, Math.round(h * lettore.videoWidth / lettore.videoHeight));
        c.getContext('2d').drawImage(lettore, 0, 0, c.width, c.height);
        c.className = 'mini';
        c.title = orologio(t);
        c.addEventListener('click', function () { vaiA(t); });
        striscia.appendChild(c);
        i++;
        prossima();
      };
      lettore.currentTime = t;
    }
    prossima();
  };
}

// --- Salvataggio ------------------------------------------------------------

function disegnaFotogramma() {
  var c = document.createElement('canvas');
  c.width = video.videoWidth;
  c.height = video.videoHeight;
  c.getContext('2d').drawImage(video, 0, 0, c.width, c.height);
  return c;
}

function fotogramma() {
  var c = disegnaFotogramma();
  var tipo = formato === 'png' ? 'image/png' : 'image/jpeg';
  return new Promise(function (r) {
    c.toBlob(function (b) {
      c.width = c.height = 0;
      r({ blob: b, nome: nomeBase + '_' + perIlNome(video.currentTime) + (formato === 'png' ? '.png' : '.jpg') });
    }, tipo, tipo === 'image/jpeg' ? 0.92 : undefined);
  });
}

salvaBtn.addEventListener('click', async function () {
  if (!video || !video.videoWidth) return;
  var f = await fotogramma();
  var url = URL.createObjectURL(f.blob);
  var a = document.createElement('a');
  a.href = url; a.download = f.nome;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  avvisa(f.nome + ' · ' + video.videoWidth + '×' + video.videoHeight);
});

condividiBtn.addEventListener('click', async function () {
  var f = await fotogramma();
  try {
    var file = new File([f.blob], f.nome, { type: f.blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: f.nome });
    } else avvisa('questo dispositivo non sa condividere i file');
  } catch (e) { /* annullato */ }
});

document.getElementById('formatoSeg').addEventListener('click', function (e) {
  var b = e.target.closest('.seg-btn');
  if (!b) return;
  formato = b.dataset.fmt;
  [].forEach.call(this.querySelectorAll('.seg-btn'), function (x) { x.classList.toggle('active', x === b); });
});

// --- Ingresso file ----------------------------------------------------------

function accetta(list) {
  var tutti = [].slice.call(list || []);
  // Dialogo chiuso senza scegliere: non è successo niente, e non si dice niente.
  if (!tutti.length) return;

  // Non «video»: quello è già il <video> della pagina, e chiamarlo uguale qui
  // dentro nasconderebbe l'elemento vero a chi legge.
  var filmati = tutti.filter(function (x) {
    return /^video\//.test(x.type) || /\.(mp4|mov|m4v|webm|avi|mkv|3gp)$/i.test(x.name);
  });
  if (!filmati.length) {
    return errore('Questo non sembra un video: qui vanno i filmati (MP4, MOV, WEBM, AVI, MKV). ' +
                  'Se è già una foto, non serve estrarne un fotogramma.');
  }
  scartati = filmati.length - 1;
  apri(filmati[0]);
}

document.getElementById('erroreBtn').addEventListener('click', function () {
  mostra(erroreBox, false);
  fileInput.click();
});
document.getElementById('cambiaBtn').addEventListener('click', function () { fileInput.click(); });

pickBtn.addEventListener('click', function (e) { e.stopPropagation(); fileInput.click(); });
dropZone.addEventListener('click', function () { fileInput.click(); });
dropZone.addEventListener('keydown', function (e) {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
});
fileInput.addEventListener('change', function () {
  accetta(fileInput.files);
  fileInput.value = '';
});

['dragenter', 'dragover'].forEach(function (ev) {
  dropZone.addEventListener(ev, function (e) { e.preventDefault(); dropZone.classList.add('dragover'); });
});
['dragleave', 'drop'].forEach(function (ev) {
  dropZone.addEventListener(ev, function (e) { e.preventDefault(); dropZone.classList.remove('dragover'); });
});
dropZone.addEventListener('drop', function (e) {
  if (e.dataTransfer && e.dataTransfer.files.length) accetta(e.dataTransfer.files);
});
window.addEventListener('dragover', function (e) { e.preventDefault(); });
window.addEventListener('drop', function (e) { e.preventDefault(); });

// Le frecce spostano di un fotogramma anche da tastiera.
document.addEventListener('keydown', function (e) {
  if (!video || !video.videoWidth || e.target.tagName === 'INPUT') return;
  if (e.key === 'ArrowLeft') { e.preventDefault(); vaiA(video.currentTime - (e.shiftKey ? 1 : PASSO)); }
  if (e.key === 'ArrowRight') { e.preventDefault(); vaiA(video.currentTime + (e.shiftKey ? 1 : PASSO)); }
});
