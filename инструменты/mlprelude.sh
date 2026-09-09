#!/bin/sh
# Печатает пролог модуля 5 для локального прогона:
# appprelude.py (читает CSV из data.js) + часть mlPrelude после appPrelude.
cd "$(dirname "$0")/.."
cat инструменты/appprelude.py
node -e '
const fs=require("fs"),vm=require("vm");
const ctx={window:{SH:{},CONTENT:{}},console};vm.createContext(ctx);
vm.runInContext(fs.readFileSync("content-core.js","utf8"),ctx);
process.stdout.write(ctx.window.SH.mlPrelude.slice(ctx.window.SH.appPrelude.length));
'
