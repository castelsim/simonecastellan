/* Il motore di «Trasporta gli accordi»: da un testo con gli accordi sopra le
   parole, allo stesso testo in un'altra tonalità.

   ── IL PROBLEMA VERO, CHE NON È LA MATEMATICA ────────────────────────────
   Spostare un accordo di N semitoni è una somma modulo dodici: dieci righe.
   Il lavoro sta tutto in due punti che chi non ha mai suonato non vede:

   1. RICONOSCERE un accordo dentro il testo. «La» è un accordo, ma «la
      chitarra» no; «Mi» è un accordo, ma «mi ha detto» no; «Do» è un accordo,
      «dove» no. In italiano i nomi delle note SONO parole comuni, e questo
      strumento serve soprattutto a chi scrive in italiano. La regola che
      funziona: si guarda la RIGA, non la parola. Una riga di accordi è fatta
      quasi solo di accordi e spazi — se lo è, si trasporta tutta; se non lo è,
      non si tocca niente. Sbagliare qui vuol dire riscrivere le parole di una
      canzone, che è il modo più rapido per far chiudere la pagina.

   2. TENERE L'ALLINEAMENTO. Gli accordi stanno sopra la sillaba in cui si
      cambia. Se «Do» diventa «Do#» la riga si allunga di un carattere e da lì
      in poi ogni accordo scivola a destra: il documento resta leggibile ma
      diventa sbagliato, e se ne accorge solo chi prova a suonarlo. Qui la
      posizione di partenza di ogni accordo si conserva, aggiungendo o
      togliendo spazi — e quando due accordi finirebbero appiccicati si tiene
      almeno uno spazio, perché due accordi attaccati non si leggono.

   ── LE DUE NOTAZIONI ─────────────────────────────────────────────────────
   In Italia si scrive «Do Re Mi», nel resto del mondo «C D E». Chi suona ne
   incontra tutte e due, spesso nello stesso pomeriggio: si riconoscono
   entrambe e si può scegliere in quale scrivere il risultato.

   ── I DIESIS O I BEMOLLE ─────────────────────────────────────────────────
   La stessa nota si scrive Fa# o Solb, e non è indifferente: dipende dalla
   tonalità. In Mi maggiore si scrive Fa#, in Fa maggiore si scrive Sib. La
   regola qui è quella dei musicisti: si guarda la tonalità di ARRIVO e si usa
   la grafia che le appartiene. Scrivere «La#» in una canzone in Fa è
   sbagliato anche se il tasto del pianoforte è lo stesso. */

var ACCORDI = (function () {

  /* Le dodici note. L'indice è il numero di semitoni da Do. */
  var IT_DIESIS = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];
  var IT_BEMOLLE = ['Do', 'Reb', 'Re', 'Mib', 'Mi', 'Fa', 'Solb', 'Sol', 'Lab', 'La', 'Sib', 'Si'];
  var EN_DIESIS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  var EN_BEMOLLE = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

  /* Quali tonalità si scrivono coi bemolle. È la lista dei musicisti, non una
     regola inventata: Fa, Sib, Mib, Lab, Reb, Solb (e le loro minori). */
  var TONALITA_BEMOLLE = [5, 10, 3, 8, 1, 6];

  /* Il nome della nota, in tutte le grafie che si incontrano. Si mettono le
     più lunghe prima, o «Do» mangerebbe la «D» di «Do#» — no, peggio: «Sol»
     verrebbe letto come «So»+«l». L'ordine conta. */
  var NOMI = [
    ['Sol', 7], ['La', 9], ['Si', 11], ['Do', 0], ['Re', 2], ['Mi', 4], ['Fa', 5],
    ['A', 9], ['B', 11], ['C', 0], ['D', 2], ['E', 4], ['F', 5], ['G', 7]
  ];

  /* Un accordo: nome della nota, alterazione, tutto il resto (m, 7, sus4,
     maj7, dim…), ed eventualmente un basso dopo la barra (Do/Mi).
     Il «resto» non si tocca: si sposta solo la nota. */
  function leggiNota(t, da) {
    for (var i = 0; i < NOMI.length; i++) {
      var nome = NOMI[i][0];
      if (t.substr(da, nome.length).toLowerCase() === nome.toLowerCase()) {
        // «Si» va distinto da «Sib» e da «Sol»: si guarda cosa segue
        var dopo = t.charAt(da + nome.length);
        if (nome.length === 2 && nome.toLowerCase() === 'si' && dopo.toLowerCase() === 'b') {
          // Sib: la «b» è l'alterazione, non parte del nome
        }
        var cursore = da + nome.length;
        var alt = 0;
        var segno = t.charAt(cursore);
        if (segno === '#' || segno === '♯') { alt = 1; cursore++; }
        else if (segno === 'b' || segno === '♭') {
          /* Attenzione: la «b» può essere un bemolle o l'inizio del suffisso.
             In pratica dopo una nota una «b» è quasi sempre un bemolle
             («Sib», «Bb»), tranne quando la nota è «B» inglese e quello che
             segue non è un accordo. Si accetta come bemolle. */
          alt = -1; cursore++;
        }
        return { classe: (NOMI[i][1] + alt + 12) % 12, fine: cursore, testo: t.slice(da, cursore) };
      }
    }
    return null;
  }

  /* I suffissi ammessi dopo la nota. Se dopo l'accordo c'è una lettera che non
     appartiene a un suffisso, non era un accordo: era una parola.
     «Mim» è un accordo, «Mia» no. */
  var SUFFISSO = /^(m|min|maj|MAJ|M|dim|aug|sus|add|alt|°|ø|\+|-|\d|[46792]|\(|\)|\/|#|b|♯|♭)*$/;

  function leggiAccordo(parola) {
    var n = leggiNota(parola, 0);
    if (!n) return null;
    var resto = parola.slice(n.fine);

    // il basso dopo la barra è un accordo a sua volta: «Do/Mi»
    var basso = null, coda = resto;
    var barra = resto.indexOf('/');
    if (barra >= 0) {
      var b = leggiNota(resto, barra + 1);
      if (!b || b.fine !== resto.length) return null;   // «Do/qualcosa» non è un accordo
      basso = b;
      coda = resto.slice(0, barra);
    }
    if (!SUFFISSO.test(coda)) return null;
    return { nota: n, suffisso: coda, basso: basso };
  }

  /* Una riga è «di accordi» se quello che contiene sono accordi e spazi.
     Bastano due parole normali per farla considerare testo: una riga di
     accordi non contiene parole normali, mai.
     Le righe vuote non sono di accordi (non c'è niente da trasportare) ma non
     interrompono niente. */
  function rigaDiAccordi(riga) {
    var parole = riga.trim().split(/\s+/).filter(function (p) { return p.length; });
    if (!parole.length) return false;
    var accordi = 0;
    for (var i = 0; i < parole.length; i++) {
      // i segni di ripetizione e le stanghette non contano né a favore né contro
      if (/^[|:%\-–—.,()\[\]]+$/.test(parole[i])) continue;
      if (leggiAccordo(parole[i])) accordi++;
      else return false;
    }
    return accordi > 0;
  }

  function scrivi(classe, notazione, tonalitaArrivo) {
    var bemolle = TONALITA_BEMOLLE.indexOf(((tonalitaArrivo % 12) + 12) % 12) >= 0;
    var tavola = notazione === 'en'
      ? (bemolle ? EN_BEMOLLE : EN_DIESIS)
      : (bemolle ? IT_BEMOLLE : IT_DIESIS);
    return tavola[((classe % 12) + 12) % 12];
  }

  function trasportaAccordo(parola, semitoni, notazione, tonalitaArrivo) {
    var a = leggiAccordo(parola);
    if (!a) return parola;
    var fuori = scrivi(a.nota.classe + semitoni, notazione, tonalitaArrivo) + a.suffisso;
    if (a.basso) fuori += '/' + scrivi(a.basso.classe + semitoni, notazione, tonalitaArrivo);
    return fuori;
  }

  /* Trasporta una riga TENENDO LE COLONNE. Ogni accordo torna a cominciare
     nella colonna in cui cominciava, se c'è posto; se il precedente si è
     allungato fin lì, lo si spinge di uno spazio — meglio un accordo spostato
     di un carattere che due accordi appiccicati. */
  function trasportaRiga(riga, semitoni, notazione, tonalitaArrivo, allinea) {
    /* Due modi, e la differenza sta in cosa c'è SOTTO.

       Se sotto c'è il testo della canzone, gli accordi devono tornare nella
       colonna esatta in cui erano: stanno sopra la sillaba in cui si cambia, e
       spostarli di due caratteri rende il foglio sbagliato pur lasciandolo
       bello da vedere.

       Se invece la riga sta da sola — un giro armonico, una sequenza — non c'è
       niente da allineare, e conservare le colonne produce buchi: «Do Sol Lam
       Fa» alzato di cinque diventava «Fa Do  Rem Sib», con due spazi dove
       «Sol» era più lungo di «Do». Lì si tengono gli spazi come li ha scritti
       chi legge. */
    if (!allinea) {
      return riga.replace(/\S+/g, function (p) {
        return trasportaAccordo(p, semitoni, notazione, tonalitaArrivo);
      });
    }
    var fuori = '';
    var re = /\S+/g, m;
    while ((m = re.exec(riga)) !== null) {
      var nuovo = trasportaAccordo(m[0], semitoni, notazione, tonalitaArrivo);
      var colonna = m.index;
      if (fuori.length < colonna) {
        fuori += new Array(colonna - fuori.length + 1).join(' ');
      } else if (fuori.length > 0) {
        fuori += ' ';                       // almeno uno spazio fra due accordi
      }
      fuori += nuovo;
    }
    return fuori;
  }

  /* Il testo intero. Le righe di accordi si trasportano, le altre no.
     `semitoni` può essere negativo (si scende). */
  function trasporta(testo, semitoni, opzioni) {
    opzioni = opzioni || {};
    var notazione = opzioni.notazione || 'auto';
    var righe = String(testo).split('\n');

    if (notazione === 'auto') notazione = notazioneDi(testo);

    /* La tonalità di arrivo serve solo a scegliere fra diesis e bemolle: si
       prende dal PRIMO accordo del brano, che nella stragrande maggioranza
       delle canzoni è la tonalità (o la sua relativa). Non è una certezza, è
       la scelta che sbaglia meno spesso. */
    var primo = primaClasse(righe);
    var arrivo = primo === null ? 0 : primo + semitoni;

    /* Do maggiore non ha né diesis né bemolle in chiave, quindi da solo non
       dice come scrivere le note alterate che compaiono lungo la strada. Lì si
       EREDITA la grafia di chi ha scritto il foglio: una canzone in Sib alzata
       di due arriva in Do, e il suo Lab deve diventare Sib, non La#. Prima
       diventava La# — giusto come tasto, sbagliato come scrittura, e chi legge
       lo spartito se ne accorge subito. */
    if (((arrivo % 12) + 12) % 12 === 0 && scrittaCoiBemolle(testo)) arrivo = 5;

    return righe.map(function (r, i) {
      if (!rigaDiAccordi(r)) return r;
      // «sotto c'è del testo da tenere allineato?»
      var sotto = righe[i + 1];
      var allinea = !!(sotto && sotto.trim() && !rigaDiAccordi(sotto));
      return trasportaRiga(r, semitoni, notazione, arrivo, allinea);
    }).join('\n');
  }

  /* Chi ha scritto il foglio usa i bemolle o i diesis? Si contano: è una
     preferenza dichiarata, non da indovinare. */
  function scrittaCoiBemolle(testo) {
    var bem = 0, die = 0;
    String(testo).split('\n').forEach(function (r) {
      if (!rigaDiAccordi(r)) return;
      r.trim().split(/\s+/).forEach(function (p) {
        var a = leggiAccordo(p);
        if (!a) return;
        if (/[b♭]/.test(a.nota.testo)) bem++;
        else if (/[#♯]/.test(a.nota.testo)) die++;
      });
    });
    return bem > die;
  }

  function primaClasse(righe) {
    for (var i = 0; i < righe.length; i++) {
      if (!rigaDiAccordi(righe[i])) continue;
      var parole = righe[i].trim().split(/\s+/);
      for (var j = 0; j < parole.length; j++) {
        var a = leggiAccordo(parole[j]);
        if (a) return a.nota.classe;
      }
    }
    return null;
  }

  /* In quale notazione è scritto: si contano gli accordi che possono essere
     SOLO italiani (Do, Re, Mi, Sol, La, Si) contro quelli solo inglesi. */
  function notazioneDi(testo) {
    var it = 0, en = 0;
    String(testo).split('\n').forEach(function (r) {
      if (!rigaDiAccordi(r)) return;
      r.trim().split(/\s+/).forEach(function (p) {
        if (/^(Do|Re|Mi|Fa|Sol|La|Si)/i.test(p)) it++;
        else if (/^[A-G]/.test(p)) en++;
      });
    });
    return en > it ? 'en' : 'it';
  }

  /* Quanti semitoni ci sono fra due tonalità scritte a mano. */
  function semitoniFra(da, a) {
    var x = leggiNota(String(da).trim(), 0);
    var y = leggiNota(String(a).trim(), 0);
    if (!x || !y) return null;
    return ((y.classe - x.classe) % 12 + 12) % 12;
  }

  /* Il capotasto: chi suona la chitarra spesso non vuole accordi nuovi, vuole
     le STESSE forme più in alto. Mettere il capotasto al tasto N fa salire di
     N semitoni, quindi per suonare una canzone alzata di N si tiene il
     capotasto al tasto N e si suonano le posizioni di prima.
     Sopra il settimo tasto non ha senso: si scende all'ottava sotto. */
  function capotasto(semitoni) {
    var n = ((semitoni % 12) + 12) % 12;
    return n === 0 ? null : n;
  }

  return {
    trasporta: trasporta,
    trasportaAccordo: trasportaAccordo,
    leggiAccordo: leggiAccordo,
    rigaDiAccordi: rigaDiAccordi,
    notazioneDi: notazioneDi,
    semitoniFra: semitoniFra,
    capotasto: capotasto,
    scrivi: scrivi,
    IT_DIESIS: IT_DIESIS,
    EN_DIESIS: EN_DIESIS
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = ACCORDI;
