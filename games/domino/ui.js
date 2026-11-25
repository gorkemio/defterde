(function () {
  'use strict';
  const {board:B,match:M,view:V,layout:L,draw:D,ai:A,uiSupport:U}=Domino;
  const $=id=>document.getElementById(id);
  const form=$('setup-form'), viewport=$('board-viewport');
  let game=null,epoch=0,readySeat=null,selected=null,selectedEnd=null,pending=null,search=null;
  let geometry=L.layout([],null),firstCamera=true,lastTile=null,notice='',hintText='';
  let orders=[[],[]],boardNodes=new Map(),scheduled=false;
  let cameraWidth=0,cameraHeight=0;
  const defaults=M.settings(),storageKey='domino-defterde-settings';
  function loadSettings() {
    try {return M.settings(JSON.parse(localStorage.getItem(storageKey)||'null')||{});}
    catch (_) {return defaults;}
  }
  let preferences=loadSettings();
  Kit.malzeme.sec('kursunkalem',{cizim:{animasyon:false}});
  Kit.ses.kur({anahtar:'domino-defterde-muted'});
  const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  const delay=ms=>new Promise(resolve=>setTimeout(resolve,reduced()?0:ms));
  const human=()=>game && (game.settings.mode==='local'||game.board.active===0);
  const visibleSeat=()=>!game?null:game.board.result?0:
    game.settings.mode==='computer'?0:readySeat===game.board.active?readySeat:null;
  const canAct=()=>game&&!game.board.result&&human()&&visibleSeat()===game.board.active&&!pending&&!$('setup').open;
  const announce=text=>{if($('announcement').textContent!==text)$('announcement').textContent=text;};
  const inkButtons=()=>{
    document.querySelectorAll('.word-button').forEach(D.underline);
    document.querySelectorAll('.choice').forEach(D.choice);
  };
  function cancelWork() {epoch++;search?.abort();search=null;pending=null;Kit.ses.durdur();}
  function saveSettings() {
    try {localStorage.setItem(storageKey,JSON.stringify(preferences));}
    catch (_) { /* The in-memory preferences remain usable. */ }
  }
  function resetSelection() {selected=selectedEnd=null;hintText='';}
  function revealSelected() {
    if(selected&&visibleSeat()!==null)
      $('hand').querySelector(`[data-tile="${selected}"]`)?.scrollIntoView({block:'nearest',inline:'nearest'});
  }
  function prepareTurn() {
    resetSelection();notice='';
    if(game&&!game.board.chain.length&&human()&&visibleSeat()!==null) {
      selected=game.board.opening.tileId;selectedEnd='start';
    }
  }
  function updateSetup() {
    const local=form.elements.mode.value==='local';
    $('second-name-label').hidden=!local;
    $('difficulty-label').hidden=local;
    $('difficulty-label').disabled=local;
    inkButtons();
  }
  function openSetup() {
    cancelWork();hintText='';
    const s=game?.settings||preferences;
    form.elements.mode.value=s.mode;form.elements.difficulty.value=s.difficulty;
    form.elements.target.value=String(s.target);form.elements.firstName.value=s.names[0];
    form.elements.secondName.value=s.mode==='local'?s.names[1]:'İkinci oyuncu';
    $('setup-cancel').hidden=!game;updateSetup();
    if($('handover').open)$('handover').close();
    $('setup').showModal();render();inkButtons();
  }
  function begin() {
    preferences=M.settings({mode:form.elements.mode.value,difficulty:form.elements.difficulty.value,
      target:form.elements.target.value,names:[form.elements.firstName.value,form.elements.secondName.value]});
    saveSettings();$('setup').close();start();
  }
  // Like the other Defterde games, a new match starts at once with the remembered settings.
  function start() {
    cancelWork();
    if($('handover').open)$('handover').close();
    const seed=new Uint32Array(1);crypto.getRandomValues(seed);
    game=M.create(preferences,seed[0]);readySeat=game.settings.mode==='computer'?0:null;
    orders=[[],[]];lastTile=null;boardNodes.clear();$('chain').replaceChildren();firstCamera=true;
    prepareTurn();render();driveSoon();
  }
  function orderedHand(seat) {
    const hand=game.board.hands[seat],ids=new Set(hand.map(t=>t.id));
    orders[seat]=orders[seat].filter(id=>ids.has(id));
    for(const tile of hand) if(!orders[seat].includes(tile.id)) orders[seat].push(tile.id);
    return orders[seat].map(id=>B.byId[id]);
  }
  function select(tileId) {
    if(!canAct())return;
    const moves=B.legal(game.board).filter(m=>m.tileId===tileId);
    if(!moves.length){announce('Bu taş açık uçlara uymuyor. Altı çizili bir taş seç.');return;}
    if(selected===tileId){resetSelection();}
    else {selected=tileId;selectedEnd=moves.length===1?moves[0].end:null;hintText='';}
    notice='';renderSelection();
  }
  function renderHand() {
    const seat=visibleSeat(),strip=$('hand');
    if(seat===null){
      strip.replaceChildren();strip.setAttribute('aria-label','Taşlar kapalı');
      $('hand-name').textContent='Taşlar kapalı';$('hand-count').textContent='';return;
    }
    const region=document.querySelector('.hand-region');
    region.classList.toggle('seat-0',seat===0);region.classList.toggle('seat-1',seat===1);
    const hand=orderedHand(seat),moves=canAct()?B.legal(game.board):[];
    const existing=new Map([...strip.children].map(el=>[el.dataset.tile,el]));
    const nodes=[];
    for(const tile of hand) {
      let button=existing.get(tile.id);
      if(!button) {
        button=document.createElement('button');button.type='button';button.className='hand-tile';
        button.dataset.tile=tile.id;button.append(D.tile(tile.id,tile.a,tile.b),D.selection(tile.id));
        button.addEventListener('click',()=>select(tile.id));
      }
      const legal=moves.some(m=>m.tileId===tile.id);
      button.setAttribute('aria-label',`${D.label(tile.a,tile.b)}${game.board.result?'':legal?', oynanabilir':', şu an oynanamaz'}`);
      button.setAttribute('aria-disabled',String(!legal));
      if(legal&&!button.querySelector('.playable-mark'))button.append(D.playable(tile.id));
      if(!legal)button.querySelector('.playable-mark')?.remove();
      nodes.push(button);
    }
    U.reconcileChildren(strip,nodes);
    $('hand-name').textContent=game.settings.names[seat];$('hand-count').textContent=`${hand.length} taş`;
    region.setAttribute('aria-label',`${game.settings.names[seat]} taşları`);
    strip.setAttribute('aria-label',`${game.settings.names[seat]}: ${hand.length} taş. Ok tuşlarıyla gez, Enter veya boşlukla seç.`);
  }
  function renderOpponent() {
    const seat=visibleSeat(),opponent=seat===null?null:1-seat,container=$('opponent-tiles');
    container.replaceChildren();
    if(opponent===null) {
      $('opponent-name').textContent='Taşlar kapalı';$('opponent-count').textContent='';
      container.setAttribute('aria-label','Kapalı eller');
      document.querySelector('.opponent').setAttribute('aria-label','Rakibin kapalı taşları');return;
    }
    const hand=game.board.hands[opponent],open=Boolean(game.board.result),side=document.querySelector('.opponent');
    $('opponent-name').textContent=game.settings.names[opponent];$('opponent-count').textContent=`${hand.length} taş`;
    side.classList.toggle('seat-0',opponent===0);side.classList.toggle('seat-1',opponent===1);
    side.setAttribute('aria-label',`${game.settings.names[opponent]} taşları`);
    container.classList.toggle('revealed',open);
    container.setAttribute('aria-label',`${game.settings.names[opponent]}: ${hand.length} ${open?'açık':'kapalı'} taş`);
    if(open) for(const tile of hand) {
      const node=D.tile(tile.id,tile.a,tile.b);node.setAttribute('role','img');node.setAttribute('aria-label',D.label(tile.a,tile.b));container.append(node);
    } else for(let i=0;i<Math.min(hand.length,12);i++)container.append(D.tile(`opponent-slot-${i}`,0,0,true,D.seatColor(opponent)));
  }
  function placeNode(p,preview=false) {
    const el=document.createElement('div');el.className=`placed${preview?' preview-tile':''}`;
    el.dataset.tile=p.tileId;
    const tile=B.byId[p.tileId];el.append(D.tile(tile.id,tile.a,tile.b));
    if(!preview){el.setAttribute('role','listitem');el.setAttribute('aria-label',D.label(p.inValue,p.outValue));}
    return el;
  }
  function position(el,p) {
    el.style.left=`${p.x}px`;el.style.top=`${p.y}px`;el.style.transform=`rotate(${p.angle}deg)`;
    el.dataset.angle=p.angle;el.dataset.in=p.inValue;el.dataset.out=p.outValue;
  }
  function prospective() {
    if(!game||!selected||!selectedEnd)return null;
    const tile=B.byId[selected],chain=game.board.chain.slice();
    if(selectedEnd==='start')chain.push({tileId:tile.id,inValue:tile.a,outValue:tile.b});
    else {
      const value=B.ends(game.board)[selectedEnd==='left'?0:1],other=tile.a===value?tile.b:tile.a;
      const p={tileId:tile.id,inValue:selectedEnd==='left'?other:value,outValue:selectedEnd==='left'?value:other};
      if(selectedEnd==='left')chain.unshift(p);else chain.push(p);
    }
    return L.layout(chain,game.board.anchorId||selected);
  }
  function renderBoard() {
    const previous=geometry.bounds;
    const focus={x:viewport.scrollLeft+(cameraWidth||viewport.clientWidth)/2+previous.left,
      y:viewport.scrollTop+(cameraHeight||viewport.clientHeight)/2+previous.top};
    cameraWidth=viewport.clientWidth;cameraHeight=viewport.clientHeight;
    geometry=L.layout(game?.board.chain||[],game?.board.anchorId);
    const preview=prospective(),bounds=preview?{
      left:Math.min(preview.bounds.left,geometry.bounds.left),right:Math.max(preview.bounds.right,geometry.bounds.right),
      top:Math.min(preview.bounds.top,geometry.bounds.top),bottom:Math.max(preview.bounds.bottom,geometry.bounds.bottom)}:geometry.bounds;
    geometry.bounds=bounds;
    const extraWidth=Math.max(0,viewport.clientWidth-(bounds.right-bounds.left));
    const extraHeight=Math.max(0,viewport.clientHeight-(bounds.bottom-bounds.top));
    bounds.left-=extraWidth/2;bounds.right+=extraWidth/2;
    bounds.top-=extraHeight/2;bounds.bottom+=extraHeight/2;
    for(const p of geometry.placements) {
      let node=boardNodes.get(p.tileId);
      if(!node){node=placeNode(p);node.classList.add('is-new');boardNodes.set(p.tileId,node);$('chain').append(node);}
      position(node,p);node.classList.toggle('last-played',p.tileId===lastTile);
      node.setAttribute('aria-label',`${D.label(p.inValue,p.outValue)}${p.tileId===lastTile?', son oynanan taş':''}`);
    }
    // DOM order remains the public logical chain order, even when prepending left.
    U.reconcileChildren($('chain'),geometry.placements.map(p=>boardNodes.get(p.tileId)));
    $('placement-preview').replaceChildren();
    if(preview) {const p=preview.placements.find(p=>p.tileId===selected),node=placeNode(p,true);position(node,p);$('placement-preview').append(node);}
    $('board-empty').hidden=Boolean(game?.board.chain.length||preview);
    $('board-space').style.width=`${Math.max(720,bounds.right-bounds.left,viewport.clientWidth)}px`;
    $('board-space').style.height=`${Math.max(bounds.bottom-bounds.top,viewport.clientHeight)}px`;
    $('board-world').style.left=`${-bounds.left}px`;$('board-world').style.top=`${-bounds.top}px`;
    const target=firstCamera?{x:0,y:0}:focus;
    viewport.scrollLeft=target.x-bounds.left-viewport.clientWidth/2;
    viewport.scrollTop=target.y-bounds.top-viewport.clientHeight/2;
    firstCamera=false;
    for(const side of ['left','right']) {
      const button=$(`end-${side}`),tip=geometry.ends[side];
      button.hidden=!tip;
      if(tip) {
        button.style.left=`${tip.x+tip.direction.x*36-38}px`;
        button.style.top=`${tip.y+tip.direction.y*36-24}px`;
        button.querySelector('.end-number').textContent=tip.value;
        button.setAttribute('aria-label',`${side==='left'?'Sol':'Sağ'} uç ${tip.value}`);
      }
      const jump=document.querySelector(`[data-jump="${side}"]`);
      jump.disabled=!tip;
      jump.querySelector('.yazi').textContent=side==='left'?`← Sol uç${tip?' · '+tip.value:''}`:`Sağ uç${tip?' · '+tip.value:''} →`;
    }
  }
  function jump(side) {
    const tip=geometry.ends[side];
    if(!tip)return;
    viewport.scrollTo({left:tip.x-geometry.bounds.left-viewport.clientWidth/2,
      top:tip.y-geometry.bounds.top-viewport.clientHeight/2,behavior:reduced()?'instant':'smooth'});
    const button=$(`end-${side}`);
    if(!button.disabled)button.focus({preventScroll:true});else viewport.focus({preventScroll:true});
  }
  function renderSelection() {
    const moves=canAct()?B.legal(game.board):[];
    document.querySelectorAll('.hand-tile').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.tile===selected)));
    for(const side of ['left','right']) {
      const button=$(`end-${side}`);
      button.disabled=!selected||!moves.some(m=>m.tileId===selected&&m.end===side);
      button.setAttribute('aria-pressed',String(selectedEnd===side));
    }
    $('clear').disabled=!selected||!!pending;
    $('play').disabled=!canAct()||!moves.some(m=>m.tileId===selected&&m.end===selectedEnd);
    $('sort').disabled=!canAct();$('hint').disabled=!canAct()||!moves.length;
    $('draw').disabled=!canAct()||!!moves.length||!game?.board.stock.length;
    let text='Yeni bir maçla başlayalım.',title='Domino';
    if(game) {
      const active=game.board.active,name=game.settings.names[active];
      title=game.board.result?'El bitti':game.settings.mode==='computer'?active===0?'Sıra sende':'Bilgisayar oynuyor':`Sıra: ${name}`;
      text=game.board.result?'Taşlar açıldı.':visibleSeat()===null?'Taşlar kapalı.':
        pending==='hint'?'İpucu düşünüyor…':pending==='computer'?notice||'Düşünüyor…':
        pending==='draw'?notice||'Taşlar çekiliyor…':notice||selected?
          notice||`${D.label(B.byId[selected].a,B.byId[selected].b)} · ${selectedEnd==='start'?'Açılış taşı':selectedEnd?selectedEnd==='left'?'Sol uca':'Sağ uca':'Bir uç seç'}`:
          !moves.length&&human()?game.board.stock.length?'Uygun taşın yok · Taş çek':'Havuz boş · Sıra geçecek':
          'Bir taş seç';
      $('turn-title').className=`turn-title ${game.board.result?'done':'seat-'+active}`;
    }
    $('turn-title').textContent=title;
    $('turn-note').textContent=text;
    announce(game?.board.result?U.resultCopy(game).announcement:`${title}. ${text}`);
    $('selection-note').textContent=hintText||(!selected?'Altı çizili taşlar oynanabilir.':
      selectedEnd?'Yerleşim hazır · Oyna ile onayla.':'Bu taş iki uca da uyuyor.');
    renderBoard();inkButtons();
  }
  function renderResult() {
    const r=game?.board.result;$('result').hidden=!r;
    document.querySelector('.move-actions').hidden=Boolean(r);
    if(!r)return;
    const copy=U.resultCopy(game);
    $('result-title').textContent=copy.title;
    $('result-title').className=r.winner===null?'':`seat-${r.winner}`;
    $('result-detail').textContent=copy.detail;
    $('next-round').hidden=Boolean(game.result);
  }
  function render() {
    document.querySelector('main').setAttribute('aria-busy',String(Boolean(pending)));
    if(game) {
      for(let i=0;i<2;i++) {$(`name-${i}`).textContent=game.settings.names[i];$(`score-${i}`).textContent=game.scores[i];}
      $('target').textContent=`${game.settings.target?game.settings.target+' puana kadar':'Tek el'} · ${game.round}. el`;
      $('stock-count').textContent=game.board.stock.length;
      $('stock-drawing').style.opacity=game.board.stock.length?'1':'.25';
    }
    const settings=game?.settings||preferences;
    const difficulty={easy:'Kolay',medium:'Orta',hard:'Zor'}[settings.difficulty];
    $('settings-note').textContent=`${settings.mode==='local'?'Aynı cihazda iki kişi':'Bilgisayara karşı · '+difficulty} · ${settings.target?settings.target+' puan':'Tek el'}`;
    renderHand();renderOpponent();renderResult();renderSelection();
    renderSound();
  }
  function renderSound() {
    const on=!Kit.ses.sessiz,button=$('sound');
    if(button.dataset.on===String(on))return;
    button.dataset.on=String(on);button.setAttribute('aria-pressed',String(on));
    button.setAttribute('aria-label',on?'Sesi kapat':'Sesi aç');button.title=on?'Sesi kapat':'Sesi aç';
    button.querySelector('.sound-text').textContent=on?'Ses açık':'Ses kapalı';
    D.soundIcon($('sound-icon'),on);
  }
  function applyAction(action) {
    const oldSeat=game.board.active,changed=M.apply(game,action);
    game=changed.state;resetSelection();notice='';
    if(action.type==='play') {lastTile=action.tileId;Kit.ses.cal('tas');}
    if(action.type==='draw')Kit.ses.cal('kayma');
    if(game.settings.mode==='local'&&oldSeat!==game.board.active&&!game.board.result) {
      readySeat=null;$('hand').replaceChildren();$('opponent-tiles').replaceChildren();
    }
    if(game.board.result) {
      if($('handover').open)$('handover').close();
      readySeat=0;
    }
    render();
    if(game.board.result)U.announceResult(document,U.resultCopy(game));
  }
  function still(token,revision) {return token===epoch && !game?.board.result && !$('setup').open &&
    (revision===undefined||game.board.revision===revision);}
  function driveSoon() {
    if(scheduled)return;scheduled=true;
    queueMicrotask(()=>{scheduled=false;drive().catch(showError);});
  }
  function showError(error) {
    pending=null;notice='Bir işlem tamamlanamadı. Yeniden deneyebilir veya yeni maç açabilirsin.';
    render();console.error(error);
  }
  async function forcedDraw(token,computer) {
    let drawn=0,last=null;
    while(still(token)&&!B.legal(game.board).length&&game.board.stock.length) {
      applyAction({type:'draw',player:game.board.active});
      drawn++;last=game.board.hands[game.board.active].at(-1).id;
      notice=`${drawn} taş çekildi.`;renderSelection();await delay(150);
    }
    if(!still(token))return;
    if(!computer&&last&&B.legal(game.board).some(m=>m.tileId===last)) {
      selected=last;const moves=B.legal(game.board).filter(m=>m.tileId===last);
      selectedEnd=moves.length===1?moves[0].end:null;
    }
    notice=drawn?`${drawn} taş çekildi${B.legal(game.board).length?' · Uygun taş hazır.':'.'}`:'';
  }
  async function drive() {
    if(!game||game.board.result||pending||$('setup').open)return;
    if(game.settings.mode==='local'&&readySeat!==game.board.active) {
      $('hand').replaceChildren();$('opponent-tiles').replaceChildren();
      $('handover-name').textContent=`Cihazı ${game.settings.names[game.board.active]} kişisine ver.`;
      if(!$('handover').open)$('handover').showModal();
      inkButtons();return;
    }
    const token=epoch;
    if(!human()) {
      pending='computer';render();
      try {
        if(!B.legal(game.board).length&&game.board.stock.length)await forcedDraw(token,true);
        if(!still(token))return;
        const moves=B.legal(game.board);
        if(moves.length) {
          const revision=game.board.revision;search=new AbortController();
          const answer=await A.choose(V.player(game,game.board.active),game.settings.difficulty,
            {seed:aiSeed(),budgetMs:600,signal:search.signal});
          await delay(120);
          if(still(token,revision)&&!answer.cancelled&&answer.move&&B.legal(game.board).some(m=>m.tileId===answer.move.tileId&&m.end===answer.move.end))
            applyAction({type:'play',player:game.board.active,...answer.move});
        } else {
          notice='Bilgisayarın hamlesi yok · Pas.';renderSelection();await delay(650);
          if(still(token))applyAction({type:'pass',player:game.board.active});
        }
      } finally {
        if(token===epoch){pending=null;search=null;prepareTurn();render();driveSoon();}
      }
    } else if(!B.legal(game.board).length&&!game.board.stock.length) {
      pending='pass';notice='Havuz boş ve uygun taş yok · Pas.';render();
      await delay(900);
      if(still(token)) {applyAction({type:'pass',player:game.board.active});pending=null;prepareTurn();render();driveSoon();}
    }
  }
  function aiSeed() {const value=new Uint32Array(1);crypto.getRandomValues(value);return value[0];}
  async function hint() {
    if(!canAct()||!B.legal(game.board).length)return;
    const token=epoch,revision=game.board.revision;
    pending='hint';search=new AbortController();render();
    try {
      const answer=await A.choose(V.player(game,game.board.active),'hard',{seed:aiSeed(),budgetMs:600,signal:search.signal});
      if(still(token,revision)&&answer.move&&!answer.cancelled) {
        selected=answer.move.tileId;selectedEnd=answer.move.end;
        hintText='İpucu · Olası ellere göre yaklaşık öneri.';
      }
    } finally {
      if(token===epoch){pending=null;search=null;render();revealSelected();if(selectedEnd!=='start')jump(selectedEnd);}
    }
  }
  form.addEventListener('submit',e=>{e.preventDefault();begin();});
  form.addEventListener('change',updateSetup);
  $('new-match').addEventListener('click',start);$('result-new').addEventListener('click',start);
  $('settings-open').addEventListener('click',openSetup);
  function cancelSetup() {
    if(!game)return;
    $('setup').close();render();driveSoon();
  }
  $('setup-cancel').addEventListener('click',cancelSetup);
  $('setup').addEventListener('cancel',e=>{e.preventDefault();cancelSetup();});
  $('handover').addEventListener('cancel',e=>e.preventDefault());
  $('ready').addEventListener('click',()=>{
    readySeat=game.board.active;$('handover').close();prepareTurn();render();driveSoon();
    const first=$('hand').querySelector(`[data-tile="${selected}"]`)||$('hand').querySelector('button');
    first?.focus();first?.scrollIntoView({block:'nearest',inline:'nearest'});
  });
  $('play').addEventListener('click',()=>{
    if(!canAct())return;
    if(!B.legal(game.board).some(m=>m.tileId===selected&&m.end===selectedEnd))return;
    const end=selectedEnd;applyAction({type:'play',player:game.board.active,tileId:selected,end});
    if(!game.board.result&&end!=='start')jump(end);
    prepareTurn();render();driveSoon();
  });
  $('draw').addEventListener('click',async()=>{
    if(!canAct()||B.legal(game.board).length||!game.board.stock.length)return;
    const token=epoch;pending='draw';resetSelection();render();
    try {await forcedDraw(token,false);}
    catch(error){showError(error);}
    finally {if(token===epoch){pending=null;render();revealSelected();driveSoon();}}
  });
  $('hint').addEventListener('click',()=>hint().catch(showError));
  $('clear').addEventListener('click',()=>{resetSelection();notice='';renderSelection();});
  $('sort').addEventListener('click',()=>{
    if(!canAct())return;
    const seat=visibleSeat();orders[seat]=orderedHand(seat).sort((a,b)=>a.a-b.a||a.b-b.b).map(t=>t.id);
    renderHand();renderSelection();announce('Taşlar küçük sayıdan büyüğe sıralandı.');
  });
  $('next-round').addEventListener('click',()=>{
    cancelWork();game=M.nextRound(game);readySeat=game.settings.mode==='computer'?0:null;
    orders=[[],[]];lastTile=null;boardNodes.clear();$('chain').replaceChildren();firstCamera=true;
    prepareTurn();render();driveSoon();
  });
  document.querySelectorAll('[data-end]').forEach(button=>button.addEventListener('click',()=>{
    if(!canAct()||!selected||!B.legal(game.board).some(m=>m.tileId===selected&&m.end===button.dataset.end))return;
    selectedEnd=button.dataset.end;notice='';renderSelection();
  }));
  document.querySelectorAll('[data-jump]').forEach(button=>button.addEventListener('click',()=>jump(button.dataset.jump)));
  $('hand').addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    const buttons=[...$('hand').querySelectorAll('button')],index=buttons.indexOf(document.activeElement);
    if(index<0)return;event.preventDefault();
    const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:
      (index+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;
    buttons[next].focus();buttons[next].scrollIntoView({block:'nearest',inline:'nearest'});
  });
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&!document.querySelector('dialog[open]')&&!pending) {resetSelection();notice='';renderSelection();}
  });
  $('help-open').addEventListener('click',()=>{$('help').showModal();inkButtons();});
  $('sound').addEventListener('click',()=>{Kit.ses.sessizYap(!Kit.ses.sessiz);render();});
  for(const event of ['pointerdown','keydown'])document.addEventListener(event,()=>Kit.ses.baslat(),{passive:true});
  const guide=()=>D.guide(document.querySelector('.board-guide'),viewport.clientWidth,viewport.clientHeight);
  D.decorations();
  [-7,4,-2].forEach((angle,i)=>{
    const tile=D.tile(`stock-slot-${i}`,0,0,true,'#555555');
    tile.style.transform=`translate(${i*6}px, ${-i*3}px) rotate(${angle}deg)`;$('stock-drawing').append(tile);
  });
  new ResizeObserver(()=>{guide();renderBoard();inkButtons();}).observe(viewport);
  document.fonts.ready.then(()=>{renderBoard();inkButtons();});
  form.elements.mode.value=preferences.mode;form.elements.difficulty.value=preferences.difficulty;
  form.elements.target.value=String(preferences.target);
  guide();start();
})();
