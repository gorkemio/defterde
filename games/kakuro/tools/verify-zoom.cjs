'use strict';
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'kakuro-zoom-'));
  let context;
  try {
    // Full Chromium exposes its native zoom setting; headless_shell does not.
    context=await chromium.launchPersistentContext(directory,{executablePath:chromium.executablePath(),headless:true,viewport:{width:1280,height:900}});
    const page=context.pages()[0];await page.goto('chrome://settings/appearance');
    await page.locator('#zoomLevel').waitFor();
    const option=await page.locator('#zoomLevel option').evaluateAll(options=>options.map(o=>({value:o.value,label:o.textContent.trim()})).find(o=>o.label==='200%'));
    assert.ok(option);await page.locator('#zoomLevel').selectOption(option.value);
    await page.goto('http://127.0.0.1:4178/');await page.waitForFunction(()=>document.querySelectorAll('#board .cell-button').length>0);
    await page.evaluate(()=>document.fonts.ready);
    const result=await page.evaluate(()=>({innerWidth,devicePixelRatio,documentWidth:document.documentElement.scrollWidth,
      minimumCell:Math.min(...[...document.querySelectorAll('#board .cell-button')].map(el=>el.getBoundingClientRect().width))}));
    assert.equal(result.innerWidth,640);assert.equal(result.devicePixelRatio,2);assert.equal(result.documentWidth,640);assert.ok(result.minimumCell>=44);
    await page.locator('#board .cell-button').first().click();await page.keyboard.press('2');
    assert.equal(await page.locator('#board .cell-value').count(),1);
    const report={passed:true,method:'Native Chromium Settings → Appearance → Page zoom → 200%',physicalViewport:1280,...result};
    const output=path.join(__dirname,'../docs/evidence/game');fs.mkdirSync(output,{recursive:true});
    if(process.env.CAPTURE==='1') {
      // Capture the actual viewport; Playwright's full-page resizing changes
      // the CSS viewport a second time when native browser zoom is active.
      const session=await context.newCDPSession(page);
      const shot=await session.send('Page.captureScreenshot',{format:'png',fromSurface:true});
      fs.writeFileSync(path.join(output,'zoom-200.png'),Buffer.from(shot.data,'base64'));
    }
    fs.writeFileSync(path.join(output,'zoom-report.json'),JSON.stringify(report,null,2));
    console.log(report);
  }finally{await context?.close();fs.rmSync(directory,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
