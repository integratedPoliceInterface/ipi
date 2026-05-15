const CACHE_ESTATICO = 'ipi-appa-v1';
const URLS_ESTATICOS = [
  './',
  './index.html',
  './css/styles.css',
  './js/db.js',
  './js/conectividade.js',
  './js/servicoBusca.js',
  './js/servicoSincronizacao.js',
  './js/app.js',
  './js/aparencia.js',
  './js/mapa.js',
  './js/goias-municipios.js',
  './js/configSupabase.js',
  './js/auth.js',
  './js/seed-policiais.js',
  './js/vendor/protomaps-leaflet.js',
  './js/vendor/pmtiles.js',
  './img/image.png',
  './img/icone-policial.png',
  './img/Brasao_PMGO.png',
  './img/brasao-pmgo-rural.webp'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_ESTATICO).then((c) => c.addAll(URLS_ESTATICOS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim());
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((r) => r || fetch(e.request).catch(() => new Response('Offline', { status: 503 })))
  );
});
