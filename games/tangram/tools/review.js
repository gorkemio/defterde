(function(){
  'use strict';
  const T=window.Tangram,G=T.geometry,V=T.validation,A=T.authoring,$=id=>document.getElementById(id);
  const puzzles=T.puzzles.map(p=>({...p,target:G.deriveTarget(p.solutions[0])}));
  const session=A.reviewSession(()=>localStorage),store=session.store;
  let page=0,report='';
  function shuffle(array){
    const result=[...array];for(let i=result.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;
  }
  const ids=puzzles.map(p=>p.id),savedOrder=Array.isArray(store.order)?store.order:[];
  let order=[...new Set(savedOrder.filter(id=>ids.includes(id)))];
  order.push(...shuffle(ids.filter(id=>!order.includes(id))));store.order=order;
  for(const p of puzzles)store.notes[p.id]=A.reviewNote(store,p);
  function save(){
    session.save();
    if(session.warning)$('review-storage').textContent=session.warning+' Notların bu oturumda korunur; raporu indirerek saklayabilirsin.';
  }
  function summary(){
    const notes=puzzles.map(p=>store.notes[p.id]);
    $('review-summary').textContent=`${puzzles.length} şekil · ${notes.filter(n=>n.decision==='accepted').length} tanınabilir · ${notes.filter(n=>n.decision==='revision').length} yeniden çalışılacak`;
  }
  function invalidateReport(){report='';$('review-data').value='';$('download-review').disabled=true;$('report-status').textContent='';}
  function field(labelText,element,parent){
    const label=document.createElement('label');label.textContent=labelText;label.append(element);parent.append(label);return element;
  }
  function drawSeams(svg,p){
    const b=G.bounds(p.target.flat(2)),scale=Math.min(178/b.width,124/b.height);
    const tx=(240-b.width*scale)/2-b.minX*scale,ty=(158-b.height*scale)/2-b.minY*scale;
    for(const pose of p.solutions[0]){
      const path=document.createElementNS('http://www.w3.org/2000/svg','path');
      path.setAttribute('d',V.path([[G.transformPiece(pose).map(([x,y])=>[x*scale+tx,y*scale+ty])]]));
      path.setAttribute('fill','none');path.setAttribute('stroke','#fbf9f2');path.setAttribute('stroke-width','.8');svg.append(path);
    }
  }
  function render(){
    const reveal=$('show-names').checked,showCategory=$('show-categories').checked,seams=$('show-seams').checked;
    const size=innerWidth<=580?6:10,total=Math.ceil(order.length/size);page=Math.min(page,total-1);
    $('review-grid').replaceChildren();
    for(let i=page*size;i<Math.min((page+1)*size,order.length);i++){
      const p=puzzles.find(p=>p.id===order[i]),note=store.notes[p.id],number=String(i+1).padStart(2,'0');
      const li=document.createElement('li');li.className='review-item';
      const h=document.createElement('h2');h.textContent=reveal?p.name:`Şekil ${number}`;
      const category=document.createElement('p');category.className='category-note';
      category.textContent=showCategory?p.categoryName:'';category.hidden=!showCategory;
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
      svg.setAttribute('role','img');svg.setAttribute('aria-label',reveal?p.name:`İncelenecek siluet ${number}`);
      li.append(svg,h,category);$('review-grid').append(li);T.draw.thumbnail(svg,p);if(seams)drawSeams(svg,p);
      const guess=document.createElement('input');guess.type='text';guess.maxLength=100;guess.value=note.guess;
      field(`Şekil ${number} için tahminin`,guess,li);
      guess.addEventListener('input',()=>{note.guess=guess.value;save();invalidateReport();});
      if(reveal){
        const decision=document.createElement('select');
        for(const [value,text]of [['pending','Henüz karar vermedim'],['accepted','Tanınabilir'],['revision','Yeniden çalışılmalı']])decision.add(new Option(text,value));
        decision.value=note.decision;field(`${number} · Kararın`,decision,li);
        decision.addEventListener('change',()=>{note.decision=decision.value;save();summary();invalidateReport();});
        const notes=document.createElement('textarea');notes.rows=2;notes.maxLength=1000;notes.value=note.note;
        field(`${number} · Düzeltme notun`,notes,li);
        notes.addEventListener('input',()=>{note.note=notes.value;save();invalidateReport();});
      }
    }
    $('page-label').textContent=`${page+1} / ${total}`;$('previous-page').disabled=page===0;$('next-page').disabled=page===total-1;summary();
  }
  for(const id of ['show-names','show-categories','show-seams'])$(id).addEventListener('change',render);
  $('shuffle').addEventListener('click',()=>{order=shuffle(order);store.order=order;page=0;save();invalidateReport();render();});
  $('previous-page').addEventListener('click',()=>{page--;render();$('review-grid').scrollIntoView({block:'start'});});
  $('next-page').addEventListener('click',()=>{page++;render();$('review-grid').scrollIntoView({block:'start'});});
  $('export-review').addEventListener('click',()=>{
    report=JSON.stringify({version:1,type:'tangram-content-review',createdAt:new Date().toISOString(),
      note:'Kullanıcı inceleme raporu. Katalog kabul durumunu otomatik değiştirmez.',
      entries:order.map((id,i)=>{const p=puzzles.find(p=>p.id===id);return{number:i+1,id,name:p.name,...store.notes[id]};})},null,2);
    $('review-data').value=report;$('download-review').disabled=false;$('report-status').textContent=`${puzzles.length} şeklin güncel notları rapora alındı.`;
  });
  $('download-review').addEventListener('click',()=>{
    if(!report)return;const url=URL.createObjectURL(new Blob([report],{type:'application/json'})),a=document.createElement('a');
    a.href=url;a.download='tangram-icerik-incelemesi.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  let narrow=innerWidth<=580;
  window.addEventListener('resize',()=>{const next=innerWidth<=580;if(next!==narrow){narrow=next;page=0;render();}T.draw.lettering();});
  save();render();document.fonts.ready.then(T.draw.lettering);
})();
