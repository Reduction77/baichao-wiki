// Recommendations require an explicitly sourced, complete three-character team.
export const roleNames={main:'主力输出',support:'协奏增益',sustain:'生存治疗'};
// Permanent allowances apply in every matrix period; temporary bonuses never stack.
export const matrixPermanent=['1110','1505','1503','1307','1209','1103','1106'];
export const matrixCurrent=['1509'];
export const defaultState=()=>({schema:4,matrix:false,excluded:[],draft:[],teams:[]});
export function characterMap(profiles){return new Map(profiles.characters.map(p=>[p.id,p]));}
export function canonicalId(value,profiles){return profiles.aliases?.[String(value)]||null;}
export function uses(state,characters){const counts={};for(const t of state.teams)for(const id of t.characters){const family=characters.get(id)?.family;if(family)counts[family]=(counts[family]||0)+1;}return counts;}
export function limitFor(state,p){return state.matrix&&(matrixPermanent.includes(p.family)||matrixCurrent.includes(p.family))?2:1;}
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
 if(!raw||typeof raw!=='object'||![1,2,3,4].includes(raw.schema)||!Array.isArray(raw.teams)||raw.teams.length>100)throw Error('不是有效的白潮配队文件，最多导入 100 支队伍');
 const characters=characterMap(profiles),state=defaultState();
 state.matrix=raw.matrix===true;
 const families=new Set([...characters.values()].map(p=>p.family));
 if(raw.schema===2){
  if(raw.matrixCharacter!==undefined&&(typeof raw.matrixCharacter!=='string'||(raw.matrixCharacter&&!families.has(raw.matrixCharacter))))throw Error('本期指定角色设置不正确');
  if(raw.limits!==undefined||raw.defaultLimit!==undefined)throw Error('旧版自定义次数设置无效，请使用当前矩阵规则');

 }
 if(raw.schema===3&&raw.matrixPeriod!==undefined&&typeof raw.matrixPeriod!=='string')throw Error('旧版矩阵设置格式不正确');
 if(raw.schema===4&&(raw.limits!==undefined||raw.defaultLimit!==undefined||raw.matrixCharacter!==undefined||raw.matrixPeriod!==undefined))throw Error('矩阵次数由当前已确认规则决定');
 // Legacy quotas/designations/period selections are discarded; teams and roster remain intact.
 if(raw.excluded!==undefined&&(!Array.isArray(raw.excluded)||raw.excluded.some(key=>!families.has(key))))throw Error('可用角色设置格式不正确');
 state.excluded=[...new Set(raw.excluded||[])];
 function ids(input,max){if(!Array.isArray(input)||input.length>max)throw Error('队伍角色数量不正确');const ids=input.map(v=>canonicalId(v,profiles));if(ids.some(v=>!v))throw Error('文件包含当前资料库中不存在的角色');const fs=ids.map(id=>characters.get(id).family);if(new Set(fs).size!==ids.length)throw Error('同队存在重复角色或漂泊者形态');return ids;}
 state.teams=raw.teams.map((t,i)=>{if(!t||typeof t!=='object')throw Error('队伍格式不正确');const characters=ids(t.characters,3);if(characters.length!==3)throw Error('暂存队伍必须有三名角色');return {name:typeof t.name==='string'?t.name.slice(0,60):`队伍 ${i+1}`,characters};});
 state.draft=ids(raw.draft||[],3);
 // Exceeding budgets after a mode/config change is retained and visibly flagged.
 return state;
}
export function matchingTeams(state,profiles,config={}){
 if(!state.draft.length)return [];
 const chars=characterMap(profiles);
 return (config.teams||[]).filter(t=>t.characters.length===3&&state.draft.every(id=>t.characters.includes(id))&&t.characters.every(id=>{
  const p=chars.get(id);return p&&!state.excluded.includes(p.family)&&(uses(state,chars)[p.family]||0)<limitFor(state,p);
 }));
}
export function recommend(state,profiles,config={}){
 if(!state.draft.length||state.draft.length>=3)return [];
 const chars=characterMap(profiles),matches=matchingTeams(state,profiles,config),candidates=new Map();
 for(const team of matches)for(const id of team.characters){
  const p=chars.get(id);if(unavailableReason(state,p,chars))continue;
  if(!candidates.has(id))candidates.set(id,{...p,score:0,reasons:[],teams:[]});
  const rec=candidates.get(id);rec.score++;rec.teams.push(team);rec.reasons.push(`${team.system} · ${team.name}`);
 }
 return [...candidates.values()].sort((a,b)=>b.score-a.score||b.releaseOrder-a.releaseOrder||a.id.localeCompare(b.id));
}
