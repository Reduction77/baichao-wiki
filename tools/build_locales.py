#!/usr/bin/env python3
"""Package the pinned game's official English strings for offline language switching."""
import gzip,hashlib,json,pathlib,re
from import_github_character import fetch

ROOT=pathlib.Path(__file__).resolve().parents[1]
web=ROOT/'web';meta=json.loads((web/'data/index.json').read_text())
source=meta['provenance'];cache=ROOT/'.cache/arikatsu'/source['commit']
raw={};hashes={}
for locale in ['zh-Hans','en']:
    path=f'Textmaps/{locale}/multi_text/MultiText.json'
    rows,digest=fetch(cache,path,commit=source['commit'],repo=source['repository'])
    raw[locale]={r['Id']:r['Content'] for r in rows};hashes[path]=digest
used=set()
def scan(value):
    if isinstance(value,str):used.add(value)
    elif isinstance(value,dict):
        for v in value.values():scan(v)
    elif isinstance(value,list):
        for v in value:scan(v)
folder=web/'data'/meta['snapshot']
for path in sorted(folder.rglob('*.json')):
    if path.name not in ['provenance.json','images.json']:scan(json.loads(path.read_text()))
texts={zh:raw['en'][key] for key,zh in raw['zh-Hans'].items() if zh and zh in used and raw['en'].get(key) and raw['en'][key]!=zh}
names={}
for kind in ['character','weapon','echo']:
    for item in json.loads((folder/(kind+'.json')).read_text()).values():
        if item.get('zh') and item.get('en'):names[item['zh']]=item['en']
for item in json.loads((folder/'sonatas.json').read_text()).values():
    if item['name'].get('en'):names[item['name']['zh']]=item['name']['en']
texts.update(names)
beta_sources=[];beta_inline={}
for version in json.loads((web/'data/beta/index.json').read_text()).get('versions',[]):
    if not version.get('languageFile'):continue
    path=web/version['languageFile'];overlay=json.loads(path.read_text())
    for key,value in overlay['texts'].items():texts.setdefault(key,value)
    for key,value in overlay.get('names',{}).items():names.setdefault(key,value)
    beta_inline.update(overlay.get('inline',{}))
    beta_sources.append({'version':version['gameVersion'],'source':overlay['source'],'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
names.update({'导电漂泊者':names.get('漂泊者·导电','Rover: Electro'),'气动漂泊者':names.get('漂泊者·气动','Rover: Aero'),'衍射漂泊者':names.get('漂泊者·衍射','Rover: Spectro'),'湮灭漂泊者':names.get('漂泊者·湮灭','Rover: Havoc')})
editorial=json.loads((ROOT/'tools/localization-editorial-en.json').read_text())
inline={}
for path in sorted((folder/'character').glob('*.json')):
    detail=json.loads(path.read_text())
    for value in [detail.get('nickname'),*detail.get('chara_info',{}).values()]:
        if value and value in texts:inline[value]=texts[value]
inline.update(beta_inline)
payload={'schema':1,'source':{'repository':source['repository'],'commit':source['commit'],'inputSha256':hashes,'versionLocales':beta_sources},'texts':texts,'names':names,'inline':inline,'editorial':editorial}
body=json.dumps(payload,ensure_ascii=False,separators=(',',':')).encode()
dest=web/'data/locales';dest.mkdir(parents=True,exist_ok=True)
(dest/'en.game.json.gz').write_bytes(gzip.compress(body,mtime=0))
print(f'English locale: {len(texts)} strings, {len(names)} names, {len(body)} bytes; gzip {(dest/"en.game.json.gz").stat().st_size} bytes')
