#!/usr/bin/env node
/* Проверка карточек «вопрос → ответ» в content-m0.js … content-m6.js.

     node инструменты/checkcards.js                  — формат всех карточек, какие есть
     node инструменты/checkcards.js --require m1     — и у каждого урока модуля 1 есть 6–12 карточек
     node инструменты/checkcards.js --require m1l2   — то же для одного урока

   Число из двух и больше цифр в ответе должно встречаться в теории
   урока или в ПРОГРЕСС.md: карточки не вводят непроверенных чисел.  */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
global.window = { CONTENT: {}, SH: new Proxy({}, { get: function () { return ""; } }) };
require(path.join(ROOT, "lessons.js"));
for (let n = 0; n <= 6; n++) require(path.join(ROOT, "content-m" + n + ".js"));

/* Числа сравниваются целиком: «17» не должно найтись внутри «17.09».
   Запятая и точка в дробях считаются одним и тем же. */
function numbers(text) {
  return (text.match(/\d+(?:[.,]\d+)?/g) || []).map(function (n) { return n.replace(",", "."); });
}
const progress = new Set(numbers(fs.readFileSync(path.join(ROOT, "ПРОГРЕСС.md"), "utf8")));
const args = process.argv.slice(2);
const required = args[0] === "--require" ? args.slice(1) : [];
const TAGS = { code: true, pre: true };
const errors = [];

/* В формулах теории десятичная запятая записана как {,}: 0{,}05 */
function plain(html) {
  return html.replace(/<[^>]+>/g, "").replace(/\{,\}/g, ",")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

function checkHtml(where, html) {
  const re = /<\/?([a-zA-Z0-9]+)[^>]*>/g;
  let m;
  while ((m = re.exec(html))) {
    if (!TAGS[m[1].toLowerCase()]) errors.push(where + ": тег <" + m[1] + "> не разрешён, можно только <code> и <pre>");
  }
  /* тот же диапазон, что в проверке после генерации текста из ПРОГРЕСС.md */
  Array.from(html).forEach(function (ch) {
    const c = ch.codePointAt(0);
    if (c > 0x2E00 && c < 0xFF00) errors.push(where + ": посторонний символ «" + ch + "»");
  });
}

let total = 0;
window.COURSE.modules.forEach(function (m) {
  m.lessons.forEach(function (l) {
    const C = window.CONTENT[l.id];
    const cards = C && C.cards;
    const need = required.indexOf(m.id) >= 0 || required.indexOf(l.id) >= 0;
    if (cards === undefined) {
      if (need) errors.push(l.id + ": нет карточек");
      return;
    }
    if (!Array.isArray(cards)) { errors.push(l.id + ": cards должно быть массивом"); return; }
    if (need && (cards.length < 6 || cards.length > 12)) {
      errors.push(l.id + ": карточек " + cards.length + ", нужно от 6 до 12");
    }
    /* у пошагового урока теория — это тексты шагов и блок «как дальше» */
    const text = (C.theory || "") +
      (C.steps || []).map(function (s) { return s.body; }).join(" ") + (C.after || "");
    const theory = new Set(numbers(plain(text)));
    cards.forEach(function (c, i) {
      const where = l.id + " карточка " + i;
      if (!c || typeof c.q !== "string" || !c.q.trim()) { errors.push(where + ": пустой вопрос q"); return; }
      if (typeof c.a !== "string" || !c.a.trim()) { errors.push(where + ": пустой ответ a"); return; }
      if (/<pre/i.test(c.q)) errors.push(where + ": в вопросе нельзя <pre>");
      checkHtml(where, c.q);
      checkHtml(where, c.a);
      if (plain(c.q).length > 160) errors.push(where + ": вопрос длиннее 160 знаков");
      if (plain(c.a).length > 400) errors.push(where + ": ответ длиннее 400 знаков");
      numbers(plain(c.a)).forEach(function (num) {
        if (num.replace(/\D/g, "").length < 2) return;
        if (!theory.has(num) && !progress.has(num)) {
          errors.push(where + ": число " + num + " не найдено ни в теории урока, ни в ПРОГРЕСС.md");
        }
      });
    });
    total += cards.length;
    console.log(l.id + "  " + cards.length);
  });
});

if (errors.length) {
  console.error("\n" + errors.join("\n") + "\n\nОшибок: " + errors.length);
  process.exit(1);
}
console.log("\nВсего карточек: " + total + ". Ошибок нет.");
