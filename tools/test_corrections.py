import copy
from apply_corrections import apply_to_data,validate
source={'gameVersion':'3.7.0','resourceVersion':'3.7.8'}
data={'character':{'1304':{'name':'今汐','desc':'原说明','stats':{'6':{'90':{'atk':412.5}}}}},'weapon':{},'echo':{},'item':{},'sonata':{}}
def rule(**kw):return dict(id='fix-test',enabled=True,category='character',entryId='1304',path='/desc',expected='原说明',value='修正说明',reason='实机核对',gameVersion='3.7.0',resourceVersion='3.7.8',**kw)
r=rule();doc={'schema':1,'corrections':[r]}
a,report=apply_to_data(data,doc,source);assert a['character']['1304']['desc']=='修正说明';assert data['character']['1304']['desc']=='原说明'
b,_=apply_to_data(a,doc,source);assert b==a
b,_=apply_to_data(a,{'schema':1,'corrections':[]},source);assert b==data
b,report=apply_to_data(a,{'schema':1,'corrections':[{**r,'enabled':False}]},source);assert b==data and report['skipped'][0]['status']=='disabled'
b,report=apply_to_data(a,doc,{**source,'resourceVersion':'3.7.9'});assert b==data and report['skipped'][0]['status']=='version_mismatch'
n={**r,'id':'number','path':'/stats/6/90/atk','expected':412.5,'value':420};assert apply_to_data(data,{'schema':1,'corrections':[n]},source)[0]['character']['1304']['stats']['6']['90']['atk']==420
for invalid in [{**r,'expected':'过时原值'},{**r,'path':'/__proto__/name'},{**r,'path':'/id'},{**r,'value':{}},{**n,'value':'420'},{**r,'reason':''},{**r,'resourceVersion':'3.7'}]:
 try:apply_to_data(data,{'schema':1,'corrections':[invalid]},source)
 except ValueError:pass
 else:raise AssertionError('Invalid correction accepted')
try:apply_to_data(data,{'schema':1,'corrections':[r,{**r,'id':'second'}]},source)
except ValueError:pass
else:raise AssertionError('Duplicate field accepted')
print('Correction checks passed: repeatable application, deletion/disable restore, version isolation, conflicts and invalid fields.')
