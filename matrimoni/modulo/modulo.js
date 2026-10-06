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
      formato: FORMATO, versione: VERSIONE,
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
  function ripara(dati) {
    var s = unisci(nuovo(), dati);
    s.formato = FORMATO; s.versione = VERSIONE;
    s.momenti = (s.momenti || []).map(function (m) {
      var b = unisci(momento({ id: m.id || "m", titolo: m.titolo || "" }), m);
      if (!Array.isArray(b.brani) || !b.brani.length) b.brani = [brano()];
      b.brani = b.brani.map(function (x) { return unisci(brano(), x); });
      return b;
    });
    return s;
  }

  /* ————— salvataggio nel browser ————— */

  var timerSalva = null;
  function salvaPresto() {
    clearTimeout(timerSalva);
    timerSalva = setTimeout(salva, 400);
  }
  function salva() {
    var el = document.getElementById("salvataggio");
    try {
      S.salvato = new Date().toISOString();
      localStorage.setItem(CHIAVE, JSON.stringify(S));
      salvabile = true;
      el.className = "salvataggio";
      el.textContent = "Salvato su questo dispositivo alle " + oraAdesso() + ".";
    } catch (e) {
      salvabile = false;
      el.className = "salvataggio attenzione";
      el.textContent = "Questo browser non tiene le risposte: prima di chiuderlo, scaricate il file al passo 6.";
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
  // «1.20», «1:20», «80» (secondi) → «1:20».
  function puntoDa(t) {
    t = String(t || "").trim();
    if (!t) return "";
    var m = /^(\d{1,2})\s*[:.,']\s*(\d{1,2})$/.exec(t);
    if (m) return +m[1] + ":" + ("0" + m[2]).slice(-2);
    if (/^\d+$/.test(t)) { var s = +t; return Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2); }
    return t;
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
      (o.facoltativo ? ' <span class="opz">facoltativo</span>' : "") + "</label>" + aiuto + ctrl + "</div>";
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
      '<p class="intro">Le risposte restano <b>su questo telefono</b> (o computer) finché non me le mandate voi, all\'ultimo passo.</p>' +
      '<p class="intro importa-riga">Avete già un file del modulo? <button type="button" class="link-btn" data-azione="importa">Caricatelo qui</button></p>' +
      '<div class="scheda">' +
        '<fieldset class="gruppo"><legend class="lbl">I vostri nomi</legend><div class="due">' +
          campo("sposi.nome1", "Nome", { placeholder: "es. Anna", autocomplete: "given-name", classe: "senza-sopra" }) +
          campo("sposi.nome2", "Nome", { placeholder: "es. Marco", autocomplete: "off", classe: "senza-sopra" }) +
        "</div></fieldset>" +
        campo("sposi.telefono", "Un telefono per sentirci", { tipo: "tel", inputmode: "tel", autocomplete: "tel", placeholder: "es. 345 123 4567" }) +
        campo("evento.data", "Data del matrimonio", { tipo: "date" }) +
        campo("evento.invitati", "Quanti invitati, più o meno", { inputmode: "numeric", placeholder: "es. 120", facoltativo: true }) +
      "</div>" +
      '<h3 class="sotto">Dove</h3><div class="scheda">' +
        campo("evento.location", "Nome della location", { placeholder: "es. Villa …, Agriturismo …" }) +
        campo("evento.indirizzo", "Indirizzo della location", { placeholder: "via e numero", autocomplete: "off" }) +
        campo("evento.comune", "Comune", { list: "elenco-comuni", placeholder: "es. Bassano del Grappa",
          aiuto: "Serve per l'ora del tramonto. I comuni dell'elenco si riconoscono subito, anche senza rete." }) +
        '<datalist id="elenco-comuni">' + (window.Luoghi ? Luoghi.elenco.map(function (l) { return '<option value="' + esc(l[0]) + '">'; }).join("") : "") + "</datalist>" +
        '<div class="sole" id="sole" aria-live="polite">' + htmlSole() + "</div>" +
        '<div class="cerca"><button type="button" class="btn secondario piccolo" data-azione="cerca-luogo">Calcola dal luogo</button>' +
        '<span class="aiuto" id="esito-luogo">Cerca l\'indirizzo su OpenStreetMap: solo se lo toccate, e manda solo l\'indirizzo.</span></div>' +
        campo("evento.arrivo", "A che ora arrivano gli invitati alla location", { placeholder: "es. 12:30", facoltativo: true }) +
      "</div>" +
      '<h3 class="sotto">Chi mi dà il via, quel giorno</h3>' +
      '<p class="intro">Voi sarete occupati. Mi serve una persona che sappia il programma e risponda al telefono: un testimone, la wedding planner, il referente della location.</p>' +
      '<div class="scheda">' +
        campo("evento.referente.nome", "Nome", { placeholder: "es. Giulia" }) +
        campo("evento.referente.ruolo", "Chi è", { placeholder: "es. testimone, wedding planner" }) +
        campo("evento.referente.telefono", "Telefono", { tipo: "tel", inputmode: "tel", placeholder: "es. 333 765 4321" }) +
      "</div></section>";
  }

  /* ————— passo 2: i momenti ————— */

  function opzioniPlaylist() {
    return [{ v: "", t: "Scegliete la playlist…" }].concat(S.playlist.map(function (p) { return { v: p.id, t: p.nome }; }));
  }

  function cartaMomento(m, i) {
    var base = "momenti." + i;
    var modello = MOMENTI.filter(function (x) { return x.id === m.id; })[0] || {};
    var titoloId = "m-" + i + "-titolo";

    if (m.speciale === "video") {
      return '<article class="momento video-rimando" aria-labelledby="' + titoloId + '">' +
        '<h3 class="momento-titolo" id="' + titoloId + '"><span class="num">' + (i + 1) + "</span>" + esc(m.titolo) + "</h3>" +
        '<p class="aiuto">Del video parliamo al passo 5: chi porta il file, quanto dura, quando parte.</p>' +
        '<button type="button" class="btn secondario piccolo" data-azione="vai" data-passo="5">Vai al video ›</button></article>';
    }

    var stato = m.presente === true ? " c-e" : m.presente === false ? " non-c-e" : "";
    var h = '<article class="momento' + stato + '" aria-labelledby="' + titoloId + '">' +
      '<h3 class="momento-titolo" id="' + titoloId + '"><span class="num">' + (i + 1) + "</span>" + esc(m.titolo || "Momento senza nome") + "</h3>" +
      (modello.aiuto && m.presente !== false ? '<p class="aiuto">' + modello.aiuto + "</p>" : "") +
      scelta(base + ".presente", "Ci sarà questo momento? — " + esc(m.titolo), [{ v: true, t: "Ci sarà" }, { v: false, t: "Non ci sarà" }], { nascosta: true, classe: "presenza" });

    if (m.presente === true) {
      if (m.personalizzato) h += campo(base + ".titolo", "Come lo chiamate", { placeholder: "es. Musica dal vivo" });
      h += '<div class="due">' +
        campo(base + ".ora", "A che ora, circa", { placeholder: "13:30 · a seguire" }) +
        campo(base + ".dove", "Dove", { placeholder: modello.dove ? "es. " + modello.dove : "es. giardino, sala" }) +
        "</div>" +
        campo(base + ".segnale", "Quando parte: il segnale", { placeholder: "es. " + (modello.segnale || "quando la sposa entra dal cancello"),
          aiuto: "Chi fa cosa: è il momento in cui premo «play»." }) +
        scelta(base + ".musica", "Che musica", MUSICHE, { classe: "musica" });

      if (m.musica === "brano") {
        h += '<div class="brani">' + m.brani.map(function (b, j) { return cartaBrano(m, i, j); }).join("") + "</div>" +
          '<button type="button" class="btn secondario piccolo" data-azione="aggiungi-brano" data-i="' + i + '">＋ Aggiungi un altro brano</button>';
      } else if (m.musica === "playlist") {
        h += menu(base + ".playlist", "Quale playlist", opzioniPlaylist()) +
          '<p class="aiuto">Il link della playlist lo mettete al passo 3.</p>';
      } else if (m.musica === "live") {
        h += campo(base + ".live", "Chi suona, e con cosa", { area: true, righe: 2, placeholder: "es. trio: chitarra classica e voce, hanno il loro mixer" ,
          aiuto: "Microfoni, prese e collegamenti li vedo io con i musicisti." });
      }

      h += menu(base + ".poi", "Poi cosa succede", POI, { rifai: true });
      if (m.poi === "playlist") h += menu(base + ".poiPlaylist", "Quale playlist torna", opzioniPlaylist());
      if (m.poi === "altro") h += campo(base + ".poiAltro", "Cosa succede dopo", { placeholder: "es. parlano i testimoni, poi la torta" });
      h += campo(base + ".note", "Note", { area: true, righe: 2, facoltativo: true, placeholder: "es. volume basso, il papà è emozionato…" });
    }
    if (m.personalizzato) h += '<p class="togli"><button type="button" class="link-btn" data-azione="togli-momento" data-i="' + i + '">Togli questo momento</button></p>';
    return h + "</article>";
  }

  function cartaBrano(m, i, j) {
    var b = "momenti." + i + ".brani." + j, conPer = m.brani.length > 1 || m.id === "genitori" || m.id === "speciali" || m.personalizzato;
    return '<fieldset class="brano"><legend class="lbl">' + (m.brani.length > 1 ? "Brano " + (j + 1) : "La canzone") + "</legend>" +
      (conPer ? campo(b + ".per", "Per chi o per cosa", { placeholder: m.id === "genitori" ? "es. ballo con il papà" : "es. dedica agli amici", facoltativo: true }) : "") +
      campo(b + ".titolo", "Titolo", { placeholder: "es. Titolo della canzone" }) +
      campo(b + ".artista", "Artista", { placeholder: "es. Nome dell'artista" }) +
      '<div class="due">' +
        campo(b + ".versione", "Versione", { list: "elenco-versioni", placeholder: "originale", facoltativo: true }) +
        campo(b + ".da", "Da che punto", { inputmode: "decimal", placeholder: "es. 0.45", facoltativo: true }) +
      "</div>" +
      campo(b + ".link", "Link della canzone", { tipo: "url", inputmode: "url", placeholder: "incollate il link (Spotify, YouTube…)",
        aiuto: "Dal telefono: «Condividi» sulla canzone → «Copia link», poi incollatelo qui." }) +
      (m.brani.length > 1 ? '<p class="togli"><button type="button" class="link-btn" data-azione="togli-brano" data-i="' + i + '" data-j="' + j + '">Togli questo brano</button></p>' : "") +
      "</fieldset>";
  }

  function passo2() {
    return '<section class="passo" aria-labelledby="h-passo">' +
      '<h2 id="h-passo" tabindex="-1">2 · I momenti</h2>' +
      '<p class="intro">Per ogni momento: <b>ci sarà o no</b>, e se c\'è, che musica e quando parte. ' +
      'Quello che non sapete ancora lasciatelo vuoto: ne parliamo.</p>' +
      '<datalist id="elenco-versioni"><option value="originale"><option value="live"><option value="acustica"><option value="strumentale"><option value="remix"><option value="versione corta"></datalist>' +
      S.momenti.map(cartaMomento).join("") +
      '<div class="aggiungi-momento"><h3 class="sotto">Un altro momento?</h3><div class="chips">' +
      ALTRI_MOMENTI.map(function (t) { return '<button type="button" class="chip" data-azione="aggiungi-momento" data-titolo="' + esc(t) + '">＋ ' + esc(t) + "</button>"; }).join("") +
      "</div></div></section>";
  }

  /* ————— passo 3: le playlist ————— */

  function passo3() {
    return '<section class="passo" aria-labelledby="h-passo">' +
      '<h2 id="h-passo" tabindex="-1">3 · Le playlist</h2>' +
      '<p class="intro">Fra un momento e l\'altro suonano le vostre playlist. Incollate il link di quelle che avete; ' +
      'quelle che non vi servono lasciatele vuote.</p>' +
      S.playlist.map(function (p, i) {
        var mod = PLAYLIST.filter(function (x) { return x.id === p.id; })[0] || {};
        var b = "playlist." + i;
        return '<fieldset class="scheda playlist"><legend class="lbl grande">' + esc(p.nome) + "</legend>" +
          (mod.es ? '<p class="aiuto">' + esc(mod.es) + "</p>" : "") +
          campo(b + ".titolo", "Come si chiama la playlist", { placeholder: "es. Buffet matrimonio", facoltativo: true }) +
          campo(b + ".link", "Link della playlist", { tipo: "url", inputmode: "url", placeholder: "incollate il link (Spotify, YouTube…)" }) +
          campo(b + ".note", "Note", { area: true, righe: 2, facoltativo: true, placeholder: "es. solo strumentale fino alle 14" }) +
          "</fieldset>";
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
        (p.link ? ' — <a href="' + esc(p.link) + '" target="_blank" rel="noopener">' + esc(corto(p.link)) + "</a>" : " — <i>link mancante</i>") +
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
        if (b.link) linkBrani.push("<li>" + esc(m.titolo) + ": " + (b.titolo ? "«" + esc(b.titolo) + "» " : "") +
          '<a href="' + esc(b.link) + '" target="_blank" rel="noopener">' + esc(corto(b.link)) + "</a></li>");
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
      (mm.length ? '<div class="manca"><p><b>Manca ancora</b> (si può mandare lo stesso):</p><ul>' + mm.map(function (x) {
        return '<li><button type="button" class="link-btn" data-azione="vai" data-passo="' + x[0] + '">' + esc(x[1]) + "</button></li>";
      }).join("") + "</ul></div>" : '<p class="tutto-ok">Tutto compilato.</p>') +
      '<div class="invio scheda">' +
        '<h3 class="sotto senza-sopra">Mandatelo a Simone</h3>' +
        '<ol class="passi-invio">' +
          '<li><span>Mandate il file: dal telefono si apre la condivisione, scegliete WhatsApp (o la mail) e me.</span>' +
            '<button type="button" class="btn primario" data-azione="manda">Manda il file a Simone</button></li>' +
          '<li><span>Oppure scaricatelo e scrivetemi: vi apro la chat con un messaggio già pronto, il file lo allegate voi.</span>' +
            '<div class="fila-btn"><button type="button" class="btn secondario" data-azione="scarica">Scarica il file</button>' +
            '<a class="btn secondario" id="link-wa" href="' + linkWhatsApp() + '" target="_blank" rel="noopener">Apri WhatsApp</a></div></li>' +
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
    d.esportato = new Date().toISOString();
    var s = sole();
    d.calcolati = s ? { tramonto: s.tramonto, luceDa: s.luceDa, luceA: s.luceA, buio: s.buio, lat: s.lat, lon: s.lon, dove: s.dove } : null;
    return d;
  }
  function nomeFile(est) {
    var n = (nomi() || "sposi").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return "piano-musicale_" + (S.evento.data || "senza-data") + "_" + n + "." + (est || "json");
  }
  function scarica() {
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
    if (!file || !navigator.share) {
      scarica();
      avviso("File scaricato. Ora toccate «Apri WhatsApp» e allegatelo nella chat.");
      return;
    }
    navigator.share({ files: [file], title: "Piano musicale", text: messaggioWhatsApp() })
      .catch(function (e) { if (!e || e.name !== "AbortError") { scarica(); } });
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
    if (pl.length) { t.push("", "PLAYLIST"); pl.forEach(function (p) { t.push("- " + p.nome + (p.titolo ? " «" + p.titolo + "»" : "") + (p.link ? ": " + p.link : "")); }); }
    S.momenti.forEach(function (m) {
      if (m.presente === true && m.musica === "brano") m.brani.forEach(function (b) { if (b.link) t.push("- " + m.titolo + (b.titolo ? " «" + b.titolo + "»" : "") + ": " + b.link); });
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
      delete dati.calcolati; delete dati.esportato;
      S = ripara(dati);
      salva(); vaiA(1, true);
      avviso("Modulo caricato.");
    };
    r.readAsText(file);
  }
  function haDati() {
    return !!(nomi() || S.evento.data || S.evento.location || S.momenti.some(function (m) { return m.presente !== null; }));
  }

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
    if (attivo) {
      var el = document.getElementById(attivo);
      if (el && app.contains(el)) el.focus({ preventScroll: true });
    }
  }

  function vaiA(n, scorri) {
    passo = Math.max(1, Math.min(6, n));
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
      var l = window.Luoghi && Luoghi.trova(el.value);
      if (l) S.evento.coord = null; // il comune scelto adesso vince sulla ricerca di prima
      aggiornaSole();
    }
    if (el.dataset.bind === "evento.data") aggiornaSole();
    if (el.dataset.bind === "evento.indirizzo" && S.evento.coord && S.evento.coord.fonte === "ricerca") {
      S.evento.coord = null; aggiornaSole(); // l'indirizzo è cambiato: il punto trovato prima non vale più
    }
    if (/^(sposi\.nome|evento\.data)/.test(el.dataset.bind)) { var w = document.getElementById("link-wa"); if (w) w.href = linkWhatsApp(); }
    salvaPresto();
  });

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
      scrivi(el.dataset.bind, el.value); aggiornaSole(); salvaPresto();
    }
  });

  document.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest("[data-azione]") : null;
    if (!b) return;
    var az = b.dataset.azione, i = +b.dataset.i, j = +b.dataset.j;
    if (az === "avanti") vaiA(passo + 1);
    else if (az === "indietro") vaiA(passo - 1);
    else if (az === "vai") vaiA(+b.dataset.passo);
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
      S.momenti.push(m); salvaPresto(); disegna(null);
      var art = document.querySelectorAll(".momento");
      var ultimo = art[art.length - 1];
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

  /* ————— partenza ————— */

  var ripreso = carica();
  var h0 = /passo-(\d)/.exec(location.hash);
  passo = h0 ? Math.max(1, Math.min(6, +h0[1])) : 1;
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
