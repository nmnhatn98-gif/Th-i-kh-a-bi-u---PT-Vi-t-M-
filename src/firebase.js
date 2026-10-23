import {initializeApp} from 'firebase/app';
import {getAuth,GoogleAuthProvider,signInWithPopup,reauthenticateWithPopup,signOut as fbSignOut,onAuthStateChanged as rawOnAuthStateChanged} from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';
import {createCloudAdapter} from './cloud-adapter.js';
const app=initializeApp(firebaseConfig);
export const auth=getAuth(app),db={backend:'supabase'};
export const googleProvider=new GoogleAuthProvider();googleProvider.setCustomParameters({prompt:'select_account'});
async function request(path,options){
 const response=await fetch(path,{...options,headers:{'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(20000)});
 if(response.status===304)return undefined;
 const data=await response.json().catch(()=>({error:'Máy chủ trả về dữ liệu không hợp lệ.'}));
 if(!response.ok)throw Object.assign(Error(data.error||'Không kết nối được máy chủ.'),{code:data.code||String(response.status),status:response.status});
 return data;
}
const adapter=createCloudAdapter({request,getToken:()=>auth.currentUser?.getIdToken(),shouldPoll:()=>typeof document==='undefined'||document.visibilityState!=='hidden'});
export const {doc,collection,query,where,getDoc,onSnapshot,setDoc,updateDoc,deleteDoc,isWriting,backup,migrate}=adapter;
export async function saveWorkingDocument(payload,revision){const result=await adapter.saveWorkingDocument(payload,revision);return {...result,mergedData:result.row?.data};}
export function onAuthStateChanged(a,next,error){return rawOnAuthStateChanged(a,user=>{adapter.reset();next(user);},error);}
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
