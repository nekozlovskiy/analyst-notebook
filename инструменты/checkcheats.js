#!/usr/bin/env node
/* Проверка шпаргалок (cheats.js): каждый пример кода выполняется.
   - <pre><code class="sql"> — на инструменты/shop.db (sqlite3), запрос
     должен вернуть хотя бы одну строку;
   - <pre><code class="py">  — после пролога Python-уроков (SH.pyPrelude
     с таблицами users, orders, events). Блоки одной шпаргалки идут
     подряд в одном процессе: следующий может пользоваться переменными
     прошлого, как ученик, который читает сверху вниз.
   Python — системный python3 и, если есть, окружение с pandas 2.2 из
   ~/.cache/analyst-notebook (его ставит хук в начале сессии): в браузере
   pandas 2.2, локально и на GitHub — 3.x.
   Заодно — разметка: поля шпаргалки, уникальные id, модуль из lessons.js.
   Запуск: node инструменты/checkcheats.js            */
const fs = require("fs"), vm = require("vm"), path = require("path"), os = require("os");
const { execFileSync } = require("child_process");
const base = path.resolve(__dirname, "..");
const ctx = { window: { SH: {}, CONTENT: {}, DATA: {} }, console };
vm.createContext(ctx);
for (const f of ["data.js", "content-core.js", "lessons.js", "cheats.js"]) {
  vm.runInContext(fs.readFileSync(path.join(base, f), "utf8"), ctx);
}
const W = ctx.window;
const db = path.join(__dirname, "shop.db");
const unesc = s => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

const pythons = ["python3"];
const py22 = path.join(os.homedir(), ".cache/analyst-notebook/v312/bin/python");
if (fs.existsSync(py22)) pythons.push(py22);
else console.log("pandas 2.2 не найден (" + py22 + ") — Python-примеры проверены только на python3");

const prelude = W.SH.pyData.map(k => k + " = " + JSON.stringify(W.DATA[k])).join("\n") +
  "\n" + W.SH.pyPrelude + "\n";
const modules = W.COURSE.modules.map(m => m.id);

const bad = [], ids = new Set();
let sql = 0, py = 0;
for (const c of W.CHEATS) {
  const where = "шпаргалка " + (c.id || "?");
  for (const k of ["id", "title", "sub", "module", "sections"]) if (!c[k]) bad.push(where + ": нет поля " + k);
  if (ids.has(c.id)) bad.push(where + ": id повторяется");
  ids.add(c.id);
  if (!/^[a-z]+$/.test(c.id || "")) bad.push(where + ": id — только латинские строчные");
  if (c.module && modules.indexOf(c.module) < 0) bad.push(where + ": нет модуля " + c.module);

  const pyBlocks = [];
  (c.sections || []).forEach(function (s, si) {
    if (!s.h || !s.html) bad.push(where + ", раздел " + (si + 1) + ": нужны h и html");
    const re = /<pre><code class="(sql|py)">([\s\S]*?)<\/code><\/pre>/g;
    let m;
    while ((m = re.exec(s.html || ""))) {
      const code = unesc(m[2]), label = where + ", «" + s.h + "»";
      if (m[1] === "py") { pyBlocks.push({ label: label, code: code }); continue; }
      sql++;
      try {
        const out = execFileSync("sqlite3", [db], { input: code, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
        if (!out.trim()) bad.push(label + ": запрос ничего не вернул");
      } catch (e) {
        bad.push(label + ": " + String(e.stderr || e.message).trim().split("\n").pop());
      }
    }
  });

  if (!pyBlocks.length) continue;
  py += pyBlocks.length;
  const prog = prelude + "import sys, traceback\n_blocks = " + JSON.stringify(pyBlocks) + "\n" +
    "for _b in _blocks:\n" +
    "    try:\n" +
    "        exec(compile(_b['code'], _b['label'], 'exec'), globals())\n" +
    "    except Exception as e:\n" +
    "        print(_b['label'] + ': ' + type(e).__name__ + ': ' + str(e))\n" +
    "        sys.exit(1)\n";
  for (const bin of pythons) {
    try {
      execFileSync(bin, ["-"], { input: prog, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
    } catch (e) {
      const ver = bin === "python3" ? "python3" : "pandas 2.2";
      bad.push("[" + ver + "] " + (String(e.stdout || "").trim() || String(e.stderr || e.message).trim()).split("\n").pop());
    }
  }
}
console.log("Шпаргалок: " + W.CHEATS.length + ", SQL-примеров: " + sql + ", Python-примеров: " + py);
if (bad.length) { console.log("\nОшибки:\n" + bad.join("\n")); process.exit(1); }
