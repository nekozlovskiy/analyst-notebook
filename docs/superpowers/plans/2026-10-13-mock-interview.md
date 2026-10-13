# Пробное собеседование `#mock` — план выполнения

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** страница `#mock` — 45-минутная попытка из 3 SQL-задач на такси, 5 вопросов уроков и 1 кейса, с отчётом и историей попыток в прогрессе.

**Architecture:** контент — новый ленивый файл `interview.js` (`window.MOCK`); чистая логика выбора и времени — объект `MockCore` в `app.js` (проверяется скриптом через vm, как `Taxi` в `checktaxi.js`); страница — `renderMock` + объект `Mock` (черновик в `sessionStorage`, вкладки, таймер, отчёт); история — раздел `Store.mock`.

**Tech Stack:** чистый JS без сборщика, sql.js в браузере, `node:sqlite` в проверочных скриптах, Playwright для браузерной проверки.

**Spec:** `docs/superpowers/specs/2026-10-13-mock-interview-design.md`

## Global Constraints

- `id` уроков, порядок `steps`/`quiz`/`cards` не трогаем; `node инструменты/checkorder.js` зелёный.
- Каждое число в текстах — из запуска на базе (`sqlite3 инструменты/shop.db`).
- Тон: без восклицаний, числа со знаменателем.
- Код в стиле `app.js`: `function () {}`, `const`/`let`, `$`, `el`, `esc`, `plural`, комментарии по-русски.
- `#interview` занят — адрес страницы `#mock`; ни один элемент на странице не должен иметь `id="mock"`.
- Коммиты — только с согласия владельца; в конце — один коммит содержания + `release.sh`.
- Правка через Edit/Write на ветке `mock-interview` (не `main`).
- Телефон 390 px без горизонтальной прокрутки страницы; тёмная тема.

## Review Focus

1. Перезагрузка вкладки посреди попытки — попытка продолжается с тем же кодом, ответами и оставшимся временем (Task 3, браузер).
2. Таймер дошёл до нуля, пока вкладка была в фоне или ноутбук спал, — при возврате сразу отчёт, время в истории не больше 45 (Task 2 `MockCore.left`, Task 3 браузер).
3. Ученик не запускал ни одной SQL-задачи / оставил кейс пустым — отчёт «нет ответа», без ошибок в консоли (Task 3, браузер).
4. Импорт прогресса из файла с попытками с другого устройства — истории объединяются, ничего не теряется (Task 2, проверка `merge`).
5. `sessionStorage` недоступен (приватный режим, запрет) — попытка работает до перезагрузки, страница не падает (Task 3: все обращения в try/catch).

---

### Task 1: Пул заданий `interview.js` и проверка `checkinterview.js`

**Files:**
- Create: `interview.js`
- Create: `инструменты/checkinterview.js`
- Modify: `инструменты/ci.sh` (`syntax()` стр. 30, `version_bumped()` стр. 97, новый `step` после «Такси в движке»)
- Modify: `build.py:65-66` (LAZY + `"interview.js"`)

**Interfaces:**
- Produces: `window.MOCK = { sql: [{id, level, title, body, solution, expected:{columns, rows, ordered}, lesson}], cases: [{id, title, body, ref, check:[string]}] }`.
- Produces: `node инструменты/checkinterview.js [--print <id>]` — код выхода 1 при любой ошибке; `--print` печатает `expected` для задачи по её `solution` (JSON, чтобы вставить в файл).

- [ ] **Step 1: Скрипт проверки (красный).** Создать `инструменты/checkinterview.js`:

```js
#!/usr/bin/env node
/* Пробное собеседование (#mock): пул interview.js.
   SQL — решение каждой задачи выполняется на базе такси и сверяется со
   своим expected по правилам Check.sql (копия из checksteps.js); id
   уникальны, задач по 4 на уровень, lesson — существующий урок; у кейса
   5–6 пунктов чек-листа; MockCore из app.js выбирает по задаче каждого
   уровня и избегает прошлой попытки.
     node инструменты/checkinterview.js              — всё
     node инструменты/checkinterview.js --print id   — expected по решению */
"use strict";
const fs = require("fs"), vm = require("vm"), path = require("path");
const { DatabaseSync } = require("node:sqlite");
const base = path.resolve(__dirname, "..");
const ctx = { window: {} }; vm.createContext(ctx);
for (const f of ["lessons.js", "data-taxi.js", "interview.js"])
  vm.runInContext(fs.readFileSync(path.join(base, f), "utf8"), ctx);
const M = ctx.window.MOCK, T = ctx.window.TAXI, COURSE = ctx.window.COURSE;

const db = new DatabaseSync(":memory:");
db.exec(T.sql);
function fill(csv, sql, conv) {
  const st = db.prepare(sql);
  db.exec("BEGIN");
  csv.split("\n").slice(1).forEach(function (l) { if (l) st.run.apply(st, conv(l.split(","))); });
  db.exec("COMMIT");
}
/* как Taxi.fill в app.js */
const n = function (v) { return v === "" ? null : +v; }, t = function (v) { return v === "" ? null : v; };
fill(T.ridersCSV, "INSERT INTO riders VALUES (?,?,?,?)", function (c) { return [+c[0], c[1], c[2], c[3]]; });
fill(T.driversCSV, "INSERT INTO drivers VALUES (?,?,?,?)", function (c) { return [+c[0], c[1], c[2], c[3]]; });
fill(T.tripsCSV, "INSERT INTO trips VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
  function (c) { return [+c[0], +c[1], n(c[2]), c[3], c[4], c[5], t(c[6]), n(c[7]), c[8], n(c[9]), n(c[10]), +c[11], n(c[12])]; });

function query(sql) {
  const st = db.prepare(sql);
  const columns = st.columns().map(function (c) { return c.name; });
  return { columns: columns, values: st.all().map(function (r) { return columns.map(function (c) { return r[c]; }); }) };
}
/* ---- копия Check.cellEq и Check.sql (как в checksteps.js) ---- */
function cellEq(a, b) {
  if (a === null || a === undefined) a = "";
  if (b === null || b === undefined) b = "";
  const na = Number(a), nb = Number(b);
  if (a !== "" && b !== "" && !isNaN(na) && !isNaN(nb)) return Math.abs(na - nb) < 0.011;
  return String(a).trim() === String(b).trim();
}
function check(res, exp) {
  const gc = res.columns.map(function (c) { return String(c).toLowerCase(); });
  if (gc.join("|") !== exp.columns.map(function (c) { return c.toLowerCase(); }).join("|"))
    return "столбцы " + res.columns.join(", ") + ", а в expected " + exp.columns.join(", ");
  let got = res.values.slice(), want = exp.rows.slice();
  if (got.length !== want.length) return "строк " + got.length + ", в expected " + want.length;
  if (!exp.ordered) {
    const key = function (r) { return r.map(function (v) { return v === null ? "" : String(v); }).join("|"); };
    got.sort(function (x, y) { return key(x) < key(y) ? -1 : 1; });
    want.sort(function (x, y) { return key(x) < key(y) ? -1 : 1; });
  }
  for (let r = 0; r < want.length; r++)
    for (let c = 0; c < want[r].length; c++)
      if (!cellEq(got[r][c], want[r][c])) return "строка " + (r + 1) + ", «" + exp.columns[c] + "»: " + got[r][c] + " вместо " + want[r][c];
  return "";
}

const args = process.argv.slice(2);
if (args[0] === "--print") {
  const x = M.sql.filter(function (s) { return s.id === args[1]; })[0];
  const r = query(x.solution);
  console.log(JSON.stringify({ columns: r.columns, rows: r.values }));
  process.exit(0);
}

const bad = [];
const lessons = {};
COURSE.modules.forEach(function (m) { m.lessons.forEach(function (l) { lessons[l.id] = true; }); });
const ids = {};
M.sql.concat(M.cases).forEach(function (x) {
  if (ids[x.id]) bad.push("id повторяется: " + x.id);
  ids[x.id] = true;
});
["easy", "mid", "hard"].forEach(function (lv) {
  const k = M.sql.filter(function (s) { return s.level === lv; }).length;
  if (k !== 4) bad.push("задач уровня " + lv + ": " + k + ", нужно 4");
});
M.sql.forEach(function (s) {
  ["title", "body", "solution", "expected", "lesson"].forEach(function (f) { if (!s[f]) bad.push(s.id + ": нет поля " + f); });
  if (s.lesson && !lessons[s.lesson]) bad.push(s.id + ": нет урока " + s.lesson);
  try { const why = check(query(s.solution), s.expected); if (why) bad.push(s.id + ": " + why); }
  catch (e) { bad.push(s.id + ": решение падает — " + e.message); }
});
M.cases.forEach(function (c) {
  ["title", "body", "ref"].forEach(function (f) { if (!c[f]) bad.push(c.id + ": нет поля " + f); });
  if (!Array.isArray(c.check) || c.check.length < 5 || c.check.length > 6) bad.push(c.id + ": в чек-листе нужно 5–6 пунктов");
});

/* MockCore из app.js — вырезаем, как Taxi в checktaxi.js */
const app = fs.readFileSync(path.join(base, "app.js"), "utf8");
const mc = app.match(/\nconst MockCore = \{[\s\S]*?\n\};\n/);
if (!mc) bad.push("в app.js нет объекта MockCore");
else {
  const box = {}; vm.createContext(box);
  vm.runInContext(mc[0].replace("const MockCore", "var MockCore"), box);
  const C = box.MockCore;
  const refs = []; for (let i = 0; i < 40; i++) refs.push({ id: "x", n: i });
  for (let k = 0; k < 50; k++) {
    const p = C.pick(M.sql, M.cases, refs, []);
    const lv = p.sql.map(function (id) { return M.sql.filter(function (s) { return s.id === id; })[0].level; }).join(",");
    if (lv !== "easy,mid,hard") { bad.push("MockCore.pick: уровни " + lv); break; }
    if (p.quiz.length !== 5 || new Set(p.quiz.map(function (q) { return q.n; })).size !== 5) { bad.push("MockCore.pick: вопросов не 5 разных"); break; }
    const again = C.pick(M.sql, M.cases, refs, p.sql.concat([p.cas]));
    if (again.sql.some(function (id) { return p.sql.indexOf(id) >= 0; }) || again.cas === p.cas) { bad.push("MockCore.pick повторил прошлую попытку"); break; }
  }
  if (C.left(0, 50 * 60000) !== 0) bad.push("MockCore.left: после 50 минут не 0");
  if (C.left(1000, 1000) !== 45 * 60000) bad.push("MockCore.left: в начале не 45 минут");
  if (C.clock(61000) !== "1:01" || C.clock(45 * 60000) !== "45:00") bad.push("MockCore.clock: " + C.clock(61000));
  if (C.mins(0, 99 * 60000) !== 45) bad.push("MockCore.mins: больше 45");
  const hist = { "100": { ids: ["a"] }, "300": { ids: ["c"] }, "200": { ids: ["b"] } };
  if (C.lastIds(hist).join() !== "c") bad.push("MockCore.lastIds: " + C.lastIds(hist).join());
}

if (bad.length) { console.log("Пробное собеседование:\n" + bad.join("\n")); process.exit(1); }
console.log("Пробное собеседование: SQL " + M.sql.length + ", кейсов " + M.cases.length + ", MockCore ок");
```

- [ ] **Step 2: Запустить — красный.** `node инструменты/checkinterview.js` → ошибка «ENOENT … interview.js».

- [ ] **Step 3: `interview.js` с решениями без `expected`.** Шапка-комментарий как у `cheats.js`; затем `window.MOCK = { sql: [...], cases: [...] };`. Решения — из проверенного `scratchpad/mock/pool.sql` (числа в спеке). Тексты задач:

| id | level | lesson | title | body (суть, в `<p>`) | ordered |
|---|---|---|---|---|---|
| nodrv-tariff | easy | m1l3 | «Нет машины» по тарифу | По каждому тарифу: `tariff`, `orders` — все заказы, `no_driver_pct` — доля статуса `no_driver` в процентах с одним знаком. По убыванию доли. | true |
| platform-rev | easy | m1l1 | Выручка по платформе | По завершённым поездкам и платформе пассажира (`riders.platform`): `platform`, `trips`, `revenue` — округлённая до рубля, `avg_check` — с двумя знаками. По убыванию выручки. | true |
| rub-per-km | easy | m1l3 | Рубль за километр | По завершённым поездкам и тарифу: `tariff`, `avg_km` — средняя дистанция с одним знаком, `rub_per_km` — сумма цен, делённая на сумму километров, с одним знаком. По возрастанию `rub_per_km`. | true |
| weekday | easy | m1l6 | День недели | `weekday` — день недели заказа числом (`strftime('%w', …)`: 0 — воскресенье), `orders`, `done_pct` — доля завершённых с одним знаком. По `weekday`. | true |
| loyal-riders | mid | m1l4 | Постоянные пассажиры | Среди пассажиров хотя бы с одной завершённой поездкой — сколько сделали 5 и больше. По городу поездки: `city`, `riders`, `loyal`, `loyal_pct` с одним знаком. По убыванию `loyal_pct`. | true |
| surge-revenue | mid | m1l3 | Сколько приносит наценка | По завершённым поездкам и городу: `city`, `revenue` (до рубля), `surge_rev_pct` — доля выручки от поездок с `surge > 1`, `surge_trips_pct` — доля таких поездок; доли с одним знаком. По убыванию `surge_rev_pct`. | true |
| msk-growth | mid | m1l2 | Рост Москвы | Завершённые поездки Москвы по месяцам (`'2024-01'`): `month`, `trips`, `growth_pct` — рост к прошлому месяцу в процентах с одним знаком (у января пусто). По месяцам. | true |
| activation-14d | mid | m1l6 | Первая поездка после регистрации | Пассажиры, зарегистрированные с января по май 2024: по месяцу регистрации `month`, `signups`, `active_14d` — сколько из них завершили поездку в день регистрации или в следующие 13 дней. По месяцам. | true |
| median-wait | hard | m1l2 | Медиана подачи | Медиана минут подачи (`pickup_at − requested_at`) по завершённым поездкам: `city`, `median_wait` с одним знаком. При чётном числе поездок — среднее двух средних значений. По городу. Без `MEDIAN` — в SQLite её нет. | true |
| repeat-7d | hard | m1l2 | Вернулся за неделю | Для завершённых поездок до 24 июня 2024 — доля тех, после которых тот же пассажир снова завершил поездку не позже чем через 7 суток. `city`, `trips`, `repeat_7d_pct` с одним знаком. По убыванию доли. Срез до 24 июня — чтобы у каждой поездки была полная неделя наблюдения. | true |
| streaks | hard | m1l6 | Серии рабочих дней | Рабочий день водителя — день хотя бы с одной завершённой поездкой. Для каждого водителя найдите самую длинную серию рабочих дней подряд и выведите распределение: `longest_streak`, `drivers`. По `longest_streak`. | true |
| top-decile | hard | m1l2 | Десятая часть водителей | В каждом городе разбейте водителей по выручке на 10 групп (`NTILE(10)`, при равной выручке — по `driver_id`) и выведите долю выручки первой группы: `city`, `top10_share` с одним знаком. По убыванию доли. | true |

Решения (`solution`, строки через `\n` в JS-строке):

```sql
-- nodrv-tariff
SELECT tariff, COUNT(*) AS orders,
       ROUND(100.0 * SUM(status = 'no_driver') / COUNT(*), 1) AS no_driver_pct
FROM trips GROUP BY tariff ORDER BY no_driver_pct DESC;
-- platform-rev
SELECT r.platform, COUNT(*) AS trips, ROUND(SUM(t.price)) AS revenue, ROUND(AVG(t.price), 2) AS avg_check
FROM trips t JOIN riders r ON r.rider_id = t.rider_id
WHERE t.status = 'completed' GROUP BY r.platform ORDER BY revenue DESC;
-- rub-per-km
SELECT tariff, ROUND(AVG(distance_km), 1) AS avg_km, ROUND(SUM(price) / SUM(distance_km), 1) AS rub_per_km
FROM trips WHERE status = 'completed' GROUP BY tariff ORDER BY rub_per_km;
-- weekday
SELECT CAST(strftime('%w', requested_at) AS INTEGER) AS weekday, COUNT(*) AS orders,
       ROUND(100.0 * SUM(status = 'completed') / COUNT(*), 1) AS done_pct
FROM trips GROUP BY weekday ORDER BY weekday;
-- loyal-riders
WITH c AS (SELECT rider_id, city, COUNT(*) AS n FROM trips WHERE status = 'completed' GROUP BY rider_id, city)
SELECT city, COUNT(*) AS riders, SUM(n >= 5) AS loyal, ROUND(100.0 * SUM(n >= 5) / COUNT(*), 1) AS loyal_pct
FROM c GROUP BY city ORDER BY loyal_pct DESC;
-- surge-revenue
SELECT city, ROUND(SUM(price)) AS revenue,
       ROUND(100.0 * SUM(CASE WHEN surge > 1 THEN price END) / SUM(price), 1) AS surge_rev_pct,
       ROUND(100.0 * SUM(surge > 1) / COUNT(*), 1) AS surge_trips_pct
FROM trips WHERE status = 'completed' GROUP BY city ORDER BY surge_rev_pct DESC;
-- msk-growth
WITH m AS (SELECT strftime('%Y-%m', requested_at) AS month, COUNT(*) AS trips
           FROM trips WHERE status = 'completed' AND city = 'Москва' GROUP BY month)
SELECT month, trips,
       ROUND(100.0 * (trips - LAG(trips) OVER (ORDER BY month)) / LAG(trips) OVER (ORDER BY month), 1) AS growth_pct
FROM m ORDER BY month;
-- activation-14d
SELECT strftime('%Y-%m', r.signup_date) AS month, COUNT(DISTINCT r.rider_id) AS signups,
       COUNT(DISTINCT CASE WHEN julianday(date(t.requested_at)) - julianday(r.signup_date) BETWEEN 0 AND 13
                           THEN r.rider_id END) AS active_14d
FROM riders r LEFT JOIN trips t ON t.rider_id = r.rider_id AND t.status = 'completed'
WHERE r.signup_date >= '2024-01-01' AND r.signup_date < '2024-06-01'
GROUP BY month ORDER BY month;
-- median-wait
WITH w AS (SELECT city, (julianday(pickup_at) - julianday(requested_at)) * 1440 AS m FROM trips WHERE status = 'completed'),
r AS (SELECT city, m, ROW_NUMBER() OVER (PARTITION BY city ORDER BY m) AS rn, COUNT(*) OVER (PARTITION BY city) AS n FROM w)
SELECT city, ROUND(AVG(m), 1) AS median_wait FROM r WHERE rn IN ((n + 1) / 2, (n + 2) / 2) GROUP BY city ORDER BY city;
-- repeat-7d
WITH s AS (SELECT city, requested_at,
                  LEAD(requested_at) OVER (PARTITION BY rider_id ORDER BY requested_at, trip_id) AS nxt
           FROM trips WHERE status = 'completed')
SELECT city, COUNT(*) AS trips,
       ROUND(100.0 * SUM(nxt IS NOT NULL AND julianday(nxt) - julianday(requested_at) <= 7) / COUNT(*), 1) AS repeat_7d_pct
FROM s WHERE requested_at < '2024-06-24' GROUP BY city ORDER BY repeat_7d_pct DESC;
-- streaks
WITH d AS (SELECT DISTINCT driver_id, date(requested_at) AS day FROM trips WHERE status = 'completed'),
g AS (SELECT driver_id, julianday(day) - ROW_NUMBER() OVER (PARTITION BY driver_id ORDER BY day) AS grp FROM d),
s AS (SELECT driver_id, COUNT(*) AS len FROM g GROUP BY driver_id, grp),
b AS (SELECT driver_id, MAX(len) AS best FROM s GROUP BY driver_id)
SELECT best AS longest_streak, COUNT(*) AS drivers FROM b GROUP BY best ORDER BY best;
-- top-decile
WITH r AS (SELECT city, driver_id, SUM(price) AS rev FROM trips WHERE status = 'completed' GROUP BY city, driver_id),
n AS (SELECT city, rev, NTILE(10) OVER (PARTITION BY city ORDER BY rev DESC, driver_id) AS dec FROM r)
SELECT city, ROUND(100.0 * SUM(CASE WHEN dec = 1 THEN rev END) / SUM(rev), 1) AS top10_share
FROM n GROUP BY city ORDER BY top10_share DESC;
```

Кейсы (`body` — условие, `ref` — эталон 2–4 абзаца, `check` — пункты):

1. `ekb-april` «Екатеринбург в апреле» — body: «Доля заказов Екатеринбурга, закончившихся поездкой, упала с 87,7% в марте (130 заказов) до 71,7% в апреле (159). Продакт спрашивает, что случилось. Напишите, как будете разбираться: что проверите, в каком порядке и что скажете в конце.» ref: проверка данных и определения (заказы, а не поездки; полный ли апрель) → разложение по статусам: «нет машины» 7,7% → 18,9%, отмены пассажиром 4,6% → 6,3% → по часам и тарифам, сравнение с Москвой и Казанью → вывод «не хватает машин» и шаг: число активных водителей по неделям, наценка как рычаг. check: «Проверил данные и определение метрики», «Назвал знаменатель — заказы, а не поездки», «Разложил падение по статусам», «Разрезал по часу или тарифу», «Сравнил с другими городами или прошлым периодом», «Предложил следующий шаг с метрикой».
2. `evening-surge` «Вечерняя наценка» — body: «Продакт хочет поднять вечернюю наценку на 10%. Сейчас она стоит у 63,1% заказов с 18 до 20 часов. Как проверить, что идея хорошая?» ref: гипотеза; главная метрика — выручка на заказ с учётом доли завершённых; предохранители — отмены пассажиром, «нет машины», подача; эксперимент — чередование по дням или городам (switchback), а не деление пассажиров: водители общие, группы влияют друг на друга; длительность — полные недели, оценка мощности. check: «Сформулировал гипотезу и главную метрику», «Назвал предохранители: отмены, подача», «Объяснил, почему не делить пассажиров случайно», «Предложил дизайн по дням или городам», «Оценил длительность или мощность», «Сказал, как примет решение по результату».
3. `check-up` «Чек вырос» — body: «Средний чек завершённой поездки вырос с 314,44 ₽ в марте до 334,73 ₽ в апреле — на 6,5%. Финансовый директор доволен. Это хорошая новость?» ref: средний — смесь состава: доля поездок с наценкой 17,1% → 25,0%, доля не-econom 32,2% → 35,6%; сравнить чек внутри тарифа и без наценки; посмотреть число поездок и долю завершённых — выросший чек при нехватке машин может означать потерю заказов. check: «Заподозрил эффект состава», «Назвал разрезы: тариф, наценка», «Предложил сравнить чек внутри тарифа», «Посмотрел на объём и долю завершённых», «Сформулировал вывод с оговоркой».
4. `dashboard` «Дашборд на каждый день» — body: «Операционный менеджер такси просит дашборд, который он будет открывать каждое утро. Что на нём будет и почему?» ref: главная метрика — доля заказов, закончившихся поездкой; дерево: заказы → статусы → подача и цена; разрезы — город × час, тариф; сравнение со вчера и с тем же днём недели; пороги и оповещения; частота обновления и источник; не больше 5–7 графиков. check: «Выбрал одну главную метрику», «Разложил её на составляющие», «Назвал разрезы: город, час, тариф», «Предложил сравнение с базой: вчера, неделя назад», «Подумал о порогах или оповещениях», «Ограничил число графиков».

У каждой SQL-задачи пока `expected: { columns: [], rows: [], ordered: true }`.

- [ ] **Step 4: Заполнить `expected`.** Для каждого id: `node инструменты/checkinterview.js --print <id>` → вставить `columns` и `rows` в задачу (оставив `ordered: true`). Сверить с таблицей спека.

- [ ] **Step 5: Запустить — красный только из-за MockCore.** `node инструменты/checkinterview.js` → единственная строка «в app.js нет объекта MockCore».

- [ ] **Step 6: CI и сборка.** В `ci.sh`: добавить `interview.js` в список `syntax()` и в `version_bumped()` после `data-taxi.js`; после шага «Такси в движке»:

```bash
step "Пробное собеседование" "решение задачи interview.js не сходится с expected или пул неполный (node инструменты/checkinterview.js)" node инструменты/checkinterview.js
```

В `build.py` LAZY: `..., "data-taxi.js", "interview.js")`.

---

### Task 2: `MockCore` и раздел прогресса `mock`

**Files:**
- Modify: `app.js` — `Store` (`EMPTY` стр. 36, `merge` стр. 129), новый `MockCore` перед `const ModuleTest`

**Interfaces:**
- Consumes: `window.MOCK` (Task 1).
- Produces: `MockCore.MIN = 45`; `MockCore.pick(sqlPool, cases, quizRefs, lastIds, rnd?) → {sql: [easyId, midId, hardId], cas: caseId, quiz: [{id, n}×5]}`; `MockCore.left(t0, now) → мс ≥ 0`; `MockCore.clock(ms) → "м:сс"`; `MockCore.mins(t0, now) → 0..45`; `MockCore.lastIds(mockBucket) → [id]`; `Store` раздел `mock` с ключом `String(t0)`.

- [ ] **Step 1: `MockCore`** — вставить перед `const ModuleTest = {`:

```js
/* Пробное собеседование (#mock): выбор заданий и время — без DOM,
   чтобы инструменты/checkinterview.js проверял их отдельно.
   last — id задач и кейса прошлой попытки: их не берём, пока есть другие. */
const MockCore = {
  MIN: 45,
  pick: function (pool, cases, refs, last, rnd) {
    const r = rnd || Math.random;
    const one = function (list) {
      const fresh = list.filter(function (x) { return last.indexOf(x.id) < 0; });
      const from = fresh.length ? fresh : list;
      return from[Math.floor(r() * from.length)].id;
    };
    const sql = ["easy", "mid", "hard"].map(function (lv) {
      return one(pool.filter(function (t) { return t.level === lv; }));
    });
    const left = refs.slice(), quiz = [];
    while (quiz.length < 5 && left.length) quiz.push(left.splice(Math.floor(r() * left.length), 1)[0]);
    return { sql: sql, cas: one(cases), quiz: quiz };
  },
  left: function (t0, now) { return Math.max(0, MockCore.MIN * 60000 - (now - t0)); },
  clock: function (ms) {
    const s = Math.ceil(ms / 1000);
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  },
  mins: function (t0, now) { return Math.min(MockCore.MIN, Math.max(0, Math.round((now - t0) / 60000))); },
  lastIds: function (bucket) {
    const keys = Object.keys(bucket || {}).sort(function (a, b) { return +b - +a; });
    return keys.length && bucket[keys[0]] && bucket[keys[0]].ids ? bucket[keys[0]].ids : [];
  }
};
```

- [ ] **Step 2: `Store`.** В `EMPTY` добавить `mock: {}`; в список «заполняем пустое» в `merge` добавить `"mock"`:
`["code", "notes", "seen", "review", "prep", "plan", "entry", "mock"].forEach(...)`.

- [ ] **Step 3: Проверить.** `node --check app.js && node инструменты/checkinterview.js` → «Пробное собеседование: SQL 12, кейсов 4, MockCore ок». Проверка `merge` для истории — в браузере (Task 3, шаг 7).

---

### Task 3: Страница `#mock`

**Files:**
- Modify: `app.js` — `Lazy.mock` (стр. 264), `Offline.files` (стр. 533), `Pages.find` (стр. 1625), объект `Mock` и `renderMock` после `renderInterview`
- Modify: `styles.css` — блок `.mk-*` в конце файла

**Interfaces:**
- Consumes: `MockCore`, `window.MOCK`, `window.CONTENT[*].quiz`, `Run.sql`, `Check.sql`, `renderTable`, `mountEditor`, `CodeKit.setup/parse`, `Engine.sql`, `Review.record`, `Store`, `pageHead`, `mountHeader`, `Router.cleanup`.
- Produces: маршрут `#mock`; `Mock.draft()`/`Mock.save(d)`/`Mock.drop()`; DOM-якоря для проверки: `#mkStart`, `#mkClock`, `.mk-tabs [data-t]`, `#mkRun`, `#mkOut`, `#mkFinish`, `#mkReport`, `.mk-hist`.

- [ ] **Step 1: Загрузка и маршрут.** `Lazy.mock: function () { return window.MOCK ? Promise.resolve() : loadScript("interview.js"); }`; в `Offline.files` `own` — `"interview.js"` после `"data-taxi.js"`; в `Pages.find` — `if (id === "mock") return renderMock;`.

- [ ] **Step 2: Черновик и модули.**

```js
/* ---------- пробное собеседование ----------
   Черновик попытки — в sessionStorage: перезагрузка вкладки её не
   теряет, а закрытая вкладка — уже новая попытка. Без хранилища
   попытка живёт в памяти до перезагрузки. */
const Mock = {
  KEY: "da.mock",
  mem: null,
  MODS: ["m1", "m2", "m3", "m4", "m6"],      /* вопросы — без машинного обучения */
  draft: function () {
    try { const s = sessionStorage.getItem(Mock.KEY); if (s) return JSON.parse(s); } catch (e) {}
    return Mock.mem;
  },
  save: function (d) {
    Mock.mem = d;
    try { sessionStorage.setItem(Mock.KEY, JSON.stringify(d)); } catch (e) {}
  },
  drop: function () {
    Mock.mem = null;
    try { sessionStorage.removeItem(Mock.KEY); } catch (e) {}
  },
  task: function (id) { return window.MOCK.sql.filter(function (t) { return t.id === id; })[0]; },
  kase: function (id) { return window.MOCK.cases.filter(function (c) { return c.id === id; })[0]; },
  refs: function () {
    const out = [];
    Course.data.modules.forEach(function (m) {
      if (Mock.MODS.indexOf(m.id) < 0) return;
      m.lessons.forEach(function (l) {
        const C = window.CONTENT[l.id];
        (C && C.quiz ? C.quiz : []).forEach(function (q, n) { out.push({ id: l.id, n: n }); });
      });
    });
    return out;
  },
  start: function () {
    const p = MockCore.pick(window.MOCK.sql, window.MOCK.cases, Mock.refs(), MockCore.lastIds(Store.all().mock));
    const d = { t0: Date.now(), sql: p.sql, cas: p.cas, quiz: p.quiz, code: {}, ran: {}, ans: {}, text: "", tab: "s0" };
    Mock.save(d);
    return d;
  }
};
```

- [ ] **Step 3: `renderMock` — начало.**

```js
function renderMock(app) {
  document.title = "Пробное собеседование — Тетрадь аналитика";
  mountHeader("<b>Пробное собеседование</b>");
  const main = el("main", { class: "wrap lesson-wrap page mock" });
  main.innerHTML = pageHead("Пробное собеседование",
    "45 минут, три SQL-задачи на базе «Дельта Такси», пять вопросов из уроков и один продуктовый кейс. " +
    "Подсказок и разборов нет до конца — как на настоящем интервью.",
    "результат — для вас, не для оценки") +
    '<div id="mkBody"><p class="page-wait">Собираю задания…</p></div>';
  app.appendChild(main);
  /* такси прогреваем сразу: первый запуск запроса не будет её ждать */
  idle(function () { Engine.sql("trips").catch(function () {}); });
  Promise.all([Lazy.mock()].concat(Mock.MODS.map(function (m) { return Lazy.content(m); }))).then(function () {
    if (location.hash !== "#mock" || !$("#mkBody")) return;
    const d = Mock.draft();
    if (d && MockCore.left(d.t0, Date.now()) > 0) Mock.run($("#mkBody"), d);
    else if (d) Mock.finish($("#mkBody"), d);
    else Mock.intro($("#mkBody"));
  }, function () {
    const box = $("#mkBody");
    if (!box) return;
    box.innerHTML = '<p class="page-wait">Задания не загрузились — похоже, пропал интернет. ' +
      '<button class="linkbtn" id="mkRetry" type="button">Попробовать ещё раз</button></p>';
    $("#mkRetry").addEventListener("click", function () { Router.render(true); });
  });
}
```

`Mock.intro(box)`: абзац `.review-intro` с составом; если `!Course.isDone("m6l8")` — `.review-intro` «Лучше после <a href="#m6l8">урока 6.4</a>: в нём схема такси и типовые задачи.»; таблица истории `Mock.hist()`; кнопка `#mkStart` «Начать — время пойдёт сразу» → `Mock.run(box, Mock.start())`.

`Mock.hist()`: по `Store.all().mock`, ключи по убыванию, до 10 строк: `<table class="res mk-hist"><tr><th>Дата</th><th>SQL</th><th>Вопросы</th><th>Кейс</th><th>Минут</th></tr>`, дата — `x.getDate() + " " + MONTHS_GEN[x.getMonth()]`, ячейки «2 из 3», «4 из 5», «3 из 6»; пустая история — пустая строка.

- [ ] **Step 4: Попытка — вкладки, таймер, SQL, вопросы, кейс.**

```js
Mock.run = function (box, d) {
  const tabs = [["s0", "SQL 1"], ["s1", "SQL 2"], ["s2", "SQL 3"], ["q", "Вопросы"], ["c", "Кейс"]];
  box.innerHTML =
    '<div class="mk-bar"><span class="mk-clock" id="mkClock" aria-live="off"></span>' +
    '<div class="sb-tabs mk-tabs" role="tablist" aria-label="Части собеседования">' +
    tabs.map(function (t) { return '<button type="button" role="tab" data-t="' + t[0] + '">' + t[1] + "</button>"; }).join("") +
    '</div></div><div id="mkPane"></div>' +
    '<div class="actions mk-end"><button class="btn" id="mkFinish" type="button">Завершить</button></div>';
  let editor = null;
  const tick = setInterval(clock, 1000);
  Router.cleanup.push(function () { clearInterval(tick); });
  function clock() {
    const ms = MockCore.left(d.t0, Date.now()), c = $("#mkClock");
    if (!c) return;
    c.textContent = MockCore.clock(ms);
    c.classList.toggle("low", ms <= 5 * 60000);
    if (ms <= 0) { clearInterval(tick); Mock.finish(box, d); }
  }
  function marks() {
    Array.prototype.forEach.call(box.querySelectorAll(".mk-tabs button"), function (b) {
      const t = b.dataset.t;
      const has = t === "q" ? Object.keys(d.ans).length === d.quiz.length
        : t === "c" ? !!d.text.trim() : !!d.ran[d.sql[+t.slice(1)]];
      b.classList.toggle("has", has);
      b.setAttribute("aria-selected", t === d.tab ? "true" : "false");
    });
  }
  function show(t) {
    d.tab = t; Mock.save(d); marks(); editor = null;
    const pane = $("#mkPane");
    if (t.charAt(0) === "s") {
      const x = Mock.task(d.sql[+t.slice(1)]);
      CodeKit.setup("sql", CodeKit.parse(window.CONTENT.m6l8.schema), false);
      pane.innerHTML = '<h2 class="mk-h">' + esc(x.title) + "</h2>" + x.body +
        '<details class="mk-schema"><summary>Схема базы</summary>' + window.CONTENT.m6l8.schema + "</details>" +
        '<div class="editor-shell"><div class="editor-h"><span>задача.sql</span></div><textarea id="mkEditor"></textarea></div>' +
        '<div class="actions"><button class="btn primary" id="mkRun" type="button">' + ICON.play +
          'Запустить<span class="k">Cmd+Enter</span></button></div>' +
        '<div class="io-box"><div class="io-h"><span>результат</span></div><div class="io-body" id="mkOut">' +
          '<div class="empty">Запустите запрос — проверка будет в отчёте, по последнему запуску.</div></div></div>';
      mountEditor($("#mkEditor"), "sql", d.code[x.id] || "",
        function (v) { d.code[x.id] = v; Mock.save(d); }, run, function () {}).then(function (ed) { editor = ed; });
      $("#mkRun").addEventListener("click", run);
      async function run() {
        const code = editor ? editor.get() : "", out = $("#mkOut");
        if (!code.trim()) { out.innerHTML = '<div class="empty">Редактор пуст — напишите запрос.</div>'; return; }
        d.ran[x.id] = code; Mock.save(d); marks();
        out.innerHTML = '<div class="empty">' + (Engine.db ? "Выполняю…" : "Поднимаю базу в браузере…") + "</div>";
        try {
          const r = await Run.sql(code);
          if (!$("#mkOut")) return;
          out.innerHTML = r.err ? '<pre><span class="err">' + esc(r.err) + "</span></pre>"
            : r.res ? renderTable(r.res.columns, r.res.values, -1)
            : '<div class="empty">Запрос выполнен, но таблицы в ответе нет.</div>';
        } catch (e) { out.innerHTML = '<pre><span class="err">' + esc(e.message) + "</span></pre>"; }
      }
    } else if (t === "q") {
      pane.innerHTML = d.quiz.map(function (r, i) {
        const q = window.CONTENT[r.id].quiz[r.n];
        return '<div class="q mk-q"><div class="q-t"><span>' + (i + 1) + ". " + q.q + '</span></div><div class="q-opts">' +
          q.opts.map(function (o, k) {
            return '<button class="q-opt" type="button" data-q="' + i + '" data-i="' + k + '" aria-pressed="' +
              (d.ans[i] === k) + '"><span class="mk">' + "АБВГД".charAt(k) + "</span><span>" + o + "</span></button>";
          }).join("") + "</div></div>";
      }).join("");
      Array.prototype.forEach.call(pane.querySelectorAll(".q-opt"), function (b) {
        b.addEventListener("click", function () {
          const i = +b.dataset.q;
          d.ans[i] = +b.dataset.i; Mock.save(d); marks();
          Array.prototype.forEach.call(pane.querySelectorAll('.q-opt[data-q="' + i + '"]'), function (o) {
            o.setAttribute("aria-pressed", String(o === b));
          });
        });
      });
    } else {
      const c = Mock.kase(d.cas);
      pane.innerHTML = '<h2 class="mk-h">' + esc(c.title) + "</h2>" + c.body +
        '<label class="mk-lbl" for="mkText">Ваш ответ — как сказали бы вслух, по пунктам</label>' +
        '<textarea class="mk-text" id="mkText" rows="12"></textarea>';
      const ta = $("#mkText");
      ta.value = d.text;
      ta.addEventListener("input", function () { d.text = ta.value; Mock.save(d); marks(); });
    }
  }
  box.querySelector(".mk-tabs").addEventListener("click", function (e) {
    const b = e.target.closest("button[data-t]");
    if (b) show(b.dataset.t);
  });
  $("#mkFinish").addEventListener("click", function () {
    if (confirm("Завершить собеседование? Ответы уже не поменять.")) { clearInterval(tick); Mock.finish(box, d); }
  });
  clock(); show(d.tab || "s0");
};
```

Варианты в вопросах не перемешиваются (порядок «АБВГ» как в уроке): перемешивание без сохранения порядка в черновике сбило бы ответы после перезагрузки.

- [ ] **Step 5: Завершение и отчёт.**

```js
Mock.finish = async function (box, d) {
  Mock.drop();
  const now = Math.min(Date.now(), d.t0 + MockCore.MIN * 60000);
  box.innerHTML = '<p class="page-wait">Проверяю ответы…</p>';
  const sql = [];
  for (let i = 0; i < d.sql.length; i++) {
    const x = Mock.task(d.sql[i]), code = d.ran[x.id];
    let v = { ok: false, why: "нет ответа — запрос не запускался" };
    if (code) {
      try {
        const r = await Run.sql(code);
        v = r.err ? { ok: false, why: r.err } : Check.sql(r.res, x.expected, { code: code });
      } catch (e) { v = { ok: false, why: e.message }; }
    }
    sql.push({ x: x, code: code, v: v });
  }
  const quiz = d.quiz.map(function (r, i) {
    const q = window.CONTENT[r.id].quiz[r.n], ok = d.ans[i] === q.right;
    if (!ok) Review.record(r.id, r.n, false, false);
    return { r: r, q: q, ok: ok, a: d.ans[i] };
  });
  const c = Mock.kase(d.cas), key = String(d.t0);
  const rec = { sql: sql.filter(function (s) { return s.v.ok; }).length,
                quiz: quiz.filter(function (q) { return q.ok; }).length,
                cas: 0, casOf: c.check.length, mins: MockCore.mins(d.t0, now),
                ids: d.sql.concat([d.cas]) };
  Store.set("mock", key, rec);
  if (location.hash !== "#mock") return;
  Mock.report(box, d, sql, quiz, c, rec, key);
};
```

`Mock.report(box, d, sql, quiz, c, rec, key)` рисует в `box` (`id="mkReport"` у обёртки):
- `.prep-sum` (tabindex −1, фокус): `"SQL " + rec.sql + " из 3 · вопросы " + rec.quiz + " из 5 · кейс <span id="mkCas">0</span> из " + rec.casOf + " · " + rec.mins + " мин"`.
- `<h2>SQL</h2>`: по задаче — `<section class="mk-r">` с заголовком, «Совпало» / «Не совпало: » + `esc(v.why)` (`v.hint` — после, если есть), `<details><summary>Ваш запрос</summary><pre><code class="sql">…` (если был), `<details><summary>Эталонное решение</summary><pre><code class="sql">` + `esc(x.solution)`, ссылка «Повторить: урок N «…»» на `x.lesson` через `Course.byId`.
- `<h2>Вопросы</h2>`: по вопросу — текст, «Верно» / «Неверно: ваш ответ — …, верный — …» (без ответа — «нет ответа»), `q.why`, ссылка на урок `r.id`.
- `<h2>Кейс</h2>`: ответ ученика (`esc`, `white-space: pre-wrap`; пусто — «ответа нет»), эталон `c.ref`, чек-лист — кнопки `.prep-mark` + текст пункта; клик переключает `aria-pressed`, пересчитывает отмеченные, `Store.set("mock", key, Object.assign({}, rec, { cas: n }))` и обновляет `#mkCas`.
- «Уроки, к которым вернуться»: уникальные уроки из промахов SQL (`x.lesson`) и вопросов (`r.id`), список `.mt-back`.
- Кнопка `#mkAgain` «Пройти ещё раз — задания будут другие» → `Mock.run(box, Mock.start())`; ниже `Mock.hist()`.

- [ ] **Step 6: Стили** (в конец `styles.css`, только токены темы):

```css
/* ---------- пробное собеседование (#mock) ---------- */
.mk-bar { position: sticky; top: 0; z-index: 5; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px;
  padding: 8px 0; background: var(--paper); border-bottom: 1px solid var(--rule); }
.mk-clock { font-family: var(--mono); font-size: 18px; min-width: 5ch; color: var(--ink); }
.mk-clock.low { color: var(--red); }
.mk-tabs { margin: 0; flex-wrap: wrap; }
.mk-tabs button.has::after { content: " ✓"; color: var(--green); }
.mk-h { margin: 22px 0 8px; }
.mk-schema { margin: 12px 0; }
.mk-schema pre { overflow-x: auto; }
.mk-q { margin: 18px 0; }
.q-opt[aria-pressed="true"] { border-color: var(--pen); background: var(--pen-soft); }
.mk-lbl { display: block; margin: 16px 0 6px; color: var(--ink-2); }
.mk-text { width: 100%; box-sizing: border-box; font: inherit; font-size: 16px; padding: 10px; border: 1px solid var(--rule);
  border-radius: 6px; background: var(--paper); color: var(--ink); }
.mk-end { margin-top: 26px; }
.mk-r { margin: 16px 0; padding: 12px 14px; border: 1px solid var(--rule); border-radius: 8px; }
.mk-r .ok { color: var(--green); } .mk-r .no { color: var(--red); }
.mk-mine { white-space: pre-wrap; }
.mk-hist { margin-top: 14px; }
```

Перед вставкой сверить имена токенов с `:root` в `styles.css` (`grep -n "^\s*--" styles.css | head -40`); несуществующие заменить ближайшими.

- [ ] **Step 7: Браузер (Playwright, чистый контекст, devserver 8781).** Скрипт `scratchpad/mock/mock.js`:
  1. `#mock` на 390 px: видна кнопка `#mkStart`, `document.documentElement.scrollWidth <= 390`.
  2. Старт → в каждую SQL-вкладку вставить эталон (`window.MOCK` + `d.sql` из `sessionStorage`), нажать `#mkRun`, дождаться таблицы; ответить на вопросы верно (`CONTENT[...].quiz[n].right`); ввести текст кейса.
  3. Перезагрузить — открылась вкладка, на которой были, код на месте, часы меньше 45:00.
  4. «Завершить» (подтвердить `dialog.accept()`) → `.prep-sum` начинается с «SQL 3 из 3 · вопросы 5 из 5»; отметить 2 пункта чек-листа → «кейс 2 из».
  5. «Пройти ещё раз», ничего не делать, «Завершить» → «SQL 0 из 3»; в истории 2 строки; ни одна SQL-задача не повторилась.
  6. Время: в `sessionStorage` черновика уменьшить `t0` на 46 минут, перезагрузить → сразу отчёт, в истории «45».
  7. `merge`: `Store` через экспорт — вызвать импорт файла с другим ключом `mock` (кнопка «Загрузить» на главной или `Progress.accept` недоступен снаружи — тогда проверка через выгрузку файла и загрузку его во второй контекст, где уже есть одна попытка) → в истории обе.
  8. Без `sessionStorage`: `context.addInitScript(() => { Object.defineProperty(window, "sessionStorage", { get() { throw new Error("blocked"); } }); })` → попытка стартует, «Завершить» даёт отчёт, ошибок `pageerror` нет.
  9. Уход на `#m1l1` посреди попытки и обратно — та же попытка; на `#m1l1` не загружаются `interview.js` и `data-taxi.js`.
  10. Тёмная тема (`emulateMedia({ colorScheme: "dark" })`) и 1280 px — скриншоты в scratchpad, посмотреть глазами.

---

### Task 4: Ссылки, тексты, документация

**Files:**
- Modify: `app.js` — `renderInterview` (кнопка в `pageHead` extra), главная `prep-line` (стр. ~2353), `Find.places` (после `#interview`)
- Modify: `content-m6.js` — `solutionNote` урока `m6l8`: последний абзац
- Modify: `README.md` — раздел «Пробное собеседование» после «## Прогресс»; `ПРОГРЕСС.md` — числа пула
- Modify: `docs/superpowers/specs/2026-10-13-mock-interview-design.md` — вопросы рисуются своей разметкой, `testQuestion` не меняется

- [ ] **Step 1:** `renderInterview`: четвёртый аргумент `pageHead` — `'<div class="page-actions"><a class="btn primary" href="#mock">Пройти пробное собеседование</a></div>'`.
- [ ] **Step 2:** главная: после фразы про `#interview` — `'Проверить себя под таймером — <a href="#mock">пробное собеседование</a>. '`.
- [ ] **Step 3:** `Find.places`: `{ href: "#mock", title: "Пробное собеседование", where: "Раздел", note: "45 минут: три SQL-задачи на такси, пять вопросов и кейс", hay: "собеседование интервью пробное тренировка экзамен таймер mock" }`.
- [ ] **Step 4:** `m6l8.solutionNote` — абзац `<p><strong>Проверить себя.</strong> Незнакомые задачи на этой же базе под таймером — в <a href="#mock">пробном собеседовании</a>.</p>`.
- [ ] **Step 5:** README: формат `interview.js` (поля задачи и кейса, `--print`), раздел прогресса `mock` (ключ, поля, режим `merge`), где ссылки. ПРОГРЕСС.md: пул 12 задач / 4 кейса и ключевые числа из спека.
- [ ] **Step 6:** спек: строку «`testQuestion` получает необязательный флаг…» заменить на «вопросы попытки — своя разметка с кнопками `aria-pressed`, ответ меняется до завершения; `testQuestion` не меняется».
- [ ] **Step 7:** `bash инструменты/ci.sh` — красные только «Всё пересобрано» и «Версия сайта».

---

### Task 5: Ревью и выпуск

- [ ] **Step 1:** параллельно `engine-reviewer` (app.js, styles, офлайн, доступность, телефон, тёмная тема, `Store.merge`), `lesson-reviewer` (числа и тексты `interview.js`, тон), `student-walkthrough` (попытка глазами ученика после 6.4).
- [ ] **Step 2:** применить замечания; повторить `ci.sh` и браузерный скрипт Task 3.
- [ ] **Step 3:** с согласия владельца — коммит содержания (без `docs/ПЛАН-УЛУЧШЕНИЙ.md`), `bash инструменты/release.sh "Пробное собеседование" --trailer "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`, `git push -u origin mock-interview`, `gh pr create --base main`, команды владельцу.
