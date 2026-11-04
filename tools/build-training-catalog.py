"""Build OCR dictionaries from the Wiki's own listed entries (no remote runtime requests)."""
import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]/'web';data=root/'data';index=json.loads((data/'index.json').read_text(encoding='utf-8'));weapons=json.loads((data/index['snapshot']/'weapon.json').read_text(encoding='utf-8'));profiles=json.loads((data/'team-builder.json').read_text(encoding='utf-8'));by_id={p['id']:p for p in profiles['characters']}
catalog={'schema':1,'sourceCommit':index['provenance']['commit'],'weapons':[{'id':k,'name':v['zh'],'en':v.get('en',''),'rarity':v['rank'],'type':v['type']} for k,v in weapons.items()]}
(data/'training-catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
p=data/'training-templates.json';templates=json.loads(p.read_text(encoding='utf-8'))
for t in templates['characters']:
 p0=by_id.get(t['id'],{});t.update(element=p0.get('element'),family=p0.get('family',t['id']))
p.write_text(json.dumps(templates,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
