#!/usr/bin/env node
/* Проверка шагов пошагового урока (0.1) и практикума внутри урока
   (1.2): решение каждого шага прогоняется на учебной базе и сверяется
   с expected по тем же правилам, что Check.sql в app.js — имена
   столбцов, число строк, порядок строк при ordered, числа с допуском
   0.011. Таблицы «было → стало» (ba) сверяются по форме: число
   значений в строке равно числу столбцов, hl — среди столбцов «стало»,
   keep — номера существующих строк «было».

   Шаги урока на Python (0.2) — те, у кого expected.stdout: решение
   прогоняется локальным python3 после пролога урока и сверяется по
   правилам Check.python — построчно, без пробелов по краям. Локальный
   pandas новее браузерного, поэтому окончательная проверка — в браузере.

     node инструменты/checksteps.js m0l1                     — все шаги
     node инструменты/checksteps.js m0l1 --try 3 "SELECT 1"  — что увидит
                                                               ученик на шаге 3

   Код выхода 1, если хоть один шаг не сошёлся или в шаге нет поля. */
"use strict";
const fs = require("fs"), vm = require("vm"), path = require("path");
const { DatabaseSync } = require("node:sqlite");
const { spawnSync } = require("child_process");

const base = path.resolve(__dirname, "..");
const ctx = { window: { SH: {}, CONTENT: {}, DATA: {} }, console };
vm.createContext(ctx);
const files = ["data.js", "content-core.js"].concat(
  fs.readdirSync(base).filter(function (f) { return /^content-m\d+\.js$/.test(f); }).sort());
for (const f of files) vm.runInContext(fs.readFileSync(path.join(base, f), "utf8"), ctx);

const args = process.argv.slice(2);
const id = args[0];
const L = ctx.window.CONTENT[id];
const C = L && (L.steps ? L : L.practicum);
if (!C || !Array.isArray(C.steps)) { console.error(id + ": нет урока с шагами"); process.exit(1); }
const isPy = C.steps.some(function (s) { return s.expected && s.expected.stdout !== undefined; });
if (isPy) {
  const v = spawnSync("python3", ["-c", "import pandas; print(pandas.__version__)"], { encoding: "utf8" });
  console.log("локально pandas " + (v.stdout || "?").trim() + ", в браузере 2.2 — окончательная проверка там");
}

/* ---- Python: данные и пролог урока, потом код; как runPy в Steps ---- */
function runPy(code) {
  const head = (C.data || []).map(function (k) {
    return k + " = " + JSON.stringify(ctx.window.DATA[k]);
  }).join("\n");
  const r = spawnSync("python3", ["-"], {
    input: head + "\n" + (C.prelude || "") + "\n" + code,
    encoding: "utf8", maxBuffer: 1 << 26
  });
  if (r.status !== 0) return { err: (r.stderr || "").trim().split("\n").pop() };
  return { out: r.stdout };
}
/* ---- копия Check.normLines и Check.python из app.js ---- */
function normLines(s) {
  return String(s).replace(/\r/g, "").split("\n")
    .map(function (l) { return l.trim().replace(/\s+/g, " "); })
    .filter(function (l) { return l.length > 0; });
}
function checkPy(got, want) {
  const a = normLines(got), b = normLines(want);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) {
      return { ok: false, why: "строка " + (i + 1) + ": получилось " + JSON.stringify(a[i]) + ", ожидается " + JSON.stringify(b[i]) };
    }
  }
  return { ok: true };
}

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
function checkBa(n, ba) {
  const label = "шаг " + (n + 1) + "  ba: ";
  ["before", "after"].forEach(function (k) {
    const t = ba[k];
    if (!t || !Array.isArray(t.columns) || !Array.isArray(t.rows)) { console.log(label + "нет " + k); bad++; return; }
    t.rows.forEach(function (r, i) {
      if (r.length !== t.columns.length) { console.log(label + k + ", строка " + (i + 1) + ": значений " + r.length + ", столбцов " + t.columns.length); bad++; }
    });
  });
  (ba.keep || []).forEach(function (i) {
    if (!ba.before || !ba.before.rows[i]) { console.log(label + "keep " + i + " — нет такой строки «было»"); bad++; }
  });
  (ba.hl || []).forEach(function (c) {
    if (!ba.after || ba.after.columns.indexOf(c) < 0) { console.log(label + "hl «" + c + "» нет среди столбцов «стало»"); bad++; }
  });
}
function report(n, sql) {
  const label = "шаг " + (n + 1);
  if (isPy) {
    const p = runPy(sql);
    if (p.err) { console.log(label + "  ОШИБКА  " + p.err); bad++; return; }
    const rp = checkPy(p.out, C.steps[n].expected.stdout);
    console.log(label + "  " + (rp.ok ? "ок" : "РАСХОЖДЕНИЕ  " + rp.why));
    if (!rp.ok) { bad++; console.log(p.out.replace(/^/gm, "    | ")); }
    return;
  }
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
    if (s.ba) checkBa(n, s.ba);
    report(n, s.solution);
  });
}
process.exit(bad ? 1 : 0);
