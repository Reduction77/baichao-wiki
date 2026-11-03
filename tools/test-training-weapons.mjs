import assert from 'node:assert/strict';
import {weaponRankFromBadge} from '../web/assets/training-weapon.js';
import {normalizeTraining,applyTraining,undoTraining,TRAINING_KEY} from '../web/assets/training-core.js';
const patch=(color,n=40)=>Array.from({length:n},()=>[...color,255]).flat();
// Badge colors measured independently from the supplied 1–5 rank swatches.
const badges=[[46,62,79],[32,121,103],[59,124,177],[90,58,113],[110,84,31]].map(c=>patch(c));
const gold=[patch([110,83,45])],purple=[patch([83,47,113])],neutral=[patch([60,60,60])];
for(let rank=1;rank<=5;rank++){
 assert.equal(weaponRankFromBadge(badges[rank-1]),rank);
}
assert.equal(weaponRankFromBadge(patch([120,120,120])),null);
assert.equal(weaponRankFromBadge(patch([70,105,148])),null); // Blue between ranks 1 and 3.
assert.equal(weaponRankFromBadge([...badges[1],...badges[4]]),null);
const profiles={characters:[{id:'1102',family:'1102'},{id:'1103',family:'1103'}]};
const row={id:'1102',score:176.14,chain:6,weaponRarity:5,refine:2,selected:true};
assert.equal(normalizeTraining([row],profiles)[0].refine,2);
assert.equal(normalizeTraining([{...row,weaponRarity:4,refine:5}],profiles)[0].refine,null);
assert.throws(()=>normalizeTraining([{...row,refine:6}],profiles));
assert.equal(normalizeTraining([{...row,weaponRarity:3}],profiles)[0].refine,null);
assert.equal(normalizeTraining([{...row,weaponRarity:undefined}],profiles)[0].refine,2); // Old backup compatibility.
const mem=new Map(),storage={getItem:k=>mem.get(k)??null,setItem:(k,v)=>mem.set(k,v),removeItem:k=>mem.delete(k)};
const state={excluded:['1102'],teams:[['1103']],draft:['1102']};
const next=applyTraining(storage,'preview',state,[row],profiles,'append');
assert.equal(JSON.parse(storage.getItem(TRAINING_KEY)).entries['1102'].refine,2);
assert.deepEqual(next.builder.teams,state.teams);
const later={...next.builder,draft:['1103']};
assert.deepEqual(undoTraining(storage,'preview',later).draft,['1103']);
assert.equal(storage.getItem(TRAINING_KEY),null);
assert.equal(storage.getItem('baichao-team-builder-v1'),null);
console.log('Weapon rank/rarity gate, review boundaries, save and undo tests passed.');
