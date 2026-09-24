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
  const EMPTY = { theme: {}, done: {}, code: {}, notes: {}, attempts: {}, time: {}, seen: {},
                  days: {}, review: {}, prep: {}, steps: {} };

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
      const res = { added: 0, changed: 0 };
      if (!next || typeof next !== "object") return res;
      /* Число из файла побеждает, если здесь пусто, не число (урок
         сброшен — done: false) или меньше. Пройденное из файла поверх
         сброшенного считается новым пройденным уроком.             */
      ["done", "attempts", "time", "days", "steps"].forEach(function (b) {
        const src = next[b] || {};
        Object.keys(src).forEach(function (id) {
          const cur = state[b][id], val = src[id];
          const better = cur === undefined ||
            (typeof val === "number" && (typeof cur !== "number" || val > cur));
          if (!better) return;
          if (b === "done" && val && !cur) res.added++;
          state[b][id] = val;
          res.changed++;
        });
      });
      ["code", "notes", "seen", "review", "prep"].forEach(function (b) {
        const src = next[b] || {};
        Object.keys(src).forEach(function (id) {
          const cur = state[b][id], val = src[id];
          const empty = function (v) { return v === undefined || v === null || v === ""; };
          if (empty(cur) && !empty(val)) { state[b][id] = val; res.changed++; }
        });
      });
      if (res.changed) { if (mode === "memory") { dirty = true; notify(); } else flush(); }
      return res;
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
  /* Порядок прохождения: урок с полем before встаёт прямо перед
     указанным уроком (0.2 «Python с нуля» — перед 2.1). Карта курса и
     номера уроков остаются по местам в модулях. */
  const order = flat.filter(function (l) { return !l.before; });
  flat.forEach(function (l) {
    if (!l.before) return;
    const at = order.findIndex(function (x) { return x.id === l.before; });
    order.splice(at < 0 ? order.length : at, 0, l);
  });
  const readyList = order.filter(function (l) { return l.ready; });

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
    /* неудачный тег убираем, иначе повторная попытка ждала бы его вечно */
    s.onerror = function () { s.remove(); rej(new Error("Не удалось загрузить " + src)); };
    document.head.appendChild(s);
  });
}
/* ---------- даты: локальный календарный день YYYY-MM-DD ---------- */
function isoDay(d) {
  d = d || new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" +
         String(d.getDate()).padStart(2, "0");
}
function fromIso(s) { const p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
function addDays(s, n) { const d = fromIso(s); d.setDate(d.getDate() + n); return isoDay(d); }
/* round, а не floor: при переходе на летнее время в сутках 23 или 25 часов */
function daysBetween(a, b) { return Math.round((fromIso(b) - fromIso(a)) / 864e5); }

/* выполнить, когда браузер освободится, — для фоновой подгрузки */
function idle(f) {
  if (window.requestIdleCallback) window.requestIdleCallback(f, { timeout: 4000 });
  else setTimeout(f, 1200);
}

/* ============================================================
   Ленивая загрузка

   Содержимое уроков и учебная база весят вместе ~650 КБ в сжатом
   виде, а главной не нужно ни то ни другое. Модуль уроков грузится,
   когда открывают его урок; база — перед первым запуском кода.
   В собранный одним файлом курс build.py кладёт всё внутрь заранее,
   и тогда загружать ничего не приходится.
   ============================================================ */

const Lazy = {
  has: function (moduleId) {
    const m = Course.data.modules.filter(function (x) { return x.id === moduleId; })[0];
    return !!m && m.lessons.every(function (l) { return !!window.CONTENT[l.id]; });
  },
  content: function (moduleId) {
    return Lazy.has(moduleId) ? Promise.resolve() : loadScript("content-" + moduleId + ".js");
  },
  data: function () {
    return window.DATA ? Promise.resolve() : loadScript("data.js");
  }
};

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
        '<span class="bl">' + (t === "dark" ? "Светлая" : "Тёмная") + "</span>";
      b.setAttribute("aria-label", "Переключить на " + (t === "dark" ? "светлую" : "тёмную") + " тему");
      b.setAttribute("title", "Переключить тему");
    }
    const m = $("#menuTheme");
    if (m) m.innerHTML = (t === "dark" ? ICON.sun : ICON.moon) + (t === "dark" ? "Светлая тема" : "Тёмная тема");
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
      const res = Store.merge(data);
      Router.render(true);
      const total = Course.doneCount(Course.flat);
      Progress.toast(res.added
        ? "Прогресс перенесён: добавилось " + res.added + " " +
          plural(res.added, "урок", "урока", "уроков") + ", всего пройдено " + total + "."
        : res.changed
          ? "Прогресс перенесён. Новых пройденных уроков в файле нет, а код, заметки, " +
            "время и повторение подтянулись."
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
        (Offline.ready()
          ? "<p>Курс уже открывается без интернета: страница и прочитанные уроки лежат " +
            "в браузере. Кнопка ниже докачает остальное — это около трёх мегабайт, " +
            "после чего курс читается целиком в самолёте и в метро.</p>"
          : "") +
        '<div class="actions" style="margin-top:16px">' +
          (Offline.ready()
            ? '<button class="btn" id="pgKeep" type="button">Сохранить курс на устройство</button>'
            : "") +
          '<button class="btn' + (risky ? " primary" : "") + '" id="pgReset" type="button">Начать курс заново</button>' +
        "</div>" +
        (Offline.ready() ? '<p class="pg-msg" id="pgKeepMsg"></p>' : "") +
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
    const keep = $("#pgKeep");
    if (keep) keep.addEventListener("click", function () { Offline.keep(keep, $("#pgKeepMsg")); });
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
   Работа без интернета

   Сам кеш ведёт sw.js. Отсюда его регистрируют, предупреждают о
   новой версии курса и — по кнопке — прогревают: запрашивают все
   файлы, которые обычно грузятся по мере чтения. Обслуживающий
   скрипт положит их в кеш по дороге, и дальше курс открывается
   с диска целиком.
   ============================================================ */

const Offline = {
  reg: null,

  /* На сайте файлы лежат рядом; в собранном одним файлом курсе всё
     уже внутри страницы, и обслуживать нечего. Отличаем по тегу
     script: в собранном файле скриптов с адресами нет. */
  supported: function () {
    return "serviceWorker" in navigator &&
           (location.protocol === "http:" || location.protocol === "https:") &&
           !!document.querySelector('script[src="app.js"]');
  },

  ready: function () {
    return Offline.supported() &&
           !!(Offline.reg || navigator.serviceWorker.controller);
  },

  init: function () {
    if (!Offline.supported()) return;
    navigator.serviceWorker.register("sw.js").then(function (reg) {
      Offline.reg = reg;
      /* Новая версия курса ставится сразу (sw.js, skipWaiting), но
         открытая страница работает со старым кодом в памяти, пока
         человек её не обновит, — говорим об этом, но не
         перезагружаем под руками. */
      reg.addEventListener("updatefound", function () {
        const w = reg.installing;
        if (!w) return;
        w.addEventListener("statechange", function () {
          if (w.state === "installed" && navigator.serviceWorker.controller) {
            Progress.toast("Вышла новая версия курса. Обновите страницу, чтобы её открыть.");
          }
        });
      });
    }).catch(function () { /* запретили — курс просто работает как обычный сайт */ });
  },

  /* Что докачать, чтобы курс открывался без интернета целиком. */
  files: function () {
    const own = ["content-m0.js", "content-m1.js", "content-m2.js", "content-m3.js",
                 "content-m4.js", "content-m5.js", "content-m6.js", "data.js"];
    /* редактор кода, движок SQL и вёрстка формул: без них урок
       откроется, но решать задачу будет нечем */
    const cdn = [CDN.cmBase + "codemirror.min.css", CDN.cmBase + "codemirror.min.js",
                 CDN.cmBase + "mode/sql/sql.min.js", CDN.cmBase + "mode/python/python.min.js",
                 CDN.sqlBase + "sql-wasm.js", CDN.sqlBase + "sql-wasm.wasm",
                 CDN.mathjax];
    return own.concat(cdn);
  },

  /* Три мегабайта молча не тянем: это отдельная кнопка и отдельный
     отчёт о том, что получилось. */
  keep: async function (btn, msg) {
    const list = Offline.files();
    let ok = 0, fail = 0;
    btn.disabled = true;
    for (let i = 0; i < list.length; i++) {
      msg.textContent = "Сохраняю… " + (i + 1) + " из " + list.length;
      try {
        await fetch(list[i], { cache: "no-store" });
        ok++;
      } catch (e) { fail++; }
    }
    btn.disabled = false;
    msg.textContent = fail
      ? "Сохранилось " + ok + " из " + list.length + " частей — похоже, связь оборвалась. " +
        "Нажмите ещё раз, когда интернет будет получше."
      : "Готово: курс открывается без интернета. Только Python при первом запуске " +
        "всё равно попросит связь — его движок слишком велик, чтобы держать его здесь.";
  }
};

/* ============================================================
   Шапка
   ============================================================ */

function mountHeader(crumbHtml) {
  const done = Course.doneCount(Course.flat);
  const total = Course.flat.length;

  /* разделы для подготовки — ссылками в шапке; на узком экране прячутся,
     туда ведут строка на главной и поиск */
  const here = location.hash.replace(/^#/, "");
  function navLink(to, t) {
    /* #glossary/left-join — тоже страница словаря */
    const on = to ? here === to || here.indexOf(to + "/") === 0 : here === "";
    return '<a href="#' + to + '"' + (on ? ' aria-current="page"' : "") + ">" + t + "</a>";
  }

  const hdr = el("header", { class: "hdr" });
  hdr.innerHTML =
    '<div class="hdr-in">' +
      '<a class="brand" href="#"><span class="mark">' + ICON.mark + '</span><span>Тетрадь аналитика</span></a>' +
      '<div class="crumbs">' + (crumbHtml || "") + "</div>" +
      '<div class="spacer"></div>' +
      '<nav class="hdr-nav" aria-label="Разделы">' + navLink("interview", "К собеседованию") +
        navLink("my-notes", "Конспект") + navLink("glossary", "Словарь") + "</nav>" +
      '<button class="iconbtn" id="findBtn" type="button" aria-label="Найти урок" ' +
        'title="Найти урок — косая черта или Cmd K">' + ICON.find +
        '<span class="bl">Найти</span><span class="k">/</span></button>' +
      '<button class="iconbtn" id="progBtn" type="button" title="Прогресс курса">' +
        '<span class="pb-n">' + done + " из " + total + "</span></button>" +
      '<button class="iconbtn" id="themeBtn" type="button">Тёмная</button>' +
      '<button class="iconbtn" id="menuBtn" type="button" aria-expanded="false" aria-controls="hdrMenu">' +
        ICON.menu + '<span class="bl">Меню</span></button>' +
    "</div>" +
    /* на узком экране ссылки шапки и тема уходят сюда */
    '<nav class="hdr-menu" id="hdrMenu" aria-label="Разделы" hidden>' +
      navLink("", "Курс") + navLink("interview", "К собеседованию") +
      navLink("my-notes", "Конспект") + navLink("glossary", "Словарь") +
      '<button class="hm-theme" id="menuTheme" type="button"></button>' +
    "</nav>" +
    '<div class="hdr-bar" id="hdrBar"></div>';

  const app = document.getElementById("app");
  app.parentNode.insertBefore(hdr, app);

  $("#themeBtn").addEventListener("click", Theme.toggle);
  $("#findBtn").addEventListener("click", Find.open);
  $("#progBtn").addEventListener("click", Progress.openMenu);
  $("#menuTheme").addEventListener("click", Theme.toggle);
  Menu.init();
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

/* Меню разделов на телефоне. Закрывается щелчком мимо, Escape и
   переходом по ссылке — переход и так перерисует шапку. */
const Menu = {
  init: function () {
    const btn = $("#menuBtn"), box = $("#hdrMenu");
    function set(open) {
      box.hidden = !open;
      btn.setAttribute("aria-expanded", String(open));
    }
    btn.addEventListener("click", function () {
      const open = box.hidden;
      set(open);
      if (open) box.querySelector("a, button").focus();
    });
    function outside(e) {
      /* путь, а не contains: кнопка темы перерисовывает себя, и к этому
         моменту щёлкнутый значок уже вынут из меню */
      const path = e.composedPath();
      if (!box.hidden && path.indexOf(box) < 0 && path.indexOf(btn) < 0) set(false);
    }
    function key(e) {
      if (e.key === "Escape" && !box.hidden) { set(false); btn.focus(); }
    }
    document.addEventListener("click", outside);
    document.addEventListener("keydown", key);
    Router.cleanup.push(function () {
      document.removeEventListener("click", outside);
      document.removeEventListener("keydown", key);
    });
  }
};

function refreshBar() {
  const bar = $("#hdrBar");
  if (bar) bar.style.width = Math.round(Course.doneCount(Course.flat) / Course.flat.length * 100) + "%";
  const pb = $("#progBtn .pb-n");
  if (pb) pb.textContent = Course.doneCount(Course.flat) + " из " + Course.flat.length;
}

Store.onChange(function () {
  const b = $("#progBtn");
  if (b) b.classList.toggle("unsaved", Store.mode() === "memory" && Store.isDirty());
});

/* ============================================================
   Главная: карта курса
   ============================================================ */


/* ============================================================
   Ваш путь: где остановились, сколько времени, серия дней
   ============================================================ */

const Stats = {
  started: function () {
    return Course.doneCount(Course.flat) > 0 || !!Store.get("seen", "last", null);
  },
  minutes: function () {
    const t = Store.all().time || {};
    return Math.round(Object.keys(t).reduce(function (s, k) { return s + (+t[k] || 0); }, 0) / 60);
  },
  /* Серия — сколько дней подряд было хотя бы по минуте занятий.
     Если сегодня ещё не садились, серия не прервана: считаем со вчера. */
  streak: function () {
    const days = Store.all().days || {};
    const active = function (d) { return (days[d] || 0) >= 60; };
    let d = isoDay();
    if (!active(d)) d = addDays(d, -1);
    let n = 0;
    while (active(d) && n < 3650) { n++; d = addDays(d, -1); }
    return n;
  },
  today: function () { return ((Store.all().days || {})[isoDay()] || 0) >= 60; },

  /* Фраза наставника о том, как идут дела. Серия считается со вчера,
     если сегодня ещё не садились, — поэтому «сегодня» и «вчера»
     различаем отдельно, иначе фраза соврёт. */
  phrase: function () {
    const done = Course.doneCount(Course.flat), total = Course.flat.length;
    if (done === total) return "Все " + total + " уроков пройдены. Дальше — повторение и собеседования.";
    const mins = Stats.minutes(), hrs = Math.round(mins / 60), streak = Stats.streak(), today = Stats.today();
    const time = mins < 60 ? mins + " " + plural(mins, "минута", "минуты", "минут")
                           : hrs + " " + plural(hrs, "час", "часа", "часов");
    /* время упоминаем, только если оно есть: после переноса прогресса
       без времени «0 минут за курсом» звучало бы как упрёк */
    const head = done
      ? done + " " + plural(done, "урок", "урока", "уроков") + " из " + total +
        (mins ? " и " + time + " за курсом." : ".")
      : mins ? time + " за курсом, первый урок вот-вот." : "Первый урок ещё впереди.";
    const run =
      today && streak >= 2 ? streak + " " + plural(streak, "день", "дня", "дней") + " подряд — не сбавляйте."
      : today ? "Сегодня уже занимались — хорошее начало серии."
      : streak >= 2 ? "Серия — " + streak + " " + plural(streak, "день", "дня", "дней") + ", сегодня её легко продолжить."
      : streak === 1 ? "Вчера занимались — сегодня самое время продолжить."
      : "Сегодня хороший день, чтобы продолжить.";
    return head + " " + run;
  },

  /* Календарь занятий: двенадцать недель, неделя — столбец, понедельник
     сверху. День отмечен штрихом ручкой — чем дольше занимались, тем
     длиннее и жирнее штрих; сегодняшний день обведён. Наклон, изгиб и
     длина каждого штриха выведены из даты, поэтому от перерисовки к
     перерисовке календарь не пляшет: он всегда один и тот же.      */
  calendar: function () {
    const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля",
                    "августа", "сентября", "октября", "ноября", "декабря"];
    const SHORT = ["янв", "фев", "мар", "апр", "май", "июн", "июл",
                   "авг", "сен", "окт", "ноя", "дек"];
    const CELL = 17, HALF = 7, TOP = 13;
    const W = 12 * CELL - 3, H = TOP + 7 * CELL - 3;
    const days = Store.all().days || {}, today = isoDay();
    const wd = (fromIso(today).getDay() + 6) % 7;           /* 0 — понедельник */
    const start = addDays(today, -(7 * 11 + wd));

    /* «дрожание руки»: для одной и той же даты — всегда одно число */
    function hand(seed, n) {
      let h = 2166136261;
      for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
      return ((Math.imul(h ^ n, 16777619) >>> 0) % 1000) / 1000;
    }
    function r1(n) { return Math.round(n * 10) / 10; }

    let marks = "", months = "", ring = "", active = 0, seenMonth = -1;
    for (let w = 0; w < 12; w++) {
      for (let d = 0; d < 7; d++) {
        const day = addDays(start, w * 7 + d);
        if (day > today) continue;
        const dt = fromIso(day), sec = days[day] || 0;
        const cx = w * CELL + HALF, cy = TOP + d * CELL + HALF;

        /* месяц подписан над той неделей, в которой он начался */
        if (dt.getMonth() !== seenMonth) {
          seenMonth = dt.getMonth();
          months += '<text class="cal-mo" x="' + (w * CELL) + '" y="6">' + SHORT[seenMonth] + "</text>";
        }

        if (day === today) {
          /* обводка: перо заходит за начало круга, как это и выходит от руки */
          const rx = 8.4 + hand(day, 9) * 0.7, ry = 7.6 + hand(day, 10) * 0.7;
          ring = '<path class="cal-ring" d="M' + r1(cx - rx) + " " + r1(cy + 0.8) +
            " C" + r1(cx - rx) + " " + r1(cy - ry * 1.35) + " " + r1(cx + rx) + " " + r1(cy - ry * 1.3) +
            " " + r1(cx + rx * 0.94) + " " + r1(cy + 0.4) +
            " C" + r1(cx + rx * 0.88) + " " + r1(cy + ry * 1.4) + " " + r1(cx - rx * 1.06) + " " + r1(cy + ry * 1.3) +
            " " + r1(cx - rx * 1.12) + " " + r1(cy - 1.8) + '"/>';
        }

        const lvl = sec >= 3600 ? 3 : sec >= 1200 ? 2 : sec >= 60 ? 1 : 0;
        const tip = dt.getDate() + " " + MONTHS[dt.getMonth()] +
          (sec >= 60 ? ", " + Math.round(sec / 60) + " мин" : ", не занимались");

        if (!lvl) {                       /* пустой день — точка линовки */
          marks += '<circle class="cal-n" cx="' + cx + '" cy="' + cy + '" r="1.1"><title>' +
                   tip + "</title></circle>";
          continue;
        }
        active++;
        const a = -0.44 + hand(day, 1) * 0.5;                    /* наклон штриха */
        const len = (lvl === 1 ? 3.5 : lvl === 2 ? 5 : 6.4) + hand(day, 2) * 0.9;
        const bow = (hand(day, 3) - 0.5) * 2;                    /* лёгкий изгиб пера */
        const sx = cx + Math.sin(a) * len, sy = cy - Math.cos(a) * len;
        const ex = cx - Math.sin(a) * len, ey = cy + Math.cos(a) * len;
        marks += '<path class="cal-m l' + lvl + '" d="M' + r1(sx) + " " + r1(sy) +
          " Q" + r1(cx + Math.cos(a) * bow) + " " + r1(cy + Math.sin(a) * bow) +
          " " + r1(ex) + " " + r1(ey) + '"><title>' + tip + "</title></path>";
      }
    }

    return '<div class="cal"><svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' +
      "Календарь занятий за двенадцать недель: занимались " + active + " " +
      plural(active, "день", "дня", "дней") + '">' + months + marks + ring + "</svg></div>";
  },

  /* Куда вернуться: к последнему открытому уроку, если он не пройден,
     иначе к следующему непройденному. Новичку карточка не нужна. */
  resume: function () {
    const last = Course.byId(Store.get("seen", "last", null) || "");
    if (last && last.ready && !Course.isDone(last.id)) return { lesson: last, fresh: false };
    if (!last && Course.doneCount(Course.flat) === 0) return null;
    const from = last ? Course.ready.indexOf(last) : -1;
    const order = Course.ready.slice(from + 1).concat(Course.ready.slice(0, from + 1));
    const next = order.filter(function (l) { return !Course.isDone(l.id); })[0];
    return next ? { lesson: next, fresh: true } : null;
  }
};

/* ============================================================
   Карточка «вопрос → ответ»

   Одна карточка в box: вопрос и «Показать ответ», затем ответ под
   чертой и две оценки. onRate(ok) вызывается ровно один раз. Какую
   карточку показать следующей и писать ли оценку в расписание —
   решает тот, кто вызвал: колода в уроке или повторение на главной.
   ============================================================ */

const Flash = {
  card: function (box, card, meta, onRate) {
    box.innerHTML =
      '<div class="fc">' +
        '<div class="fc-meta">' + meta + "</div>" +
        '<div class="fc-q">' + card.q + "</div>" +
        '<div class="fc-a" aria-live="polite"></div>' +
        '<div class="fc-act">' +
          '<button class="btn primary fc-show" type="button">Показать ответ</button>' +
        "</div>" +
      "</div>";
    const root = $(".fc", box), act = $(".fc-act", root), ans = $(".fc-a", root);
    let rated = false;
    Terms.mark($(".fc-q", root));

    function show() {
      if (root.classList.contains("open")) return;
      root.classList.add("open");
      ans.innerHTML = card.a;
      Terms.mark(ans);
      act.innerHTML =
        '<button class="btn fc-no" type="button">Не вспомнил</button>' +
        '<button class="btn primary fc-yes" type="button">Вспомнил</button>';
      $(".fc-no", act).addEventListener("click", function () { rate(false); });
      $(".fc-yes", act).addEventListener("click", function () { rate(true); });
      $(".fc-yes", act).focus({ preventScroll: true });
    }
    function rate(ok) {
      if (rated) return;
      rated = true;
      root.classList.add(ok ? "yes" : "no");
      Array.prototype.forEach.call(act.querySelectorAll("button"), function (b) { b.disabled = true; });
      onRate(ok);
    }

    $(".fc-show", act).addEventListener("click", show);
    /* Пробел и Enter нажимают кнопку в фокусе сами — «Показать ответ»,
       потом «Вспомнил». Стрелки — оценка, когда ответ уже открыт. */
    root.addEventListener("keydown", function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey || rated || !root.classList.contains("open")) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); rate(false); }
      else if (e.key === "ArrowRight") { e.preventDefault(); rate(true); }
    });
    return root;
  }
};

/* ============================================================
   Повторение

   Вопрос из самопроверки и карточка из урока возвращаются через 1, 3,
   7 и 21 день. Верный ответ или «вспомнил» переводит на ступень дальше,
   ошибка — снова на завтра. Верный ответ на последней ступени — выучено,
   из очереди уходит. Хранится в Store: «урок:номер» — вопрос,
   «урок:cномер» — карточка; miss — сколько раз ошибся или не вспомнил.
   ============================================================ */

const Review = {
  STEPS: [1, 3, 7, 21],
  LIMIT: 20,              /* больше за раз — уже не пять минут, а урок */

  parse: function (k) {
    const m = /^([^:]+):(c?)(\d+)$/.exec(k);
    return m ? { key: k, id: m[1], kind: m[2] ? "card" : "quiz", n: +m[3] } : null;
  },

  /* ref — номер вопроса или "c" + номер карточки. false — запись
     пропущена: повторный проход в уроке не должен сбивать расписание. */
  record: function (id, ref, ok, fromLesson) {
    const k = id + ":" + ref;
    const cur = Store.get("review", k, null);
    if (fromLesson && cur) return false;
    const step = cur ? cur.step : -1;
    const miss = ((cur && cur.miss) || 0) + (ok ? 0 : 1);
    if (ok && step + 1 >= Review.STEPS.length) {
      Store.set("review", k, { step: step, done: true, miss: miss });
      return true;
    }
    const next = ok ? step + 1 : 0;
    Store.set("review", k, { step: next, due: addDays(isoDay(), Review.STEPS[next]), miss: miss });
    return true;
  },

  items: function () {
    const all = Store.all().review || {};
    return Object.keys(all).map(function (k) {
      const x = Review.parse(k);
      if (x) x.r = all[k];
      return x;
    }).filter(function (x) {
      return x && x.r && !x.r.done && x.r.due && Course.byId(x.id);
    });
  },
  due: function () {
    const t = isoDay();
    return Review.items().filter(function (x) { return x.r.due <= t; });
  },
  nextDate: function () {
    const t = isoDay();
    return Review.items().map(function (x) { return x.r.due; })
      .filter(function (d) { return d > t; }).sort()[0] || null;
  },
  when: function (iso) {
    const n = daysBetween(isoDay(), iso);
    if (n <= 1) return "завтра";
    if (n === 2) return "послезавтра";
    return "через " + n + " " + plural(n, "день", "дня", "дней");
  },

  /* «12: 5 вопросов и 7 карточек», а если вид один — «7 карточек» */
  say: function (list) {
    const c = list.filter(function (x) { return x.kind === "card"; }).length;
    const q = list.length - c;
    const qs = q + " " + plural(q, "вопрос", "вопроса", "вопросов");
    const cs = c + " " + plural(c, "карточка", "карточки", "карточек");
    return q && c ? list.length + ": " + qs + " и " + cs : c ? cs : qs;
  },

  /* Блок на главной. Пока в очереди ничего нет, его нет вовсе. */
  section: function () {
    const due = Review.due(), next = Review.nextDate();
    if (!due.length && !next) return null;
    const n = Math.min(due.length, Review.LIMIT);
    const node = el("section", { class: "review has-margin" });
    node.innerHTML =
      '<div class="aside"><p>вспомнить с усилием — это и есть запоминание</p></div>' +
      '<div class="sec-title">Повторение</div>' +
      '<div class="review-body">' +
      (due.length
        ? '<p class="review-intro">' +
            (due.length > n
              ? "Накопилось " + Review.say(due) + ", сегодня возьмём " + n + ". "
              : "Сегодня " + Review.say(due) + " из пройденных уроков. ") +
            "Минут пять — и материал останется с вами надолго.</p>" +
          '<button class="btn primary" id="rvStart" type="button">Начать повторение</button>'
        : '<p class="review-later">Всё повторено. Следующие вопросы вернутся ' + Review.when(next) + ".</p>") +
      "</div>";
    const start = $("#rvStart", node);
    if (start) start.addEventListener("click", function () { Review.run($(".review-body", node)); });
    return node;
  },

  run: function (box) {
    const list = Review.due();
    const order = shuffled(list.length).slice(0, Review.LIMIT).map(function (i) { return list[i]; });
    const mods = {};
    order.forEach(function (x) { mods[Course.byId(x.id).module.id] = true; });
    box.innerHTML = '<p class="review-intro">Достаю вопросы…</p>';
    Promise.all(Object.keys(mods).map(function (m) { return Lazy.content(m); })).then(function () {
      /* урок могли переписать — вопроса или карточки с таким номером может уже не быть */
      const ok = order.filter(function (x) {
        const C = window.CONTENT[x.id];
        const items = C && (x.kind === "card" ? C.cards : C.quiz);
        return items && items[x.n];
      });
      Review.step(box, ok, 0, 0);
    }, function () {
      box.innerHTML = '<p class="review-intro">Вопросы не загрузились — похоже, пропал интернет.</p>' +
        '<button class="btn" id="rvRetry" type="button">Попробовать ещё раз</button>';
      $("#rvRetry", box).addEventListener("click", function () { Review.run(box); });
    });
  },

  step: function (box, order, i, right) {
    if (i >= order.length) {
      const next = Review.nextDate();
      box.innerHTML = '<p class="review-intro">Готово: верно ' + right + " из " + order.length + ". " +
        (next ? "Следующие вопросы вернутся " + Review.when(next) + "." : "Все вопросы выучены.") + "</p>" +
        '<button class="btn" id="rvClose" type="button">Закрыть</button>';
      $("#rvClose", box).addEventListener("click", function () { Router.render(true); });
      return;
    }
    const x = order[i], L = Course.byId(x.id), C = window.CONTENT[x.id];
    const from = " из " + order.length + ", из урока " + L.num + " «" + esc(L.title) + "»";
    const nextHtml = '<div class="rv-next" hidden><button class="btn primary" type="button">' +
      (i + 1 < order.length ? "Дальше" : "Закончить") + "</button></div>";

    /* после ответа — кнопка дальше, фокус на неё: можно идти с клавиатуры */
    function next(ok) {
      const nx = $(".rv-next", box);
      nx.hidden = false;
      const nb = $("button", nx);
      nb.addEventListener("click", function () { Review.step(box, order, i + 1, right + (ok ? 1 : 0)); });
      nb.focus();
    }

    if (x.kind === "card") {
      box.innerHTML = '<div class="rv-card"></div>' + nextHtml;
      const root = Flash.card($(".rv-card", box), C.cards[x.n], "Карточка " + (i + 1) + from, function (ok) {
        Review.record(x.id, "c" + x.n, ok, false);
        next(ok);
      });
      $(".fc-show", root).focus({ preventScroll: true });
      return;
    }

    const q = C.quiz[x.n];
    let h = '<div class="rv-meta">Вопрос ' + (i + 1) + from + "</div>" +
      '<div class="q"><div class="q-t"><span>' + q.q + '</span></div><div class="q-opts">';
    shuffled(q.opts.length).forEach(function (orig, pos) {
      h += '<button class="q-opt" type="button" data-i="' + orig + '">' +
        '<span class="mk">' + "АБВГД".charAt(pos) + "</span><span>" + q.opts[orig] + "</span></button>";
    });
    h += '</div><div class="q-why"><b>Почему:</b> ' + q.why + "</div></div>" + nextHtml;
    box.innerHTML = h;

    const opts = Array.prototype.slice.call(box.querySelectorAll(".q-opt"));
    opts.forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (btn.disabled) return;
        const picked = +btn.dataset.i, ok = picked === q.right;
        Review.record(x.id, x.n, ok, false);
        opts.forEach(function (b) {
          b.disabled = true;
          const oi = +b.dataset.i;
          if (oi === q.right) b.classList.add("right");
          else if (oi === picked) b.classList.add("wrong");
        });
        $(".q-why", box).classList.add("show");
        next(ok);
      });
    });
  }
};

/* ============================================================
   Отдельные страницы: к собеседованию, конспект, итог модуля

   Адреса выбраны так, чтобы не совпасть ни с одним id на странице:
   роутер принимает хэш за якорь, если такой элемент есть (#notes —
   это поле заметок в уроке).
   ============================================================ */

const Pages = {
  find: function (id) {
    if (id === "interview") return renderInterview;
    if (id === "my-notes") return renderMyNotes;
    if (/^glossary(\/[\w-]+)?$/.test(id)) return renderGlossary;
    if (/^summary-m\d+$/.test(id)) return renderSummary;
    return null;
  }
};

const MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля",
                    "августа", "сентября", "октября", "ноября", "декабря"];

/* Пункты врезок «Что закрывает урок в вакансиях» из всех уроков.
   Группа — по началу пункта: вопросы («Вопрос на интервью», «Устный
   вопрос», «Вопрос-ловушка»…), задачи («Задача с интервью», «Тестовое
   задание»…) и всё остальное — формулировки из вакансий. */
function interviewItems() {
  const out = [];
  Course.flat.forEach(function (l) {
    const C = window.CONTENT[l.id];
    const m = C && (C.theory || "").match(/<div class="callout jobs">([\s\S]*?)<\/div>/);
    if (!m) return;
    (m[1].match(/<li>[\s\S]*?<\/li>/g) || []).forEach(function (li, i) {
      const html = li.replace(/^<li>|<\/li>$/g, "").trim();
      const text = html.replace(/<[^>]+>/g, "");
      const kind = /^(Устный вопрос|Вопрос[^:«]{0,20}):/.test(text) ? "ask"
        : /^[^:«]{0,30}(задач|задани)[^:«]{0,20}:/i.test(text) ? "task" : "req";
      out.push({ lesson: l, i: i, kind: kind, html: html });
    });
  });
  return out;
}

function pageHead(title, sub, say, extra) {
  return '<header class="lesson-head has-margin">' +
    (say ? '<div class="aside"><p>' + esc(say) + "</p></div>" : "") +
    "<h1>" + title + "</h1>" + '<p class="sub">' + sub + "</p>" + (extra || "") + "</header>";
}

function prepItem(x, withMark) {
  const key = x.lesson.id + ":" + x.i;
  const on = withMark && !!Store.get("prep", key, false);
  return '<li class="prep-item' + (on ? " on" : "") + '">' +
    (withMark ? '<button class="prep-mark" type="button" data-key="' + key + '" aria-pressed="' + on + '" ' +
                'aria-label="Готов ответить">' + (on ? penTick(key) : "") + "</button>" : "") +
    '<div class="prep-t">' + x.html +
      '<a class="prep-from" href="#' + x.lesson.id + '">урок ' + x.lesson.num + " " + esc(x.lesson.title) + "</a>" +
    "</div></li>";
}

/* ---------- к собеседованию ---------- */
function renderInterview(app) {
  document.title = "К собеседованию — Тетрадь аналитика";
  mountHeader("<b>К собеседованию</b>");
  const main = el("main", { class: "wrap lesson-wrap page" });
  main.innerHTML = pageHead("К собеседованию",
    "Всё, что в уроках помечено как вопросы и задачи с интервью, — на одной странице. " +
    "Ответьте вслух, сверьтесь с уроком и отметьте то, в чём уверены.",
    "вслух и своими словами — иначе на интервью слова не найдутся") +
    '<div id="prepBody"><p class="page-wait">Собираю вопросы из уроков…</p></div>';
  app.appendChild(main);

  /* вопросы лежат в содержимом уроков — нужны все шесть модулей */
  Promise.all(Course.data.modules.map(function (m) { return Lazy.content(m.id); })).then(function () {
    const box = $("#prepBody");
    if (!box || location.hash !== "#interview") return;
    const items = interviewItems();
    const groups = [["ask", "Что спросят устно"], ["task", "Какие задачи дают"], ["req", "Что пишут в вакансиях"]];
    let h = '<p class="prep-sum" id="prepSum"></p>';
    groups.forEach(function (g) {
      const list = items.filter(function (x) { return x.kind === g[0]; });
      if (!list.length) return;
      h += '<section class="block"><div class="block-h"><h2>' + g[1] +
        '<span class="prep-n">' + list.length + "</span></h2></div>" +
        '<ol class="prep-list">' + list.map(function (x) { return prepItem(x, true); }).join("") + "</ol></section>";
    });
    box.innerHTML = h;

    function sum() {
      const on = box.querySelectorAll(".prep-item.on").length;
      $("#prepSum").textContent = on
        ? "Готовы ответить на " + on + " из " + items.length + (on === items.length ? ". Можно откликаться." : ".")
        : "Отмечайте то, в чём уверены, — будет честно видно, что ещё повторить.";
    }
    sum();
    Array.prototype.forEach.call(box.querySelectorAll(".prep-mark"), function (b) {
      b.addEventListener("click", function () {
        const key = b.dataset.key, on = b.getAttribute("aria-pressed") !== "true";
        Store.set("prep", key, on);
        b.setAttribute("aria-pressed", String(on));
        b.innerHTML = on ? penTick(key, "draw") : "";
        b.closest(".prep-item").classList.toggle("on", on);
        sum();
      });
    });
  }, function () {
    const box = $("#prepBody");
    if (!box) return;
    box.innerHTML = '<p class="page-wait">Вопросы не загрузились — похоже, пропал интернет. ' +
      '<button class="linkbtn" id="prepRetry" type="button">Попробовать ещё раз</button></p>';
    $("#prepRetry").addEventListener("click", function () { Router.render(true); });
  });
}

/* ---------- мой конспект ---------- */
function renderMyNotes(app) {
  document.title = "Мой конспект — Тетрадь аналитика";
  mountHeader("<b>Мой конспект</b>");
  const notes = Store.all().notes || {};
  const withNotes = Course.flat.filter(function (l) { return String(notes[l.id] || "").trim(); });
  const n = withNotes.length;
  let h = pageHead("Мой конспект",
    n ? "Заметки из " + n + " " + plural(n, "урока", "уроков", "уроков") + " в одном месте. " +
        "Перед собеседованием удобно распечатать или сохранить в PDF."
      : "Здесь соберутся ваши заметки из всех уроков. Пока их нет — они пишутся в поле " +
        "«Мои заметки» в конце каждого урока.",
    "перечитать свои слова перед собеседованием — лучшая шпаргалка",
    n ? '<div class="page-actions"><button class="btn" id="printBtn" type="button">Распечатать или сохранить в PDF</button></div>' : "");
  Course.data.modules.forEach(function (m) {
    const ls = withNotes.filter(function (l) { return l.module === m; });
    if (!ls.length) return;
    h += '<section class="block"><div class="block-h"><h2>' + m.num + ". " + esc(m.title) + "</h2></div>" +
      ls.map(function (l) {
        return '<article class="nt-item"><h3 class="nt-h"><a href="#' + l.id + '">' + l.num + " " + esc(l.title) + "</a></h3>" +
          '<div class="nt-body">' + esc(String(notes[l.id]).trim()) + "</div></article>";
      }).join("") + "</section>";
  });
  if (!n) {
    const r = Stats.resume();
    h += '<p class="page-empty"><a href="#' + (r ? r.lesson.id : "m1l1") + '">' +
      (r ? "Открыть урок " + r.lesson.num : "Открыть первый урок") + "</a></p>";
  }
  const main = el("main", { class: "wrap lesson-wrap page" });
  main.innerHTML = h;
  app.appendChild(main);
  const pb = $("#printBtn");
  if (pb) pb.addEventListener("click", function () { window.print(); });
}

/* ---------- итог модуля ---------- */
/* Словарь: все термины курса на одной странице, в порядке курса.
   В уроке слово объясняет себя по тапу; сюда приходят, когда хотят
   найти слово самим, — из шапки, из поиска или по ссылке «Весь
   словарь» под объяснением. Адрес #glossary/<id> открывает страницу
   на нужном термине. */
function renderGlossary(app, id) {
  document.title = "Словарь — Тетрадь аналитика";
  mountHeader("<b>Словарь</b>");
  const G = window.GLOSSARY;
  const main = el("main", { class: "wrap lesson-wrap page" });
  if (!G) {
    main.innerHTML = pageHead("Словарь",
      "Словарь не загрузился — похоже, пропал интернет. Обновите страницу, когда связь вернётся.");
    app.appendChild(main);
    return;
  }
  /* объяснение в словаре пишется со строчной — оно продолжает «Термин — …»;
     на странице оно стоит отдельным абзацем */
  function upper(s) { return /^[а-яёa-z]/.test(s) ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  const n = G.terms.length;
  let h = pageHead("Словарь",
    "Все " + n + " " + plural(n, "термин", "термина", "терминов") + " курса простыми словами. " +
    "В уроках они подчёркнуты пунктиром: нажмите на слово, и объяснение раскроется прямо в тексте.",
    "непонятное слово — не повод бросать абзац");
  [["sql", "Конструкции SQL"], ["ch", "ClickHouse"], ["db", "Базы данных"], ["word", "Слова аналитика"]]
    .forEach(function (g) {
      const list = G.terms.filter(function (t) { return t.kind === g[0]; });
      if (!list.length) return;
      h += '<section class="block"><div class="block-h"><h2>' + g[1] + "</h2></div>" +
        list.map(function (t) {
          const L = t.lesson ? Course.byId(t.lesson) : null;
          return '<article class="gl-item" id="g-' + t.id + '">' +
            '<h3 class="gl-t">' + (t.code ? "<code>" + t.t + "</code>" : t.t) + "</h3>" +
            '<p class="gl-p">' + upper(t.plain) + "</p>" +
            (t.when ? '<p class="tx-when"><b>Когда нужно:</b> ' + t.when + "</p>" : "") +
            (t.ex ? '<p class="tx-ex">Например: ' + t.ex + "</p>" : "") +
            (L ? '<a class="tx-more" href="#' + L.id + '">Подробно — урок ' + L.num + " " + esc(L.title) + "</a>" : "") +
            "</article>";
        }).join("") + "</section>";
    });
  main.innerHTML = h;
  app.appendChild(main);
  const want = id.split("/")[1];
  const target = want && document.getElementById("g-" + want);
  if (target) {
    target.classList.add("on");
    /* при первом заходе шрифты приходят позже и удлиняют текст выше —
       прокрутка до них уезжала на полэкрана мимо термина. Сразу, без
       плавности из styles.css: иначе страница заметно едет через весь
       словарь. */
    const fonts = document.fonts ? document.fonts.ready : Promise.resolve();
    fonts.then(function () {
      if (target.isConnected) target.scrollIntoView({ block: "center", behavior: "instant" });
    });
  }
}

function renderSummary(app, id) {
  const mods = Course.data.modules;
  const m = mods.filter(function (x) { return "summary-" + x.id === id; })[0];
  if (!m) { renderLesson(app, id); return; }
  document.title = "Итог модуля " + m.num + " — Тетрадь аналитика";
  mountHeader("<b>Модуль " + m.num + ":</b> " + esc(m.title) + ", итог");

  const d = Course.doneCount(m.lessons), t = m.lessons.length, closed = d === t;
  const time = Store.all().time || {}, doneAt = Store.all().done || {};
  const mins = Math.round(m.lessons.reduce(function (s, l) { return s + (+time[l.id] || 0); }, 0) / 60);
  const hrs = Math.round(mins / 60);
  /* даты — только настоящие отметки, а не пустые и не из тестовых выгрузок */
  const stamps = m.lessons.map(function (l) { return doneAt[l.id]; })
    .filter(function (v) { return typeof v === "number" && v > 1577836800000; }).sort();
  const day = function (ms) { const x = new Date(ms); return x.getDate() + " " + MONTHS_GEN[x.getMonth()]; };
  const span = stamps.length >= 2 ? ", с " + day(stamps[0]) + " по " + day(stamps[stamps.length - 1])
             : stamps.length ? ", " + day(stamps[0]) : "";
  const work = mins ? ", " + (mins < 60 ? mins + " " + plural(mins, "минута", "минуты", "минут")
                                        : hrs + " " + plural(hrs, "час", "часа", "часов")) + " работы" : "";

  /* Что дальше — по порядку прохождения, а не по карте: первый
     непройденный урок после последнего урока модуля. Если он не из
     следующего модуля (0.2 после модуля 1, 2.1 после модуля 0), зовём
     прямо в урок. */
  const at = Math.max.apply(null, m.lessons.map(function (l) { return Course.ready.indexOf(l); }));
  const after = closed ? Course.ready.slice(at + 1).filter(function (l) { return !Course.isDone(l.id); })[0] || null : null;
  const detour = !!after && after.module !== mods[mods.indexOf(m) + 1];
  const next = closed ? (after ? after.module : null) : m;
  const target = detour ? after : next ? (next.lessons.filter(function (l) { return !Course.isDone(l.id); })[0] || next.lessons[0]) : null;
  const nextHtml = !target
    ? '<p class="page-empty">Это был последний модуль. Дальше — <a href="#interview">подготовка к собеседованию</a>.</p>'
    : '<a class="resume" href="#' + target.id + '"><span class="resume-txt">' +
        '<span class="resume-k">' + (detour ? "Дальше по порядку" : closed ? "Дальше — модуль " + next.num : "Осталось в модуле") + "</span>" +
        '<span class="resume-t">' + (closed && !detour ? esc(next.title) : target.num + " " + esc(target.title)) + "</span>" +
        '<span class="resume-d">' + esc(closed && !detour ? next.sub : target.desc) + "</span>" +
      '</span><span class="resume-go">' + (closed ? "Начать" : "Продолжить") + "</span></a>";

  const main = el("main", { class: "wrap lesson-wrap page" });
  main.innerHTML =
    pageHead(closed ? "Модуль " + m.num + " закрыт" : "Модуль " + m.num + ": пройдено " + d + " из " + t,
      esc(m.title) + ". " + d + " " + plural(d, "урок", "урока", "уроков") + work + span + ".",
      closed ? (m.sayDone || m.say) : m.say) +
    '<section class="block"><div class="block-h"><h2>' + (closed ? "Что теперь умеете" : "Уроки модуля") + "</h2></div>" +
      '<ul class="sum-list">' + m.lessons.map(function (l) {
        const ok = Course.isDone(l.id);
        return '<li><span class="sum-c">' + (ok ? penTick(l.id) + '<span class="sr">пройден</span>' : "") + "</span>" +
          '<a class="sum-l" href="#' + l.id + '"><span class="sum-t">' + esc(l.title) + "</span>" +
          '<span class="sum-d">' + esc(l.desc) + "</span></a></li>";
      }).join("") + "</ul></section>" +
    '<section class="block"><div class="block-h"><h2>Вопросы собеседования из модуля</h2></div>' +
      '<div id="sumJobs"><p class="page-wait">Собираю вопросы…</p></div></section>' +
    '<section class="block">' + nextHtml + "</section>";
  app.appendChild(main);

  Lazy.content(m.id).then(function () {
    const box = $("#sumJobs");
    if (!box || location.hash !== "#" + id) return;
    const items = interviewItems().filter(function (x) { return x.lesson.module === m && x.kind !== "req"; });
    box.innerHTML = items.length
      ? '<ol class="prep-list">' + items.map(function (x) { return prepItem(x, false); }).join("") + "</ol>" +
        '<p class="prep-more">Отметить, что готовы ответить, — <a href="#interview">на странице к собеседованию</a>.</p>'
      : '<p class="page-empty">Вопросы с интервью здесь не выделены — загляните ' +
        '<a href="#interview">на страницу к собеседованию</a>.</p>';
  }, function () {
    const box = $("#sumJobs");
    if (box) box.innerHTML = '<p class="page-wait">Вопросы не загрузились — похоже, пропал интернет.</p>';
  });
}

function renderHome(app) {
  document.title = "Тетрадь аналитика — курс подготовки к Junior Data Analyst";
  mountHeader("");

  const done = Course.doneCount(Course.flat);

  /* обложка: каждая клетка — урок */
  let mapHtml = "";
  Course.data.modules.forEach(function (m) {
    const cells = m.lessons.map(function (l) {
      const d = Course.isDone(l.id);
      const cls = "cell" + (d ? " done" : "") + (l.ready ? "" : " locked");
      const title = l.num + " " + l.title + (l.ready ? (d ? ", пройден" : "") : ", скоро");
      return l.ready
        ? '<a class="' + cls + '" href="#' + l.id + '" title="' + esc(title) + '">' + (d ? penTick(l.id) : "") + "</a>"
        : '<span class="' + cls + '" title="' + esc(title) + '"></span>';
    }).join("");
    mapHtml += '<div class="map-mod"><div class="map-mod-h">' + m.num + ". " + esc(m.title) +
               '</div><div class="map-cells">' + cells + "</div></div>";
  });

  /* Вернувшемуся человеку первым делом нужно «где я остановился»,
     а не описание курса, — поэтому карточка стоит сразу под заголовком. */
  const resume = Stats.resume();
  const resumeHtml = resume
    ? '<a class="resume" href="#' + resume.lesson.id + '">' +
        '<span class="resume-txt">' +
          '<span class="resume-k">' + (resume.fresh ? "Следующий урок" : "Вы остановились здесь") + "</span>" +
          '<span class="resume-t">' + resume.lesson.num + " " + esc(resume.lesson.title) + "</span>" +
          '<span class="resume-d">' + esc(resume.lesson.desc) + "</span>" +
        "</span>" +
        '<span class="resume-go">Продолжить</span>' +
      "</a>"
    : "";

  /* Как дела — не рядом цифр с подписями, а фразой наставника и календарём
     занятий: смысл тот же, но это разговор, а не панель показателей.
     Новичку это не нужно — о курсе уже сказано выше. */
  const paceHtml = Stats.started()
    ? '<div class="pace"><p class="pace-say">' + esc(Stats.phrase()) + "</p>" + Stats.calendar() + "</div>"
    : "";

  const hero = el("section", { class: "hero" });
  hero.innerHTML =
    '<div class="wrap hero-in has-margin">' +
      '<div class="aside"><p>за 2-3 месяца реально, если по часу-два в день</p>' +
        "<p>начните с первого модуля, остальное подождёт</p></div>" +
      "<h1>Тетрадь аналитика данных</h1>" +
      '<p class="lede">Программа на 2-3 месяца до первого оффера. Каждый урок ' +
        "заканчивается задачей, которую вы решаете прямо в браузере.</p>" +
      resumeHtml +
      '<div class="map">' + mapHtml + "</div>" +
      paceHtml +
      /* Пустой курс — единственный момент, когда перенос вообще уместен:
         дальше эта строка только мешала бы. */
      (done === 0
        ? '<p class="carry">Занимались в прошлой версии курса? ' +
          '<button class="linkbtn" id="carryBtn" type="button">Перенесите прогресс</button> ' +
          "или просто перетащите сюда файл, выгруженный оттуда.</p>"
        : "") +
    "</div>";
  app.appendChild(hero);

  /* модуль урока из карточки «продолжить» подтягиваем заранее */
  if (resume) idle(function () { Lazy.content(resume.lesson.module.id).catch(function () {}); });

  const carry = $("#carryBtn", hero);
  if (carry) carry.addEventListener("click", Progress.load);


  const main = el("main", { class: "wrap" });

  /* повторение — первым в программе: оно на сегодня, программа — на месяцы */
  const review = Review.section();
  if (review) main.appendChild(review);

  /* о страницах для собеседования — одна строка, а не ещё один блок карточек */
  main.insertAdjacentHTML("beforeend",
    '<p class="prep-line">Готовитесь к собеседованию? Все вопросы и задачи с интервью собраны ' +
    '<a href="#interview">на одной странице</a>, а ваши заметки — <a href="#my-notes">в конспекте</a>. ' +
    'Непонятное слово объяснит <a href="#glossary">словарь</a>.</p>');

  /* ---------- программа: оглавление тетради ---------- */
  /* Не карточки, а оглавление: номер, название, отточие, вид практики
     и галочка ручкой у пройденных. Всё видно сразу, без раскрытий. */
  const toc = el("section", { class: "toc" });
  let tocHtml = '<div class="sec-title">Оглавление</div>';
  Course.data.modules.forEach(function (m) {
    const d = Course.doneCount(m.lessons), t = m.lessons.length;
    tocHtml +=
      '<section class="toc-mod">' +
        '<header class="toc-mh">' +
          '<span class="toc-mn">' + m.num + "</span>" +
          '<h3 class="toc-mt">' + esc(m.title) + "</h3>" +
          '<span class="toc-mw">' + (d === t ? '<a href="#summary-' + m.id + '">пройден, итог</a>' : d ? d + " из " + t : esc(m.weeks)) + "</span>" +
        "</header>" +
        '<p class="toc-ms">' + esc(m.sub) + "</p>" +
        (m.say ? '<p class="toc-say">' + esc(m.say) + "</p>" : "") +
        '<ol class="toc-list">';
    m.lessons.forEach(function (l) {
      const isDone = Course.isDone(l.id);
      const kind = l.kind === "text" ? "разбор" : l.kind === "sql" ? "SQL" : "Python";
      const row =
        '<span class="toc-line">' +
          '<span class="toc-n">' + l.num + "</span>" +
          '<span class="toc-tt">' + esc(l.title) + "</span>" +
          '<span class="toc-lead" aria-hidden="true"></span>' +
          '<span class="toc-k">' + kind + "</span>" +
          '<span class="toc-c">' + (isDone ? penTick(l.id) + '<span class="sr">пройден</span>' : "") + "</span>" +
        "</span>" +
        '<span class="toc-d">' + esc(l.desc) + "</span>";
      tocHtml += "<li>" + (l.ready
        ? '<a class="toc-l' + (isDone ? " done" : "") + '" href="#' + l.id + '">' + row + "</a>"
        : '<span class="toc-l soon">' + row + "</span>") + "</li>";
    });
    tocHtml += "</ol></section>";
  });
  toc.innerHTML = tocHtml;
  main.appendChild(toc);

  /* ---------- на чём построена программа ---------- */
  const mk = Course.data.market;
  const lead = mk[0], rest = mk.slice(1);
  let mkHtml = '<section class="market has-margin">' +
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
  pyReady: null,
  pyPkgs: {},

  sql: async function () {
    if (Engine.db) return Engine.db;
    /* база и движок качаются одновременно */
    await Promise.all([Lazy.data(), loadScript(CDN.sqlBase + "sql-wasm.js")]);
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
    /* прогрев урока и «Запустить» могут прийти одновременно —
       интерпретатор и пакеты грузятся один раз */
    if (!Engine.pyReady) {
      Engine.pyReady = loadScript(CDN.pyBase + "pyodide.js").then(function () {
        return window.loadPyodide({ indexURL: CDN.pyBase });
      });
      Engine.pyReady.catch(function () { Engine.pyReady = null; });
    }
    Engine.py = await Engine.pyReady;
    for (const p of (pkgs || [])) {
      if (!Engine.pyPkgs[p]) {
        Engine.pyPkgs[p] = Engine.py.loadPackage(p);
        Engine.pyPkgs[p].catch(function () { delete Engine.pyPkgs[p]; });
      }
      await Engine.pyPkgs[p];
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
/* Число в эталоне, пока ученик его не открыл: сами числа или строка
   вида «42,4%» прячутся, текст (города, каналы) остаётся — видно, какой
   формы нужен ответ. */
const MASK = '<span class="masked" aria-label="скрыто">•••</span>';
function isNumLike(v) {
  return typeof v === "number" || (typeof v === "string" && /^[+−-]?\s*\d[\d\s]*(?:[.,]\d+)?\s*%?$/.test(v));
}
/* в выводе Python закрываются числа, но не даты вида 2024-01-15 */
function maskStdout(t) {
  return esc(t).replace(/\d{4}-\d{2}(?:-\d{2})?|\d+(?:[.,]\d+)*/g, function (m) {
    return m.indexOf("-") > 0 ? m : MASK;
  });
}

function renderTable(cols, rows, badRow, mask) {
  let h = '<table class="res"><thead><tr>';
  cols.forEach(function (c) { h += "<th>" + esc(c) + "</th>"; });
  h += "</tr></thead><tbody>";
  rows.slice(0, 200).forEach(function (r, i) {
    h += "<tr" + (i === badRow ? ' class="rowdiff"' : "") + ">";
    r.forEach(function (v) {
      h += '<td class="' + (typeof v === "number" ? "num" : "") + '">' +
           (v === null ? "NULL" : mask && isNumLike(v) ? MASK : esc(v)) + "</td>";
    });
    h += "</tr>";
  });
  h += "</tbody></table>";
  if (rows.length > 200) {
    h += '<div style="font-size:11.5px;color:var(--ink-3);margin-top:6px">показаны первые 200 строк</div>';
  }
  return h;
}

/* Таблицы «было → стало» у шага практикума: те же строки базы до новой
   конструкции и после неё. Ручкой выделено то, на что смотреть: новые
   столбцы в «стало» (hl) или строки «было», которые останутся (keep). */
function baHtml(ba) {
  function table(t, hl, keep) {
    const on = t.columns.map(function (c) { return hl.indexOf(c) >= 0; });
    return '<table class="ba-t"><thead><tr>' + t.columns.map(function (c, i) {
        return "<th" + (on[i] ? ' class="hl"' : "") + ">" + esc(c) + "</th>";
      }).join("") + "</tr></thead><tbody>" +
      t.rows.map(function (r, ri) {
        const kept = keep.indexOf(ri) >= 0;
        return "<tr>" + r.map(function (v, i) {
          const cls = [typeof v === "number" ? "num" : "", v === null ? "nul" : "", on[i] || kept ? "hl" : ""]
            .filter(Boolean).join(" ");
          return "<td" + (cls ? ' class="' + cls + '"' : "") + ">" + (v === null ? "NULL" : esc(v)) + "</td>";
        }).join("") + "</tr>";
      }).join("") + "</tbody></table>";
  }
  return '<div class="ba">' +
      '<figure class="ba-side"><figcaption>Было</figcaption>' + table(ba.before, [], ba.keep || []) + "</figure>" +
      '<span class="ba-arrow" aria-hidden="true">→</span>' +
      '<figure class="ba-side"><figcaption>Стало</figcaption>' + table(ba.after, ba.hl || [], []) + "</figure>" +
    "</div>" +
    (ba.note ? '<p class="ba-note">' + ba.note + "</p>" : "");
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
  /* знак в шапке — та же тетрадная клетка с галочкой, что в иконке вкладки */
  mark:  '<svg viewBox="0 0 64 64" aria-hidden="true"><rect class="mk-p" x="3" y="3" width="58" height="58" rx="13" stroke-width="3"/>' +
         '<path class="mk-m" d="M20 10v44" stroke-width="3.5" stroke-linecap="round"/>' +
         '<path class="mk-k" d="M27 34.5l7.5 7.5L50 22" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  play:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" width="15" height="15" aria-hidden="true"><polygon points="6 3 20 12 6 21 6 3"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" width="15" height="15" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>',
  bulb:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="15" height="15" aria-hidden="true"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/></svg>',
  key:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="15" height="15" aria-hidden="true"><circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3 21 2m-4 4 3 3m-6-6 3 3"/></svg>',
  moon:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="15" height="15" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
  sun:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="15" height="15" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  ok:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>',
  bad:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  warn:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 7v6M12 17h.01"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="15" height="15" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>',
  menu:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" width="15" height="15" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  find:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" width="15" height="15" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>'
};

/* Галочка ручкой. Каждая чуть своя: наклон, размах и начало штриха
   выводятся из id урока, поэтому от перерисовки к перерисовке одна и та
   же галочка не «пляшет». pathLength="1" нужен, чтобы её можно было
   дорисовать анимацией в момент решения задачи. */
function penTick(key, cls) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  const rot = (h % 17) - 8;
  const sx = (0.92 + (h % 7) * 0.025).toFixed(3);
  const y0 = (12.2 + ((h >> 4) % 4) * 0.35).toFixed(2);
  return '<svg class="pen-tick' + (cls ? " " + cls : "") + '" viewBox="0 0 24 24" aria-hidden="true" ' +
    'style="transform:rotate(' + rot + "deg) scaleX(" + sx + ')">' +
    '<path pathLength="1" d="M3.5 ' + y0 + ' C5.6 13.8 7.3 16.1 8.9 18.6 C12.1 12.3 15.9 7.5 21 4"/></svg>';
}

/* план по умолчанию, если урок не задал свой */
function defaultPlan(C) {
  const p = [{ m: "30 мин", w: "Теория с разобранными примерами" },
             { m: "45 мин", w: "Основная задача из рабочего тикета" }];
  if (C.drills && C.drills.length) p.push({ m: "35 мин", w: "Тренажёр: " + C.drills.length + " " + plural(C.drills.length, "задача", "задачи", "задач") });
  if (C.quiz && C.quiz.length) p.push({ m: "10 мин", w: "Самопроверка вопросами" });
  p.push({ m: "10 мин", w: "Разбор решения и заметки" });
  return p;
}

/* ============================================================
   Термины из словаря

   Ученик с нуля спотыкается о слова, которые автор считает
   очевидными. Словарь (glossary.js) знает, как каждый термин
   выглядит в тексте; Terms.mark(root) подчёркивает в root первое
   упоминание каждого термина, а тап по подчёркнутому раскрывает
   объяснение строкой под абзацем. Корень — один раздел: теория,
   тикет, одна задача тренажёра, один вопрос, одна карточка, один
   шаг. Если словарь не загрузился, текст остаётся как был.
   ============================================================ */

const Terms = {
  seq: 0,
  /* Куда термины не ставим: заголовки, кнопки и ссылки (кнопку
     в кнопку не вложить), код блоком, формулы, реплики на полях,
     варианты ответа (объяснение подсказало бы ответ) и сами
     объяснения. */
  SKIP_TAG: /^(PRE|A|BUTTON|H1|H2|H3|H4|H5|H6|SUMMARY|TEXTAREA|SCRIPT|STYLE|SVG|MJX-CONTAINER|LABEL|SELECT|INPUT)$/,
  SKIP_CLASS: ["aside", "term-x", "q-opt", "CodeMirror", "kicker", "hs-n", "ba"],

  mark: function (root) {
    const G = window.GLOSSARY;
    if (!G || !root) return;
    const mod = /^m\d+/.test(Router.current || "") ? Router.current.match(/^m\d+/)[0] : "";
    const used = {};

    function skipped(n) {
      if (Terms.SKIP_TAG.test(n.tagName)) return true;
      for (let i = 0; i < Terms.SKIP_CLASS.length; i++) {
        if (n.classList.contains(Terms.SKIP_CLASS[i])) return true;
      }
      return false;
    }
    function text(node) {
      const s = node.nodeValue;
      /* формулы MathJax ещё не отрисованы: такой кусок текста не трогаем */
      if (!s || s.length < 2 || /\\\(|\\\[|\$\$/.test(s)) return;
      const hits = G.find(s, { code: false, mod: mod }).filter(function (h) {
        if (used[h.id]) return false;
        used[h.id] = true;
        return true;
      });
      if (!hits.length) return;
      const frag = document.createDocumentFragment();
      let at = 0;
      hits.forEach(function (h) {
        frag.appendChild(document.createTextNode(s.slice(at, h.start)));
        frag.appendChild(Terms.button(h.id, document.createTextNode(s.slice(h.start, h.end))));
        at = h.end;
      });
      frag.appendChild(document.createTextNode(s.slice(at)));
      node.parentNode.replaceChild(frag, node);
    }
    /* <code> внутри текста подчёркивается целиком, по первому новому термину в нём */
    function code(node) {
      const hits = G.find(node.textContent, { code: true, mod: mod });
      for (let i = 0; i < hits.length; i++) {
        if (used[hits[i].id]) continue;
        used[hits[i].id] = true;
        const b = Terms.button(hits[i].id, null);
        b.classList.add("term-code");
        node.parentNode.replaceChild(b, node);
        b.appendChild(node);
        return;
      }
    }
    function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (ch) {
        if (ch.nodeType === 3) text(ch);
        else if (ch.nodeType === 1 && !skipped(ch)) {
          if (ch.tagName === "CODE") code(ch); else walk(ch);
        }
      });
    }
    walk(root);
  },

  button: function (id, child) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "term";
    b.dataset.term = id;
    b.setAttribute("aria-expanded", "false");
    if (child) b.appendChild(child);
    return b;
  },

  html: function (t) {
    const L = t.lesson && t.lesson !== Router.current ? Course.byId(t.lesson) : null;
    return (t.code ? "<code>" + t.t + "</code>" : "<b>" + t.t + "</b>") + " — " + t.plain +
      (t.when ? '<div class="tx-when"><b>Когда нужно:</b> ' + t.when + "</div>" : "") +
      (t.ex ? '<div class="tx-ex">Например: ' + t.ex + "</div>" : "") +
      '<div class="tx-links">' +
        (L ? '<a class="tx-more" href="#' + L.id + '">Подробно — урок ' + L.num + "</a>" : "") +
        '<a class="tx-more" href="#glossary/' + t.id + '">Весь словарь</a>' +
      "</div>";
  },

  /* Объяснение встаёт под абзацем: в пункте списка — в конец пункта,
     в ячейке — под таблицей, в вопросе — под формулировкой. */
  toggle: function (b) {
    const was = b.getAttribute("aria-controls");
    const old = was && document.getElementById(was);
    if (old) {
      old.remove();
      b.removeAttribute("aria-controls");
      b.setAttribute("aria-expanded", "false");
      return;
    }
    const t = window.GLOSSARY && window.GLOSSARY.byId[b.dataset.term];
    if (!t) return;
    const id = "tx-" + (++Terms.seq);
    const box = el("div", { class: "term-x", id: id, role: "note" }, Terms.html(t));
    const cell = b.closest("td, th");
    const li = !cell && b.closest("li");
    if (li) li.appendChild(box);
    else {
      const host = (cell && cell.closest("table")) ||
        b.closest("p, blockquote, dd, .q-t, .q-why, .fc-q, .fc-a, .st-hint, .ticket-h") ||
        b.parentElement;
      host.insertAdjacentElement("afterend", box);
    }
    b.setAttribute("aria-controls", id);
    b.setAttribute("aria-expanded", "true");
  }
};

document.addEventListener("click", function (e) {
  const b = e.target.closest ? e.target.closest("button.term") : null;
  if (!b) return;
  e.preventDefault();
  Terms.toggle(b);
});

/* ============================================================
   Части страницы урока

   Обычный урок и пошаговый (0.1) собраны из одних и тех же частей:
   шапка с планом, якорная навигация, полоса прочитанного, колода
   карточек, ссылки, нижняя навигация, таймер и редактор.
   ============================================================ */

/* шапка: реплика на поле, номер и вид урока, таймер, заголовок, план */
function lessonHeadHtml(L, C, kindLabel) {
  const plan = C.plan || defaultPlan(C);
  let planHtml = '<div class="plan"><div class="plan-h"><span>План занятия</span>' +
    '<span class="total">' + esc(C.duration || "≈ 2 часа") + "</span></div>" +
    '<div class="plan-list" style="--plan-cols:' + Math.min(plan.length, 5) + '">';
  plan.forEach(function (p) {
    planHtml += '<div class="plan-item"><div class="m">' + esc(p.m) + '</div><div class="w">' + esc(p.w) + "</div></div>";
  });
  planHtml += "</div></div>";
  return '<header class="lesson-head has-margin">' +
      (L.say ? '<div class="aside"><p>' + esc(L.say) + "</p></div>" : "") +
      '<div class="kicker"><span>Урок ' + L.num + ", " + esc(kindLabel) + "</span>" +
        '<button class="timer" id="timer" type="button" title="Время урока считается само и видно на главной. Клик — пауза">время идёт</button></div>' +
      "<h1>" + esc(L.title) + "</h1>" +
      '<p class="sub">' + esc(C.intro || L.desc) + "</p>" +
      planHtml +
    "</header>";
}

/* якорная навигация по разделам урока */
function secNavHtml(secs) {
  let navHtml = '<nav class="secnav" id="secnav"><div class="secnav-in">';
  secs.forEach(function (s, i) {
    navHtml += '<a href="#' + s.id + '" data-sec="' + s.id + '"' + (i === 0 ? ' class="on"' : "") + ">" + s.t + "</a>";
  });
  return navHtml + "</div></nav>";
}

/* полоса прочитанного и подсветка активного раздела в навигации */
function mountReadbar(secs) {
  const bar = el("div", { class: "readbar", id: "readbar" });
  document.body.appendChild(bar);
  /* В уроке две полосы прогресса не нужны: здесь важно, сколько
     осталось до конца страницы, а сколько пройдено курса — сказано
     словами на кнопке в шапке. */
  document.body.classList.add("reading");
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
    document.body.classList.remove("reading");
    const b = document.getElementById("readbar");
    if (b) b.remove();
  });
}

/* Карточки — сразу после теории: прочитал — вспомнил без подсказки — применил в задаче. */
function cardsBlockHtml() {
  return '<section class="block" id="s-cards">' +
    '<div class="block-h"><h2>Карточки</h2></div>' +
    '<p class="block-intro">Не подглядывая в теорию: сначала ответьте в голове, потом откройте ответ ' +
    "и честно оцените себя. С завтрашнего дня карточки будут возвращаться в повторение на главной.</p>" +
    '<div class="deck" id="deck"></div></section>';
}

/* Колода карточек. Первый прогон ставит карточки в расписание повторения
   (запись пропускается, если карточка там уже есть). Прогон «ещё раз»
   только закрепляет и расписание не трогает. */
function mountDeck(id, C) {
  const deck = $("#deck");
  const every = C.cards.map(function (c, k) { return k; });
  const runDeck = function (list, record) {
    let i = 0, yes = 0, fresh = 0;
    const missed = [];
    const finish = function () {
      const tail = !record ? "Расписание повторения этот прогон не меняет."
        : fresh ? "Завтра карточки вернутся в повторение на главной."
        : "Эти карточки уже в расписании повторения, прогон его не сдвинул.";
      deck.innerHTML = '<div class="fc-done"><p>Вспомнили ' + yes + " из " + list.length + ". " + tail + "</p>" +
        '<button class="btn" id="deckAgain" type="button">' +
        (missed.length ? "Ещё раз невспомненные: " + missed.length : "Прогнать ещё раз") + "</button></div>";
      $("#deckAgain").addEventListener("click", function () {
        runDeck(missed.length ? missed : every, false);
        $(".fc-show", deck).focus({ preventScroll: true });
      });
    };
    const show = function () {
      if (i >= list.length) { finish(); return; }
      const n = list[i];
      Flash.card(deck, C.cards[n], (i + 1) + " из " + list.length, function (ok) {
        if (record && Review.record(id, "c" + n, ok, true)) fresh++;
        if (ok) yes++; else missed.push(n);
        i++;
        show();
        /* фокус на следующую кнопку, чтобы колоду можно было пройти с клавиатуры */
        const b = $(".fc-show", deck) || $("#deckAgain");
        if (b) b.focus({ preventScroll: true });
      });
    };
    show();
  };
  runDeck(every, true);
}

/* что почитать дальше */
function linksBlockHtml(C) {
  let html = '<section class="block" id="s-links">' +
    '<div class="block-h"><h2>Что почитать дальше</h2></div>' +
    '<p class="block-intro">Материалы открываются в новой вкладке. Помеченные EN на английском: ' +
    "читать документацию по-английски аналитику всё равно придётся, лучше начать сейчас.</p>" +
    '<div class="links">';
  C.links.forEach(function (l) {
    html += '<a class="link-card" href="' + esc(l.url) + '" target="_blank" rel="noopener noreferrer">' +
      '<div class="lk-src"><span>' + esc(l.src) + "</span>" +
      (l.lang ? '<span class="lang">' + esc(l.lang) + "</span>" : "") + "</div>" +
      '<div class="lk-t">' + esc(l.t) + "</div>" +
      '<div class="lk-d">' + esc(l.d) + "</div></a>";
  });
  return html + "</div></section>";
}

/* Нижняя навигация: соседние уроки и отметка «пройден».
   onUnmark — что ещё сбросить, когда отметку снимают (может быть null).
   Возвращает функцию перерисовки. */
function mountLessonNav(id, onUnmark) {
  function update() {
    const prev = Course.neighbour(id, -1), next = Course.neighbour(id, 1);
    const done = Course.isDone(id);
    /* Стрелка вынесена из подписи отдельным значком: тогда длинное
       название урока обрезается многоточием, а стрелка остаётся
       на месте — иначе на телефоне срезало бы именно её. */
    const link = function (l, dir) {
      const arrow = '<span class="nl-a">' + (dir < 0 ? "&larr;" : "&rarr;") + "</span>";
      const text = '<span class="nl-t">' + esc(l ? l.num + " " + l.title
        : dir < 0 ? "начало курса" : "дальше — новые уроки") + "</span>";
      const body = dir < 0 ? arrow + text : text + arrow;
      return l ? '<a class="navlink" href="#' + l.id + '">' + body + "</a>"
               : '<span class="navlink dim">' + body + "</span>";
    };
    $("#lnav").innerHTML =
      link(prev, -1) +
      '<a class="navlink" href="#">Карта курса</a>' +
      '<span class="spacer"></span>' +
      '<button class="btn ' + (done ? "" : "check") + '" id="markBtn" type="button"' +
        (done ? "" : " disabled") + ">" +
        (done ? "&#10003; Пройден — снять отметку" : "Отметить как пройденный") + "</button>" +
      link(next, 1);

    const mb = $("#markBtn");
    if (!done) mb.title = "Станет активной, когда «Проверить» покажет зелёный результат";
    mb.addEventListener("click", function () {
      if (Course.isDone(id)) {
        Store.set("done", id, false);
        if (onUnmark) onUnmark();
      }
      update();
      refreshBar();
    });
  }
  update();
  return update;
}

/* Таймер урока. Секундомер на экране давит, поэтому времени не видно:
   оно считается само и показывается на главной. Пауза — если отошли
   от открытого урока. Время по календарным дням — для серии на главной. */
function mountTimer(id) {
  let secs = Store.get("time", id, 0);
  let day = isoDay(), daySecs = Store.get("days", day, 0);
  let running = true;
  const btn = $("#timer");
  const tick = setInterval(function () {
    if (!running || document.hidden) return;
    secs += 1;
    const d = isoDay();
    if (d !== day) { Store.set("days", day, daySecs); day = d; daySecs = Store.get("days", day, 0); }
    daySecs += 1;
    if (secs % 10 === 0) { Store.set("time", id, secs); Store.set("days", day, daySecs); }
  }, 1000);
  btn.addEventListener("click", function () {
    running = !running;
    btn.classList.toggle("paused", !running);
    btn.textContent = running ? "время идёт" : "на паузе";
    btn.title = running ? "Время урока считается само и видно на главной. Клик — пауза"
                        : "Время не считается. Клик — продолжить";
  });
  Router.cleanup.push(function () {
    clearInterval(tick);
    if (secs > 0) Store.set("time", id, secs);
    if (daySecs > 0) Store.set("days", day, daySecs);
  });
}

/* Редактор кода: CodeMirror с подсветкой, а если он не загрузился —
   обычное поле ввода. Промис отдаёт {get, set} или null, если страницу
   успели сменить. onRun — Cmd/Ctrl+Enter в CodeMirror; onFail — вызвать,
   когда пришлось обойтись полем без подсветки. */
function mountEditor(ta, kind, value, onChange, onRun, onFail) {
  loadCSS(CDN.cmBase + "codemirror.min.css");
  return loadScript(CDN.cmBase + "codemirror.min.js").then(function () {
    return loadScript(CDN.cmBase + "mode/" + (kind === "sql" ? "sql/sql" : "python/python") + ".min.js");
  }).then(function () {
    if (!ta || !document.body.contains(ta)) return null;   /* урок успели сменить */
    const cm = window.CodeMirror.fromTextArea(ta, {
      mode: kind === "sql" ? "text/x-sqlite" : "python",
      lineNumbers: true, indentUnit: 4, tabSize: 4,
      lineWrapping: true, viewportMargin: Infinity,
      extraKeys: {
        "Cmd-Enter": onRun, "Ctrl-Enter": onRun,
        Tab: function (c) { c.replaceSelection("    "); }
      }
    });
    cm.setValue(value);
    cm.on("change", function () { onChange(cm.getValue()); });
    return { get: function () { return cm.getValue(); }, set: function (v) { cm.setValue(v); } };
  }).catch(function () {
    if (!ta || !document.body.contains(ta)) return null;
    ta.style.cssText = "width:100%;min-height:320px;font-family:var(--mono);font-size:14.5px;" +
      "line-height:1.62;border:0;padding:14px 16px;background:transparent;color:var(--ink);resize:vertical";
    ta.value = value;
    ta.addEventListener("input", function () { onChange(ta.value); });
    if (onFail) onFail();
    return { get: function () { return ta.value; }, set: function (v) { ta.value = v; } };
  });
}

/* ============================================================
   Пошаговый урок

   Урок 0.1 учит SQL с нуля, поэтому теория в нём нарезана на шаги
   и у каждого шага своя маленькая задача. Открыт один шаг — первый
   нерешённый; решённые сворачиваются в строку с запросом ученика,
   будущие видны серыми заголовками. Редактор есть только у открытого
   шага: на телефоне восемь редакторов сразу были бы лишними.
   Пройденные шаги — корзина steps («урок:номер»), код шага —
   корзина code («урок:sномер»).
   Тот же движок ведёт практикум внутри обычного урока (1.3): у его
   ключей метка tag = "p" — «m1l2:p0» и «m1l2:ps0», — чтобы шаги
   практикума не смешались с шагами урока.
   ============================================================ */

const Steps = {
  key: function (id, n, tag) { return id + ":" + (tag || "") + n; },
  passed: function (id, n, tag) { return !!Store.get("steps", Steps.key(id, n, tag), false); },
  firstOpen: function (id, S, tag) {
    for (let n = 0; n < S.steps.length; n++) if (!Steps.passed(id, n, tag)) return n;
    return -1;
  },
  clear: function (id, S, tag) {
    S.steps.forEach(function (s, n) {
      if (Steps.passed(id, n, tag)) Store.set("steps", Steps.key(id, n, tag), false);
    });
  },

  /* Рисует в box ленту шагов S (урок 0.1 или практикум урока L).
     onFinish(fresh) вызывается, когда пройдены все шаги: fresh —
     только что, а не уже при открытии. */
  render: function (L, S, box, onFinish, tag) {
    const id = L.id, total = S.steps.length;
    const py = L.kind === "python";  /* урок 0.2: шаги на Python, проверка по напечатанному */
    const peek = {};                 /* пройденные шаги, раскрытые для перечитывания */
    let open = Steps.firstOpen(id, S, tag);
    let justPassed = -1;
    let editor = null, last = null, lastOut = null, helped = false;

    box.innerHTML =
      '<details class="schema"><summary>Какие таблицы есть в базе</summary>' +
        '<div class="schema-body">' + S.schema + "</div></details>" +
      '<ol class="steps"></ol>';
    const list = $(".steps", box);

    function codeKey(n) { return id + ":" + (tag || "") + "s" + n; }
    function codeOf(n) {
      const saved = Store.get("code", codeKey(n), null);
      return saved !== null ? saved : (S.steps[n].starter || "");
    }
    /* объяснение шага, таблицы «было → стало» и задание — один текст:
       термины в нём подчёркиваются по первому упоминанию */
    function textOf(s) {
      return '<div class="theory">' + s.body + (s.ba ? baHtml(s.ba) : "") + (s.task || "") + "</div>";
    }
    /* первая значимая строка запроса — подпись свёрнутого шага */
    function firstLine(src) {
      return (String(src).split("\n").filter(function (x) {
        return x.trim() && !/^\s*--/.test(x);
      })[0] || "").trim();
    }
    function mark(n) {
      return '<span class="st-n">' + (Steps.passed(id, n, tag)
        ? penTick(Steps.key(id, n, tag), n === justPassed ? "draw" : "")
        : String(n + 1)) + "</span>";
    }

    function itemHtml(n) {
      const s = S.steps[n];
      if (n === open) {
        return '<li class="st open" data-n="' + n + '">' +
          '<div class="st-h">' + mark(n) + '<h3 class="st-t">' + esc(s.title) + "</h3>" +
            '<span class="st-of">шаг ' + (n + 1) + " из " + total + "</span></div>" +
          '<div class="st-b">' +
            textOf(s) +
            '<div class="editor-shell st-ed"><div class="editor-h"><span>шаг ' + (n + 1) + (py ? ".py" : ".sql") + "</span></div>" +
              '<textarea class="st-ta"></textarea></div>' +
            '<div class="st-actions">' +
              '<button class="btn primary st-run" type="button">' + ICON.play + "Запустить</button>" +
              '<button class="btn check st-check" type="button">' + ICON.check + "Проверить</button>" +
              '<button class="linkbtn st-help" type="button">Не получается</button>' +
            "</div>" +
            '<div class="st-hint" hidden></div>' +
            '<div class="status st-status"></div>' +
            '<div class="io-box st-out"><div class="io-h"><span>ваш вывод</span></div>' +
              '<div class="io-body st-res"><div class="empty">Пока пусто — нажмите «Запустить».</div></div></div>' +
          "</div></li>";
      }
      if (Steps.passed(id, n, tag)) {
        const shown = !!peek[n];
        return '<li class="st done' + (shown ? " peek" : "") + '" data-n="' + n + '">' +
          '<button class="st-h" type="button" aria-expanded="' + shown + '">' + mark(n) +
            '<span class="st-t">' + esc(s.title) + "</span>" +
            '<code class="st-q">' + esc(firstLine(codeOf(n))) + "</code></button>" +
          (shown ? '<div class="st-b">' + textOf(s) +
            '<pre class="st-code"><code>' + esc(codeOf(n)) + "</code></pre></div>" : "") +
          "</li>";
      }
      return '<li class="st todo" data-n="' + n + '"><div class="st-h">' + mark(n) +
        '<span class="st-t">' + esc(s.title) + "</span></div></li>";
    }

    /* пройденный шаг раскрывается и сворачивается на месте, остальные не трогаем */
    function bindDone(li) {
      $(".st-h", li).addEventListener("click", function () {
        const n = +li.dataset.n;
        peek[n] = !peek[n];
        const tmp = document.createElement("div");
        tmp.innerHTML = itemHtml(n);
        const fresh = tmp.firstChild;
        li.parentNode.replaceChild(fresh, li);
        Terms.mark($(".st-b .theory", fresh));
        bindDone(fresh);
      });
    }

    function draw() {
      editor = null; last = null; lastOut = null; helped = false;
      let html = "";
      for (let n = 0; n < total; n++) html += itemHtml(n);
      justPassed = -1;
      list.innerHTML = html;
      Array.prototype.forEach.call(list.querySelectorAll(".st-b .theory"), function (n) { Terms.mark(n); });
      Array.prototype.forEach.call(list.querySelectorAll(".st.done"), bindDone);
      if (open >= 0) mountOpen();
    }

    function mountOpen() {
      const n = open;
      const li = $(".st.open", list);
      const q = function (sel) { return $(sel, li); };

      function status(kind, title, body) {
        const s = q(".st-status");
        if (!kind) { s.className = "status st-status"; s.innerHTML = ""; return; }
        const ico = kind === "ok" ? ICON.ok : kind === "bad" ? ICON.bad : ICON.warn;
        s.className = "status st-status show " + kind;
        s.innerHTML = '<span class="s-ico">' + ico + "</span>" +
          '<span class="s-body"><b>' + esc(title) + "</b>" + (body ? "<br>" + body : "") + "</span>";
      }
      function showRows(badRow) {
        q(".st-res").innerHTML = renderTable(last.columns, last.values, badRow) +
          '<div class="st-rows">' + last.values.length + " " +
          plural(last.values.length, "строка", "строки", "строк") + "</div>";
      }

      /* true — код выполнен (вывода может и не быть), false — пусто или ошибка */
      async function run() {
        if (open !== n || !document.body.contains(li)) return false;
        status(null);
        const code = editor ? editor.get() : q(".st-ta").value;
        if (!code.trim()) {
          status("warn", "Пусто", py ? "Сначала напишите код." : "Сначала напишите запрос.");
          return false;
        }
        const rb = q(".st-run");
        rb.disabled = true;
        try { return await (py ? runPy(code) : runSql(code)); }
        finally { if (document.body.contains(rb)) rb.disabled = false; }
      }

      async function runSql(code) {
        if (!Engine.db) q(".st-res").innerHTML = '<div class="empty">Поднимаю базу в браузере…</div>';
        try {
          const db = await Engine.sql();
          if (open !== n || !document.body.contains(li)) return false;
          let res;
          try { res = db.exec(code); }
          catch (e) {
            last = null;
            q(".st-res").innerHTML = '<pre><span class="err">' + esc("SQLite: " + e.message) + "</span></pre>";
            status("bad", "Запрос упал с ошибкой",
              "Прочитайте сообщение базы в выводе: обычно там сказано, рядом с каким словом она споткнулась.");
            return false;
          }
          last = res.length ? res[res.length - 1] : null;
          if (last) showRows(-1);
          else q(".st-res").innerHTML = '<div class="empty">Запрос выполнен, но не вернул ни одной строки.</div>';
          return true;
        } catch (e) {
          q(".st-res").innerHTML = '<pre><span class="err">' + esc(String(e && e.message ? e.message : e)) + "</span></pre>";
          status("bad", "База не загрузилась", "Похоже, пропал интернет. Попробуйте ещё раз, когда связь вернётся.");
          return false;
        }
      }

      /* Код шага идёт после пролога модуля 2: users, orders и events уже
         загружены. Каждый запуск — в чистом пространстве имён: иначе
         переменная из соседнего шага «помогла» бы, а после перезагрузки
         код сломался бы. Сверяется только напечатанное — stdout. */
      async function runPy(code) {
        q(".st-res").innerHTML = '<div class="empty">' + (Engine.py ? "Выполняю…"
          : "Готовлю Python в браузере — первый раз 15–40 секунд…") + "</div>";
        let pyi;
        try {
          const got = await Promise.all([Engine.python(S.packages || []), Lazy.data()]);
          pyi = got[0];
        } catch (e) {
          lastOut = null;
          q(".st-res").innerHTML = '<pre><span class="err">' + esc(String(e && e.message ? e.message : e)) + "</span></pre>";
          status("bad", "Python не загрузился", "Похоже, пропал интернет. Попробуйте ещё раз, когда связь вернётся.");
          return false;
        }
        if (open !== n || !document.body.contains(li)) return false;
        const ns = pyi.toPy({});
        (S.data || []).forEach(function (k) { ns.set(k, window.DATA[k]); });
        const out = [];
        pyi.setStdout({ batched: function (s) { out.push(s); } });
        pyi.setStderr({ batched: function () {} });
        try {
          if (S.prelude) await pyi.runPythonAsync(S.prelude, { globals: ns });
          await pyi.runPythonAsync(code, { globals: ns });
        } catch (e) {
          lastOut = null;
          /* трассировку показываем с кадра кода ученика — внутренние
             кадры Pyodide новичку ничего не скажут */
          const all = String(e.message || e).split("\n");
          let from = -1;
          all.forEach(function (l, i) { if (l.indexOf('File "<exec>"') >= 0) from = i; });
          const lines = from >= 0 ? all.slice(from) : all.filter(function (l) {
            return l.indexOf("/lib/python") < 0 && l.indexOf("pyodide") < 0;
          }).slice(-8);
          q(".st-res").innerHTML = '<pre><span class="err">' + esc(lines.join("\n").trim()) + "</span></pre>";
          status("bad", "Код упал с ошибкой",
            "Прочитайте последнюю строку вывода: там сказано, что не понравилось Python.");
          return false;
        } finally {
          ns.destroy();
        }
        lastOut = out.join("\n");
        q(".st-res").innerHTML = lastOut.trim()
          ? "<pre>" + esc(lastOut) + "</pre>"
          : '<div class="empty">Код отработал без ошибок, но ничего не напечатал. Нужен print().</div>';
        return true;
      }

      /* «Проверить» всегда выполняет то, что сейчас в редакторе */
      async function check() {
        const ran = await run();
        if (!ran || open !== n) return;
        /* у шага нет окна «ожидаемый результат», поэтому строку эталона
           показываем в причине — как значения в SQL-шагах */
        if (py) {
          const want = S.steps[n].expected.stdout;
          const rp = Check.python(lastOut, want);
          if (rp.ok) { pass(n); return; }
          const a = Check.normLines(lastOut)[rp.line], b = Check.normLines(want)[rp.line];
          status("bad", "Пока не совпадает", esc(a !== undefined && b !== undefined
            ? "строка " + (rp.line + 1) + ": получилось «" + a + "», ожидается «" + b + "»" : rp.why));
          return;
        }
        const r = Check.sql(last, S.steps[n].expected);
        if (r.ok) { pass(n); return; }
        if (last) showRows(r.row === undefined ? -1 : r.row);
        status("bad", "Пока не совпадает", esc(r.why));
      }

      /* первое нажатие — подсказка, второе — решение в редакторе */
      function help() {
        const s = S.steps[n], hint = q(".st-hint"), btn = q(".st-help");
        if (!helped) {
          hint.hidden = false;
          hint.innerHTML = s.hint;
          Terms.mark(hint);
          btn.textContent = "Показать решение";
          helped = true;
          return;
        }
        if (editor) editor.set(s.solution); else q(".st-ta").value = s.solution;
        Store.set("code", codeKey(n), s.solution);
        status("warn", "Решение в редакторе",
          "Прочитайте его, запустите и проверьте: шаг засчитается после «Проверить».");
        btn.hidden = true;
      }

      q(".st-run").addEventListener("click", run);
      q(".st-check").addEventListener("click", check);
      q(".st-help").addEventListener("click", help);

      mountEditor(q(".st-ta"), py ? "python" : "sql", codeOf(n),
        function (v) { Store.set("code", codeKey(n), v); }, run,
        function () {
          status("warn", "Редактор без подсветки",
            "CodeMirror не загрузился — похоже, нет интернета. Запрос всё равно можно писать и запускать.");
        }
      ).then(function (ed) { if (open === n && document.body.contains(li)) editor = ed; });
    }

    function pass(n) {
      Store.set("steps", Steps.key(id, n, tag), Date.now());
      justPassed = n;
      open = Steps.firstOpen(id, S, tag);
      draw();
      if (open >= 0) {
        const li = $(".st.open", list);
        if (li) li.scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (onFinish) {
        onFinish(true);
      }
    }

    draw();
    if (open < 0 && onFinish) onFinish(false);
  }
};

/* Страница пошагового урока: шапка, шаги, карточки, «как дальше», ссылки. */
function renderStepsLesson(app, L, C) {
  const id = L.id;
  const hasCards = !!(C.cards && C.cards.length);
  const hasLinks = !!(C.links && C.links.length);

  const secs = [{ id: "s-steps", t: "Шаги" }];
  if (hasCards) secs.push({ id: "s-cards", t: "Карточки" });
  if (C.after) secs.push({ id: "s-after", t: "Как дальше" });
  if (hasLinks) secs.push({ id: "s-links", t: "Что почитать" });

  const main = el("main", { class: "wrap lesson-wrap" });
  main.innerHTML =
    lessonHeadHtml(L, C, L.kind === "python" ? "Python с нуля" : "SQL с нуля") +
    secNavHtml(secs) +
    '<section class="block has-margin" id="s-steps">' +
      (L.sayTask ? '<div class="aside"><p>' + esc(L.sayTask) + "</p></div>" : "") +
      '<div class="block-h"><h2>Шаги</h2></div>' +
      (L.kind === "python" ? '<div class="st-warm" id="pyWarm">Готовлю Python в браузере — ' +
        "15–40 секунд, можно читать первый шаг.</div>" : "") +
      '<div id="stepsBox"></div>' +
      '<div class="status st-final" id="stFinal"></div>' +
    "</section>" +
    (hasCards ? cardsBlockHtml() : "") +
    (C.after ? '<section class="block" id="s-after">' +
      '<div class="block-h"><h2>Как устроены следующие уроки</h2></div>' +
      '<div class="theory">' + C.after + "</div></section>" : "") +
    (hasLinks ? linksBlockHtml(C) : "") +
    '<nav class="lesson-nav" id="lnav"></nav>';
  app.appendChild(main);

  /* Python качается долго — начинаем сразу, пока человек читает.
     pandas импортируется несколько секунд — делаем и это заранее,
     иначе первое «Запустить» надолго замолчит. */
  if (L.kind === "python") {
    const warm = $("#pyWarm");
    Engine.python(C.packages || []).then(function (pyi) {
      return (C.packages || []).indexOf("pandas") >= 0 ? pyi.runPythonAsync("import pandas") : null;
    }).then(function () {
      if (document.body.contains(warm)) warm.remove();
    }, function () {
      if (document.body.contains(warm)) warm.textContent =
        "Python не загрузился — похоже, пропал интернет. «Запустить» попробует ещё раз.";
    });
  } else {
    idle(function () { Engine.sql().catch(function () {}); });
  }

  Terms.mark($("#s-after .theory"));
  mountReadbar(secs);
  if (hasCards) mountDeck(id, C);

  const box = $("#stepsBox"), fin = $("#stFinal");

  function finished(fresh) {
    if (!Course.isDone(id)) { Store.set("done", id, Date.now()); refreshBar(); }
    fin.className = "status st-final show ok";
    fin.innerHTML = '<span class="s-ico' + (fresh ? " s-pen" : "") + '">' +
        (fresh ? penTick(id, "draw") : ICON.ok) + "</span>" +
      '<span class="s-body"><b>Урок пройден</b>' + (C.finish || "Все шаги решены.") +
        '<br><button class="linkbtn" id="nextBtn" type="button">Перейти к следующему уроку</button></span>';
    $("#nextBtn").addEventListener("click", function () {
      const nx = Course.neighbour(id, 1);
      Router.go(nx ? "#" + nx.id : "#");
    });
    updateNav();
  }

  /* «снять отметку» у пошагового урока начинает его заново с шага 1; код остаётся */
  const updateNav = mountLessonNav(id, function () {
    Steps.clear(id, C);
    fin.className = "status st-final";
    fin.innerHTML = "";
    Steps.render(L, C, box, finished);
  });
  Steps.render(L, C, box, finished);
  mountTimer(id);
}

function renderLesson(app, id) {
  const L = Course.byId(id);

  /* Урок есть в программе, но модуль с его содержимым ещё не загружен:
     показываем тихую заглушку и дорисовываем урок, когда модуль придёт.
     Если за это время человек ушёл на другую страницу — ничего не делаем. */
  if (L && !window.CONTENT[id]) {
    document.title = L.num + " " + L.title + " — Тетрадь аналитика";
    mountHeader("");
    app.appendChild(el("main", { class: "wrap lesson-wrap" },
      '<div class="lazy-wait">Открываю урок ' + L.num + "…</div>"));
    Lazy.content(L.module.id).then(function () {
      if (Router.current === id) Router.render(true);
    }, function () {
      if (Router.current !== id) return;
      const w = $(".lazy-wait");
      if (!w) return;
      w.innerHTML = "Урок не загрузился — похоже, пропал интернет. " +
        '<button class="linkbtn" id="lazyRetry" type="button">Попробовать ещё раз</button>';
      $("#lazyRetry").addEventListener("click", function () { Router.render(true); });
    });
    return;
  }

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

  Store.set("seen", "last", id);

  /* Пока человек читает теорию, в фоне подтягиваем учебную базу —
     первый запуск кода не будет её ждать. И модуль следующего урока,
     если он в другом модуле, — переход дальше откроется сразу.     */
  if (L.kind !== "text") idle(function () { Lazy.data().catch(function () {}); });
  const after = Course.neighbour(id, 1);
  if (after && after.module !== L.module) {
    idle(function () { Lazy.content(after.module.id).catch(function () {}); });
  }

  const M = L.module;
  document.title = L.num + " " + L.title + " — Тетрадь аналитика";
  mountHeader("<b>Модуль " + M.num + ":</b> " + esc(M.title) + ", урок " + L.num);

  /* Пошаговый урок (0.1, 0.2) устроен иначе: вместо теории и одной
     задачи — лента шагов со своими редакторами. Движок поднимает сама
     страница урока, чтобы первое «Запустить» не ждало загрузки. */
  if (C.steps) {
    renderStepsLesson(app, L, C);
    return;
  }

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
  const hasDrills = !!(C.drills && C.drills.length);
  const hasQuiz = !!(C.quiz && C.quiz.length);
  const hasCards = !!(C.cards && C.cards.length);
  const hasLinks = !!(C.links && C.links.length);
  const P = C.practicum;

  /* ---------- якорная навигация ---------- */
  const secs = [{ id: "s-theory", t: "Теория" }];
  if (hasCards) secs.push({ id: "s-cards", t: "Карточки" });
  if (P) secs.push({ id: "s-practice", t: "Практикум" });
  secs.push({ id: "s-task", t: "Задача" });
  if (hasDrills) secs.push({ id: "s-drills", t: "Тренажёр" });
  if (hasQuiz) secs.push({ id: "s-quiz", t: "Самопроверка" });
  if (hasLinks) secs.push({ id: "s-links", t: "Что почитать" });
  secs.push({ id: "s-notes", t: "Заметки" });

  /* ---------- тренажёр ---------- */
  let drillsHtml = "";
  if (hasDrills) {
    drillsHtml = '<section class="block has-margin" id="s-drills">' +
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
    quizHtml = '<section class="block" id="s-quiz">' +
      '<div class="block-h"><h2>Самопроверка</h2></div>' +
      '<p class="block-intro">Отвечайте не глядя в теорию. Разбор откроется сразу после ответа, ' +
      "а завтра эти вопросы вернутся на главную — повторить.</p>" +
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

  const main = el("main", { class: "wrap lesson-wrap" });
  main.innerHTML =
    lessonHeadHtml(L, C, kindLabel) +

    secNavHtml(secs) +

    '<section class="block" id="s-theory">' +
      '<div class="block-h"><h2>Теория</h2></div>' +
      '<div class="theory">' + C.theory + "</div>" +
    "</section>" +

    (hasCards ? cardsBlockHtml() : "") +

    /* практикум — шаги от одной конструкции к другой перед основной задачей */
    (P ? '<section class="block" id="s-practice">' +
      '<div class="block-h"><h2>Практикум</h2></div>' +
      (P.intro ? '<p class="block-intro">' + P.intro + "</p>" : "") +
      '<div id="practiceBox"></div>' +
      '<div class="status st-final" id="practiceFinal"></div>' +
    "</section>" : "") +

    '<section class="block has-margin" id="s-task">' +
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
          "Запустить<span class=\"bl\"> код</span><span class=\"k\">Cmd+Enter</span></button>") +
        '<button class="btn check" id="checkBtn" type="button">' + ICON.check + "Проверить</button>" +
        '<button class="btn" id="hintBtn" type="button" aria-label="Подсказка">' + ICON.bulb +
          '<span class="bl">Подсказка</span></button>' +
        '<button class="btn" id="solBtn" type="button" aria-label="Решение" disabled>' + ICON.key +
          '<span class="bl">Решение</span></button>' +
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
          '<span class="spacer"></span><button class="linkbtn" id="refBtn" type="button">' +
            (isText ? "показать" : "показать числа") + "</button>" +
          "</div>" +
          '<div class="io-body" id="refBox"></div></div>' +
      "</div>" +
    "</section>" +

    drillsHtml + quizHtml + (hasLinks ? linksBlockHtml(C) : "") +

    '<section class="block" id="s-notes">' +
      '<div class="block-h"><h2>Мои заметки</h2></div>' +
      '<div class="notes-wrap">' +
        '<textarea class="notes" id="notes" placeholder="Что было непонятно, на чём споткнулась, что спросить у наставника..."></textarea>' +
        '<div class="notes-hint" id="notesHint">сохраняется автоматически</div>' +
      "</div>" +
    "</section>" +

    '<nav class="lesson-nav" id="lnav"></nav>';

  app.appendChild(main);

  /* ---------- термины из словаря ---------- */
  Terms.mark($("#s-theory .theory"));
  Terms.mark($(".ticket-b"));
  Array.prototype.forEach.call(document.querySelectorAll(".drill-body, .q"), function (n) { Terms.mark(n); });

  /* ---------- полоса прочитанного + подсветка активной секции ---------- */
  mountReadbar(secs);

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
          Review.record(id, qi, picked === q.right, true);
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

  /* ---------- колода карточек ---------- */
  if (hasCards) mountDeck(id, C);

  /* ---------- практикум ----------
     Урок он не отмечает: пройденным урок делает основная задача. По
     окончании — ссылка к ней, приёмы практикума там собираются вместе. */
  if (P) {
    idle(function () { Engine.sql().catch(function () {}); });
    const pfin = $("#practiceFinal");
    Steps.render(L, P, $("#practiceBox"), function (fresh) {
      pfin.className = "status st-final show ok";
      pfin.innerHTML = '<span class="s-ico' + (fresh ? " s-pen" : "") + '">' +
          (fresh ? penTick(id + ":p", "draw") : ICON.ok) + "</span>" +
        '<span class="s-body"><b>Практикум пройден</b>' + (P.done || "Все шаги решены.") +
          '<br><a href="#s-task">Перейти к основной задаче</a></span>';
    }, "p");
  }

  /* ---------- эталон ---------- */
  const refBox = $("#refBox");
  let showRef = function () {};
  if (isText) {
    refBox.innerHTML = '<div class="empty">Скрыт, чтобы не подсматривать. Сначала напишите свой ответ.</div>';
    $("#refBtn").addEventListener("click", function () {
      refBox.innerHTML = '<div class="theory" style="font-size:15px">' + C.reference + "</div>";
      Terms.mark(refBox);
      this.remove();
    });
  } else {
    /* Числа эталона закрыты, пока ученик не попросит или не решит сам:
       иначе задача превращается в подгонку под готовый ответ. */
    const py = C.expected.stdout !== undefined;
    const lines = py ? C.expected.stdout.split("\n").filter(function (l) { return l.trim(); }).length
                     : C.expected.rows.length;
    const drawRef = function (open) {
      refBox.innerHTML = (py
          ? "<pre>" + (open ? esc(C.expected.stdout) : maskStdout(C.expected.stdout)) + "</pre>"
          : renderTable(C.expected.columns, C.expected.rows, -1, !open)) +
        (open ? "" : '<div class="ref-note">' + lines + " " + plural(lines, "строка", "строки", "строк") +
          " · числа скрыты, чтобы не подгонять ответ</div>");
      const b = $("#refBtn");
      if (b) b.textContent = open ? "скрыть числа" : "показать числа";
      refOpen = open;
    };
    let refOpen = false;
    showRef = function () { drawRef(true); };
    drawRef(Course.isDone(id));
    $("#refBtn").addEventListener("click", function () { drawRef(!refOpen); });
  }

  /* ---------- статус и индикатор загрузки ---------- */
  function setStatus(kind, title, body, drawn) {
    const s = $("#status");
    /* галочку ручкой наставник ставит только в момент решения задачи —
       это единственное движение на странице урока */
    const ico = drawn ? penTick(id, "draw")
      : kind === "ok" ? ICON.ok : kind === "bad" ? ICON.bad : ICON.warn;
    s.className = "status show " + kind;
    s.innerHTML = '<span class="s-ico' + (drawn ? " s-pen" : "") + '">' + ico + "</span>" +
                  '<span class="s-body"><b>' + esc(title) + "</b>" + (body ? "<br>" + body : "") + "</span>";
  }
  function clearStatus() { $("#status").className = "status"; }
  function loader(on, txt) {
    $("#loader").className = "loader" + (on ? " show" : "");
    if (txt) $("#loaderTxt").textContent = txt;
  }

  /* ---------- редактор ---------- */
  let editor = null, answerEl = null;
  const savedCode = Store.get("code", id, null);

  if (isText) {
    answerEl = $("#answer");
    answerEl.value = savedCode || "";
    answerEl.addEventListener("input", function () { Store.set("code", id, answerEl.value); });
  } else {
    mountEditor($("#editor"), L.kind, savedCode !== null ? savedCode : (C.starter || ""),
      function (v) { Store.set("code", id, v); }, run,
      function () {
        setStatus("warn", "Редактор без подсветки синтаксиса",
          "CodeMirror не загрузился — похоже, нет интернета. Код всё равно можно писать и запускать.");
      }
    ).then(function (ed) { editor = ed; });
    $("#resetBtn").addEventListener("click", function () {
      if (!confirm("Вернуть начальный шаблон? Ваш код будет потерян.")) return;
      const v = C.starter || "";
      if (editor) editor.set(v); else $("#editor").value = v;
      Store.set("code", id, v);
    });
  }

  function getCode() {
    if (isText) return answerEl.value;
    return editor ? editor.get() : $("#editor").value;
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
    if (C.data && C.data.length) await Lazy.data();
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
    showRef();
    /* решён последний урок модуля — повод посмотреть итог */
    const Mod = L.module;
    const closedHtml = Course.doneCount(Mod.lessons) === Mod.lessons.length
      ? '<br><a href="#summary-' + Mod.id + '">Модуль ' + Mod.num + " закрыт — посмотреть итог</a>" : "";
    const remind = Store.mode() === "memory"
      ? '<br><span style="color:var(--amber)">Браузер не сохраняет прогресс — выгрузите его ' +
        "в файл кнопкой вверху, иначе результат пропадёт.</span>" : "";
    setStatus("ok", "Задание выполнено", (extra || "") + remind + closedHtml +
      '<br><button class="linkbtn" id="nextBtn" type="button">Перейти к следующему уроку</button>', true);
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
    Terms.mark($("#modalB"));
  });

  $("#solBtn").addEventListener("click", function () {
    const body = (isText ? "" :
      "<p>Эталонный код с комментариями. Сравнивайте не синтаксис, а подход: где вы пошли другим путём и почему.</p>" +
      "<pre>" + esc(C.solution) + "</pre>") + (C.solutionNote || C.reference || "");
    modal("Решение", '<div class="theory" style="font-size:16px">' + body + "</div>");
    Terms.mark($("#modalB"));
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
  const updateNav = mountLessonNav(id, null);
  if (Course.isDone(id)) {
    setStatus("ok", "Урок уже пройден",
      "Можно перерешать: код сохранён, кнопка «Показать решение» открыта.");
  }

  /* ---------- таймер ---------- */
  mountTimer(id);
}

/* ============================================================
   Поиск по курсу и клавиатура

   Сорок уроков — это столько, что искать глазами в оглавлении
   дольше, чем вспомнить слово из названия. Поиск открывается
   косой чертой или Cmd+K, ищет по номеру, названию, описанию и
   модулю и ведёт ещё и в разделы подготовки.

   Раскладку определяем не по букве: на русской та же клавиша даёт
   «.», поэтому кроме e.key смотрим на e.code — иначе сочетания
   работали бы только в английской раскладке.
   ============================================================ */

const Find = {
  sel: 0,
  items: [],
  back: null,          /* куда вернуть фокус после закрытия */

  norm: function (s) { return String(s).toLowerCase().replace(/ё/g, "е"); },

  /* Куда вообще можно попасть: уроки, разделы подготовки, карта
     курса и итоги закрытых модулей.

     hay — по чему ищем. Кроме названия и описания туда идут реплики
     наставника: он говорит об уроке живыми словами («если поймёте
     окна…»), а в названии стоит «Оконные функции». Русский язык
     склоняет, подстрока этого не переживает, — зато чем шире запас
     слов, тем чаще человек попадает с первого раза.            */
  places: function () {
    const out = Course.flat.map(function (l) {
      const kind = l.kind === "text" ? "разбор" : l.kind === "sql" ? "SQL" : "Python";
      return { href: "#" + l.id, key: l.id, num: l.num, title: l.title,
               note: l.desc, where: l.module.num + ". " + l.module.title,
               hay: [l.desc, l.module.title, kind, l.say, l.sayTask, l.sayDrills]
                      .filter(Boolean).join(" "),
               done: Course.isDone(l.id), soon: !l.ready };
    });
    out.push({ href: "#interview", title: "К собеседованию", where: "Раздел",
               note: "вопросы и задачи с интервью на одной странице",
               hay: "интервью собеседование вопросы задачи подготовка" });
    out.push({ href: "#my-notes", title: "Мой конспект", where: "Раздел",
               note: "ваши заметки из всех уроков",
               hay: "заметки конспект записи" });
    out.push({ href: "#glossary", title: "Словарь", where: "Раздел",
               note: "все термины курса простыми словами",
               hay: "словарь термины глоссарий понятия слова что значит" });
    /* термины словаря — чтобы найти слово, не вспоминая урок */
    (window.GLOSSARY ? window.GLOSSARY.terms : []).forEach(function (t) {
      const plain = t.plain.replace(/<[^>]+>/g, " ");
      out.push({ href: "#glossary/" + t.id, title: t.t.replace(/<[^>]+>/g, ""), where: "Словарь",
                 note: plain, gloss: true,
                 hay: t.forms.join(" ").replace(/[`$()|?]/g, " ") + " " + plain });
    });
    out.push({ href: "#", title: "Карта курса", where: "Раздел",
               note: "оглавление и как идут дела",
               hay: "оглавление главная программа календарь прогресс" });
    Course.data.modules.forEach(function (m) {
      if (Course.doneCount(m.lessons) === m.lessons.length) {
        out.push({ href: "#summary-" + m.id, where: "Раздел",
                   title: "Итог модуля " + m.num + ": " + m.title,
                   note: "что закрыто и что с этого спросят",
                   hay: "итог модуля " + m.title + " " + m.sub });
      }
    });
    return out;
  },

  /* Пустой запрос — не пустой список: сначала то место, где
     остановились, потом ближайшие непройденные уроки. */
  match: function (q) {
    const all = Find.places();
    if (!q.trim()) {
      const r = Stats.resume();
      const first = r ? all.filter(function (x) { return x.key === r.lesson.id; }) : [];
      return first.concat(all.filter(function (x) {
        return first.indexOf(x) < 0 && !x.gloss && (!x.key || (!x.done && !x.soon));
      })).slice(0, 7);
    }
    const words = Find.norm(q).split(/\s+/).filter(Boolean);
    const hit = [];
    all.forEach(function (x) {
      const head = Find.norm((x.num || "") + " " + x.title);
      const hay = head + " " + Find.norm(x.hay || "");
      if (!words.every(function (w) { return hay.indexOf(w) >= 0; })) return;
      /* совпадение в названии важнее совпадения в описании */
      hit.push({ x: x, rank: words.every(function (w) { return head.indexOf(w) >= 0; }) ? 0 : 1 });
    });
    hit.sort(function (a, b) { return a.rank - b.rank; });
    return hit.map(function (h) { return h.x; }).slice(0, 9);
  },

  draw: function () {
    const box = $("#findList");
    if (!Find.items.length) {
      box.innerHTML = '<p class="find-none">Ничего не нашлось. Попробуйте другое слово: ' +
        "«когорты», «выбросы», «окна» — или номер урока, «1.3».</p>";
      Find.mark();
      return;
    }
    box.innerHTML = Find.items.map(function (x, i) {
      return '<a class="find-it" id="find-it-' + i + '" href="' + x.href +
        '" role="option" aria-selected="false" data-i="' + i + '">' +
        '<span class="find-n">' + esc(x.num || "") + "</span>" +
        '<span class="find-t">' + esc(x.title) +
          '<span class="find-w">' + esc(x.where) + (x.soon ? ", скоро" : "") + "</span></span>" +
        '<span class="find-c">' + (x.done ? penTick(x.key) : "") + "</span></a>";
    }).join("");
    Find.mark();
  },

  /* Выделение переставляем классом, а не перерисовкой списка: иначе
     под движущейся мышью список пересобирался бы по сорок раз в
     секунду. Экранному диктору о выборе говорит aria-activedescendant. */
  mark: function (scroll) {
    const q = $("#findQ");
    let cur = null;
    Array.prototype.forEach.call(document.querySelectorAll(".find-it"), function (a) {
      const on = +a.dataset.i === Find.sel;
      a.classList.toggle("on", on);
      a.setAttribute("aria-selected", on);
      if (on) cur = a;
    });
    if (q) q.setAttribute("aria-activedescendant", cur ? cur.id : "");
    if (scroll && cur && cur.scrollIntoView) cur.scrollIntoView({ block: "nearest" });
  },

  step: function (d) {
    if (!Find.items.length) return;
    Find.sel = (Find.sel + d + Find.items.length) % Find.items.length;
    Find.mark(true);
  },

  build: function () {
    const bg = el("div", { class: "find", id: "findBg" });
    bg.innerHTML =
      '<div class="find-box" role="dialog" aria-modal="true" aria-label="Поиск по курсу">' +
        '<div class="find-top">' + ICON.find +
          '<input id="findQ" type="text" autocomplete="off" autocorrect="off" ' +
            'spellcheck="false" role="combobox" aria-expanded="true" aria-controls="findList" ' +
            'placeholder="Урок, тема или номер">' +
          '<button class="find-esc" id="findEsc" type="button">Закрыть</button>' +
        "</div>" +
        '<div class="find-list" id="findList" role="listbox" aria-label="Найденное"></div>' +
        '<div class="find-foot"><span><kbd>↑</kbd><kbd>↓</kbd> выбрать</span>' +
          "<span><kbd>&crarr;</kbd> открыть</span>" +
          '<span><button class="linkbtn" id="findKeys" type="button">все клавиши</button></span></div>' +
      "</div>";
    document.body.appendChild(bg);

    const q = $("#findQ", bg);
    q.addEventListener("input", function () {
      Find.items = Find.match(q.value); Find.sel = 0; Find.draw();
    });
    q.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); Find.step(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); Find.step(-1); }
      else if (e.key === "Enter") {
        const on = $(".find-it.on");
        if (on) { e.preventDefault(); on.click(); }
      } else if (e.key === "Escape") { e.preventDefault(); Find.close(); }
    });
    bg.addEventListener("click", function (e) {
      if (e.target === bg) { Find.close(); return; }
      const it = e.target.closest && e.target.closest(".find-it");
      /* ссылка сама поменяет адрес — панели остаётся закрыться */
      if (it) Find.close();
    });
    bg.addEventListener("mousemove", function (e) {
      const it = e.target.closest && e.target.closest(".find-it");
      if (!it) return;
      const i = +it.dataset.i;
      if (i !== Find.sel) { Find.sel = i; Find.mark(); }
    });
    $("#findEsc", bg).addEventListener("click", Find.close);
    $("#findKeys", bg).addEventListener("click", function () { Find.close(); Keys.help(); });
    return bg;
  },

  open: function () {
    const bg = $("#findBg") || Find.build();
    if (!bg.classList.contains("show")) Find.back = document.activeElement;
    bg.classList.add("show");
    document.body.classList.add("no-scroll");
    const q = $("#findQ");
    Find.items = Find.match(q.value = "");
    Find.sel = 0;
    Find.draw();
    q.focus();
  },

  close: function () {
    const bg = $("#findBg");
    if (!bg || !bg.classList.contains("show")) return;
    bg.classList.remove("show");
    document.body.classList.remove("no-scroll");
    if (Find.back && Find.back.focus) Find.back.focus();
    Find.back = null;
  },

  isOpen: function () {
    const bg = $("#findBg");
    return !!bg && bg.classList.contains("show");
  }
};

const Keys = {
  /* в поле ввода клавиша принадлежит полю, а не странице */
  typing: function (e) {
    const t = e.target;
    if (!t || !t.tagName) return false;
    const tag = t.tagName.toLowerCase();
    return t.isContentEditable || tag === "input" || tag === "textarea" || tag === "select";
  },

  list: [
    [["/"], "Найти урок", "или Cmd K"],
    [["["], "Предыдущий урок", "в открытом уроке"],
    [["]"], "Следующий урок", "в открытом уроке"],
    [["Cmd", "&crarr;"], "Запустить код, а в разборе — проверить", "в открытом уроке"],
    [["Пробел", "&larr;", "&rarr;"], "Карточка: открыть ответ, не вспомнил, вспомнил", "в уроке и в повторении"],
    [["Esc"], "Закрыть поиск или окно", ""],
    [["?"], "Этот список", ""]
  ],

  help: function () {
    modal("Клавиши",
      '<p style="margin:0 0 18px;color:var(--ink-2);font-size:15px">' +
      "Чтобы не тянуться к мыши посреди задачи.</p>" +
      '<table class="keys"><tbody>' + Keys.list.map(function (k) {
        return "<tr><td>" + k[0].map(function (x) { return "<kbd>" + x + "</kbd>"; }).join("") +
          "</td><td>" + esc(k[1]) +
          (k[2] ? '<span class="keys-w">' + esc(k[2]) + "</span>" : "") + "</td></tr>";
      }).join("") + "</tbody></table>");
  },

  init: function () {
    document.addEventListener("keydown", function (e) {
      if (e.defaultPrevented) return;
      const mod = e.metaKey || e.ctrlKey;

      /* Cmd/Ctrl+K работает и из поля ввода: это общепринятый вызов поиска */
      if (mod && !e.altKey && !e.shiftKey && (e.key === "k" || e.key === "K" || e.code === "KeyK")) {
        e.preventDefault(); Find.open(); return;
      }
      if (e.key === "Escape" && Find.isOpen()) { e.preventDefault(); Find.close(); return; }
      if (mod || e.altKey || Keys.typing(e)) return;

      const slash = e.code === "Slash" || e.key === "/" || e.key === "?";
      if (slash && !e.shiftKey && e.key !== "?") { e.preventDefault(); Find.open(); return; }
      if (slash) { e.preventDefault(); Keys.help(); return; }

      /* соседние уроки: скобки стоят рядом и не заняты браузером */
      const dir = (e.code === "BracketLeft" || e.key === "[") ? -1
                : (e.code === "BracketRight" || e.key === "]") ? 1 : 0;
      if (dir && Router.current) {
        const n = Course.neighbour(Router.current, dir);
        if (n) { e.preventDefault(); Router.go("#" + n.id); }
      }
    });
  }
};

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
    const page = Pages.find(id);
    if (!force && id && !lesson && !page && document.getElementById(id)) return;

    /* Возврат к адресу урока, который и так открыт (например, кнопкой
       «назад» после перехода по якорю), — просто подъём наверх.      */
    if (!force && lesson && Router.current === id) {
      window.scrollTo(0, 0);
      return;
    }

    Router.cleanup.forEach(function (f) { try { f(); } catch (e) {} });
    Router.cleanup = [];

    /* Окно и поиск живут вне страницы и пережили бы переход: открытая
       подсказка поверх новой страницы выглядит как сбой. */
    Find.close();
    const open = $("#modalBg");
    if (open) open.classList.remove("show");

    const hdr = $(".hdr"); if (hdr) hdr.remove();
    const bar = $("#storeBar"); if (bar) bar.remove();

    const app = document.getElementById("app");
    app.innerHTML = "";

    /* текущий урок известен уже во время отрисовки: по нему словарь
       терминов решает, какие слова подчёркивать в этом модуле */
    Router.current = lesson ? id : null;
    if (page) page(app, id);
    else if (id) renderLesson(app, id);
    else renderHome(app);

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
  Keys.init();
  Offline.init();
  acceptDroppedProgress();
  Router.render();
  window.addEventListener("hashchange", function () { Router.render(); });
});

})();
