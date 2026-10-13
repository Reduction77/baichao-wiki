#!/usr/bin/env python3
"""Validate local snapshot, references, image bytes, and team records."""
import json,pathlib,sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
web=ROOT/'web'
meta=json.loads((web/'data/index.json').read_text())
folder=web/'data'/meta['snapshot']
errors=[]
items=json.loads((folder/'items.json').read_text())
images=json.loads((folder/'images.json').read_text())
for category in ['character','weapon','echo']:
    rows=json.loads((folder/(category+'.json')).read_text())
    if len(rows)!=meta['counts'][category]: errors.append(category+': count mismatch')
    for ident,row in rows.items():
        f=folder/category/(ident+'.json')
        if not f.is_file(): errors.append(str(f)+': missing');continue
        d=json.loads(f.read_text())
        if str(d.get('id'))!=ident:errors.append(category+'/'+ident+': ID mismatch')
        for costs in d.get('ascensions',{}).values():
            for c in costs:
                if str(c['key']) not in items:errors.append(category+'/'+ident+': missing material '+str(c['key']))
                if not isinstance(c['value'],(float,int)) or c['value']<0:errors.append(category+'/'+ident+': invalid quantity')
for url,ref in images.items():
    f=web/ref
    if not f.is_file():errors.append(ref+': image missing');continue
    data=f.read_bytes()
    if not data.startswith(b'RIFF') or b'WEBP' not in data[:16]:errors.append(ref+': invalid image')
for t in json.loads((web/'data/teams.json').read_text()):
    if len(t.get('characters',[]))!=3:errors.append('Team must contain 3 IDs')
    for v in t.get('videos',[]):
        if not v.get('url','').startswith(('https://www.bilibili.com/','https://bilibili.com/','https://b23.tv/')):errors.append('Invalid team video URL')
if errors:
    print('\n'.join(errors),file=sys.stderr);sys.exit(1)
print('Data checks passed:',meta['counts'],len(items),'material types;',len(images),'local WebP images.')
