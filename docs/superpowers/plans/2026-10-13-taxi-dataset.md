# «Дельта Такси» и урок 6.4 «Чужая схема: такси» — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** вторая учебная база «Дельта Такси» (`riders`, `drivers`, `trips`) в отдельном `data-taxi.js`, которую движок подгружает по требованию, и SQL-урок `m6l8` «Чужая схема: такси» на ней.

**Architecture:** генератор `инструменты/gen_taxi.py` пишет `data-taxi.js` (DDL + три CSV). В app.js объект `Taxi` с чистой функцией `Taxi.wants(code)` (есть ли в запросе таблица такси); `Engine.sql(code)` при `wants` грузит `data-taxi.js` и один раз дописывает таблицы в ту же базу sql.js. `mkdb.py` кладёт такси в `shop.db`, поэтому все существующие проверки SQL работают без изменений.

**Tech Stack:** чистый JS, sql.js в браузере, Python 3 (генератор, mkdb), sqlite3, Playwright (ручная проверка).

**Spec:** `docs/superpowers/specs/2026-10-13-taxi-dataset-design.md`

## Global Constraints

- `id` уроков не меняются; новые массивы — у нового урока; `node инструменты/checkorder.js` зелёный.
- Каждое число в тексте урока — запуском на `инструменты/shop.db` (после `mkdb.py` с такси).
- Тон: без восклицаний, число и знаменатель; на «вы».
- Цвета только переменными (новых стилей в плане нет).
- Коммитов по задачам нет: один PR = коммит содержания + коммит выпуска `bash инструменты/release.sh "<что>" --trailer "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`, оба с согласия владельца. Спек и план — отдельными коммитами (уже).
- `Тетрадь аналитика.html` не править; после `ci.sh` — `git checkout -- "Тетрадь аналитика.html"`.
- Бюджет: `data-taxi.js` не больше 450 КБ (поправка к спеку: 4 000 заказов и 1 200 пассажиров дают 420 КБ; `dropoff_at` заменён на `ride_min` — длительность поездки в минутах; время строкой остаётся в `requested_at` и `pickup_at`).
- Практикум пишется по скиллу `new-practicum` (CLAUDE.md), правила — память «Правила практикумов»: данные шагов отличаются от данных задачи, ревью параллельно.

## Review Focus

1. Урок модуля 1–5 не должен качать `data-taxi.js`: запросы без `trips`/`drivers`/`riders` его не трогают (Task 3, проверка в браузере по сетевым запросам).
2. Слово `trips` в комментарии или строке запроса (`-- trips`) — лишняя подгрузка допустима, ошибка — нет (Task 3, сценарий `Taxi.wants` в `checktaxi.js`).
3. Два запроса к такси одновременно (прогрев + «Запустить») — таблицы заливаются один раз, без «table trips already exists» (Task 3, `Engine.taxiReady` — общий промис; проверка двойным запуском в браузере).
4. Нет интернета и нет сохранённого курса — запрос к такси даёт понятное сообщение, а не зависание (Task 3, ошибка `loadScript` → текст «База такси не загрузилась — похоже, пропал интернет.»).
5. Офлайн-файл: такси встроено, запрос к `trips` работает с `file://` (Task 3, `LAZY` в build.py; Playwright по `file://`).

---

### Task 1: Генератор и `data-taxi.js`

**Files:**
- Create: `инструменты/gen_taxi.py`, `data-taxi.js` (результат)
- Modify: `инструменты/ci.sh` (шаг «База такси»), `docs/superpowers/specs/2026-10-13-taxi-dataset-design.md` (бюджет и `ride_min` — поправка)

**Interfaces:**
- Produces: `window.DATA.taxiSQL`, `window.DATA.taxiRidersCSV`, `window.DATA.taxiDriversCSV`, `window.DATA.taxiTripsCSV` в `data-taxi.js`; столбцы `trips`: `trip_id, rider_id, driver_id, city, tariff, requested_at, pickup_at, ride_min, status, distance_km, price, surge, rider_rating`.

- [ ] **Step 1:** Скопировать в `инструменты/gen_taxi.py` черновик, прогнанный при планировании (`<scratchpad>/gen_taxi.py` этой сессии; ключевые параметры: `random.Random(2024)`, `N_RIDERS, N_TRIPS = 1200, 4000`, водителей 150/75/75, треть водителей Екатеринбурга уходит в марте, `HOUR_W` с пиками 8–9 и 18–20, `FARE` econom 99+18/км, comfort 149+24, business 299+42, `ride_min` вместо `dropoff_at`, режим `--check`).
- [ ] **Step 2:** `python3 инструменты/gen_taxi.py --check; echo $?` → «устарел», код 1.
- [ ] **Step 3:** `python3 инструменты/gen_taxi.py` → контрольные числа (ожидаемо: заказов 4000; completed 3372, cancelled_rider 253, no_driver 284, cancelled_driver 91; Екатеринбург апр–июн no_driver 16,4% против 5,1% в янв–мар, подача 11,5 против 7,6 мин; 18–20 ч — поездок 78,0%, наценка 63,1%) и «Готово: data-taxi.js — 420 КБ». Затем `--check` → «совпадает».
- [ ] **Step 4:** `node --check data-taxi.js`.
- [ ] **Step 5:** В `ci.sh` после «Файл xlsx»: `step "База такси" "data-taxi.js не совпадает с генератором — python3 инструменты/gen_taxi.py" python3 инструменты/gen_taxi.py --check`; в `syntax()` — `data-taxi.js` в список; в `version_bumped` — `data-taxi.js` в список файлов сайта. В спеке: «не больше 450 КБ», `ride_min` вместо `dropoff_at`, 4 000 / 1 200.

---

### Task 2: Такси в `shop.db` и проверка данных

**Files:**
- Modify: `инструменты/mkdb.py`
- Create: `инструменты/checktaxi.js` (первая часть — данные)
- Modify: `инструменты/ci.sh` (шаг «Такси в движке»)

**Interfaces:**
- Produces: таблицы `riders`, `drivers`, `trips` в `инструменты/shop.db`.

- [ ] **Step 1: Падающая проверка** — `инструменты/checktaxi.js`:

```js
#!/usr/bin/env node
/* База «Дельта Такси»: data-taxi.js загружается и совпадает с shop.db
   (строк по таблицам), а Taxi.wants из app.js узнаёт запросы к такси.
   Запуск: node инструменты/checktaxi.js            */
const fs = require("fs"), vm = require("vm"), path = require("path");
const { execFileSync } = require("child_process");
const base = path.resolve(__dirname, "..");
const bad = [];
const ctx = { window: {} }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(base, "data-taxi.js"), "utf8"), ctx);
const D = ctx.window.DATA;
const rows = k => D[k].split("\n").filter(Boolean).length - 1;
const db = path.join(__dirname, "shop.db");
for (const [t, k] of [["riders", "taxiRidersCSV"], ["drivers", "taxiDriversCSV"], ["trips", "taxiTripsCSV"]]) {
  let n = "нет таблицы";
  try { n = +execFileSync("sqlite3", [db, "SELECT COUNT(*) FROM " + t], { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim(); }
  catch (e) { /* таблицы нет — mkdb.py не перезапускали */ }
  if (n !== rows(k)) bad.push(t + ": в data-taxi.js " + rows(k) + " строк, в shop.db " + n);
}
if (bad.length) { console.log("Такси:\n" + bad.join("\n")); process.exit(1); }
console.log("Такси: riders " + rows("taxiRidersCSV") + ", drivers " + rows("taxiDriversCSV") + ", trips " + rows("taxiTripsCSV"));
```

- [ ] **Step 2:** `node инструменты/checktaxi.js; echo $?` → «trips: … в shop.db нет таблицы», код 1.
- [ ] **Step 3: `mkdb.py`** — после блока `leads`:

```python
# база «Дельта Такси» (урок 6.4): DDL и CSV из data-taxi.js, пустая ячейка — NULL
t = (BASE / "data-taxi.js").read_text(encoding="utf-8")
con.executescript(re.search(r"taxiSQL = `(.*?)`;", t, re.S).group(1))
num = lambda v, f: None if v == "" else f(v)
for key, table, cast in (("taxiRidersCSV", "riders", (int, str, str, str)),
                         ("taxiDriversCSV", "drivers", (int, str, str, str)),
                         ("taxiTripsCSV", "trips", (int, int, int, str, str, str, str, int,
                                                    str, float, float, float, int))):
    body = re.search(r"%s = `(.*?)`;" % key, t, re.S).group(1)
    rows = [tuple(num(v, f) for f, v in zip(cast, r)) for r in csv.reader(io.StringIO(body)) if r][1:]
    con.executemany("INSERT INTO %s VALUES (%s)" % (table, ",".join("?" * len(cast))), rows)
    print(table, len(rows))
```
(первая строка CSV — заголовок; `num` переводит пустое в NULL для всех столбцов, текстовые пустыми не бывают, кроме `pickup_at`, — для него тоже NULL.)

- [ ] **Step 4:** `python3 инструменты/mkdb.py && node инструменты/checktaxi.js` → «Такси: riders 1200, drivers 300, trips 4000»; `sqlite3 инструменты/shop.db "SELECT status, COUNT(*) FROM trips GROUP BY 1"` — 4 статуса, сумма 4000; `SELECT COUNT(*) FROM trips WHERE driver_id IS NULL` = число `no_driver`.
- [ ] **Step 5:** Существующие проверки не сломались: `node инструменты/checkdrills.js && node инструменты/checknums.js` зелёные. Шаг `ci.sh`: `step "Такси в движке" "data-taxi.js не совпадает с shop.db или Taxi.wants сломан (node инструменты/checktaxi.js)" node инструменты/checktaxi.js`.

---

### Task 3: Загрузка такси в движке

**Files:**
- Modify: `app.js` — `Lazy` (+`taxi`), новый объект `Taxi` перед `const Engine`, `Engine.sql`, вызовы `Engine.sql()` (строки ~4475, ~4725, ~5587), прогрев урока (`if (L.kind !== "text" && L.kind !== "sheet") idle(...)`), `Offline.files`
- Modify: `build.py` (`LAZY` + `data-taxi.js`), `инструменты/checktaxi.js` (сценарии `Taxi.wants`)

**Interfaces:**
- Consumes: `window.DATA.taxi*` (Task 1).
- Produces: `Taxi.wants(code: string) → boolean`; `Taxi.fill(db) → void` (DDL + три CSV через `fillFromCsv`); `Lazy.taxi() → Promise`; `Engine.sql(code?: string) → Promise<Database>`; `Engine.taxiReady: Promise|null`; поле урока `base: "taxi"` в `lessons.js`.

- [ ] **Step 1: Сценарии `wants` (падают)** — в `checktaxi.js` перед итогом:

```js
const app = fs.readFileSync(path.join(base, "app.js"), "utf8");
const m = app.match(/\nconst Taxi = \{[\s\S]*?\n\};\n/);
if (!m) { console.log("В app.js не найден объект Taxi"); process.exit(1); }
const tx = {}; vm.createContext(tx);
vm.runInContext(m[0].replace("const Taxi", "var Taxi"), tx);
const W = tx.Taxi.wants, cases = [
  ["SELECT * FROM trips", true], ["select count(*) from Drivers d", true],
  ["SELECT r.city FROM riders r JOIN trips t USING(rider_id)", true],
  ["SELECT * FROM orders", false], ["SELECT trip_id FROM orders", false],
  ["SELECT * FROM users -- не trips", true], ["", false], [null, false]];
for (const [c, want] of cases) if (W(c) !== want) bad.push("Taxi.wants(" + JSON.stringify(c) + ") = " + W(c) + ", нужно " + want);
```
(перенести `if (bad.length) …` и итог после этого блока, в итог добавить «, сценариев wants: 8»). Run: `node инструменты/checktaxi.js` → «В app.js не найден объект Taxi».

- [ ] **Step 2: `Taxi` и `Lazy.taxi`**

```js
/* ============================================================
   База «Дельта Такси» (урок 6.4) — в отдельном data-taxi.js, чтобы
   остальные SQL-уроки её не качали. Запрос, в котором есть таблица
   такси, сам подгружает её в общую базу (Engine.sql(code)).
   ============================================================ */
const Taxi = {
  TABLES: /\b(trips|drivers|riders)\b/i,
  wants: function (code) { return Taxi.TABLES.test(String(code || "")); },
  fill: function (db) {
    const D = window.DATA, nul = function (v) { return v === "" ? null : v; };
    db.run(D.taxiSQL);
    fillFromCsv(db, D.taxiRidersCSV, "INSERT INTO riders VALUES (?,?,?,?)",
      function (c) { return [+c[0], c[1], c[2], c[3]]; });
    fillFromCsv(db, D.taxiDriversCSV, "INSERT INTO drivers VALUES (?,?,?,?)",
      function (c) { return [+c[0], c[1], c[2], c[3]]; });
    fillFromCsv(db, D.taxiTripsCSV, "INSERT INTO trips VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
      function (c) {
        const n = function (v) { return v === "" ? null : +v; };
        return [+c[0], +c[1], n(c[2]), c[3], c[4], c[5], nul(c[6]), n(c[7]), c[8], n(c[9]), n(c[10]), +c[11], n(c[12])];
      });
  }
};
```
В `Lazy`: `taxi: function () { return window.DATA && window.DATA.taxiSQL ? Promise.resolve() : loadScript("data-taxi.js"); }` (+ запятая у `cheats`). Важно: `data-taxi.js` пишет `window.DATA = window.DATA || {}` — не затирает `data.js`; а `Lazy.data()` проверяет `window.DATA` — после такси он уже есть. Поэтому `Lazy.data` меняется на `window.DATA && window.DATA.shopSQL ? … : loadScript("data.js")`.

- [ ] **Step 3: `Engine.sql(code)`**

```js
  sql: async function (code) {
    const db = Engine.db || await Engine.shop();
    if (Taxi.wants(code)) {
      if (!Engine.taxiReady) {
        Engine.taxiReady = Lazy.taxi().then(function () { Taxi.fill(db); });
        Engine.taxiReady.catch(function () { Engine.taxiReady = null; });
      }
      try { await Engine.taxiReady; }
      catch (e) { throw new Error("База такси не загрузилась — похоже, пропал интернет."); }
    }
    return db;
  },
```
Нынешнее тело `sql` переименовать в `shop: async function () { … }` (без изменений внутри; `if (Engine.db) return Engine.db;` остаётся). Добавить поле `taxiReady: null` рядом с `py: null`.

- [ ] **Step 4: Вызовы** — `await Engine.sql()` → `await Engine.sql(code)` в трёх местах (шаги практикума ~4475, `Run.sql` ~4725, основная задача ~5587). Где `Engine.sql()` в `idle(...)` — без изменений (прогрев магазина). Ошибка такси: в `Run.sql` уже `try/catch` вокруг `sqlLast`, но `Engine.sql` бросает до него — обернуть:

```js
  sql: async function (code) {
    let db;
    try { db = await Engine.sql(code); } catch (e) { return { err: e.message }; }
    try { return { res: sqlLast(db, code) }; }
    catch (e) { return { err: "SQLite: " + e.message }; }
  },
```
В шагах и основной задаче — так же: перехват ошибки `Engine.sql(code)` и вывод её текста тем же путём, что ошибка SQLite (посмотреть соседний `catch` и отдать `e.message`).

- [ ] **Step 5: Прогрев, офлайн, сборка**
- В `renderLesson` рядом с `idle(... Lazy.data() ...)`: `if (L.base === "taxi") idle(function () { Lazy.taxi().catch(function () {}); });`
- `Offline.files`: `"data-taxi.js"` в `own`.
- `build.py`: `LAZY = (…, "data.js", "cheats.js", "data-taxi.js")`.
- `README.md`: строка `data-taxi.js` в таблице файлов, абзац в «Учебные данные» — схема такси и как она грузится.

- [ ] **Step 6:** `node --check app.js && node инструменты/checktaxi.js` → «…, сценариев wants: 8». `python3 build.py && grep -c "taxiTripsCSV" "Тетрадь аналитика.html"` → 1; `git checkout -- "Тетрадь аналитика.html"`.

- [ ] **Step 7: Браузер (свой Playwright, `serviceWorkers: "block"`)**
- `#m1l1`: запустить основную задачу — в сетевых запросах нет `data-taxi.js`.
- `#sandbox`: SQL `SELECT status, COUNT(*) FROM trips GROUP BY 1` → 4 строки, сумма 4000; сразу второй запуск — без ошибки.
- `page.route("**/data-taxi.js", r => r.abort())` → запрос к `trips` в песочнице показывает «База такси не загрузилась — похоже, пропал интернет.»; запрос к `orders` работает.
- Офлайн-файл `file://…#sandbox` — запрос к `trips` работает.

---

### Task 4: Урок `m6l8` — теория, задача, тренажёр, quiz, карточки

**Files:**
- Modify: `lessons.js` (урок после `m6l3`, навык `sql-schema`), `content-m6.js` (объект `window.CONTENT.m6l8` перед `m6l4`)
- Modify: `glossary.js` — термин «зерно таблицы» (`grain`), если его нет: `node инструменты/checkterms.js`

**Interfaces:**
- Consumes: таблицы такси в `shop.db` (Task 2), `base: "taxi"` (Task 3).

- [ ] **Step 1: `lessons.js`**
```js
{ id: "m6l8", title: "Чужая схема: такси", kind: "sql", base: "taxi", ready: true,
  desc: "незнакомая база за десять минут и типовые задачи такси",
  say: "на собеседовании схема всегда чужая",
  sayTask: "сначала посчитайте строки и статусы, потом решайте",
  sayDrills: "«Перерыв водителя» — LAG, который просят чаще всего" },
```
после `m6l3`; навык `{ id: "sql-schema", group: "SQL", title: "Незнакомая схема", lessons: ["m6l8"] }` после `clickhouse`.

- [ ] **Step 2: Числа урока.** Все — запросами к `shop.db`, записать в рабочий файл scratchpad вместе с запросами: строки по таблицам; доли статусов; `no_driver` ↔ `driver_id IS NULL`; диапазон `requested_at`; средняя подача по тарифу и по городу×полугодию (`(julianday(pickup_at) - julianday(requested_at)) * 1440`); доля поездок по часу; доля наценки 18–20 ч и днём; доля оценённых поездок.

- [ ] **Step 3: Основная задача** — тикет продакта «Где и когда теряем заказы», запрос: доля `completed` от всех заказов по `city` и блоку часов (`ночь 0–5, утро 6–11, день 12–17, вечер 18–23` через `CASE` по `strftime('%H', requested_at)`), с числом заказов, `ORDER BY` доли по возрастанию. `expected` — `{ ordered: true, columns, rows }` из `sqlite3 -json` на `shop.db`; `starter` — запускаемый `SELECT city, requested_at, status FROM trips LIMIT 5;`; `schema` — описание трёх таблиц (столбцы, что значит строка, когда пусто) и подсказки по `strftime`/`julianday`; `hints` 3 уровня; `solution` и `solutionNote` с выводом (худшая клетка — ожидаемо Екатеринбург вечером).

- [ ] **Step 4: Тренажёр** — 11 задач `{ title, level, body, solution }` (SQL-урок: проверка — по результату `solution`, `checkdrills.js` выполняет каждую). Темы по спеку: топ-3 водителя по выручке в городе (`ROW_NUMBER` по `city`); первая поездка пассажира; пассажиры без единой поездки (`LEFT JOIN … IS NULL` по `completed`); средняя подача по тарифу; доля поездок с наценкой по часу; перерыв водителя > 7 дней (`LAG`); недельное удержание пассажиров первой недели января; водители, работавшие во всех трёх месяцах апр–июн; средняя оценка (`AVG` игнорирует NULL — и доля оценённых); выручка по месяцам и городам с долей города (окно `SUM() OVER (PARTITION BY month)`); доля `cancelled_driver` по водителям со средней оценкой ниже 4 против остальных. После каждой — «Результат:» с числами из прогона.

- [ ] **Step 5: Теория** по спеку (5 разделов), `lead`, `callout trap` («доля отмен от поездок, а не от заказов»), `callout work`, `callout jobs`, таблица «вопрос интервьюеру → зачем»; все числа из Step 2. Quiz 6 (варианты по кругу, верный не длиннее остальных), карточки 6, ссылки 2–3 (проверить `curl -sL -o /dev/null -w "%{http_code}"` → 200 и заголовок страницы).

- [ ] **Step 6:** `node --check content-m6.js lessons.js && node инструменты/checksql.js m6l8 | sqlite3 инструменты/shop.db | head && node инструменты/checkdrills.js && node инструменты/checkcards.js && node инструменты/checkterms.js && node инструменты/checkskills.js && node инструменты/checkorder.js` — всё зелёное, навыков 17.

---

### Task 5: Практикум урока `m6l8`

**Files:**
- Modify: `content-m6.js` — поле `practicum` у `m6l8`

- [ ] **Step 1:** Загрузить скилл `new-practicum` и выполнить его для `m6l8`: 6–7 шагов по спеку («строки по таблицам → статусы и доли → где пусто driver_id и при каком статусе → диапазон дат и формат времени → минуты подачи у одной поездки → заказы по часам → доля поездок по городам»), данные шагов — другие срезы, чем в задаче (например, только Казань или только тариф comfort), `schema` практикума — та же, что у урока.
- [ ] **Step 2:** `node инструменты/checksteps.js m6l8` → все шаги зелёные; `node инструменты/checkorder.js`.

---

### Task 6: Сдвиг номеров 6.4–6.7 → 6.5–6.8

**Files:** все, где встречаются ссылки: `content-m*.js`, `lessons.js` (комментарий к `skills`: «карьерные 6.1, 6.2, 6.7» → «6.8»), `README.md` (строка про карту навыков, список практикумов «… 6.4» → «6.5», раздел про `sheet` «Урок 6.5» → «6.6»), `ПРОГРЕСС.md`, `app.js` (комментарий `Files`: «xlsx урока 6.5» → «6.6»), `build.py`?, `инструменты/mkxlsx.py` («урока 6.5» → «6.6»), `инструменты/README.md`, `инструменты/figs.py` (комментарии 6.6/6.7 → 6.7/6.8), `.github/workflows/check.yml` («openpyxl для xlsx урока 6.5» → «6.6»), `инструменты/ci.sh`, `content-m6.js` («урока 6.4» в тексте m6l4 → смотреть по смыслу).

- [ ] **Step 1:** `grep -rnE "6\.[4-8]" content-*.js glossary.js lessons.js app.js build.py README.md ПРОГРЕСС.md инструменты/*.py инструменты/*.js инструменты/*.sh инструменты/README.md .github/workflows/*.yml cheats.js | grep -v "window.FIGS"` — разобрать по смыслу; порядок: 6.7→6.8, 6.6→6.7, 6.5→6.6, 6.4→6.5. Числа (6,4 / 6.5 в данных) не трогать.
- [ ] **Step 2:** `ПРОГРЕСС.md`: модуль 6 — 8 уроков, ключевые числа 6.4 такси (из Task 4 Step 2), сдвиг ключевых чисел 6.4–6.7, сводка (уроки/вопросы/карточки/тренажёры/ссылки — пересчитать скриптом, как при уроке 6.5), «Данные» — абзац о `data-taxi.js`.
- [ ] **Step 3:** `python3 инструменты/figs.py m6 --check` и `bash инструменты/ci.sh` — красные только «Всё пересобрано» и «Версия сайта».

---

### Task 7: Браузер, ревью, выпуск

- [ ] **Step 1: Браузер** (390 и 1280 px, светлая и тёмная): `#m6l8` — теория, практикум (все шаги решаются эталоном), задача (эталон → «Задание выполнено»), 2 задачи тренажёра; подсказки по схеме у редактора показывают `trips`; главная — 6.4 «Чужая схема: такси», 6.5–6.8 сдвинулись; `#skills` — «Незнакомая схема».
- [ ] **Step 2: Агенты параллельно** — `engine-reviewer` (Taxi, Engine.sql(code), Lazy, офлайн, build), `lesson-reviewer` (урок, числа, сдвиг номеров), `student-walkthrough` (`m6l8`). Применить замечания; `ci.sh`.
- [ ] **Step 3: Согласие владельца** → коммит «Урок 6.4: чужая схема — база «Дельта Такси»» (без `docs/ПЛАН-УЛУЧШЕНИЙ.md`), `bash инструменты/release.sh "Урок 6.4: Дельта Такси" --trailer "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`, push, PR в `main`, команды владельцу.
