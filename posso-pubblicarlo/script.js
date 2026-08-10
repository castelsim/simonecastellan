/* Posso pubblicarlo? — il controllo che le piattaforme non ti fanno prima.

   Legge dal file solo ciò che si può leggere in locale — peso, dimensioni,
   proporzioni, durata — e lo confronta con le regole raccolte in
   /comune/specifiche.js. Poi lo dice in italiano, non in gergo, e dove esiste
   uno strumento che sistema la cosa ci mette il pulsante.

   Regola di condotta: si boccia solo su ciò che è certo (un peso oltre il
   limite dichiarato). Su ciò che è incerto si consiglia. */

var dropZone  = document.getElementById('dropZone');
var pickBtn   = document.getElementById('pickBtn');
var fileInput = document.getElementById('fileInput');
var statusBox = document.getElementById('status');
var erroreBox = document.getElementById('error');
var erroreMsg = document.getElementById('erroreMsg');
var esitoBox  = document.getElementById('esito');
var scheda    = document.getElementById('scheda');
var elenco    = document.getElementById('elenco');
var notaFinale= document.getElementById('notaFinale');

function mostra(el, si) { if (el) el.classList.toggle('hidden', !si); }

function pesa(b) {
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return Math.round(b / 1024) + ' KB';
  return (Math.round(b / 1024 / 102.4) / 10).toString().replace('.', ',') + ' MB';
}

function durataUmana(s) {
  s = Math.round(s);
  if (s < 60) return s + ' secondi';
  var m = Math.floor(s / 60), r = s % 60;
  return m + ' min' + (r ? ' ' + r + 's' : '');
}

/* «4:5», «9:16», «16:9»: la gente le proporzioni le chiama così, non 0,5625. */
function nomeRapporto(r) {
  var noti = [[1, '1:1'], [0.8, '4:5'], [0.5625, '9:16'], [1.777, '16:9'], [1.91, '1.91:1'], [0.75, '3:4'], [1.333, '4:3']];
  for (var i = 0; i < noti.length; i++) if (Math.abs(r - noti[i][0]) < 0.02) return noti[i][1];
  return r >= 1 ? (Math.round(r * 100) / 100) + ':1' : '1:' + (Math.round(100 / r) / 100);
}

function versoDi(r) {
  if (Math.abs(r - 1) < 0.02) return 'quadrato';
  return r > 1 ? 'orizzontale' : 'verticale';
}

// --- Lettura del file -------------------------------------------------------

function leggiImmagine(file) {
  return createImageBitmap(file, { imageOrientation: 'from-image' }).then(function (b) {
    var dati = { tipo: 'immagine', w: b.width, h: b.height, peso: file.size, nome: file.name };
    b.close();
    return dati;
  });
}

function leggiVideo(file) {
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
      fine(null, {
        tipo: 'video', w: v.videoWidth, h: v.videoHeight,
        durata: v.duration, peso: file.size, nome: file.name
      });
    };
    v.onerror = function () { fine(new Error('video')); };
    // Un formato che il browser non sa aprire non chiama né l'uno né l'altro.
    setTimeout(function () { fine(new Error('scaduto')); }, 12000);
    v.src = url;
  });
}

// --- Le regole --------------------------------------------------------------

/* Restituisce un esito per ogni uso della piattaforma:
   'ok' | 'attenzione' | 'no', con la frase da mostrare e, se c'è, l'azione. */
function valuta(dati, uso) {
  var problemi = [];
  var r = dati.w / dati.h;

  if (uso.pesoMax && dati.peso > uso.pesoMax) {
    problemi.push({
      gravita: 'no',
      testo: 'pesa ' + pesa(dati.peso) + ', il massimo qui è ' + pesa(uso.pesoMax),
      azione: dati.tipo === 'immagine'
        ? { testo: 'Alleggeriscila', url: '/comprimi-immagini/' } : null
    });
  }

  var min = uso.rapportoMin, max = uso.rapportoMax;
  var tol = uso.tolleranza || 0.03;
  if (min && max) {
    var fuori = r < min - tol || r > max + tol;
    if (fuori) {
      // Frasi al maschile del «formato»: valgono uguali per una foto e per un video.
      var frase;
      if (min === max) {
        frase = 'il tuo formato è ' + versoDi(r) + ' (' + nomeRapporto(r) + '), qui ci vuole ' +
                nomeRapporto(min);
      } else {
        frase = 'il formato è troppo ' + (r > max ? 'largo' : 'stretto') + ' (' + nomeRapporto(r) +
                '): verrà tagliato ai ' + (r > max ? 'lati' : 'bordi sopra e sotto');
      }
      problemi.push({
        gravita: 'attenzione',
        testo: frase,
        azione: dati.tipo === 'immagine'
          ? { testo: 'Sistemala', url: '/immagini-social/' } : null
      });
    }
  }

  if (uso.latoMin && Math.min(dati.w, dati.h) < uso.latoMin) {
    problemi.push({
      gravita: 'attenzione',
      testo: 'ha pochi pixel (' + dati.w + '×' + dati.h + '): uscirà sgranata'
    });
  }

  if (uso.durataMax && dati.durata && dati.durata > uso.durataMax) {
    problemi.push({
      gravita: uso.incerto ? 'attenzione' : 'no',
      testo: 'dura ' + durataUmana(dati.durata) + ', il massimo ' +
             (uso.incerto ? 'dovrebbe essere ' : 'è ') + durataUmana(uso.durataMax)
    });
  }

  if (!problemi.length) return { gravita: 'ok', testo: 'va bene così' };

  var peggiore = problemi.some(function (p) { return p.gravita === 'no'; }) ? 'no' : 'attenzione';
  return {
    gravita: peggiore,
    testo: problemi.map(function (p) { return p.testo; }).join(' · '),
    azione: (problemi.filter(function (p) { return p.azione; })[0] || {}).azione
  };
}

var SEGNI = { ok: '✓', attenzione: '!', no: '✗' };

function mostraEsito(dati) {
  scheda.textContent = dati.nome + ' · ' + dati.w + '×' + dati.h + ' · ' +
    nomeRapporto(dati.w / dati.h) + ' · ' + pesa(dati.peso) +
    (dati.durata ? ' · ' + durataUmana(dati.durata) : '');

  elenco.innerHTML = '';
  var quanteOk = 0, quanteNo = 0;

  SOCIAL.forEach(function (p) {
    var usi = p.usi.filter(function (u) {
      return u.media === 'entrambi' || u.media === dati.tipo;
    });
    if (!usi.length) return;

    var blocco = document.createElement('div');
    blocco.className = 'piattaforma';
    var titolo = document.createElement('h2');
    titolo.className = 'piattaforma-nome';
    titolo.textContent = p.nome;
    blocco.appendChild(titolo);

    usi.forEach(function (u) {
      var e = valuta(dati, u);
      if (e.gravita === 'ok') quanteOk++;
      if (e.gravita === 'no') quanteNo++;

      var riga = document.createElement('div');
      riga.className = 'uso ' + e.gravita;

      var segno = document.createElement('span');
      segno.className = 'segno';
      segno.textContent = SEGNI[e.gravita];
      segno.setAttribute('aria-label',
        e.gravita === 'ok' ? 'va bene' : e.gravita === 'no' ? 'non va' : 'attenzione');

      var testo = document.createElement('span');
      testo.className = 'uso-testo';
      var nome = document.createElement('b');
      nome.textContent = u.nome;
      testo.appendChild(nome);
      testo.appendChild(document.createTextNode(' — ' + e.testo));

      riga.appendChild(segno);
      riga.appendChild(testo);

      if (e.azione) {
        var a = document.createElement('a');
        a.className = 'aggiusta';
        a.href = e.azione.url;
        a.textContent = e.azione.testo;
        riga.appendChild(a);
      }
      blocco.appendChild(riga);
    });

    elenco.appendChild(blocco);
  });

  notaFinale.textContent = quanteNo === 0
    ? 'Nessun blocco: dove c\'è un punto esclamativo il file passa lo stesso, ma la piattaforma decide lei cosa tagliare.'
    : 'Dove c\'è una croce il caricamento verrà rifiutato: conviene sistemarlo prima.';

  mostra(statusBox, false);
  mostra(esitoBox, true);
  mostra(dropZone, false);
  document.querySelector('.claims').classList.add('hidden');
}

// --- Flusso -----------------------------------------------------------------

function errore(testo) {
  mostra(statusBox, false);
  mostra(esitoBox, false);
  mostra(dropZone, true);
  erroreMsg.textContent = testo;
  mostra(erroreBox, true);
}

async function apri(file) {
  mostra(erroreBox, false);
  mostra(esitoBox, false);
  mostra(statusBox, true);

  var immagine = /^image\//.test(file.type) || /\.(jpe?g|png|webp|gif|bmp|avif|heic|heif)$/i.test(file.name);
  var video = /^video\//.test(file.type) || /\.(mp4|mov|m4v|webm|avi|mkv|3gp)$/i.test(file.name);
  if (!immagine && !video) return errore('Questo non sembra né una foto né un video.');

  try {
    var dati = immagine ? await leggiImmagine(file) : await leggiVideo(file);
    if (!dati.w || !dati.h) throw new Error('senza misure');
    mostraEsito(dati);
  } catch (e) {
    errore(immagine
      ? (/heic|heif/i.test(file.name)
          ? 'Questo browser non sa aprire i file HEIC: esporta la foto in JPEG e riprova.'
          : 'Non riesco ad aprire questa immagine: potrebbe essere danneggiata.')
      : 'Questo browser non sa aprire questo video: prova con un MP4.');
  }
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
