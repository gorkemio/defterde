const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const I=require('../tools/content/import-peces.cjs'),G=require('../geometry.js');
const lines=fs.readFileSync(path.join(__dirname,'../tools/content/source/peces-t7.fig'),'utf8').split(/\r?\n/);
test('kaynak dönüştürücü yuvarlanmış temasları düzeltir; ölçü ve 45 derece şartı korunur',()=>{
 const index=lines.indexOf('Ca.001'),record=I.convert(lines[index+1]);
 assert.ok(record);assert.ok(record.maxShift<=.12);assert.equal(G.validateLayout(record.poses).valid,true);
 const bad=lines[index+1].trim().split(/\s+/);bad[4]=String(Math.PI/7);assert.equal(I.convert(bad.join(' ')),null);
 assert.equal(I.convert('55 4 0 0'),null);
});
test('120 kayıt yalnız 20 özgün ve 100 açıkça seçilmiş kaynak uyarlamasından gelir',()=>{
 const originals=require('../tools/content/originals.json'),selected=require('../tools/content/curation.json'),puzzles=require('../puzzles/catalog.js');
 assert.equal(originals.length,20);assert.equal(selected.length,100);assert.equal(puzzles.length,120);
 for(const record of selected){assert.equal(lines[record.sourceLine-1],record.label);assert.equal(G.validateLayout(record.solution).valid,true,record.name);}
 for(const p of puzzles.filter(p=>p.source.kind==='external')){assert.equal(p.source.license,'GPL-2.0-or-later');assert.ok(p.source.sourceLine);}
});
