#!/usr/bin/env python3
"""Repack a locally updated snapshot for Git commit. Keep teams.json separate."""
import hashlib,json,pathlib,shutil,tempfile,zipfile
ROOT=pathlib.Path(__file__).resolve().parents[1]
def main():
 web=ROOT/'web';meta=json.loads((web/'data/index.json').read_text());snapshot=web/'data'/meta['snapshot']
 files=[web/'data/index.json',*sorted(p for p in snapshot.rglob('*') if p.is_file())]
 groups=[];group=[];size=0
 for p in files:
  if group and size+p.stat().st_size>7*1024**2:groups.append(group);group=[];size=0
  group.append(p);size+=p.stat().st_size
 if group:groups.append(group)
 dest=ROOT/'snapshots';dest.mkdir(exist_ok=True)
 stage=pathlib.Path(tempfile.mkdtemp(prefix='.staging-',dir=dest))
 try:
  manifest={'schema':1,'version':meta['version'],'parts':[]}
  for i,group in enumerate(groups,1):
   archive=stage/f'snapshot-{i:02d}.zip'
   with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for p in group:z.write(p,p.relative_to(web).as_posix())
   manifest['parts'].append({'file':archive.name,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'files':len(group)})
  (stage/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
  keep={p.name for p in stage.iterdir()}
  for p in list(stage.iterdir()):p.replace(dest/p.name)
  for p in dest.glob('snapshot-*.zip'):
   if p.name not in keep:p.unlink()
  print('Packed',len(groups),'snapshot parts. Commit snapshots/ to persist updated data.')
 finally:shutil.rmtree(stage,ignore_errors=True)
if __name__=='__main__':main()
