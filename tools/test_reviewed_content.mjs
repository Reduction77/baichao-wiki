import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';
const web=path.resolve(import.meta.dirname,'../web'),events={},win={};
class Element{constructor(){this.innerHTML='';this.textContent='';this.value='';this.classList={toggle(){},contains(){return false;}};}setAttribute(){}}
const nodes=new Map(['main','#results','#result-count','#sort','#group','#side-version','#detail-content'].map(k=>[k,new Element()]));
globalThis.document={querySelector:s=>nodes.get(s)||null,querySelectorAll:()=>[],addEventListener:(n,f)=>events[n]=f};globalThis.localStorage={getItem:()=>null};globalThis.location={hash:'#home'};globalThis.window={addEventListener:(n,f)=>win[n]=f,scrollTo(){},scrollY:0};
globalThis.fetch=async uri=>{assert(!/^https?:/.test(uri),'All runtime data stays local');return {ok:true,json:async()=>JSON.parse(await fs.readFile(path.join(web,uri),'utf8'))};};
await import('../web/assets/app.js');
assert(nodes.get('main').innerHTML.indexOf('莉莉')<nodes.get('main').innerHTML.indexOf('锁暝'));
async function open(route){location.hash=route;await win.hashchange();const html=nodes.get('main').innerHTML;assert(!html.includes('暂时无法打开资料'),route);return html;}
let html=await open('#beta');for(const href of ['#beta/1512?version=3.8.1','#beta-weapon/21030076?version=3.8.1'])assert(html.includes(href),href);
html=await open('#beta/1512?version=3.8.1');assert(html.includes('莉莉'));assert(html.includes('熏香绽放'));assert(html.includes('版本资料 3.8.1'));assert(!html.includes('夏空'));
events.click({target:{closest:()=>({dataset:{tab:'materials'},hasAttribute:()=>false})}});assert(nodes.get('main').innerHTML.includes('绮梦百合'));assert(nodes.get('main').innerHTML.includes('技能材料合计'));
html=await open('#beta-weapon/21030076?version=3.8.1');assert(html.includes('安魂'));assert(html.includes('待完善'));assert(!html.includes('{7}'));assert(!html.includes('蜃影'));
events.change({target:{dataset:{control:'refine'},value:'5'}});assert(!nodes.get('#detail-content').innerHTML.includes('{7}'));assert(nodes.get('#detail-content').innerHTML.includes('24%'));
html=await open('#beta');assert(!html.includes('#beta/1312'));assert(!html.includes('#beta-weapon/21020107'));
html=await open('#character/1312');assert(html.includes('下落攻击耐力消耗'));assert(!html.includes('#beta/1312'));
html=await open('#weapon/21020107');assert(html.includes('未拥有并获得同奏'));assert(html.includes('100点'));assert(!html.includes('#beta-weapon/21020107'));
html=await open('#character/1508');assert(html.includes('17.45%*8'));events.change({target:{dataset:{control:'skillLevel'},value:'1'}});assert(nodes.get('main').innerHTML.includes('8.78%*8'));
console.log('Reviewed content passed: new-version ordering and routes, Lily materials, pending Lullaby parameter, five refinements, merged weapon effects and stamina and all-level additions.');
