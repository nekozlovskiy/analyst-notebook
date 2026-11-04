#!/usr/bin/env node
/* План на главной и длительность урока используют одну оценку mins.
   Сумма частей занятия не должна с ней расходиться. */
"use strict";
const fs = require("fs"), vm = require("vm"), path = require("path"), assert = require("assert/strict");
const base = path.join(__dirname, ".."), read = f => fs.readFileSync(path.join(base, f), "utf8");
const c = { window: { CONTENT: {}, DATA: {}, SH: {} } }; vm.createContext(c);
for (const f of ["lessons.js", "data.js", "content-core.js", ...fs.readdirSync(base).filter(f => /^content-m\d+\.js$/.test(f)).sort()])
  vm.runInContext(read(f), c);
const src = read("app.js"), start = src.indexOf("const Plan = {"), end = src.indexOf("\n};", start) + 3;
vm.runInContext(src.slice(start, end) + "\nthis.plan = Plan;", c);
const lessons = c.window.COURSE.modules.flatMap(m => m.lessons).filter(l => l.ready);
let errors = 0;
for (const l of lessons) {
  try {
    const C = c.window.CONTENT[l.id], total = C.plan.reduce((n, p) => n + Number(p.m.match(/^\d+/)[0]), 0);
    assert.equal(c.plan.base(l), total, l.id + ": оценка не равна сумме частей занятия");
  } catch (e) { errors++; console.error(e.message); }
}
console.log("Оценки времени: уроков " + lessons.length + ", ошибок " + errors);
process.exitCode = errors ? 1 : 0;
