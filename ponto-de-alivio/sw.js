// ── SERVICE WORKER — Ponto de Alívio ───────────────────────────────────
// Cache 100% offline para o aplicativo de alívio imediato do estresse
const CACHE_VERSION = 'alivio-2026-09-09-0001';
const CACHE_APP    = CACHE_VERSION + '-app';
const CACHE_FONTES = CACHE_VERSION + '-fontes';

const ASSETS = [
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './capa-app.png',
  './audio/paisagem-brisa.mp3'
];

function guardarLimpo(c, url, res){
  if(!res || !res.ok) return;
  if(res.redirected){
    return res.blob().then(function(corpo){
      return c.put(url, new Response(corpo, {status:200, statusText:'OK', headers:res.headers}));
    });
  }
  return c.put(url, res);
}

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE_APP).then(function(c){
      return Promise.all(ASSETS.map(function(url){
        return fetch(new Request(url, {cache:'reload'}))
          .then(function(res){ return guardarLimpo(c, url, res); })
          .catch(function(){});
      }));
    })
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(nomes){
      return Promise.all(nomes.map(function(n){
        return n.indexOf(CACHE_VERSION) === 0 ? null : caches.delete(n);
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e){
  var req = e.request;
  if(req.method !== 'GET') return;
  var url;
  try { url = new URL(req.url); } catch(err){ return; }

  if(url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com'){
    e.respondWith(
      caches.open(CACHE_FONTES).then(function(c){
        return c.match(req).then(function(hit){
          var rede = fetch(req).then(function(res){
            if(res && res.ok) c.put(req, res.clone());
            return res;
          }).catch(function(){ return hit; });
          return hit || rede;
        });
      })
    );
    return;
  }

  if(url.origin !== self.location.origin) return;

  if(req.mode === 'navigate'){
    e.respondWith(
      caches.match('./index.html').then(function(hit){
        return hit || fetch(req).catch(function(){ return caches.match('./index.html'); });
      })
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(function(hit){
      if(hit) return hit;
      return fetch(req).then(function(res){
        if(res && res.ok && res.type === 'basic'){
          var copia = res.clone();
          caches.open(CACHE_APP).then(function(c){ return guardarLimpo(c, req, copia); });
        }
        return res;
      }).catch(function(){
        if(req.mode === 'navigate') return caches.match('./index.html');
      });
    })
  );
});
