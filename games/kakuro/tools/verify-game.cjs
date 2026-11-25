'use strict';
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const B=require('../board.js'),S=require('../solver.js'),puzzles=require('../puzzles.js');
const ROOT=path.join(__dirname,'..'),URL='http://127.0.0.1:4178/',PREFIX='defterde.kakuro.v1.';
const capture=process.env.CAPTURE==='1',report={date:new Date().toISOString(),machine:`${os.platform()} ${os.arch()} ${os.cpus()[0].model}`,checks:[],performance:{},errors:[]};
const openBrowsers=[];
const dir=path.join(ROOT,'docs/evidence/game');fs.mkdirSync(dir,{recursive:true});
const wait=page=>page.waitForFunction(()=>document.querySelectorAll('#board .cell-button').length>0);
const record=(name,detail={})=>{report.checks.push({name,...detail});console.log('PASS',name);};
function saved(board,values,selected=board.white[0]) {return {session:{version:1,values,notes:Array(values.length).fill(0),selected,direction:'across',elapsed:1000,helps:0,helpKeys:[],attemptId:'browser-test'},attempts:[]};}
async function seed(context,definition,record) {
  await context.addInitScript(({prefix,id,data})=>{
    localStorage.setItem(prefix+id,JSON.stringify(data));
    localStorage.setItem(prefix+'preferences',JSON.stringify({last:id,difficulty:id.split('-')[0],sound:false}));
  },{prefix:PREFIX,id:definition.id,data:record});
}
async function metrics(page) {
 return page.evaluate(()=>{
  const active=[...document.querySelectorAll('button:not(:disabled),select,summary')].filter(el=>el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden');
  const small=active.filter(el=>{const r=el.getBoundingClientRect();return r.width<43.9||r.height<43.9;}).map(el=>el.id||el.className);
  return {viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,cell:parseFloat(getComputedStyle(document.querySelector('#board')).getPropertyValue('--cell-size')),smallTargets:small};
 });
}
async function main() {
 const browser=await chromium.launch({headless:true});openBrowsers.push(browser);report.chromium=browser.version();
 const context=await browser.newContext({viewport:{width:1536,height:1100}});
 await context.route('**/*',route=>/^http:\/\/127\.0\.0\.1:4178\//.test(route.request().url())?route.continue():route.abort());
 await context.addInitScript(()=>{
   window.__inputTimes=[];
   document.addEventListener('keydown',event=>{if(/^[1-9]$/.test(event.key)){const start=performance.now();requestAnimationFrame(()=>window.__inputTimes.push(performance.now()-start));}},{capture:true});
 });
 const page=await context.newPage();
 page.on('pageerror',error=>report.errors.push(error.message));
 page.on('console',message=>{if(['error','warning'].includes(message.type()))report.errors.push(message.text());});
 await page.goto(URL);await wait(page);await page.evaluate(()=>document.fonts.ready);
 assert.equal(await page.locator('#board .cell-value').count(),0);
 assert.equal(await page.locator('#board .cell-notes').count(),0);
 report.performance.loadMs=await page.evaluate(()=>performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd);
 record('Empty startup and local fonts');
 if(capture)await page.screenshot({path:path.join(dir,'start-1536.png'),fullPage:true});
 const first=B.compileBoard(puzzles[0]),solution=S.countSolutions(first).solution;
 const clickCell=i=>page.locator(`#board .cell-button[data-index="${i}"]`).click();
 const firstCell=first.white[0],button=page.locator(`#board .cell-button[data-index="${firstCell}"]`);
 const hatch=await page.locator('#board .board-ground').innerHTML();
 await clickCell(firstCell);await page.keyboard.press('n');await page.keyboard.press('2');await page.keyboard.press('4');
 assert.match(await button.getAttribute('aria-label'),/Notlar: 2, 4/);
 await page.keyboard.press('n');await page.keyboard.press(String(solution[firstCell]));
 assert.equal(await button.locator('.cell-notes').count(),0);
 await page.keyboard.press('Delete');assert.match(await button.getAttribute('aria-label'),/Boş/);
 await page.keyboard.press('Control+z');assert.match(await button.getAttribute('aria-label'),new RegExp(`Değer ${solution[firstCell]}`));
 await page.keyboard.press('Control+z');assert.match(await button.getAttribute('aria-label'),/Notlar: 2, 4/);
 assert.equal(await page.locator('#board .board-ground').innerHTML(),hatch);
 record('Write, notes, replace, erase, undo and stable hatching');
 await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#across-button').getAttribute('aria-pressed'),'true');
 await page.keyboard.press('ArrowDown');assert.equal(await page.locator('#down-button').getAttribute('aria-pressed'),'true');
 const selected=await page.locator('#board .cell.selected').getAttribute('data-index');
 await page.keyboard.press('3');assert.equal(await page.locator('#board .cell.selected').getAttribute('data-index'),selected);
 await page.keyboard.press('Control+z');
 record('Arrow direction and no automatic selection advance');
 const helps=()=>page.locator('#help-count').innerText();
 const hintStarted=await page.evaluate(()=>performance.now());
 await page.locator('#hint-button').click();
 await page.waitForFunction(()=>!document.querySelector('#hint-panel').hasAttribute('aria-busy'));
 report.performance.hintRoundTripMs=await page.evaluate(start=>performance.now()-start,hintStarted);
 assert.equal(await helps(),'1 yardım');
 await page.locator('#close-hint').click();await page.locator('#hint-button').click();assert.equal(await helps(),'1 yardım');
 let steps=1;
 while(!(await page.locator('#apply-hint').isVisible())&&steps<100) {
   await page.locator('#next-hint').click();await page.waitForFunction(()=>!document.querySelector('#hint-panel').hasAttribute('aria-busy'));steps++;
 }
 if(capture)await page.screenshot({path:path.join(dir,'hint-1536.png'),fullPage:true});
 assert.ok(steps<100);const beforeApply=await helps();await page.locator('#apply-hint').click();assert.equal(await helps(),beforeApply);
 await page.locator('#undo-button').click();assert.equal(await helps(),beforeApply);
 record('Explained hints, explicit Apply, repeated hint and undo assistance counts',{steps});
 await clickCell(firstCell);const beforeReveal=parseInt(await helps());
 await page.locator('#reveal-button').click();await page.waitForFunction(()=>document.querySelector('#hint-heading').textContent==='Bir hücre açıldı');
 assert.equal(parseInt(await helps()),beforeReveal+1);await page.locator('#undo-button').click();assert.equal(parseInt(await helps()),beforeReveal+1);
 record('Separate reveal is undoable and remains assisted');
 const group=first.groups.find(g=>g.axis==='across');
 for(const i of group.cells.slice(0,2)){await clickCell(i);await page.keyboard.press('9');}
 assert.equal(await page.locator('#error-status').isVisible(),true);
 const beforeError=await helps();await page.locator('#hint-button').click();
 await page.waitForFunction(()=>document.querySelector('#hint-heading').textContent==='Bir çelişki var');
 assert.equal(await helps(),beforeError);assert.equal(await page.locator('#apply-hint').isVisible(),false);
 if(capture)await page.screenshot({path:path.join(dir,'error-1536.png'),fullPage:true});
 await page.locator('#close-hint').click();await page.locator('#undo-button').click();await page.locator('#undo-button').click();
 record('Contradictions produce no solution hint or help charge');
 await page.locator('#pause-button').click();const paused=await page.locator('#timer').innerText();
 await page.waitForTimeout(1100);assert.equal(await page.locator('#timer').innerText(),paused);
 assert.equal(await page.locator('#board').getAttribute('aria-hidden'),'true');
 await page.locator('#resume-button').click();
 await page.locator('#help-button').click();const lessonTime=await page.locator('#timer').innerText(),beforeTutorial=await page.locator('#board .cell-value').count();
 for(let i=0;i<4;i++)await page.locator('#tutorial-next').click();
 assert.equal(await page.locator('#tutorial-board .cell-value').count(),4);
 if(capture)await page.screenshot({path:path.join(dir,'tutorial-1536.png'),fullPage:true});
 await page.waitForTimeout(1100);assert.equal(await page.locator('#timer').innerText(),lessonTime);
 assert.equal(await page.locator('#board .cell-value').count(),beforeTutorial);
 await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.id),'help-button');
 record('Pause, tutorial isolation, stopped time and Escape focus return');
 await page.locator('#list-button').click();assert.equal(await page.locator('#puzzle-list li').count(),20);
 if(capture)await page.screenshot({path:path.join(dir,'list-1536.png'),fullPage:true});
 const listTime=await page.locator('#timer').innerText();await page.waitForTimeout(1100);assert.equal(await page.locator('#timer').innerText(),listTime);
 await page.locator('#difficulty-select').selectOption('orta');await page.keyboard.press('n');
 await page.locator('[data-puzzle="orta-01"]').click();assert.equal(await page.locator('#difficulty').innerText(),'Orta');
 report.performance.inputFrameMs=await page.evaluate(()=>window.__inputTimes);
 await page.reload();await wait(page);assert.equal(await page.locator('#difficulty').innerText(),'Orta');
 assert.equal(await page.locator('#undo-button').isDisabled(),true);
 await page.locator('#new-button').click();assert.equal(await page.locator('#puzzle-number').innerText(),'02');
 record('Puzzle list, form shortcuts, last puzzle restore and next unstarted');
 // Race: changing the board immediately after starting an analysis must invalidate it.
 await page.locator('#hint-button').click();await page.locator('#board .cell-button').first().click();await page.keyboard.press('5');
 await page.waitForTimeout(100);assert.equal(await page.locator('#apply-hint').isVisible(),false);
 await page.locator('#undo-button').click();
 record('Value change invalidates a pending hint');
 report.performance.inputFrameMs.push(...await page.evaluate(()=>window.__inputTimes));
 await page.close();
 const progress=await context.newPage();await progress.goto(URL);await wait(progress);
 for(const width of [1536,1280,768,390,360]) {
   await progress.setViewportSize({width,height:1100});await progress.waitForTimeout(60);
   const data=await metrics(progress);assert.equal(data.documentWidth,width);assert.ok(data.cell>=44);assert.deepEqual(data.smallTargets,[]);
   record('Responsive '+width,data);
   if(capture)await progress.screenshot({path:path.join(dir,`game-${width}.png`),fullPage:true});
 }
 const largest=[...puzzles].sort((a,b)=>b.rows-a.rows)[0];
 await progress.locator('#list-button').click();await progress.locator('#difficulty-select').selectOption(largest.difficulty);
 await progress.locator(`[data-puzzle="${largest.id}"]`).click();
 const largeBoard=B.compileBoard(largest);
 const scrollingGroup=largeBoard.groups.find(g=>g.axis==='across'&&g.cells[0]%largeBoard.cols<7&&g.cells.at(-1)%largeBoard.cols>=7);
 assert.ok(scrollingGroup);const firstLarge=scrollingGroup.cells[0];
 await progress.locator(`#board .cell-button[data-index="${firstLarge}"]`).click();
 for(let i=0;i<12;i++)await progress.keyboard.press('ArrowRight');
 const rect=await progress.locator('#board .cell.selected').boundingBox(),area=await progress.locator('#board-viewport').boundingBox();
 assert.ok(rect.x>=area.x-1&&rect.x+rect.width<=area.x+area.width+1);
 assert.ok(await progress.locator('#board-viewport').evaluate(el=>el.scrollLeft>0));
 if(capture)await progress.screenshot({path:path.join(dir,'large-board-360.png'),fullPage:true});
 record('Largest board keeps keyboard selection visible',{rows:largest.rows,cols:largest.cols});
 if(capture) {
   await progress.locator('#hint-button').click();await progress.waitForFunction(()=>!document.querySelector('#hint-panel').hasAttribute('aria-busy'));
   await progress.screenshot({path:path.join(dir,'hint-360.png'),fullPage:true});
   await progress.locator('#list-button').click();await progress.screenshot({path:path.join(dir,'list-360.png'),fullPage:true});
   await progress.locator('#close-list').click();await progress.locator('#close-hint').click();
 }
 await progress.emulateMedia({reducedMotion:'reduce'});assert.equal(await progress.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length),0);
 await progress.setViewportSize({width:640,height:600});const reflow=await metrics(progress);assert.equal(reflow.documentWidth,640);record('Reduced motion and 640 CSS-pixel reflow',reflow);
 const touch=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const tp=await touch.newPage();await tp.goto(URL);await wait(tp);
 await tp.locator('#board .cell-button').first().tap();await tp.locator('[data-digit="2"]').tap();
 assert.equal(await tp.locator('#board .cell-value').count(),1);await tp.locator('#note-button').tap();record('Touch input and note mode');
 await touch.close();
 const doubleDefinition=puzzles.find(d=>d.cells.some(c=>c.across&&c.down));
 assert.ok(doubleDefinition);const doubleBoard=B.compileBoard(doubleDefinition);
 const dc=await browser.newContext({viewport:{width:1280,height:900}});
 await seed(dc,doubleDefinition,saved(doubleBoard,Array(doubleBoard.cells.length).fill(0)));
 const dpair=await dc.newPage();await dpair.goto(URL);await wait(dpair);
 const clue=doubleDefinition.cells.findIndex(c=>c.across&&c.down),clueButton=dpair.locator(`#board .clue-button[data-index="${clue}"]`);
 const size=(await clueButton.boundingBox()).width;
 for(const [direction,position]of [['across',{x:size*.8,y:size*.2}],['down',{x:size*.2,y:size*.8}]]) {
   await clueButton.click({position});
   assert.equal(await dpair.locator(`#${direction}-button`).getAttribute('aria-pressed'),'true');
   assert.equal(await dpair.locator('#board .clue-total.active-total').count(),1);
   assert.ok((await dpair.locator('#board .clue-total.active-total').getAttribute('class')).includes('clue-'+direction));
 }
 record('Double-clue triangles select and underline only their own direction');await dc.close();
 // Finish, undo, resume and a fresh attempt retain the previous completed attempt.
 const completeContext=await browser.newContext({viewport:{width:1280,height:900}});
 const almost=[...solution],last=first.white.at(-1);almost[last]=0;await seed(completeContext,puzzles[0],saved(first,almost,last));
 const cp=await completeContext.newPage();await cp.goto(URL);await wait(cp);
 await cp.locator(`#board .cell-button[data-index="${last}"]`).click();await cp.keyboard.press(String(solution[last]));
 assert.equal(await cp.locator('#completion').isVisible(),true);
 if(capture||process.env.CAPTURE_FINAL==='1')await cp.screenshot({path:path.join(dir,'completed-1280.png'),fullPage:true});
 await cp.locator('#undo-button').click();assert.equal(await cp.locator('#completion').isVisible(),false);
 await cp.keyboard.press(String(solution[last]));await cp.locator('#replay-button').click();await cp.locator('#confirm-replay').click();
 assert.equal(await cp.locator('#board .cell-value').count(),0);
 const attempts=await cp.evaluate(key=>JSON.parse(localStorage.getItem(key)).attempts,PREFIX+first.id);
 assert.equal(attempts.length,1);assert.equal(attempts[0].helps,0);
 record('Completion, undo and preserved unassisted replay result');await completeContext.close();
 const denied=await browser.newContext();
 await denied.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('denied','SecurityError');}}));
 const dp=await denied.newPage();await dp.goto(URL);await wait(dp);await dp.locator('#board .cell-button').first().click();await dp.keyboard.press('2');
 assert.equal(await dp.locator('#board .cell-value').count(),1);assert.match(await dp.locator('#storage-status').innerText(),/izin vermiyor/);
 record('Denied localStorage keeps the game playable');await denied.close();
 const corrupt=await browser.newContext();
 await corrupt.addInitScript(prefix=>{
   localStorage.setItem(prefix+'kolay-01','{broken');
   localStorage.setItem(prefix+'kolay-02',JSON.stringify({session:{version:999},attempts:[]}));
 },PREFIX);
 const corruptPage=await corrupt.newPage();await corruptPage.goto(URL);await wait(corruptPage);
 assert.equal(await corruptPage.locator('#board .cell-value').count(),0);
 assert.match(await corruptPage.locator('#storage-status').innerText(),/kayıt okunamadı/);
 await corruptPage.locator('#new-button').click();assert.equal(await corruptPage.locator('#puzzle-number').innerText(),'02');
 record('Corrupt and incompatible saves reset only their own puzzle');await corrupt.close();
 await context.close();await browser.close();
 for(const [name,type] of [['Chromium',chromium],['WebKit',webkit]]) {
   const b=await type.launch({headless:true});openBrowsers.push(b);
   const c=await b.newContext({viewport:{width:1280,height:900},offline:true}),p=await c.newPage(),errors=[];
   p.on('pageerror',e=>errors.push(e.message));await p.goto('file://'+path.join(ROOT,'index.html'));await wait(p);await p.evaluate(()=>document.fonts.ready);
   await p.locator('#board .cell-button').first().click();await p.keyboard.press('2');assert.equal(await p.locator('#board .cell-value').count(),1);
   assert.equal(await p.evaluate(()=>document.fonts.check('20px "Patrick Hand"')),true);assert.deepEqual(errors,[]);
   const data=await metrics(p);assert.deepEqual(data.smallTargets,[]);record(name+' offline file://',{version:b.version(),...data,errors});await c.close();await b.close();
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
 fs.writeFileSync(path.join(dir,'browser-report.json'),JSON.stringify(report,null,2));
 console.log('Browser checks passed.');
}
main().catch(async error=>{report.failure=error.stack;fs.writeFileSync(path.join(dir,'browser-report.json'),JSON.stringify(report,null,2));console.error(error);await Promise.allSettled(openBrowsers.map(b=>b.close()));process.exitCode=1;});
