#!/usr/bin/env bash
# Хуки Claude Code для «Тетради аналитика».
#
#   check-lesson.sh guard   — PreToolUse (Edit|Write): запрещает править
#                             «Тетрадь аналитика.html» руками — его целиком
#                             собирает build.py; запрещает править файлы
#                             репозитория на main и на ветке, которая уже
#                             слита в main (одна ветка — один PR). Слитость —
#                             по локальному origin/main, без сети.
#   check-lesson.sh check   — PostToolUse (Edit|Write): после правки файла
#                             сайта на JS — node --check; для текстов уроков
#                             и app.js ещё и поиск случайных иероглифов
#                             (U+2E00–U+FEFF): дважды они уже попадали в уроки;
#                             для content-m*.js — checkorder.js: шаги, карточки,
#                             вопросы и тренажёр не сдвинулись относительно main.
#
# На вход — JSON события на stdin. Ошибка проверки: код 2 и причина в stderr,
# её видит Claude и исправляет сразу.
set -u
mode="${1:-check}"
file=$(jq -r '.tool_input.file_path // .tool_response.filePath // empty')
[ -n "$file" ] || exit 0
name=$(basename "$file")

deny() {
  jq -n --arg r "$1" '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny",
    permissionDecisionReason: $r}}'
  exit 0
}

if [ "$mode" = "guard" ]; then
  if [ "$name" = "Тетрадь аналитика.html" ]; then
    deny "«Тетрадь аналитика.html» собирает build.py: правьте исходники (content-*.js, app.js…) и запустите python3 build.py."
  fi
  # Ветка — только для файлов этого репозитория. Принадлежность — через
  # git, а не сравнением строк: в пути проекта есть «й», и macOS отдаёт его
  # то составным символом, то «и» с отдельной краткой. Существующий, но не
  # отслеживаемый git файл (личный план в docs/) править можно где угодно.
  repo="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
  dir=$(dirname "$file")
  while [ ! -d "$dir" ]; do dir=$(dirname "$dir"); done
  top=$(git -C "$dir" rev-parse --show-toplevel 2>/dev/null || true)
  [ -n "$top" ] && [ "$top" = "$(git -C "$repo" rev-parse --show-toplevel 2>/dev/null)" ] || exit 0
  if [ -f "$file" ] && ! git -C "$dir" ls-files --error-unmatch -- "$(basename "$file")" >/dev/null 2>&1; then exit 0; fi
  branch=$(git -C "$repo" branch --show-current 2>/dev/null || true)
  [ -n "$branch" ] || exit 0
  if [ "$branch" = main ]; then
    deny "Это main: правки идут в отдельной ветке — git switch -c <имя> от свежего origin/main (одна ветка — один PR)."
  fi
  branch_re=$(printf '%s' "$branch" | sed 's/[][\.*^$+?(){}|/]/\\&/g')
  merged=$(git -C "$repo" log origin/main --merges -1 --format=%h -E \
           --grep="from [^ /]+/${branch_re}\$" 2>/dev/null || true)
  if [ -n "$merged" ]; then
    deny "Ветка $branch уже слита в main ($merged): новые правки — в новую ветку от свежего origin/main. Незакоммиченное переносится так: git stash; git switch main; git merge --ff-only origin/main; git switch -c <имя>; git stash pop."
  fi
  exit 0
fi

# check: только JS-файлы в корне проекта
case "$name" in
  *.js) ;;
  *) exit 0 ;;
esac
root=$(cd "$(dirname "$0")/../.." && pwd)
[ "$(cd "$(dirname "$file")" 2>/dev/null && pwd)" = "$root" ] || exit 0

if ! out=$(node --check "$file" 2>&1); then
  echo "node --check $name: синтаксическая ошибка — страница не откроется" >&2
  echo "$out" | head -8 >&2
  exit 2
fi

case "$name" in
  content-*.js|app.js|lessons.js|glossary.js)
    bad=$(python3 - "$file" <<'PY'
import sys
s = open(sys.argv[1], encoding="utf-8").read()
hits = []
for n, line in enumerate(s.splitlines(), 1):
    found = sorted({c for c in line if 0x2E00 <= ord(c) <= 0xFEFF})
    if found:
        hits.append(f"строка {n}: {''.join(found)}")
print("\n".join(hits[:5]))
PY
)
    if [ -n "$bad" ]; then
      echo "$name: в тексте иероглифы или другие символы U+2E00–U+FEFF — похоже на случайную вставку:" >&2
      echo "$bad" >&2
      exit 2
    fi
    ;;
esac

case "$name" in
  content-m*.js)
    if ! out=$(node "$root/инструменты/checkorder.js" 2>&1 >/dev/null); then
      echo "$out" >&2
      exit 2
    fi
    ;;
esac
exit 0
