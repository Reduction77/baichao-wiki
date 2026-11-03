import {echoGrade} from './training-text.js?v=20261103-wiki1';
import {parseState} from './team-builder-core.js?v=20261103-wiki1';
// Training import is separate from the existing builder schema and recommendations.
export const TRAINING_KEY='baichao-training-v1';
export const TRAINING_BACKUP='baichao-training-import-backup-v1';
export function chartRows(width,height){
 if(!Number.isFinite(width)||width<200||width>6000||height/width<2||height/width>16)throw Error('请选择完整的单列 ww练度长图。');
 const pitch=width*.11,first=width*.535,count=Math.floor((height-width*.1-first)/pitch)+1;
 return Array.from({length:Math.min(100,Math.max(0,count))},(_,i)=>({index:i,y:first+i*pitch,pitch}));
}
export function numericScore(text){const m=String(text).trim().match(/^(\d{1,3}\.\d{2})\.*$/);return m?Number(m[1]):null;}
export function normalizeTraining(rows,profiles,catalog=null){
 const valid=new Map(profiles.characters.map(p=>[String(p.id),p])),used=new Set();
 const result=rows.filter(r=>r.selected).map(r=>{
  const p=valid.get(String(r.id));if(!p)throw Error('请为已勾选的行选择角色。');if(used.has(p.id))throw Error('同一个角色出现多次，请核对后只保留一行。');used.add(p.id);
  const num=(v,min,max,integer)=>{if(v===null||v===undefined||v==='')return null;const x=Number(v);if(!Number.isFinite(x)||x<min||x>max||(integer&&!Number.isInteger(x)))throw Error('请核对分数、共鸣链和精炼的取值。');return x;};
  let weaponRarity=num(r.weaponRarity,0,5,true),weaponId=/^\d+$/.test(String(r.weaponId||''))?String(r.weaponId):null,weaponName=String(r.weaponName||'').slice(0,80);
  if((weaponId||weaponName)&&p.weapon!==undefined){
   if(!Array.isArray(catalog))throw Error('武器资料尚未加载，请重试。');
   const weapon=catalog.find(w=>weaponId?String(w.id)===weaponId:w.name===weaponName);if(!weapon)throw Error('所选武器不在当前资料库中，请重新选择。');
   if(Number(weapon.type)!==Number(p.weapon))throw Error(`${p.name||p.id}的武器类型不匹配，请重新选择武器。`);
   weaponRarity=Number(weapon.rarity);weaponName=weapon.name;weaponId=String(weapon.id);
  }
  // 0 means manually confirmed low-star; 1–4 are catalog rarities. Old backups remain valid.
  return {id:p.id,grade:echoGrade(r.grade),score:num(r.score,0,999.99,false),chain:num(r.chain,0,6,true),weaponRarity,weaponId,weaponName,refine:weaponRarity!==null&&weaponRarity<5?null:num(r.refine,1,5,true)};
 });if(!result.length)throw Error('请至少勾选一名已核对的角色。');return result;
}
// Fill only missing fields in append mode; keep weapon identity/rank internally consistent.
export function mergeTrainingRecord(previous,incoming){
 if(!previous)return incoming;
 const out={...incoming};for(const field of ['score','grade','chain'])if(out[field]===null||out[field]===undefined||out[field]==='')out[field]=previous[field]??null;
 const hasWeapon=incoming.weaponRarity!==null||Boolean(incoming.weaponId);
 if(!hasWeapon){for(const field of ['weaponRarity','weaponId','weaponName','refine'])out[field]=previous[field]??(field==='weaponName'?'':null);if(incoming.refine!==null)out.refine=incoming.refine;}
 else if(incoming.weaponRarity===5){
  const sameWeapon=Boolean(incoming.weaponId)&&incoming.weaponId===previous.weaponId;
  const unspecifiedSameRarity=!incoming.weaponId&&previous.weaponRarity===5;
  if(unspecifiedSameRarity){out.weaponId=previous.weaponId??null;out.weaponName=previous.weaponName||'';}
  if((sameWeapon||unspecifiedSameRarity)&&out.refine===null)out.refine=previous.refine??null;
 }
 if(out.weaponRarity!==null&&out.weaponRarity<5)out.refine=null;
 return out;
}
export function planTrainingImport(state,training,rows,profiles,mode='append',catalog=null){
 if(!['append','replace'].includes(mode))throw Error('未知导入方式');const clean=normalizeTraining(rows,profiles,catalog),map=new Map(profiles.characters.map(p=>[p.id,p]));
 const selected=new Set(clean.map(r=>map.get(r.id).family));const families=[...new Set(profiles.characters.map(p=>p.family))];
 const entries=mode==='replace'?{}:{...(training?.entries||{})};for(const row of clean){const merged=mode==='append'?mergeTrainingRecord(entries[row.id],row):row;entries[row.id]=normalizeTraining([{...merged,selected:true}],profiles,catalog)[0];}
 // Every confirmed image defines the roster; append/replace only controls retained training data.
 const next=structuredClone(state);next.excluded=families.filter(f=>!selected.has(f));
 return {builder:next,training:{schema:1,updatedAt:new Date().toISOString(),rosterLinked:true,entries},count:clean.length};
}
// Migrate the former matrix-only overlay once; afterwards excluded is the sole authority.
export function linkTrainingAvailability(storage,builderKey,state,profiles){
 const training=readTraining(storage);if(!state.matrix||!training||training.rosterLinked===true)return {builder:state,training};
 const map=new Map(profiles.characters.map(p=>[p.id,p.family])),known=new Set(Object.keys(training.entries).map(id=>map.get(id)).filter(Boolean));
 const builder=structuredClone(state);builder.excluded=[...new Set(profiles.characters.map(p=>p.family))].filter(f=>!known.has(f)||state.excluded.includes(f));
 const linked={...training,rosterLinked:true};
 atomicWrite(storage,[[TRAINING_KEY,JSON.stringify(linked)],[builderKey,JSON.stringify(builder)]]);
 return {builder,training:linked};
}
export function readTraining(storage){try{const v=JSON.parse(storage.getItem(TRAINING_KEY)||'null');return v?.schema===1&&v.entries&&typeof v.entries==='object'?v:null;}catch{return null;}}
function put(storage,key,value){value===null?storage.removeItem(key):storage.setItem(key,value);}
function atomicWrite(storage,writes){
 const before=writes.map(([key])=>[key,storage.getItem(key)]);
 try{for(const [k,v] of writes)put(storage,k,v);}catch{let rollback=true;for(const [k,v] of before){try{put(storage,k,v);}catch{rollback=false;}}throw Error(rollback?'浏览器保存失败，未应用本次导入。请释放存储空间后再试。':'浏览器存储异常，请保留当前页面并导出配队备份。');}
}
// Save a manual roster change and mark its authority atomically, including in normal mode.
export function saveAvailableRoster(storage,builderKey,state){
 const training=readTraining(storage),linked=training?{...training,rosterLinked:true}:null;
 const writes=[[builderKey,JSON.stringify(state)]];if(linked)writes.push([TRAINING_KEY,JSON.stringify(linked)]);
 atomicWrite(storage,writes);return linked;
}
export function applyTraining(storage,builderKey,state,rows,profiles,mode,catalog=null){
 const next=planTrainingImport(state,readTraining(storage),rows,profiles,mode,catalog);
 const backup={schema:1,excluded:[...state.excluded],training:storage.getItem(TRAINING_KEY)};
 atomicWrite(storage,[[TRAINING_BACKUP,JSON.stringify(backup)],[TRAINING_KEY,JSON.stringify(next.training)],[builderKey,JSON.stringify(next.builder)]]);return next;
}
export function undoTraining(storage,builderKey,state){
 let backup;try{backup=JSON.parse(storage.getItem(TRAINING_BACKUP)||'null');}catch{}if(backup?.schema!==1||!Array.isArray(backup.excluded))throw Error('没有可撤销的练度导入。');
 let restored=backup.training;
 if(restored!==null){try{const previous=JSON.parse(restored);if(previous?.schema!==1||!previous.entries||typeof previous.entries!=='object')throw Error();restored=JSON.stringify({...previous,rosterLinked:true});}catch{throw Error('撤销备份中的练度资料无法读取。');}}
 const next=structuredClone(state);next.excluded=[];
 // Mark restored legacy records linked so matrix migration cannot re-disable the all-available roster.
 atomicWrite(storage,[[TRAINING_KEY,restored],[builderKey,JSON.stringify(next)],[TRAINING_BACKUP,null]]);return next;
}

export function restoreTrainingBackup(storage,builderKey,backup,profiles,catalog=null){
 if(!backup||backup.schema!==1||!backup.builder||!Object.hasOwn(backup,'training'))throw Error('不是有效的练度与配队备份。');
 const builder=parseState(backup.builder,profiles);let training=null;
 if(backup.training!==null){if(backup.training.schema!==1||!backup.training.entries||typeof backup.training.entries!=='object')throw Error('备份中的练度资料无效。');const values=Object.values(backup.training.entries);const rows=values.map(v=>({...v,selected:true}));const clean=rows.length?normalizeTraining(rows,profiles,catalog):[];training={schema:1,updatedAt:backup.training.updatedAt||'',rosterLinked:backup.training.rosterLinked===true,entries:Object.fromEntries(clean.map(r=>[r.id,r]))};}
 atomicWrite(storage,[[TRAINING_KEY,training===null?null:JSON.stringify(training)],[builderKey,JSON.stringify(builder)],[TRAINING_BACKUP,null]]);return builder;
}
