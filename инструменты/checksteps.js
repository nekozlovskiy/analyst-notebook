#!/usr/bin/env node
/* Проверка шагов пошагового урока: решение каждого шага прогоняется
   на учебной базе и сверяется с expected по тем же правилам, что
   Check.sql в app.js — имена столбцов, число строк, порядок строк
   при ordered, числа с допуском 0.011.

     node инструменты/checksteps.js m0l1                     — все шаги
     node инструменты/checksteps.js m0l1 --try 3 "SELECT 1"  — что увидит
                                                               ученик на шаге 3

   Код выхода 1, если хоть один шаг не сошёлся или в шаге нет поля. */
"use strict";
const fs = require("fs"), vm = require("vm"), path = require("path");
const { DatabaseSync } = require("node:sqlite");

const base = path.resolve(__dirname, "..");
const ctx = { window: { SH: {}, CONTENT: {}, DATA: {} }, console };
vm.createContext(ctx);
const files = ["data.js", "content-core.js"].concat(
  fs.readdirSync(base).filter(function (f) { return /^content-m\d+\.js$/.test(f); }).sort());
for (const f of files) vm.runInContext(fs.readFileSync(path.join(base, f), "utf8"), ctx);

const args = process.argv.slice(2);
const id = args[0];
const C = ctx.window.CONTENT[id];
if (!C || !Array.isArray(C.steps)) { console.error(id + ": нет урока с шагами"); process.exit(1); }

const db = new DatabaseSync(":memory:");
db.exec(ctx.window.DATA.shopSQL);

function query(sql) {
  const st = db.prepare(sql);
  const columns = st.columns().map(function (c) { return c.name; });
  const values = st.all().map(function (row) { return columns.map(function (c) { return row[c]; }); });
  return { columns: columns, values: values };
}

/* ---- копия Check.cellEq и Check.sql из app.js ---- */
function cellEq(a, b) {
  if (a === null || a === undefined) a = "";
  if (b === null || b === undefined) b = "";
  const na = Number(a), nb = Number(b);
  if (a !== "" && b !== "" && !isNaN(na) && !isNaN(nb)) return Math.abs(na - nb) < 0.011;
  return String(a).trim() === String(b).trim();
}
function check(res, exp) {
  const gc = res.columns.map(function (c) { return String(c).toLowerCase().trim(); });
  const ec = exp.columns.map(function (c) { return c.toLowerCase(); });
  if (gc.length !== ec.length) return { ok: false, why: "столбцов " + gc.length + ", а нужно " + ec.length + " (" + exp.columns.join(", ") + ")" };
  for (let i = 0; i < ec.length; i++) {
    if (gc[i] !== ec[i]) return { ok: false, why: "столбец " + (i + 1) + " называется «" + res.columns[i] + "», а в задаче просят «" + exp.columns[i] + "» — задайте имя через AS" };
  }
  let got = res.values.slice(), want = exp.rows.slice();
  if (got.length !== want.length) return { ok: false, why: "строк " + got.length + ", а должно быть " + want.length };
  if (!exp.ordered) {
    const key = function (r) { return r.map(function (v) { return v === null ? "" : String(v); }).join("|"); };
    got = got.slice().sort(function (x, y) { return key(x) < key(y) ? -1 : 1; });
    want = want.slice().sort(function (x, y) { return key(x) < key(y) ? -1 : 1; });
  }
  for (let r = 0; r < want.length; r++) {
    for (let c = 0; c < want[r].length; c++) {
      if (!cellEq(got[r][c], want[r][c])) {
        return { ok: false, why: "строка " + (r + 1) + ", столбец «" + exp.columns[c] + "»: получилось " + JSON.stringify(got[r][c]) + ", ожидается " + JSON.stringify(want[r][c]) };
      }
    }
  }
  return { ok: true };
}

let bad = 0;
function report(n, sql) {
  const label = "шаг " + (n + 1);
  let res;
  try { res = query(sql); }
  catch (e) { console.log(label + "  ОШИБКА  " + e.message); bad++; return; }
  const r = check(res, C.steps[n].expected);
  console.log(label + "  " + (r.ok ? "ок" : "РАСХОЖДЕНИЕ  " + r.why) + "  (" + res.values.length + " строк)");
  if (!r.ok) bad++;
}

if (args[1] === "--try") {
  report(+args[2] - 1, args[3]);
} else {
  C.steps.forEach(function (s, n) {
    ["title", "body", "starter", "expected", "hint", "solution"].forEach(function (k) {
      if (s[k] === undefined || s[k] === "") { console.log("шаг " + (n + 1) + "  нет поля " + k); bad++; }
    });
    report(n, s.solution);
  });
}
process.exit(bad ? 1 : 0);
