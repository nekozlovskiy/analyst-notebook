/* Печатает solution или expected SQL-урока.
   node инструменты/checksql.js m4l3 [expected]  */
const fs = require("fs"), vm = require("vm"), path = require("path");
const base = path.resolve(__dirname, "..");
const ctx = { window: { SH: {}, CONTENT: {}, DATA: {} }, console };
vm.createContext(ctx);
const files = ["data.js", "content-core.js"].concat(
  fs.readdirSync(base).filter(f => /^content-m\d+\.js$/.test(f)).sort());
for (const f of files) vm.runInContext(fs.readFileSync(path.join(base, f), "utf8"), ctx);
const C = ctx.window.CONTENT[process.argv[2]];
if (process.argv[3] === "expected") console.log(JSON.stringify(C.expected, null, 2));
else process.stdout.write(C.solution);
