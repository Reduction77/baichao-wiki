#!/usr/bin/env python3
"""Bundle generated GitHub JSON separately from unchanged local image archives."""
import hashlib,io,json,pathlib,zipfile
ROOT=pathlib.Path(__file__).resolve().parents[1]
web=ROOT/'web';meta=json.loads((web/'data/index.json').read_text())
if not meta.get('provenance'):raise ValueError('Generate the GitHub archive first')
folder=web/'data'/meta['snapshot'];output=io.BytesIO()
with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as z:
 for p in [web/'data/index.json',*sorted(folder.rglob('*.json')),web/'assets/github-images.json',*sorted((web/'assets/github-media').glob('*.webp'))]:
  info=zipfile.ZipInfo(p.relative_to(web).as_posix(),(2026,1,1,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED
  z.writestr(info,p.read_bytes())
body=output.getvalue();dest=ROOT/'snapshots/github-data';dest.mkdir(parents=True,exist_ok=True)
manifest={'snapshot':meta['snapshot'],'sha256':hashlib.sha256(body).hexdigest(),'fragments':[]}
for i,start in enumerate(range(0,len(body),512*1024)):
 data=body[start:start+512*1024];name=f'data.{i:03d}.bin';(dest/name).write_bytes(data)
 manifest['fragments'].append({'file':name,'sha256':hashlib.sha256(data).hexdigest()})
(dest/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
for p in dest.glob('data.*.bin'):
 if p.name not in {x['file'] for x in manifest['fragments']}:p.unlink()
print('Packed GitHub JSON:',len(body),'bytes;',len(manifest['fragments']),'fragments')
