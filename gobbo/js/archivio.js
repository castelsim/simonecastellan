// L'archivio: brani, scalette, impostazioni e versioni, dentro il browser
// (IndexedDB). Niente server, niente rete.
//
// Brano    = { id, titolo, artista, note, testo, creato, aggiornato }
// Scaletta = { id, nome, brani: [id], creata, aggiornata }
// Ogni salvataggio di un brano tiene la versione precedente (ultime 30):
// un testo rovinato si recupera anche il giorno dopo.
//
// Ogni scrittura che non riesce (memoria piena, archivio chiuso) rifiuta la
// promessa con un Error leggibile: la regia lo mostra in un avviso fisso.

const VERSIONE_DB = 1;
const VERSIONI_TENUTE = 30;
// Stato della sessione: non viaggia nei backup.
const SOLO_SESSIONE = new Set(['posizione', 'concerto']);
// La cartella della copia automatica è di questo Mac: non viaggia nei backup.
// 'primaDiSostituire' = { quando, dati }: la libreria com'era prima dell'ultimo
// «Ricomincia da zero» / «sostituisci tutto» / «Ripristina» (una sola, l'ultima).
// Sta qui dentro perché un download non dice se Chrome l'ha salvato davvero;
// non viaggia nei backup (conterrebbe una libreria dentro l'altra).
// 'ultimaScritta' = il campo «esportato» dell'ultimo file scritto da questo gobbo
// nella cartella: serve a riconoscere, all'avvio, un file che è ancora il suo.
const NON_ESPORTATI = new Set([...SOLO_SESSIONE, 'cartella', 'primaDiSostituire', 'ultimaScritta']);
// Scritture che NON sono un cambiamento della libreria: la posizione del
// concerto cambia a ogni tasto, e la copia su disco non deve partire a ogni riga.
// Anche le copie di sicurezza interne: non cambiano la libreria, e la copia in cartella
// non deve riscriversi per loro.
const NON_CAMBIAMENTI = new Set([...NON_ESPORTATI, 'ultimoBackup', 'esempiInseriti']);

const promessa = r => new Promise((ok, ko) => { r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); });

const stessoContenuto = (a, b) => ['titolo', 'artista', 'note', 'testo'].every(k => a[k] === b[k]);

// Mette da parte la versione `prima` di un brano (ultime VERSIONI_TENUTE):
// la usano il salvataggio e l'importazione, così nessun testo sparisce senza traccia.
async function tieniVersione(versioni, prima) {
  versioni.add({ branoId: prima.id, titolo: prima.titolo, artista: prima.artista, note: prima.note, testo: prima.testo, salvato: prima.aggiornato });
  const chiavi = await promessa(versioni.index('brano').getAllKeys(prima.id));
  chiavi.sort((a, b) => a - b);
  for (const k of chiavi.slice(0, Math.max(0, chiavi.length - VERSIONI_TENUTE))) versioni.delete(k);
}

function errore(e) {
  if (e?.name === 'QuotaExceededError') return new Error('Archivio pieno: la memoria del browser è finita. Esporta un backup e libera spazio.');
  return new Error(`Archivio non disponibile (${e?.message || e?.name || 'errore sconosciuto'}). Ricarica la pagina.`);
}

function apriDb(nome) {
  return new Promise((ok, ko) => {
    const q = indexedDB.open(nome, VERSIONE_DB);
    q.onupgradeneeded = () => {
      const db = q.result;
      db.createObjectStore('brani', { keyPath: 'id' });
      db.createObjectStore('scalette', { keyPath: 'id' });
      db.createObjectStore('versioni', { keyPath: 'k', autoIncrement: true }).createIndex('brano', 'branoId');
      db.createObjectStore('impostazioni');
    };
    q.onsuccess = () => ok(q.result);
    q.onerror = () => ko(errore(q.error));
    q.onblocked = () => ko(new Error('Archivio bloccato da un\'altra finestra del gobbo aperta con una versione diversa: chiudila.'));
  });
}

export async function apriArchivio(nome = 'gobbo') {
  const db = await apriDb(nome);
  let chiuso = false;
  db.onversionchange = () => { db.close(); chiuso = true; };
  db.onclose = () => { chiuso = true; };

  function transazione(nomi, modo, lavoro) {
    if (chiuso) return Promise.reject(errore(new Error('archivio chiuso')));
    return new Promise((ok, ko) => {
      let t;
      try { t = db.transaction(nomi, modo); } catch (e) { ko(errore(e)); return; }
      let valore;
      t.oncomplete = () => ok(valore);
      t.onerror = () => ko(errore(t.error));
      t.onabort = () => ko(errore(t.error));
      Promise.resolve().then(() => lavoro(t)).then(v => { valore = v; }, e => {
        try { t.abort(); } catch { /* già chiusa */ }
        ko(e instanceof Error && /^Archivio/.test(e.message) ? e : errore(e));
      });
    });
  }

  const tutti = nomeStore => transazione([nomeStore], 'readonly', t => promessa(t.objectStore(nomeStore).getAll()));

  // Chi vuole sapere quando la libreria cambia davvero (la copia nella cartella).
  const ascoltatori = [];
  const cambiato = valore => { for (const f of ascoltatori) { try { f(); } catch { /* un ascoltatore rotto non ferma l'archivio */ } } return valore; };

  const archivio = {
    brani: () => tutti('brani'),
    brano: id => transazione(['brani'], 'readonly', t => promessa(t.objectStore('brani').get(id))),

    // Opzioni (le usa l'editor della libreria):
    //  atteso:   l'«aggiornato» del brano da cui l'editor è partito. Se intanto il
    //            brano è cambiato altrove (correzione al volo, import, altra
    //            finestra) o è stato cancellato, NON si riscrive: il testo
    //            dell'editor va nelle Versioni e si risponde { conflitto, attuale }.
    //  versione: false = non tenere la versione precedente (salvataggi automatici
    //            ravvicinati: senza, 30 versioni si consumavano in 12 secondi).
    salvaBrano(dati, { atteso, versione = true } = {}) {
      const ora = new Date().toISOString();
      let cambiatoDavvero = false;
      return transazione(['brani', 'versioni'], 'readwrite', async t => {
        const brani = t.objectStore('brani');
        const versioni = t.objectStore('versioni');
        const id = dati.id || crypto.randomUUID();
        const prima = await promessa(brani.get(id));
        if (atteso !== undefined && (prima?.aggiornato ?? null) !== atteso) {
          const scartato = { id, titolo: String(dati.titolo ?? ''), artista: String(dati.artista ?? ''), note: String(dati.note ?? ''), testo: String(dati.testo ?? ''), aggiornato: ora };
          if (prima && !stessoContenuto(prima, scartato)) await tieniVersione(versioni, scartato);
          return { conflitto: true, attuale: prima ?? null };
        }
        const nuovo = {
          id,
          titolo: String(dati.titolo ?? '').trim() || 'Senza titolo',
          artista: String(dati.artista ?? ''),
          note: String(dati.note ?? ''),
          testo: String(dati.testo ?? ''),
          creato: prima?.creato ?? ora,
          aggiornato: ora,
        };
        if (prima && stessoContenuto(prima, nuovo)) return prima;
        cambiatoDavvero = true;
        if (prima && versione) await tieniVersione(versioni, prima);
        brani.put(nuovo);
        return nuovo;
      }).then(b => (cambiatoDavvero ? cambiato(b) : b));
    },

    async versioni(id) {
      const tutte = await transazione(['versioni'], 'readonly', t => promessa(t.objectStore('versioni').index('brano').getAll(id)));
      return tutte.sort((a, b) => b.k - a.k).map(({ titolo, artista, note, testo, salvato }) => ({ titolo, artista, note, testo, salvato }));
    },

    // Elimina il brano, le sue versioni e i suoi posti nelle scalette.
    eliminaBrano(id) {
      return transazione(['brani', 'versioni', 'scalette'], 'readwrite', async t => {
        t.objectStore('brani').delete(id);
        const versioni = t.objectStore('versioni');
        for (const k of await promessa(versioni.index('brano').getAllKeys(id))) versioni.delete(k);
        const scalette = t.objectStore('scalette');
        for (const s of await promessa(scalette.getAll())) {
          if (s.brani.includes(id)) scalette.put({ ...s, brani: s.brani.filter(x => x !== id), aggiornata: new Date().toISOString() });
        }
      }).then(cambiato);
    },

    scalette: () => tutti('scalette'),
    salvaScaletta(dati) {
      const ora = new Date().toISOString();
      return transazione(['scalette'], 'readwrite', async t => {
        const store = t.objectStore('scalette');
        const id = dati.id || crypto.randomUUID();
        const prima = await promessa(store.get(id));
        const nuova = {
          id,
          nome: String(dati.nome ?? '').trim() || 'Senza nome',
          brani: [...(dati.brani ?? [])],
          creata: prima?.creata ?? ora,
          aggiornata: ora,
        };
        store.put(nuova);
        return nuova;
      }).then(cambiato);
    },
    eliminaScaletta: id => transazione(['scalette'], 'readwrite', t => { t.objectStore('scalette').delete(id); }).then(cambiato),

    leggi: chiave => transazione(['impostazioni'], 'readonly', t => promessa(t.objectStore('impostazioni').get(chiave))),
    scrivi: (chiave, valore) => transazione(['impostazioni'], 'readwrite', t => { t.objectStore('impostazioni').put(valore, chiave); })
      .then(v => (NON_CAMBIAMENTI.has(chiave) ? v : cambiato(v))),

    async esporta() {
      const [brani, scalette, chiavi, valori] = await transazione(['brani', 'scalette', 'impostazioni'], 'readonly', t => Promise.all([
        promessa(t.objectStore('brani').getAll()),
        promessa(t.objectStore('scalette').getAll()),
        promessa(t.objectStore('impostazioni').getAllKeys()),
        promessa(t.objectStore('impostazioni').getAll()),
      ]));
      const impostazioni = {};
      chiavi.forEach((k, i) => { if (!NON_ESPORTATI.has(k)) impostazioni[k] = valori[i]; });
      return { formato: 'gobbo', versione: 1, esportato: new Date().toISOString(), brani, scalette, impostazioni };
    },

    // modo 'sostituisci': l'archivio diventa il backup. 'unisci': si aggiunge,
    // e a parità di id vince il brano (o la scaletta) modificato più di recente;
    // il testo di un brano sostituito resta nelle sue versioni. Con 'unisci' le
    // impostazioni (TV comprese) restano quelle di questo Mac.
    // Risponde { brani, scalette } = quanti scritti, { tenuti, scaletteTenute } =
    // titoli/nomi lasciati come sono qui perché modificati dopo il file, e gli id scritti.
    importa(dati, modo = 'unisci') {
      const valido = dati && dati.formato === 'gobbo' && Array.isArray(dati.brani) && Array.isArray(dati.scalette)
        && dati.brani.every(b => b && typeof b.id === 'string' && typeof b.testo === 'string')
        && dati.scalette.every(s => s && typeof s.id === 'string' && Array.isArray(s.brani));
      if (!valido) return Promise.reject(new Error('Questo file non è un backup del gobbo: niente è stato cambiato.'));
      return transazione(['brani', 'scalette', 'versioni', 'impostazioni'], 'readwrite', async t => {
        const brani = t.objectStore('brani');
        const scalette = t.objectStore('scalette');
        if (modo === 'sostituisci') {
          brani.clear(); scalette.clear(); t.objectStore('versioni').clear();
        }
        const versioni = t.objectStore('versioni');
        const esito = { brani: 0, scalette: 0, tenuti: [], scaletteTenute: [], scritti: [] };
        for (const b of dati.brani) {
          const esistente = modo === 'unisci' ? await promessa(brani.get(b.id)) : null;
          // Più vecchio di quello qui: si tiene quello qui; si dice solo se il contenuto è davvero diverso.
          if (esistente && String(b.aggiornato ?? '') < String(esistente.aggiornato ?? '')) {
            if (!stessoContenuto(esistente, b)) esito.tenuti.push(esistente.titolo);
            continue;
          }
          if (esistente && !stessoContenuto(esistente, b)) await tieniVersione(versioni, esistente);
          brani.put(b);
          esito.brani++;
          esito.scritti.push(b.id);
        }
        for (const s of dati.scalette) {
          const esistente = modo === 'unisci' ? await promessa(scalette.get(s.id)) : null;
          if (!esistente || String(s.aggiornata ?? '') >= String(esistente.aggiornata ?? '')) { scalette.put(s); esito.scalette++; }
          else esito.scaletteTenute.push(esistente.nome);
        }
        if (modo !== 'unisci') {
          for (const [k, v] of Object.entries(dati.impostazioni ?? {})) {
            if (!NON_ESPORTATI.has(k)) t.objectStore('impostazioni').put(v, k);
          }
        }
        return esito;
      }).then(cambiato);
    },

    // Chiede al browser di non cancellare mai questi dati da solo.
    async protetta() {
      if (!navigator.storage?.persist) return false;
      if (await navigator.storage.persisted()) return true;
      return navigator.storage.persist();
    },

    chiudi() { db.close(); chiuso = true; },

    // f() viene chiamata dopo ogni cambiamento vero di brani, scalette o impostazioni.
    alCambio(f) { ascoltatori.push(f); },
  };
  return archivio;
}
