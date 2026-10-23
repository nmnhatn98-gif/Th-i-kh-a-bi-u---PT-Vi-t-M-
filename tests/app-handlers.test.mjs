import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import * as core from '../src/core.js';import {SEED} from '../src/seed.js';import {contentSignature} from '../src/write-gate.js';
function appHarness(){
 let authNext,writes=0;const subscriptions=new Map(),queries=[],events={};
 const el={innerHTML:'',dataset:{},classList:{add(){},remove(){}},close(){},showModal(){},querySelector(){return el;},querySelectorAll(){return []}};
 const ctx={...core,SEED,contentSignature,structuredClone,console,Intl,Date,Map,Set,JSON,Blob,URL,setTimeout,clearTimeout,localStorage:{getItem:()=>null,setItem(){}},document:{querySelector:()=>el,querySelectorAll:()=>[],addEventListener:(type,fn)=>{(events[type]??=[]).push(fn);},createElement:()=>({...el,click(){}})},window:{addEventListener(){}},auth:{},db:{},googleProvider:{},onAuthStateChanged:(auth,next)=>{authNext=next;},doc:(db,...p)=>({path:p.join('/')}),collection:(db,p)=>({path:p}),fsQuery:(ref,where)=>{queries.push(where);return ref;},where:(...args)=>args,onSnapshot:(ref,cb)=>{subscriptions.set(ref.path,cb);return()=>subscriptions.delete(ref.path);},getDoc:async()=>({exists:()=>true}),setDoc:async()=>{writes++;},updateDoc:async()=>{writes++;},deleteDoc:async()=>{writes++;},saveWorkingDocument:async()=>{writes++;return{skipped:false};},isWriting:()=>false,isQuotaExhausted:()=>false,checkAndFlagQuotaError:()=>false,handleFirestoreError:e=>e,OperationType:{},testConnection(){},setQuotaExhausted(){},signInWithPopup(){},fbSignOut(){}};
 let source=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8').replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"];?/g,'').replace(/export /g,'');
 source=source.slice(0,source.lastIndexOf('testConnection().then('));source+='\nrender=()=>{};toast=()=>{};setSync=()=>{};handleAuthState();globalThis.api={syncWorkingToCloud,profile:()=>currentUserProfile};';
 vm.runInNewContext(source,ctx);return {api:ctx.api,login:async user=>authNext(user),subscriptions,queries,writes:()=>writes,emit:(path,data)=>{const ref={path};subscriptions.get(path)({ref,metadata:{},exists:()=>data!==null,data:()=>structuredClone(data)});}};
}
test('real app auth: inactive teacher becoming active starts own requests query',async()=>{
 const a=appHarness(),email='teacher@example.com';await a.login({email});
 a.emit('users/'+email,{email,role:'TEACHER',active:false});assert.equal(a.subscriptions.has('requests'),false);
 a.emit('users/'+email,{email,role:'TEACHER',active:true});assert.equal(a.subscriptions.has('requests'),true);assert.equal(JSON.stringify(a.queries),JSON.stringify([['teacherEmail','==',email]]));assert.equal(a.writes(),0);
 await a.login(null);assert.equal(a.subscriptions.size,0);assert.equal(a.api.profile(),null);
});
test('real app snapshots never seed or write back, unchanged save is zero writes',async()=>{
 const a=appHarness(),email='nmnhat.n98@gmail.com';await a.login({email});a.emit('users/'+email,{email,role:'OWNER',active:true});
 a.emit('timetables/working',null);assert.equal(a.writes(),0);
 const data={...structuredClone(SEED),revision:8,updatedAt:'2026-10-23T12:00:00Z',custom:'preserved'};
 for(let i=0;i<4;i++)a.emit('timetables/working',data);assert.equal(a.writes(),0);
 assert.equal(await a.api.syncWorkingToCloud(structuredClone(data)),true);assert.equal(a.writes(),0);
});

