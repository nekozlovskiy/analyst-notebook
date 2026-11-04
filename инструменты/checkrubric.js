#!/usr/bin/env node
/* Самопроверка вывода: фрагменты должны принадлежать текущему ответу. */
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm"), assert = require("assert/strict");
const base = path.resolve(__dirname, ".."), src = fs.readFileSync(path.join(base, "app.js"), "utf8");
const ctx = { window: { CONTENT: {}, SH: {} } };
vm.createContext(ctx);
vm.runInContext(src.slice(src.indexOf("function esc("), src.indexOf("/* Перемешанные индексы")), ctx);
for (const f of ["content-core.js", "content-m4.js"]) vm.runInContext(fs.readFileSync(path.join(base, f), "utf8"), ctx);
const start = src.indexOf("const Rubric = {");
if (start >= 0) vm.runInContext(src.slice(start, src.indexOf("\n};", start) + 3) + "\nthis.Rubric = Rubric;", ctx);
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log("✓ " + name); } catch (e) { failed++; console.error("✗ " + name + ": " + e.message); } }
const plain = value => JSON.parse(JSON.stringify(value));
const items = ctx.window.CONTENT.m4l7.rubric;
test("у записки есть пять пунктов с устойчивыми id", () => {
  assert.ok(Array.isArray(items));
  assert.deepEqual(plain(items.map(i => i.id)), ["metric", "period", "denominator", "limits", "action"]);
  for (const i of items) assert.ok(i.title && i.hint);
});
test("доступна привязка фрагментов к ответу", () => assert.equal(typeof ctx.Rubric?.capture, "function"));
if (items && ctx.Rubric) {
  const R = ctx.Rubric;
  test("выделенный фрагмент сохраняется с точными границами", () => assert.deepEqual(plain(R.capture("abc выручка def", 4, 11)), { quote: "выручка", start: 4, end: 11 }));
  test("пустое выделение и одни пробелы не становятся пометкой", () => {
    assert.equal(R.capture("ответ", 0, 0), null);
    assert.equal(R.capture("  \n ", 0, 4), null);
  });
  test("внешние пробелы убираются с поправкой границ", () => assert.deepEqual(plain(R.capture("  маржа  ", 0, 9)), { quote: "маржа", start: 2, end: 7 }));
  test("некорректные границы не читают другой фрагмент", () => {
    for (const [a, b] of [[-1, 3], [0, 20], [4, 1], [0.5, 2], [NaN, 2]]) assert.equal(R.capture("ответ", a, b), null);
  });
  test("действующая пометка находится по сохранённым границам", () => {
    const r = R.capture("abc маржа def", 4, 9);
    assert.deepEqual(plain(R.locate("abc маржа def", r)), { quote: "маржа", start: 4, end: 9 });
  });
  test("добавление текста до уникальной фразы не теряет её", () => {
    const r = R.capture("маржа выше", 0, 5);
    assert.deepEqual(plain(R.locate("Итог: маржа выше", r)), { quote: "маржа", start: 6, end: 11 });
  });
  test("правка внутри фразы требует выбрать её заново", () => assert.equal(R.locate("маржа ниже", R.capture("маржа выше", 0, 10)), null));
  test("после удаления ответа старые фрагменты не подтверждены", () => assert.equal(R.locate("", R.capture("маржа выше", 0, 10)), null));
  test("неоднозначный перенос не выбирает случайное совпадение", () => assert.equal(R.locate("X маржа и маржа", { quote: "маржа", start: 0, end: 5 }), null));
  test("повторяющаяся фраза допустима при точном сохранённом месте", () => assert.deepEqual(plain(R.locate("маржа и маржа", { quote: "маржа", start: 8, end: 13 })), { quote: "маржа", start: 8, end: 13 }));
  test("повреждённая запись не ломает страницу", () => {
    for (const r of [null, {}, { quote: 7 }, { quote: "" }, { quote: "  " }]) assert.equal(R.locate("ответ", r), null);
  });
  test("итог отдельно считает действующие и устаревшие фрагменты", () => {
    const records = { metric: R.capture("маржа выше", 0, 5), period: { quote: "квартал", start: 0, end: 7 }, alien: { quote: "маржа" } };
    assert.deepEqual(plain(R.summary("маржа выше", items, records)), { linked: 1, stale: 1, total: 5 });
  });
  test("пять привязок не оценивают правильность содержания", () => {
    const records = {};
    for (const i of items) records[i.id] = R.capture("неверный вывод", 0, 14);
    assert.deepEqual(plain(R.summary("неверный вывод", items, records)), { linked: 5, stale: 0, total: 5 });
  });
  test("Unicode до фразы не смещает выделение textarea", () => {
    const text = "📊 маржа";
    assert.deepEqual(plain(R.capture(text, 3, 8)), { quote: "маржа", start: 3, end: 8 });
  });
  test("привязки проходят JSON-перенос прогресса", () => {
    const record = plain(R.capture("маржа выше", 0, 5));
    assert.ok(R.locate("маржа выше", record));
    assert.equal(R.locate("другой ответ", record), null);
  });
  test("очищенная пометка не считается устаревшей", () => assert.deepEqual(plain(R.summary("ответ", items, { metric: {} })), { linked: 0, stale: 0, total: 5 }));
}
console.log("\nПроверок: " + passed + ", ошибок: " + failed);
if (failed) process.exit(1);
