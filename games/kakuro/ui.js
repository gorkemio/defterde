(function(){
  'use strict';
  const K=window.Kakuro,$=id=>document.getElementById(id),names={kolay:'Kolay',orta:'Orta',zor:'Zor'};
  const definitions=K.puzzles,boards=new Map();
  for(const definition of definitions) {
    const board=K.compileBoard(definition);
    if(!board.ok)throw new Error(`${definition.id}: ${board.errors.join(' ')}`);
    boards.set(board.id,board);
  }
  let provider;try{provider=window.localStorage;}catch{provider=null;}
  const storage=new K.GameStorage(provider),preferences=storage.preferences();
  let state,clock,view='game',paused=false,hint=null,analysis=null,analysisKey='',consistency=null;
  let token=0,abort=null,pendingReplay=null,busy=false;
  const boardView=new K.BoardView($('board'),$('board-viewport'),(cell,direction)=>{
    if(!canPlay())return;
    dispatch({type:'select',cell,direction:direction||state.direction},true);
  },overflow=>{$('scroll-cue').hidden=!overflow;});
  function announce(message){$('announcement').textContent=message;}
  function revealPanel(panel,focus) {
    focus.focus({preventScroll:true});
    panel.scrollIntoView({block:'start',behavior:'instant'});
  }
  function revealHint(){revealPanel($('hint-panel'),$('hint-heading'));}
  function timeLabel(ms){
    const seconds=Math.floor(ms/1000),minutes=Math.floor(seconds/60);
    return `${String(minutes).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
  }
  const valueKey=()=>state.board.id+':'+state.values.join('');
  const canPlay=()=>view==='game'&&!paused&&!storage.conflicts.has(state?.board.id);
  function storageNotice() {
    const messages=[];
    if(!storage.available)messages.push('Tarayıcı kayda izin vermiyor. Oyun bu sekmede devam eder; kapatınca ilerleme kaybolabilir.');
    if(storage.corrupt.size)messages.push('Bir kayıt okunamadı. Yalnız ilgili bulmaca yeni bir denemeyle açıldı.');
    $('storage-status').hidden=!messages.length;$('storage-status').textContent=messages.join(' ');
    $('storage-conflict').hidden=!storage.conflicts.has(state?.board.id);
  }
  function save() {
    if(!state||!clock)return;
    if(storage.save(state,clock.read()))storage.savePreferences(preferences);
    else if(storage.conflicts.has(state.board.id)){cancelAnalysis();refresh();}
    storageNotice();
  }
  function syncClock() {
    if(canPlay()&&!document.hidden&&!state.complete)clock.start();else clock.stop();
    $('timer').textContent=timeLabel(clock.read());
    $('pause-button').setAttribute('aria-label',`${timeLabel(clock.read())}. ${paused?'Süreyi devam ettir':'Süreyi duraklat'}`);
  }
  function invalidateHint() {
    token++;abort?.abort();abort=null;busy=false;hint=null;analysis=null;analysisKey='';consistency=null;
    $('hint-panel').hidden=true;$('hint-button').setAttribute('aria-expanded','false');
    $('hint-panel').removeAttribute('aria-busy');
  }
  function cancelAnalysis() {
    token++;abort?.abort();abort=null;
    if(busy)showHintContent('İnceleme durdu','Yeni bir hamle önerilmedi. İpucu düğmesiyle yeniden deneyebilirsin.');
    busy=false;$('hint-panel').removeAttribute('aria-busy');
  }
  function openPuzzle(id,{fresh=false,focus=false}={}) {
    if(state){clock.stop();save();}
    invalidateHint();const board=boards.get(id);
    const current=storage.load(board),saved=fresh?null:current;
    state=K.createState(board,saved||{});clock=new K.ActiveClock(state.elapsed);paused=false;
    preferences.last=id;preferences.difficulty=board.definition.difficulty;
    $('difficulty-select').value=preferences.difficulty;view='game';
    $('board-viewport').scrollLeft=0;boardView.mount(board,state);setView('game');
    $('puzzle-number').textContent=id.split('-').at(-1);$('difficulty').textContent=names[board.definition.difficulty];
    refresh({focus});save();
    if(focus)announce(`${names[board.definition.difficulty]} ${id.split('-').at(-1)}. ${saved?'Kaldığın yerden devam.':'Bütün kareler boş.'}`);
  }
  function refresh(options={}) {
    const validation=K.validateValues(state.board,state.values);
    syncClock();
    const hintCells=hint?.step?.placement?[hint.step.placement.cell]:(hint?.step?.changes?.map(c=>c.cell)||[]);
    boardView.update(state,{...options,reveal:options.focus,hintCells});
    const pair=state.board.membership[state.selected];
    for(const axis of ['across','down']) {
      const group=state.board.groups[pair[axis]];
      $(axis+'-total').textContent=group.total;$(axis+'-button').setAttribute('aria-pressed',state.direction===axis);
      $(axis+'-button').disabled=!canPlay();
    }
    $('filled-count').textContent=validation.filled;$('total-count').textContent=state.board.white.length;
    $('note-button').setAttribute('aria-pressed',state.noteMode);
    $('number-label').textContent=state.noteMode?'Notunu seç:':'Bir sayı seç:';
    $('help-count').textContent=`${state.helps} yardım`;
    for(const button of document.querySelectorAll('.number-key')) {
      const n=Number(button.dataset.digit);
      button.disabled=!canPlay()||state.complete;
      button.setAttribute('aria-label',`${n} ${state.noteMode?'notunu değiştir':'yaz'}`);
      button.classList.toggle('chosen',state.noteMode?Boolean(state.notes[state.selected]&K.bit(n)):state.values[state.selected]===n);
    }
    $('note-button').disabled=!canPlay()||state.complete;
    $('erase-button').disabled=!canPlay()||state.complete||!(state.values[state.selected]||state.notes[state.selected]);
    $('undo-button').disabled=!canPlay()||!state.history.length;
    $('hint-button').disabled=!canPlay()||state.complete;
    $('apply-hint').disabled=!canPlay()||busy;
    $('next-hint').disabled=!canPlay()||busy;
    $('reveal-button').disabled=!canPlay()||state.complete||Boolean(state.values[state.selected])||busy;
    $('pause-button').disabled=state.complete||storage.conflicts.has(state.board.id);$('pause-label').textContent=paused?'Devam et':'Duraklat';
    $('board').setAttribute('aria-disabled',storage.conflicts.has(state.board.id));
    $('pause-cover').hidden=!paused;$('board').style.visibility=paused?'hidden':'';
    $('board').setAttribute('aria-hidden',paused);$('board-viewport').inert=paused;
    const issue=validation.issues[0];
    $('error-status').hidden=!issue;
    $('error-status').textContent=issue?`Grup uyarısı: ${issue.message} İşaretli grubun rakamlarını kontrol et.`:'';
    $('completion').hidden=!state.complete;
    if(state.complete)$('completion-text').textContent=`${timeLabel(clock.read())} · ${state.helps?`${state.helps} yardımla`:'Yardımsız'} tamamladın. Yeni bir sayfaya geçebilir veya son hamleyi geri alabilirsin.`;
    $('sound-button').setAttribute('aria-pressed',preferences.sound);
    $('sound-button').setAttribute('aria-label',preferences.sound?'Ses açık; kapat':'Ses kapalı; aç');
    K.draw.decorate();
  }
  function dispatch(action,focus=false) {
    const old=state,before=valueKey();
    state=K.applyAction(state,action);
    if(state===old)return;
    if(before!==valueKey())invalidateHint();
    refresh({focus});save();
    if(['digit','erase','undo'].includes(action.type)) {
      Kit.ses.cal(action.type==='digit'?'grafit':'kayma',0,action.type==='digit'?70:'silgi');
      announce(state.complete?'Tebrikler, bütün toplamlar tamam.':boardView.label(state,state.selected));
    }
    if(action.type==='noteMode')announce(state.noteMode?'Not modu açık. Boş karelere küçük adaylar yazılır.':'Sayı modu açık.');
    if(state.complete&&!old.complete)revealPanel($('completion'),$('completion-heading'));
  }
  function setView(next,focusId) {
    if(next!=='game'){cancelAnalysis();Kit.ses.durdur();}
    view=next;$('play-layout').hidden=view!=='game';$('list-panel').hidden=view!=='list';$('help-panel').hidden=view!=='tutorial';
    $('game-feedback').hidden=view!=='game';
    $('help-button').setAttribute('aria-expanded',view==='tutorial');$('list-button').setAttribute('aria-expanded',view==='list');
    if(state){refresh();save();}
    if(view==='game'){boardView.resize();}
    if(view==='tutorial'){tutorialView.resize();}
    if(view==='list')revealPanel($('list-panel'),$(focusId||'close-list'));
    else if(view==='tutorial')revealPanel($('help-panel'),$(focusId||'close-help'));
    else if(focusId){$(focusId).focus({preventScroll:true});$(focusId).scrollIntoView({block:'nearest',behavior:'instant'});}
    else window.scrollTo({top:0,behavior:'instant'});
    K.draw.decorate();
  }
  function showList(message='') {
    save();$('replay-confirm').hidden=true;pendingReplay=null;
    $('difficulty-select').value=preferences.difficulty;renderList(message);setView('list','close-list');
  }
  function renderList(message='') {
    const difficulty=$('difficulty-select').value,items=definitions.filter(d=>d.difficulty===difficulty),list=$('puzzle-list');
    let completed=0,assisted=0,unassisted=0;list.replaceChildren();
    for(const d of items) {
      const board=boards.get(d.id),saved=storage.load(board,{adopt:false}),attempts=storage.attempts(board);
      const done=saved&&K.validateValues(board,saved.values).complete;
      if(done)completed++;
      assisted+=attempts.filter(a=>a.helps>0).length;unassisted+=attempts.filter(a=>a.helps===0).length;
      const li=document.createElement('li'),button=document.createElement('button');button.type='button';button.className='puzzle-choice';button.dataset.puzzle=d.id;
      const number=document.createElement('span');number.className='puzzle-index';number.textContent=d.id.split('-').at(-1);
      const status=document.createElement('span');status.className='puzzle-state';
      status.textContent=done?`Tamamlandı · ${saved.helps?'yardımlı':'yardımsız'}`:saved?'Devam et':'Başlamadın';
      const detail=document.createElement('span');detail.className='puzzle-detail';detail.textContent=`${d.rows} × ${d.cols}${saved?' · '+timeLabel(saved.elapsed):''}`;
      button.append(number,status,detail);if(d.id===state.board.id)button.setAttribute('aria-current','true');
      button.addEventListener('click',()=>done?offerReplay(d.id):openPuzzle(d.id,{focus:true}));li.append(button);list.append(li);
    }
    $('list-summary').textContent=message||`${completed} / 20 sayfa tamamlandı. Bitmiş denemeler: ${unassisted} yardımsız, ${assisted} yardımlı.`;
    storageNotice();
  }
  function offerReplay(id) {
    pendingReplay=id;$('replay-message').textContent=`${names[boards.get(id).definition.difficulty]} ${id.split('-').at(-1)} için boş bir deneme başlayacak. Önceki tamamlanma kaydın korunur.`;
    $('replay-confirm').hidden=false;$('confirm-replay').focus();$('replay-confirm').scrollIntoView({block:'nearest'});
  }
  function newPuzzle() {
    save();const items=definitions.filter(d=>d.difficulty===preferences.difficulty);
    const next=items.find(d=>!storage.load(boards.get(d.id),{adopt:false}))||items.find(d=>{
      const saved=storage.load(boards.get(d.id),{adopt:false});return saved&&!K.validateValues(boards.get(d.id),saved.values).complete;
    });
    if(next)openPuzzle(next.id,{focus:true});
    else showList('Bu zorluktaki bütün sayfalar tamamlandı. Yeniden oynamak için bir sayfa seç.');
  }
  function showHintContent(title,text,details=[]) {
    $('hint-panel').hidden=false;$('hint-button').setAttribute('aria-expanded','true');
    $('hint-heading').textContent=title;$('hint-text').textContent=text;
    $('hint-evidence').replaceChildren();
    details.forEach(line=>{const li=document.createElement('li');li.textContent=line;$('hint-evidence').append(li);});
    $('hint-details').hidden=!details.length;$('apply-hint').hidden=true;$('next-hint').hidden=true;
  }
  function displayHint() {
    if(!hint)return;
    const description=K.describeStep(state.board,hint.step);
    showHintContent(description.title,description.text,description.details);
    $('apply-hint').hidden=!hint.step.placement;$('next-hint').hidden=hint.step.kind!=='elimination';
    refresh();
  }
  async function requestHelp({reveal=false,next=false}={}) {
    if(!canPlay()||state.complete||busy)return;
    if(!reveal&&!next&&hint){displayHint();revealHint();return;}
    if(reveal&&state.values[state.selected])return;
    const key=valueKey(),cell=state.selected,current=++token,started=performance.now();
    abort=new AbortController();const signal=abort.signal;busy=true;refresh();
    showHintContent(reveal?'Hücreyi kontrol ediyorum':'Toplamlara bakıyorum','Mevcut rakamların tutarlılığı denetleniyor…');
    $('hint-panel').setAttribute('aria-busy','true');
    revealHint();
    try {
      if(analysisKey!==key){analysis=K.createAnalysis(state.board,state.values);analysisKey=key;consistency=null;}
      if(!consistency) {
        const checked=await K.countSolutionsAsync(state.board,[...state.values],{maxMs:2000,maxNodes:1000000,signal});
        if(current!==token||key!==valueKey())return;
        consistency=checked;
      }
      if(current!==token||key!==valueKey())return;
      if(consistency.status==='unknown') {
        const cancelled=consistency.cancelled;consistency=null;
        showHintContent(cancelled?'İnceleme durdu':'Biraz daha süre gerekiyor',cancelled?'İnceleme iptal edildi.':'Tutarlılık süre sınırı içinde kanıtlanamadı. Bir doğru hamle önerilmedi; yeniden deneyebilirsin.');
        return;
      }
      if(consistency.status==='none') {
        const local=K.validateValues(state.board,state.values);
        showHintContent('Bir çelişki var',local.valid?'Yazılı rakamlar birlikte geçerli bir çözüme ulaşmıyor. Tek bir yanlış kare belirlenemedi; son hamlelerini ve kesişen grupları kontrol et.':[...new Set(local.issues.map(i=>i.message))].join(' '),
          local.issues.map(i=>i.groups.map(id=>{const g=state.board.groups[id];return `${Math.floor(g.clue/state.board.cols)+1}. satır ${g.clue%state.board.cols+1}. sütundaki ${g.axis==='across'?'yatay':'dikey'} ${g.total} grubu.`;}).join(' ')));
        return;
      }
      if(reveal) {
        if(consistency.status!=='unique'){showHintContent('Hücre açılamadı','Birden fazla çözüm var; bu kareye kesin bir rakam yazılamadı.');return;}
        const value=consistency.solution[cell];
        dispatch({type:'digit',cell,value,force:true,assisted:true},true);
        showHintContent('Bir hücre açıldı',`${Math.floor(cell/state.board.cols)+1}. satır, ${cell%state.board.cols+1}. sütuna ${value} yazıldı. Bu ayrı yardım geri alınabilir; yardım sayısı korunur.`);
        revealHint();
        return;
      }
      const remaining=2000-(performance.now()-started),deadline=performance.now()+Math.max(0,remaining);
      const checkpoint=()=>{if(signal.aborted)throw new Error('cancelled');if(performance.now()>=deadline)throw new Error('budget');};
      checkpoint();
      const step=await K.runSliced(K.logicalStepSteps(state.board,analysis,3,checkpoint));
      if(current!==token||key!==valueKey())return;
      if(['placement','elimination'].includes(step.kind)) {
        const helpKey=key+'|'+step.technique+'|'+JSON.stringify([step.changes,step.placement]);
        state=K.applyAction(state,{type:'help',key:helpKey});
        if(step.kind==='elimination')K.applyLogicalStep(analysis,step);
      }
      hint={step,key};displayHint();save();
    } catch(error) {
      if(current!==token)return;
      if(error.message==='budget')showHintContent('İnceleme süre sınırına ulaştı','Yeni bir hamle önerilmedi. Yeniden deneyebilirsin.');
      else if(error.message!=='cancelled') {showHintContent('İnceleme tamamlanamadı','Tahtan korunuyor. İpucunu tekrar deneyebilirsin.');console.error(error);}
    } finally {
      if(current===token){busy=false;$('hint-panel').removeAttribute('aria-busy');refresh();revealHint();}
    }
  }
  function closeHint() {
    token++;abort?.abort();busy=false;$('hint-panel').hidden=true;$('hint-button').setAttribute('aria-expanded','false');
    $('hint-panel').removeAttribute('aria-busy');refresh();$('hint-button').focus();
  }
  document.querySelectorAll('[data-digit]').forEach(button=>button.addEventListener('click',()=>dispatch({type:'digit',value:Number(button.dataset.digit)},true)));
  $('erase-button').addEventListener('click',()=>dispatch({type:'erase'},true));
  $('note-button').addEventListener('click',()=>dispatch({type:'noteMode'}));
  $('undo-button').addEventListener('click',()=>dispatch({type:'undo'},true));
  for(const direction of ['across','down'])$(direction+'-button').addEventListener('click',()=>dispatch({type:'direction',direction}));
  $('hint-button').addEventListener('click',()=>requestHelp());
  $('next-hint').addEventListener('click',()=>requestHelp({next:true}));
  $('reveal-button').addEventListener('click',()=>requestHelp({reveal:true}));
  $('close-hint').addEventListener('click',closeHint);
  $('apply-hint').addEventListener('click',()=>{
    if(canPlay()&&hint?.step.placement&&hint.key===valueKey()){
      const {cell,value}=hint.step.placement;dispatch({type:'digit',cell,value,force:true},true);
    }
  });
  $('pause-button').addEventListener('click',()=>{paused=!paused;cancelAnalysis();refresh();save();if(paused)$('resume-button').focus();});
  $('resume-button').addEventListener('click',()=>{paused=false;refresh({focus:true});save();});
  $('new-button').addEventListener('click',newPuzzle);$('next-completed').addEventListener('click',newPuzzle);
  $('list-button').addEventListener('click',()=>view==='list'?setView('game','list-button'):showList());
  $('close-list').addEventListener('click',()=>setView('game','list-button'));
  $('difficulty-select').addEventListener('change',()=>{preferences.difficulty=$('difficulty-select').value;storage.savePreferences(preferences);$('replay-confirm').hidden=true;renderList();});
  $('replay-button').addEventListener('click',()=>{showList();offerReplay(state.board.id);});
  $('confirm-replay').addEventListener('click',()=>{if(pendingReplay){const id=pendingReplay;pendingReplay=null;openPuzzle(id,{fresh:true,focus:true});}});
  $('cancel-replay').addEventListener('click',()=>{$('replay-confirm').hidden=true;pendingReplay=null;$('close-list').focus();});
  $('help-button').addEventListener('click',()=>setView(view==='tutorial'?'game':'tutorial',view==='tutorial'?'help-button':'close-help'));
  $('close-help').addEventListener('click',()=>setView('game','help-button'));
  Kit.ses.kur({anahtar:K.STORAGE_PREFIX+'sound'});Kit.ses.seviye(.15);Kit.ses.sessizYap(!preferences.sound);
  $('sound-button').addEventListener('click',()=>{preferences.sound=!preferences.sound;Kit.ses.sessizYap(!preferences.sound);if(preferences.sound)Kit.ses.baslat();refresh();save();});
  $('reload-latest').addEventListener('click',()=>openPuzzle(state.board.id,{focus:true}));
  window.addEventListener('storage',event=>{
    if((event.key===null||event.key===K.STORAGE_PREFIX+state.board.id)&&storage.hasConflict(state.board)){
      cancelAnalysis();refresh();storageNotice();
      announce('Bu bulmaca başka sekmede güncellendi. Devam etmek için son kaydı yükle.');
    }
  });
  const unlock=()=>{if(preferences.sound)Kit.ses.baslat();};
  document.addEventListener('pointerdown',unlock,{capture:true});document.addEventListener('keydown',unlock,{capture:true});
  document.addEventListener('keydown',event=>{
    if(event.target.closest('input,select,textarea,[contenteditable="true"]'))return;
    if(event.key==='Escape') {
      if(view!=='game'){event.preventDefault();setView('game',view==='list'?'list-button':'help-button');}
      else if(!$('hint-panel').hidden){event.preventDefault();closeHint();}
      return;
    }
    if(!canPlay())return;
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'&&!event.shiftKey){event.preventDefault();dispatch({type:'undo'},true);return;}
    if(event.altKey||event.ctrlKey||event.metaKey)return;
    const moves={ArrowLeft:[0,-1],ArrowRight:[0,1],ArrowUp:[-1,0],ArrowDown:[1,0]};
    if(moves[event.key]&&event.target.closest('#board')) {
      event.preventDefault();state=K.moveSelection(state,...moves[event.key]);refresh({focus:true});save();return;
    }
    if(state.complete)return;
    if(/^[1-9]$/.test(event.key)){event.preventDefault();dispatch({type:'digit',value:Number(event.key)},true);}
    else if(['Backspace','Delete'].includes(event.key)){event.preventDefault();dispatch({type:'erase'},true);}
    else if(event.key.toLowerCase()==='n'){event.preventDefault();dispatch({type:'noteMode'});}
  });
  document.addEventListener('visibilitychange',()=>{syncClock();if(document.hidden)Kit.ses.durdur();save();});
  window.addEventListener('pagehide',()=>{clock.stop();save();});
  window.addEventListener('pageshow',()=>syncClock());
  // This example has its own state and never touches a saved puzzle or its timer.
  const tutorialBoard=K.compileBoard({id:'tutorial',version:1,rows:3,cols:3,cells:[
    {type:'dark'},{type:'dark',down:4},{type:'dark',down:6},
    {type:'dark',across:3},{type:'white'},{type:'white'},
    {type:'dark',across:7},{type:'white'},{type:'white'}]});
  let tutorial=K.createState(tutorialBoard),tutorialStep=0;
  const tutorialView=new K.BoardView($('tutorial-board'),$('tutorial-viewport'),cell=>{
    tutorial=K.applyAction(tutorial,{type:'select',cell});tutorialView.update(tutorial,{focus:true,reveal:true});
  });
  $('tutorial-board').addEventListener('keydown',event=>{
    const moves={ArrowLeft:[0,-1],ArrowRight:[0,1],ArrowUp:[-1,0],ArrowDown:[1,0]};
    if(!moves[event.key]||event.altKey||event.ctrlKey||event.metaKey)return;
    event.preventDefault();event.stopPropagation();
    tutorial=K.moveSelection(tutorial,...moves[event.key]);
    tutorialView.update(tutorial,{focus:true,reveal:true});
  });
  const lessons=[
    'İlk yatay toplam 3, iki boş kare var. Tekrarsız tek küme 1 ve 2. İlk dikey toplam 4 için küme 1 ve 3.',
    'İlk karenin yatay adayları 1, 2; dikey adayları 1, 3. Ortak rakam yalnız 1. Küçük notlar bunu hatırlatabilir.',
    '1 kesinleşti. Üst satırın toplamı 3 olduğuna göre yanındaki kare 2.',
    'İlk sütunun toplamı 4: 1’in altında 3 olmalı.',
    'Alt satırın toplamı 7: 3’ün yanında 4. Son sütun da 2 + 4 = 6. Bütün gruplar tamamlandı.'
  ];
  function renderTutorial() {
    $('tutorial-text').textContent=lessons[tutorialStep];
    $('tutorial-next').textContent=tutorialStep===4?'Bir daha dene':'Sonraki adım';
    tutorialView.update(tutorial);tutorialView.resize();
  }
  $('tutorial-next').addEventListener('click',()=>{
    if(tutorialStep===4){tutorialStep=0;tutorial=K.createState(tutorialBoard);}
    else {
      tutorialStep++;
      if(tutorialStep===1){tutorial={...tutorial,notes:tutorial.notes.map((n,i)=>i===4?Bmask(1,2):n)};}
      if(tutorialStep===2){tutorial=K.applyAction(tutorial,{type:'digit',cell:4,value:1});tutorial=K.applyAction(tutorial,{type:'digit',cell:5,value:2});}
      if(tutorialStep===3)tutorial=K.applyAction(tutorial,{type:'digit',cell:7,value:3});
      if(tutorialStep===4)tutorial=K.applyAction(tutorial,{type:'digit',cell:8,value:4});
    }
    renderTutorial();
  });
  function Bmask(...ds){return ds.reduce((m,n)=>m|K.bit(n),0);}
  $('tutorial-reset').addEventListener('click',()=>{tutorialStep=0;tutorial=K.createState(tutorialBoard);renderTutorial();});
  tutorialView.mount(tutorialBoard,tutorial);renderTutorial();
  openPuzzle(boards.has(preferences.last)?preferences.last:definitions[0].id);
  document.fonts.ready.then(()=>{boardView.resize();K.draw.decorate();});
  setInterval(()=>{if(state)syncClock();},250);
  setInterval(save,5000);
})();
