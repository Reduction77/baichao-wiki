import {retryableResource,scriptResource,throwIfAborted,abortable} from './training-loaders.js?v=20261103-wiki1';
import {loadTrainingCatalog,refreshTrainingReview} from './training-text.js?v=20261103-wiki1';
import {weaponRankFromBadge} from './training-weapon.js';
import {chartRows,numericScore} from './training-core.js?v=20261103-wiki1';
const ROOT=new URL('./training/',import.meta.url);
const canvas=(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
async function bitmapData(blob,background=null,{maxPixels=Infinity,signal}={}){
 throwIfAborted(signal);const bm=await createImageBitmap(blob);
 try{throwIfAborted(signal);if(bm.width*bm.height>maxPixels)throw Error('图片像素过大，请使用压缩后的单列长图。');const c=canvas(bm.width,bm.height);if(background){c.getContext('2d').fillStyle=background;c.getContext('2d').fillRect(0,0,c.width,c.height);}c.getContext('2d').drawImage(bm,0,0);return c;}finally{bm.close();}
}
const templates=retryableResource(async()=>{
 const manifest=await fetch(new URL('../data/training-templates.json',import.meta.url));if(!manifest.ok)throw Error('头像模板加载失败，请重试。');
 const m=await manifest.json();
 return Promise.all(m.characters.map(async t=>{
  const response=await fetch(new URL('../'+t.src,import.meta.url));if(!response.ok)throw Error('头像图片加载失败，请重试。');
  const c=await bitmapData(await response.blob(),'#1e1e1e');
  try{return {...t,width:c.width,height:c.height,pixels:c.getContext('2d').getImageData(0,0,c.width,c.height).data.buffer};}finally{c.width=c.height=1;}
 }));
});
const tess=scriptResource(new URL('vendor/tesseract/tesseract.min.js',ROOT),()=>globalThis.Tesseract?.createWorker?globalThis.Tesseract:null);
function hsv(r,g,b){r/=255;g/=255;b/=255;const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;let h=0;if(d)h=(max===r?(g-b)/d+(g<b?6:0):max===g?(b-r)/d+2:(r-g)/d+4)*60;return {h,s:max?d/max:0,v:max};}
export function chainHint(ctx,width,y){
 const x=Math.round(width*.119),top=Math.round(y-width*.031),w=Math.max(3,Math.round(width*.04)),h=Math.max(2,Math.round(width*.018)),a=ctx.getImageData(x,top,w,h).data,colors=[];let neutral=0;
 for(let i=0;i<a.length;i+=4){const v=hsv(a[i],a[i+1],a[i+2]);if(v.s<.25&&v.v>.5)neutral++;if(v.s>.26&&v.v>.25)colors.push(v);}
 if(neutral>w*h*.65)return 0;if(colors.length<w*h*.12)return null;colors.sort((a,b)=>b.s-a.s);const c=colors.slice(0,Math.ceil(colors.length*.6));const med=k=>c.map(x=>x[k]).sort((a,b)=>a-b)[Math.floor(c.length/2)],hue=med('h');
 if(hue<30||hue>340)return 6;if(hue<80)return 5;if(hue>255&&hue<335)return 4;if(hue>=140&&hue<190)return 2;if(hue>=190&&hue<=255)return med('v')>.65?3:1;return null;
}
// Display only the three regions needed for review; keep the decoded source unchanged.
function rowCrops(source,y){
 const w=source.width;
 const crop=(left,top,right,bottom)=>{
  const x=Math.max(0,Math.floor(w*left)),sy=Math.max(0,Math.floor(y+w*top));
  const width=Math.min(source.width,Math.ceil(w*right))-x,height=Math.min(source.height,Math.ceil(y+w*bottom))-sy;
  const out=canvas(width,height);out.getContext('2d').drawImage(source,x,sy,width,height,0,0,width,height);
  return out.toDataURL('image/png');
 };
 return {avatar:crop(.05,-.06,.223,.049),score:crop(.219,-.038,.417,.036),weapon:crop(.724,-.037,.93,.045)};
}
export async function recognizeTrainingFile(file,{signal,onProgress=()=>{},onDiagnostic=()=>{}}={}){
 if(!file||file.size>15*1024*1024)throw Error('图片请控制在 15MB 以内。');if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('请选择 JPG、PNG 或 WebP 图片。');
 const recognitionStarted=performance.now();const c=await bitmapData(file,null,{maxPixels:16000000,signal});
 let vision,ocr;const abort=()=>{const v=vision,t=ocr;vision=null;ocr=null;v?.terminate();t?.terminate();};signal?.addEventListener('abort',abort,{once:true});
 try{throwIfAborted(signal);const rows=chartRows(c.width,c.height),ctx=c.getContext('2d');onProgress('加载本地识别组件…');const [bank,catalog]=await abortable(Promise.all([templates(),loadTrainingCatalog()]),signal);if(signal?.aborted)throw new DOMException('已取消','AbortError');
 vision=new Worker(new URL('recognizer.worker.js?v=20261103-wiki1',ROOT));const match=abortable(new Promise((resolve,reject)=>{vision.onmessage=({data})=>{if(data.type==='progress')onProgress(`${data.phase==='text'?'读取武器名称、链数与阶数':'识别角色头像'} ${Math.round(data.value*100)}%`);else if(data.type==='result'){resolve({rows:data.rows,timings:data.timings});}else if(data.type==='error')reject(Error('图像与文字识别失败：'+data.error));};vision.onerror=()=>reject(Error('头像识别组件未能启动，请重新识别。'));const pixels=ctx.getImageData(0,0,c.width,c.height).data.buffer;const hints=rows.map(r=>({...r,chainColor:chainHint(ctx,c.width,r.y),rankColor:weaponRankFromBadge(ctx.getImageData(Math.floor(c.width*.763),Math.floor(r.y+c.width*.023),Math.ceil(c.width*.784)-Math.floor(c.width*.763),Math.ceil(r.y+c.width*.034)-Math.floor(r.y+c.width*.023)).data)}));vision.postMessage({pixels,width:c.width,height:c.height,templates:bank,rows:hints,weapons:catalog.weapons},[pixels]);}),signal);
 const recognized=await match,identified=recognized.rows;vision?.terminate();vision=null;if(signal?.aborted)throw new DOMException('已取消','AbortError');const found=new Map(identified.filter(r=>r.score!==null).map(r=>[r.index,{score:r.score,confidence:r.scoreConfidence}]));
 const pending=identified.filter(r=>r.hasScore&&(r.score===null||r.scoreConfidence<80));
 onDiagnostic({identified});
 if(pending.length){
  onProgress('复核未读清的声骸评分…');const T=await abortable(tess(),signal);throwIfAborted(signal);
  ocr=await abortable(T.createWorker('eng',1,{workerPath:new URL('vendor/tesseract/worker.min.js',ROOT).href,corePath:new URL('vendor/tesseract/core/tesseract-core-simd-lstm.wasm.js',ROOT).href,langPath:new URL('vendor/tesseract/lang/',ROOT).href,workerBlobURL:false}).then(worker=>{if(signal?.aborted){worker.terminate();throwIfAborted(signal);}return worker;}),signal);throwIfAborted(signal);
  await abortable(ocr.setParameters({tessedit_pageseg_mode:'7',tessedit_char_whitelist:'0123456789.'}),signal);
  for(const row of pending){
   if(signal?.aborted)throw new DOMException('已取消','AbortError');
   const retry=canvas(240,72),rctx=retry.getContext('2d');rctx.fillStyle='#000';rctx.fillRect(0,0,240,72);rctx.drawImage(c,c.width*.289,row.y-c.width*.025,c.width*.128,c.width*.043,16,12,208,48);
   const pix=rctx.getImageData(0,0,240,72);for(let k=0;k<pix.data.length;k+=4){const v=255-Math.round(pix.data[k]*.299+pix.data[k+1]*.587+pix.data[k+2]*.114);pix.data[k]=pix.data[k+1]=pix.data[k+2]=v;}rctx.putImageData(pix,0,0);
   const rr=await abortable(ocr.recognize(retry,{}, {text:true}),signal).finally(()=>{retry.width=retry.height=1;}),value=numericScore(rr.data.text.trim()),current=found.get(row.index);
   if(value!==null&&value<=300&&(!current||rr.data.confidence>current.confidence))found.set(row.index,{score:value,confidence:rr.data.confidence});
  }
 }

 const output=identified.map(r=>{
  const sc=found.get(r.index);
  return refreshTrainingReview({...r,score:sc&&sc.score<=300?sc.score:null,scoreConfidence:sc?.confidence??0,selected:false,crops:rowCrops(c,r.y)});
 });
 if(!output.some(x=>x.confidence>.65))throw Error('未能可靠定位角色行，请使用完整的单列 ww练度图。');onProgress('识别完成，请核对后勾选需要导入的行；未读出的分数可留空或手动补录。');return {rows:output,width:c.width,height:c.height,scored:output.filter(x=>x.score!==null).length,weapons:catalog.weapons,timings:{...recognized.timings,numericRetries:pending.length,totalMs:performance.now()-recognitionStarted}};
 }finally{signal?.removeEventListener('abort',abort);abort();c.width=c.height=1;}
}
