# Prove che restano a mano

Quello che `tools/prove.sh` e `tools/regressione.html` **non possono provare**, per
com'è fatto il posto in cui girano: un Chrome solo, su un Mac, senza microfono
davanti a una cassa e senza un dito su un vetro.

Nessuna di queste prove è facoltativa perché è noiosa. Sono tutte cose che sono
già andate storte una volta, o che vanno storte per prime quando cambia qualcosa:
il suono che non parte finché non lo tocchi, il microfono che chiede il permesso
e non lo richiede più, la tastiera di iOS che ingrandisce la pagina da sola.

**Come si legge**: ogni riga è un gesto e quello che deve succedere. Se non
succede, è un guasto — anche se il verdetto della regressione era verde.

**Quando si fanno**: tutte, prima di una pubblicazione che tocca audio,
microfono, moduli o impaginazione. Solo quelle del riquadro toccato, dopo una
modifica piccola.

---

## 1. iPhone, Safari — il suono

Serve un iPhone vero. Il simulatore e il Chrome del Mac hanno regole diverse
sull'audio, ed è proprio lì che iOS è più severo che altrove.

1. Apri `simonecastellan.com/rumore-rosa/` **con l'interruttore del silenzioso
   inserito** (la levetta rossa a lato) e premi `PLAY` → guarda cosa succede.
   iOS zittisce l'audio dei siti quando il telefono è in silenzioso: se resta
   muto, il pulsante non deve restare acceso come se stesse suonando, e la
   pagina deve dire di togliere il silenzioso. Un tecnico che tara una sala col
   telefono in silenzioso pensa che sia rotta la cassa.
2. Sempre in `rumore-rosa/`, premi `PLAY` **come primo tocco sulla pagina** → il
   suono deve partire subito, non al secondo tocco. Su iOS l'audio si sblocca
   solo dentro un gesto: se lo sblocco è legato al tocco sbagliato, il primo
   PLAY resta muto e sembra un guasto della cassa.
3. Con il rumore in corso, **premi il tasto di spegnimento** e riaccendi lo
   schermo → il suono deve fermarsi e il pulsante deve tornare a dire `PLAY`,
   non restare acceso su un suono che non c'è.
4. Con il rumore in corso, **arriva una telefonata** (fattela fare, o prova con
   una sveglia) → dopo la telefonata il suono deve poter ripartire premendo
   `PLAY`, senza ricaricare la pagina.
5. Con il rumore in corso, **collega delle cuffie Bluetooth** → il suono deve
   passare alle cuffie senza fermarsi e senza cambiare di volume da solo.
6. In `tonalita/`, premi `▶` e alza il volume con i tasti fisici → deve muoversi
   il volume dei contenuti, non quello della suoneria.

## 2. Il microfono vero

Il microfono qui non si può fingere: `tools/prova-dsp.js` prova i conti, non la
catena che porta il suono dentro i conti.

7. Apri `tara-impianto/` su iPhone e premi `Misura` → deve comparire la
   richiesta di permesso del microfono. Concedila: la misura deve partire e la
   curva deve comparire entro i 10 secondi scelti.
8. **Nega** il permesso (Impostazioni → Safari → Microfono → Nega, poi ricarica)
   e premi `Misura` → deve comparire una spiegazione in italiano di cosa fare,
   non una pagina che resta ferma o un errore in inglese.
9. Fai la misura con la cassa **a 1 metro** e poi **a 3 metri**: il ritardo
   mostrato deve crescere di circa 6 ms (il suono fa 34 cm al millisecondo). Se
   non cambia, la misura sta guardando qualcosa che non è il suono che esce.
10. Fai la misura **con il telefono in mano che si muove** → la coerenza deve
    crollare e lo strumento deve dire che non si fida, invece di dare consigli.
11. Fai la misura **in silenzio, senza far suonare niente** → deve dire che non
    sente niente, non inventare una curva.
12. Apri `tonalita/`, premi `Ascolta la musica`, fai suonare un giro di
    accordi in Do da una cassa → deve arrivare a Do maggiore. Poi **spegni la
    musica e lascia solo il rumore della stanza** → deve dire che non sa, non
    tirare a indovinare.
13. `tara-impianto/` con **cuffie con microfono** collegate: nell'elenco degli
    ingressi deve comparire il microfono delle cuffie, e sceglierlo deve
    cambiare davvero la misura.

## 3. La tastiera di iOS

Su iOS la tastiera non è un pezzo di pagina: entra da sotto, copre, e se un
campo ha il testo più piccolo di 16 px il sistema **ingrandisce la pagina da
solo** e non la rimpicciolisce più.

14. In `bpm/`, tocca il campo dei BPM → deve comparire la **tastiera numerica**,
    non quella con le lettere.
15. Stesso campo: mentre scrivi, **la pagina non deve ingrandirsi**. Se dopo il
    tocco il testo del sito è più grande di prima, c'è un campo sotto i 16 px.
16. In `link-whatsapp/`, tocca il campo del numero → tastiera numerica, e il
    campo deve restare **sopra** la tastiera, visibile mentre scrivi.
17. In `tienimi-presente/`, riempi il modulo fino in fondo con la tastiera
    aperta → il pulsante di invio deve essere raggiungibile senza chiudere la
    tastiera a mano.
18. In `conta-caratteri/`, incolla un testo lungo dagli appunti (tocco lungo →
    Incolla) → il contatore deve aggiornarsi subito, non solo quando scrivi.

## 4. La rotazione

19. Apri `tara-impianto/`, fai una misura, **gira il telefono di lato** → il
    grafico deve ridisegnarsi alla larghezza nuova, senza restare tagliato e
    senza perdere la misura fatta.
20. Gira il telefono **mentre** la misura è in corso → la misura deve arrivare
    in fondo lo stesso.
21. `qrcode/`: genera un QR, gira il telefono → il QR deve restare quadrato e
    dentro lo schermo, non sbordare.
22. Gira il telefono in `tools/` e in `/profilo/` → nessuna riga deve uscire di
    lato (è lo stesso controllo che la regressione fa a 390 px, ma qui in
    orizzontale, che nessuno prova mai).

## 5. File, fotocamera, condivisione (iPhone e Android)

23. In `posso-pubblicarlo/`, tocca il selettore dei file → devono comparire
    Foto, Scatta foto e Sfoglia. Scatta una foto sul momento: deve essere
    accettata come le altre.
24. In `comprimi-immagini/`, carica una foto **HEIC** appena scattata da iPhone
    → deve funzionare o dire chiaramente che quel formato no. Non deve restare
    ferma senza dire niente.
25. In `fotogramma/`, carica un video girato con l'iPhone (HEVC) → l'anteprima
    deve muoversi e il fotogramma deve uscire.
26. In `audio-mp3/`, converti un file e tocca il pulsante di scaricamento → su
    iPhone il file deve finire in File o partire la condivisione. Verifica che
    il file **si apra davvero**, non che sia solo comparso.
27. In `comprimi-video/`, avvia una compressione e **blocca lo schermo** per
    mezzo minuto → al ritorno deve essere finita o ripartita, non piantata a
    metà per sempre.
28. In `link-utm/` e `link-whatsapp/`, tocca il pulsante che copia → incolla in
    Note: deve arrivare quello che c'è scritto. Safari copia solo dentro il
    gesto del dito, e un `await` messo prima rompe la copia solo su iOS.

## 6. Gli altri browser

La regressione gira su un Chrome solo. Questi tre non sono Chrome, e ognuno ha
la sua rogna.

29. **Safari su Mac** — apri `tara-impianto/`, `tonalita/`, `rumore-rosa/`,
    `audio-mp3/`: ogni strumento che tocca l'audio deve funzionare. Safari ha
    un `AudioContext` più severo e nomi di codec diversi.
30. **Safari su Mac** — Sviluppo → Mostra la console, poi apri i quattro
    strumenti sopra: la console deve restare senza errori rossi.
31. **Firefox** — apri i quattro strumenti audio: Firefox non ha gli stessi
    codec di Chrome. Se un formato non è supportato, deve dirlo, non fallire in
    silenzio.
32. **Firefox** — apri `comprimi-pdf/` e `comprimi-video/`: sono i due che
    lavorano con WebAssembly, ed è lì che i motori si comportano diversamente.
33. **Edge** — apri `/`, `/profilo/`, `/tools/`: basta che l'impaginazione
    regga e i link portino dove devono.
34. **Android, Chrome** — apri `tools/` e prova tre strumenti col dito, in
    piedi, con una mano sola. La regola dei 44 px si misura, ma se un comando è
    scomodo lo si sente solo così.
35. **Android, Chrome** — in `tara-impianto/`, il permesso del microfono e la
    scelta dell'ingresso: Android elenca gli ingressi in un altro ordine.

## 7. Le cose che si vedono solo con gli occhi

36. Apri `/tools/` e guarda le celle: le descrizioni devono stare su una riga o
    due, non una sola cella deve essere alta il doppio delle altre.
37. Apri due strumenti di fila: il titolo, il sottotitolo e il piede devono
    avere lo stesso peso e la stessa distanza. La voce comune si sente
    guardandoli uno dopo l'altro, non uno solo.
38. Metti il telefono **al sole**, o alza la luminosità al massimo, e leggi le
    scritte grigie: il contrasto calcolato dice 4,5:1, ma la carta lucida di
    uno schermo al sole non è quella del calcolo.
39. Stampa `/cv/` (⌘P → PDF): deve venire una pagina pulita, senza i comandi
    del sito e senza tagli a metà riga.
40. Apri `/` con JavaScript spento (Safari → Impostazioni → Avanzate) → devono
    restare visibili il nome, cosa fai e il link a `/profilo/`. È quello che
    vedono i motori di ricerca e le AI che non eseguono script.

---

## Quello che invece è già automatico — non rifarlo a mano

| Cosa | Chi la fa |
|---|---|
| prompt, sitemap, JSON-LD, hreflang, piede, nascosti, rimandi | `tools/verifica.py` |
| titoli e descrizioni degli strumenti | `tools/verifica.py` |
| titoli e descrizioni di **tutte** le pagine | `tools/regressione.html` |
| conti del misuratore (FFT, ritardo, coerenza, consigli) | `tools/prova-dsp.js` |
| riconoscimento della tonalità | `tools/prova-tonalita.js` |
| pagine che rispondono, errori JavaScript all'apertura | `tools/regressione.html` |
| sbordo orizzontale a 390 px | `tools/regressione.html` |
| bersagli sotto i 44 px | `tools/regressione.html` |
| contrasto sotto 4,5:1 contro il fondo vero | `tools/regressione.html` |

Tutto insieme, da riga di comando: `tools/prove.sh`.
