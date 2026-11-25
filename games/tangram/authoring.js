(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./validation.js'));
  else root.Tangram.authoring=factory(root.Tangram.validation);
})(typeof globalThis==='object'?globalThis:this,function(V){
  'use strict';
  function draft(metadata,poses) {
    return {
      id:metadata.id,name:metadata.name,category:metadata.category,
      categoryName:V.categories[metadata.category],difficulty:metadata.difficulty,
      tags:metadata.tags,reviewStatus:'pending',source:{...metadata.source},
      solutions:[poses.filter(p=>p.zone==='board').map(({pieceId,x,y,rotation,flipped})=>
        ({pieceId,x,y,rotation,flipped}))],
    };
  }
  function exportRecord(record,catalog) {
    const json=V.serialize(record),check=V.record(record);
    // Atölyede yalnız değişen kaydı karşılaştır. Katalog içindeki bütün çiftler
    // toplu araçta denetlenir; her düğme tıklamasında 120² karşılaştırma gerekmez.
    for(const other of catalog) {
      if(other.id===record.id)continue;
      const prior=V.record(other);
      if(!prior.valid)throw Error(`${other.id}: ${prior.errors.join(' ')}`);
      if(V.compare(check.target,prior.target).duplicate)throw Error(`Aynı siluet katalogda var: ${other.name}. Kopya dışa aktarılmadı.`);
    }
    return json;
  }
  // İçerik sürümü işareti; güvenlik/kriptografik bütünlük iddiası yoktur.
  function fingerprint(p) {
    const text=JSON.stringify([p.id,p.name,p.category,p.solutions]);
    let hash=2166136261;
    for(let i=0;i<text.length;i++)hash=Math.imul(hash^text.charCodeAt(i),16777619)>>>0;
    return hash.toString(16).padStart(8,'0');
  }
  function reviewNote(store,p) {
    const hash=fingerprint(p),saved=store?.version===1?store.notes?.[p.id]:null;
    const note=saved?.fingerprint===hash?saved:{};
    return {fingerprint:hash,guess:typeof note.guess==='string'?note.guess:'',
      decision:['accepted','revision'].includes(note.decision)?note.decision:'pending',
      note:typeof note.note==='string'?note.note:''};
  }
  function reviewSession(storage) {
    const key='defterde.tangram.review.v1';
    let writable=true;
    const session={store:{version:1,notes:{},order:[]},warning:'',
      save(){
        if(!writable)return false;
        try{storage().setItem(key,JSON.stringify(this.store));return true;}
        catch{writable=false;this.warning='Bu tarayıcıya kayıt yazılamıyor.';return false;}
      }};
    try{
      const raw=storage().getItem(key);
      if(raw){
        const saved=JSON.parse(raw);
        if(saved?.version!==1||!saved.notes||typeof saved.notes!=='object'||Array.isArray(saved.notes)){
          writable=false;session.warning='Önceki kayıt sürümü okunamadı; üzerine yazılmayacak.';
        }else session.store=saved;
      }
    }catch{writable=false;session.warning='Bu tarayıcıda kayıt okunamıyor; üzerine yazılmayacak.';}
    return session;
  }
  return Object.freeze({draft,exportRecord,fingerprint,reviewNote,reviewSession});
});
