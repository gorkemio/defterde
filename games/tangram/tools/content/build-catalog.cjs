/* Explicitly curated content, never random figure generation. This is an author
   utility; the game loads the resulting local category scripts without a build. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),G=require('../../geometry.js'),V=require('../../validation.js'),C=require('../../catalog.js');
const originals=require('./originals.json'),curation=require('./curation.json');
const records=[...originals,...curation.map(p=>{
 const target=G.deriveTarget(p.solution),b=G.bounds(target.flat(2));
 const corners=target.reduce((n,poly)=>n+poly.reduce((n,r)=>n+r.length-1,0),0);
 // Provisional geometric rubric: branching outline, scattered contact and flipped parallelogram.
 const complex=corners>18||target.length>3||b.width/b.height>3||b.height/b.width>3;
 const difficulty=complex?'zor':corners<=10&&target.length===1?'kolay':'orta';
 return{id:C.fold(p.name).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''),name:p.name,category:p.category,categoryName:V.categories[p.category],difficulty,
  tags:[p.name,V.categories[p.category],p.source],reviewStatus:'pending',source:{kind:'external',author:'Innocent De Marchi',license:'GPL-2.0-or-later',
   url:'https://sourceforge.net/projects/pecesjocdetangr/',note:`Peces 5.2, fig/t7.fig: ${p.label}, satır ${p.sourceLine}. Standart koordinatlara dönüştürüldü; yuvarlanmış temaslar kesinleştirildi. ${p.adaptation||''}`.trim(),
   record:p.label,sourceLine:p.sourceLine},solutions:[p.solution]};
})];
const report=V.catalog(records,{minTotal:120,minPerCategory:8});
if(!report.valid){console.error(JSON.stringify(report,null,2));process.exit(1);}
for(const category of Object.keys(V.categories)){
 const data=records.filter(p=>p.category===category);
 const text=`/* Tangram content. Peces adaptations: GPL-2.0-or-later; see assets/licenses/peces-GPL-2.0.txt and docs/CONTENT-SOURCES.md. */\n(function(root,factory){\n if(typeof module==='object'&&module.exports)module.exports=factory();\n else((root.Tangram=root.Tangram||{}).puzzles=root.Tangram.puzzles||[]).push(...factory());\n})(typeof globalThis==='object'?globalThis:this,function(){return ${JSON.stringify(data,null,2)};});\n`;
 fs.writeFileSync(path.join(__dirname,'../../puzzles',category+'.js'),text);
}
fs.writeFileSync(path.join(__dirname,'../../docs/previews/catalog-build-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(`${report.distinct} unique valid puzzles; ${report.similar.length} similarity pairs for visual review.`);
