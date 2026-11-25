(function(){
  'use strict';
  const K=window.Kakuro;
  class BoardView {
    constructor(element,viewport,onSelect,onOverflow=()=>{}) {
      this.element=element;this.viewport=viewport;this.onSelect=onSelect;this.onOverflow=onOverflow;this.previous=null;
      element.addEventListener('click',event=>{
        const button=event.target.closest('button[data-index]');if(!button||!this.board)return;
        const i=Number(button.dataset.index),cell=this.board.cells[i];
        if(cell.type==='white')onSelect(i);
        else {
          const rect=button.getBoundingClientRect(),across=(event.clientX-rect.left)/rect.width>(event.clientY-rect.top)/rect.height;
          const direction=cell.across&&(!cell.down||across)?'across':'down';
          const group=this.board.groups.find(g=>g.clue===i&&g.axis===direction);
          onSelect(group.cells[0],direction);
        }
      });
      let frame;
      this.observer=new ResizeObserver(()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>this.resize());});
      this.observer.observe(viewport);
      // Viewport height can change while the board width stays the same.
      window.addEventListener('resize',()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>this.resize());});
    }
    mount(board,state) {
      this.board=board;this.previous=null;this.selected=-1;this.element.replaceChildren();this.nodes=[];
      this.element.style.setProperty('--columns',board.cols);this.element.style.setProperty('--rows',board.rows);
      this.element.setAttribute('aria-rowcount',board.rows);this.element.setAttribute('aria-colcount',board.cols);
      for(let r=0;r<board.rows;r++) {
        const row=document.createElement('div');row.className='board-row';row.setAttribute('role','row');row.setAttribute('aria-rowindex',r+1);
        for(let c=0;c<board.cols;c++) {
          const i=r*board.cols+c,cell=board.cells[i],container=document.createElement('div');
          container.className=`cell ${cell.type}`;container.dataset.index=i;container.setAttribute('role','gridcell');container.setAttribute('aria-colindex',c+1);
          if(cell.type==='white'||cell.across||cell.down) {
            const button=document.createElement('button');button.type='button';button.dataset.index=i;button.tabIndex=-1;
            button.className=cell.type==='white'?'cell-button':'clue-button';
            if(cell.type!=='white') {
              const labels=[];
              for(const axis of ['across','down'])if(cell[axis]) {
                const span=document.createElement('span');span.className=`clue-total clue-${axis}`;span.textContent=cell[axis];span.setAttribute('aria-hidden','true');button.append(span);
                labels.push(`${axis==='across'?'Sağa':'Aşağı'} ${cell[axis]}`);
              }
              button.setAttribute('aria-label',labels.join(', '));
            }
            container.append(button);
          }else container.setAttribute('aria-label','Koyu kare');
          this.nodes[i]=container;row.append(container);
        }
        this.element.append(row);
      }
      K.draw.board(this.element,board);this.update(state);this.resize();
    }
    label(state,i) {
      const pair=this.board.membership[i];
      return `Satır ${Math.floor(i/this.board.cols)+1}, sütun ${i%this.board.cols+1}. ${state.values[i]?`Değer ${state.values[i]}`:'Boş'}.${state.notes[i]?` Notlar: ${K.digits(state.notes[i]).join(', ')}.`:''} Yatay toplam ${this.board.groups[pair.across].total}, dikey toplam ${this.board.groups[pair.down].total}.`;
    }
    update(state,{focus=false,reveal=false,hintCells=[]}={}) {
      if(!this.board)return;
      const pair=this.board.membership[state.selected],active=this.board.groups[pair[state.direction]];
      const crossed=[...this.board.groups[pair.across].cells,...this.board.groups[pair.down].cells];
      const check=K.validateValues(this.board,state.values),badCells=new Set(check.issues.flatMap(i=>i.cells)),badClues=new Set(check.issues.flatMap(i=>i.groups).map(id=>this.board.groups[id].clue));
      for(const i of this.board.white) {
        const container=this.nodes[i],button=container.firstElementChild,selected=i===state.selected;
        if(!this.previous||this.previous.values[i]!==state.values[i]||this.previous.notes[i]!==state.notes[i]) {
          button.querySelectorAll('.cell-value,.cell-notes').forEach(n=>n.remove());
          if(state.values[i])K.draw.value(button,state.values[i],[this.board.id,i]);
          else if(state.notes[i]) {
            const notes=document.createElement('span');notes.className='cell-notes';notes.setAttribute('aria-hidden','true');
            for(let n=1;n<=9;n++){const span=document.createElement('span');span.textContent=state.notes[i]&K.bit(n)?n:'';notes.append(span);}
            button.append(notes);
          }
        }
        container.classList.toggle('selected',selected);container.classList.toggle('crossed',crossed.includes(i));
        container.classList.toggle('active-run',active.cells.includes(i));container.classList.toggle('has-error',badCells.has(i));
        container.classList.toggle('hint-target',hintCells.includes(i));container.setAttribute('aria-selected',selected);
        button.tabIndex=selected?0:-1;button.setAttribute('aria-label',this.label(state,i)+(badCells.has(i)?' Bu kareyi içeren grupta kural ihlali var.':''));
        button.setAttribute('aria-invalid',badCells.has(i));
      }
      for(let i=0;i<this.board.cells.length;i++)if(this.board.cells[i].type==='dark') {
        const clue=this.nodes[i].querySelector('.clue-button');
        if(clue){
          clue.classList.toggle('active-clue',i===active.clue);
          clue.querySelectorAll('.clue-total').forEach(total=>total.classList.toggle('active-total',i===active.clue&&total.classList.contains('clue-'+state.direction)));
          this.nodes[i].classList.toggle('has-error',badClues.has(i));
        }
      }
      if(this.selected!==state.selected||!this.nodes[state.selected].querySelector('.selection-ink')) {
        this.element.querySelectorAll('.selection-ink').forEach(n=>n.remove());K.draw.selection(this.nodes[state.selected].firstElementChild,this.board.id);
      }
      this.selected=state.selected;this.previous={values:[...state.values],notes:[...state.notes]};
      const button=this.nodes[state.selected].firstElementChild;
      if(focus)button.focus({preventScroll:true});if(reveal)this.reveal();
    }
    reveal({vertical=true}={}) {
      const button=this.nodes?.[this.selected]?.firstElementChild;if(!button)return;
      const cell=button.getBoundingClientRect(),view=this.viewport.getBoundingClientRect();
      if(cell.left<view.left+4)this.viewport.scrollLeft-=view.left+4-cell.left;
      else if(cell.right>view.right-4)this.viewport.scrollLeft+=cell.right-view.right+4;
      if(cell.top<view.top+4)this.viewport.scrollTop-=view.top+4-cell.top;
      else if(cell.bottom>view.bottom-4)this.viewport.scrollTop+=cell.bottom-view.bottom+4;
      if(vertical) {
        const visible=button.getBoundingClientRect();
        if(visible.top<8)window.scrollBy({top:visible.top-8,behavior:'instant'});
        else if(visible.bottom>window.innerHeight-8)window.scrollBy({top:visible.bottom-window.innerHeight+8,behavior:'instant'});
      }
    }
    resize() {
      if(!this.board||!this.viewport.clientWidth)return;
      const height=parseFloat(getComputedStyle(this.viewport).maxHeight)||Infinity;
      const fit=Math.min(Math.floor((this.viewport.clientWidth-8)/this.board.cols),Math.floor((height-8)/this.board.rows));
      let size=Math.max(44,Math.min(Math.floor(392/this.board.cols),fit));
      // On wide pages the cells snap to whole printed squares, like the other notebook games.
      const snap=parseFloat(getComputedStyle(this.element).getPropertyValue('--board-snap'))||0;
      if(snap){const grid=Math.max(2*snap,Math.floor(Math.min(Math.floor(432/this.board.cols),fit)/snap)*snap);if(grid<=fit)size=grid;}
      this.element.style.setProperty('--cell-size',`${size}px`);
      const region=this.viewport.closest('.board-region');
      region?.style.setProperty('--board-width',`${size*this.board.cols}px`);
      // Centre the board between the margin and the tools, still on a printed line.
      const room=this.viewport.clientWidth-8-size*this.board.cols;
      region?.style.setProperty('--board-shift',`${snap&&room>0?Math.floor(room/2/snap)*snap:0}px`);
      // Off the grid the board gets plain paper, and the rows below still start on a printed line.
      this.element.classList.toggle('on-grid',Boolean(snap)&&size%snap===0);
      const sq=parseFloat(getComputedStyle(this.element).getPropertyValue('--sq'))||0;
      if(sq&&region)region.style.setProperty('--board-block',`${Math.ceil((this.viewport.offsetHeight-8)/sq-.01)*sq}px`);
      this.onOverflow(this.viewport.scrollWidth>this.viewport.clientWidth||this.viewport.scrollHeight>this.viewport.clientHeight);
      // A resize must not pull the reader away from a hint or the tools.
      this.reveal({vertical:false});
    }
  }
  K.BoardView=BoardView;
})();
