import {isDeepStrictEqual as equal} from 'node:util';
export const fail=(status,message,code)=>Object.assign(Error(message),{status,code:code||String(status)});
export function isAdmin(actor){return actor.active&&(actor.role==='OWNER'||actor.role==='ADMIN');}
export function isScheduler(actor){return isAdmin(actor)||(actor.active&&actor.role==='SCHEDULER');}
export function authorizeRead(actor,collection,id){
 if(collection==='users'&&id===actor.email)return;
 if(!actor.active)throw fail(403,'Tài khoản chưa được cấp quyền.');
 if(collection==='users'&&(isAdmin(actor)||(id&&isScheduler(actor))))return;
 if(collection==='timetables'&&(id==='published'||(id==='working'&&isScheduler(actor))))return;
 if(collection==='requests'||(collection==='availabilities'&&(id===actor.email||isScheduler(actor))))return;
 throw fail(403,'Bạn không có quyền đọc dữ liệu này.');
}
export function authorizeWrite(actor,collection,id,previous,next,ownerEmail){
 if(collection==='users'){
   if(next===null){if(actor.role==='OWNER'&&actor.active&&id!==ownerEmail&&id!==actor.email)return;throw fail(403,'Không thể xóa tài khoản này.');}
   if(next.email!==id||!['OWNER','ADMIN','SCHEDULER','TEACHER'].includes(next.role))throw fail(400,'Hồ sơ tài khoản không hợp lệ.');
   if(id===ownerEmail){if(actor.email===ownerEmail&&next.role==='OWNER'&&next.active===true)return;throw fail(403,'Không thể thay đổi quản trị chính.');}
   if(actor.role==='OWNER'&&actor.active)return;
   if(isAdmin(actor)&&id!==actor.email&&previous?.role!=='OWNER'&&previous?.role!=='ADMIN'&&['SCHEDULER','TEACHER'].includes(next.role))return;
   if(id===actor.email){
     if(!previous){if(next.role==='TEACHER'&&next.active===false&&Object.keys(next).every(k=>['email','displayName','role','active','selfDeclared','updatedAt','updatedBy'].includes(k)))return;}
     else if(Object.keys({...previous,...next}).every(k=>['displayName','selfDeclared','updatedAt','updatedBy'].includes(k)||equal(previous[k],next[k])))return;
   }
   throw fail(403,'Bạn không có quyền thay đổi hồ sơ chính thức.');
 }
 if(!actor.active)throw fail(403,'Tài khoản chưa được cấp quyền.');
 if(collection==='timetables'&&['working','published'].includes(id)&&isScheduler(actor)&&next!==null)return;
 if(collection==='availabilities'&&(id===actor.email||isScheduler(actor))&&next!==null&&next.teacherEmail===id)return;
 if(collection==='requests'){
   if(!previous&&next?.teacherEmail===actor.email&&next.status==='PENDING')return;
   if(previous&&isScheduler(actor)&&next!==null&&next.teacherEmail===previous.teacherEmail)return;
   if(previous?.teacherEmail===actor.email&&previous.status==='PENDING'){
     if(next===null)return;
     if(Object.keys({...previous,...next}).every(k=>['reason','proposal','updatedAt','updatedBy'].includes(k)||equal(previous[k],next[k])))return;
   }
 }
 throw fail(403,'Bạn không có quyền thay đổi dữ liệu này.');
}
