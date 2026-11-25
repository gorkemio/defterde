/* Peces 5.2 fig/t7.fig -> canonical tangram poses. No game runtime dependency.
   Only named, manually curated records are imported. Source data: GPL-2.0-or-later.
   Positions in Peces are rounded decimals: recover nearby contact constraints,
   then demand the game's strict geometry validator (never relax its tolerance). */
'use strict';
const fs=require('node:fs'),G=require('../../geometry.js');
const base={1:[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]],
  2:[[2/3,1/3],[-1/3,1/3],[-1/3,-2/3]],
  3:[[2*Math.SQRT2/3,Math.SQRT2/3],[-Math.SQRT2/3,Math.SQRT2/3],[-Math.SQRT2/3,-2*Math.SQRT2/3]],
  4:[[4/3,2/3],[-2/3,2/3],[-2/3,-4/3]],
  5:[[0,.5],[-1,.5],[0,-.5],[1,-.5]]};
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
function repair(poses,threshold=.06){
  const polys=poses.map(G.transformPiece),constraints=[];
  for(let i=0;i<7;i++)for(let j=i+1;j<7;j++){
    for(const [a,b,ai,bi] of [[polys[i],polys[j],i,j],[polys[j],polys[i],j,i]]){
      for(const p of a)for(let k=0;k<b.length;k++){
        const q=b[k],r=b[(k+1)%b.length],dx=r[0]-q[0],dy=r[1]-q[1],length=Math.hypot(dx,dy);
        const t=((p[0]-q[0])*dx+(p[1]-q[1])*dy)/(length*length);
        const nx=-dy/length,ny=dx/length,d=nx*(q[0]-p[0])+ny*(q[1]-p[1]);
        if(t<-.02||t>1.02||Math.abs(d)>threshold)continue;
        const row=Array(14).fill(0);row[ai*2]=nx;row[ai*2+1]=ny;row[bi*2]=-nx;row[bi*2+1]=-ny;
        constraints.push({row,d});
      }
    }
  }
  constraints.sort((a,b)=>Math.abs(a.d)-Math.abs(b.d));
  const basis=[],values=[];
  for(const {row,d} of constraints){
    let v=[...row],rhs=d;
    basis.forEach((q,i)=>{const c=dot(v,q);v=v.map((x,j)=>x-c*q[j]);rhs-=c*values[i];});
    const norm=Math.sqrt(dot(v,v));
    if(norm<1e-8)continue;
    basis.push(v.map(x=>x/norm));values.push(rhs/norm);
  }
  const shifts=Array(14).fill(0);basis.forEach((q,i)=>q.forEach((x,j)=>shifts[j]+=x*values[i]));
  const maxShift=Math.max(...poses.map((p,i)=>Math.hypot(shifts[i*2],shifts[i*2+1])));
  if(maxShift>threshold*2)return null;
  const result=poses.map((p,i)=>({...p,x:p.x+shifts[i*2],y:p.y+shifts[i*2+1]}));
  try{if(!G.validateLayout(result).valid)return null;}catch{return null;}
  return {poses:result,maxShift};
}
function convert(line,{raw=false}={}){
  const a=line.trim().split(/\s+/).map(Number),scale=a[0],seen={};
  if(a.length!==36||!(scale>0))return null;
  const poses=[];
  for(let i=0;i<7;i++){
    const [type,x,y,angle,flip]=a.slice(1+i*5,6+i*5);
    if(!base[type]||Math.abs(angle/(Math.PI/4)-Math.round(angle/(Math.PI/4)))>.0001)return null;
    const theta=Math.round(angle/(Math.PI/4))*Math.PI/4,c=Math.cos(theta),s=Math.sin(theta);
    const vertices=base[type].map(([u,v])=>{u=flip?-u:u;return[u*c-v*s,u*s+v*c];});
    const id=type===1?'square':type===3?'medium':type===5?'parallelogram':`${type===2?'small':'large'}-${seen[type]?'b':'a'}`;seen[type]=true;
    let found=null;
    for(let rotation=0;rotation<8;rotation++)for(const flipped of type===5?[false,true]:[false]){
      const p={pieceId:id,x:0,y:0,rotation,flipped},points=G.transformPiece(p);
      if(vertices.every(v=>points.some(q=>Math.hypot(v[0]-q[0],v[1]-q[1])<1e-6)))found=p;
    }
    if(!found)return null;
    poses.push({...found,x:x/scale,y:y/scale});
  }
  const origin={x:poses[0].x,y:poses[0].y};poses.forEach(p=>{p.x-=origin.x;p.y-=origin.y;});
  return raw ? poses : repair(poses);
}
function read(file,subjects){
  const lines=fs.readFileSync(file,'utf8').split(/\r?\n/),out=[];
  for(let i=0;i+2<lines.length;i+=3){
    const label=lines[i].trim(),subject=label.includes('.')?label.slice(0,label.lastIndexOf('.')):label;
    if(subjects&&!subjects.includes(subject))continue;
    const result=convert(lines[i+1]);if(result)out.push({label,subject,line:i+1,...result});
  }
  return out;
}
module.exports={read,convert,repair};
if(require.main===module){const [source,output,subjectsFile]=process.argv.slice(2);const subjects=JSON.parse(fs.readFileSync(subjectsFile,'utf8'));const result=read(source,subjects.map(s=>s.source));fs.writeFileSync(output,JSON.stringify(result,null,2));console.log(`${result.length} strict valid named candidates`);}
