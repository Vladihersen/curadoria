// Lê os posts em blog/posts/*.md e gera blog/src/posts.generated.js,
// que o Worker importa. Rodado automaticamente antes de cada deploy.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const pastaPosts = join(raiz, 'posts');
const saida = join(raiz, 'src', 'posts.generated.js');

const OBRIGATORIOS = ['titulo', 'slug', 'categoria', 'data', 'resumo'];

function lerFrontmatter(texto, arquivo) {
  const m = texto.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) throw new Error(`${arquivo}: falta o cabeçalho entre linhas "---".`);
  const dados = {};
  for (const linha of m[1].split(/\r?\n/)) {
    if (!linha.trim() || linha.trim().startsWith('#')) continue;
    const i = linha.indexOf(':');
    if (i === -1) throw new Error(`${arquivo}: linha inválida no cabeçalho: "${linha}"`);
    const chave = linha.slice(0, i).trim();
    let valor = linha.slice(i + 1).trim();
    if (/^".*"$/.test(valor) || /^'.*'$/.test(valor)) valor = valor.slice(1, -1);
    dados[chave] = valor;
  }
  return { dados, corpo: m[2] };
}

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Negrito, itálico e links dentro de uma linha.
function inline(s) {
  return esc(s)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => {
      const externo = /^https?:\/\//.test(u) && !u.includes('vladimirhersen.com.br');
      return `<a href="${u}"${externo ? ' target="_blank" rel="noopener"' : ''}>${t}</a>`;
    })
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
}

// Markdown simples: parágrafos, ## títulos, > citações, listas, imagens.
function markdown(texto) {
  const blocos = texto.replace(/\r/g, '').trim().split(/\n\s*\n/);
  return blocos.map(b => {
    const linhas = b.split('\n');
    if (/^#{2,3} /.test(b)) {
      const n = b.startsWith('###') ? 3 : 2;
      return `<h${n}>${inline(b.replace(/^#+ /, ''))}</h${n}>`;
    }
    if (linhas.every(l => l.startsWith('>'))) {
      return `<blockquote>${inline(linhas.map(l => l.replace(/^>\s?/, '')).join(' '))}</blockquote>`;
    }
    if (linhas.every(l => /^\d+\. /.test(l))) {
      return `<ol>${linhas.map(l => `<li>${inline(l.replace(/^\d+\. /, ''))}</li>`).join('')}</ol>`;
    }
    if (linhas.every(l => /^[-*] /.test(l))) {
      return `<ul>${linhas.map(l => `<li>${inline(l.slice(2))}</li>`).join('')}</ul>`;
    }
    const img = b.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
    if (img) return `<figure><img src="${img[2]}" alt="${esc(img[1])}" loading="lazy"></figure>`;
    return `<p>${linhas.map(inline).join('<br>')}</p>`;
  }).join('\n');
}

const posts = [];
const slugs = new Set();
for (const arquivo of readdirSync(pastaPosts).filter(f => f.endsWith('.md')).sort()) {
  const { dados, corpo } = lerFrontmatter(readFileSync(join(pastaPosts, arquivo), 'utf8'), arquivo);
  for (const c of OBRIGATORIOS) {
    if (!dados[c]) throw new Error(`${arquivo}: falta o campo "${c}".`);
  }
  if (!/^[a-z0-9-]+$/.test(dados.slug)) throw new Error(`${arquivo}: o slug só pode ter letras minúsculas, números e hífens.`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dados.data)) throw new Error(`${arquivo}: a data precisa ser AAAA-MM-DD.`);
  if (slugs.has(dados.slug)) throw new Error(`${arquivo}: o slug "${dados.slug}" já existe em outro post.`);
  slugs.add(dados.slug);
  if (dados.rascunho === 'sim' || dados.rascunho === 'true') continue;
  const palavras = corpo.split(/\s+/).filter(Boolean).length;
  posts.push({
    titulo: dados.titulo,
    slug: dados.slug,
    categoria: dados.categoria,
    data: dados.data,
    leitura: Number(dados.leitura) || Math.max(1, Math.round(palavras / 200)),
    resumo: dados.resumo,
    imagem: dados.imagem || '',
    html: markdown(corpo),
  });
}
posts.sort((a, b) => b.data.localeCompare(a.data) || a.titulo.localeCompare(b.titulo));

writeFileSync(saida, '// Gerado por scripts/build.mjs a partir de posts/*.md. Não edite à mão.\nexport const POSTS = ' + JSON.stringify(posts, null, 2) + ';\n');
console.log(`${posts.length} posts gerados em src/posts.generated.js`);
