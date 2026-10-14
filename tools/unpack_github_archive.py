#!/usr/bin/env python3
"""Restore verified GitHub-derived JSON after the existing local image bundles."""
import hashlib,io,json,pathlib,re,zipfile
ROOT=pathlib.Path(__file__).resolve().parents[1];folder=ROOT/'snapshots/github-data'
def main():
 manifest=json.loads((folder/'manifest.json').read_text());parts=[]
 for f in manifest['fragments']:
  if not re.fullmatch(r'data\.\d{3}\.bin',f['file']):raise ValueError('Invalid fragment name')
  data=(folder/f['file']).read_bytes()
  if hashlib.sha256(data).hexdigest()!=f['sha256']:raise ValueError('GitHub fragment checksum mismatch')
  parts.append(data)
 data=b''.join(parts)
 if hashlib.sha256(data).hexdigest()!=manifest['sha256']:raise ValueError('GitHub archive checksum mismatch')
 with zipfile.ZipFile(io.BytesIO(data)) as z:
  bad=z.testzip()
  if bad:raise ValueError('Corrupt archive entry: '+bad)
  for name in z.namelist():
   p=pathlib.PurePosixPath(name)
   valid=(name.endswith('.json') and (name=='data/index.json' or name.startswith('data/'+manifest['snapshot']+'/'))) or name=='assets/github-images.json' or bool(re.fullmatch(r'assets/github-media/[0-9a-f]{20}\.webp',name))
   if p.is_absolute() or '..' in p.parts or not valid:raise ValueError('Invalid archive path')
  z.extractall(ROOT/'web')
 print('Restored GitHub archive:',manifest['snapshot'])
if __name__=='__main__':main()
