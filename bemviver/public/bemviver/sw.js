// Guarda as telas do app para abrir sem internet. A API nunca passa pelo cache.
const CACHE = 'bemviver-v1';
const ARQUIVOS = ['/bemviver/', '/bemviver/app.css', '/bemviver/app.js', '/bemviver/manifest.webmanifest', '/bemviver/icone.svg'];

self.addEventListener('install', (ev) => {
  ev.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(caches.keys()
    .then((nomes) => Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
    .then(() => self.clients.claim()));
});

// Rede primeiro, para receber atualizações; cache se estiver sem internet.
self.addEventListener('fetch', (ev) => {
  const url = new URL(ev.request.url);
  if (ev.request.method !== 'GET' || url.pathname.startsWith('/bemviver/api/') || url.pathname.startsWith('/bemviver/painel')) return;
  if (url.pathname.startsWith('/bemviver/audio/')) return; // áudios grandes: deixa o navegador cuidar
  ev.respondWith(
    fetch(ev.request)
      .then((r) => {
        if (r.ok) { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(ev.request, copia)); }
        return r;
      })
      .catch(() => caches.match(ev.request).then((r) => r || caches.match('/bemviver/'))),
  );
});
