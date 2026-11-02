import {cellLessons,getTeacherColor} from './core.js';
function labelWeek(s){const a=s.school||{};return [a.currentWeek||a.week||'',a.weekDates||(a.weekStartDate?[a.weekStartDate,a.weekEndDate].filter(Boolean).map(d=>d.split('-').reverse().join('/')).join(' – '):a.appliedDate||'')].filter(Boolean).join(' · ');}
const compact=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/gi,'d').toLowerCase().replace(/[^a-z0-9]/g,'');
export function excelTeacherName(value){
 const parts=String(value||'').normalize('NFC').trim().split(/\s+/u).filter(Boolean);
 return parts.length<2?(parts[0]||''):parts.slice(0,-1).map(p=>Array.from(p)[0].toLocaleUpperCase('vi-VN')+'.').join('')+' '+parts.at(-1);
}
export function fixedExportLesson(cell,subject,lesson=cell){
 const tags=[subject?.code,subject?.name].map(compact);
 return Boolean(cell?.locked||cell?.fixed||cell?.isFixed||tags.some(n=>['chaoco','taesl','tienganhesl','clb','caulacbo','shl','sinhhoatlop'].includes(n))||/sinhhoatlop|sinhhoatduoico/.test(compact(lesson?.note)));
}
export function publishedMatrix(published){
 if(!published?.isPublished||!published.data)throw Error('Chưa có thời khóa biểu đã công bố để tải Excel.');
 const s=structuredClone(published.data),classes=s.classes||[],slots=[...(s.timeSlots||[])].sort((a,b)=>a.dayOfWeek-b.dayOfWeek||(a.globalPeriod||a.period+(a.session==='AFTERNOON'?5:0))-(b.globalPeriod||b.period+(b.session==='AFTERNOON'?5:0)));
 if(!classes.length||!slots.length)throw Error('Bản đã công bố thiếu danh sách lớp hoặc khung tiết học.');
 const name=id=>excelTeacherName(s.teachers?.find(t=>t.id===id)?.fullName);
 const columnGroups=[],columnWidths=[8,7,5,15],header=['Thứ','Buổi','Tiết','Thời gian'],homerooms=Array(4).fill('');
 for(const cls of classes){const width=Number(cls.grade)===11?2:1,start=columnWidths.length;columnGroups.push({classId:cls.id,start,width});columnWidths.push(...Array(width).fill(width===2?12:14));header.push(cls.name,...Array(width-1).fill(''));homerooms.push(`Khối ${cls.grade}\nGVCN: ${[...new Set([cls.homeroomTeacherId,cls.coHomeroomTeacherId].filter(Boolean))].map(name).filter(Boolean).join('\n')||'Chưa có'}`,...Array(width-1).fill(''));}
 const rows=[['THỜI KHÓA BIỂU TOÀN TRƯỜNG – ĐÃ CÔNG BỐ'],[[s.school?.name,s.school?.year,s.school?.term].filter(Boolean).join(' · ')],[labelWeek(s)],header,homerooms];
 const merges=[0,1,2].map(r=>({s:{r,c:0},e:{r,c:columnWidths.length-1}}));for(let c=0;c<4;c++)merges.push({s:{r:3,c},e:{r:4,c}});
 for(const group of columnGroups)if(group.width===2)for(const r of [3,4])merges.push({s:{r,c:group.start},e:{r,c:group.start+1}});
 const cells=new Map((s.timetableCells||s.publishedSchedule||[]).map(c=>[c.classId+'::'+c.timeSlotId,c])),lessonColors=new Map();
 const writeLesson=(row,parent,lesson)=>{const col=row.length,subject=s.subjects?.find(x=>x.id===lesson?.subjectId),fixed=lesson&&fixedExportLesson(parent,subject,lesson);row.push(!lesson?'':fixed?(subject?.name||lesson.subjectId):`${subject?.name||lesson.subjectId}\n${name(lesson.teacherId)||'Chưa chọn giáo viên'}${lesson.note?'\n'+lesson.note:''}`);
  if(lesson)lessonColors.set(`${rows.length}:${col}`,!fixed&&lesson.teacherId?getTeacherColor(s,lesson.teacherId):subject?.color||'#ffffff');
 };
 for(const slot of slots){const row=[['','','Thứ hai','Thứ ba','Thứ tư','Thứ năm','Thứ sáu','Thứ bảy','Chủ nhật'][slot.dayOfWeek]||String(slot.dayOfWeek),slot.session==='MORNING'?'SÁNG':'CHIỀU',slot.period,`${slot.startTime} – ${slot.endTime}`];
  for(const group of columnGroups){const parent=cells.get(group.classId+'::'+slot.id),lessons=cellLessons(s,parent);
   if(group.width===2&&lessons.some(l=>['TN','XH'].includes(l.track))){for(const track of ['TN','XH'])writeLesson(row,parent,lessons.find(l=>l.track===track));}
   else{writeLesson(row,parent,lessons[0]);if(group.width===2){row.push('');merges.push({s:{r:rows.length,c:group.start},e:{r:rows.length,c:group.start+1}});const color=lessonColors.get(`${rows.length}:${group.start}`);if(color)lessonColors.set(`${rows.length}:${group.start+1}`,color);}}
  }rows.push(row);
 }
 for(let i=0;i<slots.length;){let j=i+1;while(j<slots.length&&slots[j].dayOfWeek===slots[i].dayOfWeek)j++;if(j-i>1)merges.push({s:{r:i+5,c:0},e:{r:j+4,c:0}});for(let k=i;k<j;){let end=k+1;while(end<j&&slots[end].session===slots[k].session)end++;if(end-k>1)merges.push({s:{r:k+5,c:1},e:{r:end+4,c:1}});k=end;}i=j;}
 // Fit columns to visible data, excluding the three full-width title rows.
 for(const group of columnGroups){for(let c=group.start;c<group.start+group.width;c++){
  let longest=0;for(let r=3;r<rows.length;r++){const merged=merges.find(m=>m.s.r===r&&m.s.c===c&&m.e.c>c);const span=merged?merged.e.c-c+1:1;for(const line of String(rows[r][c]||'').split('\n'))longest=Math.max(longest,Array.from(line).length/span);}
  columnWidths[c]=Math.min(group.width===2?22:26,Math.max(group.width===2?12:14,Math.ceil(longest)+1));
 }}
 const week=String(s.school?.currentWeek||s.school?.week||'').match(/\d+/)?.[0];
 return {rows,merges,slots,classes,columnGroups,columnWidths,lessonColors,filename:`TKB_ToanTruong_DaCongBo${week?'_Tuan_'+week:''}${s.school?.weekStartDate?'_'+s.school.weekStartDate:''}.xlsx`};
}const pastel=hex=>{const h=String(hex).replace('#','');if(!/^[\da-f]{6}$/i.test(h))return 'FFFFFF';return [0,2,4].map(i=>Math.round(parseInt(h.slice(i,i+2),16)*.18+255*.82).toString(16).padStart(2,'0')).join('').toUpperCase();};
export function publishedExcel(published,XLSX){
 const model=publishedMatrix(published),{rows,classes,slots,merges,lessonColors,columnWidths}=model,columns=columnWidths.length;
 const padded=rows.map(row=>Array.from({length:columns},(_,c)=>row[c]??'')),ws=XLSX.utils.aoa_to_sheet(padded),wb=XLSX.utils.book_new();
 ws['!merges']=merges;ws['!cols']=columnWidths.map(wch=>({wch}));
 const spanWidths=new Map(merges.filter(m=>m.s.r===m.e.r).map(m=>[m.s.r+':'+m.s.c,columnWidths.slice(m.s.c,m.e.c+1).reduce((a,b)=>a+b,0)]));
 const lines=(value,width)=>String(value||'').split('\n').reduce((total,line)=>{const capacity=Math.max(1,width-1);let count=1,used=0;for(const word of line.split(/\s+/u)){const length=Array.from(word).length;if(!length)continue;if(used&&used+1+length>capacity){count++;used=0;}const space=used?1:0;used+=space+length;while(used>capacity){count++;used-=capacity;}}return total+count;},0);
 ws['!rows']=rows.map((row,r)=>({hpt:Math.max(r===0?20:17,...row.map((value,c)=>lines(value,spanWidths.get(r+':'+c)||columnWidths[c])*(r<5?15:13.5)+3))}));
 ws['!margins']={left:.25,right:.25,top:.4,bottom:.4,header:.2,footer:.2};
 XLSX.utils.book_append_sheet(wb,ws,'TKB da cong bo');wb.Props={Title:'Thời khóa biểu toàn trường đã công bố',Subject:labelWeek(published.data)};
 const zip=XLSX.CFB.read(new Uint8Array(XLSX.write(wb,{type:'array',bookType:'xlsx',compression:true})),{type:'array'});
 const styles=[],styleIds=new Map();function style(fill,font=0,border=1){const key=[fill,font,border].join(':');if(!styleIds.has(key)){styleIds.set(key,styles.length);styles.push({fill,font,border});}return styleIds.get(key);}
 const cellStyles=new Map();for(let r=0;r<rows.length;r++)for(let c=0;c<columns;c++){const fill=r===0?'174C40':r<3?'FFFFFF':r<5?'EAF1E5':c<4?(slots[r-5]?.session==='MORNING'?'FAF3DA':'EAF0E7'):lessonColors.has(`${r}:${c}`)?pastel(lessonColors.get(`${r}:${c}`)):'FFFFFF';cellStyles.set(XLSX.utils.encode_cell({r,c}),style(fill,r===0?2:r<5||c<3?1:0,r<3?0:1));}
 const fills=[...new Set(styles.map(s=>s.fill))],xml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="11"/><color rgb="FF233B36"/><name val="Times New Roman"/></font><font><b/><sz val="12"/><color rgb="FF174C40"/><name val="Times New Roman"/></font><font><b/><sz val="12"/><color rgb="FFFFFFFF"/><name val="Times New Roman"/></font></fonts><fills count="${fills.length+2}"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>${fills.map(f=>`<fill><patternFill patternType="solid"><fgColor rgb="FF${f}"/><bgColor indexed="64"/></patternFill></fill>`).join('')}</fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border>${['left','right','top','bottom'].map(x=>`<${x} style="thin"><color rgb="FFD6DFD1"/></${x}>`).join('')}<diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${styles.length}">${styles.map(s=>`<xf numFmtId="0" fontId="${s.font}" fillId="${fills.indexOf(s.fill)+2}" borderId="${s.border}" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>`).join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
 const enc=new TextEncoder(),dec=new TextDecoder();XLSX.CFB.utils.cfb_add(zip,'/xl/styles.xml',enc.encode(xml));
 const entry=XLSX.CFB.find(zip,'/xl/worksheets/sheet1.xml');if(!entry)throw Error('Không tạo được trang tính Excel.');
 let sheet=dec.decode(new Uint8Array(entry.content)).replace(/<c\b([^>]*\br="([^"]+)"[^>]*)>/g,(_,attrs,address)=>`<c${attrs.replace(/\s+s="\d+"/g,'')} s="${cellStyles.get(address)||0}">`);
 const view='<sheetViews><sheetView workbookViewId="0"><pane xSplit="4" ySplit="5" topLeftCell="E6" activePane="bottomRight" state="frozen"/><selection pane="bottomRight" activeCell="E6" sqref="E6"/></sheetView></sheetViews>';
 sheet=sheet.replace(/<sheetViews>[\s\S]*?<\/sheetViews>/,view);XLSX.CFB.utils.cfb_add(zip,'/xl/worksheets/sheet1.xml',enc.encode(sheet));
 return {filename:model.filename,bytes:new Uint8Array(XLSX.CFB.write(zip,{type:'array',fileType:'zip',compression:true})),model};
}
