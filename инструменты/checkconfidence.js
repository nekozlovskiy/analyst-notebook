#!/usr/bin/env node
/* Уверенность не меняет правильность ответа или сроки повторения. */
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm"), assert = require("assert/strict");
const src = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
let state;
const ctx = { Store: {
  get: (b, k, fallback) => state[b]?.[k] ?? fallback,
  set: (b, k, v) => { (state[b] ||= {})[k] = JSON.parse(JSON.stringify(v)); }, all: () => state
}, isoDay: () => "2026-11-04", addDays: (d, n) => new Date(Date.parse(d + "T12:00:00Z") + n * 864e5).toISOString().slice(0, 10),
Course: { byId: id => /^m\d+l\d+$/.test(id) ? { id, module: { id: "m1" } } : null } };
vm.createContext(ctx);
for (const name of ["Confidence", "Review"]) {
  const start = src.indexOf("const " + name + " = {");
  if (start >= 0) vm.runInContext(src.slice(start, src.indexOf("\n};", start) + 3) + "\nthis." + name + " = " + name + ";", ctx);
}
let passed = 0, failed = 0;
const plain = x => JSON.parse(JSON.stringify(x));
function test(name, fn) { state = { review: {} }; try { fn(); passed++; console.log("✓ " + name); } catch (e) { failed++; console.error("✗ " + name + ": " + e.message); } }
test("доступен выбор уверенности", () => assert.equal(typeof ctx.Confidence?.normalize, "function"));
if (ctx.Confidence) {
  const R = ctx.Review, C = ctx.Confidence;
  test("ошибка с уверенностью запоминается на завтра", () => {
    R.record("m1l3", 0, false, true, "high");
    assert.deepEqual(state.review["m1l3:0"], { step: 0, due: "2026-11-05", miss: 1, confidence: "high", highMiss: 1 });
  });
  test("сомнение не создаёт ошибку с высокой уверенностью", () => {
    R.record("m1l3", 0, false, true, "low");
    assert.equal(state.review["m1l3:0"].miss, 1); assert.equal(C.misses(state.review["m1l3:0"]), 0);
  });
  test("без выбора можно отвечать, ошибка остаётся обычной", () => {
    R.record("m1l3", 0, false, true);
    assert.equal(state.review["m1l3:0"].confidence, null);
    assert.equal(state.review["m1l3:0"].miss, 1); assert.equal(state.review["m1l3:0"].due, "2026-11-05");
  });
  test("верный уверенный ответ не становится ошибкой", () => {
    R.record("m1l3", 0, true, true, "high");
    assert.equal(state.review["m1l3:0"].miss, 0); assert.equal(C.misses(state.review["m1l3:0"]), 0);
  });
  test("следующий верный ответ сохраняет историю и двигает ступень", () => {
    R.record("m1l3", 0, false, true, "high"); R.record("m1l3", 0, true, false, "low");
    assert.deepEqual(state.review["m1l3:0"], { step: 1, due: "2026-11-07", miss: 1, confidence: "low", highMiss: 1 });
  });
  test("завершение лестницы не теряет историю уверенных ошибок", () => {
    R.record("m1l3", 0, false, true, "high");
    for (let i = 0; i < 4; i++) R.record("m1l3", 0, true, false);
    assert.equal(state.review["m1l3:0"].done, true); assert.equal(C.misses(state.review["m1l3:0"]), 1);
  });
  test("старые ошибки не получают выдуманную уверенность", () => {
    state.review["m1l3:0"] = { step: 1, due: "2026-11-07", miss: 3 };
    R.record("m1l3", 0, false, false, "high");
    assert.equal(state.review["m1l3:0"].miss, 4); assert.equal(C.misses(state.review["m1l3:0"]), 1);
  });
  test("повторный проход урока сохраняет срок и ступень", () => {
    state.review["m1l3:0"] = { step: 2, due: "2026-11-20", miss: 1 };
    assert.equal(R.record("m1l3", 0, false, true, "high"), false);
    assert.equal(state.review["m1l3:0"].step, 2); assert.equal(state.review["m1l3:0"].due, "2026-11-20");
    assert.equal(state.review["m1l3:0"].miss, 2); assert.equal(C.misses(state.review["m1l3:0"]), 1);
  });
  test("верный ответ в уроке не сбрасывает историю и не двигает сроки", () => {
    state.review["m1l3:0"] = { step: 2, due: "2026-11-20", miss: 2, highMiss: 1 };
    R.record("m1l3", 0, true, true, "low");
    assert.deepEqual(state.review["m1l3:0"], { step: 2, due: "2026-11-20", miss: 2, highMiss: 1, confidence: "low" });
  });
  test("урок не открывает заново завершённую лестницу", () => {
    state.review["m1l3:0"] = { step: 3, done: true, miss: 1 };
    R.record("m1l3", 0, false, true, "high");
    assert.equal(state.review["m1l3:0"].done, true); assert.equal(state.review["m1l3:0"].due, undefined);
  });
  test("карточки не получают признаки уверенности вопроса", () => {
    R.record("m1l3", "c0", false, true, "high");
    assert.deepEqual(state.review["m1l3:c0"], { step: 0, due: "2026-11-05", miss: 1 });
    assert.equal(R.record("m1l3", "c0", false, true), false);
    assert.equal(state.review["m1l3:c0"].miss, 1);
  });
  test("неизвестные значения не интерпретируются как уверенность", () => {
    for (const v of [undefined, "", "yes", true, 1, {}, []]) assert.equal(C.normalize(v), null);
  });
  test("повреждённые счётчики не создают лишние уверенные ошибки", () => {
    assert.equal(C.misses({ miss: 2, highMiss: 8 }), 2);
    for (const v of ["2", -1, Infinity, NaN]) assert.equal(C.misses({ miss: 3, highMiss: v }), 0);
    assert.equal(C.misses({ miss: 0, highMiss: 2 }), 0);
  });
  test("фильтр исключает карточки и старые ошибки без пометки", () => {
    const all = [{ kind: "quiz", r: { miss: 1, highMiss: 1 } }, { kind: "card", r: { miss: 1, highMiss: 1 } }, { kind: "quiz", r: { miss: 5 } }];
    assert.equal(C.filter(all).length, 1); assert.equal(C.filter(all)[0], all[0]);
  });
  test("отдельный запуск берёт только уверенные ошибки, назначенные на сегодня", () => {
    state.review = {
      "m1l3:0": { step: 0, due: "2026-11-04", miss: 1, highMiss: 1 },
      "m1l3:1": { step: 0, due: "2026-11-05", miss: 1, highMiss: 1 },
      "m1l3:2": { step: 3, done: true, miss: 1, highMiss: 1 },
      "m1l3:3": { step: 0, due: "2026-11-04", miss: 1 },
      "m1l3:c0": { step: 0, due: "2026-11-04", miss: 1 }
    };
    assert.deepEqual(plain(R.queue(true).map(x => x.key)), ["m1l3:0"]);
    assert.equal(R.queue(false).length, 3);
  });
  test("история уверенности переживает JSON-перенос", () => {
    R.record("m1l3", 0, false, true, "high");
    const r = JSON.parse(JSON.stringify(state.review["m1l3:0"]));
    assert.equal(C.misses(r), 1); assert.equal(r.due, "2026-11-05");
  });
}
console.log("\nПроверок: " + passed + ", ошибок: " + failed);
if (failed) process.exit(1);
