// Service worker: dopo il primo avvio l'app si apre anche a server spento.
//
// Tutti i file stanno in UNA cache per versione e si servono solo da lì:
// mai un mix di file vecchi e nuovi nella stessa pagina. La versione è
// l'impronta dei file: la riscrive `node strumenti/versione.mjs`, e la prova
// test/versione.test.mjs fallisce se qualcuno se ne dimentica.

const VERSIONE = 'gobbo-b9577d36ce1f';

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

self.addEventListener('install', e => {
  // cache: 'reload' = dal server, mai dalla cache HTTP di Chrome: una versione
  // nuova non deve riempirsi di file vecchi (revisione 01/10/2026).
  e.waitUntil(caches.open(VERSIONE)
    .then(c => c.addAll(FILE.map(f => new Request(f, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(chiavi => Promise.all(chiavi.filter(k => k !== VERSIONE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const richiesta = e.request;
  if (richiesta.method !== 'GET' || new URL(richiesta.url).origin !== location.origin) return;
  e.respondWith(caches.open(VERSIONE)
    .then(c => c.match(richiesta, { ignoreSearch: true }))
    .then(trovato => trovato || fetch(richiesta)));
});
