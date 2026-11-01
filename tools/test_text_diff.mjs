import assert from 'node:assert/strict';
import {textDiff} from '../web/assets/text-diff.js';
const check=(a,b)=>{const parts=textDiff(a,b);assert.equal(parts.filter(p=>p.type!=='add').map(p=>p.text).join(''),a);assert.equal(parts.filter(p=>p.type!=='remove').map(p=>p.text).join(''),b);return parts;};
for(const [a,b] of [['',''],['','新增'],['删除',''],['相同','相同'],['回复10点，持续5秒','回复20点，持续8秒'],['第一行\n删除段落\n末尾','第一行\n新增段落\n末尾'],['ATK increases by 10%.','ATK increases by 20%.'],['治疗🐱','治疗🐾'],['a'.repeat(2100),'b'.repeat(2100)]])check(a,b);
let seed=42;const random=()=>((seed=(seed*1664525+1013904223)>>>0)%10);for(let k=0;k<200;k++){const chars=['甲','乙','丙','1','2','%','\n',' ','a','猫'];check(Array.from({length:random()*4},()=>chars[random()]).join(''),Array.from({length:random()*4},()=>chars[random()]).join(''));}
console.log('Text diff passed: exact reconstruction, Chinese/English/numeric edits, multiline, Unicode, large input and randomized cases.');
