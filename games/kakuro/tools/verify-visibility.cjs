'use strict';
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {spawn}=require('node:child_process');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'kakuro-visibility-'));
  let browser,processHandle;
  const report={date:new Date().toISOString(),passed:false};
  try {
    // Playwright's normal launch forces focus/visibility. Connect to our own
    // temporary Chromium with noDefaults, preserving actual tab visibility.
    processHandle=spawn(chromium.executablePath(),[
      '--remote-debugging-port=0',`--user-data-dir=${directory}`,
      '--no-first-run','--no-default-browser-check','about:blank'
    ],{stdio:'ignore'});
    processHandle.on('error',error=>{report.launchError=error.message;});
    const endpointFile=path.join(directory,'DevToolsActivePort');
    for(let i=0;i<100&&!fs.existsSync(endpointFile);i++)await delay(100);
    const port=fs.readFileSync(endpointFile,'utf8').split('\n')[0];
    browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`,{noDefaults:true});
    const context=browser.contexts()[0],page=context.pages()[0];
    await page.goto('http://127.0.0.1:4178/');
    await page.waitForFunction(()=>document.querySelectorAll('#board .cell-button').length>0,{},{polling:50});
    await page.bringToFront();
    await page.waitForFunction(()=>!document.hidden,{},{polling:50,timeout:5000});
    const cdp=await context.newCDPSession(page);
    const {targetId}=await cdp.send('Target.createTarget',{url:'about:blank',newWindow:false,background:false});
    await cdp.send('Target.activateTarget',{targetId});
    await page.waitForFunction(()=>document.hidden,{},{polling:50,timeout:5000});
    const elapsed=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('defterde.kakuro.v1.kolay-01')).session.elapsed);
    const stopped=await elapsed();await delay(700);await page.bringToFront();
    await page.waitForFunction(()=>!document.hidden,{},{polling:50,timeout:5000});
    const resumed=await elapsed();assert.ok(resumed-stopped<100,`${resumed-stopped} ms added while hidden`);
    report.passed=true;report.method='Native second Chromium tab, CDP connection without focus emulation';
    report.hiddenIntervalMs=700;report.addedMs=resumed-stopped;
  }catch(error){report.error=error.stack;throw error;}
  finally {
    fs.writeFileSync(path.join(__dirname,'../docs/evidence/game/visibility-report.json'),JSON.stringify(report,null,2));
    await browser?.close();
    if(processHandle&&processHandle.exitCode===null){processHandle.kill();await new Promise(resolve=>processHandle.once('exit',resolve));}
    fs.rmSync(directory,{recursive:true,force:true});
    console.log(report);
  }
})().catch(error=>{console.error(error.message);process.exitCode=1;});
