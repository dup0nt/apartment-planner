/* Furniture dimensions are metres; placement remains tied to blueprint pixels. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.BlueprintFurniture=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const TYPES=['sofa','sofa-l','tv','tv-unit'];
  const finite=v=>typeof v==='number'&&Number.isFinite(v);
  function defaults(type,id,position){
    // 55-inch, 16:9 visible screen; compensate for the schematic bezel and stand below.
    const diagonal=55*.0254, screenWidth=diagonal*16/Math.hypot(16,9), screenHeight=diagonal*9/Math.hypot(16,9);
    const sizes={sofa:[2.1,1.1,.84],'sofa-l':[2.1,1.1,.84],tv:[screenWidth/.962,.26,screenHeight/(.87*.94)],'tv-unit':[1.79,.42,.56]};
    if(!sizes[type])throw new Error('Unknown furniture type.');
    const [width,depth,height]=sizes[type];
    return {id,type,position:{x:position.x,y:position.y},rotation:0,width,depth,height,elevation:type==='tv'?.56:0,color:type==='tv'?'#30383b':type==='tv-unit'?'#ad855b':'#b9b19c',...(type==='sofa-l'?{chaiseDepth:1.6,chaiseWidth:.85,chaiseSide:'left'}:{})};
  }
  function validate(items,scale,existingIds=[]){
    const errors=[];if(items===undefined)return errors;
    if(!Array.isArray(items))return ['Furniture must be an array.'];
    if(items.length>100)return ['At most 100 furniture items are allowed.'];
    const scaleOK=scale&&finite(scale.x)&&scale.x>0&&finite(scale.y)&&scale.y>0;
    if(!scaleOK)errors.push('Furniture requires a positive finite scale.');
    const ids=new Set(Array.isArray(existingIds)?existingIds:[]);
    items.forEach((item,i)=>{
      const name='Furniture '+i;
      if(!item||typeof item!=='object'||Array.isArray(item)){errors.push(name+' must be an object.');return;}
      if(typeof item.id!=='string'||!item.id.trim()||item.id.length>200||ids.has(item.id))errors.push(name+' requires a unique ID (maximum 200 characters).');else ids.add(item.id);
      if(!TYPES.includes(item.type))errors.push(name+' has an unsupported type.');
      if(!item.position||!finite(item.position.x)||!finite(item.position.y)||Math.abs(item.position.x)>1e7||Math.abs(item.position.y)>1e7)errors.push(name+' position must be finite and within 10 million pixels.');
      else if(scaleOK&&(!finite(item.position.x*scale.x)||!finite(item.position.y*scale.y)))errors.push(name+' transformed position must remain finite.');
      if(!finite(item.rotation)||Math.abs(item.rotation)>36000)errors.push(name+' rotation must be finite and within ±36000 degrees.');
      for(const key of ['width','depth','height'])if(!finite(item[key])||item[key]<.05||item[key]>10)errors.push(name+' '+key+' must be between 0.05 and 10 metres.');
      if(!finite(item.elevation)||item.elevation<0||item.elevation>10)errors.push(name+' elevation must be between 0 and 10 metres.');
      if(typeof item.color!=='string'||!/^#[0-9a-f]{6}$/i.test(item.color))errors.push(name+' color must be a six-digit hex color.');
      if(item.type==='sofa-l'){
        if(!finite(item.chaiseDepth)||item.chaiseDepth<item.depth||item.chaiseDepth>10)errors.push(name+' chaise depth must be at least sofa depth and at most 10 metres.');
        if(!finite(item.chaiseWidth)||item.chaiseWidth<.05||item.chaiseWidth>item.width)errors.push(name+' chaise width must be positive and no wider than the sofa.');
        if(!['left','right'].includes(item.chaiseSide))errors.push(name+' chaise side must be left or right.');
      }
    });return errors;
  }
  function tint(hex,amount){return '#'+[1,3,5].map(i=>Math.max(0,Math.min(255,parseInt(hex.slice(i,i+2),16)+amount)).toString(16).padStart(2,'0')).join('');}
  function parts(item){
    const {width:w,depth:d,height:h,elevation:e,color:c}=item, out=[];
    const box=(x,y,z,width,depth,height,color=c)=>{if(width>0&&depth>0&&height>0)out.push({x,y,z:z+e,width,depth,height,color});};
    const legs=(x,y,width,depth,legHeight)=>{const side=Math.min(width,depth)*.09;for(const dx of [-1,1])for(const dy of [-1,1])box(x+dx*(width/2-side),y+dy*(depth/2-side),0,side,side,legHeight,'#72563c');};
    if(item.type==='sofa'||item.type==='sofa-l'){
      const arm=Math.min(.16,w*.12),back=Math.min(.16,d*.2),leg=h*.13,base=h*.31,seat=h*.16;
      legs(0,0,w,d,leg);box(0,0,leg,w,d,base);box(-w/2+arm/2,0,leg,arm,d,h*.65);box(w/2-arm/2,0,leg,arm,d,h*.65);
      box(0,-d/2+back/2,leg,w-2*arm,back,h-leg,tint(c,-13));
      const n=Math.max(2,Math.round(w/.8)),cw=(w-2*arm)/n;
      for(let i=0;i<n;i++){box(-w/2+arm+cw*(i+.5),back/2,leg+base,cw*.975,d-back-.025,seat,tint(c,12));box(-w/2+arm+cw*(i+.5),-d/2+back+d*.04,h*.59,cw*.965,d*.1,h*.35,tint(c,5));}
      if(item.type==='sofa-l'&&item.chaiseDepth>d){
        const ext=item.chaiseDepth-d, x=(item.chaiseSide==='left'?-1:1)*(w-item.chaiseWidth)/2, y=d/2+ext/2;
        legs(x,y,item.chaiseWidth,ext,leg);box(x,y,leg,item.chaiseWidth,ext,base);box(x,y,leg+base,item.chaiseWidth-.015,ext,seat,tint(c,12));
      }
    }else if(item.type==='tv-unit'){
      const leg=h*.22,body=h-leg,top=Math.min(.035,body*.12);
      legs(0,0,w,d,leg);box(0,0,leg,w,d,body-top);box(0,0,h-top,w,d,top,tint(c,16));
      const n=Math.max(2,Math.round(w/.6));for(let i=0;i<n;i++){box(-w/2+w/n*(i+.5),d/2-d*.03,leg+body*.05,w/n*.975,d*.06,body*.84,tint(c,i%2?4:-5));box(-w/2+w/n*(i+.5),d/2-d*.008,leg+body*.6,Math.min(.055,w*.1),d*.016,Math.min(.018,h*.05),'#645644');}
    }else if(item.type==='tv'){
      const screenDepth=Math.min(.06,d*.3),stand=h*.13;
      box(0,0,0,w*.4,d,Math.min(.025,h*.04),'#33383b');box(0,0,0,w*.055,screenDepth,stand,'#40464a');
      box(0,0,stand,w,screenDepth,h-stand,c);box(0,screenDepth/2+.001,stand+h*.015,w*.962,.003,(h-stand)*.94,'#526774');
    }
    return out;
  }
  function transform(item,x,y){const a=item.rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return{x:x*c-y*s,y:x*s+y*c};}
  function polygons(item,scale){return parts(item).map((b,index)=>({b,index})).sort((a,b)=>(a.b.z+a.b.height)-(b.b.z+b.b.height)||a.index-b.index).map(({b})=>({color:b.color,points:[[-1,-1],[1,-1],[1,1],[-1,1]].map(([sx,sy])=>{const p=transform(item,b.x+sx*b.width/2,b.y+sy*b.depth/2);return{x:item.position.x+p.x/scale.x,y:item.position.y+p.y/scale.y};})}));}
  function hitTest(item,pixelPoint,scale){
    const dx=(pixelPoint.x-item.position.x)*scale.x,dy=(pixelPoint.y-item.position.y)*scale.y,a=item.rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a),x=dx*c+dy*s,y=-dx*s+dy*c;
    return parts(item).some(b=>Math.abs(x-b.x)<=b.width/2+1e-9&&Math.abs(y-b.y)<=b.depth/2+1e-9);
  }
  function meshes(items,scale){
    const errors=validate(items,scale);if(errors.length)throw new Error(errors.join('\n'));
    return (items||[]).flatMap(item=>parts(item).map((b,i)=>({id:item.id+'-part-'+i,kind:'furniture',color:b.color,vertices:[[0,-1,-1],[0,1,-1],[0,1,1],[0,-1,1],[1,-1,-1],[1,1,-1],[1,1,1],[1,-1,1]].map(([sz,sx,sy])=>{const p=transform(item,b.x+sx*b.width/2,b.y+sy*b.depth/2);return[item.position.x*scale.x+p.x,item.position.y*scale.y+p.y,b.z+sz*b.height];}),faces:[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]})));
  }
  return {defaults,validate,parts,meshes,polygons,hitTest};
});
