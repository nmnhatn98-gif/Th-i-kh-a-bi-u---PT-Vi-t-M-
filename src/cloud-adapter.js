import {WriteGate,mergeFields} from './write-gate.js';
export function createCloudAdapter({request,getToken,pollMs=15000,setTimer=setInterval,clearTimer=clearInterval,shouldPoll=()=>true}){
 const gate=new WriteGate(),rows=new Map();
 const metadata={hasPendingWrites:false,fromCache:false};
 function makeRef(collection,id){return {collection,id,path:id===undefined?collection:`${collection}/${id}`};}
 function observe(ref,row){rows.set(ref.path,structuredClone(row));gate.observe(ref.path,row.data);}
 function snap(ref,row){return {ref,id:ref.id,metadata,exists:()=>row.data!==null,data:()=>structuredClone(row.data)};}
 async function call(path,options={}){const token=await getToken();if(!token)throw Object.assign(Error('Vui lòng đăng nhập Google.'),{code:'unauthenticated'});return request(path,{...options,headers:{...options.headers,Authorization:`Bearer ${token}`}});}
 async function getDoc(ref){const generation=gate.generation;const row=await call(`/api/data?${new URLSearchParams({collection:ref.collection,id:ref.id})}`);if(generation!==gate.generation)throw Object.assign(Error('Phiên đăng nhập đã thay đổi.'),{code:'auth-changed'});observe(ref,row);return snap(ref,row);}
 function onSnapshot(ref,next,error){
   const generation=gate.generation;let active=true,running=false,signature;
   const uri='/api/data?'+new URLSearchParams({collection:ref.collection,...(ref.id===undefined?{}:{id:ref.id})});
   async function tick(){if(!active||generation!==gate.generation||running||(signature!==undefined&&!shouldPoll()))return;running=true;try{
     const result=await call(uri);
     if(!active||generation!==gate.generation||result===undefined)return;
     const fingerprint=JSON.stringify(result);if(fingerprint===signature)return;signature=fingerprint;
     if(ref.id!==undefined){observe(ref,result);next(snap(ref,result));}
     else {const docs=result.records.map(row=>{const child=makeRef(ref.collection,row.id);observe(child,row);return snap(child,row);});next({docs,metadata});}
   }catch(e){if(active&&generation===gate.generation)error?.(e);}finally{running=false;}}
   tick();const timer=setTimer(tick,pollMs);return()=>{active=false;clearTimer(timer);};
 }
 async function mutate(ref,operation,data,options={}){
   const generation=gate.generation;if(!rows.has(ref.path))await getDoc(ref);
   if(generation!==gate.generation)throw Object.assign(Error('Phiên đăng nhập đã thay đổi.'),{code:'auth-changed'});
   const before=structuredClone(rows.get(ref.path));
   if(options.expectedRevision!==undefined&&(before.data?.revision||0)!==options.expectedRevision)throw Object.assign(Error('Lịch đã đổi trước khi bắt đầu lưu. Hãy tải lại để đối chiếu.'),{code:'conflict',status:409});
   const next=operation==='delete'?null:operation==='patch'||options.merge?mergeFields(before.data,data):data;
   let actual;
   const result=await gate.run(ref.path,next,async()=>{
    actual=await call('/api/data',{method:'POST',body:JSON.stringify({collection:ref.collection,id:ref.id,operation,data,merge:Boolean(options.merge),base:before.data,expectedVersion:before.version,...(options.expectedRevision===undefined?{}:{expectedRevision:options.expectedRevision})})});
    if(generation===gate.generation&&rows.get(ref.path)?.version===before.version)observe(ref,actual);
    return actual;
   });
   return {...result,row:actual||rows.get(ref.path)};
 }
 return {doc:(_db,collection,id)=>makeRef(collection,id),collection:(_db,name)=>makeRef(name),query:ref=>ref,where:(field,operator,value)=>({field,operator,value}),getDoc,onSnapshot,
  setDoc:(ref,data,options)=>mutate(ref,'set',data,options),updateDoc:(ref,data)=>mutate(ref,'patch',data),deleteDoc:ref=>mutate(ref,'delete'),
  saveWorkingDocument:(payload,expectedRevision)=>mutate(makeRef('timetables','working'),'set',payload,{expectedRevision}),
  reset(){gate.clear();rows.clear();},isWriting:()=>gate.busy,
  async backup(){return call('/api/backup');},async migrate(payload){return call('/api/migration',{method:'POST',body:JSON.stringify(payload)});}
 };
}
