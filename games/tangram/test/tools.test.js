const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const {spawnSync}=require('node:child_process');
const V=require('../validation.js'),puzzles=require('../puzzles/catalog.js');
const root=path.resolve(__dirname,'..');

test('üç giriş sayfası yerel kategori betiklerini doğru sırayla 120 kayıt olarak yükler',()=>{
  for(const entry of ['index.html','editor.html','review.html']){
    const context=vm.createContext({});
    const html=fs.readFileSync(path.join(root,entry),'utf8');
    const scripts=[...html.matchAll(/<script defer src="(puzzles\/[^"]+)"/g)].map(m=>m[1].split('?')[0]);
    assert.equal(scripts.length,11);
    scripts.forEach(file=>vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context));
    assert.deepEqual(JSON.parse(JSON.stringify(context.Tangram.puzzles)),puzzles,entry);
  }
});

test('paket aracı geçerli JSON üretir, geometri hatasını ve mevcut dosyayı korur',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tangram-pack-'));
  const input=path.join(dir,'input.json'),output=path.join(dir,'output.js');
  try{
    fs.writeFileSync(input,V.serialize(puzzles[0]));
    const run=()=>spawnSync(process.execPath,['tools/catalog.cjs','pack',input,output],{cwd:root,encoding:'utf8'});
    assert.equal(run().status,0);
    assert.deepEqual(require(output),[puzzles[0]]);
    const previous=fs.readFileSync(output,'utf8');
    assert.equal(run().status,1);
    assert.equal(fs.readFileSync(output,'utf8'),previous);
    const invalid=structuredClone(puzzles[0]);invalid.solutions[0].pop();
    fs.writeFileSync(input,JSON.stringify(invalid));
    assert.equal(run().status,1);
    assert.equal(fs.readFileSync(output,'utf8'),previous);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('SVG önizlemeleri çözümden üretilir; rapor yalnız 120 geometrik kayıt sayar',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tangram-preview-'));
  try{
    const result=spawnSync(process.execPath,['tools/catalog.cjs','previews',dir],{cwd:root,encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
    const report=JSON.parse(fs.readFileSync(path.join(dir,'report.json'),'utf8'));
    assert.equal(report.distinct,120);assert.equal(report.accepted,0);
    assert.equal(report.duplicates.length,0);
    const sheet=fs.readFileSync(path.join(dir,'isimsiz-toplu.svg'),'utf8');
    assert.equal((sheet.match(/<path /g)||[]).length,120);
    assert.doesNotMatch(sheet,/Kedi|Tavşan|Kaplumbağa|Penguen/);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
