// Reproducible strength comparison, not a claim that the levels are ordered by strength.
const fs=require('node:fs'),os=require('node:os');
const B=require('../board'),M=require('../match'),V=require('../view'),A=require('../ai');
async function play(seed,levels,swap) {
  let m=M.create({target:0},seed),steps=0;
  // Swapping hands while keeping the same stock pairs the exact same deal by seat.
  if(swap) {
    m.board.hands.reverse();m.board.opening=B.opening(m.board.hands);m.board.active=m.board.opening.player;
  }
  while(!m.result&&steps++<150) {
    const seat=m.board.active,view=V.player(m,seat);
    const answer=view.options.length?await A.choose(view,levels[seat],{
      seed:(seed*257+steps*17+seat)>>>0,budgetMs:Infinity,maxRounds:4,now:()=>0}):null;
    m=M.apply(m,answer?.move?{type:'play',player:seat,...answer.move}:
      {type:view.stockCount?'draw':'pass',player:seat}).state;
  }
  if(!m.result)throw Error('Unfinished benchmark hand');
  return m.result.winner===null?0:m.result.winner===0?1:-1;
}
async function main() {
  const start=performance.now(),comparisons=[];
  for(const levels of [['medium','easy'],['hard','medium'],['hard','easy']]) {
    const pairs=[],counts={firstWins:0,secondWins:0,draws:0};
    for(let seed=0;seed<200;seed++) {
      const a=await play(seed,levels,false),b=await play(seed,levels,true);
      pairs.push((a+b)/2);
      for(const value of [a,b])counts[value===0?'draws':value===1?'firstWins':'secondWins']++;
    }
    const mean=pairs.reduce((a,b)=>a+b,0)/pairs.length;
    const variance=pairs.reduce((n,x)=>n+(x-mean)**2,0)/(pairs.length-1);
    const margin=1.96*Math.sqrt(variance/pairs.length);
    comparisons.push({levels,deals:200,hands:400,...counts,pairedMeanWinDifference:mean,
      approximate95PercentInterval:[Math.max(-1,mean-margin),Math.min(1,mean+margin)]});
    console.log(levels.join(' / '),counts);
  }
  const report={date:new Date().toISOString(),environment:{node:process.version,platform:os.platform(),
    arch:os.arch(),cpu:os.cpus()[0]?.model},
    budget:'Hard uses four complete common-sample rounds per move; deterministic clock. UI uses 600ms.',
    caveat:'Seeded benchmark policy, not proof of skill ordering; paired normal approximation over 200 independent deal pairs.',
    comparisons,elapsedMs:performance.now()-start};
  fs.writeFileSync('docs/evidence/ai-benchmark.json',JSON.stringify(report,null,2)+'\n');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
