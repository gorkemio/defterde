(function(){
 'use strict';
 const T=window.Tangram,G=T.geometry,$=id=>document.getElementById(id),store=T.storage.create(()=>localStorage);
 const scene=$('design-scene'),lens=$('touch-lens'),frame=[[[[-3,-3],[3,-3],[3,3],[-3,3],[-3,-3]]]];
 let draftId=null,layout=null,board=T.board.create({target:[]}),puzzle={id:'free',target:[],frame,solutions:[]};
 let localPuzzle=null,designSnapshot=null,playing=false;
 const existing=store.data.designs.find(p=>p.id===location.hash.slice(1));
 if(existing){draftId=existing.id;board.pieces=existing.solutions[0].map(p=>({...p,zone:'board',homeRotation:p.rotation,homeFlipped:p.flipped}));$('design-name').value=existing.name;board.check();}
 else if(T.storage.snapshotValid(store.data.draft)) {board.restore(store.data.draft);$('design-name').value=typeof store.data.draft.name==='string'?store.data.draft.name:'';}
 window.Kit.kalem.ayarla({animasyon:false,roughness:.4,strokeWidth:1},{kursun:'#555555',mavi:'#1f3b9b',kirmizi:'#c62828'},{yazi:{aile:'Patrick Hand'}});
 function remember(){if(!playing)store.data.draft={...(board.transaction||board.snapshot()),name:$('design-name').value};store.save();$('design-storage').textContent=store.warning;}
 function render(){const focused=document.activeElement?.getAttribute('data-piece');layout=T.draw.scene(scene,puzzle,board,false);if(focused)scene.querySelector(`[data-piece="${focused}"]`)?.focus({preventScroll:true});}
 function changed(){lens.hidden=true;const p=board.current();$('design-selection').textContent=p?T.draw.pieceLabel(p,true)+(input.carrying()?' · Tıkla bırak; sağ tık veya kaydırarak döndür.':''):'Bir parça seç, boş sayfaya taşı.';
  const check=G.validateLayout(board.pieces.filter(p=>p.zone==='board'));$('design-validity').textContent=playing
   ?board.result.complete?'Tamamlandı. Kendi şeklini çözdün.':'Silueti aynı yedi parçayla tamamla.'
   :check.valid?'Yedi parça birleşti. Şeklin bulmaca olmaya hazır.':check.errors.join(' ');
  $('save-design-button').disabled=playing||!!board.transaction||!check.valid;$('design-undo').disabled=!board.history.length&&!board.transaction;$('design-flip').disabled=p?.pieceId!=='parallelogram';$('play-design').hidden=!playing;
  remember();render();
 }
 const input=T.input.attach(scene,{context:()=>({board,layout,preview:false}),changed,message:t=>{$('design-selection').textContent=t;},
  moving(pose,snap,point,event){T.draw.movePiece(scene,pose,layout,snap);if(event.pointerType==='touch'){lens.hidden=false;lens.style.left=`${Math.max(8,Math.min(innerWidth-132,event.clientX+18))}px`;lens.style.top=`${Math.max(8,event.clientY-154)}px`;T.draw.lens(lens.querySelector('svg'),board,layout,point);}}
 });
 function fit(){if(playing)return;const poses=board.pieces.filter(p=>p.zone==='board');puzzle.frame=poses.length?G.deriveTarget(poses):frame;render();}
 if(existing)fit();
 document.querySelectorAll('[data-action]').forEach(button=>button.addEventListener('click',()=>input.action(button.dataset.action)));
 $('design-fit').addEventListener('click',()=>{input.cancel();fit();});$('design-name').addEventListener('input',remember);
 $('new-design').addEventListener('click',()=>{input.cancel();draftId=null;playing=false;board=T.board.create({target:[]});puzzle={id:'free',target:[],frame,solutions:[]};$('design-name').value='';$('design-message').textContent='';history.replaceState(null,'',location.pathname);changed();});
 $('save-design').addEventListener('submit',event=>{event.preventDefault();input.cancel();try{
  const record=store.saveDesign($('design-name').value,board.pieces.filter(p=>p.zone==='board'),draftId);draftId=record.id;store.data.draft=null;store.save();
  $('design-message').textContent=store.warning?'Şeklin bu oturumda hazır; bu tarayıcıya kayıt yazılamadı.':'Şeklin “Benim şekillerim” bölümüne kaydedildi.';
  localPuzzle={...record,target:G.deriveTarget(record.solutions[0])};
  $('play-design').href=`index.html#sekil/${record.id}`;$('play-design').textContent='Şeklimi oyna';$('play-design').hidden=false;$('design-storage').textContent=store.warning;
 }catch(error){$('design-message').textContent=error.message;}});
 $('play-design').addEventListener('click',event=>{
  // Depolama kapalıyken de kendi bulmacasını aynı sayfada oynayabilir.
  if(!store.warning&&!playing)return;
  event.preventDefault();input.cancel();
  if(playing){playing=false;board=T.board.create({target:[]});board.restore(designSnapshot);puzzle={id:'free',target:[],frame,solutions:[]};changed();}
  else if(localPuzzle){designSnapshot=board.snapshot();playing=true;puzzle=localPuzzle;board=T.board.create(localPuzzle);changed();$('play-design').textContent='Tasarıma dön';}
 });
 let previous=0;new ResizeObserver(entries=>{const width=entries[0].contentRect.width;if(Math.abs(width-previous)<.5)return;previous=width;input.cancel();render();T.draw.lettering();}).observe($('notebook'));
 changed();document.fonts.ready.then(T.draw.lettering);
})();
