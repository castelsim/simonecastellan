// Service worker: mette in cache i quattro file dell'app, così si apre
// anche senza rete. Non tocca la posizione e non parla con nessun server.
const CACHE = 'posizione-v1';
const FILE = ['./', './index.html', './manifest.json', './icona-180.png', './icona-192.png', './icona-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(chiavi => Promise.all(chiavi.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(trovato => trovato || fetch(e.request))
  );
});
