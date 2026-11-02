// ─────────────────────────────────────────────────────────────────────────────
// LEVEZA DE VIVER — SERVICE WORKER
// Guarda o app no aparelho pra abrir sem internet, e controla quando a versão
// nova entra no lugar da antiga.
//
// 03/set/2026 — reescrito inteiro. O problema que motivou a reescrita: o
// service worker anterior servia o index.html SEMPRE do cache (cache-first), e
// só buscava versão nova se o próprio sw.js mudasse de conteúdo. Quando o
// carimbo automático do sw.js falhava, o arquivo ficava idêntico a cada
// publicação, o navegador concluía "nada mudou" e o aparelho continuava
// mostrando a versão velha PARA SEMPRE — mesmo com o arquivo novo já publicado
// no servidor. Era o caso do app em 03/set/2026.
//
// As duas mudanças que impedem isso de se repetir:
//   1. CACHE_VER abaixo acompanha a versão do app. Basta trocar essa linha (ou
//      publicar por cima) que todo cache antigo é descartado.
//   2. O HTML busca a versão nova do servidor toda vez que há internet, mas
//      NÃO espera essa resposta pra abrir o app: se já existe uma cópia
//      guardada, ela responde na hora, e a busca da versão nova acontece em
//      segundo plano, atualizando o cache pra próxima abertura.
//      Os demais arquivos (áudio, ícones) seguem cache-first, que é o que
//      mantém o app leve e rápido — eles quase nunca mudam.
//
// 05/set/2026 — o item 2 acima era NETWORK-FIRST puro (esperava a rede antes
// de mostrar qualquer coisa). Com internet fraca isso travava o app inteiro:
// o fetch não falha com sinal ruim, só demora, e enquanto isso o navegador
// não tem nada pra mostrar — parecia o app travado, sem responder a toque
// nenhum. Trocado pra "cache primeiro, rede em segundo plano" (ver o
// handler de fetch abaixo) — abre rápido sempre, e a versão nova ainda
// chega sozinha na abertura seguinte.
//
// IMPORTANTE: a troca de versão continua NÃO sendo automática no meio do uso.
// O index.html mostra a tarja "Atualizar" e só manda o SKIP_WAITING quando a
// pessoa toca nela — trocar de versão recarrega a página, e isso cortaria o
// áudio no meio de uma prática.
// ─────────────────────────────────────────────────────────────────────────────

// Suba esta linha a cada publicação (ou deixe o gerar-worker.ps1 carimbar).
// Mantenha igual à meta app-version do index.html pra ficar fácil de conferir.
var CACHE_VER = "LV-2026-10-27-0802";
var CACHE = "leveza-" + CACHE_VER;

// Arquivos guardados já na instalação. Se algum não existir na pasta, ele é
// simplesmente ignorado (o cache.add falha só naquele item) — nenhum arquivo
// faltando derruba a instalação inteira.
var CORE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
  "./audio/paisagem-brisa.mp3"
];

// O manual é uma página à parte, carregada num iframe, e tem os próprios
// arquivos pesados de áudio narrado — fica fora do cache do app.
// 29/set/2026 — acesso de 1 ano: a conferência de acesso (/api/), a tela de
// ativação e o controle nunca podem sair do cache, senão uma resposta velha
// ("acesso ok" ou "vencido") ficaria presa no aparelho.
function foraDoCache(url){
  var p = url.pathname;
  return p.indexOf("/manual/") !== -1 || p.indexOf("/api/") === 0 ||
         p.indexOf("/admin") === 0 || p === "/ativar" || p === "/sair";
}

self.addEventListener("install", function(ev){
  ev.waitUntil(
    caches.open(CACHE).then(function(cache){
      return Promise.all(CORE.map(function(u){
        return cache.add(new Request(u, {cache: "reload"}))["catch"](function(){});
      }));
    })
    // NÃO chama skipWaiting aqui de propósito: a versão nova fica esperando até
    // a pessoa tocar em "Atualizar" (ver a nota no topo).
  );
});

self.addEventListener("activate", function(ev){
  ev.waitUntil(
    caches.keys().then(function(nomes){
      return Promise.all(nomes.map(function(n){
        return n === CACHE ? null : caches["delete"](n);
      }));
    }).then(function(){
      return self.clients.claim();
    })
  );
});

// A tarja "Atualizar" do index.html manda a string "SKIP_WAITING".
self.addEventListener("message", function(ev){
  var d = ev.data;
  if(d === "SKIP_WAITING" || (d && d.type === "SKIP_WAITING")) self.skipWaiting();
});

self.addEventListener("fetch", function(ev){
  var req = ev.request;
  if(req.method !== "GET") return;

  var url;
  try { url = new URL(req.url); } catch(e){ return; }
  if(url.origin !== self.location.origin) return;  // CDN, fontes, API: direto pra rede
  if(foraDoCache(url)) return;                     // manual: sempre da rede

  var ehHTML = req.mode === "navigate" ||
               (req.headers.get("accept") || "").indexOf("text/html") !== -1;

  if(ehHTML){
    // 05/set/2026 — trocado de network-first puro pra "cache rápido, rede em
    // segundo plano". O motivo: com internet fraca, o fetch() não FALHA, ele só
    // demora — às vezes dezenas de segundos. Enquanto isso o navegador fica sem
    // nada pra mostrar (a navegação inteira depende dessa resposta), e o app
    // parece travado, sem responder a nenhum toque. Não é o app: é a página que
    // ainda nem carregou.
    // Agora: se já existe uma cópia guardada, ela responde na hora (o app abre
    // sempre rápido, com qualquer sinal). A busca da versão nova continua em
    // segundo plano e atualiza o cache pra próxima abertura — é assim que a
    // tarja "Atualizar" continua aparecendo sozinha, sem travar nada.
    ev.respondWith(
      caches.match(req).then(function(hit){
        var buscaRede = fetch(req).then(function(resp){
          if(resp && resp.ok){
            var copia = resp.clone();
            caches.open(CACHE).then(function(c){ c.put(req, copia); })["catch"](function(){});
          }
          return resp;
        })["catch"](function(){ return null; });

        if(hit) { buscaRede["catch"](function(){}); return hit; }

        // Sem nada guardado ainda (primeira abertura): precisa esperar a rede.
        return buscaRede.then(function(resp){
          return resp || caches.match("./index.html") || caches.match("./");
        });
      })
    );
    return;
  }

  // Demais arquivos (áudio, ícones, manifest): CACHE-FIRST, com atualização
  // silenciosa em segundo plano na próxima vez que houver rede.
  ev.respondWith(
    caches.match(req).then(function(hit){
      if(hit) return hit;
      return fetch(req).then(function(resp){
        if(resp && resp.ok && resp.type === "basic"){
          var copia = resp.clone();
          caches.open(CACHE).then(function(c){ c.put(req, copia); })["catch"](function(){});
        }
        return resp;
      });
    })["catch"](function(){
      return caches.match(req);
    })
  );
});
