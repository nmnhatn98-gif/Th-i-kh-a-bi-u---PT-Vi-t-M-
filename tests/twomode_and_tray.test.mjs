import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEED } from '../src/seed.js';
import {
  clone,
  normalizeState,
  isTeacherBusy,
  formatPublicationTime,
  publishDraft,
  restoreDraftFromPublished,
  assignLessonToScheduleCell,
  removeLessonFromScheduleCell,
  assignTeacherToClassSubject
} from '../src/core.js';

function createTestState() {
  const state = normalizeState(clone(SEED));
  state.teachers.push(
    { id: 'gv_1', code: 'GV01', fullName: 'Thầy Một' },
    { id: 'gv_2', code: 'GV02', fullName: 'Cô Hai' },
    { id: 'gv_3', code: 'GV03', fullName: 'Thầy Ba' }
  );
  return state;
}

test('32. formatPublicationTime sinh chuỗi định dạng HH:mm - DD/MM/YYYY chuẩn', () => {
  const d = new Date(2026, 9, 22, 16, 30); // Month is 0-indexed (9 = Oct)
  const formatted = formatPublicationTime(d);
  assert.equal(formatted, '16:30 - 22/10/2026');
});

test('33. isTeacherBusy phát hiện chính xác khi giáo viên bận ở lớp khác trong cùng tiết', () => {
  let state = createTestState();
  // ts_d2_m_2 is unlocked (period 2 Monday morning)
  state = assignLessonToScheduleCell(state, {
    classId: 'cls_6a1',
    day: 'Thứ 2',
    period: 2,
    timeSlotId: 'ts_d2_m_2',
    subjectId: 'subj_toan',
    teacherId: 'gv_1'
  });

  // Check if gv_1 is busy when trying to schedule 6A2 at Monday morning period 2 (ts_d2_m_2)
  const busy6A2 = isTeacherBusy('gv_1', 'Thứ 2', 2, 'cls_6a2', state.draftSchedule, 'ts_d2_m_2');
  assert.equal(busy6A2.isBusy, true);
  assert.equal(busy6A2.classId, 'cls_6a1');

  // Check if gv_1 is free when checking Monday morning period 3 (ts_d2_m_3)
  const freePeriod3 = isTeacherBusy('gv_1', 'Thứ 2', 3, 'cls_6a2', state.draftSchedule, 'ts_d2_m_3');
  assert.equal(freePeriod3.isBusy, false);

  // Check same class at same slot (reassignment) should NOT be considered busy with another class
  const sameClassReassign = isTeacherBusy('gv_1', 'Thứ 2', 2, 'cls_6a1', state.draftSchedule, 'ts_d2_m_2');
  assert.equal(sameClassReassign.isBusy, false);
});

test('34. publishDraft sao chép toàn bộ nháp sang chính thức, cập nhật lastPublishedAt', () => {
  let state = createTestState();
  state = assignTeacherToClassSubject(state, {
    classId: 'cls_6a1',
    subjectId: 'subj_toan',
    teacherId: 'gv_1'
  });
  state = assignLessonToScheduleCell(state, {
    classId: 'cls_6a1',
    day: 'Thứ 2',
    period: 2,
    timeSlotId: 'ts_d2_m_2',
    subjectId: 'subj_toan',
    teacherId: 'gv_1'
  });

  const published = publishDraft(state);
  assert.equal(published.activeVersion, 'published');
  assert.ok(published.lastPublishedAt);
  assert.equal(published.publishedAssignments.length, state.draftAssignments.length);
  assert.equal(published.publishedSchedule.length, state.draftSchedule.length);

  const foundPub = published.publishedSchedule.find(c => c.classId === 'cls_6a1' && c.timeSlotId === 'ts_d2_m_2');
  assert.ok(foundPub);
  assert.equal(foundPub.teacherId, 'gv_1');
  assert.equal(foundPub.subjectId, 'subj_toan');
});

test('35. Sau khi công bố, thay đổi trên bản nháp (draft) không ảnh hưởng tới bản chốt (published)', () => {
  let state = createTestState();
  state = assignTeacherToClassSubject(state, {
    classId: 'cls_6a1',
    subjectId: 'subj_toan',
    teacherId: 'gv_1'
  });
  state = assignLessonToScheduleCell(state, {
    classId: 'cls_6a1',
    day: 'Thứ 2',
    period: 2,
    timeSlotId: 'ts_d2_m_2',
    subjectId: 'subj_toan',
    teacherId: 'gv_1'
  });

  let published = publishDraft(state);
  const initialPublishedCount = published.publishedSchedule.length;

  // Now change draft: add new lesson to 6A2 at Tuesday morning period 2 (ts_d3_m_2)
  published = assignLessonToScheduleCell(published, {
    classId: 'cls_6a2',
    day: 'Thứ 3',
    period: 2,
    timeSlotId: 'ts_d3_m_2',
    subjectId: 'subj_van',
    teacherId: 'gv_2'
  });

  // Draft changed
  assert.equal(published.draftSchedule.length, initialPublishedCount + 1);
  // Published remains untouched
  assert.equal(published.publishedSchedule.length, initialPublishedCount);
  assert.ok(!published.publishedSchedule.some(c => c.classId === 'cls_6a2' && c.timeSlotId === 'ts_d3_m_2'));
});

test('36. restoreDraftFromPublished khôi phục draftSchedule và draftAssignments quay về giống published', () => {
  let state = createTestState();
  state = assignTeacherToClassSubject(state, {
    classId: 'cls_6a1',
    subjectId: 'subj_toan',
    teacherId: 'gv_1'
  });
  let published = publishDraft(state);

  // Add draft changes to an empty slot (ts_d4_m_3)
  published = assignLessonToScheduleCell(published, {
    classId: 'cls_7a1',
    day: 'Thứ 4',
    period: 3,
    timeSlotId: 'ts_d4_m_3',
    subjectId: 'subj_su',
    teacherId: 'gv_3'
  });
  assert.notEqual(published.draftSchedule.length, published.publishedSchedule.length);

  // Restore
  const restored = restoreDraftFromPublished(published);
  assert.equal(restored.draftSchedule.length, published.publishedSchedule.length);
  assert.equal(restored.draftAssignments.length, published.publishedAssignments.length);
  assert.ok(!restored.draftSchedule.some(c => c.classId === 'cls_7a1' && c.timeSlotId === 'ts_d4_m_3' && c.subjectId === 'subj_su'));
});

test('37. removeLessonFromScheduleCell xóa đúng tiết khỏi draftSchedule và timetableCells', () => {
  let state = createTestState();
  state = assignLessonToScheduleCell(state, {
    classId: 'cls_6a1',
    day: 'Thứ 2',
    period: 2,
    timeSlotId: 'ts_d2_m_2',
    subjectId: 'subj_toan',
    teacherId: 'gv_1'
  });
  assert.ok(state.draftSchedule.some(c => c.classId === 'cls_6a1' && c.timeSlotId === 'ts_d2_m_2'));

  const cleared = removeLessonFromScheduleCell(state, {
    classId: 'cls_6a1',
    day: 'Thứ 2',
    period: 2,
    timeSlotId: 'ts_d2_m_2'
  });
  assert.ok(!cleared.draftSchedule.some(c => c.classId === 'cls_6a1' && c.timeSlotId === 'ts_d2_m_2'));
  assert.ok(!cleared.timetableCells.some(c => c.classId === 'cls_6a1' && c.timeSlotId === 'ts_d2_m_2'));
});
