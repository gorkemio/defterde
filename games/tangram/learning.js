(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./geometry.js'));else root.Tangram.learning=factory(root.Tangram.geometry);})(typeof globalThis==='object'?globalThis:this,function(G){
 'use strict';
 function same(a,b){if(G.byId[a.pieceId].type!==G.byId[b.pieceId].type)return false;
  const points=G.transformPiece(b);return G.transformPiece(a).every(p=>points.some(q=>Math.hypot(p[0]-q[0],p[1]-q[1])<1e-6));}
 function hint(puzzle,poses){
  const placed=poses.filter(p=>p.zone==='board');
  const scored=puzzle.solutions.map(solution=>{const matched=new Set(),used=new Set();
   placed.forEach(p=>{const i=solution.findIndex((q,i)=>!matched.has(i)&&same(p,q));if(i>=0){matched.add(i);used.add(p.pieceId);}});
   return{solution,matched,used};}).sort((a,b)=>b.matched.size-a.matched.size);
  const best=scored[0];if(best.matched.size===7)return null;
  const target=best.solution.find((p,i)=>!best.matched.has(i));
  const piece=poses.find(p=>!best.used.has(p.pieceId)&&G.byId[p.pieceId].type===G.byId[target.pieceId].type);
  return{pieceId:piece.pieceId,pose:{...target,pieceId:piece.pieceId},example:best.matched.size!==placed.length};
 }
 return Object.freeze({same,hint});
});
