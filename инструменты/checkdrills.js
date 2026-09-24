#!/usr/bin/env node
/* Проверка тренажёра: у каждой задачи с автопроверкой код эталона
   должен выполняться. Логика та же, что у Drills в app.js:
   - answer: "text", задачи текстовых уроков и python-задачи без print
     в разборе — ответ словами, их не проверяем;
   - код эталона — поле check или solution до строки «Результат…».
   SQL выполняется на инструменты/shop.db (sqlite3), Python проверяется
   только на синтаксис (python3 ast): pandas в браузере другой версии,
   окончательная проверка — «Проверить» в самом уроке.
   Запуск: node инструменты/checkdrills.js            */
const fs = require("fs"), vm = require("vm"), path = require("path");
const { execFileSync } = require("child_process");
const base = path.resolve(__dirname, "..");
const ctx = { window: { SH: {}, CONTENT: {}, DATA: {} }, console };
vm.createContext(ctx);
for (const f of ["data.js", "content-core.js"].concat(
       fs.readdirSync(base).filter(f => /^content-m\d+\.js$/.test(f)).sort(), ["lessons.js"])) {
  vm.runInContext(fs.readFileSync(path.join(base, f), "utf8"), ctx);
}
const db = path.join(__dirname, "shop.db");
let sql = 0, py = 0, text = 0;
const bad = [];
for (const m of ctx.window.COURSE.modules) for (const L of m.lessons) {
  const C = ctx.window.CONTENT[L.id];
  (C && C.drills || []).forEach(function (d, i) {
    const kind = d.answer === "text" || L.kind === "text" ? "text"
      : L.kind === "sql" ? "sql" : /print\(/.test(d.solution) ? "python" : "text";
    const code = d.check || d.solution.split(/\n\s*(?:Результат|Что получается)/)[0];
    const where = L.id + " задача " + (i + 1) + " «" + d.title + "»";
    if (kind === "text") { text++; return; }
    try {
      if (kind === "sql") {
        sql++;
        const out = execFileSync("sqlite3", [db], { input: code, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
        if (!out.trim()) bad.push(where + ": запрос ничего не вернул");
      } else {
        py++;
        execFileSync("python3", ["-c", "import ast,sys; ast.parse(sys.stdin.read())"],
                     { input: code, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
      }
    } catch (e) {
      bad.push(where + ": " + String(e.stderr || e.message).trim().split("\n").pop());
    }
  });
}
console.log("SQL: " + sql + ", Python: " + py + ", ответ словами: " + text);
if (bad.length) { console.log("\nОшибки:\n" + bad.join("\n")); process.exit(1); }
console.log("Ошибок нет.");
