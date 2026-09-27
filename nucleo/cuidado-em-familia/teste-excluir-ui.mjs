// Apagar tem de apagar — e, ao mesmo tempo, um aparelho com estado incompleto
// não pode apagar nada. É a mesma proteção olhada dos dois lados.
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs';
import path from 'path'; import os from 'os'; import { fileURLToPath } from 'url';
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const HTML = fs.readFileSync(path.join(AQUI,'cuidado.html'),'utf8');
const W = fs.readFileSync(path.join(AQUI,'cuidado-worker.js'),'utf8');

// O servidor de teste usa a MESMA função de mescla do worker publicado, para
// não medir um servidor que o app real não tem.
const corta = n => { const i = W.indexOf('function '+n+'('); return W.slice(i, W.indexOf('\n}\n', i)+3); };
const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(),'cf-')), 'merge.mjs');
fs.writeFileSync(tmp, corta('medicamentosTemItensServidor')+'\n'+corta('mesclarDadosFamiliaComSeguranca')+'\nexport { mesclarDadosFamiliaComSeguranca };\n');
const { mesclarDadosFamiliaComSeguranca } = await import(tmp);

const familias = {};
function salvarComoOWorker(codigo, revBase, recebido) {
  const atual = familias[codigo] || {};
  const revAtual = Number(atual.rev) || 0;
  const rb = Number(revBase);
  const emDia = Number.isFinite(rb) && rb === revAtual;
  const d = emDia ? { ...atual, ...recebido } : mesclarDadosFamiliaComSeguranca(atual, recebido);
  d.rev = revAtual + 1;
  familias[codigo] = d;
  return d.rev;
}

const srv = http.createServer((q,r)=>{
  const url = new URL(q.url,'http://x'); const json = o => { r.writeHead(200,{'Content-Type':'application/json'}); r.end(JSON.stringify(o)); };
  if (url.pathname==='/api/auth/eu') return json({logado:false});
  if (url.pathname==='/api/auth/sair') return json({sucesso:true});
  if (url.pathname==='/api/familia/salvar') { let bd=''; q.on('data',c=>bd+=c); q.on('end',()=>{
      let rev; try { const b=JSON.parse(bd); rev = salvarComoOWorker(b.codigo, b.revBase, b.dados||{}); } catch(e){}
      json({sucesso:true, rev}); }); return; }
  if (url.pathname==='/api/familia/estado') { const c=(url.searchParams.get('codigo')||'').toLowerCase();
    return familias[c] ? json({sucesso:true,temFamilia:true,familiaId:c,dados:familias[c]}) : json({sucesso:false}); }
  if (url.pathname.startsWith('/api')) { r.writeHead(500); return r.end('{}'); }
  r.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}); r.end(HTML);
}).listen(8861);

const b = await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {});
let falhas = 0;
const ok = (n,c,d='') => { if(c) console.log('  ✓ '+n); else { falhas++; console.log('  ✗ '+n+(d?' → '+d:'')); } };
const POLL = 10000; // o polling da familia e de 8s

const nomesNaLista = p => p.evaluate(()=>[...document.querySelectorAll('#lista-resumo-prescricao-pasta strong')].map(e=>e.textContent).filter(t=>/mg/.test(t)));
const guardados = p => p.evaluate(()=>({
  ativos: Object.values(JSON.parse(localStorage.getItem('cf_medicamentos')||'{}')).flat().map(m=>m.nome),
  historico: JSON.parse(localStorage.getItem('cf_meds_encerrados')||'[]').map(m=>m.nome) }));

// ---------------------------------------------------------------- aparelho 1
console.log('1. O X da Gestao da Prescricao exclui de verdade, na tela e no aparelho');
const p = await (await b.newContext({viewport:{width:420,height:900}})).newPage();
p.on('dialog', d=>d.accept());
const errosJs = []; p.on('pageerror', e=>errosJs.push(e.message));
await p.goto('http://localhost:8861/');
await p.evaluate(()=>{ localStorage.clear(); localStorage.setItem('cf_configurado','true');
  localStorage.setItem('cf_codigo_familia','fam01');
  localStorage.setItem('cf_medicamentos', JSON.stringify({manha:[{nome:'Losartana 50mg',sub:'x',qtd:'1 comprimido'},{nome:'AAS 100mg',sub:'y',qtd:'1 comprimido'}],almoco:[],noite:[]})); });
await p.reload(); await p.waitForTimeout(2500);
await p.evaluate(()=>document.querySelectorAll('.nav-link')[2].click());
await p.waitForTimeout(500);
ok('a lista comeca com os dois remedios', (await nomesNaLista(p)).length === 2);

// exatamente o que a pessoa faz: clica no X e confirma
await p.evaluate(()=>document.querySelector('#lista-resumo-prescricao-pasta button[title="Encerrar"]').click());
await p.waitForTimeout(400);
ok('abre a janela pedindo o motivo', await p.evaluate(()=>document.getElementById('modal-remover-med')?.classList.contains('active')));
await p.evaluate(()=>{ const i=document.getElementById('input-motivo-remocao'); if(i) i.value='Suspenso pelo medico'; confirmarRemocaoMedicamento(); });
await p.waitForTimeout(800);

const naTela = await nomesNaLista(p); const g1 = await guardados(p);
ok('o remedio SAI DA TELA onde a pessoa clicou', !naTela.some(t=>/Losartana/.test(t)), naTela.join('|'));
ok('o outro remedio continua na tela', naTela.some(t=>/AAS/.test(t)), naTela.join('|'));
ok('sai dos remedios ativos', !g1.ativos.some(n=>/Losartana/.test(n)), g1.ativos.join('|'));
ok('ENTRA no historico de suspensos', g1.historico.some(n=>/Losartana/.test(n)), g1.historico.join('|'));
ok('o historico guarda o motivo', await p.evaluate(()=>/Suspenso pelo medico/.test(JSON.stringify(JSON.parse(localStorage.getItem('cf_meds_encerrados'))))));

console.log('2. Passado um ciclo de sincronizacao da familia, o remedio NAO volta');
await p.waitForTimeout(POLL);
const g2 = await guardados(p);
ok('continua excluido depois do polling', !g2.ativos.some(n=>/Losartana/.test(n)), g2.ativos.join('|'));
ok('continua no historico depois do polling', g2.historico.some(n=>/Losartana/.test(n)));
ok('o servidor tambem sabe da exclusao', !JSON.stringify((familias['fam01']||{}).medicamentos||{}).includes('Losartana'), JSON.stringify((familias['fam01']||{}).medicamentos||{}));
ok('o servidor guarda o historico', JSON.stringify((familias['fam01']||{}).medicamentosEncerrados||[]).includes('Losartana'));

console.log('3. Quem entrou pelo codigo da familia tambem consegue excluir');
const p2 = await (await b.newContext({viewport:{width:420,height:900}})).newPage();
p2.on('dialog', d=>d.accept());
p2.on('pageerror', e=>errosJs.push(e.message));
await p2.goto('http://localhost:8861/');
await p2.evaluate(()=>localStorage.clear());
await p2.reload(); await p2.waitForTimeout(1500);
await p2.evaluate(async ()=>{ const r = await fetch('/api/familia/estado?codigo=fam01'); const d = await r.json();
  localStorage.setItem('cf_configurado','true'); localStorage.setItem('cf_codigo_familia','fam01');
  aplicarDadosFamiliaNoEstadoLocal(d.dados); });
await p2.waitForTimeout(400);
ok('o aparelho convidado guardou a revisao do servidor', await p2.evaluate(()=>Number(localStorage.getItem('cf_rev_familia'))>0),
   'rev=' + await p2.evaluate(()=>localStorage.getItem('cf_rev_familia')));
await p2.reload(); await p2.waitForTimeout(2500);
await p2.evaluate(()=>{ removerMedicamento('manha', 0); });
await p2.waitForTimeout(300);
await p2.evaluate(()=>{ const i=document.getElementById('input-motivo-remocao'); if(i) i.value='Acabou o tratamento'; confirmarRemocaoMedicamento(); });
await p2.waitForTimeout(POLL);
const g3 = await guardados(p2);
ok('o convidado consegue excluir e fica excluido', !g3.ativos.some(n=>/AAS/.test(n)), g3.ativos.join('|'));
ok('o servidor aceitou a exclusao do convidado', !JSON.stringify((familias['fam01']||{}).medicamentos||{}).includes('AAS'), JSON.stringify((familias['fam01']||{}).medicamentos||{}));
ok('e o AAS ficou registrado no historico', g3.historico.some(n=>/AAS/.test(n)), g3.historico.join('|'));

console.log('4. Acrescentar remedio tambem chega ao servidor');
await p2.evaluate(()=>{ medicamentos = garantirTurnos(medicamentos); medicamentos.noite.push({nome:'Inzelm 10mg',sub:'z',qtd:'1 comprimido'});
  localStorage.setItem('cf_medicamentos', JSON.stringify(medicamentos)); medicamentosMudaram(); });
await p2.waitForTimeout(3000);
ok('o remedio novo aparece no servidor', JSON.stringify((familias['fam01']||{}).medicamentos||{}).includes('Inzelm'), JSON.stringify((familias['fam01']||{}).medicamentos||{}));

console.log('5. A exclusao feita num aparelho chega ao OUTRO aparelho da familia');
await p.waitForTimeout(POLL);
const g4 = await guardados(p);
ok('o primeiro aparelho tambem perdeu o AAS excluido no segundo', !g4.ativos.some(n=>/AAS/.test(n)), g4.ativos.join('|'));
ok('e recebeu o Inzelm acrescentado no segundo', g4.ativos.some(n=>/Inzelm/.test(n)), g4.ativos.join('|'));

ok('nenhum erro de JavaScript', errosJs.length===0, errosJs.join(' | '));
await b.close(); srv.close();
console.log(falhas ? '\n'+falhas+' FALHA(S)' : '\nTudo certo');
process.exit(falhas?1:0);
