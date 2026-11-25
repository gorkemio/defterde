const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const stress=require('./fixtures/stress.cjs');
const root=path.resolve(__dirname,'..'),report=[];
async function measure(page,label){
  return page.evaluate(async({stress,label})=>{
    const B=TD.board, sq=s=>'abcdefgh'.indexOf(s[0])+8*(+s[1]-1);
    const make=f=>{
      const cells=Array(64).fill(0);
      for(const[list,v]of [[f.blue,1],[f.red,-1],[f.blueKings,2],[f.redKings,-2]])
        for(const s of (list||'').split(' ').filter(Boolean))cells[sq(s)]=v;
      return B.position(cells,f.turn||1);
    };
    const cases=[['açılış',B.initialPosition()],['yoğun alma',make(stress)],['dama son oyunu',make({blueKings:'b2 f2',redKings:'c7 g7'})]];
    const rows=[];
    for(const[scenario,p]of cases){
      let active=true,timer,inputMaxMs=0,events=0;
      function probe(){
        const requested=performance.now();
        timer=setTimeout(()=>{
          if(!active)return;
          inputMaxMs=Math.max(inputMaxMs,performance.now()-requested-5);
          document.querySelector('.hucre[data-kare="a3"]').click();events++;probe();
        },5);
      }
      probe();
      const r=await TD.ai.analyze({position:p,repetitions:{[B.positionKey(p)]:1},history:[],result:null},{level:'hard'});
      active=false;clearTimeout(timer);
      rows.push({label,scenario,depth:r.depth,nodes:r.nodes,rootMs:r.rootMs,searchMs:r.searchMs,totalMs:r.elapsedMs,maxSliceMs:r.maxSliceMs,yields:r.yields,inputMaxMs,events});
    }
    return rows;
  },{stress,label});
}
async function run(name,type,executablePath){
  const browser=await type.launch({headless:true,executablePath});
  try{
    const context=await browser.newContext({reducedMotion:'reduce'}),page=await context.newPage();
    await context.setOffline(true);
    await page.goto(pathToFileURL(path.join(root,'index.html')).href);
    await page.waitForFunction(()=>document.documentElement.dataset.hazir==='true');
    await page.evaluate(()=>TD.ui.configure({mode:'local'}));
    report.push(...await measure(page,name));
    if(name==='chromium'){
      const cdp=await context.newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
      await page.setViewportSize({width:390,height:844});
      report.push(...await measure(page,'chromium/4x-CPU/mobile-emulation'));
      await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
      await cdp.send('Emulation.setPageScaleFactor',{pageScaleFactor:2});
      const zoom=await page.evaluate(()=>({scale:visualViewport.scale,width:visualViewport.width}));
      assert(zoom.scale>=1.9,'2x pinch zoom');
      await cdp.send('Emulation.setPageScaleFactor',{pageScaleFactor:1});
      await cdp.detach();
    }
    assert.equal(await page.locator('[aria-selected="true"]').getAttribute('data-kare'),'a3');
  }finally{await browser.close();}
}
(async()=>{
  await run('chromium',chromium,process.env.CHROMIUM_PATH);
  await run('webkit',webkit,process.env.WEBKIT_PATH);
  fs.writeFileSync(path.join(root,'docs/son-performans.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
