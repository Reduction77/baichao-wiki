#!/usr/bin/env python3
"""Import available future beta game snapshots; never infer beta from resource versions."""
import argparse, concurrent.futures, datetime, hashlib, json, pathlib, re, subprocess
ROOT=pathlib.Path(__file__).resolve().parents[1]
BASE='https://static.nanoka.cc'

def fetch(url,binary=False):
    r=subprocess.run(['curl','--fail','--location','--silent','--show-error','--connect-timeout','15','--max-time','50','--retry','1',url],capture_output=True)
    if r.returncode:raise RuntimeError(f'{url}: {r.stderr.decode(errors="replace")[:160]}')
    return r.stdout if binary else json.loads(r.stdout)

def series(v):
    if not re.fullmatch(r'\d+\.\d+(?:\.\d+)?',str(v)):raise ValueError('Invalid game version')
    return tuple(map(int,str(v).split('.')[:2]))

def eligible_versions(available,live):
    release=series(live)
    # These are manifest GAME snapshot identifiers, not Resource Version values.
    return sorted([v for v in available if re.fullmatch(r'\d+\.\d+\.[1-9]\d*',str(v)) and series(v)>release],key=lambda v:tuple(map(int,v.split('.'))))

def write(path,value):
    path.parent.mkdir(parents=True,exist_ok=True)
    tmp=path.with_suffix(path.suffix+'.tmp');tmp.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n');tmp.replace(path)

def asset_url(ref):
    if not isinstance(ref,str):return None
    if ref.startswith('/Game/Aki/UI/'):return BASE+'/assets/ww/'+ref.replace('/Game/Aki/UI/','',1).split('.')[0]+'.webp'
    return ref if ref.startswith(BASE+'/assets/ww/') else None

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--workers',type=int,default=4);args=parser.parse_args()
    if not 1<=args.workers<=6:parser.error('workers must be 1..6')
    manifest=fetch(BASE+'/manifest.json')['ww'];live=manifest['live'];available=eligible_versions(manifest.get('available',[]),live)
    out=ROOT/'web/data/beta';meta=json.loads((ROOT/'web/data/index.json').read_text());current_images=json.loads((ROOT/'web/data'/meta['snapshot']/'images.json').read_text())
    for f in ['assets/character-icons.json','assets/pilot/images.json']:
        p=ROOT/'web'/f
        if p.exists():current_images.update(json.loads(p.read_text()))
    records=[]
    for version in available:
        print('Importing beta game snapshot',version,flush=True)
        index=fetch(f'{BASE}/ww/{version}/character.json');item_rows=fetch(f'{BASE}/ww/{version}/zh/item.json')
        def detail(ident):
            d=fetch(f'{BASE}/ww/{version}/zh/character/{ident}.json')
            if str(d.get('id'))!=str(ident):raise ValueError('Character ID mismatch')
            if not all(k in d for k in ['name','stats','skill_trees','chains','ascensions']):raise ValueError('Incomplete beta character snapshot')
            if not all(isinstance(d[k],dict) for k in ['stats','skill_trees','chains','ascensions']):raise ValueError('Unsupported beta character schema')
            if any(not isinstance(n.get('skill'),dict) for n in d['skill_trees'].values()):raise ValueError('Incomplete beta skill data')
            cost_lists=list(d.get('ascensions',{}).values())
            for n in d.get('skill_trees',{}).values():cost_lists.append(n.get('consume',[]));cost_lists.extend(n.get('skill',{}).get('consume',{}).values())
            ids={str(c['key']) for cs in cost_lists for c in cs}
            d['source_items']={i:item_rows[i] for i in ids if i in item_rows}
            return str(ident),d
        with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:details=dict(pool.map(detail,index))
        refs=set()
        for d in details.values():
            refs.update([d.get('icon'),d.get('background')]);refs.update(n.get('skill',{}).get('icon') for n in d.get('skill_trees',{}).values());refs.update(c.get('icon') for c in d.get('chains',{}).values());refs.update(i.get('icon') for i in d.get('source_items',{}).values())
        images={};missing=[]
        def image(ref):
            url=asset_url(ref)
            if not url:return None,None
            if url in current_images:return url,current_images[url]
            name=hashlib.sha256(url.encode()).hexdigest()[:24]+'.webp';p=out/'media'/name
            try:
                body=fetch(url,True)
                if body[:4]!=b'RIFF' or b'WEBP' not in body[:16]:raise ValueError('Invalid WebP')
                p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(body);return url,'data/beta/media/'+name
            except Exception as e:missing.append({'url':url,'error':str(e)});return None,None
        with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
            for url,ref in pool.map(image,refs):
                if url:images[url]=ref
        for ident,d in details.items():write(out/version/'character'/f'{ident}.json',d)
        records.append({'gameVersion':version,'channel':'beta','directory':f'data/beta/{version}/','source':f'{BASE}/ww/{version}/','characters':sorted(details,key=int),'index':{i:{**d,'name':d.get('zh',i)} for i,d in index.items()},'images':images,'missingImages':missing})
    old=json.loads((out/'index.json').read_text()) if (out/'index.json').exists() else {}
    # Old beta files may remain archived, but only eligible records are published.
    write(out/'index.json',{'schema':1,'releasedGameVersion':live if len(live.split('.'))==3 else live+'.0','checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sources':[{'url':BASE+'/manifest.json','live':live,'available':manifest.get('available',[])}]+[s for s in old.get('sources',[]) if 'github.com/' in s.get('url','')],'versions':records})
    print('Published beta registry:',len(records),'future game snapshots; released game',live)

if __name__=='__main__':main()
