const {test}=require('node:test'),assert=require('node:assert/strict');
const B=require('../board.js'),M=require('../match.js'),L=require('../layout.js');
// Euler circuit contains all 28 unordered tiles, including all seven doubles.
function fullChain(seed=3) {
  const remaining=M.shuffle(B.tiles,M.random(seed)),stack=[{value:0}],path=[];
  while(stack.length) {
    const value=stack.at(-1).value,i=remaining.findIndex(t=>B.matches(t,value));
    if(i<0) {path.push(stack.pop());continue;}
    const tile=remaining.splice(i,1)[0],other=tile.a===value?tile.b:tile.a;
    stack.push({value:other,tileId:tile.id,from:value});
  }
  return path.reverse().slice(1).map(x=>({tileId:x.tileId,inValue:x.from,outValue:x.value}));
}
test('3/10/20/28 stones, every anchor, many doubles: no overlap and matching half contacts',()=>{
  for(let seed=0;seed<80;seed++) {
    const chain=fullChain(seed);
    assert.equal(chain.length,28);
    assert.ok(chain.every((p,i)=>!i||chain[i-1].outValue===p.inValue));
    for(const count of [3,10,20,28]) for(let anchor=0;anchor<count;anchor++) {
      const sample=chain.slice(0,count),layout=L.layout(sample,sample[anchor].tileId);
      assert.deepEqual(L.validate(layout),[],`seed ${seed}, count ${count}, anchor ${anchor}`);
      for(const p of layout.placements) {
        // Independent canonical SVG transform: a is above b before rotation.
        const tile=B.byId[p.tileId],angle=p.angle*Math.PI/180;
        const halfA={x:p.x+24*Math.sin(angle),y:p.y-24*Math.cos(angle)};
        const candidates=p.halves.filter(h=>h.value===tile.a);
        assert.ok(candidates.some(h=>Math.abs((h.bounds.left+h.bounds.right)/2-halfA.x)<.01&&
          Math.abs((h.bounds.top+h.bounds.bottom)/2-halfA.y)<.01),'canonical pip half must match transformed geometry');
      }
      assert.ok(layout.bounds.right-layout.bounds.left>=720);
      assert.ok(layout.placements.every(p=>Math.min(p.bounds.right-p.bounds.left,p.bounds.bottom-p.bounds.top)>=44));
    }
  }
});
test('growth at either end leaves existing coordinates unchanged',()=>{
  const chain=fullChain(12),anchor=chain[14].tileId;
  let before=L.layout(chain.slice(14,15),anchor);
  for(let n=1;n<=14;n++) {
    const after=L.layout(chain.slice(Math.max(0,14-n),Math.min(28,15+n)),anchor);
    for(const old of before.placements) {
      const now=after.placements.find(p=>p.tileId===old.tileId);
      assert.deepEqual([now.x,now.y,now.angle],[old.x,old.y,old.angle]);
    }
    before=after;
  }
});
module.exports={fullChain};
