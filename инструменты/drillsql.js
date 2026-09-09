/* Печатает SQL из тренажёра урока (до строки с результатом).
   node инструменты/drillsql.js m4l2 1  */
const fs = require("fs"), vm = require("vm"), path = require("path");
const base = path.resolve(__dirname, "..");
const ctx = { window: { SH: {}, CONTENT: {}, DATA: {} }, console };
vm.createContext(ctx);
const files = ["data.js", "content-core.js"].concat(
  fs.readdirSync(base).filter(f => /^content-m\d+\.js$/.test(f)).sort());
for (const f of files) vm.runInContext(fs.readFileSync(path.join(base, f), "utf8"), ctx);
process.stdout.write(ctx.window.CONTENT[process.argv[2]].drills[+process.argv[3]]
  .solution.split(/\nРезультат/)[0]);
