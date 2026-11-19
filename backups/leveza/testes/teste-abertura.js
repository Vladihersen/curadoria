const { chromium } = require('playwright');
const sleep = ms => new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b = await chromium.launch({ args:['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({viewport:{width:390,height:844}});
  await ctx.addInitScript(()=>{
    window.__lt=[]; try{ new PerformanceObserver(l=>l.getEntries().forEach(e=>window.__lt.push([Math.round(e.startTime),Math.round(e.duration)]))).observe({type:'longtask',buffered:true}); }catch(e){}
  });
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate',{rate: Number(process.argv[3]||4)});
  for (const rodada of ['1ª abertura','2ª abertura (com cache)']){
    const t0=Date.now();
    await p.goto(process.argv[2], {waitUntil:'load'});
    const tLoad=Date.now()-t0;
    await sleep(4000);
    const m = await p.evaluate(()=>{
      const nav=performance.getEntriesByType('navigation')[0]; const fp=performance.getEntriesByName('first-contentful-paint')[0];
      return {primeiraPintura: fp&&Math.round(fp.startTime), domPronto: Math.round(nav.domContentLoadedEventEnd), tarefasLongas: window.__lt, ctxCriadoNaAbertura: typeof aCtx!=='undefined' && !!aCtx};
    });
    // tempo pra sintetizar as taças
    const sint = await p.evaluate(()=>{ bellBuf=crestBuf=bellBufIn=bellBufEx=bellBufHold=bellBufExLong=null; const a=performance.now(); loadBuffers(null); return Math.round(performance.now()-a); });
    console.log(rodada, JSON.stringify({load_ms:tLoad, ...m, sintetizarTacas_ms:sint}));
  }
  await b.close();
})();
