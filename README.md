# simonecastellan.com

Sito personale di Simone Castellan — tecnologia applicata al suono.

Home minimale in stile "Ask AI": il pulsante apre ChatGPT con **una riga** che invita ad aprire
`/profilo`, dove l'assistente trova le istruzioni per fare da mediatore («curriculum dinamico»).
La home resta volutamente nuda: il nome, un pulsante, tre contatti, e in fondo la riga degli
strumenti e due parole per non lasciare il profilo irraggiungibile.

## Pagine

| Indirizzo | Cos'è |
|---|---|
| `/` | home «Ask AI» |
| `/profilo/` | profilo esteso, fonte di verità dei contenuti (per umani e AI) |
| `/en/profile/` | stesso profilo in inglese |
| `/cv/` | curriculum in una pagina, stampabile in PDF dal browser |
| `/tienimi-presente/` | l'uscita leggera: due righe (anche anonime) che finiscono nel foglio delle statistiche |
| `/privacy/` | cosa raccoglie il sito (nessun cookie, statistiche anonime) |
| `/BDG2029/` | «Dentro Bitcoin», installazione per Bassano Capitale della Cultura 2029 |
| `/audio-mp3/` `/bpm/` `/tonalita/` `/qrcode/` | piccoli strumenti web |

## Come sta insieme

- **Il prompt è una riga sola.** Il visitatore se lo vede comparire davanti nella casella
  dell'assistente: deve poterlo leggere e capire in un secondo. Le istruzioni per l'AI stanno in
  `/profilo`, che è il loro posto. (Fino al 28/07 nell'URL viaggiavano 5.000 caratteri di
  direttive in chiaro, comprese frasi che a un estraneo suonavano come un trucco.)
- **Il contenuto non entra mai nell'URL.** `index.html` passa solo il link; il profilo vive in
  `/profilo/` e in `llms.txt`. Quando cambia, vanno aggiornati insieme: `/profilo/`, `llms.txt`,
  `/en/profile/` e `/cv/`.
- **`var V`** è la versione del profilo: bumparla quando il contenuto cambia, così le AI non
  rispondono da una copia vecchia in cache.
- **Statistiche**: `track.js`, una sola copia per tutte le pagine. Gli assistenti AI non eseguono
  JavaScript, quindi lì non compaiono: il segnale che il sistema funziona è il rapporto fra i clic
  sul pulsante e i messaggi che arrivano firmati `— dal profilo AI di simonecastellan.com`.
- **Il cerchio si chiude con `/tienimi-presente/`**: chi non è pronto a scrivere su WhatsApp lascia
  due righe (contatto facoltativo) che finiscono come riga `messaggio` nello stesso foglio delle
  statistiche, via `track.send`. La Connection Card la offre come alternativa; il modulo ha un
  campo-esca anti-bot e `verifica.py` controlla che nessun pezzo del giro sparisca.

## Quali assistenti, e perché solo ChatGPT

Verificato il 29/07/2026 sui file ufficiali di associazione app↔dominio e provando i link dal vivo:

| | Apre l'app (iOS / Android) | Riceve il prompt | Perché non è in home |
|---|---|---|---|
| **ChatGPT** | sì (`?q=`) / sì | sì | — è quello attivo |
| Claude | sì (`/new`) / sì | sì | mostra una fascia rossa di avviso sicurezza su ogni prompt che arriva da un link esterno |
| Grok | sì (`/*`) / sì | sì | chiede login e banner cookie prima di rispondere |
| Perplexity | sì (`/search`) / sì | **no** | col profilo nell'URL risponde `414 Request-URI Too Large`; con l'URL corto non aprirebbe il link |
| Gemini | — | no | non accetta alcun prompt dall'indirizzo |

Claude e Grok restano definiti in `index.html`, pronti: per accenderli basta cambiare il filtro
`AIS_VISIBLE`. Perplexity no — `tools/verifica.py` fallisce apposta se qualcuno lo rimette.

## Prima di pubblicare

```sh
python3 tools/verifica.py
```

Controlla che il prompt sia rimasto breve e pulito, che il profilo non sia tornato dentro la home,
che Perplexity resti spento, che nessuna pagina resti orfana, che la firma sui contatti sia ancora
richiesta, e che sitemap, JSON-LD e hreflang siano coerenti.

Sito statico servito via GitHub Pages (`CNAME` → simonecastellan.com).
