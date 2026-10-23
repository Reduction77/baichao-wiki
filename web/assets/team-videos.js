import {esc,safeVideo} from './core.js';

// Shared sources are keyed by BV; legacy inline videos remain readable by the admin panel.
export function videoReferences(record,sources={}){
 const ids=record.sourceIds||record.references?.map(r=>r.sourceId)||[];
 const refs=ids.map(sourceId=>({...sources[sourceId],...(record.references||[]).find(r=>r.sourceId===sourceId)}));
 const key=v=>safeVideo(v.url)?.replace(/\/$/,'');
 return [...(record.videos||[]),...refs].filter((v,i,list)=>key(v)&&list.findIndex(x=>key(x)===key(v))===i);
}
export function mergeTeamLibrary(legacy,config={}){
 const signature=t=>t.characters.map(String).sort().join('-');
 const rows=(config.teams||[]).map(t=>({...t,title:t.name,type:'team'}));
 for(const record of legacy){
  const existing=rows.find(t=>signature(t)===signature(record));
  if(existing){
   // Inline admin edits override matching source metadata while keeping source-specific notes.
   const videos=(record.videos||[]).map(v=>({...videoReferences(existing,config.sources).find(r=>r.url.replace(/\/$/,'')===v.url.replace(/\/$/,'')),...v}));
   Object.assign(existing,record,{videos});
  }else rows.push(record);
 }
 return [...rows,...(config.guides||[])];
}
export function renderTeamVideos(record,sources={}){
 return videoReferences(record,sources).map(v=>`<div class="team-video-reference">${v.kind?`<small class="team-video-kind">${esc(v.kind)}</small>`:''}<a class="video" data-original-text lang="zh-CN" href="${esc(safeVideo(v.url))}" target="_blank" rel="noopener noreferrer">▶ ${esc(v.title||'配队视频')} <span class="muted">／ ${esc(v.up||'UP主未注明')} ↗</span></a>${v.note?`<p class="stat-note">${esc(v.note)}</p>`:''}${v.gameVersion?`<small>视频版本：${esc(v.gameVersion)}</small>`:''}</div>`).join('');
}
