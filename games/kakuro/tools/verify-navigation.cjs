'use strict';
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const B=require('../board.js'),puzzles=require('../puzzles.js');
const output=path.join(__dirname,'../docs/evidence/game');
const report={date:new Date().toISOString(),checks:[]};
let browser;
async function visible(page,selector) {
  const result=await page.locator(selector).evaluate(el=>{
    const r=el.getBoundingClientRect();
    return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:innerHeight,width:innerWidth};
  });
  assert.ok(result.top>=-1&&result.bottom<=result.height+1&&result.left>=-1&&result.right<=result.width+1,`${selector}: ${JSON.stringify(result)}`);
  return result;
}
async function record(page,name,selector) {
  report.checks.push({name,position:await visible(page,selector)});
  console.log('PASS',name);
}
(async()=>{
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:360,height:640}});
  const page=await context.newPage();
  await page.addInitScript(()=>{
    window.__audioContexts=0;
    const Audio=window.AudioContext;
    window.AudioContext=class extends Audio {constructor(...args){super(...args);window.__audioContexts++;}};
  });
  await page.goto('http://127.0.0.1:4178/');
  await page.waitForFunction(()=>document.querySelectorAll('#board .cell-button').length>0);
  await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.evaluate(()=>window.__audioContexts),0);
  await page.evaluate(()=>{
    window.__sounds=[];
    const play=Kit.ses.cal;
    Kit.ses.cal=(...args)=>{window.__sounds.push(args[0]);return play(...args);};
  });
  await page.locator('#list-button').click();
  for(const selector of ['#list-title','#difficulty-select','#close-list'])await visible(page,selector);
  await record(page,'Mobile footer opens the list at its heading and filter','#list-title');
  if(process.env.CAPTURE==='1')await page.screenshot({path:path.join(output,'navigation-list-360.png')});
  await page.locator('[data-puzzle="kolay-20"]').click();
  await record(page,'Opening a lower list entry reveals the selected square','#board .selected');
  await page.locator('#hint-button').click();
  await page.waitForFunction(()=>!document.querySelector('#hint-panel').hasAttribute('aria-busy'));
  assert.equal(await page.evaluate(()=>document.activeElement.id),'hint-heading');
  await record(page,'Mobile hint action reveals and focuses its explanation','#hint-heading');
  await visible(page,'#hint-text');
  if(process.env.CAPTURE==='1')await page.screenshot({path:path.join(output,'navigation-hint-360.png')});
  await page.locator('#close-hint').click();await visible(page,'#hint-button');
  await page.locator('#help-button').click();
  await record(page,'Tutorial heading and close action are visible','#help-title');await visible(page,'#close-help');
  await page.locator('#tutorial-board .cell-button').first().click();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#tutorial-board .selected').getAttribute('data-index'),'5');
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'help-button');
  await record(page,'Closing the tutorial returns focus to a visible control','#help-button');
  await page.locator('#list-button').click();await page.locator('#close-list').click();
  await record(page,'Closing the list returns focus to a visible control','#list-button');
  await page.locator('#board .cell-button').first().click();
  await page.keyboard.press('2');await page.keyboard.press('Backspace');
  assert.deepEqual(await page.evaluate(()=>window.__sounds),['grafit','kayma']);
  assert.ok(await page.evaluate(()=>window.__audioContexts)>0);
  assert.equal(await page.locator('#board button[tabindex="0"]').count(),1);
  assert.match(await page.locator('#board button[tabindex="0"]').getAttribute('aria-label'),/Satır \d+, sütun \d+.*Yatay toplam \d+, dikey toplam \d+/);
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'across-button');
  const ax=await context.newCDPSession(page);
  const tree=await ax.send('Accessibility.getFullAXTree');
  assert.ok(tree.nodes.some(n=>n.role?.value==='grid'&&n.name?.value==='Kakuro tahtası'));
  report.checks.push({name:'One grid tab stop, keyboard tool access, accessible labels and gesture-only pencil sounds'});
  await page.locator('#list-button').click();await page.locator('#difficulty-select').selectOption('zor');
  const largest=puzzles.find(d=>d.rows===11),board=B.compileBoard(largest);
  await page.locator(`[data-puzzle="${largest.id}"]`).click();
  // A deliberately short viewport makes downward arrow movement cross its edge.
  await page.setViewportSize({width:360,height:420});
  const group=[...board.groups].filter(g=>g.axis==='down').sort((a,b)=>b.cells.length-a.cells.length)[0];
  await page.locator(`#board .cell-button[data-index="${group.cells[0]}"]`).click();
  await page.evaluate(()=>scrollTo(0,0));
  for(let i=1;i<group.cells.length;i++){await page.keyboard.press('ArrowDown');await visible(page,'#board .selected');}
  await record(page,'Vertical keyboard movement reveals the selected square','#board .selected');
  await page.setViewportSize({width:1536,height:900});
  await page.locator('#hint-button').click();
  await page.waitForFunction(()=>!document.querySelector('#hint-panel').hasAttribute('aria-busy'));
  await record(page,'Desktop hint below the board is brought into the viewport','#hint-heading');
  await visible(page,'#hint-text');
  await page.locator('#close-hint').click();
  await page.locator('#list-button').click();await page.locator('#difficulty-select').selectOption('kolay');
  await page.locator('[data-puzzle="kolay-13"]').click();
  assert.ok(await page.locator('#scroll-cue').isHidden());
  await page.setViewportSize({width:360,height:640});
  await page.waitForFunction(()=>document.querySelector('#board').style.getPropertyValue('--cell-size')==='44px');
  assert.ok(await page.locator('#scroll-cue').isVisible(),'Narrowing the viewport must reveal the scroll cue without another game action');
  if(process.env.CAPTURE==='1')await page.screenshot({path:path.join(output,'resize-scroll-cue-360.png'),fullPage:true});
  await page.setViewportSize({width:1536,height:900});
  await page.waitForFunction(()=>parseFloat(document.querySelector('#board').style.getPropertyValue('--cell-size'))>44);
  assert.ok(await page.locator('#scroll-cue').isHidden(),'Widening the viewport must hide the obsolete scroll cue');
  report.checks.push({name:'Scroll cue follows viewport resizing in both directions without a game action'});
  report.passed=true;
})().catch(error=>{report.passed=false;report.error=error.stack;console.error(error);process.exitCode=1;})
.finally(async()=>{fs.writeFileSync(path.join(output,'navigation-report.json'),JSON.stringify(report,null,2));await browser?.close();});
