// Report text is matched only to the current local Wiki catalog.
let catalogPromise;
export async function loadTrainingCatalog(){
 return catalogPromise??=(async()=>{const r=await fetch(new URL('../data/training-catalog.json',import.meta.url));if(!r.ok)throw Error('武器资料库加载失败，请重试。');return r.json();})().catch(e=>{catalogPromise=null;throw e;});
}
export const isLowWeapon=r=>Number.isInteger(r.weaponRarity)&&r.weaponRarity>=0&&r.weaponRarity<5;
export const ECHO_GRADES=['SSS','SS','S','A','B','C'];
export const echoGrade=value=>ECHO_GRADES.includes(String(value??'').trim().toUpperCase())?String(value).trim().toUpperCase():null;
const present=v=>v!==null&&v!==undefined&&v!=='';
const range=(v,a,b)=>present(v)&&Number.isFinite(Number(v))&&Number(v)>=a&&Number(v)<=b;
export function trainingMissing(r){
 const out=[];if(!r.id)out.push('角色');if(!range(r.score,0,999.99))out.push('评分');if(!echoGrade(r.grade))out.push('声骸评级');
 if(!range(r.chain,0,6)||!Number.isInteger(Number(r.chain)))out.push('共鸣链');
 if(!isLowWeapon(r)&&r.weaponRarity!==5)out.push('武器');
 if(r.weaponRarity===5&&(!range(r.refine,1,5)||!Number.isInteger(Number(r.refine))))out.push('武器阶数');
 return out;
}
export function refreshTrainingReview(r){r.review=trainingMissing(r).length>0;return r;}
// The OCR catalog may match a name from another weapon class. Treat it as missing.
export function reconcileTrainingWeapon(row,profiles,catalog){
 row.weaponIssue='';const p=profiles.characters.find(p=>p.id===row.id),weapon=catalog.find(w=>String(w.id)===String(row.weaponId));
 if(p&&weapon&&Number(p.weapon)!==Number(weapon.type)){
  row.weaponId=null;row.weaponName='';row.weaponRarity=null;row.refine=null;row.weaponIssue='武器类型不匹配，请重新选择。';
 }
 return row;
}
export const cleanWeaponText=s=>String(s??'').normalize('NFKC').replace(/[^\u3400-\u9fffA-Za-z0-9]/g,'').toLowerCase();
export function editDistance(a,b){const v=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let prev=v[0];v[0]=i;for(let j=1;j<=b.length;j++){const old=v[j];v[j]=Math.min(v[j]+1,v[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));prev=old;}}return v[b.length];}
export function matchWeaponText(text,weapons,confidence=1){
 const s=cleanWeaponText(text);if(s.length<2)return null;
 const ranked=weapons.map(w=>{const n=cleanWeaponText(w.name);return {weapon:w,d:editDistance(s,n),n};}).sort((a,b)=>a.d-b.d);
 const a=ranked[0],b=ranked[1];if(!a)return null;
 if(a.d===0)return a.weapon;
 // A unique close dictionary match may repair OCR substitutions, never an arbitrary nearest name.
 const allowed=Math.min(2,Math.floor(Math.max(s.length,a.n.length)/3));
 if(confidence>=.45&&a.d<=Math.max(1,allowed)&&b.d-a.d>=1&&a.d/Math.max(s.length,a.n.length)<=.34)return a.weapon;
 return null;
}
export function badgeNumber(text,kind){
 const s=String(text??'').normalize('NFKC').replace(/\s/g,'');
 const map={'零':0,'〇':0,'一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6};
 const match=s.match(kind==='chain'?/^([0-6零〇一二两三四五六])(?:链|鏈|连|鎖|锁)?$/:/^([1-5一二两三四五])(?:阶|階)?$/);
 if(!match)return null;return map[match[1]]??Number(match[1]);
}
// CTC lexicon decoding: score complete catalog names against model character probabilities.
// Rare characters missing from the model alphabet are limited to a penalized wildcard inside a known name.
export function ctcWeapon(data,steps,classes,keys,weapons,{single=false,caseSensitive=false}={}){
 const ids=new Map(keys.map((c,i)=>[c,i])),maxChar=new Float64Array(steps);
 for(let t=0;t<steps;t++){let max=0;for(let j=1;j<classes;j++)max=Math.max(max,data[t*classes+j]);maxChar[t]=max*.2;}
 const ranked=[];
 for(const weapon of weapons){
  const name=caseSensitive?String(weapon.name):cleanWeaponText(weapon.name),symbols=[0];let position=0;for(const c of name){symbols.push(weapon.wildcardSuffix&&position===name.length-1?-1:ids.get(c)??-1,0);position++;}if(symbols.filter(s=>s<0).length>Math.max(1,Math.floor(name.length*.25)))continue;
  if(name.length<(single?1:2))continue;
  let a=new Float64Array(symbols.length);a[0]=1;let log=0;
  for(let t=0;t<steps;t++){
   const b=new Float64Array(a.length);let sum=0;
   for(let j=0;j<a.length;j++){let v=a[j]+(j?a[j-1]:0);if(j>1&&symbols[j]!==0&&symbols[j]!==symbols[j-2])v+=a[j-2];const prob=symbols[j]<0?maxChar[t]:data[t*classes+symbols[j]];b[j]=v*Math.max(1e-12,prob);sum+=b[j];}
   if(sum<=1e-200){log=-1e5;break;}log+=Math.log(sum);for(let j=0;j<b.length;j++)b[j]/=sum;a=b;
  }
  log+=Math.log(Math.max(1e-200,a.at(-1)+a.at(-2)));ranked.push({weapon,score:log,average:log/name.length});
 }
 ranked.sort((a,b)=>b.score-a.score);const a=ranked[0],gap=a? a.score-(ranked[1]?.score??-1e5):0;
 return {weapon:a&&(a.average>=-5.5||(a.average>=-6.5&&gap>=4))&&gap>=3?a.weapon:null,average:a?.average??-1e5,gap};
}
