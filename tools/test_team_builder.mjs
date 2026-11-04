import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {configureMatrixRules,matrixPermanent,matrixCurrent,defaultState,parseState,characterMap,uses,limitFor,unavailableReason,budgetConflicts,selectCharacter,saveTeam,recommend,matchingTeams} from '../web/assets/team-builder-core.js';
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
assert.equal(matrixPermanent.length,6);assert(!matrixPermanent.includes('1106'));assert.deepEqual(matrixCurrent,['1509']);
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

globalThis.document={activeElement:null};
class Node{constructor(){this.innerHTML='';this.textContent='';this.value='';this.handlers={};this.dataset={};}addEventListener(n,f){this.handlers[n]=f;}removeEventListener(n){delete this.handlers[n];}focus(){document.activeElement=this;}showModal(){this.open=true;}querySelector(selector){const match=selector.match(/^\[data-tb="([^"]+)"\]$/);if(match){if(!nodes.has(selector)){const node=new Node();node.dataset.tb=match[1];nodes.set(selector,node);}return nodes.get(selector);}return nodes.get(selector)||null;}querySelectorAll(selector){return selector==='[data-tb]'?[...nodes.values()].filter(n=>n.dataset.tb):[];}}
const root=new Node(),nodes=new Map(['#tb-message','#tb-roster-list','#tb-import-text','#tb-import-error','#tb-role','.tb-dialog'].map(k=>[k,new Node()]));
const local=new Map();const storage={getItem:k=>local.get(k),setItem:(k,v)=>local.set(k,v)};
const builder=createTeamBuilder({profiles,teams:records,recommendations:config,img:()=>'<img src="assets/test.webp" alt="">',storage});
builder.mount(root);
const click=async(tb,extra={})=>root.handlers.click({target:{closest:()=>({dataset:{tb,...extra}})}});
const roleFilter=nodes.get('#tb-role');roleFilter.value='main';roleFilter.focus();root.handlers.change({target:roleFilter});assert.equal(document.activeElement,roleFilter,'Filter redraw must preserve focus');roleFilter.value='';root.handlers.change({target:roleFilter});
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
await click('save');await click('import');assert.equal(nodes.get('.tb-dialog').open,true,'Import must use a modal dialog');nodes.get('#tb-import-text').value='{"schema":1,"teams":[{"characters":["1304","1105","9999"]}]}';
await click('confirm-import');assert.equal(builder.getState().teams.length,1);assert(nodes.get('#tb-import-error').textContent.includes('不存在'));
nodes.get('#tb-import-text').value=JSON.stringify({...builder.getState(),teams:[{name:'<script>unsafe</script>',characters:['1304','1105','1503']}]});
await click('confirm-import');assert(root.innerHTML.includes('&lt;script&gt;unsafe&lt;/script&gt;'));assert(!root.innerHTML.includes('<script>unsafe'));
await click('clear-teams');assert.equal(builder.getState().teams.length,1);await click('cancel-dialog');assert.equal(builder.getState().teams.length,1);assert.equal(document.activeElement.dataset.tb,'clear-teams','Closing a dialog must return focus to its trigger');
await click('clear-teams');await click('confirm-clear');assert.equal(builder.getState().teams.length,0);
const reopened=createTeamBuilder({profiles,img:()=>'',storage});reopened.mount(new Node());assert.deepEqual(reopened.getState(),builder.getState());
console.log('Team builder checks passed: 60 profiles, bidirectional recommendations, shared Rover quota, matrix budgets, ordering, persistence, safe import, links and UI events.');

const editableRoot=new Node(),editableStorage=new Map(),editable=createTeamBuilder({profiles,img:()=>'',storage:{getItem:k=>editableStorage.get(k),setItem:(k,v)=>editableStorage.set(k,v)}});editable.mount(editableRoot);
const editClick=async(tb,extra={})=>editableRoot.handlers.click({target:{closest:()=>({dataset:{tb,...extra}})}});
for(const team of [['1304','1105','1503'],['1509','1107','1307'],['1311','1309','1110']]){for(const id of team)await editClick('pick',{id});await editClick('save');}
const beforeEdit=editable.getState().teams;assert.deepEqual(beforeEdit.map(t=>t.name),['队伍 1','队伍 2','队伍 3']);assert.equal(new Set(beforeEdit.map(t=>t.id)).size,3);
await editClick('edit-team',{index:'0'});await editClick('save');const afterEdit=editable.getState().teams;assert.deepEqual(afterEdit,beforeEdit,'Editing must preserve IDs, names and positions');
await editClick('delete-team',{index:'1'});assert.equal(editable.getState().teams.length,2);assert(editableRoot.innerHTML.includes('撤销删除'));
await editClick('undo-delete');assert.deepEqual(editable.getState().teams,beforeEdit,'Undo must restore the deleted team at its original position');
await editClick('edit-team',{index:'0'});await editClick('clear-draft');assert.deepEqual(editable.getState().teams,beforeEdit,'Clearing an edited draft must not discard the original team');
console.log('Stable team IDs, in-place editing and ten-second delete undo passed.');

const configured=JSON.parse(await fs.readFile(new URL('data/matrix-rules.json',web)));
configureMatrixRules(configured,profiles);
assert.equal(limitFor({...defaultState(),matrix:true},chars.get('1106')),1);
configureMatrixRules({schema:1,permanent:['1503'],current:['1304']},profiles);
assert.equal(limitFor({...defaultState(),matrix:true},chars.get('1304')),2);
assert.equal(limitFor({...defaultState(),matrix:true},chars.get('1509')),1);
assert.throws(()=>configureMatrixRules({schema:1,permanent:['1503'],current:['1503']},profiles));
assert.throws(()=>configureMatrixRules({schema:1,permanent:[],current:['99999']},profiles));
configureMatrixRules(configured,profiles);
console.log('Published matrix JSON configuration and validation passed.');

// The published training UI must reuse the established Wiki storage key.
const previous=builder.getState();
previous.excluded=['1304'];
local.set('baichao-team-builder-v1',JSON.stringify(previous));
local.set('baichao-team-builder-training-preview-v1',JSON.stringify(defaultState()));
const integrated=createTeamBuilder({profiles,img:()=>'',storage,trainingImport:true});
const integratedRoot=new Node();integrated.mount(integratedRoot);
assert.deepEqual(integrated.getState(),previous);
assert(integratedRoot.innerHTML.includes('导入练度图'));
assert(!integratedRoot.innerHTML.includes('独立副本'));
await integratedRoot.handlers.click({target:{closest:()=>({dataset:{tb:'matrix'}})}});
assert.deepEqual(JSON.parse(local.get('baichao-team-builder-v1')),integrated.getState());
assert.deepEqual(JSON.parse(local.get('baichao-team-builder-training-preview-v1')),defaultState());
console.log('Production training UI preserves and updates the existing Wiki storage without switching to preview storage.');
const builderCss=await fs.readFile(new URL('assets/team-builder.css',web),'utf8');assert(/@media\(max-width:850px\)\{[^}]*\.tb-layout\{display:flex;flex-direction:column/.test(builderCss));assert(/\.tb-workspace>\.tb-current\{order:1\}/.test(builderCss));assert(/\.tb-roster\{order:2\}/.test(builderCss));
console.log('Mobile layout keeps the current team before the character roster.');
