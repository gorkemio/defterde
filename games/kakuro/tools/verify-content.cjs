'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),os=require('node:os');
const B=require('../board.js'),S=require('../solver.js'),L=require('../logic.js');
const {verifyTrace}=require('./verify-trace.cjs'),{canonical,random,geometry,structure,fill}=require('./generate.cjs');
const definitions=require('../puzzles.js'),proofs=JSON.parse(fs.readFileSync(path.join(__dirname,'../generated/proofs.json'),'utf8'));
const report={date:new Date().toISOString(),machine:`${os.platform()} ${os.arch()} ${os.cpus()[0].model}`,count:definitions.length,categories:{},puzzles:[],passed:false};
assert.equal(definitions.length,60);assert.equal(proofs.length,60);
const signatures=new Set(),layouts=new Map(),ids=new Set();
for(const difficulty of ['kolay','orta','zor']) {
  const items=definitions.filter(d=>d.difficulty===difficulty),categoryLayouts=new Set();
  assert.equal(items.length,20);report.categories[difficulty]={count:20,layouts:0};
  for(const d of items) {
    assert.ok(!ids.has(d.id));ids.add(d.id);
    const b=B.compileBoard(d);assert.ok(b.ok,`${d.id}: ${b.errors}`);
    assert.ok(d.cells.every(c=>!('value'in c)&&!('solution'in c)&&!('notes'in c)));
    const level=['kolay','orta','zor'].indexOf(d.difficulty)+1,min=[5,7,9][level-1],max=[7,9,11][level-1];
    assert.ok(d.rows>=min&&d.rows<=max&&d.cols>=min&&d.cols<=max);
    const signature=canonical(b),layout=canonical(b,false);
    assert.equal(signature,d.verification.signature);assert.equal(layout,d.verification.layout);
    assert.ok(!signatures.has(signature),'Rotated/mirrored duplicate');signatures.add(signature);
    layouts.set(layout,(layouts.get(layout)||0)+1);assert.ok(layouts.get(layout)<=4);
    categoryLayouts.add(layout);
    const exact=S.countSolutions(b,undefined,{maxMs:30000,maxNodes:1000000});
    assert.equal(exact.status,'unique',d.id);
    const proof=proofs.find(p=>p.id===d.id);assert.ok(proof);
    assert.deepEqual(verifyTrace(b,proof.trace),exact.solution);
    const logical=L.solveLogically(b,level);assert.equal(logical.status,'complete');
    assert.deepEqual(verifyTrace(b,logical.trace),exact.solution);
    const lower=[];for(let l=1;l<level;l++){const result=L.solveLogically(b,l);assert.equal(result.status,'stuck');lower.push(result.status);}
    assert.equal(d.verification.logicalLevel,level);assert.equal(d.verification.score,logical.score);
    assert.deepEqual(d.verification.techniques,logical.usage);
    // Replay the generator from this puzzle's own seed. It consumes the size
    // draw before building geometry, so each accepted puzzle is reproducible.
    const rng=random(d.seed),n=([5,6,7].map(x=>x+2*(level-1)))[Math.floor(rng()*3)];
    const generated=structure(geometry(n,rng,proof.layoutGenerator||'clusters'),n),filled=fill(generated,rng);
    for(const g of generated.groups)generated.definition.cells[g.clue][g.axis]=g.cells.reduce((sum,i)=>sum+filled[i],0);
    assert.equal(canonical(B.compileBoard(generated.definition)),signature,'Seed replay differs');
    report.puzzles.push({id:d.id,size:`${d.rows}×${d.cols}`,white:b.white.length,level,lowerLevels:lower,
      traceSteps:logical.trace.length,usage:logical.usage,score:logical.score,signature,layout,exact:exact.stats});
  }
  assert.ok(categoryLayouts.size>=5);report.categories[difficulty].layouts=categoryLayouts.size;
}
report.passed=true;
fs.writeFileSync(path.join(__dirname,'../generated/verification-report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({passed:true,count:report.count,categories:report.categories,exactMaxMs:Math.max(...report.puzzles.map(p=>p.exact.elapsedMs))},null,2));
