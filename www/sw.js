const CACHE_ESTATICO = 'ipi-appa-v2';
const CACHE_MAPAS = 'ipi-mapas-v1';
let cacheandoMapa = false;
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

function servirRange(resposta, rangeHeader) {
  return resposta.arrayBuffer().then(corpo => {
    const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
    if (!match) return resposta;
    const inicio = parseInt(match[1]);
    const fim = match[2] ? parseInt(match[2]) : corpo.byteLength - 1;
    const pedaco = corpo.slice(inicio, fim + 1);
    return new Response(pedaco, {
      status: 206,
      statusText: 'Partial Content',
      headers: {
        'Content-Range': `bytes ${inicio}-${fim}/${corpo.byteLength}`,
        'Content-Length': pedaco.byteLength,
        'Content-Type': resposta.headers.get('Content-Type') || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    });
  });
}

self.addEventListener('fetch', (e) => {
  if (!e.request.url.includes('goias.pmtiles')) {
    e.respondWith(
      caches.match(e.request).then((r) => r || fetch(e.request).catch(() => new Response('Offline', { status: 503 })))
    );
    return;
  }

  e.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_MAPAS);
      const fullKey = new Request(e.request.url);

      const cachedFull = await cache.match(fullKey);
      if (cachedFull) {
        const range = e.request.headers.get('range');
        if (range) return servirRange(cachedFull, range);
        return cachedFull;
      }

      const res = await fetch(e.request);
      if (!res.ok) return res;

      if (!cacheandoMapa) {
        cacheandoMapa = true;
        fetch(e.request.url).then(fullRes => {
          if (fullRes.ok) cache.put(fullKey, fullRes);
          cacheandoMapa = false;
        }).catch(() => { cacheandoMapa = false; });
      }

      return res;
    })().catch(() => {
      return new Response('Offline Map', { status: 503 });
    })
  );
});
