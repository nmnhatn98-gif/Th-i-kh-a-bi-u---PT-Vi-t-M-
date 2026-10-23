import {authorizeRead,authorizeWrite,isAdmin,isScheduler,fail} from './policy.mjs';
import {mergeChanges} from './merge.mjs';
import {contentSignature,mergeFields} from '../src/write-gate.js';
import {validateState,normalizeState,findConflicts} from '../src/core.js';
import {isDeepStrictEqual as equal} from 'node:util';
const collections=['users','timetables','requests','availabilities'];
function validTarget(collection,id){if(!collections.includes(collection)||typeof id!=='string'||!id.length||id.length>180||/[\x00-\x1f/]/.test(id))throw fail(400,'Đường dẫn dữ liệu không hợp lệ.');}
export function createService({store,verifyToken,ownerEmail}){
 async function actorFor(token){const user=await verifyToken(token);if(user.email===ownerEmail)return {...user,role:'OWNER',active:true};const profile=(await store.get('users',user.email)).data;return {...user,role:profile?.role||'TEACHER',active:profile?.active===true};}
 function validate(collection,id,data){
   if(data===null)return;
   if(!data||typeof data!=='object'||Array.isArray(data))throw fail(400,'Nội dung lưu không hợp lệ.');
   if(collection==='timetables'&&id==='working')validateState(normalizeState(structuredClone(data)));
   if(collection==='timetables'&&id==='published'&&data.isPublished){if(!data.data)throw fail(400,'Thiếu lịch công bố.');const state=normalizeState(structuredClone(data.data));validateState(state);if(findConflicts(state).length)throw fail(409,'Lịch công bố còn trùng giáo viên.','conflict');}
 }
 return {
  async read(token,collection,id){const actor=await actorFor(token);authorizeRead(actor,collection,id);if(id!==undefined){validTarget(collection,id);const row=await store.get(collection,id);if(collection==='requests'&&!isScheduler(actor)&&row.data?.teacherEmail!==actor.email)throw fail(403,'Bạn chỉ được đọc yêu cầu của mình.');return row;}if(!collections.includes(collection))throw fail(400,'Danh mục không hợp lệ.');return {records:await store.list(collection,collection==='requests'&&!isScheduler(actor)?{email:actor.email}:{})};},
  async write(token,body){
   const actor=await actorFor(token),{collection,id,operation,data,base,expectedVersion}=body;
   validTarget(collection,id);if(!['set','patch','delete'].includes(operation)||!Number.isSafeInteger(expectedVersion)||expectedVersion<0)throw fail(400,'Yêu cầu lưu không hợp lệ.');
   for(let attempt=0;attempt<3;attempt++){
     const current=await store.get(collection,id);
     const reference=base===undefined?current.data:base;
     let next=operation==='delete'?null:operation==='patch'?mergeFields(reference,data):body.merge?mergeFields(reference,data):data;
     if(current.version!==expectedVersion){
       if(base===undefined)throw fail(409,'Dữ liệu đã đổi; hãy tải lại trước khi lưu.','conflict');
       next=mergeChanges(base,next,current.data);
     }
     authorizeWrite(actor,collection,id,current.data,next,ownerEmail);validate(collection,id,next);
     if(contentSignature(current.data)===contentSignature(next))return {...current,skipped:true};
     if(next){next={...next,updatedAt:new Date().toISOString(),updatedBy:actor.email};if(collection==='timetables'&&id==='working')next.revision=(current.data?.revision||0)+1;}
     try{return {...await store.cas(collection,id,next,current.version,actor.email),skipped:false};}catch(e){if(e.status!==409||attempt===2)throw e;}
   }
  },
  async backup(token){const actor=await actorFor(token);if(!isAdmin(actor))throw fail(403,'Chỉ quản trị được sao lưu toàn bộ dữ liệu.');const result={format:'tkb-hybrid-migration-v1',createdAt:new Date().toISOString(),collections:{}};for(const collection of collections)result.collections[collection]=(await store.list(collection)).map(({id,data})=>({id,data}));return result;},
  async migrate(token,backup){
   const actor=await actorFor(token);if(actor.email!==ownerEmail)throw fail(403,'Chỉ quản trị chính được nhập dữ liệu chuyển đổi.');
   if(backup?.format!=='tkb-hybrid-migration-v1'||!backup.collections||typeof backup.collections!=='object')throw fail(400,'Chọn tệp xuất toàn bộ dữ liệu chuyển đổi, không dùng tệp lịch đơn lẻ.');
   const records=[],seen=new Set();for(const collection of collections){const items=backup.collections[collection];if(!Array.isArray(items))throw fail(400,`Thiếu danh mục ${collection}.`);for(const item of items){validTarget(collection,item.id);if(seen.has(`${collection}/${item.id}`))throw fail(400,'Trùng tài liệu trong bản sao lưu.');seen.add(`${collection}/${item.id}`);validate(collection,item.id,item.data);if(!item.data||typeof item.data!=='object')throw fail(400,'Tài liệu chuyển đổi không hợp lệ.');if(collection==='users'&&(item.data.email!==item.id||!['OWNER','ADMIN','SCHEDULER','TEACHER'].includes(item.data.role)))throw fail(400,'Hồ sơ chuyển đổi không hợp lệ.');let imported=structuredClone(item.data);if(collection==='timetables'&&item.id==='working')imported=normalizeState(imported);if(collection==='timetables'&&item.id==='published'&&imported.data)imported.data=normalizeState(imported.data);records.push({collection,id:item.id,data:imported});}}
   if(!records.some(r=>r.collection==='timetables'&&r.id==='working'))throw fail(400,'Bản chuyển đổi thiếu lịch nháp toàn trường.');
   const owner=records.find(r=>r.collection==='users'&&r.id===ownerEmail);if(!owner||owner.data.role!=='OWNER'||owner.data.active!==true)throw fail(400,'Bản chuyển đổi phải giữ nguyên tài khoản quản trị chính.');
   const count=await store.import(records,actor.email);return {imported:count};
  }
 };
}
