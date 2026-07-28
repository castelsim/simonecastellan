# simonecastellan.com

Sito personale di Simone Castellan — tecnico del suono e produttore audio.

Home minimale in stile "Ask AI": i pulsanti aprono ChatGPT, Claude, Grok o Perplexity con un
prompt che fa leggere all'assistente il profilo e lo mette al lavoro come mediatore
(«curriculum dinamico»). Sotto i pulsanti, la home dice comunque in HTML statico chi è Simone e
porta alle pagine leggibili da chiunque — anche senza JavaScript.

## Pagine

| Indirizzo | Cos'è |
|---|---|
| `/` | home «Ask AI» + presentazione statica |
| `/profilo/` | profilo esteso, fonte di verità dei contenuti (per umani e AI) |
| `/en/profile/` | stesso profilo in inglese |
| `/cv/` | curriculum in una pagina, stampabile in PDF dal browser |
| `/privacy/` | cosa raccoglie il sito (nessun cookie, statistiche anonime) |
| `/BDG2029/` | «Dentro Bitcoin», installazione per Bassano Capitale della Cultura 2029 |
| `/audio-mp3/` `/bpm/` `/tonalita/` `/qrcode/` | piccoli strumenti web |

## Come sta insieme

- `llms.txt` è **l'unica copia** del profilo esteso: la home lo carica a runtime
  (`fetch("/llms.txt")`) per costruire i prompt. Non va duplicato dentro `index.html`.
- `index.html` contiene solo un profilo **condensato** (`var PPLX`), usato come riserva se il
  caricamento fallisce e dentro il prompt del pulsante ChatGPT. Quel prompt viaggia in un URL con
  un limite di lunghezza: ogni riga aggiunta va compensata con un taglio.
- `/profilo/` resta la fonte di verità dei contenuti: quando cambia, vanno aggiornati anche
  `llms.txt`, `var PPLX` e la versione inglese.

## Prima di pubblicare

```sh
python3 tools/verifica.py
```

Controlla la lunghezza dell'URL del pulsante ChatGPT, che il profilo non sia stato duplicato,
che la home resti leggibile senza JavaScript, che nessuna pagina resti orfana, e che sitemap,
JSON-LD e hreflang siano coerenti.

Sito statico servito via GitHub Pages (`CNAME` → simonecastellan.com).
