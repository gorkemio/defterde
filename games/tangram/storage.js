(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory(require('./geometry.js'),require('./authoring.js'));
 else root.Tangram.storage=factory(root.Tangram.geometry,root.Tangram.authoring);
})(typeof globalThis==='object'?globalThis:this,function(G,A){
 'use strict';
 const KEY='defterde.tangram.play.v1',clone=x=>JSON.parse(JSON.stringify(x));
 const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
 const empty=()=>({version:1,completed:{},favorites:[],sessions:{},preferences:{sound:true,boundaries:false,boundariesChosen:false},lastId:null,designs:[],draft:null,hints:{}});
 function snapshotValid(s){
  if(!object(s)||!Array.isArray(s.pieces)||s.pieces.length!==7||!s.pieces.every(object))return false;
  if(new Set(s.pieces.map(p=>p.pieceId)).size!==7)return false;
  try{
   for(const p of s.pieces){
    G.transformPiece(p);
    if(!['tray','board'].includes(p.zone)||Math.abs(p.x)>1000||Math.abs(p.y)>1000)return false;
    // Eski kayıtlarda tepsi yönü yoktur; varsa gerçek poz kadar sıkı doğrulanır.
    G.transformPiece({...p,
     rotation:Object.hasOwn(p,'homeRotation')?p.homeRotation:p.rotation,
     flipped:Object.hasOwn(p,'homeFlipped')?p.homeFlipped:p.flipped});
   }
  }catch{return false;}
  return s.selected===null||Object.hasOwn(G.byId,s.selected);
 }
 function create(storage){
  let writable=true;const store={data:empty(),warning:'',
   save(){if(!writable)return false;try{storage().setItem(KEY,JSON.stringify(this.data));return true;}
    catch{writable=false;this.warning='Bu oturumda kaydedilemiyor. Oynamaya devam edebilirsin.';return false;}},
   remember(p,b){this.data.lastId=p.id;this.data.sessions[p.id]={fingerprint:A.fingerprint(p),...(b.transaction||b.snapshot()),history:b.history.slice(-50)};},
   restore(p,b){const s=this.data.sessions[p.id];if(!s||s.fingerprint!==A.fingerprint(p)||!snapshotValid(s))return false;
    b.restore(s);b.history=Array.isArray(s.history)?s.history.filter(snapshotValid).slice(-50).map(clone):[];return true;},
   saveDesign(name,poses,id){
    name=String(name).trim().slice(0,80);if(!name)throw Error('Şekline bir ad ver.');
    const solution=poses.map(({pieceId,x,y,rotation,flipped})=>({pieceId,x,y,rotation,flipped}));
    const check=G.validateLayout(solution);if(!check.valid)throw Error(check.errors.join(' '));
    const old=this.data.designs.find(p=>p.id===id);if(id&&!old)throw Error('Düzenlenecek şekil bulunamadı.');
    const record={id:old?.id||`benim-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`,name,
     category:'benim',categoryName:'Benim şekillerim',difficulty:'orta',tags:[name],personal:true,reviewStatus:'personal',
     source:{kind:'original',note:'Bu tarayıcıda oyuncu tarafından tasarlandı.'},solutions:[solution]};
    if(old){this.data.designs=this.data.designs.map(p=>p.id===id?record:p);delete this.data.sessions[id];delete this.data.completed[id];}
    else this.data.designs.push(record);this.save();return record;
   }
  };
  try{const raw=storage().getItem(KEY);if(raw){const s=JSON.parse(raw);
   if(s?.version!==1||!object(s.sessions)||!object(s.completed)||!object(s.preferences)||!Array.isArray(s.favorites)||!Array.isArray(s.designs))throw Error('version');
   const prefs=empty().preferences;
   for(const key of Object.keys(prefs))if(typeof s.preferences[key]==='boolean')prefs[key]=s.preferences[key];
   store.data={...empty(),...s,preferences:prefs,hints:object(s.hints)?s.hints:{}};
   store.data.favorites=s.favorites.filter(x=>typeof x==='string');
   store.data.designs=s.designs.filter(p=>{try{return p.personal===true&&/^benim-[a-z0-9-]+$/.test(p.id)&&typeof p.name==='string'&&G.validateLayout(p.solutions[0]).valid;}catch{return false;}});
  }}catch{writable=false;store.warning='Önceki kayıt okunamadı; üzerine yazılmıyor. Bu oturum bellekte devam ediyor.';}
  return store;
 }
 return Object.freeze({KEY,create,snapshotValid});
});
