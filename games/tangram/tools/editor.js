(function(){
  'use strict';
  const T=window.Tangram,G=T.geometry,V=T.validation,A=T.authoring,$=id=>document.getElementById(id);
  const svg=$('editor-scene'),metadata=$('metadata-form');
  let board=T.board.create({target:[]}),layout,alternates=[],exportText='';
  const canvas={id:'editor',target:[],frame:[[[[-4,-4],[4,-4],[4,4],[-4,4]]]]};
  const poses=()=>board.pieces.filter(p=>p.zone==='board');
  const names=ids=>ids.map(id=>G.byId[id].name).join(', ');
  const node=(tag,attrs,parent)=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);parent.append(n);return n;};
  function clearExport(){exportText='';$('export-data').value='';$('download').disabled=true;$('export-status').textContent='';}
  function overlay(check) {
    const group=node('g',{class:'diagnostics','aria-hidden':'true'},svg);
    const project=poly=>poly.map(ring=>ring.map(([x,y])=>[x*layout.scale+layout.tx,y*layout.scale+layout.ty]));
    for(const id of new Set([...check.overlaps.flat(),...check.disconnected])) {
      const p=board.pieces.find(p=>p.pieceId===id);
      node('path',{d:V.path([project([G.transformPiece(p)])]),class:'conflict'},group);
    }
    for(const [a,b] of check.overlaps) {
      const multi=G.combine('intersection',[[G.transformPiece(board.pieces.find(p=>p.pieceId===a))]],
        [[G.transformPiece(board.pieces.find(p=>p.pieceId===b))]]);
      node('path',{d:V.path(multi.map(project)),class:'overlap'},group);
    }
    if($('contacts').checked) for(const contact of check.contacts)for(const [x,y]of contact.points)
      node('circle',{cx:x*layout.scale+layout.tx,cy:y*layout.scale+layout.ty,r:3,class:'contact'},group);
  }
  function draw(){
    const focused=document.activeElement?.getAttribute('data-piece');
    layout=T.draw.scene(svg,canvas,board,false);
    const check=V.diagnostics(poses());overlay(check);
    if(focused)svg.querySelector(`[data-piece="${focused}"]`)?.focus({preventScroll:true});
    $('geometry-status').textContent=check.valid?'7 / 7 parça · Bağlantılı · Çakışma yok.':`${poses().length} / 7 parça yerleştirildi.`;
    $('geometry-issues').replaceChildren();
    const issues=[...check.errors];
    if(check.missing.length)issues.push('Tepside: '+names(check.missing));
    if(check.disconnected.length)issues.push('Ana şekilden kopuk: '+names(check.disconnected));
    if(check.overlaps.length)issues.push('Çakışan: '+check.overlaps.map(names).join(' / '));
    for(const text of issues){const li=document.createElement('li');li.textContent=text;$('geometry-issues').append(li);}
    $('editor-preview').hidden=!check.valid;
    if(check.valid)T.draw.thumbnail($('editor-preview'),{id:'draft-preview',target:check.target});
  }
  function changed(){
    clearExport();$('touch-lens').hidden=true;draw();
    const p=board.current();
    $('editor-selection').textContent=p?T.draw.pieceLabel(p,true)+(input.carrying()?' · Tıkla bırak; sağ tık veya kaydırarak döndür.':''):'Bir parça seç; sürükle ya da boş alana dokun.';
    $('pose-x').disabled=$('pose-y').disabled=!p;
    $('position-form').querySelector('[type=submit]').disabled=!p;
    $('pose-x').value=p?.x??'';$('pose-y').value=p?.y??'';
    document.querySelectorAll('[data-action]').forEach(b=>{
      const a=b.dataset.action;b.disabled=a==='undo'?!board.history.length&&!board.transaction:a==='flip'?p?.pieceId!=='parallelogram':
        ['align','tray'].includes(a)?p?.zone!=='board':!p;
    });
  }
  const input=T.input.attach(svg,{context:()=>({board,layout,preview:false}),changed,
    message:text=>$('editor-selection').textContent=text,
    moving(p,snap,point,event){
      T.draw.movePiece(svg,p,layout,snap);
      if(event.pointerType==='touch'){
        const lens=$('touch-lens');lens.hidden=false;
        lens.style.left=`${Math.max(8,Math.min(innerWidth-132,event.clientX+18))}px`;
        lens.style.top=`${Math.max(8,event.clientY-154)}px`;
        T.draw.lens(lens.querySelector('svg'),board,layout,point);
      }
    }});
  function fit(){
    const points=poses().flatMap(G.transformPiece);
    const b=points.length?G.bounds(points):{minX:-3,minY:-3,maxX:3,maxY:3};
    canvas.frame=[[[[b.minX-.7,b.minY-.7],[b.maxX+.7,b.minY-.7],[b.maxX+.7,b.maxY+.7],[b.minX-.7,b.maxY+.7]]]];
  }
  function fill(p){
    input.cancel();board=T.board.create({target:[]});alternates=p?.solutions.slice(1)||[];
    if(p)for(const pose of p.solutions[0]){board.select(pose.pieceId);board.place({...pose,zone:'board'});}
    board.selected=null;board.history=[];
    for(const[id,value]of Object.entries({'name':p?.name||'','puzzle-id':p?.id||'','category':p?.category||'kara-hayvanlari',
      difficulty:p?.difficulty||'kolay',tags:p?.tags.join(', ')||'','source-kind':p?.source.kind||'original',
      'source-note':p?.source.note||'','source-url':p?.source.url||'','source-author':p?.source.author||'','source-license':p?.source.license||''}))$(id).value=value;
    $('external-source').hidden=$('source-kind').value!=='external';
    $('alternates-row').hidden=!alternates.length;$('keep-alternates').checked=true;
    fit();changed();
  }
  function record(){
    const source={kind:$('source-kind').value,note:$('source-note').value.trim()};
    if(source.kind==='external')Object.assign(source,{url:$('source-url').value.trim(),author:$('source-author').value.trim(),license:$('source-license').value.trim()});
    const p=A.draft({id:$('puzzle-id').value.trim(),name:$('name').value.trim(),category:$('category').value,
      difficulty:$('difficulty').value,tags:$('tags').value.split(',').map(s=>s.trim()).filter(Boolean),source},board.pieces);
    if($('keep-alternates').checked)p.solutions.push(...alternates);
    return p;
  }
  for(const[id,name]of Object.entries(V.categories))$('category').add(new Option(name,id));
  for(const p of T.puzzles)$('load-puzzle').add(new Option(p.name,p.id));
  $('load').addEventListener('click',()=>fill(T.puzzles.find(p=>p.id===$('load-puzzle').value)));
  $('new').addEventListener('click',()=>fill(null));
  $('fit').addEventListener('click',()=>{input.cancel();fit();draw();});
  $('contacts').addEventListener('change',draw);
  document.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',()=>input.action(b.dataset.action)));
  $('position-form').addEventListener('submit',event=>{
    event.preventDefault();input.cancel();const p=board.current(),x=Number($('pose-x').value),y=Number($('pose-y').value);
    if(!p||!Number.isFinite(x)||!Number.isFinite(y))return;
    board.place({...p,zone:'board',x,y});changed();
  });
  metadata.addEventListener('input',clearExport);
  $('source-kind').addEventListener('change',()=>{$('external-source').hidden=$('source-kind').value!=='external';});
  metadata.addEventListener('submit',event=>{
    event.preventDefault();clearExport();
    try{
      exportText=A.exportRecord(record(),T.puzzles);$('export-data').value=exportText;$('download').disabled=false;
      $('export-status').textContent='Geometri ve kopya kontrolü geçti. İsimsiz içerik incelemesi bekliyor.';
    }catch(error){$('export-status').textContent=error.message;}
  });
  $('download').addEventListener('click',()=>{
    if(!exportText)return;const url=URL.createObjectURL(new Blob([exportText],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download=record().id+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  $('import').addEventListener('click',()=>{
    try{
      const records=V.parse($('import-data').value);if(records.length!==1)throw Error('Atölyeye bir seferde tek şekil alınır.');
      fill(records[0]);$('import-status').textContent='Geçerli kayıt yüklendi. Katalog kopyaları dışa aktarırken denetlenir.';
    }catch(error){$('import-status').textContent=error.message;}
  });
  let width=0;
  new ResizeObserver(entries=>{const next=entries[0].contentRect.width;if(Math.abs(next-width)<.5)return;width=next;input.cancel();draw();T.draw.lettering();}).observe(svg.parentElement);
  fill(null);document.fonts.ready.then(T.draw.lettering);
})();
