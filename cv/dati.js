/* ══════════════════════════════════════════════════════════════════════════
   I DATI DEL CURRICULUM — FONTE UNICA

   Da qui nascono sia la pagina /cv/ sia il PDF in formato Europass. Un dato si
   corregge QUI e cambia in tutti e due: tenerne due copie vuol dire, prima o
   poi, correggerne una sola.

   ── DA DOVE VENGONO QUESTI DATI ──────────────────────────────────────────
   Da un dossier che ha incrociato 18 fonti (15/08/2026), fra cui il CV
   depositato su InPA il 07/08/2026 — l'unico documento con giorno, mese, anno,
   voti e codici — i CV liberi, i pacchetti dei bandi già inviati e le
   attestazioni lette una per una.

   ── LA REGOLA CHE VALE SU TUTTO ─────────────────────────────────────────
   Si scrive quello che un documento sostiene, non quello che suona meglio.
   Il 12/08/2026 sei descrizioni su venti sono risultate SMENTITE dai loro
   stessi allegati, e tre erano già passate in domande inviate. Un CV va in
   mano a chi può chiedere l'attestato: se il documento dice meno di quello che
   c'è scritto, il problema non è la modestia, è la verificabilità.

   Ogni voce porta il campo `fonte`. Le voci incerte portano `verificare`, con
   scritto cosa manca: compaiono nella pagina come nota, mai come fatto.
   ══════════════════════════════════════════════════════════════════════════ */

const CV = {

  /* ── Chi ─────────────────────────────────────────────────────────────── */
  anagrafica: {
    cognome: 'Castellan',
    nome: 'Simone',
    natoIl: '24/01/1991',
    natoA: 'Bassano del Grappa (VI), Italia',
    codiceFiscale: 'CSTSMN91A24A703O',
    indirizzo: 'Via del Rosario 16',
    cap: '36022',
    citta: 'Cassola (VI)',
    paese: 'Italia',
    cittadinanza: 'Italiana',
    email: 'castellansimone@gmail.com',
    pec: 'castellansimone@pec.it',
    telefono: '+39 340 457 9244',
    sito: 'simonecastellan.com',
    patenti: 'A2, A, B',
    partitaIva: '04196010245',
    partitaIvaDal: '24/01/2019',
    /* Il regime e l'ATECO non vanno su un CV, ma servono a chi compila un
       modulo di incarico e li cerca. Restano qui, fuori dal PDF. */
    regimeFiscale: 'Forfettario (L. 190/2014)',
    ateco: '74.99.99',
    previdenza: 'INPS Gestione Separata, dal 03/07/2014'
  },

  /* Il titolo che apre il CV: dice il mestiere in una riga, senza aggettivi. */
  qualifica: 'Tecnico del suono — ripresa, mix e mastering, audio immersivo, sviluppo di strumenti per la produzione',

  /* ── Esperienza professionale ────────────────────────────────────────────
     Dalla più recente. Le date esatte vengono dal CV InPA, che è l'unica
     fonte con giorno e mese. */
  esperienza: [
    {
      dal: '2021', al: null, inCorso: true,
      ruolo: 'Titolare dell’insegnamento di Elettroacustica 2 — Sintesi analogica e sound design',
      datore: 'Civica Scuola di Musica «Claudio Abbado» — Fondazione Milano',
      luogo: 'Milano',
      tipo: 'Contratto di collaborazione professionale',
      attivita: [
        'Settore COME/04, corso DCSL 34 Musica Elettronica, 2 CFA.',
        'Sei anni accademici consecutivi, dal 2020/21 al 2025/26.'
      ],
      fonte: 'CV InPA §Attività di docenza presso PA; protocolli di graduatoria SCM-2021-0003417, SCM-2022-0003110, SCM-2022-0007642',
      /* «Titolare» è documentato e va tenuto — ma è titolare DI UN
         INSEGNAMENTO, che non è un posto di ruolo. La versione inglese del
         sito traduceva con «tenured post», che a una commissione straniera
         afferma esattamente il posto permanente che non c'è. In inglese:
         «course leader», mai «tenured». */
      nota: 'Titolare dell’insegnamento, non di un posto di ruolo: la distinzione va tenuta in tutte le lingue.',
      verificare: 'Le ore del 2022/23 sono 27 in una fonte e 18 in due altre. I protocolli di graduatoria 2024/25 e 2025/26 mancano: senza, quei due anni non si possono dichiarare come servizio a seguito di procedura selettiva pubblica.'
    },
    {
      dal: '01/2019', al: null, inCorso: true,
      ruolo: 'Tecnico audio — responsabile operativo della sala di mix immersivo',
      datore: 'AVA Sound Live Music', luogo: 'Castelfranco Veneto (TV)',
      tipo: 'Libero professionista',
      attivita: [
        'Ripresa multitraccia, editing, mix e mastering per discografia, broadcast e televisione.',
        'Sala Dolby Atmos 7.1.4 certificata Dolby: missaggio e regia.',
        'Ripresa di organici sinfonici fino a 80 musicisti, con monitoraggio in-ear.',
        'Preparazione tecnica delle sessioni in Pro Tools: mappe di tempo, click, sequenze e playback.',
        'Coordinamento di arrangiatori e tecnici di supporto.'
      ],
      /* Il credito che compare STAMPATO su un disco, cioè l'unica formulazione
         che non dipende da come la si racconta. */
      credito: 'Recording by Simone Castellan at AVA Sound Live Music di Castelfranco Veneto',
      fonte: 'CV InPA 07/08/2026 (data esatta 24/01/2019, libero professionista, 60%)'
    },
    {
      dal: '2019', al: null, inCorso: true,
      ruolo: 'Tecnico del suono',
      datore: 'Orchestra Ritmico Sinfonica Italiana, direzione M° Diego Basso',
      luogo: 'Teatri, auditorium e studi in tutta Italia',
      tipo: 'Collaborazione continuativa',
      attivita: [
        'Ripresa multitraccia dell’orchestra, gestione del monitoraggio in-ear.',
        'Editing, sincronizzazione audio-video e post-produzione fino alla consegna.',
        'Sonorizzazione e finalizzazione dell’Inno d’Italia per la Festa della Repubblica, edizioni 2024, 2025 e 2026 (RAI, per il tramite di AVA Sound Live Music).'
      ],
      fonte: 'CV InPA; riscrittura sugli attestati del 12/08/2026',
      verificare: 'L’attestazione AVA sulle tre edizioni dell’Inno è ancora da ottenere.'
    },
    {
      dal: '09/2020', al: '06/2023', inCorso: false,
      ruolo: 'Docente del modulo «Tecnologie musicali» (32 ore annue)',
      datore: 'Art Voice Academy — Centro di alta formazione per lo spettacolo',
      luogo: 'Castelfranco Veneto (TV)',
      tipo: 'Collaborazione professionale',
      attivita: [
        'Titolarità del modulo dentro il percorso accademico di canto, anni 2020/21, 2021/22, 2022/23.'
      ],
      fonte: 'CV InPA (01/09/2020 – 30/06/2023, 32 ore annue)',
      nota: 'Art Voice Academy non è istituzione AFAM: non vale come servizio AFAM.'
    },
    {
      dal: '01/2019', al: '11/2020', inCorso: false,
      ruolo: 'Tecnico di regia audio e operatore Pro Tools',
      datore: 'New Basement (BasementGroup Studios)', luogo: 'Vicenza',
      tipo: 'Libero professionista',
      attivita: [
        'Registrazione, editing, missaggio e mastering per discografia, radio, televisione e multimediale.',
        'Assistenza tecnica in sessioni con band, ensemble e orchestra.'
      ],
      fonte: 'CV InPA (24/01/2019 – 30/11/2020)',
      verificare: 'I CV liberi dicono giugno 2018 come inizio. Il 24/01/2019 del CV InPA è però anche il giorno di apertura della partita IVA: può essere la data del primo fatturato e non del primo giorno di lavoro. Un CV europeo chiede il mese: da sciogliere.'
    },
    {
      dal: '01/2021', al: '01/2021', inCorso: false,
      ruolo: 'Formatore esperto — area tecnica',
      datore: 'Istituto Comprensivo «Ramiro Fabiani»', luogo: 'Barbarano Mossano (VI)',
      tipo: 'Incarico conferito a seguito di procedura comparativa pubblica',
      attivita: [
        'Sei ore di formazione ai docenti delle scuole a indirizzo musicale della rete «Scuole in Concerto»: metodologie didattiche con software musicali, produzione di materiali audio, sincronizzazione collaborativa.'
      ],
      fonte: 'CV InPA (12/01/2021 – 26/01/2021)',
      nota: 'È l’unico incarico da ente pubblico conferito per procedura comparativa, e non compariva in nessun CV precedente.'
    },
    {
      dal: '03/2018', al: '05/2018', inCorso: false,
      ruolo: 'Tirocinante di studio di registrazione (Erasmus+ «Working With Music»)',
      datore: 'Greenhouse Studios', luogo: 'Reykjavík, Islanda',
      tipo: 'Tirocinio con borsa Erasmus+',
      attivita: [
        'Assistenza al produttore e al capo tecnico nelle sessioni dello studio.',
        'Supporto alla produzione per progetti di Ben Frost e del collettivo Bedroom Community, incluse sessioni di sound design legate alla seconda stagione della serie Netflix «Dark».',
        'Registrazione, editing, preparazione dei materiali e delle sessioni.'
      ],
      fonte: 'Certificato del 01/06/2018, firmato dal Recording Studio Head Engineer Francesco Fabris: «tutti gli obiettivi conseguiti»',
      nota: 'Formulato come dice il certificato — assistente del produttore e del capo tecnico. Le versioni precedenti dicevano «collaborazione con Ben Frost», che è più forte di quanto il documento sostenga.'
    },
    {
      dal: '11/2017', al: '02/2018', inCorso: false,
      ruolo: 'Tirocinante al Dipartimento di Intermedia (Erasmus+ «Working with Music»)',
      datore: 'Jan Matejko Academy of Fine Arts', luogo: 'Cracovia, Polonia',
      tipo: 'Tirocinio con borsa Erasmus+ (100%)',
      attivita: [
        'Supporto al laboratorio di audiosfera e media digitali: sound art, audio sperimentale, produzione multimediale.',
        'Supporto tecnico all’Audio Art Festival 2017.'
      ],
      fonte: 'CV InPA (13/11/2017 – 12/02/2018)'
    }
  ],

  /* ── Istruzione e formazione ─────────────────────────────────────────── */
  istruzione: [
    {
      data: '04/10/2022',
      titolo: 'Diploma accademico di II livello in Musica Elettronica (DCSL 34)',
      ente: 'Conservatorio di Musica «A. Steffani»', luogo: 'Castelfranco Veneto (TV)',
      voto: '110/110 e lode',
      livelloEqf: 7,
      fonte: 'CV InPA; CV 08/08/2026',
      /* ⚠️ IL BUCO PIÙ SERIO DI TUTTO IL CV.
         L'indirizzo del titolo ha TRE versioni in circolazione — «Musica per
         l'immagine», «indirizzo compositivo», «Musica e Nuove Tecnologie» — e
         due di queste stanno NELLO STESSO DOCUMENTO, in due tabelle diverse.
         Qui si scrive la sola parte su cui tutte le fonti concordano. */
      verificare: 'L’indirizzo del titolo ha tre versioni fra i documenti, due delle quali nello stesso file. Solo la pergamena può scioglierlo: finché non è vista, l’indirizzo non si scrive.'
    },
    {
      data: '07/10/2017',
      titolo: 'Diploma accademico di I livello in Musica Elettronica (DCPL 34)',
      ente: 'Conservatorio di Musica «A. Steffani»', luogo: 'Castelfranco Veneto (TV)',
      voto: '108/110',
      livelloEqf: 6,
      fonte: 'CV InPA; CV 08/08/2026'
    },
    {
      data: '26/03/2014',
      titolo: 'Laurea triennale in Pianificazione urbanistica e territoriale (classe L-21)',
      ente: 'Università Iuav di Venezia', luogo: 'Venezia',
      voto: '95/110',
      livelloEqf: 6,
      fonte: 'CV InPA; CV 08/08/2026'
    },
    {
      data: '02/2016 – 06/2016',
      titolo: 'Erasmus+ Studio — Composizione, Dipartimento di Composizione e Studio di Musica Elettroacustica',
      ente: 'Accademia di Musica di Cracovia', luogo: 'Cracovia, Polonia',
      voto: null,
      fonte: 'CV 08/08/2026',
      verificare: 'Una fonte dice fino a giugno 2016, un’altra fino a luglio.'
    },
    {
      data: '2010',
      titolo: 'Diploma di istruzione secondaria superiore',
      ente: 'Istituto Tecnico «L. Einaudi»', luogo: 'Bassano del Grappa (VI)',
      voto: null,
      livelloEqf: 4,
      fonte: 'CV 08/08/2026',
      verificare: 'La denominazione esatta dell’indirizzo e il voto non risultano da nessun documento.'
    }
  ],

  /* Corsi con attestato e ore certificate: solo quelli documentati. */
  formazione: [
    { data: '11/2020', titolo: 'Masterclass di composizione con il M° Ivan Fedele — allievo effettivo (40 ore)', ente: 'Accademia d’Archi «G. G. Arrigoni», San Vito al Tagliamento (PN)' },
    { data: '09–10/2020', titolo: 'Workshop avanzato per producer e performer di musica elettronica — Biennale College CIMM (40 ore)', ente: 'La Biennale di Venezia, Mestre-Bissuola (VE)' },
    { data: '04/2019', titolo: 'Masterclass «Voce e musica: algoritmi di analisi, trasformazione e sintesi vocale» con Marco Liuni (16 ore)', ente: 'Conservatorio «A. Steffani»' },
    { data: '12/2016', titolo: 'Residenza artistica e seminari di musica elettroacustica — Festival DME (30 ore)', ente: 'Conservatório de Música de Seia, Portogallo' },
    { data: '09/2016', titolo: 'International Masterclasses for Composition con Jaime Reis (40 ore)', ente: 'Kyiv Contemporary Music Days, Kiev' },
    { data: '05/2016', titolo: 'Seminario di composizione per musica da film con Richard Bellis (30 ore)', ente: 'Akademia Muzyczna, Cracovia' }
  ],

  /* ── Lingue ──────────────────────────────────────────────────────────────
     La griglia del Quadro comune europeo vuole cinque abilità separate.
     Inglese B2 in tutte e cinque: è il livello depositato su InPA il
     07/08/2026, e due documenti di Simone non devono dire cose diverse.
     Nessuna certificazione risulta in archivio: il livello è autodichiarato,
     come lo è nella grande maggioranza dei CV. */
  lingue: {
    madrelingua: 'Italiano',
    altre: [
      { lingua: 'Inglese', ascolto: 'B2', lettura: 'B2', interazione: 'B2', produzione: 'B2', scritto: 'B2',
        certificazione: null },
      { lingua: 'Polacco', ascolto: 'A1', lettura: 'A1', interazione: 'A1', produzione: 'A1', scritto: 'A1',
        certificazione: null,
        verificare: 'Nei CV è dichiarato «base», senza livello del Quadro europeo. A1 è la trascrizione più prudente di «base»: da confermare.' }
    ]
  },

  /* ── Competenze ─────────────────────────────────────────────────────────── */
  competenze: {
    tecniche: [
      { voce: 'Catena del segnale', dettaglio: 'Microfonazione e ripresa multicanale, editing, mix, mastering. Post-produzione per discografia, broadcast e televisione.' },
      { voce: 'Audio immersivo', dettaglio: 'Mix Dolby Atmos 7.1.4 in sala certificata Dolby.' },
      { voce: 'Ripresa orchestrale', dettaglio: 'Organici sinfonici fino a 80 musicisti, con monitoraggio in-ear.' },
      { voce: 'Sistemi e sonorizzazione', dettaglio: 'Impianti, monitoraggio, sequenze e playback per concerti, eventi e convention.' },
      { voce: 'Elaborazione del suono', dettaglio: 'Restauro e processing, sound design, composizione elettroacustica e audiovisiva, live electronics.' }
    ],
    /* Max/MSP e SuperCollider erano elencati fra le competenze, ma non
       risultano da nessun documento: dai materiali emerge solo la FORMAZIONE
       (Csound con Boulanger 2019, bach/cage con Agostini 2018). Il CV più
       recente li ha già tolti a favore di una formula che non promette
       più di quanto sia dimostrabile. */
    software: 'Pro Tools (strumento principale), Ableton Live, Logic Pro, iZotope RX. Ambienti di composizione e sintesi elettroacustica.',
    hardware: 'Mixer Yamaha DM3, interfacce MOTU, microfonazione, sistemi di monitoraggio in-ear.',
    digitali: [
      'Sviluppo di applicazioni web per la produzione audio (JavaScript, Web Audio API): StagePlot, stageplot.it.',
      'Automazione dei flussi di lavoro e strumenti di misura acustica che girano nel browser.',
      'Elaborazione numerica del segnale: analisi in frequenza, misura di risposta e di coerenza.'
    ],
    organizzative: [
      'Referente unico della catena tecnica, dal microfono alla consegna.',
      'Coordinamento di tecnici e arrangiatori in produzioni con più di settanta eventi l’anno.',
      'Direzione di produzione di un concerto (Teatro Malibran, Venezia, 2024).'
    ]
  },

  /* ── Premi e riconoscimenti ─────────────────────────────────────────────
     Scritti come li scrive l'attestato. Dove l'attestato dice meno di quanto
     si potrebbe dire, vince l'attestato. */
  premi: [
    { anno: '2023', testo: 'Contest «Your Sound for Silents» — Lago Film Fest, 19ª edizione (Revine Lago, TV). Opera vincitrice su 17 partecipanti: sonorizzazione di un cortometraggio muto di Simone Rovellini.',
      nota: 'L’attestato intesta il premio a M. Crivellaro, «con il contributo di S. Castellan e F. Motta»: non è un premio personale e va scritto così.' },
    { anno: '2022', testo: 'Premio Nazionale delle Arti XVI, sezione Musica Elettronica e Nuove Tecnologie (MUR — Conservatorio «A. Casella» dell’Aquila). Opera «Mote» ammessa e presentata nella categoria B, opere originali elettroacustiche.',
      nota: 'L’attestato è un «attestato di partecipazione» e non contiene la parola «finalista». Scelta del 15/08/2026: si scrive quello che il documento sostiene.' },
    { anno: '2021', testo: 'Musica Nova 2021 (Society for Electroacoustic Music of the Czech Republic, Praga): menzione d’onore nella categoria B per la composizione «Mote».' },
    { anno: '2021', testo: 'International Computer Music Conference ICMC 2021 (Santiago del Cile): opera «Mote» selezionata ed eseguita.' },
    { anno: '2020', testo: '«Sounds of Silences», 5ª edizione (Edison Studio, con Cineteca di Bologna e Romaeuropa Festival): 2° premio per la composizione originale sul film muto «I lupi e gli agnelli», eseguita a Roma.' },
    { anno: '2019', testo: 'XII Concorso internazionale Fundación Destellos (Mar del Plata, Argentina): 2° premio assoluto per l’opera acusmatica «Solitudine»; menzione d’onore per l’audiovisivo «Stones».' },
    { anno: '2017', testo: 'Call for works «Violoncello ed Elettronica», Conservatorio «A. Steffani»: 1° premio per «Skrik» (live electronics; partitura di F. Bresolin).' },
    { anno: '2022', testo: '.AAC2022 Anamòrphosis Audiovisual Competition (Conservatorio «T. Schipa» di Lecce): opera audiovisiva «Stones» selezionata ed eseguita all’Anamòrphosis International Film Festival.',
      nota: 'Il sito attribuiva questa selezione a «Mote» e la dava per finale: l’attestato riguarda «Stones» e dice «has been selected». Opera sbagliata, corretta il 15/08/2026.' }
  ],

  /* ── Produzioni discografiche ───────────────────────────────────────────
     Una selezione: il CV depositato ne porta ventiquattro. Qui stanno quelle
     con il ruolo più chiaro e il codice verificabile.
     Le tre correzioni del 12/08/2026 sono applicate. */
  produzioni: [
    { anno: '2023', titolo: 'EVO', contesto: 'Colonna sonora della serie Netflix «Running for My Truth: Alex Schwazer»', ruolo: 'Compositore originale (quota 25%)', codice: 'SIAE 22212081500 · ISWC T-312.022.151' },
    { anno: '2022', titolo: 'La voce è musica', contesto: 'Album di Luca Minnelli; Brian May e Kerry Ellis ospiti nel brano «Forever and Ever With You»; orchestre ORSI e Budapest Art Orchestra', ruolo: 'Recording engineer — registrazione ed editing di voci, coro e orchestra', codice: 'Logo Records · CD 8019991888001',
      nota: 'Riscritto sul supporto il 12/08/2026. Le versioni precedenti presentavano Brian May come artista dell’album e l’ORSI come unica orchestra: entrambe più forti di quanto il disco dica.' },
    { anno: '2021', titolo: 'Griminelli plays Morricone', contesto: 'Andrea Griminelli, direzione e arrangiamenti Diego Basso, ORSI; ospiti Sting, Zucchero, Nek, Chris Botti, Aida Garifullina', ruolo: 'Registrazione, operatore Pro Tools, editing dell’orchestra sinfonica — credito stampato: «Recording by Simone Castellan»', codice: 'Editore Fenix; distribuzione Sony Music',
      verificare: 'Due EAN diversi in circolazione (0194399662328 e 8019991887370): o sono due edizioni o uno è sbagliato. Serve guardare la copertina.' },
    { anno: '2021', titolo: 'La Geografia del Buio', contesto: 'Michele Bravi — Virgin Records / Universal Music Italia', ruolo: 'Musical Assistance [Studio, Orchestra] — dicitura letterale dei crediti', codice: '0602508814440' },
    { anno: '2021', titolo: 'Simphony', contesto: 'Roby Facchinetti, arrangiamenti Diego Basso, ORSI', ruolo: 'Recording engineer e operatore Pro Tools, ripresa dell’orchestra sinfonica', codice: 'CD 8055719992476',
      verificare: 'Il titolo circola in due grafie, «Simphony» e «Symphony». Quella con la «i» è depositata con il codice a barre, ma va vista sulla copertina.' },
    { anno: '2021', titolo: 'Donnafugata (Original Motion Picture Soundtrack)', contesto: 'Con Marco Crivellaro e Federico Motta — La Valigetta', ruolo: 'Co-autore di quattro brani: Donnafugata, Beginning, Reflections, Finale; sound design e produzione aggiuntiva', codice: null,
      nota: 'Quattro brani, non cinque: l’attribuzione di «Echoes» era un errore, corretto il 12/08/2026 dopo essere già passato in tre domande inviate.' },
    { anno: '2020', titolo: 'Antonio Vivaldi — Lost Concertos for Anna Maria', contesto: 'Federico Maria Sardelli — note 1 music, Heidelberg', ruolo: 'Tecnico del suono e assistente alla registrazione, accreditato nei crediti ufficiali', codice: 'EAN 8424562246010' },
    { anno: '2025', titolo: 'BoscoSession', contesto: 'Con Marcus Grimm e Federico Motta — La Valigetta', ruolo: 'Co-autore di cinque brani, esecutore, mix e mastering', codice: null }
  ],

  /* ── Idoneità da procedura pubblica ─────────────────────────────────────
     Il sito diceva «idoneo nelle graduatorie» e in inglese «2026 national
     lists»: allude a graduatorie nazionali che non esistono. I fatti veri
     sono due, entrambi da decreto, ed entrambi sono risultati. */
  idoneita: [
    { data: '14/01/2026',
      testo: 'Idoneo (posizione 7 su 8) nella procedura comparativa pubblica del Conservatorio «F. Venezze» di Rovigo per incarichi a docenti esterni, a.a. 2025/26 — settore artistico-disciplinare AFAM047 Tecnologie del suono e della multimedialità, campo COME/04.',
      fonte: 'D.D. n. 505, prot. 300/DC3 del 14/01/2026' },
    { data: '07/11/2023',
      testo: 'Inserito al n. 23 (punteggio 40/100) nella graduatoria di merito definitiva per COME/04 Elettroacustica del Conservatorio «G. Frescobaldi» di Ferrara, procedura per soli titoli, a.a. 2023/24–2025/26.',
      fonte: 'Decreto n. 1891, prot. 9858/b14 del 07/11/2023' }
  ],

  /* Undici opere depositate in SIAE, tutte in stato regolare. */
  siae: {
    posizione: '284288',
    opere: 11,
    nota: 'Musica di libreria e di produzione per media; nove edite da Sounzone. Le opere generano diritti anche dall’estero (Germania, Regno Unito, Stati Uniti, Spagna, Messico, Paesi Bassi, Ecuador).'
  },

  /* ── Cosa manca ─────────────────────────────────────────────────────────
     Dichiarato invece che nascosto: un buco che si vede si chiude, un buco
     riempito a intuito resta sbagliato per sempre. La pagina lo mostra solo
     a Simone (parametro ?verifiche), mai a chi legge il CV. */
  daVerificare: [
    'Pergamena del diploma di II livello: quale dei tre indirizzi è scritto sul titolo.',
    'Copertina di «Griminelli plays Morricone»: editore e quale dei due EAN.',
    'Copertina di «Simphony»: la grafia esatta del titolo.',
    'New Basement: giugno 2018 o gennaio 2019 come mese d’inizio.',
    'Erasmus a Cracovia: fine a giugno o a luglio 2016.',
    'Diploma di scuola superiore: denominazione esatta dell’indirizzo e voto.',
    'Polacco: il livello del Quadro europeo corrispondente a «base».',
    'Attestazione di AVA Sound sulle tre edizioni dell’Inno d’Italia.',
    'Associazione AIMI e IRCAM Forum: risultano da una sola fonte, senza riscontro.'
  ]
};

if (typeof module !== 'undefined' && module.exports) module.exports = CV;
