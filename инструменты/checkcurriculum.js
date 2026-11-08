#!/usr/bin/env node
/* Связность учебного маршрута: зависимости модулей, ссылки и номера
   уроков, входной тест и обязательная часть первого прохода A/B.
   node инструменты/checkcurriculum.js */
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.resolve(__dirname, "..");
const c = { window: { SH: {}, CONTENT: {}, DATA: {} } };
vm.createContext(c);
["data.js", "content-core.js", "lessons.js"]
  .concat(fs.readdirSync(root).filter(f => /^content-m\d+\.js$/.test(f)).sort())
  .forEach(f => vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), c, { filename: f }));
const { COURSE, CONTENT } = c.window;
const modules = new Map(COURSE.modules.map(m => [m.id, m])), lessons = new Map(), errors = [];
const bad = s => errors.push(s);
for (const m of modules.values()) m.lessons.forEach((l, i) => {
  if (lessons.has(l.id)) bad("Повтор id: " + l.id);
  lessons.set(l.id, { ...l, num: m.num + "." + (i + 1), module: m });
  if (l.ready && !CONTENT[l.id]) bad(l.id + ": готовый урок без содержания");
});
function dependencies(m, stack) {
  if (stack.includes(m.id)) { bad("Цикл зависимостей: " + stack.concat(m.id)); return; }
  for (const id of m.needs || []) {
    const dep = modules.get(id) || lessons.get(id)?.module;
    if (!dep) { bad(m.id + ": неизвестная зависимость " + id); continue; }
    if (!m.optional && dep.optional) bad(m.id + ": обязательный маршрут требует необязательный " + id);
    dependencies(dep, stack.concat(m.id));
  }
}
for (const m of modules.values()) dependencies(m, []);
let links = 0;
function scan(value, at) {
  if (typeof value === "string") {
    for (const match of value.matchAll(/href=["']#(m\d+l\d+)(?:\/[^"']*)?["'][^>]*>([\s\S]*?)<\/a>/g)) {
      links++;
      const l = lessons.get(match[1]);
      if (!l) { bad(at + ": ссылка на отсутствующий урок " + match[1]); continue; }
      const label = match[2].replace(/<[^>]*>/g, "");
      const nums = [...label.matchAll(/\b([0-7]\.\d{1,2})\b/g)].map(x => x[1]);
      if (nums.length === 1 && nums[0] !== l.num) bad(at + ": подпись " + nums[0] + " ведёт в " + l.num);
    }
  } else if (Array.isArray(value)) value.forEach((x, i) => scan(x, at + "[" + i + "]"));
  else if (value && typeof value === "object") Object.entries(value).forEach(([k, x]) => scan(x, at + "." + k));
}
Object.entries(CONTENT).forEach(([id, C]) => scan(C, id));
for (const b of COURSE.entry) for (const x of b.qs) {
  const [id, n] = x.ref ? x.ref.split(":") : [x.lesson, null];
  if (!lessons.has(id) || (n !== null && !CONTENT[id]?.quiz?.[+n])) bad("Входной тест: нет вопроса " + (x.ref || id));
}
// Первый проход сохраняет смысл A/B и проверки качества перед проектом.
for (const id of ["m3l2", "m3l1", "m3l3", "m3l4", "m3l6", "m3l7"]) {
  const l = lessons.get(id);
  if (!l || l.fast === false || l.module.fast === false) bad(id + ": базовый A/B-путь исключён из быстрого темпа");
}
for (const id of ["m3l9", "m3l5", "m3l8"]) {
  if (lessons.get(id)?.fast !== false) bad(id + ": углубление снова включено в первый проход A/B");
}
console.log("Уроков: " + lessons.size + ", модулей: " + modules.size + ", внутренних ссылок: " + links + ".");
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log("Зависимости, ссылки, входной тест и первый проход A/B согласованы.");
