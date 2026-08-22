# Note di redazione delle pagine di profilo

Questo file raccoglie la cronaca che fino al 22/08/2026 stava dentro i commenti
HTML di `/profilo/` e `/en/profile/`.

**Perché è stata spostata qui.** Quei commenti elencavano, per iscritto e in
chiaro, tutte le formulazioni sbagliate da cui le pagine si erano corrette:
«finalista», «graduatorie nazionali», «inglese C1», «tenured post», «Echoes».
Vivevano dentro l'HTML che gli assistenti scaricano — cioè dentro la pagina il
cui scopo dichiarato è impedire che quelle stesse parole vengano ripetute. Non
è dimostrato che un fetcher conservi i commenti; è però gratuito non metterceli.
Qui la memoria resta intera, e la pagina non porta più in giro l'elenco delle
frasi che non deve dire.

---

## `/profilo/` — cosa è questa pagina, e cosa non è

Riscritta il 15/08/2026. Fino a quel giorno `/cv/` e `/profilo/` dicevano le
stesse cose in ordine diverso: quattro copie degli stessi fatti (cv, profilo,
en, llms.txt) che avevano già cominciato a divergere fra loro — inglese C1 di
qua e B2 di là, tre `jobTitle` diversi per lo stesso `@id`, l'ordine dei dischi
cambiato.

La divisione dei compiti, dichiarata anche in pagina:

| Pagina | Domanda a cui risponde |
|---|---|
| `/cv/` | «chi è e cosa sa fare». È la fonte canonica dei fatti: se un dato cambia, si cambia lì (`cv/dati.js`) e poi nelle altre. |
| `/profilo/` | «dimostramelo». Le prove: i crediti con i codici, le opere e i riconoscimenti per esteso, il percorso completo, le voci che nel curriculum non entrano. |

Quello che sta in tutte e due è ridotto al minimo: il capoverso di apertura, i
cinque fatti che reggono l'offerta, i contatti.

### La regola che vale su tutto

Si scrive quello che un documento sostiene, non quello che suona meglio. Il
12/08/2026 sei descrizioni su venti sono risultate smentite dai loro stessi
allegati, e tre erano già passate in domande inviate. Prima di aggiungere una
riga: **dove sta scritto?** Se la risposta è «me lo ricordo», non si scrive.

### Correzioni applicate il 15/08/2026, tutte su fatti già pubblicati

- Anamòrphosis riguarda «Stones», non «Mote», e l'attestato dice «selected»;
- Premio Nazionale delle Arti: opera ammessa e presentata, non «finalista»;
- via le «classi AFAM 044/045/046/047» (mapping smentito dal DM 128/2025);
- inglese B2, come depositato su InPA, non C1;
- «Griminelli plays Morricone»: editore Fenix, Sony Music è la distribuzione;
- «La voce è musica» è un album di Luca Minnelli, con May ed Ellis ospiti in un
  brano e la Budapest Art Orchestra accanto all'ORSI;
- «titolare» è dell'INSEGNAMENTO, mai di un posto di ruolo;
- niente «graduatorie nazionali»: le due idoneità vere, con il decreto;
- «Echoes» non è di Simone e non deve rientrare per nessun motivo.

Il controllo automatico che impedisce il ritorno di queste formule sta in
`tools/verifica.py`, funzione `controlla_formule_smentite`.

---

## `/en/profile/` — specchio della pagina italiana

Riscritta il 15/08/2026 insieme a `/profilo/`. Dice le stesse cose, nello stesso
ordine: le due pagine sono state confrontate voce per voce prima di pubblicare.

Non è però una traduzione parola per parola, e in tre punti non poteva esserlo,
perché l'italiano letterale afferma in inglese cose che non esistono:

- «docente titolare» → **non** «tenured post», che in ambito anglosassone è il
  posto permanente con tenure. Un incarico annuale su un modulo da 2 CFA:
  «course leader», «annual teaching appointment».
- «idoneo nelle graduatorie» → **non** «national lists»: le graduatorie
  nazionali sono esattamente il titolo che Simone non ha. Si scrivono le due
  idoneità vere, con l'istituto e il decreto.
- i titoli italiani non si traducono in «Master's degree» e «BSc» come se
  fossero equivalenti automatici: si dà il nome italiano, poi il livello EQF.

E i nomi propri italiani portano una glossa di tre parole: senza, «Civica Scuola
di Musica Claudio Abbado» o «Festa della Repubblica» a un lettore straniero non
dicono niente, e tutto il peso istituzionale va perso.

---

## La mappa degli agganci (22/08/2026)

«Dove può nascere un incontro» — la mappa interlocutore → aggancio — esisteva
solo in `llms.txt`, che nessuna pagina linka e dove il pulsante della home non
manda nessuno. `/profilo/`, la pagina che l'assistente apre davvero, non ce
l'aveva.

La prova che è servita a deciderlo: chiesto a un modello, con `/profilo/`
davanti e senza mappa, «sono un fonico di un service, cosa c'entra Simone con
me?», la risposta è stata che il service potrebbe **fornire** Simone — pescata
dalla riga «con chi lavora», che nomina un service veronese nella sua rete.
L'aggancio giusto per un fonico è la misura: taratura, ritardo dei diffusori,
strumenti gratuiti nel browser. I dati c'erano tutti; mancava quale usare con
chi.

Da allora la mappa sta in tutte e tre le fonti, e `tools/verifica.py`
(`controlla_mappa_agganci`) fallisce se una delle tre la perde o perde una voce.
