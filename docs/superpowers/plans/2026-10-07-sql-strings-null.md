# Урок «Строки, NULL и UNION» — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** новый SQL-урок `m1l9` (номер 1.3) про `LIKE`, строковые функции, `NULL` и `UNION` на новой таблице `leads` из грязной CRM-выгрузки.

**Architecture:** таблица `leads` объявляется в `shopSQL` и заливается из уже существующего `leadsCSV` (как `app_*`) в трёх копиях: `app.js`, `инструменты/checksteps.js`, `инструменты/mkdb.py`. Урок — обычный объект `window.CONTENT.m1l9` в `content-m1.js` по образцу `m1l1`, в карте курса стоит после `m1l1`. Ссылки «урок 1.N» в текстах сдвигаются вручную.

**Tech Stack:** чистый JS без сборщика, sql.js (SQLite) в браузере, `node:sqlite` и `sqlite3` в проверках, Python 3 для `mkdb.py`/`build.py`.

**Spec:** `docs/superpowers/specs/2026-10-07-sql-strings-null-design.md`

## Global Constraints

- `id` уроков не меняются; в `steps`, `practicum.steps`, `cards`, `quiz`, `drills` существующих уроков ничего не вставляется в середину (`node инструменты/checkorder.js` зелёный).
- Каждое число в тексте урока проверено запуском на учебной базе (`инструменты/shop.db` после `python3 инструменты/mkdb.py`).
- Тон: без восклицаний, каждое утверждение с числом и знаменателем.
- `Тетрадь аналитика.html` руками не правится — его собирает `инструменты/release.sh` во втором коммите.
- Пустая ячейка `leadsCSV` → `NULL`; остальное как есть, `deal_sum` — `TEXT`; у `leads` нет первичного ключа (5 повторов `lead_id`).
- `leads` показывается только в схеме `m1l9` и в песочнице (`SH.leadsSchema`), не в `SH.sqlSchema`.
- Задача урока — города; источники лидов в задаче не сводятся по лидам (это ответ 2.2).
- Коммит и PR — только с согласия владельца курса.

## Review Focus

1. Поле в кавычках с запятой (`"22 250,28"`) — одна ячейка, а не две: иначе у строки 8 столбцов и `INSERT` падает или сдвигает `status`/`manager`. Тест — Task 1, шаг 1 (`deal_sum` у `lead_id = 1001`).
2. Пустая последняя ячейка строки (`manager` в конце) → `NULL`, а не пропуск столбца. Тест — Task 1, шаг 1 (`COUNT(manager) = 50`).
3. Ссылка «урок 1.N» после перенумерации указывает не на тот урок, или задета десятичная дробь («в 1.5 раза», `1.5` в коде). Тест — Task 5, шаги 1 и 4 (список до и после, сверка по id).
4. Ничья в сортировке задачи (Новосибирск и Казань — по 4 лида): ученик с другим порядком при равенстве получит «неверно». Тест — Task 2, `expected.ordered: true` с вторым ключом `city` в эталоне и в тикете.
5. `LOWER` по кириллице в SQLite ничего не делает: подсказка или эталон, опирающиеся на `LOWER(city)`, молча дадут неверные группы. Тест — Task 2, шаг 1 (проверка эталона) и Task 4 (задача тренажёра про `status`).

---

### Task 1: Таблица `leads` в базе

**Files:**
- Modify: `data.js` (в `shopSQL` после `CREATE TABLE app_orders (…);`, строка ~1999)
- Modify: `app.js:2378-2388` (`fillFromCsv`) и `app.js:2402-2413` (`Engine.sql`)
- Modify: `app.js:3979` (`Sandbox.tables`)
- Modify: `инструменты/checksteps.js:96-111`
- Modify: `инструменты/mkdb.py:14-21`
- Modify: `content-core.js` (новый `window.SH.leadsSchema` после `SH.appSchema`, строка ~213)
- Modify: `инструменты/shop.db` (пересобирается)

**Interfaces:**
- Produces: SQL-таблица `leads(lead_id INTEGER, created, source, city, deal_sum, status, manager TEXT)` — 63 строки; функция `csvCells(line) → string[]` в `app.js`; `window.SH.leadsSchema` (HTML-строка).

- [ ] **Шаг 1: проверка, которая сейчас падает**

```bash
python3 инструменты/mkdb.py >/dev/null && sqlite3 инструменты/shop.db \
  "SELECT COUNT(*), COUNT(city), COUNT(manager), COUNT(deal_sum), COUNT(DISTINCT lead_id),
          (SELECT deal_sum FROM leads WHERE lead_id = 1001) FROM leads"
```
Ожидается сейчас: `Error: no such table: leads`. После шага 3: `63|52|50|55|58|22 250,28`.

- [ ] **Шаг 2: объявить таблицу в `shopSQL`** (`data.js`, сразу после `CREATE TABLE app_orders (…);`)

```sql
CREATE TABLE leads (
  lead_id   INTEGER NOT NULL,
  created   TEXT,
  source    TEXT,
  city      TEXT,
  deal_sum  TEXT,
  status    TEXT,
  manager   TEXT
);
```

- [ ] **Шаг 3: заливка в `mkdb.py`** — после цикла по `app*`:

```python
body = re.search(r"\n  leadsCSV: `(.*?)`", s, re.S).group(1)
rows = [r for r in csv.reader(io.StringIO(body))][1:]
rows = [(int(r[0]),) + tuple(v if v != "" else None for v in r[1:7]) for r in rows if r]
con.executemany("INSERT INTO leads VALUES (?,?,?,?,?,?,?)", rows)
print("leads", len(rows))
```
Запустить проверку шага 1 — ожидается `63|52|50|55|58|22 250,28`.

- [ ] **Шаг 4: разбор CSV с кавычками в `app.js`** — перед `fillFromCsv`:

```js
/* строка CSV: поле в кавычках может содержать запятую — "22 250,28" */
function csvCells(line) {
  const out = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch !== '"') cur += ch;
      else if (line[i + 1] === '"') { cur += '"'; i++; }
      else q = false;
    } else if (ch === '"') q = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}
```
В `fillFromCsv` заменить `lines[i].split(",")` на `csvCells(lines[i])`. В `Engine.sql` после `app_orders`:

```js
    /* Выгрузка лидов из CRM (урок 1.3 и 2.2) — грязная нарочно:
       пустая ячейка — NULL, остальное как в выгрузке */
    fillFromCsv(db, window.DATA.leadsCSV,
      "INSERT INTO leads VALUES (?,?,?,?,?,?,?)",
      function (c) { return [+c[0]].concat(c.slice(1, 7).map(function (v) { return v === "" ? null : v; })); });
```

- [ ] **Шаг 5: та же заливка в `инструменты/checksteps.js`** — скопировать `csvCells` (с комментарием `/* копия csvCells из app.js */`), в местном `fillFromCsv` заменить `line.split(",")` на `csvCells(line)` и добавить вызов для `leadsCSV` с тем же `conv`, что в шаге 4.

- [ ] **Шаг 6: `SH.leadsSchema`** в `content-core.js` после `SH.appSchema`:

```js
/* Выгрузка лидов из CRM — урок 1.3 и песочница */
window.SH.leadsSchema = `
<p>Выгрузка <strong>лидов из CRM</strong> отдела продаж: заявки, которые менеджеры заполняли вручную. Поэтому один и тот же источник записан по-разному, у части строк нет города, суммы или менеджера, а суммы хранятся текстом.</p>
<pre><code>leads                        -- 63 строки
  lead_id     INTEGER       -- номер заявки
  created     TEXT          -- дата заявки
  source      TEXT          -- источник: organic, ' Organic', n/a, …
  city        TEXT          -- город: Москва, ' Москва ', москва, СПб, …
  deal_sum    TEXT          -- сумма сделки текстом: 54546.00, 22 250,28
  status      TEXT          -- Новый, НОВЫЙ, в работе, Закрыт, отказ, …
  manager     TEXT          -- фамилия менеджера</code></pre>
<p>Пустая ячейка выгрузки здесь — <code>NULL</code>. <code>LOWER</code>, <code>UPPER</code> и <code>LIKE</code> без учёта регистра в SQLite работают только с латиницей: <code>LOWER('Москва')</code> вернёт <code>'Москва'</code>.</p>
`;
```
Числа в блоке (63 строки) — из шага 1. Проверить, что `CodeKit.parse` разбирает блок: столбцы описаны строками вида `  имя  ТИП  -- описание`, как в `SH.appSchema`.

- [ ] **Шаг 7: песочница видит таблицу** — `app.js:3979`:

```js
  tables: function () { return CodeKit.parse(window.SH.sqlSchema + window.SH.appSchema + window.SH.leadsSchema); },
```

- [ ] **Шаг 8: проверки**

```bash
node --check app.js && node инструменты/checksteps.js m1l1 && node инструменты/checkdrills.js && bash инструменты/ci.sh
```
Ожидается: всё зелёное, кроме «Всё пересобрано» (норма до коммита). В браузере (`python3 инструменты/devserver.py 8781`, `#sandbox`): `SELECT COUNT(*), COUNT(manager) FROM leads` → `63 | 50`; в списке таблиц песочницы есть `leads`.

---

### Task 2: Каркас урока: карта курса, теория, тикет, задача

**Files:**
- Modify: `lessons.js` (уроки модуля 1 — после `m1l1`, строка ~151; `COURSE.skills` — после `sql-join`, строка ~83)
- Modify: `content-m1.js` (новый объект `window.CONTENT.m1l9` сразу после объекта `m1l1`, перед `window.CONTENT.m1l2`)
- Modify: `README.md:111` («14 навыков» → «15 навыков»)

**Interfaces:**
- Consumes: таблица `leads`, `SH.leadsSchema` (Task 1).
- Produces: объект `window.CONTENT.m1l9` с полями `intro, duration, plan, theory, ticket, schema, starter, expected, hints, solution, solutionNote, links`; Task 3 добавит `practicum`, Task 4 — `drills, quiz, cards`.

- [ ] **Шаг 1: эталон задачи на базе**

```bash
sqlite3 инструменты/shop.db "
SELECT CASE
         WHEN city IS NULL THEN 'не указан'
         WHEN TRIM(city) IN ('Москва', 'москва') THEN 'Москва'
         WHEN TRIM(city) IN ('СПб', 'Санкт-Петербург') THEN 'Санкт-Петербург'
         ELSE TRIM(city)
       END AS city,
       COUNT(*) AS leads_cnt,
       COUNT(deal_sum) AS with_sum
FROM leads
GROUP BY 1
ORDER BY leads_cnt DESC, city;"
```
Ожидается ровно:
```
Москва|21|19
Санкт-Петербург|15|13
не указан|11|8
Екатеринбург|8|8
Казань|4|4
Новосибирск|4|3
```
Сумма `leads_cnt` = 63, `with_sum` = 55 — совпадает с Task 1.

- [ ] **Шаг 2: запись в `lessons.js`** после `m1l1`:

```js
        { id: "m1l9", title: "Строки, NULL и UNION", kind: "sql", ready: true,
          desc: "LIKE, TRIM и CASE для грязных строк, IS NULL, COALESCE, NULLIF, UNION",
          say: "«= NULL» никогда не сработает. Это спрашивают в первые пять минут",
          sayTask: "сначала посмотрите все написания города, потом пишите CASE",
          sayDrills: "«Сумма из текста» — CAST молча отрежет всё после пробела" },
```
и навык после `sql-join`:
```js
    { id: "sql-strings", group: "SQL",        title: "Строки и NULL",              lessons: ["m1l9"] },
```
(выравнивание пробелами — как у соседних строк). `README.md:111`: «14 навыков» → «15 навыков».

- [ ] **Шаг 3: объект урока в `content-m1.js`** — по образцу `m1l1` (строки 9–515). Обязательное содержание:
  - `intro` — одна-две фразы: грязные строки и пропуски есть в любой ручной выгрузке; на собеседовании спрашивают `= NULL`, `UNION` и `UNION ALL`.
  - `duration: "≈ 2 часа"`, `plan` — 6 пунктов как у `m1l1` (теория 30 мин, практикум 30, задача 30, тренажёр 30, самопроверка 10, ссылки 5).
  - `theory` — пять разделов из спека («Теория», пункты 1–5), с числами, проверенными на `shop.db`: `LIKE '%_%'` находит все 5 названий событий, с `ESCAPE` — 2 (`add_to_cart` 279, `view_product` 433); `source` — 10 написаний, после `LOWER(TRIM())` — 6 значений и `NULL`; `LOWER('Москва')` = `'Москва'`; `COUNT(*)` = 63 против `COUNT(manager)` = 50, `WHERE manager = NULL` — 0 строк, `IS NULL` — 13; `CAST('22 250,28' AS REAL)` = 22, `CAST(REPLACE(REPLACE(deal_sum, ' ', ''), ',', '.') AS REAL)` = 22250.28; `NULLIF(x, 0)` в знаменателе; `UNION` каналов `users` и источников `leads` — 7 строк, `UNION ALL` — 283 (220 + 63). Мостик: ловушка `NOT IN` с `NULL` — в уроке 1.6. Каждое число перед вставкой пересчитать запросом на `shop.db`.
  - `ticket` — от «Дима, руководитель отдела продаж», тема «Лиды по городам — перед планёркой»: выгрузка из CRM кривая, нужен по каждому городу `city`, `leads_cnt` — сколько лидов, `with_sum` — у скольких указана сумма; города в одном написании (`СПб` — это `Санкт-Петербург`), лиды без города оставить строкой `не указан`; сортировка по `leads_cnt` убыванием, при равенстве — по названию города.
  - `schema: window.SH.sqlSchema + window.SH.leadsSchema`.
  - `starter` — комментарии-подсказки по структуре и `SELECT city, COUNT(*) FROM leads GROUP BY city;` (показывает 9 написаний).
  - `expected: { ordered: true, columns: ["city", "leads_cnt", "with_sum"], rows: [["Москва", 21, 19], ["Санкт-Петербург", 15, 13], ["не указан", 11, 8], ["Екатеринбург", 8, 8], ["Казань", 4, 4], ["Новосибирск", 4, 3]] }`.
  - `hints` (3): 1) сначала посмотрите все написания: `SELECT DISTINCT city FROM leads`, сколько их и какие на самом деле один город; 2) `LOWER` по кириллице здесь не работает, поэтому `TRIM` и `CASE … WHEN TRIM(city) IN (…)`; пустой город — `NULL`, его ловит `WHEN city IS NULL` первым; 3) `COUNT(deal_sum)` пропускает `NULL`, а сортировка — `ORDER BY leads_cnt DESC, city`.
  - `solution` — запрос из шага 1 с комментариями в стиле `m1l1`.
  - `solutionNote` — что понять: смотреть все написания до нормализации; `IS NULL` первым в `CASE`; проверка здравым смыслом: `leads_cnt` в сумме 63, как строк в таблице.
  - `links` — 4–6 ссылок: SQLite `lang_corefunc.html` (строковые функции), SQLite `lang_expr.html#like`, PostgreSQL `functions-string.html`, PostgreSQL `functions-conditional.html` (COALESCE/NULLIF), Mode «SQL UNION», sql-ex.ru — с описаниями в тоне курса.

- [ ] **Шаг 4: проверка задачи**

```bash
node инструменты/checksteps.js m1l9 && node инструменты/checkorder.js && node инструменты/checkskills.js && node инструменты/checkterms.js
```
Ожидается: эталон задачи совпал с `expected`, порядок ключей не сдвинут, карта навыков — 15 навыков без ошибок разметки. Если `checksteps.js` не проверяет основную задачу — проверить её в браузере: `#m1l9`, вставить `solution`, «Проверить» → засчитано.

---

### Task 3: Практикум из шести шагов

**Files:**
- Modify: `content-m1.js` (поле `practicum` в `window.CONTENT.m1l9`, после `schema`)

**Interfaces:**
- Consumes: объект `m1l9` (Task 2), таблицы `events`, `users`, `leads`.

Работать по скиллу `new-practicum` (`.claude/skills/new-practicum/SKILL.md`): формат шага (`title, body, ba, task, starter, expected, hint, solution`), комментарий над `practicum` со сводкой данных, `done`.

- [ ] **Шаг 1: эталоны шагов на базе** — каждый запрос выполнить на `shop.db` и сверить:

| # | Заголовок | Решение | Ожидается |
|---|---|---|---|
| 1 | LIKE: часть слова | `SELECT event_name, COUNT(*) AS events_cnt FROM events WHERE event_name LIKE '%cart%' OR event_name LIKE '%out%' GROUP BY event_name;` | `add_to_cart 279`, `checkout 155` |
| 2 | Подчёркивание — тоже шаблон | `… WHERE event_name LIKE '%\_%' ESCAPE '\' GROUP BY event_name;` (заготовка — `LIKE '%_%'`, даёт все 5) | `add_to_cart 279`, `view_product 433` |
| 3 | TRIM и LOWER: одно написание | `SELECT LOWER(TRIM(source)) AS source, COUNT(*) AS leads_cnt FROM leads GROUP BY 1;` | `NULL 6, email 8, n/a 3, organic 11, paid_search 16, referral 8, social 11` |
| 4 | NULLIF и COALESCE: заглушка — тоже пропуск | `SELECT COALESCE(NULLIF(LOWER(TRIM(source)), 'n/a'), 'не указан') AS source, COUNT(*) AS leads_cnt FROM leads GROUP BY 1;` | `email 8, organic 11, paid_search 16, referral 8, social 11, не указан 9` |
| 5 | = NULL против IS NULL | `SELECT COUNT(*) AS rows_cnt, COUNT(manager) AS with_manager, SUM(manager IS NULL) AS no_manager FROM leads;` (заготовка с `WHERE manager = NULL` даёт 0) | `63, 50, 13` |
| 6 | UNION убирает повторы | `SELECT channel FROM users UNION SELECT COALESCE(NULLIF(LOWER(TRIM(source)), 'n/a'), 'не указан') FROM leads;` (заготовка с `UNION ALL` даёт 283 строки) | 7 строк: `email, organic, paid_search, partner, referral, social, не указан` |

Все шаги — `ordered: false`. Если `checksteps.js` сравнивает `NULL` с пустой строкой (`cellEq` — да), в `expected` шага 3 писать `null`.

- [ ] **Шаг 2: написать шаги** — тексты `body` по одной новой мысли, `ba` («было/стало») на 3–4 строках, `hint` с готовой правкой, как в практикуме `m1l1`. `done`: «Все шесть шагов решены. Основная задача собирает их на городах: `TRIM` → `CASE` с синонимами → `IS NULL` первым → `COUNT(deal_sum)`.»

- [ ] **Шаг 3: проверка**

```bash
node инструменты/checksteps.js m1l9 && node инструменты/checkorder.js
```
Ожидается: 6 шагов практикума и задача совпали с эталонами.

---

### Task 4: Тренажёр, самопроверка, карточки, словарь

**Files:**
- Modify: `content-m1.js` (`drills`, `quiz`, `cards` в `m1l9`)
- Modify: `glossary.js` (термины `like`, `nullif`, `coalesce` — если их нет; у `union` поле `lesson: "m1l4"` → `"m1l9"`)

- [ ] **Шаг 1: тренажёр — 8 задач** (`title, level, body, solution, note`; эталон считается из `solution`):
  1. easy — «Пользователи из городов на „-бург“»: `SELECT city, COUNT(*) AS users_cnt FROM users WHERE city LIKE '%бург' GROUP BY city;`
  2. easy — «Лиды без менеджера по статусам»: `WHERE manager IS NULL`, группировка по `status` как есть.
  3. medium — «Статус в одном написании»: `CASE WHEN status IN ('Новый','НОВЫЙ','новый') THEN 'новый' WHEN status IN ('в работе','В работе') THEN 'в работе' WHEN status IN ('Закрыт','закрыт') THEN 'закрыт' ELSE status END` и `COUNT(*)`; в `note` — почему `LOWER(status)` тут не помогает.
  4. medium — «Сумма из текста»: `SUM(CAST(REPLACE(REPLACE(deal_sum, ' ', ''), ',', '.') AS REAL))`, округление до 2 знаков (ожидается 11 358 798,34 по 55 суммам — пересчитать); `note` — ловушка `CAST('22 250,28' AS REAL)` = 22.
  5. medium — «Отрицательные суммы»: сколько лидов с суммой меньше нуля (4) — после той же очистки.
  6. medium — «Лента активности»: `UNION ALL` событий `purchase` и оплаченных заказов пользователя с колонкой-меткой `kind`, сортировка по дате.
  7. medium — «Доля без деления на ноль»: доля лидов с суммой по менеджерам, `COUNT(deal_sum) * 1.0 / NULLIF(COUNT(*), 0)`, округление до 2.
  8. hard — «Источники, которых нет у пользователей»: нормализованные источники `leads`, которых нет среди `users.channel` (`EXCEPT` или `NOT IN` с отсечением `NULL`); `note` — мостик к ловушке `NOT IN` в 1.6.

- [ ] **Шаг 2: `quiz` — 6 вопросов** (`q, opts, right, why`): `WHERE x = NULL`; `UNION` против `UNION ALL` по числу строк (220 + 63); `_` в `LIKE`; `COUNT(*)` против `COUNT(col)`; `LOWER('Москва')` в SQLite; `NULLIF(a, b)`. Разнести правильные ответы по позициям: `python3 инструменты/balance_quiz.py` (посмотреть его справку в начале файла).

- [ ] **Шаг 3: `cards` — 6 карточек** (`q, a`): `UNION` и `UNION ALL`; `= NULL` и `IS NULL`; `COALESCE` и `NULLIF`; `_` и `%` в `LIKE`; почему `CAST` текста с пробелом опасен; как нормализовать строку (`TRIM` → регистр → синонимы).

- [ ] **Шаг 4: словарь** — `grep -n 'id: "like"\|id: "nullif"\|id: "coalesce"\|id: "trim"' glossary.js`; недостающие добавить по формату из шапки `glossary.js` с `lesson: "m1l9"`, `plain` до 40 слов.

- [ ] **Шаг 5: проверка**

```bash
node инструменты/checkdrills.js && node инструменты/checkcards.js && node инструменты/checkterms.js && node инструменты/checkorder.js
```

---

### Task 5: Сдвиг номеров уроков в текстах

**Files:**
- Modify: `content-m0.js`, `content-m1.js`, `content-m2.js`, `content-m4.js`, `glossary.js`, `lessons.js`, `README.md`, `app.js` — только найденные ссылки на уроки модуля 1.

Соответствие: 1.3 → 1.4 (`m1l2`), 1.4 → 1.5 (`m1l4`), 1.5 → 1.6 (`m1l5`), 1.6 → 1.7 (`m1l6`), 1.7 → 1.8 (`m1l8`), 1.8 → 1.9 (`m1l7`). 1.1 и 1.2 не меняются.

- [ ] **Шаг 1: список кандидатов с контекстом**

```bash
grep -nP '(?<![\d.,])1\.[3-8](?![\d])' content-*.js glossary.js lessons.js app.js README.md \
  | grep -v 'content-m1.js:.*m1l9' > /tmp/renum.txt; wc -l /tmp/renum.txt
```
Сейчас ~70 вхождений; большинство в `content-m3/m5` и `app.js` — числа в данных и коде, не ссылки. Для каждой строки решить: ссылка на урок («урок 1.3», «уроке 1.4», «1.5 —» в заголовке `intro`, «из 1.6») или нет.

- [ ] **Шаг 2: правка** — только ссылки, по соответствию выше, от больших номеров к меньшим (1.8 → 1.9 первым), чтобы не сдвинуть дважды. Заголовки «Урок 1.N — …» внутри самих уроков модуля 1 (`content-m1.js:521, 1569, 2143, 2701, 3237, 3670` и т. п.) тоже сдвигаются.

- [ ] **Шаг 3: фраза в 2.2** — в `content-m2.js` в `solutionNote` урока `m2l2`: «Число городов после нормализации сверьте с уроком 1.3: там те же лиды сведены по городам в SQL — 6 строк вместе с `не указан`.» (до дедупликации; если 2.2 считает после удаления дублей и число другое — сформулировать честно, пересчитав в pandas 2.2 по `ПРОГРЕСС.md`).

- [ ] **Шаг 4: сверка** — повторить grep шага 1; для каждой оставшейся ссылки открыть урок по id и убедиться, что номер в интерфейсе (`l.num`, позиция в `lessons.js`) совпадает с текстом. Отдельно: `grep -n "1\.9" content-*.js glossary.js` — только ссылки на ClickHouse.

---

### Task 6: Полная проверка и ревью

- [ ] **Шаг 1:** `bash инструменты/ci.sh` — всё зелёное, кроме «Всё пересобрано».
- [ ] **Шаг 2: браузер** — `python3 инструменты/devserver.py 8781`, чистый origin (`127.0.0.1:8781` или свободный порт): `#m1l9` открывается с номером 1.3; практикум — все 6 шагов засчитываются по `solution`; задача засчитывается; `#m1l2` показывает номер 1.4; `#skills` — 15 навыков, «Строки и NULL» после JOIN; `#summary-m1` — в пуле вопросы `m1l9` (пройти тест или проверить через `Store`); оглавление модуля 1 — 9 уроков. `node инструменты/browser-check.js`, если есть для урока, иначе Playwright.
- [ ] **Шаг 3: ревью параллельно** — агенты `lesson-reviewer` (диф ветки: id, порядок, числа, тон, номера), `student-walkthrough` (`m1l9` после 1.2), `engine-reviewer` (`csvCells`, заливка, песочница, копия в `checksteps.js`). Исправить найденное, повторить шаг 1.
- [ ] **Шаг 4: коммит содержания** — с согласия владельца: `git add` изменённых файлов (включая `инструменты/shop.db`, без `Тетрадь аналитика.html`), сообщение «Урок 1.3: строки, NULL и UNION на выгрузке лидов» с подписью `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- [ ] **Шаг 5: выпуск и PR** — `bash инструменты/release.sh "урок 1.3 «Строки, NULL и UNION»" --trailer "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`, затем `git push -u origin sql-strings` и `gh pr create --base main` (тело заканчивается строкой `🤖 Generated with [Claude Code](https://claude.com/claude-code)`), владельцу — команды `gh pr checks N --watch` и `gh pr merge N --merge` из `CLAUDE.md`.
