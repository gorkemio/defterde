(function () {
 'use strict';
 const T=window.Tangram,G=T.geometry,C=T.catalog,$=id=>document.getElementById(id);
 const scene=$('scene'),lens=$('touch-lens'),store=T.storage.create(()=>localStorage),sessions=new Map();
 const difficulties={kolay:'Kolay',orta:'Orta',zor:'Zor'},tutorials=new Set(['kare','yelkenli','kedi']);
 const puzzles=[...T.puzzles,...store.data.designs].map(p=>({...p,target:G.deriveTarget(p.solutions[0])}));
 let activePuzzle=null,board=null,layout=null,colored=false,catalogFocusId=null,announcement='',pageNumber=0;
 let activeCategory='all',hintChoice=null,hintTimer=null,boundaries=false,lastSignature='',pageSize=0;
 function syncViews(){
  const playing=!!activePuzzle;
  $('catalog-page').hidden=$('catalog-view').hidden=playing;
  $('play-page').hidden=$('game-view').hidden=!playing;
  document.body.dataset.view=playing?'game':'catalog';
 }
 const pixels=value=>parseFloat(value)||0;
 function outerHeight(element){
  const css=getComputedStyle(element);
  return css.display==='none'?0:element.getBoundingClientRect().height+pixels(css.marginTop)+pixels(css.marginBottom);
 }
 function remainingHeight(page,blocks){
  const bodyCSS=getComputedStyle(document.body),pageCSS=getComputedStyle(page);
  const padding=['paddingTop','paddingBottom','borderTopWidth','borderBottomWidth'];
  const frame=padding.reduce((sum,key)=>sum+pixels(bodyCSS[key])+pixels(pageCSS[key]),0);
  return Math.max(0,(window.visualViewport?.height||innerHeight)-frame-blocks.reduce((sum,node)=>sum+outerHeight(node),0)-outerHeight($('storage-status')));
 }
 const filters=()=>({query:$('search').value,category:activeCategory,status:$('status-filter').value,difficulty:$('difficulty-filter').value});
 const visible=()=>C.filter(puzzles,filters(),store.data);
 const svgEl=(name,attrs={})=>{const e=document.createElementNS('http://www.w3.org/2000/svg',name);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));return e;};
 window.Kit.kalem.ayarla({animasyon:false,roughness:.4,strokeWidth:1},{kursun:'#555555',mavi:'#1f3b9b',kirmizi:'#c62828'},{yazi:{aile:'Patrick Hand'}});
 T.sound.set(store.data.preferences.sound);
 function save(){store.save();$('storage-status').textContent=store.warning;}
 function star(){const svg=svgEl('svg',{viewBox:'0 0 24 24','aria-hidden':'true'});svg.append(svgEl('path',{d:'m12 2 3 6.5 7 1-5 5 1 7-6-3.5L6 21l1-6.5-5-5 7-1Z'}));return svg;}
 function favorite(id){const i=store.data.favorites.indexOf(id);if(i>=0)store.data.favorites.splice(i,1);else store.data.favorites.push(id);save();renderCatalog();if(activePuzzle)renderFavorite();}
 function renderFavorite(){const yes=store.data.favorites.includes(activePuzzle.id);$('favorite-puzzle').textContent=yes?'Favorilerden çıkar':'Favorilere ekle';$('favorite-puzzle').setAttribute('aria-pressed',String(yes));}
 function renderCatalog(){
  if($('catalog-page').hidden)return;
  $('edition-count').textContent=`${T.puzzles.length} şekil · ${new Set(T.puzzles.map(p=>p.category)).size} kategori`;
  const inCategory=puzzles.filter(p=>activeCategory==='all'||p.category===activeCategory),completed=inCategory.filter(p=>C.done(store.data,p.id)).length;
  $('category-progress').textContent=`${activeCategory==='all'?'Defterin':inCategory[0]?.categoryName||'Benim şekillerim'} · ${completed}/${inCategory.length} tamamlandı`;
  const space=remainingHeight($('catalog-page'),[$('catalog-header'),$('catalog-browse'),$('catalog-footer')])-8;
  const capacity=C.capacity($('catalog-grid').clientWidth,space);
  if(pageSize&&pageSize!==capacity.size)pageNumber=Math.floor(pageNumber*pageSize/capacity.size);
  pageSize=capacity.size;$('catalog-grid').style.gridTemplateColumns=`repeat(${capacity.columns}, minmax(0, 1fr))`;
  const matches=visible(),page=C.page(matches,pageNumber,pageSize);pageNumber=page.number;
  $('category-select').value=activeCategory;
  $('catalog-grid').replaceChildren();
  for(const p of page.items){
   const li=document.createElement('li'),button=document.createElement('button');button.type='button';button.className='puzzle-link';button.dataset.puzzle=p.id;
   button.setAttribute('aria-pressed',String(p.id===catalogFocusId));
   button.setAttribute('aria-label',`${p.name}, ${p.categoryName}, ${difficulties[p.difficulty]}${C.done(store.data,p.id)?', tamamlandı':''}. Şekli aç`);
   const svg=svgEl('svg',{'aria-hidden':'true'}),name=document.createElement('span');name.className='puzzle-name';name.textContent=p.name;button.title=p.name;
   button.append(svg,name);li.append(button);T.draw.thumbnail(svg,p,{pieceLines:true});
   if(C.done(store.data,p.id)){const tick=svgEl('svg',{viewBox:'0 0 24 24',class:'puzzle-tick','aria-hidden':'true'});tick.append(svgEl('path',{d:'m3 12 6 7L22 3m-12 13 9-11'}));li.append(tick);}
   const fav=document.createElement('button');fav.type='button';fav.className='favorite-command';fav.dataset.favorite=p.id;fav.setAttribute('aria-pressed',String(store.data.favorites.includes(p.id)));fav.setAttribute('aria-label',`${p.name}: favori`);fav.append(star());li.append(fav);$('catalog-grid').append(li);
  }
  $('empty-state').hidden=matches.length!==0;$('catalog-count').textContent=`${matches.length} şekil`;
  $('result-announcement').textContent=`${matches.length} şekil; sayfa ${page.number+1}/${page.pages}.`;
  $('page-label').textContent=`${page.number+1} / ${page.pages}`;$('previous-page').disabled=page.number===0;$('next-page').disabled=page.number===page.pages-1;
  $('random-puzzle').disabled=!matches.length;
  const last=puzzles.find(p=>p.id===store.data.lastId);$('resume-puzzle').hidden=!last;if(last)$('resume-puzzle').textContent=`Devam et: ${last.name}`;
  $('categories').querySelectorAll('button').forEach(button=>{
   const id=button.dataset.category,items=puzzles.filter(p=>id==='all'||p.category===id),count=items.filter(p=>C.done(store.data,p.id)).length;
   button.setAttribute('aria-pressed',String(id===activeCategory));button.setAttribute('aria-label',`${button.textContent}, ${count}/${items.length} tamamlandı`);
  });
 }
 function nextPuzzle(){return activePuzzle&&C.next(puzzles,activePuzzle,store.data);}
 function renderScene(){if(!activePuzzle)return;const focused=document.activeElement?.getAttribute('data-piece');
  const blocks=[...$('game-view').children].filter(node=>node!==scene.parentElement);
  layout=T.draw.scene(scene,activePuzzle,board,colored,{boundaries,hint:board.hintPose,compact:true,maxHeight:remainingHeight($('play-page'),blocks)});
  if(focused&&!colored)scene.querySelector(`[data-piece="${focused}"]`)?.focus({preventScroll:true});
 }
 function clearHint(){clearTimeout(hintTimer);hintTimer=null;hintChoice=null;if(board)board.hintPose=null;}
 function changed(){
  lens.hidden=true;if(!board)return;
  const signature=JSON.stringify(board.pieces);if(signature!==lastSignature){clearHint();lastSignature=signature;T.sound.play();}
  const pose=board.current(),result=board.result,complete=result.complete&&!board.transaction;
  $('selection-status').textContent=colored?'Örnek çözüm. Kendi düzenin korunuyor.':announcement||(pose?`${G.byId[pose.pieceId].name}, seçili · ${pose.rotation*45}°${pose.flipped?' · ters':''}${input.carrying()?' · Tıkla bırak.':''}`:'Bir parça seç. Tıkla al, tıkla bırak.');announcement='';
  $('game-view').dataset.complete=String(complete&&!colored);
  $('placement-status').textContent=colored||complete||board.transaction?'':result.overlap>G.COMPLETION_EPSILON?'Bazı parçalar üst üste geliyor.':result.outside>G.COMPLETION_EPSILON?'Hedefin dışında parça var.':'';
  $('undo').disabled=colored||!board.history.length&&!board.transaction;$('reset').disabled=colored||!board.pieces.some(p=>p.zone==='board')&&!board.history.length;
  $('rotate-left').disabled=$('rotate-right').disabled=colored||!pose;$('flip').disabled=colored||pose?.pieceId!=='parallelogram';
  $('return-piece').disabled=colored||pose?.zone!=='board';$('align-piece').disabled=colored||!!board.transaction||pose?.zone!=='board';$('hint').disabled=colored||complete||!!board.transaction;
  $('completion').hidden=colored||!complete;
  $('selection-actions').hidden=colored||!pose;
  if(complete&&!colored){
   if(!C.done(store.data,activePuzzle.id)){store.data.completed[activePuzzle.id]={at:new Date().toISOString(),hints:store.data.hints[activePuzzle.id]||0};renderCatalog();}
   const next=nextPuzzle();$('next-puzzle').hidden=!next;$('next-status').textContent=next?'':'Bu kategorideki şekilleri tamamladın.';
  }
  store.remember(activePuzzle,board);save();renderScene();
 }
 const input=T.input.attach(scene,{
  context:()=>({board,layout,preview:colored}),changed,message:text=>{announcement=text;},
  moving(pose,snap,point,event){T.draw.movePiece(scene,pose,layout,snap);T.sound.play('move');
   if(event.pointerType==='touch'){lens.hidden=false;lens.style.left=`${Math.max(8,Math.min(innerWidth-132,event.clientX+18))}px`;lens.style.top=`${Math.max(8,event.clientY-154)}px`;T.draw.lens(lens.querySelector('svg'),board,layout,point);}
  }
 });
 function openPuzzle(puzzle,focus=true){
  input.cancel();clearHint();activePuzzle=puzzle;catalogFocusId=puzzle.id;colored=false;
  if(!sessions.has(puzzle.id)){const next=T.board.create(puzzle);store.restore(puzzle,next);sessions.set(puzzle.id,next);}board=sessions.get(puzzle.id);lastSignature=JSON.stringify(board.pieces);
  boundaries=store.data.preferences.boundariesChosen?store.data.preferences.boundaries:tutorials.has(puzzle.id);$('show-boundaries').checked=boundaries;
  $('tutorial-note').textContent=tutorials.has(puzzle.id)?'İlk adımlar: sınırları izle, bir parçayı seç ve yerine taşı. Sınırları dilediğinde kapatabilirsin.':'';
  syncViews();$('puzzle-number').textContent=puzzle.personal?'':String(T.puzzles.findIndex(p=>p.id===puzzle.id)+1).padStart(2,'0')+' ·';$('puzzle-title').textContent=puzzle.name;$('puzzle-category').textContent=puzzle.categoryName;$('puzzle-difficulty').textContent=difficulties[puzzle.difficulty];
  $('color-preview').setAttribute('aria-pressed','false');$('color-preview').textContent='Çözümü göster';
  $('edit-design').hidden=!puzzle.personal;if(puzzle.personal)$('edit-design').href=`design.html#${puzzle.id}`;
  renderFavorite();renderCatalog();document.title=`${puzzle.name} · Tangram — Defterde`;changed();T.draw.lettering();
  if(focus){window.scrollTo(0,0);$('puzzle-title').focus({preventScroll:true});}
 }
 function openCatalog(focus=true){
  input.cancel();clearHint();lens.hidden=true;
  activePuzzle=null;board=null;
  syncViews();document.title='Tangram — Defterde';renderCatalog();T.draw.lettering();
  if(focus){const button=catalogFocusId&&$('catalog-grid').querySelector(`[data-puzzle="${catalogFocusId}"]`);(button||$('catalog-title')).focus({preventScroll:true});window.scrollTo(0,0);}
 }
 function route(focus=true){const id=location.hash.startsWith('#sekil/')?location.hash.slice(7):'',p=puzzles.find(p=>p.id===id);if(p)openPuzzle(p,focus);else openCatalog(focus);}
 const categories=new Map([['all','Tümü'],...puzzles.filter(p=>!p.personal).map(p=>[p.category,p.categoryName]),['benim','Benim şekillerim']]);
 const shortNames={'kara-hayvanlari':'Hayvanlar','deniz-canlilari':'Deniz',geometri:'Geometri',insanlar:'İnsanlar','ev-esyalari':'Ev eşyaları',nesneler:'Nesneler'};
 for(const [id,name] of categories){const button=document.createElement('button');button.type='button';button.className='category-button';button.dataset.category=id;button.textContent=shortNames[id]||name;button.addEventListener('click',()=>{activeCategory=id;pageNumber=0;renderCatalog();});$('categories').append(button);$('category-select').add(new Option(name,id));}
 $('category-select').addEventListener('change',()=>{activeCategory=$('category-select').value;pageNumber=0;renderCatalog();});
 for(const id of ['search','status-filter','difficulty-filter'])$(id).addEventListener(id==='search'?'input':'change',()=>{pageNumber=0;renderCatalog();});
 $('clear-filters').addEventListener('click',()=>{$('search').value='';$('status-filter').value=$('difficulty-filter').value='all';activeCategory='all';pageNumber=0;renderCatalog();$('search').focus();});
 $('catalog-grid').addEventListener('click',event=>{const fav=event.target.closest('[data-favorite]');if(fav){favorite(fav.dataset.favorite);$('catalog-grid').querySelector(`[data-favorite="${fav.dataset.favorite}"]`)?.focus();return;}const button=event.target.closest('[data-puzzle]');if(button)location.hash=`sekil/${button.dataset.puzzle}`;});
 $('favorite-puzzle').addEventListener('click',()=>favorite(activePuzzle.id));
 for(const [id,delta] of [['previous-page',-1],['next-page',1]])$(id).addEventListener('click',()=>{pageNumber+=delta;renderCatalog();$('catalog-title').focus();window.scrollTo(0,0);});
 $('random-puzzle').addEventListener('click',()=>{const p=C.random(visible(),store.data);if(p)location.hash=`sekil/${p.id}`;});
 $('resume-puzzle').addEventListener('click',()=>{location.hash=`sekil/${store.data.lastId}`;});
 for(const id of ['back-to-catalog','completed-back'])$(id).addEventListener('click',()=>{location.hash='sekiller';});
 $('next-puzzle').addEventListener('click',()=>{const next=nextPuzzle();if(next)location.hash=`sekil/${next.id}`;});
 $('color-preview').addEventListener('click',()=>{input.cancel();clearHint();colored=!colored;$('color-preview').setAttribute('aria-pressed',String(colored));$('color-preview').textContent=colored?'Kendi düzenime dön':'Çözümü göster';changed();});
 $('show-boundaries').addEventListener('change',()=>{boundaries=$('show-boundaries').checked;store.data.preferences.boundaries=boundaries;store.data.preferences.boundariesChosen=true;save();renderScene();});
 $('hint').addEventListener('click',()=>{
  input.cancel();if(!hintChoice){hintChoice=T.learning.hint(activePuzzle,board.pieces);if(!hintChoice)return;board.select(hintChoice.pieceId);announcement=`${G.byId[hintChoice.pieceId].name} ile deneyebilirsin. Bir kez daha dokunursan örnek konumu göreceksin.`;}
  else {board.hintPose=hintChoice.pose;announcement=hintChoice.example?'Bir örnek yerleşim gösteriliyor; kendi çözümün de geçerli olabilir.':'Bu parça için örnek bir konum.';clearTimeout(hintTimer);const current=board;hintTimer=setTimeout(()=>{current.hintPose=null;hintChoice=null;if(board===current)renderScene();},2400);}
  store.data.hints[activePuzzle.id]=(store.data.hints[activePuzzle.id]||0)+1;changed();
 });
 function renderSound(){const on=store.data.preferences.sound;$('sound').setAttribute('aria-pressed',String(on));$('sound').setAttribute('aria-label',on?'Sesi kapat':'Sesi aç');$('sound').title=on?'Ses açık':'Ses kapalı';$('sound').querySelector('path').setAttribute('d',on?'M4 11h5l6-5v16l-6-5H4Zm15-3q7 6 0 12m0-9q3 3 0 6':'M4 11h5l6-5v16l-6-5H4Zm15 0 6 6m0-6-6 6');}
 $('sound').addEventListener('click',()=>{store.data.preferences.sound=!store.data.preferences.sound;T.sound.set(store.data.preferences.sound);renderSound();save();T.sound.play();});
 document.querySelectorAll('[data-action]').forEach(button=>button.addEventListener('click',()=>input.action(button.dataset.action)));
 let scheduled=false,previousWidth=0;
 function resizeLayout(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;input.cancel();if(activePuzzle)renderScene();else renderCatalog();T.draw.lettering();});}
 new ResizeObserver(entries=>{const width=entries[0].contentRect.width;if(Math.abs(width-previousWidth)<.5)return;previousWidth=width;resizeLayout();}).observe($('notebook'));
 window.addEventListener('resize',resizeLayout);window.visualViewport?.addEventListener('resize',resizeLayout);
 document.querySelectorAll('.catalog-options, .game-options').forEach(details=>details.addEventListener('toggle',resizeLayout));
 document.addEventListener('keydown',event=>{if(event.key==='Escape')document.querySelectorAll('.catalog-options[open], .game-options[open]').forEach(details=>{details.open=false;details.querySelector('summary').focus();});});
 window.addEventListener('hashchange',()=>route());window.addEventListener('pagehide',()=>{input.cancel();if(board&&activePuzzle)store.remember(activePuzzle,board);save();});
 renderSound();route(false);$('storage-status').textContent=store.warning;document.fonts.ready.then(resizeLayout);
})();
