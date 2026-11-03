import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {badgeNumber,trainingMissing,refreshTrainingReview,matchWeaponText,ctcWeapon,echoGrade,ECHO_GRADES} from '../web/assets/training-text.js';
import {normalizeTraining,applyTraining,undoTraining,TRAINING_KEY} from '../web/assets/training-core.js';
const weapons=JSON.parse(readFileSync(new URL('../web/data/training-catalog.json',import.meta.url))).weapons;
assert.equal(badgeNumber('六链','chain'),6);assert.equal(badgeNumber('零链','chain'),0);
for(let i=1;i<=5;i++)assert.equal(badgeNumber(i+'阶','rank'),i);
assert.equal(badgeNumber('五階','rank'),5);assert.equal(badgeNumber('18','rank'),null);
assert.equal(matchWeaponText('千古洑流',weapons).name,'千古洑流');
assert.equal(matchWeaponText('玉阔玄华',weapons,.8).name,'玉阙玄华');
assert.equal(matchWeaponText('???',weapons),null);
const row={id:'1102',score:176.14,grade:'S',chain:6,weaponRarity:5,refine:1,review:true,selected:true};
assert.deepEqual(trainingMissing(row),[]);assert.equal(refreshTrainingReview(row).review,false);
assert.deepEqual(trainingMissing({...row,chain:null}),['共鸣链']);
for(const rarity of [0,1,2,3,4])assert.deepEqual(trainingMissing({...row,weaponRarity:rarity,refine:null}),[]);
assert.deepEqual(trainingMissing({...row,weaponRarity:5,refine:null}),['武器阶数']);
assert.deepEqual(trainingMissing({...row,weaponRarity:null,refine:null}),['武器']);
assert.deepEqual(trainingMissing({...row,score:''}),['评分']);
const profiles={characters:[{id:'1102',family:'1102'}]};
for(const rarity of [0,1,2,3,4])assert.equal(normalizeTraining([{...row,weaponRarity:rarity,refine:5}],profiles)[0].refine,null);
const entries=new Map(),storage={getItem:k=>entries.get(k)??null,setItem:(k,v)=>entries.set(k,v),removeItem:k=>entries.delete(k)};
const state={excluded:['1102'],draft:[],teams:[]};
const next=applyTraining(storage,'preview',state,[{...row,weaponId:'21010026',weaponName:'苍鳞千嶂'}],profiles,'append');
assert.equal(JSON.parse(storage.getItem(TRAINING_KEY)).entries['1102'].weaponName,'苍鳞千嶂');
assert.equal(JSON.parse(storage.getItem(TRAINING_KEY)).entries['1102'].grade,'S');
assert.deepEqual(undoTraining(storage,'preview',next.builder).excluded,[]);
assert.equal(storage.getItem(TRAINING_KEY),null);
console.log('Text parsing, catalog correction, missing-only grouping, low-star save and undo passed.');
// Constrained CTC must prefer the observed word and reject confident out-of-catalog text.
const keys=['blank','玉','阙','千','古','未','知'];
function probabilities(sequence){const steps=sequence.length,data=new Float32Array(steps*keys.length).fill(.0001);for(let t=0;t<steps;t++)data[t*keys.length+keys.indexOf(sequence[t])]=.999;return data;}
const vocabulary=[{id:'1',name:'玉阙'},{id:'2',name:'千古'}];
const observed=['blank','玉','blank','阙','blank'];
assert.equal(ctcWeapon(probabilities(observed),observed.length,keys.length,keys,vocabulary).weapon.id,'1');
const unknown=['blank','未','blank','知','blank'];
assert.equal(ctcWeapon(probabilities(unknown),unknown.length,keys.length,keys,vocabulary).weapon,null);
console.log('CTC lexicon positive and unknown-word rejection passed.');

for(const grade of ECHO_GRADES){assert.equal(echoGrade(grade),grade);assert.equal(normalizeTraining([{...row,grade}],profiles)[0].grade,grade);}
assert.equal(echoGrade('SSSS'),null);assert.equal(echoGrade('s'), 'S');
assert.deepEqual(trainingMissing({...row,grade:null}),['声骸评级']);
assert.equal(normalizeTraining([{...row,grade:undefined}],profiles)[0].grade,null); // old backup
const gradeKeys=['blank','S','A','B','C'];
function gradeProb(seq){const d=new Float32Array(seq.length*gradeKeys.length).fill(.0001);seq.forEach((c,i)=>d[i*gradeKeys.length+gradeKeys.indexOf(c)]=.999);return d;}
for(const grade of ECHO_GRADES){const sequence=['blank',...grade.split('').flatMap(c=>[c,'blank'])];assert.equal(ctcWeapon(gradeProb(sequence),sequence.length,gradeKeys.length,gradeKeys,ECHO_GRADES.map(name=>({name,id:name})),{single:true,caseSensitive:true}).weapon.id,grade);}
console.log('Six literal Echo grades, repeated S decoding and legacy backup compatibility passed.');
