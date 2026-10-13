export const elements={1:'冷凝',2:'热熔',3:'导电',4:'气动',5:'衍射',6:'湮灭'};
export const weapons={1:'长刃',2:'迅刀',3:'佩枪',4:'臂铠',5:'音感仪'};
export const intensities={0:'轻波级',1:'巨浪级',2:'怒涛级',3:'海啸级'};
export function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
export function fill(value,params=[]){return String(value??'').replace(/\{(\d+)\}/g,(m,i)=>params[Number(i)]??m);}
export function plain(value,params=[]){return fill(value,params).replace(/<br\s*\/?\s*>/gi,'\n').replace(/<[^>]*>/g,'').replace(/\n[ \t]*\n[ \t]*\n/g,'\n\n').trim();}
export function assetUrl(value){return typeof value==='string'&&value.startsWith('/Game/Aki/UI/')?'https://static.nanoka.cc/assets/ww/'+value.replace('/Game/Aki/UI/','').split('.')[0]+'.webp':value;}
export function paramsAt(params,level){return (params??[]).map(p=>Array.isArray(p)?p[Math.min(level-1,p.length-1)]:p);}
export function rowValue(row,level){const ps=paramsAt(row.param,level);return row.format?plain(row.format,ps):ps.join(' / ');}
export function statOptions(stats,level){return Object.entries(stats??{}).filter(([,v])=>v[String(level)]!==undefined).map(([stage,v])=>({stage,value:v[String(level)]}));}
export function filterEntries(entries,query,{elements,weapon,rarity,group,intensity}={}){const q=String(query??'').trim().toLowerCase();return entries.filter(d=>(!q||[d.zh,d.en,d.id].some(x=>String(x??'').toLowerCase().includes(q)))&&(!elements||String(d.element)===elements)&&(!weapon||String(d.weapon??d.type)===weapon)&&(!rarity||String(d.rank)===rarity)&&(!group||(d.group??[]).map(String).includes(group))&&(!intensity||String(d.intensity)===intensity));}
export function safeVideo(url){try{const u=new URL(url);return u.protocol==='https:'&&(u.hostname==='www.bilibili.com'||u.hostname==='bilibili.com'||u.hostname==='b23.tv')?u.href:null;}catch{return null;}}

export function formatStat(x){const v=Number(x.value);return x.is_percent?(v/100).toFixed(2)+'%':x.is_ratio?(v*100).toFixed(1)+'%':Math.round(v);}
