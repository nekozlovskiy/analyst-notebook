#!/usr/bin/env bash
# SessionStart: окружение с pandas 2.2 — как в браузере (Pyodide) — в
# постоянной папке ~/.cache/analyst-notebook, чтобы не собирать его заново
# в каждой сессии. Ставится в фоне и только если его ещё нет; без uv —
# ничего не делает. Замок от двух одновременных установок и снятие
# брошенного замка — в setup-pandas22.sh. Готово, когда есть
# ~/.cache/analyst-notebook/v312/.pandas22-ok; журнал — setup.log рядом.
dir="$HOME/.cache/analyst-notebook"
[ -f "$dir/v312/.pandas22-ok" ] && exit 0
command -v uv >/dev/null 2>&1 || exit 0
mkdir -p "$dir"
setup="$(cd "$(dirname "$0")/../skills/new-practicum/scripts" && pwd)/setup-pandas22.sh"
( nohup bash "$setup" "$dir" >>"$dir/setup.log" 2>&1 & ) >/dev/null 2>&1
exit 0
