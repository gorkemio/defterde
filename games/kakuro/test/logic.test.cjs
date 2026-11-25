const test=require('node:test'),assert=require('node:assert/strict');
const B=require('../board.js'), L=require('../logic.js'),S=require('../solver.js');
const {verifyTrace}=require('../tools/verify-trace.cjs');
const def={id:'tiny',rows:3,cols:3,cells:[{type:'dark'},{type:'dark',down:4},{type:'dark',down:6},{type:'dark',across:3},{type:'white'},{type:'white'},{type:'dark',across:7},{type:'white'},{type:'white'}]};
test('logical solution is proved from empty candidates and replayed independently',()=>{
 const b=B.compileBoard(def),r=L.solveLogically(b,1);
 assert.equal(r.status,'complete'); assert.deepEqual(verifyTrace(b,r.trace),S.countSolutions(b).solution);
});
test('notes do not constrain analysis, and contradictory entries produce no hint',()=>{
 const b=B.compileBoard(def),a=L.createAnalysis(b); a.notes=Array(9).fill(1);
 assert.deepEqual(L.nextLogicalStep(b,a),L.nextLogicalStep(b,L.createAnalysis(b)));
 a.values[4]=9; assert.equal(L.nextLogicalStep(b,a).kind,'contradiction');
});
test('a digit not mandatory in every combination cannot be a hidden single',()=>{
 const g={cells:[0,1],total:8}, a={values:[0,0],candidates:[B.ALL,B.ALL]};
 const combos=L.possibleCombos(g,a,true);
 assert.equal(combos.reduce((m,c)=>m&c,B.ALL),0);
});
test('independent verifier rejects a fabricated elimination',()=>{
 const b=B.compileBoard(def),r=L.solveLogically(b,1),trace=structuredClone(r.trace);
 trace[0].changes[0].after=1;
 assert.throws(()=>verifyTrace(b,trace));
});
