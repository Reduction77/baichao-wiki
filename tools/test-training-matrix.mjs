import assert from 'node:assert/strict';
import {linkTrainingAvailability,applyTraining,undoTraining,readTraining,restoreTrainingBackup,saveAvailableRoster,TRAINING_KEY,TRAINING_BACKUP} from '../web/assets/training-core.js';
import {defaultState,characterMap,unavailableReason,matchingTeams} from '../web/assets/team-builder-core.js';
const characters=[{id:'a',family:'a'},{id:'b',family:'b'},{id:'c',family:'c'},{id:'r1',family:'r'},{id:'r2',family:'r'}],profiles={characters,aliases:Object.fromEntries(characters.map(p=>[p.id,p.id]))},chars=characterMap(profiles);
const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
const row=id=>({id,selected:true,score:null,grade:null,chain:0,weaponRarity:4,refine:null});
// Every application rebuilds availability, even after manual All or an earlier linked import.
for(const matrix of [false,true])for(const mode of ['append','replace']){
 data.clear();let state={...defaultState(),matrix,excluded:['a','r']};
 state=applyTraining(storage,'builder',state,[row('a')],profiles,mode).builder;
 assert.deepEqual(state.excluded,['b','c','r']);assert.equal(readTraining(storage).rosterLinked,true);
 state.excluded=[];saveAvailableRoster(storage,'builder',state); // User selected All.
 state=applyTraining(storage,'builder',state,[row('c')],profiles,mode).builder;
 assert.deepEqual(state.excluded,['a','b','r']);assert.equal(unavailableReason(state,chars.get('a'),chars),'未设为可用角色');
 assert.equal(unavailableReason(state,chars.get('c'),chars),''); // A scoreless confirmed row remains available.
 assert.deepEqual(Object.keys(readTraining(storage).entries).sort(),mode==='append'?['a','c']:['c']);
 state=undoTraining(storage,'builder',state);assert.deepEqual(state.excluded,[]);assert.equal(readTraining(storage).rosterLinked,true);
 assert.deepEqual(linkTrainingAvailability(storage,'builder',state,profiles).builder.excluded,[]);
}
// Undo restores a partially disabled roster, preserving teams/draft.
data.clear();let state={...defaultState(),matrix:true,excluded:['b'],draft:['c'],teams:[{name:'saved',characters:['a','b','r1']}]};
state=applyTraining(storage,'builder',state,[row('a')],profiles,'append').builder;
state=undoTraining(storage,'builder',state);assert.deepEqual(state.excluded,['b']);assert.deepEqual(state.draft,['c']);assert.equal(state.teams.length,1);assert.equal(readTraining(storage),null);
// Repeated undo -> All -> import cycles cannot leave absent characters enabled.
data.clear();state={...defaultState(),matrix:true};
for(let i=0;i<3;i++){state=applyTraining(storage,'builder',state,[row('a')],profiles,'append').builder;assert.deepEqual(state.excluded,['b','c','r']);state=undoTraining(storage,'builder',state);assert.deepEqual(state.excluded,[]);assert.equal(readTraining(storage),null);}
// Legacy restored records must not trigger matrix migration after Undo.
const old={schema:1,entries:{b:row('b')}};storage.setItem(TRAINING_KEY,JSON.stringify(old));state.excluded=['a'];
state=applyTraining(storage,'builder',state,[row('a')],profiles,'append').builder;
state=undoTraining(storage,'builder',state);assert.deepEqual(state.excluded,['a']);assert.equal(readTraining(storage).rosterLinked,true);assert.deepEqual(linkTrainingAvailability(storage,'builder',state,profiles).builder.excluded,['a']);
// Manual editing remains possible after an import, until the next application resets the list.
state.excluded=['b'];saveAvailableRoster(storage,'builder',state);assert.equal(unavailableReason(state,chars.get('b'),chars),'未设为可用角色');
state=restoreTrainingBackup(storage,'builder',{schema:1,builder:state,training:readTraining(storage)},profiles);assert.deepEqual(state.excluded,['b']);
state=applyTraining(storage,'builder',state,[row('r1')],profiles,'append').builder;assert.deepEqual(state.excluded,['a','b','c']);assert.equal(unavailableReason(state,chars.get('r2'),chars),'');
state.draft=['a'];assert.equal(matchingTeams(state,profiles,{teams:[{characters:['a','b','c']}]}).length,0);
// A corrupt undo backup fails before changing the current roster or records.
storage.setItem(TRAINING_BACKUP,JSON.stringify({schema:1,excluded:[],training:'bad json'}));const before=new Map(data);assert.throws(()=>undoTraining(storage,'builder',state),/无法读取/);assert.deepEqual(data,before);
console.log('Every import resets roster; Undo restores the prior roster; manual editing, legacy records, Rover families and repeated reimport passed.');
