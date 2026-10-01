#!/usr/bin/env node
/* Ключи прогресса ученика не сдвинулись: урок хранится по id, а шаги,
   шаги практикума, карточки, вопросы самопроверки и задачи тренажёра —
   по номеру в массиве. Скрипт сравнивает уроки ветки с уроками
   origin/<BASE_REF> (по умолчанию main) и падает, если:

   — урок из main пропал (сменили или удалили id);
   — массив стал короче (удалили элемент);
   — элемент main стоит теперь на другом месте (вставка или удаление
     в середине — у всех следующих элементов поменялся номер).

   Элемент узнаётся по title (шаги, тренажёр) или q (карточки, вопросы).
   Если на месте i другой заголовок, но прежнего нигде в массиве нет —
   это правка текста, она разрешена: скрипт только сообщает о ней.

     node инструменты/checkorder.js            — все уроки
     BASE_REF=main node инструменты/checkorder.js

   Код выхода 1 — ключи сдвинулись; 0 — всё на местах (или main
   недоступен локально — тогда проверка пропускается с пояснением). */
"use strict";
const fs = require("fs"), vm = require("vm"), path = require("path");
const { spawnSync } = require("child_process");

const base = path.resolve(__dirname, "..");
const ref = "origin/" + (process.env.BASE_REF || "main");

function git(args) {
  const r = spawnSync("git", args, { cwd: base, encoding: "utf8", maxBuffer: 1 << 28 });
  return r.status === 0 ? r.stdout : null;
}

function load(read, names) {
  const ctx = { window: { SH: {}, CONTENT: {}, DATA: {} }, console };
  vm.createContext(ctx);
  for (const f of ["data.js", "content-core.js"].concat(names)) {
    const src = read(f);
    if (src !== null) vm.runInContext(src, ctx, { filename: f });
  }
  return ctx.window.CONTENT;
}

const isContent = function (f) { return /^content-m\d+\.js$/.test(f); };

if (git(["rev-parse", "--verify", "-q", ref]) === null) {
  console.log(ref + " нет локально — проверка порядка пропущена (git fetch origin)");
  process.exit(0);
}
const mainNames = (git(["ls-tree", "--name-only", ref]) || "").split("\n").filter(isContent).sort();
const before = load(function (f) { return git(["show", ref + ":" + f]); }, mainNames);
const after = load(function (f) {
  const p = path.join(base, f);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
}, fs.readdirSync(base).filter(isContent).sort());

const ARRAYS = [
  ["steps", "шаги", "title", function (L) { return L.steps; }],
  ["practicum.steps", "шаги практикума", "title", function (L) { return L.practicum && L.practicum.steps; }],
  ["cards", "карточки", "q", function (L) { return L.cards; }],
  ["quiz", "самопроверка", "q", function (L) { return L.quiz; }],
  ["drills", "тренажёр", "title", function (L) { return L.drills; }]
];

const short = function (s) {
  s = String(s === undefined ? "" : s).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  return "«" + (s.length > 50 ? s.slice(0, 50) + "…" : s) + "»";
};

const errors = [], edits = [];
for (const id of Object.keys(before)) {
  const A = after[id];
  if (!A) { errors.push(id + ": урока нет в ветке — id сменили или удалили, прогресс ученика потеряется"); continue; }
  for (const [name, label, key, get] of ARRAYS) {
    const was = get(before[id]), now = get(A);
    if (!Array.isArray(was)) continue;
    if (!Array.isArray(now)) { errors.push(id + " " + name + ": массив пропал (" + label + ")"); continue; }
    if (now.length < was.length) {
      errors.push(id + " " + name + ": было " + was.length + ", стало " + now.length + " — элемент удалён, номера следующих сдвинулись");
    }
    const keys = now.map(function (x) { return x && x[key]; });
    for (let i = 0; i < was.length && i < now.length; i++) {
      const k = was[i] && was[i][key];
      if (keys[i] === k) continue;
      const j = keys.indexOf(k);
      if (j !== -1) {
        errors.push(id + " " + name + "[" + i + "] " + short(k) + " теперь на месте " + j +
          " — вставка или перестановка в середине; новое дописывается только в конец");
        break;
      }
      edits.push(id + " " + name + "[" + i + "]: " + short(k) + " → " + short(keys[i]));
    }
  }
}

if (edits.length) {
  console.log("Изменён текст на прежних местах (разрешено, проверьте, что это правка, а не замена):");
  for (const e of edits) console.log("  " + e);
}
if (errors.length) {
  console.error("Ключи прогресса сдвинулись относительно " + ref + ":");
  for (const e of errors) console.error("  " + e);
  process.exit(1);
}
console.log("Порядок уроков, шагов, карточек, вопросов и тренажёра совпадает с " + ref + ".");
