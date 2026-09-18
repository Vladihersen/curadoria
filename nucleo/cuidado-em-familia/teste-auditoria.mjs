import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const HTML=fs.readFileSync(path.join(AQUI,'cuidado.html'),'utf8');
const srv=http.createServer((q,r)=>{ if(q.url.startsWith('/api')){r.writeHead(500);return r.end('{}');}
  r.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}); r.end(HTML);}).listen(8810);
const b=await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {});
const problemas=[];

// ===== 1. AUDITORIA ESTÁTICA: onclick/id que não existem =====
const idsDefinidos=new Set([...HTML.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
const jsTotal=[...HTML.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
const funcsDefinidas=new Set([...jsTotal.matchAll(/function\s+([A-Za-z_$][\w$]*)/g)].map(m=>m[1]));
const handlers=new Set();
for (const m of HTML.matchAll(/\bon(?:click|change|input|submit)="([^"]+)"/g)) {
  for (const f of m[1].matchAll(/([A-Za-z_$][\w$]*)\s*\(/g)) handlers.add(f[1]);
}
const nativos=new Set(['event','alert','confirm','parseInt','parseFloat','Number','String','JSON','Math','Date','Array','Object','document','window','localStorage','setTimeout','encodeURIComponent','open','preventDefault','stopPropagation','getElementById','click','querySelector','querySelectorAll']);
for (const h of handlers) if (!funcsDefinidas.has(h) && !nativos.has(h) && !jsTotal.includes(h+' =') && !jsTotal.includes(h+'=')) problemas.push(`handler inexistente: ${h}()`);
// getElementById de ids que não existem no HTML
for (const m of jsTotal.matchAll(/getElementById\(\s*['"]([a-zA-Z][\w-]*)['"]\s*\)/g)) {
  if (!idsDefinidos.has(m[1])) problemas.push(`getElementById('${m[1]}') — id não existe no HTML`);
}
// ids duplicados
const contagem={}; for (const m of HTML.matchAll(/\bid="([^"]+)"/g)) contagem[m[1]]=(contagem[m[1]]||0)+1;
for (const [k,v] of Object.entries(contagem)) if (v>1) problemas.push(`id duplicado: ${k} (${v}x)`);
console.log('=== 1. Auditoria estática ===');
console.log(problemas.length?problemas.join('\n'):'nenhum problema');

// ===== 2. PERCURSO COMPLETO NO NAVEGADOR =====
const erros=[];
async function novaPagina(){
  const p=await (await b.newContext()).newPage();
  p.on('pageerror',e=>erros.push('JS: '+e.message));
  p.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))erros.push('CONSOLE: '+m.text());});
  await p.goto('http://localhost:8810/'); return p;
}
console.log('\n=== 2. Cadastro novo, passo a passo ===');
let p=await novaPagina();
await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForTimeout(800);
const etapas=async()=>p.evaluate(()=>[...document.querySelectorAll('[id^="etapa-"]')].filter(e=>e.style.display!=='none').map(e=>e.id));
console.log('etapa inicial   :', (await etapas()).join(','));
await p.evaluate(()=>irEtapa(1)); await p.waitForTimeout(200);
await p.fill('#input-nome-idoso','Maria'); await p.evaluate(()=>salvarEtapa1()); await p.waitForTimeout(200);
console.log('após passo 1    :', (await etapas()).join(','));
await p.evaluate(()=>concluirCadastro()); await p.waitForTimeout(300);
console.log('sem foto -> vai :', (await etapas()).join(','), '(deve ser etapa-3)');
// responder rotina
await p.evaluate(()=>{
  document.querySelector('.btn-rotina[data-grupo="sinais"][data-valor="sim"]').click();
  document.querySelector('.btn-rotina[data-grupo="escaras"][data-valor="sim"]').click();
  document.getElementById('input-litros-onboarding').value='1.5';
  atualizarPreviaAgua();
});
const previa=await p.textContent('#previa-agua-onboarding');
console.log('prévia da água  :', previa, '(1,5 L / copos de 250ml = 6)');
await p.evaluate(()=>salvarRotinaCuidado()); await p.waitForTimeout(300);
console.log('após passo 3    :', (await etapas()).join(','), '(deve ser etapa-4)');
await p.evaluate(()=>concluirCadastro()); await p.waitForTimeout(800);
const r=await p.evaluate(()=>({
  emUso: document.getElementById('tela-em-uso')?.style.display,
  prefs: { sinais:localStorage.getItem('cf_acompanha_sinais'), agua:localStorage.getItem('cf_acompanha_agua'), escarasNA:localStorage.getItem('cf_escaras_na') },
  agua: JSON.parse(localStorage.getItem('cf_config_agua')||'{}'),
  cards: { sinais:document.getElementById('card-sinais-vitais')?.style.display, agua:document.getElementById('card-agua')?.style.display, escaras:document.getElementById('card-escaras')?.style.display },
  recipientes: document.querySelectorAll('#container-recipientes-agua .cup, #container-recipientes-agua > *').length
}));
console.log('preferências    :', JSON.stringify(r.prefs));
console.log('config de água  :', JSON.stringify(r.agua), '| recipientes na tela:', r.recipientes);
console.log('cartões         :', JSON.stringify(r.cards), '(escaras deve aparecer)');

// escaras funcionando
await p.evaluate(()=>{ registrarMudancaPosicao(); registrarMudancaPosicao(); });
await p.waitForTimeout(200);
console.log('escaras         :', await p.textContent('#txt-escaras-hoje'), '|', (await p.textContent('#lista-escaras-hoje')).trim());

// ===== 3. QUEM NÃO ACOMPANHA NADA =====
console.log('\n=== 3. Família que não acompanha sinais nem água ===');
const p2=await novaPagina();
await p2.evaluate(()=>{ localStorage.clear(); localStorage.setItem('cf_configurado','true');
  localStorage.setItem('cf_acompanha_sinais','false'); localStorage.setItem('cf_acompanha_agua','false'); localStorage.setItem('cf_escaras_na','true'); });
await p2.reload(); await p2.waitForTimeout(1000);
console.log('cartões ocultos :', JSON.stringify(await p2.evaluate(()=>({
  sinais:document.getElementById('card-sinais-vitais')?.style.display,
  agua:document.getElementById('card-agua')?.style.display,
  escaras:document.getElementById('card-escaras')?.style.display}))));

// ===== 4. USUÁRIO ANTIGO: nada pode sumir =====
console.log('\n=== 4. Usuário antigo (sem nenhuma chave nova) ===');
const p3=await novaPagina();
await p3.evaluate(()=>{ localStorage.clear(); localStorage.setItem('cf_configurado','true');
  localStorage.setItem('cf_pa','12x8');
  localStorage.setItem('cf_copos_agua', JSON.stringify([true,true,false,false,false,false,false,false]));
  localStorage.setItem('cf_copos_agua_data', new Date().toDateString());
  localStorage.setItem('cf_medicamentos', JSON.stringify({manha:[{nome:'Losartana',sub:'x',qtd:'1 comprimido'}],almoco:[],noite:[]})); });
await p3.reload(); await p3.waitForTimeout(1000);
console.log('cartões visíveis:', JSON.stringify(await p3.evaluate(()=>({
  sinais:document.getElementById('card-sinais-vitais')?.style.display||'(padrão)',
  agua:document.getElementById('card-agua')?.style.display||'(padrão)',
  escaras:document.getElementById('card-escaras')?.style.display}))), '(sinais e água devem continuar)');
console.log('pressão mantida :', await p3.evaluate(()=>document.getElementById('val-pa')?.innerText));
console.log('remédio mantido :', await p3.evaluate(()=>[...document.querySelectorAll('#lista-manha .med-name')].map(e=>e.textContent).join('|')));

// ===== 5. TODAS AS ABAS E MODAIS =====
console.log('\n=== 5. Abrindo todas as abas e modais ===');
const abas=await p3.evaluate(()=>[...document.querySelectorAll('.nav-link')].map((e,i)=>i));
for (const i of abas){ await p3.evaluate(i=>document.querySelectorAll('.nav-link')[i].click(), i); await p3.waitForTimeout(250); }
console.log('abas percorridas:', abas.length);
const modais=await p3.evaluate(()=>[...document.querySelectorAll('.modal-overlay')].map(m=>m.id).filter(Boolean));
for (const id of modais){
  await p3.evaluate(id=>{document.getElementById(id).classList.add('active');}, id);
  await p3.waitForTimeout(80);
  await p3.evaluate(id=>{document.getElementById(id).classList.remove('active');}, id);
}
console.log('modais abertos  :', modais.length, '→', modais.join(', '));

console.log('\n=== ERROS DE JAVASCRIPT ===');
console.log(erros.length?[...new Set(erros)].join('\n'):'NENHUM');
await b.close(); srv.close();
