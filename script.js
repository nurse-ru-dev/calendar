const API_URL = 'https://script.google.com/macros/s/AKfycbwU9Y3-4Z0mfMOX6FYbzNXavd2B8Uh-6dLuxHz10DBmvjKCIvvZjFKX9-sAS7Scnif20A/exec';

const state = {
  apiUrl: API_URL,
  bookingsById: {},
  calendarBookings: [],
  calendarDate: new Date(),
  calendarView: 'month'
};

const $ = (id) => document.getElementById(id);

document.addEventListener('DOMContentLoaded', init);

function init() {
  $('loadCalendarBtn').addEventListener('click', loadCalendarBookings);
  $('calendarPrevBtn').addEventListener('click', () => moveCalendar(-1));
  $('calendarNextBtn').addEventListener('click', () => moveCalendar(1));
  $('calendarTodayBtn').addEventListener('click', () => {
    state.calendarDate = new Date();
    renderCalendar();
  });
  $('monthViewBtn').addEventListener('click', () => setCalendarView('month'));
  $('weekViewBtn').addEventListener('click', () => setCalendarView('week'));
  $('calendarRoomFilter').addEventListener('change', renderCalendar);
  $('closeDetailModalBtn').addEventListener('click', closeBookingDetail);
  $('bookingDetailModal').addEventListener('click', (event) => {
    if (event.target.id === 'bookingDetailModal') closeBookingDetail();
  });

  renderCalendar();
  loadCalendarBookings();
}

async function api(action, data = {}) {
  if (!state.apiUrl) throw new Error('ยังไม่ได้ตั้งค่า Apps Script Web App URL');

  const res = await fetch(state.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify({ action, token: '', data })
  });

  let json;
  try {
    json = await res.json();
  } catch (err) {
    throw new Error('อ่านผลลัพธ์จาก Apps Script ไม่ได้ กรุณาตรวจสอบ Web App URL และสิทธิ์ Deploy');
  }
  if (!json.ok) throw new Error(json.message || 'เกิดข้อผิดพลาด');
  return json;
}

async function loadCalendarBookings() {
  try {
    hideAlert();
    setBusy('loadCalendarBtn', true, 'กำลังโหลด...');
    const res = await api('listCalendarBookings');
    state.calendarBookings = res.bookings || [];
    state.bookingsById = {};
    state.calendarBookings.forEach((b) => {
      state.bookingsById[b.BOOKING_ID] = b;
    });
    renderRoomFilter();
    renderCalendar();
    toast('โหลดข้อมูลปฏิทินแล้ว');
  } catch (err) {
    showAlert(err.message);
    toast(err.message, true);
    renderCalendar();
  } finally {
    setBusy('loadCalendarBtn', false);
  }
}

function renderRoomFilter() {
  const current = $('calendarRoomFilter').value;
  const rooms = new Map();
  state.calendarBookings.forEach((b) => {
    const id = String(b.ROOM_ID || b.ROOM_NAME || '').trim();
    if (!id) return;
    rooms.set(id, b.ROOM_NAME || id);
  });

  $('calendarRoomFilter').innerHTML = '<option value="">ทุกห้อง</option>' + Array.from(rooms.entries())
    .sort((a, b) => String(a[1]).localeCompare(String(b[1]), 'th'))
    .map(([id, name]) => `<option value="${escapeAttr(id)}">${escapeHtml(name)}</option>`)
    .join('');

  if (rooms.has(current)) $('calendarRoomFilter').value = current;
}

function setCalendarView(view) {
  state.calendarView = view;
  $('monthViewBtn').classList.toggle('active', view === 'month');
  $('monthViewBtn').classList.toggle('ghost', view !== 'month');
  $('monthViewBtn').classList.toggle('secondary', view === 'month');
  $('weekViewBtn').classList.toggle('active', view === 'week');
  $('weekViewBtn').classList.toggle('ghost', view !== 'week');
  $('weekViewBtn').classList.toggle('secondary', view === 'week');
  renderCalendar();
}

function moveCalendar(direction) {
  const next = new Date(state.calendarDate);
  if (state.calendarView === 'month') {
    next.setMonth(next.getMonth() + direction);
  } else {
    next.setDate(next.getDate() + (direction * 7));
  }
  state.calendarDate = next;
  renderCalendar();
}

function renderCalendar() {
  if (state.calendarView === 'week') {
    renderWeekCalendar();
  } else {
    renderMonthCalendar();
  }
}

function renderMonthCalendar() {
  const viewDate = new Date(state.calendarDate);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const first = new Date(year, month, 1);
  const start = startOfWeek(first);
  const end = new Date(start);
  end.setDate(end.getDate() + 41);
  const bookings = getCalendarBookingsInRange(start, end);
  const today = todayYmd();

  $('calendarTitle').textContent = viewDate.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
  $('calendarEmpty').hidden = bookings.length > 0;

  const days = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
  let html = `<div class="calendar-month-grid calendar-weekdays">${days.map((d) => `<div>${d}</div>`).join('')}</div>`;
  html += '<div class="calendar-month-grid">';
  for (let i = 0; i < 42; i++) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    const ymd = ymdFromDate(day);
    const allDayBookings = bookings.filter((b) => ymdFromBooking(b) === ymd);
    const dayBookings = allDayBookings.slice(0, 4);
    const overflow = allDayBookings.length - dayBookings.length;
    html += `<div class="calendar-day ${day.getMonth() === month ? '' : 'muted-day'} ${ymd === today ? 'today' : ''}">
      <div class="calendar-day-number">${day.getDate()}</div>
      <div class="calendar-events">
        ${dayBookings.map(renderCalendarEvent).join('')}
        ${overflow > 0 ? `<div class="calendar-more">+${overflow} รายการ</div>` : ''}
      </div>
    </div>`;
  }
  html += '</div>';
  $('calendarShell').innerHTML = html;
}

function renderWeekCalendar() {
  const start = startOfWeek(state.calendarDate);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const bookings = getCalendarBookingsInRange(start, end);
  $('calendarTitle').textContent = `${formatDate(start)} - ${formatDate(end)}`;
  $('calendarEmpty').hidden = bookings.length > 0;

  const days = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    days.push(day);
  }

  $('calendarShell').innerHTML = `<div class="calendar-week-grid">
    ${days.map((day) => {
      const ymd = ymdFromDate(day);
      const dayBookings = bookings.filter((b) => ymdFromBooking(b) === ymd);
      return `<div class="calendar-week-day">
        <div class="calendar-week-heading">
          <strong>${day.toLocaleDateString('th-TH', { weekday: 'short' })}</strong>
          <span>${day.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</span>
        </div>
        <div class="calendar-week-events">
          ${dayBookings.length ? dayBookings.map(renderCalendarEvent).join('') : '<div class="calendar-no-event">ไม่มีรายการ</div>'}
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

function renderCalendarEvent(b) {
  const statusClass = calendarStatusClass(b.STATUS);
  const title = b.SUBJECT || b.PURPOSE_TYPE || 'จองห้อง';
  return `<button class="calendar-event ${statusClass}" type="button" onclick="openBookingDetail('${escapeAttr(b.BOOKING_ID)}')">
    <span>${escapeHtml(b.DISPLAY_TIME || timeRangeFromBooking(b))}</span>
    <strong>${escapeHtml(title)}</strong>
    <small>${escapeHtml(b.ROOM_NAME || '')}</small>
  </button>`;
}

function getCalendarBookingsInRange(start, end) {
  const roomId = $('calendarRoomFilter').value;
  const startTime = start.getTime();
  const endLimit = new Date(end);
  endLimit.setHours(23, 59, 59, 999);
  const endTime = endLimit.getTime();
  return state.calendarBookings
    .filter((b) => !roomId || b.ROOM_ID === roomId || (!b.ROOM_ID && b.ROOM_NAME === roomId))
    .filter((b) => ['PENDING_APPROVAL', 'APPROVED', 'BOOKED'].includes(String(b.STATUS || '').toUpperCase()))
    .filter((b) => {
      const d = parseBookingDate(b);
      return d && d.getTime() >= startTime && d.getTime() <= endTime;
    })
    .sort((a, b) => (parseBookingDate(a)?.getTime() || 0) - (parseBookingDate(b)?.getTime() || 0));
}

function openBookingDetail(bookingId) {
  const b = state.bookingsById[bookingId];
  if (!b) {
    toast('ไม่พบรายละเอียดรายการนี้', true);
    return;
  }

  $('bookingDetailSubtitle').textContent = `${b.BOOKING_ID || '-'} · ${statusText(b.STATUS)}`;
  const rows = [
    ['รหัสการจอง', b.BOOKING_ID],
    ['สถานะ', statusText(b.STATUS)],
    ['ห้อง', b.ROOM_NAME],
    ['วันที่/เวลา', formatBookingDateTime(b)],
    ['ประเภทวัตถุประสงค์', b.PURPOSE_TYPE],
    ['หัวข้อ/รายวิชา', b.SUBJECT],
    ['รายละเอียดเพิ่มเติม', b.PURPOSE_DETAIL],
    ['จำนวนผู้เข้าร่วม', b.ATTENDEES ? `${b.ATTENDEES} คน` : ''],
    ['ผู้จอง', b.BOOKER_NAME],
    ['ประเภทผู้จอง', b.BOOKER_ROLE || b.BOOKER_TYPE],
    ['แผนก/สาขา', b.DEPARTMENT],
    ['ชั้นปี', b.YEAR_LEVEL],
    ['อาจารย์ผู้อนุมัติ', b.APPROVER_NAME],
    ['เวลาที่อนุมัติ', formatDateTimeText(b.APPROVED_AT)]
  ];

  $('bookingDetailContent').innerHTML = rows
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')
    .map(([label, value]) => `<div class="detail-item"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`)
    .join('');
  $('bookingDetailModal').hidden = false;
}

function closeBookingDetail() {
  $('bookingDetailModal').hidden = true;
}

function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function parseBookingDate(booking) {
  return parseDateTime(booking.START_DATETIME) || parseDateOnly(booking.BOOKING_DATE);
}

function parseDateOnly(value) {
  const text = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const [y, m, d] = text.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function parseDateTime(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function ymdFromBooking(booking) {
  const d = parseBookingDate(booking);
  return d ? ymdFromDate(d) : String(booking.BOOKING_DATE || '').slice(0, 10);
}

function ymdFromDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function todayYmd() {
  return ymdFromDate(new Date());
}

function calendarStatusClass(status) {
  const s = String(status || '').toUpperCase();
  if (s === 'PENDING_APPROVAL') return 'pending';
  if (s === 'APPROVED' || s === 'BOOKED') return 'approved';
  return 'other';
}

function statusText(status) {
  const map = {
    PENDING_APPROVAL: 'รออนุมัติ',
    APPROVED: 'อนุมัติแล้ว',
    BOOKED: 'จองแล้ว',
    REJECTED: 'ไม่อนุมัติ',
    CANCELLED: 'ยกเลิก'
  };
  return map[status] || status || '-';
}

function timeRangeFromBooking(booking) {
  const start = parseDateTime(booking.START_DATETIME);
  const end = parseDateTime(booking.END_DATETIME);
  if (start && end) return `${formatTimeForDisplay(start)}-${formatTimeForDisplay(end)}`;
  return `${shortTime(booking.START_TIME)}-${shortTime(booking.END_TIME)}`;
}

function formatBookingDateTime(booking) {
  if (booking.DISPLAY_DATE || booking.DISPLAY_TIME) {
    return `${booking.DISPLAY_DATE || formatDate(booking.BOOKING_DATE)} ${booking.DISPLAY_TIME || ''}`.trim();
  }

  const start = parseDateTime(booking.START_DATETIME);
  const end = parseDateTime(booking.END_DATETIME);
  if (start && end) {
    return `${formatDate(start)} ${formatTimeForDisplay(start)}-${formatTimeForDisplay(end)}`;
  }

  return `${formatDate(booking.BOOKING_DATE)} ${shortTime(booking.START_TIME)}-${shortTime(booking.END_TIME)}`;
}

function formatDate(value) {
  if (!value) return '';
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return text;
  return d.toLocaleDateString('th-TH');
}

function formatDateTimeText(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return `${formatDate(d)} ${formatTimeForDisplay(d)}`;
}

function formatTimeForDisplay(value) {
  return new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(value).replace(':', '.');
}

function shortTime(value) {
  if (!value) return '';
  const text = String(value);
  const match = text.match(/(\d{1,2}:\d{2})/);
  return match ? match[1].replace(':', '.') : text;
}

function setBusy(id, busy, busyText) {
  const btn = $(id);
  if (!btn) return;
  btn.disabled = busy;
  btn.dataset.originalText = btn.dataset.originalText || btn.textContent;
  btn.textContent = busy ? (busyText || 'กำลังโหลด...') : btn.dataset.originalText;
}

function showAlert(message) {
  $('calendarAlert').textContent = message;
  $('calendarAlert').hidden = false;
}

function hideAlert() {
  $('calendarAlert').hidden = true;
  $('calendarAlert').textContent = '';
}

function toast(message, isError = false) {
  const el = $('toast');
  el.textContent = message;
  el.classList.toggle('error', isError);
  el.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => {
    el.hidden = true;
  }, 3200);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#096;');
}
