#!/usr/bin/env python3
"""Import nanoka's public Wuthering Waves JSON. Python standard library + curl."""
import argparse, concurrent.futures, datetime, hashlib, json, os, pathlib, re, shutil, subprocess, sys, tempfile, time
ROOT = pathlib.Path(__file__).resolve().parents[1]
BASE = 'https://static.nanoka.cc'

def fetch(url, binary=False):
    p = subprocess.run(['curl','--fail','--location','--silent','--show-error','--connect-timeout','15','--max-time','50','--retry','1','--retry-delay','2',url],capture_output=True)
    if p.returncode:
        raise RuntimeError(f'{url}: curl {p.returncode} {p.stderr.decode(errors="replace")[:180]}')
    if binary: return p.stdout
    return json.loads(p.stdout)

def write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(',',':')), encoding='utf-8')

def image_url(value):
    if not isinstance(value,str) or not value: return ''
    if value.startswith(BASE+'/assets/ww/'): return value
    if not value.startswith('/Game/Aki/UI/'): return ''
    return BASE+'/assets/ww/'+value.replace('/Game/Aki/UI/','',1).split('.')[0]+'.webp'

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--version', default='live',help='live (default), latest, or explicit manifest version')
    ap.add_argument('--workers',type=int,default=4)
    ap.add_argument('--no-images',action='store_true',help='Text-only import; no external hotlinks')
    ap.add_argument('--keep',type=int,default=2,help='Retain this many successful snapshots')
    args=ap.parse_args()
    if not 1<=args.workers<=6: ap.error('workers must be 1..6')
    if args.keep<1: ap.error('keep must be at least 1')
    if not shutil.which('curl'): ap.error('curl is required')
    manifest=fetch(BASE+'/manifest.json'); game=manifest['ww']
    version=game.get(args.version) if args.version in ('live','latest') else args.version
    if not version or version not in game.get('available',[]): ap.error('Version not present in source manifest')
    print('Source version:',version,'live:',game.get('live'),flush=True)
    out=ROOT/'web/data'; out.mkdir(parents=True,exist_ok=True)
    snapshot=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S')+'-'+str(os.getpid())
    stage=out/('.staging-'+snapshot); stage.mkdir()
    errors=[]; image_errors=[]
    def job(category, ident):
        d=fetch(f'{BASE}/ww/{version}/zh/{category}/{ident}.json')
        if str(d.get('id'))!=str(ident): raise RuntimeError(f'ID mismatch: {category}/{ident}')
        if category=='character':
            fields=['id','rarity','weapon','element','tag','name','desc','icon','background','chara_info','stats','skill_trees','skill_branches','chains','ascensions','recommend']
            d={k:v for k,v in d.items() if k in fields}
            d['chara_info']={k:v for k,v in d.get('chara_info',{}).items() if k in ['birth','sex','country','influence','cv_name_cn','cv_name_jp','cv_name_en','cv_name_ko']}
        write(stage/category/(str(ident)+'.json'),d)
        return category, str(ident),d
    try:
        lists={}
        for category in ['character','weapon','echo']:
            lists[category]=fetch(f'{BASE}/ww/{version}/{category}.json')
        items=fetch(f'{BASE}/ww/{version}/zh/item.json')
        sonatas=fetch(f'{BASE}/ww/{version}/sonata.json')
        all_details={k:{} for k in lists}
        jobs=[(category,ident) for category,values in lists.items() for ident in values]
        print('Downloading',len(jobs),'detail records',flush=True)
        with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
            pending={pool.submit(job,c,i):(c,i) for c,i in jobs}
            for count,f in enumerate(concurrent.futures.as_completed(pending),1):
                try:
                    c,i,d=f.result();all_details[c][i]=d
                except Exception as e: errors.append(str(e));print('ERROR',str(e),flush=True)
                if count%20==0 or count==len(jobs): print(f'Details {count}/{len(jobs)}',flush=True)
        if errors: raise RuntimeError(f'{len(errors)} detail downloads failed; current site unchanged')
        # Only assets actually shown in v1. No voices, video, Live2D, or original client files.
        assets=set()
        for values in lists.values():
            for d in values.values(): assets.add(image_url(d.get('icon')))
        for d in all_details['character'].values(): assets.add(image_url(d.get('background')))
        material_ids={str(v['key']) for category in ['character','weapon'] for d in all_details[category].values() for costs in d.get('ascensions',{}).values() for v in costs}
        items={i:d for i,d in items.items() if str(i) in material_ids}
        for d in items.values(): assets.add(image_url(d.get('icon')))
        assets.discard(''); images={}
        def asset(url):
            blob=fetch(url,True)
            if not blob.startswith(b'RIFF') or b'WEBP' not in blob[:16]: raise RuntimeError('Not WebP: '+url)
            name=hashlib.sha256(url.encode()).hexdigest()[:24]+'.webp'
            dest=stage/'images'/name;dest.parent.mkdir(exist_ok=True);dest.write_bytes(blob)
            return url,f'data/{snapshot}/images/{name}'
        if not args.no_images:
            print('Downloading',len(assets),'display images',flush=True)
            with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
                futures={pool.submit(asset,u):u for u in assets}
                for count,f in enumerate(concurrent.futures.as_completed(futures),1):
                    try: u,p=f.result();images[u]=p
                    except Exception as e: image_errors.append(str(e))
                    if count%40==0 or count==len(assets): print(f'Images {count}/{len(assets)}; missing {len(image_errors)}',flush=True)
        for c,v in lists.items(): write(stage/(c+'.json'),v)
        write(stage/'items.json',items);write(stage/'sonatas.json',sonatas);write(stage/'images.json',images)
        index={'schema':1,'version':version,'hotfix':game.get('new',{}).get('hotfix'),'live':game.get('live'),'source':BASE,'sourcePage':'https://ww.nanoka.cc/','updated':datetime.datetime.now(datetime.timezone.utc).isoformat(),'snapshot':snapshot,'counts':{c:len(v) for c,v in lists.items()},'images':len(images),'missingImages':len(image_errors),'textOnly':args.no_images}
        write(stage/'metadata.json',index)
        if image_errors: write(stage/'image-errors.json',image_errors)
        stage.rename(out/snapshot)
        write(out/'index.new.json',index);os.replace(out/'index.new.json',out/'index.json')
        # Keep newest successful snapshots only. Never delete unrelated files.
        snapshots=sorted([p for p in out.iterdir() if p.is_dir() and re.fullmatch(r'\d{8}T\d{6}-\d+',p.name)],key=lambda p:p.name,reverse=True)
        for p in snapshots[args.keep:]: shutil.rmtree(p)
        size=sum(p.stat().st_size for p in (out/snapshot).rglob('*') if p.is_file())
        print(f'OK: {snapshot}, {size/1024/1024:.1f} MiB, {len(image_errors)} missing images',flush=True)
    except BaseException:
        shutil.rmtree(stage,ignore_errors=True)
        raise
if __name__=='__main__':
    try: main()
    except Exception as exc: print('FAILED:',exc,file=sys.stderr);sys.exit(1)
