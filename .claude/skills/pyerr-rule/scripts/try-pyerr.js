#!/usr/bin/env node
/* Что скажет ученику Check.pyErr из app.js на эту ошибку Python.

     node .claude/skills/pyerr-rule/scripts/try-pyerr.js "KeyError: 'revenue'"
     node .claude/skills/pyerr-rule/scripts/try-pyerr.js --code "df = pd.DataFrame(); df.sort_valuse('a')" [--python путь]
     node .claude/skills/pyerr-rule/scripts/try-pyerr.js --list

   --code выполняет код (с import pandas as pd) и берёт stderr — так видно
   текст ошибки именно этой версии Python и pandas. --python — другой
   интерпретатор, например окружение pandas 2.2 из скилла new-practicum.
   --list печатает регулярные выражения правил по порядку.

   Код выхода 1, если подсказки нет (pyErr вернул ""). */
"use strict";
const fs = require("fs"), path = require("path");
const { spawnSync } = require("child_process");

const base = path.resolve(__dirname, "../../../..");
const src = fs.readFileSync(path.join(base, "app.js"), "utf8");
const start = src.indexOf("pyErr: function (msg) {");
if (start < 0) { console.error("в app.js не найден Check.pyErr"); process.exit(2); }
/* тело функции — до парной закрывающей скобки */
let i = src.indexOf("{", start), depth = 0, end = -1;
for (; i < src.length; i++) {
  if (src[i] === "{") depth++;
  else if (src[i] === "}" && --depth === 0) { end = i + 1; break; }
}
const fnSrc = src.slice(start + "pyErr: ".length, end);
const pyErr = new Function("return (" + fnSrc + ")")();

const args = process.argv.slice(2);
if (args[0] === "--list") {
  const re = /\/((?:\\.|[^\/\n])+)\/[gimsuy]*\.(?:test|exec)\(last\)/g;
  let m, n = 0;
  while ((m = re.exec(fnSrc))) console.log(String(++n).padStart(2) + "  /" + m[1] + "/");
  process.exit(0);
}

let msg;
const ci = args.indexOf("--code");
if (ci !== -1) {
  const pi = args.indexOf("--python");
  const py = pi !== -1 ? args[pi + 1] : "python3";
  const r = spawnSync(py, ["-"], { input: "import pandas as pd\n" + args[ci + 1], encoding: "utf8" });
  if (r.status === 0) { console.log("код выполнился без ошибки:\n" + r.stdout); process.exit(1); }
  msg = r.stderr;
  console.log("ошибка: " + msg.trim().split("\n").pop());
} else {
  msg = args.join(" ");
}
const hint = pyErr(msg);
console.log(hint ? "подсказка: " + hint : "подсказки нет — ученик увидит общий текст «Прочитайте последнюю строку вывода…»");
process.exit(hint ? 0 : 1);
