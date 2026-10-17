// Service worker: dopo il primo avvio l'app si apre anche a server spento.
//
// Tutti i file stanno in UNA cache per versione e si servono solo da lì:
// mai un mix di file vecchi e nuovi nella stessa pagina. La versione è
// l'impronta dei file: la riscrive `node strumenti/versione.mjs`, e la prova
// test/versione.test.mjs fallisce se qualcuno se ne dimentica.

const VERSIONE = 'gobbo-689641b5f872';

const FILE = [
  './',
  'css/comune.css',
  'css/regia.css',
  'css/tv.css',
  'font/AtkinsonHyperlegible-Bold.ttf',
  'font/AtkinsonHyperlegible-Regular.ttf',
  'font/OFL.txt',
  'icona.svg',
  'index.html',
  'js/archivio.js',
  'js/canale.js',
  'js/cerca.js',
  'js/concerto.js',
  'js/copia.js',
  'js/esempi.js',
  'js/impostazioni-tv.js',
  'js/impostazioni.js',
  'js/libreria.js',
  'js/misura.js',
  'js/navigazione.js',
  'js/regia.js',
  'js/resa.js',
  'js/scalette.js',
  'js/schermo.js',
  'js/tasti.js',
  'js/testo.js',
  'js/tv.js',
  'manifest.webmanifest',
  'tv.html',
];

// Nessun skipWaiting: una versione nuova aspetta che TUTTE le finestre del gobbo
// (regia e TV) siano chiuse. Così regia e TV sono sempre della stessa versione:
// la nuova arriva alla prima apertura dopo aver chiuso tutto (06/10/2026).
self.addEventListener('install', e => {
  // cache: 'reload' = dal server, mai dalla cache HTTP di Chrome: una versione
  // nuova non deve riempirsi di file vecchi (revisione 01/10/2026).
  e.waitUntil(caches.open(VERSIONE)
    .then(c => c.addAll(FILE.map(f => new Request(f, { cache: 'reload' })))));
});

// Si cancellano solo le cache vecchie DEL GOBBO: le cache sono di tutto il sito
// (simonecastellan.com), e /posizione/ ha le sue.
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(chiavi => Promise.all(chiavi.filter(k => k.startsWith('gobbo-') && k !== VERSIONE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Un altro service worker dello stesso sito può cancellare la nostra cache.
// Alla prima apertura con la rete la si rimette a posto da sola.
async function cacheCompleta() {
  if (!(await caches.has(VERSIONE))) return false;
  const c = await caches.open(VERSIONE);
  const presenti = new Set((await c.keys()).map(r => r.url));
  return FILE.every(f => presenti.has(new URL(f, self.registration.scope).href));
}

let inRiparazione = false;
async function riparaCache() {
  if (inRiparazione) return;
  inRiparazione = true;
  try {
    if (await cacheCompleta()) return;
    // Solo se il server ha ancora QUESTA versione: se ne è uscita una nuova,
    // sarà il suo service worker a riempire la sua cache.
    const sw = await fetch('sw.js', { cache: 'no-store' });
    if (!sw.ok || !(await sw.text()).includes(`const VERSIONE = '${VERSIONE}';`)) return;
    // Tutto o niente: prima si scarica ogni file, poi si salvano.
    const risposte = await Promise.all(FILE.map(async f => {
      const r = await fetch(new Request(f, { cache: 'reload' }));
      if (!r.ok) throw new Error(f);
      return [f, r];
    }));
    const c = await caches.open(VERSIONE);
    await Promise.all(risposte.map(([f, r]) => c.put(new Request(f), r)));
  } catch { /* senza rete: ci si riprova alla prossima apertura */ }
  finally { inRiparazione = false; }
}

self.addEventListener('fetch', e => {
  const richiesta = e.request;
  if (richiesta.method !== 'GET' || new URL(richiesta.url).origin !== location.origin) return;
  // match con cacheName non crea la cache se manca (aprirla la ricreerebbe vuota)
  e.respondWith(caches.match(richiesta, { cacheName: VERSIONE, ignoreSearch: true })
    .then(trovato => trovato || fetch(richiesta)));
  if (richiesta.mode === 'navigate') e.waitUntil(riparaCache());
});
