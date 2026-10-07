# Blog · Palavras para Respirar

Código do blog de vladimirhersen.com.br/blog, separado do site principal.
Roda no Worker `vladimirhersencombrblog` do Cloudflare, na rota `vladimirhersen.com.br/blog*`.
O site principal (Worker `site-vladimirhersen`) não precisa ser mexido para publicar posts.

## Como publicar um post

1. Crie um arquivo em `posts/` com o nome `AAAA-MM-DD-nome-do-post.md`.
2. Comece o arquivo com o cabeçalho abaixo e escreva o texto embaixo dele:

```markdown
---
titulo: "Título do post"
slug: nome-do-post
categoria: Presença & Contentamento
data: 2026-10-10
resumo: "Uma ou duas frases que aparecem na lista, no Google e na prévia do WhatsApp."
---

Primeiro parágrafo.

Segundo parágrafo, com **negrito** e *itálico*.

> Uma citação em destaque.

## Um subtítulo

1. Passo um;
2. Passo dois.
```

3. Ao entrar na `main`, o post vai para o ar sozinho em `vladimirhersen.com.br/blog/nome-do-post/`.

Campos opcionais no cabeçalho:
- `leitura: 5` define os minutos de leitura (se faltar, é calculado pelo tamanho do texto).
- `imagem: /img/capa.jpg` define a imagem da prévia no WhatsApp e redes (padrão: o banner do site).
- `rascunho: sim` guarda o post sem publicar.

Posts com `data` no futuro ficam guardados e aparecem sozinhos no dia (o blog é republicado todo dia às 6h).

## O que o blog gera

- `/blog/` lista de posts
- `/blog/<slug>/` cada post com título, descrição, prévia para WhatsApp e marcação de artigo para o Google
- `/blog/sitemap.xml` sitemap só do blog
- `/blog/feed.xml` feed RSS, que serve para e-mail automático de post novo

## Para quem mexe no código

```sh
npm install
npm run build     # gera src/posts.generated.js a partir de posts/
npm run dev       # roda local
```

O deploy é feito pelo GitHub Actions (`.github/workflows/blog-deploy.yml`) e precisa dos
segredos `CLOUDFLARE_API_TOKEN` (permissão "Edit Cloudflare Workers") e `CLOUDFLARE_ACCOUNT_ID`.
