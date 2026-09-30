#!/usr/bin/env python3
"""Проверка практикума: решение каждого шага проходит, заготовка — нет.

    python3 .claude/skills/new-practicum/scripts/practicum_check.py m3l3
    python3 …/practicum_check.py m3l3 --python /path/to/v312/bin/python   # pandas 2.2

Шаги на Python (expected.stdout) запускаются выбранным интерпретатором после
данных и пролога практикума и сверяются так же, как в браузере: построчно,
без пробелов по краям. Заодно прогоняется решение основной задачи урока.
SQL-шаги проверяются через инструменты/checksteps.js --try, шаги-графики
(expected.plot) — только в браузере, здесь пропускаются.
Код выхода 1, если решение не проходит или заготовка уже проходит.
"""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]

DUMP = r"""
const fs = require("fs"), vm = require("vm");
const c = { window: { SH: {}, CONTENT: {}, DATA: {} } }; vm.createContext(c);
for (const f of ["data.js", "content-core.js"].concat(fs.readdirSync(".").filter(f => /^content-m\d+\.js$/.test(f)).sort()))
  vm.runInContext(fs.readFileSync(f, "utf8"), c);
const L = c.window.CONTENT[process.argv[1]];
if (!L) { console.error("нет урока " + process.argv[1]); process.exit(1); }
const P = L.practicum || (L.steps ? L : null);
const data = {};
((P && P.data) || []).forEach(k => { data[k] = c.window.DATA[k]; });
(L.data || []).forEach(k => { data[k] = c.window.DATA[k]; });
process.stdout.write(JSON.stringify({
  prelude: P ? (P.prelude || "") : "", mainPrelude: L.prelude || "",
  steps: P ? P.steps.map(s => ({ title: s.title, starter: s.starter, solution: s.solution, expected: s.expected })) : [],
  main: L.solution || "", mainExp: (L.expected && L.expected.stdout) || null, data }));
"""


def norm(s):
    return [" ".join(l.split()) for l in s.replace("\r", "").split("\n") if l.strip()]


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        return 2
    lid = args[0]
    py = sys.executable
    if "--python" in args:
        py = args[args.index("--python") + 1]
    r = subprocess.run(["node", "-e", DUMP, lid], cwd=ROOT, capture_output=True, text=True)
    if r.returncode:
        print(r.stderr.strip())
        return 2
    d = json.loads(r.stdout)
    head = "\n".join(f"{k} = {json.dumps(v)}" for k, v in d["data"].items())
    ver = subprocess.run([py, "-c", "import pandas; print(pandas.__version__)"], capture_output=True, text=True)
    print(f"{lid}: {len(d['steps'])} шагов, python {py}, pandas {(ver.stdout or '—').strip()}")

    def run(code, prelude):
        p = subprocess.run([py, "-"], input=head + "\n" + prelude + "\n" + code, capture_output=True, text=True)
        return p.returncode, p.stdout, (p.stderr.strip().splitlines() or [""])[-1]

    bad = 0
    for i, s in enumerate(d["steps"], 1):
        exp = s["expected"] or {}
        if exp.get("plot"):
            print(f"  шаг {i}  график — проверять в браузере")
            continue
        if "stdout" not in exp:  # SQL
            for kind, code in (("решение", s["solution"]), ("заготовка", s["starter"])):
                t = subprocess.run(["node", "инструменты/checksteps.js", lid, "--try", str(i), code],
                                   cwd=ROOT, capture_output=True, text=True).stdout.strip().splitlines()[-1]
                ok = " ок " in f" {t} "
                if (kind == "решение") != ok:
                    bad += 1
                print(f"  шаг {i}  {kind}: {t}")
            continue
        rc, out, err = run(s["solution"], d["prelude"])
        sol_ok = rc == 0 and norm(out) == norm(exp["stdout"])
        rc2, out2, err2 = run(s["starter"], d["prelude"])
        starter_passes = rc2 == 0 and norm(out2) == norm(exp["stdout"])
        mark = "ок" if sol_ok and not starter_passes else "ПРОБЛЕМА"
        if mark != "ок":
            bad += 1
        print(f"  шаг {i}  {mark}: решение {'проходит' if sol_ok else 'НЕ проходит ' + err}, "
              f"заготовка {'УЖЕ ПРОХОДИТ' if starter_passes else 'не проходит'}"
              + (f" (падает: {err2})" if rc2 else ""))
        if not sol_ok and rc == 0:
            print("    вывод решения:\n" + "\n".join("    | " + l for l in out.splitlines()))
    if d["main"] and d["mainExp"]:
        rc, out, err = run(d["main"], d["mainPrelude"])
        ok = rc == 0 and norm(out) == norm(d["mainExp"])
        bad += 0 if ok else 1
        print(f"  основная задача: {'ок' if ok else 'НЕ проходит ' + err}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
