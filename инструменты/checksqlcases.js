#!/usr/bin/env node
/* Проверка SQL на вариантах: настоящий SQLite, исходные данные и контрпримеры. */
"use strict";
const fs = require("fs"), vm = require("vm"), path = require("path"), assert = require("assert/strict");
const { DatabaseSync } = require("node:sqlite");
const base = path.resolve(__dirname, ".."), src = fs.readFileSync(path.join(base, "app.js"), "utf8");
const ctx = { window: { CONTENT: {}, SH: {} } };
vm.createContext(ctx);
vm.runInContext(src.slice(src.indexOf("function esc("), src.indexOf("/* Перемешанные индексы")), ctx);
for (const f of ["data.js", "content-core.js", "content-m1.js"]) vm.runInContext(fs.readFileSync(path.join(base, f), "utf8"), ctx);
for (const name of ["Engine", "Check", "SqlCases"]) {
  const start = src.indexOf("const " + name + " = {");
  if (start >= 0) vm.runInContext(src.slice(start, src.indexOf("\n};", start) + 3) + "\nthis." + name + " = " + name + ";", ctx);
}
const helpers = src.slice(src.indexOf("function csvCells("), src.indexOf("/* Заголовок статуса", src.indexOf("function csvCells(")));
vm.runInContext(helpers, ctx);
/* Только адаптация API sql.js к node:sqlite, вычисления выполняет SQLite.
   Запросы корпуса не содержат ';' внутри строк или комментариев. */
class Database {
  constructor() { this.db = new DatabaseSync(":memory:"); this.closed = false; }
  run(sql) { this.db.exec(sql); }
  prepare(sql) { const st = this.db.prepare(sql); return { run: values => st.run(...values), free() {} }; }
  *iterateStatements(sql) {
    for (const part of sql.split(";").filter(s => s.trim())) {
      const st = this.db.prepare(part), cols = st.columns().map(c => c.name);
      let rows = null, i = -1;
      yield { getColumnNames: () => cols, step: () => {
        if (!rows) { st.setReturnArrays(true); rows = st.all(); }
        return ++i < rows.length;
      }, get: () => rows[i], free() {} };
    }
  }
  exec(sql) { const r = ctx.sqlLast(this, sql); return r ? [r] : []; }
  close() { this.db.close(); this.closed = true; }
}
ctx.Engine.sqlModule = { Database };
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log("✓ " + name); } catch (e) { failed++; console.error("✗ " + name + ": " + e.message); } }
test("доступна проверка на отдельной базе", () => assert.equal(typeof ctx.SqlCases?.check, "function"));
const selected = [["m1l1", 2], ["m1l9", 4], ["m1l9", 8]];
test("в трёх задачах есть проверяемые варианты данных", () => {
  for (const [id, i] of selected) assert.ok(ctx.window.CONTENT[id].drills[i].sqlCases?.length >= 2, id + ":" + i);
});
if (ctx.SqlCases && !failed) {
  const S = ctx.SqlCases;
  for (const [id, i] of selected) {
    const d = ctx.window.CONTENT[id].drills[i];
    test(id + ":" + i + " эталон проходит каждый вариант", () => {
      const r = S.check(d.solution, d.solution, d.sqlCases);
      assert.equal(r.ok, true); assert.equal(r.total, d.sqlCases.length);
    });
  }
  const orphan = ctx.window.CONTENT.m1l1.drills[2], neg = ctx.window.CONTENT.m1l9.drills[4], nul = ctx.window.CONTENT.m1l9.drills[8];
  test("константа 0 совпадает на базе, но отвергается после появления сироты", () => {
    const r = S.check("SELECT 0 AS orphan_orders", orphan.solution, orphan.sqlCases);
    assert.equal(r.ok, false); assert.deepEqual(JSON.parse(JSON.stringify(r.expected.values)), [[1]]);
    assert.deepEqual(JSON.parse(JSON.stringify(r.got.values)), [[0]]);
  });
  test("другой корректный anti-JOIN проходит варианты", () => assert.equal(S.check("SELECT COUNT(*) FROM orders o WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.user_id=o.user_id)", orphan.solution, orphan.sqlCases).ok, true));
  test("удаление пользователя 31 оставляет три заказа без пары", () => {
    const r = S.check("SELECT -1", orphan.solution, [orphan.sqlCases[1]]);
    assert.deepEqual(JSON.parse(JSON.stringify(r.expected.values)), [[3]]);
  });
  test("константа 13 отвергается при изменении пропусков", () => {
    const r = S.check("SELECT 13 AS unassigned", nul.solution, nul.sqlCases);
    assert.equal(r.ok, false); assert.deepEqual(JSON.parse(JSON.stringify(r.expected.values)), [[14]]);
  });
  test("подстановка известных отрицательных сумм отвергается", () => {
    const literal = "SELECT 1022 AS lead_id,-8811 AS deal UNION ALL SELECT 1025,-5322 UNION ALL SELECT 1025,-5322 UNION ALL SELECT 1035,-4789 ORDER BY lead_id";
    assert.equal(S.check(literal, neg.solution, neg.sqlCases).ok, false);
  });
  test("после назначения менеджеров пропусков нет", () => {
    const r = S.check("SELECT -1", nul.solution, [nul.sqlCases[1]]);
    assert.deepEqual(JSON.parse(JSON.stringify(r.expected.values)), [[0]]);
  });
  test("новая отрицательная сумма читается с десятичной запятой", () => {
    const r = S.check("SELECT 0,0", neg.solution, [neg.sqlCases[1]]);
    assert.equal(r.expected.values.length, 5);
    assert.deepEqual(JSON.parse(JSON.stringify(r.expected.values[0])), [1001, -100.5]);
  });
  test("повтор строки остаётся отдельной строкой ответа", () => {
    const r = S.check(neg.solution, neg.solution, [neg.sqlCases[0]]);
    assert.equal(r.ok, true);
    const wrong = S.check(neg.solution.replace("SELECT lead_id", "SELECT DISTINCT lead_id"), neg.solution, [neg.sqlCases[0]]);
    assert.equal(wrong.ok, false); assert.equal(wrong.expected.values.length, 5);
  });
  test("каждый вариант начинается с исходных данных", () => {
    const r = S.check("SELECT COUNT(*) AS n FROM leads", "SELECT COUNT(*) AS n FROM leads", [
      { title: "добавление", change: "INSERT INTO leads SELECT * FROM leads WHERE lead_id=1022", explain: "дубль" },
      { title: "чистый", change: "CREATE TEMP TABLE fresh_guard(n CHECK(n=63)); INSERT INTO fresh_guard SELECT COUNT(*) FROM leads;", explain: "без накопления изменений" }
    ]);
    assert.equal(r.ok, true);
    const clean = S.check("SELECT 63", "SELECT COUNT(*) FROM leads", [{ title: "чистый", change: "", explain: "" }]);
    assert.equal(clean.ok, true);
  });
  test("запись не исполняется при дополнительной проверке", () => assert.equal(S.check("DELETE FROM leads; SELECT 13", nul.solution, nul.sqlCases).blocked, true));
  test("ошибка SQL на варианте возвращает контрпример", () => {
    const r = S.check("SELECT missing FROM leads", nul.solution, nul.sqlCases);
    assert.equal(r.ok, false); assert.match(r.error, /missing/); assert.ok(r.expected);
  });
  test("ошибка эталона не выдаётся за ошибку ученика", () => assert.throws(() => S.check("SELECT 1", "SELECT missing FROM leads", nul.sqlCases), /missing/));
  test("ошибочный вариант не выдаётся за ошибку ученика", () => assert.throws(() => S.check("SELECT 1", "SELECT 1", [{ change: "BAD SQL" }])));
  test("пустой SELECT остаётся таблицей с заголовком", () => {
    const r = S.check("SELECT lead_id FROM leads WHERE 0", nul.solution, nul.sqlCases);
    assert.equal(r.ok, false); assert.equal(r.got.values.length, 0); assert.equal(r.got.columns[0], "lead_id");
  });
  test("база закрывается при ошибке эталона", () => {
    let db;
    const create = ctx.Engine.createShop;
    ctx.Engine.createShop = () => (db = create.call(ctx.Engine));
    try { assert.throws(() => S.check("SELECT 1", "SELECT missing", nul.sqlCases)); assert.equal(db.closed, true); }
    finally { ctx.Engine.createShop = create; }
  });
}
console.log("\nПроверок: " + passed + ", ошибок: " + failed);
if (failed) process.exit(1);
