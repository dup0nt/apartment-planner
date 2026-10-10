/* Furniture dimensions are metres; placement remains tied to blueprint pixels. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.BlueprintFurniture=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const TYPES=['sofa','sofa-l','tv','tv-unit','chair','table-round','table-rounded','bookshelf','bed'];
  const finite=v=>typeof v==='number'&&Number.isFinite(v);
  function defaults(type,id,position){
    // 55-inch, 16:9 visible screen; compensate for the schematic bezel and stand below.
    const diagonal=55*.0254, screenWidth=diagonal*16/Math.hypot(16,9), screenHeight=diagonal*9/Math.hypot(16,9);
    const sizes={sofa:[2.1,1.1,.84],'sofa-l':[2.1,1.1,.84],tv:[screenWidth/.962,.26,screenHeight/(.87*.94)],'tv-unit':[1.79,.42,.56],chair:[.5,.55,.82],'table-round':[1.1,1.1,.75],'table-rounded':[1.4,.8,.75],bookshelf:[.8,.3,2],bed:[1.5,2,1]};
    if(!sizes[type])throw new Error('Unknown furniture type.');
    const [width,depth,height]=sizes[type];
    return {id,type,position:{x:position.x,y:position.y},rotation:0,width,depth,height,elevation:type==='tv'?.56:0,color:type==='tv'?'#30383b':['tv-unit','table-round','table-rounded','bookshelf'].includes(type)?'#ad855b':'#b9b19c',...(type==='bookshelf'?{shelfCount:5}:{}),...(type==='sofa-l'?{chaiseDepth:1.6,chaiseWidth:.85,chaiseSide:'left'}:{})};
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
      if(item.type==='table-round'&&(!finite(item.width)||!finite(item.depth)||Math.abs(item.width-item.depth)>1e-9))errors.push(name+' round table width and depth must be the same diameter.');
      if(item.type==='bookshelf'&&item.shelfCount!==undefined&&(!Number.isInteger(item.shelfCount)||item.shelfCount<2||item.shelfCount>10))errors.push(name+' shelf count must be an integer between 2 and 10.');
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
    const curved=(outline,z,height,color=c)=>out.push({x:0,y:0,z:z+e,width:w,depth:d,height,color,outline});
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
    }else if(item.type==='chair'){
      legs(0,0,w*.9,d*.9,h*.49);box(0,d*.04,h*.49,w,d*.85,h*.06,'#72563c');box(0,d*.04,h*.55,w*.95,d*.81,h*.055,tint(c,9));
      for(const sx of [-1,1])box(sx*w*.42,-d*.43,h*.48,w*.075,d*.08,h*.49,'#72563c');box(0,-d*.435,h*.73,w,d*.13,h*.27,c);
    }else if(item.type==='table-round'||item.type==='table-rounded'){
      const top=Math.min(.045,h*.1);
      if(item.type==='table-round'){
        curved(Array.from({length:64},(_,i)=>({x:Math.cos(i*Math.PI/32)*w/2,y:Math.sin(i*Math.PI/32)*d/2})),h-top,top,tint(c,12));
        // Four compact legs stay within the circular top, even at small diameters.
        for(const sx of [-1,1])for(const sy of [-1,1])box(sx*w*.23,sy*d*.23,0,w*.055,d*.055,h-top,tint(c,-12));
      }else{
        const r=Math.min(w,d)*.2,outline=[];
        for(const [cx,cy,start]of [[w/2-r,d/2-r,0],[-w/2+r,d/2-r,90],[-w/2+r,-d/2+r,180],[w/2-r,-d/2+r,270]])for(let i=0;i<=8;i++){const a=(start+i*90/8)*Math.PI/180;outline.push({x:cx+r*Math.cos(a),y:cy+r*Math.sin(a)});}
        curved(outline,h-top,top,tint(c,12));legs(0,0,w*.77,d*.77,h-top);
      }
    }else if(item.type==='bookshelf'){
      const t=Math.min(.025,w*.06,d*.1,h*.04),n=item.shelfCount===undefined?5:item.shelfCount;
      box(-w/2+t/2,0,0,t,d,h);box(w/2-t/2,0,0,t,d,h);box(0,-d/2+t/2,0,w,t,h,tint(c,-15));
      for(let i=0;i<=n;i++)box(0,0,i*(h-t)/n,w,d,t,tint(c,5));
      const colors=['#708775','#b97151','#426b79','#b9b19c'];
      for(let shelf=0;shelf<n;shelf++)for(let j=0;j<3;j++)box(-w*.29+j*w*.14,d*.025,t+shelf*(h-t)/n,w*.09,d*.65,(h-t)/n*(.55+.06*((shelf+j)%3)),colors[(shelf+j)%colors.length]);
    }else if(item.type==='bed'){
      legs(0,0,w*.91,d*.91,h*.12);box(0,0,h*.12,w,d,h*.2,'#ad855b');box(0,d*.025,h*.32,w*.96,d*.94,h*.19,tint(c,22));
      box(0,-d/2+d*.025,0,w,d*.05,h,c);box(0,d*.18,h*.51,w*.965,d*.6,h*.035,tint(c,-12));
      for(const sx of [-1,1])box(sx*w*.235,-d*.305,h*.51,w*.39,d*.2,h*.09,tint(c,35));
    }else if(item.type==='tv'){
      const screenDepth=Math.min(.06,d*.3),stand=h*.13;
      box(0,0,0,w*.4,d,Math.min(.025,h*.04),'#33383b');box(0,0,0,w*.055,screenDepth,stand,'#40464a');
      box(0,0,stand,w,screenDepth,h-stand,c);box(0,screenDepth/2+.001,stand+h*.015,w*.962,.003,(h-stand)*.94,'#526774');
    }
    return out;
  }
  function transform(item,x,y){const a=item.rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return{x:x*c-y*s,y:x*s+y*c};}
  // Every part is a convex prism; outlines are relative to the part centre.
  function outline(b){return b.outline||[[-1,-1],[1,-1],[1,1],[-1,1]].map(([sx,sy])=>({x:sx*b.width/2,y:sy*b.depth/2}));}
  function polygons(item,scale){return parts(item).map((b,index)=>({b,index})).sort((a,b)=>(a.b.z+a.b.height)-(b.b.z+b.b.height)||a.index-b.index).map(({b})=>({color:b.color,points:outline(b).map(q=>{const p=transform(item,b.x+q.x,b.y+q.y);return{x:item.position.x+p.x/scale.x,y:item.position.y+p.y/scale.y};})}));}
  function hitTest(item,pixelPoint,scale){
    const dx=(pixelPoint.x-item.position.x)*scale.x,dy=(pixelPoint.y-item.position.y)*scale.y,a=item.rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a),x=dx*c+dy*s,y=-dx*s+dy*c;
    return parts(item).some(b=>{const p=outline(b);let positive=false,negative=false;for(let i=0;i<p.length;i++){const q=p[i],r=p[(i+1)%p.length],cross=(r.x-q.x)*(y-b.y-q.y)-(r.y-q.y)*(x-b.x-q.x);positive=positive||cross>1e-9;negative=negative||cross< -1e-9;if(positive&&negative)return false;}return true;});
  }
  function meshes(items,scale){
    const errors=validate(items,scale);if(errors.length)throw new Error(errors.join('\n'));
    return (items||[]).flatMap(item=>parts(item).map((b,i)=>{
      const points=outline(b),n=points.length,indices=points.map((_,i)=>i);
      const vertices=[0,1].flatMap(sz=>points.map(q=>{const p=transform(item,b.x+q.x,b.y+q.y);return[item.position.x*scale.x+p.x,item.position.y*scale.y+p.y,b.z+sz*b.height];}));
      const faces=[indices.slice().reverse(),indices.map(i=>i+n),...indices.map(i=>[i,(i+1)%n,(i+1)%n+n,i+n])];
      return {id:item.id+'-part-'+i,kind:'furniture',color:b.color,vertices,faces};
    }));
  }
  return {defaults,validate,parts,meshes,polygons,hitTest};
});
