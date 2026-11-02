import {PollEtags} from './poll-etags.js';
import {compressJsonBody} from './request-compression.js';
import {initializeApp} from 'firebase/app';
import {getAuth,GoogleAuthProvider,signInWithPopup,reauthenticateWithPopup,signOut as fbSignOut,onAuthStateChanged as rawOnAuthStateChanged} from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';
import {createCloudAdapter} from './cloud-adapter.js';
const app=initializeApp(firebaseConfig);
export const auth=getAuth(app),db={backend:'supabase'};
export const googleProvider=new GoogleAuthProvider();googleProvider.setCustomParameters({prompt:'select_account'});
const pollEtags=new PollEtags();
async function request(path,options){
 const {polling,conditional,...httpOptions}=options;const userId=auth.currentUser?.uid||'';
 const packed=await compressJsonBody(options.body);
 let response,data;
 const safeRead=(httpOptions.method||'GET')==='GET';
 for(let attempt=0;attempt<(safeRead?2:1);attempt++){
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
  try{
   response=await fetch(path,{...httpOptions,body:packed.body,headers:{'Content-Type':'application/json',...options.headers,...pollEtags.headers(path,{polling,conditional,userId}),...packed.headers},signal:controller.signal});
   if(response.status!==304)data=await response.json();
   break;
  }catch(error){
   const interrupted=controller.signal.aborted||error.name==='AbortError'||error.name==='TimeoutError'||error.code===20||error instanceof TypeError;
   if(!interrupted)throw error;
   if(attempt===0&&safeRead&&(typeof navigator==='undefined'||navigator.onLine!==false)){await new Promise(resolve=>setTimeout(resolve,500));continue;}
   throw Object.assign(Error('Kết nối bị gián đoạn. Hệ thống sẽ tự tải lại khi có mạng.'),{code:'unavailable',cause:error});
  }finally{clearTimeout(timeout);}
 }
 if(response.status===304)return undefined;
 if(response.ok)pollEtags.observe(path,{polling,userId,etag:response.headers.get('ETag')});
 if(!response.ok)throw Object.assign(Error(data.error||'Không kết nối được máy chủ.'),{code:data.code||String(response.status),status:response.status});
 return data;
}
const adapter=createCloudAdapter({request,getToken:force=>auth.currentUser?.getIdToken(force),shouldPoll:()=>typeof document==='undefined'||document.visibilityState!=='hidden'});
export const retryCloudReads=()=>adapter.refresh();
export const {doc,collection,query,where,getDoc,onSnapshot,setDoc,updateDoc,deleteDoc,isWriting,backup,migrate}=adapter;
export async function saveWorkingDocument(payload,revision){const result=await adapter.saveWorkingDocument(payload,revision);return {...result,mergedData:result.row?.data};}
export function onAuthStateChanged(a,next,error){return rawOnAuthStateChanged(a,user=>{adapter.reset();pollEtags.clear();next(user);},error);}
// Compatibility with the existing UI. This adapter never connects to Firestore.
export const isQuotaExhausted=()=>false,setQuotaExhausted=()=>{},checkAndFlagQuotaError=()=>false;
export const OperationType={GET:'get',LIST:'list',WRITE:'write'};
export function handleFirestoreError(error,operation,path){console.warn('Cloud operation failed',{code:error.code,operation,path});return error;}
export async function testConnection(){return fetch('/api/health').then(r=>r.json());}
export async function authorizeDrive(){
 if(!auth.currentUser)throw Error('Vui lòng đăng nhập trước.');
 const provider=new GoogleAuthProvider();provider.addScope('https://www.googleapis.com/auth/drive.file');
 const result=await reauthenticateWithPopup(auth.currentUser,provider);
 const token=GoogleAuthProvider.credentialFromResult(result)?.accessToken;if(!token)throw Error('Chưa được cấp quyền lưu Drive.');return token;
}
export {signInWithPopup,fbSignOut,GoogleAuthProvider};

export async function authorizeCalendar(){
 if(!auth.currentUser)throw Error('Vui lòng đăng nhập trước.');
 const provider=new GoogleAuthProvider();provider.addScope('https://www.googleapis.com/auth/calendar.events.owned');
 const result=await reauthenticateWithPopup(auth.currentUser,provider);
 const token=GoogleAuthProvider.credentialFromResult(result)?.accessToken;if(!token)throw Error('Chưa được cấp quyền Calendar.');return token;
}
export async function askScheduleAI(instruction){return request('/api/ai/suggest',{method:'POST',headers:{Authorization:'Bearer '+await auth.currentUser.getIdToken()},body:JSON.stringify({instruction})});}
