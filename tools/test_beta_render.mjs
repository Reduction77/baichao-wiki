// Synthetic beta fixtures stay in memory and are never deployed as game data.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const web=path.resolve(import.meta.dirname,'../web');const meta=JSON.parse(await fs.readFile(path.join(web,'data/index.json'),'utf8'));
const before=JSON.parse(await fs.readFile(path.join(web,'data',meta.snapshot,'character/1304.json'),'utf8')),after=structuredClone(before);after.skill_trees['1'].skill.level['1'].param[0][9]='99.99%';
const versions=['3.8.50','3.8.51'].map(gameVersion=>({gameVersion,channel:'beta',directory:`data/beta/${gameVersion}/`,characters:['1304'],index:{1304:{name:'测试用今汐'}}}));
class Element{constructor(){this.innerHTML='';this.textContent='';this.dataset={};this.classList={toggle(){},contains(){return false;}}}setAttribute(){}remove(){}}
const nodes=new Map(['main','#side-version','#detail-content'].map(k=>[k,new Element()])),events={},windowEvents={};
globalThis.document={querySelector:s=>nodes.get(s)||null,querySelectorAll:()=>[],addEventListener:(n,f)=>events[n]=f};globalThis.location={hash:'#beta/1304?version=3.8.51&from=3.8.50'};globalThis.window={addEventListener:(n,f)=>windowEvents[n]=f,scrollTo(){},scrollY:0};globalThis.localStorage={getItem:()=>null};
const fetched=[];globalThis.fetch=async uri=>{assert(!/^https?:/.test(uri));fetched.push(uri);if(uri==='data/beta/index.json')return {ok:true,json:async()=>({releasedGameVersion:'3.7.0',versions})};if(uri==='data/beta/3.8.50/character/1304.json')return {ok:true,json:async()=>before};if(uri==='data/beta/3.8.51/character/1304.json')return {ok:true,json:async()=>after};return {ok:true,json:async()=>JSON.parse(await fs.readFile(path.join(web,uri),'utf8'))};};
await import('../web/assets/app.js');assert(nodes.get('main').innerHTML.includes('99.99%'));assert(nodes.get('main').innerHTML.includes('66.47%'));assert(nodes.get('main').innerHTML.includes('版本资料 / 差异对比'));
events.change({target:{dataset:{diffControl:'skillLevel'},value:'1'}});assert(nodes.get('main').innerHTML.includes('当前筛选下没有差异'));
events.change({target:{dataset:{diffControl:'changedOnly'},checked:false}});assert(nodes.get('main').innerHTML.includes('旧 · 3.8.50'));
events.change({target:{dataset:{betaVersion:'to'},value:'3.8.50'}});assert(location.hash.includes('version=3.8.50'));await windowEvents.hashchange();assert(nodes.get('main').innerHTML.includes('当前筛选下没有差异')||nodes.get('main').innerHTML.includes('0 项差异'));
location.hash='#beta/1304?version=3.7.50';await windowEvents.hashchange();assert(nodes.get('main').innerHTML.includes('该版本资料不可用'));assert(!fetched.some(x=>x.includes('/3.7.50/')));
console.log('Beta UI checks passed: local snapshots, old/new selection, live difference controls and blocked released-series fetches.');
