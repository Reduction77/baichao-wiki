// Recommendations are explainable tag matches, not a damage or tier-list model.
import {elements} from './core.js';
export const roleNames={main:'主力输出',support:'协奏增益',sustain:'生存治疗'};
export const defaultState=()=>({schema:1,matrix:false,defaultLimit:2,limits:{},excluded:[],draft:[],teams:[]});
export function characterMap(profiles){return new Map(profiles.characters.map(p=>[p.id,p]));}
export function canonicalId(value,profiles){return profiles.aliases?.[String(value)]||null;}
export function uses(state,characters){const counts={};for(const t of state.teams)for(const id of t.characters){const family=characters.get(id)?.family;if(family)counts[family]=(counts[family]||0)+1;}return counts;}
export function limitFor(state,p){return state.matrix?(state.limits[p.family]??state.defaultLimit):1;}
export function unavailableReason(state,p,characters){
 if(state.excluded.includes(p.family))return '未设为可用角色';
 if(state.draft.some(id=>characters.get(id)?.family===p.family))return '已在当前编队中';
 if((uses(state,characters)[p.family]||0)>=limitFor(state,p))return '本轮使用次数已用完';
 if(state.draft.length>=3)return '当前编队已满';
 return '';
}
export function budgetConflicts(state,characters){const count=uses(state,characters),seen=new Set();return [...characters.values()].filter(p=>{if(seen.has(p.family))return false;seen.add(p.family);return (count[p.family]||0)>limitFor(state,p);});}
export function selectCharacter(state,id,characters){const p=characters.get(id);if(!p)return '角色不存在';const why=unavailableReason(state,p,characters);if(why)return why;state.draft.push(id);return '';}
export function saveTeam(state,characters){
 if(state.draft.length!==3)return '请选择三名角色后再暂存';
 const count=uses(state,characters),families=new Set();
 for(const id of state.draft){const p=characters.get(id);if(!p||families.has(p.family))return '同一角色及漂泊者的不同形态不能在同队重复';families.add(p.family);if(state.excluded.includes(p.family)||(count[p.family]||0)>=limitFor(state,p))return '当前编队超出可用次数，请调整';}
 state.teams.push({name:`队伍 ${state.teams.length+1}`,characters:[...state.draft]});state.draft=[];return '';
}
export function parseState(raw,profiles){
 if(!raw||typeof raw!=='object'||raw.schema!==1||!Array.isArray(raw.teams)||raw.teams.length>100)throw Error('不是有效的白潮配队文件，最多导入 100 支队伍');
 const characters=characterMap(profiles),state=defaultState();
 state.matrix=raw.matrix===true;
 const validLimit=n=>Number.isInteger(n)&&n>=1&&n<=9;
 if(raw.defaultLimit!==undefined&&!validLimit(raw.defaultLimit))throw Error('使用次数必须为 1 到 9');
 state.defaultLimit=raw.defaultLimit??2;
 const families=new Set([...characters.values()].map(p=>p.family));
 if(raw.limits!==undefined&&(!raw.limits||typeof raw.limits!=='object'||Array.isArray(raw.limits)))throw Error('角色次数设置格式不正确');
 for(const [key,n] of Object.entries(raw.limits||{})){if(!families.has(key)||!validLimit(n))throw Error('存在无效的角色次数设置');state.limits[key]=n;}
 if(raw.excluded!==undefined&&(!Array.isArray(raw.excluded)||raw.excluded.some(key=>!families.has(key))))throw Error('可用角色设置格式不正确');
 state.excluded=[...new Set(raw.excluded||[])];
 function ids(input,max){if(!Array.isArray(input)||input.length>max)throw Error('队伍角色数量不正确');const ids=input.map(v=>canonicalId(v,profiles));if(ids.some(v=>!v))throw Error('文件包含当前资料库中不存在的角色');const fs=ids.map(id=>characters.get(id).family);if(new Set(fs).size!==ids.length)throw Error('同队存在重复角色或漂泊者形态');return ids;}
 state.teams=raw.teams.map((t,i)=>{if(!t||typeof t!=='object')throw Error('队伍格式不正确');const characters=ids(t.characters,3);if(characters.length!==3)throw Error('暂存队伍必须有三名角色');return {name:typeof t.name==='string'?t.name.slice(0,60):`队伍 ${i+1}`,characters};});
 state.draft=ids(raw.draft||[],3);
 // Exceeding budgets after a mode/config change is retained and visibly flagged.
 return state;
}
const systems=['霜渐','风蚀','光噪','电磁','聚爆','虚湮','同奏','震谐响应','集谐响应','骇破响应'];
function provides(provider,receiver){
 const reasons=[];let score=0;
 const targetTags=new Set(receiver.tags);targetTags.add((elements[receiver.element]||'')+'伤害');
 for(const tag of provider.tags){
  if(!tag.endsWith('伤害加深'))continue;
  const target=tag.slice(0,-2);
  if(tag==='伤害加深'&&receiver.roles.includes('main')){reasons.push(`${provider.name}提供通用伤害加深`);score+=12;}
  else if(targetTags.has(target)||(tag==='协同攻击伤害加深'&&targetTags.has('协同攻击'))){reasons.push(`${provider.name}的${tag}匹配${receiver.name}`);score+=32;}
 }
 return {score,reasons};
}
export function pairAffinity(a,b,teamRecords=[]){
 if(a.family===b.family)return {score:0,reasons:[]};
 let score=0;const reasons=[];
 const ab=provides(a,b),ba=provides(b,a);score+=ab.score+ba.score;reasons.push(...ab.reasons,...ba.reasons);
 const common=systems.filter(t=>a.tags.includes(t)&&b.tags.includes(t));
 if(common.length){score+=40+common.length*5;reasons.push(`同属${common.join(' / ')}体系，需核对模态与触发条件`);}
 if((a.roles.includes('main')&&b.primary==='sustain')||(b.roles.includes('main')&&a.primary==='sustain')){score+=14;reasons.push(`${a.primary==='sustain'?a.name:b.name}补充生存治疗`);}
 const aIds=new Set(a.aliases.map(String)),bIds=new Set(b.aliases.map(String));
 if(teamRecords.some(t=>t.characters?.some(id=>aIds.has(String(id)))&&t.characters?.some(id=>bIds.has(String(id))))){score+=35;reasons.push('站内已有同队视频记录，配置要求以原视频为准');}
 return {score,reasons:[...new Set(reasons)]};
}
export function recommend(state,profiles,teamRecords=[]){
 const chars=characterMap(profiles),selected=state.draft.map(id=>chars.get(id)).filter(Boolean);
 if(!selected.length||selected.length===3)return [];
 const hasMain=selected.some(p=>p.roles.includes('main')),hasSustain=selected.some(p=>p.primary==='sustain');
 return profiles.characters.filter(p=>!unavailableReason(state,p,chars)).map(p=>{
  const pairs=selected.map(x=>pairAffinity(x,p,teamRecords));let score=pairs.reduce((sum,x)=>sum+x.score,0);const reasons=[...new Set(pairs.flatMap(x=>x.reasons))];
  if(!hasMain&&p.roles.includes('main')){score+=18;reasons.push('补充主力输出位置');}
  if(hasMain&&!hasSustain&&p.primary==='sustain'){score+=8;}
  if(hasMain&&hasSustain&&p.primary==='sustain')score-=30;
  if(selected.length===2&&!hasMain&&!p.roles.includes('main'))score-=45;
  if(hasMain&&p.primary==='main'&&pairs.every(x=>!x.score))score-=25;
  return {...p,score,reasons};
 }).filter(p=>p.score>0&&p.reasons.length).sort((a,b)=>b.score-a.score||b.releaseOrder-a.releaseOrder||a.id.localeCompare(b.id));
}
