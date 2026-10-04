# blueprint-project-v1
Geometry steward -> rendering consumer; assurance reviews. Local interactive editor adds a separate source model without changing legacy planner.py JSON.

Project JSON:
```
{version:1,name:string,image:{src:string,width:number,height:number},
 scale:{x:number,y:number,calibrated:boolean},
 defaults:{height:2.5,thickness:0.12},
 walls:[{id:string,a:{x:number,y:number},b:{x:number,y:number},height:number,thickness:number,
 openings:[{id:string,type:'door'|'window',offset:number,width:number,height:number,sill:number,hinge:'start'|'end',swing:1|-1}]}],
 dimensions:[{id:string,a:{x:number,y:number},b:{x:number,y:number},label:string,metres:number|null}],
 notes:string}
```
All a/b coordinates are source image pixels. scale.x/y are positive metres per pixel. Wall thickness/height and opening offset/width/height/sill are metres. Opening offset is along the wall from a; hinges refer to start/end of opening along wall. Window swing is not inferred. Source labels are transcriptions, not OCR. Default scale may be visual-only with calibrated:false. Stored image can be a local relative reference URL (demo) or PNG/JPEG/WebP data URL. Imports must validate and forbid remote/executable image sources.

web/geometry.js is classic script exposing global BlueprintGeometry AND CommonJS module.exports for Node tests. Public API:
- validateProject(project): {errors:string[],warnings:string[]}; never mutates input.
- wallLength(wall,scale): metres.
- pixelToWorld(point,scale): {x,y} metres.
- projectToMeshes(project): array {id,kind,color,vertices:[[x,y,z],...],faces:[[indices...],...]}; x right, y down plan, z up. Must cut actual wall holes and show door leaf/swing as explicit geometry; no inferred floor polygons required.
- suggestWalls(imageData, options?): array {a:{x,y},b:{x,y}} pixel line candidates, optional assist only.

web/renderer3d.js exposes global Blueprint3D class:
constructor(canvas); setScene(meshes,{bounds?:{width,height},dimensions?:array,scale?:object}); resize(); reset(); setCutaway(boolean); destroy(); screenshot():dataURL. Geometry may be simplified visually only in explicit cutaway mode; source/measurements remain unchanged. No external libraries/CDNs. Root UI invokes these globals.

Renderer dimensions array is resolved [{a:{x,y},b:{x,y},label:string}] in world metres for 3D labels; UI passes if available. Renderer must tolerate empty scenes and WebGL unavailability with a user-readable fallback. Main image and editor stay usable without WebGL.

## Optional furniture extension (backward compatible)
`furniture` defaults to an empty array when absent. Each item has globally unique `id`, `type` (`sofa`, `sofa-l`, `tv`, `tv-unit`), `position:{x,y}` in source pixels, `rotation` in clockwise plan degrees, `width/depth/height/elevation` in metres and a hex `color`. Position is the base width/depth centre. A chaise extends forward in local +Y, with `chaiseDepth` its overall depth, `chaiseWidth` its width and `chaiseSide` left/right in unrotated plan coordinates. The free corner remains empty. Elevation is the bottom above the floor. Furniture dimensions stay metric during scale recalibration while the pixel-space anchor remains unchanged.

BlueprintFurniture validates furniture before import/edits and generates shared component geometry for 2D/SVG, hit testing and 3D meshes. Detailed components are schematic furniture shapes, not manufacturer CAD. Placement is unrestricted and does not certify door, wall or circulation clearance. Furniture participates in save/reopen, undo/redo and explicit selected-item deletion. Clear traces retains furniture. Furniture meshes use kind `furniture` and remain unaffected by wall cutaway.

## Optional room-focus extension
`rooms` defaults to an empty array: `{id,name,points:[{x,y}]}` uses simple source-pixel polygons, including concave outlines. IDs are globally unique. `roomView` defaults to `{selectedRoomIds:[],hideOthers:false}`. No selected rooms means full view, including when Hide other rooms is checked. Presets are manually traced viewing regions, not architectural evidence. Legacy projects containing the exact supplied demo image may receive its room presets on load; unrelated images receive no inferred rooms.

Masks are view-only. Canvas and SVG clip to selected-region union; 3D clips existing faces to corresponding vertical prisms without generating architectural cap faces. Source walls, furniture and measurements are untouched. Room polygons/view state persist in JSON and undo history. Hidden dimensions/openings/hit candidates are excluded; shared walls extending outside the selection require Show all before whole-wall editing/deletion. Partial furniture remains movable as a whole object. Region coordinates are finite and bounded; invalid/self-intersecting polygons rejected. Custom room outlining temporarily shows the full reference.
