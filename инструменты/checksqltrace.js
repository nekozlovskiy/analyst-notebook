#!/usr/bin/env node
/* Промежуточные таблицы SQL: каждый снимок сверяется с настоящей базой. */
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm"), assert = require("assert/strict");
const { DatabaseSync } = require("node:sqlite");
const base = path.resolve(__dirname, ".."), src = fs.readFileSync(path.join(base, "app.js"), "utf8");
const ctx = { window: { CONTENT: {}, SH: {} } };
vm.createContext(ctx);
vm.runInContext(src.slice(src.indexOf("function esc("), src.indexOf("/* Перемешанные индексы")), ctx);
for (const f of ["content-core.js", "content-m1.js"]) vm.runInContext(fs.readFileSync(path.join(base, f), "utf8"), ctx);
const start = src.indexOf("const SqlTrace = {");
if (start >= 0) vm.runInContext(src.slice(start, src.indexOf("\n};", start) + 3) + "\nthis.SqlTrace = SqlTrace;", ctx);
const trace = ctx.window.CONTENT.m1l1.sqlTrace;
const plain = value => JSON.parse(JSON.stringify(value));
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log("✓ " + name); } catch (e) { failed++; console.error("✗ " + name + ": " + e.message); } }
test("есть три этапа разбора JOIN", () => assert.equal(trace?.stages?.length, 3));
test("доступен показ строк выбранного пользователя", () => assert.equal(typeof ctx.SqlTrace?.table, "function"));
if (trace && ctx.SqlTrace) {
  const S = ctx.SqlTrace, db = new DatabaseSync(path.join(__dirname, "shop.db"), { readOnly: true });
  try {
    for (const [i, stage] of trace.stages.entries()) for (const table of stage.tables) {
      test("этап " + (i + 1) + ", " + table.title + ": снимок совпадает с запросом", () => {
        const st = db.prepare(table.sql); st.setReturnArrays(true);
        assert.deepEqual(st.columns().map(c => c.name), plain(table.columns));
        assert.deepEqual(st.all(), plain(table.rows));
      });
    }
    test("исходные таблицы показывают выбранные строки, а не всю базу", () => {
      assert.deepEqual(trace.stages[0].tables.map(t => t.rows.length).join(","), "3,3");
      assert.match(trace.stages[0].tables[0].sql, /WHERE/i);
    });
    test("JOIN даёт четыре строки для трёх людей", () => assert.equal(trace.stages[1].tables[0].rows.length, 4));
    test("пользователь 16 связан с двумя строками JOIN", () => assert.deepEqual(plain(S.counts(trace.stages[1], 16)), [2]));
    test("пользователь без заказов остаётся строкой с NULL", () => {
      const rows = plain(trace.stages[1].tables[0].rows);
      assert.deepEqual(rows.find(r => r[0] === 19), [19, null, null]);
      assert.deepEqual(plain(S.counts(trace.stages[1], 19)), [1]);
    });
    test("после группировки у каждого человека снова одна строка", () => {
      for (const key of [16, 19, 21]) assert.deepEqual(plain(S.counts(trace.stages[2], key)), [1]);
    });
    test("COUNT(*) не подменяет людей и заказы", () => {
      assert.deepEqual(plain(trace.stages[2].tables[0].rows), [[16, 2, 1, 2], [19, 1, 1, 0], [21, 1, 1, 1]]);
    });
    test("выделены обе строки выбранного ключа", () => {
      const html = S.table(trace.stages[1].tables[0], 16);
      assert.equal((html.match(/class="trace-selected"/g) || []).length, 2);
      assert.equal((html.match(/<strong>16<\/strong>/g) || []).length, 2);
    });
    test("пропуск показан как NULL, а не пустая строка", () => {
      const html = S.table(trace.stages[1].tables[0], 19);
      assert.equal((html.match(/>NULL</g) || []).length, 2);
    });
    test("подписи и значения таблицы экранируются", () => {
      const html = S.table({ title: '<img src=x>', key: 'id', columns: ['id', '<script>'], rows: [[16, '<svg onload=x>']] }, 16);
      assert.ok(!/<img|<svg|<script/.test(html)); assert.match(html, /&lt;svg/);
    });
    test("подсветка не меняет исходные снимки", () => {
      const before = JSON.stringify(trace);
      for (const stage of trace.stages) for (const t of stage.tables) S.table(t, 19);
      assert.equal(JSON.stringify(trace), before);
    });
  } finally { db.close(); }
}
console.log("\nПроверок: " + passed + ", ошибок: " + failed);
if (failed) process.exit(1);
