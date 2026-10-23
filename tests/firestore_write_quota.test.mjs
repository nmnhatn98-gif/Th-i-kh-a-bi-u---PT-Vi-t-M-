import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEED } from '../src/seed.js';
import {
  clone,
  normalizeState,
  areTimetablesContentEqual,
  arePublishedContentEqual,
  areAvailabilitiesEqual,
  areUserProfilesEqual,
  isQuotaExhaustedError,
  assignLessonToScheduleCell,
  putCell,
  filterRemovedFixedCells
} from '../src/core.js';

// =========================================================================
// Mock Firestore Emulator with detailed Operation & Write Counters
// =========================================================================
function createMockFirestore() {
  const store = new Map();
  let writeCount = 0;
  let readCount = 0;
  let transactionCount = 0;
  let quotaExhaustedMode = false;

  const mockDb = {
    _store: store,
    getStats: () => ({ writeCount, readCount, transactionCount }),
    resetStats: () => {
      writeCount = 0;
      readCount = 0;
      transactionCount = 0;
    },
    setQuotaExhausted: (enabled = true) => {
      quotaExhaustedMode = enabled;
    }
  };

  const checkQuota = () => {
    if (quotaExhaustedMode) {
      const err = new Error("Quota exceeded for quota metric 'Write ops'");
      err.code = 'resource-exhausted';
      throw err;
    }
  };

  async function mockSetDoc(docRef, data, options = {}) {
    checkQuota();
    writeCount++;
    const path = docRef.path;
    if (options.merge && store.has(path)) {
      store.set(path, { ...store.get(path), ...clone(data) });
    } else {
      store.set(path, clone(data));
    }
  }

  async function mockUpdateDoc(docRef, data) {
    checkQuota();
    writeCount++;
    const path = docRef.path;
    const existing = store.get(path) || {};
    store.set(path, { ...existing, ...clone(data) });
  }

  async function mockDeleteDoc(docRef) {
    checkQuota();
    writeCount++;
    store.delete(docRef.path);
  }

  async function mockGetDoc(docRef) {
    readCount++;
    const path = docRef.path;
    const exists = store.has(path);
    return {
      exists: () => exists,
      data: () => (exists ? clone(store.get(path)) : undefined)
    };
  }

  async function mockRunTransaction(updateFunction) {
    checkQuota();
    transactionCount++;
    const transaction = {
      get: async docRef => {
        readCount++;
        const path = docRef.path;
        const exists = store.has(path);
        return {
          exists: () => exists,
          data: () => (exists ? clone(store.get(path)) : undefined)
        };
      },
      set: (docRef, data) => {
        checkQuota();
        writeCount++;
        store.set(docRef.path, clone(data));
      },
      update: (docRef, data) => {
        checkQuota();
        writeCount++;
        const path = docRef.path;
        const existing = store.get(path) || {};
        store.set(path, { ...existing, ...clone(data) });
      }
    };
    return await updateFunction(transaction);
  }

  return {
    mockDb,
    mockSetDoc,
    mockUpdateDoc,
    mockDeleteDoc,
    mockGetDoc,
    mockRunTransaction
  };
}

// =========================================================================
// App Synchronization Simulation Layer mirroring src/app.js logic
// =========================================================================
class AppSyncClient {
  constructor(emulator, userEmail = 'admin@school.edu.vn') {
    this.emu = emulator;
    this.userEmail = userEmail;
    this.currentRevision = 0;
    this.serverConfirmedWorking = null;
    this.serverConfirmedAvailability = null;
    this.workingDraft = normalizeState(clone(SEED));
    this.publishedTimetable = null;
    this.quotaExhausted = false;
    this.isSavingWorking = false;
  }

  // 1. Snapshot handler (Doc: timetables/working)
  handleWorkingSnapshot(snap) {
    // Không tự tạo bản nháp khi mở trang.
    if (!snap.exists()) {
      this.currentRevision = 0;
      this.serverConfirmedWorking = null;
      this.workingDraft = normalizeState(clone(SEED));
      // 0 writes!
      return;
    }

    const data = snap.data();
    this.currentRevision = data.revision || 1;
    const rawCells = data.timetableCells || [];
    const cleanedCells = filterRemovedFixedCells(rawCells);

    this.serverConfirmedWorking = normalizeState({
      school: data.school || SEED.school,
      classes: data.classes || [],
      subjects: data.subjects || [],
      teachers: data.teachers || [],
      timeSlots: data.timeSlots || SEED.timeSlots,
      timetableCells: cleanedCells,
      draftAssignments: data.draftAssignments || [],
      draftSchedule: data.draftSchedule || [],
      publishedAssignments: data.publishedAssignments || [],
      publishedSchedule: data.publishedSchedule || [],
      activeVersion: data.activeVersion || 'draft',
      versions: data.versions || []
    });

    // Bỏ thao tác tự ghi trong onSnapshot. Chỉ chuẩn hóa in-memory: 0 writes!
    this.workingDraft = clone(this.serverConfirmedWorking);
  }

  // 2. Snapshot handler (Doc: timetables/published)
  handlePublishedSnapshot(snap) {
    if (snap.exists() && snap.data()?.isPublished) {
      this.publishedTimetable = snap.data();
    } else {
      this.publishedTimetable = null;
    }
    // 0 writes!
  }

  // 3. Snapshot handler (Doc: availabilities)
  handleAvailabilitySnapshot(snap) {
    const data = snap.exists() ? snap.data() : null;
    this.serverConfirmedAvailability = data ? clone(data) : null;
    // 0 writes!
  }

  // 4. syncWorkingToCloud implementation
  async syncWorkingToCloud(nextState) {
    if (this.quotaExhausted) return false;
    if (this.isSavingWorking) return false;

    this.isSavingWorking = true;
    try {
      const normalized = normalizeState(nextState);

      // Check if unchanged against confirmed server data
      if (this.serverConfirmedWorking && areTimetablesContentEqual(this.serverConfirmedWorking, normalized)) {
        this.workingDraft = normalized;
        return true; // 0 writes!
      }

      // Use runTransaction to verify revision and atomic save
      const result = await this.emu.mockRunTransaction(async transaction => {
        const docRef = { path: 'timetables/working' };
        const sfDoc = await transaction.get(docRef);
        let baseRevision = 0;
        if (sfDoc.exists()) {
          const serverData = sfDoc.data();
          baseRevision = serverData.revision || 0;
          if (this.currentRevision && serverData.revision > this.currentRevision) {
            throw new Error(`Xung đột phiên bản: server ${serverData.revision} > client ${this.currentRevision}`);
          }
          const serverNormalized = normalizeState(serverData);
          if (areTimetablesContentEqual(serverNormalized, normalized)) {
            return { skipped: true, revision: serverData.revision, serverData: serverNormalized };
          }
        }

        const revision = (baseRevision || this.currentRevision || 0) + 1;
        const payload = {
          revision,
          school: normalized.school,
          classes: normalized.classes,
          subjects: normalized.subjects,
          teachers: normalized.teachers,
          timeSlots: normalized.timeSlots,
          timetableCells: normalized.timetableCells,
          draftAssignments: normalized.draftAssignments || [],
          draftSchedule: normalized.draftSchedule || [],
          publishedAssignments: normalized.publishedAssignments || [],
          publishedSchedule: normalized.publishedSchedule || [],
          lastPublishedAt: normalized.lastPublishedAt || null,
          activeVersion: normalized.activeVersion || 'draft',
          versions: normalized.versions || [],
          updatedAt: new Date().toISOString(),
          updatedBy: this.userEmail
        };

        transaction.set(docRef, payload);
        return { skipped: false, revision, payload };
      });

      if (result.skipped) {
        this.serverConfirmedWorking = clone(result.serverData || normalized);
        this.currentRevision = result.revision;
        this.workingDraft = normalized;
        return true;
      }

      this.currentRevision = result.revision;
      this.serverConfirmedWorking = clone(normalized);
      this.workingDraft = normalized;
      return true;
    } catch (err) {
      if (isQuotaExhaustedError(err)) {
        this.quotaExhausted = true;
      }
      throw err;
    } finally {
      this.isSavingWorking = false;
    }
  }

  // 5. publishToCloud implementation
  async publishToCloud() {
    if (this.quotaExhausted) return false;

    const dataToPublish = {
      school: this.workingDraft.school,
      classes: this.workingDraft.classes,
      subjects: this.workingDraft.subjects,
      teachers: this.workingDraft.teachers,
      timeSlots: this.workingDraft.timeSlots,
      timetableCells: this.workingDraft.timetableCells,
      draftAssignments: this.workingDraft.draftAssignments || [],
      draftSchedule: this.workingDraft.draftSchedule || [],
      publishedAssignments: this.workingDraft.publishedAssignments || [],
      publishedSchedule: this.workingDraft.publishedSchedule || []
    };

    if (this.publishedTimetable && this.publishedTimetable.isPublished && this.publishedTimetable.data) {
      if (arePublishedContentEqual(this.publishedTimetable.data, dataToPublish)) {
        return true; // Unchanged: 0 writes!
      }
    }

    try {
      const payload = {
        isPublished: true,
        name: `Bản chốt ${new Date().toISOString()}`,
        publishedAt: new Date().toISOString(),
        publishedBy: this.userEmail,
        data: dataToPublish
      };
      await this.emu.mockSetDoc({ path: 'timetables/published' }, payload);
      this.publishedTimetable = payload;
      return true;
    } catch (err) {
      if (isQuotaExhaustedError(err)) this.quotaExhausted = true;
      throw err;
    }
  }

  // 6. saveAvailability implementation
  async saveAvailability(payload) {
    if (this.quotaExhausted) return false;

    if (this.serverConfirmedAvailability && areAvailabilitiesEqual(this.serverConfirmedAvailability, payload)) {
      return true; // Unchanged: 0 writes!
    }

    try {
      await this.emu.mockSetDoc({ path: `availabilities/${payload.teacherEmail}` }, payload);
      this.serverConfirmedAvailability = clone(payload);
      return true;
    } catch (err) {
      if (isQuotaExhaustedError(err)) this.quotaExhausted = true;
      throw err;
    }
  }

  // 7. exportBackup (local JSON download)
  exportBackup() {
    // Pure memory operation
    return JSON.stringify(this.workingDraft, null, 2);
  }
}

// =========================================================================
// TEST SUITE: Exact checks requested by User
// =========================================================================

test('KIỂM THỬ 1: Mở trang và nhận snapshot nhiều lần -> 0 ghi', async () => {
  const emu = createMockFirestore();
  const client = new AppSyncClient(emu);

  // Initial load: working timetable does NOT exist on server yet
  const emptySnap = {
    exists: () => false,
    data: () => undefined
  };
  client.handleWorkingSnapshot(emptySnap);
  assert.equal(emu.mockDb.getStats().writeCount, 0, 'Mở trang khi chưa có bản nháp: 0 ghi');

  // Server now has data
  const serverPayload = {
    revision: 1,
    school: SEED.school,
    classes: SEED.classes,
    subjects: SEED.subjects,
    teachers: SEED.teachers,
    timeSlots: SEED.timeSlots,
    // Add raw cells that include old fixed cells to test filterRemovedFixedCells
    timetableCells: [
      ...SEED.timetableCells,
      { classId: 'cls_12xh', timeSlotId: 'ts_d2_a_1', subjectId: 'subj_ta_esl' } // old cell
    ]
  };
  const activeSnap = {
    exists: () => true,
    data: () => clone(serverPayload)
  };

  // Simulate receiving snapshot 10 times in a row
  for (let i = 0; i < 10; i++) {
    client.handleWorkingSnapshot(activeSnap);
    client.handlePublishedSnapshot({ exists: () => false });
  }

  assert.equal(emu.mockDb.getStats().writeCount, 0, 'Nhận snapshot 10 lần (kể cả có ô cũ): chính xác 0 ghi!');
});

test('KIỂM THỬ 2: Lưu nội dung không đổi -> 0 ghi', async () => {
  const emu = createMockFirestore();
  const client = new AppSyncClient(emu);

  // Initialize client with server state
  const serverPayload = {
    revision: 1,
    school: SEED.school,
    classes: SEED.classes,
    subjects: SEED.subjects,
    teachers: SEED.teachers,
    timeSlots: SEED.timeSlots,
    timetableCells: SEED.timetableCells
  };
  client.handleWorkingSnapshot({
    exists: () => true,
    data: () => clone(serverPayload)
  });

  emu.mockDb.resetStats();

  // 1. Attempt to save unchanged workingDraft
  const saved = await client.syncWorkingToCloud(client.workingDraft);
  assert.equal(saved, true);
  assert.equal(emu.mockDb.getStats().writeCount, 0, 'Lưu workingDraft khi không đổi: 0 ghi');

  // 2. Attempt to save unchanged state with just different memory object reference
  const clonedState = clone(client.workingDraft);
  await client.syncWorkingToCloud(clonedState);
  assert.equal(emu.mockDb.getStats().writeCount, 0, 'Lưu bản clone không đổi nội dung: 0 ghi');

  // 3. Attempt to publish when published timetable is already identical
  client.publishedTimetable = {
    isPublished: true,
    data: clone(client.workingDraft)
  };
  await client.publishToCloud();
  assert.equal(emu.mockDb.getStats().writeCount, 0, 'Công bố lại lịch giống bản đã công bố: 0 ghi');

  // 4. Attempt to save identical availability
  const availPayload = {
    teacherEmail: 'gv_demo@school.edu.vn',
    availableSlotIds: ['ts_d2_m_1', 'ts_d3_m_2'],
    busySlotIds: ['ts_d4_m_3'],
    dateRange: { text: 'HK1' },
    note: 'Không dạy thứ 7'
  };
  client.handleAvailabilitySnapshot({
    exists: () => true,
    data: () => clone(availPayload)
  });
  await client.saveAvailability(availPayload);
  assert.equal(emu.mockDb.getStats().writeCount, 0, 'Lưu lịch bận khi nội dung không đổi: 0 ghi');
});

test('KIỂM THỬ 3: Nhấp lưu liên tục -> không gửi trùng', async () => {
  const emu = createMockFirestore();
  const client = new AppSyncClient(emu);

  // Give initial server state
  await client.syncWorkingToCloud(client.workingDraft);
  emu.mockDb.resetStats();

  // Make an actual modification in working draft
  const modifiedState = assignLessonToScheduleCell(client.workingDraft, {
    classId: 'cls_6a1',
    day: 'Thứ 2',
    period: 2,
    timeSlotId: 'ts_d2_m_2',
    subjectId: 'subj_toan',
    teacherId: ''
  });

  // Simulate multiple rapid clicks while the first save is in-flight
  // In the first call, isSavingWorking is set to true. Subsequent concurrent calls are ignored!
  let concurrentAttemptsBlocked = 0;
  const p1 = client.syncWorkingToCloud(modifiedState);
  const p2 = client.syncWorkingToCloud(modifiedState).then(res => {
    if (!res) concurrentAttemptsBlocked++;
  });
  const p3 = client.syncWorkingToCloud(modifiedState).then(res => {
    if (!res) concurrentAttemptsBlocked++;
  });

  await Promise.all([p1, p2, p3]);

  assert.equal(concurrentAttemptsBlocked, 2, '2 lần nhấp sau khi đang lưu đã bị chặn');
  assert.equal(emu.mockDb.getStats().writeCount, 1, 'Chỉ gửi đúng 1 lần ghi duy nhất lên Firestore');
});

test('KIỂM THỬ 4: Hết hạn mức (resource-exhausted) -> không tạo thêm lần ghi từ app', async () => {
  const emu = createMockFirestore();
  const client = new AppSyncClient(emu);

  // Set Firestore emulator to throw resource-exhausted
  emu.mockDb.setQuotaExhausted(true);

  // Try to write
  const modifiedState = assignLessonToScheduleCell(client.workingDraft, {
    classId: 'cls_6a1',
    day: 'Thứ 2',
    period: 2,
    timeSlotId: 'ts_d2_m_2',
    subjectId: 'subj_toan',
    teacherId: ''
  });

  await assert.rejects(
    () => client.syncWorkingToCloud(modifiedState),
    /resource-exhausted|Quota exceeded/
  );

  assert.equal(client.quotaExhausted, true, 'App đã ghi nhận trạng thái quotaExhausted');

  emu.mockDb.resetStats();

  // Now subsequent save attempts from client must be blocked locally BEFORE reaching Firestore
  const saveResult = await client.syncWorkingToCloud(modifiedState);
  assert.equal(saveResult, false);

  const pubResult = await client.publishToCloud();
  assert.equal(pubResult, false);

  const availResult = await client.saveAvailability({
    teacherEmail: 'gv@test.com',
    availableSlotIds: []
  });
  assert.equal(availResult, false);

  assert.equal(emu.mockDb.getStats().writeCount, 0, 'Sau khi hết hạn mức: app không phát sinh thêm bất kỳ lần ghi nào');
});

test('KIỂM THỬ 5: Sửa lịch thật -> lưu đúng và không mất dữ liệu', async () => {
  const emu = createMockFirestore();
  const client = new AppSyncClient(emu);

  // Initial save
  await client.syncWorkingToCloud(client.workingDraft);
  assert.equal(client.currentRevision, 1);
  const initialCellsCount = client.workingDraft.timetableCells.length;

  // Real edit: add a new subject cell to class 6A1 period 2
  const updatedState = assignLessonToScheduleCell(client.workingDraft, {
    classId: 'cls_6a1',
    day: 'Thứ 2',
    period: 2,
    timeSlotId: 'ts_d2_m_2',
    subjectId: 'subj_toan',
    teacherId: '',
    note: 'Tiết toán bổ sung'
  });

  emu.mockDb.resetStats();
  const success = await client.syncWorkingToCloud(updatedState);
  assert.equal(success, true);
  assert.equal(emu.mockDb.getStats().writeCount, 1, 'Ghi 1 lần cho thay đổi thật');
  assert.equal(client.currentRevision, 2, 'Revision tăng lên 2');

  // Verify stored document preserves all data
  const stored = emu.mockDb._store.get('timetables/working');
  assert.ok(stored);
  assert.equal(stored.revision, 2);
  assert.equal(stored.classes.length, 17, 'Giữ đầy đủ 17 lớp');
  assert.equal(stored.timeSlots.length, 45, 'Giữ đầy đủ 45 tiết');
  assert.equal(stored.timetableCells.length, initialCellsCount + 1, 'Bảo toàn dữ liệu cũ và thêm ô mới');
  const found = stored.timetableCells.find(c => c.classId === 'cls_6a1' && c.timeSlotId === 'ts_d2_m_2');
  assert.ok(found);
  assert.equal(found.note, 'Tiết toán bổ sung');
});

test('KIỂM THỬ 6: Tải sao lưu -> 0 ghi', () => {
  const emu = createMockFirestore();
  const client = new AppSyncClient(emu);

  emu.mockDb.resetStats();
  const jsonBackup = client.exportBackup();
  assert.ok(jsonBackup.includes('cls_6a1'));
  assert.equal(emu.mockDb.getStats().writeCount, 0, 'Tải sao lưu JSON: chính xác 0 ghi');
});

test('KIỂM THỬ 7: Transaction kiểm tra revision -> phát hiện xung đột và không ghi đè', async () => {
  const emu = createMockFirestore();
  const clientA = new AppSyncClient(emu, 'userA@school.edu.vn');
  const clientB = new AppSyncClient(emu, 'userB@school.edu.vn');

  // Initial state on server (rev 1)
  await clientA.syncWorkingToCloud(clientA.workingDraft);
  assert.equal(clientA.currentRevision, 1);

  // Both clients receive rev 1
  const serverDoc = emu.mockDb._store.get('timetables/working');
  clientA.handleWorkingSnapshot({ exists: () => true, data: () => clone(serverDoc) });
  clientB.handleWorkingSnapshot({ exists: () => true, data: () => clone(serverDoc) });

  // Client A saves change first -> advances server to rev 2
  const editA = assignLessonToScheduleCell(clientA.workingDraft, {
    classId: 'cls_6a1',
    day: 'Thứ 2',
    period: 2,
    timeSlotId: 'ts_d2_m_2',
    subjectId: 'subj_toan'
  });
  await clientA.syncWorkingToCloud(editA);
  assert.equal(clientA.currentRevision, 2);

  // Client B (still at rev 1) tries to save a different edit
  const editB = assignLessonToScheduleCell(clientB.workingDraft, {
    classId: 'cls_6a2',
    day: 'Thứ 2',
    period: 2,
    timeSlotId: 'ts_d2_m_2',
    subjectId: 'subj_van'
  });

  // Client B's save must fail due to revision conflict!
  await assert.rejects(
    () => clientB.syncWorkingToCloud(editB),
    /Xung đột phiên bản/
  );

  // Verify server data is still Client A's data and was NOT overwritten by Client B
  const finalServerDoc = emu.mockDb._store.get('timetables/working');
  assert.equal(finalServerDoc.revision, 2);
  assert.equal(finalServerDoc.updatedBy, 'userA@school.edu.vn');
});

test('KIỂM THỬ 8: areUserProfilesEqual phát hiện chính xác khi hồ sơ không đổi', () => {
  const profile = {
    role: 'TEACHER',
    displayName: 'Nguyễn Văn An',
    teacherId: 'gv_01',
    isVisiting: false,
    active: true,
    homeroomClassIds: ['cls_6a1', 'cls_6a2'],
    selfDeclared: {
      subjects: ['Toán', 'Lý'],
      homeroomClassId: 'cls_6a1',
      note: 'Ghi chú'
    }
  };

  // Identical
  assert.equal(areUserProfilesEqual(profile, clone(profile)), true);

  // Homeroom class array order difference only -> should still be equal
  const reorderedHomeroom = {
    ...profile,
    homeroomClassIds: ['cls_6a2', 'cls_6a1']
  };
  assert.equal(areUserProfilesEqual(profile, reorderedHomeroom), true);

  // Different role -> unequal
  assert.equal(areUserProfilesEqual(profile, { ...profile, role: 'ADMIN' }), false);

  // Different active status -> unequal
  assert.equal(areUserProfilesEqual(profile, { ...profile, active: false }), false);
});
