#!/usr/bin/env python3
"""Аудит «объяснено ли то, что требуется» по пути ученика.

    python3 .claude/skills/new-practicum/scripts/audit.py            # все Python-уроки
    python3 …/audit.py m3                                             # печатать только модуль 3

Уроки выстраиваются в порядке прохождения (с учётом поля before в lessons.js).
«Объяснено» — всё, что встречается в шагах, теории, практикуме, карточках и
условиях тренажёра урока или раньше; «требуется» — код решения основной задачи
и тренажёра. Для каждой конструкции Python/pandas, которую урок требует раньше,
чем где-либо объясняют, печатается строка. Функции, определённые в самом
решении (def …), шумят — их просто пропускать глазами.
"""
import collections
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]

DUMP = r"""
const fs = require("fs"), vm = require("vm");
const c = { window: { SH: {}, CONTENT: {}, DATA: {} } }; vm.createContext(c);
for (const f of ["data.js", "content-core.js"].concat(fs.readdirSync(".").filter(f => /^content-m\d+\.js$/.test(f)).sort(), ["lessons.js"]))
  vm.runInContext(fs.readFileSync(f, "utf8"), c);
const all = c.window.COURSE.modules.flatMap(m => m.lessons);
const order = [];
all.filter(l => !l.before).forEach(l => {
  all.filter(b => b.before === l.id).forEach(b => order.push(b));
  order.push(l);
});
const strip = h => String(h || "").replace(/<[^>]+>/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
const out = [];
for (const L of order) {
  const C = c.window.CONTENT[L.id];
  if (!C || L.kind !== "python") continue;
  const taught = [], req = [];
  (C.steps || []).forEach(s => taught.push(strip(s.body) + "\n" + strip(s.task) + "\n" + s.solution));
  if (C.theory) taught.push(strip(C.theory));
  if (C.schema) taught.push(strip(C.schema));
  if (C.practicum) C.practicum.steps.forEach(s => taught.push(strip(s.body) + "\n" + strip(s.task) + "\n" + s.solution));
  (C.cards || []).forEach(x => taught.push(strip(x.q) + " " + strip(x.a)));
  (C.drills || []).forEach(d => taught.push(strip(d.body)));
  if (C.solution) req.push(["main", C.solution]);
  (C.drills || []).forEach((d, i) => req.push(["drill" + (i + 1), d.solution]));
  out.push({ id: L.id, title: L.title, taught: taught.join("\n"), req,
             prelude: (C.prelude || "") + "\n" + ((C.practicum && C.practicum.prelude) || "") });
}
process.stdout.write(JSON.stringify(out));
"""


def feats(code):
    f = set()
    for m in re.finditer(r"\.([a-zA-Z_]+)\(", code):
        f.add("." + m.group(1) + "()")
    for m in re.finditer(r"\.(str|dt|loc|iloc|index|values|columns|shape|dtypes|T)\b(?!\()", code):
        f.add("." + m.group(1))
    for m in re.finditer(r"(?<![\w.])([a-z_]+)\(", code):
        if m.group(1) != "print":
            f.add(m.group(1) + "()")
    for kw, pat in [("for", r"^\s*for .+:\s*$"), ("def", r"^\s*def "), ("lambda", r"\blambda\b"),
                    ("f-строка", r"\bf\""), ("генератор списка", r"\[[^\]]* for [^\]]* in "),
                    ("if", r"^\s*if .+:\s*$"), ("словарь", r"\{\s*\"[^\"]+\"\s*:"), ("assert", r"^\s*assert "),
                    ("while", r"^\s*while "), ("try", r"^\s*try:"), ("распаковка", r"^\s*\w+\s*,\s*\w+\s*=")]:
        if re.search(pat, code, re.M):
            f.add(kw)
    return f


def main():
    only = sys.argv[1] if len(sys.argv) > 1 else ""
    r = subprocess.run(["node", "-e", DUMP], cwd=ROOT, capture_output=True, text=True, check=True)
    lessons = json.loads(r.stdout)
    ids = [x["id"] for x in lessons]
    first = {}
    for x in lessons:
        for f in feats(x["taught"]):
            first.setdefault(f, x["id"])
        for f in feats(x["prelude"]):
            first.setdefault(f, "prelude")
    for i, x in enumerate(lessons):
        if only and not x["id"].startswith(only):
            continue
        defined = set(re.findall(r"^\s*def (\w+)\(", "\n".join(c or "" for _, c in x["req"]), re.M))
        gaps = collections.defaultdict(set)
        for where, code in x["req"]:
            for f in feats(code or ""):
                if f.rstrip("()") in defined:
                    continue
                t = first.get(f)
                if t == "prelude":
                    continue
                if t is None or ids.index(t) > i:
                    gaps[(f, t)].add(where)
        print(f"== {x['id']} {x['title']}" + ("" if gaps else "  — обрывов нет"))
        for (f, t), ws in sorted(gaps.items()):
            print(f"   {f:22} объяснено: {t or 'НИГДЕ':6}  требуется: {', '.join(sorted(ws))}")


if __name__ == "__main__":
    main()
