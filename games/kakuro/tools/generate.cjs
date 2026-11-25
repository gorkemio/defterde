'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const B=require('../board.js'),S=require('../solver.js'),L=require('../logic.js');
const {verifyTrace}=require('./verify-trace.cjs');
const ROOT=path.join(__dirname,'..');
function random(seed) {
  let a=seed>>>0;
  return ()=>{ a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296; };
}
function geometry(n,rng,mode='clusters') {
  const mask=Array(n*n).fill(false);
  const add=(r,c,h,w)=>{for(let y=r;y<r+h;y++)for(let x=c;x<c+w;x++)mask[y*n+x]=true;};
  if(mode==='ribbon') {
    let r=1,c=1;add(r,c,2,2);
    while(r<n-2||c<n-2) {
      const roll=rng();
      if(r<n-2&&(c===n-2||roll<.78))r++;
      if(c<n-2&&(r===n-2||roll>=.22))c++;
      add(r,c,2,2);
    }
    for(let k=0;k<n;k++)if(rng()<.25) {
      const rr=1+Math.floor(rng()*(n-2)),cc=1+Math.floor(rng()*(n-2));
      if(mask[rr*n+cc]||mask[(rr+1)*n+cc+1])add(rr,cc,2,2);
    }
    return mask;
  }
  add(1+Math.floor(rng()*(n-2)),1+Math.floor(rng()*(n-2)),2,2);
  const desired=Math.floor((n-1)**2*(.43+rng()*.28));
  for(let attempt=0;attempt<150&&mask.filter(Boolean).length<desired;attempt++) {
    const h=rng()<.22?3:2,w=rng()<.22?3:2;
    const r=1+Math.floor(rng()*(n-h)),c=1+Math.floor(rng()*(n-w));
    let overlaps=0;for(let y=r;y<r+h;y++)for(let x=c;x<c+w;x++)if(mask[y*n+x])overlaps++;
    if(overlaps && overlaps<h*w) add(r,c,h,w);
  }
  const white=mask.flatMap((x,i)=>x?[i]:[]);
  if(white.length<Math.max(10,n*2) || !white.some(i=>Math.floor(i/n)===n-1) || !white.some(i=>i%n===n-1))return null;
  return mask;
}
function structure(mask,n) {
  const cells=mask.map(white=>({type:white?'white':'dark'}));
  for(let i=0;i<cells.length;i++)if(!mask[i])for(const [axis,step] of [['across',1],['down',n]]) {
    let cursor=i+step,length=0;
    while(cursor<cells.length&&(axis!=='across'||Math.floor(cursor/n)===Math.floor(i/n))&&mask[cursor]){length++;cursor+=step;}
    if(length)cells[i][axis]=length*(length+1)/2;
  }
  const b=B.compileBoard({id:'candidate',version:1,rows:n,cols:n,cells});
  return b.ok?b:null;
}
function fill(board,rng) {
  const values=Array(board.cells.length).fill(0),used=board.groups.map(()=>0);
  let nodes=0;
  // Randomized proper edge colouring: a white cell belongs to two groups.
  const preference=Array.from({length:9},(_,i)=>i+1);
  if(rng()<.5)preference.reverse();
  const bias=.05+rng()*.4;
  function createsSwappableCycle(across,down,digit) {
    for(let other=1;other<=9;other++)if(other!==digit) {
      const seen=new Set([across]),queue=[across];
      while(queue.length) {
        const id=queue.pop();
        for(const cell of board.groups[id].cells)if(values[cell]===digit||values[cell]===other) {
          const pair=board.membership[cell],next=pair.across===id?pair.down:pair.across;
          if(next===down)return true;
          if(!seen.has(next)){seen.add(next);queue.push(next);}
        }
      }
    }
    return false;
  }
  function visit(left) {
    if(!left)return true;
    if(++nodes>30000)return false;
    let chosen=-1,options=0,count=10;
    for(const i of board.white)if(!values[i]){
      const {across,down}=board.membership[i],mask=B.ALL&~(used[across]|used[down]),size=B.popcount(mask);
      if(!size)return false;
      if(size<count){chosen=i;options=mask;count=size;}
    }
    const {across,down}=board.membership[chosen];
    const order=B.digits(options).map(n=>({n,weight:rng()+bias*preference.indexOf(n)})).sort((a,b)=>a.weight-b.weight);
    for(const {n} of order){
      if(createsSwappableCycle(across,down,n))continue;
      const bit=B.bit(n); values[chosen]=n;used[across]|=bit;used[down]|=bit;
      if(visit(left-1))return true;
      used[across]&=~bit;used[down]&=~bit;values[chosen]=0;
    }
    return false;
  }
  return visit(board.white.length)?values:null;
}
function canonical(board,withTotals=true) {
  const variants=[];
  for(let rotate=0;rotate<4;rotate++)for(let mirror=0;mirror<2;mirror++){
    const points=new Map();
    for(const cell of board.white){
      let r=Math.floor(cell/board.cols),c=cell%board.cols;
      if(mirror)c=-c;
      for(let k=0;k<rotate;k++)[r,c]=[c,-r];
      points.set(cell,[r,c]);
    }
    const minR=Math.min(...[...points.values()].map(p=>p[0])),minC=Math.min(...[...points.values()].map(p=>p[1]));
    const key=i=>{const p=points.get(i);return `${p[0]-minR},${p[1]-minC}`;};
    const whites=board.white.map(key).sort().join(';');
    const groups=board.groups.map(g=>`${g.cells.map(key).sort().join(';')}${withTotals?'='+g.total:''}`).sort().join('|');
    variants.push(whites+'#'+groups);
  }
  return crypto.createHash('sha256').update(variants.sort()[0]).digest('hex');
}
function classify(board) {
  for(let level=1;level<=3;level++){
    const result=L.solveLogically(board,level);
    if(result.status==='complete')return {level,...result};
    if(result.status==='contradiction')throw new Error('Unique puzzle has logical contradiction');
  }
  return null;
}
async function generate({seed=20261020,maxAttempts=200000,quota=20}={}) {
  const output=path.join(ROOT,'generated');fs.mkdirSync(output,{recursive:true});
  const progressFile=path.join(output,'generation-progress.json');
  let progress=fs.existsSync(progressFile)?JSON.parse(fs.readFileSync(progressFile,'utf8')):{seed,attempt:0,accepted:[],stats:{}};
  if(progress.seed!==seed)throw new Error('Seed differs from progress; select a fresh output intentionally.');
  const accepted=progress.accepted,seen=new Set(accepted.map(p=>p.signature)),layouts=new Map();
  accepted.forEach(p=>layouts.set(p.layout,(layouts.get(p.layout)||0)+1));
  const counts=()=>[1,2,3].map(level=>accepted.filter(p=>p.level===level).length);
  const save=()=>fs.writeFileSync(progressFile,JSON.stringify(progress));
  const stop=()=>{save();process.exit(130);};
  process.once('SIGINT',stop);process.once('SIGTERM',stop);
  const tick=name=>progress.stats[name]=(progress.stats[name]||0)+1;
  for(;progress.attempt<maxAttempts&&counts().some(n=>n<quota);progress.attempt++){
    if(progress.attempt%1000===0){save();await new Promise(resolve=>setImmediate(resolve));}
    const current=progress.attempt, rng=random(seed+Math.imul(current+1,2654435761));
    const target=counts().findIndex(n=>n<quota)+1;
    const sizes=target===1?[5,6,7]:target===2?[7,8,9]:[9,10,11];
    const layoutGenerator=target===3?'ribbon':'clusters';
    const n=sizes[Math.floor(rng()*sizes.length)],mask=geometry(n,rng,layoutGenerator);
    if(!mask){tick('layoutRejected');continue;}
    const skeleton=structure(mask,n);if(!skeleton){tick('structureRejected');continue;}
    const layout=canonical(skeleton,false);if((layouts.get(layout)||0)>=4){tick('layoutQuota');continue;}
    const solution=fill(skeleton,rng);if(!solution){tick('fillRejected');continue;}
    for(const g of skeleton.groups)skeleton.definition.cells[g.clue][g.axis]=g.cells.reduce((sum,i)=>sum+solution[i],0);
    const board=B.compileBoard(skeleton.definition),signature=canonical(board);
    if(seen.has(signature)){tick('duplicate');continue;}
    // All supported logical rules are contained in group support propagation.
    // Screening may return unknown; only a proved unique result is accepted.
    const exact=S.countSolutions(board,undefined,{maxMs:30000,maxNodes:2});
    if(exact.status!=='unique'){tick(exact.status);continue;}
    tick('unique');
    const result=classify(board);
    if(!result){tick('logicStuck');continue;}
    tick('level'+result.level);
    if(result.level!==target){tick('otherLevel');continue;}
    const replay=verifyTrace(board,result.trace);
    if(replay.join()!==exact.solution.join())throw new Error('Replay mismatch');
    const verified=S.countSolutions(board,undefined,{maxMs:30000,maxNodes:1000000});
    if(verified.status!=='unique')throw new Error('Final exact verification failed');
    const item={seed:seed+Math.imul(current+1,2654435761)>>>0,attempt:current,level:result.level,layoutGenerator,layout,signature,
      definition:board.definition,trace:result.trace,usage:result.usage,score:result.score,solution:replay,stats:verified.stats};
    accepted.push(item);layouts.set(layout,(layouts.get(layout)||0)+1);seen.add(signature);
    console.log(`Accepted ${counts().join('/')} attempt=${current} ${n}×${n} cells=${board.white.length} score=${result.score.toFixed(2)}`);
    save();
    if(current%100===0)save();
  }
  save();
  if(counts().some(n=>n!==quota))throw new Error(`Incomplete content ${counts().join('/')}; progress saved, requirements unchanged.`);
  const definitions=[],proofs=[],labels=['kolay','orta','zor'];
  for(let level=1;level<=3;level++){
    const items=accepted.filter(p=>p.level===level).sort((a,b)=>a.score-b.score);
    if(new Set(items.map(p=>p.layout)).size<5)throw new Error('Not enough distinct layouts');
    items.forEach((p,i)=>{
      const id=`${labels[level-1]}-${String(i+1).padStart(2,'0')}`;
      const definition={...p.definition,id,version:1,difficulty:labels[level-1],seed:p.seed,
        verification:{unique:true,logicalLevel:level,score:p.score,techniques:p.usage,signature:p.signature,layout:p.layout}};
      definitions.push(definition);proofs.push({...p,id,definition});
    });
  }
  fs.writeFileSync(path.join(ROOT,'puzzles.js'),`// Generated by tools/generate.cjs. No answers or traces are shipped here.\n(function(root){'use strict';const puzzles=${JSON.stringify(definitions)};\nif(typeof module==='object'&&module.exports)module.exports=puzzles;else (root.Kakuro=root.Kakuro||{}).puzzles=puzzles;\n})(typeof globalThis!=='undefined'?globalThis:this);\n`);
  fs.writeFileSync(path.join(output,'proofs.json'),JSON.stringify(proofs));
  console.log('Certified package written:',definitions.length);
}
if(require.main===module)generate({maxAttempts:Number(process.env.MAX_ATTEMPTS)||200000}).catch(error=>{console.error(error);process.exitCode=1;});
module.exports={random,geometry,structure,fill,canonical,classify,generate};
