/* Tara un impianto — l'orchestra.

   Il gesto è uno: premi «Misura». La pagina manda il rumore rosa, ascolta con
   il microfono, e dopo una decina di secondi dice com'è fatto l'impianto e
   cosa toccare.

   Il pezzo forte non si vede: il segnale di riferimento non arriva da un cavo,
   lo generiamo noi. Va allo stesso nodo di cattura del microfono, quindi i due
   flussi sono sincroni per costruzione. È il motivo per cui qui non serve
   l'interfaccia audio a due canali che Smaart pretende. */

(function () {

  var DURATA = 10;              // secondi di misura
  var PER_RITARDO = 2;          // i primi secondi servono ad allineare
  var LIVELLO_DB = -18;

  var ctx = null, worklet = null, sorgente = null, mediaStream = null;
  var analizzatore = null, rtaTimer = null;
  var bande = null, grafico = null;
  var congelata = null, ultima = null;
  var inCorso = false;
  var ultimiScritti = 0;      // quanti campioni ha raccolto il worklet finora

  var autoprova = /[?&]autoprova=1/.test(location.search);

  function $(id) { return document.getElementById(id); }
  function mostra(id, si) { var e = $(id); if (e) e.hidden = !si; }

  function testo(id, t) { var e = $(id); if (e) e.textContent = t; }

  /* ── L'ingresso ───────────────────────────────────────────────────────
     Le tre cose da spegnere sono la parte più importante di tutta la
     funzione: cancellazione dell'eco, riduzione del rumore e guadagno
     automatico sono fatti per far capire la voce al telefono, e falsano
     ogni misura. Il guadagno automatico da solo appiattisce la curva
     mentre la misuri: vedresti un impianto perfetto sempre. */
  function chiediMicrofono() {
    return navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 1
      }
    });
  }

  /* Chiedere non è ottenere: alcuni dispositivi accettano il vincolo e fanno
     quel che vogliono. Si guarda cosa è stato concesso davvero e, se il
     guadagno automatico è rimasto acceso, lo si dice — meglio una misura
     dichiarata inaffidabile che una falsa creduta buona. */
  function controllaIngresso(stream) {
    var t = stream.getAudioTracks()[0];
    var s = t.getSettings ? t.getSettings() : {};
    var brutte = [];
    if (s.autoGainControl === true) brutte.push('il guadagno automatico');
    if (s.noiseSuppression === true) brutte.push('la riduzione del rumore');
    if (s.echoCancellation === true) brutte.push('la cancellazione dell\'eco');
    return brutte;
  }

  function fermaTutto() {
    if (rtaTimer) { clearInterval(rtaTimer); rtaTimer = null; }
    try { if (sorgente) sorgente.stop(); } catch (e) {}
    sorgente = null;
    if (mediaStream) {
      mediaStream.getTracks().forEach(function (t) { t.stop(); });
      mediaStream = null;
    }
    inCorso = false;
  }

  /* ── La misura ────────────────────────────────────────────────────────── */

  function misura() {
    if (inCorso) return;
    inCorso = true;
    mostra('erroreBox', false);
    mostra('esito', false);
    mostra('inCorso', true);
    testo('statoTxt', 'Chiedo il microfono…');
    $('vai').disabled = true;
    ultimiScritti = 0;
    $('barra').style.width = '0%';

    var CtxA = window.AudioContext || window.webkitAudioContext;
    ctx = new CtxA();

    var passo = autoprova ? Promise.resolve(null) : chiediMicrofono();

    passo.then(function (stream) {
      mediaStream = stream;
      if (stream) {
        var brutte = controllaIngresso(stream);
        if (brutte.length) {
          mostra('avvisoIngresso', true);
          testo('avvisoIngressoTxt',
            'Attenzione: su questo dispositivo ' + brutte.join(' e ') +
            ' non si lascia spegnere. La curva che esce è addolcita dal telefono, ' +
            'non è quella dell\'impianto. Meglio ripetere da un computer.');
        }
      }
      return ctx.audioWorklet.addModule('cattura.worklet.js');
    }).then(function () {
      avvia();
    }).catch(function (e) {
      inCorso = false;
      $('vai').disabled = false;
      mostra('inCorso', false);
      mostra('erroreBox', true);
      var msg = (e && e.name === 'NotAllowedError')
        ? 'Senza microfono non posso misurare. Il permesso si dà dalla barra dell\'indirizzo, sull\'icona a sinistra.'
        : (e && e.name === 'NotFoundError')
        ? 'Non trovo nessun microfono su questo dispositivo.'
        : 'Non sono riuscito ad aprire il microfono. ' + (e && e.message ? e.message : '');
      testo('erroreTxt', msg);
    });
  }

  function avvia() {
    var fs = ctx.sampleRate;

    sorgente = SEGNALI.sorgente(ctx, 'rosa');
    var vol = ctx.createGain();
    vol.gain.value = SEGNALI.ampiezza(LIVELLO_DB);

    worklet = new AudioWorkletNode(ctx, 'cattura', {
      numberOfInputs: 2,
      numberOfOutputs: 1,
      outputChannelCount: [1]
    });

    // il riferimento: alle casse e, uguale, al misuratore
    sorgente.connect(vol);
    // in autoprova non si suona: il microfono è finto, e sparare rumore rosa
    // in una stanza per provare del codice non serve a nessuno
    if (!autoprova) vol.connect(ctx.destination);
    vol.connect(worklet, 0, 0);

    var ingresso;
    if (autoprova) {
      /* Niente microfono: al suo posto un impianto finto di cui conosciamo
         i difetti. Serve a provare tutta la catena — cattura, allineamento,
         curva, consigli — senza casse e senza stanza. */
      var gobba = ctx.createBiquadFilter();
      gobba.type = 'peaking'; gobba.frequency.value = 250;
      gobba.Q.value = 1.2; gobba.gain.value = 7;
      var buco = ctx.createBiquadFilter();
      buco.type = 'peaking'; buco.frequency.value = 1250;
      buco.Q.value = 9; buco.gain.value = -14;
      var ritardo = ctx.createDelay(1);
      ritardo.delayTime.value = 0.02;                   // 20 ms, 6,9 metri
      vol.connect(gobba); gobba.connect(buco); buco.connect(ritardo);
      ingresso = ritardo;
    } else {
      ingresso = ctx.createMediaStreamSource(mediaStream);
    }
    ingresso.connect(worklet, 0, 1);

    // il worklet non ha uscite utili, ma senza una connessione il grafo non lo tira
    var muto = ctx.createGain();
    muto.gain.value = 0;
    worklet.connect(muto);
    muto.connect(ctx.destination);

    // l'RTA vivo, solo per far vedere che qualcosa entra davvero
    analizzatore = ctx.createAnalyser();
    analizzatore.fftSize = 8192;
    analizzatore.smoothingTimeConstant = 0.6;
    ingresso.connect(analizzatore);

    var campioni = Math.floor(fs * DURATA);
    worklet.port.onmessage = function (e) {
      if (e.data.tipo === 'avanzamento') {
        ultimiScritti = e.data.scritti;
        var p = Math.min(1, e.data.scritti / campioni);
        $('barra').style.width = Math.round(p * 100) + '%';
        testo('statoTxt', 'Ascolto… ' + Math.ceil(DURATA * (1 - p)) + ' s');
      } else if (e.data.tipo === 'fatto') {
        fermaTutto();
        calcola(e.data.rif, e.data.mic, fs);
      }
    };

    sorgente.start();
    if (ctx.state === 'suspended') ctx.resume();
    worklet.port.postMessage({ comando: 'parti', campioni: campioni });

    testo('statoTxt', 'Ascolto…');
    rtaVivo();
    reteDiSicurezza();
  }

  /* Se l'audio resta bloccato, il worklet non gira e non arriva mai niente:
     la pagina resterebbe su «Ascolto…» per sempre, muta. Capita quando il
     browser non considera il tocco un gesto valido, o su iPhone con la
     levetta del silenzioso. Trovato il 13/08/2026 provando la pagina in
     produzione: restava lì e non lo diceva a nessuno. */
  function reteDiSicurezza() {
    setTimeout(function () {
      if (!inCorso) return;              // finita per la sua strada: tutto bene
      if (ultimiScritti > 0) return;     // sta lavorando, solo più lenta
      fermaTutto();
      mostra('inCorso', false);
      $('vai').disabled = false;
      mostra('erroreBox', true);
      testo('erroreTxt', ctx && ctx.state !== 'running'
        ? 'Il browser ha tenuto l\'audio bloccato, quindi non è uscito niente dalle casse. ' +
          'Tocca di nuovo «Misura». Su iPhone controlla la levetta del silenzioso.'
        : 'Non è arrivato nessun campione dal microfono. Controlla che sia quello giusto ' +
          'e che qualche altra applicazione non lo stia occupando.');
    }, 4000);
  }

  function rtaVivo() {
    if (!bande) bande = DSP.terziDiOttava();
    var buf = new Float32Array(analizzatore.fftSize);
    rtaTimer = setInterval(function () {
      if (!analizzatore) return;
      analizzatore.getFloatTimeDomainData(buf);
      var liv = DSP.livelliPerBanda(buf, ctx.sampleRate, bande);
      grafico.barre(liv, bande);
    }, 90);
  }

  /* ── I conti, quando la registrazione è finita ─────────────────────────── */

  function calcola(rif, mic, fs) {
    testo('statoTxt', 'Faccio i conti…');

    var perRit = Math.min(rif.length, Math.floor(fs * PER_RITARDO));
    var ritardo = DSP.trovaRitardo(rif.subarray(0, perRit), mic.subarray(0, perRit));

    /* Allineamento: il microfono sente dopo, quindi si confronta il
       riferimento di PRIMA con il microfono di ADESSO. Senza questo la fase
       ruota su sé stessa e la coerenza crolla: sembra un guasto e non lo è. */
    var utili = rif.length - ritardo;
    var m = MISURA.crea({ fs: fs, dimensione: 8192 });
    m.aggiungi(rif.subarray(0, utili), mic.subarray(ritardo, ritardo + utili));

    var r = m.risultato();
    ultima = r.curva(6);
    var c = CONSIGLI.dai(ultima);

    mostra('inCorso', false);
    mostra('esito', true);
    $('vai').disabled = false;
    $('vai').textContent = 'Misura di nuovo';
    mostra('azioniEsito', true);

    grafico.disegna(ultima, congelata);
    scriviRitardo(ritardo, fs);
    scriviConsigli(c, r);
  }

  function scriviRitardo(campioni, fs) {
    var ms = campioni / fs * 1000;
    /* Dentro ci sono anche le latenze della scheda audio, che non sono
       distanza: dirlo, invece di spacciare per metri quello che metri non è. */
    var metri = (ms / 1000) * 343;
    testo('ritardoTxt', ms.toFixed(1).replace('.', ',') + ' ms · ' +
                        metri.toFixed(1).replace('.', ',') + ' m');
    testo('ritardoNota', 'Nel numero c\'è dentro anche il ritardo della scheda audio, ' +
                         'che non è distanza: i metri sono una stima per eccesso.');
  }

  function scriviConsigli(c, r) {
    var box = $('mosse');
    box.innerHTML = '';

    if (!c.mosse.length && !c.note.length) {
      var ok = document.createElement('p');
      ok.className = 'mossa mossa-ok';
      ok.textContent = 'Non c\'è niente di grosso da correggere: entro ±3 dB la ' +
                       'risposta è già a posto. Le differenze più piccole si ' +
                       'sentono meno di uno spostamento della cassa.';
      box.appendChild(ok);
    }

    c.mosse.forEach(function (m) {
      var p = document.createElement('p');
      p.className = 'mossa mossa-' + m.tipo;
      p.textContent = m.testo;
      box.appendChild(p);
    });

    c.note.forEach(function (n) {
      var p = document.createElement('p');
      p.className = 'mossa mossa-nota';
      p.textContent = n.testo;
      box.appendChild(p);
    });

    if (c.mosse.length > 1) {
      var q = document.createElement('p');
      q.className = 'mossa mossa-nota';
      q.textContent = 'Falle una alla volta e rimisura: la prima correzione ' +
                      'cambia anche le altre.';
      box.appendChild(q);
    }

    // quanta parte della misura è affidabile: un numero, non un'impressione
    var buoni = ultima.filter(function (p) { return p.coerenza >= CONSIGLI.COERENZA_MINIMA; });
    testo('affidTxt', Math.round(buoni.length / ultima.length * 100) +
          '% della curva è affidabile' + (autoprova ? ' · AUTOPROVA, microfono finto' : ''));
  }

  /* ── Il confronto prima/dopo ─────────────────────────────────────────── */

  function congela() {
    if (!ultima) return;
    congelata = ultima;
    grafico.disegna(ultima, congelata);
    mostra('scongela', true);
    testo('congelaTxt', 'Curva di prima messa da parte. Correggi l\'equalizzatore e rimisura: la vedrai tratteggiata sotto la nuova.');
  }

  function scongela() {
    congelata = null;
    grafico.disegna(ultima, null);
    mostra('scongela', false);
    testo('congelaTxt', '');
  }

  /* ── Avvio ────────────────────────────────────────────────────────────── */

  function pronto() {
    grafico = GRAFICO.crea($('tela'));
    $('vai').addEventListener('click', misura);
    $('congela').addEventListener('click', congela);
    $('scongela').addEventListener('click', scongela);
    window.addEventListener('resize', function () {
      if (ultima) grafico.disegna(ultima, congelata);
    });
    if (!window.AudioWorkletNode) {
      mostra('erroreBox', true);
      testo('erroreTxt', 'Questo browser è troppo vecchio per misurare: manca il pezzo che raccoglie i campioni senza perderne. Prova con Chrome o Safari aggiornati.');
      $('vai').disabled = true;
    }
    if (autoprova) {
      mostra('avvisoIngresso', true);
      testo('avvisoIngressoTxt', 'AUTOPROVA: al posto del microfono c\'è un impianto finto con una gobba di +7 dB a 250 Hz, un buco stretto a 1250 Hz e 20 ms di ritardo. Serve a provare la pagina senza casse.');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', pronto);
  } else pronto();

})();
