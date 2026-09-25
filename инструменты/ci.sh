#!/usr/bin/env bash
# Проверка курса перед слиянием в main — та же, что запускает GitHub
# (.github/workflows/check.yml). Можно гонять и у себя из корня проекта:
#     bash инструменты/ci.sh
# BASE_REF — ветка, с которой сравнивается PR (на GitHub её подставляет
# workflow; локально по умолчанию main). Падает, если упал хоть один шаг;
# в конце — список упавших шагов простыми словами.
set -u
cd "$(dirname "$0")/.."
BASE_REF="${BASE_REF:-main}"
failed=()

# Шаг: название, пояснение на случай ошибки, команда.
step() {
  local name="$1" hint="$2"; shift 2
  echo "::group::$name"
  if "$@"; then
    echo "::endgroup::"
    echo "✓ $name"
  else
    echo "::endgroup::"
    echo "::error title=$name::$hint"
    echo "✗ $name — $hint"
    failed+=("$name: $hint")
  fi
}

syntax() {
  local ok=0
  for f in app.js sw.js data.js glossary.js lessons.js content-*.js; do
    node --check "$f" || ok=1
  done
  return $ok
}

steps_all() {
  local ids ok=0
  ids=$(node -e '
    const fs = require("fs"), vm = require("vm");
    const c = { window: { SH: {}, CONTENT: {}, DATA: {} } }; vm.createContext(c);
    for (const f of ["data.js", "content-core.js"].concat(fs.readdirSync(".").filter(f => /^content-m\d+\.js$/.test(f)).sort()))
      vm.runInContext(fs.readFileSync(f, "utf8"), c);
    console.log(Object.entries(c.window.CONTENT).filter(([, C]) => C.steps || C.practicum).map(([id]) => id).join(" "));')
  for id in $ids; do
    node инструменты/checksteps.js "$id" || ok=1
  done
  return $ok
}

fig_modules() {
  python3 -c 'import sys; sys.path.insert(0, "инструменты"); import figs; print(" ".join(figs.MODULES))'
}

figs_numbers() {
  local ok=0
  for m in $(fig_modules); do
    python3 инструменты/figs.py "$m" --check || ok=1
  done
  return $ok
}

# Схемы и офлайн-файл собираются заново; если результат отличается от
# того, что лежит в ветке, значит, кто-то забыл пересобрать.
regenerated() {
  for m in $(fig_modules); do
    python3 инструменты/figs.py "$m" >/dev/null || return 1
  done
  python3 build.py >/dev/null || return 1
  git diff --stat --exit-code -- 'content-m*.js' 'Тетрадь аналитика.html'
}

# Файлы сайта изменились — VERSION в sw.js должна быть новой, иначе
# вернувшиеся ученики увидят старый урок из кеша.
version_bumped() {
  git rev-parse --verify -q "origin/$BASE_REF" >/dev/null || git fetch -q origin "$BASE_REF" || return 1
  local changed old new
  changed=$(git diff --name-only "origin/$BASE_REF" -- app.js styles.css index.html data.js glossary.js lessons.js \
            manifest.webmanifest 'content-*.js' fonts)
  if [ -z "$changed" ]; then echo "файлы сайта не менялись"; return 0; fi
  old=$(git show "origin/$BASE_REF:sw.js" | grep -o 'const VERSION = "[^"]*"')
  new=$(grep -o 'const VERSION = "[^"]*"' sw.js)
  echo "изменены: $(echo $changed)"
  echo "было: $old; стало: $new"
  [ "$old" != "$new" ]
}

step "Синтаксис JS" "в одном из файлов сайта синтаксическая ошибка — страница не откроется" syntax
step "Тренажёр" "эталон задачи тренажёра не выполняется (node инструменты/checkdrills.js)" node инструменты/checkdrills.js
step "Карточки" "ошибка в карточках повторения (node инструменты/checkcards.js)" node инструменты/checkcards.js
step "Словарь" "ошибка в словаре терминов (node инструменты/checkterms.js)" node инструменты/checkterms.js
step "Шаги уроков" "решение шага урока 0.1, 0.2 или практикума не даёт ожидаемый ответ (node инструменты/checksteps.js <урок>)" steps_all
step "Схемы" "метка схемы без схемы, нет описания для диктора или цвет задан напрямую (node инструменты/checkfigs.js)" node инструменты/checkfigs.js
step "Числа на схемах" "числа на схемах разошлись с базой (python3 инструменты/figs.py <модуль> --check)" figs_numbers
step "Всё пересобрано" "схемы или офлайн-файл не пересобраны: запустите python3 инструменты/figs.py <модуль> и python3 build.py и закоммитьте результат" regenerated
step "Версия сайта" "файлы сайта изменились, а VERSION в sw.js прежняя — поднимите её, иначе ученики увидят старый кеш" version_bumped

echo
if [ ${#failed[@]} -eq 0 ]; then
  echo "Все проверки пройдены."
else
  echo "Не пройдено: ${#failed[@]}"
  printf ' — %s\n' "${failed[@]}"
  exit 1
fi
