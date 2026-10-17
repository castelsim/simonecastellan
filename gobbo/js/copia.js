// Copia automatica della libreria in una cartella scelta dall'utente
// (Documenti, iCloud Drive…). Nasce il 01/10/2026: la libreria vive dentro
// Chrome, e se qualcuno cancella i dati del sito o cambia Mac la perde. Con
// la cartella, una copia c'è sempre, aggiornata da sola.
//
// Nella cartella:
//   gobbo-libreria.json              l'ultima versione (stesso formato del backup:
//                                    si ricarica con «Importa un backup»)
//   storico/gobbo-AAAA-MM-GG.json     una copia al giorno, ultime 30
//   storico/gobbo-prima-di-sostituire-AAAA-MM-GG-HHMM.json
//                                    la libreria subito prima di «Ricomincia da zero»
//                                    o «sostituisci tutto» (non si cancella mai da sola)
//   storico/gobbo-libreria-prima-AAAA-MM-GG-HHMM.json
//                                    la libreria diversa che c'era nella cartella
//                                    quando la si è scelta (non si cancella mai da sola)
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

// AAAA-MM-GG-HHMM nell'ora di questo Mac: è l'operatore che lo legge.
function adesso() {
  const d = new Date();
  const due = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}-${due(d.getHours())}${due(d.getMinutes())}`;
}

// Un nome che nello storico non c'è ancora: una copia datata non si sovrascrive mai.
async function nomeLibero(storico, radice) {
  for (let i = 1; ; i++) {
    const nome = `${radice}${i > 1 ? '-' + i : ''}.json`;
    try { await storico.getFileHandle(nome); } catch (e) { if (e?.name === 'NotFoundError') return nome; throw e; }
  }
}

// Nella cartella c'è già un gobbo-libreria.json con qualcosa che la libreria
// di qui non ha (brani o scalette assenti o più recenti)? Verifica 06/10/2026:
// sceglierla da un gobbo vuoto la sovrascriveva senza traccia.
function haDiPiu(testo, qui) {
  let file;
  try { file = JSON.parse(testo); } catch { return true; }
  const coperto = (elenco, locali, data) => {
    const perId = new Map(locali.map(x => [x.id, x]));
    return (elenco ?? []).every(x => perId.has(x?.id) && String(perId.get(x.id)[data] ?? '') >= String(x[data] ?? ''));
  };
  return !(coperto(file?.brani, qui.brani, 'aggiornato') && coperto(file?.scalette, qui.scalette, 'aggiornata'));
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
      const dati = await archivio.esporta();
      const testo = JSON.stringify(dati, null, 1);
      await scriviFile(cartella, NOME, testo);
      // Il file è di questo gobbo: all'avvio, se lo ritrova identico, non c'è niente da allarmare.
      await archivio.scrivi('ultimaScritta', dati.esportato).catch(() => {});
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

  // Prima di scrivere in una cartella appena scelta (o riconfermata): se il suo
  // gobbo-libreria.json ha cose che qui non ci sono, lo si copia in storico/ e
  // lo si dice. Se non si riesce a leggerlo o a copiarlo, non si scrive.
  async function mettiDaParte(h) {
    let testo;
    try { testo = await (await (await h.getFileHandle(NOME)).getFile()).text(); }
    catch (e) { if (e?.name === 'NotFoundError') return; throw e; }
    // Il file l'ha scritto questo stesso gobbo e nessun altro dopo: le differenze con la
    // libreria di adesso sono cambiamenti fatti qui (un brano eliminato e la regia chiusa
    // prima della copia successiva), non il lavoro di un altro Mac o indirizzo.
    try {
      const sua = await archivio.leggi('ultimaScritta').catch(() => null);
      if (sua && JSON.parse(testo).esportato === sua) return;
    } catch { /* illeggibile: si controlla sotto */ }
    if (!haDiPiu(testo, await archivio.esporta())) return;
    const storico = await h.getDirectoryHandle(STORICO, { create: true });
    const nome = await nomeLibero(storico, `gobbo-libreria-prima-${adesso()}`);
    await scriviFile(storico, nome, testo);
    let descrizione = 'una libreria diversa da questa';
    try {
      const f = JSON.parse(testo);
      const data = f.esportato ? new Date(f.esportato).toLocaleString('it-IT', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : null;
      descrizione = `una libreria con ${f.brani?.length ?? 0} brani${data ? ` (del ${data})` : ''}, diversa da questa`;
    } catch { /* file non leggibile: resta la descrizione generica */ }
    avvisi.mostra('cartella-prima', `Nella cartella${h.name ? ` «${h.name}»` : ''} c'era ${descrizione}: l'ho messa da parte in storico/${nome}. Per riaverla: Impostazioni → «Importa un backup» → scegli quel file.`,
      { tipo: 'info', azione: { etichetta: 'Ho capito', fai: () => avvisi.togli('cartella-prima') } });
  }

  // Copia datata che non verrà mai sovrascritta né potata, scritta e chiusa
  // prima di rispondere: la usano «Ricomincia da zero» e «sostituisci tutto».
  // Risponde il percorso scritto, o null se la copia automatica non è attiva.
  async function copiaDatata() {
    if (!cartella) return null;
    const h = cartella;
    let percorso = null;
    const lavoro = fila.then(async () => {
      const storico = await h.getDirectoryHandle(STORICO, { create: true });
      const nome = await nomeLibero(storico, `gobbo-prima-di-sostituire-${adesso()}`);
      await scriviFile(storico, nome, JSON.stringify(await archivio.esporta(), null, 1));
      percorso = `${h.name ? `«${h.name}», ` : ''}${STORICO}/${nome}`;
    });
    fila = lavoro.catch(() => {});
    await lavoro;
    return percorso;
  }

  async function usaCartella(h, { ricorda = true } = {}) {
    if ((await permesso(h, true)) !== 'granted') throw new Error('Chrome non ha dato il permesso di scrivere nella cartella');
    await mettiDaParte(h);
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
      await mettiDaParte(salvata);
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
      // Permesso già valido all'avvio (permanente, o stessa sessione): lo stesso
      // controllo di usaCartella e riattiva, una volta per sessione (avvia gira una
      // volta sola). Un altro indirizzo o un altro Mac può aver scritto nella
      // cartella una libreria diversa: prima di riscriverla, la si mette da parte.
      try { await mettiDaParte(salvata); }
      catch (e) {
        cartella = null;
        avvisi.mostra('cartella', `La copia automatica nella cartella «${salvata.name}» non parte: non riesco a controllare cosa c'è dentro (${e.message}).`,
          { azione: { etichetta: 'Riprova', fai: riattiva } });
        imposta('errore');
        return;
      }
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
    avvia, scegli, usaCartella, smetti, riattiva, segnala, copiaOra, copiaDatata,
    stato: () => stato,
    nome: () => (cartella ?? salvata)?.name ?? null,
    ultima: () => ultima,
    scritture: () => scritture,
  };
}
