# Tonalità

Strumento web 100% client-side per trovare **a orecchio** la tonalità di un brano.
Carichi un file audio, lo ascolti e provi note e accordi sopra l'audio finché
non senti il centro tonale. Nessun riconoscimento automatico, nessuna AI, nessun backend.

**Live:** https://simonecastellan.com/tonalita/

## Funzioni
- **Carica audio** locale (mp3, wav, aiff, flac, m4a, ogg) — niente upload, resta sul dispositivo.
- **Player** minimale: play/pausa, barra di avanzamento e volume. Audio sempre a velocità 1×.
- **Tastiera** virtuale Web Audio (oscillatore sinusoidale puro), un'ottava Do→Si.
- **Drone in hold (default)**: cliccando una nota questa resta a suonare; cliccando un'altra
  si sostituisce, ricliccando la stessa si spegne. Suona sempre **una nota singola**.
- **Maggiore / Minore**: solo **visualizzazione** — evidenziano in tenue le note dell'accordo
  (3ª e 5ª) rispetto alla nota suonata. Nessun accordo in audio.
- **Tonalità probabile**: pesa ogni nota in base a **quanto a lungo la tieni** (più la tieni,
  più conta — di solito è la fondamentale) e, con il profilo di Krumhansl-Schmuckler
  (24 candidati maggiori/minori), mostra sotto la tonalità più probabile con una percentuale
  di confidenza, aggiornata in tempo reale mentre suoni. Stima statistica dalle tue scelte,
  non dall'audio. "azzera" ripulisce il conteggio (resettato anche a ogni nuovo brano).
- **Ottava −/+** (da 2 a 6): cambia l'altezza reale, la tastiera resta uguale.

## Uso tipico
1. Carica il brano e fai play. 2. Clicca una nota: senti il drone sopra il brano.
3. Cambia nota finché trovi il centro tonale. 4. Passa a Maggiore/Minore per confermare. 5. Trovi la tonalità.

## Tecnica
HTML/CSS/JS vanilla, nessuna dipendenza. Funziona aprendo `index.html` in locale.
Audio via Web Audio API con inviluppo morbido (attacco/release) per evitare click.

## Stile
Minimale monocromatico, coerente con [simonecastellan.com](https://simonecastellan.com).

Designed and built by Simone Castellan.
