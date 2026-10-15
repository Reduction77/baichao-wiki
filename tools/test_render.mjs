// Data and render smoke check in Node; does not replace a real browser layout test.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const web=process.env.WIKI_TEST_DATA_DIR||path.resolve(import.meta.dirname,'../web');
class Element {constructor(){this.innerHTML='';this.textContent='';this.value='';this.dataset={};this.classList={toggle(){},contains(){return false;}};}setAttribute(){} remove(){} addEventListener(){} removeEventListener(){} querySelector(s){return nodes.get(s)||null;} }
const nodes=new Map(['main','#results','#result-count','#sort','#group','#side-version','#detail-content','#team-builder-root','#tb-roster-list','#tb-message'].map(k=>[k,new Element()]));
const events={},winEvents={};
globalThis.document={querySelector:s=>nodes.get(s)||null,querySelectorAll:()=>[],addEventListener:(n,f)=>events[n]=f,createElement:()=>new Element(),body:{append(){}}};
globalThis.location={hash:'#home'};
globalThis.history={replaceState:(_a,_b,url)=>location.hash=url};
globalThis.window={addEventListener:(n,f)=>winEvents[n]=f,scrollY:0,scrollTo(){}};
const storage=new Map();globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
globalThis.fetch=async uri=>{assert(!/^https?:/.test(uri),'Site must use local data');try{return {ok:true,status:200,json:async()=>JSON.parse(await fs.readFile(path.join(web,uri),'utf8'))};}catch{return {ok:false,status:404};}};
await import('../web/assets/app.js');
const meta=JSON.parse(await fs.readFile(path.join(web,'data/index.json'),'utf8'));
assert(nodes.get('main').innerHTML.includes('探索每一段旅程'));
let count=0;
for(const kind of ['character','weapon','echo']){
 location.hash='#'+kind;await winEvents.hashchange();assert(nodes.get('#result-count').textContent.includes(String(meta.counts[kind])));
 const list=JSON.parse(await fs.readFile(path.join(web,'data',meta.snapshot,kind+'.json'),'utf8'));
 for(const [id,entry] of Object.entries(list)){
  location.hash='#'+kind+'/'+id;await winEvents.hashchange();
  const html=nodes.get('main').innerHTML;
  assert(!html.includes('暂时无法打开资料'),kind+'/'+id+' failed');
  assert(html.includes(kind==='character'?'pilot-top':'detail-hero'),kind+'/'+id+' hero missing');
  count++;
 }
}
location.hash='#character/1304';await winEvents.hashchange();
events.change({target:{dataset:{control:'skillLevel'},value:'1'}});
assert(nodes.get('main').innerHTML.includes('33.43%'));
events.change({target:{dataset:{control:'skillLevel'},value:'10'}});
assert(nodes.get('main').innerHTML.includes('66.47%'));
events.click({target:{closest:()=>({dataset:{tab:'overview'},hasAttribute:()=>false})}});
events.change({target:{dataset:{control:'charLevel'},value:'20'}});
assert(nodes.get('main').innerHTML.includes('2,830')||nodes.get('main').innerHTML.includes('2830'));
events.change({target:{dataset:{control:'stage'},value:'0'}});
assert(nodes.get('main').innerHTML.includes('2253'));
events.click({target:{closest:()=>({dataset:{fav:'character:1304'}})}});
assert(JSON.parse(storage.get('baichao-favorites')).includes('character:1304'));
location.hash='#character';await winEvents.hashchange();
events.input({target:{id:'search',value:'今汐'}});
assert(nodes.get('#result-count').textContent.startsWith('共 1 条'));
for(const route of ['teams','favorites','about','beta']){location.hash='#'+route;await winEvents.hashchange();assert(!nodes.get('main').innerHTML.includes('暂时无法打开资料'));}
console.log(`Render checks passed: ${count} detail records, local fetches, skill levels, ascension stages, favorites, search, auxiliary pages.`);

location.hash='#lab';await winEvents.hashchange();
assert(nodes.get('main').innerHTML.includes(meta.provenance?'全站 GitHub 数据来源':'110 / 111'));
if(meta.provenance){const status=JSON.parse(await fs.readFile(path.join(web,'data/source-status.json'),'utf8').catch(()=>'{"current":{}}'));if(status.current?.commit===meta.provenance.commit)assert(nodes.get('main').innerHTML.includes(status.updateAvailable?'发现新的正式服资源':'已是最近核对的正式服版本'));}
location.hash='#character/1304?source=github';await winEvents.hashchange();
assert(nodes.get('main').innerHTML.includes('GITHUB 原始配置'));
assert(!nodes.get('main').innerHTML.includes('存在异常，如有疑问请联系官方客服'));
assert(nodes.get('main').innerHTML.includes('同奏持续时间'));
assert(nodes.get('main').innerHTML.includes('66.47%'));
events.change({target:{dataset:{skillLevel:'1'},value:'1',hasAttribute:()=>false}});
assert(nodes.get('main').innerHTML.includes('33.43%'));
events.change({target:{dataset:{control:'skillLevel'},value:'10',hasAttribute:()=>false}});
assert(nodes.get('main').innerHTML.includes('66.47%'));
events.change({target:{dataset:{},checked:true,hasAttribute:k=>k==='data-simple'}});
assert(!nodes.get('main').innerHTML.includes('进行最多4段的连续攻击'));
events.change({target:{dataset:{control:'charLevel'},value:'20',hasAttribute:()=>false}});
assert(nodes.get('main').innerHTML.includes('2830'));
events.change({target:{dataset:{control:'stage'},value:'0',hasAttribute:()=>false}});
assert(nodes.get('main').innerHTML.includes('2253'));
events.click({target:{closest:()=>({dataset:{tab:'materials'},hasAttribute:()=>false})}});
assert(nodes.get('main').innerHTML.includes('龙吐珠'));
assert(nodes.get('main').innerHTML.includes('2,030,000'));
assert(nodes.get('main').innerHTML.includes('技能材料合计'));
events.click({target:{closest:()=>({dataset:{tab:'chains'},hasAttribute:()=>false})}});
assert(nodes.get('main').innerHTML.includes('共鸣链 6'));
console.log('GitHub pilot checks passed: local data, source routing, independent skill levels, simple text, ascension stages, materials and chains.');

location.hash='#beta';await winEvents.hashchange();assert(nodes.get('main').innerHTML.includes('当前没有可展示的测试服快照'));
location.hash='#beta/1304?version=3.7.50';await winEvents.hashchange();assert(nodes.get('main').innerHTML.includes('没有可用的未发布测试版本'));
location.hash='#character/1506';await winEvents.hashchange();assert(nodes.get('main').innerHTML.includes('菲比'));assert(nodes.get('main').innerHTML.includes('衍射'));assert(!nodes.get('main').innerHTML.includes('JINHSI'));
console.log('All-character layout and released-version beta exclusion checks passed.');

location.hash='#character/1304';await winEvents.hashchange();
assert(nodes.get('main').innerHTML.includes('#team-builder?character=1304'));
location.hash='#teams';await winEvents.hashchange();
assert(nodes.get('main').innerHTML.includes('打开配队工作台'));
location.hash='#team-builder?character=1304';await winEvents.hashchange();
assert(nodes.get('main').innerHTML.includes('配队工作台'));
assert(nodes.get('#team-builder-root').innerHTML.includes('折枝的共鸣技能伤害加深匹配今汐'));
assert(nodes.get('#team-builder-root').innerHTML.includes('href="#character/1304"'));
assert.equal(location.hash,'#team-builder');
location.hash='#character/1105';await winEvents.hashchange();
assert(nodes.get('main').innerHTML.includes('pilot-top'));
location.hash='#team-builder';await winEvents.hashchange();
assert(nodes.get('#team-builder-root').innerHTML.includes('三人编队已就绪')===false);
assert(nodes.get('#team-builder-root').innerHTML.includes('1/3'));
console.log('Team builder routing passed: navigation, preselection, profile links and return-state preservation.');
