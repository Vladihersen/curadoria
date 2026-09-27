# SOS Estresse

Aplicativo de bolso (PWA) para alívio imediato do estresse, com toque vagal guiado, respiração 4:7:8, coerência cardíaca 5:6 e suspiro fisiológico. 100% offline após a primeira abertura — sem login, sem nuvem, sem anúncios e sem rastreamento de dados.

Migrado da pasta do Google Drive `Ponto de Alívio` (curadoria de Vladimir Hersen) para o repositório, e renomeado para SOS Estresse — nome mais direto para quem busca ajuda num momento de crise aguda.

## Estrutura

- `index.html` — app completo (HTML + CSS + JS embutidos), última versão da pasta de origem.
- `manifest.webmanifest` — manifesto do PWA (nome, ícones, cor de tema).
- `sw.js` — service worker que faz cache 100% offline dos assets do app.
- `wrangler.toml` / `_worker.js` — configuração de publicação no Cloudflare Workers (assets estáticos, `/` servindo `index.html`).
- `.assetsignore` — arquivos que não devem subir como assets estáticos no deploy do Worker.
- `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `capa-app.png` — ícones e imagem de capa do PWA.
- `animacao_deslize_orelha_clavicula.gif` — ilustração animada do toque vagal (usada no card de instrução).
- `audio/paisagem-brisa.mp3` — paisagem sonora de brisa referenciada pelo service worker para cache offline.

## Como testar localmente

Abra `index.html` diretamente no navegador (duplo clique) — o app roda inteiro no cliente, sem servidor.

## Como publicar (Cloudflare Workers)

```
npx wrangler deploy
```

Isso publica o conteúdo desta pasta (`wrangler.toml` aponta `directory = "./"`) como assets estáticos servidos pelo `_worker.js`, disponível em `https://sos-estresse.<sua-conta>.workers.dev`.

## Práticas incluídas no app

1. **Estímulo do Nervo Vago** — toque suave da orelha à clavícula, 3–5 repetições (~30–45s).
2. **SOS 4:7:8** — 5 repetições (~1m35s): inspira 4s, retém 7s, solta 8s.
3. **Desacelerar 4:7:8** — 9 repetições (~2m50s).
4. **Coerência Cardíaca 5:6** — ~4 minutos, ritmo assimétrico 5s/6s.
5. **Suspiro Fisiológico** — ~2 minutos, dupla inspiração + expiração longa.

O áudio das taças tibetanas é sintetizado via Web Audio API (osciladores harmônicos) diretamente no `index.html`, dispensando arquivos de áudio para funcionar — o `paisagem-brisa.mp3` fica disponível como trilha ambiente opcional.
