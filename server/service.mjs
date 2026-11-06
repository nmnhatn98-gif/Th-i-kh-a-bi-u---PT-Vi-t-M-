import {timetableWeek,addDays} from '../src/weekly-availability.js';
import {validateMenu} from '../src/weekly-menu-data.js';
import {teacherPublishedRow} from './teacher-published.mjs';
import {authorizeRead,authorizeWrite,isAdmin,isScheduler,fail} from './policy.mjs';
import {mergeChanges} from './merge.mjs';
import {contentSignature,mergeFields,sameContent} from '../src/write-gate.js';
import {validateState,normalizeState,findConflicts,assertDailySubjectRules,assertSessionAndRoboticsRules} from '../src/core.js';
import {isDeepStrictEqual as equal} from 'node:util';
const collections=['users','timetables','requests','availabilities'];
function validTarget(collection,id){if(!collections.includes(collection)||typeof id!=='string'||!id.length||id.length>180||/[\x00-\x1f/]/.test(id))throw fail(400,'Đường dẫn dữ liệu không hợp lệ.');}
export function createService({store,verifyToken,ownerEmail}){
 async function actorFor(token){const user=await verifyToken(token);if(user.email===ownerEmail)return {...user,role:'OWNER',active:true};const profile=(await store.get('users',user.email)).data;return {...user,role:profile?.role||'TEACHER',active:profile?.active===true};}
 function validate(collection,id,data){
   if(data===null)return;
   if(!data||typeof data!=='object'||Array.isArray(data))throw fail(400,'Nội dung lưu không hợp lệ.');
   if(collection==='timetables'&&id==='weekly_menu'){try{validateMenu(data);}catch(e){throw fail(400,e.message);}}
   if(collection==='timetables'&&id==='working'){const {changeHistory,versions,...schedule}=data;validateState(normalizeState({...structuredClone(schedule),versions}));}
   if(collection==='timetables'&&id==='published'&&data.isPublished){if(!data.data)throw fail(400,'Thiếu lịch công bố.');const state=normalizeState(structuredClone(data.data));validateState(state);assertDailySubjectRules(state);assertSessionAndRoboticsRules(state);if(findConflicts(state).length)throw fail(409,'Lịch công bố còn trùng giáo viên.','conflict');}
 }
 function historySnapshot(publication){
  if(!publication?.isPublished||!publication?.data)return null;
  const school=publication.data.school||{},start=timetableWeek(publication.data),week=Number(String(school.currentWeek||school.week||'').replace(/^Tuần\s*/iu,''));
  if(!start||start<'2026-11-02'||!Number.isInteger(week)||week<1||!school.year||!school.term)return null;
  const id='pubweek~'+[school.year,school.term,start].map(encodeURIComponent).join('~');
  const data={};for(const field of ['school','classes','subjects','teachers','timeSlots','timetableCells'])data[field]=structuredClone(publication.data[field]|| (field==='school'?{}:[]));
  return {id,data:{kind:'published-week',week,start,end:addDays(start,4),year:school.year,term:school.term,publishedAt:publication.publishedAt||'',publishedBy:publication.publishedBy||'',isPublished:true,data}};
 }
 async function preservePublication(publication,actor){
  const snapshot=historySnapshot(publication);if(!snapshot)return;
  for(let attempt=0;attempt<3;attempt++){const before=await store.get('timetables',snapshot.id);if(equal(before.data,snapshot.data)||Date.parse(before.data?.publishedAt)>Date.parse(snapshot.data.publishedAt))return;try{await store.cas('timetables',snapshot.id,snapshot.data,before.version,actor.email,before.data);return;}catch(e){if(e.status!==409||attempt===2)throw e;}}
 }
 const historyMeta=row=>({id:row.id,week:row.data.week,start:row.data.start,end:row.data.end,year:row.data.year,term:row.data.term,publishedAt:row.data.publishedAt});
 return {
  async read(token,collection,id){const actor=await actorFor(token);authorizeRead(actor,collection,id);if(id!==undefined){validTarget(collection,id);if(collection==='timetables'&&id==='publication_history'){
    const current=await store.get('timetables','published'),snapshot=historySnapshot(current.data),rows=store.listPublicationHistory?await store.listPublicationHistory(): (await store.list('timetables')).filter(r=>r.id.startsWith('pubweek~')).map(historyMeta);
    const items=new Map(rows.map(r=>[r.id,r]));if(snapshot)items.set(snapshot.id,{...historyMeta(snapshot),sourceId:'published'});
    return {id,version:0,data:{items:[...items.values()].sort((a,b)=>b.start.localeCompare(a.start))}};
   }
   if(collection==='timetables'&&id.startsWith('pubweek~')){const snapshot=historySnapshot((await store.get('timetables','published')).data);if(snapshot?.id===id)return {...snapshot,version:0};}
   const teacherPublished=collection==='timetables'&&id==='published'&&!isScheduler(actor);const row=teacherPublished&&store.getTeacherPublished?await store.getTeacherPublished():await store.get(collection,id);if(teacherPublished)return teacherPublishedRow(row);if(collection==='requests'&&!isScheduler(actor)&&row.data&&row.data.teacherEmail!==actor.email)throw fail(403,'Bạn chỉ được đọc yêu cầu của mình.');return row;}if(!collections.includes(collection))throw fail(400,'Danh mục không hợp lệ.');let records=await store.list(collection,collection==='requests'&&!isScheduler(actor)?{email:actor.email}:{});
   if(collection==='availabilities'){
    const profiles=await store.list('users');
    records=records.map(row=>{const profile=profiles.find(p=>p.id===row.id)?.data;return {...row,data:{...row.data,teacherEmail:row.id,teacherId:profile?.teacherId||'',active:profile?.active===true}};});
   }
   return {records};},
  async write(token,body){
   const actor=await actorFor(token),{collection,id,operation,data,base,expectedVersion}=body;
   validTarget(collection,id);if(!['set','patch','delete'].includes(operation)||!Number.isSafeInteger(expectedVersion)||expectedVersion<0)throw fail(400,'Yêu cầu lưu không hợp lệ.');
   for(let attempt=0;attempt<3;attempt++){
     const current=await store.get(collection,id);
     const reference=base===undefined?current.data:base;
     let next=operation==='delete'?null:operation==='patch'?mergeFields(reference,data):body.merge?mergeFields(reference,data):data;
     if(body.partialBase && !(collection==='timetables'&&id==='working'&&operation==='patch'&&base&&typeof base==='object'&&!Array.isArray(base)))throw fail(400,'Yêu cầu cập nhật rút gọn không hợp lệ.');
     if(body.partialBase&&current.version===expectedVersion&&Object.keys(data||{}).every(k=>!k.includes('.'))){next={...current.data,...data};}
     else if(current.version!==expectedVersion||body.partialBase){
       if(base===undefined)throw fail(409,'Dữ liệu đã đổi; hãy tải lại trước khi lưu.','conflict');
       next=mergeChanges(base,next,current.data);
     }
     authorizeWrite(actor,collection,id,current.data,next,ownerEmail);validate(collection,id,next);
     if(collection==='timetables'&&id==='working'&&next){if(findConflicts(next).some(group=>group.some(cell=>cell.isSubstitute)))throw fail(409,'Giáo viên dạy thay đã có lịch trùng tiết. Hãy chọn giáo viên hoặc khung giờ khác.','conflict');assertDailySubjectRules(next,next.timetableCells,current.data?.timetableCells||[]);assertSessionAndRoboticsRules(next,next.timetableCells,current.data?.timetableCells||[]);}
     if(sameContent(current.data,next))return {...current,skipped:true,receiptSafe:current.version===expectedVersion};
     if(next){next={...next,updatedAt:new Date().toISOString(),updatedBy:actor.email};if(collection==='timetables'&&id==='working')next.revision=(current.data?.revision||0)+1;}
     if(collection==='timetables'&&id==='published')await preservePublication(current.data,actor);
     try{return {...await store.cas(collection,id,next,current.version,actor.email,current.data),skipped:false,receiptSafe:current.version===expectedVersion};}catch(e){
      // A timed out CAS may have committed. Confirm with a fresh version read; never blindly resend it.
      if(e.status===503){try{const confirmed=await store.get(collection,id);if(sameContent(confirmed.data,next))return {...confirmed,skipped:false};}catch{}throw e;}
      if(e.status!==409||attempt===2)throw e;
     }
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
