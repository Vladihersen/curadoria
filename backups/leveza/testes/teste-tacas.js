const { chromium } = require('playwright');
(async()=>{
  const b = await chromium.launch();
  async function pega(url){
    const p = await (await b.newContext()).newPage(); const erros=[]; p.on('pageerror',e=>erros.push(e.message));
    await p.goto(url); 
    const r = await p.evaluate(()=>{ bellBuf=crestBuf=bellBufIn=bellBufEx=bellBufHold=bellBufExLong=null; const a=performance.now(); loadBuffers(null); const ms=performance.now()-a;
      const bufs={bellBuf,crestBuf,bellBufIn,bellBufEx,bellBufHold,bellBufExLong}; const out={};
      for(const k in bufs){ const d=bufs[k].getChannelData(0); out[k]=Array.from(d); }
      return {ms, out}; });
    return {...r, erros};
  }
  const v = await pega(process.argv[2]), n = await pega(process.argv[3]);
  let pior=0, pico=0;
  for(const k in v.out){ const a=v.out[k], c=n.out[k]; if(a.length!==c.length) throw 'tamanho '+k; for(let i=0;i<a.length;i++){ pior=Math.max(pior,Math.abs(a[i]-c[i])); pico=Math.max(pico,Math.abs(a[i])); } }
  console.log(JSON.stringify({antigo_ms:Math.round(v.ms), novo_ms:Math.round(n.ms), maiorDiferenca_dB: (20*Math.log10(pior/pico)).toFixed(0), erros:[...v.erros,...n.erros]}));
  await b.close();
})();
