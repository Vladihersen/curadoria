// O código da família tem de funcionar no instante em que é compartilhado,
// e ninguém pode ficar preso no cadastro se errar o código.
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs';
import path from 'path'; import { fileURLToPath } from 'url';
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const HTML = fs.readFileSync(path.join(AQUI,'cuidado.html'),'utf8');

const familias = {};
const srv = http.createServer((q,r)=>{
  const url=new URL(q.url,'http://x'); const json=o=>{r.writeHead(200,{'Content-Type':'application/json'});r.end(JSON.stringify(o));};
  if(url.pathname==='/api/auth/eu') return json({logado:false});
  if(url.pathname==='/api/auth/sair') return json({sucesso:true});
  if(url.pathname==='/api/familia/salvar'){let bd='';q.on('data',c=>bd+=c);q.on('end',()=>{ let rev;
    try{const b=JSON.parse(bd); const a=familias[b.codigo]||{}; rev=(Number(a.rev)||0)+1;
      familias[b.codigo]={...a,...(b.dados||{}),rev};}catch(e){} json({sucesso:true,rev}); });return;}
  if(url.pathname==='/api/familia/entrar'){let bd='';q.on('data',c=>bd+=c);q.on('end',()=>{
    try{const c=(JSON.parse(bd).codigo||'').toLowerCase();
      return familias[c] ? json({sucesso:true,familiaId:c,papel:'acompanhante',dados:familias[c]})
                         : json({sucesso:false,erro:'Código não encontrado.'});}catch(e){ json({sucesso:false}); }});return;}
  if(url.pathname==='/api/familia/estado'){const c=(url.searchParams.get('codigo')||'').toLowerCase();
    return familias[c]?json({sucesso:true,temFamilia:true,familiaId:c,dados:familias[c]}):json({sucesso:false});}
  if(url.pathname.startsWith('/api')){r.writeHead(500);return r.end('{}');}
  r.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});r.end(HTML);
}).listen(8870);

const b = await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {});
let falhas=0; const ok=(n,c,d='')=>{ if(c) console.log('  ✓ '+n); else {falhas++; console.log('  ✗ '+n+(d?' → '+d:''));} };
const errosJs=[];

console.log('1. O responsável faz o cadastro e o código já vale na hora');
const resp = await (await b.newContext()).newPage();
resp.on('dialog',d=>d.accept()); resp.on('pageerror',e=>errosJs.push(e.message));
await resp.goto('http://localhost:8870/');
await resp.evaluate(()=>localStorage.clear());
await resp.reload(); await resp.waitForTimeout(1000);
await resp.evaluate(()=>irEtapa(1));
await resp.fill('#input-nome-idoso','Dona Maria');
await resp.evaluate(()=>salvarEtapa1()); await resp.waitForTimeout(300);
await resp.evaluate(()=>concluirCadastro()); await resp.waitForTimeout(300);   // vai ao passo 3
await resp.evaluate(()=>{ try{salvarRotinaCuidado();}catch(e){} }); await resp.waitForTimeout(300);
await resp.evaluate(()=>concluirCadastro()); await resp.waitForTimeout(2000);
const cod = await resp.evaluate(()=>localStorage.getItem('cf_codigo_familia'));
ok('a família foi registrada no servidor', Object.keys(familias).includes(cod), 'código '+cod+' | servidor: '+JSON.stringify(Object.keys(familias)));

console.log('\n2. O acompanhante entra com esse código');
const acomp = await (await b.newContext()).newPage();
const alertas=[]; acomp.on('dialog',d=>{alertas.push(d.message()); d.accept();});
acomp.on('pageerror',e=>errosJs.push(e.message));
await acomp.goto('http://localhost:8870/');
await acomp.evaluate(()=>localStorage.clear());
await acomp.reload(); await acomp.waitForTimeout(1000);
await acomp.evaluate(c=>{ document.getElementById('input-codigo-capa').value = c; entrarComCodigoPelaCapa(); }, cod);
await acomp.waitForTimeout(2000);
ok('entrou sem erro', await acomp.evaluate(()=>localStorage.getItem('cf_configurado')==='true'), alertas.join(' | '));
ok('assumiu o código da família', (await acomp.evaluate(()=>localStorage.getItem('cf_codigo_familia')))===cod);
ok('recebeu o nome da pessoa cuidada', (await acomp.evaluate(()=>localStorage.getItem('cf_nome_paciente')))==='Dona Maria');

console.log('\n3. Errar o código não prende ninguém no cadastro');
const preso = await (await b.newContext()).newPage();
const al2=[]; preso.on('dialog',d=>{al2.push(d.message()); d.accept();});
preso.on('pageerror',e=>errosJs.push(e.message));
await preso.goto('http://localhost:8870/');
await preso.evaluate(()=>localStorage.clear());
await preso.reload(); await preso.waitForTimeout(1000);
await preso.evaluate(()=>{ document.getElementById('input-codigo-capa').value='naoexiste'; entrarComCodigoPelaCapa(); });
await preso.waitForTimeout(1200);
ok('avisa que o código não existe', al2.some(m=>/não encontrad/i.test(m)), al2.join(' | '));
// entra no cadastro e tenta voltar até a capa
await preso.evaluate(()=>irEtapa(2)); await preso.waitForTimeout(300);
ok('o passo 2 tem botão Voltar', await preso.evaluate(()=>!!document.querySelector('#etapa-2 button[onclick^="voltarEtapa"]')));
await preso.evaluate(()=>voltarEtapa(2)); await preso.waitForTimeout(300);
ok('volta para o passo 1', await preso.evaluate(()=>document.getElementById('etapa-1')?.offsetParent !== null));
// No passo 1 o campo do código também está disponível.
ok('o campo do código volta a ficar acessível no passo 1',
   await preso.evaluate(()=>document.getElementById('input-codigo-capa')?.offsetParent !== null));
await preso.evaluate(()=>voltarEtapa(1)); await preso.waitForTimeout(400);
const naCapa = await preso.evaluate(()=>({
  campo: document.getElementById('input-codigo-capa-0')?.offsetParent !== null,
  capa: document.getElementById('etapa-0')?.offsetParent !== null
}));
ok('volta para a capa', naCapa.capa, JSON.stringify(naCapa));
ok('a capa tem o campo do código', naCapa.campo, JSON.stringify(naCapa));
// e aí o código certo funciona
await preso.evaluate(c=>{ document.getElementById('input-codigo-capa-0').value=c; entrarComCodigoPelaCapa('input-codigo-capa-0'); }, cod);
await preso.waitForTimeout(1500);
ok('na segunda tentativa, entra', await preso.evaluate(()=>localStorage.getItem('cf_configurado')==='true'), al2.join(' | '));

console.log('\nerros de JS: ' + (errosJs.length ? [...new Set(errosJs)].join(' | ') : 'nenhum'));
console.log(falhas===0 ? '\n✅ todas as verificações passaram' : `\n❌ ${falhas} falha(s)`);
await b.close(); srv.close(); process.exit(falhas||errosJs.length?1:0);
