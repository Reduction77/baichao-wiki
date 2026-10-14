#!/usr/bin/env python3
"""Read upstream release metadata; never change the selected source or deploy."""
import argparse,datetime,json,pathlib,re,urllib.request
ROOT=pathlib.Path(__file__).resolve().parents[1]

def metadata(body):
 result={}
 for label,key in [('Status','status'),('Game Version','gameVersion'),('Resource Version','resourceVersion')]:
  match=re.search(r'^\s*>?\s*'+label+r':\s*([^<\r\n]+)',body,re.M)
  if not match:raise ValueError('Missing upstream metadata: '+label)
  result[key]=match.group(1).strip()
 for key in ['gameVersion','resourceVersion']:
  if not re.fullmatch(r'\d+\.\d+\.\d+',result[key]):raise ValueError('Invalid upstream version: '+key)
 return result

def config(path):
 d=json.loads(path.read_text())
 if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+',d.get('repository','')):raise ValueError('Invalid source repository')
 if not re.fullmatch(r'[0-9a-f]{40}',d.get('commit','')):raise ValueError('Source must use a full immutable commit SHA')
 if d.get('status')!='Release':raise ValueError('Only Release data can replace the live archive')
 for key in ['gameVersion','resourceVersion']:
  if not re.fullmatch(r'\d+\.\d+\.\d+',d.get(key,'')):raise ValueError('Invalid source version: '+key)
 return d

def get(url):
 req=urllib.request.Request(url,headers={'User-Agent':'Baichao-Wiki-source-check','Accept':'application/vnd.github+json'})
 with urllib.request.urlopen(req,timeout=60) as response:return response.read()

def readme(repo,sha):
 if not re.fullmatch(r'[0-9a-f]{40}',sha):raise ValueError('Invalid upstream commit')
 path=ROOT/'.cache/arikatsu'/sha/'README.md'
 if not path.exists():
  body=get(f'https://raw.githubusercontent.com/{repo}/{sha}/README.md')
  metadata(body.decode());path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(body)
 return path.read_text()

def verify(source):
 declared=metadata(readme(source['repository'],source['commit']))
 if any(source[k]!=declared[k] for k in ['status','gameVersion','resourceVersion']):raise ValueError('Source configuration does not match the pinned upstream README')
 if declared['status']!='Release':raise ValueError('Upstream data is not a confirmed release')
 return declared

def check(source,commits):
 verify(source)
 latest=None
 for row in commits:
  # Commit message is only a search hint; README verifies the actual channel.
  if not row.get('commit',{}).get('message','').strip().endswith('Release'):continue
  fields=metadata(readme(source['repository'],row['sha']))
  if fields['status']=='Release':
   latest={'repository':source['repository'],'commit':row['sha'],**fields};break
 if latest is None:raise ValueError('No verified Release found in the returned commit window')
 return {'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'current':source,'latestRelease':latest,'updateAvailable':latest['commit']!=source['commit'],'latestCommit':commits[0]['sha'] if commits else None,'scanLimit':len(commits)}

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--source-config',type=pathlib.Path,default=ROOT/'tools/github_source.json');p.add_argument('--output',type=pathlib.Path);p.add_argument('--candidate',type=pathlib.Path);a=p.parse_args()
 source=config(a.source_config);rows=json.loads(get(f'https://api.github.com/repos/{source["repository"]}/commits?per_page=30'));result=check(source,rows)
 body=json.dumps(result,ensure_ascii=False,indent=2)+'\n'
 if a.output:a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(body)
 if a.candidate:a.candidate.parent.mkdir(parents=True,exist_ok=True);a.candidate.write_text(json.dumps(result['latestRelease'],indent=2)+'\n')
 print(body)
if __name__=='__main__':main()
