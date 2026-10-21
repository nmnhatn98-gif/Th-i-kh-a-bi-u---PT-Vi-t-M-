import { SEED } from './seed.js';
import {
  uid,
  clone,
  keyOf,
  effectiveTeacher,
  findConflicts,
  putCell,
  deleteCell,
  deleteEntity,
  makeSnapshot,
  restoreSnapshot,
  publish,
  validateState,
  parseBackup,
  exportCsv
} from './core.js';

const KEY = 'TKB_NEW_V1';
let state = clone(SEED);
let view = 'matrix';
let grade = '';
let teacher = '';
let query = '';
let compact = true;
let showPublished = false;
let undo = [];
let redo = [];
let pendingExternal = null;

const app = document.querySelector('#app');
const dialog = document.querySelector('#editor');

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[c]));

const text = (items, id, field = 'name') => items.find(x => x.id === id)?.[field] || '—';
const nameOfTeacher = id => text(state.teachers, id, 'fullName');
const fmt = date => new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(date));

let toastTimer;
function toast(message) {
  const toastEl = document.querySelector('#toast');
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('visible'), 4500);
}

let startupError = '';
try {
  const saved = localStorage.getItem(KEY);
  if (saved) state = parseBackup(saved, SEED);
} catch (error) {
  startupError = 'Không đọc được dữ liệu đã lưu. Bản gốc vẫn được giữ; hãy nhập bản sao lưu. ' + error.message;
}

let saveTime = null;
try {
  saveTime = localStorage.getItem(KEY + '_savedAt');
} catch {}

function commit(next, message = 'Đã lưu thay đổi trên thiết bị này.') {
  if (pendingExternal) {
    toast('Có thay đổi ở tab khác. Hãy tải lại dữ liệu trước khi sửa.');
    return false;
  }
  try {
    validateState(next);
    const encoded = JSON.stringify(next);
    const now = new Date().toISOString();
    localStorage.setItem(KEY + '_previous', JSON.stringify(state));
    localStorage.setItem(KEY, encoded);
    saveTime = now;
    try {
      localStorage.setItem(KEY + '_savedAt', now);
    } catch {}
    undo.push(clone(state));
    if (undo.length > 25) undo.shift();
    redo = [];
    state = next;
    render();
    if (message) toast(message);
    return true;
  } catch (error) {
    toast('Chưa lưu: ' + error.message);
    return false;
  }
}

function history(direction) {
  const from = direction === 'undo' ? undo : redo;
  const to = direction === 'undo' ? redo : undo;
  if (!from.length || pendingExternal) return;
  const next = from.at(-1);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
    saveTime = new Date().toISOString();
    try {
      localStorage.setItem(KEY + '_savedAt', saveTime);
    } catch {}
    from.pop();
    to.push(state);
    state = next;
    render();
    toast('Đã ' + (direction === 'undo' ? 'hoàn tác.' : 'làm lại.'));
  } catch (e) {
    toast('Chưa lưu: ' + e.message);
  }
}

function displayed() {
  return showPublished && state.published ? { ...state, ...state.published.data } : state;
}

function download(name, data, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function backup() {
  download(`tkb-sao-luu-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(state, null, 2));
}

function selectOptions(items, selected, label = 'name', empty = '— Chọn —') {
  return (
    `<option value="">${esc(empty)}</option>` +
    items.map(item => `<option value="${esc(item.id)}" ${item.id === selected ? 'selected' : ''}>${esc(item[label])}${label === 'fullName' ? ' · ' + esc(item.code) : ''}</option>`).join('')
  );
}

const titles = {
  matrix: 'Thời khóa biểu toàn trường',
  teacher: 'Lịch giáo viên',
  conflicts: 'Kiểm tra lịch trùng',
  versions: 'Phiên bản & bản đã chốt',
  catalog: 'Danh mục phục vụ xếp lịch',
  settings: 'Thông tin & dữ liệu'
};

function render() {
  const s = displayed();
  const conflicts = findConflicts(state);
  const published = !!state.published;

  app.innerHTML = `<aside class="sidebar"><a class="brand" href="#"><span class="brand-icon">▦</span><span>TKB<span class="brand-sub">SỔ LỊCH NHÀ TRƯỜNG</span></span></a><div class="sidebar-label">KHÔNG GIAN LÀM VIỆC</div><nav>${[
    ['matrix', '▦', 'Toàn trường'],
    ['teacher', '◷', 'Lịch giáo viên'],
    ['conflicts', '◎', 'Kiểm tra lịch'],
    ['versions', '▱', 'Phiên bản'],
    ['catalog', '▤', 'Danh mục'],
    ['settings', '⚙', 'Thông tin & dữ liệu']
  ]
    .map(
      ([id, icon, name]) =>
        `<button data-view="${id}" class="nav-button ${view === id ? 'active' : ''}"><span>${icon}</span>${name}${id === 'conflicts' && conflicts.length ? `<b class="badge">${conflicts.length}</b>` : ''}</button>`
    )
    .join(
      ''
    )}</nav><div class="sidebar-bottom"><span class="status-dot"></span> Bản nền 1.0<p>Lưu riêng trên trình duyệt này.<br>Sao lưu để chuyển sang thiết bị khác.</p><button data-action="backup" class="sidebar-backup">↓ Sao lưu dữ liệu</button></div></aside>
  <div class="workspace"><header class="topbar"><span>${esc(state.school.name)}</span><div><span class="year">${esc(state.school.year)} · ${esc(state.school.term)}</span><button data-action="school" class="icon-button" aria-label="Sửa thông tin trường">✎</button></div></header><main>
  ${pendingExternal ? '<div class="alert">Có dữ liệu mới từ tab khác. <button data-action="reload-external">Tải dữ liệu mới</button></div>' : ''}
  ${startupError ? `<div class="alert">${esc(startupError)}</div>` : ''}
  <div class="page-heading"><div><div class="eyebrow">LẬP LỊCH • ${esc(state.school.term)}</div><h1>${titles[view]}</h1><p>${view === 'matrix' ? 'Một ma trận chung. Mọi lớp học, trong cùng một nhịp.' : view === 'catalog' ? 'Chỉ quản lý lớp, môn và giáo viên để chọn trực tiếp trong ô lịch.' : 'Tổ chức lịch dạy rõ ràng, dễ kiểm tra và lưu trữ.'}</p></div><div class="heading-actions"><button data-action="undo" ${!undo.length || showPublished ? 'disabled' : ''} title="Hoàn tác">↶</button><button data-action="redo" ${!redo.length || showPublished ? 'disabled' : ''} title="Làm lại">↷</button><button data-action="print">In / PDF</button><button data-action="csv">Xuất CSV</button><button class="primary" data-action="save-version">＋ Lưu phiên bản</button></div></div>
  ${view === 'matrix' || view === 'teacher' ? `<section class="stats"><div><span class="stat-icon">▤</span><div><strong>${s.classes.length}</strong><span>Lớp học</span></div></div><div><span class="stat-icon">♙</span><div><strong>${s.teachers.length}</strong><span>Giáo viên</span></div></div><div><span class="stat-icon">▦</span><div><strong>${s.timetableCells.length}<small> / ${s.classes.length * s.timeSlots.length}</small></strong><span>Ô đã xếp · gồm hoạt động cố định</span></div></div><div class="${conflicts.length ? 'warning-stat' : ''}"><span class="stat-icon">◎</span><div><strong>${conflicts.length ? conflicts.length : 'Không có'}</strong><span>Khung giờ trùng giáo viên trong bản nháp</span></div></div></section>` : ''}
  <div id="content">${view === 'matrix' || view === 'teacher' ? matrix(s) : view === 'catalog' ? catalog() : view === 'conflicts' ? conflictPage() : view === 'versions' ? versionsPage() : settings()}</div>
  <footer><span>TKB • Bản nền 1.0</span><span>${saveTime ? 'Lưu trên thiết bị lúc ' + esc(fmt(saveTime)) : 'Dữ liệu khởi tạo · Chưa có thay đổi'} · <button data-action="backup">Sao lưu</button></span></footer></main></div>`;
}

function matrix(s) {
  const classes = s.classes.filter(c => !grade || (grade === 'THCS' ? c.grade <= 9 : grade === 'THPT' ? c.grade >= 10 : String(c.grade) === grade));
  const index = new Map(s.timetableCells.map(c => [keyOf(c.classId, c.timeSlotId), c]));
  const conflictIds = new Set(findConflicts(s).flat().map(c => c.id));
  const teacherName = text(s.teachers, teacher, 'fullName');
  const isReadonly = showPublished && !!state.published;
  let rows = '';

  for (let day = 2; day <= 6; day++) {
    const slots = s.timeSlots.filter(slot => slot.dayOfWeek === day).sort((a, b) => a.globalPeriod - b.globalPeriod);
    slots.forEach((slot, i) => {
      rows += `<tr class="${i === 0 ? 'day-start ' : ''}${slot.period === 1 && slot.session === 'AFTERNOON' ? 'afternoon-start' : ''}">${i === 0 ? `<th rowspan="9" class="sticky-day day-name">THỨ ${['', '', 'HAI', 'BA', 'TƯ', 'NĂM', 'SÁU'][day]}</th>` : ''}${slot.period === 1 ? `<th rowspan="${slot.session === 'MORNING' ? 5 : 4}" class="sticky-session session ${slot.session.toLowerCase()}">${slot.session === 'MORNING' ? 'SÁNG' : 'CHIỀU'}</th>` : ''}<th class="sticky-period period">${slot.period}</th><td class="sticky-time time">${esc(slot.startTime)}<br><span>${esc(slot.endTime)}</span></td>`;
      for (const cls of classes) {
        const cell = index.get(keyOf(cls.id, slot.id));
        const subject = cell ? s.subjects.find(x => x.id === cell.subjectId) : null;
        const teacherText = cell ? text(s.teachers, cell.teacherId, 'fullName') : '';
        const match =
          (!teacher || cell?.teacherId === teacher) &&
          (!query || `${subject?.name || ''} ${teacherText} ${cls.name}`.toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi')));
        rows += `<td class="lesson ${cell ? 'filled' : 'empty'} ${!match ? 'dim' : ''} ${cell && conflictIds.has(cell.id) ? 'conflict' : ''}" style="${subject ? '--subject:' + esc(subject.color) + ';' : ''}"><button data-cell-class="${esc(cls.id)}" data-cell-slot="${esc(slot.id)}" aria-label="${esc(`${cls.name}, thứ ${day}, ${slot.session === 'MORNING' ? 'sáng' : 'chiều'} tiết ${slot.period}${subject ? ', ' + subject.name : ''}`)}" ${isReadonly ? 'disabled' : ''}>${cell ? `<span class="subject-name">${esc(subject?.name)} ${cell.locked ? '<span class="lock" title="Đã khóa">▣</span>' : ''}</span><span class="teacher-name">${cell.teacherId ? esc(teacherText) : 'Chưa chọn giáo viên'}</span>${cell.note ? `<span class="cell-note" title="${esc(cell.note)}">${esc(cell.note)}</span>` : ''}` : '<span class="empty-mark">＋</span>'}</button></td>`;
      }
      rows += '</tr>';
    });
  }

  return `<section class="matrix-panel"><div class="panel-toolbar"><div class="segmented"><button data-action="draft" class="${!isReadonly ? 'selected' : ''}">Bản đang xếp</button><button data-action="published" class="${isReadonly ? 'selected' : ''}" ${!state.published ? 'disabled' : ''}>Bản đã chốt ${state.published ? '✓' : ''}</button></div><div class="toolbar-right"><label class="sr-only" for="teacher-filter">Lọc giáo viên</label><select id="teacher-filter">${selectOptions(s.teachers, teacher, 'fullName', 'Tất cả giáo viên')}</select><label class="search"><span>⌕</span><input id="search" placeholder="Tìm môn, giáo viên, lớp…" value="${esc(query)}" aria-label="Tìm trong ma trận"></label><button data-action="density" class="icon-button" title="Đổi độ rộng cột">${compact ? '↔' : '↦↤'}</button><button data-action="fullscreen" class="icon-button" title="Toàn màn hình">⛶</button></div></div><div class="grade-toolbar"><span>Cột lớp</span>${['', 'THCS', 'THPT', '6', '7', '8', '9', '10', '11', '12'].map(g => `<button data-grade="${g}" class="${grade === g ? 'selected' : ''}">${g ? (g === 'THCS' || g === 'THPT' ? g : 'Khối ' + g) : 'Toàn trường'}</button>`).join('')}<span class="class-count">${classes.length} lớp</span></div>
  <div class="matrix-caption"><div><span class="live-pill ${isReadonly ? 'published' : ''}">${isReadonly ? '✓ ĐÃ CHỐT' : '● BẢN ĐANG XẾP'}</span><h2>THỜI KHÓA BIỂU TOÀN TRƯỜNG</h2><p>${esc(s.school.name)} · ${esc(s.school.year)} · ${esc(s.school.term)}${s.school.appliedDate ? ' · Áp dụng ' + esc(s.school.appliedDate) : ''}</p></div><p class="matrix-help">${isReadonly ? 'Bản đã chốt được giữ độc lập với bản đang xếp.' : teacher ? 'Đang rọi sáng lịch: ' + esc(teacherName) : 'Nhấp một ô để chọn môn & giáo viên. Ô có ▣ đang khóa.'}</p></div>
  <div class="matrix-scroll" tabindex="0" role="region" aria-label="Ma trận thời khóa biểu, cuộn ngang để xem tất cả lớp"><table class="matrix ${compact ? 'compact' : ''}"><thead><tr><th class="sticky-day">Thứ</th><th class="sticky-session">Buổi</th><th class="sticky-period">Tiết</th><th class="sticky-time">Thời gian</th>${classes.map(cls => `<th class="class-header"><strong>${esc(cls.name)}</strong><span>${cls.grade < 10 ? 'THCS' : 'THPT'} · Khối ${cls.grade}</span><div><span>GV1: ${esc(text(s.teachers, cls.homeroomTeacherId, 'fullName'))}</span><span>GV2: ${esc(text(s.teachers, cls.coHomeroomTeacherId, 'fullName'))}</span></div></th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div><div class="matrix-bottom"><span><i></i> Môn học & giáo viên trong cùng một ô</span><span>${isReadonly ? 'Chế độ xem' : 'Lưu ngay sau mỗi thao tác'} · Thứ Hai → Thứ Sáu · 5 sáng / 4 chiều</span></div></section>`;
}

function catalog() {
  return `<div class="notice">Không có phân công chuyên môn hoặc định mức giáo viên. Chọn môn và giáo viên trực tiếp trên ma trận.</div><div class="catalog-grid">${[['classes', 'Lớp học'], ['subjects', 'Môn học'], ['teachers', 'Giáo viên']].map(([kind, label]) => `<section class="card"><div class="card-title"><h2>${label} <small>${state[kind].length}</small></h2><button data-add="${kind}" class="primary">＋ Thêm</button></div>${state[kind].length ? `<div class="catalog-list">${state[kind].map(item => `<div class="catalog-row"><div>${kind === 'subjects' ? `<i class="subject-dot" style="background:${esc(item.color)}"></i>` : ''}<strong>${esc(kind === 'teachers' ? item.fullName : item.name)}</strong><small>${esc(item.code)}${kind === 'classes' ? ' · Khối ' + item.grade : ''}</small></div><button data-edit="${kind}" data-id="${esc(item.id)}" aria-label="Sửa ${esc(item.name || item.fullName)}">Sửa</button><button data-delete="${kind}" data-id="${esc(item.id)}" class="danger-link" aria-label="Xóa ${esc(item.name || item.fullName)}">×</button></div>`).join('')}</div>` : '<div class="empty-state"><span>♙</span><h3>Thêm giáo viên để bắt đầu</h3><p>Chỉ cần mã và họ tên. Không cần nhập số tiết.</p></div>'}</section>`).join('')}</div>`;
}

function conflictPage() {
  const groups = findConflicts(state);
  return `<section class="card"><div class="card-title"><h2>${groups.length ? 'Cần kiểm tra ' + groups.length + ' khung giờ' : 'Không có lịch trùng giáo viên'}</h2><button data-action="go-matrix">Mở ma trận</button></div><p class="muted">Kiểm tra giáo viên dạy nhiều lớp trong cùng một tiết. Các ô chưa chọn giáo viên chưa thể kiểm tra trùng.</p>${groups.map(group => {
    const slot = state.timeSlots.find(s => s.id === group[0].timeSlotId);
    return `<div class="conflict-row"><span class="warning-icon">!</span><div><strong>${esc(nameOfTeacher(group[0].teacherId))}</strong><p>Thứ ${slot.dayOfWeek} · ${slot.session === 'MORNING' ? 'Sáng' : 'Chiều'} tiết ${slot.period} · ${esc(slot.startTime)}</p></div><div class="conflict-links">${group.map(cell => `<button data-cell-class="${esc(cell.classId)}" data-cell-slot="${esc(cell.timeSlotId)}">${esc(text(state.classes, cell.classId))} · ${esc(text(state.subjects, cell.subjectId))} ↗</button>`).join('')}</div></div>`;
  }).join('')}${!groups.length ? '<div class="empty-state"><span class="success-icon">✓</span><h3>Lịch hiện tại không trùng giáo viên</h3><p>Tiếp tục chọn giáo viên cho các ô còn thiếu để kiểm tra đầy đủ.</p></div>' : ''}<div class="notice">${state.timetableCells.filter(c => !c.teacherId).length} ô đã có môn hoặc hoạt động nhưng chưa chọn giáo viên. Kiểm tra này chưa bao gồm phòng học, lịch bận và đủ tiết chương trình.</div></section>`;
}

function versionsPage() {
  return `<section class="card"><div class="card-title"><h2>Bản đã chốt</h2><button class="primary" data-action="publish">Chốt bản đang xếp</button></div>${state.published ? `<div class="published-card"><div><span class="live-pill published">✓ ĐÃ CHỐT</span><h3>${esc(state.published.name)}</h3><p>${esc(fmt(state.published.publishedAt))} · ${state.published.data.timetableCells.length} ô</p></div><div><button data-action="view-published">Xem ma trận</button><button data-action="restore-published">Khôi phục về bản đang xếp</button><button class="danger-link" data-action="unpublish">Gỡ bản đã chốt</button></div></div>` : '<p class="muted">Chưa có bản đã chốt. Sau khi kiểm tra lịch, chốt một bản để giữ độc lập với các chỉnh sửa tiếp theo.</p>'}</section><section class="card"><div class="card-title"><h2>Các phiên bản đã lưu</h2><button data-action="save-version">＋ Lưu phiên bản</button></div>${state.versions.length ? state.versions.map(v => `<div class="version-row"><div><strong>${esc(v.name)}</strong><p>${esc(fmt(v.createdAt))} · ${v.data.timetableCells.length} ô</p></div><button data-restore="${esc(v.id)}">Khôi phục</button><button data-remove-version="${esc(v.id)}" class="danger-link">Xóa</button></div>`).join('') : '<div class="empty-state"><span>▱</span><h3>Giữ lại một cột mốc</h3><p>Lưu một phiên bản trước mỗi đợt chỉnh sửa lớn.</p></div>'}</section>`;
}

function settings() {
  return `<div class="settings-grid"><section class="card"><h2>Thông tin nhà trường</h2><dl><dt>Trường</dt><dd>${esc(state.school.name)}</dd><dt>Năm học</dt><dd>${esc(state.school.year)}</dd><dt>Học kỳ</dt><dd>${esc(state.school.term)}</dd><dt>Áp dụng từ</dt><dd>${esc(state.school.appliedDate || 'Chưa đặt')}</dd></dl><button data-action="school">Chỉnh sửa</button></section><section class="card"><h2>Sao lưu & chuyển dữ liệu</h2><p>Thay đổi được lưu trên trình duyệt của thiết bị này. Xuất bản sao lưu JSON để chuyển máy hoặc giữ dữ liệu an toàn.</p><div class="button-row"><button class="primary" data-action="backup">↓ Tải bản sao lưu JSON</button><button data-action="import">↑ Nhập JSON mới / app cũ</button><button data-action="csv">Xuất ma trận CSV</button><button data-action="recover">Lấy bản dự phòng gần nhất</button></div><p class="muted">Nhập từ app cũ: giữ lớp, môn, giáo viên, khung giờ và ô lịch; bỏ dữ liệu phân công và định mức. Dữ liệu thiếu tham chiếu sẽ được báo lỗi thay vì tự sửa.</p></section><section class="card"><h2>Khung ma trận gốc</h2><p>17 lớp ban đầu · Thứ Hai–thứ Sáu · 5 tiết sáng / 4 tiết chiều. Giữ các cột Thứ, Buổi, Tiết, Thời gian và giáo viên chủ nhiệm GV1 / GV2.</p><p class="muted">Giờ học và các hoạt động cố định được lấy từ mã nguồn cũ. Lịch đang vận hành trên Firebase cần nhập bằng bản sao lưu.</p></section><section class="card"><h2>Không gian mới</h2><p>Tạo một bản trống, giữ danh sách lớp, môn và giáo viên. Các ô đang khóa cũng sẽ được xóa.</p><button class="danger-link" data-action="clear">Xóa toàn bộ ô ở bản đang xếp</button><p class="muted">Bản đã chốt và các phiên bản đã lưu được giữ nguyên.</p></section></div>`;
}

function openDialog(html) {
  dialog.innerHTML = html;
  if (!dialog.open) dialog.showModal();
}

const closeButton = '<button type="button" data-action="close" class="icon-button" aria-label="Đóng">×</button>';

function cellEditor(classId, timeSlotId) {
  if (showPublished) {
    toast('Chuyển về bản đang xếp để chỉnh sửa.');
    return;
  }
  const cls = state.classes.find(c => c.id === classId);
  const slot = state.timeSlots.find(s => s.id === timeSlotId);
  const cell = state.timetableCells.find(c => c.classId === classId && c.timeSlotId === timeSlotId);
  const locked = !!cell?.locked;
  openDialog(
    `<form id="cell-form" data-class="${esc(classId)}" data-slot="${esc(timeSlotId)}"><div class="dialog-title"><div><div class="eyebrow">CHỈNH Ô THỜI KHÓA BIỂU</div><h2>${esc(cls.name)}</h2><p>Thứ ${slot.dayOfWeek} · ${slot.session === 'MORNING' ? 'Sáng' : 'Chiều'} tiết ${slot.period} · ${esc(slot.startTime)}–${esc(slot.endTime)}</p></div>${closeButton}</div>${locked ? '<div class="notice">Ô đã khóa. Mở khóa để thay đổi môn, giáo viên hoặc xóa.</div>' : ''}<fieldset ${locked ? 'disabled' : ''}><label>Môn học<select name="subjectId" required>${selectOptions(state.subjects, cell?.subjectId, 'name', 'Chọn môn học')}</select></label><label>Giáo viên<select name="teacherId">${selectOptions(state.teachers, cell?.teacherId, 'fullName', 'Chưa chọn giáo viên')}</select></label><p class="field-help">Giáo viên đã có lịch cùng tiết sẽ được báo trước khi lưu.</p><label>Ghi chú<input name="note" maxlength="200" value="${esc(cell?.note || '')}" placeholder="Ví dụ: học phòng tin, học bù…"></label><label class="checkbox"><input type="checkbox" name="locked"> Khóa ô sau khi lưu</label></fieldset><div id="form-error" class="form-error" role="alert"></div><div class="dialog-actions">${cell ? `<button type="button" data-action="toggle-lock" data-class="${esc(classId)}" data-slot="${esc(timeSlotId)}">${locked ? 'Mở khóa' : 'Khóa ô'}</button><button type="button" data-action="delete-cell" data-class="${esc(classId)}" data-slot="${esc(timeSlotId)}" class="danger-link" ${locked ? 'disabled' : ''}>Xóa ô</button>` : ''}<button type="button" data-action="close">Hủy</button><button class="primary" type="submit" ${locked ? 'disabled' : ''}>Lưu ô lịch</button></div></form>`
  );
}

function entityEditor(kind, id) {
  const item = state[kind].find(x => x.id === id) || {};
  const labels = { classes: 'lớp', subjects: 'môn', teachers: 'giáo viên' };
  openDialog(
    `<form id="entity-form" data-kind="${kind}" data-id="${esc(id || '')}"><div class="dialog-title"><h2>${id ? 'Sửa' : 'Thêm'} ${labels[kind]}</h2>${closeButton}</div><label>Mã ${labels[kind]}<input name="code" maxlength="30" required value="${esc(item.code || '')}" placeholder="${kind === 'teachers' ? 'GV01' : kind === 'classes' ? '6A1' : 'TOAN'}"></label><label>${kind === 'teachers' ? 'Họ tên giáo viên' : 'Tên hiển thị'}<input name="name" maxlength="100" required value="${esc(kind === 'teachers' ? item.fullName || '' : item.name || '')}"></label>${kind === 'classes' ? `<label>Khối<select name="grade">${[6, 7, 8, 9, 10, 11, 12].map(g => `<option value="${g}" ${item.grade === g ? 'selected' : ''}>Khối ${g}</option>`).join('')}</select></label><label>Giáo viên chủ nhiệm 1<select name="homeroomTeacherId">${selectOptions(state.teachers, item.homeroomTeacherId, 'fullName', 'Chưa chọn')}</select></label><label>Giáo viên chủ nhiệm 2<select name="coHomeroomTeacherId">${selectOptions(state.teachers, item.coHomeroomTeacherId, 'fullName', 'Chưa chọn')}</select></label>` : kind === 'subjects' ? `<label>Màu môn<input name="color" type="color" value="${esc(item.color || '#2563eb')}"></label>` : '<p class="field-help">Chỉ cần mã và họ tên. Chọn giáo viên trực tiếp khi xếp ô lịch.</p>'}<div id="form-error" class="form-error" role="alert"></div><div class="dialog-actions"><button type="button" data-action="close">Hủy</button><button type="submit" class="primary">Lưu</button></div></form>`
  );
}

function schoolEditor() {
  openDialog(
    `<form id="school-form"><div class="dialog-title"><h2>Thông tin nhà trường</h2>${closeButton}</div>${[['name', 'Tên trường'], ['year', 'Năm học'], ['term', 'Học kỳ'], ['appliedDate', 'Áp dụng từ']].map(([key, label]) => `<label>${label}<input name="${key}" value="${esc(state.school[key])}" ${key === 'appliedDate' ? 'type="date"' : 'required maxlength="120"'}></label>`).join('')}<div id="form-error" class="form-error" role="alert"></div><div class="dialog-actions"><button type="button" data-action="close">Hủy</button><button class="primary">Lưu thông tin</button></div></form>`
  );
}

function importFile() {
  const picker = document.createElement('input');
  picker.type = 'file';
  picker.accept = '.json,application/json';
  picker.onchange = async () => {
    const file = picker.files[0];
    if (!file) return;
    try {
      if (file.size > 20 * 1024 * 1024) throw Error('Tệp vượt quá 20 MB.');
      const next = parseBackup(await file.text(), SEED);
      openDialog(
        `<div class="dialog-title"><h2>Kiểm tra dữ liệu trước khi nhập</h2>${closeButton}</div><p>Tệp: ${esc(file.name)}</p><div class="import-counts">${next.classes.length} lớp · ${next.subjects.length} môn · ${next.teachers.length} giáo viên · ${next.timetableCells.length} ô lịch</div><p>Thay thế dữ liệu đang dùng bằng tệp này. Bản hiện tại sẽ được tải xuống trước khi thay thế.</p><div class="dialog-actions"><button data-action="close">Hủy</button><button id="confirm-import" class="primary">Sao lưu & nhập dữ liệu</button></div>`
      );
      document.querySelector('#confirm-import').onclick = () => {
        backup();
        if (commit(next, 'Đã nhập dữ liệu.')) {
          startupError = '';
          showPublished = false;
          teacher = '';
          grade = '';
          dialog.close();
          render();
        }
      };
    } catch (error) {
      toast('Không nhập: ' + error.message);
    }
  };
  picker.click();
}

const actions = {
  close: () => dialog.close(),
  backup,
  school: schoolEditor,
  import: importFile,
  undo: () => history('undo'),
  redo: () => history('redo'),
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
    render();
  },
  published: () => {
    showPublished = true;
    teacher = '';
    render();
  },
  'go-matrix': () => {
    view = 'matrix';
    showPublished = false;
    render();
  },
  'view-published': () => {
    view = 'matrix';
    showPublished = true;
    teacher = '';
    render();
  },
  'save-version': () => {
    const name = prompt('Tên phiên bản:', `Bản lịch ${state.versions.length + 1}`)?.trim();
    if (name) commit({ ...state, versions: [makeSnapshot(state, name.slice(0, 100)), ...state.versions] }, 'Đã lưu phiên bản độc lập.');
  },
  publish: () => {
    try {
      if (confirm('Chốt bản đang xếp? Bản đã chốt hiện tại sẽ được thay thế.')) commit(publish(state), 'Đã chốt lịch trên thiết bị này.');
    } catch (e) {
      toast(e.message);
    }
  },
  unpublish: () => {
    if (confirm('Gỡ bản đã chốt? Bản đang xếp và các phiên bản được giữ nguyên.')) {
      if (commit({ ...state, published: null }, 'Đã gỡ bản đã chốt.')) showPublished = false;
    }
  },
  'restore-published': () => {
    if (state.published && confirm('Khôi phục cả danh mục và ô lịch từ bản đã chốt?')) commit(restoreSnapshot(state, state.published), 'Đã khôi phục bản đã chốt.');
  },
  clear: () => {
    if (confirm('Xóa TẤT CẢ ô ở bản đang xếp, gồm ô khóa? Hãy giữ bản sao lưu trước khi tiếp tục.')) {
      backup();
      commit({ ...state, timetableCells: [] }, 'Đã tạo bản lịch trống.');
    }
  },
  recover: () => {
    const raw = localStorage.getItem(KEY + '_previous');
    if (!raw) {
      toast('Chưa có bản dự phòng.');
      return;
    }
    download('tkb-du-phong.json', raw);
    toast('Đã tải bản dự phòng. Dùng Nhập JSON để kiểm tra và khôi phục.');
  },
  'reload-external': () => {
    if (pendingExternal) {
      state = pendingExternal;
      pendingExternal = null;
      undo = [];
      redo = [];
      showPublished = false;
      saveTime = localStorage.getItem(KEY + '_savedAt');
      dialog.close();
      render();
    }
  },
  'toggle-lock': element => {
    const { class: classId, slot: timeSlotId } = element.dataset;
    const next = {
      ...state,
      timetableCells: state.timetableCells.map(c => (c.classId === classId && c.timeSlotId === timeSlotId ? { ...c, locked: !c.locked } : c))
    };
    if (commit(next)) {
      cellEditor(classId, timeSlotId);
    }
  },
  'delete-cell': element => {
    try {
      if (commit(deleteCell(state, element.dataset.class, element.dataset.slot), 'Đã xóa ô lịch.')) dialog.close();
    } catch (e) {
      toast(e.message);
    }
  }
};

document.addEventListener('click', event => {
  const element = event.target.closest('button');
  if (!element) return;
  if (element.dataset.action) {
    actions[element.dataset.action]?.(element);
    return;
  }
  if (element.dataset.view) {
    view = element.dataset.view;
    showPublished = false;
    render();
    return;
  }
  if (element.hasAttribute('data-grade')) {
    grade = element.dataset.grade;
    render();
    return;
  }
  if (element.dataset.cellClass) {
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
    try {
      const next = deleteEntity(state, element.dataset.delete, element.dataset.id);
      if (confirm('Xóa mục này khỏi danh mục?')) commit(next, 'Đã xóa khỏi danh mục.');
    } catch (error) {
      toast(error.message);
    }
    return;
  }
  if (element.dataset.restore) {
    const version = state.versions.find(v => v.id === element.dataset.restore);
    if (version && confirm('Khôi phục danh mục và ma trận từ phiên bản này? Có thể hoàn tác ngay sau đó.')) {
      commit(restoreSnapshot(state, version), 'Đã khôi phục phiên bản.');
    }
    return;
  }
  if (element.dataset.removeVersion && confirm('Xóa phiên bản đã lưu này?')) {
    commit({ ...state, versions: state.versions.filter(v => v.id !== element.dataset.removeVersion) }, 'Đã xóa phiên bản.');
  }
});

document.addEventListener('change', event => {
  if (event.target.id === 'teacher-filter') {
    teacher = event.target.value;
    render();
  }
});

document.addEventListener('input', event => {
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

document.addEventListener('submit', event => {
  event.preventDefault();
  const form = event.target;
  const data = new FormData(form);
  let next;
  try {
    if (form.id === 'cell-form') {
      next = putCell(state, {
        classId: form.dataset.class,
        timeSlotId: form.dataset.slot,
        subjectId: data.get('subjectId'),
        teacherId: data.get('teacherId') || '',
        note: String(data.get('note') || '').trim(),
        locked: data.has('locked')
      });
    } else if (form.id === 'entity-form') {
      const kind = form.dataset.kind;
      const id = form.dataset.id || uid();
      const code = String(data.get('code')).trim();
      const name = String(data.get('name')).trim();
      if (!code || !name) throw Error('Mã và tên không được để trống.');
      if (state[kind].some(item => item.id !== id && item.code.toLocaleLowerCase() === code.toLocaleLowerCase())) {
        throw Error('Mã đã tồn tại trong danh mục.');
      }
      const existing = state[kind].find(item => item.id === id) || {};
      const item = {
        ...existing,
        id,
        code,
        ...(kind === 'teachers' ? { fullName: name } : { name }),
        ...(kind === 'classes'
          ? {
              grade: Number(data.get('grade')),
              homeroomTeacherId: data.get('homeroomTeacherId'),
              coHomeroomTeacherId: data.get('coHomeroomTeacherId')
            }
          : {}),
        ...(kind === 'subjects' ? { color: data.get('color') } : {})
      };
      const list = form.dataset.id ? state[kind].map(old => (old.id === id ? item : old)) : [...state[kind], item];
      if (kind === 'classes') list.sort((a, b) => a.grade - b.grade || a.code.localeCompare(b.code, 'vi', { numeric: true }));
      next = { ...state, [kind]: list };
    } else if (form.id === 'school-form') {
      const school = Object.fromEntries([...data].map(([key, value]) => [key, String(value).trim()]));
      if (!school.name || !school.year || !school.term) throw Error('Vui lòng điền tên trường, năm học và học kỳ.');
      next = { ...state, school };
    } else return;

    if (commit(next)) dialog.close();
  } catch (error) {
    const output = form.querySelector('#form-error');
    if (output) output.textContent = error.message;
    else toast(error.message);
  }
});

window.addEventListener('storage', event => {
  if (event.key !== KEY) return;
  if (!event.newValue) {
    toast('Dữ liệu lưu ở tab khác đã bị xóa. Hãy sao lưu dữ liệu hiện tại.');
    return;
  }
  try {
    pendingExternal = parseBackup(event.newValue, SEED);
    render();
    toast('Có thay đổi ở tab khác. Hãy tải dữ liệu mới.');
  } catch {
    toast('Tab khác vừa ghi dữ liệu không hợp lệ. Bản đang dùng vẫn được giữ.');
  }
});

render();
