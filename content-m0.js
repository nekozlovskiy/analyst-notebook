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
