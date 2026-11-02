import {createHash} from 'node:crypto';
import {allLessons} from '../src/core.js';

export const digest=value=>createHash('sha256').update(value).digest('hex');
export function checkedSubscription(value){
 if(!value||typeof value!=='object')throw Error('Đăng ký thông báo không hợp lệ.');
 const endpoint=new URL(value.endpoint);
 // Only known browser push providers. Never send server requests to arbitrary client URLs.
 const host=endpoint.hostname;
 if(endpoint.protocol!=='https:'||endpoint.port||endpoint.username||endpoint.password||!['fcm.googleapis.com','updates.push.services.mozilla.com','push.services.mozilla.com','web.push.apple.com','wns.windows.com'].some(h=>host===h||(h==='wns.windows.com'&&host.endsWith('.'+h))))throw Error('Dịch vụ thông báo của trình duyệt chưa được hỗ trợ.');
 if(endpoint.href.length>2000||!/^[-_A-Za-z0-9]{87}$/.test(value.keys?.p256dh||'')||!/^[-_A-Za-z0-9]{22}$/.test(value.keys?.auth||''))throw Error('Khóa đăng ký thông báo không hợp lệ.');
 return {endpoint:endpoint.href,expirationTime:null,keys:{p256dh:value.keys.p256dh,auth:value.keys.auth}};
}
export function dueLessons(published,teacherId,now=new Date(),leadMinutes=10){
 if(!published?.isPublished||!teacherId)return [];
 const s=published.data,week=s?.school?.weekStartDate||s?.school?.appliedDate;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(week||''))return [];
 const monday=new Date(week+'T00:00:00+07:00');
 if(!Number.isFinite(+monday)||new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',weekday:'short'}).format(monday)!=='Mon')return [];
 const groups=new Map();
 for(const cell of allLessons(s).filter(c=>c.teacherId===teacherId)){
  const slot=s.timeSlots?.find(t=>t.id===cell.timeSlotId);
  if(!slot||slot.dayOfWeek<2||slot.dayOfWeek>6||!/^\d{2}:\d{2}$/.test(slot.startTime||''))continue;
  const [hour,minute]=slot.startTime.split(':').map(Number);if(hour>23||minute>59)continue;
  const start=new Date(+monday+(slot.dayOfWeek-2)*86400000+(hour*60+minute)*60000);
  const remaining=+start-+now;if(remaining<=0||remaining>leadMinutes*60000)continue;
  const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(start);
  const id=JSON.stringify([date,teacherId,slot.id]);
  const group=groups.get(id)||{id,date,startAt:start.toISOString(),slot,subjects:new Set(),classes:new Set()};
  group.subjects.add(s.subjects?.find(x=>x.id===cell.subjectId)?.name||'Tiết dạy');
  group.classes.add(s.classes?.find(x=>x.id===cell.classId)?.name||'Lớp học');groups.set(id,group);
 }
 return [...groups.values()].map(g=>({id:g.id,startAt:g.startAt,payload:{title:'Sắp đến tiết dạy',body:`${g.slot.startTime} · ${g.slot.session==='MORNING'?'Sáng':'Chiều'} tiết ${g.slot.period} · ${[...g.subjects].join(' / ')} · ${[...g.classes].join(', ')}`,tag:'lesson-'+digest(g.id).slice(0,24),url:'/?open=my_teaching'}}));
}
