#!/usr/bin/env node
/* Проверка словаря терминов (glossary.js).

     node инструменты/checkterms.js                  — записи словаря и сколько
                                                        терминов нашлось в уроках
     node инструменты/checkterms.js --missing [m1]    — кандидаты в словарь: код
                                                        и латиница из текстов уроков,
                                                        которых словарь не знает
     node инструменты/checkterms.js --show cohort     — где термин нашёлся, с
                                                        окружением: ловить ложные
                                                        совпадения

   Тексты уроков берутся те же, где сайт ставит подчёркивания: теория,
   шаги, тикет, тренажёр, самопроверка, карточки. Код блоком (<pre>)
   пропускается, как и на сайте. Код выхода 1, если в записях словаря
   есть ошибки. */
"use strict";
const fs = require("fs"), vm = require("vm"), path = require("path");

const base = path.resolve(__dirname, "..");
const ctx = { window: { SH: {}, CONTENT: {}, DATA: {} }, console };
vm.createContext(ctx);
const files = ["lessons.js", "content-core.js"].concat(
  fs.readdirSync(base).filter(function (f) { return /^content-m\d+\.js$/.test(f); }).sort(),
  ["glossary.js"]);
for (const f of files) vm.runInContext(fs.readFileSync(path.join(base, f), "utf8"), ctx);

const G = ctx.window.GLOSSARY, C = ctx.window.CONTENT;
const lessons = [];
ctx.window.COURSE.modules.forEach(function (m) {
  m.lessons.forEach(function (l) { lessons.push({ id: l.id, mod: m.id }); });
});
const args = process.argv.slice(2);

/* ---------- записи словаря ---------- */
let bad = 0;
function err(msg) { console.log("ОШИБКА  " + msg); bad++; }
const seen = {};
G.terms.forEach(function (t) {
  if (seen[t.id]) err(t.id + ": id повторяется");
  seen[t.id] = true;
  ["id", "t", "kind", "forms", "plain", "lesson"].forEach(function (k) {
    if (!t[k] || (Array.isArray(t[k]) && !t[k].length)) err(t.id + ": нет поля " + k);
  });
  if (["sql", "ch", "db", "word"].indexOf(t.kind) < 0) err(t.id + ": неизвестный kind " + t.kind);
  if (t.lesson && !lessons.some(function (l) { return l.id === t.lesson; })) err(t.id + ": нет урока " + t.lesson);
  const words = String(t.plain || "").replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  if (words > 40) err(t.id + ": объяснение " + words + " слов, а можно до 40");
  if (/(^|[^а-яё])(просто|очевидно|как известно)([^а-яё]|$)/i.test(t.plain + " " + (t.when || ""))) {
    err(t.id + ": «просто/очевидно» в объяснении");
  }
});

/* ---------- тексты уроков ---------- */
function texts(c) {
  const out = [c.theory, c.after, c.ticket && c.ticket.body, c.reference, c.solutionNote];
  (c.hints || []).forEach(function (h) { out.push(h); });
  (c.steps || []).forEach(function (s) { out.push(s.body, s.hint); });
  (c.drills || []).forEach(function (d) { out.push(d.body, d.note); });
  (c.quiz || []).forEach(function (q) { out.push(q.q, q.why); });
  (c.cards || []).forEach(function (k) { out.push(k.q, k.a); });
  return out.filter(Boolean).join("\n");
}
/* HTML → куски [{s, code}]: обычный текст и содержимое <code>, без <pre> и заголовков */
function pieces(html) {
  html = html.replace(/<pre[\s\S]*?<\/pre>/g, " ").replace(/<h\d[\s\S]*?<\/h\d>/g, " ");
  const plain = function (s) {
    return s.replace(/<[^>]+>/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&").replace(/&nbsp;/g, " ");
  };
  const res = [];
  const re = /<code>([\s\S]*?)<\/code>/g;
  let at = 0, m;
  while ((m = re.exec(html))) {
    res.push({ s: plain(html.slice(at, m.index)), code: false });
    res.push({ s: plain(m[1]), code: true });
    at = re.lastIndex;
  }
  res.push({ s: plain(html.slice(at)), code: false });
  return res;
}

if (args[0] === "--show") {
  const id = args[1];
  lessons.forEach(function (l) {
    if (!C[l.id]) return;
    pieces(texts(C[l.id])).forEach(function (p) {
      G.find(p.s, { code: p.code, mod: l.mod }).forEach(function (h) {
        if (h.id !== id) return;
        const a = Math.max(0, h.start - 40), b = Math.min(p.s.length, h.end + 40);
        console.log(l.id + "  …" + p.s.slice(a, h.start).replace(/\s+/g, " ") +
          "[" + p.s.slice(h.start, h.end) + "]" + p.s.slice(h.end, b).replace(/\s+/g, " ") + "…");
      });
    });
  });
} else if (args[0] === "--missing") {
  const only = args[1] || null;
  const tally = {};
  lessons.forEach(function (l) {
    if (!C[l.id] || (only && l.mod !== only)) return;
    pieces(texts(C[l.id])).forEach(function (p) {
      let masked = p.s;
      G.find(p.s, { code: p.code, mod: l.mod }).forEach(function (h) {
        masked = masked.slice(0, h.start) + " ".repeat(h.end - h.start) + masked.slice(h.end);
      });
      /* в коде — вызовы функций, слова ЗАГЛАВНЫМИ и методы через точку;
         в тексте — латинские слова */
      const words = p.code
        ? (masked.match(/[A-Za-z_][A-Za-z_.]*(?=\s*\()|\b[A-Z][A-Z_]{2,}\b|\b[a-z_]+\.[a-z_]+\b/g) || [])
        : (masked.match(/\b[A-Za-z][A-Za-z\-]{2,}\b/g) || []);
      words.forEach(function (w) {
        tally[w] = tally[w] || { n: 0, where: l.id };
        tally[w].n++;
      });
    });
  });
  Object.keys(tally).sort(function (a, b) { return tally[b].n - tally[a].n; }).slice(0, 80)
    .forEach(function (w) { console.log(String(tally[w].n).padStart(4) + "  " + w + "  (впервые " + tally[w].where + ")"); });
} else {
  lessons.forEach(function (l) {
    if (!C[l.id]) return;
    const ids = {};
    pieces(texts(C[l.id])).forEach(function (p) {
      G.find(p.s, { code: p.code, mod: l.mod }).forEach(function (h) { ids[h.id] = true; });
    });
    console.log(l.id.padEnd(6) + String(Object.keys(ids).length).padStart(4) + " терминов");
  });
  console.log("Терминов в словаре: " + G.terms.length + ". " + (bad ? "Ошибок: " + bad + "." : "Ошибок нет."));
}
process.exit(bad ? 1 : 0);
