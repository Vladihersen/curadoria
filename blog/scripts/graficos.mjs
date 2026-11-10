// Gráficos que podem entrar no meio de um post. Viram SVG na hora do build,
// então não pesam a página nem dependem de biblioteca externa.
//
// Dois tipos, escritos dentro do .md entre linhas ":::":
//
//   :::respiracao Título do gráfico
//   inspira 3
//   inspira 1
//   expira 7
//   pausa 1
//   unidade: segundos
//   :::
//
//   :::barras Título do gráfico
//   Rótulo um: 42
//   Rótulo dois: 17
//   fonte: Nome do estudo ou instituição, ano
//   :::
//
// Fases da respiração: inspira, segura, expira, pausa. "unidade" é opcional
// (padrão: segundos; use "tempos" quando o texto fala em contar).
// O gráfico de barras EXIGE a linha "fonte:": número sem fonte não entra no blog.

const COR = {
  inspira: '#005F6B', segura: '#9E5B38', expira: '#7A9E93', pausa: '#B9C7C4',
  texto: '#3A4B48', titulo: '#1A2A3A', linha: '#D9E1E0', fundo: '#F8F9F9', curva: '#004A54'
};
const NOME_FASE = { inspira: 'Inspira', segura: 'Segura', expira: 'Expira', pausa: 'Pausa' };

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function num(s) {
  return Number(String(s).replace(',', '.'));
}

function fmt(n) {
  return String(Math.round(n * 10) / 10).replace('.', ',');
}

export function grafico(tipo, titulo, linhas, arquivo) {
  if (tipo === 'respiracao') return respiracao(titulo, linhas, arquivo);
  if (tipo === 'barras') return barras(titulo, linhas, arquivo);
  throw new Error(`${arquivo}: tipo de gráfico desconhecido ":::${tipo}". Use respiracao ou barras.`);
}

// ---------------------------------------------------------------------------
// Ritmo de uma respiração: curva do volume de ar ao longo de um ciclo.
// É um desenho esquemático do padrão da técnica, não uma medição.
function respiracao(titulo, linhas, arquivo) {
  let unidade = 'segundos';
  const fases = [];
  for (const l of linhas) {
    const u = l.match(/^unidade:\s*(.+)$/i);
    if (u) { unidade = u[1].trim(); continue; }
    const m = l.match(/^(inspira|segura|expira|pausa)\s+([\d.,]+)$/i);
    if (!m) throw new Error(`${arquivo}: linha inválida no gráfico de respiração: "${l}". Ex.: "inspira 4".`);
    const dur = num(m[2]);
    if (!(dur > 0)) throw new Error(`${arquivo}: duração inválida no gráfico de respiração: "${l}".`);
    fases.push({ fase: m[1].toLowerCase(), dur });
  }
  if (!fases.length) throw new Error(`${arquivo}: gráfico de respiração sem fases.`);

  // Nível de ar ao fim de cada fase (0 = vazio, 1 = cheio, de forma esquemática).
  // Inspirações seguidas: a primeira enche ~80%, a última completa.
  const BASE = 0.12, CHEIO = 1, PARCIAL = 0.78;
  let nivel = BASE;
  fases.forEach((f, i) => {
    f.de = nivel;
    if (f.fase === 'inspira') {
      const proxInspira = fases[i + 1]?.fase === 'inspira';
      nivel = proxInspira ? PARCIAL : CHEIO;
    } else if (f.fase === 'expira') {
      nivel = BASE;
    }
    f.ate = nivel;
  });

  const total = fases.reduce((s, f) => s + f.dur, 0);
  const W = 560, H = 300, ML = 16, MR = 16, MT = 20, AREA = 160;
  const x = t => ML + (t / total) * (W - ML - MR);
  const y = v => MT + AREA - v * (AREA - 10);

  // Curva suave: cada fase vai do nível inicial ao final com easing senoidal.
  let t0 = 0;
  const pts = [];
  for (const f of fases) {
    const passos = Math.max(8, Math.round(f.dur * 12));
    for (let k = 0; k <= passos; k++) {
      const p = k / passos;
      const e = (1 - Math.cos(Math.PI * p)) / 2;
      pts.push([x(t0 + f.dur * p), y(f.de + (f.ate - f.de) * e)]);
    }
    f.t0 = t0;
    t0 += f.dur;
  }
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const area = d + ` L ${x(total).toFixed(1)} ${y(0).toFixed(1)} L ${x(0).toFixed(1)} ${y(0).toFixed(1)} Z`;

  const faixas = fases.map(f => {
    const x0 = x(f.t0), x1 = x(f.t0 + f.dur), w = x1 - x0, cx = (x0 + x1) / 2;
    const largo = w >= 70;
    return `
    <rect x="${x0.toFixed(1)}" y="${MT}" width="${w.toFixed(1)}" height="${AREA}" fill="${COR[f.fase]}" opacity="0.10"/>
    <rect x="${(x0 + 1).toFixed(1)}" y="${MT + AREA + 10}" width="${(w - 2).toFixed(1)}" height="8" rx="4" fill="${COR[f.fase]}"/>
    <text x="${cx.toFixed(1)}" y="${MT + AREA + 42}" text-anchor="middle" font-size="${largo ? 19 : 15}" font-weight="600" fill="${COR.titulo}">${largo ? NOME_FASE[f.fase] : NOME_FASE[f.fase].slice(0, 3) + '.'}</text>
    <text x="${cx.toFixed(1)}" y="${MT + AREA + 66}" text-anchor="middle" font-size="${largo ? 18 : 15}" fill="${COR.texto}">${fmt(f.dur)}</text>`;
  }).join('');

  const un = unidade.toLowerCase();
  const descricao = fases.map(f => `${NOME_FASE[f.fase].toLowerCase()} ${fmt(f.dur)}`).join(', ');
  const alt = `${titulo}. Um ciclo: ${descricao} (${un}). Total: ${fmt(total)} ${un}.`;

  return `<figure class="grafico">
<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(alt)}" xmlns="http://www.w3.org/2000/svg" font-family="DM Sans, Helvetica, sans-serif">
  <rect x="0" y="0" width="${W}" height="${H}" rx="14" fill="${COR.fundo}"/>${faixas}
  <path d="${area}" fill="${COR.inspira}" opacity="0.08"/>
  <path d="${d}" fill="none" stroke="${COR.curva}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="${ML}" y1="${y(0)}" x2="${W - MR}" y2="${y(0)}" stroke="${COR.linha}"/>
  <text x="${W - MR}" y="${H - 10}" text-anchor="end" font-size="15" fill="${COR.texto}">Um ciclo: ${fmt(total)} ${esc(un)}</text>
  <text x="${ML}" y="${H - 10}" font-size="15" fill="${COR.texto}">Ar nos pulmões (desenho)</text>
</svg>
<figcaption>${esc(titulo)}</figcaption>
</figure>`;
}

// ---------------------------------------------------------------------------
// Barras horizontais com rótulo e valor. Sempre com fonte.
function barras(titulo, linhas, arquivo) {
  let fonte = '', unidade = '';
  const itens = [];
  for (const l of linhas) {
    const f = l.match(/^fonte:\s*(.+)$/i);
    if (f) { fonte = f[1].trim(); continue; }
    const u = l.match(/^unidade:\s*(.+)$/i);
    if (u) { unidade = u[1].trim(); continue; }
    const m = l.match(/^(.+?):\s*(-?[\d.,]+)\s*$/);
    if (!m) throw new Error(`${arquivo}: linha inválida no gráfico de barras: "${l}". Ex.: "Antes: 42".`);
    itens.push({ rotulo: m[1].trim(), valor: num(m[2]) });
  }
  if (!fonte) throw new Error(`${arquivo}: o gráfico de barras "${titulo}" precisa da linha "fonte:". Número sem fonte não entra no blog.`);
  if (!itens.length) throw new Error(`${arquivo}: gráfico de barras sem itens.`);

  const max = Math.max(...itens.map(i => i.valor), 0) || 1;
  const W = 640, ML = 20, MR = 70, LIN = 58, MT = 16;
  const H = MT + itens.length * LIN + 10;
  const cores = [COR.inspira, COR.expira, COR.segura, COR.curva];
  const sufixo = unidade ? (unidade === '%' ? '%' : ' ' + unidade) : '';

  const barrasSvg = itens.map((it, i) => {
    const yb = MT + i * LIN;
    const w = Math.max(2, (Math.max(it.valor, 0) / max) * (W - ML - MR));
    return `
    <text x="${ML}" y="${yb + 16}" font-size="15" fill="${COR.titulo}" font-weight="600">${esc(it.rotulo)}</text>
    <rect x="${ML}" y="${yb + 24}" width="${w.toFixed(1)}" height="20" rx="4" fill="${cores[i % cores.length]}"/>
    <text x="${(ML + w + 8).toFixed(1)}" y="${yb + 39}" font-size="15" fill="${COR.texto}">${fmt(it.valor)}${esc(sufixo)}</text>`;
  }).join('');

  const alt = `${titulo}. ` + itens.map(i => `${i.rotulo}: ${fmt(i.valor)}${sufixo}`).join('; ') + `. Fonte: ${fonte}.`;
  return `<figure class="grafico">
<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(alt)}" xmlns="http://www.w3.org/2000/svg" font-family="DM Sans, Helvetica, sans-serif">${barrasSvg}
</svg>
<figcaption>${esc(titulo)}<span class="fonte">Fonte: ${esc(fonte)}</span></figcaption>
</figure>`;
}
