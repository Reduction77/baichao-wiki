import {esc,elements,safeVideo} from './core.js';
import {matrixPermanent,matrixPeriods,roleNames,defaultState,parseState,characterMap,uses,limitFor,unavailableReason,budgetConflicts,selectCharacter,saveTeam,recommend,matchingTeams} from './team-builder-core.js?v=20261016-matrix';
const STORAGE='baichao-team-builder-v1';
export function createTeamBuilder({profiles,img,teams=[],recommendations:config={},storage=globalThis.localStorage,notify=()=>{}}){
 const chars=characterMap(profiles);let state=defaultState(),root,editing=false,group=false,q='',role='',element='',dialog='',initialMessage='';
 try{const saved=storage.getItem(STORAGE);if(saved){const raw=JSON.parse(saved);state=parseState(raw,profiles);if(raw.schema<3)initialMessage='矩阵规则已更新：六名固定角色每期可用两次，本期额外角色为琳奈；旧队伍已保留，旧的指定角色与自定义次数已移除。';}}catch{initialMessage='此前保存的编队无法读取，已开启新的编队。';}
 const primary=p=>roleNames[p.primary];
 const charLink=p=>`<a class="tb-profile" href="#character/${p.id}" aria-label="查看${esc(p.name)}档案" title="查看${esc(p.name)}档案">档案 ↗</a>`;
 const portrait=p=>img(p.icon,'','tb-avatar');
 function persist(){try{storage.setItem(STORAGE,JSON.stringify(state));}catch{initialMessage='浏览器未允许保存，本次修改暂存于当前页面；可导出备份。';}}
 function roster(){
  const usage=uses(state,chars),recs=new Map(recommend(state,profiles,config).map(p=>[p.id,p]));
  const visible=profiles.characters.filter(p=>(!q||[p.name,p.en,...p.aliases].some(s=>String(s).toLowerCase().includes(q.toLowerCase())))&&(!role||p.roles.includes(role))&&(!element||String(p.element)===element)).sort((a,b)=>b.releaseOrder-a.releaseOrder);
  function tiles(list){return `<div class="tb-roster-grid">${list.map(p=>{
   const selected=state.draft.includes(p.id),why=unavailableReason(state,p,chars),rec=recs.get(p.id),excluded=state.excluded.includes(p.family),used=usage[p.family]||0;
   return `<article class="tb-char ${selected?'is-selected':''} ${rec?'is-recommended':''} ${why&&!selected&&!editing?'is-unavailable':''}"><button type="button" class="tb-pick" data-tb="${editing?'available':'pick'}" data-id="${p.id}" aria-label="${editing?(excluded?'设为可用':'设为不可用'):selected?'取消选择':'选择'}${esc(p.name)}" aria-pressed="${editing?!excluded:selected}" ${!editing&&!selected&&why?'disabled':''} title="${esc(editing?'切换是否拥有此角色':selected?'再次点击取消选择':why||rec?.reasons[0]||'加入当前编队')}">${portrait(p)}<strong>${esc(p.name)}</strong><small>${editing?(excluded?'未启用':'✓ 可用'):selected?'已选 · 点击取消':rec?'✦ 推荐':primary(p)}</small>${state.matrix?`<span class="tb-quota">${used}/${limitFor(state,p)}</span>`:!editing&&used?'<span class="tb-quota">已使用</span>':''}</button>${charLink(p)}</article>`;
  }).join('')}</div>`;}
  return visible.length?(group?Object.entries(roleNames).map(([key,name])=>{const list=visible.filter(p=>p.primary===key);return list.length?`<h3 class="tb-group-heading">${name}<span>${list.length}</span></h3>${tiles(list)}`:'';}).join(''):tiles(visible)):'<p class="tb-empty">没有匹配的角色，试试其他名称或筛选。</p>';
 }
 function slots(){return [0,1,2].map(i=>{const p=chars.get(state.draft[i]);return p?`<article class="tb-slot filled"><div class="tb-slot-number">0${i+1}</div>${portrait(p)}<div><strong>${esc(p.name)}</strong><small>${elements[p.element]} · ${primary(p)}</small>${charLink(p)}</div><div class="tb-slot-tools"><button data-tb="left" data-index="${i}" aria-label="${esc(p.name)}前移" ${i===0?'disabled':''}>←</button><button data-tb="right" data-index="${i}" aria-label="${esc(p.name)}后移" ${i===state.draft.length-1?'disabled':''}>→</button><button data-tb="remove" data-index="${i}" aria-label="移除${esc(p.name)}">×</button></div></article>`:`<div class="tb-slot"><span class="tb-slot-number">0${i+1}</span><span class="tb-slot-placeholder">选择第 ${i+1} 位角色<small>可从任意定位开始</small></span></div>`;}).join('');}
 function recommendations(){
  const list=recommend(state,profiles,config);
  if(!state.draft.length)return '<div class="tb-guide"><span>✦</span><h3>从你想玩的角色开始</h3><p>选择主 C，寻找增益与治疗；选择辅助，反向寻找适配的输出角色。</p><small>推荐会随当前编队、可用角色及剩余次数更新。</small></div>';
  if(state.draft.length===3)return '<div class="tb-ready"><strong>三人编队已就绪</strong><p>可以调整顺序、查看档案，或点击“暂存队伍”继续规划下一队。</p></div>';
  const groups=Object.entries(roleNames).map(([key,name])=>{const rows=list.filter(p=>p.primary===key).slice(0,4);return rows.length?`<section class="tb-rec-group"><h3>${name}<span>${rows.length} 位候选</span></h3>${rows.map(p=>`<article class="tb-rec"><div class="tb-rec-person">${portrait(p)}<div><strong>${esc(p.name)}</strong>${charLink(p)}</div><button class="tb-add" data-tb="pick" data-id="${p.id}" aria-label="加入${esc(p.name)}">＋ 加入</button></div><p>${p.reasons.slice(0,3).map(s=>esc(s)).join('；')}</p></article>`).join('')}</section>`:'';}).join('');
  return groups?`<div class="tb-rec-groups">${groups}</div>${curatedTeams(state.draft)}`:'<p class="tb-empty">未收录能同时包含已选角色的可用完整配队，不会按标签凑队。可手动编队，或检查可用角色与剩余次数。</p>';
 }
 function curatedTeams(ids){
  const matches=matchingTeams(state,profiles,config);
  return matches.length?`<div class="tb-videos tb-curated"><strong>已收录完整配队 · ${matches.length} 条</strong>${matches.map(t=>`<article class="tb-curated-team"><h3>${esc(t.system)} · ${esc(t.kind)}</h3><p>${t.characters.map(id=>`<a href="#character/${id}">${esc(chars.get(id).name)} ↗</a>`).join(' / ')}</p><small>${esc(t.requirements)}</small>${t.sourceIds.map(id=>{const v=config.sources[id],url=safeVideo(v?.url);return url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">▶ ${esc(v.title)} ／${esc(v.up)} ↗</a><small>${v.gameVersion?'来源版本 '+esc(v.gameVersion)+' · ':''}${v.verification==='user-provided'?'用户提供的视频记录':'已核对搜索索引标题与简介，未逐帧核验'}</small>`:'';}).join('')}</article>`).join('')}</div>`:'';
 }
 function relatedVideos(ids){const records=teams.filter(t=>ids.length>=2&&ids.every(id=>t.characters.map(String).some(raw=>profiles.aliases[raw]===id)));return records.length?`<div class="tb-videos"><strong>已有配队视频</strong>${records.flatMap(t=>t.videos||[]).map(v=>safeVideo(v.url)?`<a href="${esc(safeVideo(v.url))}" target="_blank" rel="noopener noreferrer">▶ ${esc(v.title)} <span>／${esc(v.up)}</span> ↗</a>`:'').join('')}</div>`:'';}
 function savedTeams(){return state.teams.length?`<div class="tb-saved-list">${state.teams.map((t,i)=>`<article class="tb-saved"><div class="tb-saved-head"><h3><span>${String(i+1).padStart(2,'0')}</span>${esc(t.name)}</h3><div><button data-tb="edit-team" data-index="${i}" aria-label="编辑${esc(t.name)}">编辑</button><button data-tb="delete-team" data-index="${i}" aria-label="删除${esc(t.name)}">删除</button></div></div><div class="tb-saved-roles">${t.characters.map(id=>{const p=chars.get(id);return `<a href="#character/${id}" aria-label="查看${esc(p.name)}档案">${portrait(p)}<span>${esc(p.name)}<small>${primary(p)}</small></span><span>↗</span></a>`;}).join('')}</div>${relatedVideos(t.characters)}</article>`).join('')}</div>`:'<div class="tb-saved-empty"><span>▱</span><strong>还没有暂存的队伍</strong><p>选满三名角色后点击“暂存队伍”，再继续规划下一队。</p></div>';}
 function dialogHtml(){
  if(!dialog)return '';
  return `<section class="tb-dialog" role="dialog" aria-modal="true" aria-label="${dialog==='import'?'导入配队':'清空暂存队伍'}" tabindex="-1"><div class="tb-dialog-inner">${dialog==='import'?'<h2>导入白潮配队文件</h2><p>将此前导出的 JSON 内容粘贴到这里。确认后会替换当前编队、暂存队伍和可用角色设置。</p><textarea id="tb-import-text" rows="9" aria-label="配队 JSON 内容" placeholder="粘贴导出的完整 JSON 内容"></textarea><p id="tb-import-error" class="error" role="alert"></p><button class="button primary" data-tb="confirm-import">确认导入</button>':'<h2>清空全部暂存队伍</h2><p>将移除暂存队伍并释放已使用次数；当前编队和可用角色设置会保留。可先导出备份。</p><button class="button primary" data-tb="confirm-clear">确认清空</button>'}<button class="button" data-tb="cancel-dialog">取消</button></div></section>`;
 }
 function paint(){
  if(!root)return;
  const rosterScroll=root.querySelector('#tb-roster-list')?.scrollTop||0;
  const count=uses(state,chars),conflicts=budgetConflicts(state,chars);
  root.innerHTML=`<div class="tb-summary"><span class="pill">正式服 ${esc(profiles.version)} · ${profiles.characters.length} 个角色形态</span><span>自动保存在当前浏览器 · 无需登录</span></div><div class="tb-layout"><aside class="tb-panel tb-roster" aria-label="可选角色"><div class="tb-panel-head"><h2>角色列表 <small>${profiles.characters.filter(p=>!state.excluded.includes(p.family)).length}/${profiles.characters.length}</small></h2><button data-tb="edit">${editing?'完成设置':'编辑可用角色'}</button></div><div class="tb-roster-controls"><div class="tb-toggle-row"><div class="tb-segments"><button data-tb="order" aria-pressed="${!group}">角色顺序</button><button data-tb="group" aria-pressed="${group}">角色定位</button></div><button role="switch" aria-checked="${state.matrix}" aria-label="矩阵模式" data-tb="matrix" class="tb-switch ${state.matrix?'on':''}"><span></span>矩阵模式</button></div>${state.matrix?`<label class="tb-matrix-designation">矩阵期次<select id="tb-matrix-period" aria-label="矩阵期次">${Object.entries(matrixPeriods).map(([id,period])=>`<option value="${id}" ${state.matrixPeriod===id?'selected':''}>${esc(period.label)}</option>`).join('')}</select></label><p class="tb-help">每期固定可用 2 次：${matrixPermanent.map(id=>esc(chars.get(id).name)).join('、')}。</p><p class="tb-help">${state.matrixPeriod==='linnae-bonus'?'本期琳奈也可用 2 次，其余角色各 1 次。':'下一期琳奈恢复 1 次；固定六名角色仍各可用 2 次，其余角色各 1 次。'}</p>`:''}<input id="tb-search" type="search" value="${esc(q)}" aria-label="搜索配队角色" placeholder="搜索角色名称 / ID"><div class="tb-select-row"><select id="tb-role" aria-label="筛选角色定位"><option value="">全部定位</option>${Object.entries(roleNames).map(([key,name])=>`<option value="${key}" ${role===key?'selected':''}>${name}</option>`).join('')}</select><select id="tb-element" aria-label="筛选角色属性"><option value="">全部属性</option>${Object.entries(elements).map(([key,name])=>`<option value="${key}" ${element===key?'selected':''}>${name}</option>`).join('')}</select></div>${editing?`<div class="tb-edit-toolbar"><button data-tb="all">全选</button><button data-tb="none">全不选</button></div>`:''}</div><p class="tb-help">${editing?'点击头像切换是否可用；档案链接始终可以打开。':state.matrix?'角标为已用 / 可用次数；固定角色与当期额外角色均按 2 次计算。':'普通模式下，已暂存队伍使用过的角色不能重复选用。'}</p><div id="tb-roster-list" class="tb-roster-scroll">${roster()}</div></aside><div class="tb-workspace"><section class="tb-panel tb-current"><div class="tb-panel-head"><h2>当前编队 <small>${state.draft.length}/3</small></h2><button data-tb="clear-draft" ${!state.draft.length?'disabled':''}>清空编队</button></div><div class="tb-slots">${slots()}</div><div class="tb-current-foot"><p>点击头像选择，再点一次取消；箭头可调换位置。</p><button class="button primary" data-tb="save" ${state.draft.length!==3?'disabled':''}>＋ 暂存队伍</button></div>${state.draft.length===3?curatedTeams(state.draft):''}</section><section class="tb-panel"><div class="tb-panel-head"><h2>适配推荐 <small>双向匹配</small></h2><span class="tb-legend">✦ 绿色标记推荐角色</span></div>${recommendations()}<details class="tb-method"><summary>推荐依据与使用说明</summary><p>按 B站视频中已收录的完整三人配队推荐，已覆盖 ${config.coveredMains?.length||0} 名主 C、${config.teams?.length||0} 条组合。选主 C 推荐同队辅助，选辅助反向推荐同队主 C；选两人后仅推荐能补全同一条配队的第三人。不同体系不会通过标签拼接。</p><p>${esc(config.verification||'')}</p><p>矩阵中穗穗、守岸人、维里奈、卜灵、莫宁、白芷每期均可用 2 次；本期琳奈额外可用 2 次。切换到下一期后，琳奈恢复 1 次，固定六名角色仍可用 2 次。未设置自动换期日期，请在期次下拉框切换。漂泊者不同属性共享次数，同队仅能选择一种形态。</p></details></section><section class="tb-panel"><div class="tb-panel-head tb-saved-toolbar"><h2>暂存队伍 <small>${state.teams.length} 支</small></h2><div><button data-tb="import">导入</button><button data-tb="export" ${!state.teams.length&&!state.draft.length?'disabled':''}>导出 JSON</button><button data-tb="image" ${!state.teams.length?'disabled':''}>导出队伍图</button><button data-tb="clear-teams" ${!state.teams.length?'disabled':''}>清空</button></div></div><p class="tb-help">${state.matrix?'矩阵模式 · '+matrixPeriods[state.matrixPeriod].label+' · 固定六名角色各2次':'普通模式 · 每名角色只能用于一支暂存队伍'} · 已分配 ${Object.values(count).reduce((a,b)=>a+b,0)} 个位置</p>${conflicts.length?`<p class="tb-warning" role="alert">当前设置下超出次数：${conflicts.map(p=>esc(p.name)).join('、')}。已保留原队伍，请编辑队伍或核对矩阵期次。</p>`:''}${savedTeams()}</section></div></div>${initialMessage?`<p class="tb-warning" role="status">${esc(initialMessage)}</p>`:''}<div id="tb-message" class="tb-message" role="status" aria-live="polite"></div>${dialogHtml()}`;
  const list=root.querySelector('#tb-roster-list');if(list)list.scrollTop=rosterScroll;
  if(dialog){const box=root.querySelector('.tb-dialog');box?.focus();}
 }
 function message(s){const box=root?.querySelector('#tb-message');if(box)box.textContent=s;notify(s);}
 function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 async function exportImage(){
  const list=state.teams.map(t=>({...t,characters:[...t.characters]}));
  if(list.length>30){message('队伍图最多导出 30 队；更多队伍请使用 JSON 备份。');return;}
  message('正在生成队伍图…');
  try{
   const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=150+list.length*174;
   const ctx=canvas.getContext('2d');ctx.fillStyle='#0b111c';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#e7edf7';ctx.font='bold 34px sans-serif';ctx.fillText('白潮 · 我的配队',38,59);ctx.font='18px sans-serif';ctx.fillStyle='#a4b3c8';ctx.fillText(`${state.matrix?'矩阵模式 · '+matrixPeriods[state.matrixPeriod].label+' · 固定六名各2次':'普通模式'} · 共 ${list.length} 队 · ${new Date().toLocaleDateString('zh-CN')}`,40,98);
   const bitmapCache=new Map();
   for(let i=0;i<list.length;i++){
    const t=list[i],y=130+i*174;ctx.fillStyle='#151f2e';ctx.fillRect(30,y,1020,156);ctx.fillStyle='#83b8ff';ctx.font='bold 19px sans-serif';ctx.fillText(`${i+1}. ${t.name}`.slice(0,42),48,y+29);
    for(let j=0;j<3;j++){
     const p=chars.get(t.characters[j]),x=49+j*330;
     if(!bitmapCache.has(p.id)){
      const holder=document.createElement('div');holder.innerHTML=portrait(p);const src=holder.querySelector('img')?.getAttribute('src');
      if(src){const res=await fetch(src);if(res.ok)bitmapCache.set(p.id,await createImageBitmap(await res.blob()));}
     }
     const bm=bitmapCache.get(p.id);if(bm)ctx.drawImage(bm,x,y+43,85,85);
     ctx.fillStyle='#e7edf7';ctx.font='bold 21px sans-serif';ctx.fillText(p.name,x+97,y+79);ctx.fillStyle='#a4b3c8';ctx.font='17px sans-serif';ctx.fillText(primary(p),x+97,y+110);
    }
   }
   for(const bm of bitmapCache.values())bm.close?.();
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('图片生成失败');download(blob,'白潮配队.png');message('已导出队伍图。');
  }catch{message('队伍图导出失败，请重试或使用 JSON 备份。');}
 }
 async function click(e){
  const button=e.target.closest('[data-tb]');if(!button||button.disabled)return;const action=button.dataset.tb,id=button.dataset.id,i=Number(button.dataset.index);let feedback='';
  if(action==='pick'){if(state.draft.includes(id)){state.draft=state.draft.filter(selectedId=>selectedId!==id);feedback=`已取消选择${chars.get(id).name}`;}else{feedback=selectCharacter(state,id,chars);if(!feedback)feedback=`已加入${chars.get(id).name}`;}}
  else if(action==='edit')editing=!editing;
  else if(action==='matrix')state.matrix=!state.matrix;
  else if(action==='group')group=true;
  else if(action==='order')group=false;
  else if(action==='all')state.excluded=[];
  else if(action==='none')state.excluded=[...new Set(profiles.characters.map(p=>p.family))];
  else if(action==='available'){const family=chars.get(id).family;state.excluded=state.excluded.includes(family)?state.excluded.filter(x=>x!==family):[...state.excluded,family];}
  else if(action==='remove')state.draft.splice(i,1);
  else if(action==='left'||action==='right'){const j=i+(action==='left'?-1:1);if(j>=0&&j<state.draft.length)[state.draft[i],state.draft[j]]=[state.draft[j],state.draft[i]];}
  else if(action==='clear-draft')state.draft=[];
  else if(action==='save'){feedback=saveTeam(state,chars)||'队伍已暂存，可以继续选择下一队。';}
  else if(action==='delete-team'){state.teams.splice(i,1);feedback='已删除队伍并释放使用次数。';}
  else if(action==='edit-team'){
   if(state.draft.length){message('请先暂存或清空当前编队，再编辑其他队伍。');return;}
   state.draft=[...state.teams[i].characters];state.teams.splice(i,1);feedback='已移入当前编队，调整后重新暂存。';
  }
  else if(action==='import'||action==='clear-teams')dialog=action==='import'?'import':'clear';
  else if(action==='cancel-dialog')dialog='';
  else if(action==='confirm-clear'){state.teams=[];dialog='';feedback='已清空暂存队伍。';}
  else if(action==='confirm-import'){
   try{const incoming=parseState(JSON.parse(root.querySelector('#tb-import-text').value),profiles);state=incoming;dialog='';feedback='已导入配队及设置；旧版自定义次数与指定角色不会沿用，请核对矩阵期次及超额提示。';}
   catch(error){root.querySelector('#tb-import-error').textContent=error instanceof SyntaxError?'JSON 格式有误，请粘贴完整导出内容。':error.message;return;}
  }
  else if(action==='export'){download(new Blob([JSON.stringify({...state,exportedAt:new Date().toISOString()},null,2)],{type:'application/json'}),'白潮配队.json');message('已导出配队，可用于备份或换浏览器导入。');return;}
  else if(action==='image'){await exportImage();return;}
  persist();paint();if(feedback)message(feedback);
 }
 function change(e){const t=e.target;if(t.id==='tb-role')role=t.value;else if(t.id==='tb-element')element=t.value;else if(t.id==='tb-matrix-period'){if(!Object.hasOwn(matrixPeriods,t.value))return;state.matrixPeriod=t.value;}else return;persist();paint();}
 function input(e){if(e.target.id==='tb-search'){q=e.target.value;root.querySelector('#tb-roster-list').innerHTML=roster();}}
 function keydown(e){if(!dialog)return;if(e.key==='Escape'){dialog='';paint();return;}if(e.key==='Tab'){const nodes=[...root.querySelectorAll('.tb-dialog button,.tb-dialog textarea')];const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&(document.activeElement===first||document.activeElement===root.querySelector('.tb-dialog'))){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}
 return {
  mount(node,seed){if(root){root.removeEventListener('click',click);root.removeEventListener('change',change);root.removeEventListener('input',input);root.removeEventListener('keydown',keydown);}root=node;if(seed){const id=profiles.aliases[String(seed)];if(id&&!state.draft.includes(id)){const why=selectCharacter(state,id,chars);if(why)initialMessage=`未加入${chars.get(id).name}：${why}`;persist();}}root.addEventListener('click',click);root.addEventListener('change',change);root.addEventListener('input',input);root.addEventListener('keydown',keydown);paint();},
  getState:()=>JSON.parse(JSON.stringify(state))
 };
}
