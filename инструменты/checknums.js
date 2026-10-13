#!/usr/bin/env node
/* Проверка числовых ответов (уроки kind: "sheet", задачи тренажёра
   answer: "nums"):
   1. разбор ввода — Nums.parse / judge / load из app.js на сценариях;
   2. эталоны — у каждого поля запрос check на инструменты/shop.db даёт
      answer в пределах tol (см. ниже, вторая часть); урок с db: "vilka"
      сверяется с инструменты/vilka.db.
   Запуск: node инструменты/checknums.js            */
const fs = require("fs"), vm = require("vm"), path = require("path");
const base = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(base, "app.js"), "utf8");
const m = app.match(/\nconst Nums = \{[\s\S]*?\n\};\n/);
if (!m) { console.log("В app.js не найден объект Nums"); process.exit(1); }
const ctx = {}; vm.createContext(ctx);
vm.runInContext(m[0].replace("const Nums", "var Nums"), ctx);
const N = ctx.Nums, bad = [];
const eq = (what, got, want) => { if (got !== want) bad.push(what + ": получилось " + JSON.stringify(got) + ", нужно " + JSON.stringify(want)); };

eq("parse 1842", N.parse("1842"), 1842);
eq("parse пробел", N.parse("1 842"), 1842);
eq("parse неразрывный", N.parse("1 842,00 ₽"), 1842);
eq("parse узкий", N.parse("271 926,54"), 271926.54);
eq("parse точка", N.parse("1842.5"), 1842.5);
eq("parse процент", N.parse("47,3%"), 47.3);
eq("parse минус", N.parse("−12,5"), -12.5);
eq("parse две запятые", N.parse("1,842,000"), null);
eq("parse буквы", N.parse("abc"), null);
eq("parse пусто", N.parse(""), null);
const f = { answer: 47.27, tol: 0.06 };
eq("judge ok", N.judge(f, "47,3"), "ok");
eq("judge bad", N.judge(f, "0,473"), "bad");
eq("judge nan", N.judge(f, "сорок"), "nan");
eq("judge empty", N.judge(f, "  "), "empty");
eq("judge tol по умолчанию", N.judge({ answer: 3457.3 }, "3457"), "ok");
eq("judge вне допуска", N.judge({ answer: 3457.3 }, "3456"), "bad");
eq("load битый", JSON.stringify(N.load("не json", 2)), '["",""]');
eq("load старый текст-массив другой длины", JSON.stringify(N.load('["1"]', 3)), '["1","",""]');
eq("load null", JSON.stringify(N.load(null, 1)), '[""]');
eq("parse р.", N.parse("141 330,95 р."), 141330.95);
eq("parse руб.", N.parse("3457,3 руб."), 3457.3);
eq("judge доля вместо процентов", N.judge({ answer: 47.27, tol: 0.06, unit: "%" }, "0,4727"), "frac");
eq("judge доля без % не frac", N.judge({ answer: 47.27, tol: 0.06 }, "0,4727"), "bad");
eq("judge процент верно", N.judge({ answer: 6.05, tol: 0.06, unit: "%" }, "6,05%"), "ok");
eq("pack пустые", N.pack(["", " ", ""]), "");
eq("pack с числом", N.pack(["", "53"]), '["","53"]');

let parsed = 26;  // число сценариев выше — для строки итога

/* 2. Эталоны полей: урок kind "sheet" — C.fields и C.file; задачи
   answer: "nums" — d.fields. У поля обязательны label, answer, hint,
   check; check возвращает одно число, оно совпадает с answer ± tol.
   В уроке "sheet" задачи тренажёра — только nums или text. */
const { execFileSync } = require("child_process");
const C0 = { window: { SH: {}, CONTENT: {}, DATA: {} }, console };
vm.createContext(C0);
for (const f of ["data.js", "content-core.js"].concat(
       fs.readdirSync(base).filter(f => /^content-m\d+\.js$/.test(f)).sort(), ["lessons.js"]))
  vm.runInContext(fs.readFileSync(path.join(base, f), "utf8"), C0);
const db = path.join(__dirname, "shop.db");
let fields = 0;
function checkFields(where, list, dbPath) {
  if (!Array.isArray(list) || !list.length) { bad.push(where + ": нет fields"); return; }
  list.forEach(function (f, i) {
    const w = where + ", поле " + (i + 1);
    for (const k of ["label", "hint", "check"]) if (!f[k]) bad.push(w + ": нет " + k);
    if (typeof f.answer !== "number") { bad.push(w + ": answer не число"); return; }
    fields++;
    try {
      const out = execFileSync("sqlite3", [dbPath || db], { input: f.check, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
      const v = Number(out);
      if (out === "" || isNaN(v)) bad.push(w + ": check вернул «" + out + "», а не одно число");
      else if (Math.abs(v - f.answer) > (f.tol === undefined ? 0.5 : f.tol)) bad.push(w + ": в базе " + v + ", в уроке " + f.answer);
    } catch (e) { bad.push(w + ": " + String(e.stderr || e.message).trim().split("\n").pop()); }
  });
}
// самопроверка: vilka.db собрана из генератора «Вилки», а не из чужих данных
checkFields("самопроверка vilka.db", [{ label: "строк orders", hint: "-", check: "SELECT COUNT(*) FROM orders;", answer: 31387, tol: 0 }],
            path.join(__dirname, "vilka.db"));
for (const mod of C0.window.COURSE.modules) for (const L of mod.lessons) {
  const C = C0.window.CONTENT[L.id];
  if (!C) continue;
  const dbPath = C.db === "vilka" ? path.join(__dirname, "vilka.db") : db;
  if (L.kind === "sheet") {
    checkFields(L.id + " задача", C.fields, dbPath);
    if (!C.file || !fs.existsSync(path.join(base, C.file))) bad.push(L.id + ": нет файла " + C.file);
  }
  (C.drills || []).forEach(function (d, i) {
    const where = L.id + " тренажёр " + (i + 1) + " «" + d.title + "»";
    if (d.answer === "nums") checkFields(where, d.fields, dbPath);
    else if (L.kind === "sheet" && d.answer !== "text") bad.push(where + ": в уроке sheet задача — nums или text");
  });
}
if (bad.length) { console.log("Ошибки:\n" + bad.join("\n")); process.exit(1); }
console.log("Разбор ввода: " + parsed + " сценариев; эталонов полей: " + fields);
