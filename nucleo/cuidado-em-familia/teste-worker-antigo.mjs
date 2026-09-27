import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const HTML=fs.readFileSync(path.join(AQUI,'cuidado.html'),'utf8');
const srv=http.createServer((q,r)=>{if(q.url.startsWith('/api')){r.writeHead(500);return r.end('{}');}
  r.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});r.end(HTML);}).listen(8815);
const b=await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {});
const p=await (await b.newContext()).newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8815/');
await p.evaluate(()=>{localStorage.clear();localStorage.setItem('cf_configurado','true');localStorage.setItem('cf_turnos_ativos','[]');});
await p.reload(); await p.waitForTimeout(1000);

// Exatamente o que um worker com prompt antigo devolveria: só 3 turnos.
const r=await p.evaluate(()=>{
  medsExtraidosIA=[
    {nome:'Omeprazol', sub:'Em jejum, 30 min antes do café', qtd:'1 comp', turno:'manha'},
    {nome:'Rivotril',  sub:'Ao deitar, antes de dormir',    qtd:'1 comp', turno:'noite'},
    {nome:'Metformina',sub:'30 min antes do almoço',        qtd:'1 comp', turno:'almoco'},
    {nome:'Dipirona',  sub:'Se tiver dor ou febre',         qtd:'1 comp', turno:'manha'},
    {nome:'Losartana', sub:'Com água, após o café',         qtd:'1 comp', turno:'manha'},
    {nome:'Sinvastatina',sub:'Após o jantar',               qtd:'1 comp', turno:'noite'}
  ];
  confirmarETransferirMedsIA();
  const m=JSON.parse(localStorage.getItem('cf_medicamentos'));
  const onde={}; Object.entries(m).forEach(([k,v])=>v.forEach(x=>onde[x.nome]=k));
  return onde;
});
const esperado={Omeprazol:'jejum',Rivotril:'deitar',Metformina:'antes_almoco',Dipirona:'extra_sos',Losartana:'manha',Sinvastatina:'noite'};
console.log('A IA antiga só sabe dizer manha/almoco/noite. Onde cada remédio foi parar:\n');
let ok=0;
for (const [nome,esp] of Object.entries(esperado)){
  const got=r[nome]; const bom=got===esp; if(bom)ok++;
  console.log(` ${bom?'✅':'❌'} ${nome.padEnd(13)} → ${String(got).padEnd(14)} (esperado ${esp})`);
}
console.log(`\n${ok}/${Object.keys(esperado).length} corretos | erros JS: ${errs.length}`);
await b.close(); srv.close(); process.exit(ok===6&&!errs.length?0:1);
