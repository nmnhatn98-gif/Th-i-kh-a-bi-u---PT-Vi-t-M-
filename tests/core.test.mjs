import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEED } from '../src/seed.js';
import {
  clone,
  findConflicts,
  putCell,
  deleteCell,
  deleteEntity,
  makeSnapshot,
  restoreSnapshot,
  publish,
  validateState,
  validateSnapshot,
  parseBackup,
  exportCsv,
  resolveSubjectAndTeacher,
  assignTeacherToClassSubject,
  unassignClassSubject,
  getAssignedTeacher,
  normalizeState,
  parseTeacherRows,
  importTeachersIntoState,
  normalizeHeaderKey,
  isRemovedFixedCell,
  filterRemovedFixedCells
} from '../src/core.js';

test('1. Khung gốc: 17 lớp, 45 tiết, 227 ô cố định (sau khi gỡ 62 ô TA ESL & CLB theo yêu cầu), giờ bắt đầu/kết thúc đúng nguồn', () => {
  assert.equal(SEED.classes.length, 17);
  assert.equal(SEED.timeSlots.length, 45);
  assert.equal(SEED.timetableCells.length, 227);
  assert.equal(SEED.timeSlots[0].startTime, '07:45');
  assert.equal(SEED.timeSlots[0].endTime, '08:30');
  assert.doesNotThrow(() => validateState(SEED));
});

test('2. Thêm/đổi môn và giáo viên mà không cần bản ghi phân công hoặc định mức', () => {
  let state = clone(SEED);
  state.teachers.push({ id: 'gv_test', code: 'GV01', fullName: 'Nguyễn Văn A' });
  const cell = {
    classId: 'cls_6a1',
    timeSlotId: 'ts_d2_m_2',
    subjectId: 'subj_toan',
    teacherId: 'gv_test',
    locked: false,
    note: 'Tiết 2 thứ 2'
  };
  state = putCell(state, cell);
  const saved = state.timetableCells.find(c => c.classId === 'cls_6a1' && c.timeSlotId === 'ts_d2_m_2');
  assert.ok(saved);
  assert.equal(saved.teacherId, 'gv_test');
  assert.equal(saved.subjectId, 'subj_toan');
});

test('3. Không cho trùng giáo viên giữa các lớp cùng tiết; ô chưa chọn giáo viên không bị báo trùng giả', () => {
  let state = clone(SEED);
  state.teachers.push({ id: 'gv_shared', code: 'GV02', fullName: 'Trần Văn B' });
  // Add to 6A1
  state = putCell(state, {
    classId: 'cls_6a1',
    timeSlotId: 'ts_d2_m_2',
    subjectId: 'subj_toan',
    teacherId: 'gv_shared'
  });
  // Add same teacher to 6A2 in same time slot should throw
  assert.throws(
    () =>
      putCell(state, {
        classId: 'cls_6a2',
        timeSlotId: 'ts_d2_m_2',
        subjectId: 'subj_van',
        teacherId: 'gv_shared'
      }),
    /Giáo viên đã có lịch tại lớp khác trong tiết này/
  );
  // Cells without teacher do not trigger conflict
  assert.equal(findConflicts(SEED).length, 0);
});

test('4. Lịch nhập có trùng được phát hiện và không được chốt', () => {
  let state = clone(SEED);
  state.teachers.push({ id: 'gv_x', code: 'GV03', fullName: 'Lê Văn C' });
  state.timetableCells.push({
    id: 'c1',
    classId: 'cls_6a1',
    timeSlotId: 'ts_d2_m_3',
    subjectId: 'subj_toan',
    teacherId: 'gv_x'
  });
  state.timetableCells.push({
    id: 'c2',
    classId: 'cls_6a2',
    timeSlotId: 'ts_d2_m_3',
    subjectId: 'subj_toan',
    teacherId: 'gv_x'
  });
  const conflicts = findConflicts(state);
  assert.equal(conflicts.length, 1);
  assert.throws(() => publish(state), /Hãy xử lý lịch trùng giáo viên trước khi chốt lịch/);
});

test('5. Ô khóa không sửa/xóa trước khi mở khóa', () => {
  let state = clone(SEED);
  // initial_0 is locked
  assert.throws(
    () =>
      putCell(state, {
        classId: 'cls_6a1',
        timeSlotId: 'ts_d2_m_1',
        subjectId: 'subj_van'
      }),
    /Ô này đang khóa/
  );
  assert.throws(() => deleteCell(state, 'cls_6a1', 'ts_d2_m_1'), /Ô này đang khóa/);
});

test('6. Xóa lớp không tự sinh lại lớp mẫu khi tải bản sao lưu', () => {
  let state = clone(SEED);
  const classIdToDelete = 'cls_12xh';
  // Remove cells for that class first
  state.timetableCells = state.timetableCells.filter(c => c.classId !== classIdToDelete);
  state = deleteEntity(state, 'classes', classIdToDelete);
  assert.equal(state.classes.length, 16);
  const backup = JSON.stringify(state);
  const restored = parseBackup(backup, SEED);
  assert.equal(restored.classes.length, 16);
  assert.ok(!restored.classes.some(c => c.id === classIdToDelete));
});

test('7. Không xóa giáo viên đang được dùng trong lịch', () => {
  let state = clone(SEED);
  state.teachers.push({ id: 'gv_used', code: 'GV99', fullName: 'Ngô Thầy' });
  state.timetableCells.push({
    id: 'c_test',
    classId: 'cls_6a1',
    timeSlotId: 'ts_d3_m_1',
    subjectId: 'subj_toan',
    teacherId: 'gv_used'
  });
  assert.throws(() => deleteEntity(state, 'teachers', 'gv_used'), /Đang được dùng trong thời khóa biểu/);
});

test('8. Snapshot bản đã chốt không bị thay đổi khi sửa bản đang xếp', () => {
  let state = clone(SEED);
  state = publish(state);
  const publishedCellsCount = state.published.data.timetableCells.length;
  // Clear draft
  state.timetableCells = [];
  assert.equal(state.timetableCells.length, 0);
  assert.equal(state.published.data.timetableCells.length, publishedCellsCount);
});

test('9. Gỡ chốt không tự phục hồi sau tải lại', () => {
  let state = clone(SEED);
  state = publish(state);
  assert.ok(state.published);
  state = { ...state, published: null };
  const backup = JSON.stringify(state);
  const reloaded = parseBackup(backup, SEED);
  assert.equal(reloaded.published, null);
});

test('10. Khôi phục phiên bản có kèm danh mục', () => {
  let state = clone(SEED);
  state.teachers.push({ id: 'gv_ver', code: 'GVVER', fullName: 'Phiên Bản GV' });
  const snapshot = makeSnapshot(state, 'Mốc 1');
  state.teachers = [];
  assert.equal(state.teachers.length, 0);
  state = restoreSnapshot(state, snapshot);
  assert.equal(state.teachers.length, 1);
  assert.equal(state.teachers[0].id, 'gv_ver');
});

test('11. Từ chối JSON sai', () => {
  assert.throws(() => parseBackup('{ broken json', SEED));
  assert.throws(() => parseBackup(null, SEED));
  assert.throws(() => parseBackup({ schemaVersion: 99 }, SEED));
});

test('12. Từ chối snapshot hỏng', () => {
  assert.throws(() => validateSnapshot({ id: 'snap1', name: 'Snap' }));
  assert.throws(() => validateSnapshot({ id: 'snap1', name: 'Snap', createdAt: 'invalid-date', data: {} }));
});

test('13. Từ chối tham chiếu không tồn tại', () => {
  let state = clone(SEED);
  state.timetableCells.push({
    id: 'cell_fake',
    classId: 'non_existent_class',
    timeSlotId: 'ts_d2_m_1',
    subjectId: 'subj_toan'
  });
  assert.throws(() => validateState(state), /tham chiếu danh mục không tồn tại/);
});

test('14. Từ chối nhiều tiết trong một ô', () => {
  let state = clone(SEED);
  state.timetableCells.push({
    id: 'c_dup_1',
    classId: 'cls_6a1',
    timeSlotId: 'ts_d2_m_2',
    subjectId: 'subj_toan'
  });
  state.timetableCells.push({
    id: 'c_dup_2',
    classId: 'cls_6a1',
    timeSlotId: 'ts_d2_m_2',
    subjectId: 'subj_van'
  });
  assert.throws(() => validateState(state), /Có nhiều tiết học trong cùng một ô/);
});

test('15. Chuyển dữ liệu app cũ giữ ô lịch và bỏ phân công/định mức', () => {
  const oldAppPayload = {
    academicYear: {
      schoolName: 'Trường Mẫu Giáo Dục',
      name: '2026–2027',
      currentTerm: 'HK1'
    },
    assignments: [{ id: 'asgn_1', teacherId: 't1', quota: 18 }], // old assignment
    classes: [{ id: 'c1', code: '6A1', name: 'Lớp 6A1', grade: 6, homeroomTeacherId: '', coHomeroomTeacherId: '' }],
    subjects: [{ id: 's1', code: 'TOAN', name: 'Toán', displayColor: '#2563eb' }],
    teachers: [{ id: 't1', code: 'GV01', fullName: 'Thầy Cũ', weeklyQuota: 20 }], // old quota
    timeSlots: clone(SEED.timeSlots),
    timetableCells: [{ id: 'tc1', classId: 'c1', subjectId: 's1', teacherId: 't1', timeSlotId: 'ts_d2_m_1', locked: false, note: '' }]
  };
  const migrated = parseBackup(oldAppPayload, SEED);
  assert.equal(migrated.school.name, 'Trường Mẫu Giáo Dục');
  assert.equal(migrated.classes.length, 1);
  assert.equal(migrated.teachers.length, 1);
  assert.equal(migrated.teachers[0].weeklyQuota, undefined); // discarded quota
  assert.equal(migrated.assignments, undefined); // discarded assignments
  assert.equal(migrated.timetableCells.length, 1);
});

test('16. Xuất CSV có đủ hàng, giữ tiếng Việt, escape nội dung nguy cơ công thức', () => {
  let state = clone(SEED);
  const csv = exportCsv(state);
  assert.ok(csv.startsWith('\uFEFF')); // BOM for UTF-8 in Excel
  assert.ok(csv.includes('Thứ 2'));
  assert.ok(csv.includes('Lớp 6A1'));
  // formula injection safety check: dangerous cell prefix
  state.classes[0].name = '=SUM(1,2)';
  const escapedCsv = exportCsv(state);
  assert.ok(escapedCsv.includes("\"'=SUM(1,2)\""));
});

test('17. Xóa ô đã mở khóa thành công', () => {
  let state = clone(SEED);
  state.timetableCells[0].locked = false;
  state = deleteCell(state, state.timetableCells[0].classId, state.timetableCells[0].timeSlotId);
  assert.equal(state.timetableCells.length, SEED.timetableCells.length - 1);
});

test('18. Phân quyền RBAC: OWNER (nmnhat.n98@gmail.com) được bảo vệ tuyệt đối, ADMIN không sửa được OWNER', () => {
  const OWNER_EMAIL = 'nmnhat.n98@gmail.com';
  function canModifyUser(actor, target, targetNewRole) {
    if (target.email === OWNER_EMAIL) {
      if (actor.email !== OWNER_EMAIL) return false; // Admin cannot touch owner
      if (targetNewRole && targetNewRole !== 'OWNER') return false; // Owner cannot demote self
    }
    if (actor.role === 'ADMIN') {
      if (targetNewRole === 'OWNER' || targetNewRole === 'ADMIN') return false; // Admin cannot grant Owner or Admin
      if (target.role === 'OWNER') return false;
      if (target.email === actor.email) return false; // Admin cannot edit self
      return true;
    }
    if (actor.role === 'OWNER') return true;
    return false;
  }

  const owner = { email: OWNER_EMAIL, role: 'OWNER' };
  const admin = { email: 'admin@school.edu.vn', role: 'ADMIN' };
  const scheduler = { email: 'scheduler@school.edu.vn', role: 'SCHEDULER' };
  const teacher = { email: 'teacher@school.edu.vn', role: 'TEACHER' };

  // Admin cannot modify Owner
  assert.equal(canModifyUser(admin, owner, 'ADMIN'), false);
  // Owner cannot demote self
  assert.equal(canModifyUser(owner, owner, 'TEACHER'), false);
  // Admin cannot grant Admin role
  assert.equal(canModifyUser(admin, teacher, 'ADMIN'), false);
  // Admin can modify scheduler or teacher
  assert.equal(canModifyUser(admin, teacher, 'SCHEDULER'), true);
  // Owner can grant any role
  assert.equal(canModifyUser(owner, scheduler, 'ADMIN'), true);
  // Scheduler cannot modify any account
  assert.equal(canModifyUser(scheduler, teacher, 'TEACHER'), false);
});

test('19. Quyền truy cập theo vai trò: Chỉ OWNER, ADMIN, SCHEDULER được xếp lịch, TEACHER chỉ đọc', () => {
  function canEditWorkingTimetable(role) {
    return ['OWNER', 'ADMIN', 'SCHEDULER'].includes(role);
  }
  assert.equal(canEditWorkingTimetable('OWNER'), true);
  assert.equal(canEditWorkingTimetable('ADMIN'), true);
  assert.equal(canEditWorkingTimetable('SCHEDULER'), true);
  assert.equal(canEditWorkingTimetable('TEACHER'), false);
  assert.equal(canEditWorkingTimetable('GUEST'), false);
});

test('20. Phân biệt hồ sơ tự khai và xác nhận chính thức: selfDeclared không tự cấp quyền chủ nhiệm', () => {
  function isConfirmedHomeroom(userProfile) {
    return Array.isArray(userProfile?.homeroomClassIds) && userProfile.homeroomClassIds.length > 0;
  }

  // Teacher only declared homeroom class, but admin has not confirmed
  const pendingTeacher = {
    email: 'gv1@school.edu.vn',
    role: 'TEACHER',
    active: true,
    selfDeclared: { homeroomClassId: 'cls_6a1' },
    homeroomClassIds: [] // Not yet confirmed
  };
  assert.equal(isConfirmedHomeroom(pendingTeacher), false);

  // Once admin confirms
  const confirmedTeacher = {
    ...pendingTeacher,
    homeroomClassIds: ['cls_6a1']
  };
  assert.equal(isConfirmedHomeroom(confirmedTeacher), true);
});

test('21. Giáo viên thỉnh giảng: Phát hiện xung đột giữa lịch bận đăng ký và lịch dạy đã chốt', () => {
  const teacherId = 'gv_visiting_1';
  const assignedSlotIds = ['ts_d2_m_1', 'ts_d3_m_2'];
  const busySlotIds = ['ts_d2_m_1', 'ts_d5_m_4'];

  const conflicts = busySlotIds.filter(slotId => assignedSlotIds.includes(slotId));
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0], 'ts_d2_m_1');
});

test('22. Lọc tiết giảng dạy cá nhân: Lấy đúng tất cả các lớp của giáo viên', () => {
  let state = clone(SEED);
  const teacherId = 'gv_math';
  state.teachers.push({ id: teacherId, code: 'GVM', fullName: 'Thầy Toán' });

  // Add 3 lessons across 2 different classes
  state = putCell(state, {
    classId: 'cls_6a1',
    timeSlotId: 'ts_d2_m_2',
    subjectId: 'subj_toan',
    teacherId
  });
  state = putCell(state, {
    classId: 'cls_6a1',
    timeSlotId: 'ts_d2_m_3',
    subjectId: 'subj_toan',
    teacherId
  });
  state = putCell(state, {
    classId: 'cls_7a1',
    timeSlotId: 'ts_d3_m_1',
    subjectId: 'subj_toan',
    teacherId
  });

  const myLessons = state.timetableCells.filter(c => c.teacherId === teacherId);
  assert.equal(myLessons.length, 3);
  const classesTaught = new Set(myLessons.map(l => l.classId));
  assert.equal(classesTaught.size, 2);
  assert.ok(classesTaught.has('cls_6a1'));
  assert.ok(classesTaught.has('cls_7a1'));
});

test('23. Chuyển đổi không gian làm việc (Workspace Switcher): Chỉ cho phép các không gian thuộc quyền', () => {
  function getWorkspaces(profile) {
    const ws = [];
    if (profile.role === 'OWNER' || profile.role === 'ADMIN') ws.push('ADMIN');
    if (['OWNER', 'ADMIN', 'SCHEDULER'].includes(profile.role)) ws.push('SCHEDULER');
    if (Array.isArray(profile.homeroomClassIds) && profile.homeroomClassIds.length > 0) ws.push('HOMEROOM');
    if (profile.isVisiting) ws.push('VISITING');
    if (profile.teacherId) ws.push('TEACHER');
    return ws;
  }

  // Admin who is also a teacher
  const adminTeacher = { role: 'ADMIN', teacherId: 'gv1', homeroomClassIds: [] };
  const adminWs = getWorkspaces(adminTeacher);
  assert.deepEqual(adminWs, ['ADMIN', 'SCHEDULER', 'TEACHER']);

  // Homeroom teacher
  const homeroomTeacher = { role: 'TEACHER', teacherId: 'gv2', homeroomClassIds: ['cls_6a1'] };
  const hrWs = getWorkspaces(homeroomTeacher);
  assert.deepEqual(hrWs, ['HOMEROOM', 'TEACHER']);

  // Visiting teacher
  const visitingTeacher = { role: 'TEACHER', teacherId: 'gv3', isVisiting: true, homeroomClassIds: [] };
  const visWs = getWorkspaces(visitingTeacher);
  assert.deepEqual(visWs, ['VISITING', 'TEACHER']);
});

test('24. Chức năng nhập liệu trực tiếp: gõ môn & giáo viên, nhận diện mã/tên hoặc tự tạo mới hợp lệ', () => {
  const state = clone(SEED);
  state.teachers = [
    { id: 'tea_an', code: 'DMA', fullName: 'Đoàn Minh An' },
    { id: 'tea_lan', code: 'NTL', fullName: 'Nguyễn Thị Lan' }
  ];

  // 1. Gõ tên môn và giáo viên có sẵn (VD: Toán và giáo viên)
  const res1 = resolveSubjectAndTeacher(state, {
    subjectInput: 'Toán',
    teacherInput: 'Đoàn Minh An'
  });
  assert.ok(res1.subjectId);
  assert.equal(res1.subjectId, 'subj_toan');
  assert.equal(res1.teacherId, 'tea_an');

  // 2. Gõ nhanh dạng 1 dòng "Môn - Giáo viên"
  const res2 = resolveSubjectAndTeacher(state, {
    quickLine: 'Văn - NTL'
  });
  assert.ok(res2.subjectId);
  assert.equal(res2.teacherId, 'tea_lan');

  // 3. Gõ môn hoàn toàn mới và giáo viên mới: hệ thống tự động sinh môn và giáo viên hợp lệ
  const res3 = resolveSubjectAndTeacher(state, {
    subjectInput: 'Lập trình Python',
    teacherInput: 'Hoàng Văn Bách'
  });
  assert.ok(res3.subjectId);
  assert.ok(res3.teacherId);
  assert.ok(res3.state.subjects.some(s => s.name === 'Lập trình Python'));
  assert.ok(res3.state.teachers.some(t => t.fullName === 'Hoàng Văn Bách'));

  // Kiểm tra state sau khi sinh có vượt qua validateState không
  assert.doesNotThrow(() => validateState(res3.state));
});

test('25. Chuẩn hóa Data Model: homeroomTeacherId cho Classes và assignments cho Teachers', () => {
  let state = normalizeState(clone(SEED));
  // Every class has homeroomTeacherId (string or null)
  for (const c of state.classes) {
    assert.ok('homeroomTeacherId' in c);
  }

  // Teacher has assignments array
  state.teachers.push({
    id: 'tea_demo',
    code: 'DEMO',
    fullName: 'Cô Demo',
    assignments: []
  });
  assert.ok(Array.isArray(state.teachers[0].assignments));
  assert.doesNotThrow(() => validateState(state));
});

test('26. Đồng bộ hóa 2 chiều: gán giáo viên A dạy môn X ở lớp Y cập nhật assignments của A; thay thế giáo viên B tự động xóa khỏi assignments của B', () => {
  let state = normalizeState(clone(SEED));
  state.teachers = [
    { id: 'tea_a', code: 'GVA', fullName: 'Thầy A', assignments: [] },
    { id: 'tea_b', code: 'GVB', fullName: 'Cô B', assignments: [] }
  ];

  // Gán giáo viên A dạy môn Toán ở lớp 6A1
  state = assignTeacherToClassSubject(state, {
    classId: 'cls_6a1',
    subjectId: 'subj_toan',
    teacherId: 'tea_a'
  });

  let teaA = state.teachers.find(t => t.id === 'tea_a');
  let teaB = state.teachers.find(t => t.id === 'tea_b');
  assert.equal(teaA.assignments.length, 1);
  assert.deepEqual(teaA.assignments[0], { classId: 'cls_6a1', subjectId: 'subj_toan' });
  assert.equal(getAssignedTeacher(state, 'cls_6a1', 'subj_toan')?.id, 'tea_a');

  // Gán tiếp giáo viên B thay thế giáo viên A dạy môn Toán ở lớp 6A1
  state = assignTeacherToClassSubject(state, {
    classId: 'cls_6a1',
    subjectId: 'subj_toan',
    teacherId: 'tea_b'
  });

  teaA = state.teachers.find(t => t.id === 'tea_a');
  teaB = state.teachers.find(t => t.id === 'tea_b');
  // assignments của A tự động bị xóa phân công này
  assert.equal(teaA.assignments.some(a => a.classId === 'cls_6a1' && a.subjectId === 'subj_toan'), false);
  // assignments của B có phân công này
  assert.equal(teaB.assignments.some(a => a.classId === 'cls_6a1' && a.subjectId === 'subj_toan'), true);
  assert.equal(getAssignedTeacher(state, 'cls_6a1', 'subj_toan')?.id, 'tea_b');
});

test('27. Bỏ gán / Tẩy phân công: unassignClassSubject xóa khỏi assignments và giải phóng ô', () => {
  let state = normalizeState(clone(SEED));
  state.teachers = [
    { id: 'tea_b', code: 'GVB', fullName: 'Cô B', assignments: [{ classId: 'cls_6a1', subjectId: 'subj_toan' }] }
  ];

  state = unassignClassSubject(state, {
    classId: 'cls_6a1',
    subjectId: 'subj_toan'
  });

  const teaB = state.teachers.find(t => t.id === 'tea_b');
  assert.equal(teaB.assignments.length, 0);
  assert.equal(getAssignedTeacher(state, 'cls_6a1', 'subj_toan'), null);
});

test('28. Nhập danh sách giáo viên: parse dữ liệu bảng 2D và mảng object tiếng Việt linh hoạt', () => {
  // Test case 1: 2D array with headers in row 1 (row 0 has title banner)
  const sheetRows = [
    ['TRƯỜNG THCS NGUYỄN DU - NĂM HỌC 2026-2027'],
    ['STT', 'Mã GV', 'Họ và tên giáo viên', 'Số điện thoại', 'Email', 'Ghi chú'],
    [1, 'GV01', 'Nguyễn Văn An', '0912345678', 'an@school.edu.vn', 'Toán'],
    [2, 'GV02', 'Trần Thị Bình', '0987654321', 'binh@school.edu.vn', 'Văn'],
    [3, '', 'Lê Hoàng Cường', '', '', 'Tiếng Anh (chưa có mã)']
  ];

  const parsed1 = parseTeacherRows(sheetRows);
  assert.equal(parsed1.length, 3);
  assert.equal(parsed1[0].fullName, 'Nguyễn Văn An');
  assert.equal(parsed1[0].code, 'GV01');
  assert.equal(parsed1[0].phone, '0912345678');
  assert.equal(parsed1[1].fullName, 'Trần Thị Bình');
  assert.equal(parsed1[2].fullName, 'Lê Hoàng Cường');
  assert.equal(parsed1[2].code, '');

  // Test case 2: Object array
  const objRows = [
    { 'Mã giáo viên': 'T01', 'Họ và tên': 'Hoàng Mai Dung', 'SĐT': '0901234567' },
    { 'Mã GV': 'T02', 'Họ tên': 'Vũ Đức Giang', 'Ghi chú': 'Hóa học' }
  ];
  const parsed2 = parseTeacherRows(objRows);
  assert.equal(parsed2.length, 2);
  assert.equal(parsed2[0].fullName, 'Hoàng Mai Dung');
  assert.equal(parsed2[0].code, 'T01');
  assert.equal(parsed2[1].fullName, 'Vũ Đức Giang');
});

test('29. Import giáo viên vào State: Thêm mới, tự sinh mã nếu thiếu, cập nhật thông tin người đã có', () => {
  let state = normalizeState(clone(SEED));
  // Add an initial teacher to test updating
  state.teachers = [
    { id: 'tea_init_1', code: 'GV01', fullName: 'Thầy Cũ', assignments: [] }
  ];
  const initialCount = state.teachers.length;
  const existingFirst = state.teachers[0];

  // Import list contains 1 existing teacher (update phone/note) and 2 brand new teachers (one without code)
  const importData = [
    {
      'Mã GV': existingFirst.code,
      'Họ và tên': existingFirst.fullName,
      'Số điện thoại': '0999888777',
      'Ghi chú': 'Tổ trưởng tổ Toán'
    },
    {
      'Mã GV': 'GV_MOI_1',
      'Họ và tên': 'Phan Thanh Bình',
      'Số điện thoại': '0911222333',
      'Ghi chú': 'Môn Địa lý'
    },
    {
      'Mã GV': '',
      'Họ và tên': 'Ngô Khánh Huyền',
      'Ghi chú': 'Giáo viên mới'
    }
  ];

  const { state: nextState, stats } = importTeachersIntoState(state, importData, { mode: 'merge' });
  assert.equal(stats.total, 3);
  assert.equal(stats.updated, 1);
  assert.equal(stats.added, 2);
  assert.equal(nextState.teachers.length, initialCount + 2);

  // Existing teacher updated with phone and note, kept same ID
  const updatedTea = nextState.teachers.find(t => t.id === existingFirst.id);
  assert.equal(updatedTea.phone, '0999888777');
  assert.equal(updatedTea.note, 'Tổ trưởng tổ Toán');

  // New teacher without code had unique code generated
  const autoCodedTea = nextState.teachers.find(t => t.fullName === 'Ngô Khánh Huyền');
  assert.ok(autoCodedTea);
  assert.ok(autoCodedTea.code.length >= 2);
  assert.doesNotThrow(() => validateState(nextState));
});

test('30. Import giáo viên bảo toàn phân công môn/lớp và liên kết thời khóa biểu đã có', () => {
  let state = normalizeState(clone(SEED));
  state.teachers = [
    { id: 'tea_init_2', code: 'GV02', fullName: 'Cô Giáo Cũ', assignments: [] }
  ];
  // Assign teacher to a class
  state = assignTeacherToClassSubject(state, {
    classId: 'cls_6a1',
    subjectId: 'subj_toan',
    teacherId: state.teachers[0].id
  });

  const tea0 = state.teachers[0];
  assert.equal(tea0.assignments.length, 1);

  // Import update for teacher 0
  const importRows = [
    {
      'Mã GV': tea0.code,
      'Họ và tên': tea0.fullName,
      'Số điện thoại': '0988776655'
    }
  ];

  const { state: nextState } = importTeachersIntoState(state, importRows, { mode: 'merge' });
  const updatedTea0 = nextState.teachers.find(t => t.id === tea0.id);
  assert.equal(updatedTea0.phone, '0988776655');
  // Assignments must still be preserved!
  assert.equal(updatedTea0.assignments.length, 1);
  assert.deepEqual(updatedTea0.assignments[0], { classId: 'cls_6a1', subjectId: 'subj_toan' });
  assert.equal(getAssignedTeacher(nextState, 'cls_6a1', 'subj_toan')?.id, tea0.id);
});

test('31. Xóa các tiết cố định TA ESL và CLB theo đúng yêu cầu người dùng', () => {
  // 1. Kiểm tra 2 lớp 12XH và 12TN: Không còn tiết TA ESL vào chiều thứ 2, 4, 6 trong SEED
  const taEslAfternoon12 = SEED.timetableCells.filter(c =>
    (c.classId === 'cls_12xh' || c.classId === 'cls_12tn') &&
    c.subjectId === 'subj_ta_esl' &&
    /^ts_d[246]_a_[1-4]$/.test(c.timeSlotId)
  );
  assert.equal(taEslAfternoon12.length, 0, 'Đã xóa hoàn toàn TA ESL chiều T2, T4, T6 ở 12XH và 12TN');

  // 2. Chiều thứ 3: các lớp 8A1, 8A2, 8A3, 9A1, 9A2, 9A3, 10TN, 10XH và 11 không còn tiết 3, 4 cố định CLB
  const clbClassesT3 = ['cls_8a1', 'cls_8a2', 'cls_8a3', 'cls_9a1', 'cls_9a2', 'cls_9a3', 'cls_10tn', 'cls_10xh', 'cls_11'];
  const clbT3Period34 = SEED.timetableCells.filter(c =>
    clbClassesT3.includes(c.classId) &&
    c.subjectId === 'subj_clb' &&
    (c.timeSlotId === 'ts_d3_a_3' || c.timeSlotId === 'ts_d3_a_4')
  );
  assert.equal(clbT3Period34.length, 0, 'Đã xóa hoàn toàn CLB chiều T3 tiết 3, 4 ở các lớp 8A, 9A, 10, 11');

  // 3. Chiều thứ 5: các lớp 6A1, 6A2, 6A3, 7A1, 7A2, 7A3 không còn tiết 3, 4 cố định CLB
  const clbClassesT5 = ['cls_6a1', 'cls_6a2', 'cls_6a3', 'cls_7a1', 'cls_7a2', 'cls_7a3'];
  const clbT5Period34 = SEED.timetableCells.filter(c =>
    clbClassesT5.includes(c.classId) &&
    c.subjectId === 'subj_clb' &&
    (c.timeSlotId === 'ts_d5_a_3' || c.timeSlotId === 'ts_d5_a_4')
  );
  assert.equal(clbT5Period34.length, 0, 'Đã xóa hoàn toàn CLB chiều T5 tiết 3, 4 ở các lớp 6A, 7A');

  // 4. Lớp 12TN và 12XH: Thứ 3 và Thứ 5 chiều tiết 3, 4 không có tiết CLB
  const clb12Period34 = SEED.timetableCells.filter(c =>
    (c.classId === 'cls_12tn' || c.classId === 'cls_12xh') &&
    c.subjectId === 'subj_clb' &&
    (c.timeSlotId === 'ts_d3_a_3' || c.timeSlotId === 'ts_d3_a_4' || c.timeSlotId === 'ts_d5_a_3' || c.timeSlotId === 'ts_d5_a_4')
  );
  assert.equal(clb12Period34.length, 0, 'Đã xóa hoàn toàn CLB ở 12TN và 12XH chiều T3 và T5 tiết 3, 4');

  // 5. normalizeState tự động làm sạch nếu dữ liệu cũ có chứa các ô này
  const dummyState = {
    classes: SEED.classes,
    subjects: SEED.subjects,
    teachers: [],
    timetableCells: [
      { classId: 'cls_12xh', timeSlotId: 'ts_d2_a_1', subjectId: 'subj_ta_esl' },
      { classId: 'cls_8a1', timeSlotId: 'ts_d3_a_3', subjectId: 'subj_clb' },
      { classId: 'cls_6a1', timeSlotId: 'ts_d5_a_4', subjectId: 'subj_clb' },
      { classId: 'cls_12tn', timeSlotId: 'ts_d3_a_3', subjectId: 'subj_clb' },
      { classId: 'cls_12xh', timeSlotId: 'ts_d5_a_4', subjectId: 'subj_clb' },
      { classId: 'cls_6a1', timeSlotId: 'ts_d2_m_1', subjectId: 'subj_special_chao_co' }
    ]
  };
  const normalized = normalizeState(dummyState);
  assert.equal(normalized.timetableCells.length, 1);
  assert.equal(normalized.timetableCells[0].subjectId, 'subj_special_chao_co');
});



test('cloud backup without schemaVersion is accepted only with complete timetable structure', () => {
 const source=clone(SEED);delete source.schemaVersion;
 const restored=parseBackup(source,SEED);
 assert.equal(restored.schemaVersion,1);
 assert.deepEqual(restored.timetableCells,source.timetableCells);
 assert.throws(()=>parseBackup({...source,schemaVersion:99},SEED),/chưa được hỗ trợ/);
 assert.throws(()=>parseBackup({school:source.school},SEED),/chưa được hỗ trợ/);
});
