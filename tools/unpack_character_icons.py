#!/usr/bin/env python3
"""Verify and restore the additional character icon archive for Pages."""
import hashlib,io,json,pathlib,re,zipfile
ROOT=pathlib.Path(__file__).resolve().parents[1]
folder=ROOT/'snapshots/character-icons'
manifest=json.loads((folder/'manifest.json').read_text())
parts=[]
for item in manifest['fragments']:
    if not re.fullmatch(r'icons\.\d{3}\.bin',item['file']):raise ValueError('Invalid archive fragment name')
    data=(folder/item['file']).read_bytes()
    if hashlib.sha256(data).hexdigest()!=item['sha256']:raise ValueError('Icon fragment checksum mismatch')
    parts.append(data)
archive=b''.join(parts)
if hashlib.sha256(archive).hexdigest()!=manifest['sha256']:raise ValueError('Icon archive checksum mismatch')
with zipfile.ZipFile(io.BytesIO(archive)) as z:
    bad=z.testzip()
    if bad:raise ValueError('Corrupt icon archive entry: '+bad)
    for name in z.namelist():
        if name!='assets/character-icons.json' and not re.fullmatch(r'assets/character-icons/[0-9a-f]{20}\.webp',name):raise ValueError('Unexpected icon archive path')
    for name in z.namelist():
        dest=ROOT/'web'/name;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(z.read(name))
print('Additional character icons restored:',manifest['images'])
