#!/usr/bin/env python3
"""Full local checks. Requires Python 3.11+ for stdlib TOML parsing."""
import pathlib,subprocess,sys
ROOT=pathlib.Path(__file__).resolve().parent
if sys.version_info<(3,11):raise SystemExit('Use Python 3.11+ for governance checks; planner itself has no new dependency.')
from tools.agent_governance.routing import validate
validate()
for command in [[sys.executable,'tools/agent_governance/validate_agent_system.py',str(ROOT)],[sys.executable,'-m','unittest','discover','-s','tests','-v']]:
 subprocess.run(command,cwd=ROOT,check=True)
print('All local governance and product checks passed. Geometry remains PROVISIONAL.')
