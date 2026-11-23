#!/usr/bin/env node
/* Графики урока 2.5: паспорта из того же кода, что работает в браузере. */
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { execFileSync } = require("node:child_process");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const c = { window: {}, console };
vm.createContext(c);
const read = name => fs.readFileSync(path.join(root, name), "utf8");
for (const file of ["data.js", "content-core.js", "content-m2.js"])
  vm.runInContext(read(file), c, { filename: file });

const app = read("app.js");
for (const [name, end] of [["PLOT_PY", '].join("\\n");'], ["Check", "\n};"], ["Drills", "\n};"]]) {
  const start = app.indexOf("const " + name + " =");
  const stop = app.indexOf(end, start);
  vm.runInContext(app.slice(start, stop + end.length) + "\nthis." + name + " = " + name, c);
}

const lesson = c.window.CONTENT.m2l5;
const references = lesson.practicum.steps.filter(s => s.expected.plot).map(s => s.solution);
references.push(lesson.solution);
references.push(...lesson.drills.filter(d => c.Drills.kind({ kind: "python" }, d) === "plot").map(c.Drills.code));
const data = lesson.data.map(key => key + " = " + JSON.stringify(c.window.DATA[key])).join("\n");
const script = [
  c.PLOT_PY, data, lesson.prelude,
  "import _nb_plots",
  "sources = " + JSON.stringify(references),
  "for source in sources:",
  "    _nb_plots.reset()",
  "    exec(source, globals().copy())",
  "    print(_nb_plots.collect())"
].join("\n");
const output = execFileSync("python3", ["-"], { input: script, encoding: "utf8", maxBuffer: 32 << 20 });
const figs = output.trim().split("\n").map(JSON.parse);
assert.equal(figs.length, references.length);
for (const [i, reference] of figs.entries())
  assert.equal(c.Check.plot(reference, reference).ok, true, "Эталон графика " + (i + 1));

const line = figs.find(ref => ref[0].axes[0].lines.length);
const bars = figs.find(ref => c.Check.plotKind(ref[0].axes[0]) === "barh");
const hist = figs.find(ref => c.Check.plotKind(ref[0].axes[0]) === "hist");
const grid = figs.find(ref => ref[0].axes.length > 1);

function scenario(reference, edit, want) {
  const candidate = structuredClone(reference);
  edit(candidate[0].axes);
  const result = c.Check.plot(candidate, reference);
  if (want) {
    assert.equal(result.ok, false, want);
    assert.match(result.why, want);
  } else assert.equal(result.ok, true, result.why);
}

scenario(line, axes => { axes[0].lines[0].x[0] = "2023-01"; }, /периоды/);
scenario(line, axes => { axes[0].lines[0].x = axes[0].lines[0].x.map(x => x.slice(0, 7)); });
scenario(line, axes => { axes[0].lines.push(axes[0].lines[0]); }, /число линий/);
scenario(bars, axes => { axes[0].ylabels.forEach(t => { t[1] = "другой канал"; }); }, /категорий/);
scenario(bars, axes => { axes[0].ylim.reverse(); }, /порядке/);
scenario(bars, axes => { axes[0].bars.reverse(); });
scenario(hist, axes => { axes[0].bars.forEach(b => { b.x += 100; }); }, /границы/);
scenario(grid, axes => { axes[1].ylim[1] += 10; }, /масштаб/);
scenario(grid, axes => { axes[1].title = "другой канал"; }, /название канала/);
console.log("Эталонов графиков: " + figs.length + ", сценариев проверки: 9.");
