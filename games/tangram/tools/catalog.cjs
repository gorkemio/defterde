#!/usr/bin/env node
/* Oyun için build değildir: içerik yazarı için doğrulama / dönüştürme aracı. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const G=require('../geometry.js'),V=require('../validation.js');
const command=process.argv[2]||'check',args=process.argv.slice(3);
function checked(records) {
  const report=V.catalog(records);
  if(!report.valid) throw Error(report.errors.join('\n'));
  return report;
}
try {
  if(command==='pack') {
    const [input,output]=args;
    if(!input||!output) throw Error('Kullanım: node tools/catalog.cjs pack girdi.json çıktı.js');
    const records=V.parse(fs.readFileSync(input,'utf8')); checked(records);
    // create-only: onaylanmış katalog dosyasını yanlışlıkla ezme.
    const data=JSON.stringify(records,null,2).replace(/</g,'\\u003c');
    fs.writeFileSync(output,`(function(root,factory){\nif(typeof module==='object'&&module.exports)module.exports=factory();\nelse(root.Tangram.puzzles=root.Tangram.puzzles||[]).push(...factory());\n})(typeof globalThis==='object'?globalThis:this,function(){return ${data};});\n`,{flag:'wx'});
    console.log(`${records.length} geçerli kayıt yerel JS dosyasına aktarıldı.`);
  } else if(command==='check'||command==='previews') {
    const records=require('../puzzles/catalog.js');
    const report=V.catalog(records,{minTotal:120,minPerCategory:8});
    if(!report.valid) throw Error(report.errors.join('\n'));
    const digest=crypto.createHash('sha256').update(JSON.stringify(records)).digest('hex');
    const result={...report,sha256:digest,review:'Geometri geçerli; tanınabilirlik için isimsiz kullanıcı incelemesi gerekli.'};
    if(command==='previews') {
      const output=path.resolve(args[0]||'docs/previews');
      fs.mkdirSync(output,{recursive:true});
      for(const p of records) {
        const target=G.deriveTarget(p.solutions[0]),b=G.bounds(target.flat(2));
        fs.writeFileSync(path.join(output,`${p.id}.svg`),
          `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${b.minX-.2} ${b.minY-.2} ${b.width+.4} ${b.height+.4}"><path d="${V.path(target)}" fill="#494741" fill-rule="evenodd"/></svg>\n`);
      }
      // Sabit, kategorilerden bağımsız sıra; canlı inceleme ayrıca karıştırılabilir.
      const ordered=[...records].sort((a,b)=>crypto.createHash('sha256').update(a.id).digest('hex')
        .localeCompare(crypto.createHash('sha256').update(b.id).digest('hex')));
      const cells=ordered.map((p,i)=>{
        const target=G.deriveTarget(p.solutions[0]),b=G.bounds(target.flat(2));
        const s=Math.min(170/b.width,135/b.height),x=(i%4)*240+120-(b.minX+b.width/2)*s;
        const y=Math.floor(i/4)*200+80-(b.minY+b.height/2)*s;
        return `<g transform="translate(${x} ${y}) scale(${s})"><path d="${V.path(target)}" fill="#494741" fill-rule="evenodd"/></g><text x="${i%4*240+120}" y="${Math.floor(i/4)*200+178}" text-anchor="middle" font-family="sans-serif" font-size="17">Şekil ${String(i+1).padStart(2,'0')}</text>`;
      }).join('\n');
      fs.writeFileSync(path.join(output,'isimsiz-toplu.svg'),`<svg xmlns="http://www.w3.org/2000/svg" width="960" height="${Math.ceil(records.length/4)*200}" viewBox="0 0 960 ${Math.ceil(records.length/4)*200}"><rect width="100%" height="100%" fill="#fbf9f2"/>${cells}</svg>\n`);
      for(let page=0;page<Math.ceil(ordered.length/20);page++) {
        const chunk=cells.split('\n').slice(page*20,page*20+20).join('\n');
        fs.writeFileSync(path.join(output,`isimsiz-${String(page+1).padStart(2,'0')}.svg`),
          `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="1000" viewBox="0 ${page*1000} 960 1000"><rect x="0" y="${page*1000}" width="960" height="1000" fill="#fbf9f2"/>${chunk}</svg>\n`);
      }
      fs.writeFileSync(path.join(output,'isimsiz-anahtar.json'),JSON.stringify(ordered.map((p,i)=>({number:i+1,id:p.id,name:p.name})),null,2)+'\n');
      fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(result,null,2)+'\n');
      console.log(`${records.length} siluet ve report.json: ${output}`);
    } else console.log(JSON.stringify(result,null,2));
  } else throw Error('Komutlar: check, previews [dizin], pack girdi.json çıktı.js');
} catch(error) {console.error(error.message);process.exitCode=1;}
