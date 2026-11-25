// The only input is an allowlisted player view. Synthetic hidden hands are sampled here.
(function (root, factory) {
  const node=typeof module==='object'&&module.exports;
  const api=factory(node?require('./board.js'):root.Domino.board,
    node?require('./match.js'):root.Domino.match,node?require('./view.js'):root.Domino.view);
  if(node) module.exports=api; else (root.Domino ||= {}).ai=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(B,M,V){
  'use strict';
  function medium(view,rng) {
    if(!view.options.length) return null;
    const scored=view.options.map(move=>{
      const tile=view.hand.find(t=>t.id===move.tileId),remaining=view.hand.filter(t=>t.id!==tile.id);
      const ends=view.ends.slice();
      if(move.end==='start') ends.push(tile.a,tile.b);
      else {
        const i=move.end==='left'?0:1;
        ends[i]=tile.a===ends[i]?tile.b:tile.a;
      }
      const supported=remaining.filter(t=>ends.some(n=>B.matches(t,n)));
      const unsupported=remaining.filter(t=>!ends.some(n=>B.matches(t,n)));
      return {move,score:[remaining.length===0?1:0,supported.length,-B.points(unsupported),
        tile.a+tile.b,tile.a===tile.b?1:0]};
    });
    const compare=(a,b)=>{for(let i=0;i<a.score.length;i++) if(a.score[i]!==b.score[i]) return b.score[i]-a.score[i];return 0;};
    scored.sort(compare);
    const best=scored.filter(x=>compare(x,scored[0])===0);
    return {...best[Math.floor(rng()*best.length)].move};
  }
  function constraints(view) {
    const opponent=1-view.player, list=[];
    view.history.forEach((e,index)=>{
      if(e.player!==opponent||!['drawStart','pass'].includes(e.type)||!e.ends.length) return;
      let allowance=0;
      for(const later of view.history.slice(index+1)) {
        if(later.player!==opponent) continue;
        if(later.type==='draw') allowance+=later.count;
        if(later.type==='play' && e.ends.some(n=>B.matches(B.byId[later.tileId],n))) allowance--;
      }
      list.push({values:e.ends.slice(),max:Math.max(0,allowance)});
    });
    return list;
  }
  function sample(view,rng) {
    const seen=new Set([...view.hand.map(t=>t.id),...view.chain.map(p=>p.tileId)]);
    const unknown=B.tiles.filter(t=>!seen.has(t.id)), limits=constraints(view);
    if(unknown.length!==view.opponentCount+view.stockCount) throw new Error('Tutarsız oyuncu görünümü.');
    // Randomized constrained construction; never relax a public no-move observation.
    for(let attempt=0;attempt<48;attempt++) {
      const pack=M.shuffle(unknown,rng), opponent=[],counts=limits.map(()=>0);
      for(const tile of pack) {
        const hits=limits.map(c=>c.values.some(n=>B.matches(tile,n)));
        if(hits.some((hit,i)=>hit&&counts[i]>=limits[i].max)) continue;
        opponent.push(tile);hits.forEach((hit,i)=>{if(hit) counts[i]++;});
        if(opponent.length===view.opponentCount) break;
      }
      if(opponent.length!==view.opponentCount) continue;
      const chosen=new Set(opponent.map(t=>t.id)),hands=[[],[]];
      hands[view.player]=view.hand.map(t=>B.byId[t.id]);hands[1-view.player]=opponent;
      return {hands,stock:M.shuffle(unknown.filter(t=>!chosen.has(t.id)),rng),
        chain:view.chain.map(p=>({...p})),active:view.active,
        opening:view.opening?{player:view.player,tileId:view.opening.tileId}:null,
        anchorId:view.chain[0]?.tileId||null,passes:view.passes,drawing:false,result:null,
        history:view.history.map(e=>V.publicEvent(e)),revision:0};
    }
    return null;
  }
  async function choose(view,level='medium',options={}) {
    const seed=options.seed??1,rng=M.random(seed),fallback=medium(view,M.random(seed));
    const now=options.now||(()=>performance.now()),start=now();
    const stats={rounds:0,samples:0,slices:0,maxSliceMs:0,elapsedMs:0,level};
    const finish=(move,cancelled=false)=>({move,cancelled,stats:{...stats,elapsedMs:now()-start}});
    if(options.signal?.aborted) return finish(null,true);
    if(!view.options.length) return finish(null);
    if(level==='easy') return finish({...view.options[Math.floor(rng()*view.options.length)]});
    if(level!=='hard'||view.options.length===1) return finish(fallback);
    const budget=options.budgetMs??600,deadline=start+budget,maxRounds=options.maxRounds??Infinity;
    if(budget<=0||maxRounds===0) return finish(fallback);
    const yieldTask=options.yieldControl||(()=>new Promise(resolve=>setTimeout(resolve,0)));
    let sliceStart=now(),expired=false,cancelled=false;
    async function checkpoint() {
      const time=now(),duration=time-sliceStart;
      stats.maxSliceMs=Math.max(stats.maxSliceMs,duration);
      if(options.signal?.aborted) {cancelled=true;return false;}
      if(time>=deadline) {expired=true;return false;}
      if(duration>=7) {
        stats.slices++;await yieldTask();sliceStart=now();
        if(options.signal?.aborted) {cancelled=true;return false;}
        if(sliceStart>=deadline) {expired=true;return false;}
      }
      return true;
    }
    const sums=view.options.map(()=>0);
    while(stats.rounds<maxRounds && await checkpoint()) {
      const board=sample(view,rng);stats.samples++;
      if(!board) break;
      const pairedSeed=Math.floor(rng()*4294967296),values=[];
      for(const candidate of view.options) {
        const stream=M.random(pairedSeed);
        let synthetic={settings:{target:view.target},scores:view.scores.slice(),board,result:null};
        synthetic=M.apply(synthetic,{type:'play',player:view.player,...candidate}).state;
        for(let step=0;!synthetic.board.result && step<160;step++) {
          if(!await checkpoint()) break;
          const seat=synthetic.board.active,local=V.player(synthetic,seat);
          const move=medium(local,stream);
          synthetic=M.apply(synthetic,move?{type:'play',player:seat,...move}
            :{type:local.stockCount?'draw':'pass',player:seat}).state;
        }
        if(cancelled||expired) break;
        const result=synthetic.board.result;
        if(!result) {expired=true;break;}
        const sign=result.winner===null?0:result.winner===view.player?1:-1;
        values.push(sign*(view.target===0?100+result.points/100:
          (synthetic.result?1000:0)+result.points+2));
      }
      // A partly evaluated round must never give early candidates extra weight.
      if(values.length!==view.options.length) break;
      values.forEach((value,i)=>{sums[i]+=value;});stats.rounds++;
    }
    if(cancelled) return finish(null,true);
    if(!stats.rounds) return finish(fallback);
    const best=Math.max(...sums),ties=view.options.filter((_,i)=>sums[i]===best);
    return finish({...ties[Math.floor(rng()*ties.length)]});
  }
  return {choose,medium,constraints,sample};
});
