const test=require('node:test'),assert=require('node:assert/strict'),F=require('../web/furniture.js');
const scale={x:.01,y:.02},make=(type='sofa-l')=>F.defaults(type,'f1',{x:300,y:200});
test('defaults validate and generate deterministic recognizable components',()=>{for(const type of ['sofa','sofa-l','tv','tv-unit']){const a=make(type);assert.deepEqual(F.validate([a],scale),[]);assert.ok(F.parts(a).length>=4);assert.deepEqual(F.meshes([a],scale),F.meshes(JSON.parse(JSON.stringify([a])),scale));}});
test('L sofa has a genuinely empty notch and reversible chaise',()=>{const a=make();const pt=(x,y)=>({x:300+x/scale.x,y:200+y/scale.y});assert.equal(F.hitTest(a,pt(-.9,.8),scale),true);assert.equal(F.hitTest(a,pt(.9,.8),scale),false);a.chaiseSide='right';assert.equal(F.hitTest(a,pt(-.9,.8),scale),false);assert.equal(F.hitTest(a,pt(.9,.8),scale),true);});
test('anisotropic pixel scale preserves physical dimensions and rotation',()=>{const a=make('sofa');a.rotation=90;const m=F.meshes([a],scale),v=m.flatMap(m=>m.vertices);const xs=v.map(p=>p[0]),ys=v.map(p=>p[1]);assert.ok(Math.abs(Math.max(...xs)-Math.min(...xs)-a.depth)<1e-9);assert.ok(Math.abs(Math.max(...ys)-Math.min(...ys)-a.width)<1e-9);const p=F.polygons(a,scale).flatMap(p=>p.points);assert.ok(Math.abs((Math.max(...p.map(p=>p.x))-Math.min(...p.map(p=>p.x)))*scale.x-a.depth)<1e-9);assert.equal(F.hitTest(a,{x:300,y:249},scale),true);assert.equal(F.hitTest(a,{x:300+(a.depth/2+.05)/scale.x,y:200},scale),false);});
test('invalid and untrusted inputs rejected without mutation',()=>{assert.deepEqual(F.validate(undefined,scale),[]);for(const value of [null,{},'bad',Array(101).fill(make())])assert.ok(F.validate(value,scale).length);for(const patch of [{width:-1},{height:NaN},{depth:Infinity},{rotation:Infinity},{elevation:-1},{color:'red'},{type:'script'},{chaiseDepth:.2},{chaiseWidth:4},{chaiseSide:'top'},{position:{x:NaN,y:0}}])assert.ok(F.validate([{...make(),...patch}],scale).length);const a=make(),before=JSON.stringify(a);assert.ok(F.validate([a],scale,['f1']).length);assert.ok(F.validate([a,a],scale).length);assert.ok(F.validate([a],{x:0,y:.01}).length);F.parts(a);F.polygons(a,scale);F.meshes([a],scale);assert.equal(JSON.stringify(a),before);});
test('3D mesh and 2D polygons share all horizontal component corners',()=>{const a=make();a.rotation=37;const polys=F.polygons(a,scale);for(const mesh of F.meshes([a],scale)){for(const [x,y]of mesh.vertices){assert.ok(polys.some(p=>p.points.some(q=>Math.abs(q.x*scale.x-x)<1e-9&&Math.abs(q.y*scale.y-y)<1e-9)));}assert.equal(mesh.kind,'furniture');}});
test('expanded library defaults remain dimensioned and deterministic',()=>{
  const sizes={chair:[.5,.55,.82],'table-round':[1.1,1.1,.75],'table-rounded':[1.4,.8,.75],bookshelf:[.8,.3,2],bed:[1.5,2,1]};
  for(const [type,size] of Object.entries(sizes)){const a=make(type);assert.deepEqual([a.width,a.depth,a.height],size);assert.deepEqual(F.validate([a],scale),[]);assert.ok(F.parts(a).length>=5);assert.deepEqual(F.meshes([a],scale),F.meshes(JSON.parse(JSON.stringify([a])),scale));}
  const shelf=make('bookshelf');delete shelf.shelfCount;assert.deepEqual(F.validate([shelf],scale),[]);assert.deepEqual(F.meshes([shelf],scale),F.meshes([make('bookshelf')],scale));
});
test('round top preserves metre diameter under anisotropic pixels with actual curved footprint',()=>{
  const a=make('table-round'),poly=F.polygons(a,scale).find(p=>p.points.length===64);assert.ok(poly);
  for(const p of poly.points)assert.ok(Math.abs(Math.hypot((p.x-a.position.x)*scale.x,(p.y-a.position.y)*scale.y)-.55)<1e-9);
  for(const mesh of F.meshes([a],scale))for(const [x,y]of mesh.vertices)assert.ok(Math.hypot(x-a.position.x*scale.x,y-a.position.y*scale.y)<=.55+1e-9);
  assert.equal(F.hitTest(a,{x:300+.54/scale.x,y:200+.54/scale.y},scale),false);
  assert.equal(F.hitTest(a,{x:300+.54/scale.x,y:200},scale),true);
  assert.ok(F.validate([{...a,depth:1}],scale).some(e=>e.includes('diameter')));
});
test('rounded rectangle excludes square corners and retains full central extents',()=>{
  const a=make('table-rounded'),point=(x,y)=>({x:300+x/scale.x,y:200+y/scale.y});
  assert.equal(F.hitTest(a,point(.69,.39),scale),false);assert.equal(F.hitTest(a,point(.69,0),scale),true);assert.equal(F.hitTest(a,point(0,.39),scale),true);
  assert.ok(F.polygons(a,scale).some(p=>p.points.length>4));
});
test('curved and articulated new types share exact 2D and 3D corners at rotations',()=>{
  for(const type of ['chair','table-round','table-rounded','bookshelf','bed'])for(const rotation of [0,37,90,180]){
    const a=make(type);a.rotation=rotation;const polygons=F.polygons(a,scale),points=polygons.flatMap(p=>p.points),meshes=F.meshes([a],scale);
    for(const mesh of meshes)for(const [x,y]of mesh.vertices)assert.ok(points.some(p=>Math.abs(p.x*scale.x-x)<1e-9&&Math.abs(p.y*scale.y-y)<1e-9));
    for(const p of points)assert.equal(F.hitTest(a,p,scale),true);
  }
});
test('shelf counts reject malformed values while all legacy defaults stay accepted',()=>{
  for(const shelfCount of [null,'5',1,11,2.5,NaN,Infinity])assert.ok(F.validate([{...make('bookshelf'),shelfCount}],scale).length);
  for(const shelfCount of [2,5,10])assert.deepEqual(F.validate([{...make('bookshelf'),shelfCount}],scale),[]);
  for(const type of ['sofa','sofa-l','tv','tv-unit'])assert.deepEqual(F.validate([JSON.parse(JSON.stringify(make(type)))],scale),[]);
});
