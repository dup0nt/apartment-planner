/* Presentation-only renderer for blueprint-project-v1. No source mesh is mutated. */
(function (global) {
  'use strict';
  const sub = (a,b) => a.map((v,i)=>v-b[i]);
  const dot = (a,b) => a.reduce((n,v,i)=>n+v*b[i],0);
  const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const unit = a => { const n=Math.hypot(...a)||1; return a.map(v=>v/n); };
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  function color(value,kind) {
    const defaults={wall:'#e4ddce',door:'#a98760',window:'#84b8c3','door-swing':'#a98760'};
    value=typeof value==='string'?value:(defaults[kind]||'#b8ada0');
    const m=value.match(/^#([\da-f]{6}|[\da-f]{3})$/i);
    if (!m) return [.75,.72,.66];
    const h=m[1].length===3?m[1].split('').map(c=>c+c).join(''):m[1];
    return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255);
  }
  class Blueprint3D {
    constructor(canvas) {
      this.canvas=canvas; this.meshes=[]; this.dimensions=[]; this.cutaway=false;
      this.bounds={minX:0,minY:0,maxX:10,maxY:10,maxZ:2.5}; this.listeners=[];
      this.canvas.style.touchAction='none'; this.canvas.style.cursor='grab';
      this.canvas.setAttribute('aria-label','Interactive 3D model. Drag to orbit, scroll to zoom. Arrow keys orbit, plus and minus zoom, Home resets.');
      if (!this.canvas.hasAttribute('tabindex')) this.canvas.tabIndex=0;
      this.overlay=document.createElement('canvas');
      this.overlay.setAttribute('aria-hidden','true');
      Object.assign(this.overlay.style,{position:'absolute',left:'0',top:'0',width:'100%',height:'100%',pointerEvents:'none'});
      const parent=canvas.parentElement;
      if (parent) { this.oldParentPosition=parent.style.position; if(getComputedStyle(parent).position==='static')parent.style.position='relative'; parent.appendChild(this.overlay); }
      this.ctx=this.overlay.getContext('2d');
      try { this.gl=canvas.getContext('webgl',{antialias:true,alpha:false,preserveDrawingBuffer:true}); if(this.gl)this.initGL(); } catch(e) { this.gl=null; }
      this.listen(canvas,'pointerdown',e=>{if(e.button!==0)return;this.drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);canvas.style.cursor='grabbing';});
      this.listen(canvas,'pointermove',e=>{if(!this.drag||this.drag.id!==e.pointerId)return;this.yaw-=(e.clientX-this.drag.x)*.007;this.pitch=clamp(this.pitch+(e.clientY-this.drag.y)*.006,.10,1.50);this.drag.x=e.clientX;this.drag.y=e.clientY;this.render();});
      const release=()=>{this.drag=null;canvas.style.cursor='grab';};
      this.listen(canvas,'pointerup',release);this.listen(canvas,'pointercancel',release);this.listen(canvas,'lostpointercapture',release);
      this.listen(canvas,'wheel',e=>{e.preventDefault();this.distance=clamp(this.distance*Math.exp(clamp(e.deltaY,-150,150)*.0015),this.span*.35,this.span*10);this.render();},{passive:false});
      this.listen(canvas,'keydown',e=>{let used=true;switch(e.key){case 'ArrowLeft':this.yaw-=.1;break;case 'ArrowRight':this.yaw+=.1;break;case 'ArrowUp':this.pitch=clamp(this.pitch+.08,.1,1.5);break;case 'ArrowDown':this.pitch=clamp(this.pitch-.08,.1,1.5);break;case '+':case '=':this.distance=Math.max(this.span*.35,this.distance*.9);break;case '-':this.distance=Math.min(this.span*10,this.distance/ .9);break;case 'Home':this.reset();break;default:used=false;}if(used){e.preventDefault();this.render();}});
      this.listen(canvas,'webglcontextlost',e=>{e.preventDefault();this.contextLost=true;this.render();});
      this.listen(canvas,'webglcontextrestored',()=>{this.contextLost=false;this.initGL();this.render();});
      this.reset();
      if(typeof ResizeObserver!=='undefined'){this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(canvas);}else this.listen(global,'resize',()=>this.resize());
      this.resize();
    }
    listen(el,type,fn,options){el.addEventListener(type,fn,options);this.listeners.push(()=>el.removeEventListener(type,fn,options));}
    initGL(){
      const gl=this.gl;
      const compile=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
      const vs=compile(gl.VERTEX_SHADER,'attribute vec3 aPosition; attribute vec3 aColor; attribute float aCut; uniform vec3 uEye; uniform vec3 uRight; uniform vec3 uUp; uniform vec3 uForward; uniform float uAspect; uniform float uFar; varying vec3 vColor; varying float vHeight; varying float vCut; void main(){vec3 p=aPosition-uEye;float d=dot(p,uForward);float n=0.02;gl_Position=vec4(dot(p,uRight)*1.9/uAspect,dot(p,uUp)*1.9,((uFar+n)/(uFar-n))*d-2.0*uFar*n/(uFar-n),d);vColor=aColor;vHeight=aPosition.z;vCut=aCut;}');
      const fs=compile(gl.FRAGMENT_SHADER,'precision mediump float; varying vec3 vColor; varying float vHeight; varying float vCut; uniform float uCutaway; void main(){if(uCutaway>0.5 && vCut>0.5 && vHeight>0.95)discard;gl_FragColor=vec4(vColor,1.0);}');
      this.program=gl.createProgram();gl.attachShader(this.program,vs);gl.attachShader(this.program,fs);gl.linkProgram(this.program);gl.deleteShader(vs);gl.deleteShader(fs);
      if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error('Cannot initialize 3D view');
      this.buffer=gl.createBuffer();this.attrs={};this.uniforms={};
      ['aPosition','aColor','aCut'].forEach(k=>this.attrs[k]=gl.getAttribLocation(this.program,k));
      ['uEye','uRight','uUp','uForward','uAspect','uFar','uCutaway'].forEach(k=>this.uniforms[k]=gl.getUniformLocation(this.program,k));
    }
    setScene(meshes,options={}){
      this.meshes=Array.isArray(meshes)?meshes:[];this.dimensions=Array.isArray(options.dimensions)?options.dimensions:[];
      const b={minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity,maxZ:0};
      for(const mesh of this.meshes)for(const p of mesh.vertices||[])if(p.length>=3&&p.every(Number.isFinite)){b.minX=Math.min(b.minX,p[0]);b.maxX=Math.max(b.maxX,p[0]);b.minY=Math.min(b.minY,p[1]);b.maxY=Math.max(b.maxY,p[1]);b.maxZ=Math.max(b.maxZ,p[2]);}
      if(!Number.isFinite(b.minX)){b.minX=0;b.minY=0;b.maxX=options.bounds?.width||10;b.maxY=options.bounds?.height||10;}
      const first=!this.hadScene,previousSpan=this.span||1;this.bounds=b;this.span=Math.max(b.maxX-b.minX,b.maxY-b.minY,b.maxZ,1);if(!options.preserveCamera)this.target=[(b.minX+b.maxX)/2,(b.minY+b.maxY)/2,b.maxZ*.17];
      if(first){this.reset();this.hadScene=this.meshes.length>0;}else if(!options.preserveCamera){this.distance*=this.span/previousSpan;}this.render();
    }
    focus(x,y,size){this.target=[x,y,.35];this.distance=Math.max(2.5,size*2.5);this.render();}
    reset(){const b=this.bounds;this.span=Math.max(b.maxX-b.minX,b.maxY-b.minY,b.maxZ,1);this.target=[(b.minX+b.maxX)/2,(b.minY+b.maxY)/2,b.maxZ*.17];this.yaw=-Math.PI*.65;this.pitch=.88;this.distance=this.span*1.65;this.render();}
    setCutaway(value){this.cutaway=Boolean(value);this.render();}
    resize(){if(this.destroyed)return;const r=this.canvas.getBoundingClientRect();this.width=Math.max(1,r.width);this.height=Math.max(1,r.height);const dpr=Math.min(global.devicePixelRatio||1,2);const w=Math.round(this.width*dpr),h=Math.round(this.height*dpr);if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}this.overlay.width=w;this.overlay.height=h;this.dpr=dpr;this.render();}
    camera(){
      const t=this.target, cp=Math.cos(this.pitch);this.eye=[t[0]+Math.cos(this.yaw)*cp*this.distance,t[1]+Math.sin(this.yaw)*cp*this.distance,t[2]+Math.sin(this.pitch)*this.distance];this.forward=unit(sub(t,this.eye));this.right=unit(cross(this.forward,[0,0,1]));this.up=cross(this.right,this.forward);
    }
    project(p){const q=sub(p,this.eye),d=dot(q,this.forward);if(d<=.02)return null;return {x:this.width/2+dot(q,this.right)*1.9/d*this.height/2,y:this.height/2-dot(q,this.up)*1.9/d*this.height/2};}
    render(){
      if(this.destroyed||!this.ctx||!this.width)return;
      this.camera();const ctx=this.ctx;ctx.setTransform(this.dpr,0,0,this.dpr,0,0);ctx.clearRect(0,0,this.width,this.height);
      if(!this.gl||this.contextLost){ctx.fillStyle='#f0eee8';ctx.fillRect(0,0,this.width,this.height);ctx.fillStyle='#554f43';ctx.font='14px system-ui';ctx.textAlign='center';ctx.fillText(this.contextLost?'3D view paused. Restoring graphics…':'3D graphics are unavailable in this browser.',this.width/2,this.height/2-12);ctx.fillText('Your blueprint and editing tools remain available.',this.width/2,this.height/2+12);return;}
      const gl=this.gl;gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.clearColor(.94,.935,.915,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.useProgram(this.program);
      const u=this.uniforms;gl.uniform3fv(u.uEye,this.eye);gl.uniform3fv(u.uRight,this.right);gl.uniform3fv(u.uUp,this.up);gl.uniform3fv(u.uForward,this.forward);gl.uniform1f(u.uAspect,this.width/this.height);gl.uniform1f(u.uFar,this.span*30);gl.uniform1f(u.uCutaway,this.cutaway?1:0);
      const triangles=[],edges=[];const push=(dest,p,c,cut)=>dest.push(p[0],p[1],p[2],c[0],c[1],c[2],cut);
      const b=this.bounds,pad=this.span*.12;const x0=b.minX-pad,x1=b.maxX+pad,y0=b.minY-pad,y1=b.maxY+pad;
      const floor=[[x0,y0,-.025],[x1,y0,-.025],[x1,y1,-.025],[x0,y1,-.025]];
      for(const i of [0,1,2,0,2,3])push(triangles,floor[i],[.905,.90,.873],0);
      const step=Math.pow(10,Math.floor(Math.log10(this.span/8)));const gridStep=this.span/step>35?step*5:step;
      for(let x=Math.ceil(x0/gridStep)*gridStep;x<=x1;x+=gridStep){push(edges,[x,y0,-.018],[.84,.84,.81],0);push(edges,[x,y1,-.018],[.84,.84,.81],0);}
      for(let y=Math.ceil(y0/gridStep)*gridStep;y<=y1;y+=gridStep){push(edges,[x0,y,-.018],[.84,.84,.81],0);push(edges,[x1,y,-.018],[.84,.84,.81],0);}
      const light=unit([-.4,-.65,1]);
      for(const mesh of this.meshes){const vertices=mesh.vertices||[],base=color(mesh.color,mesh.kind),cut=/wall/i.test(mesh.kind||'')?1:0;
        for(const face of mesh.faces||[]){const ps=face.map(i=>vertices[i]);if(ps.length<2||ps.some(p=>!p||!p.every(Number.isFinite)))continue;
          if(ps.length>=3){const n=unit(cross(sub(ps[1],ps[0]),sub(ps[2],ps[0]))),shade=.69+.31*Math.abs(dot(n,light));const c=base.map(v=>v*shade);for(let i=1;i<ps.length-1;i++)for(const p of [ps[0],ps[i],ps[i+1]])push(triangles,p,c,cut);}
          const ec=base.map(v=>v*.67);for(let i=0;i<ps.length;i++){push(edges,ps[i],ec,cut);push(edges,ps[(i+1)%ps.length],ec,cut);}
        }
      }
      const draw=(data,mode)=>{gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.DYNAMIC_DRAW);for(const [key,size,offset] of [['aPosition',3,0],['aColor',3,12],['aCut',1,24]]){gl.enableVertexAttribArray(this.attrs[key]);gl.vertexAttribPointer(this.attrs[key],size,gl.FLOAT,false,28,offset);}gl.drawArrays(mode,0,data.length/7);};
      gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(1,1);draw(triangles,gl.TRIANGLES);gl.disable(gl.POLYGON_OFFSET_FILL);draw(edges,gl.LINES);
      ctx.font='11px system-ui';ctx.textAlign='center';
      for(const d of this.dimensions){if(!d.a||!d.b)continue;const a=this.project([d.a.x,d.a.y,.05]),z=this.project([d.b.x,d.b.y,.05]);if(!a||!z)continue;ctx.strokeStyle='rgba(55,99,90,.7)';ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(z.x,z.y);ctx.stroke();ctx.setLineDash([]);const label=String(d.label||''),x=(a.x+z.x)/2,y=(a.y+z.y)/2;const w=ctx.measureText(label).width+12;ctx.fillStyle='rgba(255,255,251,.94)';ctx.fillRect(x-w/2,y-10,w,18);ctx.fillStyle='#28594e';ctx.fillText(label,x,y+3);}
      ctx.textAlign='left';ctx.font='11px system-ui';ctx.fillStyle='#68675e';ctx.fillText(this.cutaway?'CUTAWAY · walls clipped at 0.95 m':'FULL HEIGHT',16,24);
      if(!this.meshes.length){ctx.textAlign='center';ctx.font='15px system-ui';ctx.fillText('Trace a wall to start your 3D model',this.width/2,this.height/2);}
    }
    screenshot(){this.render();const image=document.createElement('canvas');image.width=this.canvas.width;image.height=this.canvas.height;const ctx=image.getContext('2d');if(this.gl&&!this.contextLost)ctx.drawImage(this.canvas,0,0);ctx.drawImage(this.overlay,0,0);return image.toDataURL('image/png');}
    destroy(){this.destroyed=true;if(this.observer)this.observer.disconnect();this.listeners.forEach(fn=>fn());this.overlay.remove();if(this.gl){this.gl.deleteBuffer(this.buffer);this.gl.deleteProgram(this.program);}const parent=this.canvas.parentElement;if(parent&&this.oldParentPosition!==undefined)parent.style.position=this.oldParentPosition;}
  }
  global.Blueprint3D=Blueprint3D;
})(window);
