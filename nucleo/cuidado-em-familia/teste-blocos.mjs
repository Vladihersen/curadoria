// Botão de recolher visível, "não se aplica" nos sinais vitais e na mudança de
// posição, aviso das 2 horas, e Gestão da Prescrição recolhível.
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs';
import path from 'path'; import { fileURLToPath } from 'url';
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const HTML = fs.readFileSync(path.join(AQUI, 'cuidado.html'), 'utf8');
const srv = http.createServer((q,r)=>{ if(q.url.startsWith('/api')){r.writeHead(500);return r.end('{}');}
  r.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}); r.end(HTML);}).listen(8840);
const b = await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {});
const p = await (await b.newContext({viewport:{width:420,height:900}})).newPage();
const erros = []; p.on('pageerror', e=>erros.push(e.message));
p.on('console', m=>{ if(m.type()==='error' && !/Failed to load resource/.test(m.text())) erros.push(m.text()); });
await p.goto('http://localhost:8840/');
await p.evaluate(() => {
  localStorage.clear(); localStorage.setItem('cf_configurado','true');
  localStorage.setItem('cf_medicamentos', JSON.stringify({manha:[{nome:'Losartana',sub:'x',qtd:'1 comprimido'}],almoco:[],noite:[]}));
});
await p.reload(); await p.waitForTimeout(1200);

let falhas=0; const ok=(n,c,d='')=>{ if(c) console.log('  ✓ '+n); else {falhas++; console.log('  ✗ '+n+(d?' → '+d:''));} };

console.log('1. Tamanho do botão de recolher');
const tam = await p.evaluate(() => {
  const b = document.querySelector('#container-turnos .btn-recolher');
  if (!b) return null;
  const r = b.getBoundingClientRect();
  const audio = document.querySelector('#container-turnos .btn-audio-pill')?.getBoundingClientRect();
  return { w: Math.round(r.width), h: Math.round(r.height), audio: audio ? Math.round(audio.width) : 0, visivel: b.offsetParent !== null };
});
ok('botão existe e está visível', !!(tam && tam.visivel), JSON.stringify(tam));
ok('tem pelo menos 42px (antes eram 30)', tam && tam.w >= 42, tam && (tam.w+'x'+tam.h));
ok('não é menor que o botão de áudio', tam && tam.w >= tam.audio, tam && ('recolher '+tam.w+' vs áudio '+tam.audio));

console.log('\n2. Sinais vitais: não se aplica');
ok('cartão aparece', await p.evaluate(()=>document.getElementById('card-sinais-vitais')?.offsetParent !== null));
ok('conteúdo visível por padrão', await p.evaluate(()=>document.getElementById('box-sinais-conteudo')?.offsetParent !== null));
await p.evaluate(() => { document.getElementById('chk-sinais-na').checked = true; alternarSinaisNaoAplica(); });
await p.waitForTimeout(300);
const s2 = await p.evaluate(()=>({
  conteudo: document.getElementById('box-sinais-conteudo')?.offsetParent !== null,
  cartao: document.getElementById('card-sinais-vitais')?.offsetParent !== null,
  resumo: document.getElementById('resumo-sinais')?.innerText,
  salvo: localStorage.getItem('cf_sinais_na')
}));
ok('conteúdo encolhe', !s2.conteudo);
ok('cartão continua acessível (não some)', s2.cartao);
ok('mostra "Não se aplica"', /Não se aplica/.test(s2.resumo||''), s2.resumo);
ok('fica gravado', s2.salvo === 'true', s2.salvo);
await p.reload(); await p.waitForTimeout(1200);
ok('continua assim depois de recarregar', await p.evaluate(()=>document.getElementById('box-sinais-conteudo')?.offsetParent === null));
// mas se houver medida registrada, não esconde
await p.evaluate(()=>{ localStorage.setItem('cf_pa','12x8'); aplicarSinaisNaoAplica(); });
await p.waitForTimeout(200);
ok('não esconde se houver medida anotada', await p.evaluate(()=>document.getElementById('box-sinais-conteudo')?.offsetParent !== null));

console.log('\n3. Mudança de posição (escaras)');
await p.evaluate(()=>{ localStorage.removeItem('cf_escaras_na'); localStorage.removeItem('cf_pa'); });
await p.reload(); await p.waitForTimeout(1200);
ok('cartão aparece para todos', await p.evaluate(()=>document.getElementById('card-escaras')?.offsetParent !== null));
ok('traz a orientação de 2 em 2 horas', /2 em 2 horas/.test(await p.evaluate(()=>document.getElementById('card-escaras')?.innerText||'')));
ok('avisa que não há virada registrada', /Nenhuma virada/.test(await p.evaluate(()=>document.getElementById('aviso-proxima-virada')?.innerText||'')));
await p.evaluate(()=>registrarMudancaPosicao());
await p.waitForTimeout(300);
ok('após registrar, mostra a contagem', /Última mudança/.test(await p.evaluate(()=>document.getElementById('aviso-proxima-virada')?.innerText||'')),
   await p.evaluate(()=>document.getElementById('aviso-proxima-virada')?.innerText||''));
// simula 3 horas atrás
await p.evaluate(()=>{ const h=new Date(); h.setHours(h.getHours()-3);
  localStorage.setItem(chaveEscarasHoje(), JSON.stringify([h.getHours().toString().padStart(2,'0')+':'+h.getMinutes().toString().padStart(2,'0')]));
  renderizarEscarasHoje(); });
await p.waitForTimeout(200);
const av = await p.evaluate(()=>document.getElementById('aviso-proxima-virada')?.innerText||'');
ok('passou de 2h, avisa que está na hora', /está na hora de virar/i.test(av), av);
await p.evaluate(()=>{ document.getElementById('chk-escaras-na').checked = true; alternarEscarasNaoAplica(); });
await p.waitForTimeout(300);
ok('"não se aplica" encolhe o bloco', await p.evaluate(()=>document.getElementById('box-escaras-conteudo')?.offsetParent === null));

console.log('\n4. Gestão da Prescrição recolhível');
await p.evaluate(()=>{ document.querySelectorAll('.nav-link')[2].click(); });
await p.waitForTimeout(500);
ok('conteúdo visível por padrão', await p.evaluate(()=>document.getElementById('box-gestao-conteudo')?.offsetParent !== null));
await p.evaluate(()=>alternarBloco('gestao'));
await p.waitForTimeout(300);
ok('recolhe', await p.evaluate(()=>document.getElementById('box-gestao-conteudo')?.offsetParent === null));
ok('botão vira olho', /👁/.test(await p.evaluate(()=>document.getElementById('btn-recolher-gestao')?.innerText||'')));
await p.reload(); await p.waitForTimeout(1200);
await p.evaluate(()=>{ document.querySelectorAll('.nav-link')[2].click(); });
await p.waitForTimeout(400);
ok('continua recolhido após recarregar', await p.evaluate(()=>document.getElementById('box-gestao-conteudo')?.offsetParent === null));
await p.evaluate(()=>alternarBloco('gestao'));
await p.waitForTimeout(300);
ok('volta a abrir', await p.evaluate(()=>document.getElementById('box-gestao-conteudo')?.offsetParent !== null));

console.log('\nerros de JS: ' + (erros.length ? [...new Set(erros)].join(' | ') : 'nenhum'));
console.log(falhas===0 ? '\n✅ todas as verificações passaram' : `\n❌ ${falhas} falha(s)`);
await b.close(); srv.close(); process.exit(falhas||erros.length?1:0);
