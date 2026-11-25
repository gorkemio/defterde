const test = require('node:test'), assert = require('node:assert/strict');
const B = require('../board.js'), S = require('../solver.js');
function square(a = [3, 7], d = [4, 6]) {
  return B.compileBoard({ id: 'tiny', rows: 3, cols: 3, cells: [
    { type: 'dark' }, ...d.map(down => ({ type: 'dark', down })),
    { type: 'dark', across: a[0] }, { type: 'white' }, { type: 'white' },
    { type: 'dark', across: a[1] }, { type: 'white' }, { type: 'white' }
  ] });
}
// Independent exhaustive comparison: no solver propagation or combinations.
function brute(board, values = Array(board.cells.length).fill(0)) {
  const solutions = [];
  function visit(k) {
    if (k === board.white.length) {
      if (board.groups.every(g => {
        const ns = g.cells.map(i => values[i]);
        return new Set(ns).size === ns.length && ns.reduce((a,b)=>a+b,0) === g.total;
      })) solutions.push([...values]);
      return;
    }
    const cell = board.white[k], fixed = values[cell];
    for (const n of fixed ? [fixed] : [1,2,3,4,5,6,7,8,9]) { values[cell] = n; visit(k + 1); }
    values[cell] = fixed;
  }
  visit(0); return solutions;
}
test('compile rejects orphan, missing, impossible and disconnected cells', () => {
  assert.equal(square().ok, true);
  const d = structuredClone(square().definition); d.cells[0].across = 3;
  assert.equal(B.compileBoard(d).ok, false);
  delete d.cells[0].across; delete d.cells[1].down;
  assert.equal(B.compileBoard(d).ok, false);
  assert.equal(square([2,7]).ok, false);
  const cells=Array.from({length:25},()=>({type:'dark'}));
  for(const i of [6,7,11,12,18,19,23,24])cells[i]={type:'white'};
  for(const i of [1,2,13,14])cells[i].down=3;
  for(const i of [5,10,17,22])cells[i].across=3;
  const disconnected=B.compileBoard({rows:5,cols:5,cells});
  assert.equal(disconnected.ok,false);assert.ok(disconnected.errors.includes('Beyaz alan bağlantısız.'));
  const longCells=Array.from({length:33},(_,i)=>Math.floor(i/11)>0&&i%11>0?{type:'white'}:{type:'dark'});
  for(let i=1;i<11;i++)longCells[i].down=3;
  longCells[11].across=45;longCells[22].across=45;
  assert.equal(B.compileBoard({rows:3,cols:11,cells:longCells}).ok,false);
});
test('exact outcomes match independent enumeration on small boards', () => {
  for (const sums of [[3,7,4,6], [4,4,4,4], [3,7,3,5], [10,11,9,12], [16,6,11,11]]) {
    const b = square(sums.slice(0,2), sums.slice(2));
    const expected = brute(b);
    const actual = S.countSolutions(b);
    assert.equal(actual.status, !expected.length ? 'none' : expected.length === 1 ? 'unique' : 'multiple');
    assert.equal(actual.solutions.length, Math.min(2, expected.length));
    for (const s of actual.solutions) assert.ok(expected.some(e => e.join() === s.join()));
  }
});
test('budget and cancellation can never certify uniqueness', async () => {
  const b = square();
  assert.equal(S.countSolutions(b, Array(9).fill(0), { maxMs: 0 }).status, 'unknown');
  assert.equal(S.countSolutions(b, Array(9).fill(0), { maxNodes: 0 }).status, 'unknown');
  const controller = new AbortController(); controller.abort();
  assert.equal((await S.countSolutionsAsync(b, Array(9).fill(0), { signal: controller.signal })).reason, 'cancelled');
  const interrupted=S.countSolutions(square([4,4],[4,4]),undefined,{maxNodes:3});
  assert.equal(interrupted.status,'unknown');
  assert.equal(interrupted.solutions.length,1);
});
test('group DP agrees with independent forced-placement search on varying constraints',()=>{
  const {hasPlacement}=require('../tools/verify-trace.cjs');
  let seed=817;
  const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let k=0;k<60;k++){
    const length=2+Math.floor(rnd()*5),total=length*(length+1)/2+Math.floor(rnd()*(length*(10-length)));
    const g={cells:Array.from({length},(_,i)=>i),total:Math.min(45,total)};
    const c=g.cells.map(()=>1+Math.floor(rnd()*511)),support=S.groupSupport(g,c).support;
    for(const cell of g.cells)for(let digit=1;digit<=9;digit++)
      assert.equal(Boolean(support[cell]&B.bit(digit)),Boolean(c[cell]&B.bit(digit))&&hasPlacement(g,c,cell,digit));
  }
});
test('large searches yield and can be cancelled during propagation',async()=>{
  const cells=Array.from({length:100},(_,i)=>Math.floor(i/10)>0&&i%10>0?{type:'white'}:{type:'dark'});
  for(let i=1;i<10;i++){cells[i].down=45;cells[i*10].across=45;}
  const board=B.compileBoard({rows:10,cols:10,cells}),controller=new AbortController();
  setTimeout(()=>controller.abort(),0);
  const result=await S.countSolutionsAsync(board,Array(100).fill(0),{signal:controller.signal});
  assert.equal(result.status,'unknown');assert.equal(result.cancelled,true);
});
test('cell-specific support includes every valid placement, including a nine-cell run', () => {
  const g = { cells: [0,1,2], total: 6 };
  assert.deepEqual(S.groupSupport(g, [B.bit(1)|B.bit(2), B.bit(1)|B.bit(2), B.ALL]).support,
    [B.bit(1)|B.bit(2),B.bit(1)|B.bit(2),B.bit(3)]);
  const long = S.groupSupport({ cells: [0,1,2,3,4,5,6,7,8], total:45 }, Array(9).fill(B.ALL));
  assert.deepEqual(long.support, Array(9).fill(B.ALL));
});
test('completion uses rules; duplicate, impossible remainder and wrong sums report groups', () => {
  const b = square(), v = Array(9).fill(0);
  assert.equal(B.validateValues(b,v).valid,true);
  v[4]=2; v[5]=2;
  assert.ok(B.validateValues(b,v).issues.some(i => i.type === 'repeat'));
  v[4]=9; v[5]=0;
  assert.equal(B.validateValues(b,v).valid,false);
  const solution=S.countSolutions(b).solution;
  assert.equal(B.validateValues(b,solution).complete,true);
  const repeatedAcrossGroups=square([3,5],[3,5]);
  assert.equal(B.validateValues(repeatedAcrossGroups,[0,0,0,0,1,2,0,2,3]).complete,true);
});
module.exports={square,brute};
