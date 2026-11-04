#!/usr/bin/env node
/* Темы ошибок запуска: реальные диагнозы Check, счётчики и повторение. */
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm"), assert = require("assert/strict");
const { execFileSync } = require("child_process"), { DatabaseSync } = require("node:sqlite");
const base = path.join(__dirname, ".."), src = fs.readFileSync(path.join(base, "app.js"), "utf8");
let state = { codeReview: {} }, day = "2026-11-04";
const c = { window: {}, Store: {
  all: () => state, get: (b, k, d) => state[b]?.[k] ?? d,
  set: (b, k, v) => { (state[b] ||= {})[k] = JSON.parse(JSON.stringify(v)); }
}, Course: { byId: id => /^m[0-7]l\d+$/.test(id) ? { id } : null },
Review: { STEPS: [1, 3, 7, 21] }, isoDay: () => day,
addDays: (s, n) => new Date(Date.parse(s + "T12:00:00Z") + n * 864e5).toISOString().slice(0, 10) };
vm.createContext(c);
for (const name of ["Engine", "Check", "CodeReview"]) {
  const start = src.indexOf("const " + name + " = {");
  if (start >= 0) vm.runInContext(src.slice(start, src.indexOf("\n};", start) + 3) + "\nthis." + name + "Api = " + name + ";", c);
}
const R = c.CodeReviewApi, origin = { lesson: "m1l3", section: "s-task" };
let passed = 0, failed = 0;
function test(name, f) { try { f(); passed++; console.log("✓ " + name); } catch (e) { failed++; console.error("✗ " + name + ": " + e.message); } }
test("ошибка имени таблицы попадает в тему SQL", () => assert.equal(R.record("sql", "SQLite: no such table: userz", "SELECT * FROM userz", origin), "sql-schema"));
test("ошибка имени столбца относится к той же теме", () => {
  R.record("sql", "SQLite: no such column: cty", "SELECT cty FROM users", origin);
  assert.equal(state.codeReview["sql-schema"].count, 2);
  assert.equal(state.codeReview["sql-schema"].due, "2026-11-04");
});
test("агрегат в WHERE получает отдельную практику", () => assert.equal(R.record("sql", "SQLite: misuse of aggregate: COUNT()", "SELECT city,COUNT(*) FROM users WHERE COUNT(*)>40 GROUP BY city", origin), "sql-aggregate"));
test("ошибка диалекта SQL не выдаётся за ошибку столбца", () => assert.equal(R.record("sql", "SQLite: no such column: day", "SELECT DATEDIFF(day,signup_date,'2024-01-01') FROM users", origin), null));
test("фоновые эталоны не добавляют ошибки ученика", () => {
  const n = state.codeReview["sql-schema"].count;
  assert.equal(R.record("sql", "SQLite: no such table: nope", "SELECT * FROM nope"), null);
  assert.equal(state.codeReview["sql-schema"].count, n);
});
test("неизменённая ошибочная заготовка не считается промахом ученика", () => {
  const code = 'print("Оплачено:", paid)\npaid = 189\ntotal = 215';
  assert.equal(R.record("python", "NameError: name 'paid' is not defined", code, Object.assign({}, origin, { starter: code })), null);
});
test("неизвестная ошибка и неверный результат не создают тему", () => {
  assert.equal(R.record("sql", "не совпало число строк", "SELECT * FROM users", origin), null);
  assert.equal(R.record("python", "RuntimeError: server disconnected", "print(1)", origin), null);
});
test("NameError переменной распознаётся", () => assert.equal(R.record("python", "NameError: name 'paid' is not defined", "print(paid)", origin), "py-name"));
test("ошибка импорта не выдаётся за переменную", () => assert.equal(R.record("python", "NameError: name 'pd' is not defined", "pd.DataFrame()", origin), null));
test("KeyError столбца распознаётся, метки индекса — нет", () => {
  assert.equal(R.record("python", "KeyError: 'revenu'", 'print(orders["revenu"].sum())', origin), "py-column");
  assert.equal(R.record("python", "KeyError: 'Москва'", 'print(users.loc["Москва"])', origin), null);
});
test("условие по целому столбцу получает свою тему", () => assert.equal(R.record("python", "ValueError: The truth value of a Series is ambiguous. Use a.empty, a.bool(), a.item(), a.any() or a.all().", 'orders[(orders["revenue"]>5000) and (orders["status"]=="paid")]', origin), "py-condition"));
test("правильная практика назначает повторение на завтра", () => {
  const r = state.codeReview["sql-schema"];
  assert.ok(R.complete("sql-schema", r.round));
  assert.equal(state.codeReview["sql-schema"].due, "2026-11-05");
  assert.equal(state.codeReview["sql-schema"].count, 2);
});
test("одна попытка не продвигает расписание дважды", () => {
  const r = state.codeReview["sql-schema"], round = r.round - 1;
  assert.equal(R.complete("sql-schema", round), null);
  assert.equal(state.codeReview["sql-schema"].due, "2026-11-05");
});
test("новая ошибка возвращает тему на сегодня", () => {
  R.record("sql", "SQLite: no such table: userz", "SELECT * FROM userz", origin);
  assert.equal(state.codeReview["sql-schema"].due, "2026-11-04");
  assert.equal(state.codeReview["sql-schema"].step, -1);
});
test("новое открытие практики до срока не продвигает лестницу", () => {
  const r = state.codeReview["sql-schema"];
  R.complete("sql-schema", r.round);
  const saved = JSON.stringify(state.codeReview["sql-schema"]);
  assert.equal(R.complete("sql-schema", state.codeReview["sql-schema"].round), null);
  assert.equal(JSON.stringify(state.codeReview["sql-schema"]), saved);
});
test("ошибка от запуска до сброса не возвращается в новый прогресс", () => {
  const before = state._reset;
  state._reset = "новый-прогресс";
  const count = state.codeReview["py-name"].count;
  assert.equal(R.record("python", "NameError: name 'paid' is not defined", "print(paid)", Object.assign({}, origin, { reset: before })), null);
  assert.equal(state.codeReview["py-name"].count, count);
});
test("новый запуск после сброса записывает актуальную ошибку", () => {
  assert.equal(R.record("python", "NameError: name 'paid' is not defined", "print(paid)", Object.assign({}, origin, { reset: state._reset })), "py-name");
});
test("после лестницы повторений тема закреплена", () => {
  for (let i = 0; i < 5; i++) { const r = state.codeReview["sql-schema"]; day = r.due; R.complete("sql-schema", r.round); }
  assert.equal(state.codeReview["sql-schema"].done, true);
  assert.equal(R.due().some(x => x.topic.id === "sql-schema"), false);
});
test("чужие и повреждённые темы импорта не ломают список", () => {
  state.codeReview.unknown = { count: 100 };
  state.codeReview["py-name"] = { count: "не число" };
  assert.equal(R.list().some(x => x.topic.id === "unknown" || x.topic.id === "py-name"), false);
});
test("комментарий с WHERE не меняет тему ошибки агрегата", () => {
  assert.equal(R.identify("sql", "SQLite: misuse of aggregate: COUNT()", "SELECT SUM(COUNT(*)) FROM users -- WHERE COUNT(*)>40"), null);
});
test("ошибка ключа словаря не выдаётся за столбец", () => {
  assert.equal(R.identify("python", "KeyError: 'revenue'", 'd = {}\nprint(d["revenue"])'), null);
});
vm.runInContext(fs.readFileSync(path.join(base, "data.js"), "utf8"), c);
vm.runInContext(fs.readFileSync(path.join(base, "content-core.js"), "utf8"), c);
const bank = c.window.SH.codePractice, db = new DatabaseSync(path.join(__dirname, "shop.db"), { readOnly: true });
const py22 = "/Users/nekozlovskiy/.cache/analyst-notebook/v312/bin/python";
for (const topic of R.topics) test("практика " + topic.id + ": эталон и ошибка заготовки", () => {
  const p = bank[topic.id]; assert.ok(p && p.body && p.hint && p.starter && p.solution && p.expected);
  if (topic.lang === "sql") {
    const q = db.prepare(p.solution), rows = q.all();
    assert.deepEqual(q.columns().map(x => x.name), Array.from(p.expected.columns));
    assert.equal(JSON.stringify(rows.map(x => Object.values(x))), JSON.stringify(p.expected.rows));
    let err = ""; try { db.prepare(p.starter).all(); } catch (e) { err = e.message; }
    assert.equal(R.identify("sql", err, p.starter), topic.id);
  } else {
    const init = (p.env.data || []).map(k => k + " = " + JSON.stringify(c.window.DATA[k])).join("\n") + "\n" + (p.env.prelude || "") + "\n";
    for (const python of ["python3", ...(fs.existsSync(py22) ? [py22] : [])]) {
      const out = execFileSync(python, ["-"], { input: init + p.solution, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
      assert.equal(out.trim(), p.expected.stdout);
      assert.equal(c.CheckApi.uses(p.solution, p.expected.uses), "");
      let err = ""; try { execFileSync(python, ["-"], { input: init + p.starter, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }); }
      catch (e) { err = String(e.stderr); }
      assert.equal(R.identify("python", err, p.starter), topic.id);
    }
  }
});
db.close();
console.log("Ошибки кода: пройдено " + passed + ", ошибок " + failed); process.exitCode = failed ? 1 : 0;
