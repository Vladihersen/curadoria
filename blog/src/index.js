/**
 * CLOUDFLARE WORKER: BLOG VLADIMIR HERSEN · Palavras para Respirar
 * Rota: vladimirhersen.com.br/blog*
 *
 * Os textos ficam em blog/posts/*.md. Este arquivo só monta as páginas.
 *   /blog/               lista de posts
 *   /blog/<slug>/        post completo
 *   /blog/tema/<tema>/   posts de um tema (categoria)
 *   /blog/sitemap.xml    sitemap só do blog
 *   /blog/feed.xml       feed RSS (para e-mail automático e leitores)
 *   /robots.txt          robots do site inteiro, já apontando o sitemap do blog
 */

import { POSTS } from './posts.generated.js';
import { navBar, footer } from './layout.js';

const SITE = 'https://vladimirhersen.com.br';
const BASE = SITE + '/blog/';
const BG = '#EDF6F7';
const NOME_BLOG = 'Palavras para Respirar';
const DESCRICAO_BLOG = 'Textos de Vladimir Hersen sobre respiração, presença e o dia a dia, para tirar um pouco do peso dos ombros.';
const IMAGEM_PADRAO = SITE + '/banner-preview.jpg';

// Mesmo robots.txt do site principal, mais o sitemap do blog.
// Este Worker atende /robots.txt (rota em wrangler.toml) para não precisar mexer no site principal.
const ROBOTS = 'User-agent: *\nAllow: /\nDisallow: /oficina/admin\n\n' +
  'Sitemap: ' + SITE + '/sitemap.xml\n' +
  'Sitemap: ' + SITE + '/blog/sitemap.xml\n';

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const publicados = postsPublicados();

    if (path === '/robots.txt') {
      return new Response(ROBOTS, { headers: { 'content-type': 'text/plain;charset=UTF-8', 'cache-control': 'public, max-age=86400' } });
    }
    if (path === '/blog') {
      return html(paginaLista(publicados));
    }
    if (path === '/blog/sitemap.xml') {
      return xml(sitemap(publicados), 'application/xml');
    }
    if (path === '/blog/feed.xml' || path === '/blog/rss' || path === '/blog/feed') {
      return xml(feed(publicados), 'application/rss+xml');
    }

    if (path === '/blog/tema') return Response.redirect(BASE, 301);
    const t = path.match(/^\/blog\/tema\/([a-z0-9-]+)$/);
    if (t) {
      const tema = temas(publicados).find(x => x.slug === t[1]);
      if (tema) {
        if (!url.pathname.endsWith('/')) return Response.redirect(BASE + 'tema/' + tema.slug + '/', 301);
        return html(paginaTema(tema, publicados));
      }
    }

    const m = path.match(/^\/blog\/([a-z0-9-]+)$/);
    if (m) {
      const post = publicados.find(p => p.slug === m[1]);
      if (post) {
        // Endereço oficial do post termina com barra.
        if (!url.pathname.endsWith('/')) return Response.redirect(BASE + post.slug + '/', 301);
        return html(paginaPost(post, publicados));
      }
    }

    return html(pagina404(publicados), 404);
  }
};

// Posts com data no futuro ficam guardados e entram no ar sozinhos no dia.
function postsPublicados() {
  const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  return POSTS.filter(p => p.data <= hoje);
}

// Temas = categorias dos posts publicados, do que tem mais textos para o que tem menos.
function temas(posts) {
  const mapa = new Map();
  for (const p of posts) {
    if (!mapa.has(p.tema)) mapa.set(p.tema, { slug: p.tema, nome: p.categoria, posts: [] });
    mapa.get(p.tema).posts.push(p);
  }
  return [...mapa.values()].sort((a, b) => b.posts.length - a.posts.length || a.nome.localeCompare(b.nome, 'pt-BR'));
}

// "Leia também": primeiro os que o post indica no campo "relacionados",
// depois os do mesmo tema, depois os mais recentes.
function relacionados(p, todos, quantos = 3) {
  const escolhidos = [];
  const add = o => { if (o && o.slug !== p.slug && !escolhidos.includes(o)) escolhidos.push(o); };
  for (const s of p.relacionados || []) add(todos.find(o => o.slug === s));
  for (const o of todos) if (o.tema === p.tema) add(o);
  for (const o of todos) add(o);
  return escolhidos.slice(0, quantos);
}

function linkTema(p, classe = '') {
  return `<a href="/blog/tema/${p.tema}/" class="uppercase tracking-wider font-bold text-brand-teal hover:underline ${classe}">${esc(p.categoria)}</a>`;
}

function chipsTemas(lista, atual = '') {
  return `
    <nav aria-label="Temas do blog" class="flex flex-wrap justify-center gap-2">${lista.map(t => `
      <a href="/blog/tema/${t.slug}/" class="px-4 py-2 rounded-full border text-sm transition-colors ${t.slug === atual ? 'bg-brand-teal border-brand-teal text-white' : 'bg-white border-brand-border text-brand-night hover:border-brand-teal hover:text-brand-teal'}">${esc(t.nome)} <span class="opacity-60">· ${t.posts.length}</span></a>`).join('')}
    </nav>`;
}

// Botão "Respire comigo": abre uma tela com um círculo que cresce e diminui
// no ritmo do gráfico de respiração do post. Sem o script, o botão fica escondido.
const RESPIRE_COMIGO = `
  <style>
    .respire-comigo { display: inline-flex; align-items: center; gap: .4rem; margin: .9rem auto 0; padding: .7rem 1.3rem; border-radius: 999px; background: #005F6B; color: #fff; border: 0; cursor: pointer; font-family: inherit; font-weight: 600; font-size: .95rem; letter-spacing: .02em; }
    .respire-comigo:hover { background: #004A54; }
    .respire-comigo[hidden] { display: none; }
    .grafico-respiracao { text-align: center; }
    .rc-tela { position: fixed; inset: 0; z-index: 100; background: #1A2A3A; color: #F8F9F9; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px 16px; text-align: center; }
    .rc-titulo { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 1.35rem; max-width: 30rem; line-height: 1.3; opacity: .85; }
    .rc-palco { position: relative; width: min(78vw, 340px); height: min(78vw, 340px); margin: 28px 0; display: flex; align-items: center; justify-content: center; }
    .rc-circulo { position: absolute; inset: 0; border-radius: 50%; background: radial-gradient(circle at 50% 40%, #7A9E93, #005F6B); transform: scale(.5); transition-property: transform, background-color; transition-timing-function: ease-in-out; box-shadow: 0 0 60px rgba(122,158,147,.35); }
    .rc-centro { position: relative; display: flex; flex-direction: column; align-items: center; }
    .rc-fase { font-size: 1.6rem; font-weight: 600; }
    .rc-num { font-size: 2.6rem; font-weight: 300; line-height: 1.1; min-height: 2.9rem; }
    .rc-ciclos { font-size: 1rem; opacity: .8; }
    .rc-dica { font-size: .9rem; opacity: .65; max-width: 26rem; margin-top: .6rem; }
    .rc-parar { margin-top: 22px; padding: .75rem 2rem; border-radius: 999px; border: 1px solid #D9C5A8; background: transparent; cursor: pointer; font-family: inherit; color: #D9C5A8; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; font-size: .85rem; }
    .rc-parar:hover { background: #D9C5A8; color: #1A2A3A; }
    @media (prefers-reduced-motion: reduce) { .rc-circulo { transition: none !important; } }
  </style>
  <script>
  (function () {
    var NOME = { inspira: 'Inspire', segura: 'Segure', expira: 'Solte o ar', pausa: 'Pausa' };
    var tela = null, timers = [], volta = null;
    function limpar() { timers.forEach(clearTimeout); timers.forEach(clearInterval); timers = []; }
    function escala(n) { return 0.45 + 0.55 * n; }
    function parar(ciclos, titulo) {
      limpar();
      if (tela) { tela.remove(); tela = null; }
      document.body.style.overflow = '';
      document.removeEventListener('keydown', tecla);
      if (window.gtag) gtag('event', 'respire_comigo_parar', { tecnica: titulo, ciclos: ciclos });
      if (volta) volta.focus();
    }
    function tecla(e) { if (e.key === 'Escape' && tela) tela.querySelector('.rc-parar').click(); }
    function iniciar(fig, botao) {
      var ritmo = JSON.parse(fig.getAttribute('data-ritmo'));
      var titulo = fig.getAttribute('data-titulo') || '';
      volta = botao;
      tela = document.createElement('div');
      tela.className = 'rc-tela';
      tela.setAttribute('role', 'dialog');
      tela.setAttribute('aria-modal', 'true');
      tela.setAttribute('aria-label', 'Respire comigo');
      tela.innerHTML = '<p class="rc-titulo"></p><div class="rc-palco"><div class="rc-circulo"></div><div class="rc-centro" aria-live="polite"><span class="rc-fase">Prepare-se</span><span class="rc-num">3</span></div></div><p class="rc-ciclos">Sente-se confortável e solte os ombros</p><p class="rc-dica">Respire com suavidade, sem forçar. Se sentir tontura, pare e respire normalmente.</p><button type="button" class="rc-parar">Parar</button>';
      tela.querySelector('.rc-titulo').textContent = titulo;
      document.body.appendChild(tela);
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', tecla);
      var circulo = tela.querySelector('.rc-circulo'), fase = tela.querySelector('.rc-fase'), num = tela.querySelector('.rc-num'), info = tela.querySelector('.rc-ciclos');
      var ciclo = 0;
      tela.querySelector('.rc-parar').onclick = function () { parar(ciclo, titulo); };
      tela.querySelector('.rc-parar').focus();
      if (window.gtag) gtag('event', 'respire_comigo', { tecnica: titulo });
      circulo.style.transitionDuration = '0s';
      circulo.style.transform = 'scale(' + escala(0.12) + ')';
      function contar(seg) {
        var resta = Math.ceil(seg);
        num.textContent = resta;
        var t = setInterval(function () { resta -= 1; if (resta >= 1) num.textContent = resta; }, 1000);
        timers.push(t);
        return t;
      }
      function passo(i) {
        if (!tela) return;
        if (i === 0) { ciclo += 1; info.textContent = 'Ciclo ' + ciclo; }
        var f = ritmo[i];
        limpar();
        var antes = ritmo[(i - 1 + ritmo.length) % ritmo.length];
        fase.textContent = (f.f === 'inspira' && antes.f === 'inspira' && ritmo.length > 1) ? 'Mais um pouco' : (NOME[f.f] || f.f);
        circulo.style.transitionDuration = f.d + 's';
        circulo.style.transform = 'scale(' + escala(f.n) + ')';
        contar(f.d);
        timers.push(setTimeout(function () { passo((i + 1) % ritmo.length); }, f.d * 1000));
      }
      contar(3);
      timers.push(setTimeout(function () { passo(0); }, 3000));
    }
    document.addEventListener('DOMContentLoaded', function () {
      document.querySelectorAll('.grafico-respiracao').forEach(function (fig) {
        var b = fig.querySelector('.respire-comigo');
        if (!b) return;
        b.hidden = false;
        b.addEventListener('click', function () { iniciar(fig, b); });
      });
    });
  })();
  </script>`;

function html(corpo, status = 200) {
  return new Response(corpo, {
    status,
    headers: {
      'content-type': 'text/html;charset=UTF-8',
      'cache-control': 'public, max-age=300',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'SAMEORIGIN'
    }
  });
}

function xml(corpo, tipo) {
  return new Response(corpo, { headers: { 'content-type': tipo + ';charset=UTF-8', 'cache-control': 'public, max-age=3600' } });
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function dataExtenso(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d)).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function head({ titulo, descricao, url, imagem = IMAGEM_PADRAO, tipo = 'website', jsonLd }) {
  return `
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-NGT8N2FM4D"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-NGT8N2FM4D');
  </script>

  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(titulo)}</title>
  <meta name="description" content="${esc(descricao)}">
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
  <link rel="canonical" href="${url}">
  <meta name="author" content="Vladimir Hersen">
  <link rel="alternate" type="application/rss+xml" title="${NOME_BLOG} · Vladimir Hersen" href="${BASE}feed.xml">

  <meta property="og:locale" content="pt_BR">
  <meta property="og:type" content="${tipo}">
  <meta property="og:title" content="${esc(titulo)}">
  <meta property="og:description" content="${esc(descricao)}">
  <meta property="og:url" content="${url}">
  <meta property="og:site_name" content="Vladimir Hersen · Curadoria de Evolução Humana">
  <meta property="og:image" content="${imagem}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(titulo)}">
  <meta name="twitter:description" content="${esc(descricao)}">
  <meta name="twitter:image" content="${imagem}">
  <link rel="icon" type="image/png" href="/favicon.png">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">

  <script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>

  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap" rel="stylesheet">
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            brand: {
              teal: '#005F6B', tealDark: '#004A54', night: '#1A2A3A', mineral: '#3A4B48',
              sage: '#7A9E93', sageLight: '#E5EFEA', sand: '#D9C5A8', canvas: '#F8F9F9',
              border: '#D9E1E0', bgBlog: '#EDF6F7', terracota: '#9E5B38'
            }
          },
          fontFamily: {
            serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
            sans: ['"DM Sans"', 'Helvetica', 'sans-serif']
          }
        }
      }
    }
  </script>
  <style>
    html { scroll-behavior: smooth; }
    body { background-color: ${BG}; color: #3A4B48; font-family: 'DM Sans', sans-serif; -webkit-font-smoothing: antialiased; }
    h1, h2, h3, .font-serif { font-family: 'Cormorant Garamond', Georgia, serif; }
    .text-balance { text-wrap: balance; }
    .texto p { margin: 0 0 1.1rem; }
    .texto h2 { font-size: 1.75rem; color: #1A2A3A; font-weight: 700; margin: 2.25rem 0 1rem; line-height: 1.2; }
    .texto h3 { font-size: 1.4rem; color: #1A2A3A; font-weight: 700; margin: 1.75rem 0 .75rem; }
    .texto blockquote { background: #EDF6F7; padding: 1.5rem; border-left: 4px solid #005F6B; border-radius: .25rem; font-style: italic; color: #1A2A3A; margin: 1.75rem 0; }
    .texto ol, .texto ul { margin: 0 0 1.1rem 1.25rem; }
    .texto ol { list-style: decimal; } .texto ul { list-style: disc; }
    .texto li { margin: .35rem 0; }
    .texto a { color: #005F6B; text-decoration: underline; }
    .texto strong { color: #1A2A3A; font-weight: 600; }
    .texto figure { margin: 1.75rem 0; } .texto img { border-radius: .75rem; width: 100%; }
    .texto .grafico svg { width: 100%; height: auto; display: block; }
    .texto .grafico figcaption { margin-top: .6rem; font-size: .9rem; color: #3A4B48; text-align: center; font-style: italic; }
    .texto .grafico .fonte { display: block; font-size: .78rem; font-style: normal; opacity: .75; margin-top: .2rem; }
  </style>
  <script>
    function toggleMobileMenu() {
      var menu = document.getElementById('mobile-drawer');
      if (menu) { menu.classList.toggle('hidden'); }
    }
  </script>`;
}

function cartao(p, i) {
  const borda = i % 2 === 0 ? 'border-t-brand-teal' : 'border-t-brand-sand';
  return `
      <article class="rounded-2xl bg-white border border-brand-border shadow-sm border-t-4 ${borda} hover:shadow-md transition-shadow">
        <a href="/blog/${p.slug}/" class="block p-8">
          <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-brand-mineral">
            <span class="uppercase tracking-wider font-bold text-brand-teal">${esc(p.categoria)}</span>
            <span>${dataExtenso(p.data)} · ${p.leitura} min de leitura</span>
          </div>
          <h2 class="font-serif text-2xl sm:text-3xl text-brand-night font-bold mt-3 leading-tight">${esc(p.titulo)}</h2>
          <p class="mt-4 text-sm sm:text-base text-brand-mineral leading-relaxed font-light">${esc(p.resumo)}</p>
          <span class="inline-block mt-5 text-sm font-semibold text-brand-teal">Ler o texto completo →</span>
        </a>
      </article>`;
}

function paginaLista(posts) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: NOME_BLOG,
    description: DESCRICAO_BLOG,
    url: BASE,
    inLanguage: 'pt-BR',
    author: { '@type': 'Person', '@id': SITE + '/#person', name: 'Vladimir Hersen', url: SITE + '/' },
    blogPost: posts.map(p => ({ '@type': 'BlogPosting', headline: p.titulo, url: BASE + p.slug + '/', datePublished: p.data }))
  };
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>${head({ titulo: `Blog · ${NOME_BLOG} · Vladimir Hersen`, descricao: DESCRICAO_BLOG, url: BASE, jsonLd })}
</head>
<body class="font-sans antialiased">
  ${navBar('/blog', BG)}

  <section class="pt-20 pb-16 md:pt-28 md:pb-20 border-b border-brand-border/60">
    <div class="max-w-4xl mx-auto px-6 text-center">
      <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-brand-sand bg-white mb-6 shadow-sm">
        <span class="text-xs tracking-widest uppercase font-semibold text-brand-teal">Blog · Artigos de Vladimir Hersen</span>
      </div>
      <h1 class="font-serif text-4xl sm:text-5xl md:text-6xl text-brand-teal tracking-tight leading-[1.12] text-balance font-bold">${NOME_BLOG}</h1>
      <p class="mt-4 text-base sm:text-lg text-brand-mineral leading-relaxed max-w-2xl mx-auto font-light text-balance">
        Não escrevo para entreter a mente com teorias abstratas. Escrevo para ajudar você a soltar o peso dos ombros, restabelecer o fôlego e reencontrar o ânimo de viver.
      </p>
      <p class="mt-10 mb-4 text-xs tracking-widest uppercase font-semibold text-brand-mineral">Explore por tema</p>
      ${chipsTemas(temas(posts))}
    </div>
  </section>

  <section class="py-20 max-w-4xl mx-auto px-6">
    <div class="space-y-10">${posts.map(cartao).join('')}
    </div>
  </section>

  ${footer()}
</body>
</html>`;
}

function paginaPost(p, todos) {
  const url = BASE + p.slug + '/';
  const imagem = p.imagem ? (p.imagem.startsWith('http') ? p.imagem : SITE + p.imagem) : IMAGEM_PADRAO;
  const outros = relacionados(p, todos);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: p.titulo,
    description: p.resumo,
    datePublished: p.data,
    inLanguage: 'pt-BR',
    articleSection: p.categoria,
    image: imagem,
    mainEntityOfPage: url,
    url,
    author: { '@type': 'Person', '@id': SITE + '/#person', name: 'Vladimir Hersen', url: SITE + '/' },
    publisher: { '@type': 'Person', '@id': SITE + '/#person', name: 'Vladimir Hersen' },
    isPartOf: { '@type': 'Blog', name: NOME_BLOG, url: BASE }
  };
  const zap = 'https://wa.me/?text=' + encodeURIComponent(p.titulo + ' ' + url);
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>${head({ titulo: `${p.titulo} · Vladimir Hersen`, descricao: p.resumo, url, imagem, tipo: 'article', jsonLd })}
  <meta property="article:published_time" content="${p.data}">
  <meta property="article:section" content="${esc(p.categoria)}">
</head>
<body class="font-sans antialiased">
  ${navBar('/blog', BG)}

  <main class="py-14 md:py-20 max-w-3xl mx-auto px-6">
    <a href="/blog/" class="text-sm text-brand-teal font-medium hover:underline">← Todos os textos</a>

    <article class="mt-6 p-8 md:p-12 rounded-2xl bg-white border border-brand-border shadow-sm border-t-4 border-t-brand-teal">
      <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-brand-mineral pb-4 mb-6 border-b border-brand-border">
        ${linkTema(p)}
        <span>Por Vladimir Hersen · ${dataExtenso(p.data)} · ${p.leitura} min de leitura</span>
      </div>
      <h1 class="font-serif text-3xl sm:text-5xl text-brand-night font-bold leading-tight text-balance">${esc(p.titulo)}</h1>
      <div class="texto mt-8 text-base sm:text-lg text-brand-mineral font-light leading-relaxed">
${p.html}
      </div>

      <div class="mt-10 pt-6 border-t border-brand-border flex flex-wrap items-center gap-3 text-sm">
        <span class="text-brand-mineral">Compartilhe com quem precisa respirar:</span>
        <a href="${zap}" target="_blank" rel="noopener" class="px-4 py-2 rounded bg-brand-teal text-white font-semibold text-xs tracking-wider uppercase">WhatsApp</a>
      </div>
    </article>

    <aside class="mt-12 p-8 rounded-2xl bg-brand-night text-brand-canvas">
      <p class="font-serif text-2xl text-white font-bold">Quer praticar isso com acompanhamento?</p>
      <p class="mt-2 text-sm font-light text-brand-canvas/80">Na Mentoria Leveza de Viver a gente transforma essas ideias em prática no seu dia a dia.</p>
      <a href="/mentoria-leveza-de-viver/" class="inline-block mt-5 px-5 py-3 rounded bg-brand-sand text-brand-night text-xs tracking-wider uppercase font-semibold">Conhecer a mentoria →</a>
    </aside>
${outros.length ? `
    <section class="mt-14">
      <h2 class="font-serif text-2xl text-brand-night font-bold mb-6">Leia também</h2>
      <div class="space-y-8">${outros.map(cartao).join('')}
      </div>
      <p class="mt-8 text-sm text-brand-mineral">Mais textos sobre ${linkTema(p, 'normal-case tracking-normal')} ou <a href="/blog/" class="text-brand-teal font-semibold hover:underline">todos os textos</a>.</p>
    </section>` : ''}
  </main>

  ${footer()}${p.html.includes('grafico-respiracao') ? RESPIRE_COMIGO : ''}
</body>
</html>`;
}

function paginaTema(tema, todos) {
  const url = BASE + 'tema/' + tema.slug + '/';
  const descricao = `Textos de Vladimir Hersen sobre ${tema.nome}: ${tema.posts.length === 1 ? '1 artigo' : tema.posts.length + ' artigos'} do blog ${NOME_BLOG}.`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: tema.nome,
    description: descricao,
    url,
    inLanguage: 'pt-BR',
    isPartOf: { '@type': 'Blog', name: NOME_BLOG, url: BASE },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Blog', item: BASE },
        { '@type': 'ListItem', position: 2, name: tema.nome, item: url }
      ]
    },
    hasPart: tema.posts.map(p => ({ '@type': 'BlogPosting', headline: p.titulo, url: BASE + p.slug + '/', datePublished: p.data }))
  };
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>${head({ titulo: `${tema.nome} · ${NOME_BLOG} · Vladimir Hersen`, descricao, url, jsonLd })}
</head>
<body class="font-sans antialiased">
  ${navBar('/blog', BG)}

  <section class="pt-16 pb-12 md:pt-24 md:pb-16 border-b border-brand-border/60">
    <div class="max-w-4xl mx-auto px-6 text-center">
      <a href="/blog/" class="text-sm text-brand-teal font-medium hover:underline">← Todos os textos</a>
      <p class="mt-8 text-xs tracking-widest uppercase font-semibold text-brand-mineral">Tema</p>
      <h1 class="mt-2 font-serif text-4xl sm:text-5xl text-brand-teal tracking-tight leading-[1.12] text-balance font-bold">${esc(tema.nome)}</h1>
      <p class="mt-4 text-base text-brand-mineral font-light">${tema.posts.length === 1 ? '1 texto' : tema.posts.length + ' textos'} neste tema</p>
      <div class="mt-10">${chipsTemas(temas(todos), tema.slug)}</div>
    </div>
  </section>

  <section class="py-16 max-w-4xl mx-auto px-6">
    <div class="space-y-10">${tema.posts.map(cartao).join('')}
    </div>
  </section>

  ${footer()}
</body>
</html>`;
}

function pagina404(posts) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>${head({ titulo: 'Texto não encontrado · Vladimir Hersen', descricao: DESCRICAO_BLOG, url: BASE, jsonLd: { '@context': 'https://schema.org', '@type': 'WebPage', name: 'Página não encontrada' } })}
  <meta name="robots" content="noindex">
</head>
<body class="font-sans antialiased">
  ${navBar('/blog', BG)}
  <main class="py-20 max-w-3xl mx-auto px-6 text-center">
    <h1 class="font-serif text-4xl text-brand-teal font-bold">Este texto não está aqui</h1>
    <p class="mt-4 text-brand-mineral font-light">Talvez o endereço tenha mudado. Respire, e veja os textos mais recentes:</p>
    <div class="mt-10 space-y-8 text-left">${posts.slice(0, 3).map(cartao).join('')}</div>
  </main>
  ${footer()}
</body>
</html>`;
}

function sitemap(posts) {
  const urls = [
    { loc: BASE, lastmod: posts[0]?.data },
    ...temas(posts).map(t => ({ loc: BASE + 'tema/' + t.slug + '/', lastmod: t.posts[0].data })),
    ...posts.map(p => ({ loc: BASE + p.slug + '/', lastmod: p.data }))
  ];
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map(u => `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`).join('\n') +
    '\n</urlset>\n';
}

function feed(posts) {
  const rfc = iso => new Date(iso + 'T12:00:00-03:00').toUTCString();
  const itens = posts.slice(0, 20).map(p => `
    <item>
      <title>${esc(p.titulo)}</title>
      <link>${BASE}${p.slug}/</link>
      <guid isPermaLink="true">${BASE}${p.slug}/</guid>
      <pubDate>${rfc(p.data)}</pubDate>
      <category>${esc(p.categoria)}</category>
      <description>${esc(p.resumo)}</description>
      <content:encoded><![CDATA[${p.html.replace(/]]>/g, ']]]]><![CDATA[>')}]]></content:encoded>
    </item>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${NOME_BLOG} · Vladimir Hersen</title>
    <link>${BASE}</link>
    <atom:link href="${BASE}feed.xml" rel="self" type="application/rss+xml"/>
    <description>${esc(DESCRICAO_BLOG)}</description>
    <language>pt-BR</language>${posts[0] ? `
    <lastBuildDate>${rfc(posts[0].data)}</lastBuildDate>` : ''}${itens}
  </channel>
</rss>
`;
}
