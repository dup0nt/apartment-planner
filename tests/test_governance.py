import copy,json,pathlib,sys,unittest,tempfile,shutil,subprocess
from unittest.mock import patch
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]))
from tools.agent_governance.routing import route,validate,ROOT
class RoutingTests(unittest.TestCase):
 def test_coverage(self):self.assertTrue(validate())
 def test_protected_permissions(self):self.assertEqual(route('docs/agent-system/permissions.md')['reviewers'],['assurance','rendering'])
 def test_unknown_path(self):
  with self.assertRaises(ValueError):route('new-unowned/file.py')
 def test_unsafe_path(self):
  with self.assertRaises(ValueError):route('../other-repo/README.md')
 def test_ambiguous_route(self):
  c=json.loads((ROOT/'docs/agent-system/catalog.json').read_text());c['path_ownership'].append(copy.deepcopy(c['path_ownership'][0]))
  with self.assertRaises(ValueError):route('data/J.json',c)
 def test_no_silent_conditional_drop(self):
  c=json.loads((ROOT/'docs/agent-system/catalog.json').read_text());c['path_ownership'][0]['review_rules'].append({'when':'contract_change','reviewers':['rendering']})
  with self.assertRaises(ValueError):route('data/J.json',c)
class PolicyRejectionTests(unittest.TestCase):
 def copy_repo(self,root):
  dst=pathlib.Path(root)/'repo';shutil.copytree(ROOT,dst,ignore=shutil.ignore_patterns('.git','__pycache__'));return dst
 def test_writable_reviewer_rejected(self):
  with tempfile.TemporaryDirectory() as tmp:
   dst=self.copy_repo(tmp);p=dst/'.codex/agents/assurance.toml';p.write_text(p.read_text().replace('read-only','workspace-write'))
   r=subprocess.run([sys.executable,str(dst/'tools/agent_governance/validate_agent_system.py'),str(dst)],capture_output=True,text=True)
   self.assertNotEqual(r.returncode,0);self.assertIn('independent reviewer must be read-only',r.stderr)
 def test_contract_escape_rejected(self):
  with tempfile.TemporaryDirectory() as tmp:
   dst=self.copy_repo(tmp);outside=pathlib.Path(tmp)/'outside.md';outside.write_text('outside');p=dst/'docs/agent-system/catalog.json';c=json.loads(p.read_text());c['contracts'][0]['path']='../outside.md';p.write_text(json.dumps(c))
   with patch('tools.agent_governance.routing.ROOT',dst):
    with self.assertRaises(ValueError):validate()
 def test_wrong_contract_steward_rejected(self):
  with tempfile.TemporaryDirectory() as tmp:
   dst=self.copy_repo(tmp);p=dst/'docs/agent-system/catalog.json';c=json.loads(p.read_text());c['contracts'][0]['steward']='rendering';p.write_text(json.dumps(c))
   with patch('tools.agent_governance.routing.ROOT',dst):
    with self.assertRaises(ValueError):validate()
if __name__=='__main__':unittest.main()
