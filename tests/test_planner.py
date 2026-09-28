import copy,hashlib,pathlib,sys,tempfile,unittest
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]))
import planner
class GeometryTests(unittest.TestCase):
 def test_repeatable(self):
  a,l=planner.load('J')
  with tempfile.TemporaryDirectory() as x,tempfile.TemporaryDirectory() as y:
   planner.build(a,l,pathlib.Path(x));planner.build(a,l,pathlib.Path(y))
   self.assertEqual({p.name:p.read_bytes() for p in pathlib.Path(x).iterdir()},{p.name:p.read_bytes() for p in pathlib.Path(y).iterdir()})
 def test_strict_rejects_unknown(self):
  a,l=planner.load('J');self.assertTrue(planner.validate(a,l,True)['errors'])
 def test_door_conflict(self):
  a,l=planner.load('J');l['furniture'][0].update(x=.1,y=.1,width=.4,depth=.4)
  self.assertTrue(any('swing' in e for e in planner.validate(a,l)['errors']))
 def test_notch_collision(self):
  a,l=planner.load('J');l['furniture'][0].update(x=.1,y=4,width=.4,depth=.4)
  self.assertTrue(any('outside room' in e for e in planner.validate(a,l)['errors']))
 def test_all_candidate_footprints(self):
  for k in ['E','F','F2','G','H','J']:
   a,l=planner.load(k);self.assertEqual(planner.validate(a,l)['errors'],[],k)
 def test_openings_are_not_solid_walls(self):
  a,l=planner.load('J')
  self.assertFalse(any(planner.intersects(planner.rect(w),(.01,-.1,.78,.09)) for w in planner.walls(a)))
 def test_same_furniture_3d(self):
  a,l=planner.load('J');ms={m['id']:m for m in planner.meshes(a,l)}
  for f in l['furniture']:
   vs=ms[f['id']]['vertices'];self.assertAlmostEqual(max(p[0] for p in vs)-min(p[0] for p in vs),f['width']);self.assertAlmostEqual(max(p[1] for p in vs)-min(p[1] for p in vs),f['depth'])
if __name__=='__main__':unittest.main()
