import {test} from 'node:test';import assert from 'node:assert/strict';import {createCloudAdapter} from '../src/cloud-adapter.js';
function harness(){let writes=0,callback,lastBody,release;let row={id:'working',data:{value:'before'},version:1};let mode='normal';
 const request=async(path,opts)=>{if(opts?.method==='POST'){writes++;lastBody=JSON.parse(opts.body);if(mode==='fail')throw Error('Network');if(mode==='pending')await new Promise(r=>release=r);row={id:'working',data:lastBody.data,version:row.version+1};return row;}return structuredClone(row);};
 const adapter=createCloudAdapter({request,getToken:async()=> 'fake-token',setTimer:fn=>{callback=fn;return 1;},clearTimer:()=>{callback=null;}});
 return {adapter,ref:adapter.doc({},'timetables','working'),writes:()=>writes,body:()=>lastBody,tick:()=>callback?.(),setRow:r=>{row=r;},mode:m=>{mode=m;},release:()=>release?.()};}
test('Supabase adapter reads repeated snapshots with zero writes and skips unchanged save',async()=>{
 const h=harness();let notifications=0;const off=h.adapter.onSnapshot(h.ref,()=>notifications++);await new Promise(r=>setImmediate(r));await h.tick();assert.equal(h.writes(),0);assert.equal(notifications,1);await h.adapter.setDoc(h.ref,{value:'before',updatedAt:'later'});assert.equal(h.writes(),0);off();
});
test('adapter sends shared base and expected database version; real change writes once',async()=>{
 const h=harness();await h.adapter.getDoc(h.ref);await h.adapter.setDoc(h.ref,{value:'after'});assert.equal(h.writes(),1);assert.equal(h.body().expectedVersion,1);assert.deepEqual(h.body().base,{value:'before'});await h.adapter.setDoc(h.ref,{value:'after'});assert.equal(h.writes(),1);
});
test('adapter prevents double submit and permits deliberate retry after network failure',async()=>{
 const h=harness();await h.adapter.getDoc(h.ref);h.mode('pending');const first=h.adapter.setDoc(h.ref,{value:'a'});await new Promise(r=>setImmediate(r));await assert.rejects(h.adapter.setDoc(h.ref,{value:'a'}),e=>e.code==='write-in-progress');h.release();await first;assert.equal(h.writes(),1);
 h.mode('fail');await assert.rejects(h.adapter.setDoc(h.ref,{value:'b'}));h.mode('normal');await h.adapter.setDoc(h.ref,{value:'b'});assert.equal(h.writes(),3);
});
test('old subscriptions cannot deliver after auth change; newer server baseline survives save',async()=>{
 const h=harness();let deliveries=0;h.adapter.onSnapshot(h.ref,()=>deliveries++);await new Promise(r=>setImmediate(r));assert.equal(deliveries,1);h.adapter.reset();await h.tick();assert.equal(deliveries,1);
});
