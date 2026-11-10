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

- `relacionados: slug-um, slug-dois` escolhe os textos que aparecem em "Leia também" no fim do post.
  Se faltar, o blog escolhe sozinho: primeiro os do mesmo tema, depois os mais recentes.

## Temas

A `categoria` de cada post vira um tema com página própria em `/blog/tema/<nome-do-tema>/`
(ex.: `Neurobiologia Aplicada` → `/blog/tema/neurobiologia-aplicada/`). A página lista os posts do tema
e entra no sitemap. O nome do tema no topo de cada post leva para essa página, e a lista do blog
mostra todos os temas em "Explore por tema". Escreva a categoria sempre igual (mesmos acentos e `&`),
senão vira outro tema.

## Gráficos dentro do post

Escreva o gráfico entre duas linhas `:::`, sem linhas em branco no meio. Ele vira imagem (SVG) na publicação.

Ritmo de uma respiração (fases: `inspira`, `segura`, `expira`, `pausa`; `unidade` é opcional, padrão segundos):

```
:::respiracao O ritmo da 4:7:8: a saída do ar dura o dobro da entrada
inspira 4
segura 7
expira 8
pausa 1
unidade: tempos
:::
```

Barras com números (a linha `fonte:` é obrigatória: sem ela a publicação para com erro):

```
:::barras Título do gráfico
Antes: 42
Depois: 17
unidade: %
fonte: Nome do estudo, instituição, ano
:::
```

O gráfico de respiração é um desenho do ritmo da técnica, não uma medição. Números de estudo só entram com a fonte.

Posts com `data` no futuro ficam guardados e aparecem sozinhos no dia (o blog é republicado todo dia às 6h).

## O que o blog gera

- `/blog/` lista de posts
- `/blog/tema/<tema>/` posts de cada tema
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
