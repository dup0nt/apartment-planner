"""Repository-native route resolver; same whole-string fnmatch grammar as catalog validator."""
import fnmatch,json,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[2]
def route(path,catalog=None):
 p=pathlib.PurePosixPath(path)
 if p.is_absolute() or '..' in p.parts or '\\' in path:raise ValueError('Unsafe repository-relative path')
 cat=catalog or json.loads((ROOT/'docs/agent-system/catalog.json').read_text())
 matches=[r for r in cat['path_ownership'] if any(fnmatch.fnmatchcase(path,g) for g in r['paths'])]
 if len(matches)!=1:raise ValueError(f'{path}: expected exactly one route, got {len(matches)}')
 r=matches[0]
 # This repository deliberately has unconditional review only.
 if any(rule['when']!='always' for rule in r['review_rules']):raise ValueError('Conditional reviews require an explicit resolver migration')
 return {'route':r['id'],'primary_team':r['primary_team'],'reviewers':sorted({t for rule in r['review_rules'] for t in rule['reviewers']})}
def validate():
 cat=json.loads((ROOT/'docs/agent-system/catalog.json').read_text());errors=[]
 for p in ROOT.rglob('*'):
  if not p.is_file() or any(z in {'.git','__pycache__'} for z in p.relative_to(ROOT).parts) or p.name=='.DS_Store':continue
  try:route(p.relative_to(ROOT).as_posix(),cat)
  except ValueError as e:errors.append(str(e))
 for f in cat['routing_fixtures']:
  try:
   actual=route(f['path'],cat)
   if actual!={k:f[k] for k in ['route','primary_team','reviewers']}:errors.append('Fixture mismatch '+f['path'])
  except ValueError as e:errors.append(str(e))
 teams={t['id'] for t in cat['teams']};caps={c['id']:c['team'] for c in cat['capabilities']}
 for contract in cat['contracts']:
  target=(ROOT/contract['path']).resolve()
  if contract['steward'] not in teams or contract['consumer'] not in teams or caps.get(contract['capability'])!=contract['steward'] or not target.is_relative_to(ROOT.resolve()) or not target.is_file():errors.append('Invalid contract '+contract['id'])
 if (ROOT/'AGENTS.md').stat().st_size>4096:errors.append('Root instructions exceed 4 KiB')
 if errors:raise ValueError('\n'.join(errors))
 return True
