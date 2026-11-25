const test=require('node:test'),assert=require('node:assert/strict');
const B=require('../board.js'),G=require('../game.js'),S=require('../storage.js'),Solver=require('../solver.js');
const definition={id:'state-test',version:1,rows:3,cols:3,cells:[{type:'dark'},{type:'dark',down:4},{type:'dark',down:6},{type:'dark',across:3},{type:'white'},{type:'white'},{type:'dark',across:7},{type:'white'},{type:'white'}]};
const board=B.compileBoard(definition);
test('replace, notes, erase and undo restore the complete previous cell, but not help count',()=>{
 let s=G.createState(board);
 s=G.applyAction(s,{type:'noteMode'});s=G.applyAction(s,{type:'digit',value:2});
 s=G.applyAction(s,{type:'noteMode'});s=G.applyAction(s,{type:'digit',value:1,assisted:true});
 assert.equal(s.notes[s.selected],0);
 s=G.undo(s);assert.equal(s.notes[s.selected],2);assert.equal(s.values[s.selected],0);assert.equal(s.helps,1);
 s=G.applyAction(s,{type:'erase'});assert.equal(s.notes[s.selected],0);
 s=G.undo(s);assert.equal(s.notes[s.selected],2);
 s=G.applyAction(s,{type:'help',key:'same'});s=G.applyAction(s,{type:'help',key:'same'});
 assert.equal(s.helps,2);
});
test('completion and undo are computed from rules',()=>{
 let s=G.createState(board);const solution=Solver.countSolutions(board).solution;
 for(const cell of board.white)s=G.applyAction(s,{type:'digit',cell,value:solution[cell]});
 assert.equal(s.complete,true);s=G.undo(s);assert.equal(s.complete,false);
});
test('corrupt puzzle saves are isolated; denied storage stays usable in memory',()=>{
 const provider={getItem:k=>k.endsWith('broken')?'{':null,setItem:()=>{throw new Error('denied');}};
 const store=new S.GameStorage(provider);assert.equal(store.read('broken'),null);
 const s=G.createState(board);store.save(s,200);
 assert.equal(store.available,false);assert.deepEqual(store.load(board).values,s.values);
 const invalid={...store.load(board),notes:[1]};store.memory.set(board.id,{session:invalid});
 assert.equal(store.load(board),null);assert.ok(store.corrupt.has(board.id));
});
test('assisted/unassisted attempts, replay and undo do not duplicate or preserve incomplete attempts',()=>{
 const store=new S.GameStorage(null);let s=G.createState(board);
 const solution=Solver.countSolutions(board).solution;
 for(const cell of board.white)s=G.applyAction(s,{type:'digit',cell,value:solution[cell]});
 store.save(s,1000);store.save(s,1000);assert.equal(store.attempts(board).length,1);
 s=G.undo(s);store.save(s,1000);assert.equal(store.attempts(board).length,0);
 const last=board.white.at(-1);s=G.applyAction(s,{type:'digit',cell:last,value:solution[last],assisted:true});
 store.save(s,2000);assert.equal(store.attempts(board)[0].helps,1);
 const fresh=G.createState(board);store.save(fresh,0);assert.equal(store.attempts(board).length,1);
 assert.equal(G.createState(board,store.load(board)).history.length,0);
});
test('monotonic clock stops through hidden, list, tutorial, pause and completion intervals',()=>{
 let t=0;const clock=new G.ActiveClock(500,()=>t);clock.start();t=100;assert.equal(clock.read(),600);
 clock.stop();t=10000;assert.equal(clock.read(),600);
 clock.start();t=10100;assert.equal(clock.stop(),700);clock.stop();assert.equal(clock.read(),700);
});
test('an unchanged stale tab cannot overwrite another tab’s progress or attempts',()=>{
 const records=new Map(),provider={getItem:key=>records.get(key)??null,setItem:(key,value)=>records.set(key,value)};
 const a=new S.GameStorage(provider),b=new S.GameStorage(provider);
 let first=G.createState(board);
 a.save(first,0);
 const stale=G.createState(board,b.load(board));
 first=G.applyAction(first,{type:'digit',value:1,assisted:true});
 assert.equal(a.save(first,400),true);
 assert.equal(b.load(board,{adopt:false}).values[first.selected],1);
 assert.equal(b.save(stale,800),false);
 assert.equal(b.conflicts.has(board.id),true);
 const persisted=JSON.parse(records.get(S.STORAGE_PREFIX+board.id));
 assert.equal(persisted.session.values[first.selected],1);
 assert.equal(persisted.session.helps,1);
 const refreshed=G.createState(board,b.load(board));
 assert.equal(b.conflicts.has(board.id),false);
 assert.equal(refreshed.values[first.selected],1);
 assert.equal(b.save(refreshed,500),true);
 assert.equal(a.hasConflict(board),true);
});
test('storage access lost after a successful save uses memory on the first failed read',()=>{
 const records=new Map();let denied=false;
 const provider={getItem:key=>{if(denied)throw new Error('denied');return records.get(key)??null;},setItem:(key,value)=>records.set(key,value)};
 const store=new S.GameStorage(provider);
 const state=G.applyAction(G.createState(board),{type:'digit',value:1});
 store.save(state,100);denied=true;
 assert.equal(store.load(board).values[state.selected],1);
 assert.equal(store.available,false);
 assert.equal(store.save(G.createState(board,store.load(board)),150),true);
 assert.equal(store.load(board).values[state.selected],1);
});
