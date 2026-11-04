#!/usr/bin/env node
/* Возврат в урок: разделы, шаги и задачи; старые ссылки и прогресс. */
"use strict";
const fs = require("fs"), vm = require("vm"), path = require("path"), assert = require("assert/strict");
const src = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
const state = { seen: {} }, c = {
  Store: { get: (b, k, d) => state[b]?.[k] ?? d, set: (b, k, v) => { (state[b] ||= {})[k] = v; } },
  Course: { byId: id => ["m1l3", "m0l1"].includes(id) ? { id } : null }, document: {}
};
vm.createContext(c);
for (const name of ["Place", "Router"]) {
  const at = src.indexOf("const " + name + " = {");
  if (at >= 0) vm.runInContext(src.slice(at, src.indexOf("\n};", at) + 3) + "\nthis." + name + "Api = " + name + ";", c);
}
const P = c.PlaceApi, R = c.RouterApi; let pass = 0, fail = 0;
function test(name, f) { try { f(); pass++; console.log("✓ " + name); } catch (e) { fail++; console.error("✗ " + name + ": " + e.message); } }
test("новый ученик получает обычную ссылку на урок", () => assert.equal(P.href("m1l3"), "#m1l3"));
test("сохраняется раздел, на котором остановились", () => {
  P.remember("m1l3", "s-task"); assert.equal(P.href("m1l3"), "#m1l3/s-task");
  assert.equal(P.label("m1l3"), "Основная задача");
});
test("практикум возвращается к тому же шагу", () => {
  P.remember("m1l3", "s-practice", "step", 3, 6);
  assert.equal(P.href("m1l3"), "#m1l3/s-practice/step-4");
  assert.equal(P.label("m1l3"), "Практикум — шаг 4 из 6");
});
test("тренажёр возвращается к конкретной задаче", () => {
  P.remember("m1l3", "s-drills", "drill", 5, 6);
  assert.equal(P.href("m1l3"), "#m1l3/s-drills/drill-6");
  assert.equal(P.label("m1l3"), "Тренажёр — задача 6 из 6");
});
test("смена раздела убирает прежний номер задачи", () => {
  P.remember("m1l3", "s-notes"); assert.equal(P.href("m1l3"), "#m1l3/s-notes");
});
test("ошибочный импорт позиции не создаёт постороннюю ссылку", () => {
  state.seen.m1l3 = { section: 's-task\" onclick=\"x', kind: "drill", index: 2 };
  assert.equal(P.href("m1l3"), "#m1l3");
});
test("номер задачи вне границ не попадает в ссылку", () => {
  P.remember("m1l3", "s-drills", "drill", 100, 6);
  assert.equal(P.href("m1l3"), "#m1l3/s-drills");
});
test("повреждённый тип раздела в импорте не ломает главную", () => {
  state.seen.m1l3 = { section: { toString: {} } };
  assert.equal(P.href("m1l3"), "#m1l3");
});
test("номер шага разбирается из прямой ссылки", () => {
  const r = R.route("#m1l3/s-practice/step-4");
  assert.equal(r.id, "m1l3"); assert.equal(r.section, "s-practice"); assert.equal(r.kind, "step"); assert.equal(r.index, 3);
});
test("ссылка на словарь с термином остаётся страницей", () => assert.equal(R.route("#glossary/retention").id, "glossary/retention"));
test("прежний адрес урока работает", () => assert.equal(R.route("#m0l1").id, "m0l1"));
console.log("Возврат к месту: пройдено " + pass + ", ошибок " + fail); process.exitCode = fail ? 1 : 0;
