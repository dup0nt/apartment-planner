/* Room regions are a view mask, never architectural edits. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.BlueprintRooms=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const EPS=1e-8;
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const point=p=>p&&finite(p.x)&&finite(p.y);
const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const area=ps=>ps.reduce((v,p,i)=>{const q=ps[(i+1)%ps.length];return v+p.x*q.y-q.x*p.y;},0)/2;
function onSegment(p,a,b){return Math.abs(cross(a,b,p))<=EPS&&p.x>=Math.min(a.x,b.x)-EPS&&p.x<=Math.max(a.x,b.x)+EPS&&p.y>=Math.min(a.y,b.y)-EPS&&p.y<=Math.max(a.y,b.y)+EPS;}
function intersects(a,b,c,d){const v=[cross(a,b,c),cross(a,b,d),cross(c,d,a),cross(c,d,b)];return(v[0]*v[1]<-EPS&&v[2]*v[3]<-EPS)||onSegment(c,a,b)||onSegment(d,a,b)||onSegment(a,c,d)||onSegment(b,c,d);}
function validate(rooms,view,existingIds=[]){
 const errors=[],ids=new Set(existingIds),roomIds=new Set();
 if(rooms===undefined)rooms=[];
 if(!Array.isArray(rooms)||rooms.length>50)return ['Rooms must be an array of at most 50 regions.'];
 rooms.forEach((r,i)=>{
  const name='Room '+(i+1);
  if(!r||typeof r!=='object'){errors.push(name+' must be an object.');return;}
  if(typeof r.id!=='string'||!r.id.trim()||r.id.length>200||ids.has(r.id))errors.push(name+' requires a unique ID (maximum 200 characters).');
  else{ids.add(r.id);roomIds.add(r.id);}
  if(typeof r.name!=='string'||!r.name.trim()||r.name.length>120)errors.push(name+' requires a name of 1–120 characters.');
  const ps=r.points;
  if(!Array.isArray(ps)||ps.length<3||ps.length>50||!ps.every(point)){errors.push(name+' requires 3–50 finite polygon points.');return;}
  if(ps.some(p=>Math.abs(p.x)>1e7||Math.abs(p.y)>1e7))errors.push(name+' coordinates must be within ±10000000 pixels.');
  if(!finite(area(ps))||Math.abs(area(ps))<=EPS)errors.push(name+' polygon must have nonzero finite area.');
  for(let j=0;j<ps.length;j++){
   const a=ps[j],b=ps[(j+1)%ps.length],c=ps[(j+2)%ps.length];
   if(Math.hypot(a.x-b.x,a.y-b.y)<=EPS)errors.push(name+' has a zero-length edge.');
   if(Math.abs(cross(a,b,c))<=EPS&&(a.x-b.x)*(c.x-b.x)+(a.y-b.y)*(c.y-b.y)>EPS)errors.push(name+' has overlapping adjacent edges.');
   for(let k=j+1;k<ps.length;k++){if(k===j+1||(j===0&&k===ps.length-1))continue;if(intersects(a,b,ps[k],ps[(k+1)%ps.length]))errors.push(name+' polygon must not intersect itself.');}
  }
 });
 if(view!==undefined){
  if(!view||typeof view!=='object'||typeof view.hideOthers!=='boolean'||!Array.isArray(view.selectedRoomIds))errors.push('Room view requires selectedRoomIds and a hideOthers boolean.');
  else if(view.selectedRoomIds.length>50||new Set(view.selectedRoomIds).size!==view.selectedRoomIds.length||view.selectedRoomIds.some(id=>!roomIds.has(id)))errors.push('Selected rooms must be unique IDs of existing regions.');
 }
 return errors;
}
function inside(p,ps){let yes=false;for(let i=0,j=ps.length-1;i<ps.length;j=i++){const a=ps[j],b=ps[i];if(onSegment(p,a,b))return true;if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)yes=!yes;}return yes;}
function contains(p,rooms){return point(p)&&Array.isArray(rooms)&&rooms.some(r=>inside(p,r.points));}
// Split at every boundary crossing; each open interval has constant membership.
function segmentVisible(a,b,rooms){
 if(!point(a)||!point(b)||!contains(a,rooms)||!contains(b,rooms))return false;
 const dx=b.x-a.x,dy=b.y-a.y,length2=dx*dx+dy*dy;
 if(length2<=EPS*EPS)return true;
 const ts=[0,1],add=t=>{if(t>=-EPS&&t<=1+EPS)ts.push(Math.max(0,Math.min(1,t)));};
 for(const room of rooms)for(let i=0;i<room.points.length;i++){
  const c=room.points[i],d=room.points[(i+1)%room.points.length],ex=d.x-c.x,ey=d.y-c.y,cx=c.x-a.x,cy=c.y-a.y;
  const denominator=dx*ey-dy*ex;
  if(Math.abs(denominator)>EPS){const t=(cx*ey-cy*ex)/denominator,u=(cx*dy-cy*dx)/denominator;if(u>=-EPS&&u<=1+EPS)add(t);}
  else if(Math.abs(cx*dy-cy*dx)<=EPS){add((cx*dx+cy*dy)/length2);add(((d.x-a.x)*dx+(d.y-a.y)*dy)/length2);}
 }
 ts.sort((x,y)=>x-y);
 for(let i=1;i<ts.length;i++){const t=(ts[i-1]+ts[i])/2;if(!contains({x:a.x+t*dx,y:a.y+t*dy},rooms))return false;}
 return true;
}
function bounds(rooms){if(!rooms||!rooms.length)return null;const ps=rooms.flatMap(r=>r.points);if(!ps.length)return null;return{minX:Math.min(...ps.map(p=>p.x)),minY:Math.min(...ps.map(p=>p.y)),maxX:Math.max(...ps.map(p=>p.x)),maxY:Math.max(...ps.map(p=>p.y))};}
function triangulate(input){
 let ps=input.map(p=>({...p}));if(area(ps)<0)ps.reverse();
 let changed=true;while(changed&&ps.length>3){changed=false;for(let i=0;i<ps.length;i++)if(Math.abs(cross(ps[(i+ps.length-1)%ps.length],ps[i],ps[(i+1)%ps.length]))<=EPS){ps.splice(i,1);changed=true;break;}}
 const tris=[];while(ps.length>3){let found=false;for(let i=0;i<ps.length;i++){const a=ps[(i+ps.length-1)%ps.length],b=ps[i],c=ps[(i+1)%ps.length];if(cross(a,b,c)<=EPS)continue;if(ps.some(p=>p!==a&&p!==b&&p!==c&&cross(a,b,p)>=-EPS&&cross(b,c,p)>=-EPS&&cross(c,a,p)>=-EPS))continue;tris.push([a,b,c]);ps.splice(i,1);found=true;break;}if(!found)throw new Error('Room polygon could not be triangulated.');}
 tris.push(ps);return tris;
}
function substantial(ps){if(ps.length<3)return false;let sum=0;const a=ps[0];for(let i=1;i<ps.length-1;i++){const b=ps[i].map((v,k)=>v-a[k]),c=ps[i+1].map((v,k)=>v-a[k]);sum+=Math.hypot(b[1]*c[2]-b[2]*c[1],b[2]*c[0]-b[0]*c[2],b[0]*c[1]-b[1]*c[0]);}return sum>EPS;}
function half(poly,a,b,sign){
 const d=p=>sign*((b.x-a.x)*(p[1]-a.y)-(b.y-a.y)*(p[0]-a.x));
 const result=[];for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],dp=d(p),dq=d(q),pi=dp>=-EPS,qi=dq>=-EPS;if(pi)result.push(p.slice());if(pi!==qi){const t=dp/(dp-dq);result.push(p.map((v,k)=>v+(q[k]-v)*t));}}
 return result.filter((p,i)=>!i||Math.hypot(...p.map((v,k)=>v-result[i-1][k]))>EPS);
}
function partition(poly,tri){let current=poly;const outside=[];for(let i=0;i<3&&substantial(current);i++){const a=tri[i],b=tri[(i+1)%3];
 // Coplanar vertical faces belong to the interior only, preventing double emission.
 const vals=current.map(p=>(b.x-a.x)*(p[1]-a.y)-(b.y-a.y)*(p[0]-a.x));
 if(vals.some(v=>v<-EPS)){const out=half(current,a,b,-1);if(substantial(out))outside.push(out);}
 current=half(current,a,b,1);
 }return{inside:substantial(current)?current:null,outside};}
function clipMeshes(meshes,rooms,scale){
 const errors=validate(rooms);if(errors.length)throw new Error(errors.join(' '));
 if(!scale||!finite(scale.x)||!finite(scale.y)||scale.x<=0||scale.y<=0)throw new Error('Room clipping requires positive finite scale.');
 if(!rooms||!rooms.length)return[];
 if(rooms.some(r=>r.points.some(p=>!finite(p.x*scale.x)||!finite(p.y*scale.y))))throw new Error('Transformed room coordinates must remain finite.');
 if(!Array.isArray(meshes)||meshes.some(m=>!m||!Array.isArray(m.vertices)||!Array.isArray(m.faces)||m.vertices.some(p=>!Array.isArray(p)||p.length!==3||!p.every(finite))||m.faces.some(f=>!Array.isArray(f)||f.some(i=>!Number.isInteger(i)||i<0||i>=m.vertices.length))))throw new Error('Meshes require finite 3D vertices and valid face indices.');
 const triangles=rooms.flatMap(r=>triangulate(r.points.map(p=>({x:p.x*scale.x,y:p.y*scale.y}))));
 const result=[];
 for(const mesh of meshes){const vertices=[],faces=[];
  for(const face of mesh.faces){let remaining=[face.map(i=>mesh.vertices[i])];
   for(const tri of triangles){if(!remaining.length)break;const next=[];for(const poly of remaining){const part=partition(poly,tri);if(part.inside){const offset=vertices.length;vertices.push(...part.inside);faces.push(part.inside.map((_,i)=>offset+i));}next.push(...part.outside);}remaining=next;}
  }
  if(faces.length)result.push({...mesh,vertices,faces});
 }
 return result;
}
return{validate,contains,segmentVisible,bounds,clipMeshes};
});
