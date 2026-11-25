// Independent proof replay: simple DFS of each group, not the production DP,
// combination index, nextLogicalStep, or applyLogicalStep implementation.
'use strict';
const assert = require('node:assert/strict');
function hasPlacement(group, candidates, forcedCell, digit) {
  const cells = [...group.cells].sort((a,b)=>a===forcedCell?-1:b===forcedCell?1:0);
  function visit(position, sum, used) {
    if (position === cells.length) return sum === group.total;
    const cell = cells[position], remaining = cells.length-position-1;
    for (let n=1;n<=9;n++) {
      if (cell===forcedCell && n!==digit) continue;
      const bit=2**(n-1);
      if (used.has(n) || !(candidates[cell]&bit)) continue;
      const next=sum+n;
      if (next+remaining > group.total || next+remaining*9 < group.total) continue;
      used.add(n);
      if (visit(position+1,next,used)) { used.delete(n); return true; }
      used.delete(n);
    }
    return false;
  }
  return visit(0,0,new Set());
}
function verifyTrace(board, trace) {
  const candidates = board.cells.map(c=>c.type==='white'?511:0), values=Array(board.cells.length).fill(0);
  for (const step of trace) {
    assert.ok(['placement','elimination'].includes(step.kind));
    assert.ok(step.groups.length && step.groups.every(id=>board.groups[id]));
    for (const c of step.changes) {
      assert.equal(c.before,candidates[c.cell]);
      assert.ok(c.after && (c.after & c.before) === c.after);
      for (let digit=1;digit<=9;digit++) if ((c.before & 2**(digit-1)) && !(c.after & 2**(digit-1))) {
        assert.ok(step.groups.some(id=>{
          const group=board.groups[id];
          return group.cells.includes(c.cell) && !hasPlacement(group,candidates,c.cell,digit);
        }), `Unproven elimination ${step.technique} cell=${c.cell} digit=${digit}`);
      }
    }
    for (const c of step.changes) candidates[c.cell]=c.after;
    if (step.placement) {
      const {cell,value}=step.placement;
      assert.equal(values[cell],0);
      assert.equal(candidates[cell],2**(value-1));
      values[cell]=value;
    }
  }
  assert.ok(board.white.every(i=>values[i]));
  for (const g of board.groups) {
    const ds=g.cells.map(i=>values[i]);
    assert.equal(new Set(ds).size,ds.length); assert.equal(ds.reduce((a,b)=>a+b,0),g.total);
  }
  return values;
}
module.exports={hasPlacement,verifyTrace};
