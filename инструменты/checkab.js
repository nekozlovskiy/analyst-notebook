#!/usr/bin/env node
/* Первый проход A/B: заготовка + несколько вызовов готовых функций
   дают тот же отчёт, что полный разбор. Проверяем настоящий пролог,
   pandas 3 и pandas 2.2, если окружение установлено.
   node инструменты/checkab.js */
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
const { spawnSync } = require("child_process");
const root = path.resolve(__dirname, "..");
const c = { window: { SH: {}, CONTENT: {}, DATA: {} } };
vm.createContext(c);
["data.js", "content-core.js", "content-m3.js"].forEach(function (f) {
  vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), c, { filename: f });
});
const calls = {
  m3l1: ["ci(c_a, n_a)", "ci(c_b, n_b)", "conversion_z(c_a, n_a, c_b, n_b)"],
  m3l3: ["welch(a, b)", "mann_whitney(a, b)"],
  m3l4: ["group_size(BASE, p1)"],
  m3l7: ["conversion_test(c, t)", "welch(arpu_c, arpu_t)", "welch(chk_c, chk_t)",
    'conversion_test(c[c["platform"] == platform], t[t["platform"] == platform])']
};
const interpreters = [process.env.PYTHON || "python3"];
const py22 = path.join(process.env.HOME || "", ".cache/analyst-notebook/v312/bin/python3");
if (fs.existsSync(py22) && py22 !== interpreters[0]) interpreters.push(py22);
const norm = s => String(s).split(/\r?\n/).map(s => s.trim().replace(/\s+/g, " ")).filter(Boolean);
let checked = 0;
for (const [id, fill] of Object.entries(calls)) {
  const C = c.window.CONTENT[id];
  let at = 0;
  // Меняем только заполнитель присваивания, не троеточия в комментариях.
  const code = C.starter.replace(/= \.\.\./g, () => "= " + fill[at++]);
  if (at !== fill.length) throw new Error(id + ": число заполнителей изменилось: " + at);
  const head = (C.data || []).map(k => k + " = " + JSON.stringify(c.window.DATA[k])).join("\n") +
    "\n" + C.prelude + "\n";
  for (const python of interpreters) {
    // Проверяем и шаблон, и независимый полный разбор после того же пролога.
    for (const [kind, src] of [["шаблон", code], ["разбор", C.solution]]) {
      const r = spawnSync(python, ["-"], { input: head + src, encoding: "utf8", timeout: 60000 });
      if (r.error || r.status !== 0) throw new Error(id + " " + kind + ": " + (r.error || r.stderr));
      const a = norm(r.stdout), b = norm(C.expected.stdout);
      if (JSON.stringify(a) !== JSON.stringify(b)) {
        const i = Math.max(0, a.findIndex((line, j) => line !== b[j]));
        throw new Error(id + " " + kind + ": строка " + (i + 1) + ": " + a[i] + "; ожидается " + b[i]);
      }
      checked++;
    }
  }
  console.log(id + ": готовые функции и полный разбор дают эталонный отчёт");
}
console.log("Прогонов: " + checked + ", интерпретаторов: " + interpreters.length + ". Ошибок нет.");
