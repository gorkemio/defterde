const {test}=require('node:test'),assert=require('node:assert/strict');
const U=require('../ui-support');

// Minimal DOM contract double: reparenting a focused node drops browser focus.
// This tests controller-independent reconciliation, not CSS or browser rendering.
function handFixture() {
  const document={activeElement:null};
  const parent={ownerDocument:document,children:[],moves:0,
    contains(node){return this.children.includes(node);},
    insertBefore(node,before){
      node.remove();this.moves++;
      const index=before?this.children.indexOf(before):this.children.length;
      this.children.splice(index,0,node);node.parent=this;
    }};
  const tile=id=>({id,parent:null,focusCalls:0,
    focus(){document.activeElement=this;this.focusCalls++;},
    remove(){
      if(!this.parent)return;
      this.parent.children.splice(this.parent.children.indexOf(this),1);
      if(document.activeElement===this)document.activeElement=null;
      this.parent=null;
    }});
  const nodes=['0-1','2-5','3-3'].map(tile);
  for(const node of nodes)parent.insertBefore(node,null);
  parent.moves=0;
  return {document,parent,nodes,tile};
}

test('opponent draw rerenders retain the focused tile without moving existing nodes',()=>{
  const {document,parent,nodes}=handFixture();
  nodes[1].focus();
  for(let draw=0;draw<14;draw++)U.reconcileChildren(parent,nodes);
  assert.equal(document.activeElement,nodes[1]);
  assert.equal(parent.moves,0);
  assert.equal(nodes[1].focusCalls,1);
});
test('sorting preserves focused tile identity; a newly drawn tile appends without disturbing it',()=>{
  const {document,parent,nodes,tile}=handFixture();
  nodes[2].focus();
  const sorted=[nodes[2],nodes[0],nodes[1]],drawn=tile('5-6');
  U.reconcileChildren(parent,sorted);
  assert.deepEqual(parent.children,sorted);
  assert.equal(document.activeElement,nodes[2]);
  const previousMoves=parent.moves;
  U.reconcileChildren(parent,[...sorted,drawn]);
  assert.equal(parent.moves-previousMoves,1);
  assert.equal(document.activeElement,nodes[2]);
});
test('a removed hand or played tile is never resurrected to restore focus',()=>{
  const {document,parent,nodes}=handFixture();
  nodes[0].focus();
  U.reconcileChildren(parent,nodes.slice(1));
  assert.equal(document.activeElement,null);
  assert.equal(nodes[0].focusCalls,1);
  U.reconcileChildren(parent,[]);
  assert.equal(parent.children.length,0);
});
function finished(winner,reason='empty',points=12) {
  return {settings:{names:['Deniz','Bilgisayar']},result:{winner},
    board:{result:{winner,reason,points,tallies:winner===0?[0,12]:[12,0]}}};
}
test('human and computer final moves announce winner and exact point calculation',()=>{
  for(const winner of [0,1]){
    const match=finished(winner),copy=U.resultCopy(match);
    assert.ok(copy.announcement.includes(`${match.settings.names[winner]} kazandı`));
    assert.ok(copy.announcement.includes('+12 puan'));
    assert.ok(copy.announcement.includes('Maç bitti'));
    const live={textContent:''},heading={focusCount:0,focus(){this.focusCount++;}};
    const document={getElementById:id=>id==='announcement'?live:heading,querySelector:()=>null};
    U.announceResult(document,copy);
    assert.equal(live.textContent,copy.announcement);
    assert.equal(heading.focusCount,1);
    document.querySelector=()=>({open:true});
    U.announceResult(document,copy);
    assert.equal(heading.focusCount,1,'open help/setup keeps focus');
  }
});
test('accessible result copy distinguishes blocked ties and zero-point victories',()=>{
  const tie=finished(null,'blocked',0);
  tie.result=null;tie.board.result.tallies=[8,8];
  assert.match(U.resultCopy(tie).announcement,/Berabere!.*İki pas: el kilitlendi.*Puan verilmedi/);
  const zero=finished(0,'empty',0);zero.board.result.tallies=[0,0];
  assert.match(U.resultCopy(zero).announcement,/Deniz kazandı.*\+0 puan.*Bu da bir galibiyet/);
});
