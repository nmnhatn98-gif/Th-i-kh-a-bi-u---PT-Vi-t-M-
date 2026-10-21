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
  exportCsv
} from '../src/core.js';

test('1. Khung gốc: 17 lớp, 45 tiết, 289 ô cố định, giờ bắt đầu/kết thúc đúng nguồn', () => {
  assert.equal(SEED.classes.length, 17);
  assert.equal(SEED.timeSlots.length, 45);
  assert.equal(SEED.timetableCells.length, 289);
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
  assert.equal(state.timetableCells.length, 288);
});
