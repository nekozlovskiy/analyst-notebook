#!/usr/bin/env bash
# Окружение с pandas 2.2 — как в браузере (Pyodide 0.26). Системный python
# новее, и pandas 2.2.3 на нём падает, поэтому берём Python 3.12 через uv.
#
#   bash .claude/skills/new-practicum/scripts/setup-pandas22.sh <папка>
#   → <папка>/v312/bin/python
#
# Папку лучше брать во временном каталоге сессии (scratchpad), не в проекте.
set -eu
dir="${1:?укажите папку для окружения}"
mkdir -p "$dir"
if [ ! -x "$dir/v312/bin/python" ]; then
  uv venv -q --python 3.12 "$dir/v312"
  uv pip install -q --python "$dir/v312/bin/python" "pandas==2.2.3" "numpy<2.3"
fi
"$dir/v312/bin/python" -c "import sys, pandas; print(sys.version.split()[0], 'pandas', pandas.__version__)"
echo "$dir/v312/bin/python"
