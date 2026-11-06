// Grade 11 tracks have independent availability warnings.
import {createTeachingAttendanceView} from './teaching-attendance.js';
import {createInspectionView} from './inspection.js';
import {createLessonReportView} from './lesson-reports.js';
import {createAttendanceView} from './attendance.js';
import {createWeeklyMenu} from './weekly-menu.js';
import {matchesSuggestionSearch} from './suggestion-search.js';
import {publishedExcel} from './published-excel.js';
import {mondayOf,addDays,todayWeek,timetableWeek,weekCaption,weeklyRegistration,semesterKey,semesterRegistration,registrationSlotIndex,registrationForSlot,availabilityAlerts,newBusyAssignments} from './weekly-availability.js';
import {installPhoneApp} from './pwa.js';
import {showPushSettings,disableDevicePush} from './push-settings.js';
import {applyMoves} from './ai-proposal.js';
import {calendarEvents,upsertCalendar} from './calendar-sync.js';
import {authorizeCalendar,askScheduleAI} from './firebase.js';
import {cellLessons,allLessons,subjectTrack,subjectsForClass,lessonBusy,assertDailySubjectRules,assertSessionAndRoboticsRules} from './core.js';
import { saveDriveFile } from './drive-backup.js';
import { contentSignature } from './write-gate.js';
import {loadXlsx,html2canvas,sheetCanvasSize} from './export-libraries.js';
import { SEED } from './seed.js';
import {
  uid,
  clone,
  keyOf,
  findConflicts,
  putCell,
  assignSubstituteLesson,
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
  TEACHER_TEMPLATE_ROWS,
  filterRemovedFixedCells,
  isTeacherBusy,
  formatPublicationTime,
  publishDraft,
  restoreDraftFromPublished,
  assignLessonToScheduleCell,
  removeLessonFromScheduleCell,
  areTimetablesContentEqual,
  arePublishedContentEqual,
  areAvailabilitiesEqual,
  areUserProfilesEqual,
  isQuotaExhaustedError,
  computeExportFileName,
  TEACHER_COLORS_43,
  getTeacherColor,
  toggleCellLock,
  unlockAllFixedCells,
  jointPartner,
  assignSpecialActivity,
  resetMondayFlagCeremony,
  recordChange,
  undoChange,
  formatHistoryTime,
  getOnboardingSubjects
} from './core.js';
import {
  auth,
  db,
  googleProvider,
  signInWithPopup,
  fbSignOut,
  onAuthStateChanged,
  retryCloudReads,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  onSnapshot,
  handleFirestoreError,
  OperationType,
  testConnection,
  backup as cloudBackup,
  migrate as importMigration,
  authorizeDrive,
  saveWorkingDocument,
  isWriting,
  query as fsQuery,
  where,
  isQuotaExhausted,
  setQuotaExhausted,
  checkAndFlagQuotaError
} from './firebase.js';

function download(name,data,type='application/json'){
  const url=URL.createObjectURL(new Blob([data],{type}));
  const link=document.createElement('a');link.href=url;link.download=name;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const KEY = 'TKB_NEW_V1';
const OWNER_EMAIL = 'nmnhat.n98@gmail.com';

// ----------------------------------------------------
// Global State
// ----------------------------------------------------
let state = normalizeState(clone(SEED));
let workingDraft = normalizeState(clone(SEED));
let publishedTimetable = null;
let currentRevision = 1;
let serverConfirmedWorking = null;
let serverConfirmedAvailability = null;
let isSavingWorking = false;
let isGlobalSaving = false;
let authGeneration=0;
const pendingActions=new Set();
let aiProposal=null;


// Publishing Engine & Environment State
let activeVersion = 'draft'; // 'draft' | 'published'
let trayPosition = 'top'; // 'top' | 'right'
let traySelectedClassId = '';
let armedCard = null; // { classId: string, subjectId: string, teacherId: string } | null

// Workspaces: 'ADMIN' | 'SCHEDULER' | 'HOMEROOM' | 'VISITING' | 'TEACHER'
let currentWorkspace = 'ADMIN';
let view = 'matrix'; // active sub-view
let matrixFocusEnabled = true;
let matrixFocusTools = false;
let matrixViewMode = 'assignment'; // 'assignment' (Ma trận phân công Môn - Lớp) | 'timetable' (Tiết - Lớp)

// Lưu giữ và bảo toàn tọa độ cuộn cho cả 2 bản ma trận (Phân công Môn-Lớp & TKB Tiết-Lớp)
export const matrixScrollPositions = {
  assignment: { left: 0, top: 0 },
  timetable: { left: 0, top: 0 }
};
export let savedTrayScrollLeft = 0;
export let savedTrayScrollTop = 0;
export let savedWorkspaceScrollTop = 0;
export let savedWindowScrollX = 0;
export let savedWindowScrollY = 0;

export function recordCurrentScrollPositions() {
  const matrixContainer = document.querySelector('#matrix-scroll-container') || document.querySelector('.matrix-scroll');
  if (matrixContainer) {
    if (matrixViewMode === 'assignment') {
      matrixScrollPositions.assignment.left = matrixContainer.scrollLeft;
      matrixScrollPositions.assignment.top = matrixContainer.scrollTop;
    } else if (matrixViewMode === 'timetable') {
      matrixScrollPositions.timetable.left = matrixContainer.scrollLeft;
      matrixScrollPositions.timetable.top = matrixContainer.scrollTop;
    }
  }

  const trayContainer = document.querySelector('.tray-cards-container') || document.querySelector('.timetable-tray-sidebar');
  if (trayContainer) {
    savedTrayScrollLeft = trayContainer.scrollLeft;
    savedTrayScrollTop = trayContainer.scrollTop;
  }

  const workspace = document.querySelector('.workspace');
  if (workspace) {
    savedWorkspaceScrollTop = workspace.scrollTop;
  }

  if (typeof window !== 'undefined') {
    savedWindowScrollX = window.scrollX || window.pageXOffset || 0;
    savedWindowScrollY = window.scrollY || window.pageYOffset || 0;
  }
}

export function restoreCurrentScrollPositions() {
  const currentModePos = matrixScrollPositions[matrixViewMode];
  const matrixContainer = document.querySelector('#matrix-scroll-container') || document.querySelector('.matrix-scroll');
  if (matrixContainer && currentModePos) {
    matrixContainer.scrollLeft = currentModePos.left;
    matrixContainer.scrollTop = currentModePos.top;
  }

  const trayContainer = document.querySelector('.tray-cards-container') || document.querySelector('.timetable-tray-sidebar');
  if (trayContainer) {
    trayContainer.scrollLeft = savedTrayScrollLeft;
    trayContainer.scrollTop = savedTrayScrollTop;
  }

  const workspace = document.querySelector('.workspace');
  if (workspace && savedWorkspaceScrollTop > 0) {
    workspace.scrollTop = savedWorkspaceScrollTop;
  }

  if (typeof window !== 'undefined' && (savedWindowScrollX > 0 || savedWindowScrollY > 0)) {
    window.scrollTo(savedWindowScrollX, savedWindowScrollY);
  }

  if (typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(() => {
      const mc = document.querySelector('#matrix-scroll-container') || document.querySelector('.matrix-scroll');
      if (mc && currentModePos) {
        if (mc.scrollLeft !== currentModePos.left) mc.scrollLeft = currentModePos.left;
        if (mc.scrollTop !== currentModePos.top) mc.scrollTop = currentModePos.top;
      }
      const tc = document.querySelector('.tray-cards-container') || document.querySelector('.timetable-tray-sidebar');
      if (tc) {
        if (tc.scrollLeft !== savedTrayScrollLeft) tc.scrollLeft = savedTrayScrollLeft;
        if (tc.scrollTop !== savedTrayScrollTop) tc.scrollTop = savedTrayScrollTop;
      }
      if (typeof window !== 'undefined' && (savedWindowScrollX > 0 || savedWindowScrollY > 0)) {
        window.scrollTo(savedWindowScrollX, savedWindowScrollY);
      }
    });
  }
}

let brushTeacherId = '';
let brushMode = 'none'; // 'none' | 'brush' | 'eraser'
let selectedTeacherHighlight = '';
let grade = '';
let teacher = '';
let query = '';
let compact = true;
let showPublished = false;
let publishAndDataTab = 'all'; // 'all' | 'conflicts' | 'versions' | 'backup'
let classHubTab = 'timetable'; // 'timetable' | 'reports' | 'menu' | 'all'
let mobileMenuOpen = false;
const isMobileMenu = () => window.matchMedia('(max-width:760px)').matches;
function setMobileMenu(open) {
  mobileMenuOpen = Boolean(open);
  document.body.classList.toggle('mobile-menu-open', mobileMenuOpen);
  document.querySelector('#app-sidebar')?.classList.toggle('mobile-open',mobileMenuOpen);
  document.querySelector('.mobile-menu-backdrop')?.toggleAttribute('hidden',!mobileMenuOpen);
  document.querySelector('.topbar-menu-toggle')?.setAttribute('aria-expanded',String(mobileMenuOpen));
  document.querySelector('#app-sidebar')?.toggleAttribute('inert',isMobileMenu()&&!mobileMenuOpen);
}
window.addEventListener('resize',()=>setMobileMenu(false));
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&mobileMenuOpen){setMobileMenu(false);document.querySelector('.topbar-menu-toggle')?.focus();}});
let isSidebarCollapsed = (() => {
  try {
    return localStorage.getItem('vas_sidebar_collapsed') === 'true';
  } catch (e) {
    return false;
  }
})();

// Sub-view specific filters
let selectedHomeroomClassId = '';
let personalViewMode = 'week'; // 'week' | 'day'
let adminScheduleTeacherId='',adminScheduleSource='published',adminScheduleQuery='';
let homeroomExportTrack = 'XH'; // 'XH' | 'TN' | 'ALL'
let homeroomShowTeacher = false; // default false (pure subject name for student view)

// Auth & Permissions
let currentUser = null;
let currentUserProfile = null;
let authLoading = true;
let authError = '';
let profileReadError='';
let loginIntent = 'teacher'; // 'admin' | 'teacher'
let isSubmittingOnboarding = false;
let isEditingDeclaredProfile = false;

// Sync status
let syncStatus = 'idle'; // 'idle' | 'saving' | 'error' | 'offline'
let syncMessage = 'Đã kết nối Cloud';

// Realtime collections
let accountsList = [];
let requestsList = [];
let availabilityDoc = null;
let selectedAvailabilityWeek = '';
let selectedAvailabilityScope = '';
let schedulerRegistrationWeek = '';
let availabilityDrafts = new Map();
let availabilityRecords = [];
let availabilityLoadState = 'loading';
let unsubAllAvailability = null;

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
  attendance: 'Điểm danh học sinh',
  teaching_attendance: 'Điểm danh lớp có tiết dạy',
  inspection: 'Giám thị · Điểm danh toàn trường',
  overview: 'Tổng quan hệ thống',
  matrix: 'Thời khóa biểu toàn trường',
  teacher: 'Lịch giáo viên',
  publish_and_data: 'Kiểm tra & Công bố',
  conflicts: 'Kiểm tra xung đột',
  versions: 'Phiên bản & Bản đã chốt',
  catalog: 'Danh mục xếp lịch',
  accounts: 'Tài khoản & Phân quyền',
  pending: 'Hồ sơ chờ xác nhận',
  backup: 'Sao lưu & Khôi phục',
  school: 'Thông tin nhà trường',
  class_hub: 'TKB, Báo bài & Thực đơn',
  lesson_reports: 'Báo bài tuần',
  weekly_menu: 'Thực đơn tuần',
  homeroom_overview: 'Tổng quan lớp chủ nhiệm',
  homeroom_class: 'Thời khóa biểu lớp chủ nhiệm',
  my_teaching: 'Lịch giảng dạy cá nhân',
  teacher_schedules: 'Lịch dạy giáo viên',
  publication_history: 'Kho thời khóa biểu theo tuần',
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
  const focusStatus=document.querySelector('[data-focus-sync]');if(focusStatus)focusStatus.textContent=message||'Đã lưu Cloud';
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
function homeroomTeacherIds(cls){return [...new Set([cls.homeroomTeacherId,cls.coHomeroomTeacherId].filter(Boolean))];}
function officialHomeroomClassIds(){
  return [...new Set([...(currentUserProfile?.homeroomClassIds || []),...(state.classes || []).filter(c=>currentUserProfile?.teacherId && homeroomTeacherIds(c).includes(currentUserProfile.teacherId)).map(c=>c.id)])];
}
function isHomeroomTeacher() {
  return officialHomeroomClassIds().length > 0;
}
function isVisitingTeacher() {
  return !!currentUserProfile?.isVisiting;
}

function getAvailableWorkspaces() {
  if(currentUserProfile?.role==='INSPECTOR') return [{id:'INSPECTOR',label:'Giám thị'}];
  const ws = [];
  if (isAdmin()) ws.push({ id: 'ADMIN', label: 'Quản trị hệ thống' });
  if (isSchedulerRole()) ws.push({ id: 'SCHEDULER', label: 'Không gian xếp lịch' });
  if (isHomeroomTeacher()) ws.push({ id: 'HOMEROOM', label: 'Giáo viên chủ nhiệm' });
  if (isVisitingTeacher()) ws.push({ id: 'VISITING', label: 'Giáo viên thỉnh giảng' });
  if (currentUserProfile?.teacherId && !isVisitingTeacher()) ws.push({ id: 'TEACHER', label: 'Lịch giảng dạy cá nhân' });
  return ws;
}

function determineDefaultWorkspace() {
  if(currentUserProfile?.role==='INSPECTOR') return 'INSPECTOR';
  if (isAdmin()) return 'ADMIN';
  if (isSchedulerRole()) return 'SCHEDULER';
  if (isHomeroomTeacher()) return 'HOMEROOM';
  if (isVisitingTeacher()) return 'VISITING';
  return 'TEACHER';
}

function canEditWorking() {
  if(view==='publication_history')return false;
  return (currentWorkspace === 'ADMIN' || currentWorkspace === 'SCHEDULER') && activeVersion === 'draft' && !showPublished && isSchedulerRole();
}

// ----------------------------------------------------
// Firestore Sync & Actions
// ----------------------------------------------------
async function syncWorkingToCloud(nextState) {
  if(isSavingWorking){toast('Đang lưu. Vui lòng chờ hoàn tất rồi chọn tiếp.');return false;}
  if(typeof navigator!=='undefined'&&navigator.onLine===false){toast('Đang mất mạng. Chưa thay đổi lịch, hãy kết nối lại rồi thử.');return false;}
  if (!isSchedulerRole()) {
    toast('Chỉ Người xếp lịch hoặc Quản trị viên mới được cập nhật bản nháp.');
    return false;
  }
  if (isQuotaExhausted()) { toast('Hết hạn mức ghi. Hãy tải sao lưu JSON và thử lại khi hạn mức khôi phục.'); return false; }
  const busyWarnings=newBusyAssignments(workingDraft,nextState,availabilityRecords);
  if(busyWarnings.length&&!confirm('Giáo viên đã đăng ký bận trong tuần '+weekCaption(timetableWeek(nextState))+':\n'+availabilityWarningText(busyWarnings,nextState)+'\nVẫn xếp và lưu các tiết này?'))return false;
  const generation=authGeneration,saveStartedAt=Date.now();
  isSavingWorking=true;
  setSync('saving', 'Đang lưu lên Cloud...');
  try {
    validateState(nextState);
    assertSessionAndRoboticsRules(nextState,nextState.timetableCells,workingDraft.timetableCells);
    let normalized = normalizeState(nextState);
    if(serverConfirmedWorking && areTimetablesContentEqual(serverConfirmedWorking,normalized)) {
      workingDraft=normalized; state=clone(displayed());
      setSync('idle','Đã lưu Cloud (không đổi)'); return true;
    }
    let revision = (currentRevision || 0) + 1;
    const payload = {
      ...normalized,
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
      activeVersion: normalized.activeVersion || activeVersion,
      versions: normalized.versions || [],
      changeHistory: normalized.changeHistory || [],
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser?.email || 'admin'
    };
    const result=await saveWorkingDocument(payload,currentRevision);
    if(result.mergedData){normalized=normalizeState(clone(result.mergedData));revision=result.mergedData.revision||revision;}
    if(generation!==authGeneration)return false;
    if(currentRevision>revision){toast('Lịch đã có cập nhật mới hơn. Vui lòng thử lại.');return false;}
    if(!result.skipped)currentRevision = revision;
    serverConfirmedWorking=clone(normalized);
    workingDraft = normalized;
    if (activeVersion === 'draft') {
      state = clone(normalized);
    } else {
      state = clone(displayed());
    }
    setSync('idle', 'Đã lưu Cloud · '+((Date.now()-saveStartedAt)/1000).toFixed(1)+' giây');
    return true;
  } catch (error) {
    if(generation!==authGeneration)return false;
    handleFirestoreError(error, OperationType.WRITE, 'timetables/working');
    setSync('error', 'Lỗi lưu: ' + error.message);
    toast('Lỗi lưu Cloud: ' + error.message);
    return false;
  } finally {if(generation===authGeneration)isSavingWorking=false;}
}

async function publishToCloud() {
 if(isSavingWorking || isWriting()){toast('Vui lòng đợi lưu xong bản nháp.');return;}
  if (!isSchedulerRole()) return;
  if (isQuotaExhausted()) {
    toast('Hạn mức ghi Firestore đã hết (resource-exhausted). Không thể chốt lịch.');
    return;
  }
  const conflicts = findConflicts(workingDraft);
  if (conflicts.length) {
    toast('Còn lịch trùng giáo viên. Vui lòng xử lý trước khi chốt.');
    return;
  }

  if(!confirmWeeklyPublication())return;
  try{assertSessionAndRoboticsRules(workingDraft);}catch(error){toast(error.message);return;}
  const dataToPublish = {
    school: workingDraft.school,
    classes: workingDraft.classes,
    subjects: workingDraft.subjects,
    teachers: workingDraft.teachers,
    timeSlots: workingDraft.timeSlots,
    timetableCells: workingDraft.timetableCells,
    draftAssignments: workingDraft.draftAssignments || [],
    draftSchedule: workingDraft.draftSchedule || [],
    publishedAssignments: workingDraft.publishedAssignments || [],
    publishedSchedule: workingDraft.publishedSchedule || []
  };

  // 6. Không công bố lại lịch giống bản đã công bố: 0 ghi!
  if (publishedTimetable && publishedTimetable.isPublished && publishedTimetable.data) {
    if (arePublishedContentEqual(publishedTimetable.data, dataToPublish)) {
      toast('Thời khóa biểu hiện tại giống hệt bản đã chốt trên Cloud. Không cần ghi lại.');
      return;
    }
  }

  if (!confirm('Chốt bản đang xếp? Toàn trường và các giáo viên sẽ xem được bản này.')) return;

  setSync('saving', 'Đang chốt lịch...');
  try {
    const payload = {
      isPublished: true,
      name: `Bản chốt ${fmt(new Date())}`,
      publishedAt: new Date().toISOString(),
      publishedBy: currentUser?.email || 'admin',
      data: dataToPublish
    };
    await setDoc(doc(db, 'timetables', 'published'), payload);
    publishedTimetable = payload;
    setSync('idle', 'Đã chốt lịch thành công');
    toast('Đã chốt lịch toàn trường lên Cloud.');
  } catch (error) {
    if (checkAndFlagQuotaError(error)) {
      setSync('error', 'Hết hạn mức Cloud (Resource Exhausted)');
      toast('Hạn mức Firestore đã hết. Hãy tải sao lưu JSON.');
      render();
      return;
    }
    handleFirestoreError(error, OperationType.WRITE, 'timetables/published');
    setSync('error', 'Lỗi chốt lịch');
  }
}

async function unpublishFromCloud() {
 if(isSavingWorking || isWriting()){toast('Vui lòng đợi lưu xong bản nháp.');return;}
  if (!isSchedulerRole()) return;
  if (isQuotaExhausted()) {
    toast('Hạn mức ghi Firestore đã hết (resource-exhausted). Không thể gỡ chốt.');
    return;
  }
  // 6. Không ghi lại nếu đã gỡ chốt trước đó: 0 ghi!
  if (!publishedTimetable || !publishedTimetable.isPublished) {
    toast('Thời khóa biểu hiện chưa được công bố hoặc đã gỡ trước đó.');
    return;
  }
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
    publishedTimetable = null;
    setSync('idle', 'Đã gỡ bản chốt');
    toast('Đã gỡ bản đã chốt.');
    showPublished = false;
    render();
  } catch (error) {
    if (checkAndFlagQuotaError(error)) {
      setSync('error', 'Hết hạn mức Cloud (Resource Exhausted)');
      render();
      return;
    }
    handleFirestoreError(error, OperationType.WRITE, 'timetables/published');
    setSync('error', 'Lỗi gỡ chốt');
  }
}

// ----------------------------------------------------
// Realtime Data Subscriptions
// ----------------------------------------------------
function stopAllSubscriptions() {
  if(unsubAllAvailability){unsubAllAvailability();unsubAllAvailability=null;}
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
        if (publishedTimetable?.data) {
          publishedTimetable.data = normalizeState(publishedTimetable.data);
        }
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

  // Inspectors need the published school header and attendance only.
  if(currentUserProfile?.role==='INSPECTOR')return;

  // 2. Working timetable listener (SCHEDULER / ADMIN / OWNER)
  if (isSchedulerRole()) {
    unsubWorking = onSnapshot(
      doc(db, 'timetables', 'working'),
      snap => {
        if(isSavingWorking)return;
        // 3. Không tự tạo bản nháp khi mở trang. Chỉ lưu khi người dùng chủ động thay đổi dữ liệu: 0 ghi!
        if (!snap.exists()) {
          currentRevision = 0;
          serverConfirmedWorking = null;
          workingDraft = normalizeState(clone(SEED));
          if (!showPublished && (currentWorkspace === 'ADMIN' || currentWorkspace === 'SCHEDULER')) {
            state = clone(workingDraft);
          }
          setSync('idle', 'Dùng bản mẫu (chưa lưu Cloud)');
          render();
          return;
        }

        const data = snap.data();
        currentRevision = data.revision || 1;
        const rawCells = data.timetableCells || [];
        const cleanedCells = filterRemovedFixedCells(rawCells);

        // Lưu bản ghi nhận dạng chuẩn từ server để so sánh trước khi ghi
        serverConfirmedWorking = normalizeState({
          ...data,
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

        // 2. Bỏ thao tác tự ghi trong onSnapshot. Đọc dữ liệu, lọc ô cũ, chuẩn hóa và render: 0 ghi!
        workingDraft = clone(serverConfirmedWorking);
        if (snap.metadata?.hasPendingWrites || snap.metadata?.fromCache) serverConfirmedWorking = null;

        if (!showPublished && (currentWorkspace === 'ADMIN' || currentWorkspace === 'SCHEDULER')) {
          state = clone(workingDraft);
        }
        setSync('idle', 'Đã lưu Cloud');
        render();
      },
      err => {
        if (checkAndFlagQuotaError(err)) {
          setSync('error', 'Hết hạn mức Cloud (Resource Exhausted)');
          render();
          return;
        }
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
      err => {
        if (checkAndFlagQuotaError(err)) {
          setSync('error', 'Hết hạn mức Cloud');
          render();
          return;
        }
        handleFirestoreError(err, OperationType.LIST, 'users');
      }
    );
  }

  // 4. Requests listener (Schedulers read all, Teachers read their own)
  unsubRequests = onSnapshot(
    isSchedulerRole() ? collection(db, 'requests') : fsQuery(collection(db, 'requests'), where('teacherEmail', '==', currentUser.email.toLowerCase().trim())),
    snap => {
      requestsList = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(r => r && r.id && !r.testOnly && !r.id.startsWith('__trial_connection'));
      requestsList.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      render();
    },
    err => {
      if (checkAndFlagQuotaError(err)) {
        setSync('error', 'Hết hạn mức Cloud');
        render();
        return;
      }
      handleFirestoreError(err, OperationType.LIST, 'requests');
    }
  );

  if(isSchedulerRole()){
    availabilityLoadState='loading';
    unsubAllAvailability=onSnapshot(collection(db,'availabilities'),snap=>{
      const openPopover=snapshotTimetablePopover(),wasReady=availabilityLoadState==='ready',oldBusy=new Set(availabilityAlerts(workingDraft,availabilityRecords).busy.map(x=>JSON.stringify([x.teacherId,x.cell.classId,x.cell.timeSlotId])));
      availabilityRecords=snap.docs.map(d=>({id:d.id,...d.data()}));availabilityLoadState='ready';render();restoreTimetablePopover(openPopover);
      const newlyBusy=availabilityAlerts(workingDraft,availabilityRecords).busy.filter(x=>!oldBusy.has(JSON.stringify([x.teacherId,x.cell.classId,x.cell.timeSlotId])));if(wasReady&&newlyBusy.length)toast('Có '+newlyBusy.length+' tiết đã xếp trùng đăng ký bận mới. Các ô đã được đánh dấu BẬN để kiểm tra.');
    },error=>{availabilityLoadState='error';render();});
  }
  // 5. Personal availability listener for every authorized teacher
  if (currentUser?.email) {
    unsubAvailability = onSnapshot(
      doc(db, 'availabilities', currentUser.email.toLowerCase()),
      snap => {
        availabilityDoc = snap.exists() ? snap.data() : null;
        serverConfirmedAvailability = !snap.metadata?.hasPendingWrites && !snap.metadata?.fromCache && availabilityDoc ? clone(availabilityDoc) : null;
        render();
      },
      err => {
        if (checkAndFlagQuotaError(err)) {
          setSync('error', 'Hết hạn mức Cloud');
          render();
          return;
        }
        handleFirestoreError(err, OperationType.GET, `availabilities/${currentUser.email}`);
      }
    );
  }
}

// ----------------------------------------------------
// Authentication Handler
// ----------------------------------------------------
function handleAuthState() {
  onAuthStateChanged(auth, async user => {
    const generation = ++authGeneration;
    isSavingWorking=false;aiProposal=null;calendarPreview=null;
    profileReadError='';
    stopAllSubscriptions();
    if (unsubUser) {unsubUser(); unsubUser=null;}
    currentUserProfile=null;
    adminScheduleTeacherId='';adminScheduleSource='published';adminScheduleQuery='';
    publicationHistory={identity:'',items:null,selected:'',publication:null,loading:false,error:'',generation:publicationHistory.generation+1};
    accountsList=[]; requestsList=[]; availabilityDoc=null;availabilityRecords=[];availabilityDrafts=new Map();selectedAvailabilityWeek='';selectedAvailabilityScope='';schedulerRegistrationWeek='';availabilityLoadState='loading';
    serverConfirmedWorking=null; serverConfirmedAvailability=null;
    publishedTimetable=null; currentRevision=0;
    workingDraft=normalizeState(clone(SEED)); state=clone(workingDraft);
    activeVersion='draft'; showPublished=false;
    authLoading = Boolean(user);
    currentUser = user;
    render();
    if (!user) {
      currentUserProfile = null;
      stopAllSubscriptions();
      if (unsubUser) { unsubUser(); unsubUser = null; }
      render();
      return;
    }

    const email = (user.email || '').toLowerCase().trim();

    // Bootstrap OWNER if matching email and quota not exhausted
    if (email === OWNER_EMAIL && !isQuotaExhausted()) {
      try {
        const uDoc = await getDoc(doc(db, 'users', email));
        if(generation!==authGeneration)return;
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
        checkAndFlagQuotaError(e);
        console.warn('Owner bootstrap check:', e);
      }
    }

    if (generation !== authGeneration) return;
    // Subscribe to current user profile
    if (unsubUser) unsubUser();
    unsubUser = onSnapshot(
      doc(db, 'users', email),
      docSnap => {
        if(generation!==authGeneration)return;
        profileReadError='';
        authLoading=false;
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

        const previousAccess = currentUserProfile ? JSON.stringify([currentUserProfile.active,currentUserProfile.role,currentUserProfile.teacherId,currentUserProfile.homeroomClassIds,currentUserProfile.isVisiting]) : null;
        const nextAccess = JSON.stringify([data.active,data.role,data.teacherId,data.homeroomClassIds,data.isVisiting]);
        const isFirstLoad = previousAccess !== nextAccess;
        currentUserProfile = data;

        if (isFirstLoad) {
          currentWorkspace = determineDefaultWorkspace();
          view = currentWorkspace === 'INSPECTOR' ? 'inspection' : currentWorkspace === 'HOMEROOM' ? 'homeroom_overview' : currentWorkspace === 'VISITING' ? 'visiting_overview' : currentWorkspace === 'TEACHER' ? 'my_teaching' : currentWorkspace === 'ADMIN' ? 'overview' : 'matrix';
          if(new URLSearchParams(location.search).get('open')==='my_teaching'&&data.teacherId&&data.role!=='INSPECTOR'){currentWorkspace='TEACHER';view='my_teaching';history.replaceState(null,'',location.pathname);}
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
        if(generation!==authGeneration)return;
        authLoading=false;
        profileReadError=['unavailable',20,'20'].includes(err.code)||err.name==='AbortError'||err.name==='TimeoutError'
          ? 'Kết nối bị gián đoạn khi tải tài khoản. App sẽ tự thử lại khi có mạng. Bạn cũng có thể bấm Thử lại bên dưới.'
          : 'Chưa tải được hồ sơ tài khoản. Hãy bấm Thử lại. Nếu lỗi tiếp diễn, vui lòng liên hệ quản trị viên. ('+(err.code || 'unknown')+')';
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
function emptyTeacherTimetable(){return normalizeState({school:{},classes:[],subjects:[],teachers:[],timeSlots:[],timetableCells:[],activeVersion:'published'});}
function displayed() {
  if (currentWorkspace !== 'ADMIN' && currentWorkspace !== 'SCHEDULER') {
    return publishedTimetable?.isPublished&&publishedTimetable?.data?normalizeState(publishedTimetable.data):emptyTeacherTimetable();
  }
  if (activeVersion === 'published' || showPublished) {
    if (publishedTimetable?.data) return normalizeState(publishedTimetable.data);
    const pState = clone(workingDraft);
    pState.timetableCells = (workingDraft.publishedSchedule && workingDraft.publishedSchedule.length > 0)
      ? workingDraft.publishedSchedule
      : [];
    pState.draftAssignments = (workingDraft.publishedAssignments && workingDraft.publishedAssignments.length > 0)
      ? workingDraft.publishedAssignments
      : [];
    return pState;
  }
  return workingDraft;
}

function getTeacherLessons(teacherId, sourceData = displayed()) {
  if (!teacherId || !sourceData?.timetableCells) return [];
  return allLessons(sourceData)
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
  const pendingRequests = requestsList.filter(r => r.status === 'PENDING');

  const adminMenu = [
    ['overview', '📊', 'Tổng quan'],
    ['attendance', '✅', 'Điểm danh & Học sinh'],
    ['inspection','📋','Giám thị · Thống kê điểm danh'],
    ['matrix', '▦', 'Ma trận toàn trường'],
    ['publication_history', '🗂️', 'Kho TKB theo tuần'],
    ['teacher_schedules', '◷', 'Lịch dạy giáo viên'],
    ['class_hub', '🖼️', `TKB, Báo bài & Thực đơn ${lessonReportsView.badge() ? `<b class="badge">${lessonReportsView.badge()}</b>` : ''}`],
    ['catalog', '▤', 'Danh mục xếp lịch'],
    ['accounts', '👥', 'Tài khoản & Phân quyền'],
    ['pending', '📋', `Hồ sơ chờ xác nhận ${pendingProfiles.length ? `<b class="badge">${pendingProfiles.length}</b>` : ''}`],
    ['teacher_requests', '📩', `Yêu cầu đổi lịch ${pendingRequests.length ? `<b class="badge">${pendingRequests.length}</b>` : ''}`],
    ['publish_and_data', '▱', `Kiểm tra & Công bố ${conflicts.length ? `<b class="badge">${conflicts.length}</b>` : ''}`],
    ['school', '🏫', 'Thông tin trường']
  ];

  return {
    menu: adminMenu,
    content: () => {
      if (view === 'overview') {
        return `
          <div class="dashboard-hero">
            <span class="hero-tag">BẢNG ĐIỀU KHIỂN QUẢN TRỊ</span>
            <h2>Xin chào, ${esc(currentUserProfile?.displayName || currentUser?.email)}</h2>
            <p>Hệ thống thời khóa biểu toàn trường đang hoạt động. Cập nhật mới nhất lúc: ${esc(fmt(workingDraft.updatedAt))}.</p>
            <div class="hero-tags">
              <span class="hero-tag">Trường: ${esc(state.school?.name || 'Trường THCS & THPT')}</span>
              <span class="hero-tag">${esc(state.school?.year || '2026-2027')} · ${esc(state.school?.term || 'HK1')}</span>
              <span class="hero-tag">Bản chốt: ${publishedTimetable?.isPublished ? 'Đang công bố ✓' : 'Chưa công bố'}</span>
            </div>
          </div>

          <section class="stats">
            <div><span class="stat-icon">▤</span><div class="stat-content"><strong>${s.classes?.length || 0}</strong><span>Lớp học</span></div></div>
            <div><span class="stat-icon">♙</span><div class="stat-content"><strong>${s.teachers?.length || 0}</strong><span>Giáo viên</span></div></div>
            <div><span class="stat-icon">📚</span><div class="stat-content"><strong>${s.subjects?.length || 0}</strong><span>Môn học</span></div></div>
            <div class="${conflicts.length ? 'warning-stat' : ''}"><span class="stat-icon">◎</span><div class="stat-content"><strong>${conflicts.length ? conflicts.length : 'Không có'}</strong><span>Lịch trùng cần xử lý</span></div></div>
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
                        Môn giảng dạy: ${esc(p.selfDeclared?.subjects?.join(', ') || 'Chưa chọn')}<br>
                        Lớp chủ nhiệm: ${esc(p.selfDeclared?.homeroomClassId ? text(state.classes || [], p.selfDeclared.homeroomClassId) : 'Không chủ nhiệm')}
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

            <div class="card" style="grid-column: 1 / -1; border-top: 3px solid ${pendingRequests.length ? '#f59e0b' : '#184239'};">
              <div class="card-title">
                <h2>Yêu cầu điều chỉnh thời khóa biểu từ Giáo viên (${pendingRequests.length})</h2>
                <button data-view="teacher_requests" class="${pendingRequests.length ? 'primary' : ''}">Xem & Xử lý</button>
              </div>
              ${
                pendingRequests.length
                  ? `
                <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:12px;margin-top:10px;">
                  ${pendingRequests.slice(0, 4).map(r => `
                    <div class="request-card" style="margin:0;border-left:4px solid #f59e0b;background:#fffbeb;">
                      <div class="req-header">
                        <strong>${esc(r.teacherName || r.teacherEmail || 'Giáo viên')}</strong>
                        <span class="req-status pending">Chờ xử lý</span>
                      </div>
                      <div class="req-body" style="font-size:12px;">
                        ${r.lessonSummary ? `<div><strong>Tiết:</strong> ${esc(r.lessonSummary)}</div>` : ''}
                        <strong>Lý do:</strong> ${esc(r.reason || '—')}<br>
                        <strong>Đề xuất:</strong> ${esc(r.proposal || '—')}
                      </div>
                      <div style="margin-top:8px;display:flex;gap:6px;">
                        <button data-action="respond-request" data-id="${esc(r.id)}" data-decision="APPROVED" class="primary" style="font-size:11px;padding:4px 8px;">Chấp thuận</button>
                        <button data-action="respond-request" data-id="${esc(r.id)}" data-decision="REJECTED" class="danger-link" style="font-size:11px;padding:4px 8px;">Từ chối</button>
                      </div>
                    </div>
                  `).join('')}
                </div>
              `
                  : '<p class="muted">Không có yêu cầu điều chỉnh nào đang chờ xử lý từ giáo viên.</p>'
              }
            </div>
          </div>
        `;
      }
      if (view === 'publication_history') return renderPublicationHistory();
      if (view === 'matrix') return renderMatrixSection(s);
      if (view === 'teacher_schedules') return renderAdminTeacherSchedules();
      if (view === 'catalog') return catalog();
      if (view === 'accounts') return accountsPage();
      if (view === 'pending') return renderPendingProfilesPage(pendingProfiles);
      if (view === 'teacher_requests') return renderSchedulerTeacherRequests();
      if (view === 'publish_and_data' || view === 'conflicts' || view === 'versions' || view === 'backup') return renderPublishAndDataPage();
      if (view === 'school') return renderSchoolPage();
      if (view === 'class_hub' || view === 'homeroom_class' || view === 'weekly_menu' || view === 'lesson_reports') return renderClassHubPage(s.classes || []);
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
    ['publication_history', '🗂️', 'Kho TKB theo tuần'],
    ['class_hub', '🖼️', `TKB, Báo bài & Thực đơn ${lessonReportsView.badge() ? `<b class="badge">${lessonReportsView.badge()}</b>` : ''}`],
    ['catalog', '▤', 'Danh mục xếp lịch'],
    ['teacher_requests', '📩', `Yêu cầu đổi lịch ${requestsList.filter(r => r.status === 'PENDING').length ? `<b class="badge">${requestsList.filter(r => r.status === 'PENDING').length}</b>` : ''}`],
    ['publish_and_data', '▱', `Kiểm tra & Công bố ${conflicts.length ? `<b class="badge">${conflicts.length}</b>` : ''}`],
    ...(currentUserProfile?.teacherId ? [['my_teaching', '◷', 'Lịch dạy cá nhân'], ['availability', '📅', 'Đăng ký rảnh / bận']] : [])
  ];

  return {
    menu: schedulerMenu,
    content: () => {
      if (view === 'publication_history') return renderPublicationHistory();
      if (view === 'matrix') return renderMatrixSection(s);
      if (view === 'class_hub' || view === 'homeroom_class' || view === 'weekly_menu' || view === 'lesson_reports') return renderClassHubPage(s.classes || []);
      if (view === 'catalog') return catalog();
      if (view === 'teacher_requests') return renderSchedulerTeacherRequests();
      if (view === 'publish_and_data' || view === 'conflicts' || view === 'versions' || view === 'backup') return renderPublishAndDataPage();
      if (view === 'my_teaching') return renderMyTeachingView();
      if (view === 'availability') return renderAvailabilityView();
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
  const homeroomIds = officialHomeroomClassIds();
  const homeroomClasses = (state.classes || []).filter(c => homeroomIds.includes(c.id));
  const todayDay = getTodayDayOfWeek();

  const myLessons = getTeacherLessons(teacherId, publishedTimetable?.data);
  const todayMyLessons = myLessons.filter(l => l.slot?.dayOfWeek === todayDay);

  const homeroomMenu = [
    ['teaching_attendance','✅','Điểm danh lớp có tiết dạy'],
    ['homeroom_overview', '🏠', 'Tổng quan chủ nhiệm'],
    ['attendance', '✅', 'Điểm danh học sinh'],
    ['class_hub', '🖼️', `TKB, Báo bài & Thực đơn ${lessonReportsView.badge() ? `<b class="badge">${lessonReportsView.badge()}</b>` : ''}`],
    ['my_teaching', '◷', 'Lịch dạy cá nhân'],
    ['availability', '📅', 'Đăng ký rảnh / bận'],
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
            <p>Lớp chủ nhiệm: <strong>${esc(homeroomClasses.map(c => c.name).join(', ') || 'Chưa gán')}</strong><br>Môn giảng dạy: ${esc(currentUserProfile?.selfDeclared?.subjects?.join(', ') || '—')}</p>
            <div class="hero-tags">
              <span class="hero-tag">Tiết dạy hôm nay (Thứ ${todayDay}): ${todayMyLessons.length} tiết</span>
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
                <button data-view="class_hub" class="primary">Mở lịch & Báo bài</button>
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
      if (view === 'class_hub' || view === 'homeroom_class' || view === 'weekly_menu' || view === 'lesson_reports') return renderClassHubPage(homeroomClasses);
      if (view === 'my_teaching') return renderMyTeachingView();
      if (view === 'availability') return renderAvailabilityView();
      if (view === 'published_all') return renderMatrixSection(displayed());
      if (view === 'profile') return renderMyProfileView();
      if (view === 'submit_request') return renderTeacherRequestSubmission();
      return renderClassHubPage(homeroomClasses);
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
  const userEmail = (currentUser?.email || '').toLowerCase().trim();
  const myRequests = requestsList.filter(r => (r.teacherEmail || '').toLowerCase().trim() === userEmail);

  const visitingMenu = [
    ['teaching_attendance','✅','Điểm danh lớp có tiết dạy'],
    ['visiting_overview', '⚡', 'Tổng quan thỉnh giảng'],
    ['my_teaching', '◷', 'Lịch dạy cá nhân'],
    ['availability', '📅', 'Đăng ký rảnh / bận'],
    ['class_hub', '🖼️', `Báo bài ${lessonReportsView.badge() ? `<b class="badge">${lessonReportsView.badge()}</b>` : ''}`],
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
          <p>Lớp chủ nhiệm: <strong>${esc(officialHomeroomClassIds().map(id => text(state.classes || [], id)).join(', ') || 'Không chủ nhiệm')}</strong><br>Môn giảng dạy: ${esc(currentUserProfile?.selfDeclared?.subjects?.join(', ') || '—')}</p>
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
                Đã đăng ký: <strong>${weeklyRegistration(availabilityDoc,availabilityWeek(),publishedTimetable?.data||state)?.availableSlotIds?.length || 0} tiết rảnh</strong> · <strong>${weeklyRegistration(availabilityDoc,availabilityWeek(),publishedTimetable?.data||state)?.busySlotIds?.length || 0} tiết bận</strong><br>
                Ghi chú: ${esc(weeklyRegistration(availabilityDoc,availabilityWeek(),publishedTimetable?.data||state)?.note || 'Không có')}
              </div>
            </div>
          </div>
        `;
      }
      if (view === 'my_teaching') return renderMyTeachingView();
      if (view === 'availability') return renderAvailabilityView();
      if (view === 'class_hub' || view === 'homeroom_class' || view === 'weekly_menu' || view === 'lesson_reports') return renderClassHubPage(state.classes || []);
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
    ['teaching_attendance','✅','Điểm danh lớp có tiết dạy'],
    ['my_teaching', '◷', 'Lịch dạy cá nhân'],
    ['availability', '📅', 'Đăng ký rảnh / bận'],
    ['class_hub', '🖼️', `TKB, Báo bài & Thực đơn ${lessonReportsView.badge() ? `<b class="badge">${lessonReportsView.badge()}</b>` : ''}`],
    ['published_all', '▦', 'TKB toàn trường đã chốt'],
    ['submit_request', '✉️', 'Gửi yêu cầu điều chỉnh'],
    ['profile', '👤', 'Hồ sơ của tôi']
  ];

  return {
    menu: teacherMenu,
    content: () => {
      if (view === 'my_teaching') return renderMyTeachingView();
      if (view === 'availability') return renderAvailabilityView();
      if (view === 'class_hub' || view === 'homeroom_class' || view === 'weekly_menu' || view === 'lesson_reports') return renderClassHubPage(state.classes || []);
      if (view === 'published_all') return renderMatrixSection(displayed());
      if (view === 'submit_request') return renderTeacherRequestSubmission();
      if (view === 'profile') return renderMyProfileView();
      return renderMyTeachingView();
    }
  };
}

// ----------------------------------------------------
// Sub-view: TKB Lớp học & Lớp chủ nhiệm (Khung chuẩn VASchools)
// ----------------------------------------------------
function renderHomeroomClassTimetable(homeroomClasses) {
  if(!isSchedulerRole()&&!publishedTimetable?.isPublished)return '<div class="card"><h2>Chưa có thời khóa biểu hiện hành</h2><p>Nhà trường chưa công bố hoặc đã thu hồi lịch. Lịch mới sẽ tự cập nhật sau khi công bố.</p></div>';
  const pData = (publishedTimetable && publishedTimetable.isPublished && publishedTimetable.data)
    ? publishedTimetable.data
    : (state || workingDraft);

  const availableClasses = (homeroomClasses && homeroomClasses.length > 0)
    ? homeroomClasses
    : (pData.classes || state.classes || []);

  if (!availableClasses.length) {
    return `
      <div class="card" style="text-align:center;padding:50px 20px;">
        <span style="font-size:36px;display:block;margin-bottom:12px;">📅</span>
        <h2>Chưa có danh sách lớp</h2>
        <p>Hệ thống chưa ghi nhận thông tin lớp học nào trong danh mục.</p>
      </div>
    `;
  }

  const activeClassId = selectedHomeroomClassId || availableClasses[0]?.id;
  const currentClass = availableClasses.find(c => c.id === activeClassId) || availableClasses[0];
  const isGrade11 = (currentClass.grade === 11) || /\b11\b/.test(currentClass.name || '') || /\b11\b/.test(currentClass.code || '');

  const hrTeacher = (pData.teachers || state.teachers || []).find(t => t.id === currentClass.homeroomTeacherId);
  const hrTeacherName = homeroomTeacherIds(currentClass).map(id=>(pData.teachers || state.teachers || []).find(t=>t.id===id)?.fullName).filter(Boolean).join(' · ');

  const weekBadgeText = posterWeekInfo(pData.school).caption;

  let classTitleText = `LỚP ${esc(currentClass.name.replace(/^Lớp\s*/i, ''))}`;
  if (isGrade11) {
    if (homeroomExportTrack === 'XH') {
      classTitleText = 'LỚP 11 - BAN XÃ HỘI';
    } else if (homeroomExportTrack === 'TN') {
      classTitleText = 'LỚP 11 - BAN TỰ NHIÊN';
    } else {
      classTitleText = 'LỚP 11 (TỰ NHIÊN & XÃ HỘI)';
    }
  }

  function getSlotLessons(day, session, period) {
    const slot = (pData.timeSlots || []).find(s => s.dayOfWeek === day && s.session === session && s.period === period);
    if (!slot) return [];
    const cell = (pData.timetableCells || []).find(c => c.classId === currentClass.id && c.timeSlotId === slot.id) ||
                 (pData.publishedSchedule || []).find(c => c.classId === currentClass.id && c.timeSlotId === slot.id);
    if (!cell) return [];
    let list = cellLessons(pData, cell);
    if (isGrade11) {
      if (homeroomExportTrack === 'XH') {
        list = list.filter(l => l.track === 'XH' || l.track === 'COMMON' || !l.track);
      } else if (homeroomExportTrack === 'TN') {
        list = list.filter(l => l.track === 'TN' || l.track === 'COMMON' || !l.track);
      }
    }
    return list;
  }

  const morningDefs = [
    { period: 1, label: 'Tiết 1', time: '(7h45 - 8h30)' },
    { period: 2, label: 'Tiết 2', time: '(8h30 - 9h15)' },
    { period: 3, label: 'Tiết 3', time: '(9h15 - 10h00)' },
    { period: 4, label: 'Tiết 4', time: '(10h20 - 11h05)' },
    { period: 5, label: 'Tiết 5', time: '(11h05 - 11h50)' }
  ];

  const afternoonDefs = [
    { period: 1, label: 'Tiết 1', time: '(13h30 - 14h10)' },
    { period: 2, label: 'Tiết 2', time: '(14h10 - 14h50)' },
    { period: 3, label: 'Tiết 3', time: '(15h10 - 15h50)' },
    { period: 4, label: 'Tiết 4', time: '(15h30 - 16h30)' },
    { period: 5, label: 'Phụ đạo', time: '(17h00 - 18h30)' }
  ];

  function renderRow(def, session) {
    let cellsHtml = '';
    for (let day = 2; day <= 6; day++) {
      const lessons = getSlotLessons(day, session, def.period);
      cellsHtml += `
        <td style="border:1.5px solid #8C0D36;background:#ffffff;text-align:center;vertical-align:middle;padding:8px 4px;height:48px;">
          ${lessons.length ? lessons.map(l => {
            const sName = text(pData.subjects || [], l.subjectId, 'name');
            const tName = text(pData.teachers || [], l.teacherId, 'fullName');
            return `
              <div style="font-weight:700;color:#8C0D36;font-size:14px;line-height:1.25;">
                ${esc(sName)}
              </div>
              ${homeroomShowTeacher && tName ? `
                <div style="font-size:11px;color:#555555;font-weight:normal;margin-top:2px;">
                  ${esc(tName)}
                </div>
              ` : ''}
            `;
          }).join('<div style="height:4px;border-top:1px dashed #e6b8c4;margin:3px 0;"></div>') : '&nbsp;'}
        </td>
      `;
    }
    return `
      <tr>
        <td style="border:1.5px solid #8C0D36;background:#ffffff;text-align:center;vertical-align:middle;padding:6px 4px;font-weight:700;color:#8C0D36;font-size:14px;line-height:1.2;">
          ${esc(def.label)}<br>
          <span style="font-size:12px;font-weight:600;">${esc(def.time)}</span>
        </td>
        ${cellsHtml}
      </tr>
    `;
  }

  return `
    <section class="matrix-panel student-timetable-section" style="padding-bottom:30px;">
      <!-- Toolbar Điều khiển -->
      <div class="panel-toolbar student-poster-toolbar" style="flex-wrap:wrap;gap:14px;background:#ffffff;padding:12px 18px;border-radius:10px;box-shadow:0 1px 4px rgba(0,0,0,0.06);margin-bottom:20px;align-items:center;">
        <div style="display:flex;align-items:center;gap:8px;">
          <label style="font-size:12px;font-weight:700;color:#184239;">LỚP HỌC:</label>
          <select id="homeroom-class-select" style="font-weight:700;padding:6px 12px;border:1.5px solid #8C0D36;border-radius:6px;color:#8C0D36;background:#ffffff;cursor:pointer;">
            ${availableClasses.map(c => `<option value="${esc(c.id)}" ${c.id === currentClass.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
          </select>
        </div>

        ${isGrade11 ? `
          <div style="display:flex;align-items:center;gap:8px;">
            <label style="font-size:12px;font-weight:700;color:#184239;">TỔ HỢP / BAN:</label>
            <select id="homeroom-track-select" style="font-weight:700;padding:6px 12px;border:1.5px solid #8C0D36;border-radius:6px;color:#8C0D36;background:#ffffff;cursor:pointer;">
              <option value="XH" ${homeroomExportTrack === 'XH' ? 'selected' : ''}>Ban Xã hội (XH)</option>
              <option value="TN" ${homeroomExportTrack === 'TN' ? 'selected' : ''}>Ban Tự nhiên (TN)</option>
              <option value="ALL" ${homeroomExportTrack === 'ALL' ? 'selected' : ''}>Toàn bộ (Cả 2 ban)</option>
            </select>
          </div>
        ` : ''}

        <label style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:#333333;cursor:pointer;user-select:none;">
          <input type="checkbox" id="poster-show-teacher-toggle" ${homeroomShowTeacher ? 'checked' : ''} style="cursor:pointer;accent-color:#8C0D36;" />
          Hiển thị tên Giáo viên
        </label>

        <div class="toolbar-right student-poster-actions" style="margin-left:auto;display:flex;align-items:center;gap:10px;">
          <button data-action="poster-drive">☁ Lưu ảnh lên Drive</button><button data-action="export-timetable-image" style="background:#8C0D36;color:#ffffff;border:none;padding:9px 18px;border-radius:8px;font-weight:700;font-size:13px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;box-shadow:0 2px 6px rgba(140,13,54,0.25);">
            📸 Tải ảnh TKB về máy (.JPG)
          </button>
          <button data-action="print-poster" style="background:#f0f4eb;color:#184239;border:1px solid #c2ceb9;padding:9px 15px;border-radius:8px;font-weight:600;font-size:13px;cursor:pointer;">
            🖨️ In Thời khóa biểu
          </button>
        </div>
      </div>

      <!-- Khung Poster Mẫu VASchools (Chính xác theo mẫu ảnh) -->
      <div style="overflow-x:auto;padding:10px 0;">
        <div id="vaschools-timetable-poster" style="background:#ffffff;border:3.5px solid #8C0D36;border-radius:18px;padding:26px 32px 22px 32px;max-width:980px;min-width:860px;margin:0 auto;box-sizing:border-box;font-family:'Times New Roman',Times,serif,system-ui,sans-serif;color:#1a1a1a;box-shadow:0 4px 24px rgba(140,13,54,0.08);">
          
          <!-- Header Poster: Logo bên trái, Tiêu đề & Tuần ở giữa, Cân đối bên phải (ĐÃ BỎ ĐỐI TƯỢNG NHÂN VẬT) -->
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">
            <!-- Logo VASchools bên trái -->
            <div style="width:230px;flex-shrink:0;display:flex;align-items:center;">
              <img src="/assets/aistudio/VA_SCHOOLS_-_Logo_Assets_-_RGB-02_c3498fbd.png" alt="Vietnam America Schools" style="height:66px;max-width:230px;object-fit:contain;" />
            </div>

            <!-- Tiêu đề & Tuần & Lớp học ở trung tâm -->
            <div style="flex:1;text-align:center;padding:0 12px;">
              <h1 style="margin:0;font-size:32px;font-weight:800;color:#8C0D36;letter-spacing:0.5px;text-transform:uppercase;line-height:1.15;">
                THỜI KHÓA BIỂU
              </h1>
              <div style="margin-top:6px;">
                <span style="display:inline-block;background:#8C0D36;color:#ffffff;font-size:15px;font-weight:700;padding:3.5px 22px;border-radius:9999px;letter-spacing:0.2px;">
                  (${esc(weekBadgeText)})
                </span>
              </div>
              <div style="margin-top:6px;font-size:16px;font-weight:800;color:#8C0D36;letter-spacing:0.3px;">
                ${classTitleText}
                ${hrTeacherName ? `<span style="font-weight:600;font-size:13.5px;color:#555555;margin-left:10px;">(GVCN: ${esc(hrTeacherName)})</span>` : ''}
              </div>
            </div>

            <!-- Khoảng trống đối ứng bên phải để căn giữa tiêu đề (TUYỆT ĐỐI BỎ ĐỐI TƯỢNG NHÂN VẬT THEO YÊU CẦU) -->
            <div style="width:230px;flex-shrink:0;"></div>
          </div>

          <!-- Bảng Thời Khóa Biểu VASchools -->
          <table style="width:100%;border-collapse:collapse;border:2px solid #8C0D36;table-layout:fixed;">
            <thead>
              <tr style="background:#8C0D36;color:#ffffff;height:42px;font-weight:800;font-size:16px;">
                <th style="width:150px;border:1.5px solid #ffffff;text-align:center;vertical-align:middle;padding:4px;">Thời gian</th>
                <th style="border:1.5px solid #ffffff;text-align:center;vertical-align:middle;padding:4px;">Thứ hai</th>
                <th style="border:1.5px solid #ffffff;text-align:center;vertical-align:middle;padding:4px;">Thứ ba</th>
                <th style="border:1.5px solid #ffffff;text-align:center;vertical-align:middle;padding:4px;">Thứ tư</th>
                <th style="border:1.5px solid #ffffff;text-align:center;vertical-align:middle;padding:4px;">Thứ năm</th>
                <th style="border:1.5px solid #ffffff;text-align:center;vertical-align:middle;padding:4px;">Thứ sáu</th>
              </tr>
            </thead>
            <tbody>
              <!-- Buổi Sáng: Tiết 1 đến Tiết 5 -->
              ${morningDefs.map(def => renderRow(def, 'MORNING')).join('')}

              <!-- Hàng nghỉ trưa đặc trưng VASchools -->
              <tr style="background:#8C0D36;color:#ffffff;height:38px;font-weight:800;font-size:15px;">
                <td colspan="6" style="text-align:center;border:1.5px solid #8C0D36;letter-spacing:0.3px;">
                  Ăn cơm và nghỉ trưa (11h50 - 13h15)
                </td>
              </tr>

              <!-- Buổi Chiều: Tiết 1 đến Tiết 4 & Phụ đạo -->
              ${afternoonDefs.map(def => renderRow(def, 'AFTERNOON')).join('')}
            </tbody>
          </table>

          <!-- Thanh 5 dải màu nhận diện thương hiệu VASchools -->
          <div style="display:flex;height:9px;width:100%;border-radius:4px;overflow:hidden;margin-top:20px;">
            <div style="flex:1;background:#007B88;" title="Teal"></div>
            <div style="flex:1;background:#E5A823;" title="Yellow"></div>
            <div style="flex:1;background:#8C0D36;" title="Burgundy"></div>
            <div style="flex:1;background:#8B8000;" title="Olive"></div>
            <div style="flex:1;background:#1B4F9B;" title="Blue"></div>
          </div>
        </div>
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
    <section class="card personal-teaching-card">
      <div class="card-title personal-teaching-toolbar">
        <div>
          <h2>Lịch giảng dạy của: ${esc(teacherObj?.fullName || currentUserProfile?.displayName)}</h2>
          <small>Mã GV: ${esc(teacherObj?.code || '—')} · Tổng số tiết trong tuần: <strong>${myLessons.length} tiết</strong></small>
        </div>
        <div style="display:flex;gap:8px;">
          <div class="tabs-nav" style="margin:0;">
            <button data-switch-personal-mode="week" class="${personalViewMode === 'week' ? 'active' : ''}">Chế độ tuần</button>
            <button data-switch-personal-mode="day" class="${personalViewMode === 'day' ? 'active' : ''}">Danh sách theo ngày</button>
          </div>
          <button class="primary" data-action="personal-jpg">📷 Tải lịch dạy (.JPG)</button>
          <button data-action="push-settings">🔔 Nhắc lịch trên điện thoại</button><button data-action="calendar-connect">Đồng bộ Google Calendar</button><button data-action="calendar-ics">Tải lịch (.ICS)</button>

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

function adminTeacherScheduleSelection(){
 const pData=adminScheduleSource==='working'?workingDraft:publishedTimetable?.isPublished?publishedTimetable.data:null;
 const catalog=[...new Map([...(publishedTimetable?.data?.teachers||[]),...(workingDraft.teachers||[])].map(t=>[t.id,t])).values()];
 const fold=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/đ/g,'d');
 const terms=fold(adminScheduleQuery).trim().split(/\s+/).filter(Boolean);
 const teachers=catalog.filter(t=>terms.every(term=>fold(t.fullName+' '+t.code).includes(term))).sort((a,b)=>String(a.fullName||'').localeCompare(String(b.fullName||''),'vi'));
 const selected=teachers.find(t=>t.id===adminScheduleTeacherId)||teachers[0]||null;
 return {pData,teachers,selected,total:catalog.length};
}
function renderAdminTeacherSchedules(){
 if(!isAdmin())return '<div class="alert">Chỉ quản trị viên được xem lịch dạy tất cả giáo viên.</div>';
 const {pData,teachers,selected,total}=adminTeacherScheduleSelection(),lessons=pData&&selected?getTeacherLessons(selected.id,pData):[];
 const periods=new Set(lessons.map(l=>l.slot?.id).filter(Boolean)).size,classCount=new Set(lessons.map(l=>l.cell.classId)).size;
 return `<section class="card personal-teaching-card"><div class="card-title"><div><h2>Lịch dạy tất cả giáo viên</h2><p class="muted">Bao gồm giáo viên cơ hữu và thỉnh giảng trong danh mục, kể cả chưa có tài khoản đăng nhập. Chỉ xem, không thay đổi thời khóa biểu.</p></div></div>
 <div class="attendance-toolbar"><label>Nguồn thời khóa biểu<select id="admin-schedule-source"><option value="published" ${adminScheduleSource==='published'?'selected':''}>Lịch đã công bố</option><option value="working" ${adminScheduleSource==='working'?'selected':''}>Bản đang xếp</option></select></label>
 <label>Tìm giáo viên<input id="admin-schedule-search" type="search" placeholder="Nhập tên hoặc mã giáo viên" value="${esc(adminScheduleQuery)}"></label>
 <label>Giáo viên<select id="admin-schedule-teacher" ${!teachers.length?'disabled':''}>${teachers.map(t=>`<option value="${esc(t.id)}" ${t.id===selected?.id?'selected':''}>${esc(t.fullName)} · ${esc(t.code||'')}</option>`).join('')||'<option>Không tìm thấy giáo viên</option>'}</select></label><span class="muted">${teachers.length}/${total} giáo viên</span></div>
 ${!pData?'<div class="notice">Chưa có lịch đã công bố. Chọn Bản đang xếp để xem lịch dự kiến.</div>':!selected?'<p>Không có giáo viên phù hợp. Hãy thử tên hoặc mã khác.</p>':`<div class="card-title personal-teaching-toolbar"><div><h2>Lịch giảng dạy của: ${esc(selected.fullName)}</h2><small>Mã GV: ${esc(selected.code||'—')} · <strong>${periods} tiết</strong> · ${classCount} lớp</small><p class="muted">${adminScheduleSource==='working'?'BẢN ĐANG XẾP · Chưa công bố':'LỊCH ĐÃ CÔNG BỐ'} · ${esc(posterWeekInfo(pData.school).caption)}</p></div><div class="button-row"><div class="tabs-nav" style="margin:0"><button data-switch-personal-mode="week" class="${personalViewMode==='week'?'active':''}">Chế độ tuần</button><button data-switch-personal-mode="day" class="${personalViewMode==='day'?'active':''}">Danh sách theo ngày</button></div><button data-action="admin-teacher-jpg">📷 Tải lịch dạy (.JPG)</button></div></div>${!lessons.length?'<p class="notice">Giáo viên chưa có tiết dạy trong nguồn lịch đã chọn.</p>':''}${personalViewMode==='week'?renderPersonalWeeklyGrid(lessons,pData):renderPersonalDailyAgenda(lessons)}`}</section>`;
}
document.addEventListener('change',event=>{
 if(view!=='teacher_schedules'||!isAdmin())return;
 if(event.target.id==='admin-schedule-source'){adminScheduleSource=event.target.value==='working'?'working':'published';render();}
 if(event.target.id==='admin-schedule-teacher'){adminScheduleTeacherId=event.target.value;render();}
});
document.addEventListener('input',event=>{
 if(view!=='teacher_schedules'||!isAdmin()||event.target.id!=='admin-schedule-search')return;
 const start=event.target.selectionStart,end=event.target.selectionEnd;adminScheduleQuery=event.target.value;render();
 const input=document.querySelector('#admin-schedule-search');input?.focus();if(input&&start!==null)input.setSelectionRange(start,end);
});

function renderPersonalWeeklyGrid(myLessons, pData) {
  const lessonsMap = new Map();
  for(const lesson of myLessons){const id=lesson.slot?.id;if(!lessonsMap.has(id))lessonsMap.set(id,[]);lessonsMap.get(id).push(lesson);}

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
            const group = slot ? lessonsMap.get(slot.id) || [] : [];
            const lesson = group[0];
            return `
            <td class="lesson ${lesson ? 'filled' : 'empty'}" style="${lesson?.subject ? '--subject:' + esc(lesson.subject.color) + ';' : ''}">
              ${
                lesson
                  ? `
                <div style="padding:6px;border-radius:4px;background:${/^#[a-f0-9]{6}$/i.test(lesson.subject?.color||'')?lesson.subject.color+'24':'#edf3eb'};height:100%;text-align:left;">
                  <strong style="font-size:10px;color:#184239;display:block;">${esc(lesson.subject?.name)}</strong>
                  <span style="font-size:10px;color:#2f5344;font-weight:600;">${esc([...new Set(group.map(l=>l.class?.name||''))].join(', '))}</span>
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
    <div class="matrix-scroll personal-week-scroll">
      <table class="matrix personal-week-grid" style="width:100%;min-width:0;">
        <thead>
          <tr>
            <th style="width:40px;height:36px;padding:6px;vertical-align:middle;">Tiết</th>
            <th style="width:70px;height:36px;padding:6px;vertical-align:middle;">Giờ</th>
            <th style="height:36px;padding:6px;vertical-align:middle;">Thứ Hai</th>
            <th style="height:36px;padding:6px;vertical-align:middle;">Thứ Ba</th>
            <th style="height:36px;padding:6px;vertical-align:middle;">Thứ Tư</th>
            <th style="height:36px;padding:6px;vertical-align:middle;">Thứ Năm</th>
            <th style="height:36px;padding:6px;vertical-align:middle;">Thứ Sáu</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

let personalJpgBusy=false;
async function downloadPersonalTeachingJpg(options={}){
  if(personalJpgBusy)return;
  const adminExport=isAdmin()&&view==='teacher_schedules'&&options.teacherId&&options.pData;
  if(!adminExport&&(!publishedTimetable?.isPublished||!currentUserProfile?.teacherId)){toast('Chưa có lịch dạy đã công bố để tải.');return;}
  personalJpgBusy=true;
  const button=document.querySelector(adminExport?'[data-action="admin-teacher-jpg"]':'[data-action="personal-jpg"]');
  if(button){button.disabled=true;button.textContent='Đang tạo ảnh…';}
  const pData=adminExport?options.pData:publishedTimetable.data,teacherId=adminExport?options.teacherId:currentUserProfile.teacherId;
  const teacher=(pData.teachers||[]).find(t=>t.id===teacherId)||(adminExport?adminTeacherScheduleSelection().selected:null);
  const teacherName=teacher?.fullName||currentUserProfile.displayName||'Giáo viên';
  const lessons=getTeacherLessons(teacherId,pData),week=posterWeekInfo(pData.school);
  const sheet=document.createElement('section');
  sheet.className='personal-jpg-sheet';
  sheet.style.cssText='position:fixed;left:-20000px;top:0;width:1100px;max-width:none;padding:24px;box-sizing:border-box;background:#fff;color:#184239;font-family:Arial,sans-serif;';
  sheet.innerHTML=`<header style="text-align:center;margin-bottom:20px"><h2 style="font-size:26px;margin:0 0 8px">LỊCH GIẢNG DẠY CÁ NHÂN</h2><strong style="font-size:20px">${esc(teacherName)}</strong><p style="margin:8px 0;font-size:16px">${esc(pData.school?.name||'')} · ${esc(week.caption)}</p>${adminExport?`<p>${adminScheduleSource==='working'?'BẢN ĐANG XẾP · Chưa công bố':'LỊCH ĐÃ CÔNG BỐ'}</p>`:''}</header>${renderPersonalWeeklyGrid(lessons,pData)}`;
  document.body.append(sheet);
  try{
    await document.fonts.ready;
    const canvas=await html2canvas(sheet,{width:1100,height:sheet.offsetHeight,scale:2,backgroundColor:'#ffffff',useCORS:true,logging:false,windowWidth:1200});
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.95));
    if(!blob)throw Error('Chưa tạo được ảnh JPG.');
    const filename=`Lich-day-${teacherName.replace(/[^\p{L}\p{N}-]+/gu,'-')}-${timetableWeek(pData)||'hien-hanh'}.jpg`;
    const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
    toast('Đã tạo ảnh JPG đầy đủ lịch dạy cả tuần.');
  }catch(error){toast('Chưa tải được ảnh: '+error.message);}
  finally{sheet.remove();personalJpgBusy=false;if(button){button.disabled=false;button.textContent='📷 Tải lịch dạy (.JPG)';}}
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
// Sub-view: Đăng ký tiết rảnh / bận cho mọi giáo viên
// ----------------------------------------------------
function availabilityWeek(){return selectedAvailabilityWeek||(selectedAvailabilityWeek=timetableWeek(publishedTimetable?.data||state)||todayWeek());}
function availabilityScope(){return isVisitingTeacher()?(selectedAvailabilityScope||'semester'):'week';}
function availabilityDraftKey(){return availabilityScope()==='semester'?'semester:'+semesterKey(publishedTimetable?.data||state):'week:'+availabilityWeek();}
function currentAvailabilityDraft(){
 const source=availabilityScope()==='semester'?semesterRegistration(availabilityDoc,publishedTimetable?.data||state):weeklyRegistration(availabilityDoc,availabilityWeek(),publishedTimetable?.data||state);
 return availabilityDrafts.get(availabilityDraftKey())||{...clone(source||{}),availableSlotIds:[...(source?.availableSlotIds||[])],busySlotIds:[...(source?.busySlotIds||[])]};
}
function rememberAvailabilityNote(){const input=document.querySelector('#avail-note');if(input){const draft=currentAvailabilityDraft(),note=(input.value||'').trim();if(note!==(draft.note||''))availabilityDrafts.set(availabilityDraftKey(),{...draft,note});}}
function availabilityWarningText(items,s=workingDraft){return items.slice(0,12).map(x=>{const slot=s.timeSlots.find(t=>t.id===x.cell.timeSlotId);const cls=s.classes.find(c=>c.id===x.cell.classId);return `${x.name}: Thứ ${slot?.dayOfWeek}, ${slot?.session==='MORNING'?'sáng':'chiều'} tiết ${slot?.period}, ${cls?.name||''}`;}).join('\n')+(items.length>12?`\nVà ${items.length-12} tiết khác.`:'');}
function confirmWeeklyPublication(){
 const alerts=availabilityAlerts(workingDraft,availabilityRecords);
 if(!alerts.week)return confirm('Chưa đặt ngày bắt đầu tuần nên chưa đối chiếu được đăng ký rảnh/bận. Vẫn tiếp tục công bố?');
 if(availabilityLoadState!=='ready')return confirm('Chưa tải được đăng ký rảnh/bận của giáo viên. Vẫn tiếp tục công bố?');
 if(!alerts.busy.length&&!alerts.unassigned.length)return true;
 return confirm(`Nhắc trước khi công bố tuần ${weekCaption(alerts.week)}:\n`+(alerts.busy.length?`${alerts.busy.length} tiết trùng đăng ký bận:\n${availabilityWarningText(alerts.busy)}\n`:'')+(alerts.unassigned.length?'Đăng ký rảnh nhưng chưa có lịch: '+alerts.unassigned.map(x=>x.name).join(', ')+'\n':'')+'Tiếp tục công bố sau khi đã kiểm tra?');
}
function registrationViewWeek(s=workingDraft){return schedulerRegistrationWeek||timetableWeek(s)||todayWeek();}
function moveRegistrationWeek(action,s=workingDraft){
 const week=registrationViewWeek(s);
 schedulerRegistrationWeek=action==='today'?todayWeek():action==='schedule'?'':addDays(week,action==='previous'?-7:7);
}
function renderAvailabilityAlerts(s=workingDraft){
 if(!isSchedulerRole())return '';
 const week=registrationViewWeek(s),scheduleWeek=timetableWeek(s),sameWeek=week===scheduleWeek;
 // Another week's timetable is not available here: show registrations without claiming conflicts.
 const alerts=availabilityAlerts(sameWeek?s:{...s,timetableCells:[]},availabilityRecords,week);
 const controls=`<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:10px 0">
 <label>Tuần xem đăng ký <input id="registration-view-week" type="date" value="${esc(week)}" aria-label="Tuần xem đăng ký"></label>
 <button type="button" data-action="registration-week-previous">← Tuần trước</button>
 <button type="button" data-action="registration-week-today">Tuần này</button>
 <button type="button" data-action="registration-week-next">Tuần sau →</button>
 <button type="button" data-action="registration-week-schedule">Tuần đang xếp</button></div>`;
 const explanation=sameWeek?'Đang đối chiếu với thời khóa biểu cùng tuần.':`Đang xem riêng đăng ký tuần này. Chưa đối chiếu với thời khóa biểu ${scheduleWeek?'tuần '+esc(weekCaption(scheduleWeek)):'chưa đặt ngày'}. Cảnh báo khi gán tiết và công bố vẫn theo tuần của thời khóa biểu đang xếp.`;
 const summary=sameWeek?`<strong>${alerts.busy.length} tiết trùng lịch bận</strong> · <strong>${alerts.unassigned.length} giáo viên đăng ký rảnh chưa có lịch</strong>.`:'';
 return `<section class="card" style="margin-bottom:12px"><strong>📅 Đăng ký giáo viên · ${esc(weekCaption(week))}</strong>${controls}<p class="muted">${explanation}</p>
 ${availabilityLoadState!=='ready'?`<p>${availabilityLoadState==='error'?'Chưa tải được đăng ký. Hãy kiểm tra kết nối.':'Đang tải đăng ký từ Cloud…'}</p>`:`<p>${alerts.registered.length} giáo viên đã đăng ký tuần này. ${summary}</p>
 ${alerts.registered.length?`<details><summary>Xem đăng ký${sameWeek?' và cảnh báo':''}</summary>
 ${sameWeek?alerts.busy.map(x=>`<p>⚠️ ${esc(availabilityWarningText([x],s))}</p>`).join(''):''}
 ${sameWeek?alerts.unassigned.map(x=>`<p>🔔 ${esc(x.name)}: đã đăng ký ${x.entry.availableSlotIds.length} tiết rảnh nhưng chưa được xếp tiết nào trong tuần.</p>`).join(''):''}
 ${alerts.registered.map(x=>`<p><strong>${esc(x.name)}</strong> · ${x.source==='semester'?'Cố định học kỳ':'Đăng ký riêng tuần'} · ${x.entry.availableSlotIds?.length||0} tiết rảnh · ${x.entry.busySlotIds?.length||0} tiết bận${x.entry.note?' · '+esc(x.entry.note):''}<br><small>${[...(x.entry.busySlotIds||[]).map(id=>['Bận',id]),...(x.entry.availableSlotIds||[]).map(id=>['Rảnh',id])].map(([label,id])=>{const t=s.timeSlots.find(t=>t.id===id);return t?esc(`${label}: Thứ ${t.dayOfWeek}, ${t.session==='MORNING'?'sáng':'chiều'} tiết ${t.period}`):'';}).filter(Boolean).join(' · ')}</small></p>`).join('')}</details>`:''}`}
 <small>Chọn tuần xem không thay đổi thông tin nhà trường hoặc lưu dữ liệu. Cập nhật định kỳ từ Cloud.</small></section>`;
}function renderAvailabilityView() {
  const pData = publishedTimetable?.data || state;
  const teacherId = currentUserProfile?.teacherId || '';
  const myAssignedSlots = new Set(
    (availabilityScope()==='week'&&timetableWeek(pData)===availabilityWeek()?allLessons(pData):[]).filter(c => c.teacherId === teacherId).map(c => c.timeSlotId)
  );

  const registration = currentAvailabilityDraft();
  const busySlots = new Set(registration.busySlotIds || []);
  const availableSlots = new Set(registration.availableSlotIds || []);

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
        <h2>Đăng ký tiết rảnh / bận ${availabilityScope()==='semester'?'cố định học kỳ':'điều chỉnh theo tuần'}</h2>
        <button class="primary" data-action="save-availability">Lưu thời gian đăng ký</button>
      </div>
      <p class="muted">Nhấp chuột vào từng ô để chuyển trạng thái: <strong>Rảnh (Có thể dạy)</strong> → <strong>Bận (Không dạy được)</strong> → <strong>Bỏ chọn</strong>. Thông tin này làm căn cứ để Người xếp lịch bố trí thời khóa biểu.</p>

      <div style="margin:16px 0;display:grid;grid-template-columns:1fr 2fr;gap:14px;">
        ${isVisitingTeacher()?`<label>Phạm vi đăng ký <select id="availability-scope"><option value="semester" ${availabilityScope()==='semester'?'selected':''}>Cố định cả học kỳ</option><option value="week" ${availabilityScope()==='week'?'selected':''}>Thay đổi đột xuất một tuần</option></select><small>${esc(pData.school?.year||'')} · ${esc(pData.school?.term||'')}</small></label>`:''}
        <label>Chọn ngày trong tuần muốn đăng ký
          <input id="availability-week" ${availabilityScope()==='semester'?'disabled':''} type="date" value="${esc(availabilityWeek())}">
          <small>Tuần ${esc(weekCaption(availabilityWeek()))}. Ngày được quy về thứ Hai.</small>
        </label>
        <label>Ghi chú cho Người xếp lịch
          <input id="avail-note" value="${esc(registration.note || '')}" placeholder="Ví dụ: Chỉ dạy được sáng thứ Ba và chiều thứ Năm">
        </label>
      </div>

      ${availabilityDoc && !availabilityDoc.weeks && (availabilityDoc.availableSlotIds?.length||availabilityDoc.busySlotIds?.length)?'<div class="notice">Đăng ký cũ chưa có tuần cụ thể vẫn được giữ lại, nhưng không tự áp dụng cho tuần này. Vui lòng đăng ký lại theo tuần.</div>':''}
      ${isVisitingTeacher()?`<div class="notice">${availabilityScope()==='semester'?'Lịch cố định áp dụng cho các tuần của năm học/học kỳ trên. Thay đổi đột xuất một tuần được ưu tiên riêng tuần đó, không sửa lịch cố định.':(availabilityDoc?.weeks?.[availabilityWeek()]?'Tuần này đang có đăng ký riêng.':'Tuần này đang dùng lịch cố định học kỳ. Khi lưu, các lựa chọn sẽ áp dụng riêng tuần này.')}${availabilityScope()==='week'&&availabilityDoc?.weeks?.[availabilityWeek()]?'<button data-action="availability-use-semester">Dùng lại lịch cố định cho tuần này</button>':''}</div>`:''}
      <p><strong>${availabilityScope()==='semester'?'Lịch cố định: '+esc(pData.school?.year||'')+' · '+esc(pData.school?.term||''):'Tuần đăng ký: '+esc(weekCaption(availabilityWeek()))}</strong>. ${availabilityScope()==='semester'?'Chọn khung giờ cố định, không phụ thuộc lịch dạy của một tuần cụ thể.':timetableWeek(pData)===availabilityWeek()?'Các tiết đã dạy hiển thị theo lịch công bố cùng tuần.':'Lịch công bố hiện tại thuộc tuần khác; không dùng để đánh dấu trùng cho tuần này.'}</p>
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
  const userEmail = (currentUser?.email || '').toLowerCase().trim();
  const myRequests = requestsList.filter(r => (r.teacherEmail || '').toLowerCase().trim() === userEmail);

  return `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
      <section class="card">
        <div class="card-title">
          <h2>Gửi yêu cầu điều chỉnh thời khóa biểu</h2>
        </div>
        <p class="muted">Nếu có việc đột xuất hoặc lý do chính đáng cần điều chỉnh tiết dạy, vui lòng gửi yêu cầu để Người xếp lịch và Quản trị viên xem xét.</p>

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
              <option value="other::other::other">Tiết khác / Đề nghị điều chỉnh chung</option>
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
                const statusStr = (r.status || 'PENDING').toUpperCase();
                const statusLabels = {
                  PENDING: '<span class="req-status pending">Chờ xử lý</span>',
                  APPROVED: '<span class="req-status approved">Đã chấp thuận</span>',
                  REJECTED: '<span class="req-status rejected">Không chấp thuận</span>'
                };
                const statusBadge = statusLabels[statusStr] || `<span class="req-status ${(r.status || 'pending').toLowerCase()}">${esc(r.status || 'Chờ xử lý')}</span>`;
                const slot = (pData.timeSlots || []).find(s => s.id === r.timeSlotId);
                const cls = (pData.classes || []).find(c => c.id === r.classId);
                const subj = (pData.subjects || []).find(s => s.id === r.subjectId);
                const lessonDesc = (slot || cls || subj)
                  ? `Thứ ${slot?.dayOfWeek || '?'} · Tiết ${slot?.period || '?'} (${slot?.session === 'MORNING' ? 'Sáng' : 'Chiều'}) · Lớp ${esc(cls?.name || '')} (${esc(subj?.name || '')})`
                  : (r.lessonSummary || 'Tiết giảng dạy liên quan');
                return `
                <div class="request-card">
                  <div class="req-header">
                    <strong>Yêu cầu lúc ${esc(fmt(r.createdAt))}</strong>
                    ${statusBadge}
                  </div>
                  <div class="req-body">
                    <div style="font-size:12px;color:#184239;font-weight:600;margin-bottom:6px;background:#eef7f2;padding:4px 8px;border-radius:4px;">
                      📅 ${esc(lessonDesc)}
                    </div>
                    <strong>Lý do:</strong> ${esc(r.reason || '—')}<br>
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
                  ${
                    statusStr === 'PENDING'
                      ? `
                    <div style="margin-top:8px;text-align:right;">
                      <button type="button" data-action="cancel-request" data-id="${esc(r.id)}" class="danger-link" style="font-size:11px;padding:3px 8px;border:1px solid #f87171;border-radius:4px;background:#fff5f5;cursor:pointer;">✕ Hủy yêu cầu này</button>
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
      ${renderAvailabilityAlerts()}<section class="card">
        <div class="card-title">
          <h2>Yêu cầu điều chỉnh đang chờ xử lý (${pendingRequests.length})</h2>
        </div>
        ${
          pendingRequests.length
            ? pendingRequests.map(r => {
                const slot = (workingDraft.timeSlots || []).find(s => s.id === r.timeSlotId);
                const cls = (workingDraft.classes || []).find(c => c.id === r.classId);
                const subj = (workingDraft.subjects || []).find(s => s.id === r.subjectId);
                const lessonText = (slot || cls || subj)
                  ? `Thứ ${slot?.dayOfWeek || '?'} · Tiết ${slot?.period || '?'} (${slot?.session === 'MORNING' ? 'Sáng' : 'Chiều'}) · Lớp ${esc(cls?.name || '')} (${esc(subj?.name || '')})`
                  : (r.lessonSummary || 'Tiết giảng dạy liên quan');
                return `
                <div class="request-card" style="border-left:4px solid #f59e0b;">
                  <div class="req-header">
                    <strong>Giáo viên: ${esc(r.teacherName ? `${r.teacherName} (${r.teacherEmail})` : r.teacherEmail)}</strong>
                    <span class="req-status pending">Chờ xử lý</span>
                  </div>
                  <div class="req-body">
                    <div style="font-size:12px;color:#184239;font-weight:600;margin-bottom:6px;background:#eef7f2;padding:4px 8px;border-radius:4px;">
                      📅 Tiết học: ${esc(lessonText)}
                    </div>
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
          pastRequests.slice(0, 15).map(r => {
            const slot = (workingDraft.timeSlots || []).find(s => s.id === r.timeSlotId);
            const cls = (workingDraft.classes || []).find(c => c.id === r.classId);
            const subj = (workingDraft.subjects || []).find(s => s.id === r.subjectId);
            const lessonText = (slot || cls || subj)
              ? `Thứ ${slot?.dayOfWeek || '?'} · Tiết ${slot?.period || '?'} · Lớp ${esc(cls?.name || '')} (${esc(subj?.name || '')})`
              : (r.lessonSummary || '');
            return `
            <div class="request-card" style="opacity:0.9;">
              <div class="req-header">
                <span><strong>${esc(r.teacherName || r.teacherEmail)}</strong> · <small>${esc(fmt(r.updatedAt || r.createdAt))}</small></span>
                <span class="req-status ${r.status.toLowerCase()}">${r.status === 'APPROVED' ? 'Đã chấp thuận' : 'Không chấp thuận'}</span>
              </div>
              <div class="req-body">
                ${lessonText ? `<div style="font-size:12px;color:#555;margin-bottom:4px;">📅 ${esc(lessonText)}</div>` : ''}
                <strong>Lý do:</strong> ${esc(r.reason)}<br>
                <strong>Phản hồi:</strong> ${esc(r.responseNote || '—')}
              </div>
              <div style="margin-top:8px;text-align:right;">
                <button data-action="delete-request" data-id="${esc(r.id)}" class="danger-link" style="font-size:11px;padding:2px 6px;cursor:pointer;">Xóa bản ghi</button>
              </div>
            </div>
          `;
          }).join('')
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
                <strong>Môn giảng dạy:</strong> ${esc(p.selfDeclared?.subjects?.join(', ') || 'Chưa khai báo')}<br>
                <strong>Lớp chủ nhiệm:</strong> ${esc(p.selfDeclared?.homeroomClassId ? text(state.classes || [], p.selfDeclared.homeroomClassId) : 'Không chủ nhiệm')}<br>
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
  const homeroomNames = officialHomeroomClassIds().map(id => text(state.classes || [], id)).join(', ');

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
          <dt>Môn giảng dạy:</dt><dd>${esc(currentUserProfile?.selfDeclared?.subjects?.join(', ') || '—')}</dd>
          <dt>Trạng thái quyền:</dt><dd><span class="status-pill active">Đã xác nhận & Hoạt động</span></dd>
        </dl>

        <div style="margin-top:20px;padding-top:14px;border-top:1px solid #edf0e8;">
          <button data-action="edit-self-declared">Cập nhật môn giảng dạy / Ghi chú</button>
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
        <dt>Tuần học:</dt><dd>${esc(schoolWeekText(state.school))}</dd>
        <dt>Ngày áp dụng:</dt><dd>${esc(state.school?.appliedDate || 'Chưa đặt')}</dd>
      </dl>
    </section>
  `;
}

// ----------------------------------------------------
// Core Matrix Section (Ma trận phân công & Thời khóa biểu)
// ----------------------------------------------------
function registrationDetail(registration,slot){
 if(!registration)return '';
 const scope=registration.source==='semester'?'cố định học kỳ':'riêng tuần '+weekCaption(registration.week);
 const when=slot?` · Thứ ${slot.dayOfWeek}, ${slot.session==='MORNING'?'sáng':'chiều'} tiết ${slot.period}`:'';
 return (registration.status==='busy'?'Đã đăng ký bận':'Đã đăng ký rảnh')+' · '+scope+when+(registration.note?' · Ghi chú: '+registration.note:'');
}
function snapshotTimetablePopover(){
 const root=document.querySelector('#active-matrix-popover-root');if(!root?.dataset.timetableClass)return null;
 return {classId:root.dataset.timetableClass,timeSlotId:root.dataset.timetableSlot,day:Number(root.dataset.timetableDay),period:Number(root.dataset.timetablePeriod),query:root.querySelector('#timetable-suggestion-search')?.value||'',scroll:root.querySelector('#timetable-suggestions-list')?.scrollTop||0,focused:document.activeElement?.id==='timetable-suggestion-search'};
}
function restoreTimetablePopover(saved){
 if(!saved)return;
 const anchorElement=document.querySelector(`.matrix [data-cell-class="${CSS.escape(saved.classId)}"][data-cell-slot="${CSS.escape(saved.timeSlotId)}"]`);
 if(!anchorElement){closePopover();return;}
 openTimetableCellPopover({...saved,anchorElement});
 const root=document.querySelector('#active-matrix-popover-root'),input=root?.querySelector('#timetable-suggestion-search');if(input){input.value=saved.query;input.dispatchEvent(new Event('input',{bubbles:true}));if(saved.focused)input.focus();}
 const list=root?.querySelector('#timetable-suggestions-list');if(list)list.scrollTop=saved.scroll;
}
function renderGrade11Parts(s,cls,slot,day,cell,isReadonly,busyIndex) {
 const lessons=cellLessons(s,cell);
 return '<div class="grade11-parallel-parts" style="display:flex;width:100%;height:100%;gap:0;">'+['TN','XH'].map((track,i)=>{
  const lesson=lessons.find(l=>l.track===track),subject=s.subjects.find(x=>x.id===lesson?.subjectId),teacher=text(s.teachers||[],lesson?.teacherId,'fullName');
  const teacherColor = lesson?.teacherId ? getTeacherColor(s, lesson.teacherId) : (subject ? subject.color : '');
  const registration=registrationForSlot(busyIndex,lesson?.teacherId,slot.id),registeredBusy=registration?.status==='busy';
  const label=track+': '+(subject?.name||'Chưa xếp môn')+(teacher?' — '+teacher:'')+(registeredBusy?' · '+registrationDetail(registration,slot):'');
  return `<button type="button" class="${registeredBusy?'grade11-availability-busy':''}" data-cell-drop="true" data-cell-class="${esc(cls.id)}" data-cell-slot="${esc(slot.id)}" data-cell-day="${day}" data-cell-period="${slot.period}" data-cell-track="${track}" aria-label="${esc(cls.name+', thứ '+day+', '+(slot.session==='MORNING'?'sáng':'chiều')+' tiết '+slot.period+', '+label)}" title="${esc(label)}" style="position:relative;padding-top:10px;flex:1 1 0;width:50%;min-width:0;border-radius:0;${i?'border-left:1px solid var(--border);':''}${teacherColor?'--subject:'+esc(teacherColor)+';':''}" ${isReadonly?'disabled':''}>
   <span class="grade11-track-label" style="position:absolute;left:3px;top:1px;font-size:7px;line-height:9px;font-weight:700;">${track}</span>${lesson?`<span class="subject-name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;width:100%;">${esc(subject?.name||'')}${cell.locked?' <span class="lock" title="Đã khóa">🔒</span>':''}</span><span class="teacher-name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;width:100%;display:inline-flex;align-items:center;justify-content:center;gap:3px;">${lesson.teacherId ? `<i style="display:inline-block;width:5px;height:5px;border-radius:50%;background:${teacherColor};flex-shrink:0;"></i>` : ''}${esc(teacher||'Chưa chọn giáo viên')}</span>`:'<span class="empty-mark">'+track+' ＋</span>'}
  ${registeredBusy?'<span class="busy-cell-mark" aria-label="Giáo viên đã đăng ký bận">⚠ BẬN</span>':''}</button>`;
 }).join('')+'</div>';
}

let publicationHistory={identity:'',items:null,selected:'',publication:null,loading:false,error:'',generation:0};
async function loadPublicationHistory(id=''){
 if(!isSchedulerRole())return;const identity=currentUser?.email||'';if(publicationHistory.identity!==identity)publicationHistory={identity,items:null,selected:'',publication:null,loading:false,error:'',generation:publicationHistory.generation+1};
 const generation=++publicationHistory.generation;publicationHistory.loading=true;publicationHistory.error='';render();
 try{const snap=await getDoc(doc(db,'timetables',id||'publication_history'));if(generation!==publicationHistory.generation||identity!==currentUser?.email)return;
 if(id)publicationHistory.publication=snap.data();else{publicationHistory.items=snap.data()?.items||[];publicationHistory.publication=null;publicationHistory.selected='';}
 }catch(e){if(generation===publicationHistory.generation)publicationHistory.error=e.message;}finally{if(generation===publicationHistory.generation){publicationHistory.loading=false;render();}}
}
function renderPublicationHistory(){
 if(!isSchedulerRole())return '<p>Chỉ quản trị và người xếp lịch được xem kho lịch.</p>';
 const identity=currentUser?.email||'';if(publicationHistory.identity===identity&&publicationHistory.items===null&&publicationHistory.error)return '<section class="card"><h2>Kho TKB theo tuần</h2><p role="alert">'+esc(publicationHistory.error)+'</p><button data-publication-history-reload>Thử lại</button></section>';if(publicationHistory.identity!==identity||publicationHistory.items===null){if(!publicationHistory.loading)queueMicrotask(()=>loadPublicationHistory());return '<p>Đang tải danh sách tuần…</p>';}
 const h=publicationHistory;
 return '<section class="card"><h2>Kho thời khóa biểu đã công bố · Từ tuần 12</h2><p class="muted">Lưu bản công bố gần nhất của mỗi tuần, gồm đầy đủ lớp, môn, giáo viên và khung tiết tại thời điểm đó. Chỉ xem tham khảo; không thay đổi bản đang xếp.</p><div class="attendance-toolbar"><label>Chọn tuần<select id="publication-history-week" '+(h.loading?'disabled':'')+'><option value="">— Chọn tuần —</option>'+h.items.map(r=>'<option value="'+esc(r.id)+'" '+(r.id===h.selected?'selected':'')+'>Tuần '+esc(r.week)+' · '+esc(r.start)+' – '+esc(r.end)+' · '+esc(r.year)+' · '+esc(r.term)+'</option>').join('')+'</select></label><button data-publication-history-reload '+(h.loading?'disabled':'')+'>↻ Tải lại danh sách</button></div>'+(h.error?'<p role="alert">'+esc(h.error)+'</p>':'')+(h.loading?'<p>Đang tải ma trận tuần…</p>':'')+(!h.items.length?'<p>Chưa có bản công bố từ tuần 12 để lưu. Các tuần trước không được tự dựng lại.</p>':'')+'</section>'+(h.publication?.data?'<div class="notice"><strong>LỊCH LƯU TRỮ · '+esc(posterWeekInfo(h.publication.data.school).caption)+'</strong> · Chỉ xem</div>'+renderMatrixSection(normalizeState(h.publication.data)):'');
}
document.addEventListener('change',event=>{if(event.target.id!=='publication-history-week'||view!=='publication_history'||!isSchedulerRole())return;const row=publicationHistory.items?.find(r=>r.id===event.target.value);publicationHistory.selected=row?.id||'';publicationHistory.publication=null;if(row)void loadPublicationHistory(row.id);else render();});
document.addEventListener('click',event=>{if(event.target.closest('[data-publication-history-reload]')&&view==='publication_history')void loadPublicationHistory();});
function renderMatrixSection(s) {
  const historical=view==='publication_history';
  const isTeacherWorkspace = historical || (currentWorkspace !== 'ADMIN' && currentWorkspace !== 'SCHEDULER') || !isSchedulerRole() || view === 'published_all';
  if(isTeacherWorkspace&&!historical&&!publishedTimetable?.isPublished)return '<div class="card"><h2>Chưa có thời khóa biểu hiện hành</h2><p>Lịch mới sẽ hiển thị sau khi nhà trường công bố.</p></div>';
  const effectiveMatrixMode = isTeacherWorkspace ? 'timetable' : matrixViewMode;
  if (isTeacherWorkspace && !historical && publishedTimetable?.isPublished && publishedTimetable?.data) {
    s = normalizeState(publishedTimetable.data);
  }
  const classes = (s.classes || []).filter(c => !grade || (grade === 'THCS' ? c.grade <= 9 : grade === 'THPT' ? c.grade >= 10 : String(c.grade) === grade));
  const isReadonly = isTeacherWorkspace || !canEditWorking();
  const busyIndex=registrationSlotIndex(s,historical?[]:availabilityRecords);
  const busyScheduledLessons=historical?[]:availabilityAlerts(s,availabilityRecords).busy;
  const busyLessonCount=busyScheduledLessons.length;
  const targetTeacherId = (brushMode === 'brush' && brushTeacherId && !isTeacherWorkspace) ? brushTeacherId : (selectedTeacherHighlight || teacher);
  const targetHighlightId = targetTeacherId;
  const targetTeacherName = targetTeacherId ? text(s.teachers || [], targetTeacherId, 'fullName') : '';

  let tableHeaderHtml = '';
  let tableBodyHtml = '';

  if (effectiveMatrixMode === 'assignment') {
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
              <span>GVCN: ${homeroomTeacherIds(cls).length ? esc(homeroomTeacherIds(cls).map(id=>text(s.teachers || [],id,'fullName')).join(' · ')) : '<em style="color:#94a69b;">Chưa có</em>'}</span>
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
          const assignmentBusy=busyScheduledLessons.filter(x=>x.teacherId===assignedTeacher.id&&x.cell.classId===cls.id&&x.cell.subjectId===subj.id);
          const assignmentBusyTitle=assignmentBusy.map(x=>registrationDetail({...x.entry,status:'busy',source:x.source,week:timetableWeek(s)},s.timeSlots.find(t=>t.id===x.cell.timeSlotId))).join('\n');
          cellsHtml += `
            <td class="lesson filled ${isHighlighted ? 'cell-highlighted' : ''} ${isDimmed ? 'cell-dimmed' : ''} ${assignmentBusy.length?'availability-busy-cell assignment-availability-busy':''}" title="${esc(assignmentBusyTitle)}" style="--subject:${esc(subj.color)};position:relative;">
              <button type="button" data-assign-cell="true" data-assign-class="${esc(cls.id)}" data-assign-subject="${esc(subj.id)}" ${isReadonly ? 'disabled' : ''} aria-label="${esc(`${cls.name}, ${subj.name}: ${assignedTeacher.fullName}`)}">
                <span class="subject-name" style="font-weight:600;font-size:9px;color:#184239;">${esc(subj.name)}</span>
                <strong class="teacher-name" style="font-size:10px;color:#184239;display:block;margin-top:2px;">${esc(assignedTeacher.fullName)}</strong>
                <span class="cell-note" style="font-size:8px;color:#677e71;display:inline-block;background:#eef3eb;padding:1px 5px;border-radius:4px;margin-top:2px;">${esc(assignedTeacher.code)}</span>
              </button>
              ${assignmentBusy.length?'<span class="busy-cell-mark">⚠ BẬN</span>':''}
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
          <th class="class-header" data-select-tray-class="${esc(cls.id)}" style="cursor:pointer;" title="Nhấp để xem các môn phân công của lớp ${esc(cls.name)} trong Khay thẻ">
            <strong>${esc(cls.name)}</strong>
            <span>${cls.grade < 10 ? 'THCS' : 'THPT'} · Khối ${cls.grade}</span>
            <div>
              <span>GVCN: ${homeroomTeacherIds(cls).length ? esc(homeroomTeacherIds(cls).map(id=>text(s.teachers || [],id,'fullName')).join(' · ')) : '<em style="color:#94a69b;">Chưa có</em>'}</span>
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
          const assignedTeacherId = cell ? (cell.teacherId || cellLessons(s, cell)[0]?.teacherId) : '';
          const teacherText = cell ? cellLessons(s,cell).map(l=>text(s.teachers||[],l.teacherId,'fullName')).join(' / ') : '';
          const splitGrade11=cls.grade===11&&(!cell||cellLessons(s,cell).some(l=>['TN','XH'].includes(l.track)));
          const busyTeachers=splitGrade11?[]:cellLessons(s,cell).map(l=>({name:text(s.teachers||[],l.teacherId,'fullName'),registration:registrationForSlot(busyIndex,l.teacherId,slot.id)})).filter(x=>x.registration?.status==='busy');
          const busyTitle=busyTeachers.map(x=>x.name+': '+registrationDetail(x.registration,slot)).join('\n');
          const teacherColor = assignedTeacherId ? getTeacherColor(s, assignedTeacherId) : (subject ? subject.color : '');
          const hasTarget = !!targetHighlightId;
          const isHighlighted = hasTarget && cellLessons(s,cell).some(l=>l.teacherId===targetHighlightId);
          const isDimmed = hasTarget && !cellLessons(s,cell).some(l=>l.teacherId===targetHighlightId);
          const matchQuery = !query || `${subject?.name || ''} ${teacherText} ${cls.name}`.toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi'));

          rows += `<td class="lesson ${cell ? 'filled' : 'empty'} ${isHighlighted ? 'cell-highlighted' : ''} ${isDimmed || !matchQuery ? 'cell-dimmed' : ''} ${cell && conflictIds.has(cell.id) ? 'conflict' : ''} ${busyTeachers.length?'availability-busy-cell':''}" title="${esc(busyTitle)}"
                       data-cell-drop="true"
                       data-cell-class="${esc(cls.id)}"
                       data-cell-slot="${esc(slot.id)}"
                       data-cell-day="${day}"
                       data-cell-period="${slot.period}"
                       style="${teacherColor ? '--subject:' + esc(teacherColor) + ';' : ''}">
            ${splitGrade11 ? renderGrade11Parts(s,cls,slot,day,cell,isReadonly,busyIndex) : `<button data-cell-class="${esc(cls.id)}"
                    data-cell-slot="${esc(slot.id)}"
                    data-cell-day="${day}"
                    data-cell-period="${slot.period}"
                    aria-label="${esc(`${cls.name}, thứ ${day}, ${slot.session === 'MORNING' ? 'sáng' : 'chiều'} tiết ${slot.period}${subject ? ', ' + subject.name : ''}`)}"
                    ${isReadonly ? 'disabled' : ''}>
              ${cell?.parallelLessons?.length ? cellLessons(s,cell).map((l,i)=>`<span class="${i?'teacher-name':'subject-name'}" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%;max-width:100%;" title="${esc(l.track+': '+text(s.subjects,l.subjectId)+' — '+text(s.teachers,l.teacherId,'fullName'))}">${esc(l.track)}: ${esc(text(s.subjects,l.subjectId))} — ${esc(text(s.teachers,l.teacherId,'fullName')||'Chưa chọn giáo viên')}</span>`).join('') : cell ? `<span class="subject-name">${esc(subject?.name)} ${cell.locked ? (!isReadonly ? `<span class="lock-indicator" data-action="quick-toggle-cell-lock" data-class="${esc(cls.id)}" data-slot="${esc(slot.id)}" title="Tiết học đang khóa cố định. Nhấp để mở khóa">🔒</span>` : '<span class="lock" title="Đã khóa">🔒</span>') : ''}</span><span class="teacher-name" style="display:inline-flex;align-items:center;justify-content:center;gap:3px;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${assignedTeacherId ? `<i style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${teacherColor};flex-shrink:0;"></i>` : ''}${cell.teacherId ? esc(teacherText) : 'Chưa chọn giáo viên'}</span>${cell.note ? `<span class="cell-note" title="${esc(cell.note)}">${esc(cell.note)}</span>` : ''}` : '<span class="empty-mark">＋</span>'}
            </button>`}
            ${busyTeachers.length?'<span class="busy-cell-mark" aria-label="Giáo viên đã đăng ký bận">⚠ BẬN</span>':''}
          </td>`;
        }
        rows += '</tr>';
      });
    }
    tableBodyHtml = rows;
  }

  const focusActive = effectiveMatrixMode === 'timetable' && !isTeacherWorkspace && !isReadonly && matrixFocusEnabled;
  const dailyRulesNotice = effectiveMatrixMode === 'timetable' && !isTeacherWorkspace ? '<div class="notice">Quy định khối 6–9: mỗi lớp, mỗi ngày (cả sáng và chiều) chỉ học một phân môn KHTN (Lí/Hóa/Sinh) và một phân môn LS-ĐL (Sử/Địa). Các tiết cùng môn trong một buổi phải liền kề, không xếp cách tiết. Toàn trường: cùng lớp không xếp một môn ở cả sáng và chiều cùng ngày, ngoại trừ tiết đôi nối tiết 5 buổi sáng và tiết 1 buổi chiều; AI-Robotics mỗi Thứ/Buổi/Tiết chỉ dành cho một lớp, kể cả khác giáo viên.</div>' : '';
  const trayHtml = (!isTeacherWorkspace && effectiveMatrixMode === 'timetable') ? renderAssignmentTray(s, classes) : '';

  return `
    ${effectiveMatrixMode === 'timetable' ? renderAvailabilityAlerts(s) : ''}${dailyRulesNotice}<section class="matrix-panel ${focusActive ? 'schedule-focus' : ''} ${matrixFocusTools ? 'focus-tools-open' : ''} ${brushMode !== 'none' && !isTeacherWorkspace ? 'brush-active' : ''}">
      ${focusActive ? `<div class="schedule-focus-bar"><strong>▦ Không gian xếp thời khóa biểu</strong><span data-focus-sync role="status">${esc(syncMessage)}</span>${busyLessonCount?`<strong class="focus-busy-count">⚠ ${busyLessonCount} tiết có GV đăng ký bận</strong>`:''}<div><button type="button" data-action="schedule-focus-tools">${matrixFocusTools?'Ẩn công cụ':'Công cụ & lọc lớp'}</button><button type="button" data-action="fullscreen" title="Mở rộng cả trình duyệt nếu được hỗ trợ">⛶ Toàn màn hình</button><button type="button" data-action="schedule-focus-exit">↙ Thu nhỏ / Xem cảnh báo</button></div></div>` : ''}
      <div class="panel-toolbar">
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
          ${isTeacherWorkspace ? `
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="font-size:13px;font-weight:700;color:#184239;display:inline-flex;align-items:center;gap:6px;">
                <span style="display:inline-block;width:9px;height:9px;background:#15803d;border-radius:50%;"></span>
                LỊCH TIẾT HỌC TOÀN TRƯỜNG (BẢN ĐÃ CHỐT)
              </span>
              <span class="live-pill published">✓ BẢN CHÍNH THỨC</span>
            </div>
          ` : `
            <div class="segmented">
              <button data-set-matrix-mode="assignment" class="${effectiveMatrixMode === 'assignment' ? 'selected' : ''}">📋 Ma trận phân công (Môn - Lớp)</button>
              <button data-set-matrix-mode="timetable" class="${effectiveMatrixMode === 'timetable' ? 'selected' : ''}">▦ Lịch tiết học (Tiết - Lớp)</button>
            </div>

            <!-- 2 Môi trường (Draft vs Published) Engine -->
            <div class="publish-engine-bar">
              <div class="publish-toggle-group">
                <button type="button" data-action="set-version-draft" class="publish-toggle-btn ${activeVersion === 'draft' ? 'selected' : ''}" title="Chuyển sang bản nháp đang xếp">
                  📝 Bản đang xếp
                </button>
                <button type="button" data-action="set-version-published" class="publish-toggle-btn ${activeVersion === 'published' ? 'selected' : ''}" title="Xem bản công bố chính thức">
                  ✓ Bản đã chốt
                </button>
              </div>

              ${isSchedulerRole() ? `
                <div class="publish-actions">
                  <button type="button" data-action="publish-all" class="btn-publish-all" title="Sao chép toàn bộ bản nháp sang bản chính thức và công bố cho toàn trường">
                    🚀 Công bố lên toàn trường
                  </button>
                  <button type="button" data-action="restore-published-all" class="btn-restore-published" title="Hủy các thay đổi nháp và khôi phục quay lại giống bản đã chốt">
                    ↺ Khôi phục bản chốt
                  </button>
                  ${effectiveMatrixMode === 'timetable' ? (() => {
                    const history = Array.isArray(workingDraft.changeHistory) ? workingDraft.changeHistory : [];
                    const undoableList = history.filter(h => h.canUndo && !h.undone);
                    const undoableCount = undoableList.length;
                    const historyCount = history.length;
                    const lastUndoable = undoableList[0];
                    return `
                      <button type="button" data-action="undo-last-change" class="btn-tool-undo ${undoableCount > 0 ? '' : 'disabled'}" ${undoableCount > 0 ? '' : 'disabled'} style="display:inline-flex;align-items:center;gap:4px;background:#f0fdf4;border:1px solid #86efac;color:#166534;font-size:11px;font-weight:700;padding:5px 10px;border-radius:6px;cursor:${undoableCount > 0 ? 'pointer' : 'not-allowed'};opacity:${undoableCount > 0 ? '1' : '0.5'};" title="${lastUndoable ? 'Hoàn tác: ' + esc(lastUndoable.description) + ' (Phím tắt: Ctrl+Z)' : 'Chưa có thao tác nào để hoàn tác'}">
                        ↶ Hoàn tác ${undoableCount > 0 ? `(${undoableCount})` : ''}
                      </button>
                      <button type="button" data-action="open-change-history-modal" class="btn-tool-history" style="display:inline-flex;align-items:center;gap:4px;background:#f8fafc;border:1px solid #cbd5e1;color:#334155;font-size:11px;font-weight:700;padding:5px 10px;border-radius:6px;cursor:pointer;" title="Xem lịch sử các lần thay đổi gần nhất và hoàn tác">
                        📜 Nhật ký thay đổi ${historyCount > 0 ? `(${historyCount})` : ''}
                      </button>
                      <button type="button" data-action="unlock-all-fixed" class="btn-tool-unlock" title="Mở khóa tất cả các môn cố định (Chào cờ, SHL, ESL) trên toàn trường để tự do xếp lại">
                        🔓 Mở khóa môn cố định
                      </button>
                      <button type="button" data-action="reset-monday-flag-ceremony" class="btn-tool-unlock" style="background:#fee2e2;color:#991b1b;border-color:#fca5a5;" title="Đặt lại tiết Chào cờ cố định vào sáng Thứ 2 (Tiết 1) cho tất cả các lớp">
                        🚩 Đặt lại Chào cờ T2
                      </button>
                      <button type="button" data-action="show-teacher-palette-modal" class="btn-tool-palette" title="Xem bảng 43 màu của 43 giáo viên">
                        🎨 Bảng 43 màu GV
                      </button>
                    `;
                  })() : ''}
                </div>
              ` : ''}

              ${(workingDraft.lastPublishedAt || publishedTimetable?.lastPublishedAt) ? `
                <span class="publish-time-badge" title="Thời điểm công bố gần nhất">
                  🕒 Đã chốt: ${esc(workingDraft.lastPublishedAt || publishedTimetable?.lastPublishedAt)}
                </span>
              ` : ''}
            </div>
          `}
        </div>

        <div class="toolbar-right">
          <label class="sr-only" for="teacher-filter">Lọc giáo viên</label>
          <select id="teacher-filter">${selectOptions(s.teachers || [], teacher, 'fullName', 'Tất cả giáo viên')}</select>
          <label class="search"><span>⌕</span><input id="search" placeholder="Tìm môn, giáo viên, lớp…" value="${esc(query)}" aria-label="Tìm trong ma trận"></label>
          <button data-action="density" class="icon-button" title="Đổi độ rộng cột">${compact ? '↔' : '↦↤'}</button>
          ${effectiveMatrixMode==='timetable'&&!isReadonly?'<button data-action="schedule-focus-enter" class="icon-button" title="Phóng to bảng xếp lịch">⛶ Phóng to bảng</button>':'<button data-action="fullscreen" class="icon-button" title="Toàn màn hình">⛶</button>'}
        </div>
      </div>

      <!-- Thanh công cụ Cọ gán nhanh (Chỉ hiển thị cho người xếp lịch tại Ma trận phân công) -->
      ${!isTeacherWorkspace && canEditWorking() && effectiveMatrixMode === 'assignment' ? `
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
          <h2>${isTeacherWorkspace ? 'LỊCH TIẾT HỌC TOÀN TRƯỜNG (TIẾT — LỚP)' : (effectiveMatrixMode === 'assignment' ? 'MA TRẬN PHÂN CÔNG CHUYÊN MÔN (MÔN — LỚP)' : 'THỜI KHÓA BIỂU TOÀN TRƯỜNG (TIẾT — LỚP)')}</h2>
          <p>${esc(s.school?.name || '')} · ${esc(s.school?.year || '')} · ${esc(s.school?.term || '')} · ${esc(schoolWeekText(s.school))}${s.school?.appliedDate ? ' · Áp dụng ' + esc(s.school.appliedDate) : ''}</p>
        </div>
        <p class="matrix-help">${
          isTeacherWorkspace
            ? 'Bản thời khóa biểu chính thức đã chốt của toàn trường (dạng Tiết — Lớp).'
            : (effectiveMatrixMode === 'timetable'
                ? (armedCard
                    ? `🎯 Đang cầm cọ thẻ: ${esc(text(s.subjects || [], armedCard.subjectId))} - ${esc(text(s.teachers || [], armedCard.teacherId, 'fullName'))}. Click vào các ô trống trên bảng để gán nhanh.`
                    : isReadonly
                    ? 'Chế độ xem chỉ đọc bản lịch đã chốt.'
                    : 'Nhấp một ô để mở Popover gợi ý chỉ giáo viên lớp này, hoặc Kéo-Thả / Click cọ thẻ từ Khay phân công.')
                : (brushMode === 'brush'
                    ? `🖌️ Chế độ Cọ vẽ: Click bất kỳ ô nào để gán ngay cho ${esc(targetTeacherName)}.`
                    : brushMode === 'eraser'
                    ? '🧼 Chế độ Tẩy: Click bất kỳ ô nào để xóa phân công ngay lập tức.'
                    : targetTeacherId
                    ? `Đang rọi sáng phân công của: ${esc(targetTeacherName)}`
                    : isReadonly
                    ? 'Chế độ xem chỉ đọc bản lịch đã chốt.'
                    : 'Nhấp một ô để mở danh sách chọn giáo viên (Popover Click) hoặc dùng Cọ vẽ để gán nhanh.'))
        }</p>
      </div>

      ${
        !isTeacherWorkspace && effectiveMatrixMode === 'timetable' && trayPosition === 'top'
          ? trayHtml
          : ''
      }

      ${
        !isTeacherWorkspace && effectiveMatrixMode === 'timetable' && trayPosition === 'right'
          ? `
            <div class="timetable-with-tray-container layout-right">
              <div class="matrix-scroll" id="matrix-scroll-container" tabindex="0" role="region" aria-label="Ma trận thời khóa biểu">
                <table class="matrix ${compact ? 'compact' : ''}">
                  <thead>${tableHeaderHtml}</thead>
                  <tbody>${tableBodyHtml}</tbody>
                </table>
              </div>
              <aside class="timetable-tray-sidebar">
                ${trayHtml}
              </aside>
            </div>
          `
          : `
            <div class="matrix-scroll" id="matrix-scroll-container" tabindex="0" role="region" aria-label="Ma trận thời khóa biểu">
              <table class="matrix ${compact ? 'compact' : ''}">
                <thead>${tableHeaderHtml}</thead>
                <tbody>${tableBodyHtml}</tbody>
              </table>
            </div>
          `
      }

      <div class="matrix-bottom">
        <span><i></i> ${effectiveMatrixMode === 'assignment' ? 'Ma trận gán trực tiếp giáo viên dạy theo môn & lớp' : 'Môn học & giáo viên trong từng tiết học (Tiết — Lớp)'}</span>
        <span>${isReadonly ? 'Chế độ xem chỉ đọc bản đã chốt' : 'Đồng bộ Cloud tự động'}</span>
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
                    const hrTeacher = homeroomTeacherIds(item).map(id=>(state.teachers || []).find(t=>t.id===id)?.fullName).filter(Boolean).join(' · ');
                    return `
                      <div class="catalog-row">
                        <div>
                          <strong>${esc(item.name)}</strong>
                          <small>${esc(item.code)} · Khối ${item.grade}</small>
                          <div class="catalog-subinfo">GVCN: ${hrTeacher ? esc(typeof hrTeacher === "string" ? hrTeacher : hrTeacher.fullName) : '<span class="text-muted">Chưa có GVCN</span>'}</div>
                        </div>
                        <button data-edit="classes" data-id="${esc(item.id)}" aria-label="Sửa ${esc(item.name)}">Sửa</button>
                        <button data-delete="classes" data-id="${esc(item.id)}" class="danger-link" aria-label="Xóa ${esc(item.name)}">×</button>
                      </div>
                    `;
                  }
                  if (kind === 'teachers') {
                    const hrClasses = (state.classes || []).filter(c => homeroomTeacherIds(c).includes(item.id));
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

function renderPublishAndDataPage() {
  const conflicts = findConflicts(workingDraft);
  const versionCount = workingDraft.versions?.length || 0;
  const isPublished = Boolean(publishedTimetable?.isPublished);

  const statsHtml = `
    <div class="stats publish-stats" style="margin-bottom:16px;">
      <div class="${conflicts.length ? 'warning-stat' : ''} ${publishAndDataTab === 'conflicts' ? 'active-stat-card' : ''}" style="cursor:pointer;" data-publish-tab="conflicts" title="Xem danh sách xung đột">
        <span class="stat-icon" style="${conflicts.length ? 'background:#fee2e2;color:#b91c1c;' : 'background:#dcfce7;color:#15803d;'}">
          ${conflicts.length ? '!' : '✓'}
        </span>
        <div class="stat-content">
          <strong style="${conflicts.length ? 'color:#b91c1c;' : 'color:#15803d;'}">
            ${conflicts.length ? `${conflicts.length} lỗi trùng` : '0 xung đột'}
          </strong>
          <span>${conflicts.length ? 'Cần kiểm tra' : 'Lịch hợp lệ ✓'}</span>
        </div>
      </div>

      <div class="${publishAndDataTab === 'versions' ? 'active-stat-card' : ''}" style="cursor:pointer;" data-publish-tab="versions" title="Xem tình trạng bản chốt Cloud">
        <span class="stat-icon" style="background:#e0f2fe;color:#0284c7;">▱</span>
        <div class="stat-content">
          <strong style="color:#0369a1;">${isPublished ? 'Đang công bố ✓' : 'Chưa công bố'}</strong>
          <span>${isPublished ? esc(fmt(publishedTimetable.publishedAt)) : 'Bản nháp đang xếp'}</span>
        </div>
      </div>

      <div class="${publishAndDataTab === 'versions' ? 'active-stat-card' : ''}" style="cursor:pointer;" data-publish-tab="versions" title="Xem các phiên bản đã lưu">
        <span class="stat-icon" style="background:#ede9fe;color:#7c3aed;">📑</span>
        <div class="stat-content">
          <strong style="color:#6d28d9;">${versionCount} phiên bản</strong>
          <span>${workingDraft.timetableCells?.length || 0} ô lịch (Rev: ${currentRevision})</span>
        </div>
      </div>

      <div class="${publishAndDataTab === 'backup' ? 'active-stat-card' : ''}" style="cursor:pointer;" data-publish-tab="backup" title="Sao lưu và xuất dữ liệu">
        <span class="stat-icon" style="background:#fef3c7;color:#d97706;">💾</span>
        <div class="stat-content">
          <strong style="color:#b45309;">Sao lưu & Tệp</strong>
          <span>JSON, CSV & Drive</span>
        </div>
      </div>
    </div>
  `;

  const tabsHtml = `
    <div class="tabs-nav" style="margin-bottom:20px;">
      <button data-publish-tab="all" class="${publishAndDataTab === 'all' ? 'active' : ''}">📑 Xem tất cả</button>
      <button data-publish-tab="conflicts" class="${publishAndDataTab === 'conflicts' ? 'active' : ''}">
        ◎ Kiểm tra xung đột ${conflicts.length ? `<b class="badge" style="background:#ef4444;color:#fff;margin-left:4px;">${conflicts.length}</b>` : '<b class="badge" style="background:#dcfce7;color:#166534;margin-left:4px;">✓ 0</b>'}
      </button>
      <button data-publish-tab="versions" class="${publishAndDataTab === 'versions' ? 'active' : ''}">
        ▱ Phiên bản & Công bố ${isPublished ? '<span style="color:#16a34a;margin-left:4px;font-weight:700;">(Đã chốt)</span>' : ''}
      </button>
      <button data-publish-tab="backup" class="${publishAndDataTab === 'backup' ? 'active' : ''}">
        💾 Sao lưu & Khôi phục
      </button>
    </div>
  `;

  let contentHtml = '';

  if (publishAndDataTab === 'all') {
    contentHtml = `
      <div style="display:flex;flex-direction:column;gap:20px;">
        ${conflictPage()}
        ${versionsPage()}
        ${settings()}
      </div>
    `;
  } else if (publishAndDataTab === 'conflicts') {
    contentHtml = conflictPage();
  } else if (publishAndDataTab === 'versions') {
    contentHtml = versionsPage();
  } else if (publishAndDataTab === 'backup') {
    contentHtml = settings();
  }

  return `
    <div class="publish-and-data-container">
      ${statsHtml}
      ${tabsHtml}
      ${contentHtml}
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
    INSPECTOR: '<span class="role-badge">GIÁM THỊ</span>',
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
        <p>Bản thử dùng Firebase để đăng nhập, Supabase để đồng bộ dữ liệu chung mỗi 15 giây. Dữ liệu cùng ô được kiểm tra xung đột trước khi lưu.</p>
        ${isAdmin() ? '<div class="dialog-actions"><button data-action="backup-all">Tải toàn bộ dữ liệu JSON</button><button data-action="backup-drive">Sao lưu lên Google Drive</button><button data-action="csv-drive">Xuất CSV lên Drive</button></div>' : ''}
        ${isOwner() ? '<button data-action="import-migration">Nhập tệp chuyển đổi vào Supabase trống</button>' : ''}
        <p>Hệ thống đồng bộ dữ liệu dùng chung lên Supabase. Bạn có thể xuất bản sao lưu JSON để lưu trữ hoặc chuyển đổi máy.</p>
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
const lessonReportsView=createLessonReportView({context:()=>({email:currentUser?.email||'',active:currentUserProfile?.active===true,view:((isVisitingTeacher()&&['class_hub','homeroom_class','weekly_menu'].includes(view))||view==='lesson_reports'||(view==='class_hub'&&(isVisitingTeacher()||['reports','all'].includes(classHubTab))))?'lesson_reports':view,hrIds:officialHomeroomClassIds(),week:timetableWeek(publishedTimetable?.data||state)||todayWeek(),weekLabel:(publishedTimetable?.data||state).school?.currentWeek||''}),rerender:()=>render(),toast:message=>toast(message)});
const weeklyMenu=createWeeklyMenu({context:()=>({email:currentUser?.email||'',active:currentUserProfile?.active===true&&currentUserProfile?.role!=='INSPECTOR'&&!isVisitingTeacher(),admin:['OWNER','ADMIN'].includes(currentUserProfile?.role),view:(view==='weekly_menu'||(view==='class_hub'&&['menu','all'].includes(classHubTab)))?'weekly_menu':view}),read:async()=>{const s=await getDoc(doc(db,'timetables','weekly_menu'));return s.exists()?s.data():null;},write:data=>setDoc(doc(db,'timetables','weekly_menu'),data),rerender:()=>render(),toast:message=>toast(message)});

const teachingAttendanceView=createTeachingAttendanceView({context:()=>({email:currentUser?.email||'',active:currentUserProfile?.active===true,teacherId:currentUserProfile?.teacherId||'',role:currentUserProfile?.role||'',hrIds:officialHomeroomClassIds(),view}),rerender:()=>render()});
const inspectionView=createInspectionView({context:()=>({email:currentUser?.email||'',active:currentUserProfile?.active===true,role:currentUserProfile?.role||'',view}),rerender:()=>render(),toast,getXLSX:loadXlsx,download});
const attendanceView=createAttendanceView({context:()=>({email:currentUser?.email||'',active:currentUserProfile?.active===true,teacherId:currentUserProfile?.teacherId||'',role:currentUserProfile?.role||'',hrIds:officialHomeroomClassIds(),view}),rerender:()=>render(),toast});

function renderClassHubPage(classes) {
  if (isVisitingTeacher()) return lessonReportsView.render();
  const pData = (publishedTimetable && publishedTimetable.isPublished && publishedTimetable.data)
    ? publishedTimetable.data
    : (state || workingDraft);
  const availableClasses = (classes && classes.length > 0)
    ? classes
    : (pData.classes || state.classes || []);
  const activeClassId = selectedHomeroomClassId || availableClasses[0]?.id;
  const currentClass = availableClasses.find(c => c.id === activeClassId) || availableClasses[0];
  const pendingReportCount = lessonReportsView?.badge() || 0;

  const statsHtml = `
    <div class="stats class-hub-stats" style="margin-bottom:16px;">
      <div class="${classHubTab === 'timetable' ? 'active-stat-card' : ''}" style="cursor:pointer;" data-class-hub-tab="timetable" title="Xem và xuất Thời khóa biểu lớp học">
        <span class="stat-icon" style="background:#fce7f3;color:#8C0D36;">🖼️</span>
        <div class="stat-content">
          <strong style="color:#8C0D36;">${currentClass ? esc(currentClass.name) : 'TKB lớp'}</strong>
          <span>Poster chuẩn VASchools</span>
        </div>
      </div>

      <div class="${classHubTab === 'reports' ? 'active-stat-card' : ''}" style="cursor:pointer;" data-class-hub-tab="reports" title="Xem và quản lý phiếu báo bài tuần">
        <span class="stat-icon" style="background:#e0f2fe;color:#0369a1;">📘</span>
        <div class="stat-content">
          <strong style="color:#0369a1;">Báo bài tuần</strong>
          <span>${pendingReportCount ? `<b style="color:#b91c1c;">${pendingReportCount} môn chờ duyệt</b>` : 'Đã đồng bộ Cloud'}</span>
        </div>
      </div>

      <div class="${classHubTab === 'menu' ? 'active-stat-card' : ''}" style="cursor:pointer;" data-class-hub-tab="menu" title="Xem thực đơn bán trú tuần">
        <span class="stat-icon" style="background:#fef3c7;color:#d97706;">🍽️</span>
        <div class="stat-content">
          <strong style="color:#d97706;">Thực đơn tuần</strong>
          <span>Thứ 2 – Thứ 6 bán trú</span>
        </div>
      </div>

      <div class="${classHubTab === 'all' ? 'active-stat-card' : ''}" style="cursor:pointer;" data-class-hub-tab="all" title="Xem tất cả 3 mục trong 1 trang">
        <span class="stat-icon" style="background:#f0fdf4;color:#15803d;">📑</span>
        <div class="stat-content">
          <strong style="color:#15803d;">Xem tất cả</strong>
          <span>Gộp 3 nội dung liên lạc</span>
        </div>
      </div>
    </div>
  `;

  const tabsHtml = `
    <div class="tabs-nav" style="margin-bottom:16px;">
      <button data-class-hub-tab="timetable" class="${classHubTab === 'timetable' ? 'active' : ''}">
        🖼️ Thời khóa biểu học sinh
      </button>
      <button data-class-hub-tab="reports" class="${classHubTab === 'reports' ? 'active' : ''}">
        📘 Báo bài tuần ${pendingReportCount ? `<b class="badge" style="background:#ef4444;color:#fff;margin-left:4px;">${pendingReportCount}</b>` : ''}
      </button>
      <button data-class-hub-tab="menu" class="${classHubTab === 'menu' ? 'active' : ''}">
        🍽️ Thực đơn bán trú
      </button>
      <button data-class-hub-tab="all" class="${classHubTab === 'all' ? 'active' : ''}">
        📑 Xem tất cả (3 trong 1)
      </button>
    </div>
  `;

  let contentHtml = '';
  if (classHubTab === 'timetable') {
    contentHtml = renderHomeroomClassTimetable(classes);
  } else if (classHubTab === 'reports') {
    contentHtml = lessonReportsView.render();
  } else if (classHubTab === 'menu') {
    contentHtml = weeklyMenu.render();
  } else if (classHubTab === 'all') {
    contentHtml = `
      <div style="display:flex;flex-direction:column;gap:24px;">
        <div style="background:#fff;border-radius:12px;padding:6px 0;box-shadow:0 2px 8px rgba(0,0,0,0.03);border:1px solid #e2e8f0;">
          <div style="padding:12px 18px 6px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;">
            <h3 style="margin:0;font-size:13.5px;color:#8C0D36;font-weight:700;">🖼️ Thời khóa biểu học sinh (VASchools)</h3>
            <button data-class-hub-tab="timetable" style="font-size:10.5px;padding:3px 9px;">Xem riêng tab TKB</button>
          </div>
          ${renderHomeroomClassTimetable(classes)}
        </div>

        <div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.03);border:1px solid #e2e8f0;">
          <div style="padding:12px 18px 6px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;">
            <h3 style="margin:0;font-size:13.5px;color:#0369a1;font-weight:700;">📘 Báo bài tuần học</h3>
            <button data-class-hub-tab="reports" style="font-size:10.5px;padding:3px 9px;">Xem riêng tab Báo bài</button>
          </div>
          ${lessonReportsView.render()}
        </div>

        <div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.03);border:1px solid #e2e8f0;">
          <div style="padding:12px 18px 6px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;">
            <h3 style="margin:0;font-size:13.5px;color:#d97706;font-weight:700;">🍽️ Thực đơn bán trú tuần</h3>
            <button data-class-hub-tab="menu" style="font-size:10.5px;padding:3px 9px;">Xem riêng tab Thực đơn</button>
          </div>
          ${weeklyMenu.render()}
        </div>
      </div>
    `;
  }

  return `
    <div class="class-hub-container">
      ${statsHtml}
      ${tabsHtml}
      ${contentHtml}
    </div>
  `;
}
function renderSubjectSelector(selectedSubjectNames = [], prefix = 'onboarding') {
  const subjects = getOnboardingSubjects(state, SEED);
  const selectedSet = new Set((selectedSubjectNames || []).map(s => String(s).trim().toLowerCase()));

  return `
    <div class="onboarding-subjects-wrapper" id="${prefix}-subjects-wrapper">
      <div class="onboarding-search-row">
        <input 
          type="text" 
          id="${prefix}-subject-search" 
          placeholder="🔍 Tìm nhanh môn học (ví dụ: Công nghệ, GDCD, Toán, Tiếng Anh...)" 
          autocomplete="off"
        >
      </div>

      <div class="onboarding-quick-chips">
        <span class="quick-chip-label">Gợi ý nhanh:</span>
        <button type="button" class="quick-chip-btn ${selectedSet.has('công nghệ') || selectedSet.has('cong nghe') ? 'active' : ''} highlight-chip" data-toggle-subject="Công nghệ" data-prefix="${prefix}">
          ✨ Công nghệ (CN)
        </button>
        <button type="button" class="quick-chip-btn ${selectedSet.has('gdcd') ? 'active' : ''}" data-toggle-subject="GDCD" data-prefix="${prefix}">
          GDCD
        </button>
        <button type="button" class="quick-chip-btn ${selectedSet.has('toán') || selectedSet.has('toan') ? 'active' : ''}" data-toggle-subject="Toán" data-prefix="${prefix}">
          Toán
        </button>
        <button type="button" class="quick-chip-btn ${selectedSet.has('ngữ văn') || selectedSet.has('ngu van') ? 'active' : ''}" data-toggle-subject="Ngữ văn" data-prefix="${prefix}">
          Ngữ văn
        </button>
        <button type="button" class="quick-chip-btn ${selectedSet.has('tiếng anh') || selectedSet.has('tieng anh') ? 'active' : ''}" data-toggle-subject="Tiếng anh" data-prefix="${prefix}">
          Tiếng Anh
        </button>
        <button type="button" class="quick-chip-btn ${selectedSet.has('tin học') || selectedSet.has('tin hoc') ? 'active' : ''}" data-toggle-subject="Tin học" data-prefix="${prefix}">
          Tin học
        </button>
      </div>

      <div class="onboarding-selected-summary">
        <span>Đã chọn: <strong id="${prefix}-selected-count">${selectedSet.size}</strong> môn</span>
        <span style="font-size:10px;color:#6b8076;">(Chọn 1 hoặc nhiều môn giảng dạy)</span>
      </div>

      <div class="onboarding-subjects-grid" id="${prefix}-subjects-list">
        ${subjects.map(s => {
          const isChecked = selectedSet.has(s.name.trim().toLowerCase());
          const isCN = s.name === 'Công nghệ' || s.code === 'CN' || s.code === 'CONG_NGHE';
          const searchData = `${s.name.toLowerCase()} ${s.code.toLowerCase()}`;
          const inputId = `${prefix}-subj-${esc(s.id)}`;
          const displayCode = (s.code === 'CONG_NGHE' ? 'CN' : s.code);
          return `
            <label class="onboarding-subject-card ${isChecked ? 'selected' : ''} ${isCN ? 'featured-cn' : ''}" for="${inputId}" data-subject-search="${esc(searchData)}">
              <input type="checkbox" name="subjects" value="${esc(s.name)}" id="${inputId}" ${isChecked ? 'checked' : ''} class="onboarding-subject-checkbox" data-prefix="${prefix}">
              <span class="subject-color-badge" style="background:${esc(s.color || '#10b981')}"></span>
              <span class="subject-name-label" title="${esc(s.name)}">${esc(s.name)}</span>
              <span class="subject-code-pill">${esc(displayCode)}</span>
              ${isCN ? '<span class="badge-new-subj">Mới</span>' : ''}
            </label>
          `;
        }).join('')}
      </div>
      <p id="${prefix}-subject-empty" style="display:none;font-size:11.5px;color:#c2410c;padding:8px;text-align:center;margin:4px 0 0;">
        Không tìm thấy môn phù hợp. Thầy/Cô có thể ghi chú thêm môn vào ô bên dưới.
      </p>
    </div>
  `;
}

export function render() {
  weeklyMenu.sync();
  lessonReportsView.sync();
  attendanceView.sync();
  inspectionView.sync();
  teachingAttendanceView.sync();
  recordCurrentScrollPositions();
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

  if(profileReadError){
    app.innerHTML='<div class="auth-overlay"><div class="login-card"><h1>Chưa tải được tài khoản</h1><p>'+esc(profileReadError)+'</p><button class="primary" data-action="retry-profile">Thử lại</button> <button data-action="logout">Đăng xuất</button></div></div>';return;
  }
  // 3. User logged in but no profile exists in database OR is editing declared profile -> Onboarding Flow
  if (!currentUserProfile || isEditingDeclaredProfile) {
    const isEditMode = Boolean(currentUserProfile && isEditingDeclaredProfile);
    const declaredSubs = currentUserProfile?.selfDeclared?.subjects || [];
    const declaredHr = currentUserProfile?.selfDeclared?.homeroomClassId || '';
    const declaredNote = currentUserProfile?.selfDeclared?.note || '';
    const teacherName = currentUserProfile?.displayName || currentUser.displayName || '';

    app.innerHTML = `
      <div class="auth-overlay">
        <div class="login-card" style="max-width:540px;text-align:left;">
          <h2 style="color:#184239;margin:0 0 6px;">${isEditMode ? 'Cập nhật môn & thông tin khai báo' : 'Hoàn thiện hồ sơ giáo viên'}</h2>
          <p style="margin-bottom:18px;">
            Chào mừng <strong>${esc(currentUser.email)}</strong>! ${isEditMode ? 'Thầy/Cô có thể chọn lại hoặc bổ sung môn giảng dạy (ví dụ: Công nghệ) và gửi lại cho Quản trị viên.' : 'Vui lòng khai báo thông tin ban đầu để Quản trị viên nhà trường xác nhận và phân quyền.'}
          </p>

          <form id="onboarding-form">
            <label>Họ và tên giáo viên
              <input name="displayName" required value="${esc(teacherName)}" placeholder="Nguyễn Văn An">
            </label>

            <label style="margin-top:14px;display:block;">
              Môn giảng dạy (Chọn một hoặc nhiều môn)
              ${renderSubjectSelector(declaredSubs, 'onboarding')}
            </label>

            <label style="margin-top:14px;display:block;">Lớp chủ nhiệm (Tự khai báo nếu có)
              <select name="homeroomClassId">
                <option value="">— Không chủ nhiệm —</option>
                ${[...((state.classes && state.classes.length) ? state.classes : (SEED.classes || []))].map(c => `<option value="${esc(c.id)}" ${declaredHr === c.id ? 'selected' : ''}>Lớp ${esc(c.name)}</option>`).join('')}
              </select>
            </label>

            <label style="margin-top:14px;display:block;">Ghi chú thêm (Ví dụ: Giáo viên thỉnh giảng, số điện thoại...)
              <input name="note" maxlength="300" value="${esc(declaredNote)}" placeholder="Thông tin liên hệ, nguyện vọng xếp lịch...">
            </label>

            <div style="margin-top:20px;display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;">
              ${isEditMode ? '<button type="button" data-action="cancel-edit-declared-profile">Hủy</button>' : '<button type="button" data-action="logout">Đăng xuất</button>'}
              <button type="submit" class="primary">${isEditMode ? 'Lưu & Cập nhật hồ sơ' : 'Gửi hồ sơ cho Quản trị viên'}</button>
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
        <div class="unauth-card" style="max-width:520px;">
          <span class="warning-badge">HỒ SƠ ĐANG CHỜ XÁC NHẬN</span>
          <h2>Hồ sơ đã được tiếp nhận</h2>
          <p>Hồ sơ của tài khoản <strong>${esc(currentUser.email)}</strong> đang chờ Ban Giám hiệu / Quản trị viên xác nhận mã giáo viên và kích hoạt quyền truy cập.</p>
          <div style="background:#f6f9f4;padding:14px;border-radius:8px;font-size:12px;text-align:left;margin:16px 0;line-height:1.7;border:1px solid #dce8db;">
            <strong>Môn đã khai báo:</strong> <span style="color:#0f5132;font-weight:700;">${esc(currentUserProfile.selfDeclared?.subjects?.join(', ') || 'Chưa chọn')}</span><br>
            <strong>Lớp chủ nhiệm:</strong> ${esc(currentUserProfile.selfDeclared?.homeroomClassId ? text(SEED.classes, currentUserProfile.selfDeclared.homeroomClassId) : 'Không chủ nhiệm')}<br>
            ${currentUserProfile.selfDeclared?.note ? `<strong>Ghi chú:</strong> ${esc(currentUserProfile.selfDeclared.note)}` : ''}
          </div>
          <p style="font-size:11px;color:#85968e;">Thầy/Cô có thể bổ sung hoặc sửa lại môn giảng dạy bất kỳ lúc nào bằng nút bên dưới.</p>
          <div style="margin-top:20px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
            <button type="button" data-action="edit-declared-profile" style="background:#184239;color:#fff;border-color:#184239;font-weight:600;">✏️ Sửa / Bổ sung môn khai báo</button>
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
  if (currentWorkspace === 'INSPECTOR') workspaceData={menu:[['inspection','📋','Thống kê điểm danh'],['attendance','✅','Điểm danh & Học sinh toàn trường']],content:()=>inspectionView.render()};
  else if (currentWorkspace === 'ADMIN') workspaceData = renderAdminWorkspace();
  else if (currentWorkspace === 'SCHEDULER') workspaceData = renderSchedulerWorkspace();
  else if (currentWorkspace === 'HOMEROOM') workspaceData = renderHomeroomWorkspace();
  else if (currentWorkspace === 'VISITING') workspaceData = renderVisitingWorkspace();
  else workspaceData = renderRegularTeacherWorkspace();

  if(view==='lesson_reports' || view==='weekly_menu') workspaceData.content=()=>renderClassHubPage();
  if(view==='inspection') workspaceData.content=()=>inspectionView.render();
  if(view==='teaching_attendance') workspaceData.content=()=>teachingAttendanceView.render();
  if(view==='attendance') workspaceData.content=()=>attendanceView.render();
  const availableWs = getAvailableWorkspaces();
  const roleNames = {
    OWNER: 'Quản trị chính',
    ADMIN: 'Quản trị viên',
    SCHEDULER: 'Người xếp lịch',
    INSPECTOR: 'Giám thị',
    TEACHER: 'Giáo viên'
  };

  app.innerHTML = `
    <button type="button" class="mobile-menu-backdrop" data-action="close-mobile-menu" aria-label="Đóng menu" ${mobileMenuOpen ? '' : 'hidden'}></button>
    <aside class="sidebar ${isSidebarCollapsed ? 'collapsed' : ''} ${mobileMenuOpen ? 'mobile-open' : ''}" id="app-sidebar" ${isMobileMenu()&&!mobileMenuOpen?'inert':''}>
      <div class="sidebar-header">
        <a class="brand" href="#" data-action="toggle-sidebar" title="${isSidebarCollapsed ? 'Mở rộng cột menu (Ctrl+B)' : 'Sổ lịch nhà trường'}">
          <span class="brand-icon">▦</span>
          <span class="brand-text">TKB<span class="brand-sub">SỔ LỊCH NHÀ TRƯỜNG</span></span>
        </a>
        <button type="button" class="sidebar-toggle-btn" data-action="toggle-sidebar" title="${isSidebarCollapsed ? 'Mở rộng cột menu (Ctrl+B)' : 'Thu gọn cột menu (Ctrl+B)'}" aria-label="Thu gọn hoặc mở rộng cột menu">
          ${isSidebarCollapsed ? '⇥' : '⇤'}
        </button>
      </div>
      <div class="sidebar-label">KHÔNG GIAN LÀM VIỆC</div>
      <nav class="sidebar-nav">
        ${workspaceData.menu
          .map(
            ([id, icon, name]) => {
              const plainName = String(name).replace(/<[^>]*>/g, '').trim();
              return `<button data-view="${id}" class="nav-button ${view === id ? 'active' : ''}" title="${esc(plainName)}">
                <span class="nav-icon">${icon}</span>
                <span class="nav-text">${name}</span>
              </button>`;
            }
          )
          .join('')}
      </nav>
      <div class="sidebar-bottom">
        <div class="sidebar-bottom-info">
          <span class="status-dot"></span> <span class="sync-text">Cloud Đồng bộ</span>
          <p>Vai trò: <strong>${roleNames[currentUserProfile.role] || currentUserProfile.role}</strong></p>
        </div>
        <button data-action="backup" class="sidebar-backup" title="Tải sao lưu JSON">
          <span class="backup-icon">↓</span>
          <span class="backup-text">Tải sao lưu JSON</span>
        </button>
      </div>
    </aside>

    <div class="workspace ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}">
      <header class="topbar">
        <div class="topbar-left">
          <button type="button" class="topbar-menu-toggle" aria-controls="app-sidebar" aria-expanded="${isMobileMenu()?mobileMenuOpen:!isSidebarCollapsed}" data-action="toggle-sidebar" title="${isSidebarCollapsed ? 'Mở rộng cột menu (Ctrl+B)' : 'Thu gọn cột menu (Ctrl+B)'}" aria-label="Thu gọn hoặc mở rộng cột menu">
            ${isMobileMenu() ? '☰' : isSidebarCollapsed ? '☰' : '⇤'}
          </button>
          <span class="topbar-school-title">${esc(state.school?.name || 'Trường THCS & THPT')}</span>
        </div>
        <div>
          <span class="year">${esc(state.school?.year || '2026-2027')} · ${esc(state.school?.term || 'HK1')} · ${esc(schoolWeekText(state.school))}</span>

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

          ${
            isSchedulerRole() && requestsList.filter(r => r && r.status === 'PENDING').length
              ? `
            <button data-view="teacher_requests" style="background:#fef3c7;color:#92400e;border:1px solid #f59e0b;padding:5px 11px;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px;" title="Xem các yêu cầu điều chỉnh lịch từ giáo viên">
              <span>📩</span>
              <span>${requestsList.filter(r => r && r.status === 'PENDING').length} yêu cầu đổi lịch</span>
            </button>
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
        ${
          isQuotaExhausted()
            ? `
          <div class="quota-warning-banner" role="alert" style="background:#fee2e2;border:1px solid #ef4444;color:#991b1b;padding:14px 18px;margin-bottom:18px;border-radius:8px;display:flex;align-items:center;justify-content:space-between;gap:16px;box-shadow:0 2px 6px rgba(0,0,0,0.06);">
            <div style="display:flex;align-items:center;gap:12px;">
              <span style="font-size:24px;">⚠️</span>
              <div>
                <strong style="font-size:13px;display:block;">Đã vượt hạn mức ghi Firestore trong ngày (Resource Exhausted)</strong>
                <span style="font-size:12px;opacity:0.9;">Hệ thống đã dừng tất cả thao tác ghi trong phiên này để bảo vệ ứng dụng. Dữ liệu hiện tại vẫn đầy đủ, hãy tải ngay bản sao lưu JSON về máy tính.</span>
              </div>
            </div>
            <button data-action="backup" class="primary" style="background:#b91c1c;color:#fff;border:none;padding:8px 16px;font-size:12px;font-weight:700;border-radius:6px;cursor:pointer;white-space:nowrap;">↓ Tải sao lưu JSON ngay</button>
          </div>
        `
            : ''
        }
        <div class="page-heading">
          <div>
            <div class="eyebrow">LẬP LỊCH • ${esc(state.school?.term || 'HK1')}</div>
            <h1>${isVisitingTeacher() && ['class_hub','homeroom_class','weekly_menu','lesson_reports'].includes(view) ? 'Báo bài tuần' : titles[view] || view}</h1>
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
            ${view === 'published_all' || (view === 'matrix' && (showPublished || activeVersion === 'published')) ? '<button data-action="published-excel">↓ Excel TKB đã công bố</button>' : ''}
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
  restoreCurrentScrollPositions();
}

// ----------------------------------------------------
// Dialog Openers & Editors
// ----------------------------------------------------
function openDialog(html) {
  dialog.innerHTML = html;
  if (!dialog.open) dialog.showModal();
}
const closeButton = '<button type="button" data-action="close" class="icon-button" aria-label="Đóng">×</button>';

// ----------------------------------------------------
// Assignment Tray & Localized Suggestion Engine
// ----------------------------------------------------
function renderAssignmentTray(s, classes) {
  if (matrixViewMode !== 'timetable') return '';
  const isReadonly = !canEditWorking();
  if (isReadonly) return '';

  if (!traySelectedClassId || !classes.some(c => c.id === traySelectedClassId)) {
    traySelectedClassId = classes[0]?.id || '';
  }
  const currentClass = (s.classes || []).find(c => c.id === traySelectedClassId);
  const classAssignments = (workingDraft.draftAssignments || []).filter(a => a.classId === traySelectedClassId && subjectsForClass(workingDraft,traySelectedClassId).some(s=>s.id===a.subjectId));

  return `
    <div class="assignment-tray-wrapper ${trayPosition === 'right' ? 'tray-right-dock' : 'tray-top-dock'}">
      <div class="assignment-tray-bar">
        <div class="tray-header-left">
          <span class="tray-title-badge">📌 Khay thẻ phân công</span>
          <div class="tray-class-picker">
            <span class="tray-picker-label">Lớp:</span>
            <select id="tray-class-select" data-action="tray-select-class" class="tray-select" aria-label="Chọn lớp trong khay thẻ">
              ${classes.map(c => `<option value="${esc(c.id)}" ${c.id === traySelectedClassId ? 'selected' : ''}>${esc(c.name)} (${c.grade < 10 ? 'THCS' : 'THPT'} - K${c.grade})</option>`).join('')}
            </select>
          </div>
          <span class="tray-class-count">${classAssignments.length} môn đã phân công</span>
        </div>

        <div class="tray-header-right">
          <div class="tray-pos-toggle">
            <button type="button" data-action="set-tray-top" class="tray-pos-btn ${trayPosition === 'top' ? 'active' : ''}" title="Đặt khay phía trên bảng">⬒ Trên bảng</button>
            <button type="button" data-action="set-tray-right" class="tray-pos-btn ${trayPosition === 'right' ? 'active' : ''}" title="Đặt khay cột bên phải">◧ Cột bên phải</button>
          </div>
          ${armedCard ? `
            <div class="armed-indicator">
              <span>🎯 Đang cọ: <strong>${esc(text(s.subjects || [], armedCard.subjectId))}</strong> (${esc(text(s.teachers || [], armedCard.teacherId, 'fullName'))})</span>
              <button type="button" data-action="disarm-card" class="disarm-btn" title="Hủy kích hoạt cọ">✕ Hủy chọn</button>
            </div>
          ` : ''}
        </div>
      </div>

      <div class="tray-cards-container">
        ${classAssignments.length ? classAssignments.map(a => {
          const subj = (s.subjects || []).find(x => x.id === a.subjectId);
          const tea = (s.teachers || []).find(x => x.id === a.teacherId);
          const isArmed = armedCard && armedCard.classId === a.classId && armedCard.subjectId === a.subjectId && armedCard.teacherId === a.teacherId;
          const assignedSlotsCount = allLessons(workingDraft).filter(c => c.classId === a.classId && c.subjectId === a.subjectId).length;

          return `
            <div class="assignment-card ${isArmed ? 'armed' : ''}"
                 draggable="true"
                 data-tray-card="true"
                 data-class="${esc(a.classId)}"
                 data-subject="${esc(a.subjectId)}"
                 data-teacher="${esc(a.teacherId)}"
                 data-action="toggle-arm-card"
                 style="--subject-color: ${esc(subj?.color || '#3b82f6')};"
                 title="Click để kích hoạt cọ gán liên tiếp hoặc Kéo thả vào ô lịch">
              <div class="card-color-stripe" style="background-color: ${esc(subj?.color || '#3b82f6')};"></div>
              <div class="card-body">
                <div class="card-subject-row">
                  <strong class="card-subject-name">${esc(subj?.name || 'Môn học')}</strong>
                  <span class="card-subject-code">${esc(subj?.code || '')}</span>
                </div>
                <div class="card-teacher-row">
                  <span class="card-teacher-name">👨‍🏫 ${esc(tea?.fullName || 'Chưa gán GV')}</span>
                  <span class="card-count-badge" title="Số tiết đã xếp">${assignedSlotsCount} tiết</span>
                </div>
                ${isArmed ? `<div class="card-armed-tag">✓ Đang chọn cọ (Click ô để gán)</div>` : ''}
              </div>
            </div>
          `;
        }).join('') : `
          <div class="tray-empty-hint">
            <span>ℹ️ Lớp <strong>${esc(currentClass?.name || '')}</strong> chưa có môn nào được phân công. Hãy sang tab <strong>📋 Ma trận phân công (Môn - Lớp)</strong> để gán giáo viên.</span>
          </div>
        `}
      </div>
    </div>
  `;
}

let grade11Track = 'TN';
function openTimetableCellPopover({ classId, timeSlotId, day, period, anchorElement }) {
  closePopover();
  if (!canEditWorking()) return;

  const cls = (workingDraft.classes || []).find(c => c.id === classId);
  const slot = (workingDraft.timeSlots || []).find(s => s.id === timeSlotId);
  const dayLabel = `Thứ ${day}`;
  const currentCell = (workingDraft.timetableCells || []).find(
    c => c.classId === classId && (c.timeSlotId === timeSlotId || (c.day === dayLabel && c.period === period))
  ) || (workingDraft.draftSchedule || []).find(
    c => c.classId === classId && (c.timeSlotId === timeSlotId || (c.day === dayLabel && c.period === period))
  );
  const isCellLocked = Boolean(currentCell?.locked);

  // Check special fixed subjects
  const chaoCoSubj = (workingDraft.subjects || []).find(s =>
    s.id === 'subj_special_chao_co' ||
    s.code === 'CHAO_CO' ||
    s.name?.toLowerCase().includes('chào cờ') ||
    s.name?.toLowerCase().includes('chao co')
  );
  const shlSubj = (workingDraft.subjects || []).find(s =>
    s.id === 'subj_hdtn_hn' ||
    s.code === 'HDTN_HN' ||
    s.name?.toLowerCase().includes('hđtn') ||
    s.name?.toLowerCase().includes('sinh hoạt')
  );
  const eslSubj = (workingDraft.subjects || []).find(s =>
    s.id === 'subj_ta_esl' ||
    s.code === 'TA_ESL' ||
    s.name?.toLowerCase().includes('esl') ||
    s.name?.toLowerCase().includes('tiếng anh esl')
  );
  const clbSubj = (workingDraft.subjects || []).find(s =>
    s.id === 'subj_clb' ||
    s.code === 'CLB' ||
    s.name?.toLowerCase().includes('câu lạc bộ') ||
    s.name?.toLowerCase().includes('clb')
  );

  const isChaoCo = Boolean(currentCell && (currentCell.subjectId === chaoCoSubj?.id || currentCell.note?.includes('Chào cờ')));
  const isSHL = Boolean(currentCell && (currentCell.note?.includes('Sinh hoạt lớp') || (!isChaoCo && currentCell.subjectId === shlSubj?.id)));
  const isESL = Boolean(currentCell && (currentCell.subjectId === eslSubj?.id || currentCell.note?.includes('ESL')));
  const isCLB = Boolean(currentCell && (currentCell.subjectId === clbSubj?.id || currentCell.note?.includes('CLB') || currentCell.note?.includes('Câu lạc bộ')));
  const homeroomTeacher = (workingDraft.teachers || []).find(t => t.id === cls?.homeroomTeacherId);

  // Suggestion list: ONLY filter { subject, teacher } pairs from draftAssignments with classId === classId
  const classAssignments = (workingDraft.draftAssignments || []).filter(a => a.classId === classId && subjectsForClass(workingDraft,classId).some(s=>s.id===a.subjectId) && (cls?.grade!==11 || ['COMMON',grade11Track].includes(subjectTrack(workingDraft.subjects.find(s=>s.id===a.subjectId)))));

  const rect = anchorElement.getBoundingClientRect();
  const popoverWidth = 320;
  let left = rect.left;
  if (left + popoverWidth > window.innerWidth - 12) {
    left = window.innerWidth - popoverWidth - 12;
  }
  if (left < 10) left = 10;

  let top = rect.bottom + 6;
  if (top + 450 > window.innerHeight) {
    top = Math.max(10, rect.top - 440);
  }

  const sessionText = (slot ? slot.session === 'MORNING' : period <= 5) ? 'Sáng' : 'Chiều';
  const periodText = slot?.period || (period > 5 ? period - 5 : period);

  const container = document.createElement('div');
  container.id = 'active-matrix-popover-root';
  Object.assign(container.dataset,{timetableClass:classId,timetableSlot:timeSlotId,timetableDay:String(day),timetablePeriod:String(period)});
  const slotRegistrations=registrationSlotIndex(workingDraft,availabilityRecords);
  container.innerHTML = `
    <div class="matrix-popover-overlay" data-action="close-popover"></div>
    <div class="matrix-popover timetable-popover" style="top:${top}px;left:${left}px;width:${popoverWidth}px;max-height:85vh;overflow-y:auto;">
      <div class="popover-header">
        <div>
          <div style="font-size:12px;color:#184239;font-weight:700;">Lớp ${esc(cls?.name || '')}</div>
          <div style="font-size:10px;color:#60766b;">${dayLabel} · ${sessionText} Tiết ${periodText} (${esc(slot?.startTime || '')} - ${esc(slot?.endTime || '')})</div>
        </div>
        <button type="button" class="popover-close-btn" data-action="close-popover" title="Đóng">✕</button>
      </div>

      ${currentCell ? `
        <div class="popover-lock-bar ${isCellLocked ? 'locked' : 'unlocked'}">
          <div style="min-width:0;flex:1;">
            <strong style="font-size:11px;color:${isCellLocked ? '#991b1b' : '#166534'};display:block;">
              ${isCellLocked ? '🔒 Tiết đang khóa cố định' : '🔓 Tiết đang mở (tự do)'}
            </strong>
            <small style="font-size:9px;color:${isCellLocked ? '#b91c1c' : '#15803d'};display:block;margin-top:1px;">
              ${isCellLocked ? 'Mở khóa nếu cần đổi môn, đổi giáo viên hoặc xóa tiết này' : 'Có thể khóa để tránh xáo trộn ngoài ý muốn'}
            </small>
          </div>
          <button type="button" class="btn-popover-toggle-lock ${isCellLocked ? 'unlock' : 'lock'}"
                  data-action="popover-toggle-lock"
                  data-class="${esc(classId)}"
                  data-slot="${esc(timeSlotId)}"
                  title="${isCellLocked ? 'Nhấp để mở khóa tiết học này' : 'Nhấp để khóa cố định tiết học này'}">
            ${isCellLocked ? '🔓 Mở khóa tiết' : '🔒 Khóa tiết'}
          </button>
        </div>
      ` : ''}

      <!-- MỤC HOẠT ĐỘNG CỐ ĐỊNH / CHUNG (CHÀO CỜ, SHL, TA ESL, CLB) -->
      <div class="popover-section-label" style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;">
        <span>HOẠT ĐỘNG CỐ ĐỊNH / CHUNG</span>
        <span style="font-size:9px;color:#059669;font-weight:700;">Toàn trường</span>
      </div>
      <div class="popover-special-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;">
        <!-- Chào cờ -->
        <button type="button" class="popover-suggestion-item free ${isChaoCo ? 'selected' : ''}"
                data-action="assign-special-activity"
                data-type="chao_co"
                data-class="${esc(classId)}"
                data-slot="${esc(timeSlotId)}"
                data-day="${day}"
                data-period="${period}"
                style="padding:6px 8px;border-radius:6px;${isChaoCo ? 'background:#fef2f2;border:1px solid #f87171;' : 'border:1px solid #e2e8f0;'}"
                title="Gán tiết Chào cờ (HĐTN-HN: Sinh hoạt dưới cờ)">
          <i class="item-color-dot" style="background:#dc2626;"></i>
          <div class="item-info" style="min-width:0;flex:1;">
            <strong style="font-size:11px;color:${isChaoCo ? '#991b1b' : 'inherit'};display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">🚩 Chào cờ</strong>
            <span class="teacher-free-label" style="font-size:9px;color:#64748b;display:block;">Toàn trường</span>
          </div>
          ${isChaoCo ? '<span class="item-current-badge" style="background:#dc2626;color:#fff;font-size:9px;padding:2px 5px;">✓</span>' : '<span class="item-assign-action" style="background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;font-size:9px;padding:2px 5px;">Chọn</span>'}
        </button>

        <!-- Sinh hoạt lớp -->
        <button type="button" class="popover-suggestion-item free ${isSHL ? 'selected' : ''}"
                data-action="assign-special-activity"
                data-type="sinh_hoat_lop"
                data-class="${esc(classId)}"
                data-slot="${esc(timeSlotId)}"
                data-day="${day}"
                data-period="${period}"
                style="padding:6px 8px;border-radius:6px;${isSHL ? 'background:#eef2ff;border:1px solid #818cf8;' : 'border:1px solid #e2e8f0;'}"
                title="Gán tiết Sinh hoạt lớp với GVCN">
          <i class="item-color-dot" style="background:#4f46e5;"></i>
          <div class="item-info" style="min-width:0;flex:1;">
            <strong style="font-size:11px;color:${isSHL ? '#3730a3' : 'inherit'};display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">🏫 SH Lớp</strong>
            <span class="teacher-free-label" style="font-size:9px;color:#64748b;display:block;">GVCN</span>
          </div>
          ${isSHL ? '<span class="item-current-badge" style="background:#4f46e5;color:#fff;font-size:9px;padding:2px 5px;">✓</span>' : '<span class="item-assign-action" style="background:#e0e7ff;color:#4338ca;border:1px solid #c7d2fe;font-size:9px;padding:2px 5px;">Chọn</span>'}
        </button>

        <!-- TA ESL -->
        <button type="button" class="popover-suggestion-item free ${isESL ? 'selected' : ''}"
                data-action="assign-special-activity"
                data-type="ta_esl"
                data-class="${esc(classId)}"
                data-slot="${esc(timeSlotId)}"
                data-day="${day}"
                data-period="${period}"
                style="padding:6px 8px;border-radius:6px;${isESL ? 'background:#f5f3ff;border:1px solid #8b5cf6;' : 'border:1px solid #e2e8f0;'}"
                title="Gán tiết Tiếng Anh ESL">
          <i class="item-color-dot" style="background:#6366f1;"></i>
          <div class="item-info" style="min-width:0;flex:1;">
            <strong style="font-size:11px;color:${isESL ? '#5b21b6' : 'inherit'};display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">🌐 TA ESL</strong>
            <span class="teacher-free-label" style="font-size:9px;color:#64748b;display:block;">Tiếng Anh ESL</span>
          </div>
          ${isESL ? '<span class="item-current-badge" style="background:#6366f1;color:#fff;font-size:9px;padding:2px 5px;">✓</span>' : '<span class="item-assign-action" style="background:#ede9fe;color:#5b21b6;border:1px solid #ddd6fe;font-size:9px;padding:2px 5px;">Chọn</span>'}
        </button>

        <!-- CLB -->
        <button type="button" class="popover-suggestion-item free ${isCLB ? 'selected' : ''}"
                data-action="assign-special-activity"
                data-type="clb"
                data-class="${esc(classId)}"
                data-slot="${esc(timeSlotId)}"
                data-day="${day}"
                data-period="${period}"
                style="padding:6px 8px;border-radius:6px;${isCLB ? 'background:#ecfdf5;border:1px solid #10b981;' : 'border:1px solid #e2e8f0;'}"
                title="Gán tiết Câu lạc bộ (CLB)">
          <i class="item-color-dot" style="background:#059669;"></i>
          <div class="item-info" style="min-width:0;flex:1;">
            <strong style="font-size:11px;color:${isCLB ? '#065f46' : 'inherit'};display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">🎯 CLB</strong>
            <span class="teacher-free-label" style="font-size:9px;color:#64748b;display:block;">Câu lạc bộ</span>
          </div>
          ${isCLB ? '<span class="item-current-badge" style="background:#059669;color:#fff;font-size:9px;padding:2px 5px;">✓</span>' : '<span class="item-assign-action" style="background:#d1fae5;color:#047857;border:1px solid #a7f3d0;font-size:9px;padding:2px 5px;">Chọn</span>'}
        </button>
      </div>

      <div class="popover-section-label">
        <span>GỢI Ý TỪ PHÂN CÔNG LỚP (${classAssignments.length} môn)</span>
      </div>

      ${cls?.grade===11?`<label>Tổ hợp lớp 11 <select id="grade11-popover-track" data-class="${esc(classId)}" data-slot="${esc(timeSlotId)}"><option value="TN" ${grade11Track==='TN'?'selected':''}>Tự nhiên</option><option value="XH" ${grade11Track==='XH'?'selected':''}>Xã hội</option></select></label>`:''}
      <input type="search" class="popover-search" id="timetable-suggestion-search" placeholder="Tìm môn hoặc giáo viên (có/không dấu)..." aria-label="Tìm môn hoặc giáo viên" autocomplete="off">
      <div id="timetable-suggestion-warning" role="alert" style="color:#b91c1c;font-size:12px;margin:6px 0;" hidden></div>
      <div id="timetable-suggestion-empty" role="status" style="padding:8px;color:#64748b;" hidden>Không tìm thấy môn hoặc giáo viên phù hợp.</div>
      <div class="popover-suggestions-list" id="timetable-suggestions-list">
        ${classAssignments.length ? classAssignments.map(a => {
          const subj = (workingDraft.subjects || []).find(x => x.id === a.subjectId);
          const tea = (workingDraft.teachers || []).find(x => x.id === a.teacherId);
          const searchLabel = esc([subj?.name,subj?.code,tea?.fullName,tea?.code].filter(Boolean).join(" "));
          const teaColor = a.teacherId ? getTeacherColor(workingDraft, a.teacherId) : (subj?.color || '#3b82f6');
          const busyInfo = lessonBusy(workingDraft,{teacherId:a.teacherId,classId,timeSlotId:slot?.id,subjectId:a.subjectId});
          const registration=registrationForSlot(slotRegistrations,a.teacherId,timeSlotId);
          const registrationText=availabilityLoadState!=='ready'?'Chưa đối chiếu được đăng ký rảnh/bận':registration?registrationDetail(registration,slot):'Chưa đăng ký rảnh/bận cho tiết này';
          const registrationHtml=`<span class="suggestion-registration ${registration?.status==='busy'?'is-busy':''}">${registration?.status==='busy'?'⚠ ':''}${esc(registrationText)}</span>`;
          const isCurrent = currentCell && currentCell.subjectId === a.subjectId && currentCell.teacherId === a.teacherId;

          if (busyInfo.isBusy) {
            return `
              <div class="popover-suggestion-item busy" data-suggestion-search="${searchLabel}" title="${esc(tea?.fullName || 'GV')} bận tại ${esc(busyInfo.conflictingClass?.name || 'lớp khác')}">
                <i class="item-color-dot" style="background:${esc(teaColor)};"></i>
                <div class="item-info">
                  <strong>${esc(subj?.name || 'Môn học')}</strong>
                  <span class="teacher-busy-label">⛔ ${esc(tea?.fullName || 'GV')} bận tại ${esc(busyInfo.conflictingClass?.name || 'lớp khác')}</span>${registrationHtml}
                </div>
              </div>
            `;
          }

          return `
            <button type="button" class="popover-suggestion-item free ${isCurrent ? 'selected' : ''} ${registration?.status==='busy'?'registration-busy-suggestion':''}"
                    data-suggestion-search="${searchLabel}"
                    data-action="assign-popover-suggestion"
                    data-class="${esc(classId)}"
                    data-slot="${esc(timeSlotId)}"
                    data-day="${day}"
                    data-period="${period}"
                    data-subject="${esc(a.subjectId)}"
                    data-teacher="${esc(a.teacherId)}">
              <i class="item-color-dot" style="background:${esc(teaColor)};"></i>
              <div class="item-info">
                <strong>${esc(subj?.name || 'Môn học')}</strong>
                <span class="teacher-free-label" style="display:flex;align-items:center;gap:4px;"><i style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${esc(teaColor)};flex-shrink:0;"></i>👨‍🏫 ${esc(tea?.fullName || 'Chưa gán GV')} · Không trùng tiết dạy</span>${registrationHtml}
              </div>
              ${isCurrent ? '<span class="item-current-badge">✓ Đang gán</span>' : '<span class="item-assign-action">Gán</span>'}
            </button>
          `;
        }).join('') : `
          <div style="padding:10px;text-align:center;color:#6b7280;font-size:11px;">
            Lớp <strong>${esc(cls?.name || '')}</strong> chưa có môn nào trong Ma trận phân công.
            <div style="margin-top:6px;">
              <button type="button" class="popover-goto-matrix-btn" data-set-matrix-mode="assignment">Chuyển sang Ma trận phân công</button>
            </div>
          </div>
        `}
      </div>

      <button type="button" data-action="open-substitute" data-class="${esc(classId)}" data-slot="${esc(timeSlotId)}" data-track="${cls?.grade===11?(subjectTrack(workingDraft.subjects.find(s=>s.id===currentCell?.subjectId))==='COMMON'?'COMMON':grade11Track):''}" style="width:100%;margin-top:10px;white-space:normal">⇄ Chọn giáo viên dạy thay (ngoài phân công)</button>
      <div class="popover-footer" style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding-top:8px;margin-top:8px;border-top:1px solid #e2e8f0;">
        <div style="display:flex;align-items:center;gap:8px;">
          ${currentCell ? `
            <button type="button" class="btn-popover-toggle-lock" data-action="popover-toggle-lock"
                    data-class="${esc(classId)}" data-slot="${esc(timeSlotId)}"
                    style="background:none;border:none;color:${isCellLocked ? '#dc2626' : '#16a34a'};font-size:10px;font-weight:700;cursor:pointer;padding:0;text-decoration:underline;">
              ${isCellLocked ? '🔓 Mở khóa' : '🔒 Khóa tiết'}
            </button>
          ` : ''}
          <button type="button" data-action="open-cell-full-editor" data-class="${esc(classId)}" data-slot="${esc(timeSlotId)}"
                  style="background:none;border:none;color:#475569;font-size:10px;font-weight:600;cursor:pointer;padding:0;text-decoration:underline;">
            ✏️ Môn khác / Nhập tay
          </button>
        </div>
        ${currentCell ? `
          <button type="button" class="popover-clear-slot-btn"
                  data-action="popover-clear-slot" data-track="${cls?.grade===11?(subjectTrack(workingDraft.subjects.find(s=>s.id===currentCell.subjectId))==='COMMON'?'COMMON':grade11Track):''}"
                  data-class="${esc(classId)}"
                  data-slot="${esc(timeSlotId)}"
                  data-day="${day}"
                  data-period="${period}"
                  style="width:auto;padding:5px 10px;margin:0;">
            ✕ Xóa tiết
          </button>
        ` : ''}
      </div>
    </div>
  `;
  document.body.appendChild(container);
}

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

function substituteTeacherOptions(form){
 const classId=form.dataset.class,timeSlotId=form.dataset.slot,subjectId=form.elements.subjectId.value,selected=form.elements.teacherId.value;
 const query=form.querySelector('#substitute-search').value,index=registrationSlotIndex(workingDraft,availabilityRecords);
 const known=t=>(t.assignments||[]).some(a=>a.subjectId===subjectId)||(workingDraft.draftAssignments||[]).some(a=>a.teacherId===t.id&&a.subjectId===subjectId);
 const teachers=[...(workingDraft.teachers||[])].filter(t=>matchesSuggestionSearch(query,t.fullName,t.code)).sort((a,b)=>Number(known(b))-Number(known(a))||a.fullName.localeCompare(b.fullName,'vi'));
 form.elements.teacherId.innerHTML='<option value="">— Chọn giáo viên thực tế dạy thay —</option>'+teachers.map(t=>{const conflict=lessonBusy(workingDraft,{teacherId:t.id,classId,timeSlotId,subjectId}),registration=registrationForSlot(index,t.id,timeSlotId);const status=conflict.isBusy?'TRÙNG LỊCH: '+(conflict.conflictingClass?.name||'lớp khác'):registration?.status==='busy'?'ĐÃ ĐĂNG KÝ BẬN':known(t)?'Đã có phân công môn này':'Ngoài phân công môn này';return `<option value="${esc(t.id)}" ${t.id===selected?'selected':''} ${conflict.isBusy?'disabled':''}>${esc(t.fullName)} (${esc(t.code)}) — ${esc(status)}</option>`;}).join('');
 const official=getAssignedTeacher(workingDraft,classId,subjectId);
 form.querySelector('#substitute-official').textContent='Giáo viên phân công chính: '+(official?.fullName||'Chưa có')+'. Giáo viên được chọn bên dưới sẽ nhận tiết này trong lịch cá nhân sau khi công bố.';
}
function openSubstituteEditor(classId,timeSlotId,track=''){
 if(!canEditWorking())return;
 const cls=workingDraft.classes.find(c=>c.id===classId),slot=workingDraft.timeSlots.find(t=>t.id===timeSlotId),parent=workingDraft.timetableCells.find(c=>c.classId===classId&&c.timeSlotId===timeSlotId);
 if(parent?.locked){toast('Hãy mở khóa tiết trước khi chọn giáo viên dạy thay.');return;}
 const existing=cellLessons(workingDraft,parent).find(l=>!track||l.track===track),subjects=subjectsForClass(workingDraft,classId,cls?.grade===11?track:'');
 const subjectId=existing?.subjectId||(workingDraft.draftAssignments||[]).find(a=>a.classId===classId&&subjects.some(s=>s.id===a.subjectId))?.subjectId||subjects[0]?.id;
 closePopover();openDialog(`<form id="substitute-form" data-class="${esc(classId)}" data-slot="${esc(timeSlotId)}" data-track="${esc(track)}"><div class="dialog-title"><div><h2>Chọn giáo viên dạy thay</h2><p>${esc(cls?.name)} · Thứ ${slot?.dayOfWeek} · ${slot?.session==='MORNING'?'Sáng':'Chiều'} tiết ${slot?.period}</p></div>${closeButton}</div><label>Môn học<select name="subjectId" id="substitute-subject">${selectOptions(subjects,subjectId,'name','— Chọn môn —')}</select></label><p id="substitute-official" class="field-help"></p><label>Tìm tên hoặc mã giáo viên<input type="search" id="substitute-search" autocomplete="off" placeholder="Nhập tên giáo viên…"></label><label>Giáo viên thực tế dạy thay<select name="teacherId" required></select></label><p class="field-help">Có thể chọn giáo viên ngoài phân công môn–lớp. Người xếp lịch xác nhận chuyên môn phù hợp. Không đổi phân công chính; giáo viên trùng tiết dạy sẽ bị chặn. Lịch bận đã đăng ký vẫn được cảnh báo.</p><label>Ghi chú (nếu có)<input name="note" maxlength="200" value="${esc(existing?.note||'')}"></label><div id="form-error" class="form-error" role="alert"></div><div class="dialog-actions"><button type="button" data-action="close">Hủy</button><button type="submit" class="primary">Lưu giáo viên dạy thay</button></div></form>`);
 substituteTeacherOptions(document.querySelector('#substitute-form'));
}
document.addEventListener('input',e=>{if(e.target.id==='substitute-search')substituteTeacherOptions(e.target.closest('form'));});
document.addEventListener('change',e=>{if(e.target.id==='substitute-subject')substituteTeacherOptions(e.target.closest('form'));});

function cellEditor(classId, timeSlotId, selectedTrack = '') {
  recordCurrentScrollPositions();
  if (!canEditWorking()) {
    toast('Chỉ Người xếp lịch hoặc Quản trị viên mới được sửa ô ở bản nháp.');
    return;
  }
  const cls = (state.classes || []).find(c => c.id === classId);
  const slot = (state.timeSlots || []).find(s => s.id === timeSlotId);
  const containerCell = (state.timetableCells || []).find(c => c.classId === classId && c.timeSlotId === timeSlotId);
  const chosenTrack = selectedTrack || (containerCell ? subjectTrack(state.subjects.find(s=>s.id===containerCell.subjectId)) : 'COMMON') || 'COMMON';
  const cell = cls?.grade===11 ? cellLessons(state,containerCell).find(l=>l.track===chosenTrack) : containerCell;
  const allowedSubjects=subjectsForClass(state,classId,cls?.grade===11?chosenTrack:'');
  const currentSub = cell ? (state.subjects || []).find(s => s.id === cell.subjectId) : null;
  const currentTea = cell ? (state.teachers || []).find(t => t.id === cell.teacherId) : null;
  const locked = !!cell?.locked;

  openDialog(`
    <form id="cell-form" data-class="${esc(classId)}" data-slot="${esc(timeSlotId)}" data-track="${cls?.grade===11?chosenTrack:''}">
      <div class="dialog-title">
        <div>
          <div class="eyebrow">CHỈNH SỬA & NHẬP LIỆU Ô LỊCH</div>
          <h2>${esc(cls?.name || '')}</h2>
          <p>Thứ ${slot?.dayOfWeek || ''} · ${slot?.session === 'MORNING' ? 'Sáng' : 'Chiều'} tiết ${slot?.period || ''} · ${esc(slot?.startTime || '')}–${esc(slot?.endTime || '')}</p>
        </div>
        ${closeButton}
      </div>
      ${locked ? '<div class="notice">Ô đã khóa. Mở khóa để thay đổi môn, giáo viên hoặc xóa.</div>' : ''}
      ${cls?.grade===11?`<label>Tổ hợp <select id="grade11-editor-track" data-class="${esc(classId)}" data-slot="${esc(timeSlotId)}">${[['COMMON','Môn chung'],['TN','Tự nhiên'],['XH','Xã hội']].map(([v,n])=>`<option value="${v}" ${chosenTrack===v?'selected':''}>${n}</option>`).join('')}</select></label>`:''}
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
                ${allowedSubjects.map(s => `<option value="${esc(s.name)}">${esc(s.code)} · ${esc(s.name)}</option>`).join('')}
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
              <select name="subjectId" id="cell-subject-select">${selectOptions(allowedSubjects, cell?.subjectId, 'name', '— Chọn môn học —')}</select>
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
          <button type="button" data-action="delete-cell" data-class="${esc(classId)}" data-slot="${esc(timeSlotId)}" data-track="${cls?.grade===11?chosenTrack:''}" class="danger-link" ${locked ? 'disabled' : ''}>
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
        <label>Giáo viên chủ nhiệm 1
          <select name="homeroomTeacherId">${selectOptions(state.teachers || [], item.homeroomTeacherId, 'fullName', '— Chưa có GVCN —')}</select>
        </label>
        <label>Giáo viên chủ nhiệm 2
          <select name="coHomeroomTeacherId">${selectOptions(state.teachers || [], item.coHomeroomTeacherId, 'fullName', '— Chưa có GVCN thứ hai —')}</select>
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

function posterWeekInfo(school={}) {
 const raw=String(school.currentWeek??'').trim()||String(school.week??'').trim();
 const weekLabel=raw?(/^\d+$/.test(raw)?'Tuần '+raw:raw):'Chưa đặt tuần học';
 const dateLabel=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')?value.split('-').reverse().join('/'):String(value||'').trim();
 const range=school.weekStartDate&&school.weekEndDate?[school.weekStartDate,school.weekEndDate].map(dateLabel).join(' – '):String(school.weekDates||'').trim()||dateLabel(school.appliedDate);
 return {weekLabel,caption:range?weekLabel+': '+range:weekLabel};
}

function schoolWeekText(school={}) {
 const dateLabel=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')?v.split('-').reverse().join('/'):'';
 const range=school.weekStartDate&&school.weekEndDate?dateLabel(school.weekStartDate)+' – '+dateLabel(school.weekEndDate):(school.weekDates||'Chưa đặt khoảng ngày');
 return (school.currentWeek||'Chưa đặt tuần học')+' · '+range;
}

function schoolEditor() {
  if (!isSchedulerRole()) return;
  openDialog(`
    <form id="school-form">
      <div class="dialog-title">
        <h2>Thông tin nhà trường</h2>
        ${closeButton}
      </div>
      ${[['name', 'Tên trường'], ['year', 'Năm học'], ['term', 'Học kỳ'], ['currentWeek', 'Tuần học (ví dụ: Tuần 9)'], ['weekStartDate', 'Từ ngày'], ['weekEndDate', 'Đến ngày'], ['appliedDate', 'Áp dụng từ']]
        .map(([key, label]) => `<label>${label}<input name="${key}" value="${esc(state.school?.[key] || '')}" ${['appliedDate','weekStartDate','weekEndDate'].includes(key) ? 'type="date"' : 'required maxlength="120"'}></label>`)
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
          <option value="INSPECTOR" ${acc?.role === 'INSPECTOR' ? 'selected' : ''}>INSPECTOR (Giám thị · điểm danh và quản lý học sinh)</option>
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
        • Lớp chủ nhiệm: ${esc(acc.selfDeclared?.homeroomClassId ? text(state.classes || [], acc.selfDeclared.homeroomClassId) : 'Không chủ nhiệm')}<br>
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
function integrationDialog(){
 openDialog(`<div class="dialog-title"><h2>AI & Kết nối</h2>${closeButton}</div>
 ${isSchedulerRole()?`<section class="card"><h3>AI hỗ trợ xếp lịch</h3><p>Đề xuất tối đa 5 tiết di chuyển vào ô trống. Kiểm tra trùng lịch và xem trước trước khi áp dụng. Gửi mã lớp, môn, giáo viên và lịch tiết sang Gemini; không gửi email, hồ sơ hay khóa truy cập.</p><label>Yêu cầu<input id="ai-instruction" maxlength="500" placeholder="Ví dụ: giảm tiết trống cho giáo viên"></label><button data-action="ai-suggest">Tạo đề xuất AI</button><p id="ai-feedback" role="status"></p></section>`:''}
 <section class="card"><h3>Google Calendar</h3><p>Đồng bộ lịch giảng dạy đã chốt của chính bạn vào lịch Google chính. Thêm/cập nhật cùng mã, không tự xóa sự kiện cũ. Khi có tiết bị hủy, hãy xóa sự kiện cũ trong Google Calendar.</p><button data-action="calendar-connect">Kết nối & xem trước</button><button data-action="calendar-ics">Tải lịch ICS</button></section>
 <section class="card"><h3>Google Drive</h3><p>Chỉ xin quyền đối với tệp do app tạo. Mỗi lần tạo một bản riêng, không ghi đè bản sao cũ.</p>${isAdmin()?'<button data-action="backup-drive">Sao lưu toàn bộ dữ liệu</button>':''}<button data-action="csv-drive">Lưu lịch CSV</button><button data-action="poster-drive">Lưu ảnh TKB lớp đang xem</button></section>`);
}
async function personalCalendarEvents(){if(!publishedTimetable?.isPublished)throw Error('Chưa có thời khóa biểu đã chốt.');const teacherId=currentUserProfile?.teacherId;if(!teacherId)throw Error('Quản trị viên cần gắn hồ sơ giáo viên cho tài khoản này.');return calendarEvents(publishedTimetable.data,teacherId);}
let calendarPreview=null;
function downloadLocalDraft(){
 const local=isSchedulerRole()?workingDraft:displayed();validateState(local);
 download('tkb-'+(isSchedulerRole()?'ban-nhap-cuc-bo':'lich-da-chot')+'-'+new Date().toISOString().replaceAll(':','-')+'.json',JSON.stringify(local,null,2));
}

// Fit printed sheets to their available preview frame; export dimensions stay native.

const actions = {
  'push-settings':()=>showPushSettings(openDialog),
  'open-substitute':element=>openSubstituteEditor(element.dataset.class,element.dataset.slot,element.dataset.track||''),
  'close-mobile-menu': () => { setMobileMenu(false); document.querySelector('.topbar-menu-toggle')?.focus(); },
  'toggle-sidebar': () => {
    if(isMobileMenu()){setMobileMenu(!mobileMenuOpen);if(mobileMenuOpen)document.querySelector('.sidebar-toggle-btn')?.focus();return;}
    isSidebarCollapsed = !isSidebarCollapsed;
    try {
      localStorage.setItem('vas_sidebar_collapsed', isSidebarCollapsed ? 'true' : 'false');
    } catch (e) {}
    render();
  },
  'published-excel':async()=>{try{const XLSX=await loadXlsx();const file=publishedExcel(publishedTimetable,XLSX);download(file.filename,file.bytes,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');toast('Đã tải Excel toàn trường từ bản đã công bố, đủ tất cả lớp và tiết học.');}catch(error){toast(error.message);}},
  'schedule-focus-enter':()=>{recordCurrentScrollPositions();matrixFocusEnabled=true;render();},
  'schedule-focus-exit':()=>{recordCurrentScrollPositions();matrixFocusEnabled=false;render();},
  'schedule-focus-tools':()=>{recordCurrentScrollPositions();matrixFocusTools=!matrixFocusTools;render();},
  'registration-week-previous':()=>{moveRegistrationWeek('previous',displayed());render();},
  'registration-week-next':()=>{moveRegistrationWeek('next',displayed());render();},
  'registration-week-today':()=>{moveRegistrationWeek('today',displayed());render();},
  'registration-week-schedule':()=>{moveRegistrationWeek('schedule',displayed());render();},
  'install-phone':async()=>{if(await installPhoneApp())return;openDialog(`<div class="dialog-title"><h2>Cài TKB trên điện thoại</h2>${closeButton}</div><p>Mở https://thoikhoabieusmart.ai.studio/ trên điện thoại.</p><p><strong>Android (Chrome):</strong> mở menu ⋮ → Cài đặt ứng dụng hoặc Thêm vào màn hình chính.</p><p><strong>iPhone (Safari):</strong> bấm Chia sẻ → Thêm vào MH chính.</p><p>Đăng nhập cùng tài khoản Google để dùng chung dữ liệu nhà trường. Chỉ sửa khi có mạng; chờ “Đã lưu Cloud” trước khi đóng. Thiết bị khác cập nhật sau khoảng 15 giây khi app đang mở.</p>`);},
  integrations:integrationDialog,
  'ai-suggest':async()=>{
    if(!canEditWorking()||isSavingWorking||isWriting())throw Error('Chuyển sang bản nháp và đợi lưu xong trước khi dùng AI.');
    const generation=authGeneration,signature=contentSignature(workingDraft),instruction=document.querySelector('#ai-instruction')?.value||'';
    const feedback=document.querySelector('#ai-feedback');if(feedback)feedback.textContent='AI đang phân tích lịch…';let result;try{result=await askScheduleAI(instruction);}catch(error){if(feedback)feedback.textContent=error.message;throw error;}
    if(generation!==authGeneration)return;if(result.revision!==currentRevision || signature!==contentSignature(workingDraft))throw Error('Lịch đã thay đổi trong lúc phân tích. Hãy tạo đề xuất mới.');
    applyMoves(workingDraft,result.moves);aiProposal={...result,signature};
    openDialog(`<div class="dialog-title"><h2>Đề xuất AI — chưa thay đổi lịch</h2>${closeButton}</div><p>${esc(result.explanation)}</p><ul>${result.moves.map(m=>{const c=workingDraft.timetableCells.find(c=>c.id===m.cellId),slot=workingDraft.timeSlots.find(s=>s.id===m.timeSlotId);return `<li>${esc(text(workingDraft.classes,c.classId))} · ${esc(text(workingDraft.subjects,c.subjectId))} → Thứ ${esc(slot.dayOfWeek)}, tiết ${esc(slot.period)}, ${esc(slot.startTime)}</li>`;}).join('')}</ul><button data-action="ai-apply" class="primary">Áp dụng vào bản nháp</button>`);
  },
  'ai-apply':async()=>{if(!canEditWorking()||!aiProposal||aiProposal.signature!==contentSignature(workingDraft))throw Error('Lịch đã thay đổi. Hãy tạo đề xuất mới.');let next=applyMoves(workingDraft,aiProposal.moves);next=recordChange(next,{actionType:'ASSIGN',description:'Áp dụng đề xuất AI ('+aiProposal.moves.length+' tiết)',actor:currentUser?.email||'Người xếp lịch',previousSnapshot:clone(workingDraft.timetableCells||[])});aiProposal=null;dialog.close();await syncWorkingToCloud(next);},
  'calendar-connect':async()=>{const events=await personalCalendarEvents();if(!events.length)throw Error('Tuần này chưa có tiết giảng dạy.');calendarPreview={events,signature:contentSignature(publishedTimetable)};openDialog(`<div class="dialog-title"><h2>Đồng bộ Google Calendar</h2>${closeButton}</div><p>Sẽ thêm/cập nhật ${events.length} tiết trong tuần. Sự kiện cũ không tự xóa. Google sẽ yêu cầu bạn cấp quyền quản lý sự kiện trên lịch bạn sở hữu.</p><button data-action="calendar-confirm" class="primary">Cấp quyền và đồng bộ ${events.length} tiết</button>`);},
  'calendar-confirm':async()=>{if(!calendarPreview||calendarPreview.signature!==contentSignature(publishedTimetable))throw Error('Lịch đã thay đổi. Hãy xem trước lại.');const events=await personalCalendarEvents(),token=await authorizeCalendar();const n=await upsertCalendar({token,events});calendarPreview=null;dialog.close();toast('Đã đồng bộ '+n+' tiết vào Google Calendar.');},
  'calendar-ics':async()=>{const events=await personalCalendarEvents();const escape=v=>String(v).replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');const stamp=v=>v.replace(/[-:]/g,'').slice(0,15);download('lich-giang-day.ics',['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//VietMy//TKB//VI',...events.flatMap(e=>['BEGIN:VEVENT','UID:'+e.id+'@tkb-vietmy','DTSTAMP:'+new Date().toISOString().replace(/[-:]/g,'').slice(0,15)+'Z','DTSTART;TZID=Asia/Ho_Chi_Minh:'+stamp(e.start.dateTime),'DTEND;TZID=Asia/Ho_Chi_Minh:'+stamp(e.end.dateTime),'SUMMARY:'+escape(e.summary),'END:VEVENT']),'END:VCALENDAR'].join('\r\n')+'\r\n','text/calendar;charset=utf-8');},
  'poster-drive':async()=>{const poster=document.querySelector('#vaschools-timetable-poster');if(!poster)throw Error('Mở TKB học sinh, chọn lớp rồi bấm lưu ảnh lên Drive.');const token=await authorizeDrive();await document.fonts.ready;const canvas=await html2canvas(poster,{...sheetCanvasSize(poster),scale:2.5,useCORS:true,backgroundColor:'#fff',logging:false});const content=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.95));if(!content)throw Error('Chưa tạo được ảnh.');const file=await saveDriveFile({token,name:'TKB-lop-'+(selectedHomeroomClassId||'hien-tai')+'-'+new Date().toISOString().slice(0,10)+'.jpg',content,mimeType:'image/jpeg'});toast('Đã lưu ảnh riêng tư lên Drive: '+file.name);},

  'backup-all': async () => {
    if(!isAdmin())return;
    downloadLocalDraft();try{const full=await cloudBackup();download('tkb-toan-bo-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(full,null,2));toast('Đã tải bản nháp cục bộ và bản sao toàn bộ Cloud.');}catch(error){throw Error('Đã tải bản nháp cục bộ về máy. Chưa tải được bản toàn bộ Cloud: '+error.message);}
  },
  'backup-drive': async () => {
    if(!isAdmin())return;
    downloadLocalDraft();
    const token=await authorizeDrive();
    const full=await cloudBackup();
    const content=JSON.stringify(full,null,2),name='TKB-sao-luu-'+new Date().toISOString().replaceAll(':','-')+'.json';
    download(name,content);
    const file=await saveDriveFile({token,name,content});
    toast('Đã lưu bản sao trên Google Drive: '+file.name);
  },
  'csv-drive': async () => {
    const token=await authorizeDrive();
    const file=await saveDriveFile({token,name:'TKB-'+new Date().toISOString().slice(0,10)+'.csv',content:exportCsv(displayed()),mimeType:'text/csv'});
    toast('Đã xuất lịch lên Drive: '+file.name);
  },
  'import-migration': () => {
    if(!isOwner())return;
    const input=document.createElement('input');input.type='file';input.accept='.json,application/json';
    input.onchange=async()=>{const file=input.files?.[0];if(!file)return;
      try{const payload=JSON.parse(await file.text());if(!confirm('Nhập dữ liệu vào dự án Supabase thử nghiệm? Chỉ thực hiện khi chưa có dữ liệu lịch.'))return;
      const result=await importMigration(payload);toast('Đã nhập '+result.imported+' tài liệu. Đang tải lại...');location.reload();}catch(e){toast(e.message);}};
    input.click();
  },
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
  'personal-jpg': downloadPersonalTeachingJpg,
  'admin-teacher-jpg':()=>{if(!isAdmin()||view!=='teacher_schedules')return;const {pData,selected}=adminTeacherScheduleSelection();if(pData&&selected)return downloadPersonalTeachingJpg({teacherId:selected.id,pData});},
  'retry-profile': async () => {
    if(!currentUser)return;
    profileReadError='';authLoading=true;render();
    await retryCloudReads();
  },
  logout: async () => {
    await disableDevicePush().catch(()=>{});
    stopAllSubscriptions();
    await fbSignOut(auth);
  },
  backup: () => {downloadLocalDraft();toast('Đã tải dữ liệu trên màn hình về máy; không cần kết nối Supabase.');},
  print: () => window.print(),
  'print-poster': () => window.print(),
  'export-timetable-image': async () => {
    const poster = document.querySelector('#vaschools-timetable-poster');
    if (!poster) {
      toast('Không tìm thấy khung thời khóa biểu mẫu VASchools.');
      return;
    }
    const pData = (publishedTimetable && publishedTimetable.isPublished && publishedTimetable.data) ? publishedTimetable.data : (state || workingDraft);
    const availableClasses = (pData.classes || state.classes || []);
    const activeClassId = selectedHomeroomClassId || availableClasses[0]?.id;
    const currentClass = availableClasses.find(c => c.id === activeClassId) || availableClasses[0];
    const isGrade11 = (currentClass?.grade === 11) || /\b11\b/.test(currentClass?.name || '') || /\b11\b/.test(currentClass?.code || '');
    let exportClassName = currentClass ? currentClass.name : 'Lop';
    if (isGrade11) {
      if (homeroomExportTrack === 'XH') exportClassName += '_Ban_Xa_Hoi';
      else if (homeroomExportTrack === 'TN') exportClassName += '_Ban_Tu_Nhien';
    }
    const weekRaw = posterWeekInfo(pData.school).weekLabel;
    const filename = computeExportFileName(exportClassName, weekRaw).replace(/\.png$/i, '.jpg');

    toast('Đang tạo ảnh thời khóa biểu độ phân giải cao...');
    try {
      const canvas = await html2canvas(poster, {
        ...sheetCanvasSize(poster),
        scale: 2.5,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      const blob = await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.95));
      if(!blob)throw Error('Chưa tạo được tệp ảnh. Vui lòng thử lại.');
      download(filename,blob,'image/jpeg');
      toast(`Đã tải ảnh về máy: ${filename}`);
    } catch (err) {
      toast('Lỗi khi xuất ảnh TKB: ' + err.message);
    }
  },
  csv: () => download('thoi-khoa-bieu.csv', exportCsv(displayed()), 'text/csv;charset=utf-8'),
  density: () => {
    recordCurrentScrollPositions();
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
    activeVersion = 'draft';
    showPublished = false;
    state = clone(workingDraft);
    render();
  },
  published: () => {
    activeVersion = 'published';
    showPublished = true;
    teacher = '';
    state = clone(displayed());
    render();
  },
  'set-version-draft': () => {
    activeVersion = 'draft';
    showPublished = false;
    state = clone(workingDraft);
    render();
  },
  'set-version-published': () => {
    activeVersion = 'published';
    showPublished = true;
    teacher = '';
    state = clone(displayed());
    render();
  },
  'publish-all': async () => {
 if(isSavingWorking || isWriting()){toast('Vui lòng đợi lưu xong bản nháp.');return;}
    if (!canEditWorking()) {
      toast('Bạn không có quyền công bố thời khóa biểu.');
      return;
    }
    if (isQuotaExhausted()) {
      toast('Hạn mức ghi Firestore đã hết (resource-exhausted). Không thể công bố.');
      return;
    }
    const conflicts = findConflicts(workingDraft);
    if (conflicts.length) {
      toast(`Còn ${conflicts.length} tiết trùng lịch giáo viên! Vui lòng xử lý trước khi công bố.`);
      return;
    }

    try { assertDailySubjectRules(workingDraft); assertSessionAndRoboticsRules(workingDraft); } catch (error) { toast(error.message); return; }
    if(!confirmWeeklyPublication())return;
    const next = publishDraft(workingDraft);

    // 6. Không công bố lại lịch giống bản đã công bố: 0 ghi!
    if (publishedTimetable && publishedTimetable.isPublished && publishedTimetable.data) {
      if (arePublishedContentEqual(publishedTimetable.data, next)) {
        toast('Thời khóa biểu hiện tại giống hệt bản đã công bố trên Cloud. Không cần công bố lại.');
        activeVersion = 'published';
        showPublished = true;
        render();
        return;
      }
    }

    if (!confirm('Công bố toàn bộ thời khóa biểu lên toàn trường? Học sinh và giáo viên sẽ xem được bản chốt này.')) {
      return;
    }
    setSync('saving', 'Đang công bố lên toàn trường...');
    try {
      const timeStr = next.lastPublishedAt;
      const payloadPublished = {
        isPublished: true,
        name: `Bản chốt ${timeStr}`,
        publishedAt: new Date().toISOString(),
        publishedBy: currentUser?.email || 'admin',
        lastPublishedAt: timeStr,
        data: clone(next)
      };
      await setDoc(doc(db, 'timetables', 'published'), payloadPublished);
      publishedTimetable = payloadPublished;
      if (await syncWorkingToCloud(next)) {
        activeVersion = 'published';
        showPublished = true;
        render();
        toast('Đã công bố thời khóa biểu lên toàn trường thành công!');
      }
    } catch (err) {
      if (checkAndFlagQuotaError(err)) {
        setSync('error', 'Hết hạn mức Cloud (Resource Exhausted)');
        render();
        return;
      }
      toast('Lỗi khi công bố: ' + err.message);
      setSync('error', 'Lỗi công bố');
    }
  },
  'restore-published-all': async () => {
    if (!canEditWorking()) {
      toast('Bạn không có quyền khôi phục bản chốt.');
      return;
    }
    const hasPublished = (workingDraft.publishedSchedule && workingDraft.publishedSchedule.length > 0) ||
                         (publishedTimetable?.data?.publishedSchedule && publishedTimetable.data.publishedSchedule.length > 0) ||
                         (publishedTimetable?.data?.timetableCells && publishedTimetable.data.timetableCells.length > 0);
    if (!hasPublished) {
      toast('Chưa có bản đã chốt nào để khôi phục.');
      return;
    }
    if (!confirm('Khôi phục bản đang xếp quay về giống bản đã chốt gần nhất? Mọi thay đổi nháp chưa công bố sẽ bị hủy.')) {
      return;
    }
    setSync('saving', 'Đang khôi phục bản chốt...');
    try {
      const source = (workingDraft.publishedSchedule && workingDraft.publishedSchedule.length > 0)
        ? workingDraft
        : (publishedTimetable?.data ? normalizeState(publishedTimetable.data) : workingDraft);
      const next = restoreDraftFromPublished(source);
      if (await syncWorkingToCloud(next)) {
        activeVersion = 'draft';
        showPublished = false;
        render();
        toast('Đã khôi phục bản đang xếp từ bản đã chốt.');
      }
    } catch (err) {
      toast('Lỗi khôi phục: ' + err.message);
      setSync('error', 'Lỗi khôi phục');
    }
  },
  'set-tray-top': () => {
    recordCurrentScrollPositions();
    trayPosition = 'top';
    render();
  },
  'set-tray-right': () => {
    recordCurrentScrollPositions();
    trayPosition = 'right';
    render();
  },
  'disarm-card': () => {
    recordCurrentScrollPositions();
    armedCard = null;
    render();
    toast('Đã hủy chọn cọ thẻ.');
  },
  'toggle-arm-card': element => {
    recordCurrentScrollPositions();
    const card = element.dataset?.trayCard ? element : element.closest('[data-tray-card]');
    if (!card) return;
    const classId = card.dataset.class;
    const subjectId = card.dataset.subject;
    const teacherId = card.dataset.teacher;
    if (armedCard && armedCard.classId === classId && armedCard.subjectId === subjectId && armedCard.teacherId === teacherId) {
      armedCard = null;
      toast('Đã tắt chế độ cọ thẻ.');
    } else {
      armedCard = { classId, subjectId, teacherId };
      const subjName = text(workingDraft.subjects, subjectId);
      const teaName = text(workingDraft.teachers, teacherId, 'fullName');
      toast(`Đã kích hoạt cọ: ${subjName} - ${teaName}. Nhấp vào các ô trống trên bảng để gán nhanh!`);
    }
    render();
  },
  'assign-popover-suggestion': async element => {
    recordCurrentScrollPositions();
    const classId = element.dataset.class;
    const timeSlotId = element.dataset.slot;
    const day = Number(element.dataset.day);
    const period = Number(element.dataset.period);
    const subjectId = element.dataset.subject;
    const teacherId = element.dataset.teacher;


    if (!canEditWorking()) return;
    const dayLabel = `Thứ ${day}`;

    // Conflict check
    const busyInfo = lessonBusy(workingDraft,{teacherId,classId,timeSlotId,subjectId});
    if (busyInfo.isBusy) {
      const teaName = text(workingDraft.teachers, teacherId, 'fullName');
      const confName = busyInfo.conflictingClass?.name || 'lớp khác';
      toast(`GV ${teaName} đã có lịch dạy ở ${confName} vào tiết này!`);
      return;
    }

    try {
      const existing = (workingDraft.timetableCells || []).find(c => c.classId === classId && c.timeSlotId === timeSlotId);
      const previousSnapshot = clone(workingDraft.timetableCells || []);
      let draftToUse = workingDraft;
      if (existing?.locked) {
        draftToUse = toggleCellLock(draftToUse, classId, timeSlotId);
      }
      let next = assignLessonToScheduleCell(draftToUse, {
        classId,
        day: dayLabel,
        period,
        timeSlotId,
        subjectId,
        teacherId
      });
      closePopover();
      const clsName = text(workingDraft.classes, classId);
      const subjName = text(workingDraft.subjects, subjectId);
      const teaName = text(workingDraft.teachers, teacherId, 'fullName') || 'Chưa gán GV';
      const slot = (workingDraft.timeSlots || []).find(s => s.id === timeSlotId);
      const slotText = slot ? `Thứ ${slot.dayOfWeek} · Tiết ${slot.period}` : `${dayLabel} Tiết ${period}`;
      const desc = `Gán môn ${subjName} (${teaName}) cho lớp ${clsName} vào ${slotText}`;
      const newCell = (next.timetableCells || []).find(c => c.classId === classId && c.timeSlotId === timeSlotId);

      next = recordChange(next, {
        actionType: 'ASSIGN',
        description: desc,
        classId,
        timeSlotId,
        slotLabel: slotText,
        previousCell: existing,
        newCell,
        actor: currentUser?.email || 'Người xếp lịch',
        previousSnapshot
      });

      if (await syncWorkingToCloud(next)) {
        render();
        toast('Đã xếp tiết học thành công.');
      }
    } catch (err) {
      const warning=document.querySelector('#timetable-suggestion-warning');
      if(warning){warning.textContent=err.message;warning.hidden=false;}
      toast(err.message);
    }
  },
  'popover-clear-slot': async element => {
    recordCurrentScrollPositions();
    const classId = element.dataset.class;
    const timeSlotId = element.dataset.slot;
    const day = Number(element.dataset.day);
    const period = Number(element.dataset.period);
    closePopover();

    if (!canEditWorking()) return;
    const dayLabel = `Thứ ${day}`;
    try {
      const existing = (workingDraft.timetableCells || []).find(c => c.classId === classId && c.timeSlotId === timeSlotId);
      const previousSnapshot = clone(workingDraft.timetableCells || []);
      let draftToUse = workingDraft;
      if (existing?.locked) {
        draftToUse = toggleCellLock(draftToUse, classId, timeSlotId);
      }
      let next = removeLessonFromScheduleCell(draftToUse, {
        classId,
        day: dayLabel,
        period,
        timeSlotId,
        track:element.dataset.track||''
      });
      const clsName = text(workingDraft.classes, classId);
      const subjName = existing ? text(workingDraft.subjects, existing.subjectId) : 'Tiết học';
      const slot = (workingDraft.timeSlots || []).find(s => s.id === timeSlotId);
      const slotText = slot ? `Thứ ${slot.dayOfWeek} · Tiết ${slot.period}` : `${dayLabel} Tiết ${period}`;
      const desc = `Xóa tiết ${subjName} khỏi lớp ${clsName} vào ${slotText}`;

      next = recordChange(next, {
        actionType: 'CLEAR',
        description: desc,
        classId,
        timeSlotId,
        slotLabel: slotText,
        previousCell: existing,
        newCell: null,
        actor: currentUser?.email || 'Người xếp lịch',
        previousSnapshot
      });

      if (await syncWorkingToCloud(next)) {
        render();
        toast('Đã xóa tiết học khỏi ô lịch.');
      }
    } catch (err) {
      toast('Lỗi khi xóa ô: ' + err.message);
    }
  },
  'popover-toggle-lock': async element => {
    recordCurrentScrollPositions();
    if (!canEditWorking()) {
      toast('Chỉ Người xếp lịch mới có quyền mở khóa hoặc khóa tiết học.');
      return;
    }
    try {
      const classId = element.dataset.class;
      const timeSlotId = element.dataset.slot;
      const previousSnapshot = clone(workingDraft.timetableCells || []);
      const cell = (workingDraft.timetableCells || []).find(c => c.classId === classId && c.timeSlotId === timeSlotId);
      const newLocked = cell ? !cell.locked : false;
      let next = toggleCellLock(workingDraft, classId, timeSlotId);
      if (cell) {
        const partner = jointPartner(workingDraft, classId, cell.subjectId);
        if (partner) {
          const pCell = next.timetableCells.find(c => c.classId === partner.id && c.timeSlotId === timeSlotId);
          if (pCell) pCell.locked = newLocked;
        }
      }
      closePopover();
      const clsName = text(workingDraft.classes, classId);
      const subjName = cell ? text(workingDraft.subjects, cell.subjectId) : 'tiết học';
      const slot = (workingDraft.timeSlots || []).find(s => s.id === timeSlotId);
      const slotText = slot ? `Thứ ${slot.dayOfWeek} · Tiết ${slot.period}` : '';
      const desc = `${newLocked ? 'Khóa cố định' : 'Mở khóa'} môn ${subjName} lớp ${clsName} vào ${slotText}`;
      const newCell = (next.timetableCells || []).find(c => c.classId === classId && c.timeSlotId === timeSlotId);

      next = recordChange(next, {
        actionType: 'LOCK',
        description: desc,
        classId,
        timeSlotId,
        slotLabel: slotText,
        previousCell: cell,
        newCell,
        actor: currentUser?.email || 'Người xếp lịch',
        previousSnapshot
      });

      if (await syncWorkingToCloud(next)) {
        render();
        toast(newLocked ? 'Đã khóa cố định tiết học.' : 'Đã mở khóa tiết học! Bạn có thể tự do điều chỉnh hoặc đổi môn.');
      }
    } catch (err) {
      toast('Lỗi khi thay đổi khóa tiết học: ' + (err.message || err));
    }
  },
  'quick-toggle-cell-lock': async element => {
    recordCurrentScrollPositions();
    if (!canEditWorking()) {
      toast('Chỉ Người xếp lịch mới có quyền mở khóa tiết học.');
      return;
    }
    try {
      const classId = element.dataset.class;
      const timeSlotId = element.dataset.slot;
      const previousSnapshot = clone(workingDraft.timetableCells || []);
      const cell = (workingDraft.timetableCells || []).find(c => c.classId === classId && c.timeSlotId === timeSlotId);
      const newLocked = cell ? !cell.locked : false;
      let next = toggleCellLock(workingDraft, classId, timeSlotId);
      if (cell) {
        const partner = jointPartner(workingDraft, classId, cell.subjectId);
        if (partner) {
          const pCell = next.timetableCells.find(c => c.classId === partner.id && c.timeSlotId === timeSlotId);
          if (pCell) pCell.locked = newLocked;
        }
      }
      const clsName = text(workingDraft.classes, classId);
      const subjName = cell ? text(workingDraft.subjects, cell.subjectId) : 'tiết học';
      const slot = (workingDraft.timeSlots || []).find(s => s.id === timeSlotId);
      const slotText = slot ? `Thứ ${slot.dayOfWeek} · Tiết ${slot.period}` : '';
      const desc = `${newLocked ? 'Khóa cố định' : 'Mở khóa'} môn ${subjName} lớp ${clsName} vào ${slotText}`;
      const newCell = (next.timetableCells || []).find(c => c.classId === classId && c.timeSlotId === timeSlotId);

      next = recordChange(next, {
        actionType: 'LOCK',
        description: desc,
        classId,
        timeSlotId,
        slotLabel: slotText,
        previousCell: cell,
        newCell,
        actor: currentUser?.email || 'Người xếp lịch',
        previousSnapshot
      });

      if (await syncWorkingToCloud(next)) {
        render();
        toast(newLocked ? 'Đã khóa tiết học.' : 'Đã mở khóa tiết học! Bạn có thể tự do chỉnh sửa.');
      }
    } catch (err) {
      toast('Lỗi khi thay đổi khóa tiết học: ' + (err.message || err));
    }
  },
  'unlock-all-fixed': async () => {
    recordCurrentScrollPositions();
    if (!canEditWorking()) {
      if (activeVersion === 'published') {
        toast('Bạn đang ở "Bản đã chốt" (chỉ xem). Hãy bấm chuyển sang "Bản đang xếp" để chỉnh sửa thời khóa biểu.');
      } else {
        toast('Chỉ Người xếp lịch hoặc Quản trị viên mới có quyền mở khóa môn cố định.');
      }
      return;
    }
    const lockedCount = (workingDraft.timetableCells || []).filter(c => c.locked).length;
    if (lockedCount === 0) {
      toast('Hiện không có tiết học nào đang bị khóa.');
      return;
    }
    openDialog(`
      <div class="dialog-title">
        <div>
          <h2>🔓 Mở khóa tất cả môn cố định</h2>
          <p>Mở khóa toàn trường để tự do điều chỉnh thời khóa biểu</p>
        </div>
        ${closeButton}
      </div>
      <div style="padding:10px 0;">
        <p style="font-size:13px;line-height:1.6;color:#334155;">
          Hiện có <strong>${lockedCount} tiết học cố định</strong> (Chào cờ, Sinh hoạt lớp, TA ESL...) đang được khóa bảo vệ.
        </p>
        <p style="font-size:12px;color:#15803d;margin-top:8px;background:#f0fdf4;padding:10px;border-radius:6px;border-left:4px solid #16a34a;line-height:1.5;">
          👉 Khi bấm <strong>"Xác nhận mở khóa"</strong>, bạn có thể tự do đổi môn, gán giáo viên khác hoặc xóa tiết ở bất kỳ ô nào trên thời khóa biểu.
        </p>
      </div>
      <div class="dialog-actions">
        <button type="button" data-action="close">Hủy bỏ</button>
        <button type="button" class="primary" data-action="confirm-unlock-all-fixed">✓ Xác nhận mở khóa tất cả (${lockedCount} tiết)</button>
      </div>
    `);
  },
  'confirm-unlock-all-fixed': async () => {
    recordCurrentScrollPositions();
    dialog.close();
    try {
      const lockedCount = (workingDraft.timetableCells || []).filter(c => c.locked).length;
      const previousSnapshot = clone(workingDraft.timetableCells || []);
      let next = unlockAllFixedCells(workingDraft);
      next = recordChange(next, {
        actionType: 'BATCH_UNLOCK',
        description: `Mở khóa tất cả ${lockedCount} môn cố định trên toàn trường`,
        actor: currentUser?.email || 'Người xếp lịch',
        previousSnapshot
      });
      if (await syncWorkingToCloud(next)) {
        render();
        toast(`Đã mở khóa thành công tất cả ${lockedCount} tiết học trên thời khóa biểu!`);
      }
    } catch (err) {
      toast('Lỗi khi mở khóa toàn bộ: ' + (err.message || err));
    }
  },
  'assign-special-activity': async element => {
    recordCurrentScrollPositions();
    if (!canEditWorking()) {
      toast('Chỉ Người xếp lịch mới có quyền xếp tiết học.');
      return;
    }
    const type = element.dataset.type; // 'chao_co', 'sinh_hoat_lop', 'ta_esl', 'clb'
    const classId = element.dataset.class;
    const timeSlotId = element.dataset.slot;
    closePopover();

    try {
      const existing = (workingDraft.timetableCells || []).find(c => c.classId === classId && c.timeSlotId === timeSlotId);
      const previousSnapshot = clone(workingDraft.timetableCells || []);
      let next = assignSpecialActivity(workingDraft, {
        classId,
        timeSlotId,
        type,
        locked: type === 'chao_co'
      });
      const clsName = text(workingDraft.classes, classId);
      const slot = (workingDraft.timeSlots || []).find(s => s.id === timeSlotId);
      const slotText = slot ? `Thứ ${slot.dayOfWeek} · Tiết ${slot.period}` : '';
      const actNames = {
        chao_co: '🚩 Chào cờ',
        sinh_hoat_lop: '🏫 Sinh hoạt lớp',
        ta_esl: '🌐 TA ESL',
        clb: '🎯 CLB'
      };
      const desc = `Gán tiết ${actNames[type] || 'hoạt động chung'} cho lớp ${clsName} vào ${slotText}`;
      const newCell = (next.timetableCells || []).find(c => c.classId === classId && c.timeSlotId === timeSlotId);

      next = recordChange(next, {
        actionType: 'SPECIAL',
        description: desc,
        classId,
        timeSlotId,
        slotLabel: slotText,
        previousCell: existing,
        newCell,
        actor: currentUser?.email || 'Người xếp lịch',
        previousSnapshot
      });

      if (await syncWorkingToCloud(next)) {
        render();
        const toastMsgs = {
          chao_co: '🚩 Đã chọn lại tiết Chào cờ thành công!',
          sinh_hoat_lop: '🏫 Đã chọn lại tiết Sinh hoạt lớp thành công!',
          ta_esl: '🌐 Đã chọn lại tiết TA ESL thành công!',
          clb: '🎯 Đã chọn lại tiết CLB (Câu lạc bộ) thành công!'
        };
        toast(toastMsgs[type] || 'Đã xếp tiết thành công!');
      }
    } catch (err) {
      toast('Lỗi khi xếp tiết đặc biệt: ' + (err.message || err));
    }
  },
  'open-cell-full-editor': element => {
    recordCurrentScrollPositions();
    const classId = element.dataset.class;
    const timeSlotId = element.dataset.slot;
    closePopover();
    cellEditor(classId, timeSlotId);
  },
  'reset-monday-flag-ceremony': async () => {
    recordCurrentScrollPositions();
    if (!canEditWorking()) {
      if (activeVersion === 'published') {
        toast('Bạn đang ở "Bản đã chốt" (chỉ xem). Hãy bấm chuyển sang "Bản đang xếp" để chỉnh sửa thời khóa biểu.');
      } else {
        toast('Chỉ Người xếp lịch hoặc Quản trị viên mới có quyền đặt lại tiết Chào cờ.');
      }
      return;
    }
    const count = (workingDraft.classes || []).length;
    openDialog(`
      <div class="dialog-title">
        <div>
          <h2>🚩 Đặt lại tiết Chào cờ sáng Thứ 2 (Tiết 1)</h2>
          <p>Khôi phục quy chuẩn tiết Chào cờ đầu tuần cho toàn trường</p>
        </div>
        ${closeButton}
      </div>
      <div style="padding:10px 0;">
        <p style="font-size:13px;line-height:1.6;color:#334155;">
          Hệ thống sẽ tự động gán tiết <strong>🚩 Chào cờ (Sinh hoạt dưới cờ)</strong> vào <strong>sáng Thứ 2 (Tiết 1)</strong> cho tất cả <strong>${count} lớp học</strong> trong trường và khóa cố định lại.
        </p>
        <p style="font-size:12px;color:#991b1b;margin-top:8px;background:#fef2f2;padding:10px;border-radius:6px;border-left:4px solid #dc2626;line-height:1.5;">
          💡 Thao tác này giúp khôi phục nhanh đồng loạt nếu các lớp trước đó bị xóa hoặc xếp nhầm tiết khác vào đầu tuần.
        </p>
      </div>
      <div class="dialog-actions">
        <button type="button" data-action="close">Hủy bỏ</button>
        <button type="button" class="primary" style="background:#dc2626;border-color:#dc2626;" data-action="confirm-reset-monday-flag-ceremony">✓ Xác nhận đặt lại cho ${count} lớp</button>
      </div>
    `);
  },
  'confirm-reset-monday-flag-ceremony': async () => {
    recordCurrentScrollPositions();
    dialog.close();
    try {
      const count = (workingDraft.classes || []).length;
      const previousSnapshot = clone(workingDraft.timetableCells || []);
      let next = resetMondayFlagCeremony(workingDraft);
      next = recordChange(next, {
        actionType: 'BATCH_RESET',
        description: `Đặt lại tiết Chào cờ sáng Thứ 2 cho tất cả ${count} lớp học`,
        actor: currentUser?.email || 'Người xếp lịch',
        previousSnapshot
      });
      if (await syncWorkingToCloud(next)) {
        render();
        toast(`Đã khôi phục thành công tiết Chào cờ sáng Thứ 2 cho tất cả ${count} lớp học!`);
      }
    } catch (err) {
      toast('Lỗi khi đặt lại tiết Chào cờ: ' + (err.message || err));
    }
  },
  'undo-last-change': async () => {
    recordCurrentScrollPositions();
    if (!canEditWorking()) {
      if (activeVersion === 'published') {
        toast('Bạn đang ở "Bản đã chốt". Hãy chuyển sang "Bản đang xếp" để thực hiện hoàn tác.');
      } else {
        toast('Chỉ Người xếp lịch mới có quyền hoàn tác lịch.');
      }
      return;
    }
    try {
      const next = undoChange(workingDraft);
      const desc = next.lastUndoneDescription || 'thao tác gần nhất';
      if (await syncWorkingToCloud(next)) {
        render();
        toast(`↶ Đã hoàn tác: ${desc}`);
      }
    } catch (err) {
      toast('Không thể hoàn tác: ' + (err.message || err));
    }
  },
  'undo-specific-change': async element => {
    recordCurrentScrollPositions();
    if (!canEditWorking()) {
      toast('Chỉ Người xếp lịch mới có quyền hoàn tác lịch.');
      return;
    }
    const changeId = element.dataset.changeId;
    dialog.close();
    try {
      const next = undoChange(workingDraft, changeId);
      const desc = next.lastUndoneDescription || 'thao tác đã chọn';
      if (await syncWorkingToCloud(next)) {
        render();
        toast(`↶ Đã hoàn tác: ${desc}`);
      }
    } catch (err) {
      toast('Không thể hoàn tác: ' + (err.message || err));
    }
  },
  'open-change-history-modal': () => {
    recordCurrentScrollPositions();
    const history = Array.isArray(workingDraft.changeHistory) ? workingDraft.changeHistory : [];
    const undoableCount = history.filter(h => h.canUndo && !h.undone).length;

    const actionBadges = {
      ASSIGN: '<span style="background:#dcfce7;color:#166534;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;border:1px solid #bbf7d0;">GÁN TIẾT</span>',
      CLEAR: '<span style="background:#fee2e2;color:#991b1b;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;border:1px solid #fecaca;">XÓA TIẾT</span>',
      SPECIAL: '<span style="background:#f3e8ff;color:#6b21a8;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;border:1px solid #e9d5ff;">HOẠT ĐỘNG CHUNG</span>',
      LOCK: '<span style="background:#fef3c7;color:#92400e;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;border:1px solid #fde68a;">KHÓA / MỞ KHÓA</span>',
      BATCH_UNLOCK: '<span style="background:#e0e7ff;color:#3730a3;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;border:1px solid #c7d2fe;">MỞ KHÓA TOÀN TRƯỜNG</span>',
      BATCH_RESET: '<span style="background:#ffe4e6;color:#9f1239;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;border:1px solid #fecdd3;">ĐẶT LẠI CHÀO CỜ</span>',
      UNDO: '<span style="background:#dbeafe;color:#1e40af;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;border:1px solid #bfdbfe;">HOÀN TÁC</span>',
      EDIT: '<span style="background:#e0f2fe;color:#0369a1;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;border:1px solid #bae6fd;">CHỈNH SỬA</span>'
    };

    openDialog(`
      <div class="dialog-title">
        <div>
          <h2>📜 Nhật ký thay đổi Lịch tiết học</h2>
          <p>Lưu trữ các thao tác gán, xóa, đổi môn và cho phép hoàn tác (Undo) tức thì</p>
        </div>
        ${closeButton}
      </div>

      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;background:#f8fafc;padding:10px 14px;border-radius:8px;border:1px solid #e2e8f0;">
        <div style="font-size:12px;color:#334155;">
          Tổng số: <strong>${history.length}</strong> lần thay đổi ghi nhận · Khả dụng hoàn tác: <strong>${undoableCount}</strong>
        </div>
        ${undoableCount > 0 && canEditWorking() ? `
          <button type="button" class="primary" data-action="undo-last-change" style="font-size:11px;padding:6px 12px;display:flex;align-items:center;gap:6px;">
            ↶ Hoàn tác thao tác mới nhất (Ctrl+Z)
          </button>
        ` : ''}
      </div>

      <div class="history-list-wrapper" style="max-height:60vh;overflow-y:auto;padding-right:4px;">
        ${history.length === 0 ? `
          <div style="padding:40px 20px;text-align:center;color:#64748b;">
            <span style="font-size:36px;display:block;margin-bottom:8px;">📝</span>
            <strong style="font-size:14px;color:#1e293b;display:block;">Chưa có thay đổi nào trong phiên hiện tại</strong>
            <p style="font-size:12px;margin-top:4px;">Mọi thao tác gán tiết, xóa môn, mở khóa hay đặt lại môn cố định sẽ tự động được ghi lại tại đây.</p>
          </div>
        ` : `
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${history.map((h, index) => {
              const isUndoable = h.canUndo && !h.undone && canEditWorking();
              return `
                <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;background:${h.undone ? '#f8fafc' : '#ffffff'};border:1px solid ${h.undone ? '#e2e8f0' : '#cbd5e1'};border-left:4px solid ${h.actionType === 'UNDO' ? '#2563eb' : h.actionType === 'CLEAR' ? '#dc2626' : h.actionType === 'ASSIGN' ? '#16a34a' : h.actionType === 'SPECIAL' ? '#7c3aed' : '#d97706'};border-radius:6px;opacity:${h.undone ? '0.65' : '1'};">
                  <div style="min-width:0;flex:1;">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap;">
                      <span style="font-size:11px;color:#64748b;font-weight:600;">#${history.length - index} · ${esc(h.timeDisplay || '')}</span>
                      ${actionBadges[h.actionType] || `<span style="font-size:10px;font-weight:700;">${esc(h.actionType)}</span>`}
                      ${h.undone ? '<span style="font-size:9px;background:#f1f5f9;color:#64748b;padding:1px 5px;border-radius:3px;">✓ Đã hoàn tác</span>' : ''}
                    </div>
                    <div style="font-size:13px;font-weight:600;color:#1e293b;line-height:1.4;">
                      ${esc(h.description)}
                    </div>
                    <div style="font-size:11px;color:#64748b;margin-top:2px;">
                      Thực hiện bởi: <strong>${esc(h.actor || 'Người xếp lịch')}</strong>
                      ${h.slotLabel ? ` · <span>${esc(h.slotLabel)}</span>` : ''}
                    </div>
                  </div>
                  <div>
                    ${isUndoable ? `
                      <button type="button" class="btn-undo-item" data-action="undo-specific-change" data-change-id="${esc(h.id)}" style="background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;padding:6px 12px;font-size:11px;font-weight:700;border-radius:6px;cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:4px;" title="Hoàn tác lại trạng thái trước khi thực hiện thao tác này">
                        ↶ Hoàn tác
                      </button>
                    ` : h.undone ? `
                      <span style="font-size:11px;color:#94a3b8;font-style:italic;">Đã hoàn tác</span>
                    ` : `
                      <span style="font-size:11px;color:#94a3b8;">—</span>
                    `}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>

      <div class="dialog-actions" style="margin-top:14px;">
        <button type="button" data-action="close">Đóng</button>
      </div>
    `);
  },
  'show-teacher-palette-modal': () => {
    const teachers = workingDraft.teachers || [];
    dialog.innerHTML = `
      <div class="dialog-title">
        <div>
          <h2>🎨 Bảng màu phân định giáo viên (${teachers.length} GV)</h2>
          <p>Mỗi giáo viên có 1 màu riêng biệt nhận diện nhất quán trên toàn bộ Thời khóa biểu.</p>
        </div>
        <button class="icon-button" data-action="close" title="Đóng">✕</button>
      </div>
      <div style="max-height:60vh;overflow-y:auto;padding-right:5px;display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;margin-top:10px;">
        ${teachers.length ? teachers.map(t => {
          const color = getTeacherColor(workingDraft, t.id);
          const assignCount = (t.assignments || []).length;
          return `
            <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-left:5px solid ${color};border-radius:6px;">
              <span style="display:inline-block;width:16px;height:16px;border-radius:50%;background:${color};box-shadow:0 1px 3px rgba(0,0,0,0.15);flex-shrink:0;"></span>
              <div style="min-width:0;flex:1;">
                <strong style="font-size:12px;color:#1e293b;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(t.fullName)}</strong>
                <span style="font-size:10px;color:#64748b;">${esc(t.code)} · ${assignCount} phân công</span>
              </div>
              <button type="button" data-action="highlight-from-palette" data-id="${esc(t.id)}" style="font-size:10px;padding:3px 7px;border-radius:4px;border:1px solid #cbd5e1;background:#fff;cursor:pointer;color:#334155;" title="Rọi sáng giáo viên này trên ma trận">
                Rọi sáng
              </button>
            </div>
          `;
        }).join('') : '<p style="color:#64748b;font-size:12px;padding:15px;grid-column:1/-1;text-align:center;">Chưa có danh sách giáo viên.</p>'}
      </div>
      <div class="dialog-actions">
        <button type="button" data-action="close">Đóng</button>
      </div>
    `;
    dialog.showModal();
  },
  'highlight-from-palette': element => {
    const teacherId = element.dataset.id;
    selectedTeacherHighlight = teacherId;
    dialog.close();
    render();
    toast(`Đang rọi sáng các tiết của: ${text(workingDraft.teachers, teacherId, 'fullName')}`);
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
  'availability-use-semester':async()=>{
   if(!isVisitingTeacher()||!currentUser?.email)return;
   const week=availabilityWeek(),email=currentUser.email.toLowerCase(),generation=authGeneration;
   try{const result=await setDoc(doc(db,'availabilities',email),{teacherEmail:email,[`weeks.${week}`]:null},{merge:true});if(generation!==authGeneration)return;
    availabilityDoc=clone(result?.row?.data||{...availabilityDoc,weeks:{...availabilityDoc?.weeks,[week]:null}});serverConfirmedAvailability=clone(availabilityDoc);availabilityDrafts.delete('week:'+week);toast('Tuần này đã dùng lại lịch cố định học kỳ.');render();
   }catch(error){toast('Chưa lưu được: '+error.message);}
  },
  'save-availability': async () => {
    if(!currentUser?.email)return;rememberAvailabilityNote();
    const week=availabilityWeek(),draft=clone(currentAvailabilityDraft()),scope=availabilityScope(),school=(publishedTimetable?.data||state).school||{},key=semesterKey(publishedTimetable?.data||state);
    if(scope==='semester'&&!key){toast('Nhà trường cần đặt năm học và học kỳ trước khi đăng ký cố định.');return;}
    const entry={availableSlotIds:draft.availableSlotIds||[],busySlotIds:draft.busySlotIds||[],note:draft.note||'',...(scope==='semester'?{year:school.year,term:school.term}:{weekStart:week,weekEnd:addDays(week,4)})};
    const previous=scope==='semester'?semesterRegistration(availabilityDoc,publishedTimetable?.data||state):availabilityDoc?.weeks?.[week];
    if(JSON.stringify(entry)===JSON.stringify(previous)){toast('Đăng ký không có thay đổi.');return;}
    const email=currentUser.email.toLowerCase(),generation=authGeneration,path=scope==='semester'?'semesters':'weeks',id=scope==='semester'?key:week,draftKey=availabilityDraftKey();
    try{const result=await setDoc(doc(db,'availabilities',email),{teacherEmail:email,[path+'.'+id]:entry},{merge:true});if(generation!==authGeneration)return;
      availabilityDoc=clone(result?.row?.data||{...availabilityDoc,teacherEmail:email,[path]:{...availabilityDoc?.[path],[id]:entry}});serverConfirmedAvailability=clone(availabilityDoc);availabilityDrafts.delete(draftKey);
      toast(scope==='semester'?'Đã lưu lịch cố định học kỳ lên Cloud.':'Đã lưu thay đổi riêng tuần '+weekCaption(week)+' lên Cloud.');render();
    }catch(error){toast('Chưa lưu được đăng ký: '+error.message+'. Lựa chọn vẫn giữ trên trang để thử lại.');}
  },  'edit-self-declared': () => {
    openDialog(`
      <form id="edit-self-declared-form">
        <div class="dialog-title">
          <h2>Cập nhật thông tin môn & tự khai</h2>
          ${closeButton}
        </div>
        <label>Môn giảng dạy (Chọn một hoặc nhiều môn)
          ${renderSubjectSelector(currentUserProfile?.selfDeclared?.subjects || [], 'edit-profile')}
        </label>
        <label style="margin-top:14px;display:block;">Ghi chú cá nhân
          <input name="note" maxlength="300" value="${esc(currentUserProfile?.selfDeclared?.note || '')}" placeholder="Ghi chú...">
        </label>
        <div class="dialog-actions">
          <button type="button" data-action="close">Hủy</button>
          <button type="submit" class="primary">Lưu thông tin</button>
        </div>
      </form>
    `);
  },
  'edit-declared-profile': () => {
    isEditingDeclaredProfile = true;
    render();
  },
  'cancel-edit-declared-profile': () => {
    isEditingDeclaredProfile = false;
    render();
  },
  'toggle-lock': async element => {
    if (!canEditWorking()) return;
    const { class: classId, slot: timeSlotId } = element.dataset;
    const previousSnapshot = clone(workingDraft.timetableCells || []);
    const existing = (workingDraft.timetableCells || []).find(c => c.classId === classId && c.timeSlotId === timeSlotId);
    const nextLocked = existing ? !existing.locked : false;
    const nextCells = workingDraft.timetableCells.map(c => (c.classId === classId && c.timeSlotId === timeSlotId ? { ...c, locked: !c.locked } : c));
    let next = { ...workingDraft, timetableCells: nextCells };

    const clsName = text(workingDraft.classes, classId);
    const subjName = existing ? text(workingDraft.subjects, existing.subjectId) : 'tiết học';
    const slot = (workingDraft.timeSlots || []).find(s => s.id === timeSlotId);
    const slotText = slot ? `Thứ ${slot.dayOfWeek} · Tiết ${slot.period}` : '';
    const desc = `${nextLocked ? 'Khóa cố định' : 'Mở khóa'} môn ${subjName} lớp ${clsName} vào ${slotText}`;

    next = recordChange(next, {
      actionType: 'LOCK',
      description: desc,
      classId,
      timeSlotId,
      slotLabel: slotText,
      previousCell: existing,
      newCell: nextCells.find(c => c.classId === classId && c.timeSlotId === timeSlotId),
      actor: currentUser?.email || 'Người xếp lịch',
      previousSnapshot
    });

    if (await syncWorkingToCloud(next)) cellEditor(classId, timeSlotId);
  },
  'delete-cell': async element => {
    if (!canEditWorking()) return;
    try {
      const classId = element.dataset.class;
      const timeSlotId = element.dataset.slot;
      const track = element.dataset.track || '';
      const existing = (workingDraft.timetableCells || []).find(c => c.classId === classId && c.timeSlotId === timeSlotId);
      const previousSnapshot = clone(workingDraft.timetableCells || []);

      let next = deleteCell(workingDraft, classId, timeSlotId, track);

      const clsName = text(workingDraft.classes, classId);
      const subjName = existing ? text(workingDraft.subjects, existing.subjectId) : 'tiết học';
      const slot = (workingDraft.timeSlots || []).find(s => s.id === timeSlotId);
      const slotText = slot ? `Thứ ${slot.dayOfWeek} · Tiết ${slot.period}` : '';
      const desc = `Xóa tiết ${subjName} khỏi lớp ${clsName} vào ${slotText}`;

      next = recordChange(next, {
        actionType: 'CLEAR',
        description: desc,
        classId,
        timeSlotId,
        slotLabel: slotText,
        previousCell: existing,
        newCell: null,
        actor: currentUser?.email || 'Người xếp lịch',
        previousSnapshot
      });

      if (await syncWorkingToCloud(next)) {
        toast('Đã xóa ô lịch.');
        dialog.close();
      }
    } catch (e) {
      toast(e.message);
    }
  },
  'popover-unassign': async element => {
    recordCurrentScrollPositions();
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
    recordCurrentScrollPositions();
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
    recordCurrentScrollPositions();
    brushMode = 'none';
    brushTeacherId = '';
    selectedTeacherHighlight = '';
    render();
    toast('Đã tắt chế độ cọ.');
  },
  'clear-highlight': () => {
    recordCurrentScrollPositions();
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
  'cancel-request': async element => {
    const reqId = element.dataset.id;
    if (!reqId) return;
    if (!confirm('Thầy/Cô có chắc chắn muốn hủy yêu cầu điều chỉnh này không?')) return;
    try {
      await deleteDoc(doc(db, 'requests', reqId));
      requestsList = requestsList.filter(r => r.id !== reqId);
      toast('Đã hủy yêu cầu điều chỉnh lịch.');
      render();
    } catch (err) {
      toast(err.message || 'Không thể hủy yêu cầu.');
    }
  },
  'delete-request': async element => {
    if (!isSchedulerRole()) return;
    const reqId = element.dataset.id;
    if (!reqId) return;
    if (!confirm('Xác nhận xóa bản ghi yêu cầu này?')) return;
    try {
      await deleteDoc(doc(db, 'requests', reqId));
      requestsList = requestsList.filter(r => r.id !== reqId);
      toast('Đã xóa bản ghi yêu cầu.');
      render();
    } catch (err) {
      toast(err.message || 'Không thể xóa bản ghi.');
    }
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
  'download-teacher-template': async () => {
    try {
      const XLSX = await loadXlsx();
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
        const XLSX = await loadXlsx();
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
  const element = event.target.closest('button, [data-toggle-slot], [data-action], [data-select-teacher], [data-assign-cell], [data-popover-select-teacher], [data-publish-tab], [data-class-hub-tab], [data-view]');
  if (!element) return;

  if (element.dataset.loginAs) {
    loginIntent = element.dataset.loginAs;
    render();
    return;
  }
  if (element.dataset.publishTab) {
    publishAndDataTab = element.dataset.publishTab;
    render();
    return;
  }
  if (element.dataset.classHubTab) {
    classHubTab = element.dataset.classHubTab;
    render();
    return;
  }
  if (element.dataset.action && actions[element.dataset.action]) {
    const action=element.dataset.action;
    if((pendingActions.has(action)||isWriting()||isSavingWorking)&&!/backup|export|download|toggle-sidebar|close-mobile-menu/.test(action))return;
    pendingActions.add(action);
    try{await actions[action](element);}catch(error){checkAndFlagQuotaError(error);toast(error.message || 'Không thể hoàn tất thao tác.');}finally{pendingActions.delete(action);}
    return;
  }
  if (element.dataset.view) {
    setMobileMenu(false);
    const targetView = element.dataset.view;
    if (targetView === 'conflicts') {
      view = 'publish_and_data';
      publishAndDataTab = 'conflicts';
    } else if (targetView === 'versions') {
      view = 'publish_and_data';
      publishAndDataTab = 'versions';
    } else if (targetView === 'backup') {
      view = 'publish_and_data';
      publishAndDataTab = 'backup';
    } else if (targetView === 'homeroom_class') {
      view = 'class_hub';
      classHubTab = 'timetable';
    } else if (targetView === 'weekly_menu') {
      view = 'class_hub';
      classHubTab = 'menu';
    } else if (targetView === 'lesson_reports') {
      view = 'class_hub';
      classHubTab = 'reports';
    } else {
      view = targetView;
    }
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
    view = 'class_hub';
    classHubTab = 'timetable';
    render();
    return;
  }
  if (element.dataset.toggleSlot) {
    const slotId = element.dataset.toggleSlot;
    if (!slotId) return;
    rememberAvailabilityNote();
    let avail = new Set(currentAvailabilityDraft().availableSlotIds || []);
    let busy = new Set(currentAvailabilityDraft().busySlotIds || []);

    if (avail.has(slotId)) {
      avail.delete(slotId);
      busy.add(slotId);
    } else if (busy.has(slotId)) {
      busy.delete(slotId);
    } else {
      avail.add(slotId);
    }
    availabilityDrafts.set(availabilityDraftKey(), {
      ...currentAvailabilityDraft(),
      availableSlotIds: [...avail],
      busySlotIds: [...busy]
    });
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
    if ((currentWorkspace !== 'ADMIN' && currentWorkspace !== 'SCHEDULER') || !isSchedulerRole() || view === 'published_all') return;
    recordCurrentScrollPositions();
    matrixViewMode = element.dataset.setMatrixMode;
    if(matrixViewMode==='timetable'){matrixFocusEnabled=true;matrixFocusTools=false;}
    render();
    return;
  }
  if (element.dataset.popoverSelectTeacher || element.closest('[data-popover-select-teacher]')) {
    recordCurrentScrollPositions();
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
    recordCurrentScrollPositions();
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
    recordCurrentScrollPositions();
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

  if (element.dataset.selectTrayClass || element.closest('[data-select-tray-class]')) {
    recordCurrentScrollPositions();
    const el = element.dataset.selectTrayClass ? element : element.closest('[data-select-tray-class]');
    traySelectedClassId = el.dataset.selectTrayClass;
    render();
    return;
  }

  if (element.dataset.cellClass || element.closest('[data-cell-class]')) {
    recordCurrentScrollPositions();
    const cellBtn = element.dataset.cellClass ? element : element.closest('[data-cell-class]');
    const classId = cellBtn.dataset.cellClass;
    const timeSlotId = cellBtn.dataset.cellSlot;
    const day = Number(cellBtn.dataset.cellDay);
    const period = Number(cellBtn.dataset.cellPeriod);
    const dayLabel = `Thứ ${day}`;
    if(cellBtn.dataset.cellTrack)grade11Track=cellBtn.dataset.cellTrack;

    if (matrixViewMode === 'timetable') {
      if (!canEditWorking()) {
        return;
      }

      // 1. Armed Card Mode: Click to assign directly without reopening popover
      if (armedCard) {
        const armTrack=subjectTrack(workingDraft.subjects.find(s=>s.id===armedCard.subjectId));
        if(cellBtn.dataset.cellTrack && armTrack!=='COMMON' && armTrack!==cellBtn.dataset.cellTrack){toast('Môn không thuộc tổ hợp của ô đang chọn.');return;}
        // Teacher conflict check
        const busyInfo = lessonBusy(workingDraft,{teacherId:armedCard.teacherId,classId,timeSlotId,subjectId:armedCard.subjectId});
        if (busyInfo.isBusy) {
          const teaName = text(workingDraft.teachers, armedCard.teacherId, 'fullName');
          const confName = busyInfo.conflictingClass?.name || 'lớp khác';
          toast(`GV ${teaName} đã có lịch dạy ở ${confName} vào tiết này!`);
          return;
        }

        const existing = (workingDraft.timetableCells || []).find(c => c.classId === classId && c.timeSlotId === timeSlotId);
        const previousSnapshot = clone(workingDraft.timetableCells || []);
        let draftToUse = workingDraft;
        if (existing?.locked) {
          draftToUse = toggleCellLock(draftToUse, classId, timeSlotId);
        }

        let next = assignLessonToScheduleCell(draftToUse, {
          classId,
          day: dayLabel,
          period,
          timeSlotId,
          subjectId: armedCard.subjectId,
          teacherId: armedCard.teacherId
        });
        const clsName = text(workingDraft.classes, classId);
        const subjName = text(workingDraft.subjects, armedCard.subjectId);
        const teaName = text(workingDraft.teachers, armedCard.teacherId, 'fullName') || 'Chưa gán GV';
        const slot = (workingDraft.timeSlots || []).find(s => s.id === timeSlotId);
        const slotText = slot ? `Thứ ${slot.dayOfWeek} · Tiết ${slot.period}` : `${dayLabel} Tiết ${period}`;
        const desc = `Dùng cọ gán môn ${subjName} (${teaName}) cho lớp ${clsName} vào ${slotText}`;
        const newCell = (next.timetableCells || []).find(c => c.classId === classId && c.timeSlotId === timeSlotId);

        next = recordChange(next, {
          actionType: 'ASSIGN',
          description: desc,
          classId,
          timeSlotId,
          slotLabel: slotText,
          previousCell: existing,
          newCell,
          actor: currentUser?.email || 'Người xếp lịch',
          previousSnapshot
        });

        if (await syncWorkingToCloud(next)) {
          render();
          toast(`Đã gán ${subjName} (${teaName}) vào lớp ${clsName}.`);
        }
        return;
      }

      // 2. Default Mode: Popover gợi ý tại chỗ (Cơ chế 1)
      openTimetableCellPopover({
        classId,
        timeSlotId,
        day,
        period,
        anchorElement: cellBtn
      });
      return;
    }

    // Assignment Mode Quick Brush & Eraser
    if (canEditWorking() && brushMode === 'brush' && brushTeacherId) {
      const cell = (workingDraft.timetableCells || []).find(c => c.classId === classId && c.timeSlotId === timeSlotId);
      if (cell && !cell.locked) {
        const next = putCell(workingDraft, { ...cell, teacherId: brushTeacherId }, { allowConflict: true });
        if (await syncWorkingToCloud(next)) render();
        return;
      }
    } else if (canEditWorking() && brushMode === 'eraser') {
      const cell = (workingDraft.timetableCells || []).find(c => c.classId === classId && c.timeSlotId === timeSlotId);
      if (cell && !cell.locked) {
        const next = putCell(workingDraft, { ...cell, teacherId: '' }, { allowConflict: true });
        if (await syncWorkingToCloud(next)) render();
        return;
      }
    }
    cellEditor(classId, timeSlotId);
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

  const chipBtn = element.closest('.quick-chip-btn[data-toggle-subject]');
  if (chipBtn) {
    const prefix = chipBtn.dataset.prefix || 'onboarding';
    const subjName = chipBtn.dataset.toggleSubject;
    const checkbox = document.querySelector(`#${prefix}-subjects-list .onboarding-subject-checkbox[value="${subjName}"]`);
    if (checkbox) {
      checkbox.checked = !checkbox.checked;
      const card = checkbox.closest('.onboarding-subject-card');
      if (card) card.classList.toggle('selected', checkbox.checked);
      chipBtn.classList.toggle('active', checkbox.checked);
      const checked = document.querySelectorAll(`#${prefix}-subjects-list .onboarding-subject-checkbox:checked`);
      const countEl = document.querySelector(`#${prefix}-selected-count`);
      if (countEl) countEl.textContent = checked.length;
    }
    return;
  }
});

document.addEventListener('change', event => {
  if (event.target.classList?.contains('onboarding-subject-checkbox')) {
    const card = event.target.closest('.onboarding-subject-card');
    if (card) {
      card.classList.toggle('selected', event.target.checked);
    }
    const prefix = event.target.dataset.prefix || 'onboarding';
    const checked = document.querySelectorAll(`#${prefix}-subjects-list .onboarding-subject-checkbox:checked`);
    const countEl = document.querySelector(`#${prefix}-selected-count`);
    if (countEl) countEl.textContent = checked.length;
    document.querySelectorAll(`.quick-chip-btn[data-prefix="${prefix}"]`).forEach(chip => {
      const subjName = chip.dataset.toggleSubject;
      const cb = document.querySelector(`#${prefix}-subjects-list .onboarding-subject-checkbox[value="${subjName}"]`);
      chip.classList.toggle('active', !!cb?.checked);
    });
    return;
  }
  if(event.target.id==='registration-view-week'){schedulerRegistrationWeek=mondayOf(event.target.value)||'';render();return;}
  if(event.target.id==='availability-scope'){rememberAvailabilityNote();selectedAvailabilityScope=event.target.value;render();return;}
  if(event.target.id==='availability-week'){
    rememberAvailabilityNote();selectedAvailabilityWeek=mondayOf(event.target.value)||availabilityWeek();render();return;
  }
  if(event.target.id==='avail-note'){rememberAvailabilityNote();return;}
  if (event.target.id === 'workspace-select') {
    currentWorkspace = event.target.value;
    view = currentWorkspace === 'INSPECTOR' ? 'inspection' : currentWorkspace === 'ADMIN' ? 'overview'
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
    recordCurrentScrollPositions();
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
  // Phím tắt Hoàn tác: Ctrl+Z hoặc Cmd+Z
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !event.shiftKey) {
    const activeEl = document.activeElement;
    const isEditingText = activeEl && (
      activeEl.tagName === 'INPUT' ||
      activeEl.tagName === 'TEXTAREA' ||
      activeEl.isContentEditable
    );
    if (!isEditingText && canEditWorking()) {
      event.preventDefault();
      actions['undo-last-change']();
    }
  }
  // Phím tắt Thu/Mở cột Menu: Ctrl+B hoặc Cmd+B
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b') {
    const activeEl = document.activeElement;
    const isEditingText = activeEl && (
      activeEl.tagName === 'INPUT' ||
      activeEl.tagName === 'TEXTAREA' ||
      activeEl.isContentEditable
    );
    if (!isEditingText) {
      event.preventDefault();
      actions['toggle-sidebar']();
    }
  }
});

document.addEventListener('input', event => {
  if (event.target.id?.endsWith('-subject-search')) {
    const prefix = event.target.id.replace('-subject-search', '');
    const filter = String(event.target.value || '').trim().toLowerCase();
    const list = document.querySelector(`#${prefix}-subjects-list`);
    if (list) {
      const cards = list.querySelectorAll('.onboarding-subject-card');
      let visible = 0;
      cards.forEach(card => {
        const search = card.dataset.subjectSearch || '';
        const match = !filter || search.includes(filter);
        card.style.display = match ? 'flex' : 'none';
        if (match) visible++;
      });
      const emptyEl = document.querySelector(`#${prefix}-subject-empty`);
      if (emptyEl) emptyEl.style.display = (visible === 0 && filter) ? 'block' : 'none';
    }
    return;
  }
  if(event.target.id==='timetable-suggestion-search'){
    const list=document.querySelector('#timetable-suggestions-list');
    const items=[...(list?.querySelectorAll('[data-suggestion-search]')||[])];
    let visible=0;
    for(const item of items){const match=matchesSuggestionSearch(event.target.value,item.dataset.suggestionSearch);item.hidden=!match;item.style.display=match?'':'none';if(match)visible++;}
    if(list)list.scrollTop=0;
    const empty=document.querySelector('#timetable-suggestion-empty');if(empty)empty.hidden=visible>0||items.length===0;
    return;
  }
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
    recordCurrentScrollPositions();
    render();
    const input = document.querySelector('#search');
    if (input) {
      input.focus();
      input.setSelectionRange(start, start);
    }
  }
});

document.addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.target;
  if (!form) return;

  // 5. Khóa nút và biểu mẫu khi đang lưu để tránh nhấp/gửi nhiều lần
  if (form.dataset.submitting === 'true' || isGlobalSaving || (isWriting() || isSavingWorking)) {
    return;
  }

  // 7. Khi gặp resource-exhausted, dừng tạo thêm thao tác ghi trong phiên hiện tại
  if (isQuotaExhausted()) {
    toast('Hạn mức ghi Firestore đã hết (resource-exhausted). Mọi thao tác ghi đã dừng trong phiên này.');
    return;
  }

  isGlobalSaving=true;
  form.dataset.submitting = 'true';
  const submitBtns = form.querySelectorAll('button[type="submit"], input[type="submit"], button:not([type="button"])');
  submitBtns.forEach(btn => {
    btn.disabled = true;
    btn.dataset.prevText = btn.textContent;
    btn.textContent = 'Đang lưu...';
  });

  const data = new FormData(form);

  try {
    if (form.id === 'onboarding-form') {
      const subjects = data.getAll('subjects').map(s => String(s).trim()).filter(Boolean);
      if (!subjects.length) {
        toast('Vui lòng chọn ít nhất 1 môn giảng dạy.');
        submitBtns.forEach(btn => {
          btn.disabled = false;
          btn.textContent = btn.dataset.prevText || 'Gửi hồ sơ cho Quản trị viên';
        });
        delete form.dataset.submitting;
        isGlobalSaving = false;
        return;
      }
      const homeroomClassId = String(data.get('homeroomClassId') || '').trim();
      const note = String(data.get('note') || '').trim();
      const displayName = String(data.get('displayName') || '').trim();

      const userEmail = currentUser.email.toLowerCase();
      const newProfile = {
        displayName: displayName || currentUser.displayName || 'Giáo viên',
        role: 'TEACHER',
        active: false,
        selfDeclared: { subjects, homeroomClassId, note }
      };

      // 6. Không ghi lại hồ sơ khi nội dung không đổi
      if (currentUserProfile && areUserProfilesEqual(currentUserProfile, newProfile)) {
        isEditingDeclaredProfile = false;
        toast('Hồ sơ không có thay đổi, không cần gửi lại.');
        render();
        return;
      }

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

      isEditingDeclaredProfile = false;
      toast('Đã gửi hồ sơ thành công. Vui lòng chờ Quản trị viên duyệt.');
      currentUserProfile = {
        email: userEmail,
        role: 'TEACHER',
        active: false,
        selfDeclared: { subjects, homeroomClassId, note }
      };
      render();
    } else if (form.id === 'substitute-form') {
      if(!canEditWorking())throw Error('Bạn không có quyền xếp lịch.');
      const classId=form.dataset.class,timeSlotId=form.dataset.slot,subjectId=String(data.get('subjectId')||''),teacherId=String(data.get('teacherId')||'');
      if(form.dataset.track&&subjectTrack(workingDraft.subjects.find(s=>s.id===subjectId))!==form.dataset.track)throw Error('Môn không thuộc tổ hợp đang sửa.');
      const existing=workingDraft.timetableCells.find(c=>c.classId===classId&&c.timeSlotId===timeSlotId),previousSnapshot=clone(workingDraft.timetableCells);
      let next=assignSubstituteLesson(workingDraft,{classId,timeSlotId,subjectId,teacherId,note:String(data.get('note')||'').trim()});
      next=recordChange(next,{actionType:'EDIT',description:`Dạy thay: ${text(workingDraft.teachers,teacherId,'fullName')} — ${text(workingDraft.subjects,subjectId)}, ${text(workingDraft.classes,classId)}`,classId,timeSlotId,previousCell:existing,newCell:next.timetableCells.find(c=>c.classId===classId&&c.timeSlotId===timeSlotId),actor:currentUser?.email||'Người xếp lịch',previousSnapshot});
      if(await syncWorkingToCloud(next)){dialog.close();render();toast('Đã lưu giáo viên dạy thay vào bản đang xếp. Công bố lịch để giáo viên nhận tiết dạy.');}
    } else if (form.id === 'cell-form') {
      recordCurrentScrollPositions();
      const classId = form.dataset.class;
      const timeSlotId = form.dataset.slot;

      const res = resolveSubjectAndTeacher(workingDraft, {
        quickLine: String(data.get('quickLine') || ''),
        subjectInput: String(data.get('subjectInput') || ''),
        teacherInput: String(data.get('teacherInput') || ''),
        subjectId: String(data.get('subjectId') || ''),
        teacherId: String(data.get('teacherId') || '')
      });

      if (form.dataset.track && subjectTrack(res.state.subjects.find(s=>s.id===res.subjectId))!==form.dataset.track) throw Error('Môn đã chọn không thuộc tổ hợp đang sửa.');
      if (!res.subjectId) {
        throw Error('Vui lòng nhập hoặc chọn môn học.');
      }

      const existing = (workingDraft.timetableCells || []).find(c => c.classId === classId && c.timeSlotId === timeSlotId);
      const previousSnapshot = clone(workingDraft.timetableCells || []);

      let next = putCell(res.state, {
        classId,
        timeSlotId,
        subjectId: res.subjectId,
        teacherId: res.teacherId || '',
        note: String(data.get('note') || '').trim(),
        locked: data.has('locked')
      });

      const clsName = text(res.state.classes || workingDraft.classes, classId);
      const subjName = text(res.state.subjects, res.subjectId);
      const teaName = res.teacherId ? text(res.state.teachers, res.teacherId, 'fullName') : 'Chưa gán GV';
      const slot = (workingDraft.timeSlots || []).find(s => s.id === timeSlotId);
      const slotText = slot ? `Thứ ${slot.dayOfWeek} · Tiết ${slot.period}` : '';
      const desc = `Sửa ô: ${subjName} (${teaName}) lớp ${clsName} vào ${slotText}`;
      const newCell = (next.timetableCells || []).find(c => c.classId === classId && c.timeSlotId === timeSlotId);

      next = recordChange(next, {
        actionType: 'EDIT',
        description: desc,
        classId,
        timeSlotId,
        slotLabel: slotText,
        previousCell: existing,
        newCell,
        actor: currentUser?.email || 'Người xếp lịch',
        previousSnapshot
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
      if(kind==='classes' && data.get('homeroomTeacherId') && data.get('homeroomTeacherId')===data.get('coHomeroomTeacherId'))throw Error('Hai giáo viên chủ nhiệm phải khác nhau.');
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
      const school = {...workingDraft.school,...Object.fromEntries([...data].map(([key, value]) => [key, String(value).trim()]))};
      if (!!school.weekStartDate !== !!school.weekEndDate) throw Error('Vui lòng nhập đủ từ ngày và đến ngày.');
      if(school.weekStartDate && school.weekEndDate < school.weekStartDate) throw Error('Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.');
      if(school.weekStartDate)school.weekDates=[school.weekStartDate,school.weekEndDate].map(v=>v.split('-').reverse().join('/')).join(' – ');
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

      const updatedProfile = {
        role,
        displayName: displayName || (targetEmail === OWNER_EMAIL ? 'Quản trị chính' : ''),
        teacherId,
        isVisiting,
        homeroomClassIds,
        active
      };

      // 6. Không ghi lại hồ sơ khi nội dung không đổi
      const existingUser = accountsList.find(a => a.email.toLowerCase() === targetEmail);
      if (existingUser && areUserProfilesEqual(existingUser, updatedProfile)) {
        toast(`Tài khoản ${targetEmail} không có thay đổi, không cần ghi lại.`);
        dialog.close();
        return;
      }

      await setDoc(
        doc(db, 'users', targetEmail),
        {
          email: targetEmail,
          ...updatedProfile,
          updatedAt: new Date().toISOString(),
          updatedBy: currentUser?.email || 'admin'
        },
        { merge: true }
      );

      toast(`Đã lưu tài khoản ${targetEmail}.`);
      dialog.close();
    } else if (form.id === 'review-profile-form') {
      const targetEmail = form.dataset.target;
      const teacherId = data.get('teacherId') || '';
      const homeroomClassIds = data.getAll('homeroomClassIds');
      const isVisiting = data.has('isVisiting');
      const active = data.has('active');

      const updatedReview = {
        teacherId,
        homeroomClassIds,
        isVisiting,
        active
      };

      // 6. Không ghi lại hồ sơ khi nội dung không đổi
      const existingUser = accountsList.find(a => a.email.toLowerCase() === targetEmail.toLowerCase());
      if (existingUser && areUserProfilesEqual(existingUser, updatedReview)) {
        toast(`Hồ sơ cho ${targetEmail} không có thay đổi.`);
        dialog.close();
        return;
      }

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

      const pData = publishedTimetable?.data || state;
      const slot = (pData.timeSlots || []).find(s => s.id === timeSlotId);
      const cls = (pData.classes || []).find(c => c.id === classId);
      const subj = (pData.subjects || []).find(s => s.id === subjectId);
      const lessonSummary = (slot || cls || subj)
        ? `Thứ ${slot?.dayOfWeek || '?'} · Tiết ${slot?.period || '?'} (${slot?.session === 'MORNING' ? 'Sáng' : 'Chiều'}) · Lớp ${cls?.name || ''} (${subj?.name || ''})`
        : (lessonVal.includes('other') ? 'Điều chỉnh chung' : '');

      const reqId = uid();
      const newReq = {
        id: reqId,
        teacherEmail: (currentUser?.email || '').toLowerCase().trim(),
        teacherName: currentUserProfile?.displayName || currentUser?.displayName || currentUser?.email || 'Giáo viên',
        teacherId: currentUserProfile?.teacherId || '',
        timeSlotId: timeSlotId || '',
        classId: classId || '',
        subjectId: subjectId || '',
        lessonSummary,
        reason,
        proposal,
        status: 'PENDING',
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'requests', reqId), newReq);

      if (!requestsList.some(r => r.id === reqId)) {
        requestsList.unshift(newReq);
      }

      toast('Đã gửi yêu cầu điều chỉnh lịch tới Người xếp lịch và Quản trị viên.');
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

      const targetReq = requestsList.find(r => r.id === reqId);
      if (targetReq) {
        targetReq.status = decision;
        targetReq.responseNote = responseNote;
        targetReq.updatedAt = new Date().toISOString();
        targetReq.updatedBy = currentUser.email;
      }

      toast(`Đã ${decision === 'APPROVED' ? 'chấp thuận' : 'từ chối'} yêu cầu.`);
      dialog.close();
      render();
    } else if (form.id === 'edit-self-declared-form') {
      const subjects = data.getAll('subjects').map(s => String(s).trim());
      const note = String(data.get('note') || '').trim();

      const newSelf = {
        selfDeclared: {
          subjects,
          note
        }
      };

      // 6. Không ghi lại khi nội dung không đổi
      if (currentUserProfile && areUserProfilesEqual(currentUserProfile, newSelf)) {
        toast('Thông tin cá nhân không có thay đổi.');
        dialog.close();
        return;
      }

      await updateDoc(doc(db, 'users', currentUser.email.toLowerCase()), {
        'selfDeclared.subjects': subjects,
        'selfDeclared.note': note,
        updatedAt: new Date().toISOString()
      });

      toast('Đã cập nhật thông tin cá nhân.');
      dialog.close();
    }
  } catch (error) {
    if (checkAndFlagQuotaError(error)) {
      setSync('error', 'Hết hạn mức Cloud (Resource Exhausted)');
      toast('Hệ thống đã đạt hạn mức ghi Firestore (resource-exhausted). Đã dừng mọi thao tác ghi trong phiên này. Hãy tải sao lưu JSON.');
      render();
      return;
    }
    const output = form.querySelector('#form-error');
    if (output) output.textContent = error.message;
    else toast(error.message);
  } finally {
    isGlobalSaving=false;
    form.dataset.submitting = 'false';
    submitBtns.forEach(btn => {
      btn.disabled = false;
      if (btn.dataset.prevText) btn.textContent = btn.dataset.prevText;
    });
  }
});

// ----------------------------------------------------
// Assignment Tray & Drag-and-Drop Event Listeners
// ----------------------------------------------------
document.addEventListener('change', event => {

  if (event.target.id === 'tray-class-select') {
    recordCurrentScrollPositions();
    traySelectedClassId = event.target.value;
    render();
  }
});

document.addEventListener('dragstart', event => {
  const card = event.target.closest('[data-tray-card]');
  if (!card) return;
  const payload = {
    classId: card.dataset.class,
    subjectId: card.dataset.subject,
    teacherId: card.dataset.teacher
  };
  event.dataTransfer.setData('application/json', JSON.stringify(payload));
  event.dataTransfer.setData('text/plain', JSON.stringify(payload));
  card.classList.add('dragging');
});

document.addEventListener('dragend', event => {
  const card = event.target.closest('[data-tray-card]');
  if (card) card.classList.remove('dragging');
  document.querySelectorAll('.cell-dragover').forEach(el => el.classList.remove('cell-dragover'));
});

document.addEventListener('dragover', event => {
  const cell = event.target.closest('[data-cell-drop]');
  if (cell) {
    event.preventDefault();
    cell.classList.add('cell-dragover');
  }
});

document.addEventListener('dragleave', event => {
  const cell = event.target.closest('[data-cell-drop]');
  if (cell) {
    cell.classList.remove('cell-dragover');
  }
});

document.addEventListener('drop', async event => {
  const cell = event.target.closest('[data-cell-drop]');
  if (!cell) return;
  event.preventDefault();
  recordCurrentScrollPositions();
  cell.classList.remove('cell-dragover');

  if (!canEditWorking()) {
    toast('Chỉ Người xếp lịch hoặc Quản trị viên mới được sửa ô ở bản nháp.');
    return;
  }

  let data;
  try {
    const raw = event.dataTransfer.getData('application/json') || event.dataTransfer.getData('text/plain');
    data = JSON.parse(raw);
  } catch {
    return;
  }
  if (!data?.subjectId || !data?.teacherId) return;

  const dropTrack=subjectTrack(workingDraft.subjects.find(s=>s.id===data.subjectId));
  if(cell.dataset.cellTrack && dropTrack!=='COMMON' && dropTrack!==cell.dataset.cellTrack){toast('Môn không thuộc tổ hợp của ô đang thả.');return;}
  const targetClassId = cell.dataset.cellClass;
  const timeSlotId = cell.dataset.cellSlot;
  const day = Number(cell.dataset.cellDay);
  const period = Number(cell.dataset.cellPeriod);
  const dayLabel = `Thứ ${day}`;

  // Teacher conflict check
  const busyInfo = lessonBusy(workingDraft,{teacherId:data.teacherId,classId:targetClassId,timeSlotId,subjectId:data.subjectId});
  if (busyInfo.isBusy) {
    const teaName = text(workingDraft.teachers, data.teacherId, 'fullName');
    const confName = busyInfo.conflictingClass?.name || 'lớp khác';
    toast(`GV ${teaName} đã có lịch dạy ở ${confName} vào tiết này!`);
    return;
  }

  try {
    const existing = (workingDraft.timetableCells || []).find(c => c.classId === targetClassId && c.timeSlotId === timeSlotId);
    const previousSnapshot = clone(workingDraft.timetableCells || []);
    let draftToUse = workingDraft;
    if (existing?.locked) {
      draftToUse = toggleCellLock(draftToUse, targetClassId, timeSlotId);
    }
    let next = assignLessonToScheduleCell(draftToUse, {
      classId: targetClassId,
      day: dayLabel,
      period,
      timeSlotId,
      subjectId: data.subjectId,
      teacherId: data.teacherId
    });
    const clsName = text(workingDraft.classes, targetClassId);
    const subjName = text(workingDraft.subjects, data.subjectId);
    const teaName = text(workingDraft.teachers, data.teacherId, 'fullName') || 'Chưa gán GV';
    const slot = (workingDraft.timeSlots || []).find(s => s.id === timeSlotId);
    const slotText = slot ? `Thứ ${slot.dayOfWeek} · Tiết ${slot.period}` : `${dayLabel} Tiết ${period}`;
    const desc = `Kéo thả gán môn ${subjName} (${teaName}) cho lớp ${clsName} vào ${slotText}`;
    const newCell = (next.timetableCells || []).find(c => c.classId === targetClassId && c.timeSlotId === timeSlotId);

    next = recordChange(next, {
      actionType: 'ASSIGN',
      description: desc,
      classId: targetClassId,
      timeSlotId,
      slotLabel: slotText,
      previousCell: existing,
      newCell,
      actor: currentUser?.email || 'Người xếp lịch',
      previousSnapshot
    });

    if (await syncWorkingToCloud(next)) {
      render();
      toast(`Đã xếp ${subjName} (${teaName}) vào lớp ${clsName}.`);
    }
  } catch (err) {
    toast('Lỗi khi xếp tiết: ' + err.message);
  }
});

// ----------------------------------------------------
// Real-time Scroll Position Tracking (Capture Phase)
// ----------------------------------------------------
document.addEventListener('scroll', event => {
  const target = event.target;
  if (!target) return;
  if (target.id === 'matrix-scroll-container' || target.classList?.contains('matrix-scroll')) {
    if (matrixViewMode === 'assignment') {
      matrixScrollPositions.assignment.left = target.scrollLeft;
      matrixScrollPositions.assignment.top = target.scrollTop;
    } else if (matrixViewMode === 'timetable') {
      matrixScrollPositions.timetable.left = target.scrollLeft;
      matrixScrollPositions.timetable.top = target.scrollTop;
    }
  } else if (target.classList?.contains('tray-cards-container') || target.classList?.contains('timetable-tray-sidebar')) {
    savedTrayScrollLeft = target.scrollLeft;
    savedTrayScrollTop = target.scrollTop;
  } else if (target.classList?.contains('workspace')) {
    savedWorkspaceScrollTop = target.scrollTop;
  }
}, { capture: true, passive: true });

window.addEventListener('scroll', () => {
  savedWindowScrollX = window.scrollX || window.pageXOffset || 0;
  savedWindowScrollY = window.scrollY || window.pageYOffset || 0;
}, { passive: true });

// Run initial connection test and start Auth listener
testConnection().then(health=>{
  if(!health.configured){
    app.innerHTML='<div class="auth-overlay"><div class="login-card"><span class="brand-icon">▦</span><h1>Bản thử kết nối Supabase</h1><p>Bản thử đã sẵn sàng nhưng chưa có nơi lưu dữ liệu.</p><p>Tạo dự án Supabase miễn phí, chạy tệp thiết lập SQL và đặt cấu hình máy chủ theo HƯỚNG DẪN trong gói tải về.</p><p>App chính và dữ liệu Firebase hiện tại vẫn được giữ nguyên.</p></div></div>';return;
  }
  handleAuthState();
}).catch(()=>{app.innerHTML='<div class="auth-overlay"><div class="login-card"><h1>Chưa kết nối được máy chủ thử nghiệm</h1><p>Khởi động máy chủ API rồi tải lại trang. Chưa có dữ liệu nào được chuyển.</p></div></div>';});



document.addEventListener('change', event => {

  const el = event.target;
  if (el.id === 'grade11-editor-track') cellEditor(el.dataset.class, el.dataset.slot, el.value);
  if (el.id === 'grade11-popover-track') {
    grade11Track = el.value;
    const slot = workingDraft.timeSlots.find(s => s.id === el.dataset.slot);
    const anchor = Array.from(document.querySelectorAll('[data-cell-class]')).find(n => n.dataset.cellClass === el.dataset.class && n.dataset.cellSlot === el.dataset.slot);
    if (anchor && slot) openTimetableCellPopover({ classId: el.dataset.class, timeSlotId: slot.id, day: slot.dayOfWeek, period: slot.period, anchorElement: anchor });
  }
  if (el.id === 'homeroom-class-select') {
    selectedHomeroomClassId = el.value;
    render();
  }
  if (el.id === 'homeroom-track-select') {
    homeroomExportTrack = el.value;
    render();
  }
  if (el.id === 'poster-show-teacher-toggle') {
    homeroomShowTeacher = el.checked;
    render();
  }
});


window.addEventListener('beforeunload',event=>{if(isSavingWorking || isWriting()){event.preventDefault();event.returnValue='';}});

window.addEventListener('offline',()=>{setSync('offline','Mất mạng — chưa thể đồng bộ');toast('Mất mạng. Giữ trang mở nếu còn thay đổi chưa lưu.');});
window.addEventListener('online',()=>{if(!isSavingWorking)setSync('idle','Đã có mạng — tự kiểm tra Cloud định kỳ');});

document.addEventListener('input',event=>{if(event.target.id==='avail-note')rememberAvailabilityNote();});

document.addEventListener('keydown',event=>{if(event.key==='Escape'&&document.querySelector('.schedule-focus')&&!dialog.open&&!document.querySelector('.matrix-popover')){matrixFocusEnabled=false;render();}});

(()=>{const selector='#vaschools-timetable-poster,#student-timetable-card,#weekly-menu-poster,#lesson-report-poster';let frame=0;const observer=new ResizeObserver(()=>queue());let parents=[];
function fit(){frame=0;const posters=[...document.querySelectorAll(selector)];const next=posters.map(p=>p.parentElement);if(next.length!==parents.length||next.some((p,i)=>p!==parents[i])){observer.disconnect();parents=next;parents.forEach(p=>observer.observe(p));}
for(const p of posters){const host=p.parentElement;host.classList.add('sheet-preview-frame');const width=host.clientWidth;const style=getComputedStyle(host);const available=width-parseFloat(style.paddingLeft||0)-parseFloat(style.paddingRight||0);const natural=p.offsetWidth;if(available>0&&natural>0)p.style.setProperty('--poster-preview-scale',String(Math.min(1,available/natural)));}}
function queue(){if(!frame)frame=requestAnimationFrame(fit);}new MutationObserver(queue).observe(document.querySelector('#app'),{childList:true,subtree:true});window.addEventListener('resize',queue);document.fonts.ready.then(queue);queue();})();
