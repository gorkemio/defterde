/* Optional Node DOM integration check. No browser, layout engine or network.
   Usage: node tools/test-ui.mjs /absolute/path/to/linkedom-worker.mjs
   LinkeDOM 0.18.12 is test-only; never loaded by the game. */
import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import assert from 'node:assert/strict';import {pathToFileURL,fileURLToPath} from 'node:url';
const {parseHTML}=await import(pathToFileURL(process.argv[2]).href),root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const memory=new Map();const storage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};
function boot(entry,{hash='',width=1200,height=844,blocked=false,quota=false}={}){
 const html=fs.readFileSync(path.join(root,entry),'utf8'),dom=parseHTML(html),document=dom.document,bus=document.createElement('event-bus');
 Object.defineProperty(document,'activeElement',{value:null,writable:true});document.fonts={ready:Promise.resolve()};
 Object.defineProperty(dom.HTMLElement.prototype,'clientWidth',{get(){return Math.min(width-70,884);},configurable:true});
 // Deliberate box metrics for event/state tests, not a CSS rendering engine.
 dom.HTMLElement.prototype.getBoundingClientRect=function(){
  const sizes={'catalog-header':width<=800?100:56,'catalog-browse':width<=580?48:132,'catalog-footer':width<=580?88:52,'selection-status':40,'placement-status':20};
  let h=sizes[this.id]||0;
  if(this.classList.contains('game-page-header'))h=44;
  if(this.classList.contains('puzzle-heading'))h=40;
  if(this.classList.contains('play-topline'))h=44;
  if(this.classList.contains('game-controls'))h=width<=580?88:44;
  if(this.hidden||this.closest('[hidden]'))h=0;
  return {width:Math.min(width-70,884),height:h,x:0,y:0,top:0,left:0,right:width-70,bottom:h};
 };
 dom.HTMLElement.prototype.scrollIntoView=function(){};dom.HTMLElement.prototype.focus=function(){document.activeElement=this;};dom.SVGElement.prototype.focus=dom.HTMLElement.prototype.focus;
 Object.defineProperty(dom.HTMLSelectElement.prototype,'value',{configurable:true,get(){return this._testValue??[...this.options].find(o=>o.selected)?.value??this.options[0]?.value??'';},set(v){this._testValue=v;}});
 dom.HTMLSelectElement.prototype.add=function(o){this.append(o);};
 const location={pathname:entry};let currentHash=hash;Object.defineProperty(location,'hash',{get:()=>currentHash,set:v=>{currentHash=v.startsWith('#')?v:'#'+v;bus.dispatchEvent(new dom.Event('hashchange'));}});
 const timers=new Map(),observers=[];let serial=0;
 const context={document,console,innerWidth:width,innerHeight:height,location,history:{replaceState(){}},Event:dom.Event,Element:dom.Element,
  getComputedStyle:e=>({display:e.hidden||e.closest('[hidden]')||e.id==='storage-status'&&!e.textContent?'none':'block',paddingTop:e===document.body||e.classList.contains('sheet')?'12px':'0px',paddingBottom:e===document.body||e.classList.contains('sheet')?'12px':'0px'}),
  ResizeObserver:class{constructor(fn){observers.push(fn);}observe(){}},requestAnimationFrame:f=>{f();return 0;},cancelAnimationFrame(){},
  setTimeout(f){timers.set(++serial,f);return serial;},clearTimeout:id=>timers.delete(id),scrollTo(){},matchMedia:()=>({matches:false}),
  addEventListener:bus.addEventListener.bind(bus),removeEventListener:bus.removeEventListener.bind(bus),dispatchEvent:bus.dispatchEvent.bind(bus),
  Option:function(text,value){const o=document.createElement('option');o.textContent=text;o.value=value;return o;},Blob,URL,
 };
 Object.defineProperty(context,'localStorage',{get(){if(blocked)throw Error('disabled');return quota?{getItem:storage.getItem,setItem(){throw Error('quota');}}:storage;}});context.window=context;
 vm.createContext(context);
 const boards=[];
 for(const match of html.matchAll(/<script defer src="([^"]+)"/g)){vm.runInContext(fs.readFileSync(path.join(root,match[1]),'utf8'),context,{filename:match[1]});if(match[1]==='board.js'){const create=context.Tangram.board.create;context.Tangram.board.create=p=>{const b=create(p);boards.push(b);return b;};}}
 const $=id=>document.getElementById(id),fire=(element,type)=>element.dispatchEvent(new dom.Event(type,{bubbles:true,cancelable:true}));
 return{context,document,$,fire,boards,resize(next,nextHeight=height){width=next;height=nextHeight;context.innerWidth=next;context.innerHeight=height;bus.dispatchEvent(new dom.Event('resize'));observers.forEach(fn=>fn([{contentRect:{width:Math.min(next-70,884)}}]));},click:id=>fire($(id),'click'),go:id=>{location.hash='sekil/'+id;},key:key=>{const e=new dom.Event('keydown',{bubbles:true,cancelable:true});Object.assign(e,{key,ctrlKey:false,metaKey:false,shiftKey:false});(document.activeElement||document.body).dispatchEvent(e);},timers};
}
let app=boot('index.html');assert.equal(app.document.querySelectorAll('.puzzle-link').length,16);
assert.equal(app.$('catalog-page').hidden,false);assert.equal(app.$('play-page').hidden,true);
app.resize(1200,620);assert.ok(app.document.querySelectorAll('.puzzle-link').length<16);app.resize(1200,844);
app.$('search').value='kopekbaligi';app.fire(app.$('search'),'input');assert.equal(app.document.querySelectorAll('.puzzle-link').length,1);
app.click('clear-filters');app.click('next-page');assert.equal(app.$('page-label').textContent,'2 / 8');
app.go('kare');assert.equal(app.$('puzzle-title').textContent,'Kare');assert.equal(app.$('catalog-view').hidden,true);assert.equal(app.$('game-view').hidden,false);
app.click('favorite-puzzle');assert.equal(app.$('favorite-puzzle').getAttribute('aria-pressed'),'true');
app.click('sound');assert.equal(app.$('sound').getAttribute('aria-pressed'),'false');assert.equal(JSON.parse(memory.get('defterde.tangram.play.v1')).preferences.sound,false);
app.key('1');app.key('ArrowRight');
const heldBoard=app.boards.at(-1),beforeResize=JSON.stringify(heldBoard.pieces);
app.resize(390);assert.equal(app.$('catalog-page').hidden,true);assert.equal(app.$('play-page').hidden,false);assert.equal(JSON.stringify(heldBoard.pieces),beforeResize);
app.resize(1440);assert.equal(app.$('catalog-page').hidden,true);assert.equal(app.$('play-page').hidden,false);assert.equal(JSON.stringify(heldBoard.pieces),beforeResize);
const tallScene=parseFloat(app.$('scene').style.height);app.resize(1440,620);assert.ok(parseFloat(app.$('scene').style.height)<tallScene);assert.equal(JSON.stringify(heldBoard.pieces),beforeResize);app.resize(1440,844);
const session=JSON.parse(memory.get('defterde.tangram.play.v1')).sessions.kare;assert.ok(session.pieces.some(p=>p.zone==='board'));
app.click('color-preview');assert.equal(app.$('color-preview').textContent,'Kendi düzenime dön');assert.deepEqual(JSON.parse(memory.get('defterde.tangram.play.v1')).completed,{});app.click('color-preview');
app.click('hint');assert.match(app.$('selection-status').textContent,/Bir kez daha/);app.click('hint');assert.match(app.$('selection-status').textContent,/örnek|Örnek/);
app=boot('index.html',{hash:'#sekil/kare',width:390});assert.equal(app.$('favorite-puzzle').getAttribute('aria-pressed'),'true');assert.equal(app.$('sound').getAttribute('aria-label'),'Sesi aç');assert.match(app.$('selection-status').textContent,/seçili/);
const before=JSON.stringify(JSON.parse(memory.get('defterde.tangram.play.v1')).sessions.kare.pieces);app.click('reset');app.click('undo');assert.equal(JSON.stringify(JSON.parse(memory.get('defterde.tangram.play.v1')).sessions.kare.pieces),before);
const solved=app.context.Tangram.puzzles.find(p=>p.id==='kare').solutions[0];app.boards[0].pieces=solved.map(p=>({...p,zone:'board',homeRotation:p.rotation,homeFlipped:p.flipped}));app.boards[0].check();app.key('1');assert.equal(app.$('completion').hidden,false);assert.ok(JSON.parse(memory.get('defterde.tangram.play.v1')).completed.kare);
app.click('back-to-catalog');assert.equal(app.document.querySelectorAll('.puzzle-link').length,8);assert.equal(app.$('play-page').hidden,true);assert.equal(app.$('catalog-page').hidden,false);
app.resize(1440);assert.equal(app.$('play-page').hidden,true);assert.equal(app.$('catalog-page').hidden,false);app.click('resume-puzzle');assert.equal(app.$('puzzle-title').textContent,'Kare');assert.equal(app.boards[0].result.complete,true);app.click('back-to-catalog');
app.resize(390);assert.equal(app.$('play-page').hidden,true);
app.$('category-select').value='kuslar';app.fire(app.$('category-select'),'change');assert.equal(app.$('categories').querySelector('[data-category="kuslar"]').getAttribute('aria-pressed'),'true');app.click('clear-filters');
app.$('status-filter').value='favorites';app.fire(app.$('status-filter'),'change');assert.equal(app.document.querySelectorAll('.puzzle-link').length,1);
const noStorage=boot('index.html',{blocked:true});assert.match(noStorage.$('storage-status').textContent,/kayıt|kaydedilemiyor/i);noStorage.go('kedi');assert.equal(noStorage.$('puzzle-title').textContent,'Kedi');
const editor=boot('editor.html');editor.$('load-puzzle').value='kare';editor.click('load');assert.match(editor.$('geometry-status').textContent,/Çakışma yok/);editor.fire(editor.$('metadata-form'),'submit');assert.match(editor.$('export-status').textContent,/Geometri ve kopya kontrolü geçti/);assert.equal(JSON.parse(editor.$('export-data').value).id,'kare');
const review=boot('review.html');assert.equal(review.document.querySelectorAll('.review-item').length,10);assert.match(review.document.querySelector('.review-item h2').textContent,/Şekil/);review.$('show-names').checked=true;review.fire(review.$('show-names'),'change');assert.doesNotMatch(review.document.querySelector('.review-item h2').textContent,/Şekil/);review.click('export-review');assert.equal(JSON.parse(review.$('review-data').value).entries.length,120);
const p=app.context.Tangram.puzzles.find(p=>p.id==='kedi'),S=app.context.Tangram.storage,st=S.create(()=>storage);const custom=st.saveDesign('Deneme şeklim',p.solutions[0]);
const design=boot('design.html',{hash:'#'+custom.id});assert.equal(design.$('design-name').value,'Deneme şeklim');assert.equal(design.$('save-design-button').disabled,false);design.$('design-name').value='Yeni ad';design.fire(design.$('save-design'),'submit');assert.match(design.$('design-message').textContent,/kaydedildi/);
const played=boot('index.html',{hash:'#sekil/'+custom.id});assert.equal(played.$('puzzle-title').textContent,'Yeni ad');assert.equal(played.$('edit-design').hidden,false);
const localOnly=boot('design.html',{hash:'#'+custom.id,quota:true});localOnly.fire(localOnly.$('save-design'),'submit');assert.match(localOnly.$('design-message').textContent,/bu oturumda/);localOnly.click('play-design');assert.match(localOnly.$('design-validity').textContent,/Silueti/);assert.equal(localOnly.$('play-design').textContent,'Tasarıma dön');localOnly.click('play-design');assert.equal(localOnly.$('save-design-button').disabled,false);
console.log('DOM integration passed: single active page on desktop/mobile, height-based pagination, height-only resize fits scene and preserves placement, mobile category selection, catalog/search/paging, favorites, resume/reset/undo, preview/hints, sound preference, blocked storage, editor export, blind review report, personal design edit/play. No live browser or layout verification.');
