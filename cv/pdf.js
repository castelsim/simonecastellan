/* ══════════════════════════════════════════════════════════════════════════
   IL CURRICULUM IN PDF — due versioni dalla stessa fonte

   I dati stanno tutti in `dati.js`: qui c'è solo l'impaginazione. Un fatto si
   corregge lì e cambia in tutti e due i documenti, che quindi non possono
   divergere — ed è l'unico modo per non ritrovarsi, fra sei mesi, due CV che
   dicono cose diverse.

   ── LE DUE VERSIONI, E PERCHÉ SONO DUE ───────────────────────────────────
   `pubblico`  — quello che si scarica dal sito. Nome, qualifica, città, email,
                 sito. Niente indirizzo, telefono, data di nascita, codice
                 fiscale, partita IVA.
   `completo`  — per i bandi. Aggiunge tutto quello che una domanda richiede,
                 più la dichiarazione ex DPR 445/2000 e lo spazio per la firma.

   Non è prudenza astratta: il CV di chi vince un concorso finisce in
   Amministrazione trasparente, e il Garante ha già sanzionato una pubblica
   amministrazione per averne pubblicato uno con dentro indirizzo, cellulare e
   firma autografa (provv. 9682169). Il completo lo si allega dove serve,
   sapendo che lo si sta facendo.

   ── FORMATO ──────────────────────────────────────────────────────────────
   Europass come è oggi, non il modello a due colonne del 2002: quello è
   dismesso da oltre dieci anni, e la norma che imponeva il «formato europeo»
   (D.lgs 33/2013 art. 10) è stata soppressa nel 2016. Sezioni standard,
   intestazioni chiare, ordine adattabile al bando.
   ══════════════════════════════════════════════════════════════════════════ */

var CVPDF = (function () {
  'use strict';

  /* ── La libreria arriva quando serve ────────────────────────────────────
     366 KB che non hanno motivo di pesare su chi apre la pagina per leggere.
     Se la rete cade a metà, la promessa si azzera: senza, il prossimo clic
     troverebbe una promessa già fallita e lo strumento resterebbe rotto fino
     al ricaricamento. */
  var libreria = null;

  function preparaLibreria() {
    if (libreria) return libreria;
    libreria = new Promise(function (ok, no) {
      if (window.jspdf && window.jspdf.jsPDF) return ok();
      var s = document.createElement('script');
      s.src = 'vendor/jspdf.umd.min.js';
      s.onload = ok;
      s.onerror = function () { no(new Error('jspdf')); };
      document.head.appendChild(s);
    }).then(function () {
      if (!(window.jspdf && window.jspdf.jsPDF)) throw new Error('libreria caricata ma non disponibile');
    }).catch(function (e) {
      libreria = null;
      throw e;
    });
    return libreria;
  }

  /* ── Misure del foglio ─────────────────────────────────────────────────
     A4 in millimetri. I margini sono quelli di un documento che verrà
     stampato e magari pinzato: 20 a sinistra, 18 a destra. */
  var W = 210, H = 297;
  var ML = 20, MR = 18, MT = 18, MB = 20;
  var LARG = W - ML - MR;

  var NERO = [26, 26, 26];
  var GRIGIO = [90, 96, 100];
  var LINEA = [200, 205, 208];

  /* Lo stato dell'impaginazione: dove siamo sul foglio, e su quale foglio. */
  function nuovoStato(doc) {
    return { doc: doc, y: MT, pagina: 1 };
  }

  /* Chiede spazio. Se non ce n'è abbastanza, cambia pagina — così una voce
     non si spezza a metà e un'intestazione non resta sola in fondo al foglio. */
  function spazio(st, mm) {
    if (st.y + mm > H - MB) {
      st.doc.addPage();
      st.pagina++;
      st.y = MT;
      return true;
    }
    return false;
  }

  function testo(st, str, opt) {
    opt = opt || {};
    var doc = st.doc;
    var corpo = opt.corpo || 9.5;
    var stile = opt.stile || 'normal';
    var colore = opt.colore || NERO;
    var x = ML + (opt.rientro || 0);
    var larg = LARG - (opt.rientro || 0);

    doc.setFont('helvetica', stile);
    doc.setFontSize(corpo);
    doc.setTextColor(colore[0], colore[1], colore[2]);

    var righe = doc.splitTextToSize(str, larg);
    var altezzaRiga = corpo * 0.42;
    spazio(st, righe.length * altezzaRiga);
    doc.text(righe, x, st.y + altezzaRiga * 0.75);
    st.y += righe.length * altezzaRiga + (opt.dopo === undefined ? 1 : opt.dopo);
    return righe.length;
  }

  /* Titolo di sezione: maiuscoletto spaziato e una riga sotto. Chiede in
     anticipo lo spazio per sé PIÙ una voce, altrimenti resterebbe da solo in
     fondo alla pagina con il contenuto girato a quella dopo. */
  function sezione(st, titolo) {
    spazio(st, 22);
    st.y += 3;
    var doc = st.doc;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(NERO[0], NERO[1], NERO[2]);
    doc.text(titolo.toUpperCase(), ML, st.y + 3.5);
    st.y += 5.5;
    doc.setDrawColor(LINEA[0], LINEA[1], LINEA[2]);
    doc.setLineWidth(0.3);
    doc.line(ML, st.y, W - MR, st.y);
    st.y += 4;
  }

  /* ── Intestazione ───────────────────────────────────────────────────── */
  function intestazione(st, completo) {
    var a = CV.anagrafica, doc = st.doc;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(NERO[0], NERO[1], NERO[2]);
    doc.text(a.nome + ' ' + a.cognome, ML, st.y + 7);
    st.y += 11;

    testo(st, CV.qualifica, { corpo: 10, colore: GRIGIO, dopo: 2.5 });

    /* I contatti: due righe di dati separati da punti. Cosa entra dipende
       dalla versione — è l'unica differenza sostanziale fra i due documenti. */
    var riga1 = [];
    if (completo) {
      riga1.push(a.indirizzo + ', ' + a.cap + ' ' + a.citta);
      riga1.push(a.telefono);
    } else {
      riga1.push(a.citta + ', ' + a.paese);
    }
    riga1.push(a.email);
    riga1.push(a.sito);
    testo(st, riga1.join('  ·  '), { corpo: 8.5, colore: GRIGIO, dopo: 1 });

    if (completo) {
      var riga2 = [
        'Nato il ' + a.natoIl + ' a ' + a.natoA,
        'Cittadinanza ' + a.cittadinanza.toLowerCase(),
        'C.F. ' + a.codiceFiscale,
        'P. IVA ' + a.partitaIva,
        'Patenti ' + a.patenti
      ];
      testo(st, riga2.join('  ·  '), { corpo: 8.5, colore: GRIGIO, dopo: 1 });
      testo(st, 'PEC ' + a.pec, { corpo: 8.5, colore: GRIGIO, dopo: 1 });
    }
    st.y += 2;
  }

  /* ── Esperienza ─────────────────────────────────────────────────────── */
  function periodo(v) {
    if (v.inCorso) return v.dal + ' – in corso';
    if (v.al && v.al !== v.dal) return v.dal + ' – ' + v.al;
    return v.dal;
  }

  function esperienza(st) {
    sezione(st, 'Esperienza professionale');
    CV.esperienza.forEach(function (v, i) {
      /* Ogni voce chiede in blocco lo spazio per la sua testa: data, ruolo e
         datore non si separano mai. */
      spazio(st, 16);
      if (i) st.y += 2;
      testo(st, periodo(v), { corpo: 8.5, colore: GRIGIO, dopo: 0.5 });
      testo(st, v.ruolo, { corpo: 10, stile: 'bold', dopo: 0.5 });
      testo(st, v.datore + ' — ' + v.luogo + (v.tipo ? '  ·  ' + v.tipo : ''),
            { corpo: 9, colore: GRIGIO, dopo: 1.5 });
      (v.attivita || []).forEach(function (r) {
        testo(st, '•  ' + r, { corpo: 9, rientro: 3, dopo: 0.8 });
      });
      if (v.credito) {
        testo(st, 'Credito stampato: «' + v.credito + '»',
              { corpo: 8.5, colore: GRIGIO, rientro: 3, dopo: 1 });
      }
    });
  }

  /* ── Istruzione ─────────────────────────────────────────────────────── */
  function istruzione(st) {
    sezione(st, 'Istruzione e formazione');
    CV.istruzione.forEach(function (v, i) {
      spazio(st, 14);
      if (i) st.y += 1.5;
      testo(st, v.data, { corpo: 8.5, colore: GRIGIO, dopo: 0.5 });
      testo(st, v.titolo, { corpo: 9.5, stile: 'bold', dopo: 0.5 });
      var sotto = v.ente + (v.luogo ? ' — ' + v.luogo : '');
      if (v.voto) sotto += '  ·  Votazione: ' + v.voto;
      if (v.livelloEqf) sotto += '  ·  Livello QEQ ' + v.livelloEqf;
      testo(st, sotto, { corpo: 9, colore: GRIGIO, dopo: 1 });
    });

    if (CV.formazione && CV.formazione.length) {
      st.y += 2;
      testo(st, 'Corsi e masterclass con attestato', { corpo: 9.5, stile: 'bold', dopo: 1.5 });
      CV.formazione.forEach(function (c) {
        testo(st, '•  ' + c.data + ' — ' + c.titolo + '. ' + c.ente,
              { corpo: 9, rientro: 3, dopo: 0.8 });
      });
    }
  }

  /* ── Lingue ──────────────────────────────────────────────────────────────
     La griglia del Quadro comune europeo di riferimento, con le cinque
     abilità separate e le etichette esatte. La madrelingua è un'entità a
     sé e NON prende un livello: scrivere «Italiano — C2» è scorretto,
     perché la scala QCER descrive chi una lingua la impara. */
  function lingue(st) {
    sezione(st, 'Competenze linguistiche');
    testo(st, 'Lingua madre: ' + CV.lingue.madrelingua, { corpo: 9.5, dopo: 2.5 });

    var doc = st.doc;
    var col = [46, 24, 24, 26, 26, 26];   // mm: lingua + cinque abilità
    var x0 = ML;

    spazio(st, 10 + CV.lingue.altre.length * 6);

    /* Intestazione a due piani, com'è nella scheda ufficiale: sopra i tre
       raggruppamenti, sotto le cinque abilità vere. */
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(GRIGIO[0], GRIGIO[1], GRIGIO[2]);
    doc.text('COMPRENSIONE', x0 + col[0], st.y + 3);
    doc.text('PARLATO', x0 + col[0] + col[1] + col[2], st.y + 3);
    doc.text('SCRITTO', x0 + col[0] + col[1] + col[2] + col[3] + col[4], st.y + 3);
    st.y += 5;

    var etichette = ['Lingua', 'Ascolto', 'Lettura', 'Interazione', 'Produzione orale', 'Scritto'];
    doc.setFontSize(7.5);
    var x = x0;
    etichette.forEach(function (e, i) {
      doc.text(e, x, st.y + 3);
      x += col[i];
    });
    st.y += 4.5;
    doc.setDrawColor(LINEA[0], LINEA[1], LINEA[2]);
    doc.line(ML, st.y, W - MR, st.y);
    st.y += 3.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(NERO[0], NERO[1], NERO[2]);
    CV.lingue.altre.forEach(function (l) {
      var celle = [l.lingua, l.ascolto, l.lettura, l.interazione, l.produzione, l.scritto];
      var xx = x0;
      celle.forEach(function (c, i) {
        doc.text(String(c), xx, st.y + 3);
        xx += col[i];
      });
      st.y += 5.5;
    });

    st.y += 1;
    testo(st, 'Livelli: A1/A2 utente base · B1/B2 utente autonomo · C1/C2 utente avanzato. ' +
              'Quadro comune europeo di riferimento per la conoscenza delle lingue. Livelli autovalutati.',
          { corpo: 7.5, colore: GRIGIO, dopo: 1 });
  }

  /* ── Competenze ──────────────────────────────────────────────────────────
     Elenco per ambito, non griglia di autovalutazione: quella con i livelli
     «base/intermedio/avanzato» è stata dismessa da Europass. */
  function competenze(st) {
    sezione(st, 'Competenze professionali');
    CV.competenze.tecniche.forEach(function (c) {
      testo(st, c.voce + ' — ' + c.dettaglio, { corpo: 9, dopo: 1.2 });
    });
    st.y += 1.5;
    testo(st, 'Software: ' + CV.competenze.software, { corpo: 9, dopo: 1 });
    testo(st, 'Attrezzatura: ' + CV.competenze.hardware, { corpo: 9, dopo: 2 });

    testo(st, 'Competenze digitali', { corpo: 9.5, stile: 'bold', dopo: 1.5 });
    CV.competenze.digitali.forEach(function (d) {
      testo(st, '•  ' + d, { corpo: 9, rientro: 3, dopo: 0.8 });
    });
    st.y += 1.5;
    testo(st, 'Competenze organizzative', { corpo: 9.5, stile: 'bold', dopo: 1.5 });
    CV.competenze.organizzative.forEach(function (d) {
      testo(st, '•  ' + d, { corpo: 9, rientro: 3, dopo: 0.8 });
    });
  }

  function idoneita(st) {
    if (!CV.idoneita || !CV.idoneita.length) return;
    sezione(st, 'Idoneità da procedura pubblica');
    CV.idoneita.forEach(function (v) {
      testo(st, v.testo, { corpo: 9, dopo: 0.6 });
      testo(st, v.fonte, { corpo: 8, colore: GRIGIO, dopo: 1.6 });
    });
  }

  function premi(st) {
    sezione(st, 'Premi e riconoscimenti');
    /* L'ordine lo decide l'anno, non la posizione nell'elenco: una voce
       aggiunta in fondo a `dati.js` finiva in fondo alla pagina anche se era
       del 2022, in mezzo a premi del 2017. Ordinando qui, chi aggiunge un
       premio non deve ricordarsi dove infilarlo. */
    CV.premi.slice().sort(function (a, b) {
      return Number(b.anno) - Number(a.anno);
    }).forEach(function (p) {
      testo(st, p.anno + ' — ' + p.testo, { corpo: 9, dopo: 1.2 });
    });
  }

  function produzioni(st) {
    sezione(st, 'Produzioni discografiche e audiovisive (selezione)');
    CV.produzioni.forEach(function (p) {
      spazio(st, 11);
      testo(st, p.anno + ' — ' + p.titolo, { corpo: 9.5, stile: 'bold', dopo: 0.4 });
      testo(st, p.contesto, { corpo: 8.5, colore: GRIGIO, dopo: 0.4 });
      testo(st, p.ruolo + (p.codice ? '  ·  ' + p.codice : ''), { corpo: 8.5, dopo: 1.4 });
    });
    if (CV.siae) {
      st.y += 1;
      testo(st, 'SIAE, posizione ' + CV.siae.posizione + ': ' + CV.siae.opere +
                ' opere depositate, tutte in stato regolare. ' + CV.siae.nota,
            { corpo: 8.5, colore: GRIGIO, dopo: 1 });
    }
  }

  /* ── La coda italiana, solo nel documento per i bandi ────────────────────
     Non fa parte di Europass — nell'applicazione europea non esiste nemmeno
     un campo per la firma — ma è quello che le domande italiane chiedono.

     Sul trattamento dei dati: la formula che si copia in giro cita l'art. 13
     del D.lgs 196/2003, che è ABROGATO. E per i curriculum l'art. 111-bis
     stabilisce che il consenso non è dovuto. Quindi non si «autorizza» un
     bel niente: si prende atto. */
  function coda(st) {
    sezione(st, 'Dichiarazioni');

    testo(st, 'Il sottoscritto Simone Castellan, consapevole delle sanzioni penali previste ' +
              'dall’art. 76 del D.P.R. 28 dicembre 2000 n. 445 in caso di dichiarazioni mendaci, ' +
              'e della decadenza dai benefici prevista dall’art. 75 del medesimo decreto, ' +
              'dichiara ai sensi degli artt. 46 e 47 del D.P.R. 445/2000 che quanto riportato ' +
              'nel presente curriculum corrisponde al vero.',
          { corpo: 8.5, dopo: 2.5 });

    testo(st, 'Trattamento dei dati personali: i dati contenuti in questo curriculum sono trattati ' +
              'per le sole finalità di selezione, ai sensi del Regolamento (UE) 2016/679. ' +
              'Per i dati contenuti nei curriculum il consenso non è dovuto, a norma dell’art. 111-bis ' +
              'del D.lgs. 196/2003.',
          { corpo: 8.5, colore: GRIGIO, dopo: 5 });

    spazio(st, 24);
    var doc = st.doc;
    doc.setFontSize(8.5);
    doc.setTextColor(GRIGIO[0], GRIGIO[1], GRIGIO[2]);
    doc.text('Cassola (VI), ' + oggi(), ML, st.y + 3);
    doc.text('Firma', W - MR - 45, st.y + 3);
    doc.setDrawColor(LINEA[0], LINEA[1], LINEA[2]);
    doc.line(W - MR - 45, st.y + 14, W - MR, st.y + 14);
    st.y += 18;

    testo(st, 'Documento predisposto per la firma digitale in formato PAdES. ' +
              'La firma autografa non è necessaria se il file è firmato digitalmente.',
          { corpo: 7.5, colore: GRIGIO, dopo: 0 });
  }

  function oggi() {
    var d = new Date();
    return String(d.getDate()).padStart(2, '0') + '/' +
           String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
  }

  /* Numero di pagina e nome su ogni foglio: un CV si sfascicola, e una pagina
     senza nome non si sa più di chi è. Si scrive alla fine, quando il numero
     totale delle pagine è noto. */
  function piedi(doc) {
    var n = doc.internal.getNumberOfPages();
    for (var i = 1; i <= n; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(GRIGIO[0], GRIGIO[1], GRIGIO[2]);
      doc.text('Simone Castellan — Curriculum vitae', ML, H - 10);
      doc.text('Pagina ' + i + ' di ' + n, W - MR, H - 10, { align: 'right' });
    }
  }

  /* ── L'unica funzione pubblica ──────────────────────────────────────── */
  /* `opzioni.salva === false` restituisce il documento invece di scaricarlo.
     Serve alle prove: senza, l'unico modo di controllare cosa c'è dentro un
     PDF sarebbe scaricarlo e riaprirlo a mano — e una verifica che si fa a
     mano non si fa. Con `compress: false` il testo resta leggibile dentro il
     file, quindi ci si può cercare dentro. */
  function genera(profilo, opzioni) {
    opzioni = opzioni || {};
    var salva = opzioni.salva !== false;
    var completo = (profilo === 'completo');
    return preparaLibreria().then(function () {
      var doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', compress: salva });
      doc.setProperties({
        title: 'Curriculum vitae — Simone Castellan',
        author: 'Simone Castellan',
        subject: CV.qualifica,
        creator: 'simonecastellan.com'
      });

      var st = nuovoStato(doc);
      intestazione(st, completo);
      esperienza(st);
      istruzione(st);
      lingue(st);
      competenze(st);
      idoneita(st);
      premi(st);
      produzioni(st);
      if (completo) coda(st);
      piedi(doc);

      var esito = { pagine: doc.internal.getNumberOfPages(), profilo: completo ? 'completo' : 'pubblico' };
      if (!salva) { esito.doc = doc; return esito; }
      doc.save(completo ? 'CV_Simone_Castellan_completo.pdf' : 'CV_Simone_Castellan.pdf');
      return esito;
    });
  }

  return { genera: genera, preparaLibreria: preparaLibreria };
})();
