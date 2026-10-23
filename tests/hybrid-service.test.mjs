import {test} from 'node:test';import assert from 'node:assert/strict';
import {mergeChanges} from '../server/merge.mjs';import {authorizeWrite,authorizeRead} from '../server/policy.mjs';
import {createService} from '../server/service.mjs';import {SEED} from '../src/seed.js';
const ownerEmail='owner@example.com';
class MemoryStore{
 constructor(){this.rows=new Map();this.writes=0;this.audit=[];}
 async get(c,id){return structuredClone(this.rows.get(c+'/'+id)||{id,data:null,version:0});}
 async list(c,{email}={}){return [...this.rows.entries()].filter(([k,r])=>k.startsWith(c+'/')&&(!email||r.data.teacherEmail===email)).map(([,r])=>structuredClone(r));}
 async cas(c,id,data,version,actor){const previous=structuredClone(this.rows.get(c+'/'+id)||{id,data:null,version:0});if(previous.version!==version)throw Object.assign(Error('race'),{status:409});const row={id,data,version:version+1};this.rows.set(c+'/'+id,structuredClone(row));this.writes++;this.audit.push(actor);return row;}
 async import(records){for(const r of records)this.rows.set(r.collection+'/'+r.id,{id:r.id,data:r.data,version:1});return records.length;}
}
function harness(){const store=new MemoryStore();return {store,service:createService({store,ownerEmail,verifyToken:async token=>{if(!token)throw Object.assign(Error('login'),{status:401});return{uid:token,email:token};}})};}
const teacher={email:'t@example.com',role:'TEACHER',active:true},admin={email:'a@example.com',role:'ADMIN',active:true};
test('three-way merge preserves independent cell edits and detects same-cell conflict',()=>{
 const base={timetableCells:[{id:'c1',classId:'a',timeSlotId:'s1',teacherId:'x'},{id:'c2',classId:'b',timeSlotId:'s1',teacherId:'y'}]};
 const local=structuredClone(base),remote=structuredClone(base);local.timetableCells[0].teacherId='z';remote.timetableCells[1].teacherId='w';
 const merged=mergeChanges(base,local,remote);assert.deepEqual(merged.timetableCells.map(c=>c.teacherId),['z','w']);remote.timetableCells[0].teacherId='different';assert.throws(()=>mergeChanges(base,local,remote),e=>e.status===409);
});
test('merge detects remove-vs-edit instead of dropping a cell',()=>{
 const base={cells:[{id:'1',note:'before'}]};assert.throws(()=>mergeChanges(base,{cells:[]},{cells:[{id:'1',note:'after'}]}),e=>e.status===409);
});
test('teacher cannot self-assign official rights even if the field was absent',()=>{
 const profile={email:teacher.email,role:'TEACHER',active:true};assert.throws(()=>authorizeWrite(teacher,'users',teacher.email,profile,{...profile,teacherId:'someone-else'},ownerEmail),e=>e.status===403);
 assert.doesNotThrow(()=>authorizeWrite(teacher,'users',teacher.email,profile,{...profile,selfDeclared:{subjects:['Math']}},ownerEmail));
});
test('teacher cannot approve own request or access draft/account listing',()=>{
 const previous={teacherEmail:teacher.email,status:'PENDING'};assert.throws(()=>authorizeWrite(teacher,'requests','1',previous,{...previous,status:'APPROVED'},ownerEmail),e=>e.status===403);assert.throws(()=>authorizeRead(teacher,'timetables','working'));assert.throws(()=>authorizeRead(teacher,'users',undefined));
});
test('admin cannot change OWNER or grant OWNER to another account',()=>{
 assert.throws(()=>authorizeWrite(admin,'users',ownerEmail,{}, {email:ownerEmail,role:'TEACHER',active:true},ownerEmail));assert.throws(()=>authorizeWrite(admin,'users','b@example.com',null,{email:'b@example.com',role:'OWNER',active:true},ownerEmail));
});
test('service scopes teacher request reads, including direct document lookup',async()=>{
 const {store,service}=harness();store.rows.set('users/'+teacher.email,{id:teacher.email,data:{...teacher},version:1});store.rows.set('requests/own',{id:'own',data:{teacherEmail:teacher.email,status:'PENDING'},version:1});store.rows.set('requests/other',{id:'other',data:{teacherEmail:'other@example.com',status:'PENDING'},version:1});
 const result=await service.read(teacher.email,'requests');assert.equal(result.records.length,1);await assert.rejects(service.read(teacher.email,'requests','other'),e=>e.status===403);assert.equal(store.writes,0);
});
test('service skips unchanged saves and stamps actual changes with verified actor',async()=>{
 const {store,service}=harness(),base={...structuredClone(SEED),revision:7};store.rows.set('timetables/working',{id:'working',data:base,version:1});
 const unchanged=await service.write(ownerEmail,{collection:'timetables',id:'working',operation:'set',base,expectedVersion:1,data:{...base,updatedAt:'client-fake'}});assert.equal(unchanged.skipped,true);assert.equal(store.writes,0);
 const changed=structuredClone(base);changed.school.name='Changed';changed.updatedBy='forged';const saved=await service.write(ownerEmail,{collection:'timetables',id:'working',operation:'set',base,expectedVersion:1,data:changed});assert.equal(saved.data.updatedBy,ownerEmail);assert.equal(saved.data.revision,8);assert.equal(store.writes,1);
});
test('service merges disjoint stale saves and never overwrites a same-field update',async()=>{
 const {store,service}=harness(),base={...structuredClone(SEED),revision:1};const remote=structuredClone(base);remote.school.term='HK2';store.rows.set('timetables/working',{id:'working',data:remote,version:2});const local=structuredClone(base);local.school.name='New school';
 const result=await service.write(ownerEmail,{collection:'timetables',id:'working',operation:'set',base,expectedVersion:1,data:local});assert.equal(result.data.school.term,'HK2');assert.equal(result.data.school.name,'New school');
 const conflicting=structuredClone(base);conflicting.school.term='HK3';await assert.rejects(service.write(ownerEmail,{collection:'timetables',id:'working',operation:'set',base,expectedVersion:1,data:conflicting}),e=>e.status===409);
});
test('migration rejects partial backup and teacher backup',async()=>{
 const {service}=harness();await assert.rejects(service.migrate(ownerEmail,{school:{}}),e=>e.status===400);await assert.rejects(service.migrate(ownerEmail,{format:'tkb-hybrid-migration-v1',collections:{users:[],timetables:[],requests:[],availabilities:[]}}),e=>e.status===400);
 await assert.rejects(service.backup('teacher@example.com'),e=>e.status===403);
});

test('scheduler may edit shared draft but cannot grant account rights',()=>{
 const actor={email:'scheduler@example.com',role:'SCHEDULER',active:true};
 assert.doesNotThrow(()=>authorizeWrite(actor,'timetables','working',{},structuredClone(SEED),ownerEmail));
 assert.throws(()=>authorizeWrite(actor,'users','other@example.com',null,{email:'other@example.com',role:'ADMIN',active:true},ownerEmail),e=>e.status===403);
 const inactive={...actor,active:false};
 assert.throws(()=>authorizeWrite(inactive,'timetables','working',{},structuredClone(SEED),ownerEmail),e=>e.status===403);
});

test('same cell changes conflict even when editors change different fields',()=>{
 const cell={id:'a',classId:'class-a',timeSlotId:'slot-a',teacherId:'t1',note:''};
 const base={timetableCells:[cell]};
 assert.throws(()=>mergeChanges(base,{timetableCells:[{...cell,teacherId:'t2'}]},{timetableCells:[{...cell,note:'remote note'}]}),e=>e.status===409);
});

test('concurrent service writes retry CAS and preserve both independent edits',async()=>{
 const {store,service}=harness(),base={...structuredClone(SEED),revision:1};
 store.rows.set('timetables/working',{id:'working',data:base,version:1});
 const a=structuredClone(base),b=structuredClone(base);a.school.name='Independent name';b.school.term='Independent term';
 const body=data=>({collection:'timetables',id:'working',operation:'set',base,expectedVersion:1,data});
 await Promise.all([service.write(ownerEmail,body(a)),service.write(ownerEmail,body(b))]);
 const saved=await store.get('timetables','working');
 assert.equal(saved.data.school.name,'Independent name');assert.equal(saved.data.school.term,'Independent term');assert.equal(saved.version,3);
});

