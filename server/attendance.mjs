import {effectiveAttendanceEntry,lateDeadline,validDepartureTime} from '../src/attendance-state.js';
import {isDeepStrictEqual as equal} from 'node:util';
import {fail,isAdmin} from './policy.mjs';
import {allLessons} from '../src/core.js';
import {timetableWeek,addDays} from '../src/weekly-availability.js';
import {homeroomClasses} from '../src/lesson-report-data.js';
const statuses=new Set(['PRESENT','LATE','EXCUSED','UNEXCUSED','SICK','EARLY_LEAVE']);
function dateOf(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v+'T00:00:00Z'))||new Date(v+'T00:00:00Z').toISOString().slice(0,10)!==v)throw fail(400,'Ngày điểm danh không hợp lệ.');return v;}
const part=v=>encodeURIComponent(String(v)).replace(/~/g,'%7E');
function key(kind,year,classId,date){const id=[kind,year,classId,...(date?[date]:[])].map(part).join('~');if(id.length>180)throw fail(400,'Mã lớp hoặc năm học quá dài.');return id;}
function rosterStudents(rows){
 if(!Array.isArray(rows)||rows.length>250)throw fail(400,'Danh sách lớp tối đa 250 học sinh.');
 const ids=new Set(),codes=new Set();return rows.map(s=>{
  if(!s||typeof s.id!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(s.id)||ids.has(s.id)||typeof s.name!=='string'||!s.name.trim()||s.name.length>150||typeof s.code!=='string'||s.code.length>40)throw fail(400,'Mã hoặc tên học sinh không hợp lệ hoặc bị trùng.');
  ids.add(s.id);const code=s.code.trim();if(code&&codes.has(code.toLocaleLowerCase('vi')))throw fail(400,'Mã học sinh bị trùng.');if(code)codes.add(code.toLocaleLowerCase('vi'));
  return {id:s.id,name:s.name.trim(),code};
 });
}
export function createAttendance({store,verifyToken,ownerEmail,clock=()=>new Date()}){
 async function scope(token,{teaching=false}={}){
  const user=await verifyToken(token),profile=user.email===ownerEmail?{role:'OWNER',active:true}:(await store.get('users',user.email)).data;
  const actor={...profile,email:user.email};if(actor.active!==true)throw fail(403,'Tài khoản chưa được kích hoạt.');
  const published=store.getTeacherPublished?await store.getTeacherPublished():await store.get('timetables','published');
  if(!published.data?.isPublished||!published.data.data)throw fail(409,'Nhà trường cần công bố lịch để xác định lớp và GVCN.');
  const schedule=published.data.data,admin=isAdmin(actor),inspector=actor.role==='INSPECTOR',classes=admin||inspector?(schedule.classes||[]):homeroomClasses(schedule,profile);
  if(!teaching&&!classes.length)throw fail(403,'Chỉ GVCN được phân công hoặc quản trị viên được sử dụng điểm danh.');
  const year=String(schedule.school?.year||'').trim().replace(/^năm học\s*/iu,'');if(!year)throw fail(409,'Cần thiết lập năm học trong Thông tin trường.');
  return {actor,admin,inspector,classes,year,schedule};
 }
 function lateOptionsFor(s,date){const week=timetableWeek(s.schedule);if(!week||date<week||date>addDays(week,6))return [];const day=new Date(date+'T00:00:00Z').getUTCDay()+1;return (s.schedule.timeSlots||[]).filter(t=>Number(t.dayOfWeek)===day&&t.startTime&&t.endTime).map(t=>({id:t.id,period:t.period,session:t.session,startTime:t.startTime,endTime:t.endTime}));}
 function teachingClassIds(s,date){const week=timetableWeek(s.schedule);if(!s.actor.teacherId||!week||date<week||date>addDays(week,6))return new Set();const day=new Date(date+'T00:00:00Z').getUTCDay()+1,slots=new Map((s.schedule.timeSlots||[]).map(t=>[t.id,t]));return new Set(allLessons(s.schedule).filter(l=>l.teacherId===s.actor.teacherId&&Number(slots.get(l.timeSlotId)?.dayOfWeek)===day).map(l=>l.classId));}
 function classOf(s,id){const c=s.classes.find(c=>c.id===id);if(!c)throw fail(403,'Bạn không được điểm danh lớp này.');return c;}
 async function read(token,date,classId){
  dateOf(date);const s=await scope(token),c=classOf(s,classId||s.classes[0].id);
  const [roster,record]=await Promise.all([store.get('timetables',key('roster',s.year,c.id)),store.get('timetables',key('attendance',s.year,c.id,date))]);
  return {serverNow:clock().toISOString(),date,year:s.year,classId:c.id,classes:s.classes.map(c=>({id:c.id,name:c.name})),canManageRoster:s.admin||s.inspector,canRemoveStudents:s.admin,lateOptions:record.data?.lateOptions||lateOptionsFor(s,date),roster,record};
 }
 async function write(token,input){
  if(input?.action==='confirm-arrival')return confirmArrival(token,input);
  if(!input||typeof input!=='object'||Array.isArray(input)||!Number.isSafeInteger(input.expectedVersion)||input.expectedVersion<0)throw fail(400,'Yêu cầu điểm danh hoặc phiên bản không hợp lệ.');
  const s=await scope(token);const c=classOf(s,input.classId);let id,data;
  if(input.action==='roster'){
   if(!s.admin&&!s.inspector)throw fail(403,'Chỉ quản trị viên và giám thị được quản lý danh sách học sinh.');
   id=key('roster',s.year,c.id);const students=rosterStudents(input.students);if(s.inspector){const previous=await store.get('timetables',id),ids=new Set(students.map(e=>e.id));if((previous.data?.students||[]).some(e=>!ids.has(e.id)))throw fail(403,'Giám thị được thêm và sửa học sinh; chỉ quản trị viên được loại học sinh khỏi danh sách.');}data={kind:'student-roster',year:s.year,classId:c.id,students};
  }else if(input.action==='save'){
   const date=dateOf(input.date);id=key('attendance',s.year,c.id,date);
   const previous=await store.get('timetables',id),roster=await store.get('timetables',key('roster',s.year,c.id));
   if(previous.version!==input.expectedVersion)throw fail(409,'Người khác vừa cập nhật điểm danh. Tải lại để đối chiếu trước khi lưu.');
   if(!previous.data&&input.rosterVersion!==roster.version)throw fail(409,'Danh sách học sinh vừa thay đổi. Vui lòng tải lại.');
   const lateOptions=previous.data?.lateOptions||lateOptionsFor(s,date),allowedLate=new Set(lateOptions.map(t=>t.id));
   const students=previous.data?.entries||roster.data?.students||[];
   if(!students.length)throw fail(409,'Quản trị viên chưa nhập danh sách học sinh cho lớp này.');
   if(!Array.isArray(input.entries)||input.entries.length!==students.length)throw fail(400,'Cần điểm danh đầy đủ danh sách lớp.');
   const entries=new Map();for(const e of input.entries){if(!e||entries.has(e.id)||!statuses.has(e.status)||typeof e.note!=='string'||e.note.length>300)throw fail(400,'Trạng thái hoặc ghi chú điểm danh không hợp lệ.');if(e.status==='EARLY_LEAVE'&&!e.note.trim())throw fail(400,'Cần nhập nội dung xin về đột xuất.');if(e.status==='EARLY_LEAVE'){const prior=students.find(x=>x.id===e.id),time=e.departureTime===undefined?prior?.departureTime||'':e.departureTime;if(!validDepartureTime(time)&&!(time===''&&prior?.status==='EARLY_LEAVE'&&!prior.departureTime))throw fail(400,'Chọn giờ về đột xuất hợp lệ (HH:mm).');}if((e.status==='LATE'||e.status==='EARLY_LEAVE'&&e.lateSlotIds?.length)&&(!Array.isArray(e.lateSlotIds)||!e.lateSlotIds.length||new Set(e.lateSlotIds).size!==e.lateSlotIds.length||e.lateSlotIds.some(id=>!allowedLate.has(id))))throw fail(400,'Chọn các tiết đi trễ theo thời khóa biểu ngày này.');entries.set(e.id,e);}
   data={kind:'student-attendance',year:s.year,classId:c.id,className:c.name,date,lateOptions,entries:students.map(student=>{const entry=entries.get(student.id);if(!entry)throw fail(400,'Danh sách điểm danh không khớp danh sách học sinh.');return {id:student.id,name:student.name,code:student.code,status:entry.status,note:entry.note.trim(),...(entry.status==='EARLY_LEAVE'&&validDepartureTime(entry.departureTime===undefined?student.departureTime:entry.departureTime)?{departureTime:entry.departureTime===undefined?student.departureTime:entry.departureTime}:{}),...((entry.status==='LATE'||entry.status==='EARLY_LEAVE'&&entry.lateSlotIds?.length)?{lateSlotIds:lateOptions.filter(t=>entry.lateSlotIds.includes(t.id)).map(t=>t.id),latePeriods:entry.lateSlotIds.length,...(['LATE','EARLY_LEAVE'].includes(student.status)&&student.arrivalConfirmedAt&&equal([...(student.lateSlotIds||[])].sort(),[...entry.lateSlotIds].sort())?{arrivalConfirmedAt:student.arrivalConfirmedAt,arrivalConfirmedBy:student.arrivalConfirmedBy}:entry.status==='EARLY_LEAVE'?{arrivalConfirmedAt:clock().toISOString(),arrivalConfirmedBy:s.actor.email}:{})}:{})};})};
  }else throw fail(400,'Thao tác điểm danh không hợp lệ.');
  const before=await store.get('timetables',id);if(before.version!==input.expectedVersion)throw fail(409,'Dữ liệu vừa thay đổi. Tải lại trước khi lưu.');
  if(before.data&&equal({...before.data,updatedAt:undefined,updatedBy:undefined},{...data,updatedAt:undefined,updatedBy:undefined}))return {...before,skipped:true};
  return store.cas('timetables',id,{...data,updatedAt:new Date().toISOString(),updatedBy:s.actor.email},before.version,s.actor.email,before.data);
 }
 async function overview(token,date){
  dateOf(date);const s=await scope(token);if(!s.admin&&!s.inspector)throw fail(403,'Chỉ quản trị viên và giám thị được xem toàn trường.');
  const ids=s.classes.flatMap(c=>[key('roster',s.year,c.id),key('attendance',s.year,c.id,date)]);
  const rows=store.getMany?await store.getMany('timetables',ids):await Promise.all(ids.map(id=>store.get('timetables',id)));
  const byId=new Map(rows.map(r=>[r.id,r]));
  const classes=s.classes.map(c=>{const record=byId.get(key('attendance',s.year,c.id,date))?.data,roster=byId.get(key('roster',s.year,c.id))?.data;
   const entries=record?.entries||(roster?.students||[]).map(e=>({...e,status:'',note:''}));
   const effective=entries.map(e=>effectiveAttendanceEntry(e,date,record?.lateOptions||lateOptionsFor(s,date),clock())),counts={PRESENT:0,LATE:0,EXCUSED:0,UNEXCUSED:0,SICK:0,EARLY_LEAVE:0,UNCONFIRMED_ABSENCE:0,unmarked:0};for(const e of effective)counts[e.status in counts?e.status:'unmarked']++;
   return {id:c.id,name:c.name,entries:effective,counts,lateOptions:record?.lateOptions||lateOptionsFor(s,date),latePeriods:entries.reduce((n,e)=>n+(e.status==='LATE'?(e.latePeriods||0):0),0),total:entries.length,saved:!!record,updatedAt:record?.updatedAt||''};});
  return {date,year:s.year,classes,serverNow:clock().toISOString(),updatedAt:new Date().toISOString()};
 }
 async function statistics(token,{mode,year,month,start,end,term,date,detail}={}){
  const s=await scope(token);if(!s.admin&&!s.inspector)throw fail(403,'Chỉ quản trị viên và giám thị được xem thống kê toàn trường.');
  if(!['week','month','term','year'].includes(mode))throw fail(400,'Chế độ thống kê không hợp lệ.');
  year=year||s.year;const match=/^(\d{4})-(\d{4})$/.exec(year);if(!match||Number(match[2])!==Number(match[1])+1)throw fail(400,'Năm học cần có dạng 2026-2027.');
  if(mode==='week'){const anchor=new Date(dateOf(date)+'T00:00:00Z');anchor.setUTCDate(anchor.getUTCDate()-((anchor.getUTCDay()+6)%7));start=anchor.toISOString().slice(0,10);anchor.setUTCDate(anchor.getUTCDate()+4);end=anchor.toISOString().slice(0,10);}
  if(mode==='month'){if(!/^\d{4}-\d{2}$/.test(month||''))throw fail(400,'Cần chọn tháng.');start=dateOf(month+'-01');end=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),0)).toISOString().slice(0,10);}
  if(mode==='year'){start=year==='2026-2027'?'2026-08-10':match[1]+'-01-01';end=year==='2026-2027'?'2027-05-17':match[2]+'-12-31';}
  if(mode==='term'&&year==='2026-2027'&&!start&&!end){[start,end]=term==='1'?['2026-08-10','2026-12-20']:['2026-12-21','2027-05-17'];}
  dateOf(start);dateOf(end);if(start>end||Date.parse(end)-Date.parse(start)>732*86400000)throw fail(400,'Khoảng ngày thống kê không hợp lệ.');
  if(mode==='term'&&!['1','2'].includes(term))throw fail(400,'Cần chọn học kỳ I hoặc II.');
  const rows=await store.listAttendance(year,start,end),classes=new Map(s.classes.map(c=>[c.id,{id:c.id,name:c.name,total:0,days:[],counts:Object.fromEntries([...statuses,'UNCONFIRMED_ABSENCE','unmarked'].map(k=>[k,0]))}]));
  for(const {data:r} of rows){if(r?.kind!=='student-attendance'||r.year!==year||r.date<start||r.date>end)continue;let c=classes.get(r.classId);if(!c){c={id:r.classId,name:r.className||r.classId,total:0,days:[],counts:Object.fromEntries([...statuses,'UNCONFIRMED_ABSENCE','unmarked'].map(k=>[k,0]))};classes.set(r.classId,c);}
   if(c.days.some(d=>d.date===r.date))continue;const counts=Object.fromEntries([...statuses,'UNCONFIRMED_ABSENCE','unmarked'].map(k=>[k,0])),entries=(r.entries||[]).map(raw=>effectiveAttendanceEntry(raw,r.date,r.lateOptions||[],clock()));for(const e of entries)counts[e.status in counts?e.status:'unmarked']++;
   const total=Object.values(counts).reduce((a,b)=>a+b,0);c.days.push({date:r.date,total,counts,...(detail==='1'?{entries:entries.map(e=>({id:e.id,code:e.code||'',name:e.name,status:e.status,declaredStatus:e.declaredStatus||e.status,latePeriods:e.latePeriods||null,arrivalState:e.arrivalState||'',departureTime:e.departureTime||''}))}:{})});c.total+=total;for(const k of Object.keys(counts))c.counts[k]+=counts[k];
  }
  if(detail==='1'){const list=[...classes.values()],ids=list.map(c=>key('roster',year,c.id)),rosters=store.getMany?await store.getMany('timetables',ids):await Promise.all(ids.map(id=>store.get('timetables',id))),byId=new Map(rosters.map(r=>[r.id,r.data]));for(const c of list)c.students=(byId.get(key('roster',year,c.id))?.students||[]).map(e=>({id:e.id,code:e.code,name:e.name}));}
  for(const c of classes.values())c.days.sort((a,b)=>a.date.localeCompare(b.date));
  return {period:true,mode,term,year,start,end,date:start,label:mode==='week'?'Tuần (Thứ hai–Thứ sáu)':mode==='month'?'Tháng '+month:mode==='term'?'Học kỳ '+term:'Năm học '+year,classes:[...classes.values()],recordedDates:new Set([...classes.values()].flatMap(c=>c.days.map(d=>d.date))).size,updatedAt:new Date().toISOString()};
 }
 async function teaching(token,date){
  dateOf(date);const s=await scope(token,{teaching:true}),week=timetableWeek(s.schedule),end=week?addDays(week,6):'';
  const result={date,year:s.year,weekStart:week,weekEnd:end,classes:[],serverNow:clock().toISOString(),updatedAt:new Date().toISOString()};
  if(!s.actor.teacherId)return {...result,message:'Tài khoản chưa được gắn hồ sơ giáo viên. Liên hệ quản trị viên.'};
  if(!week||date<week||date>end)return {...result,message:'Ngày chọn nằm ngoài tuần của thời khóa biểu đã công bố. Chỉ xác định lớp được dạy theo đúng tuần lịch hiện hành.'};
  const day=new Date(date+'T00:00:00Z').getUTCDay()+1,slots=new Map((s.schedule.timeSlots||[]).map(t=>[t.id,t]));
  const ids=new Set(allLessons(s.schedule).filter(l=>l.teacherId===s.actor.teacherId&&Number(slots.get(l.timeSlotId)?.dayOfWeek)===day).map(l=>l.classId));
  const classes=(s.schedule.classes||[]).filter(c=>ids.has(c.id)),homeIds=new Set(homeroomClasses(s.schedule,s.actor).map(c=>c.id));
  result.classes=await Promise.all(classes.map(async c=>{const [roster,record]=await Promise.all([store.get('timetables',key('roster',s.year,c.id)),store.get('timetables',key('attendance',s.year,c.id,date))]);
   const entries=(record.data?.entries||(roster.data?.students||[]).map(e=>({...e,status:'',note:''}))).map(raw=>{const e=effectiveAttendanceEntry(raw,date,record.data?.lateOptions||lateOptionsFor(s,date),clock());return {id:e.id,name:e.name,code:e.code||'',status:e.status,declaredStatus:e.declaredStatus||e.status,arrivalState:e.arrivalState||'',arrivalDeadline:e.arrivalDeadline||'',arrivalConfirmedAt:e.arrivalConfirmedAt||'',departureTime:e.departureTime||'',departureState:e.departureState||'',note:homeIds.has(c.id)?e.note||'':'',...(e.declaredStatus==='LATE'?{latePeriods:e.latePeriods||null,lateLessons:(record.data?.lateOptions||lateOptionsFor(s,date)).filter(t=>(e.lateSlotIds||[]).includes(t.id))}:{})};});
   return {id:c.id,name:c.name,version:record.version,saved:!!record.data,updatedAt:record.data?.updatedAt||'',entries};}));
  if(!classes.length)result.message='Không có tiết dạy trong ngày này theo thời khóa biểu đã công bố.';return result;
 }
 async function confirmArrival(token,input){
  const date=dateOf(input.date),s=await scope(token,{teaching:true}),home=homeroomClasses(s.schedule,s.actor).some(c=>c.id===input.classId);
  if(!s.schedule.classes?.some(c=>c.id===input.classId))throw fail(403,'Lớp không thuộc danh sách nhà trường.');
  if(!s.admin&&!s.inspector&&!home&&!teachingClassIds(s,date).has(input.classId))throw fail(403,'Chỉ GVCN hoặc giáo viên có tiết dạy lớp này trong ngày được xác nhận.');
  const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(clock());if(date>today)throw fail(400,'Không xác nhận có mặt cho ngày tương lai.');
  const id=key('attendance',s.year,input.classId,date),before=await store.get('timetables',id);if(!before.data)throw fail(409,'GVCN cần lưu điểm danh trước khi xác nhận.');
  if(!Number.isSafeInteger(input.expectedVersion)||before.version!==input.expectedVersion)throw fail(409,'Điểm danh vừa thay đổi. Tải lại trước khi xác nhận.');
  const entry=before.data.entries.find(e=>e.id===input.studentId);if(!entry||entry.status!=='LATE'||!lateDeadline(entry,date,before.data.lateOptions||[]))throw fail(409,'Cần lưu các tiết đi trễ hợp lệ trước khi xác nhận.');
  if(entry.arrivalConfirmedAt)return {...before,skipped:true};const time=clock().toISOString(),data={...before.data,entries:before.data.entries.map(e=>e.id===entry.id?{...e,arrivalConfirmedAt:time,arrivalConfirmedBy:s.actor.email}:e),updatedAt:time,updatedBy:s.actor.email};
  return store.cas('timetables',id,data,before.version,s.actor.email,before.data);
 }
 return {read,write,overview,statistics,teaching};
}
