const { chromium } = require('playwright');
const sleep = ms => new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b = await chromium.launch({ args:['--autoplay-policy=no-user-gesture-required'] });
  const p = await (await b.newContext()).newPage(); const erros=[]; p.on('pageerror',e=>erros.push(e.message));
  await p.goto(process.argv[2]); await sleep(800);
  await p.evaluate(()=>{ goTo('respirar'); selMode('coer'); }); await p.click('#btn-start'); await sleep(8000);
  const ini = await p.evaluate(()=>({nos:paisagemLoopNodes.length, g:+paisagemGain.gain.value.toFixed(3)}));
  await p.fill('#paisagem-volume-slider','0'); await p.dispatchEvent('#paisagem-volume-slider','input'); await sleep(500);
  const zero = await p.evaluate(()=>({nos:paisagemLoopNodes.length, g:+paisagemGain.gain.value.toFixed(4), lbl:document.getElementById('paisagem-volume-label').textContent}));
  await p.fill('#paisagem-volume-slider','40'); await p.dispatchEvent('#paisagem-volume-slider','input'); await sleep(500);
  const sobe = await p.evaluate(()=>({nos:paisagemLoopNodes.length, g:+paisagemGain.gain.value.toFixed(3)}));
  // Shanti com servidor que nunca responde
  await p.evaluate(()=>{ window.fetch = ()=>new Promise(()=>{}); goTo('curador'); });
  console.log(JSON.stringify({inicio:ini, noZero:zero, depoisDeSubirPara40:sobe, erros}));
  await b.close();
})();
