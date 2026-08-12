/* Comprimi video — portarlo sotto il peso che chiedono mail e chat.

   Qui non si tocca l'inquadratura: si tocca solo quanti dati al secondo il
   video usa. È una scelta, non una mancanza — le prove dell'11/08/2026 dicono
   che i filtri video (ritagliare, ridimensionare) in WebAssembly costano un
   ordine di grandezza più della sola ricodifica, mentre cambiare il bitrate è
   alla portata. Meglio uno strumento che fa una cosa in un tempo umano che due
   che fanno aspettare cinque minuti.

   Sui tempi c'è una lezione pagata cara (12/08/2026): la prima versione
   sembrava rotta, quattro minuti per sei secondi di video. Non era il
   WebAssembly a essere inadatto, erano i thread — vedi il commento su
   «-threads 1» più sotto. Prima di dare per persa una strada, isolare un
   ingrediente alla volta.

   Il conto è quello: peso = bitrate × durata. Girato al contrario dà il
   bitrate da chiedere per stare sotto un peso, ed è tutto quello che serve —
   più l'onestà di dire prima come verrà, invece di far scoprire dopo che a
   quel peso il video è illeggibile. */

var MB = 1024 * 1024;

// L'audio si tiene basso ma non insultante: sotto i 64 kbps si sente.
var AUDIO_KBPS = 96;

/* Quanto spazio si perde nel contenitore (indici, intestazioni): con MP4 è
   nell'ordine dell'1-2%. Si tiene un margine, perché sforare di 200 KB il
   limite di WhatsApp vuol dire aver lavorato per niente. */
var MARGINE = 0.94;

/* Sotto questi valori l'immagine si sfalda: non sono soglie ufficiali, sono
   quelle sotto cui un video si guarda male e va detto prima. */
var SOGLIE = [
  { minKbps: 2500, dice: 'Si vedrà praticamente come adesso.' },
  { minKbps: 1200, dice: 'Si vedrà bene: qualche dettaglio in meno nelle scene mosse.' },
  { minKbps: 600,  dice: 'Si vedrà discretamente. Nelle scene con molto movimento si noterà.' },
  { minKbps: 300,  dice: 'Si vedrà male: quadretti nei movimenti, dettagli persi.' },
  { minKbps: 0,    dice: 'A questo peso il video diventa quasi illeggibile.' }
];

var dropZone  = document.getElementById('dropZone');
var pickBtn   = document.getElementById('pickBtn');
var fileInput = document.getElementById('fileInput');
var pesoSeg   = document.getElementById('pesoSeg');
var previsione= document.getElementById('previsione');
var scheda    = document.getElementById('scheda');
var verdetto  = document.getElementById('verdetto');
var avvisoMotore = document.getElementById('avvisoMotore');
var statusBox = document.getElementById('status');
var statusText= document.getElementById('statusText');
var progressBar = document.getElementById('progressBar');
var risultato = document.getElementById('risultato');
var esitoEl   = document.getElementById('esito');
var erroreBox = document.getElementById('errore');
var erroreMsg = document.getElementById('erroreMsg');
var condividiBtn = document.getElementById('condividiBtn');

var pesoMax = 25 * MB;
var video = null;        // { file, durata, w, h, peso }
var uscita = null;       // { blob, nome }
var orologio = null;     // il conta-secondi durante la lavorazione

function mostra(el, si) { if (el) el.classList.toggle('hidden', !si); }

function pesa(b) {
  if (b < 1024) return b + ' B';
  if (b < MB) return Math.round(b / 1024) + ' KB';
  return (Math.round(b / MB * 10) / 10).toString().replace('.', ',') + ' MB';
}

function durataUmana(s) {
  s = Math.round(s);
  if (s < 60) return s + ' secondi';
  var m = Math.floor(s / 60), r = s % 60;
  return m + ' min' + (r ? ' ' + r + 's' : '');
}

// --- Lettura del video -------------------------------------------------------

function leggi(file) {
  return new Promise(function (risolvi, rifiuta) {
    var url = URL.createObjectURL(file);
    var v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    var chiuso = false;
    function fine(err, dati) {
      if (chiuso) return;
      chiuso = true;
      URL.revokeObjectURL(url);
      err ? rifiuta(err) : risolvi(dati);
    }
    v.onloadedmetadata = function () {
      fine(null, { file: file, durata: v.duration, w: v.videoWidth, h: v.videoHeight, peso: file.size });
    };
    v.onerror = function () { fine(new Error('illeggibile')); };
    // Un formato che il browser non sa aprire non chiama né l'uno né l'altro.
    setTimeout(function () { fine(new Error('scaduto')); }, 12000);
    v.src = url;
  });
}

// --- Il conto ----------------------------------------------------------------

/* Dal peso voluto al bitrate video da chiedere. Restituisce null se non c'è
   modo di starci dentro: succede con video lunghi e limiti stretti, e dirlo
   subito vale più di provarci. */
function bitrateVideo(pesoObiettivo, durata) {
  var bitTotali = pesoObiettivo * 8 * MARGINE;
  var bitAudio = AUDIO_KBPS * 1000 * durata;
  var kbps = Math.floor((bitTotali - bitAudio) / durata / 1000);
  return kbps >= 80 ? kbps : null;
}

function comeVerra(kbps, w, h) {
  /* La stessa cifra vuol dire cose diverse a seconda di quanti pixel deve
     coprire: 1.000 kbps su un video verticale da telefono sono un conto, sul
     4K un altro. Si normalizza sul numero di pixel, prendendo il 1080p come
     misura di riferimento. */
  var pixel = (w * h) || (1920 * 1080);
  var equivalente = kbps * (1920 * 1080) / pixel;
  for (var i = 0; i < SOGLIE.length; i++) {
    if (equivalente >= SOGLIE[i].minKbps) return SOGLIE[i].dice;
  }
  return SOGLIE[SOGLIE.length - 1].dice;
}

function aggiornaPrevisione() {
  if (!video) return;

  scheda.textContent = video.file.name + ' · ' + durataUmana(video.durata) +
    ' · ' + video.w + '×' + video.h + ' · ' + pesa(video.peso);

  if (video.peso <= pesoMax) {
    verdetto.innerHTML = '<b>È già sotto il limite.</b> Comprimerlo lo peggiorerebbe soltanto: ' +
      'pesa ' + pesa(video.peso) + ' e il tetto è ' + pesa(pesoMax) + '.';
    document.getElementById('viaBtn').disabled = true;
    return;
  }

  var kbps = bitrateVideo(pesoMax, video.durata);
  if (!kbps) {
    verdetto.innerHTML = '<b>Non ci sta.</b> ' + durataUmana(video.durata) +
      ' sotto ' + pesa(pesoMax) + ' vorrebbero meno di 80 kbps: verrebbe fuori una cosa ' +
      'inguardabile. Meglio tagliare il video o alzare il limite.';
    document.getElementById('viaBtn').disabled = true;
    return;
  }

  verdetto.innerHTML = 'Per stare sotto ' + pesa(pesoMax) + ' servono <b>' +
    kbps.toLocaleString('it-IT') + ' kbps</b>. ' + comeVerra(kbps, video.w, video.h) +
    '<br><span class="verdetto-nota">Le dimensioni non cambiano: resta ' +
    video.w + '×' + video.h + '.</span>';
  document.getElementById('viaBtn').disabled = false;
}

// --- Il motore ---------------------------------------------------------------

var motore = null;

function prendiMotore() {
  if (motore) return Promise.resolve(motore);
  if (!window.FFmpeg || !window.FFmpeg.createFFmpeg) {
    return Promise.reject(new Error('niente-motore'));
  }
  if (typeof window.SharedArrayBuffer === 'undefined' || !self.crossOriginIsolated) {
    return Promise.reject(new Error('serve-ricaricare'));
  }
  statusText.textContent = 'Preparo il motore… (solo la prima volta, circa 24 MB)';
  /* Il percorso del core va assoluto: ffmpeg.min.js ha dentro un publicPath
     sbagliato, e con un percorso relativo se lo ritrova anteposto. Sta sotto
     /audio-mp3/ perché è lo stesso motore dell'altro strumento. */
  var ff = window.FFmpeg.createFFmpeg({
    corePath: location.origin + '/audio-mp3/vendor/ffmpeg/ffmpeg-core.js',
    log: false
  });
  return ff.load().then(function () { motore = ff; return ff; });
}

function comprimi() {
  var kbps = bitrateVideo(pesoMax, video.durata);
  if (!kbps) return;

  mostra(previsione, false);
  mostra(erroreBox, false);
  mostra(risultato, false);
  mostra(statusBox, true);
  progressBar.style.width = '2%';

  var estensione = (video.file.name.match(/\.([a-z0-9]+)$/i) || [, 'mp4'])[1].toLowerCase();
  var dentro = 'in.' + estensione;
  var fuori = 'out.mp4';
  var iniziato = Date.now();

  prendiMotore().then(function (ff) {
    statusText.textContent = 'Comprimo…';

    /* La barra ferma è peggio di nessuna barra: chi guarda pensa che si sia
       piantato e chiude la scheda. Il motore non manda sempre un avanzamento —
       provato l'11/08/2026: su un video di dodici secondi è rimasto muto per
       minuti — quindi finché non arriva un numero vero la barra si muove da
       sola, e sotto scorre il tempo trascorso, che è un segno di vita onesto. */
    var haDetto = false;
    orologio = setInterval(function () {
      var s = Math.round((Date.now() - iniziato) / 1000);
      statusText.textContent = 'Comprimo… ' + durataUmana(s);
      if (!haDetto) {
        // avanzamento finto ma dichiarato: si avvicina all'80% e non lo supera
        var finta = 80 * (1 - Math.exp(-s / 45));
        progressBar.style.width = Math.max(2, Math.round(finta)) + '%';
      }
    }, 1000);

    ff.setProgress(function (p) {
      if (p && typeof p.ratio === 'number' && p.ratio > 0 && p.ratio <= 1) {
        haDetto = true;
        progressBar.style.width = Math.max(2, Math.round(p.ratio * 100)) + '%';
      }
    });
    return window.FFmpeg.fetchFile(video.file).then(function (bytes) {
      ff.FS('writeFile', dentro, bytes);
      /* Nessun filtro: solo bitrate. maxrate e bufsize tengono il picco, che
         altrimenti sfora il limite proprio nelle scene mosse — quelle che
         costano di più e capitano quando meno serve. */
      return ff.run(
        '-i', dentro,
        /* «-threads 1» non è una rinuncia: è la differenza fra funzionare e
           non funzionare. Provato il 12/08/2026: un secondo di video 720p
           costa 4,5 secondi con un thread solo e oltre 120 con i thread
           lasciati liberi — trenta volte peggio, non meglio. In WebAssembly
           i thread di x264 non si dividono il lavoro, si ostacolano. */
        '-threads', '1',
        /* superfast invece di veryfast: a parità di peso perde poco più di
           1 dB di PSNR e dimezza l'attesa. Su uno strumento dove si aspetta
           guardando una barra, il secondo risparmiato vale più del decimo di
           decibel. */
        '-c:v', 'libx264', '-preset', 'superfast',
        '-b:v', kbps + 'k', '-maxrate', kbps + 'k', '-bufsize', (kbps * 2) + 'k',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', AUDIO_KBPS + 'k',
        '-movflags', '+faststart',
        fuori
      );
    }).then(function () {
      clearInterval(orologio); orologio = null;
      var dati = ff.FS('readFile', fuori);
      try { ff.FS('unlink', dentro); ff.FS('unlink', fuori); } catch (e) {}
      var blob = new Blob([dati.buffer], { type: 'video/mp4' });
      finito(blob, Math.round((Date.now() - iniziato) / 1000));
    });
  }).catch(function (e) {
    clearInterval(orologio); orologio = null;
    if (e.message === 'serve-ricaricare') {
      return errore('Ci siamo quasi: ricarica la pagina una volta e riprova. ' +
                    'Serve al browser per abilitare il motore.');
    }
    if (e.message === 'niente-motore') {
      return errore('Questo browser non riesce a caricare il motore di compressione. ' +
                    'Prova con Chrome, Edge o Safari aggiornato.');
    }
    errore('Non sono riuscito a comprimere questo video. Se è molto lungo o molto grande, ' +
           'il browser può restare senza memoria: prova con un pezzo più corto.');
  });
}

function finito(blob, secondi) {
  uscita = { blob: blob, nome: video.file.name.replace(/\.[^.]+$/, '') + '-leggero.mp4' };

  var dentroIlLimite = blob.size <= pesoMax;
  esitoEl.innerHTML = '<b>' + pesa(video.peso) + ' → ' + pesa(blob.size) + '</b>' +
    ' <span class="quota">(' + Math.round(100 - blob.size / video.peso * 100) + '% in meno, ' +
    'in ' + durataUmana(secondi) + ')</span><br>' +
    (dentroIlLimite
      ? '<span class="ok">Sta sotto ' + pesa(pesoMax) + '.</span>'
      : '<span class="quasi">È sceso ma resta sopra ' + pesa(pesoMax) +
        ': prova con un limite più basso, o taglia il video.</span>');

  mostra(statusBox, false);
  mostra(risultato, true);

  // «Condividi» ha senso solo dove il sistema sa mandare un file.
  var file = new File([blob], uscita.nome, { type: 'video/mp4' });
  var puo = navigator.canShare && navigator.canShare({ files: [file] });
  mostra(condividiBtn, !!puo);

  if (window.track) track('click', 'ComprimiVideo:fatto');
}

function errore(testo) {
  mostra(statusBox, false);
  mostra(risultato, false);
  erroreMsg.textContent = testo;
  mostra(erroreBox, true);
}

// --- Flusso ------------------------------------------------------------------

function apri(file) {
  var pareVideo = /^video\//.test(file.type) || /\.(mp4|mov|m4v|webm|avi|mkv|3gp|mpg|mpeg|wmv)$/i.test(file.name);
  if (!pareVideo) return errore('Questo non sembra un video.');

  mostra(erroreBox, false);
  mostra(risultato, false);
  statusText.textContent = 'Guardo il video…';
  mostra(statusBox, true);
  progressBar.style.width = '0%';

  leggi(file).then(function (dati) {
    if (!dati.durata || !isFinite(dati.durata)) throw new Error('senza durata');
    video = dati;
    mostra(statusBox, false);
    mostra(dropZone, false);
    document.querySelector('.claims').classList.add('hidden');
    mostra(previsione, true);
    aggiornaPrevisione();
  }).catch(function () {
    errore('Questo browser non sa aprire questo video: se puoi, esporta un MP4 e riprova.');
  });
}

function ricomincia() {
  video = null; uscita = null;
  mostra(previsione, false);
  mostra(risultato, false);
  mostra(erroreBox, false);
  mostra(statusBox, false);
  mostra(dropZone, true);
  document.querySelector('.claims').classList.remove('hidden');
}

// --- Comandi -----------------------------------------------------------------

pesoSeg.addEventListener('click', function (e) {
  var b = e.target.closest('.seg-btn');
  if (!b) return;
  pesoMax = parseInt(b.dataset.mb, 10) * MB;
  [].forEach.call(pesoSeg.querySelectorAll('.seg-btn'), function (x) { x.classList.toggle('active', x === b); });
  aggiornaPrevisione();
});

document.getElementById('viaBtn').addEventListener('click', comprimi);
document.getElementById('altroBtn').addEventListener('click', ricomincia);
document.getElementById('ancoraBtn').addEventListener('click', ricomincia);
document.getElementById('erroreBtn').addEventListener('click', ricomincia);

document.getElementById('scaricaBtn').addEventListener('click', function () {
  if (!uscita) return;
  var a = document.createElement('a');
  a.href = URL.createObjectURL(uscita.blob);
  a.download = uscita.nome;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  if (window.track) track('click', 'ComprimiVideo:scarica');
});

condividiBtn.addEventListener('click', function () {
  if (!uscita) return;
  var file = new File([uscita.blob], uscita.nome, { type: 'video/mp4' });
  navigator.share({ files: [file] }).catch(function () { /* annullato */ });
});

pickBtn.addEventListener('click', function (e) { e.stopPropagation(); fileInput.click(); });
dropZone.addEventListener('click', function () { fileInput.click(); });
dropZone.addEventListener('keydown', function (e) {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
});
fileInput.addEventListener('change', function () {
  if (fileInput.files[0]) apri(fileInput.files[0]);
  fileInput.value = '';
});

['dragenter', 'dragover'].forEach(function (ev) {
  dropZone.addEventListener(ev, function (e) { e.preventDefault(); dropZone.classList.add('dragover'); });
});
['dragleave', 'drop'].forEach(function (ev) {
  dropZone.addEventListener(ev, function (e) { e.preventDefault(); dropZone.classList.remove('dragover'); });
});
dropZone.addEventListener('drop', function (e) {
  if (e.dataTransfer && e.dataTransfer.files[0]) apri(e.dataTransfer.files[0]);
});
window.addEventListener('dragover', function (e) { e.preventDefault(); });
window.addEventListener('drop', function (e) { e.preventDefault(); });

// Se il motore non potrà partire è meglio dirlo prima che dopo il caricamento.
if (typeof window.SharedArrayBuffer === 'undefined') {
  avvisoMotore.textContent = 'Se al primo tentativo chiede di ricaricare la pagina, è normale: ' +
    'serve al browser per accendere il motore.';
}
