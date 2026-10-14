#!/usr/bin/env python3
"""Apply version-scoped scalar corrections transactionally before publication."""
import argparse,copy,json,math,pathlib,re
ROOT=pathlib.Path(__file__).resolve().parents[1]
RULES={
 'character':r'/(?:name|nickname|desc|chara_info/[^/]+|stats/\d+/\d+/(?:life|atk|def)|skill_trees/\d+/skill/(?:name|desc|simple_desc|(?:param|simple_param)/\d+(?:/\d+)?|level/\d+/(?:name|format|param/\d+/\d+))|skill_branches/\d+/(?:name|desc)|chains/\d+/(?:name|desc|param/\d+)|ascensions/\d+/\d+/value)',
 'weapon':r'/(?:name|desc|effect|effect_name|param/\d+/\d+|stats/\d+/\d+/\d+/value|ascensions/\d+/\d+/value)',
 'echo':r'/(?:name|type|place|intensity|skill/(?:desc|simple_desc|param/\d+/\d+)|group/\d+/(?:name|set/\d+/(?:desc|param/\d+)))',
 'item':r'/name',
 'sonata':r'/(?:name/zh|set/\d+/zh/(?:desc|param/\d+))'
}

def scalar(v):return v is None or type(v) in (str,int,float) and (not isinstance(v,float) or math.isfinite(v))
def valid_path(category,path):
 return isinstance(path,str) and len(path)<=250 and all(x not in ['__proto__','constructor','prototype','..',''] for x in path[1:].split('/')) and bool(re.fullmatch(RULES.get(category,r'(?!)'),path))
def target(obj,path):
 keys=path[1:].split('/');cur=obj
 for key in keys[:-1]:
  if isinstance(cur,list):
   if not re.fullmatch(r'0|[1-9]\d*',key):raise ValueError('Invalid array index')
   cur=cur[int(key)]
  else:cur=cur[key]
 key=keys[-1]
 if isinstance(cur,list):key=int(key)
 if isinstance(cur,dict) and key not in cur:raise ValueError('Correction field does not exist')
 return cur,key

def validate(document):
 if not isinstance(document,dict) or document.get('schema')!=1 or not isinstance(document.get('corrections'),list):raise ValueError('Expected schema 1 and corrections array')
 if len(document['corrections'])>500:raise ValueError('At most 500 corrections')
 seen=set()
 for r in document['corrections']:
  if not isinstance(r,dict):raise ValueError('Invalid correction')
  ident=r.get('id','')
  if not isinstance(ident,str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,80}',ident) or ident in seen:raise ValueError('Invalid or duplicate correction ID')
  seen.add(ident)
  if type(r.get('enabled')) is not bool:raise ValueError('enabled must be boolean')
  if not isinstance(r.get('entryId'),str) or not re.fullmatch(r'\d+',r['entryId']):raise ValueError('entryId must be a numeric string')
  if not valid_path(r.get('category'),r.get('path')):raise ValueError('Unsupported correction field: '+str(r.get('path')))
  if 'expected' not in r or 'value' not in r or not scalar(r['expected']) or not scalar(r['value']):raise ValueError('Only scalar values can be corrected')
  if type(r['expected']) in (int,float):
   if type(r['value']) not in (int,float):raise ValueError('Numeric field requires a number')
  elif r['expected'] is None:
   if r['value'] is not None and not isinstance(r['value'],str):raise ValueError('Nullable field requires text or null')
  elif not isinstance(r['value'],str):raise ValueError('Text field requires text')
  for k in ['gameVersion','resourceVersion']:
   if not isinstance(r.get(k),str) or not re.fullmatch(r'\d+\.\d+\.\d+',r[k]):raise ValueError('Exact game and resource versions are required')
  if not isinstance(r.get('reason'),str) or not r['reason'].strip() or len(r['reason'])>500:raise ValueError('Correction reason is required (max 500 characters)')
 return document['corrections']

def apply_to_data(data,rules,source):
 result=copy.deepcopy(data);applied=[];skipped=[];seen=set()
 # Restore any previously applied values so removing a rule also removes its effect.
 for category,entries in result.items():
  for ident,d in entries.items():
   for old in d.pop('manual_corrections',[])+d.pop('inherited_corrections',[]):
    if not valid_path(category,old['path']):raise ValueError('Invalid prior correction metadata')
    parent,key=target(d,old['path']);parent[key]=old['expected']
 for r in validate(rules):
  if not r['enabled']:skipped.append({'id':r['id'],'status':'disabled'});continue
  if any(r[k]!=source.get(k) for k in ['gameVersion','resourceVersion']):skipped.append({'id':r['id'],'status':'version_mismatch'});continue
  field=(r['category'],r['entryId'],r['path'])
  if field in seen:raise ValueError('Duplicate active field correction: '+str(field))
  seen.add(field)
  try:
   d=result[r['category']][r['entryId']];parent,key=target(d,r['path']);original=parent[key]
  except (KeyError,IndexError,TypeError,ValueError) as e:raise ValueError('Missing correction target: '+r['id']) from e
  if type(original)!=type(r['expected']) and not (type(original) in (int,float) and type(r['expected']) in (int,float)) or original!=r['expected']:raise ValueError('Upstream value changed; review correction '+r['id'])
  parent[key]=r['value'];d.setdefault('manual_corrections',[]).append(copy.deepcopy(r));applied.append(r['id'])
 return result,{'schema':1,'source':source,'applied':applied,'skipped':skipped}

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--web',type=pathlib.Path,default=ROOT/'web');a=p.parse_args();web=a.web
 meta=json.loads((web/'data/index.json').read_text());folder=web/'data'/meta['snapshot'];source=meta['provenance']
 rules=json.loads((web/'data/manual-corrections.json').read_text());data={};paths={}
 for category in ['character','weapon','echo']:
  rows=json.loads((folder/(category+'.json')).read_text());data[category]={}
  for ident in rows:
   path=folder/category/(ident+'.json');paths[(category,ident)]=path;data[category][ident]=json.loads(path.read_text())
 for category,name in [('item','items.json'),('sonata','sonatas.json')]:
  data[category]=json.loads((folder/name).read_text())
 corrected,report=apply_to_data(data,rules,source)
 active=[r for r in rules['corrections'] if r['id'] in report['applied']]
 for ident,d in corrected['echo'].items():
  for r in active:
   if r['category']!='sonata' or r['entryId'] not in d.get('group',{}):continue
   suffix=r['path'].replace('/name/zh','/name').replace('/zh/','/')
   path='/group/'+r['entryId']+suffix
   if any(x['path']==path for x in d.get('manual_corrections',[])):continue
   parent,key=target(d,path);original=parent[key];parent[key]=r['value']
   d.setdefault('inherited_corrections',[]).append({**r,'category':'echo','entryId':ident,'path':path,'expected':original})
 writes=[]
 for category in ['character','weapon','echo']:
  rows=json.loads((folder/(category+'.json')).read_text())
  for ident,d in corrected[category].items():
   if category=='character':
    for item_id,item in d.get('source_items',{}).items():
     if item_id in corrected['item']:item['name']=corrected['item'][item_id]['name']
   if d!=data[category][ident]:writes.append((paths[(category,ident)],d))
   rows[ident]['zh']=d['name']
   if category=='echo':rows[ident]['intensity']=d['intensity_code']
  writes.append((folder/(category+'.json'),rows))
 for category,name in [('item','items.json'),('sonata','sonatas.json')]:writes.append((folder/name,corrected[category]))
 writes.append((web/'data/corrections-status.json',report))
 # Validate all rules and all targets before any output mutation.
 for path,body in writes:
  temp=path.with_suffix(path.suffix+'.tmp');temp.write_text(json.dumps(body,ensure_ascii=False,separators=(',',':'))+'\n');temp.replace(path)
 print('Manual corrections:',len(report['applied']),'applied;',len(report['skipped']),'disabled or outside the selected version')
if __name__=='__main__':main()
