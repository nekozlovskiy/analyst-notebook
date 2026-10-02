#!/usr/bin/env bash
# Выпуск ветки: новая VERSION в sw.js, сборка офлайн-файла, коммит
# «<что>: выпуск <версия>» и полная проверка ci.sh.
#
#   bash инструменты/release.sh "Практикум 3.4" --trailer "Co-Authored-By: …" --trailer "…"
#   bash инструменты/release.sh --dry-run        # только проверить и посчитать версию
#
# Содержание уже закоммичено в текущей ветке. Скрипт:
#   1. не работает на main, на уже слитой ветке и с незакоммиченными
#      правками; след прошлого ci.sh в «Тетрадь аналитика.html» откатывает сам;
#   2. останавливается, если открыт другой PR, который меняет sw.js:
#      две новые VERSION поверх одной старой — конфликт;
#   3. переносит ветку на свежий origin/main, если её ещё нет на GitHub;
#      свой прошлый коммит выпуска перед этим убирает — он пересоберётся;
#   4. ставит VERSION: сегодняшняя дата и следующая буква после версии
#      в main, в новый день — буква a;
#   5. собирает офлайн-файл, коммитит sw.js и сборку, гоняет ci.sh.
# Повторный запуск в тот же день версию не сдвигает. Push и PR — дальше
# руками: описание PR пишет человек.
set -euo pipefail
script="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"
cd "$(dirname "$script")/.."

die()  { echo "✗ $*" >&2; exit 1; }
note() { echo "• $*"; }
HTML="Тетрадь аналитика.html"

what="" dry=0 pr_unchecked=""
trailers=()
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) dry=1 ;;
    --trailer) [ $# -ge 2 ] || die "после --trailer нужен текст"; trailers+=(--trailer "$2"); shift ;;
    -h|--help) awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$script"; exit 0 ;;
    -*) die "неизвестный флаг $1" ;;
    *) what="$1" ;;
  esac
  shift
done
[ $dry = 1 ] || [ -n "$what" ] || die 'укажите, что выпускаем: bash инструменты/release.sh "Практикум 3.4"'

# ---- 1. ветка и рабочее дерево ----
branch=$(git branch --show-current)
[ -n "$branch" ] || die "HEAD не на ветке — переключитесь на ветку выпуска"
[ "$branch" != main ] || die "это main — выпуск делается из своей ветки"
git fetch -q origin || die "git fetch не прошёл — нет связи с GitHub?"
branch_re=$(printf '%s' "$branch" | sed 's/[][\.*^$+?(){}|/]/\\&/g')
merged=$(git log origin/main --merges -1 --format=%h -E --grep="from [^ /]+/${branch_re}\$" || true)
[ -z "$merged" ] || die "ветка $branch уже слита в main ($merged) — для нового выпуска нужна новая ветка от main"
[ "$(git rev-list --count origin/main..HEAD)" -gt 0 ] || die "в ветке нет коммитов поверх main — сначала закоммитьте содержание"

if ! git diff --quiet -- "$HTML"; then
  if [ $dry = 1 ]; then note "«${HTML}» изменён — след ci.sh, при выпуске будет откачен"
  else git checkout -q -- "$HTML"; note "откатил след ci.sh в «${HTML}»"; fi
fi
dirty=$(git -c core.quotepath=false status --porcelain --untracked-files=no -- . ":(exclude)$HTML")
[ -z "$dirty" ] || die "есть незакоммиченные правки — закоммитьте содержание или уберите их:
$dirty"

# ---- 2. другие открытые PR с sw.js ----
if command -v gh >/dev/null 2>&1; then
  branch_jq=$(printf '%s' "$branch" | sed 's/"/\\"/g')
  if others=$(gh pr list --state open --json number,headRefName,files \
      -q ".[] | select(.headRefName != \"$branch_jq\") | select(any(.files[]; .path == \"sw.js\")) | \"#\(.number) \(.headRefName)\"" 2>/dev/null); then
    [ -z "$others" ] || die "открыт другой PR с новой VERSION — сначала его слить:
$others"
  else
    pr_unchecked="не удалось спросить GitHub про открытые PR — проверьте сами: gh pr list --state open"
  fi
else
  pr_unchecked="gh не установлен — проверьте открытые PR сами"
fi
[ -z "$pr_unchecked" ] || note "$pr_unchecked"

# ---- 3. перенос на свежий main ----
# свой прошлый коммит выпуска — последний в ветке? В нём только sw.js и,
# если между выпусками менялось содержание, сборка.
last_is_release=0
case "$(git log -1 --format=%s)" in
  *": выпуск "[0-9]*)
    extra=$(git -c core.quotepath=false diff --name-only HEAD~1 HEAD | grep -vxF -e sw.js -e "$HTML" || true)
    [ -n "$extra" ] || last_is_release=1 ;;
esac
if git merge-base --is-ancestor origin/main HEAD; then
  note "ветка уже стоит на свежем main"
elif git rev-parse -q --verify "refs/remotes/origin/$branch" >/dev/null; then
  die "ветка отстала от main, но уже лежит на GitHub — перенос перепишет историю; сделайте git rebase origin/main и git push --force-with-lease сами"
elif [ $dry = 1 ]; then
  note "ветка отстала от main — при выпуске будет перенесена (git rebase origin/main)"
  [ $last_is_release = 0 ] || note "прошлый коммит выпуска будет убран и собран заново"
else
  if [ $last_is_release = 1 ]; then
    git reset -q --hard HEAD~1
    note "убрал прошлый коммит выпуска — main ушёл вперёд, версия и сборка будут новыми"
  fi
  git rebase -q origin/main || { git rebase --abort; die "конфликт при переносе на main — разберитесь руками (git rebase origin/main)"; }
  note "перенёс ветку на свежий main"
fi

# ---- 4. версия ----
ver() { sed -n 's/^const VERSION = "\(.*\)";$/\1/p'; }
base=$(git show origin/main:sw.js | ver)
cur=$(ver < sw.js)
today=$(date +%F)
case "$base" in
  [0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][a-z]) ;;
  *) die "в main у sw.js непонятная VERSION: «${base}»" ;;
esac
bday=${base%?}
blet=${base#"$bday"}
if [ "$bday" = "$today" ]; then
  [ "$blet" != z ] || die "в main уже версия ${base}: букв за сегодня больше нет"
  new="$today$(printf '%s' "$blet" | tr 'a-y' 'b-z')"
elif [[ "$bday" < "$today" ]]; then
  new="${today}a"
else
  die "в main версия из будущего (${base}), а сегодня $today — проверьте часы"
fi
note "VERSION: в main $base, в ветке $cur, станет $new"

if [ $dry = 1 ]; then
  echo "✓ к выпуску готово (проверка без изменений)"
  [ -z "$pr_unchecked" ] || echo "  но: $pr_unchecked"
  exit 0
fi

# ---- 5. сборка, коммит, проверка ----
perl -pi -e 's/^const VERSION = ".*";$/const VERSION = "'"$new"'";/' sw.js
[ "$(ver < sw.js)" = "$new" ] || die "не удалось записать VERSION в sw.js"
python3 build.py >/dev/null
git add sw.js "$HTML"
if git diff --cached --quiet; then
  note "выпуск уже закоммичен — коммитить нечего"
else
  git commit -q -m "$what: выпуск $new" ${trailers[@]+"${trailers[@]}"}
  note "коммит: $(git log -1 --format=%s)"
fi

tmp="${TMPDIR:-/tmp}"
log=$(mktemp "${tmp%/}/release-ci.XXXXXX")
if bash инструменты/ci.sh >"$log" 2>&1; then
  grep -E '^(✓|✗) ' "$log" || true
  echo "✓ ci.sh: все проверки пройдены (полный вывод: $log)"
else
  grep -E '^(✓|✗) |^ — ' "$log" || true
  die "ci.sh упал — полный вывод: $log"
fi

[ -z "$pr_unchecked" ] || echo "! $pr_unchecked"
cat <<EOF

Дальше:
  git push -u origin $branch
  gh pr create --base main --title "…" --body "…"
После открытия PR — команды владельцу:
  gh pr checks N --watch -R nekozlovskiy/analyst-notebook
  gh pr merge N --merge -R nekozlovskiy/analyst-notebook
EOF
