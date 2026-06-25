# Tonalità

Strumento web 100% client-side per trovare **a orecchio** la tonalità di un brano.
Carichi un file audio, lo ascolti e provi note, accordi e scale sopra l'audio finché
non senti il centro tonale. Nessun riconoscimento automatico, nessuna AI, nessun backend.

**Live:** https://simonecastellan.com/tonalita/

## Funzioni
- **Carica audio** locale (mp3, wav, aiff, flac, m4a, ogg) — niente upload, resta sul dispositivo.
- **Player** minimale: play/pausa e volume. Audio sempre a velocità 1×.
- **Tastiera** virtuale Web Audio (oscillatore sinusoidale puro), un'ottava Do→Si.
- **Modalità**: Nota · Maggiore (0-4-7) · Minore (0-3-7).
- **HOLD**: tiene la nota/accordo come drone; nuova nota sostituisce, stessa nota spegne.
- **Stop**: ferma tutto immediatamente, nessun oscillatore appeso.
- **Ottava −/+** (da 2 a 6): cambia l'altezza reale, la tastiera resta uguale.
- **Suona scala**: dall'ultima nota selezionata, maggiore o minore naturale secondo la modalità,
  in **loop** con feedback visivo sui tasti.
- **Tap tempo**: batti il pulsante TAP a ritmo del brano; la scala segue quel tempo.
  Nessun valore numerico mostrato, serve solo a sincronizzare la scala con l'ascolto.

## Uso tipico
1. Carica il brano e fai play. 2. Attiva **Hold** e clicca una nota: senti il drone sopra il brano.
3. Cambia nota finché trovi il centro tonale. 4. Passa ad Accordo Maggiore/Minore.
5. **Suona scala** per verificare se combacia. 6. Trovi la tonalità.

## Tecnica
HTML/CSS/JS vanilla, nessuna dipendenza. Funziona aprendo `index.html` in locale.
Audio via Web Audio API con inviluppo morbido (attacco/release) per evitare click.

## Stile
Minimale monocromatico, coerente con [simonecastellan.com](https://simonecastellan.com).

Designed and built by Simone Castellan.
