export const uid = () => globalThis.crypto.randomUUID();
export const clone = value => structuredClone(value);
export const keyOf = (classId, timeSlotId) => `${classId}::${timeSlotId}`;

export function effectiveTeacher(cell, state) {
  return cell.teacherId || '';
}

export function findConflicts(state, cells = state.timetableCells) {
  const groups = new Map();
  for (const cell of cells) {
    if (!cell.teacherId) continue;
    const key = keyOf(cell.teacherId, cell.timeSlotId);
    groups.set(key, [...(groups.get(key) || []), cell]);
  }
  return [...groups.values()].filter(group => new Set(group.map(c => c.classId)).size > 1);
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
  const nextSchedule = (state.draftSchedule || []).map(cell => {
    if (cell.classId === classId && cell.subjectId === subjectId) {
      return { ...cell, teacherId: teacherId || '' };
    }
    return cell;
  });
  const nextCells = (state.timetableCells || []).map(cell => {
    if (cell.classId === classId && cell.subjectId === subjectId) {
      return { ...cell, teacherId: teacherId || '' };
    }
    return cell;
  });

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
  const cell = (state.timetableCells || state.draftSchedule || []).find(c => c.classId === classId && c.subjectId === subjectId && c.teacherId);
  if (cell?.teacherId) {
    return (state.teachers || []).find(t => t.id === cell.teacherId) || null;
  }
  return null;
}

export function putCell(state, cell, { allowConflict = false } = {}) {
  if (!state.classes.some(c => c.id === cell.classId) || !state.timeSlots.some(s => s.id === cell.timeSlotId) || !state.subjects.some(s => s.id === cell.subjectId)) {
    throw Error('Lớp, môn hoặc tiết học không hợp lệ.');
  }
  if (cell.teacherId && !state.teachers.some(t => t.id === cell.teacherId)) {
    throw Error('Giáo viên không tồn tại.');
  }
  const previous = state.timetableCells.find(c => keyOf(c.classId, c.timeSlotId) === keyOf(cell.classId, cell.timeSlotId));
  if (previous?.locked) {
    throw Error('Ô này đang khóa. Hãy mở khóa trước khi sửa.');
  }
  const next = state.timetableCells.filter(c => keyOf(c.classId, c.timeSlotId) !== keyOf(cell.classId, cell.timeSlotId));
  if (!allowConflict && cell.teacherId && next.some(c => c.teacherId === cell.teacherId && c.timeSlotId === cell.timeSlotId)) {
    throw Error('Giáo viên đã có lịch tại lớp khác trong tiết này.');
  }

  // Two-way sync: update teacher assignments if teacher assigned
  let nextTeachers = state.teachers;
  if (cell.teacherId && cell.subjectId && cell.classId && Array.isArray(state.teachers)) {
    nextTeachers = state.teachers.map(t => {
      let assignments = Array.isArray(t.assignments) ? [...t.assignments] : [];
      if (t.id === cell.teacherId) {
        if (!assignments.some(a => a.classId === cell.classId && a.subjectId === cell.subjectId)) {
          assignments.push({ classId: cell.classId, subjectId: cell.subjectId });
        }
      }
      return { ...t, assignments };
    });
  }

  return { ...state, teachers: nextTeachers, timetableCells: [...next, { id: previous?.id || uid(), ...cell }] };
}

export function deleteCell(state, classId, timeSlotId) {
  const existing = state.timetableCells.find(c => c.classId === classId && c.timeSlotId === timeSlotId);
  if (existing?.locked) {
    throw Error('Ô này đang khóa. Hãy mở khóa trước khi xóa.');
  }
  return { ...state, timetableCells: state.timetableCells.filter(c => c !== existing) };
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

export function assignLessonToScheduleCell(state, { classId, timeSlotId, day, period, subjectId, teacherId, note = '', allowConflict = false }) {
  const slot = (state.timeSlots || []).find(s => s.id === timeSlotId);
  const actualSlotId = timeSlotId || slot?.id || '';
  const dayName = day || slot?.dayName || `Thứ ${slot?.dayOfWeek || ''}`;
  const periodNum = period !== undefined ? Number(period) : (slot?.period || 1);

  if (!allowConflict && teacherId) {
    const busy = isTeacherBusy(teacherId, dayName, periodNum, classId, state.draftSchedule, actualSlotId);
    if (busy && busy.isBusy) {
      const conflictCls = busy.conflictingClass || (state.classes || []).find(c => c.id === busy.classId);
      throw Error(`Giáo viên đã có lịch tại ${conflictCls?.name || 'lớp khác'} trong tiết này.`);
    }
  }

  // Find existing cell strictly for this class in this exact slot
  const existingIdx = (state.draftSchedule || []).findIndex(c => {
    if (c.classId !== classId) return false;
    if (actualSlotId && c.timeSlotId) return c.timeSlotId === actualSlotId;
    return c.day === dayName && Number(c.period) === periodNum;
  });

  const prevCell = existingIdx !== -1 ? state.draftSchedule[existingIdx] : null;
  if (prevCell?.locked) {
    throw Error('Ô này đang khóa. Hãy mở khóa trước khi sửa.');
  }

  const newCell = {
    id: prevCell?.id || uid(),
    day: dayName,
    period: periodNum,
    timeSlotId: actualSlotId,
    classId,
    subjectId,
    teacherId: teacherId || '',
    locked: false,
    note: note || prevCell?.note || ''
  };

  const nextSchedule = [...(state.draftSchedule || [])];
  if (existingIdx !== -1) {
    nextSchedule[existingIdx] = newCell;
  } else {
    nextSchedule.push(newCell);
  }

  const nextCells = (state.timetableCells || []).filter(c => {
    if (c.classId !== classId) return true;
    if (actualSlotId && c.timeSlotId) return c.timeSlotId !== actualSlotId;
    return true;
  });
  nextCells.push(newCell);

  return {
    ...state,
    draftSchedule: nextSchedule,
    timetableCells: nextCells
  };
}

export function removeLessonFromScheduleCell(state, { classId, timeSlotId, day, period }) {
  const slot = (state.timeSlots || []).find(s => s.id === timeSlotId);
  const actualSlotId = timeSlotId || slot?.id || '';
  const dayName = day || slot?.dayName || `Thứ ${slot?.dayOfWeek || ''}`;
  const periodNum = period !== undefined ? Number(period) : (slot?.period || 1);

  const prevCell = (state.draftSchedule || []).find(c => {
    if (c.classId !== classId) return false;
    if (actualSlotId && c.timeSlotId) return c.timeSlotId === actualSlotId;
    return c.day === dayName && Number(c.period) === periodNum;
  });
  if (prevCell?.locked) {
    throw Error('Ô này đang khóa. Hãy mở khóa trước khi sửa.');
  }

  const nextSchedule = (state.draftSchedule || []).filter(c => {
    if (c.classId !== classId) return true;
    if (actualSlotId && c.timeSlotId) return c.timeSlotId !== actualSlotId;
    return !(c.day === dayName && Number(c.period) === periodNum);
  });

  const nextCells = (state.timetableCells || []).filter(c => {
    if (c.classId !== classId) return true;
    if (actualSlotId && c.timeSlotId) return c.timeSlotId !== actualSlotId;
    return true;
  });

  return {
    ...state,
    draftSchedule: nextSchedule,
    timetableCells: nextCells
  };
}

export function normalizeState(state) {
  if (!state || typeof state !== 'object') return state;

  state.activeVersion = state.activeVersion || 'draft';

  if (state.school) {
    if (!state.school.currentWeek) {
      state.school.currentWeek = 'Tuần 8';
    }
    if (!state.school.weekDates) {
      state.school.weekDates = '05/10 - 09/10/2026';
    }
  }

  if (Array.isArray(state.classes)) {
    for (const c of state.classes) {
      if (c.homeroomTeacherId === undefined) {
        c.homeroomTeacherId = null;
      }
      if (!c.weekInfo) {
        c.weekInfo = {
          week: state.school?.currentWeek || 'Tuần 8',
          dates: state.school?.weekDates || '05/10 - 09/10/2026'
        };
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
        return c ? `${state.subjects.find(s => s.id === c.subjectId)?.name || ''}${c.teacherId ? ' — ' + (state.teachers.find(t => t.id === c.teacherId)?.fullName || '') : ''}` : '';
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

export function computeExportFileName(className, weekRaw) {
  const cleanClassName = String(className || 'Lop')
    .replace(/^Lớp\s*/i, '')
    .trim()
    .replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1EA0-\u1EF9]/g, '');
  const weekDigits = String(weekRaw || '').match(/\d+/);
  const cleanWeek = weekDigits ? weekDigits[0] : String(weekRaw || '8').replace(/[^a-zA-Z0-9]/g, '');
  return `TKB_${cleanClassName}_Tuan_${cleanWeek}.png`;
}

