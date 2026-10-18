#!/usr/bin/env python3
"""Build compact, source-backed team-builder profiles from the restored archive."""
import json,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
web=ROOT/'web';meta=json.loads((web/'data/index.json').read_text())
folder=web/'data'/meta['snapshot']
index=json.loads((folder/'character.json').read_text())
order=json.loads((web/'data/catalog-order.json').read_text())['character']
profiles={};names={};aliases={}
for ident,row in index.items():
    d=json.loads((folder/'character'/(ident+'.json')).read_text())
    name=d['name'];canonical=names.setdefault(name,ident);aliases[ident]=canonical
    if canonical in profiles:
        profiles[canonical]['aliases'].append(ident);continue
    tags=[v['name'] for v in d.get('tag',{}).values()]
    roles=[]
    if '主力输出' in tags:roles.append('main')
    if '快速协奏' in tags or any('加深' in t or '增幅' in t for t in tags):roles.append('support')
    if '生存治疗' in tags:roles.append('sustain')
    if not roles:roles=['support']
    # Team-builder roles describe playable uses, independently of the official tags.
    if name in {'布兰特','尤诺','千咲'} and 'main' not in roles:roles.append('main')
    primary='main' if name=='布兰特' or '主力输出' in tags else 'sustain' if 'sustain' in roles else 'support'
    profiles[ident]={**row,'id':ident,'name':name,'aliases':[ident],
        'family':'rover' if name.startswith('漂泊者') else ident,
        'tags':tags,'roles':roles,'primary':primary,
        'releaseOrder':order.get(ident,{}).get('order',0)}
result={'schema':1,'source':meta['provenance'],'version':meta['version'],'aliases':aliases,'characters':list(profiles.values())}
(web/'data/team-builder.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print('Team profiles:',len(profiles),'characters;',len(aliases),'archive IDs')
