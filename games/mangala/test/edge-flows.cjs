const assert = require('node:assert/strict');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const pw = require(process.argv[2] || 'playwright');
(async () => {
  const browser = await pw.chromium.launch({channel:'chrome',headless:true});
  const page = await browser.newPage({viewport:{width:320,height:800},reducedMotion:'reduce'});
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  try {
    await page.goto(pathToFileURL(path.resolve('index.html')).href);
    await page.evaluate(()=>Mangala.app.newGame({mode:'local',sets:5,difficulty:'hard',preview:true},{firstPlayer:0}));
    await page.reload();
    const saved=await page.evaluate(()=>Mangala.app.snapshot());
    assert.equal(saved.settings.mode,'local');assert.equal(saved.settings.sets,5);assert.equal(saved.settings.preview,true);
    assert.equal(saved.board.counts.reduce((a,b)=>a+b),48);assert.equal(saved.history.length,0);
    const terminal=await page.evaluate(async()=>{
      Mangala.app.newGame({mode:'local'},{firstPlayer:0}); let seed=444,moves=0;
      while(Mangala.app.snapshot().board.status==='playing'&&moves++<500){
        const moves=Mangala.board.legalMoves(Mangala.app.snapshot().board);
        seed=(Math.imul(seed,1664525)+1013904223)>>>0;
        await Mangala.app.play(moves[seed%moves.length]);
      }
      const end=Mangala.app.snapshot(); const pit=end.board.lastMove.pit;
      Mangala.app.undo(); return {pit,counts:end.board.counts};
    });
    await page.emulateMedia({reducedMotion:'no-preference'});
    const animation=await page.evaluate(async pit=>{
      const observed=[];let active=true;
      const sample=()=>{
        const counts=[...document.querySelectorAll('.pit-count,.store-count')].reduce((s,e)=>s+Number(e.textContent),0);
        const hand=document.getElementById('held-stones');
        observed.push(counts+(hand.hidden?0:Number(hand.dataset.count)));
        if(active)requestAnimationFrame(sample);
      };
      const start=performance.now();const promise=Mangala.app.play(pit);requestAnimationFrame(sample);
      await promise;active=false;
      return {observed,elapsed:performance.now()-start,counts:Mangala.app.snapshot().board.counts,
        resultVisible:document.getElementById('result-title').getBoundingClientRect().top>=0};
    },terminal.pit);
    assert.deepEqual(animation.counts,terminal.counts);
    assert.ok(animation.observed.length>2&&animation.observed.every(n=>n===48));
    assert.ok(animation.elapsed<1300);assert.ok(animation.resultVisible);
    await page.locator('#undo').click();assert.equal((await page.evaluate(()=>Mangala.app.snapshot())).results.length,0);
    // Reduced-motion change midway must resolve to the committed result.
    await page.evaluate(()=>{Mangala.app.newGame({mode:'local'},{firstPlayer:0});void Mangala.app.play(3);});
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.waitForFunction(()=>Mangala.app.activity()==='idle');
    assert.equal(await page.locator('[data-position="6"] output').textContent(),'1');
    // A 320 CSS px viewport at DPR 2 represents 640 physical pixels at 200% scaling.
    const zoom=await browser.newContext({viewport:{width:320,height:800},deviceScaleFactor:2,reducedMotion:'reduce'});
    const zp=await zoom.newPage();await zp.goto(pathToFileURL(path.resolve('index.html')).href);
    await zp.evaluate(()=>Mangala.app.newGame({mode:'local'},{firstPlayer:0}));
    const scale=await zp.evaluate(()=>({dpr:devicePixelRatio,width:innerWidth,scroll:document.documentElement.scrollWidth}));
    assert.equal(scale.width,scale.scroll);assert.equal(scale.dpr,2);
    await zoom.close();
    assert.deepEqual(errors,[]);
    const report={date:new Date().toISOString(),settingsPersist:'passed',freshGameAfterReload:'passed',
      terminalAnimation:{frames:animation.observed.length,elapsed:animation.elapsed,allFrames48:true},
      terminalUndo:'passed',reducedMotionChange:'passed',scaleEmulation:scale,errors};
    fs.writeFileSync('docs/edge-checks.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
  }finally{await browser.close();}
})();
