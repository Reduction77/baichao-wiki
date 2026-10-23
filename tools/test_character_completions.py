#!/usr/bin/env python3
"""Verify reviewed additions and the explicit exclusions against the base archive."""
import copy,json
from complete_character_data import ROOT,SUPPLEMENT,baseline,apply_record

data=json.loads(SUPPLEMENT.read_text());meta=json.loads((ROOT/'web/data/index.json').read_text());prefix='data/'+meta['snapshot']+'/'
assert data['source']['commit']==meta['provenance']['commit']
added=0
with baseline() as archive:
 base_meta=json.loads(archive.read('data/index.json'));base_prefix='data/'+base_meta['snapshot']+'/'
 for kind in ['character','weapon','echo']:
  catalog=json.loads(archive.read(base_prefix+kind+'.json'))
  for ident in catalog:
   path=prefix+kind+'/'+ident+'.json';old=json.loads(archive.read(base_prefix+kind+'/'+ident+'.json'));actual=json.loads((ROOT/'web'/path).read_text())
   expected=apply_record(old,data['characters'][ident]) if kind=='character' and ident in data['characters'] else old
   assert actual==expected,(kind,ident,'unreviewed changes')
   if kind=='character' and ident in data['characters']:
    assert apply_record(actual,data['characters'][ident])==actual,'Apply must be idempotent'
    for node,spec in data['characters'][ident]['skills'].items():
     if 'level' not in spec:continue
     before=list(old['skill_trees'][node]['skill']['level'].values());after=list(actual['skill_trees'][node]['skill']['level'].values())
     assert all(row in after for row in before),'Existing parameter changed'
     added+=len(after)-len(before)
assert added==18,'16 distinct additions plus male/female Rover variants'
excluded={'1304':('7',['游龙廻光持续时间']),'1109':('6',['剪辑回复协奏能量']),'1203':('3',['黑咩·重击耐力消耗']),'1309':('1',['空中攻击耐力消耗']),'1511':('1',['空中攻击耐力消耗']),'1508':('7',['锯环·疾攻第二段长按伤害','锯环·疾攻第三段·坠响伤害'])}
for ident,(node,names) in excluded.items():
 d=json.loads((ROOT/'web'/prefix/'character'/f'{ident}.json').read_text());found={x['name'] for x in d['skill_trees'][node]['skill']['level'].values()}
 assert not set(names)&found,(ident,'Review group 2 must remain excluded')
for ident in ['1501','1502']:
 d=json.loads((ROOT/'web'/prefix/'character'/f'{ident}.json').read_text())
 assert '光噪效应' in d['skill_trees']['3']['skill']['desc']
 assert '微光' in d['skill_trees']['7']['skill']['desc']
 row=next(x for x in d['skill_trees']['7']['skill']['level'].values() if x['name']=='微光持续时间');assert row['param'][0][9]=='9'
bad=copy.deepcopy(next(iter(data['characters'].values())));bad['skills'][next(iter(bad['skills']))]['name']='Unexpected'
try:apply_record(d,bad)
except ValueError:pass
else:raise AssertionError('Unreviewed skill fields must be rejected')
print('Reviewed additions passed: 18 parameter rows, upgraded Spectro descriptions, idempotence, all live weapons/Echoes and excluded same-value rows unchanged.')
