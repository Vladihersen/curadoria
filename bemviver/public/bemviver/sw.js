// Guarda as telas do app e, quando a pessoa pede, os áudios, para abrir e tocar sem internet.
// A API e o painel nunca passam pelo cache.
const CACHE = 'bemviver-v2';
const CACHE_AUDIOS = 'bemviver-audios-v1'; // separado: não é apagado quando as telas mudam
const ARQUIVOS = [
  '/bemviver/', '/bemviver/app.css', '/bemviver/app.js', '/bemviver/manifest.webmanifest',
  '/bemviver/icone-180.png', '/bemviver/icone-192.png', '/bemviver/icone-512.png', '/bemviver/icone-maskable-512.png',
];

self.addEventListener('install', (ev) => {
  ev.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(caches.keys()
    .then((nomes) => Promise.all(nomes.filter((n) => n !== CACHE && n !== CACHE_AUDIOS).map((n) => caches.delete(n))))
    .then(() => self.clients.claim()));
});

// O player de áudio pede pedaços do arquivo (Range). O iPhone só toca se receber
// exatamente o pedaço pedido, então o pedaço é recortado do arquivo guardado.
async function respostaAudio(request) {
  const guardado = await caches.match(request.url, { cacheName: CACHE_AUDIOS, ignoreSearch: true });
  if (!guardado) return fetch(request);
  const faixa = request.headers.get('range');
  if (!faixa) return guardado;
  const blob = await guardado.blob();
  const m = /bytes=(\d*)-(\d*)/.exec(faixa);
  let inicio = m && m[1] ? Number(m[1]) : 0;
  let fim = m && m[2] ? Number(m[2]) : blob.size - 1;
  if (m && !m[1] && m[2]) { inicio = Math.max(0, blob.size - Number(m[2])); fim = blob.size - 1; }
  fim = Math.min(fim, blob.size - 1);
  if (inicio > fim) return new Response(null, { status: 416, headers: { 'content-range': `bytes */${blob.size}` } });
  return new Response(blob.slice(inicio, fim + 1), {
    status: 206,
    headers: {
      'content-type': guardado.headers.get('content-type') || 'audio/mpeg',
      'content-range': `bytes ${inicio}-${fim}/${blob.size}`,
      'content-length': String(fim - inicio + 1),
      'accept-ranges': 'bytes',
    },
  });
}

self.addEventListener('fetch', (ev) => {
  const url = new URL(ev.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/bemviver/api/') || url.pathname.startsWith('/bemviver/painel')) return;
  if (url.pathname.startsWith('/bemviver/audio/')) {
    if (ev.request.method === 'GET') ev.respondWith(respostaAudio(ev.request));
    return;
  }
  if (ev.request.method !== 'GET') return;
  // Rede primeiro, para receber atualizações; cache se estiver sem internet.
  ev.respondWith(
    fetch(ev.request)
      .then((r) => {
        if (r.ok) { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(ev.request, copia)); }
        return r;
      })
      .catch(() => caches.match(ev.request, { cacheName: CACHE }).then((r) => r || caches.match('/bemviver/', { cacheName: CACHE }))),
  );
});
