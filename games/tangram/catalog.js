(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.Tangram.catalog=factory();})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const fold=text=>String(text).toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i');
 const done=(state,id)=>Object.hasOwn(state.completed||{},id);
 function filter(puzzles,{query='',category='all',difficulty='all',status='all'}={},state={}){
  const words=fold(query.trim()).split(/\s+/).filter(Boolean);
  return puzzles.filter(p=>(category==='all'||p.category===category)&&(difficulty==='all'||p.difficulty===difficulty)
   &&(status!=='completed'||done(state,p.id))&&(status!=='incomplete'||!done(state,p.id))
   &&(status!=='favorites'||state.favorites?.includes(p.id))
   &&words.every(w=>fold([p.name,...p.tags].join(' ')).includes(w)));
 }
 function page(items,number,size){const pages=Math.max(1,Math.ceil(items.length/size));number=Math.max(0,Math.min(pages-1,number));return{items:items.slice(number*size,(number+1)*size),number,pages,total:items.length};}
 function capacity(width,height){const columns=width>=740?4:width>=520?3:2,rows=Math.max(1,Math.min(4,Math.floor(Math.max(0,height)/136)));return{columns,rows,size:columns*rows};}
 function random(items,state,rng=Math.random){const unfinished=items.filter(p=>!done(state,p.id)),pool=unfinished.length?unfinished:items;return pool[Math.floor(rng()*pool.length)]||null;}
 function next(items,current,state){const category=items.filter(p=>p.category===current.category),start=category.findIndex(p=>p.id===current.id);
  for(let i=1;i<category.length;i++){const p=category[(start+i)%category.length];if(!done(state,p.id))return p;}return null;}
 return Object.freeze({fold,filter,page,capacity,random,next,done});
});
