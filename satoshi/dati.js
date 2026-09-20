/* ══════════════════════════════════════════════════════════════════════
   simonecastellan.com/satoshi — fonte unica dei contenuti.
   © 2026 Simone Castellan. Testi originali.
   Ogni nodo: fatti pubblici e verificabili, con la fonte accanto.
   ══════════════════════════════════════════════════════════════════════ */

const TRACCE = [
  { id: 'chiave', corto: 'Chiave', nome: 'La chiave pubblica',   sintesi: 'Come scriversi in segreto senza essersi mai incontrati.' },
  { id: 'moneta', corto: 'Moneta', nome: 'La moneta anonima',    sintesi: 'Denaro digitale che non lascia il nome di chi paga.' },
  { id: 'tempo', corto: 'Tempo',  nome: 'La marca temporale',   sintesi: 'Dimostrare quando un documento è nato, senza notaio.' },
  { id: 'lavoro', corto: 'Lavoro', nome: 'Il costo del lavoro',  sintesi: 'Rendere il falso costoso: la prova di lavoro.' },
  { id: 'codice', corto: 'Codice', nome: 'Il codice è politica', sintesi: 'Chi scrive software decide chi può parlare in privato.' }
];

const NODI = [

  /* ── traccia: la chiave pubblica ─────────────────────────────────── */
  {
    id: 'diffie-hellman', breve: 'Chiave pubblica', anno: 1976, data: 'novembre 1976', traccia: 'chiave', tipo: 'idea',
    titolo: 'Nuove direzioni in crittografia', chi: 'Whitfield Diffie e Martin Hellman',
    testo: 'Fino a quel momento per scriversi in codice bisognava scambiarsi prima una chiave segreta, di persona o con un corriere. Diffie e Hellman dimostrano che due sconosciuti possono accordarsi su un segreto parlandosi a voce alta, davanti a tutti. È la crittografia a chiave pubblica: la base di ogni firma digitale, compresa quella che autorizza la spesa di un bitcoin.',
    perche: 'Senza firma digitale, chiunque potrebbe spendere il denaro di chiunque.',
    fonte: { testo: 'Il paper originale (PDF)', url: 'https://ee.stanford.edu/~hellman/publications/24.pdf' }
  },
  {
    id: 'rsa', breve: 'RSA', anno: 1977, data: 'aprile 1977', traccia: 'chiave', tipo: 'idea',
    titolo: 'RSA, la firma che funziona', chi: 'Ron Rivest, Adi Shamir, Leonard Adleman',
    testo: 'Diffie e Hellman avevano detto che si poteva fare. Tre ricercatori del MIT trovano come: un algoritmo pratico basato sulla difficoltà di scomporre numeri molto grandi. Da qui in poi la firma digitale non è più teoria, è un programma che gira.',
    perche: 'Bitcoin usa una firma a curva ellittica, discendente diretta di questa idea.',
    fonte: { testo: 'Il paper originale (PDF)', url: 'https://people.csail.mit.edu/rivest/Rsapaper.pdf' }
  },
  {
    id: 'merkle', breve: 'Albero di Merkle', anno: 1979, data: '1979', traccia: 'chiave', tipo: 'idea',
    titolo: 'L\'albero di Merkle', chi: 'Ralph Merkle',
    testo: 'Un modo per riassumere migliaia di documenti in un unico codice corto, e poi dimostrare che un singolo documento sta dentro quel riassunto senza doverli rileggere tutti. Sembra un dettaglio contabile. È ciò che permette a un telefono di verificare una transazione senza scaricare l\'intera catena.',
    perche: 'Ogni blocco di Bitcoin contiene la radice di un albero di Merkle.',
    fonte: { testo: 'La tesi di Merkle (PDF)', url: 'https://www.merkle.com/papers/Thesis1979.pdf' }
  },

  /* ── traccia: la moneta anonima ──────────────────────────────────── */
  {
    id: 'chaum-firme', breve: 'Firme cieche', anno: 1982, data: 'agosto 1982', traccia: 'moneta', tipo: 'idea',
    titolo: 'Le firme cieche', chi: 'David Chaum',
    testo: 'Chaum inventa un modo per farsi firmare un documento da una banca senza che la banca possa leggerlo. Tradotto in denaro: la banca certifica che quella moneta è valida, ma non saprà mai dove finirà spesa. È il primo progetto serio di contante digitale, e nasce vent\'anni prima di Bitcoin.',
    perche: 'Il problema che Chaum pone — pagare senza essere schedati — è lo stesso che Bitcoin riprende.',
    fonte: { testo: 'Blind signatures for untraceable payments', url: 'https://chaum.com/wp-content/uploads/2022/01/Chaum-blind-signatures.pdf' }
  },
  {
    id: 'digicash', breve: 'DigiCash', anno: 1989, data: '1989', traccia: 'moneta', tipo: 'evento',
    titolo: 'DigiCash, e un socio di troppo', chi: 'David Chaum, Amsterdam',
    testo: 'Chaum fonda una società per vendere il suo contante digitale. La tecnologia funziona, alcune banche la provano, Microsoft si affaccia. Ma il sistema ha un cuore fragile: un\'azienda che emette e garantisce. Quando l\'azienda si ferma, si ferma la moneta.',
    perche: 'Il fallimento di DigiCash indica il problema da risolvere: togliere di mezzo l\'emittente.',
    fonte: { testo: 'DigiCash su Wikipedia', url: 'https://en.wikipedia.org/wiki/DigiCash' }
  },
  {
    id: 'digicash-fine', breve: 'DigiCash chiude', anno: 1998, data: '1998', traccia: 'moneta', tipo: 'evento',
    titolo: 'DigiCash chiude', chi: '',
    testo: 'Bancarotta. La moneta digitale più avanzata del mondo smette di esistere perché smette di esistere la società che la firmava. La lezione resta scritta: finché c\'è un centro, c\'è un interruttore. E chi può spegnere, prima o poi spegne.',
    perche: 'Dieci anni dopo, il white paper si apre proprio rifiutando l\'idea di una terza parte fidata.',
    fonte: { testo: 'La storia di DigiCash', url: 'https://en.wikipedia.org/wiki/DigiCash' }
  },

  /* ── traccia: la marca temporale ─────────────────────────────────── */
  {
    id: 'haber-stornetta', breve: 'Marca temporale', anno: 1991, data: '1991', traccia: 'tempo', tipo: 'idea',
    titolo: 'Come datare un documento digitale', chi: 'Stuart Haber e W. Scott Stornetta',
    testo: 'Un file si può retrodatare cambiando l\'orologio del computer. I due ricercatori risolvono così: ogni documento viene legato al precedente in una catena, e la catena viene pubblicata dove tutti la vedono. Per falsificare una data bisognerebbe rifare ogni anello successivo. Questa è, alla lettera, una catena di blocchi.',
    perche: 'Il white paper li cita tre volte: sono i riferimenti più citati di tutto il documento.',
    fonte: { testo: 'How to time-stamp a digital document', url: 'https://www.anf.es/pdf/Haber_Stornetta.pdf' }
  },

  {
    id: 'surety', breve: 'Catena sul Times', anno: 1995, data: 'dal 1995', traccia: 'tempo', tipo: 'evento',
    titolo: 'Una catena stampata sul giornale', chi: 'Surety Technologies',
    testo: 'Haber e Stornetta fondano una società per vendere il loro servizio di datazione, e risolvono il problema di dove pubblicare la catena nel modo più solido possibile: una volta alla settimana comprano un annuncio economico sul New York Times e ci stampano dentro il riassunto di tutti i documenti registrati. Su carta, in migliaia di copie sparse per il mondo, impossibili da richiamare.',
    perche: 'Esce ogni settimana da allora: è la catena di blocchi più antica ancora in funzione, e sta sulla carta stampata.',
    fonte: { testo: 'La storia dell\'annuncio sul Times', url: 'https://www.vice.com/en/article/what-was-the-first-blockchain/' }
  },

  /* ── traccia: il costo del lavoro ────────────────────────────────── */
  {
    id: 'hashcash', breve: 'Hashcash', anno: 1997, data: 'marzo 1997', traccia: 'lavoro', tipo: 'idea',
    titolo: 'Hashcash, il francobollo di calcolo', chi: 'Adam Back',
    testo: 'Contro lo spam: prima di spedire un\'email il computer deve risolvere un piccolo rompicapo. Per una persona che scrive dieci messaggi è impercettibile; per chi ne spara un milione diventa proibitivo. Il costo non è in denaro, è in elettricità e tempo. Si chiama prova di lavoro.',
    perche: 'È il meccanismo esatto con cui Bitcoin decide chi scrive il blocco successivo.',
    fonte: { testo: 'Hashcash — il paper', url: 'http://www.hashcash.org/hashcash.pdf' }
  },
  {
    id: 'b-money', breve: 'b-money', anno: 1998, data: 'novembre 1998', traccia: 'lavoro', tipo: 'idea',
    titolo: 'b-money', chi: 'Wei Dai',
    testo: 'Una proposta di poche pagine su una mailing list: una moneta senza banca, dove tutti i partecipanti tengono una copia del registro e il denaro si crea risolvendo problemi di calcolo. C\'è quasi tutto. Manca il modo di mettere d\'accordo copie del registro che non coincidono.',
    perche: 'È la prima nota del white paper. La primissima.',
    fonte: { testo: 'Il testo di b-money', url: 'http://www.weidai.com/bmoney.txt' }
  },
  {
    id: 'bit-gold', breve: 'Bit gold', anno: 1998, data: '1998', traccia: 'lavoro', tipo: 'idea',
    titolo: 'Bit gold', chi: 'Nick Szabo',
    testo: 'Nello stesso anno, indipendentemente, Szabo progetta qualcosa di molto simile: catene di prove di lavoro che si incastrano l\'una nell\'altra, creando una scarsità digitale paragonabile a quella dell\'oro. Anche qui il nodo irrisolto è lo stesso: chi decide quale versione della storia è quella vera.',
    perche: 'Szabo resta tra i candidati più citati proprio per questa vicinanza di pensiero.',
    fonte: { testo: 'Bit gold, dal blog di Szabo', url: 'https://nakamotoinstitute.org/bit-gold/' }
  },
  {
    id: 'rpow', breve: 'RPOW', anno: 2004, data: 'agosto 2004', traccia: 'lavoro', tipo: 'idea',
    titolo: 'RPOW, prove di lavoro riutilizzabili', chi: 'Hal Finney',
    testo: 'Finney costruisce un sistema funzionante in cui una prova di lavoro, una volta spesa, può essere scambiata con un\'altra: gettoni che passano di mano. Non è un esperimento su carta, è software che gira. Resta però un server centrale a tenere il conto.',
    perche: 'Finney sarà la prima persona al mondo a ricevere un bitcoin.',
    fonte: { testo: 'RPOW', url: 'https://nakamotoinstitute.org/finney/rpow/' }
  },

  /* ── traccia: il codice è politica ───────────────────────────────── */
  {
    id: 'pgp', breve: 'PGP', anno: 1991, data: 'giugno 1991', traccia: 'codice', tipo: 'evento',
    titolo: 'PGP finisce su internet', chi: 'Phil Zimmermann',
    testo: 'Zimmermann pubblica gratuitamente un programma che dà a chiunque la crittografia forte, fino ad allora riservata a governi e grandi aziende. Il governo statunitense apre un\'indagine: esportare crittografia forte equivaleva a esportare armi. L\'indagine si chiuderà nel 1996 senza incriminazione.',
    perche: 'Stabilisce il precedente: il software si può pubblicare, e una volta pubblicato non si richiama.',
    fonte: { testo: 'Il racconto di Zimmermann', url: 'https://www.philzimmermann.com/EN/essays/WhyIWrotePGP.html' }
  },
  {
    id: 'cypherpunk', breve: 'Manifesto Cypherpunk', anno: 1993, data: '9 marzo 1993', traccia: 'codice', tipo: 'evento',
    titolo: 'Il manifesto dei Cypherpunk', chi: 'Eric Hughes',
    testo: 'Un gruppo di programmatori e matematici si scambia idee su una mailing list con una convinzione precisa: la privacy non si ottiene chiedendola per legge, si ottiene scrivendo il programma che la rende possibile. Da questa lista usciranno quasi tutti i nomi che contano in questa storia.',
    perche: 'Il white paper verrà pubblicato su una mailing list erede diretta di questa.',
    fonte: { testo: 'A Cypherpunk\'s Manifesto', url: 'https://www.activism.net/cypherpunk/manifesto.html' }
  },

  {
    id: 'crypto-wars', breve: 'Crypto Wars', anno: 1993, data: '1993 – 2000', traccia: 'codice', tipo: 'evento',
    titolo: 'Le guerre della crittografia', chi: '',
    testo: 'Per legge, negli Stati Uniti la crittografia forte era classificata come materiale bellico: esportarla richiedeva la stessa licenza di un\'arma. Chi si oppone risponde per assurdo, stampando il codice su carta e su magliette — perché il materiale stampato era esplicitamente escluso dal divieto. La restrizione viene smantellata nel 2000.',
    perche: 'Senza quella battaglia, pubblicare un programma come Bitcoin nel 2009 sarebbe stato un reato.',
    fonte: { testo: 'Le Crypto Wars', url: 'https://en.wikipedia.org/wiki/Crypto_Wars' }
  },

  /* ── il tronco: Bitcoin ──────────────────────────────────────────── */
  {
    id: 'dominio', breve: 'bitcoin.org', anno: 2008, data: '18 agosto 2008', traccia: 'tronco', tipo: 'evento',
    titolo: 'Viene registrato bitcoin.org', chi: '',
    testo: 'Il dominio è registrato in forma anonima, attraverso un servizio che schermava l\'intestatario. Due mesi prima che il mondo sappia cosa sia Bitcoin, l\'indirizzo dove vivrà esiste già.',
    perche: 'È la prima traccia datata dell\'esistenza del progetto.',
    fonte: { testo: 'Cronologia di Bitcoin', url: 'https://en.wikipedia.org/wiki/History_of_bitcoin' }
  },
  {
    id: 'lehman', breve: 'Lehman', anno: 2008, data: '15 settembre 2008', traccia: 'tronco', tipo: 'evento',
    titolo: 'Lehman Brothers fallisce', chi: '',
    testo: 'La più grande bancarotta della storia americana apre la crisi finanziaria. Nei mesi seguenti i governi salvano con denaro pubblico le banche che l\'avevano innescata. La fiducia negli intermediari finanziari tocca il minimo.',
    perche: 'Sei settimane dopo esce il white paper. Il primo blocco porterà scritto un titolo di giornale sui salvataggi bancari.',
    fonte: { testo: 'Cronologia della crisi', url: 'https://www.federalreservehistory.org/essays/lehman-brothers-bankruptcy' }
  },
  {
    id: 'doppia-spesa', breve: 'La doppia spesa', anno: 2008, data: 'il problema aperto', traccia: 'tronco', tipo: 'idea',
    titolo: 'Il problema che nessuno aveva risolto', chi: '',
    testo: 'Un file si copia. Se il denaro è un file, chi paga può spendere due volte la stessa moneta mandandola a due persone diverse nello stesso istante. Una banca risolve la questione tenendo lei l\'unico registro valido. Senza banca servirebbe che migliaia di copie dello stesso registro, aggiornate da sconosciuti che non si fidano fra loro, arrivino da sole alla stessa versione della storia. Per trent\'anni nessuno c\'era riuscito.',
    perche: 'Tutte e cinque le tracce si fermano qui. Il white paper si apre esattamente su questo punto.',
    fonte: { testo: 'Il problema della doppia spesa', url: 'https://en.wikipedia.org/wiki/Double-spending' }
  },
  {
    id: 'whitepaper', breve: 'Il white paper', anno: 2008, data: '31 ottobre 2008, 14:10 UTC', traccia: 'tronco', tipo: 'evento', cardine: true,
    titolo: 'Nove pagine su una mailing list', chi: 'Satoshi Nakamoto',
    testo: 'Un messaggio a una lista di crittografia frequentata da poche centinaia di persone annuncia un documento intitolato «Bitcoin: un sistema di contante elettronico da utente a utente». In nove pagine le cinque tracce di questa pagina si chiudono in un progetto solo: firme digitali, catena di marche temporali, prova di lavoro, e una regola per decidere quale versione del registro vale — quella su cui è stato speso più lavoro.',
    perche: 'È il punto in cui tutto converge. Le prime reazioni sulla lista sono tiepide o scettiche.',
    fonte: { testo: 'Il white paper (PDF)', url: 'https://bitcoin.org/bitcoin.pdf' }
  },
  {
    id: 'genesi', breve: 'Blocco zero', anno: 2009, data: '3 gennaio 2009', traccia: 'tronco', tipo: 'evento', cardine: true,
    titolo: 'Il blocco zero', chi: '',
    testo: 'Viene generato il primo blocco. Dentro, in un campo che nessuna regola obbligava a riempire, c\'è la prima pagina del Times di quel giorno: il cancelliere dello Scacchiere sull\'orlo di un secondo salvataggio delle banche. Serve a datare il blocco, e insieme dice a chiare lettere contro cosa nasce questa cosa.',
    perche: 'Quei 50 bitcoin, per com\'è scritto il programma, non si possono spendere. Sono ancora lì.',
    fonte: { testo: 'Il blocco 0 sulla catena', url: 'https://mempool.space/block/000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f' }
  },
  {
    id: 'v01', breve: 'Bitcoin v0.1', anno: 2009, data: '9 gennaio 2009', traccia: 'tronco', tipo: 'evento',
    titolo: 'Il programma è pubblico', chi: '',
    testo: 'Esce Bitcoin v0.1: codice sorgente aperto, scaricabile da chiunque. Da questo momento la rete non ha più bisogno del permesso di nessuno per esistere, basta che qualcuno tenga acceso un computer.',
    perche: 'Il codice è in C++, dettaglio che restringerà il campo dei candidati.',
    fonte: { testo: 'L\'annuncio del rilascio', url: 'https://satoshi.nakamotoinstitute.org/emails/cryptography/16/' }
  },
  {
    id: 'finney-tx', breve: 'Prima transazione', anno: 2009, data: '12 gennaio 2009, 03:30 UTC', traccia: 'tronco', tipo: 'evento', cardine: true,
    titolo: 'Dieci bitcoin a Hal Finney', chi: 'Satoshi Nakamoto → Hal Finney',
    testo: 'Blocco 170: la prima volta che un bitcoin passa da una persona a un\'altra. Il destinatario è Hal Finney, il crittografo che aveva costruito RPOW cinque anni prima e che era stato tra i primissimi a rispondere all\'annuncio del white paper. Nei giorni precedenti aveva scaricato il programma e si era messo a far girare la rete.',
    perche: 'Finney scriverà anni dopo di aver pensato subito che quella cosa potesse valere qualcosa.',
    fonte: { testo: 'Il blocco 170', url: 'https://mempool.space/block/00000000d1145790a8694403d4063f323d499e655c83426834d4ce2f8dd4a2ee' }
  },
  {
    id: 'cambio', breve: 'Primo prezzo', anno: 2009, data: '5 ottobre 2009', traccia: 'tronco', tipo: 'evento',
    titolo: 'Il primo prezzo', chi: '',
    testo: 'Un sito calcola il primo tasso di cambio partendo dal costo dell\'elettricità necessaria a generarli: un dollaro vale 1.309 bitcoin. Detto al contrario, un bitcoin vale otto centesimi di millesimo di dollaro.',
    perche: 'È il punto di partenza per misurare tutto quello che è successo dopo.',
    fonte: { testo: 'New Liberty Standard', url: 'https://en.wikipedia.org/wiki/History_of_bitcoin' }
  },
  {
    id: 'pizza', breve: 'Le due pizze', anno: 2010, data: '22 maggio 2010', traccia: 'tronco', tipo: 'evento',
    titolo: 'Diecimila bitcoin per due pizze', chi: 'Laszlo Hanyecz',
    testo: 'Un programmatore della Florida chiede sul forum se qualcuno gli ordina due pizze in cambio di 10.000 bitcoin. Qualcuno accetta. È il primo acquisto di un bene reale con questa moneta: il momento in cui smette di essere un esercizio di crittografia e diventa denaro, perché qualcuno lo accetta in pagamento.',
    perche: 'Il 22 maggio si festeggia ancora come Bitcoin Pizza Day.',
    fonte: { testo: 'Il messaggio sul forum', url: 'https://bitcointalk.org/index.php?topic=137.0' }
  },
  {
    id: 'ultimo-post', breve: 'Ultimo messaggio', anno: 2010, data: '12 dicembre 2010', traccia: 'tronco', tipo: 'evento', cardine: true,
    titolo: 'L\'ultimo messaggio pubblico', chi: 'Satoshi Nakamoto',
    testo: 'Un messaggio tecnico sul forum, a proposito di alcune difese contro gli attacchi alla rete. Nessun saluto, nessun annuncio. Chi legge quel giorno non ha modo di sapere che è l\'ultimo.',
    perche: 'Nei giorni precedenti aveva discusso, contrario, l\'idea che WikiLeaks accettasse donazioni in bitcoin: troppa attenzione, troppo presto.',
    fonte: { testo: 'Il post sul forum', url: 'https://bitcointalk.org/index.php?topic=2228.msg29279#msg29279' }
  },
  {
    id: 'consegna', breve: 'Consegna ad Andresen', anno: 2011, data: '26 aprile 2011', traccia: 'tronco', tipo: 'evento', cardine: true,
    titolo: 'Le chiavi a Gavin Andresen', chi: 'Satoshi Nakamoto',
    testo: 'In una email privata Satoshi scrive di essere passato ad altro e che il progetto è in buone mani. Consegna il controllo del sito e della chiave di allerta della rete a Gavin Andresen, il programmatore più attivo. È l\'ultima comunicazione considerata autentica.',
    perche: 'Da qui in poi: silenzio. Nessun messaggio, nessuna email, nessuna moneta spostata.',
    fonte: { testo: 'Le email di Satoshi', url: 'https://satoshi.nakamotoinstitute.org/emails/' }
  },
  {
    id: 'silenzio', breve: 'Il silenzio', anno: 2011, data: 'dal 2011', traccia: 'tronco', tipo: 'evento', finale: true,
    titolo: 'Il silenzio', chi: '',
    testo: 'Circa 1,1 milioni di bitcoin risultano generati nel primo anno da un singolo computer, riconoscibile da una regolarità nel modo in cui firmava i blocchi. Non si sono mai mossi. Non un trasferimento, non una prova, in oltre quindici anni. È la parte più difficile da spiegare di tutta questa storia: chiunque fosse, ha lasciato lì una fortuna e non l\'ha toccata.',
    perche: 'Le ipotesi sono tre: le chiavi sono perse, la persona è morta, oppure muoverle distruggerebbe la cosa stessa che ha costruito.',
    fonte: { testo: 'L\'analisi del modello Patoshi', url: 'https://bitslog.com/2013/04/17/the-well-deserved-fortune-of-satoshi-nakamoto/' }
  }
];

/* ── I nomi che ricorrono ──────────────────────────────────────────────
   Nessuno di questi è Satoshi. Sono le persone il cui lavoro ci è finito
   dentro, e che per questo motivo vengono regolarmente indicate. */
const CANDIDATI = [
  {
    id: 'finney', nome: 'Hal Finney', vissuto: '1956 – 2014',
    cosa: 'Crittografo, secondo sviluppatore di PGP, autore di RPOW.',
    a_favore: 'Primo a rispondere all\'annuncio, prima persona a ricevere un bitcoin, tra i pochissimi a far girare la rete nei primi giorni. Nessuno aveva una storia più coerente.',
    contro: 'Ha sempre negato. Nel 2013 un\'analisi grafologica commissionata da un giornalista ha confrontato i suoi scritti con quelli di Satoshi senza trovare corrispondenza, e sono emerse email fra i due. Si è ammalato di SLA nel 2009 ed è morto nel 2014.',
    fonte: { testo: 'Bitcoin and me, il suo racconto', url: 'https://bitcointalk.org/index.php?topic=155054.0' }
  },
  {
    id: 'szabo', nome: 'Nick Szabo', vissuto: 'n. 1964',
    cosa: 'Giurista e informatico, autore di bit gold e del concetto di contratto intelligente.',
    a_favore: 'Bit gold è il progetto più vicino a Bitcoin mai pubblicato prima del 2008. Analisi stilistiche dei testi lo indicano più volte come il più probabile fra i candidati noti.',
    contro: 'Nega. E c\'è un\'anomalia difficile da spiegare: il white paper non cita bit gold, mentre cita b-money e Hashcash.',
    fonte: { testo: 'Il blog di Szabo', url: 'https://unenumerated.blogspot.com/' }
  },
  {
    id: 'back', nome: 'Adam Back', vissuto: 'n. 1970',
    cosa: 'Crittografo, autore di Hashcash, oggi a capo di una società di infrastrutture Bitcoin.',
    a_favore: 'Fra le prime persone al mondo con cui Satoshi si sia scambiato email, prima ancora che il progetto fosse pubblico. È la prima delle otto note del white paper.',
    contro: 'Nega, in modo diretto e ripetuto. Il suo lavoro entra in Bitcoin come componente citata, che è esattamente ciò che ci si aspetta da un predecessore, non dall\'autore.',
    fonte: { testo: 'Hashcash', url: 'http://www.hashcash.org/' }
  },
  {
    id: 'dai', nome: 'Wei Dai', vissuto: 'n. 1976 ca.',
    cosa: 'Informatico, autore di b-money e della libreria crittografica Crypto++.',
    a_favore: 'b-money è la prima nota del white paper. Programmatore C++ di altissimo livello, come richiede il codice di Bitcoin. Estremamente riservato: di lui non circolano quasi fotografie.',
    contro: 'Ha raccontato di essere stato contattato da Satoshi prima della pubblicazione e di non aver dato molto peso alla cosa. Nega.',
    fonte: { testo: 'Il sito di Wei Dai', url: 'http://www.weidai.com/' }
  },
  {
    id: 'sassaman', nome: 'Len Sassaman', vissuto: '1980 – 2011',
    cosa: 'Crittografo, sviluppatore di sistemi di anonimato, allievo di David Chaum.',
    a_favore: 'Inglese britannico negli scritti, come l\'unica parola anomala del white paper. È morto poche settimane dopo l\'ultima email di Satoshi.',
    contro: 'La coincidenza delle date è l\'argomento principale, e una coincidenza non è una prova. Chi lo ha conosciuto respinge l\'ipotesi.',
    fonte: { testo: 'Len Sassaman', url: 'https://en.wikipedia.org/wiki/Len_Sassaman' }
  }
];

/* ── Le piste chiuse ─────────────────────────────────────────────────── */
const CHIUSE = [
  {
    nome: 'Dorian Nakamoto', anno: '2014',
    testo: 'Un settimanale americano identifica come inventore di Bitcoin un ingegnere californiano in pensione, che di nome fa davvero Satoshi Nakamoto, e ne pubblica la casa. Lui nega tutto. Pochi giorni dopo, dall\'unico profilo online ancora riconducibile a Satoshi, compare un messaggio di cinque parole: non sono Dorian Nakamoto.'
  },
  {
    nome: 'Craig Wright', anno: '2016 – 2024',
    testo: 'Un informatico australiano sostiene per anni di essere Satoshi e porta in tribunale chi lo nega. Nel marzo 2024 l\'Alta Corte di Londra stabilisce il contrario in termini definitivi: non ha creato Bitcoin, non ha scritto il white paper, e ha prodotto documenti falsi per sostenere il contrario.'
  }
];

if (typeof module !== 'undefined') module.exports = { TRACCE, NODI, CANDIDATI, CHIUSE };
