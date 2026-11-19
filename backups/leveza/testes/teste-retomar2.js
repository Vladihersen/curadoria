const { chromium } = require('playwright');
const sleep = ms => new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b = await chromium.launch({ args:['--autoplay-policy=no-user-gesture-required'] });
  const p = await (await b.newContext()).newPage();
  await p.goto(process.argv[2]); await sleep(1000);
  await p.evaluate(()=>{ goTo('respirar'); selMode('soham'); });
  await p.click('#btn-start');
  const seg = await p.evaluate(async()=>{ while(!bState) await new Promise(r=>setTimeout(r,100)); const s=bState.timeline.find(s=>s.n==='silence'&&s.dipPaisagem); return {t:s.t, d:s.d, lbl:s.lbl}; });
  const agora = await p.evaluate(()=>aCtx.currentTime);
  await sleep((seg.t - agora + 6)*1000);
  const g1 = await p.evaluate(()=>({g:paisagemGain.gain.value, lbl:document.getElementById('orb-lbl').textContent, cheio:paisagemActiveCfg.vol/100}));
  await p.click('#btn-stop'); await sleep(1500); await p.click('#btn-stop'); await sleep(1500);
  const g2 = await p.evaluate(()=>paisagemGain.gain.value);
  console.log(JSON.stringify({tela:g1.lbl, volumeCheio:g1.cheio, ganhoNoSilencio:+g1.g.toFixed(4), ganhoDepoisDeRetomar:+g2.toFixed(4)}));
  await b.close();
})();
