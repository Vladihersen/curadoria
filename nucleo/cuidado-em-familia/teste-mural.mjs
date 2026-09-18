import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HTML = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'cuidado.html'));
const srv = http.createServer((q, r) => {
  if (q.url.startsWith('/api')) { r.writeHead(500); return r.end('{}'); }
  r.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}); r.end(HTML);
}).listen(8799);

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const erros = [];
const ctx = await browser.newContext();
const page = await ctx.newPage();
page.on('pageerror', e => erros.push('PAGEERROR: ' + e.message));
// Falhas de rede do ambiente de teste (API falsa, fonte via CDN) não são
// erros do aplicativo — só erros de JavaScript contam.
page.on('console', m => {
  if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) erros.push('CONSOLE: ' + m.text());
});

// --- Cenário 1: usuário QUE JÁ USA o app (dados da versão antiga) ---
await page.goto('http://localhost:8799/');
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('cf_configurado','true');
  localStorage.setItem('cf_nome_paciente','Dona Maria');
  localStorage.setItem('cf_medicamentos', JSON.stringify({
    manha:[{nome:'Losartana',sub:'Com água',qtd:'1 comprimido',tipo:'continuo'},
           {nome:'AAS',sub:'Após comer',qtd:'1 comprimido',tipo:'continuo'}],
    almoco:[],
    noite:[{nome:'Sinvastatina',sub:'Após o jantar',qtd:'1 comprimido',tipo:'continuo'}]
  }));
  // confirmação de hoje no formato ANTIGO
  const agora = new Date();
  localStorage.setItem('cf_confirmado_manha','08:15');
  localStorage.setItem('cf_confirmado_manha_dia', agora.toDateString());
  localStorage.setItem('cf_confirmado_manha_data_br', agora.toLocaleDateString('pt-BR'));
});
await page.reload();
await page.waitForTimeout(1200);

const r1 = await page.evaluate(() => ({
  meds: JSON.parse(localStorage.getItem('cf_medicamentos')),
  cartoes: [...document.querySelectorAll('#container-turnos .card')].map(c => c.id),
  manhaLista: [...document.querySelectorAll('#lista-manha .med-name')].map(e => e.textContent),
  btnManha: document.getElementById('btn-confirmar-manha')?.innerText,
  chaves: CHAVES_TURNO.length,
}));
console.log('--- Cenário 1: usuário existente ---');
console.log('remédios preservados :', JSON.stringify(r1.meds.manha.map(m=>m.nome)), JSON.stringify(r1.meds.noite.map(m=>m.nome)));
console.log('cartões visíveis     :', r1.cartoes.join(', '));
console.log('lista da manhã       :', r1.manhaLista.join(' | '));
console.log('botão manhã          :', JSON.stringify(r1.btnManha));
console.log('total de turnos      :', r1.chaves);

// --- Cenário 2: desmarcar e reconfirmar ---
await page.click('#btn-confirmar-manha');
await page.waitForTimeout(300);
const depoisDesmarcar = await page.evaluate(() => ({
  btn: document.getElementById('btn-confirmar-manha').innerText,
  log: JSON.parse(localStorage.getItem('cf_doses_log_' + new Date().toISOString().slice(0,10)) || '{}')
}));
console.log('\n--- Cenário 2: botão dual ---');
console.log('após desmarcar       :', JSON.stringify(depoisDesmarcar.btn));
console.log('log do dia           :', JSON.stringify(depoisDesmarcar.log.manha));

await page.click('#btn-confirmar-manha');
await page.waitForTimeout(300);
const depoisConfirmar = await page.evaluate(() => ({
  btn: document.getElementById('btn-confirmar-manha').innerText,
  log: JSON.parse(localStorage.getItem('cf_doses_log_' + new Date().toISOString().slice(0,10)) || '{}'),
  meds: JSON.parse(localStorage.getItem('cf_medicamentos'))
}));
console.log('após reconfirmar     :', JSON.stringify(depoisConfirmar.btn));
console.log('histórico preservado :', JSON.stringify(depoisConfirmar.log.manha.historico));
console.log('remédios intactos    :', depoisConfirmar.meds.manha.length, 'na manhã');

// --- Cenário 3: família NOVA, mural em branco ---
const page2 = await ctx.newPage();
page2.on('pageerror', e => erros.push('PAGEERROR2: ' + e.message));
await page2.goto('http://localhost:8799/');
await page2.evaluate(() => { localStorage.clear(); localStorage.setItem('cf_configurado','true'); });
await page2.reload();
await page2.waitForTimeout(1200);
const r3 = await page2.evaluate(() => ({
  cartoes: [...document.querySelectorAll('#container-turnos .card')].map(c => c.id),
  texto: document.getElementById('container-turnos')?.innerText.slice(0,120)
}));
console.log('\n--- Cenário 3: família nova ---');
console.log('cartões pré-marcados :', r3.cartoes.length === 0 ? 'NENHUM (correto)' : r3.cartoes.join(', '));
console.log('tela inicial         :', JSON.stringify(r3.texto.replace(/\n/g,' ')));

// escolher períodos
await page2.click('text=Escolher os períodos do dia');
await page2.waitForTimeout(300);
await page2.evaluate(() => {
  document.querySelectorAll('#lista-escolha-periodos .chk-periodo').forEach(c => {
    if (['jejum','almoco','deitar'].includes(c.dataset.key)) { c.checked = true; aoMarcarPeriodo(c); }
  });
  const h = document.querySelector('#lista-escolha-periodos .hora-periodo[data-key="deitar"]');
  if (h) h.value = '23:15';
});
await page2.click('text=Salvar meus horários');
await page2.waitForTimeout(400);
const r4 = await page2.evaluate(() => ({
  cartoes: [...document.querySelectorAll('#container-turnos .card')].map(c => c.querySelector('.card-title')?.textContent.trim()),
  salvo: localStorage.getItem('cf_turnos_ativos'),
  horas: localStorage.getItem('cf_turnos_horarios')
}));
console.log('\n--- Cenário 4: períodos escolhidos ---');
console.log('cartões no mural     :', r4.cartoes.join(' / '));
console.log('gravado              :', r4.salvo, r4.horas);


// --- Cenário 5: receita lida pela IA acende os horários sozinha ---
await page2.evaluate(() => {
  medsExtraidosIA = [
    { nome:'Omeprazol', sub:'Em jejum, ao acordar', qtd:'1 comprimido', turno:'jejum' },
    { nome:'Dipirona',  sub:'Se tiver dor',         qtd:'1 comprimido', turno:'' },
    { nome:'Rivotril',  sub:'Ao deitar, 22h',       qtd:'1 comprimido', turno:'ao deitar' },
    { nome:'Metformina',sub:'30 min antes do almoço',qtd:'1 comprimido', turno:'' }
  ];
  confirmarETransferirMedsIA();
});
await page2.waitForTimeout(500);
const r5 = await page2.evaluate(() => ({
  ativos: JSON.parse(localStorage.getItem('cf_turnos_ativos')),
  cartoes: [...document.querySelectorAll('#container-turnos .card')].map(c => c.id),
  sos: [...document.querySelectorAll('#lista-extra_sos .med-name')].map(e=>e.textContent),
  antesAlmoco: [...document.querySelectorAll('#lista-antes_almoco .med-name')].map(e=>e.textContent),
  deitar: [...document.querySelectorAll('#lista-deitar .med-name')].map(e=>e.textContent)
}));
console.log('\n--- Cenário 5: receita da IA ---');
console.log('horários acesos      :', r5.ativos.join(', '));
console.log('cartões no mural     :', r5.cartoes.join(', '));
console.log('SOS                  :', r5.sos.join('|'), '| antes_almoco:', r5.antesAlmoco.join('|'), '| deitar:', r5.deitar.join('|'));

// --- Cenário 6: tirar um remédio só de hoje; amanhã ele volta ---
await page2.evaluate(() => { aoAlternarRemedioDose('jejum', 0, false); });
await page2.waitForTimeout(300);
const hoje = await page2.evaluate(() => ({
  chaves: Object.keys(localStorage).filter(k => k.startsWith('cf_desm_')),
  desm: JSON.parse(localStorage.getItem('cf_desm_' + new Date().toDateString()) || '{}'),
  aindaCadastrado: JSON.parse(localStorage.getItem('cf_medicamentos')).jejum.map(m=>m.nome)
}));
console.log('\n--- Cenário 6: pular um remédio só hoje ---');
console.log('marcado como pulado  :', JSON.stringify(hoje.desm));
console.log('chave usada          :', hoje.chaves.join(','), '(inclui a data -> zera amanhã)');
console.log('continua cadastrado  :', hoje.aindaCadastrado.join('|'));
// simula o dia seguinte: a chave de hoje não existe amanhã
const amanha = await page2.evaluate(() => {
  const d = new Date(); d.setDate(d.getDate()+1);
  return { chaveAmanha: 'cf_desm_' + d.toDateString(), existe: !!localStorage.getItem('cf_desm_' + d.toDateString()) };
});
console.log('amanhã               :', amanha.existe ? 'AINDA PULADO (errado)' : 'volta ao normal (correto)');

console.log('\n--- Erros de JS ---');
console.log(erros.length ? erros.join('\n') : 'nenhum');
await browser.close(); srv.close();
process.exit(erros.length ? 1 : 0);
