const { test } = require('node:test');
const assert = require('node:assert/strict');
const B = require('../board.js'), M = require('../match.js'), V = require('../view.js');
const t = id => B.byId[id];
function fixture(h0, h1, chain, stock = null) {
  const used = [...h0, ...h1, ...chain.map(p => p.tileId)];
  const remainder = B.tiles.filter(x => !used.includes(x.id));
  // For empty-pool positions, put the unused identities into the public chain.
  const extra = stock === null ? [] : remainder.filter(x => !stock.includes(x.id))
    .map(x => ({ tileId: x.id, inValue: x.a, outValue: x.b }));
  const allChain = extra.length ? [chain[0], ...extra, ...chain.slice(1)] : chain;
  return { hands: [h0.map(t), h1.map(t)], chain: allChain,
    stock: stock === null ? remainder : stock.map(t), active: 0, opening: null,
    anchorId: allChain[0]?.tileId, passes: 0, drawing: false, result: null, history: [], revision: 0 };
}
const p = (id, a, b) => ({ tileId: id, inValue: a, outValue: b });
test('double-six set and deterministic 7+7+14 deal', () => {
  assert.equal(B.tiles.length, 28); assert.equal(new Set(B.tiles.map(x => x.id)).size, 28);
  assert.equal(B.tiles.filter(x => x.a === x.b).length, 7);
  const a = M.create({}, 123), b = M.create({}, 123);
  assert.deepEqual(a, b); assert.deepEqual(a.board.hands.map(h => h.length), [7, 7]);
  assert.equal(a.board.stock.length, 14); assert.ok(B.assertConservation(a.board));
});
test('opening: highest dealt double, otherwise sum then high half; pool excluded', () => {
  assert.deepEqual(B.opening([[t('1-1'), t('5-6')], [t('3-3')]]), { player: 1, tileId: '3-3' });
  assert.deepEqual(B.opening([[t('3-4')], [t('2-5')]]), { player: 1, tileId: '2-5' });
  for (let seed = 0; seed < 40; seed++) {
    const s = M.create({}, seed).board, legal = B.legal(s);
    assert.equal(legal.length, 1); assert.equal(legal[0].tileId, s.opening.tileId);
    assert.throws(() => B.apply(s, { type: 'draw', player: s.active }));
    assert.throws(() => B.apply(s, { type: 'play', player: 1-s.active, ...legal[0] }));
    const different=s.hands[s.active].find(t=>t.id!==legal[0].tileId);
    assert.throws(()=>B.apply(s,{type:'play',player:s.active,tileId:different.id,end:'start'}));
    assert.throws(()=>B.apply(s,{type:'play',player:s.active,tileId:'missing',end:'start'}));
  }
});
test('left/right orientation, zero matching, doubles keep one chain and switch turn', () => {
  let s = fixture(['0-2', '2-2', '2-6'], ['1-4'], [p('2-3', 2, 3), p('3-6', 3, 6)]);
  const before = JSON.stringify(s);
  let n = B.apply(s, { type: 'play', player: 0, tileId: '0-2', end: 'left' }).state;
  assert.equal(JSON.stringify(s), before);
  assert.deepEqual(n.chain[0], p('0-2', 0, 2)); assert.deepEqual(B.ends(n), [0, 6]);
  assert.equal(n.active, 1);
  n = B.apply(s, { type: 'play', player: 0, tileId: '2-6', end: 'right' }).state;
  assert.deepEqual(n.chain.at(-1), p('2-6', 6, 2));
  n = B.apply(s, { type: 'play', player: 0, tileId: '2-2', end: 'left' }).state;
  assert.equal(n.chain.length, 3); assert.equal(n.active, 1); assert.equal(n.passes, 0);
  assert.throws(() => B.apply(s, { type: 'play', player: 0, tileId: '0-2', end: 'right' }));
  n=B.apply({...s,passes:1},{type:'play',player:0,tileId:'2-2',end:'left'}).state;
  assert.equal(n.passes,0);
  s = fixture(['1-1','0-0'], ['1-4'], [p('0-3',0,3),p('3-5',3,5)]);
  assert.deepEqual(B.legal(s), [{tileId:'0-0',end:'left'}]);
});
test('50/100 point matches reach a winner across fresh deals in both modes',()=>{
  for(const mode of ['computer','local'])for(const target of [50,100])for(let seed=0;seed<30;seed++) {
    let m=M.create({mode,target},seed),steps=0;
    while(!m.result&&steps++<3000) {
      if(m.board.result){m=M.nextRound(m);assert.deepEqual(m.board.hands.map(h=>h.length),[7,7]);continue;}
      const moves=B.legal(m.board);
      m=M.apply(m,moves.length?{type:'play',player:m.board.active,...moves[0]}:
        {type:m.board.stock.length?'draw':'pass',player:m.board.active}).state;
    }
    assert.ok(m.result);assert.ok(m.scores[m.result.winner]>=target);
  }
});
test('draw one at a time, stop at first playable, final stock tile included', () => {
  let s = fixture(['1-1'], ['2-2'], [p('0-3',0,3),p('3-6',3,6)], ['1-2','1-6']);
  assert.throws(() => B.apply(s, {type:'pass',player:0}));
  const a = B.apply(s,{type:'draw',player:0});
  assert.deepEqual(a.events, [{type:'drawStart',player:0,ends:[0,6]},{type:'draw',player:0,count:1}]);
  s = a.state; assert.equal(B.legal(s).length,0);
  s = B.apply(s,{type:'draw',player:0}).state;
  assert.equal(s.stock.length,0); assert.equal(s.hands[0].at(-1).id,'1-6');
  assert.equal(s.active,0); assert.equal(B.legal(s).length,1);
  assert.throws(() => B.apply(s,{type:'draw',player:0}));
  assert.throws(() => B.apply(s,{type:'pass',player:0}));
});
test('one pass continues; second blocks; difference, tie, and zero-point win', () => {
  let s = fixture(['1-1'], ['2-2'], [p('0-3',0,3),p('3-6',3,6)], []);
  s=B.apply(s,{type:'pass',player:0}).state; assert.equal(s.result,null);assert.equal(s.active,1);
  s=B.apply(s,{type:'pass',player:1}).state;
  assert.deepEqual(s.result,{winner:0,reason:'blocked',points:2,tallies:[2,4]});
  assert.throws(()=>B.apply(s,{type:'pass',player:0}));
  s=fixture(['1-3'],['2-2'],[p('0-5',0,5),p('5-6',5,6)],[]);
  s=B.apply(B.apply(s,{type:'pass',player:0}).state,{type:'pass',player:1}).state;
  assert.equal(s.result.winner,null);assert.equal(s.result.points,0);
  s=fixture(['2-6'],['0-0'],[p('1-2',2,1),p('1-3',1,3)],[]);
  s=B.apply(s,{type:'play',player:0,tileId:'2-6',end:'left'}).state;
  assert.equal(s.result.winner,0);assert.equal(s.result.points,0);assert.equal(s.result.reason,'empty');
});
test('normal score, overshooting target, ties in one-hand and point matches', () => {
  let match=M.create({target:50},1);
  match.board=fixture(['2-6'],['5-5'],[p('1-2',2,1),p('1-3',1,3)],[]);
  match.scores=[47,12];
  let next=M.apply(match,{type:'play',player:0,tileId:'2-6',end:'left'}).state;
  assert.deepEqual(next.scores,[57,12]);assert.equal(next.result.winner,0);
  assert.throws(()=>M.nextRound(next));
  for(const target of [0,50]) {
    match=M.create({target},1);
    match.board=fixture(['1-3'],['2-2'],[p('0-5',0,5),p('5-6',5,6)],[]);
    match=M.apply(match,{type:'pass',player:0}).state;
    next=M.apply(match,{type:'pass',player:1}).state;
    assert.deepEqual(next.scores,[0,0]);
    if(target===0) assert.equal(next.result.winner,null);
    else {assert.equal(next.result,null);assert.equal(M.nextRound(next).round,2);}
  }
});
test('view is an independent explicit allowlist; draws never disclose an identity', () => {
  const match=M.create({},42), seat=match.board.active;
  match.board.surpriseSecret='private';
  const view=V.player(match,seat);
  for(const key of ['stock','hands','seed','surpriseSecret','board']) assert.equal(view[key],undefined);
  view.hand[0].a=99; view.scores[0]=900;
  assert.notEqual(match.board.hands[seat][0].a,99);assert.equal(match.scores[0],0);
});
test('400 seeded completed hands preserve 28 unique identities and legal adjacency', () => {
  for(let seed=0;seed<400;seed++) {
    let m=M.create({target:0},seed), steps=0;
    const rng=M.random(seed+99), transcript=[];
    while(!m.result && steps++<150) {
      const b=m.board, legal=B.legal(b);
      const action=legal.length ? {type:'play',player:b.active,...legal[Math.floor(rng()*legal.length)]}
        : {type:b.stock.length?'draw':'pass',player:b.active};
      const change=M.apply(m,action);m=change.state;transcript.push(change.events);
      assert.ok(B.assertConservation(m.board));
      assert.ok(m.board.chain.every((p,i,a)=>!i||a[i-1].outValue===p.inValue));
    }
    assert.ok(m.result);assert.ok(steps<150);
    let repeat=M.create({target:0},seed);const again=M.random(seed+99), events=[];
    while(!repeat.result) {
      const b=repeat.board, moves=B.legal(b);
      const changed=M.apply(repeat,moves.length?{type:'play',player:b.active,...moves[Math.floor(again()*moves.length)]}
        :{type:b.stock.length?'draw':'pass',player:b.active});
      events.push(changed.events);repeat=changed.state;
    }
    assert.deepEqual(events,transcript);
  }
});
