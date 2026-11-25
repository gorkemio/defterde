(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./board.js'):root.Kakuro);
  if(typeof module==='object'&&module.exports)module.exports=api;else Object.assign(root.Kakuro,api);
})(typeof globalThis!=='undefined'?globalThis:this,function(B){
  'use strict';
  const PREFIX='defterde.kakuro.v1.';
  const bounded=(n,max=Number.MAX_SAFE_INTEGER)=>Number.isFinite(n)&&n>=0&&n<=max;
  function validSession(board,s) {
    if(!s||s.version!==board.definition.version||!Array.isArray(s.values)||!Array.isArray(s.notes)||
      s.values.length!==board.cells.length||s.notes.length!==board.cells.length)return false;
    for(let i=0;i<s.values.length;i++) {
      if(!Number.isInteger(s.values[i])||s.values[i]<0||s.values[i]>9||
        !Number.isInteger(s.notes[i])||s.notes[i]<0||s.notes[i]>511)return false;
      if(!board.membership[i]&&(s.values[i]||s.notes[i]))return false;
      if(s.values[i]&&s.notes[i])return false;
    }
    return bounded(s.elapsed)&&Number.isInteger(s.helps)&&bounded(s.helps,1000000)&&
      typeof s.attemptId==='string'&&s.attemptId.length<100&&
      board.white.includes(s.selected)&&['across','down'].includes(s.direction)&&
      Array.isArray(s.helpKeys)&&s.helpKeys.length<=10000&&s.helpKeys.every(k=>typeof k==='string'&&k.length<10000);
  }
  class GameStorage {
    constructor(provider) {
      this.provider=provider;this.memory=new Map();this.available=Boolean(provider);
      this.corrupt=new Set();this.conflicts=new Set();this.observed=new Map();this.latest=new Map();
      this.writer=`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    }
    read(key) {
      if(!this.available)return this.memory.get(key)??null;
      try {
        const value=this.provider.getItem(PREFIX+key);
        this.latest.set(key,value);
        if(!this.observed.has(key))this.observed.set(key,value);
        if(value===null||value===undefined)return null;
        const parsed=JSON.parse(value);this.memory.set(key,parsed);return parsed;
      } catch(error) {
        if(error instanceof SyntaxError){this.corrupt.add(key);return null;}
        this.available=false;
        return this.memory.get(key)??null;
      }
    }
    write(key,value) {
      this.memory.set(key,value);
      if(!this.available)return;
      try {
        const raw=JSON.stringify(value);this.provider.setItem(PREFIX+key,raw);
        this.observed.set(key,raw);this.latest.set(key,raw);
      }
      catch {this.available=false;}
    }
    load(board,{adopt=true}={}) {
      const record=this.read(board.id);
      if(adopt){
        this.observed.set(board.id,this.latest.get(board.id)??null);
        this.conflicts.delete(board.id);
      }
      if(!record)return null;
      if(!validSession(board,record.session)){this.corrupt.add(board.id);return null;}
      return record.session;
    }
    hasConflict(board) {
      if(this.conflicts.has(board.id))return true;
      if(!this.available)return false;
      try {
        const current=this.provider.getItem(PREFIX+board.id);
        if(!this.observed.has(board.id))this.observed.set(board.id,current);
        else if(current!==this.observed.get(board.id))this.conflicts.add(board.id);
      }catch{this.available=false;}
      return this.conflicts.has(board.id);
    }
    attempts(board) {
      const list=this.read(board.id)?.attempts;
      return Array.isArray(list)?list.filter(a=>a&&typeof a.id==='string'&&bounded(a.elapsed)&&Number.isInteger(a.helps)&&bounded(a.helps,1000000)):[];
    }
    save(state,elapsed) {
      const {board}=state;
      const session={version:board.definition.version,values:state.values,notes:state.notes,selected:state.selected,
        direction:state.direction,elapsed,helps:state.helps,helpKeys:state.helpKeys,attemptId:state.attemptId};
      if(!validSession(board,session))return false;
      // Check before reading attempts: a list refresh must not adopt a newer
      // record as the baseline of an older in-memory game.
      if(this.hasConflict(board))return false;
      const previous=this.read(board.id);
      const attempts=this.attempts(board).filter(a=>a.id!==state.attemptId);
      if(B.validateValues(board,state.values).complete)attempts.push({id:state.attemptId,elapsed,helps:state.helps});
      if(JSON.stringify(previous?.session)===JSON.stringify(session)&&JSON.stringify(previous?.attempts)===JSON.stringify(attempts))return true;
      this.write(board.id,{session,attempts,revision:(Number.isSafeInteger(previous?.revision)?previous.revision:0)+1,writer:this.writer});return true;
    }
    preferences() {
      const p=this.read('preferences')||{};
      return {last:typeof p.last==='string'?p.last:null,difficulty:['kolay','orta','zor'].includes(p.difficulty)?p.difficulty:'kolay',sound:typeof p.sound==='boolean'?p.sound:true};
    }
    savePreferences(preferences){this.write('preferences',preferences);}
  }
  return {GameStorage,validSession,STORAGE_PREFIX:PREFIX};
});
