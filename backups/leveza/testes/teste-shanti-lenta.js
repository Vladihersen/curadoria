const { chromium } = require('playwright');
const sleep = ms => new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b = await chromium.launch();
  const p = await (await b.newContext()).newPage();
  await p.route('**/functions/v1/curador', ()=>{}); // nunca responde
  await p.goto(process.argv[2]); await sleep(800);
  await p.evaluate(()=>goTo('curador')); await p.fill('#cur-nome','Teste'); await p.fill('#cur-relato','Teste de internet lenta');
  await p.evaluate(()=>chamarCurador());
  await sleep(5000);
  const a = await p.evaluate(()=>({carregando:document.getElementById('cur-loading').style.display, txt:document.getElementById('cur-text').textContent}));
  await sleep(57000);
  const d = await p.evaluate(()=>({carregando:document.getElementById('cur-loading').style.display, txt:document.getElementById('cur-text').textContent}));
  console.log('5s:', JSON.stringify(a)); console.log('62s:', JSON.stringify(d));
  await b.close();
})();
