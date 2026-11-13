// Service worker do app do Método Bem Viver: o mesmo modelo do Leveza de Viver.
//
// - Na primeira abertura, o app inteiro fica guardado no celular, com os 6 áudios.
//   Depois disso ele abre e toca sem internet.
// - A cada publicação, o GitHub Actions troca __VERSAO__ abaixo pelo código da
//   publicação. O celular percebe que o sw.js mudou, baixa a versão nova em segundo
//   plano e o app mostra o aviso "Atualizar". A versão nova só entra quando a pessoa
//   toca no aviso, nunca no meio de um áudio ou de um suspiro guiado.
// - Os áudios ficam numa gaveta própria e só são baixados de novo quando
//   VERSAO_AUDIOS muda. Trocou um áudio? Suba VERSAO_AUDIOS (a1 → a2) e publique.

const VERSAO = '__VERSAO__';
const VERSAO_AUDIOS = 'a2'; // a2 (13/11): novas boas-vindas, manhã e noite
const CACHE = 'bemviver-app-' + VERSAO;
const CACHE_AUDIOS = 'bemviver-audios-' + VERSAO_AUDIOS;

const ARQUIVOS = [
  '/bemviver/', '/bemviver/app.css', '/bemviver/app.js', '/bemviver/manifest.webmanifest',
  '/bemviver/icone-180.png', '/bemviver/icone-192.png', '/bemviver/icone-512.png', '/bemviver/icone-maskable-512.png',
];
const AUDIOS = [
  '/bemviver/audio/1-boas-vindas.mp3',
  '/bemviver/audio/2-comeco-do-dia.mp3',
  '/bemviver/audio/3a-respiro-1-minuto.mp3',
  '/bemviver/audio/3b-respiro-5-minutos.mp3',
  '/bemviver/audio/4-noite.mp3',
  '/bemviver/audio/5-domingo.mp3',
];

// Baixa os áudios que faltam na gaveta atual. Um áudio que falhar não derruba os outros.
async function guardarAudios(aoAvancar) {
  const c = await caches.open(CACHE_AUDIOS);
  let ok = 0;
  for (let i = 0; i < AUDIOS.length; i++) {
    const u = AUDIOS[i];
    try {
      if (!(await c.match(u))) {
        const r = await fetch(u, { cache: 'reload' });
        if (!r.ok) throw new Error(String(r.status));
        await c.put(u, r);
      }
      ok++;
    } catch { /* sem internet ou arquivo faltando: fica para depois */ }
    if (aoAvancar) aoAvancar(i + 1, ok);
  }
  return ok;
}

self.addEventListener('install', (ev) => {
  ev.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // As telas são obrigatórias: se não baixarem, a versão nova não se instala.
    await c.addAll(ARQUIVOS.map((u) => new Request(u, { cache: 'reload' })));
    // Os áudios vêm junto, mas sem travar a instalação se a internet cair.
    await guardarAudios();
    // Sem skipWaiting aqui de propósito: a versão nova espera o toque em "Atualizar".
  })());
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(caches.keys()
    .then((nomes) => Promise.all(nomes
      .filter((n) => n.startsWith('bemviver-') && n !== CACHE && n !== CACHE_AUDIOS)
      .map((n) => caches.delete(n))))
    .then(() => self.clients.claim()));
});

self.addEventListener('message', (ev) => {
  const d = ev.data || {};
  if (d === 'SKIP_WAITING' || d.tipo === 'SKIP_WAITING') self.skipWaiting();
  if (d.tipo === 'GUARDAR_AUDIOS' && ev.source) {
    const avisar = (msg) => ev.source.postMessage(msg);
    ev.waitUntil(guardarAudios((feitos, ok) => avisar({ tipo: 'AUDIOS_PROGRESSO', feitos, ok, total: AUDIOS.length }))
      .then((ok) => avisar({ tipo: 'AUDIOS_FIM', ok, total: AUDIOS.length })));
  }
  if (d.tipo === 'AUDIOS_ESTADO' && ev.source) {
    ev.waitUntil(caches.open(CACHE_AUDIOS)
      .then((c) => Promise.all(AUDIOS.map((u) => c.match(u))))
      .then((tem) => ev.source.postMessage({ tipo: 'AUDIOS_ESTADO', ok: tem.filter(Boolean).length, total: AUDIOS.length })));
  }
});

// O player de áudio pede pedaços do arquivo (Range). O iPhone só toca se receber
// exatamente o pedaço pedido, então o pedaço é recortado do arquivo guardado.
async function respostaAudio(request) {
  const guardado = await caches.match(new URL(request.url).pathname, { cacheName: CACHE_AUDIOS });
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
  if (url.origin !== self.location.origin || ev.request.method !== 'GET') return;
  if (url.pathname.startsWith('/bemviver/api/') || url.pathname.startsWith('/bemviver/painel')) return;
  if (url.pathname.startsWith('/bemviver/audio/')) return ev.respondWith(respostaAudio(ev.request));
  // Telas: sempre a cópia guardada desta versão (abre na hora, com ou sem internet).
  // O que não estiver guardado vem da rede.
  ev.respondWith((async () => {
    const c = await caches.open(CACHE);
    const chave = url.pathname === '/bemviver' || url.pathname === '/bemviver/index.html' ? '/bemviver/' : url.pathname;
    const guardado = await c.match(chave);
    if (guardado) return guardado;
    try {
      return await fetch(ev.request);
    } catch {
      return (await c.match('/bemviver/')) || Response.error();
    }
  })());
});
