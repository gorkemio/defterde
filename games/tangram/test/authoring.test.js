const {test}=require('node:test');
const assert=require('node:assert/strict');
const A=require('../authoring.js');
const puzzles=require('../puzzles/catalog.js');

test('dışa aktarma tepsi parçalarını saymaz, oyun alanlarını çözüm kaydına taşımaz',()=>{
  const p=puzzles[0],poses=p.solutions[0].map(p=>({...p,zone:'board',homeRotation:0}));
  const draft=A.draft(p,poses);
  assert.deepEqual(draft.solutions[0],p.solutions[0]);
  assert.throws(()=>A.exportRecord(A.draft(p,poses.map((p,i)=>i?p:{...p,zone:'tray'})),[]));
  assert.equal(JSON.parse(A.exportRecord(draft,puzzles)).id,p.id);
  assert.throws(()=>A.exportRecord({...draft,id:'kopya'},puzzles),/kopya|siluet/i);
});
test('inceleme notu aynı sürümde geri gelir; geometri değişince kabul taşınmaz',()=>{
  const p=puzzles[0],hash=A.fingerprint(p);
  const store={version:1,notes:{[p.id]:{fingerprint:hash,guess:'Kedi',decision:'accepted',note:'Kulakları net'}}};
  assert.equal(A.reviewNote(store,p).decision,'accepted');
  const changed=structuredClone(p);changed.solutions[0][0].rotation=1;
  assert.equal(A.reviewNote(store,changed).decision,'pending');
  assert.equal(A.reviewNote({version:99},p).decision,'pending');
});
test('bozuk notlar veya HTML metni yürütülebilir içerik oluşturmaz',()=>{
  const p=puzzles[0];
  assert.equal(A.reviewNote({version:1,notes:null},p).decision,'pending');
  const store={version:1,notes:{[p.id]:{fingerprint:A.fingerprint(p),decision:'anything',guess:34,note:{}}}};
  assert.deepEqual(A.reviewNote(store,p),{fingerprint:A.fingerprint(p),guess:'',decision:'pending',note:''});
});
test('inceleme depolaması engel/kota hatasında bellekte kalır; bozuk veya yeni sürümü ezmez',()=>{
  const blocked=A.reviewSession(()=>{throw Error('blocked');});
  blocked.store.notes.kedi={guess:'Kedi'};assert.equal(blocked.save(),false);
  assert.equal(blocked.store.notes.kedi.guess,'Kedi');assert.ok(blocked.warning);
  for(const raw of ['{bad','{"version":99,"notes":{}}','{"version":1,"notes":[]}']){
    let writes=0;
    const s=A.reviewSession(()=>({getItem:()=>raw,setItem:()=>writes++}));
    assert.equal(s.save(),false);assert.equal(writes,0);assert.ok(s.warning);
  }
  const quota=A.reviewSession(()=>({getItem:()=>null,setItem:()=>{throw Error('quota');}}));
  quota.store.notes.test={guess:'örnek'};assert.equal(quota.save(),false);
  assert.equal(quota.store.notes.test.guess,'örnek');assert.ok(quota.warning);
  let saved;
  const ok=A.reviewSession(()=>({getItem:()=>null,setItem:(_key,value)=>{saved=value;}}));
  ok.store.notes.test={guess:'Kedi'};assert.equal(ok.save(),true);
  assert.equal(JSON.parse(saved).notes.test.guess,'Kedi');
});
