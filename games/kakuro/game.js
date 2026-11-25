(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./board.js'):root.Kakuro);
  if(typeof module==='object'&&module.exports)module.exports=api;else Object.assign(root.Kakuro,api);
})(typeof globalThis!=='undefined'?globalThis:this,function(B){
  'use strict';
  function createState(board,saved={}) {
    const values=saved.values?[...saved.values]:Array(board.cells.length).fill(0);
    return {board,values,notes:saved.notes?[...saved.notes]:Array(board.cells.length).fill(0),
      selected:board.white.includes(saved.selected)?saved.selected:board.white[0],direction:saved.direction==='down'?'down':'across',
      noteMode:false,history:[],elapsed:saved.elapsed||0,helps:saved.helps||0,helpKeys:saved.helpKeys?[...saved.helpKeys]:[],
      complete:B.validateValues(board,values).complete,revision:0,
      attemptId:saved.attemptId||`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`};
  }
  function applyAction(state,action) {
    if(action.type==='select')return state.board.white.includes(action.cell)?{...state,selected:action.cell,direction:action.direction||state.direction}:state;
    if(action.type==='direction')return ['across','down'].includes(action.direction)?{...state,direction:action.direction}:state;
    if(action.type==='noteMode')return {...state,noteMode:!state.noteMode};
    if(action.type==='help')return state.helpKeys.includes(action.key)?state:{...state,helps:state.helps+1,helpKeys:[...state.helpKeys,action.key]};
    if(action.type==='undo')return undo(state);
    const cell=action.cell??state.selected;
    if(!state.board.white.includes(cell))return state;
    const values=[...state.values],notes=[...state.notes];
    if(action.type==='digit') {
      if(!Number.isInteger(action.value)||action.value<1||action.value>9)return state;
      if(state.noteMode&&!action.force) {if(values[cell])return state;notes[cell]^=B.bit(action.value);}
      else {values[cell]=action.value;notes[cell]=0;}
    } else if(action.type==='erase') {if(values[cell])values[cell]=0;else notes[cell]=0;}
    else return state;
    if(values[cell]===state.values[cell]&&notes[cell]===state.notes[cell])return state;
    const history=[...state.history,{cell,value:state.values[cell],notes:state.notes[cell]}];
    return {...state,values,notes,history,selected:cell,revision:state.revision+1,
      helps:state.helps+(action.assisted?1:0),complete:B.validateValues(state.board,values).complete};
  }
  function undo(state) {
    if(!state.history.length)return state;
    const history=[...state.history],last=history.pop(),values=[...state.values],notes=[...state.notes];
    values[last.cell]=last.value;notes[last.cell]=last.notes;
    return {...state,values,notes,history,selected:last.cell,revision:state.revision+1,complete:B.validateValues(state.board,values).complete};
  }
  function moveSelection(state,dr,dc) {
    const {board}=state;let row=Math.floor(state.selected/board.cols)+dr,col=state.selected%board.cols+dc;
    let selected=state.selected;
    while(row>=0&&row<board.rows&&col>=0&&col<board.cols) {
      const i=row*board.cols+col;if(board.membership[i]){selected=i;break;}row+=dr;col+=dc;
    }
    return {...state,selected,direction:dr?'down':'across'};
  }
  class ActiveClock {
    constructor(elapsed=0,now=()=>performance.now()){this.elapsed=elapsed;this.now=now;this.last=null;}
    start(){if(this.last===null)this.last=this.now();}
    stop(){if(this.last!==null){this.elapsed+=Math.max(0,this.now()-this.last);this.last=null;}return this.elapsed;}
    read(){return this.elapsed+(this.last===null?0:Math.max(0,this.now()-this.last));}
  }
  return {createState,applyAction,undo,moveSelection,ActiveClock};
});
