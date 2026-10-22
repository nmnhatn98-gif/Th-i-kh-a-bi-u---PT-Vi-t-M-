import * as XLSX from 'xlsx';
import { SEED } from './seed.js';
import {
  uid,
  clone,
  keyOf,
  findConflicts,
  putCell,
  deleteCell,
  deleteEntity,
  makeSnapshot,
  restoreSnapshot,
  validateState,
  parseBackup,
  exportCsv,
  resolveSubjectAndTeacher,
  assignTeacherToClassSubject,
  unassignClassSubject,
  getAssignedTeacher,
  normalizeState,
  parseTeacherRows,
  importTeachersIntoState,
  TEACHER_TEMPLATE_ROWS
} from './core.js';
import {
  auth,
  db,
  googleProvider,
  signInWithPopup,
  fbSignOut,
  onAuthStateChanged,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  onSnapshot,
  handleFirestoreError,
  OperationType,
  testConnection
} from './firebase.js';

const KEY = 'TKB_NEW_V1';
const OWNER_EMAIL = 'nmnhat.n98@gmail.com';

// ----------------------------------------------------
// Global State
// ----------------------------------------------------
let state = normalizeState(clone(SEED));
let workingDraft = normalizeState(clone(SEED));
let publishedTimetable = null;
let currentRevision = 1;

// Workspaces: 'ADMIN' | 'SCHEDULER' | 'HOMEROOM' | 'VISITING' | 'TEACHER'
let currentWorkspace = 'ADMIN';
let view = 'matrix'; // active sub-view
let matrixViewMode = 'assignment'; // 'assignment' (Ma trận phân công Môn - Lớp) | 'timetable' (Tiết - Lớp)
let brushTeacherId = '';
let brushMode = 'none'; // 'none' | 'brush' | 'eraser'
let selectedTeacherHighlight = '';
let grade = '';
let teacher = '';
let query = '';
let compact = true;
let showPublished = false;

// Sub-view specific filters
let selectedHomeroomClassId = '';
let personalViewMode = 'week'; // 'week' | 'day'

// Auth & Permissions
let currentUser = null;
let currentUserProfile = null;
let authLoading = true;
let authError = '';
let loginIntent = 'teacher'; // 'admin' | 'teacher'
let isSubmittingOnboarding = false;

// Sync status
let syncStatus = 'idle'; // 'idle' | 'saving' | 'error' | 'offline'
let syncMessage = 'Đã kết nối Cloud';

// Realtime collections
let accountsList = [];
let requestsList = [];
let availabilityDoc = null;

// Unsubscribers
let unsubUser = null;
let unsubWorking = null;
let unsubPublished = null;
let unsubAccounts = null;
let unsubRequests = null;
let unsubAvailability = null;

const app = document.querySelector('#app');
const dialog = document.querySelector('#editor');

const esc = value =>
  String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));

const text = (items, id, field = 'name') => items.find(x => x.id === id)?.[field] || '—';
const nameOfTeacher = id => text(state.teachers || [], id, 'fullName');
const fmt = date => (date ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(date)) : '—');
const fmtDateOnly = date => (date ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short' }).format(new Date(date)) : '—');

export const titles = {
  overview: 'Tổng quan hệ thống',
  matrix: 'Thời khóa biểu toàn trường',
  teacher: 'Lịch giáo viên',
  conflicts: 'Kiểm tra xung đột',
  versions: 'Phiên bản & Bản đã chốt',
  catalog: 'Danh mục phục vụ xếp lịch',
  accounts: 'Quản lý tài khoản & Phân quyền',
  pending: 'Hồ sơ giáo viên chờ xác nhận',
  backup: 'Sao lưu & Khôi phục',
  school: 'Thông tin nhà trường',
  homeroom_overview: 'Tổng quan lớp chủ nhiệm',
  homeroom_class: 'Thời khóa biểu lớp chủ nhiệm',
  my_teaching: 'Lịch giảng dạy của tôi',
  published_all: 'Thời khóa biểu toàn trường đã chốt',
  visiting_overview: 'Tổng quan giáo viên thỉnh giảng',
  availability: 'Đăng ký thời gian có thể dạy',
  submit_request: 'Gửi yêu cầu điều chỉnh lịch',
  teacher_requests: 'Lịch bận & Yêu cầu của giáo viên',
  profile: 'Hồ sơ cá nhân',
  settings: 'Thông tin & Dữ liệu'
};

export function selectOptions(items = [], selectedId = '', labelField = 'name', emptyLabel = '') {
  let html = '';
  if (emptyLabel) {
    html += `<option value="">${esc(emptyLabel)}</option>`;
  }
  if (Array.isArray(items)) {
    for (const item of items) {
      if (!item) continue;
      const isSelected = String(item.id) === String(selectedId);
      const label = item[labelField] ?? item.name ?? item.fullName ?? item.title ?? item.id ?? '';
      html += `<option value="${esc(item.id)}"${isSelected ? ' selected' : ''}>${esc(label)}</option>`;
    }
  }
  return html;
}

let toastTimer;
function toast(message) {
  const toastEl = document.querySelector('#toast');
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('visible'), 4500);
}

function setSync(status, message = '') {
  syncStatus = status;
  syncMessage = message;
  const statusEl = document.querySelector('#sync-indicator');
  if (statusEl) {
    statusEl.className = `sync-status ${status}`;
    statusEl.innerHTML = `<span class="sync-dot ${status}"></span><span>${esc(message || (status === 'saving' ? 'Đang lưu...' : status === 'error' ? 'Lỗi lưu' : 'Đã lưu Cloud'))}</span>`;
  }
}

// ----------------------------------------------------
// Permissions & Role Utilities
// ----------------------------------------------------
function isOwner() {
  return currentUserProfile?.email === OWNER_EMAIL || currentUserProfile?.role === 'OWNER';
}
function isAdmin() {
  return isOwner() || currentUserProfile?.role === 'ADMIN';
}
function isSchedulerRole() {
  return isAdmin() || currentUserProfile?.role === 'SCHEDULER';
}
function isTeacherRole() {
  return currentUserProfile?.role === 'TEACHER';
}
function isHomeroomTeacher() {
  return Array.isArray(currentUserProfile?.homeroomClassIds) && currentUserProfile.homeroomClassIds.length > 0;
}
function isVisitingTeacher() {
  return !!currentUserProfile?.isVisiting;
}

function getAvailableWorkspaces() {
  const ws = [];
  if (isAdmin()) ws.push({ id: 'ADMIN', label: 'Quản trị hệ thống' });
  if (isSchedulerRole()) ws.push({ id: 'SCHEDULER', label: 'Không gian xếp lịch' });
  if (isHomeroomTeacher()) ws.push({ id: 'HOMEROOM', label: 'Giáo viên chủ nhiệm' });
  if (isVisitingTeacher()) ws.push({ id: 'VISITING', label: 'Giáo viên thỉnh giảng' });
  if (currentUserProfile?.teacherId) ws.push({ id: 'TEACHER', label: 'Lịch giảng dạy cá nhân' });
  return ws;
}

function determineDefaultWorkspace() {
  if (isAdmin()) return 'ADMIN';
  if (isSchedulerRole()) return 'SCHEDULER';
  if (isHomeroomTeacher()) return 'HOMEROOM';
  if (isVisitingTeacher()) return 'VISITING';
  return 'TEACHER';
}

function canEditWorking() {
  return (currentWorkspace === 'ADMIN' || currentWorkspace === 'SCHEDULER') && !showPublished && isSchedulerRole();
}

// ----------------------------------------------------
// Firestore Sync & Actions
// ----------------------------------------------------
async function syncWorkingToCloud(nextState) {
  if (!isSchedulerRole()) {
    toast('Chỉ Người xếp lịch hoặc Quản trị viên mới được cập nhật bản nháp.');
    return false;
  }
  setSync('saving', 'Đang lưu lên Cloud...');
  try {
    validateState(nextState);
    const revision = (currentRevision || 0) + 1;
    const payload = {
      revision,
      school: nextState.school,
      classes: nextState.classes,
      subjects: nextState.subjects,
      teachers: nextState.teachers,
      timeSlots: nextState.timeSlots,
      timetableCells: nextState.timetableCells,
      versions: nextState.versions || [],
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser?.email || 'admin'
    };
    await setDoc(doc(db, 'timetables', 'working'), payload);
    currentRevision = revision;
    state = nextState;
    workingDraft = clone(nextState);
    setSync('idle', 'Đã lưu Cloud');
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'timetables/working');
    setSync('error', 'Lỗi lưu: ' + error.message);
    toast('Lỗi lưu Cloud: ' + error.message);
    return false;
  }
}

async function publishToCloud() {
  if (!isSchedulerRole()) return;
  const conflicts = findConflicts(workingDraft);
  if (conflicts.length) {
    toast('Còn lịch trùng giáo viên. Vui lòng xử lý trước khi chốt.');
    return;
  }
  if (!confirm('Chốt bản đang xếp? Toàn trường và các giáo viên sẽ xem được bản này.')) return;

  setSync('saving', 'Đang chốt lịch...');
  try {
    const payload = {
      isPublished: true,
      name: `Bản chốt ${fmt(new Date())}`,
      publishedAt: new Date().toISOString(),
      publishedBy: currentUser?.email || 'admin',
      data: {
        school: workingDraft.school,
        classes: workingDraft.classes,
        subjects: workingDraft.subjects,
        teachers: workingDraft.teachers,
        timeSlots: workingDraft.timeSlots,
        timetableCells: workingDraft.timetableCells
      }
    };
    await setDoc(doc(db, 'timetables', 'published'), payload);
    setSync('idle', 'Đã chốt lịch thành công');
    toast('Đã chốt lịch toàn trường lên Cloud.');
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'timetables/published');
    setSync('error', 'Lỗi chốt lịch');
  }
}

async function unpublishFromCloud() {
  if (!isSchedulerRole()) return;
  if (!confirm('Gỡ bản đã chốt? Toàn trường sẽ không thấy lịch cho đến khi chốt lại.')) return;

  setSync('saving', 'Đang gỡ bản chốt...');
  try {
    await setDoc(doc(db, 'timetables', 'published'), {
      isPublished: false,
      name: '',
      publishedAt: null,
      publishedBy: currentUser?.email || 'admin',
      data: null
    });
    setSync('idle', 'Đã gỡ bản chốt');
    toast('Đã gỡ bản đã chốt.');
    showPublished = false;
    render();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'timetables/published');
    setSync('error', 'Lỗi gỡ chốt');
  }
}

// ----------------------------------------------------
// Realtime Data Subscriptions
// ----------------------------------------------------
function stopAllSubscriptions() {
  if (unsubWorking) { unsubWorking(); unsubWorking = null; }
  if (unsubPublished) { unsubPublished(); unsubPublished = null; }
  if (unsubAccounts) { unsubAccounts(); unsubAccounts = null; }
  if (unsubRequests) { unsubRequests(); unsubRequests = null; }
  if (unsubAvailability) { unsubAvailability(); unsubAvailability = null; }
}

function initDataSubscriptions() {
  stopAllSubscriptions();

  // 1. Published timetable listener (for all active users)
  unsubPublished = onSnapshot(
    doc(db, 'timetables', 'published'),
    snap => {
      if (snap.exists() && snap.data()?.isPublished) {
        publishedTimetable = snap.data();
      } else {
        publishedTimetable = null;
      }
      if (currentWorkspace !== 'ADMIN' && currentWorkspace !== 'SCHEDULER') {
        showPublished = true;
        if (publishedTimetable?.data) {
          state = clone(publishedTimetable.data);
        }
      }
      render();
    },
    err => handleFirestoreError(err, OperationType.GET, 'timetables/published')
  );

  // 2. Working timetable listener (SCHEDULER / ADMIN / OWNER)
  if (isSchedulerRole()) {
    unsubWorking = onSnapshot(
      doc(db, 'timetables', 'working'),
      async snap => {
        if (!snap.exists()) {
          try {
            await setDoc(doc(db, 'timetables', 'working'), {
              revision: 1,
              school: SEED.school,
              classes: SEED.classes,
              subjects: SEED.subjects,
              teachers: SEED.teachers,
              timeSlots: SEED.timeSlots,
              timetableCells: SEED.timetableCells,
              versions: [],
              updatedAt: new Date().toISOString(),
              updatedBy: currentUser?.email || 'admin'
            });
          } catch (initErr) {
            console.warn('Working timetable init error:', initErr);
          }
          return;
        }
        const data = snap.data();
        currentRevision = data.revision || 1;
        workingDraft = {
          school: data.school || SEED.school,
          classes: data.classes || [],
          subjects: data.subjects || [],
          teachers: data.teachers || [],
          timeSlots: data.timeSlots || SEED.timeSlots,
          timetableCells: data.timetableCells || [],
          versions: data.versions || []
        };
        if (!showPublished && (currentWorkspace === 'ADMIN' || currentWorkspace === 'SCHEDULER')) {
          state = clone(workingDraft);
        }
        setSync('idle', 'Đã lưu Cloud');
        render();
      },
      err => {
        handleFirestoreError(err, OperationType.GET, 'timetables/working');
        setSync('error', 'Lỗi đồng bộ nháp');
      }
    );
  }

  // 3. Accounts listener (ADMIN / OWNER)
  if (isAdmin()) {
    unsubAccounts = onSnapshot(
      collection(db, 'users'),
      snap => {
        accountsList = snap.docs.map(d => d.data());
        accountsList.sort((a, b) => a.email.localeCompare(b.email));
        render();
      },
      err => handleFirestoreError(err, OperationType.LIST, 'users')
    );
  }

  // 4. Requests listener (Schedulers read all, Teachers read their own)
  unsubRequests = onSnapshot(
    collection(db, 'requests'),
    snap => {
      requestsList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      requestsList.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      render();
    },
    err => handleFirestoreError(err, OperationType.LIST, 'requests')
  );

  // 5. Visiting Availability listener
  if (currentUser?.email) {
    unsubAvailability = onSnapshot(
      doc(db, 'availabilities', currentUser.email.toLowerCase()),
      snap => {
        availabilityDoc = snap.exists() ? snap.data() : null;
        render();
      },
      err => handleFirestoreError(err, OperationType.GET, `availabilities/${currentUser.email}`)
    );
  }
}

// ----------------------------------------------------
// Authentication Handler
// ----------------------------------------------------
function handleAuthState() {
  onAuthStateChanged(auth, async user => {
    authLoading = false;
    currentUser = user;
    if (!user) {
      currentUserProfile = null;
      stopAllSubscriptions();
      if (unsubUser) { unsubUser(); unsubUser = null; }
      render();
      return;
    }

    const email = (user.email || '').toLowerCase().trim();

    // Bootstrap OWNER if matching email
    if (email === OWNER_EMAIL) {
      try {
        const uDoc = await getDoc(doc(db, 'users', email));
        if (!uDoc.exists()) {
          await setDoc(doc(db, 'users', email), {
            email,
            role: 'OWNER',
            active: true,
            displayName: user.displayName || 'Quản trị chính (OWNER)',
            updatedAt: new Date().toISOString(),
            updatedBy: 'bootstrap'
          });
        }
      } catch (e) {
        console.warn('Owner bootstrap check:', e);
      }
    }

    // Subscribe to current user profile
    if (unsubUser) unsubUser();
    unsubUser = onSnapshot(
      doc(db, 'users', email),
      docSnap => {
        if (!docSnap.exists()) {
          // User authenticated with Google but not yet in database
          currentUserProfile = null;
          stopAllSubscriptions();
          render();
          return;
        }

        const data = docSnap.data();
        if (data.active !== true) {
          currentUserProfile = data; // Keep profile to show pending view
          stopAllSubscriptions();
          render();
          return;
        }

        const isFirstLoad = !currentUserProfile;
        currentUserProfile = data;

        if (isFirstLoad) {
          currentWorkspace = determineDefaultWorkspace();
          if (isHomeroomTeacher()) {
            selectedHomeroomClassId = currentUserProfile.homeroomClassIds[0] || '';
          }
          if (currentWorkspace !== 'ADMIN' && currentWorkspace !== 'SCHEDULER') {
            showPublished = true;
          }
          initDataSubscriptions();
        }

        render();
      },
      err => {
        console.error('User subscription error:', err);
        currentUserProfile = null;
        render();
      }
    );
  });
}

// ----------------------------------------------------
// Helper Calculations
// ----------------------------------------------------
function displayed() {
  if (currentWorkspace !== 'ADMIN' && currentWorkspace !== 'SCHEDULER') {
    return publishedTimetable?.data || { ...state, timetableCells: [] };
  }
  return showPublished ? (publishedTimetable?.data || { ...state, timetableCells: [] }) : state;
}

function getTeacherLessons(teacherId, sourceData = displayed()) {
  if (!teacherId || !sourceData?.timetableCells) return [];
  return sourceData.timetableCells
    .filter(c => c.teacherId === teacherId)
    .map(c => {
      const slot = (sourceData.timeSlots || []).find(s => s.id === c.timeSlotId);
      const cls = (sourceData.classes || []).find(x => x.id === c.classId);
      const subj = (sourceData.subjects || []).find(x => x.id === c.subjectId);
      return { cell: c, slot, class: cls, subject: subj };
    })
    .sort((a, b) => (a.slot?.dayOfWeek || 0) - (b.slot?.dayOfWeek || 0) || (a.slot?.globalPeriod || 0) - (b.slot?.globalPeriod || 0));
}

function getTodayDayOfWeek() {
  const day = new Date().getDay(); // 0 is Sunday, 1 is Monday ... 5 is Friday, 6 is Saturday
  return day === 0 || day === 6 ? 2 : day + 1; // Default to Monday if weekend
}

// ----------------------------------------------------
// VIEW 1: Giao diện Quản trị (OWNER & ADMIN)
// ----------------------------------------------------
function renderAdminWorkspace() {
  const s = displayed();
  const conflicts = findConflicts(workingDraft);
  const pendingProfiles = accountsList.filter(a => a.active === false || (a.selfDeclared && !a.teacherId));

  const adminMenu = [
    ['overview', '📊', 'Tổng quan'],
    ['matrix', '▦', 'Thời khóa biểu toàn trường'],
    ['catalog', '▤', 'Danh mục (Lớp/Môn/GV)'],
    ['accounts', '👥', 'Quản lý tài khoản & Quyền'],
    ['pending', '📋', `Hồ sơ GV chờ xác nhận ${pendingProfiles.length ? `<b class="badge">${pendingProfiles.length}</b>` : ''}`],
    ['conflicts', '◎', `Kiểm tra xung đột ${conflicts.length ? `<b class="badge">${conflicts.length}</b>` : ''}`],
    ['versions', '▱', 'Phiên bản & Công bố'],
    ['backup', '💾', 'Sao lưu & Khôi phục'],
    ['school', '🏫', 'Thông tin nhà trường']
  ];

  return {
    menu: adminMenu,
    content: () => {
      if (view === 'overview') {
        return `
          <div class="dashboard-hero">
            <span class="hero-tag">BẢNG ĐIỀU KHIỂN QUẢN TRỊ</span>
            <h2>Xin chào, ${esc(currentUserProfile?.displayName || currentUser?.email)}</h2>
            <p>Hệ thống thời khóa biểu toàn trường đang hoạt động. Cập nhật mới nhất lúc: ${esc(fmt(workingDraft.updatedAt || new Date()))}.</p>
            <div class="hero-tags">
              <span class="hero-tag">Trường: ${esc(state.school?.name || 'Trường THCS & THPT')}</span>
              <span class="hero-tag">${esc(state.school?.year || '2026-2027')} · ${esc(state.school?.term || 'HK1')}</span>
              <span class="hero-tag">Bản chốt: ${publishedTimetable?.isPublished ? 'Đang công bố ✓' : 'Chưa công bố'}</span>
            </div>
          </div>

          <section class="stats">
            <div><span class="stat-icon">▤</span><div><strong>${s.classes?.length || 0}</strong><span>Lớp học</span></div></div>
            <div><span class="stat-icon">♙</span><div><strong>${s.teachers?.length || 0}</strong><span>Giáo viên</span></div></div>
            <div><span class="stat-icon">📚</span><div><strong>${s.subjects?.length || 0}</strong><span>Môn học</span></div></div>
            <div class="${conflicts.length ? 'warning-stat' : ''}"><span class="stat-icon">◎</span><div><strong>${conflicts.length ? conflicts.length : 'Không có'}</strong><span>Lịch trùng cần xử lý</span></div></div>
          </section>

          <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:20px;">
            <div class="card">
              <div class="card-title">
                <h2>Hồ sơ giáo viên chờ xác nhận (${pendingProfiles.length})</h2>
                <button data-view="pending">Xem tất cả</button>
              </div>
              ${
                pendingProfiles.length
                  ? pendingProfiles.slice(0, 4).map(p => `
                    <div class="pending-box">
                      <strong>${esc(p.displayName || p.email)}</strong> <small>(${esc(p.email)})</small>
                      <div class="pending-details">
                        Môn tự khai: ${esc(p.selfDeclared?.subjects?.join(', ') || 'Chưa chọn')}<br>
                        Lớp chủ nhiệm tự khai: ${esc(p.selfDeclared?.homeroomClassId ? text(state.classes || [], p.selfDeclared.homeroomClassId) : 'Không chủ nhiệm')}
                      </div>
                      <button data-review-profile="${esc(p.email)}" class="primary" style="font-size:10px;padding:5px 9px;">Xác nhận & Cấp quyền</button>
                    </div>
                  `).join('')
                  : '<p class="muted">Không có hồ sơ nào đang chờ xác nhận.</p>'
              }
            </div>

            <div class="card">
              <div class="card-title">
                <h2>Trạng thái thời khóa biểu</h2>
                <button data-view="versions">Chi tiết</button>
              </div>
              <dl>
                <dt>Bản nháp:</dt><dd>${workingDraft.timetableCells?.length || 0} ô đã xếp (Revision: ${currentRevision})</dd>
                <dt>Bản công bố:</dt><dd>${publishedTimetable?.isPublished ? `<span style="color:#1e6a32;font-weight:700;">Đã chốt lúc ${esc(fmt(publishedTimetable.publishedAt))}</span>` : 'Chưa có bản chốt'}</dd>
                <dt>Xung đột:</dt><dd>${conflicts.length ? `<span style="color:#ba6a50;font-weight:700;">${conflicts.length} khung giờ trùng giáo viên</span>` : 'Không có'}</dd>
                <dt>Lần sửa cuối:</dt><dd>${esc(fmt(workingDraft.updatedAt))} bởi ${esc(workingDraft.updatedBy || 'admin')}</dd>
              </dl>
              <div style="margin-top:16px;">
                <button data-view="matrix" class="primary" style="width:100%;">Mở ma trận toàn trường</button>
              </div>
            </div>
          </div>
        `;
      }
      if (view === 'matrix') return renderMatrixSection(s);
      if (view === 'catalog') return catalog();
      if (view === 'accounts') return accountsPage();
      if (view === 'pending') return renderPendingProfilesPage(pendingProfiles);
      if (view === 'conflicts') return conflictPage();
      if (view === 'versions') return versionsPage();
      if (view === 'backup') return settings();
      if (view === 'school') return renderSchoolPage();
      return renderMatrixSection(s);
    }
  };
}

// ----------------------------------------------------
// VIEW 2: Không gian xếp lịch (SCHEDULER)
// ----------------------------------------------------
function renderSchedulerWorkspace() {
  const s = displayed();
  const conflicts = findConflicts(workingDraft);

  const schedulerMenu = [
    ['matrix', '▦', 'Ma trận toàn trường'],
    ['conflicts', '◎', `Kiểm tra xung đột ${conflicts.length ? `<b class="badge">${conflicts.length}</b>` : ''}`],
    ['catalog', '▤', 'Danh mục phục vụ xếp lịch'],
    ['teacher_requests', '📩', `Lịch bận & Yêu cầu ${requestsList.filter(r => r.status === 'PENDING').length ? `<b class="badge">${requestsList.filter(r => r.status === 'PENDING').length}</b>` : ''}`],
    ['versions', '▱', 'Phiên bản & Bản đã chốt'],
    ...(currentUserProfile?.teacherId ? [['my_teaching', '◷', 'Lịch giảng dạy của tôi']] : [])
  ];

  return {
    menu: schedulerMenu,
    content: () => {
      if (view === 'matrix') return renderMatrixSection(s);
      if (view === 'conflicts') return conflictPage();
      if (view === 'catalog') return catalog();
      if (view === 'teacher_requests') return renderSchedulerTeacherRequests();
      if (view === 'versions') return versionsPage();
      if (view === 'my_teaching') return renderMyTeachingView();
      return renderMatrixSection(s);
    }
  };
}

// ----------------------------------------------------
// VIEW 3: Không gian giáo viên chủ nhiệm (HOMEROOM)
// ----------------------------------------------------
function renderHomeroomWorkspace() {
  const teacherId = currentUserProfile?.teacherId || '';
  const teacherObj = (state.teachers || []).find(t => t.id === teacherId);
  const homeroomIds = currentUserProfile?.homeroomClassIds || [];
  const homeroomClasses = (state.classes || []).filter(c => homeroomIds.includes(c.id));
  const todayDay = getTodayDayOfWeek();

  const myLessons = getTeacherLessons(teacherId, publishedTimetable?.data);
  const todayMyLessons = myLessons.filter(l => l.slot?.dayOfWeek === todayDay);

  const homeroomMenu = [
    ['homeroom_overview', '🏠', 'Tổng quan lớp chủ nhiệm'],
    ['homeroom_class', '📅', 'Thời khóa biểu lớp chủ nhiệm'],
    ['my_teaching', '◷', 'Lịch giảng dạy của tôi'],
    ['published_all', '▦', 'TKB toàn trường đã chốt'],
    ['profile', '👤', 'Hồ sơ của tôi'],
    ['submit_request', '✉️', 'Gửi yêu cầu điều chỉnh']
  ];

  return {
    menu: homeroomMenu,
    content: () => {
      if (view === 'homeroom_overview') {
        return `
          <div class="dashboard-hero">
            <span class="hero-tag">GIÁO VIÊN CHỦ NHIỆM</span>
            <h2>Thầy/Cô ${esc(teacherObj?.fullName || currentUserProfile?.displayName)}</h2>
            <p>Lớp chủ nhiệm chính thức: <strong>${esc(homeroomClasses.map(c => c.name).join(', ') || 'Chưa gán')}</strong> · Môn khai báo: ${esc(currentUserProfile?.selfDeclared?.subjects?.join(', ') || '—')}</p>
            <div class="hero-tags">
              <span class="hero-tag">Tiết dạy hôm nay (Thứ ${todayDay}): ${todayMyLessons.length} tiết</span>
              <span class="hero-tag">Bản chốt: ${publishedTimetable?.isPublished ? esc(publishedTimetable.name) : 'Chưa có bản chốt'}</span>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
            <div class="card">
              <div class="card-title">
                <h2>Tiết dạy của bạn hôm nay (Thứ ${todayDay})</h2>
                <button data-view="my_teaching">Xem toàn bộ</button>
              </div>
              ${
                todayMyLessons.length
                  ? todayMyLessons.map(l => `
                    <div class="lesson-card">
                      <div class="lesson-time">
                        ${esc(l.slot?.startTime)} – ${esc(l.slot?.endTime)}
                        <small>${l.slot?.session === 'MORNING' ? 'Sáng' : 'Chiều'} · Tiết ${l.slot?.period}</small>
                      </div>
                      <div class="lesson-info">
                        <strong>${esc(l.subject?.name)}</strong>
                        <span>${esc(l.class?.name)} ${l.cell.note ? '· ' + esc(l.cell.note) : ''}</span>
                      </div>
                      <span class="lesson-tag">${esc(l.class?.name)}</span>
                    </div>
                  `).join('')
                  : '<p class="muted">Hôm nay thầy/cô không có tiết giảng dạy.</p>'
              }
            </div>

            <div class="card">
              <div class="card-title">
                <h2>Thời khóa biểu lớp chủ nhiệm</h2>
                <button data-view="homeroom_class" class="primary">Mở lịch lớp</button>
              </div>
              <p>Xem toàn bộ lịch học của lớp mình chủ nhiệm để theo dõi và nhắc nhở học sinh.</p>
              <div style="margin-top:16px;">
                ${homeroomClasses.map(c => `
                  <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #edf0e8;">
                    <strong>${esc(c.name)}</strong>
                    <button data-open-homeroom-class="${esc(c.id)}">Xem TKB lớp này ↗</button>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        `;
      }
      if (view === 'homeroom_class') return renderHomeroomClassTimetable(homeroomClasses);
      if (view === 'my_teaching') return renderMyTeachingView();
      if (view === 'published_all') return renderMatrixSection(displayed());
      if (view === 'profile') return renderMyProfileView();
      if (view === 'submit_request') return renderTeacherRequestSubmission();
      return renderHomeroomClassTimetable(homeroomClasses);
    }
  };
}

// ----------------------------------------------------
// VIEW 4: Không gian giáo viên thỉnh giảng (VISITING)
// ----------------------------------------------------
function renderVisitingWorkspace() {
  const teacherId = currentUserProfile?.teacherId || '';
  const myLessons = getTeacherLessons(teacherId, publishedTimetable?.data);
  const todayDay = getTodayDayOfWeek();
  const todayMyLessons = myLessons.filter(l => l.slot?.dayOfWeek === todayDay);
  const myRequests = requestsList.filter(r => r.teacherEmail === currentUser.email);

  const visitingMenu = [
    ['visiting_overview', '⚡', 'Tổng quan thỉnh giảng'],
    ['my_teaching', '◷', 'Lịch giảng dạy của tôi'],
    ['availability', '📅', 'Đăng ký thời gian có thể dạy'],
    ['submit_request', '✉️', `Báo bận / Đổi lịch ${myRequests.filter(r => r.status === 'PENDING').length ? `<b class="badge">${myRequests.filter(r => r.status === 'PENDING').length}</b>` : ''}`],
    ['profile', '👤', 'Hồ sơ cá nhân']
  ];

  return {
    menu: visitingMenu,
    content: () => {
      if (view === 'visiting_overview') {
        return `
          <div class="dashboard-hero">
            <span class="hero-tag">GIÁO VIÊN THỈNH GIẢNG</span>
            <h2>Chào mừng Thầy/Cô ${esc(currentUserProfile?.displayName || currentUser?.email)}</h2>
            <p>Hệ thống tự động cập nhật lịch giảng dạy và cho phép đăng ký khung giờ rảnh trực tiếp cho Người xếp lịch.</p>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
            <div class="card">
              <div class="card-title">
                <h2>Tiết dạy hôm nay (Thứ ${todayDay})</h2>
                <button data-view="my_teaching">Xem tuần</button>
              </div>
              ${
                todayMyLessons.length
                  ? todayMyLessons.map(l => `
                    <div class="lesson-card">
                      <div class="lesson-time">
                        ${esc(l.slot?.startTime)} – ${esc(l.slot?.endTime)}
                        <small>Tiết ${l.slot?.period} (${l.slot?.session === 'MORNING' ? 'Sáng' : 'Chiều'})</small>
                      </div>
                      <div class="lesson-info">
                        <strong>${esc(l.subject?.name)}</strong>
                        <span>Lớp: ${esc(l.class?.name)} ${l.cell.note ? '· ' + esc(l.cell.note) : ''}</span>
                      </div>
                      <span class="lesson-tag">${esc(l.class?.name)}</span>
                    </div>
                  `).join('')
                  : '<p class="muted">Hôm nay không có tiết dạy theo thời khóa biểu đã chốt.</p>'
              }
            </div>

            <div class="card">
              <div class="card-title">
                <h2>Khung thời gian có thể dạy</h2>
                <button data-view="availability" class="primary">Đăng ký khung giờ</button>
              </div>
              <p>Khai báo các khung giờ bận/rảnh để Người xếp lịch bố trí tiết học phù hợp nhất.</p>
              <div style="margin-top:14px;background:#f8faf6;padding:14px;border-radius:8px;font-size:11px;">
                Đã đăng ký: <strong>${availabilityDoc?.availableSlotIds?.length || 0} tiết rảnh</strong> · <strong>${availabilityDoc?.busySlotIds?.length || 0} tiết bận</strong><br>
                Ghi chú: ${esc(availabilityDoc?.note || 'Không có')}
              </div>
            </div>
          </div>
        `;
      }
      if (view === 'my_teaching') return renderMyTeachingView();
      if (view === 'availability') return renderAvailabilityView();
      if (view === 'submit_request') return renderTeacherRequestSubmission();
      if (view === 'profile') return renderMyProfileView();
      return renderMyTeachingView();
    }
  };
}

// ----------------------------------------------------
// VIEW 5: Giáo viên bộ môn thường (TEACHER)
// ----------------------------------------------------
function renderRegularTeacherWorkspace() {
  const teacherMenu = [
    ['my_teaching', '◷', 'Lịch giảng dạy của tôi'],
    ['published_all', '▦', 'TKB toàn trường đã chốt'],
    ['submit_request', '✉️', 'Gửi yêu cầu điều chỉnh'],
    ['profile', '👤', 'Hồ sơ của tôi']
  ];

  return {
    menu: teacherMenu,
    content: () => {
      if (view === 'my_teaching') return renderMyTeachingView();
      if (view === 'published_all') return renderMatrixSection(displayed());
      if (view === 'submit_request') return renderTeacherRequestSubmission();
      if (view === 'profile') return renderMyProfileView();
      return renderMyTeachingView();
    }
  };
}

// ----------------------------------------------------
// Sub-view: TKB Lớp chủ nhiệm
// ----------------------------------------------------
function renderHomeroomClassTimetable(homeroomClasses) {
  if (!publishedTimetable || !publishedTimetable.isPublished) {
    return `
      <div class="card" style="text-align:center;padding:50px 20px;">
        <span style="font-size:36px;display:block;margin-bottom:12px;">📅</span>
        <h2>Chưa có thời khóa biểu đã chốt</h2>
        <p>Nhà trường hiện chưa công bố bản thời khóa biểu chính thức.</p>
      </div>
    `;
  }

  if (!homeroomClasses.length) {
    return '<div class="alert">Tài khoản của bạn chưa được Quản trị viên xác nhận lớp chủ nhiệm. Vui lòng liên hệ nhà trường.</div>';
  }

  const activeClassId = selectedHomeroomClassId || homeroomClasses[0]?.id;
  const currentClass = homeroomClasses.find(c => c.id === activeClassId) || homeroomClasses[0];
  const pData = publishedTimetable.data;
  const cellsMap = new Map((pData.timetableCells || []).filter(c => c.classId === currentClass.id).map(c => [c.timeSlotId, c]));

  let rows = '';
  for (let day = 2; day <= 6; day++) {
    const slots = (pData.timeSlots || []).filter(slot => slot.dayOfWeek === day).sort((a, b) => a.globalPeriod - b.globalPeriod);
    slots.forEach((slot, i) => {
      const cell = cellsMap.get(slot.id);
      const subject = cell ? (pData.subjects || []).find(s => s.id === cell.subjectId) : null;
      const teacherName = cell ? text(pData.teachers || [], cell.teacherId, 'fullName') : '';

      rows += `
        <tr class="${i === 0 ? 'day-start ' : ''}">
          ${i === 0 ? `<th rowspan="9" class="day-name" style="width:70px;background:#f0f4eb;">THỨ ${['', '', 'HAI', 'BA', 'TƯ', 'NĂM', 'SÁU'][day]}</th>` : ''}
          ${slot.period === 1 ? `<th rowspan="${slot.session === 'MORNING' ? 5 : 4}" class="session ${slot.session.toLowerCase()}">${slot.session === 'MORNING' ? 'SÁNG' : 'CHIỀU'}</th>` : ''}
          <th class="period">${slot.period}</th>
          <td class="time">${esc(slot.startTime)} - ${esc(slot.endTime)}</td>
          <td class="lesson ${cell ? 'filled' : 'empty'}" style="${subject ? '--subject:' + esc(subject.color) + ';' : ''}">
            <div style="padding:10px 14px;border-radius:6px;background:color-mix(in srgb,var(--subject,#666) 12%,white);text-align:left;">
              <strong style="display:block;font-size:12px;color:#184239;">${subject ? esc(subject.name) : '—'}</strong>
              <span style="font-size:11px;color:#557065;">${teacherName ? 'GV: ' + esc(teacherName) : 'Chưa xếp GV'}</span>
              ${cell?.note ? `<small style="display:block;font-size:9px;color:#859a8e;margin-top:2px;">${esc(cell.note)}</small>` : ''}
            </div>
          </td>
        </tr>
      `;
    });
  }

  return `
    <section class="matrix-panel">
      <div class="panel-toolbar" style="flex-wrap:wrap;gap:12px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <label style="font-size:11px;font-weight:700;color:#184239;">LỚP CHỦ NHIỆM:</label>
          <select id="homeroom-class-select" style="font-weight:700;">
            ${homeroomClasses.map(c => `<option value="${esc(c.id)}" ${c.id === currentClass.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
          </select>
        </div>
        <div class="toolbar-right">
          <button data-action="print" class="primary">In thời khóa biểu lớp</button>
        </div>
      </div>

      <div class="matrix-caption">
        <div>
          <span class="live-pill published">✓ BẢN CHÍNH THỨC</span>
          <h2>THỜI KHÓA BIỂU LỚP ${esc(currentClass.name)}</h2>
          <p>${esc(pData.school?.name)} · Năm học ${esc(pData.school?.year)} · ${esc(pData.school?.term)}</p>
        </div>
        <p class="matrix-help">Chế độ xem dành riêng cho giáo viên chủ nhiệm. Không có quyền sửa lịch.</p>
      </div>

      <div class="matrix-scroll">
        <table class="matrix" style="width:100%;min-width:650px;">
          <thead>
            <tr>
              <th style="width:70px;">Thứ</th>
              <th style="width:60px;">Buổi</th>
              <th style="width:45px;">Tiết</th>
              <th style="width:110px;">Thời gian</th>
              <th>Môn học & Giáo viên phụ trách</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>
  `;
}

// ----------------------------------------------------
// Sub-view: Lịch giảng dạy cá nhân (Tuần / Ngày)
// ----------------------------------------------------
function renderMyTeachingView() {
  const teacherId = currentUserProfile?.teacherId || '';
  const pData = publishedTimetable?.data || state;
  const myLessons = getTeacherLessons(teacherId, pData);
  const teacherObj = (pData.teachers || []).find(t => t.id === teacherId);

  if (!publishedTimetable || !publishedTimetable.isPublished) {
    return `
      <div class="card" style="text-align:center;padding:50px 20px;">
        <span style="font-size:36px;display:block;margin-bottom:12px;">📅</span>
        <h2>Chưa có thời khóa biểu đã chốt</h2>
        <p>Lịch giảng dạy cá nhân sẽ tự động hiển thị ngay khi Ban Giám hiệu công bố bản lịch chốt.</p>
      </div>
    `;
  }

  if (!teacherId) {
    return `
      <div class="alert">
        Tài khoản của bạn chưa được Quản trị viên gắn với hồ sơ giáo viên cụ thể trong danh mục.
        Vui lòng liên hệ Quản trị viên để được gán mã giáo viên.
      </div>
    `;
  }

  return `
    <section class="card">
      <div class="card-title">
        <div>
          <h2>Lịch giảng dạy của: ${esc(teacherObj?.fullName || currentUserProfile?.displayName)}</h2>
          <small>Mã GV: ${esc(teacherObj?.code || '—')} · Tổng số tiết trong tuần: <strong>${myLessons.length} tiết</strong></small>
        </div>
        <div style="display:flex;gap:8px;">
          <div class="tabs-nav" style="margin:0;">
            <button data-switch-personal-mode="week" class="${personalViewMode === 'week' ? 'active' : ''}">Chế độ tuần</button>
            <button data-switch-personal-mode="day" class="${personalViewMode === 'day' ? 'active' : ''}">Danh sách theo ngày</button>
          </div>
          <button data-action="print">In lịch dạy</button>
          <button data-action="csv">Xuất CSV</button>
        </div>
      </div>

      ${
        personalViewMode === 'week'
          ? renderPersonalWeeklyGrid(myLessons, pData)
          : renderPersonalDailyAgenda(myLessons)
      }
    </section>
  `;
}

function renderPersonalWeeklyGrid(myLessons, pData) {
  const lessonsMap = new Map(myLessons.map(l => [l.slot?.id, l]));

  let rows = '';
  for (let period = 1; period <= 9; period++) {
    const isMorning = period <= 5;
    const sessionPeriod = isMorning ? period : period - 5;
    const sampleSlot = (pData.timeSlots || []).find(s => s.globalPeriod === period);

    rows += `
      <tr>
        <th class="period">${sessionPeriod}</th>
        <td class="time" style="font-size:9px;">${sampleSlot?.startTime || ''}<br><span>${sampleSlot?.endTime || ''}</span></td>
        ${[2, 3, 4, 5, 6]
          .map(day => {
            const slot = (pData.timeSlots || []).find(s => s.dayOfWeek === day && s.globalPeriod === period);
            const lesson = slot ? lessonsMap.get(slot.id) : null;
            return `
            <td class="lesson ${lesson ? 'filled' : 'empty'}" style="${lesson?.subject ? '--subject:' + esc(lesson.subject.color) + ';' : ''}">
              ${
                lesson
                  ? `
                <div style="padding:6px;border-radius:4px;background:color-mix(in srgb,var(--subject,#666) 15%,white);height:100%;text-align:left;">
                  <strong style="font-size:10px;color:#184239;display:block;">${esc(lesson.subject?.name)}</strong>
                  <span style="font-size:10px;color:#2f5344;font-weight:600;">Lớp: ${esc(lesson.class?.name)}</span>
                  ${lesson.cell.note ? `<small style="font-size:8px;color:#70867a;display:block;">${esc(lesson.cell.note)}</small>` : ''}
                </div>
              `
                  : '<span style="color:#e2e8df;">—</span>'
              }
            </td>
          `;
          })
          .join('')}
      </tr>
    `;
  }

  return `
    <div class="matrix-scroll">
      <table class="matrix" style="width:100%;min-width:650px;">
        <thead>
          <tr>
            <th style="width:40px;">Tiết</th>
            <th style="width:85px;">Giờ</th>
            <th>Thứ Hai</th>
            <th>Thứ Ba</th>
            <th>Thứ Tư</th>
            <th>Thứ Năm</th>
            <th>Thứ Sáu</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderPersonalDailyAgenda(myLessons) {
  if (!myLessons.length) return '<p class="muted">Không có tiết dạy nào được xếp trong tuần.</p>';

  const days = [2, 3, 4, 5, 6];
  return `
    <div style="display:flex;flex-direction:column;gap:18px;">
      ${days
        .map(day => {
          const dayLessons = myLessons.filter(l => l.slot?.dayOfWeek === day);
          return `
          <div style="border:1px solid #e1e7dc;border-radius:10px;padding:16px;background:#fafbf9;">
            <h3 style="font-size:14px;color:#1d463b;margin:0 0 10px;padding-bottom:6px;border-bottom:1px solid #e7ede2;">
              Thứ ${['', '', 'Hai', 'Ba', 'Tư', 'Năm', 'Sáu'][day]} (${dayLessons.length} tiết)
            </h3>
            ${
              dayLessons.length
                ? dayLessons
                    .map(
                      l => `
                  <div class="lesson-card">
                    <div class="lesson-time">
                      ${esc(l.slot?.startTime)} – ${esc(l.slot?.endTime)}
                      <small>${l.slot?.session === 'MORNING' ? 'Sáng' : 'Chiều'} · Tiết ${l.slot?.period}</small>
                    </div>
                    <div class="lesson-info">
                      <strong>${esc(l.subject?.name)} · Lớp ${esc(l.class?.name)}</strong>
                      <span>${l.cell.note ? 'Ghi chú: ' + esc(l.cell.note) : 'Tiết học chuẩn'}</span>
                    </div>
                    <span class="lesson-tag">${esc(l.class?.name)}</span>
                  </div>
                `
                    )
                    .join('')
                : '<p class="muted" style="margin:6px 0;font-size:11px;">Không có tiết dạy.</p>'
            }
          </div>
        `;
        })
        .join('')}
    </div>
  `;
}

// ----------------------------------------------------
// Sub-view: Đăng ký thời gian có thể dạy (Thỉnh giảng)
// ----------------------------------------------------
function renderAvailabilityView() {
  const pData = publishedTimetable?.data || state;
  const teacherId = currentUserProfile?.teacherId || '';
  const myAssignedSlots = new Set(
    (pData.timetableCells || []).filter(c => c.teacherId === teacherId).map(c => c.timeSlotId)
  );

  const busySlots = new Set(availabilityDoc?.busySlotIds || []);
  const availableSlots = new Set(availabilityDoc?.availableSlotIds || []);

  let gridHtml = '';
  for (let period = 1; period <= 9; period++) {
    const isMorning = period <= 5;
    const sessionPeriod = isMorning ? period : period - 5;
    const sampleSlot = (pData.timeSlots || []).find(s => s.globalPeriod === period);

    gridHtml += `<div style="font-size:10px;font-weight:700;color:#5a7065;display:grid;place-items:center;">Tiết ${sessionPeriod}<br><small style="font-weight:400;">${sampleSlot?.startTime || ''}</small></div>`;

    for (let day = 2; day <= 6; day++) {
      const slot = (pData.timeSlots || []).find(s => s.dayOfWeek === day && s.globalPeriod === period);
      const isAssigned = slot && myAssignedSlots.has(slot.id);
      const isBusy = slot && busySlots.has(slot.id);
      const isAvail = slot && availableSlots.has(slot.id);

      let slotClass = '';
      let statusLabel = 'Chưa chọn';

      if (isAssigned && isBusy) {
        slotClass = 'conflict';
        statusLabel = 'Trùng lịch dạy!';
      } else if (isBusy) {
        slotClass = 'busy';
        statusLabel = 'Bận';
      } else if (isAvail) {
        slotClass = 'available';
        statusLabel = 'Rảnh';
      }

      gridHtml += `
        <div class="avail-slot ${slotClass}" data-toggle-slot="${esc(slot?.id || '')}">
          <strong>${statusLabel}</strong>
          ${isAssigned ? '<span style="display:block;font-size:8px;color:#c2410c;">(Đã có lịch dạy)</span>' : ''}
        </div>
      `;
    }
  }

  return `
    <section class="card">
      <div class="card-title">
        <h2>Đăng ký khung thời gian có thể dạy</h2>
        <button class="primary" data-action="save-availability">Lưu thời gian đăng ký</button>
      </div>
      <p class="muted">Nhấp chuột vào từng ô để chuyển trạng thái: <strong>Rảnh (Có thể dạy)</strong> → <strong>Bận (Không dạy được)</strong> → <strong>Bỏ chọn</strong>. Thông tin này làm căn cứ để Người xếp lịch bố trí thời khóa biểu.</p>

      <div style="margin:16px 0;display:grid;grid-template-columns:1fr 2fr;gap:14px;">
        <label>Khoảng ngày áp dụng
          <input id="avail-daterange" value="${esc(availabilityDoc?.dateRange?.text || 'Học kỳ 1')}" placeholder="Ví dụ: Từ 01/10 đến 31/12">
        </label>
        <label>Ghi chú cho Người xếp lịch
          <input id="avail-note" value="${esc(availabilityDoc?.note || '')}" placeholder="Ví dụ: Chỉ dạy được sáng thứ Ba và chiều thứ Năm">
        </label>
      </div>

      <div class="availability-grid">
        <div style="font-weight:700;color:#184239;text-align:center;">Tiết / Giờ</div>
        <div style="font-weight:700;color:#184239;text-align:center;">Thứ Hai</div>
        <div style="font-weight:700;color:#184239;text-align:center;">Thứ Ba</div>
        <div style="font-weight:700;color:#184239;text-align:center;">Thứ Tư</div>
        <div style="font-weight:700;color:#184239;text-align:center;">Thứ Năm</div>
        <div style="font-weight:700;color:#184239;text-align:center;">Thứ Sáu</div>
        ${gridHtml}
      </div>
    </section>
  `;
}

// ----------------------------------------------------
// Sub-view: Gửi yêu cầu điều chỉnh lịch (Giáo viên)
// ----------------------------------------------------
function renderTeacherRequestSubmission() {
  const pData = publishedTimetable?.data || state;
  const teacherId = currentUserProfile?.teacherId || '';
  const myLessons = getTeacherLessons(teacherId, pData);
  const myRequests = requestsList.filter(r => r.teacherEmail === currentUser.email);

  return `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
      <section class="card">
        <div class="card-title">
          <h2>Gửi yêu cầu điều chỉnh thời khóa biểu</h2>
        </div>
        <p class="muted">Nếu có việc đột xuất hoặc lý do chính đáng cần điều chỉnh tiết dạy, vui lòng gửi yêu cầu để Người xếp lịch xem xét.</p>

        <form id="request-adjustment-form">
          <label>Chọn tiết giảng dạy liên quan
            <select name="lessonSlot" required>
              <option value="">— Chọn tiết học —</option>
              ${myLessons
                .map(
                  l => `
                <option value="${esc(l.slot?.id)}::${esc(l.class?.id)}::${esc(l.subject?.id)}">
                  Thứ ${l.slot?.dayOfWeek} · Tiết ${l.slot?.period} (${l.slot?.session === 'MORNING' ? 'Sáng' : 'Chiều'}) · Lớp ${esc(l.class?.name)} (${esc(l.subject?.name)})
                </option>`
                )
                .join('')}
            </select>
          </label>
          <label>Lý do đề nghị đổi
            <textarea name="reason" required maxlength="500" rows="3" style="width:100%;border:1px solid #d9e1da;border-radius:7px;padding:8px;" placeholder="Lý do cụ thể..."></textarea>
          </label>
          <label>Đề xuất thời gian thay thế (nếu có)
            <input name="proposal" maxlength="500" placeholder="Ví dụ: Đổi sang tiết 3 chiều thứ Sáu...">
          </label>
          <div style="margin-top:16px;">
            <button type="submit" class="primary">Gửi yêu cầu</button>
          </div>
        </form>
      </section>

      <section class="card">
        <div class="card-title">
          <h2>Các yêu cầu đã gửi (${myRequests.length})</h2>
        </div>
        ${
          myRequests.length
            ? myRequests.map(r => {
                const statusLabels = {
                  PENDING: '<span class="req-status pending">Chờ xử lý</span>',
                  APPROVED: '<span class="req-status approved">Đã chấp thuận</span>',
                  REJECTED: '<span class="req-status rejected">Không chấp thuận</span>'
                };
                return `
                <div class="request-card">
                  <div class="req-header">
                    <strong>Yêu cầu lúc ${esc(fmt(r.createdAt))}</strong>
                    ${statusLabels[r.status] || r.status}
                  </div>
                  <div class="req-body">
                    <strong>Lý do:</strong> ${esc(r.reason)}<br>
                    <strong>Đề xuất:</strong> ${esc(r.proposal || '—')}
                  </div>
                  ${
                    r.responseNote
                      ? `
                    <div class="req-response">
                      <strong>Phản hồi từ Người xếp lịch:</strong><br>${esc(r.responseNote)}
                    </div>
                  `
                      : ''
                  }
                </div>
              `;
              }).join('')
            : '<p class="muted">Thầy/Cô chưa gửi yêu cầu điều chỉnh nào.</p>'
        }
      </section>
    </div>
  `;
}

// ----------------------------------------------------
// Sub-view: Lịch bận & Yêu cầu của GV (Dành cho Scheduler)
// ----------------------------------------------------
function renderSchedulerTeacherRequests() {
  const pendingRequests = requestsList.filter(r => r.status === 'PENDING');
  const pastRequests = requestsList.filter(r => r.status !== 'PENDING');

  return `
    <div style="display:flex;flex-direction:column;gap:20px;">
      <section class="card">
        <div class="card-title">
          <h2>Yêu cầu điều chỉnh đang chờ xử lý (${pendingRequests.length})</h2>
        </div>
        ${
          pendingRequests.length
            ? pendingRequests.map(r => {
                const slot = (workingDraft.timeSlots || []).find(s => s.id === r.timeSlotId);
                const cls = (workingDraft.classes || []).find(c => c.id === r.classId);
                const subj = (workingDraft.subjects || []).find(s => s.id === r.subjectId);
                return `
                <div class="request-card" style="border-left:4px solid #f59e0b;">
                  <div class="req-header">
                    <strong>Giáo viên: ${esc(r.teacherEmail)}</strong>
                    <span class="req-status pending">Chờ xử lý</span>
                  </div>
                  <div class="req-body">
                    Tiết học: Thứ ${slot?.dayOfWeek || ''} · Tiết ${slot?.period || ''} (${slot?.session === 'MORNING' ? 'Sáng' : 'Chiều'}) · Lớp ${esc(cls?.name || '')} (${esc(subj?.name || '')})<br>
                    <strong>Lý do:</strong> ${esc(r.reason)}<br>
                    <strong>Đề xuất:</strong> ${esc(r.proposal || 'Không có')}
                  </div>
                  <div style="margin-top:12px;display:flex;gap:8px;">
                    <button data-action="respond-request" data-id="${esc(r.id)}" data-decision="APPROVED" class="primary">Chấp thuận yêu cầu</button>
                    <button data-action="respond-request" data-id="${esc(r.id)}" data-decision="REJECTED" class="danger-link">Từ chối</button>
                  </div>
                </div>
              `;
              }).join('')
            : '<p class="muted">Không có yêu cầu điều chỉnh nào đang chờ xử lý.</p>'
        }
      </section>

      <section class="card">
        <div class="card-title">
          <h2>Lịch sử xử lý yêu cầu (${pastRequests.length})</h2>
        </div>
        ${
          pastRequests.slice(0, 10).map(r => `
            <div class="request-card" style="opacity:0.85;">
              <div class="req-header">
                <span>${esc(r.teacherEmail)} · ${esc(fmt(r.updatedAt || r.createdAt))}</span>
                <span class="req-status ${r.status.toLowerCase()}">${r.status === 'APPROVED' ? 'Đã chấp thuận' : 'Không chấp thuận'}</span>
              </div>
              <div class="req-body">
                <strong>Lý do:</strong> ${esc(r.reason)}<br>
                <strong>Phản hồi:</strong> ${esc(r.responseNote || '—')}
              </div>
            </div>
          `).join('')
        }
      </section>
    </div>
  `;
}

// ----------------------------------------------------
// Sub-view: Hồ sơ giáo viên chờ xác nhận (Admin View)
// ----------------------------------------------------
function renderPendingProfilesPage(pendingProfiles) {
  return `
    <section class="card">
      <div class="card-title">
        <h2>Hồ sơ giáo viên đăng ký chờ xác nhận (${pendingProfiles.length})</h2>
      </div>
      <p class="muted">Giáo viên đăng nhập Google và hoàn thiện hồ sơ tự khai. Quản trị viên cần xác nhận mã giáo viên chính thức, vai trò, và lớp chủ nhiệm trước khi cấp quyền truy cập.</p>

      ${
        pendingProfiles.length
          ? pendingProfiles.map(p => `
            <div class="pending-box">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                <div>
                  <strong style="font-size:14px;">${esc(p.displayName || 'Chưa đặt tên')}</strong>
                  <span style="font-size:11px;color:#61746b;display:block;">Email: <strong>${esc(p.email)}</strong></span>
                </div>
                <span class="status-pill ${p.active ? 'active' : 'inactive'}">${p.active ? 'Hoạt động' : 'Chưa kích hoạt'}</span>
              </div>

              <div class="pending-details">
                <strong>Môn giảng dạy tự khai:</strong> ${esc(p.selfDeclared?.subjects?.join(', ') || 'Chưa khai báo')}<br>
                <strong>Lớp chủ nhiệm tự khai:</strong> ${esc(p.selfDeclared?.homeroomClassId ? text(state.classes || [], p.selfDeclared.homeroomClassId) : 'Không chủ nhiệm')}<br>
                <strong>Ghi chú giáo viên:</strong> ${esc(p.selfDeclared?.note || 'Không có')}
              </div>

              <div style="display:flex;gap:8px;margin-top:10px;">
                <button data-review-profile="${esc(p.email)}" class="primary">Xác nhận hồ sơ & Cấp quyền</button>
                <button data-delete-account="${esc(p.email)}" class="danger-link">Từ chối / Xóa</button>
              </div>
            </div>
          `).join('')
          : '<div class="empty-state"><span>✓</span><h3>Không có hồ sơ nào chờ xác nhận</h3><p>Tất cả giáo viên đã được phân quyền và kích hoạt.</p></div>'
      }
    </section>
  `;
}

// ----------------------------------------------------
// Sub-view: Hồ sơ của tôi (My Profile View)
// ----------------------------------------------------
function renderMyProfileView() {
  const teacherId = currentUserProfile?.teacherId || '';
  const teacherObj = (state.teachers || []).find(t => t.id === teacherId);
  const homeroomNames = (currentUserProfile?.homeroomClassIds || []).map(id => text(state.classes || [], id)).join(', ');

  return `
    <div style="max-width:700px;margin:auto;">
      <section class="card">
        <div class="card-title">
          <h2>Thông tin hồ sơ cá nhân</h2>
          <span class="role-badge role-${currentUserProfile?.role.toLowerCase()}">${currentUserProfile?.role}</span>
        </div>

        <dl>
          <dt>Email Google:</dt><dd>${esc(currentUser?.email)}</dd>
          <dt>Họ và tên:</dt><dd>${esc(currentUserProfile?.displayName || '—')}</dd>
          <dt>Mã GV chính thức:</dt><dd>${teacherObj ? `${esc(teacherObj.fullName)} (Mã: ${esc(teacherObj.code)})` : '<span style="color:#ba6a50;">Chưa liên kết</span>'}</dd>
          <dt>Loại giáo viên:</dt><dd>${currentUserProfile?.isVisiting ? '<span style="color:#d97706;font-weight:700;">Giáo viên thỉnh giảng</span>' : 'Giáo viên cơ hữu'}</dd>
          <dt>Lớp chủ nhiệm:</dt><dd>${homeroomNames || 'Không chủ nhiệm'}</dd>
          <dt>Môn tự khai:</dt><dd>${esc(currentUserProfile?.selfDeclared?.subjects?.join(', ') || '—')}</dd>
          <dt>Trạng thái quyền:</dt><dd><span class="status-pill active">Đã xác nhận & Hoạt động</span></dd>
        </dl>

        <div style="margin-top:20px;padding-top:14px;border-top:1px solid #edf0e8;">
          <button data-action="edit-self-declared">Cập nhật môn tự khai / Ghi chú</button>
        </div>
      </section>
    </div>
  `;
}

function renderSchoolPage() {
  return `
    <section class="card">
      <div class="card-title">
        <h2>Thông tin nhà trường</h2>
        <button data-action="school" class="primary">Chỉnh sửa</button>
      </div>
      <dl>
        <dt>Tên trường:</dt><dd>${esc(state.school?.name || 'Trường THCS & THPT')}</dd>
        <dt>Năm học:</dt><dd>${esc(state.school?.year || '2026-2027')}</dd>
        <dt>Học kỳ:</dt><dd>${esc(state.school?.term || 'HK1')}</dd>
        <dt>Ngày áp dụng:</dt><dd>${esc(state.school?.appliedDate || 'Chưa đặt')}</dd>
      </dl>
    </section>
  `;
}

// ----------------------------------------------------
// Core Matrix Section (Ma trận phân công & Thời khóa biểu)
// ----------------------------------------------------
function renderMatrixSection(s) {
  const classes = (s.classes || []).filter(c => !grade || (grade === 'THCS' ? c.grade <= 9 : grade === 'THPT' ? c.grade >= 10 : String(c.grade) === grade));
  const isReadonly = !canEditWorking();
  const targetTeacherId = (brushMode === 'brush' && brushTeacherId) ? brushTeacherId : (selectedTeacherHighlight || teacher);
  const targetHighlightId = targetTeacherId;
  const targetTeacherName = targetTeacherId ? text(s.teachers || [], targetTeacherId, 'fullName') : '';

  let tableHeaderHtml = '';
  let tableBodyHtml = '';

  if (matrixViewMode === 'assignment') {
    // ----------------------------------------------------
    // Chế độ 1: Ma trận phân công (Hàng là Môn, Cột là Lớp)
    // ----------------------------------------------------
    tableHeaderHtml = `
      <tr>
        <th class="sticky-day" style="width:170px;min-width:170px;text-align:left;padding:12px 14px;">Môn học</th>
        ${classes
          .map(
            cls => `
          <th class="class-header">
            <strong>${esc(cls.name)}</strong>
            <span>${cls.grade < 10 ? 'THCS' : 'THPT'} · Khối ${cls.grade}</span>
            <div>
              <span>GVCN: ${cls.homeroomTeacherId ? esc(text(s.teachers || [], cls.homeroomTeacherId, 'fullName')) : '<em style="color:#94a69b;">Chưa có</em>'}</span>
            </div>
          </th>`
          )
          .join('')}
      </tr>
    `;

    const filteredSubjects = (s.subjects || []).filter(subj => {
      if (!query) return true;
      const q = query.toLowerCase();
      const matchSubj = (subj.name || '').toLowerCase().includes(q) || (subj.code || '').toLowerCase().includes(q);
      if (matchSubj) return true;
      // Also match if any teacher assigned in this subject matches
      return classes.some(cls => {
        const tea = getAssignedTeacher(s, cls.id, subj.id);
        return tea && (tea.fullName.toLowerCase().includes(q) || tea.code.toLowerCase().includes(q));
      });
    });

    tableBodyHtml = filteredSubjects.map(subj => {
      let cellsHtml = '';
      for (const cls of classes) {
        const assignedTeacher = getAssignedTeacher(s, cls.id, subj.id);
        const hasTarget = !!targetHighlightId;
        const isHighlighted = hasTarget && assignedTeacher && assignedTeacher.id === targetHighlightId;
        const isDimmed = hasTarget && (!assignedTeacher || assignedTeacher.id !== targetHighlightId);

        if (assignedTeacher) {
          cellsHtml += `
            <td class="lesson filled ${isHighlighted ? 'cell-highlighted' : ''} ${isDimmed ? 'cell-dimmed' : ''}" style="--subject:${esc(subj.color)};position:relative;">
              <button type="button" data-assign-cell="true" data-assign-class="${esc(cls.id)}" data-assign-subject="${esc(subj.id)}" ${isReadonly ? 'disabled' : ''} aria-label="${esc(`${cls.name}, ${subj.name}: ${assignedTeacher.fullName}`)}">
                <span class="subject-name" style="font-weight:600;font-size:9px;color:#184239;">${esc(subj.name)}</span>
                <strong class="teacher-name" style="font-size:10px;color:#184239;display:block;margin-top:2px;">${esc(assignedTeacher.fullName)}</strong>
                <span class="cell-note" style="font-size:8px;color:#677e71;display:inline-block;background:#eef3eb;padding:1px 5px;border-radius:4px;margin-top:2px;">${esc(assignedTeacher.code)}</span>
              </button>
              ${!isReadonly ? `
                <button type="button" class="cell-quick-unassign-btn" data-action="popover-unassign" data-class="${esc(cls.id)}" data-subject="${esc(subj.id)}" title="Xóa phân công: ${esc(assignedTeacher.fullName)}" aria-label="Xóa phân công">✕</button>
              ` : ''}
            </td>
          `;
        } else {
          cellsHtml += `
            <td class="lesson empty ${hasTarget ? 'cell-dimmed' : ''}">
              <button type="button" data-assign-cell="true" data-assign-class="${esc(cls.id)}" data-assign-subject="${esc(subj.id)}" ${isReadonly ? 'disabled' : ''} aria-label="${esc(`${cls.name}, ${subj.name}: Chưa phân công`)}" title="Click để chọn giáo viên">
                <span class="empty-mark">＋</span>
              </button>
            </td>
          `;
        }
      }

      return `
        <tr>
          <th class="sticky-day" style="text-align:left;padding:10px 14px;background:#f6faf4;position:sticky;left:0;z-index:6;border-right:1px solid #dce3d6;border-bottom:1px solid #dce3d6;">
            <div style="display:flex;align-items:center;gap:7px;">
              <i class="subject-dot" style="background:${esc(subj.color)};width:9px;height:9px;border-radius:3px;"></i>
              <div>
                <strong style="font-size:11px;color:#1c443b;display:block;">${esc(subj.name)}</strong>
                <small style="color:#788c80;font-size:8px;">${esc(subj.code)}</small>
              </div>
            </div>
          </th>
          ${cellsHtml}
        </tr>
      `;
    }).join('');

  } else {
    // ----------------------------------------------------
    // Chế độ 2: Thời khóa biểu toàn trường (Tiết - Lớp)
    // ----------------------------------------------------
    tableHeaderHtml = `
      <tr>
        <th class="sticky-day">Thứ</th>
        <th class="sticky-session">Buổi</th>
        <th class="sticky-period">Tiết</th>
        <th class="sticky-time">Thời gian</th>
        ${classes
          .map(
            cls => `
          <th class="class-header">
            <strong>${esc(cls.name)}</strong>
            <span>${cls.grade < 10 ? 'THCS' : 'THPT'} · Khối ${cls.grade}</span>
            <div>
              <span>GVCN: ${cls.homeroomTeacherId ? esc(text(s.teachers || [], cls.homeroomTeacherId, 'fullName')) : '<em style="color:#94a69b;">Chưa có</em>'}</span>
            </div>
          </th>`
          )
          .join('')}
      </tr>
    `;

    const index = new Map((s.timetableCells || []).map(c => [keyOf(c.classId, c.timeSlotId), c]));
    const conflictIds = new Set(findConflicts(s).flat().map(c => c.id));

    let rows = '';
    for (let day = 2; day <= 6; day++) {
      const slots = (s.timeSlots || []).filter(slot => slot.dayOfWeek === day).sort((a, b) => a.globalPeriod - b.globalPeriod);
      slots.forEach((slot, i) => {
        rows += `<tr class="${i === 0 ? 'day-start ' : ''}${slot.period === 1 && slot.session === 'AFTERNOON' ? 'afternoon-start' : ''}">${
          i === 0 ? `<th rowspan="9" class="sticky-day day-name">THỨ ${['', '', 'HAI', 'BA', 'TƯ', 'NĂM', 'SÁU'][day]}</th>` : ''
        }${slot.period === 1 ? `<th rowspan="${slot.session === 'MORNING' ? 5 : 4}" class="sticky-session session ${slot.session.toLowerCase()}">${slot.session === 'MORNING' ? 'SÁNG' : 'CHIỀU'}</th>` : ''}<th class="sticky-period period">${slot.period}</th><td class="sticky-time time">${esc(slot.startTime)}<br><span>${esc(slot.endTime)}</span></td>`;
        for (const cls of classes) {
          const cell = index.get(keyOf(cls.id, slot.id));
          const subject = cell ? s.subjects?.find(x => x.id === cell.subjectId) : null;
          const teacherText = cell ? text(s.teachers || [], cell.teacherId, 'fullName') : '';
          const hasTarget = !!targetHighlightId;
          const isHighlighted = hasTarget && cell?.teacherId === targetHighlightId;
          const isDimmed = hasTarget && (!cell || cell.teacherId !== targetHighlightId);
          const matchQuery = !query || `${subject?.name || ''} ${teacherText} ${cls.name}`.toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi'));

          rows += `<td class="lesson ${cell ? 'filled' : 'empty'} ${isHighlighted ? 'cell-highlighted' : ''} ${isDimmed || !matchQuery ? 'cell-dimmed' : ''} ${cell && conflictIds.has(cell.id) ? 'conflict' : ''}" style="${subject ? '--subject:' + esc(subject.color) + ';' : ''}">
            <button data-cell-class="${esc(cls.id)}" data-cell-slot="${esc(slot.id)}" aria-label="${esc(`${cls.name}, thứ ${day}, ${slot.session === 'MORNING' ? 'sáng' : 'chiều'} tiết ${slot.period}${subject ? ', ' + subject.name : ''}`)}" ${isReadonly ? 'disabled' : ''}>
              ${cell ? `<span class="subject-name">${esc(subject?.name)} ${cell.locked ? '<span class="lock" title="Đã khóa">▣</span>' : ''}</span><span class="teacher-name">${cell.teacherId ? esc(teacherText) : 'Chưa chọn giáo viên'}</span>${cell.note ? `<span class="cell-note" title="${esc(cell.note)}">${esc(cell.note)}</span>` : ''}` : '<span class="empty-mark">＋</span>'}
            </button>
          </td>`;
        }
        rows += '</tr>';
      });
    }
    tableBodyHtml = rows;
  }

  return `
    <section class="matrix-panel ${brushMode !== 'none' ? 'brush-active' : ''}">
      <div class="panel-toolbar">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <div class="segmented">
            <button data-set-matrix-mode="assignment" class="${matrixViewMode === 'assignment' ? 'selected' : ''}">📋 Ma trận phân công (Môn - Lớp)</button>
            <button data-set-matrix-mode="timetable" class="${matrixViewMode === 'timetable' ? 'selected' : ''}">▦ Lịch tiết học (Tiết - Lớp)</button>
          </div>
          <div class="segmented">
            ${
              canEditWorking()
                ? `
              <button data-action="draft" class="${!showPublished ? 'selected' : ''}">Bản đang xếp</button>
              <button data-action="published" class="${showPublished ? 'selected' : ''}" ${!publishedTimetable?.isPublished ? 'disabled' : ''}>
                Bản đã chốt ${publishedTimetable?.isPublished ? '✓' : ''}
              </button>
            `
                : `
              <button class="selected" disabled>Bản công bố chính thức ✓</button>
            `
            }
          </div>
        </div>
        <div class="toolbar-right">
          <label class="sr-only" for="teacher-filter">Lọc giáo viên</label>
          <select id="teacher-filter">${selectOptions(s.teachers || [], teacher, 'fullName', 'Tất cả giáo viên')}</select>
          <label class="search"><span>⌕</span><input id="search" placeholder="Tìm môn, giáo viên, lớp…" value="${esc(query)}" aria-label="Tìm trong ma trận"></label>
          <button data-action="density" class="icon-button" title="Đổi độ rộng cột">${compact ? '↔' : '↦↤'}</button>
          <button data-action="fullscreen" class="icon-button" title="Toàn màn hình">⛶</button>
        </div>
      </div>

      <!-- Thanh công cụ Cọ gán nhanh (Quick Stamp / Brush Tool) -->
      ${canEditWorking() ? `
        <div class="brush-toolbar">
          <span class="brush-title">🖌️ Cọ gán nhanh:</span>
          <select id="brush-teacher-select" class="brush-select">
            <option value="">— Chọn giáo viên để làm cọ —</option>
            ${(s.teachers || []).map(t => `<option value="${esc(t.id)}" ${brushTeacherId === t.id && brushMode === 'brush' ? 'selected' : ''}>${esc(t.code)} · ${esc(t.fullName)} (${t.assignments?.length || 0} phân công)</option>`).join('')}
          </select>
          <button type="button" data-action="brush-eraser" class="brush-btn ${brushMode === 'eraser' ? 'eraser-active' : ''}" title="Bật tẩy để xóa nhanh khi click">🧼 Tẩy / Bỏ gán</button>
          <button type="button" data-action="brush-off" class="brush-btn" ${brushMode === 'none' && !brushTeacherId && !selectedTeacherHighlight ? 'disabled' : ''} title="Tắt chế độ cọ">✕ Tắt cọ</button>

          ${brushMode === 'brush' && brushTeacherId ? `<span class="brush-status-badge"><span>🖌️</span> Đang cầm cọ: <strong>${esc(text(s.teachers || [], brushTeacherId, 'fullName'))}</strong> (Click liên tiếp vào các ô để gán ngay)</span>` : ''}
          ${brushMode === 'eraser' ? `<span class="brush-status-badge eraser"><span>🧼</span> Đang bật Tẩy (Click vào ô để xóa phân công)</span>` : ''}
          ${selectedTeacherHighlight && brushMode === 'none' ? `<span class="brush-status-badge"><span>🔍</span> Rọi sáng: <strong>${esc(text(s.teachers || [], selectedTeacherHighlight, 'fullName'))}</strong> <button data-action="clear-highlight" style="background:none;border:none;padding:0;cursor:pointer;margin-left:5px;font-size:12px;color:#184239;" title="Tắt rọi sáng">✕</button></span>` : ''}
        </div>
      ` : ''}

      <div class="grade-toolbar">
        <span>Cột lớp</span>
        ${['', 'THCS', 'THPT', '6', '7', '8', '9', '10', '11', '12']
          .map(g => `<button data-grade="${g}" class="${grade === g ? 'selected' : ''}">${g ? (g === 'THCS' || g === 'THPT' ? g : 'Khối ' + g) : 'Toàn trường'}</button>`)
          .join('')}
        <span class="class-count">${classes.length} lớp</span>
      </div>

      <div class="matrix-caption">
        <div>
          <span class="live-pill ${isReadonly ? 'published' : ''}">${isReadonly ? '✓ ĐÃ CHỐT' : '● BẢN ĐANG XẾP'}</span>
          <h2>${matrixViewMode === 'assignment' ? 'MA TRẬN PHÂN CÔNG CHUYÊN MÔN (MÔN — LỚP)' : 'THỜI KHÓA BIỂU TOÀN TRƯỜNG'}</h2>
          <p>${esc(s.school?.name || '')} · ${esc(s.school?.year || '')} · ${esc(s.school?.term || '')}${s.school?.appliedDate ? ' · Áp dụng ' + esc(s.school.appliedDate) : ''}</p>
        </div>
        <p class="matrix-help">${
          brushMode === 'brush'
            ? `🖌️ Chế độ Cọ vẽ: Click bất kỳ ô nào để gán ngay cho ${esc(targetTeacherName)}.`
            : brushMode === 'eraser'
            ? '🧼 Chế độ Tẩy: Click bất kỳ ô nào để xóa phân công ngay lập tức.'
            : targetTeacherId
            ? `Đang rọi sáng phân công của: ${esc(targetTeacherName)}`
            : isReadonly
            ? 'Chế độ xem chỉ đọc bản lịch đã chốt.'
            : 'Nhấp một ô để mở danh sách chọn giáo viên (Popover Click) hoặc dùng Cọ vẽ để gán nhanh.'
        }</p>
      </div>

      <div class="matrix-scroll" id="matrix-scroll-container" tabindex="0" role="region" aria-label="Ma trận thời khóa biểu">
        <table class="matrix ${compact ? 'compact' : ''}">
          <thead>${tableHeaderHtml}</thead>
          <tbody>${tableBodyHtml}</tbody>
        </table>
      </div>

      <div class="matrix-bottom">
        <span><i></i> ${matrixViewMode === 'assignment' ? 'Ma trận gán trực tiếp giáo viên dạy theo môn & lớp' : 'Môn học & giáo viên trong từng tiết học'}</span>
        <span>${isReadonly ? 'Chế độ xem chỉ đọc' : 'Đồng bộ Cloud tự động'} · 2 chế độ: Popover chọn nhanh & Cọ vẽ liên tiếp</span>
      </div>
    </section>

    <!-- Floating Cursor Tooltip for Brush -->
    <div id="brush-cursor-indicator" class="brush-cursor-indicator" style="display:none;"></div>
  `;
}

// ----------------------------------------------------
// Preserved Catalog (Với GVCN cho Lớp & Phân công cho GV)
// ----------------------------------------------------
function catalog() {
  if (!isSchedulerRole()) return '<div class="alert">Bạn không có quyền chỉnh sửa danh mục.</div>';
  return `
    <div class="notice">
      Danh mục nhà trường liên kết trực tiếp 2 chiều với ma trận: gán giáo viên trên ma trận sẽ tự động cập nhật số lớp phụ trách của giáo viên đó. Nhấp vào thẻ giáo viên để rọi sáng trên ma trận.
    </div>
    <div class="catalog-grid">
      ${[['classes', 'Lớp học'], ['subjects', 'Môn học'], ['teachers', 'Giáo viên']]
        .map(
          ([kind, label]) => `
        <section class="card">
          <div class="card-title">
            <h2>${label} <small>${state[kind]?.length || 0}</small></h2>
            <div class="catalog-actions-group">
              ${
                kind === 'teachers'
                  ? `
                <button type="button" class="excel-btn template-btn" data-action="download-teacher-template" title="Tải file mẫu Excel (.xlsx) với các cột chuẩn">
                  ↓ File mẫu
                </button>
                <button type="button" class="excel-btn import-btn" data-action="import-teachers-excel" title="Tải lên danh sách giáo viên từ file Excel (.xlsx, .xls) hoặc CSV">
                  ↑ Nhập Excel
                </button>
              `
                  : ''
              }
              <button data-add="${kind}" class="primary">＋ Thêm</button>
            </div>
          </div>
          ${
            kind === 'teachers'
              ? `
            <div class="teacher-import-hint">
              💡 <strong>Tải danh sách GV:</strong> Nhấp <code>↑ Nhập Excel</code> để tải file <code>.xlsx</code>, <code>.xls</code> hoặc <code>.csv</code>. Cột chuẩn: Họ và tên, Mã GV, SĐT, Email, Ghi chú.
            </div>
          `
              : ''
          }
          ${
            state[kind]?.length
              ? `
            <div class="catalog-list">
              ${state[kind]
                .map(item => {
                  if (kind === 'classes') {
                    const hrTeacher = item.homeroomTeacherId ? (state.teachers || []).find(t => t.id === item.homeroomTeacherId) : null;
                    return `
                      <div class="catalog-row">
                        <div>
                          <strong>${esc(item.name)}</strong>
                          <small>${esc(item.code)} · Khối ${item.grade}</small>
                          <div class="catalog-subinfo">GVCN: ${hrTeacher ? esc(hrTeacher.fullName) : '<span class="text-muted">Chưa có GVCN</span>'}</div>
                        </div>
                        <button data-edit="classes" data-id="${esc(item.id)}" aria-label="Sửa ${esc(item.name)}">Sửa</button>
                        <button data-delete="classes" data-id="${esc(item.id)}" class="danger-link" aria-label="Xóa ${esc(item.name)}">×</button>
                      </div>
                    `;
                  }
                  if (kind === 'teachers') {
                    const hrClasses = (state.classes || []).filter(c => c.homeroomTeacherId === item.id);
                    const assignCount = Array.isArray(item.assignments) ? item.assignments.length : 0;
                    const isHighlighted = selectedTeacherHighlight === item.id || (brushMode === 'brush' && brushTeacherId === item.id);
                    return `
                      <div class="catalog-row catalog-teacher-card ${isHighlighted ? 'selected' : ''}" data-select-teacher="${esc(item.id)}" title="Nhấp để rọi sáng và dùng cọ gán cho giáo viên này trên ma trận">
                        <div>
                          <strong>${esc(item.fullName)}</strong>
                          <small>${esc(item.code)}</small>
                          <div class="catalog-subinfo">
                            ${hrClasses.length ? `Chủ nhiệm: <strong>${hrClasses.map(c => esc(c.name)).join(', ')}</strong>` : '<span class="text-muted">Chưa có lớp chủ nhiệm</span>'} · <strong>${assignCount}</strong> môn/lớp phụ trách
                          </div>
                        </div>
                        <button data-edit="teachers" data-id="${esc(item.id)}" aria-label="Sửa ${esc(item.fullName)}">Sửa</button>
                        <button data-delete="teachers" data-id="${esc(item.id)}" class="danger-link" aria-label="Xóa ${esc(item.fullName)}">×</button>
                      </div>
                    `;
                  }
                  return `
                    <div class="catalog-row">
                      <div>
                        <i class="subject-dot" style="background:${esc(item.color)}"></i>
                        <strong>${esc(item.name)}</strong>
                        <small>${esc(item.code)}</small>
                      </div>
                      <button data-edit="subjects" data-id="${esc(item.id)}" aria-label="Sửa ${esc(item.name)}">Sửa</button>
                      <button data-delete="subjects" data-id="${esc(item.id)}" class="danger-link" aria-label="Xóa ${esc(item.name)}">×</button>
                    </div>
                  `;
                })
                .join('')}
            </div>
          `
              : '<div class="empty-state"><span>♙</span><h3>Danh mục trống</h3><p>Thêm mục mới để bắt đầu sử dụng.</p></div>'
          }
        </section>`
        )
        .join('')}
    </div>
  `;
}

function conflictPage() {
  const groups = findConflicts(workingDraft);
  return `
    <section class="card">
      <div class="card-title">
        <h2>${groups.length ? 'Cần kiểm tra ' + groups.length + ' khung giờ' : 'Không có lịch trùng giáo viên'}</h2>
        <button data-action="go-matrix">Mở ma trận</button>
      </div>
      <p class="muted">Kiểm tra giáo viên dạy nhiều lớp trong cùng một tiết trên bản nháp. Các ô chưa chọn giáo viên chưa thể kiểm tra trùng.</p>
      ${groups
        .map(group => {
          const slot = (workingDraft.timeSlots || []).find(s => s.id === group[0].timeSlotId);
          return `
          <div class="conflict-row">
            <span class="warning-icon">!</span>
            <div>
              <strong>${esc(nameOfTeacher(group[0].teacherId))}</strong>
              <p>Thứ ${slot?.dayOfWeek || ''} · ${slot?.session === 'MORNING' ? 'Sáng' : 'Chiều'} tiết ${slot?.period || ''} · ${esc(slot?.startTime || '')}</p>
            </div>
            <div class="conflict-links">
              ${group
                .map(
                  cell => `
                <button data-cell-class="${esc(cell.classId)}" data-cell-slot="${esc(cell.timeSlotId)}">
                  ${esc(text(workingDraft.classes || [], cell.classId))} · ${esc(text(workingDraft.subjects || [], cell.subjectId))} ↗
                </button>`
                )
                .join('')}
            </div>
          </div>`;
        })
        .join('')}
      ${!groups.length ? '<div class="empty-state"><span class="success-icon">✓</span><h3>Lịch hiện tại không trùng giáo viên</h3><p>Hợp lệ để chốt lịch.</p></div>' : ''}
    </section>
  `;
}

function versionsPage() {
  if (!isSchedulerRole()) return '<div class="alert">Bạn không có quyền quản lý phiên bản.</div>';
  return `
    <section class="card">
      <div class="card-title">
        <h2>Bản đã chốt trên Cloud</h2>
        <button class="primary" data-action="publish">Chốt bản đang xếp</button>
      </div>
      ${
        publishedTimetable?.isPublished
          ? `
        <div class="published-card">
          <div>
            <span class="live-pill published">✓ ĐÃ CHỐT</span>
            <h3>${esc(publishedTimetable.name || 'Bản đã chốt')}</h3>
            <p>${esc(fmt(publishedTimetable.publishedAt))} · Bởi: ${esc(publishedTimetable.publishedBy || '')} · ${publishedTimetable.data?.timetableCells?.length || 0} ô</p>
          </div>
          <div>
            <button data-action="view-published">Xem ma trận</button>
            <button data-action="restore-published">Khôi phục về bản đang xếp</button>
            <button class="danger-link" data-action="unpublish">Gỡ bản đã chốt</button>
          </div>
        </div>
      `
          : '<p class="muted">Chưa có bản đã chốt. Sau khi kiểm tra lịch, chốt một bản để toàn trường và giáo viên xem trực tuyến.</p>'
      }
    </section>

    <section class="card">
      <div class="card-title">
        <h2>Các phiên bản đã lưu (Cloud)</h2>
        <button data-action="save-version">＋ Lưu phiên bản</button>
      </div>
      ${
        workingDraft.versions?.length
          ? workingDraft.versions
              .map(
                v => `
            <div class="version-row">
              <div>
                <strong>${esc(v.name)}</strong>
                <p>${esc(fmt(v.createdAt))} · ${v.data?.timetableCells?.length || 0} ô lịch</p>
              </div>
              <button data-restore="${esc(v.id)}">Khôi phục</button>
              <button data-remove-version="${esc(v.id)}" class="danger-link">Xóa</button>
            </div>
          `
              )
              .join('')
          : '<div class="empty-state"><span>▱</span><h3>Chưa có phiên bản</h3><p>Lưu một phiên bản trước các đợt chỉnh sửa lớn.</p></div>'
      }
    </section>
  `;
}

function accountsPage() {
  if (!isAdmin()) return '<div class="alert">Chỉ Quản trị viên mới được quản lý tài khoản.</div>';

  const roleBadges = {
    OWNER: '<span class="role-badge role-owner">OWNER</span>',
    ADMIN: '<span class="role-badge role-admin">ADMIN</span>',
    SCHEDULER: '<span class="role-badge role-scheduler">SCHEDULER</span>',
    TEACHER: '<span class="role-badge role-teacher">TEACHER</span>'
  };

  return `
    <section class="card">
      <div class="card-title">
        <h2>Danh sách tài khoản & Phân quyền (${accountsList.length})</h2>
        <button class="primary" data-action="add-account">＋ Thêm tài khoản Google</button>
      </div>
      <p class="muted">Cấp quyền dựa trên địa chỉ email Google. Người dùng chỉ cần đăng nhập Google bằng email này là nhận đúng quyền.</p>

      <table class="accounts-table">
        <thead>
          <tr>
            <th>Email</th>
            <th>Tên hiển thị</th>
            <th>Vai trò</th>
            <th>Loại GV</th>
            <th>GV liên kết</th>
            <th>Trạng thái</th>
            <th style="text-align:right">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          ${accountsList
            .map(acc => {
              const teacherObj = (workingDraft.teachers || []).find(t => t.id === acc.teacherId);
              const isAccOwner = acc.email === OWNER_EMAIL || acc.role === 'OWNER';
              const canEditThis = isOwner() || (!isAccOwner && acc.email !== currentUser.email);

              return `
              <tr>
                <td><strong>${esc(acc.email)}</strong></td>
                <td>${esc(acc.displayName || '—')}</td>
                <td>${roleBadges[acc.role] || acc.role}</td>
                <td>${acc.isVisiting ? '<span style="color:#d97706;font-weight:600;">Thỉnh giảng</span>' : '<span style="color:#527063;">Cơ hữu</span>'}</td>
                <td>${teacherObj ? `${esc(teacherObj.fullName)} (${esc(teacherObj.code)})` : '<span style="color:#a1aead;">Chưa gán</span>'}</td>
                <td><span class="status-pill ${acc.active ? 'active' : 'inactive'}">${acc.active ? 'Hoạt động' : 'Tạm khóa'}</span></td>
                <td style="text-align:right">
                  <div class="action-group" style="justify-content:flex-end;">
                    ${canEditThis ? `<button data-edit-account="${esc(acc.email)}">Sửa quyền</button>` : '<span style="font-size:10px;color:#9aa7a0;">Bảo vệ</span>'}
                    ${isOwner() && !isAccOwner ? `<button data-delete-account="${esc(acc.email)}" class="danger-link">Xóa</button>` : ''}
                  </div>
                </td>
              </tr>
            `;
            })
            .join('')}
        </tbody>
      </table>
    </section>
  `;
}

function settings() {
  return `
    <div class="settings-grid">
      <section class="card">
        <h2>Thông tin nhà trường</h2>
        <dl>
          <dt>Trường</dt><dd>${esc(state.school?.name || 'Chưa đặt')}</dd>
          <dt>Năm học</dt><dd>${esc(state.school?.year || '2026-2027')}</dd>
          <dt>Học kỳ</dt><dd>${esc(state.school?.term || 'HK1')}</dd>
          <dt>Áp dụng từ</dt><dd>${esc(state.school?.appliedDate || 'Chưa đặt')}</dd>
        </dl>
        ${isSchedulerRole() ? '<button data-action="school">Chỉnh sửa</button>' : ''}
      </section>

      <section class="card">
        <h2>Sao lưu & Chuyển dữ liệu</h2>
        <p>Hệ thống tự động đồng bộ lên Cloud Firestore. Bạn có thể xuất bản sao lưu JSON để lưu trữ hoặc chuyển đổi máy.</p>
        <div class="button-row">
          <button class="primary" data-action="backup">↓ Tải bản sao lưu JSON</button>
          ${isSchedulerRole() ? '<button data-action="import">↑ Nhập JSON mới / app cũ</button>' : ''}
          <button data-action="csv">Xuất ma trận CSV</button>
        </div>
      </section>
    </div>
  `;
}

// ----------------------------------------------------
// Main Master Render Dispatcher
// ----------------------------------------------------
function render() {
  // 1. Loading
  if (authLoading) {
    app.innerHTML = `
      <div class="auth-overlay">
        <div class="login-card">
          <span class="brand-icon">▦</span>
          <h1>Đang khởi động hệ thống</h1>
          <p>Đang kiểm tra kết nối dịch vụ nhà trường...</p>
        </div>
      </div>
    `;
    return;
  }

  // 2. Unauthenticated
  if (!currentUser) {
    app.innerHTML = `
      <div class="auth-overlay">
        <div class="login-card">
          <div class="brand-icon">▦</div>
          <h1>Thời khóa biểu toàn trường</h1>
          <p>Hệ thống xếp lịch và công bố thời khóa biểu trực tuyến dành cho nhà trường.</p>

          <div style="display:flex;gap:10px;margin-bottom:20px;">
            <button class="google-btn ${loginIntent === 'admin' ? 'primary' : ''}" data-login-as="admin" style="font-size:12px;padding:12px 10px;">
              <span>🔑 Đăng nhập Quản trị viên</span>
            </button>
            <button class="google-btn ${loginIntent === 'teacher' ? 'primary' : ''}" data-login-as="teacher" style="font-size:12px;padding:12px 10px;">
              <span>👨‍🏫 Đăng nhập Giáo viên</span>
            </button>
          </div>

          ${authError ? `<div class="alert" style="margin-bottom:18px;">${esc(authError)}</div>` : ''}

          <button class="google-btn" data-action="login">
            <span class="google-icon">G</span>
            <span>Tiếp tục với Google (${loginIntent === 'admin' ? 'Quản trị viên' : 'Giáo viên'})</span>
          </button>

          <div class="login-help" style="margin-top:16px;">
            <strong style="color:#1d463b;display:block;margin-bottom:4px;">Thông tin đăng nhập</strong>
            Vui lòng sử dụng tài khoản Google đã được nhà trường cấp quyền. Nếu chưa truy cập được, hãy liên hệ quản trị viên để được hỗ trợ.
          </div>
        </div>
      </div>
    `;
    return;
  }

  // 3. User logged in but no profile exists in database -> Onboarding Flow
  if (!currentUserProfile) {
    app.innerHTML = `
      <div class="auth-overlay">
        <div class="login-card" style="max-width:520px;text-align:left;">
          <h2 style="color:#184239;margin:0 0 6px;">Hoàn thiện hồ sơ giáo viên</h2>
          <p style="margin-bottom:18px;">Chào mừng <strong>${esc(currentUser.email)}</strong>! Vui lòng khai báo thông tin ban đầu để Quản trị viên nhà trường xác nhận và phân quyền.</p>

          <form id="onboarding-form">
            <label>Họ và tên giáo viên
              <input name="displayName" required value="${esc(currentUser.displayName || '')}" placeholder="Nguyễn Văn An">
            </label>

            <label>Môn giảng dạy (Chọn một hoặc nhiều môn)
              <select name="subjects" multiple size="4" style="height:90px;" required>
                ${(SEED.subjects || []).map(s => `<option value="${esc(s.name)}">${esc(s.name)} (${esc(s.code)})</option>`).join('')}
              </select>
            </label>

            <label>Lớp chủ nhiệm (Tự khai báo)
              <select name="homeroomClassId">
                <option value="">— Không chủ nhiệm —</option>
                ${(SEED.classes || []).map(c => `<option value="${esc(c.id)}">Lớp ${esc(c.name)}</option>`).join('')}
              </select>
            </label>

            <label>Ghi chú thêm (Ví dụ: Giáo viên thỉnh giảng, số điện thoại...)
              <input name="note" maxlength="300" placeholder="Thông tin liên hệ, nguyện vọng xếp lịch...">
            </label>

            <div style="margin-top:20px;display:flex;gap:10px;justify-content:flex-end;">
              <button type="button" data-action="logout">Đăng xuất</button>
              <button type="submit" class="primary">Gửi hồ sơ cho Quản trị viên</button>
            </div>
          </form>
        </div>
      </div>
    `;
    return;
  }

  // 4. User profile exists but active == false -> Waiting screen
  if (currentUserProfile.active !== true) {
    app.innerHTML = `
      <div class="auth-overlay">
        <div class="unauth-card">
          <span class="warning-badge">HỒ SƠ ĐANG CHỜ XÁC NHẬN</span>
          <h2>Hồ sơ đã được tiếp nhận</h2>
          <p>Hồ sơ của tài khoản <strong>${esc(currentUser.email)}</strong> đang chờ Ban Giám hiệu / Quản trị viên xác nhận mã giáo viên và kích hoạt quyền truy cập.</p>
          <div style="background:#f6f9f4;padding:12px;border-radius:8px;font-size:11px;text-align:left;margin:16px 0;">
            Môn khai báo: <strong>${esc(currentUserProfile.selfDeclared?.subjects?.join(', ') || 'Chưa chọn')}</strong><br>
            Lớp chủ nhiệm khai báo: <strong>${esc(currentUserProfile.selfDeclared?.homeroomClassId ? text(SEED.classes, currentUserProfile.selfDeclared.homeroomClassId) : 'Không chủ nhiệm')}</strong>
          </div>
          <p style="font-size:11px;color:#85968e;">Vui lòng liên hệ Quản trị viên để được hỗ trợ kích hoạt.</p>
          <div style="margin-top:20px;display:flex;gap:10px;justify-content:center;">
            <button data-action="logout">Đăng xuất</button>
            <button class="primary" data-action="login">Đổi tài khoản khác</button>
          </div>
        </div>
      </div>
    `;
    return;
  }

  // 5. Active workspace rendering
  let workspaceData;
  if (currentWorkspace === 'ADMIN') workspaceData = renderAdminWorkspace();
  else if (currentWorkspace === 'SCHEDULER') workspaceData = renderSchedulerWorkspace();
  else if (currentWorkspace === 'HOMEROOM') workspaceData = renderHomeroomWorkspace();
  else if (currentWorkspace === 'VISITING') workspaceData = renderVisitingWorkspace();
  else workspaceData = renderRegularTeacherWorkspace();

  const availableWs = getAvailableWorkspaces();
  const roleNames = {
    OWNER: 'Quản trị chính',
    ADMIN: 'Quản trị viên',
    SCHEDULER: 'Người xếp lịch',
    TEACHER: 'Giáo viên'
  };

  app.innerHTML = `
    <aside class="sidebar">
      <a class="brand" href="#"><span class="brand-icon">▦</span><span>TKB<span class="brand-sub">SỔ LỊCH NHÀ TRƯỜNG</span></span></a>
      <div class="sidebar-label">KHÔNG GIAN LÀM VIỆC</div>
      <nav>
        ${workspaceData.menu
          .map(
            ([id, icon, name]) =>
              `<button data-view="${id}" class="nav-button ${view === id ? 'active' : ''}"><span>${icon}</span>${name}</button>`
          )
          .join('')}
      </nav>
      <div class="sidebar-bottom">
        <span class="status-dot"></span> Cloud Đồng bộ<p>Vai trò: <strong>${roleNames[currentUserProfile.role] || currentUserProfile.role}</strong></p>
        <button data-action="backup" class="sidebar-backup">↓ Tải sao lưu JSON</button>
      </div>
    </aside>

    <div class="workspace">
      <header class="topbar">
        <span>${esc(state.school?.name || 'Trường THCS & THPT')}</span>
        <div>
          <span class="year">${esc(state.school?.year || '2026-2027')} · ${esc(state.school?.term || 'HK1')}</span>

          ${
            availableWs.length > 1
              ? `
            <div class="workspace-switcher">
              <span>🔄 Không gian:</span>
              <select id="workspace-select">
                ${availableWs.map(w => `<option value="${w.id}" ${w.id === currentWorkspace ? 'selected' : ''}>${w.label}</option>`).join('')}
              </select>
            </div>
          `
              : ''
          }

          <div id="sync-indicator" class="sync-status ${syncStatus}">
            <span class="sync-dot ${syncStatus}"></span>
            <span>${esc(syncMessage)}</span>
          </div>

          <div class="user-topbar-profile">
            <div class="user-email-tag">
              <span class="user-email-text">${esc(currentUserProfile.displayName || currentUser.email)}</span>
              <span class="role-badge role-${currentUserProfile.role.toLowerCase()}">${roleNames[currentUserProfile.role] || currentUserProfile.role}</span>
            </div>
            <button data-action="logout" class="icon-button" title="Đăng xuất" aria-label="Đăng xuất">⇥</button>
          </div>
        </div>
      </header>

      <main>
        <div class="page-heading">
          <div>
            <div class="eyebrow">LẬP LỊCH • ${esc(state.school?.term || 'HK1')}</div>
            <h1>${titles[view] || view}</h1>
            <p>${
              currentWorkspace === 'ADMIN'
                ? 'Giao diện quản trị toàn diện: quản lý tài khoản, danh mục và cấu hình trường.'
                : currentWorkspace === 'SCHEDULER'
                ? 'Không gian xếp lịch: ma trận toàn trường trực quan, bảo đảm không trùng lịch.'
                : currentWorkspace === 'HOMEROOM'
                ? 'Không gian giáo viên chủ nhiệm: theo dõi lịch học của lớp và lịch giảng dạy cá nhân.'
                : currentWorkspace === 'VISITING'
                ? 'Không gian giáo viên thỉnh giảng: đăng ký khung giờ rảnh và xem lịch dạy.'
                : 'Lịch giảng dạy cá nhân và thời khóa biểu toàn trường.'
            }</p>
          </div>
          <div class="heading-actions">
            <button data-action="print">In / PDF</button>
            <button data-action="csv">Xuất CSV</button>
            ${canEditWorking() ? '<button class="primary" data-action="save-version">＋ Lưu phiên bản</button>' : ''}
          </div>
        </div>

        <div id="content">
          ${workspaceData.content()}
        </div>

        <footer>
          <span>TKB • Bản nâng cấp 4 Không gian làm việc</span>
          <span>Đang đăng nhập: <strong>${esc(currentUser.email)}</strong> · <button data-action="backup">Sao lưu</button></span>
        </footer>
      </main>
    </div>
  `;
}

// ----------------------------------------------------
// Dialog Openers & Editors
// ----------------------------------------------------
function openDialog(html) {
  dialog.innerHTML = html;
  if (!dialog.open) dialog.showModal();
}
const closeButton = '<button type="button" data-action="close" class="icon-button" aria-label="Đóng">×</button>';

function openAssignmentPopover({ classId, subjectId, anchorElement }) {
  closePopover();
  const cls = (workingDraft.classes || []).find(c => c.id === classId);
  const subj = (workingDraft.subjects || []).find(s => s.id === subjectId);
  const currentAssigned = getAssignedTeacher(workingDraft, classId, subjectId);
  const teachers = workingDraft.teachers || [];

  const rect = anchorElement.getBoundingClientRect();
  const popoverWidth = 280;
  let left = rect.left;
  if (left + popoverWidth > window.innerWidth - 12) {
    left = window.innerWidth - popoverWidth - 12;
  }
  if (left < 10) left = 10;

  let top = rect.bottom + 6;
  if (top + 330 > window.innerHeight) {
    top = Math.max(10, rect.top - 320);
  }

  const container = document.createElement('div');
  container.id = 'active-matrix-popover-root';
  container.innerHTML = `
    <div class="matrix-popover-overlay" data-action="close-popover"></div>
    <div class="matrix-popover" style="top:${top}px;left:${left}px;">
      <div class="popover-header">
        <div>
          <strong style="font-size:12px;color:#184239;">${esc(subj?.name || 'Môn học')}</strong>
          <small style="color:#71877b;"> · Lớp ${esc(cls?.name || '')}</small>
          ${currentAssigned ? `<div style="font-size:10px;color:#047857;font-weight:600;margin-top:2px;">Đang phân công: ${esc(currentAssigned.fullName)} (${esc(currentAssigned.code)})</div>` : '<div style="font-size:10px;color:#8fa195;margin-top:2px;">Chưa phân công giáo viên</div>'}
        </div>
        <button type="button" class="popover-close-btn" data-action="close-popover" title="Đóng">✕</button>
      </div>

      <input type="text" class="popover-search" id="popover-search-input" placeholder="Tìm tên hoặc mã giáo viên..." autocomplete="off">

      <div class="popover-teachers-list" id="popover-teachers-list">
        ${teachers.length ? teachers.map(t => {
          const isCurrent = currentAssigned?.id === t.id;
          const initials = (t.code || 'GV').slice(0, 3).toUpperCase();
          const assignCount = Array.isArray(t.assignments) ? t.assignments.length : 0;
          return `
            <button type="button" class="popover-teacher-btn ${isCurrent ? 'selected' : ''}" data-popover-select-teacher="${esc(t.id)}" data-class="${esc(classId)}" data-subject="${esc(subjectId)}" title="${isCurrent ? 'Click lại để bỏ phân công' : 'Click để phân công'}">
              <span class="popover-avatar">${esc(initials)}</span>
              <span class="popover-teacher-name">${esc(t.fullName)}</span>
              <span class="popover-teacher-code">${esc(t.code)}</span>
              ${isCurrent ? '<span style="color:#16a34a;font-weight:700;margin-left:auto;" title="Đang dạy (Click lại để bỏ phân công)">✓ Đang dạy</span>' : `<small style="font-size:8px;color:#8ba093;margin-left:auto;">${assignCount} lớp</small>`}
            </button>
          `;
        }).join('') : '<p style="font-size:11px;color:#888;padding:12px;text-align:center;">Chưa có giáo viên nào trong danh mục.</p>'}
      </div>

      <button type="button" class="popover-unassign-btn" data-action="popover-unassign" data-class="${esc(classId)}" data-subject="${esc(subjectId)}">
        ${currentAssigned ? `✕ Xóa bỏ phân công (${esc(currentAssigned.fullName)})` : '✕ Xóa phân công (Ô đang trống)'}
      </button>
    </div>
  `;
  document.body.appendChild(container);

  setTimeout(() => {
    const searchIn = container.querySelector('#popover-search-input');
    searchIn?.focus();
    searchIn?.addEventListener('input', e => {
      const q = e.target.value.toLowerCase().trim();
      const items = container.querySelectorAll('.popover-teacher-btn');
      items.forEach(btn => {
        const text = btn.textContent.toLowerCase();
        btn.style.display = text.includes(q) ? 'flex' : 'none';
      });
    });
  }, 20);
}

function closePopover() {
  const existing = document.querySelector('#active-matrix-popover-root');
  if (existing) existing.remove();
}

let pendingImportTeachers = [];

function openTeacherImportPreviewModal({ fileName, parsedTeachers }) {
  pendingImportTeachers = parsedTeachers;

  const currentTeachers = workingDraft.teachers || [];
  const existingByCode = new Set(currentTeachers.map(t => String(t.code || '').trim().toUpperCase()).filter(Boolean));
  const existingByName = new Set(currentTeachers.map(t => String(t.fullName || '').trim().toLowerCase()).filter(Boolean));

  let newCount = 0;
  let updateCount = 0;

  const previewList = parsedTeachers.map(p => {
    const upperCode = p.code ? p.code.trim().toUpperCase() : '';
    const lowerName = p.fullName.trim().toLowerCase();
    const isExisting = (upperCode && existingByCode.has(upperCode)) || existingByName.has(lowerName);
    if (isExisting) updateCount++;
    else newCount++;
    return { ...p, isExisting };
  });

  openDialog(`
    <form id="teacher-import-form">
      <div class="dialog-title">
        <div>
          <div class="eyebrow">NHẬP DANH SÁCH GIÁO VIÊN TỪ EXCEL</div>
          <h2>Xem trước tệp: ${esc(fileName)}</h2>
          <p>Tìm thấy <strong>${parsedTeachers.length}</strong> giáo viên trong tệp.</p>
        </div>
        ${closeButton}
      </div>

      <div class="excel-import-summary">
        <div class="import-stat-pill new">
          <span class="dot"></span>
          <strong>${newCount}</strong> giáo viên mới
        </div>
        <div class="import-stat-pill update">
          <span class="dot"></span>
          <strong>${updateCount}</strong> giáo viên đã có (cập nhật thông tin)
        </div>
      </div>

      <div class="excel-import-options">
        <label class="radio-label">
          <input type="radio" name="importMode" value="merge" checked>
          <span><strong>Bổ sung & Cập nhật (Khuyên dùng):</strong> Thêm mới giáo viên chưa có; cập nhật SĐT, email, ghi chú cho giáo viên đã có (bảo toàn phân công môn và lớp chủ nhiệm).</span>
        </label>
        <label class="radio-label">
          <input type="radio" name="importMode" value="skip">
          <span><strong>Chỉ thêm mới:</strong> Bỏ qua những giáo viên đã có mã hoặc trùng tên.</span>
        </label>
      </div>

      <div class="excel-preview-scroll">
        <table class="excel-preview-table">
          <thead>
            <tr>
              <th style="width:36px;">STT</th>
              <th style="width:75px;">Mã GV</th>
              <th>Họ và tên</th>
              <th style="width:95px;">Số điện thoại</th>
              <th>Ghi chú / Môn</th>
              <th style="width:85px;text-align:center;">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            ${previewList.map((item, idx) => `
              <tr class="${item.isExisting ? 'row-update' : 'row-new'}">
                <td>${idx + 1}</td>
                <td><strong>${esc(item.code || '(Tự sinh)')}</strong></td>
                <td>${esc(item.fullName)}</td>
                <td>${esc(item.phone || '—')}</td>
                <td><small>${esc(item.note || item.email || '—')}</small></td>
                <td style="text-align:center;">
                  ${item.isExisting 
                    ? '<span class="import-badge update">Cập nhật</span>' 
                    : '<span class="import-badge new">Thêm mới</span>'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div id="form-error" class="form-error" role="alert"></div>

      <div class="dialog-actions">
        <button type="button" data-action="close">Hủy</button>
        <button type="submit" class="primary">
          ✓ Xác nhận nhập ${parsedTeachers.length} giáo viên
        </button>
      </div>
    </form>
  `);
}

function cellEditor(classId, timeSlotId) {
  if (!canEditWorking()) {
    toast('Chỉ Người xếp lịch hoặc Quản trị viên mới được sửa ô ở bản nháp.');
    return;
  }
  const cls = (state.classes || []).find(c => c.id === classId);
  const slot = (state.timeSlots || []).find(s => s.id === timeSlotId);
  const cell = (state.timetableCells || []).find(c => c.classId === classId && c.timeSlotId === timeSlotId);
  const currentSub = cell ? (state.subjects || []).find(s => s.id === cell.subjectId) : null;
  const currentTea = cell ? (state.teachers || []).find(t => t.id === cell.teacherId) : null;
  const locked = !!cell?.locked;

  openDialog(`
    <form id="cell-form" data-class="${esc(classId)}" data-slot="${esc(timeSlotId)}">
      <div class="dialog-title">
        <div>
          <div class="eyebrow">CHỈNH SỬA & NHẬP LIỆU Ô LỊCH</div>
          <h2>${esc(cls?.name || '')}</h2>
          <p>Thứ ${slot?.dayOfWeek || ''} · ${slot?.session === 'MORNING' ? 'Sáng' : 'Chiều'} tiết ${slot?.period || ''} · ${esc(slot?.startTime || '')}–${esc(slot?.endTime || '')}</p>
        </div>
        ${closeButton}
      </div>
      ${locked ? '<div class="notice">Ô đã khóa. Mở khóa để thay đổi môn, giáo viên hoặc xóa.</div>' : ''}
      <fieldset ${locked ? 'disabled' : ''}>
        <!-- Chuyển đổi phương thức: Nhập liệu trực tiếp vs Chọn từ danh mục -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;background:#f0f4ee;padding:3px 4px;border-radius:8px;">
          <div style="display:flex;gap:3px;">
            <button type="button" id="tab-mode-type" class="mode-tab selected" style="font-size:11px;padding:6px 12px;border:none;background:#fff;color:#184239;font-weight:700;border-radius:6px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">⌨️ Nhập liệu nhanh (Gõ phím)</button>
            <button type="button" id="tab-mode-select" class="mode-tab" style="font-size:11px;padding:6px 12px;border:none;background:transparent;color:#687b72;border-radius:6px;">📋 Chọn từ danh sách</button>
          </div>
          <span style="font-size:10px;color:#7c8f85;padding-right:6px;">Enter để lưu</span>
        </div>

        <!-- Chế độ 1: Nhập liệu trực tiếp -->
        <div id="panel-mode-type">
          <label style="margin-top:0;">⚡ Gõ nhanh 1 dòng (Môn - Giáo viên)
            <input type="text" name="quickLine" id="quick-line-input" placeholder="Ví dụ: Toán - Nguyễn Văn A hoặc TOAN - NVA" autocomplete="off" value="${cell && currentSub ? `${esc(currentSub.name)}${currentTea ? ' - ' + esc(currentTea.fullName) : ''}` : ''}">
            <span class="field-help" style="font-size:10px;color:#798b81;display:block;margin-top:3px;">Cú pháp: <code>[Tên môn/mã môn] - [Tên/mã giáo viên]</code>. Nhấn Enter để lưu ngay.</span>
          </label>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px;">
            <label style="margin-top:0;">Môn học (Gõ tên / mã)
              <input type="text" name="subjectInput" id="cell-subject-input" list="subjects-datalist" placeholder="Toán, Văn, TOAN..." value="${esc(currentSub?.name || '')}" autocomplete="off">
              <datalist id="subjects-datalist">
                ${(state.subjects || []).map(s => `<option value="${esc(s.name)}">${esc(s.code)} · ${esc(s.name)}</option>`).join('')}
              </datalist>
            </label>

            <label style="margin-top:0;">Giáo viên (Gõ tên / mã)
              <input type="text" name="teacherInput" id="cell-teacher-input" list="teachers-datalist" placeholder="Thầy An, Cô Lan, NVA..." value="${esc(currentTea?.fullName || '')}" autocomplete="off">
              <datalist id="teachers-datalist">
                ${(state.teachers || []).map(t => `<option value="${esc(t.fullName)}">${esc(t.code)} · ${esc(t.fullName)}</option>`).join('')}
              </datalist>
            </label>
          </div>
          <p class="field-help" style="font-size:10px;color:#496d5e;background:#edf4ec;padding:8px 10px;border-radius:6px;margin:10px 0 0;line-height:1.5;">
            💡 <strong>Tự động nhận diện & thêm mới:</strong> Nếu bạn gõ môn hoặc tên giáo viên chưa có trong hệ thống, app sẽ tự động tạo mới vào danh mục nhà trường.
          </p>
        </div>

        <!-- Chế độ 2: Chọn từ danh sách -->
        <div id="panel-mode-select" style="display:none;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <label style="margin-top:0;">Môn học
              <select name="subjectId" id="cell-subject-select">${selectOptions(state.subjects || [], cell?.subjectId, 'name', '— Chọn môn học —')}</select>
            </label>
            <label style="margin-top:0;">Giáo viên
              <select name="teacherId" id="cell-teacher-select">${selectOptions(state.teachers || [], cell?.teacherId, 'fullName', '— Chưa chọn giáo viên —')}</select>
            </label>
          </div>
          <p class="field-help" style="margin-top:8px;">Chọn từ danh mục môn học và giáo viên hiện có.</p>
        </div>

        <label style="margin-top:14px;">Ghi chú ô
          <input name="note" maxlength="200" value="${esc(cell?.note || '')}" placeholder="Ví dụ: phòng máy tính, phòng thí nghiệm, học bù…">
        </label>
        <label class="checkbox" style="margin-top:12px;">
          <input type="checkbox" name="locked" ${locked ? 'checked' : ''}> Khóa ô sau khi lưu (ngăn sửa đổi ngoài ý muốn)
        </label>
      </fieldset>
      <div id="form-error" class="form-error" role="alert"></div>
      <div class="dialog-actions">
        ${
          cell
            ? `
          <button type="button" data-action="toggle-lock" data-class="${esc(classId)}" data-slot="${esc(timeSlotId)}">
            ${locked ? 'Mở khóa' : 'Khóa ô'}
          </button>
          <button type="button" data-action="delete-cell" data-class="${esc(classId)}" data-slot="${esc(timeSlotId)}" class="danger-link" ${locked ? 'disabled' : ''}>
            Xóa ô
          </button>
        `
            : ''
        }
        <button type="button" data-action="close">Hủy</button>
        <button class="primary" type="submit" ${locked ? 'disabled' : ''}>Lưu ô lịch</button>
      </div>
    </form>
  `);

  setTimeout(() => {
    const qInput = dialog.querySelector('#quick-line-input') || dialog.querySelector('#cell-subject-input');
    if (qInput && !locked) {
      qInput.focus();
      qInput.select();
    }
  }, 40);
}

function entityEditor(kind, id) {
  if (!isSchedulerRole()) return;
  const item = (state[kind] || []).find(x => x.id === id) || {};
  const labels = { classes: 'lớp', subjects: 'môn', teachers: 'giáo viên' };

  openDialog(`
    <form id="entity-form" data-kind="${kind}" data-id="${esc(id || '')}">
      <div class="dialog-title">
        <h2>${id ? 'Sửa' : 'Thêm'} ${labels[kind]}</h2>
        ${closeButton}
      </div>
      <label>Mã ${labels[kind]}
        <input name="code" maxlength="30" required value="${esc(item.code || '')}" placeholder="${kind === 'teachers' ? 'GV01' : kind === 'classes' ? '6A1' : 'TOAN'}">
      </label>
      <label>${kind === 'teachers' ? 'Họ tên giáo viên' : 'Tên hiển thị'}
        <input name="name" maxlength="100" required value="${esc(kind === 'teachers' ? item.fullName || '' : item.name || '')}">
      </label>
      ${
        kind === 'classes'
          ? `
        <label>Khối
          <select name="grade">
            ${[6, 7, 8, 9, 10, 11, 12].map(g => `<option value="${g}" ${item.grade === g ? 'selected' : ''}>Khối ${g}</option>`).join('')}
          </select>
        </label>
        <label>Giáo viên chủ nhiệm (GVCN)
          <select name="homeroomTeacherId">${selectOptions(state.teachers || [], item.homeroomTeacherId, 'fullName', '— Chưa có GVCN —')}</select>
        </label>
      `
          : kind === 'subjects'
          ? `
        <label>Màu môn
          <input name="color" type="color" value="${esc(item.color || '#2563eb')}">
        </label>
      `
          : '<p class="field-help">Chỉ cần mã và họ tên. Chọn giáo viên trực tiếp khi xếp ô lịch.</p>'
      }
      <div id="form-error" class="form-error" role="alert"></div>
      <div class="dialog-actions">
        <button type="button" data-action="close">Hủy</button>
        <button type="submit" class="primary">Lưu</button>
      </div>
    </form>
  `);
}

function schoolEditor() {
  if (!isSchedulerRole()) return;
  openDialog(`
    <form id="school-form">
      <div class="dialog-title">
        <h2>Thông tin nhà trường</h2>
        ${closeButton}
      </div>
      ${[['name', 'Tên trường'], ['year', 'Năm học'], ['term', 'Học kỳ'], ['appliedDate', 'Áp dụng từ']]
        .map(([key, label]) => `<label>${label}<input name="${key}" value="${esc(state.school?.[key] || '')}" ${key === 'appliedDate' ? 'type="date"' : 'required maxlength="120"'}></label>`)
        .join('')}
      <div id="form-error" class="form-error" role="alert"></div>
      <div class="dialog-actions">
        <button type="button" data-action="close">Hủy</button>
        <button class="primary">Lưu thông tin</button>
      </div>
    </form>
  `);
}

function accountEditor(targetEmail) {
  if (!isAdmin()) return;
  const isEdit = !!targetEmail;
  const acc = isEdit ? accountsList.find(a => a.email === targetEmail) : null;
  const isTargetOwner = acc?.email === OWNER_EMAIL || acc?.role === 'OWNER';

  openDialog(`
    <form id="account-form" data-target="${esc(targetEmail || '')}">
      <div class="dialog-title">
        <h2>${isEdit ? 'Sửa quyền & Hồ sơ tài khoản' : 'Thêm tài khoản Google'}</h2>
        ${closeButton}
      </div>
      <label>Email Google
        <input name="email" type="email" required ${isEdit ? 'readonly style="background:#f5f8f5"' : ''} value="${esc(acc?.email || '')}" placeholder="ví dụ: giaovien@truong.edu.vn">
      </label>
      <label>Tên hiển thị
        <input name="displayName" maxlength="100" value="${esc(acc?.displayName || '')}" placeholder="Nguyễn Văn An">
      </label>
      <label>Vai trò hệ thống
        <select name="role" required ${isTargetOwner && !isOwner() ? 'disabled' : ''}>
          ${isOwner() ? '<option value="ADMIN" ' + (acc?.role === 'ADMIN' ? 'selected' : '') + '>ADMIN (Quản trị viên)</option>' : ''}
          <option value="SCHEDULER" ${acc?.role === 'SCHEDULER' ? 'selected' : ''}>SCHEDULER (Người xếp lịch)</option>
          <option value="TEACHER" ${acc?.role === 'TEACHER' || !acc ? 'selected' : ''}>TEACHER (Giáo viên)</option>
          ${isOwner() && isTargetOwner ? '<option value="OWNER" selected>OWNER (Quản trị chính)</option>' : ''}
        </select>
      </label>
      <label>Gắn hồ sơ Giáo viên chính thức
        <select name="teacherId">
          <option value="">— Chưa gán giáo viên —</option>
          ${(workingDraft.teachers || []).map(t => `<option value="${esc(t.id)}" ${acc?.teacherId === t.id ? 'selected' : ''}>${esc(t.fullName)} (${esc(t.code)})</option>`).join('')}
        </select>
      </label>
      <label>Xác nhận lớp chủ nhiệm chính thức
        <select name="homeroomClassIds" multiple size="3" style="height:70px;">
          ${(workingDraft.classes || []).map(c => `<option value="${esc(c.id)}" ${(acc?.homeroomClassIds || []).includes(c.id) ? 'selected' : ''}>Lớp ${esc(c.name)}</option>`).join('')}
        </select>
      </label>
      <label class="checkbox">
        <input type="checkbox" name="isVisiting" ${acc?.isVisiting ? 'checked' : ''}> Đánh dấu là Giáo viên thỉnh giảng
      </label>
      <label class="checkbox" style="margin-top:10px;">
        <input type="checkbox" name="active" ${!acc || acc.active ? 'checked' : ''} ${isTargetOwner ? 'disabled checked' : ''}> Kích hoạt tài khoản
      </label>
      <div id="form-error" class="form-error" role="alert"></div>
      <div class="dialog-actions">
        <button type="button" data-action="close">Hủy</button>
        <button type="submit" class="primary">Lưu tài khoản</button>
      </div>
    </form>
  `);
}

function reviewProfileDialog(targetEmail) {
  if (!isAdmin()) return;
  const acc = accountsList.find(a => a.email === targetEmail);
  if (!acc) return;

  openDialog(`
    <form id="review-profile-form" data-target="${esc(targetEmail)}">
      <div class="dialog-title">
        <h2>Xác nhận hồ sơ giáo viên: ${esc(acc.displayName || acc.email)}</h2>
        ${closeButton}
      </div>

      <div class="pending-box" style="margin-bottom:16px;">
        <strong>Thông tin tự khai báo:</strong><br>
        • Môn giảng dạy: ${esc(acc.selfDeclared?.subjects?.join(', ') || 'Chưa chọn')}<br>
        • Lớp chủ nhiệm tự khai: ${esc(acc.selfDeclared?.homeroomClassId ? text(state.classes || [], acc.selfDeclared.homeroomClassId) : 'Không chủ nhiệm')}<br>
        • Ghi chú: ${esc(acc.selfDeclared?.note || 'Không có')}
      </div>

      <label>Liên kết với Giáo viên trong danh mục
        <select name="teacherId" required>
          <option value="">— Chọn giáo viên chính thức —</option>
          ${(workingDraft.teachers || []).map(t => `<option value="${esc(t.id)}" ${acc.teacherId === t.id ? 'selected' : ''}>${esc(t.fullName)} (${esc(t.code)})</option>`).join('')}
        </select>
      </label>

      <label>Xác nhận lớp chủ nhiệm chính thức
        <select name="homeroomClassIds" multiple size="3" style="height:70px;">
          ${(workingDraft.classes || []).map(c => `<option value="${esc(c.id)}" ${(acc.homeroomClassIds || (acc.selfDeclared?.homeroomClassId ? [acc.selfDeclared.homeroomClassId] : [])).includes(c.id) ? 'selected' : ''}>Lớp ${esc(c.name)}</option>`).join('')}
        </select>
      </label>

      <label class="checkbox">
        <input type="checkbox" name="isVisiting" ${acc.isVisiting ? 'checked' : ''}> Là Giáo viên thỉnh giảng
      </label>

      <label class="checkbox" style="margin-top:10px;">
        <input type="checkbox" name="active" checked> Kích hoạt và cấp quyền truy cập ngay
      </label>

      <div id="form-error" class="form-error" role="alert"></div>
      <div class="dialog-actions">
        <button type="button" data-action="close">Hủy</button>
        <button type="submit" class="primary">Xác nhận hồ sơ</button>
      </div>
    </form>
  `);
}

function respondRequestDialog(requestId, decision) {
  if (!isSchedulerRole()) return;
  const req = requestsList.find(r => r.id === requestId);
  if (!req) return;

  openDialog(`
    <form id="respond-request-form" data-id="${esc(requestId)}" data-decision="${esc(decision)}">
      <div class="dialog-title">
        <h2>${decision === 'APPROVED' ? 'Chấp thuận yêu cầu' : 'Từ chối yêu cầu'}</h2>
        ${closeButton}
      </div>
      <p>Yêu cầu từ: <strong>${esc(req.teacherEmail)}</strong><br>Lý do: ${esc(req.reason)}</p>
      <label>Phản hồi gửi giáo viên
        <textarea name="responseNote" required rows="3" style="width:100%;border:1px solid #d9e1da;border-radius:7px;padding:8px;" placeholder="Ghi rõ lý do hoặc hướng giải quyết...">${decision === 'APPROVED' ? 'Ban Giám hiệu / Người xếp lịch đã chấp thuận và sẽ điều chỉnh trong bản công bố tới.' : 'Rất tiếc yêu cầu chưa thể thực hiện do trùng lịch của trường.'}</textarea>
      </label>
      <div class="dialog-actions">
        <button type="button" data-action="close">Hủy</button>
        <button type="submit" class="${decision === 'APPROVED' ? 'primary' : 'danger-link'}">Xác nhận ${decision === 'APPROVED' ? 'Chấp thuận' : 'Từ chối'}</button>
      </div>
    </form>
  `);
}

// ----------------------------------------------------
// Global Event Listeners & Actions
// ----------------------------------------------------
const actions = {
  close: () => dialog.close(),
  login: async () => {
    authError = '';
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error('Login error:', err);
      authError = err.code === 'auth/popup-blocked'
        ? 'Trình duyệt đã chặn cửa sổ đăng nhập Google. Hãy nhấn vào biểu tượng chặn popup trên thanh địa chỉ để cho phép.'
        : 'Đăng nhập không thành công: ' + err.message;
      render();
    }
  },
  logout: async () => {
    stopAllSubscriptions();
    await fbSignOut(auth);
  },
  backup: () => {
    download(`tkb-sao-luu-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(displayed(), null, 2));
  },
  print: () => window.print(),
  csv: () => download('thoi-khoa-bieu.csv', exportCsv(displayed()), 'text/csv;charset=utf-8'),
  density: () => {
    compact = !compact;
    render();
  },
  fullscreen: async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      toast('Trình duyệt chưa cho phép toàn màn hình.');
    }
  },
  draft: () => {
    showPublished = false;
    state = clone(workingDraft);
    render();
  },
  published: () => {
    showPublished = true;
    teacher = '';
    if (publishedTimetable?.data) state = clone(publishedTimetable.data);
    render();
  },
  'go-matrix': () => {
    view = 'matrix';
    showPublished = false;
    state = clone(workingDraft);
    render();
  },
  'view-published': () => {
    view = 'matrix';
    showPublished = true;
    teacher = '';
    render();
  },
  'save-version': async () => {
    if (!isSchedulerRole()) return;
    const name = prompt('Tên phiên bản:', `Bản lịch ${workingDraft.versions.length + 1}`)?.trim();
    if (!name) return;
    const snapshot = makeSnapshot(workingDraft, name.slice(0, 100));
    const next = { ...workingDraft, versions: [snapshot, ...workingDraft.versions] };
    if (await syncWorkingToCloud(next)) {
      toast('Đã lưu phiên bản mới lên Cloud.');
    }
  },
  publish: publishToCloud,
  unpublish: unpublishFromCloud,
  'restore-published': async () => {
    if (!isSchedulerRole() || !publishedTimetable?.data) return;
    if (confirm('Khôi phục cả danh mục và ô lịch từ bản đã chốt về bản đang xếp?')) {
      const next = restoreSnapshot(workingDraft, publishedTimetable);
      if (await syncWorkingToCloud(next)) toast('Đã khôi phục bản đã chốt về bản nháp.');
    }
  },
  school: schoolEditor,
  'add-account': () => accountEditor(null),
  'save-availability': async () => {
    if (!currentUser?.email) return;
    const dateRangeText = document.querySelector('#avail-daterange')?.value || '';
    const noteText = document.querySelector('#avail-note')?.value || '';
    const payload = {
      teacherEmail: currentUser.email.toLowerCase(),
      availableSlotIds: availabilityDoc?.availableSlotIds || [],
      busySlotIds: availabilityDoc?.busySlotIds || [],
      dateRange: { text: dateRangeText },
      note: noteText,
      updatedAt: new Date().toISOString()
    };
    try {
      await setDoc(doc(db, 'availabilities', currentUser.email.toLowerCase()), payload);
      toast('Đã lưu khung thời gian có thể dạy lên Cloud.');
    } catch (e) {
      toast('Lỗi lưu thời gian: ' + e.message);
    }
  },
  'edit-self-declared': () => {
    openDialog(`
      <form id="edit-self-declared-form">
        <div class="dialog-title">
          <h2>Cập nhật thông tin tự khai</h2>
          ${closeButton}
        </div>
        <label>Môn giảng dạy
          <select name="subjects" multiple size="4" style="height:90px;" required>
            ${(state.subjects || []).map(s => `<option value="${esc(s.name)}" ${(currentUserProfile?.selfDeclared?.subjects || []).includes(s.name) ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
          </select>
        </label>
        <label>Ghi chú cá nhân
          <input name="note" maxlength="300" value="${esc(currentUserProfile?.selfDeclared?.note || '')}" placeholder="Ghi chú...">
        </label>
        <div class="dialog-actions">
          <button type="button" data-action="close">Hủy</button>
          <button type="submit" class="primary">Lưu</button>
        </div>
      </form>
    `);
  },
  'toggle-lock': async element => {
    if (!canEditWorking()) return;
    const { class: classId, slot: timeSlotId } = element.dataset;
    const nextCells = workingDraft.timetableCells.map(c => (c.classId === classId && c.timeSlotId === timeSlotId ? { ...c, locked: !c.locked } : c));
    const next = { ...workingDraft, timetableCells: nextCells };
    if (await syncWorkingToCloud(next)) cellEditor(classId, timeSlotId);
  },
  'delete-cell': async element => {
    if (!canEditWorking()) return;
    try {
      const next = deleteCell(workingDraft, element.dataset.class, element.dataset.slot);
      if (await syncWorkingToCloud(next)) {
        toast('Đã xóa ô lịch.');
        dialog.close();
      }
    } catch (e) {
      toast(e.message);
    }
  },
  'popover-unassign': async element => {
    if (!canEditWorking()) {
      toast('Bản lịch đã chốt hoặc bạn không có quyền sửa đổi bản nháp.');
      return;
    }
    const classId = element.dataset.class;
    const subjectId = element.dataset.subject;
    closePopover();
    if (!classId || !subjectId) return;
    try {
      const next = unassignClassSubject(workingDraft, { classId, subjectId });
      if (await syncWorkingToCloud(next)) {
        render();
        toast('Đã xóa bỏ phân công chuyên môn.');
      }
    } catch (e) {
      toast('Lỗi khi xóa phân công: ' + e.message);
    }
  },
  'brush-eraser': () => {
    brushMode = (brushMode === 'eraser' ? 'none' : 'eraser');
    if (brushMode === 'eraser') selectedTeacherHighlight = '';
    render();
    if (brushMode === 'eraser') {
      toast('Đã bật chế độ Tẩy: Click vào ô bất kỳ trên ma trận để xóa phân công.');
    } else {
      toast('Đã tắt chế độ Tẩy.');
    }
  },
  'brush-off': () => {
    brushMode = 'none';
    brushTeacherId = '';
    selectedTeacherHighlight = '';
    render();
    toast('Đã tắt chế độ cọ.');
  },
  'clear-highlight': () => {
    selectedTeacherHighlight = '';
    if (brushMode !== 'brush') brushTeacherId = '';
    render();
  },
  'close-popover': () => {
    closePopover();
  },
  'respond-request': element => {
    respondRequestDialog(element.dataset.id, element.dataset.decision);
  },
  import: () => {
    if (!isSchedulerRole()) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const json = JSON.parse(text);
        const next = parseBackup(json, SEED);
        if (confirm(`Bạn có chắc muốn nhập dữ liệu từ "${file.name}"? Dữ liệu bản nháp hiện tại sẽ được thay thế.`)) {
          if (await syncWorkingToCloud(next)) {
            toast('Đã nhập dữ liệu thành công!');
            render();
          }
        }
      } catch (err) {
        alert('Lỗi nhập dữ liệu: ' + err.message);
      }
    };
    input.click();
  },
  'download-teacher-template': () => {
    try {
      const ws = XLSX.utils.json_to_sheet(TEACHER_TEMPLATE_ROWS);
      ws['!cols'] = [
        { wch: 6 },
        { wch: 12 },
        { wch: 25 },
        { wch: 16 },
        { wch: 28 },
        { wch: 26 }
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'DanhSachGiaoVien');
      XLSX.writeFile(wb, 'danh_sach_giao_vien_mau.xlsx');
      toast('Đã tải xuống file Excel mẫu: danh_sach_giao_vien_mau.xlsx');
    } catch (err) {
      toast('Không thể tải file mẫu: ' + err.message);
    }
  },
  'import-teachers-excel': () => {
    if (!isSchedulerRole()) {
      toast('Bạn không có quyền chỉnh sửa danh mục giáo viên.');
      return;
    }
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.xlsx, .xls, .csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, text/csv';
    fileInput.onchange = async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      try {
        toast(`Đang đọc tệp "${file.name}"...`);
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          throw Error('Tệp Excel không chứa sheet dữ liệu nào.');
        }
        const sheet = workbook.Sheets[firstSheetName];
        const raw2D = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        const parsedTeachers = parseTeacherRows(raw2D);
        if (!parsedTeachers.length) {
          throw Error('Không tìm thấy dữ liệu giáo viên trong tệp. Vui lòng kiểm tra lại cột "Họ và tên".');
        }
        openTeacherImportPreviewModal({
          fileName: file.name,
          parsedTeachers
        });
      } catch (err) {
        alert('Lỗi đọc file Excel: ' + err.message);
      }
    };
    fileInput.click();
  }
};

document.addEventListener('click', async event => {
  const element = event.target.closest('button, [data-toggle-slot], [data-action], [data-select-teacher], [data-assign-cell], [data-popover-select-teacher]');
  if (!element) return;

  if (element.dataset.loginAs) {
    loginIntent = element.dataset.loginAs;
    render();
    return;
  }
  if (element.dataset.action && actions[element.dataset.action]) {
    await actions[element.dataset.action](element);
    return;
  }
  if (element.dataset.view) {
    view = element.dataset.view;
    render();
    return;
  }
  if (element.dataset.switchPersonalMode) {
    personalViewMode = element.dataset.switchPersonalMode;
    render();
    return;
  }
  if (element.dataset.openHomeroomClass) {
    selectedHomeroomClassId = element.dataset.openHomeroomClass;
    view = 'homeroom_class';
    render();
    return;
  }
  if (element.dataset.toggleSlot) {
    const slotId = element.dataset.toggleSlot;
    if (!slotId) return;
    let avail = new Set(availabilityDoc?.availableSlotIds || []);
    let busy = new Set(availabilityDoc?.busySlotIds || []);

    if (avail.has(slotId)) {
      avail.delete(slotId);
      busy.add(slotId);
    } else if (busy.has(slotId)) {
      busy.delete(slotId);
    } else {
      avail.add(slotId);
    }
    availabilityDoc = {
      ...availabilityDoc,
      availableSlotIds: [...avail],
      busySlotIds: [...busy]
    };
    render();
    return;
  }
  if (element.dataset.reviewProfile) {
    reviewProfileDialog(element.dataset.reviewProfile);
    return;
  }
  if (element.dataset.editAccount) {
    accountEditor(element.dataset.editAccount);
    return;
  }
  if (element.dataset.deleteAccount) {
    if (!isOwner()) return;
    const targetEmail = element.dataset.deleteAccount;
    if (targetEmail === OWNER_EMAIL) {
      toast('Không thể xóa Quản trị chính.');
      return;
    }
    if (confirm(`Xóa tài khoản "${targetEmail}"?`)) {
      try {
        await deleteDoc(doc(db, 'users', targetEmail));
        toast('Đã xóa tài khoản.');
      } catch (err) {
        toast('Lỗi xóa: ' + err.message);
      }
    }
    return;
  }
  if (element.dataset.setMatrixMode) {
    matrixViewMode = element.dataset.setMatrixMode;
    render();
    return;
  }
  if (element.dataset.popoverSelectTeacher || element.closest('[data-popover-select-teacher]')) {
    const btn = element.dataset.popoverSelectTeacher ? element : element.closest('[data-popover-select-teacher]');
    const teacherId = btn.dataset.popoverSelectTeacher;
    const classId = btn.dataset.class;
    const subjectId = btn.dataset.subject;
    closePopover();
    const current = getAssignedTeacher(workingDraft, classId, subjectId);
    let next;
    if (current && current.id === teacherId) {
      // Toggle unassign
      next = unassignClassSubject(workingDraft, { classId, subjectId });
      toast('Đã xóa bỏ phân công môn học này.');
    } else {
      next = assignTeacherToClassSubject(workingDraft, { classId, subjectId, teacherId });
    }
    if (await syncWorkingToCloud(next)) {
      render();
    }
    return;
  }
  if (element.dataset.assignCell || element.closest('[data-assign-cell]')) {
    const target = element.dataset.assignCell ? element : element.closest('[data-assign-cell]');
    const classId = target.dataset.assignClass;
    const subjectId = target.dataset.assignSubject;

    if (!canEditWorking()) {
      toast('Bản lịch đã chốt hoặc bạn không có quyền xếp lịch.');
      return;
    }

    // Quick Stamp / Brush Mode
    if (brushMode === 'brush' && brushTeacherId) {
      const next = assignTeacherToClassSubject(workingDraft, { classId, subjectId, teacherId: brushTeacherId });
      if (await syncWorkingToCloud(next)) {
        render();
      }
      return;
    }
    if (brushMode === 'eraser') {
      const next = unassignClassSubject(workingDraft, { classId, subjectId });
      if (await syncWorkingToCloud(next)) {
        render();
      }
      return;
    }

    // Default Mode: Popover Click
    openAssignmentPopover({ classId, subjectId, anchorElement: target });
    return;
  }
  if (element.dataset.selectTeacher || element.closest('[data-select-teacher]')) {
    const card = element.dataset.selectTeacher ? element : element.closest('[data-select-teacher]');
    if (card && !element.closest('button[data-edit], button[data-delete]')) {
      const teacherId = card.dataset.selectTeacher;
      if (selectedTeacherHighlight === teacherId && brushMode === 'brush') {
        selectedTeacherHighlight = '';
        brushTeacherId = '';
        brushMode = 'none';
        toast('Đã tắt rọi sáng giáo viên.');
      } else {
        selectedTeacherHighlight = teacherId;
        brushTeacherId = teacherId;
        brushMode = 'brush';
        view = 'matrix';
        toast(`Đang rọi sáng và dùng cọ gán cho: ${text(state.teachers, teacherId, 'fullName')}`);
      }
      render();
      return;
    }
  }

  if (element.dataset.cellClass) {
    // If in timetable mode and brush is active, also stamp directly!
    if (canEditWorking() && brushMode === 'brush' && brushTeacherId) {
      const classId = element.dataset.cellClass;
      const timeSlotId = element.dataset.cellSlot;
      const cell = (workingDraft.timetableCells || []).find(c => c.classId === classId && c.timeSlotId === timeSlotId);
      if (cell && !cell.locked) {
        const next = putCell(workingDraft, { ...cell, teacherId: brushTeacherId }, { allowConflict: true });
        if (await syncWorkingToCloud(next)) render();
        return;
      }
    } else if (canEditWorking() && brushMode === 'eraser') {
      const classId = element.dataset.cellClass;
      const timeSlotId = element.dataset.cellSlot;
      const cell = (workingDraft.timetableCells || []).find(c => c.classId === classId && c.timeSlotId === timeSlotId);
      if (cell && !cell.locked) {
        const next = putCell(workingDraft, { ...cell, teacherId: '' }, { allowConflict: true });
        if (await syncWorkingToCloud(next)) render();
        return;
      }
    }
    cellEditor(element.dataset.cellClass, element.dataset.cellSlot);
    return;
  }
  if (element.dataset.add) {
    entityEditor(element.dataset.add);
    return;
  }
  if (element.dataset.edit) {
    entityEditor(element.dataset.edit, element.dataset.id);
    return;
  }
  if (element.dataset.delete) {
    if (!canEditWorking()) return;
    try {
      const next = deleteEntity(workingDraft, element.dataset.delete, element.dataset.id);
      if (confirm('Xóa mục này khỏi danh mục?')) await syncWorkingToCloud(next);
    } catch (e) {
      toast(e.message);
    }
    return;
  }
  if (element.dataset.restore) {
    if (!isSchedulerRole()) return;
    const version = (workingDraft.versions || []).find(v => v.id === element.dataset.restore);
    if (version && confirm(`Khôi phục danh mục và ma trận từ "${version.name}"?`)) {
      const next = restoreSnapshot(workingDraft, version);
      await syncWorkingToCloud(next);
    }
    return;
  }
  if (element.dataset.removeVersion) {
    if (!isSchedulerRole()) return;
    if (confirm('Xóa phiên bản này?')) {
      const next = {
        ...workingDraft,
        versions: (workingDraft.versions || []).filter(v => v.id !== element.dataset.removeVersion)
      };
      await syncWorkingToCloud(next);
    }
  }

  // Chuyển tab trong hộp chỉnh ô: Nhập liệu trực tiếp vs Chọn danh mục
  if (element.id === 'tab-mode-type' || element.closest('#tab-mode-type')) {
    const typeBtn = document.querySelector('#tab-mode-type');
    const selectBtn = document.querySelector('#tab-mode-select');
    const typePanel = document.querySelector('#panel-mode-type');
    const selectPanel = document.querySelector('#panel-mode-select');
    if (typeBtn && selectBtn && typePanel && selectPanel) {
      typeBtn.style.background = '#fff';
      typeBtn.style.color = '#184239';
      typeBtn.style.fontWeight = '700';
      typeBtn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
      selectBtn.style.background = 'transparent';
      selectBtn.style.color = '#687b72';
      selectBtn.style.fontWeight = '500';
      selectBtn.style.boxShadow = 'none';
      typePanel.style.display = 'block';
      selectPanel.style.display = 'none';
      document.querySelector('#quick-line-input')?.focus();
    }
    return;
  }
  if (element.id === 'tab-mode-select' || element.closest('#tab-mode-select')) {
    const typeBtn = document.querySelector('#tab-mode-type');
    const selectBtn = document.querySelector('#tab-mode-select');
    const typePanel = document.querySelector('#panel-mode-type');
    const selectPanel = document.querySelector('#panel-mode-select');
    if (typeBtn && selectBtn && typePanel && selectPanel) {
      selectBtn.style.background = '#fff';
      selectBtn.style.color = '#184239';
      selectBtn.style.fontWeight = '700';
      selectBtn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
      typeBtn.style.background = 'transparent';
      typeBtn.style.color = '#687b72';
      typeBtn.style.fontWeight = '500';
      typeBtn.style.boxShadow = 'none';
      selectPanel.style.display = 'block';
      typePanel.style.display = 'none';
      document.querySelector('#cell-subject-select')?.focus();
    }
    return;
  }
});

document.addEventListener('change', event => {
  if (event.target.id === 'workspace-select') {
    currentWorkspace = event.target.value;
    view = currentWorkspace === 'ADMIN' ? 'overview'
         : currentWorkspace === 'SCHEDULER' ? 'matrix'
         : currentWorkspace === 'HOMEROOM' ? 'homeroom_overview'
         : currentWorkspace === 'VISITING' ? 'visiting_overview' : 'my_teaching';
    if (currentWorkspace !== 'ADMIN' && currentWorkspace !== 'SCHEDULER') {
      showPublished = true;
    }
    render();
    return;
  }
  if (event.target.id === 'teacher-filter') {
    teacher = event.target.value;
    render();
    return;
  }
  if (event.target.id === 'homeroom-class-select') {
    selectedHomeroomClassId = event.target.value;
    render();
    return;
  }
  if (event.target.id === 'cell-subject-select') {
    const selSub = (state.subjects || []).find(s => s.id === event.target.value);
    const subIn = document.querySelector('#cell-subject-input');
    if (subIn && selSub) subIn.value = selSub.name;
    const qIn = document.querySelector('#quick-line-input');
    const teaIn = document.querySelector('#cell-teacher-input');
    if (qIn && selSub) qIn.value = `${selSub.name}${teaIn?.value ? ' - ' + teaIn.value : ''}`;
  }
  if (event.target.id === 'brush-teacher-select') {
    brushTeacherId = event.target.value;
    brushMode = brushTeacherId ? 'brush' : 'none';
    selectedTeacherHighlight = brushTeacherId;
    render();
    return;
  }
  if (event.target.id === 'cell-teacher-select') {
    const selTea = (state.teachers || []).find(t => t.id === event.target.value);
    const teaIn = document.querySelector('#cell-teacher-input');
    if (teaIn && selTea) teaIn.value = selTea.fullName;
    const qIn = document.querySelector('#quick-line-input');
    const subIn = document.querySelector('#cell-subject-input');
    if (qIn && subIn?.value) qIn.value = `${subIn.value}${selTea ? ' - ' + selTea.fullName : ''}`;
  }
});

document.addEventListener('mousemove', event => {
  const indicator = document.querySelector('#brush-cursor-indicator');
  if (!indicator) return;
  if (brushMode === 'none') {
    indicator.style.display = 'none';
    return;
  }
  const overMatrix = event.target.closest('#matrix-scroll-container, .matrix');
  if (overMatrix) {
    indicator.style.display = 'block';
    indicator.style.left = (event.clientX + 14) + 'px';
    indicator.style.top = (event.clientY + 14) + 'px';
    if (brushMode === 'brush' && brushTeacherId) {
      indicator.className = 'brush-cursor-indicator';
      indicator.innerHTML = `🖌️ ${esc(text(state.teachers || [], brushTeacherId, 'fullName'))}`;
    } else if (brushMode === 'eraser') {
      indicator.className = 'brush-cursor-indicator eraser';
      indicator.innerHTML = '🧼 Tẩy phân công';
    }
  } else {
    indicator.style.display = 'none';
  }
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    closePopover();
  }
});

document.addEventListener('input', event => {
  if (event.target.id === 'quick-line-input') {
    const val = event.target.value;
    if (val.includes('-') || val.includes('–')) {
      const parts = val.split(/[-–]/).map(s => s.trim());
      const subIn = document.querySelector('#cell-subject-input');
      const teaIn = document.querySelector('#cell-teacher-input');
      if (subIn && parts[0]) subIn.value = parts[0];
      if (teaIn && parts[1] !== undefined) teaIn.value = parts[1];
    }
  }
  if (event.target.id === 'search') {
    const start = event.target.selectionStart;
    query = event.target.value;
    const scroll = document.querySelector('.matrix-scroll');
    const x = scroll?.scrollLeft || 0;
    const y = scroll?.scrollTop || 0;
    render();
    const input = document.querySelector('#search');
    if (input) {
      input.focus();
      input.setSelectionRange(start, start);
    }
    document.querySelector('.matrix-scroll')?.scrollTo(x, y);
  }
});

document.addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.target;
  const data = new FormData(form);

  try {
    if (form.id === 'onboarding-form') {
      const subjects = data.getAll('subjects').map(s => String(s).trim());
      const homeroomClassId = String(data.get('homeroomClassId') || '').trim();
      const note = String(data.get('note') || '').trim();
      const displayName = String(data.get('displayName') || '').trim();

      const userEmail = currentUser.email.toLowerCase();
      await setDoc(doc(db, 'users', userEmail), {
        email: userEmail,
        displayName: displayName || currentUser.displayName || 'Giáo viên',
        role: 'TEACHER',
        active: false, // Must be activated by admin
        selfDeclared: {
          subjects,
          homeroomClassId,
          note,
          submittedAt: new Date().toISOString()
        },
        updatedAt: new Date().toISOString(),
        updatedBy: userEmail
      });

      toast('Đã gửi hồ sơ thành công. Vui lòng chờ Quản trị viên duyệt.');
      currentUserProfile = {
        email: userEmail,
        role: 'TEACHER',
        active: false,
        selfDeclared: { subjects, homeroomClassId, note }
      };
      render();
    } else if (form.id === 'cell-form') {
      const classId = form.dataset.class;
      const timeSlotId = form.dataset.slot;

      const res = resolveSubjectAndTeacher(workingDraft, {
        quickLine: String(data.get('quickLine') || ''),
        subjectInput: String(data.get('subjectInput') || ''),
        teacherInput: String(data.get('teacherInput') || ''),
        subjectId: String(data.get('subjectId') || ''),
        teacherId: String(data.get('teacherId') || '')
      });

      if (!res.subjectId) {
        throw Error('Vui lòng nhập hoặc chọn môn học.');
      }

      const next = putCell(res.state, {
        classId,
        timeSlotId,
        subjectId: res.subjectId,
        teacherId: res.teacherId || '',
        note: String(data.get('note') || '').trim(),
        locked: data.has('locked')
      });
      if (await syncWorkingToCloud(next)) {
        toast('Đã lưu ô lịch thành công.');
        dialog.close();
      }
    } else if (form.id === 'entity-form') {
      const kind = form.dataset.kind;
      const id = form.dataset.id || uid();
      const code = String(data.get('code')).trim();
      const name = String(data.get('name')).trim();
      if (!code || !name) throw Error('Mã và tên không được để trống.');

      const list = workingDraft[kind] || [];
      if (list.some(item => item.id !== id && item.code.toLocaleLowerCase() === code.toLocaleLowerCase())) {
        throw Error('Mã đã tồn tại trong danh mục.');
      }
      const existing = list.find(item => item.id === id) || {};
      const item = {
        ...existing,
        id,
        code,
        ...(kind === 'teachers' ? { fullName: name } : { name }),
        ...(kind === 'classes'
          ? {
              grade: Number(data.get('grade')),
              homeroomTeacherId: data.get('homeroomTeacherId') || '',
              coHomeroomTeacherId: data.get('coHomeroomTeacherId') || ''
            }
          : {}),
        ...(kind === 'subjects' ? { color: data.get('color') } : {})
      };
      const updatedList = form.dataset.id ? list.map(old => (old.id === id ? item : old)) : [...list, item];
      if (kind === 'classes') updatedList.sort((a, b) => a.grade - b.grade || a.code.localeCompare(b.code, 'vi', { numeric: true }));

      const next = { ...workingDraft, [kind]: updatedList };
      if (await syncWorkingToCloud(next)) dialog.close();
    } else if (form.id === 'school-form') {
      const school = Object.fromEntries([...data].map(([key, value]) => [key, String(value).trim()]));
      if (!school.name || !school.year || !school.term) throw Error('Vui lòng điền tên trường, năm học và học kỳ.');
      const next = { ...workingDraft, school };
      if (await syncWorkingToCloud(next)) dialog.close();
    } else if (form.id === 'account-form') {
      const targetEmail = (form.dataset.target || data.get('email') || '').toLowerCase().trim();
      if (!targetEmail) throw Error('Vui lòng nhập email Google hợp lệ.');

      const role = data.get('role');
      const teacherId = data.get('teacherId') || '';
      const isVisiting = data.has('isVisiting');
      const homeroomClassIds = data.getAll('homeroomClassIds');
      const active = data.has('active');
      const displayName = String(data.get('displayName') || '').trim();

      if (targetEmail === OWNER_EMAIL && !isOwner()) throw Error('Không thể thay đổi quyền của Quản trị chính.');
      if (targetEmail === OWNER_EMAIL && role !== 'OWNER') throw Error('Quản trị chính không thể tự hạ quyền.');

      await setDoc(
        doc(db, 'users', targetEmail),
        {
          email: targetEmail,
          displayName: displayName || (targetEmail === OWNER_EMAIL ? 'Quản trị chính' : ''),
          role,
          teacherId,
          isVisiting,
          homeroomClassIds,
          active,
          updatedAt: new Date().toISOString(),
          updatedBy: currentUser?.email || 'admin'
        },
        { merge: true }
      );

      toast(`Đã lưu tài khoản ${targetEmail}.`);
      dialog.close();
    } else if (form.id === 'review-profile-form') {
      const targetEmail = form.dataset.target;
      const teacherId = data.get('teacherId');
      const homeroomClassIds = data.getAll('homeroomClassIds');
      const isVisiting = data.has('isVisiting');
      const active = data.has('active');

      await updateDoc(doc(db, 'users', targetEmail), {
        teacherId,
        homeroomClassIds,
        isVisiting,
        active,
        confirmedAt: new Date().toISOString(),
        confirmedBy: currentUser.email,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.email
      });

      toast(`Đã xác nhận hồ sơ cho ${targetEmail}.`);
      dialog.close();
    } else if (form.id === 'request-adjustment-form') {
      const lessonVal = data.get('lessonSlot') || '';
      const [timeSlotId, classId, subjectId] = lessonVal.split('::');
      const reason = String(data.get('reason') || '').trim();
      const proposal = String(data.get('proposal') || '').trim();

      const reqId = uid();
      await setDoc(doc(db, 'requests', reqId), {
        id: reqId,
        teacherEmail: currentUser.email.toLowerCase(),
        teacherId: currentUserProfile.teacherId || '',
        timeSlotId: timeSlotId || '',
        classId: classId || '',
        subjectId: subjectId || '',
        reason,
        proposal,
        status: 'PENDING',
        createdAt: new Date().toISOString()
      });

      toast('Đã gửi yêu cầu điều chỉnh lịch tới Người xếp lịch.');
      form.reset();
      render();
    } else if (form.id === 'respond-request-form') {
      const reqId = form.dataset.id;
      const decision = form.dataset.decision;
      const responseNote = String(data.get('responseNote') || '').trim();

      await updateDoc(doc(db, 'requests', reqId), {
        status: decision,
        responseNote,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.email
      });

      toast(`Đã ${decision === 'APPROVED' ? 'chấp thuận' : 'từ chối'} yêu cầu.`);
      dialog.close();
    } else if (form.id === 'edit-self-declared-form') {
      const subjects = data.getAll('subjects').map(s => String(s).trim());
      const note = String(data.get('note') || '').trim();

      await updateDoc(doc(db, 'users', currentUser.email.toLowerCase()), {
        'selfDeclared.subjects': subjects,
        'selfDeclared.note': note,
        updatedAt: new Date().toISOString()
      });

      toast('Đã cập nhật thông tin cá nhân.');
      dialog.close();
    }
  } catch (error) {
    const output = form.querySelector('#form-error');
    if (output) output.textContent = error.message;
    else toast(error.message);
  }
});

// Run initial connection test and start Auth listener
testConnection();
handleAuthState();
