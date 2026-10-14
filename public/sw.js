// Service worker: deixa o app abrir sem internet e guarda a última resposta da API
// (por isso o "treino do dia" e o último treino aparecem mesmo sem sinal).
// Registrar treino exige internet: POST nunca passa pelo cache.

const VERSAO = 'personal-v34';
const CASCA = [
  './',
  'index.html',
  'main.js',
  'teclado.js',
  'guias.js',
  'styles.css',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(CASCA)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== VERSAO).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // API: rede primeiro; sem rede, devolve a última resposta guardada.
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(req)
        .then((resp) => {
          if (resp.ok) {
            const copia = resp.clone();
            caches.open(VERSAO).then((c) => c.put(req.url, copia));
          }
          return resp;
        })
        .catch(() => caches.match(req.url).then((r) => r || new Response(JSON.stringify({ erro: 'Sem internet e sem dados guardados.' }), { status: 503, headers: { 'Content-Type': 'application/json' } }))),
    );
    return;
  }

  // Arquivos do app: usa o guardado e atualiza em segundo plano.
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((guardado) => {
      const rede = fetch(req)
        .then((resp) => {
          if (resp.ok) {
            const copia = resp.clone();
            caches.open(VERSAO).then((c) => c.put(req, copia));
          }
          return resp;
        })
        .catch(() => guardado);
      return guardado || rede;
    }),
  );
});
