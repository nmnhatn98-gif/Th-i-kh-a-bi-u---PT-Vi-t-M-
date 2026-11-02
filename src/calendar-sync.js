import {allLessons} from './core.js';
export function weekStart(school){const value=school?.weekStartDate || school?.appliedDate;if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))throw Error('Cần đặt ngày bắt đầu tuần trong Thông tin nhà trường trước khi đồng bộ.');const d=new Date(value+'T00:00:00Z');if(Number.isNaN(+d)||d.getUTCDay()!==1)throw Error('Ngày bắt đầu tuần phải là Thứ hai.');return value;}
export async function calendarEvents(state,teacherId){
 const week=weekStart(state.school),groups=new Map();
 for(const lesson of allLessons(state).filter(x=>x.teacherId===teacherId)){
 const slot=state.timeSlots.find(x=>x.id===lesson.timeSlotId);if(!slot)continue;
 const key=slot.id,group=groups.get(key)||{slot,lessons:[]};group.lessons.push(lesson);groups.set(key,group);
 }
 const events=[];for(const {slot,lessons} of groups.values()){
 const d=new Date(week+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+Number(slot.dayOfWeek)-2);const day=d.toISOString().slice(0,10);
 const time=v=>{const m=String(v||'').match(/^(\d{1,2})[:h](\d{2})$/);if(!m)throw Error('Giờ tiết học không hợp lệ.');return m[1].padStart(2,'0')+':'+m[2]+':00';};
 const start=day+'T'+time(slot.startTime),end=day+'T'+time(slot.endTime);if(end<=start)throw Error('Giờ kết thúc tiết phải sau giờ bắt đầu.');
 const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('tkb-vietmy:'+teacherId+':'+week+':'+slot.id));const id='tkb'+Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
 const names=[...new Set(lessons.map(l=>state.subjects.find(x=>x.id===l.subjectId)?.name||''))].join(' / '),classes=[...new Set(lessons.map(l=>state.classes.find(x=>x.id===l.classId)?.name||''))].join(', ');
 events.push({id,summary:names+' — '+classes,description:'Thời khóa biểu đã công bố của nhà trường.',start:{dateTime:start+'+07:00',timeZone:'Asia/Ho_Chi_Minh'},end:{dateTime:end+'+07:00',timeZone:'Asia/Ho_Chi_Minh'},extendedProperties:{private:{tkbApp:'vietmy-v1',tkbTeacher:teacherId,tkbWeek:week}}});
 }return events;
}
export async function upsertCalendar({token,events,fetchFn=fetch}){
 let saved=0;for(const event of events){const base='https://www.googleapis.com/calendar/v3/calendars/primary/events',headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
 let r=await fetchFn(base+'/'+event.id,{method:'PATCH',headers,body:JSON.stringify(event)});
 if(r.status===404)r=await fetchFn(base,{method:'POST',headers,body:JSON.stringify(event)});
 if(!r.ok)throw Error('Đã đồng bộ '+saved+'/'+events.length+' tiết. Google Calendar chưa hoàn tất (mã '+r.status+'). Có thể thử lại, các tiết đã tạo sẽ được cập nhật cùng mã.');saved++;
 }return saved;
}
