#!/usr/bin/env python3
"""Convert a pinned Arikatsu dump into a standalone character pilot.

No nanoka request or data is used by conversion. --compare is optional and
only reads an existing snapshot after conversion, for a regression report.
"""
import argparse, hashlib, json, re, time, urllib.request
from pathlib import Path

COMMIT = '9218d612ad815e398e064e577e42aaf878899968'
REPO = 'Arikatsu/WutheringWaves_Data'
FILES = {
 'roles': 'BinData/role/roleinfo.json',
 'skills': 'BinData/skill/skill.json',
 'descriptions': 'BinData/skill/skilldescription.json',
 'levels': 'BinData/skill/skilllevel.json',
 'types': 'BinData/skill/skilltype.json',
 'nodes': 'BinData/skillTree/skilltree.json',
 'chains': 'BinData/resonate_chain/resonantchain.json',
 'breaches': 'BinData/role_level/rolebreach.json',
 'items': 'BinData/item/iteminfo.json',
 'base': 'BinData/property/baseproperty.json',
 'growth': 'BinData/property/rolepropertygrowth.json',
 'favor': 'BinData/favor/favorroleinfo.json',
 'texts': 'Textmaps/zh-Hans/multi_text/MultiText.json',
}

def fetch(root, path):
    dest = root / path
    if not dest.exists():
        dest.parent.mkdir(parents=True, exist_ok=True)
        url = f'https://raw.githubusercontent.com/{REPO}/{COMMIT}/{path}'
        for attempt in range(3):
            try:
                with urllib.request.urlopen(url, timeout=90) as response:
                    body = response.read()
                json.loads(body)  # reject HTTP error bodies before caching
                dest.write_bytes(body)
                break
            except Exception:
                if attempt == 2: raise
                time.sleep(1)
    return json.loads(dest.read_text()), hashlib.sha256(dest.read_bytes()).hexdigest()

def costs(rows):
    return [{'key': x['Key'], 'value': x['Value']} for x in rows]

def convert(data, role_id):
    texts = {x['Id']: x['Content'] for x in data['texts']}
    def text(key):
        if not key: return ''
        if key not in texts: raise ValueError(f'Missing localization: {key}')
        return texts[key]
    r = next(x for x in data['roles'] if x['Id'] == role_id)
    f = next(x for x in data['favor'] if x['RoleId'] == role_id)
    base = next(x for x in data['base'] if x['Id'] == r['PropertyId'])
    skill_types = {x['Id']: text(x['TypeName']) for x in data['types']}
    skill_rows = {x['Id']: x for x in data['skills']}
    nodes = {}
    for n in data['nodes']:
        if n['NodeGroup'] != r['SkillTreeGroupId']: continue
        s = skill_rows.get(n['SkillId'])
        if s:
            group = s['SkillLevelGroupId']
            skill = {'name': text(s['SkillName']), 'desc': text(s['SkillDescribe']),
                'param': s['SkillDetailNum'], 'simple_desc': text(s['SkillResume']),
                'simple_param': s['SkillResumeNum'], 'icon': s['Icon'],
                'type': skill_types[s['SkillType']],
                'level': {str(x['Order']): {'name': text(x['AttributeName']),
                    'param': [v['ArrayString'] for v in x['SkillDetailNum']],
                    'format': text(x['Description']) or None}
                    for x in sorted(data['descriptions'], key=lambda x:x['Order'])
                    if x['SkillLevelGroupId'] == group},
                'consume': {str(x['SkillId']): costs(x['Consume'])
                    for x in data['levels'] if x['SkillLevelGroupId'] == group}}
        else:
            skill = {'name': text(n['PropertyNodeTitle']),
                'desc': text(n['PropertyNodeDescribe']), 'param': n['PropertyNodeParam'],
                'icon': n['PropertyNodeIcon'], 'type': '属性加成', 'level': {}}
        nodes[str(n['NodeIndex'])] = {'parent_nodes': n['ParentNodes'],
            'node_type': n['NodeType'], 'coordinate': n['Coordinate'],
            'un_lock_condition': n['UnLockCondition'], 'skill_branch_ids': n['SkillBranchIds'],
            'consume': costs(n['Consume']), 'skill': skill}
    stats = {}
    for g in data['growth']:
        stats.setdefault(str(g['BreachLevel']), {})[str(g['Level'])] = {
            key: base[b] * g[v] / 10000 for key,b,v in
            [('life','LifeMax','LifeMaxRatio'),('atk','Atk','AtkRatio'),('def','Def','DefRatio')]}
    chains = {str(x['GroupIndex']): {'name': text(x['NodeName']),
        'desc': text(x['AttributesDescription']), 'param': x['AttributesDescriptionParams'],
        'icon': x['NodeIcon']} for x in data['chains'] if x['GroupId']==r['ResonantChainGroupId']}
    ascensions = {str(x['BreachLevel']): costs(x['BreachConsume'])
        for x in data['breaches'] if x['BreachGroupId']==r['BreachId'] and x['BreachLevel']}
    all_costs = list(ascensions.values())
    for n in nodes.values():
        all_costs.append(n['consume'])
        all_costs.extend(n['skill'].get('consume', {}).values())
    ids = {x['key'] for row in all_costs for x in row}
    item_rows = {x['Id']:x for x in data['items']}
    source_items = {str(i): {'name':text(item_rows[i]['Name']), 'icon':item_rows[i]['Icon']}
                    for i in sorted(ids)}
    return {'id':role_id, 'name':text(r['Name']), 'nickname': '' if text(r['NickName']).startswith('存在异常') else text(r['NickName']),
        'desc':text(r['Introduction']), 'rarity':r['QualityId'],
        'weapon':r['WeaponType'], 'element':r['ElementId'], 'tag':{},
        'icon':r['RoleHeadIconLarge'], 'background':r['FormationRoleCard'],
        'chara_info': {key:text(f[field]) for key,field in
            [('birth','Birthday'),('sex','Sex'),('country','Country'),('influence','Influence'),
             ('cv_name_cn','CVNameCn'),('cv_name_jp','CVNameJp'),('cv_name_en','CVNameEn'),('cv_name_ko','CVNameKo')]},
        'stats':stats, 'skill_trees':dict(sorted(nodes.items(),key=lambda x:int(x[0]))),
        'skill_branches':{}, 'chains':chains, 'ascensions':ascensions,
        'source_items':source_items, 'recommend':{}}

def normalized(value):
    if isinstance(value, str):
        return re.sub(r'\s+', '', re.sub(r'<[^>]*>', '', value))
    if isinstance(value, dict): return {k:normalized(v) for k,v in value.items()}
    if isinstance(value, list): return [normalized(v) for v in value]
    return value

def compare(new, old):
    results=[]
    def check(label, pairs):
        differences = [path for path,a,b in pairs if normalized(a)!=normalized(b)]
        results.append({'label':label,'checked':len(pairs),'matched':len(pairs)-len(differences),
                        'differences':differences})
    check('技能名称与说明', [(f'{i}/{k}',s['skill'].get(k),old['skill_trees'].get(i,{}).get('skill',{}).get(k))
        for i,s in new['skill_trees'].items() for k in ['name','desc','param']])
    check('技能倍率与参数', [(f'{i}/{j}/{k}',v.get(k),old['skill_trees'].get(i,{}).get('skill',{}).get('level',{}).get(j,{}).get(k))
        for i,n in new['skill_trees'].items() for j,v in n['skill']['level'].items() for k in ['name','param','format']])
    check('共鸣链', [(f'{i}/{k}',c[k],old['chains'].get(i,{}).get(k)) for i,c in new['chains'].items() for k in ['name','desc','param']])
    check('突破材料',[(i,sorted(c,key=lambda x:x['key']), sorted(old['ascensions'].get(i,[]),key=lambda x:x['key'])) for i,c in new['ascensions'].items()])
    check('基础属性',[(f'{s}/{lv}/{k}',round(v,5),round(old['stats'][s][lv][k],5)) for s,lvs in new['stats'].items() for lv,values in lvs.items() for k,v in values.items()])
    return results

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache',type=Path,default=Path('.cache/arikatsu')/COMMIT)
    parser.add_argument('--output',type=Path,default=Path('web/data/experiments/1304.json'))
    parser.add_argument('--compare',type=Path)
    args=parser.parse_args()
    data={}; hashes={}
    for name,path in FILES.items():
        data[name],hashes[path]=fetch(args.cache,path)
    out=convert(data,1304)
    out['provenance']={'repository':REPO,'commit':COMMIT,'gameVersion':'3.7.0',
        'resourceVersion':'3.7.8','locale':'zh-Hans','inputSha256':hashes,
        'missingFields':['称号：上游文本为异常占位内容，已隐藏'],
        'scope':'今汐试验：文字、基础属性、技能倍率、共鸣链与材料从 GitHub 原始配置转换。图片沿用本站保存的 nanoka 图片快照。未转换伤害拆分、战斗标签、故事、Live2D 与推荐配装。'}
    if args.compare:
        out['comparison']=compare(out,json.loads(args.compare.read_text()))
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(out.get('comparison',{}),ensure_ascii=False,indent=2))

if __name__=='__main__': main()
