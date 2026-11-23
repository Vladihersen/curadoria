// App do Método Bem Viver (piloto): API das participantes e painel do Vladimir.
// As telas do app são estáticas (public/bemviver/). Este Worker só atende /bemviver/api/* e /bemviver/painel.

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
     respiros INTEGER NOT NULL DEFAULT 0,
     tensao_antes REAL,
     tensao_depois REAL,
     movimento INTEGER NOT NULL DEFAULT 0,
     vida INTEGER NOT NULL DEFAULT 0,
     contato INTEGER NOT NULL DEFAULT 0,
     noite INTEGER NOT NULL DEFAULT 0,
     paz INTEGER,
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
     livre TEXT,
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

// Piloto de 23/11 a 20/12/2026. Mesma data de início do app (INICIO_PILOTO em app.js).
const INICIO_PILOTO = '2026-11-23';
const FIM_PILOTO = '2026-12-20';
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
  // Quem se cadastra de novo com o mesmo WhatsApp (outro navegador, celular trocado,
  // dados apagados) volta para o mesmo cadastro, sem duplicar a participante.
  const existente = await buscarPorWhatsapp(env.DB, whatsapp);
  if (existente) return json({ id: existente.id, voltou: true });
  const id = novoId();
  await env.DB.prepare(
    'INSERT INTO dia_participantes (id, nome, whatsapp, nota_inicial, dias_paz_inicial, criado_em) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(id, nome, whatsapp, nota, diasPaz, new Date().toISOString()).run();
  return json({ id });
}

function soDigitos(w) {
  // Só os dígitos; a comparação usa os 10 últimos (ignora +55, espaços, parênteses e traços).
  return String(w || '').replace(/\D/g, '');
}

async function buscarPorWhatsapp(db, whatsapp) {
  const alvo = soDigitos(whatsapp);
  if (alvo.length < 10) return null;
  const { results } = await db.prepare('SELECT id, nome, whatsapp FROM dia_participantes ORDER BY criado_em').all();
  return (results || []).find((p) => soDigitos(p.whatsapp).slice(-10) === alvo.slice(-10)) || null;
}

// "Já me cadastrei": a participante digita só o WhatsApp e o app volta a reconhecê-la.
async function voltar(request, env) {
  const c = await lerCorpo(request);
  if (!c) return json({ erro: 'corpo inválido' }, 400);
  const p = await buscarPorWhatsapp(env.DB, texto(c.whatsapp, 30));
  if (!p) return json({ erro: 'nao_encontrado' }, 404);
  return json({ id: p.id, nome: String(p.nome || '').trim().split(/\s+/)[0] });
}

async function registro(request, env) {
  const c = await lerCorpo(request);
  if (!c || !DATA.test(c.dia || '')) return json({ erro: 'dia inválido' }, 400);
  if (!(await participanteExiste(env.DB, c.id))) return json({ erro: 'participante desconhecida' }, 404);
  const tensao = (v) => {
    const n = Number(v);
    return v === null || v === undefined || !Number.isFinite(n) || n < 0 || n > 10 ? null : Math.round(n * 10) / 10;
  };
  const respiros = inteiro(c.respiros, 0, 50) ?? 0;
  const antes = respiros ? tensao(c.tensao_antes) : null;
  const depois = respiros ? tensao(c.tensao_depois) : null;
  const movimento = inteiro(c.movimento, 0, 3) ?? 0;
  const paz = c.paz === true ? 1 : c.paz === false ? 0 : null;
  await env.DB.prepare(
    `INSERT INTO dia_registros (participante, dia, respiros, tensao_antes, tensao_depois, movimento, vida, contato, noite, paz, atualizado_em)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (participante, dia) DO UPDATE SET
       respiros = excluded.respiros, tensao_antes = excluded.tensao_antes, tensao_depois = excluded.tensao_depois,
       movimento = excluded.movimento, vida = excluded.vida, contato = excluded.contato,
       noite = excluded.noite, paz = excluded.paz, atualizado_em = excluded.atualizado_em`
  ).bind(c.id, c.dia, respiros, antes, depois, movimento, c.vida ? 1 : 0, c.contato ? 1 : 0, c.noite ? 1 : 0, paz,
    new Date().toISOString()).run();
  return json({ ok: true });
}

async function semana(request, env) {
  const c = await lerCorpo(request);
  if (!c || !DATA.test(c.domingo || '')) return json({ erro: 'domingo inválido' }, 400);
  if (!(await participanteExiste(env.DB, c.id))) return json({ erro: 'participante desconhecida' }, 404);
  const nota = c.nota === null || c.nota === undefined ? null : inteiro(c.nota, 0, 10);
  const diasPaz = c.dias_paz === null || c.dias_paz === undefined ? null : inteiro(c.dias_paz, 0, 7);
  await env.DB.prepare(
    `INSERT INTO dia_semanas (participante, domingo, nota, dias_paz, encontro, encontro_com, efeito_ruim, efeito_texto, duvida, livre, atualizado_em)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (participante, domingo) DO UPDATE SET
       nota = COALESCE(excluded.nota, dia_semanas.nota),
       dias_paz = COALESCE(excluded.dias_paz, dia_semanas.dias_paz), encontro = excluded.encontro,
       encontro_com = excluded.encontro_com,
       efeito_ruim = excluded.efeito_ruim, efeito_texto = excluded.efeito_texto,
       duvida = excluded.duvida, livre = excluded.livre, atualizado_em = excluded.atualizado_em`
  ).bind(
    c.id, c.domingo, nota, diasPaz, c.encontro ? 1 : 0, texto(c.encontro_com, 40) || null, c.efeito_ruim ? 1 : 0,
    texto(c.efeito_texto, 600), texto(c.duvida, 600), texto(c.livre, 2000), new Date().toISOString()
  ).run();
  return json({ ok: true });
}

// ---------- Jardim da turma (mural coletivo e anônimo) ----------
// Cada participante que marca ao menos uma prática num dia planta uma flor naquele dia
// (a mesma regra do "✓" do painel). O app só recebe totais da turma: nunca nomes,
// nunca quem praticou ou deixou de praticar, nunca o total de cadastradas (o "de 16"
// convida a contar quem faltou). O jardim é da semana (recomeça na segunda) e só cresce.

// Abaixo deste número, o total de hoje não aparece: de manhã o número é sempre baixo,
// e "1 pessoa" desanima em vez de animar.
const MINIMO_HOJE = 3;
// Marcos da turma inteira, desde 23/11. Celebrados uma vez, sem meta individual.
const MARCOS = [50, 100, 200, 300, 400, 500];

// contagens: [{ dia, n }] com quantas participantes praticaram em cada dia.
export function resumoMural(contagens, hoje) {
  if (hoje < INICIO_PILOTO) return { fase: 'antes' };
  const fim = hoje > FIM_PILOTO;
  const ate = fim ? FIM_PILOTO : hoje;
  const porDia = {};
  for (const c of contagens || []) {
    if (DATA.test(c.dia || '') && c.dia >= INICIO_PILOTO && c.dia <= ate) porDia[c.dia] = Number(c.n) || 0;
  }
  const semanaDe = (dia) => Math.floor((Date.parse(dia + 'T12:00:00Z') - Date.parse(INICIO_PILOTO + 'T12:00:00Z')) / 86400000 / 7) + 1;
  const semana = Math.min(4, semanaDe(ate));
  let total = 0, daSemana = 0;
  for (const [dia, n] of Object.entries(porDia)) {
    total += n;
    if (semanaDe(dia) === semana) daSemana += n;
  }
  const marco = [...MARCOS].reverse().find((m) => total >= m) || null;
  if (fim) return { fase: 'fim', semana: 4, flores_semana: daSemana, flores_total: total, marco };
  const nHoje = porDia[hoje] || 0;
  return {
    fase: 'durante', semana, flores_semana: daSemana, flores_total: total, marco,
    hoje: nHoje >= MINIMO_HOJE ? nHoje : null,
  };
}

export async function mural(request, env, hoje = hojeBrasilia()) {
  const c = await lerCorpo(request);
  if (!c) return json({ erro: 'corpo inválido' }, 400);
  if (!(await participanteExiste(env.DB, c.id))) return json({ erro: 'participante desconhecida' }, 404);
  const { results } = await env.DB.prepare(
    `SELECT dia, COUNT(DISTINCT participante) AS n FROM dia_registros
     WHERE dia >= ? AND dia <= ? AND respiros + movimento + vida + contato + noite > 0
     GROUP BY dia`
  ).bind(INICIO_PILOTO, hoje < FIM_PILOTO ? hoje : FIM_PILOTO).all();
  return json(resumoMural(results, hoje));
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
  const [p, r, s, pd] = await db.batch([
    db.prepare('SELECT * FROM dia_participantes ORDER BY criado_em'),
    db.prepare(
      `SELECT participante, COUNT(*) AS dias,
              SUM(respiros) AS respiros,
              ROUND(SUM(tensao_antes * respiros) / NULLIF(SUM(CASE WHEN tensao_antes IS NULL THEN 0 ELSE respiros END), 0), 1) AS tensao_antes,
              ROUND(SUM(tensao_depois * respiros) / NULLIF(SUM(CASE WHEN tensao_depois IS NULL THEN 0 ELSE respiros END), 0), 1) AS tensao_depois,
              SUM(CASE WHEN movimento > 0 THEN 1 ELSE 0 END) AS dias_movimento,
              SUM(vida) AS dias_vida, SUM(contato) AS dias_contato, SUM(noite) AS noites,
              SUM(CASE WHEN paz = 1 THEN 1 ELSE 0 END) AS dias_paz_marcados,
              SUM(CASE WHEN respiros + movimento + vida + contato + noite > 0 THEN 1 ELSE 0 END) AS dias_praticados
       FROM dia_registros GROUP BY participante`
    ),
    db.prepare('SELECT * FROM dia_semanas ORDER BY domingo'),
    db.prepare(
      `SELECT participante, dia FROM dia_registros
       WHERE dia >= ? AND dia <= ? AND respiros + movimento + vida + contato + noite > 0`
    ).bind(INICIO_PILOTO, FIM_PILOTO),
  ]);
  const registros = Object.fromEntries(r.results.map((x) => [x.participante, x]));
  const domingos = [...new Set(s.results.map((x) => x.domingo))].sort();
  const semanas = {};
  for (const x of s.results) (semanas[x.participante] ||= {})[x.domingo] = x;
  const praticas = {};
  for (const x of pd.results) (praticas[x.participante] ||= new Set()).add(x.dia);
  return { participantes: p.results, registros, domingos, semanas, praticas, dias: diasDoPiloto(), hoje: hojeBrasilia() };
}

// ---------- Dia a dia ----------

// Data de hoje no horário de Brasília (o painel é lido no Brasil; o servidor roda em UTC).
function hojeBrasilia() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

function somarDias(iso, n) {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Dias do piloto de 23/11 até hoje (ou até 20/12, depois que o piloto acabar).
function diasDoPiloto() {
  const ate = hojeBrasilia() < FIM_PILOTO ? hojeBrasilia() : FIM_PILOTO;
  const dias = [];
  for (let d = INICIO_PILOTO; d <= ate; d = somarDias(d, 1)) dias.push(d);
  return dias;
}

const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
function diaDaSemana(iso) { return SEMANA[new Date(iso + 'T12:00:00Z').getUTCDay()]; }

// Quem não marcou nenhuma prática nos 3 dias anteriores a hoje (hoje ainda não acabou).
// Só a partir do 4º dia do piloto, para ninguém aparecer aqui no começo.
function semMarcarHa3Dias(d) {
  const tres = [1, 2, 3].map((n) => somarDias(d.hoje, -n));
  if (tres[2] < INICIO_PILOTO) return [];
  return d.participantes
    .filter((p) => !tres.some((dia) => d.praticas[p.id]?.has(dia)))
    .map((p) => {
      const feitos = [...(d.praticas[p.id] || [])].sort();
      return { nome: p.nome, whatsapp: p.whatsapp, ultimo: feitos.length ? feitos[feitos.length - 1] : null };
    });
}

function htmlDiaADia(d) {
  const total = d.participantes.length;
  const hojeNoPiloto = d.hoje >= INICIO_PILOTO && d.hoje <= FIM_PILOTO;
  const praticaramHoje = d.participantes.filter((p) => d.praticas[p.id]?.has(d.hoje)).length;
  const sumidas = semMarcarHa3Dias(d);
  // Dia mais recente primeiro: no celular, hoje aparece sem precisar arrastar a tabela.
  const recentes = [...d.dias].reverse();
  const cab = recentes.map((dia) => `<th class="dia${dia === d.hoje ? ' hoje' : ''}">${diaDaSemana(dia)}<br>${esc(dia.slice(8, 10) + '/' + dia.slice(5, 7))}</th>`).join('');
  const linhas = d.participantes.map((p) => {
    const feitos = d.praticas[p.id] || new Set();
    const celulas = recentes.map((dia) => (feitos.has(dia)
      ? `<td class="dia sim${dia === d.hoje ? ' hoje' : ''}">✓</td>`
      : `<td class="dia nao${dia === d.hoje ? ' hoje' : ''}">·</td>`)).join('');
    return `<tr><th class="nome">${esc(p.nome)}</th>${celulas}<td>${feitos.size} de ${d.dias.length}</td></tr>`;
  }).join('');
  const resumo = hojeNoPiloto
    ? `<p class="destaque">Hoje, ${esc(diaDaSemana(d.hoje))} ${esc(d.hoje.slice(8, 10) + '/' + d.hoje.slice(5, 7))}: <b>${praticaramHoje} de ${total}</b> já marcaram alguma prática.</p>`
    : d.hoje < INICIO_PILOTO ? '<p class="destaque">O piloto começa em 23/11.</p>' : '<p class="destaque">O piloto terminou em 20/12.</p>';
  const listaSumidas = sumidas.map((x) => `<li><b>${esc(x.nome)}</b> · ${esc(x.whatsapp)} · ${x.ultimo ? `última prática marcada em ${esc(x.ultimo.slice(8, 10) + '/' + x.ultimo.slice(5, 7))}` : 'ainda não marcou nenhuma prática'}</li>`).join('');
  return `<h2>Dia a dia</h2>
${resumo}
<p>✓ = marcou ao menos uma prática no app naquele dia (suspiro, movimento, a coisa que dá vida, gesto de carinho ou noite). Sem ✓ não quer dizer que não praticou: a pessoa pode ter praticado sem tocar no botão.</p>
${d.dias.length ? `<div class="tab"><table class="grade"><thead><tr><th class="nome">Nome</th>${cab}<th>Total</th></tr></thead>
<tbody>${linhas || `<tr><td colspan="${d.dias.length + 2}">Ninguém entrou ainda.</td></tr>`}</tbody></table></div>` : ''}
${sumidas.length || (d.dias.length >= 4 && hojeNoPiloto) ? `<h3>Sem marcar nada nos últimos 3 dias</h3>
<p class="suave">Para uma mensagem de cuidado no individual, nunca no grupo.</p>
<ul>${listaSumidas || '<li>Ninguém.</li>'}</ul>` : ''}`;
}

function csv(d) {
  const cab = ['nome', 'whatsapp', 'entrou_em', 'nota_inicial', 'dias_paz_inicial', 'dias_praticados', 'respiros', 'tensao_antes_media',
    'tensao_depois_media', 'dias_movimento', 'dias_vida', 'dias_contato', 'noites', 'dias_paz_marcados',
    ...d.dias.map((dia) => `pratica_${dia}`),
    ...d.domingos.flatMap((dom) => [`nota_${dom}`, `dias_paz_${dom}`, `encontro_${dom}`, `encontro_com_${dom}`, `efeito_ruim_${dom}`, `efeito_texto_${dom}`, `duvida_${dom}`, `espaco_livre_${dom}`])];
  const linhas = d.participantes.map((p) => {
    const r = d.registros[p.id] || {};
    const sem = d.semanas[p.id] || {};
    return [p.nome, p.whatsapp, p.criado_em.slice(0, 10), p.nota_inicial, p.dias_paz_inicial ?? '', r.dias_praticados ?? 0,
      r.respiros ?? 0, r.tensao_antes ?? '', r.tensao_depois ?? '', r.dias_movimento ?? 0, r.dias_vida ?? 0,
      r.dias_contato ?? 0, r.noites ?? 0, r.dias_paz_marcados ?? 0,
      ...d.dias.map((dia) => (d.praticas[p.id]?.has(dia) ? 'sim' : '')),
      ...d.domingos.flatMap((dom) => {
        const w = sem[dom] || {};
        return [w.nota ?? '', w.dias_paz ?? '', w.encontro ? 'sim' : '', w.encontro_com ?? '', w.efeito_ruim ? 'sim' : '', w.efeito_texto ?? '', w.duvida ?? '', w.livre ?? ''];
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
    return `<tr><td>${esc(p.nome)}</td><td>${esc(p.whatsapp)}</td><td>${p.nota_inicial ?? '–'} · ${p.dias_paz_inicial ?? '–'}d</td>${celulas}<td>${r.dias_praticados ?? 0}</td><td>${r.respiros ? `${r.respiros} · ${r.tensao_antes ?? '–'} → ${r.tensao_depois ?? '–'}` : '–'}</td><td>${r.dias_movimento ?? 0} · ${r.dias_vida ?? 0} · ${r.dias_contato ?? 0} · ${r.noites ?? 0}</td></tr>`;
  }).join('');
  const duvidas = d.participantes.flatMap((p) => Object.values(d.semanas[p.id] || {})
    .filter((w) => w.duvida).map((w) => `<li><b>${esc(p.nome)}</b> (${esc(w.domingo)}): ${esc(w.duvida)}</li>`)).join('');
  const livres = d.participantes.flatMap((p) => Object.values(d.semanas[p.id] || {})
    .filter((w) => w.livre).map((w) => `<li><b>${esc(p.nome)}</b> (${esc(w.domingo)}): ${esc(w.livre).replace(/\n/g, '<br>')}</li>`)).join('');
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
.destaque{font-size:1.1rem}.suave{color:#6b675c;margin-top:-4px}h3{font-size:1rem;margin-top:20px}
.grade th.nome{position:sticky;left:0;background:#fff;z-index:1;font-weight:normal}
.grade thead th.nome{background:#efe9dc}
.grade .dia{text-align:center;padding:6px 8px;font-size:.85rem}
.grade td.sim{color:#2f6b35;font-weight:bold;font-size:1.05rem}.grade td.nao{color:#bbb}
.grade .hoje{background:#f3f7ee}.grade thead th.hoje{background:#dfe9d3}
a.botao{display:inline-block;margin-top:8px;padding:10px 14px;background:#5b7f5a;color:#fff;border-radius:8px;text-decoration:none}
</style></head><body>
<h1>Painel do piloto · ${d.participantes.length} participantes</h1>
<p>Cada domingo mostra a nota de satisfação (0 a 10) · os dias de paz na semana (0 a 7). "!" marca quem relatou algo que fez mal ou ficou difícil. A tensão (0 a 10) é a média dada antes e depois do suspiro fisiológico.</p>
${htmlDiaADia(d)}
<h2>Semanas e totais</h2>
<div class="tab"><table><thead><tr><th>Nome</th><th>WhatsApp</th><th>Início (nota · dias de paz)</th>
${d.domingos.map((dom) => `<th>${esc(dom.slice(8, 10) + '/' + dom.slice(5, 7))}</th>`).join('')}<th>Dias praticados</th><th>Suspiros · tensão antes → depois</th><th>Dias: movimento · vida · gesto de carinho · noite</th></tr></thead>
<tbody>${linhas || '<tr><td colspan="6">Ninguém entrou ainda.</td></tr>'}</tbody></table></div>
<h2>Relatos de efeito ruim</h2><ul>${listaAlertas || '<li>Nenhum.</li>'}</ul>
<h2>Dúvidas</h2><ul>${duvidas || '<li>Nenhuma.</li>'}</ul>
<h2>Espaço livre (desabafos, agradecimentos)</h2><ul>${livres || '<li>Nada ainda.</li>'}</ul>
<a class="botao" href="/bemviver/painel?chave=${encodeURIComponent(chave)}&formato=csv">Baixar planilha (CSV)</a>
</body></html>`;
}

// Tela de entrada do painel: campo de senha. Envia ?chave=, o mesmo do link direto.
function htmlEntrar(errou) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Painel do piloto</title>
<style>
body{font-family:system-ui,sans-serif;margin:0;padding:16px;background:#faf8f3;color:#2b2a26;display:flex;min-height:90vh;align-items:center;justify-content:center}
form{background:#fff;border:1px solid #e3ded2;border-radius:12px;padding:24px;max-width:340px;width:100%;box-sizing:border-box}
h1{font-size:1.3rem;margin:0 0 16px}label{display:block;font-size:1.05rem;margin-bottom:6px}
input{width:100%;box-sizing:border-box;font-size:1.1rem;padding:12px;border:1px solid #c9c2b2;border-radius:8px}
button{margin-top:14px;width:100%;font-size:1.1rem;padding:12px;background:#5b7f5a;color:#fff;border:0;border-radius:8px}
.erro{color:#b3261e;margin:12px 0 0}
</style></head><body>
<form method="get" action="/bemviver/painel">
<h1>Painel do piloto</h1>
<label for="chave">Senha</label>
<input id="chave" name="chave" type="password" autocomplete="current-password" required autofocus>
${errou ? '<p class="erro">Senha incorreta. Tente de novo.</p>' : ''}
<button type="submit">Entrar</button>
</form></body></html>`;
}

async function painel(request, env) {
  const url = new URL(request.url);
  const chave = url.searchParams.get('chave') || '';
  if (!chaveConfere(chave, env.ADMIN_KEY)) {
    return new Response(htmlEntrar(chave !== ''), {
      status: chave ? 401 : 200,
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' },
    });
  }
  const d = await dadosPainel(env.DB);
  if (url.searchParams.get('formato') === 'csv') {
    return new Response('﻿' + csv(d), {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': 'attachment; filename="piloto-metodo-bem-viver.csv"',
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
      if (rota.startsWith('/bemviver/api/') || rota.startsWith('/bemviver/painel')) await garantirTabelas(env.DB);
      if (rota.startsWith('/bemviver/painel')) return await painel(request, env);
      if (rota.startsWith('/bemviver/api/')) {
        if (request.method !== 'POST') return json({ erro: 'método não permitido' }, 405);
        if (rota === '/bemviver/api/entrar') return await entrar(request, env);
        if (rota === '/bemviver/api/voltar') return await voltar(request, env);
        if (rota === '/bemviver/api/registro') return await registro(request, env);
        if (rota === '/bemviver/api/semana') return await semana(request, env);
        if (rota === '/bemviver/api/mural') return await mural(request, env);
        return json({ erro: 'rota desconhecida' }, 404);
      }
    } catch (e) {
      console.error('metodo-bem-viver', rota, e && e.stack || e);
      return json({ erro: 'falha no servidor' }, 500);
    }
    return env.ASSETS.fetch(request);
  },
};
