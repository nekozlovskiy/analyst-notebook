#!/usr/bin/env node
/* База «Дельта Такси»: data-taxi.js загружается и совпадает с shop.db
   (строк, непустых и сумм по столбцам), а Taxi.wants из app.js узнаёт запросы к такси.
   Запуск: node инструменты/checktaxi.js            */
const fs = require("fs"), vm = require("vm"), path = require("path");
const { execFileSync } = require("child_process");
const base = path.resolve(__dirname, "..");
const bad = [];
const ctx = { window: {} }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(base, "data-taxi.js"), "utf8"), ctx);
const D = ctx.window.TAXI;
const rows = k => D[k].split("\n").filter(Boolean).length - 1;
const db = path.join(__dirname, "shop.db");
for (const [t, k] of [["riders", "ridersCSV"], ["drivers", "driversCSV"], ["trips", "tripsCSV"]]) {
  let n = "нет таблицы";
  try { n = +execFileSync("sqlite3", [db, "SELECT COUNT(*) FROM " + t], { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim(); }
  catch (e) { /* таблицы нет — mkdb.py не перезапускали */ }
  if (n !== rows(k)) bad.push(t + ": в data-taxi.js " + rows(k) + " строк, в shop.db " + n);
  if (n !== rows(k)) continue;
  /* Строк поровну — сверяем и содержимое: по каждому столбцу число
     непустых и сумму чисел. Ловит расхождение правил заливки
     (mkdb.py против Taxi.fill), а не только потерянные строки. */
  const [head, ...lines] = D[k].split("\n").filter(Boolean);
  const cols = head.split(","), cells = lines.map(l => l.split(","));
  const q = cols.map(c => "COUNT(" + c + "), ROUND(TOTAL(CASE WHEN typeof(" + c + ") IN ('integer','real') THEN " + c + " END), 2)").join(", ");
  const got = execFileSync("sqlite3", [db, "SELECT " + q + " FROM " + t], { encoding: "utf8" }).trim().split("|").map(Number);
  cols.forEach((c, i) => {
    const vals = cells.map(r => r[i]).filter(v => v !== "");
    const num = vals.filter(v => v.trim() !== "" && !isNaN(+v));
    const sum = Math.round(num.reduce((a, v) => a + +v, 0) * 100) / 100;
    if (got[2 * i] !== vals.length) bad.push(t + "." + c + ": непустых в data-taxi.js " + vals.length + ", в shop.db " + got[2 * i]);
    else if (Math.abs(got[2 * i + 1] - sum) > 0.01) bad.push(t + "." + c + ": сумма в data-taxi.js " + sum + ", в shop.db " + got[2 * i + 1]);
  });
}
const app = fs.readFileSync(path.join(base, "app.js"), "utf8");
const m = app.match(/\nconst Taxi = \{[\s\S]*?\n\};\n/);
if (!m) { console.log("В app.js не найден объект Taxi"); process.exit(1); }
const tx = {}; vm.createContext(tx);
vm.runInContext(m[0].replace("const Taxi", "var Taxi"), tx);
const W = tx.Taxi.wants, cases = [
  ["SELECT * FROM trips", true], ["select count(*) from Drivers d", true],
  ["SELECT r.city FROM riders r JOIN trips t USING(rider_id)", true],
  ["SELECT * FROM orders", false], ["SELECT trip_id FROM orders", false],
  ["SELECT * FROM users -- не trips", true], ["", false], [null, false]];
for (const [c, want] of cases) if (W(c) !== want) bad.push("Taxi.wants(" + JSON.stringify(c) + ") = " + W(c) + ", нужно " + want);
if (bad.length) { console.log("Такси:\n" + bad.join("\n")); process.exit(1); }
console.log("Такси: riders " + rows("ridersCSV") + ", drivers " + rows("driversCSV") + ", trips " + rows("tripsCSV") + ", сценариев wants: " + cases.length);
