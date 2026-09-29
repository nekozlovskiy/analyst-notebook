/* ============================================================
   Модуль 0. Старт — пошаговые уроки 0.1 (SQL) и 0.2–0.4 (Python).
   Вместо теории и одной задачи — шаги, у каждого свой редактор и
   своя проверка. Решения шагов проверены:
   node инструменты/checksteps.js m0l1, … m0l4
   ============================================================ */

window.CONTENT.m0l1 = {
  intro: "Первый запрос к базе за восемь шагов: от SELECT до группировки. Каждый шаг — одна новая мысль и маленькая задача, которую курс проверяет сам.",
  duration: "≈ 45 минут",
  plan: [
    { m: "35 мин", w: "Восемь шагов: от первого запроса до GROUP BY" },
    { m: "5 мин", w: "Карточки" },
    { m: "5 мин", w: "Как устроены следующие уроки" }
  ],
  finish: "Все шаги решены. Следующий урок — соединение таблиц, и его задача опирается ровно на то, что вы здесь написали.",
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
      d: "Продолжение того же учебника: COUNT, SUM, AVG, GROUP BY и чем WHERE отличается от HAVING — к этому вернётся урок 1.1." },
    { t: "SQLBolt", url: "https://sqlbolt.com/", src: "sqlbolt.com", lang: "EN",
      d: "Интерактивные упражнения по основам SQL прямо в браузере. Хорошо закрепляет шаги этого урока, если хочется ещё практики." }
  ]
};

/* ------------------------------------------------------------
   Уроки 0.2–0.4 «Python с нуля» — мост от SQL к pandas тремя
   короткими уроками: язык (0.2), таблица и столбцы (0.3), отбор,
   сортировка и группировка (0.4). В карте стоят в модуле 0,
   проходят их перед модулем 2 (поле before в lessons.js).
   Шаги проверяются по напечатанному: expected.stdout.
   В каждом шаге одна новая мысль; где действий больше одного —
   список «Порядок действий» (ol.order).
   ------------------------------------------------------------ */

window.CONTENT.m0l2 = {
  intro: "Первые строки на Python — пока без таблиц: печать, текст, переменные, функции и списки. Два правила держат весь урок: код выполняется сверху вниз, а вложенные скобки — изнутри наружу.",
  duration: "≈ 30 минут",
  plan: [
    { m: "10 мин", w: "print, текст и порядок строк" },
    { m: "20 мин", w: "Переменные, функции, списки — и сами" }
  ],
  finish: "Все шаги решены. Следующий урок — 0.3: таблица pandas на тех же заказах, что в SQL.",
  packages: [],

  steps: [
    {
      title: "Python как калькулятор: print",
      body: `
<p>В SQL результат показывала база. В Python на экран попадает только то, что вы попросили напечатать. Для этого есть <code>print(…)</code>: что стоит в скобках, то и появится под редактором.</p>
<p>Считать можно прямо в скобках: <code>+</code> — сложить, <code>-</code> — вычесть, <code>*</code> — умножить, <code>/</code> — разделить. <code>print(2 * 3)</code> напечатает <code>6</code>.</p>
<p><strong>Задание.</strong> Оплаченных заказов в магазине 189, возвратов 13 и ещё 13 в обработке. Напечатайте, сколько заказов всего: сумму этих трёх чисел.</p>`,
      starter: "print(1 + 1)",
      expected: { stdout: "215" },
      hint: "Замените <code>1 + 1</code> в скобках на <code>189 + 13 + 13</code> и нажмите «Запустить».",
      solution: "print(189 + 13 + 13)"
    },
    {
      title: "Текст в кавычках",
      body: `
<p>Текст пишут в кавычках: <code>print("Всего заказов:")</code>. Без кавычек Python решит, что это имя, не найдёт его и остановится с ошибкой.</p>
<p>В <code>print</code> можно перечислить несколько вещей через запятую — он напечатает их в одну строку через пробел. <code>print("Возвратов:", 13)</code> даст <code>Возвратов: 13</code>. Числа пишут без кавычек, и тогда с ними можно считать.</p>
<p><strong>Задание.</strong> Напечатайте <code>Всего заказов: 215</code>. Текст — в кавычках, а число пусть Python посчитает сам: <code>189 + 13 + 13</code>.</p>`,
      starter: "print(\"Всего заказов:\")",
      expected: { stdout: "Всего заказов: 215" },
      hint: "После текста в скобках поставьте запятую и сумму: <code>print(\"Всего заказов:\", 189 + 13 + 13)</code>. Запятая стоит снаружи кавычек.",
      solution: "print(\"Всего заказов:\", 189 + 13 + 13)"
    },
    {
      title: "Сверху вниз: порядок строк",
      body: `
<p>Python читает код как книгу: сначала первую строку, потом вторую, потом третью. Каждый <code>print</code> печатает с новой строки. Поэтому порядок строк в выводе тот же, что в коде: что написано выше, то и напечатается раньше.</p>
<p>Отсюда правило на весь курс: <strong>хотите, чтобы действие случилось раньше, — ставьте его строку выше</strong>.</p>
<p><strong>Задание.</strong> Заготовка печатает отчёт вразнобой. Нажмите «Запустить» и посмотрите. Потом переставьте строки: сначала заголовок, потом «Всего», в конце «Оплачено».</p>`,
      starter: "print(\"Оплачено:\", 189)\nprint(\"Отчёт по заказам\")\nprint(\"Всего:\", 215)",
      expected: { stdout: "Отчёт по заказам\nВсего: 215\nОплачено: 189" },
      hint: "Строку <code>print(\"Отчёт по заказам\")</code> вырежьте и вставьте первой, строку с «Оплачено» — последней. Сами строки менять не нужно, только их порядок.",
      solution: "print(\"Отчёт по заказам\")\nprint(\"Всего:\", 215)\nprint(\"Оплачено:\", 189)"
    },
    {
      title: "Переменная: сначала положить, потом взять",
      body: `
<p>Числу можно дать имя и дальше писать имя вместо числа. <code>paid = 189</code> значит «положи 189 под именем paid». Такое имя называют переменной. Знак <code>=</code> здесь не сравнивает, а кладёт значение в переменную. Имя пишут без кавычек — кавычки только у текста.</p>
<p>Код выполняется сверху вниз, поэтому переменную нужно создать выше той строки, где её берут. Если <code>print(paid)</code> стоит раньше <code>paid = 189</code>, Python дойдёт до неё, ещё не зная этого имени, и остановится: <code>NameError: name 'paid' is not defined</code> — «имя paid не задано».</p>
<p><strong>Порядок действий.</strong></p>
<ol class="order">
<li>Положить числа в переменные: <code>paid = 189</code>, <code>total = 215</code>.</li>
<li>Ниже — напечатать, используя имена.</li>
</ol>
<p><strong>Задание.</strong> Запустите заготовку и прочитайте ошибку. Потом перенесите <code>print</code> в самый низ и допишите его, чтобы получилось <code>Оплачено: 189 из 215</code>. Числа берите из переменных, а не пишите цифрами.</p>`,
      starter: "print(\"Оплачено:\", paid)\npaid = 189\ntotal = 215",
      expected: { stdout: "Оплачено: 189 из 215" },
      hint: "Сначала две строки с переменными, последней — <code>print(\"Оплачено:\", paid, \"из\", total)</code>. Четыре значения через запятую: текст, переменная, текст, переменная.",
      solution: "paid = 189\ntotal = 215\nprint(\"Оплачено:\", paid, \"из\", total)"
    },
    {
      title: "Посчитать и сохранить в переменную",
      body: `
<p>Справа от <code>=</code> может стоять не число, а расчёт: <code>share = paid / total * 100</code>. Python сначала считает правую часть, а потом кладёт результат в имя слева. После этой строки <code>share</code> — готовое число, его можно печатать и считать с ним дальше.</p>
<p><strong>Порядок действий.</strong></p>
<ol class="order">
<li>Задать <code>paid</code> и <code>total</code>.</li>
<li>Ниже — посчитать долю и положить её в <code>share</code>.</li>
<li>Ещё ниже — напечатать <code>share</code>.</li>
</ol>
<p><strong>Задание.</strong> Посчитайте долю оплаченных заказов в процентах, положите её в переменную <code>share</code> и напечатайте. Хвост из цифр после точки — это нормально, его уберём в следующем шаге.</p>`,
      starter: "paid = 189\ntotal = 215\n",
      expected: { stdout: "87.90697674418605" },
      hint: "Допишите две строки: <code>share = paid / total * 100</code> и под ней <code>print(share)</code>.",
      solution: "paid = 189\ntotal = 215\nshare = paid / total * 100\nprint(share)"
    },
    {
      title: "Функция round",
      body: `
<p>Функция — готовое действие с именем. После имени в скобках пишут, с чем работать; это называют аргументами. Одну функцию вы уже знаете — <code>print</code>.</p>
<p>Ещё одна — <code>round</code>, округление. <code>round(87.906, 1)</code> даёт <code>87.9</code>: два аргумента через запятую — какое число и сколько знаков после точки оставить. <code>round</code> сама ничего не печатает, она только возвращает новое число. Его кладут в переменную или сразу отдают <code>print</code>.</p>
<p><strong>Задание.</strong> Напечатайте долю оплаченных заказов, округлённую до одного знака.</p>`,
      starter: "paid = 189\ntotal = 215\nshare = paid / total * 100\nprint(share)",
      expected: { stdout: "87.9" },
      hint: "Добавьте строку <code>share = round(share, 1)</code> перед <code>print(share)</code> — или напишите сразу <code>print(round(share, 1))</code>.",
      solution: "paid = 189\ntotal = 215\nshare = paid / total * 100\nprint(round(share, 1))"
    },
    {
      title: "Списки",
      body: `
<p>Список — несколько значений в квадратных скобках через запятую: <code>[2997.2, 4968.24, 1994.76]</code> — суммы трёх заказов одного клиента. Список кладут в переменную, как число.</p>
<p>Для списков есть функции: <code>len(r)</code> — сколько в нём элементов, <code>sum(r)</code> — сумма, <code>max(r)</code> — самый большой, <code>min(r)</code> — самый маленький.</p>
<p><strong>Задание.</strong> Напечатайте одной строкой: сколько заказов в списке, их сумму и самый дорогой заказ. Сумма выйдет с длинным хвостом — о нём следующий шаг.</p>`,
      starter: "r = [2997.2, 4968.24, 1994.76]\nprint(r)",
      expected: { stdout: "3 9960.199999999999 4968.24" },
      hint: "Три значения через запятую в одном <code>print</code>: <code>print(len(r), sum(r), max(r))</code>.",
      solution: "r = [2997.2, 4968.24, 1994.76]\nprint(len(r), sum(r), max(r))"
    },
    {
      title: "Функция в функции: изнутри наружу",
      body: `
<p>Компьютер хранит дробные числа с крошечной погрешностью, поэтому <code>sum(r)</code> дала <code>9960.199999999999</code>, а не <code>9960.2</code>. Деньги почти всегда округляют.</p>
<p>Функцию можно поставить внутрь другой: <code>print(round(sum(r), 2))</code>. Читать такую строку надо не слева направо, а <strong>от самых внутренних скобок к внешним</strong>: внутреннее действие выполняется первым и отдаёт результат наружу.</p>
<p><strong>Порядок действий</strong> в <code>print(round(sum(r) / len(r), 2))</code> — средний заказ:</p>
<ol class="order">
<li><code>sum(r)</code> — сложить заказы: <code>9960.199999999999</code>.</li>
<li><code>len(r)</code> — сколько их: <code>3</code>.</li>
<li><code>/</code> — разделить сумму на количество: <code>3320.066666666666</code>.</li>
<li><code>round(…, 2)</code> — округлить до двух знаков: <code>3320.07</code>.</li>
<li><code>print(…)</code> — напечатать.</li>
</ol>
<p>Каждая открытая скобка должна закрыться. Если запутались — разложите на строки: <code>avg = sum(r) / len(r)</code>, ниже <code>print(round(avg, 2))</code>. Результат тот же.</p>
<p><strong>Задание.</strong> Напечатайте средний заказ клиента с двумя знаками.</p>`,
      starter: "r = [2997.2, 4968.24, 1994.76]\nprint(sum(r))",
      expected: { stdout: "3320.07" },
      hint: "<code>print(round(sum(r) / len(r), 2))</code>. Посчитайте скобки: после <code>len(r)</code> идёт <code>, 2</code>, потом закрываются <code>round</code> и <code>print</code> — <code>))</code>.",
      solution: "r = [2997.2, 4968.24, 1994.76]\nprint(round(sum(r) / len(r), 2))"
    },
    {
      title: "Сами: карточка клиента",
      body: `
<p>Новых слов здесь нет. Клиент 3 сделал четыре заказа, их суммы уже в списке <code>q</code>. Соберите о нём короткую карточку.</p>
<p><strong>Порядок действий.</strong></p>
<ol class="order">
<li>Список уже задан.</li>
<li>Посчитать средний заказ и положить в переменную <code>avg</code> — округлить до двух знаков.</li>
<li>Напечатать первую строку: число заказов и средний.</li>
<li>Напечатать вторую строку: самый дорогой заказ.</li>
</ol>`,
      task: "<p><strong>Задание.</strong> Напечатайте двумя строками: <code>Заказов: 4 Средний: 3825.25</code> и <code>Самый дорогой: 9071.54</code>. Числа должен посчитать Python.</p>",
      starter: "q = [1361.84, 9071.54, 3071.02, 1796.6]\n# 2. avg = …\n# 3. первая строка\n# 4. вторая строка\n",
      expected: { stdout: "Заказов: 4 Средний: 3825.25\nСамый дорогой: 9071.54" },
      hint: "<code>avg = round(sum(q) / len(q), 2)</code>, потом <code>print(\"Заказов:\", len(q), \"Средний:\", avg)</code> и <code>print(\"Самый дорогой:\", max(q))</code>.",
      solution: "q = [1361.84, 9071.54, 3071.02, 1796.6]\navg = round(sum(q) / len(q), 2)\nprint(\"Заказов:\", len(q), \"Средний:\", avg)\nprint(\"Самый дорогой:\", max(q))"
    }
  ],

  cards: [
    { q: "В каком порядке Python выполняет строки кода?",
      a: "Сверху вниз, по одной. Что написано выше, выполнится и напечатается раньше. Поэтому переменную создают выше строки, где её используют." },
    { q: "Что значит <code>paid = 189</code>?",
      a: "Положить 189 под именем <code>paid</code>. Один знак <code>=</code> не сравнивает, а кладёт значение в переменную: сначала считается правая часть, потом результат получает имя слева." },
    { q: "Что значит ошибка <code>NameError: name 'paid' is not defined</code>?",
      a: "Python дошёл до строки с <code>paid</code>, а переменной с таким именем ещё нет: её создают ниже, забыли создать или написали имя иначе. Текст без кавычек даёт ту же ошибку." },
    { q: "Как читать <code>print(round(sum(r), 2))</code>?",
      a: "Изнутри наружу: сначала <code>sum(r)</code> складывает список, потом <code>round(…, 2)</code> округляет результат, в конце <code>print</code> печатает." },
    { q: "Что делают <code>len</code>, <code>sum</code>, <code>max</code> и <code>min</code> со списком?",
      a: "Считают количество элементов, их сумму, самый большой и самый маленький элемент." }
  ]
};

window.CONTENT.m0l3 = {
  intro: "Таблица pandas на тех же заказах, что в SQL: как её посмотреть, как взять один или несколько столбцов и как посчитать по столбцу сумму или среднее. Отбор строк и сортировка — в следующем уроке.",
  duration: "≈ 25 минут",
  plan: [
    { m: "10 мин", w: "Таблица: head и len" },
    { m: "15 мин", w: "Столбцы: один, расчёт по нему, несколько — и сами" }
  ],
  finish: "Все шаги решены. Следующий урок — 0.4: отбор, сортировка и группировка, то есть WHERE, ORDER BY и GROUP BY на pandas.",
  schema: window.SH.pySchema,
  data: window.SH.pyData,
  packages: ["pandas"],
  prelude: window.SH.pyPrelude,

  steps: [
    {
      title: "Таблица pandas: head",
      body: `
<p>pandas — библиотека для работы с таблицами. Таблица в ней называется DataFrame. Три таблицы учебной базы уже загружены под теми же именами, что в SQL: <code>users</code>, <code>orders</code>, <code>events</code>.</p>
<p>Посмотреть начало таблицы — <code>orders.head()</code>: первые пять строк, как <code>SELECT * FROM orders LIMIT 5</code>. В скобках можно сказать, сколько строк нужно: <code>orders.head(3)</code>. Точка значит «у этой таблицы сделай head». Действие, которое пишут через точку, называют методом.</p>
<p>Как читать напечатанную таблицу: верхняя строка — имена столбцов, каждая следующая — одна строка данных. Числа слева без заголовка — индекс, номера строк. Счёт идёт с нуля.</p>
<p><strong>Порядок действий.</strong></p>
<ol class="order">
<li><code>users.head(3)</code> — взять первые три строки.</li>
<li><code>print(…)</code> — напечатать их. Без <code>print</code> в шаге ничего не появится.</li>
</ol>
<p><strong>Задание.</strong> Заготовка печатает пять первых заказов. Напечатайте первые три строки таблицы пользователей <code>users</code>.</p>`,
      starter: "print(orders.head())",
      expected: { stdout: `   user_id signup_date  channel         city platform
0        1  2024-06-12  organic  Новосибирск      ios
1        2  2024-02-05   social       Казань      ios
2        3  2024-04-18  organic       Москва      ios` },
      hint: "Поменяйте таблицу и число строк: <code>print(users.head(3))</code>.",
      solution: "print(users.head(3))"
    },
    {
      title: "Сколько строк: len",
      body: `
<p><code>len</code> вы знаете по спискам. С таблицей она работает так же: <code>len(orders)</code> — сколько в таблице строк, как <code>SELECT COUNT(*) FROM orders</code>.</p>
<p><strong>Задание.</strong> Напечатайте тремя строками, сколько строк в каждой таблице: <code>Заказов: 215</code>, <code>Пользователей: 220</code>, <code>Событий: 1488</code>. Числа должен посчитать Python.</p>`,
      starter: "print(\"Заказов:\", len(orders))",
      expected: { stdout: "Заказов: 215\nПользователей: 220\nСобытий: 1488" },
      hint: "Три <code>print</code> друг под другом, в каждом текст и <code>len</code> своей таблицы: <code>len(users)</code>, <code>len(events)</code>.",
      solution: "print(\"Заказов:\", len(orders))\nprint(\"Пользователей:\", len(users))\nprint(\"Событий:\", len(events))"
    },
    {
      title: "Один столбец",
      body: `
<p>Один столбец берут квадратными скобками с именем в кавычках: <code>orders["revenue"]</code> — как <code>SELECT revenue FROM orders</code>. Получается уже не таблица, а один столбец. В pandas его называют Series.</p>
<p>Под напечатанным столбцом pandas пишет справку. <code>Name: revenue</code> — имя столбца. <code>dtype: float64</code> — тип значений: <code>float64</code> — дробные числа, <code>int64</code> — целые, <code>object</code> — текст. Если строк много, pandas показывает начало и конец, в середине ставит <code>...</code>, а <code>Length</code> говорит, сколько строк всего.</p>`,
      ba: {
        before: { columns: ["order_id", "user_id", "revenue", "status"],
          rows: [[1, 1, 2997.2, "paid"], [2, 1, 4968.24, "paid"], [3, 1, 1994.76, "paid"]] },
        after: { columns: ["revenue"], rows: [[2997.2], [4968.24], [1994.76]] },
        hl: ["revenue"],
        note: "«Было» — начало <code>orders</code>. «Стало» — <code>orders[\"revenue\"]</code>: от таблицы остался один столбец, строки те же."
      },
      task: `<p><strong>Порядок действий.</strong></p>
<ol class="order">
<li><code>orders["revenue"]</code> — взять столбец.</li>
<li><code>.head(3)</code> — оставить первые три значения. У столбца тоже есть <code>head</code>.</li>
<li><code>print(…)</code> — напечатать.</li>
</ol>
<p><strong>Задание.</strong> Заготовка печатает весь столбец. Напечатайте только первые три значения <code>revenue</code>.</p>`,
      starter: "print(orders[\"revenue\"])",
      expected: { stdout: `0    2997.20
1    4968.24
2    1994.76
Name: revenue, dtype: float64` },
      hint: "Допишите <code>.head(3)</code> сразу после столбца, внутри <code>print</code>: <code>print(orders[\"revenue\"].head(3))</code>.",
      solution: "print(orders[\"revenue\"].head(3))"
    },
    {
      title: "Посчитать по столбцу: sum, mean, max",
      body: `
<p>У столбца есть методы-расчёты: <code>.sum()</code> — сумма, <code>.mean()</code> — среднее, <code>.max()</code> и <code>.min()</code> — самое большое и самое маленькое. Это <code>SUM</code>, <code>AVG</code>, <code>MAX</code> и <code>MIN</code> из SQL.</p>
<p>Цепочку через точку читают <strong>слева направо</strong>: каждое звено работает с тем, что вернуло предыдущее. <code>orders["revenue"].mean()</code> — это таблица → столбец → одно число. Поэтому сначала выбирают столбец и только потом считают.</p>
<p>А вложенные скобки, как вы помните по уроку 0.2, читают <strong>изнутри наружу</strong>. В <code>round(orders["revenue"].mean(), 2)</code> встречаются оба правила.</p>
<p><strong>Порядок действий</strong> в <code>print(round(orders["revenue"].mean(), 2))</code>:</p>
<ol class="order">
<li><code>orders["revenue"]</code> — взять столбец выручки.</li>
<li><code>.mean()</code> — посчитать среднее: <code>3560.3546…</code></li>
<li><code>round(…, 2)</code> — округлить: <code>3560.35</code>.</li>
<li><code>print(…)</code> — напечатать.</li>
</ol>
<p><strong>Задание.</strong> Напечатайте одной строкой средний заказ с двумя знаками и самый дорогой заказ: <code>3560.35 14473.88</code>.</p>`,
      starter: "print(orders[\"revenue\"].sum())",
      expected: { stdout: "3560.35 14473.88" },
      hint: "Два значения через запятую в одном <code>print</code>: <code>round(orders[\"revenue\"].mean(), 2)</code> и <code>orders[\"revenue\"].max()</code>.",
      solution: "print(round(orders[\"revenue\"].mean(), 2), orders[\"revenue\"].max())"
    },
    {
      title: "Несколько столбцов: двойные скобки",
      body: `
<p><code>SELECT order_id, revenue</code> в pandas — <code>orders[["order_id", "revenue"]]</code>. Скобки двойные: внешние значат «возьми из таблицы», внутренние — это список имён, как списки из урока 0.2. Столбцы встанут в том порядке, в каком перечислены.</p>
<p>Результат — снова таблица, только уже. У неё тоже есть <code>head</code>.</p>`,
      ba: {
        before: { columns: ["user_id", "signup_date", "channel", "city", "platform"],
          rows: [[1, "2024-06-12", "organic", "Новосибирск", "ios"], [2, "2024-02-05", "social", "Казань", "ios"]] },
        after: { columns: ["user_id", "city", "channel"],
          rows: [[1, "Новосибирск", "organic"], [2, "Казань", "social"]] },
        hl: ["city", "channel"],
        note: "<code>users[[\"user_id\", \"city\", \"channel\"]]</code>: три столбца в порядке списка, <code>city</code> встал раньше <code>channel</code>."
      },
      task: `<p><strong>Порядок действий.</strong></p>
<ol class="order">
<li><code>users[[…]]</code> — выбрать столбцы.</li>
<li><code>.head(4)</code> — оставить первые четыре строки.</li>
<li><code>print(…)</code> — напечатать.</li>
</ol>
<p><strong>Задание.</strong> Напечатайте первые четыре строки <code>users</code> — только столбцы <code>user_id</code>, <code>city</code> и <code>channel</code>, в этом порядке.</p>`,
      starter: "print(users.head(4))",
      expected: { stdout: `   user_id         city  channel
0        1  Новосибирск  organic
1        2       Казань   social
2        3       Москва  organic
3        4       Казань   social` },
      hint: "<code>print(users[[\"user_id\", \"city\", \"channel\"]].head(4))</code>. Две квадратные скобки открываются перед первым именем и две закрываются после последнего.",
      solution: "print(users[[\"user_id\", \"city\", \"channel\"]].head(4))"
    },
    {
      title: "Сами: сводка по заказам",
      body: `
<p>Новых слов здесь нет — всё из шагов 2–5. Соберите короткую сводку по таблице <code>orders</code>.</p>
<p><strong>Порядок действий.</strong></p>
<ol class="order">
<li>Напечатать, сколько всего заказов.</li>
<li>Напечатать общую выручку — сумму <code>revenue</code>, два знака.</li>
<li>Напечатать средний заказ, два знака.</li>
<li>Напечатать первые три заказа — только <code>order_id</code>, <code>status</code> и <code>revenue</code>.</li>
</ol>`,
      task: "<p><strong>Задание.</strong> Напечатайте сводку: строки <code>Заказов: 215</code>, <code>Выручка: 765476.25</code>, <code>Средний: 3560.35</code>, а под ними — три первых заказа с тремя столбцами.</p>",
      starter: "# 1. Заказов\n# 2. Выручка\n# 3. Средний\n# 4. Три первых заказа, три столбца\n",
      expected: { stdout: `Заказов: 215
Выручка: 765476.25
Средний: 3560.35
   order_id status  revenue
0         1   paid  2997.20
1         2   paid  4968.24
2         3   paid  1994.76` },
      hint: "<code>print(\"Заказов:\", len(orders))</code>, <code>print(\"Выручка:\", round(orders[\"revenue\"].sum(), 2))</code>, так же со <code>.mean()</code>, и последней строкой <code>print(orders[[\"order_id\", \"status\", \"revenue\"]].head(3))</code>.",
      solution: "print(\"Заказов:\", len(orders))\nprint(\"Выручка:\", round(orders[\"revenue\"].sum(), 2))\nprint(\"Средний:\", round(orders[\"revenue\"].mean(), 2))\nprint(orders[[\"order_id\", \"status\", \"revenue\"]].head(3))"
    }
  ],

  cards: [
    { q: "Что делает <code>orders.head(3)</code> и что за числа слева в выводе?",
      a: "Берёт первые три строки таблицы, как <code>LIMIT 3</code>. Числа слева — индекс, номера строк; счёт с нуля. Чтобы увидеть результат, его печатают: <code>print(orders.head(3))</code>." },
    { q: "Чем <code>orders[\"revenue\"]</code> отличается от <code>orders[[\"order_id\", \"revenue\"]]</code>?",
      a: "Одинарные скобки дают один столбец (Series). Двойные — таблицу из перечисленных столбцов: внутренние скобки — это список имён." },
    { q: "Как читать <code>round(orders[\"revenue\"].mean(), 2)</code>?",
      a: "Цепочку через точку — слева направо: таблица → столбец → среднее. Вложенные скобки — изнутри наружу: сначала посчитать среднее, потом округлить." },
    { q: "Что значат <code>Name</code> и <code>dtype</code> под напечатанным столбцом?",
      a: "<code>Name</code> — имя столбца, <code>dtype</code> — тип значений: <code>float64</code> — дробные, <code>int64</code> — целые, <code>object</code> — текст." }
  ]
};

window.CONTENT.m0l4 = {
  intro: "WHERE, ORDER BY, LIMIT и GROUP BY на pandas — по одному звену за шаг. Главное здесь — очерёдность: что сделать сначала, что потом, и почему от порядка меняется ответ.",
  duration: "≈ 35 минут",
  plan: [
    { m: "10 мин", w: "Отбор строк: сравнение и квадратные скобки" },
    { m: "15 мин", w: "Сортировка, первые строки, столбцы — по звену" },
    { m: "10 мин", w: "Группировка — и сами" }
  ],
  finish: "Все шаги решены. Следующий урок — 2.1: pandas всерьёз, тот же отчёт по каналам, что в SQL, и первый merge.",
  schema: window.SH.pySchema,
  data: window.SH.pyData,
  packages: ["pandas"],
  prelude: window.SH.pyPrelude,

  steps: [
    {
      title: "Сравнение: == даёт True и False",
      body: `
<p>В SQL строки отбирали так: <code>WHERE status = 'paid'</code>. В pandas это делают в два приёма, и первый из них — сравнение.</p>
<p><code>orders["status"] == "paid"</code> проверяет каждую строку столбца и даёт столбец ответов: <code>True</code> — «да» или <code>False</code> — «нет». Сравнивают двумя знаками <code>==</code>: один <code>=</code> в Python кладёт значение в переменную.</p>
<p>Столбец ответов можно положить в переменную и посчитать: <code>True</code> считается за 1, <code>False</code> — за 0. Поэтому <code>.sum()</code> у такого столбца — сколько строк подошло.</p>`,
      ba: {
        before: { columns: ["order_id", "status"],
          rows: [[190, "paid"], [191, "pending"], [192, "refunded"], [193, "paid"], [194, "pending"]] },
        after: { columns: ["order_id", "status", "== \"paid\""],
          rows: [[190, "paid", "True"], [191, "pending", "False"], [192, "refunded", "False"], [193, "paid", "True"], [194, "pending", "False"]] },
        hl: ["== \"paid\""],
        note: "Заказы пользователя 196: у каждой строки свой ответ — подходит она или нет."
      },
      task: `<p><strong>Порядок действий.</strong></p>
<ol class="order">
<li>Сравнить столбец <code>status</code> с <code>"refunded"</code> и положить ответы в переменную <code>mask</code>.</li>
<li><code>mask.sum()</code> — сосчитать ответы <code>True</code>.</li>
<li>Напечатать.</li>
</ol>
<p><strong>Задание.</strong> Заготовка печатает первые ответы для оплаченных. Узнайте, сколько в магазине возвратов — заказов со статусом <code>refunded</code>.</p>`,
      starter: "mask = orders[\"status\"] == \"paid\"\nprint(mask.head())",
      expected: { stdout: "13" },
      hint: "Поменяйте <code>\"paid\"</code> на <code>\"refunded\"</code>, а вместо <code>mask.head()</code> напечатайте <code>mask.sum()</code>.",
      solution: "mask = orders[\"status\"] == \"refunded\"\nprint(mask.sum())"
    },
    {
      title: "Отбор строк — это WHERE",
      body: `
<p>Второй приём: столбец ответов ставят в квадратные скобки таблицы — <code>orders[mask]</code>. Останутся только строки с <code>True</code>. Получится снова таблица, её кладут в переменную и работают с ней, как с <code>orders</code>.</p>
<p>Часто пишут в одну строку: <code>orders[orders["status"] == "paid"]</code>. Внутренние скобки — сравнение, внешние — «оставь такие строки».</p>`,
      ba: {
        before: { columns: ["order_id", "status", "revenue"],
          rows: [[190, "paid", 6310.9], [191, "pending", 7524.11], [192, "refunded", 5494.59], [193, "paid", 2290.61], [194, "pending", 2820.17]] },
        after: { columns: ["order_id", "status", "revenue"],
          rows: [[190, "paid", 6310.9], [193, "paid", 2290.61]] },
        hl: [], keep: [0, 3],
        note: "<code>orders[orders[\"status\"] == \"paid\"]</code> на заказах пользователя 196: остались строки с <code>True</code>, они выделены в «было»."
      },
      task: `<p><strong>Порядок действий.</strong></p>
<ol class="order">
<li>Сравнение: <code>orders["status"] == "refunded"</code>.</li>
<li>Поставить его в квадратные скобки <code>orders[…]</code> и положить результат в переменную <code>refunds</code>.</li>
<li>Ниже — напечатать, сколько строк в <code>refunds</code>.</li>
<li>Ещё ниже — напечатать сумму их <code>revenue</code>, два знака.</li>
</ol>
<p><strong>Задание.</strong> Положите возвраты в переменную <code>refunds</code> и напечатайте двумя строками: сколько их и на какую сумму.</p>`,
      starter: "paid = orders[orders[\"status\"] == \"paid\"]\nprint(len(paid))",
      expected: { stdout: "13\n56018.96" },
      hint: "<code>refunds = orders[orders[\"status\"] == \"refunded\"]</code>, потом <code>print(len(refunds))</code> и <code>print(round(refunds[\"revenue\"].sum(), 2))</code>.",
      solution: "refunds = orders[orders[\"status\"] == \"refunded\"]\nprint(len(refunds))\nprint(round(refunds[\"revenue\"].sum(), 2))"
    },
    {
      title: "Сортировка: sort_values",
      body: `
<p><code>ORDER BY revenue</code> в pandas — <code>sort_values("revenue")</code>: в скобках имя столбца, по которому сортировать. По умолчанию от меньшего к большему. Строки переставляются целиком, а номера индекса слева едут вместе со своими строками — по ним видно, откуда строка пришла.</p>
<p>Чтобы результат было легко разглядеть, возьмём заказы одного клиента — их всего четыре. Заготовка уже отобрала их в переменную <code>u3</code>, как в прошлом шаге.</p>`,
      task: `<p><strong>Порядок действий.</strong></p>
<ol class="order">
<li><code>u3</code> — заказы клиента 3, уже в переменной.</li>
<li><code>.sort_values("revenue")</code> — отсортировать по выручке.</li>
<li><code>print(…)</code> — напечатать.</li>
</ol>
<p><strong>Задание.</strong> Напечатайте заказы клиента 3 от самого дешёвого к самому дорогому.</p>`,
      starter: "u3 = orders[orders[\"user_id\"] == 3]\nprint(u3)",
      expected: { stdout: `   order_id  user_id order_date  revenue status
3         4        3 2024-04-23  1361.84   paid
6         7        3 2024-07-31  1796.60   paid
5         6        3 2024-07-08  3071.02   paid
4         5        3 2024-05-26  9071.54   paid` },
      hint: "Допишите метод к <code>u3</code> внутри <code>print</code>: <code>print(u3.sort_values(\"revenue\"))</code>.",
      solution: "u3 = orders[orders[\"user_id\"] == 3]\nprint(u3.sort_values(\"revenue\"))"
    },
    {
      title: "По убыванию: ascending=False",
      body: `
<p><code>DESC</code> в pandas — настройка <code>ascending=False</code>: <code>sort_values("revenue", ascending=False)</code>. <code>ascending</code> по-английски «по возрастанию», <code>False</code> — «нет».</p>
<p>Так пишут настройки почти во всех методах pandas: имя настройки, знак <code>=</code>, значение. Её ставят в те же скобки через запятую после имени столбца. <code>False</code> и <code>True</code> пишут с большой буквы и без кавычек.</p>`,
      task: "<p><strong>Задание.</strong> Напечатайте заказы клиента 3 от самого дорогого к самому дешёвому.</p>",
      starter: "u3 = orders[orders[\"user_id\"] == 3]\nprint(u3.sort_values(\"revenue\"))",
      expected: { stdout: `   order_id  user_id order_date  revenue status
4         5        3 2024-05-26  9071.54   paid
5         6        3 2024-07-08  3071.02   paid
6         7        3 2024-07-31  1796.60   paid
3         4        3 2024-04-23  1361.84   paid` },
      hint: "Внутри скобок <code>sort_values</code> после <code>\"revenue\"</code> поставьте запятую и <code>ascending=False</code>.",
      solution: "u3 = orders[orders[\"user_id\"] == 3]\nprint(u3.sort_values(\"revenue\", ascending=False))"
    },
    {
      title: "Сначала сортировка, потом head",
      body: `
<p><code>ORDER BY revenue DESC LIMIT 3</code> — «три самых дорогих заказа». В pandas это два звена: отсортировать, потом взять верхние строки через <code>head(3)</code>. <strong>Порядок здесь решает ответ.</strong></p>
<p>Если сначала взять <code>head(3)</code>, а потом сортировать, получатся три <em>первых по номеру</em> заказа, просто переставленные: <code>orders.head(3).sort_values("revenue", ascending=False)</code> даст заказы 2, 1 и 3 — ни одного из самых дорогих.</p>
<p>Пока каждое звено пишите отдельной строкой и кладите в свою переменную — так порядок виден глазами.</p>`,
      ba: {
        before: { columns: ["order_id", "revenue"], rows: [[1, 2997.2], [2, 4968.24], [3, 1994.76]] },
        after: { columns: ["order_id", "revenue"], rows: [[196, 14473.88], [198, 10177.29], [156, 9550.87]] },
        hl: [],
        note: "«Было» — <code>head(3)</code>, потом сортировка: первые три заказа по номеру. «Стало» — сортировка, потом <code>head(3)</code>: три самых дорогих из всех."
      },
      task: `<p><strong>Порядок действий.</strong></p>
<ol class="order">
<li><code>s = orders.sort_values("revenue", ascending=False)</code> — вся таблица, самые дорогие сверху.</li>
<li><code>top = s.head(3)</code> — три верхние строки из отсортированной.</li>
<li><code>print(top)</code> — напечатать.</li>
</ol>
<p><strong>Задание.</strong> Заготовка делает в неправильном порядке. Напечатайте три самых дорогих заказа магазина, все столбцы.</p>`,
      starter: "h = orders.head(3)\ntop = h.sort_values(\"revenue\", ascending=False)\nprint(top)",
      expected: { stdout: `     order_id  user_id order_date   revenue    status
195       196      205 2024-07-18  14473.88  refunded
197       198      205 2024-09-11  10177.29      paid
155       156      156 2024-07-05   9550.87      paid` },
      hint: "Поменяйте звенья местами: первой строкой <code>s = orders.sort_values(\"revenue\", ascending=False)</code>, второй <code>top = s.head(3)</code>, третьей <code>print(top)</code>.",
      solution: "s = orders.sort_values(\"revenue\", ascending=False)\ntop = s.head(3)\nprint(top)"
    },
    {
      title: "Столбцы в конце — и цепочка одной строкой",
      body: `
<p>Нужные столбцы, как в <code>SELECT order_id, revenue</code>, выбирают двойными скобками из урока 0.3: <code>top[["order_id", "revenue"]]</code>. Столбцы берут последним звеном — когда строки уже отобраны и отсортированы.</p>
<p>Когда звенья понятны, их можно записать одной цепочкой. Строки</p>
<pre><code>s = orders.sort_values("revenue", ascending=False)
top = s.head(3)
print(top[["order_id", "revenue"]])</code></pre>
<p>делают то же, что одна строка <code>print(orders.sort_values("revenue", ascending=False).head(3)[["order_id", "revenue"]])</code>. Цепочку читают слева направо — это те же звенья в том же порядке. Если в длинной строке запутались, разложите её обратно по переменным.</p>`,
      task: `<p><strong>Порядок действий.</strong></p>
<ol class="order">
<li>Отсортировать по <code>revenue</code> от большего к меньшему.</li>
<li>Взять три верхние строки.</li>
<li>Оставить столбцы <code>order_id</code> и <code>revenue</code>.</li>
<li>Напечатать.</li>
</ol>
<p><strong>Задание.</strong> Напечатайте три самых дорогих заказа — только столбцы <code>order_id</code> и <code>revenue</code>. Можно по строкам, можно одной цепочкой.</p>`,
      starter: "s = orders.sort_values(\"revenue\", ascending=False)\ntop = s.head(3)\nprint(top)",
      expected: { stdout: `     order_id   revenue
195       196  14473.88
197       198  10177.29
155       156   9550.87` },
      hint: "Замените последнюю строку на <code>print(top[[\"order_id\", \"revenue\"]])</code>.",
      solution: "s = orders.sort_values(\"revenue\", ascending=False)\ntop = s.head(3)\nprint(top[[\"order_id\", \"revenue\"]])"
    },
    {
      title: "Группировка — это GROUP BY",
      body: `
<p><code>GROUP BY status</code> в pandas — <code>groupby("status")</code>. Дальше, как в SQL, говорят, какой столбец считать и как: <code>orders.groupby("status")["order_id"].count()</code> — сколько заказов в каждом статусе, как <code>SELECT status, COUNT(order_id) … GROUP BY status</code>.</p>
<p>Вместо <code>count</code> бывают <code>sum</code>, <code>mean</code>, <code>max</code>. Результат печатается столбиком: слева статусы, справа итоги, внизу — имя столбца и тип чисел.</p>`,
      ba: {
        before: { columns: ["status", "revenue"],
          rows: [["paid", 6310.9], ["pending", 7524.11], ["refunded", 5494.59], ["paid", 2290.61], ["pending", 2820.17]] },
        after: { columns: ["status", "revenue"], rows: [["paid", 8601.51], ["pending", 10344.28], ["refunded", 5494.59]] },
        hl: ["revenue"],
        note: "Заказы пользователя 196: строки с одинаковым статусом сложились в одну — как <code>SUM(revenue) … GROUP BY status</code>."
      },
      task: `<p><strong>Порядок действий</strong> в <code>orders.groupby("status")["revenue"].sum().round(2)</code> — слева направо:</p>
<ol class="order">
<li><code>groupby("status")</code> — разложить заказы на группы по статусу.</li>
<li><code>["revenue"]</code> — в каждой группе взять столбец выручки.</li>
<li><code>.sum()</code> — сложить его внутри каждой группы.</li>
<li><code>.round(2)</code> — округлить все итоги сразу.</li>
<li><code>print(…)</code> — напечатать.</li>
</ol>
<p><strong>Задание.</strong> Заготовка считает заказы в каждом статусе. Напечатайте вместо этого выручку по статусам — сумму <code>revenue</code>, два знака.</p>`,
      starter: "print(orders.groupby(\"status\")[\"order_id\"].count())",
      expected: { stdout: `status
paid        653428.78
pending      56028.51
refunded     56018.96
Name: revenue, dtype: float64` },
      hint: "Поменяйте столбец на <code>\"revenue\"</code>, <code>count()</code> — на <code>sum()</code> и допишите <code>.round(2)</code>: <code>print(orders.groupby(\"status\")[\"revenue\"].sum().round(2))</code>.",
      solution: "print(orders.groupby(\"status\")[\"revenue\"].sum().round(2))"
    },
    {
      title: "Сами: самые дорогие оплаченные заказы",
      body: `
<p>Новых слов здесь нет. Вопрос: какие пять <strong>оплаченных</strong> заказов самые дорогие?</p>
<p>Отбор нужен первым. Без него на первое место встанет заказ 196 на 14 473,88 ₽, а это возврат, выручки от него нет. А если сначала взять пять самых дорогих и только потом отбирать оплаченные, останется четыре строки: один из пяти — тот самый возврат.</p>
<p><strong>Порядок действий.</strong></p>
<ol class="order">
<li>Отобрать оплаченные заказы в переменную.</li>
<li>Отсортировать их по <code>revenue</code> от большего к меньшему.</li>
<li>Взять пять верхних строк.</li>
<li>Оставить столбцы <code>order_id</code>, <code>user_id</code> и <code>revenue</code>.</li>
<li>Напечатать.</li>
</ol>`,
      task: "<p><strong>Задание.</strong> Напечатайте пять самых дорогих оплаченных заказов — столбцы <code>order_id</code>, <code>user_id</code> и <code>revenue</code>.</p>",
      starter: "# 1. paid = …\n# 2. s = …\n# 3. top = …\n# 4–5. print(…)\n",
      expected: { stdout: `     order_id  user_id   revenue
197       198      205  10177.29
155       156      156   9550.87
4           5        3   9071.54
88         89       91   8835.71
73         74       80   8173.74` },
      hint: "<code>paid = orders[orders[\"status\"] == \"paid\"]</code>, <code>s = paid.sort_values(\"revenue\", ascending=False)</code>, <code>top = s.head(5)</code> и <code>print(top[[\"order_id\", \"user_id\", \"revenue\"]])</code>.",
      solution: "paid = orders[orders[\"status\"] == \"paid\"]\ns = paid.sort_values(\"revenue\", ascending=False)\ntop = s.head(5)\nprint(top[[\"order_id\", \"user_id\", \"revenue\"]])"
    }
  ],

  cards: [
    { q: "Как в pandas записать <code>WHERE status = 'paid'</code>?",
      a: "<code>orders[orders[\"status\"] == \"paid\"]</code>. Внутри — сравнение, оно даёт True или False для каждой строки; внешние скобки оставляют строки с True. Сравнивают двумя знаками <code>==</code>." },
    { q: "Как получить три самых дорогих заказа и почему важен порядок?",
      a: "Сначала <code>sort_values(\"revenue\", ascending=False)</code>, потом <code>head(3)</code>. Если сначала взять <code>head(3)</code>, отсортируются лишь три первых по номеру заказа." },
    { q: "В каком порядке идут звенья «отбор, сортировка, первые N, столбцы»?",
      a: "Отбор строк → сортировка → <code>head</code> → нужные столбцы → <code>print</code>. Как в SQL: сначала WHERE, потом ORDER BY, потом LIMIT." },
    { q: "Что делает <code>orders.groupby(\"status\")[\"revenue\"].sum()</code>?",
      a: "Раскладывает заказы на группы по статусу, в каждой берёт столбец выручки и складывает: одна строка итога на статус, как <code>SUM(revenue) … GROUP BY status</code>." },
    { q: "Что значит <code>ascending=False</code>?",
      a: "Настройка <code>sort_values</code>: сортировать не по возрастанию, а по убыванию, как <code>DESC</code>. Настройки пишут в скобках метода: имя, <code>=</code>, значение." }
  ]
};
