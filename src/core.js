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

  const nextTeachers = (state.teachers || []).map(t => {
    let assignments = Array.isArray(t.assignments) ? [...t.assignments] : [];
    // If this teacher had this classId + subjectId, and is NOT the target teacher, remove it
    if (t.id !== teacherId) {
      assignments = assignments.filter(a => !(a.classId === classId && a.subjectId === subjectId));
    } else {
      if (!assignments.some(a => a.classId === classId && a.subjectId === subjectId)) {
        assignments.push({ classId, subjectId });
      }
    }
    return { ...t, assignments };
  });

  // Keep timetableCells synchronized for this class & subject
  const nextCells = (state.timetableCells || []).map(cell => {
    if (cell.classId === classId && cell.subjectId === subjectId) {
      return { ...cell, teacherId: teacherId || '' };
    }
    return cell;
  });

  return {
    ...state,
    teachers: nextTeachers,
    timetableCells: nextCells
  };
}

export function unassignClassSubject(state, { classId, subjectId }) {
  return assignTeacherToClassSubject(state, { classId, subjectId, teacherId: '' });
}

export function getAssignedTeacher(state, classId, subjectId) {
  // First check teacher assignments
  const byAssignment = (state.teachers || []).find(t =>
    Array.isArray(t.assignments) && t.assignments.some(a => a.classId === classId && a.subjectId === subjectId)
  );
  if (byAssignment) return byAssignment;

  // Fallback to timetable cells
  const cell = (state.timetableCells || []).find(c => c.classId === classId && c.subjectId === subjectId && c.teacherId);
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

export function normalizeState(state) {
  if (!state || typeof state !== 'object') return state;
  if (Array.isArray(state.classes)) {
    for (const c of state.classes) {
      if (c.homeroomTeacherId === undefined) {
        c.homeroomTeacherId = null;
      }
    }
  }
  if (Array.isArray(state.teachers)) {
    for (const t of state.teachers) {
      if (!Array.isArray(t.assignments)) {
        t.assignments = [];
      }
    }
    if (Array.isArray(state.timetableCells)) {
      for (const cell of state.timetableCells) {
        if (cell.teacherId && cell.classId && cell.subjectId) {
          const t = state.teachers.find(tea => tea.id === cell.teacherId);
          if (t) {
            if (!Array.isArray(t.assignments)) t.assignments = [];
            if (!t.assignments.some(a => a.classId === cell.classId && a.subjectId === cell.subjectId)) {
              t.assignments.push({ classId: cell.classId, subjectId: cell.subjectId });
            }
          }
        }
      }
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
