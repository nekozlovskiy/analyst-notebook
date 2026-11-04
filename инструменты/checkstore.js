#!/usr/bin/env node
/* Регрессии сохранения: несколько вкладок, перенос, конфликт, сброс.
   Запуск: node инструменты/checkstore.js */
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm"), assert = require("assert/strict");
const src = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
const store = src.slice(src.indexOf("const Store ="), src.indexOf("/* ============================================================\n   Курс"));
const KEY = "da.state.v1";
let count = 0, failed = 0;
const tests = [];
function test(name, f) { tests.push({ name, f }); }
function browser(initial, legacy, withLocks) {
  const disk = new Map(initial ? [[KEY, JSON.stringify(initial)]] : []), tabs = [];
  if (legacy) disk.set("da.state.v0", JSON.stringify(legacy));
  let blocked = false;
  let tail = Promise.resolve();
  const locks = { request: (key, fn) => { const p = tail.then(fn); tail = p.catch(() => {}); return p; } };
  return {
    read: () => JSON.parse(disk.get(KEY) || "{}"),
    overwrite: value => disk.set(KEY, JSON.stringify(value)),
    block: () => { blocked = true; },
    tab: function () {
      const events = {}, timers = new Map(); let seq = 0;
      const c = { window: { addEventListener: (k, f) => { events[k] = f; } },
        setTimeout: f => { timers.set(++seq, f); return seq; }, clearTimeout: k => timers.delete(k),
        localStorage: {
          get length() { return disk.size; }, key: i => [...disk.keys()][i], getItem: k => disk.get(k) ?? null,
          setItem: (k, v) => { if (blocked) throw Error("quota"); disk.set(k, v); }, removeItem: k => disk.delete(k)
        }
      };
      if (withLocks) c.navigator = { locks };
      vm.createContext(c); vm.runInContext(store + "\nthis.store = Store;", c);
      const tab = { s: c.store, event: () => events.storage && events.storage({ key: KEY, newValue: disk.get(KEY) }) };
      tabs.push(tab); return tab;
    },
    deliver: function () { tabs.forEach(t => t.event()); }
  };
}
test("старая вкладка не стирает заметку при закрытии", () => {
  const b = browser(), a = b.tab(), stale = b.tab();
  a.s.set("notes", "m1l3", "новая заметка"); a.s.flush(); stale.s.flush();
  assert.equal(b.read().notes.m1l3, "новая заметка");
});
test("одновременные правки разных уроков сохраняются обе", () => {
  const b = browser(), a = b.tab(), c = b.tab();
  a.s.set("notes", "m1l3", "агрегации"); c.s.set("code", "m1l1", "SELECT 1;");
  a.s.flush(); c.s.flush();
  assert.equal(b.read().notes.m1l3, "агрегации"); assert.equal(b.read().code.m1l1, "SELECT 1;");
});
test("перенос прогресса сохраняет работу другой вкладки", () => {
  const b = browser(), a = b.tab(), c = b.tab();
  a.s.set("notes", "m1l3", "сохранить"); a.s.flush();
  c.s.merge({ done: { m1l1: 123 }, code: { m1l1: "SELECT 2;" } });
  assert.equal(b.read().notes.m1l3, "сохранить"); assert.equal(b.read().done.m1l1, 123);
});
test("при конфликте одного ответа доступны обе версии", () => {
  const b = browser({ code: { m1l1: "начало" } }), a = b.tab(), c = b.tab();
  a.s.set("code", "m1l1", "версия A"); a.s.flush(); b.deliver();
  c.s.set("code", "m1l1", "версия B"); c.s.flush();
  const conflicts = Object.values(b.read().conflicts || {});
  assert.equal(conflicts.length, 1);
  assert.deepEqual([conflicts[0].mine, conflicts[0].other].sort(), ["версия A", "версия B"]);
  const id = Object.keys(b.read().conflicts)[0];
  c.s.resolve(id, "other"); c.s.flush();
  assert.equal(b.read().code.m1l1, "версия A"); assert.equal(Object.keys(b.read().conflicts).length, 0);
});
test("счётчики не откатываются от отложенного сохранения", () => {
  const b = browser(), a = b.tab(), c = b.tab();
  a.s.set("time", "m1l1", 100); c.s.set("time", "m1l1", 20); a.s.flush(); c.s.flush();
  assert.equal(b.read().time.m1l1, 100);
});
test("сброс не воскрешает старые отметки при закрытии вкладки", () => {
  const b = browser({ done: { m1l1: 123 } }), a = b.tab(), c = b.tab();
  a.s.replace(null); c.s.flush(); assert.deepEqual(b.read().done, {});
});
test("событие сброса отменяет отложенные изменения другой вкладки", () => {
  const b = browser(), a = b.tab(), c = b.tab();
  c.s.set("notes", "m1l1", "старое"); a.s.replace(null); b.deliver(); c.s.flush();
  assert.deepEqual(b.read().notes, {});
});
test("экспорт из старой вкладки включает свежую работу другой", () => {
  const b = browser(), a = b.tab(), c = b.tab();
  a.s.set("code", "m1l1", "SELECT 3;"); a.s.flush();
  assert.equal(c.s.all().code.m1l1, "SELECT 3;");
});
test("импорт не заменяет непустой код, сохранённый другой вкладкой", () => {
  const b = browser(), a = b.tab(), c = b.tab();
  a.s.set("code", "m1l1", "новая работа"); a.s.flush();
  c.s.merge({ done: {}, code: { m1l1: "из старого файла" } });
  assert.equal(b.read().code.m1l1, "новая работа");
});
test("прежний ключ прогресса подхватывается при первом сохранении", () => {
  const b = browser(null, { done: { m1l1: 123 } }), c = b.tab();
  assert.equal(c.s.all().done.m1l1, 123);
  c.s.set("notes", "m1l3", "новая запись"); c.s.flush();
  assert.equal(b.read().done.m1l1, 123);
});
test("снятие отметки и очистка заметки остаются явными изменениями", () => {
  const b = browser({ done: { m1l1: 123 }, notes: { m1l1: "текст" } }), a = b.tab();
  a.s.set("done", "m1l1", false); a.s.set("notes", "m1l1", ""); a.s.flush();
  assert.equal(b.read().done.m1l1, false); assert.equal(b.read().notes.m1l1, "");
});
test("при переполнении хранилища работа остаётся в памяти", () => {
  const b = browser(), a = b.tab(); b.block();
  a.s.set("notes", "m1l1", "не потерять"); a.s.flush();
  assert.equal(a.s.mode(), "memory"); assert.equal(a.s.isDirty(), true);
  assert.equal(a.s.all().notes.m1l1, "не потерять");
});
test("закрытая до автосохранения вкладка оставляет восстанавливаемый текст", () => {
  const b = browser(), a = b.tab();
  a.s.set("notes", "m1l1", "последние набранные слова");
  const c = b.tab(); assert.equal(c.s.get("notes", "m1l1", ""), "последние набранные слова");
  c.s.flush(); assert.equal(b.read().notes.m1l1, "последние набранные слова");
});
test("журнал восстанавливает правку после конкурирующей записи без Web Locks", () => {
  const b = browser(), a = b.tab(), c = b.tab();
  a.s.set("notes", "m1l1", "A"); a.s.flush(); const old = b.read();
  c.s.set("notes", "m1l3", "B"); c.s.flush();
  c.s.set("code", "m1l3", "SELECT 4;"); c.s.flush();
  b.overwrite(old);
  const recovered = b.tab();
  assert.equal(recovered.s.get("notes", "m1l3", ""), "B");
  assert.equal(recovered.s.get("code", "m1l3", ""), "SELECT 4;");
});
test("экспорт не возвращает уже обработанную правку поверх более новой", () => {
  const b = browser(), a = b.tab(), c = b.tab();
  a.s.set("notes", "m1l1", "A"); c.s.flush();
  c.s.set("notes", "m1l1", "B"); c.s.flush();
  assert.equal(a.s.all().notes.m1l1, "B");
});
test("повторение ошибок кода переносится с сохранением местного расписания", () => {
  const local = { count: 2, round: 3, step: 1, due: "2026-11-07", done: false };
  const b = browser({ codeReview: { "sql-schema": local } }), a = b.tab();
  a.s.merge({ done: {}, codeReview: { "sql-schema": { count: 5 }, "py-name": { count: 1, round: 1, step: -1, due: "2026-11-04", done: false } } });
  assert.deepEqual(b.read().codeReview["sql-schema"], local);
  assert.equal(b.read().codeReview["py-name"].count, 1);
  assert.equal(a.s.all().codeReview["sql-schema"].due, "2026-11-07");
});
test("Web Locks: отложенное storage не подтверждает несохранённую правку", async () => {
  const b = browser(null, null, true), a = b.tab(), other = b.tab();
  other.s.set("notes", "m1l1", "B"); await other.s.flush();
  a.s.set("notes", "m1l3", "A");
  a.event();
  a.s.set("code", "m1l3", "SELECT 42"); await a.s.flush();
  assert.equal(b.read().notes.m1l3, "A");
  assert.equal(a.s.all().notes.m1l3, "A");
  assert.equal(b.tab().s.get("notes", "m1l3", ""), "A");
});
test("Web Locks: правки двух вкладок и экспорт переживают доставку событий", async () => {
  const b = browser(null, null, true), a = b.tab(), c = b.tab();
  a.s.set("notes", "m1l1", "A"); c.s.set("code", "m1l3", "SELECT 7");
  await Promise.all([a.s.flush(), c.s.flush()]); b.deliver();
  assert.equal(a.s.all().code.m1l3, "SELECT 7"); assert.equal(c.s.all().notes.m1l1, "A");
});
test("Web Locks: сброс отменяет ожидавший старый журнал", async () => {
  const b = browser(null, null, true), a = b.tab(), c = b.tab();
  c.s.set("notes", "m1l1", "старый текст"); await a.s.replace(null);
  c.event(); await c.s.flush(); assert.deepEqual(b.read().notes, {});
});
(async function () {
  for (const { name, f } of tests) {
    try { await f(); count++; console.log("✓ " + name); }
    catch (e) { failed++; console.error("✗ " + name + ": " + e.message); }
  }
  console.log("Хранилище: пройдено " + count + ", ошибок " + failed);
  process.exitCode = failed ? 1 : 0;
})();
