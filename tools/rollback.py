#!/usr/bin/env python3
"""Switch the local index to the immediately previous retained snapshot."""
import json,os,pathlib,re,sys
root=pathlib.Path(__file__).resolve().parents[1]/'web/data'
current=json.loads((root/'index.json').read_text())
old=sorted([p for p in root.iterdir() if p.is_dir() and re.fullmatch(r'\d{8}T\d{6}-\d+',p.name) and p.name<current['snapshot']],reverse=True)
if not old:sys.exit('没有可回退的旧快照。')
meta=json.loads((old[0]/'metadata.json').read_text())
if meta['snapshot']!=old[0].name:sys.exit('旧快照索引不匹配，未修改。')
for category in ['character','weapon','echo']:
 if not (old[0]/(category+'.json')).is_file():sys.exit('旧快照不完整，未修改。')
(root/'index.rollback.json').write_text(json.dumps(meta,ensure_ascii=False,separators=(',',':')))
os.replace(root/'index.rollback.json',root/'index.json')
print('已回退至',old[0].name,'游戏版本',meta['version'],'；刷新网页即可。')
