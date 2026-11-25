'use strict';
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const output=path.join(__dirname,'../docs/evidence/family');
const key='defterde.kakuro.v1.kolay-01';
const report={date:new Date().toISOString(),passed:false};
let browser;
(async()=>{
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:900}});
  const older=await context.newPage();
  await older.goto('http://127.0.0.1:4178/');
  await older.locator('#board .cell-button').first().waitFor();
  const newer=await context.newPage();
  await newer.goto('http://127.0.0.1:4178/');
  await newer.locator('#board .cell-button').first().click();await newer.keyboard.press('1');
  await older.locator('#storage-conflict').waitFor({state:'visible'});
  assert.equal(await older.locator('[data-digit="2"]').isDisabled(),true);
  assert.equal(await older.locator('#hint-button').isDisabled(),true);
  const saved=()=>newer.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
  let record=await saved();assert.equal(record.session.values.filter(Boolean).length,1);
  const timer=await older.locator('#timer').innerText();
  // Both the old tab's periodic save and visibility handler must remain safe.
  await older.bringToFront();await older.waitForTimeout(5200);
  assert.equal(await older.locator('#timer').innerText(),timer);
  record=await saved();assert.equal(record.session.values.filter(Boolean).length,1);
  assert.equal(record.session.values.find(Boolean),1);
  if(process.env.CAPTURE==='1')await older.screenshot({path:path.join(output,'storage-conflict-desktop.png'),fullPage:true});
  await older.locator('#reload-latest').click();
  assert.equal(await older.locator('#storage-conflict').isVisible(),false);
  assert.equal(await older.locator('#board .cell-value').count(),1);
  await older.locator('#board .cell-button').first().click();await older.keyboard.press('2');
  assert.equal((await saved()).session.values.find(Boolean),2);
  await newer.locator('#storage-conflict').waitFor({state:'visible'});
  report.passed=true;
  report.checks=['Other-tab update blocks stale input and hints','Stale autosave and visibility preserve the new digit','Conflict stops the stale timer','Explicit reload adopts the latest record and permits editing'];
})().catch(error=>{report.error=error.stack;console.error(error);process.exitCode=1;})
.finally(async()=>{fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'multitab-report.json'),JSON.stringify(report,null,2));await browser?.close();console.log(report);});
