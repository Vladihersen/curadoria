import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const HTML=fs.readFileSync(path.join(AQUI,'cuidado.html'),'utf8');
const ANTIGO=fs.readFileSync(process.env.APP_ANTIGO || path.join(AQUI,'cuidado.html'),'utf8');
const srv=http.createServer((q,r)=>{ if(q.url.startsWith('/api')){r.writeHead(500);return r.end('{}');}
  r.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}); r.end(q.url.includes('antigo')?ANTIGO:HTML);}).listen(8812);
const b=await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {});

// Estado realista de quem já usa o app
const SEMEAR = () => {
  localStorage.clear();
  localStorage.setItem('cf_configurado','true');
  localStorage.setItem('cf_nome_paciente','Dona Maria');
  localStorage.setItem('cf_medicamentos', JSON.stringify({
    manha:[{nome:'Losartana',sub:'Com água',qtd:'1 comprimido',tipo:'continuo'},
           {nome:'AAS',sub:'Após comer',qtd:'1 comprimido',tipo:'continuo'}],
    almoco:[],  // vazio de propósito: é o caso que parecia "sumir"
    noite:[{nome:'Sinvastatina',sub:'Após o jantar',qtd:'1 comprimido',tipo:'continuo'}]}));
  localStorage.setItem('cf_fotos_receitas', JSON.stringify([
    {id:1,pagina:1,data:'01/09/2026',url:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='},
    {id:2,pagina:2,data:'01/09/2026',url:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='}]));
};
const MEDIR = () => ({
  cartoesMural: [...document.querySelectorAll('.card')].filter(c=>c.offsetParent!==null).map(c=>c.querySelector('.card-title')?.textContent.trim()).filter(Boolean),
  remediosManha: [...document.querySelectorAll('#lista-manha .med-name')].map(e=>e.textContent),
  remediosNoite: [...document.querySelectorAll('#lista-noite .med-name')].map(e=>e.textContent),
  fotosGuardadas: (JSON.parse(localStorage.getItem('cf_fotos_receitas')||'[]')).length,
  medsGuardados: (()=>{const m=JSON.parse(localStorage.getItem('cf_medicamentos')||'{}');
    return Object.entries(m).filter(([,v])=>v.length).map(([k,v])=>k+':'+v.length).join(' ');})()
});

async function medir(url){
  const p=await (await b.newContext()).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(url); await p.evaluate(SEMEAR); await p.reload(); await p.waitForTimeout(1200);
  // percorre a Pasta de Saúde, onde ficam as receitas
  await p.evaluate(()=>{const n=document.querySelectorAll('.nav-link'); if(n[2]) n[2].click();});
  await p.waitForTimeout(500);
  const galeria = await p.evaluate(()=>document.querySelectorAll('#container-galeria-receitas > *').length);
  const r=await p.evaluate(MEDIR); r.galeriaReceitas=galeria; r.erros=errs;
  return r;
}

const antigo=await medir('http://localhost:8812/antigo');
const novo=await medir('http://localhost:8812/novo');

console.log('                    ANTIGO (no ar)          →  NOVO (este PR)');
console.log('cartões do mural  :', JSON.stringify(antigo.cartoesMural));
console.log('                  →', JSON.stringify(novo.cartoesMural));
console.log('remédios manhã    :', antigo.remediosManha.join('|'), '→', novo.remediosManha.join('|'));
console.log('remédios noite    :', antigo.remediosNoite.join('|'), '→', novo.remediosNoite.join('|'));
console.log('meds no storage   :', antigo.medsGuardados, '→', novo.medsGuardados);
console.log('fotos de receita  :', antigo.fotosGuardadas, '→', novo.fotosGuardadas);
console.log('galeria na Pasta  :', antigo.galeriaReceitas, '→', novo.galeriaReceitas);
console.log('erros JS          :', antigo.erros.length, '→', novo.erros.length, novo.erros.join(';'));

const perdeuMed = novo.medsGuardados !== antigo.medsGuardados;
const perdeuFoto = novo.fotosGuardadas < antigo.fotosGuardadas || novo.galeriaReceitas < antigo.galeriaReceitas;
const perdeuCartao = antigo.cartoesMural.some(c=>/Manhã|Almoço|Noite/.test(c) && !novo.cartoesMural.some(n=>n.includes(c.replace(/\(.*\)/,'').trim().slice(2,12))));
console.log('\nPERDEU REMÉDIO?', perdeuMed?'SIM ❌':'não ✅', '| PERDEU RECEITA?', perdeuFoto?'SIM ❌':'não ✅', '| PERDEU CARTÃO?', perdeuCartao?'SIM ❌':'não ✅');
await b.close(); srv.close();
