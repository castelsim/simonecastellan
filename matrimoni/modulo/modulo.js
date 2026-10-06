/* Il piano musicale per gli sposi — la logica del modulo.

   Uno stato solo (`S`), salvato nel browser a ogni modifica e scaricabile come
   file .json. I campi portano `data-bind="momenti.3.brani.0.titolo"`: scrivere
   aggiorna lo stato senza ridisegnare (così il cursore non salta); solo i gesti
   che cambiano la forma — «ci sarà», aggiungi un brano, un'altra musica —
   ridisegnano il passo, e il fuoco torna sul controllo toccato.

   Il formato del file è documentato in testa a piano_musicale.py, che lo legge. */
(function () {
  "use strict";

  var CHIAVE = "matrimoni-modulo-v1";
  var FORMATO = "piano-musicale-sposi";
  var VERSIONE = 1;
  var WHATSAPP = "393404579244";

  var PASSI = [
    { n: 1, corto: "Dati", titolo: "I vostri dati" },
    { n: 2, corto: "Momenti", titolo: "I momenti" },
    { n: 3, corto: "Playlist", titolo: "Le playlist" },
    { n: 4, corto: "Annunci", titolo: "Gli annunci" },
    { n: 5, corto: "Video", titolo: "Il video" },
    { n: 6, corto: "Riepilogo", titolo: "Riepilogo e invio" }
  ];

  var PLAYLIST = [
    { id: "buffet", nome: "Arrivo degli invitati e buffet", es: "musica leggera, da conversazione" },
    { id: "pranzo", nome: "Pranzo o cena", es: "sottofondo, volume da tavola" },
    { id: "festa", nome: "Festa", es: "dopo i balli, per tutti" },
    { id: "discoteca", nome: "Discoteca", es: "la parte più ballata della sera" },
    { id: "chiusura", nome: "Chiusura", es: "a fine serata, mentre si saluta" },
    { id: "speciali", nome: "Canzoni dei momenti, tutte insieme", es: "una playlist con tutte le canzoni del passo 2: così le trovo al volo" }
  ];

  // Il segnale d'esempio dice CHI fa COSA: «la sposa varca il cancello», non
  // «all'arrivo» (METODO §5). Gli sposi lo imparano dagli esempi.
  var MOMENTI = [
    { id: "arrivo", titolo: "Arrivo degli invitati e buffet", musica: "playlist", playlist: "buffet",
      segnale: "quando arrivano i primi invitati", dove: "giardino",
      aiuto: "La musica che accoglie gli invitati mentre arrivano e mangiano." },
    { id: "sposi", titolo: "Arrivo degli sposi", musica: "brano", poi: "playlist", poiPlaylist: "buffet",
      segnale: "quando l'auto degli sposi entra nel cortile", dove: "ingresso",
      aiuto: "La canzone che vi accoglie quando arrivate alla location." },
    { id: "sala", titolo: "Entrata degli sposi in sala", musica: "brano", poi: "playlist", poiPlaylist: "pranzo",
      segnale: "quando gli sposi sono sulla porta della sala", dove: "sala",
      aiuto: "Gli invitati sono già seduti: entrate voi." },
    { id: "pranzo", titolo: "Pranzo o cena", musica: "playlist", playlist: "pranzo",
      segnale: "quando gli invitati si siedono", dove: "sala",
      aiuto: "Sottofondo a volume da conversazione." },
    { id: "ballo", titolo: "Primo ballo degli sposi", musica: "brano", poi: "successivo",
      segnale: "quando gli sposi arrivano al centro della pista", dove: "pista",
      aiuto: "Se volete partire da un punto preciso della canzone, scrivetelo sotto." },
    { id: "genitori", titolo: "Balli con i genitori", musica: "brano", poi: "successivo", multi: true,
      segnale: "subito dopo il primo ballo", dove: "pista",
      aiuto: "Un brano per ogni ballo: con «Aggiungi un altro brano» ne mettete quanti volete." },
    { id: "torta", titolo: "Taglio della torta", musica: "brano", poi: "playlist", poiPlaylist: "pranzo",
      segnale: "quando la torta arriva al tavolo degli sposi", dove: "sala" },
    { id: "video", titolo: "Video", speciale: "video" },
    { id: "festa", titolo: "Festa della sera", musica: "playlist", playlist: "festa",
      segnale: "dopo i balli", dove: "pista",
      aiuto: "Se alla festa c'è musica dal vivo, sceglietela qui sotto." },
    { id: "discoteca", titolo: "Discoteca", musica: "playlist", playlist: "discoteca",
      segnale: "quando si passa dentro, a fine cena", dove: "sala" },
    { id: "speciali", titolo: "Canzoni speciali", musica: "brano", poi: "playlist", poiPlaylist: "festa", multi: true,
      segnale: "quando il testimone fa il brindisi", dove: "",
      aiuto: "Dediche, sorprese, la canzone di un amico: una per brano, e in «per chi» scrivete a chi è dedicata." },
    { id: "chiusura", titolo: "Chiusura", musica: "brano", poi: "silenzio",
      segnale: "quando gli sposi salutano gli ultimi invitati", dove: "",
      aiuto: "L'ultima canzone della giornata." }
  ];

  var ALTRI_MOMENTI = ["Cerimonia", "Musica dal vivo", "Discorsi e brindisi", "Lancio del bouquet", "Fuochi o sorpresa", "Altro momento"];

  var ANNUNCI = [
    { id: "sala", titolo: "Invitare a entrare in sala", quando: "alla fine del buffet",
      testo: "Gentili ospiti, gli sposi vi invitano ad accomodarvi in sala: tra pochi minuti si comincia. Grazie!" },
    { id: "tavoli", titolo: "Chiamare i tavoli per le foto", quando: "durante il pranzo, un tavolo alla volta",
      testo: "Gli ospiti del tavolo [nome del tavolo] possono raggiungere gli sposi in [giardino] per la foto di gruppo. Grazie!" },
    { id: "torta", titolo: "Taglio della torta", quando: "qualche minuto prima della torta",
      testo: "Tra pochi minuti gli sposi tagliano la torta: vi aspettano in [giardino]!" },
    { id: "video", titolo: "Prima del video", quando: "subito prima del video",
      testo: "Vi chiediamo qualche minuto di attenzione: sta per partire un video dedicato agli sposi." },
    { id: "bouquet", titolo: "Lancio del bouquet", quando: "",
      testo: "Il bouquet sta per volare: chi vuole provare a prenderlo si avvicini a [dove]!" },
    { id: "ultima", titolo: "Ultima canzone", quando: "a fine serata",
      testo: "È l'ultima canzone della serata: gli sposi vi ringraziano di cuore per essere stati qui con loro." }
  ];

  var MUSICHE = [
    { v: "brano", t: "Una canzone" }, { v: "playlist", t: "Una playlist" },
    { v: "live", t: "Musica dal vivo" }, { v: "nessuna", t: "Niente musica" }
  ];
  var POI = [
    { v: "", t: "Scegliete…" }, { v: "playlist", t: "Torna una playlist" },
    { v: "silenzio", t: "Silenzio (si parla, si brinda)" },
    { v: "successivo", t: "Parte il brano o il momento dopo" }, { v: "altro", t: "Altro (scrivetelo)" }
  ];
  var CHI = [
    { v: "simone", t: "Simone, al microfono" }, { v: "fiducia", t: "Una persona di fiducia" }, { v: "sposi", t: "Noi sposi" }
  ];

  /* ————— lo stato ————— */

  function brano() { return { titolo: "", artista: "", versione: "", link: "", da: "", per: "" }; }

  function momento(m) {
    return {
      id: m.id, titolo: m.titolo, speciale: m.speciale || "", personalizzato: !!m.personalizzato,
      presente: null, ora: "", dove: "", segnale: "",
      musica: m.musica || "brano", playlist: m.playlist || "", brani: [brano()], live: "",
      poi: m.poi || "", poiPlaylist: m.poiPlaylist || "", poiAltro: "", note: ""
    };
  }

  function nuovo() {
    return {
      formato: FORMATO, versione: VERSIONE, passo: 1,
      sposi: { nome1: "", nome2: "", telefono: "" },
      evento: { data: "", location: "", indirizzo: "", comune: "", invitati: "", arrivo: "",
                coord: null, referente: { nome: "", ruolo: "", telefono: "" } },
      momenti: MOMENTI.map(momento),
      playlist: PLAYLIST.map(function (p) { return { id: p.id, nome: p.nome, titolo: "", link: "", note: "" }; }),
      fonte: "", nonMettere: "", invitatiScelgono: "",
      annunci: ANNUNCI.map(function (a) {
        return { id: a.id, titolo: a.titolo, attivo: false, testo: a.testo, chi: "simone", chiNome: "", quando: a.quando };
      }),
      video: { presente: null, cosa: "", durata: "", ora: "", segnale: "", audio: "", file: "", schermo: "", poi: "", poiPlaylist: "", note: "" },
      noteFinali: ""
    };
  }

  var S = nuovo();
  var passo = 1;
  var salvabile = true;

  function leggi(perc) {
    return perc.split(".").reduce(function (o, k) { return o == null ? undefined : o[k]; }, S);
  }
  function scrivi(perc, valore) {
    var k = perc.split("."), o = S;
    for (var i = 0; i < k.length - 1; i++) o = o[k[i]];
    o[k[k.length - 1]] = valore;
  }

  // Un file importato o un salvataggio vecchio: si parte dai valori di serie
  // e si sovrappone ciò che c'è, così un campo aggiunto dopo non resta undefined.
  function unisci(base, dati) {
    if (Array.isArray(base)) return Array.isArray(dati) ? dati : base;
    if (base && typeof base === "object") {
      if (!dati || typeof dati !== "object" || Array.isArray(dati)) return base;
      Object.keys(dati).forEach(function (k) { base[k] = k in base ? unisci(base[k], dati[k]) : dati[k]; });
      return base;
    }
    return dati === undefined ? base : dati;
  }
  // Gli elenchi (momenti, playlist, annunci) si uniscono per `id`: un salvataggio
  // fatto prima che si aggiungesse una voce la ritrova vuota; le voci inventate
  // dagli sposi (id che non conosciamo) restano in coda.
  function unisciPerId(base, dati, crea) {
    var out = base.map(function (b) {
      var d = (Array.isArray(dati) ? dati : []).filter(function (x) { return x && x.id === b.id; })[0];
      return d ? unisci(b, d) : b;
    });
    (Array.isArray(dati) ? dati : []).forEach(function (x) {
      if (x && typeof x === "object" && !base.some(function (b) { return b.id === x.id; })) out.push(crea ? crea(x) : x);
    });
    return out;
  }
  function ripara(dati) {
    dati = (dati && typeof dati === "object") ? dati : {};
    var liste = { momenti: dati.momenti, playlist: dati.playlist, annunci: dati.annunci };
    var resto = {};
    Object.keys(dati).forEach(function (k) { if (!(k in liste)) resto[k] = dati[k]; });
    var s = unisci(nuovo(), resto);
    s.formato = FORMATO; s.versione = VERSIONE;
    s.passo = Math.max(1, Math.min(6, +s.passo || 1));
    var base = nuovo();
    s.momenti = unisciPerId(base.momenti, liste.momenti, function (m) { return unisci(momento({ id: m.id || "m", titolo: m.titolo || "" }), m); })
      .map(function (b) {
        if (!Array.isArray(b.brani) || !b.brani.length) b.brani = [brano()];
        b.brani = b.brani.map(function (x) { return unisci(brano(), x); });
        return b;
      });
    s.playlist = unisciPerId(base.playlist, liste.playlist);
    s.annunci = unisciPerId(base.annunci, liste.annunci);
    return s;
  }

  /* ————— salvataggio nel browser ————— */

  var timerSalva = null;
  var modificato = false;     // c'è stato un cambiamento dall'ultima copia scaricata
  function salvaPresto() {
    modificato = true;
    clearTimeout(timerSalva);
    timerSalva = setTimeout(salva, 400);
  }
  function salva() {
    clearTimeout(timerSalva);
    var el = document.getElementById("salvataggio");
    try {
      S.salvato = new Date().toISOString();
      localStorage.setItem(CHIAVE, JSON.stringify(S));
      salvabile = true;
      if (el) { el.className = "salvataggio"; el.textContent = "Salvato su questo dispositivo alle " + oraAdesso() + "."; }
    } catch (e) {
      salvabile = false;
      if (el) { el.className = "salvataggio attenzione"; el.textContent = "Questo browser non tiene le risposte: prima di chiuderlo, scaricate il file al passo 6."; }
    }
  }
  function carica() {
    try {
      var t = localStorage.getItem(CHIAVE);
      if (t) { S = ripara(JSON.parse(t)); return true; }
    } catch (e) { /* bloccato o rovinato: si parte da zero */ }
    return false;
  }
  function oraAdesso() {
    var d = new Date();
    return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2);
  }

  /* ————— piccoli attrezzi ————— */

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function idDa(perc) { return "f-" + perc.replace(/\./g, "-"); }
  function avviso(t) {
    var el = document.getElementById("avviso");
    el.textContent = t; el.classList.add("su");
    clearTimeout(avviso.t); avviso.t = setTimeout(function () { el.classList.remove("su"); }, 3600);
  }
  function nomePlaylist(id) {
    var p = S.playlist.filter(function (x) { return x.id === id; })[0];
    return p ? (p.titolo || p.nome) : "";
  }

  // «13:30», «13.30», «ore 13», «circa 12:30» → minuti dalla mezzanotte.
  function minuti(t) {
    var m = /(\d{1,2})(?:\s*[:.,h]\s*(\d{2}))?/.exec(String(t || ""));
    if (!m) return null;
    var h = +m[1], mi = m[2] ? +m[2] : 0;
    if (h > 23 || mi > 59) return null;
    return h * 60 + mi;
  }
  // «1.20», «1:20», «80» (secondi) → «1:20». Se i secondi hanno una cifra sola
  // («1.5») non si indovina se sono cinque o cinquanta: si lascia com'è scritto.
  function puntoDa(t) {
    t = String(t || "").trim();
    if (!t) return "";
    var m = /^(\d{1,2})\s*[:.,']\s*(\d{2})$/.exec(t);
    if (m) return +m[1] + ":" + m[2];
    if (/^\d+$/.test(t)) { var s = +t; return Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2); }
    return t;
  }
  // «20.30», «20h30», «ore 20,30» → «20:30»; il resto del testo non si tocca.
  function oraNorm(t) {
    return String(t == null ? "" : t).replace(/\b(\d{1,2})\s*[.,h]\s*([0-5]\d)\b/g, function (x, h, mi) {
      return +h <= 23 ? ("0" + h).slice(-2) + ":" + mi : x;
    });
  }
  // I link: manca «https://» → si aggiunge; solo http(s) diventa un collegamento.
  function linkNorm(t) {
    t = String(t == null ? "" : t).trim();
    if (!t || /\s/.test(t) || /^[a-z][a-z0-9+.-]*:/i.test(t)) return t;
    return /^[^\/?#]+\.[^\/?#]{2,}/.test(t) ? "https://" + t : t;
  }
  function hrefSicuro(t) {
    var n = linkNorm(t);
    return /^https?:\/\/[^\s]+$/i.test(n) ? n : "";
  }
  function linkHTML(t) {
    var h = hrefSicuro(t);
    return h ? '<a href="' + esc(h) + '" target="_blank" rel="noopener">' + esc(corto(h)) + "</a>" : esc(t);
  }
  function oggiISO() {
    var d = new Date();
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  }
  function dataPassata() { return /^\d{4}-\d{2}-\d{2}$/.test(S.evento.data) && S.evento.data < oggiISO(); }
  function htmlDataPassata() {
    return dataPassata() ? "Questa data è già passata: è giusta? (Si può mandare lo stesso.)" : "";
  }
  function dataLunga(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    if (!m) return "";
    try {
      return new Intl.DateTimeFormat("it-IT", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" })
        .format(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])));
    } catch (e) { return m[3] + "/" + m[2] + "/" + m[1]; }
  }
  function nomi() {
    var a = S.sposi.nome1.trim(), b = S.sposi.nome2.trim();
    return a && b ? a + " e " + b : a || b;
  }

  /* ————— il sole ————— */

  function coordinate() {
    var c = S.evento.coord;
    if (c && isFinite(c.lat) && isFinite(c.lon)) return c;
    var l = window.Luoghi && Luoghi.trova(S.evento.comune);
    return l ? { lat: l[1], lon: l[2], fonte: "comune", nome: l[0] } : null;
  }
  function sole() {
    var c = coordinate();
    if (!c || !S.evento.data || !window.Sole) return null;
    var g = Sole.giorno(S.evento.data, c.lat, c.lon);
    if (!g || g.tramonto == null) return null;
    return {
      tramonto: Sole.ora(g.tramonto), luceDa: Sole.ora(g.luceDa), luceA: Sole.ora(g.luceA), buio: Sole.ora(g.buio),
      dove: c.fonte === "ricerca" ? c.nome : "centro di " + c.nome, fonte: c.fonte, lat: c.lat, lon: c.lon
    };
  }
  function htmlSole() {
    var s = sole();
    if (!s) {
      if (!S.evento.data) return '<p class="sole-vuoto">Scrivete la data e il comune: qui compare l\'ora del tramonto.</p>';
      return '<p class="sole-vuoto">Non riconosco il comune «' + esc(S.evento.comune || "…") +
        '». Sceglietelo dall\'elenco che compare mentre scrivete, oppure toccate «Calcola dal luogo».</p>';
    }
    return '<p class="sole-numeri"><span class="sole-tramonto">Tramonto <b>' + s.tramonto + '</b></span>' +
      '<span class="sole-luce">luce per le foto <b>' + s.luceDa + '–' + s.luceA + '</b></span></p>' +
      '<p class="sole-nota">È una pausa naturale: voi fate le foto con la luce più bella, io sistemo l\'impianto per la sera. ' +
      'Il buio arriva verso le ' + s.buio + '. Calcolato per ' + esc(s.dove) + '; in collina il sole può sparire qualche minuto prima.</p>';
  }
  function aggiornaSole() {
    var el = document.getElementById("sole");
    if (el) el.innerHTML = htmlSole();
  }

  // La sola richiesta fuori dal sito, e solo dopo un tocco.
  function cercaLuogo(bottone) {
    var q = [S.evento.indirizzo, S.evento.comune].filter(Boolean).join(", ") ||
            [S.evento.location, S.evento.comune].filter(Boolean).join(", ");
    var esito = document.getElementById("esito-luogo");
    if (!q.trim()) { esito.textContent = "Scrivete prima l'indirizzo o il comune della location."; return; }
    if (!window.fetch) { esito.textContent = "Questo browser non può cercare: scegliete il comune dall'elenco."; return; }
    bottone.disabled = true;
    esito.textContent = "Cerco «" + q + "» su OpenStreetMap…";
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 9000);
    fetch("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=it&accept-language=it&q=" +
          encodeURIComponent(q), { signal: ctrl ? ctrl.signal : undefined, headers: { "Accept": "application/json" } })
      .then(function (r) { if (!r.ok) throw new Error("http " + r.status); return r.json(); })
      .then(function (lista) {
        if (!lista || !lista.length) {
          esito.textContent = "Non trovo questo indirizzo. Provate solo con il comune, o sceglietelo dall'elenco.";
          return;
        }
        var r = lista[0], nome = String(r.display_name || q).split(",").slice(0, 3).join(",").trim();
        S.evento.coord = { lat: +(+r.lat).toFixed(4), lon: +(+r.lon).toFixed(4), fonte: "ricerca", nome: nome };
        esito.textContent = "Trovato: " + nome + ". Se non è il posto giusto, correggete l'indirizzo e riprovate.";
        aggiornaSole(); salvaPresto();
      })
      .catch(function () {
        esito.textContent = "Ricerca non riuscita (manca la rete?). Scegliete il comune dall'elenco: il tramonto si calcola anche senza rete.";
      })
      .then(function () { clearTimeout(timer); bottone.disabled = false; });
  }

  /* ————— i campi ————— */

  function campo(perc, etichetta, o) {
    o = o || {};
    var id = idDa(perc), v = leggi(perc);
    var aiuto = o.aiuto ? '<span class="aiuto" id="' + id + '-a">' + o.aiuto + "</span>" : "";
    var attr = ' id="' + id + '" data-bind="' + perc + '"' + (o.aiuto ? ' aria-describedby="' + id + '-a"' : "") +
      (o.placeholder ? ' placeholder="' + esc(o.placeholder) + '"' : "") +
      (o.inputmode ? ' inputmode="' + o.inputmode + '"' : "") +
      (o.list ? ' list="' + o.list + '"' : "") +
      ' autocomplete="' + (o.autocomplete || "off") + '"' + (o.extra || "");
    var ctrl = o.area
      ? '<textarea class="txt area" rows="' + (o.righe || 3) + '"' + attr + ">" + esc(v) + "</textarea>"
      : '<input class="txt" type="' + (o.tipo || "text") + '" value="' + esc(v) + '"' + attr + " />";
    return '<div class="campo' + (o.classe ? " " + o.classe : "") + '"><label class="lbl" for="' + id + '">' + etichetta +
      (o.obbl ? ' <span class="ast" title="serve davvero">*</span>' : "") +
      (o.sapete ? ' <span class="opz">se lo sapete</span>' : o.facoltativo ? ' <span class="opz">facoltativo</span>' : "") + "</label>" + aiuto + ctrl + "</div>";
  }

  function menu(perc, etichetta, scelte, o) {
    o = o || {};
    var id = idDa(perc), v = leggi(perc);
    return '<div class="campo' + (o.classe ? " " + o.classe : "") + '"><label class="lbl" for="' + id + '">' + etichetta + "</label>" +
      '<span class="sel-wrap"><select class="sel" id="' + id + '" data-bind="' + perc + '"' + (o.rifai ? " data-rifai" : "") + ">" +
      scelte.map(function (s) {
        return '<option value="' + esc(s.v) + '"' + (s.v === v ? " selected" : "") + ">" + esc(s.t) + "</option>";
      }).join("") + "</select></span></div>";
  }

  // Bottoni a scelta unica: veri radio (si girano con le frecce e i lettori di
  // schermo li annunciano come gruppo), vestiti da pulsanti grandi.
  function scelta(perc, legenda, scelte, o) {
    o = o || {};
    var id = idDa(perc), v = leggi(perc);
    return '<fieldset class="scelta' + (o.classe ? " " + o.classe : "") + '"><legend class="lbl' + (o.nascosta ? " nascosta" : "") + '">' + legenda + "</legend>" +
      '<div class="scelta-fila">' + scelte.map(function (s, i) {
        var val = s.v === true ? "true" : s.v === false ? "false" : s.v;
        var acceso = v === s.v;
        return '<label class="scelta-btn' + (acceso ? " acceso" : "") + '"><input type="radio" name="' + id + '" id="' + id + "-" + i +
          '" value="' + esc(val) + '" data-bind="' + perc + '" data-tipo="' + (typeof s.v) + '"' + (acceso ? " checked" : "") +
          (o.rifai !== false ? " data-rifai" : "") + " /><span>" + esc(s.t) + "</span></label>";
      }).join("") + "</div></fieldset>";
  }

  /* ————— passo 1: i vostri dati ————— */

  function passo1() {
    return '<section class="passo" aria-labelledby="h-passo">' +
      '<h2 id="h-passo" tabindex="-1">1 · I vostri dati</h2>' +
      '<p class="intro">Le risposte restano <b>su questo telefono</b> (o computer) finché non me le mandate voi, all\'ultimo passo. ' +
      'I campi con <span class="ast">*</span> servono davvero; il resto, se lo sapete.</p>' +
      '<p class="intro importa-riga">Avete già un file del modulo? <button type="button" class="link-btn" data-azione="importa">Caricatelo qui</button></p>' +
      '<div class="scheda">' +
        '<fieldset class="gruppo"><legend class="lbl">I vostri nomi</legend><div class="due">' +
          campo("sposi.nome1", "Nome", { placeholder: "es. Anna", autocomplete: "given-name", classe: "senza-sopra", obbl: true }) +
          campo("sposi.nome2", "Nome", { placeholder: "es. Marco", autocomplete: "off", classe: "senza-sopra", obbl: true }) +
        "</div></fieldset>" +
        campo("sposi.telefono", "Un telefono per sentirci", { tipo: "tel", inputmode: "tel", autocomplete: "tel", placeholder: "es. 345 123 4567", sapete: true }) +
        campo("evento.data", "Data del matrimonio", { tipo: "date", obbl: true }) +
        '<p class="aiuto avviso-data" id="avviso-data" role="status">' + htmlDataPassata() + "</p>" +
        campo("evento.invitati", "Quanti invitati, più o meno", { inputmode: "numeric", placeholder: "es. 120", sapete: true }) +
      "</div>" +
      '<h3 class="sotto">Dove</h3><div class="scheda">' +
        campo("evento.location", "Nome della location", { placeholder: "es. Villa …, Agriturismo …", obbl: true }) +
        campo("evento.indirizzo", "Indirizzo della location", { placeholder: "via e numero", autocomplete: "off", sapete: true }) +
        campo("evento.comune", "Comune", { list: "elenco-comuni", placeholder: "es. Bassano del Grappa", sapete: true,
          aiuto: "Serve per l'ora del tramonto. I comuni dell'elenco si riconoscono subito, anche senza rete." }) +
        '<datalist id="elenco-comuni">' + (window.Luoghi ? Luoghi.elenco.map(function (l) { return '<option value="' + esc(l[0]) + '">'; }).join("") : "") + "</datalist>" +
        '<div class="sole" id="sole" aria-live="polite">' + htmlSole() + "</div>" +
        '<div class="cerca"><button type="button" class="btn secondario piccolo" data-azione="cerca-luogo">Calcola dal luogo</button>' +
        '<span class="aiuto" id="esito-luogo">Cerca l\'indirizzo su OpenStreetMap: solo se lo toccate, e manda solo l\'indirizzo.</span></div>' +
        campo("evento.arrivo", "A che ora arrivano gli invitati alla location", { placeholder: "es. 12:30", sapete: true }) +
      "</div>" +
      '<h3 class="sotto">Chi mi dà il via, quel giorno</h3>' +
      '<p class="intro">Voi sarete occupati. Mi serve una persona che sappia il programma e risponda al telefono: un testimone, la wedding planner, il referente della location. ' +
      '<b>Avvisate la persona che mi date come contatto</b>: potrei chiamarla il giorno stesso. Nome e telefono finiscono nel file che mi mandate (<a href="/privacy/#modulo-musicale">come li tratto</a>).</p>' +
      '<div class="scheda">' +
        campo("evento.referente.nome", "Nome", { placeholder: "es. Giulia", sapete: true }) +
        campo("evento.referente.ruolo", "Chi è", { placeholder: "es. testimone, wedding planner", sapete: true }) +
        campo("evento.referente.telefono", "Telefono", { tipo: "tel", inputmode: "tel", placeholder: "es. 333 765 4321", sapete: true }) +
      "</div></section>";
  }

  /* ————— passi 2 e 3: elenco corto + schede a fisarmonica ————— */

  // Una scheda aperta alla volta: `aperto[passo]` è l'id della scheda aperta
  // (undefined = ancora da scegliere, null = tutte chiuse). I «dettagli» sono
  // un <details> nativo: si ricorda se erano aperti perché ridisegnare non li chiuda.
  var aperto = { 2: undefined, 3: undefined };
  var dettAperti = {};

  function musicaFatta(m) {
    if (m.musica === "brano") return m.brani.some(function (b) { return String(b.titolo).trim(); });
    if (m.musica === "playlist") return !!m.playlist;
    if (m.musica === "live") return !!String(m.live).trim();
    return true; // «nessuna»
  }
  function compilato(m) { return m.presente === true && musicaFatta(m) && !!String(m.segnale).trim(); }
  // Numero del momento nell'elenco: il video (passo 5) non conta.
  function numero(i) { return S.momenti.slice(0, i + 1).filter(function (m) { return !m.speciale; }).length; }
  function momentiVeri() { return S.momenti.filter(function (m) { return !m.speciale; }); }

  function riassuntoMusica(m) {
    if (m.musica === "brano") {
      var f = m.brani.filter(function (b) { return String(b.titolo).trim(); });
      if (!f.length) return "";
      return f[0].titolo + (f[0].artista ? " — " + f[0].artista : "") + (f.length > 1 ? " (+" + (f.length - 1) + ")" : "");
    }
    if (m.musica === "playlist") return m.playlist ? "Playlist «" + nomePlaylist(m.playlist) + "»" : "";
    if (m.musica === "live") return m.live ? "Musica dal vivo" : "";
    return "Niente musica";
  }
  function testataMomento(m, n) {
    var fatto = compilato(m), r = [oraNorm(m.ora), riassuntoMusica(m)].filter(Boolean).join(" · ");
    var sub = fatto ? r : (r ? r + " · " : "") + (musicaFatta(m) && !String(m.segnale).trim() ? "manca il segnale" : "da compilare");
    return '<span class="num">' + n + '</span><span class="acc-testi"><span class="acc-nome">' + esc(m.titolo || "Momento senza nome") + '</span>' +
      '<span class="acc-sub' + (fatto ? "" : " da-fare") + '">' + esc(sub) + "</span></span>" +
      '<span class="acc-stato" aria-hidden="true">' + (fatto ? "✓" : "›") + "</span>" +
      (fatto ? '<span class="nascosta">compilato</span>' : "");
  }
  function testataPlaylist(p, n) {
    var fatto = !!String(p.link).trim();
    var sub = fatto ? (p.titolo ? p.titolo + " · " : "") + "link inserito" : "nessun link: lasciate vuota se non vi serve";
    return '<span class="num">' + n + '</span><span class="acc-testi"><span class="acc-nome">' + esc(p.nome) + '</span>' +
      '<span class="acc-sub' + (fatto ? "" : " da-fare") + '">' + esc(sub) + "</span></span>" +
      '<span class="acc-stato" aria-hidden="true">' + (fatto ? "✓" : "›") + "</span>" + (fatto ? '<span class="nascosta">con link</span>' : "");
  }
  function testoContatore() {
    if (passo === 3) {
      var c = S.playlist.filter(function (p) { return String(p.link).trim(); }).length;
      return "<b>" + c + " di " + S.playlist.length + "</b> playlist con il link";
    }
    var mm = momentiVeri(), conf = mm.filter(function (m) { return m.presente === true; }),
        ok = conf.filter(compilato).length, ind = mm.filter(function (m) { return m.presente === null; }).length;
    if (!conf.length) return "Segnate sotto quali momenti ci saranno" + (ind ? " (" + ind + " da decidere)" : "");
    return "<b>" + ok + " di " + conf.length + "</b> momenti compilati" + (ind ? " · " + ind + " da decidere" : "");
  }
  function contatoreHTML() { return '<p class="contatore" id="contatore">' + testoContatore() + "</p>"; }
  // Mentre si scrive: contatore e riga riassuntiva si aggiornano senza ridisegnare.
  function aggiornaSintesi() {
    if (passo !== 2 && passo !== 3) return;
    var c = document.getElementById("contatore");
    if (c) c.innerHTML = testoContatore();
    Array.prototype.forEach.call(document.querySelectorAll("[data-testata]"), function (b) {
      var k = b.dataset.k, h = "";
      if (passo === 2) { var i = indiceMomento(k); if (i >= 0) h = testataMomento(S.momenti[i], numero(i)); }
      else { var j = indicePlaylist(k); if (j >= 0) h = testataPlaylist(S.playlist[j], j + 1); }
      // Solo se è cambiata: sostituire il contenuto di un bottone mentre lo si sta
      // toccando (il campo perde il fuoco, scatta «change») farebbe perdere il tocco.
      if (h && b.dataset.h !== h) { b.innerHTML = h; b.dataset.h = h; }
    });
  }
  function indiceMomento(id) { for (var i = 0; i < S.momenti.length; i++) if (S.momenti[i].id === id) return i; return -1; }
  function indicePlaylist(id) { for (var i = 0; i < S.playlist.length; i++) if (S.playlist[i].id === id) return i; return -1; }

  // Il primo scheda da fare si apre da sola, una volta.
  function risolviAperto() {
    if (aperto[2] === undefined) {
      var c = momentiVeri().filter(function (m) { return m.presente === true && !compilato(m); })[0];
      if (c) aperto[2] = c.id;
    }
    if (aperto[3] === undefined) {
      var p = S.playlist.filter(function (x) { return !String(x.link).trim(); })[0];
      if (p) aperto[3] = p.id;
    }
  }

  function dettagli(chiave, campi, haValori) {
    var aperta = dettAperti[chiave] !== undefined ? dettAperti[chiave] : haValori;
    return '<details class="altri" data-det="' + esc(chiave) + '"' + (aperta ? " open" : "") + '><summary>Altri dettagli <span class="opz">facoltativo</span></summary>' +
      '<div class="altri-corpo">' + campi + "</div></details>";
  }

  function schedaAcc(id, i, aperta, testata, corpo, extra) {
    var cid = "acc-" + id;
    return '<article class="momento acc c-e' + (aperta ? " aperta" : "") + '" id="' + cid + '">' +
      '<h3 class="acc-titolo"><button type="button" class="acc-testa" id="' + cid + '-t" data-azione="apri" data-k="' + esc(id) + '" data-testata="1" data-h="' + esc(testata) + '" aria-expanded="' + (aperta ? "true" : "false") +
      '" aria-controls="' + cid + '-corpo">' + testata + "</button></h3>" +
      (aperta ? '<div class="acc-corpo" id="' + cid + '-corpo">' + corpo + "</div>" : "") + (extra || "") + "</article>";
  }

  function opzioniPlaylist() {
    return [{ v: "", t: "Scegliete la playlist…" }].concat(S.playlist.map(function (p) { return { v: p.id, t: p.nome }; }));
  }

  function riga(m, i) {
    var base = "momenti." + i, stato = m.presente === true ? " c-e" : m.presente === false ? " non-c-e" : "";
    if (m.speciale === "video") {
      return '<li class="riga-momento video-rimando"><span class="riga-nome">' + esc(m.titolo) + '</span> <span class="aiuto">si decide al passo 5</span> ' +
        '<button type="button" class="link-btn" data-azione="vai" data-passo="5">Vai al video ›</button></li>';
    }
    return '<li class="riga-momento' + stato + '"><span class="riga-nome"><span class="num">' + numero(i) + "</span>" + esc(m.titolo || "Momento senza nome") + "</span>" +
      scelta(base + ".presente", "Ci sarà questo momento? — " + esc(m.titolo), [{ v: true, t: "Ci sarà" }, { v: false, t: "Non ci sarà" }], { nascosta: true, classe: "presenza" }) +
      (m.personalizzato ? '<button type="button" class="link-btn togli-riga" data-azione="togli-momento" data-i="' + i + '">Togli questo momento</button>' : "") + "</li>";
  }

  function corpoMomento(m, i, ultimo) {
    var base = "momenti." + i, modello = MOMENTI.filter(function (x) { return x.id === m.id; })[0] || {};
    var h = (modello.aiuto ? '<p class="aiuto">' + modello.aiuto + "</p>" : "");
    if (m.personalizzato) h += campo(base + ".titolo", "Come lo chiamate", { placeholder: "es. Musica dal vivo" });
    h += campo(base + ".ora", "A che ora, circa", { placeholder: "es. 13:30 · a seguire", sapete: true }) +
      campo(base + ".segnale", "Il segnale: chi mi dà il via", { placeholder: "es. " + (modello.segnale || "quando la sposa entra dal cancello"),
        aiuto: "Chi fa cosa: è il momento in cui premo «play»." }) +
      menu(base + ".musica", "Che musica", MUSICHE, { rifai: true });
    var unico = m.musica === "brano" && m.brani.length === 1;
    if (m.musica === "brano") {
      h += '<div class="brani">' + m.brani.map(function (b, j) { return cartaBrano(m, i, j, !unico); }).join("") + "</div>" +
        '<button type="button" class="btn secondario piccolo" data-azione="aggiungi-brano" data-i="' + i + '">＋ Aggiungi un altro brano</button>';
    } else if (m.musica === "playlist") {
      h += menu(base + ".playlist", "Quale playlist", opzioniPlaylist()) +
        '<p class="aiuto">Il link della playlist lo mettete al passo 3.</p>';
    } else if (m.musica === "live") {
      h += campo(base + ".live", "Chi suona, e con cosa", { area: true, righe: 2, placeholder: "es. trio: chitarra classica e voce, hanno il loro mixer",
        aiuto: "Microfoni, prese e collegamenti li vedo io con i musicisti." });
    }
    h += menu(base + ".poi", "Poi cosa succede", POI, { rifai: true });
    if (m.poi === "playlist") h += menu(base + ".poiPlaylist", "Quale playlist torna", opzioniPlaylist());
    if (m.poi === "altro") h += campo(base + ".poiAltro", "Cosa succede dopo", { placeholder: "es. parlano i testimoni, poi la torta" });
    var det = campo(base + ".dove", "Dove", { placeholder: modello.dove ? "es. " + modello.dove : "es. giardino, sala", facoltativo: true });
    var haVal = !!(m.dove || m.note);
    if (unico) { det += dettagliBrano("momenti." + i + ".brani.0", m.brani[0]); haVal = haVal || !!(m.brani[0].versione || m.brani[0].da || m.brani[0].link); }
    det += campo(base + ".note", "Note", { area: true, righe: 2, facoltativo: true, placeholder: "es. volume basso, il papà è emozionato…" });
    h += dettagli(m.id, det, haVal);
    h += '<div class="acc-fine"><button type="button" class="btn primario" data-azione="prossimo" data-k="' + esc(m.id) + '">' +
      (ultimo ? "Fatto" : "Fatto, prossimo momento") + "</button>" +
      (m.personalizzato ? '<button type="button" class="link-btn" data-azione="togli-momento" data-i="' + i + '">Togli questo momento</button>' : "") + "</div>";
    return h;
  }

  function dettagliBrano(b, x) {
    return campo(b + ".versione", "Versione", { list: "elenco-versioni", placeholder: "originale", facoltativo: true }) +
      campo(b + ".da", "Da che punto", { inputmode: "decimal", placeholder: "es. 0.45", facoltativo: true,
        aiuto: "Minuti.secondi, es. 0.45: la canzone parte da 45 secondi." }) +
      campo(b + ".link", "Link della canzone", { tipo: "url", inputmode: "url", placeholder: "incollate il link della canzone", facoltativo: true });
  }

  function cartaBrano(m, i, j, conDettagli) {
    var b = "momenti." + i + ".brani." + j, conPer = m.brani.length > 1 || m.id === "genitori" || m.id === "speciali" || m.personalizzato;
    var x = m.brani[j];
    return '<fieldset class="brano"><legend class="lbl">' + (m.brani.length > 1 ? "Brano " + (j + 1) : "La canzone") + "</legend>" +
      (conPer ? campo(b + ".per", "Per chi o per cosa", { placeholder: m.id === "genitori" ? "es. ballo con il papà" : "es. dedica agli amici", facoltativo: true }) : "") +
      campo(b + ".titolo", "Titolo", { placeholder: "es. Titolo della canzone" }) +
      campo(b + ".artista", "Artista", { placeholder: "es. Nome dell'artista" }) +
      (conDettagli ? dettagli(m.id + "-" + j, dettagliBrano(b, x), !!(x.versione || x.da || x.link)) : "") +
      (m.brani.length > 1 ? '<p class="togli"><button type="button" class="link-btn" data-azione="togli-brano" data-i="' + i + '" data-j="' + j + '">Togli questo brano</button></p>' : "") +
      "</fieldset>";
  }

  function passo2() {
    risolviAperto();
    var conf = [];
    S.momenti.forEach(function (m, i) { if (!m.speciale && m.presente === true) conf.push([m, i]); });
    return '<section class="passo" aria-labelledby="h-passo">' +
      '<h2 id="h-passo" tabindex="-1">2 · I momenti</h2>' +
      '<p class="intro">Prima segnate <b>quali momenti ci saranno</b>, poi compilate solo quelli. ' +
      'Quello che non sapete ancora lasciatelo vuoto: ne parliamo.</p>' +
      '<datalist id="elenco-versioni"><option value="originale"><option value="live"><option value="acustica"><option value="strumentale"><option value="remix"><option value="versione corta"></datalist>' +
      contatoreHTML() +
      '<h3 class="sotto">Quali momenti ci saranno</h3>' +
      '<ul class="elenco-momenti">' + S.momenti.map(riga).join("") + "</ul>" +
      '<div class="aggiungi-momento"><p class="aiuto">Un altro momento?</p><div class="chips">' +
      ALTRI_MOMENTI.map(function (t) { return '<button type="button" class="chip" data-azione="aggiungi-momento" data-titolo="' + esc(t) + '">＋ ' + esc(t) + "</button>"; }).join("") +
      "</div></div>" +
      '<h3 class="sotto">Ora compilate i momenti che ci saranno</h3>' +
      (conf.length
        ? '<p class="aiuto">Toccate un momento per aprirlo. Per i link: dal telefono, «Condividi» sulla canzone → «Copia link», poi incollate in «Altri dettagli».</p>' +
          conf.map(function (c, n) {
            return schedaAcc(c[0].id, c[1], aperto[2] === c[0].id, testataMomento(c[0], numero(c[1])), corpoMomento(c[0], c[1], n === conf.length - 1));
          }).join("")
        : '<p class="aiuto">Quando segnate «Ci sarà», il momento compare qui da compilare.</p>') +
      "</section>";
  }

  function passo3() {
    risolviAperto();
    return '<section class="passo" aria-labelledby="h-passo">' +
      '<h2 id="h-passo" tabindex="-1">3 · Le playlist</h2>' +
      '<p class="intro">Fra un momento e l\'altro suonano le vostre playlist. Incollate il link di quelle che avete; ' +
      'quelle che non vi servono lasciatele vuote.</p>' + contatoreHTML() +
      S.playlist.map(function (p, i) {
        var mod = PLAYLIST.filter(function (x) { return x.id === p.id; })[0] || {}, b = "playlist." + i;
        var corpo = (mod.es ? '<p class="aiuto">' + esc(mod.es) + "</p>" : "") +
          campo(b + ".link", "Link della playlist", { tipo: "url", inputmode: "url", placeholder: "incollate il link della playlist",
            aiuto: "Dal telefono: «Condividi» sulla playlist → «Copia link», poi incollate qui." }) +
          dettagli("pl-" + p.id, campo(b + ".titolo", "Come si chiama la playlist", { placeholder: "es. Buffet matrimonio", facoltativo: true }) +
            campo(b + ".note", "Note", { area: true, righe: 2, facoltativo: true, placeholder: "es. solo strumentale fino alle 14" }), !!(p.titolo || p.note)) +
          '<div class="acc-fine"><button type="button" class="btn primario" data-azione="prossimo" data-k="' + esc(p.id) + '">' +
          (i === S.playlist.length - 1 ? "Fatto" : "Fatto, prossima playlist") + "</button></div>";
        return schedaAcc(p.id, i, aperto[3] === p.id, testataPlaylist(p, i + 1), corpo);
      }).join("") +
      '<div class="scheda">' +
        campo("nonMettere", "Canzoni da NON mettere", { area: true, righe: 3, facoltativo: true,
          placeholder: "es. niente trenini, niente «canzone X»",
          aiuto: "Vale anche per le richieste degli invitati." }) +
        scelta("fonte", "Da dove arriva la musica", [
          { v: "account", t: "Dal nostro account (playlist)" }, { v: "file", t: "File nostri (chiavetta, computer)" }, { v: "misto", t: "Un po' e un po'" }
        ], { rifai: false }) +
        '<p class="aiuto">La musica è vostra: le playlist dal vostro account, o i vostri file. Se potete, rendete le playlist disponibili offline: in molte location la rete non regge. ' +
        'Il permesso SIAE per la festa lo richiedete voi: vi guido io nella richiesta.</p>' +
        scelta("invitatiScelgono", "Alla festa, gli invitati possono proporre canzoni?", [
          { v: "si", t: "Sì" }, { v: "no", t: "No" }, { v: "parliamo", t: "Ne parliamo" }
        ], { rifai: false }) +
      "</div></section>";
  }

  /* ————— passo 4: gli annunci ————— */

  function passo4() {
    return '<section class="passo" aria-labelledby="h-passo">' +
      '<h2 id="h-passo" tabindex="-1">4 · Gli annunci</h2>' +
      '<p class="intro">Al microfono dico <b>poche parole e solo quando servono</b>: non faccio animazione. ' +
      'Scegliete gli annunci che volete e sistemate il testo: le parole fra [parentesi] sono da completare.</p>' +
      S.annunci.map(function (a, i) {
        var b = "annunci." + i, id = idDa(b + ".attivo");
        var h = '<article class="scheda annuncio' + (a.attivo ? " acceso" : "") + '">' +
          '<label class="spunta" for="' + id + '"><input type="checkbox" id="' + id + '" data-bind="' + b + '.attivo" data-tipo="check" data-rifai' + (a.attivo ? " checked" : "") + " />" +
          "<span>" + esc(a.titolo || "Annuncio") + "</span></label>";
        if (a.attivo) {
          if (a.personalizzato) h += campo(b + ".titolo", "Come lo chiamate", { placeholder: "es. Saluto dei nonni" });
          h += campo(b + ".testo", "Il testo", { area: true, righe: 3 }) +
            campo(b + ".quando", "Quando", { placeholder: "es. alla fine del buffet" }) +
            menu(b + ".chi", "Chi lo dice", CHI, { rifai: true });
          if (a.chi === "fiducia") h += campo(b + ".chiNome", "Chi è", { placeholder: "es. il testimone, Luca" });
        }
        if (a.personalizzato) h += '<p class="togli"><button type="button" class="link-btn" data-azione="togli-annuncio" data-i="' + i + '">Togli questo annuncio</button></p>';
        return h + "</article>";
      }).join("") +
      '<button type="button" class="btn secondario piccolo" data-azione="aggiungi-annuncio">＋ Aggiungi un annuncio</button>' +
      "</section>";
  }

  /* ————— passo 5: il video ————— */

  function passo5() {
    var v = S.video, s = sole();
    var h = '<section class="passo" aria-labelledby="h-passo">' +
      '<h2 id="h-passo" tabindex="-1">5 · Il video</h2>' +
      '<p class="intro">Un video di ricordi, un saluto di chi non c\'è, una sorpresa degli amici: l\'audio passa dal mio impianto.</p>' +
      '<div class="scheda">' +
      scelta("video.presente", "Ci sarà un video?", [{ v: true, t: "Sì" }, { v: false, t: "No" }], { classe: "presenza" });
    if (v.presente === true) {
      h += campo("video.cosa", "Cos'è", { placeholder: "es. video dei ricordi preparato dagli amici" }) +
        '<div class="due">' +
          campo("video.durata", "Quanto dura", { placeholder: "es. 6 minuti" }) +
          campo("video.ora", "A che ora, circa", { placeholder: "es. 21:15" }) +
        "</div>" +
        (s ? '<p class="aiuto">Quel giorno il buio arriva verso le <b>' + s.buio + "</b>: prima, un video proiettato si vede poco.</p>" : "") +
        campo("video.segnale", "Quando parte: il segnale", { placeholder: "es. dopo il taglio della torta, quando lo dice il testimone" }) +
        scelta("video.audio", "Il video ha l'audio?", [{ v: "si", t: "Sì" }, { v: "no", t: "No, è muto" }, { v: "nonso", t: "Non lo so" }], { rifai: false }) +
        campo("video.file", "Chi porta il file, e come", { placeholder: "es. Luca, su chiavetta USB",
          aiuto: "Se potete, mandatemelo qualche giorno prima: lo provo con l'impianto." }) +
        scelta("video.schermo", "Schermo e proiettore", [
          { v: "location", t: "Li ha la location" }, { v: "noi", t: "Li portiamo noi" }, { v: "simone", t: "Da chiedere a Simone" }, { v: "nonso", t: "Non lo so" }
        ], { rifai: false }) +
        menu("video.poi", "Poi cosa succede", POI, { rifai: true });
      if (v.poi === "playlist") h += menu("video.poiPlaylist", "Quale playlist torna", opzioniPlaylist());
      h += campo("video.note", "Note", { area: true, righe: 2, facoltativo: true });
    }
    return h + "</div></section>";
  }

  /* ————— passo 6: riepilogo ————— */

  function descriviMusica(m) {
    if (m.musica === "playlist") return m.playlist ? "Playlist «" + nomePlaylist(m.playlist) + "»" : "Playlist (da scegliere)";
    if (m.musica === "live") return "Musica dal vivo" + (m.live ? " — " + m.live : "");
    if (m.musica === "nessuna") return "—";
    return m.brani.filter(function (b) { return b.titolo || b.artista || b.link; }).map(function (b) {
      return (b.per ? b.per + ": " : "") + (b.titolo ? "«" + b.titolo + "»" : "(titolo da scrivere)") +
        (b.artista ? " — " + b.artista : "") + (b.versione && !/^originale$/i.test(b.versione) ? " (" + b.versione + ")" : "");
    }).join("\n") || "Canzone (da scegliere)";
  }
  function descriviPoi(x) {
    if (x.poi === "playlist") return x.poiPlaylist ? "riprendere la playlist «" + nomePlaylist(x.poiPlaylist) + "»" : "riprendere una playlist";
    if (x.poi === "silenzio") return "silenzio";
    if (x.poi === "successivo") return "parte il brano o il momento dopo";
    if (x.poi === "altro") return x.poiAltro || "altro (da chiarire)";
    return "";
  }
  function indicazioni(m) {
    var p = [];
    if (m.segnale) p.push("Parte " + (/^(quando|appena|dopo|subito|alla|al |all')/i.test(m.segnale) ? "" : "con: ") + m.segnale + ".");
    if (m.dove) p.push("Dove: " + m.dove + ".");
    if (m.musica === "brano") m.brani.forEach(function (b) {
      if (puntoDa(b.da)) p.push(m.brani.length > 1 && b.titolo ? "«" + b.titolo + "» da " + puntoDa(b.da) + "." : "Partire da " + puntoDa(b.da) + ".");
    });
    var poi = descriviPoi(m);
    if (poi) p.push("Al termine: " + poi + ".");
    if (m.note) p.push(m.note);
    return p.join(" ");
  }

  // Le righe della cronotabella, in ordine di ora. Un momento senza ora resta
  // dopo quello che lo precede nell'elenco («a seguire»).
  function righe() {
    var r = [], chiave = -1, ordine = 0;
    S.momenti.forEach(function (m) {
      var x = m.speciale === "video" ? videoComeMomento() : m;
      if (!x || x.presente !== true) return;
      var t = minuti(x.ora);
      var k = t != null ? t : x.id === "chiusura" ? 9999 : chiave + 0.001;
      if (k !== 9999) chiave = k;
      r.push({ k: k, o: ordine++, ora: x.ora || (x.id === "chiusura" ? "alla fine" : "a seguire"), momento: x.titolo, musica: x.speciale === "video" ? x.musicaTesto : descriviMusica(x),
               indicazioni: x.speciale === "video" ? x.indicazioniTesto : indicazioni(x), dove: x.dove, segnale: x.segnale, tipo: x.speciale || x.musica, rif: x });
    });
    var s = sole();
    if (s) {
      r.push({ k: minuti(s.luceDa) - 0.0005, o: -1, ora: s.luceDa + "–" + s.luceA, momento: "Luce per le foto · tramonto " + s.tramonto,
               musica: "", indicazioni: "Pausa naturale: foto degli sposi all'aperto, cambi di impianto per la sera. Buio verso le " + s.buio + ".", tipo: "sole" });
    }
    r.sort(function (a, b) { return a.k - b.k || a.o - b.o; });
    return r;
  }
  function videoComeMomento() {
    var v = S.video;
    if (v.presente !== true) return null;
    var ind = [];
    if (v.segnale) ind.push("Parte " + (/^(quando|appena|dopo|subito|alla|al |all')/i.test(v.segnale) ? "" : "con: ") + v.segnale + ".");
    if (v.durata) ind.push("Durata " + v.durata + ".");
    ind.push(v.audio === "si" ? "Audio del video sull'impianto." : v.audio === "no" ? "Video muto: musica sotto da decidere." : "Audio: da verificare.");
    if (v.file) ind.push("File: " + v.file + ".");
    var sch = { location: "schermo della location", noi: "schermo portato dagli sposi", simone: "schermo da chiedere a Simone", nonso: "schermo da chiarire" }[v.schermo];
    if (sch) ind.push("Proiezione: " + sch + ".");
    var poi = descriviPoi(v);
    if (poi) ind.push("Al termine: " + poi + ".");
    if (v.note) ind.push(v.note);
    return { speciale: "video", presente: true, titolo: "Video", ora: v.ora, segnale: v.segnale, dove: "",
             musicaTesto: "Video" + (v.cosa ? ": " + v.cosa : ""), indicazioniTesto: ind.join(" ") };
  }

  function mancanze() {
    var m = [];
    if (!nomi()) m.push([1, "i vostri nomi"]);
    if (!S.evento.data) m.push([1, "la data del matrimonio"]);
    if (!S.evento.location && !S.evento.indirizzo) m.push([1, "la location"]);
    var daDecidere = S.momenti.filter(function (x) { return !x.speciale && x.presente === null; }).map(function (x) { return x.titolo; });
    if (daDecidere.length) m.push([2, "ci sarà o no: " + daDecidere.join(", ").toLowerCase()]);
    S.momenti.forEach(function (x) {
      if (x.presente !== true) return;
      if (x.musica === "brano" && !x.brani.some(function (b) { return b.titolo; })) m.push([2, "la canzone di «" + x.titolo + "»"]);
      if (x.musica === "playlist" && !x.playlist) m.push([2, "quale playlist per «" + x.titolo + "»"]);
      if (!String(x.segnale).trim()) m.push([2, "il segnale di «" + x.titolo + "»: chi mi dà il via"]);
    });
    var usate = {};
    S.momenti.forEach(function (x) {
      if (x.presente !== true) return;
      if (x.musica === "playlist" && x.playlist) usate[x.playlist] = 1;
      if (x.poi === "playlist" && x.poiPlaylist) usate[x.poiPlaylist] = 1;
    });
    S.playlist.forEach(function (p) { if (usate[p.id] && !p.link) m.push([3, "il link della playlist «" + p.nome + "»"]); });
    if (S.video.presente === null) m.push([5, "se ci sarà un video"]);
    return m;
  }

  function tabellaHTML() {
    var r = righe();
    if (!r.length) return '<p class="aiuto">Ancora nessun momento: al passo 2 segnate quelli che ci saranno.</p>';
    return '<div class="tabella-scorre"><table class="crono"><caption class="nascosta">Programma musicale della giornata</caption>' +
      '<thead><tr><th scope="col">Ora</th><th scope="col">Momento</th><th scope="col">Musica</th><th scope="col">Indicazioni</th></tr></thead><tbody>' +
      r.map(function (x) {
        return '<tr class="' + (x.tipo === "sole" ? "riga-sole" : "") + '"><td class="c-ora">' + esc(x.ora) + "</td><td class=\"c-momento\">" + esc(x.momento) +
          "</td><td class=\"c-musica\">" + esc(x.musica).replace(/\n/g, "<br>") + "</td><td>" + esc(x.indicazioni) + "</td></tr>";
      }).join("") + "</tbody></table></div>";
  }

  function corto(link) {
    try { var u = new URL(link); return u.hostname.replace(/^www\.|^open\./, "") + (u.pathname.length > 1 ? u.pathname.slice(0, 24) + (u.pathname.length > 24 ? "…" : "") : ""); }
    catch (e) { return link; }
  }

  function passo6() {
    var s = sole(), mm = mancanze();
    var testa = '<div class="foglio-testa"><p class="occhiello">Piano musicale</p><h3 class="foglio-nomi">' + esc(nomi() || "Matrimonio") + "</h3>" +
      '<p class="foglio-dati">' + esc([dataLunga(S.evento.data), S.evento.location, [S.evento.indirizzo, S.evento.comune].filter(Boolean).join(", ")].filter(Boolean).join(" · ")) + "</p>" +
      (s ? '<p class="foglio-sole"><span class="nowrap">Tramonto ' + s.tramonto + '</span> · <span class="nowrap">luce per le foto ' + s.luceDa + "–" + s.luceA + "</span></p>" : "") +
      (S.evento.referente.nome ? '<p class="foglio-dati">Referente del giorno: ' + esc(S.evento.referente.nome) +
        (S.evento.referente.ruolo ? " (" + esc(S.evento.referente.ruolo) + ")" : "") + (S.evento.referente.telefono ? " · " + esc(S.evento.referente.telefono) : "") + "</p>" : "") +
      "</div>";

    var playlistUsate = S.playlist.filter(function (p) { return p.link || p.titolo || p.note; });
    var pl = playlistUsate.length ? '<h3 class="sotto">Playlist</h3><ul class="elenco">' + playlistUsate.map(function (p) {
      return "<li><b>" + esc(p.nome) + "</b>" + (p.titolo ? " — «" + esc(p.titolo) + "»" : "") +
        (p.link ? " — " + linkHTML(p.link) : " — <i>link mancante</i>") +
        (p.note ? "<br><span class=\"aiuto\">" + esc(p.note) + "</span>" : "") + "</li>";
    }).join("") + "</ul>" : "";
    var altri = [];
    if (S.nonMettere) altri.push("<li><b>Da NON mettere:</b> " + esc(S.nonMettere) + "</li>");
    var fonte = { account: "dal loro account (playlist)", file: "file loro", misto: "account e file" }[S.fonte];
    if (fonte) altri.push("<li><b>Fonte della musica:</b> " + fonte + "</li>");
    var inv = { si: "sì", no: "no", parliamo: "ne parliamo" }[S.invitatiScelgono];
    if (inv) altri.push("<li><b>Gli invitati propongono canzoni alla festa:</b> " + inv + "</li>");
    if (altri.length) pl += '<ul class="elenco">' + altri.join("") + "</ul>";

    // I link dei brani: in tabella si leggerebbero male, qui sono uno per riga.
    var linkBrani = [];
    S.momenti.forEach(function (m) {
      if (m.presente === true && m.musica === "brano") m.brani.forEach(function (b) {
        if (b.link) linkBrani.push("<li>" + esc(m.titolo) + ": " + (b.titolo ? "«" + esc(b.titolo) + "» " : "") + linkHTML(b.link) + "</li>");
      });
    });
    var lb = linkBrani.length ? '<h3 class="sotto">Link delle canzoni</h3><ul class="elenco">' + linkBrani.join("") + "</ul>" : "";

    var an = S.annunci.filter(function (a) { return a.attivo; });
    var anH = an.length ? '<h3 class="sotto">Annunci</h3><ul class="elenco annunci-elenco">' + an.map(function (a) {
      var chi = a.chi === "fiducia" ? (a.chiNome || "una persona di fiducia") : a.chi === "sposi" ? "gli sposi" : "Simone";
      return "<li><b>" + esc(a.titolo) + "</b>" + (a.quando ? " · " + esc(a.quando) : "") + " · lo dice " + esc(chi) +
        '<br><span class="testo-annuncio">«' + esc(a.testo) + "»</span></li>";
    }).join("") + "</ul>" : "";

    return '<section class="passo" aria-labelledby="h-passo">' +
      '<h2 id="h-passo" tabindex="-1">6 · Riepilogo e invio</h2>' +
      (dataPassata() ? '<div class="manca"><p><b>Attenzione:</b> la data del matrimonio è già passata. <button type="button" class="link-btn" data-azione="vai" data-passo="1">Controllatela</button></p></div>' : "") +
      (mm.length ? '<div class="manca"><p><b>Manca ancora</b> (si può mandare lo stesso):</p><ul>' + mm.map(function (x) {
        return '<li><button type="button" class="link-btn" data-azione="vai" data-passo="' + x[0] + '">' + esc(x[1]) + "</button></li>";
      }).join("") + "</ul></div>" : '<p class="tutto-ok">Tutto compilato.</p>') +
      '<div class="invio scheda">' +
        '<h3 class="sotto senza-sopra">Mandatelo a Simone</h3>' +
        '<ol class="passi-invio">' +
          '<li><span>Mandate il file: dal telefono si apre la condivisione, scegliete WhatsApp (o la mail) e me.</span>' +
            '<button type="button" class="btn primario" data-azione="manda">Manda il file a Simone</button>' +
            '<p class="numero-wa">Il mio numero: <b class="selezionabile">340 457 9244</b> — salvatelo in rubrica.</p></li>' +
          '<li><span>Oppure scaricatelo e scrivetemi: vi apro la chat con un messaggio già pronto, il file lo allegate voi.</span>' +
            '<div class="fila-btn"><button type="button" class="btn secondario" data-azione="scarica">Scarica il file</button>' +
            '<a class="btn secondario" id="link-wa" href="' + linkWhatsApp() + '" target="_blank" rel="noopener">Apri WhatsApp</a></div>' +
            '<p class="aiuto">Dal computer: aprite WhatsApp, toccate la graffetta e scegliete il file scaricato.</p></li>' +
        "</ol>" +
        '<div class="fila-btn minori"><button type="button" class="btn secondario piccolo" data-azione="stampa">Stampa o salva in PDF</button>' +
          '<button type="button" class="btn secondario piccolo" data-azione="copia">Copia come testo</button>' +
          '<button type="button" class="btn secondario piccolo" data-azione="importa">Carica un file</button></div>' +
        '<p class="aiuto">Non parte niente da solo: siete voi a toccare «invia». Finché non lo fate, le risposte restano su questo dispositivo.</p>' +
      "</div>" +
      '<div class="foglio" id="foglio">' + testa + tabellaHTML() + pl + lb + anH +
        (S.noteFinali ? '<h3 class="sotto">Note</h3><p class="nota-finale">' + esc(S.noteFinali).replace(/\n/g, "<br>") + "</p>" : "") +
        '<p class="foglio-piede">Orari indicativi: le variazioni si gestiscono il giorno stesso, secondo come va la giornata.</p>' +
      "</div>" +
      '<div class="scheda non-stampa">' + campo("noteFinali", "Altro da dirmi", { area: true, righe: 3, facoltativo: true, placeholder: "tutto quello che non ha trovato posto sopra" }) + "</div>" +
      '<p class="ricomincia non-stampa"><button type="button" class="link-btn" data-azione="ricomincia">Cancella tutto e ricomincia</button></p>' +
      "</section>";
  }

  /* ————— esportare, condividere, stampare ————— */

  function datiDaEsportare() {
    var d = JSON.parse(JSON.stringify(S));
    delete d.passo;
    d.esportato = new Date().toISOString();
    // ore e link ripuliti come nel riepilogo (il formato del file non cambia)
    d.evento.arrivo = oraNorm(d.evento.arrivo); d.video.ora = oraNorm(d.video.ora);
    d.momenti.forEach(function (m) {
      m.ora = oraNorm(m.ora);
      (m.brani || []).forEach(function (b) { b.link = linkNorm(b.link); });
    });
    d.playlist.forEach(function (p) { p.link = linkNorm(p.link); });
    var s = sole();
    d.calcolati = s ? { tramonto: s.tramonto, luceDa: s.luceDa, luceA: s.luceA, buio: s.buio, lat: s.lat, lon: s.lon, dove: s.dove } : null;
    return d;
  }
  function nomeFile(est) {
    var n = (nomi() || "sposi").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
    var o = new Date(), hhmm = ("0" + o.getHours()).slice(-2) + ("0" + o.getMinutes()).slice(-2);
    return "piano-musicale_" + (S.evento.data || "senza-data") + "_" + n + "_" + hhmm + "." + (est || "json");
  }
  function scarica() {
    modificato = false; ultimoInvito = Date.now();
    var blob = new Blob([JSON.stringify(datiDaEsportare(), null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = nomeFile("json");
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    avviso("File scaricato: " + a.download);
  }
  function messaggioWhatsApp() {
    var chi = nomi(), quando = S.evento.data ? S.evento.data.split("-").reverse().join("/") : "";
    return "Ciao Simone, abbiamo compilato il modulo musicale" + (chi || quando ? " (" + [chi, quando].filter(Boolean).join(", ") + ")" : "") + ": ti mando il file.";
  }
  function linkWhatsApp() { return "https://wa.me/" + WHATSAPP + "?text=" + encodeURIComponent(messaggioWhatsApp()); }

  // La condivisione di sistema accetta solo alcuni tipi di file: Chrome per
  // Android rifiuta il .json, quindi se serve si prova lo stesso contenuto come .txt.
  function manda() {
    var testo = JSON.stringify(datiDaEsportare(), null, 2);
    var prove = [new File([testo], nomeFile("json"), { type: "application/json" }),
                 new File([testo], nomeFile("txt"), { type: "text/plain" })];
    var file = null;
    try {
      if (navigator.canShare) file = prove.filter(function (f) { return navigator.canShare({ files: [f] }); })[0] || null;
    } catch (e) { file = null; }
    var ripiega = function () {
      scarica();
      avviso("File scaricato. Ora toccate «Apri WhatsApp» e allegatelo nella chat.");
    };
    if (!file || !navigator.share) { ripiega(); return; }
    // Se la condivisione di sistema fallisce (non per un annullamento) si fa come
    // dove non esiste: file scaricato e invito ad aprire WhatsApp.
    try {
      navigator.share({ files: [file], title: "Piano musicale", text: messaggioWhatsApp() })
        .catch(function (e) { if (!e || e.name !== "AbortError") ripiega(); });
    } catch (e) { ripiega(); }
  }

  function testoSemplice() {
    var s = sole(), t = [];
    t.push("PIANO MUSICALE — " + (nomi() || "matrimonio"));
    t.push([dataLunga(S.evento.data), S.evento.location, [S.evento.indirizzo, S.evento.comune].filter(Boolean).join(", ")].filter(Boolean).join(" · "));
    if (s) t.push("Tramonto " + s.tramonto + " · luce per le foto " + s.luceDa + "–" + s.luceA);
    t.push("");
    righe().forEach(function (r) {
      t.push(r.ora + " · " + r.momento + "\n  " + r.musica.replace(/\n/g, "\n  ") + (r.indicazioni ? "\n  " + r.indicazioni : ""));
    });
    var pl = S.playlist.filter(function (p) { return p.link || p.titolo; });
    if (pl.length) { t.push("", "PLAYLIST"); pl.forEach(function (p) { t.push("- " + p.nome + (p.titolo ? " «" + p.titolo + "»" : "") + (p.link ? ": " + linkNorm(p.link) : "")); }); }
    S.momenti.forEach(function (m) {
      if (m.presente === true && m.musica === "brano") m.brani.forEach(function (b) { if (b.link) t.push("- " + m.titolo + (b.titolo ? " «" + b.titolo + "»" : "") + ": " + linkNorm(b.link)); });
    });
    if (S.nonMettere) t.push("", "DA NON METTERE: " + S.nonMettere);
    var an = S.annunci.filter(function (a) { return a.attivo; });
    if (an.length) { t.push("", "ANNUNCI"); an.forEach(function (a) { t.push("- " + a.titolo + (a.quando ? " (" + a.quando + ")" : "") + ": «" + a.testo + "»"); }); }
    if (S.noteFinali) t.push("", "NOTE: " + S.noteFinali);
    return t.join("\n");
  }
  function copia() {
    var t = testoSemplice();
    var fatto = function () { avviso("Riepilogo copiato: incollatelo nella chat."); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(fatto, function () { copiaVecchia(t); fatto(); });
    } else { copiaVecchia(t); fatto(); }
  }
  function copiaVecchia(t) {
    var a = document.createElement("textarea");
    a.value = t; a.setAttribute("readonly", ""); a.style.position = "fixed"; a.style.opacity = "0";
    document.body.appendChild(a); a.select();
    try { document.execCommand("copy"); } catch (e) { /* niente da fare */ }
    a.remove();
  }

  function importa(file) {
    var r = new FileReader();
    r.onload = function () {
      var dati;
      try { dati = JSON.parse(String(r.result)); } catch (e) { avviso("Questo file non è un modulo musicale."); return; }
      if (!dati || dati.formato !== FORMATO) { avviso("Questo file non è un modulo musicale."); return; }
      if (haDati() && !confirm("Sostituire le risposte di adesso con quelle del file?")) return;
      var prima = null;
      try { prima = JSON.stringify(S); localStorage.setItem(CHIAVE + "-prima", prima); } catch (e) { /* senza salvataggio resta in memoria */ }
      delete dati.calcolati; delete dati.esportato;
      S = ripara(dati);
      salva(); vaiA(1, true);
      avviso("Modulo caricato.");
      if (prima && haDatiDi(JSON.parse(prima))) {
        striscia("Modulo caricato. Le risposte di prima sono ancora lì.", [{ t: "Annulla caricamento", f: function () {
          try { S = ripara(JSON.parse(prima)); } catch (e) { return; }
          salva(); vaiA(S.passo, true); avviso("Ho rimesso le risposte di prima.");
        } }], 40000);
      }
    };
    r.readAsText(file);
  }
  function haDatiDi(x) {
    return !!((x.sposi && (x.sposi.nome1 || x.sposi.nome2)) || (x.evento && (x.evento.data || x.evento.location)) ||
      (x.momenti || []).some(function (m) { return m.presente !== null && m.presente !== undefined; }));
  }
  function haDati() { return haDatiDi(S); }

  /* ————— la striscia in basso: copia di sicurezza, «Annulla» ————— */

  var timerStriscia = null, ultimoInvito = Date.now();
  function striscia(testo, bottoni, ms) {
    var el = document.getElementById("striscia"), b = document.getElementById("striscia-b");
    document.getElementById("striscia-t").textContent = testo;
    b.innerHTML = "";
    bottoni.concat([{ t: "Chiudi", f: null, chiudi: true }]).forEach(function (x) {
      var bt = document.createElement("button");
      bt.type = "button"; bt.className = x.chiudi ? "link-btn" : "btn secondario piccolo"; bt.textContent = x.t;
      bt.addEventListener("click", function () { el.hidden = true; if (x.f) x.f(); });
      b.appendChild(bt);
    });
    el.hidden = false;
    clearTimeout(timerStriscia);
    if (ms) timerStriscia = setTimeout(function () { el.hidden = true; }, ms);
  }
  function proponiCopia(testo) {
    if (!haDati()) return;
    ultimoInvito = Date.now();
    striscia(testo, [{ t: "Scarica una copia di sicurezza", f: scarica }], 25000);
  }
  // Ogni dieci minuti di lavoro non ancora copiato, un invito discreto.
  setInterval(function () {
    if (modificato && document.visibilityState === "visible" && Date.now() - ultimoInvito > 600000)
      proponiCopia("Avete lavorato un po\': una copia di sicurezza, nel caso il telefono dimentichi tutto?");
  }, 30000);

  /* ————— disegno e navigazione ————— */

  var DISEGNA = [null, passo1, passo2, passo3, passo4, passo5, passo6];

  function disegna(fuoco) {
    var app = document.getElementById("app");
    var attivo = fuoco || (document.activeElement && document.activeElement.id);
    app.innerHTML = DISEGNA[passo]();
    var ol = document.getElementById("passi");
    ol.innerHTML = PASSI.map(function (p) {
      var cls = p.n === passo ? "attuale" : p.n < passo ? "fatto" : "";
      return '<li><button type="button" class="pallino ' + cls + '" data-azione="vai" data-passo="' + p.n + '"' +
        (p.n === passo ? ' aria-current="step"' : "") + ' aria-label="Passo ' + p.n + ": " + p.titolo + '"><span aria-hidden="true">' + p.n +
        '</span></button><span class="pallino-nome" aria-hidden="true">' + p.corto + "</span></li>";
    }).join("");
    document.getElementById("dove").textContent = "Passo " + passo + " di 6 · " + PASSI[passo - 1].titolo;
    document.getElementById("barra").hidden = false;
    document.getElementById("b-indietro").hidden = passo === 1;
    var av = document.getElementById("b-avanti");
    av.hidden = passo === 6;
    if (passo < 6) { av.textContent = PASSI[passo].corto + " ›"; av.setAttribute("aria-label", "Avanti: " + PASSI[passo].titolo); }
    document.body.classList.toggle("largo", passo === 6);
    var nav = document.querySelector(".avanzamento");
    document.documentElement.style.setProperty("--nav-h", nav.offsetHeight + "px");
    if (attivo) {
      var el = document.getElementById(attivo);
      if (el && app.contains(el)) el.focus({ preventScroll: true });
    }
  }

  function vaiA(n, scorri) {
    var prima = passo;
    passo = Math.max(1, Math.min(6, n));
    S.passo = passo; clearTimeout(timerSalva); timerSalva = setTimeout(salva, 400);
    if (prima === 2 && passo !== 2 && haDati()) proponiCopia("Avete finito i momenti: volete una copia di sicurezza delle risposte?");
    try { history.replaceState(null, "", "#passo-" + passo); } catch (e) { /* file:// o simili */ }
    disegna(null);
    if (scorri !== false) {
      var nav = document.querySelector(".avanzamento");
      window.scrollTo(0, Math.max(0, nav.getBoundingClientRect().top + window.pageYOffset - 8));
      var h = document.getElementById("h-passo");
      if (h) h.focus({ preventScroll: true });
    }
  }

  /* ————— eventi ————— */

  function valoreDa(el) {
    if (el.dataset.tipo === "check") return el.checked;
    if (el.dataset.tipo === "boolean") return el.value === "true";
    return el.value;
  }

  document.addEventListener("input", function (e) {
    var el = e.target;
    if (!el.dataset || !el.dataset.bind || el.type === "radio" || el.type === "checkbox" || el.tagName === "SELECT") return;
    scrivi(el.dataset.bind, valoreDa(el));
    if (el.dataset.bind === "evento.comune") {
      S.evento.coord = null; // un altro comune: il punto trovato prima (o il comune di prima) non vale più
      aggiornaSole();
    }
    if (el.dataset.bind === "evento.data") { aggiornaSole(); aggiornaDataPassata(); }
    if (el.dataset.bind === "evento.indirizzo" && S.evento.coord && S.evento.coord.fonte === "ricerca") {
      S.evento.coord = null; aggiornaSole(); // l'indirizzo è cambiato: il punto trovato prima non vale più
    }
    if (/^(sposi\.nome|evento\.data)/.test(el.dataset.bind)) { var w = document.getElementById("link-wa"); if (w) w.href = linkWhatsApp(); }
    aggiornaSintesi();
    salvaPresto();
  });
  function aggiornaDataPassata() {
    var el = document.getElementById("avviso-data");
    if (el) el.textContent = htmlDataPassata();
  }

  document.addEventListener("change", function (e) {
    var el = e.target;
    if (!el.dataset || !el.dataset.bind) return;
    if (el.type === "radio" || el.type === "checkbox" || el.tagName === "SELECT") {
      scrivi(el.dataset.bind, valoreDa(el));
      salvaPresto();
      if (el.dataset.rifai !== undefined) disegna(el.id);
      else if (el.type === "radio") {
        // senza ridisegnare: si accende solo il bottone scelto
        var fs = el.closest(".scelta-fila");
        if (fs) Array.prototype.forEach.call(fs.querySelectorAll(".scelta-btn"), function (b) { b.classList.toggle("acceso", b.contains(el)); });
      }
    } else if (el.type === "date") {
      scrivi(el.dataset.bind, el.value); aggiornaSole(); aggiornaDataPassata(); salvaPresto();
    } else if (/\.ora$|^evento\.arrivo$/.test(el.dataset.bind)) {
      el.value = oraNorm(el.value); scrivi(el.dataset.bind, el.value); aggiornaSintesi(); salvaPresto();
    } else if (/\.link$/.test(el.dataset.bind)) {
      el.value = linkNorm(el.value); scrivi(el.dataset.bind, el.value); aggiornaSintesi(); salvaPresto();
    }
  });
  // <details> non fa «bubble» dell'evento toggle: lo si ascolta in cattura.
  document.addEventListener("toggle", function (e) {
    var d = e.target;
    if (d && d.dataset && d.dataset.det) dettAperti[d.dataset.det] = d.open;
  }, true);

  // Apre una scheda (e chiude le altre); il fuoco resta sulla sua testata.
  function apriScheda(k) {
    aperto[passo] = aperto[passo] === k ? null : k;
    disegna("acc-" + k + "-t");
    var el = document.getElementById("acc-" + k);
    if (el && aperto[passo] === k) el.scrollIntoView({ block: "start" });
  }
  function prossimaScheda(k) {
    var ids = passo === 3 ? S.playlist.map(function (p) { return p.id; })
      : S.momenti.filter(function (m) { return !m.speciale && m.presente === true; }).map(function (m) { return m.id; });
    var n = ids[ids.indexOf(k) + 1];
    aperto[passo] = n || null;
    disegna(n ? "acc-" + n + "-t" : null);
    var el = document.getElementById(n ? "acc-" + n : "contatore");
    if (el) el.scrollIntoView({ block: "start" });
    if (!n) avviso(passo === 3 ? "Playlist finite. Avanti, agli annunci." : "Momenti finiti. Avanti, alle playlist.");
  }

  document.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest("[data-azione]") : null;
    if (!b) return;
    var az = b.dataset.azione, i = +b.dataset.i, j = +b.dataset.j;
    if (az === "avanti") vaiA(passo + 1);
    else if (az === "indietro") vaiA(passo - 1);
    else if (az === "vai") vaiA(+b.dataset.passo);
    else if (az === "apri") apriScheda(b.dataset.k);
    else if (az === "prossimo") prossimaScheda(b.dataset.k);
    else if (az === "cerca-luogo") cercaLuogo(b);
    else if (az === "aggiungi-brano") {
      S.momenti[i].brani.push(brano()); salvaPresto(); disegna(null);
      var nuovoCampo = document.getElementById(idDa("momenti." + i + ".brani." + (S.momenti[i].brani.length - 1) + ".titolo")) ||
                       document.getElementById(idDa("momenti." + i + ".brani." + (S.momenti[i].brani.length - 1) + ".per"));
      if (nuovoCampo) nuovoCampo.focus();
    }
    else if (az === "togli-brano") { S.momenti[i].brani.splice(j, 1); salvaPresto(); disegna(null); }
    else if (az === "aggiungi-momento") {
      var t = b.dataset.titolo === "Altro momento" ? "" : b.dataset.titolo;
      var m = momento({ id: "extra-" + Date.now().toString(36), titolo: t, personalizzato: true, musica: t === "Musica dal vivo" ? "live" : "brano" });
      m.presente = true;
      S.momenti.push(m); aperto[2] = m.id; salvaPresto(); disegna(null);
      var ultimo = document.getElementById("acc-" + m.id);
      if (ultimo) { ultimo.scrollIntoView({ block: "start" }); var f = ultimo.querySelector("input.txt"); if (f) f.focus({ preventScroll: true }); }
    }
    else if (az === "togli-momento") {
      if (confirm("Togliere il momento «" + (S.momenti[i].titolo || "senza nome") + "»?")) { S.momenti.splice(i, 1); salvaPresto(); disegna(null); }
    }
    else if (az === "aggiungi-annuncio") {
      S.annunci.push({ id: "extra-" + Date.now().toString(36), titolo: "", attivo: true, testo: "", chi: "simone", chiNome: "", quando: "", personalizzato: true });
      salvaPresto(); disegna(null);
      var schede = document.querySelectorAll(".annuncio"), ul = schede[schede.length - 1];
      if (ul) { var f2 = ul.querySelector("input.txt"); if (f2) f2.focus(); }
    }
    else if (az === "togli-annuncio") { S.annunci.splice(i, 1); salvaPresto(); disegna(null); }
    else if (az === "scarica") scarica();
    else if (az === "manda") manda();
    else if (az === "stampa") window.print();
    else if (az === "copia") copia();
    else if (az === "importa") document.getElementById("file-importa").click();
    else if (az === "ricomincia") {
      if (confirm("Cancellare tutte le risposte da questo dispositivo? Se non avete scaricato il file, non si recuperano.")) {
        try { localStorage.setItem(CHIAVE + "-prima", JSON.stringify(S)); } catch (er) { /* niente */ }
        S = nuovo();
        try { localStorage.removeItem(CHIAVE); } catch (er) { /* niente */ }
        vaiA(1);
        avviso("Modulo vuoto.");
      }
    }
  });

  document.getElementById("file-importa").addEventListener("change", function () {
    if (this.files && this.files[0]) importa(this.files[0]);
    this.value = "";
  });

  window.addEventListener("hashchange", function () {
    var m = /passo-(\d)/.exec(location.hash);
    if (m && +m[1] !== passo) vaiA(+m[1]);
  });
  // Stampa da qualunque passo: si stampa il riepilogo, aggiornato.
  window.addEventListener("beforeprint", function () { if (passo !== 6) { passo = 6; disegna(null); } });

  // Chiusura, cambio di app, schermo spento: il salvataggio non aspetta i 400 ms.
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") salva(); });
  window.addEventListener("pagehide", salva);
  window.addEventListener("beforeunload", salva);

  /* ————— partenza ————— */

  var ripreso = carica();
  var h0 = /passo-(\d)/.exec(location.hash);
  passo = h0 ? Math.max(1, Math.min(6, +h0[1])) : (ripreso ? Math.max(1, Math.min(6, +S.passo || 1)) : 1);
  disegna(null);
  var st = document.getElementById("salvataggio");
  try {
    localStorage.setItem(CHIAVE + "-prova", "1"); localStorage.removeItem(CHIAVE + "-prova");
    st.textContent = ripreso ? "Bentornati: ho ripreso le risposte salvate su questo dispositivo." : "Le risposte si salvano da sole su questo dispositivo.";
  } catch (e) {
    salvabile = false;
    st.className = "salvataggio attenzione";
    st.textContent = "Questo browser non tiene le risposte: prima di chiuderlo, scaricate il file al passo 6.";
  }

  // Per le prove automatiche: lo stato senza passare dallo schermo.
  window.__modulo = { stato: function () { return S; }, righe: righe, sole: sole, testo: testoSemplice, dati: datiDaEsportare };
})();
