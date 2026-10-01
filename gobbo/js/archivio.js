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
const NON_ESPORTATI = new Set([...SOLO_SESSIONE, 'cartella']);
// Scritture che NON sono un cambiamento della libreria: la posizione del
// concerto cambia a ogni tasto, e la copia su disco non deve partire a ogni riga.
const NON_CAMBIAMENTI = new Set([...NON_ESPORTATI, 'ultimoBackup', 'esempiInseriti']);

const promessa = r => new Promise((ok, ko) => { r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); });

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

    salvaBrano(dati) {
      const ora = new Date().toISOString();
      let cambiatoDavvero = false;
      return transazione(['brani', 'versioni'], 'readwrite', async t => {
        const brani = t.objectStore('brani');
        const versioni = t.objectStore('versioni');
        const id = dati.id || crypto.randomUUID();
        const prima = await promessa(brani.get(id));
        const nuovo = {
          id,
          titolo: String(dati.titolo ?? '').trim() || 'Senza titolo',
          artista: String(dati.artista ?? ''),
          note: String(dati.note ?? ''),
          testo: String(dati.testo ?? ''),
          creato: prima?.creato ?? ora,
          aggiornato: ora,
        };
        if (prima && ['titolo', 'artista', 'note', 'testo'].every(k => prima[k] === nuovo[k])) return prima;
        cambiatoDavvero = true;
        if (prima) {
          versioni.add({ branoId: id, titolo: prima.titolo, artista: prima.artista, note: prima.note, testo: prima.testo, salvato: prima.aggiornato });
          const chiavi = await promessa(versioni.index('brano').getAllKeys(id));
          chiavi.sort((a, b) => a - b);
          for (const k of chiavi.slice(0, Math.max(0, chiavi.length - VERSIONI_TENUTE))) versioni.delete(k);
        }
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
    // e a parità di id vince il brano modificato più di recente.
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
        for (const b of dati.brani) {
          const esistente = modo === 'unisci' ? await promessa(brani.get(b.id)) : null;
          if (!esistente || String(b.aggiornato ?? '') >= String(esistente.aggiornato ?? '')) brani.put(b);
        }
        for (const s of dati.scalette) scalette.put(s);
        for (const [k, v] of Object.entries(dati.impostazioni ?? {})) {
          if (!NON_ESPORTATI.has(k)) t.objectStore('impostazioni').put(v, k);
        }
        return { brani: dati.brani.length, scalette: dati.scalette.length };
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
