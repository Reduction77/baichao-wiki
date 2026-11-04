import {ECHO_GRADES,loadTrainingCatalog,reconcileTrainingWeapon,isLowWeapon,refreshTrainingReview} from './training-text.js?v=20261103-wiki1';
import {esc} from './core.js?v=20261103-wiki1';
import {applyTraining,undoTraining,TRAINING_BACKUP,readTraining,restoreTrainingBackup} from './training-core.js?v=20261103-wiki1';
export function createTrainingImport({profiles,storage,builderKey,getState,onApplied,host}){
 let cancel,dialog,result=null,busy=false,disposed=false,runId=0,applyIntent=false,applyMessage='',applyError=false,lastFile=null,attention=new Map();
 const say=s=>{const n=dialog?.querySelector('[data-training-status]');if(n)n.textContent=s;};
 function close(){attention.clear();lastFile=null;runId++;applyIntent=false;applyMessage='';applyError=false;cancel?.abort();dialog?.close();dialog?.remove();dialog=null;result=null;busy=false;}
 function applicationMessage(message,error=false,targets=[]){
  applyMessage=message;applyError=error;say(message);
  if(targets.length){
   attention=new Map(targets.map(t=>[t.index,t]));paint();
   for(const {index}of targets){const group=dialog.querySelector(`[data-training-row="${index}"]`)?.closest('[data-training-group]');if(group)group.open=true;}
   const first=targets[0],target=dialog.querySelector(`[data-training-row="${first.index}"] [data-training-field="${first.field}"]`),currentDialog=dialog;
   if(target)requestAnimationFrame(()=>{if(dialog!==currentDialog||!dialog.contains(target))return;target.focus({preventScroll:true});target.scrollIntoView({block:'center',inline:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});});
   return;
  }
  const n=dialog?.querySelector('[data-training-apply-status]');if(n){n.textContent=message;n.classList.toggle('is-error',error);n.setAttribute('role',error?'alert':'status');n.scrollIntoView({block:'nearest'});}
 }
 function apply(){
  if(busy){applicationMessage('请等待当前识别完成。');return;}
  const rows=result?.rows;if(!rows){applicationMessage('请先导入练度图片。',true);return;}
  attention.clear();
  if(!rows.some(r=>r.selected)){applicationMessage('请至少勾选一名已核对的角色。',true,rows.length?[{index:0,field:'selected',hint:'请勾选要导入的角色。'}]:[]);return;}
  const known=new Set(profiles.characters.map(p=>p.id)),seen=new Map();
  for(const [i,r]of rows.entries()){
   if(!r.selected)continue;
   if(!known.has(r.id)){applicationMessage(`第 ${i+1} 行尚未选择角色，请补选角色或取消勾选该行。`,true,[{index:i,field:'id',hint:'请选择角色，或取消勾选此行。'}]);return;}
   if(seen.has(r.id)){applicationMessage(`第 ${seen.get(r.id)+1}、${i+1} 行选择了同一个角色，请只保留一行。`,true,[i,seen.get(r.id)].map(index=>({index,field:'id',hint:'角色重复，请改选或取消勾选其中一行。'})));return;}
   seen.set(r.id,i);
  }
  try{const x=applyTraining(storage,builderKey,getState(),rows,profiles,dialog.querySelector('[data-training-mode]').value,result.weapons);close();onApplied(x.builder,`已导入 ${x.count} 名角色，可撤销本次导入。`);}catch(e){applicationMessage(e.message||'应用失败，请重试。',true);}
 }
 function options(value,low,high){return `<option value="">待核对</option>`+Array.from({length:high-low+1},(_,i)=>`<option value="${i+low}" ${Number(value)===i+low&&value!==null?'selected':''}>${i+low}</option>`).join('');}
 function saveGroupState(){
  if(!result)return;
  result.groups??={recognized:false,pending:true};result.scrolls??={};
  for(const node of dialog.querySelectorAll('[data-training-group]')){
   const key=node.dataset.trainingGroup,wrap=node.querySelector('.training-table-wrap');result.groups[key]=node.open;
   if(wrap)result.scrolls[key]={top:wrap.scrollTop,left:wrap.scrollLeft};
  }
 }
 function rowHtml(r,i){
  const character=profiles.characters.find(p=>p.id===r.id),issue=attention.get(i);
  const issueAttrs=field=>issue?.field===field?`aria-invalid="true" aria-describedby="training-row-error-${i}"`:"";
  const weaponValue=r.weaponRarity===5?(r.weaponId||'five'):isLowWeapon(r)?'low':'';
  return `<tr class="${r.review?'training-review':''} ${issue?'training-attention':''}" data-training-row="${i}">
   <td><input type="checkbox" data-training-field="selected" data-row="${i}" aria-label="确认第${i+1}行" ${issueAttrs('selected')} ${r.selected?'checked':''}><small class="training-row-status">${r.selected?'已核对':r.review?'待核对':'已识别'}</small>${issue?.field==='selected'?`<small class="training-row-error" id="training-row-error-${i}">${esc(issue.hint)}</small>`:''}</td>
   <td><div class="training-crops"><img class="training-crop-avatar" src="${r.crops.avatar}" alt="第${i+1}行头像及共鸣链"><img class="training-crop-score" src="${r.crops.score}" alt="第${i+1}行原图分数"><img class="training-crop-weapon" src="${r.crops.weapon}" alt="第${i+1}行原图武器及阶数"></div></td>
   <td><select data-training-field="id" data-row="${i}" aria-label="第${i+1}行角色" ${issueAttrs('id')}><option value="">选择角色</option>${profiles.characters.map(p=>`<option value="${p.id}" ${p.id===r.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select>${!r.id?`<small>${r.candidates.slice(0,2).map(c=>esc(c.name)).join(' / ')}</small>`:''}${issue?.field==='id'?`<small class="training-row-error" id="training-row-error-${i}">${esc(issue.hint)}</small>`:''}</td>
   <td><select data-training-field="grade" data-row="${i}" aria-label="第${i+1}行声骸评级"><option value="">待核对评级</option>${ECHO_GRADES.map(g=>`<option value="${g}" ${r.grade===g?'selected':''}>${g}</option>`).join('')}</select><input type="number" step="0.01" min="0" max="999.99" data-training-field="score" data-row="${i}" aria-label="第${i+1}行评分" value="${r.score??''}" placeholder="未读出"></td>
   <td><select data-training-field="chain" data-row="${i}" aria-label="第${i+1}行共鸣链">${options(r.chain,0,6)}</select>${r.chain===null?'<small>链数未读出</small>':''}</td>
   <td><select data-training-field="weaponId" data-row="${i}" aria-label="第${i+1}行武器"><option value="">选择武器</option><option value="low" ${weaponValue==='low'?'selected':''}>低星武器</option><option value="five" ${weaponValue==='five'?'selected':''}>五星武器（未指定）</option>${(result.weapons||[]).filter(w=>w.rarity===5&&character&&Number(w.type)===Number(character.weapon)).map(w=>`<option value="${w.id}" ${weaponValue===w.id?'selected':''}>${esc(w.name)}</option>`).join('')}</select><select data-training-field="refine" data-row="${i}" aria-label="第${i+1}行精炼" ${r.weaponRarity!==5?'disabled':''}>${r.weaponRarity===5?options(r.refine,1,5):`<option value="">${isLowWeapon(r)?'低星跳过':'先确认武器'}</option>`}</select>${r.weaponIssue?`<small class="training-weapon-issue">${esc(r.weaponIssue)}</small>`:''}${r.weaponRarity===null&&r.weaponText?`<small>未匹配：${esc(r.weaponText)}</small>`:''}</td>
  </tr>`;
 }
 function groupHtml(item,key,review){
  // Retain original row indices: grouped order must never change which record is edited/applied.
  const entries=item.rows.map((r,i)=>({r,i})).filter(({r})=>Boolean(r.review)===review);
  return `<details class="training-group training-group-${key}" data-training-group="${key}" ${item.groups[key]?'open':''}><summary><span class="training-group-title"><strong>${review?'待核对':'已识别'}</strong><span class="training-group-count">${entries.length}</span></span><span class="compare-chevron" aria-hidden="true"></span></summary>${review&&entries.length?`<div class="training-pending-actions"><button type="button" data-training-select-pending ${entries.every(({r})=>r.selected)?'disabled':''}>一键核对</button><span>勾选本组全部条目，缺失资料不会自动猜填。</span></div>`:''}${entries.length?`<div class="training-table-wrap"><table class="training-table"><thead><tr><th>已核对</th><th>原图局部</th><th>角色</th><th>声骸评级与评分</th><th>共鸣链</th><th>武器与阶数</th></tr></thead><tbody>${entries.map(({r,i})=>rowHtml(r,i)).join('')}</tbody></table></div>`:`<p class="training-group-empty">${review?'没有需要核对的条目':'暂无已识别的条目'}</p>`}</details>`;
 }
 function paint(){
  const focused=document.activeElement,focusKey=focused?.closest('[data-training-row]')?{row:focused.dataset.row,field:focused.dataset.trainingField}:null;
  saveGroupState();
  const table=dialog.querySelector('[data-training-results]'),item=result;if(!item){table.innerHTML='';return;}
  item.groups??={recognized:false,pending:true};
  const rows=item.rows.map(refreshTrainingReview),mode=dialog.querySelector('[data-training-mode]')?.value||'append';
  table.innerHTML=`<p class="training-image-name">${esc(item.fileName)}</p><div class="training-selection"><button type="button" data-training-select-clear>勾选已识别的行</button><button type="button" data-training-select-none>取消全部勾选</button><span>已识别默认勾选，仍需点击应用。</span></div><p>${rows.length} 行 · 已读到 ${item.scored} 项评分 · ${rows.filter(r=>r.review).length} 行待核对。本次仅应用这一张图片。</p>${groupHtml(item,'recognized',false)}${groupHtml(item,'pending',true)}<div class="training-apply"><label>导入方式 <select data-training-mode><option value="append" ${mode==='append'?'selected':''}>补充现有资料</option><option value="replace" ${mode==='replace'?'selected':''}>替换练度资料</option></select></label><p>本次勾选的角色设为可用，其他角色设为不可用。补充模式保留已有有效值，替换模式使用本次资料。暂存队伍、当前编队和收藏会保留。</p><p data-training-apply-status role="${applyError?'alert':'status'}" aria-live="polite" class="${applyError?'is-error':''}">${esc(applyMessage)}</p><button type="button" class="button primary" data-training-apply ${busy?'disabled':''}>应用已核对的角色</button></div>`;
  for(const node of table.querySelectorAll('[data-training-group]')){const view=item.scrolls?.[node.dataset.trainingGroup],wrap=node.querySelector('.training-table-wrap');if(view&&wrap){wrap.scrollTop=view.top;wrap.scrollLeft=view.left;}}
  if(focusKey){const next=table.querySelector(`[data-row="${focusKey.row}"][data-training-field="${focusKey.field}"]`);if(next?.closest('details')?.open)next.focus({preventScroll:true});}
 }
 async function run(files){
  if(busy||!files.length)return;if(files.length!==1){say('一次只能导入一张图片，请重新选择。');return;}
  busy=true;attention.clear();lastFile=files[0];applyMessage='';applyError=false;const currentDialog=dialog,controller=new AbortController(),id=++runId;cancel=controller;
  const current=()=>id===runId&&dialog===currentDialog&&!controller.signal.aborted;
  const start=performance.now();currentDialog.querySelector('[data-training-files]').disabled=true;const retryButton=currentDialog.querySelector('[data-training-retry]');retryButton.hidden=true;retryButton.disabled=true;result=null;currentDialog.querySelector('[data-training-results]').replaceChildren();
  try{
   const {recognizeTrainingFile}=await import('./training-recognizer.js?v=20261103-wiki1');if(!current())return;
   const recognized=await recognizeTrainingFile(files[0],{signal:controller.signal,onProgress:s=>{if(current())say(s);}});
   if(!current())return;
   for(const row of recognized.rows){reconcileTrainingWeapon(row,profiles,recognized.weapons);refreshTrainingReview(row);row.selected=!row.review;}
   result={...recognized,fileName:files[0].name};paint();
   say(`识别完成，耗时 ${Math.round((performance.now()-start)/1000)} 秒。已识别的行已默认勾选，请核对后应用。`);
  }catch(e){if(current()&&e.name!=='AbortError'){say(e.message||'识别失败，请重试。');retryButton.hidden=false;}}
  finally{if(current()){busy=false;currentDialog.querySelector('[data-training-files]').disabled=false;currentDialog.querySelector('[data-training-files]').value='';retryButton.disabled=false;const button=currentDialog.querySelector('[data-training-apply]');if(button)button.disabled=false;}}
 }
 function open(initialFiles=[]){if(disposed)return;if(dialog){dialog.showModal();return;}host.querySelector('[data-training-empty]')?.remove();dialog=document.createElement('dialog');dialog.className='training-dialog';dialog.setAttribute('aria-label','导入练度图');dialog.innerHTML=`<div class="training-dialog-head"><div><span class="pill">浏览器本地识别</span><h2>导入练度图</h2></div><button type="button" data-training-close aria-label="关闭练度导入">×</button></div><p>每次选择一张完整的单列「ww练度」长图。图片只在当前设备处理；所有结果先核对、再应用。</p><p class="training-note">头像按默认外观匹配，武器按名称查库。非五星统一为低星，不读取阶数；缺失的资料可手动补齐，补齐后归入已识别。</p><label class="training-file">选择练度图片<input data-training-files type="file" accept="image/jpeg,image/png,image/webp"></label><p data-training-status role="status" aria-live="polite">首次识别会加载本地模型，后续可使用浏览器缓存。</p><button type="button" data-training-retry hidden>重新识别</button><div data-training-results></div><div class="training-dialog-foot"><button type="button" data-training-close>关闭 / 取消识别</button></div>`;document.body.append(dialog);dialog.showModal();dialog.addEventListener('cancel',e=>{e.preventDefault();close();});dialog.addEventListener('pointerdown',e=>{applyIntent=Boolean(e.target.closest('[data-training-apply]'));});dialog.addEventListener('keydown',()=>{applyIntent=false;});dialog.addEventListener('input',e=>{const t=e.target;if(t.dataset.trainingField==='score'){const row=result?.rows[Number(t.dataset.row)];if(row)row.score=t.value===''?null:Number(t.value);}});dialog.addEventListener('change',e=>{
 const t=e.target;if(t.hasAttribute('data-training-files')){run(t.files);return;}
 if(!t.dataset.trainingField)return;attention.clear();const row=result?.rows[Number(t.dataset.row)];if(!row)return;const wasReview=row.review,field=t.dataset.trainingField;
 if(field==='weaponId'){
  const previousId=row.weaponId,w=(result.weapons||[]).find(w=>w.id===t.value);row.weaponId=w?.id??null;row.weaponName=w?.name??'';row.weaponRarity=w?.rarity??(t.value==='low'?0:t.value==='five'?5:null);if(row.weaponRarity!==5||(previousId&&previousId!==row.weaponId))row.refine=null;
 }else row[field]=t.type==='checkbox'?t.checked:t.value===''?null:['id','grade'].includes(field)?t.value:Number(t.value);
 if(field==='id'||field==='weaponId')reconcileTrainingWeapon(row,profiles,result.weapons);refreshTrainingReview(row);applyMessage='';applyError=false;if(!applyIntent)paint();if(wasReview&&!row.review)say('资料已补齐，已移至“已识别”。');
 });dialog.addEventListener('click',e=>{const t=e.target.closest('button');if(!t)return;if(t.hasAttribute('data-training-close'))close();else if(t.hasAttribute('data-training-select-clear')){attention.clear();for(const r of result.rows)if(!r.review)r.selected=true;paint();}else if(t.hasAttribute('data-training-select-pending')){attention.clear();const rows=result.rows.filter(r=>r.review);for(const r of rows)r.selected=true;paint();say(rows.some(r=>!r.id)?'已勾选待核对条目。请为未选定角色的行补选角色，再点击应用。':'已勾选待核对条目，点击应用后保存；补充模式保留已有有效值。');}else if(t.hasAttribute('data-training-select-none')){attention.clear();for(const r of result.rows)r.selected=false;paint();}else if(t.hasAttribute('data-training-retry')){if(lastFile)run([lastFile]);}else if(t.hasAttribute('data-training-apply')){apply();applyIntent=false;}});if(initialFiles.length)run(initialFiles);}
 function undo(){try{if(!confirm('撤销上次练度导入？将恢复导入前的可用角色名单和练度资料；当前编队与暂存队伍保留。'))return;const next=undoTraining(storage,builderKey,getState());onApplied(next,'已撤销上次练度导入，可用角色名单和练度资料已恢复。');}catch(e){onApplied(null,e.message);}}
 async function restoreFile(file){if(!file||file.size>1024*1024){onApplied(null,'备份文件过大。');return;}try{const data=JSON.parse(await file.text());if(!confirm('恢复备份会替换当前工作台的编队、可用角色和练度资料。是否继续？'))return;const next=restoreTrainingBackup(storage,builderKey,data,profiles,(await loadTrainingCatalog()).weapons);onApplied(next,'练度与配队备份已恢复。');}catch(e){onApplied(null,e.message||'备份无法读取。');}}
 function restore(){const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.onchange=()=>restoreFile(input.files[0]);input.click();}
 function exportData(){const data={schema:1,training:readTraining(storage),builder:getState()};const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.href=url;a.download='白潮练度与配队备份.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 return {open,undo,exportData,restore,dispose(){disposed=true;close();}};
}
