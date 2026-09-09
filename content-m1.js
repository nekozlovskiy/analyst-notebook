/* ============================================================
   Модуль 1 — SQL для аналитика
   ============================================================ */

/* ---------------------------------------------------------- */
/* 1.1 — JOIN                                                   */
/* ---------------------------------------------------------- */

window.CONTENT.m1l1 = {
  intro: "Соединяем таблицы так, чтобы не потерять строки и не размножить их. Это первое, что проверяют на SQL-секции собеседования, и первое, на чём валятся.",
  duration: "≈ 2 часа",
  plan: [
    { m: "30 мин", w: "Теория: четыре вида соединений и две главные ловушки" },
    { m: "40 мин", w: "Основная задача: сводка по каналам для маркетинга" },
    { m: "35 мин", w: "Тренажёр: 5 задач на ту же базу" },
    { m: "10 мин", w: "Самопроверка вопросами" },
    { m: "5 мин",  w: "Заметки и ссылки на разбор" }
  ],

  theory: `
<p class="lead">Данные в базе разложены по таблицам, чтобы не дублироваться: про пользователя — в одной, про его заказы — в другой. Работа аналитика начинается там, где эти таблицы надо снова собрать вместе, ничего не потеряв и ничего не удвоив.</p>

<h3>Зачем вообще соединять таблицы</h3>
<p>Представьте, что вы храните заказы и рядом, в той же строке, город и канал привлечения пользователя. Человек переехал — и вам надо править двести строк вместо одной. Поэтому базы устроены иначе: атрибуты пользователя лежат в <code>users</code>, факты покупок — в <code>orders</code>, связывает их общий столбец <code>user_id</code>. Это называется нормализацией.</p>
<p><strong>JOIN</strong> — команда «подставь к каждой строке слева подходящие строки справа». Всё, что вы делаете в Excel через ВПР, в SQL делается джойном — только без ограничения на первый столбец и без падения на миллионе строк.</p>

<h3>Четыре вида соединений</h3>
<table>
  <tr><th>Вид</th><th>Что оставляет</th><th>Когда брать</th></tr>
  <tr><td><code>INNER JOIN</code></td><td>только строки, у которых есть пара с обеих сторон</td><td>нужны только пользователи с заказами</td></tr>
  <tr><td><code>LEFT JOIN</code></td><td>все строки левой таблицы; если пары нет — справа <code>NULL</code></td><td>нужны все пользователи, даже без заказов</td></tr>
  <tr><td><code>RIGHT JOIN</code></td><td>то же зеркально</td><td>почти не используют — проще поменять таблицы местами</td></tr>
  <tr><td><code>FULL JOIN</code></td><td>всё с обеих сторон</td><td>сверка двух источников: что есть тут, но нет там</td></tr>
</table>
<p>На практике 95% запросов — это <code>INNER</code> и <code>LEFT</code>. Их и надо довести до автоматизма. Слово <code>OUTER</code> в <code>LEFT OUTER JOIN</code> необязательное, его обычно опускают.</p>

<h3>Как это выглядит</h3>
<pre><code>SELECT u.user_id, u.channel, o.order_id, o.revenue
FROM users u                    -- левая таблица
LEFT JOIN orders o              -- правая
       ON o.user_id = u.user_id -- по какому полю связываем</code></pre>
<p><code>u</code> и <code>o</code> — псевдонимы (алиасы). Они экономят время и делают запрос читаемым, поэтому их пишут почти всегда. Правило хорошего тона: у каждого столбца в <code>SELECT</code> указывать, из какой он таблицы. Через полгода это спасёт того, кто будет разбираться в вашем запросе, — скорее всего вас.</p>

<div class="example">
  <div class="example-h">Разбор на пальцах: что происходит со строками</div>
  <div class="example-b">
    <p>Допустим, у нас три пользователя, а заказов всего два:</p>
<pre><code>users                 orders
user_id  channel      order_id  user_id  revenue
1        organic      101       1        1000
2        social       102       1        2000
3        email        (у пользователей 2 и 3 заказов нет)</code></pre>
    <p><code>INNER JOIN</code> даст <strong>две</strong> строки — только там, где пара нашлась:</p>
<pre><code>1  organic  101  1000
1  organic  102  2000</code></pre>
    <p><code>LEFT JOIN</code> даст <strong>четыре</strong> строки — все пользователи, у кого нет заказа, получают <code>NULL</code>:</p>
<pre><code>1  organic  101   1000
1  organic  102   2000
2  social   NULL  NULL
3  email    NULL  NULL</code></pre>
    <p>Обратите внимание: пользователь <code>1</code> в результате встречается дважды. Это не ошибка, это и есть связь «один ко многим». Но именно отсюда растёт первая ловушка.</p>
  </div>
</div>

<h3>Ловушка первая: строки размножаются</h3>
<p>У одного пользователя может быть пять заказов. После <code>JOIN</code> этот пользователь появится в результате пять раз. Поэтому:</p>
<ul>
  <li><code>COUNT(*)</code> после джойна считает <em>строки после соединения</em>, а не пользователей;</li>
  <li>чтобы посчитать людей, нужен <code>COUNT(DISTINCT u.user_id)</code>;</li>
  <li><code>COUNT(o.order_id)</code> не считает <code>NULL</code>, а <code>COUNT(*)</code> считает. После <code>LEFT JOIN</code> эта разница решает: у канала без заказов первый вариант даст честный 0, второй — единицу.</li>
</ul>
<p>Самый опасный случай — джойн двух таблиц «многие ко многим». Если у пользователя 3 заказа и 5 событий, а вы соединили всё сразу, то получится 15 строк, и <code>SUM(revenue)</code> завысит выручку в пять раз. Признак беды: сумма в отчёте подозрительно круглая и подозрительно большая. Лечится тем, что каждую таблицу сначала агрегируют до уровня «одна строка на пользователя», а уже потом соединяют.</p>

<div class="callout trap">
  <span class="ct">Ловушка вторая, на которой валятся на собеседовании</span>
  <p>Если после <code>LEFT JOIN</code> написать условие по правой таблице в <code>WHERE</code> — соединение молча превращается в <code>INNER</code>. Строки, где справа <code>NULL</code>, не проходят проверку и исчезают.</p>
  <p style="margin-bottom:0"><strong>Правило:</strong> фильтр по правой таблице ставим в <code>ON</code>, фильтр по левой — в <code>WHERE</code>.</p>
</div>

<div class="cmp">
  <div class="bad">
    <span class="cmp-t">Так канал без заказов пропадёт</span>
<pre><code>FROM users u
LEFT JOIN orders o ON o.user_id = u.user_id
WHERE o.status = 'paid'</code></pre>
    <p>Для строк без заказа <code>o.status</code> равен <code>NULL</code>, а <code>NULL = 'paid'</code> — это не «ложь», это «неизвестно». В <code>WHERE</code> проходят только истинные условия, поэтому строка отбрасывается.</p>
  </div>
  <div class="good">
    <span class="cmp-t">Так останутся все каналы</span>
<pre><code>FROM users u
LEFT JOIN orders o ON o.user_id = u.user_id
                  AND o.status = 'paid'</code></pre>
    <p>Условие стало частью правила соединения: «присоединяй только оплаченные заказы». Пары не нашлось — справа <code>NULL</code>, но сама строка пользователя остаётся.</p>
  </div>
</div>

<h3>Порядок выполнения запроса</h3>
<p>SQL пишется не в том порядке, в котором выполняется. Это объясняет половину странностей:</p>
<pre><code>FROM / JOIN   ->  WHERE  ->  GROUP BY  ->  HAVING  ->  SELECT  ->  ORDER BY  ->  LIMIT
   1              2           3            4           5           6            7</code></pre>
<ul>
  <li><code>WHERE</code> отрабатывает <em>до</em> группировки — поэтому в нём нельзя написать <code>SUM(...) &gt; 100</code>;</li>
  <li><code>SELECT</code> отрабатывает почти последним — поэтому алиас из <code>SELECT</code> не виден в <code>WHERE</code>, но виден в <code>ORDER BY</code>;</li>
  <li><code>ON</code> — часть шага 1, <code>WHERE</code> — шаг 2. Вот почему они ведут себя по-разному.</li>
</ul>

<h3>NULL: третье состояние</h3>
<p><code>NULL</code> — это не ноль и не пустая строка, это «значение неизвестно». Отсюда следствия, которые надо просто запомнить:</p>
<table>
  <tr><th>Выражение</th><th>Результат</th><th>Что делать</th></tr>
  <tr><td><code>NULL = NULL</code></td><td>не TRUE</td><td>сравнивать через <code>IS NULL</code></td></tr>
  <tr><td><code>SUM(...)</code> по пустому набору</td><td><code>NULL</code>, не 0</td><td><code>COALESCE(SUM(...), 0)</code></td></tr>
  <tr><td><code>COUNT(col)</code></td><td>пропускает <code>NULL</code></td><td>это удобно — так и считают</td></tr>
  <tr><td><code>AVG(col)</code></td><td>делит на число непустых</td><td>решите, нужен ли вам такой средний</td></tr>
  <tr><td><code>100 + NULL</code></td><td><code>NULL</code></td><td>закрывать <code>COALESCE</code> заранее</td></tr>
</table>

<div class="callout work">
  <span class="ct">Где это в работе</span>
  <p>Любой отчёт «в разрезе чего-то» — это джойн. «Выручка по каналам привлечения», «заказы по городам», «активность по тарифам»: атрибут лежит в одной таблице, событие — в другой. Задача про каналы без заказов — типичный запрос от маркетинга перед перераспределением бюджета: канал, который не принёс ни рубля, обязан быть в таблице с нулём, иначе его просто не заметят и продолжат оплачивать.</p>
</div>

<div class="callout jobs">
  <span class="ct">Что закрывает урок в вакансиях</span>
  <ul>
    <li>«SQL на уровне сложных запросов: JOIN, GROUP BY, подзапросы» — формулировка из большинства вакансий Junior Data Analyst</li>
    <li>«Умение строить отчётность в разрезах» — Product Analyst, Junior</li>
    <li>Живая задача с секции SQL: «посчитай метрику так, чтобы категории с нулём не пропали»</li>
    <li>Устный вопрос: «чем отличается условие в ON от условия в WHERE» — спрашивают почти всегда</li>
  </ul>
</div>
`,

  ticket: {
    from: "Ира, performance-маркетинг",
    subj: "Сводка по каналам привлечения перед пересмотром бюджета",
    body: `
<p>Привет! В понедельник режем бюджет и надо понять, какие каналы вообще что-то приносят. Собери, пожалуйста, по каждому каналу:</p>
<ul>
  <li><code>channel</code> — канал привлечения</li>
  <li><code>users_cnt</code> — сколько всего пользователей мы через него привели</li>
  <li><code>orders_cnt</code> — сколько было <strong>оплаченных</strong> заказов</li>
  <li><code>revenue</code> — выручка по оплаченным заказам, округли до 2 знаков</li>
</ul>
<p>Важно: <strong>каналы без заказов тоже должны быть в таблице</strong>, с нулями — мне надо видеть, куда деньги ушли впустую. Отсортируй по выручке от большей к меньшей.</p>
<p>Заказы со статусом <code>refunded</code> и <code>pending</code> в выручку не берём.</p>
`
  },

  schema: window.SH.sqlSchema,

  starter: `-- Сводка по каналам привлечения
-- Подсказка по структуре: начните с той таблицы,
-- строки которой нельзя потерять.

SELECT
    -- перечислите нужные столбцы
FROM users u
-- присоедините orders
GROUP BY
ORDER BY
`,

  expected: {
    ordered: true,
    columns: ["channel", "users_cnt", "orders_cnt", "revenue"],
    rows: [
      ["organic", 75, 74, 271926.54],
      ["paid_search", 55, 51, 141330.95],
      ["email", 28, 28, 122017.95],
      ["social", 42, 24, 61776.11],
      ["referral", 14, 12, 56377.23],
      ["partner", 6, 0, 0]
    ]
  },

  hints: [
    "В результате должен быть канал <code>partner</code>, у которого <strong>нет ни одного заказа</strong>. Какая таблица должна стоять слева, и какой вид соединения сохранит такую строку?",
    "Левая таблица — <code>users</code>, соединение — <code>LEFT JOIN</code>. Дальше два вопроса. Первый: после соединения пользователь с тремя заказами превратится в три строки — как тогда честно посчитать количество пользователей? Второй: у <code>partner</code> справа будет <code>NULL</code> — какая функция подсчёта даст на этом ноль, <code>COUNT(*)</code> или <code>COUNT(o.order_id)</code>?",
    "Осталось условие <code>status = 'paid'</code>. Если поставить его в <code>WHERE</code>, строки канала <code>partner</code> (где <code>status</code> равен <code>NULL</code>) не пройдут фильтр и канал пропадёт из отчёта. Значит условие идёт в <code>ON</code> — рядом с условием соединения, через <code>AND</code>. И последнее: <code>SUM</code> по пустому набору даёт <code>NULL</code>, а не 0, — оберните её в <code>COALESCE(..., 0)</code>."
  ],

  solution: `-- Сводка по каналам привлечения
SELECT
    u.channel,
    -- пользователь после джойна дублируется на каждый свой заказ,
    -- поэтому людей считаем только через DISTINCT
    COUNT(DISTINCT u.user_id) AS users_cnt,
    -- COUNT по столбцу правой таблицы игнорирует NULL,
    -- поэтому у канала без заказов честно получится 0
    COUNT(o.order_id) AS orders_cnt,
    -- SUM по пустому набору вернёт NULL — подменяем нулём
    ROUND(COALESCE(SUM(o.revenue), 0), 2) AS revenue
FROM users u
LEFT JOIN orders o
       ON o.user_id = u.user_id
      -- фильтр по ПРАВОЙ таблице обязан жить в ON.
      -- В WHERE он бы отсёк строки с NULL и убил LEFT JOIN
      AND o.status = 'paid'
GROUP BY u.channel
ORDER BY revenue DESC;`,

  solutionNote: `
<p><strong>Что здесь важно понять, а не запомнить:</strong></p>
<ul>
  <li>решение про <code>LEFT</code> принимается по формулировке задачи — «каналы без заказов тоже нужны». Всегда ищите в тикете эту фразу, она определяет вид соединения;</li>
  <li><code>COUNT(DISTINCT ...)</code> — единственный честный способ считать сущности после джойна «один ко многим»;</li>
  <li>условие по правой таблице в <code>ON</code>, а не в <code>WHERE</code>, — самая частая правка на код-ревью аналитиков.</li>
</ul>
<p><strong>Проверка здравым смыслом.</strong> Сумма <code>users_cnt</code> должна дать 220 — все пользователи базы. Если получилось меньше, где-то потерялись строки; если больше — где-то размножились. Такую проверку стоит делать до того, как отправите отчёт.</p>
`,

  drills: [
    {
      title: "Пользователи без единого заказа",
      level: "easy",
      body: `<p>Маркетингу нужен список тех, кто зарегистрировался и так ничего и не купил, — под реактивационную рассылку.</p>
<p>Выведите <code>user_id</code>, <code>channel</code>, <code>signup_date</code> для пользователей, у которых <strong>нет ни одного заказа вообще</strong> (любого статуса). Отсортируйте по <code>signup_date</code>.</p>
<p>Подсказка: это классический приём «LEFT JOIN + IS NULL» — присоединяем и оставляем только те строки, где пары не нашлось.</p>`,
      solution: `SELECT u.user_id, u.channel, u.signup_date
FROM users u
LEFT JOIN orders o ON o.user_id = u.user_id
WHERE o.order_id IS NULL      -- пары не нашлось => заказов нет
ORDER BY u.signup_date;`,
      note: `<p>Проверьте <code>IS NULL</code> именно по столбцу правой таблицы, который никогда не бывает пустым в реальных строках — обычно это первичный ключ (<code>order_id</code>). Если взять <code>o.revenue</code>, а в данных попадётся заказ с пустой суммой, вы случайно посчитаете его «отсутствующим».</p>`
    },
    {
      title: "Выручка по платформам, включая пустые",
      level: "easy",
      body: `<p>Продакт хочет понять, где люди платят: <code>ios</code>, <code>android</code> или <code>web</code>.</p>
<p>Выведите <code>platform</code>, <code>users_cnt</code>, <code>buyers_cnt</code> (сколько уникальных пользователей сделали хотя бы один оплаченный заказ) и <code>revenue</code>. Сортировка — по выручке убыванием.</p>`,
      solution: `SELECT
    u.platform,
    COUNT(DISTINCT u.user_id) AS users_cnt,
    COUNT(DISTINCT o.user_id) AS buyers_cnt,
    ROUND(COALESCE(SUM(o.revenue), 0), 2) AS revenue
FROM users u
LEFT JOIN orders o ON o.user_id = u.user_id AND o.status = 'paid'
GROUP BY u.platform
ORDER BY revenue DESC;`,
      note: `<p>Обратите внимание на <code>COUNT(DISTINCT o.user_id)</code>: он не считает <code>NULL</code>, поэтому даёт ровно число покупателей. Это удобный трюк — считать сущности «с той стороны джойна, где они есть».</p>`
    },
    {
      title: "Заказы-сироты",
      level: "mid",
      body: `<p>В реальной базе иногда встречаются заказы, у которых <code>user_id</code> не находится в таблице пользователей: удалили аккаунт, сломался импорт, кривая миграция. Это первое, что проверяет аналитик перед тем, как строить отчёт.</p>
<p>Напишите запрос, который покажет, есть ли в <code>orders</code> такие «сироты»: выведите <code>orphan_orders</code> — их количество. Если данные целые, должен получиться ноль.</p>`,
      solution: `SELECT COUNT(*) AS orphan_orders
FROM orders o
LEFT JOIN users u ON u.user_id = o.user_id
WHERE u.user_id IS NULL;`,
      note: `<p>В нашей учебной базе ответ — 0, и это хорошая новость. В боевой базе такой запрос стоит прогонять перед каждым большим отчётом: расхождение «сумма по джойну ≠ сумма по исходной таблице» чаще всего объясняется именно сиротами.</p>`
    },
    {
      title: "Размножение строк своими глазами",
      level: "mid",
      body: `<p>Задача-эксперимент. Напишите два запроса и сравните числа:</p>
<ol>
  <li><code>SELECT COUNT(*) FROM users;</code></li>
  <li><code>SELECT COUNT(*) FROM users u LEFT JOIN orders o ON o.user_id = u.user_id;</code></li>
</ol>
<p>Объясните себе разницу, а потом одним запросом выведите пятерых пользователей, которые дают самое сильное размножение: <code>user_id</code>, <code>orders_cnt</code>. Сортировка по <code>orders_cnt</code> убыванием, при равенстве — по <code>user_id</code>.</p>`,
      solution: `-- 220 против 325: соединение добавило 105 строк.
-- 215 заказов нашли пару + 110 пользователей остались без заказа

SELECT
    u.user_id,
    COUNT(o.order_id) AS orders_cnt
FROM users u
JOIN orders o ON o.user_id = u.user_id
GROUP BY u.user_id
ORDER BY orders_cnt DESC, u.user_id
LIMIT 5;`,
      note: `<p>Считается так: 215 заказов нашли своего пользователя, плюс 110 пользователей без заказов дали по одной строке с <code>NULL</code> — итого 325. Если теперь посчитать <code>COUNT(*)</code> и назвать это «числом пользователей», отчёт завысит аудиторию в полтора раза. Именно так ломаются реальные дашборды.</p>`
    },
    {
      title: "Города и каналы вместе",
      level: "hard",
      body: `<p>Маркетинг хочет матрицу: сколько выручки принёс каждый канал в каждом городе.</p>
<p>Выведите <code>city</code>, <code>channel</code>, <code>revenue</code> (только <code>paid</code>) для пар, где выручка больше 30 000. Сортировка по выручке убыванием.</p>
<p>Дополнительный вопрос на подумать: почему в такой таблице удобнее <code>INNER JOIN</code>, хотя в основной задаче мы настаивали на <code>LEFT</code>?</p>`,
      solution: `SELECT
    u.city,
    u.channel,
    ROUND(SUM(o.revenue), 2) AS revenue
FROM users u
JOIN orders o ON o.user_id = u.user_id AND o.status = 'paid'
GROUP BY u.city, u.channel
HAVING SUM(o.revenue) > 30000
ORDER BY revenue DESC;`,
      note: `<p>Ответ на вопрос: здесь нас интересуют только пары «город × канал», где деньги реально есть. Пустых комбинаций «город × канал» здесь семь из тридцати возможных, и в отчёте они только шумят. Вид соединения выбирается не по привычке, а по тому, нужны ли вам нули в отчёте.</p>`
    }
  ],

  quiz: [
    {
      q: "После <code>LEFT JOIN orders</code> вы написали <code>WHERE orders.status = 'paid'</code>. Что произойдёт?",
      opts: [
        "Соединение фактически станет INNER: строки без заказов исчезнут",
        "Строки без заказов останутся, но со статусом 'paid'",
        "Ничего особенного, отфильтруются только неоплаченные заказы",
        "Запрос вернёт ошибку синтаксиса"
      ],
      right: 0,
      why: "Для строк без пары <code>status</code> равен <code>NULL</code>, а <code>NULL = 'paid'</code> не даёт TRUE. <code>WHERE</code> пропускает только истинные условия, поэтому такие строки отбрасываются. Условие по правой таблице надо ставить в <code>ON</code>."
    },
    {
      q: "У пользователя 4 оплаченных заказа. Сколько строк он даст в результате <code>users LEFT JOIN orders</code> без группировки?",
      opts: ["Зависит от порядка таблиц", "1", "4", "5"],
      right: 2,
      why: "Соединение «один ко многим» размножает левую строку по числу подходящих правых. Четыре заказа — четыре строки. Именно поэтому <code>COUNT(*)</code> после джойна считает не людей, а строки."
    },
    {
      q: "Чем отличается <code>COUNT(*)</code> от <code>COUNT(o.order_id)</code> после LEFT JOIN?",
      opts: [
        "Ничем, это синонимы",
        "COUNT(*) нельзя использовать с GROUP BY",
        "COUNT(*) считает все строки группы, COUNT(o.order_id) пропускает NULL",
        "COUNT(o.order_id) работает быстрее"
      ],
      right: 2,
      why: "Это ключевая разница для отчётов с нулями: у канала без заказов <code>COUNT(*)</code> вернёт 1 (строка-то есть), а <code>COUNT(o.order_id)</code> — честный 0."
    },
    {
      q: "<code>SUM(revenue)</code> по группе, где ни одной строки не подошло, вернёт:",
      opts: ["Пустую строку", "Ошибку", "0", "NULL"],
      right: 3,
      why: "Агрегаты по пустому набору возвращают <code>NULL</code> (кроме <code>COUNT</code>, который возвращает 0). Чтобы в отчёте был ноль, а не пустая ячейка, нужен <code>COALESCE(SUM(...), 0)</code>."
    },
    {
      q: "В каком порядке база выполняет части запроса?",
      opts: [
        "FROM/JOIN → WHERE → GROUP BY → HAVING → SELECT → ORDER BY",
        "Порядок не определён, оптимизатор решает сам",
        "WHERE → FROM → SELECT → GROUP BY → HAVING",
        "SELECT → FROM → WHERE → GROUP BY → ORDER BY"
      ],
      right: 0,
      why: "Из этого порядка следует всё остальное: почему в <code>WHERE</code> нельзя писать агрегаты (группировки ещё не было), почему алиас из <code>SELECT</code> виден в <code>ORDER BY</code>, но не в <code>WHERE</code>."
    },
    {
      q: "Как найти пользователей, у которых нет ни одного заказа?",
      opts: [
        "LEFT JOIN orders WHERE orders.order_id = 0",
        "LEFT JOIN orders WHERE orders.order_id IS NULL",
        "RIGHT JOIN users WHERE users.user_id IS NULL",
        "INNER JOIN orders WHERE orders.order_id IS NULL"
      ],
      right: 1,
      why: "Приём «anti-join»: <code>LEFT JOIN</code> оставляет всех, а условие <code>IS NULL</code> по ключу правой таблицы отбирает ровно тех, кому пары не нашлось. С <code>INNER JOIN</code> таких строк просто не будет в наборе."
    }
  ],

  links: [
    { t: "Types of Joins — визуальный разбор", url: "https://mode.com/sql-tutorial/sql-joins/", src: "Mode Analytics", lang: "EN",
      d: "Лучший бесплатный SQL-курс для аналитиков. Разделы про JOIN разобраны на реальных датасетах, с картинками и упражнениями прямо в браузере." },
    { t: "SQLBolt — интерактивные уроки", url: "https://sqlbolt.com/", src: "sqlbolt.com", lang: "EN",
      d: "18 коротких уроков с задачами. Идеально, чтобы добить синтаксис до автоматизма за пару вечеров." },
    { t: "Задачи по SQL с проверкой", url: "https://www.sql-ex.ru/", src: "sql-ex.ru", lang: "RU",
      d: "Русскоязычный тренажёр с сотнями задач и строгой проверкой. Первые 30 задач закрывают весь синтаксис уровня junior." },
    { t: "SELECT: официальная документация SQLite", url: "https://www.sqlite.org/lang_select.html", src: "sqlite.org", lang: "EN",
      d: "Тот самый диалект, на котором работает этот курс. Раздел про join-operator стоит прочитать целиком — он короткий." },
    { t: "Joins в PostgreSQL", url: "https://www.postgresql.org/docs/current/queries-table-expressions.html", src: "postgresql.org", lang: "EN",
      d: "Документация базы, которая чаще всего стоит в компаниях. Обратите внимание на раздел про условия в ON и WHERE." },
    { t: "Хаб SQL на Хабре", url: "https://habr.com/ru/hubs/sql/articles/", src: "habr.com", lang: "RU",
      d: "Живые разборы задач и граблей от практиков. Хорошее чтение на вечер, когда синтаксис уже усвоен." }
  ]
};

/* ---------------------------------------------------------- */
/* 1.2 — оконные функции                                        */
/* ---------------------------------------------------------- */

window.CONTENT.m1l2 = {
  intro: "Считаем «внутри группы», не схлопывая строки: номер заказа по счёту, предыдущее значение, накопительный итог. Половина продуктовых метрик держится на этом.",
  duration: "≈ 2 часа",
  plan: [
    { m: "35 мин", w: "Теория: устройство окна и четыре рабочие функции" },
    { m: "40 мин", w: "Основная задача: скорость возврата за вторым заказом" },
    { m: "35 мин", w: "Тренажёр: топы, накопительные итоги, доли" },
    { m: "10 мин", w: "Самопроверка вопросами" }
  ],

  theory: `
<p class="lead">Оконные функции — граница между «умею писать SELECT» и «умею считать продуктовые метрики». Ретеншен, топ-N внутри категории, прирост к прошлому месяцу, накопительный итог — всё это они.</p>

<h3>Чем окно отличается от GROUP BY</h3>
<p><code>GROUP BY</code> схлопывает строки: было 215 заказов — стало 6 строк по каналам. Детали при этом теряются безвозвратно. Оконная функция ничего не схлопывает: строк остаётся столько же, но рядом с каждой появляется значение, посчитанное <em>по её группе</em>. Отсюда и название — функция смотрит на строку «через окно» соседей.</p>
<table>
  <tr><th></th><th>GROUP BY</th><th>Оконная функция</th></tr>
  <tr><td>Строк на выходе</td><td>по одной на группу</td><td>столько же, сколько на входе</td></tr>
  <tr><td>Видно ли исходные значения</td><td>нет</td><td>да, рядом с агрегатом</td></tr>
  <tr><td>Типичный вопрос</td><td>«сколько всего по каналу»</td><td>«какая доля этого заказа в сумме клиента»</td></tr>
</table>

<h3>Как устроено выражение</h3>
<pre><code>ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY order_date)
--   функция      окно     на какие группы   в каком порядке
--                         разбить строки    внутри группы</code></pre>
<ul>
  <li><code>PARTITION BY</code> — «считать отдельно для каждого пользователя». Можно не писать — тогда окно охватывает всю таблицу.</li>
  <li><code>ORDER BY</code> внутри <code>OVER</code> — порядок <em>внутри</em> окна. Это не сортировка результата: её по-прежнему задаёт обычный <code>ORDER BY</code> в конце запроса.</li>
</ul>

<h3>Пять функций, которых хватит на 90% задач</h3>
<table>
  <tr><th>Функция</th><th>Что даёт</th><th>Типичная задача</th></tr>
  <tr><td><code>ROW_NUMBER()</code></td><td>1, 2, 3… без повторов</td><td>первый заказ пользователя, топ-3 в категории</td></tr>
  <tr><td><code>RANK()</code></td><td>при равенстве — одинаковый ранг, потом пропуск: 1, 1, 3</td><td>рейтинги, где ничья допустима</td></tr>
  <tr><td><code>DENSE_RANK()</code></td><td>то же, но без пропусков: 1, 1, 2</td><td>«к какому по величине уровню относится значение»</td></tr>
  <tr><td><code>LAG(col)</code> / <code>LEAD(col)</code></td><td>значение из предыдущей / следующей строки окна</td><td>разница с прошлым месяцем, интервал между покупками</td></tr>
  <tr><td><code>SUM(col) OVER (... ORDER BY ...)</code></td><td>накопительный итог</td><td>выручка нарастающим итогом</td></tr>
</table>

<div class="example">
  <div class="example-h">Три ранга на одних данных</div>
  <div class="example-b">
    <p>Пусть выручка по строкам: 500, 300, 300, 100. Смотрим, что вернёт каждая функция:</p>
<pre><code>revenue  ROW_NUMBER  RANK  DENSE_RANK
500          1        1        1
300          2        2        2
300          3        2        2
100          4        4        3</code></pre>
    <p><code>ROW_NUMBER</code> обязан выдать уникальные номера, поэтому при ничьей он выбирает произвольно — если вам нужен воспроизводимый результат, добавьте в <code>ORDER BY</code> окна второй столбец-«разрыватель ничьих», обычно <code>id</code>.</p>
    <p><code>RANK</code> после двух вторых мест перескакивает на 4-е. <code>DENSE_RANK</code> продолжает 3-м. Для «топ-3 товаров» обычно берут <code>DENSE_RANK</code>, если ничьи должны попадать в топ целиком, и <code>ROW_NUMBER</code>, если нужно ровно три строки.</p>
  </div>
</div>

<h3>Рамка окна: то, что почти всегда работает по умолчанию</h3>
<p>Когда в <code>OVER</code> появляется <code>ORDER BY</code>, база неявно добавляет рамку «от начала окна до текущей строки». Именно поэтому <code>SUM(x) OVER (ORDER BY d)</code> — это накопительный итог, а <code>SUM(x) OVER ()</code> без <code>ORDER BY</code> — сумма по всему окну.</p>
<pre><code>SUM(revenue) OVER (PARTITION BY user_id)                    -- вся сумма клиента в каждой строке
SUM(revenue) OVER (PARTITION BY user_id ORDER BY order_date) -- накопительно
AVG(revenue) OVER (ORDER BY order_date
                   ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) -- скользящее среднее за 7 строк</code></pre>
<p>Скользящее среднее по 7 дням — самый частый способ убрать недельную «пилу» с графика выручки. Запомните эту конструкцию, она пригодится в модуле 2.</p>

<h3>CTE: запрос по шагам</h3>
<p>Оконную функцию нельзя использовать в <code>WHERE</code> того же уровня — <code>WHERE</code> отрабатывает раньше окон. Поэтому сначала считаем окно, потом фильтруем результат. Для этого удобен <code>WITH</code> (CTE) — именованный промежуточный шаг:</p>
<pre><code>WITH numbered AS (
    SELECT user_id, order_date,
           ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY order_date) AS n
    FROM orders
)
SELECT * FROM numbered WHERE n = 1;   -- вот тут фильтр уже работает</code></pre>
<p>Читается сверху вниз, как список шагов. Именно так пишут запросы в командах, где код ревьюят.</p>

<div class="callout trap">
  <span class="ct">Три ловушки подряд</span>
  <p><strong>Первая.</strong> <code>LAG</code> у самой первой строки окна вернёт <code>NULL</code> — предыдущей строки просто нет. Любая арифметика с <code>NULL</code> даёт <code>NULL</code>, поэтому такие строки надо либо отфильтровать, либо обработать через <code>COALESCE</code>.</p>
  <p><strong>Вторая.</strong> Фильтр надо ставить <em>до</em> нумерации, если он влияет на порядок. Отфильтруете возвраты после <code>ROW_NUMBER</code> — и «вторым заказом» окажется третий.</p>
  <p style="margin-bottom:0"><strong>Третья.</strong> <code>ORDER BY</code> внутри <code>OVER</code> и <code>ORDER BY</code> в конце запроса — разные вещи. Первый задаёт логику расчёта, второй — порядок вывода. Их путают постоянно.</p>
</div>

<div class="callout work">
  <span class="ct">Где это в работе</span>
  <p>«Сколько дней проходит между первой и второй покупкой» — вопрос, с которого начинается работа над retention. «Топ-3 товара в каждой категории», «первое действие пользователя в сессии», «прирост к прошлой неделе», «доля заказа в чеке клиента» — всё это окна. Без них такие задачи решаются через кривые самосоединения, которые тормозят и ошибаются.</p>
</div>

<div class="callout jobs">
  <span class="ct">Что закрывает урок в вакансиях</span>
  <ul>
    <li>«SQL: оконные функции, CTE» — прямая формулировка, встречается в большинстве вакансий уровня junior+</li>
    <li>«Опыт анализа поведения пользователей» — Product Analyst</li>
    <li>Классическая задача с интервью: «выведи второй заказ каждого клиента» и «топ-3 в каждой категории»</li>
    <li>Устный вопрос: «чем RANK отличается от DENSE_RANK» — спрашивают почти всегда</li>
  </ul>
</div>
`,

  ticket: {
    from: "Костя, продакт",
    subj: "Как быстро люди возвращаются за вторым заказом",
    body: `
<p>Хочу понять, есть ли у нас «окно возврата» — период, когда человек либо покупает второй раз, либо уходит навсегда. Начнём с простого среза.</p>
<p>Собери по <strong>оплаченным</strong> заказам таблицу со столбцами:</p>
<ul>
  <li><code>user_id</code></li>
  <li><code>order_date</code> — дата этого заказа</li>
  <li><code>order_num</code> — номер заказа по счёту у этого пользователя (первый = 1)</li>
  <li><code>days_since_prev</code> — сколько дней прошло с его предыдущего заказа, целым числом</li>
</ul>
<p>Оставь только <strong>вторые</strong> заказы и покажи <strong>10 самых быстрых возвратов</strong>: сортировка по <code>days_since_prev</code> по возрастанию, при равенстве — по <code>user_id</code> по возрастанию.</p>
`
  },

  schema: `
<p>Та же база <strong>«Дельта Маркет»</strong>. В этом уроке нужна только таблица заказов.</p>
<pre><code>orders                      -- 215 строк
  order_id     INTEGER
  user_id      INTEGER
  order_date   TEXT         -- 'YYYY-MM-DD'
  revenue      REAL
  status       TEXT         -- paid | refunded | pending</code></pre>
<p><strong>Разница дат в SQLite:</strong> вычесть одну текстовую дату из другой напрямую нельзя. Используйте <code>julianday(дата)</code> — она превращает дату в число дней:</p>
<pre><code>CAST(julianday('2024-05-08') - julianday('2024-05-06') AS INTEGER)  -- 2</code></pre>
<p>В PostgreSQL это было бы просто <code>date1 - date2</code>, в ClickHouse — <code>dateDiff('day', d1, d2)</code>. Логика одна, синтаксис у каждой базы свой.</p>
`,

  starter: `-- Скорость возврата за вторым заказом
-- Шаг 1: оставить только оплаченные заказы
-- Шаг 2: пронумеровать заказы внутри пользователя и достать дату предыдущего
-- Шаг 3: отфильтровать вторые заказы и отсортировать

WITH numbered AS (
    SELECT
        user_id,
        order_date
        -- сюда: ROW_NUMBER() и LAG()
    FROM orders
    WHERE
)
SELECT
FROM numbered
`,

  expected: {
    ordered: true,
    columns: ["user_id", "order_date", "order_num", "days_since_prev"],
    rows: [
      [55, "2024-05-08", 2, 2],
      [153, "2024-04-02", 2, 3],
      [156, "2024-07-09", 2, 4],
      [31, "2024-02-11", 2, 8],
      [57, "2024-03-26", 2, 9],
      [65, "2024-04-05", 2, 9],
      [91, "2024-02-24", 2, 9],
      [13, "2024-07-10", 2, 10],
      [93, "2024-05-07", 2, 14],
      [215, "2024-06-14", 2, 14]
    ]
  },

  hints: [
    "Нужны две оконные функции с <strong>одним и тем же окном</strong>. Первая проставляет порядковый номер, вторая достаёт дату из предыдущей строки. Как должно выглядеть это окно, если считать надо отдельно по каждому пользователю и по возрастанию даты?",
    "Окно: <code>OVER (PARTITION BY user_id ORDER BY order_date)</code>. С ним <code>ROW_NUMBER()</code> даст номер заказа, а <code>LAG(order_date)</code> — дату предыдущего. Теперь вопрос: почему условие <code>order_num = 2</code> нельзя написать в <code>WHERE</code> прямо в этом же <code>SELECT</code>?",
    "Потому что <code>WHERE</code> выполняется <em>до</em> оконных функций — алиаса <code>order_num</code> на этом этапе ещё не существует. Поэтому окна считаем внутри <code>WITH</code>, а фильтр <code>WHERE order_num = 2</code> ставим уже во внешнем запросе. Разницу дат берём как <code>CAST(julianday(order_date) - julianday(prev_date) AS INTEGER)</code>, а <code>WHERE status = 'paid'</code> — внутри CTE, чтобы нумерация не сбилась из-за возвратов."
  ],

  solution: `-- Скорость возврата за вторым заказом
WITH paid AS (
    -- Фильтруем ДО нумерации: если оставить возвраты,
    -- номера заказов сместятся и второй заказ будет не тем
    SELECT user_id, order_date
    FROM orders
    WHERE status = 'paid'
),
numbered AS (
    SELECT
        user_id,
        order_date,
        -- одно и то же окно для обеих функций:
        -- считаем отдельно по каждому пользователю, по возрастанию даты
        ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY order_date) AS order_num,
        LAG(order_date) OVER (PARTITION BY user_id ORDER BY order_date) AS prev_date
    FROM paid
)
SELECT
    user_id,
    order_date,
    order_num,
    -- julianday превращает дату в число, поэтому её можно вычитать
    CAST(julianday(order_date) - julianday(prev_date) AS INTEGER) AS days_since_prev
FROM numbered
-- фильтр по результату окна возможен только на внешнем уровне
WHERE order_num = 2
ORDER BY days_since_prev ASC, user_id ASC
LIMIT 10;`,

  solutionNote: `
<p><strong>Три момента, которые и есть суть урока:</strong></p>
<ul>
  <li>фильтр <code>status = 'paid'</code> стоит <em>до</em> нумерации — иначе возвращённый заказ съест номер 1 и «вторым» окажется третий;</li>
  <li>окна нельзя фильтровать в том же <code>SELECT</code>, поэтому нужен <code>WITH</code>;</li>
  <li>у пользователей с единственным заказом <code>LAG</code> вернул бы <code>NULL</code> — их отсекло условие <code>order_num = 2</code>.</li>
</ul>
<p><strong>Приём, который экономит время:</strong> если одно и то же окно используется несколько раз, его можно назвать через <code>WINDOW</code>:</p>
<pre><code>SELECT ROW_NUMBER() OVER w, LAG(order_date) OVER w
FROM paid
WINDOW w AS (PARTITION BY user_id ORDER BY order_date);</code></pre>
<p>Развитие задачи, которое часто просят следом: посчитать медиану <code>days_since_prev</code> и построить на ней гипотезу — когда включать напоминание в рассылке.</p>
`,

  drills: [
    {
      title: "Топ-3 заказа в каждом городе",
      level: "easy",
      body: `<p>Классика собеседований: «топ-N внутри группы». Выведите по каждому городу три самых крупных оплаченных заказа: <code>city</code>, <code>order_id</code>, <code>revenue</code>, <code>rn</code> (номер внутри города). Сортировка — по городу, потом по номеру.</p>
<p>Проверьте себя: первым в Казани должен идти заказ 198 на 10 177,29.</p>`,
      solution: `WITH ranked AS (
    SELECT
        u.city,
        o.order_id,
        o.revenue,
        ROW_NUMBER() OVER (PARTITION BY u.city ORDER BY o.revenue DESC) AS rn
    FROM orders o
    JOIN users u ON u.user_id = o.user_id
    WHERE o.status = 'paid'
)
SELECT city, order_id, ROUND(revenue, 2) AS revenue, rn
FROM ranked
WHERE rn <= 3
ORDER BY city, rn;`,
      note: `<p>Шаблон «WITH + ROW_NUMBER + WHERE rn &lt;= N» решает любую задачу вида «топ-N внутри категории». Выучите его целиком — на интервью его просят почти всегда, и времени на изобретение там не будет.</p>`
    },
    {
      title: "Выручка нарастающим итогом по месяцам",
      level: "mid",
      body: `<p>Финансы просят график «сколько заработали с начала года». Выведите <code>ym</code> (месяц в формате <code>'2024-03'</code>), <code>revenue</code> за месяц и <code>cum_revenue</code> — нарастающий итог. Только оплаченные заказы.</p>
<p>Подвох: здесь оконная функция считается <em>поверх</em> агрегата. Такое пишется как <code>SUM(SUM(revenue)) OVER (...)</code> — и это не опечатка.</p>`,
      solution: `SELECT
    strftime('%Y-%m', order_date) AS ym,
    ROUND(SUM(revenue), 2) AS revenue,
    -- внутренний SUM агрегирует месяц, внешний идёт накопительно по месяцам
    ROUND(SUM(SUM(revenue)) OVER (ORDER BY strftime('%Y-%m', order_date)), 2) AS cum_revenue
FROM orders
WHERE status = 'paid'
GROUP BY ym
ORDER BY ym;`,
      note: `<p>Оконные функции выполняются <em>после</em> <code>GROUP BY</code>, поэтому окно видит уже сгруппированные строки. Итог последнего месяца должен совпасть с общей выручкой — 653 428,78. Такая сверка занимает пять секунд и ловит большинство ошибок.</p>`
    },
    {
      title: "Доля заказа в сумме клиента",
      level: "mid",
      body: `<p>Хотим понять, есть ли у клиентов «один большой заказ и мелочь» или суммы ровные. Для пользователей 3, 13 и 103 выведите <code>user_id</code>, <code>order_id</code>, <code>revenue</code> и <code>share_pct</code> — долю этого заказа в общей оплаченной сумме клиента, в процентах с одним знаком.</p>
<p>Здесь окно без <code>ORDER BY</code>: нужна сумма по всей партиции, а не накопительная.</p>`,
      solution: `SELECT
    user_id,
    order_id,
    ROUND(revenue, 2) AS revenue,
    -- окно без ORDER BY => сумма по всей группе пользователя
    ROUND(revenue * 100.0 / SUM(revenue) OVER (PARTITION BY user_id), 1) AS share_pct
FROM orders
WHERE status = 'paid'
  AND user_id IN (3, 13, 103)
ORDER BY user_id, order_id;`,
      note: `<p>У пользователя 3 один заказ занимает 59,3% — это «клиент одной крупной покупки». У 13 и 103 доли ровные. Такой признак используют в сегментации: у первых работает допродажа аксессуаров, у вторых — программы лояльности.</p>`
    },
    {
      title: "Прирост месяца к месяцу через LAG",
      level: "mid",
      body: `<p>Выведите <code>ym</code>, <code>revenue</code>, <code>prev_revenue</code> (выручка прошлого месяца) и <code>mom_pct</code> — прирост в процентах с одним знаком. Только оплаченные.</p>
<p>Вопрос на подумать: что должно стоять в <code>mom_pct</code> у первого месяца и почему туда нельзя просто написать 0?</p>`,
      solution: `SELECT
    strftime('%Y-%m', order_date) AS ym,
    ROUND(SUM(revenue), 2) AS revenue,
    ROUND(LAG(SUM(revenue)) OVER (ORDER BY strftime('%Y-%m', order_date)), 2) AS prev_revenue,
    ROUND(
        SUM(revenue) * 100.0
        / LAG(SUM(revenue)) OVER (ORDER BY strftime('%Y-%m', order_date)) - 100, 1
    ) AS mom_pct
FROM orders
WHERE status = 'paid'
GROUP BY ym
ORDER BY ym;`,
      note: `<p>У января <code>mom_pct</code> — <code>NULL</code>, и это правильно: прироста нет не потому, что он нулевой, а потому, что сравнивать не с чем. Ноль на этом месте — маленькая, но настоящая ложь в отчёте, и на графике он нарисует падение из ниоткуда.</p>`
    },
    {
      title: "Скользящее среднее за 7 заказов",
      level: "hard",
      body: `<p>Выведите последние 15 оплаченных заказов по дате: <code>order_date</code>, <code>revenue</code> и <code>ma7</code> — среднее по текущему и шести предыдущим заказам (округлить до 2 знаков).</p>
<p>Понадобится явная рамка окна: <code>ROWS BETWEEN 6 PRECEDING AND CURRENT ROW</code>.</p>`,
      solution: `WITH base AS (
    SELECT
        order_date,
        revenue,
        AVG(revenue) OVER (
            ORDER BY order_date, order_id
            ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
        ) AS ma7,
        ROW_NUMBER() OVER (ORDER BY order_date DESC, order_id DESC) AS rn
    FROM orders
    WHERE status = 'paid'
)
SELECT order_date, ROUND(revenue, 2) AS revenue, ROUND(ma7, 2) AS ma7
FROM base
WHERE rn <= 15
ORDER BY order_date;`,
      note: `<p>Второй столбец в <code>ORDER BY</code> окна (<code>order_id</code>) обязателен: без него при одинаковых датах порядок строк не определён, и результат может меняться от запуска к запуску. В боевых запросах это источник «плавающих» цифр, которые невозможно воспроизвести.</p>`
    }
  ],

  quiz: [
    {
      q: "Сколько строк вернёт запрос <code>SELECT user_id, SUM(revenue) OVER (PARTITION BY user_id) FROM orders</code>?",
      opts: ["По одной на пользователя", "Одну", "215 — столько же, сколько строк в orders", "Зависит от ORDER BY"],
      right: 2,
      why: "Оконная функция не схлопывает строки — в этом её главное отличие от <code>GROUP BY</code>. Каждая строка заказа останется на месте, просто рядом появится сумма по её пользователю."
    },
    {
      q: "Почему <code>WHERE row_number_col = 1</code> не работает в том же SELECT, где вычисляется ROW_NUMBER?",
      opts: [
        "Так можно, это работает",
        "Потому что нужен DISTINCT",
        "Потому что ROW_NUMBER возвращает текст",
        "Потому что WHERE выполняется раньше оконных функций"
      ],
      right: 3,
      why: "Порядок выполнения: FROM → WHERE → GROUP BY → оконные функции → SELECT. На момент <code>WHERE</code> номера ещё не посчитаны. Решение — обернуть в CTE или подзапрос."
    },
    {
      q: "Выручка по строкам: 500, 300, 300, 100. Что вернёт RANK() для последней строки?",
      opts: ["NULL", "2", "3", "4"],
      right: 3,
      why: "<code>RANK</code> после двух одинаковых вторых мест пропускает третье и переходит к четвёртому. <code>DENSE_RANK</code> в этом случае дал бы 3, а <code>ROW_NUMBER</code> — тоже 4, но по другой причине: он просто нумерует подряд."
    },
    {
      q: "Чем отличаются <code>SUM(x) OVER (PARTITION BY u)</code> и <code>SUM(x) OVER (PARTITION BY u ORDER BY d)</code>?",
      opts: [
        "Второй работает быстрее",
        "Первый даёт сумму по всей группе, второй — накопительный итог",
        "Ничем, ORDER BY только для красоты",
        "Второй вернёт ошибку"
      ],
      right: 1,
      why: "Появление <code>ORDER BY</code> внутри <code>OVER</code> включает рамку по умолчанию «от начала окна до текущей строки». Это и превращает сумму в накопительную. Частая причина «странных» чисел в отчёте."
    },
    {
      q: "Вы фильтруете <code>status = 'paid'</code> уже после ROW_NUMBER. Что сломается?",
      opts: [
        "Пропадут все строки",
        "Запрос упадёт с ошибкой",
        "Нумерация будет учитывать возвраты, и «второй заказ» окажется не тем",
        "Ничего"
      ],
      right: 2,
      why: "Окно считается по тому набору строк, который до него дошёл. Если возвраты ещё не убраны, они займут номера. Правило: сначала приводим набор строк к нужному, потом нумеруем."
    },
    {
      q: "<code>LAG(order_date)</code> для первой строки каждой партиции вернёт:",
      opts: ["Дату из соседней партиции", "Ту же дату", "Нулевую дату", "NULL"],
      right: 3,
      why: "Предыдущей строки внутри партиции нет, поэтому значение неизвестно. Партиции изолированы — заглянуть в соседнюю <code>LAG</code> не может. Обрабатывайте такие строки через <code>COALESCE</code> или отфильтровывайте."
    }
  ],

  links: [
    { t: "Window Functions — полный разбор", url: "https://modern-sql.com/feature/over", src: "modern-sql.com", lang: "EN",
      d: "Сайт Маркуса Винанда, автора книги про производительность SQL. Лучшее объяснение рамок окна, которое существует в открытом доступе." },
    { t: "Оконные функции в SQLite", url: "https://www.sqlite.org/windowfunctions.html", src: "sqlite.org", lang: "EN",
      d: "Документация того движка, на котором вы решаете задачи курса. Раздел про frame specification стоит прочитать до конца." },
    { t: "Window Functions в PostgreSQL", url: "https://www.postgresql.org/docs/current/tutorial-window.html", src: "postgresql.org", lang: "EN",
      d: "Короткий официальный туториал с примерами. То же самое, что будет в проде вашей будущей компании." },
    { t: "Задачи Database на LeetCode", url: "https://leetcode.com/problemset/database/", src: "leetcode.com", lang: "EN",
      d: "Раздел SQL-задач, из которого компании прямо берут вопросы на секцию. Начните с уровня Medium и тега Window Function." },
    { t: "SQL-задачи с реальных собеседований", url: "https://www.stratascratch.com/", src: "stratascratch.com", lang: "EN",
      d: "Задачи, размеченные по компаниям. Бесплатной части хватает, чтобы понять формат и уровень требований." },
    { t: "Use The Index, Luke", url: "https://use-the-index-luke.com/", src: "use-the-index-luke.com", lang: "EN",
      d: "Когда запрос с окнами начнёт тормозить на реальных объёмах — вам сюда. Читать не сейчас, а как только столкнётесь." }
  ]
};

/* ---------------------------------------------------------- */
/* 1.3 — агрегации, GROUP BY, HAVING                            */
/* ---------------------------------------------------------- */

window.CONTENT.m1l3 = {
  intro: "Считать суммы умеет любой. Аналитика начинается там, где надо объяснить, почему средний чек 3 457 ₽, а средние траты клиента — 6 283 ₽, и какое из чисел вставлять в отчёт.",
  duration: "≈ 2 часа",
  plan: [
    { m: "30 мин", w: "Теория: агрегаты, гранулярность, WHERE против HAVING" },
    { m: "40 мин", w: "Основная задача: отчёт по городам с порогом" },
    { m: "35 мин", w: "Тренажёр: 5 задач на подсчёты и ловушки среднего" },
    { m: "10 мин", w: "Самопроверка вопросами" },
    { m: "5 мин",  w: "Заметки" }
  ],

  theory: `
<p class="lead">Агрегация — это ответ на вопрос «сколько». Проблема в том, что «сколько» почти всегда бывает нескольких видов, и выбор между ними — уже аналитическое решение, а не техническое.</p>

<h3>Гранулярность: главное слово урока</h3>
<p>Гранулярность — это то, что означает одна строка таблицы. В <code>orders</code> одна строка — один заказ. В <code>users</code> — один человек. Когда вы пишете <code>GROUP BY channel</code>, вы меняете гранулярность: теперь одна строка — один канал.</p>
<p>Почти все ошибки в отчётах — это ошибки гранулярности. Вы посчитали среднее по заказам, а продакт ждал среднее по клиентам. Числа разные, оба верные, но отвечают на разные вопросы.</p>

<div class="example">
  <div class="example-h">Два «средних», которые путают чаще всего</div>
  <div class="example-b">
<pre><code>-- средний чек: сумма заказа, усреднённая по заказам
SELECT AVG(revenue) FROM orders WHERE status = 'paid';
-- 3457.30

-- средние траты клиента: сначала сумма по клиенту, потом среднее
WITH per_user AS (
    SELECT user_id, SUM(revenue) AS total
    FROM orders WHERE status = 'paid'
    GROUP BY user_id
)
SELECT AVG(total) FROM per_user;
-- 6282.97</code></pre>
    <p>Разница в 1,8 раза — потому что в среднем на клиента приходится 1,8 заказа. Первое число нужно, когда вы обсуждаете корзину и допродажи. Второе — когда считаете, сколько можно платить за привлечение клиента. Подставить не то — значит уронить или раздуть маркетинговый бюджет.</p>
    <p><strong>Правило:</strong> прежде чем писать <code>AVG</code>, вслух проговорите «среднее чего по чему».</p>
  </div>
</div>

<h3>Функции агрегации и их характеры</h3>
<table>
  <tr><th>Функция</th><th>Что делает с NULL</th><th>На что обратить внимание</th></tr>
  <tr><td><code>COUNT(*)</code></td><td>считает все строки</td><td>считает строки, а не сущности</td></tr>
  <tr><td><code>COUNT(col)</code></td><td>пропускает <code>NULL</code></td><td>удобно для «сколько заполнено»</td></tr>
  <tr><td><code>COUNT(DISTINCT col)</code></td><td>пропускает <code>NULL</code></td><td>единственный честный способ считать людей после джойна</td></tr>
  <tr><td><code>SUM</code></td><td><code>NULL</code> по пустому набору</td><td>оборачивать в <code>COALESCE</code></td></tr>
  <tr><td><code>AVG</code></td><td>делит на число <em>непустых</em></td><td>пропуски молча меняют знаменатель</td></tr>
  <tr><td><code>MIN</code> / <code>MAX</code></td><td>игнорируют <code>NULL</code></td><td>работают и с текстом, и с датами</td></tr>
</table>

<h3>WHERE и HAVING: когда какой</h3>
<p>Разница ровно одна и следует из порядка выполнения:</p>
<pre><code>FROM -> WHERE -> GROUP BY -> HAVING -> SELECT -> ORDER BY
         ^                      ^
         фильтр строк           фильтр групп
         (до группировки)       (после)</code></pre>
<ul>
  <li><code>WHERE status = 'paid'</code> — отбрасываем строки до того, как они попадут в группу;</li>
  <li><code>HAVING SUM(revenue) &gt; 100000</code> — отбрасываем целые группы по итогу;</li>
  <li>писать агрегат в <code>WHERE</code> нельзя: на этом шаге его ещё не существует.</li>
</ul>
<p>Практический вывод: если условие можно поставить в <code>WHERE</code> — ставьте туда. Оно отсечёт строки раньше, и запрос будет быстрее. <code>HAVING</code> оставляем только для условий по агрегатам.</p>

<div class="callout trap">
  <span class="ct">Ловушка: NULL в AVG</span>
  <p>Пусть у пяти заказов суммы 100, 200, NULL, NULL, 300. <code>AVG(revenue)</code> вернёт 200 — потому что разделит 600 на <strong>3</strong>, а не на 5.</p>
  <p style="margin-bottom:0">Если пропуски означают «ноль» (например, «скидка не применялась»), считать надо через <code>AVG(COALESCE(revenue, 0))</code> и получить 120. Если пропуски означают «мы не знаем» — правильнее исключить их явно и написать в отчёте, сколько строк выкинули.</p>
</div>

<h3>GROUP BY по нескольким столбцам</h3>
<p><code>GROUP BY platform, status</code> создаёт группу на каждую <em>комбинацию</em>. Три платформы и три статуса дадут до девяти строк — но только те комбинации, которые реально встречаются в данных. Пустые комбинации SQL не придумывает: если на web не было ни одного возврата, такой строки в отчёте не будет.</p>
<p>Это ещё одна причина, по которой отчёты «врут молчанием». Если продакт ждёт матрицу 3×3, а видит 8 строк, он не заметит, что одна ячейка отсутствует. Лечится <code>LEFT JOIN</code> со справочником всех комбинаций — приём из урока 1.1.</p>

<h3>Полезные трюки, которые экономят часы</h3>
<pre><code>-- условный подсчёт: сколько заказов каждого статуса одной строкой
SELECT
    COUNT(*) AS total,
    SUM(CASE WHEN status = 'paid'     THEN 1 ELSE 0 END) AS paid_cnt,
    SUM(CASE WHEN status = 'refunded' THEN 1 ELSE 0 END) AS refunded_cnt,
    ROUND(AVG(CASE WHEN status = 'paid' THEN revenue END), 2) AS avg_paid
FROM orders;</code></pre>
<p>Приём называется «сводная таблица через CASE» и заменяет три отдельных запроса одним. <code>AVG(CASE ... THEN revenue END)</code> без <code>ELSE</code> даёт <code>NULL</code> для неподходящих строк, а <code>AVG</code> их пропускает — получается среднее ровно по нужному подмножеству.</p>

<div class="callout work">
  <span class="ct">Где это в работе</span>
  <p>90% первых задач джуна выглядят так: «дай мне выручку по X за период Y, только по Z». Это <code>WHERE</code> + <code>GROUP BY</code> + <code>ORDER BY</code>. Умение быстро и без ошибок писать такие запросы и есть то, за что платят на старте. <code>HAVING</code> появляется, когда просят «покажи только значимые категории» — например, города, где заказов достаточно, чтобы среднее вообще что-то значило.</p>
</div>

<div class="callout jobs">
  <span class="ct">Что закрывает урок в вакансиях</span>
  <ul>
    <li>«SQL: агрегатные функции, группировки» — базовая строка почти любой вакансии аналитика</li>
    <li>«Построение регулярной отчётности» — то, чем джун занят первые месяцы</li>
    <li>Устный вопрос: «в чём разница между WHERE и HAVING» — входит в топ-5 вопросов SQL-секции</li>
    <li>Вопрос на понимание: «чем отличается COUNT(*) от COUNT(столбец)»</li>
  </ul>
</div>
`,

  ticket: {
    from: "Марина, операционный директор",
    subj: "Где нам стоит открывать пункт выдачи",
    body: `
<p>Смотрим на расширение и надо понять, какие города для нас реально рабочие. Мелкие города с парой заказов не интересуют — по ним среднее ничего не значит.</p>
<p>Сделай таблицу по <strong>оплаченным</strong> заказам:</p>
<ul>
  <li><code>city</code> — город</li>
  <li><code>orders_cnt</code> — количество заказов</li>
  <li><code>buyers_cnt</code> — количество уникальных покупателей</li>
  <li><code>revenue</code> — выручка, 2 знака</li>
  <li><code>aov</code> — средний чек, 2 знака</li>
</ul>
<p>Оставь только города, где <strong>не меньше 30 оплаченных заказов</strong>. Сортировка по выручке от большей к меньшей.</p>
`
  },

  schema: window.SH.sqlSchema,

  starter: `-- Отчёт по городам с порогом по количеству заказов
-- Подумайте: какое условие идёт в WHERE, а какое в HAVING?

SELECT
    u.city
    -- остальные столбцы
FROM users u
JOIN orders o ON
GROUP BY
HAVING
ORDER BY
`,

  expected: {
    ordered: true,
    columns: ["city", "orders_cnt", "buyers_cnt", "revenue", "aov"],
    rows: [
      ["Москва", 53, 25, 191578.82, 3614.69],
      ["Екатеринбург", 46, 24, 131257.62, 2853.43],
      ["Казань", 34, 20, 123531.13, 3633.27],
      ["Санкт-Петербург", 33, 19, 122362.60, 3707.96]
    ]
  },

  hints: [
    "Здесь два разных условия. Первое — «только оплаченные заказы»: оно про отдельные строки. Второе — «не меньше 30 заказов в городе»: оно про группу целиком, и посчитать его можно только после того, как группа собрана. Где место каждому?",
    "<code>status = 'paid'</code> — это <code>WHERE</code> (или условие в <code>ON</code>, если используете <code>LEFT JOIN</code>). Порог по количеству — <code>HAVING COUNT(o.order_id) &gt;= 30</code>. Теперь про столбцы: <code>buyers_cnt</code> — это уникальные покупатели, а после соединения строки размножены. Какая функция здесь нужна?",
    "<code>COUNT(DISTINCT o.user_id)</code> для покупателей и <code>COUNT(o.order_id)</code> для заказов. Средний чек — это <code>AVG(o.revenue)</code>, то есть среднее <em>по заказам</em>, а не по людям: в тикете просят именно средний чек. Не забудьте <code>ROUND(..., 2)</code> у денежных столбцов. В <code>GROUP BY</code> идёт только <code>u.city</code>."
  ],

  solution: `-- Отчёт по городам, только «рабочие» города
SELECT
    u.city,
    COUNT(o.order_id) AS orders_cnt,
    -- уникальные покупатели: после соединения строки размножены
    COUNT(DISTINCT o.user_id) AS buyers_cnt,
    ROUND(SUM(o.revenue), 2) AS revenue,
    -- средний ЧЕК = среднее по заказам, не по людям
    ROUND(AVG(o.revenue), 2) AS aov
FROM users u
JOIN orders o
  ON o.user_id = u.user_id
 -- фильтр строк: до группировки
 AND o.status = 'paid'
GROUP BY u.city
-- фильтр групп: только после того, как группа собрана
HAVING COUNT(o.order_id) >= 30
ORDER BY revenue DESC;`,

  solutionNote: `
<p><strong>Почему здесь INNER JOIN, а не LEFT.</strong> В отчёте нужны только города с заказами — города с нулём операционному директору не интересны, он и так знает, что там ничего нет. Это осознанный выбор, а не забывчивость: в тикете нет фразы «включая города без заказов».</p>
<p><strong>Что отсеялось.</strong> Новосибирск с 23 заказами не прошёл порог. Полезная привычка: в письме к отчёту одной строкой написать, что именно вы отфильтровали и сколько. Иначе заказчик решит, что в Новосибирске нет продаж вообще.</p>
<p><strong>Проверка.</strong> Сумма <code>orders_cnt</code> по четырём городам — 166, а всего оплаченных заказов 189. Разница 23 — это ровно Новосибирск. Такая арифметика на салфетке ловит ошибки быстрее, чем перечитывание запроса.</p>
`,

  drills: [
    {
      title: "Разные COUNT на одних данных",
      level: "easy",
      body: `<p>Выведите по каждому статусу заказа: <code>rows_cnt</code> (<code>COUNT(*)</code>), <code>revenue_cnt</code> (<code>COUNT(revenue)</code>), <code>users_cnt</code> (уникальные пользователи) и <code>avg_check</code>. Сортировка по <code>rows_cnt</code> убыванием.</p>
<p>Сравните первые два столбца и объясните себе, в каком случае они разошлись бы.</p>`,
      solution: `SELECT
    status,
    COUNT(*) AS rows_cnt,
    COUNT(revenue) AS revenue_cnt,
    COUNT(DISTINCT user_id) AS users_cnt,
    ROUND(AVG(revenue), 2) AS avg_check
FROM orders
GROUP BY status
ORDER BY rows_cnt DESC;`,
      note: `<p>В нашей базе <code>rows_cnt</code> и <code>revenue_cnt</code> совпадают: пропусков в <code>revenue</code> нет. В боевой базе они расходятся почти всегда, и это первый сигнал, что в данных дыры. Полезно завести привычку: делая новый отчёт, один раз сравнить <code>COUNT(*)</code> и <code>COUNT(колонка)</code> по всем ключевым полям.</p>`
    },
    {
      title: "Два средних, которые нельзя путать",
      level: "mid",
      body: `<p>Одним запросом выведите три числа: <code>avg_order</code> — средний чек, <code>avg_per_user</code> — средние траты покупателя, <code>buyers</code> — количество покупателей. Только оплаченные заказы.</p>
<p>Затем ответьте себе: какое число вы назовёте, если продакт спросит «сколько мы зарабатываем с клиента»?</p>`,
      solution: `WITH per_user AS (
    SELECT user_id, SUM(revenue) AS total
    FROM orders
    WHERE status = 'paid'
    GROUP BY user_id
)
SELECT
    ROUND((SELECT AVG(revenue) FROM orders WHERE status = 'paid'), 2) AS avg_order,
    ROUND(AVG(total), 2) AS avg_per_user,
    COUNT(*) AS buyers
FROM per_user;`,
      note: `<p>3 457,30 против 6 282,97 — почти в два раза. На вопрос «сколько мы зарабатываем с клиента» правильный ответ — второе число, и правильное поведение — уточнить период: «6 283 ₽ за девять месяцев наблюдений, но это не LTV, потому что часть клиентов ещё вернётся».</p>`
    },
    {
      title: "Сводная таблица через CASE",
      level: "mid",
      body: `<p>Одной строкой на канал выведите: <code>channel</code>, <code>paid_cnt</code>, <code>refunded_cnt</code>, <code>pending_cnt</code> и <code>refund_rate</code> — долю возвратов от всех заказов канала в процентах с одним знаком.</p>
<p>Здесь пригодится <code>SUM(CASE WHEN ... THEN 1 ELSE 0 END)</code>.</p>`,
      solution: `SELECT
    u.channel,
    SUM(CASE WHEN o.status = 'paid'     THEN 1 ELSE 0 END) AS paid_cnt,
    SUM(CASE WHEN o.status = 'refunded' THEN 1 ELSE 0 END) AS refunded_cnt,
    SUM(CASE WHEN o.status = 'pending'  THEN 1 ELSE 0 END) AS pending_cnt,
    ROUND(
        SUM(CASE WHEN o.status = 'refunded' THEN 1 ELSE 0 END) * 100.0 / COUNT(*),
    1) AS refund_rate
FROM users u
JOIN orders o ON o.user_id = u.user_id
GROUP BY u.channel
ORDER BY refund_rate DESC;`,
      note: `<p>Обратите внимание на <code>100.0</code>, а не <code>100</code>: в SQLite деление двух целых даёт целое, и без точки вы получите нули вместо процентов. Это одна из самых обидных ошибок — запрос отрабатывает, отчёт уходит, а в нём везде 0.</p>`
    },
    {
      title: "Матрица платформа × статус",
      level: "mid",
      body: `<p>Выведите <code>platform</code>, <code>status</code>, <code>orders_cnt</code>, <code>revenue</code>. Сортировка по платформе, затем по статусу.</p>
<p>Посчитайте, сколько строк получилось, и сравните с 3 × 3 = 9. Если строк меньше — какие комбинации отсутствуют и почему это опасно для отчёта?</p>`,
      solution: `SELECT
    u.platform,
    o.status,
    COUNT(*) AS orders_cnt,
    ROUND(SUM(o.revenue), 2) AS revenue
FROM users u
JOIN orders o ON o.user_id = u.user_id
GROUP BY u.platform, o.status
ORDER BY u.platform, o.status;`,
      note: `<p>SQL не придумывает строки, которых нет в данных. Если бизнес ждёт полную матрицу, её надо строить явно: сделать декартово произведение справочников платформ и статусов и присоединить к нему факты через <code>LEFT JOIN</code>. Это тот же приём, что и в уроке 1.1 с каналом <code>partner</code>.</p>`
    },
    {
      title: "Медиана без встроенной функции",
      level: "hard",
      body: `<p>В SQLite нет функции медианы. При этом медианный чек честнее среднего: один заказ на 10 177 ₽ тянет среднее вверх.</p>
<p>Посчитайте медианный чек по оплаченным заказам (<code>median_check</code>) и сравните со средним. Подсказка: отсортируйте суммы, пронумеруйте их и возьмите середину — для чётного количества это среднее двух центральных значений.</p>`,
      solution: `WITH ordered AS (
    SELECT
        revenue,
        ROW_NUMBER() OVER (ORDER BY revenue) AS rn,
        COUNT(*) OVER () AS total
    FROM orders
    WHERE status = 'paid'
)
SELECT
    ROUND(AVG(revenue), 2) AS median_check
FROM ordered
-- для нечётного n берётся одна центральная строка,
-- для чётного — две, и AVG усредняет их
WHERE rn IN ((total + 1) / 2, (total + 2) / 2);`,
      note: `<p>Медиана — 2 997,20 против среднего 3 457,30. Разрыв в 15% означает, что распределение чеков скошено вправо: много мелких заказов и хвост крупных. В отчётах про деньги почти всегда стоит показывать оба числа: среднее отвечает на вопрос «сколько всего денег делить на всех», медиана — «как выглядит типичный заказ».</p>`
    }
  ],

  quiz: [
    {
      q: "Где должно стоять условие «выручка группы больше 100 000»?",
      opts: ["В HAVING", "В ON", "В WHERE", "В ORDER BY"],
      right: 0,
      why: "Это условие по агрегату, а агрегаты появляются только после <code>GROUP BY</code>. В <code>WHERE</code> его написать физически нельзя — на том шаге групп ещё нет."
    },
    {
      q: "Суммы заказов: 100, 200, NULL, NULL, 300. Что вернёт AVG(revenue)?",
      opts: ["600", "200", "120", "NULL"],
      right: 1,
      why: "<code>AVG</code> делит сумму на число <em>непустых</em> значений: 600 / 3 = 200. Если пропуски по смыслу равны нулю, нужно <code>AVG(COALESCE(revenue, 0))</code> — тогда будет 120."
    },
    {
      q: "Средний чек — 3 457 ₽, средние траты клиента — 6 283 ₽. Что это значит?",
      opts: [
        "Одно из чисел посчитано с ошибкой",
        "Клиенты покупают в среднем на 6 283 ₽ за один раз",
        "На клиента приходится в среднем около 1,8 заказа",
        "Часть заказов не учтена"
      ],
      right: 2,
      why: "Отношение 6283 / 3457 ≈ 1,82 — это и есть среднее число заказов на покупателя. Оба числа верны, они просто про разную гранулярность."
    },
    {
      q: "<code>SELECT channel, city, SUM(revenue) FROM ... GROUP BY channel</code> — что не так?",
      opts: [
        "Ничего, запрос корректен",
        "SUM нельзя использовать без HAVING",
        "Нельзя группировать по текстовому полю",
        "city не входит в GROUP BY и не агрегирован — в строгих базах это ошибка"
      ],
      right: 3,
      why: "PostgreSQL вернёт ошибку. SQLite и MySQL молча подставят произвольный город из группы — что хуже: отчёт уйдёт заказчику с неверными данными. Правило: всё, что в <code>SELECT</code> не агрегат, должно быть в <code>GROUP BY</code>."
    },
    {
      q: "Чем плохо <code>SUM(refunded) / COUNT(*) * 100</code> в SQLite, если оба числа целые?",
      opts: [
        "Целочисленное деление даст 0 — нужно умножать на 100.0",
        "SUM не работает с целыми",
        "COUNT(*) нельзя делить",
        "Ничем"
      ],
      right: 0,
      why: "13 / 215 в целочисленной арифметике равно 0, и умножение на 100 уже ничего не спасёт. Пишите <code>* 100.0</code> или <code>CAST(... AS REAL)</code> — привычка, которая экономит час отладки."
    },
    {
      q: "Медианный чек 2 947 ₽ при среднем 3 457 ₽. О чём это говорит?",
      opts: [
        "Половина заказов возвращена",
        "Распределение скошено вправо: есть хвост крупных заказов",
        "О пропусках в данных",
        "Ошибка в запросе"
      ],
      right: 1,
      why: "Среднее чувствительно к выбросам, медиана — нет. Когда среднее заметно выше медианы, у распределения длинный правый хвост. Для денег это норма, и в отчёте полезно показывать оба числа."
    }
  ],

  links: [
    { t: "Aggregate functions в PostgreSQL", url: "https://www.postgresql.org/docs/current/functions-aggregate.html", src: "postgresql.org", lang: "EN",
      d: "Справочник по всем агрегатам с точным описанием поведения на NULL. Держите в закладках — заглядывать придётся часто." },
    { t: "GROUP BY и HAVING — урок с задачами", url: "https://mode.com/sql-tutorial/sql-aggregate-functions/", src: "Mode Analytics", lang: "EN",
      d: "Раздел про агрегаты с интерактивными упражнениями. Хорошо закрывает пробелы, если синтаксис ещё не автоматический." },
    { t: "Задачи на агрегацию", url: "https://sqlbolt.com/lesson/select_queries_with_aggregates", src: "sqlbolt.com", lang: "EN",
      d: "Два коротких урока именно про GROUP BY и HAVING. Пятнадцать минут, зато синтаксис ложится в руки." },
    { t: "Среднее, медиана и когда они врут", url: "https://habr.com/ru/hubs/mathematics/articles/", src: "habr.com", lang: "RU",
      d: "Хаб с разборами базовой статистики на практике. Ищите материалы про смещённые распределения — это ровно про средний чек." },
    { t: "Функции SQLite", url: "https://www.sqlite.org/lang_aggfunc.html", src: "sqlite.org", lang: "EN",
      d: "Список агрегатов вашего движка. Обратите внимание, чего здесь нет: медианы и перцентилей — их придётся собирать руками." }
  ]
};

/* ---------------------------------------------------------- */
/* 1.4 — CTE и читаемость запроса                               */
/* ---------------------------------------------------------- */

window.CONTENT.m1l4 = {
  intro: "Запрос, который понимает коллега за минуту, стоит дороже запроса, который на десять строк короче. CTE — главный инструмент читаемости в SQL.",
  duration: "≈ 2 часа",
  plan: [
    { m: "30 мин", w: "Теория: WITH, шаги, именование, рекурсия" },
    { m: "40 мин", w: "Основная задача: Парето по каналам" },
    { m: "35 мин", w: "Тренажёр: рефакторинг и календарь дат" },
    { m: "10 мин", w: "Самопроверка вопросами" },
    { m: "5 мин",  w: "Заметки" }
  ],

  theory: `
<p class="lead">Через месяц вы не вспомните, что делает ваш собственный запрос на 60 строк с тремя вложенными подзапросами. Через два месяца его придётся править — и это будет дороже, чем написать заново. CTE решает эту проблему.</p>

<h3>Что такое CTE</h3>
<p><code>CTE</code> (Common Table Expression), он же <code>WITH</code>, — это именованный промежуточный результат. Вы говорите базе: «сначала посчитай вот это и назови его <code>paid</code>, потом используй <code>paid</code> дальше».</p>
<pre><code>WITH paid AS (
    SELECT * FROM orders WHERE status = 'paid'
),
per_user AS (
    SELECT user_id, SUM(revenue) AS total
    FROM paid
    GROUP BY user_id
)
SELECT ROUND(AVG(total), 2) AS avg_per_user
FROM per_user;</code></pre>
<p>Читается сверху вниз, как рецепт: отобрали оплаченные → свернули до пользователей → усреднили. Каждый шаг можно запустить отдельно и посмотреть, что получилось.</p>

<div class="cmp">
  <div class="bad">
    <span class="cmp-t">Вложенные подзапросы</span>
<pre><code>SELECT AVG(total) FROM (
  SELECT user_id, SUM(revenue) total
  FROM (
    SELECT * FROM orders
    WHERE status = 'paid'
  ) GROUP BY user_id
);</code></pre>
    <p>Читается изнутри наружу, справа налево. Чтобы понять, что происходит, приходится держать в голове три уровня одновременно.</p>
  </div>
  <div class="good">
    <span class="cmp-t">То же самое через CTE</span>
<pre><code>WITH paid AS (...),
     per_user AS (...)
SELECT AVG(total) FROM per_user;</code></pre>
    <p>Читается сверху вниз. Шаги названы словами, каждый отлаживается отдельно: закомментировали финальный <code>SELECT</code>, написали <code>SELECT * FROM paid</code> — увидели промежуточный результат.</p>
  </div>
</div>

<h3>Как называть шаги</h3>
<p>Имя CTE — это документация. Плохие имена: <code>t1</code>, <code>tmp</code>, <code>a</code>, <code>data</code>. Хорошие: <code>paid_orders</code>, <code>first_purchase</code>, <code>monthly_revenue</code>, <code>users_with_refunds</code>. Правило простое: имя должно отвечать на вопрос «что здесь лежит», а не «какой это по счёту шаг».</p>

<h3>Когда CTE не нужен</h3>
<p>Не превращайте всё подряд в цепочку из семи шагов. Если запрос — это два джойна и группировка, <code>WITH</code> только добавит текста. CTE оправдан, когда:</p>
<ul>
  <li>один и тот же промежуточный набор нужен дважды;</li>
  <li>надо посчитать окно, а потом отфильтровать по нему;</li>
  <li>логика естественно распадается на шаги, у которых есть названия;</li>
  <li>запрос длиннее экрана — тогда почти всегда.</li>
</ul>

<h3>Считаем долю от общего: типовой приём</h3>
<p>Задача «сколько процентов выручки даёт канал» требует двух чисел разной гранулярности: сумму по каналу и сумму по всем. Классическое решение — CTE плюс кросс-джойн с одной строкой:</p>
<pre><code>WITH by_channel AS (
    SELECT channel, SUM(revenue) AS revenue FROM ... GROUP BY channel
),
total AS (
    SELECT SUM(revenue) AS all_revenue FROM by_channel
)
SELECT b.channel,
       ROUND(b.revenue * 100.0 / t.all_revenue, 1) AS share_pct
FROM by_channel b, total t;   -- одна строка справа => просто «подставь константу»</code></pre>
<p>Запись <code>FROM b, t</code> — это <code>CROSS JOIN</code>. Обычно кросс-джойн опасен (он умножает строки), но когда справа гарантированно одна строка, это безопасный и очень удобный способ протащить в запрос общий итог.</p>
<p>Альтернатива — оконная функция <code>SUM(revenue) OVER ()</code>. Она короче, и в этом уроке вы увидите оба способа.</p>

<h3>Рекурсивный CTE: календарь и иерархии</h3>
<p>Рекурсивный <code>WITH RECURSIVE</code> умеет строить последовательности. Самое частое применение у аналитика — календарь дат, чтобы в отчёте не пропадали дни без событий:</p>
<pre><code>WITH RECURSIVE calendar(d) AS (
    SELECT '2024-01-01'                        -- стартовая строка
    UNION ALL
    SELECT date(d, '+1 day') FROM calendar     -- шаг
    WHERE d &lt; '2024-01-31'                     -- условие остановки
)
SELECT * FROM calendar;</code></pre>
<p>Дальше к календарю присоединяют факты через <code>LEFT JOIN</code> — и в графике появляются честные нули вместо разрывов. Второе применение — иерархии: дерево категорий, структура подчинения, цепочка рефералов.</p>

<div class="callout trap">
  <span class="ct">Ловушка</span>
  <p style="margin-bottom:0">У рекурсивного CTE обязательно должно быть условие остановки, иначе запрос будет крутиться, пока не кончится память. Перед первым запуском на боевой базе всегда ставьте <code>LIMIT</code> — он остановит рекурсию, даже если вы ошиблись в условии.</p>
</div>

<div class="callout work">
  <span class="ct">Где это в работе</span>
  <p>Любой рабочий запрос длиннее двадцати строк в нормальной команде написан через CTE — иначе его не примут на ревью. Когда вам скажут «поправь вот этот отчёт», вы откроете чужой запрос, и от того, разбит он на шаги или нет, зависит, потратите вы двадцать минут или полдня. Пишите так, как хотели бы получать.</p>
</div>

<div class="callout jobs">
  <span class="ct">Что закрывает урок в вакансиях</span>
  <ul>
    <li>«SQL: оконные функции, CTE» — вторая половина той самой формулировки</li>
    <li>«Умение писать поддерживаемый код» — то, что отличает джуна с потенциалом</li>
    <li>На интервью часто просят не решить задачу, а <em>объяснить</em> чужой запрос. Навык чтения тренируется тем же, чем навык письма</li>
  </ul>
</div>
`,

  ticket: {
    from: "Ира, performance-маркетинг",
    subj: "Правило Парето по каналам: где сидят наши деньги",
    body: `
<p>Нужна картинка «какая доля выручки приходится на каждый канал и сколько каналов дают первые 80%». Хочу понять, можно ли вообще отключить хвост.</p>
<p>По <strong>оплаченным</strong> заказам собери:</p>
<ul>
  <li><code>channel</code> — канал</li>
  <li><code>revenue</code> — выручка канала, 2 знака</li>
  <li><code>share_pct</code> — доля канала от всей выручки, в процентах, 1 знак</li>
  <li><code>cum_pct</code> — накопленная доля сверху вниз, в процентах, 1 знак</li>
</ul>
<p>Сортировка — по выручке от большей к меньшей. Каналы без оплаченных заказов в этот отчёт не включаем: доля 0% ничего не добавляет.</p>
`
  },

  schema: window.SH.sqlSchema,

  starter: `-- Парето по каналам
-- Шаг 1: выручка по каналам
-- Шаг 2: общая выручка
-- Шаг 3: доля и накопленная доля

WITH by_channel AS (

),
total AS (

)
SELECT
FROM
ORDER BY
`,

  expected: {
    ordered: true,
    columns: ["channel", "revenue", "share_pct", "cum_pct"],
    rows: [
      ["organic", 271926.54, 41.6, 41.6],
      ["paid_search", 141330.95, 21.6, 63.2],
      ["email", 122017.95, 18.7, 81.9],
      ["social", 61776.11, 9.5, 91.4],
      ["referral", 56377.23, 8.6, 100.0]
    ]
  },

  hints: [
    "Нужны два числа разной гранулярности: выручка канала и выручка всех каналов. Второе нельзя получить обычным <code>GROUP BY</code> в том же запросе — оно про другой уровень. Какие два шага напрашиваются в <code>WITH</code>?",
    "Первый CTE — выручка по каналам. Второй — одна строка с общей суммой (её удобно посчитать из первого CTE, а не заново из <code>orders</code>). Дальше соединяете их через <code>FROM by_channel b, total t</code> — справа одна строка, поэтому размножения не будет. Осталось накопление: какая оконная функция даёт нарастающий итог по убыванию выручки?",
    "<code>SUM(b.revenue) OVER (ORDER BY b.revenue DESC)</code>. Делите её на общую сумму и умножаете на <code>100.0</code> — обязательно с точкой, иначе целочисленное деление обнулит проценты. Округляйте <code>ROUND(..., 1)</code>. Каналы без заказов отсекутся сами, если внутри первого CTE соединять через <code>JOIN</code> и фильтровать <code>status = 'paid'</code>."
  ],

  solution: `-- Парето по каналам привлечения
WITH by_channel AS (
    -- Шаг 1: выручка каждого канала.
    -- INNER JOIN: каналы без оплаченных заказов в отчёт не идут
    SELECT
        u.channel,
        SUM(o.revenue) AS revenue
    FROM users u
    JOIN orders o ON o.user_id = u.user_id AND o.status = 'paid'
    GROUP BY u.channel
),
total AS (
    -- Шаг 2: одна строка с общей выручкой.
    -- Считаем из by_channel, а не из orders заново —
    -- так гарантированно тот же набор строк
    SELECT SUM(revenue) AS all_revenue
    FROM by_channel
)
SELECT
    b.channel,
    ROUND(b.revenue, 2) AS revenue,
    ROUND(b.revenue * 100.0 / t.all_revenue, 1) AS share_pct,
    -- накопительный итог по убыванию выручки, делённый на общую сумму
    ROUND(SUM(b.revenue) OVER (ORDER BY b.revenue DESC) * 100.0 / t.all_revenue, 1) AS cum_pct
-- справа ровно одна строка, поэтому это безопасный CROSS JOIN
FROM by_channel b, total t
ORDER BY b.revenue DESC;`,

  solutionNote: `
<p><strong>Что показывает отчёт.</strong> Первые три канала дают 81,9% выручки — классическое Парето. Но вывод «отключаем хвост» из этой таблицы <em>не следует</em>: social и referral могут быть дешёвыми и работать на верх воронки. Прежде чем резать, нужны затраты по каналам. Хороший аналитик приносит таблицу вместе с этой оговоркой.</p>
<p><strong>Альтернатива без второго CTE:</strong></p>
<pre><code>SELECT channel, revenue,
       ROUND(revenue * 100.0 / SUM(revenue) OVER (), 1) AS share_pct,
       ROUND(SUM(revenue) OVER (ORDER BY revenue DESC) * 100.0
             / SUM(revenue) OVER (), 1) AS cum_pct
FROM by_channel
ORDER BY revenue DESC;</code></pre>
<p><code>SUM(...) OVER ()</code> без <code>PARTITION</code> и без <code>ORDER BY</code> — это сумма по всему набору. Короче, но менее очевидно для читателя. Оба варианта правильные; выбирайте тот, который поймёт ваша команда.</p>
`,

  drills: [
    {
      title: "Прочитать чужой запрос",
      level: "easy",
      body: `<p>Вот запрос, который вам достался по наследству. Не запуская его, скажите словами, что он считает. Потом запустите и проверьте себя.</p>
<pre><code>SELECT AVG(c) FROM (
  SELECT user_id, COUNT(*) AS c
  FROM orders
  WHERE status = 'paid'
  GROUP BY user_id
);</code></pre>
<p>Затем перепишите его через <code>WITH</code> с осмысленными именами.</p>`,
      solution: `-- Считает среднее количество оплаченных заказов на одного покупателя
WITH orders_per_buyer AS (
    SELECT
        user_id,
        COUNT(*) AS orders_cnt
    FROM orders
    WHERE status = 'paid'
    GROUP BY user_id
)
SELECT ROUND(AVG(orders_cnt), 2) AS avg_orders_per_buyer
FROM orders_per_buyer;`,
      note: `<p>Ответ — 1,82 заказа на покупателя. Обратите внимание, насколько понятнее стал запрос после переименования <code>c</code> в <code>orders_cnt</code>: имя столбца сделало половину работы комментария.</p>`
    },
    {
      title: "Календарь дат без дыр",
      level: "mid",
      body: `<p>В июле 2024 были дни без заказов. Постройте таблицу всех дней июля с количеством оплаченных заказов: <code>d</code>, <code>orders_cnt</code> — с нулями в пустых днях.</p>
<p>Понадобится <code>WITH RECURSIVE</code> для календаря и <code>LEFT JOIN</code> к заказам.</p>`,
      solution: `WITH RECURSIVE calendar(d) AS (
    SELECT '2024-07-01'
    UNION ALL
    SELECT date(d, '+1 day')
    FROM calendar
    WHERE d < '2024-07-31'
)
SELECT
    c.d,
    COUNT(o.order_id) AS orders_cnt
FROM calendar c
LEFT JOIN orders o
       ON o.order_date = c.d
      AND o.status = 'paid'
GROUP BY c.d
ORDER BY c.d;`,
      note: `<p>Без календаря график «заказы по дням» просто соединил бы соседние точки прямой линией через пустые дни, и провал стал бы незаметен. Это одна из самых частых причин, по которым дашборд выглядит красивее, чем реальность.</p>`
    },
    {
      title: "Один CTE, использованный дважды",
      level: "mid",
      body: `<p>Выведите одной строкой: <code>buyers</code> — сколько пользователей сделали хотя бы один оплаченный заказ, <code>repeat_buyers</code> — сколько сделали два и больше, <code>repeat_rate</code> — доля повторных в процентах с одним знаком.</p>
<p>Здесь один и тот же промежуточный набор нужен трижды — ровно тот случай, ради которого существует <code>WITH</code>.</p>`,
      solution: `WITH per_buyer AS (
    SELECT
        user_id,
        COUNT(*) AS orders_cnt
    FROM orders
    WHERE status = 'paid'
    GROUP BY user_id
)
SELECT
    COUNT(*) AS buyers,
    SUM(CASE WHEN orders_cnt >= 2 THEN 1 ELSE 0 END) AS repeat_buyers,
    ROUND(
        SUM(CASE WHEN orders_cnt >= 2 THEN 1 ELSE 0 END) * 100.0 / COUNT(*),
    1) AS repeat_rate
FROM per_buyer;`,
      note: `<p>Repeat rate — одна из первых метрик, которые спрашивают у аналитика в e-commerce. Здесь получается 47,1%: из 104 покупателей 49 вернулись за вторым заказом. Полезная привычка — рядом с процентом всегда писать знаменатель, иначе 50% от 4 человек выглядят как достижение.</p>`
    },
    {
      title: "Рефакторинг монолита",
      level: "hard",
      body: `<p>Перепишите этот запрос через CTE так, чтобы каждый шаг имел имя, а вложенность исчезла. Логику менять нельзя — только форму.</p>
<pre><code>SELECT u.channel,
       COUNT(DISTINCT u.user_id) AS buyers,
       ROUND(SUM(x.total), 2) AS revenue
FROM users u
JOIN (SELECT user_id, SUM(revenue) AS total
      FROM orders
      WHERE status = 'paid'
        AND order_date >= '2024-04-01'
      GROUP BY user_id
      HAVING SUM(revenue) > 5000) x
  ON x.user_id = u.user_id
GROUP BY u.channel
ORDER BY revenue DESC;</code></pre>`,
      solution: `WITH spring_orders AS (
    -- шаг 1: оплаченные заказы начиная с апреля
    SELECT user_id, revenue
    FROM orders
    WHERE status = 'paid'
      AND order_date >= '2024-04-01'
),
big_spenders AS (
    -- шаг 2: покупатели, потратившие больше 5000
    SELECT
        user_id,
        SUM(revenue) AS total
    FROM spring_orders
    GROUP BY user_id
    HAVING SUM(revenue) > 5000
)
-- шаг 3: раскладываем их по каналам привлечения
SELECT
    u.channel,
    COUNT(DISTINCT u.user_id) AS buyers,
    ROUND(SUM(b.total), 2) AS revenue
FROM users u
JOIN big_spenders b ON b.user_id = u.user_id
GROUP BY u.channel
ORDER BY revenue DESC;`,
      note: `<p>Результат тот же, но теперь видно, что запрос отвечает на вопрос «из каких каналов приходят крупные клиенты весны». Название <code>big_spenders</code> сообщает это за секунду — а подзапрос с алиасом <code>x</code> заставлял читателя разбираться минуту.</p>`
    },
    {
      title: "Доля города внутри канала",
      level: "hard",
      body: `<p>Для каждого канала выведите город с наибольшей выручкой: <code>channel</code>, <code>city</code>, <code>revenue</code>, <code>share_in_channel</code> — какую долю выручки канала даёт этот город, в процентах с одним знаком.</p>
<p>Понадобятся два окна: одно для доли, второе для выбора лидера.</p>`,
      solution: `WITH by_pair AS (
    SELECT
        u.channel,
        u.city,
        SUM(o.revenue) AS revenue
    FROM users u
    JOIN orders o ON o.user_id = u.user_id AND o.status = 'paid'
    GROUP BY u.channel, u.city
),
with_share AS (
    SELECT
        channel,
        city,
        revenue,
        ROUND(revenue * 100.0 / SUM(revenue) OVER (PARTITION BY channel), 1) AS share_in_channel,
        ROW_NUMBER() OVER (PARTITION BY channel ORDER BY revenue DESC) AS rn
    FROM by_pair
)
SELECT channel, city, ROUND(revenue, 2) AS revenue, share_in_channel
FROM with_share
WHERE rn = 1
ORDER BY revenue DESC;`,
      note: `<p>Два окна с разными спецификациями в одном <code>SELECT</code> — нормальная практика. Здесь одно считает долю по всей партиции канала, второе ранжирует города внутри той же партиции. Если доля лидера превышает 50%, канал зависим от одного города, и это отдельный риск для планирования.</p>`
    }
  ],

  quiz: [
    {
      q: "В чём главное преимущество CTE перед вложенным подзапросом?",
      opts: [
        "CTE всегда работает быстрее",
        "В подзапросах нельзя использовать JOIN",
        "Запрос читается сверху вниз, шаги имеют имена и отлаживаются по отдельности",
        "CTE позволяет обойтись без GROUP BY"
      ],
      right: 2,
      why: "Скорость чаще всего одинаковая — оптимизатор разворачивает CTE в тот же план. Выигрыш в читаемости и отладке: любой шаг можно выполнить отдельно и посмотреть, что получилось."
    },
    {
      q: "Что произойдёт при <code>FROM by_channel b, total t</code>, если в total одна строка?",
      opts: [
        "Останется одна строка",
        "Ошибка: нужен явный JOIN",
        "Строки перемешаются случайным образом",
        "Каждая строка by_channel получит значения из total — это безопасный CROSS JOIN"
      ],
      right: 3,
      why: "Кросс-джойн умножает строки: N × 1 = N. Именно поэтому приём безопасен только когда справа гарантированно одна строка. Если их станет две, результат молча удвоится."
    },
    {
      q: "Чего обязательно не хватает рекурсивному CTE <code>WITH RECURSIVE cal(d) AS (SELECT '2024-01-01' UNION ALL SELECT date(d,'+1 day') FROM cal)</code>?",
      opts: ["Условия остановки в WHERE", "Второго столбца", "Ключевого слова ALL", "ORDER BY"],
      right: 0,
      why: "Без <code>WHERE d &lt; '...'</code> рекурсия не закончится никогда. На боевой базе такой запрос съест память и уронит сессию — перед первым запуском всегда ставьте <code>LIMIT</code>."
    },
    {
      q: "Когда CTE лишний?",
      opts: [
        "Когда в запросе есть JOIN",
        "Когда запрос короткий и логика не распадается на именуемые шаги",
        "Когда данных больше миллиона строк",
        "Всегда, подзапросы лучше"
      ],
      right: 1,
      why: "Читаемость — цель, а не сам по себе <code>WITH</code>. Два джойна и группировка в цепочке из четырёх CTE читаются хуже, чем один прямой запрос."
    },
    {
      q: "<code>SUM(revenue) OVER ()</code> без PARTITION и ORDER BY вернёт:",
      opts: [
        "Накопительный итог",
        "Ошибку",
        "Сумму по всему набору строк, одинаковую в каждой строке",
        "Сумму по текущей группе GROUP BY"
      ],
      right: 2,
      why: "Пустое окно означает «весь набор». Это самый короткий способ протащить общий итог в каждую строку — альтернатива CTE с одной строкой и кросс-джойном."
    }
  ],

  links: [
    { t: "WITH Queries (CTE) — документация", url: "https://www.postgresql.org/docs/current/queries-with.html", src: "postgresql.org", lang: "EN",
      d: "Официальный разбор с примерами рекурсии. Раздел про recursive query evaluation объясняет, что именно происходит на каждом шаге." },
    { t: "WITH в SQLite", url: "https://www.sqlite.org/lang_with.html", src: "sqlite.org", lang: "EN",
      d: "Диалект курса. Отдельно посмотрите примеры с деревьями и генерацией последовательностей — они там очень наглядные." },
    { t: "SQL Style Guide", url: "https://www.sqlstyle.guide/", src: "sqlstyle.guide", lang: "EN",
      d: "Договорённости по форматированию: отступы, регистр, имена. Прочитать один раз и начать писать так же — заметно поднимает впечатление на код-ревью." },
    { t: "Как оформлять запросы в dbt-проектах", url: "https://docs.getdbt.com/best-practices/how-we-style/2-how-we-style-our-sql", src: "docs.getdbt.com", lang: "EN",
      d: "dbt — стандарт де-факто в аналитических командах. Их гайд по стилю SQL — это то, как будет выглядеть код на вашей будущей работе." },
    { t: "Курс SQL для анализа данных", url: "https://mode.com/sql-tutorial/sql-sub-queries/", src: "Mode Analytics", lang: "EN",
      d: "Раздел про подзапросы и CTE с задачами. Полезно прорешать, чтобы разница между ними перестала быть теоретической." }
  ]
};

/* ---------------------------------------------------------- */
/* 1.5 — подзапросы и когда они лишние                          */
/* ---------------------------------------------------------- */

window.CONTENT.m1l5 = {
  intro: "IN, EXISTS, скалярный и коррелированный подзапросы. Разбираем, где подзапрос — единственное решение, а где он просто медленнее джойна.",
  duration: "≈ 2 часа",
  plan: [
    { m: "30 мин", w: "Теория: четыре вида подзапросов и NOT IN с NULL" },
    { m: "40 мин", w: "Основная задача: клиенты выше среднего" },
    { m: "35 мин", w: "Тренажёр: EXISTS, коррелированные, скалярные" },
    { m: "10 мин", w: "Самопроверка вопросами" },
    { m: "5 мин",  w: "Заметки" }
  ],

  theory: `
<p class="lead">Подзапрос — это запрос внутри запроса. Их четыре вида, и путаница между ними даёт и неверные результаты, и запросы, которые висят по десять минут там, где хватило бы секунды.</p>

<h3>Четыре места, где живёт подзапрос</h3>
<table>
  <tr><th>Где стоит</th><th>Что возвращает</th><th>Пример задачи</th></tr>
  <tr><td>в <code>SELECT</code></td><td>ровно одно значение (скалярный)</td><td>«сколько процентов от общей выручки»</td></tr>
  <tr><td>в <code>WHERE ... IN</code></td><td>список значений</td><td>«только те пользователи, кто покупал»</td></tr>
  <tr><td>в <code>WHERE ... EXISTS</code></td><td>да или нет</td><td>«есть ли у него хоть один возврат»</td></tr>
  <tr><td>в <code>FROM</code></td><td>таблицу</td><td>любой промежуточный шаг — но лучше CTE</td></tr>
</table>

<h3>Скалярный подзапрос</h3>
<pre><code>SELECT
    channel,
    SUM(revenue) AS revenue,
    ROUND(SUM(revenue) * 100.0 /
          (SELECT SUM(revenue) FROM orders WHERE status = 'paid'), 1) AS share_pct
FROM ...</code></pre>
<p>Подзапрос в скобках возвращает одно число, и оно подставляется как константа. Удобно, но есть подвох: если подзапрос вдруг вернёт две строки, база упадёт с ошибкой. И второй, менее очевидный: фильтры основного запроса на него <strong>не действуют</strong>. Здесь пришлось повторить <code>status = 'paid'</code> внутри — забудете, и доли не сойдутся к 100%.</p>

<h3>IN против EXISTS</h3>
<pre><code>-- IN: сначала собирается список, потом идёт проверка вхождения
SELECT * FROM users
WHERE user_id IN (SELECT user_id FROM orders WHERE status = 'paid');

-- EXISTS: для каждой строки проверяется «нашлась ли хоть одна»
SELECT * FROM users u
WHERE EXISTS (SELECT 1 FROM orders o
              WHERE o.user_id = u.user_id AND o.status = 'paid');</code></pre>
<p>На современных базах разница в скорости почти стёрлась — оптимизатор приводит оба к одному плану. Но есть смысловая разница, из-за которой <code>EXISTS</code> безопаснее.</p>

<div class="callout trap">
  <span class="ct">Главная ловушка урока: NOT IN и NULL</span>
  <p>Если подзапрос вернёт хотя бы один <code>NULL</code>, конструкция <code>NOT IN</code> вернёт <strong>пустой результат</strong>. Всегда. Молча.</p>
<pre><code>-- если в orders есть хоть одна строка с user_id = NULL,
-- этот запрос вернёт 0 строк вместо списка неактивных
SELECT * FROM users
WHERE user_id NOT IN (SELECT user_id FROM orders);</code></pre>
  <p>Причина: <code>x NOT IN (1, 2, NULL)</code> разворачивается в <code>x &lt;&gt; 1 AND x &lt;&gt; 2 AND x &lt;&gt; NULL</code>, а последнее — «неизвестно». Всё выражение перестаёт быть истинным.</p>
  <p style="margin-bottom:0"><strong>Вывод:</strong> для «чего нет» используйте <code>NOT EXISTS</code> или <code>LEFT JOIN ... IS NULL</code>. <code>NOT IN</code> — только когда вы точно знаете, что <code>NULL</code> там быть не может.</p>
</div>

<h3>Коррелированный подзапрос</h3>
<p>Коррелированный — тот, который ссылается на внешний запрос и потому выполняется для каждой строки:</p>
<pre><code>SELECT o.user_id, o.order_id, o.order_date
FROM orders o
WHERE o.order_date = (
    SELECT MAX(o2.order_date)      -- o ссылается наружу => подзапрос
    FROM orders o2                 -- пересчитывается на каждой строке
    WHERE o2.user_id = o.user_id
);</code></pre>
<p>Это «последний заказ каждого пользователя». Работает, читается неплохо, но на миллионе строк выполняется миллион раз. Тот же результат через окно считается за один проход:</p>
<pre><code>WITH ranked AS (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY order_date DESC) AS rn
    FROM orders
)
SELECT * FROM ranked WHERE rn = 1;</code></pre>
<p><strong>Правило выбора:</strong> если задача звучит как «для каждой строки посмотри на её группу» — берите окно. Коррелированный подзапрос оставьте для случаев, где окна не хватает или где данных мало и читаемость важнее.</p>

<h3>Когда подзапрос лишний</h3>
<div class="cmp">
  <div class="bad">
    <span class="cmp-t">Так пишут по привычке</span>
<pre><code>SELECT * FROM users
WHERE user_id IN (
  SELECT user_id FROM orders
  WHERE status = 'paid'
);</code></pre>
    <p>Работает. Но если дальше понадобится ещё и сумма заказов, придётся всё переписывать: из <code>IN</code> нельзя достать поля.</p>
  </div>
  <div class="good">
    <span class="cmp-t">Джойн даёт больше</span>
<pre><code>SELECT u.*, SUM(o.revenue) AS revenue
FROM users u
JOIN orders o
  ON o.user_id = u.user_id
 AND o.status = 'paid'
GROUP BY u.user_id;</code></pre>
    <p>Тот же фильтр «только покупатели» плюс доступ к данным заказов. Обычно именно это и просят следующим вопросом.</p>
  </div>
</div>
<p>Обратная сторона: если из правой таблицы вам ничего не нужно, а строки могут размножиться, — <code>EXISTS</code> честнее джойна, потому что не требует потом городить <code>DISTINCT</code>.</p>

<div class="callout work">
  <span class="ct">Где это в работе</span>
  <p>«Покажи клиентов, которые купили в первый раз, но не вернулись», «сегменты, где конверсия выше средней по базе», «пользователи, у которых был хотя бы один возврат» — все три формулировки решаются подзапросами. Особенно часто нужен приём «сравнить строку со средним по всей выборке»: без подзапроса или окна его не написать.</p>
</div>

<div class="callout jobs">
  <span class="ct">Что закрывает урок в вакансиях</span>
  <ul>
    <li>«JOIN, GROUP BY, подзапросы» — третья часть стандартной формулировки</li>
    <li>Задача с интервью: «найди пользователей, потративших больше среднего»</li>
    <li>Вопрос-ловушка: «чем NOT IN отличается от NOT EXISTS» — отличный способ отличить того, кто писал SQL на проде</li>
  </ul>
</div>
`,

  ticket: {
    from: "Костя, продакт",
    subj: "Кто у нас крупные клиенты",
    body: `
<p>Хочу понять, есть ли у нас ядро клиентов, которое тащит выручку. Нужен список тех, кто потратил <strong>больше среднего по всем покупателям</strong>.</p>
<p>Важно: среднее считаем не по заказам, а <strong>по покупателям</strong> — сначала суммируем траты каждого, потом усредняем эти суммы. Берём только оплаченные заказы.</p>
<p>Столбцы: <code>user_id</code>, <code>channel</code>, <code>orders_cnt</code>, <code>revenue</code> (2 знака). Сортировка по выручке убыванием, покажи <strong>первые 12</strong>.</p>
`
  },

  schema: window.SH.sqlSchema,

  starter: `-- Клиенты, потратившие больше среднего покупателя
-- Подумайте: среднее чего вам нужно и на каком уровне его считать

SELECT
    u.user_id,
    u.channel
    -- остальное
FROM users u
JOIN orders o ON
GROUP BY u.user_id, u.channel
HAVING
ORDER BY revenue DESC
LIMIT 12;
`,

  expected: {
    ordered: true,
    columns: ["user_id", "channel", "orders_cnt", "revenue"],
    rows: [
      [103, "organic", 4, 17772.89],
      [14, "email", 4, 17683.24],
      [80, "organic", 3, 15780.77],
      [195, "organic", 4, 15687.37],
      [3, "organic", 4, 15301.00],
      [13, "organic", 4, 15252.32],
      [156, "email", 2, 13441.87],
      [67, "organic", 4, 13068.07],
      [205, "email", 2, 12974.35],
      [217, "organic", 2, 12349.75],
      [215, "paid_search", 4, 12250.35],
      [91, "referral", 2, 12074.35]
    ]
  },

  hints: [
    "Порог — это одно число, которое нужно посчитать отдельно: «средняя сумма трат покупателя». Обратите внимание, что это <em>не</em> <code>AVG(revenue)</code> по таблице заказов. Как получить сначала сумму по каждому покупателю, а потом среднее этих сумм?",
    "Двухуровневый подзапрос: <code>SELECT AVG(total) FROM (SELECT SUM(revenue) AS total FROM orders WHERE status = 'paid' GROUP BY user_id)</code>. Получится 6 282,97. Теперь второй вопрос: куда поставить сравнение с этим порогом, если сравнивать надо сумму по группе?",
    "В <code>HAVING</code> — условие по агрегату. Целиком: <code>HAVING SUM(o.revenue) &gt; (подзапрос)</code>. Скалярный подзапрос вычисляется один раз и подставляется как константа. Не забудьте <code>status = 'paid'</code> и в основном запросе, и внутри подзапроса: фильтры внешнего запроса на подзапрос не распространяются."
  ],

  solution: `-- Клиенты, потратившие больше среднего покупателя
SELECT
    u.user_id,
    u.channel,
    COUNT(o.order_id) AS orders_cnt,
    ROUND(SUM(o.revenue), 2) AS revenue
FROM users u
JOIN orders o
  ON o.user_id = u.user_id
 AND o.status = 'paid'
GROUP BY u.user_id, u.channel
-- порог: средняя сумма трат ОДНОГО покупателя.
-- Внутренний запрос сворачивает заказы до пользователей,
-- внешний AVG усредняет уже эти суммы
HAVING SUM(o.revenue) > (
    SELECT AVG(total)
    FROM (
        SELECT SUM(revenue) AS total
        FROM orders
        WHERE status = 'paid'      -- фильтр обязан повториться здесь
        GROUP BY user_id
    )
)
ORDER BY revenue DESC
LIMIT 12;`,

  solutionNote: `
<p><strong>Почему нельзя было написать просто <code>AVG(revenue)</code>.</strong> Это дало бы средний чек — 3 457 ₽. Порог оказался бы почти вдвое ниже, и в «крупные клиенты» попала бы половина базы. Разница между «средним по заказам» и «средним по клиентам» здесь напрямую меняет управленческий вывод.</p>
<p><strong>Вариант через CTE — читается лучше:</strong></p>
<pre><code>WITH per_user AS (
    SELECT user_id, SUM(revenue) AS total
    FROM orders WHERE status = 'paid'
    GROUP BY user_id
),
threshold AS (SELECT AVG(total) AS avg_total FROM per_user)
SELECT p.user_id, u.channel, p.total
FROM per_user p
JOIN users u ON u.user_id = p.user_id, threshold t
WHERE p.total > t.avg_total
ORDER BY p.total DESC;</code></pre>
<p><strong>Что сказать продакту вместе с таблицей:</strong> выше среднего оказались 38 покупателей из 104, то есть больше трети. Это значит, что распределение хоть и скошено, но «ядра из 5 клиентов» у нас нет — бизнес не зависит от нескольких имён. Такой вывод стоит дороже самой таблицы.</p>
`,

  drills: [
    {
      title: "Покупатели через EXISTS",
      level: "easy",
      body: `<p>Выведите <code>user_id</code>, <code>channel</code>, <code>city</code> тех пользователей, у кого есть хотя бы один <strong>оплаченный</strong> заказ. Используйте <code>EXISTS</code>, а не джойн. Сортировка по <code>user_id</code>, первые 10 строк.</p>
<p>Вопрос на подумать: почему здесь не нужен <code>DISTINCT</code>, хотя у пользователя может быть четыре заказа?</p>`,
      solution: `SELECT u.user_id, u.channel, u.city
FROM users u
WHERE EXISTS (
    SELECT 1
    FROM orders o
    WHERE o.user_id = u.user_id
      AND o.status = 'paid'
)
ORDER BY u.user_id
LIMIT 10;`,
      note: `<p><code>EXISTS</code> — это проверка «да/нет», он не присоединяет строки и потому не размножает результат. Именно поэтому <code>DISTINCT</code> не нужен. Внутри пишут <code>SELECT 1</code>: содержимое не используется, база проверяет только факт наличия строки.</p>`
    },
    {
      title: "NOT EXISTS против NOT IN",
      level: "mid",
      body: `<p>Найдите пользователей без единого оплаченного заказа: <code>user_id</code>, <code>channel</code>. Напишите два варианта — через <code>NOT EXISTS</code> и через <code>NOT IN</code> — и убедитесь, что на этих данных они совпадают.</p>
<p>Затем объясните себе, при каком условии в данных второй вариант вернул бы ноль строк.</p>`,
      solution: `-- Вариант 1: NOT EXISTS — безопасный всегда
SELECT u.user_id, u.channel
FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM orders o
    WHERE o.user_id = u.user_id AND o.status = 'paid'
)
ORDER BY u.user_id;

-- Вариант 2: NOT IN — сломается, если в подзапросе появится NULL
SELECT u.user_id, u.channel
FROM users u
WHERE u.user_id NOT IN (
    SELECT user_id FROM orders WHERE status = 'paid'
)
ORDER BY u.user_id;`,
      note: `<p>Здесь оба дают 116 строк, потому что <code>orders.user_id</code> объявлен <code>NOT NULL</code>. Стоит появиться хотя бы одной строке с пустым <code>user_id</code> — и второй запрос вернёт ноль строк, не выдав ни ошибки, ни предупреждения. Это классический баг, который живёт в отчётах месяцами.</p>`
    },
    {
      title: "Последний заказ каждого клиента",
      level: "mid",
      body: `<p>Для пользователей 3, 13, 103 и 215 выведите их <strong>последний оплаченный</strong> заказ: <code>user_id</code>, <code>order_id</code>, <code>order_date</code>, <code>revenue</code>.</p>
<p>Сначала напишите через коррелированный подзапрос, потом — через оконную функцию. Сравните оба варианта на читаемость.</p>`,
      solution: `-- Вариант 1: коррелированный подзапрос
SELECT o.user_id, o.order_id, o.order_date, ROUND(o.revenue, 2) AS revenue
FROM orders o
WHERE o.status = 'paid'
  AND o.user_id IN (3, 13, 103, 215)
  AND o.order_date = (
      SELECT MAX(o2.order_date)
      FROM orders o2
      WHERE o2.user_id = o.user_id AND o2.status = 'paid'
  )
ORDER BY o.user_id;

-- Вариант 2: оконная функция — один проход по данным
WITH ranked AS (
    SELECT
        user_id, order_id, order_date, revenue,
        ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY order_date DESC, order_id DESC) AS rn
    FROM orders
    WHERE status = 'paid'
)
SELECT user_id, order_id, order_date, ROUND(revenue, 2) AS revenue
FROM ranked
WHERE rn = 1 AND user_id IN (3, 13, 103, 215)
ORDER BY user_id;`,
      note: `<p>У первого варианта есть скрытая проблема: если у пользователя два заказа в один и тот же день, он вернёт обе строки. Оконный вариант с <code>ROW_NUMBER</code> гарантированно даёт ровно одну. На собеседовании это хороший повод показать, что вы думаете про краевые случаи.</p>`
    },
    {
      title: "Доля канала скалярным подзапросом",
      level: "mid",
      body: `<p>Повторите отчёт Парето из прошлого урока, но без CTE: посчитайте <code>channel</code>, <code>revenue</code> и <code>share_pct</code>, взяв общую выручку скалярным подзапросом прямо в <code>SELECT</code>.</p>
<p>Проверьте, что сумма долей даёт 100,0 — если нет, ищите разницу в фильтрах.</p>`,
      solution: `SELECT
    u.channel,
    ROUND(SUM(o.revenue), 2) AS revenue,
    ROUND(
        SUM(o.revenue) * 100.0 /
        -- фильтр повторяем: внешний WHERE сюда не действует
        (SELECT SUM(revenue) FROM orders WHERE status = 'paid'),
    1) AS share_pct
FROM users u
JOIN orders o ON o.user_id = u.user_id AND o.status = 'paid'
GROUP BY u.channel
ORDER BY revenue DESC;`,
      note: `<p>Если убрать <code>status = 'paid'</code> внутри подзапроса, знаменатель станет 765 476 вместо 653 429, и сумма долей даст 85,4% вместо 100%. Отчёт при этом не упадёт — просто соврёт. Проверка «сумма долей равна 100» должна стать вашим рефлексом.</p>`
    },
    {
      title: "Каналы с конверсией выше средней",
      level: "hard",
      body: `<p>Выведите каналы, у которых конверсия в покупку выше средней по базе: <code>channel</code>, <code>users_cnt</code>, <code>buyers_cnt</code>, <code>cr</code> (в процентах, 1 знак).</p>
<p>Средняя по базе — это общее число покупателей, делённое на общее число пользователей, а не среднее из конверсий каналов. Разница принципиальная: подумайте, почему.</p>`,
      solution: `WITH by_channel AS (
    SELECT
        u.channel,
        COUNT(DISTINCT u.user_id) AS users_cnt,
        COUNT(DISTINCT o.user_id) AS buyers_cnt
    FROM users u
    LEFT JOIN orders o ON o.user_id = u.user_id AND o.status = 'paid'
    GROUP BY u.channel
)
SELECT
    channel,
    users_cnt,
    buyers_cnt,
    ROUND(buyers_cnt * 100.0 / users_cnt, 1) AS cr
FROM by_channel
WHERE buyers_cnt * 1.0 / users_cnt > (
    -- средневзвешенная конверсия: все покупатели / все пользователи
    SELECT COUNT(DISTINCT o.user_id) * 1.0 / (SELECT COUNT(*) FROM users)
    FROM orders o WHERE o.status = 'paid'
)
ORDER BY cr DESC;`,
      note: `<p>Средняя по базе — 47,3%. Среднее арифметическое из конверсий каналов дало бы другое число, потому что каналы разного размера: <code>partner</code> с шестью пользователями весит столько же, сколько <code>organic</code> с семьюдесятью пятью. Когда сравниваете сегмент «со средним», всегда уточняйте, со средним <em>чего</em>.</p>`
    }
  ],

  quiz: [
    {
      q: "<code>WHERE user_id NOT IN (SELECT user_id FROM orders)</code>, и в orders есть строка с NULL в user_id. Что вернёт запрос?",
      opts: ["Всех пользователей", "Только тех, у кого нет заказов", "Ошибку", "Ноль строк"],
      right: 3,
      why: "<code>NOT IN</code> со списком, содержащим <code>NULL</code>, никогда не даёт TRUE: сравнение с <code>NULL</code> возвращает «неизвестно». Запрос молча вернёт пустой результат. Используйте <code>NOT EXISTS</code>."
    },
    {
      q: "Чем коррелированный подзапрос отличается от обычного?",
      opts: [
        "Он ссылается на внешний запрос и потому вычисляется для каждой строки",
        "Он пишется только в FROM",
        "Он может возвращать только одно значение",
        "Он всегда быстрее"
      ],
      right: 0,
      why: "Именно из-за пересчёта на каждой строке коррелированные подзапросы плохо масштабируются. Часто тот же результат даёт оконная функция за один проход."
    },
    {
      q: "Скалярный подзапрос в SELECT вернул две строки. Что будет?",
      opts: ["Вернётся NULL", "Ошибка выполнения", "Возьмётся первая", "Строки перемножатся"],
      right: 1,
      why: "Скалярный контекст требует ровно одного значения. Это, кстати, полезное свойство: база сама поймает вашу ошибку вместо того, чтобы тихо подставить не то число."
    },
    {
      q: "Почему после <code>WHERE EXISTS (...)</code> не нужен DISTINCT?",
      opts: [
        "Потому что внутри написано SELECT 1",
        "EXISTS автоматически убирает дубликаты",
        "EXISTS не присоединяет строки, а только проверяет факт наличия",
        "DISTINCT нужен всегда"
      ],
      right: 2,
      why: "Результат <code>EXISTS</code> — булево значение для строки внешнего запроса. Размножения не происходит в принципе, в отличие от <code>JOIN</code>."
    },
    {
      q: "Внешний запрос фильтрует <code>status = 'paid'</code>. Действует ли этот фильтр внутри скалярного подзапроса?",
      opts: ["Зависит от базы", "Да, автоматически", "Только если написать EXISTS", "Нет, фильтр надо повторить внутри"],
      right: 3,
      why: "Подзапрос — самостоятельный запрос со своей областью видимости. Забытый фильтр внутри — очень частая причина того, что доли не сходятся к 100%."
    },
    {
      q: "Задача «последний заказ каждого клиента». Что предпочтительнее на большой таблице?",
      opts: [
        "Оконная функция ROW_NUMBER с фильтром rn = 1",
        "Коррелированный подзапрос с MAX",
        "CROSS JOIN",
        "NOT IN"
      ],
      right: 0,
      why: "Окно считается за один проход, коррелированный подзапрос — по разу на строку. Плюс <code>ROW_NUMBER</code> гарантирует ровно одну строку даже при совпадающих датах."
    }
  ],

  links: [
    { t: "Subquery Expressions", url: "https://www.postgresql.org/docs/current/functions-subquery.html", src: "postgresql.org", lang: "EN",
      d: "Формальное описание EXISTS, IN, ANY, ALL. Особенно раздел про поведение с NULL — источник самых коварных багов." },
    { t: "SQL-подзапросы с задачами", url: "https://mode.com/sql-tutorial/sql-sub-queries/", src: "Mode Analytics", lang: "EN",
      d: "Практический разбор на реальных данных: где подзапрос уместен, где он лишний." },
    { t: "Задачи уровня собеседования", url: "https://leetcode.com/problemset/database/", src: "leetcode.com", lang: "EN",
      d: "Фильтруйте по тегу Subquery. Задачи вида «выше среднего» и «второй по величине» здесь встречаются постоянно." },
    { t: "Тренажёр SQL с проверкой решений", url: "https://www.sql-ex.ru/", src: "sql-ex.ru", lang: "RU",
      d: "Задачи 15–40 в основном наборе — это ровно подзапросы. Хорошая проверка, что тема закрыта." },
    { t: "SQL Antipatterns", url: "https://pragprog.com/titles/bksqla/sql-antipatterns/", src: "pragprog.com", lang: "EN",
      d: "Книга Билла Карвина про типовые ошибки в SQL. Читается легко и один раз навсегда закрывает вопросы про NULL и подзапросы." }
  ]
};

/* ---------------------------------------------------------- */
/* 1.6 — даты и когорты в SQL                                   */
/* ---------------------------------------------------------- */

window.CONTENT.m1l6 = {
  intro: "Месяц, неделя, разница дат, «сколько дней от регистрации до покупки». Работа с датами — половина рабочего времени аналитика и главный источник расхождений в отчётах.",
  duration: "≈ 2 часа",
  plan: [
    { m: "30 мин", w: "Теория: усечение, разница дат, границы периодов" },
    { m: "40 мин", w: "Основная задача: помесячная динамика с приростом" },
    { m: "35 мин", w: "Тренажёр: когорты, дни недели, время до покупки" },
    { m: "10 мин", w: "Самопроверка вопросами" },
    { m: "5 мин",  w: "Заметки" }
  ],

  theory: `
<p class="lead">Спросите у трёх аналитиков выручку за март — получите три разных числа. Причина почти всегда в датах: у кого-то включена граница, у кого-то не тот часовой пояс, у кого-то неделя начинается с воскресенья.</p>

<h3>Усечение до периода</h3>
<p>Самая частая операция: превратить дату в месяц или неделю, чтобы сгруппировать. В каждой базе это делается по-своему:</p>
<table>
  <tr><th>Задача</th><th>SQLite (наш курс)</th><th>PostgreSQL</th><th>ClickHouse</th></tr>
  <tr><td>месяц</td><td><code>strftime('%Y-%m', d)</code></td><td><code>DATE_TRUNC('month', d)</code></td><td><code>toStartOfMonth(d)</code></td></tr>
  <tr><td>неделя</td><td><code>strftime('%Y-%W', d)</code></td><td><code>DATE_TRUNC('week', d)</code></td><td><code>toMonday(d)</code></td></tr>
  <tr><td>день</td><td><code>date(d)</code></td><td><code>d::date</code></td><td><code>toDate(d)</code></td></tr>
  <tr><td>разница в днях</td><td><code>julianday(a) - julianday(b)</code></td><td><code>a - b</code></td><td><code>dateDiff('day', b, a)</code></td></tr>
</table>
<p>Логика везде одинаковая, синтаксис разный. Не пытайтесь заучить все диалекты — запомните <em>что</em> вам нужно, а <em>как</em> найдёте в документации за минуту.</p>

<h3>Полезные функции SQLite</h3>
<pre><code>date('2024-03-15', 'start of month')     -- '2024-03-01'
date('2024-03-15', '+1 month')           -- '2024-04-15'
date('2024-03-15', 'start of month', '+1 month', '-1 day')  -- '2024-03-31' (конец месяца)
strftime('%w', '2024-03-15')             -- '5' — день недели, 0 = воскресенье
strftime('%Y-%m-%d', 'now')              -- сегодня
julianday('2024-03-15') - julianday('2024-03-01')  -- 14.0</code></pre>
<p>Обратите внимание: <code>julianday</code> возвращает дробное число, поэтому результат обычно оборачивают в <code>CAST(... AS INTEGER)</code>.</p>

<div class="callout trap">
  <span class="ct">Ловушка границ периода</span>
  <p><code>WHERE order_date BETWEEN '2024-03-01' AND '2024-03-31'</code> кажется правильным, но если в колонке хранится не дата, а дата-время, то заказ в 14:30 31 марта не попадёт: <code>'2024-03-31 14:30' &gt; '2024-03-31'</code>.</p>
  <p style="margin-bottom:0"><strong>Безопасный шаблон:</strong> <code>WHERE d &gt;= '2024-03-01' AND d &lt; '2024-04-01'</code>. Левая граница включена, правая — нет. Работает одинаково и для дат, и для дат-времени, и никогда не теряет последний день месяца.</p>
</div>

<h3>Когорта: что это такое на самом деле</h3>
<p>Когорта — это группа пользователей, объединённая <strong>моментом входа</strong>. «Когорта марта» — все, кто зарегистрировался в марте. Дальше вы смотрите, как эта группа ведёт себя со временем, и сравниваете с другими когортами.</p>
<p>Смысл в том, чтобы отделить изменения в продукте от изменений в составе аудитории. Общая конверсия могла упасть просто потому, что в мае пришло много дешёвого трафика. Когортный разрез это сразу покажет: у майской когорты конверсия ниже, у остальных — прежняя.</p>
<pre><code>-- размер когорты и сколько из неё купили
WITH cohort AS (
    SELECT user_id, strftime('%Y-%m', signup_date) AS cohort_month
    FROM users
),
buyers AS (
    SELECT DISTINCT user_id FROM orders WHERE status = 'paid'
)
SELECT
    c.cohort_month,
    COUNT(*) AS users_cnt,
    COUNT(b.user_id) AS buyers_cnt,
    ROUND(COUNT(b.user_id) * 100.0 / COUNT(*), 1) AS cr
FROM cohort c
LEFT JOIN buyers b ON b.user_id = c.user_id
GROUP BY c.cohort_month
ORDER BY c.cohort_month;</code></pre>

<div class="example">
  <div class="example-h">Как читать когортную таблицу</div>
  <div class="example-b">
    <p>Вот что даёт запрос выше на нашей базе:</p>
<pre><code>cohort   users  buyers   cr
2024-01     33      15  45.5
2024-02     34      13  38.2
2024-03     49      31  63.3
2024-04     34      16  47.1
2024-05     44      20  45.5
2024-06     26       9  34.6</code></pre>
    <p>Мартовская когорта конвертится в полтора раза лучше февральской. Первый вопрос аналитика — не «почему март такой хороший», а <strong>«честное ли это сравнение»</strong>. У январской когорты было девять месяцев, чтобы купить, у июньской — три. Падение к июню может быть не ухудшением продукта, а просто нехваткой времени.</p>
    <p>Правильный способ сравнивать — фиксировать окно наблюдения: «конверсия за первые 30 дней с регистрации». Тогда все когорты в равных условиях. Это и есть главный приём когортного анализа, к которому мы вернёмся в модуле 4.</p>
  </div>
</div>

<h3>Время между двумя событиями</h3>
<p>«Сколько дней от регистрации до первой покупки» — метрика time to value, одна из самых полезных в продукте. Схема расчёта всегда одна: найти событие А, найти событие Б, вычесть.</p>
<pre><code>WITH first_order AS (
    SELECT user_id, MIN(order_date) AS first_date
    FROM orders WHERE status = 'paid'
    GROUP BY user_id
)
SELECT
    u.channel,
    ROUND(AVG(julianday(f.first_date) - julianday(u.signup_date)), 1) AS avg_days
FROM users u
JOIN first_order f ON f.user_id = u.user_id
GROUP BY u.channel;</code></pre>

<div class="callout note">
  <span class="ct">Про часовые пояса — прочитать один раз</span>
  <p style="margin-bottom:0">В боевых базах время обычно хранится в UTC, а бизнес живёт в местном времени. Разница в 3 часа означает, что заказы с 21:00 до 24:00 по Москве попадут в «завтра» по UTC. На дневных отчётах это даёт расхождение в несколько процентов и бесконечные споры «почему в дашборде не то, что в 1С». Первый вопрос при знакомстве с новой базой: в каком поясе лежат даты.</p>
</div>

<div class="callout work">
  <span class="ct">Где это в работе</span>
  <p>Любой график в дашборде — это группировка по дате. Любое сравнение «стало лучше или хуже» — это разница периодов. Любой разговор про retention начинается с когорты. Умение уверенно резать данные по времени — то, что отличает аналитика от человека, умеющего писать SELECT.</p>
</div>

<div class="callout jobs">
  <span class="ct">Что закрывает урок в вакансиях</span>
  <ul>
    <li>«Когортный анализ» — прямое требование в вакансиях Product Analyst</li>
    <li>«Построение регулярной отчётности с динамикой» — работа джуна в первые месяцы</li>
    <li>Задача с интервью: «посчитай, как менялась выручка по месяцам и на сколько процентов»</li>
  </ul>
</div>
`,

  ticket: {
    from: "Марина, операционный директор",
    subj: "Динамика выручки по месяцам к совету директоров",
    body: `
<p>Готовлю слайд про динамику. Нужна помесячная картина по <strong>оплаченным</strong> заказам:</p>
<ul>
  <li><code>ym</code> — месяц в формате <code>'2024-01'</code></li>
  <li><code>orders_cnt</code> — количество заказов</li>
  <li><code>revenue</code> — выручка, 2 знака</li>
  <li><code>mom_pct</code> — прирост к предыдущему месяцу в процентах, 1 знак</li>
</ul>
<p>Сортировка по месяцу по возрастанию. У самого первого месяца прироста быть не может — оставь там пусто, не ноль.</p>
`
  },

  schema: window.SH.sqlSchema + window.SH.sqlDates,

  starter: `-- Помесячная динамика выручки
-- Шаг 1: усечь дату до месяца и сгруппировать
-- Шаг 2: достать выручку предыдущего месяца
-- Шаг 3: посчитать прирост в процентах

SELECT
    strftime('%Y-%m', order_date) AS ym
    -- остальные столбцы
FROM orders
WHERE
GROUP BY ym
ORDER BY ym;
`,

  expected: {
    ordered: true,
    columns: ["ym", "orders_cnt", "revenue", "mom_pct"],
    rows: [
      ["2024-01", 6, 25563.37, null],
      ["2024-02", 17, 67477.28, 164.0],
      ["2024-03", 27, 85621.79, 26.9],
      ["2024-04", 36, 119150.19, 39.2],
      ["2024-05", 33, 114508.40, -3.9],
      ["2024-06", 32, 103461.97, -9.6],
      ["2024-07", 29, 102708.78, -0.7],
      ["2024-08", 8, 24759.71, -75.9],
      ["2024-09", 1, 10177.29, -58.9]
    ]
  },

  hints: [
    "Первая часть — обычная группировка: <code>strftime('%Y-%m', order_date)</code> даёт месяц, дальше <code>COUNT</code> и <code>SUM</code>. Сложность во втором шаге: нужна выручка <em>прошлой</em> строки. Какая оконная функция достаёт значение из предыдущей строки?",
    "<code>LAG(...)</code>. Тонкость в том, что брать надо не <code>revenue</code>, а уже посчитанную сумму месяца — то есть <code>LAG(SUM(revenue)) OVER (ORDER BY ym)</code>. Так можно: оконные функции выполняются после <code>GROUP BY</code>, поэтому окно видит агрегаты.",
    "Прирост считается как <code>текущая / предыдущая * 100 - 100</code>. Обязательно <code>100.0</code> с точкой. У января <code>LAG</code> вернёт <code>NULL</code>, вся формула станет <code>NULL</code> — это ровно то, что просили в тикете, ничего дополнительно делать не нужно. Округляйте <code>ROUND(..., 1)</code>."
  ],

  solution: `-- Помесячная динамика выручки с приростом
SELECT
    strftime('%Y-%m', order_date) AS ym,
    COUNT(*) AS orders_cnt,
    ROUND(SUM(revenue), 2) AS revenue,
    -- LAG видит уже сгруппированные строки, поэтому берём LAG от агрегата.
    -- У первого месяца предыдущей строки нет -> NULL -> вся формула NULL
    ROUND(
        SUM(revenue) * 100.0
        / LAG(SUM(revenue)) OVER (ORDER BY strftime('%Y-%m', order_date))
        - 100,
    1) AS mom_pct
FROM orders
WHERE status = 'paid'
GROUP BY ym
ORDER BY ym;`,

  solutionNote: `
<p><strong>Что на самом деле показывает эта таблица.</strong> Рост до апреля, плато, потом обвал в августе на 76% и «минус 59%» в сентябре. Прежде чем нести такой слайд директору, аналитик обязан задать себе вопрос: <em>это бизнес или это данные?</em></p>
<p>Посмотрите на <code>orders_cnt</code>: в сентябре ровно один заказ. Максимальная дата в таблице — 11 сентября. Значит, месяц просто не закончился, а выгрузка обрывается. Падение на 59% — артефакт неполного периода, а не провал продаж.</p>
<p><strong>Как правильно.</strong> Либо отрезать неполный месяц (<code>WHERE order_date &lt; '2024-09-01'</code>), либо явно подписать его как неполный. Отдать такую таблицу без оговорки — самая дорогая ошибка джуна: решение примут по цифре, а не по вашему молчанию.</p>
<p><strong>Ещё одна деталь.</strong> Рост февраля к январю на 164% выглядит впечатляюще, но январь — первый месяц работы с шестью заказами. На малых числах проценты врут: с 2 до 5 заказов — это «рост на 150%». В отчётах рядом с процентом всегда показывайте абсолютные значения.</p>
`,

  drills: [
    {
      title: "Когорты по месяцу регистрации",
      level: "easy",
      body: `<p>Постройте когортную таблицу: <code>cohort</code> (месяц регистрации), <code>users_cnt</code>, <code>buyers_cnt</code> (сколько из когорты сделали хотя бы один оплаченный заказ), <code>cr</code> — конверсия в процентах с одним знаком.</p>
<p>Посмотрев на результат, ответьте: можно ли по нему сказать, что качество трафика в июне ухудшилось?</p>`,
      solution: `WITH cohort AS (
    SELECT user_id, strftime('%Y-%m', signup_date) AS cohort_month
    FROM users
),
buyers AS (
    SELECT DISTINCT user_id
    FROM orders
    WHERE status = 'paid'
)
SELECT
    c.cohort_month AS cohort,
    COUNT(*) AS users_cnt,
    COUNT(b.user_id) AS buyers_cnt,
    ROUND(COUNT(b.user_id) * 100.0 / COUNT(*), 1) AS cr
FROM cohort c
LEFT JOIN buyers b ON b.user_id = c.user_id
GROUP BY c.cohort_month
ORDER BY c.cohort_month;`,
      note: `<p>Нет, нельзя. У июньской когорты было меньше времени на покупку, чем у январской. Чтобы сравнение стало честным, нужно ограничить окно наблюдения — например, считать только заказы в первые 30 дней после регистрации. Это следующая задача.</p>`
    },
    {
      title: "Честная когорта: конверсия за 30 дней",
      level: "hard",
      body: `<p>Переделайте прошлую задачу так, чтобы все когорты были в равных условиях: покупкой считается только заказ, сделанный <strong>в течение 30 дней после регистрации</strong>.</p>
<p>Столбцы те же: <code>cohort</code>, <code>users_cnt</code>, <code>buyers_cnt</code>, <code>cr</code>.</p>`,
      solution: `WITH cohort AS (
    SELECT user_id, signup_date, strftime('%Y-%m', signup_date) AS cohort_month
    FROM users
),
early_buyers AS (
    SELECT DISTINCT c.user_id
    FROM cohort c
    JOIN orders o
      ON o.user_id = c.user_id
     AND o.status = 'paid'
     -- окно наблюдения одинаковой длины для всех когорт
     AND o.order_date <  date(c.signup_date, '+30 day')
     AND o.order_date >= c.signup_date
)
SELECT
    c.cohort_month AS cohort,
    COUNT(*) AS users_cnt,
    COUNT(e.user_id) AS buyers_cnt,
    ROUND(COUNT(e.user_id) * 100.0 / COUNT(*), 1) AS cr
FROM cohort c
LEFT JOIN early_buyers e ON e.user_id = c.user_id
GROUP BY c.cohort_month
ORDER BY c.cohort_month;`,
      note: `<p>Числа заметно упали для всех когорт — и это правильно: теперь вы измеряете одно и то же у всех. Сравнивать когорты можно только на равном окне наблюдения. Эта мысль стоит в основе всего когортного анализа, и её же чаще всего забывают в реальных отчётах.</p>`
    },
    {
      title: "День недели",
      level: "easy",
      body: `<p>Есть ли у нас «мёртвые» дни? Выведите <code>dow</code> (номер дня недели, где 0 — воскресенье), <code>orders_cnt</code> и <code>revenue</code> по оплаченным заказам. Сортировка по <code>dow</code>.</p>
<p>Бонус: превратите номер в название дня через <code>CASE</code>.</p>`,
      solution: `SELECT
    strftime('%w', order_date) AS dow,
    CASE strftime('%w', order_date)
        WHEN '0' THEN 'воскресенье'
        WHEN '1' THEN 'понедельник'
        WHEN '2' THEN 'вторник'
        WHEN '3' THEN 'среда'
        WHEN '4' THEN 'четверг'
        WHEN '5' THEN 'пятница'
        WHEN '6' THEN 'суббота'
    END AS day_name,
    COUNT(*) AS orders_cnt,
    ROUND(SUM(revenue), 2) AS revenue
FROM orders
WHERE status = 'paid'
GROUP BY dow
ORDER BY dow;`,
      note: `<p>Разброс от 24 до 33 заказов — на таких объёмах это шум, а не закономерность. Полезная привычка: прежде чем объявлять «по средам покупают лучше», прикиньте, укладывается ли разница в случайные колебания. При 27 заказах в среднем разброс ±5 абсолютно нормален.</p>`
    },
    {
      title: "Время до первой покупки по каналам",
      level: "mid",
      body: `<p>Посчитайте, сколько в среднем проходит дней от регистрации до первой оплаченной покупки, в разрезе каналов: <code>channel</code>, <code>buyers</code>, <code>avg_days</code> (1 знак), <code>min_days</code>, <code>max_days</code>. Сортировка по <code>avg_days</code> по возрастанию.</p>`,
      solution: `WITH first_order AS (
    SELECT
        user_id,
        MIN(order_date) AS first_date
    FROM orders
    WHERE status = 'paid'
    GROUP BY user_id
)
SELECT
    u.channel,
    COUNT(*) AS buyers,
    ROUND(AVG(julianday(f.first_date) - julianday(u.signup_date)), 1) AS avg_days,
    MIN(CAST(julianday(f.first_date) - julianday(u.signup_date) AS INTEGER)) AS min_days,
    MAX(CAST(julianday(f.first_date) - julianday(u.signup_date) AS INTEGER)) AS max_days
FROM users u
JOIN first_order f ON f.user_id = u.user_id
GROUP BY u.channel
ORDER BY avg_days;`,
      note: `<p>Разброс средних невелик — от 23 до 29 дней. Зато интересен максимум: у organic он 79 дней. Это значит, что часть людей «дозревает» два с половиной месяца, и рассылка на 30-й день их не поймает. Такие наблюдения и превращаются в задачи для маркетинга.</p>`
    },
    {
      title: "Недельная динамика без дыр",
      level: "hard",
      body: `<p>Постройте недельную динамику заказов с начала апреля по конец июля: <code>week_start</code> (понедельник недели), <code>orders_cnt</code>, <code>revenue</code>. Недели без заказов должны быть в таблице с нулями.</p>
<p>Понадобится рекурсивный календарь недель из урока 1.4.</p>`,
      solution: `WITH RECURSIVE weeks(week_start) AS (
    -- 1 апреля 2024 — понедельник
    SELECT '2024-04-01'
    UNION ALL
    SELECT date(week_start, '+7 day')
    FROM weeks
    WHERE week_start < '2024-07-29'
)
SELECT
    w.week_start,
    COUNT(o.order_id) AS orders_cnt,
    ROUND(COALESCE(SUM(o.revenue), 0), 2) AS revenue
FROM weeks w
LEFT JOIN orders o
       ON o.status = 'paid'
      AND o.order_date >= w.week_start
      -- правая граница НЕ включена: следующий понедельник уже чужая неделя
      AND o.order_date <  date(w.week_start, '+7 day')
GROUP BY w.week_start
ORDER BY w.week_start;`,
      note: `<p>Обратите внимание на условие соединения: <code>&gt;=</code> слева и <code>&lt;</code> справа. Если поставить <code>BETWEEN</code>, заказы понедельника попадут сразу в две недели и выручка задвоится. Это самая частая ошибка при построении периодов, и она даёт красивый, но неверный график.</p><p>В нашем диапазоне пустых недель не оказалось — но узнать это можно было только построив календарь. Отсутствие дыр надо доказывать, а не предполагать.</p>`
    }
  ],

  quiz: [
    {
      q: "Почему <code>BETWEEN '2024-03-01' AND '2024-03-31'</code> опасно?",
      opts: [
        "Ничем не опасно",
        "Если в поле есть время, заказы 31 марта после полуночи не попадут",
        "BETWEEN не работает с датами",
        "BETWEEN включает обе границы, а нужно исключить левую"
      ],
      right: 1,
      why: "<code>'2024-03-31 14:30' &gt; '2024-03-31'</code>, поэтому такой заказ выпадет из выборки. Безопасный шаблон — <code>&gt;= начало AND &lt; начало следующего периода</code>."
    },
    {
      q: "Сентябрь показывает −59% к августу. Что проверить в первую очередь?",
      opts: [
        "Не изменились ли цены",
        "Не было ли сезонности",
        "Закончился ли месяц — данные могут обрываться в середине",
        "Не сломался ли трекинг"
      ],
      right: 2,
      why: "В таблице один заказ за сентябрь, а последняя дата — 11 сентября. Неполный период — причина номер один для «падений» в отчётах. Проверяется за десять секунд запросом <code>SELECT MAX(order_date)</code>."
    },
    {
      q: "Можно ли сравнивать конверсию январской и июньской когорт напрямую?",
      opts: [
        "Да, если обе больше 30 человек",
        "Да, когорты для того и нужны",
        "Нет, потому что размеры когорт разные",
        "Нет: у них разное время на покупку, нужно фиксировать окно наблюдения"
      ],
      right: 3,
      why: "У январской когорты было девять месяцев, у июньской — три. Честное сравнение требует одинакового окна: например, «конверсия за первые 30 дней»."
    },
    {
      q: "<code>LAG(SUM(revenue)) OVER (ORDER BY ym)</code> — почему это работает?",
      opts: [
        "Оконные функции выполняются после GROUP BY и видят агрегаты",
        "Это не работает, будет ошибка",
        "Работает только в SQLite",
        "SUM внутри LAG игнорируется"
      ],
      right: 0,
      why: "Порядок: GROUP BY → HAVING → оконные функции → SELECT. К моменту расчёта окна строки уже сгруппированы, поэтому окно оперирует помесячными суммами."
    },
    {
      q: "Февраль к январю: +164%. Что стоит добавить в отчёт?",
      opts: [
        "Ничего, процент говорит сам за себя",
        "Абсолютные значения — на малых числах проценты вводят в заблуждение",
        "Медиану",
        "Доверительный интервал"
      ],
      right: 1,
      why: "Январь — 6 заказов, февраль — 17. Рост реальный, но «+164%» звучит как взрывной успех, хотя это просто старт бизнеса. Проценты без абсолютных чисел — способ случайно соврать."
    },
    {
      q: "Данные в базе в UTC, компания в Москве. Что произойдёт с дневным отчётом?",
      opts: [
        "Ничего",
        "Сдвинется только месячная агрегация",
        "События с 21:00 до 00:00 по Москве уедут в следующий день",
        "Отчёт вообще не построится"
      ],
      right: 2,
      why: "Разница в 3 часа переносит вечерние события на следующие сутки по UTC. На дневных графиках это даёт устойчивое расхождение с бизнес-системами — и бесконечные споры, чей отчёт правильный."
    }
  ],

  links: [
    { t: "Функции даты и времени в SQLite", url: "https://www.sqlite.org/lang_datefunc.html", src: "sqlite.org", lang: "EN",
      d: "Полный список модификаторов вроде 'start of month' и '+1 day'. Короткая страница, которую стоит прочитать целиком." },
    { t: "Date/Time Functions в PostgreSQL", url: "https://www.postgresql.org/docs/current/functions-datetime.html", src: "postgresql.org", lang: "EN",
      d: "DATE_TRUNC, INTERVAL, AGE и работа с часовыми поясами. То, с чем вы столкнётесь на реальной работе." },
    { t: "Cohort Analysis — что это и зачем", url: "https://amplitude.com/blog/cohort-analysis", src: "amplitude.com", lang: "EN",
      d: "Продуктовый взгляд на когорты от вендора аналитики: какие вопросы они закрывают и как читать когортную таблицу." },
    { t: "Хаб «Аналитика» на Хабре", url: "https://habr.com/ru/hubs/analytics/articles/", src: "habr.com", lang: "RU",
      d: "Разборы когортного анализа и retention на русском, с картинками и реальными кейсами компаний." },
    { t: "Задачи на даты и когорты", url: "https://www.stratascratch.com/", src: "stratascratch.com", lang: "EN",
      d: "Фильтруйте по тегу Date. Работа с периодами — второй по частоте тип задач на SQL-секции после джойнов." }
  ]
};

/* ---------------------------------------------------------- */
/* 1.7 — ClickHouse: чем отличается                             */
/* ---------------------------------------------------------- */

window.CONTENT.m1l7 = {
  intro: "ClickHouse стоит почти в каждой вакансии строчкой «будет плюсом». Разбираемся, чем колоночная база отличается от привычной и что это меняет для аналитика на практике.",
  duration: "≈ 2 часа",
  plan: [
    { m: "40 мин", w: "Теория: колоночное хранение, синтаксис, чего нет" },
    { m: "35 мин", w: "Основная задача: перевести запрос и объяснить решения" },
    { m: "30 мин", w: "Тренажёр: разбор функций и типовых ошибок" },
    { m: "10 мин", w: "Самопроверка вопросами" },
    { m: "5 мин",  w: "Заметки и ссылки" }
  ],

  theory: `
<p class="lead">В вакансиях ClickHouse обычно идёт как «будет плюсом». На деле это значит: если вы придёте и скажете «я понимаю, чем он отличается от Postgres и почему в нём не делают UPDATE», вы уже впереди большинства кандидатов.</p>

<h3>Строки против колонок</h3>
<p>Обычная база (PostgreSQL, MySQL) хранит данные <strong>по строкам</strong>: все поля одного заказа лежат рядом на диске. Это идеально для операций «дай мне заказ №123 целиком» или «измени статус этого заказа».</p>
<p>ClickHouse хранит данные <strong>по колонкам</strong>: все значения <code>revenue</code> лежат вместе, все значения <code>status</code> — вместе. Отсюда следует всё остальное:</p>
<table>
  <tr><th></th><th>Строковая (PostgreSQL)</th><th>Колоночная (ClickHouse)</th></tr>
  <tr><td>Прочитать одну колонку из ста</td><td>читает всю строку</td><td>читает только нужную колонку</td></tr>
  <tr><td><code>SUM</code> по миллиарду строк</td><td>минуты</td><td>секунды</td></tr>
  <tr><td>Достать одну строку по ключу</td><td>мгновенно</td><td>медленнее</td></tr>
  <tr><td>Сжатие</td><td>слабое</td><td>сильное: рядом однотипные значения</td></tr>
  <tr><td><code>UPDATE</code> одной строки</td><td>обычная операция</td><td>тяжёлая, почти не используется</td></tr>
  <tr><td>Транзакции, внешние ключи</td><td>есть</td><td>по сути нет</td></tr>
</table>
<p>Вывод, который надо унести: ClickHouse — это база <em>для аналитики</em>, а не для приложения. Она создана считать агрегаты по огромным таблицам событий и не создана хранить состояние вашего интернет-магазина.</p>

<div class="callout note">
  <span class="ct">Почему это важно для вас</span>
  <p style="margin-bottom:0">В типичной компании данные живут в двух местах: продуктовая база (Postgres) и аналитическое хранилище (ClickHouse, BigQuery, Snowflake). Аналитик почти всегда пишет запросы во второе. Понимание «почему тут нельзя просто взять и сделать UPDATE» экономит время и вам, и дата-инженерам.</p>
</div>

<h3>Что в синтаксисе выглядит иначе</h3>
<table>
  <tr><th>Задача</th><th>PostgreSQL</th><th>ClickHouse</th></tr>
  <tr><td>усечь до месяца</td><td><code>DATE_TRUNC('month', d)</code></td><td><code>toStartOfMonth(d)</code></td></tr>
  <tr><td>усечь до недели</td><td><code>DATE_TRUNC('week', d)</code></td><td><code>toMonday(d)</code></td></tr>
  <tr><td>разница дат</td><td><code>d2 - d1</code></td><td><code>dateDiff('day', d1, d2)</code></td></tr>
  <tr><td>уникальные (точно)</td><td><code>COUNT(DISTINCT x)</code></td><td><code>uniqExact(x)</code></td></tr>
  <tr><td>уникальные (быстро)</td><td>—</td><td><code>uniq(x)</code> — приблизительно</td></tr>
  <tr><td>условная сумма</td><td><code>SUM(CASE WHEN c THEN x END)</code></td><td><code>sumIf(x, c)</code></td></tr>
  <tr><td>условный счёт</td><td><code>COUNT(*) FILTER (WHERE c)</code></td><td><code>countIf(c)</code></td></tr>
  <tr><td>квантиль</td><td><code>PERCENTILE_CONT</code></td><td><code>quantile(0.5)(x)</code></td></tr>
  <tr><td>если пусто</td><td><code>COALESCE(x, 0)</code></td><td><code>ifNull(x, 0)</code></td></tr>
</table>

<h3>Комбинаторы -If и -Array: главная фишка</h3>
<p>К любой агрегатной функции ClickHouse можно приписать суффикс. Это не сахар, а способ считать десяток метрик одним проходом по данным:</p>
<pre><code>SELECT
    channel,
    count()                                   AS users,
    countIf(status = 'paid')                  AS paid_orders,
    sumIf(revenue, status = 'paid')           AS revenue,
    uniqIf(user_id, status = 'refunded')      AS users_with_refund,
    avgIf(revenue, status = 'paid')           AS aov
FROM orders_wide
GROUP BY channel;</code></pre>
<p>В PostgreSQL то же самое пишется через <code>CASE WHEN</code> и читается заметно хуже. Умение писать <code>sumIf</code> вместо <code>SUM(CASE WHEN ... END)</code> — первое, что выдаёт человека, который реально работал с ClickHouse.</p>

<h3>Воронки одной функцией</h3>
<p>Для продуктовой аналитики в ClickHouse есть специальные функции, которых нет больше нигде:</p>
<pre><code>-- сколько пользователей дошли до 1, 2, 3-го шага за 7 дней
SELECT
    level,
    count() AS users
FROM (
    SELECT
        user_id,
        windowFunnel(7 * 86400)(
            event_time,
            event_name = 'visit',
            event_name = 'add_to_cart',
            event_name = 'purchase'
        ) AS level
    FROM events
    GROUP BY user_id
)
GROUP BY level
ORDER BY level;</code></pre>
<p>В обычном SQL такая воронка — это три самосоединения или хитрая конструкция с окнами. Здесь — одна функция. Рядом живут <code>retention()</code> и <code>sequenceMatch()</code>. Если в вакансии написано «ClickHouse», с большой вероятностью там считают именно воронки и ретеншен.</p>

<h3>Чего в ClickHouse нет или почти нет</h3>
<ul>
  <li><strong>Полноценных UPDATE и DELETE.</strong> Есть <code>ALTER TABLE ... UPDATE</code>, но это тяжёлая фоновая операция, а не обычный запрос. Данные обычно только дописывают.</li>
  <li><strong>Транзакций.</strong> Нельзя откатить пачку изменений.</li>
  <li><strong>Внешних ключей и проверок целостности.</strong> Никто не помешает записать заказ с несуществующим <code>user_id</code>.</li>
  <li><strong>Гарантии уникальности.</strong> Даже у <code>ReplacingMergeTree</code> дубликаты схлопываются не сразу, а «когда-нибудь при слиянии». Отсюда правило: в аналитических запросах по ClickHouse дедупликацию делают явно.</li>
</ul>

<div class="callout trap">
  <span class="ct">Три ловушки, на которых спотыкаются новички</span>
  <p><strong>1. <code>uniq</code> — приблизительный.</strong> Он использует вероятностный алгоритм и на больших данных ошибается на доли процента. Для дашборда это норма, для финансовой отчётности — нет. Точный вариант — <code>uniqExact</code>, и он заметно дороже.</p>
  <p><strong>2. Джойны дорогие.</strong> В ClickHouse правая таблица целиком грузится в память. Джойн двух больших таблиц может уронить сервер. Поэтому данные часто хранят денормализованно — одной широкой таблицей с уже приклеенными атрибутами.</p>
  <p style="margin-bottom:0"><strong>3. Всегда фильтруйте по ключу партиционирования.</strong> Таблицы обычно партиционированы по дате. Запрос без условия на дату прочитает всё хранилище. Первое, что пишут в <code>WHERE</code>, — диапазон дат.</p>
</div>

<div class="callout work">
  <span class="ct">Где это в работе</span>
  <p>Типичная схема: события пишутся в Kafka, оттуда попадают в ClickHouse одной широкой таблицей событий, а BI-инструмент (DataLens, Superset, Metabase) ходит запросами прямо в неё. Аналитик пишет SQL, который отрабатывает за секунды на миллиардах строк, — и именно поэтому в вакансиях эта строчка встречается всё чаще.</p>
</div>

<div class="callout jobs">
  <span class="ct">Что закрывает урок в вакансиях</span>
  <ul>
    <li>«ClickHouse — будет плюсом» — примерно четверть вакансий Junior Data Analyst</li>
    <li>«Опыт работы с большими данными» — на собеседовании это часто и означает ClickHouse</li>
    <li>Устный вопрос: «чем колоночная СУБД отличается от строковой и когда какую брать»</li>
    <li>Устный вопрос: «почему в ClickHouse не делают UPDATE»</li>
  </ul>
</div>
`,

  ticket: {
    from: "Дима, дата-инженер",
    subj: "Переносим отчёт в ClickHouse — нужен твой разбор",
    body: `
<p>Мы переезжаем с Postgres на ClickHouse, объёмы выросли. Возьми вот этот боевой запрос и напиши, что с ним делать. Отвечать надо текстом — это ревью, а не задача на код.</p>
<pre><code>SELECT
    DATE_TRUNC('month', o.order_date) AS month,
    u.channel,
    COUNT(DISTINCT o.user_id) AS buyers,
    SUM(CASE WHEN o.status = 'paid' THEN o.revenue ELSE 0 END) AS revenue,
    AVG(o.revenue) AS avg_check
FROM orders o
JOIN users u ON u.user_id = o.user_id
WHERE o.order_date >= '2024-01-01'
GROUP BY 1, 2
ORDER BY 1, 2;</code></pre>
<p>Напиши развёрнуто, по пунктам:</p>
<ul>
  <li>как переписать <strong>каждую</strong> функцию под синтаксис ClickHouse;</li>
  <li>что не так с джойном и что бы ты предложил вместо него;</li>
  <li>что важно учесть про <code>COUNT(DISTINCT)</code> при переезде;</li>
  <li>какое условие обязательно должно быть в <code>WHERE</code> и почему;</li>
  <li>что вообще меняется в подходе к данным, когда база колоночная: почему мы не сможем делать <code>UPDATE</code> как раньше.</li>
</ul>
<p>Объём — 12–20 предложений, тезисно. Пиши так, как ответил бы на собеседовании.</p>
`
  },

  schema: `
<p>Данных нет — это задача на разбор и объяснение. Вам понадобится только текст запроса из тикета и таблица соответствий из теории.</p>
<p><strong>Как проверяется задание.</strong> Свободный текст нельзя сверить с эталоном автоматически, поэтому проверка работает как чек-лист: система ищет в ответе смысловые блоки, которые ждёт интервьюер. Зачёт — если найдено минимум 5 из 7. После проверки откройте эталонный разбор и сравните: важно не совпадение слов, а не пропустили ли вы целый пласт рассуждения.</p>
<p>Подсказка по формату: пишите списком, каждый пункт — одна мысль. Именно так отвечают на технических интервью, и именно так проще думать.</p>
`,

  criteria: [
    { label: "Замена функций дат (DATE_TRUNC → toStartOfMonth)",
      any: ["tostartofmonth", "tomonday", "todate", "datediff", "date_trunc", "усечен", "функци дат"] },
    { label: "Комбинаторы -If вместо CASE WHEN",
      any: ["sumif", "countif", "avgif", "uniqif", "-if", "комбинатор", "case when"] },
    { label: "uniq против uniqExact и приблизительность",
      any: ["uniqexact", "uniq(", "uniq ", "приблизит", "приближ", "вероятностн", "hyperloglog", "точн подсч"] },
    { label: "Проблема джойнов и денормализация",
      any: ["джойн", "join", "денормал", "широк таблиц", "в память", "правая таблица", "словар", "dictionary"] },
    { label: "Фильтр по дате / партиционирование",
      any: ["партиц", "partition", "фильтр по дат", "ключ сортировк", "order by ключ", "прочита всё", "просканир"] },
    { label: "Отсутствие UPDATE и append-only подход",
      any: ["update", "апдейт", "дописыв", "append", "мутаци", "mergetree", "перезапис", "не меня"] },
    { label: "Понимание колоночного хранения",
      any: ["колоноч", "по колонк", "столбцов хранен", "сжат", "читает только нужн", "olap"] }
  ],
  minCriteria: 5,
  minWords: 90,

  hints: [
    "Идите по запросу сверху вниз, строка за строкой. В каждой строке спрашивайте себя: есть ли у этой конструкции прямой аналог в ClickHouse, или её надо переосмыслить? Начните с <code>DATE_TRUNC</code> — это самая простая замена.",
    "Три конструкции требуют не замены, а решения. Первая: <code>COUNT(DISTINCT)</code> — в ClickHouse есть быстрый приблизительный <code>uniq</code> и медленный точный <code>uniqExact</code>, и выбор зависит от того, куда пойдёт число. Вторая: <code>JOIN</code> с users — подумайте, что происходит с правой таблицей при выполнении джойна в ClickHouse. Третья: <code>WHERE</code> — чего в нём не хватает, если таблица партиционирована по дате?",
    "И последнее, самое важное для ответа на интервью: не ограничивайтесь синтаксисом. Объясните, <em>почему</em> ClickHouse устроен так. Колоночное хранение означает, что данные пишут пачками и почти никогда не меняют: <code>UPDATE</code> одной строки требует переписать кусок целой колонки. Отсюда append-only подход, отсюда отсутствие транзакций, отсюда денормализация вместо джойнов. Ответ, который начинается с устройства, а не с синтаксиса, звучит на порядок сильнее."
  ],

  reference: `
<p><strong>Эталонный разбор — как звучит сильный ответ.</strong></p>

<p><em>1. Построчная замена синтаксиса.</em></p>
<ul>
  <li><code>DATE_TRUNC('month', order_date)</code> → <code>toStartOfMonth(order_date)</code>.</li>
  <li><code>SUM(CASE WHEN status = 'paid' THEN revenue ELSE 0 END)</code> → <code>sumIf(revenue, status = 'paid')</code>. Короче, читается лучше, работает быстрее.</li>
  <li><code>AVG(o.revenue)</code> оставляем как <code>avg()</code>, но я бы уточнил у заказчика: средний чек по всем статусам, включая возвраты, — почти наверняка ошибка. Скорее нужен <code>avgIf(revenue, status = 'paid')</code>.</li>
  <li><code>GROUP BY 1, 2</code> работает в обеих базах, но я бы написал имена явно — через полгода никто не вспомнит, что такое «1».</li>
</ul>

<p><em>2. COUNT(DISTINCT) — здесь надо принять решение, а не просто перевести.</em></p>
<ul>
  <li><code>uniq(user_id)</code> — быстрый приблизительный подсчёт на HyperLogLog, ошибка порядка долей процента. Годится для дашборда и мониторинга.</li>
  <li><code>uniqExact(user_id)</code> — точный, но существенно дороже по памяти и времени.</li>
  <li>Выбор зависит от назначения числа: в оперативный дашборд — <code>uniq</code>, в отчёт для финансов или в расчёт, от которого зависят деньги, — <code>uniqExact</code>. Это вопрос, который стоит задать заказчику вслух.</li>
</ul>

<p><em>3. Джойн — главная проблема запроса.</em></p>
<ul>
  <li>В ClickHouse при <code>JOIN</code> правая таблица целиком загружается в память каждого узла. Джойн двух больших таблиц — частая причина падения запроса по памяти.</li>
  <li>Варианты решения по возрастанию усилий: (а) если <code>users</code> небольшая — подключить её как <strong>внешний словарь</strong> и обращаться через <code>dictGet('users', 'channel', user_id)</code>; (б) денормализовать — писать <code>channel</code> сразу в таблицу событий при загрузке; (в) если джойн неизбежен, ставить меньшую таблицу справа и фильтровать её до соединения.</li>
  <li>Денормализация в ClickHouse — не «грязный хак», а нормальная практика: дисковое место дешевле, чем джойны, а колоночное сжатие делает дублирование почти бесплатным.</li>
</ul>

<p><em>4. WHERE и партиционирование.</em></p>
<ul>
  <li>Таблицы событий почти всегда партиционированы по месяцу и отсортированы по <code>(date, user_id)</code>. Условие по дате обязано быть в <code>WHERE</code> явно, иначе запрос просканирует всё хранилище.</li>
  <li>В исходном запросе фильтр по дате есть — это хорошо. Но я бы добавил и верхнюю границу: открытый диапазон <code>&gt;= '2024-01-01'</code> будет каждый месяц читать всё больше данных.</li>
  <li>Фильтр должен быть по колонке в «сыром» виде: <code>WHERE order_date &gt;= '2024-01-01'</code>, а не <code>WHERE toStartOfMonth(order_date) &gt;= ...</code> — во втором случае индекс не сработает.</li>
</ul>

<p><em>5. Что меняется в подходе к данным.</em></p>
<ul>
  <li>ClickHouse хранит данные по колонкам, поэтому читает только те колонки, которые упомянуты в запросе, и очень хорошо их сжимает — рядом лежат однотипные значения.</li>
  <li>Обратная сторона: изменение одной строки требует переписать кусок колонки целиком. Поэтому <code>UPDATE</code> и <code>DELETE</code> существуют как тяжёлые фоновые мутации, а не как обычные запросы.</li>
  <li>Отсюда append-only модель: данные только дописывают. Исправление ошибки — это не апдейт, а перезапись партиции целиком или запись компенсирующей строки.</li>
  <li>Нет транзакций, нет внешних ключей, нет гарантированной уникальности. За целостность отвечает пайплайн загрузки, а не база. Значит, в аналитических запросах дедупликацию делают явно, а качество данных проверяют отдельными сверками.</li>
</ul>

<p><em>6. Итоговый вариант запроса:</em></p>
<pre><code>SELECT
    toStartOfMonth(order_date) AS month,
    channel,                                  -- денормализовано в таблицу
    uniq(user_id) AS buyers,                  -- uniqExact, если число идёт в финотчёт
    sumIf(revenue, status = 'paid') AS revenue,
    avgIf(revenue, status = 'paid') AS avg_check
FROM orders_wide
WHERE order_date >= '2024-01-01'
  AND order_date <  '2025-01-01'              -- закрытый диапазон
GROUP BY month, channel
ORDER BY month, channel;</code></pre>

<p><strong>Что отличает сильный ответ от среднего.</strong> Средний кандидат переводит синтаксис. Сильный говорит: «вот замены, но главное — здесь два решения, которые надо принять осознанно: точность <code>uniq</code> и судьба джойна. И то и другое зависит от того, куда пойдёт число и насколько велики таблицы». Именно за такой ход мысли и берут на работу.</p>
`,

  drills: [
    {
      title: "Переведите пять выражений",
      level: "easy",
      body: `<p>Не подглядывая в теорию, напишите аналоги ClickHouse для каждого выражения:</p>
<ol>
  <li><code>DATE_TRUNC('week', event_date)</code></li>
  <li><code>COUNT(*) FILTER (WHERE status = 'refunded')</code></li>
  <li><code>COALESCE(revenue, 0)</code></li>
  <li><code>event_date2 - event_date1</code> (разница в днях)</li>
  <li><code>PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY revenue)</code></li>
</ol>`,
      solution: `1. toMonday(event_date)
2. countIf(status = 'refunded')
3. ifNull(revenue, 0)
4. dateDiff('day', event_date1, event_date2)
5. quantile(0.5)(revenue)      -- или median(revenue)`,
      note: `<p>Обратите внимание на порядок аргументов в <code>dateDiff</code>: сначала более ранняя дата. Перепутаете — получите отрицательные дни и потратите полчаса на поиск «ошибки в данных».</p>`
    },
    {
      title: "Одна метрика — три реализации",
      level: "mid",
      body: `<p>Задача: посчитать долю возвратов по каналам. Напишите три версии: на SQLite (как в этом курсе), на PostgreSQL и на ClickHouse. Сравните, какая читается лучше.</p>`,
      solution: `-- SQLite (курс)
SELECT u.channel,
       ROUND(SUM(CASE WHEN o.status = 'refunded' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1) AS refund_rate
FROM users u JOIN orders o ON o.user_id = u.user_id
GROUP BY u.channel;

-- PostgreSQL: есть FILTER, читается чуть лучше
SELECT u.channel,
       ROUND(COUNT(*) FILTER (WHERE o.status = 'refunded') * 100.0 / COUNT(*), 1) AS refund_rate
FROM users u JOIN orders o ON o.user_id = u.user_id
GROUP BY u.channel;

-- ClickHouse: комбинатор -If
SELECT channel,
       round(countIf(status = 'refunded') * 100.0 / count(), 1) AS refund_rate
FROM orders_wide
GROUP BY channel;`,
      note: `<p>Одна и та же мысль, три записи. Полезное упражнение перед собеседованием: возьмите свой любимый запрос и перепишите его на три диалекта. После этого «а вы работали с ClickHouse?» перестаёт быть страшным вопросом — вы сможете честно сказать, что понимаете различия.</p>`
    },
    {
      title: "Почему запрос читает всё хранилище",
      level: "mid",
      body: `<p>Дата-инженер жалуется, что ваш запрос сканирует терабайт вместо гигабайта. Таблица партиционирована по <code>toYYYYMM(event_date)</code>, ключ сортировки — <code>(event_date, user_id)</code>.</p>
<pre><code>SELECT count()
FROM events
WHERE toStartOfMonth(event_date) = '2024-07-01'
  AND user_id IN (SELECT user_id FROM big_users_table);</code></pre>
<p>Найдите две причины и предложите исправление.</p>`,
      solution: `-- Причина 1: функция поверх колонки в WHERE.
--   toStartOfMonth(event_date) = ... не даёт использовать
--   партиционирование и индекс — база вынуждена вычислить
--   функцию для каждой строки.
-- Причина 2: подзапрос IN по большой таблице тянет
--   её целиком в память.

SELECT count()
FROM events
WHERE event_date >= '2024-07-01'
  AND event_date <  '2024-08-01'      -- «сырая» колонка => отсечение партиций
  AND user_id IN (
      SELECT user_id FROM big_users_table
      WHERE is_active                  -- сузили правую сторону заранее
  );`,
      note: `<p>Правило, которое работает во всех базах: <strong>не оборачивайте колонку в функцию внутри WHERE</strong>. Преобразуйте границы, а не данные. В ClickHouse цена ошибки выше всего — вместо одной партиции читается всё хранилище.</p>`
    },
    {
      title: "Объяснить продакту, почему нельзя «просто поправить»",
      level: "hard",
      body: `<p>Продакт пишет: «В событиях у 200 пользователей неверный город, поправь, пожалуйста, прямо в базе». Данные лежат в ClickHouse, таблица событий — 4 млрд строк.</p>
<p>Напишите ответ на 4–6 предложений: почему это не делается одним <code>UPDATE</code> и какие есть варианты.</p>`,
      solution: `Ответ, который стоит написать:

«В ClickHouse нет обычного UPDATE: данные хранятся по колонкам
и пишутся большими кусками, поэтому изменение 200 строк
запускает мутацию — фоновую перезапись затронутых кусков данных.
На таблице в 4 млрд строк это часы работы и заметная нагрузка
на кластер.

Варианты по возрастанию стоимости:
1) Не менять данные, а починить их в момент чтения:
   подтянуть актуальный город из справочника через словарь
   (dictGet) — сырые события остаются как есть.
2) Исправить источник и перезалить затронутую партицию целиком —
   это штатная операция, в отличие от точечного UPDATE.
3) Если правка разовая и срочная — ALTER TABLE ... UPDATE,
   но это надо согласовать с дата-инженерами и делать
   в окно низкой нагрузки.

Рекомендую первый вариант: он не трогает исторические данные
и заодно чинит все будущие отчёты.»`,
      note: `<p>Умение объяснить техническое ограничение нетехническому человеку — отдельный навык, который на собеседовании проверяют не реже, чем SQL. Формула ответа: «почему нельзя так → какие есть варианты → что рекомендую и почему».</p>`
    }
  ],

  quiz: [
    {
      q: "Почему ClickHouse быстрее считает <code>SUM(revenue)</code> по миллиарду строк?",
      opts: [
        "Он кэширует результаты всех запросов",
        "Он написан на C++",
        "Он хранит все данные в оперативной памяти",
        "Он читает только колонку revenue, а не все строки целиком"
      ],
      right: 3,
      why: "Колоночное хранение означает, что значения одной колонки лежат подряд. Запрос читает с диска только нужные колонки, и они хорошо сжаты — рядом однотипные данные."
    },
    {
      q: "Чем <code>uniq(user_id)</code> отличается от <code>uniqExact(user_id)</code>?",
      opts: [
        "uniq приблизительный и быстрый, uniqExact точный и дорогой",
        "uniqExact игнорирует NULL",
        "uniq работает только с числами",
        "Ничем, это синонимы"
      ],
      right: 0,
      why: "<code>uniq</code> использует вероятностный алгоритм с ошибкой в доли процента. Для дашборда это нормально, для расчёта, от которого зависят деньги, берите <code>uniqExact</code>."
    },
    {
      q: "Что не так с <code>WHERE toStartOfMonth(event_date) = '2024-07-01'</code>?",
      opts: [
        "toStartOfMonth не существует",
        "Функция поверх колонки мешает отсечению партиций — читается всё хранилище",
        "Синтаксическая ошибка",
        "Нужны кавычки другого типа"
      ],
      right: 1,
      why: "Индексы и партиции работают по «сырой» колонке. Правило универсальное: преобразуйте границы диапазона, а не саму колонку — <code>event_date &gt;= '2024-07-01' AND event_date &lt; '2024-08-01'</code>."
    },
    {
      q: "Почему в ClickHouse часто хранят денормализованные широкие таблицы?",
      opts: [
        "Чтобы экономить место на диске",
        "Иначе не работает GROUP BY",
        "Джойны дорогие: правая таблица грузится в память целиком",
        "Так требует стандарт SQL"
      ],
      right: 2,
      why: "Место как раз тратится больше, но колоночное сжатие делает дублирование почти бесплатным. А вот джойн большой таблицы может уронить запрос по памяти — поэтому атрибуты приклеивают заранее."
    },
    {
      q: "Как в ClickHouse записать <code>SUM(CASE WHEN status='paid' THEN revenue ELSE 0 END)</code>?",
      opts: ["sumWhen(revenue, status='paid')", "sum(revenue) FILTER (status='paid')", "ifSum(status='paid', revenue)", "sumIf(revenue, status = 'paid')"],
      right: 3,
      why: "Комбинатор <code>-If</code> приписывается к любой агрегатной функции: <code>sumIf</code>, <code>countIf</code>, <code>avgIf</code>, <code>uniqIf</code>. Это визитная карточка диалекта."
    },
    {
      q: "Продакт просит поправить 200 строк в таблице событий на 4 млрд записей. Что ответить?",
      opts: [
        "Точечный UPDATE — тяжёлая мутация; лучше чинить при чтении через словарь или перезалить партицию",
        "Сделать UPDATE, это быстро",
        "Удалить таблицу и создать заново",
        "В ClickHouse данные нельзя менять никак"
      ],
      right: 0,
      why: "Мутации существуют, но переписывают куски данных целиком. Штатные пути — исправление на чтении через <code>dictGet</code> или перезаливка партиции. Умение это объяснить ценится не меньше, чем умение писать SQL."
    }
  ],

  links: [
    { t: "ClickHouse: официальная документация", url: "https://clickhouse.com/docs", src: "clickhouse.com", lang: "EN",
      d: "Начните с раздела SQL Reference → Functions. Документация у них редкого качества: с примерами и объяснением, почему сделано именно так." },
    { t: "Комбинаторы агрегатных функций", url: "https://clickhouse.com/docs/sql-reference/aggregate-functions/combinators", src: "clickhouse.com", lang: "EN",
      d: "Суффиксы -If, -Array, -State, -Merge. Прочитать обязательно: это то, что отличает знающего человека от переводчика синтаксиса." },
    { t: "Функции для продуктовой аналитики", url: "https://clickhouse.com/docs/sql-reference/aggregate-functions/parametric-functions", src: "clickhouse.com", lang: "EN",
      d: "windowFunnel, retention, sequenceMatch — воронки и ретеншен одной функцией. Именно ради этого ClickHouse и ставят в продуктовых командах." },
    { t: "Поиграть с ClickHouse без установки", url: "https://sql.clickhouse.com/", src: "clickhouse.com", lang: "EN",
      d: "Публичная песочница с реальными датасетами на миллиарды строк. Можно писать запросы прямо в браузере и увидеть скорость своими глазами." },
    { t: "Хаб ClickHouse на Хабре", url: "https://habr.com/ru/hubs/clickhouse/articles/", src: "habr.com", lang: "RU",
      d: "Опыт российских команд: как готовят таблицы, какие грабли собирают. Практика, которой нет в документации." }
  ]
};

/* ---------------------------------------------------------- */
/* 1.8 — проект: анализ поведения пользователей                 */
/* ---------------------------------------------------------- */

window.CONTENT.m1l8 = {
  intro: "Финал модуля: один рабочий день аналитика целиком. Воронка, конверсии, брошенные корзины, повторные покупки — и вывод, который несут продакту.",
  duration: "≈ 2,5 часа",
  plan: [
    { m: "20 мин", w: "Теория: как устроена воронка и где в ней врут" },
    { m: "45 мин", w: "Основная задача: воронка по событиям" },
    { m: "60 мин", w: "Тренажёр: 5 продуктовых вопросов" },
    { m: "15 мин", w: "Самопроверка и сборка выводов" }
  ],

  theory: `
<p class="lead">Всё, что вы разобрали в модуле, собирается в одну работу: превратить таблицу событий в понятную картину «где мы теряем людей». Это буквально то, чем джун занимается первые месяцы.</p>

<h3>Что такое воронка</h3>
<p>Воронка — последовательность шагов, которые проходит пользователь на пути к цели. У нас пять шагов:</p>
<pre><code>visit -> view_product -> add_to_cart -> checkout -> purchase</code></pre>
<p>На каждом шаге часть людей отваливается. Задача аналитика — показать, <em>где именно</em> отвал самый большой, потому что чинить надо самое узкое место, а не то, что первым пришло в голову продакту.</p>

<h3>Две конверсии, которые нельзя путать</h3>
<table>
  <tr><th>Метрика</th><th>Как считается</th><th>На какой вопрос отвечает</th></tr>
  <tr><td>Сквозная (from start)</td><td>шаг N / шаг 1</td><td>«какая доля всех посетителей дошла сюда»</td></tr>
  <tr><td>Пошаговая (step-to-step)</td><td>шаг N / шаг N−1</td><td>«какая доля дошедших до прошлого шага прошла дальше»</td></tr>
</table>
<p>Сквозная показывает масштаб потерь, пошаговая — место потерь. В отчёте нужны обе: первая отвечает «сколько денег теряем», вторая — «что чинить».</p>

<div class="callout trap">
  <span class="ct">Три способа посчитать воронку неправильно</span>
  <p><strong>1. Считать события, а не людей.</strong> Один пользователь может пять раз положить товар в корзину. <code>COUNT(*)</code> по событиям даст 279 «добавлений» при 175 реальных людях. Воронку почти всегда считают по уникальным пользователям.</p>
  <p><strong>2. Не проверять порядок шагов.</strong> Наивный подсчёт «сколько людей вообще делали событие checkout» включает и тех, кто попал туда по прямой ссылке, минуя корзину. На маленьких данных этим можно пренебречь, на реальных — нет, там появляются конверсии больше 100%.</p>
  <p style="margin-bottom:0"><strong>3. Не ограничивать окно.</strong> Если человек зашёл в январе, а купил в сентябре, — считать ли это конверсией? Обычно фиксируют окно: «дошёл до покупки в течение 7 дней». Без окна метрика будет медленно расти сама по себе, и это выглядит как рост продукта.</p>
</div>

<h3>Порядок работы над задачей</h3>
<p>Хороший аналитик не начинает с запроса. Он начинает с проверок:</p>
<ol>
  <li><strong>Сколько всего строк и за какой период.</strong> <code>SELECT COUNT(*), MIN(date), MAX(date) FROM events</code>. Это ловит неполные периоды — главный источник ложных «падений».</li>
  <li><strong>Какие вообще бывают значения.</strong> <code>SELECT event_name, COUNT(*) FROM events GROUP BY 1</code>. Иногда обнаруживаются опечатки в названиях событий или два варианта одного шага.</li>
  <li><strong>Есть ли дубли и сироты.</strong> Проверка из урока 1.1: заказы с несуществующими пользователями.</li>
  <li><strong>И только потом</strong> — основной запрос.</li>
</ol>
<p>Эти четыре шага занимают пять минут и спасают от отчёта, который придётся переделывать.</p>

<div class="callout work">
  <span class="ct">Где это в работе</span>
  <p>«Воронка регистрации», «воронка оформления заказа», «воронка онбординга» — первое, что просят построить нового аналитика в продуктовой команде. И первое, что он показывает на демо. Умение сделать это за час, а не за день, определяет, дадут ли вам следующую задачу интереснее.</p>
</div>
`,

  ticket: {
    from: "Костя, продакт",
    subj: "Воронка: где мы теряем людей",
    body: `
<p>Перед планированием квартала нужна честная картина воронки. Считаем по <strong>уникальным пользователям</strong>, по всей истории.</p>
<p>Шаги в таком порядке: <code>visit</code> → <code>view_product</code> → <code>add_to_cart</code> → <code>checkout</code> → <code>purchase</code>.</p>
<p>Столбцы:</p>
<ul>
  <li><code>step_name</code> — название шага</li>
  <li><code>users_cnt</code> — сколько уникальных пользователей сделали это событие</li>
  <li><code>from_start_pct</code> — доля от первого шага, в процентах, 1 знак</li>
  <li><code>from_prev_pct</code> — доля от предыдущего шага, в процентах, 1 знак</li>
</ul>
<p>Порядок строк — по порядку шагов воронки, не по алфавиту и не по количеству. У первого шага <code>from_prev_pct</code> оставь пустым.</p>
`
  },

  schema: window.SH.sqlSchema,

  starter: `-- Воронка по уникальным пользователям
-- Шаг 1: посчитать пользователей на каждом шаге и задать порядок шагов
-- Шаг 2: посчитать доли от первого и от предыдущего шага

WITH funnel AS (
    -- здесь пять строк: шаг, его номер, количество пользователей
)
SELECT
FROM funnel
ORDER BY
`,

  expected: {
    ordered: true,
    columns: ["step_name", "users_cnt", "from_start_pct", "from_prev_pct"],
    rows: [
      ["visit", 220, 100.0, null],
      ["view_product", 206, 93.6, 93.6],
      ["add_to_cart", 175, 79.5, 85.0],
      ["checkout", 121, 55.0, 69.1],
      ["purchase", 64, 29.1, 52.9]
    ]
  },

  hints: [
    "Главная сложность — порядок шагов. В данных они лежат текстом, и обычный <code>ORDER BY step_name</code> даст алфавит: add_to_cart, checkout, purchase… Как задать свой порядок? Самый простой способ — собрать CTE, где рядом с названием шага явно указан его номер.",
    "Соберите CTE через <code>UNION ALL</code>: пять блоков вида <code>SELECT 1 AS step_no, 'visit' AS step_name, COUNT(DISTINCT user_id) AS users_cnt FROM events WHERE event_name = 'visit'</code>. Теперь у каждого шага есть номер, и сортировка работает. Дальше: как получить количество пользователей на <em>первом</em> шаге в каждой строке?",
    "Два способа. Первый: скалярный подзапрос <code>(SELECT users_cnt FROM funnel WHERE step_no = 1)</code>. Второй, короче: оконная функция <code>FIRST_VALUE(users_cnt) OVER (ORDER BY step_no)</code>. Для доли от предыдущего шага возьмите <code>LAG(users_cnt) OVER (ORDER BY step_no)</code> — у первой строки она даст <code>NULL</code>, ровно как просили. И не забудьте <code>* 100.0</code> с точкой."
  ],

  solution: `-- Воронка по уникальным пользователям
WITH funnel AS (
    -- Порядок шагов задаём явно номером: в данных он текстовый
    -- и по алфавиту выстроится неправильно
    SELECT 1 AS step_no, 'visit'        AS step_name, COUNT(DISTINCT user_id) AS users_cnt
    FROM events WHERE event_name = 'visit'
    UNION ALL
    SELECT 2, 'view_product', COUNT(DISTINCT user_id) FROM events WHERE event_name = 'view_product'
    UNION ALL
    SELECT 3, 'add_to_cart',  COUNT(DISTINCT user_id) FROM events WHERE event_name = 'add_to_cart'
    UNION ALL
    SELECT 4, 'checkout',     COUNT(DISTINCT user_id) FROM events WHERE event_name = 'checkout'
    UNION ALL
    SELECT 5, 'purchase',     COUNT(DISTINCT user_id) FROM events WHERE event_name = 'purchase'
)
SELECT
    step_name,
    users_cnt,
    -- FIRST_VALUE берёт значение первой строки окна — это шаг 1
    ROUND(users_cnt * 100.0 / FIRST_VALUE(users_cnt) OVER (ORDER BY step_no), 1) AS from_start_pct,
    -- LAG берёт предыдущий шаг; у первой строки его нет -> NULL
    ROUND(users_cnt * 100.0 / LAG(users_cnt) OVER (ORDER BY step_no), 1) AS from_prev_pct
FROM funnel
ORDER BY step_no;`,

  solutionNote: `
<p><strong>Что показывает воронка.</strong> До покупки доходят 29,1% посетителей. Самый большой провал — между <code>checkout</code> и <code>purchase</code>: теряется почти половина (52,9% проходят дальше). Второй по величине — между <code>add_to_cart</code> и <code>checkout</code> (69,1%).</p>
<p><strong>Вывод, который несут продакту:</strong> «Узкое место — оплата, а не витрина. Из 121 человека, начавшего оформление, платят 64. Если поднять этот шаг с 53% до 65%, получим +14 покупателей на текущем трафике — это дешевле, чем наливать новый трафик».</p>
<p><strong>Оговорка, которую обязан сделать аналитик:</strong> мы считали факт события, а не последовательность. Строго говоря, среди 121 «checkout» могли быть люди, не проходившие через корзину. На наших данных это несущественно, но на реальных надо проверять порядок — например, через <code>windowFunnel</code> в ClickHouse или через сравнение временных меток.</p>
<p><strong>Куда смотреть дальше.</strong> Разложить последний шаг по платформам и каналам: если провал сидит в одной платформе, это техническая поломка, а не проблема продукта. Именно этим займётесь в модуле 4.</p>
`,

  drills: [
    {
      title: "Проверка данных перед работой",
      level: "easy",
      body: `<p>Прежде чем строить любой отчёт, аналитик проверяет данные. Напишите один запрос, который выведет: <code>events_cnt</code>, <code>users_cnt</code>, <code>first_date</code>, <code>last_date</code> и <code>event_types</code> (сколько разных названий событий).</p>
<p>Затем отдельным запросом посмотрите распределение по <code>event_name</code>. Найдите в нём то, что стоит обсудить с продуктом.</p>`,
      solution: `-- Общая картина
SELECT
    COUNT(*) AS events_cnt,
    COUNT(DISTINCT user_id) AS users_cnt,
    MIN(event_date) AS first_date,
    MAX(event_date) AS last_date,
    COUNT(DISTINCT event_name) AS event_types
FROM events;

-- Распределение по типам
SELECT
    event_name,
    COUNT(*) AS cnt,
    COUNT(DISTINCT user_id) AS users
FROM events
GROUP BY event_name
ORDER BY cnt DESC;`,
      note: `<p>Обратите внимание: 71 событие <code>purchase</code> у 64 пользователей, но оплаченных заказов в <code>orders</code> — 189 у 104 покупателей. Числа не сходятся. Это не ошибка в вашем запросе, а нормальная ситуация в реальных данных: события и транзакции приходят из разных систем. Первое, что делает аналитик, обнаружив такое, — идёт выяснять, какой источник считается истиной для денег. Обычно это транзакционная база, а не события.</p>`
    },
    {
      title: "Брошенные корзины по каналам",
      level: "mid",
      body: `<p>Маркетинг хочет запустить письма «вы забыли товар в корзине» и спрашивает, по какому каналу это даст больше всего.</p>
<p>Выведите <code>channel</code>, <code>cart_users</code> (сколько людей клали товар в корзину), <code>abandoned</code> (из них не дошли до <code>purchase</code>) и <code>abandon_rate</code> в процентах с одним знаком. Сортировка по <code>abandon_rate</code> убыванием.</p>`,
      solution: `WITH cart AS (
    SELECT DISTINCT user_id FROM events WHERE event_name = 'add_to_cart'
),
bought AS (
    SELECT DISTINCT user_id FROM events WHERE event_name = 'purchase'
)
SELECT
    u.channel,
    COUNT(*) AS cart_users,
    SUM(CASE WHEN b.user_id IS NULL THEN 1 ELSE 0 END) AS abandoned,
    ROUND(SUM(CASE WHEN b.user_id IS NULL THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1) AS abandon_rate
FROM cart c
JOIN users u  ON u.user_id = c.user_id
LEFT JOIN bought b ON b.user_id = c.user_id
GROUP BY u.channel
ORDER BY abandon_rate DESC;`,
      note: `<p>Первое место — referral с 90%, но там всего 10 человек: на таком объёме процент ничего не значит. Реальная цель для рассылки — paid_search: 72,1% при 43 пользователях, то есть 31 человек. <strong>Правило:</strong> сортируя по проценту, всегда смотрите на знаменатель. Иначе вы принесёте команде задачу, которая физически не может дать эффекта.</p>`
    },
    {
      title: "Первый заказ дороже последующих?",
      level: "mid",
      body: `<p>Распространённая гипотеза: люди осторожничают в первый раз и покупают на меньшую сумму. Проверьте её.</p>
<p>Выведите <code>kind</code> ('первый' / 'последующие'), <code>orders_cnt</code> и <code>avg_check</code>. Только оплаченные заказы.</p>`,
      solution: `WITH numbered AS (
    SELECT
        user_id,
        revenue,
        ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY order_date, order_id) AS rn
    FROM orders
    WHERE status = 'paid'
)
SELECT
    CASE WHEN rn = 1 THEN 'первый' ELSE 'последующие' END AS kind,
    COUNT(*) AS orders_cnt,
    ROUND(AVG(revenue), 2) AS avg_check
FROM numbered
GROUP BY kind
ORDER BY kind;`,
      note: `<p>3 494 против 3 412 — разница 2,3%, то есть гипотеза не подтвердилась. Это <em>тоже результат</em>, и его надо честно сообщить: «проверили, эффекта нет, копать в эту сторону не стоит». Отрицательный ответ экономит команде недели работы, и хороший аналитик приносит его так же уверенно, как положительный.</p>`
    },
    {
      title: "Конверсия по городам",
      level: "mid",
      body: `<p>Выведите <code>city</code>, <code>visitors</code> (пользователи с событием <code>visit</code>), <code>purchasers</code> (из них с событием <code>purchase</code>) и <code>cr</code> в процентах. Сортировка по <code>cr</code> убыванием.</p>
<p>Посмотрев на результат, сформулируйте, что бы вы сказали продакту — и чего говорить не стали бы.</p>`,
      solution: `WITH visitors AS (
    SELECT DISTINCT user_id FROM events WHERE event_name = 'visit'
),
purchasers AS (
    SELECT DISTINCT user_id FROM events WHERE event_name = 'purchase'
)
SELECT
    u.city,
    COUNT(*) AS visitors,
    COUNT(p.user_id) AS purchasers,
    ROUND(COUNT(p.user_id) * 100.0 / COUNT(*), 1) AS cr
FROM visitors v
JOIN users u ON u.user_id = v.user_id
LEFT JOIN purchasers p ON p.user_id = v.user_id
GROUP BY u.city
ORDER BY cr DESC;`,
      note: `<p>Казань — 40,4% против 23,3% в Екатеринбурге. Разрыв почти вдвое выглядит сенсационно, но: 19 покупателей из 47. Сдвиньте три человека — и Казань окажется на уровне остальных. Сказать стоит: «есть сигнал, что в Казани конверсия выше, но выборка маленькая, я бы посмотрел ещё раз через месяц». Не стоит: «в Казани работает лучше, давайте переносить туда бюджет».</p>`
    },
    {
      title: "Retention второго месяца",
      level: "hard",
      body: `<p>Финальная задача модуля. Для каждой когорты по <strong>месяцу первой покупки</strong> посчитайте, какая доля покупателей сделала ещё одну покупку в интервале 30–60 дней после первой.</p>
<p>Столбцы: <code>cohort</code>, <code>buyers</code>, <code>returned</code>, <code>m1_retention</code> (проценты, 1 знак).</p>`,
      solution: `WITH first_order AS (
    SELECT
        user_id,
        MIN(order_date) AS first_date
    FROM orders
    WHERE status = 'paid'
    GROUP BY user_id
)
SELECT
    strftime('%Y-%m', f.first_date) AS cohort,
    COUNT(*) AS buyers,
    SUM(CASE WHEN EXISTS (
            SELECT 1 FROM orders o
            WHERE o.user_id = f.user_id
              AND o.status = 'paid'
              -- окно второго месяца: 30–60 дней после первой покупки
              AND o.order_date >= date(f.first_date, '+30 day')
              AND o.order_date <  date(f.first_date, '+60 day')
        ) THEN 1 ELSE 0 END) AS returned,
    ROUND(
        SUM(CASE WHEN EXISTS (
            SELECT 1 FROM orders o
            WHERE o.user_id = f.user_id
              AND o.status = 'paid'
              AND o.order_date >= date(f.first_date, '+30 day')
              AND o.order_date <  date(f.first_date, '+60 day')
        ) THEN 1 ELSE 0 END) * 100.0 / COUNT(*),
    1) AS m1_retention
FROM first_order f
GROUP BY cohort
ORDER BY cohort;`,
      note: `<p>Retention второго месяца колеблется около 20–33%. Две крайние строки надо выбросить из выводов: январь (5 покупателей) и август (1 покупатель, ретеншен «100%»). Это не когорты, это шум.</p>
<p>Обратите внимание на структуру решения: одинаковый <code>EXISTS</code> написан дважды. В боевом коде его выносят в CTE — попробуйте переписать самостоятельно, это хорошая тренировка.</p>`
    }
  ],

  quiz: [
    {
      q: "Почему воронку считают по уникальным пользователям, а не по событиям?",
      opts: [
        "Так быстрее работает запрос",
        "Один человек делает шаг много раз, и события завысят ширину воронки",
        "Это требование BI-систем",
        "События содержат дубли по техническим причинам"
      ],
      right: 1,
      why: "279 событий add_to_cart против 175 уникальных пользователей — почти в полтора раза. Считая события, вы получите конверсии, которые невозможно интерпретировать."
    },
    {
      q: "Конверсия шага 52,9% «от предыдущего» и 29,1% «от начала». Что это значит?",
      opts: [
        "29,1% — это конверсия в деньги",
        "Одна из цифр посчитана неверно",
        "Из дошедших до прошлого шага прошли дальше 52,9%, а от всех посетителей дошли 29,1%",
        "52,9% относится к другому периоду"
      ],
      right: 2,
      why: "Это две разные метрики на одном шаге. Пошаговая показывает, где чинить; сквозная — сколько всего теряем. В отчёте нужны обе."
    },
    {
      q: "Referral: 90% брошенных корзин при 10 пользователях. Что сказать маркетингу?",
      opts: [
        "Начинать рассылку с referral — там худшая конверсия",
        "Ничего, данные некорректны",
        "Отключить канал referral",
        "Выборка слишком мала: 90% от 10 человек — это 9 человек, эффекта не будет"
      ],
      right: 3,
      why: "Сортировка по проценту без взгляда на знаменатель — способ принести команде бессмысленную задачу. Реальная цель здесь paid_search: 31 человек против 9."
    },
    {
      q: "Событий purchase — 71, а оплаченных заказов в orders — 189. Что делать?",
      opts: [
        "Выяснить, какой источник считается истиной для денег — обычно транзакционная база",
        "Использовать среднее",
        "Сложить оба числа",
        "Исправить запрос, где-то ошибка"
      ],
      right: 0,
      why: "События и транзакции почти всегда приходят из разных систем и расходятся. Это нормальная ситуация, и первое действие аналитика — не чинить запрос, а договориться об источнике истины."
    },
    {
      q: "Первый чек 3 494, последующие 3 412. Как доложить результат?",
      opts: [
        "Нужно больше данных, вывода нет",
        "Разница 2,3% — эффекта нет, копать в эту сторону не стоит",
        "Первый заказ дешевле",
        "Гипотеза подтвердилась, первый заказ дороже"
      ],
      right: 1,
      why: "Отрицательный результат — полноценный результат. Он экономит команде недели работы, и сообщать его надо так же уверенно, как положительный."
    },
    {
      q: "С чего начинается работа над новым отчётом?",
      opts: [
        "С написания основного запроса",
        "С выбора BI-инструмента",
        "С проверки данных: объём, период, справочники значений, дубли",
        "С согласования дизайна дашборда"
      ],
      right: 2,
      why: "Пять минут на проверки экономят день на переделку. Неполный период, опечатка в названии события или заказы-сироты ломают отчёт молча — и обнаруживаются уже после того, как его показали руководству."
    }
  ],

  links: [
    { t: "Funnel Analysis: как строить и как читать", url: "https://amplitude.com/blog/funnel-analysis", src: "amplitude.com", lang: "EN",
      d: "Продуктовый взгляд: какие вопросы закрывает воронка, где она врёт, как выбирать окно конверсии." },
    { t: "Задачи SQL по компаниям", url: "https://www.stratascratch.com/", src: "stratascratch.com", lang: "EN",
      d: "Воронки и конверсии — самый частый тип задач на продуктовых секциях. Здесь они разложены по работодателям." },
    { t: "SQL Interview Questions", url: "https://leetcode.com/problemset/database/", src: "leetcode.com", lang: "EN",
      d: "Прорешайте 20–30 задач уровня Medium перед собеседованиями. Этого достаточно, чтобы перестать нервничать на SQL-секции." },
    { t: "Хаб «Аналитика» на Хабре", url: "https://habr.com/ru/hubs/analytics/articles/", src: "habr.com", lang: "RU",
      d: "Разборы реальных продуктовых кейсов на русском: воронки, retention, ошибки в метриках." },
    { t: "Курс SQL для анализа данных целиком", url: "https://mode.com/sql-tutorial/", src: "Mode Analytics", lang: "EN",
      d: "Если после модуля остались пробелы — пройдите этот курс целиком за выходные. Он бесплатный и построен ровно вокруг задач аналитика." }
  ]
};
