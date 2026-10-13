#!/usr/bin/env python3
"""Прогон эталонного кода модуля 7 (window.VILKA_CODE в content-m7.js).

    python3 инструменты/checkvilka.py                 # системный python
    python3 инструменты/checkvilka.py ~/.cache/analyst-notebook/v312/bin/python   # pandas 2.2

Код этапа = load + clean (кроме 7.2) + код урока; печатает по строке на поле
урока, число — последнее слово. Сверка с answer ± tol полей урока."""
import json, pathlib, re, shutil, subprocess, sys, tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
PY = sys.argv[1] if len(sys.argv) > 1 else sys.executable
dump = subprocess.run(["node", "-e", r"""
const fs = require("fs"), vm = require("vm");
const ctx = { window: { SH: {}, CONTENT: {}, FIGS: {} } }; vm.createContext(ctx);
for (const f of ["content-core.js", "content-m7.js"]) vm.runInContext(fs.readFileSync(f, "utf8"), ctx);
const W = ctx.window, out = { code: W.VILKA_CODE, fields: {} };
for (const id in W.CONTENT) out.fields[id] = W.CONTENT[id].fields || null;
console.log(JSON.stringify(out));
"""], cwd=ROOT, capture_output=True, text=True, check=True).stdout
D = json.loads(dump)
code, bad, n = D["code"], [], 0
ver = subprocess.run([PY, "-c", "import pandas; print(pandas.__version__)"], capture_output=True, text=True).stdout.strip()
with tempfile.TemporaryDirectory() as tmp:
    shutil.copy(ROOT / "vilka.xlsx", tmp)
    for lid in sorted(k for k in code if re.fullmatch(r"m7l\d+", k)):
        fields = D["fields"].get(lid)
        if not fields:
            continue
        src = code["load"] + "\n" + ("" if lid == "m7l2" else code["clean"] + "\n") + code[lid]
        r = subprocess.run([PY, "-c", src], cwd=tmp, capture_output=True, text=True)
        if r.returncode:
            bad.append("%s: ошибка\n%s" % (lid, r.stderr.strip().splitlines()[-1]))
            continue
        lines = [l for l in r.stdout.splitlines() if l.strip()]
        if len(lines) != len(fields):
            bad.append("%s: напечатано %d строк, полей %d" % (lid, len(lines), len(fields)))
            continue
        for f, line in zip(fields, lines):
            n += 1
            got = float(line.split()[-1].replace(",", "."))
            if abs(got - f["answer"]) > f.get("tol", 0.5):
                bad.append("%s «%s»: код печатает %s, в уроке %s" % (lid, f["label"], got, f["answer"]))
if bad:
    sys.exit("pandas %s — ошибки:\n%s" % (ver, "\n".join(bad)))
print("pandas %s: эталонный код модуля 7 сходится, полей %d" % (ver, n))
