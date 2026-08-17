/* L'audio del browser, in un posto solo.

   Tre strumenti di questo sito generano suono — «Tonalità», «Rumore rosa»,
   «Tara un impianto» — e ognuno apriva il suo AudioContext con le stesse tre
   righe copiate, ognuna con una piccola differenza: uno spostava la sessione
   di iOS, gli altri no; nessuno guardava se il contesto era partito davvero.
   Le copie divergono sempre, e la correzione arriva a una sola delle tre.

   Qui dentro c'è quello che serve perché un suono esca davvero:

     1. il contesto, creato UNA VOLTA SOLA (col prefisso webkit per i Safari
        vecchi);
     2. lo sblocco dentro il gesto dell'utente — fuori dal gesto iOS e Chrome
        non lasciano partire niente;
     3. la categoria audio di iOS: senza, la levetta del silenzioso zittisce
        tutto quello che nasce da Web Audio;
     4. un frammento di silenzio da un elemento <audio>, perché dichiarare la
        categoria non basta: la sessione si sposta solo se qualcosa parte
        davvero dal lettore di sistema;
     5. la ripresa quando si torna sulla scheda: in secondo piano il contesto
        va in «suspended» e al ritorno resta muto finché non lo si riprende;
     6. l'avviso quando NON è partito, invece del silenzio. Una pagina muta e
        una pagina rotta hanno lo stesso aspetto: l'unica differenza la può
        fare una riga scritta.

   Quello che qui NON c'è, e va detto: se un elemento <audio> con dentro un
   suono vero non si sente, il guasto è a valle — volume dei media, uscita
   finita su un Bluetooth — e nessuna riga di questo file lo può aggiustare.
   Provato su un iPhone il 14/08/2026: un WAV valido (440 Hz, picco 0,37) non
   si sentiva. Quel caso non è di Web Audio. */

var AUDIO = (function () {

  var ctx = null;                 // il contesto, uno per pagina
  var sessioneSpostata = false;   // il frammento di silenzio è già partito?
  var ritornoAgganciato = false;  // visibilitychange è già collegato?
  var giaPartito = false;         // il contesto è stato «running» almeno una volta
  var testimoni = [];             // chi vuole sapere che l'audio non parte

  /* ── 1. La categoria audio di sistema ───────────────────────────────────
     Su iPhone i suoni generati da Web Audio finiscono nella categoria
     «ambient», che la levetta del silenzioso zittisce; un elemento <audio>
     invece sta in «playback» e si sente lo stesso. Il sintomo è quello che
     confonde di più: il brano caricato si sente e i tasti no, così sembra
     rotta la tastiera mentre è una levetta sul fianco del telefono.

     `navigator.audioSession` (Safari da iOS 16.4) permette di dire che questa
     pagina fa «playback». Ritorna false dove non esiste: lì l'unica cosa che
     resta è avvisare per iscritto. */
  function categoriaDiSistema() {
    try {
      if (typeof navigator !== 'undefined' &&
          navigator.audioSession && 'type' in navigator.audioSession) {
        navigator.audioSession.type = 'playback';
        return true;
      }
    } catch (e) {}
    return false;
  }

  /* ── 2. Un frammento di silenzio, in WAV ────────────────────────────────
     Campioni tutti a zero: silenzio vero, nessuno lo sente. Serve solo come
     scusa per far muovere il lettore di sistema.

     Sta in una funzione a parte perché è l'unico pezzo di questo file che si
     può provare senza un browser: un WAV o è ben formato o non lo è. */
  function wavDiSilenzio(secondi, fs) {
    fs = fs || 8000;
    var n = Math.floor(fs * (secondi || 0.12));
    var buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    var t = function (o, s) { for (var i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    t(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); t(8, 'WAVEfmt ');
    v.setUint32(16, 16, true);        // lunghezza del blocco fmt
    v.setUint16(20, 1, true);         // PCM
    v.setUint16(22, 1, true);         // un canale
    v.setUint32(24, fs, true);
    v.setUint32(28, fs * 2, true);    // byte al secondo
    v.setUint16(32, 2, true);         // byte per fotogramma
    v.setUint16(34, 16, true);        // bit per campione
    t(36, 'data'); v.setUint32(40, n * 2, true);
    return buf;
  }

  /* ── 3. Spostare la sessione ────────────────────────────────────────────
     Dichiarare la categoria non basta: provato su un iPhone vero, la tastiera
     restava muta lo stesso. Serve anche far partire davvero qualcosa dal
     lettore di sistema perché iOS sposti la sessione. Da lì in poi si sentono
     anche gli oscillatori.

     Costa un decimo di secondo e succede una volta sola, dentro il primo
     gesto: fuori da un gesto dell'utente iOS non lo lascerebbe partire. */
  function spostaLaSessione() {
    if (sessioneSpostata) return false;
    sessioneSpostata = true;
    try {
      var blob = new Blob([wavDiSilenzio(0.12, 8000)], { type: 'audio/wav' });
      var a = new Audio(URL.createObjectURL(blob));
      a.volume = 0.01;
      var p = a.play();
      if (p && p.catch) p.catch(function () {});
      return true;
    } catch (e) {
      return false;
    }
  }

  /* ── 4. Il guasto, detto a parole ───────────────────────────────────────
     Il testo sta qui e non nei tre strumenti: la stessa causa merita la stessa
     spiegazione ovunque, e una spiegazione si corregge una volta sola. */
  function messaggio(motivo) {
    if (motivo === 'assente') {
      return 'Questo browser non sa generare suoni: gli manca Web Audio. ' +
             'Prova con Chrome, Safari o Firefox aggiornati.';
    }
    if (motivo === 'chiuso') {
      return 'L\'audio di questa pagina si è chiuso. Ricaricala e riprova.';
    }
    return 'Il browser tiene l\'audio bloccato: non uscirà nessun suono finché ' +
           'non lo tocchi di nuovo. Su iPhone controlla anche la levetta del ' +
           'silenzioso e il volume dei media.';
  }

  function segnala(motivo) {
    var m = messaggio(motivo);
    for (var i = 0; i < testimoni.length; i++) {
      // un ascoltatore che scoppia non deve zittire gli altri
      try { testimoni[i](m, motivo); } catch (e) {}
    }
    return m;
  }

  /* ── 5. Riprendere ──────────────────────────────────────────────────────
     `annuncia` distingue i due casi che sembrano uguali e non lo sono: dopo un
     tocco, un contesto ancora sospeso è un guasto da dire; al ritorno da
     un'altra scheda, se non era mai partito, non c'è niente da annunciare —
     nessuno ha ancora chiesto un suono. */
  function ripristina(annuncia, poi) {
    if (!ctx) { if (annuncia) segnala('assente'); if (poi) poi(false); return; }

    /* La categoria si RIDICHIARA a ogni ripresa, non solo alla creazione.
       Su iOS la sessione audio si azzera da sola in più occasioni — una
       telefonata, una sveglia, la pagina che va in secondo piano e torna — e
       da quel momento in poi il suono ricade nella categoria «ambient», cioè
       quella che la levetta del silenzioso zittisce. Dichiararla una volta
       sola, alla creazione del contesto, vuol dire che la prima volta si
       sente e dopo la prima interruzione no: un guasto intermittente, il
       peggiore da capire perché a chi lo racconta non si crede. */
    categoriaDiSistema();

    var risposto = false;
    function esito() {
      if (risposto) return;
      risposto = true;
      var ok = (ctx.state === 'running');
      if (ok) giaPartito = true;
      else if (annuncia) segnala(ctx.state === 'closed' ? 'chiuso' : 'sospeso');
      if (poi) poi(ok);
    }

    if (ctx.state === 'running') { esito(); return; }
    var p = null;
    try { p = ctx.resume(); } catch (e) {}
    if (p && p.then) p.then(esito, esito);

    /* La sveglia, e non è una precauzione teorica: misurato su Chrome il
       14/08/2026, fuori da un gesto dell'utente `resume()` non fallisce —
       resta lì, con la promessa MAI risolta, finché un giorno non arriva un
       tocco vero. Senza questa riga la pagina aspettava per sempre una
       risposta che non arriva, e restava muta esattamente come prima.
       Un secondo e due decimi: abbastanza perché uno sblocco vero risponda
       per primo, poco perché chi ha premuto se ne accorga. */
    setTimeout(esito, 1200);
  }

  /* Quando la scheda torna in primo piano — o il telefono si sblocca — il
     contesto è rimasto sospeso e la pagina resterebbe muta senza dirlo: si
     preme PLAY e non succede niente. */
  function agganciaIlRitorno() {
    if (ritornoAgganciato) return;
    if (typeof document === 'undefined' || !document.addEventListener) return;
    ritornoAgganciato = true;
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) return;
      // si annuncia solo se prima suonava: se non è mai partito, tornare sulla
      // scheda non è il momento di lamentarsi
      ripristina(giaPartito, null);
    });
  }

  /* ── 6. Il contesto ─────────────────────────────────────────────────────
     Da chiamare DENTRO il gesto dell'utente, tutte le volte che serve: la
     prima lo crea, le altre restituiscono lo stesso e ne approfittano per
     riprenderlo se nel frattempo si era sospeso. */
  function contesto(opzioni) {
    if (!ctx) {
      categoriaDiSistema();
      spostaLaSessione();
      var AC = (typeof window !== 'undefined') &&
               (window.AudioContext || window.webkitAudioContext);
      if (!AC) { segnala('assente'); return null; }
      ctx = opzioni ? new AC(opzioni) : new AC();
      agganciaIlRitorno();
    }
    ripristina(true, null);
    return ctx;
  }

  /* ── Chi incontra la levetta del silenzioso ─────────────────────────────
     L'avviso si mostra solo a chi la può incontrare — un iPhone o un iPad —
     e solo dove la categoria non si lascia impostare: su iOS aggiornati il
     suono esce lo stesso, e lì la riga sarebbe un allarme per un problema che
     non c'è. Gli iPad recenti si dichiarano «MacIntel»: si riconoscono dal
     fatto che hanno un touch screen. */
  function dispositivoApple(nav) {
    nav = nav || (typeof navigator !== 'undefined' ? navigator : null);
    if (!nav) return false;
    return /iPad|iPhone|iPod/.test(nav.userAgent || '') ||
           (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
  }

  return {
    contesto: contesto,
    riprendi: function (poi) { ripristina(true, poi); },
    categoriaDiSistema: categoriaDiSistema,
    spostaLaSessione: spostaLaSessione,
    dispositivoApple: dispositivoApple,

    // com'è messo adesso: 'assente' se non l'ha mai creato, altrimenti lo stato
    stato: function () { return ctx ? ctx.state : 'assente'; },
    partito: function () { return !!ctx && ctx.state === 'running'; },

    // chi vuole scrivere in pagina che non è partito si iscrive qui
    seNonParte: function (fn) { if (typeof fn === 'function') testimoni.push(fn); },

    // esposte per le prove: il WAV si controlla byte per byte, il testo del
    // guasto si legge senza dover rompere davvero l'audio
    wavDiSilenzio: wavDiSilenzio,
    messaggio: messaggio
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = AUDIO;
