import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {matrixPermanent,matrixCurrent,defaultState,parseState,characterMap,uses,limitFor,unavailableReason,budgetConflicts,selectCharacter,saveTeam,recommend,matchingTeams} from '../web/assets/team-builder-core.js';
import {createTeamBuilder} from '../web/assets/team-builder.js';
const web=new URL('../web/',import.meta.url);
const profiles=JSON.parse(await fs.readFile(new URL('data/team-builder.json',web)));
const records=JSON.parse(await fs.readFile(new URL('data/teams.json',web)));
const config=JSON.parse(await fs.readFile(new URL('data/team-recommendations.json',web)));

const meta=JSON.parse(await fs.readFile(new URL('data/index.json',web)));
const chars=characterMap(profiles);
assert.equal(profiles.source.commit,meta.provenance.commit);
assert.equal(Object.keys(profiles.aliases).length,meta.counts.character);
assert.equal(new Set(profiles.characters.map(p=>p.name)).size,profiles.characters.length);
for(const p of chars.values()){assert(p.tags.length);assert(p.roles.length);for(const id of p.aliases)assert.equal(profiles.aliases[id],p.id);}
const jinhsi=chars.get('1304'),zhezhi=chars.get('1105');
for(const p of profiles.characters.filter(p=>p.primary==='main'))assert(config.teams.some(t=>t.mains.includes(p.id)),p.name+' lacks a sourced team');
for(const t of config.teams){assert.equal(t.characters.length,3);assert.equal(new Set(t.characters.map(id=>chars.get(id)?.family)).size,3);for(const key of t.sourceIds){const v=config.sources[key];assert.match(v.url,/^https:\/\/www.bilibili.com\/video\/BV/);assert(!/打游戏的老二|长风ei|久晨ovo/.test(v.up));}}
let s=defaultState();selectCharacter(s,'1304',chars);
assert(recommend(s,profiles,config).some(p=>p.id==='1105'));
assert(recommend(s,profiles,config).some(p=>p.id==='1503'));
s=defaultState();selectCharacter(s,'1105',chars);
assert(recommend(s,profiles,config).filter(p=>p.primary==='main').some(p=>p.id==='1304'));
assert(recommend(s,profiles,config).filter(p=>p.primary==='main').some(p=>p.id==='1107'));
s.excluded=['1304'];assert(!recommend(s,profiles,config).some(p=>p.id==='1304'));
assert.equal(recommend(defaultState(),profiles,config).length,0);
s=defaultState();for(const id of ['1304','1105','1503'])assert.equal(selectCharacter(s,id,chars),'');
assert.equal(recommend(s,profiles,config).length,0);assert.match(selectCharacter(s,'1505',chars),/已满/);
assert.equal(saveTeam(s,chars),'');assert.equal(s.teams.length,1);assert.equal(s.draft.length,0);
assert.match(unavailableReason(s,jinhsi,chars),/次数/);
s.matrix=true;assert.equal(limitFor(s,jinhsi),1);assert.equal(limitFor(s,zhezhi),1);
assert.equal(matrixPermanent.length,7);assert(matrixPermanent.includes('1106'));assert.deepEqual(matrixCurrent,['1509']);
for(const id of [...matrixPermanent,...matrixCurrent])assert.equal(limitFor(s,chars.get(id)),2,`${id} must have two uses in the current rules`);
s=defaultState();s.matrix=true;
for(const team of [['1509','1304','1503'],['1509','1107','1503']]){for(const id of team)assert.equal(selectCharacter(s,id,chars),'');assert.equal(saveTeam(s,chars),'');}
assert.equal(uses(s,chars)['1509'],2);assert.equal(uses(s,chars)['1503'],2);
assert.match(selectCharacter(s,'1509',chars),/次数/);assert.match(selectCharacter(s,'1503',chars),/次数/);
assert.equal(budgetConflicts(s,chars).length,0);
s.matrix=false;assert.equal(budgetConflicts(s,chars).length,2);
s.teams.splice(0,1);assert.equal(budgetConflicts(s,chars).length,0);
// Atomic team matching: the electric and concerto systems must never cross-pollinate.
s=defaultState();s.draft=['1311','1309'];assert(recommend(s,profiles,config).some(p=>p.id==='1307'));assert(!recommend(s,profiles,config).some(p=>p.id==='1505'));
s.draft=['1311','1304'];assert(recommend(s,profiles,config).some(p=>p.id==='1505'));assert(!recommend(s,profiles,config).some(p=>p.id==='1307'));
s.draft=['1311','1601'];assert.equal(recommend(s,profiles,config).length,0);
s.draft=['1311'];s.excluded=[chars.get('1309').family];assert(!recommend(s,profiles,config).some(p=>p.id==='1307'),'Do not suggest a member if the full team cannot be completed');
const atomic={teams:[{characters:['1304','1105','1503'],system:'A',name:'A'},{characters:['1107','1601','1505'],system:'B',name:'B'}]};
s=defaultState();s.draft=['1304','1601'];assert.equal(matchingTeams(s,profiles,atomic).length,0);
const rover=profiles.characters.filter(p=>p.family==='rover');assert(rover.length>1);
const r=defaultState();selectCharacter(r,rover[0].id,chars);assert.match(selectCharacter(r,rover[1].id,chars),/已在当前/);
assert.throws(()=>parseState({schema:1,teams:[{characters:[rover[0].id,rover[1].id,'1304']}]},profiles),/重复/);
const restored=parseState({schema:1,matrix:true,teams:[{name:'<script>text</script>',characters:['1304','1105','1503']}],draft:['1502'],limits:{rover:3}},profiles);
assert.equal(restored.draft[0],profiles.aliases['1502']);assert.equal(restored.schema,4);assert(!('matrixPeriod' in restored));assert(!('matrixCharacter' in restored));assert(!('limits' in restored));assert.equal(limitFor(restored,jinhsi),1);
const legacy=parseState({schema:2,matrix:true,matrixCharacter:'1304',teams:[]},profiles);assert(!('matrixPeriod' in legacy));assert.equal(limitFor(legacy,jinhsi),1);assert.equal(limitFor(legacy,chars.get('1509')),2);
const oldPeriod=parseState({schema:3,matrix:true,matrixPeriod:'legacy-period',teams:[{characters:['1509','1304','1503']}]},profiles);assert(!('matrixPeriod' in oldPeriod));assert.equal(oldPeriod.teams.length,1);assert.equal(limitFor(oldPeriod,chars.get('1509')),2);
for(const raw of [{schema:4,teams:[],matrixPeriod:'invalid'},{schema:4,teams:[],matrixCharacter:'1304'},{schema:99,teams:[]},{schema:1,teams:[{characters:['1304','1105','999999']}]},{schema:2,teams:[],matrixCharacter:['1304','1107']},{schema:2,teams:[],matrixCharacter:'unknown'},{schema:2,teams:[],limits:{rover:2}},{schema:1,teams:[{characters:['1304','1304','1503']}]},{schema:1,teams:[],excluded:['unknown']},{schema:1,teams:[{characters:['1304','1105']}]}])assert.throws(()=>parseState(raw,profiles));

class Node{constructor(){this.innerHTML='';this.textContent='';this.value='';this.handlers={};this.dataset={};}addEventListener(n,f){this.handlers[n]=f;}removeEventListener(n){delete this.handlers[n];}focus(){}querySelector(selector){return nodes.get(selector)||null;}querySelectorAll(){return [];}}
const root=new Node(),nodes=new Map(['#tb-message','#tb-roster-list','#tb-import-text','#tb-import-error','.tb-dialog'].map(k=>[k,new Node()]));
const local=new Map();const storage={getItem:k=>local.get(k),setItem:(k,v)=>local.set(k,v)};
const builder=createTeamBuilder({profiles,teams:records,recommendations:config,img:()=>'<img src="assets/test.webp" alt="">',storage});
builder.mount(root);
const click=async(tb,extra={})=>root.handlers.click({target:{closest:()=>({dataset:{tb,...extra}})}});
assert(root.innerHTML.includes('矩阵模式'));assert(root.innerHTML.includes('60 个角色形态'));
await click('pick',{id:'1304'});
assert(root.innerHTML.includes('已收录完整配队'));assert(root.innerHTML.includes('bilibili.com/video/'));assert(!root.innerHTML.includes('伤害加深匹配'));
assert(root.innerHTML.includes('href="#character/1105"'));
await click('pick',{id:'1105'});await click('pick',{id:'1503'});
assert(root.innerHTML.includes('已收录完整配队'));
await click('left',{index:'2'});assert.deepEqual(builder.getState().draft,['1304','1503','1105']);
await click('save');assert.equal(builder.getState().teams.length,1);
assert(root.innerHTML.includes('href="#character/1304"'));
await click('matrix');assert.equal(builder.getState().matrix,true);
assert(!root.innerHTML.includes('tb-matrix-period'));assert(root.innerHTML.includes('本期矩阵规则'));assert(root.innerHTML.includes('釉瑚'));assert(!root.innerHTML.includes('下一期'));assert(!root.innerHTML.includes('tb-matrix-character'));assert(root.innerHTML.includes('每期固定可用 2 次'));assert(!root.innerHTML.includes('tb-default-limit'));assert(!root.innerHTML.includes('data-limit='));

await click('pick',{id:'1509'});assert.equal(builder.getState().draft.length,1);
await click('edit-team',{index:'0'});assert.equal(builder.getState().teams.length,1,'Editing must not overwrite a current draft');
await click('clear-draft');await click('edit-team',{index:'0'});assert.equal(builder.getState().teams.length,0);
assert.equal(builder.getState().draft.length,3);
await click('save');await click('import');nodes.get('#tb-import-text').value='{"schema":1,"teams":[{"characters":["1304","1105","9999"]}]}';
await click('confirm-import');assert.equal(builder.getState().teams.length,1);assert(nodes.get('#tb-import-error').textContent.includes('不存在'));
nodes.get('#tb-import-text').value=JSON.stringify({...builder.getState(),teams:[{name:'<script>unsafe</script>',characters:['1304','1105','1503']}]});
await click('confirm-import');assert(root.innerHTML.includes('&lt;script&gt;unsafe&lt;/script&gt;'));assert(!root.innerHTML.includes('<script>unsafe'));
await click('clear-teams');assert.equal(builder.getState().teams.length,1);await click('cancel-dialog');assert.equal(builder.getState().teams.length,1);
await click('clear-teams');await click('confirm-clear');assert.equal(builder.getState().teams.length,0);
const reopened=createTeamBuilder({profiles,img:()=>'',storage});reopened.mount(new Node());assert.deepEqual(reopened.getState(),builder.getState());
console.log('Team builder checks passed: 60 profiles, bidirectional recommendations, shared Rover quota, matrix budgets, ordering, persistence, safe import, links and UI events.');
