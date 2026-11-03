// Share a successful load, but allow the same page to retry after any rejection.
export function retryableResource(load){
 let pending;
 return ()=>pending??=(async()=>load())().catch(error=>{pending=null;throw error;});
}
export function scriptResource(url,readReady,{document=globalThis.document,errorMessage='文字识别组件加载失败，请重试。'}={}){
 return retryableResource(()=>{
  const ready=readReady();if(ready)return ready;
  return new Promise((resolve,reject)=>{
   const script=document.createElement('script');script.src=String(url);
   const clean=()=>{script.onload=null;script.onerror=null;script.remove();};
   script.onload=()=>{const value=readReady();clean();value?resolve(value):reject(Error(errorMessage));};
   script.onerror=()=>{clean();reject(Error(errorMessage));};
   document.head.append(script);
  });
 });
}

export const abortError=()=>new DOMException('已取消','AbortError');
export function throwIfAborted(signal){if(signal?.aborted)throw abortError();}
export function abortable(promise,signal){
 if(!signal)return Promise.resolve(promise);
 return new Promise((resolve,reject)=>{
  const stop=()=>{signal.removeEventListener('abort',stop);reject(abortError());};
  signal.addEventListener('abort',stop,{once:true});
  Promise.resolve(promise).then(value=>{signal.removeEventListener('abort',stop);resolve(value);},error=>{signal.removeEventListener('abort',stop);reject(error);});
  if(signal.aborted)stop();
 });
}
