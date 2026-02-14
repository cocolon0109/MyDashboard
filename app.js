const STORAGE_KEY = "dashboard_data_v2";
const SETTINGS_KEY = "dashboard_settings_v2";

const emptyState = {
  events: [],
  todos: [],
  shopping: [],
  trains: [],
  notifications: [],
  newsCache: {},
  _lastTodoDaily: "",
};

const emptySettings = {
  notifyEvents: true,
  notifyTodos: true,
  dndStart: "22:30",
  dndEnd: "07:00",
  todoDaily: "20:00",
  odptKey: "",
};

const state = loadState();
const settings = loadSettings();

const el = {
  datetime: document.getElementById("datetime"),
  eventForm: document.getElementById("event-form"),
  eventList: document.getElementById("event-list"),
  todoForm: document.getElementById("todo-form"),
  todoList: document.getElementById("todo-list"),
  shoppingForm: document.getElementById("shopping-form"),
  shoppingList: document.getElementById("shopping-list"),
  todaySummary: document.getElementById("today-summary"),
  weatherLocation: document.getElementById("weather-location"),
  weatherForecast: document.getElementById("weather-forecast"),
  newsList: document.getElementById("news-list"),
  newsCategory: document.getElementById("news-category"),
  newsRefresh: document.getElementById("news-refresh"),
  notificationBtn: document.getElementById("notification-btn"),
  settingsToggle: document.getElementById("settings-toggle"),
  settingsPanel: document.getElementById("settings-panel"),
  banner: document.getElementById("in-app-banner"),
  saveSettings: document.getElementById("save-settings"),
  notifyEvents: document.getElementById("notify-events"),
  notifyTodos: document.getElementById("notify-todos"),
  dndStart: document.getElementById("dnd-start"),
  dndEnd: document.getElementById("dnd-end"),
  todoDaily: document.getElementById("todo-daily"),
  odptKey: document.getElementById("odpt-key"),
  trainForm: document.getElementById("train-form"),
  trainList: document.getElementById("train-list"),
};

init();

function init() {
  bindForms();
  bindSettings();
  tickClock();
  renderAll();
  refreshTrainTimes();
  requestWeather();
  loadNews();
  setInterval(tickClock, 1000);
  setInterval(notificationLoop, 30000);
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js");
  }
}

function bindForms() {
  el.eventForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const title = document.getElementById("event-title").value.trim();
    const allDay = document.getElementById("event-all-day").checked;
    const date = document.getElementById("event-date").value;
    const datetime = document.getElementById("event-datetime").value;
    const repeat = document.getElementById("event-repeat").value;
    if (!title || !date) return;
    state.events.push({ id: uid(), title, allDay, date, datetime, repeat, doneNotifyAt: [] });
    saveState();
    el.eventForm.reset();
    renderAll();
  });

  el.todoForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const title = document.getElementById("todo-title").value.trim();
    const deadline = document.getElementById("todo-deadline").value;
    const priority = document.getElementById("todo-priority").value;
    if (!title) return;
    state.todos.push({ id: uid(), title, deadline, priority, done: false, doneNotifyAt: [] });
    saveState();
    el.todoForm.reset();
    renderAll();
  });

  el.shoppingForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const title = document.getElementById("shopping-title").value.trim();
    if (!title) return;
    state.shopping.push({ id: uid(), title, done: false });
    saveState();
    el.shoppingForm.reset();
    renderAll();
  });

  el.newsRefresh.addEventListener("click", () => loadNews(true));
  el.newsCategory.addEventListener("change", () => loadNews(false));

  el.notificationBtn.addEventListener("click", async () => {
    if (!("Notification" in window)) return alert("通知非対応ブラウザです");
    const p = await Notification.requestPermission();
    showBanner(`通知権限: ${p}`);
  });

  el.settingsToggle.addEventListener("click", () => {
    el.settingsPanel.classList.toggle("hidden");
  });

  el.trainForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const station = document.getElementById("train-station").value.trim();
    const operator = document.getElementById("train-operator").value.trim();
    const direction = document.getElementById("train-direction").value.trim();
    if (!station || !operator || !direction) return;
    state.trains.push({ id: uid(), station, operator, direction, next: [], status: "未取得" });
    saveState();
    el.trainForm.reset();
    renderTrains();
    refreshTrainTimes();
  });
}

function bindSettings() {
  el.notifyEvents.checked = settings.notifyEvents;
  el.notifyTodos.checked = settings.notifyTodos;
  el.dndStart.value = settings.dndStart;
  el.dndEnd.value = settings.dndEnd;
  el.todoDaily.value = settings.todoDaily;
  el.odptKey.value = settings.odptKey;

  el.saveSettings.addEventListener("click", () => {
    settings.notifyEvents = el.notifyEvents.checked;
    settings.notifyTodos = el.notifyTodos.checked;
    settings.dndStart = el.dndStart.value;
    settings.dndEnd = el.dndEnd.value;
    settings.todoDaily = el.todoDaily.value;
    settings.odptKey = el.odptKey.value.trim();
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    showBanner("設定を保存しました");
    refreshTrainTimes();
  });
}

function tickClock() {
  const now = new Date();
  el.datetime.textContent = `${fmtDate(now)} ${fmtTime(now)}`;
}

function renderAll() {
  renderEvents();
  renderTodos();
  renderShopping();
  renderTodaySummary();
  renderTrains();
}

function renderEvents() {
  el.eventList.innerHTML = "";
  const items = [...state.events].sort((a, b) => eventTimestamp(a) - eventTimestamp(b));
  for (const ev of items) {
    const div = document.createElement("div");
    div.className = "item";
    const timeLabel = ev.allDay ? `${ev.date} (終日)` : (ev.datetime || ev.date);
    const repeatLabel = ev.repeat !== "none" ? ` / ${repeatText(ev.repeat)}` : "";
    div.innerHTML = `<div><div>${escapeHtml(ev.title)}</div><div class="item-meta">${timeLabel}${repeatLabel}</div></div>`;
    const actions = document.createElement("div");
    actions.className = "item-actions";
    actions.append(
      btn("編集", () => editEvent(ev.id)),
      btn("削除", () => {
        state.events = state.events.filter((x) => x.id !== ev.id);
        saveState();
        renderAll();
      })
    );
    div.append(actions);
    el.eventList.append(div);
  }
}

function renderTodos() {
  el.todoList.innerHTML = "";
  const items = [...state.todos].sort((a, b) => prioOrder(a.priority) - prioOrder(b.priority));
  for (const td of items) {
    const div = document.createElement("div");
    div.className = "item";
    const cls = td.done ? "done" : "";
    div.innerHTML = `<div class="${cls}"><div>${escapeHtml(td.title)}</div><div class="item-meta prio-${td.priority}">優先度: ${prioText(td.priority)} ${td.deadline ? ` / 期限: ${td.deadline}` : ""}</div></div>`;
    const actions = document.createElement("div");
    actions.className = "item-actions";
    actions.append(
      btn("編集", () => editTodo(td.id)),
      btn(td.done ? "未完了" : "完了", () => {
        td.done = !td.done;
        saveState();
        renderAll();
      }),
      btn("削除", () => {
        state.todos = state.todos.filter((x) => x.id !== td.id);
        saveState();
        renderAll();
      })
    );
    div.append(actions);
    el.todoList.append(div);
  }
}

function renderShopping() {
  el.shoppingList.innerHTML = "";
  for (const sp of state.shopping) {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `<div class="${sp.done ? "done" : ""}">${escapeHtml(sp.title)}</div>`;
    const actions = document.createElement("div");
    actions.className = "item-actions";
    actions.append(
      btn("編集", () => editShopping(sp.id)),
      btn(sp.done ? "未購入" : "購入済", () => {
        sp.done = !sp.done;
        saveState();
        renderAll();
      }),
      btn("削除", () => {
        state.shopping = state.shopping.filter((x) => x.id !== sp.id);
        saveState();
        renderAll();
      })
    );
    div.append(actions);
    el.shoppingList.append(div);
  }
}

function renderTodaySummary() {
  const today = new Date().toISOString().slice(0, 10);
  const todayEvents = state.events.filter((e) => isEventOnDate(e, today));
  const todayTodos = state.todos.filter((t) => t.deadline?.startsWith(today) && !t.done);
  const shoppingOpen = state.shopping.filter((s) => !s.done);

  el.todaySummary.innerHTML = [
    `<div class="item-meta">予定: ${todayEvents.length}件</div>`,
    `<div class="item-meta">期限TODO: ${todayTodos.length}件</div>`,
    `<div class="item-meta">未購入: ${shoppingOpen.length}件</div>`,
  ].join("");
}

function renderTrains() {
  el.trainList.innerHTML = "";
  for (const t of state.trains) {
    const next = t.next?.length ? t.next.join(" / ") : "-";
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `<div><div>${escapeHtml(t.station)} / ${escapeHtml(t.operator)} / ${escapeHtml(t.direction)}</div><div class="item-meta">次: ${escapeHtml(next)}${t.status ? ` / ${escapeHtml(t.status)}` : ""}</div></div>`;
    const actions = document.createElement("div");
    actions.className = "item-actions";
    actions.append(
      btn("更新", () => refreshTrainTimes(t.id)),
      btn("編集", () => editTrain(t.id)),
      btn("削除", () => {
        state.trains = state.trains.filter((x) => x.id !== t.id);
        saveState();
        renderTrains();
      })
    );
    div.append(actions);
    el.trainList.append(div);
  }
}

async function refreshTrainTimes(onlyId) {
  for (const t of state.trains) {
    if (onlyId && t.id !== onlyId) continue;
    const result = await loadOdptNextTrains(t);
    t.next = result.next;
    t.status = result.status;
  }
  saveState();
  renderTrains();
}

async function loadOdptNextTrains(trainEntry) {
  if (!settings.odptKey) {
    return { next: nextTrainSamples(), status: "ODPTキー未設定のためサンプル" };
  }

  try {
    const station = await resolveStation(trainEntry.station, trainEntry.operator, settings.odptKey);
    if (!station?.sameAs) {
      return { next: nextTrainSamples(), status: "駅解決失敗（サンプル表示）" };
    }

    const railDirection = await resolveRailDirection(trainEntry.direction, trainEntry.operator, settings.odptKey);

    const params = new URLSearchParams();
    params.set("acl:consumerKey", settings.odptKey);
    params.set("odpt:station", station.sameAs);
    if (station.railway) params.set("odpt:railway", station.railway);
    if (railDirection) params.set("odpt:railDirection", railDirection);

    const url = `https://api.odpt.org/api/v4/odpt:StationTimetable?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("ODPT timetable fetch failed");
    const data = await res.json();

    const next = extractNextDepartures(data);
    if (!next.length) return { next: nextTrainSamples(), status: "時刻表未取得（サンプル表示）" };
    return { next, status: "ODPT" };
  } catch {
    return { next: nextTrainSamples(), status: "ODPT取得失敗（サンプル表示）" };
  }
}

async function resolveStation(stationTitle, operatorTitle, key) {
  const params = new URLSearchParams();
  params.set("acl:consumerKey", key);
  params.set("dc:title", stationTitle);

  const url = `https://api.odpt.org/api/v4/odpt:Station?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();

  let pick = data[0] || null;
  if (!pick) return null;

  if (operatorTitle) {
    const byOperator = data.find((x) => (x["odpt:operatorTitle"]?.ja || "").includes(operatorTitle) || (x["odpt:operator"] || "").includes(operatorTitle));
    if (byOperator) pick = byOperator;
  }

  return {
    sameAs: pick["owl:sameAs"] || "",
    railway: pick["odpt:railway"] || "",
  };
}

async function resolveRailDirection(directionTitle, operatorTitle, key) {
  const params = new URLSearchParams();
  params.set("acl:consumerKey", key);
  params.set("dc:title", directionTitle);
  const url = `https://api.odpt.org/api/v4/odpt:RailDirection?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) return "";
  const data = await res.json();
  if (!data.length) return "";

  let pick = data[0];
  if (operatorTitle) {
    const byOperator = data.find((x) => (x["odpt:operatorTitle"]?.ja || "").includes(operatorTitle) || (x["odpt:operator"] || "").includes(operatorTitle));
    if (byOperator) pick = byOperator;
  }
  return pick["owl:sameAs"] || "";
}

function extractNextDepartures(timetables) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const departureMinutes = [];

  for (const table of timetables || []) {
    const rows = table["odpt:stationTimetableObject"] || [];
    for (const row of rows) {
      const dep = row["odpt:departureTime"];
      if (!dep || !/^\d{2}:\d{2}$/.test(dep)) continue;
      const [h, m] = dep.split(":").map(Number);
      const when = new Date(`${today}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`);
      if (when >= now) departureMinutes.push(when.getTime());
    }
  }

  departureMinutes.sort((a, b) => a - b);
  return departureMinutes.slice(0, 3).map((t) => fmtTime(new Date(t)).slice(0, 5));
}

async function requestWeather() {
  if (!navigator.geolocation) {
    el.weatherLocation.textContent = "位置情報未対応";
    return;
  }
  navigator.geolocation.getCurrentPosition(async (pos) => {
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;

    try {
      const rev = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=ja`);
      const revJson = await rev.json();
      el.weatherLocation.textContent = `${revJson.city || revJson.locality || "現在地"}`;
    } catch {
      el.weatherLocation.textContent = "現在地";
    }

    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto`;
      const res = await fetch(url);
      const data = await res.json();
      const days = data.daily.time.slice(0, 3);
      el.weatherForecast.innerHTML = "";
      for (let i = 0; i < days.length; i++) {
        const item = document.createElement("div");
        item.className = "item";
        item.innerHTML = `<div>${days[i]}</div><div class="item-meta">${data.daily.temperature_2m_min[i]}-${data.daily.temperature_2m_max[i]}C / 降水${data.daily.precipitation_probability_max[i]}%</div>`;
        el.weatherForecast.append(item);
      }
    } catch {
      el.weatherForecast.innerHTML = `<div class="item-meta">天気取得に失敗しました</div>`;
    }
  }, () => {
    el.weatherLocation.textContent = "位置情報が許可されていません";
  });
}

async function loadNews(force = false) {
  const category = el.newsCategory.value;
  if (!force && state.newsCache[category]?.length) {
    renderNewsItems(state.newsCache[category], true);
  }

  const feeds = {
    top: "https://www3.nhk.or.jp/rss/news/cat0.xml",
    business: "https://www3.nhk.or.jp/rss/news/cat5.xml",
    it: "https://www3.nhk.or.jp/rss/news/cat3.xml",
  };
  const rssUrl = feeds[category];

  try {
    const xmlText = await fetchRssWithFallbacks(rssUrl);
    const items = parseRss(xmlText).slice(0, 6);
    if (!items.length) throw new Error("empty rss");
    state.newsCache[category] = items;
    saveState();
    renderNewsItems(items, false);
  } catch {
    if (state.newsCache[category]?.length) {
      renderNewsItems(state.newsCache[category], true);
      showBanner("ニュース取得失敗のためキャッシュを表示");
    } else {
      el.newsList.innerHTML = `<div class="item-meta">ニュース取得に失敗しました</div>`;
    }
  }
}

async function fetchRssWithFallbacks(rssUrl) {
  const urls = [
    rssUrl,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(rssUrl)}`,
    `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(rssUrl)}`,
  ];

  let lastErr = null;
  for (const u of urls) {
    try {
      const res = await fetch(u, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const txt = await res.text();
      if (txt.includes("<rss") || txt.includes("<feed")) return txt;
      throw new Error("not rss xml");
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error("rss fetch failed");
}

function parseRss(xmlText) {
  const xml = new DOMParser().parseFromString(xmlText, "text/xml");
  const items = [...xml.querySelectorAll("item")];
  return items.map((it) => ({
    title: it.querySelector("title")?.textContent || "no title",
    link: it.querySelector("link")?.textContent || "#",
    pubDate: it.querySelector("pubDate")?.textContent || "",
  }));
}

function renderNewsItems(items, cached) {
  el.newsList.innerHTML = "";
  if (cached) {
    const meta = document.createElement("div");
    meta.className = "item-meta";
    meta.textContent = "キャッシュ表示";
    el.newsList.append(meta);
  }
  for (const it of items) {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `<div><a href="${it.link}" target="_blank" rel="noreferrer">${escapeHtml(it.title)}</a><div class="item-meta">${escapeHtml(it.pubDate)}</div></div>`;
    el.newsList.append(div);
  }
}

function notificationLoop() {
  const now = new Date();
  if (isDnd(now, settings)) return;

  if (settings.notifyEvents) {
    for (const ev of state.events) {
      const due = nextOccurrence(ev, now);
      if (!due) continue;
      const mins = Math.round((due - now) / 60000);
      if ((mins === 10 || mins === 0) && !ev.doneNotifyAt.includes(`${due.toISOString()}_${mins}`)) {
        notify(`予定: ${ev.title}`, mins === 0 ? "開始時刻です" : `${mins}分後に開始`);
        ev.doneNotifyAt.push(`${due.toISOString()}_${mins}`);
      }
    }
  }

  if (settings.notifyTodos) {
    for (const td of state.todos) {
      if (td.done || !td.deadline) continue;
      const due = new Date(td.deadline);
      const mins = Math.round((due - now) / 60000);
      if ((mins === 10 || mins === 0) && !td.doneNotifyAt.includes(`${due.toISOString()}_${mins}`)) {
        notify(`TODO: ${td.title}`, mins === 0 ? "期限時刻です" : `${mins}分後に期限`);
        td.doneNotifyAt.push(`${due.toISOString()}_${mins}`);
      }
    }

    const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    if (hhmm === settings.todoDaily && state._lastTodoDaily !== now.toDateString()) {
      const cnt = state.todos.filter((t) => !t.done).length;
      if (cnt > 0) notify("TODOリマインド", `未完了タスク ${cnt}件`);
      state._lastTodoDaily = now.toDateString();
    }
  }

  trimNotificationHistory();
  saveState();
}

function notify(title, body) {
  const stamp = new Date().toISOString();
  state.notifications.unshift({ title, body, stamp });
  showBanner(`${title}: ${body}`);
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body });
  }
}

function trimNotificationHistory() {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  state.notifications = state.notifications.filter((n) => new Date(n.stamp).getTime() >= cutoff);
}

function showBanner(text) {
  el.banner.textContent = text;
  el.banner.classList.remove("hidden");
  setTimeout(() => el.banner.classList.add("hidden"), 3500);
}

function editEvent(id) {
  const ev = state.events.find((x) => x.id === id);
  if (!ev) return;
  const title = prompt("予定タイトル", ev.title);
  if (title === null) return;
  const date = prompt("日付 (YYYY-MM-DD)", ev.date) || ev.date;
  const datetime = prompt("日時 (YYYY-MM-DDTHH:mm) 終日の場合空で可", ev.datetime || "");
  const repeat = prompt("繰り返し (none/daily/weekly/monthly)", ev.repeat) || ev.repeat;

  ev.title = title.trim() || ev.title;
  ev.date = date;
  ev.datetime = datetime;
  ev.allDay = !datetime;
  ev.repeat = ["none", "daily", "weekly", "monthly"].includes(repeat) ? repeat : ev.repeat;
  saveState();
  renderAll();
}

function editTodo(id) {
  const td = state.todos.find((x) => x.id === id);
  if (!td) return;
  const title = prompt("タスク", td.title);
  if (title === null) return;
  const deadline = prompt("期限 (YYYY-MM-DDTHH:mm) 空可", td.deadline || "");
  const priority = prompt("優先度 (high/medium/low)", td.priority) || td.priority;

  td.title = title.trim() || td.title;
  td.deadline = deadline || "";
  td.priority = ["high", "medium", "low"].includes(priority) ? priority : td.priority;
  saveState();
  renderAll();
}

function editShopping(id) {
  const sp = state.shopping.find((x) => x.id === id);
  if (!sp) return;
  const title = prompt("買うもの", sp.title);
  if (title === null) return;
  sp.title = title.trim() || sp.title;
  saveState();
  renderAll();
}

function editTrain(id) {
  const t = state.trains.find((x) => x.id === id);
  if (!t) return;
  const station = prompt("駅名", t.station);
  if (station === null) return;
  const operator = prompt("鉄道会社", t.operator) || t.operator;
  const direction = prompt("方面", t.direction) || t.direction;

  t.station = station.trim() || t.station;
  t.operator = operator.trim() || t.operator;
  t.direction = direction.trim() || t.direction;
  saveState();
  renderTrains();
  refreshTrainTimes(id);
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return cloneDefaults(emptyState);
  try {
    return { ...cloneDefaults(emptyState), ...JSON.parse(raw) };
  } catch {
    return cloneDefaults(emptyState);
  }
}

function loadSettings() {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) return cloneDefaults(emptySettings);
  try {
    return { ...cloneDefaults(emptySettings), ...JSON.parse(raw) };
  } catch {
    return cloneDefaults(emptySettings);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function isDnd(now, conf) {
  const n = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = conf.dndStart.split(":").map(Number);
  const [eh, em] = conf.dndEnd.split(":").map(Number);
  const s = sh * 60 + sm;
  const e = eh * 60 + em;
  if (s < e) return n >= s && n < e;
  return n >= s || n < e;
}

function nextOccurrence(ev, now) {
  let base;
  if (ev.allDay) {
    base = new Date(`${ev.date}T09:00:00`);
  } else {
    base = new Date(ev.datetime || `${ev.date}T09:00:00`);
  }
  if (ev.repeat === "none") return base;

  const d = new Date(base);
  while (d < new Date(now.getTime() - 60000)) {
    if (ev.repeat === "daily") d.setDate(d.getDate() + 1);
    if (ev.repeat === "weekly") d.setDate(d.getDate() + 7);
    if (ev.repeat === "monthly") d.setMonth(d.getMonth() + 1);
  }
  return d;
}

function isEventOnDate(ev, ymd) {
  if (ev.repeat === "none") return ev.date === ymd;
  const date = new Date(`${ymd}T00:00:00`);
  const base = new Date(`${ev.date}T00:00:00`);
  const diff = Math.floor((date - base) / 86400000);
  if (diff < 0) return false;
  if (ev.repeat === "daily") return true;
  if (ev.repeat === "weekly") return diff % 7 === 0;
  if (ev.repeat === "monthly") return date.getDate() === base.getDate();
  return false;
}

function eventTimestamp(ev) {
  if (ev.allDay) return new Date(`${ev.date}T00:00:00`).getTime();
  if (ev.datetime) return new Date(ev.datetime).getTime();
  return new Date(`${ev.date}T09:00:00`).getTime();
}

function nextTrainSamples() {
  const now = new Date();
  const out = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(now.getTime() + i * 7 * 60000);
    out.push(fmtTime(d).slice(0, 5));
  }
  return out;
}

function btn(label, onClick) {
  const b = document.createElement("button");
  b.className = "btn";
  b.textContent = label;
  b.type = "button";
  b.addEventListener("click", onClick);
  return b;
}

function uid() { return Math.random().toString(36).slice(2, 10); }
function prioText(p) { return p === "high" ? "高" : p === "medium" ? "中" : "低"; }
function prioOrder(p) { return p === "high" ? 0 : p === "medium" ? 1 : 2; }
function repeatText(v) { return v === "daily" ? "毎日" : v === "weekly" ? "毎週" : v === "monthly" ? "毎月" : "なし"; }
function fmtDate(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function fmtTime(d) { return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}:${String(d.getSeconds()).padStart(2,"0")}`; }
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }
function cloneDefaults(v) { return JSON.parse(JSON.stringify(v)); }
