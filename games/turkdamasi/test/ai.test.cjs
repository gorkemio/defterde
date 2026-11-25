const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const scope=vm.createContext({performance,setTimeout,AbortController});
for(const f of ['config.js','board.js','ai.js']) {
  const source=f==='ai.js'&&process.env.AI_TEST_SOURCE?process.env.AI_TEST_SOURCE:path.join(__dirname,'..',f);
  vm.runInContext(fs.readFileSync(source,'utf8'),scope);
}
const B=scope.TD.board,A=scope.TD.ai;
const plain=x=>JSON.parse(JSON.stringify(x));
const sq=s=>'abcdefgh'.indexOf(s[0])+8*(+s[1]-1);
function game(blue,red,kings=[]){
  const cells=Array(64).fill(0);
  for(const [list,side] of [[blue,1],[red,-1]]) for(const s of list.split(' ')) cells[sq(s)]=side*(kings.includes(s)?2:1);
  return B.createGame(B.position(cells,1));
}
function reference(g,depth){
  const moves=B.legalMoves(g.position),out=B.outcome(g.position,g.repetitions,moves);
  if(out)return out.winner===0?0:out.winner*g.position.turn*A.WIN;
  if(depth<=0&&!moves[0].captures.length)return A.evaluate(g.position);
  return Math.max(...moves.map(m=>-reference(B.play(g,m,{legal:moves}),depth-1)));
}
test('all levels return complete legal turns, without changing input',async()=>{
  const g=B.createGame(),before=plain(g);
  for(const level of ['easy','medium','hard']){
    const r=await A.analyze(g,{level,budgetMs:40});
    assert(B.legalMoves(g.position).some(m=>JSON.stringify(m)===JSON.stringify(r.move)));
    assert(r.elapsedMs>=r.rootMs&&r.nodes>0);
  }
  assert.deepEqual(plain(g),before);
});
test('alpha-beta and TT scores match independent full-turn minimax with forced captures',async()=>{
  for(const g of [game('a2 c3','b4 f6'),game('a2 h2','b4 g6'),game('b2 f2','c5 g6',['b2'])]){
    const expected=reference(g,2) || 0;
    for(const transpositions of [true,false]){
      const r=await A.analyze(g,{level:'hard',maxDepth:2,budgetMs:10000,transpositions});
      assert.equal(r.depth,2);
      assert.equal(r.score || 0,expected);
    }
  }
});
test('deadline returns a legal fallback but does not publish an unfinished score',async()=>{
  let time=0;
  const g=B.createGame();
  const r=await A.analyze(g,{budgetMs:1,now:()=>++time,yieldTask:async()=>{}});
  assert(r.move);
  assert.equal(r.depth,0);
  assert.equal(r.score,null);
  assert.equal(r.timedOut,true);
});
test('cancellation applies within dense root capture generation',async()=>{
  const cells=Array(64).fill(0);cells[0]=2;
  for(const s of 'b1 d1 f1 a2 c2 e2 g2 b3 d3 f3 a4 c4 e4 b5 d5 f5'.split(' '))cells[sq(s)]=-1;
  const p=B.position(cells,1),g={position:p,repetitions:{[B.positionKey(p)]:1},history:[],result:null};
  const controller=new AbortController();let time=0;
  await assert.rejects(A.analyze(g,{signal:controller.signal,now:()=>++time,sliceMs:8,yieldTask:async()=>controller.abort()}),{name:'AbortError'});
});
test('root candidates preserve a selected capture prefix',async()=>{
  const g=game('b2 b4','c2 c4 e4');
  const legal=B.legalMoves(g.position),candidates=legal.filter(m=>m.from===legal[0].from&&m.landings[0]===legal[0].landings[0]);
  const r=await A.analyze(g,{legal,candidates,level:'hard',maxDepth:2,budgetMs:2000});
  assert(candidates.includes(r.move));
});
test('repetition context prevents a cached score crossing between histories',async()=>{
  const g=game('a1 h1','a8 h8'),table=A.createTable(64);
  await A.analyze(g,{table,maxDepth:2,budgetMs:2000});
  const repeated={...g,repetitions:{...g.repetitions,[B.positionKey(g.position)]:3}};
  const r=await A.analyze(repeated,{table,maxDepth:2,budgetMs:2000});
  assert.equal(r.score,0);assert.equal(r.move,null);
  assert(table.size<=64);
});
test('easy ties are seeded and deterministic',async()=>{
  const g=B.createGame(),options={level:'easy',budgetMs:10000,seed:77};
  const a=await A.analyze(g,options),b=await A.analyze(g,options);
  assert.deepEqual(plain(a.move),plain(b.move));
});
test('a sacrifice is chosen when the forced reply permits a two-piece recapture',async()=>{
  const g=game('a2 b2 c2 h2','c4 e2 h7');
  const r=await A.analyze(g,{level:'hard',maxDepth:3,budgetMs:10000});
  assert.equal(r.move.from,sq('c2'));assert.equal(r.move.landings[0],sq('c3'));
  const after=B.play(g,r.move),reply=B.legalMoves(after.position);
  assert.equal(reply.length,1);assert.equal(reply[0].captures.length,1);
  const recapture=B.legalMoves(B.play(after,reply[0]).position);
  assert(recapture.every(m=>m.captures.length===2));
});
test('cached nonterminal scores cannot hide a future third repetition in another history',async()=>{
  const g=game('a2 b2 c2 h2','c4 e2 h7'),table=A.createTable();
  const first=await A.analyze(g,{level:'hard',maxDepth:3,budgetMs:10000,table});
  const child=B.play(g,first.move),reply=B.legalMoves(child.position)[0];
  const future=B.play(child,reply);
  const changed={...g,repetitions:{...g.repetitions,[B.positionKey(future.position)]:2}};
  const expected=reference(changed,3)||0;
  const actual=await A.analyze(changed,{level:'hard',maxDepth:3,budgetMs:10000,table});
  assert.notEqual(expected,first.score);
  assert.equal(actual.score||0,expected);
});
