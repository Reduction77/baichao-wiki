import assert from 'node:assert/strict';
import {rich,fill,plain,esc,paramsAt,rowValue,statOptions,filterEntries,safeVideo,formatStat} from '../web/assets/core.js';
assert.equal(fill('提升{0}，持续{1}',['20%','15秒']),'提升20%，持续15秒');
assert.equal(plain('<size=40><color=Title>普攻</color></size>\n造成{0}',['20%']),'普攻\n造成20%');
assert.equal(esc('<img onerror="x">'),'&lt;img onerror=&quot;x&quot;&gt;');
assert.deepEqual(paramsAt([['10%','20%'],['5','8']],2),['20%','8']);
assert.equal(rowValue({param:[['10%','20%'],['5','8']],format:'{0}+{1}'},2),'20%+8');
assert.deepEqual(statOptions({'0':{'20':1},'1':{'20':2}},20),[{stage:'0',value:1},{stage:'1',value:2}]);
const rows=[{id:'1',zh:'今汐',en:'Jinhsi',element:5,weapon:1,rank:5},{id:'2',zh:'散华',element:1,weapon:2,rank:4}];
assert.equal(filterEntries(rows,'JINH',{elements:'5',rarity:'5'})[0].zh,'今汐');
assert.equal(filterEntries(rows,'',{weapon:'2'})[0].zh,'散华');
assert.equal(filterEntries([{id:'e',group:[3],intensity:0}],'',{group:'3',intensity:'0'}).length,1);
assert.equal(safeVideo('javascript:alert(1)'),null);
assert.equal(safeVideo('https://bilibili.com.evil.test/a'),null);
assert.equal(safeVideo('https://www.bilibili.com/video/BV123'), 'https://www.bilibili.com/video/BV123');
console.log('Core checks passed: text safety, parameters, levels, filters, video URLs.');

assert.equal(formatStat({value:540,is_percent:true}), '5.40%');
assert.equal(formatStat({value:0.486,is_ratio:true}), '48.6%');
assert.equal(formatStat({value:2252.55}),2253);

assert.equal(rich('<color=Title>普攻</color><img src=x onerror=alert(1)>'), '<span class="game-title">普攻</span>');
assert.equal(rich('<color=Highlight>{0}</color>',['<script>alert(1)</script>']), '<span class="game-highlight">alert(1)</span>');
assert.equal(rich('x & y'), 'x &amp; y');
