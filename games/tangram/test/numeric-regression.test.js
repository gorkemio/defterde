const {test}=require('node:test'),assert=require('node:assert/strict');
const V=require('../validation.js');
const [a,b]=require('./fixtures/touching-silhouettes.json');
test('köşede temas eden birleşik halkalar farklı siluet karşılaştırmasını bozmamalı',()=>{
 const result=V.compare(a,b);
 assert.equal(result.duplicate,false);
 assert.ok(Number.isFinite(result.similarity));
});
