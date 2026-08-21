const CACHE = 'stock-v2';
const STATIC = [
  './dashboard.html',
  './contagem.html',
  './historico-contagens.html',
  './faltas.html',
  './index.html',
  './assets/css/style.css',
  './manifest.json',
  './assets/icons/icon.svg',
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).catch(() => {})
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Firebase, CDN e requests externos vão sempre à rede
  if (!e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
