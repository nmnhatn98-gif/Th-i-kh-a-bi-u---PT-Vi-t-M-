import { contentSignature } from './write-gate.js';
export const uid = () => globalThis.crypto.randomUUID();
export const clone = value => structuredClone(value);
export const keyOf = (classId, timeSlotId) => `${classId}::${timeSlotId}`;


const compactName = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/gi,'d').toLowerCase().replace(/[^a-z0-9]/g,'');
export function subjectTrack(subject) {
 const n=compactName(subject?.name),code=compactName(subject?.code);
 if(['cddiali','cddialy','gdktpl','cdnguvan','cdtinhoc','diali','dialy'].includes(n)||['gdktpl','gdktvapl','diali','dialy'].includes(code))return 'XH';
 if(['cdhoa','cdhoahoc','hoa','hoahoc','sinh','sinhhoc','cdtoan','cdvatli','cdvatly'].includes(n))return 'TN';
 if(['toan','nguvan','van','ngoaingu','tienganh','lichsu','vatli','vatly','vatlydaitra','vatlidaitra','tinhoc','hdtnhn','hoatdongtrainghiemhuongnghiep','gddpdiali','gddpdialy','theduc','chaoco','shl','sinhhoatlop','taesl','clb'].includes(n)||['chaoco','hdtn_hn','ta_esl','clb'].includes(code))return 'COMMON';
 return null;
}
export function subjectsForClass(state,classId,track='') {
 const cls=state.classes.find(c=>c.id===classId);
 return state.subjects.filter(s=>cls?.grade!==11 || (subjectTrack(s) && (!track || subjectTrack(s)===track)));
}
export function jointPartner(state,classId,subjectId) {
 const subject=state.subjects.find(s=>s.id===subjectId);
 if(!['theduc','gdqpan','gdqpanninh','giaoducquocphonganninh'].includes(compactName(subject?.name)) && !['theduc','gdqpan'].includes(compactName(subject?.code)))return null;
 const cls=state.classes.find(c=>c.id===classId);if(![10,12].includes(cls?.grade))return null;
 const identity=c=>[c.code,c.name].map(compactName).find(n=>new RegExp('^(lop)?'+c.grade+'(xh|tn)$').test(n))||'';
 const n=identity(cls);if(!n)return null;const target=n.endsWith('xh')?'tn':'xh';
 return state.classes.find(c=>c.id!==classId&&c.grade===cls.grade&&identity(c).endsWith(target))||null;
}
export function cellLessons(state,cell) {
 if(!cell)return [];
 return [{...cell,parallelLessons:undefined,track:subjectTrack(state.subjects.find(s=>s.id===cell.subjectId))||'COMMON'},...(cell.parallelLessons||[]).map(l=>({...cell,...l,id:cell.id,parallelLessons:undefined}))];
}
export function allLessons(state,cells=state.timetableCells||[]) {return cells.flatMap(c=>cellLessons(state,c));}
export function validJointPair(state,a,b){return a.subjectId===b.subjectId && a.teacherId===b.teacherId && a.timeSlotId===b.timeSlotId && jointPartner(state,a.classId,a.subjectId)?.id===b.classId;}
export function lessonBusy(state,{classId,timeSlotId,subjectId,teacherId},cells=state.timetableCells) {
 const candidate={classId,timeSlotId,subjectId,teacherId};const track=subjectTrack(state.subjects.find(s=>s.id===subjectId));
 const found=allLessons(state,cells).find(c=>c.teacherId&&c.teacherId===teacherId&&c.timeSlotId===timeSlotId&&
   !(c.classId===classId&&(state.classes.find(x=>x.id===classId)?.grade!==11||track==='COMMON'||c.track===track||c.track==='COMMON'))&&!validJointPair(state,candidate,c));
 return {isBusy:!!found,conflictingClass:found?state.classes.find(c=>c.id===found.classId):null,conflictingCell:found};
}

export function effectiveTeacher(cell, state) {
  return cell.teacherId || '';
}

export function findConflicts(state,cells=state.timetableCells) {
 const groups=new Map();for(const cell of allLessons(state,cells)){if(!cell.teacherId)continue;const k=keyOf(cell.teacherId,cell.timeSlotId);groups.set(k,[...(groups.get(k)||[]),cell]);}
 return [...groups.values()].filter(g=>g.length>1 && !(g.length===2&&validJointPair(state,g[0],g[1])));
}

export function assignTeacherToClassSubject(state, { classId, subjectId, teacherId }) {
  if (!state.classes.some(c => c.id === classId)) {
    throw Error('Lớp học không tồn tại.');
  }
  if (!state.subjects.some(s => s.id === subjectId)) {
    throw Error('Môn học không tồn tại.');
  }
  if (teacherId && !state.teachers.some(t => t.id === teacherId)) {
    throw Error('Giáo viên không tồn tại.');
  }

  // 1. Synchronize draftAssignments
  let nextAssignments = (state.draftAssignments || []).filter(a => !(a.classId === classId && a.subjectId === subjectId));
  if (teacherId) {
    nextAssignments.push({ classId, subjectId, teacherId });
  }

  // 2. Synchronize teachers assignments
  const nextTeachers = (state.teachers || []).map(t => {
    let assignments = Array.isArray(t.assignments) ? [...t.assignments] : [];
    if (t.id !== teacherId) {
      assignments = assignments.filter(a => !(a.classId === classId && a.subjectId === subjectId));
    } else {
      if (!assignments.some(a => a.classId === classId && a.subjectId === subjectId)) {
        assignments.push({ classId, subjectId });
      }
    }
    return { ...t, assignments };
  });

  // 3. Keep draftSchedule & timetableCells synchronized for this class & subject
  const partner=jointPartner(state,classId,subjectId);
  const update=cell=>{
   if(![classId,partner?.id].includes(cell.classId))return cell;
   return {...cell,...(cell.subjectId===subjectId?{teacherId:teacherId||''}:{}),...(cell.parallelLessons?{parallelLessons:cell.parallelLessons.map(l=>l.subjectId===subjectId?{...l,teacherId:teacherId||''}:l)}:{})};
  };
  const nextSchedule=(state.draftSchedule||[]).map(update),nextCells=(state.timetableCells||[]).map(update);

  return {
    ...state,
    draftAssignments: nextAssignments,
    teachers: nextTeachers,
    draftSchedule: nextSchedule,
    timetableCells: nextCells
  };
}

export function unassignClassSubject(state, { classId, subjectId }) {
  return assignTeacherToClassSubject(state, { classId, subjectId, teacherId: '' });
}

export function getAssignedTeacher(state, classId, subjectId) {
  // Check draftAssignments first
  const draftItem = (state.draftAssignments || []).find(a => a.classId === classId && a.subjectId === subjectId);
  if (draftItem && draftItem.teacherId) {
    const t = (state.teachers || []).find(tea => tea.id === draftItem.teacherId);
    if (t) return t;
  }

  // Check teacher assignments
  const byAssignment = (state.teachers || []).find(t =>
    Array.isArray(t.assignments) && t.assignments.some(a => a.classId === classId && a.subjectId === subjectId)
  );
  if (byAssignment) return byAssignment;

  // Fallback to timetable cells
  const cell = allLessons(state,state.timetableCells || state.draftSchedule || []).find(c => c.classId === classId && c.subjectId === subjectId && c.teacherId);
  if (cell?.teacherId) {
    return (state.teachers || []).find(t => t.id === cell.teacherId) || null;
  }
  return null;
}

export function putCell(state,cell,{allowConflict=false}={}) {
 if(!state.classes.some(c=>c.id===cell.classId)||!state.timeSlots.some(s=>s.id===cell.timeSlotId)||!cell.subjectId)throw Error('Lớp, môn hoặc tiết học không hợp lệ.');
 let subjects = state.subjects || [];
 if(!subjects.some(s=>s.id===cell.subjectId)) {
   subjects = [...subjects, { id: cell.subjectId, code: cell.subjectId.toUpperCase(), name: cell.subjectId }];
 }
 if(cell.teacherId&&!state.teachers.some(t=>t.id===cell.teacherId))throw Error('Giáo viên không tồn tại.');
 const previous=state.timetableCells.find(c=>c.classId===cell.classId&&c.timeSlotId===cell.timeSlotId);
 if(previous?.locked)throw Error('Ô này đang khóa. Hãy mở khóa trước khi sửa.');
 const cls=state.classes.find(c=>c.id===cell.classId),track=subjectTrack(subjects.find(s=>s.id===cell.subjectId));
 if(cls.grade===11&&!track)throw Error('Môn này không thuộc danh mục tổ hợp lớp 11.');
 let saved={...cell,id:previous?.id||uid()};delete saved.parallelLessons;
 if(cls.grade===11&&track!=='COMMON'){
   const others=cellLessons(state,previous).filter(l=>l.track!==track&&l.track!=='COMMON');
   saved.track=track;if(others.length)saved.parallelLessons=others.map(l=>({track:l.track,subjectId:l.subjectId,teacherId:l.teacherId,note:l.note||''}));
 }
 let cells=state.timetableCells.filter(c=>c!==previous);const partner=jointPartner(state,cell.classId,cell.subjectId);
 if(partner){const other=cells.find(c=>c.classId===partner.id&&c.timeSlotId===cell.timeSlotId);
   if(other?.locked)throw Error('Ô lớp ghép đang khóa. Hãy mở khóa trước khi sửa.');
   if(other&&other.subjectId!==cell.subjectId)throw Error('Ô lớp ghép đã có môn khác. Hãy xóa hoặc chuyển tiết đó trước.');
   cells=cells.filter(c=>c!==other);cells.push({...saved,id:other?.id||uid(),classId:partner.id});
 }else if(previous){const oldPartner=jointPartner(state,previous.classId,previous.subjectId);if(oldPartner){const old=cells.find(c=>c.classId===oldPartner.id&&c.timeSlotId===cell.timeSlotId&&validJointPair(state,previous,c));if(old?.locked)throw Error('Ô lớp ghép đang khóa.');cells=cells.filter(c=>c!==old);}}
 cells.push(saved);
 if(!allowConflict&&findConflicts(state,cells).some(g=>g.some(c=>c.timeSlotId===cell.timeSlotId&&[cell.classId,partner?.id].includes(c.classId))))throw Error('Giáo viên đã có lịch tại lớp khác trong tiết này.');
 const teachers=state.teachers.map(t=>{const assignments=[...(t.assignments||[])];for(const c of allLessons(state,cells.filter(x=>x.timeSlotId===cell.timeSlotId&&[cell.classId,partner?.id].includes(x.classId))))if(c.teacherId===t.id&&!assignments.some(a=>a.classId===c.classId&&a.subjectId===c.subjectId))assignments.push({classId:c.classId,subjectId:c.subjectId});return {...t,assignments};});
 return {...state,subjects,teachers,timetableCells:cells,draftSchedule:clone(cells)};
}
export function deleteCell(state,classId,timeSlotId,track='') {
 const existing=state.timetableCells.find(c=>c.classId===classId&&c.timeSlotId===timeSlotId);if(existing?.locked)throw Error('Ô này đang khóa. Hãy mở khóa trước khi xóa.');
 let cells=state.timetableCells.filter(c=>c!==existing);
 if(existing&&track&&state.classes.find(c=>c.id===classId)?.grade===11){const remaining=cellLessons(state,existing).filter(l=>l.track!==track);if(remaining.length){const keep={...remaining[0]};delete keep.parallelLessons;cells.push(keep);}}
 const partner=existing&&jointPartner(state,classId,existing.subjectId);if(partner){const other=cells.find(c=>c.classId===partner.id&&c.timeSlotId===timeSlotId&&validJointPair(state,existing,c));if(other?.locked)throw Error('Ô lớp ghép đang khóa. Hãy mở khóa trước khi xóa.');cells=cells.filter(c=>c!==other);}
 return {...state,timetableCells:cells,draftSchedule:clone(cells)};
}

export function deleteEntity(state, kind, id) {
  const ref = { classes: 'classId', subjects: 'subjectId', teachers: 'teacherId' }[kind];
  if (!ref) throw Error('Danh mục không hợp lệ.');
  if (state.timetableCells.some(c => c[ref] === id)) {
    throw Error('Đang được dùng trong thời khóa biểu. Hãy sửa các ô liên quan trước khi xóa.');
  }
  return { ...state, [kind]: state[kind].filter(item => item.id !== id) };
}

export function makeSnapshot(state, name) {
  return {
    id: uid(),
    name,
    createdAt: new Date().toISOString(),
    data: clone({
      school: state.school,
      classes: state.classes,
      subjects: state.subjects,
      teachers: state.teachers,
      timeSlots: state.timeSlots,
      timetableCells: state.timetableCells
    })
  };
}

export function restoreSnapshot(state, version) {
  return { ...state, ...clone(version.data) };
}

export function publish(state) {
  if (!state.timetableCells.length) throw Error('Thời khóa biểu còn trống.');
  if (findConflicts(state).length) throw Error('Hãy xử lý lịch trùng giáo viên trước khi chốt lịch.');
  return {
    ...state,
    published: {
      ...makeSnapshot(state, 'Bản đã chốt'),
      publishedAt: new Date().toISOString()
    }
  };
}

const REMOVED_CLB_CLASSES_T3 = new Set(['cls_8a1', 'cls_8a2', 'cls_8a3', 'cls_9a1', 'cls_9a2', 'cls_9a3', 'cls_10tn', 'cls_10xh', 'cls_11']);
const REMOVED_CLB_CLASSES_T5 = new Set(['cls_6a1', 'cls_6a2', 'cls_6a3', 'cls_7a1', 'cls_7a2', 'cls_7a3']);

export function isRemovedFixedCell(cell) {
  if (!cell) return false;
  if (cell.restored || cell.userAssigned) return false;
  const { classId, timeSlotId, subjectId } = cell;

  // 1. Xoá tiết cố định TA ESL ở 2 lớp 12XH và 12TN vào các tiết chiều thứ 2, thứ tư, thứ sáu
  if ((classId === 'cls_12xh' || classId === 'cls_12tn') &&
      subjectId === 'subj_ta_esl' &&
      /^ts_d[246]_a_[1-4]$/.test(timeSlotId)) {
    return true;
  }

  // 2. Chiều thứ 3 lớp 8A1, 8A2, 8A3, 9A1, 9A2, 9A3, 10TN, 10XH và 11 xoá tiết 3, 4 cố định CLB
  if (REMOVED_CLB_CLASSES_T3.has(classId) &&
      subjectId === 'subj_clb' &&
      (timeSlotId === 'ts_d3_a_3' || timeSlotId === 'ts_d3_a_4')) {
    return true;
  }

  // 3. Chiều thứ 5 lớp 6A1, 6A2, 6A3, 7A1, 7A2, 7A3 xoá tiết 3, 4 cố định CLB
  if (REMOVED_CLB_CLASSES_T5.has(classId) &&
      subjectId === 'subj_clb' &&
      (timeSlotId === 'ts_d5_a_3' || timeSlotId === 'ts_d5_a_4')) {
    return true;
  }

  // 4. Lớp 12TN và 12XH thứ 3 và thứ 5 chiều tiết 3-4 không có tiết câu lạc bộ (CLB)
  if ((classId === 'cls_12xh' || classId === 'cls_12tn') &&
      subjectId === 'subj_clb' &&
      (timeSlotId === 'ts_d3_a_3' || timeSlotId === 'ts_d3_a_4' || timeSlotId === 'ts_d5_a_3' || timeSlotId === 'ts_d5_a_4')) {
    return true;
  }

  return false;
}

export function filterRemovedFixedCells(cells = []) {
  return (cells || []).filter(c => !isRemovedFixedCell(c));
}

export function isTeacherBusy(teacherId, day, period, currentClassId, schedule = [], timeSlotId = '') {
  if (!teacherId || !schedule || !Array.isArray(schedule)) return { isBusy: false, conflictingClass: null, conflictingCell: null };

  const cell = schedule.find(c => {
    if (!c.teacherId || c.teacherId !== teacherId) return false;
    // Don't flag conflict with the same class's cell
    if (currentClassId && c.classId === currentClassId) {
      if (timeSlotId && c.timeSlotId === timeSlotId) return false;
      if (String(c.day) === String(day) && Number(c.period) === Number(period)) return false;
    }

    if (timeSlotId && c.timeSlotId) {
      return c.timeSlotId === timeSlotId;
    }
    return String(c.day) === String(day) && Number(c.period) === Number(period);
  });

  if (cell) {
    return {
      isBusy: true,
      conflictingClass: { id: cell.classId, name: cell.classId },
      conflictingCell: cell,
      classId: cell.classId
    };
  }
  return { isBusy: false, conflictingClass: null, conflictingCell: null };
}

export function formatPublicationTime(date = new Date()) {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const MM = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${hh}:${mm} - ${dd}/${MM}/${yyyy}`;
}

export function publishDraft(state) {
  const draft = clone(state);
  normalizeState(draft);
  draft.publishedAssignments = clone(draft.draftAssignments || []);
  draft.publishedSchedule = clone(draft.draftSchedule || []);
  draft.lastPublishedAt = formatPublicationTime(new Date());
  draft.published = {
    ...makeSnapshot(draft, 'Bản đã chốt'),
    publishedAt: new Date().toISOString(),
    displayTime: draft.lastPublishedAt
  };
  draft.activeVersion = 'published';
  return draft;
}

export function restoreDraftFromPublished(state) {
  const draft = clone(state);
  normalizeState(draft);
  if (!draft.publishedSchedule || draft.publishedSchedule.length === 0) {
    if (draft.published?.data?.timetableCells) {
      draft.publishedSchedule = clone(draft.published.data.timetableCells);
    }
  }
  draft.draftAssignments = clone(draft.publishedAssignments || []);
  draft.draftSchedule = clone(draft.publishedSchedule || []);
  draft.timetableCells = clone(draft.draftSchedule || []);
  draft.activeVersion = 'draft';
  return draft;
}

export function assignLessonToScheduleCell(state,{classId,timeSlotId,day,period,subjectId,teacherId,note='',allowConflict=false}) {
 const slot=state.timeSlots.find(s=>s.id===timeSlotId)||state.timeSlots.find(s=>('Thứ '+s.dayOfWeek)===day&&s.period===Number(period));
 if(!slot)throw Error('Khung tiết không hợp lệ.');
 return putCell(state,{classId,timeSlotId:slot.id,day:day||('Thứ '+slot.dayOfWeek),period:period||slot.period,subjectId,teacherId:teacherId||'',note,locked:false},{allowConflict});
}
export function removeLessonFromScheduleCell(state,{classId,timeSlotId,day,period,track=''}) {
 const slot=state.timeSlots.find(s=>s.id===timeSlotId)||state.timeSlots.find(s=>('Thứ '+s.dayOfWeek)===day&&s.period===Number(period));
 return deleteCell(state,classId,slot?.id||timeSlotId,track);
}

export function normalizeState(state) {
  if (!state || typeof state !== 'object') return state;

  state.activeVersion = state.activeVersion || 'draft';

  if (state.school) {
    if (!state.school.currentWeek) state.school.currentWeek = 'Tuần 1';
    if (!state.school.weekDates) state.school.weekDates = '05/09 - 10/09/2026';
  }

  if (Array.isArray(state.classes)) {
    for (const c of state.classes) {
      if (c.homeroomTeacherId === undefined) {
        c.homeroomTeacherId = null;
      }
      if (!c.weekInfo) {
        c.weekInfo = {
          week: state.school?.currentWeek || 'Tuần 1',
          dates: state.school?.weekDates || '05/09 - 10/09/2026'
        };
      } else {
        if (!c.weekInfo.week) c.weekInfo.week = state.school?.currentWeek || 'Tuần 1';
        if (!c.weekInfo.dates) c.weekInfo.dates = state.school?.weekDates || '05/09 - 10/09/2026';
      }
    }
  }

  if (Array.isArray(state.teachers)) {
    for (const t of state.teachers) {
      if (!Array.isArray(t.assignments)) {
        t.assignments = [];
      }
      // Sync name & fullName
      if (!t.fullName && t.name) t.fullName = t.name;
      if (!t.name && t.fullName) t.name = t.fullName;
    }
  }

  if (Array.isArray(state.timetableCells)) {
    state.timetableCells = filterRemovedFixedCells(state.timetableCells);
  }

  // Initialize draftAssignments
  if (!Array.isArray(state.draftAssignments)) {
    state.draftAssignments = [];
  }
  // Backfill draftAssignments from teacher assignments if empty
  if (state.draftAssignments.length === 0 && Array.isArray(state.teachers)) {
    for (const t of state.teachers) {
      for (const a of (t.assignments || [])) {
        if (!state.draftAssignments.some(da => da.classId === a.classId && da.subjectId === a.subjectId)) {
          state.draftAssignments.push({ classId: a.classId, subjectId: a.subjectId, teacherId: t.id });
        }
      }
    }
  }

  // Ensure 2-way sync: teacher assignments match draftAssignments
  if (Array.isArray(state.draftAssignments) && Array.isArray(state.teachers)) {
    for (const da of state.draftAssignments) {
      if (da.teacherId) {
        const t = state.teachers.find(tea => tea.id === da.teacherId);
        if (t) {
          if (!t.assignments.some(a => a.classId === da.classId && a.subjectId === da.subjectId)) {
            t.assignments.push({ classId: da.classId, subjectId: da.subjectId });
          }
        }
      }
    }
  }

  // Initialize draftSchedule from timetableCells
  if (!Array.isArray(state.draftSchedule)) {
    state.draftSchedule = [];
  }
  if (state.draftSchedule.length === 0 && Array.isArray(state.timetableCells) && state.timetableCells.length > 0) {
    state.draftSchedule = state.timetableCells.map(c => {
      const slot = (state.timeSlots || []).find(s => s.id === c.timeSlotId);
      return {
        ...c,
        id: c.id || uid(),
        day: c.day || slot?.dayName || `Thứ ${slot?.dayOfWeek || ''}`,
        period: c.period || slot?.period || 1,
        timeSlotId: c.timeSlotId,
        classId: c.classId,
        subjectId: c.subjectId,
        teacherId: c.teacherId || '',
        locked: !!c.locked,
        note: c.note || ''
      };
    });
  }

  if (Array.isArray(state.draftSchedule)) {
    state.draftSchedule = filterRemovedFixedCells(state.draftSchedule);
  }

  // Initialize publishedAssignments & publishedSchedule
  if (!Array.isArray(state.publishedAssignments)) {
    state.publishedAssignments = [];
  }
  if (!Array.isArray(state.publishedSchedule)) {
    state.publishedSchedule = [];
  }
  if (state.lastPublishedAt === undefined) {
    state.lastPublishedAt = null;
  }

  // If published exists from previous version, backfill publishedSchedule
  if (state.published?.data?.timetableCells && state.publishedSchedule.length === 0) {
    state.publishedSchedule = filterRemovedFixedCells(state.published.data.timetableCells);
    if (!state.lastPublishedAt && state.published.publishedAt) {
      state.lastPublishedAt = formatPublicationTime(state.published.publishedAt);
    }
  }

  if (!Array.isArray(state.changeHistory)) {
    state.changeHistory = [];
  }

  return state;
}

const arrays = ['classes', 'subjects', 'teachers', 'timeSlots', 'timetableCells'];

export function validateState(state) {
  if (!state || typeof state !== 'object') throw Error('Dữ liệu không hợp lệ.');
  normalizeState(state);
  if (!state.school || typeof state.school.name !== 'string' || typeof state.school.year !== 'string' || typeof state.school.term !== 'string') {
    throw Error('Thiếu thông tin trường/năm học/học kỳ.');
  }
  for (const kind of arrays) {
    if (!Array.isArray(state[kind])) throw Error(`Thiếu danh sách ${kind}.`);
    const ids = new Set();
    for (const item of state[kind]) {
      if (!item || typeof item.id !== 'string' || !item.id || ids.has(item.id)) throw Error(`ID trống hoặc trùng trong ${kind}.`);
      ids.add(item.id);
    }
  }
  for (const c of state.classes) {
    if (typeof c.code !== 'string' || typeof c.name !== 'string' || !Number.isInteger(c.grade) || c.grade < 1 || c.grade > 12) {
      throw Error('Thông tin lớp không hợp lệ.');
    }
  }
  for (const t of state.teachers) {
    if (typeof t.fullName !== 'string' || typeof t.code !== 'string') {
      throw Error('Thông tin giáo viên không hợp lệ.');
    }
  }
  for (const s of state.subjects) {
    if (typeof s.name !== 'string' || typeof s.code !== 'string' || !/^#[0-9a-f]{6}$/i.test(s.color)) {
      throw Error('Thông tin môn học không hợp lệ.');
    }
  }
  const slots = new Set();
  for (const s of state.timeSlots) {
    const key = `${s.dayOfWeek}:${s.session}:${s.period}`;
    if (
      slots.has(key) ||
      ![2, 3, 4, 5, 6].includes(s.dayOfWeek) ||
      !['MORNING', 'AFTERNOON'].includes(s.session) ||
      !Number.isInteger(s.period) ||
      s.period < 1 ||
      s.period > (s.session === 'MORNING' ? 5 : 4) ||
      !/^\d{2}:\d{2}$/.test(s.startTime) ||
      !/^\d{2}:\d{2}$/.test(s.endTime)
    ) {
      throw Error('Khung tiết học không hợp lệ hoặc trùng.');
    }
    slots.add(key);
  }
  if (state.timeSlots.length !== 45) {
    throw Error('Ma trận cần đủ 45 tiết: thứ Hai–thứ Sáu, 5 tiết sáng và 4 tiết chiều.');
  }
  for(const parent of state.timetableCells){
   if(parent.parallelLessons!==undefined){
    if(state.classes.find(c=>c.id===parent.classId)?.grade!==11||!Array.isArray(parent.parallelLessons)||parent.parallelLessons.length!==1)throw Error('Cấu trúc tổ hợp song song không hợp lệ.');
    const lessons=cellLessons(state,parent);if(new Set(lessons.map(l=>l.track)).size!==2||!lessons.every(l=>['TN','XH'].includes(l.track)&&subjectTrack(state.subjects.find(s=>s.id===l.subjectId))===l.track&&(!l.teacherId||state.teachers.some(t=>t.id===l.teacherId))))throw Error('Môn hoặc giáo viên tổ hợp không hợp lệ.');
   }
  }
  const occupied = new Set();
  for (const c of state.timetableCells) {
    const key = keyOf(c.classId, c.timeSlotId);
    if (occupied.has(key)) throw Error('Có nhiều tiết học trong cùng một ô.');
    occupied.add(key);
    if (!state.classes.some(x => x.id === c.classId) || !state.subjects.some(x => x.id === c.subjectId) || !state.timeSlots.some(x => x.id === c.timeSlotId) || (c.teacherId && !state.teachers.some(x => x.id === c.teacherId))) {
      throw Error('Có ô lịch tham chiếu danh mục không tồn tại.');
    }
    if (c.teacherId !== undefined && typeof c.teacherId !== 'string') throw Error('Mã giáo viên không hợp lệ.');
    if (c.note !== undefined && typeof c.note !== 'string') throw Error('Ghi chú không hợp lệ.');
  }
  if (!Array.isArray(state.versions)) throw Error('Danh sách phiên bản không hợp lệ.');
  return state;
}

export function validateSnapshot(snapshot) {
  if (!snapshot || typeof snapshot.id !== 'string' || typeof snapshot.name !== 'string' || !snapshot.data) {
    throw Error('Phiên bản lưu không hợp lệ.');
  }
  if (typeof snapshot.createdAt !== 'string' || !Number.isFinite(Date.parse(snapshot.createdAt))) {
    throw Error('Ngày lưu phiên bản không hợp lệ.');
  }
  validateState({ ...snapshot.data, versions: [], published: null });
  return snapshot;
}

export function parseBackup(raw, seed) {
  const data = typeof raw === 'string' ? JSON.parse(raw) : clone(raw);
  const old = data.academicYear !== undefined;
  let state;
  if (old) {
    state = {
      schemaVersion: 1,
      school: {
        name: data.academicYear?.schoolName || 'Trường THCS & THPT',
        year: data.academicYear?.name || '2026–2027',
        term: data.academicYear?.currentTerm || 'HK1',
        appliedDate: ''
      },
      classes: data.classes,
      subjects: data.subjects?.map(s => ({
        id: s.id,
        code: s.code,
        name: s.name,
        color: /^#[0-9a-f]{6}$/i.test(s.displayColor) ? s.displayColor : '#d9e7f6'
      })),
      teachers: data.teachers?.map(t => ({
        id: t.id,
        code: t.code,
        fullName: t.fullName
      })),
      timeSlots: data.timeSlots || clone(seed.timeSlots),
      timetableCells: (data.timetableCells || []).map(c => ({
        id: c.id || uid(),
        classId: c.classId,
        subjectId: c.subjectId,
        teacherId: c.teacherId || '',
        timeSlotId: c.timeSlotId,
        locked: !!c.locked,
        note: c.note || ''
      })),
      versions: [],
      published: null
    };
  } else {
    // Earlier cloud exports omit schemaVersion; still run the full validation below.
    if (data.schemaVersion === undefined && data.school &&
        ['classes', 'subjects', 'teachers', 'timeSlots', 'timetableCells'].every(key => Array.isArray(data[key]))) {
      data.schemaVersion = 1;
    }
    if (data.schemaVersion !== 1) throw Error('Phiên bản tệp sao lưu chưa được hỗ trợ.');
    state = data;
    for (const version of state.versions || []) validateSnapshot(version);
    if (state.published) {
      validateSnapshot(state.published);
      if (typeof state.published.publishedAt !== 'string' || !Number.isFinite(Date.parse(state.published.publishedAt))) {
        throw Error('Ngày chốt lịch không hợp lệ.');
      }
    }
  }
  return validateState(state);
}

export function exportCsv(state) {
  const safe = value => {
    let text = String(value ?? '');
    if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  const rows = [['Thứ', 'Buổi', 'Tiết', 'Thời gian', ...state.classes.map(c => c.name)]];
  for (const slot of state.timeSlots) {
    rows.push([
      `Thứ ${slot.dayOfWeek}`,
      slot.session === 'MORNING' ? 'Sáng' : 'Chiều',
      slot.period,
      `${slot.startTime}-${slot.endTime}`,
      ...state.classes.map(cls => {
        const c = state.timetableCells.find(c => c.classId === cls.id && c.timeSlotId === slot.id);
        return c ? cellLessons(state,c).map(l=>[state.subjects.find(s=>s.id===l.subjectId)?.name||'',state.teachers.find(t=>t.id===l.teacherId)?.fullName||''].filter(Boolean).join(' — ')).join(' / ') : '';
      })
    ]);
  }
  return '\uFEFF' + rows.map(r => r.map(safe).join(',')).join('\r\n');
}

export function removeVietnameseTones(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

export function generateSubjectCode(name, existingSubjects = []) {
  const clean = removeVietnameseTones(name).toUpperCase().replace(/[^A-Z0-9]/g, '');
  let base = clean.slice(0, 6) || 'MON';
  let candidate = base;
  let counter = 1;
  const codes = new Set((existingSubjects || []).map(s => String(s.code || '').toUpperCase()));
  while (codes.has(candidate)) {
    candidate = `${base.slice(0, 4)}${counter++}`;
  }
  return candidate;
}

export function generateTeacherCode(fullName, existingTeachers = []) {
  const clean = removeVietnameseTones(fullName).trim();
  const words = clean.split(/\s+/).filter(Boolean);
  let base = words.map(w => w[0]?.toUpperCase() || '').join('');
  if (base.length < 2) base = clean.slice(0, 3).toUpperCase() || 'GV';
  let candidate = base;
  let counter = 1;
  const codes = new Set((existingTeachers || []).map(t => String(t.code || '').toUpperCase()));
  while (codes.has(candidate)) {
    candidate = `${base}${counter++}`;
  }
  return candidate;
}

const PALETTE = ['#2563eb', '#16a34a', '#d97706', '#9333ea', '#0284c7', '#dc2626', '#0d9488', '#ea580c'];

export function resolveSubjectAndTeacher(state, { quickLine = '', subjectInput = '', teacherInput = '', subjectId = '', teacherId = '' } = {}) {
  const draft = clone(state);
  draft.subjects = draft.subjects || [];
  draft.teachers = draft.teachers || [];

  let rawSub = String(subjectInput || '').trim();
  let rawTea = String(teacherInput || '').trim();

  // If quickLine is given (e.g. "Toán - Nguyễn Văn A" or "VAN - Tran Thi B")
  if (quickLine && quickLine.trim()) {
    const parts = quickLine.trim().split(/[-–—]/).map(s => s.trim()).filter(Boolean);
    if (parts.length >= 1) rawSub = parts[0];
    if (parts.length >= 2) rawTea = parts[1];
  }

  // If text inputs are empty, fallback to dropdown IDs
  if (!rawSub && subjectId) {
    const existing = draft.subjects.find(s => s.id === subjectId);
    if (existing) rawSub = existing.id;
  }
  if (!rawTea && teacherId) {
    const existing = draft.teachers.find(t => t.id === teacherId);
    if (existing) rawTea = existing.id;
  }

  if (!rawSub) {
    return { subjectId: '', teacherId: '', state: draft };
  }

  // 1. Resolve Subject
  let matchedSub = draft.subjects.find(s => s.id === rawSub);
  if (!matchedSub) {
    const lower = rawSub.toLowerCase();
    matchedSub = draft.subjects.find(s => (s.code || '').toLowerCase() === lower);
  }
  if (!matchedSub) {
    const lower = rawSub.toLowerCase();
    matchedSub = draft.subjects.find(s => (s.name || '').toLowerCase() === lower);
  }
  if (!matchedSub) {
    const lower = rawSub.toLowerCase();
    matchedSub = draft.subjects.find(s => (s.name || '').toLowerCase().includes(lower) || lower.includes((s.name || '').toLowerCase()));
  }
  if (!matchedSub) {
    // Auto-create new subject
    const newSub = {
      id: uid(),
      code: generateSubjectCode(rawSub, draft.subjects),
      name: rawSub,
      color: PALETTE[draft.subjects.length % PALETTE.length]
    };
    draft.subjects.push(newSub);
    matchedSub = newSub;
  }

  // 2. Resolve Teacher
  let matchedTea = null;
  if (rawTea) {
    matchedTea = draft.teachers.find(t => t.id === rawTea);
    if (!matchedTea) {
      const lower = rawTea.toLowerCase();
      matchedTea = draft.teachers.find(t => (t.code || '').toLowerCase() === lower);
    }
    if (!matchedTea) {
      const lower = rawTea.toLowerCase();
      matchedTea = draft.teachers.find(t => (t.fullName || '').toLowerCase() === lower);
    }
    if (!matchedTea) {
      const lower = rawTea.toLowerCase();
      matchedTea = draft.teachers.find(t => (t.fullName || '').toLowerCase().includes(lower) || lower.includes((t.fullName || '').toLowerCase()));
    }
    if (!matchedTea) {
      // Auto-create new teacher
      const newTea = {
        id: uid(),
        code: generateTeacherCode(rawTea, draft.teachers),
        fullName: rawTea
      };
      draft.teachers.push(newTea);
      matchedTea = newTea;
    }
  }

  return {
    subjectId: matchedSub ? matchedSub.id : '',
    teacherId: matchedTea ? matchedTea.id : '',
    state: draft
  };
}

export function normalizeHeaderKey(str) {
  return removeVietnameseTones(String(str || ''))
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function isHeaderRow(row) {
  if (!Array.isArray(row)) return false;
  return row.some(cell => {
    const key = normalizeHeaderKey(cell);
    return /(hoten|hovaten|tengiaovien|tengv|fullname|name)/.test(key);
  });
}

function parse2DArrayTeacherRows(rows) {
  if (!rows || !rows.length) return [];

  // Find header row in first 12 rows
  let headerIndex = -1;
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    if (isHeaderRow(rows[i])) {
      headerIndex = i;
      break;
    }
  }

  let colMap = { name: -1, code: -1, phone: -1, email: -1, note: -1 };

  if (headerIndex !== -1) {
    const headerRow = rows[headerIndex];
    headerRow.forEach((cell, idx) => {
      const k = normalizeHeaderKey(cell);
      if (/(hoten|hovaten|tengiaovien|tengv|fullname|name)/.test(k) && colMap.name === -1) colMap.name = idx;
      else if (/(magv|magiaovien|code|ma|kyhieu)/.test(k) && colMap.code === -1) colMap.code = idx;
      else if (/(sdt|sodienthoai|dienthoai|phone|mobile)/.test(k) && colMap.phone === -1) colMap.phone = idx;
      else if (/(email|thudientu|mail)/.test(k) && colMap.email === -1) colMap.email = idx;
      else if (/(ghichu|note|monday|bomon|chuyenmon)/.test(k) && colMap.note === -1) colMap.note = idx;
    });
  } else {
    // Fallback: heuristic mapping
    // Column 0 is often STT or Code; Column 1 is Name
    colMap = { name: 1, code: 0, phone: 2, email: 3, note: 4 };
    headerIndex = -1;
  }

  const results = [];
  const startRow = headerIndex + 1;

  for (let r = startRow; r < rows.length; r++) {
    const row = rows[r];
    if (!Array.isArray(row) || !row.length) continue;

    let fullName = colMap.name !== -1 && row[colMap.name] !== undefined ? String(row[colMap.name]).trim() : '';
    let code = colMap.code !== -1 && row[colMap.code] !== undefined ? String(row[colMap.code]).trim() : '';
    const phone = colMap.phone !== -1 && row[colMap.phone] !== undefined ? String(row[colMap.phone]).trim() : '';
    const email = colMap.email !== -1 && row[colMap.email] !== undefined ? String(row[colMap.email]).trim() : '';
    const note = colMap.note !== -1 && row[colMap.note] !== undefined ? String(row[colMap.note]).trim() : '';

    // If fallback guessed col 1 is name but col 1 is empty and col 0 has text
    if (!fullName && headerIndex === -1 && row[0] && typeof row[0] === 'string' && row[0].trim().length > 2) {
      fullName = row[0].trim();
      code = '';
    }

    if (!fullName || fullName.length < 2) continue;
    // Skip if it looks like a header repetition or total row
    const norm = normalizeHeaderKey(fullName);
    if (/^(stt|hoten|hovaten|tongcong|cong|banso)$/.test(norm)) continue;

    results.push({ fullName, code, phone, email, note });
  }

  return results;
}

function parseObjectTeacherRows(objects) {
  const results = [];

  for (const obj of objects) {
    if (!obj || typeof obj !== 'object') continue;
    let fullName = '';
    let code = '';
    let phone = '';
    let email = '';
    let note = '';

    for (const [rawKey, val] of Object.entries(obj)) {
      const k = normalizeHeaderKey(rawKey);
      const strVal = val != null ? String(val).trim() : '';
      if (!strVal) continue;

      if (/^(hoten|hovaten|tengiaovien|tengv|fullname|name)$/.test(k) && !fullName) {
        fullName = strVal;
      } else if (/^(magv|magiaovien|code|ma|kyhieu)$/.test(k) && !code) {
        code = strVal;
      } else if (/^(sdt|sodienthoai|dienthoai|phone|mobile)$/.test(k) && !phone) {
        phone = strVal;
      } else if (/^(email|thudientu|mail)$/.test(k) && !email) {
        email = strVal;
      } else if (/^(ghichu|note|monday|bomon|chuyenmon)$/.test(k) && !note) {
        note = strVal;
      }
    }

    if (!fullName || fullName.length < 2) continue;
    const norm = normalizeHeaderKey(fullName);
    if (/^(stt|hoten|hovaten|tongcong|cong|banso)$/.test(norm)) continue;

    results.push({ fullName, code, phone, email, note });
  }

  return results;
}

export function parseTeacherRows(rawRows) {
  if (!Array.isArray(rawRows) || rawRows.length === 0) return [];
  if (Array.isArray(rawRows[0])) {
    return parse2DArrayTeacherRows(rawRows);
  }
  return parseObjectTeacherRows(rawRows);
}

export function importTeachersIntoState(state, teacherRows, { mode = 'merge' } = {}) {
  const parsed = parseTeacherRows(teacherRows);
  if (!parsed.length) {
    throw Error('Không tìm thấy dữ liệu giáo viên hợp lệ trong tệp.');
  }

  const draft = clone(state);
  draft.teachers = Array.isArray(draft.teachers) ? [...draft.teachers] : [];

  const existingByCode = new Map();
  const existingByName = new Map();

  for (const t of draft.teachers) {
    if (t.code) existingByCode.set(String(t.code).trim().toUpperCase(), t);
    if (t.fullName) existingByName.set(String(t.fullName).trim().toLowerCase(), t);
  }

  let added = 0;
  let updated = 0;
  let skipped = 0;
  const importedTeachers = [];

  for (const item of parsed) {
    const normName = item.fullName.trim().toLowerCase();
    const upperCode = item.code ? item.code.trim().toUpperCase() : '';

    let existing = null;
    if (upperCode && existingByCode.has(upperCode)) {
      existing = existingByCode.get(upperCode);
    } else if (existingByName.has(normName)) {
      existing = existingByName.get(normName);
    }

    if (existing) {
      if (mode === 'merge') {
        existing.fullName = item.fullName.trim();
        if (upperCode) existing.code = upperCode;
        if (item.phone) existing.phone = item.phone.trim();
        if (item.email) existing.email = item.email.trim();
        if (item.note) existing.note = item.note.trim();
        if (!Array.isArray(existing.assignments)) existing.assignments = [];
        updated++;
        importedTeachers.push({
          id: existing.id,
          code: existing.code,
          fullName: existing.fullName,
          status: 'UPDATED'
        });
      } else {
        skipped++;
        importedTeachers.push({
          id: existing.id,
          code: existing.code,
          fullName: existing.fullName,
          status: 'SKIPPED'
        });
      }
    } else {
      let finalCode = upperCode;
      if (!finalCode) {
        finalCode = generateTeacherCode(item.fullName, draft.teachers);
      }
      let counter = 1;
      const baseCode = finalCode;
      while (existingByCode.has(finalCode)) {
        finalCode = `${baseCode}_${counter++}`;
      }

      const newTeacher = {
        id: uid(),
        code: finalCode,
        fullName: item.fullName.trim(),
        assignments: [],
        ...(item.phone ? { phone: item.phone.trim() } : {}),
        ...(item.email ? { email: item.email.trim() } : {}),
        ...(item.note ? { note: item.note.trim() } : {})
      };

      draft.teachers.push(newTeacher);
      existingByCode.set(finalCode, newTeacher);
      existingByName.set(normName, newTeacher);
      added++;
      importedTeachers.push({
        id: newTeacher.id,
        code: newTeacher.code,
        fullName: newTeacher.fullName,
        status: 'NEW'
      });
    }
  }

  validateState(draft);

  return {
    state: draft,
    stats: {
      total: parsed.length,
      added,
      updated,
      skipped,
      teachers: importedTeachers
    }
  };
}

export const TEACHER_TEMPLATE_ROWS = [
  { 'STT': 1, 'Mã GV': 'GV01', 'Họ và tên': 'Nguyễn Văn An', 'Số điện thoại': '0912345678', 'Email': 'an.nguyen@truong.edu.vn', 'Ghi chú / Môn dạy': 'Toán học' },
  { 'STT': 2, 'Mã GV': 'GV02', 'Họ và tên': 'Trần Thị Bình', 'Số điện thoại': '0987654321', 'Email': 'binh.tran@truong.edu.vn', 'Ghi chú / Môn dạy': 'Ngữ văn' },
  { 'STT': 3, 'Mã GV': 'GV03', 'Họ và tên': 'Lê Hoàng Cường', 'Số điện thoại': '0903123456', 'Email': 'cuong.le@truong.edu.vn', 'Ghi chú / Môn dạy': 'Tiếng Anh' },
  { 'STT': 4, 'Mã GV': 'GV04', 'Họ và tên': 'Phạm Mai Dung', 'Số điện thoại': '0934567890', 'Email': 'dung.pham@truong.edu.vn', 'Ghi chú / Môn dạy': 'Vật lý' },
  { 'STT': 5, 'Mã GV': 'GV05', 'Họ và tên': 'Vũ Đức Giang', 'Số điện thoại': '0945678901', 'Email': 'giang.vu@truong.edu.vn', 'Ghi chú / Môn dạy': 'Hóa học' },
  { 'STT': 6, 'Mã GV': '', 'Họ và tên': 'Đặng Thu Hà (Tự sinh mã)', 'Số điện thoại': '0978901234', 'Email': 'ha.dang@truong.edu.vn', 'Ghi chú / Môn dạy': 'Sinh học' }
];

export function areTimetablesContentEqual(a,b) {
  if(a===b)return true;
  if(!a||!b)return false;
  return contentSignature(normalizeState(a))===contentSignature(normalizeState(b));
}

export function arePublishedContentEqual(existingPublishedData, newPublishedData) {
  if (existingPublishedData === newPublishedData) return true;
  if (!existingPublishedData || !newPublishedData) return false;
  const keys=['school','classes','subjects','teachers','timeSlots','timetableCells'];
  const pick=value=>Object.fromEntries(keys.map(key=>[key,structuredClone(value[key] || (key==='school'?{}:[]))]));
  return areTimetablesContentEqual(pick(existingPublishedData),pick(newPublishedData));
}

export function areAvailabilitiesEqual(a, b) {
  if (a === b) return true;
  if (!a && !b) return true;
  if (!a || !b) return false;
  const availA = (a.availableSlotIds || []).slice().sort().join('|');
  const availB = (b.availableSlotIds || []).slice().sort().join('|');
  const busyA = (a.busySlotIds || []).slice().sort().join('|');
  const busyB = (b.busySlotIds || []).slice().sort().join('|');
  const dateA = (a.dateRange?.text || '').trim();
  const dateB = (b.dateRange?.text || '').trim();
  const noteA = (a.note || '').trim();
  const noteB = (b.note || '').trim();
  return availA === availB && busyA === busyB && dateA === dateB && noteA === noteB;
}

export function areUserProfilesEqual(existing, updated) {
  if (existing === updated) return true;
  if (!existing || !updated) return false;

  if (updated.role !== undefined && (existing.role || '') !== updated.role) return false;
  if (updated.displayName !== undefined && (existing.displayName || '').trim() !== (updated.displayName || '').trim()) return false;
  if (updated.teacherId !== undefined && (existing.teacherId || '') !== (updated.teacherId || '')) return false;
  if (updated.isVisiting !== undefined && Boolean(existing.isVisiting) !== Boolean(updated.isVisiting)) return false;
  if (updated.active !== undefined && Boolean(existing.active) !== Boolean(updated.active)) return false;

  if (updated.homeroomClassIds !== undefined) {
    const hrA = (existing.homeroomClassIds || []).slice().sort().join('|');
    const hrB = (updated.homeroomClassIds || []).slice().sort().join('|');
    if (hrA !== hrB) return false;
  }

  if (updated.selfDeclared !== undefined) {
    const subA = (existing.selfDeclared?.subjects || []).slice().sort().join('|');
    const subB = (updated.selfDeclared?.subjects || []).slice().sort().join('|');
    if (subA !== subB) return false;
    const hrClsA = existing.selfDeclared?.homeroomClassId || '';
    const hrClsB = updated.selfDeclared?.homeroomClassId || '';
    if (hrClsA !== hrClsB) return false;
    const noteA = (existing.selfDeclared?.note || '').trim();
    const noteB = (updated.selfDeclared?.note || '').trim();
    if (noteA !== noteB) return false;
  }

  return true;
}

export function isQuotaExhaustedError(err) {
  if (!err) return false;
  const code = String(err.code || '').toLowerCase();
  const msg = String(err.message || err || '').toLowerCase();
  return (
    code === 'resource-exhausted' ||
    msg.includes('resource-exhausted') ||
    msg.includes('quota exceeded') ||
    msg.includes('quota_exceeded') ||
    msg.includes('vượt hạn mức')
  );
}

export function computeExportFileName(className, weekRaw) {
  const cleanClassName = String(className || '').replace(/^Lớp\s*/i, '').trim().replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1EA0-\u1EF9]/g, '') || 'Lop';
  const weekDigits = String(weekRaw || '').match(/\d+/);
  const cleanWeek = weekDigits ? weekDigits[0] : String(weekRaw || '').replace(/[^a-zA-Z0-9]/g, '') || '1';
  return `TKB_${cleanClassName}_Tuan_${cleanWeek}.png`;
}

// Bảng 43 màu đặc trưng độc lập cho 43 giáo viên toàn trường
export const TEACHER_COLORS_43 = [
  '#2563eb', // 01: Xanh hoàng gia (Royal Blue)
  '#059669', // 02: Xanh ngọc lục bảo (Emerald Green)
  '#d97706', // 03: Vàng hổ phách đậm (Amber)
  '#7c3aed', // 04: Tím violet (Violet)
  '#dc2626', // 05: Đỏ ruby (Crimson Red)
  '#0891b2', // 06: Xanh lam cyan (Teal / Cyan)
  '#db2777', // 07: Hồng cánh sen (Magenta Pink)
  '#ea580c', // 08: Cam đậm rực rỡ (Deep Orange)
  '#4f46e5', // 09: Chàm hoàng gia (Indigo)
  '#16a34a', // 10: Xanh lá cây tươi (Fresh Green)
  '#9333ea', // 11: Tím phong lan (Purple)
  '#ca8a04', // 12: Vàng mù tạt thổ hoàng (Ochre)
  '#0284c7', // 13: Xanh thiên thanh (Sky Blue)
  '#c026d3', // 14: Hồng tím dạ yến (Fuchsia)
  '#65a30d', // 15: Xanh quả chanh cốm (Lime)
  '#e11d48', // 16: Đỏ hồng nhung (Rose)
  '#0d9488', // 17: Xanh ngọc đậm (Teal)
  '#475569', // 18: Xám đá phiến lam (Slate)
  '#b45309', // 19: Nâu đồng hổ phách (Bronze Amber)
  '#6d28d9', // 20: Tím thẫm thanh lịch (Deep Violet)
  '#15803d', // 21: Xanh rừng thông (Forest Green)
  '#be123c', // 22: Đỏ thẫm lựu (Ruby Rose)
  '#0369a1', // 23: Xanh biển sâu (Ocean Blue)
  '#a21caf', // 24: Mận chín hoàng cung (Plum)
  '#4d7c0f', // 25: Xanh rêu oliu (Olive Lime)
  '#c2410c', // 26: Cam gạch nung (Rust Orange)
  '#4338ca', // 27: Xanh lam cobalt (Cobalt Blue)
  '#047857', // 28: Xanh ngọc bích (Jade Green)
  '#86198f', // 29: Tím hoa cà (Orchid)
  '#b91c1c', // 30: Đỏ gạch tươi (Scarlet Red)
  '#0e7490', // 31: Xanh mòng két đậm (Deep Cyan)
  '#9a3412', // 32: Nâu cam đất (Terracotta)
  '#3730a3', // 33: Xanh bóng đêm hải quân (Navy)
  '#166534', // 34: Xanh lá thẫm thảo nguyên (Pine Green)
  '#701a75', // 35: Tím quả cà chín (Eggplant)
  '#831843', // 36: Đỏ rượu vang nồng nàn (Burgundy)
  '#155e75', // 37: Xanh biển đêm (Marine Teal)
  '#854d0e', // 38: Nâu caramen đất sét (Mustard Brown)
  '#312e81', // 39: Xanh đen sapphire (Midnight Sapphire)
  '#14532d', // 40: Xanh rậm rạp nhiệt đới (Deep Jungle)
  '#581c87', // 41: Tím thạch anh huyền bí (Imperial Purple)
  '#7f1d1d', // 42: Đỏ bordeaux cổ điển (Wine Maroon)
  '#0f766e'  // 43: Xanh cổ vịt huyền ảo (Dark Teal Pine)
];

/**
 * Lấy mã màu riêng biệt của giáo viên (tổng 43 giáo viên = 43 màu khác nhau).
 * Bất kể dạy môn gì, mỗi giáo viên sẽ có 1 màu nhận diện nhất quán trên toàn bộ TKB.
 */
export function getTeacherColor(state, teacherId) {
  if (!teacherId) return '';
  const teachers = state?.teachers || [];
  const idx = teachers.findIndex(t => t.id === teacherId);
  if (idx >= 0) {
    return TEACHER_COLORS_43[idx % TEACHER_COLORS_43.length];
  }
  // Băm chuỗi ID/tên giáo viên nếu chưa có trong danh mục để luôn có màu xác định
  let hash = 0;
  for (let i = 0; i < teacherId.length; i++) {
    hash = (hash << 5) - hash + teacherId.charCodeAt(i);
    hash |= 0;
  }
  return TEACHER_COLORS_43[Math.abs(hash) % TEACHER_COLORS_43.length];
}

/**
 * Chức năng mở khóa / khóa tiết học trên thời khóa biểu
 * Tự động đồng bộ khóa/mở khóa cho lớp ghép nếu có
 */
export function toggleCellLock(state, classId, timeSlotId) {
  const target = (state.timetableCells || []).find(c => c.classId === classId && c.timeSlotId === timeSlotId);
  const newLock = target ? !target.locked : false;
  const partner = target ? jointPartner(state, classId, target.subjectId) : null;

  const cells = (state.timetableCells || []).map(c => {
    if (c.classId === classId && c.timeSlotId === timeSlotId) {
      return { ...c, locked: newLock };
    }
    if (partner && c.classId === partner.id && c.timeSlotId === timeSlotId && c.subjectId === target?.subjectId) {
      return { ...c, locked: newLock };
    }
    return c;
  });
  return {
    ...state,
    timetableCells: cells,
    draftSchedule: clone(cells)
  };
}

/**
 * Chức năng mở khóa tất cả các môn cố định trên toàn bộ thời khóa biểu
 */
export function unlockAllFixedCells(state) {
  const cells = (state.timetableCells || []).map(c => ({ ...c, locked: false }));
  return {
    ...state,
    timetableCells: cells,
    draftSchedule: clone(cells)
  };
}

/**
 * Gán hoạt động đặc biệt (Chào cờ, Sinh hoạt lớp) vào ô lịch
 */
export function assignSpecialActivity(state, { classId, timeSlotId, type, locked = false }) {
  const cls = (state.classes || []).find(c => c.id === classId);
  const slot = (state.timeSlots || []).find(s => s.id === timeSlotId);
  if (!cls || !slot) throw Error('Lớp học hoặc khung giờ không hợp lệ.');

  let subjects = [...(state.subjects || [])];
  let subjectId = '';
  let teacherId = '';
  let note = '';

  if (type === 'chao_co') {
    let chaoCoSubj = subjects.find(s =>
      s.id === 'subj_special_chao_co' ||
      s.code === 'CHAO_CO' ||
      s.name?.toLowerCase().includes('chào cờ') ||
      s.name?.toLowerCase().includes('chao co')
    );
    if (!chaoCoSubj) {
      chaoCoSubj = {
        id: 'subj_special_chao_co',
        code: 'CHAO_CO',
        name: 'Chào cờ',
        color: '#dc2626'
      };
      subjects.push(chaoCoSubj);
    }
    subjectId = chaoCoSubj.id;
    teacherId = '';
    note = 'HĐTN-HN: Sinh hoạt dưới cờ (Chào cờ)';
  } else if (type === 'sinh_hoat_lop') {
    let shlSubj = subjects.find(s =>
      s.id === 'subj_hdtn_hn' ||
      s.code === 'HDTN_HN' ||
      s.name?.toLowerCase().includes('hđtn') ||
      s.name?.toLowerCase().includes('sinh hoạt')
    );
    if (!shlSubj) {
      shlSubj = {
        id: 'subj_hdtn_hn',
        code: 'HDTN_HN',
        name: 'HĐTN - HN',
        color: '#4f46e5'
      };
      subjects.push(shlSubj);
    }
    subjectId = shlSubj.id;
    teacherId = cls.homeroomTeacherId || '';
    note = 'HĐTN-HN: Sinh hoạt lớp';
  } else if (type === 'ta_esl') {
    let eslSubj = subjects.find(s =>
      s.id === 'subj_ta_esl' ||
      s.code === 'TA_ESL' ||
      s.name?.toLowerCase().includes('esl') ||
      s.name?.toLowerCase().includes('tiếng anh esl')
    );
    if (!eslSubj) {
      eslSubj = {
        id: 'subj_ta_esl',
        code: 'TA_ESL',
        name: 'TA ESL',
        color: '#6366f1'
      };
      subjects.push(eslSubj);
    }
    subjectId = eslSubj.id;
    teacherId = '';
    note = 'Tiếng Anh ESL';
  } else if (type === 'clb') {
    let clbSubj = subjects.find(s =>
      s.id === 'subj_clb' ||
      s.code === 'CLB' ||
      s.name?.toLowerCase().includes('câu lạc bộ') ||
      s.name?.toLowerCase().includes('clb')
    );
    if (!clbSubj) {
      clbSubj = {
        id: 'subj_clb',
        code: 'CLB',
        name: 'CLB',
        color: '#059669'
      };
      subjects.push(clbSubj);
    }
    subjectId = clbSubj.id;
    teacherId = '';
    note = 'Câu lạc bộ (CLB)';
  } else {
    throw Error('Loại hoạt động không hợp lệ: ' + type);
  }

  // Cập nhật ô trong timetableCells & draftSchedule
  const existing = (state.timetableCells || []).find(c => c.classId === classId && c.timeSlotId === timeSlotId);
  const newCell = {
    id: existing?.id || uid(),
    classId,
    timeSlotId,
    day: `Thứ ${slot.dayOfWeek}`,
    period: slot.period,
    subjectId,
    teacherId,
    note,
    locked: Boolean(locked),
    restored: true,
    userAssigned: true
  };

  const nextCells = (state.timetableCells || []).filter(c => !(c.classId === classId && c.timeSlotId === timeSlotId));
  nextCells.push(newCell);

  return {
    ...state,
    subjects,
    timetableCells: nextCells,
    draftSchedule: clone(nextCells)
  };
}

/**
 * Đặt lại tiết Chào cờ sáng Thứ 2 (Tiết 1) cho tất cả các lớp
 */
export function resetMondayFlagCeremony(state) {
  let subjects = [...(state.subjects || [])];
  let chaoCoSubj = subjects.find(s =>
    s.id === 'subj_special_chao_co' ||
    s.code === 'CHAO_CO' ||
    s.name?.toLowerCase().includes('chào cờ') ||
    s.name?.toLowerCase().includes('chao co')
  );
  if (!chaoCoSubj) {
    chaoCoSubj = {
      id: 'subj_special_chao_co',
      code: 'CHAO_CO',
      name: 'Chào cờ',
      color: '#dc2626'
    };
    subjects.push(chaoCoSubj);
  }

  const slotMonP1 = (state.timeSlots || []).find(s => s.dayOfWeek === 2 && s.period === 1 && s.session === 'MORNING')
    || (state.timeSlots || []).find(s => s.dayOfWeek === 2 && s.period === 1);
  if (!slotMonP1) return state;

  const classes = state.classes || [];
  let cells = [...(state.timetableCells || [])];

  for (const cls of classes) {
    const existingIndex = cells.findIndex(c => c.classId === cls.id && c.timeSlotId === slotMonP1.id);
    const cellData = {
      id: existingIndex >= 0 ? cells[existingIndex].id : uid(),
      classId: cls.id,
      timeSlotId: slotMonP1.id,
      day: 'Thứ 2',
      period: 1,
      subjectId: chaoCoSubj.id,
      teacherId: '',
      note: 'HĐTN-HN: Sinh hoạt dưới cờ (Chào cờ)',
      locked: true
    };
    if (existingIndex >= 0) {
      cells[existingIndex] = cellData;
    } else {
      cells.push(cellData);
    }
  }

  return {
    ...state,
    subjects,
    timetableCells: cells,
    draftSchedule: clone(cells)
  };
}

/**
 * Định dạng thời gian nhật ký: HH:mm:ss - DD/MM
 */
export function formatHistoryTime(date = new Date()) {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '';
  const pad = n => String(n).padStart(2, '0');
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  return `${hours}:${minutes}:${seconds} - ${day}/${month}`;
}

/**
 * Ghi lại 1 thay đổi vào nhật ký lịch tiết học
 * Lưu trữ trạng thái trước khi thay đổi (previousScheduleSnapshot) để hoàn tác
 */
export function recordChange(state, {
  actionType,
  description,
  classId = '',
  timeSlotId = '',
  slotLabel = '',
  previousCell = null,
  newCell = null,
  actor = 'Người xếp lịch',
  previousSnapshot = null
}) {
  const cls = (state.classes || []).find(c => c.id === classId);
  const className = cls?.name || classId;

  // Snapshot của toàn bộ timetableCells trước khi thao tác
  const previousScheduleSnapshot = previousSnapshot || clone(state.timetableCells || []);

  const historyRecord = {
    id: uid(),
    timestamp: new Date().toISOString(),
    timeDisplay: formatHistoryTime(new Date()),
    actor: actor || 'Người xếp lịch',
    actionType, // 'ASSIGN', 'CLEAR', 'SPECIAL', 'LOCK', 'BATCH_UNLOCK', 'BATCH_RESET', 'EDIT'
    description: description || 'Thay đổi lịch tiết học',
    classId,
    className,
    timeSlotId,
    slotLabel,
    previousCell: previousCell ? clone(previousCell) : null,
    newCell: newCell ? clone(newCell) : null,
    previousScheduleSnapshot,
    canUndo: true,
    undone: false
  };

  const existingHistory = Array.isArray(state.changeHistory) ? state.changeHistory : [];
  // Giữ lại 50 thay đổi gần nhất
  const nextHistory = [historyRecord, ...existingHistory].slice(0, 50);

  return {
    ...state,
    changeHistory: nextHistory
  };
}

/**
 * Hoàn tác (Undo) một thao tác trong nhật ký
 * Nếu không truyền changeId: hoàn tác thao tác gần nhất có thể hoàn tác
 */
export function undoChange(state, changeId = null) {
  const history = Array.isArray(state.changeHistory) ? [...state.changeHistory] : [];
  if (history.length === 0) {
    throw Error('Chưa có lịch sử thay đổi để hoàn tác.');
  }

  let targetIndex = -1;
  if (changeId) {
    targetIndex = history.findIndex(h => h.id === changeId && h.canUndo && !h.undone);
  } else {
    targetIndex = history.findIndex(h => h.canUndo && !h.undone && Array.isArray(h.previousScheduleSnapshot));
  }

  if (targetIndex < 0) {
    throw Error('Không còn thao tác nào khả dụng để hoàn tác.');
  }

  const targetChange = history[targetIndex];
  if (!Array.isArray(targetChange.previousScheduleSnapshot)) {
    throw Error('Dữ liệu hoàn tác không khả dụng cho thao tác này.');
  }

  // Khôi phục lại danh sách ô lịch trước thao tác đó
  const restoredCells = clone(targetChange.previousScheduleSnapshot);

  // Đánh dấu thao tác mục tiêu đã được hoàn tác
  history[targetIndex] = {
    ...targetChange,
    undone: true,
    canUndo: false
  };

  // Thêm bản ghi hoàn tác vào nhật ký
  const undoRecord = {
    id: uid(),
    timestamp: new Date().toISOString(),
    timeDisplay: formatHistoryTime(new Date()),
    actor: state.updatedBy || 'Người xếp lịch',
    actionType: 'UNDO',
    description: `Hoàn tác: ${targetChange.description}`,
    undoneChangeId: targetChange.id,
    canUndo: false,
    undone: false
  };

  const updatedHistory = [undoRecord, ...history].slice(0, 50);

  return {
    ...state,
    timetableCells: restoredCells,
    draftSchedule: clone(restoredCells),
    changeHistory: updatedHistory,
    lastUndoneDescription: targetChange.description
  };
}




