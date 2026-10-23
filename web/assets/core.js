import {gameText} from './i18n.js?v=20261023-i18n3';
export const elements={1:'冷凝',2:'热熔',3:'导电',4:'气动',5:'衍射',6:'湮灭'};
export const weapons={1:'长刃',2:'迅刀',3:'佩枪',4:'臂铠',5:'音感仪'};
export const intensities={0:'轻波级',1:'巨浪级',2:'怒涛级',3:'海啸级'};
export function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
export function fill(value,params=[]){return gameText(String(value??'')).replace(/\{(\d+)\}/g,(m,i)=>params[Number(i)]??m);}
export function plain(value,params=[]){return fill(value,params).replace(/<br\s*\/?\s*>/gi,'\n').replace(/<[^>]*>/g,'').replace(/\n[ \t]*\n[ \t]*\n/g,'\n\n').trim();}
// Normalize a game resource reference to the legacy key in images.json.
// The URL-shaped string is an identifier only. img() resolves it to a local file;
// this helper does not return an image src or request anything from nanoka.
export function imageLookupKey(value){return typeof value==='string'&&value.startsWith('/Game/Aki/UI/')?'https://static.nanoka.cc/assets/ww/'+value.replace('/Game/Aki/UI/','').split('.')[0]+'.webp':value;}
// Game rarity tiers: Common, Elite, Overlord and Calamity cost 1, 3, 4 and 4.
export function echoCost(entry){if(Number(entry.cost)>0)return Number(entry.cost);const tier=entry.intensity_code??entry.intensity;return tier===undefined||tier===null||tier===''?null:({0:1,1:3,2:4,3:4}[tier]??null);}
export function paramsAt(params,level){return (params??[]).map(p=>Array.isArray(p)?p[Math.min(level-1,p.length-1)]:p);}
export function rowValue(row,level){const ps=paramsAt(row.param,level);return row.format?plain(row.format,ps):ps.join(' / ');}
export function statOptions(stats,level){return Object.entries(stats??{}).filter(([,v])=>v[String(level)]!==undefined).map(([stage,v])=>({stage,value:v[String(level)]}));}
export function filterEntries(entries,query,{elements,weapon,rarity,group,intensity}={}){const q=String(query??'').trim().toLowerCase();return entries.filter(d=>(!q||[d.zh,d.en,d.id].some(x=>String(x??'').toLowerCase().includes(q)))&&(!elements||String(d.element)===elements)&&(!weapon||String(d.weapon??d.type)===weapon)&&(!rarity||String(d.rank)===rarity)&&(!group||(d.group??[]).map(String).includes(group))&&(!intensity||String(d.intensity)===intensity));}
export function safeVideo(url){try{const u=new URL(url);return u.protocol==='https:'&&(u.hostname==='www.bilibili.com'||u.hostname==='bilibili.com'||u.hostname==='b23.tv')?u.href:null;}catch{return null;}}

export function formatStat(x){const v=Number(x.value);return x.is_percent?(v/100).toFixed(2)+'%':x.is_ratio?(v*100).toFixed(1)+'%':Math.round(v);}


// Escape text first; render only an allowlist of the game's presentation tags.
export function rich(value,params=[]){
  const colors={Title:'title',Highlight:'highlight',Light:'spectro',Fire:'fusion',Thunder:'electro',Wind:'aero',Ice:'glacio',Dark:'havoc'};
  const tokens=fill(value,params).split(/(<[^>]*>)/g),stack=[];
  let out='';
  for(const token of tokens){
    if(!token.startsWith('<')){out+=esc(token);continue;}
    const c=token.match(/^<color=(\w+)>$/i);
    if(c){const cls=colors[c[1]]||'highlight';out+=`<span class="game-${cls}">`;stack.push('color');}
    else if(/^<size=\d+>$/i.test(token)){out+='<span>';stack.push('size');}
    else if(/^<\/(color|size)>$/i.test(token)){if(stack.length){out+='</span>';stack.pop();}}
    else if(/^<br\s*\/?\s*>$/i.test(token))out+='\n';
    // Links and semantic tags are deliberately reduced to their text content.
  }
  return out+'</span>'.repeat(stack.length);
}
