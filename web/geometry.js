/* Pixel traces are evidence; an uncalibrated scale is only a visual estimate. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.BlueprintGeometry = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  const positive = value => finite(value) && value > 0;
  const point = value => value && finite(value.x) && finite(value.y);
  const EPS = 1e-8;
  function pixelToWorld(p, scale) { return {x: p.x * scale.x, y: p.y * scale.y}; }
  function wallLength(wall, scale) {
    return Math.hypot((wall.b.x - wall.a.x) * scale.x, (wall.b.y - wall.a.y) * scale.y);
  }
  function safeImage(src) {
    if (typeof src !== 'string' || !src) return false;
    if (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(src)) return true;
    // No schemes, root paths, escapes, query strings, fragments, or traversal.
    return /^(?:\.\/)?[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_.-]+)*\.(?:png|jpe?g|webp)$/i.test(src)
      && !src.replace(/^\.\//, '').split('/').some(part => part === '..' || part === '.');
  }
  function validateProject(p) {
    const errors = [], warnings = [], ids = new Set();
    const error = message => errors.push(message);
    const id = (value, path) => {
      if (typeof value !== 'string' || !value.trim() || value.length > 200) error(path + ' must have a nonempty ID (maximum 200 characters).');
      else if (ids.has(value)) error(path + ' has a duplicate ID: ' + value);
      else ids.add(value);
    };
    if (!p || typeof p !== 'object' || Array.isArray(p)) return {errors:['Project must be an object.'], warnings};
    if (p.version !== 1) error('Unsupported project version.');
    if (typeof p.name !== 'string') error('Project name must be text.');
    if (typeof p.notes !== 'string') error('Project notes must be text.');
    if (!p.image || !safeImage(p.image.src)) error('Image source must be a safe local raster path or PNG/JPEG/WebP base64 data URL.');
    if (!p.image || !positive(p.image.width) || !positive(p.image.height) || p.image.width > 16000 || p.image.height > 16000) error('Image dimensions must be finite, positive and at most 16000 pixels.');
    const scaleOK = p.scale && positive(p.scale.x) && positive(p.scale.y);
    if (!scaleOK || typeof p.scale.calibrated !== 'boolean') error('Scale requires positive finite x/y values and a calibrated boolean.');
    if (p.scale && p.scale.calibrated === false) warnings.push('Scale is uncalibrated: all derived measurements are visual estimates, not confirmed dimensions.');
    if (!p.defaults || !positive(p.defaults.height) || !positive(p.defaults.thickness)) error('Default wall height and thickness must be finite and positive.');
    if (!Array.isArray(p.walls)) error('Walls must be an array.');
    else p.walls.forEach((wall, index) => {
      const path = 'Wall ' + index;
      if (!wall || typeof wall !== 'object') { error(path + ' must be an object.'); return; }
      id(wall.id, path);
      const coordinatesOK = point(wall.a) && point(wall.b);
      if (!coordinatesOK) error(path + ' endpoints must be finite coordinates.');
      if (coordinatesOK && scaleOK && (!point(pixelToWorld(wall.a,p.scale)) || !point(pixelToWorld(wall.b,p.scale)))) error(path + ' transformed endpoints must remain finite.');
      const length = coordinatesOK && scaleOK ? wallLength(wall, p.scale) : NaN;
      if (coordinatesOK && scaleOK && (!finite(length) || length <= EPS)) error(path + ' must have nonzero finite length.');
      if (!positive(wall.height) || !positive(wall.thickness)) error(path + ' height and thickness must be finite and positive.');
      if (!Array.isArray(wall.openings)) { error(path + ' openings must be an array.'); return; }
      const intervals = [];
      wall.openings.forEach((o, i) => {
        const op = path + ' opening ' + i;
        if (!o || typeof o !== 'object') { error(op + ' must be an object.'); return; }
        id(o.id, op);
        if (!['door','window'].includes(o.type)) error(op + ' type must be door or window.');
        if (!finite(o.offset) || o.offset < 0 || !positive(o.width) || !positive(o.height) || !finite(o.sill) || o.sill < 0) error(op + ' dimensions must be finite, with positive width/height and nonnegative offset/sill.');
        if (!['start','end'].includes(o.hinge) || ![1,-1].includes(o.swing)) error(op + ' requires hinge start/end and swing 1/-1.');
        if (finite(length) && finite(o.offset) && positive(o.width) && o.offset + o.width > length + EPS) error(op + ' extends beyond its wall.');
        if (positive(o.height) && finite(o.sill) && o.sill + o.height > wall.height + EPS) error(op + ' extends above its wall.');
        if (o.type === 'door' && o.sill !== 0) error(op + ' door sill must be zero.');
        if (finite(o.offset) && positive(o.width)) intervals.push({start:o.offset,end:o.offset+o.width});
      });
      intervals.sort((a,b) => a.start-b.start);
      for (let i=1; i<intervals.length; i++) if (intervals[i].start < intervals[i-1].end-EPS) error(path + ' openings overlap.');
    });
    if (!Array.isArray(p.dimensions)) error('Dimensions must be an array.');
    else p.dimensions.forEach((d, i) => {
      const path = 'Dimension ' + i;
      if (!d || typeof d !== 'object') { error(path + ' must be an object.'); return; }
      id(d.id,path);
      if (!point(d.a) || !point(d.b)) error(path + ' endpoints must be finite coordinates.');
      else if (d.a.x === d.b.x && d.a.y === d.b.y) error(path + ' must have distinct endpoints.');
      if (point(d.a) && point(d.b) && scaleOK && (!point(pixelToWorld(d.a,p.scale)) || !point(pixelToWorld(d.b,p.scale)) || !finite(wallLength(d,p.scale)))) error(path + ' transformed length and endpoints must remain finite.');
      if (typeof d.label !== 'string') error(path + ' label must be text.');
      if (d.metres !== null && !positive(d.metres)) error(path + ' metres must be positive and finite, or null.');
      if (point(d.a) && point(d.b) && scaleOK && positive(d.metres) && p.scale.calibrated) {
        const measured = wallLength(d,p.scale);
        if (Math.abs(measured-d.metres) > Math.max(0.03,d.metres*0.02)) warnings.push(path + ' source measurement disagrees with calibrated trace by more than 2% or 3 cm.');
      }
    });
    return {errors,warnings};
  }
  const faces = [[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]];
  function box(id,kind,color,origin,u,n,start,end,thickness,bottom,top) {
    const vertices = [];
    for (const z of [bottom,top]) for (const [s,t] of [[start,-thickness/2],[end,-thickness/2],[end,thickness/2],[start,thickness/2]]) vertices.push([origin.x+u.x*s+n.x*t,origin.y+u.y*s+n.y*t,z]);
    return {id,kind,color,vertices,faces:faces.map(f=>f.slice())};
  }
  function projectToMeshes(project) {
    const validation = validateProject(project);
    if (validation.errors.length) throw new Error(validation.errors.join('\n'));
    const meshes = [];
    project.walls.forEach(wall => {
      const origin = pixelToWorld(wall.a,project.scale), end = pixelToWorld(wall.b,project.scale), length = wallLength(wall,project.scale);
      const u = {x:(end.x-origin.x)/length,y:(end.y-origin.y)/length}, n = {x:-u.y,y:u.x};
      let cursor = 0, part = 0;
      const solid = (a,b,z0,z1) => { if (b-a>EPS && z1-z0>EPS) meshes.push(box(wall.id+':'+part++,'wall','#d7cec0',origin,u,n,a,b,wall.thickness,z0,z1)); };
      [...wall.openings].sort((a,b)=>a.offset-b.offset).forEach(o => {
        solid(cursor,o.offset,0,wall.height);
        solid(o.offset,o.offset+o.width,0,o.sill);
        solid(o.offset,o.offset+o.width,o.sill+o.height,wall.height);
        if (o.type === 'window') meshes.push(box(o.id,'glass','#90bdcc',origin,u,n,o.offset,o.offset+o.width,Math.min(0.015,wall.thickness),o.sill,o.sill+o.height));
        else {
          const hingeAt = o.offset+(o.hinge === 'end' ? o.width : 0), sign = o.hinge === 'start' ? 1 : -1;
          const hinge = {x:origin.x+u.x*hingeAt,y:origin.y+u.y*hingeAt};
          const leafU = {x:n.x*o.swing,y:n.y*o.swing}, leafN = {x:-leafU.y,y:leafU.x};
          meshes.push(box(o.id,'door','#b88b57',hinge,leafU,leafN,0,o.width,0.035,0,o.height));
          // A thin quarter-circle ribbon records the explicit hinge and swing side.
          const vertices = [], arcFaces = [], steps = 20;
          for (let i=0;i<=steps;i++) {
            const theta = i/steps*Math.PI/2;
            for (const radius of [o.width-0.008,o.width+0.008]) vertices.push([hinge.x+radius*(u.x*sign*Math.cos(theta)+n.x*o.swing*Math.sin(theta)),hinge.y+radius*(u.y*sign*Math.cos(theta)+n.y*o.swing*Math.sin(theta)),0.012]);
            if (i) arcFaces.push([2*i-2,2*i,2*i+1,2*i-1]);
          }
          meshes.push({id:o.id+':swing',kind:'swing',color:'#a07748',vertices,faces:arcFaces});
        }
        cursor = o.offset+o.width;
      });
      solid(cursor,length,0,wall.height);
    });
    return meshes;
  }
  function suggestWalls(imageData, options) {
    // Conservative ink-run assist, never a reconstruction or confirmed wall detector.
    options = options || {};
    if (!imageData || !Number.isInteger(imageData.width) || !Number.isInteger(imageData.height) || imageData.width<=0 || imageData.height<=0 || !imageData.data || imageData.data.length !== imageData.width*imageData.height*4) return [];
    const {width,height,data} = imageData, candidates = [];
    const minimum = Math.max(20,finite(options.minLength)?options.minLength:Math.min(width,height)*0.12);
    const limit = Math.max(0,Math.min(80,Number.isInteger(options.limit)?options.limit:40));
    const step = Math.max(2,Math.ceil(Math.max(width,height)/700));
    const ink = (x,y) => {const i=(y*width+x)*4; return data[i+3]>180 && data[i]+data[i+1]+data[i+2]<240;};
    for (const vertical of [false,true]) {
      const along = vertical?height:width, across = vertical?width:height;
      for (let c=0;c<across;c+=step) {
        let start=-1;
        for (let s=0;s<=along;s++) {
          if (s<along && ink(vertical?c:s,vertical?s:c)) {if(start<0) start=s;}
          else if(start>=0) {
            if(s-start>=minimum && !candidates.some(v=>v.vertical===vertical && Math.abs(v.c-c)<step*3 && Math.abs(v.start-start)<step*3 && Math.abs(v.end-s)<step*3)) candidates.push({vertical,c,start,end:s-1});
            start=-1;
            if(candidates.length>=limit) return candidates.slice(0,limit).map(convert);
          }
        }
      }
    }
    return candidates.slice(0,limit).map(convert);
    function convert(v) {return v.vertical?{a:{x:v.c,y:v.start},b:{x:v.c,y:v.end}}:{a:{x:v.start,y:v.c},b:{x:v.end,y:v.c}};}
  }
  function alignRuler(a,p,wall,scale,mode='auto') {
    const dx=(wall.b.x-wall.a.x)*scale.x,dy=(wall.b.y-wall.a.y)*scale.y,L=Math.hypot(dx,dy),ux=dx/L,uy=dy/L;
    const vx=(p.x-a.x)*scale.x,vy=(p.y-a.y)*scale.y,along=vx*ux+vy*uy,across=-vx*uy+vy*ux;
    const parallel=mode==='parallel'||(mode==='auto'&&Math.abs(along)>=Math.abs(across));
    return parallel?{x:a.x+along*ux/scale.x,y:a.y+along*uy/scale.y}:{x:a.x-across*uy/scale.x,y:a.y+across*ux/scale.y};
  }
  return {validateProject,wallLength,pixelToWorld,projectToMeshes,suggestWalls,alignRuler};
});
