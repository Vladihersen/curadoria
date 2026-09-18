// Cobre os três pedidos: virada do dia, exclusão de remédio suspenso e
// lista recolhível por horário.
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs';
import path from 'path'; import { fileURLToPath } from 'url';
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const HTML = fs.readFileSync(path.join(AQUI, 'cuidado.html'), 'utf8');
const srv = http.createServer((q,r)=>{ if(q.url.startsWith('/api')){r.writeHead(500);return r.end('{}');}
  r.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}); r.end(HTML);}).listen(8820);
const b = await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {});
const p = await (await b.newContext()).newPage();
const erros = []; p.on('pageerror', e => erros.push(e.message));
p.on('console', m => { if (m.type()==='error' && !/Failed to load resource/.test(m.text())) erros.push(m.text()); });

await p.goto('http://localhost:8820/');
await p.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('cf_configurado','true');
  localStorage.setItem('cf_medicamentos', JSON.stringify({
    manha:[{nome:'Glifage XR 500mg',sub:'no café',qtd:'2 comprimidos'},
           {nome:'Dapagliflozina 10mg',sub:'pela manhã',qtd:'1 comprimido'},
           {nome:'Inzelm 10mg',sub:'se necessário',qtd:'1 comprimido'}],
    almoco:[], noite:[{nome:'Aspirina Prevent 100mg',sub:'à noite',qtd:'1 comprimido'}]}));
  localStorage.setItem('cf_meds_encerrados', JSON.stringify([
    {nome:'Diovan 320mg', dataEncerramento:'18/09/2026', motivo:'Substituído por nova receita', turno:'manha', sub:'x', qtd:'1 comprimido'}]));
  // Estado de ONTEM: uma dose desmarcada e um SOS marcado
  const ontem = new Date(); ontem.setDate(ontem.getDate()-1);
  localStorage.setItem('cf_desm_' + ontem.toDateString(), JSON.stringify({manha:[1]}));
  localStorage.setItem('cf_sos_'  + ontem.toDateString(), JSON.stringify({manha:[2]}));
});
await p.reload(); await p.waitForTimeout(1200);

let falhas = 0;
const ok = (nome, cond, det='') => { if(cond) console.log('  ✓ '+nome); else { falhas++; console.log('  ✗ '+nome+(det?' → '+det:'')); } };

console.log('1. Virada do dia (app aberto desde ontem)');
// Simula o app tendo sido carregado ontem, como num celular que ficou aberto.
await p.evaluate(() => {
  const ontem = new Date(); ontem.setDate(ontem.getDate()-1);
  diaEmExibicao = ontem.toDateString();
  remediosDesmarcadosHoje = { manha: [1] };
  remediosSosTomadosHoje  = { manha: [2] };
  renderizarMedicamentos();
});
await p.waitForTimeout(300);
const antes = await p.evaluate(() => ({
  desm: JSON.stringify(remediosDesmarcadosHoje),
  riscado: !!document.querySelector('#lista-manha .med-name[style*="line-through"]')
}));
console.log('   estado de ontem na tela :', antes.desm, '| remédio riscado:', antes.riscado);
const virou = await p.evaluate(() => verificarViradaDoDia());
await p.waitForTimeout(300);
const depois = await p.evaluate(() => ({
  virou: true,
  desm: JSON.stringify(remediosDesmarcadosHoje),
  sos: JSON.stringify(remediosSosTomadosHoje),
  riscado: !!document.querySelector('#lista-manha .med-name[style*="line-through"]'),
  marcados: [...document.querySelectorAll('#lista-manha .chk-remedio-dose')].map(c=>c.checked)
}));
ok('detectou a virada', virou);
ok('doses voltaram a ficar em aberto', depois.desm === '{}', depois.desm);
ok('SOS de ontem desmarcado', depois.sos === '{}', depois.sos);
ok('nenhum remédio riscado', !depois.riscado);
ok('SOS continua desmarcado por padrão', depois.marcados[2] === false, JSON.stringify(depois.marcados));

// e a gravação depois da virada não carimba o dia novo com ontem
await p.evaluate(() => aoAlternarRemedioDose('manha', 0, false));
await p.waitForTimeout(200);
const gravado = await p.evaluate(() => ({
  hoje: JSON.parse(localStorage.getItem('cf_desm_' + new Date().toDateString()) || '{}'),
  ontem: (() => { const o=new Date(); o.setDate(o.getDate()-1); return JSON.parse(localStorage.getItem('cf_desm_'+o.toDateString())||'{}'); })()
}));
ok('gravou só a marcação de hoje', JSON.stringify(gravado.hoje) === '{"manha":[0]}', JSON.stringify(gravado.hoje));
ok('não apagou o registro de ontem', JSON.stringify(gravado.ontem) === '{"manha":[1]}', JSON.stringify(gravado.ontem));

console.log('\n2. Excluir remédio suspenso do histórico');
await p.evaluate(() => { document.querySelectorAll('.nav-link')[2].click(); });
await p.waitForTimeout(400);
const temBotao = await p.evaluate(() => !!document.querySelector('#lista-meds-encerrados button[onclick^="excluirMedicamentoEncerrado"]'));
ok('botão Excluir aparece', temBotao);
p.on('dialog', d => d.accept());
await p.evaluate(() => excluirMedicamentoEncerrado(0));
await p.waitForTimeout(400);
const depoisExcluir = await p.evaluate(() => ({
  lista: JSON.parse(localStorage.getItem('cf_meds_encerrados') || '[]').length,
  esvaziados: JSON.parse(localStorage.getItem('cf_esvaziados_de_proposito') || '[]'),
  payload: (coletarDadosFamilia().esvaziadosDeProposito || [])
}));
ok('saiu do histórico', depoisExcluir.lista === 0);
ok('marcado como exclusão proposital', depoisExcluir.esvaziados.includes('medicamentosEncerrados'), JSON.stringify(depoisExcluir.esvaziados));
ok('viaja na sincronização', depoisExcluir.payload.includes('medicamentosEncerrados'));

console.log('\n3. Recolher / mostrar a lista do horário');
await p.evaluate(() => { document.querySelectorAll('.nav-link')[0].click(); });
await p.waitForTimeout(400);
const aberto = await p.evaluate(() => ({
  visivel: document.getElementById('lista-manha').offsetParent !== null,
  copinho: document.getElementById('copinho-manha').offsetParent !== null
}));
ok('lista começa visível', aberto.visivel);
await p.evaluate(() => alternarListaTurno('manha'));
await p.waitForTimeout(400);
const fechado = await p.evaluate(() => ({
  lista: document.getElementById('lista-manha').offsetParent !== null,
  copinho: document.getElementById('copinho-manha').offsetParent !== null,
  confirmar: document.getElementById('btn-confirmar-manha').offsetParent !== null,
  outro: document.getElementById('lista-noite').offsetParent !== null,
  salvo: localStorage.getItem('cf_turnos_recolhidos')
}));
ok('lista fica escondida', !fechado.lista);
ok('copinho continua à vista', fechado.copinho);
ok('botão de confirmar continua à vista', fechado.confirmar);
ok('outro horário não é afetado', fechado.outro);
ok('escolha é lembrada', /"manha":true/.test(fechado.salvo||''), fechado.salvo);
await p.reload(); await p.waitForTimeout(1200);
ok('continua recolhido após recarregar', await p.evaluate(() => document.getElementById('lista-manha').offsetParent === null));
await p.evaluate(() => alternarListaTurno('manha'));
await p.waitForTimeout(400);
ok('volta a aparecer', await p.evaluate(() => document.getElementById('lista-manha').offsetParent !== null));

console.log('\nerros de JS: ' + (erros.length ? [...new Set(erros)].join(' | ') : 'nenhum'));
console.log(falhas===0 ? '\n✅ todas as verificações passaram' : `\n❌ ${falhas} falha(s)`);
await b.close(); srv.close(); process.exit(falhas||erros.length?1:0);
