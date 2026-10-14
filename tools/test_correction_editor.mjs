import assert from 'node:assert/strict';
import {fields,upstreamData,parseValue,validateDocument,mergeDraft,allowed,fieldLabel} from '../web/assets/correction-editor.js';
const r={id:'fix-test',enabled:true,category:'character',entryId:'1304',path:'/desc',expected:'原说明',value:'修正说明',reason:'核实',gameVersion:'3.7.0',resourceVersion:'3.7.8'};
const d={name:'今汐',desc:'修正说明',provenance:{scope:'不能改'},manual_corrections:[r]};
assert.equal(upstreamData(d).desc,'原说明');assert.equal(d.desc,'修正说明');assert.deepEqual(fields('character',d).map(x=>x.path),['/name','/desc']);
assert.equal(parseValue('420',412.5),420);assert.equal(parseValue('',null),null);assert.throws(()=>parseValue('NaN',1));assert.throws(()=>parseValue('',1));assert(!allowed('character','/__proto__/name'));assert(!allowed('character','/id'));
const doc={schema:1,corrections:[r]};assert.equal(validateDocument(doc),doc);assert.equal(mergeDraft(doc,{schema:1,corrections:[{...r,value:'新修正'}]}).corrections.length,1);assert.equal(mergeDraft(doc,{schema:1,corrections:[{...r,value:'新修正'}]}).corrections[0].value,'新修正');assert.throws(()=>validateDocument({schema:1,corrections:[{...r,value:{}}]}));assert.equal(fieldLabel('character',d,'/desc'),'详细说明');
console.log('Editor checks passed: original value recovery, editable fields, typed values, draft merge and input validation.');
