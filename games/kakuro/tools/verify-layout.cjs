'use strict';
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const B=require('../board.js'),S=require('../solver.js'),puzzles=require('../puzzles.js');
const dir=path.join(__dirname,'../docs/evidence/compact');fs.mkdirSync(dir,{recursive:true});
const before=process.env.BEFORE==='1',phase=before?'before':'after';
const report={date:new Date().toISOString(),checks:[],errors:[]};
let browser;
(async()=>{
  browser=await chromium.launch({headless:true});
  const targets=[['kakuro','http://127.0.0.1:4178/']];
  if(process.env.REFERENCES==='1')targets.push(['sayibulma','https://defterde.com/oyunlar/sayibulma/'],['xox','https://defterde.com/oyunlar/xox/']);
  for(const [name,url] of targets){
    const page=await browser.newPage();
    page.on('pageerror',e=>report.errors.push(e.message));
    await page.goto(url);await page.evaluate(()=>document.fonts.ready);
    if(name!=='kakuro')await page.waitForTimeout(3000);
    for(const [width,height] of [[1280,720],[768,800],[390,844],[360,740]]){
      await page.setViewportSize({width,height});await page.waitForTimeout(100);
      const data=await page.evaluate(()=>{
        const box=selector=>{const e=document.querySelector(selector);if(!e)return null;const r=e.getBoundingClientRect();return {width:r.width,height:r.height,top:r.top+scrollY,bottom:r.bottom+scrollY};};
        return {width:innerWidth,height:innerHeight,scrollHeight:document.documentElement.scrollHeight,scrollWidth:document.documentElement.scrollWidth,paper:box('.notebook,.sayfa'),board:box('#board'),tools:box('.margin-tools'),numbers:box('.number-pad'),lastTool:box('#hint-button'),footer:box('.page-footer')};
      });
      report.checks.push({name,...data});
      if(name==='kakuro'&&!before){
        assert.equal(data.scrollWidth,width,'No page-wide horizontal overflow');
        assert.ok(data.lastTool.bottom<=height,'Main tools should be visible without scrolling on the initial puzzle');
        assert.ok(data.numbers.bottom<=height,'Number pad should be visible without scrolling');
        assert.ok(data.scrollHeight<=height+1,'Initial puzzle should fit one viewport');
      }
      if(width!==768||name==='kakuro')await page.screenshot({path:path.join(dir,name+'-'+phase+'-'+width+'.png'),fullPage:true});
    }
    await page.close();
  }
  if(!before){
    const context=await browser.newContext({viewport:{width:360,height:740},hasTouch:true,isMobile:true});
    const page=await context.newPage();await page.goto('http://127.0.0.1:4178/');
    for(const definition of [puzzles.find(p=>p.id==='kolay-13'),puzzles.find(p=>p.rows===11)]){
      await page.locator('#list-button').click();await page.locator('#difficulty-select').selectOption(definition.difficulty);
      await page.locator('[data-puzzle="'+definition.id+'"]').click();
      await page.waitForTimeout(100);
      const board=B.compileBoard(definition);
      const limits=await page.evaluate(()=>{
        const area=document.querySelector('#board-viewport'),cell=document.querySelector('#board .cell-button').getBoundingClientRect();
        const targets=[...document.querySelectorAll('button,select')].filter(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden');
        return {pageHeight:document.documentElement.scrollHeight,width:document.documentElement.scrollWidth,cell:cell.width,areaHeight:area.clientHeight,boardHeight:area.scrollHeight,small:targets.filter(e=>{const r=e.getBoundingClientRect();return r.width<43.9||r.height<43.9;}).map(e=>e.id||e.className)};
      });
      assert.equal(limits.width,360);assert.ok(limits.pageHeight<=740);assert.ok(limits.cell>=44);assert.deepEqual(limits.small,[]);
      assert.ok(limits.boardHeight>limits.areaHeight);assert.ok(await page.locator('#scroll-cue').isVisible());
      const group=board.groups.filter(g=>g.axis==='down').sort((a,b)=>b.cells.length-a.cells.length)[0];
      await page.locator('#board .cell-button[data-index="'+group.cells[0]+'"]').click();
      for(let i=1;i<group.cells.length;i++){
        await page.keyboard.press('ArrowDown');
        const cell=await page.locator('#board .selected').boundingBox(),area=await page.locator('#board-viewport').boundingBox();
        assert.ok(cell.y>=area.y-1&&cell.y+cell.height<=area.y+area.height+1,'Keyboard selection stays inside the board viewport');
      }
      const digit=S.countSolutions(board).solutions[0][board.white[0]];
      await page.locator('#board .cell-button').first().tap();await page.locator('[data-digit="'+digit+'"]').tap();
      assert.equal(await page.locator('#board .cell-value').count(),1);
      const area=await page.locator('#board-viewport').boundingBox();
      await page.locator('#board-viewport').evaluate(e=>{e.scrollTop=0;});
      const cdp=await context.newCDPSession(page),x=area.x+area.width/2,from=area.y+area.height-20,to=area.y+20;
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:from}]});
      for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:from+(to-from)*i/8}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      await page.waitForTimeout(100);
      assert.ok(await page.locator('#board-viewport').evaluate(e=>e.scrollTop>0),'A swipe scrolls the board');
      assert.equal(await page.locator('#board .cell-value').count(),1,'A swipe does not enter a number');
      await page.screenshot({path:path.join(dir,'board-'+definition.rows+'-360.png'),fullPage:true});
      const padTop=(await page.locator('.number-pad').boundingBox()).y;
      const across=board.groups.find(g=>g.axis==='across');
      for(const cell of across.cells.slice(0,2)){
        await page.locator('#board .cell-button[data-index="'+cell+'"]').click();await page.keyboard.press('9');
      }
      assert.ok(await page.locator('#error-status').isVisible());
      assert.equal((await page.locator('.number-pad').boundingBox()).y,padTop,'A group warning must not move the input controls');
      await page.locator('#list-button').click();assert.ok(await page.locator('#game-feedback').isHidden());await page.locator('#close-list').click();
      report.checks.push({name:'Large board '+definition.rows+' keeps page, targets, keyboard and touch usable',...limits});
    }
    await context.close();
  }
  assert.deepEqual(report.errors,[]);report.passed=true;
})().catch(e=>{report.passed=false;report.error=e.stack;console.error(e);process.exitCode=1;})
.finally(async()=>{fs.writeFileSync(path.join(dir,phase+'.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser?.close();});
