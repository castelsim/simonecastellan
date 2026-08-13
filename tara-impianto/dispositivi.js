/* Quale microfono ascolta, e da quali casse esce il segnale.

   Con un'interfaccia audio collegata la scelta non è un dettaglio: il
   microfono di misura sta sull'ingresso 1 della scheda, non nel telefono, e il
   rumore rosa deve uscire dall'impianto, non dagli altoparlanti del portatile.
   Senza poterli scegliere, lo strumento misura la cosa sbagliata e sembra
   funzionare lo stesso.

   ── Due asimmetrie del browser, che si vedono in pagina ──

   1) I NOMI ARRIVANO DOPO IL PERMESSO. Prima che l'utente conceda il
      microfono, `enumerateDevices` restituisce le voci senza etichetta: sono
      lì, ma si chiamano «». È una difesa contro il riconoscimento dei
      dispositivi, e va spiegata invece di mostrare una tendina vuota.

   2) L'USCITA NON SI SCEGLIE OVUNQUE. `setSinkId` esiste su Chrome, non su
      Safari e non su iPhone: lì l'audio va dove decide il sistema. Mostrare
      una tendina che non fa niente sarebbe peggio che non mostrarla: si
      cambia voce, il suono continua a uscire da dov'era, e uno pensa di aver
      misurato l'impianto mentre ha misurato gli altoparlanti del portatile. */

var DISPOSITIVI = (function () {

  var CHIAVE_IN = 'tara-ingresso';
  var CHIAVE_OUT = 'tara-uscita';

  var ingressi = [], uscite = [];
  var scelto = { ingresso: null, uscita: null };
  var alCambio = null;

  function ricorda(k, v) {
    try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch (e) {}
  }
  function ricordato(k) {
    try { return localStorage.getItem(k); } catch (e) { return null; }
  }

  /* L'uscita si può scegliere solo dove il browser lascia dirottare l'audio. */
  function usciteScegliibili() {
    return typeof AudioContext !== 'undefined' &&
           typeof AudioContext.prototype.setSinkId === 'function';
  }

  /* Le etichette ci sono solo dopo che il microfono è stato concesso almeno
     una volta. Se sono tutte vuote, la pagina lo dice invece di mostrare
     «Microfono 1, Microfono 2». */
  function nomiVisibili() {
    return ingressi.some(function (d) { return d.label; });
  }

  function elenca() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return Promise.resolve();
    }
    return navigator.mediaDevices.enumerateDevices().then(function (tutti) {
      ingressi = tutti.filter(function (d) { return d.kind === 'audioinput'; });
      uscite = tutti.filter(function (d) { return d.kind === 'audiooutput'; });

      // una scelta di ieri può riferirsi a un'interfaccia oggi staccata
      if (scelto.ingresso && !trova(ingressi, scelto.ingresso)) scelto.ingresso = null;
      if (scelto.uscita && !trova(uscite, scelto.uscita)) scelto.uscita = null;
    });
  }

  function trova(lista, id) {
    for (var i = 0; i < lista.length; i++) if (lista[i].deviceId === id) return lista[i];
    return null;
  }

  function nome(lista, id, ripiego) {
    var d = trova(lista, id);
    if (d && d.label) return d.label;
    if (!id && lista.length) {
      var pre = trova(lista, 'default') || lista[0];
      if (pre && pre.label) return pre.label;
    }
    return ripiego;
  }

  function avvia(quandoCambia) {
    alCambio = quandoCambia;
    scelto.ingresso = ricordato(CHIAVE_IN);
    scelto.uscita = ricordato(CHIAVE_OUT);

    /* Alla prima chiamata Chrome può rispondere con un elenco vuoto: il
       sottosistema audio non è ancora sveglio. Non è un errore e non c'è un
       evento che lo annunci — si riprova, una volta, dopo un attimo. Se
       nemmeno allora c'è niente, l'elenco è vuoto per davvero. */
    function riprovaSeVuoto() {
      if (ingressi.length || uscite.length) return;
      setTimeout(function () {
        elenca().then(function () { if (alCambio) alCambio(); });
      }, 600);
    }

    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      /* Chi collega l'interfaccia a pagina aperta deve trovarla nell'elenco
         senza ricaricare: è il gesto normale di chi arriva, monta e misura. */
      navigator.mediaDevices.addEventListener('devicechange', function () {
        elenca().then(function () { if (alCambio) alCambio(); });
      });
    }
    return elenca().then(riprovaSeVuoto);
  }

  return {
    avvia: avvia,
    aggiorna: elenca,
    usciteScegliibili: usciteScegliibili,
    nomiVisibili: nomiVisibili,

    ingressi: function () { return ingressi; },
    uscite: function () { return uscite; },

    ingresso: function () { return scelto.ingresso; },
    uscita: function () { return scelto.uscita; },

    scegliIngresso: function (id) { scelto.ingresso = id || null; ricorda(CHIAVE_IN, scelto.ingresso); },
    scegliUscita: function (id) { scelto.uscita = id || null; ricorda(CHIAVE_OUT, scelto.uscita); },

    /* I vincoli per getUserMedia. «exact» e non «ideal»: se il microfono
       scelto non c'è più, meglio un errore chiaro che una misura fatta di
       nascosto con un altro — sarebbe la misura di un'altra cosa. */
    vincoliIngresso: function () {
      var a = {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 1
      };
      if (scelto.ingresso) a.deviceId = { exact: scelto.ingresso };
      return { audio: a };
    },

    /* Manda l'audio all'uscita scelta. Torna una promessa che non rigetta
       mai: se il browser non sa dirottare, si va avanti con l'uscita di
       sistema — e la pagina lo ha già scritto. */
    applicaUscita: function (ctx) {
      if (!scelto.uscita || !ctx || typeof ctx.setSinkId !== 'function') {
        return Promise.resolve(false);
      }
      return ctx.setSinkId(scelto.uscita).then(function () { return true; },
                                               function () { return false; });
    },

    riassunto: function () {
      var i = nome(ingressi, scelto.ingresso, 'microfono di sistema');
      if (!usciteScegliibili()) return 'Ingresso: ' + i;
      var u = nome(uscite, scelto.uscita, 'uscita di sistema');
      return 'Ingresso: ' + i + ' · Uscita: ' + u;
    }
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = DISPOSITIVI;
