const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const context=vm.createContext({performance,setTimeout,AbortController});
for(const f of ['config.js','board.js','ai.js','session.js','lessons.js','tutorial.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),context);
const B=context.TD.board,S=context.TD.session;
const sq=s=>'abcdefgh'.indexOf(s[0])+8*(+s[1]-1);
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const state=s=>JSON.parse(JSON.stringify([s.read().game,s.read().ids]));
const quick=(g,o)=>context.TD.ai.analyze(g,{...o,budgetMs:1000,maxDepth:1});
test('computer replies and undo returns to the previous human decision',async()=>{
  const s=S.create({mode:'ai',search:quick});await s.start();const before=state(s);
  await s.choose(sq('a3'));await s.choose(sq('a4'));
  assert.equal(s.read().game.history.length,2);assert.equal(s.read().position.turn,1);
  s.undo();assert.deepEqual(state(s),before);
});
test('undo while AI thinks rejects a late result and removes the human turn',async()=>{
  const waiting=deferred();const s=S.create({mode:'ai',search:()=>waiting.promise});
  await s.start();const before=state(s);
  await s.choose(sq('a3'));const pending=s.choose(sq('a4'));
  for(let i=0;s.read().busy!=='ai';i++){assert(i<1000);await new Promise(r=>setTimeout(r,0));}
  const move=s.read().legal[0];s.undo();waiting.resolve({move,depth:1,score:0});await pending;
  assert.deepEqual(state(s),before);assert.equal(s.read().error,null);
});
test('red human waits for blue opener; initial computer move cannot undo past a human decision',async()=>{
  const s=S.create({mode:'ai',human:-1,search:quick});await s.start();
  assert.equal(s.read().position.turn,-1);assert.equal(s.read().game.history.length,1);
  assert.equal(s.read().canUndo,false);
});
test('hint preserves game and selection, including a capture prefix',async()=>{
  const cells=Array(64).fill(0);for(const [s,v]of [['a2',1],['h2',1],['a3',-1],['b4',-1],['h7',-1]])cells[sq(s)]=v;
  const s=S.create({search:quick});await s.start(B.position(cells,1));
  await s.choose(sq('a2'));await s.choose(sq('a4'));
  const before=state(s),prefix=JSON.stringify(s.read().prefix);
  await s.hint();assert.deepEqual(state(s),before);assert.equal(JSON.stringify(s.read().prefix),prefix);
  assert(s.read().hint.landings.includes(sq('c4')));
});
test('local draw requires explicit acceptance; AI needs a completed nonpositive evaluation',async()=>{
  const s=S.create();await s.start();await s.offerDraw();
  assert.equal(s.read().game.result,null);assert.equal(s.read().busy,'offer');
  s.respondDraw(false);assert.equal(s.read().game.result,null);
  await s.offerDraw();s.respondDraw(true);assert.equal(s.read().game.result.reason,'agreement');
  for(const [depth,score,accepted]of [[0,null,false],[2,-10,false],[2,0,true],[2,10,true]]){
    const a=S.create({mode:'ai',search:async()=>({move:null,depth,score})});await a.start();await a.offerDraw();
    assert.equal(!!a.read().game.result,accepted);
  }
});
test('tutorial stash restores a partial chain and visual identities exactly',async()=>{
  const cells=Array(64).fill(0);for(const[s,v]of [['a2',1],['h2',1],['a3',-1],['b4',-1],['h7',-1]])cells[sq(s)]=v;
  const s=S.create();await s.start(B.position(cells,1));await s.choose(sq('a2'));await s.choose(sq('a4'));
  const before=state(s),prefix=JSON.stringify(s.read().prefix),saved=s.stash();
  await s.start();await s.restore(saved);
  assert.deepEqual(state(s),before);assert.equal(JSON.stringify(s.read().prefix),prefix);
  await s.choose(sq('c4'));assert.equal(s.read().game.history.length,1);
});
test('stopping a tutorial rejects late timers and restores the original selection',async()=>{
  const s=S.create();await s.start();await s.choose(sq('a3'));
  const before=state(s),waiting=deferred();
  const tutorial=context.TD.tutorial.create(s,{pause:()=>waiting.promise});
  const pending=tutorial.watch('chain');
  for(let i=0;s.read().position.cells[sq('c3')]!==1||s.read().from!==sq('c3');i++){
    assert(i<100);await new Promise(r=>setTimeout(r,0));
  }
  await tutorial.stop();waiting.resolve();await pending;
  assert.deepEqual(state(s),before);assert.equal(s.read().from,sq('a3'));assert.equal(tutorial.read(),null);
});
test('each tutorial completes through the session and returns to its previous game',async()=>{
  const s=S.create();await s.start();const before=state(s);
  const tutorial=context.TD.tutorial.create(s,{pause:async()=>{}});
  for(const lesson of context.TD.lessons){
    await tutorial.watch(lesson.id);
    assert.equal(tutorial.read().running,false);assert.equal(tutorial.read().error,null);
    assert.equal(s.read().game.history.length,1);
    await tutorial.stop();assert.deepEqual(state(s),before);
  }
});
