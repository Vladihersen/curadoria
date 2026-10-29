// App do Método (piloto do Dia Bem Vivido): API das participantes e painel do Vladimir.
// As telas do app são estáticas (public/dia/). Este Worker só atende /dia/api/* e /dia/painel.

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS dia_participantes (
     id TEXT PRIMARY KEY,
     nome TEXT NOT NULL,
     whatsapp TEXT NOT NULL,
     nota_inicial INTEGER,
     dias_paz_inicial INTEGER,
     criado_em TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS dia_registros (
     participante TEXT NOT NULL,
     dia TEXT NOT NULL,
     manha INTEGER NOT NULL DEFAULT 0,
     pausas INTEGER NOT NULL DEFAULT 0,
     noite INTEGER NOT NULL DEFAULT 0,
     atualizado_em TEXT NOT NULL,
     PRIMARY KEY (participante, dia)
   )`,
  `CREATE TABLE IF NOT EXISTS dia_semanas (
     participante TEXT NOT NULL,
     domingo TEXT NOT NULL,
     nota INTEGER,
     dias_paz INTEGER,
     encontro INTEGER NOT NULL DEFAULT 0,
     encontro_com TEXT,
     efeito_ruim INTEGER NOT NULL DEFAULT 0,
     efeito_texto TEXT,
     duvida TEXT,
     atualizado_em TEXT NOT NULL,
     PRIMARY KEY (participante, domingo)
   )`,
];

let schemaPronto = false;
async function garantirTabelas(db) {
  if (schemaPronto) return;
  await db.batch(SCHEMA.map((sql) => db.prepare(sql)));
  schemaPronto = true;
}

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^[a-f0-9]{32}$/;

function json(dados, status = 200) {
  return new Response(JSON.stringify(dados), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function texto(valor, max) {
  if (typeof valor !== 'string') return '';
  return valor.trim().slice(0, max);
}

function inteiro(valor, min, max) {
  const n = Number(valor);
  if (!Number.isInteger(n) || n < min || n > max) return null;
  return n;
}

function novoId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function lerCorpo(request) {
  try {
    const corpo = await request.json();
    return corpo && typeof corpo === 'object' ? corpo : null;
  } catch {
    return null;
  }
}

async function participanteExiste(db, id) {
  if (!ID.test(id || '')) return false;
  const linha = await db.prepare('SELECT 1 FROM dia_participantes WHERE id = ?').bind(id).first();
  return !!linha;
}

async function entrar(request, env) {
  const c = await lerCorpo(request);
  if (!c) return json({ erro: 'corpo inválido' }, 400);
  const nome = texto(c.nome, 80);
  const whatsapp = texto(c.whatsapp, 30).replace(/[^\d+() -]/g, '');
  const nota = inteiro(c.nota, 0, 10);
  const diasPaz = inteiro(c.dias_paz, 0, 7);
  if (!nome || whatsapp.replace(/\D/g, '').length < 10 || nota === null || diasPaz === null || c.consentimento !== true) {
    return json({ erro: 'preencha nome, WhatsApp com DDD, a nota, os dias de paz e o consentimento' }, 400);
  }
  const id = novoId();
  await env.DB.prepare(
    'INSERT INTO dia_participantes (id, nome, whatsapp, nota_inicial, dias_paz_inicial, criado_em) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(id, nome, whatsapp, nota, diasPaz, new Date().toISOString()).run();
  return json({ id });
}

async function registro(request, env) {
  const c = await lerCorpo(request);
  if (!c || !DATA.test(c.dia || '')) return json({ erro: 'dia inválido' }, 400);
  if (!(await participanteExiste(env.DB, c.id))) return json({ erro: 'participante desconhecida' }, 404);
  const manha = c.manha ? 1 : 0;
  const noite = c.noite ? 1 : 0;
  const pausas = inteiro(c.pausas, 0, 3) ?? 0;
  await env.DB.prepare(
    `INSERT INTO dia_registros (participante, dia, manha, pausas, noite, atualizado_em)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (participante, dia) DO UPDATE SET
       manha = excluded.manha, pausas = excluded.pausas, noite = excluded.noite,
       atualizado_em = excluded.atualizado_em`
  ).bind(c.id, c.dia, manha, pausas, noite, new Date().toISOString()).run();
  return json({ ok: true });
}

async function semana(request, env) {
  const c = await lerCorpo(request);
  if (!c || !DATA.test(c.domingo || '')) return json({ erro: 'domingo inválido' }, 400);
  if (!(await participanteExiste(env.DB, c.id))) return json({ erro: 'participante desconhecida' }, 404);
  const nota = c.nota === null || c.nota === undefined ? null : inteiro(c.nota, 0, 10);
  const diasPaz = c.dias_paz === null || c.dias_paz === undefined ? null : inteiro(c.dias_paz, 0, 7);
  await env.DB.prepare(
    `INSERT INTO dia_semanas (participante, domingo, nota, dias_paz, encontro, encontro_com, efeito_ruim, efeito_texto, duvida, atualizado_em)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (participante, domingo) DO UPDATE SET
       nota = COALESCE(excluded.nota, dia_semanas.nota),
       dias_paz = COALESCE(excluded.dias_paz, dia_semanas.dias_paz), encontro = excluded.encontro,
       encontro_com = excluded.encontro_com,
       efeito_ruim = excluded.efeito_ruim, efeito_texto = excluded.efeito_texto,
       duvida = excluded.duvida, atualizado_em = excluded.atualizado_em`
  ).bind(
    c.id, c.domingo, nota, diasPaz, c.encontro ? 1 : 0, texto(c.encontro_com, 40) || null, c.efeito_ruim ? 1 : 0,
    texto(c.efeito_texto, 600), texto(c.duvida, 600), new Date().toISOString()
  ).run();
  return json({ ok: true });
}

// ---------- Painel ----------

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

function chaveConfere(fornecida, esperada) {
  if (!esperada || typeof fornecida !== 'string' || fornecida.length !== esperada.length) return false;
  let diff = 0;
  for (let i = 0; i < esperada.length; i++) diff |= fornecida.charCodeAt(i) ^ esperada.charCodeAt(i);
  return diff === 0;
}

async function dadosPainel(db) {
  const [p, r, s] = await db.batch([
    db.prepare('SELECT * FROM dia_participantes ORDER BY criado_em'),
    db.prepare(
      `SELECT participante, COUNT(*) AS dias,
              SUM(manha) AS manhas, SUM(pausas) AS pausas, SUM(noite) AS noites,
              SUM(CASE WHEN manha + noite > 0 OR pausas > 0 THEN 1 ELSE 0 END) AS dias_praticados
       FROM dia_registros GROUP BY participante`
    ),
    db.prepare('SELECT * FROM dia_semanas ORDER BY domingo'),
  ]);
  const registros = Object.fromEntries(r.results.map((x) => [x.participante, x]));
  const domingos = [...new Set(s.results.map((x) => x.domingo))].sort();
  const semanas = {};
  for (const x of s.results) (semanas[x.participante] ||= {})[x.domingo] = x;
  return { participantes: p.results, registros, domingos, semanas };
}

function csv(d) {
  const cab = ['nome', 'whatsapp', 'entrou_em', 'nota_inicial', 'dias_paz_inicial', 'dias_praticados', 'manhas', 'pausas', 'noites',
    ...d.domingos.flatMap((dom) => [`nota_${dom}`, `dias_paz_${dom}`, `encontro_${dom}`, `encontro_com_${dom}`, `efeito_ruim_${dom}`, `efeito_texto_${dom}`, `duvida_${dom}`])];
  const linhas = d.participantes.map((p) => {
    const r = d.registros[p.id] || {};
    const sem = d.semanas[p.id] || {};
    return [p.nome, p.whatsapp, p.criado_em.slice(0, 10), p.nota_inicial, p.dias_paz_inicial ?? '', r.dias_praticados ?? 0,
      r.manhas ?? 0, r.pausas ?? 0, r.noites ?? 0,
      ...d.domingos.flatMap((dom) => {
        const w = sem[dom] || {};
        return [w.nota ?? '', w.dias_paz ?? '', w.encontro ? 'sim' : '', w.encontro_com ?? '', w.efeito_ruim ? 'sim' : '', w.efeito_texto ?? '', w.duvida ?? ''];
      })];
  });
  return [cab, ...linhas].map((l) => l.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
}

function htmlPainel(d, chave) {
  const alertas = [];
  const linhas = d.participantes.map((p) => {
    const r = d.registros[p.id] || {};
    const sem = d.semanas[p.id] || {};
    const celulas = d.domingos.map((dom) => {
      const w = sem[dom];
      if (!w) return '<td class="vazio">–</td>';
      if (w.efeito_ruim) alertas.push({ nome: p.nome, whatsapp: p.whatsapp, dom, texto: w.efeito_texto });
      return `<td>${w.nota ?? '–'} · ${w.dias_paz ?? '–'}d${w.efeito_ruim ? ' <b class="alerta">!</b>' : ''}</td>`;
    }).join('');
    return `<tr><td>${esc(p.nome)}</td><td>${esc(p.whatsapp)}</td><td>${p.nota_inicial ?? '–'} · ${p.dias_paz_inicial ?? '–'}d</td>${celulas}<td>${r.dias_praticados ?? 0}</td></tr>`;
  }).join('');
  const duvidas = d.participantes.flatMap((p) => Object.values(d.semanas[p.id] || {})
    .filter((w) => w.duvida).map((w) => `<li><b>${esc(p.nome)}</b> (${esc(w.domingo)}): ${esc(w.duvida)}</li>`)).join('');
  const listaAlertas = alertas.map((a) => `<li><b>${esc(a.nome)}</b> · ${esc(a.whatsapp)} (${esc(a.dom)}): ${esc(a.texto || 'sem detalhe')}</li>`).join('');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Painel do piloto</title>
<style>
body{font-family:system-ui,sans-serif;margin:0;padding:16px;background:#faf8f3;color:#2b2a26}
h1{font-size:1.4rem}h2{font-size:1.1rem;margin-top:28px}
.tab{overflow-x:auto}table{border-collapse:collapse;min-width:100%;background:#fff}
th,td{border:1px solid #e3ded2;padding:8px 10px;text-align:left;font-size:.95rem;white-space:nowrap}
th{background:#efe9dc}.vazio{color:#aaa}.alerta{color:#b3261e}
a.botao{display:inline-block;margin-top:8px;padding:10px 14px;background:#5b7f5a;color:#fff;border-radius:8px;text-decoration:none}
</style></head><body>
<h1>Painel do piloto · ${d.participantes.length} participantes</h1>
<p>Cada domingo mostra a nota de satisfação (0 a 10) · os dias de paz na semana (0 a 7). "!" marca quem relatou algo que fez mal ou ficou difícil.</p>
<div class="tab"><table><thead><tr><th>Nome</th><th>WhatsApp</th><th>Início (nota · dias de paz)</th>
${d.domingos.map((dom) => `<th>${esc(dom.slice(8, 10) + '/' + dom.slice(5, 7))}</th>`).join('')}<th>Dias praticados</th></tr></thead>
<tbody>${linhas || '<tr><td colspan="4">Ninguém entrou ainda.</td></tr>'}</tbody></table></div>
<h2>Relatos de efeito ruim</h2><ul>${listaAlertas || '<li>Nenhum.</li>'}</ul>
<h2>Dúvidas</h2><ul>${duvidas || '<li>Nenhuma.</li>'}</ul>
<a class="botao" href="/dia/painel?chave=${encodeURIComponent(chave)}&formato=csv">Baixar planilha (CSV)</a>
</body></html>`;
}

async function painel(request, env) {
  const url = new URL(request.url);
  const chave = url.searchParams.get('chave') || '';
  if (!chaveConfere(chave, env.ADMIN_KEY)) {
    return new Response('Acesso restrito.', { status: 401, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }
  const d = await dadosPainel(env.DB);
  if (url.searchParams.get('formato') === 'csv') {
    return new Response('﻿' + csv(d), {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': 'attachment; filename="piloto-dia-bem-vivido.csv"',
        'cache-control': 'no-store',
      },
    });
  }
  return new Response(htmlPainel(d, chave), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const rota = url.pathname;
    try {
      if (rota.startsWith('/dia/api/') || rota.startsWith('/dia/painel')) await garantirTabelas(env.DB);
      if (rota.startsWith('/dia/painel')) return await painel(request, env);
      if (rota.startsWith('/dia/api/')) {
        if (request.method !== 'POST') return json({ erro: 'método não permitido' }, 405);
        if (rota === '/dia/api/entrar') return await entrar(request, env);
        if (rota === '/dia/api/registro') return await registro(request, env);
        if (rota === '/dia/api/semana') return await semana(request, env);
        return json({ erro: 'rota desconhecida' }, 404);
      }
    } catch (e) {
      console.error('dia-bem-vivido', rota, e && e.stack || e);
      return json({ erro: 'falha no servidor' }, 500);
    }
    return env.ASSETS.fetch(request);
  },
};
