import {allLessons} from './core.js';
export function isoDay(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return '';const d=new Date(value+'T12:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===value?value:'';}
export function addDays(value,count){if(!isoDay(value))return '';const d=new Date(value+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+count);return d.toISOString().slice(0,10);}
export function mondayOf(value){if(!isoDay(value))return '';const day=new Date(value+'T12:00:00Z').getUTCDay();return addDays(value,-((day+6)%7));}
export function todayWeek(){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));return mondayOf(`${p.year}-${p.month}-${p.day}`);}
export function timetableWeek(state){const school=state?.school||{};if(isoDay(school.weekStartDate))return mondayOf(school.weekStartDate);for(const value of [school.weekDates,school.appliedDate]){if(isoDay(value))return mondayOf(value);const m=String(value||'').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);if(m)return mondayOf(`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`);}return '';}
export function weekCaption(start){return start?`${start.split('-').reverse().join('/')} – ${addDays(start,4).split('-').reverse().join('/')}`:'Chưa đặt ngày bắt đầu tuần';}
const validRegistration=entry=>entry&&Array.isArray(entry.availableSlotIds)&&Array.isArray(entry.busySlotIds);
export function semesterKey(state){const school=state?.school||{};return school.year&&school.term?[school.year,school.term].map(x=>encodeURIComponent(String(x).trim()).replace(/\./g,'%2E')).join('~'):'';}
export function semesterRegistration(doc,state){const key=semesterKey(state),entry=key&&doc?.semesters?.[key];return validRegistration(entry)?entry:null;}
export function weeklyRegistration(doc,week,state){if(!isoDay(week))return null;const entry=doc?.weeks?.[week];return validRegistration(entry)?entry:semesterRegistration(doc,state);}

export function availabilityAlerts(state,records,week=timetableWeek(state)){
 if(!week)return {week,busy:[],unassigned:[],registered:[]};
 const lessons=allLessons(state),busy=[],unassigned=[],registered=[];
 for(const record of records||[]){const entry=weeklyRegistration(record,week,state);if(!entry||(!entry.availableSlotIds.length&&!entry.busySlotIds.length)||!record.teacherId||record.active===false)continue;
  const teacher=state.teachers.find(t=>t.id===record.teacherId);if(!teacher)continue;
  const mine=lessons.filter(c=>c.teacherId===teacher.id),name=teacher.fullName;
  const item={teacherId:teacher.id,name,entry,teacherEmail:record.teacherEmail,source:validRegistration(record.weeks?.[week])?'week':'semester'};registered.push(item);
  for(const cell of mine)if((entry.busySlotIds||[]).includes(cell.timeSlotId))busy.push({...item,cell});
  if(entry.availableSlotIds?.length&&!mine.length)unassigned.push(item);
 }
 return {week,busy,unassigned,registered};
}
export function newBusyAssignments(before,next,records){const previous=new Set(availabilityAlerts(before,records).busy.map(x=>`${x.teacherId}:${x.cell.classId}:${x.cell.timeSlotId}`));return availabilityAlerts(next,records).busy.filter(x=>!previous.has(`${x.teacherId}:${x.cell.classId}:${x.cell.timeSlotId}`));}
// Resolve availability for a candidate slot even before it has a scheduled lesson.
export function registrationSlotIndex(state,records,week=timetableWeek(state)){
 const index=new Map();if(!week)return index;
 const teachers=new Set((state.teachers||[]).map(t=>t.id)),slots=new Set((state.timeSlots||[]).map(s=>s.id));
 for(const record of records||[]){
  if(!record.teacherId||record.active===false||!teachers.has(record.teacherId))continue;
  const entry=weeklyRegistration(record,week,state);if(!entry)continue;
  const source=validRegistration(record.weeks?.[week])?'week':'semester';
  for(const [status,ids] of [['available',entry.availableSlotIds],['busy',entry.busySlotIds]])for(const slotId of ids){
   if(!slots.has(slotId))continue;const key=JSON.stringify([record.teacherId,slotId]);
   if(status==='busy'||index.get(key)?.status!=='busy')index.set(key,{status,source,week,note:entry.note||'',teacherId:record.teacherId});
  }
 }
 return index;
}
export function registrationForSlot(index,teacherId,slotId){return index.get(JSON.stringify([teacherId,slotId]))||null;}
