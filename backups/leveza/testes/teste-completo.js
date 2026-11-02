const { chromium } = require('playwright');
const UAS = {
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
  android: 'Mozilla/5.0 (Linux; Android 14; SM-A536B) AppleWebKit/537.36 Chrome/129 Mobile Safari/537.36',
  desktop: null };
const file = process.argv[2]; const quais = (process.argv[3]||'iphone,android,desktop').split(',');
const sleep = ms => new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b = await chromium.launch({ args:['--autoplay-policy=no-user-gesture-required'] });
  for (const nome of quais){
    const ctx = await b.newContext({ viewport:{width:390,height:844}, userAgent: UAS[nome]||undefined });
    await ctx.addInitScript(()=>{
      window.__ativos = new Set(); const si=window.setInterval, ci=window.clearInterval;
      window.setInterval=function(f,t){ const id=si.apply(this,arguments); window.__ativos.add(id); return id; };
      window.clearInterval=function(id){ window.__ativos.delete(id); return ci.apply(this,arguments); };
      window.__off = 0;
      const realFetch = window.fetch;
      window.fetch = function(url, o){
        if(String(url).indexOf('/functions/v1/curador')>=0)
          return Promise.resolve(new Response(JSON.stringify({content:[{type:'text',text:'Olá, querida. Teste de resposta.\n\n— Shanti\n###AVALIACAO_INTERNA### {"score":62,"estado":"exp","pilar":"Meu Corpo"}'}]}),{headers:{'Content-Type':'application/json'}}));
        if(String(url).indexOf('supabase')>=0) return Promise.resolve(new Response('[]'));
        return realFetch.apply(this, arguments);
      };
    });
    const p = await ctx.newPage();
    const erros = [];
    p.on('pageerror', e=>erros.push('PAGEERROR '+e.message));
    p.on('console', m=>{ if(m.type()==='error' && !/decode audio|net::ERR_FILE|Failed to load resource|paisagem/i.test(m.text())) erros.push('CONSOLE '+m.text()); });
    await p.goto(file.startsWith('http')?file:'file://'+file); await sleep(1200);
    const log = (...a)=>console.log(`[${nome}]`, ...a);
    // navegação
    for (const s of ['respirar','diarios','curador','manual','home']) await p.evaluate(s=>goTo(s), s);
    log('navegação ok');
    // relógio adiantável
    await p.evaluate(()=>{ getACtx(); const g=Object.getOwnPropertyDescriptor(BaseAudioContext.prototype,'currentTime').get; Object.defineProperty(aCtx,'currentTime',{get(){return g.call(this)+window.__off;}}); });
    const casos = [['coer',5],['coer',20],['fisio',5],['fisio',10],['478',4],['478',8],['soham',5],['soham',10],['soham',15],['soham',20],['jornada'],['jornada3'],['jornada2']];
    for (const [modo, tv] of casos){
      await p.evaluate(()=>goTo('respirar'));
      await p.evaluate(([m,tv])=>{ selMode(m); if(tv){ if(m==='478') bReps=tv; else bTime=tv; renderTimeSelector(); } }, [modo,tv]);
      await p.click('#btn-start'); await sleep(2500);
      const a = await p.evaluate(()=>({st:aCtx.state, ok:!!bState, lbl:document.getElementById('orb-lbl').textContent, ints:window.__ativos.size, nos:schedNodes.length, fila:lazyQ.length, endT: bState&&bState.endT, t:aCtx.currentTime}));
      await p.click('#btn-stop'); await sleep(300);
      const pa = await p.evaluate(()=>({st:aCtx.state, btn:document.getElementById('btn-stop').textContent}));
      await p.click('#btn-stop'); await sleep(500);
      const re = await p.evaluate(()=>({st:aCtx.state, btn:document.getElementById('btn-stop').textContent}));
      // pula pro fim
      await p.evaluate(()=>{ window.__off += (bState.endT - aCtx.currentTime) + 0.3; }); await sleep(600);
      const fim = await p.evaluate(()=>({done:bDone, st:bState, btn:document.getElementById('btn-start').textContent, lbl:document.getElementById('orb-lbl').textContent, pais: (typeof paisagemLoopNodes!=='undefined')?paisagemLoopNodes.length:-1}));
      await sleep(4800);
      const depois = await p.evaluate(()=>({st:aCtx.state, ints:window.__ativos.size, nos:schedNodes.length, fila:lazyQ.length}));
      const durMin = ((a.endT - (a.t-2.5))/60).toFixed(1);
      const okTudo = a.ok && a.st==='running' && pa.st==='suspended' && pa.btn==='Retomar' && re.st==='running' && fim.done && fim.st===null && fim.btn==='Iniciar';
      log(`${modo}${tv?' '+tv:''}: ${okTudo?'OK':'FALHA'} | dur≈${durMin}min | rodando:${a.st} lbl:"${a.lbl.slice(0,25)}" nós:${a.nos} fila:${a.fila} intervals:${a.ints} | pausa:${pa.st}/${pa.btn} retoma:${re.st} | fim:${fim.done} "${fim.lbl.slice(0,30)}" paisagem:${fim.pais} | 5s depois: ctx ${depois.st}, intervals ${depois.ints}, nós ${depois.nos}, fila ${depois.fila}`);
    }
    // sair no meio
    await p.evaluate(()=>{goTo('respirar'); selMode('coer');}); await p.click('#btn-start'); await sleep(2000);
    await p.evaluate(()=>goTo('home')); await sleep(800);
    log('sair no meio:', JSON.stringify(await p.evaluate(()=>({bState, pais:paisagemLoopNodes.length, ints:window.__ativos.size, fila:lazyQ.length}))));
    // reiniciar rápido 3x
    await p.evaluate(()=>{goTo('respirar'); selMode('soham');});
    for(let i=0;i<3;i++){ await p.click('#btn-start'); await sleep(150); }
    await sleep(2500);
    log('reiniciar 3x:', JSON.stringify(await p.evaluate(()=>({st:aCtx.state, ok:!!bState, ints:window.__ativos.size, pais:paisagemLoopNodes.length}))));
    await p.evaluate(()=>goTo('home')); await sleep(500);
    // diário
    await p.evaluate(()=>goTo('diarios'));
    await p.fill('#diario-hoje-ta','Hoje foi um dia de teste.'); await p.click('#dsave'); await sleep(300);
    log('diário:', await p.evaluate(()=>localStorage.getItem('lv_diario_log')));
    // Shanti
    await p.evaluate(()=>goTo('curador'));
    await p.fill('#cur-nome','Teste'); await p.fill('#cur-relato','Estou cansada esta semana.');
    await p.evaluate(()=>chamarCurador()); await sleep(800);
    log('shanti:', JSON.stringify(await p.evaluate(()=>({txt:document.getElementById('cur-text').textContent.slice(0,60), log:(localStorage.getItem('lv_shanti_log')||'').length, diag:diagData}))));
    log('ERROS:', erros.length? erros : 'nenhum');
    await ctx.close();
  }
  await b.close();
})();
