import {eligibleBetaVersions} from './versions.js?v=20261023-reviewed1';
import {getLanguage,getLocale,gameText} from './i18n.js?v=20261023-reviewed1';
const displayName=row=>getLanguage()==='en'?(row.en||gameText(row.zh||row.name||'')):(row.zh||row.name||'');
const plural={character:'characters',weapon:'weapons',echo:'echoes'};
function versionParts(v){return String(v||'').split('.').map(Number);}
function compareVersion(a,b){const x=versionParts(a),y=versionParts(b);for(let i=0;i<Math.max(x.length,y.length);i++){const n=(x[i]||0)-(y[i]||0);if(n)return n;}return 0;}
export function betaVersionsForKind(registry,kind,id){return eligibleBetaVersions(registry).filter(v=>(v[plural[kind]]||[]).map(String).includes(String(id)));}
export function catalogEntries(kind,live,registry){const known=new Set(live.map(r=>String(r.id))),beta=new Map();for(const v of eligibleBetaVersions(registry))for(const rawId of v[plural[kind]]||[]){const id=String(rawId);if(!/^\d+$/.test(id)||known.has(id))continue;const d=v.indexes?.[kind]?.[id]||(kind==='character'?v.index?.[id]:v[kind+'Index']?.[id]);if(!d)continue;beta.set(id,{...d,id,zh:d.zh||d.name||id,rank:d.rank??d.rarity??0,intensity:d.intensity_code??d.intensity,group:Array.isArray(d.group)?d.group:Object.keys(d.group||{}),betaVersion:v.gameVersion});}return [...live,...beta.values()];}
export function compareCatalog(kind,a,b,order={},sort='latest'){
 if(!!a.betaVersion!==!!b.betaVersion)return a.betaVersion?-1:1;
 if(a.betaVersion&&b.betaVersion){const delta=compareVersion(b.betaVersion,a.betaVersion);if(delta)return delta;}
 if(sort==='name')return displayName(a).localeCompare(displayName(b),getLocale());
 if(sort==='id')return Number(a.id)-Number(b.id);
 if(sort==='rarity'){const n=Math.max(...[b.rank||0].flat())-Math.max(...[a.rank||0].flat());if(n)return n;}
 const x=order[kind]?.[a.id],y=order[kind]?.[b.id];
 if(kind==='character'){const n=(y?.order??b.releaseOrder??-1)-(x?.order??a.releaseOrder??-1);if(n)return n;}
 else {const n=compareVersion(y?.version||b.releaseVersion,x?.version||a.releaseVersion);if(n)return n;const phase=(y?.order??b.releaseOrder??0)-(x?.order??a.releaseOrder??0);if(phase)return phase;}
 return displayName(a).localeCompare(displayName(b),getLocale())||Number(a.id)-Number(b.id);
}
