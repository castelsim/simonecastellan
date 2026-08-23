/* Trasporta gli accordi — la pagina.
   Il lavoro vero sta in accordi.js, che si prova da riga di comando
   (`node tools/prova-accordi.js`): qui c'è solo quello che tocca lo schermo. */

var dentro   = document.getElementById('dentro');
var fuori    = document.getElementById('fuori');
var stato    = document.getElementById('stato');
var semiEl   = document.getElementById('semitoni');
var unitaEl  = document.getElementById('unita');
var daAEl    = document.getElementById('daA');
var giuBtn   = document.getElementById('giu');
var suBtn    = document.getElementById('su');
var copiaBtn = document.getElementById('copia');
var scambia  = document.getElementById('scambia');
var esempio  = document.getElementById('esempio');
var capoBox  = document.getElementById('capoBox');
var capoTesto= document.getElementById('capoTesto');
var toast    = document.getElementById('toast');
var chips    = [document.getElementById('notIt'), document.getElementById('notEn')];

var semitoni = 0;
var notazione = null;        // null = come l'ha scritto chi legge

var ESEMPIO =
  'Do              Sol           Lam         Fa\n' +
  'La chitarra   che mi hai     dato    è ancora qui\n' +
  'Do            Sol             Fa      Do\n' +
  'Mi ricordo il giorno che sei partito\n' +
  '\n' +
  'Fa        Sol       Do       Lam\n' +
  'Fa freddo, do tutto quello che ho';

/* Il nome della tonalità di partenza e di quella d'arrivo: è l'informazione
   che si cerca davvero («da Do a Sib»), più utile del numero di semitoni. */
function nomeTonalita(testo, salto) {
  var righe = String(testo).split('\n');
  for (var i = 0; i < righe.length; i++) {
    if (!ACCORDI.rigaDiAccordi(righe[i])) continue;
    var parole = righe[i].trim().split(/\s+/);
    for (var j = 0; j < parole.length; j++) {
      var a = ACCORDI.leggiAccordo(parole[j]);
      if (a) {
        var not = notazione || ACCORDI.notazioneDi(testo);
        return ACCORDI.scrivi(a.nota.classe + salto, not, a.nota.classe + salto);
      }
    }
  }
  return null;
}

function contaRighe(testo) {
  var acc = 0, tot = 0;
  String(testo).split('\n').forEach(function (r) {
    if (!r.trim()) return;
    tot++;
    if (ACCORDI.rigaDiAccordi(r)) acc++;
  });
  return { accordi: acc, totali: tot };
}

function aggiorna() {
  var testo = dentro.value;

  semiEl.textContent = (semitoni > 0 ? '+' : '') + semitoni;
  unitaEl.textContent = (Math.abs(semitoni) === 1) ? 'semitono' : 'semitoni';

  if (!testo.trim()) {
    fuori.textContent = '';
    stato.textContent = '';
    daAEl.textContent = '';
    capoBox.classList.add('hidden');
    copiaBtn.disabled = scambia.disabled = true;
    return;
  }

  var conto = contaRighe(testo);
  if (!conto.accordi) {
    /* Dirlo, e dire perché: qui il caso più frequente non è un guasto, è un
       foglio in cui gli accordi stanno in mezzo al testo, fra parentesi
       quadre. Meglio spiegare cosa cerca la pagina che lasciare un risultato
       identico all'ingresso senza una parola. */
    stato.textContent = 'Non trovo righe di accordi. Qui si cercano righe fatte SOLO di ' +
      'accordi, come si scrivono sopra le parole: se i tuoi accordi sono dentro il testo, ' +
      'per ora non li tocco.';
    fuori.textContent = testo;
    daAEl.textContent = '';
    capoBox.classList.add('hidden');
    copiaBtn.disabled = scambia.disabled = false;
    return;
  }

  stato.textContent = conto.accordi + (conto.accordi === 1 ? ' riga di accordi' : ' righe di accordi')
    + ' su ' + conto.totali + '. Le altre non le tocco.';

  fuori.textContent = ACCORDI.trasporta(testo, semitoni,
    notazione ? { notazione: notazione } : {});

  var da = nomeTonalita(testo, 0);
  var a  = nomeTonalita(testo, semitoni);
  daAEl.textContent = (semitoni === 0)
    ? (da ? 'Resta in ' + da + '.' : '')
    : (da && a ? 'Da ' + da + ' a ' + a + '.' : '');

  /* Il capotasto: per chi ha una chitarra in mano la risposta migliore spesso
     non è «ecco gli accordi nuovi» ma «tieni quelli di prima e metti il
     capotasto qui». Si mostra solo quando è praticabile: sopra il settimo
     tasto la chitarra non suona più come una chitarra. */
  var tasto = ACCORDI.capotasto(semitoni);
  if (tasto && tasto <= 7) {
    capoTesto.innerHTML = 'Con la chitarra puoi anche tenere gli accordi di partenza e mettere ' +
      'il <b>capotasto al ' + tasto + '° tasto</b>.';
    capoBox.classList.remove('hidden');
  } else {
    capoBox.classList.add('hidden');
  }

  copiaBtn.disabled = scambia.disabled = false;
}

function muovi(n) {
  semitoni = Math.max(-11, Math.min(11, semitoni + n));
  giuBtn.disabled = semitoni <= -11;
  suBtn.disabled = semitoni >= 11;
  aggiorna();
}

giuBtn.addEventListener('click', function () { muovi(-1); });
suBtn.addEventListener('click', function () { muovi(1); });
dentro.addEventListener('input', aggiorna);

chips.forEach(function (c) {
  c.addEventListener('click', function () {
    notazione = c.dataset.not;
    chips.forEach(function (x) { x.classList.toggle('on', x === c); });
    aggiorna();
  });
});

esempio.addEventListener('click', function () {
  dentro.value = ESEMPIO;
  aggiorna();
});

/* «Riparti da questo»: il foglio trasportato torna in ingresso e il contatore
   si azzera. Serve quando si cerca la tonalità per tentativi — si scende di
   due, si prova a cantare, si scende ancora — e senza questo si perde il conto
   di dove si è arrivati. */
scambia.addEventListener('click', function () {
  dentro.value = fuori.textContent;
  semitoni = 0;
  giuBtn.disabled = suBtn.disabled = false;
  aggiorna();
  avvisa('Ora si riparte da qui');
});

function avvisa(testo) {
  toast.textContent = testo;
  toast.classList.add('on');
  setTimeout(function () { toast.classList.remove('on'); }, 1600);
}

copiaBtn.addEventListener('click', function () {
  var t = fuori.textContent;
  if (!t) return;
  /* Prima il modo sincrono, poi quello moderno: `navigator.clipboard` è
     asincrono e in certi browser fallisce in silenzio se la pagina perde il
     fuoco nel frattempo. Il ripiego con la textarea nascosta funziona sempre. */
  var fatto = false;
  try {
    var ta = document.createElement('textarea');
    ta.value = t;
    ta.style.position = 'fixed'; ta.style.top = '-1000px'; ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    fatto = document.execCommand('copy');
    document.body.removeChild(ta);
  } catch (e) {}
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(t).then(function () {}, function () {});
  }
  avvisa(fatto ? 'Foglio copiato' : 'Copiato');
  if (window.track) window.track('click', 'TrasportaAccordi:copia');
});

aggiorna();
