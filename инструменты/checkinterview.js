#!/usr/bin/env node
/* Пробное собеседование (#mock): пул interview.js.
   SQL — решение каждой задачи выполняется на базе такси и сверяется со
   своим expected по правилам Check.match (копия из checksteps.js); id
   уникальны, задач по 4 на уровень, lesson — существующий урок; у кейса
   5–6 пунктов чек-листа; MockCore из app.js выбирает по задаче каждого
   уровня и избегает прошлой попытки.
     node инструменты/checkinterview.js              — всё
     node инструменты/checkinterview.js --print id   — expected по решению */
"use strict";
const fs = require("fs"), vm = require("vm"), path = require("path");
const { DatabaseSync } = require("node:sqlite");
const base = path.resolve(__dirname, "..");
const ctx = { window: {} }; vm.createContext(ctx);
for (const f of ["lessons.js", "data-taxi.js", "interview.js"])
  vm.runInContext(fs.readFileSync(path.join(base, f), "utf8"), ctx);
const M = ctx.window.MOCK, T = ctx.window.TAXI, COURSE = ctx.window.COURSE;

const db = new DatabaseSync(":memory:");
db.exec(T.sql);
function fill(csv, sql, conv) {
  const st = db.prepare(sql);
  db.exec("BEGIN");
  csv.split("\n").slice(1).forEach(function (l) { if (l) st.run.apply(st, conv(l.split(","))); });
  db.exec("COMMIT");
}
/* как Taxi.fill в app.js */
const n = function (v) { return v === "" ? null : +v; }, t = function (v) { return v === "" ? null : v; };
fill(T.ridersCSV, "INSERT INTO riders VALUES (?,?,?,?)", function (c) { return [+c[0], c[1], c[2], c[3]]; });
fill(T.driversCSV, "INSERT INTO drivers VALUES (?,?,?,?)", function (c) { return [+c[0], c[1], c[2], c[3]]; });
fill(T.tripsCSV, "INSERT INTO trips VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
  function (c) { return [+c[0], +c[1], n(c[2]), c[3], c[4], c[5], t(c[6]), n(c[7]), c[8], n(c[9]), n(c[10]), +c[11], n(c[12])]; });

function query(sql) {
  const st = db.prepare(sql);
  const columns = st.columns().map(function (c) { return c.name; });
  return { columns: columns, values: st.all().map(function (r) { return columns.map(function (c) { return r[c]; }); }) };
}
/* ---- копия Check.cellEq и Check.match (как в checksteps.js) ---- */
function cellEq(a, b) {
  if (a === null || a === undefined) a = "";
  if (b === null || b === undefined) b = "";
  const na = Number(a), nb = Number(b);
  if (a !== "" && b !== "" && !isNaN(na) && !isNaN(nb)) return Math.abs(na - nb) < 0.011;
  return String(a).trim() === String(b).trim();
}
function check(res, exp) {
  const gc = res.columns.map(function (c) { return String(c).toLowerCase(); });
  if (gc.join("|") !== exp.columns.map(function (c) { return c.toLowerCase(); }).join("|"))
    return "столбцы " + res.columns.join(", ") + ", а в expected " + exp.columns.join(", ");
  let got = res.values.slice(), want = exp.rows.slice();
  if (got.length !== want.length) return "строк " + got.length + ", в expected " + want.length;
  if (!exp.ordered) {
    const key = function (r) { return r.map(function (v) { return v === null ? "" : String(v); }).join("|"); };
    got.sort(function (x, y) { return key(x) < key(y) ? -1 : 1; });
    want.sort(function (x, y) { return key(x) < key(y) ? -1 : 1; });
  }
  for (let r = 0; r < want.length; r++)
    for (let c = 0; c < want[r].length; c++)
      if (!cellEq(got[r][c], want[r][c])) return "строка " + (r + 1) + ", «" + exp.columns[c] + "»: " + got[r][c] + " вместо " + want[r][c];
  return "";
}

const args = process.argv.slice(2);
if (args[0] === "--print") {
  const x = M.sql.filter(function (s) { return s.id === args[1]; })[0];
  const r = query(x.solution);
  console.log(JSON.stringify({ columns: r.columns, rows: r.values }));
  process.exit(0);
}

const bad = [];
const lessons = {};
COURSE.modules.forEach(function (m) { m.lessons.forEach(function (l) { lessons[l.id] = true; }); });
const ids = {};
M.sql.concat(M.cases).forEach(function (x) {
  if (ids[x.id]) bad.push("id повторяется: " + x.id);
  ids[x.id] = true;
});
["easy", "mid", "hard"].forEach(function (lv) {
  const k = M.sql.filter(function (s) { return s.level === lv; }).length;
  if (k !== 4) bad.push("задач уровня " + lv + ": " + k + ", нужно 4");
});
M.sql.forEach(function (s) {
  ["title", "body", "solution", "expected", "lesson"].forEach(function (f) { if (!s[f]) bad.push(s.id + ": нет поля " + f); });
  if (s.lesson && !lessons[s.lesson]) bad.push(s.id + ": нет урока " + s.lesson);
  try { const why = check(query(s.solution), s.expected); if (why) bad.push(s.id + ": " + why); }
  catch (e) { bad.push(s.id + ": решение падает — " + e.message); }
});
M.cases.forEach(function (c) {
  ["title", "body", "ref"].forEach(function (f) { if (!c[f]) bad.push(c.id + ": нет поля " + f); });
  if (!Array.isArray(c.check) || c.check.length < 5 || c.check.length > 6) bad.push(c.id + ": в чек-листе нужно 5–6 пунктов");
});

/* MockCore из app.js — вырезаем, как Taxi в checktaxi.js */
const app = fs.readFileSync(path.join(base, "app.js"), "utf8");
const mc = app.match(/\nconst MockCore = \{[\s\S]*?\n\};\n/);
if (!mc) bad.push("в app.js нет объекта MockCore");
else {
  const box = {}; vm.createContext(box);
  vm.runInContext(mc[0].replace("const MockCore", "var MockCore"), box);
  const C = box.MockCore;
  const refs = []; for (let i = 0; i < 40; i++) refs.push({ id: "x", n: i });
  for (let k = 0; k < 50; k++) {
    const p = C.pick(M.sql, M.cases, refs, []);
    const lv = p.sql.map(function (id) { return M.sql.filter(function (s) { return s.id === id; })[0].level; }).join(",");
    if (lv !== "easy,mid,hard") { bad.push("MockCore.pick: уровни " + lv); break; }
    if (p.quiz.length !== 5 || new Set(p.quiz.map(function (q) { return q.n; })).size !== 5) { bad.push("MockCore.pick: вопросов не 5 разных"); break; }
    const again = C.pick(M.sql, M.cases, refs, p.sql.concat([p.cas]));
    if (again.sql.some(function (id) { return p.sql.indexOf(id) >= 0; }) || again.cas === p.cas) { bad.push("MockCore.pick повторил прошлую попытку"); break; }
  }
  if (C.left(0, 50 * 60000) !== 0) bad.push("MockCore.left: после 50 минут не 0");
  if (C.left(1000, 1000) !== 45 * 60000) bad.push("MockCore.left: в начале не 45 минут");
  if (C.clock(61000) !== "1:01" || C.clock(45 * 60000) !== "45:00") bad.push("MockCore.clock: " + C.clock(61000));
  if (C.mins(0, 99 * 60000) !== 45) bad.push("MockCore.mins: больше 45");
  const hist = { "100": { ids: ["a"] }, "300": { ids: ["c"] }, "200": { ids: ["b"] } };
  if (C.lastIds(hist).join() !== "c") bad.push("MockCore.lastIds: " + C.lastIds(hist).join());
}

if (bad.length) { console.log("Пробное собеседование:\n" + bad.join("\n")); process.exit(1); }
console.log("Пробное собеседование: SQL " + M.sql.length + ", кейсов " + M.cases.length + ", MockCore ок");
