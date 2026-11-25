// Her komşu seviye çifti için aynı 12 açılış, iki renk: toplam 48 oyun.
// Dört bağımsız Node işçisi; gerçek 100/300/800 ms duvar saati bütçeleri.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {Worker,isMainThread,parentPort,workerData}=require('node:worker_threads');
const root=path.resolve(__dirname,'..'),output=path.join(root,'docs/evidence/calibration');
function engine(){
  const context=vm.createContext({performance,setTimeout,AbortController});
  for(const f of ['config.js','board.js','ai.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),context);
  return context.TD;
}
if(!isMainThread){
  const {board:B,ai:A}=engine();
  (async()=>{
    const {opening,levels,index}=workerData;
    let g=B.createGame();
    for(const route of opening){
      const legal=B.legalMoves(g.position);
      const m=legal.find(m=>JSON.stringify([m.from,...m.landings])===JSON.stringify(route));
      g=B.play(g,m,{legal});
    }
    const metrics=[],tables={1:A.createTable(),'-1':A.createTable()};
    // Güvenlik sınırı sonuç kuralı değildir. Ulaşılan oyunlar unresolved raporlanır.
    while(!g.result&&g.history.length<320){
      const legal=B.legalMoves(g.position),level=levels[g.position.turn===1?0:1];
      const r=await A.analyze(g,{level,legal,table:tables[g.position.turn]});
      if(!legal.includes(r.move))throw Error('Yasadışı AI hamlesi');
      metrics.push({level,depth:r.depth,ms:r.elapsedMs,nodes:r.nodes,slice:r.maxSliceMs});
      g=B.play(g,r.move,{legal});
    }
    parentPort.postMessage({index,levels,opening,result:g.result,plies:g.history.length,metrics});
  })().catch(e=>{throw e;});
}else{
  fs.mkdirSync(output,{recursive:true});
  const {board:B}=engine(),openings=[];
  for(let seed=1;seed<=12;seed++){
    let g=B.createGame(),n=seed*7919;const routes=[];
    for(let ply=0;ply<8;ply++){
      const legal=B.legalMoves(g.position);n=(Math.imul(n,1664525)+1013904223)>>>0;
      const m=legal[n%legal.length];routes.push([m.from,...m.landings]);g=B.play(g,m,{legal});
    }
    openings.push(routes);
  }
  fs.writeFileSync(path.join(output,'openings.json'),JSON.stringify(openings,null,2));
  const jobs=[];
  for(const pair of [['easy','medium'],['medium','hard']])for(const opening of openings)for(const levels of [pair,[...pair].reverse()])jobs.push({opening,levels,index:jobs.length});
  let cursor=0,done=0;const results=[];
  function next(){
    if(cursor===jobs.length)return;
    const job=jobs[cursor++],file=path.join(output,`game-${job.index}.json`);
    const worker=new Worker(__filename,{workerData:job});
    worker.on('message',r=>{
      fs.writeFileSync(file,JSON.stringify(r));results.push(r);done++;
      console.log(`${done}/48 ${r.levels.join('/')} ${r.plies} tur ${JSON.stringify(r.result)}`);
      if(done===jobs.length){
        results.sort((a,b)=>a.index-b.index);
        fs.writeFileSync(path.join(output,'all.json'),JSON.stringify(results,null,2));
        for(const pair of [['easy','medium'],['medium','hard']]){
          const games=results.filter(r=>r.levels.every(l=>pair.includes(l)));
          const score=Object.fromEntries(pair.map(l=>[l,0]));
          for(const g of games)if(g.result){
            if(!g.result.winner)for(const l of pair)score[l]+=.5;
            else score[g.levels[g.result.winner===1?0:1]]++;
          }
          console.log(JSON.stringify({pair,score,unresolved:games.filter(g=>!g.result).length}));
        }
      }else next();
    });
    worker.on('error',e=>{console.error(e);process.exitCode=1;});
  }
  for(let i=0;i<4;i++)next();
}
