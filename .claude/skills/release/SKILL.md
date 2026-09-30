---
name: release
description: Выпустить готовую ветку «Тетради аналитика» — rebase на main, новая VERSION, сборка, коммит «выпуск», ci.sh, push, PR в main и команды слияния для владельца.
disable-model-invocation: true
argument-hint: "[что выпускаем, например «Практикум 3.4»]"
---

# Выпуск ветки

Выпускаем: $ARGUMENTS. Содержание уже закоммичено в текущей ветке одним или
несколькими коммитами; здесь — только выпуск.

1. **Проверить, что предыдущий PR слит.** `gh pr list --state open -R nekozlovskiy/analyst-notebook`.
   Если открыт PR, который тоже меняет `sw.js` и сборку, — остановиться и
   попросить владельца его слить: иначе конфликт версий.
2. **Подтянуть main и переставить ветку:**

       git fetch -q origin && git switch -q main && git merge -q --ff-only origin/main
       git switch -q <ветка> && git rebase main

3. **Новая версия.** В `sw.js` `const VERSION = "ГГГГ-ММ-ДДx"`: сегодняшняя
   дата и следующая буква после той, что в main (если дата новая — `a`).
4. **README.** Если выпускается практикум — урок должен быть в списке
   «сейчас он есть в …».
5. **Сборка и коммит выпуска:**

       python3 build.py
       git add sw.js "Тетрадь аналитика.html" README.md
       git commit -m "<что>: выпуск <версия>"   # с подписью Co-Authored-By из системных указаний

6. **Проверка:** `bash инструменты/ci.sh` — все шаги зелёные.
7. **PR в main**, не стопкой: `git push -u origin <ветка>`, затем
   `gh pr create --base main`. В описании: что сделано по шагам, числа,
   находки по дороге, `VERSION`, чем проверено; в конце — подпись из
   системных указаний.
8. **Отдать владельцу команды слияния** — он просил давать их каждый раз:

       gh pr checks N --watch -R nekozlovskiy/analyst-notebook
       gh pr merge N --merge -R nekozlovskiy/analyst-notebook
