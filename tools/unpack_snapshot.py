#!/usr/bin/env python3
"""Restore the checked-in, checksum-verified compressed snapshot fragments."""
import hashlib,io,json,pathlib,zipfile
ROOT=pathlib.Path(__file__).resolve().parents[1]
def main():
 manifest=json.loads((ROOT/'snapshots/manifest.json').read_text())
 for part in manifest['parts']:
  chunks=[]
  for fragment in part['fragments']:
   name=fragment['file']
   if pathlib.Path(name).name!=name:raise ValueError('Invalid fragment name')
   data=(ROOT/'snapshots'/name).read_bytes()
   if hashlib.sha256(data).hexdigest()!=fragment['sha256']:raise ValueError('Fragment checksum mismatch: '+name)
   chunks.append(data)
  data=b''.join(chunks)
  if hashlib.sha256(data).hexdigest()!=part['sha256']:raise ValueError('Snapshot checksum mismatch: '+part['file'])
  with zipfile.ZipFile(io.BytesIO(data)) as z:
   for info in z.infolist():
    p=pathlib.PurePosixPath(info.filename)
    if p.is_absolute() or '..' in p.parts or not p.parts or p.parts[0]!='data':raise ValueError('Invalid snapshot path')
   z.extractall(ROOT/'web')
 print('Restored snapshot',manifest['version'])
if __name__=='__main__':main()
