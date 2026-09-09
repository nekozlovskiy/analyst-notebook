/* ============================================================
   Тетрадь аналитика — вся логика курса.

   Одностраничное приложение с маршрутизацией по хэшу:
     #        — карта курса
     #m1l1    — урок
   Благодаря этому весь курс умещается в один html-файл
   и работает при открытии двойным кликом.
   ============================================================ */

(function () {
"use strict";

/* ---------- CDN ---------- */
const CDN = {
  cmBase:  "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/",
  sqlBase: "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/",
  pyBase:  "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/",
  mathjax: "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"
};

/* ============================================================
   Хранилище прогресса

   Обычный режим — localStorage. Проверено: работает при открытии
   файла двойным кликом и в Safari, и в Chrome.

   Аварийный режим включается сам, если браузер всё-таки запретил
   хранение — приватное окно, жёсткие настройки приватности,
   переполненная квота. Тогда прогресс живёт в памяти вкладки,
   появляется плашка и возможность выгрузить прогресс в файл.
   ============================================================ */

const Store = (function () {
  const KEY = "da.state.v1";
  const EMPTY = { theme: {}, done: {}, code: {}, notes: {}, attempts: {}, time: {}, seen: {} };

  let mode = "local";
  let dirty = false;              /* есть несохранённые изменения (аварийный режим) */
  const listeners = [];

  try {
    localStorage.setItem("da.probe", "1");
    localStorage.removeItem("da.probe");
  } catch (e) { mode = "memory"; }

  function blank() { return JSON.parse(JSON.stringify(EMPTY)); }

  /* Прогресс лежит под ключом версии. Если ключ когда-нибудь сменится,
     занятия не должны обнулиться: при отсутствии текущего ключа ищем
     любой прежний da.state.* и забираем прогресс оттуда.            */
  function inherited() {
    let best = null;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || k === KEY || k.indexOf("da.state.") !== 0) continue;
      try {
        const v = JSON.parse(localStorage.getItem(k));
        if (v && v.done) best = v;
      } catch (e) { /* чужой или битый ключ — просто пропускаем */ }
    }
    return best;
  }

  let state = (function () {
    if (mode === "memory") return blank();
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return Object.assign(blank(), JSON.parse(raw));
      const old = inherited();
      return old ? Object.assign(blank(), old) : blank();
    } catch (e) { return blank(); }
  })();

  let timer = null;
  function notify() { listeners.forEach(function (f) { f(); }); }

  function flush() {
    if (mode !== "local") return;
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { mode = "memory"; dirty = true; notify(); }
  }

  return {
    mode: function () { return mode; },
    isDirty: function () { return dirty; },
    markSaved: function () { dirty = false; notify(); },
    onChange: function (f) { listeners.push(f); },

    all: function () { return state; },
    get: function (bucket, id, dflt) {
      const b = state[bucket];
      return b && b[id] !== undefined ? b[id] : dflt;
    },
    set: function (bucket, id, val) {
      if (!state[bucket]) state[bucket] = {};
      state[bucket][id] = val;
      if (mode === "memory") { dirty = true; notify(); }
      else { clearTimeout(timer); timer = setTimeout(flush, 220); }
    },
    replace: function (next) {
      state = Object.assign(blank(), next || {});
      if (mode === "memory") { dirty = false; notify(); } else flush();
    },

    /* Перенос прогресса не должен ничего отменять: пройденное
       объединяем, время и попытки берём большие, а код и заметки
       из файла кладём только туда, где здесь пусто — набранное
       в этой копии всегда важнее принесённого.                  */
    merge: function (next) {
      if (!next || typeof next !== "object") return 0;
      let added = 0;
      ["done", "attempts", "time"].forEach(function (b) {
        const src = next[b] || {};
        Object.keys(src).forEach(function (id) {
          const cur = state[b][id];
          if (cur === undefined) {
            state[b][id] = src[id];
            if (b === "done") added++;
          } else if (typeof src[id] === "number" && typeof cur === "number" && src[id] > cur) {
            state[b][id] = src[id];
          }
        });
      });
      ["code", "notes", "seen"].forEach(function (b) {
        const src = next[b] || {};
        Object.keys(src).forEach(function (id) {
          const cur = state[b][id];
          if (cur === undefined || cur === null || cur === "") state[b][id] = src[id];
        });
      });
      if (mode === "memory") { dirty = true; notify(); } else flush();
      return added;
    },
    flush: flush
  };
})();

/* ============================================================
   Курс
   ============================================================ */

const Course = (function () {
  const C = window.COURSE;
  const flat = [];
  C.modules.forEach(function (m) {
    m.lessons.forEach(function (l, i) {
      l.module = m;
      l.num = m.num + "." + (i + 1);
      flat.push(l);
    });
  });
  const readyList = flat.filter(function (l) { return l.ready; });

  const api = {
    data: C,
    flat: flat,
    ready: readyList,
    byId: function (id) { return flat.filter(function (l) { return l.id === id; })[0] || null; },
    isDone: function (id) { return !!Store.get("done", id, false); },
    doneCount: function (list) {
      return list.filter(function (l) { return api.isDone(l.id); }).length;
    },
    neighbour: function (id, dir) {
      const i = readyList.findIndex(function (l) { return l.id === id; });
      if (i < 0) return null;
      return readyList[i + dir] || null;
    }
  };
  return api;
})();

/* ============================================================
   Утилиты
   ============================================================ */

function $(sel, root) { return (root || document).querySelector(sel); }
function el(tag, attrs, html) {
  const n = document.createElement(tag);
  if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
  if (html !== undefined) n.innerHTML = html;
  return n;
}
function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
                  .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}
/* Перемешанные индексы 0..n-1 — тасовка Фишера-Йейтса. */
function shuffled(n) {
  const a = [];
  for (let i = 0; i < n; i++) a.push(i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function loadScript(src) {
  return new Promise(function (res, rej) {
    const found = document.querySelector('script[data-src="' + src + '"]');
    if (found) {
      if (found.dataset.loaded === "1") { res(); return; }
      found.addEventListener("load", function () { res(); });
      found.addEventListener("error", function () { rej(new Error(src)); });
      return;
    }
    const s = document.createElement("script");
    s.src = src; s.async = true; s.dataset.src = src;
    s.onload = function () { s.dataset.loaded = "1"; res(); };
    s.onerror = function () { rej(new Error("Не удалось загрузить " + src)); };
    document.head.appendChild(s);
  });
}
function loadCSS(href) {
  if (document.querySelector('link[href="' + href + '"]')) return;
  const l = document.createElement("link");
  l.rel = "stylesheet"; l.href = href;
  document.head.appendChild(l);
}

/* ============================================================
   Тема
   ============================================================ */

const Theme = {
  current: function () { return document.documentElement.getAttribute("data-theme") || "light"; },
  init: function () { Theme.apply(Store.get("theme", "v", null) || "light"); },
  apply: function (t) {
    document.documentElement.setAttribute("data-theme", t);
    const b = $("#themeBtn");
    if (b) {
      b.innerHTML = (t === "dark" ? ICON.sun : ICON.moon) +
        "<span>" + (t === "dark" ? "Светлая" : "Тёмная") + "</span>";
      b.setAttribute("aria-label", "Переключить на " + (t === "dark" ? "светлую" : "тёмную") + " тему");
      b.setAttribute("title", "Переключить тему");
    }
  },
  toggle: function () {
    const next = Theme.current() === "dark" ? "light" : "dark";
    Store.set("theme", "v", next);
    Theme.apply(next);
  }
};

/* ============================================================
   Прогресс: файл, загрузка, сброс
   ============================================================ */

const Progress = {
  save: function () {
    const blob = new Blob([JSON.stringify(Store.all(), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "прогресс-курса-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
    Store.markSaved();
    Progress.toast("Файл с прогрессом скачан. Чтобы продолжить в другой копии курса — " +
      "перетащите его на страницу.");
  },

  /* Одна точка приёма файла: и для выбора через диалог, и для
     перетаскивания на страницу. */
  accept: function (f) {
    if (!f) return;
    const r = new FileReader();
    r.onload = function () {
      let data;
      try { data = JSON.parse(r.result); }
      catch (e) { Progress.toast("Файл не читается — похоже, это не файл прогресса."); return; }
      if (!data || typeof data !== "object" || !data.done) {
        Progress.toast("Файл прочитался, но это не похоже на прогресс курса.");
        return;
      }
      const added = Store.merge(data);
      Router.render(true);
      const total = Course.doneCount(Course.flat);
      Progress.toast(added
        ? "Прогресс перенесён: добавилось " + added + " " +
          plural(added, "урок", "урока", "уроков") + ", всего пройдено " + total + "."
        : "В этом файле нет ничего нового — всё уже на месте.");
    };
    r.onerror = function () { Progress.toast("Не удалось прочитать файл."); };
    r.readAsText(f);
  },

  load: function () {
    const inp = el("input", { type: "file", accept: "application/json,.json" });
    inp.addEventListener("change", function () { Progress.accept(inp.files[0]); });
    inp.click();
  },

  reset: function () {
    if (!confirm("Начать курс заново? Прогресс, весь написанный код и заметки будут удалены.")) return;
    Store.replace(null);
    Router.go("#");
    Router.render(true);
  },

  openMenu: function () {
    const done = Course.doneCount(Course.flat);
    const risky = Store.mode() === "memory";
    modal("Прогресс",
      '<div class="theory" style="font-size:14px">' +
        (risky
          ? '<div class="callout trap"><span class="ct">Сейчас прогресс не сохраняется</span>' +
            "<p>Браузер запретил хранение данных. Обычно так бывает в приватном окне " +
            "или при строгих настройках приватности. Всё, что вы сделаете, пропадёт " +
            "при закрытии вкладки.</p>" +
            "<p style=\"margin-bottom:0\">Откройте курс в обычном окне браузера — тогда всё " +
            "будет сохраняться само. Или выгрузите прогресс в файл кнопкой ниже.</p></div>"
          : "<p>Всё сохраняется само: пройденные уроки, написанный код и заметки. " +
            "Специально ничего делать не нужно — просто закрывайте вкладку и возвращайтесь " +
            "когда удобно.</p>") +
        "<p>Пройдено: <strong>" + done + " из " + Course.flat.length + "</strong>.</p>" +
        '<div class="actions" style="margin-top:16px">' +
          '<button class="btn' + (risky ? " primary" : "") + '" id="pgReset" type="button">Начать курс заново</button>' +
        "</div>" +
        '<p style="font-size:12.6px;color:var(--ink-3);margin-top:16px;margin-bottom:0">' +
          "Новая версия курса подхватывает прогресс сама, если открывать её в том же " +
          "браузере. Чтобы перенести занятия на другой компьютер или в другой браузер — " +
          '<button class="linkbtn" id="pgSave" type="button">выгрузите прогресс</button> ' +
          "и перетащите файл на страницу там (или " +
          '<button class="linkbtn" id="pgLoad" type="button">выберите его вручную</button>). ' +
          "Перенос ничего не стирает: пройденное складывается, ваш код остаётся вашим.</p>" +
      "</div>");
    $("#pgReset").addEventListener("click", Progress.reset);
    $("#pgSave").addEventListener("click", Progress.save);
    $("#pgLoad").addEventListener("click", Progress.load);
  },

  toast: function (text) {
    let t = $("#toast");
    if (!t) { t = el("div", { class: "toast", id: "toast" }); document.body.appendChild(t); }
    t.textContent = text;
    t.classList.add("show");
    clearTimeout(Progress._t);
    Progress._t = setTimeout(function () { t.classList.remove("show"); }, 5200);
  }
};

/* Файл прогресса можно просто бросить на страницу — не заставляя
   искать нужный пункт в меню. Ловим на окне, чтобы работало
   в любом месте курса.                                        */
function acceptDroppedProgress() {
  let depth = 0;
  const veil = el("div", { class: "dropveil", id: "dropVeil" },
    "<span>Отпустите файл — перенесу прогресс</span>");
  document.body.appendChild(veil);

  function hasFiles(e) {
    const t = e.dataTransfer && e.dataTransfer.types;
    return !!t && Array.prototype.indexOf.call(t, "Files") >= 0;
  }
  window.addEventListener("dragenter", function (e) {
    if (!hasFiles(e)) return;
    depth++; veil.classList.add("show");
  });
  window.addEventListener("dragover", function (e) { if (hasFiles(e)) e.preventDefault(); });
  window.addEventListener("dragleave", function () {
    if (--depth <= 0) { depth = 0; veil.classList.remove("show"); }
  });
  window.addEventListener("drop", function (e) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth = 0; veil.classList.remove("show");
    Progress.accept(e.dataTransfer.files[0]);
  });
}

/* если сохранять некуда — предупреждаем перед закрытием вкладки */
window.addEventListener("beforeunload", function (e) {
  Store.flush();
  if (Store.mode() === "memory" && Store.isDirty() && Course.doneCount(Course.flat) > 0) {
    e.preventDefault();
    e.returnValue = "";
    return "";
  }
});

/* ============================================================
   Шапка
   ============================================================ */

function mountHeader(crumbHtml) {
  const done = Course.doneCount(Course.flat);
  const total = Course.flat.length;

  const hdr = el("header", { class: "hdr" });
  hdr.innerHTML =
    '<div class="hdr-in">' +
      '<a class="brand" href="#"><span class="mark">DA</span><span>Тетрадь аналитика</span></a>' +
      '<div class="crumbs">' + (crumbHtml || "") + "</div>" +
      '<div class="spacer"></div>' +
      '<button class="iconbtn" id="progBtn" type="button" title="Прогресс курса">' +
        '<span class="mono">' + done + " / " + total + "</span></button>" +
      '<button class="iconbtn" id="themeBtn" type="button">Тёмная</button>' +
    "</div>" +
    '<div class="hdr-bar" id="hdrBar"></div>';

  const app = document.getElementById("app");
  app.parentNode.insertBefore(hdr, app);

  $("#themeBtn").addEventListener("click", Theme.toggle);
  $("#progBtn").addEventListener("click", Progress.openMenu);
  Theme.apply(Theme.current());
  requestAnimationFrame(refreshBar);

  if (Store.mode() === "memory") {
    const bar = el("div", { class: "warnbar show", id: "storeBar" },
      "<strong>Прогресс сейчас не сохраняется.</strong> Браузер запретил хранение данных — " +
      "обычно это приватное окно. Откройте курс в обычном окне, и всё заработает само. " +
      'Либо ' +
      '<button class="linkbtn" id="barSave" type="button">выгрузите прогресс в файл</button> ' +
      "перед тем как закрыть вкладку.");
    hdr.parentNode.insertBefore(bar, hdr.nextSibling);
    $("#barSave").addEventListener("click", Progress.save);
  }
}

function refreshBar() {
  const bar = $("#hdrBar");
  if (bar) bar.style.width = Math.round(Course.doneCount(Course.flat) / Course.flat.length * 100) + "%";
  const pb = $("#progBtn .mono");
  if (pb) pb.textContent = Course.doneCount(Course.flat) + " / " + Course.flat.length;
}

Store.onChange(function () {
  const b = $("#progBtn");
  if (b) b.classList.toggle("unsaved", Store.mode() === "memory" && Store.isDirty());
});

/* ============================================================
   Главная: карта курса
   ============================================================ */

/* Появление блоков при прокрутке. Смысл движения — показать, что
   страница длинная и содержимое идёт порциями.

   Намеренно не IntersectionObserver: при переходе по якорю блок
   перескакивает из-под экрана наверх, не пересекая границу, и
   наблюдатель молчит — контент остаётся невидимым навсегда.
   Проверка по координате такого состояния не допускает.
   При prefers-reduced-motion всё показывается сразу.              */
function revealOnScroll(root) {
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let pending = Array.prototype.slice.call((root || document).querySelectorAll(".rise"));

  if (reduce) {
    pending.forEach(function (n) { n.classList.add("in"); });
    return;
  }
  pending.forEach(function (n, i) { n.style.transitionDelay = Math.min(i, 3) * 55 + "ms"; });

  let ticking = false;
  function sweep() {
    ticking = false;
    const line = window.innerHeight * 0.94;
    pending = pending.filter(function (n) {
      if (n.getBoundingClientRect().top > line) return true;
      n.classList.add("in");
      return false;
    });
    if (!pending.length) stop();
  }
  function onScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(sweep); }
  }
  function stop() {
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onScroll);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  sweep();
  Router.cleanup.push(stop);
}

/* Счётчик, который добегает до значения. Движение здесь несёт смысл:
   число — это прогресс, и он должен читаться как накопленный. */
function countUp(node, to, suffix) {
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || to <= 0) { node.textContent = to + (suffix || ""); return; }
  const dur = Math.min(900, 260 + to * 22);
  const t0 = performance.now();
  (function step(t) {
    const k = Math.min(1, (t - t0) / dur);
    const eased = 1 - Math.pow(1 - k, 3);
    node.textContent = Math.round(to * eased) + (suffix || "");
    if (k < 1) requestAnimationFrame(step);
  })(t0);
}

function renderHome(app) {
  document.title = "Тетрадь аналитика — курс подготовки к Junior Data Analyst";
  mountHeader("");

  const done = Course.doneCount(Course.flat);
  const total = Course.flat.length;

  /* обложка: каждая клетка — урок */
  let mapHtml = "";
  Course.data.modules.forEach(function (m) {
    const cells = m.lessons.map(function (l) {
      const d = Course.isDone(l.id);
      const cls = "cell" + (d ? " done" : "") + (l.ready ? "" : " locked");
      const title = l.num + " " + l.title + (l.ready ? (d ? ", пройден" : "") : ", скоро");
      return l.ready
        ? '<a class="' + cls + '" href="#' + l.id + '" title="' + esc(title) + '"></a>'
        : '<span class="' + cls + '" title="' + esc(title) + '"></span>';
    }).join("");
    mapHtml += '<div class="map-mod"><div class="map-mod-h">' + m.num + ". " + esc(m.title) +
               '</div><div class="map-cells">' + cells + "</div></div>";
  });

  const hero = el("section", { class: "hero" });
  hero.innerHTML =
    '<div class="wrap hero-in has-margin">' +
      '<div class="aside"><p>за 2-3 месяца реально, если по часу-два в день</p>' +
        "<p>начните с первого модуля, остальное подождёт</p></div>" +
      "<h1>Тетрадь аналитика данных</h1>" +
      '<p class="lede">Программа на 2-3 месяца до первого оффера. Каждый урок ' +
        "заканчивается задачей, которую вы решаете прямо в браузере.</p>" +
      '<div class="map">' + mapHtml + "</div>" +
      '<div class="hero-stats">' +
        '<div><div class="st-n" data-count="' + done + '">0</div>' +
          '<div class="st-l">' + plural(done, "урок пройден", "урока пройдено", "уроков пройдено") + "</div></div>" +
        '<div><div class="st-n" data-count="' + Course.ready.length + '">0</div>' +
          '<div class="st-l">' + plural(Course.ready.length, "урок открыт", "урока открыто", "уроков открыто") +
          " из " + total + "</div></div>" +
        '<div><div class="st-n" data-count="2" data-suffix=" ч">0</div>' +
          '<div class="st-l">на один урок</div></div>' +
      "</div>" +
      /* Пустой курс — единственный момент, когда перенос вообще уместен:
         дальше эта строка только мешала бы. */
      (done === 0
        ? '<p class="carry">Занимались в прошлой версии курса? ' +
          '<button class="linkbtn" id="carryBtn" type="button">Перенесите прогресс</button> ' +
          "или просто перетащите сюда файл, выгруженный оттуда.</p>"
        : "") +
    "</div>";
  app.appendChild(hero);

  const carry = $("#carryBtn", hero);
  if (carry) carry.addEventListener("click", Progress.load);

  Array.prototype.forEach.call(hero.querySelectorAll(".st-n"), function (n) {
    countUp(n, +n.dataset.count, n.dataset.suffix || "");
  });

  const main = el("main", { class: "wrap" });

  /* ---------- программа: модули карточками ---------- */
  const mods = el("section", { class: "modules" });
  mods.innerHTML = '<div class="sec-title">Программа курса</div><div class="mod-grid" id="modGrid"></div>';
  const grid = $("#modGrid", mods);

  Course.data.modules.forEach(function (m) {
    const d = Course.doneCount(m.lessons);
    const t = m.lessons.length;
    const dflt = d < t && m.lessons.some(function (l) { return l.ready; });
    const openState = Store.get("seen", "open-" + m.id, dflt) ? "1" : "0";

    const node = el("article", { class: "mod rise" });
    node.setAttribute("open-state", openState);

    let lessons = "";
    m.lessons.forEach(function (l) {
      const isDone = Course.isDone(l.id);
      const inner =
        '<span class="les-n">' + l.num + "</span>" +
        '<span class="les-t">' + esc(l.title) + "</span>" +
        '<span class="les-d">' + esc(l.desc) + "</span>" +
        '<span class="les-tail">' +
          '<span class="tag ' + l.kind + '">' + (l.kind === "text" ? "разбор" : l.kind) + "</span>" +
          (isDone ? '<span class="tick" title="пройден">&#10003;</span>' : "") +
        "</span>";
      lessons += l.ready
        ? '<a class="les" href="#' + l.id + '">' + inner + "</a>"
        : '<div class="les soon">' + inner + "</div>";
    });

    node.innerHTML =
      '<button class="mod-head" type="button" aria-expanded="' + (openState === "1") + '">' +
        '<span class="mod-top">' +
          '<span class="mod-num">' + m.num + "</span>" +
          '<span class="mod-weeks">' + esc(m.weeks) + "</span>" +
          '<span class="chev">' + ICON.arrow + "</span>" +
        "</span>" +
        '<span class="mod-title">' + esc(m.title) + "</span>" +
        '<span class="mod-sub">' + esc(m.sub) + "</span>" +
        (m.say ? '<span class="mod-say">' + esc(m.say) + "</span>" : "") +
        '<span class="mod-foot">' +
          '<span class="mod-track"><i data-fill="' + (t ? d / t * 100 : 0) + '"></i></span>' +
          '<span class="mod-count">' + d + " / " + t + "</span>" +
        "</span>" +
      "</button>" +
      '<div class="mod-body">' + lessons + "</div>";

    $(".mod-head", node).addEventListener("click", function () {
      const now = node.getAttribute("open-state") === "1" ? "0" : "1";
      node.setAttribute("open-state", now);
      this.setAttribute("aria-expanded", now === "1");
      Store.set("seen", "open-" + m.id, now === "1");
    });
    grid.appendChild(node);
  });
  main.appendChild(mods);

  /* ---------- на чём построена программа ---------- */
  const mk = Course.data.market;
  const lead = mk[0], rest = mk.slice(1);
  let mkHtml = '<section class="market rise has-margin">' +
    '<div class="aside"><p>цифры из вакансий, а не из моей головы</p></div>' +
    "<h2>На чём построена программа</h2>" +
    '<p class="note">Частота требований в вакансиях Junior Data Analyst и Product Analyst ' +
    "по данным hh.ru и Habr Career за сентябрь 2026. Навыки, которые встречаются реже 10 процентов, " +
    "в курс не входят.</p>" +
    '<div class="market-lead">' +
      '<div class="mk-hero">' +
        '<div class="pct">' + esc(lead.pct) + "</div>" +
        '<div class="what">' + esc(lead.what) + "</div>" +
        '<div class="where">' + esc(lead.where) + "</div>" +
      "</div>" +
      '<div class="mk-rest">';
  rest.forEach(function (r) {
    mkHtml += '<div class="mk-row"><span class="pct">' + esc(r.pct) + "</span>" +
              '<span><span class="what">' + esc(r.what) + "</span>" +
              '<span class="where" style="display:block">' + esc(r.where) + "</span></span></div>";
  });
  mkHtml += "</div></div></section>";
  main.insertAdjacentHTML("beforeend", mkHtml);

  const foot = el("footer", { class: "foot" });
  foot.innerHTML =
    "<span>" + (Store.mode() === "local"
      ? "Пройденные уроки, код и заметки сохраняются автоматически в этом браузере."
      : "Внимание: браузер не сохраняет прогресс.") + "</span>" +
    '<button class="linkbtn" id="footProg" type="button">Перенести прогресс</button>';
  main.appendChild(foot);
  app.appendChild(main);
  $("#footProg").addEventListener("click", Progress.openMenu);

  revealOnScroll(app);
  /* полоски прогресса модулей заполняются после появления карточек */
  setTimeout(function () {
    Array.prototype.forEach.call(document.querySelectorAll(".mod-track i"), function (i) {
      i.style.width = i.dataset.fill + "%";
    });
  }, 120);
}

/* ============================================================
   Движки исполнения кода
   ============================================================ */

/* Заливает CSV в подготовленный запрос одной транзакцией:
   28 тысяч строк по одной вставке заняли бы секунды. */
function fillFromCsv(db, csv, sql, conv) {
  const lines = csv.split("\n");
  const st = db.prepare(sql);
  db.run("BEGIN");
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    st.run(conv(lines[i].split(",")));
  }
  db.run("COMMIT");
  st.free();
}

const Engine = {
  db: null,
  py: null,
  pyPkgs: {},

  sql: async function () {
    if (Engine.db) return Engine.db;
    await loadScript(CDN.sqlBase + "sql-wasm.js");
    const SQL = await window.initSqlJs({ locateFile: function (f) { return CDN.sqlBase + f; } });
    const db = new SQL.Database();
    db.run(window.DATA.shopSQL);
    /* Журнал мобильного приложения лежит в data.js одним CSV: так он
       не дублируется между SQL- и Python-уроками и числа сходятся. */
    fillFromCsv(db, window.DATA.appUsersCSV,
      "INSERT INTO app_users VALUES (?,?,?,?,?)",
      function (c) { return [+c[0], c[1], c[2], c[3], c[4]]; });
    fillFromCsv(db, window.DATA.appActivityCSV,
      "INSERT INTO app_activity VALUES (?,?)",
      function (c) { return [+c[0], c[1]]; });
    fillFromCsv(db, window.DATA.appOrdersCSV,
      "INSERT INTO app_orders VALUES (?,?,?)",
      function (c) { return [+c[0], c[1], +c[2]]; });
    Engine.db = db;
    return db;
  },

  python: async function (pkgs) {
    if (!Engine.py) {
      await loadScript(CDN.pyBase + "pyodide.js");
      Engine.py = await window.loadPyodide({ indexURL: CDN.pyBase });
    }
    for (const p of (pkgs || [])) {
      if (!Engine.pyPkgs[p]) { await Engine.py.loadPackage(p); Engine.pyPkgs[p] = true; }
    }
    return Engine.py;
  }
};

/* ============================================================
   Проверка результата
   ============================================================ */

const Check = {
  normLines: function (s) {
    return String(s).replace(/\r/g, "").split("\n")
      .map(function (l) { return l.trim().replace(/\s+/g, " "); })
      .filter(function (l) { return l.length > 0; });
  },
  python: function (got, exp) {
    const a = Check.normLines(got), b = Check.normLines(exp);
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i++) {
      if (a[i] !== b[i]) {
        if (a[i] === undefined) return { ok: false, line: i, why: "вывод короче эталона: не хватает строки «" + b[i] + "»" };
        if (b[i] === undefined) return { ok: false, line: i, why: "в выводе лишняя строка: «" + a[i] + "»" };
        return { ok: false, line: i, why: "строка " + (i + 1) + " не совпадает с эталоном" };
      }
    }
    return { ok: true };
  },

  cellEq: function (a, b) {
    if (a === null || a === undefined) a = "";
    if (b === null || b === undefined) b = "";
    const na = Number(a), nb = Number(b);
    if (a !== "" && b !== "" && !isNaN(na) && !isNaN(nb)) return Math.abs(na - nb) < 0.011;
    return String(a).trim() === String(b).trim();
  },
  sql: function (res, exp) {
    if (!res) return { ok: false, why: "запрос ничего не вернул — проверьте, что он начинается с SELECT" };
    const gc = res.columns.map(function (c) { return String(c).toLowerCase().trim(); });
    const ec = exp.columns.map(function (c) { return c.toLowerCase(); });
    if (gc.length !== ec.length) {
      return { ok: false, why: "столбцов " + gc.length + ", а нужно " + ec.length +
               " (" + exp.columns.join(", ") + ")" };
    }
    for (let i = 0; i < ec.length; i++) {
      if (gc[i] !== ec[i]) {
        return { ok: false, why: "столбец " + (i + 1) + " называется «" + res.columns[i] +
                 "», а в задаче просят «" + exp.columns[i] + "» — задайте имя через AS" };
      }
    }
    let got = res.values.slice(), want = exp.rows.slice();
    if (got.length !== want.length) {
      return { ok: false, why: "строк " + got.length + ", а должно быть " + want.length };
    }
    if (!exp.ordered) {
      const key = function (r) { return r.map(function (v) { return v === null ? "" : String(v); }).join("|"); };
      got = got.slice().sort(function (x, y) { return key(x) < key(y) ? -1 : 1; });
      want = want.slice().sort(function (x, y) { return key(x) < key(y) ? -1 : 1; });
    }
    for (let r = 0; r < want.length; r++) {
      for (let c = 0; c < want[r].length; c++) {
        if (!Check.cellEq(got[r][c], want[r][c])) {
          return { ok: false, row: r,
                   why: "строка " + (r + 1) + ", столбец «" + exp.columns[c] + "»: получилось " +
                        JSON.stringify(got[r][c]) + ", ожидается " + JSON.stringify(want[r][c]) };
        }
      }
    }
    return { ok: true };
  },

  text: function (answer, lesson) {
    const norm = function (s) { return s.toLowerCase().replace(/ё/g, "е"); };
    const low = " " + norm(answer) + " ";
    const words = answer.trim().split(/\s+/).filter(Boolean).length;
    const hits = lesson.criteria.map(function (c) {
      return { label: c.label, found: c.any.some(function (w) { return low.indexOf(norm(w)) >= 0; }) };
    });
    const n = hits.filter(function (h) { return h.found; }).length;
    return {
      ok: words >= (lesson.minWords || 50) && n >= (lesson.minCriteria || 5),
      hits: hits, n: n, words: words
    };
  }
};

/* ============================================================
   Разбор задачи из тренажёра
   ============================================================ */

/* Разбор — это рассказ, а не сниппет: в нём вперемешку пояснения,
   запросы и таблицы вывода. Одним моноширинным блоком всё это
   читается как код. Режем на части: запросы и таблицы остаются
   моноширинными (там важно выравнивание столбцов), пояснения
   набираются обычным текстом. Чистый код не трогаем.       */

const SQL_KW = /^\s*(WITH|SELECT|FROM|WHERE|GROUP\s+BY|ORDER\s+BY|HAVING|JOIN|LEFT|RIGHT|INNER|CROSS|OUTER|ON|AND|OR|NOT|UNION|LIMIT|OFFSET|CASE|WHEN|THEN|ELSE|END|INSERT|UPDATE|DELETE|CREATE|VALUES|SET|DISTINCT)\b/i;
const PY_KW = /^\s*(import|from|def|class|return|print|for|while|if|elif|else|try|except|with|assert|lambda|[a-z_]+\s*=)\b/;

function proseLine(l) {
  if (!l.trim()) return false;
  if (/^\s/.test(l)) return false;        /* отступ — код или таблица вывода */
  if (/^(--|#)/.test(l)) return false;     /* комментарий в коде             */
  if (/^[)\];,]/.test(l)) return false;    /* хвост скобок                   */
  if (SQL_KW.test(l) || PY_KW.test(l)) return false;
  return /[а-яё]{2}/i.test(l);             /* русские слова — это пояснение   */
}

function splitSolution(src) {
  const lines = String(src).replace(/\r/g, "").split("\n");
  if (!lines.some(proseLine)) return null;
  const out = [];
  let kind = null, buf = [];
  function flush() {
    while (buf.length && !buf[buf.length - 1].trim()) buf.pop();
    if (buf.length) out.push({ k: kind, v: buf.join("\n") });
    buf = [];
  }
  lines.forEach(function (l) {
    const k = proseLine(l) ? "text" : "code";
    if (!l.trim() && kind === null) return;
    if (l.trim() && k !== kind) { flush(); kind = k; }
    buf.push(l);
  });
  flush();
  return out;
}

function solutionHtml(src) {
  const blocks = splitSolution(src);
  if (!blocks) return "<pre><code>" + esc(src) + "</code></pre>";
  return blocks.map(function (b) {
    return b.k === "text"
      ? '<p class="d-say">' + esc(b.v).replace(/\n/g, "<br>") + "</p>"
      : "<pre><code>" + esc(b.v) + "</code></pre>";
  }).join("");
}

/* ---------- таблица результатов ---------- */
function renderTable(cols, rows, badRow) {
  let h = '<table class="res"><thead><tr>';
  cols.forEach(function (c) { h += "<th>" + esc(c) + "</th>"; });
  h += "</tr></thead><tbody>";
  rows.slice(0, 200).forEach(function (r, i) {
    h += "<tr" + (i === badRow ? ' class="rowdiff"' : "") + ">";
    r.forEach(function (v) {
      h += '<td class="' + (typeof v === "number" ? "num" : "") + '">' +
           (v === null ? "NULL" : esc(v)) + "</td>";
    });
    h += "</tr>";
  });
  h += "</tbody></table>";
  if (rows.length > 200) {
    h += '<div style="font-size:11.5px;color:var(--ink-3);margin-top:6px">показаны первые 200 строк</div>';
  }
  return h;
}

/* ---------- модальное окно ---------- */
function modal(title, html) {
  let bg = $("#modalBg");
  function close() { bg.classList.remove("show"); }
  if (!bg) {
    bg = el("div", { class: "modal-bg", id: "modalBg" });
    bg.innerHTML = '<div class="modal" role="dialog" aria-modal="true">' +
      '<div class="modal-h"><span id="modalT"></span><span class="spacer"></span>' +
      '<button class="iconbtn" id="modalX" type="button">Закрыть</button></div>' +
      '<div class="modal-b" id="modalB"></div></div>';
    document.body.appendChild(bg);
    bg.addEventListener("click", function (e) { if (e.target === bg) close(); });
    $("#modalX").addEventListener("click", close);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
  }
  $("#modalT").textContent = title;
  $("#modalB").innerHTML = html;
  bg.classList.add("show");
  $("#modalX").focus();
  if (window.MathJax && window.MathJax.typesetPromise) window.MathJax.typesetPromise([$("#modalB")]);
}

/* ============================================================
   Страница урока — один вертикальный лонгрид.

   Порядок: шапка -> план на 2 часа -> якорная навигация ->
   теория -> основная задача -> тренажёр -> самопроверка ->
   что почитать -> заметки -> переход дальше.
   ============================================================ */

const ICON = {
  play:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" width="15" height="15" aria-hidden="true"><polygon points="6 3 20 12 6 21 6 3"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" width="15" height="15" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>',
  bulb:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="15" height="15" aria-hidden="true"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/></svg>',
  key:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="15" height="15" aria-hidden="true"><circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3 21 2m-4 4 3 3m-6-6 3 3"/></svg>',
  moon:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="15" height="15" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
  sun:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="15" height="15" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  ok:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>',
  bad:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  warn:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 7v6M12 17h.01"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="15" height="15" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>'
};

/* план по умолчанию, если урок не задал свой */
function defaultPlan(C) {
  const p = [{ m: "30 мин", w: "Теория с разобранными примерами" },
             { m: "45 мин", w: "Основная задача из рабочего тикета" }];
  if (C.drills && C.drills.length) p.push({ m: "35 мин", w: "Тренажёр: " + C.drills.length + " " + plural(C.drills.length, "задача", "задачи", "задач") });
  if (C.quiz && C.quiz.length) p.push({ m: "10 мин", w: "Самопроверка вопросами" });
  p.push({ m: "10 мин", w: "Разбор решения и заметки" });
  return p;
}

function renderLesson(app, id) {
  const L = Course.byId(id);
  const C = window.CONTENT[id];

  if (!L || !C) {
    document.title = "Урок не открыт — Тетрадь аналитика";
    mountHeader("");
    app.appendChild(el("main", { class: "wrap lesson-wrap" },
      '<div style="padding:80px 0"><h1 style="font-size:32px;margin-bottom:12px">Этот урок ещё не открыт</h1>' +
      '<p style="color:var(--ink-2);font-size:17px">Вернитесь на <a href="#">карту курса</a> ' +
      "и выберите урок без пометки «скоро».</p></div>"));
    return;
  }

  const M = L.module;
  document.title = L.num + " " + L.title + " — Тетрадь аналитика";
  mountHeader("<b>Модуль " + M.num + ":</b> " + esc(M.title) + ", урок " + L.num);

  if (C.math) {
    if (!window.MathJax) {
      window.MathJax = {
        tex: { inlineMath: [["\\(", "\\)"]], displayMath: [["\\[", "\\]"]] },
        options: { skipHtmlTags: ["script", "noscript", "style", "textarea"] }
      };
      loadScript(CDN.mathjax);
    } else if (window.MathJax.typesetPromise) {
      setTimeout(function () { window.MathJax.typesetPromise([$(".theory")]); }, 60);
    }
  }

  const isText = L.kind === "text";
  const kindLabel = isText ? "разбор кейса" : (L.kind === "sql" ? "SQL" : "Python");
  const plan = C.plan || defaultPlan(C);
  const hasDrills = !!(C.drills && C.drills.length);
  const hasQuiz = !!(C.quiz && C.quiz.length);
  const hasLinks = !!(C.links && C.links.length);

  /* ---------- план урока ---------- */
  let planHtml = '<div class="plan"><div class="plan-h"><span>План занятия</span>' +
    '<span class="total">' + esc(C.duration || "≈ 2 часа") + "</span></div>" +
    '<div class="plan-list" style="--plan-cols:' + Math.min(plan.length, 5) + '">';
  plan.forEach(function (p) {
    planHtml += '<div class="plan-item"><div class="m">' + esc(p.m) + '</div><div class="w">' + esc(p.w) + "</div></div>";
  });
  planHtml += "</div></div>";

  /* ---------- якорная навигация ---------- */
  const secs = [{ id: "s-theory", t: "Теория" }, { id: "s-task", t: "Задача" }];
  if (hasDrills) secs.push({ id: "s-drills", t: "Тренажёр" });
  if (hasQuiz) secs.push({ id: "s-quiz", t: "Самопроверка" });
  if (hasLinks) secs.push({ id: "s-links", t: "Что почитать" });
  secs.push({ id: "s-notes", t: "Заметки" });

  let navHtml = '<nav class="secnav" id="secnav"><div class="secnav-in">';
  secs.forEach(function (s, i) {
    navHtml += '<a href="#' + s.id + '" data-sec="' + s.id + '"' + (i === 0 ? ' class="on"' : "") + ">" + s.t + "</a>";
  });
  navHtml += "</div></nav>";

  /* ---------- тренажёр ---------- */
  let drillsHtml = "";
  if (hasDrills) {
    drillsHtml = '<section class="block rise has-margin" id="s-drills">' +
      (L.sayDrills ? '<div class="aside"><p>' + esc(L.sayDrills) + "</p></div>" : "") +
      '<div class="block-h"><h2>Тренажёр</h2></div>' +
      '<p class="block-intro">' +
      "Ещё " + C.drills.length + " " + plural(C.drills.length, "задача", "задачи", "задач") +
      " на ту же базу. Пишите ответ в редакторе выше, запускайте, и только потом открывайте разбор. " +
      "Готовый ответ, который вы не пробовали написать сами, не запоминается.</p>" +
      '<div class="drills">';
    C.drills.forEach(function (d, i) {
      const lvl = d.level || "mid";
      const lvlText = lvl === "easy" ? "разминка" : lvl === "hard" ? "сложная" : "рабочая";
      drillsHtml +=
        '<details class="drill"><summary>' +
          '<span class="d-n">' + (i + 1) + "</span>" +
          "<span>" + esc(d.title) + "</span>" +
          '<span class="d-lvl ' + lvl + '">' + lvlText + "</span>" +
        "</summary>" +
        '<div class="drill-body">' + d.body +
          (d.solution
            ? '<details class="d-reveal"><summary>показать решение</summary>' +
              solutionHtml(d.solution) +
              (d.note ? '<div style="font-size:15px;color:var(--ink-2)">' + d.note + "</div>" : "") +
              "</details>"
            : "") +
        "</div></details>";
    });
    drillsHtml += "</div></section>";
  }

  /* ---------- самопроверка ---------- */
  let quizHtml = "";
  if (hasQuiz) {
    quizHtml = '<section class="block rise" id="s-quiz">' +
      '<div class="block-h"><h2>Самопроверка</h2></div>' +
      '<p class="block-intro">Отвечайте не глядя в теорию. Разбор откроется сразу после ответа.</p>' +
      '<div class="quiz" id="quiz">';
    C.quiz.forEach(function (q, i) {
      quizHtml += '<div class="q" data-q="' + i + '">' +
        '<div class="q-t"><span class="q-n">' + (i + 1) + " / " + C.quiz.length + "</span><span>" + q.q + "</span></div>" +
        '<div class="q-opts">';
      /* Варианты тасуются при каждой отрисовке: без этого позиция верного
         ответа в исходнике складывается в угадываемый цикл. data-i хранит исходный
         номер, по нему и сверяется ответ.                                        */
      shuffled(q.opts.length).forEach(function (orig, pos) {
        quizHtml += '<button class="q-opt" type="button" data-i="' + orig + '">' +
          '<span class="mk">' + "АБВГД".charAt(pos) + "</span><span>" + q.opts[orig] + "</span></button>";
      });
      quizHtml += '</div><div class="q-why"><b>Почему:</b> ' + q.why + "</div></div>";
    });
    quizHtml += '</div><div class="quiz-score" id="quizScore">отвечено <b>0</b> из ' + C.quiz.length + "</div></section>";
  }

  /* ---------- ссылки ---------- */
  let linksHtml = "";
  if (hasLinks) {
    linksHtml = '<section class="block rise" id="s-links">' +
      '<div class="block-h"><h2>Что почитать дальше</h2></div>' +
      '<p class="block-intro">Материалы открываются в новой вкладке. Помеченные EN на английском: ' +
      "читать документацию по-английски аналитику всё равно придётся, лучше начать сейчас.</p>" +
      '<div class="links">';
    C.links.forEach(function (l) {
      linksHtml += '<a class="link-card" href="' + esc(l.url) + '" target="_blank" rel="noopener noreferrer">' +
        '<div class="lk-src"><span>' + esc(l.src) + "</span>" +
        (l.lang ? '<span class="lang">' + esc(l.lang) + "</span>" : "") + "</div>" +
        '<div class="lk-t">' + esc(l.t) + "</div>" +
        '<div class="lk-d">' + esc(l.d) + "</div></a>";
    });
    linksHtml += "</div></section>";
  }

  const main = el("main", { class: "wrap lesson-wrap" });
  main.innerHTML =
    '<header class="lesson-head has-margin">' +
      (L.say ? '<div class="aside"><p>' + esc(L.say) + "</p></div>" : "") +
      '<div class="kicker"><span>Урок ' + L.num + ", " + esc(kindLabel) + "</span>" +
        '<button class="timer" id="timer" type="button" title="Клик ставит таймер на паузу">0:00</button></div>' +
      "<h1>" + esc(L.title) + "</h1>" +
      '<p class="sub">' + esc(C.intro || L.desc) + "</p>" +
      planHtml +
    "</header>" +

    navHtml +

    '<section class="block rise" id="s-theory">' +
      '<div class="block-h"><h2>Теория</h2></div>' +
      '<div class="theory">' + C.theory + "</div>" +
    "</section>" +

    '<section class="block rise has-margin" id="s-task">' +
      (L.sayTask ? '<div class="aside"><p>' + esc(L.sayTask) + "</p></div>" : "") +
      '<div class="block-h"><h2>Основная задача</h2></div>' +

      '<div class="ticket">' +
        '<div class="ticket-h"><span class="from">' + esc(C.ticket.from) + "</span>" +
          "<span>" + esc(C.ticket.subj) + "</span></div>" +
        '<div class="ticket-b">' + C.ticket.body + "</div>" +
      "</div>" +

      '<details class="schema"><summary>Входные данные и подсказки по синтаксису</summary>' +
        '<div class="schema-body">' + C.schema + "</div></details>" +

      '<div class="loader" id="loader"><span class="spin"></span><span id="loaderTxt"></span></div>' +

      (isText
        ? '<textarea class="answer" id="answer" placeholder="Пишите так, как ответили бы вслух на собеседовании..."></textarea>'
        : '<div class="editor-shell">' +
            '<div class="editor-h"><span>' + (L.kind === "sql" ? "запрос.sql" : "решение.py") + "</span>" +
            '<span class="spacer"></span>' +
            '<button class="linkbtn" id="resetBtn" type="button">сбросить к шаблону</button></div>' +
            '<textarea id="editor"></textarea>' +
          "</div>") +

      '<div class="actions">' +
        (isText ? "" : '<button class="btn primary" id="runBtn" type="button">' + ICON.play +
          "Запустить код<span class=\"k\">Cmd+Enter</span></button>") +
        '<button class="btn check" id="checkBtn" type="button">' + ICON.check + "Проверить</button>" +
        '<button class="btn" id="hintBtn" type="button">' + ICON.bulb + "Подсказка</button>" +
        '<button class="btn" id="solBtn" type="button" disabled>' + ICON.key + "Решение</button>" +
      "</div>" +

      '<div class="status" id="status"></div>' +

      '<div class="io">' +
        '<div class="io-box"><div class="io-h"><span>' +
          (isText ? "разбор вашего ответа" : "ваш вывод") + "</span></div>" +
          '<div class="io-body" id="outBox"><div class="empty">' +
          (isText ? "Напишите ответ и нажмите «Проверить»." : "Пока пусто — нажмите «Запустить код».") +
          "</div></div></div>" +
        '<div class="io-box"><div class="io-h"><span>' +
          (isText ? "эталонный разбор" : "ожидаемый результат") + "</span>" +
          (isText ? '<span class="spacer"></span><button class="linkbtn" id="refBtn" type="button">показать</button>' : "") +
          "</div>" +
          '<div class="io-body" id="refBox"></div></div>' +
      "</div>" +
    "</section>" +

    drillsHtml + quizHtml + linksHtml +

    '<section class="block rise" id="s-notes">' +
      '<div class="block-h"><h2>Мои заметки</h2></div>' +
      '<div class="notes-wrap">' +
        '<textarea class="notes" id="notes" placeholder="Что было непонятно, на чём споткнулась, что спросить у наставника..."></textarea>' +
        '<div class="notes-hint" id="notesHint">сохраняется автоматически</div>' +
      "</div>" +
    "</section>" +

    '<nav class="lesson-nav" id="lnav"></nav>';

  app.appendChild(main);

  revealOnScroll(main);

  /* ---------- полоса прочитанного + подсветка активной секции ---------- */
  (function () {
    const bar = el("div", { class: "readbar", id: "readbar" });
    document.body.appendChild(bar);
    const links = Array.prototype.slice.call(document.querySelectorAll(".secnav a"));
    let ticking = false;

    function upd() {
      ticking = false;
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      bar.style.width = (max > 0 ? Math.min(100, h.scrollTop / max * 100) : 0) + "%";

      const line = h.scrollTop + h.clientHeight * 0.32;
      let cur = secs[0].id;
      for (let i = 0; i < secs.length; i++) {
        const n = document.getElementById(secs[i].id);
        if (n && n.offsetTop <= line) cur = secs[i].id;
      }
      links.forEach(function (a) { a.classList.toggle("on", a.dataset.sec === cur); });
    }
    function onScroll() {
      if (!ticking) { ticking = true; requestAnimationFrame(upd); }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    upd();
    Router.cleanup.push(function () {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      const b = document.getElementById("readbar");
      if (b) b.remove();
    });
  })();

  /* ---------- самопроверка ---------- */
  if (hasQuiz) {
    const answered = {};
    Array.prototype.forEach.call(document.querySelectorAll(".q"), function (card) {
      const qi = +card.dataset.q;
      const q = C.quiz[qi];
      const opts = Array.prototype.slice.call(card.querySelectorAll(".q-opt"));
      opts.forEach(function (btn) {
        btn.addEventListener("click", function () {
          if (answered[qi]) return;
          answered[qi] = true;
          const picked = +btn.dataset.i;
          opts.forEach(function (b) {
            b.disabled = true;
            const oi = +b.dataset.i;
            if (oi === q.right) b.classList.add("right");
            else if (oi === picked) b.classList.add("wrong");
          });
          $(".q-why", card).classList.add("show");
          const n = Object.keys(answered).length;
          $("#quizScore").innerHTML = "отвечено <b>" + n + "</b> из " + C.quiz.length +
            (n === C.quiz.length ? " — можно идти дальше" : "");
        });
      });
    });
  }

  /* ---------- эталон ---------- */
  const refBox = $("#refBox");
  if (isText) {
    refBox.innerHTML = '<div class="empty">Скрыт, чтобы не подсматривать. Сначала напишите свой ответ.</div>';
    $("#refBtn").addEventListener("click", function () {
      refBox.innerHTML = '<div class="theory" style="font-size:15px">' + C.reference + "</div>";
      this.remove();
    });
  } else if (C.expected.stdout !== undefined) {
    refBox.innerHTML = "<pre>" + esc(C.expected.stdout) + "</pre>";
  } else {
    refBox.innerHTML = renderTable(C.expected.columns, C.expected.rows, -1);
  }

  /* ---------- статус и индикатор загрузки ---------- */
  function setStatus(kind, title, body) {
    const s = $("#status");
    const ico = kind === "ok" ? ICON.ok : kind === "bad" ? ICON.bad : ICON.warn;
    s.className = "status show " + kind;
    s.innerHTML = '<span class="s-ico">' + ico + '</span><span class="s-body"><b>' + esc(title) + "</b>" +
                  (body ? "<br>" + body : "") + "</span>";
  }
  function clearStatus() { $("#status").className = "status"; }
  function loader(on, txt) {
    $("#loader").className = "loader" + (on ? " show" : "");
    if (txt) $("#loaderTxt").textContent = txt;
  }

  /* ---------- редактор ---------- */
  let cm = null, answerEl = null;
  const savedCode = Store.get("code", id, null);

  if (isText) {
    answerEl = $("#answer");
    answerEl.value = savedCode || "";
    answerEl.addEventListener("input", function () { Store.set("code", id, answerEl.value); });
  } else {
    loadCSS(CDN.cmBase + "codemirror.min.css");
    loadScript(CDN.cmBase + "codemirror.min.js").then(function () {
      return loadScript(CDN.cmBase + "mode/" + (L.kind === "sql" ? "sql/sql" : "python/python") + ".min.js");
    }).then(function () {
      const ta = $("#editor");
      if (!ta || !document.body.contains(ta)) return;   /* урок успели сменить */
      cm = window.CodeMirror.fromTextArea(ta, {
        mode: L.kind === "sql" ? "text/x-sqlite" : "python",
        lineNumbers: true, indentUnit: 4, tabSize: 4,
        lineWrapping: true, viewportMargin: Infinity,
        extraKeys: {
          "Cmd-Enter": run, "Ctrl-Enter": run,
          Tab: function (c) { c.replaceSelection("    "); }
        }
      });
      cm.setValue(savedCode !== null ? savedCode : (C.starter || ""));
      cm.on("change", function () { Store.set("code", id, cm.getValue()); });
    }).catch(function () {
      const ta = $("#editor");
      if (!ta) return;
      ta.style.cssText = "width:100%;min-height:320px;font-family:var(--mono);font-size:14.5px;" +
        "line-height:1.62;border:0;padding:14px 16px;background:transparent;color:var(--ink);resize:vertical";
      ta.value = savedCode !== null ? savedCode : (C.starter || "");
      ta.addEventListener("input", function () { Store.set("code", id, ta.value); });
      setStatus("warn", "Редактор без подсветки синтаксиса",
        "CodeMirror не загрузился — похоже, нет интернета. Код всё равно можно писать и запускать.");
    });
    $("#resetBtn").addEventListener("click", function () {
      if (!confirm("Вернуть начальный шаблон? Ваш код будет потерян.")) return;
      const v = C.starter || "";
      if (cm) cm.setValue(v); else $("#editor").value = v;
      Store.set("code", id, v);
    });
  }

  function getCode() {
    if (isText) return answerEl.value;
    return cm ? cm.getValue() : $("#editor").value;
  }

  /* ---------- заметки ---------- */
  const notes = $("#notes");
  notes.value = Store.get("notes", id, "");
  let noteT = null;
  notes.addEventListener("input", function () {
    Store.set("notes", id, notes.value);
    clearTimeout(noteT);
    $("#notesHint").textContent = "Сохранено";
    noteT = setTimeout(function () { $("#notesHint").textContent = "Сохраняется автоматически"; }, 1400);
  });

  /* ---------- попытки и доступ к решению ---------- */
  let attempts = Store.get("attempts", id, 0);
  function syncSolBtn() {
    const b = $("#solBtn");
    const allow = attempts >= 3 || Course.isDone(id);
    b.disabled = !allow;
    b.title = allow ? "" :
      "Откроется после трёх неудачных попыток — сначала попробуйте сами (" + attempts + " из 3)";
  }
  syncSolBtn();

  /* ---------- запуск ---------- */
  let lastSqlResult = null;
  let lastStdout = "";

  async function run() {
    clearStatus();
    const code = getCode();
    if (!code.trim()) { setStatus("warn", "Пусто", "Сначала напишите код."); return; }
    $("#runBtn").disabled = true;
    try {
      if (L.kind === "sql") await runSQL(code);
      else await runPython(code);
    } catch (e) {
      showError(String(e && e.message ? e.message : e));
    } finally {
      const rb = $("#runBtn");
      if (rb) rb.disabled = false;
      loader(false);
    }
  }

  async function runSQL(code) {
    loader(true, "Поднимаю базу в браузере...");
    const db = await Engine.sql();
    loader(false);
    let res;
    try {
      res = db.exec(code);
    } catch (e) {
      lastSqlResult = null;
      showError("SQLite: " + e.message);
      return;
    }
    const last = res.length ? res[res.length - 1] : null;
    lastSqlResult = last;
    if (!last) {
      $("#outBox").innerHTML = '<div class="empty">Запрос выполнен, но не вернул ни одной строки.</div>';
      return;
    }
    $("#outBox").innerHTML = renderTable(last.columns, last.values, -1) +
      '<div style="margin-top:7px;font-size:11.5px;color:var(--ink-3);font-family:var(--mono)">' +
      last.values.length + " " + plural(last.values.length, "строка", "строки", "строк") + "</div>";
  }

  async function runPython(code) {
    loader(true, Engine.py ? "Выполняю..." : "Первый запуск: качаю Python в браузер, 15-40 секунд...");
    const py = await Engine.python(C.packages || []);
    (C.data || []).forEach(function (k) { py.globals.set(k, window.DATA[k]); });
    /* stdout и stderr разделены: с эталоном сравнивается только stdout,
       предупреждения библиотек не должны ломать проверку */
    const outBuf = [], errBuf = [];
    py.setStdout({ batched: function (s) { outBuf.push(s); } });
    py.setStderr({ batched: function (s) { errBuf.push(s); } });
    loader(true, "Выполняю...");
    try {
      if (C.prelude) await py.runPythonAsync(C.prelude);
      await py.runPythonAsync(code);
      lastStdout = outBuf.join("\n");
      const warn = errBuf.join("\n").trim();
      let html = lastStdout.trim()
        ? "<pre>" + esc(lastStdout) + "</pre>"
        : '<div class="empty">Код отработал без ошибок, но ничего не напечатал. Нужен print().</div>';
      if (warn) {
        html += '<pre style="margin-top:9px;font-size:11.5px;color:var(--ink-3)">' + esc(warn) + "</pre>";
      }
      $("#outBox").innerHTML = html;
    } catch (e) {
      lastStdout = "";
      const lines = String(e.message || e).split("\n").filter(function (l) {
        return l.indexOf("/lib/python") < 0 && l.indexOf("pyodide") < 0;
      });
      showError(lines.slice(-14).join("\n"));
    }
  }

  function showError(msg) {
    $("#outBox").innerHTML = '<pre><span class="err">' + esc(msg) + "</span></pre>";
    setStatus("bad", "Код упал с ошибкой",
      "Читайте последнюю строку вывода — там сказано, что именно не понравилось интерпретатору.");
  }

  /* ---------- проверка ---------- */
  function pass(extra) {
    Store.set("done", id, Date.now());
    const remind = Store.mode() === "memory"
      ? '<br><span style="color:var(--amber)">Браузер не сохраняет прогресс — выгрузите его ' +
        "в файл кнопкой вверху, иначе результат пропадёт.</span>" : "";
    setStatus("ok", "Задание выполнено", (extra || "") + remind +
      '<br><button class="linkbtn" id="nextBtn" type="button">Перейти к следующему уроку</button>');
    const nb = $("#nextBtn");
    if (nb) nb.addEventListener("click", function () {
      const n = Course.neighbour(id, 1);
      Router.go(n ? "#" + n.id : "#");
    });
    syncSolBtn();
    updateNav();
    refreshBar();
  }
  function fail(why, extra) {
    attempts += 1; Store.set("attempts", id, attempts); syncSolBtn();
    setStatus("bad", "Результат не совпадает",
      esc(why) + (extra || "") +
      '<br><span style="color:var(--ink-3);font-size:12.5px">Попытка ' + attempts +
      (attempts >= 3 ? ". Кнопка «Показать решение» уже доступна."
                     : ". Решение откроется после третьей.") + "</span>");
  }

  function checkSQL() {
    if (!lastSqlResult) {
      setStatus("warn", "Сначала запустите запрос", "Нажмите «Запустить код», потом «Проверить».");
      return;
    }
    const r = Check.sql(lastSqlResult, C.expected);
    if (r.ok) {
      $("#outBox").innerHTML = renderTable(lastSqlResult.columns, lastSqlResult.values, -1);
      pass("Столбцы, порядок строк и значения сошлись с эталоном.");
    } else {
      $("#outBox").innerHTML = renderTable(lastSqlResult.columns, lastSqlResult.values,
        r.row === undefined ? -1 : r.row);
      fail(r.why, r.row !== undefined
        ? '<br><span style="font-size:12.5px">Первая расходящаяся строка подсвечена слева.</span>' : "");
    }
  }

  function checkPy() {
    if (!lastStdout.trim()) {
      setStatus("warn", "Сначала запустите код", "Нажмите «Запустить код», потом «Проверить».");
      return;
    }
    const r = Check.python(lastStdout, C.expected.stdout);
    if (r.ok) {
      pass("Вывод совпал с эталоном. Различия в пробелах и выравнивании не учитывались.");
    } else {
      const raw = lastStdout.replace(/\r/g, "").split("\n").filter(function (l) { return l.trim(); });
      const html = raw.map(function (l, i) {
        return i === r.line ? '<mark class="diff">' + esc(l) + "</mark>" : esc(l);
      }).join("\n");
      $("#outBox").innerHTML = "<pre>" + html + "</pre>";
      fail(r.why, '<br><span style="font-size:12.5px">Первое расхождение подсвечено — сравните с эталоном справа.</span>');
    }
  }

  function checkText() {
    const r = Check.text(getCode(), C);
    let html = '<div style="font-size:13px">';
    r.hits.forEach(function (h) {
      html += '<div style="margin-bottom:5px;color:' + (h.found ? "var(--green)" : "var(--ink-3)") + '">' +
              (h.found ? "&#10003; " : "&#9675; ") + esc(h.label) + "</div>";
    });
    html += '<div style="margin-top:9px;font-family:var(--mono);font-size:11.5px;color:var(--ink-3)">' +
            "найдено " + r.n + " из " + C.criteria.length + ", слов: " + r.words + "</div></div>";
    $("#outBox").innerHTML = html;

    if (r.ok) {
      pass("Каркас ответа полный. Теперь откройте эталонный разбор справа: важно не совпадение слов, " +
           "а не пропустили ли вы целый пласт рассуждения.");
    } else if (r.words < (C.minWords || 50)) {
      fail("Ответ короткий: " + r.words + " " + plural(r.words, "слово", "слова", "слов") +
           ", нужно хотя бы " + C.minWords + ". Разверните план проверки по шагам.");
    } else {
      fail("Раскрыто " + r.n + " смысловых блоков из " + C.criteria.length +
           ", для зачёта нужно " + C.minCriteria + ". Слева отмечено, чего не хватает.");
    }
  }

  function check() {
    clearStatus();
    if (isText) return checkText();
    if (L.kind === "sql") return checkSQL();
    return checkPy();
  }

  /* ---------- подсказки и решение ---------- */
  $("#hintBtn").addEventListener("click", function () {
    const lvl = Math.min(attempts, C.hints.length - 1);
    let html = "";
    for (let i = 0; i <= lvl; i++) {
      html += '<div class="hint-step"><div class="hs-n">' +
              (i === 0 ? "смотрите" : i === 1 ? "ещё ближе" : "ладно, разбираю") +
              "</div><p>" + C.hints[i] + "</p></div>";
    }
    if (lvl < C.hints.length - 1) {
      html += '<p style="color:var(--ink-3);font-size:12.8px">Следующая подсказка станет подробнее ' +
              "после ещё одной попытки — так больше шансов, что решение останется вашим.</p>";
    }
    modal("Подсказка", html);
  });

  $("#solBtn").addEventListener("click", function () {
    const body = (isText ? "" :
      "<p>Эталонный код с комментариями. Сравнивайте не синтаксис, а подход: где вы пошли другим путём и почему.</p>" +
      "<pre>" + esc(C.solution) + "</pre>") + (C.solutionNote || C.reference || "");
    modal("Решение", '<div class="theory" style="font-size:16px">' + body + "</div>");
  });

  $("#checkBtn").addEventListener("click", check);
  if (!isText) $("#runBtn").addEventListener("click", run);

  function onKey(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      if (isText) check(); else run();
    }
  }
  document.addEventListener("keydown", onKey);
  Router.cleanup.push(function () { document.removeEventListener("keydown", onKey); });

  /* ---------- нижняя навигация ---------- */
  function updateNav() {
    const prev = Course.neighbour(id, -1), next = Course.neighbour(id, 1);
    const done = Course.isDone(id);
    $("#lnav").innerHTML =
      (prev ? '<a class="navlink" href="#' + prev.id + '">&larr; ' + esc(prev.num + " " + prev.title) + "</a>"
            : '<span class="navlink dim">&larr; начало курса</span>') +
      '<a class="navlink" href="#">Карта курса</a>' +
      '<span class="spacer"></span>' +
      '<button class="btn ' + (done ? "" : "check") + '" id="markBtn" type="button"' +
        (done ? "" : " disabled") + ">" +
        (done ? "&#10003; Пройден — снять отметку" : "Отметить как пройденный") + "</button>" +
      (next ? '<a class="navlink" href="#' + next.id + '">' + esc(next.num + " " + next.title) + " &rarr;</a>"
            : '<span class="navlink dim">дальше — новые уроки</span>');

    const mb = $("#markBtn");
    if (!done) mb.title = "Станет активной, когда «Проверить» покажет зелёный результат";
    mb.addEventListener("click", function () {
      if (Course.isDone(id)) Store.set("done", id, false);
      updateNav();
      refreshBar();
    });
  }
  updateNav();
  if (Course.isDone(id)) {
    setStatus("ok", "Урок уже пройден",
      "Можно перерешать: код сохранён, кнопка «Показать решение» открыта.");
  }

  /* ---------- таймер ---------- */
  (function () {
    let secs = Store.get("time", id, 0);
    let running = true;
    const btn = $("#timer");
    function fmt(s) { return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }
    btn.textContent = fmt(secs);
    const tick = setInterval(function () {
      if (!running || document.hidden) return;
      secs += 1; btn.textContent = fmt(secs);
      if (secs % 10 === 0) Store.set("time", id, secs);
    }, 1000);
    btn.addEventListener("click", function () {
      running = !running;
      btn.classList.toggle("paused", !running);
      btn.title = running ? "Клик — пауза" : "На паузе. Клик — продолжить";
    });
    Router.cleanup.push(function () {
      clearInterval(tick);
      if (secs > 0) Store.set("time", id, secs);
    });
  })();
}

/* ============================================================
   Маршрутизация по хэшу
   ============================================================ */

const Router = {
  cleanup: [],
  current: null,          /* какой урок сейчас отрисован (null — главная) */

  go: function (hash) {
    const h = hash || "#";
    if (location.hash === h) Router.render(true);
    else location.hash = h;
  },

  /* force — перерисовать, даже если адрес не менялся (например, после
     переноса прогресса, когда поменялись отметки о пройденном).      */
  render: function (force) {
    const id = location.hash.replace(/^#\/?/, "").trim();
    const lesson = id ? Course.byId(id) : null;

    /* Хэш — не только адрес урока. Навигация по секциям внутри урока
       (#s-task, #s-quiz) работает обычными якорями, и такой переход
       перерисовывать нельзя: браузер уже прокрутил куда надо, а полная
       перерисовка вместо этого показала бы «урок ещё не открыт».
       Отличаем по наличию элемента с таким id на странице.          */
    if (!force && id && !lesson && document.getElementById(id)) return;

    /* Возврат к адресу урока, который и так открыт (например, кнопкой
       «назад» после перехода по якорю), — просто подъём наверх.      */
    if (!force && lesson && Router.current === id) {
      window.scrollTo(0, 0);
      return;
    }

    Router.cleanup.forEach(function (f) { try { f(); } catch (e) {} });
    Router.cleanup = [];

    const hdr = $(".hdr"); if (hdr) hdr.remove();
    const bar = $("#storeBar"); if (bar) bar.remove();

    const app = document.getElementById("app");
    app.innerHTML = "";

    if (id) renderLesson(app, id);
    else renderHome(app);

    Router.current = lesson ? id : null;
    window.scrollTo(0, 0);
  }
};

/* ============================================================
   Старт
   ============================================================ */

document.addEventListener("DOMContentLoaded", function () {
  if (!document.getElementById("app")) {
    document.body.appendChild(el("div", { id: "app" }));
  }
  Theme.init();
  acceptDroppedProgress();
  Router.render();
  window.addEventListener("hashchange", function () { Router.render(); });
});

})();
