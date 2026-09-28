#!/usr/bin/env python3
"""Deterministic, dependency-free living-room geometry and rendering."""
import argparse,hashlib,html,json,math,pathlib,sys
ROOT=pathlib.Path(__file__).resolve().parent

def load(layout):
 a=json.loads((ROOT/'data/architecture.json').read_text());l=json.loads((ROOT/'data'/f'{layout}.json').read_text())
 return a,l

def polygon(a):
 d={k:v['value'] for k,v in a['dimensions'].items()};w,h,n,t=d['width'],d['length'],d['notch_x'],d['notch_y']
 return [[0,0],[w,0],[w,h],[n,h],[n,t],[0,t]]

def rect(o):return (o['x'],o['y'],o['width'],o['depth'])
def intersects(a,b):
 x,y,w,h=a;X,Y,W,H=b
 return min(x+w,X+W)>max(x,X)+1e-9 and min(y+h,Y+H)>max(y,Y)+1e-9

def validate(a,l,strict=False):
 d={k:v['value'] for k,v in a['dimensions'].items()};errors=[];warnings=[]
 unknown=[k for k,v in a['dimensions'].items() if v['status']=='assumed']+[o['id'] for o in a['doors'] if o['status']!='confirmed']
 if a['glazing']['operation']=='unknown':unknown+=['glazing.operation']
 if unknown:(errors if strict else warnings).append('Unverified architecture: '+', '.join(unknown))
 fs=l['furniture'];ids=[f['id'] for f in fs]
 if len(ids)!=len(set(ids)):errors.append('Duplicate furniture IDs')
 for i,f in enumerate(fs):
  x,y,w,h=rect(f)
  if min(w,h,f['height'])<=0:errors.append(f['id']+': non-positive size')
  if x<0 or y<0 or x+w>d['width']+1e-9 or y+h>d['length']+1e-9 or intersects(rect(f),(0,d['notch_y'],d['notch_x'],d['length']-d['notch_y'])):errors.append(f['id']+': outside room')
  for g in fs[i+1:]:
   if intersects(rect(f),rect(g)):errors.append(f['id']+' overlaps '+g['id'])
  for r in a['clearance_reserves']:
   if intersects(rect(f),r['rect']):errors.append(f['id']+' enters '+r['id'])
  # A conservative AABB for the sampled swept leaf sector; catches conflicts even if overly conservative.
  for door in a['doors']:
   hx,hy=door['hinge'];angles=[math.radians(door['closed_angle_deg']+door['swing_deg']*j/90) for j in range(91)]
   xs=[hx]+[hx+door['width']*math.cos(t) for t in angles];ys=[hy]+[hy+door['width']*math.sin(t) for t in angles]
   if intersects(rect(f),(min(xs),min(ys),max(xs)-min(xs),max(ys)-min(ys))):errors.append(f['id']+' enters conservative '+door['id']+' swing bound')
 warnings+=['Static footprint checks only: no certification of chair pull-out, accessibility, acoustics or continuous route width.','Furniture is represented by external envelopes, not manufacturer models.']
 return {'layout':l['id'],'status':'FAIL' if errors else 'PROVISIONAL','errors':errors,'warnings':warnings}

def walls(a):
 d={k:v['value'] for k,v in a['dimensions'].items()};w,h,n,t,th,H=[d[k] for k in ['width','length','notch_x','notch_y','wall_thickness','wall_height']]
 hall=next(o for o in a['doors'] if o['id']=='hall');kit=next(o for o in a['doors'] if o['id']=='kitchen')
 # The schema explicitly supports the two known horizontal wall apertures.
 hs=hall['hinge'][0];he=hs+hall['width'];ke=kit['hinge'][0];ks=ke-kit['width']
 assert abs(kit['hinge'][1]-t)<1e-8,'Kitchen hinge must track notch_y'
 seg=[('north_left',0,-th,hs,th),('north_right',he,-th,w-he,th),('west',-th,0,th,t),('east',w,0,th,h),('notch_left',0,t,ks,th),('notch_right',ke,t,n-ke,th),('notch_vertical',n-th,t+th,th,h-t-th)]
 return [dict(id=id,x=x,y=y,z=0,width=W,depth=D,height=H,color='#e1ded4',kind='wall') for id,x,y,W,D in seg if W>0 and D>0]

def meshes(a,l):
 objects=walls(a)+[dict(f,z=0,kind='furniture') for f in l['furniture']]
 out=[]
 for o in objects:
  x,y,z=o['x'],o['y'],o['z'];w,d,h=o['width'],o['depth'],o['height']
  if o.get('shape')=='cylinder':
   vs=[[x+w/2+w/2*math.cos(i*math.tau/32),y+d/2+d/2*math.sin(i*math.tau/32),Z] for Z in [z,z+h] for i in range(32)]
   faces=[list(range(31,-1,-1)),list(range(32,64))]+[[i,(i+1)%32,(i+1)%32+32,i+32] for i in range(32)]
  else:
   vs=[[x+dx*w,y+dy*d,z+dz*h] for dx,dy,dz in [(0,0,0),(1,0,0),(1,1,0),(0,1,0),(0,0,1),(1,0,1),(1,1,1),(0,1,1)]]
   faces=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]
  out.append(dict(id=o['id'],kind=o['kind'],color=o['color'],vertices=vs,faces=faces))
 # Explicit leaf geometry, at 70% open, derived from the same hinge and swing as 2D.
 for door in a['doors']:
  x,y=door['hinge'];t=math.radians(door['closed_angle_deg']+.7*door['swing_deg']);X,Y=x+door['width']*math.cos(t),y+door['width']*math.sin(t)
  out.append(dict(id=door['id']+'_leaf',kind='door',color='#ac8c64',vertices=[[x,y,0],[X,Y,0],[X,Y,2.05],[x,y,2.05]],faces=[[0,1,2,3]]))
 return out

def svg2(a,l):
 P=polygon(a);S=140;ox=70;oy=80
 def xy(x,y):return f'{ox+x*S:.3f},{oy+y*S:.3f}'
 e=['<svg xmlns="http://www.w3.org/2000/svg" width="780" height="880" viewBox="0 0 780 880">','<rect width="780" height="880" fill="white"/>',f'<text x="30" y="30" font-family="sans-serif" font-size="20">{l["id"]} - deterministic 2D / PROVISIONAL</text>',f'<polygon points="{" ".join(xy(*p) for p in P)}" fill="#eee5d6" stroke="#333"/>']
 for r in a['clearance_reserves']:
  x,y,w,d=r['rect'];e.append(f'<rect x="{ox+x*S}" y="{oy+y*S}" width="{w*S}" height="{d*S}" fill="#dd5555" fill-opacity=".10" stroke="#b55" stroke-dasharray="5 4"/>')
 for f in walls(a)+l['furniture']:
  x,y,w,d=rect(f);e.append(f'<rect x="{ox+x*S}" y="{oy+y*S}" width="{w*S}" height="{d*S}" fill="{f["color"]}" stroke="#555"/>')
  if 'kind' not in f:e.append(f'<text x="{ox+(x+w/2)*S}" y="{oy+(y+d/2)*S}" text-anchor="middle" font-family="sans-serif" font-size="10">{html.escape(f["id"])} {w*100:.0f}x{d*100:.0f}</text>')
 for door in a['doors']:
  hx,hy=door['hinge'];pts=[[hx,hy]]+[[hx+door['width']*math.cos(math.radians(door['closed_angle_deg']+door['swing_deg']*j/40)),hy+door['width']*math.sin(math.radians(door['closed_angle_deg']+door['swing_deg']*j/40))] for j in range(41)]
  e.append(f'<polygon points="{" ".join(xy(*p) for p in pts)}" fill="#bc853b" fill-opacity=".15" stroke="#bc853b"/>')
 g=a['glazing'];y=a['dimensions']['length']['value'];e.append(f'<line x1="{ox+g["x_start"]*S}" y1="{oy+y*S}" x2="{ox+g["x_end"]*S}" y2="{oy+y*S}" stroke="#408db4" stroke-width="5"/>')
 e+=['<text x="35" y="810" font-family="sans-serif" font-size="13">Blue: glazing aperture; opening mechanism UNKNOWN.</text>','<text x="35" y="835" font-family="sans-serif" font-size="13">Red: access reserves. Gold: provisional door sweeps. Units: cm on furniture.</text>','</svg>'];return '\n'.join(e)

def obj(scene):
 out=['# Deterministic model; metres; Z up'];offset=1
 for m in scene:
  out.append('o '+m['id']);out += ['v '+' '.join(f'{v:.6f}' for v in p) for p in m['vertices']];out+=['f '+' '.join(str(offset+i) for i in f) for f in m['faces']];offset+=len(m['vertices'])
 return '\n'.join(out)+'\n'

def build(a,l,out):
 out.mkdir(parents=True,exist_ok=True);report=validate(a,l)
 if report['errors']:raise ValueError(json.dumps(report,indent=2))
 scene=meshes(a,l);payload={'architecture':a,'layout':l,'meshes':scene,'validation':report}
 j=json.dumps(payload,sort_keys=True,separators=(',',':'));(out/'scene.json').write_text(j+'\n');(out/'plan.svg').write_text(svg2(a,l));(out/'model.obj').write_text(obj(scene))
 template=(ROOT/'viewer-template.html').read_text();(out/'viewer.html').write_text(template.replace('__SCENE__',j.replace('</','<\\/')))
 (out/'validation.json').write_text(json.dumps(report,indent=2)+'\n')
 hashes={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(out.iterdir()) if p.is_file() and p.name!='manifest.json'}
 (out/'manifest.json').write_text(json.dumps(hashes,sort_keys=True,indent=2)+'\n')
 return report

def main():
 p=argparse.ArgumentParser();p.add_argument('command',choices=['build','validate']);p.add_argument('--layout',choices=['E','F','F2','G','H','J'],default='J');p.add_argument('--strict',action='store_true');p.add_argument('--out',type=pathlib.Path);args=p.parse_args();a,l=load(args.layout)
 result=validate(a,l,args.strict)
 if args.command=='build' and not result['errors']:result=build(a,l,args.out or ROOT/'build'/args.layout)
 print(json.dumps(result,indent=2));return 1 if result['errors'] else 0
if __name__=='__main__':sys.exit(main())
