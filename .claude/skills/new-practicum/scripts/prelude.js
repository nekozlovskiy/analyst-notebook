/* Данные и пролог урока одним Python-файлом — чтобы считать числа для
   практикума тем же кодом, что видит ученик:

       node .claude/skills/new-practicum/scripts/prelude.js m5l1 > <scratchpad>/pre.py
       cat <scratchpad>/pre.py мой_расчёт.py | python3 -
       cat <scratchpad>/pre.py мой_расчёт.py | ~/.cache/analyst-notebook/v312/bin/python -

   По умолчанию — пролог практикума урока (если он есть), с флагом --main —
   пролог основной задачи. Как движок (Steps → Run.python): у практикума
   берутся только его собственные data и prelude, без запасных из урока —
   иначе здесь сработает то, что у ученика упадёт. */
const fs = require("fs"), vm = require("vm"), path = require("path");
const root = path.resolve(__dirname, "../../../..");
const ctx = { window: { SH: {}, CONTENT: {}, DATA: {} } };
vm.createContext(ctx);
for (const f of ["data.js", "content-core.js"].concat(
  fs.readdirSync(root).filter(function (f) { return /^content-m\d+\.js$/.test(f); }).sort())) {
  vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx);
}

const id = process.argv[2];
const L = ctx.window.CONTENT[id];
if (!L) { console.error("нет урока " + id + " — нужен id вроде m5l1"); process.exit(1); }
const P = (process.argv.indexOf("--main") < 0 && L.practicum) || L;
const keys = P.data || [];
const prelude = P.prelude || "";
const what = P === L ? "урока" : "практикума";
if (!prelude && !keys.length) { console.error(id + ": у " + what + " нет ни данных, ни Python-пролога (SQL-урок?)"); process.exit(1); }
if (!prelude) console.error(id + ": у " + what + " нет пролога — код пойдёт без него, как у ученика");
process.stdout.write(keys.map(function (k) {
  return k + " = " + JSON.stringify(ctx.window.DATA[k]);
}).join("\n") + "\n" + prelude + "\n");
