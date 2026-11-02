import {compactWorkingWrite} from './working-patch.js';
import {WriteGate,mergeFields} from './write-gate.js';
export function createCloudAdapter({request,getToken,pollMs=15000,setTimer=setInterval,clearTimer=clearInterval,shouldPoll=()=>true}){
 const gate=new WriteGate(),rows=new Map(),readers=new Set();
 const metadata={hasPendingWrites:false,fromCache:false};
 function makeRef(collection,id){return {collection,id,path:id===undefined?collection:`${collection}/${id}`};}
 function observe(ref,row){rows.set(ref.path,structuredClone(row));gate.observe(ref.path,row.data);}
 function snap(ref,row){return {ref,id:ref.id,metadata,exists:()=>row.data!==null,data:()=>structuredClone(row.data)};}
 async function call(path,options={}){let token=await getToken();if(!token)throw Object.assign(Error('Vui lòng đăng nhập Google.'),{code:'unauthenticated'});const send=()=>request(path,{...options,headers:{...options.headers,Authorization:`Bearer ${token}`}});try{return await send();}catch(e){if(e.status!==401||(options.method||'GET')!=='GET')throw e;token=await getToken(true);if(!token)throw e;return send();}}
 async function getDoc(ref){const generation=gate.generation;const row=await call(`/api/data?${new URLSearchParams({collection:ref.collection,id:ref.id})}`);if(generation!==gate.generation)throw Object.assign(Error('Phiên đăng nhập đã thay đổi.'),{code:'auth-changed'});observe(ref,row);return snap(ref,row);}
 function onSnapshot(ref,next,error){
   const generation=gate.generation;let active=true,running=false,signature;
   const uri='/api/data?'+new URLSearchParams({collection:ref.collection,...(ref.id===undefined?{}:{id:ref.id})});
   async function tick(){if(!active||generation!==gate.generation||running||(signature!==undefined&&!shouldPoll()))return;running=true;try{
     const result=await call(uri,{polling:true,conditional:signature!==undefined});
     if(!active||generation!==gate.generation||result===undefined)return;
       const fingerprint=JSON.stringify(result);if(fingerprint===signature)return;
     if(ref.id!==undefined){observe(ref,result);next(snap(ref,result));}
     else {const docs=result.records.map(row=>{const child=makeRef(ref.collection,row.id);observe(child,row);return snap(child,row);});next({docs,metadata});}
       signature=fingerprint;
   }catch(e){signature=undefined;if(active&&generation===gate.generation)error?.(e);}finally{running=false;}}
   const wake=()=>{if(typeof document==='undefined'||document.visibilityState!=='hidden')void tick();};
   const retry=()=>{signature=undefined;return tick();};readers.add(retry);
   if(typeof window!=='undefined'){window.addEventListener('online',wake);window.addEventListener('pageshow',wake);}
   if(typeof document!=='undefined')document.addEventListener('visibilitychange',wake);
   tick();const timer=setTimer(tick,pollMs);return()=>{active=false;clearTimer(timer);readers.delete(retry);if(typeof window!=='undefined'){window.removeEventListener('online',wake);window.removeEventListener('pageshow',wake);}if(typeof document!=='undefined')document.removeEventListener('visibilitychange',wake);};
 }
 async function mutate(ref,operation,data,options={}){
   const generation=gate.generation;if(!rows.has(ref.path))await getDoc(ref);
   if(generation!==gate.generation)throw Object.assign(Error('Phiên đăng nhập đã thay đổi.'),{code:'auth-changed'});
   const before=rows.get(ref.path); // Private cache entries are replaced, never mutated; keep the in-flight baseline.
   if(options.expectedRevision!==undefined&&(before.data?.revision||0)!==options.expectedRevision)throw Object.assign(Error('Lịch đã đổi trước khi bắt đầu lưu. Hãy tải lại để đối chiếu.'),{code:'conflict',status:409});
   const next=operation==='delete'?null:operation==='patch'||options.merge?mergeFields(before.data,data):data;
   let actual;
   const result=await gate.run(ref.path,next,async()=>{
    const compact=options.expectedRevision!==undefined&&operation==='set'?compactWorkingWrite(before.data,next):null;
    actual=await call('/api/data',{method:'POST',body:JSON.stringify({collection:ref.collection,id:ref.id,operation,data,merge:Boolean(options.merge),base:before.data,expectedVersion:before.version,...(options.expectedRevision===undefined?{}:{expectedRevision:options.expectedRevision}),...(compact||{}),returnReceipt:options.expectedRevision!==undefined})});
    if(actual.receipt){if(!Number.isSafeInteger(actual.version)||!actual.receipt.revision)throw Error('Phản hồi xác nhận lưu không hợp lệ.');actual={...actual,data:{...structuredClone(next),...actual.receipt}};}
    if(generation===gate.generation&&rows.get(ref.path)?.version===before.version)observe(ref,actual);
    return actual;
   });
   return {...result,row:actual||rows.get(ref.path)};
 }
 return {doc:(_db,collection,id)=>makeRef(collection,id),collection:(_db,name)=>makeRef(name),query:ref=>ref,where:(field,operator,value)=>({field,operator,value}),getDoc,onSnapshot,
  setDoc:(ref,data,options)=>mutate(ref,'set',data,options),updateDoc:(ref,data)=>mutate(ref,'patch',data),deleteDoc:ref=>mutate(ref,'delete'),
  saveWorkingDocument:(payload,expectedRevision)=>mutate(makeRef('timetables','working'),'set',payload,{expectedRevision}),
  reset(){gate.clear();rows.clear();},refresh(){return Promise.allSettled([...readers].map(retry=>retry()));},isWriting:()=>gate.busy,
  async backup(){return call('/api/backup');},async migrate(payload){return call('/api/migration',{method:'POST',body:JSON.stringify(payload)});}
 };
}
