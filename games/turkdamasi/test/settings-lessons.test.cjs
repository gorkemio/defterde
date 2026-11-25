const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const context=vm.createContext({});
for(const f of ['config.js','board.js','settings.js','lessons.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),context);
const TD=context.TD;
test('settings validate each field and ignore unknown/game data',()=>{
  let stored='{"version":1,"mode":"bad","human":0,"level":"hard","help":"true","sound":true,"motion":"reduce","game":{"cells":[]}}';
  const storage={getItem:()=>stored,setItem:(_,v)=>stored=v};
  const store=TD.settings.create(()=>storage);
  assert.equal(store.read().mode,'ai');assert.equal(store.read().human,1);
  assert.equal(store.read().level,'hard');assert.equal(store.read().help,true);assert.equal(store.read().sound,true);
  store.save({mode:'local',human:-1});assert(!stored.includes('"game"'));
  assert.equal(TD.settings.create(()=>storage).read().human,-1);
  stored='{bad JSON';assert.equal(TD.settings.create(()=>storage).read().level,'medium');
  stored='{"version":999,"mode":"local"}';assert.equal(TD.settings.create(()=>storage).read().mode,'ai');
});
test('blocked storage retains validated settings in memory',()=>{
  const store=TD.settings.create(()=>{throw new Error('blocked');});
  store.save({mode:'local',motion:'reduce',sound:true});
  assert.equal(store.read().mode,'local');assert.equal(store.read().sound,true);
  assert(Object.isFrozen(store.read()));
});
test('all four lessons are legal complete sequences with the stated outcome',()=>{
  assert.equal(TD.lessons.length,4);
  for(const lesson of TD.lessons){
    const moves=TD.board.legalMoves(lesson.position);
    const move=moves.find(m=>JSON.stringify([m.from,...m.landings])===JSON.stringify(lesson.route));
    assert(move,lesson.id);
    assert.equal(move.captures.length,lesson.captures);
    assert.equal(move.promotion,lesson.promotion);
    assert.equal(lesson.notes.length,lesson.route.length);
  }
});
