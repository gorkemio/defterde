/* Oyun, düzenleyici ve Node katalog aracı aynı kuralları kullanır. */
(function(root,factory) {
  if(typeof module==='object' && module.exports) module.exports=factory(require('./geometry.js'));
  else root.Tangram.validation=factory(root.Tangram.geometry);
})(typeof globalThis==='object'?globalThis:this, function(G) {
  'use strict';
  const categories = Object.freeze({
    'kara-hayvanlari':'Kara hayvanları', kuslar:'Kuşlar', 'deniz-canlilari':'Deniz canlıları',
    insanlar:'İnsanlar ve hareket', tasitlar:'Taşıtlar', yapilar:'Yapılar',
    'ev-esyalari':'Ev eşyaları', nesneler:'Günlük nesneler', doga:'Doğa', geometri:'Geometrik şekiller',
  });
  const text = value => typeof value==='string' && value.trim().length>0;
  const path = multi => multi.map(poly=>poly.map(ring=>ring.map(([x,y],i)=>
    `${i?'L':'M'}${x},${y}`).join(' ')+'Z').join(' ')).join(' ');
  function transform(multi,rotation,flipped) {
    const [c,s]=G.rotations[rotation];
    return multi.map(poly=>poly.map(ring=>ring.map(([x,y])=>{
      const u=flipped?-x:x; return [u*c-y*s,u*s+y*c];
    })));
  }
  function normalized(multi) {
    const b=G.bounds(multi.flat(2));
    return multi.map(poly=>poly.map(ring=>ring.map(([x,y])=>[x-b.minX-b.width/2,y-b.minY-b.height/2])));
  }
  function compare(a,b) {
    const left=normalized(a), box=G.bounds(left.flat(2));
    let similarity=0;
    for(let r=0;r<8;r++) for(const flip of [false,true]) {
      const right=normalized(transform(b,r,flip)), rb=G.bounds(right.flat(2));
      // Alanı ve dış kutusu farklı olan hedef tam kopya olamaz.
      const sameBox=Math.abs(box.width-rb.width)<1e-6 && Math.abs(box.height-rb.height)<1e-6;
      const overlap=G.area(G.combine('intersection',left,right));
      const difference=G.area(left)+G.area(right)-2*overlap;
      const score=overlap/(G.area(left)+G.area(right)-overlap);
      similarity=Math.max(similarity,score);
      if(sameBox && Math.abs(difference)<=1e-6) return {duplicate:true,similarity:1,rotation:r,flipped:flip};
    }
    return {duplicate:false,similarity};
  }
  function diagnostics(poses) {
    const errors=[], overlaps=[], contacts=[], disconnected=[];
    const list=Array.isArray(poses)?poses:[];
    const missing=G.pieces.filter(p=>!list.some(q=>q?.pieceId===p.id)).map(p=>p.id);
    let polygons=[];
    try { polygons=list.map(G.transformPiece); }
    catch(error) { return {valid:false,errors:[error.message],missing,overlaps,contacts,disconnected}; }
    for(let i=0;i<polygons.length;i++) for(let j=i+1;j<polygons.length;j++) {
      const a=polygons[i],b=polygons[j],pair=[list[i].pieceId,list[j].pieceId];
      if(G.intersectionArea(a,b)>1e-7) overlaps.push(pair);
      const points=[...a.filter(p=>b.some((q,k)=>G.pointSegmentDistance(p,q,b[(k+1)%b.length])<=G.EPSILON)),
        ...b.filter(p=>a.some((q,k)=>G.pointSegmentDistance(p,q,a[(k+1)%a.length])<=G.EPSILON))];
      if(points.length) contacts.push({pair,points});
    }
    // En büyük bağlı bileşen referans: uzakta duran tek parça doğru işaretlenir.
    const components=[],remaining=new Set(list.map(p=>p.pieceId));
    while(remaining.size) {
      const group=new Set([remaining.values().next().value]),queue=[...group];
      while(queue.length) {
        const id=queue.pop(); remaining.delete(id);
        for(const {pair} of contacts) if(pair.includes(id)) {
          for(const next of pair) if(!group.has(next)) {group.add(next);queue.push(next);}
        }
      }
      components.push([...group]);
    }
    components.sort((a,b)=>b.length-a.length);
    disconnected.push(...components.slice(1).flat());
    let check;
    try {check=G.validateLayout(list);}
    catch {check={valid:false,errors:['Geometri hesaplanamadı.']};}
    errors.push(...check.errors);
    return {...check,errors,missing,overlaps,contacts,disconnected};
  }
  function record(p) {
    const errors=[];
    if(!p || typeof p!=='object' || Array.isArray(p)) return {valid:false,errors:['Kayıt nesnesi gerekli.']};
    if(!text(p.id) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.id)) errors.push('Kalıcı id gerekli (küçük harf, rakam ve tire).');
    if(!text(p.name)) errors.push('Türkçe ad gerekli.');
    if(!Object.hasOwn(categories,p.category)) errors.push('Geçerli kategori gerekli.');
    if(p.categoryName!==categories[p.category]) errors.push('Kategori adı uyuşmuyor.');
    if(!['kolay','orta','zor'].includes(p.difficulty)) errors.push('Zorluk gerekli.');
    if(!Array.isArray(p.tags)||!p.tags.length||p.tags.some(t=>!text(t))) errors.push('Arama etiketleri gerekli.');
    if(!['pending','accepted','revision'].includes(p.reviewStatus)) errors.push('İçerik inceleme durumu gerekli.');
    if(!p.source || !text(p.source.note) || !['original','external'].includes(p.source.kind))
      errors.push('Kaynak veya özgün tasarım notu gerekli.');
    else if(p.source.kind==='external' && ['url','author','license'].some(k=>!text(p.source[k])))
      errors.push('Dış kaynak için adres, üretici ve açık lisans gerekli.');
    if(!Array.isArray(p.solutions)||!p.solutions.length) errors.push('En az bir çözüm gerekli.');
    let target=null;
    for(const [i,solution] of (Array.isArray(p.solutions)?p.solutions:[]).entries()) {
      const check=diagnostics(solution);
      if(!check.valid) {errors.push(...check.errors.map(e=>`Çözüm ${i+1}: ${e}`));continue;}
      if(!target) target=check.target;
      if(!G.evaluatePlacement(solution,target).complete) errors.push(`Çözüm ${i+1}: hedef kaplama kontrolünden geçmedi.`);
    }
    return {valid:errors.length===0,errors,target};
  }
  function catalog(records,{minTotal=0,minPerCategory=0}={}) {
    const errors=[],duplicates=[],similar=[],ids=new Set(),targets=[];
    const counts=Object.fromEntries(Object.keys(categories).map(id=>[id,0]));
    if(!Array.isArray(records)) return {valid:false,errors:['Katalog bir dizi olmalı.'],duplicates,similar,categories:counts};
    records.forEach((p,i)=>{
      const check=record(p);
      errors.push(...check.errors.map(e=>`${p?.id||i}: ${e}`));
      if(ids.has(p?.id)) errors.push(`Tekrarlanan id: ${p.id}`);
      ids.add(p?.id);
      if(check.valid) {counts[p.category]++;targets.push({id:p.id,target:check.target});}
    });
    for(let i=0;i<targets.length;i++) for(let j=i+1;j<targets.length;j++) {
      const a=targets[i],b=targets[j];
      try {
        const result=compare(a.target,b.target);
        if(result.duplicate) duplicates.push({ids:[a.id,b.id],...result});
        else if(result.similarity>=.86) similar.push({ids:[a.id,b.id],similarity:result.similarity});
      } catch {errors.push(`${a.id}/${b.id}: kopya karşılaştırması hesaplanamadı.`);}
    }
    if(duplicates.length) errors.push(`${duplicates.length} aynı siluet çifti var.`);
    const distinct=targets.length-new Set(duplicates.map(d=>d.ids[1])).size;
    if(distinct<minTotal) errors.push(`En az ${minTotal} geçerli ve farklı şekil gerekli; bulunan ${distinct}.`);
    Object.entries(counts).forEach(([id,count])=>{
      if(count<minPerCategory) errors.push(`${categories[id]}: en az ${minPerCategory} şekil gerekli.`);
    });
    return {valid:!errors.length,errors,duplicates,similar,categories:counts,total:records.length,
      validRecords:targets.length,distinct,accepted:records.filter(p=>p?.reviewStatus==='accepted').length};
  }
  function parse(json) {
    if(typeof json!=='string'||json.length>2000000) throw new Error('JSON en fazla 2 MB olabilir.');
    const value=JSON.parse(json),records=Array.isArray(value)?value:[value];
    if(!records.length||records.length>500) throw new Error('1–500 kayıt gerekli.');
    for(const p of records) {
      const check=record(p);
      if(!check.valid) throw new Error(check.errors.join(' '));
    }
    return records;
  }
  function serialize(value) {
    const json=JSON.stringify(value,null,2);
    parse(json);
    return json+'\n';
  }
  return Object.freeze({categories,path,transform,compare,diagnostics,record,catalog,parse,serialize});
});
