#!/usr/bin/env python3
"""Build compact, source-backed team-builder profiles from the restored archive."""
import json,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
web=ROOT/'web';meta=json.loads((web/'data/index.json').read_text(encoding='utf-8'))
folder=web/'data'/meta['snapshot']
index=json.loads((folder/'character.json').read_text(encoding='utf-8'))
order=json.loads((web/'data/catalog-order.json').read_text(encoding='utf-8'))['character']
# One Mandarin initial per syllable, using the pronunciation of the character name.
initials_by_name = {
    '散华': 'sh', '白芷': 'bz', '凌阳': 'ly', '折枝': 'zz', '釉瑚': 'yh',
    '珂莱塔': 'klt', '绯雪': 'fx', '洛瑟菈': 'lsl', '穗穗': 'ss',
    '炽霞': 'cx', '安可': 'ak', '莫特斐': 'mtf', '长离': 'cl', '布兰特': 'blt',
    '露帕': 'lp', '嘉贝莉娜': 'jbln', '莫宁': 'mn', '爱弥斯': 'ams', '达妮娅': 'dny', '景燃': 'jr',
    '卡卡罗': 'kkl', '吟霖': 'yl', '渊武': 'yw', '今汐': 'jx', '相里要': 'xly',
    '奥古斯塔': 'agst', '卜灵': 'bl', '丽贝卡': 'lbk', '漂泊者·导电': 'pbzdd', '心': 'x', '锁暝': 'sm',
    '秧秧': 'yy', '秋水': 'qs', '忌炎': 'jy', '鉴心': 'jx', '漂泊者·气动': 'pbzqd',
    '夏空': 'xk', '卡提希娅': 'ktxy', '尤诺': 'yn', '仇远': 'qy', '西格莉卡': 'xglk', '清宵': 'qx',
    '漂泊者·衍射': 'pbzys', '维里奈': 'wln', '灯灯': 'dd', '守岸人': 'sar',
    '菲比': 'fb', '赞妮': 'zn', '千咲': 'qx', '琳奈': 'ln', '陆·赫斯': 'lhs', '露西': 'lx', '莉莉': 'll',
    '桃祈': 'tq', '丹瑾': 'dj', '椿': 'c', '漂泊者·湮灭': 'pbzym',
    '洛可可': 'lkk', '坎特蕾拉': 'ktll', '弗洛洛': 'fll', '秧秧·玄翎': 'yyxl',
}
profiles={};names={};aliases={}
for ident,row in index.items():
    d=json.loads((folder/'character'/(ident+'.json')).read_text(encoding='utf-8'))
    name=d['name'];canonical=names.setdefault(name,ident);aliases[ident]=canonical
    if canonical in profiles:
        profiles[canonical]['aliases'].append(ident);continue
    tags=[v['name'] for v in d.get('tag',{}).values()]
    roles=[]
    if '主力输出' in tags:roles.append('main')
    if '快速协奏' in tags or any('加深' in t or '增幅' in t for t in tags):roles.append('support')
    if '生存治疗' in tags:roles.append('sustain')
    if not roles:roles=['support']
    # Team-builder roles describe playable uses, independently of the official tags.
    if name in {'布兰特','尤诺','千咲'} and 'main' not in roles:roles.append('main')
    primary='main' if name=='布兰特' or '主力输出' in tags else 'sustain' if 'sustain' in roles else 'support'
    if name not in initials_by_name:
        raise ValueError(f'Missing pinyin initials for {name} ({ident})')
    profiles[ident]={**row,'id':ident,'name':name,'pinyinInitials':initials_by_name[name],'aliases':[ident],
        'family':'rover' if name.startswith('漂泊者') else ident,
        'tags':tags,'roles':roles,'primary':primary,
        'releaseOrder':order.get(ident,{}).get('order',0)}
result={'schema':1,'source':meta['provenance'],'version':meta['version'],'aliases':aliases,'characters':list(profiles.values())}
(web/'data/team-builder.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Team profiles:',len(profiles),'characters;',len(aliases),'archive IDs')
