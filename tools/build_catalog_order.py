#!/usr/bin/env python3
"""Build explicit catalog order from game display priority and release snapshots."""
import concurrent.futures,hashlib,json,pathlib,re,sys
from import_github_character import fetch
from check_github_updates import config,get,metadata,readme
ROOT=pathlib.Path(__file__).resolve().parents[1]
def main():
 source=config(ROOT/'tools/github_source.json');repo=source['repository'];commit=source['commit'];cache=ROOT/'.cache';cache.mkdir(exist_ok=True)
 history=cache/'release-commits.json'
 if history.exists():commits=json.loads(history.read_text())
 else:
  commits=[]
  for page in range(1,9):
   rows=json.loads(get(f'https://api.github.com/repos/{repo}/commits?per_page=100&page={page}'));commits+=rows
   if len(rows)<100:break
  history.write_text(json.dumps(commits))
 versions={};limit=tuple(map(int,source['gameVersion'].split('.')[:2]))
 for row in commits:
  match=re.search(r'GameVer\s+(\d+\.\d+\.\d+)',row['commit']['message'])
  if not match:continue
  v='.'.join(match[1].split('.')[:2]);series=tuple(map(int,v.split('.')))
  if series>limit:continue
  if row['commit']['message'].endswith('Release'):versions.setdefault(v,row['sha'])
 # Historical 2.3 commits used a region label rather than a Release suffix.
 # Their README is explicitly verified below, not treated as release by region.
 for row in commits:
  if limit>=(2,3) and 'GameVer 2.3.0' in row['commit']['message']:
   try:
    if metadata(readme(repo,row['sha']))['status']=='Release':versions.setdefault('2.3',row['sha']);break
   except ValueError:continue
 versions['.'.join(source['gameVersion'].split('.')[:2])]=commit
 def verify_release(pair):
  v,sha=pair;body=readme(repo,sha);m=metadata(body)
  if m['status']!='Release' or '.'.join(m['gameVersion'].split('.')[:2])!=v:raise ValueError('Unverified release snapshot: '+v)
  return v,{'metadata':m,'readmeSha256':hashlib.sha256(body.encode()).hexdigest()}
 with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:verified=dict(pool.map(verify_release,versions.items()))
 meta=json.loads((ROOT/'web/data/index.json').read_text());folder=ROOT/'web/data'/meta['snapshot'];catalogs={k:json.loads((folder/(k+'.json')).read_text()) for k in ['character','weapon','echo']}
 first={k:{} for k in catalogs};sources=[];paths={'weapon':'BinData/weapon/weaponconf.json','skin':'BinData/weapon/weaponskin.json','echo':'BinData/phantom/phantomitem.json'}
 def load(job):
  version,sha,kind,path=job
  try:d,h=fetch(cache/'arikatsu'/sha,path,commit=sha,repo=repo)
  except Exception as e:
   if kind=='skin' and ('404' in str(e)):return version,sha,kind,[],None
   raise
  return version,sha,kind,d,h
 jobs=[(v,sha,k,p) for v,sha in sorted(versions.items(),key=lambda x:tuple(map(int,x[0].split('.')))) for k,p in paths.items()]
 with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
  for v,sha,kind,rows,digest in pool.map(load,jobs):
   category='weapon' if kind in ['weapon','skin'] else 'echo';key={'weapon':'ItemId','skin':'Id','echo':'MonsterId'}[kind]
   for row in rows:
    ident=str(row[key])
    if ident in catalogs[category]:first[category].setdefault(ident,v)
   sources.append({'version':v,'commit':sha,'path':paths[kind],'sha256':digest,**verified[v]})
   print('Order snapshot:',v,kind,flush=True)
 role_rows,_=fetch(cache/'arikatsu'/commit,'BinData/role/roleinfo.json',commit=commit,repo=repo)
 views,_=fetch(cache/'arikatsu'/commit,'BinData/gacha/gachaviewinfo.json',commit=commit,repo=repo)
 first_banner={}
 for row in sorted(views,key=lambda r:r['Id']):
  if row['Type']!=3:continue
  for ident in row['ShowIdList']+row['UpList']:first_banner.setdefault(str(ident),row['Id'])
 roles={str(r['Id']):r['Priority'] for r in role_rows if str(r['Id']) in catalogs['character']}
 # Story-unlocked Rover elements need their own release position, not gender priority.
 for ident in ['1406','1408']:
  if ident in roles:roles[ident]=31.5
 for ident in ['1309','1310']:
  if ident in roles:roles[ident]=54.5
 output={'schema':1,'source':source,'notes':'Characters use game role display priority checked against release sequence; weapons use first release snapshot and first convene sequence; echoes use first confirmed release snapshot. Entries introduced in the same snapshot have stable name order; no release dates are invented.','snapshotSources':sources,'character':{i:{'order':order} for i,order in roles.items()},'weapon':{},'echo':{}}
 for kind in ['weapon','echo']:
  for ident in catalogs[kind]:
   version=first[kind].get(ident)
   output[kind][ident]={'version':version,'order':first_banner.get(ident,0) if kind=='weapon' else 0}
 (ROOT/'web/data/catalog-order.json').write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n')
 print('Catalog order saved:',{k:len(output[k]) for k in catalogs},flush=True)
if __name__=='__main__':main()
