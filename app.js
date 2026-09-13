import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  getFirestore, collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp
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

const state = {
  user: null,
  entries: [],
  links: [],
  tags: [],
  settings: { title: "台中市清水國小 一年戊班 電子聯絡簿", subtitle: "115 學年度" },
  selectedDate: todayKey(),
  calendarDate: new Date()
};

const $ = (selector) => document.querySelector(selector);
const isAdmin = () => state.user?.uid === ADMIN_UID;

function todayKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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

function safeUrl(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : "#";
  } catch { return "#"; }
}

function openDialog(id) {
  const dialog = document.getElementById(id);
  if (dialog && !dialog.open) dialog.showModal();
}

function closeDialog(dialog) {
  if (dialog?.open) dialog.close();
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

function makeActions(onEdit, onDelete) {
  const actions = document.createElement("div");
  actions.className = "card-actions";
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

function renderEntries() {
  const container = $("#entry-list");
  const entries = state.selectedDate ? state.entries.filter(item => item.date === state.selectedDate) : state.entries;
  $("#filter-label").textContent = state.selectedDate ? `篩選日期：${formatDate(state.selectedDate)}` : "顯示全部聯絡簿";
  $("#clear-filter").classList.toggle("hidden", !state.selectedDate);
  container.replaceChildren();
  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "沒有符合的聯絡簿資料";
    container.append(empty);
    return;
  }
  entries.forEach(entry => {
    const card = document.createElement("article");
    card.className = "entry-card";
    const date = document.createElement("p");
    date.className = "entry-date";
    date.textContent = formatDate(entry.date);
    const content = document.createElement("p");
    content.className = "entry-content";
    content.textContent = entry.content;
    card.append(date, content);
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
    if (isAdmin()) card.append(makeActions(() => editEntry(entry.id), () => removeDoc("entries", entry.id, "聯絡簿")));
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
    button.classList.toggle("has-entry", state.entries.some(entry => entry.date === key));
    button.addEventListener("click", () => {
      state.selectedDate = key;
      renderCalendar();
      renderEntries();
    });
    grid.append(button);
  }
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

function editEntry(id) {
  const entry = state.entries.find(item => item.id === id);
  if (!entry) return;
  $("#entry-dialog-title").textContent = "修改聯絡簿";
  $("#entry-id").value = id;
  $("#entry-date").value = entry.date;
  $("#entry-content").value = entry.content;
  document.querySelectorAll('input[name="entry-tags"]').forEach(input => { input.checked = (entry.tags || []).includes(input.value); });
  openDialog("entry-dialog");
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
    renderEntries(); renderCalendar();
  }, error => showToast(`聯絡簿載入失敗：${error.message}`, true));

  onSnapshot(query(collection(db, "links"), orderBy("title")), snapshot => {
    state.links = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    renderResources();
  }, error => showToast(`資源載入失敗：${error.message}`, true));

  onSnapshot(query(collection(db, "tags"), orderBy("name")), snapshot => {
    state.tags = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    renderTags(); renderEntries();
  }, error => showToast(`標籤載入失敗：${error.message}`, true));

  onSnapshot(doc(db, "settings", "main"), snapshot => {
    if (snapshot.exists()) state.settings = { ...state.settings, ...snapshot.data() };
    renderHeader();
  }, error => showToast(`設定載入失敗：${error.message}`, true));
}

document.querySelectorAll("[data-open]").forEach(button => button.addEventListener("click", () => {
  if (!isAdmin()) return;
  const id = button.dataset.open;
  if (id === "entry-dialog") {
    $("#entry-form").reset();
    $("#entry-id").value = "";
    $("#entry-date").value = state.selectedDate || todayKey();
    $("#entry-dialog-title").textContent = "新增聯絡簿";
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

$("#entry-form").addEventListener("submit", async event => {
  event.preventDefault();
  if (!isAdmin()) return;
  const id = $("#entry-id").value;
  const data = {
    date: $("#entry-date").value,
    content: $("#entry-content").value.trim(),
    tags: [...document.querySelectorAll('input[name="entry-tags"]:checked')].map(input => input.value),
    updatedAt: serverTimestamp()
  };
  try {
    if (id) await updateDoc(doc(db, "entries", id), data);
    else await addDoc(collection(db, "entries"), { ...data, createdAt: serverTimestamp() });
    closeDialog($("#entry-dialog"));
    showToast(id ? "聯絡簿已更新" : "聯絡簿已新增");
  } catch (error) { showToast(`儲存失敗：${error.message}`, true); }
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

onAuthStateChanged(auth, user => {
  state.user = user;
  renderHeader(); renderEntries(); renderResources();
});

renderHeader();
renderCalendar();
subscribeData();
