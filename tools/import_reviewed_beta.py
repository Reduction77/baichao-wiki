#!/usr/bin/env python3
"""Build only the reviewed 3.8.1 entries from locally downloaded Nanoka JSON.

Use --source-dir with a directory containing ww__3.8.1__zh/en__*.json.
All published content is local; input digests are retained in the registry.
"""
import argparse, copy, concurrent.futures, datetime, hashlib, json, pathlib, re, subprocess
from sync_data import image_url

ROOT=pathlib.Path(__file__).resolve().parents[1]
VERSION='3.8.1'
CHAR_FIELDS=['id','rarity','weapon','element','tag','name','desc','icon','background','chara_info','stats','skill_trees','skill_branches','chains','ascensions']
WEAPON_FIELDS=['id','rarity','type','name','desc','icon','stats','effect','effect_name','param','ascensions']
INFO=['birth','sex','country','influence','cv_name_cn','cv_name_jp','cv_name_en','cv_name_ko']
DISPLAY_SKILL=['name','desc','param','simple_desc','simple_param','icon','type','level','consume']

def write(path,data):
 path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')

def main():
 ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--source-dir',type=pathlib.Path,required=True);ap.add_argument('--retry-missing-images',action='store_true');args=ap.parse_args()
 web=ROOT/'web';meta=json.loads((web/'data/index.json').read_text());folder=web/'data'/meta['snapshot'];digests={}
 def read(kind,ident=None,locale='zh'):
  tail=f'{kind}__{ident}' if ident else kind;path=args.source_dir/f'ww__{VERSION}__{locale}__{tail}.json';body=path.read_bytes()
  url=f'https://static.nanoka.cc/ww/{VERSION}/{locale}/{kind}'+(f'/{ident}' if ident else '')+'.json'
  digests[url]=hashlib.sha256(body).hexdigest();return json.loads(body)
 live={kind:json.loads((folder/(kind+'.json')).read_text()) for kind in ['character','weapon']}
 item_languages={locale:read('item',locale=locale) for locale in ['zh','en']}
 records={};texts={};names={};inline={}
 def prepare(kind,ident,locale):
  raw=read(kind,ident,locale);d={key:copy.deepcopy(raw[key]) for key in (CHAR_FIELDS if kind=='character' else WEAPON_FIELDS) if key in raw}
  if str(raw.get('id'))!=ident:raise ValueError('Version entry ID mismatch')
  if kind=='character':
   d['chara_info']={key:raw.get('chara_info',{}).get(key,'') for key in INFO}
   for node in d['skill_trees'].values():
    node['skill']={k:v for k,v in node['skill'].items() if k in DISPLAY_SKILL};node['skill'].setdefault('level',{})
   if ident=='1512':
    # Nanoka still points the full portrait at Ciaccona; never present it as Lily.
    d['background']='';d['artworkPending']=True
   elif ident=='1312':
    # Keep the reviewed live fields, adding only the new version's stamina row.
    current=json.loads((folder/'character/1312.json').read_text())
    if locale=='zh':
     level=current['skill_trees']['1']['skill']['level'];row=next(v for v in raw['skill_trees']['1']['skill']['level'].values() if v['name']=='下落攻击耐力消耗')
     level[str(max(map(int,level))+1)]=copy.deepcopy(row)
     current.pop('provenance',None);current['chara_info']={k:v for k,v in current['chara_info'].items() if k in INFO};d=current
  else:
   # Lullaby's supplied icon is Mirage, a different weapon.
   if ident=='21030076':d['icon']='';d['artworkPending']=True
   if ident=='21020107' and locale=='zh':
    current=json.loads((folder/'weapon/21020107.json').read_text());current.pop('provenance',None)
    for key in ['effect','effect_name','param']:current[key]=copy.deepcopy(raw[key])
    d=current
   missing=sorted({int(i) for i in re.findall(r'\{(\d+)\}',d.get('effect','')) if int(i)>=len(d.get('param',[]))})
   if missing:
    d['effect']=re.sub(r'\{(\d+)\}',lambda m:('待完善' if locale=='zh' else 'Pending') if int(m[1]) in missing else m[0],d['effect'])
    d['incompleteParameters']=missing
  costs=list(d.get('ascensions',{}).values())
  for node in d.get('skill_trees',{}).values():costs.append(node.get('consume',[]));costs.extend(node['skill'].get('consume',{}).values())
  material_ids={str(c['key']) for row in costs for c in row}
  d['source_items']={i:copy.deepcopy(item_languages[locale][i]) for i in sorted(material_ids)}
  if locale=='en':
   for i,item in d['source_items'].items():
    if not item.get('name'):item['name']='Ascension Material #'+i
  return d
 def pairs(zh,en):
  if isinstance(zh,str) and isinstance(en,str) and zh and en and zh!=en and re.search('[\u3400-\u9fff]',zh):texts.setdefault(zh,en)
  elif isinstance(zh,dict) and isinstance(en,dict):
   for key in zh.keys()&en.keys():pairs(zh[key],en[key])
  elif isinstance(zh,list) and isinstance(en,list):
   for a,b in zip(zh,en):pairs(a,b)
 for kind,ids in [('character',['1512','1312']),('weapon',['21030076','21020107'])]:
  records[kind]={}
  for ident in ids:
   # Pair original row keys before selected live rows are merged/reordered.
   pairs(read(kind,ident,'zh'),read(kind,ident,'en'))
   zh=prepare(kind,ident,'zh');en=prepare(kind,ident,'en');pairs(zh,en);names[zh['name']]=en['name']
   for value in zh.get('chara_info',{}).values():
    if value in texts:inline[value]=texts[value]
   records[kind][ident]=zh
 known_images={}
 for path in [folder/'images.json',web/'assets/character-icons.json',web/'assets/pilot/images.json']:
  if path.exists():known_images.update(json.loads(path.read_text()))
 refs=set()
 for entries in records.values():
  for d in entries.values():
   refs.update([d.get('icon'),d.get('background')]);refs.update(n['skill'].get('icon') for n in d.get('skill_trees',{}).values());refs.update(c.get('icon') for c in d.get('chains',{}).values());refs.update(c.get('icon') for c in d['source_items'].values())
 registry=json.loads((web/'data/beta/index.json').read_text())
 unavailable={url for v in registry.get('versions',[]) if v['gameVersion']==VERSION for url in v.get('missingImages',[])}
 images={};missing=[]
 def asset(ref):
  url=image_url(ref)
  if not url:return
  if url in known_images:images[url]=known_images[url];return
  if url in unavailable and not args.retry_missing_images:missing.append(url);return
  name=hashlib.sha256(url.encode()).hexdigest()[:24]+'.webp';path=web/'data/beta/media'/name
  if not path.exists():
   proc=subprocess.run(['curl','--fail','--location','--silent','--show-error','--connect-timeout','8','--max-time','20',url],capture_output=True)
   if proc.returncode or proc.stdout[:4]!=b'RIFF' or b'WEBP' not in proc.stdout[:16]:missing.append(url);return
   path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(proc.stdout)
  images[url]='data/beta/media/'+name
 with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:list(pool.map(asset,sorted(x for x in refs if x)))
 for kind,entries in records.items():
  for ident,d in entries.items():
   d['versionSource']={'name':'nanoka','version':VERSION,'url':f'https://ww.nanoka.cc/{kind}/{ident}'}
   write(web/f'data/beta/{VERSION}/{kind}/{ident}.json',d)
 indexes={}
 for kind,entries in records.items():
  indexes[kind]={}
  for ident,d in entries.items():
   item={**live[kind].get(ident,{}),'zh':d['name'],'en':names[d['name']],'name':d['name'],'icon':d.get('icon',''),'rank':d['rarity']}
   for key in ['element','weapon','type']:
    if key in d:item[key]=d[key]
   indexes[kind][ident]=item
 language_file=f'data/beta/{VERSION}/en.texts.json';write(web/language_file,{'texts':texts,'names':names,'inline':inline,'source':'nanoka','version':VERSION})
 info={'gameVersion':VERSION,'channel':'beta','directory':f'data/beta/{VERSION}/','source':f'https://static.nanoka.cc/ww/{VERSION}/','characters':list(records['character']),'weapons':list(records['weapon']),'echoes':[],'index':indexes['character'],'weaponIndex':indexes['weapon'],'images':images,'missingImages':sorted(missing),'languageFile':language_file,'inputSha256':digests}
 registry['checkedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat();registry['versions']=[x for x in registry['versions'] if x['gameVersion']!=VERSION]+[info]
 registry['sources'][0].update({'live':'3.7','available':['3.7',VERSION]});write(web/'data/beta/index.json',registry)
 print('Reviewed 3.8.1 archive:',len(records['character']),'characters,',len(records['weapon']),'weapons;',len(images),'local images;',len(missing),'unavailable images;',len(texts),'English strings')

if __name__=='__main__':main()
