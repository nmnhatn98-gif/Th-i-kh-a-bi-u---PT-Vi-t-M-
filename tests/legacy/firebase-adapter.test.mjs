import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {WriteGate,mergeFields} from '../src/write-gate.js';
import {isQuotaExhaustedError} from '../src/core.js';
function adapter(){
 let count=0,authCallback;const docs=new Map(),listeners=new Map();let fail=false;
 const snapshot=(ref,metadata={})=>({ref,metadata,exists:()=>docs.has(ref.path),data:()=>structuredClone(docs.get(ref.path))});
 const ctx={WriteGate,mergeFields,isQuotaExhaustedError,structuredClone,console, firebaseConfig:{},initializeApp:()=>({}),getAuth:()=>({}),getFirestore:()=>({}),GoogleAuthProvider:class{setCustomParameters(){}},signInWithPopup(){},fbSignOut(){},rawOnAuthStateChanged:(a,cb)=>{authCallback=cb;return ()=>{};},doc:(db,...parts)=>({path:parts.join('/')}),collection(){},query(){},where(){},rawGetDoc:async ref=>snapshot(ref),getDocFromServer:async ref=>snapshot(ref),rawOnSnapshot:(ref,cb)=>{listeners.set(ref.path,cb);return()=>listeners.delete(ref.path);},rawSetDoc:async(ref,data)=>{if(fail)throw Object.assign(Error('quota'),{code:'resource-exhausted'});count++;docs.set(ref.path,data);},rawUpdateDoc:async(ref,patch)=>{count++;docs.set(ref.path,{...docs.get(ref.path),...patch});},rawDeleteDoc:async ref=>{count++;docs.delete(ref.path);},runTransaction:async(db,cb,options)=>{assert.equal(options.maxAttempts,1);return cb({get:async ref=>snapshot(ref),set:(ref,data)=>{count++;docs.set(ref.path,data);}});}};
 let code=fs.readFileSync(new URL('../src/firebase.js',import.meta.url),'utf8').replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"];?/g,'').replace(/export\s*\{[\s\S]*?\};?/g,'').replace(/export /g,'');
 code+='\n globalThis.api={getDoc,setDoc,updateDoc,deleteDoc,onSnapshot,onAuthStateChanged,saveWorkingDocument,isQuotaExhausted};';vm.runInNewContext(code,ctx);
 return {...ctx.api,docs,snapshot,count:()=>count,emit:(ref,meta)=>listeners.get(ref.path)(snapshot(ref,meta)),auth:()=>authCallback?.(null),quota:()=>{fail=true;}};
}
test('real Firebase adapter: server baseline skips equal writes, pending snapshots do not',async()=>{
 const a=adapter(),ref={path:'users/a'};a.docs.set(ref.path,{note:'old'});a.onSnapshot(ref,()=>{});a.emit(ref,{fromCache:false,hasPendingWrites:false});await a.setDoc(ref,{note:'old',updatedAt:'new'});assert.equal(a.count(),0);
 a.docs.set(ref.path,{note:'new'});a.emit(ref,{hasPendingWrites:true});await a.setDoc(ref,{note:'new'});assert.equal(a.count(),1);
});
test('real Firebase adapter: exact revision conflict prevents a write',async()=>{
 const a=adapter();a.docs.set('timetables/working',{revision:5,note:'server'});
 await assert.rejects(a.saveWorkingDocument({note:'local'},4));assert.equal(a.count(),0);
 await a.saveWorkingDocument({note:'local'},5);assert.equal(a.count(),1);assert.equal(a.docs.get('timetables/working').revision,6);
});
test('real Firebase adapter: quota remains blocked after auth cache reset',async()=>{
 const a=adapter();a.onAuthStateChanged({},()=>{});a.quota();await assert.rejects(a.setDoc({path:'users/a'},{note:'new'}));a.auth();assert.equal(a.isQuotaExhausted(),true);await assert.rejects(a.deleteDoc({path:'users/a'}));assert.equal(a.count(),0);
});

