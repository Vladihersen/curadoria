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
}).listen(8860);

const b = await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {});
let falhas = 0;
const ok = (n,c,d='') => { if(c) console.log('  ✓ '+n); else { falhas++; console.log('  ✗ '+n+(d?' → '+d:'')); } };
const POLL = 10000; // o polling da família é de 8s

const p = await (await b.newContext()).newPage();
p.on('dialog', d=>d.accept());
const errosJs = []; p.on('pageerror', e=>errosJs.push(e.message));
await p.goto('http://localhost:8860/');
await p.evaluate(()=>{ localStorage.clear(); localStorage.setItem('cf_configurado','true');
  localStorage.setItem('cf_codigo_familia','fam01');
  localStorage.setItem('cf_medicamentos', JSON.stringify({manha:[{nome:'Losartana 50mg',sub:'x',qtd:'1 comprimido'}],almoco:[],noite:[]}));
  localStorage.setItem('cf_fotos_receitas', JSON.stringify([{id:1,pagina:1,data:'01/09',url:'data:,'}])); });
await p.reload(); await p.waitForTimeout(2500);

console.log('1. Apagar o último remédio APAGA de verdade');
await p.evaluate(()=>removerMedicamento('manha',0));
await p.waitForTimeout(300);
await p.evaluate(()=>{ const i=document.getElementById('input-motivo-remocao'); if(i) i.value='Não uso mais'; confirmarRemocaoMedicamento(); });
await p.waitForTimeout(1500);
ok('saiu do servidor na hora', (familias.fam01?.medicamentos?.manha?.length||0)===0, String(familias.fam01?.medicamentos?.manha?.length));
await p.waitForTimeout(POLL);
const r1 = await p.evaluate(()=>({ local: JSON.parse(localStorage.getItem('cf_medicamentos')||'{}').manha?.length||0,
                                   tela: [...document.querySelectorAll('#lista-manha .med-name')].map(e=>e.textContent) }));
ok('não volta depois do polling', r1.local===0 && r1.tela.length===0, 'local '+r1.local+' | tela '+r1.tela.join(','));

console.log('\n2. Apagar a última receita APAGA de verdade');
await p.evaluate(()=>{ fotosReceitas.length=0; localStorage.setItem('cf_fotos_receitas','[]'); agendarSincronizacao(); });
await p.waitForTimeout(1500);
ok('saiu do servidor na hora', (familias.fam01?.fotosReceitas?.length||0)===0);
await p.waitForTimeout(POLL);
ok('não volta depois do polling', (await p.evaluate(()=>JSON.parse(localStorage.getItem('cf_fotos_receitas')||'[]').length))===0);

console.log('\n3. A proteção continua de pé: aparelho sem saber do estado NÃO apaga');
// Repõe dados reais na família.
salvarComoOWorker('fam01', familias.fam01.rev, { medicamentos:{manha:[{nome:'Losartana 50mg'},{nome:'AAS'}],almoco:[],noite:[]}, fotosReceitas:[{id:9}] });
const revBoa = familias.fam01.rev;
// Um aparelho que nunca carregou o estado (revisão 0) manda tudo vazio.
salvarComoOWorker('fam01', 0, { medicamentos:{manha:[],almoco:[],noite:[]}, fotosReceitas:[] });
ok('remédios preservados', (familias.fam01.medicamentos.manha.length)===2, String(familias.fam01.medicamentos.manha.length));
ok('receitas preservadas', (familias.fam01.fotosReceitas.length)===1);
// E com a revisão em dia, a exclusão passa.
salvarComoOWorker('fam01', familias.fam01.rev, { medicamentos:{manha:[],almoco:[],noite:[]}, fotosReceitas:[] });
ok('com a revisão em dia, a exclusão passa', (familias.fam01.medicamentos.manha.length)===0);

console.log('\n4. Depois de zerar, um cadastro novo começa limpo');
salvarComoOWorker('fam01', familias.fam01.rev, { medicamentos:{manha:[{nome:'Remédio Antigo'}],almoco:[],noite:[]} });
const p2 = await (await b.newContext()).newPage();
p2.on('dialog', d=>d.accept());
await p2.goto('http://localhost:8860/');
await p2.evaluate(()=>{ localStorage.clear(); localStorage.setItem('cf_configurado','true');
  localStorage.setItem('cf_codigo_familia','fam01');
  localStorage.setItem('cf_medicamentos', JSON.stringify({manha:[{nome:'Remédio Antigo'}],almoco:[],noite:[]})); });
await p2.reload(); await p2.waitForTimeout(2000);
await p2.evaluate(()=>executarResetTotal());
await p2.waitForTimeout(2000);
await p2.evaluate(()=>{ localStorage.setItem('cf_configurado','true'); });   // simula o novo cadastro
await p2.reload(); await p2.waitForTimeout(POLL);
const r4 = await p2.evaluate(()=>({
  cod: localStorage.getItem('cf_codigo_familia'),
  meds: JSON.parse(localStorage.getItem('cf_medicamentos')||'{}'),
  tela: [...document.querySelectorAll('.med-name')].map(e=>e.textContent)
}));
const totalMeds = Object.values(r4.meds).reduce((a,v)=>a+(Array.isArray(v)?v.length:0),0);
ok('usa um código de família novo', r4.cod && r4.cod !== 'fam01', String(r4.cod));
ok('nenhum remédio antigo voltou', totalMeds===0 && r4.tela.length===0, totalMeds+' meds | tela: '+r4.tela.join(','));
ok('a família antiga continua intacta no servidor', (familias.fam01?.medicamentos?.manha?.length||0)===1);

console.log('\nerros de JS: ' + (errosJs.length ? [...new Set(errosJs)].join(' | ') : 'nenhum'));
console.log(falhas===0 ? '\n✅ todas as verificações passaram' : `\n❌ ${falhas} falha(s)`);
await b.close(); srv.close(); process.exit(falhas||errosJs.length?1:0);
