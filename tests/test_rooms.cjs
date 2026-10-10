const {test}=require('node:test');
const assert=require('node:assert/strict');
const R=require('../web/rooms.js');
const room=(id,ps)=>({id,name:id,points:ps.map(([x,y])=>({x,y}))});
const square=room('a',[[0,0],[2,0],[2,2],[0,2]]);
const mesh=(vertices)=>({id:'wall',kind:'wall',color:'#eee',vertices,faces:[vertices.map((_,i)=>i)]});
const surfaceArea=meshes=>meshes.reduce((total,m)=>total+m.faces.reduce((n,f)=>{const a=m.vertices[f[0]];for(let i=1;i<f.length-1;i++){const b=m.vertices[f[i]].map((v,k)=>v-a[k]),c=m.vertices[f[i+1]].map((v,k)=>v-a[k]);n+=Math.hypot(b[1]*c[2]-b[2]*c[1],b[2]*c[0]-b[0]*c[2],b[0]*c[1]-b[1]*c[0])/2;}return n;},0),0);
test('room validation accepts legacy absent metadata and concave polygons',()=>{
 assert.deepEqual(R.validate(),[]);assert.deepEqual(R.validate([square],{selectedRoomIds:['a'],hideOthers:true}),[]);
 assert.equal(R.validate([room('l',[[0,0],[3,0],[3,1],[1,1],[1,3],[0,3]])]).length,0);
});
test('room validation rejects malformed polygons, duplicate IDs, invalid views',()=>{
 for(const ps of [[[0,0],[1,1],[0,1],[1,0]],[[0,0],[1,0],[2,0]],[[0,0],[2,0],[1,0],[1,2]],[[0,0],[0,0],[1,1]],[[0,0],[1,0],[Infinity,2]]])assert.ok(R.validate([room('bad',ps)]).length);
 assert.ok(R.validate([square,square]).length);assert.ok(R.validate([square],undefined,['a']).length);
 assert.ok(R.validate([square],{selectedRoomIds:['missing'],hideOthers:true}).length);
 assert.ok(R.validate([square],{selectedRoomIds:['a','a'],hideOthers:true}).length);
 assert.ok(R.validate([square],{selectedRoomIds:[],hideOthers:'yes'}).length);
 assert.ok(R.validate(Array(51).fill(square)).length);
 assert.ok(R.validate([room('many',Array(51).fill([1,2]))]).length);
});
test('contains is inclusive on boundary and respects concavity, bounds handles union',()=>{
 const l=room('l',[[0,0],[3,0],[3,1],[1,1],[1,3],[0,3]]);
 assert.equal(R.contains({x:2,y:2},[l]),false);assert.equal(R.contains({x:1,y:2},[l]),true);
 assert.equal(R.contains({x:.5,y:2},[l]),true);assert.equal(R.contains({x:0,y:0},[]),false);
 assert.deepEqual(R.bounds([l]),{minX:0,minY:0,maxX:3,maxY:3});assert.equal(R.bounds([]),null);
});
test('clips a long vertical wall to a room and preserves elevation and source',()=>{
 const input=[mesh([[-4,1,0],[6,1,0],[6,1,2.5],[-4,1,2.5]])],snapshot=JSON.stringify(input);
 const out=R.clipMeshes(input,[square],{x:1,y:1});assert.equal(JSON.stringify(input),snapshot);
 assert.ok(out[0].vertices.every(([x,y,z])=>x>=-1e-8&&x<=2+1e-8&&y===1&&z>=0&&z<=2.5));
 assert.equal(out[0].id,'wall');assert.equal(out[0].kind,'wall');assert.equal(out[0].color,'#eee');assert.ok(Math.abs(surfaceArea(out)-5)<1e-7);
});
test('concave clipping removes notch rather than using bounds',()=>{
 const l=room('l',[[0,0],[3,0],[3,1],[1,1],[1,3],[0,3]]);
 const out=R.clipMeshes([mesh([[-1,-1,0],[4,-1,0],[4,4,0],[-1,4,0]])],[l],{x:1,y:1});
 assert.ok(Math.abs(surfaceArea(out)-5)<1e-7);
 for(const m of out)for(const f of m.faces){const ps=f.map(i=>m.vertices[i]);assert.ok(R.contains({x:ps.reduce((s,p)=>s+p[0],0)/ps.length,y:ps.reduce((s,p)=>s+p[1],0)/ps.length},[l]));}
});
test('multiple room union clips once even when regions overlap',()=>{
 const b=room('b',[[1,0],[3,0],[3,2],[1,2]]),ground=[mesh([[-1,-1,0],[4,-1,0],[4,4,0],[-1,4,0]])];
 assert.ok(Math.abs(surfaceArea(R.clipMeshes(ground,[square,b],{x:1,y:1}))-6)<1e-7);
 const c=room('c',[[4,0],[6,0],[6,2],[4,2]]);
 const large=[mesh([[-1,-1,0],[7,-1,0],[7,4,0],[-1,4,0]])];assert.ok(Math.abs(surfaceArea(R.clipMeshes(large,[square,c],{x:1,y:1}))-8)<1e-7);
});
test('nonuniform scale, winding and coplanar boundaries remain valid',()=>{
 const reversed={...square,points:square.points.slice().reverse()};
 const out=R.clipMeshes([mesh([[-1,0,0],[6,0,0],[6,0,3],[-1,0,3]])],[reversed],{x:2,y:3});
 assert.ok(Math.abs(surfaceArea(out)-12)<1e-7);assert.deepEqual(R.clipMeshes([],[],{x:1,y:1}),[]);
 assert.throws(()=>R.clipMeshes([],[],{x:0,y:1}));
});
test('clipping rejects nonfinite geometry and invalid face references',()=>{
 assert.throws(()=>R.clipMeshes([mesh([[0,0,0],[1,0,0],[0,Infinity,0]])],[square],{x:1,y:1}));
 assert.throws(()=>R.clipMeshes([{vertices:[[0,0,0]],faces:[[0,1,2]]}],[square],{x:1,y:1}));
 assert.throws(()=>R.clipMeshes([],[square],{x:Number.MAX_VALUE,y:1}));
});
test('segment visibility rejects concave and disconnected gaps and accepts adjacent union',()=>{
 const l=room('l',[[0,0],[3,0],[3,1],[1,1],[1,3],[0,3]]);
 assert.equal(R.segmentVisible({x:.5,y:2.5},{x:2.5,y:.5},[l]),false);
 assert.equal(R.segmentVisible({x:.5,y:2.5},{x:.5,y:.5},[l]),true);
 const separate=room('separate',[[3,0],[5,0],[5,2],[3,2]]);
 assert.equal(R.segmentVisible({x:1,y:1},{x:4,y:1},[square,separate]),false);
 const adjacent=room('adjacent',[[2,0],[4,0],[4,2],[2,2]]);
 assert.equal(R.segmentVisible({x:1,y:1},{x:3,y:1},[square,adjacent]),true);
 assert.equal(R.segmentVisible({x:0,y:0},{x:4,y:0},[square,adjacent]),true);
 assert.equal(R.segmentVisible({x:2,y:0},{x:2,y:2},[square,adjacent]),true);
 assert.equal(R.segmentVisible({x:1,y:1},{x:1,y:1},[square]),true);
 assert.equal(R.segmentVisible({x:5,y:5},{x:5,y:5},[square]),false);
 assert.equal(R.segmentVisible({x:0,y:0},{x:4,y:0},[square]),false);
});
test('room validation bounds coordinates',()=>{
 assert.ok(R.validate([room('large',[[1e8,0],[1e8+2,0],[1e8,2]])]).length);
});
