#!/usr/bin/env python3
"""Generate the entire supported archive from pinned GitHub game configuration.

The catalog scope contains IDs only. Existing snapshots are used only for local
image reuse and optional post-generation comparison, never for text or numbers.
"""
import argparse, concurrent.futures, datetime, hashlib, json, pathlib, shutil, os
from import_github_character import COMMIT, REPO, FILES, fetch, convert, costs, compare
from sync_data import image_url
from check_github_updates import config,verify,readme

ROOT=pathlib.Path(__file__).resolve().parents[1]
EXTRA={
 'english':'Textmaps/en/multi_text/MultiText.json',
 'branches':'BinData/skill/skillbranch.json',
 'tags':'BinData/role/roletag.json',
 'weapons':'BinData/weapon/weaponconf.json',
 'skins':'BinData/weapon/weaponskin.json',
 'reson':'BinData/weapon/weaponreson.json',
 'weapon_breach':'BinData/weapon/weaponbreach.json',
 'weapon_growth':'BinData/property/weaponpropertygrowth.json',
 'properties':'BinData/property/propertyindex.json',
 'phantoms':'BinData/phantom/phantomitem.json',
 'phantom_skills':'BinData/phantom/phantomskill.json',
 'fetters':'BinData/phantom/phantomfetter.json',
 'fetter_groups':'BinData/phantom/phantomfettergroup.json',
 'handbook':'BinData/handbook/phantomhandbook.json',
 'monsters':'BinData/monster_Info/monsterinfo.json',
}

def write(path,value):
 path.parent.mkdir(parents=True,exist_ok=True)
 path.write_text(json.dumps(value,ensure_ascii=False,separators=(',',':'))+'\n')

def build(data,scope):
 zh={x['Id']:x['Content'] for x in data['texts']}
 en={x['Id']:x['Content'] for x in data['english']}
 def text(key,optional=False):
  if not key:return ''
  if key not in zh and not optional:raise ValueError('Missing localization: '+key)
  return zh.get(key,'')
 role_rows={x['Id']:x for x in data['roles']}
 tags={x['Id']:x for x in data['tags']};branches={x['Id']:x for x in data['branches']}
 details={'character':{},'weapon':{},'echo':{}};catalog={k:{} for k in details};limitations=[]
 for ident in scope['character']:
  d=convert(data,ident);r=role_rows[ident]
  d['tag']={str(i):{'name':text(tags[i]['TagName']),'desc':text(tags[i]['TagDesc']),'icon':tags[i]['TagIcon'],'color':tags[i]['TagNameColor']} for i in r['Tag']}
  d['skill_branches']={str(i):{'name':text(branches[i]['Name']),'desc':text(branches[i]['Desc']),'icon':branches[i]['Icon']} for i in r['SkillBranchIds']}
  if not d['nickname']:limitations.append({'category':'character','id':ident,'field':'nickname','reason':'Missing or placeholder upstream title'})
  details['character'][str(ident)]=d
  catalog['character'][str(ident)]={'zh':d['name'],'en':en.get(r['Name'],''),'icon':d['icon'],'background':d['background'],'rank':d['rarity'],'element':d['element'],'weapon':d['weapon']}
 props={x['Id']:x for x in data['properties']};weapons={x['ItemId']:x for x in data['weapons']};skins={x['Id']:x for x in data['skins']}
 def property_value(prop,growth):
  info=props[prop['Id']];display=props.get(info['ConvertToWhiteId'],info)
  return {'name':text(display['Name']),'value':prop['Value']*growth/10000,'is_ratio':prop['IsRatio'],'is_percent':display['IsPercent']}
 for ident in scope['weapon']:
  if ident in skins:
   r=skins[ident];d={'id':ident,'skin':True,'name':text(r['Name']),'desc':text(r['BgDescription']),'rarity':r['QualityId'],'type':r['WeaponSkinType'],'icon':r['Icon'],'stats':{},'ascensions':{}}
   namekey=r['Name']
  else:
   r=weapons[ident];reson=next(x for x in data['reson'] if x['ResonId']==r['ResonId'] and x['Level']==1)
   stats={}
   growth={(x['CurveId'],x['BreachLevel'],x['Level']):x['CurveValue'] for x in data['weapon_growth']}
   for (curve,stage,level),value in growth.items():
    if curve!=r['FirstCurve']:continue
    stats.setdefault(str(stage),{})[str(level)]=[property_value(r['FirstPropId'],value),property_value(r['SecondPropId'],growth[(r['SecondCurve'],stage,level)])]
   ascensions={str(x['Level']):costs(x['Consume'])+([{'key':2,'value':x['GoldConsume']}] if x['GoldConsume'] else []) for x in data['weapon_breach'] if x['BreachId']==r['BreachId']}
   d={'id':ident,'name':text(r['WeaponName']),'desc':text(r['BgDescription']),'rarity':r['QualityId'],'type':r['WeaponType'],'icon':r['Icon'],'stats':stats,'ascensions':ascensions,'effect':text(r['Desc']),'effect_name':text(reson['Name']),'param':[x['ArrayString'] for x in r['DescParams']]};namekey=r['WeaponName']
  details['weapon'][str(ident)]=d
  catalog['weapon'][str(ident)]={'zh':d['name'],'en':en.get(namekey,''),'rank':d['rarity'],'type':d['type'],'icon':d['icon']}
 fetters={x['Id']:x for x in data['fetters']};groups={x['Id']:x for x in data['fetter_groups']};sonatas={}
 for ident,r in groups.items():
  sets={str(x['Key']):{'desc':text(fetters[x['Value']]['EffectDescription']),'param':fetters[x['Value']]['EffectDescriptionParam']} for x in r['FetterMap']}
  sonatas[str(ident)]={'id':ident,'name':{'zh':text(r['FetterGroupName']),'en':en.get(r['FetterGroupName'],'')},'icon':r['FetterElementPath'],'color':r['FetterElementColor'],'set':{i:{'zh':s} for i,s in sets.items()}}
 skills={x['PhantomSkillId']:x for x in data['phantom_skills']};books={x['Id']:x for x in data['handbook']};monsters={x['Id']:x for x in data['monsters']}
 for ident in scope['echo']:
  rows=[x for x in data['phantoms'] if x['MonsterId']==ident];rows.sort(key=lambda x:(x['QualityId'],x['ItemId']))
  r=rows[-1];s=skills[r['SkillId']];book=books.get(ident,{})
  group={str(i):{'id':i,'name':sonatas[str(i)]['name']['zh'],'icon':sonatas[str(i)]['icon'],'color':sonatas[str(i)]['color'],'set':{n:v['zh'] for n,v in sonatas[str(i)]['set'].items()}} for i in sorted(r['FetterGroup'])}
  rarity=sorted({x['QualityId'] for x in rows});intensity=r['Rarity'];namekey=book.get('Name') or r['MonsterName']
  d={'id':ident,'name':text(namekey),'icon':r['Icon'],'code':str(ident),'type':text(book.get('TypeDescrtption'),True),'place':text(book.get('Place'),True),'intensity':['轻波级','巨浪级','怒涛级','海啸级'][intensity] if intensity in range(4) else str(intensity),'intensity_code':intensity,'rarity':rarity,'skill':{'desc':text(s['DescriptionEx']),'simple_desc':text(s['SimplyDescription'],True),'param':[x['ArrayString'] for x in s['LevelDescStrArray']],'icon':s['BattleViewIcon']},'group':group}
  limitations.append({'category':'echo','id':ident,'field':'code','reason':'Display game ID; upstream archive has no Nanoka catalog code'})
  details['echo'][str(ident)]=d
  catalog['echo'][str(ident)]={'zh':d['name'],'en':en.get(namekey,''),'icon':d['icon'],'code':str(ident),'rank':rarity,'intensity':intensity,'group':list(map(int,group))}
 used=set()
 for category in details.values():
  for d in category.values():
   for cs in d.get('ascensions',{}).values():used.update(c['key'] for c in cs)
   for n in d.get('skill_trees',{}).values():
    used.update(c['key'] for c in n.get('consume',[]))
    for cs in n['skill'].get('consume',{}).values():used.update(c['key'] for c in cs)
 item_rows={x['Id']:x for x in data['items']}
 items={str(i):{'name':text(item_rows[i]['Name']),'icon':item_rows[i]['Icon']} for i in sorted(used)}
 return details,catalog,items,sonatas,limitations

def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--compare',action='store_true');parser.add_argument('--compare-snapshot',type=pathlib.Path);parser.add_argument('--source-config',type=pathlib.Path,default=ROOT/'tools/github_source.json');parser.add_argument('--preview',action='store_true',help='Write candidate snapshot and report without changing the live index');args=parser.parse_args()
 source=config(args.source_config);verify(source);commit=source['commit'];repo=source['repository']
 files={**FILES,**EXTRA};cache=ROOT/'.cache/arikatsu'/commit
 def load(pair):
  key,path=pair;value,digest=fetch(cache,path,commit=commit,repo=repo);return key,value,path,digest
 data={};hashes={}
 with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
  for key,value,path,digest in pool.map(load,files.items()):data[key]=value;hashes[path]=digest
 scope=json.loads((ROOT/'tools/github_catalog_scope.json').read_text())
 coverage={'newCharacters':sorted({x['RoleId'] for x in data['favor']}-set(scope['character'])),'newWeapons':sorted(({x['ItemId'] for x in data['weapons']}|{x['Id'] for x in data['skins']})-set(scope['weapon']))}
 if any(coverage.values()) and not args.preview:raise ValueError('Update catalog scope before publishing newly discovered entries: '+json.dumps(coverage))
 details,catalog,items,sonatas,limitations=build(data,scope)
 web=ROOT/'web';old=json.loads((web/'data/index.json').read_text());previous=web/'data'/old['snapshot']
 image_maps={}
 for p in [previous/'images.json',web/'assets/character-icons.json',web/'assets/pilot/images.json',web/'assets/github-images.json']:
  if p.exists():image_maps.update(json.loads(p.read_text()))
 snapshot=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S')+'-'+str(os.getpid());stage=web/'data'/('.staging-'+snapshot)
 provenance={'repository':repo,'commit':commit,'gameVersion':source['gameVersion'],'resourceVersion':source['resourceVersion'],'locale':'zh-Hans','scope':'文字、属性、技能倍率、共鸣链、武器效果、声骸技能与材料均由 GitHub 原始配置生成。图片沿用本站保存的本地图像快照。'}
 hashes['README.md']=hashlib.sha256(readme(repo,commit).encode()).hexdigest()
 report={'source':provenance,'inputSha256':hashes,'counts':{k:len(v) for k,v in details.items()},'limitations':limitations,'coverage':coverage,'comparison':{}}
 try:
  for kind,rows in details.items():
   for ident,d in rows.items():
    d['provenance']=provenance
    if args.compare and kind=='character':report['comparison'][ident]=compare(d,json.loads(((args.compare_snapshot or previous)/kind/(ident+'.json')).read_text()))
    write(stage/kind/(ident+'.json'),d)
   write(stage/(kind+'.json'),catalog[kind])
  write(stage/'items.json',items);write(stage/'sonatas.json',sonatas)
  images={}
  # Existing image bundles stay archived separately; no network or byte duplication.
  for url,ref in image_maps.items():
   src=web/ref
   if not src.is_file():raise ValueError('Missing cached image: '+ref)
   images[url]=ref
  refs=set()
  for rows in details.values():
   for d in rows.values():
    refs.update(image_url(d.get(k)) for k in ['icon','background'])
    refs.update(image_url(n['skill'].get('icon')) for n in d.get('skill_trees',{}).values())
    refs.update(image_url(n.get('icon')) for n in d.get('chains',{}).values())
  refs.update(image_url(i['icon']) for i in items.values());refs.discard('')
  missing=sorted(refs-images.keys());report['missingImages']=missing
  write(stage/'images.json',images);write(stage/'provenance.json',report)
  version='.'.join(source['gameVersion'].split('.')[:2])
  meta={**old,'version':version,'hotfix':source['resourceVersion'],'live':version,'source':f'https://github.com/{repo}','sourcePage':f'https://github.com/{repo}/tree/{commit}','updated':datetime.datetime.now(datetime.timezone.utc).isoformat(),'snapshot':snapshot,'counts':report['counts'],'images':len(images),'missingImages':len(missing),'provenance':provenance}
  if missing and not args.preview:raise ValueError('Missing local images; run --preview to inspect: '+str(len(missing)))
  stage.rename(web/'data'/snapshot)
  if args.preview:write(web/'data'/snapshot/'candidate-index.json',meta)
  else:write(web/'data/index.json',meta)
 except Exception:
  shutil.rmtree(stage,ignore_errors=True);raise
 print('GitHub archive generated:',report['counts'],'materials:',len(items),flush=True)
 print('Provenance:',commit,'limitations:',len(limitations),flush=True)
 if args.preview:print('Preview only; live index unchanged. Candidate:',web/'data'/snapshot,flush=True)

if __name__=='__main__':main()
