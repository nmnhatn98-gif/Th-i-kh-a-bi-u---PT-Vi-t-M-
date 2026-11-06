export function lateDeadline(entry,date,options=[]){if(entry.status!=='LATE'||!entry.lateSlotIds?.length)return null;const selected=options.filter(t=>entry.lateSlotIds.includes(t.id));if(selected.length!==entry.lateSlotIds.length)return null;const times=selected.map(t=>{const m=/^(\d{1,2}):(\d{2})$/.exec(t.endTime||'');return m&&Number(m[1])<24&&Number(m[2])<60?m[1].padStart(2,'0')+':'+m[2]:'';});if(times.some(t=>!t))return null;return date+'T'+times.sort().at(-1)+':00+07:00';}
export function validDepartureTime(value){return typeof value==='string'&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);}
export function departureInfo(entry,date,now=new Date()){
 if(entry.status!=='EARLY_LEAVE')return {};
 const departureAt=validDepartureTime(entry.departureTime)?date+'T'+entry.departureTime+':00+07:00':null;
 return {departureAt,departureState:!departureAt?'NO_TIME':+new Date(now)<Date.parse(departureAt)?'SCHEDULED':'LEFT'};
}
export function currentAttendancePresence(entries,date,now=new Date()){
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
 if(date!==today)return null;
 const result={present:0,scheduled:0,left:0,unknown:0};
 for(const e of entries){
  if(e.status==='EARLY_LEAVE'){const phase=departureInfo(e,date,now).departureState;if(phase==='SCHEDULED'){result.present++;result.scheduled++;}else if(phase==='LEFT')result.left++;else result.unknown++;}
  else if(e.status==='PRESENT'||e.status==='LATE'&&(e.arrivalState==='CONFIRMED'||e.arrivalConfirmedAt))result.present++;
  else if(!e.status||e.status==='SICK')result.unknown++;
 }
 return result;
}
export function effectiveAttendanceEntry(entry,date,options=[],now=new Date()){
 if(entry.status==='EARLY_LEAVE')return {...entry,...departureInfo(entry,date,now),...(entry.lateSlotIds?.length?{declaredStatus:'LATE',arrivalState:'CONFIRMED'}:{})};
 if(entry.status!=='LATE')return {...entry};const deadline=lateDeadline(entry,date,options),confirmed=!!entry.arrivalConfirmedAt||entry.arrivalState==='CONFIRMED';
 return {...entry,declaredStatus:'LATE',arrivalDeadline:deadline,arrivalState:confirmed?'CONFIRMED':!deadline?'NO_DEADLINE':+new Date(now)>=Date.parse(deadline)?'OVERDUE':'PENDING',status:!confirmed&&deadline&&+new Date(now)>=Date.parse(deadline)?'UNCONFIRMED_ABSENCE':'LATE'};
}
