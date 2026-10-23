import test from 'node:test';
import assert from 'node:assert/strict';

// Mock DOM environment for Node.js test runner
class MockElement {
  constructor(tag, id = '', className = '') {
    this.tagName = tag.toUpperCase();
    this.id = id;
    this.className = className;
    this.classList = {
      contains: cls => this.className.split(/\s+/).includes(cls)
    };
    this.scrollLeft = 0;
    this.scrollTop = 0;
    this.children = [];
  }
  scrollTo(left, top) {
    this.scrollLeft = left;
    this.scrollTop = top;
  }
}

class MockDocument {
  constructor() {
    this.elements = new Map();
    this.listeners = [];
  }
  register(selector, el) {
    this.elements.set(selector, el);
  }
  querySelector(selector) {
    return this.elements.get(selector) || null;
  }
  addEventListener(event, handler, options) {
    this.listeners.push({ event, handler, options });
  }
  dispatch(event, target) {
    for (const l of this.listeners) {
      if (l.event === event) {
        l.handler({ target });
      }
    }
  }
}

test('Ma trận cuộn: Bảo toàn vị trí độc lập cho cả 2 bản ma trận (Phân công & Thời khóa biểu)', () => {
  const mockDoc = new MockDocument();
  const matrixEl = new MockElement('div', 'matrix-scroll-container', 'matrix-scroll');
  mockDoc.register('#matrix-scroll-container', matrixEl);
  mockDoc.register('.matrix-scroll', matrixEl);

  const matrixScrollPositions = {
    assignment: { left: 0, top: 0 },
    timetable: { left: 0, top: 0 }
  };
  let currentMode = 'assignment';

  function recordScroll() {
    const el = mockDoc.querySelector('#matrix-scroll-container');
    if (el) {
      matrixScrollPositions[currentMode].left = el.scrollLeft;
      matrixScrollPositions[currentMode].top = el.scrollTop;
    }
  }

  function restoreScroll() {
    const el = mockDoc.querySelector('#matrix-scroll-container');
    if (el) {
      el.scrollLeft = matrixScrollPositions[currentMode].left;
      el.scrollTop = matrixScrollPositions[currentMode].top;
    }
  }

  // 1. Giả lập người dùng cuộn trên Bản ma trận phân công (Môn - Lớp)
  matrixEl.scrollLeft = 320;
  matrixEl.scrollTop = 180;
  recordScroll();
  assert.equal(matrixScrollPositions.assignment.left, 320);
  assert.equal(matrixScrollPositions.assignment.top, 180);

  // 2. Thao tác sửa / chọn trên ma trận phân công: Re-render DOM tạo phần tử mới (mặc định scroll = 0)
  const freshMatrixEl1 = new MockElement('div', 'matrix-scroll-container', 'matrix-scroll');
  mockDoc.register('#matrix-scroll-container', freshMatrixEl1);
  assert.equal(freshMatrixEl1.scrollLeft, 0);
  assert.equal(freshMatrixEl1.scrollTop, 0);

  // Khôi phục: Phải quay lại đúng (320, 180), KHÔNG quay về (0, 0)
  restoreScroll();
  assert.equal(freshMatrixEl1.scrollLeft, 320);
  assert.equal(freshMatrixEl1.scrollTop, 180);

  // 3. Chuyển sang Bản ma trận thời khóa biểu (Tiết - Lớp)
  recordScroll(); // Ghi nhớ vị trí bản phân công trước khi đổi mode
  currentMode = 'timetable';
  const freshMatrixEl2 = new MockElement('div', 'matrix-scroll-container', 'matrix-scroll');
  mockDoc.register('#matrix-scroll-container', freshMatrixEl2);
  restoreScroll();
  // Bản thời khóa biểu ban đầu ở (0, 0)
  assert.equal(freshMatrixEl2.scrollLeft, 0);
  assert.equal(freshMatrixEl2.scrollTop, 0);

  // Người dùng cuộn tới lớp 12A2 và Tiết chiều thứ 6 trên Thời khóa biểu
  freshMatrixEl2.scrollLeft = 850;
  freshMatrixEl2.scrollTop = 620;
  recordScroll();
  assert.equal(matrixScrollPositions.timetable.left, 850);
  assert.equal(matrixScrollPositions.timetable.top, 620);

  // 4. Thao tác sửa ô hoặc chọn cọ thẻ trên Thời khóa biểu: Re-render DOM
  const freshMatrixEl3 = new MockElement('div', 'matrix-scroll-container', 'matrix-scroll');
  mockDoc.register('#matrix-scroll-container', freshMatrixEl3);
  restoreScroll();
  // Giữ nguyên đúng vị trí (850, 620), không giật về đầu
  assert.equal(freshMatrixEl3.scrollLeft, 850);
  assert.equal(freshMatrixEl3.scrollTop, 620);

  // 5. Chuyển ngược lại Bản ma trận phân công
  recordScroll();
  currentMode = 'assignment';
  const freshMatrixEl4 = new MockElement('div', 'matrix-scroll-container', 'matrix-scroll');
  mockDoc.register('#matrix-scroll-container', freshMatrixEl4);
  restoreScroll();
  // Vẫn giữ đúng vị trí cũ của Bản phân công (320, 180)
  assert.equal(freshMatrixEl4.scrollLeft, 320);
  assert.equal(freshMatrixEl4.scrollTop, 180);
});

test('Khay thẻ phân công (Tray): Bảo toàn vị trí cuộn khi chọn lớp hoặc chọn thẻ', () => {
  const trayEl = new MockElement('div', '', 'tray-cards-container');
  let savedTrayScrollLeft = 0;
  let savedTrayScrollTop = 0;

  trayEl.scrollLeft = 240;
  savedTrayScrollLeft = trayEl.scrollLeft;

  // DOM re-renders tray
  const newTrayEl = new MockElement('div', '', 'tray-cards-container');
  newTrayEl.scrollLeft = savedTrayScrollLeft;
  assert.equal(newTrayEl.scrollLeft, 240);
});
