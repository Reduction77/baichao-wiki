import {uiText} from './i18n-ui.js?v=20261023-i18n3';

const STORAGE='baichao-language';
let language='zh',game={},names={},editorial={},loading,expectedCommit='',changeHandler=()=>{};
let phraseValues={},phrasePattern,nameReplacements=[],singleNames=[];
const cache=new Map(),originalText=new WeakMap(),originalAttributes=new WeakMap();
let titleState,observer,scheduled=false;
const chinese=/[\u3400-\u9fff]/;
export const getLanguage=()=>language;
export const getLocale=()=>language==='en'?'en-US':'zh-CN';
export function gameText(value){return language==='en'?(game[value]||value):value;}
function replaceNames(text){for(const [from,to] of nameReplacements)text=text.split(from).join(to);for(const [from,to]of singleNames)text=text.replace(new RegExp(`(?<![\\u3400-\\u9fff])${from}(?![\\u3400-\\u9fff])`,'g'),to);return text;}
const patterns=[
 [/^(.+)技能等级$/,(_,name)=>`${gameText(name)} skill level`],
 [/^搜索(共鸣者|武器|声骸)$/,(_,kind)=>`Search ${uiText[kind]||gameText(kind)}`],
 [/ · 共 (\d+) 队 · /,(_,n)=>` · ${n} teams · `],
 [/^共 (\d+) 条 \/ (\d+) 条资料$/,(_,n,total)=>`${n} of ${total} entries`],
 [/^(\d+) 项差异 \/ (\d+) 项字段$/,(_,n,total)=>`${n} changes / ${total} fields`],
 [/^每期固定可用 2 次：(.+)。$/,(_,list)=>`Two uses every period: ${replaceNames(list)}.`],
 [/^本期额外可用 2 次：(.+)。其余角色各可用 1 次。$/,(_,list)=>`Two uses this period: ${replaceNames(list)}. All others have one use.`],
 [/^固定可用 2 次：(.+)；本期额外可用 2 次：(.+)。其余角色各 1 次。后续规则以当期实际内容为准。漂泊者不同属性共享次数，同队仅能选择一种形态。$/,(_,a,b)=>`Two uses every period: ${replaceNames(a)}. Bonus this period: ${replaceNames(b)}. All others have one use. Future rules follow the relevant period. Rover attributes share uses; one attribute per team.`],
 [/^矩阵模式 · 固定(\d+)名、本期额外(\d+)名角色各2次/,(_,a,b)=>`Matrix mode · ${a} permanent and ${b} bonus Resonators have two uses each`],
 [/^普通模式 · 每名角色只能用于一支暂存队伍/,()=> 'Normal mode · Each Resonator may be used by one saved team'],
 [/ · 已分配 (\d+) 个位置$/,(_,n)=>` · ${n} slots assigned`],
 [/^已收录完整配队 · (\d+) 条$/,(_,n)=>`Catalogued Teams · ${n}`],
 [/^(\d+) 位候选$/,(_,n)=>`${n} candidates`],
 [/(\d+) 个角色形态/g,(_,n)=>`${n} Resonator forms`],
 [/^选择第 (\d+) 位角色$/,(_,n)=>`Select Resonator ${n}`],
 [/队伍 (\d+)/g,(_,n)=>`Team ${n}`],
 [/^查看(.+)档案$/,(_,name)=>`View ${replaceNames(name)} profile`],
 [/^(已取消选择|已加入|未加入)(.+)$/,(_,action,name)=>`${{'已取消选择':'Deselected','已加入':'Added','未加入':'Could not add'}[action]} ${replaceNames(name)}`],
 [/^(加入|移除|选择|取消选择|编辑|删除)(.+)$/,(_,action,name)=>`${uiText[action]} ${replaceNames(name)}`],
 [/^(.+)(前移|后移)$/,(_,name,direction)=>`Move ${replaceNames(name)} ${direction==='前移'?'left':'right'}`],
 [/^搜索(.+)名称 \/ ID…$/,(_,kind)=>`Search ${uiText[kind]||kind} name / ID…`],
 [/^展示已收录版本的资料差异，内容以官方正式发布为准。当前正式服：(.+)。$/,(_,version)=>`Compare archived versions. Official releases determine the final content. Current live version: ${version}.`],
 [/^当前已收录正式服 (.+) 资料。$/,(_,version)=>`Live-version ${version} data is currently archived.`],
 [/^突破阶段 (\d+)$/,(_,stage)=>`Ascension ${stage}`],
 [/^(\d+) 阶段(.*)$/,(_,stage,suffix)=>`Ascension ${stage}${uiText[suffix]||suffix}`],
 [/^(\d+) 件套：?$/,(_,n)=>`${n}-piece set:`],
 [/^(\d+) 支$/,(_,n)=>`${n} teams`],
 [/名主 C、(\d+) 条组合。/,(_,n)=>` main DPS Resonators and ${n} combinations. `],
 [/^(\d+) 名主 C、(\d+) 条组合。/,(_,a,b)=>`${a} main DPS Resonators and ${b} combinations.`],
];

export function translateText(value){
 const text=String(value??'');if(language!=='en'||!chinese.test(text))return text;
 if(cache.has(text))return cache.get(text);
 const trimmed=text.trim();let result=uiText[trimmed]||game[trimmed]||editorial[trimmed]||trimmed;
 if(result===trimmed){
  for(const [pattern,replace] of patterns)result=result.replace(pattern,replace);
  // One longest-match pass preserves complete entity names, e.g. Rover attributes.
  if(phrasePattern)result=result.replace(phrasePattern,from=>phraseValues[from]);
 }
 result=replaceNames(result).replace(/(\d+(?:\.\d+)?)秒/g,'$1s').replace(/(\d+) 件套/g,'$1-piece set');
 result=text.slice(0,text.length-text.trimStart().length)+result+text.slice(text.trimEnd().length);
 cache.set(text,result);return result;
}

async function loadEnglish(){
 if(loading)return loading;
 loading=(async()=>{
  const response=await fetch('data/locales/en.game.json.gz',{cache:'no-cache'});
  if(!response.ok)throw Error('English data could not be loaded.');
  const payload=await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).json();
  if(payload.schema!==1||payload.source.commit!==expectedCommit)throw Error('English data does not match this game snapshot.');
  game=payload.texts;names=payload.names;editorial=payload.editorial||{};
  nameReplacements=Object.entries(names).filter(([name])=>name.length>1).sort((a,b)=>b[0].length-a[0].length);
  singleNames=Object.entries(names).filter(([name])=>name.length===1);
  phraseValues={...payload.inline,...names,...uiText,...editorial};
  const phrases=Object.keys(phraseValues).filter(from=>from.length>1).sort((a,b)=>b.length-a.length);
  phrasePattern=new RegExp(phrases.map(value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'g');
 })().catch(error=>{loading=null;throw error;});
 return loading;
}

export async function setLanguage(next,{persist=true,notify=true}={}){
 if(!['zh','en'].includes(next))throw Error('Unsupported language');
 if(next==='en')await loadEnglish();
 language=next;cache.clear();
 if(persist)try{globalThis.localStorage?.setItem(STORAGE,next);}catch{}
 if(globalThis.document?.documentElement)document.documentElement.lang=next==='en'?'en':'zh-CN';
 const select=globalThis.document?.querySelector?.('#site-language');if(select)select.value=next;
 if(notify)await changeHandler();
 localizeDOM();
}
export function onLanguageChange(handler){changeHandler=handler;}

// Keep the original node text so switching back restores exact Chinese wording.
// Translate text/accessible labels only; routes, values, IDs and editable fields are untouched.
export function localizeDOM(root=globalThis.document?.body){
 if(!root||!globalThis.document?.createTreeWalker)return;
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
 while((node=walker.nextNode())){
  if(node.parentElement?.closest('script,style,textarea,input,[data-original-text],[contenteditable="true"]'))continue;
  const saved=originalText.get(node),original=saved?.rendered===node.nodeValue?saved.original:node.nodeValue;
  const rendered=translateText(original);if(node.nodeValue!==rendered)node.nodeValue=rendered;
  originalText.set(node,{original,rendered});
 }
 for(const element of root.querySelectorAll('[aria-label],[title],[placeholder],[alt]')){
  if(element.closest('[data-original-text]'))continue;
  const state=originalAttributes.get(element)||{};
  for(const name of ['aria-label','title','placeholder','alt']){
   const current=element.getAttribute(name);if(current===null)continue;
   const saved=state[name],original=saved?.rendered===current?saved.original:current,rendered=translateText(original);
   if(current!==rendered)element.setAttribute(name,rendered);state[name]={original,rendered};
  }
  originalAttributes.set(element,state);
 }
 const original=titleState?.rendered===document.title?titleState.original:document.title,rendered=translateText(original);
 if(document.title!==rendered)document.title=rendered;titleState={original,rendered};
}

export async function initLanguage(commit){
 expectedCommit=commit;let saved='zh';try{saved=globalThis.localStorage?.getItem(STORAGE)==='en'?'en':'zh';}catch{}
 try{await setLanguage(saved,{persist:false,notify:false});}
 catch{await setLanguage('zh',{persist:false,notify:false});const status=globalThis.document?.querySelector?.('#language-status');if(status)status.textContent='英文资料暂时无法载入，请重试。';}
 const select=globalThis.document?.querySelector?.('#site-language');
 select?.addEventListener('change',async()=>{
  select.disabled=true;
  try{await setLanguage(select.value);const status=document.querySelector('#language-status');if(status)status.textContent='';}
  catch(error){select.value=language;const status=document.querySelector('#language-status');if(status)status.textContent=language==='en'?error.message:'英文资料暂时无法载入，请重试。';}
  finally{select.disabled=false;}
 });
 if(globalThis.MutationObserver&&globalThis.document?.body){
  observer=new MutationObserver(()=>{if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;localizeDOM();});});
  observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-label','title','placeholder','alt']});
 }
}
