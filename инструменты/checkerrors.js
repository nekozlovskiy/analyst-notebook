#!/usr/bin/env node
/* Ошибки по-русски — правила из app.js на примерах: Check.sqlErr (что
   значит ошибка SQLite), Check.bareDate (дата без кавычек), Engine.loop
   (рекурсивный CTE, который не останавливается, — проба), pyTrace
   (короткая трассировка Python) и Check.pyErr на ней, Check.pyErr на
   корпусе ошибок новичка из Pyodide (PYERR) и на сообщениях pandas 3
   (PY3), Engine.writes (запрос меняет базу — уроки получат её заново).

   SQL. Каждый запрос из SQL выполняется на инструменты/shop.db
   (node:sqlite, только чтение) и должен упасть, а подсказка на его
   ошибку — содержать нужные слова. В браузере SQLite старше — sql.js
   1.10.3, SQLite 3.45.2 — и кое-где отвечает иначе (функция IF есть
   только с 3.48), поэтому третье поле — сообщение браузера на тот же
   запрос: подсказка на него должна быть той же. Сообщения записаны тем
   же sql.js 1.10.3 на базе из data.js; новое сообщение можно взять в
   песочнице курса. В MSG — сообщения, которых браузер не даёт (там
   запрос выполняется), а новая SQLite даёт.

   Трассировки в TRACES сняты в Pyodide 0.26.4 — том же, что у курса.

     node инструменты/checkerrors.js

   Новое правило в Check.sqlErr — новый пример здесь. Код выхода 1, если
   хоть один пример не сошёлся. */
"use strict";
const fs = require("fs"), vm = require("vm"), path = require("path");
const { DatabaseSync } = require("node:sqlite");

/* Check, Engine и pyTrace из app.js — как Taxi в checktaxi.js */
const src = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");
const ctx = {};
vm.createContext(ctx);
for (const [re, decl] of [[/\nconst Check = \{[\s\S]*?\n\};\n/, "const Check"],
                          [/\nconst Engine = \{[\s\S]*?\n\};\n/, "const Engine"],
                          [/\nfunction pyTrace\(msg\) \{[\s\S]*?\n\}\n/, null]]) {
  const m = src.match(re);
  if (!m) { console.log("В app.js не найден " + (decl || "pyTrace")); process.exit(1); }
  vm.runInContext(decl ? m[0].replace(decl, decl.replace("const", "var")) : m[0], ctx);
}
const { Check, Engine, pyTrace } = ctx;

/* [запрос, слова подсказки, сообщение SQLite 3.45.2 из браузера] */
const SQL = [
  ["SELECT user_id, ROW_NUMBER() OVER (ORDER BY signup_date) AS rn FROM users WHERE rn = 1",
   "Оконную функцию нельзя ставить в WHERE", "misuse of aliased window function rn"],
  ["SELECT user_id FROM users WHERE ROW_NUMBER() OVER (ORDER BY signup_date) = 1",
   "Оконную функцию нельзя ставить в WHERE", "misuse of window function ROW_NUMBER()"],
  ["SELECT city, COUNT(*) FROM users GROUP BY COUNT(*)",
   "В GROUP BY перечисляют столбцы", "aggregate functions are not allowed in the GROUP BY clause"],
  ["SELECT * FROM orders WHERE SUM(revenue) > 100",
   "SUM() стоит там, где строки ещё не сгруппированы", "misuse of aggregate function SUM()"],
  ["SELECT city, COUNT(*) FROM users WHERE COUNT(*) > 5 GROUP BY city",
   "HAVING COUNT(…) > 10", "misuse of aggregate: COUNT()"],
  ["SELECT * FROM users u JOIN orders o ON COUNT(*) > 1",
   "COUNT() стоит там, где строки ещё не сгруппированы", "misuse of aggregate function COUNT()"],
  ["SELECT AVG(MAX(revenue)) FROM orders",
   "Агрегат внутри агрегата", "misuse of aggregate function MAX()"],
  ["SELECT city, SUM(COUNT(*)) FROM users GROUP BY city",
   "Агрегат внутри агрегата", "misuse of aggregate function COUNT()"],
  ["SELECT city FROM users WHERE city = «Москва»",
   "Кавычки «ёлочки» и “лапки” SQL не понимает", "no such column: «Москва»"],
  ["SELECT city FROM users WHERE city = ‘Москва’",
   "Кавычки «ёлочки» и “лапки” SQL не понимает", "no such column: ‘Москва’"],
  ["SELECT “city” FROM users",
   "Кавычки «ёлочки» и “лапки” SQL не понимает", "no such column: “city”"],
  ["SELECT date(order_date) + INTERVAL '1 day' FROM orders",
   "INTERVAL в SQLite нет", "no such column: INTERVAL"],
  ["SELECT DATEDIFF(day, signup_date, '2024-05-01') FROM users",
   "Функции DATEDIFF в SQLite нет. Даты здесь считают", "no such column: day"],
  ["SELECT DATEADD(day, 7, order_date) FROM orders",
   "Функции DATEADD в SQLite нет", "no such column: day"],
  ["SELECT TIMESTAMPDIFF(DAY, signup_date, '2024-05-01') FROM users",
   "Функции TIMESTAMPDIFF в SQLite нет", "no such column: DAY"],
  ["SELECT city FROM users u JOIN orders o ON u.user_id = o.user_id WHERE x.city = 'Москва'",
   "У таблицы x нет столбца city", "no such column: x.city"],
  ["SELECT u.city FROM users JOIN orders o ON users.user_id = o.user_id",
   "У таблицы u нет столбца city", "no such column: u.city"],
  ["SELECT * FROM orders o JOIN users u ON o.user_id = u.id",
   "У таблицы u нет столбца id", "no such column: u.id"],
  ["SELECT revenue * 2 AS r2, r2 + 1 FROM orders",
   "«r2» — псевдоним из этого же SELECT", "no such column: r2"],
  ["SELECT revenue AS выручка, выручка * 2 FROM orders",
   "«выручка» — псевдоним из этого же SELECT", "no such column: выручка"],
  ["SELECT * FROM users AS u WHERE u = 1",
   "Столбца u нет в таблицах запроса", "no such column: u"],
  ["SELECT city, COUNT(*) FROM users WHERE city = Москва GROUP BY city",
   "Столбца «Москва» нет. Если это значение", "no such column: Москва"],
  ["SELECT city, COUNT(*) FROM users GROUP BY cty",
   "Столбца cty нет в таблицах запроса", "no such column: cty"],
  ["SELECT city, AVG(revenue) FROM users",
   "Столбца revenue нет в таблицах запроса", "no such column: revenue"],
  ["SELECT city, COUNT(*) FROM user GROUP BY city",
   "Таблицы user нет в базе", "no such table: user"],
  ["WITH t AS (SELECT city FROM users) SELECT * FROM t WHERE city = 'Москва'; SELECT * FROM t",
   "Таблица из WITH видна только внутри своего запроса", "no such table: t"],
  ["SELECT * FROM users WHERE city IN 'Москва'",
   "Значения после IN берут в скобки", "no such table: Москва"],
  ["SELECT POSITION('а' IN city) FROM users",
   "POSITION(… IN …) в SQLite нет", "no such table: city"],
  ["SELECT user_id, COUNT(*) FROM users u JOIN orders o ON u.user_id = o.user_id GROUP BY 1",
   "Столбец user_id есть в нескольких таблицах", "ambiguous column name: user_id"],
  ["SELECT DATE_TRUNC('month', order_date) FROM orders",
   "Функции DATE_TRUNC в SQLite нет. Даты здесь считают", "no such function: DATE_TRUNC"],
  ["SELECT NOW()",
   "Функции NOW в SQLite нет. Даты здесь считают", "no such function: NOW"],
  ["SELECT toStartOfMonth(order_date) FROM orders",
   "Функции toStartOfMonth в SQLite нет. Даты здесь считают", "no such function: toStartOfMonth"],
  ["SELECT YEAR(order_date) FROM orders",
   "Функции YEAR в SQLite нет. Даты здесь считают", "no such function: YEAR"],
  ["SELECT NVL(revenue, 0) FROM orders",
   "COALESCE(revenue, 0)", "no such function: NVL"],
  ["SELECT IF(revenue > 100, 1, 0) FROM orders",
   "IF(…) — из MySQL", "no such function: IF"],
  ["SELECT LEFT(city, 3) FROM users",
   "substr(city, 1, 3)", "no such function: LEFT"],
  ["SELECT RIGHT(city, 3) FROM users",
   "substr(city, -3)", "no such function: RIGHT"],
  ["SELECT LEN(city) FROM users",
   "length(city)", "no such function: LEN"],
  ["SELECT STRPOS(city, 'а') FROM users",
   "instr(city, 'а')", "no such function: STRPOS"],
  ["SELECT GREATEST(revenue, 100) FROM orders",
   "max(a, b)", "no such function: GREATEST"],
  ["SELECT LEAST(revenue, 100) FROM orders",
   "min(a, b)", "no such function: LEAST"],
  ["SELECT city, ARRAY_AGG(platform) FROM users GROUP BY city",
   "group_concat(platform, ', ')", "no such function: ARRAY_AGG"],
  ["SELECT COUNTIF(revenue > 100) FROM orders",
   "SUM(CASE WHEN условие THEN 1 ELSE 0 END)", "no such function: COUNTIF"],
  ["SELECT uniqExact(user_id) FROM orders",
   "COUNT(DISTINCT user_id)", "no such function: uniqExact"],
  ["SELECT STDDEV(revenue) FROM orders",
   "у каждой базы свой набор функций", "no such function: STDDEV"],
  ["SELECT COUNT(DISTINCT city, platform) FROM users",
   "COUNT(DISTINCT …) в SQLite принимает один столбец", "wrong number of arguments to function COUNT()"],
  ["SELECT ROUND(revenue, 2, 3) FROM orders",
   "У функции ROUND другое число аргументов", "wrong number of arguments to function ROUND()"],
  ["SELECT user_id FROM users WHERE user_id IN (SELECT user_id, revenue FROM orders)",
   "должен вернуть один столбец, а возвращает 2", "sub-select returns 2 columns - expected 1"],
  ["SELECT * FROM orders WHERE revenue > (SELECT AVG(revenue), MAX(revenue) FROM orders)",
   "Там, где ждут одно значение, стоит несколько", "row value misused"],
  ["SELECT user_id FROM users UNION SELECT user_id, revenue FROM orders",
   "У частей UNION разное число столбцов", "SELECTs to the left and right of UNION do not have the same number of result columns"],
  ["SELECT city, COUNT(*) FROM users GROUP BY 3",
   "Число в GROUP BY — номер столбца в SELECT, а столбцов всего 2", "1st GROUP BY term out of range - should be between 1 and 2"],
  ["SELECT city, COUNT(*) FROM users GROUP BY city ORDER BY 3",
   "Число в ORDER BY — номер столбца в SELECT", "1st ORDER BY term out of range - should be between 1 and 2"],
  ["CREATE TABLE users (x INT)",
   "Таблица users уже есть в базе", "table users already exists"],
  ["SELECT city FROM users WHERE",
   "Запрос оборвался", "incomplete input"],
  ["SELECT * FROM users u LEFT JOIN orders o ON",
   "Запрос оборвался", "incomplete input"],
  ["SELECT * FROM users WHERE city IN ('Москва', 'Казань'",
   "Запрос оборвался", "incomplete input"],
  ["SELECT city, COUNT(*) FROM users GROUP BY city HAVING;",
   "Запрос оборвался", "near \";\": syntax error"],
  ["SELECT city, COUNT(*) FROM users GROUP BY city,;",
   "Запрос оборвался", "near \";\": syntax error"],
  ["SELECT city, COUNT(*) FROM users WHERE city = 'Москва GROUP BY city",
   "Не закрыта одинарная кавычка", "unrecognized token: \"'Москва GROUP BY city\""],
  ["SELECT order_date::date FROM orders",
   "Приведение типа через :: — из PostgreSQL", "unrecognized token: \":\""],
  ["SELECT `city FROM users",
   "В запросе знак, которого SQL не знает", "unrecognized token: \"`city FROM users\""],
  ["SELECT CASE WHEN revenue > 100 THEN 'big' ELSE 'small' FROM orders",
   "У CASE нет END", "near \"FROM\": syntax error"],
  ["SELECT EXTRACT(MONTH FROM order_date) FROM orders",
   "EXTRACT — из PostgreSQL", "near \"FROM\": syntax error"],
  ["SELECT DATE_ADD(order_date, INTERVAL 7 DAY) FROM orders",
   "INTERVAL в SQLite нет", "near \"7\": syntax error"],
  ["SELECT TOP 5 * FROM users",
   "TOP — из SQL Server", "near \"5\": syntax error"],
  ["SELECT * FROM order",
   "Заказы лежат в таблице orders", "near \"order\": syntax error"],
  ["SELECT * FROM users u JOIN order o ON u.user_id = o.user_id",
   "Заказы лежат в таблице orders", "near \"order\": syntax error"],
  ["SELECT city FROM users GROUP city",
   "После GROUP и ORDER нужно слово BY", "near \"city\": syntax error"],
  ["SELECT city FROM users ORDER city",
   "После GROUP и ORDER нужно слово BY", "near \"city\": syntax error"],
  ["SELECT * FROM users WHERE city ILIKE 'мос%'",
   "ILIKE в SQLite нет", "near \"ILIKE\": syntax error"],
  ["SELECT ISNULL(revenue, 0) FROM orders",
   "ISNULL(x, 0) — из SQL Server", "near \"ISNULL\": syntax error"],
  ["SELECT * FROM users WHERE user_id IN SELECT user_id FROM orders",
   "Подзапрос берут в скобки", "near \"SELECT\": syntax error"],
  ["WITH t AS SELECT city FROM users SELECT * FROM t",
   "Запрос внутри WITH берут в скобки", "near \"SELECT\": syntax error"],
  ["SELECT * FROM users SELECT * FROM orders",
   "Новый SELECT начался, а прошлый запрос не закончен", "near \"SELECT\": syntax error"],
  ["SELECT DISTINCT ON (city) city FROM users",
   "DISTINCT ON — из PostgreSQL", "near \"ON\": syntax error"],
  ["SELECT * FROM users JOIN orders USING user_id",
   "После USING имя столбца берут в скобки", "near \"user_id\": syntax error"],
  ["SELECT city, COUNT(*), FROM users GROUP BY city",
   "Перед FROM что-то лишнее или незакрытое", "near \"FROM\": syntax error"],
  ["SELECT city, COUNT(* FROM users GROUP BY city",
   "Перед FROM что-то лишнее или незакрытое", "near \"FROM\": syntax error"],
  ["SELECT * FROM users WHERE city = 'Москва' WHERE platform = 'ios'",
   "WHERE в запросе один", "near \"WHERE\": syntax error"],
  ["SELECT * FROM users WHERE city = 'Москва' AND user_id IN (SELECT user_id FROM orders WHERE revenue > 100) WHERE platform = 'ios'",
   "WHERE в запросе один", "near \"WHERE\": syntax error"],
  ["SELECT city, COUNT(*) FROM users GROUP BY city WHERE city = 'Москва'",
   "WHERE стоит сразу после FROM и JOIN", "near \"WHERE\": syntax error"],
  ["SELECT * FROM users u WHERE city = 'Москва' JOIN orders o ON u.user_id = o.user_id",
   "JOIN стоит сразу после FROM", "near \"JOIN\": syntax error"],
  ["SELECT * FROM users u WHERE city = 'Москва' LEFT JOIN orders o ON u.user_id = o.user_id",
   "JOIN стоит сразу после FROM", "near \"LEFT\": syntax error"],
  ["SELECT city, COUNT(*) FROM users ORDER BY city GROUP BY city",
   "GROUP BY стоит после WHERE", "near \"GROUP\": syntax error"],
  ["SELECT city FROM users HAVING COUNT(*) > 1 GROUP BY city",
   "GROUP BY стоит после WHERE", "near \"GROUP\": syntax error"],
  ["SELECT city, COUNT(*) FROM users LIMIT 5 ORDER BY city",
   "ORDER BY стоит в конце", "near \"ORDER\": syntax error"],
  ["SELECT city, COUNT(*) FROM users ORDER BY city HAVING COUNT(*) > 1",
   "HAVING стоит сразу после GROUP BY", "near \"HAVING\": syntax error"],
  ["SELECT city COUNT(*) FROM users GROUP BY city",
   "пропущена запятая перед функцией", "near \"(\": syntax error"],
  ["SELECT city, COUNT(*)) FROM users GROUP BY city",
   "Лишняя закрывающая скобка", "near \")\": syntax error"],
  ["SELECT * FROM users WHERE user_id IN (1, 2,)",
   "Лишняя закрывающая скобка", "near \")\": syntax error"],
  ["SELECT * FROM users WHERE city IN ('Москва' 'Казань')",
   "Перед текстом в кавычках пропущена запятая", "near \"'Казань'\": syntax error"],
  ["SELEC city FROM users",
   "База не поняла запрос рядом с «SELEC»", "near \"SELEC\": syntax error"],
  ["SELECT * FORM users",
   "База не поняла запрос рядом с «FORM»", "near \"FORM\": syntax error"],
  ["SELECT * FROM users WHERE city = 'Москва' platform = 'ios'",
   "База не поняла запрос рядом с «platform»", "near \"platform\": syntax error"],
  ["-- GROUP city\nSELECT * FROM users WHERE city = 'Москва' WHERE platform = 'ios'",
   "WHERE в запросе один", "near \"WHERE\": syntax error"],
  ["SELECT * FROM users WHERE city = 'order by' platform = 'ios'",
   "База не поняла запрос рядом с «platform»", "near \"platform\": syntax error"],
  ["SELECT * FROM users WHERE platform = ios' AND city = 'Москва'",
   "Не закрыта одинарная кавычка", "near \"' AND city = '\": syntax error"],
  ["SELECT CASE WHEN status = 'paid THEN 'ok' ELSE 'no' END FROM orders",
   "Не закрыта одинарная кавычка", "near \"ok\": syntax error"],
  ["SELECT * FROM users WHERE city = 'Москва AND platform = 'ios'",
   "Не закрыта одинарная кавычка", "near \"ios\": syntax error"],
  ["SELECT * FROM users WHERE city IN ('Москва, 'Казань')",
   "Не закрыта одинарная кавычка", "near \"Казань\": syntax error"],
  ["SELECT city, COUNT(*) FROM users GROUP BY city, ORDER BY 2",
   "Перед ORDER лишняя запятая", "near \"ORDER\": syntax error"],
  ["SELECT city FROM users WHERE city = 'Москва' AND GROUP BY city",
   "после AND должно идти ещё одно", "near \"GROUP\": syntax error"],
  ["SELECT * FROM users u WHERE ORDER BY u.user_id",
   "После WHERE нет условия", "near \"ORDER\": syntax error"],
  ["SELECT u.city, SUM(o.revenue) AS total FROM users u JOIN orders o ON o.user_id = u.user_id GROUP BY u.city, HAVING total > 100",
   "Перед HAVING лишняя запятая", "near \"HAVING\": syntax error"],
  ["SELECT * FROM orders, JOIN users USING (user_id)",
   "Перед JOIN лишняя запятая", "near \"JOIN\": syntax error"],
  ["SELECT * FROM users u JOIN orders o ON WHERE o.revenue > 100",
   "После ON нет условия соединения", "near \"WHERE\": syntax error"],
  ["SELECT user_id, ROW_NUMBER() (PARTITION BY user_id ORDER BY order_date) FROM orders",
   "пропущено OVER", "near \"(\": syntax error"],
  ["SELECT user_id, ROW_NUMBER OVER (PARTITION BY user_id ORDER BY order_date) AS rn FROM orders",
   "У ROW_NUMBER нужны скобки", "near \"(\": syntax error"],
  ["SELECT user_id, ROW_NUMBER() OVER PARTITION BY user_id ORDER BY order_date AS rn FROM orders",
   "После OVER скобки обязательны", "near \"user_id\": syntax error"],
  ["SELECT * FROM users u WHERE u.user_id (65, 76)",
   "После u.user_id пропущено IN: u.user_id IN (65, 76)", "near \"(\": syntax error"],
  ["SELECT city COUNT(*) FROM users GROUP BY city",
   "пропущена запятая перед функцией", "near \"(\": syntax error"],
  ["WITH paid AS (SELECT user_id, SUM(revenue) AS total FROM orders GROUP BY user_id), big AS (SELECT user_id FROM paid WHERE total > 100) SELECT user_id, total FROM big",
   "считается внутри подзапроса или CTE", "no such column: total"],
  ["WITH t AS (SELECT SUM(revenue) AS total FROM orders) SELECT total FROM orders",
   "считается внутри подзапроса или CTE", "no such column: total"],
  ["SELECT revenue * 2 AS dbl, ROUND(dbl, 1) FROM orders",
   "псевдоним из этого же SELECT", "no such column: dbl"],
  ["SELECT COUNT(*) AS order FROM orders",
   "«order» — служебное слово SQL", "near \"order\": syntax error"],
  ["SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY revenue) FROM orders",
   "WITHIN GROUP — из PostgreSQL", "near \"(\": syntax error"],
  ["SELECT city, COUNT(*) AS where FROM users GROUP BY city",
   "«where» — служебное слово SQL", "near \"where\": syntax error"],
  ["SELECT * FROM users WHERE city IN ['Москва', 'Казань']",
   "в круглые скобки, а не в квадратные", "no such table: 'Москва', 'Казань'"],
  ["SELECT * FROM users WHERE city ('Москва', 'Казань')",
   "пропущено IN — city IN ('Москва', 'Казань')", "no such function: city"],
  ["SELECT city, SUM(revenue AS total FROM orders o JOIN users u USING (user_id) GROUP BY city",
   "Открывающих скобок 2, закрывающих 1", "near \"AS\": syntax error"],
  ["SELECT city FROM users WHERE platform = 'ios' UNION SELECT city FROM users u JOIN orders o ON o.user_id = u.user_id GROUP BY city WHERE city = 'Москва'",
   "WHERE стоит сразу после FROM и JOIN", "near \"WHERE\": syntax error"],
  ["SELECT city FROM users GROUP BY 2",
   "подойдёт только 1", "1st GROUP BY term out of range - should be between 1 and 1"],
  ["WITH t AS (SELECT 1) SELECT * FROM t; SELECT * FROM t",
   "Таблица из WITH видна только", "no such table: t"],
  ["WITH t AS (SELECT user_id FROM orders WHERE rev > 1000) SELECT t.user_id, o.revenue AS rev FROM t JOIN orders o ON o.user_id = t.user_id",
   "псевдоним внешнего запроса", "no such column: rev"],
  ["SELECT user_id, revenue AS rev FROM (SELECT * FROM orders WHERE rev > 100)",
   "псевдоним внешнего запроса", "no such column: rev"],
  ["SELECT city (COUNT(*)) FROM users GROUP BY city",
   "пропущена запятая, без неё база читает city(…) как вызов функции. Столбцы SELECT разделяют запятыми: city, COUNT(*).",
   "no such function: city"],
  ["SELECT ROUD(2.567, 2)",
   "Функции ROUD в SQLite нет: у каждой базы свой набор функций", "no such function: ROUD"],
  ["SELECT user_id, SUM(revenue) OVER (PARTITION BY user_id WHERE revenue > 0) FROM orders",
   "Внутри OVER (…) условий не пишут", "near \"WHERE\": syntax error"],
  ["SELECT user_id, SUM(revenue) OVER (PARTITION BY strftime('%Y', order_date) WHERE revenue > 0) FROM orders",
   "Внутри OVER (…) условий не пишут", "near \"WHERE\": syntax error"],
  ["SELECT * FROM (SELECT user_id FROM orders) WHERE user_id > 1 WHERE user_id < 10",
   "WHERE в запросе один", "near \"WHERE\": syntax error"],
  ["SELECT user_id, COUNT(*) FILTER (WHERE status = 'paid') FROM orders GROUP BY user_id WHERE user_id > 1",
   "Условие на группы после GROUP BY пишут в HAVING", "near \"WHERE\": syntax error"]
];

/* [сообщение SQLite новее браузерной, запрос, слова подсказки] */
const MSG = [
  ["no such column: \"Москва\" - should this be a string literal in single-quotes?",
   "SELECT city FROM users WHERE city = \"Москва\"", "Двойные кавычки в SQL — для имён столбцов"]
];

/* [запрос, слова подсказки или "" — даты без кавычек нет] */
const DATES = [
  ["SELECT city FROM users WHERE signup_date BETWEEN 2024-01-01 AND 2024-02-01", "2024 − 01 − 01 = 2022"],
  ["SELECT * FROM orders WHERE order_date >= 2024-05-01", "2024 − 05 − 01 = 2018. Даты пишут в одинарных кавычках: '2024-05-01'"],
  ["SELECT * FROM orders WHERE strftime('%Y-%m', order_date) = 2024-05", "2024 − 05 = 2019"],
  ["SELECT * FROM orders WHERE order_date >= '2024-05-01'", ""],
  ["SELECT * FROM orders WHERE order_date >= \"2024-05-01\"", ""],
  ["-- с 2024-05-01\nSELECT * FROM orders", ""],
  ["/* 2024-05-01 */ SELECT * FROM orders", ""],
  ["SELECT 1000-50, 2024-13-01", ""],
  ["SELECT user_id-2024-01 FROM users", ""]
];

/* Трассировки Pyodide 0.26.4 с pandas 2.2: code — что запускали (orders —
   таблица из двух строк), want — что остаётся после pyTrace, hint — слова
   Check.pyErr на этом остатке. */
const TRACES = [
  { code: "x = 1\nprint(orders[\"revenu\"].sum())",
    trace: [
      "Traceback (most recent call last):",
      "  File \"/lib/python3.12/site-packages/pandas/core/indexes/base.py\", line 3802, in get_loc",
      "    return self._engine.get_loc(casted_key)",
      "           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^",
      "  File \"index.pyx\", line 153, in pandas._libs.index.IndexEngine.get_loc",
      "  File \"index.pyx\", line 182, in pandas._libs.index.IndexEngine.get_loc",
      "  File \"pandas/_libs/hashtable_class_helper.pxi\", line 7081, in pandas._libs.hashtable.PyObjectHashTable.get_item",
      "  File \"pandas/_libs/hashtable_class_helper.pxi\", line 7089, in pandas._libs.hashtable.PyObjectHashTable.get_item",
      "KeyError: 'revenu'",
      "",
      "The above exception was the direct cause of the following exception:",
      "",
      "Traceback (most recent call last):",
      "  File \"/lib/python312.zip/_pyodide/_base.py\", line 597, in eval_code_async",
      "    await CodeRunner(",
      "  File \"/lib/python312.zip/_pyodide/_base.py\", line 411, in run_async",
      "    coroutine = eval(self.code, globals, locals)",
      "                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^",
      "  File \"<exec>\", line 2, in <module>",
      "  File \"/lib/python3.12/site-packages/pandas/core/frame.py\", line 4090, in __getitem__",
      "    indexer = self.columns.get_loc(key)",
      "              ^^^^^^^^^^^^^^^^^^^^^^^^^",
      "  File \"/lib/python3.12/site-packages/pandas/core/indexes/base.py\", line 3809, in get_loc",
      "    raise KeyError(key) from err",
      "KeyError: 'revenu'"
    ],
    want: "Traceback (most recent call last):\n  File \"<exec>\", line 2, in <module>\nKeyError: 'revenu'",
    hint: "Нет столбца revenu" },
  { code: "print(\"a\"",
    trace: [
      "Traceback (most recent call last):",
      "  File \"/lib/python312.zip/_pyodide/_base.py\", line 597, in eval_code_async",
      "    await CodeRunner(",
      "          ^^^^^^^^^^^",
      "  File \"/lib/python312.zip/_pyodide/_base.py\", line 285, in __init__",
      "    self.ast = next(self._gen)",
      "               ^^^^^^^^^^^^^^^",
      "  File \"/lib/python312.zip/_pyodide/_base.py\", line 149, in _parse_and_compile_gen",
      "    mod = compile(source, filename, mode, flags | ast.PyCF_ONLY_AST)",
      "          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^",
      "  File \"<exec>\", line 1",
      "    print(\"a\"",
      "         ^",
      "SyntaxError: '(' was never closed"
    ],
    want: "Traceback (most recent call last):\n  File \"<exec>\", line 1\n    print(\"a\"\n         ^\nSyntaxError: '(' was never closed",
    hint: "Не закрыта скобка" },
  { code: "def f(t):\n    return t[\"nope\"]\n\nprint(f(orders))",
    trace: [
      "Traceback (most recent call last):",
      "  File \"/lib/python3.12/site-packages/pandas/core/indexes/base.py\", line 3802, in get_loc",
      "    return self._engine.get_loc(casted_key)",
      "           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^",
      "  File \"index.pyx\", line 153, in pandas._libs.index.IndexEngine.get_loc",
      "  File \"index.pyx\", line 182, in pandas._libs.index.IndexEngine.get_loc",
      "  File \"pandas/_libs/hashtable_class_helper.pxi\", line 7081, in pandas._libs.hashtable.PyObjectHashTable.get_item",
      "  File \"pandas/_libs/hashtable_class_helper.pxi\", line 7089, in pandas._libs.hashtable.PyObjectHashTable.get_item",
      "KeyError: 'nope'",
      "",
      "The above exception was the direct cause of the following exception:",
      "",
      "Traceback (most recent call last):",
      "  File \"/lib/python312.zip/_pyodide/_base.py\", line 597, in eval_code_async",
      "    await CodeRunner(",
      "  File \"/lib/python312.zip/_pyodide/_base.py\", line 411, in run_async",
      "    coroutine = eval(self.code, globals, locals)",
      "                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^",
      "  File \"<exec>\", line 4, in <module>",
      "  File \"<exec>\", line 2, in f",
      "  File \"/lib/python3.12/site-packages/pandas/core/frame.py\", line 4090, in __getitem__",
      "    indexer = self.columns.get_loc(key)",
      "              ^^^^^^^^^^^^^^^^^^^^^^^^^",
      "  File \"/lib/python3.12/site-packages/pandas/core/indexes/base.py\", line 3809, in get_loc",
      "    raise KeyError(key) from err",
      "KeyError: 'nope'"
    ],
    want: "Traceback (most recent call last):\n  File \"<exec>\", line 4, in <module>\n  File \"<exec>\", line 2, in f\nKeyError: 'nope'",
    hint: "Нет столбца nope" },
  { code: "print(paid)",
    trace: [
      "Traceback (most recent call last):",
      "  File \"/lib/python312.zip/_pyodide/_base.py\", line 597, in eval_code_async",
      "    await CodeRunner(",
      "  File \"/lib/python312.zip/_pyodide/_base.py\", line 411, in run_async",
      "    coroutine = eval(self.code, globals, locals)",
      "                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^",
      "  File \"<exec>\", line 1, in <module>",
      "NameError: name 'paid' is not defined"
    ],
    want: "Traceback (most recent call last):\n  File \"<exec>\", line 1, in <module>\nNameError: name 'paid' is not defined",
    hint: "Python не знает имени paid" }
];

/* [запрос, слова подсказки (строка или список) или "" — проба не должна
   сработать]. Рекурсивный CTE, который не останавливается: Engine.loop
   считает его пробой с потолком, Check.sqlErr объясняет её текст */
const LOOPS = [
  ["WITH RECURSIVE calendar(d) AS (SELECT 2024-07-01 UNION ALL SELECT date(d, '+1 day') FROM calendar WHERE d < '2024-07-31') " +
   "SELECT c.d, COUNT(o.order_id) AS orders_cnt FROM calendar c LEFT JOIN orders o ON o.order_date = c.d GROUP BY c.d",
   "Календарь начинается с числа, а не с даты"],
  ["WITH RECURSIVE cal(d) AS (SELECT '2024-01-01' UNION ALL SELECT date(d, '+1 day') FROM cal) SELECT * FROM cal",
   "В шаге рекурсивного CTE нет WHERE"],
  ["WITH RECURSIVE calendar(d) AS (SELECT '2024-07-01' UNION ALL SELECT date(d, '-1 day') FROM calendar WHERE d < '2024-07-31') SELECT * FROM calendar",
   "шаг идёт к границе"],
  ["WITH RECURSIVE weeks(week_start) AS (SELECT '2024-04-01' UNION ALL SELECT date(week_start, '+7 day') FROM weeks " +
   "WHERE week_start <> '2024-07-31') SELECT * FROM weeks", "шаг её перепрыгнул"],
  ["WITH RECURSIVE calendar(d) AS (SELECT '2024-07-01' UNION ALL SELECT date(d, '+1 day') FROM calendar WHERE d <> 2024-07-31) SELECT * FROM calendar",
   "любое число меньше любого текста"],
  ["SELECT COUNT(*) FROM (WITH RECURSIVE c(d) AS (SELECT 1 UNION ALL SELECT d + 1 FROM c WHERE d > 0) SELECT d FROM c)",
   "шаг идёт к границе"],
  ["WITH RECURSIVE a(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM a WHERE x < 5),\n  b(y) AS (SELECT 1 UNION ALL SELECT y + 1 FROM b WHERE y > 0)\nSELECT * FROM a, b",
   "Рекурсивный CTE добавляет строки"],
  ["WITH RECURSIVE calendar(d) AS (\n    SELECT '2024-07-01'\n    UNION ALL\n    SELECT date(d, '+1 day')\n    FROM calendar\n    WHERE d < '2024-07-31' -- стоп)\n)\nSELECT * FROM calendar", ""],
  ["WITH RECURSIVE calendar(d) AS (SELECT '2024-07-01' UNION ALL SELECT date(d, '+1 day') FROM calendar WHERE d < 2024-07-31) SELECT * FROM calendar", ""],
  ["WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM n LIMIT 5) SELECT * FROM n", ""],
  ["WITH RECURSIVE chain(id) AS (SELECT 1 UNION ALL SELECT u.user_id FROM users u JOIN chain c ON u.user_id = c.id + 1) SELECT COUNT(*) FROM chain", ""],
  ["-- WITH RECURSIVE c AS (SELECT 1 FROM c)\nSELECT 'WITH RECURSIVE c AS (SELECT 1 UNION ALL SELECT 1 FROM c)'", ""],
  ["WITH t AS (SELECT * FROM orders) SELECT COUNT(*) FROM t", ""],
  ["WITH cal(d) AS (SELECT '2024-01-01' UNION ALL SELECT date(d, '+1 day') FROM cal) SELECT * FROM cal",
   "В шаге рекурсивного CTE нет WHERE"],
  ["WITH RECURSIVE cal(d) AS(SELECT '2024-01-01' UNION ALL SELECT date(d, '+1 day') FROM cal) SELECT * FROM cal",
   "FROM cal WHERE d < '2024-07-31'"],
  ["WITH RECURSIVE \"c\"(d) AS MATERIALIZED(SELECT 1 UNION ALL SELECT d + 1 FROM \"c\") SELECT * FROM \"c\"",
   "FROM \"c\" WHERE d < 100"],
  ["WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM n) SELECT x FROM n LIMIT 10",
   ["FROM n WHERE x < 100", "LIMIT снаружи страхует только простой SELECT"]],
  ["WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM n WHERE x < 200000) SELECT COUNT(*) FROM n",
   ["не стало ложным", "сузьте диапазон"]],
  ["WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM n WHERE x < 20000) SELECT COUNT(*) FROM n", ""],
  ["WITH city AS (SELECT user_id, city FROM users) SELECT COUNT(*) FROM city", ""],
  ["WITH RECURSIVE cal(d) AS (SELECT '2024-01-01' UNION ALL SELECT strftime('%Y-%m-%d', d, '+1 day') FROM cal) SELECT * FROM cal",
   "FROM cal WHERE d < '2024-07-31'"],
  ["WITH RECURSIVE cal(d) AS (SELECT '2024-01-01' UNION ALL SELECT date(d, '+1 day') FROM cal) SELECT * FROM cal WHERE d < '2024-01-31'",
   "WHERE в стартовой строке или в основном запросе рекурсию не останавливает"],
  ["WITH RECURSIVE \"my cal\"(d) AS (SELECT 1 UNION ALL SELECT d + 1 FROM \"my cal\") SELECT * FROM \"my cal\"",
   "FROM \"my cal\" WHERE d < 100"]
];

/* [код ученика, короткая трассировка Pyodide 0.26.4 (pandas 2.2.0, как в
   браузере), слова подсказки Check.pyErr]. Трассировки сняты на данных
   урока с прологом SH.pyPrelude; TimeoutError — от защиты GUARD_PY */
const PYERR = [
  ["print(orders[orders.revenue > 100 and orders.status == 'paid'])",
   "Traceback (most recent call last):\n  File \"<exec>\", line 1, in <module>\nValueError: The truth value of a Series is ambiguous. Use a.empty, a.bool(), a.item(), a.any() or a.all().",
   "and, or и not работают с одним значением, а сравнение столбц"],
  ["print(orders[orders.revenue > 100 & orders.status == 'paid'])",
   "Traceback (most recent call last):\n  File \"<exec>\", line 1, in <module>\nTypeError: Cannot perform 'rand_' with a dtyped [object] array and scalar of type [bool]",
   "Условия, соединённые & или |, берут в скобки"],
  ["orders = orders.dropna(inplace=True)\nprint(orders.head())",
   "Traceback (most recent call last):\n  File \"<exec>\", line 2, in <module>\nAttributeError: 'NoneType' object has no attribute 'head'",
   "С inplace=True метод меняет таблицу на месте и возвращает No"],
  ["orders.loc[0, 'revenue'] = None\nprint(orders['revenue'].astype(int))",
   "Traceback (most recent call last):\n  File \"<exec>\", line 2, in <module>\npandas.errors.IntCastingNaNError: Cannot convert non-finite values (NA or inf) to integer",
   "В столбце есть пропуски (NaN), а целое число из пропуска не "],
  ["print(orders[orders.order_date > 2024])",
   "Traceback (most recent call last):\n  File \"<exec>\", line 1, in <module>\nTypeError: Invalid comparison between dtype=datetime64[ns] and int",
   "Даты сравнивают с датой, а не с числом"],
  ["users['user_id'] = users['user_id'].astype(str)\nprint(orders.merge(users, on='user_id'))",
   "Traceback (most recent call last):\n  File \"<exec>\", line 2, in <module>\nValueError: You are trying to merge on int64 and object columns for key 'user_id'. If you wish to proceed you should use pd.concat",
   "Столбцы, по которым соединяете таблицы, разных типов"],
  ["print(orders.merge(events[['event_name']]))",
   "Traceback (most recent call last):\n  File \"<exec>\", line 1, in <module>\npandas.errors.MergeError: No common columns to perform merge on. Merge options: left_on=None, right_on=None, left_index=False, right_index=False",
   "У таблиц нет общего столбца, по которому их соединить"],
  ["plt.plot([1, 2, 3])",
   "Traceback (most recent call last):\n  File \"<exec>\", line 1, in <module>\nNameError: name 'plt' is not defined",
   "plt"],
  ["import seaborn as sns",
   "Traceback (most recent call last):\n  File \"<exec>\", line 1, in <module>\nModuleNotFoundError: No module named 'seaborn'",
   "seaborn в курсе нет"],
  ["print(orders.groupby('user_id').mean())",
   "Traceback (most recent call last):\n  File \"<exec>\", line 1, in <module>\nTypeError: agg function failed [how->mean,dtype->object]",
   "Среднее или сумма посчитаны по столбцу с текстом"],
  ["orders['order_date'] = orders['order_date'].astype(str)\nprint(orders['order_date'].dt.month)",
   "Traceback (most recent call last):\n  File \"<exec>\", line 2, in <module>\nAttributeError: Can only use .dt accessor with datetimelike values",
   "В столбце не даты, а текст или числа, а"],
  ["print(orders['revenue'].str.upper())",
   "Traceback (most recent call last):\n  File \"<exec>\", line 1, in <module>\nAttributeError: Can only use .str accessor with string values!. Did you mean: 'std'?",
   "Методы"],
  ["print(orders.iloc[100000])",
   "Traceback (most recent call last):\n  File \"<exec>\", line 1, in <module>\nIndexError: single positional indexer is out-of-bounds",
   "Строки с таким номером нет"],
  ["print(orders.sort_values('revenue', ascending='False'))",
   "Traceback (most recent call last):\n  File \"<exec>\", line 1, in <module>\nValueError: For argument \"ascending\" expected type bool, received type str.",
   "True и False пишут без кавычек"],
  ["print(orders[['revenue', 'city']])",
   "Traceback (most recent call last):\n  File \"<exec>\", line 1, in <module>\nKeyError: \"['city'] not in index\"",
   "Нет столбца city"],
  ["print(orders('revenue'))",
   "Traceback (most recent call last):\n  File \"<exec>\", line 1, in <module>\nTypeError: 'DataFrame' object is not callable",
   "Столбец берут квадратными скобками, а не круглыми"],
  ["print(int('1 200'))",
   "Traceback (most recent call last):\n  File \"<exec>\", line 1, in <module>\nValueError: invalid literal for int() with base 10: '1 200'",
   "Текст не превращается в число"],
  ["print(float('12,5'))",
   "Traceback (most recent call last):\n  File \"<exec>\", line 1, in <module>\nValueError: could not convert string to float: '12,5'",
   "Текст не превращается в число"],
  ["orders['x'] = [1, 2, 3]",
   "Traceback (most recent call last):\n  File \"<exec>\", line 1, in <module>\nValueError: Length of values (3) does not match length of index (215)",
   "В новый столбец кладут 3 значения, а строк в таблице 215"],
  ["print(pd.concat(orders, users))",
   "Traceback (most recent call last):\n  File \"<exec>\", line 1, in <module>\nTypeError: concat() takes 1 positional argument but 2 were given",
   "Таблицы для pd"],
  ["print(orders.pivot(index='user_id', columns='status', values='revenue'))",
   "Traceback (most recent call last):\n  File \"<exec>\", line 1, in <module>\nValueError: Index contains duplicate entries, cannot reshape",
   "pivot не может разложить таблицу"],
  ["for x in 5:\n    print(x)",
   "Traceback (most recent call last):\n  File \"<exec>\", line 1, in <module>\nTypeError: 'int' object is not iterable",
   "Цикл for и функции вроде sum и max ждут список, столбец или "],
  ["d = {}\nd['a'] += 1",
   "Traceback (most recent call last):\n  File \"<exec>\", line 2, in <module>\nKeyError: 'a'",
   "В словаре нет ключа a"],
  ["lst = [1, 2]\nprint(lst[5])",
   "Traceback (most recent call last):\n  File \"<exec>\", line 2, in <module>\nIndexError: list index out of range",
   "В списке нет элемента с таким номером"],
  ["print(orders.groupby('status')['revenue'].agg('avg'))",
   "Traceback (most recent call last):\n  File \"<exec>\", line 1, in <module>\nAttributeError: 'SeriesGroupBy' object has no attribute 'avg'. Did you mean: 'agg'?",
   "Среднее в pandas"],
  ["print(orders.loc[orders.revenue > 100, 'revenue', 'status'])",
   "Traceback (most recent call last):\n  File \"<exec>\", line 1, in <module>\npandas.errors.IndexingError: Too many indexers",
   "В"],
  ["print(orders.query(\"revenue > 100 and status = 'paid'\"))",
   "Traceback (most recent call last):\n  File \"<exec>\", line 1, in <module>\nSyntaxError: Python keyword not valid identifier in numexpr query",
   "Python не понял строку"],
  ["print(orders.apply(lambda r: r.revenue * 2))",
   "Traceback (most recent call last):\n  File \"<exec>\", line 1, in <module>\n  File \"<exec>\", line 1, in <lambda>\nAttributeError: 'Series' object has no attribute 'revenue'",
   "apply без axis=1 отдаёт функции столбцы, а не строки, поэтом"],
  ["df = pd.read_csv('orders.csv')",
   "Traceback (most recent call last):\n  File \"<exec>\", line 1, in <module>\nFileNotFoundError: [Errno 44] No such file or directory: 'orders.csv'",
   "Файлов с диска здесь нет"],
  ["top = orders.sort_values('revenue', inplace=True)\nprint(top['revenue'])",
   "Traceback (most recent call last):\n  File \"<exec>\", line 2, in <module>\nTypeError: 'NoneType' object is not subscriptable",
   "С inplace=True метод меняет таблицу на месте и возвращает No"],
  ["print(orders.groupby(['user_id']).agg({['revenue']: 'sum'}))",
   "Traceback (most recent call last):\n  File \"<exec>\", line 1, in <module>\nTypeError: unhashable type: 'list'",
   "Список стоит там, где нужно одно значение"],
  ["print(pd.to_datetime('2024-13-01'))",
   "Traceback (most recent call last):\n  File \"<exec>\", line 1, in <module>\npandas._libs.tslibs.parsing.DateParseError: month must be in 1..12: 2024-13-01, at position 0",
   "Текст не читается как дата"],
  ["print(orders.revenue.mean.round(2))",
   "Traceback (most recent call last):\n  File \"<exec>\", line 1, in <module>\nAttributeError: 'function' object has no attribute 'round'",
   "Метод взят без скобок"],
  ["if orders.revenue > 100:\n    print('много')",
   "Traceback (most recent call last):\n  File \"<exec>\", line 1, in <module>\nValueError: The truth value of a Series is ambiguous. Use a.empty, a.bool(), a.item(), a.any() or a.all().",
   "if ждёт одно значение True или False, а сравнение столбца да"],
  ["print(orders.revenu.sum())",
   "Traceback (most recent call last):\n  File \"<exec>\", line 1, in <module>\nAttributeError: 'DataFrame' object has no attribute 'revenu'. Did you mean: 'revenue'?",
   "Нет метода или столбца revenu"],
  ["print(orders['revenue'] + ' руб.')",
   "Traceback (most recent call last):\n  File \"<exec>\", line 1, in <module>\nnumpy.core._exceptions._UFuncNoLoopError: ufunc 'add' did not contain a loop with signature matching types (dtype('float64'), dtype('<U5')) -> None",
   "Текст и число смешаны в одном расчёте"],
  ["print(np.mean(orders['status']))",
   "Traceback (most recent call last):\n  File \"<exec>\", line 1, in <module>\nTypeError: Could not convert string 'paidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidrefundedpaidpaidpaidpaidpaidrefundedpendingpaidpaidpendingpaidpaidpaidpaidrefundedrefundedpaidpaidpaidpaidrefundedpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidrefundedpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpendingpaidpaidpaidpaidpendingpaidrefundedpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpendingpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpendingpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpendingpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpendingpaidrefundedpaidpendingpaidpaidpaidpaidpaidpaidpaidrefundedpendingrefundedpaidpaidpaidpaidpaidpaidpendingrefundedpaidpendingpaidrefundedpaidpaidpaidpaidrefundedpaidpaidpendingpaidpaidpaidpaidpaidpaidpaidpaidpaidpaidpaid' to numeric",
   "Среднее или сумма посчитаны по столбцу с текстом"],
  ["print(orders.merge(users, on='id'))",
   "Traceback (most recent call last):\n  File \"<exec>\", line 1, in <module>\nKeyError: 'id'",
   "Нет столбца id"],
  ["print(orders.resample('M').revenue.sum())",
   "Traceback (most recent call last):\n  File \"<exec>\", line 1, in <module>\nTypeError: Only valid with DatetimeIndex, TimedeltaIndex or PeriodIndex, but got an instance of 'RangeIndex'",
   "resample группирует по датам из индекса, а в индексе номера "],
  ["x = 5\nprint(f'x = {x')",
   "Traceback (most recent call last):\n  File \"<exec>\", line 2\n    print(f'x = {x')\n                  ^\nSyntaxError: f-string: expecting '}'",
   "Python не понял строку"],
  ["if True:\nprint(1)",
   "Traceback (most recent call last):\n  File \"<exec>\", line 2\n    print(1)\n    ^^^^^\nIndentationError: expected an indented block after 'if' statement on line 1",
   "После строки с двоеточием (def, for, if) следующая строка до"],
  ["print(round(orders.revenue.mean(), '2'))",
   "Traceback (most recent call last):\n  File \"<exec>\", line 1, in <module>\nTypeError: 'str' object cannot be interpreted as an integer",
   "Там, где нужно целое число, стоит текст"],
  ["print(orders.value_counts('nope'))",
   "Traceback (most recent call last):\n  File \"<exec>\", line 1, in <module>\nKeyError: 'nope'",
   "Нет столбца nope"],
  ["print(orders.rename(columns='revenue'))",
   "Traceback (most recent call last):\n  File \"<exec>\", line 1, in <module>\nTypeError: Index(...) must be called with a collection of some kind, 'revenue' was passed",
   "В rename(columns=…) передают словарь «старое имя"],
  ["print(orders.drop('nope', axis=1))",
   "Traceback (most recent call last):\n  File \"<exec>\", line 1, in <module>\nKeyError: \"['nope'] not found in axis\"",
   "Нет столбца nope"],
  ["print(orders['revenue'].quantile(95))",
   "Traceback (most recent call last):\n  File \"<exec>\", line 1, in <module>\nValueError: percentiles should all be in the interval [0, 1]",
   "Квантиль задают долей от 0 до 1"],
  ["print(orders[100 < orders.revenue < 500])",
   "Traceback (most recent call last):\n  File \"<exec>\", line 1, in <module>\nValueError: The truth value of a Series is ambiguous. Use a.empty, a.bool(), a.item(), a.any() or a.all().",
   "Двойное сравнение со столбцом, 100 < x < 500, Python делит н"],
  ["print(orders[orders.revenue > 100 & orders.revenue < 500])",
   "Traceback (most recent call last):\n  File \"<exec>\", line 1, in <module>\nTypeError: Cannot perform 'rand_' with a dtyped [float64] array and scalar of type [bool]",
   "Условия, соединённые & или |, берут в скобки"],
  ["i = 0\nwhile i < 3:\n    print(i)",
   "Traceback (most recent call last):\n  File \"<exec>\", line 2, in <module>\nTimeoutError: код считается дольше 3 секунд — похоже, цикл не заканчивается",
   "Похоже, цикл не заканчивается"],
  ["from scipy import stats",
   "Traceback (most recent call last):\n  File \"<exec>\", line 1, in <module>\nModuleNotFoundError: No module named 'scipy'\nThe module 'scipy' is included in the Pyodide distribution, but it is not installed.\nYou can install it by calling:\n  await micropip.install(\"scipy\") in Python, or\n  await pyodide.loadPackage(\"scipy\") in JavaScript\nSee https://pyodide.org/en/stable/usage/loading-packages.html for more details.",
   "scipy в браузер курса не загружается"],
  ["n = 0\nprint(10 / n)",
   "Traceback (most recent call last):\n  File \"<exec>\", line 2, in <module>\nZeroDivisionError: division by zero",
   "Деление на ноль"],
  ["def share(a, b):\n    return a / b\nprint(share(5))",
   "Traceback (most recent call last):\n  File \"<exec>\", line 3, in <module>\nTypeError: share() missing 1 required positional argument: 'b'",
   "Функции не хватает аргумента"],
  ["counts = {'paid': 1}\nprint(counts['refunded'])",
   "Traceback (most recent call last):\n  File \"<exec>\", line 2, in <module>\nKeyError: 'refunded'",
   "В словаре нет ключа refunded"],
  ["import matplotlib\nmatplotlib.use('Agg')\nimport matplotlib.pyplot as plt\nplt.plot([1, 2, 3], [1, 2])",
   "Traceback (most recent call last):\n  File \"<exec>\", line 4, in <module>\nValueError: x and y must have same first dimension, but have shapes (3,) and (2,)",
   "Для графика нужно поровну значений по оси x и по оси y"],
  ["del np\nprint(np.mean([1, 2]))",
   "Traceback (most recent call last):\n  File \"<exec>\", line 2, in <module>\nNameError: name 'np' is not defined",
   "np"],
  ["del pd\nprint(pd.DataFrame())",
   "Traceback (most recent call last):\n  File \"<exec>\", line 2, in <module>\nNameError: name 'pd' is not defined",
   "pd"],
  ["print(pd.to_datetime(pd.Series(['2024-01-01', '2024-13-45'])))",
   "Traceback (most recent call last):\n  File \"<exec>\", line 1, in <module>\nValueError: time data \"2024-13-45\" doesn't match format \"%Y-%m-%d\", at position 1. You might want to try:\n    - passing `format` if your strings have a consistent format;\n    - passing `format='ISO8601'` if your strings are all ISO8601 but not necessarily in exactly the same format;\n    - passing `format='mixed'`, and the format will be inferred for each element individually. You might want to use `dayfirst` alongside this.",
   "Текст не читается как дата"],
  ["print(orders.iloc[[100000]])",
   "Traceback (most recent call last):\n  File \"<exec>\", line 1, in <module>\nIndexError: positional indexers are out-of-bounds",
   "Строки с таким номером нет"],
  ["x = orders['revenue'].apply(lambda v: v * 2)\nprint(orders['status'].valuecounts())",
   "Traceback (most recent call last):\n  File \"<exec>\", line 2, in <module>\nAttributeError: 'Series' object has no attribute 'valuecounts'. Did you mean: 'value_counts'?",
   "Нет метода или столбца valuecounts"],
  ["counts = {}\nfor word in ['a', 'b']:\n    counts[word] += 1",
   "Traceback (most recent call last):\n  File \"<exec>\", line 3, in <module>\nKeyError: 'a'",
   "В словаре нет ключа a"],
  ["lst = [1, 2]\nlst = lst.append(3)\nprint(lst[0])",
   "Traceback (most recent call last):\n  File \"<exec>\", line 3, in <module>\nTypeError: 'NoneType' object is not subscriptable",
   "append, sort, extend и reverse меняют список на месте"],
  ["print(orders[['revenu', 'stat']])",
   "Traceback (most recent call last):\n  File \"<exec>\", line 1, in <module>\nKeyError: \"None of [Index(['revenu', 'stat'], dtype='object')] are in the [columns]\"",
   "Нет столбцов revenu, stat"],
  ["print(orders.loc[['x']])",
   "Traceback (most recent call last):\n  File \"<exec>\", line 1, in <module>\nKeyError: \"None of [Index(['x'], dtype='object')] are in the [index]\"",
   "Ни одного из значений x нет в индексе таблицы"],
  ["print(2 / orders.revenue.mean)",
   "Traceback (most recent call last):\n  File \"<exec>\", line 1, in <module>\nTypeError: unsupported operand type(s) for /: 'int' and 'method'",
   "Метод взят без скобок"],
  ["print(np.percentile(orders.revenue, 150))",
   "Traceback (most recent call last):\n  File \"<exec>\", line 1, in <module>\nValueError: Percentiles must be in the range [0, 100]",
   "np"],
  ["print(sum(5))",
   "Traceback (most recent call last):\n  File \"<exec>\", line 1, in <module>\nTypeError: 'int' object is not iterable",
   "Цикл for и функции вроде sum и max ждут список, столбец или "],
  ["print(orders[orders.revenue > 100 & orders.revenue < 500])",
   "Traceback (most recent call last):\n  File \"/lib/python3.12/site-packages/pandas/core/ops/array_ops.py\", line 362, in na_logical_op\n    result = op(x, y)\n             ^^^^^^^^\n  File \"/lib/python3.12/site-packages/pandas/core/roperator.py\", line 54, in rand_\n    return operator.and_(right, left)\n           ^^^^^^^^^^^^^^^^^^^^^^^^^^\nTypeError: ufunc 'bitwise_and' not supported for the input types, and the inputs could not be safely coerced to any supported types according to the casting rule ''safe''\n\nDuring handling of the above exception, another exception occurred:\n\nTraceback (most recent call last):\n  File \"/lib/python3.12/site-packages/pandas/core/ops/array_ops.py\", line 376, in na_logical_op\n    result = libops.scalar_binop(x, y, op)\n             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n  File \"ops.pyx\", line 180, in pandas._libs.ops.scalar_binop\nValueError: Buffer dtype mismatch, expected 'Python object' but got 'double'\n\nThe above exception was the direct cause of the following exception:\n\nTraceback (most recent call last):\n  File \"/lib/python312.zip/_pyodide/_base.py\", line 597, in eval_code_async\n    await CodeRunner(\n  File \"/lib/python312.zip/_pyodide/_base.py\", line 411, in run_async\n    coroutine = eval(self.code, globals, locals)\n                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n  File \"<exec>\", line 1, in <module>\n  File \"/lib/python3.12/site-packages/pandas/core/ops/common.py\", line 76, in new_method\n    return method(self, other)\n           ^^^^^^^^^^^^^^^^^^^\n  File \"/lib/python3.12/site-packages/pandas/core/arraylike.py\", line 74, in __rand__\n    return self._logical_method(other, roperator.rand_)\n           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n  File \"/lib/python3.12/site-packages/pandas/core/series.py\", line 6110, in _logical_method\n    res_values = ops.logical_op(lvalues, rvalues, op)\n                 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n  File \"/lib/python3.12/site-packages/pandas/core/ops/array_ops.py\", line 454, in logical_op\n    res_values = na_logical_op(lvalues, rvalues, op)\n                 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n  File \"/lib/python3.12/site-packages/pandas/core/ops/array_ops.py\", line 385, in na_logical_op\n    raise TypeError(\nTypeError: Cannot perform 'rand_' with a dtyped [float64] array and scalar of type [bool]\n",
   "Условия, соединённые & или |, берут в скобки: & считается ра"],
  ["print(orders[orders.user_id > 10 & orders.user_id < 50])",
   "Traceback (most recent call last):\n  File \"/lib/python312.zip/_pyodide/_base.py\", line 597, in eval_code_async\n    await CodeRunner(\n  File \"/lib/python312.zip/_pyodide/_base.py\", line 411, in run_async\n    coroutine = eval(self.code, globals, locals)\n                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n  File \"<exec>\", line 1, in <module>\n  File \"/lib/python3.12/site-packages/pandas/core/generic.py\", line 1576, in __nonzero__\n    raise ValueError(\nValueError: The truth value of a Series is ambiguous. Use a.empty, a.bool(), a.item(), a.any() or a.all().\n",
   "Условия, соединённые & или |, берут в скобки: & считается ра"],
  ["def top(t):\n    t.sort_values('revenue')\nprint(top(orders).head())",
   "Traceback (most recent call last):\n  File \"/lib/python312.zip/_pyodide/_base.py\", line 597, in eval_code_async\n    await CodeRunner(\n  File \"/lib/python312.zip/_pyodide/_base.py\", line 411, in run_async\n    coroutine = eval(self.code, globals, locals)\n                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n  File \"<exec>\", line 3, in <module>\nAttributeError: 'NoneType' object has no attribute 'head'\n",
   "В переменной None — пустое значение. Его возвращает функция "],
  ["for i in range('5'):\n    print(i)",
   "Traceback (most recent call last):\n  File \"/lib/python312.zip/_pyodide/_base.py\", line 597, in eval_code_async\n    await CodeRunner(\n  File \"/lib/python312.zip/_pyodide/_base.py\", line 411, in run_async\n    coroutine = eval(self.code, globals, locals)\n                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n  File \"<exec>\", line 1, in <module>\nTypeError: 'str' object cannot be interpreted as an integer\n",
   "Там, где нужно целое число, стоит текст в кавычках. Числа пи"],
  ["counts = {}\nprint(orders['revnue'].sum())",
   "Traceback (most recent call last):\n  File \"/lib/python3.12/site-packages/pandas/core/indexes/base.py\", line 3802, in get_loc\n    return self._engine.get_loc(casted_key)\n           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n  File \"index.pyx\", line 153, in pandas._libs.index.IndexEngine.get_loc\n  File \"index.pyx\", line 182, in pandas._libs.index.IndexEngine.get_loc\n  File \"pandas/_libs/hashtable_class_helper.pxi\", line 7081, in pandas._libs.hashtable.PyObjectHashTable.get_item\n  File \"pandas/_libs/hashtable_class_helper.pxi\", line 7089, in pandas._libs.hashtable.PyObjectHashTable.get_item\nKeyError: 'revnue'\n\nThe above exception was the direct cause of the following exception:\n\nTraceback (most recent call last):\n  File \"/lib/python312.zip/_pyodide/_base.py\", line 597, in eval_code_async\n    await CodeRunner(\n  File \"/lib/python312.zip/_pyodide/_base.py\", line 411, in run_async\n    coroutine = eval(self.code, globals, locals)\n                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n  File \"<exec>\", line 2, in <module>\n  File \"/lib/python3.12/site-packages/pandas/core/frame.py\", line 4090, in __getitem__\n    indexer = self.columns.get_loc(key)\n              ^^^^^^^^^^^^^^^^^^^^^^^^^\n  File \"/lib/python3.12/site-packages/pandas/core/indexes/base.py\", line 3809, in get_loc\n    raise KeyError(key) from err\nKeyError: 'revnue'\n",
   "Нет столбца revnue. Сверьте имя со схемой: буквы, регистр, к"],
  ["d = {1: 'a'}\nprint(d[5])",
   "Traceback (most recent call last):\n  File \"/lib/python312.zip/_pyodide/_base.py\", line 597, in eval_code_async\n    await CodeRunner(\n  File \"/lib/python312.zip/_pyodide/_base.py\", line 411, in run_async\n    coroutine = eval(self.code, globals, locals)\n                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n  File \"<exec>\", line 2, in <module>\nKeyError: 5\n",
   "В словаре нет ключа 5. Ключ сначала добавляют — d[5] = 0 — и"],
  ["counts = {}\nfor s in orders['status']:\n    counts[s] += 1",
   "Traceback (most recent call last):\n  File \"/lib/python312.zip/_pyodide/_base.py\", line 597, in eval_code_async\n    await CodeRunner(\n  File \"/lib/python312.zip/_pyodide/_base.py\", line 411, in run_async\n    coroutine = eval(self.code, globals, locals)\n                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n  File \"<exec>\", line 3, in <module>\nKeyError: 'paid'\n",
   "В словаре нет ключа paid. Ключ сначала добавляют — d[\"paid\"]"],
  ["t = orders.head(2)\nt = t.append(orders.tail(2))\nprint(t)",
   "Traceback (most recent call last):\n  File \"/lib/python312.zip/_pyodide/_base.py\", line 597, in eval_code_async\n    await CodeRunner(\n  File \"/lib/python312.zip/_pyodide/_base.py\", line 411, in run_async\n    coroutine = eval(self.code, globals, locals)\n                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n  File \"<exec>\", line 2, in <module>\n  File \"/lib/python3.12/site-packages/pandas/core/generic.py\", line 6293, in __getattr__\n    return object.__getattribute__(self, name)\n           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\nAttributeError: 'DataFrame' object has no attribute 'append'. Did you mean: '_append'?\n",
   "В pandas 2 у таблицы и столбца нет append: строки добавляют "],
  ["print(orders.ix[0])",
   "Traceback (most recent call last):\n  File \"/lib/python312.zip/_pyodide/_base.py\", line 597, in eval_code_async\n    await CodeRunner(\n  File \"/lib/python312.zip/_pyodide/_base.py\", line 411, in run_async\n    coroutine = eval(self.code, globals, locals)\n                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n  File \"<exec>\", line 1, in <module>\n  File \"/lib/python3.12/site-packages/pandas/core/generic.py\", line 6293, in __getattr__\n    return object.__getattribute__(self, name)\n           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\nAttributeError: 'DataFrame' object has no attribute 'ix'\n",
   "В pandas 2 нет .ix: по меткам строк берут .loc, по номерам —"],
  ["print(orders.loc[[0, 99999]])",
   "Traceback (most recent call last):\n  File \"/lib/python312.zip/_pyodide/_base.py\", line 597, in eval_code_async\n    await CodeRunner(\n  File \"/lib/python312.zip/_pyodide/_base.py\", line 411, in run_async\n    coroutine = eval(self.code, globals, locals)\n                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n  File \"<exec>\", line 1, in <module>\n  File \"/lib/python3.12/site-packages/pandas/core/indexing.py\", line 1192, in __getitem__\n    return self._getitem_axis(maybe_callable, axis=axis)\n           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n  File \"/lib/python3.12/site-packages/pandas/core/indexing.py\", line 1421, in _getitem_axis\n    return self._getitem_iterable(key, axis=axis)\n           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n  File \"/lib/python3.12/site-packages/pandas/core/indexing.py\", line 1361, in _getitem_iterable\n    keyarr, indexer = self._get_listlike_indexer(key, axis)\n                      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n  File \"/lib/python3.12/site-packages/pandas/core/indexing.py\", line 1559, in _get_listlike_indexer\n    keyarr, indexer = ax._get_indexer_strict(key, axis_name)\n                      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n  File \"/lib/python3.12/site-packages/pandas/core/indexes/base.py\", line 6199, in _get_indexer_strict\n    self._raise_if_missing(keyarr, indexer, axis_name)\n  File \"/lib/python3.12/site-packages/pandas/core/indexes/base.py\", line 6251, in _raise_if_missing\n    raise KeyError(f\"{not_found} not in index\")\nKeyError: '[99999] not in index'\n",
   "Нет строк с метками 99999 в индексе таблицы: .loc ищет по ме"],
  ["def share(a, b):\n    return a / b\nprint(share(5))",
   "Traceback (most recent call last):\n  File \"/lib/python312.zip/_pyodide/_base.py\", line 597, in eval_code_async\n    await CodeRunner(\n  File \"/lib/python312.zip/_pyodide/_base.py\", line 411, in run_async\n    coroutine = eval(self.code, globals, locals)\n                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n  File \"<exec>\", line 3, in <module>\nTypeError: share() missing 1 required positional argument: 'b'\n",
   "Функции не хватает аргумента b: в вызове меньше значений, че"],
  ["print(orders[['revenue', 'revnue']])",
   "Traceback (most recent call last):\n  File \"/lib/python312.zip/_pyodide/_base.py\", line 597, in eval_code_async\n    await CodeRunner(\n  File \"/lib/python312.zip/_pyodide/_base.py\", line 411, in run_async\n    coroutine = eval(self.code, globals, locals)\n                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n  File \"<exec>\", line 1, in <module>\n  File \"/lib/python3.12/site-packages/pandas/core/frame.py\", line 4096, in __getitem__\n    indexer = self.columns._get_indexer_strict(key, \"columns\")[1]\n              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n  File \"/lib/python3.12/site-packages/pandas/core/indexes/base.py\", line 6199, in _get_indexer_strict\n    self._raise_if_missing(keyarr, indexer, axis_name)\n  File \"/lib/python3.12/site-packages/pandas/core/indexes/base.py\", line 6251, in _raise_if_missing\n    raise KeyError(f\"{not_found} not in index\")\nKeyError: \"['revnue'] not in index\"\n",
   "Нет столбца revnue. Сверьте имя со схемой: буквы, регистр, к"],
  ["for name, col in orders.iteritems():\n    print(name)",
   "Traceback (most recent call last):\n  File \"/lib/python312.zip/_pyodide/_base.py\", line 597, in eval_code_async\n    await CodeRunner(\n  File \"/lib/python312.zip/_pyodide/_base.py\", line 411, in run_async\n    coroutine = eval(self.code, globals, locals)\n                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n  File \"<exec>\", line 1, in <module>\n  File \"/lib/python3.12/site-packages/pandas/core/generic.py\", line 6293, in __getattr__\n    return object.__getattribute__(self, name)\n           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\nAttributeError: 'DataFrame' object has no attribute 'iteritems'. Did you mean: 'isetitem'?\n",
   "В pandas 2 нет iteritems — он называется items: for имя, сто"]
];

/* [код, последняя строка pandas 3, слова подсказки]: сообщения, которые в
   pandas 3 другие, — подсказка должна остаться той же */
const PY3 = [
  ["print(orders[orders.revenue > 100 & orders.status == 'paid'])",
   "TypeError: operation 'rand_' not supported for dtype 'str' with object of type <class 'int'>",
   "Условия, соединённые & или |, берут в скобки"],
  ["print(orders.groupby('user_id').mean())",
   "TypeError: dtype 'str' does not support operation 'mean'", "Среднее или сумма посчитаны по столбцу с текстом"],
  ["print(np.mean(orders['status']))",
   "TypeError: Cannot perform reduction 'mean' with string dtype", "Среднее или сумма посчитаны по столбцу с текстом"]
];

/* [запрос, меняет ли он базу] */
const WRITES = [
  ["DELETE FROM users", true],
  ["update orders set revenue = 0 where order_id = 1", true],
  ["INSERT INTO users VALUES (1, '2024-01-01', 'organic', 'Москва', 'ios')", true],
  ["CREATE TABLE t AS SELECT * FROM users", true],
  ["DROP TABLE users", true],
  ["ALTER TABLE users ADD COLUMN x", true],
  ["REPLACE INTO users SELECT * FROM users", true],
  ["PRAGMA foreign_keys = ON", true],
  ["WITH t AS (SELECT 1) DELETE FROM users", true],
  ["SELECT * FROM users; DELETE FROM orders", true],
  ["SELECT * FROM users -- delete дубли потом", false],
  ["/* update */ SELECT * FROM users", false],
  ["SELECT * FROM users WHERE city = 'update'", false],
  ["SELECT * FROM events WHERE event = \"delete\"", false],
  ["SELECT replace(city, 'а', 'б') FROM users", false],
  ["SELECT created_at, updated FROM t", false],
  ["SELECT COUNT(*) AS deleted_cnt FROM orders", false]
];

const bad = [];
const hint = function (msg, q) { return Check.sqlErr("SQLite: " + msg, q); };
const show = function (q) { return JSON.stringify(q); };

const db = new DatabaseSync(path.join(__dirname, "shop.db"), { readOnly: true });
const ver = db.prepare("SELECT sqlite_version() AS v").get().v;
let ran = 0;
for (const [q, want, browser] of SQL) {
  let msg = null;
  try { db.exec(q); } catch (e) { msg = e.message; }
  if (msg !== null) {
    ran++;
    const h = hint(msg, q);
    if (h.indexOf(want) < 0)
      bad.push("SQL " + show(q) + "\n  SQLite " + ver + ": " + msg + "\n  подсказка: " + (h || "(нет)") + "\n  нужны слова: " + want);
  }
  const hb = hint(browser, q);
  if (hb.indexOf(want) < 0)
    bad.push("SQL " + show(q) + "\n  браузер (SQLite 3.45.2): " + browser + "\n  подсказка: " + (hb || "(нет)") + "\n  нужны слова: " + want);
}
for (const [msg, q, want] of MSG) {
  const h = hint(msg, q);
  if (h.indexOf(want) < 0) bad.push("SQL " + show(q) + "\n  сообщение: " + msg + "\n  подсказка: " + (h || "(нет)") + "\n  нужны слова: " + want);
}

for (const [q, want] of DATES) {
  const h = Check.bareDate(q);
  if (want ? h.indexOf(want) < 0 : h !== "")
    bad.push("Дата без кавычек " + show(q) + "\n  подсказка: " + (h || "(нет)") + "\n  нужно: " + (want || "без подсказки"));
}

for (const t of TRACES) {
  const got = pyTrace(t.trace.join("\n") + "\n");
  if (got !== t.want) bad.push("Трассировка " + show(t.code) + "\n  получилось:\n" + got + "\n  нужно:\n" + t.want);
  const h = Check.pyErr(got, t.code);
  if (h.indexOf(t.hint) < 0) bad.push("Check.pyErr на трассировке " + show(t.code) + ": " + (h || "(нет)") + "\n  нужны слова: " + t.hint);
}

const first = function (q) { return Object.values(db.prepare(q).get()); };
for (const [q, want] of LOOPS) {
  const err = Engine.loop(first, q), h = err ? hint(err, q) : "";
  if (want ? [].concat(want).some(function (w) { return h.indexOf(w) < 0; }) : err !== "")
    bad.push("Рекурсия " + show(q) + "\n  ошибка: " + (err || "(нет)") + "\n  подсказка: " + (h || "(нет)") +
      "\n  нужно: " + (want || "без ошибки"));
}

/* Запросы курса проходят пробу: решения, заготовки и проверки уроков,
   шагов, тренажёра и собеседования, а ещё код в <pre> теории. Вопросы
   квиза с нарочно сломанным CTE — не код, их не берём */
const course = { window: {} };
vm.createContext(course);
const top = path.resolve(__dirname, "..");
for (const f of fs.readdirSync(top).filter(function (f) { return /^content-.*\.js$/.test(f); }).sort().concat(["interview.js"]))
  vm.runInContext(fs.readFileSync(path.join(top, f), "utf8"), course);
const mine = [];
(function walk(v, key) {
  if (typeof v === "string") {
    const pre = v.match(/<pre><code>[\s\S]*?<\/code><\/pre>/g) || [];
    pre.map(function (b) { return b.slice(11, -13).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&"); })
      .concat(/^(solution|starter|check|reference)$/.test(key) ? [v] : [])
      .forEach(function (c) { if (/\bWITH\b/i.test(c) && /\bSELECT\b/i.test(c)) mine.push(c); });
  } else if (v && typeof v === "object") Object.keys(v).forEach(function (k) { walk(v[k], k); });
})([course.window.CONTENT, course.window.MOCK], "");
for (const q of mine) {
  const err = Engine.loop(first, q);
  if (err) bad.push("Запрос курса упёрся в пробу рекурсии " + show(q.slice(0, 160)) + "\n  " + err.replace(/\n/g, " "));
}
/* потолок пробы назван в теории урока 1.5: сменился Engine.LOOP — поправить и текст */
const capText = "больше " + Engine.cap().split(String.fromCharCode(160)).join(" ");
if (course.window.CONTENT.m1l4.theory.indexOf(capText) < 0)
  bad.push("Теория m1l4 не называет потолок пробы рекурсии «" + capText + "» (Engine.LOOP)");

for (const [code, trace, want] of PYERR) {
  const h = Check.pyErr(trace, code);
  if (h.indexOf(want) < 0) bad.push("Check.pyErr на " + show(code) + "\n  ошибка: " + trace.split("\n").pop() +
    "\n  подсказка: " + (h || "(нет)") + "\n  нужны слова: " + want);
}
for (const [code, last, want] of PY3) {
  const h = Check.pyErr(last, code);
  if (h.indexOf(want) < 0) bad.push("Check.pyErr (pandas 3) на " + show(code) + "\n  ошибка: " + last +
    "\n  подсказка: " + (h || "(нет)") + "\n  нужны слова: " + want);
}

for (const [q, want] of WRITES) {
  if (Engine.writes(q) !== want) bad.push("Engine.writes(" + show(q) + ") = " + Engine.writes(q) + ", нужно " + want);
}

if (bad.length) {
  console.log("Ошибки по-русски — не сошлось " + bad.length + ":\n\n" + bad.join("\n\n"));
  process.exit(1);
}
console.log("Ошибки по-русски: SQL — " + SQL.length + " запросов, из них на SQLite " + ver + " упали " + ran +
  ", сообщения браузера (SQLite 3.45.2) — " + SQL.length + ", других версий — " + MSG.length +
  "; даты без кавычек — " + DATES.length + "; рекурсия без остановки — " + LOOPS.length +
  " (запросов курса с WITH — " + mine.length + ")" +
  "; трассировки Python — " + TRACES.length + ", ошибки Python — " + PYERR.length + " (pandas 3 — " + PY3.length + ")" +
  "; запись в базу — " + WRITES.length + ".");
