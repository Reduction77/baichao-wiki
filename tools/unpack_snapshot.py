#!/usr/bin/env python3
"""Restore the checked-in compressed snapshot before a Pages build."""
import hashlib,json,pathlib,zipfile
ROOT=pathlib.Path(__file__).resolve().parents[1]
def main():
 manifest=json.loads((ROOT/'snapshots/manifest.json').read_text())
 for part in manifest['parts']:
  name=part['file']
  if pathlib.Path(name).name!=name or not name.endswith('.zip'):raise ValueError('Invalid snapshot filename')
  archive=ROOT/'snapshots'/name
  if hashlib.sha256(archive.read_bytes()).hexdigest()!=part['sha256']:raise ValueError('Snapshot checksum mismatch: '+name)
  with zipfile.ZipFile(archive) as z:
   for info in z.infolist():
    p=pathlib.PurePosixPath(info.filename)
    if p.is_absolute() or '..' in p.parts or not p.parts or p.parts[0]!='data':raise ValueError('Invalid snapshot path')
   z.extractall(ROOT/'web')
 print('Restored snapshot',manifest['version'])
if __name__=='__main__':main()
