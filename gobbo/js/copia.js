// Copia automatica della libreria in una cartella scelta dall'utente
// (Documenti, iCloud Drive…). Nasce il 01/10/2026: la libreria vive dentro
// Chrome, e se qualcuno cancella i dati del sito o cambia Mac la perde. Con
// la cartella, una copia c'è sempre, aggiornata da sola.
//
// Nella cartella:
//   gobbo-libreria.json              l'ultima versione (stesso formato del backup:
//                                    si ricarica con «Importa un backup»)
//   storico/gobbo-AAAA-MM-GG.json     una copia al giorno, ultime 30
//
// Si scrive dopo 1,5 secondi di calma da un cambiamento vero (brani, scalette,
// impostazioni): i tasti del concerto non scrivono mai sul disco.

const NOME = 'gobbo-libreria.json';
const STORICO = 'storico';
const GIORNI_TENUTI = 30;
const PAUSA = 1500;
const DEL_GOBBO = /^gobbo-\d{4}-\d{2}-\d{2}\.json$/;

async function scriviFile(cartella, nome, testo) {
  const file = await cartella.getFileHandle(nome, { create: true });
  const scrittura = await file.createWritable();     // si sostituisce tutto alla chiusura: mai un file a metà
  await scrittura.write(testo);
  await scrittura.close();
}

async function pota(storico) {
  const nomi = [];
  for await (const [nome, voce] of storico.entries()) if (voce.kind === 'file' && DEL_GOBBO.test(nome)) nomi.push(nome);
  nomi.sort();
  for (const nome of nomi.slice(0, Math.max(0, nomi.length - GIORNI_TENUTI))) await storico.removeEntry(nome);
}

async function permesso(cartella, chiedi) {
  if (!cartella.queryPermission) return 'granted';
  let p = await cartella.queryPermission({ mode: 'readwrite' });
  if (p !== 'granted' && chiedi) p = await cartella.requestPermission({ mode: 'readwrite' });
  return p;
}

// stato(): 'spenta' | 'attiva' | 'in-pausa' (Chrome vuole una conferma) | 'errore'
export function creaCopia({ archivio, avvisi, suCambio = () => {} }) {
  let cartella = null;          // in uso
  let salvata = null;           // ricordata, magari in attesa di permesso
  let stato = 'spenta';
  let ultima = null;
  let scritture = 0;
  let timer = null;
  let fila = Promise.resolve();

  const imposta = s => { stato = s; suCambio(); };

  async function scrivi() {
    if (!cartella) return;
    try {
      const testo = JSON.stringify(await archivio.esporta(), null, 1);
      await scriviFile(cartella, NOME, testo);
      const storico = await cartella.getDirectoryHandle(STORICO, { create: true });
      await scriviFile(storico, `gobbo-${new Date().toISOString().slice(0, 10)}.json`, testo);
      await pota(storico);
      ultima = new Date();
      scritture++;
      await archivio.scrivi('ultimoBackup', ultima.toISOString()).catch(() => {});
      avvisi.togli('cartella');
      imposta('attiva');
    } catch (e) {
      avvisi.mostra('cartella', `La copia nella cartella «${cartella.name}» non riesce (${e.message}).`,
        { azione: { etichetta: 'Riprova', fai: () => copiaOra() } });
      imposta('errore');
    }
  }

  function copiaOra() {
    fila = fila.then(scrivi);
    return fila;
  }

  function segnala() {
    if (!cartella) return;
    clearTimeout(timer);
    timer = setTimeout(copiaOra, PAUSA);
  }

  async function usaCartella(h, { ricorda = true } = {}) {
    if ((await permesso(h, true)) !== 'granted') throw new Error('Chrome non ha dato il permesso di scrivere nella cartella');
    cartella = salvata = h;
    if (ricorda) await archivio.scrivi('cartella', h);
    avvisi.togli('cartella');
    imposta('attiva');
    await copiaOra();
  }

  async function scegli() {
    if (!('showDirectoryPicker' in window)) {
      avvisi.mostra('cartella', 'Questo browser non permette di scegliere una cartella: serve Google Chrome.');
      return;
    }
    let h;
    try { h = await window.showDirectoryPicker({ id: 'gobbo', mode: 'readwrite', startIn: 'documents' }); }
    catch { return; }                                  // scelta annullata
    try { await usaCartella(h); } catch (e) { avvisi.mostra('cartella', e.message); }
  }

  // Si spegne subito, al clic; ricordarselo nell'archivio viene dopo.
  async function smetti() {
    clearTimeout(timer);
    cartella = salvata = null;
    avvisi.togli('cartella');
    imposta('spenta');
    await archivio.scrivi('cartella', null).catch(() => {});
  }

  // Chrome può chiedere di riconfermare la cartella dopo un riavvio: serve un
  // clic (un gesto dell'utente), quindi si chiede con un avviso, non da soli.
  async function riattiva() {
    if (!salvata) return;
    try {
      if ((await permesso(salvata, true)) !== 'granted') return;
      cartella = salvata;
      avvisi.togli('cartella');
      imposta('attiva');
      await copiaOra();
    } catch (e) { avvisi.mostra('cartella', e.message); }
  }

  async function avvia(h) {
    salvata = h ?? (await archivio.leggi('cartella').catch(() => null));
    if (!salvata) { imposta('spenta'); return; }
    if ((await permesso(salvata, false).catch(() => 'denied')) === 'granted') {
      cartella = salvata;
      imposta('attiva');
      return;
    }
    cartella = null;
    avvisi.mostra('cartella', `La copia automatica nella cartella «${salvata.name}» è in pausa: Chrome chiede di riconfermarla.`,
      { tipo: 'info', azione: { etichetta: 'Riattiva', fai: riattiva } });
    imposta('in-pausa');
  }

  return {
    avvia, scegli, usaCartella, smetti, riattiva, segnala, copiaOra,
    stato: () => stato,
    nome: () => (cartella ?? salvata)?.name ?? null,
    ultima: () => ultima,
    scritture: () => scritture,
  };
}
