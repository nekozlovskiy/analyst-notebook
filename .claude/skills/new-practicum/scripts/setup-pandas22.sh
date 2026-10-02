#!/usr/bin/env bash
# Окружение с pandas 2.2 — как в браузере (Pyodide 0.26). Системный python
# новее, и pandas 2.2.3 на нём падает, поэтому берём Python 3.12 через uv.
#
#   bash .claude/skills/new-practicum/scripts/setup-pandas22.sh ~/.cache/analyst-notebook
#   → ~/.cache/analyst-notebook/v312/bin/python
#
# Эту папку в начале каждой сессии готовит хук .claude/hooks/pandas22.sh,
# и окружение переживает сессии. Готово, когда есть v312/.pandas22-ok:
# python в папке появляется в первую секунду, pandas — позже, а оборванная
# установка без отметки пересоздаётся. Одновременно папку ставит только
# одна установка (замок .lock); брошенный замок старше 15 минут снимается.
set -eu
dir="${1:?укажите папку для окружения}"
ok="$dir/v312/.pandas22-ok"
lock="$dir/.lock"
mkdir -p "$dir"
if [ ! -f "$ok" ]; then
  waited=0
  while ! mkdir "$lock" 2>/dev/null; do
    if [ -n "$(find "$lock" -maxdepth 0 -mmin +15 2>/dev/null)" ]; then
      rmdir "$lock" 2>/dev/null || true; continue        # брошен оборванной установкой
    fi
    [ -f "$ok" ] && break                                 # другая установка закончила
    [ $waited = 1 ] || echo "окружение уже ставит другая сессия — жду" >&2
    waited=1
    sleep 2
  done
  if [ ! -f "$ok" ]; then
    trap 'rmdir "$lock" 2>/dev/null || true' EXIT
    uv venv -q --clear --python 3.12 "$dir/v312"
    uv pip install -q --python "$dir/v312/bin/python" "pandas==2.2.3" "numpy<2.3"
    touch "$ok"
  fi
fi
"$dir/v312/bin/python" -c "import sys, pandas; print(sys.version.split()[0], 'pandas', pandas.__version__)"
echo "$dir/v312/bin/python"
