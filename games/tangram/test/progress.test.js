const {test}=require('node:test'),assert=require('node:assert/strict');
const S=require('../storage.js'),C=require('../catalog.js'),B=require('../board.js'),H=require('../learning.js');
const puzzles=require('../puzzles/catalog.js'),G=require('../geometry.js');
const memory=()=>{const m=new Map();return{getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),m};};
test('ilerleme, tercihler ve yarım yerleşim yenilemeden sonra geri gelir',()=>{
 const mem=memory(),s=S.create(()=>mem),p=puzzles[0],b=B.create(p);
 b.select('large-a');b.place({...b.current(),zone:'board',x:2,y:3});
 s.data.completed[p.id]={at:'today',hints:1};s.data.favorites=[p.id];s.data.preferences.sound=false;
 s.remember(p,b);s.save();const restored=S.create(()=>mem),next=B.create(p);
 assert.equal(restored.restore(p,next),true);assert.deepEqual(next.pieces,b.pieces);
 assert.equal(next.history.length,1);assert.equal(restored.data.lastId,p.id);assert.ok(restored.data.completed[p.id]);
 assert.equal(restored.restore({...p,solutions:[puzzles[1].solutions[0]]},B.create(p)),false);
});
test('engelli, kota dolu, bozuk veya bilinmeyen kayıt oyunu durdurmaz ve eski veriyi ezmez',()=>{
 const blocked=S.create(()=>{throw Error('denied');});assert.equal(blocked.save(),false);assert.ok(blocked.warning);
 const mem=memory();mem.setItem(S.KEY,'{"version":99}');const unknown=S.create(()=>mem);assert.equal(unknown.save(),false);assert.equal(mem.getItem(S.KEY),'{"version":99}');
 mem.setItem(S.KEY,'broken');assert.equal(S.create(()=>mem).save(),false);
 const bad={version:1,sessions:4,completed:{},preferences:{},favorites:[],designs:[]};mem.setItem(S.KEY,JSON.stringify(bad));assert.equal(S.create(()=>mem).save(),false);
 const quota=S.create(()=>({getItem:()=>null,setItem:()=>{throw Error('quota');}}));quota.data.favorites=['kare'];assert.equal(quota.save(),false);assert.deepEqual(quota.data.favorites,['kare']);
});
test('bozuk parça kaydı yüklenmez; tamamlandı önizlemeyle oluşmaz',()=>{
 const mem=memory(),s=S.create(()=>mem),p=puzzles[0],b=B.create(p);s.remember(p,b);
 s.data.sessions[p.id].pieces[0].rotation=99;s.save();assert.equal(S.create(()=>mem).restore(p,B.create(p)),false);
 assert.deepEqual(s.data.completed,{});
});
test('bozuk oturum, geçmiş ve taslak parçaları hata atmadan reddedilir',()=>{
 const p=puzzles[0],b=B.create(p);
 const damage=[
  s=>{s.pieces[0]=null;},
  s=>{s.pieces[0].homeRotation=99;},
  s=>{s.pieces[0].homeRotation=null;},
  s=>{s.pieces[0].homeFlipped='false';},
  s=>{s.pieces[0].homeFlipped=true;},
 ];
 for(const corrupt of damage){
  const mem=memory(),store=S.create(()=>mem);
  store.remember(p,b);
  const invalid=structuredClone(b.snapshot());corrupt(invalid);
  assert.equal(S.snapshotValid(invalid),false);
  store.data.draft=invalid;
  store.data.sessions[p.id].history=[invalid,b.snapshot()];
  store.save();
  const loaded=S.create(()=>mem),restored=B.create(p);
  assert.equal(S.snapshotValid(loaded.data.draft),false);
  assert.equal(loaded.restore(p,restored),true);
  assert.equal(restored.history.length,1);
  assert.doesNotThrow(()=>B.layout(restored.target,320,restored.pieces));
  corrupt(loaded.data.sessions[p.id]);
  assert.equal(loaded.restore(p,B.create(p)),false);
 }
});
test('eski tepsi alanları olmayan geçerli kayıt yüklenebilir',()=>{
 const b=B.create(puzzles[0]),snapshot=b.snapshot();
 for(const p of snapshot.pieces){delete p.homeRotation;delete p.homeFlipped;}
 assert.equal(S.snapshotValid(snapshot),true);
 b.restore(snapshot);assert.doesNotThrow(()=>B.layout(b.target,320,b.pieces));
});
test('Türkçe arama, filtre, sayfalama ve tamamlanmamış önceliği birlikte çalışır',()=>{
 assert.equal(C.fold('ÇİĞ ŞÜKRÜ ı'),'cig sukru i');
 const list=[{id:'a',name:'Çığ',tags:['dağ'],category:'doga',difficulty:'kolay'},{id:'b',name:'Kuş',tags:['uçan'],category:'kuslar',difficulty:'zor'},{id:'c',name:'Küçük kuş',tags:[],category:'kuslar',difficulty:'kolay'}];
 const progress={completed:{b:{}},favorites:['c']};
 assert.deepEqual(C.filter(list,{query:'ucan'},progress).map(p=>p.id),['b']);
 assert.deepEqual(C.filter(list,{status:'favorites',category:'kuslar'},progress).map(p=>p.id),['c']);
 assert.equal(C.random(list,progress,()=>0).id,'a');assert.equal(C.next(list,list[1],progress).id,'c');
 assert.deepEqual(C.page(list,99,2).items.map(p=>p.id),['c']);assert.equal(C.page([],99,2).number,0);
});
test('katalog yüksekliğe göre sayfalanır; dar ekranda bütün kayıtlar erişilir',()=>{
 for(const [width,height,expected] of [[884,550,16],[884,410,12],[560,410,9],[272,410,6],[272,180,2]]){
  const capacity=C.capacity(width,height);assert.equal(capacity.size,expected);
  assert.ok(capacity.rows*136<=height);
  const seen=[];
  for(let i=0;i<Math.ceil(puzzles.length/capacity.size);i++)seen.push(...C.page(puzzles,i,capacity.size).items.map(p=>p.id));
  assert.equal(seen.length,puzzles.length);assert.equal(new Set(seen).size,puzzles.length);
 }
 assert.equal(C.capacity(272,0).size,2);
});
test('ipucu eş üçgenleri ve alternatif bölünmeyi cezalandırmadan örnek verir',()=>{
 const p=puzzles.find(p=>p.id==='dikdortgen'),poses=structuredClone(p.solutions[0]);
 [poses[0].pieceId,poses[1].pieceId]=[poses[1].pieceId,poses[0].pieceId];
 const board=B.create(p);board.pieces=poses.map(p=>({...p,zone:'board'}));
 assert.equal(H.hint(p,board.pieces),null);
 board.pieces[0].x+=.3;const before=JSON.stringify(board.pieces),hint=H.hint(p,board.pieces);
 assert.ok(hint.pieceId);assert.equal(hint.example,true);assert.equal(JSON.stringify(board.pieces),before);
});
test('kişisel şekil yalnız tüm parçalar geçerliyse saklanır ve 120 hazır şekilden ayrıdır',()=>{
 const s=S.create(()=>memory()),p=puzzles[0];const personal=s.saveDesign('Benim evim',p.solutions[0]);
 assert.ok(personal.id.startsWith('benim-'));assert.equal(personal.personal,true);assert.equal(s.data.designs.length,1);
 assert.throws(()=>s.saveDesign('Eksik',p.solutions[0].slice(1)));
 assert.throws(()=>s.saveDesign(' ',p.solutions[0]));
 const edited=s.saveDesign('Yeni ad',p.solutions[0],personal.id);assert.equal(edited.id,personal.id);assert.equal(s.data.designs.length,1);
});
test('elde taşınan geçici konum yerine son bırakılmış konum kaydedilir',()=>{
 const S=require('../storage.js'),B=require('../board.js'),p=require('../puzzles/catalog.js')[0];
 const b=B.create(p),store=S.create(()=>({getItem(){return null;},setItem(){}}));
 b.select('square');const before=b.snapshot();b.begin();
 b.preview({...b.current(),zone:'board',x:3,y:2,rotation:1});
 store.remember(p,b);
 const restored=B.create(p);assert.equal(store.restore(p,restored),true);
 assert.deepEqual(restored.snapshot(),before);
 b.commit();store.remember(p,b);store.restore(p,restored);
 assert.deepEqual(restored.snapshot(),b.snapshot());
});
