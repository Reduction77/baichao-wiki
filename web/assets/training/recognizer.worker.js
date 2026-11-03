// Default-avatar matching and cropped-text OCR run locally in this worker.
// No full-image OCR, remote API, OpenCV runtime or weapon-art matching is used.
const gradeLexicon=['SSS','SS','S','A','B','C'].map(name=>({name,id:name}));
const base=new URL('.',self.location.href);
const maskCache=new Map();
function mask(size){if(!maskCache.has(size)){const a=[];for(let y=0;y<size;y++)for(let x=0;x<size;x++)if((x-size/2)**2+(y-size/2)**2<=(size*.35)**2)a.push(y*size+x);maskCache.set(size,a);}return maskCache.get(size);}
function sample(p,w,h,x,y){x=Math.max(0,Math.min(w-1,x));y=Math.max(0,Math.min(h-1,y));const x0=Math.floor(x),y0=Math.floor(y),x1=Math.min(w-1,x0+1),y1=Math.min(h-1,y0+1),fx=x-x0,fy=y-y0;const out=[];for(let c=0;c<3;c++)out.push((p[(y0*w+x0)*4+c]*(1-fx)+p[(y0*w+x1)*4+c]*fx)*(1-fy)+(p[(y1*w+x0)*4+c]*(1-fx)+p[(y1*w+x1)*4+c]*fx)*fy);return out;}
function patch(p,w,h,x,y,sw,sh,ow,oh){const out=new Float32Array(ow*oh*3);for(let yy=0;yy<oh;yy++)for(let xx=0;xx<ow;xx++){const v=sample(p,w,h,x+(xx+.5)*sw/ow-.5,y+(yy+.5)*sh/oh-.5),k=(yy*ow+xx)*3;out[k]=v[0];out[k+1]=v[1];out[k+2]=v[2];}return out;}
function vector(rgb,size){const m=mask(size),mean=[0,0,0],out=new Float32Array(m.length*3);for(const k of m)for(let c=0;c<3;c++)mean[c]+=rgb[k*3+c]/m.length;let norm=0,j=0;for(const k of m)for(let c=0;c<3;c++){const v=rgb[k*3+c]-mean[c];out[j++]=v;norm+=v*v;}norm=Math.sqrt(norm)||1;for(let k=0;k<out.length;k++)out[k]/=norm;return out;}
function dot(a,b){let s=0;for(let i=0;i<a.length;i++)s+=a[i]*b[i];return s;}
function templateArea(p,w,h,n){const out=new Float32Array(n*n*3);for(let y=0;y<n;y++)for(let x=0;x<n;x++){const x0=Math.floor(x*w/n),x1=Math.ceil((x+1)*w/n),y0=Math.floor(y*h/n),y1=Math.ceil((y+1)*h/n),count=(x1-x0)*(y1-y0);for(let yy=y0;yy<y1;yy++)for(let xx=x0;xx<x1;xx++)for(let c=0;c<3;c++)out[(y*n+x)*3+c]+=p[(yy*w+xx)*4+c]/count;}return out;}
function avatarBank(templates){const groups=new Map();for(const t of templates){if(!groups.has(t.src)){const p=new Uint8ClampedArray(t.pixels);groups.set(t.src,{...t,variants:[],small:vector(templateArea(p,t.width,t.height,16),16),fine:vector(templateArea(p,t.width,t.height,32),32)});}groups.get(t.src).variants.push({id:t.id,name:t.name,element:t.element,family:t.family});}return [...groups.values()];}
function identify(p,width,height,bank,row){
 const grids=(n,shift,scale=.1)=>{const a=[];for(const dy of [-shift,0,shift])for(const dx of [-shift,0,shift]){const x=width*(.0675+dx),y=row.y+width*(-.0375+dy),size=width*scale;a.push(vector(patch(p,width,height,x,y,size,size,n,n),n));}return a;};
 const coarse=grids(16,.004),fine=grids(32,.0025);
 let ranked=bank.map(t=>({t,score:Math.max(...coarse.map(v=>dot(v,t.small)))})).sort((a,b)=>b.score-a.score).slice(0,8).map(({t})=>({t,score:Math.max(...fine.map(v=>dot(v,t.fine)))})).sort((a,b)=>b.score-a.score);
 if(ranked[0].score<.72){const fallback=[...grids(32,.004,.095),...grids(32,.004,.105)];ranked=ranked.map(x=>({...x,score:Math.max(x.score,...fallback.map(v=>dot(v,x.t.fine)))})).sort((a,b)=>b.score-a.score);}
 const a=ranked[0],gap=a.score-(ranked[1]?.score??0),variants=a.t.variants;
 return {...row,candidates:ranked.slice(0,4).map(x=>({id:x.t.id,name:x.t.name,score:x.score})),confidence:a.score,gap,variants,id:a.score>=.69&&gap>=.025&&variants.length===1?variants[0].id:''};
}
function elementVector(p,w,h,row){const a=patch(p,w,h,w*.18,row.y-w*.028,w*.037,w*.036,12,12);const v=new Float32Array(144);let sum=0;for(let i=0;i<v.length;i++){v[i]=Math.max(0,Math.min(a[i*3],a[i*3+1],a[i*3+2])-145);sum+=v[i]*v[i];}sum=Math.sqrt(sum)||1;for(let i=0;i<v.length;i++)v[i]/=sum;return v;}
function resolveElements(rows,p,w,h){const bank=new Map();for(const r of rows){r.elementVector=elementVector(p,w,h,r);if(r.id&&r.confidence>.78&&r.gap>.08){const e=r.variants[0].element;if(!bank.has(e))bank.set(e,[]);bank.get(e).push(r.elementVector);}}
 for(const r of rows){if(r.variants.length<2||r.confidence<.69)continue;const candidates=r.variants.map(t=>({t,score:Math.max(-1,...(bank.get(t.element)||[]).map(v=>dot(v,r.elementVector)))})).sort((a,b)=>b.score-a.score);if(candidates[0].score>.7&&candidates[0].score-(candidates[1]?.score??-1)>.08)r.id=candidates[0].t.id;}
 for(const r of rows){delete r.elementVector;delete r.variants;}
}
function region(p,w,h,row,bounds){const [l,t,r,b]=bounds,x=Math.floor(l*w),y=Math.floor(row.y+t*w),rw=Math.ceil(r*w)-x,rh=Math.ceil(row.y+b*w)-y;return {pixels:patch(p,w,h,x,y,rw,rh,rw,rh),width:rw,height:rh};}
function trimName(a){let left=a.width,top=a.height,right=-1,bottom=-1;for(let y=0;y<a.height;y++)for(let x=0;x<a.width;x++){const k=(y*a.width+x)*3,r=a.pixels[k],g=a.pixels[k+1],b=a.pixels[k+2];if(r>145&&g>100&&r>b*1.35&&g>b*1.3){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}}
 if(right<left)return a;left=Math.max(0,left-2);top=Math.max(0,top-2);right=Math.min(a.width-1,right+2);bottom=Math.min(a.height-1,bottom+2);const width=right-left+1,height=bottom-top+1,pixels=new Float32Array(width*height*3);for(let y=0;y<height;y++)for(let x=0;x<width;x++)for(let c=0;c<3;c++)pixels[(y*width+x)*3+c]=a.pixels[((y+top)*a.width+x+left)*3+c];return {pixels,width,height};}
function resizeRGB(a,ow,oh){const rgba=new Uint8ClampedArray(a.width*a.height*4);for(let i=0;i<a.width*a.height;i++){rgba[i*4]=a.pixels[i*3];rgba[i*4+1]=a.pixels[i*3+1];rgba[i*4+2]=a.pixels[i*3+2];rgba[i*4+3]=255;}return patch(rgba,a.width,a.height,0,0,a.width,a.height,ow,oh);}
async function createOCR(){importScripts(new URL('vendor/onnx/ort.wasm.min.js',base).href);ort.env.wasm.numThreads=1;ort.env.wasm.wasmPaths=new URL('vendor/onnx/',base).href;ort.env.logLevel='error';const keys=await (await fetch(new URL('vendor/ocr/keys.json',base))).json();const session=await ort.InferenceSession.create(new URL('vendor/ocr/weapon-rec.onnx',base).href,{executionProviders:['wasm'],graphOptimizationLevel:'all'});return {keys,session};}
function greedy(result,keys){const data=result.data,classes=result.dims.at(-1),steps=result.dims.at(-2);let last=-1,text='',score=0,count=0;for(let t=0;t<steps;t++){let k=0;for(let j=1;j<classes;j++)if(data[t*classes+j]>data[t*classes+k])k=j;if(k&&k!==last){text+=keys[k]||'';score+=data[t*classes+k];count++;}last=k;}return {text:text.trim(),confidence:count?score/count:0};}
async function infer(ocr,a,mode='raw'){const ratio=a.width/a.height,cw=Math.ceil(48*ratio),iw=Math.max(96,cw),rgb=resizeRGB(a,cw,48),plane=48*iw,tensor=new Float32Array(3*plane);for(let y=0;y<48;y++)for(let x=0;x<cw;x++)for(let c=0;c<3;c++){const k=(y*cw+x)*3;let value=rgb[k+2-c];if(mode==='digits')value=255-(rgb[k]*.299+rgb[k+1]*.587+rgb[k+2]*.114);if(mode==='yellow'){const r=rgb[k],g=rgb[k+1],b=rgb[k+2];value=r>100&&g>70&&r>b*1.3&&g>b*1.2?0:255;}tensor[c*plane+y*iw+x]=value/127.5-1;}const input=new ort.Tensor('float32',tensor,[1,3,48,iw]);const out=await ocr.session.run({[ocr.session.inputNames[0]]:input});input.dispose();return out[ocr.session.outputNames[0]];}
self.onmessage=async({data})=>{let ocr;try{
 const started=performance.now(),p=new Uint8ClampedArray(data.pixels),bank=avatarBank(data.templates),rows=[];
 for(const row of data.rows){rows.push(identify(p,data.width,data.height,bank,row));self.postMessage({type:'progress',phase:'avatar',value:rows.length/data.rows.length});}
 resolveElements(rows,p,data.width,data.height);const avatarMs=performance.now()-started;
 const {ctcWeapon,badgeNumber}=await import(new URL('../training-text.js?v=20261103-review1',base));self.postMessage({type:'progress',phase:'text',value:0});ocr=await createOCR();const textStarted=performance.now();
 for(const [i,r]of rows.entries()){
  const name=trimName(region(p,data.width,data.height,r,[.785,-.022,.95,.009]));let pred=await infer(ocr,name),read=greedy(pred,ocr.keys),match=ctcWeapon(pred.data,pred.dims.at(-2),pred.dims.at(-1),ocr.keys,data.weapons);pred.dispose();
  if(!match.weapon){pred=await infer(ocr,name,'yellow');const retry=ctcWeapon(pred.data,pred.dims.at(-2),pred.dims.at(-1),ocr.keys,data.weapons);if(retry.weapon||retry.average>match.average){read=greedy(pred,ocr.keys);match=retry;}pred.dispose();}
  r.weaponId=match.weapon?.id??null;r.weaponName=match.weapon?.name??'';r.weaponRarity=match.weapon?.rarity??null;r.weaponText=read.text;
  for(const kind of ['chain','rank']){
   if(kind==='rank'&&r.weaponRarity!==5){r.refine=null;continue;}
   const a=region(p,data.width,data.height,r,kind==='chain'?[.119,-.035,.159,-.015]:[.758,.017,.798,.039]);
   const res=await infer(ocr,a),read=greedy(res,ocr.keys),lexicon=(kind==='chain'?['零链','一链','二链','三链','四链','五链','六链']:['1阶','2阶','3阶','4阶','5阶']).map((name,i)=>({name,id:String(kind==='chain'?i:i+1),wildcardSuffix:true}));
   const constrained=ctcWeapon(res.data,res.dims.at(-2),res.dims.at(-1),ocr.keys,lexicon);res.dispose();
   let value=constrained.weapon?Number(constrained.weapon.id):badgeNumber(read.text,kind),source=value===null?'':'text';
   const color=kind==='chain'?r.chainColor:r.rankColor;
   if(color!==null&&color!==undefined&&(value===null||value!==color)){value=color;source='color';}
   if(kind==='chain'){r.chain=value;r.chainSource=source;}else{r.refine=value;r.refineSource=source;}
  }
  const scoreRegion=region(p,data.width,data.height,r,[.289,-.025,.417,.018]);let white=0;for(let k=0;k<scoreRegion.pixels.length;k+=3){const v=scoreRegion.pixels.subarray(k,k+3);if(Math.max(...v)>145&&Math.max(...v)-Math.min(...v)<90)white++;}
  r.grade=null;r.gradeText='';r.hasScore=white>=Math.max(4,scoreRegion.width*scoreRegion.height*.03);r.score=null;r.scoreConfidence=0;
  if(r.hasScore){const res=await infer(ocr,scoreRegion,'digits'),read=greedy(res,ocr.keys);res.dispose();r.scoreText=read.text;const m=read.text.match(/^(\d{1,3}\.\d{2})\.*$/);if(m&&Number(m[1])<=300){r.score=Number(m[1]);r.scoreConfidence=read.confidence*100;}}
  if(r.hasScore){
   const res=await infer(ocr,region(p,data.width,data.height,r,[.228,-.032,.283,.030]));const read=greedy(res,ocr.keys),match=ctcWeapon(res.data,res.dims.at(-2),res.dims.at(-1),ocr.keys,gradeLexicon,{single:true,caseSensitive:true});r.grade=match.weapon?.id??(gradeLexicon.some(g=>g.id===read.text)&&read.confidence>=.6?read.text:null);r.gradeText=read.text;res.dispose();
   if(!r.grade){const retry=await infer(ocr,region(p,data.width,data.height,r,[.230,-.027,.279,.028])),again=greedy(retry,ocr.keys),matched=ctcWeapon(retry.data,retry.dims.at(-2),retry.dims.at(-1),ocr.keys,gradeLexicon,{single:true,caseSensitive:true});r.grade=matched.weapon?.id??(again.text===read.text&&gradeLexicon.some(g=>g.id===again.text)&&again.confidence>=.2&&read.confidence>=.2?again.text:null);retry.dispose();}
  }
  delete r.chainColor;delete r.rankColor;self.postMessage({type:'progress',phase:'text',value:(i+1)/rows.length});
 }
 await ocr.session.release();ocr=null;self.postMessage({type:'result',rows,timings:{avatarMs,textMs:performance.now()-textStarted}});
 }catch(e){self.postMessage({type:'error',error:String(e?.message||e)});}finally{if(ocr)await ocr.session.release();}
};
