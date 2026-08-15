/* Tara un impianto — l'orchestra.

   Il gesto è uno: premi «Misura». La pagina manda il rumore rosa, ascolta con
   il microfono, e dopo una decina di secondi dice com'è fatto l'impianto e
   cosa toccare.

   Il pezzo forte non si vede: il segnale di riferimento non arriva da un cavo,
   lo generiamo noi. Va allo stesso nodo di cattura del microfono, quindi i due
   flussi sono sincroni per costruzione. È il motivo per cui qui non serve
   l'interfaccia audio a due canali che Smaart pretende. */

(function () {

  /* Erano tre numeri fissi nel codice. In una sala rumorosa dieci secondi non
     bastano — la coerenza crolla, la pagina dice giustamente che non sa
     rispondere, e senza poterli cambiare non c'era modo di rimediare. */
  var DURATA = 10;              // secondi di misura, scegliibili dal pannello
  var PER_RITARDO = 2;          // i primi secondi servono ad allineare
  var LIVELLO_DB = -18;         // dBFS in uscita, scegliibile dal pannello

  var ctx = null, worklet = null, sorgente = null, mediaStream = null;
  var analizzatore = null, rtaTimer = null;
  var workletPronto = null;     // { contesto, promessa }: il modulo si carica una volta sola
  var nodi = [];                // il grafo di questa misura, da smontare alla fine
  var bande = null, grafico = null;
  var congelata = null, ultima = null;
  var inCorso = false;

  /* Le posizioni misurate finora. Una sola descrive un punto, non una sala:
     le cancellazioni si spostano di metro in metro, e quello che qui è un buco
     di 12 dB due metri più in là non c'è. */
  var posizioni = [];
  var mediata = null;
  var bersaglio = 'live';
  var vista = 'curva';
  var ultimoRisultato = null;
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
    // i vincoli li costruisce DISPOSITIVI: dentro c'è anche il microfono scelto
    return navigator.mediaDevices.getUserMedia(DISPOSITIVI.vincoliIngresso());
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

  /* Il contesto adesso è uno solo e sopravvive alla misura (prima ne nasceva
     uno nuovo a ogni «Misura di nuovo», e Chrome ne regge sei per pagina).
     Quindi i nodi vanno staccati a mano: se restano attaccati, alla seconda
     misura il rumore rosa esce due volte e la terza tre. */
  function fermaTutto() {
    if (rtaTimer) { clearInterval(rtaTimer); rtaTimer = null; }
    try { if (sorgente) sorgente.stop(); } catch (e) {}
    sorgente = null;
    if (worklet) { worklet.port.onmessage = null; worklet = null; }
    analizzatore = null;
    nodi.forEach(function (n) { try { n.disconnect(); } catch (e) {} });
    nodi = [];
    if (mediaStream) {
      mediaStream.getTracks().forEach(function (t) { t.stop(); });
      mediaStream = null;
    }
    inCorso = false;
  }

  /* Un guasto si racconta in un posto solo: prima lo stesso riquadro veniva
     riempito da tre punti diversi del file. */
  function fallita(msg) {
    fermaTutto();
    $('vai').disabled = false;
    mostra('inCorso', false);
    mostra('erroreBox', true);
    testo('erroreTxt', msg);
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

    /* Il contesto lo tiene /comune/audio.js: uno per pagina, sbloccato dentro
       questo tocco, con la categoria audio di iOS già a posto. */
    ctx = AUDIO.contesto();
    if (!ctx) return fallita(AUDIO.messaggio('assente'));

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
      /* Ora che il permesso c'è, i nomi dei dispositivi sono leggibili: si
         rilegge l'elenco, così la riga sotto il pulsante smette di dire
         «microfono di sistema» e dice come si chiama davvero. */
      DISPOSITIVI.aggiorna().then(disegnaDispositivi);
      /* Una volta sola per contesto. Prima il problema non si poneva: ogni
         misura apriva un contesto nuovo. Provato il 14/08/2026: Chrome
         sopporta di caricare due volte lo stesso modulo sullo stesso contesto
         senza lamentarsi — le specifiche invece dicono che registrare due
         volte lo stesso nome è un errore, e non c'è motivo di riscaricarlo. */
      if (!workletPronto || workletPronto.contesto !== ctx) {
        var p = ctx.audioWorklet.addModule('cattura.worklet.js');
        // se il caricamento fallisce non va ricordato: riprovare deve poter riuscire
        p.catch(function () { workletPronto = null; });
        // insieme alla promessa si ricorda SU QUALE contesto: un modulo
        // registrato altrove non vale, e il nodo nascerebbe senza processore
        workletPronto = { contesto: ctx, promessa: p };
      }
      return workletPronto.promessa;
    }).then(function () {
      // l'uscita scelta va applicata PRIMA di far partire il suono, o il primo
      // pezzo di rumore rosa esce dalla cassa sbagliata
      return DISPOSITIVI.applicaUscita(ctx);
    }).then(function () {
      avvia();
    }).catch(function (e) {
      fallita((e && e.name === 'NotAllowedError')
        ? 'Senza microfono non posso misurare. Il permesso si dà dalla barra dell\'indirizzo, sull\'icona a sinistra.'
        : (e && e.name === 'NotFoundError')
        ? 'Non trovo nessun microfono su questo dispositivo.'
        : 'Non sono riuscito ad aprire il microfono. ' + (e && e.message ? e.message : ''));
    });
  }

  function avvia() {
    var fs = ctx.sampleRate;

    sorgente = SEGNALI.sorgente(ctx, 'rosa');
    var vol = ctx.createGain();
    /* «forte» chiedeva −18+6 = −12 dBFS di valore efficace, ma il rumore rosa
       ha una punta 12,5–13,4 dB sopra: a −12 il picco esce oltre l'uno e il
       segnale distorce PRIMA di entrare nell'impianto. In uno strumento di
       misura è il peggiore dei difetti, perché la distorsione la si sente e la
       si attribuisce alle casse. Il tetto lo dice il generatore, che il picco
       lo ha misurato sul buffer vero. */
    var tetto = SEGNALI.massimoSenzaClip(ctx, 'rosa');
    vol.gain.value = SEGNALI.ampiezza(Math.min(LIVELLO_DB, tetto));

    worklet = new AudioWorkletNode(ctx, 'cattura', {
      numberOfInputs: 2,
      numberOfOutputs: 1,
      outputChannelCount: [1]
    });
    nodi = [sorgente, vol, worklet];

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
      nodi.push(gobba, buco, ritardo);
      ingresso = ritardo;
    } else {
      ingresso = ctx.createMediaStreamSource(mediaStream);
      nodi.push(ingresso);
    }
    ingresso.connect(worklet, 0, 1);

    // il worklet non ha uscite utili, ma senza una connessione il grafo non lo tira
    var muto = ctx.createGain();
    muto.gain.value = 0;
    worklet.connect(muto);
    muto.connect(ctx.destination);
    nodi.push(muto);

    // l'RTA vivo, solo per far vedere che qualcosa entra davvero
    analizzatore = ctx.createAnalyser();
    analizzatore.fftSize = 8192;
    analizzatore.smoothingTimeConstant = 0.6;
    ingresso.connect(analizzatore);
    nodi.push(analizzatore);

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
    AUDIO.riprendi();          // se è rimasto sospeso, il testimone qui sotto lo dice
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
      fallita(AUDIO.partito()
        ? 'Non è arrivato nessun campione dal microfono. Controlla che sia quello giusto ' +
          'e che qualche altra applicazione non lo stia occupando.'
        : AUDIO.messaggio('sospeso') + ' Tocca di nuovo «Misura».');
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
    posizioni.push(r);
    ultimoRisultato = r;

    mostra('inCorso', false);
    mostra('esito', true);
    mostra('viste', true);
    $('vai').disabled = false;
    $('vai').textContent = 'Misura di nuovo';
    mostra('azioniEsito', true);

    scriviRitardo(ritardo, fs);
    ricalcola();
  }

  /* Rifà i conti senza rimisurare: succede quando si cambia bersaglio o si
     aggiunge una posizione. La misura è già in mano, non serve risuonare. */
  function ricalcola() {
    mediata = MISURA.media(posizioni);
    ultima = mediata.curva(6);

    // i consigli si danno sullo SCARTO dal bersaglio, non sulla curva nuda
    var scarto = OBIETTIVO.scarto(bersaglio, ultima);
    var c = CONSIGLI.dai(scarto);

    scriviPosizioni();
    disegnaVista();
    scriviConsigli(c);
  }

  function scriviPosizioni() {
    var n = posizioni.length;
    testo('posizioniTxt', n === 1
      ? 'Una posizione misurata. Una sola descrive un punto, non una sala: ' +
        'misurane almeno tre, in posti diversi.'
      : n + ' posizioni, mediate. Le cancellazioni che esistono in un punto solo ' +
        'sono state ridimensionate.');
    mostra('azzeraPos', n > 1);
    mostra('togliUltima', n >= 1);
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

  /* ── Le tre viste ──────────────────────────────────────────────────────── */

  var NOTE_VISTA = {
    curva: 'La riga tratteggiata è il bersaglio. Dove la curva sbiadisce, la ' +
           'misura non è affidabile. Tocca il grafico per leggere un punto, ' +
           'oppure spostati sul grafico col tasto Tab e usa le frecce.',
    impulso: 'Il picco è il suono diretto. I baffi dopo sono le riflessioni: ' +
             'più sono lontane dal picco, più viene da lontano la superficie ' +
             'che le rimanda. Una riflessione forte entro i primi millisecondi ' +
             'è una parete o un soffitto vicini.',
    fase: 'A punti, non a linea: fra due punti la fase può fare un giro intero, ' +
          'e unirli disegnerebbe pendenze che non esistono. I salti verticali ' +
          'non sono guasti, sono il giro che ricomincia.'
  };

  function disegnaVista() {
    mostra('vistaNota', true);
    testo('vistaNota', NOTE_VISTA[vista]);
    mostra('lettura', vista === 'curva');

    if (vista === 'curva') {
      var obiettivo = OBIETTIVO.curva(bersaglio, ultima.map(function (p) { return p.f; }));
      grafico.disegna(ultima, congelata, obiettivo);
    } else if (vista === 'impulso') {
      grafico.impulso(ultimoRisultato.impulso(4096), 50);
    } else {
      var punti = ultima.map(function (p) {
        return { f: p.f, gradi: ultimoRisultato.faseA(p.f), coerenza: p.coerenza };
      });
      grafico.fase(punti);
    }
  }

  function scriviConsigli(c) {
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
    disegnaVista();
    mostra('scongela', true);
    testo('congelaTxt', 'Curva di prima messa da parte. Correggi l\'equalizzatore e rimisura: la vedrai tratteggiata sotto la nuova.');
  }

  function scongela() {
    congelata = null;
    disegnaVista();
    mostra('scongela', false);
    testo('congelaTxt', '');
  }

  /* ── Il bersaglio ─────────────────────────────────────────────────────── */

  function costruisciBersaglio() {
    var box = $('segObiettivo');
    box.innerHTML = '';
    OBIETTIVO.elenco().forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'seg-btn' + (c.chiave === bersaglio ? ' active' : '');
      b.textContent = c.nome;
      b.addEventListener('click', function () {
        bersaglio = c.chiave;
        [].forEach.call(box.children, function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        testo('obiettivoSpiega', OBIETTIVO.spiega(bersaglio));
        testo('riassuntoDisp', riassuntoCompleto());
        // niente da rimisurare: i conti si rifanno sulla misura già in mano
        if (posizioni.length) ricalcola();
      });
      box.appendChild(b);
    });
    testo('obiettivoSpiega', OBIETTIVO.spiega(bersaglio));
  }

  /* ── La scelta dei dispositivi ────────────────────────────────────────── */

  function riempi(sel, lista, scelto, etichettaPre) {
    sel.innerHTML = '';
    var pre = document.createElement('option');
    pre.value = '';
    pre.textContent = etichettaPre;
    sel.appendChild(pre);
    lista.forEach(function (d, i) {
      if (d.deviceId === 'default' || d.deviceId === 'communications') return;
      var o = document.createElement('option');
      o.value = d.deviceId;
      o.textContent = d.label || ('Dispositivo ' + (i + 1));
      sel.appendChild(o);
    });
    sel.value = scelto || '';
  }

  /* La riga sotto il pulsante riassume TUTTE le scelte, non solo i
     dispositivi: bersaglio, durata e microfono sono le tre cose che uno
     controlla con un'occhiata prima di premere. */
  function riassuntoCompleto() {
    var nome = OBIETTIVO.elenco().filter(function (c) { return c.chiave === bersaglio; })[0];
    var mic = DISPOSITIVI.riassunto().replace(/^Ingresso:\s*/, '').split(' · Uscita')[0];
    return (nome ? nome.nome : '') + ' · ' + DURATA + ' s · ' + mic;
  }

  function disegnaDispositivi() {
    testo('riassuntoDisp', riassuntoCompleto());
    riempi($('selIngresso'), DISPOSITIVI.ingressi(), DISPOSITIVI.ingresso(),
           'Quello di sistema');
    mostra('nomiNascosti', !DISPOSITIVI.nomiVisibili());

    var scegliibili = DISPOSITIVI.usciteScegliibili();
    $('rigaUscita').hidden = !scegliibili;
    mostra('usciteNo', !scegliibili);
    if (scegliibili) {
      riempi($('selUscita'), DISPOSITIVI.uscite(), DISPOSITIVI.uscita(),
             'Quella di sistema');
    }
  }

  /* Per far comparire i nomi serve un permesso, e per il permesso serve una
     richiesta vera: si apre e si chiude subito, senza registrare niente. */
  function svelaNomi() {
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (s) {
      s.getTracks().forEach(function (t) { t.stop(); });
      return DISPOSITIVI.aggiorna();
    }).then(disegnaDispositivi).catch(function () {
      testo('riassuntoDisp', 'Senza permesso non posso mostrare i nomi');
    });
  }

  /* ── Avvio ────────────────────────────────────────────────────────────── */

  function pronto() {
    grafico = GRAFICO.crea($('tela'));
    $('vai').addEventListener('click', misura);

    /* L'audio bloccato si sa prima dei quattro secondi della rete di
       sicurezza: lo dice /comune/audio.js appena il tentativo di sblocco
       fallisce. Misurato: il riquadro compare dopo 1,2 s invece di 4. */
    AUDIO.seNonParte(function (msg) {
      if (!inCorso) return;              // nessuno sta aspettando un suono
      fallita(msg + ' Tocca di nuovo «Misura».');
    });

    DISPOSITIVI.avvia(disegnaDispositivi).then(disegnaDispositivi);
    $('apriDisp').addEventListener('click', function () {
      var p = $('pannelloDisp');
      p.hidden = !p.hidden;
      $('apriDisp').setAttribute('aria-expanded', String(!p.hidden));
      $('apriDisp').classList.toggle('aperto', !p.hidden);
      /* Si rienumera qui, ogni volta che il pannello si apre. Al caricamento
         della pagina Chrome può rispondere con un elenco VUOTO — succede
         finché il sottosistema audio non è sveglio, e in produzione capitava:
         le tendine restavano senza voci mentre `enumerateDevices` chiamata a
         mano un secondo dopo ne trovava diciannove. Questo è anche il momento
         giusto: se hai appena collegato l'interfaccia, la trovi. */
      if (!p.hidden) DISPOSITIVI.aggiorna().then(disegnaDispositivi);
    });
    $('mostraNomi').addEventListener('click', svelaNomi);
    $('selIngresso').addEventListener('change', function () {
      DISPOSITIVI.scegliIngresso(this.value);
      testo('riassuntoDisp', DISPOSITIVI.riassunto());
    });
    $('selUscita').addEventListener('change', function () {
      DISPOSITIVI.scegliUscita(this.value);
      testo('riassuntoDisp', DISPOSITIVI.riassunto());
    });
    $('congela').addEventListener('click', congela);
    $('scongela').addEventListener('click', scongela);
    window.addEventListener('resize', function () {
      if (ultima) disegnaVista();
    });

    costruisciBersaglio();

    $('aggiungi').addEventListener('click', function () {
      /* Non azzera niente: la misura nuova si somma alle altre. Il consiglio
         di spostarsi sta qui, dove serve, non in fondo alla pagina. */
      testo('statoTxt', 'Spostati di qualche metro, poi ascolto…');
      misura();
    });

    /* Durata e livello: due segmenti che cambiano davvero i numeri usati
       dalla misura successiva. */
    function collega(idSeg, attributo, quando) {
      var box = $(idSeg);
      if (!box) return;
      [].forEach.call(box.querySelectorAll('.seg-btn'), function (b) {
        b.addEventListener('click', function () {
          [].forEach.call(box.querySelectorAll('.seg-btn'), function (x) {
            x.classList.remove('active');
          });
          b.classList.add('active');
          quando(Number(b.getAttribute(attributo)));
          testo('riassuntoDisp', riassuntoCompleto());
        });
      });
    }
    collega('segDurata', 'data-s', function (v) { DURATA = v; });
    collega('segLivello', 'data-db', function (v) { LIVELLO_DB = v; });

    $('togliUltima').addEventListener('click', function () {
      if (!posizioni.length) return;
      posizioni.pop();
      if (!posizioni.length) {
        mostra('esito', false);
        mostra('viste', false);
        mostra('vistaNota', false);
        $('vai').textContent = 'Misura';
        scriviPosizioni();
        return;
      }
      ultimoRisultato = posizioni[posizioni.length - 1];
      ricalcola();
    });

    $('azzeraPos').addEventListener('click', function () {
      posizioni = [];
      mediata = null;
      mostra('esito', false);
      mostra('viste', false);
      mostra('vistaNota', false);
      $('vai').textContent = 'Misura';
      scriviPosizioni();
    });

    [].forEach.call(document.querySelectorAll('.vista-btn'), function (b) {
      b.addEventListener('click', function () {
        vista = b.getAttribute('data-vista');
        [].forEach.call(document.querySelectorAll('.vista-btn'), function (x) {
          x.classList.toggle('on', x === b);
        });
        disegnaVista();
      });
    });

    grafico.allaLettura(function (p) {
      if (!p) { testo('lettura', 'Tocca il grafico — o usa le frecce — per leggere un punto.'); return; }
      var hz = p.f >= 1000 ? (p.f / 1000).toFixed(2).replace('.', ',') + ' kHz'
                           : Math.round(p.f) + ' Hz';
      var db = (p.db >= 0 ? '+' : '−') + Math.abs(p.db).toFixed(1).replace('.', ',');
      testo('lettura', hz + ' · ' + db + ' dB · affidabilità ' +
                       Math.round(p.coerenza * 100) + '%');
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
