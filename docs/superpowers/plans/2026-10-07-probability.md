# Урок 3.1 «Вероятность» — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** новый Python-урок `m3l9` первым в модуле 3: условная вероятность, Байес, «хотя бы один», комбинаторика, матожидание — каждое правило формулой и симуляцией.

**Architecture:** объект `window.CONTENT.m3l9` в `content-m3.js` перед `m3l2`, пролог `SH.statsDataPrelude`; запись в `lessons.js` первой в модуле 3; сдвиг ссылок 3.1–3.8 → 3.2–3.9.

**Tech Stack:** Pyodide (pandas 2.2), локально pandas 3 и 2.2; `checksteps.js`, `practicum_check.py`, `checkdrills.js`.

**Spec:** `docs/superpowers/specs/2026-10-07-probability-design.md`

## Global Constraints

- id не меняются; в существующих уроках новое — только в конец массивов.
- Каждое число — из запуска на прологе урока в pandas 3 и 2.2; текстовые Series не печатать.
- Симуляции — `random.Random(seed)`, без numpy-генераторов.
- Тон без восклицаний, числа со знаменателем; в заготовках — комментарий вместо `...`.
- Коммит и PR — с согласия владельца.

## Review Focus

1. Ссылка «урок 3.N» после сдвига указывает не на тот урок или задета дробь (`3.5%`, `0.3`) — Task 4.
2. Переход «в следующем уроке» в начале ЦПТ и «в прошлом уроке» в ДИ теперь неверны — Task 4.
3. Результат симуляции зависит от порядка вызовов `rnd.random()`: заготовка и решение должны вызывать генератор одинаково — Task 2 и 3.
4. Деление целых и округление `:.1f`/`:.3f` на пятёрке дают разное в 2.2 и 3 — сравнение вывода побайтно в Task 2 и 3.
5. Матожидание и комбинаторика не должны опираться на непройденный numpy — только `math` и списки.

---

### Task 1: Каркас урока и задача
- [ ] RED: `checksteps.js m3l9` — урока нет.
- [ ] `lessons.js` (первым в m3, навык `stat-tests`), объект урока: intro, plan, `math: true`, теория (6 разделов спека), тикет антифрода, schema, `data: window.SH.pyData`, `packages` как у `m3l2`, `prelude: window.SH.statsDataPrelude`, starter, `expected.stdout`, 3 подсказки, solution, solutionNote, links (проверить, что ссылки открываются).
- [ ] Решение задачи в pandas 3 и 2.2 — вывод совпадает с `expected` побайтно.

### Task 2: Практикум (7 шагов)
- [ ] По скиллу `new-practicum`; числа — из запуска; `ba` — настоящие строки данных.
- [ ] `checksteps.js m3l9`; `practicum_check.py m3l9` на обеих версиях.

### Task 3: Тренажёр, quiz, карточки, словарь
- [ ] 5 задач (формула + симуляция), `checkdrills.js`.
- [ ] 6 вопросов, 6 карточек, 3 термина; `checkcards.js`, `checkterms.js`, `checkskills.js`.

### Task 4: Сдвиг номеров модуля 3
- [ ] grep `(?<![\d.,])3\.[1-8](?![\d])` по content, glossary, lessons, README, ПРОГРЕСС, app.js, инструменты — разбор по смыслу, сдвиг от 3.8 вниз к 3.1; переходы «следующий/прошлый урок».
- [ ] Повторный grep и сверка; `checkorder.js`.

### Task 5: Проверка и выпуск
- [ ] `ci.sh`; браузер (390 px) — все шаги и задача, время; `#m3l2` — номер 3.2.
- [ ] `lesson-reviewer` и `student-walkthrough`; правки; повтор проверок.
- [ ] С согласия — коммит, `release.sh`, PR.
