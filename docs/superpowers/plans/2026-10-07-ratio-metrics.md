# Урок 3.7 «Ratio-метрики и CUPED» — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** новый Python-урок `m3l8` (номер 3.7, перед проектом) про ratio-метрики в A/B: наивный тест по заказам, бутстрап по пользователям, дельта-метод, CUPED.

**Architecture:** данные — детерминированный генератор `SH.ratioPrelude` в `content-core.js` (как `SH.abPrelude`); урок — объект `window.CONTENT.m3l8` в `content-m3.js` по образцу Python-уроков модуля 3; в карте курса после `m3l6`.

**Tech Stack:** Pyodide (pandas 2.2 в браузере), локально pandas 3 и 2.2 (`~/.cache/analyst-notebook/v312/bin/python`), `инструменты/checksteps.js` / `practicum_check.py` / `checkdrills.js`.

**Spec:** `docs/superpowers/specs/2026-10-07-ratio-metrics-design.md`

## Global Constraints

- `id` уроков не меняются; в существующих уроках новое — только в конец массивов (`checkorder.js` зелёный).
- Каждое число в тексте урока — из запуска на прологе урока в pandas 3 и 2.2.
- Текстовые Series не печатать; вывод — числа, f-строки, `.tolist()`.
- В генераторе только `random()` из `random.Random(seed)` и `math`.
- Тон: без восклицаний, числа со знаменателем. В заготовках — комментарий вместо `...`.
- Коммит и PR — только с согласия владельца.

## Review Focus

1. Разные числа в pandas 2.2 и 3 (агрегации, `ddof`, округление `:.2f` на пятёрке) — Task 1 шаг 3 и Task 3 шаг 3 гоняют обе версии.
2. Время в Pyodide: генератор + бутстрап + A/A-симуляция дольше 10 секунд — Task 6 шаг 2 замеряет.
3. Недетерминизм генератора между версиями Python — Task 1 шаг 3 сравнивает вывод двух интерпретаторов побайтно.
4. Ссылка «3.7», которая была про проект, осталась старой, или задета дробь — Task 5.
5. Целевые свойства данных (z наивный > 1,96 > z дельта, A/A 15–25% против 3–7%, ρ ≥ 0,6) не выполняются после правок — Task 1 шаг 2 — проверочный скрипт, который запускается и в конце.

---

### Task 1: Генератор `SH.ratioPrelude`

**Files:** Modify `content-core.js` (после `SH.abPrelude`); scratch-скрипт проверки `ratio_check.py`.

- [ ] **Шаг 1 (RED):** `ratio_check.py` берёт пролог через `node .claude/skills/new-practicum/scripts/prelude.js`-подобную выдачу (или читает `window.SH.ratioPrelude` из `content-core.js` через node) и проверяет целевые свойства спека; запустить — падает: пролога нет.
- [ ] **Шаг 2:** дописать `window.SH.ratioPrelude` = `warnings`/`pandas` + `SH.statsPrelude` + `_build_ratio()` по прототипу (scratchpad `ratio/gen.py`, вариант с тремя периодами до теста): уровень чека `2500·exp(U·1.6−0.8)`, склонность покупать — смесь 0 / 0,6 / 2,2 заказа за период, пуассон через произведение равномерных, `pre_revenue` за три периода, эффект на чек в тесте. Подобрать зерно, `n` и эффект так, чтобы проверка шага 1 прошла.
- [ ] **Шаг 3:** прогнать проверку в pandas 3 и в pandas 2.2 — вывод совпадает побайтно.

### Task 2: Каркас урока

**Files:** `lessons.js` (урок после `m3l6`, `m3l8` в навык `ab` между `m3l6` и `m3l7`), `content-m3.js` (объект `m3l8` перед `m3l7`).

- [ ] **Шаг 1 (RED):** `node инструменты/checksteps.js m3l8` — урока нет.
- [ ] **Шаг 2:** запись в `lessons.js` (`kind: "python"`, `fast: false`, `desc`, `say`, `sayTask`, `sayDrills`), навык.
- [ ] **Шаг 3:** объект урока: `intro`, `duration`, `math: true`, `plan`, `theory` (четыре раздела спека, формулы в `\\(…\\)` как в 3.7-проекте), `ticket` (продакт, апселл в корзине), `schema` (описание `exp_users` / `exp_orders`), `data: []`, `packages: ["pandas"]`, `prelude: window.SH.ratioPrelude`, `starter`, `expected: { stdout }`, `hints` (3), `solution`, `solutionNote`, `links`. Числа теории и эталона — из запуска.
- [ ] **Шаг 4:** решение задачи — через `prelude.js m3l8` + `solution` в pandas 3 и 2.2, вывод совпадает с `expected.stdout`; `checkorder.js`, `checkskills.js`.

### Task 3: Практикум

- [ ] **Шаг 1:** по скиллу `new-practicum`: 7 шагов на A/A-разбиении контроля по чётности `user_id` (средний чек → наивная SE → по пользователям → бутстрап (B ≤ 500, `np.random.default_rng`) → дельта-метод → θ → SE после CUPED), `ba`, `hint`, `done`, `expected.uses` где ответ можно получить без приёма.
- [ ] **Шаг 2:** `checksteps.js m3l8`, `practicum_check.py m3l8` и с `--python ~/.cache/analyst-notebook/v312/bin/python` — решения проходят, заготовки нет.

### Task 4: Тренажёр, quiz, карточки, словарь

- [ ] **Шаг 1:** 5 задач (`title`, `level` easy/mid/hard, `body`, `solution`, `note`) из спека; `checkdrills.js`.
- [ ] **Шаг 2:** 6 вопросов (`right` с нуля, позиции вразнобой), 6 карточек; термины `ratio-metric`, `delta-method`, `cuped` в `glossary.js` с `lesson: "m3l8"`; `checkcards.js`, `checkterms.js`.

### Task 5: Номер проекта 3.7 → 3.8

- [ ] **Шаг 1:** `grep -nP '(?<![\d.,])3\.[7](?![\d])'` по `content-*.js glossary.js lessons.js README.md ПРОГРЕСС.md app.js инструменты/*.py` — каждую строку по смыслу; ссылки на проект → 3.8.
- [ ] **Шаг 2:** повторный grep; `checkorder.js`.

### Task 6: Проверка и выпуск

- [ ] **Шаг 1:** `bash инструменты/ci.sh` — красные только «Всё пересобрано» и «Версия сайта».
- [ ] **Шаг 2:** браузер на чистом origin, 390 px: `browser-check.js` для `m3l8` (все шаги и задача), время первого запуска (генератор + Pyodide) и самого долгого шага; `#m3l7` показывает 3.8; итоговый тест модуля 3.
- [ ] **Шаг 3:** `lesson-reviewer` и `student-walkthrough` параллельно; правки; повтор шага 1.
- [ ] **Шаг 4:** с согласия — коммит содержания, `release.sh "Урок 3.7 «Ratio-метрики и CUPED»" --trailer "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`, push, PR в `main`.
