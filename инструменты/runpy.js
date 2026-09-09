/* Достаёт из урока решение, эталон или код тренажёра.
   node инструменты/runpy.js m5l1            -> solution
   node инструменты/runpy.js m5l1 expected   -> expected.stdout
   node инструменты/runpy.js m5l1 drill 2    -> код второго тренажёра  */
const fs = require("fs"), vm = require("vm"), path = require("path");
const base = path.resolve(__dirname, "..");
const ctx = { window: { SH: {}, CONTENT: {}, DATA: {} }, console };
vm.createContext(ctx);
const files = ["data.js", "content-core.js"].concat(
  fs.readdirSync(base).filter(f => /^content-m\d+\.js$/.test(f)).sort());
for (const f of files) vm.runInContext(fs.readFileSync(path.join(base, f), "utf8"), ctx);

const C = ctx.window.CONTENT[process.argv[2]];
if (!C) { console.error("нет урока " + process.argv[2]); process.exit(1); }
if (process.argv[3] === "expected") process.stdout.write(C.expected.stdout);
else if (process.argv[3] === "drill") {
  process.stdout.write(C.drills[+process.argv[4]].solution.split(/\n\s*(?:Результат|Что получается|Что получается:)/)[0]);
} else process.stdout.write(C.solution);
