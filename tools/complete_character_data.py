#!/usr/bin/env python3
"""Apply reviewed additions to the pinned archive without changing other fields.

--build regenerates the checked-in supplement from the pinned raw configuration.
The default command applies that local supplement after restoring the archive.
"""
import argparse, copy, hashlib, io, json, pathlib, zipfile
from import_github_character import fetch, FILES

ROOT = pathlib.Path(__file__).resolve().parents[1]
SUPPLEMENT = ROOT/'tools/data/character-completions.json'
# Only the reviewed, independently missing parameters. Same-value alternatives
# from review group 2 are deliberately excluded.
SELECTED = {
 '1312': {'2': ['共鸣技能·拢伞形·破隙伤害', '共鸣技能·解伞形·赤芒瞬闪伤害']},
 '1402': {'6': ['技能伤害']},
 '1406': {'1': ['第三段伤害']}, '1408': {'1': ['第三段伤害']},
 '1409': {'3': ['看潮怒风哮之刃伤害'], '7': ['共鸣技能·此剑为潮浪之意伤害', '共鸣技能·凭风斩浪破敌伤害']},
 '1411': {'1': ['空中攻击耐力消耗']},
 '1501': {'7': ['微光持续时间']}, '1502': {'7': ['微光持续时间']},
 '1508': {'1': ['空中攻击耐力消耗'], '2': ['齿轨轮回伤害'], '7': ['锯环·疾攻第二段伤害', '锯环·疾攻第三段伤害', '锯环·疾攻第三段长按伤害', '电锯模式·闪避反击伤害']},
 '1511': {'2': ['共鸣技能·有效载荷冷却时间']},
}

def baseline():
 folder=ROOT/'snapshots/github-data'; manifest=json.loads((folder/'manifest.json').read_text())
 parts=[]
 for entry in manifest['fragments']:
  body=(folder/entry['file']).read_bytes()
  if hashlib.sha256(body).hexdigest()!=entry['sha256']:raise ValueError('Invalid base archive')
  parts.append(body)
 body=b''.join(parts)
 if hashlib.sha256(body).hexdigest()!=manifest['sha256']:raise ValueError('Invalid archive checksum')
 return zipfile.ZipFile(io.BytesIO(body))

def build():
 with baseline() as archive:
  meta=json.loads(archive.read('data/index.json')); source=meta['provenance']; raw={}; hashes={}
  for key in ['roles','skills','nodes','descriptions','texts']:
   raw[key],hashes[FILES[key]]=fetch(ROOT/'.cache/arikatsu'/source['commit'],FILES[key],commit=source['commit'],repo=source['repository'])
  texts={x['Id']:x['Content'] for x in raw['texts']}; roles={x['Id']:x for x in raw['roles']}; skills={x['Id']:x for x in raw['skills']}
  result={'schema':1,'snapshot':meta['snapshot'],'source':{'repository':source['repository'],'commit':source['commit'],'inputSha256':hashes},'characters':{}}
  for ident,spec in SELECTED.items():
   old=json.loads(archive.read(f'data/{meta["snapshot"]}/character/{ident}.json')); patch={}; refs=[]
   for node_id,labels in spec.items():
    node=next(n for n in raw['nodes'] if n['NodeGroup']==roles[int(ident)]['SkillTreeGroupId'] and str(n['NodeIndex'])==node_id)
    source_skill=skills[node['SkillId']]
    if ident in ['1501','1502']:source_skill=skills[1000617]
    rows=sorted([x for x in raw['descriptions'] if x['SkillLevelGroupId']==source_skill['SkillLevelGroupId']],key=lambda x:x['Order'])
    original=list(old['skill_trees'][node_id]['skill']['level'].values()); by_name={x['name']:x for x in original}; completed=[]; found=set()
    for row in rows:
     name=texts[row['AttributeName']]
     if name in labels:
      completed.append({'name':name,'param':[v['ArrayString'] for v in row['SkillDetailNum']],'format':texts.get(row['Description']) or None}); found.add(name); refs.append(row['Id'])
     elif name in by_name:completed.append(copy.deepcopy(by_name[name])); found.add(name)
    if not set(labels)<=found:raise ValueError(f'Missing source parameters: {ident}/{node_id}')
    completed.extend(copy.deepcopy(x) for x in original if x['name'] not in found)
    patch[node_id]={'level':{str(i+1):row for i,row in enumerate(completed)}}
   if ident in ['1501','1502']:
    # The source explicitly defines these as upgraded Spectro Rover skills.
    for node_id,skill_id in [('3',1000613),('7',1000617)]:
     skill=skills[skill_id]; patch.setdefault(node_id,{}).update({'desc':texts[skill['SkillDescribe']],'param':skill['SkillDetailNum'],'simple_desc':texts[skill['SkillResume']],'simple_param':skill['SkillResumeNum']})
     refs.append(skill_id)
   result['characters'][ident]={'skills':patch,'sourceIds':refs}
  SUPPLEMENT.parent.mkdir(parents=True,exist_ok=True)
  SUPPLEMENT.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
 print('Built selected character completions:',len(result['characters']),'records')

def apply_record(record,entry):
 result=copy.deepcopy(record)
 for node,fields in entry['skills'].items():
  if node not in result['skill_trees']:raise ValueError('Supplement skill node is absent')
  if set(fields)-{'level','desc','param','simple_desc','simple_param'}:raise ValueError('Unexpected supplement field')
  result['skill_trees'][node]['skill'].update(copy.deepcopy(fields))
 return result

def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--build',action='store_true');args=parser.parse_args()
 if args.build:build()
 data=json.loads(SUPPLEMENT.read_text());meta=json.loads((ROOT/'web/data/index.json').read_text())
 if data['source']['commit']!=meta['provenance']['commit']:raise ValueError('Rebuild completions for the selected source before applying')
 for ident,entry in data['characters'].items():
  path=ROOT/'web/data'/meta['snapshot']/'character'/f'{ident}.json'
  old=json.loads(path.read_text());new=apply_record(old,entry)
  if old!=new:path.write_text(json.dumps(new,ensure_ascii=False,separators=(',',':'))+'\n')
 # Existing-entry additions belong in the normal detail pages, not version cards.
 extra=json.loads((ROOT/'tools/data/existing-entry-completions.json').read_text())
 for kind,entries in [('character',extra['characters']),('weapon',extra['weapons'])]:
  for ident,entry in entries.items():
   path=ROOT/'web/data'/meta['snapshot']/kind/f'{ident}.json';old=json.loads(path.read_text())
   if kind=='character':new=apply_record(old,entry)
   else:
    if set(entry)-{'effect','effect_name','param'}:raise ValueError('Unexpected weapon supplement field')
    new=copy.deepcopy(old);new.update(copy.deepcopy(entry))
   if old!=new:path.write_text(json.dumps(new,ensure_ascii=False,separators=(',',':'))+'\n')
 print('Applied reviewed character completions:',len(data['characters']),'records')

if __name__=='__main__':main()
