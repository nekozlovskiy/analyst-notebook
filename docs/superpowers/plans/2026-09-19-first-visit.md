# Первый визит: модуль 0 и пошаговый урок 0.1 — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Новичок, пришедший по ссылке, видит на главной «С чего начать» и за 45 минут в пошаговом уроке 0.1 проходит путь от первого `SELECT` до `GROUP BY`, после чего готов к задаче урока 1.1.

**Architecture:** Модуль `m0` с уроком `m0l1` в `lessons.js`, содержимое — `content-m0.js` с массивом `steps` вместо теории и задачи. В `app.js` общие части страницы урока выносятся из `renderLesson` в функции верхнего уровня, новый объект `Steps` рисует ленту шагов, а `renderStepsLesson` собирает из этих частей страницу пошагового урока. Прогресс шагов — новая корзина `steps` в `Store`, код шагов — корзина `code` под ключами `m0l1:sN`.

**Tech Stack:** обычный JS без сборки (в `app.js` — внутри одной IIFE, `function`-выражения, `const`/`let`, без `=>`), CSS с токенами из `styles.css`, sql.js в браузере, Node 26 со встроенным `node:sqlite` для скрипта проверки, `инструменты/devserver.py` для проверки в браузере.

**Spec:** `docs/superpowers/specs/2026-09-19-first-visit-design.md`

## Global Constraints

- Язык интерфейса и уроков — русский. Тон: без восклицаний; тире в прозе допустимо.
- Один акцент — `var(--pen)`. Зелёный и красный — только для состояний.
- Радиусы: контейнеры `var(--r-lg)` (13px), контролы `var(--r)` (7px). Других нет.
- Одна анимация на проект — `ink-in`, плюс существующая дорисовка галочки `penTick(..., "draw")`.
- Правило коробок: рамку получают только редактор (`.editor-shell`) и вывод (`.io-box`); шаги отчёркиваются линейками.
- Хранилище: ключ `da.state.v1`. Новая корзина `steps`: ключ `m0l1:N` (N с нуля), значение — время прохождения или `false`. Код шага — корзина `code`, ключ `m0l1:sN`.
- Номер урока — `m.num + "." + (i + 1)`; модуль 0 даёт номер 0.1, номера 1.1–6.6 не меняются.
- Шаги и карточки дописываются только в конец массива: номер — ключ в хранилище.
- Проверка SQL — `Check.sql` (имена столбцов, число строк, порядок при `ordered: true`, числа с допуском 0,011).
- Кнопки шага на ширине до 720px — не ниже 44px.
- В проекте нет автотестов. Содержание проверяют скрипты `node инструменты/checksteps.js` и `node инструменты/checkcards.js`, поведение — сниппеты в браузере через `javascript_tool` на сервере `course-dev` (порт 8779).

## Как проверять в браузере (для всех задач)

1. `preview_start` с `name: "course-dev"` — открывается http://localhost:8779.
2. Перед сниппетом со свежим кодом перезагрузить страницу с новым адресом, чтобы браузер не отдал старые файлы:
   ```js
   location.href = location.pathname + "?v=" + Date.now() + "#";
   ```
3. **Чистый профиль.** Адрес `http://127.0.0.1:8779` — другой origin, у него своё хранилище. Это тестовый адрес, стирать его можно:
   ```js
   localStorage.clear();
   Storage.prototype.setItem = function () {};   /* уходящая страница не должна записать своё */
   location.href = "http://127.0.0.1:8779/?v=" + Date.now() + "#";
   ```
4. **Засев состояния.** `Store.flush` срабатывает при уходе со страницы и затёр бы записанное, поэтому после записи глушим `setItem` на уходящей странице:
   ```js
   localStorage.setItem("da.state.v1", JSON.stringify(STATE));
   Storage.prototype.setItem = function () {};
   location.href = location.pathname + "?v=" + Date.now() + "#";
   ```
5. `Store.set` пишет с задержкой 220 мс — перед чтением `localStorage` ждать 400 мс.
6. Панель браузера может быть скрыта, тогда скриншоты пустые. Проверять текстом: `get_page_text`, `read_page`, `javascript_tool`.

---

### Task 1: Содержание урока 0.1 и скрипт проверки шагов

**Files:**
- Create: `content-m0.js`
- Create: `инструменты/checksteps.js`
- Modify: `content-core.js:7-24` — описание полей урока в шапке

**Interfaces:**
- Consumes: `window.SH.sqlSchema` из `content-core.js`, `window.DATA.shopSQL` из `data.js`.
- Produces: `window.CONTENT.m0l1` с полями `intro`, `duration`, `plan`, `schema`, `steps` (8 объектов `{ title, body, starter, expected: {ordered, columns, rows}, hint, solution }`), `after`, `cards` (8 × `{q, a}`), `links` (3). Команда `node инструменты/checksteps.js <урок> [--try <номер шага с 1> "<SQL>"]`, код выхода 1 при расхождении.

- [ ] **Step 1: Написать скрипт проверки шагов**

Создать `инструменты/checksteps.js`:

```js
#!/usr/bin/env node
/* Проверка шагов пошагового урока: решение каждого шага прогоняется
   на учебной базе и сверяется с expected по тем же правилам, что
   Check.sql в app.js — имена столбцов, число строк, порядок строк
   при ordered, числа с допуском 0.011.

     node инструменты/checksteps.js m0l1                     — все шаги
     node инструменты/checksteps.js m0l1 --try 3 "SELECT 1"  — что увидит
                                                               ученик на шаге 3

   Код выхода 1, если хоть один шаг не сошёлся или в шаге нет поля. */
"use strict";
const fs = require("fs"), vm = require("vm"), path = require("path");
const { DatabaseSync } = require("node:sqlite");

const base = path.resolve(__dirname, "..");
const ctx = { window: { SH: {}, CONTENT: {}, DATA: {} }, console };
vm.createContext(ctx);
const files = ["data.js", "content-core.js"].concat(
  fs.readdirSync(base).filter(function (f) { return /^content-m\d+\.js$/.test(f); }).sort());
for (const f of files) vm.runInContext(fs.readFileSync(path.join(base, f), "utf8"), ctx);

const args = process.argv.slice(2);
const id = args[0];
const C = ctx.window.CONTENT[id];
if (!C || !Array.isArray(C.steps)) { console.error(id + ": нет урока с шагами"); process.exit(1); }

const db = new DatabaseSync(":memory:");
db.exec(ctx.window.DATA.shopSQL);

function query(sql) {
  const st = db.prepare(sql);
  const columns = st.columns().map(function (c) { return c.name; });
  const values = st.all().map(function (row) { return columns.map(function (c) { return row[c]; }); });
  return { columns: columns, values: values };
}

/* ---- копия Check.cellEq и Check.sql из app.js ---- */
function cellEq(a, b) {
  if (a === null || a === undefined) a = "";
  if (b === null || b === undefined) b = "";
  const na = Number(a), nb = Number(b);
  if (a !== "" && b !== "" && !isNaN(na) && !isNaN(nb)) return Math.abs(na - nb) < 0.011;
  return String(a).trim() === String(b).trim();
}
function check(res, exp) {
  const gc = res.columns.map(function (c) { return String(c).toLowerCase().trim(); });
  const ec = exp.columns.map(function (c) { return c.toLowerCase(); });
  if (gc.length !== ec.length) return { ok: false, why: "столбцов " + gc.length + ", а нужно " + ec.length + " (" + exp.columns.join(", ") + ")" };
  for (let i = 0; i < ec.length; i++) {
    if (gc[i] !== ec[i]) return { ok: false, why: "столбец " + (i + 1) + " называется «" + res.columns[i] + "», а в задаче просят «" + exp.columns[i] + "» — задайте имя через AS" };
  }
  let got = res.values.slice(), want = exp.rows.slice();
  if (got.length !== want.length) return { ok: false, why: "строк " + got.length + ", а должно быть " + want.length };
  if (!exp.ordered) {
    const key = function (r) { return r.map(function (v) { return v === null ? "" : String(v); }).join("|"); };
    got = got.slice().sort(function (x, y) { return key(x) < key(y) ? -1 : 1; });
    want = want.slice().sort(function (x, y) { return key(x) < key(y) ? -1 : 1; });
  }
  for (let r = 0; r < want.length; r++) {
    for (let c = 0; c < want[r].length; c++) {
      if (!cellEq(got[r][c], want[r][c])) {
        return { ok: false, why: "строка " + (r + 1) + ", столбец «" + exp.columns[c] + "»: получилось " + JSON.stringify(got[r][c]) + ", ожидается " + JSON.stringify(want[r][c]) };
      }
    }
  }
  return { ok: true };
}

let bad = 0;
function report(n, sql) {
  const label = "шаг " + (n + 1);
  let res;
  try { res = query(sql); }
  catch (e) { console.log(label + "  ОШИБКА  " + e.message); bad++; return; }
  const r = check(res, C.steps[n].expected);
  console.log(label + "  " + (r.ok ? "ок" : "РАСХОЖДЕНИЕ  " + r.why) + "  (" + res.values.length + " строк)");
  if (!r.ok) bad++;
}

if (args[1] === "--try") {
  report(+args[2] - 1, args[3]);
} else {
  C.steps.forEach(function (s, n) {
    ["title", "body", "starter", "expected", "hint", "solution"].forEach(function (k) {
      if (s[k] === undefined || s[k] === "") { console.log("шаг " + (n + 1) + "  нет поля " + k); bad++; }
    });
    report(n, s.solution);
  });
}
process.exit(bad ? 1 : 0);
```

- [ ] **Step 2: Убедиться, что скрипт падает без урока**

Run: `node инструменты/checksteps.js m0l1; echo "код $?"`
Expected: `m0l1: нет урока с шагами` и `код 1`.

- [ ] **Step 3: Создать `content-m0.js`**

```js
/* ============================================================
   Модуль 0. Старт — пошаговый урок 0.1.
   Вместо теории и одной задачи — восемь шагов, у каждого свой
   редактор и своя проверка. Решения шагов проверены на учебной
   базе: node инструменты/checksteps.js m0l1
   ============================================================ */

window.CONTENT.m0l1 = {
  intro: "Первый запрос к базе за восемь шагов: от SELECT до группировки. Каждый шаг — одна новая мысль и маленькая задача, которую курс проверяет сам.",
  duration: "≈ 45 минут",
  plan: [
    { m: "35 мин", w: "Восемь шагов: от первого запроса до GROUP BY" },
    { m: "5 мин", w: "Карточки" },
    { m: "5 мин", w: "Как устроены следующие уроки" }
  ],
  schema: window.SH.sqlSchema,

  steps: [
    {
      title: "Таблица и первый запрос",
      body: `
<p>База данных — набор таблиц. В учебной базе «Дельта Маркет» их три: <code>users</code> — пользователи интернет-магазина, <code>orders</code> — их заказы, <code>events</code> — действия на сайте. Каждая строка таблицы — один объект, каждый столбец — одно его свойство.</p>
<p>Запрос — просьба к базе показать данные. <code>SELECT *</code> значит «все столбцы», <code>FROM users</code> — из какой таблицы, <code>LIMIT 5</code> — не больше пяти строк. Точка с запятой завершает запрос.</p>
<p><strong>Задание.</strong> Запрос уже написан. Нажмите «Запустить» — под редактором появится таблица. Потом «Проверить»: курс сравнит ваш результат с эталоном. Так устроены все задачи курса.</p>`,
      starter: "SELECT *\nFROM users\nLIMIT 5;",
      expected: { ordered: false, columns: ["user_id", "signup_date", "channel", "city", "platform"],
        rows: [
          [1, "2024-06-12", "organic", "Новосибирск", "ios"], [2, "2024-02-05", "social", "Казань", "ios"],
          [3, "2024-04-18", "organic", "Москва", "ios"], [4, "2024-05-09", "social", "Казань", "ios"],
          [5, "2024-06-15", "social", "Екатеринбург", "ios"]
        ] },
      hint: "Здесь ничего писать не нужно: нажмите «Проверить». Если редактор пуст, наберите запрос заново: <code>SELECT * FROM users LIMIT 5;</code>",
      solution: "SELECT *\nFROM users\nLIMIT 5;"
    },
    {
      title: "Нужные столбцы",
      body: `
<p>Звёздочка выводит все столбцы, но обычно нужны два-три. Их перечисляют после <code>SELECT</code> через запятую, в том порядке, в каком хотите видеть: <code>SELECT city, user_id FROM users</code>.</p>
<p>Имена столбцов пишут точно как в базе: <code>user_id</code>, а не <code>id</code> и не <code>userid</code>. Все столбцы перечислены в блоке «Какие таблицы есть в базе» над шагами.</p>
<p><strong>Задание.</strong> Выведите <code>user_id</code>, <code>channel</code> и <code>platform</code> первых десяти пользователей.</p>`,
      starter: "SELECT *\nFROM users\nLIMIT 10;",
      expected: { ordered: false, columns: ["user_id", "channel", "platform"],
        rows: [
          [1, "organic", "ios"], [2, "social", "ios"], [3, "organic", "ios"], [4, "social", "ios"],
          [5, "social", "ios"], [6, "organic", "web"], [7, "social", "ios"], [8, "referral", "ios"],
          [9, "organic", "android"], [10, "social", "ios"]
        ] },
      hint: "Вместо <code>*</code> — три имени через запятую: <code>user_id, channel, platform</code>. После последнего запятая не нужна.",
      solution: "SELECT user_id, channel, platform\nFROM users\nLIMIT 10;"
    },
    {
      title: "Отфильтровать строки: WHERE",
      body: `
<p><code>WHERE</code> оставляет только строки, для которых условие верно. Условие пишут после <code>FROM</code>: <code>WHERE platform = 'ios'</code>.</p>
<p>Текст берут в одинарные кавычки, числа — без кавычек. Сравнение — одним знаком <code>=</code>, а не двумя, как в Python. Регистр в тексте важен: <code>'Казань'</code> и <code>'казань'</code> — разные значения.</p>
<p><strong>Задание.</strong> Выведите <code>user_id</code> и <code>signup_date</code> всех пользователей из Казани. <code>LIMIT</code> здесь не нужен: нужны все такие строки.</p>`,
      starter: "SELECT user_id, signup_date\nFROM users;",
      expected: { ordered: false, columns: ["user_id", "signup_date"],
        rows: [
          [2, "2024-02-05"], [4, "2024-05-09"], [10, "2024-01-12"], [17, "2024-06-23"],
          [19, "2024-03-10"], [22, "2024-02-24"], [25, "2024-05-23"], [30, "2024-04-29"],
          [37, "2024-02-11"], [41, "2024-05-04"], [42, "2024-02-02"], [47, "2024-03-27"],
          [58, "2024-05-20"], [62, "2024-04-26"], [64, "2024-01-15"], [65, "2024-03-21"],
          [66, "2024-05-15"], [68, "2024-03-01"], [73, "2024-01-19"], [77, "2024-06-29"],
          [80, "2024-02-09"], [99, "2024-05-10"], [101, "2024-03-08"], [102, "2024-03-21"],
          [104, "2024-01-01"], [106, "2024-06-19"], [112, "2024-02-23"], [115, "2024-03-13"],
          [125, "2024-05-09"], [140, "2024-04-29"], [155, "2024-03-18"], [157, "2024-06-18"],
          [160, "2024-04-21"], [161, "2024-03-10"], [162, "2024-04-29"], [167, "2024-03-07"],
          [168, "2024-03-11"], [172, "2024-03-03"], [177, "2024-05-03"], [188, "2024-04-16"],
          [193, "2024-02-10"], [194, "2024-01-01"], [200, "2024-06-01"], [205, "2024-06-21"],
          [212, "2024-04-12"], [217, "2024-01-14"], [220, "2024-03-20"]
        ] },
      hint: "Перед точкой с запятой добавьте строку <code>WHERE city = 'Казань'</code>. Кавычки одинарные, прямые, с обеих сторон.",
      solution: "SELECT user_id, signup_date\nFROM users\nWHERE city = 'Казань';"
    },
    {
      title: "Несколько условий: AND, OR, IN",
      body: `
<p>Условия соединяют словами <code>AND</code> — должны выполняться оба — и <code>OR</code> — хотя бы одно. Числа сравнивают знаками <code>&gt;</code>, <code>&lt;</code>, <code>&gt;=</code>, <code>&lt;=</code>, а «не равно» пишется <code>&lt;&gt;</code>.</p>
<p>Если подходят несколько значений одного столбца, вместо цепочки <code>OR</code> удобнее <code>IN</code>: <code>WHERE city IN ('Москва', 'Казань')</code>.</p>
<p>У заказа в таблице <code>orders</code> есть статус: <code>paid</code> — оплачен, <code>refunded</code> — возвращён, <code>pending</code> — ждёт оплаты. Выручку аналитик считает только по оплаченным.</p>
<p><strong>Задание.</strong> Выведите <code>order_id</code>, <code>user_id</code> и <code>revenue</code> оплаченных заказов дороже 5000 рублей.</p>`,
      starter: "SELECT order_id, user_id, revenue\nFROM orders;",
      expected: { ordered: false, columns: ["order_id", "user_id", "revenue"],
        rows: [
          [5, 3, 9071.54], [8, 7, 5096.46], [9, 11, 5307.88], [17, 14, 7642.6],
          [23, 21, 5886.6], [31, 40, 5662.35], [43, 55, 6507.41], [57, 67, 5856.44],
          [62, 69, 5081.69], [66, 74, 7437.5], [69, 76, 5991.43], [74, 80, 8173.74],
          [76, 80, 5554.07], [81, 83, 7340.23], [89, 91, 8835.71], [94, 96, 7779.49],
          [96, 98, 6037.09], [101, 103, 5709.58], [102, 103, 6549.78], [137, 134, 5449.45],
          [156, 156, 9550.87], [162, 160, 6578.38], [163, 163, 5998.98], [180, 176, 6774.12],
          [190, 196, 6310.9], [198, 205, 10177.29], [212, 217, 7196.22], [213, 217, 5153.53]
        ] },
      hint: "Два условия: статус равен <code>'paid'</code> и <code>revenue &gt; 5000</code>. Соедините их словом <code>AND</code> в одной строке <code>WHERE</code>.",
      solution: "SELECT order_id, user_id, revenue\nFROM orders\nWHERE status = 'paid' AND revenue > 5000;"
    },
    {
      title: "Сортировка и первые N: ORDER BY, LIMIT",
      body: `
<p>Без сортировки база отдаёт строки в том порядке, в каком ей удобно. <code>ORDER BY revenue</code> сортирует по возрастанию, <code>ORDER BY revenue DESC</code> — по убыванию.</p>
<p>Вместе с <code>LIMIT</code> это даёт «топ»: отсортировать и взять первые N строк. Порядок частей запроса всегда один: <code>SELECT</code>, <code>FROM</code>, <code>WHERE</code>, <code>ORDER BY</code>, <code>LIMIT</code>.</p>
<p><strong>Задание.</strong> Выведите пять самых дорогих оплаченных заказов: <code>order_id</code>, <code>user_id</code>, <code>revenue</code>, от самого дорогого.</p>`,
      starter: "SELECT order_id, user_id, revenue\nFROM orders\nWHERE status = 'paid';",
      expected: { ordered: true, columns: ["order_id", "user_id", "revenue"],
        rows: [
          [198, 205, 10177.29], [156, 156, 9550.87], [5, 3, 9071.54], [89, 91, 8835.71],
          [74, 80, 8173.74]
        ] },
      hint: "После <code>WHERE</code> добавьте <code>ORDER BY revenue DESC</code>, а за ним <code>LIMIT 5</code>. Точка с запятой — в самом конце.",
      solution: "SELECT order_id, user_id, revenue\nFROM orders\nWHERE status = 'paid'\nORDER BY revenue DESC\nLIMIT 5;"
    },
    {
      title: "Посчитать: COUNT, SUM, AVG",
      body: `
<p>Агрегатные функции сворачивают много строк в одно число. <code>COUNT(*)</code> — сколько строк, <code>SUM(revenue)</code> — сумма, <code>AVG(revenue)</code> — среднее. <code>ROUND(x, 2)</code> округляет до двух знаков.</p>
<p>Столбцу с расчётом дают имя через <code>AS</code>: <code>COUNT(*) AS orders_cnt</code>. Без имени столбец назовётся самой формулой, и отчёт будет трудно читать.</p>
<p><strong>Задание.</strong> Одной строкой посчитайте по оплаченным заказам: сколько их (<code>orders_cnt</code>), выручку (<code>revenue</code>) и средний чек (<code>avg_check</code>). Выручку и средний чек округлите до двух знаков.</p>`,
      starter: "SELECT COUNT(*) AS orders_cnt\nFROM orders\nWHERE status = 'paid';",
      expected: { ordered: true, columns: ["orders_cnt", "revenue", "avg_check"],
        rows: [
          [189, 653428.78, 3457.3]
        ] },
      hint: "Нужны ещё <code>SUM(revenue)</code> и <code>AVG(revenue)</code>. Каждую оберните в <code>ROUND(…, 2)</code>, дайте имя через <code>AS</code> и отделите от соседей запятой.",
      solution: "SELECT COUNT(*) AS orders_cnt,\n       ROUND(SUM(revenue), 2) AS revenue,\n       ROUND(AVG(revenue), 2) AS avg_check\nFROM orders\nWHERE status = 'paid';"
    },
    {
      title: "По группам: GROUP BY",
      body: `
<p><code>GROUP BY</code> делит строки на группы с одинаковым значением и считает агрегат для каждой группы отдельно. <code>GROUP BY city</code> вместе с <code>COUNT(*)</code> — сколько пользователей в каждом городе, одна строка на город.</p>
<p>В <code>SELECT</code> такого запроса стоят столбец группировки и агрегаты. Другие столбцы туда не пишут: у группы нет одного <code>user_id</code>, их в ней много.</p>
<p>Сортировать можно по имени, которое дали через <code>AS</code>.</p>
<p><strong>Задание.</strong> Посчитайте, сколько пользователей пришло из каждого канала: <code>channel</code> и <code>users_cnt</code>, от большего к меньшему.</p>`,
      starter: "SELECT channel\nFROM users;",
      expected: { ordered: true, columns: ["channel", "users_cnt"],
        rows: [
          ["organic", 75], ["paid_search", 55], ["social", 42], ["email", 28],
          ["referral", 14], ["partner", 6]
        ] },
      hint: "Рядом с <code>channel</code> — <code>COUNT(*) AS users_cnt</code>. После <code>FROM</code> — <code>GROUP BY channel</code>, затем <code>ORDER BY users_cnt DESC</code>.",
      solution: "SELECT channel, COUNT(*) AS users_cnt\nFROM users\nGROUP BY channel\nORDER BY users_cnt DESC;"
    },
    {
      title: "Всё вместе",
      body: `
<p>Части запроса идут в одном порядке: <code>SELECT</code>, <code>FROM</code>, <code>WHERE</code>, <code>GROUP BY</code>, <code>ORDER BY</code>, <code>LIMIT</code>. <code>WHERE</code> отбирает строки до группировки, поэтому возвраты и неоплаченные заказы в сумму не попадут.</p>
<p>Это последний шаг. Следующий урок учит соединять две таблицы, и его задача опирается ровно на то, что вы сейчас напишете.</p>
<p><strong>Задание.</strong> Найдите пятёрку покупателей, принёсших больше всего выручки оплаченными заказами: <code>user_id</code>, число заказов <code>orders_cnt</code> и выручка <code>revenue</code> с округлением до двух знаков, от большей к меньшей.</p>`,
      starter: "-- соберите запрос сами: SELECT, FROM, WHERE, GROUP BY, ORDER BY, LIMIT\n",
      expected: { ordered: true, columns: ["user_id", "orders_cnt", "revenue"],
        rows: [
          [103, 4, 17772.89], [14, 4, 17683.24], [80, 3, 15780.77], [195, 4, 15687.37],
          [3, 4, 15301.0]
        ] },
      hint: "Возьмите запрос из шага 6 и добавьте две вещи: <code>user_id</code> в начало списка столбцов и <code>GROUP BY user_id</code> после <code>WHERE</code>. Дальше — <code>ORDER BY revenue DESC</code> и <code>LIMIT 5</code>.",
      solution: "SELECT user_id,\n       COUNT(*) AS orders_cnt,\n       ROUND(SUM(revenue), 2) AS revenue\nFROM orders\nWHERE status = 'paid'\nGROUP BY user_id\nORDER BY revenue DESC\nLIMIT 5;"
    }
  ],

  after: `
<p>Дальше уроки длиннее, около двух часов каждый, и устроены одинаково.</p>
<ul>
<li><strong>Теория</strong> с разобранными примерами — полчаса чтения.</li>
<li><strong>Карточки</strong> — вспомнить без подсказки то, что только что прочитали.</li>
<li><strong>Основная задача</strong> в виде рабочего тикета от коллеги. К ней три подсказки, от наводящего вопроса к разбору, а решение открывается после трёх попыток.</li>
<li><strong>Тренажёр</strong> — ещё несколько задач на ту же базу, потом <strong>самопроверка</strong> вопросами и <strong>что почитать</strong>.</li>
</ul>
<p>Прогресс, код и заметки сохраняются сами, в этом браузере. Карточки и вопросы самопроверки возвращаются на главную в раздел повторения через день, три дня, неделю и три недели — так материал доживает до собеседования.</p>
<p>Косая черта <code>/</code> открывает поиск по курсу, знак вопроса <code>?</code> — список остальных клавиш.</p>`,

  cards: [
    { q: "Что делает запрос <code>SELECT * FROM users LIMIT 5</code>?",
      a: "Выводит все столбцы таблицы <code>users</code>, но не больше пяти строк. <code>*</code> — все столбцы, <code>LIMIT</code> — сколько строк показать." },
    { q: "Как вывести только нужные столбцы?",
      a: "Перечислить их после <code>SELECT</code> через запятую, в нужном порядке: <code>SELECT user_id, channel FROM users</code>. Имена пишут точно как в базе." },
    { q: "Как оставить только строки, для которых выполняется условие?",
      a: "Написать <code>WHERE</code> после <code>FROM</code>: <code>WHERE city = 'Казань'</code>. Текст — в одинарных кавычках, сравнение — одним знаком <code>=</code>." },
    { q: "Чем <code>AND</code> отличается от <code>OR</code> и когда удобнее <code>IN</code>?",
      a: "<code>AND</code> — должны выполняться оба условия, <code>OR</code> — хотя бы одно. <code>IN ('Москва', 'Казань')</code> заменяет цепочку <code>OR</code> по одному столбцу." },
    { q: "Как получить пять самых дорогих заказов?",
      a: "Отсортировать по убыванию и взять первые пять: <code>ORDER BY revenue DESC LIMIT 5</code>. Без <code>DESC</code> сортировка идёт по возрастанию." },
    { q: "Что делают <code>COUNT(*)</code>, <code>SUM</code> и <code>AVG</code>?",
      a: "Сворачивают строки в одно число: количество строк, сумму и среднее. Столбцу с расчётом дают имя через <code>AS</code>." },
    { q: "Что делает <code>GROUP BY channel</code> вместе с <code>COUNT(*)</code>?",
      a: "Делит строки на группы по каналу и считает строки в каждой: одна строка результата на канал. В <code>SELECT</code> оставляют только столбец группировки и агрегаты." },
    { q: "В каком порядке идут части запроса?",
      a: "<code>SELECT</code>, <code>FROM</code>, <code>WHERE</code>, <code>GROUP BY</code>, <code>ORDER BY</code>, <code>LIMIT</code>. <code>WHERE</code> отбирает строки до группировки." }
  ],

  links: [
    { t: "Выборка данных из таблицы", url: "https://postgrespro.ru/docs/postgresql/16/tutorial-select", src: "postgrespro.ru", lang: "RU",
      d: "Глава учебника PostgreSQL про SELECT, WHERE и ORDER BY. Коротко и с примерами, синтаксис тот же, что в уроке." },
    { t: "Агрегатные функции", url: "https://postgrespro.ru/docs/postgresql/16/tutorial-agg", src: "postgrespro.ru", lang: "RU",
      d: "Продолжение того же учебника: COUNT, SUM, AVG, GROUP BY и чем WHERE отличается от HAVING — к этому вернётся урок 1.3." },
    { t: "SQLBolt", url: "https://sqlbolt.com/", src: "sqlbolt.com", lang: "EN",
      d: "Интерактивные упражнения по основам SQL прямо в браузере. Хорошо закрепляет шаги этого урока, если хочется ещё практики." }
  ]
};
```

- [ ] **Step 4: Прогнать шаги**

Run: `node инструменты/checksteps.js m0l1; echo "код $?"`
Expected: восемь строк `шаг N  ок  (…)` с числом строк 5, 10, 47, 28, 5, 1, 6, 5 и `код 0`.

- [ ] **Step 5: Проверить, что скрипт ловит неверный ответ**

Run: `node инструменты/checksteps.js m0l1 --try 3 "SELECT user_id, signup_date FROM users;"; echo "код $?"`
Expected: `шаг 3  РАСХОЖДЕНИЕ  строк 220, а должно быть 47  (220 строк)` и `код 1`.

Run: `node инструменты/checksteps.js m0l1 --try 6 "SELECT COUNT(*) FROM orders WHERE status = 'paid';"; echo "код $?"`
Expected: `шаг 6  РАСХОЖДЕНИЕ  столбцов 1, а нужно 3 (orders_cnt, revenue, avg_check)  (1 строк)` и `код 1`.

- [ ] **Step 6: Проверить, что в тексте нет посторонних символов**

Run: `python3 -c "import pathlib; s=pathlib.Path('content-m0.js').read_text(encoding='utf-8'); print(sorted({c for c in s if 0x2E00 < ord(c) < 0xFF00}))"`
Expected: `[]`

- [ ] **Step 7: Описать новые поля в шапке `content-core.js`**

В комментарии «Поля урока» после строки с `links` добавить:

```
     steps      — пошаговый урок (0.1): [{title, body, starter, expected,
                  hint, solution}] вместо theory, ticket, starter, expected,
                  hints, drills и quiz; шаги дописывают только в конец;
                  проверка: node инструменты/checksteps.js <урок>
     after      — HTML после шагов: как устроены следующие уроки
```

- [ ] **Step 8: Commit**

```bash
git add content-m0.js инструменты/checksteps.js content-core.js
git commit -m "Урок 0.1: восемь шагов от SELECT до GROUP BY и скрипт их проверки

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Общие части страницы урока — вынос из renderLesson

Поведение обычных уроков не меняется. Задача только готовит части, из которых в Task 3 соберётся страница пошагового урока.

**Files:**
- Modify: `app.js` — новые функции между `defaultPlan` и `renderLesson`; правки внутри `renderLesson`

**Interfaces:**
- Consumes: `Course`, `Store`, `Review.record`, `Flash.card`, `Router.cleanup`, `refreshBar`, `esc`, `$`, `el`, `isoDay`, `loadCSS`, `loadScript`, `CDN`, `defaultPlan` — всё уже есть в `app.js`.
- Produces (функции верхнего уровня внутри IIFE):
  - `lessonHeadHtml(L, C, kindLabel) → string` — шапка урока с планом;
  - `secNavHtml(secs) → string`, где `secs = [{id, t}]`;
  - `mountReadbar(secs) → void`;
  - `cardsBlockHtml() → string` и `mountDeck(id, C) → void`;
  - `linksBlockHtml(C) → string`;
  - `mountLessonNav(id, onUnmark) → update: function()`; `onUnmark` может быть `null`;
  - `mountTimer(id) → void`;
  - `mountEditor(ta, kind, value, onChange, onRun, onFail) → Promise<{get: function(): string, set: function(string)} | null>`; `null` — страницу сменили, пока грузился редактор.

- [ ] **Step 1: Снять исходное поведение урока 1.1**

Запустить `course-dev`, открыть http://localhost:8779/#m1l1 и выполнить:

```js
await new Promise(r => setTimeout(r, 1500));
({ plan: document.querySelectorAll(".plan-item").length,
   nav: [...document.querySelectorAll(".secnav a")].map(a => a.textContent).join(","),
   deck: !!document.querySelector("#deck .fc"),
   links: document.querySelectorAll(".link-card").length,
   lnav: document.getElementById("lnav").innerText.replace(/\n/g, " | "),
   timer: document.getElementById("timer").textContent })
```

Записать результат — после рефакторинга он должен совпасть. Ожидаемо: `plan: 5`, `nav: "Теория,Карточки,Задача,Тренажёр,Самопроверка,Что почитать,Заметки"`, `deck: true`, `links > 0`, `timer: "время идёт"`.

- [ ] **Step 2: Добавить функции частей страницы**

В `app.js` сразу после функции `defaultPlan` (перед `function renderLesson(app, id) {`) вставить:

```js
/* ============================================================
   Части страницы урока

   Обычный урок и пошаговый (0.1) собраны из одних и тех же частей:
   шапка с планом, якорная навигация, полоса прочитанного, колода
   карточек, ссылки, нижняя навигация, таймер и редактор.
   ============================================================ */

/* шапка: реплика на поле, номер и вид урока, таймер, заголовок, план */
function lessonHeadHtml(L, C, kindLabel) {
  const plan = C.plan || defaultPlan(C);
  let planHtml = '<div class="plan"><div class="plan-h"><span>План занятия</span>' +
    '<span class="total">' + esc(C.duration || "≈ 2 часа") + "</span></div>" +
    '<div class="plan-list" style="--plan-cols:' + Math.min(plan.length, 5) + '">';
  plan.forEach(function (p) {
    planHtml += '<div class="plan-item"><div class="m">' + esc(p.m) + '</div><div class="w">' + esc(p.w) + "</div></div>";
  });
  planHtml += "</div></div>";
  return '<header class="lesson-head has-margin">' +
      (L.say ? '<div class="aside"><p>' + esc(L.say) + "</p></div>" : "") +
      '<div class="kicker"><span>Урок ' + L.num + ", " + esc(kindLabel) + "</span>" +
        '<button class="timer" id="timer" type="button" title="Время урока считается само и видно на главной. Клик — пауза">время идёт</button></div>' +
      "<h1>" + esc(L.title) + "</h1>" +
      '<p class="sub">' + esc(C.intro || L.desc) + "</p>" +
      planHtml +
    "</header>";
}

/* якорная навигация по разделам урока */
function secNavHtml(secs) {
  let navHtml = '<nav class="secnav" id="secnav"><div class="secnav-in">';
  secs.forEach(function (s, i) {
    navHtml += '<a href="#' + s.id + '" data-sec="' + s.id + '"' + (i === 0 ? ' class="on"' : "") + ">" + s.t + "</a>";
  });
  return navHtml + "</div></nav>";
}

/* полоса прочитанного и подсветка активного раздела в навигации */
function mountReadbar(secs) {
  const bar = el("div", { class: "readbar", id: "readbar" });
  document.body.appendChild(bar);
  /* В уроке две полосы прогресса не нужны: здесь важно, сколько
     осталось до конца страницы, а сколько пройдено курса — сказано
     словами на кнопке в шапке. */
  document.body.classList.add("reading");
  const links = Array.prototype.slice.call(document.querySelectorAll(".secnav a"));
  let ticking = false;

  function upd() {
    ticking = false;
    const h = document.documentElement;
    const max = h.scrollHeight - h.clientHeight;
    bar.style.width = (max > 0 ? Math.min(100, h.scrollTop / max * 100) : 0) + "%";

    const line = h.scrollTop + h.clientHeight * 0.32;
    let cur = secs[0].id;
    for (let i = 0; i < secs.length; i++) {
      const n = document.getElementById(secs[i].id);
      if (n && n.offsetTop <= line) cur = secs[i].id;
    }
    links.forEach(function (a) { a.classList.toggle("on", a.dataset.sec === cur); });
  }
  function onScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(upd); }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  upd();
  Router.cleanup.push(function () {
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onScroll);
    document.body.classList.remove("reading");
    const b = document.getElementById("readbar");
    if (b) b.remove();
  });
}

/* Карточки — сразу после теории: прочитал — вспомнил без подсказки — применил в задаче. */
function cardsBlockHtml() {
  return '<section class="block" id="s-cards">' +
    '<div class="block-h"><h2>Карточки</h2></div>' +
    '<p class="block-intro">Не подглядывая в теорию: сначала ответьте в голове, потом откройте ответ ' +
    "и честно оцените себя. С завтрашнего дня карточки будут возвращаться в повторение на главной.</p>" +
    '<div class="deck" id="deck"></div></section>';
}

/* Колода карточек. Первый прогон ставит карточки в расписание повторения
   (запись пропускается, если карточка там уже есть). Прогон «ещё раз»
   только закрепляет и расписание не трогает. */
function mountDeck(id, C) {
  const deck = $("#deck");
  const every = C.cards.map(function (c, k) { return k; });
  const runDeck = function (list, record) {
    let i = 0, yes = 0, fresh = 0;
    const missed = [];
    const finish = function () {
      const tail = !record ? "Расписание повторения этот прогон не меняет."
        : fresh ? "Завтра карточки вернутся в повторение на главной."
        : "Эти карточки уже в расписании повторения, прогон его не сдвинул.";
      deck.innerHTML = '<div class="fc-done"><p>Вспомнили ' + yes + " из " + list.length + ". " + tail + "</p>" +
        '<button class="btn" id="deckAgain" type="button">' +
        (missed.length ? "Ещё раз невспомненные: " + missed.length : "Прогнать ещё раз") + "</button></div>";
      $("#deckAgain").addEventListener("click", function () {
        runDeck(missed.length ? missed : every, false);
        $(".fc-show", deck).focus({ preventScroll: true });
      });
    };
    const show = function () {
      if (i >= list.length) { finish(); return; }
      const n = list[i];
      Flash.card(deck, C.cards[n], (i + 1) + " из " + list.length, function (ok) {
        if (record && Review.record(id, "c" + n, ok, true)) fresh++;
        if (ok) yes++; else missed.push(n);
        i++;
        show();
        /* фокус на следующую кнопку, чтобы колоду можно было пройти с клавиатуры */
        const b = $(".fc-show", deck) || $("#deckAgain");
        if (b) b.focus({ preventScroll: true });
      });
    };
    show();
  };
  runDeck(every, true);
}

/* что почитать дальше */
function linksBlockHtml(C) {
  let html = '<section class="block" id="s-links">' +
    '<div class="block-h"><h2>Что почитать дальше</h2></div>' +
    '<p class="block-intro">Материалы открываются в новой вкладке. Помеченные EN на английском: ' +
    "читать документацию по-английски аналитику всё равно придётся, лучше начать сейчас.</p>" +
    '<div class="links">';
  C.links.forEach(function (l) {
    html += '<a class="link-card" href="' + esc(l.url) + '" target="_blank" rel="noopener noreferrer">' +
      '<div class="lk-src"><span>' + esc(l.src) + "</span>" +
      (l.lang ? '<span class="lang">' + esc(l.lang) + "</span>" : "") + "</div>" +
      '<div class="lk-t">' + esc(l.t) + "</div>" +
      '<div class="lk-d">' + esc(l.d) + "</div></a>";
  });
  return html + "</div></section>";
}

/* Нижняя навигация: соседние уроки и отметка «пройден».
   onUnmark — что ещё сбросить, когда отметку снимают (может быть null).
   Возвращает функцию перерисовки. */
function mountLessonNav(id, onUnmark) {
  function update() {
    const prev = Course.neighbour(id, -1), next = Course.neighbour(id, 1);
    const done = Course.isDone(id);
    /* Стрелка вынесена из подписи отдельным значком: тогда длинное
       название урока обрезается многоточием, а стрелка остаётся
       на месте — иначе на телефоне срезало бы именно её. */
    const link = function (l, dir) {
      const arrow = '<span class="nl-a">' + (dir < 0 ? "&larr;" : "&rarr;") + "</span>";
      const text = '<span class="nl-t">' + esc(l ? l.num + " " + l.title
        : dir < 0 ? "начало курса" : "дальше — новые уроки") + "</span>";
      const body = dir < 0 ? arrow + text : text + arrow;
      return l ? '<a class="navlink" href="#' + l.id + '">' + body + "</a>"
               : '<span class="navlink dim">' + body + "</span>";
    };
    $("#lnav").innerHTML =
      link(prev, -1) +
      '<a class="navlink" href="#">Карта курса</a>' +
      '<span class="spacer"></span>' +
      '<button class="btn ' + (done ? "" : "check") + '" id="markBtn" type="button"' +
        (done ? "" : " disabled") + ">" +
        (done ? "&#10003; Пройден — снять отметку" : "Отметить как пройденный") + "</button>" +
      link(next, 1);

    const mb = $("#markBtn");
    if (!done) mb.title = "Станет активной, когда «Проверить» покажет зелёный результат";
    mb.addEventListener("click", function () {
      if (Course.isDone(id)) {
        Store.set("done", id, false);
        if (onUnmark) onUnmark();
      }
      update();
      refreshBar();
    });
  }
  update();
  return update;
}

/* Таймер урока. Секундомер на экране давит, поэтому времени не видно:
   оно считается само и показывается на главной. Пауза — если отошли
   от открытого урока. Время по календарным дням — для серии на главной. */
function mountTimer(id) {
  let secs = Store.get("time", id, 0);
  let day = isoDay(), daySecs = Store.get("days", day, 0);
  let running = true;
  const btn = $("#timer");
  const tick = setInterval(function () {
    if (!running || document.hidden) return;
    secs += 1;
    const d = isoDay();
    if (d !== day) { Store.set("days", day, daySecs); day = d; daySecs = Store.get("days", day, 0); }
    daySecs += 1;
    if (secs % 10 === 0) { Store.set("time", id, secs); Store.set("days", day, daySecs); }
  }, 1000);
  btn.addEventListener("click", function () {
    running = !running;
    btn.classList.toggle("paused", !running);
    btn.textContent = running ? "время идёт" : "на паузе";
    btn.title = running ? "Время урока считается само и видно на главной. Клик — пауза"
                        : "Время не считается. Клик — продолжить";
  });
  Router.cleanup.push(function () {
    clearInterval(tick);
    if (secs > 0) Store.set("time", id, secs);
    if (daySecs > 0) Store.set("days", day, daySecs);
  });
}

/* Редактор кода: CodeMirror с подсветкой, а если он не загрузился —
   обычное поле ввода. Промис отдаёт {get, set} или null, если страницу
   успели сменить. onRun — Cmd/Ctrl+Enter в CodeMirror; onFail — вызвать,
   когда пришлось обойтись полем без подсветки. */
function mountEditor(ta, kind, value, onChange, onRun, onFail) {
  loadCSS(CDN.cmBase + "codemirror.min.css");
  return loadScript(CDN.cmBase + "codemirror.min.js").then(function () {
    return loadScript(CDN.cmBase + "mode/" + (kind === "sql" ? "sql/sql" : "python/python") + ".min.js");
  }).then(function () {
    if (!ta || !document.body.contains(ta)) return null;   /* урок успели сменить */
    const cm = window.CodeMirror.fromTextArea(ta, {
      mode: kind === "sql" ? "text/x-sqlite" : "python",
      lineNumbers: true, indentUnit: 4, tabSize: 4,
      lineWrapping: true, viewportMargin: Infinity,
      extraKeys: {
        "Cmd-Enter": onRun, "Ctrl-Enter": onRun,
        Tab: function (c) { c.replaceSelection("    "); }
      }
    });
    cm.setValue(value);
    cm.on("change", function () { onChange(cm.getValue()); });
    return { get: function () { return cm.getValue(); }, set: function (v) { cm.setValue(v); } };
  }).catch(function () {
    if (!ta || !document.body.contains(ta)) return null;
    ta.style.cssText = "width:100%;min-height:320px;font-family:var(--mono);font-size:14.5px;" +
      "line-height:1.62;border:0;padding:14px 16px;background:transparent;color:var(--ink);resize:vertical";
    ta.value = value;
    ta.addEventListener("input", function () { onChange(ta.value); });
    if (onFail) onFail();
    return { get: function () { return ta.value; }, set: function (v) { ta.value = v; } };
  });
}
```

- [ ] **Step 3: Перевести renderLesson на новые функции**

Внутри `renderLesson` сделать замены.

3a. Удалить строку `  const plan = C.plan || defaultPlan(C);`.

3b. Удалить блок целиком — от строки `  /* ---------- план урока ---------- */` до строки `  planHtml += "</div></div>";` включительно.

3c. В блоке «якорная навигация» оставить построение `secs` и удалить всё от `  let navHtml = '<nav class="secnav" id="secnav"><div class="secnav-in">';` до `  navHtml += "</div></nav>";` включительно.

3d. Удалить блок `/* ---------- карточки ---------- */` вместе с комментарием под ним — от `  let cardsHtml = "";` до закрывающей `  }` этого `if (hasCards)`.

3e. Удалить блок `/* ---------- ссылки ---------- */` — от `  let linksHtml = "";` до закрывающей `  }` его `if (hasLinks)`.

3f. В `main.innerHTML` заменить шапку — от `'<header class="lesson-head has-margin">' +` до `"</header>" +` включительно — на:

```js
    lessonHeadHtml(L, C, kindLabel) +
```

и там же заменить `navHtml +` на `secNavHtml(secs) +`, `cardsHtml +` на `(hasCards ? cardsBlockHtml() : "") +`, а строку `drillsHtml + quizHtml + linksHtml +` на:

```js
    drillsHtml + quizHtml + (hasLinks ? linksBlockHtml(C) : "") +
```

3g. Заменить IIFE `/* ---------- полоса прочитанного + подсветка активной секции ---------- */` — от `  (function () {` до `  })();` — на:

```js
  /* ---------- полоса прочитанного + подсветка активной секции ---------- */
  mountReadbar(secs);
```

3h. Заменить блок `/* ---------- колода карточек ---------- */` с комментарием и `if (hasCards) { … runDeck(every, true); }` на:

```js
  /* ---------- колода карточек ---------- */
  if (hasCards) mountDeck(id, C);
```

3i. Заменить блок `/* ---------- редактор ---------- */` — от `  let cm = null, answerEl = null;` до конца функции `getCode` включительно — на:

```js
  /* ---------- редактор ---------- */
  let editor = null, answerEl = null;
  const savedCode = Store.get("code", id, null);

  if (isText) {
    answerEl = $("#answer");
    answerEl.value = savedCode || "";
    answerEl.addEventListener("input", function () { Store.set("code", id, answerEl.value); });
  } else {
    mountEditor($("#editor"), L.kind, savedCode !== null ? savedCode : (C.starter || ""),
      function (v) { Store.set("code", id, v); }, run,
      function () {
        setStatus("warn", "Редактор без подсветки синтаксиса",
          "CodeMirror не загрузился — похоже, нет интернета. Код всё равно можно писать и запускать.");
      }
    ).then(function (ed) { editor = ed; });
    $("#resetBtn").addEventListener("click", function () {
      if (!confirm("Вернуть начальный шаблон? Ваш код будет потерян.")) return;
      const v = C.starter || "";
      if (editor) editor.set(v); else $("#editor").value = v;
      Store.set("code", id, v);
    });
  }

  function getCode() {
    if (isText) return answerEl.value;
    return editor ? editor.get() : $("#editor").value;
  }
```

3j. Заменить блок `/* ---------- нижняя навигация ---------- */` — от `  function updateNav() {` до строки `  updateNav();` сразу после функции — на:

```js
  /* ---------- нижняя навигация ---------- */
  const updateNav = mountLessonNav(id, null);
```

(`pass()` вызывает `updateNav()` только по нажатию «Проверить», то есть уже после этой строки.)

3k. Заменить IIFE `/* ---------- таймер ---------- */` — от `  (function () {` до `  })();` — на:

```js
  /* ---------- таймер ---------- */
  mountTimer(id);
```

- [ ] **Step 4: Проверить, что ссылок на удалённые имена не осталось**

Run: `grep -n "planHtml\|navHtml\|cardsHtml\|linksHtml\|runDeck\|cm\.getValue\|cm = " app.js`
Expected: совпадения только внутри новых функций (`lessonHeadHtml`, `secNavHtml`, `mountDeck`, `mountEditor`), ни одного внутри `renderLesson`.

Run: `node -e "new Function(require('fs').readFileSync('app.js','utf8'))" && echo синтаксис ок`
Expected: `синтаксис ок`

- [ ] **Step 5: Повторить снимок урока 1.1 и сравнить**

Перезагрузить страницу по правилу 2 (`#m1l1`) и выполнить сниппет из Step 1. Результат должен совпасть с записанным.

- [ ] **Step 6: Проверить запуск и проверку в обычных уроках**

На `#m1l1`:

```js
await new Promise(r => setTimeout(r, 1500));
const cmx = document.querySelector(".CodeMirror").CodeMirror;
cmx.setValue("SELECT 1 AS x;");
document.getElementById("runBtn").click();
await new Promise(r => setTimeout(r, 3000));
document.getElementById("checkBtn").click();
const wrong = document.getElementById("status").innerText;
cmx.setValue(window.CONTENT.m1l1.solution);
document.getElementById("runBtn").click();
await new Promise(r => setTimeout(r, 1500));
document.getElementById("checkBtn").click();
await new Promise(r => setTimeout(r, 400));
({ wrong, right: document.getElementById("status").innerText,
   mark: document.getElementById("markBtn").innerText,
   saved: JSON.parse(localStorage.getItem("da.state.v1")).code.m1l1.slice(0, 40) })
```

Expected: `wrong` начинается с «Результат не совпадает», `right` — с «Задание выполнено», `mark` — «✓ Пройден — снять отметку», `saved` — начало решения урока 1.1. Затем нажать `#markBtn` и убедиться, что кнопка снова «Отметить как пройденный» (отметку снять, чтобы не менять профиль).

На текстовом уроке `#m4l1`: поле `#answer` есть, ввод сохраняется в `code.m4l1`. На `#m2l1` (Python): «Запустить» с решением урока за 15–40 секунд даёт вывод без ошибки. Консоль без ошибок (`read_console_messages` с `onlyErrors: true`).

- [ ] **Step 7: Commit**

```bash
git add app.js
git commit -m "Урок: шапка, навигация, колода, ссылки, таймер и редактор — отдельными функциями

Поведение обычных уроков не меняется; из этих частей соберётся
пошаговый урок 0.1.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Пошаговый урок — лента шагов, прогресс, модуль 0

**Files:**
- Modify: `app.js:36-37` — `EMPTY` в `Store`: корзина `steps`
- Modify: `app.js` — `Store.merge`: `steps` в числовой группе
- Modify: `app.js` — новый объект `Steps` и функция `renderStepsLesson` перед `function renderLesson`; ветка в начале `renderLesson`
- Modify: `styles.css` — раздел «Урок — пошаговый»
- Modify: `lessons.js` — модуль `m0` первым в `modules`

**Interfaces:**
- Consumes: `lessonHeadHtml`, `secNavHtml`, `mountReadbar`, `cardsBlockHtml`, `mountDeck`, `linksBlockHtml`, `mountLessonNav`, `mountTimer`, `mountEditor` из Task 2; `Engine.sql() → Promise<db>`, `Engine.db`, `db.exec(sql) → [{columns, values}]`, `Check.sql(res, exp) → {ok, why, row?}`, `renderTable(cols, rows, badRow)`, `penTick(key, cls)`, `ICON`, `idle`, `plural`; `window.CONTENT.m0l1` из Task 1.
- Produces: `Steps.key(id, n)`, `Steps.passed(id, n) → bool`, `Steps.firstOpen(id, C) → number (-1, если все пройдены)`, `Steps.clear(id, C)`, `Steps.render(L, C, box, onFinish)`, где `onFinish(fresh: bool)`; `renderStepsLesson(app, L, C)`. Разметка: `ol.steps > li.st.open|.done|.todo[data-n]`, в открытом шаге `.st-run`, `.st-check`, `.st-help`, `.st-hint`, `.st-status`, `.st-res`; итог урока — `#stFinal`, кнопка `#nextBtn`. Модуль `m0` с полем `summary: false` (читает Task 4).

- [ ] **Step 1: Корзина `steps` в Store**

В `Store` заменить объявление `EMPTY`:

```js
  const EMPTY = { theme: {}, done: {}, code: {}, notes: {}, attempts: {}, time: {}, seen: {},
                  days: {}, review: {}, prep: {}, steps: {} };
```

В `merge` заменить строку `      ["done", "attempts", "time", "days"].forEach(function (b) {` на:

```js
      ["done", "attempts", "time", "days", "steps"].forEach(function (b) {
```

- [ ] **Step 2: Добавить модуль 0 в карту курса**

В `lessons.js` первым элементом массива `modules` (перед `{ id: "m1", …`) вставить:

```js
    {
      id: "m0", num: 0,
      title: "Старт",
      sub: "Первый запрос к базе: от SELECT до группировки за сорок пять минут.",
      say: "даже если SQL видели мельком, начните отсюда",
      sayDone: "запросы больше не пугают, дальше — соединения",
      weeks: "≈ 45 минут",
      summary: false,
      lessons: [
        { id: "m0l1", title: "Первый запрос", kind: "sql", ready: true, steps: true,
          desc: "SELECT, WHERE, ORDER BY, GROUP BY — с нуля до группировки",
          say: "запрос — это вежливая просьба к базе показать нужное",
          sayTask: "каждый шаг — одна новая мысль и одна проверка" }
      ]
    },
```

`summary: false` — у модуля из одного урока нет страницы итога.

- [ ] **Step 3: Добавить `Steps` и `renderStepsLesson`**

В `app.js` перед `function renderLesson(app, id) {` (после функций из Task 2) вставить:

```js
/* ============================================================
   Пошаговый урок

   Урок 0.1 учит SQL с нуля, поэтому теория в нём нарезана на шаги
   и у каждого шага своя маленькая задача. Открыт один шаг — первый
   нерешённый; решённые сворачиваются в строку с запросом ученика,
   будущие видны серыми заголовками. Редактор есть только у открытого
   шага: на телефоне восемь редакторов сразу были бы лишними.
   Пройденные шаги — корзина steps («урок:номер»), код шага —
   корзина code («урок:sномер»).
   ============================================================ */

const Steps = {
  key: function (id, n) { return id + ":" + n; },
  passed: function (id, n) { return !!Store.get("steps", Steps.key(id, n), false); },
  firstOpen: function (id, C) {
    for (let n = 0; n < C.steps.length; n++) if (!Steps.passed(id, n)) return n;
    return -1;
  },
  clear: function (id, C) {
    C.steps.forEach(function (s, n) {
      if (Steps.passed(id, n)) Store.set("steps", Steps.key(id, n), false);
    });
  },

  /* Рисует ленту шагов урока L в box. onFinish(fresh) вызывается, когда
     пройдены все шаги: fresh — только что, а не уже при открытии. */
  render: function (L, C, box, onFinish) {
    const id = L.id, total = C.steps.length;
    const peek = {};                 /* пройденные шаги, раскрытые для перечитывания */
    let open = Steps.firstOpen(id, C);
    let justPassed = -1;
    let editor = null, last = null, helped = false;

    box.innerHTML =
      '<details class="schema"><summary>Какие таблицы есть в базе</summary>' +
        '<div class="schema-body">' + C.schema + "</div></details>" +
      '<ol class="steps"></ol>';
    const list = $(".steps", box);

    function codeKey(n) { return id + ":s" + n; }
    function codeOf(n) {
      const saved = Store.get("code", codeKey(n), null);
      return saved !== null ? saved : (C.steps[n].starter || "");
    }
    /* первая значимая строка запроса — подпись свёрнутого шага */
    function firstLine(src) {
      return (String(src).split("\n").filter(function (x) {
        return x.trim() && !/^\s*--/.test(x);
      })[0] || "").trim();
    }
    function mark(n) {
      return '<span class="st-n">' + (Steps.passed(id, n)
        ? penTick(Steps.key(id, n), n === justPassed ? "draw" : "")
        : String(n + 1)) + "</span>";
    }

    function itemHtml(n) {
      const s = C.steps[n];
      if (n === open) {
        return '<li class="st open" data-n="' + n + '">' +
          '<div class="st-h">' + mark(n) + '<h3 class="st-t">' + esc(s.title) + "</h3>" +
            '<span class="st-of">шаг ' + (n + 1) + " из " + total + "</span></div>" +
          '<div class="st-b">' +
            '<div class="theory">' + s.body + "</div>" +
            '<div class="editor-shell st-ed"><div class="editor-h"><span>шаг ' + (n + 1) + ".sql</span></div>" +
              '<textarea class="st-ta"></textarea></div>' +
            '<div class="st-actions">' +
              '<button class="btn primary st-run" type="button">' + ICON.play + "Запустить</button>" +
              '<button class="btn check st-check" type="button">' + ICON.check + "Проверить</button>" +
              '<button class="linkbtn st-help" type="button">Не получается</button>' +
            "</div>" +
            '<div class="st-hint" hidden></div>' +
            '<div class="status st-status"></div>' +
            '<div class="io-box st-out"><div class="io-h"><span>ваш вывод</span></div>' +
              '<div class="io-body st-res"><div class="empty">Пока пусто — нажмите «Запустить».</div></div></div>' +
          "</div></li>";
      }
      if (Steps.passed(id, n)) {
        const shown = !!peek[n];
        return '<li class="st done' + (shown ? " peek" : "") + '" data-n="' + n + '">' +
          '<button class="st-h" type="button" aria-expanded="' + shown + '">' + mark(n) +
            '<span class="st-t">' + esc(s.title) + "</span>" +
            '<code class="st-q">' + esc(firstLine(codeOf(n))) + "</code></button>" +
          (shown ? '<div class="st-b"><div class="theory">' + s.body + "</div>" +
            '<pre class="st-code"><code>' + esc(codeOf(n)) + "</code></pre></div>" : "") +
          "</li>";
      }
      return '<li class="st todo" data-n="' + n + '"><div class="st-h">' + mark(n) +
        '<span class="st-t">' + esc(s.title) + "</span></div></li>";
    }

    /* пройденный шаг раскрывается и сворачивается на месте, остальные не трогаем */
    function bindDone(li) {
      $(".st-h", li).addEventListener("click", function () {
        const n = +li.dataset.n;
        peek[n] = !peek[n];
        const tmp = document.createElement("div");
        tmp.innerHTML = itemHtml(n);
        const fresh = tmp.firstChild;
        li.parentNode.replaceChild(fresh, li);
        bindDone(fresh);
      });
    }

    function draw() {
      editor = null; last = null; helped = false;
      let html = "";
      for (let n = 0; n < total; n++) html += itemHtml(n);
      justPassed = -1;
      list.innerHTML = html;
      Array.prototype.forEach.call(list.querySelectorAll(".st.done"), bindDone);
      if (open >= 0) mountOpen();
    }

    function mountOpen() {
      const n = open;
      const li = $(".st.open", list);
      const q = function (sel) { return $(sel, li); };

      function status(kind, title, body) {
        const s = q(".st-status");
        if (!kind) { s.className = "status st-status"; s.innerHTML = ""; return; }
        const ico = kind === "ok" ? ICON.ok : kind === "bad" ? ICON.bad : ICON.warn;
        s.className = "status st-status show " + kind;
        s.innerHTML = '<span class="s-ico">' + ico + "</span>" +
          '<span class="s-body"><b>' + esc(title) + "</b>" + (body ? "<br>" + body : "") + "</span>";
      }
      function showRows(badRow) {
        q(".st-res").innerHTML = renderTable(last.columns, last.values, badRow) +
          '<div class="st-rows">' + last.values.length + " " +
          plural(last.values.length, "строка", "строки", "строк") + "</div>";
      }

      /* true — запрос выполнен (строк может и не быть), false — пусто или ошибка */
      async function run() {
        if (open !== n || !document.body.contains(li)) return false;
        status(null);
        const code = editor ? editor.get() : q(".st-ta").value;
        if (!code.trim()) { status("warn", "Пусто", "Сначала напишите запрос."); return false; }
        const rb = q(".st-run");
        rb.disabled = true;
        if (!Engine.db) q(".st-res").innerHTML = '<div class="empty">Поднимаю базу в браузере…</div>';
        try {
          const db = await Engine.sql();
          if (open !== n || !document.body.contains(li)) return false;
          let res;
          try { res = db.exec(code); }
          catch (e) {
            last = null;
            q(".st-res").innerHTML = '<pre><span class="err">' + esc("SQLite: " + e.message) + "</span></pre>";
            status("bad", "Запрос упал с ошибкой",
              "Прочитайте сообщение базы в выводе: обычно там сказано, рядом с каким словом она споткнулась.");
            return false;
          }
          last = res.length ? res[res.length - 1] : null;
          if (last) showRows(-1);
          else q(".st-res").innerHTML = '<div class="empty">Запрос выполнен, но не вернул ни одной строки.</div>';
          return true;
        } catch (e) {
          q(".st-res").innerHTML = '<pre><span class="err">' + esc(String(e && e.message ? e.message : e)) + "</span></pre>";
          status("bad", "База не загрузилась", "Похоже, пропал интернет. Попробуйте ещё раз, когда связь вернётся.");
          return false;
        } finally {
          if (document.body.contains(rb)) rb.disabled = false;
        }
      }

      /* «Проверить» всегда выполняет то, что сейчас в редакторе */
      async function check() {
        const ran = await run();
        if (!ran || open !== n) return;
        const r = Check.sql(last, C.steps[n].expected);
        if (r.ok) { pass(n); return; }
        if (last) showRows(r.row === undefined ? -1 : r.row);
        status("bad", "Пока не совпадает", esc(r.why));
      }

      /* первое нажатие — подсказка, второе — решение в редакторе */
      function help() {
        const s = C.steps[n], hint = q(".st-hint"), btn = q(".st-help");
        if (!helped) {
          hint.hidden = false;
          hint.innerHTML = s.hint;
          btn.textContent = "Показать решение";
          helped = true;
          return;
        }
        if (editor) editor.set(s.solution); else q(".st-ta").value = s.solution;
        Store.set("code", codeKey(n), s.solution);
        status("warn", "Решение в редакторе",
          "Прочитайте его, запустите и проверьте: шаг засчитается после «Проверить».");
        btn.hidden = true;
      }

      q(".st-run").addEventListener("click", run);
      q(".st-check").addEventListener("click", check);
      q(".st-help").addEventListener("click", help);

      mountEditor(q(".st-ta"), "sql", codeOf(n),
        function (v) { Store.set("code", codeKey(n), v); }, run,
        function () {
          status("warn", "Редактор без подсветки",
            "CodeMirror не загрузился — похоже, нет интернета. Запрос всё равно можно писать и запускать.");
        }
      ).then(function (ed) { if (open === n && document.body.contains(li)) editor = ed; });
    }

    function pass(n) {
      Store.set("steps", Steps.key(id, n), Date.now());
      justPassed = n;
      open = Steps.firstOpen(id, C);
      draw();
      if (open >= 0) {
        const li = $(".st.open", list);
        if (li) li.scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (onFinish) {
        onFinish(true);
      }
    }

    draw();
    if (open < 0 && onFinish) onFinish(false);
  }
};

/* Страница пошагового урока: шапка, шаги, карточки, «как дальше», ссылки. */
function renderStepsLesson(app, L, C) {
  const id = L.id;
  const hasCards = !!(C.cards && C.cards.length);
  const hasLinks = !!(C.links && C.links.length);

  const secs = [{ id: "s-steps", t: "Шаги" }];
  if (hasCards) secs.push({ id: "s-cards", t: "Карточки" });
  if (C.after) secs.push({ id: "s-after", t: "Как дальше" });
  if (hasLinks) secs.push({ id: "s-links", t: "Что почитать" });

  const main = el("main", { class: "wrap lesson-wrap" });
  main.innerHTML =
    lessonHeadHtml(L, C, "SQL с нуля") +
    secNavHtml(secs) +
    '<section class="block has-margin" id="s-steps">' +
      (L.sayTask ? '<div class="aside"><p>' + esc(L.sayTask) + "</p></div>" : "") +
      '<div class="block-h"><h2>Шаги</h2></div>' +
      '<div id="stepsBox"></div>' +
      '<div class="status st-final" id="stFinal"></div>' +
    "</section>" +
    (hasCards ? cardsBlockHtml() : "") +
    (C.after ? '<section class="block" id="s-after">' +
      '<div class="block-h"><h2>Как устроены следующие уроки</h2></div>' +
      '<div class="theory">' + C.after + "</div></section>" : "") +
    (hasLinks ? linksBlockHtml(C) : "") +
    '<nav class="lesson-nav" id="lnav"></nav>';
  app.appendChild(main);

  mountReadbar(secs);
  if (hasCards) mountDeck(id, C);

  const box = $("#stepsBox"), fin = $("#stFinal");

  function finished(fresh) {
    if (!Course.isDone(id)) { Store.set("done", id, Date.now()); refreshBar(); }
    fin.className = "status st-final show ok";
    fin.innerHTML = '<span class="s-ico' + (fresh ? " s-pen" : "") + '">' +
        (fresh ? penTick(id, "draw") : ICON.ok) + "</span>" +
      '<span class="s-body"><b>Урок пройден</b>Все шаги решены. Следующий урок — соединение таблиц, ' +
        "и его задача опирается ровно на то, что вы здесь написали." +
        '<br><button class="linkbtn" id="nextBtn" type="button">Перейти к следующему уроку</button></span>';
    $("#nextBtn").addEventListener("click", function () {
      const nx = Course.neighbour(id, 1);
      Router.go(nx ? "#" + nx.id : "#");
    });
    updateNav();
  }

  /* «снять отметку» у пошагового урока начинает его заново с шага 1; код остаётся */
  const updateNav = mountLessonNav(id, function () {
    Steps.clear(id, C);
    fin.className = "status st-final";
    fin.innerHTML = "";
    Steps.render(L, C, box, finished);
  });
  Steps.render(L, C, box, finished);
  mountTimer(id);
}
```

- [ ] **Step 4: Ветка в renderLesson**

В `renderLesson` сразу после строки `  mountHeader("<b>Модуль " + M.num + ":</b> " + esc(M.title) + ", урок " + L.num);` вставить:

```js

  /* Пошаговый урок (0.1) устроен иначе: вместо теории и одной задачи —
     лента шагов со своими редакторами. Движок SQL поднимаем заранее,
     чтобы первое «Запустить» не ждало загрузки. */
  if (C.steps) {
    idle(function () { Engine.sql().catch(function () {}); });
    renderStepsLesson(app, L, C);
    return;
  }
```

- [ ] **Step 5: Стили**

В `styles.css` после раздела «11. Урок — тренажёр» (перед следующим заголовком раздела `/* ====…`) добавить:

```css
/* ============================================================
   11а. Урок — пошаговый (0.1)
   Шаги — строки одной ленты, отчёркнутые линейками. Рамку получают
   только редактор и вывод открытого шага.
   ============================================================ */

.steps { list-style: none; margin: 8px 0 0; padding: 0; border-top: 1px solid var(--rule); }
.st { border-bottom: 1px solid var(--rule); scroll-margin-top: 96px; }
.st-h {
  display: flex; align-items: baseline; gap: 14px; width: 100%; min-width: 0;
  padding: 13px 0; background: none; border: 0; font: inherit; color: inherit; text-align: left;
}
button.st-h { cursor: pointer; }
button.st-h:hover .st-t { color: var(--ink); }
.st-n {
  flex: none; width: 26px; font-family: var(--mono); font-size: 13px;
  color: var(--ink-3); font-variant-numeric: tabular-nums;
}
.st-n .pen-tick { width: 20px; height: 20px; vertical-align: -4px; }
.st-t { margin: 0; font-size: 16px; font-weight: 500; color: var(--ink-2); }
.st.todo .st-t { color: var(--ink-4); }
.st.done .st-t { flex: none; }
.st-q {
  min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-family: var(--mono); font-size: 12.5px; color: var(--ink-3);
}
.st.open .st-n { color: var(--pen); font-weight: 600; }
.st.open .st-t {
  font-family: var(--serif); font-size: 21px; font-weight: 700;
  color: var(--ink); letter-spacing: -0.012em;
}
.st-of { margin-left: auto; font-size: 13px; color: var(--ink-3); white-space: nowrap; }
.st-b { padding: 0 0 24px 40px; }
.st-b .theory { margin-bottom: 14px; }
.st-ed .CodeMirror-scroll { min-height: 132px; }
.st-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-bottom: 14px; }
.st-help { font-size: 14px; margin-left: 6px; }
.st-hint {
  margin: 0 0 14px; padding: 2px 0 2px 14px; max-width: var(--measure);
  border-left: 2px solid var(--pen-line); border-radius: 0;
  font-family: var(--serif); font-size: 16px; line-height: 1.6; color: var(--ink-2);
}
.st-hint code {
  font-family: var(--mono); font-size: .86em; background: var(--paper-2);
  padding: 1px 5px; border-radius: var(--r); border: 1px solid var(--rule-soft);
}
.st-out .io-body { max-height: 320px; }
.st-rows { margin-top: 7px; font-size: 11.5px; color: var(--ink-3); font-family: var(--mono); }
.st-code { margin: 0; }
.st-final { margin-top: 22px; }

@media (max-width: 720px) {
  .st-b { padding-left: 0; }
  .st-of { display: none; }
  .st-actions .btn { flex: 1 1 auto; justify-content: center; min-height: 44px; }
  .st-help { width: 100%; margin: 4px 0 0; text-align: center; min-height: 44px; }
}
```

- [ ] **Step 6: Синтаксис и карта курса**

Run: `node -e "new Function(require('fs').readFileSync('app.js','utf8'))" && node -e "global.window={};require('./lessons.js');console.log(window.COURSE.modules.map(m=>m.id).join(','))"`
Expected: `m0,m1,m2,m3,m4,m5,m6`

- [ ] **Step 7: Пройти урок в чистом профиле**

Открыть чистый профиль по правилу 3, затем `http://127.0.0.1:8779/?v=<время>#m0l1` и выполнить:

```js
await new Promise(r => setTimeout(r, 1500));
({ kicker: document.querySelector(".kicker span").textContent,
   nav: [...document.querySelectorAll(".secnav a")].map(a => a.textContent).join(","),
   open: document.querySelector(".st.open").dataset.n,
   todo: document.querySelectorAll(".st.todo").length,
   of: document.querySelector(".st-of").textContent })
```

Expected: `kicker: "Урок 0.1, SQL с нуля"`, `nav: "Шаги,Карточки,Как дальше,Что почитать"`, `open: "0"`, `todo: 7`, `of: "шаг 1 из 8"`.

Неверный ответ на шаге 1:

```js
for (let t = 0; t < 50 && !document.querySelector(".st.open .CodeMirror"); t++) await new Promise(r => setTimeout(r, 100));
document.querySelector(".st.open .CodeMirror").CodeMirror.setValue("SELECT user_id FROM users LIMIT 5;");
document.querySelector(".st.open .st-check").click();
await new Promise(r => setTimeout(r, 4000));
document.querySelector(".st.open .st-status").innerText
```

Expected: «Пока не совпадает» и «столбцов 1, а нужно 5 (user_id, signup_date, channel, city, platform)».

Подсказка и решение:

```js
const hb = document.querySelector(".st.open .st-help");
hb.click();
const hint = document.querySelector(".st.open .st-hint").innerText;
const label = hb.textContent;
hb.click();
await new Promise(r => setTimeout(r, 300));
({ hint: hint.slice(0, 40), label,
   code: document.querySelector(".st.open .CodeMirror").CodeMirror.getValue(),
   status: document.querySelector(".st.open .st-status").innerText.slice(0, 30) })
```

Expected: `hint` начинается с «Здесь ничего писать не нужно», `label: "Показать решение"`, `code` — решение шага 1, `status` начинается с «Решение в редакторе».

Все восемь шагов подряд:

```js
window.__steps = async function () {
  const C = window.CONTENT.m0l1, log = [];
  for (let k = 0; k < C.steps.length; k++) {
    const li = document.querySelector(".st.open");
    if (!li) { log.push("нет открытого шага"); break; }
    const n = +li.dataset.n;
    for (let t = 0; t < 50 && !li.querySelector(".CodeMirror"); t++) await new Promise(r => setTimeout(r, 100));
    li.querySelector(".CodeMirror").CodeMirror.setValue(C.steps[n].solution);
    li.querySelector(".st-check").click();
    for (let t = 0; t < 100 && document.querySelector('.st.open[data-n="' + n + '"]'); t++) await new Promise(r => setTimeout(r, 100));
    log.push((n + 1) + ": " + (document.querySelector('.st.open[data-n="' + n + '"]')
      ? "НЕ ПРОШЁЛ — " + li.querySelector(".st-status").innerText : "ок"));
  }
  return log;
};
const log = await window.__steps();
await new Promise(r => setTimeout(r, 500));
({ log, done: document.querySelectorAll(".st.done").length,
   final: document.getElementById("stFinal").innerText.slice(0, 40),
   mark: document.getElementById("markBtn").innerText,
   counter: document.querySelector("#progBtn .pb-n") && document.querySelector("#progBtn .pb-n").textContent })
```

Expected: `log` — восемь строк «N: ок», `done: 8`, `final` начинается с «Урок пройден», `mark: "✓ Пройден — снять отметку"`, `counter: "1 из 41"`.

- [ ] **Step 8: Прогресс переживает перезагрузку**

Перезагрузить `#m0l1` (правило 2, без стирания хранилища) и выполнить:

```js
await new Promise(r => setTimeout(r, 1500));
const s = JSON.parse(localStorage.getItem("da.state.v1"));
({ open: document.querySelectorAll(".st.open").length,
   done: document.querySelectorAll(".st.done").length,
   final: document.getElementById("stFinal").innerText.slice(0, 13),
   steps: Object.keys(s.steps).length,
   code: Object.keys(s.code).filter(k => k.indexOf("m0l1:s") === 0).length,
   q: document.querySelector('.st.done[data-n="7"] .st-q').textContent })
```

Expected: `open: 0`, `done: 8`, `final: "Урок пройден"`, `steps: 8`, `code: 8`, `q: "SELECT user_id,"`.

Раскрыть пройденный шаг и свернуть обратно:

```js
document.querySelector('.st.done[data-n="2"] .st-h').click();
const opened = !!document.querySelector('.st.done.peek[data-n="2"] .st-code');
document.querySelector('.st.done[data-n="2"] .st-h').click();
({ opened, closed: !document.querySelector('.st.done.peek[data-n="2"]') })
```

Expected: `{ opened: true, closed: true }`.

- [ ] **Step 9: «Снять отметку» начинает урок заново**

```js
document.getElementById("markBtn").click();
await new Promise(r => setTimeout(r, 600));
const s = JSON.parse(localStorage.getItem("da.state.v1"));
({ open: document.querySelector(".st.open").dataset.n,
   final: document.getElementById("stFinal").className,
   passed: Object.values(s.steps).filter(Boolean).length, done: s.done.m0l1,
   ta: document.querySelector(".st.open .st-ta") !== null })
```

Expected: `open: "0"`, `final: "status st-final"`, `passed: 0`, `done: false`, `ta: true`. Когда редактор загрузится, в нём решение шага 1 из корзины `code` — код не стёрт.

- [ ] **Step 10: Ширина телефона**

`resize_window` с `preset: "mobile"`, перезагрузить `#m0l1` и выполнить:

```js
await new Promise(r => setTimeout(r, 2000));
const W = document.documentElement.clientWidth;
({ W, scrollW: document.documentElement.scrollWidth,
   run: Math.round(document.querySelector(".st.open .st-run").getBoundingClientRect().height),
   help: Math.round(document.querySelector(".st.open .st-help").getBoundingClientRect().height) })
```

Expected: `scrollW === W`, `run >= 44`, `help >= 44`. Вернуть `preset: "desktop"`.

- [ ] **Step 11: Консоль и обычный урок**

`read_console_messages` с `onlyErrors: true` — пусто. Открыть `#m1l1` — сниппет из Task 2 Step 1 даёт тот же результат, что и раньше.

- [ ] **Step 12: Commit**

```bash
git add app.js styles.css lessons.js
git commit -m "Пошаговый урок 0.1: лента шагов с редактором и проверкой у каждого шага

Модуль 0 «Старт» в карте курса, корзина steps в хранилище,
«снять отметку» начинает урок с шага 1.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Главная для новичка

**Files:**
- Modify: `app.js` — `Stats.resume`
- Modify: `app.js` — новая функция `resumeCard` перед `renderHome`; в `renderHome` — карточка «С чего начать», реплика на поле, строка переноса прогресса под оглавлением, подпись модуля без итога
- Modify: `app.js` — `Find.places`: итог модуля только при `summary !== false`

**Interfaces:**
- Consumes: `Stats.started()`, `Course.byId`, `Course.ready`, `Course.flat`, `Course.isDone`, `Progress.load`, модуль `m0` с `summary: false` из Task 3.
- Produces: `Stats.resume()` — прежний контракт `{lesson, fresh} | null`, но урок модуля 0 не предлагается тому, у кого пройден хоть один урок модулей 1–6. `resumeCard(lesson, kicker, go) → string`.

- [ ] **Step 1: Воспроизвести ошибку «продолжить» до правок**

Засеять профиль `localhost:8779` (правило 4) состоянием «прошёл весь курс, кроме 1.1, последним открывал 6.6»:

```js
const now = Date.now(), done = {};
window.COURSE.modules.forEach(m => m.lessons.forEach(l => { if (m.num > 0 && l.id !== "m1l1") done[l.id] = now; }));
const STATE = { done, seen: { last: "m6l6" }, code: {}, notes: {}, attempts: {}, time: {}, days: {}, review: {}, prep: {}, steps: {}, theme: {} };
localStorage.setItem("da.state.v1", JSON.stringify(STATE));
Storage.prototype.setItem = function () {};
location.href = location.pathname + "?v=" + Date.now() + "#";
```

Затем:

```js
await new Promise(r => setTimeout(r, 1200));
document.querySelector(".resume") && document.querySelector(".resume").getAttribute("href")
```

Expected до правок: `"#m0l1"` — «продолжить» уводит опытного ученика во вводный урок. Это и чинит Step 2.

- [ ] **Step 2: Правило в Stats.resume**

Заменить функцию `resume` в `Stats` целиком (вместе с комментарием над ней):

```js
  /* Куда вернуться: к последнему открытому уроку, если он не пройден,
     иначе к следующему непройденному. Новичку карточка не нужна — он
     получает «С чего начать». Урок 0.1 — вход для новичков: тому, кто
     прошёл хоть один урок программы, «продолжить» его не предлагает. */
  resume: function () {
    const last = Course.byId(Store.get("seen", "last", null) || "");
    if (last && last.ready && !Course.isDone(last.id)) return { lesson: last, fresh: false };
    if (!last && Course.doneCount(Course.flat) === 0) return null;
    const started = Course.flat.some(function (l) { return l.module.num > 0 && Course.isDone(l.id); });
    const pool = Course.ready.filter(function (l) { return !(started && l.module.num === 0); });
    const from = last ? pool.indexOf(last) : -1;
    const order = pool.slice(from + 1).concat(pool.slice(0, from + 1));
    const next = order.filter(function (l) { return !Course.isDone(l.id); })[0];
    return next ? { lesson: next, fresh: true } : null;
  }
```

- [ ] **Step 3: Карточка «С чего начать» и реплика на поле**

Перед `function renderHome(app) {` добавить:

```js
/* карточка «продолжить» / «с чего начать» под заголовком главной */
function resumeCard(lesson, kicker, go) {
  return '<a class="resume" href="#' + lesson.id + '">' +
      '<span class="resume-txt">' +
        '<span class="resume-k">' + esc(kicker) + "</span>" +
        '<span class="resume-t">' + lesson.num + " " + esc(lesson.title) + "</span>" +
        '<span class="resume-d">' + esc(lesson.desc) + "</span>" +
      "</span>" +
      '<span class="resume-go">' + esc(go) + "</span>" +
    "</a>";
}
```

В `renderHome` заменить объявление `resumeHtml` (от `  const resume = Stats.resume();` до `    : "";` включительно) на:

```js
  const resume = Stats.resume();
  /* новичку — тот же вид карточки, но с первым уроком и словом «начать» */
  const start = !Stats.started() ? Course.byId("m0l1") : null;
  const resumeHtml = resume
    ? resumeCard(resume.lesson, resume.fresh ? "Следующий урок" : "Вы остановились здесь", "Продолжить")
    : start ? resumeCard(start, "С чего начать", "Начать") : "";
```

Строку `  if (resume) idle(function () { Lazy.content(resume.lesson.module.id).catch(function () {}); });` заменить на:

```js
  const ahead = resume ? resume.lesson : start;
  if (ahead) idle(function () { Lazy.content(ahead.module.id).catch(function () {}); });
```

В `hero.innerHTML` заменить `        "<p>начните с первого модуля, остальное подождёт</p></div>" +` на:

```js
        "<p>начните с урока 0.1, даже если SQL уже видели мельком</p></div>" +
```

- [ ] **Step 4: Перенос прогресса — под оглавление**

В `hero.innerHTML` удалить блок от комментария `/* Пустой курс — единственный момент, когда перенос вообще уместен:` до `        : "") +` включительно (строка `.carry`).

Удалить строки:

```js
  const carry = $("#carryBtn", hero);
  if (carry) carry.addEventListener("click", Progress.load);
```

Сразу после `  main.appendChild(toc);` вставить:

```js
  /* Перенос уместен только на пустом курсе и новичку не нужен первым делом,
     поэтому строка стоит под оглавлением, а не на обложке. */
  if (done === 0) {
    main.insertAdjacentHTML("beforeend",
      '<p class="carry">Занимались в прошлой версии курса? ' +
      '<button class="linkbtn" id="carryBtn" type="button">Перенесите прогресс</button> ' +
      "или просто перетащите сюда файл, выгруженный оттуда.</p>");
    $("#carryBtn", main).addEventListener("click", Progress.load);
  }
```

- [ ] **Step 5: У модуля 0 нет страницы итога**

В `renderHome` в оглавлении заменить выражение

```js
(d === t ? '<a href="#summary-' + m.id + '">пройден, итог</a>' : d ? d + " из " + t : esc(m.weeks))
```

на:

```js
(d === t ? (m.summary === false ? "пройден" : '<a href="#summary-' + m.id + '">пройден, итог</a>')
         : d ? d + " из " + t : esc(m.weeks))
```

В `Find.places` заменить условие `      if (Course.doneCount(m.lessons) === m.lessons.length) {` на:

```js
      if (m.summary !== false && Course.doneCount(m.lessons) === m.lessons.length) {
```

- [ ] **Step 6: Синтаксис**

Run: `node -e "new Function(require('fs').readFileSync('app.js','utf8'))" && echo синтаксис ок`
Expected: `синтаксис ок`

- [ ] **Step 7: Вернувшийся ученик не получает 0.1**

Повторить засев и проверку из Step 1.
Expected: `"#m1l1"`.

Засеять «прошёл 1.1 и 1.2, последним открывал 1.2»:

```js
const now = Date.now();
const STATE = { done: { m1l1: now, m1l2: now }, seen: { last: "m1l2" }, code: {}, notes: {}, attempts: {}, time: {}, days: {}, review: {}, prep: {}, steps: {}, theme: {} };
localStorage.setItem("da.state.v1", JSON.stringify(STATE));
Storage.prototype.setItem = function () {};
location.href = location.pathname + "?v=" + Date.now() + "#";
```

Проверка:

```js
await new Promise(r => setTimeout(r, 1200));
({ href: document.querySelector(".resume").getAttribute("href"),
   k: document.querySelector(".resume-k").textContent,
   carry: !!document.querySelector(".carry") })
```

Expected: `{ href: "#m1l3", k: "Следующий урок", carry: false }`.

Засеять «прошёл только 0.1, последним открывал 0.1»:

```js
const now = Date.now(), steps = {};
for (let n = 0; n < 8; n++) steps["m0l1:" + n] = now;
const STATE = { done: { m0l1: now }, seen: { last: "m0l1" }, code: {}, notes: {}, attempts: {}, time: {}, days: {}, review: {}, prep: {}, steps, theme: {} };
localStorage.setItem("da.state.v1", JSON.stringify(STATE));
Storage.prototype.setItem = function () {};
location.href = location.pathname + "?v=" + Date.now() + "#";
```

Проверка:

```js
await new Promise(r => setTimeout(r, 1200));
({ href: document.querySelector(".resume").getAttribute("href"),
   mw: document.querySelector(".toc-mod .toc-mw").innerHTML })
```

Expected: `{ href: "#m1l1", mw: "пройден" }`.

- [ ] **Step 8: Новичок видит «С чего начать»**

Открыть чистый профиль по правилу 3 и выполнить:

```js
await new Promise(r => setTimeout(r, 1200));
const hero = document.querySelector(".hero");
({ href: hero.querySelector(".resume").getAttribute("href"),
   k: hero.querySelector(".resume-k").textContent,
   go: hero.querySelector(".resume-go").textContent,
   aside: hero.querySelector(".aside").innerText.includes("урока 0.1"),
   carryInHero: !!hero.querySelector(".carry"),
   carryBelow: !!document.querySelector("main .carry"),
   counter: document.querySelector("#progBtn .pb-n").textContent,
   firstMod: document.querySelector(".map-mod-h").textContent })
```

Expected: `href: "#m0l1"`, `k: "С чего начать"`, `go: "Начать"`, `aside: true`, `carryInHero: false`, `carryBelow: true`, `counter: "0 из 41"`, `firstMod: "0. Старт"`.

Нажать карточку: `document.querySelector(".hero .resume").click()` — открывается урок 0.1 на шаге 1. Консоль без ошибок.

- [ ] **Step 9: Commit**

```bash
git add app.js
git commit -m "Главная: новичку — «С чего начать» с уроком 0.1

Вернувшемуся 0.1 в «продолжить» не попадает, строка переноса
прогресса ушла с обложки под оглавление, у модуля 0 нет итога.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Инструменты, сборка и документация

**Files:**
- Modify: `инструменты/checkcards.js` — модули 0–6, числа из шагов
- Modify: `build.py:64-65` — `LAZY`
- Modify: `sw.js:26` — `VERSION`
- Modify: `README.md` — таблица файлов, раздел «Как добавить шаги», число уроков
- Modify: `ПРОГРЕСС.md` — модуль 0, пошаговый урок, сводка курса
- Modify: `Тетрадь аналитика.html` — пересборка

**Interfaces:**
- Consumes: `content-m0.js` (Task 1), модуль `m0` (Task 3), поведение Task 3–4.
- Produces: `node инструменты/checkcards.js --require m0 … m6` без ошибок; сборка в один файл с уроком 0.1.

- [ ] **Step 1: checkcards видит модуль 0**

В `инструменты/checkcards.js`:

- в первой строке комментария заменить `content-m1.js … content-m6.js` на `content-m0.js … content-m6.js`;
- заменить `for (let n = 1; n <= 6; n++) require(path.join(ROOT, "content-m" + n + ".js"));` на:

```js
for (let n = 0; n <= 6; n++) require(path.join(ROOT, "content-m" + n + ".js"));
```

- заменить `    const theory = new Set(numbers(plain(C.theory || "")));` на:

```js
    /* у пошагового урока теория — это тексты шагов и блок «как дальше» */
    const text = (C.theory || "") +
      (C.steps || []).map(function (s) { return s.body; }).join(" ") + (C.after || "");
    const theory = new Set(numbers(plain(text)));
```

Run: `node инструменты/checkcards.js --require m0 m1 m2 m3 m4 m5 m6 | grep -E "^m0l1|Всего"`
Expected: `m0l1  8` и `Всего карточек: 441. Ошибок нет.`

- [ ] **Step 2: Сборка в один файл и версия кеша**

В `build.py` заменить

```python
LAZY = ("content-m1.js", "content-m2.js", "content-m3.js", "content-m4.js",
        "content-m5.js", "content-m6.js", "data.js")
```

на

```python
LAZY = ("content-m0.js", "content-m1.js", "content-m2.js", "content-m3.js",
        "content-m4.js", "content-m5.js", "content-m6.js", "data.js")
```

В `sw.js` заменить `const VERSION = "2026-09-18";` на `const VERSION = "2026-09-19";`.

Run: `python3 build.py && grep -c "window.CONTENT.m0l1" "Тетрадь аналитика.html"`
Expected: строка `Готово: Тетрадь аналитика.html — … КБ` (размер записать для Step 5) и `1`.

- [ ] **Step 3: Сборка открывает урок 0.1**

Открыть `http://localhost:8779/Тетрадь%20аналитика.html?v=<время>#m0l1` и выполнить:

```js
await new Promise(r => setTimeout(r, 2000));
for (let t = 0; t < 50 && !document.querySelector(".st.open .CodeMirror"); t++) await new Promise(r => setTimeout(r, 100));
const li = document.querySelector(".st.open");
li.querySelector(".CodeMirror").CodeMirror.setValue(window.CONTENT.m0l1.steps[+li.dataset.n].solution);
li.querySelector(".st-check").click();
await new Promise(r => setTimeout(r, 5000));
({ scripts: [...document.scripts].filter(s => /content-m0/.test(s.src)).length,
   passed: !document.querySelector('.st.open[data-n="' + li.dataset.n + '"]') })
```

Expected: `scripts: 0` (урок встроен в файл, отдельно не загружается), `passed: true`.

- [ ] **Step 4: README**

В `README.md`:

- в абзаце про карточки заменить «Во всех уроках после теории стоят карточки» на «Во всех уроках после теории (а в уроке 0.1 — после шагов) стоят карточки»;
- в таблице файлов строку про `content-m1.js` … `content-m6.js` заменить на:

```
| `content-m0.js` … `content-m6.js` | содержание уроков по модулям: теория, задача, эталон, подсказки, решение, карточки; в `content-m0.js` — шаги урока 0.1 |
```

- после раздела «Как добавить карточки» добавить:

```markdown
### Как добавить шаги в пошаговый урок

Урок 0.1 — пошаговый: в карте курса у него `steps: true`, а в объекте
урока вместо теории и одной задачи — массив шагов:

    steps: [
      { title: "Отфильтровать строки: WHERE",
        body: "<p>…</p>",
        starter: "SELECT user_id, signup_date\nFROM users;",
        expected: { ordered: false, columns: [...], rows: [...] },
        hint: "…",
        solution: "SELECT …" }
    ]

`expected` устроен как у основной задачи SQL-урока. Новые шаги
дописывайте в конец массива: номер шага — ключ в прогрессе ученика.
Начальный запрос лучше делать запускаемым: новичок сразу видит
таблицу, а «Проверить» объясняет, чего не хватает. Перед сборкой:

    node инструменты/checksteps.js m0l1

Скрипт прогоняет решение каждого шага на учебной базе и сверяет
с `expected` по тем же правилам, что проверка в браузере.
`--try 3 "SELECT …"` показывает, что увидит ученик на шаге 3.
```

- заменить команду `node инструменты/checkcards.js --require m1 m2 m3 m4 m5 m6` на `node инструменты/checkcards.js --require m0 m1 m2 m3 m4 m5 m6`.

Run: `grep -n "40 урок\|из 40\|сорок урок" README.md`
Expected: там, где речь о числе уроков курса, заменить на «41 урок (включая вводный 0.1)»; после правки команда ничего не находит, кроме мест, где число 40 значит другое.

- [ ] **Step 5: ПРОГРЕСС.md**

В `ПРОГРЕСС.md`:

- первую строку «КУРС ЗАКОНЧЕН: 40 уроков из 40, все шесть модулей.» заменить на «КУРС ЗАКОНЧЕН: 41 урок — вводный 0.1 и 40 уроков шести модулей.»;
- в разделе «Контент» перед строкой про модуль 1 добавить:

```
- Модуль 0 (`content-m0.js`) — один пошаговый урок 0.1 «Первый запрос»,
  ГОТОВ. Восемь шагов от SELECT до GROUP BY, решения проверены
  `node инструменты/checksteps.js m0l1`. Для учеников с нуля: урок 1.1
  начинается с JOIN и опирается на GROUP BY, COUNT и SUM.
```

- в «Структура урока в content-*.js» после блока полей добавить:

```
    пошаговый урок: steps[{title,body,starter,expected,hint,solution}],
    after — вместо theory, ticket, starter, expected, hints, drills, quiz
```

- в разделе «Карточки» строку состояния заменить на «Состояние: готово во всех 41 уроке, 441 карточка (по модулям 8 / 78 / 75 / 78 / 80 / 59 / 63). Спецификация:»;
- после раздела «Ключевые числа модуля 3» добавить:

```
## Ключевые числа урока 0.1

    шаг 1: 5 строк; шаг 2: 10; шаг 3: пользователи из Казани — 47;
    шаг 4: оплаченные дороже 5000 — 28; шаг 5: топ-5 заказов,
      первая сумма 10 177,29, пятая 8 173,74, шестая 7 779,49;
    шаг 6: 189 заказов, выручка 653 428,78, средний чек 3 457,30;
    шаг 7: organic 75, paid_search 55, social 42, email 28,
      referral 14, partner 6;
    шаг 8: топ-5 покупателей, пятое место 15 301,00, шестое 15 252,32
```

- в «Сводка курса» перед строкой `    модуль 1  SQL для аналитика            8 уроков` добавить `    модуль 0  Старт                        1 урок, пошаговый`, строку итога `40 уроков` заменить на `41 урок`, в строке счётчиков `433 карточки` заменить на `441 карточка`, размер сборки — на тот, что напечатал `build.py` в Step 2.

Run: `python3 -c "import pathlib; s=pathlib.Path('ПРОГРЕСС.md').read_text(encoding='utf-8'); print(sorted({c for c in s if 0x2E00 < ord(c) < 0xFF00}))"`
Expected: `[]`

- [ ] **Step 6: Финальная проверка по спецификации**

- `node инструменты/checksteps.js m0l1` — восемь «ок».
- `node инструменты/checkcards.js --require m0 m1 m2 m3 m4 m5 m6` — ошибок нет.
- Чистый профиль (правило 3): главная → «С чего начать» → 0.1 → `window.__steps()` из Task 3 Step 7 даёт восемь «ок» → «Перейти к следующему уроку» открывает `#m1l1`.
- Профиль с прогрессом: засев из Task 4 Step 1 даёт «продолжить» на `#m1l1`, не на 0.1.
- `#m1l1` и `#m2l1` работают как раньше (Task 2 Step 6).
- `read_console_messages` с `onlyErrors: true` — пусто.

- [ ] **Step 7: Commit**

```bash
git add инструменты/checkcards.js build.py sw.js README.md ПРОГРЕСС.md "Тетрадь аналитика.html"
git commit -m "Модуль 0 в инструментах, сборке и документации

checkcards проверяет модули 0–6 и берёт числа из текстов шагов,
сборка в один файл включает урок 0.1, версия кеша поднята.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```
