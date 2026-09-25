#!/usr/bin/env node
/* Проверка схем в теории (window.FIGS, см. инструменты/figs.py):
   - каждая метка data-fig в теории указывает на схему, каждая схема
     где-то стоит;
   - у схемы role="img", <title> и <desc> — её читает диктор;
   - viewBox не шире 340 — схемы рисуются под телефон;
   - цвета только классами .f-*: заданный напрямую цвет пропадёт
     в тёмной теме.
   Запуск: node инструменты/checkfigs.js                          */
const fs = require("fs"), vm = require("vm"), path = require("path");
const base = path.resolve(__dirname, "..");
const ctx = { window: { SH: {}, CONTENT: {}, DATA: {} }, console };
vm.createContext(ctx);
for (const f of ["content-core.js"].concat(
       fs.readdirSync(base).filter(f => /^content-m\d+\.js$/.test(f)).sort())) {
  vm.runInContext(fs.readFileSync(path.join(base, f), "utf8"), ctx);
}
const FIGS = ctx.window.FIGS || {};
const bad = [], used = {};
for (const [id, C] of Object.entries(ctx.window.CONTENT)) {
  for (const m of String(C.theory || "").matchAll(/data-fig="([\w-]+)"/g)) {
    used[m[1]] = true;
    if (!FIGS[m[1]]) bad.push(id + ": метка data-fig=\"" + m[1] + "\", а схемы нет — запустите figs.py");
  }
}
for (const [fid, svg] of Object.entries(FIGS)) {
  if (!used[fid]) bad.push("схема " + fid + " нигде не стоит в теории");
  if (!/role="img"/.test(svg)) bad.push(fid + ": нет role=\"img\"");
  if (!/<title[ >]/.test(svg) || !/<desc[ >]/.test(svg)) bad.push(fid + ": нет <title> или <desc>");
  const vb = svg.match(/viewBox="-?[\d.]+ -?[\d.]+ ([\d.]+) ([\d.]+)"/);
  if (!vb) bad.push(fid + ": нет viewBox");
  else if (+vb[1] > 340) bad.push(fid + ": viewBox шириной " + vb[1] + " — больше 340");
  if (/#[0-9a-f]{3,8}\b|rgba?\(|(fill|stroke)="(?!none)[a-z]/i.test(svg.replace(/url\(#[\w-]+\)/g, "")))
    bad.push(fid + ": цвет задан напрямую — только классы .f-*");
}
console.log("Схем: " + Object.keys(FIGS).length + ", меток в теории: " + Object.keys(used).length);
if (bad.length) { console.log("\nОшибки:\n" + bad.join("\n")); process.exit(1); }
console.log("Ошибок нет.");
