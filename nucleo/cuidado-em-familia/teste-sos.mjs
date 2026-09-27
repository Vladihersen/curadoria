// Registro dos remédios "se necessário": hora, nome, histórico e sobrevivência
// à mudança de posição na lista.
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs';
import path from 'path'; import { fileURLToPath } from 'url';
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const HTML = fs.readFileSync(path.join(AQUI, 'cuidado.html'), 'utf8');
const srv = http.createServer((q,r)=>{ if(q.url.startsWith('/api')){r.writeHead(500);return r.end('{}');}
  r.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}); r.end(HTML);}).listen(8830);
const b = await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {});
const p = await (await b.newContext()).newPage();
const erros = []; p.on('pageerror', e=>erros.push(e.message));
p.on('console', m=>{ if(m.type()==='error' && !/Failed to load resource/.test(m.text())) erros.push(m.text()); });

await p.goto('http://localhost:8830/');
await p.evaluate(() => {
  localStorage.clear(); localStorage.setItem('cf_configurado','true');
  localStorage.setItem('cf_medicamentos', JSON.stringify({
    manha:[{nome:'Glifage XR 500mg',sub:'no café',qtd:'2 comprimidos'},
           {nome:'Inzelm 10mg',sub:'1 comprimido (via oral) se necessário',qtd:'1 comprimido'}],
    almoco:[], noite:[]}));
});
await p.reload(); await p.waitForTimeout(1200);

let falhas = 0;
const ok = (n, c, d='') => { if(c) console.log('  ✓ '+n); else { falhas++; console.log('  ✗ '+n+(d?' → '+d:'')); } };
const chave = () => { const d=new Date(); return 'cf_sos_log_'+d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); };

console.log('1. Marcar o Inzelm registra a toma');
await p.evaluate(() => aoAlternarRemedioSos('manha', 1, true));
await p.waitForTimeout(300);
const r1 = await p.evaluate(k => ({
  log: JSON.parse(localStorage.getItem(k) || '[]'),
  selo: [...document.querySelectorAll('#lista-manha span')].map(s=>s.textContent).find(t=>/Tomado/.test(t)) || ''
}), await p.evaluate(()=>chaveSosLog()));
ok('gravou um registro', r1.log.length === 1, JSON.stringify(r1.log));
ok('com o nome do remédio', r1.log[0] && r1.log[0].nome === 'Inzelm 10mg', JSON.stringify(r1.log[0]));
ok('com hora', !!(r1.log[0] && /^\d{2}:\d{2}$/.test(r1.log[0].hora)), r1.log[0] && r1.log[0].hora);
ok('selo mostra a hora', /Tomado às \d{2}:\d{2}/.test(r1.selo), JSON.stringify(r1.selo));

console.log('\n2. Segunda toma no mesmo dia');
await p.evaluate(() => { aoAlternarRemedioSos('manha', 1, false); aoAlternarRemedioSos('manha', 1, true); aoAlternarRemedioSos('manha', 1, true); });
await p.evaluate(() => { const l = lerSosLog(); l.push({nome:'Inzelm 10mg', turno:'manha', qtd:'1 comprimido', hora:'22:40', em:new Date().toISOString()}); gravarSosLog(l); renderizarMedicamentos(); });
await p.waitForTimeout(300);
const r2 = await p.evaluate(() => ({
  qtd: lerSosLog().length,
  selo: [...document.querySelectorAll('#lista-manha span')].map(s=>s.textContent).find(t=>/Tomado/.test(t)) || ''
}));
ok('conta as vezes de hoje', /vez hoje/.test(r2.selo), JSON.stringify(r2.selo) + ' | registros: ' + r2.qtd);

console.log('\n3. O registro sobrevive a mudar a ordem da lista');
// Antes, a marca guardava só o ÍNDICE: acrescentar um remédio antes do Inzelm
// fazia a marca apontar para outro remédio.
await p.evaluate(() => {
  medicamentos.manha.unshift({nome:'Remédio Novo', sub:'pela manhã', qtd:'1 comprimido'});
  localStorage.setItem('cf_medicamentos', JSON.stringify(medicamentos));
  renderizarMedicamentos();
});
await p.waitForTimeout(300);
const r3 = await p.evaluate(() => {
  const itens = [...document.querySelectorAll('#lista-manha .med-item')].map(li => ({
    nome: li.querySelector('.med-name')?.textContent,
    tomado: /Tomado/.test(li.textContent)
  }));
  return { itens, tomasInzelm: tomasSosHoje('Inzelm 10mg').length, tomasNovo: tomasSosHoje('Remédio Novo').length };
});
ok('o histórico continua no Inzelm', r3.tomasInzelm > 0 && r3.tomasNovo === 0,
   'Inzelm: '+r3.tomasInzelm+' | Novo: '+r3.tomasNovo);
ok('o remédio novo não herda o registro', !r3.itens.find(i=>/Remédio Novo/.test(i.nome||''))?.tomado,
   JSON.stringify(r3.itens));

console.log('\n4. Histórico visível na Pasta e no relatório médico');
await p.evaluate(() => { document.querySelectorAll('.nav-link')[2].click(); });
await p.waitForTimeout(500);
const r4 = await p.evaluate(() => ({
  badge: document.getElementById('badge-sos-historico')?.innerText,
  texto: document.getElementById('lista-sos-historico')?.innerText || ''
}));
ok('badge conta as tomas', /toma/.test(r4.badge||''), r4.badge);
ok('mostra o Inzelm com horário', /Inzelm/.test(r4.texto) && /\d{2}:\d{2}/.test(r4.texto), JSON.stringify(r4.texto.slice(0,120)));
await p.evaluate(() => abrirRelatorioMedico());
await p.waitForTimeout(400);
const rel = await p.evaluate(() => document.getElementById('rel-lista-meds')?.innerText || '');
ok('relatório médico inclui as tomas', /Se necessário/.test(rel) && /Inzelm/.test(rel), JSON.stringify(rel.slice(0,160)));

console.log('\n5. Virada do dia: mural reabre, histórico do dia anterior fica');
// Simula o dia de verdade tendo virado: o que estava marcado passa a pertencer
// a ONTEM (marcações e registros), e hoje ainda não tem nada gravado.
const antesVirada = await p.evaluate(() => {
  const ontem = new Date(); ontem.setDate(ontem.getDate()-1);
  const logDeOntem = lerSosLog();
  const marcasDeOntem = localStorage.getItem('cf_sos_' + new Date().toDateString());
  // move para ontem
  localStorage.setItem(chaveSosLog(ontem), JSON.stringify(logDeOntem));
  localStorage.setItem('cf_sos_' + ontem.toDateString(), marcasDeOntem || '{}');
  localStorage.removeItem(chaveSosLog());
  localStorage.removeItem('cf_sos_' + new Date().toDateString());
  diaEmExibicao = ontem.toDateString();
  verificarViradaDoDia();
  return logDeOntem.length;
});
await p.waitForTimeout(300);
const r5 = await p.evaluate(() => {
  const ontem = new Date(); ontem.setDate(ontem.getDate()-1);
  return {
    hoje: lerSosLog().length,
    ontem: lerSosLog(ontem).length,
    marcados: JSON.stringify(remediosSosTomadosHoje),
    tomado: /Tomado/.test(document.getElementById('lista-manha')?.innerText || '')
  };
});
ok('mural reabre limpo', r5.marcados === '{}', r5.marcados);
ok('nenhum remédio aparece como tomado', !r5.tomado);
ok('hoje começa sem tomas', r5.hoje === 0, String(r5.hoje));
ok('o histórico de ontem continua gravado', r5.ontem === antesVirada, r5.ontem + ' vs ' + antesVirada);
await p.evaluate(() => { document.querySelectorAll('.nav-link')[2].click(); renderizarHistoricoSos(); });
await p.waitForTimeout(400);
ok('e aparece no histórico da Pasta', /Inzelm/.test(await p.evaluate(() => document.getElementById('lista-sos-historico')?.innerText || '')));

console.log('\nerros de JS: ' + (erros.length ? [...new Set(erros)].join(' | ') : 'nenhum'));
console.log(falhas===0 ? '\n✅ todas as verificações passaram' : `\n❌ ${falhas} falha(s)`);
await b.close(); srv.close(); process.exit(falhas||erros.length?1:0);
