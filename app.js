import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  getFirestore, collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp, writeBatch
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCJ8kM1wq_CLa9lQ1bz3FmhipqRD4fTIYE",
  authDomain: "maggie115-contact-book.firebaseapp.com",
  projectId: "maggie115-contact-book",
  storageBucket: "maggie115-contact-book.firebasestorage.app",
  messagingSenderId: "491473953898",
  appId: "1:491473953898:web:eb1d97a1d1c5f269c21613"
};

const ADMIN_UID = "S65ZN3z3fLQmlWlXUykRBo6V9O53";
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const DEFAULT_DAYS = [
  { name: "星期一", note: "制服" },
  { name: "星期二", note: "體育服" },
  { name: "星期三", note: "便服" },
  { name: "星期四", note: "體育服" },
  { name: "星期五", note: "制服" },
  { name: "星期六", note: "" },
  { name: "星期日", note: "" }
];

const DEFAULT_PERIODS = [
  { label: "第 1 節", time: "08:35～09:15" },
  { label: "第 2 節", time: "09:25～10:05" },
  { label: "第 3 節", time: "10:20～11:00" },
  { label: "第 4 節", time: "11:10～11:50" },
  { label: "第 5 節", time: "13:20～14:00" },
  { label: "第 6 節", time: "14:10～14:50" },
  { label: "第 7 節", time: "15:00～15:40" }
];

const DEFAULT_CELLS = [
  [
    { subject: "本土語文／新住民語文", teacher: "吳美娥" }, { subject: "國語文", teacher: "王慧中" },
    { subject: "生活課程（音樂）", teacher: "李怡嫺" }, { subject: "國語文", teacher: "王慧中" }, { subject: "國語文", teacher: "王慧中" }
  ],
  [
    { subject: "國語文", teacher: "王慧中" }, { subject: "數學", teacher: "王慧中" },
    { subject: "國語文", teacher: "王慧中" }, { subject: "數學", teacher: "王慧中" }, { subject: "數學", teacher: "王慧中" }
  ],
  [
    { subject: "國語文", teacher: "王慧中" }, { subject: "健康與體育（體育）", teacher: "張紹睿" },
    { subject: "數學", teacher: "王慧中" }, { subject: "健康與體育（體育）", teacher: "張紹睿" },
    { subject: "彈性學習－國際新視野", teacher: "魏文怡" }
  ],
  [
    { subject: "生活課程", teacher: "王慧中" }, { subject: "健康與體育（健康）", teacher: "王慧中" },
    { subject: "生活課程", teacher: "王慧中" }, { subject: "清小風情暨閱讀饗宴", teacher: "" }, { subject: "生活課程", teacher: "王慧中" }
  ],
  [{ subject: "", teacher: "" }, { subject: "", teacher: "" }, { subject: "", teacher: "" }, { subject: "彈性學習－校本課程", teacher: "王慧中" }, { subject: "", teacher: "" }],
  [{ subject: "", teacher: "" }, { subject: "", teacher: "" }, { subject: "", teacher: "" }, { subject: "生活課程（美勞）", teacher: "王慧中" }, { subject: "", teacher: "" }],
  [{ subject: "", teacher: "" }, { subject: "", teacher: "" }, { subject: "", teacher: "" }, { subject: "生活課程（美勞）", teacher: "王慧中" }, { subject: "", teacher: "" }]
];

function defaultTimetable() {
  return {
    title: "一年戊班課表",
    subtitle: "115學年度 第1學期｜臺中市清水區清水國民小學",
    theme: "candy",
    dayCount: 5,
    days: DEFAULT_DAYS.slice(0, 5).map(day => ({ ...day })),
    periods: DEFAULT_PERIODS.map(period => ({ ...period })),
    cells: DEFAULT_CELLS.map(row => row.map(cell => ({ ...cell }))),
    lunchAfter: 4,
    lunchLabel: "午休"
  };
}

const EVENT_CATEGORIES = {
  exam: { label: "評量", icon: "📝" },
  school: { label: "學校活動", icon: "🏫" },
  class: { label: "班級活動", icon: "🎈" },
  holiday: { label: "放假／停課", icon: "🏖️" },
  item: { label: "攜帶物品", icon: "🎒" },
  other: { label: "其他", icon: "📌" }
};

const state = {
  user: null,
  entries: [],
  drafts: [],
  links: [],
  tags: [],
  templates: [],
  events: [],
  timetable: defaultTimetable(),
  timetableDraft: null,
  settings: { title: "台中市清水國小 一年戊班 電子聯絡簿", subtitle: "115 學年度" },
  selectedDate: todayKey(),
  calendarDate: new Date(),
  eventsCalendarDate: new Date(),
  eventsView: "month",
  entryFilter: "all"
};

const TIMETABLE_VIEW_DEFAULTS = { density: "compact", zoom: 90 };
const timetableView = (() => {
  try {
    const saved = JSON.parse(localStorage.getItem("timetableView") || "{}");
    return {
      density: ["comfortable", "compact", "ultra"].includes(saved.density) ? saved.density : TIMETABLE_VIEW_DEFAULTS.density,
      zoom: Math.min(120, Math.max(50, Number(saved.zoom) || TIMETABLE_VIEW_DEFAULTS.zoom))
    };
  } catch { return { ...TIMETABLE_VIEW_DEFAULTS }; }
})();

const EVENTS_VIEW_DEFAULTS = { monthZoom: 85, listZoom: 100 };
const eventsViewSettings = (() => {
  try {
    const saved = JSON.parse(localStorage.getItem("eventsViewSettings") || "{}");
    return {
      monthZoom: Math.min(120, Math.max(50, Number(saved.monthZoom) || EVENTS_VIEW_DEFAULTS.monthZoom)),
      listZoom: Math.min(120, Math.max(50, Number(saved.listZoom) || EVENTS_VIEW_DEFAULTS.listZoom))
    };
  } catch { return { ...EVENTS_VIEW_DEFAULTS }; }
})();

let unsubscribeDrafts = null;

const $ = (selector) => document.querySelector(selector);
const isAdmin = () => state.user?.uid === ADMIN_UID;

function todayKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dateFromKey(key) {
  const [year, month, day] = String(key).split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function dateKeyFromDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDaysKey(key, amount) {
  const date = dateFromKey(key);
  date.setDate(date.getDate() + amount);
  return dateKeyFromDate(date);
}

function daysBetween(startKey, endKey) {
  return Math.round((dateFromKey(endKey) - dateFromKey(startKey)) / 86400000);
}

function monthlyOccurrenceKey(anchorKey, offset) {
  const anchor = dateFromKey(anchorKey);
  const first = new Date(anchor.getFullYear(), anchor.getMonth() + offset, 1, 12);
  const lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0, 12).getDate();
  if (anchor.getDate() > lastDay) return "";
  return dateKeyFromDate(new Date(first.getFullYear(), first.getMonth(), anchor.getDate(), 12));
}

function eventOccurrences(event, rangeStart, rangeEnd) {
  if (!event.startDate) return [];
  const startDate = event.startDate;
  const duration = Math.max(0, daysBetween(startDate, event.endDate || startDate));
  const repeat = ["weekly", "monthly"].includes(event.repeat) ? event.repeat : "none";
  const repeatUntil = repeat === "none" ? startDate : (event.repeatUntil || startDate);
  const occurrences = [];
  for (let index = 0; index < 600; index += 1) {
    const current = repeat === "weekly" ? addDaysKey(startDate, index * 7)
      : repeat === "monthly" ? monthlyOccurrenceKey(startDate, index)
        : startDate;
    if (!current) continue;
    if (current > repeatUntil || current > rangeEnd) break;
    const occurrenceEnd = addDaysKey(current, duration);
    if (occurrenceEnd >= rangeStart) occurrences.push({ event, occurrenceStart: current, occurrenceEnd });
    if (repeat === "none") break;
  }
  return occurrences;
}

function occurrencesInRange(rangeStart, rangeEnd, events = state.events) {
  return events.flatMap(event => eventOccurrences(event, rangeStart, rangeEnd))
    .sort((a, b) => `${a.occurrenceStart}${a.event.startTime || ""}${a.event.title || ""}`
      .localeCompare(`${b.occurrenceStart}${b.event.startTime || ""}${b.event.title || ""}`));
}

function eventDateLabel(occurrence) {
  const { event, occurrenceStart, occurrenceEnd } = occurrence;
  const dateLabel = occurrenceStart === occurrenceEnd ? formatDate(occurrenceStart) : `${formatDate(occurrenceStart)} ～ ${formatDate(occurrenceEnd)}`;
  if (event.allDay !== false) return `${dateLabel}・全天`;
  return `${dateLabel}・${event.startTime || ""}${event.endTime ? `～${event.endTime}` : ""}`;
}

function showToast(message, error = false) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.className = `toast show${error ? " error" : ""}`;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { toast.className = "toast"; }, 2800);
}

function formatDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const weekday = ["日", "一", "二", "三", "四", "五", "六"][date.getDay()];
  return `民國 ${year - 1911} 年 ${month} 月 ${day} 日（${weekday}）`;
}

function nowLocalKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${h}:${min}`;
}

function formatDateTime(value) {
  if (!value) return "";
  const [date, time] = value.split("T");
  const [year, month, day] = date.split("-").map(Number);
  return `${year}/${month}/${day} ${time || ""}`.trim();
}

function isEntryVisibleNow(entry) {
  const now = nowLocalKey();
  return (!entry.publishStart || entry.publishStart <= now)
    && (!entry.publishEnd || entry.publishEnd >= now);
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : "#";
  } catch { return "#"; }
}

function appendLinkedContent(container, value = "") {
  const pattern = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<]+)/gi;
  let cursor = 0;

  for (const match of value.matchAll(pattern)) {
    container.append(document.createTextNode(value.slice(cursor, match.index)));
    const markdownLabel = match[1];
    let url = match[2] || match[3];
    let trailing = "";

    if (!markdownLabel) {
      const trailingCharacters = ".,!?;:，。！？；：)]}";
      while (url && trailingCharacters.includes(url.at(-1))) {
        trailing = url.at(-1) + trailing;
        url = url.slice(0, -1);
      }
    }

    const href = safeUrl(url);
    if (href === "#") {
      container.append(document.createTextNode(match[0]));
    } else {
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.textContent = markdownLabel || url;
      container.append(anchor);
      if (trailing) container.append(document.createTextNode(trailing));
    }
    cursor = match.index + match[0].length;
  }

  container.append(document.createTextNode(value.slice(cursor)));
}

function openDialog(id) {
  const dialog = document.getElementById(id);
  if (dialog && !dialog.open) dialog.showModal();
}

function closeDialog(dialog) {
  if (dialog?.open) dialog.close();
}

function saveTimetableView() {
  try { localStorage.setItem("timetableView", JSON.stringify(timetableView)); } catch { /* 瀏覽器拒絕儲存時仍可使用 */ }
}

function applyTimetableViewSettings() {
  const shell = $("#timetable-shell");
  if (!shell) return;
  shell.classList.remove("density-comfortable", "density-compact", "density-ultra");
  shell.classList.add(`density-${timetableView.density}`);
  shell.style.setProperty("--tt-zoom", String(timetableView.zoom / 100));
  $("#timetable-zoom-value").textContent = `${Math.round(timetableView.zoom)}%`;
  document.querySelectorAll("[data-density]").forEach(button => {
    const active = button.dataset.density === timetableView.density;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  $("#timetable-zoom-out").disabled = timetableView.zoom <= 50;
  $("#timetable-zoom-in").disabled = timetableView.zoom >= 120;
}

function setTimetableZoom(value, persist = true) {
  timetableView.zoom = Math.min(120, Math.max(50, Math.round(Number(value) / 5) * 5));
  applyTimetableViewSettings();
  if (persist) saveTimetableView();
}

function fitTimetableWidth() {
  const container = $("#timetable-container");
  const table = container?.querySelector(".timetable-table");
  if (!container || !table) return;
  const shell = $("#timetable-shell");
  shell.style.setProperty("--tt-zoom", "1");
  void table.offsetWidth;
  const fitted = Math.floor(((container.clientWidth - 8) / table.scrollWidth) * 100 / 5) * 5;
  setTimetableZoom(fitted);
  container.scrollLeft = 0;
}

function timetableIsFullscreen() {
  const shell = $("#timetable-shell");
  return document.fullscreenElement === shell || document.webkitFullscreenElement === shell || shell.classList.contains("pseudo-fullscreen");
}

function updateFullscreenButton() {
  $("#timetable-fullscreen").textContent = timetableIsFullscreen() ? "離開全螢幕" : "全螢幕";
}

async function toggleTimetableFullscreen() {
  const shell = $("#timetable-shell");
  if (timetableIsFullscreen()) {
    if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen();
    else if (document.webkitFullscreenElement && document.webkitExitFullscreen) document.webkitExitFullscreen();
    else {
      shell.classList.remove("pseudo-fullscreen");
      document.body.classList.remove("no-scroll");
    }
  } else {
    try {
      if (shell.requestFullscreen) await shell.requestFullscreen();
      else if (shell.webkitRequestFullscreen) shell.webkitRequestFullscreen();
      else throw new Error("fullscreen unsupported");
    } catch {
      shell.classList.add("pseudo-fullscreen");
      document.body.classList.add("no-scroll");
    }
  }
  updateFullscreenButton();
}

function activeEventsZoomKey() {
  return state.eventsView === "list" ? "listZoom" : "monthZoom";
}

function saveEventsViewSettings() {
  try { localStorage.setItem("eventsViewSettings", JSON.stringify(eventsViewSettings)); } catch { /* 瀏覽器拒絕儲存時仍可使用 */ }
}

function applyEventsViewSettings() {
  const shell = $("#events-shell");
  if (!shell) return;
  const zoom = eventsViewSettings[activeEventsZoomKey()];
  shell.style.setProperty("--events-zoom", String(zoom / 100));
  $("#events-zoom-label").textContent = state.eventsView === "list" ? "列表縮放" : "月曆縮放";
  $("#events-zoom-value").textContent = `${Math.round(zoom)}%`;
  $("#events-zoom-out").disabled = zoom <= 50;
  $("#events-zoom-in").disabled = zoom >= 120;
}

function setEventsZoom(value, persist = true) {
  const key = activeEventsZoomKey();
  eventsViewSettings[key] = Math.min(120, Math.max(50, Math.round(Number(value) / 5) * 5));
  applyEventsViewSettings();
  if (persist) saveEventsViewSettings();
}

function fitEventsWidth() {
  const viewport = state.eventsView === "list" ? $("#events-list-view") : $("#events-calendar-view");
  const content = state.eventsView === "list" ? viewport : $("#events-calendar-grid");
  if (!viewport || !content) return;
  $("#events-shell").style.setProperty("--events-zoom", "1");
  void content.offsetWidth;
  const available = Math.max(1, viewport.clientWidth - 8);
  const naturalWidth = Math.max(1, content.scrollWidth);
  setEventsZoom(Math.floor((available / naturalWidth) * 100 / 5) * 5);
  viewport.scrollLeft = 0;
}

function eventsIsFullscreen() {
  const shell = $("#events-shell");
  return document.fullscreenElement === shell || document.webkitFullscreenElement === shell || shell.classList.contains("pseudo-fullscreen");
}

function updateEventsFullscreenButton() {
  $("#events-fullscreen").textContent = eventsIsFullscreen() ? "離開全螢幕" : "全螢幕";
}

async function toggleEventsFullscreen() {
  const shell = $("#events-shell");
  if (eventsIsFullscreen()) {
    if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen();
    else if (document.webkitFullscreenElement && document.webkitExitFullscreen) document.webkitExitFullscreen();
    else {
      shell.classList.remove("pseudo-fullscreen");
      document.body.classList.remove("no-scroll");
    }
  } else {
    try {
      if (shell.requestFullscreen) await shell.requestFullscreen();
      else if (shell.webkitRequestFullscreen) shell.webkitRequestFullscreen();
      else throw new Error("fullscreen unsupported");
    } catch {
      shell.classList.add("pseudo-fullscreen");
      document.body.classList.add("no-scroll");
    }
  }
  updateEventsFullscreenButton();
}

function cloneTimetable(source = state.timetable) {
  return {
    title: source.title || "一年戊班課表",
    subtitle: source.subtitle || "",
    theme: ["candy", "forest", "ocean", "space", "sunny"].includes(source.theme) ? source.theme : "candy",
    dayCount: Math.min(7, Math.max(5, Number(source.dayCount) || 5)),
    days: (source.days || []).map(day => ({ name: day.name || "", note: day.note || "" })),
    periods: (source.periods || []).map(period => ({ label: period.label || "", time: period.time || "" })),
    cells: (source.cells || []).map(row => row.map(cell => ({ subject: cell?.subject || "", teacher: cell?.teacher || "" }))),
    lunchAfter: Math.max(0, Number(source.lunchAfter) || 0),
    lunchLabel: source.lunchLabel || "午休"
  };
}

function normalizeTimetable(source = {}) {
  const base = defaultTimetable();
  const timetable = cloneTimetable({ ...base, ...source });
  while (timetable.days.length < timetable.dayCount) {
    timetable.days.push({ ...DEFAULT_DAYS[timetable.days.length] });
  }
  timetable.days = timetable.days.slice(0, timetable.dayCount);
  if (!timetable.periods.length) timetable.periods = DEFAULT_PERIODS.map(period => ({ ...period }));
  timetable.cells = timetable.periods.map((_, rowIndex) =>
    timetable.days.map((__, dayIndex) => ({
      subject: timetable.cells[rowIndex]?.[dayIndex]?.subject || "",
      teacher: timetable.cells[rowIndex]?.[dayIndex]?.teacher || ""
    }))
  );
  if (timetable.lunchAfter > timetable.periods.length) timetable.lunchAfter = 0;
  return timetable;
}

function courseIcon(subject = "") {
  if (/數學/.test(subject)) return "🧮";
  if (/國語|語文/.test(subject)) return "📕";
  if (/體育|健康/.test(subject)) return "⚽";
  if (/音樂/.test(subject)) return "🎵";
  if (/美勞|藝術/.test(subject)) return "🎨";
  if (/閱讀/.test(subject)) return "📖";
  if (/生活/.test(subject)) return "🌱";
  if (/國際|英文/.test(subject)) return "🌏";
  return subject ? "✏️" : "";
}

function renderTimetable() {
  const timetable = normalizeTimetable(state.timetable);
  const shell = $("#timetable-shell");
  const keepPseudoFullscreen = shell.classList.contains("pseudo-fullscreen");
  shell.className = `timetable-shell theme-${timetable.theme}${keepPseudoFullscreen ? " pseudo-fullscreen" : ""}`;
  $("#timetable-title").textContent = timetable.title;
  $("#timetable-subtitle").textContent = timetable.subtitle;
  $(".timetable-decoration").textContent = ({
    candy: "✏️　📚　⭐　🎨", forest: "🌿　🦊　🍄　🐿️", ocean: "🐳　🐚　🌊　🐠",
    space: "🚀　⭐　🪐　🌙", sunny: "🌞　🌈　☁️　🌻"
  })[timetable.theme];
  $("#public-edit-timetable").classList.toggle("hidden", !isAdmin());

  const container = $("#timetable-container");
  const table = document.createElement("table");
  table.className = "timetable-table";
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  const periodHead = document.createElement("th");
  periodHead.scope = "col";
  periodHead.textContent = "節次";
  const timeHead = document.createElement("th");
  timeHead.scope = "col";
  timeHead.textContent = "時間";
  headRow.append(periodHead, timeHead);
  timetable.days.forEach(day => {
    const th = document.createElement("th");
    th.scope = "col";
    const name = document.createElement("strong");
    name.textContent = day.name;
    th.append(name);
    if (day.note) {
      const note = document.createElement("small");
      note.textContent = `（${day.note}）`;
      th.append(note);
    }
    headRow.append(th);
  });
  thead.append(headRow);
  table.append(thead);

  const tbody = document.createElement("tbody");
  timetable.periods.forEach((period, rowIndex) => {
    if (timetable.lunchAfter === rowIndex) {
      const lunchRow = document.createElement("tr");
      lunchRow.className = "lunch-row";
      const lunch = document.createElement("td");
      lunch.colSpan = timetable.dayCount + 2;
      lunch.textContent = timetable.lunchLabel;
      lunchRow.append(lunch);
      tbody.append(lunchRow);
    }
    const tr = document.createElement("tr");
    const label = document.createElement("th");
    label.scope = "row";
    label.textContent = period.label;
    const time = document.createElement("td");
    time.className = "period-time";
    time.textContent = period.time;
    tr.append(label, time);
    timetable.days.forEach((_, dayIndex) => {
      const cellData = timetable.cells[rowIndex]?.[dayIndex] || {};
      const td = document.createElement("td");
      if (!cellData.subject && !cellData.teacher) td.classList.add("empty-course");
      const subject = document.createElement("strong");
      if (cellData.subject) {
        const icon = document.createElement("span");
        icon.className = "course-icon";
        icon.setAttribute("aria-hidden", "true");
        icon.textContent = courseIcon(cellData.subject);
        subject.append(icon, document.createTextNode(cellData.subject));
      }
      td.append(subject);
      if (cellData.teacher) {
        const teacher = document.createElement("small");
        teacher.textContent = cellData.teacher;
        td.append(teacher);
      }
      tr.append(td);
    });
    tbody.append(tr);
  });
  table.append(tbody);
  container.replaceChildren(table);
  applyTimetableViewSettings();

  const updated = state.timetable.updatedAt?.toDate?.();
  $("#timetable-updated").textContent = updated
    ? `最後更新：${updated.toLocaleString("zh-TW", { hour12: false })}`
    : "";
}

function syncLunchOptions() {
  const select = $("#timetable-lunch-after");
  const selected = Number(state.timetableDraft?.lunchAfter) || 0;
  select.replaceChildren();
  const none = document.createElement("option");
  none.value = "0";
  none.textContent = "不顯示午休列";
  select.append(none);
  state.timetableDraft.periods.forEach((period, index) => {
    const option = document.createElement("option");
    option.value = String(index + 1);
    option.textContent = `第 ${index + 1} 列之後（${period.label || `第 ${index + 1} 節`}）`;
    select.append(option);
  });
  select.value = String(Math.min(selected, state.timetableDraft.periods.length));
}

function renderTimetableEditor() {
  const timetable = normalizeTimetable(state.timetableDraft || state.timetable);
  state.timetableDraft = timetable;
  $("#timetable-edit-title").value = timetable.title;
  $("#timetable-edit-subtitle").value = timetable.subtitle;
  $("#timetable-day-count").value = String(timetable.dayCount);
  $("#timetable-theme").value = timetable.theme;
  $("#timetable-lunch-label").value = timetable.lunchLabel;

  const dayEditor = $("#timetable-day-editor");
  dayEditor.replaceChildren();
  timetable.days.forEach((day, index) => {
    const card = document.createElement("div");
    card.className = "day-editor-card";
    const name = document.createElement("input");
    name.type = "text";
    name.value = day.name;
    name.placeholder = `第 ${index + 1} 天名稱`;
    name.dataset.dayName = String(index);
    const note = document.createElement("input");
    note.type = "text";
    note.value = day.note;
    note.placeholder = "服裝／提醒（可留空）";
    note.dataset.dayNote = String(index);
    card.append(name, note);
    dayEditor.append(card);
  });

  const wrapper = $("#timetable-editor");
  const table = document.createElement("table");
  table.className = "timetable-edit-table";
  const thead = document.createElement("thead");
  const trHead = document.createElement("tr");
  ["節次", "時間", ...timetable.days.map(day => day.name)].forEach(labelText => {
    const th = document.createElement("th");
    th.textContent = labelText;
    trHead.append(th);
  });
  thead.append(trHead);
  table.append(thead);
  const tbody = document.createElement("tbody");
  timetable.periods.forEach((period, rowIndex) => {
    const tr = document.createElement("tr");
    const labelCell = document.createElement("td");
    const labelInput = document.createElement("input");
    labelInput.type = "text";
    labelInput.value = period.label;
    labelInput.dataset.periodLabel = String(rowIndex);
    labelCell.append(labelInput);
    const timeCell = document.createElement("td");
    const timeInput = document.createElement("input");
    timeInput.type = "text";
    timeInput.value = period.time;
    timeInput.placeholder = "08:35～09:15";
    timeInput.dataset.periodTime = String(rowIndex);
    timeCell.append(timeInput);
    tr.append(labelCell, timeCell);
    timetable.days.forEach((_, dayIndex) => {
      const td = document.createElement("td");
      const subject = document.createElement("textarea");
      subject.rows = 2;
      subject.value = timetable.cells[rowIndex]?.[dayIndex]?.subject || "";
      subject.placeholder = "課程";
      subject.dataset.cellSubject = `${rowIndex}:${dayIndex}`;
      const teacher = document.createElement("input");
      teacher.type = "text";
      teacher.value = timetable.cells[rowIndex]?.[dayIndex]?.teacher || "";
      teacher.placeholder = "教師（可留空）";
      teacher.dataset.cellTeacher = `${rowIndex}:${dayIndex}`;
      td.append(subject, teacher);
      tr.append(td);
    });
    tbody.append(tr);
  });
  table.append(tbody);
  wrapper.replaceChildren(table);
  syncLunchOptions();
}

function collectTimetableEditor() {
  const timetable = normalizeTimetable(state.timetableDraft || state.timetable);
  timetable.title = $("#timetable-edit-title").value.trim();
  timetable.subtitle = $("#timetable-edit-subtitle").value.trim();
  timetable.theme = $("#timetable-theme").value;
  timetable.lunchAfter = Number($("#timetable-lunch-after").value) || 0;
  timetable.lunchLabel = $("#timetable-lunch-label").value.trim() || "午休";
  document.querySelectorAll("[data-day-name]").forEach(input => { timetable.days[Number(input.dataset.dayName)].name = input.value.trim(); });
  document.querySelectorAll("[data-day-note]").forEach(input => { timetable.days[Number(input.dataset.dayNote)].note = input.value.trim(); });
  document.querySelectorAll("[data-period-label]").forEach(input => { timetable.periods[Number(input.dataset.periodLabel)].label = input.value.trim(); });
  document.querySelectorAll("[data-period-time]").forEach(input => { timetable.periods[Number(input.dataset.periodTime)].time = input.value.trim(); });
  document.querySelectorAll("[data-cell-subject]").forEach(input => {
    const [row, day] = input.dataset.cellSubject.split(":").map(Number);
    timetable.cells[row][day].subject = input.value.trim();
  });
  document.querySelectorAll("[data-cell-teacher]").forEach(input => {
    const [row, day] = input.dataset.cellTeacher.split(":").map(Number);
    timetable.cells[row][day].teacher = input.value.trim();
  });
  state.timetableDraft = timetable;
  return timetable;
}

function openTimetableEditor() {
  if (!isAdmin()) return;
  state.timetableDraft = normalizeTimetable(state.timetable);
  renderTimetableEditor();
  openDialog("timetable-dialog");
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function parseCSV(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += char;
  }
  if (field || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  return rows.filter(item => item.some(value => value.trim()));
}

function exportTimetableCSV() {
  const timetable = collectTimetableEditor();
  const rows = [
    ["#功課表標題", timetable.title], ["#上方說明", timetable.subtitle], ["#風格", timetable.theme],
    ["#午休位置", timetable.lunchAfter], ["#午休文字", timetable.lunchLabel]
  ];
  timetable.days.forEach(day => rows.push(["#星期", day.name, day.note]));
  const header = ["節次", "時間"];
  timetable.days.forEach(day => header.push(`${day.name}課程`, `${day.name}教師`));
  rows.push(header);
  timetable.periods.forEach((period, rowIndex) => {
    const row = [period.label, period.time];
    timetable.days.forEach((_, dayIndex) => {
      const cell = timetable.cells[rowIndex][dayIndex];
      row.push(cell.subject, cell.teacher);
    });
    rows.push(row);
  });
  const csv = "\uFEFF" + rows.map(row => row.map(csvEscape).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "一年戊班功課表樣板.csv";
  link.click();
  URL.revokeObjectURL(link.href);
  showToast("CSV 樣板已下載");
}

function importTimetableCSV(text) {
  const rows = parseCSV(text.replace(/^\uFEFF/, ""));
  const days = rows.filter(row => row[0] === "#星期").map(row => ({ name: row[1]?.trim() || "", note: row[2]?.trim() || "" }));
  if (days.length < 5 || days.length > 7) throw new Error("CSV 必須包含 5～7 列「#星期」設定");
  const headerIndex = rows.findIndex(row => row[0]?.trim() === "節次" && row[1]?.trim() === "時間");
  if (headerIndex < 0) throw new Error("找不到「節次,時間」欄位標題");
  const valueOf = key => rows.find(row => row[0] === key)?.[1]?.trim() || "";
  const periodRows = rows.slice(headerIndex + 1).filter(row => row[0]?.trim());
  if (!periodRows.length) throw new Error("CSV 沒有節次資料");
  const periods = periodRows.map(row => ({ label: row[0].trim(), time: row[1]?.trim() || "" }));
  const cells = periodRows.map(row => days.map((_, dayIndex) => ({
    subject: row[2 + dayIndex * 2]?.trim() || "",
    teacher: row[3 + dayIndex * 2]?.trim() || ""
  })));
  state.timetableDraft = normalizeTimetable({
    title: valueOf("#功課表標題") || "一年戊班課表",
    subtitle: valueOf("#上方說明"),
    theme: valueOf("#風格") || "candy",
    dayCount: days.length, days, periods, cells,
    lunchAfter: Number(valueOf("#午休位置")) || 0,
    lunchLabel: valueOf("#午休文字") || "午休"
  });
  renderTimetableEditor();
  showToast("CSV 已匯入，請確認後儲存");
}

function exportEventsCSV() {
  const header = ["活動名稱", "分類", "開始日期", "結束日期", "全天", "開始時間", "結束時間", "說明", "連結", "重要", "重複", "重複截止日"];
  const rows = state.events.map(event => [
    event.title, eventCategory(event).label, event.startDate, event.endDate || event.startDate,
    event.allDay !== false ? "是" : "否", event.startTime || "", event.endTime || "", event.description || "", event.link || "",
    event.important ? "是" : "否", event.repeat === "weekly" ? "每週" : event.repeat === "monthly" ? "每月" : "不重複", event.repeatUntil || ""
  ]);
  const csv = "\uFEFF" + [header, ...rows].map(row => row.map(csvEscape).join(",")).join("\r\n");
  downloadBlob(csv, "一年戊班行事曆樣板.csv", "text/csv;charset=utf-8");
  showToast("行事曆 CSV 已下載");
}

function normalizeCSVCategory(value) {
  const map = { 評量: "exam", 學校活動: "school", 班級活動: "class", "放假／停課": "holiday", "放假/停課": "holiday", 攜帶物品: "item", 其他: "other" };
  return EVENT_CATEGORIES[value] ? value : (map[value] || "other");
}

function normalizeCSVRepeat(value) {
  const map = { 每週: "weekly", 每月: "monthly", 不重複: "none", none: "none", weekly: "weekly", monthly: "monthly" };
  return map[value] || "none";
}

async function importEventsCSV(text) {
  const rows = parseCSV(text.replace(/^\uFEFF/, ""));
  const expected = ["活動名稱", "分類", "開始日期", "結束日期", "全天", "開始時間", "結束時間", "說明", "連結", "重要", "重複", "重複截止日"];
  if (!rows.length || expected.some((name, index) => rows[0][index]?.trim() !== name)) throw new Error("CSV 欄位名稱或順序不正確，請使用網站下載的樣板");
  const imported = [];
  rows.slice(1).forEach((row, index) => {
    if (!row[0]?.trim()) return;
    const repeat = normalizeCSVRepeat(row[10]?.trim());
    const item = {
      title: row[0].trim(), category: normalizeCSVCategory(row[1]?.trim()),
      startDate: row[2]?.trim(), endDate: row[3]?.trim() || row[2]?.trim(),
      allDay: row[4]?.trim() !== "否", startTime: row[5]?.trim() || "", endTime: row[6]?.trim() || "",
      description: row[7]?.trim() || "", link: row[8]?.trim() || "", important: row[9]?.trim() === "是",
      repeat, repeatUntil: repeat === "none" ? "" : row[11]?.trim(), createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(item.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(item.endDate) || item.endDate < item.startDate) {
      throw new Error(`第 ${index + 2} 列日期格式錯誤`);
    }
    if (item.repeat !== "none" && (!item.repeatUntil || item.repeatUntil < item.startDate)) throw new Error(`第 ${index + 2} 列重複截止日錯誤`);
    if (item.link && safeUrl(item.link) === "#") throw new Error(`第 ${index + 2} 列連結格式錯誤`);
    imported.push(item);
  });
  if (!imported.length) throw new Error("CSV 沒有可匯入的活動");
  if (imported.length > 200) throw new Error("一次最多匯入 200 筆活動");
  const batch = writeBatch(db);
  imported.forEach(item => batch.set(doc(collection(db, "events")), item));
  await batch.commit();
  showToast(`已匯入 ${imported.length} 筆行事曆活動`);
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename.replace(/[\\/:*?"<>|]/g, "-");
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 0);
}

function icsEscape(value = "") {
  return String(value).replaceAll("\\", "\\\\").replaceAll(";", "\\;").replaceAll(",", "\\,").replace(/\r?\n/g, "\\n");
}

function icsDate(value) {
  return String(value).replaceAll("-", "");
}

function icsUtc(date, time = "00:00") {
  const parsed = new Date(`${date}T${time || "00:00"}:00+08:00`);
  return parsed.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function eventToICS(event) {
  const lines = ["BEGIN:VEVENT", `UID:${icsEscape(event.id || `${event.startDate}-${event.title}`)}@maggie115-contact-book`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}`];
  if (event.allDay !== false) {
    lines.push(`DTSTART;VALUE=DATE:${icsDate(event.startDate)}`);
    lines.push(`DTEND;VALUE=DATE:${icsDate(addDaysKey(event.endDate || event.startDate, 1))}`);
  } else {
    lines.push(`DTSTART:${icsUtc(event.startDate, event.startTime || "00:00")}`);
    lines.push(`DTEND:${icsUtc(event.endDate || event.startDate, event.endTime || event.startTime || "00:00")}`);
  }
  if (["weekly", "monthly"].includes(event.repeat) && event.repeatUntil) {
    const frequency = event.repeat === "weekly" ? "WEEKLY" : "MONTHLY";
    const until = event.allDay !== false ? icsDate(event.repeatUntil) : icsUtc(event.repeatUntil, "23:59");
    lines.push(`RRULE:FREQ=${frequency};UNTIL=${until}`);
  }
  lines.push(`SUMMARY:${icsEscape(event.title)}`);
  lines.push(`CATEGORIES:${icsEscape(eventCategory(event).label)}`);
  if (event.description) lines.push(`DESCRIPTION:${icsEscape(event.description)}`);
  if (event.link && safeUrl(event.link) !== "#") lines.push(`URL:${event.link}`);
  lines.push("END:VEVENT");
  return lines.join("\r\n");
}

function downloadEventsICS(events = state.events, filename = "一年戊班行事曆.ics") {
  if (!events.length) return showToast("目前沒有可匯出的活動", true);
  const content = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//清水國小一年戊班//班級行事曆//ZH-TW", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:一年戊班行事曆", ...events.map(eventToICS), "END:VCALENDAR"].join("\r\n");
  downloadBlob(`${content}\r\n`, filename, "text/calendar;charset=utf-8");
  showToast(".ics 行事曆已下載");
}

function renderHeader() {
  $("#site-title").textContent = state.settings.title;
  document.title = state.settings.title;
  $(".eyebrow").textContent = state.settings.subtitle || "電子聯絡簿";
  $("#footer-year").textContent = new Date().getFullYear();
  $("#login-button").classList.toggle("hidden", Boolean(state.user));
  $("#logout-button").classList.toggle("hidden", !state.user);
  $("#admin-bar").classList.toggle("hidden", !isAdmin());
  $("#user-badge").classList.toggle("hidden", !state.user);
  $("#user-badge").textContent = isAdmin() ? "管理員" : "已登入（無管理權限）";
}

function renderResources() {
  const container = $("#resource-list");
  const current = todayKey();
  const visibleLinks = state.links.filter(link => isAdmin() || !link.expireDate || link.expireDate >= current);
  container.replaceChildren();
  if (!visibleLinks.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "目前沒有文件或網站";
    container.append(empty);
    return;
  }
  visibleLinks.forEach(link => {
    const wrapper = document.createElement("div");
    wrapper.style.position = "relative";
    const anchor = document.createElement("a");
    anchor.className = "resource-card";
    anchor.href = safeUrl(link.url);
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    const icon = document.createElement("span");
    icon.className = "resource-icon";
    icon.textContent = link.type === "website" ? "🔗" : "📄";
    const text = document.createElement("span");
    const title = document.createElement("strong");
    title.textContent = link.title;
    const note = document.createElement("small");
    note.textContent = link.expireDate ? `有效至 ${link.expireDate}` : (link.type === "website" ? "網站" : "文件");
    text.append(title, note);
    anchor.append(icon, text);
    wrapper.append(anchor);
    if (isAdmin()) wrapper.append(makeActions(() => editLink(link.id), () => removeDoc("links", link.id, "資源")));
    container.append(wrapper);
  });
}

function renderAnnouncements() {
  const panel = $("#announcement-panel");
  const container = $("#announcement-list");
  const announcements = state.entries
    .filter(entry => entry.pinned && isEntryVisibleNow(entry))
    .sort((a, b) => (b.publishStart || b.date).localeCompare(a.publishStart || a.date));

  panel.classList.toggle("hidden", !announcements.length);
  container.replaceChildren();
  announcements.forEach(entry => {
    const card = document.createElement("article");
    card.className = "announcement-card";
    const content = document.createElement("p");
    content.className = "announcement-content";
    appendLinkedContent(content, entry.content);
    card.append(content);

    const meta = document.createElement("p");
    meta.className = "announcement-meta";
    if (entry.publishStart && entry.publishEnd) {
      meta.textContent = `公告期間：${formatDateTime(entry.publishStart)} ～ ${formatDateTime(entry.publishEnd)}`;
    } else if (entry.publishStart) {
      meta.textContent = `自 ${formatDateTime(entry.publishStart)} 起公告`;
    } else if (entry.publishEnd) {
      meta.textContent = `公告至 ${formatDateTime(entry.publishEnd)}`;
    }
    if (meta.textContent) card.append(meta);

    const row = document.createElement("div");
    row.className = "tag-row";
    (entry.tags || []).forEach(tagId => {
      const tag = state.tags.find(item => item.id === tagId);
      if (!tag) return;
      const badge = document.createElement("span");
      badge.className = "tag";
      badge.style.backgroundColor = tag.color;
      badge.textContent = tag.name;
      row.append(badge);
    });
    if (row.children.length) card.append(row);
    container.append(card);
  });
}

function makeActions(onEdit, onDelete, onCopy = null) {
  const actions = document.createElement("div");
  actions.className = "card-actions";
  if (onCopy) {
    const copy = document.createElement("button");
    copy.type = "button";
    copy.textContent = "複製";
    copy.addEventListener("click", onCopy);
    actions.append(copy);
  }
  const edit = document.createElement("button");
  edit.type = "button";
  edit.textContent = "編輯";
  edit.addEventListener("click", onEdit);
  const remove = document.createElement("button");
  remove.type = "button";
  remove.textContent = "刪除";
  remove.addEventListener("click", onDelete);
  actions.append(edit, remove);
  return actions;
}

function allAdminEntries() {
  return [
    ...state.entries.map(item => ({ ...item, _source: "entries" })),
    ...state.drafts.map(item => ({ ...item, _source: "drafts" }))
  ].sort((a, b) => b.date.localeCompare(a.date));
}

function findEntry(source, id) {
  const items = source === "drafts" ? state.drafts : state.entries;
  return items.find(item => item.id === id);
}

function entryAction(label, handler, className = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  if (className) button.className = className;
  button.addEventListener("click", handler);
  return button;
}

function makeEntryActions(entry) {
  const actions = document.createElement("div");
  actions.className = "card-actions entry-actions";
  actions.append(
    entryAction("複製", () => copyEntry(entry._source, entry.id)),
    entryAction("編輯", () => editEntry(entry._source, entry.id))
  );
  if (entry._source === "drafts") {
    actions.append(entryAction("發布", () => publishDraft(entry.id), "publish-action"));
  } else {
    actions.append(entryAction("取消發布", () => unpublishEntry(entry.id)));
  }
  actions.append(entryAction("刪除", () => removeDoc(entry._source, entry.id, entry._source === "drafts" ? "草稿" : "聯絡簿")));
  return actions;
}

function renderEntries() {
  const container = $("#entry-list");
  let entries = isAdmin()
    ? allAdminEntries()
    : state.entries.filter(entry => isEntryVisibleNow(entry) && !entry.pinned).map(item => ({ ...item, _source: "entries" }));
  if (isAdmin() && state.entryFilter !== "all") entries = entries.filter(item => item._source === state.entryFilter);
  if (state.selectedDate) entries = entries.filter(item => item.date === state.selectedDate);

  $("#entry-admin-filters").classList.toggle("hidden", !isAdmin());
  document.querySelectorAll("[data-entry-filter]").forEach(button => {
    button.classList.toggle("active", button.dataset.entryFilter === state.entryFilter);
  });
  $("#filter-label").textContent = state.selectedDate ? `篩選日期：${formatDate(state.selectedDate)}` : "顯示全部聯絡簿";
  $("#clear-filter").classList.toggle("hidden", !state.selectedDate);
  container.replaceChildren();
  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = isAdmin() && state.entryFilter === "drafts" ? "目前沒有草稿" : "沒有符合的聯絡簿資料";
    container.append(empty);
    return;
  }
  entries.forEach(entry => {
    const card = document.createElement("article");
    card.className = `entry-card${entry._source === "drafts" ? " draft-card" : ""}`;
    if (isAdmin()) card.classList.add("admin-entry-card");
    const date = document.createElement("p");
    date.className = "entry-date";
    date.textContent = formatDate(entry.date);
    card.append(date);
    if (isAdmin()) {
      const status = document.createElement("span");
      const now = nowLocalKey();
      const isFuture = entry.pinned && entry.publishStart && entry.publishStart > now;
      const isExpired = entry.pinned && entry.publishEnd && entry.publishEnd < now;
      status.className = `entry-status ${entry._source === "drafts" ? "draft-status" : "published-status"}`;
      if (entry._source === "drafts") status.textContent = "草稿";
      else if (isFuture) status.textContent = "排程公告";
      else if (isExpired) status.textContent = "公告已結束";
      else if (entry.pinned) status.textContent = "重要公告";
      else status.textContent = "已發布";
      card.append(status);
    }
    const content = document.createElement("p");
    content.className = "entry-content";
    appendLinkedContent(content, entry.content);
    card.append(content);
    const row = document.createElement("div");
    row.className = "tag-row";
    (entry.tags || []).forEach(tagId => {
      const tag = state.tags.find(item => item.id === tagId);
      if (!tag) return;
      const badge = document.createElement("span");
      badge.className = "tag";
      badge.style.backgroundColor = tag.color;
      badge.textContent = tag.name;
      row.append(badge);
    });
    if (row.children.length) card.append(row);
    if (isAdmin()) card.append(makeEntryActions(entry));
    container.append(card);
  });
}

function renderCalendar() {
  const year = state.calendarDate.getFullYear();
  const month = state.calendarDate.getMonth();
  $("#calendar-title").textContent = `民國 ${year - 1911} 年 ${month + 1} 月`;
  const grid = $("#calendar-grid");
  grid.replaceChildren();
  const firstDay = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  for (let i = 0; i < firstDay; i += 1) grid.append(document.createElement("span"));
  for (let day = 1; day <= days; day += 1) {
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const button = document.createElement("button");
    button.className = "calendar-day";
    button.textContent = day;
    button.classList.toggle("today", key === todayKey());
    button.classList.toggle("selected", key === state.selectedDate);
    const calendarEntries = isAdmin()
      ? [...state.entries, ...state.drafts]
      : state.entries.filter(entry => isEntryVisibleNow(entry) && !entry.pinned);
    button.classList.toggle("has-entry", calendarEntries.some(entry => entry.date === key));
    button.addEventListener("click", () => {
      state.selectedDate = key;
      renderCalendar();
      renderEntries();
    });
    grid.append(button);
  }
}

function eventCategory(event) {
  return EVENT_CATEGORIES[event.category] || EVENT_CATEGORIES.other;
}

function makeEventChip(occurrence, compact = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `event-chip category-${occurrence.event.category || "other"}${occurrence.event.important ? " important" : ""}`;
  button.title = eventDateLabel(occurrence);
  const prefix = occurrence.event.important ? "★ " : (occurrence.event.repeat && occurrence.event.repeat !== "none" ? "↻ " : "");
  const time = !compact && occurrence.event.allDay === false && occurrence.event.startTime ? `${occurrence.event.startTime} ` : "";
  button.textContent = `${prefix}${time}${occurrence.event.title}`;
  button.addEventListener("click", event => {
    event.stopPropagation();
    showEventDetails(occurrence);
  });
  return button;
}

function renderEventAlerts() {
  const container = $("#event-alerts");
  const today = todayKey();
  const upcoming = occurrencesInRange(today, addDaysKey(today, 30))
    .filter(item => item.event.important)
    .slice(0, 4);
  container.replaceChildren();
  container.classList.toggle("hidden", !upcoming.length);
  upcoming.forEach(occurrence => {
    const days = daysBetween(today, occurrence.occurrenceStart);
    const card = document.createElement("button");
    card.type = "button";
    card.className = `event-alert-card category-${occurrence.event.category || "other"}`;
    const countdown = document.createElement("strong");
    countdown.textContent = days < 0 ? "進行中" : days === 0 ? "今天" : days === 1 ? "明天" : `${days} 天後`;
    const title = document.createElement("span");
    title.textContent = occurrence.event.title;
    card.append(countdown, title);
    card.addEventListener("click", () => showEventDetails(occurrence));
    container.append(card);
  });
}

function renderEventsCalendar() {
  const year = state.eventsCalendarDate.getFullYear();
  const month = state.eventsCalendarDate.getMonth();
  $("#events-month-title").textContent = `民國 ${year - 1911} 年 ${month + 1} 月`;
  const monthStart = new Date(year, month, 1, 12);
  const calendarStart = new Date(year, month, 1 - monthStart.getDay(), 12);
  const monthEnd = new Date(year, month + 1, 0, 12);
  const cells = Math.ceil((monthStart.getDay() + monthEnd.getDate()) / 7) * 7;
  const calendarEnd = new Date(calendarStart);
  calendarEnd.setDate(calendarEnd.getDate() + cells - 1);
  const rangeStart = dateKeyFromDate(calendarStart);
  const rangeEnd = dateKeyFromDate(calendarEnd);
  const occurrences = occurrencesInRange(rangeStart, rangeEnd);
  const grid = $("#events-calendar-grid");
  grid.replaceChildren();

  for (let index = 0; index < cells; index += 1) {
    const date = new Date(calendarStart);
    date.setDate(date.getDate() + index);
    const key = dateKeyFromDate(date);
    const day = document.createElement("article");
    day.className = "events-day";
    if (date.getMonth() !== month) day.classList.add("outside-month");
    if (key === todayKey()) day.classList.add("today");
    const dayButton = document.createElement("button");
    dayButton.type = "button";
    dayButton.className = "events-day-number";
    dayButton.textContent = date.getDate();
    dayButton.title = "查看當日聯絡簿";
    dayButton.addEventListener("click", () => showContactBookDate(key));
    day.append(dayButton);
    const list = document.createElement("div");
    list.className = "events-day-items";
    occurrences.filter(item => key >= item.occurrenceStart && key <= item.occurrenceEnd)
      .slice(0, 4).forEach(item => list.append(makeEventChip(item, true)));
    const count = occurrences.filter(item => key >= item.occurrenceStart && key <= item.occurrenceEnd).length;
    if (count > 4) {
      const more = document.createElement("span");
      more.className = "event-more";
      more.textContent = `還有 ${count - 4} 項`;
      list.append(more);
    }
    day.append(list);
    grid.append(day);
  }
}

function renderEventsList() {
  const year = state.eventsCalendarDate.getFullYear();
  const month = state.eventsCalendarDate.getMonth();
  const start = dateKeyFromDate(new Date(year, month, 1, 12));
  const end = dateKeyFromDate(new Date(year, month + 1, 0, 12));
  const occurrences = occurrencesInRange(start, end);
  const container = $("#events-list-view");
  container.replaceChildren();
  if (!occurrences.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "本月目前沒有活動";
    container.append(empty);
    return;
  }
  occurrences.forEach(occurrence => {
    const card = document.createElement("article");
    card.className = `event-list-card category-${occurrence.event.category || "other"}`;
    const date = document.createElement("div");
    date.className = "event-list-date";
    const dateObj = dateFromKey(occurrence.occurrenceStart);
    const day = document.createElement("strong");
    day.textContent = String(dateObj.getDate());
    const weekday = document.createElement("span");
    weekday.textContent = `週${["日", "一", "二", "三", "四", "五", "六"][dateObj.getDay()]}`;
    date.append(day, weekday);
    const body = document.createElement("button");
    body.type = "button";
    body.className = "event-list-body";
    const title = document.createElement("strong");
    title.textContent = `${occurrence.event.important ? "★ " : ""}${eventCategory(occurrence.event).icon} ${occurrence.event.title}`;
    const meta = document.createElement("span");
    meta.textContent = eventDateLabel(occurrence);
    body.append(title, meta);
    body.addEventListener("click", () => showEventDetails(occurrence));
    card.append(date, body);
    container.append(card);
  });
}

function renderEvents() {
  $("#add-event-page").classList.toggle("hidden", !isAdmin());
  $("#events-admin-tools").classList.toggle("hidden", !isAdmin());
  $("#events-calendar-view").classList.toggle("hidden", state.eventsView !== "month");
  $("#events-list-view").classList.toggle("hidden", state.eventsView !== "list");
  document.querySelectorAll("[data-events-view]").forEach(button => button.classList.toggle("active", button.dataset.eventsView === state.eventsView));
  renderEventAlerts();
  renderEventsCalendar();
  renderEventsList();
  applyEventsViewSettings();
}

function repeatLabel(event) {
  if (event.repeat === "weekly") return `每週重複至 ${event.repeatUntil}`;
  if (event.repeat === "monthly") return `每月重複至 ${event.repeatUntil}`;
  return "不重複";
}

function showEventDetails(occurrence) {
  const event = occurrence.event;
  $("#event-detail-title").textContent = event.title;
  const content = $("#event-detail-content");
  content.replaceChildren();
  const category = document.createElement("span");
  category.className = `event-category-badge category-${event.category || "other"}`;
  category.textContent = `${eventCategory(event).icon} ${eventCategory(event).label}${event.important ? "・重要活動" : ""}`;
  const date = document.createElement("p");
  date.textContent = eventDateLabel(occurrence);
  const repeat = document.createElement("p");
  repeat.textContent = `重複：${repeatLabel(event)}`;
  content.append(category, date, repeat);
  if (event.description) {
    const description = document.createElement("p");
    description.className = "event-detail-description";
    appendLinkedContent(description, event.description);
    content.append(description);
  }
  if (event.link && safeUrl(event.link) !== "#") {
    const link = document.createElement("a");
    link.href = safeUrl(event.link);
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "開啟相關連結 ↗";
    content.append(link);
  }

  const actions = $("#event-detail-actions");
  actions.replaceChildren();
  const ics = document.createElement("button");
  ics.type = "button";
  ics.className = "button button-secondary";
  ics.textContent = "加入個人行事曆 (.ics)";
  ics.addEventListener("click", () => downloadEventsICS([event], `${event.title}.ics`));
  actions.append(ics);
  if (isAdmin()) {
    const copy = document.createElement("button");
    copy.type = "button"; copy.className = "button button-secondary"; copy.textContent = "複製";
    copy.addEventListener("click", () => { closeDialog($("#event-detail-dialog")); openEventEditor(event, true); });
    const edit = document.createElement("button");
    edit.type = "button"; edit.className = "button button-secondary"; edit.textContent = "編輯";
    edit.addEventListener("click", () => { closeDialog($("#event-detail-dialog")); openEventEditor(event); });
    const remove = document.createElement("button");
    remove.type = "button"; remove.className = "button button-danger"; remove.textContent = "刪除";
    remove.addEventListener("click", async () => {
      closeDialog($("#event-detail-dialog"));
      await removeDoc("events", event.id, "行事曆活動");
    });
    actions.append(copy, edit, remove);
  }
  openDialog("event-detail-dialog");
}

function syncEventFormFields() {
  const allDay = $("#event-all-day").checked;
  $("#event-start-time").disabled = allDay;
  $("#event-end-time").disabled = allDay;
  $("#event-time-fields").classList.toggle("disabled-fields", allDay);
  const repeats = $("#event-repeat").value !== "none";
  $("#event-repeat-until").disabled = !repeats;
  $("#event-repeat-until").required = repeats;
  $("#event-end-date").min = $("#event-start-date").value;
  $("#event-repeat-until").min = $("#event-start-date").value;
}

function openEventEditor(event = null, copy = false) {
  if (!isAdmin()) return;
  $("#event-form").reset();
  const today = todayKey();
  $("#event-id").value = event && !copy ? event.id : "";
  $("#event-dialog-title").textContent = event ? (copy ? "複製行事曆活動" : "修改行事曆活動") : "新增行事曆活動";
  $("#event-title-input").value = event ? `${event.title}${copy ? "（複製）" : ""}` : "";
  $("#event-category").value = event?.category || "class";
  $("#event-start-date").value = event?.startDate || today;
  $("#event-end-date").value = event?.endDate || event?.startDate || today;
  $("#event-all-day").checked = event?.allDay !== false;
  $("#event-start-time").value = event?.startTime || "";
  $("#event-end-time").value = event?.endTime || "";
  $("#event-description").value = event?.description || "";
  $("#event-link").value = event?.link || "";
  $("#event-important").checked = Boolean(event?.important);
  $("#event-repeat").value = event?.repeat || "none";
  $("#event-repeat-until").value = event?.repeatUntil || "";
  syncEventFormFields();
  openDialog("event-dialog");
}

function renderTags() {
  const choices = $("#entry-tag-options");
  choices.replaceChildren();
  state.tags.forEach(tag => {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = "entry-tags";
    input.value = tag.id;
    const span = document.createElement("span");
    span.textContent = tag.name;
    span.style.color = tag.color;
    label.append(input, span);
    choices.append(label);
  });
  const list = $("#tag-manage-list");
  list.replaceChildren();
  if (!state.tags.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "目前沒有標籤";
    list.append(empty);
  }
  state.tags.forEach(tag => {
    const row = document.createElement("div");
    row.className = "manage-row";
    const label = document.createElement("span");
    label.className = "tag";
    label.style.backgroundColor = tag.color;
    label.textContent = tag.name;
    const remove = document.createElement("button");
    remove.textContent = "刪除";
    remove.addEventListener("click", () => removeDoc("tags", tag.id, "標籤"));
    row.append(label, remove);
    list.append(row);
  });
}

function renderTemplates() {
  const select = $("#entry-template");
  const currentValue = select.value;
  select.replaceChildren();

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = state.templates.length ? "請選擇範本" : "目前沒有範本";
  select.append(placeholder);

  state.templates.forEach(template => {
    const option = document.createElement("option");
    option.value = template.id;
    option.textContent = template.name;
    select.append(option);
  });
  if (state.templates.some(template => template.id === currentValue)) select.value = currentValue;
  $("#apply-template").disabled = !state.templates.length;

  const list = $("#template-manage-list");
  list.replaceChildren();
  if (!state.templates.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "目前沒有常用範本";
    list.append(empty);
    return;
  }

  state.templates.forEach(template => {
    const row = document.createElement("div");
    row.className = "manage-row template-row";
    const text = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = template.name;
    const preview = document.createElement("small");
    preview.textContent = template.content;
    text.append(name, preview);

    const actions = document.createElement("div");
    actions.className = "manage-actions";
    const edit = document.createElement("button");
    edit.type = "button";
    edit.textContent = "修改";
    edit.addEventListener("click", () => editTemplate(template.id));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "刪除";
    remove.addEventListener("click", () => removeDoc("templates", template.id, "範本"));
    actions.append(edit, remove);
    row.append(text, actions);
    list.append(row);
  });
}

function setEntryFormMode(source = "") {
  $("#entry-source").value = source;
  if (source === "drafts") {
    $("#entry-dialog-title").textContent = "修改草稿";
    $("#save-draft").textContent = "儲存草稿";
    $("#publish-entry").textContent = "發布";
  } else if (source === "entries") {
    $("#entry-dialog-title").textContent = "修改已發布聯絡簿";
    $("#save-draft").textContent = "取消發布";
    $("#publish-entry").textContent = "儲存修改";
  } else {
    $("#entry-dialog-title").textContent = "新增聯絡簿";
    $("#save-draft").textContent = "儲存草稿";
    $("#publish-entry").textContent = "立即發布";
  }
}

function syncAnnouncementFields() {
  const enabled = $("#entry-pinned").checked;
  $("#entry-publish-start").disabled = !enabled;
  $("#entry-publish-end").disabled = !enabled;
  $("#announcement-time-fields").classList.toggle("disabled-fields", !enabled);
}

function editEntry(source, id) {
  const entry = findEntry(source, id);
  if (!entry) return;
  setEntryFormMode(source);
  $("#entry-id").value = id;
  $("#entry-date").value = entry.date;
  $("#entry-template").value = "";
  $("#entry-content").value = entry.content;
  $("#entry-pinned").checked = Boolean(entry.pinned);
  $("#entry-publish-start").value = entry.publishStart || "";
  $("#entry-publish-end").value = entry.publishEnd || "";
  syncAnnouncementFields();
  document.querySelectorAll('input[name="entry-tags"]').forEach(input => { input.checked = (entry.tags || []).includes(input.value); });
  openDialog("entry-dialog");
}

function copyEntry(source, id) {
  const entry = findEntry(source, id);
  if (!entry || !isAdmin()) return;

  // 複製只會預先填入表單，不會直接寫入資料庫，也不會覆蓋原資料。
  $("#entry-form").reset();
  $("#entry-id").value = "";
  setEntryFormMode("");
  $("#entry-date").value = todayKey();
  $("#entry-template").value = "";
  $("#entry-content").value = entry.content || "";
  $("#entry-pinned").checked = false;
  $("#entry-publish-start").value = "";
  $("#entry-publish-end").value = "";
  syncAnnouncementFields();
  document.querySelectorAll('input[name="entry-tags"]').forEach(input => {
    input.checked = (entry.tags || []).includes(input.value);
  });
  $("#entry-dialog-title").textContent = "複製聯絡簿";
  openDialog("entry-dialog");
}

function entryMoveData(entry, destination) {
  const data = {
    date: entry.date,
    content: entry.content,
    tags: entry.tags || [],
    pinned: Boolean(entry.pinned),
    publishStart: entry.publishStart || "",
    publishEnd: entry.publishEnd || "",
    createdAt: entry.createdAt || serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  if (destination === "entries") data.publishedAt = serverTimestamp();
  return data;
}

async function moveEntry(source, destination, entry) {
  const batch = writeBatch(db);
  batch.set(doc(db, destination, entry.id), entryMoveData(entry, destination));
  batch.delete(doc(db, source, entry.id));
  await batch.commit();
}

async function publishDraft(id) {
  const entry = findEntry("drafts", id);
  if (!entry || !isAdmin() || !confirm("確定發布這篇草稿嗎？發布後家長即可看到。")) return;
  try {
    await moveEntry("drafts", "entries", entry);
    showToast("草稿已發布");
  } catch (error) { showToast(`發布失敗：${error.message}`, true); }
}

async function unpublishEntry(id) {
  const entry = findEntry("entries", id);
  if (!entry || !isAdmin() || !confirm("確定取消發布嗎？取消後家長將看不到這篇聯絡簿。")) return;
  try {
    await moveEntry("entries", "drafts", entry);
    showToast("已取消發布並移至草稿匣");
  } catch (error) { showToast(`取消發布失敗：${error.message}`, true); }
}

function editTemplate(id) {
  const template = state.templates.find(item => item.id === id);
  if (!template || !isAdmin()) return;
  $("#template-id").value = id;
  $("#template-name").value = template.name;
  $("#template-content").value = template.content;
  $("#template-submit").textContent = "儲存修改";
  $("#template-cancel-edit").classList.remove("hidden");
  $("#template-name").focus();
}

function resetTemplateForm() {
  $("#template-form").reset();
  $("#template-id").value = "";
  $("#template-submit").textContent = "新增範本";
  $("#template-cancel-edit").classList.add("hidden");
}

function editLink(id) {
  const link = state.links.find(item => item.id === id);
  if (!link) return;
  $("#link-dialog-title").textContent = "修改資源";
  $("#link-id").value = id;
  $("#link-title").value = link.title;
  $("#link-url").value = link.url;
  $("#link-type").value = link.type || "document";
  $("#link-expire-date").value = link.expireDate || "";
  openDialog("link-dialog");
}

async function removeDoc(collectionName, id, label) {
  if (!isAdmin() || !confirm(`確定刪除這筆${label}嗎？`)) return;
  try {
    await deleteDoc(doc(db, collectionName, id));
    showToast(`${label}已刪除`);
  } catch (error) { showToast(`刪除失敗：${error.message}`, true); }
}

function subscribeData() {
  onSnapshot(query(collection(db, "entries"), orderBy("date", "desc")), snapshot => {
    state.entries = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    renderEntries(); renderCalendar(); renderAnnouncements();
  }, error => showToast(`聯絡簿載入失敗：${error.message}`, true));

  onSnapshot(query(collection(db, "links"), orderBy("title")), snapshot => {
    state.links = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    renderResources();
  }, error => showToast(`資源載入失敗：${error.message}`, true));

  onSnapshot(query(collection(db, "tags"), orderBy("name")), snapshot => {
    state.tags = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    renderTags(); renderEntries(); renderAnnouncements();
  }, error => showToast(`標籤載入失敗：${error.message}`, true));

  onSnapshot(query(collection(db, "templates"), orderBy("name")), snapshot => {
    state.templates = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    renderTemplates();
  }, error => showToast(`常用範本載入失敗：${error.message}`, true));

  onSnapshot(query(collection(db, "events"), orderBy("startDate")), snapshot => {
    state.events = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    renderEvents();
  }, error => showToast(`班級行事曆載入失敗：${error.message}`, true));

  onSnapshot(doc(db, "settings", "main"), snapshot => {
    if (snapshot.exists()) state.settings = { ...state.settings, ...snapshot.data() };
    renderHeader();
  }, error => showToast(`設定載入失敗：${error.message}`, true));

  onSnapshot(doc(db, "timetables", "main"), snapshot => {
    state.timetable = snapshot.exists()
      ? { ...normalizeTimetable(snapshot.data()), updatedAt: snapshot.data().updatedAt }
      : defaultTimetable();
    renderTimetable();
  }, error => showToast(`功課表載入失敗：${error.message}`, true));
}

function subscribeDrafts() {
  if (unsubscribeDrafts) {
    unsubscribeDrafts();
    unsubscribeDrafts = null;
  }
  state.drafts = [];
  if (!isAdmin()) {
    renderEntries();
    renderCalendar();
    return;
  }
  unsubscribeDrafts = onSnapshot(query(collection(db, "drafts"), orderBy("date", "desc")), snapshot => {
    state.drafts = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    renderEntries();
    renderCalendar();
  }, error => showToast(`草稿載入失敗：${error.message}`, true));
}

document.querySelectorAll("[data-open]").forEach(button => button.addEventListener("click", () => {
  if (!isAdmin()) return;
  const id = button.dataset.open;
  if (id === "entry-dialog") {
    $("#entry-form").reset();
    $("#entry-id").value = "";
    setEntryFormMode("");
    $("#entry-date").value = state.selectedDate || todayKey();
    $("#entry-template").value = "";
    syncAnnouncementFields();
  }
  if (id === "link-dialog") {
    $("#link-form").reset();
    $("#link-id").value = "";
    $("#link-dialog-title").textContent = "新增資源";
  }
  if (id === "settings-dialog") {
    $("#settings-title").value = state.settings.title;
    $("#settings-subtitle").value = state.settings.subtitle;
  }
  if (id === "template-dialog") resetTemplateForm();
  if (id === "timetable-dialog") {
    openTimetableEditor();
    return;
  }
  if (id === "event-dialog") {
    openEventEditor();
    return;
  }
  openDialog(id);
}));

document.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => closeDialog(button.closest("dialog"))));
document.querySelectorAll("dialog").forEach(dialog => dialog.addEventListener("click", event => {
  if (event.target === dialog) closeDialog(dialog);
}));

$("#login-button").addEventListener("click", () => openDialog("login-dialog"));
$("#logout-button").addEventListener("click", async () => { await signOut(auth); showToast("已登出"); });

$("#login-form").addEventListener("submit", async event => {
  event.preventDefault();
  try {
    const result = await signInWithEmailAndPassword(auth, $("#login-email").value.trim(), $("#login-password").value);
    if (result.user.uid !== ADMIN_UID) {
      await signOut(auth);
      throw new Error("此帳號沒有管理權限");
    }
    $("#login-form").reset();
    closeDialog($("#login-dialog"));
    showToast("登入成功");
  } catch (error) { showToast(`登入失敗：${error.message}`, true); }
});

function entryFormData() {
  const pinned = $("#entry-pinned").checked;
  const publishStart = pinned ? $("#entry-publish-start").value : "";
  const publishEnd = pinned ? $("#entry-publish-end").value : "";
  if (publishStart && publishEnd && publishEnd < publishStart) {
    showToast("公告結束時間不能早於開始時間", true);
    return null;
  }
  return {
    date: $("#entry-date").value,
    content: $("#entry-content").value.trim(),
    tags: [...document.querySelectorAll('input[name="entry-tags"]:checked')].map(input => input.value),
    pinned,
    publishStart,
    publishEnd,
    updatedAt: serverTimestamp()
  };
}

function eventFormData() {
  const startDate = $("#event-start-date").value;
  const endDate = $("#event-end-date").value;
  const allDay = $("#event-all-day").checked;
  const repeat = $("#event-repeat").value;
  const repeatUntil = repeat === "none" ? "" : $("#event-repeat-until").value;
  const startTime = allDay ? "" : $("#event-start-time").value;
  const endTime = allDay ? "" : $("#event-end-time").value;
  const linkValue = $("#event-link").value.trim();
  if (endDate < startDate) return showToast("活動結束日期不能早於開始日期", true), null;
  if (!allDay && (!startTime || !endTime)) return showToast("非全天活動必須填寫開始與結束時間", true), null;
  if (!allDay && startDate === endDate && endTime <= startTime) return showToast("結束時間必須晚於開始時間", true), null;
  if (repeat !== "none" && (!repeatUntil || repeatUntil < startDate)) return showToast("重複截止日期不能早於開始日期", true), null;
  if (linkValue && safeUrl(linkValue) === "#") return showToast("請輸入有效的 http 或 https 網址", true), null;
  return {
    title: $("#event-title-input").value.trim(), category: $("#event-category").value,
    startDate, endDate, allDay, startTime, endTime,
    description: $("#event-description").value.trim(), link: linkValue ? safeUrl(linkValue) : "",
    important: $("#event-important").checked, repeat, repeatUntil, updatedAt: serverTimestamp()
  };
}

$("#entry-form").addEventListener("submit", async event => {
  event.preventDefault();
  if (!isAdmin()) return;
  const id = $("#entry-id").value;
  const source = $("#entry-source").value;
  const data = entryFormData();
  if (!data) return;
  try {
    if (id && source === "drafts") {
      const original = findEntry("drafts", id);
      const batch = writeBatch(db);
      batch.set(doc(db, "entries", id), {
        ...data,
        createdAt: original?.createdAt || serverTimestamp(),
        publishedAt: serverTimestamp()
      });
      batch.delete(doc(db, "drafts", id));
      await batch.commit();
    } else if (id) {
      await updateDoc(doc(db, "entries", id), data);
    } else {
      await addDoc(collection(db, "entries"), { ...data, createdAt: serverTimestamp(), publishedAt: serverTimestamp() });
    }
    closeDialog($("#entry-dialog"));
    showToast(id && source === "entries" ? "已發布內容已更新" : "聯絡簿已發布");
  } catch (error) { showToast(`儲存失敗：${error.message}`, true); }
});

$("#save-draft").addEventListener("click", async () => {
  if (!isAdmin() || !$("#entry-form").reportValidity()) return;
  const id = $("#entry-id").value;
  const source = $("#entry-source").value;
  const data = entryFormData();
  if (!data) return;
  if (source === "entries" && !confirm("確定取消發布嗎？取消後家長將看不到這篇聯絡簿。")) return;
  try {
    if (id && source === "entries") {
      const original = findEntry("entries", id);
      const batch = writeBatch(db);
      batch.set(doc(db, "drafts", id), { ...data, createdAt: original?.createdAt || serverTimestamp() });
      batch.delete(doc(db, "entries", id));
      await batch.commit();
    } else if (id) {
      await updateDoc(doc(db, "drafts", id), data);
    } else {
      await addDoc(collection(db, "drafts"), { ...data, createdAt: serverTimestamp() });
    }
    closeDialog($("#entry-dialog"));
    showToast(source === "entries" ? "已取消發布並移至草稿匣" : "草稿已儲存");
  } catch (error) { showToast(`草稿儲存失敗：${error.message}`, true); }
});

$("#apply-template").addEventListener("click", () => {
  const template = state.templates.find(item => item.id === $("#entry-template").value);
  if (!template) return showToast("請先選擇一個範本", true);
  const content = $("#entry-content").value.trim();
  if (content && !confirm("套用範本會取代目前的聯絡簿內容，確定要繼續嗎？")) return;
  $("#entry-content").value = template.content;
  $("#entry-content").focus();
  showToast(`已套用「${template.name}」`);
});

$("#entry-pinned").addEventListener("change", syncAnnouncementFields);

$("#template-form").addEventListener("submit", async event => {
  event.preventDefault();
  if (!isAdmin()) return;
  const id = $("#template-id").value;
  const name = $("#template-name").value.trim();
  const content = $("#template-content").value.trim();
  if (state.templates.some(template => template.name === name && template.id !== id)) {
    return showToast("範本名稱已存在", true);
  }
  const data = { name, content, updatedAt: serverTimestamp() };
  try {
    if (id) await updateDoc(doc(db, "templates", id), data);
    else await addDoc(collection(db, "templates"), { ...data, createdAt: serverTimestamp() });
    resetTemplateForm();
    showToast(id ? "範本已更新" : "範本已新增");
  } catch (error) { showToast(`範本儲存失敗：${error.message}`, true); }
});

$("#template-cancel-edit").addEventListener("click", resetTemplateForm);

$("#event-all-day").addEventListener("change", syncEventFormFields);
$("#event-repeat").addEventListener("change", syncEventFormFields);
$("#event-start-date").addEventListener("change", () => {
  if (!$("#event-end-date").value || $("#event-end-date").value < $("#event-start-date").value) $("#event-end-date").value = $("#event-start-date").value;
  syncEventFormFields();
});
$("#event-form").addEventListener("submit", async event => {
  event.preventDefault();
  if (!isAdmin()) return;
  const id = $("#event-id").value;
  const data = eventFormData();
  if (!data) return;
  try {
    if (id) await updateDoc(doc(db, "events", id), data);
    else await addDoc(collection(db, "events"), { ...data, createdAt: serverTimestamp() });
    closeDialog($("#event-dialog"));
    state.eventsCalendarDate = dateFromKey(data.startDate);
    showToast(id ? "行事曆活動已更新" : "行事曆活動已新增");
  } catch (error) { showToast(`活動儲存失敗：${error.message}`, true); }
});

$("#add-event-page").addEventListener("click", () => openEventEditor());
$("#events-prev-month").addEventListener("click", () => {
  state.eventsCalendarDate = new Date(state.eventsCalendarDate.getFullYear(), state.eventsCalendarDate.getMonth() - 1, 1, 12);
  renderEvents();
});
$("#events-next-month").addEventListener("click", () => {
  state.eventsCalendarDate = new Date(state.eventsCalendarDate.getFullYear(), state.eventsCalendarDate.getMonth() + 1, 1, 12);
  renderEvents();
});
$("#events-today").addEventListener("click", () => { state.eventsCalendarDate = dateFromKey(todayKey()); renderEvents(); });
document.querySelectorAll("[data-events-view]").forEach(button => button.addEventListener("click", () => {
  state.eventsView = button.dataset.eventsView;
  renderEvents();
}));
$("#export-events-ics").addEventListener("click", () => downloadEventsICS());
$("#events-zoom-out").addEventListener("click", () => setEventsZoom(eventsViewSettings[activeEventsZoomKey()] - 5));
$("#events-zoom-in").addEventListener("click", () => setEventsZoom(eventsViewSettings[activeEventsZoomKey()] + 5));
$("#events-fit").addEventListener("click", fitEventsWidth);
$("#events-reset-zoom").addEventListener("click", () => {
  const key = activeEventsZoomKey();
  eventsViewSettings[key] = EVENTS_VIEW_DEFAULTS[key];
  applyEventsViewSettings();
  saveEventsViewSettings();
  const viewport = state.eventsView === "list" ? $("#events-list-view") : $("#events-calendar-view");
  if (viewport) viewport.scrollLeft = 0;
  showToast(`${state.eventsView === "list" ? "列表" : "月曆"}縮放已還原`);
});
$("#events-fullscreen").addEventListener("click", toggleEventsFullscreen);
$("#export-events-csv").addEventListener("click", exportEventsCSV);
$("#import-events-csv").addEventListener("change", async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  try { await importEventsCSV(await file.text()); }
  catch (error) { showToast(`行事曆 CSV 匯入失敗：${error.message}`, true); }
  event.target.value = "";
});

function switchPage(page) {
  document.querySelectorAll("[data-page]").forEach(item => item.classList.toggle("active", item.dataset.page === page));
  $("#contact-page").classList.toggle("hidden", page !== "contact");
  $("#timetable-page").classList.toggle("hidden", page !== "timetable");
  $("#events-page").classList.toggle("hidden", page !== "events");
  if (page === "timetable") renderTimetable();
  if (page === "events") renderEvents();
}

function showContactBookDate(key) {
  state.selectedDate = key;
  state.calendarDate = dateFromKey(key);
  renderEntries();
  renderCalendar();
  switchPage("contact");
  $("#entries-title").scrollIntoView({ behavior: "smooth", block: "start" });
}

document.querySelectorAll("[data-page]").forEach(button => button.addEventListener("click", () => switchPage(button.dataset.page)));

$("#public-edit-timetable").addEventListener("click", openTimetableEditor);

document.querySelectorAll("[data-density]").forEach(button => button.addEventListener("click", () => {
  timetableView.density = button.dataset.density;
  applyTimetableViewSettings();
  saveTimetableView();
}));
$("#timetable-zoom-out").addEventListener("click", () => setTimetableZoom(timetableView.zoom - 5));
$("#timetable-zoom-in").addEventListener("click", () => setTimetableZoom(timetableView.zoom + 5));
$("#timetable-fit").addEventListener("click", fitTimetableWidth);
$("#timetable-reset-view").addEventListener("click", () => {
  Object.assign(timetableView, TIMETABLE_VIEW_DEFAULTS);
  applyTimetableViewSettings();
  saveTimetableView();
  $("#timetable-container").scrollLeft = 0;
  showToast("功課表顯示已還原");
});
$("#timetable-fullscreen").addEventListener("click", toggleTimetableFullscreen);
document.addEventListener("fullscreenchange", () => { updateFullscreenButton(); updateEventsFullscreenButton(); });
document.addEventListener("webkitfullscreenchange", () => { updateFullscreenButton(); updateEventsFullscreenButton(); });

$("#timetable-day-count").addEventListener("change", event => {
  const timetable = collectTimetableEditor();
  timetable.dayCount = Number(event.target.value);
  while (timetable.days.length < timetable.dayCount) timetable.days.push({ ...DEFAULT_DAYS[timetable.days.length] });
  timetable.days = timetable.days.slice(0, timetable.dayCount);
  timetable.cells = timetable.periods.map((_, rowIndex) => timetable.days.map((__, dayIndex) => ({
    subject: timetable.cells[rowIndex]?.[dayIndex]?.subject || "",
    teacher: timetable.cells[rowIndex]?.[dayIndex]?.teacher || ""
  })));
  state.timetableDraft = timetable;
  renderTimetableEditor();
});

$("#add-period").addEventListener("click", () => {
  const timetable = collectTimetableEditor();
  const number = timetable.periods.length + 1;
  timetable.periods.push({ label: `第 ${number} 節`, time: "" });
  timetable.cells.push(timetable.days.map(() => ({ subject: "", teacher: "" })));
  state.timetableDraft = timetable;
  renderTimetableEditor();
});

$("#remove-period").addEventListener("click", () => {
  const timetable = collectTimetableEditor();
  if (timetable.periods.length <= 1) return showToast("至少要保留一節", true);
  timetable.periods.pop();
  timetable.cells.pop();
  if (timetable.lunchAfter > timetable.periods.length) timetable.lunchAfter = 0;
  state.timetableDraft = timetable;
  renderTimetableEditor();
});

$("#export-timetable-csv").addEventListener("click", exportTimetableCSV);
$("#import-timetable-csv").addEventListener("change", async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  try { importTimetableCSV(await file.text()); }
  catch (error) { showToast(`CSV 匯入失敗：${error.message}`, true); }
  event.target.value = "";
});

$("#timetable-form").addEventListener("submit", async event => {
  event.preventDefault();
  if (!isAdmin()) return;
  const timetable = collectTimetableEditor();
  if (!timetable.title || timetable.days.some(day => !day.name) || timetable.periods.some(period => !period.label)) {
    return showToast("請填寫功課表標題、星期名稱與節次名稱", true);
  }
  try {
    await setDoc(doc(db, "timetables", "main"), { ...timetable, updatedAt: serverTimestamp() });
    closeDialog($("#timetable-dialog"));
    showToast("功課表已儲存並發布");
  } catch (error) { showToast(`功課表儲存失敗：${error.message}`, true); }
});

$("#link-form").addEventListener("submit", async event => {
  event.preventDefault();
  if (!isAdmin()) return;
  const id = $("#link-id").value;
  const url = safeUrl($("#link-url").value.trim());
  if (url === "#") return showToast("請輸入有效的 http 或 https 網址", true);
  const data = {
    title: $("#link-title").value.trim(), url,
    type: $("#link-type").value,
    expireDate: $("#link-expire-date").value,
    updatedAt: serverTimestamp()
  };
  try {
    if (id) await updateDoc(doc(db, "links", id), data);
    else await addDoc(collection(db, "links"), { ...data, createdAt: serverTimestamp() });
    closeDialog($("#link-dialog"));
    showToast(id ? "資源已更新" : "資源已新增");
  } catch (error) { showToast(`儲存失敗：${error.message}`, true); }
});

$("#tag-form").addEventListener("submit", async event => {
  event.preventDefault();
  if (!isAdmin()) return;
  const name = $("#tag-name").value.trim();
  if (state.tags.some(tag => tag.name === name)) return showToast("標籤名稱已存在", true);
  try {
    await addDoc(collection(db, "tags"), { name, color: $("#tag-color").value, createdAt: serverTimestamp() });
    $("#tag-name").value = "";
    showToast("標籤已新增");
  } catch (error) { showToast(`新增失敗：${error.message}`, true); }
});

$("#settings-form").addEventListener("submit", async event => {
  event.preventDefault();
  if (!isAdmin()) return;
  try {
    await setDoc(doc(db, "settings", "main"), {
      title: $("#settings-title").value.trim(),
      subtitle: $("#settings-subtitle").value.trim(),
      updatedAt: serverTimestamp()
    }, { merge: true });
    closeDialog($("#settings-dialog"));
    showToast("網站設定已儲存");
  } catch (error) { showToast(`設定儲存失敗：${error.message}`, true); }
});

$("#prev-month").addEventListener("click", () => { state.calendarDate = new Date(state.calendarDate.getFullYear(), state.calendarDate.getMonth() - 1, 1); renderCalendar(); });
$("#next-month").addEventListener("click", () => { state.calendarDate = new Date(state.calendarDate.getFullYear(), state.calendarDate.getMonth() + 1, 1); renderCalendar(); });
$("#clear-filter").addEventListener("click", () => { state.selectedDate = null; renderEntries(); renderCalendar(); });
document.querySelectorAll("[data-entry-filter]").forEach(button => button.addEventListener("click", () => {
  if (!isAdmin()) return;
  state.entryFilter = button.dataset.entryFilter;
  state.selectedDate = null;
  renderEntries();
  renderCalendar();
}));

onAuthStateChanged(auth, user => {
  state.user = user;
  if (!isAdmin()) state.entryFilter = "all";
  renderHeader(); renderEntries(); renderResources(); renderAnnouncements(); renderTimetable(); renderEvents(); subscribeDrafts();
});

renderHeader();
renderCalendar();
renderTimetable();
renderEvents();
subscribeData();
setInterval(() => {
  renderEntries();
  renderCalendar();
  renderAnnouncements();
  renderEventAlerts();
}, 60000);
