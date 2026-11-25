// Stable world geometry. Each arm depends only on its prefix outward from the opening.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.Domino ||= {}).layout = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const W = 48, L = 96, LIMIT = 300, ROW = 192;
  const box = (x, y, w, h) => ({ left: x-w/2, top: y-h/2, right:x+w/2, bottom:y+h/2 });
  const center = b => ({x:(b.left+b.right)/2,y:(b.top+b.bottom)/2});
  const edge = (b,d) => ({x:d.x>0?b.right:d.x<0?b.left:(b.left+b.right)/2,
    y:d.y>0?b.bottom:d.y<0?b.top:(b.top+b.bottom)/2});
  function geometry(item, x, y, direction) {
    const double = item.inValue === item.outValue;
    const axis = double ? {x:-direction.y,y:direction.x} : direction;
    const angle = axis.x===1 ? -90 : axis.x===-1 ? 90 : axis.y===1 ? 0 : 180;
    const a = Math.min(item.inValue,item.outValue);
    const bounds = box(x,y,axis.x?L:W,axis.y?L:W);
    const inHalf = box(x-axis.x*W/2,y-axis.y*W/2,W,W);
    const outHalf = box(x+axis.x*W/2,y+axis.y*W/2,W,W);
    return { tileId:item.tileId, inValue:item.inValue,outValue:item.outValue,
      x,y,angle:angle+(item.inValue===a?0:180), direction, double,bounds,
      halves:[{value:item.inValue,bounds:inHalf},{value:item.outValue,bounds:outHalf}],
      inHalf,outHalf,contacts:[] };
  }
  function outgoing(p, side, d) {
    return edge(p.double ? p.bounds : side==='left'?p.inHalf:p.outHalf,d);
  }
  function attach(previous, item, side, direction) {
    const touch=outgoing(previous,side,direction), double=item.inValue===item.outValue;
    const along=double?W:L;
    const logical=side==='left'?{x:-direction.x,y:-direction.y}:direction;
    const p=geometry(item,touch.x+direction.x*along/2,touch.y+direction.y*along/2,logical);
    p.contacts.push({neighbor:previous.tileId,point:touch,value:side==='left'?item.outValue:item.inValue});
    return p;
  }
  function layout(chain, anchorId) {
    if(!chain.length) return {placements:[],bounds:{left:-360,right:360,top:-144,bottom:144},ends:{}};
    const index=chain.findIndex(p=>p.tileId===anchorId);
    if(index<0) throw new Error('Açılış taşı zincirde bulunamadı.');
    const anchor=geometry(chain[index],0,0,{x:1,y:0});
    const placements=[anchor], tips={};
    for(const side of ['left','right']) {
      const sign=side==='left'?-1:1;
      const arm=side==='left'?chain.slice(0,index).reverse():chain.slice(index+1);
      let previous=anchor, horizontal=sign, vertical=false,rowY=0;
      for(const item of arm) {
        if(vertical) {
          const exit=center(previous.double?previous.bounds:side==='left'?previous.inHalf:previous.outHalf);
          if((exit.y-rowY)*sign>=ROW) { vertical=false;horizontal*=-1;rowY=exit.y; }
        }
        let direction=vertical?{x:0,y:sign}:{x:horizontal,y:0};
        let next=attach(previous,item,side,direction);
        if(!vertical && (next.bounds.left < -LIMIT || next.bounds.right > LIMIT)) {
          vertical=true;direction={x:0,y:sign};next=attach(previous,item,side,direction);
        }
        placements.push(next);previous=next;
      }
      const direction=vertical?{x:0,y:sign}:{x:horizontal,y:0};
      tips[side]={...outgoing(previous,side,direction),direction,
        value:side==='left'?previous.inValue:previous.outValue,tileId:previous.tileId};
    }
    // Keep the logical list order separate from the fixed coordinates.
    const map=new Map(placements.map(p=>[p.tileId,p]));
    return {placements:chain.map(p=>map.get(p.tileId)),ends:tips,bounds:{
      left:Math.min(-360,...placements.map(p=>p.bounds.left-100)),
      right:Math.max(360,...placements.map(p=>p.bounds.right+100)),
      top:Math.min(-144,...placements.map(p=>p.bounds.top-90)),
      bottom:Math.max(144,...placements.map(p=>p.bounds.bottom+90))}};
  }
  function overlaps(a,b) {
    return Math.min(a.right,b.right)-Math.max(a.left,b.left)>0.01 &&
      Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>0.01;
  }
  function onEdge(p,b) {
    const inside=p.x>=b.left-.01&&p.x<=b.right+.01&&p.y>=b.top-.01&&p.y<=b.bottom+.01;
    return inside && [p.x-b.left,p.x-b.right,p.y-b.top,p.y-b.bottom].some(n=>Math.abs(n)<.01);
  }
  function validate(result) {
    const errors=[],list=result.placements;
    for(let i=0;i<list.length;i++) {
      const a=list[i];
      for(let j=0;j<i;j++) if(overlaps(a.bounds,list[j].bounds)) errors.push(`overlap ${a.tileId}/${list[j].tileId}`);
      for(const c of a.contacts) {
        const b=list.find(p=>p.tileId===c.neighbor);
        if(!a.halves.some(h=>h.value===c.value&&onEdge(c.point,h.bounds)) ||
           !b.halves.some(h=>h.value===c.value&&onEdge(c.point,h.bounds)))
          errors.push(`contact ${a.tileId}/${b.tileId}`);
      }
    }
    return errors;
  }
  return {layout,validate,W,L,overlaps};
});
