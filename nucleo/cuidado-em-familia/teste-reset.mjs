import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs';
import path from 'path'; import { fileURLToPath } from 'url';
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const HTML=fs.readFileSync(path.join(AQUI,'cuidado.html'),'utf8');
// Servidor falso que guarda a família de verdade, como o worker real.
const familias = {};
const srv=http.createServer((q,r)=>{
  const url = new URL(q.url,'http://x');
  const json = o => { r.writeHead(200,{'Content-Type':'application/json'}); r.end(JSON.stringify(o)); };
  if(url.pathname==='/api/auth/sair'){ return json({sucesso:true}); }
  if(url.pathname==='/api/auth/eu'){ return json({logado:false}); }
  if(url.pathname==='/api/familia/salvar'){
    let body=''; q.on('data',c=>body+=c); q.on('end',()=>{ try{
      const b=JSON.parse(body);
      // Espelha a proteção do cuidado-worker.js: um aparelho que manda estado
      // vazio não apaga o que já está gravado. Sem isto o teste mediria um
      // servidor que o app real não tem.
      const temItens = m => !!(m && typeof m==='object' && !Array.isArray(m) && Object.keys(m).some(k=>Array.isArray(m[k])&&m[k].length));
      const atual = familias[b.codigo] || {};
      const novo = { ...atual, ...b.dados };
      if (b.dados.medicamentos !== undefined && !temItens(b.dados.medicamentos) && temItens(atual.medicamentos)) novo.medicamentos = atual.medicamentos;
      familias[b.codigo] = novo;
    }catch(e){} json({sucesso:true}); });
    return;
  }
  if(url.pathname==='/api/familia/estado'){
    const cod=(url.searchParams.get('codigo')||'').toLowerCase();
    if(familias[cod]) return json({sucesso:true,temFamilia:true,familiaId:cod,dados:familias[cod]});
    return json({sucesso:false});
  }
  if(url.pathname.startsWith('/api')) { r.writeHead(500); return r.end('{}'); }
  r.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}); r.end(HTML);
}).listen(8851);

const b=await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {});
const ctx=await b.newContext();
const aba1=await ctx.newPage(), aba2=await ctx.newPage();
await aba1.goto('http://localhost:8851/');
await aba1.evaluate(()=>{ localStorage.clear(); localStorage.setItem('cf_configurado','true');
  localStorage.setItem('cf_codigo_familia','familia01');
  localStorage.setItem('cf_medicamentos', JSON.stringify({
    manha:[{nome:'Dapagliflozina 10mg',sub:'pela manhã',qtd:'1 comprimido'},
           {nome:'Diovan 320mg',sub:'pela manhã',qtd:'1 comprimido'}], almoco:[], noite:[]})); });
await aba1.reload(); await aba1.waitForTimeout(2000);   // sincroniza e começa o polling
await aba2.goto('http://localhost:8851/'); await aba2.waitForTimeout(1500);
console.log('família no servidor:', Object.keys(familias), '| remédios:', familias['familia01']?.medicamentos?.manha?.length);

aba2.on('dialog', d=>d.accept());
await aba2.evaluate(()=>executarResetTotal());
await aba2.waitForTimeout(1500);
console.log('\nlogo após zerar na aba 2:');
console.log('  cf_medicamentos:', await aba2.evaluate(()=>localStorage.getItem('cf_medicamentos')));

console.log('\nesperando a aba 1 (ainda aberta) fazer o próximo polling de 8s...');
await aba1.waitForTimeout(10000);
const volta = await aba2.evaluate(()=>localStorage.getItem('cf_medicamentos'));
let falhas = 0;
if (volta) { falhas++; console.log('  ✗ cf_medicamentos VOLTOU — ' + JSON.parse(volta).manha.map(m=>m.nome).join(', ')); }
else console.log('  ✓ cf_medicamentos continua limpo');
console.log('  cf_configurado :', await aba2.evaluate(()=>localStorage.getItem('cf_configurado')));

await aba2.reload(); await aba2.waitForTimeout(1500);
const tela = await aba2.evaluate(()=>[...document.querySelectorAll('.med-name')].map(e=>e.textContent));
if (tela.length) { falhas++; console.log('  ✗ mural ainda mostra: ' + tela.join(' | ')); }
else console.log('  ✓ mural da aba zerada continua vazio');

// A aba que ficou aberta tem de ter recarregado e saído da família.
const aba1Limpa = await aba1.evaluate(()=>({ familia: typeof familiaId !== 'undefined' ? familiaId : 'indef', meds: localStorage.getItem('cf_medicamentos') }));
if (aba1Limpa.meds) { falhas++; console.log('  ✗ a aba que ficou aberta ainda tem remédios gravados'); }
else console.log('  ✓ a aba que ficou aberta também voltou do zero');

// E a sincronização normal (sem reset) continua funcionando.
console.log('\n2. A sincronização normal não foi quebrada');
const aba3 = await (await b.newContext()).newPage();
await aba3.goto('http://localhost:8851/');
await aba3.evaluate(()=>{ localStorage.clear(); localStorage.setItem('cf_configurado','true');
  localStorage.setItem('cf_codigo_familia','familia01'); });
await aba3.reload(); await aba3.waitForTimeout(10000); // o polling da família é de 8s
const recebeu = await aba3.evaluate(()=>{ try { return (JSON.parse(localStorage.getItem('cf_medicamentos')||'{}').manha||[]).length; } catch(e){ return -1; } });
if (recebeu > 0) console.log('  ✓ um aparelho novo com o código da família recebe os remédios (' + recebeu + ')');
else { falhas++; console.log('  ✗ a sincronização parou de funcionar (recebeu ' + recebeu + ')'); }

// ---- O reset é SÓ do aparelho -------------------------------------------
// Regra dura: zerar o próprio celular nunca pode apagar os remédios da pessoa
// cuidada no aparelho de mais ninguém. Um irmão que zera o celular dele não
// pode deixar a cuidadora sem a lista.
console.log('\n3. Zerar um aparelho não apaga os dados dos outros');
const registroDepois = familias['familia01'];
if (!registroDepois) { falhas++; console.log('  ✗ o registro da família SUMIU do servidor'); }
else console.log('  ✓ o registro da família continua no servidor');
const medsDepois = registroDepois?.medicamentos?.manha?.length || 0;
if (medsDepois !== 2) { falhas++; console.log('  ✗ os remédios da família mudaram: ' + medsDepois + ' (eram 2)'); }
else console.log('  ✓ os remédios da família continuam intactos (2)');

// E um familiar que nunca zerou nada continua enxergando tudo.
const abaIrma = await (await b.newContext()).newPage();
await abaIrma.goto('http://localhost:8851/');
await abaIrma.evaluate(()=>{ localStorage.clear(); localStorage.setItem('cf_configurado','true');
  localStorage.setItem('cf_codigo_familia','familia01'); });
await abaIrma.reload(); await abaIrma.waitForTimeout(10000);
const veemOsRemedios = await abaIrma.evaluate(()=>{ try { return (JSON.parse(localStorage.getItem('cf_medicamentos')||'{}').manha||[]).map(m=>m.nome); } catch(e){ return []; } });
if (veemOsRemedios.length === 2) console.log('  ✓ outro familiar continua recebendo: ' + veemOsRemedios.join(', '));
else { falhas++; console.log('  ✗ outro familiar ficou sem os remédios: ' + JSON.stringify(veemOsRemedios)); }

console.log(falhas===0 ? '\n✅ todas as verificações passaram' : `\n❌ ${falhas} falha(s)`);
await b.close(); srv.close(); process.exit(falhas?1:0);
