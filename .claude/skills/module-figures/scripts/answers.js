#!/usr/bin/env node
/* Ответы урока, которые схема не должна показывать.

   Обходит window.CONTENT[<урок>] целиком и печатает:
   - expected шагов и практикума (stdout или строки таблицы);
   - answer: полей задачи и тренажёров — с подписью поля;
   - числа из hint: там стоят неверные значения, которые ученик получает
     при типичной ошибке, — они тоже не должны мелькнуть на схеме.

   Запуск: node .claude/skills/module-figures/scripts/answers.js m7l3 [m7l4 …]
           node .claude/skills/module-figures/scripts/answers.js m7      — весь модуль */
const fs = require("fs"), vm = require("vm"), path = require("path");
const base = path.resolve(__dirname, "../../../..");
const ctx = { window: { SH: {}, CONTENT: {}, DATA: {} }, console };
vm.createContext(ctx);
for (const f of ["data.js", "content-core.js"].concat(
       fs.readdirSync(base).filter(f => /^content-m\d+\.js$/.test(f)).sort())) {
  vm.runInContext(fs.readFileSync(path.join(base, f), "utf8"), ctx);
}
const ALL = ctx.window.CONTENT;
const args = process.argv.slice(2);
if (!args.length) { console.error("укажите урок (m7l3) или модуль (m7)"); process.exit(1); }
const ids = [];
for (const a of args) {
  if (ALL[a]) ids.push(a);
  else if (/^m\d+$/.test(a)) ids.push(...Object.keys(ALL).filter(k => k.startsWith(a + "l")).sort());
  else { console.error("нет урока " + a); process.exit(1); }
}

/* число из текста: «1 248,09» → 1248.09; годы и номера уроков отбрасываем ниже */
function nums(s) {
  return (String(s).match(/\d[\d  ]*(?:[.,]\d+)?/g) || [])
    .map(x => +x.replace(/[  ]/g, "").replace(",", "."))
    .filter(n => !isNaN(n));
}

for (const id of ids) {
  const out = [];
  (function walk(o, where) {
    if (!o || typeof o !== "object") return;
    if (Array.isArray(o)) { o.forEach((x, i) => walk(x, where + "[" + i + "]")); return; }
    /* answer: "nums" у тренажёра — вид ответа, а не число */
    if ("answer" in o && !(typeof o.answer === "string" && !/\d/.test(o.answer))) out.push(["answer", where + (o.label ? " «" + o.label + "»" : ""), o.answer]);
    if (o.expected) {
      const e = o.expected;
      if (e.stdout !== undefined) out.push(["expected", where, JSON.stringify(e.stdout)]);
      if (e.rows) out.push(["expected", where, JSON.stringify(e.rows).slice(0, 300)]);
    }
    if (typeof o.hint === "string") {
      const h = nums(o.hint).filter(n => !(n >= 1900 && n <= 2100 && Number.isInteger(n)));
      if (h.length) out.push(["hint", where, h.join(", ")]);
    }
    for (const [k, v] of Object.entries(o)) if (k !== "expected") walk(v, where + "." + k);
  })(ALL[id], id);
  console.log("== " + id + " — " + out.length);
  for (const [kind, where, v] of out) console.log(kind.padEnd(8) + " " + where + ": " + v);
}
