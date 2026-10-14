#!/usr/bin/env python3
"""Release gates and read-only update checks, using in-memory upstream fixtures."""
import json,pathlib,tempfile
import check_github_updates as u
def readme(game='3.7.0',resource='3.7.8',status='Release'):
 return f'> Status: {status}</br>\n> Game Version: {game}</br>\n> Resource Version: {resource}</br>'
source={'repository':'Arikatsu/WutheringWaves_Data','commit':'a'*40,'gameVersion':'3.7.0','resourceVersion':'3.7.8','status':'Release'}
bodies={'a'*40:readme(),'b'*40:readme('3.8.0','3.8.2','Beta'),'c'*40:readme('3.7.0','3.7.9')}
u.readme=lambda repo,sha:bodies[sha]
assert u.metadata(readme())['resourceVersion']=='3.7.8'
u.verify(source)
rows=[{'sha':'b'*40,'commit':{'message':'Game 3.8 | Beta'}},{'sha':'a'*40,'commit':{'message':'Game 3.7 | Release'}}]
result=u.check(source,rows);assert not result['updateAvailable'];assert result['latestRelease']['commit']=='a'*40
rows.insert(1,{'sha':'c'*40,'commit':{'message':'Game 3.7 | Release'}})
result=u.check(source,rows);assert result['updateAvailable'];assert result['latestRelease']['resourceVersion']=='3.7.9';assert source['commit']=='a'*40
for invalid in [{**source,'resourceVersion':'3.7.9'},{**source,'commit':'b'*40}]:
 try:u.verify(invalid)
 except ValueError:pass
 else:raise AssertionError('Unverified source accepted')
with tempfile.TemporaryDirectory() as folder:
 p=pathlib.Path(folder)/'source.json'
 for invalid in [{**source,'commit':'main'},{**source,'status':'Beta'},{**source,'repository':'../../invalid'},{**source,'gameVersion':'3.7'}]:
  p.write_text(json.dumps(invalid))
  try:u.config(p)
  except ValueError:pass
  else:raise AssertionError('Unsafe config accepted')
print('GitHub update checks passed: beta exclusion, immutable source, resource revisions and metadata mismatch rejection.')
