const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {pathToFileURL}=require('node:url');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/evidence/final');
fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.ttf':'font/ttf'};
const server=http.createServer((req,res)=>{
  const file=path.join(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(data);});
});
const ready=p=>p.waitForFunction(()=>document.documentElement.dataset.hazir==='true'&&!TD.ui.read().busy);
const cell=(p,s)=>p.locator(`.hucre[data-kare="${s}"]`);
async function settings(p,values){
  if(await p.locator('#sonuc').isVisible())await p.locator('#sonuc-kapat').click();
  await p.locator('#ayarlar-ac').click();
  for(const[name,value]of Object.entries(values))await p.locator(`#ayar-form [name="${name}"][value="${value}"]`).check();
  await p.locator('#ayar-form button[type="submit"]').click();await ready(p);
}
async function run(name,type,executablePath){
  const browser=await type.launch({headless:true,executablePath});
  try{
    const context=await browser.newContext({reducedMotion:'reduce',hasTouch:true});
    const page=await context.newPage(),errors=[],external=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith('http://127.0.0.1:'))external.push(r.url());});
    for(const protocol of ['file','http']){
      await context.setOffline(protocol==='file');
      await page.goto(protocol==='file'?pathToFileURL(path.join(root,'index.html')).href:`http://127.0.0.1:${server.address().port}/index.html`);
      await ready(page);
      assert.equal(await page.evaluate(()=>TD.ui.read().mode),'ai');
      for(const level of ['easy','medium','hard']){
        await settings(page,{mode:'ai',human:1,level});
        await cell(page,'a3').tap();await cell(page,'a4').tap();await ready(page);
        assert.equal(await page.evaluate(()=>TD.ui.read().game.history.length),2);
        assert.equal(await page.evaluate(()=>TD.ui.read().position.turn),1);
        await page.locator('#geri-al').click();
        assert.equal(await page.evaluate(()=>TD.ui.read().game.history.length),0);
      }
      const before=await page.evaluate(()=>JSON.stringify(TD.ui.read().game));
      await page.locator('#ipucu').click();await ready(page);
      assert.equal(await page.evaluate(()=>JSON.stringify(TD.ui.read().game)),before);
      assert.match(await page.locator('#kenar-notu').textContent(),/^İpucu:/);
      await cell(page,'a3').click();await cell(page,'a4').click();
      await page.waitForFunction(()=>TD.ui.read().busy==='ai');
      await page.locator('#yeni-oyun').click();await ready(page);
      await page.waitForTimeout(850);
      assert.equal(await page.evaluate(()=>TD.ui.read().game.history.length),0,'Eski AI sonucu reddedildi');
      await page.evaluate(()=>{document.querySelector('#ipucu').click();document.querySelector('#yeni-oyun').click();});
      await ready(page);
      assert.equal(await page.evaluate(()=>TD.ui.read().hint),null,'İpucu iptal edildi');
      await page.locator('#ayarlar-ac').click();await page.locator('#beraberlik').click();await ready(page);
      assert(await page.evaluate(()=>{
        const s=TD.ui.read(),accept=s.metrics.depth>0&&s.metrics.score*s.position.turn*-s.human<=0;
        return !!s.game.result===accept&&s.game.history.length===0;
      }),'AI teklif kararı tamamlanmış değerlendirmeye uyar');
      await settings(page,{mode:'ai',human:-1,level:'easy'});
      assert.equal(await page.evaluate(()=>TD.ui.read().position.turn),-1);
      assert.equal(await page.locator('.tahta-satir').first().locator('.hucre').first().getAttribute('data-kare'),'h1');
      await cell(page,'a6').focus();await page.keyboard.press('ArrowLeft');
      assert.equal(await page.locator(':focus').getAttribute('data-kare'),'b6');
      await page.locator('#yeni-oyun').click();await ready(page);
      assert.equal(await page.evaluate(()=>TD.ui.read().human),-1);
      await settings(page,{mode:'local'});
      await page.locator('#ayarlar-ac').click();await page.locator('#beraberlik').click();
      assert(await page.locator('#teklif').isVisible());
      await page.keyboard.press('Escape');
      assert.equal(await page.evaluate(()=>TD.ui.read().game.result),null);
      await page.locator('#ayarlar-ac').click();await page.locator('#beraberlik').click();
      await page.locator('#teklif-kabul').click();
      assert.equal(await page.locator('#sira-yazi').textContent(),'Berabere!');
      assert.equal(await page.locator('#sonuc-baslik').textContent(),'Berabere!');
      await page.locator('#sonuc-yeni').click();await ready(page);
      // Bütün örnekleri izledikten sonra aynı oyun ve seçim geri gelir.
      await cell(page,'a3').click();
      const original=await page.evaluate(()=>JSON.stringify([TD.ui.read().game.position,TD.ui.read().game.repetitions,TD.ui.read().ids,TD.ui.read().from,TD.ui.read().prefix]));
      for(const id of ['move','capture','chain','crown']){
        await page.locator('#nasil').click();
        await page.locator(`[data-ornek="${id}"]`).click();
        assert.equal(await page.locator('#nasil-not').isVisible(),false,'Örnek başlarken yardım kapanır');
        await page.waitForFunction(()=>TD.ui.tutorial()&&!TD.ui.tutorial().running);
        assert.equal(await page.evaluate(()=>TD.ui.tutorial().error),null);
        assert.equal(await page.evaluate(()=>TD.ui.read().game.history.length),1);
        if(id==='crown')assert.equal(await cell(page,'d8').getAttribute('aria-label'),'d8, mavi dama');
        await page.locator('#oyuna-don').click();await ready(page);
        assert.equal(await page.evaluate(()=>JSON.stringify([TD.ui.read().game.position,TD.ui.read().game.repetitions,TD.ui.read().ids,TD.ui.read().from,TD.ui.read().prefix])),original);
      }
      await page.locator('#nasil').click();
      await page.locator('[data-ornek="chain"]').click();
      await page.locator('#oyuna-don').click();await ready(page);
      await page.waitForTimeout(1200);
      assert.equal(await page.evaluate(()=>TD.ui.read().from),16,'Geç öğretici adımı seçimi değiştiremez');
      await page.locator('#ses').click();
      assert.equal(await page.locator('#ses').getAttribute('aria-pressed'),'true');
      assert.equal(await page.evaluate(()=>Kit.ses.sessiz),false);
      await cell(page,'a4').click();await ready(page);
      await page.reload();await ready(page);
      assert.equal(await page.evaluate(()=>TD.ui.read().mode),'local','Mod saklanır');
      assert.equal(await page.locator('#ses').getAttribute('aria-pressed'),'true','Ses tercihi saklanır');
      assert.equal(await page.evaluate(()=>TD.ui.read().game.history.length),0,'Yarım oyun saklanmaz');
      await page.locator('#ses').click();
      await page.locator('#ayarlar-ac').click();
      assert.equal(await page.locator('.ai-ayari:visible').count(),0,'İki kişide bilgisayar alanları gizlidir');
      await page.locator('[name="help"]').uncheck();
      await page.locator('[name="motion"][value="reduce"]').check();
      await page.locator('#ayar-form button[type="submit"]').click();await ready(page);
      await cell(page,'a3').click();
      assert.equal(await page.locator('.hedef-isareti:visible').count(),0,'Hamle işaretleri kapalı');
      assert.match(await page.locator('#kenar-notu').textContent(),/gideceği kareyi seç/);
      assert.match(await cell(page,'a4').getAttribute('aria-label'),/gidilebilir kare/,'Erişilebilir hedef etiketi korunur');
      await cell(page,'a4').click();await ready(page);
      assert.equal(await page.evaluate(()=>TD.ui.read().game.history.length),1,'İşaretler kapalıyken hamle yapılır');
      await page.reload();await ready(page);
      await page.locator('#ayarlar-ac').click();
      assert.equal(await page.locator('[name="help"]').isChecked(),false);
      assert.equal(await page.locator('[name="motion"]:checked').inputValue(),'reduce');
      await page.locator('[name="help"]').check();
      await page.locator('[name="motion"][value="system"]').check();
      await page.locator('#ayar-form button[type="submit"]').click();await ready(page);
      for(const[width,height]of [[320,700],[375,812],[390,844],[768,1024],[1440,900]]){
        await page.setViewportSize({width,height});
        await page.locator('#ayarlar-ac').click();
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Settings viewport overflow');
        const bounds=await page.locator('#ayarlar').boundingBox();assert(bounds.x>=0&&bounds.x+bounds.width<=width+1);
        if(protocol==='file')await page.screenshot({path:path.join(out,`${name}-${width}-settings.png`),fullPage:true});
        await page.locator('#ayarlar-kapat').click();
      }
      console.log(`${name}/${protocol}: AI, undo, hint, orientation, draw, 4 tutorials, sound, persistence and layout passed.`);
    }
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
    await context.close();
  }finally{await browser.close();}
}
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try{await run('chromium',chromium,process.env.CHROMIUM_PATH);await run('webkit',webkit,process.env.WEBKIT_PATH);}
  finally{server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
