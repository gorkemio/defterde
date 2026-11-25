(async function(){
  'use strict';
  const {board:B,match:M,view:V,layout:L,draw:D,ai:A}=Domino;
  Kit.malzeme.sec('kursunkalem',{cizim:{animasyon:false}});
  function euler() {
    const remaining=M.shuffle(B.tiles,M.random(12)),stack=[{value:0}],path=[];
    while(stack.length) {
      const value=stack.at(-1).value,index=remaining.findIndex(t=>B.matches(t,value));
      if(index<0){path.push(stack.pop());continue;}
      const tile=remaining.splice(index,1)[0];
      stack.push({tileId:tile.id,from:value,value:tile.a===value?tile.b:tile.a});
    }
    return path.reverse().slice(1).map(p=>({tileId:p.tileId,inValue:p.from,outValue:p.value}));
  }
  function render() {
    const value=document.getElementById('fixture').value,count=value==='right'?28:Number(value);
    const chain=euler().slice(0,count),anchor=chain[value==='right'?0:Math.floor(count/2)].tileId;
    const result=L.layout(chain,anchor),origin=document.getElementById('lab-origin'),board=document.getElementById('lab-board');
    origin.replaceChildren();
    board.style.width=`${result.bounds.right-result.bounds.left}px`;
    board.style.height=`${result.bounds.bottom-result.bounds.top}px`;
    origin.style.left=`${-result.bounds.left}px`;origin.style.top=`${-result.bounds.top}px`;
    for(const p of result.placements) {
      const node=document.createElement('div');node.className='placed';node.dataset.tile=p.tileId;
      node.style.left=`${p.x}px`;node.style.top=`${p.y}px`;node.style.transform=`rotate(${p.angle}deg)`;
      const tile=B.byId[p.tileId];node.append(D.tile(tile.id,tile.a,tile.b));origin.append(node);
    }
    for(const side of ['left','right']) {
      const tip=result.ends[side],label=document.createElement('p');label.className='lab-tip';
      label.textContent=`${side==='left'?'Sol':'Sağ'} uç · ${tip.value}`;
      label.style.left=`${tip.x+tip.direction.x*43}px`;label.style.top=`${tip.y+tip.direction.y*43}px`;origin.append(label);
    }
    const errors=L.validate(result);
    document.getElementById('geometry-report').textContent=`${count} taş · ${errors.length} çakışma / temas hatası · dar kenar ${L.W} px`;
  }
  document.getElementById('fixture').addEventListener('change',render);render();
  let m=M.create({target:50},20);
  do {
    const moves=B.legal(m.board);
    m=M.apply(m,moves.length?{type:'play',player:m.board.active,...moves[0]}:
      {type:m.board.stock.length?'draw':'pass',player:m.board.active}).state;
  } while(!m.board.result&&B.legal(m.board).length<2);
  const view=V.player(m,m.board.active),beats=[],started=performance.now();
  const pulse=setInterval(()=>beats.push(performance.now()-started),16);
  const answer=await A.choose(view,'hard',{seed:101,budgetMs:600});clearInterval(pulse);
  const abort=new AbortController();setTimeout(()=>abort.abort(),0);
  const cancelled=await A.choose(view,'hard',{seed:101,budgetMs:600,signal:abort.signal});
  const gaps=beats.map((time,i)=>time-(i?beats[i-1]:0));
  const report={userAgent:navigator.userAgent,platform:navigator.platform,hardwareConcurrency:navigator.hardwareConcurrency,
    viewport:[innerWidth,innerHeight],durationBudgetMs:600,answer:answer.move,stats:answer.stats,
    heartbeatCount:beats.length,maxHeartbeatGapMs:Math.max(0,...gaps),cancelled:cancelled.cancelled,
    cancelledMove:cancelled.move,legal:view.options.some(m=>m.tileId===answer.move.tileId&&m.end===answer.move.end)};
  document.getElementById('browser-report').textContent=JSON.stringify(report,null,2);
  document.getElementById('browser-report').dataset.ready='true';
  const summary=document.createElement('p');
  summary.id='browser-summary';
  summary.textContent=`Yasal hamle: ${report.legal}. İptal: ${report.cancelled}. İptal sonucu: ${report.cancelledMove}. `+
    `Süre: ${report.stats.elapsedMs} ms. En uzun dilim: ${report.stats.maxSliceMs} ms. `+
    `Arayüz atışı: ${report.heartbeatCount}. En uzun aralık: ${report.maxHeartbeatGapMs} ms.`;
  document.getElementById('browser-report').before(summary);
})();
