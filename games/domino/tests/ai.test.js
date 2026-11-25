const {test}=require('node:test'),assert=require('node:assert/strict');
const B=require('../board'),M=require('../match'),V=require('../view'),A=require('../ai');
function position(seed=5) {
  let m=M.create({target:50},seed);
  m=M.apply(m,{type:'play',player:m.board.active,...B.legal(m.board)[0]}).state;
  for(let i=0;i<80&&!m.board.result;i++) {
    if(B.legal(m.board).length>1)return m;
    const moves=B.legal(m.board);
    m=M.apply(m,moves.length?{type:'play',player:m.board.active,...moves[0]}:
      {type:m.board.stock.length?'draw':'pass',player:m.board.active}).state;
  }
  throw Error('No branching position');
}
test('all levels legal across seeded visible positions, zero-budget medium fallback',async()=>{
  for(let seed=0;seed<50;seed++) {
    const m=position(seed),view=V.player(m,m.board.active);
    for(const level of ['easy','medium','hard']) {
      const answer=await A.choose(view,level,{seed:73,maxRounds:2,budgetMs:Infinity,now:()=>0});
      assert.ok(view.options.some(p=>p.tileId===answer.move.tileId&&p.end===answer.move.end));
    }
    const fallback=await A.choose(view,'hard',{seed:73,budgetMs:0});
    assert.deepEqual(fallback.move,A.medium(view,M.random(73)));
  }
});
test('same visible information, different real hidden distributions: identical decisions',async()=>{
  const real=position(20),seat=real.board.active,first=V.player(real,seat);
  const altered=structuredClone(real),unknown=[...altered.board.hands[1-seat],...altered.board.stock].reverse();
  const count=altered.board.hands[1-seat].length;
  altered.board.hands[1-seat]=unknown.slice(0,count);altered.board.stock=unknown.slice(count);
  altered.seed=999;const second=V.player(altered,seat);
  assert.deepEqual(first,second);
  for(const level of ['easy','medium','hard']) {
    const config={seed:18,maxRounds:12,budgetMs:Infinity,now:()=>0};
    assert.deepEqual(await A.choose(first,level,config),await A.choose(second,level,config));
  }
  second.hand[0].a=88;assert.notEqual(altered.board.hands[seat][0].a,88);
});
test('draw observations relax by subsequent draws and consume matching plays',()=>{
  const view=V.player(position(7),0);
  view.history=[{type:'drawStart',player:1,ends:[2,6]},{type:'draw',player:1,count:3},
    {type:'play',player:1,tileId:'1-2',end:'left',inValue:1,outValue:2}];
  assert.deepEqual(A.constraints(view),[{values:[2,6],max:2}]);
  view.history.push({type:'draw',player:1,count:1});
  assert.equal(A.constraints(view)[0].max,3);
});
test('sampled distributions satisfy current public bounds and conserve the pack',()=>{
  for(let seed=0;seed<30;seed++) {
    let m=M.create({target:0},seed);
    for(let step=0;step<80&&!m.result;step++) {
      const moves=B.legal(m.board),seat=m.board.active;
      if(moves.length&&m.board.chain.length) {
        const view=V.player(m,seat),sample=A.sample(view,M.random(seed*100+step));
        assert.ok(sample,'actual history must have at least one feasible sample');
        B.assertConservation(sample);
        for(const c of A.constraints(view))
          assert.ok(sample.hands[1-seat].filter(t=>c.values.some(n=>B.matches(t,n))).length<=c.max);
      }
      m=M.apply(m,moves.length?{type:'play',player:seat,...moves[0]}:
        {type:m.board.stock.length?'draw':'pass',player:seat}).state;
    }
  }
});
test('hard search yields to event loop and cancellation never returns an applicable move',async()=>{
  const view=V.player(position(20),position(20).board.active),controller=new AbortController();
  let heartbeat=false;
  setTimeout(()=>{heartbeat=true;controller.abort();},0);
  const answer=await A.choose(view,'hard',{seed:2,budgetMs:600,signal:controller.signal});
  assert.ok(heartbeat);assert.ok(answer.cancelled);assert.equal(answer.move,null);
  assert.ok(answer.stats.slices>0);
  assert.ok(answer.stats.elapsedMs<250);
});
test('only complete candidate rounds contribute before deadline; deterministic fake clock',async()=>{
  const m=position(20),view=V.player(m,m.board.active);
  let clock=0;
  const answer=await A.choose(view,'hard',{seed:10,budgetMs:3,now:()=>clock++,yieldControl:async()=>{}});
  assert.equal(answer.stats.rounds,0);assert.deepEqual(answer.move,A.medium(view,M.random(10)));
});
module.exports={position};
