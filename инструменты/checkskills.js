#!/usr/bin/env node
/* Карта навыков: разметка COURSE.skills в lessons.js и расчёт ступеней
   Skills из app.js на подменённом прогрессе.

     node инструменты/checkskills.js

   Код выхода 1 — есть ошибки, каждая печатается строкой. */
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
const base = path.resolve(__dirname, "..");
const read = function (f) { return fs.readFileSync(path.join(base, f), "utf8"); };

const c = { window: { SH: {}, CONTENT: {}, DATA: {} } };
vm.createContext(c);
["lessons.js", "data.js", "content-core.js"]
  .concat(fs.readdirSync(base).filter(function (f) { return /^content-m\d+\.js$/.test(f); }).sort())
  .forEach(function (f) { vm.runInContext(read(f), c, { filename: f }); });
const COURSE = c.window.COURSE, CONTENT = c.window.CONTENT;

const errs = [];
const bad = function (m) { errs.push(m); };

/* уроки по порядку карты, с модулем и номером — как Course в app.js */
const flat = [];
COURSE.modules.forEach(function (m) {
  m.lessons.forEach(function (l, i) {
    flat.push(Object.assign({}, l, { module: { id: m.id, num: m.num }, num: m.num + "." + (i + 1) }));
  });
});
const byId = function (id) { return flat.filter(function (l) { return l.id === id; })[0] || null; };

/* ---- разметка ---- */
const skills = COURSE.skills;
if (!Array.isArray(skills) || !skills.length) bad("в lessons.js нет COURSE.skills");
const ids = new Set();
(skills || []).forEach(function (s, i) {
  const at = "навык " + (s.id || "#" + i);
  ["id", "group", "title"].forEach(function (k) { if (!s[k]) bad(at + ": нет поля " + k); });
  if (ids.has(s.id)) bad(at + ": id повторяется");
  ids.add(s.id);
  if (!Array.isArray(s.lessons) || !s.lessons.length) { bad(at + ": пустой lessons"); return; }
  let prev = -1;
  s.lessons.forEach(function (id, j) {
    const l = byId(id);
    if (!l) { bad(at + ": нет урока " + id); return; }
    if (!l.ready) bad(at + ": урок " + id + " не готов");
    if (s.lessons.indexOf(id) !== j) bad(at + ": урок " + id + " указан дважды");
    const k = flat.indexOf(l);
    if (k < prev) bad(at + ": урок " + id + " стоит не в порядке курса");
    prev = k;
    const C = CONTENT[id] || {};
    if (!(C.drills || []).length) bad(at + ": у урока " + id + " нет тренажёра");
    if (!(C.quiz || []).length) bad(at + ": у урока " + id + " нет самопроверки");
  });
});

/* ---- Skills из app.js (задача 2) ---- */
const src = read("app.js");
const start = src.indexOf("const Skills = {");
if (start < 0) bad("в app.js нет const Skills");
else {
  /* тело объекта — до парной закрывающей скобки (в строках Skills скобок нет) */
  let i = src.indexOf("{", start), depth = 0, end = -1;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) { end = i + 1; break; }
  }
  let state = {}, closed = new Set();
  const Store = { get: function (b, k, d) { return state[b] && k in state[b] ? state[b][k] : d; } };
  const Course = { data: COURSE, byId: byId, isDone: function (id) { return !!Store.get("done", id, false); } };
  const Plan = { closed: function (l) { return closed.has(l.module.id); } };
  const Review = { when: function (iso) { return "WHEN(" + iso + ")"; } };
  const isoDay = function () { return "2026-10-05"; };
  const plural = function (n, one, few, many) {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b > 1 && b < 5) return few;
    if (b === 1) return one;
    return many;
  };
  const Skills = new Function("Store", "Course", "Plan", "Review", "isoDay", "plural", "window",
    "const Skills = " + src.slice(src.indexOf("{", start), end) + "; return Skills;")(
    Store, Course, Plan, Review, isoDay, plural, { CONTENT: CONTENT });

  const eq = function (name, got, want) {
    const g = JSON.stringify(got), w = JSON.stringify(want);
    if (g !== w) bad(name + ": " + g + ", ожидалось " + w);
  };
  const sk = function (id) { return Skills.list().filter(function (s) { return s.id === id; })[0]; };
  const marks = function (lid, n) {
    const o = {};
    for (let i = 0; i < n; i++) o[lid + ":" + i] = 1;
    return o;
  };
  const rv = function (lid, arr) {
    const o = {};
    arr.forEach(function (r, i) { if (r) o[lid + ":" + i] = r; });
    return o;
  };
  const H = { step: 2, due: "2026-10-12" }, D = { step: 3, done: true },
        L1 = { step: 1, due: "2026-10-08" }, T = { step: 0, due: "2026-10-05" };
  let v;

  eq("список навыков", Skills.list().length, COURSE.skills.length);

  state = {};
  v = Skills.level(sk("sql-join"));
  eq("пусто: ступень", v.stage, 0);
  eq("пусто: числа", [v.lessons, v.drills, v.quiz], [[0, 1], [0, 5], [0, 6]]);
  eq("пусто: дальше", v.next, { text: "Пройти урок 1.2", href: "#m1l1" });

  state = { done: { m1l1: 1 } };
  v = Skills.level(sk("sql-join"));
  eq("урок пройден: ступень", v.stage, 1);
  eq("урок пройден: дальше", v.next, { text: "Тренажёр урока 1.2: решено 0 из 5", href: "#m1l1" });

  /* половина тренажёра на 10 задачах: 4 — мало, 5 — достаточно */
  state = { done: { m2l2: 1, m2l3: 1 }, drills: marks("m2l2", 4) };
  v = Skills.level(sk("pd-clean"));
  eq("тренажёр 4 из 10: ступень", v.stage, 1);
  eq("тренажёр 4 из 10: дальше", v.next, { text: "Тренажёр урока 2.3: решено 0 из 5", href: "#m2l3" });
  state.drills = Object.assign(marks("m2l2", 4), marks("m2l3", 1));
  eq("тренажёр 5 из 10: ступень", Skills.level(sk("pd-clean")).stage, 2);

  /* 80% из 6 вопросов: 4 мало, 5 достаточно; ступень 1 (3 дня) не считается */
  state = { done: { m1l1: 1 }, drills: marks("m1l1", 3), review: rv("m1l1", [H, H, D, H, L1, L1]) };
  v = Skills.level(sk("sql-join"));
  eq("вопросы 4 из 6: ступень", v.stage, 2);
  eq("вопросы 4 из 6: числа", v.quiz, [4, 6]);
  eq("вопросы 4 из 6: дальше", v.next, { text: "Вопросы вернутся в повторении WHEN(2026-10-08)", href: null });
  state.review = rv("m1l1", [H, H, D, H, H, L1]);
  v = Skills.level(sk("sql-join"));
  eq("вопросы 5 из 6: ступень", v.stage, 3);
  eq("вопросы 5 из 6: дальше", v.next, null);
  state.review = rv("m1l1", [L1, L1, L1, L1, L1, L1]);
  eq("интервал 3 дня не держится", Skills.level(sk("sql-join")).quiz, [0, 6]);

  state.review = rv("m1l1", [H, H, D, H]);
  eq("вопрос без ответа", Skills.level(sk("sql-join")).next, { text: "Самопроверка урока 1.2", href: "#m1l1" });
  state.review = rv("m1l1", [H, H, D, H, T, L1]);
  eq("вопрос на сегодня", Skills.level(sk("sql-join")).next, { text: "Вопросы ждут в повторении на главной", href: "#" });

  /* ровно 80%: в навыке «Регрессия» 35 вопросов, 27 — мало, 28 — достаточно */
  const reg = ["m5l1", "m5l2", "m5l3", "m5l4", "m5l5"];
  const regState = function (n) {
    const st = { done: {}, drills: {}, review: {} };
    reg.forEach(function (l) {
      st.done[l] = 1;
      Object.assign(st.drills, marks(l, 3));
      for (let i = 0; i < 7; i++) st.review[l + ":" + i] = n-- > 0 ? H : L1;
    });
    return st;
  };
  state = regState(27);
  eq("вопросы 27 из 35: ступень", Skills.level(sk("regression")).stage, 2);
  state = regState(28);
  eq("вопросы 28 из 35: ступень", Skills.level(sk("regression")).stage, 3);

  /* модуль 3 закрыт итоговым тестом — его уроки засчитаны */
  state = {}; closed = new Set(["m3"]);
  v = Skills.level(sk("stat-tests"));
  eq("закрытый модуль: ступень", v.stage, 1);
  eq("закрытый модуль: уроки", v.lessons, [4, 4]);
  eq("закрытый модуль: изучен", Skills.learned(sk("stat-tests")), true);
  closed = new Set();

  /* опечатка в id урока не роняет страницу */
  COURSE.skills.push({ id: "typo", group: "SQL", title: "Опечатка", lessons: ["m9l9"] });
  eq("неизвестный урок отброшен", Skills.list().length, COURSE.skills.length - 1);
  COURSE.skills.pop();

  eq("модули навыков", Skills.modules([sk("cohorts"), sk("sql-join")]), ["m1", "m4"]);

  eq("итог 2/3/4", Skills.say([2, 3, 4], 14), "Держатся 2 навыка из 14, закреплены ещё 3, изучены ещё 4.");
  eq("итог 0/0/1", Skills.say([0, 0, 1], 14), "Изучен 1 навык из 14.");
  eq("итог 0/5/0", Skills.say([0, 5, 0], 14), "Закреплены 5 навыков из 14.");
  eq("итог пусто", Skills.say([0, 0, 0], 14), "Пока ни один навык не изучен: для этого нужно пройти все его уроки.");
}

if (errs.length) {
  errs.forEach(function (e) { console.log("✗ " + e); });
  process.exit(1);
}
console.log("✓ карта навыков: " + skills.length + " навыков, ступени считаются верно");
