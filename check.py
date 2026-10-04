#!/usr/bin/env python3
"""Full local checks. Requires Python 3.11+ for stdlib TOML parsing."""
import pathlib,subprocess,sys,os,shutil
ROOT=pathlib.Path(__file__).resolve().parent
if sys.version_info<(3,11):raise SystemExit('Use Python 3.11+ for governance checks; planner itself has no new dependency.')
from tools.agent_governance.routing import validate
validate()
for command in [[sys.executable,'tools/agent_governance/validate_agent_system.py',str(ROOT)],[sys.executable,'-m','unittest','discover','-s','tests','-v']]:
 subprocess.run(command,cwd=ROOT,check=True)
node=os.environ.get('NODE_BINARY') or shutil.which('node')
if not node: raise SystemExit('Node.js is required for viewer tests. Install Node or set NODE_BINARY to its executable.')
subprocess.run([node,'--test',*map(str,sorted((ROOT/'tests').glob('test_*.cjs')))],cwd=ROOT,check=True)
print('All local governance and product checks passed. Geometry remains PROVISIONAL.')
