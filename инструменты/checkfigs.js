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
const sbxFile = path.join(base, "sandbox.js");
if (fs.existsSync(sbxFile)) vm.runInContext(fs.readFileSync(sbxFile, "utf8"), ctx);
const SBX = ctx.window.SANDBOX || {}, S = ctx.window.Sandbox || { draw: {}, label: {} };
for (const [id, data] of Object.entries(SBX)) {
  if (!used[id]) bad.push("песочница " + id + " — схемы нет в теории");
  if (!S.draw[id] || !S.label[id]) { bad.push("песочница " + id + ": нет Sandbox.draw/label в sandbox.js"); continue; }
  data.ns.forEach(function (n, i) {
    const svg = S.draw[id](data, i), l = S.label[id](data, i);
    const vb = svg.match(/^<svg[^>]*viewBox="-?[\d.]+ -?[\d.]+ ([\d.]+) /);
    if (!vb || +vb[1] > 340) bad.push(id + " n=" + n + ": нет viewBox или он шире 340");
    if (/NaN|undefined/.test(svg + l.text + l.aria)) bad.push(id + " n=" + n + ": NaN или undefined");
    if (/#[0-9a-f]{3,8}\b|rgba?\(|(fill|stroke)="(?!none)[a-z]/i.test(svg))
      bad.push(id + " n=" + n + ": цвет задан напрямую — только классы .f-*");
    if (l.text.replace(/\s/g, "").indexOf(String(Math.round(data.sd[i]))) < 0)   /* «1 778» — с пробелом */
      bad.push(id + " n=" + n + ": в подписи нет разброса " + Math.round(data.sd[i]));
  });
}
for (const id of Object.keys(S.draw)) if (!SBX[id]) bad.push("Sandbox.draw[" + id + "] есть, а данных нет — запустите figs.py");
console.log("Песочниц: " + Object.keys(SBX).length);
console.log("Схем: " + Object.keys(FIGS).length + ", меток в теории: " + Object.keys(used).length);
if (bad.length) { console.log("\nОшибки:\n" + bad.join("\n")); process.exit(1); }
console.log("Ошибок нет.");
