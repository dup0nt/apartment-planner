const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../web/geometry.js');
const make = () => ({version:1,name:'test',notes:'source',image:{src:'demo.png',width:1000,height:1000},scale:{x:0.01,y:0.02,calibrated:true},defaults:{height:2.5,thickness:0.12},walls:[{id:'w',a:{x:0,y:0},b:{x:400,y:0},height:2.5,thickness:0.12,openings:[]}],dimensions:[]});
const opening = (changes={}) => ({id:'o',type:'window',offset:1,width:1,height:1,sill:0.8,hinge:'start',swing:1,...changes});
const near = (a,b) => assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
test('anisotropic transformation and rotated length',()=>{
  assert.deepEqual(G.pixelToWorld({x:30,y:40},{x:0.1,y:0.2}),{x:3,y:8});
  near(G.wallLength({a:{x:0,y:0},b:{x:300,y:200}},{x:0.01,y:0.02}),5);
});
test('window removes actual volume; rotated box follows calibrated wall',()=>{
  const p=make(); p.walls[0].b={x:300,y:200}; p.walls[0].openings=[opening()];
  const meshes=G.projectToMeshes(p), walls=meshes.filter(m=>m.kind==='wall');
  assert.equal(walls.length,4);
  const u={x:0.6,y:0.8};
  for(const m of walls) {
    const xs=m.vertices.map(v=>v[0]*u.x+v[1]*u.y), zs=m.vertices.map(v=>v[2]);
    assert.ok(Math.max(...xs)<=1+1e-9 || Math.min(...xs)>=2-1e-9 || Math.max(...zs)<=0.8+1e-9 || Math.min(...zs)>=1.8-1e-9);
  }
  const glass=meshes.find(m=>m.kind==='glass');
  near(glass.vertices[0][0]*u.x+glass.vertices[0][1]*u.y,1);
});
test('door leaf and arc share explicit hinge, end hinge and negative swing',()=>{
  const p=make();p.walls[0].openings=[opening({type:'door',height:2,sill:0,hinge:'end',swing:-1})];
  const m=G.projectToMeshes(p),leaf=m.find(m=>m.kind==='door'),arc=m.find(m=>m.kind==='swing');
  near((leaf.vertices[0][0]+leaf.vertices[3][0])/2,2);
  near((leaf.vertices[0][1]+leaf.vertices[3][1])/2,0);
  near((leaf.vertices[1][1]+leaf.vertices[2][1])/2,-1);
  near((arc.vertices[0][0]+arc.vertices[1][0])/2,1);
  near((arc.vertices.at(-2)[1]+arc.vertices.at(-1)[1])/2,-1);
  assert.ok(!m.filter(v=>v.kind==='wall').some(v=>Math.min(...v.vertices.map(x=>x[2]))===0 && Math.min(...v.vertices.map(x=>x[0]))>=1 && Math.max(...v.vertices.map(x=>x[0]))<=2));
});
test('invalid and overlapping openings rejected without mutation',()=>{
  for(const changes of [{offset:3.5},{height:3},{width:NaN},{offset:-1},{sill:-1},{hinge:'left'},{swing:0}]) {
    const p=make();p.walls[0].openings=[opening(changes)];assert.ok(G.validateProject(p).errors.length);
  }
  const p=make();p.walls[0].openings=[opening(),opening({id:'o2',offset:1.5})];
  const original=JSON.stringify(p);assert.match(G.validateProject(p).errors.join(' '),/overlap/);assert.equal(JSON.stringify(p),original);
  assert.throws(()=>G.projectToMeshes(p),/overlap/);
  p.walls[0].openings[1].offset=2;assert.deepEqual(G.validateProject(p).errors,[]);
});
test('imports reject executable/remote images and malformed projects',()=>{
  for(const src of ['https://example.com/a.png','//host/a.png','javascript:alert(1)','data:image/svg+xml;base64,AAAA','../a.png','a/%2e%2e/a.png','a.png?x=1','file:///a.png','/a.png','a\\b.png']) {
    const p=make();p.image.src=src;assert.ok(G.validateProject(p).errors.length,src);
  }
  for(const src of ['demo.png','images/demo.png','./images/demo.webp','data:image/png;base64,AAAA']) {
    const p=make();p.image.src=src;assert.deepEqual(G.validateProject(p).errors,[],src);
  }
  for(const p of [null,[],{}, {version:1,walls:[null],dimensions:[null]}]) assert.ok(G.validateProject(p).errors.length);
  const p=make();p.image.width=16001;assert.ok(G.validateProject(p).errors.length);
});
test('finite positive dimensions and unique identifiers enforced',()=>{
  const p=make();p.walls[0].b={x:0,y:0};assert.match(G.validateProject(p).errors.join(' '),/nonzero/);
  p.walls[0].b.x=400;p.walls[0].height=Infinity;assert.ok(G.validateProject(p).errors.length);
  p.walls[0].height=2.5;p.walls[0].openings=[opening({id:'w'})];assert.match(G.validateProject(p).errors.join(' '),/duplicate/);
});
test('evidence warnings, nonmutation, JSON roundtrip and deterministic meshes',()=>{
  const p=make();p.scale.calibrated=false;
  assert.match(G.validateProject(p).warnings.join(' '),/not confirmed/);
  p.scale.calibrated=true;p.dimensions=[{id:'d',a:{x:0,y:0},b:{x:100,y:0},label:'2m source',metres:2}];
  assert.match(G.validateProject(p).warnings.join(' '),/disagrees/);
  const before=JSON.stringify(p),meshes=G.projectToMeshes(p);
  assert.equal(JSON.stringify(p),before);
  assert.deepEqual(G.projectToMeshes(JSON.parse(before)),meshes);
  assert.deepEqual(G.projectToMeshes(p),meshes);
});
test('ink suggestions deterministic and bounded',()=>{
  const image={width:100,height:100,data:new Uint8ClampedArray(40000).fill(255)};
  for(let x=10;x<90;x++) {const i=(20*100+x)*4;image.data[i]=image.data[i+1]=image.data[i+2]=0;}
  const result=G.suggestWalls(image);assert.deepEqual(result,[{a:{x:10,y:20},b:{x:89,y:20}}]);
  assert.deepEqual(G.suggestWalls(image),result);assert.deepEqual(G.suggestWalls(image,{limit:0}),[]);
});

test('ruler aligns in world metres with rotated walls and anisotropic pixels',()=>{
 const scale={x:.02,y:.01},wall={a:{x:0,y:0},b:{x:100,y:100}},a={x:10,y:20},p={x:160,y:90};
 for(const mode of ['parallel','perpendicular','auto']){const b=G.alignRuler(a,p,wall,scale,mode),dx=(b.x-a.x)*scale.x,dy=(b.y-a.y)*scale.y;if(mode==='perpendicular')assert.ok(Math.abs(dx*2+dy)<1e-9);else assert.ok(Math.abs(dx-dy*2)<1e-9);}
});
