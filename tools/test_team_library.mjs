import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {mergeTeamLibrary,videoReferences,renderTeamVideos} from '../web/assets/team-videos.js';
import {defaultState,recommend} from '../web/assets/team-builder-core.js';
const read=async name=>JSON.parse(await fs.readFile(new URL('../web/data/'+name,import.meta.url)));
const [config,legacy,profiles]=await Promise.all(['team-recommendations.json','teams.json','team-builder.json'].map(read));
const library=mergeTeamLibrary(legacy,config),chars=new Map(profiles.characters.map(p=>[p.id,p]));
const signatures=new Set();
for(const t of library){
 const ids=t.characters.map(String);assert(ids.every(id=>chars.has(id)));
 assert.equal(ids.length,t.type==='guide'?1:3);
 if(t.type!=='guide'){const key=ids.sort().join('-');assert(!signatures.has(key),'duplicate team '+key);signatures.add(key);}
 const refs=videoReferences(t,config.sources);assert(refs.length,t.title);
 for(const ref of t.references||[])assert(config.sources[ref.sourceId],'missing source '+ref.sourceId);
}
for(const [bv,v] of Object.entries(config.sources)){assert.match(bv,/^BV[A-Za-z0-9]{10}$/);assert.equal(new URL(v.url).pathname.replace(/\/$/,''),'/video/'+bv);assert(!/打游戏的老二|长风ei|久晨ovo/.test(v.up));}
for(const bv of ['BV1qrFhYMEWJ','BV1KL1MB5Ep2','BV1SNptzAELj','BV16HJN6wE5p','BV1FLAAe3ELL','BV1rhth68Eir'])assert(!config.sources[bv]);
assert.equal(config.sources.BV1qFrFYMEWJ.up,'厉不厉害你柴哥');
const find=ids=>config.teams.find(t=>ids.length===t.characters.length&&ids.every(id=>t.characters.includes(id)));
for(const ids of [
 ['1108','1509','1110'],['1108','1109','1508'],['1108','1509','1209'],
 ['1203','1205','1503'],['1203','1205','1505'],['1205','1207','1206'],
 ...['1411','1207','1204'].flatMap(support=>['1505','1503'].map(sustain=>['1208',support,sustain])),
 ...['1207','1204'].map(support=>['1208',support,'1209']),
 ...['1207','1205'].flatMap(support=>['1209','1508','1505','1503'].map(sustain=>['1210',support,sustain])),
 ...['1505','1503'].map(sustain=>['1212','1204',sustain]),
 ...['1110','1508'].map(sustain=>['1311','1309',sustain]),
 ['1404','1407','1505'],...['1505','1503'].map(sustain=>['1510','1102',sustain]),
 ['1511','1308','1209'],...['1505','1503'].map(sustain=>['1506','1501',sustain]),
])assert(find(ids),'required combination '+ids.join('/'));
const brant=find(['1205','1207','1206']);assert(brant.mains.includes('1206'));assert(brant.mains.includes('1205'));assert.equal(chars.get('1206').primary,'main');
assert.match(find(['1208','1204','1209']).references[0].note,/莫宁必须1链/);
assert.match(find(['1508','1509','1505']).requirements,/3\+1/);
assert(config.guides.some(t=>t.characters.includes('1508')&&t.references.some(r=>r.sourceId==='BV125UQByEeT')));
assert(!config.teams.some(t=>t.sourceIds.includes('BV125UQByEeT')));
for(const bv of ['BV1B6Y86AEGU','BV1E7Awz8Evn']){assert(config.guides.some(g=>g.references.some(r=>r.sourceId===bv)));assert(!config.teams.some(t=>t.sourceIds.includes(bv)));}
for(const [ids,bv] of [
 [['1203','1205','1503'],'BV1ZE4m1R7i2'],
 [['1511','1308','1505'],'BV14wEJ6EEhS'],
 [['1511','1308','1209'],'BV14wEJ6EEhS'],
 [['1410','1405','1505'],'BV1jNpizKEjG'],
 [['1604','1102','1505'],'BV1DwrUYcEg5'],
]){assert(find(ids)?.sourceIds.includes(bv),'confirmed full team '+bv);assert(!config.guides.some(g=>g.references.some(r=>r.sourceId===bv)));}
const yunoState={...defaultState(),draft:['1410','1405']};assert(recommend(yunoState,profiles,config).some(p=>p.id==='1505'));
assert(find(['1604','1102','1103']),'Keep the separately sourced Baizhi team');
for(const sustain of ['1503','1505'])assert(find(['1506','1501',sustain]).sourceIds.includes('BV1JeAwegEUy'));
for(const pair of [['1206','1102'],['1102','1206'],['1208','1204'],['1204','1208']]){const s={...defaultState(),draft:[pair[0]]};assert(recommend(s,profiles,config).some(p=>p.id===pair[1]));}
const fixture={characters:['1304','1105','1503'],name:'name',sourceIds:['new'],references:[{sourceId:'old',note:'stale'}]};
const edited=mergeTeamLibrary([{title:'admin edit',characters:[1304,1105,1503],videos:[{url:'https://www.bilibili.com/video/BV1VAsseLEGd',title:'edited title',up:'editor'}]}],{teams:[{...fixture,sourceIds:['x'],references:[{sourceId:'x',note:'配置说明'}]}],sources:{x:{url:'https://www.bilibili.com/video/BV1VAsseLEGd/',title:'original'}}});
assert.equal(edited.length,1);const refs=videoReferences(edited[0],{x:{url:'https://www.bilibili.com/video/BV1VAsseLEGd/'}});assert.equal(refs.length,1);assert.equal(refs[0].title,'edited title');assert.equal(refs[0].note,'配置说明');
const html=renderTeamVideos(fixture,{new:{url:'https://www.bilibili.com/video/BV1VAsseLEGd/',title:'<script>unsafe</script>',up:'author'}});assert(html.includes('&lt;script&gt;'));assert(!html.includes('stale'));
console.log(`Team library passed: ${signatures.size} unique combinations, ${config.guides.length} guides; shared sources, requested teams, special requirements and admin compatibility.`);
