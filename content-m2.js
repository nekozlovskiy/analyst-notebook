/* ============================================================
   Модуль 2 — Python и pandas
   ============================================================ */

/* ---------------------------------------------------------- */
/* 2.1 — pandas: groupby, merge, сводная                        */
/* ---------------------------------------------------------- */

window.CONTENT.m2l1 = {
  intro: "Тот же отчёт по каналам, что в модуле 1, но на Python. Заодно разбираемся, чем merge отличается от JOIN и почему count и nunique дают разные числа.",
  duration: "≈ 2 часа",
  plan: [
    { m: "30 мин", w: "Теория: Series, DataFrame, merge, groupby" },
    { m: "45 мин", w: "Основная задача: отчёт по каналам на pandas" },
    { m: "30 мин", w: "Тренажёр: 5 задач" },
    { m: "10 мин", w: "Самопроверка вопросами" },
    { m: "5 мин",  w: "Заметки" }
  ],

  theory: `
<p class="lead">SQL достаёт данные, pandas с ними работает. Граница проходит там, где нужно посчитать что-то, чего в SQL нет: скользящее среднее, перцентили, сложную чистку, или просто сохранить промежуточный результат и покрутить его так и эдак.</p>

<h3>Две структуры, и всё</h3>
<ul>
  <li><strong>Series</strong> — один столбец с индексом. По сути словарь, который умеет считать: <code>s.mean()</code>, <code>s.value_counts()</code>.</li>
  <li><strong>DataFrame</strong> — таблица, то есть словарь из Series с общим индексом.</li>
</ul>
<p><strong>Индекс</strong> — главное отличие pandas от Excel и от SQL. Это метки строк, по которым pandas выравнивает данные при любой операции. Отсюда и удобство, и большинство неожиданностей: если сложить две Series с разными индексами, получите <code>NaN</code> там, где метки не совпали.</p>

<h3>Словарь: SQL и pandas</h3>
<table>
  <tr><th>Задача</th><th>SQL</th><th>pandas</th></tr>
  <tr><td>отбор строк</td><td><code>WHERE status = 'paid'</code></td><td><code>df[df["status"] == "paid"]</code></td></tr>
  <tr><td>отбор столбцов</td><td><code>SELECT a, b</code></td><td><code>df[["a", "b"]]</code></td></tr>
  <tr><td>соединение</td><td><code>LEFT JOIN</code></td><td><code>a.merge(b, on="id", how="left")</code></td></tr>
  <tr><td>группировка</td><td><code>GROUP BY</code></td><td><code>df.groupby("ch").agg(...)</code></td></tr>
  <tr><td>уникальные</td><td><code>COUNT(DISTINCT x)</code></td><td><code>("x", "nunique")</code></td></tr>
  <tr><td>непустые</td><td><code>COUNT(x)</code></td><td><code>("x", "count")</code></td></tr>
  <tr><td>сортировка</td><td><code>ORDER BY x DESC</code></td><td><code>df.sort_values("x", ascending=False)</code></td></tr>
  <tr><td>первые N</td><td><code>LIMIT 10</code></td><td><code>df.head(10)</code></td></tr>
  <tr><td>оконная функция</td><td><code>OVER (PARTITION BY)</code></td><td><code>groupby(...).transform(...)</code></td></tr>
</table>

<h3>merge: тот же JOIN, те же грабли</h3>
<pre><code>m = users.merge(orders, on="user_id", how="left")</code></pre>
<ul>
  <li><code>how="inner"</code> — <strong>по умолчанию</strong>. Это первая ловушка: в SQL вы пишете <code>LEFT JOIN</code> осознанно, а здесь <code>inner</code> случается сам, и строки молча пропадают.</li>
  <li><code>how="left"</code>, <code>"right"</code>, <code>"outer"</code> — как в SQL.</li>
  <li>Строки размножаются точно так же: связь «один ко многим» после merge даст по строке на заказ.</li>
</ul>
<p>Полезная привычка: после каждого merge печатать <code>len(df)</code> до и после. Если число выросло сильнее ожидаемого, у вас размножение; если упало, вы потеряли строки на <code>inner</code>.</p>

<div class="example">
  <div class="example-h">Проверка после merge, которая экономит часы</div>
  <div class="example-b">
<pre><code>before = len(users)
m = users.merge(paid, on="user_id", how="left")
print(before, "->", len(m))          # 220 -> 269

# сколько пользователей потеряли?
print(m["user_id"].nunique())        # 220, ничего не потеряли

# индикатор совпадений: бесплатная диагностика
m = users.merge(paid, on="user_id", how="left", indicator=True)
print(m["_merge"].value_counts())</code></pre>
    <p>Параметр <code>indicator=True</code> добавляет столбец <code>_merge</code> со значениями <code>both</code>, <code>left_only</code>, <code>right_only</code>. Одна строчка, а показывает ровно то, что обычно выясняют получасовой отладкой.</p>
  </div>
</div>

<h3>groupby: agg с именованными столбцами</h3>
<p>Есть два способа записи. Старый возвращает многоуровневые заголовки, с которыми потом мучаются:</p>
<div class="cmp">
  <div class="bad">
    <span class="cmp-t">Так делать не надо</span>
<pre><code>df.groupby("channel").agg({
    "user_id": "nunique",
    "revenue": ["sum", "mean"]
})</code></pre>
    <p>Заголовки станут двухуровневыми, обращаться к ним неудобно, а имена столбцов будут <code>revenue_sum</code> только после ручного переименования.</p>
  </div>
  <div class="good">
    <span class="cmp-t">Именованная агрегация</span>
<pre><code>df.groupby("channel").agg(
    users_cnt=("user_id", "nunique"),
    revenue=("revenue", "sum"),
    aov=("revenue", "mean"),
)</code></pre>
    <p>Имена задаются сразу, заголовок плоский, читается как <code>SELECT ... AS ...</code>. Единственный способ, которым стоит пользоваться.</p>
  </div>
</div>

<h3>count против nunique</h3>
<p>Ровно та же история, что <code>COUNT(col)</code> и <code>COUNT(DISTINCT col)</code> в SQL:</p>
<ul>
  <li><code>"count"</code> — сколько непустых значений. После <code>left merge</code> у канала без заказов даст 0, потому что там <code>NaN</code>. Это удобно.</li>
  <li><code>"nunique"</code> — сколько разных значений. Единственный честный способ посчитать людей после merge.</li>
  <li><code>"size"</code> — сколько строк, включая <code>NaN</code>. Аналог <code>COUNT(*)</code>.</li>
</ul>

<div class="callout trap">
  <span class="ct">NaN живёт по своим правилам</span>
  <p><code>NaN</code> в pandas это не <code>None</code> и не ноль. Он не равен сам себе: <code>np.nan == np.nan</code> даёт <code>False</code>. Проверять надо через <code>.isna()</code>.</p>
  <p>Агрегаты <code>NaN</code> пропускают: <code>sum()</code> по пустому набору вернёт <code>0.0</code>, а <code>mean()</code> вернёт <code>NaN</code>. Деление 0 на 0 тоже даёт <code>NaN</code>, и он уезжает в отчёт, если не закрыть <code>.fillna(0)</code>.</p>
  <p style="margin-bottom:0">Ещё одна тонкость: столбец целых чисел, в котором появился <code>NaN</code>, автоматически становится <code>float</code>. Отсюда <code>1.0</code> вместо <code>1</code> в отчёте и необходимость <code>.astype(int)</code> после <code>fillna</code>.</p>
</div>

<h3>SettingWithCopyWarning: что это и как не ловить</h3>
<pre><code>paid = orders[orders["status"] == "paid"]   # это может быть view, а может копия
paid["big"] = paid["revenue"] > 5000        # предупреждение и, возможно, ничего не запишется</code></pre>
<p>Правильно — сказать явно, что вам нужна копия:</p>
<pre><code>paid = orders[orders["status"] == "paid"].copy()
paid["big"] = paid["revenue"] > 5000</code></pre>
<p>Либо не создавать промежуточную переменную и писать через <code>.loc</code>. Предупреждение выглядит безобидно, но за ним стоит настоящая проблема: изменение может не примениться.</p>

<div class="callout work">
  <span class="ct">Где это в работе</span>
  <p>Аналитик редко пишет только SQL или только Python. Обычный день выглядит так: запрос вытащил сырые данные, дальше pandas чистит, считает производные метрики и складывает результат в таблицу или график. Умение переложить один и тот же расчёт из SQL в pandas и сверить числа — базовая проверка на ошибку, которую делают перед каждым важным отчётом.</p>
</div>

<div class="callout jobs">
  <span class="ct">Что закрывает урок в вакансиях</span>
  <ul>
    <li>«Python: pandas, numpy» — примерно 70 процентов вакансий Junior Data Analyst</li>
    <li>«Автоматизация регулярной отчётности» — то, ради чего pandas и берут</li>
    <li>Вопрос на интервью: «чем merge отличается от join и какой how по умолчанию»</li>
  </ul>
</div>
`,

  ticket: {
    from: "Ира, performance-маркетинг",
    subj: "Тот же отчёт по каналам, но с конверсией",
    body: `
<p>Сводку из первого модуля обсудили, теперь нужно чуть больше. Собери на Python таблицу по каналам:</p>
<ul>
  <li><code>channel</code> — канал</li>
  <li><code>users_cnt</code> — всего пользователей канала</li>
  <li><code>buyers_cnt</code> — сколько из них хоть раз оплатили заказ</li>
  <li><code>orders_cnt</code> — количество оплаченных заказов</li>
  <li><code>revenue</code> — выручка, 2 знака</li>
  <li><code>aov</code> — средний чек, 2 знака</li>
  <li><code>cr</code> — конверсия из пользователя в покупателя, в процентах, 1 знак</li>
</ul>
<p>Каналы без заказов оставляем, с нулями. Сортировка по выручке убыванием. Выведи через <code>print(res.to_string(index=False))</code>.</p>
`
  },

  schema: window.SH.pySchema,
  data: window.SH.pyData,
  packages: ["pandas"],
  prelude: window.SH.pyPrelude,

  starter: `# Отчёт по каналам привлечения
# users, orders и events уже загружены

# Шаг 1: оставить только оплаченные заказы
paid = 

# Шаг 2: присоединить заказы к пользователям, не потеряв каналы без заказов
m = 

# Шаг 3: сгруппировать по каналу и посчитать метрики
res = 

# Шаг 4: досчитать buyers_cnt, aov, cr; отсортировать; вывести
print(res.to_string(index=False))
`,

  expected: {
    stdout: `    channel  users_cnt  buyers_cnt  orders_cnt   revenue     aov   cr
    organic         75          40          74 271926.54 3674.68 53.3
paid_search         55          28          51 141330.95 2771.20 50.9
      email         28          16          28 122017.95 4357.78 57.1
     social         42          12          24  61776.11 2574.00 28.6
   referral         14           8          12  56377.23 4698.10 57.1
    partner          6           0           0      0.00    0.00  0.0`
  },

  hints: [
    "Порядок шагов такой же, как в SQL-версии: сначала фильтр по статусу, потом соединение, потом группировка. Какой <code>how</code> у <code>merge</code> сохранит канал <code>partner</code>, у которого нет ни одного заказа?",
    "<code>how=\"left\"</code>, слева <code>users</code>. После этого у <code>partner</code> будет строка, где <code>order_id</code> равен <code>NaN</code>. Дальше: <code>agg</code> с <code>(\"user_id\", \"nunique\")</code> даст всех пользователей канала, а вот <code>buyers_cnt</code> так не посчитать. Как отобрать только строки, где заказ реально есть?",
    "Через <code>m.dropna(subset=[\"order_id\"])</code>, дальше <code>groupby(\"channel\")[\"user_id\"].nunique()</code>. Полученную Series приклейте к результату через <code>.reindex(res.index)</code> и <code>.fillna(0).astype(int)</code>, иначе у <code>partner</code> будет <code>NaN</code>. Средний чек считайте как <code>revenue / orders_cnt</code> и обязательно закройте <code>.fillna(0)</code>: у <code>partner</code> это деление нуля на ноль."
  ],

  solution: `# Отчёт по каналам привлечения

# Шаг 1. Только оплаченные заказы. copy() — чтобы не поймать
# SettingWithCopyWarning, если позже добавим столбец
paid = orders[orders["status"] == "paid"].copy()

# Шаг 2. LEFT JOIN: слева users, чтобы не потерять каналы без заказов
m = users.merge(paid, on="user_id", how="left")

# Шаг 3. Группировка. Имена столбцов задаём сразу
res = m.groupby("channel").agg(
    users_cnt=("user_id", "nunique"),   # все пользователи канала
    orders_cnt=("order_id", "count"),   # count игнорирует NaN, у partner будет 0
    revenue=("revenue", "sum"),         # sum по пустому набору даёт 0.0
)

# Шаг 4. Покупатели: сначала выкидываем строки без заказа, потом уникальные
buyers = m.dropna(subset=["order_id"]).groupby("channel")["user_id"].nunique()
# reindex выравнивает по каналам из res, fillna закрывает partner нулём
res["buyers_cnt"] = buyers.reindex(res.index).fillna(0).astype(int)

# Шаг 5. Производные метрики. fillna(0) защищает от деления 0 на 0
res["aov"] = (res["revenue"] / res["orders_cnt"]).round(2).fillna(0)
res["cr"] = (res["buyers_cnt"] / res["users_cnt"] * 100).round(1)
res["revenue"] = res["revenue"].round(2)

# Шаг 6. Порядок столбцов, сортировка, сквозной индекс
res = res.reset_index()
res = res[["channel", "users_cnt", "buyers_cnt", "orders_cnt", "revenue", "aov", "cr"]]
res = res.sort_values("revenue", ascending=False).reset_index(drop=True)

print(res.to_string(index=False))`,

  solutionNote: `
<p><strong>Сверьте с SQL-версией из урока 1.1.</strong> Числа <code>users_cnt</code>, <code>orders_cnt</code> и <code>revenue</code> совпадают до копейки. Это хорошая привычка: один и тот же вопрос, посчитанный двумя инструментами, обязан давать один ответ. Расхождение всегда означает ошибку в одном из них.</p>
<p><strong>Частые ошибки в этой задаче:</strong></p>
<ul>
  <li><code>how="inner"</code> по умолчанию: канал <code>partner</code> молча исчезает, и этого никто не замечает;</li>
  <li><code>("user_id", "count")</code> вместо <code>nunique</code>: пользователь с тремя заказами посчитается трижды;</li>
  <li>забытый <code>.fillna(0)</code> у <code>aov</code>: в отчёт для маркетинга уезжает <code>NaN</code>;</li>
  <li>забытый <code>reset_index(drop=True)</code> после сортировки: индекс останется перемешанным.</li>
</ul>
<p><strong>Что читается в таблице.</strong> У <code>social</code> конверсия 28,6 процента при 42 пользователях, вдвое хуже остальных, и средний чек самый низкий. Это канал, который приводит людей, но не покупателей. У <code>email</code> и <code>referral</code> обратная картина: мало людей, но чек в полтора раза выше. Именно такие наблюдения и есть работа аналитика, а не сама таблица.</p>
`,

  drills: [
    {
      title: "Диагностика merge через indicator",
      level: "easy",
      body: `<p>Присоедините оплаченные заказы к пользователям через <code>how="outer"</code> с параметром <code>indicator=True</code> и напечатайте <code>value_counts()</code> столбца <code>_merge</code>.</p>
<p>Объясните себе каждое из трёх чисел: что означает <code>both</code>, что <code>left_only</code>, есть ли <code>right_only</code> и что бы это значило, если бы он был.</p>`,
      solution: `paid = orders[orders["status"] == "paid"]
m = users.merge(paid, on="user_id", how="outer", indicator=True)
print(m["_merge"].value_counts().to_string())`,
      note: `<p><code>both</code> — строки, где пара нашлась, то есть заказы. <code>left_only</code> — пользователи без оплаченных заказов. <code>right_only</code> должен быть нулём: это заказы, для которых не нашлось пользователя, то есть заказы-сироты. Если бы он был больше нуля, отчёт по каналам молча терял бы часть выручки. Проверка занимает одну строчку и стоит того, чтобы делать её всегда.</p>`
    },
    {
      title: "Сводная таблица: город на канал",
      level: "mid",
      body: `<p>Постройте сводную таблицу выручки: строки — города, столбцы — каналы, значения — сумма оплаченной выручки, пустые ячейки нулями. Добавьте итоги по строкам и столбцам.</p>
<p>Понадобится <code>pd.pivot_table</code> с параметрами <code>fill_value</code> и <code>margins</code>.</p>`,
      solution: `paid = orders[orders["status"] == "paid"]
m = users.merge(paid, on="user_id", how="inner")

pt = pd.pivot_table(
    m,
    index="city",
    columns="channel",
    values="revenue",
    aggfunc="sum",
    fill_value=0,
    margins=True,          # добавит строку и столбец All
    margins_name="Итого",
).round(0)

print(pt.to_string())`,
      note: `<p><code>pivot_table</code> — это <code>groupby</code> по двум ключам плюс разворот одного из них в столбцы. Всё, что делают в Excel мышкой, здесь делается одним вызовом и повторяется завтра без единого клика. Именно за это pandas и берут в отчётность.</p>`
    },
    {
      title: "transform вместо оконной функции",
      level: "mid",
      body: `<p>Для каждого оплаченного заказа посчитайте долю в общей сумме трат его покупателя: столбцы <code>user_id</code>, <code>order_id</code>, <code>revenue</code>, <code>share_pct</code>. Выведите строки пользователей 3, 13 и 103.</p>
<p>Это ровно то же, что <code>SUM(...) OVER (PARTITION BY user_id)</code> из урока 1.2. В pandas такое делает <code>groupby(...).transform</code>.</p>`,
      solution: `paid = orders[orders["status"] == "paid"].copy()

# transform возвращает Series той же длины, что исходный DataFrame,
# то есть работает как оконная функция, а не как groupby.agg
paid["user_total"] = paid.groupby("user_id")["revenue"].transform("sum")
paid["share_pct"] = (paid["revenue"] / paid["user_total"] * 100).round(1)

sel = paid[paid["user_id"].isin([3, 13, 103])]
print(sel[["user_id", "order_id", "revenue", "share_pct"]].to_string(index=False))`,
      note: `<p>Разница между <code>agg</code> и <code>transform</code> — ровно разница между <code>GROUP BY</code> и оконной функцией. <code>agg</code> схлопывает группы, <code>transform</code> возвращает столько же строк, сколько было. Держите эту аналогию в голове, она снимает большинство вопросов.</p>`
    },
    {
      title: "Топ-3 заказа в каждом городе",
      level: "mid",
      body: `<p>Повторите задачу из урока 1.2 на pandas: по каждому городу три самых крупных оплаченных заказа. Столбцы <code>city</code>, <code>order_id</code>, <code>revenue</code>. Сортировка по городу, внутри — по убыванию суммы.</p>
<p>Подсказка: понадобится <code>sort_values</code> и <code>groupby(...).head(3)</code>.</p>`,
      solution: `paid = orders[orders["status"] == "paid"]
m = users.merge(paid, on="user_id", how="inner")

top = (m.sort_values(["city", "revenue"], ascending=[True, False])
         .groupby("city")
         .head(3))

print(top[["city", "order_id", "revenue"]].to_string(index=False))`,
      note: `<p><code>groupby(...).head(n)</code> после сортировки — самый короткий способ взять топ-N внутри группы. Аналог <code>ROW_NUMBER() ... WHERE rn &lt;= 3</code>, только короче на четыре строки. Сверьте результат с SQL-версией: заказ 198 в Казани на 10 177,29 должен быть первым.</p>`
    },
    {
      title: "Своя функция в agg",
      level: "hard",
      body: `<p>Посчитайте по каналам: <code>revenue</code>, <code>median</code> (медианный чек) и <code>p90</code> — 90-й перцентиль чека. Готовой строки <code>"p90"</code> в pandas нет, её придётся передать функцией.</p>
<p>Сортировка по выручке убыванием, только каналы с заказами.</p>`,
      solution: `paid = orders[orders["status"] == "paid"]
m = users.merge(paid, on="user_id", how="inner")

def p90(s):
    """90-й перцентиль: выше этой суммы только десятая часть заказов."""
    return s.quantile(0.90)

rep = (m.groupby("channel")
         .agg(revenue=("revenue", "sum"),
              median=("revenue", "median"),
              p90=("revenue", p90))     # передаём функцию, а не строку
         .round(2)
         .sort_values("revenue", ascending=False))

print(rep.to_string())`,
      note: `<p>В <code>agg</code> можно передать любую функцию, которая принимает Series и возвращает число. Так добавляют перцентили, взвешенные средние, долю значений выше порога. Медиана и p90 рядом со средним показывают форму распределения: если p90 сильно выше медианы, у канала есть хвост крупных заказов, и средний чек по нему обманчив.</p>`
    }
  ],

  quiz: [
    {
      q: "Какой <code>how</code> у <code>merge</code> по умолчанию?",
      opts: ["Зависит от данных", "left", "outer", "inner"],
      right: 3,
      why: "Это главная ловушка перехода с SQL: там вы пишете вид соединения явно, здесь <code>inner</code> подставляется молча, и строки без пары исчезают вместе с частью выручки."
    },
    {
      q: "После <code>left merge</code> у канала без заказов <code>agg((\"order_id\", \"count\"))</code> даст:",
      opts: ["NaN", "0", "1", "Ошибку"],
      right: 1,
      why: "<code>count</code> считает непустые значения, а там <code>NaN</code>. Получится честный ноль. А вот <code>\"size\"</code> дал бы 1, потому что строка-то есть."
    },
    {
      q: "Чем <code>groupby(...).transform(\"sum\")</code> отличается от <code>groupby(...).agg(\"sum\")</code>?",
      opts: [
        "Ничем, это синонимы",
        "transform возвращает столько же строк, сколько было: это аналог оконной функции",
        "transform работает только с числами",
        "agg быстрее"
      ],
      right: 1,
      why: "<code>agg</code> схлопывает группы как <code>GROUP BY</code>, <code>transform</code> раскладывает результат обратно по строкам как <code>SUM() OVER (PARTITION BY ...)</code>."
    },
    {
      q: "Столбец целых чисел после появления NaN стал float. Почему?",
      opts: [
        "Ошибка pandas",
        "Так задано в настройках",
        "У обычного int-типа нет способа хранить пропуск, поэтому столбец переводится в float",
        "Потому что использовался merge"
      ],
      right: 2,
      why: "Отсюда <code>1.0</code> вместо <code>1</code> в отчётах. Лечится через <code>.fillna(0).astype(int)</code> или через nullable-тип <code>Int64</code> с большой буквы."
    },
    {
      q: "Что означает SettingWithCopyWarning?",
      opts: [
        "Не хватает памяти",
        "Устаревший синтаксис",
        "Данные повреждены",
        "Вы пишете в объект, который может оказаться копией, и запись может не примениться"
      ],
      right: 3,
      why: "Предупреждение выглядит безобидным, но за ним настоящая проблема. Лечится добавлением <code>.copy()</code> при создании подвыборки или записью через <code>.loc</code>."
    },
    {
      q: "Как честно посчитать число пользователей после merge «один ко многим»?",
      opts: [
        "(\"user_id\", \"nunique\")",
        "(\"user_id\", \"size\")",
        "len(df)",
        "(\"user_id\", \"count\")"
      ],
      right: 0,
      why: "Строки размножены по числу заказов, поэтому <code>count</code> и <code>size</code> посчитают заказы, а не людей. Точно так же, как <code>COUNT(*)</code> против <code>COUNT(DISTINCT ...)</code> в SQL."
    }
  ],

  links: [
    { t: "10 minutes to pandas", url: "https://pandas.pydata.org/docs/user_guide/10min.html", src: "pandas.pydata.org", lang: "EN",
      d: "Официальное быстрое введение. Читается за вечер и закрывает весь базовый синтаксис, который нужен аналитику." },
    { t: "Merge, join и concatenate", url: "https://pandas.pydata.org/docs/user_guide/merging.html", src: "pandas.pydata.org", lang: "EN",
      d: "Раздел с картинками про каждый вид соединения. Именно здесь описан параметр indicator, который стоит завести в привычку." },
    { t: "Group by: split-apply-combine", url: "https://pandas.pydata.org/docs/user_guide/groupby.html", src: "pandas.pydata.org", lang: "EN",
      d: "Разница между agg, transform и apply объяснена на примерах. Самая полезная страница документации для аналитика." },
    { t: "Курс pandas на Kaggle", url: "https://www.kaggle.com/learn/pandas", src: "kaggle.com", lang: "EN",
      d: "Шесть уроков с задачами и автопроверкой прямо в браузере. Бесплатно, занимает выходные." },
    { t: "Comparison with SQL", url: "https://pandas.pydata.org/docs/getting_started/comparison/comparison_with_sql.html", src: "pandas.pydata.org", lang: "EN",
      d: "Прямая таблица соответствий SQL и pandas. Держите открытой первое время, экономит много поисков." },
    { t: "Хаб Python на Хабре", url: "https://habr.com/ru/hubs/python/articles/", src: "habr.com", lang: "RU",
      d: "Практические разборы на русском. Ищите статьи про pandas и обработку данных для аналитики." }
  ]
};

/* ---------------------------------------------------------- */
/* 2.2 — очистка данных                                         */
/* ---------------------------------------------------------- */

window.CONTENT.m2l2 = {
  intro: "Настоящая выгрузка из CRM: дубли, пропуски, деньги текстом, даты в двух форматах и один и тот же город четырьмя способами. Это восемьдесят процентов работы аналитика.",
  duration: "≈ 2 часа",
  plan: [
    { m: "30 мин", w: "Теория: виды грязи и почему dropna опасен" },
    { m: "45 мин", w: "Основная задача: привести выгрузку в порядок" },
    { m: "30 мин", w: "Тренажёр: 5 задач на чистку" },
    { m: "10 мин", w: "Самопроверка вопросами" },
    { m: "5 мин",  w: "Заметки" }
  ],

  theory: `
<p class="lead">В учебных наборах данные чистые. В работе не бывает ни одного чистого. Сначала вы полдня приводите выгрузку в порядок, и только потом начинается то, что называется анализом. Кто делает первый этап аккуратно, у того второй занимает час.</p>

<h3>Шесть видов грязи</h3>
<table>
  <tr><th>Что</th><th>Как выглядит</th><th>Чем опасно</th></tr>
  <tr><td>Дубли</td><td>одна и та же строка дважды</td><td>выручка задваивается</td></tr>
  <tr><td>Пропуски</td><td>пусто, <code>n/a</code>, прочерк, ноль вместо пустоты</td><td>средние считаются не по тем строкам</td></tr>
  <tr><td>Типы</td><td>число хранится текстом</td><td>сортировка по алфавиту, суммы не считаются</td></tr>
  <tr><td>Форматы</td><td>две записи даты в одном столбце</td><td>половина дат не распознаётся</td></tr>
  <tr><td>Справочники</td><td><code>Москва</code>, <code>москва</code>, <code> Москва </code></td><td>один город превращается в три</td></tr>
  <tr><td>Невозможные значения</td><td>отрицательная сумма, возраст 200</td><td>тихо ломают любую агрегацию</td></tr>
</table>

<h3>С чего начинать: диагностика за пять минут</h3>
<pre><code>df.shape                     # сколько строк и столбцов
df.dtypes                    # какие типы: числа точно числа?
df.head(10)                  # глазами посмотреть на данные
df.isna().sum()              # пропуски по столбцам
df.duplicated().sum()        # полные дубли
df.describe()                # min, max, среднее: сразу видны невозможные значения
for c in df.columns:
    print(c, df[c].nunique())  # мало уникальных = справочник, много = ключ</code></pre>
<p>Эти семь строчек надо писать рефлекторно при знакомстве с любой новой таблицей. Они находят большую часть проблем до того, как вы потратите час на расчёт, который придётся выбросить.</p>

<div class="callout trap">
  <span class="ct">Почему нельзя просто написать dropna</span>
  <p><code>df.dropna()</code> удаляет строку, если хотя бы в одном столбце есть пропуск. В таблице на двадцать столбцов это может снести половину данных, причём не случайную половину.</p>
  <p>Пример: в CRM менеджер не заполняет город для мелких сделок. Вы делаете <code>dropna()</code>, и все мелкие сделки исчезают. Средний чек в отчёте вырастает на треть, и никто не понимает почему.</p>
  <p style="margin-bottom:0"><strong>Правильный порядок:</strong> сначала выяснить, <em>почему</em> пропуск. Дальше по ситуации: удалить строки (<code>subset=[...]</code> с конкретными столбцами), заполнить значением, оставить как есть и считать честно по непустым. И обязательно написать в отчёте, сколько строк выкинули.</p>
</div>

<h3>Пропуск пропуску рознь</h3>
<ul>
  <li><strong>Не заполнили случайно.</strong> Можно удалить или заполнить медианой, смещения почти не будет.</li>
  <li><strong>Не заполнили закономерно.</strong> Города нет у мелких сделок, дохода нет у тех, кто не хочет говорить. Удаление сместит выборку. Часто правильный ход — сделать отдельную категорию «не указан» и смотреть на неё как на самостоятельный сегмент.</li>
  <li><strong>Пропуск по смыслу ноль.</strong> Скидки не было, значит <code>NaN</code> в столбце «скидка» это 0. Тут заполнять обязательно, иначе <code>mean</code> посчитает не по тем строкам.</li>
</ul>

<h3>Деньги текстом</h3>
<p>Классика выгрузок: <code>"22 250,28"</code>. Здесь неразрывный пробел как разделитель тысяч и запятая как десятичная точка. Такое поле надо чинить руками:</p>
<pre><code>money = (df["deal_sum"].astype(str)
         .str.replace(" ", "", regex=False)     # обычный пробел
         .str.replace("\\u00a0", "", regex=False)  # неразрывный пробел
         .str.replace(",", ".", regex=False))
df["deal_sum"] = pd.to_numeric(money, errors="coerce")</code></pre>
<p><code>errors="coerce"</code> превращает всё нераспознанное в <code>NaN</code> вместо падения. Дальше вы считаете, сколько таких значений получилось, и решаете, что с ними делать. <strong>Никогда не используйте <code>errors="ignore"</code></strong>: столбец останется текстовым, а вы этого не заметите до момента, когда сумма выйдет строкой из склеенных чисел.</p>

<h3>Даты в двух форматах</h3>
<pre><code>d1 = pd.to_datetime(df["created"], format="%Y-%m-%d", errors="coerce")
d2 = pd.to_datetime(df["created"], format="%d.%m.%Y", errors="coerce")
df["created"] = d1.fillna(d2)</code></pre>
<p>Разбираем каждым форматом по очереди и склеиваем. Соблазн написать <code>pd.to_datetime(...)</code> без формата велик, но тогда pandas начнёт угадывать, и <code>05.03.2024</code> может стать пятым марта, а может третьим мая. На выгрузке в тысячу строк вы этого не заметите.</p>

<div class="callout note">
  <span class="ct">Правило, которое стоит запомнить дословно</span>
  <p style="margin-bottom:0">Любая чистка данных должна быть <strong>кодом, а не ручной правкой</strong>. Файл перевыгрузят завтра, и всё, что вы поправили мышкой в Excel, придётся делать заново. Скрипт отработает за секунду. Именно поэтому аналитиков учат pandas, а не продвинутому Excel.</p>
</div>

<h3>Справочники: одно значение, четыре написания</h3>
<pre><code>df["city"] = (df["city"]
              .str.strip()                                  # убрать пробелы по краям
              .replace({"спб": "Санкт-Петербург",
                        "СПб": "Санкт-Петербург"})          # синонимы
              .str.capitalize())                            # единый регистр</code></pre>
<p>Порядок важен: сначала пробелы, потом синонимы, потом регистр. Если сделать наоборот, <code>" Москва "</code> и <code>"москва"</code> останутся разными значениями. Проверить результат легко: <code>df["city"].value_counts()</code> должен показать ровно столько строк, сколько городов вы ожидаете.</p>

<div class="callout work">
  <span class="ct">Где это в работе</span>
  <p>Первая задача нового аналитика почти всегда звучит как «посмотри, что там в выгрузке». Умение за полчаса найти дубли, понять природу пропусков и привести всё к рабочему виду ценится выше, чем знание редких функций. И это же навык, который сразу видно на тестовом задании: у одних отчёт с <code>NaN</code> в середине, у других аккуратная таблица и приписка про сорок отброшенных строк.</p>
</div>

<div class="callout jobs">
  <span class="ct">Что закрывает урок в вакансиях</span>
  <ul>
    <li>«Подготовка и очистка данных» — строка почти в каждой вакансии</li>
    <li>«Внимание к качеству данных» — то, что проверяют тестовым заданием</li>
    <li>Вопрос на интервью: «что сделаете, если в данных 30 процентов пропусков»</li>
  </ul>
</div>
`,

  ticket: {
    from: "Дима, руководитель отдела продаж",
    subj: "Выгрузка лидов из CRM, посмотри что с ней",
    body: `
<p>Выгрузил лидов за год, хочу понять, какой источник даёт деньги. Выгрузка кривая, менеджеры заполняют кто во что горазд, плюс похоже я выгрузил дважды и склеил. Разберись, пожалуйста.</p>
<p>Нужен отчёт. Сначала шесть строк диагностики ровно в таком виде:</p>
<pre><code>строк в выгрузке: N
после удаления дублей: N
отрицательных сумм: N
лидов без суммы: N
источников после нормализации: N
городов после нормализации: N</code></pre>
<p>Потом пустая строка и сводка по источникам, по одной строке на источник, через пробел:</p>
<pre><code>источник лидов сделок сумма</code></pre>
<p>где <code>лидов</code> — сколько строк, <code>сделок</code> — у скольких сумма распознана, <code>сумма</code> — итог с двумя знаками. Сортировка по сумме убыванием. Строки без источника назови <code>не указан</code> и оставь в отчёте.</p>
<p>Важно: отрицательная сумма — ошибка ввода, такие считай как «нет суммы».</p>
`
  },

  schema: `
<p>Доступен один DataFrame <code>leads</code> — выгрузка из CRM, 63 строки. <strong>Все столбцы прочитаны как текст</strong> и пустые строки оставлены как есть: pandas ничего не угадывал за вас.</p>
<pre><code>leads (63, 7)
  lead_id   строка
  created   дата, два формата: '2024-06-26' и '16.04.2024'
  source    organic | paid_search | social | email | referral
            встречается в разном регистре, с пробелами,
            пустой строкой и как 'n/a'
  city      Москва | Санкт-Петербург | Новосибирск | Екатеринбург | Казань
            плюс 'СПб', разный регистр и пробелы по краям
  deal_sum  сумма сделки: '54546.00', '22 250,28', пусто, встречаются минусы
  status    новый | в работе | закрыт | отказ, в разном регистре
  manager   фамилия менеджера или пусто</code></pre>
<p>Полезные инструменты для этой задачи:</p>
<pre><code>df.drop_duplicates()                       # полные дубли
df.replace(["", "n/a"], np.nan)             # пустые строки в настоящие пропуски
s.str.strip() / .str.lower() / .str.capitalize()
s.str.replace(" ", "", regex=False)
pd.to_numeric(s, errors="coerce")           # текст в число, мусор в NaN
pd.to_datetime(s, format="...", errors="coerce")
df.groupby("source", dropna=False)          # dropna=False оставит группу NaN</code></pre>
`,

  data: ["leadsCSV"],
  packages: ["pandas"],
  prelude: `import io
import warnings
warnings.filterwarnings("ignore")

import pandas as pd
import numpy as np

# читаем всё текстом и без автоматических пропусков:
# чистка должна быть осознанной, а не побочным эффектом read_csv
leads = pd.read_csv(io.StringIO(leadsCSV), dtype=str, keep_default_na=False)
`,

  starter: `# Очистка выгрузки лидов
# leads уже загружен, все столбцы — текст

rows_raw = len(leads)

# Шаг 1: полные дубли

# Шаг 2: пустые строки и 'n/a' сделать настоящими пропусками

# Шаг 3: deal_sum в число, отрицательные считать ошибкой

# Шаг 4: source, city, status привести к единому виду

# Шаг 5: даты из двух форматов

# Шаг 6: печать диагностики и сводки
`,

  expected: {
    stdout: `строк в выгрузке: 63
после удаления дублей: 58
отрицательных сумм: 3
лидов без суммы: 10
источников после нормализации: 5
городов после нормализации: 5

paid_search 15 13 10328888.31
social 11 9 252918.02
organic 10 9 207525.24
не указан 8 6 174778.00
referral 8 6 170651.89
email 6 5 167403.94`
  },

  hints: [
    "Начните с диагностики, а не с кода: напечатайте <code>leads.head(12)</code>, <code>leads[\"source\"].value_counts()</code> и <code>leads[\"deal_sum\"].head(20)</code>. Пока вы не увидели данные глазами, любая чистка будет угадыванием. Обратите внимание на порядок действий: дубли надо убирать <strong>до</strong> всего остального, иначе вы почистите одну и ту же строку дважды.",
    "Суммы: <code>.str.replace(\" \", \"\", regex=False)</code>, потом замена запятой на точку, потом <code>pd.to_numeric(..., errors=\"coerce\")</code>. Отрицательные ловите условием <code>leads[\"deal_sum\"] &lt; 0</code>, считаете их количество, а затем присваиваете <code>np.nan</code> через <code>.loc</code>. Для справочников порядок такой: <code>.str.strip()</code>, затем <code>.replace</code> для синонимов вроде СПб, и только потом единый регистр.",
    "Два подводных камня. Первый: <code>nunique()</code> не считает <code>NaN</code>, поэтому «источников после нормализации» получится 5, хотя в сводке будет шесть строк вместе с «не указан», и это правильно. Второй: чтобы группа с пропуском не исчезла, нужен <code>groupby(\"source\", dropna=False)</code>. При печати проверяйте <code>pd.isna(source)</code> и подставляйте «не указан». Формат строки: <code>f\"{name} {int(leads_cnt)} {int(with_sum)} {total:.2f}\"</code>."
  ],

  solution: `# Очистка выгрузки лидов из CRM

rows_raw = len(leads)

# Шаг 1. Полные дубли. Обязательно ПЕРВЫМ действием:
# если чистить до дедупликации, работа делается дважды
leads = leads.drop_duplicates()
rows_dedup = len(leads)

# Шаг 2. Пустые строки и заглушки — это пропуски.
# Так они начнут корректно игнорироваться агрегатами
leads = leads.replace(["", " ", "n/a", "N/A", "-"], np.nan)

# Шаг 3. Деньги. '22 250,28' -> 22250.28
money = (leads["deal_sum"].astype(str)
         .str.replace(" ", "", regex=False)
         .str.replace("\\u00a0", "", regex=False)   # неразрывный пробел
         .str.replace(",", ".", regex=False))
leads["deal_sum"] = pd.to_numeric(money, errors="coerce")

# Отрицательная сумма сделки — ошибка ввода, а не факт.
# Считаем такие и обнуляем в NaN, чтобы не тянуть враньё в сумму
bad_sum = int((leads["deal_sum"] < 0).sum())
leads.loc[leads["deal_sum"] < 0, "deal_sum"] = np.nan
no_sum = int(leads["deal_sum"].isna().sum())

# Шаг 4. Справочники. Порядок важен: сначала пробелы,
# потом синонимы, и только потом регистр
leads["source"] = leads["source"].str.strip().str.lower()
leads["city"] = (leads["city"].str.strip()
                 .replace({"спб": "Санкт-Петербург", "СПб": "Санкт-Петербург"})
                 .str.capitalize())
leads["status"] = leads["status"].str.strip().str.lower()

# Шаг 5. Даты. Разбираем каждым форматом отдельно и склеиваем:
# автоопределение спутало бы 05.03 и 03.05
d1 = pd.to_datetime(leads["created"], format="%Y-%m-%d", errors="coerce")
d2 = pd.to_datetime(leads["created"], format="%d.%m.%Y", errors="coerce")
leads["created"] = d1.fillna(d2)

# Шаг 6. Диагностика
print("строк в выгрузке:", rows_raw)
print("после удаления дублей:", rows_dedup)
print("отрицательных сумм:", bad_sum)
print("лидов без суммы:", no_sum)
# nunique не считает NaN, поэтому источников 5, а строк в сводке будет 6
print("источников после нормализации:", int(leads["source"].nunique()))
print("городов после нормализации:", int(leads["city"].nunique()))
print()

# Сводка. dropna=False сохраняет группу с пропущенным источником
rep = (leads.groupby("source", dropna=False)
       .agg(leads_cnt=("lead_id", "count"),
            with_sum=("deal_sum", "count"),
            total=("deal_sum", "sum"))
       .sort_values("total", ascending=False))

for src, r in rep.iterrows():
    name = "не указан" if pd.isna(src) else src
    print(f"{name} {int(r.leads_cnt)} {int(r.with_sum)} {r.total:.2f}")`,

  solutionNote: `
<p><strong>Посмотрите на первую строку сводки.</strong> У <code>paid_search</code> сумма 10 328 888 при 13 сделках — это средний чек почти 800 тысяч, тогда как у остальных источников он около 25 тысяч. Одна строка испортила весь отчёт.</p>
<p>Это выброс: где-то в выгрузке лежит сделка на 9 999 000, менеджер ошибся на три нуля. Формально данные чистые, все проверки пройдены, а вывод «paid_search приносит 90 процентов денег» полностью ложный.</p>
<p><strong>Вывод урока:</strong> чистка не заканчивается на приведении типов. После неё обязательно надо посмотреть на распределение и спросить себя, бывают ли такие значения в реальности. Этим займёмся в следующем уроке.</p>
<p><strong>Что написать заказчику вместе с отчётом:</strong> «Из 63 строк 5 оказались полными дублями, 3 суммы отрицательные, у 10 лидов суммы нет вообще. В paid_search есть сделка на 9,99 млн — проверь, это опечатка или реальная сделка, от этого зависит вся картина».</p>
`,

  drills: [
    {
      title: "Диагностика новой таблицы",
      level: "easy",
      body: `<p>Напишите короткий блок, который вы будете использовать при знакомстве с любой новой таблицей. Для <code>leads</code> напечатайте: размер, типы столбцов, число пропусков по каждому столбцу, число полных дублей и число уникальных значений в каждом столбце.</p>
<p>Посмотрите на число уникальных значений: какие столбцы похожи на справочники, а какие на идентификаторы?</p>`,
      solution: `print("размер:", leads.shape)
print()
print("типы:")
print(leads.dtypes.to_string())
print()
print("пропуски по столбцам:")
print(leads.isna().sum().to_string())
print()
print("полных дублей:", int(leads.duplicated().sum()))
print()
print("уникальных значений:")
for c in leads.columns:
    print(" ", c, leads[c].nunique())`,
      note: `<p>У <code>lead_id</code> уникальных почти столько же, сколько строк, — это ключ. У <code>source</code>, <code>city</code>, <code>status</code> их единицы — это справочники, и именно их надо нормализовать. У <code>deal_sum</code> много уникальных — это измерение. Такое чтение таблицы за тридцать секунд даёт план работы.</p>`
    },
    {
      title: "Дубли не только полные",
      level: "mid",
      body: `<p>Полные дубли вы убрали. Но бывают и частичные: один и тот же <code>lead_id</code> с разными суммами, потому что запись правили дважды.</p>
<p>Проверьте, есть ли в очищенной выгрузке повторяющиеся <code>lead_id</code>. Если есть — выведите эти строки целиком. Затем оставьте по одной записи на <code>lead_id</code>, выбрав ту, у которой сумма больше.</p>`,
      solution: `clean = leads.drop_duplicates()

dup_ids = clean["lead_id"][clean["lead_id"].duplicated(keep=False)]
print("дублирующихся lead_id:", int(dup_ids.nunique()))

if dup_ids.nunique():
    print(clean[clean["lead_id"].isin(dup_ids)].sort_values("lead_id").to_string(index=False))

# оставить по одной строке на lead_id: сортируем и берём первую
sums = pd.to_numeric(
    clean["deal_sum"].astype(str).str.replace(" ", "", regex=False).str.replace(",", ".", regex=False),
    errors="coerce")
one = (clean.assign(_s=sums)
            .sort_values("_s", ascending=False)
            .drop_duplicates(subset=["lead_id"], keep="first")
            .drop(columns="_s"))
print("строк после дедупликации по ключу:", len(one))`,
      note: `<p>В этой выгрузке частичных дублей нет, и это тоже результат: вы проверили и знаете точно. В боевых CRM они встречаются постоянно, и приём «отсортировать и взять первую строку через <code>drop_duplicates(subset=..., keep='first')</code>» стоит запомнить: он решает задачу «оставь самую свежую версию записи».</p>`
    },
    {
      title: "Три стратегии для пропусков",
      level: "mid",
      body: `<p>В столбце <code>deal_sum</code> после чистки есть пропуски. Посчитайте три варианта средней суммы сделки и сравните:</p>
<ol>
  <li>по непустым значениям, как делает pandas по умолчанию;</li>
  <li>заполнив пропуски нулём;</li>
  <li>заполнив пропуски медианой.</li>
</ol>
<p>Какое число вы бы отдали руководителю продаж и почему?</p>`,
      solution: `clean = leads.drop_duplicates()

money = (clean["deal_sum"].astype(str)
         .str.replace(" ", "", regex=False)
         .str.replace(",", ".", regex=False))
s = pd.to_numeric(money, errors="coerce")
s = s.where(s >= 0)              # отрицательные тоже пропуск

print(f"строк всего         {len(s)}")
print(f"с суммой            {int(s.count())}")
print(f"среднее по непустым {s.mean():.2f}")
print(f"среднее с нулями    {s.fillna(0).mean():.2f}")
print(f"среднее с медианой  {s.fillna(s.median()).mean():.2f}")
print(f"медиана             {s.median():.2f}")`,
      note: `<p>Ноль подставлять нельзя: отсутствие суммы не означает сделку на ноль рублей, это означает «менеджер не заполнил». Медиана занижает разброс и создаёт ложную уверенность. Честный вариант — среднее по непустым плюс явная фраза: «посчитано по 48 сделкам из 58, у 10 сумма не указана». Число без знаменателя всегда врёт.</p>
<p>И обратите внимание на разрыв между средним и медианой: около 223 тысяч против 24,7 тысячи, в девять раз. Ни одна стратегия работы с пропусками этого не чинит, потому что проблема не в пропусках, а в одной строке на 9,99 млн. Об этом следующий урок.</p>`
    },
    {
      title: "Сколько лидов теряет неаккуратный dropna",
      level: "easy",
      body: `<p>Покажите на этих данных, почему <code>dropna()</code> без параметров опасен. Сравните три числа: строк всего, строк после <code>dropna()</code>, строк после <code>dropna(subset=["deal_sum"])</code>.</p>`,
      solution: `clean = leads.drop_duplicates().replace(["", " ", "n/a"], np.nan)

print("строк всего:", len(clean))
print("после dropna():", len(clean.dropna()))
print("после dropna(subset=['deal_sum']):", len(clean.dropna(subset=["deal_sum"])))`,
      note: `<p>Разница обычно раза в два. <code>dropna()</code> сносит строку из-за незаполненного менеджера, хотя сумма и источник в ней есть. Правило простое: у <code>dropna</code> всегда указывайте <code>subset</code> с теми столбцами, без которых расчёт действительно невозможен.</p>`
    },
    {
      title: "Отчёт по менеджерам",
      level: "hard",
      body: `<p>Соберите итоговый отчёт по менеджерам на очищенных данных: <code>manager</code>, число лидов, число закрытых сделок (статус <code>закрыт</code>), сумма закрытых сделок, конверсия в закрытие в процентах.</p>
<p>Лидов без менеджера объедините в строку <code>не назначен</code>. Сортировка по сумме убыванием. Выброс на 9,99 млн из суммы исключите и напишите об этом отдельной строкой.</p>`,
      solution: `df = leads.drop_duplicates().replace(["", " ", "n/a"], np.nan).copy()

money = (df["deal_sum"].astype(str)
         .str.replace(" ", "", regex=False)
         .str.replace(",", ".", regex=False))
df["deal_sum"] = pd.to_numeric(money, errors="coerce")
df.loc[df["deal_sum"] < 0, "deal_sum"] = np.nan

# явная граница правдоподобия, а не молчаливое удаление
LIMIT = 1_000_000
outliers = int((df["deal_sum"] > LIMIT).sum())
df.loc[df["deal_sum"] > LIMIT, "deal_sum"] = np.nan

df["status"] = df["status"].str.strip().str.lower()
df["manager"] = df["manager"].fillna("не назначен")

# заводим служебные столбцы: так обходимся обычным agg
# вместо apply, который в разных версиях pandas ведёт себя по-разному
df["is_closed"] = (df["status"] == "закрыт").astype(int)
df["closed_sum"] = df["deal_sum"].where(df["status"] == "закрыт")

rep = df.groupby("manager").agg(
    leads=("lead_id", "count"),
    closed=("is_closed", "sum"),
    amount=("closed_sum", "sum"),
)
rep["cr"] = (rep["closed"] / rep["leads"] * 100).round(1)
rep = rep.sort_values("amount", ascending=False)

print(f"исключено сумм выше {LIMIT:,}: {outliers}".replace(",", " "))
print()
for name, r in rep.iterrows():
    print(f"{name} {int(r.leads)} {int(r.closed)} {r.amount:.2f} {r.cr}")`,
      note: `<p>Обратите внимание на строку про исключённые суммы: она обязана быть в отчёте. Молча выкинуть неудобное значение и показать красивую таблицу — это не очистка данных, это подгонка. Аналитик всегда пишет, что именно он убрал и по какому правилу, чтобы заказчик мог поспорить с правилом.</p>`
    }
  ],

  quiz: [
    {
      q: "Что делает <code>df.dropna()</code> без параметров?",
      opts: [
        "Заполняет пропуски нулями",
        "Удаляет строку, если хотя бы в одном столбце есть пропуск",
        "Удаляет столбцы с пропусками",
        "Удаляет только полностью пустые строки"
      ],
      right: 1,
      why: "На широкой таблице это сносит непредсказуемо много строк, и обычно не случайных. Всегда указывайте <code>subset</code> с теми столбцами, без которых расчёт действительно невозможен."
    },
    {
      q: "<code>pd.to_numeric(s, errors=\"coerce\")</code> при встрече с текстом:",
      opts: ["Оставит столбец текстовым", "Упадёт с ошибкой", "Вернёт NaN для нераспознанных значений", "Заменит на ноль"],
      right: 2,
      why: "Это правильное поведение: мусор становится видимым пропуском, который можно посчитать. Вариант <code>errors=\"ignore\"</code> хуже всего: столбец молча останется текстом."
    },
    {
      q: "В каком порядке чистить справочник городов?",
      opts: [
        "Сначала удалить пропуски",
        "Порядок не важен",
        "Регистр, потом пробелы, потом синонимы",
        "Пробелы, потом синонимы, потом регистр"
      ],
      right: 3,
      why: "Если сначала привести регистр, значения с пробелами по краям всё равно останутся отдельными. Сначала убираем пробелы, потом сводим синонимы, потом выравниваем регистр."
    },
    {
      q: "Почему нельзя писать <code>pd.to_datetime(s)</code> без указания формата?",
      opts: [
        "Разбор может перепутать день и месяц, и вы этого не заметите",
        "Функция требует формат обязательно",
        "Это медленно",
        "Не работает с русскими датами"
      ],
      right: 0,
      why: "05.03.2024 можно прочитать и как 5 марта, и как 3 мая. На тысяче строк ошибка не бросится в глаза, а вся помесячная динамика уже будет неверной."
    },
    {
      q: "Полные дубли надо убирать:",
      opts: [
        "После нормализации справочников",
        "Первым действием, до любой другой чистки",
        "Не обязательно",
        "В самом конце, перед выгрузкой"
      ],
      right: 1,
      why: "Иначе вы потратите время на чистку строк, которые всё равно будут удалены, а часть проверок отработает по завышенным числам."
    },
    {
      q: "У 10 лидов из 58 не указана сумма. Что отдать руководителю?",
      opts: [
        "Отказаться считать до заполнения данных",
        "Медиану вместо среднего",
        "Среднее по 48 сделкам с явной оговоркой про 10 без суммы",
        "Среднее по всем, подставив ноль вместо пропусков"
      ],
      right: 2,
      why: "Ноль означал бы сделку на ноль рублей, а это неправда. Честный ответ — число со знаменателем: «по 48 сделкам из 58». Оговорка занимает строку и снимает половину будущих вопросов."
    }
  ],

  links: [
    { t: "Работа с пропущенными данными", url: "https://pandas.pydata.org/docs/user_guide/missing_data.html", src: "pandas.pydata.org", lang: "EN",
      d: "Как pandas представляет пропуски, чем NaN отличается от NA, как ведут себя агрегаты. База, без которой чистка будет угадыванием." },
    { t: "Работа с текстовыми данными", url: "https://pandas.pydata.org/docs/user_guide/text.html", src: "pandas.pydata.org", lang: "EN",
      d: "Полный список методов .str: strip, replace, extract, contains. Ровно тот инструментарий, которым чистят справочники." },
    { t: "Tidy Data", url: "https://vita.had.co.nz/papers/tidy-data.pdf", src: "Hadley Wickham", lang: "EN",
      d: "Классическая статья о том, как должна быть устроена аккуратная таблица. Двадцать страниц, которые меняют взгляд на данные навсегда." },
    { t: "Курс по очистке данных", url: "https://www.kaggle.com/learn/data-cleaning", src: "kaggle.com", lang: "EN",
      d: "Пять практических уроков: пропуски, масштабирование, даты, кодировки, опечатки в категориях. С задачами в браузере." },
    { t: "Хаб «Обработка данных» на Хабре", url: "https://habr.com/ru/hubs/data_engineering/articles/", src: "habr.com", lang: "RU",
      d: "Реальные истории про кривые выгрузки и как их чинили. Полезно, чтобы понять масштаб проблемы в боевых системах." }
  ]
};

/* ---------------------------------------------------------- */
/* 2.3 — выбросы                                                */
/* ---------------------------------------------------------- */

window.CONTENT.m2l3 = {
  intro: "Один заказ на 10 тысяч поднимает средний чек всей базы на шесть процентов. Учимся находить такие значения, отличать ошибку от правды и решать, что с ними делать.",
  duration: "≈ 2 часа",
  plan: [
    { m: "30 мин", w: "Теория: IQR, перцентили, когда выброс не ошибка" },
    { m: "40 мин", w: "Основная задача: отчёт по выбросам в заказах" },
    { m: "35 мин", w: "Тренажёр: 5 задач на распределения" },
    { m: "10 мин", w: "Самопроверка вопросами" },
    { m: "5 мин",  w: "Заметки" }
  ],

  theory: `
<p class="lead">В прошлом уроке одна строка на 9,99 млн сделала средний чек в девять раз больше медианного и превратила отчёт в фантазию. Такие значения называют выбросами. Их надо уметь находить, но ещё важнее уметь решать, что с ними делать: далеко не каждый выброс это ошибка.</p>

<h3>Почему среднее ломается, а медиана нет</h3>
<p>Среднее учитывает величину каждого значения, поэтому одно большое число тянет его вверх. Медиана учитывает только порядок: сколько бы ни было в самом большом заказе, он всё равно останется одним значением справа.</p>
<pre><code>чеки: 1000, 2000, 3000, 4000, 5000
среднее 3000   медиана 3000     совпадают

чеки: 1000, 2000, 3000, 4000, 990000
среднее 200000   медиана 3000   среднее уехало в никуда</code></pre>
<p><strong>Практическое правило:</strong> если среднее заметно выше медианы, у распределения длинный правый хвост. Для денег это норма, и в отчёте надо показывать оба числа. Если разрыв в разы, а не в проценты, ищите выброс.</p>

<h3>Метод IQR: как его считают</h3>
<p>Самый распространённый способ найти границу правдоподобия. Работает без предположений о форме распределения.</p>
<ol>
  <li>Считаем первый и третий квартили: <code>q1 = s.quantile(0.25)</code>, <code>q3 = s.quantile(0.75)</code>. Между ними лежит центральная половина данных.</li>
  <li>Межквартильный размах: <code>iqr = q3 - q1</code>.</li>
  <li>Границы: <code>lo = q1 - 1.5 * iqr</code>, <code>hi = q3 + 1.5 * iqr</code>.</li>
  <li>Всё, что за границами, помечаем как кандидатов в выбросы.</li>
</ol>
<p>Коэффициент 1,5 — соглашение, а не закон природы. Для строгого отбора берут 3,0, для мягкого 1,0. Важно другое: коэффициент надо выбрать заранее и записать в отчёт, иначе получится подгонка под желаемый результат.</p>

<div class="example">
  <div class="example-h">IQR на наших заказах, по шагам</div>
  <div class="example-b">
<pre><code>r = orders.loc[orders["status"] == "paid", "revenue"]
q1, q3 = r.quantile(0.25), r.quantile(0.75)     # 2136.56 и 4260.25
iqr = q3 - q1                                    # 2123.69
hi = q3 + 1.5 * iqr                              # 7445.78
(r > hi).sum()                                   # 7 заказов</code></pre>
    <p>Нижняя граница вышла отрицательной, минус 1049 рублей. Это нормально и означает ровно одно: слева выбросов нет и быть не может, потому что заказ не бывает на отрицательную сумму. В отчёте такую границу просто не используют.</p>
    <p>Семь заказов из 189 дают 9,4 процента всей выручки. Это ключевое число: если их выбросить, вы потеряете почти десятую часть денег компании. Значит, выбрасывать нельзя.</p>
  </div>
</div>

<h3>Три способа поймать выброс</h3>
<table>
  <tr><th>Метод</th><th>Как</th><th>Когда подходит</th></tr>
  <tr><td>IQR</td><td><code>q3 + 1.5 * iqr</code></td><td>универсально, не требует нормальности</td></tr>
  <tr><td>Перцентили</td><td>отбросить верхний 1 процент</td><td>когда просто нужен устойчивый средний</td></tr>
  <tr><td>Z-оценка</td><td><code>abs(x - mean) / std &gt; 3</code></td><td>только если распределение близко к нормальному</td></tr>
</table>
<p>Z-оценка на деньгах работает плохо, и вот почему: и среднее, и стандартное отклонение сами зависят от выброса. Одно большое значение раздувает <code>std</code>, порог уезжает вверх, и выброс перестаёт быть выбросом. Метод сам себя саботирует. Для скошенных распределений берите IQR или перцентили.</p>

<div class="callout trap">
  <span class="ct">Главная ошибка: выбросить всё, что мешает</span>
  <p>Соблазн велик: убрал семь строк, средний чек стал ровный, график красивый. Но это не очистка, а подгонка.</p>
  <p><strong>Выброс это ошибка</strong>, если значение физически невозможно: отрицательная сумма, дата рождения в будущем, сумма в тысячу раз больше максимального прайса, возраст 200 лет.</p>
  <p><strong>Выброс это правда</strong>, если значение редкое, но реальное: корпоративный клиент купил на всю компанию, вирусный пост дал дневной трафик за месяц, чёрная пятница. Это и есть самая ценная часть данных.</p>
  <p style="margin-bottom:0"><strong>Как отличить:</strong> посмотреть на строку целиком. У заказа 198 на 10 177 рублей есть реальный пользователь 205, есть дата, есть статус <code>paid</code>. Это крупный, но нормальный заказ. У сделки на 9,99 млн в CRM ровно ноль признаков реальности, и три нуля лишних. Разница видна невооружённым глазом, если посмотреть.</p>
</div>

<h3>Что делать, когда выброс настоящий</h3>
<ul>
  <li><strong>Показывать медиану рядом со средним.</strong> Самое дешёвое и честное решение.</li>
  <li><strong>Считать метрику в двух вариантах.</strong> «Средний чек 3457 рублей, без семи крупнейших заказов 3254». Обе цифры в отчёте, читатель решает сам.</li>
  <li><strong>Вынести хвост в отдельный сегмент.</strong> Крупные клиенты часто заслуживают собственной строки в отчёте, а не растворения в среднем.</li>
  <li><strong>Винзоризация:</strong> заменить значения выше 99-го перцентиля на сам перцентиль. Применяют в моделях, редко в отчётности: она искажает суммы.</li>
</ul>

<div class="callout work">
  <span class="ct">Где это в работе</span>
  <p>Каждый раз, когда вы видите в дашборде «средний чек» или «среднее время на сайте», рядом должна стоять медиана. Именно на выбросах ломаются метрики вроде среднего времени доставки: одна посылка, застрявшая на складе на полгода, сдвигает среднее по всему кварталу. Аналитик, который приносит среднее без медианы, рано или поздно приносит неверный вывод.</p>
</div>

<div class="callout jobs">
  <span class="ct">Что закрывает урок в вакансиях</span>
  <ul>
    <li>«Статистический анализ данных» — строка, за которой на джуниорском уровне обычно стоит именно это</li>
    <li>Вопрос на интервью: «среднее или медиана и почему»</li>
    <li>Вопрос на интервью: «как найдёте выбросы и что с ними сделаете» — правильный ответ обязан включать «сначала посмотрю, ошибка это или правда»</li>
  </ul>
</div>
`,

  ticket: {
    from: "Марина, операционный директор",
    subj: "Средний чек скачет, разберись",
    body: `
<p>Мне в двух отчётах приносят разный средний чек, и оба раза он не похож на то, что я вижу в магазине. Посмотри на распределение оплаченных заказов и дай понятную справку.</p>
<p>Нужен вывод ровно в таком виде, каждое число с двумя знаками после точки, кроме количества:</p>
<pre><code>p25 ...
p75 ...
iqr ...
верхняя граница ...
выбросов ...
доля выручки ...
среднее с выбросами ...
среднее без выбросов ...
медиана ...</code></pre>
<p>Границу считай методом IQR с коэффициентом 1,5, выбросами считай только то, что выше верхней границы. «Доля выручки» — сколько процентов всей оплаченной выручки приходится на эти заказы, один знак после точки.</p>
<p>Дальше без пустой строки выведи сами заказы-выбросы, по одному в строке: <code>order_id user_id revenue</code>, от большего к меньшему.</p>
`
  },

  schema: window.SH.pySchema + `
<p>Пригодятся: <code>s.quantile(0.25)</code>, <code>s.median()</code>, <code>s.mean()</code>, булева маска <code>s &gt; hi</code> и форматирование <code>f"{x:.2f}"</code>.</p>
`,

  data: window.SH.pyData,
  packages: ["pandas"],
  prelude: window.SH.pyPrelude,

  starter: `# Разбор распределения чеков
paid = orders[orders["status"] == "paid"]
r = paid["revenue"]

# Шаг 1: квартили и границы

# Шаг 2: маска выбросов и метрики

# Шаг 3: печать
`,

  expected: {
    stdout: `p25 2136.56
p75 4260.25
iqr 2123.69
верхняя граница 7445.78
выбросов 7
доля выручки 9.4
среднее с выбросами 3457.30
среднее без выбросов 3253.83
медиана 2997.20
198 205 10177.29
156 156 9550.87
5 3 9071.54
89 91 8835.71
74 80 8173.74
94 96 7779.49
17 14 7642.60`
  },

  hints: [
    "Квартили берутся методом <code>.quantile()</code>: <code>r.quantile(0.25)</code> и <code>r.quantile(0.75)</code>. Дальше <code>iqr = q3 - q1</code> и <code>hi = q3 + 1.5 * iqr</code>. Обратите внимание на формулировку тикета: выбросами считаем только то, что <em>выше</em> верхней границы, нижнюю границу не используем.",
    "Маска — это <code>mask = r > hi</code>, обычная булева Series. С ней <code>mask.sum()</code> даёт количество, <code>r[mask]</code> — сами значения, а <code>r[~mask]</code> — всё остальное. Доля выручки: <code>r[mask].sum() / r.sum() * 100</code>. Все числа печатайте через f-строки с <code>:.2f</code>, а долю с <code>:.1f</code>.",
    "Для последнего блока нужны не только суммы, но и номера заказов, значит фильтровать надо сам DataFrame: <code>paid[mask]</code>. Отсортируйте <code>.sort_values(\"revenue\", ascending=False)</code> и пройдите циклом <code>for _, row in ...iterrows()</code>. Идентификаторы приводите к <code>int</code>, иначе pandas напечатает их как <code>198.0</code>."
  ],

  solution: `# Разбор распределения чеков методом IQR
paid = orders[orders["status"] == "paid"]
r = paid["revenue"]

# Шаг 1. Квартили: между ними лежит центральная половина заказов
q1 = r.quantile(0.25)
q3 = r.quantile(0.75)
iqr = q3 - q1

# Коэффициент 1,5 — общепринятое соглашение. Его выбирают ДО расчёта
# и записывают в отчёт, иначе получится подгонка под нужный ответ
hi = q3 + 1.5 * iqr
# нижняя граница здесь отрицательная и смысла не имеет:
# заказ не бывает на минус тысячу рублей

# Шаг 2. Маска: булева Series, по которой удобно и считать, и фильтровать
mask = r > hi
clean = r[~mask]          # тильда инвертирует маску

print(f"p25 {q1:.2f}")
print(f"p75 {q3:.2f}")
print(f"iqr {iqr:.2f}")
print(f"верхняя граница {hi:.2f}")
print(f"выбросов {int(mask.sum())}")
print(f"доля выручки {r[mask].sum() / r.sum() * 100:.1f}")
print(f"среднее с выбросами {r.mean():.2f}")
print(f"среднее без выбросов {clean.mean():.2f}")
print(f"медиана {r.median():.2f}")

# Шаг 3. Сами заказы: фильтруем DataFrame, а не Series,
# чтобы остались order_id и user_id
for _, row in paid[mask].sort_values("revenue", ascending=False).iterrows():
    print(f"{int(row.order_id)} {int(row.user_id)} {row.revenue:.2f}")`,

  solutionNote: `
<p><strong>Как читать этот отчёт.</strong> Семь заказов из 189 дают 9,4 процента выручки. Убрав их, средний чек падает с 3457 до 3254 рублей, то есть на шесть процентов. Медиана 2997 рублей — вот сумма типичного заказа.</p>
<p><strong>Главный вывод для Марины:</strong> «Разница между отчётами объясняется тем, что один считает среднее, другой медиану. Ни один не врёт. Типичный заказ у нас на 2997 рублей, средний на 3457 — разница из-за семи крупных заказов. Все семь настоящие, у каждого есть пользователь и дата, выбрасывать их нельзя. Предлагаю в дашборде показывать оба числа».</p>
<p><strong>Чего делать было нельзя:</strong> выкинуть семь заказов и отдать «очищенный» средний чек 3254. Это девять процентов выручки компании, которые аналитик молча стёр ради красивого числа.</p>
<p><strong>Развитие задачи:</strong> посмотреть, кто эти семь пользователей. Если это одни и те же люди, у вас есть сегмент крупных клиентов, и это отдельный разговор с продуктом. Проверьте сами: пользователи 205, 156, 3, 91, 80, 96, 14 — все разные, то есть постоянного «корпоративного» сегмента здесь нет.</p>
`,

  drills: [
    {
      title: "Форма распределения одним взглядом",
      level: "easy",
      body: `<p>Напечатайте по оплаченным заказам восемь чисел: минимум, p10, p25, медиану, среднее, p75, p90, p99 и максимум. Каждое с двумя знаками.</p>
<p>Посмотрите на разрыв между p99 и максимумом. Что он говорит о форме распределения?</p>`,
      solution: `r = orders.loc[orders["status"] == "paid", "revenue"]

for name, v in [
    ("min", r.min()),
    ("p10", r.quantile(0.10)),
    ("p25", r.quantile(0.25)),
    ("медиана", r.median()),
    ("среднее", r.mean()),
    ("p75", r.quantile(0.75)),
    ("p90", r.quantile(0.90)),
    ("p99", r.quantile(0.99)),
    ("max", r.max()),
]:
    print(f"{name} {v:.2f}")`,
      note: `<p>Медиана 2997, среднее 3457, p99 около 9129, максимум 10177. Среднее правее медианы, а хвост тянется далеко за p90 — классическое правостороннее скошенное распределение. Такой набор из восьми чисел заменяет гистограмму и занимает пять строк кода: очень удобно, когда графики строить негде.</p>`
    },
    {
      title: "Три метода на одних данных",
      level: "mid",
      body: `<p>Найдите выбросы тремя способами и сравните, сколько заказов помечает каждый:</p>
<ol>
  <li>IQR с коэффициентом 1,5;</li>
  <li>верхний 1 процент (всё выше p99);</li>
  <li>Z-оценка больше 3.</li>
</ol>
<p>Объясните себе, почему Z-оценка находит меньше всех.</p>`,
      solution: `r = orders.loc[orders["status"] == "paid", "revenue"]

q1, q3 = r.quantile(0.25), r.quantile(0.75)
hi_iqr = q3 + 1.5 * (q3 - q1)
hi_p99 = r.quantile(0.99)
z = (r - r.mean()) / r.std()

print(f"IQR 1.5:  граница {hi_iqr:.2f}, выбросов {int((r > hi_iqr).sum())}")
print(f"p99:      граница {hi_p99:.2f}, выбросов {int((r > hi_p99).sum())}")
print(f"z > 3:    граница {r.mean() + 3 * r.std():.2f}, выбросов {int((z > 3).sum())}")`,
      note: `<p>Z-оценка почти ничего не находит, и это её известная слабость: и среднее, и стандартное отклонение сами раздуваются выбросами, поэтому порог уезжает вверх вслед за ними. Метод работает только на симметричных распределениях, близких к нормальному. Деньги, время на сайте и длительность сессий такими не бывают почти никогда.</p>`
    },
    {
      title: "Выброс из CRM: ошибка или правда",
      level: "mid",
      body: `<p>Вернитесь к выгрузке лидов из прошлого урока. Найдите строку со сделкой на 9,99 млн и напечатайте её целиком.</p>
<p>Затем посчитайте, как меняется средняя сумма сделки с этой строкой и без неё. Сформулируйте одним предложением, что вы напишете руководителю продаж.</p>`,
      solution: `# leads доступен только в уроке 2.2, здесь воспроизводим логику
# на заказах: возьмём самый крупный заказ как «подозрительный»
paid = orders[orders["status"] == "paid"]
top = paid.loc[paid["revenue"].idxmax()]

print("подозрительная строка:")
print(top.to_string())
print()

r = paid["revenue"]
without = r.drop(paid["revenue"].idxmax())
print(f"среднее со строкой  {r.mean():.2f}")
print(f"среднее без строки  {without.mean():.2f}")
print(f"сдвиг               {(r.mean() - without.mean()) / without.mean() * 100:.2f} процента")`,
      note: `<p>Один заказ на 10 177 рублей сдвигает средний чек всего на 1 процент, потому что он всё-таки правдоподобен. В выгрузке из CRM сделка на 9,99 млн при медиане 24,7 тысячи сдвигала среднее в девять раз. Вот и весь критерий: <strong>смотрите не на то, насколько значение большое, а на то, насколько оно ломает картину и есть ли у него признаки реальности</strong>.</p>`
    },
    {
      title: "Выбросы внутри сегментов",
      level: "hard",
      body: `<p>Граница выброса не обязана быть общей. Посчитайте IQR-границу отдельно для каждого канала привлечения и выведите: <code>channel</code>, число заказов, границу, число выбросов внутри канала.</p>
<p>Сравните с общей границей 7445,78: у каких каналов своя граница заметно ниже и что это значит?</p>`,
      solution: `paid = orders[orders["status"] == "paid"]
m = users.merge(paid, on="user_id", how="inner")

for ch, g in m.groupby("channel"):
    r = g["revenue"]
    q1, q3 = r.quantile(0.25), r.quantile(0.75)
    hi = q3 + 1.5 * (q3 - q1)
    print(f"{ch} {len(r)} {hi:.2f} {int((r > hi).sum())}")`,
      note: `<p>У <code>social</code> и <code>paid_search</code> собственная граница заметно ниже общей: там чеки мельче, и заказ на шесть тысяч для этих каналов уже нетипичен, хотя по общей границе он проходит незамеченным. Отсюда практический вывод: <strong>если у сегментов разные распределения, ищите выбросы внутри сегментов</strong>. Общая граница пропускает аномалии в «мелких» сегментах и наказывает «крупные».</p>`
    },
    {
      title: "Устойчивый отчёт для дашборда",
      level: "hard",
      body: `<p>Соберите строку метрик, которую не стыдно повесить в дашборд: по каждому каналу выведите <code>channel</code>, число заказов, медиану, среднее, среднее без верхнего 1 процента и p90.</p>
<p>Сортировка по медиане убыванием, все деньги с двумя знаками.</p>`,
      solution: `paid = orders[orders["status"] == "paid"]
m = users.merge(paid, on="user_id", how="inner")

rows = []
for ch, g in m.groupby("channel"):
    r = g["revenue"]
    p99 = r.quantile(0.99)
    rows.append((ch, len(r), r.median(), r.mean(), r[r <= p99].mean(), r.quantile(0.90)))

rows.sort(key=lambda x: x[2], reverse=True)
for ch, n, med, avg, avg_trim, p90 in rows:
    print(f"{ch} {n} {med:.2f} {avg:.2f} {avg_trim:.2f} {p90:.2f}")`,
      note: `<p>Такой набор колонок отвечает сразу на три вопроса: как выглядит типичный заказ (медиана), сколько денег в среднем на заказ (среднее), устойчиво ли это среднее (сравнение с усечённым). Если среднее и усечённое среднее близки, метрике можно верить. Если разошлись на десятки процентов, в дашборде надо показывать медиану, а среднее убирать или подписывать.</p>`
    }
  ],

  quiz: [
    {
      q: "Среднее 3457, медиана 2997. Что это значит?",
      opts: [
        "В данных много пропусков",
        "Ошибка в расчёте",
        "Данные распределены нормально",
        "Распределение скошено вправо: есть хвост крупных значений"
      ],
      right: 3,
      why: "Среднее чувствительно к большим значениям, медиана нет. Когда среднее выше медианы, справа есть хвост. Для денег это норма, и в отчёте нужны оба числа."
    },
    {
      q: "Нижняя граница IQR получилась отрицательной. Что делать?",
      opts: [
        "Ничего: она просто означает, что слева выбросов быть не может",
        "Пересчитать, это ошибка",
        "Взять ноль вместо неё и отбросить нулевые заказы",
        "Использовать Z-оценку"
      ],
      right: 0,
      why: "Формула не знает, что заказ не бывает отрицательным. Отрицательная граница — нормальный результат для величин, ограниченных снизу нулём. Её просто не используют."
    },
    {
      q: "Почему Z-оценка плохо работает на суммах заказов?",
      opts: [
        "Её нет в pandas",
        "Среднее и стандартное отклонение сами раздуваются выбросами, и порог уезжает вслед за ними",
        "Она требует много данных",
        "Она работает только с целыми числами"
      ],
      right: 1,
      why: "Метод саботирует сам себя: чем крупнее выброс, тем выше порог, за которым он считался бы выбросом. На скошенных распределениях берите IQR или перцентили."
    },
    {
      q: "Семь заказов-выбросов дают 9,4 процента выручки. Что с ними делать?",
      opts: [
        "Вынести в отдельную таблицу и не считать вовсе",
        "Удалить, чтобы средний чек стал ровным",
        "Оставить: это настоящие заказы, а рядом со средним показать медиану",
        "Заменить их медианой"
      ],
      right: 2,
      why: "У каждого есть реальный пользователь, дата и статус оплаты. Удалить их означает стереть девять процентов денег компании ради красивого числа."
    },
    {
      q: "Как отличить ошибку ввода от настоящего крупного значения?",
      opts: [
        "Ошибкой считается всё выше p99",
        "По величине: чем больше, тем вероятнее ошибка",
        "По методу IQR",
        "Посмотреть на строку целиком и спросить, возможно ли такое в реальности"
      ],
      right: 3,
      why: "Заказ на 10 177 рублей правдоподобен. Сделка на 9,99 млн при медиане 24,7 тысячи — это лишние три нуля. Решает не формула, а взгляд на строку и знание предметной области."
    },
    {
      q: "Что показывать в дашборде рядом со средним чеком?",
      opts: ["Медиану", "Максимум", "Число строк", "Сумму"],
      right: 0,
      why: "Медиана отвечает на вопрос «как выглядит типичный заказ», среднее — «сколько денег в среднем приходится на заказ». Вместе они не дают выбросу тихо испортить вывод."
    }
  ],

  links: [
    { t: "Робастная статистика простыми словами", url: "https://seeing-theory.brown.edu/basic-probability/index.html", src: "Brown University", lang: "EN",
      d: "Интерактивный учебник по вероятности и статистике: всё можно покрутить мышкой и увидеть, как меняются среднее и медиана." },
    { t: "Описательные статистики в pandas", url: "https://pandas.pydata.org/docs/user_guide/basics.html#descriptive-statistics", src: "pandas.pydata.org", lang: "EN",
      d: "describe, quantile, median и всё остальное с точным описанием поведения на пропусках." },
    { t: "Boxplot и что он показывает", url: "https://en.wikipedia.org/wiki/Box_plot", src: "wikipedia.org", lang: "EN",
      d: "Ящик с усами это визуальный IQR. Разобравшись один раз, вы будете читать такие графики с первого взгляда." },
    { t: "Курс по очистке данных", url: "https://www.kaggle.com/learn/data-cleaning", src: "kaggle.com", lang: "EN",
      d: "Раздел про масштабирование и нормализацию хорошо дополняет тему выбросов практикой." },
    { t: "Хаб «Математика» на Хабре", url: "https://habr.com/ru/hubs/mathematics/articles/", src: "habr.com", lang: "RU",
      d: "Разборы про смещённые распределения и почему среднее вводит в заблуждение. Читать по мере интереса." }
  ]
};

/* ---------------------------------------------------------- */
/* 2.4 — временные ряды и resample                              */
/* ---------------------------------------------------------- */

window.CONTENT.m2l4 = {
  intro: "Дневные данные шумят, недельные читаются. Учимся менять шаг времени, сглаживать пилу и не терять пустые периоды, из-за которых графики врут.",
  duration: "≈ 2 часа",
  plan: [
    { m: "30 мин", w: "Теория: DatetimeIndex, resample, rolling" },
    { m: "40 мин", w: "Основная задача: недельная динамика со сглаживанием" },
    { m: "35 мин", w: "Тренажёр: 5 задач на время" },
    { m: "10 мин", w: "Самопроверка вопросами" },
    { m: "5 мин",  w: "Заметки" }
  ],

  theory: `
<p class="lead">Почти любая метрика, которую вы будете считать, живёт во времени. И почти любой спор про метрику начинается с вопроса «а по какому периоду смотрим». Этот урок про то, как менять период честно.</p>

<h3>Индекс из дат: с чего всё начинается</h3>
<p>Чтобы pandas умел работать со временем, дата должна быть <em>индексом</em>, а не обычным столбцом:</p>
<pre><code>ts = paid.set_index("order_date")["revenue"]</code></pre>
<p>После этого появляются вещи, которых больше нигде нет: срезы по датам, автоматическое достраивание пропущенных периодов, ресемплинг.</p>
<pre><code>ts["2024-03"]                 # весь март
ts["2024-03":"2024-05"]       # три месяца, обе границы включены
ts.loc["2024-03-15":]         # с середины марта и до конца</code></pre>

<h3>resample: сменить шаг времени</h3>
<p><code>resample</code> — это <code>groupby</code>, который умеет группировать по календарю. Он сам знает, что в феврале 29 дней, а неделя начинается с понедельника.</p>
<pre><code>ts.resample("D").sum()        # по дням
ts.resample("W-MON").sum()    # по неделям, метка — понедельник
ts.resample("MS").sum()       # по месяцам, метка — первое число
ts.resample("QS").sum()       # по кварталам</code></pre>
<table>
  <tr><th>Код</th><th>Период</th><th>Метка периода</th></tr>
  <tr><td><code>D</code></td><td>день</td><td>сам день</td></tr>
  <tr><td><code>W-MON</code></td><td>неделя</td><td>понедельник в конце недели</td></tr>
  <tr><td><code>MS</code></td><td>месяц</td><td>первое число (month start)</td></tr>
  <tr><td><code>ME</code></td><td>месяц</td><td>последнее число (month end)</td></tr>
  <tr><td><code>QS</code></td><td>квартал</td><td>первое число квартала</td></tr>
</table>
<p>Разница между <code>MS</code> и <code>ME</code> кажется мелочью, пока вы не соедините две таблицы, посчитанные по-разному: строки не совпадут по ключу, и половина данных потеряется на merge.</p>

<div class="callout note">
  <span class="ct">Главное преимущество resample перед groupby</span>
  <p style="margin-bottom:0"><code>resample</code> достраивает <strong>пустые периоды</strong>. Если на неделе не было ни одного заказа, <code>groupby</code> по номеру недели просто не создаст такой строки, и на графике две соседние точки соединятся прямой, скрыв провал. <code>resample</code> вернёт строку с нулём. Ровно та же задача решалась календарём в SQL из урока 1.4, только здесь она решается сама.</p>
</div>

<h3>rolling: сгладить шум</h3>
<p>Дневная выручка прыгает: выходные ниже, понедельники выше, случайный крупный заказ даёт пик. Смотреть на такой график бессмысленно. Скользящее среднее убирает пилу и оставляет тренд:</p>
<pre><code>w["ma4"] = w["revenue"].rolling(4).mean()                  # первые 3 строки будут NaN
w["ma4"] = w["revenue"].rolling(4, min_periods=1).mean()   # считает, что есть</code></pre>
<ul>
  <li><strong>Окно 7 дней</strong> для дневных данных: убирает недельную сезонность целиком.</li>
  <li><strong>Окно 4 недели</strong> для недельных: примерно месяц.</li>
  <li><code>min_periods=1</code> — считать, даже если данных меньше окна. Удобно для начала ряда, но помните: первые точки посчитаны по одному-двум значениям и шумят сильнее остальных.</li>
</ul>

<div class="example">
  <div class="example-h">Почему сглаживание меняет выводы</div>
  <div class="example-b">
    <p>Сырые недельные значения на нашем магазине скачут от 6,5 до 46 тысяч, и по ним «падение» видно в каждой второй неделе. Скользящее среднее по четырём неделям показывает другое: рост до апреля, плато до конца июля, спад в августе.</p>
<pre><code>2024-08-05    8970.00   15927.75
2024-08-12    6578.38   15763.65
2024-08-19   13420.73   11167.22
2024-08-26    1963.54    7733.16</code></pre>
    <p>Второй столбец сырой, третий сглаженный. По сырому можно сказать «в середине августа резкий рост на 104 процента». По сглаженному видно, что это одна неделя в общем нисходящем движении.</p>
    <p><strong>Правило:</strong> о тренде говорят по сглаженному ряду, о конкретном дне по сырому. Смешивать нельзя.</p>
  </div>
</div>

<h3>Хвост ряда: незакрытый период</h3>
<p>Последняя точка любого ряда почти всегда неполная. Данные обрываются в середине недели, а <code>resample</code> честно посчитает эту половину и покажет её рядом с полными неделями. На графике получится обвал, которого нет.</p>
<pre><code># отрезаем незакрытый период
last_full = ts.index.max().normalize() - pd.Timedelta(days=7)
w = w[w.index &lt;= last_full]</code></pre>
<p>Либо оставить, но подписать. Чего нельзя — молча отдать график с падением на 80 процентов в последней точке. Это самая частая причина ложной тревоги в отчётах.</p>

<h3>shift: сравнение с прошлым периодом</h3>
<pre><code>w["prev"] = w["revenue"].shift(1)                      # аналог LAG в SQL
w["wow"] = (w["revenue"] / w["prev"] - 1) * 100        # прирост неделя к неделе
w["yoy"] = (w["revenue"] / w["revenue"].shift(52) - 1) * 100   # год к году</code></pre>
<p><code>shift(52)</code> для недельных данных — это «та же неделя год назад». Сравнение год к году устойчиво к сезонности, и в бизнесе его любят больше, чем неделя к неделе. У нас данных на год не хватит, но приём стоит знать.</p>

<div class="callout work">
  <span class="ct">Где это в работе</span>
  <p>Дашборд без временного разреза не бывает. Обычная просьба звучит так: «покажи динамику по неделям и скажи, растём мы или нет». Ответ на неё — это resample, rolling и умение отличить шум от тренда. Второй по частоте вопрос: «а почему у нас в последней неделе провал» — и в девяти случаях из десяти ответ «неделя ещё не закончилась».</p>
</div>

<div class="callout jobs">
  <span class="ct">Что закрывает урок в вакансиях</span>
  <ul>
    <li>«Анализ динамики метрик» — стандартная формулировка</li>
    <li>«Построение регулярной отчётности» — вся она про периоды</li>
    <li>Вопрос на интервью: «как поймёте, что метрика реально изменилась, а не пошумела»</li>
  </ul>
</div>
`,

  ticket: {
    from: "Костя, продакт",
    subj: "Недельная динамика, только честная",
    body: `
<p>Смотрю на дневной график и ничего не понимаю: пила. Сделай недельную сводку и сглаженную линию, чтобы было видно тренд.</p>
<p>Считай по <strong>оплаченным</strong> заказам, недели по понедельникам (<code>W-MON</code>).</p>
<p>Сначала три строки:</p>
<pre><code>недель в периоде N
недель без заказов N
лучшая неделя ГГГГ-ММ-ДД СУММА</code></pre>
<p>Потом <strong>последние 8 недель</strong>, по строке на неделю, через пробел:</p>
<pre><code>дата заказов выручка ma4</code></pre>
<p>Дата в формате <code>2024-08-05</code>, выручка и <code>ma4</code> с двумя знаками. <code>ma4</code> — скользящее среднее выручки по 4 неделям, считать с <code>min_periods=1</code>.</p>
<p>Недели без заказов должны быть в таблице с нулями, мне важно видеть провалы.</p>
`
  },

  schema: window.SH.pySchema + `
<p>Пригодятся:</p>
<pre><code>df.set_index("order_date")            # дата в индекс
s.resample("W-MON").agg(["count", "sum"])
s.rolling(4, min_periods=1).mean()
s.idxmax()                            # метка максимума
d.date()                              # Timestamp -> дата без времени
w.tail(8).iterrows()                  # последние 8 строк</code></pre>
`,

  data: window.SH.pyData,
  packages: ["pandas"],
  prelude: window.SH.pyPrelude,

  starter: `# Недельная динамика выручки
paid = orders[orders["status"] == "paid"]

# Шаг 1: дату в индекс, ресемплинг по неделям

# Шаг 2: скользящее среднее

# Шаг 3: печать сводки и последних 8 недель
`,

  expected: {
    stdout: `недель в периоде 37
недель без заказов 3
лучшая неделя 2024-04-08 46227.09
2024-07-29 6 15699.78 22706.57
2024-08-05 3 8970.00 15927.75
2024-08-12 1 6578.38 15763.65
2024-08-19 5 13420.73 11167.22
2024-08-26 1 1963.54 7733.16
2024-09-02 0 0.00 5490.66
2024-09-09 0 0.00 3846.07
2024-09-16 1 10177.29 3035.21`
  },

  hints: [
    "Начните с <code>paid.set_index(\"order_date\")[\"revenue\"]</code> — получится Series с датами в индексе. Дальше <code>.resample(\"W-MON\")</code>. Вам нужны сразу две величины на неделю, количество и сумма, поэтому удобно написать <code>.agg([\"count\", \"sum\"])</code> и переименовать столбцы.",
    "После <code>agg([\"count\", \"sum\"])</code> столбцы будут называться <code>count</code> и <code>sum</code>. Переименуйте: <code>w.columns = [\"orders_cnt\", \"revenue\"]</code>. Скользящее среднее считается по столбцу выручки: <code>w[\"revenue\"].rolling(4, min_periods=1).mean()</code>. Пустые недели resample создаст сам, вручную ничего достраивать не нужно.",
    "Лучшую неделю даёт <code>w[\"revenue\"].idxmax()</code> — это метка индекса, то есть Timestamp. Чтобы напечатать её как <code>2024-04-08</code>, вызовите <code>.date()</code>. Для последних восьми недель: <code>for d, row in w.tail(8).iterrows()</code>, внутри <code>f\"{d.date()} {int(row.orders_cnt)} {row.revenue:.2f} {row.ma4:.2f}\"</code>."
  ],

  solution: `# Недельная динамика выручки со сглаживанием
paid = orders[orders["status"] == "paid"]

# Шаг 1. Дата в индекс — без этого resample не работает.
# W-MON: неделя заканчивается понедельником, он же метка периода
w = paid.set_index("order_date")["revenue"].resample("W-MON").agg(["count", "sum"])
w.columns = ["orders_cnt", "revenue"]
# resample сам достроил недели без заказов, там будет 0 и 0.00

# Шаг 2. Скользящее среднее по 4 неделям.
# min_periods=1 позволяет считать с самого начала ряда,
# но первые точки посчитаны по одному-двум значениям и шумят
w["ma4"] = w["revenue"].rolling(4, min_periods=1).mean()

# Шаг 3. Сводка
print("недель в периоде", len(w))
print("недель без заказов", int((w["orders_cnt"] == 0).sum()))
best = w["revenue"].idxmax()          # idxmax возвращает метку, а не значение
print(f"лучшая неделя {best.date()} {w.loc[best, 'revenue']:.2f}")

# Шаг 4. Последние 8 недель
for d, row in w.tail(8).iterrows():
    print(f"{d.date()} {int(row.orders_cnt)} {row.revenue:.2f} {row.ma4:.2f}")`,

  solutionNote: `
<p><strong>Что видно в хвосте.</strong> Две недели подряд с нулём заказов, потом одна неделя с единственным заказом на 10 177 рублей. Скользящее среднее падает с 22,7 тысячи до 3 тысяч.</p>
<p><strong>И это не бизнес, а данные.</strong> Максимальная дата заказа в базе — 11 сентября. Последние строки ряда описывают период, по которому данных просто нет или почти нет. Продакту надо сказать именно это, а не «у нас обвал продаж в сентябре».</p>
<p><strong>Правильная формулировка для отчёта:</strong> «Данные заканчиваются 11 сентября, поэтому последние три недели неполные и в тренд не идут. По полным неделям: рост до середины апреля, плато до конца июля, снижение в августе примерно на треть».</p>
<p><strong>Отдельно про сглаживание.</strong> Обратите внимание, что <code>ma4</code> реагирует на провал с задержкой: пока в окно попадают хорошие недели, среднее держится. Это свойство любого скользящего среднего, и его надо помнить: <strong>сглаженный ряд всегда отстаёт от реальности примерно на половину окна</strong>. Для быстрых решений смотрят на сырой ряд, для разговора о тренде на сглаженный.</p>
`,

  drills: [
    {
      title: "Один ряд, три шага времени",
      level: "easy",
      body: `<p>Посчитайте выручку по дням, неделям и месяцам. Для каждого шага напечатайте: сколько получилось периодов, сколько из них пустых, среднее по периоду.</p>
<p>Посмотрите на долю пустых периодов: на каком шаге данные становятся пригодными для графика?</p>`,
      solution: `ts = orders[orders["status"] == "paid"].set_index("order_date")["revenue"]

for code, name in [("D", "дни"), ("W-MON", "недели"), ("MS", "месяцы")]:
    s = ts.resample(code).sum()
    empty = int((s == 0).sum())
    print(f"{name}: периодов {len(s)}, пустых {empty} "
          f"({empty / len(s) * 100:.0f}%), среднее {s.mean():.2f}")`,
      note: `<p>По дням пустых почти половина: 189 заказов растянуты на 249 дней. Такой график читать невозможно. По неделям пустых всего три из 37, по месяцам ни одного. Правило простое: <strong>шаг времени выбирают так, чтобы в типичном периоде было хотя бы 20–30 наблюдений</strong>. Иначе вы смотрите на шум и называете его динамикой.</p>`
    },
    {
      title: "Сравнение с прошлой неделей",
      level: "mid",
      body: `<p>Добавьте к недельному ряду столбцы <code>prev</code> (выручка прошлой недели) и <code>wow</code> (прирост в процентах, один знак). Выведите последние 10 недель.</p>
<p>Что должно стоять в <code>wow</code>, если прошлая неделя была нулевой?</p>`,
      solution: `import numpy as np

paid = orders[orders["status"] == "paid"]
w = paid.set_index("order_date")["revenue"].resample("W-MON").sum().to_frame("revenue")

w["prev"] = w["revenue"].shift(1)
# деление на ноль даёт inf, а не ошибку — подменяем на NaN явно
w["wow"] = np.where(w["prev"] > 0,
                    (w["revenue"] / w["prev"] - 1) * 100,
                    np.nan).round(1)

for d, r in w.tail(10).iterrows():
    wow = "-" if pd.isna(r.wow) else f"{r.wow}"
    print(f"{d.date()} {r.revenue:.2f} {wow}")`,
      note: `<p>Деление на ноль в pandas не падает, а возвращает <code>inf</code>, и это число спокойно уезжает в отчёт как «прирост на бесконечность процентов». Проверка <code>prev &gt; 0</code> обязательна везде, где вы считаете относительное изменение. То же касается «роста с нуля до одного заказа»: формально это плюс бесконечность, по смыслу ничего.</p>`
    },
    {
      title: "Где у нас сезонность по дням недели",
      level: "mid",
      body: `<p>Посчитайте по оплаченным заказам, сколько заказов и выручки приходится на каждый день недели. Выведите русские названия дней в календарном порядке, начиная с понедельника.</p>
<p>Есть ли разница между будними и выходными?</p>`,
      solution: `paid = orders[orders["status"] == "paid"].copy()
paid["dow"] = paid["order_date"].dt.dayofweek      # 0 = понедельник

names = ["понедельник", "вторник", "среда", "четверг",
         "пятница", "суббота", "воскресенье"]

g = paid.groupby("dow").agg(orders_cnt=("order_id", "count"),
                            revenue=("revenue", "sum"))

for i in range(7):
    if i in g.index:
        r = g.loc[i]
        print(f"{names[i]} {int(r.orders_cnt)} {r.revenue:.2f}")
    else:
        print(f"{names[i]} 0 0.00")

weekend = paid[paid["dow"] >= 5]
print(f"доля выходных в заказах {len(weekend) / len(paid) * 100:.1f} процента")`,
      note: `<p>Доля выходных около 30 процентов при ожидаемых 28,6 (2 дня из 7) — разницы нет. У нашего магазина недельной сезонности не обнаружено, и это тоже результат. В реальном e-commerce она обычно есть и заметная, поэтому проверять стоит всегда: если сезонность есть, сравнивать надо неделя к неделе, а не день ко дню.</p>`
    },
    {
      title: "Отрезать незакрытый период",
      level: "mid",
      body: `<p>Постройте недельный ряд и уберите из него последнюю неполную неделю: ту, в которую попадает максимальная дата заказа. Напечатайте, сколько недель осталось, и последние пять строк.</p>
<p>Сравните последнее значение до и после обрезки.</p>`,
      solution: `paid = orders[orders["status"] == "paid"]
last_order = paid["order_date"].max()
print("последний заказ:", last_order.date())

w = paid.set_index("order_date")["revenue"].resample("W-MON").sum()
print("недель всего:", len(w), "последняя точка:", f"{w.iloc[-1]:.2f}")

# метка недели W-MON — это её последний день. Неделя закрыта,
# если её метка не позже последнего дня с данными
w_full = w[w.index <= last_order]
print("после обрезки:", len(w_full), "последняя точка:", f"{w_full.iloc[-1]:.2f}")
print()
for d, v in w_full.tail(5).items():
    print(f"{d.date()} {v:.2f}")`,
      note: `<p>После обрезки последней закрытой неделей оказывается 9 сентября, и в ней ноль заказов. Это не повод её убирать: ноль в закрытом периоде реальный факт, в отличие от «падения» в незакрытой неделе. Такая картина честно говорит, что данные к сентябрю иссякают.</p><p>Приём снимает большинство ложных тревог в дашбордах. Заведите привычку: у любого временного графика первым делом смотрите, чем заканчиваются данные, и обрезайте или подписывайте незакрытый период. Пять минут работы против получаса объяснений руководству, почему «падения» на самом деле нет.</p>`
    },
    {
      title: "Дневной ряд со сглаживанием по 7 дням",
      level: "hard",
      body: `<p>Постройте дневной ряд выручки, добавьте скользящее среднее по 7 дням и выведите те дни августа, где сырое значение отличается от сглаженного больше чем вдвое.</p>
<p>Столбцы: дата, выручка, ma7, отношение с двумя знаками.</p>`,
      solution: `paid = orders[orders["status"] == "paid"]
d = paid.set_index("order_date")["revenue"].resample("D").sum().to_frame("revenue")
d["ma7"] = d["revenue"].rolling(7, min_periods=1).mean()

aug = d.loc["2024-08"]
# интересуют только дни, где вообще что-то было
spikes = aug[(aug["revenue"] > 0) & (aug["revenue"] / aug["ma7"] > 2)]

if len(spikes) == 0:
    print("резких выбросов в августе нет")
for dt, r in spikes.iterrows():
    print(f"{dt.date()} {r.revenue:.2f} {r.ma7:.2f} {r.revenue / r.ma7:.2f}")`,
      note: `<p>Отношение сырого значения к сглаженному — простой и очень удобный детектор аномалий для дневных метрик. Больше двух означает «день выбивается вдвое из своей окрестности». На таком признаке строят автоматические алерты в мониторинге: если метрика ушла от своего скользящего среднего сильнее порога, система пишет в чат.</p>`
    }
  ],

  quiz: [
    {
      q: "Чем resample лучше groupby по номеру недели?",
      opts: [
        "Не требует индекса",
        "Достраивает периоды, в которых не было данных",
        "Работает быстрее",
        "Умеет считать медиану"
      ],
      right: 1,
      why: "Пустая неделя у <code>groupby</code> просто не появится, и на графике провал будет закрашен прямой линией между соседними точками. <code>resample</code> вернёт строку с нулём."
    },
    {
      q: "Что делает <code>min_periods=1</code> в rolling?",
      opts: [
        "Ограничивает размер окна",
        "Ускоряет расчёт",
        "Разрешает считать среднее, даже если данных меньше размера окна",
        "Пропускает нулевые значения"
      ],
      right: 2,
      why: "Без него первые строки ряда будут <code>NaN</code>. С ним они посчитаются, но по одному-двум значениям, поэтому шумят сильнее остальных. Это надо помнить при чтении начала графика."
    },
    {
      q: "Последняя точка недельного графика упала на 80 процентов. Первое действие?",
      opts: [
        "Увеличить окно сглаживания",
        "Идти к продакту с сообщением о падении",
        "Пересчитать метрику",
        "Проверить максимальную дату в данных: скорее всего период не закрыт"
      ],
      right: 3,
      why: "Незакрытый период — причина номер один для ложных обвалов в отчётах. Проверяется за десять секунд запросом максимальной даты."
    },
    {
      q: "В чём разница между <code>MS</code> и <code>ME</code>?",
      opts: [
        "MS ставит меткой первое число месяца, ME последнее",
        "Разницы нет",
        "MS для месяцев, ME для недель",
        "MS считает сумму, ME среднее"
      ],
      right: 0,
      why: "Мелочь, пока вы не соединяете две таблицы с разными метками: ключи не совпадут, и merge молча потеряет строки."
    },
    {
      q: "Скользящее среднее по 4 неделям реагирует на реальный спад:",
      opts: [
        "Не реагирует вовсе",
        "С задержкой примерно на половину окна",
        "Мгновенно",
        "Опережая события"
      ],
      right: 1,
      why: "Пока в окно попадают старые хорошие значения, среднее держится. Отсюда правило: о тренде говорят по сглаженному ряду, о конкретной дате по сырому."
    },
    {
      q: "Прошлая неделя дала 0 рублей, эта 10 000. Чему равен прирост?",
      opts: [
        "100 процентов",
        "1000 процентов",
        "Не определён: деление на ноль, в отчёте нужен прочерк",
        "0 процентов"
      ],
      right: 2,
      why: "pandas вернёт <code>inf</code> и не упадёт, а число спокойно уедет в отчёт. Проверка знаменателя на ноль обязательна везде, где считается относительное изменение."
    }
  ],

  links: [
    { t: "Time series в pandas", url: "https://pandas.pydata.org/docs/user_guide/timeseries.html", src: "pandas.pydata.org", lang: "EN",
      d: "Большая глава про даты, частоты и ресемплинг. Таблица кодов частот вроде W-MON и MS находится именно здесь." },
    { t: "Windowing operations", url: "https://pandas.pydata.org/docs/user_guide/window.html", src: "pandas.pydata.org", lang: "EN",
      d: "rolling, expanding, ewm с примерами. Экспоненциальное сглаживание пригодится, когда обычное скользящее слишком запаздывает." },
    { t: "Forecasting: Principles and Practice", url: "https://otexts.com/fpp3/", src: "otexts.com", lang: "EN",
      d: "Бесплатный учебник по временным рядам. Первые три главы про декомпозицию и сезонность полезны любому аналитику." },
    { t: "Курс Time Series на Kaggle", url: "https://www.kaggle.com/learn/time-series", src: "kaggle.com", lang: "EN",
      d: "Практика с тренд-компонентой, сезонностью и лагами. Короткий, с задачами в браузере." },
    { t: "Хаб «Визуализация данных» на Хабре", url: "https://habr.com/ru/hubs/data_visualization/articles/", src: "habr.com", lang: "RU",
      d: "Про то, как временные графики обманывают: обрезанные оси, незакрытые периоды, ложные тренды." }
  ]
};

/* ---------------------------------------------------------- */
/* 2.5 — визуализация: график под задачу                        */
/* ---------------------------------------------------------- */

window.CONTENT.m2l5 = {
  intro: "Половина графиков в дашбордах не отвечает ни на один вопрос. Разбираем, какой тип графика под какую задачу, и собираем картинку прямо в тексте, без библиотек.",
  duration: "≈ 2 часа",
  plan: [
    { m: "35 мин", w: "Теория: пять типов графиков и что ими врут" },
    { m: "35 мин", w: "Основная задача: текстовая гистограмма динамики" },
    { m: "35 мин", w: "Тренажёр: 5 задач на подачу данных" },
    { m: "10 мин", w: "Самопроверка вопросами" },
    { m: "5 мин",  w: "Заметки" }
  ],

  theory: `
<p class="lead">График не украшение отчёта, а инструмент ответа на вопрос. Сначала формулируется вопрос, потом выбирается тип графика. Обратный порядок даёт красивые картинки, из которых ничего не следует.</p>

<h3>Вопрос определяет тип</h3>
<table>
  <tr><th>Вопрос</th><th>График</th><th>Почему</th></tr>
  <tr><td>Как менялось со временем</td><td>линия</td><td>глаз читает наклон как скорость изменения</td></tr>
  <tr><td>Кто больше, кто меньше</td><td>горизонтальные столбцы</td><td>длина сравнивается точнее любого другого признака</td></tr>
  <tr><td>Как распределены значения</td><td>гистограмма или ящик с усами</td><td>видно форму, хвосты и выбросы</td></tr>
  <tr><td>Связаны ли две величины</td><td>точечная диаграмма</td><td>видно форму связи, а не только её силу</td></tr>
  <tr><td>Из чего состоит целое</td><td>столбец с сегментами</td><td>сумма читается, доли сравниваются</td></tr>
  <tr><td>Где теряются пользователи</td><td>воронка или водопад</td><td>показывает переходы, а не только уровни</td></tr>
</table>

<h3>Чего делать не надо</h3>
<ul>
  <li><strong>Круговая диаграмма больше чем на три сектора.</strong> Человек плохо сравнивает углы. Пять секторов по 18–22 процента выглядят одинаково. Замена — горизонтальные столбцы, отсортированные по величине.</li>
  <li><strong>Обрезанная ось Y на столбцах.</strong> Если ось начинается не с нуля, разница в два процента выглядит как разница в два раза. На линейных графиках динамики обрезать ось можно и нужно, на столбцах — нельзя: столбец кодирует величину длиной.</li>
  <li><strong>Двойная ось Y.</strong> Два ряда в разных единицах на одном графике позволяют «показать» любую корреляцию, просто подобрав масштабы. Почти всегда лучше два графика друг под другом с общей осью X.</li>
  <li><strong>Три измерения.</strong> Объёмные столбцы искажают величины перспективой и не добавляют ни бита информации.</li>
  <li><strong>Радуга.</strong> Больше пяти-шести цветов в легенде читатель не удержит. Выделите цветом одну важную серию, остальные сделайте серыми.</li>
</ul>

<div class="callout trap">
  <span class="ct">Три способа соврать графиком, не соврав числами</span>
  <p><strong>Обрезать ось.</strong> Столбцы 98 и 100 при оси от 97 до 101 выглядят как разница втрое.</p>
  <p><strong>Выбрать удобный период.</strong> Метрика падает год, но если показать последние две недели роста, картина обратная. Всегда спрашивайте себя, почему выбран именно этот отрезок.</p>
  <p style="margin-bottom:0"><strong>Смешать абсолютные и относительные величины.</strong> «Рост на 200 процентов» рядом со «снижением на 5 процентов» без абсолютных чисел скрывает, что первое это с 2 до 6 заказов, а второе с миллиона до 950 тысяч.</p>
</div>

<h3>Правила подписи</h3>
<ul>
  <li><strong>Заголовок это вывод, а не тема.</strong> Не «Выручка по каналам», а «Три канала дают 82 процента выручки». Читатель прочитает заголовок и уйдёт, поэтому в нём должен быть ответ.</li>
  <li><strong>Единицы прямо на осях.</strong> «Рубли», «пользователи», «процент от шага 1».</li>
  <li><strong>Сортировка по величине</strong>, если у категорий нет естественного порядка. Алфавитный порядок каналов не несёт смысла.</li>
  <li><strong>Число наблюдений рядом с процентом.</strong> «90 процентов (9 из 10)» и «90 процентов (900 из 1000)» это очень разные утверждения.</li>
</ul>

<h3>Инструменты, если коротко</h3>
<table>
  <tr><th>Инструмент</th><th>Когда</th></tr>
  <tr><td><code>matplotlib</code></td><td>база, полный контроль, многословный синтаксис</td></tr>
  <tr><td><code>seaborn</code></td><td>надстройка: статистические графики в одну строку</td></tr>
  <tr><td><code>df.plot()</code></td><td>быстрый взгляд на данные прямо из pandas</td></tr>
  <tr><td><code>plotly</code></td><td>интерактив: наведение, зум, для веб-отчётов</td></tr>
  <tr><td>BI: DataLens, Power BI, Superset</td><td>дашборды, которые смотрят другие люди</td></tr>
</table>
<p>В этом уроке мы соберём график вручную, символами. Это не игра: текстовая гистограмма реально используется в логах, в сообщениях мониторинга и в письмах, где картинку не покажешь. И, что важнее, она заставляет продумать масштаб и подписи руками, а не полагаться на настройки по умолчанию.</p>

<div class="example">
  <div class="example-h">Как устроена текстовая гистограмма</div>
  <div class="example-b">
<pre><code>mx = values.max()
for label, v in values.items():
    bar = "#" * int(round(v / mx * 40))     # 40 символов на максимум
    print(f"{label} {v:10.2f} {bar}")</code></pre>
    <p>Вся идея в одной строке: величина делится на максимум и умножается на ширину поля. Это ровно то, что делает любая библиотека, только без сотни настроек.</p>
    <p>Обратите внимание на <code>{v:10.2f}</code>: число выравнивается по правому краю в поле шириной 10 символов, поэтому колонка получается ровной и столбики начинаются на одном уровне. Без выравнивания график расползётся.</p>
  </div>
</div>

<div class="callout work">
  <span class="ct">Где это в работе</span>
  <p>Дашборд, который никто не открывает, — самый частый провал аналитика. Обычно причина не в данных, а в подаче: двадцать графиков без иерархии, заголовки-темы вместо выводов, круговые диаграммы на восемь секторов. Умение выбрать один правильный график и подписать его выводом ценится выше, чем знание десяти библиотек.</p>
</div>

<div class="callout jobs">
  <span class="ct">Что закрывает урок в вакансиях</span>
  <ul>
    <li>«Визуализация данных, построение дашбордов» — около 60 процентов вакансий</li>
    <li>«Умение доносить результаты анализа» — то, ради чего графики и нужны</li>
    <li>Тестовое задание: «проанализируйте датасет и представьте выводы» — оценивают именно подачу</li>
  </ul>
</div>
`,

  ticket: {
    from: "Марина, операционный директор",
    subj: "Динамика в письме, без вложений",
    body: `
<p>Мне нужно вставить картинку динамики выручки прямо в письмо совету директоров, вложения там режет почта. Собери текстовую гистограмму по месяцам.</p>
<p>По каждому месяцу с оплаченными заказами одна строка:</p>
<pre><code>ГГГГ-ММ СУММА ПОЛОСА</code></pre>
<ul>
  <li>месяц в формате <code>2024-01</code>;</li>
  <li>сумма с двумя знаками;</li>
  <li>полоса из символов <code>#</code>, длина считается как <code>round(сумма / максимум * 40)</code>.</li>
</ul>
<p>Месяцы по возрастанию. Считать по оплаченным заказам.</p>
`
  },

  schema: window.SH.pySchema + `
<p>Пригодятся: <code>resample("MS")</code>, <code>s.max()</code>, <code>s.items()</code>, <code>d.strftime("%Y-%m")</code> и умножение строки: <code>"#" * 12</code>.</p>
`,

  data: window.SH.pyData,
  packages: ["pandas"],
  prelude: window.SH.pyPrelude,

  starter: `# Текстовая гистограмма выручки по месяцам
paid = orders[orders["status"] == "paid"]

# Шаг 1: помесячная сумма

# Шаг 2: масштаб и вывод
`,

  expected: {
    stdout: `2024-01 25563.37 #########
2024-02 67477.28 #######################
2024-03 85621.79 #############################
2024-04 119150.19 ########################################
2024-05 114508.40 ######################################
2024-06 103461.97 ###################################
2024-07 102708.78 ##################################
2024-08 24759.71 ########
2024-09 10177.29 ###`
  },

  hints: [
    "Помесячная сумма считается тем же <code>resample</code>, что и в прошлом уроке, только код периода <code>\"MS\"</code>. Получится Series, где индекс это первые числа месяцев, а значения — суммы.",
    "Масштаб: возьмите <code>mx = mth.max()</code> один раз до цикла. Длина полосы — <code>int(round(v / mx * 40))</code>. Именно <code>round</code>, а не отбрасывание дробной части: у месяца с максимумом должно получиться ровно 40 символов.",
    "Индекс Series — это <code>Timestamp</code>, для формата <code>2024-01</code> используйте <code>d.strftime(\"%Y-%m\")</code>. Цикл: <code>for d, v in mth.items()</code>. Строка собирается как <code>f\"{d.strftime('%Y-%m')} {v:.2f} {bar}\"</code>, где <code>bar = \"#\" * n</code>."
  ],

  solution: `# Текстовая гистограмма выручки по месяцам
paid = orders[orders["status"] == "paid"]

# Шаг 1. Помесячная сумма. MS: метка периода — первое число месяца
mth = paid.set_index("order_date")["revenue"].resample("MS").sum()

# Шаг 2. Масштаб считаем один раз: длина полосы пропорциональна
# доле от максимума, 40 символов — ширина поля
mx = mth.max()

for d, v in mth.items():
    bar = "#" * int(round(v / mx * 40))
    print(f"{d.strftime('%Y-%m')} {v:.2f} {bar}")`,

  solutionNote: `
<p><strong>Что читается с этой картинки.</strong> Рост до апреля, плато до июля, резкое падение в августе и сентябре. Именно ради этой формы график и строят: те же девять чисел в столбик такого впечатления не производят.</p>
<p><strong>Чего в этой картинке не хватает.</strong> Того же, чего не хватало в уроке 1.6: сентябрь неполный, данные обрываются 11 числа. Отдать такую гистограмму совету директоров нельзя — вывод будет «продажи рухнули вдвое».</p>
<p><strong>Что сделать перед отправкой:</strong> либо убрать сентябрь и подписать «по полным месяцам», либо оставить и добавить строку «сентябрь неполный, данные по 11 число». Второй вариант честнее.</p>
<p><strong>И про заголовок.</strong> В письмо это уходит не как «Динамика выручки», а как «Выручка выросла втрое к апрелю и держится на плато с мая». Заголовок с выводом читают все, таблицу — единицы.</p>
`,

  drills: [
    {
      title: "Столбцы вместо круговой диаграммы",
      level: "easy",
      body: `<p>Постройте текстовую диаграмму долей каналов в выручке: канал, доля в процентах с одним знаком, полоса длиной <code>round(доля)</code> символов. Сортировка по доле убыванием.</p>
<p>Сравните с тем, как это выглядело бы круговой диаграммой на шесть секторов.</p>`,
      solution: `paid = orders[orders["status"] == "paid"]
m = users.merge(paid, on="user_id", how="inner")

rev = m.groupby("channel")["revenue"].sum().sort_values(ascending=False)
total = rev.sum()

for ch, v in rev.items():
    share = v / total * 100
    print(f"{ch:12s} {share:5.1f}% {'#' * int(round(share))}")`,
      note: `<p>Отсортированные столбцы читаются мгновенно: organic вдвое больше следующего, а последние три примерно равны. На круговой диаграмме сектора в 9,5 и 8,6 процента отличить друг от друга невозможно. Правило: <strong>если категорий больше трёх, берите столбцы</strong>.</p>`
    },
    {
      title: "Гистограмма распределения чеков",
      level: "mid",
      body: `<p>Постройте распределение оплаченных чеков по корзинам шириной 1000 рублей: границы корзины, число заказов, полоса.</p>
<p>Посмотрите на форму: где пик, как далеко тянется хвост?</p>`,
      solution: `r = orders.loc[orders["status"] == "paid", "revenue"]

# верхняя граница с запасом: иначе самый крупный заказ выпадет из корзин
bins = pd.cut(r, bins=range(0, 12000, 1000))
counts = bins.value_counts().sort_index()
mx = counts.max()

for interval, n in counts.items():
    lo = int(interval.left)
    bar = "#" * int(round(n / mx * 40))
    print(f"{lo:>6}-{lo + 1000:<6} {n:3d} {bar}")`,
      note: `<p><code>pd.cut</code> режет непрерывную величину на корзины и возвращает категориальный столбец. Форма получается классическая для денег: пик в районе двух тысяч и длинный правый хвост. Именно из-за этого хвоста среднее выше медианы — то, что вы считали в уроке 2.3, теперь видно глазами.</p>`
    },
    {
      title: "Заголовок как вывод",
      level: "easy",
      body: `<p>Упражнение без кода. Перепишите пять заголовков графиков так, чтобы каждый содержал вывод, а не тему. Опирайтесь на числа, которые вы уже посчитали в курсе.</p>
<ol>
  <li>«Выручка по каналам»</li>
  <li>«Воронка»</li>
  <li>«Динамика по месяцам»</li>
  <li>«Распределение чеков»</li>
  <li>«Конверсия по городам»</li>
</ol>`,
      solution: `1. «Три канала дают 82% выручки, партнёрский не принёс ничего»

2. «До оплаты доходят 29% посетителей, половина теряется
    на шаге оплаты»

3. «Выручка выросла втрое к апрелю и держится на плато
    с мая по июль»

4. «Типичный чек 3000 рублей, но 7 крупных заказов
    дают 9% выручки»

5. «В Казани конверсия вдвое выше средней, но это
    19 покупателей из 47»`,
      note: `<p>Обратите внимание на пятый заголовок: вывод сопровождается знаменателем. Это разница между аналитиком и человеком, который делает красивые слайды. Заголовок-вывод экономит читателю тридцать секунд на каждом графике, а на дашборде из двадцати графиков это десять минут.</p>`
    },
    {
      title: "Спарклайн: динамика в одну строку",
      level: "mid",
      body: `<p>Соберите для каждого канала спарклайн — крошечный график в одну строку, показывающий помесячную динамику выручки. Используйте символы <code>▁▂▃▄▅▆▇█</code> по восьми уровням.</p>
<p>Формат: <code>канал спарклайн итог</code>.</p>`,
      solution: `paid = orders[orders["status"] == "paid"]
m = users.merge(paid, on="user_id", how="inner")

blocks = "▁▂▃▄▅▆▇█"

pivot = (m.set_index("order_date")
           .groupby("channel")["revenue"]
           .resample("MS").sum()
           .unstack(0)                    # каналы в столбцы
           .fillna(0))

for ch in pivot.columns:
    s = pivot[ch]
    mx = s.max()
    line = "".join(blocks[min(7, int(v / mx * 7))] if mx > 0 else blocks[0] for v in s)
    print(f"{ch:12s} {line} {s.sum():10.2f}")`,
      note: `<p>Спарклайн придумал Эдвард Тафти: график размером со слово, который ставят прямо в текст или в ячейку таблицы. В дашбордах его используют в таблицах метрик — колонка «динамика» рядом с колонкой «значение». Читателю не надо открывать отдельный график, чтобы понять, растёт метрика или падает.</p>`
    },
    {
      title: "Разбор чужого графика",
      level: "hard",
      body: `<p>Упражнение без кода. Вам прислали слайд: столбчатая диаграмма «Конверсия по платформам», три столбца, ось Y от 44 до 50 процентов, столбцы подписаны 45,2 / 47,8 / 49,1. Заголовок: «iOS конвертится лучше всех». Внизу мелким шрифтом: «данные за 3 дня».</p>
<p>Напишите пять вопросов, которые вы зададите автору, прежде чем этот слайд уйдёт руководству.</p>`,
      solution: `1. Почему ось начинается с 44%? На полной оси от нуля разница
   между 45,2 и 49,1 почти не видна. Обрезанная ось на столбцах
   превращает 4 процентных пункта в трёхкратный разрыв.

2. Сколько наблюдений в каждой группе? 49% может быть
   и 490 из 1000, и 49 из 100, и 4,9 из 10. Без знаменателя
   разница в 4 пункта может быть чистым шумом.

3. Почему три дня? Это полные недели? Не попал ли на них
   релиз, распродажа или сбой? Три дня почти никогда
   не репрезентативны.

4. Как считалась конверсия: от установок, от сессий,
   от уникальных пользователей? Одинаково ли для всех
   трёх платформ?

5. Есть ли доверительный интервал или хотя бы разброс
   по дням? Если конверсия каждый день скачет на 5 пунктов,
   разница между платформами внутри шума.`,
      note: `<p>Этот навык проверяют на собеседованиях чаще, чем умение строить графики: вам показывают слайд и просят прокомментировать. Схема вопросов всегда одна: <strong>ось, знаменатель, период, определение метрики, разброс</strong>. Выучите её как чек-лист.</p>`
    }
  ],

  quiz: [
    {
      q: "Нужно сравнить выручку шести каналов. Какой график?",
      opts: [
        "Линейный график",
        "Точечная диаграмма",
        "Круговая диаграмма",
        "Горизонтальные столбцы, отсортированные по величине"
      ],
      right: 3,
      why: "Углы сравниваются человеком плохо, длины хорошо. Шесть секторов на круговой диаграмме различить невозможно, особенно когда доли близки."
    },
    {
      q: "На столбчатой диаграмме ось Y начинается с 44 вместо нуля. Почему это проблема?",
      opts: [
        "Столбец кодирует величину длиной, и обрезанная ось искажает соотношение",
        "Так график хуже читается",
        "Проблемы нет, так экономится место",
        "Это нарушает стандарты оформления"
      ],
      right: 0,
      why: "Разница в 4 процентных пункта нарисуется как разница втрое. На линейном графике динамики обрезать ось можно, на столбцах нельзя."
    },
    {
      q: "Какой заголовок правильный?",
      opts: [
        "График 4.2",
        "Три канала дают 82 процента выручки",
        "Выручка по каналам за 2024 год",
        "Анализ каналов привлечения"
      ],
      right: 1,
      why: "Заголовок читают все, график изучают единицы. В заголовке должен стоять вывод, ради которого график вообще построен."
    },
    {
      q: "Что не так с двойной осью Y?",
      opts: [
        "Её не поддерживает matplotlib",
        "Она сложна в реализации",
        "Подбором масштабов можно нарисовать любую видимую связь между рядами",
        "Она занимает много места"
      ],
      right: 2,
      why: "Два ряда в разных единицах на одном полотне — способ показать корреляцию, которой нет. Почти всегда лучше два графика друг под другом с общей осью X."
    },
    {
      q: "В отчёте написано «конверсия выросла на 200 процентов». Что спросить первым?",
      opts: [
        "Кто считал",
        "За какой период",
        "Какой инструмент использовали",
        "Какие абсолютные числа стоят за процентом"
      ],
      right: 3,
      why: "Рост с 2 до 6 заказов это тоже плюс 200 процентов. Процент без абсолютных значений и знаменателя не несёт информации о масштабе."
    },
    {
      q: "Зачем нужен спарклайн?",
      opts: [
        "Показать направление динамики прямо в строке таблицы, не открывая отдельный график",
        "Для печати на чёрно-белом принтере",
        "Он точнее обычного графика",
        "Это модно"
      ],
      right: 0,
      why: "График размером со слово рядом со значением метрики. Читатель видит и уровень, и тренд одновременно, не переключая внимание."
    }
  ],

  links: [
    { t: "From Data to Viz", url: "https://www.data-to-viz.com/", src: "data-to-viz.com", lang: "EN",
      d: "Дерево решений: отвечаете на вопросы про свои данные и получаете подходящий тип графика с примерами кода и списком типичных ошибок." },
    { t: "Галерея matplotlib", url: "https://matplotlib.org/stable/gallery/index.html", src: "matplotlib.org", lang: "EN",
      d: "Сотни примеров с кодом. Проще найти похожий график и переделать, чем собирать с нуля по документации." },
    { t: "Seaborn: примеры", url: "https://seaborn.pydata.org/examples/index.html", src: "seaborn.pydata.org", lang: "EN",
      d: "Статистические графики в одну строку: распределения, ящики с усами, парные диаграммы. То, что нужно для разведочного анализа." },
    { t: "Storytelling with Data", url: "https://www.storytellingwithdata.com/blog", src: "storytellingwithdata.com", lang: "EN",
      d: "Блог Коул Нассбаумер Кнафлик про подачу данных. Разборы «было / стало» на реальных слайдах: лучший источник по теме." },
    { t: "Хаб «Визуализация данных» на Хабре", url: "https://habr.com/ru/hubs/data_visualization/articles/", src: "habr.com", lang: "RU",
      d: "Разборы графиков на русском, включая примеры того, как графиками вводят в заблуждение." },
    { t: "Яндекс DataLens", url: "https://datalens.yandex.ru/", src: "datalens.yandex.ru", lang: "RU",
      d: "Бесплатный BI, который часто требуют в российских вакансиях. Для портфолио удобно: дашборд можно опубликовать по ссылке." }
  ]
};

/* ---------------------------------------------------------- */
/* 2.6 — функции и читаемый код                                 */
/* ---------------------------------------------------------- */

window.CONTENT.m2l6 = {
  intro: "Ноутбук, который не стыдно показать: функции вместо копипасты, понятные имена, проверки на входе. Это то, что смотрят в тестовом задании внимательнее самих цифр.",
  duration: "≈ 2 часа",
  plan: [
    { m: "30 мин", w: "Теория: функции, имена, структура ноутбука" },
    { m: "40 мин", w: "Основная задача: превратить расчёт в функцию" },
    { m: "35 мин", w: "Тренажёр: 5 задач на рефакторинг" },
    { m: "10 мин", w: "Самопроверка вопросами" },
    { m: "5 мин",  w: "Заметки" }
  ],

  theory: `
<p class="lead">Ваш код читают дважды: коллега на ревью и вы сами через месяц. Оба раза человек хочет понять логику, а не разгадывать ребус. Тестовое задание на позицию аналитика оценивают ровно по этому критерию.</p>

<h3>Когда пора заводить функцию</h3>
<p>Простое правило: как только один и тот же блок появился в ноутбуке во второй раз. Не в третий, во второй. Второе появление означает, что будет и третье, а после третьего вы обязательно забудете поправить одну из копий.</p>
<div class="cmp">
  <div class="bad">
    <span class="cmp-t">Копипаста</span>
<pre><code>o = orders[orders["status"] == "paid"]
r1 = users.merge(o, on="user_id")
a = r1.groupby("channel")["revenue"].sum()

o2 = orders[orders["status"] == "paid"]
r2 = users.merge(o2, on="user_id")
b = r2.groupby("city")["revenue"].sum()</code></pre>
    <p>Понадобилось добавить фильтр по датам — правим в двух местах. Забыли одно — числа разошлись, и вы полдня ищете почему.</p>
  </div>
  <div class="good">
    <span class="cmp-t">Одна функция</span>
<pre><code>def revenue_by(dim, status="paid"):
    sel = orders[orders["status"] == status]
    m = users.merge(sel, on="user_id")
    return m.groupby(dim)["revenue"].sum()

a = revenue_by("channel")
b = revenue_by("city")</code></pre>
    <p>Логика в одном месте. Правка применяется сразу везде, и расхождение чисел становится невозможным по построению.</p>
  </div>
</div>

<h3>Как выглядит хорошая функция</h3>
<pre><code>def channel_report(users_df, orders_df, status="paid"):
    """Сводка по каналам привлечения.

    users_df, orders_df — исходные таблицы
    status — какие заказы считаем, по умолчанию оплаченные

    Возвращает DataFrame с индексом channel и столбцами
    users_cnt, orders_cnt, revenue, aov, отсортированный по выручке.
    """
    sel = orders_df[orders_df["status"] == status]
    m = users_df.merge(sel, on="user_id", how="left")
    rep = m.groupby("channel").agg(
        users_cnt=("user_id", "nunique"),
        orders_cnt=("order_id", "count"),
        revenue=("revenue", "sum"),
    )
    rep["revenue"] = rep["revenue"].round(2)
    rep["aov"] = (rep["revenue"] / rep["orders_cnt"]).round(2).fillna(0)
    return rep.sort_values("revenue", ascending=False)</code></pre>
<p>Что здесь важно:</p>
<ul>
  <li><strong>Данные приходят аргументами, а не берутся из глобальных переменных.</strong> Функция, которая читает <code>orders</code> откуда-то снаружи, ломается при первом же переносе в другой ноутбук.</li>
  <li><strong>Есть значение по умолчанию</strong> у параметра, который почти всегда одинаковый. Вызов остаётся коротким, но гибкость сохраняется.</li>
  <li><strong>Функция возвращает данные, а не печатает их.</strong> Печать — отдельная задача. Возвращённый DataFrame можно и напечатать, и сохранить, и передать дальше.</li>
  <li><strong>Docstring отвечает на три вопроса:</strong> что делает, что принимает, что возвращает. Три строки, которые экономят читателю пять минут.</li>
</ul>

<div class="callout trap">
  <span class="ct">Функция, которая печатает, — почти всегда ошибка</span>
  <p>Соблазн написать <code>print</code> внутри функции велик: сразу видно результат. Но такую функцию нельзя переиспользовать. Её результат нельзя сложить с другим, сохранить в файл, передать в график.</p>
  <p style="margin-bottom:0"><strong>Правило:</strong> одна функция считает и возвращает, другая печатает. Если очень нужно, добавьте параметр <code>verbose=False</code>, но по умолчанию функция должна молчать.</p>
</div>

<h3>Имена</h3>
<table>
  <tr><th>Плохо</th><th>Хорошо</th><th>Почему</th></tr>
  <tr><td><code>df</code>, <code>df2</code>, <code>tmp</code></td><td><code>paid_orders</code>, <code>channel_stats</code></td><td>через месяц вы не вспомните, что во втором df</td></tr>
  <tr><td><code>x</code>, <code>a</code>, <code>res</code></td><td><code>revenue</code>, <code>buyers</code></td><td>имя должно говорить о содержимом</td></tr>
  <tr><td><code>calc()</code>, <code>process()</code></td><td><code>channel_report()</code>, <code>clean_leads()</code></td><td>глагол плюс существительное</td></tr>
  <tr><td><code>d</code></td><td><code>days_to_first_order</code></td><td>длинное понятное лучше короткого загадочного</td></tr>
</table>
<p>Единственное исключение — переменные внутри короткого цикла или лямбды. Там <code>i</code>, <code>s</code>, <code>g</code> нормальны, потому что время их жизни две строки.</p>

<h3>Структура ноутбука</h3>
<ol>
  <li><strong>Заголовок и постановка задачи.</strong> Три предложения: какой вопрос решаем, какие данные, что будет на выходе.</li>
  <li><strong>Импорты и настройки.</strong> Одна ячейка в самом верху, больше нигде.</li>
  <li><strong>Загрузка данных.</strong> Отдельная ячейка, чтобы не перечитывать файл при каждом запуске.</li>
  <li><strong>Проверка качества.</strong> Размер, типы, пропуски, дубли. Обязательно с выводами текстом.</li>
  <li><strong>Функции.</strong> Всё переиспользуемое собрано в одном месте.</li>
  <li><strong>Расчёты и графики.</strong> Каждый блок с заголовком-вопросом.</li>
  <li><strong>Выводы.</strong> Текстом, списком, в конце. Именно их прочитает заказчик.</li>
</ol>
<p><strong>Ноутбук должен исполняться сверху вниз без ошибок после «Restart and run all».</strong> Это первое, что делает проверяющий тестовое задание. Если падает, дальше обычно не смотрят.</p>

<div class="callout note">
  <span class="ct">Assert: дешёвая страховка</span>
  <p>Одна строка в начале расчёта ловит целый класс ошибок:</p>
<pre><code>assert len(m) == len(users), f"merge размножил строки: {len(users)} -> {len(m)}"
assert df["revenue"].min() >= 0, "в выручке отрицательные значения"
assert not df["user_id"].duplicated().any(), "дубли по user_id"</code></pre>
  <p style="margin-bottom:0">Проверка стоит секунду и падает с понятным сообщением ровно там, где сломалось, а не через двадцать ячеек в виде странного числа в отчёте.</p>
</div>

<div class="callout work">
  <span class="ct">Где это в работе</span>
  <p>Тестовое задание на позицию аналитика почти всегда выглядит так: датасет и вопрос, присылайте ноутбук. Правильные числа получают почти все кандидаты. Отбирают по тому, можно ли читать код, есть ли проверки данных и написаны ли выводы словами. Это самый управляемый фактор во всём процессе найма.</p>
</div>

<div class="callout jobs">
  <span class="ct">Что закрывает урок в вакансиях</span>
  <ul>
    <li>«Умение писать чистый воспроизводимый код» — прямая формулировка</li>
    <li>«Опыт автоматизации отчётности» — автоматизируют функциями, а не копипастой</li>
    <li>Тестовое задание — оценивают ровно по этим критериям</li>
  </ul>
</div>
`,

  ticket: {
    from: "Наставник",
    subj: "Оформи расчёт как функцию",
    body: `
<p>Отчёт по каналам вы уже делали в уроке 2.1 одним куском кода. Теперь оформите его как функцию, которую можно переиспользовать.</p>
<p>Напишите функцию <code>channel_report(users_df, orders_df, status="paid")</code>, которая:</p>
<ul>
  <li>принимает таблицы аргументами, а не берёт из глобальных переменных;</li>
  <li>имеет docstring;</li>
  <li><strong>ничего не печатает</strong>, а возвращает DataFrame;</li>
  <li>в DataFrame индекс <code>channel</code> и столбцы <code>users_cnt</code>, <code>orders_cnt</code>, <code>revenue</code>, <code>aov</code>;</li>
  <li>отсортирован по выручке убыванием.</li>
</ul>
<p>Затем вызовите её и напечатайте результат по строке на канал:</p>
<pre><code>канал users_cnt orders_cnt revenue aov</code></pre>
<p>Деньги с двумя знаками, счётчики целыми. Каналы без заказов должны остаться в отчёте.</p>
`
  },

  schema: window.SH.pySchema,
  data: window.SH.pyData,
  packages: ["pandas"],
  prelude: window.SH.pyPrelude,

  starter: `# Отчёт по каналам, оформленный функцией

def channel_report(users_df, orders_df, status="paid"):
    """
    """
    # тело функции
    pass


rep = channel_report(users, orders)
for ch, row in rep.iterrows():
    print(...)
`,

  expected: {
    stdout: `organic 75 74 271926.54 3674.68
paid_search 55 51 141330.95 2771.20
email 28 28 122017.95 4357.78
social 42 24 61776.11 2574.00
referral 14 12 56377.23 4698.10
partner 6 0 0.00 0.00`
  },

  hints: [
    "Логика внутри функции ровно та же, что в уроке 2.1: фильтр по статусу, <code>merge</code> с <code>how=\"left\"</code>, <code>groupby(\"channel\").agg(...)</code>. Разница только в том, что <code>users</code> и <code>orders</code> внутри функции называются <code>users_df</code> и <code>orders_df</code> — так функция не зависит от того, как переменные названы снаружи.",
    "Не вызывайте <code>reset_index()</code>: в тикете сказано, что индексом должен быть <code>channel</code>. Тогда перебор строк делается через <code>for ch, row in rep.iterrows()</code>, где <code>ch</code> — название канала. Средний чек считайте как <code>revenue / orders_cnt</code> с обязательным <code>.fillna(0)</code>: у <code>partner</code> это деление нуля на ноль.",
    "Формат печати: <code>f\"{ch} {int(row.users_cnt)} {int(row.orders_cnt)} {row.revenue:.2f} {row.aov:.2f}\"</code>. Обратите внимание, что <code>revenue</code> надо округлить внутри функции до присвоения <code>aov</code>, иначе средний чек посчитается от неокруглённой суммы и в последнем знаке может разойтись с эталоном."
  ],

  solution: `# Отчёт по каналам, оформленный функцией

def channel_report(users_df, orders_df, status="paid"):
    """Сводка по каналам привлечения.

    users_df  — таблица пользователей с колонками user_id и channel
    orders_df — таблица заказов с колонками user_id, revenue, status
    status    — какие заказы считаем, по умолчанию оплаченные

    Возвращает DataFrame: индекс channel, столбцы users_cnt,
    orders_cnt, revenue, aov. Отсортирован по выручке убыванием.
    Каналы без заказов сохраняются с нулями.
    """
    # аргументы, а не глобальные переменные:
    # так функцию можно перенести в другой ноутбук как есть
    sel = orders_df[orders_df["status"] == status]

    # LEFT: каналы без заказов должны остаться в отчёте
    m = users_df.merge(sel, on="user_id", how="left")

    rep = m.groupby("channel").agg(
        users_cnt=("user_id", "nunique"),
        orders_cnt=("order_id", "count"),
        revenue=("revenue", "sum"),
    )
    # округляем ДО расчёта производных, иначе средний чек
    # посчитается от неокруглённой суммы
    rep["revenue"] = rep["revenue"].round(2)
    # fillna закрывает деление 0 на 0 у канала без заказов
    rep["aov"] = (rep["revenue"] / rep["orders_cnt"]).round(2).fillna(0)

    # функция возвращает данные и ничего не печатает:
    # печать — задача вызывающего кода
    return rep.sort_values("revenue", ascending=False)


rep = channel_report(users, orders)

for ch, row in rep.iterrows():
    print(f"{ch} {int(row.users_cnt)} {int(row.orders_cnt)} "
          f"{row.revenue:.2f} {row.aov:.2f}")`,

  solutionNote: `
<p><strong>Что вы получили помимо тех же чисел.</strong> Теперь отчёт по возвращённым заказам делается одной строкой: <code>channel_report(users, orders, status="refunded")</code>. Отчёт по подвыборке пользователей — тоже: <code>channel_report(users[users["platform"] == "ios"], orders)</code>. Это и есть смысл функции.</p>
<p><strong>Проверьте себя тремя вопросами:</strong></p>
<ul>
  <li>Работает ли функция, если переименовать глобальные переменные? Если нет, значит внутри осталось обращение к глобалам.</li>
  <li>Можно ли по одному docstring понять, что она делает, не читая тело?</li>
  <li>Возвращает ли она данные, а не печатает? Если печатает, результат нельзя переиспользовать.</li>
</ul>
<p><strong>Следующий шаг в реальной работе</strong> — вынести такие функции в отдельный файл <code>utils.py</code> и импортировать в ноутбуки. Тогда один и тот же расчёт гарантированно одинаков во всех отчётах команды, а исправление ошибки применяется везде сразу.</p>
`,

  drills: [
    {
      title: "Универсальный отчёт по любому разрезу",
      level: "easy",
      body: `<p>Обобщите функцию: пусть <code>revenue_report(users_df, orders_df, dim, status="paid")</code> строит сводку по любому столбцу из <code>users</code> — каналу, городу, платформе.</p>
<p>Вызовите её трижды и напечатайте по одной строке с итогом для каждого разреза.</p>`,
      solution: `def revenue_report(users_df, orders_df, dim, status="paid"):
    """Выручка и заказы в разрезе dim (channel, city, platform)."""
    sel = orders_df[orders_df["status"] == status]
    m = users_df.merge(sel, on="user_id", how="left")
    rep = m.groupby(dim).agg(
        users_cnt=("user_id", "nunique"),
        orders_cnt=("order_id", "count"),
        revenue=("revenue", "sum"),
    )
    rep["revenue"] = rep["revenue"].round(2)
    return rep.sort_values("revenue", ascending=False)


for dim in ["channel", "city", "platform"]:
    rep = revenue_report(users, orders, dim)
    print(f"{dim}: категорий {len(rep)}, "
          f"лидер {rep.index[0]} с {rep['revenue'].iloc[0]:.2f}")`,
      note: `<p>Одна функция закрыла три отчёта. Именно так растёт полезность кода: параметризуется то, что меняется, а логика остаётся в одном месте. Проверьте, что итоговая выручка во всех трёх разрезах одинаковая — если разошлась, где-то теряются строки.</p>`
    },
    {
      title: "Проверки на входе",
      level: "mid",
      body: `<p>Добавьте в функцию защиту от типичных ошибок. Она должна падать с понятным сообщением, если:</p>
<ul>
  <li>в <code>users_df</code> нет столбца, по которому просят разрез;</li>
  <li>после merge количество уникальных пользователей изменилось;</li>
  <li>в выручке встретилось отрицательное значение.</li>
</ul>
<p>Проверьте, что на корректных данных функция работает, а на испорченных падает.</p>`,
      solution: `def revenue_report(users_df, orders_df, dim, status="paid"):
    """Выручка в разрезе dim. Падает на некорректных входных данных."""
    assert dim in users_df.columns, f"нет столбца {dim} в users_df"

    sel = orders_df[orders_df["status"] == status]
    assert (sel["revenue"] >= 0).all(), "в выручке есть отрицательные значения"

    m = users_df.merge(sel, on="user_id", how="left")
    assert m["user_id"].nunique() == users_df["user_id"].nunique(), \\
        f"merge потерял пользователей: {users_df['user_id'].nunique()} -> {m['user_id'].nunique()}"

    return m.groupby(dim)["revenue"].sum().round(2).sort_values(ascending=False)


print(revenue_report(users, orders, "city").to_string())
print()

# проверяем, что защита срабатывает
try:
    revenue_report(users, orders, "manager")
except AssertionError as e:
    print("поймали ошибку:", e)`,
      note: `<p>Три строки <code>assert</code> ловят три самых частых способа получить неверный отчёт. Их пишут не для красоты: без них ошибка проявится не в момент возникновения, а через двадцать ячеек в виде странного числа, и искать её вы будете час.</p>`
    },
    {
      title: "Разобрать чужой ноутбук",
      level: "mid",
      body: `<p>Вот фрагмент из чужого ноутбука. Он работает и даёт правильный ответ. Найдите в нём пять проблем и перепишите.</p>
<pre><code>d = orders[orders.status=='paid']
d2 = users.merge(d,on='user_id')
x = d2.groupby('channel').agg({'revenue':'sum','user_id':'nunique'})
x = x.sort_values('revenue',ascending=False)
print(x)
d3 = orders[orders.status=='refunded']
d4 = users.merge(d3,on='user_id')
y = d4.groupby('channel').agg({'revenue':'sum','user_id':'nunique'})
y = y.sort_values('revenue',ascending=False)
print(y)</code></pre>`,
      solution: `# Проблемы:
# 1. Имена d, d2, x, y ничего не говорят о содержимом.
# 2. Один и тот же блок скопирован дважды: правка нужна в двух местах.
# 3. merge без how: молча inner, каналы без заказов исчезают.
# 4. Словарь в agg вместо именованной агрегации:
#    столбцы называются revenue и user_id, а не revenue и buyers.
# 5. Функция печатает вместо того, чтобы вернуть данные:
#    результат нельзя переиспользовать.

def channel_revenue(users_df, orders_df, status):
    """Выручка и число покупателей по каналам для заданного статуса."""
    selected = orders_df[orders_df["status"] == status]
    joined = users_df.merge(selected, on="user_id", how="left")
    return (joined.groupby("channel")
            .agg(revenue=("revenue", "sum"),
                 buyers=("user_id", "nunique"))
            .sort_values("revenue", ascending=False))


paid_report = channel_revenue(users, orders, "paid")
refunded_report = channel_revenue(users, orders, "refunded")

print("оплаченные:")
print(paid_report.to_string())
print()
print("возвраты:")
print(refunded_report.to_string())`,
      note: `<p>Обратите внимание на пункт 3: в исходном коде <code>merge</code> без <code>how</code> отработал как <code>inner</code>, и канал <code>partner</code> просто не попал в отчёт. Числа при этом «правильные», ошибку заметить невозможно, пока кто-нибудь не спросит, куда делся канал. Такие тихие ошибки и есть главная опасность неаккуратного кода.</p>`
    },
    {
      title: "Функция для метрики с параметрами",
      level: "hard",
      body: `<p>Напишите <code>retention_rate(orders_df, days=30, status="paid")</code>: доля покупателей, сделавших повторную покупку в течение <code>days</code> дней после первой.</p>
<p>Вызовите её для 7, 30, 60 и 90 дней и напечатайте таблицу: окно, покупателей, вернувшихся, процент.</p>`,
      solution: `def retention_rate(orders_df, days=30, status="paid"):
    """Доля покупателей с повторной покупкой в течение days дней.

    Возвращает кортеж (всего покупателей, вернулись, процент).
    """
    sel = orders_df[orders_df["status"] == status]
    first = sel.groupby("user_id")["order_date"].min().rename("first_date")

    joined = sel.merge(first, on="user_id")
    gap = (joined["order_date"] - joined["first_date"]).dt.days
    # 0 < gap <= days: сам первый заказ не считается повторным
    returned = joined.loc[(gap > 0) & (gap <= days), "user_id"].nunique()

    total = len(first)
    return total, returned, round(returned / total * 100, 1)


for d in [7, 30, 60, 90]:
    total, ret, pct = retention_rate(orders, days=d)
    print(f"{d} дней: {total} покупателей, вернулись {ret}, {pct} процента")`,
      note: `<p>Метрика с параметром окна — типичный случай, когда функция обязательна. Без неё вы скопируете один и тот же расчёт четыре раза, поменяете число в трёх местах из четырёх и получите непонятную таблицу. Обратите внимание на условие <code>gap &gt; 0</code>: без него первый заказ каждого покупателя посчитался бы как повторный, и ретеншен вышел бы стопроцентным.</p>`
    },
    {
      title: "Чек-лист ноутбука перед отправкой",
      level: "easy",
      body: `<p>Упражнение без кода. Составьте личный чек-лист из восьми пунктов, который вы будете прогонять перед отправкой любого тестового задания или отчёта.</p>
<p>Опирайтесь на то, что разбиралось в модуле: проверки данных, имена, функции, выводы.</p>`,
      solution: `1. Restart and run all проходит без единой ошибки.

2. В начале три предложения: какой вопрос, какие данные,
   что на выходе.

3. Есть блок проверки качества данных: размер, типы,
   пропуски, дубли, период. С выводами текстом,
   а не просто вызовами методов.

4. Ни один блок кода не повторяется дважды: повторы
   вынесены в функции с docstring.

5. Все имена переменных читаются без комментария:
   ни одного df2, tmp, x.

6. Каждое число в отчёте сопровождается знаменателем
   или периодом: не «47 процентов», а «47 процентов,
   104 из 220 за девять месяцев».

7. У каждого графика заголовок-вывод, а не заголовок-тема.

8. В конце раздел «Выводы» словами: 3-5 пунктов,
   которые можно прочитать вместо всего ноутбука.`,
      note: `<p>Восьмой пункт самый важный и его чаще всего пропускают. Заказчик почти никогда не читает код: он читает выводы и смотрит на графики. Ноутбук без раздела выводов заставляет его делать вашу работу самому, и это первое, что портит впечатление.</p>`
    }
  ],

  quiz: [
    {
      q: "Когда пора выносить код в функцию?",
      opts: [
        "Когда код длиннее 50 строк",
        "Когда блок повторился во второй раз",
        "Когда блок повторился в третий раз",
        "Функции в ноутбуках не нужны"
      ],
      right: 1,
      why: "Второе появление почти всегда означает, что будет и третье. А после третьего вы гарантированно забудете поправить одну из копий, и числа разойдутся."
    },
    {
      q: "Почему функция не должна печатать результат?",
      opts: [
        "Это медленно",
        "print не работает внутри функций",
        "Напечатанный результат нельзя переиспользовать: сохранить, передать дальше, сложить",
        "Это нарушает PEP 8"
      ],
      right: 2,
      why: "Одна функция считает и возвращает, другая печатает. Тогда результат можно и показать, и отправить в файл, и построить по нему график."
    },
    {
      q: "Функция берёт <code>orders</code> из глобальной области вместо аргумента. Чем это плохо?",
      opts: [
        "Python это запрещает",
        "Работает медленнее",
        "Ничем, так короче",
        "Функция ломается при переносе в другой ноутбук и молча считает не по тем данным"
      ],
      right: 3,
      why: "Хуже всего то, что она не падает, а тихо считает по глобальной переменной, даже когда вы передали другую таблицу. Такую ошибку почти невозможно заметить."
    },
    {
      q: "Зачем нужен <code>assert</code> в аналитическом коде?",
      opts: [
        "Чтобы ошибка проявилась там, где возникла, а не через двадцать ячеек странным числом",
        "Это требование Jupyter",
        "Чтобы ускорить расчёт",
        "Для красоты"
      ],
      right: 0,
      why: "Проверка вроде «после merge число пользователей не изменилось» стоит секунду и падает с понятным сообщением ровно в точке поломки."
    },
    {
      q: "Что проверяющий делает с вашим ноутбуком первым делом?",
      opts: [
        "Смотрит на графики",
        "Нажимает Restart and run all",
        "Проверяет числа",
        "Читает выводы"
      ],
      right: 1,
      why: "Если ноутбук не исполняется сверху вниз без ошибок, дальше обычно не смотрят. Это самая обидная причина не пройти тестовое."
    },
    {
      q: "Какое имя переменной лучше для отфильтрованных оплаченных заказов?",
      opts: ["d", "tmp", "paid_orders", "df2"],
      right: 2,
      why: "Имя должно отвечать на вопрос «что внутри» без чтения кода выше. Короткие имена допустимы только внутри двухстрочного цикла."
    }
  ],

  links: [
    { t: "PEP 8: стиль кода Python", url: "https://peps.python.org/pep-0008/", src: "peps.python.org", lang: "EN",
      d: "Официальное соглашение об оформлении. Читать целиком не обязательно, но разделы про имена и отступы стоит просмотреть один раз." },
    { t: "Jupyter Notebook Best Practices", url: "https://docs.jupyter.org/en/latest/", src: "docs.jupyter.org", lang: "EN",
      d: "Официальная документация Jupyter. Полезно про воспроизводимость и порядок исполнения ячеек." },
    { t: "Google Python Style Guide", url: "https://google.github.io/styleguide/pyguide.html", src: "google.github.io", lang: "EN",
      d: "Раздел про docstring — образец того, как описывать функции. Формат оттуда используют во многих командах." },
    { t: "Cookiecutter Data Science", url: "https://cookiecutter-data-science.drivendata.org/", src: "drivendata.org", lang: "EN",
      d: "Стандартная структура аналитического проекта: где лежат данные, где ноутбуки, где переиспользуемый код. Пригодится для портфолио." },
    { t: "Хаб Python на Хабре", url: "https://habr.com/ru/hubs/python/articles/", src: "habr.com", lang: "RU",
      d: "Разборы про читаемый код и рефакторинг на русском. Полезно, когда хочется примеров, а не правил." }
  ]
};

/* ---------------------------------------------------------- */
/* 2.7 — проект: EDA-ноутбук                                    */
/* ---------------------------------------------------------- */

window.CONTENT.m2l7 = {
  intro: "Первый проект в портфолио: разведочный анализ от проверки данных до выводов словами. Именно такой ноутбук вы приложите к отклику.",
  duration: "≈ 2,5 часа",
  plan: [
    { m: "25 мин", w: "Теория: что такое EDA и в каком порядке его делать" },
    { m: "50 мин", w: "Основная задача: сводка по всей базе" },
    { m: "50 мин", w: "Тренажёр: 5 блоков будущего ноутбука" },
    { m: "15 мин", w: "Самопроверка и сборка выводов" }
  ],

  theory: `
<p class="lead">EDA, разведочный анализ данных, — это то, что аналитик делает с любым новым датасетом первым. Цель не в красивых графиках, а в том, чтобы понять, что вообще внутри, где данные врут и какие вопросы к ним имеет смысл задавать.</p>

<h3>Порядок, который работает всегда</h3>
<ol>
  <li><strong>Объём и период.</strong> Сколько строк, за какой промежуток, нет ли обрыва в конце. Это ловит неполные выгрузки до того, как вы построите на них выводы.</li>
  <li><strong>Качество.</strong> Типы, пропуски, дубли, сироты после соединений, невозможные значения.</li>
  <li><strong>Распределения ключевых величин.</strong> Медиана, среднее, перцентили, выбросы. Отдельно по каждой денежной и временной колонке.</li>
  <li><strong>Разрезы.</strong> Как метрики отличаются по каналам, городам, платформам. Ищем, где сегменты ведут себя непохоже.</li>
  <li><strong>Динамика.</strong> Что менялось во времени, есть ли тренд и сезонность.</li>
  <li><strong>Связи.</strong> Влияет ли одно на другое: канал на чек, платформа на конверсию.</li>
  <li><strong>Выводы и гипотезы.</strong> Словами, списком, с числами.</li>
</ol>
<p>Пункты с первого по третий делаются всегда и в этом порядке. Дальше порядок зависит от задачи, но пропускать первые три нельзя: именно там находится большинство сюрпризов.</p>

<h3>Что писать в выводах</h3>
<p>Плохие выводы описывают, что вы делали: «была проведена очистка данных, построены графики распределений». Хорошие отвечают на вопрос заказчика и предлагают следующий шаг.</p>
<div class="cmp">
  <div class="bad">
    <span class="cmp-t">Пересказ действий</span>
    <p>«Проанализированы данные интернет-магазина. Построены графики по каналам и месяцам. Выявлены выбросы. Рассчитана конверсия.»</p>
    <p>Читатель узнал только то, что вы работали. Ни одного факта, ни одного решения.</p>
  </div>
  <div class="good">
    <span class="cmp-t">Факты и следствия</span>
    <p>«До покупки доходят 29 процентов посетителей, половина теряется на шаге оплаты. Канал social даёт 42 пользователя при конверсии 28,6 процента, вдвое хуже остальных: стоит проверить качество трафика. Данные обрываются 11 сентября, август и сентябрь в тренд не идут.»</p>
    <p>Три факта, каждый с числом, у каждого понятно следствие.</p>
  </div>
</div>

<h3>Правило знаменателя</h3>
<p>Каждый процент в выводах сопровождается абсолютными числами и периодом. «Конверсия 47 процентов» может значить что угодно. «Конверсия 47 процентов, 104 покупателя из 220 зарегистрированных за девять месяцев» — это утверждение, с которым можно работать.</p>

<div class="callout trap">
  <span class="ct">Три ошибки, которые видно в чужом EDA сразу</span>
  <p><strong>Выводы без чисел.</strong> «Канал social работает плохо» без указания, насколько плохо и на какой выборке.</p>
  <p><strong>Проценты на маленьких группах.</strong> «В Казани конверсия 40 процентов, лучший город» при 47 наблюдениях. Сдвиньте трёх человек, и город станет средним.</p>
  <p style="margin-bottom:0"><strong>Молчание о качестве данных.</strong> Если вы не написали, что данные обрываются в сентябре, читатель решит, что продажи упали. Про ограничения данных пишут <em>до</em> выводов, а не в примечании мелким шрифтом.</p>
</div>

<div class="callout work">
  <span class="ct">Где это в работе</span>
  <p>Такой ноутбук — стандартный формат тестового задания и самый универсальный экспонат портфолио. На собеседовании его открывают и просят провести по нему: объясните, почему выбрали такой порядок, откуда взяли эти числа, что бы сделали дальше при наличии данных. Именно поэтому важнее аккуратность и логика, чем количество графиков.</p>
</div>

<div class="callout jobs">
  <span class="ct">Что закрывает урок в вакансиях</span>
  <ul>
    <li>«Проведение исследовательского анализа данных» — прямая формулировка</li>
    <li>«Портфолио проектов» — требование почти всех вакансий без опыта</li>
    <li>Тестовое задание — почти всегда именно EDA с выводами</li>
  </ul>
</div>
`,

  ticket: {
    from: "Костя, продакт",
    subj: "Введи меня в курс дела по данным",
    body: `
<p>Ты только вышел, я хочу понять, что у нас вообще есть в базе и что из этого следует. Собери разведочную сводку в одном экране.</p>
<p>Печатай ровно такие строки, по порядку. Числа с двумя знаками, где деньги, с одним — где проценты.</p>
<pre><code>пользователей N
заказов N, из них оплачено N
период заказов ДАТА .. ДАТА
пропусков в таблицах N
выручка СУММА
средний чек СУММА
медианный чек СУММА
покупателей N
конверсия в покупку X
заказов на покупателя X
повторных покупателей N</code></pre>
<p>Дальше пять строк воронки по уникальным пользователям, у первого шага процента нет:</p>
<pre><code>visit N
view_product N X
add_to_cart N X
checkout N X
purchase N X</code></pre>
<p>где <code>X</code> — конверсия из предыдущего шага в процентах с одним знаком.</p>
<p>И две завершающие строки:</p>
<pre><code>худшая конверсия КАНАЛ X
больше всего денег КАНАЛ СУММА</code></pre>
<p>«Заказов на покупателя» с двумя знаками. «Пропусков в таблицах» — сумма пропусков в <code>users</code> и <code>orders</code>.</p>
`
  },

  schema: window.SH.pySchema + `
<p>Пригодятся: <code>df.isna().sum().sum()</code>, <code>s.nunique()</code>, <code>d.date()</code>, <code>groupby(...).agg([\"count\", \"sum\"])</code> и цикл по списку шагов воронки.</p>
`,

  data: window.SH.pyData,
  packages: ["pandas"],
  prelude: window.SH.pyPrelude,

  starter: `# Разведочный анализ базы «Дельта Маркет»
paid = orders[orders["status"] == "paid"]

# Блок 1: объём и период

# Блок 2: деньги

# Блок 3: покупатели

# Блок 4: воронка

# Блок 5: каналы
`,

  expected: {
    stdout: `пользователей 220
заказов 215, из них оплачено 189
период заказов 2024-01-07 .. 2024-09-11
пропусков в таблицах 0
выручка 653428.78
средний чек 3457.30
медианный чек 2997.20
покупателей 104
конверсия в покупку 47.3
заказов на покупателя 1.82
повторных покупателей 49
visit 220
view_product 206 93.6
add_to_cart 175 85.0
checkout 121 69.1
purchase 64 52.9
худшая конверсия partner 0.0
больше всего денег organic 271926.54`
  },

  hints: [
    "Первые блоки — обычные агрегаты. «Пропусков в таблицах» это <code>users.isna().sum().sum() + orders.isna().sum().sum()</code>: первый <code>sum</code> считает по столбцам, второй складывает. «Конверсия в покупку» — уникальные покупатели, делённые на всех пользователей.",
    "Для «заказов на покупателя» и «повторных покупателей» удобно один раз посчитать <code>per_user = paid.groupby(\"user_id\")[\"revenue\"].agg([\"count\", \"sum\"])</code>. Тогда среднее число заказов это <code>per_user[\"count\"].mean()</code>, а повторные — <code>(per_user[\"count\"] &gt;= 2).sum()</code>.",
    "Воронка: заведите список <code>steps = [\"visit\", \"view_product\", \"add_to_cart\", \"checkout\", \"purchase\"]</code> и идите по нему циклом, храня в переменной значение предыдущего шага. Для первого шага процент не печатается, поэтому удобно собрать хвост строки заранее: пустая строка для первого шага и <code>f\" {n / prev * 100:.1f}\"</code> для остальных. Для последних двух строк постройте сводку по каналам через <code>left merge</code>, чтобы <code>partner</code> с нулевой конверсией остался."
  ],

  solution: `# Разведочный анализ базы «Дельта Маркет»
paid = orders[orders["status"] == "paid"]

# ---------- Блок 1. Объём и период ----------
# Всегда первым: ловит неполные выгрузки до того,
# как на них построены выводы
print(f"пользователей {len(users)}")
print(f"заказов {len(orders)}, из них оплачено {len(paid)}")
print(f"период заказов {orders['order_date'].min().date()} .. {orders['order_date'].max().date()}")
# первый sum считает пропуски по столбцам, второй складывает их
print(f"пропусков в таблицах {int(users.isna().sum().sum() + orders.isna().sum().sum())}")

# ---------- Блок 2. Деньги ----------
# Медиана рядом со средним обязательна: распределение чеков скошено
print(f"выручка {paid['revenue'].sum():.2f}")
print(f"средний чек {paid['revenue'].mean():.2f}")
print(f"медианный чек {paid['revenue'].median():.2f}")

# ---------- Блок 3. Покупатели ----------
buyers = paid["user_id"].nunique()
print(f"покупателей {buyers}")
print(f"конверсия в покупку {buyers / len(users) * 100:.1f}")

per_user = paid.groupby("user_id")["revenue"].agg(["count", "sum"])
print(f"заказов на покупателя {per_user['count'].mean():.2f}")
print(f"повторных покупателей {int((per_user['count'] >= 2).sum())}")

# ---------- Блок 4. Воронка ----------
# по уникальным пользователям, а не по событиям
steps = ["visit", "view_product", "add_to_cart", "checkout", "purchase"]
prev = None
for s in steps:
    n = events.loc[events["event_name"] == s, "user_id"].nunique()
    tail = "" if prev is None else f" {n / prev * 100:.1f}"
    print(f"{s} {n}{tail}")
    prev = n

# ---------- Блок 5. Каналы ----------
# LEFT: канал без заказов должен остаться, у него самая интересная конверсия
m = users.merge(paid, on="user_id", how="left")
ch = m.groupby("channel").agg(users_cnt=("user_id", "nunique"),
                              revenue=("revenue", "sum"))
byr = m.dropna(subset=["order_id"]).groupby("channel")["user_id"].nunique()
ch["buyers"] = byr.reindex(ch.index).fillna(0).astype(int)
ch["cr"] = (ch["buyers"] / ch["users_cnt"] * 100).round(1)

worst = ch["cr"].idxmin()
best = ch["revenue"].idxmax()
print(f"худшая конверсия {worst} {ch.loc[worst, 'cr']:.1f}")
print(f"больше всего денег {best} {ch.loc[best, 'revenue']:.2f}")`,

  solutionNote: `
<p><strong>Теперь превратите вывод в выводы.</strong> Вот как выглядит текст, который стоит написать в конце ноутбука. Обратите внимание, что каждый пункт содержит число, а первый пункт про качество данных.</p>
<ol>
  <li><strong>Ограничение данных.</strong> Заказы обрываются 11 сентября, поэтому август и особенно сентябрь неполные. Выводы о тренде строятся по периоду январь–июль.</li>
  <li><strong>Воронка.</strong> До покупки доходят 29,1 процента посетителей (64 из 220). Самый большой провал на шаге оплаты: из 121 начавших оформление платят 64, то есть 52,9 процента. Второй по величине провал корзина → оформление, 69,1 процента.</li>
  <li><strong>Деньги.</strong> Выручка 653 429 рублей за девять месяцев. Средний чек 3457, медианный 2997: распределение скошено, семь крупных заказов дают 9,4 процента выручки. В дашборде нужны оба числа.</li>
  <li><strong>Повторные покупки.</strong> Из 104 покупателей 49 вернулись за вторым заказом, это 47,1 процента. В среднем 1,82 заказа на покупателя.</li>
  <li><strong>Каналы.</strong> Канал <code>partner</code> привёл 6 пользователей и ноль покупателей. Канал <code>social</code> даёт 42 пользователя при конверсии 28,6 процента против 47,3 в среднем по базе.</li>
</ol>
<p><strong>Гипотезы, которые из этого следуют.</strong> Первое: проблема на шаге оплаты стоит дороже всего, потому что там теряются люди, уже готовые платить. Проверяется разрезом по платформам и способам оплаты. Второе: канал <code>social</code> либо приводит не ту аудиторию, либо ведёт на неподходящую посадочную страницу. Проверяется сравнением поведения этих пользователей в воронке.</p>
<p><strong>Что нужно от команды:</strong> данные о затратах по каналам, иначе про эффективность говорить нельзя, только про объёмы; логи ошибок платёжного шлюза за период.</p>
`,

  drills: [
    {
      title: "Блок проверки качества данных",
      level: "easy",
      body: `<p>Соберите блок, который войдёт в ваш ноутбук как есть. Для каждой из трёх таблиц напечатайте: имя, размер, число полных дублей, число пропусков, а также минимальную и максимальную дату там, где дата есть.</p>`,
      solution: `tables = [("users", users, "signup_date"),
          ("orders", orders, "order_date"),
          ("events", events, "event_date")]

for name, df, datecol in tables:
    print(f"{name}: {df.shape[0]} строк, {df.shape[1]} столбцов")
    print(f"  дублей {int(df.duplicated().sum())}, пропусков {int(df.isna().sum().sum())}")
    print(f"  период {df[datecol].min().date()} .. {df[datecol].max().date()}")`,
      note: `<p>Обратите внимание на периоды: события идут по 17 сентября, заказы по 11 сентября, регистрации заканчиваются 29 июня. Три разных горизонта в одной базе — обычное дело, и об этом надо помнить, когда сравниваете метрики между таблицами.</p>`
    },
    {
      title: "Сравнить события и транзакции",
      level: "mid",
      body: `<p>В базе есть события <code>purchase</code> и оплаченные заказы в <code>orders</code>. Это две разные системы. Сравните их: сколько пользователей в каждой, сколько в обеих, сколько только в одной.</p>
<p>Сформулируйте, что вы напишете команде по итогам.</p>`,
      solution: `ev_buyers = set(events.loc[events["event_name"] == "purchase", "user_id"])
tx_buyers = set(orders.loc[orders["status"] == "paid", "user_id"])

print(f"покупателей по событиям    {len(ev_buyers)}")
print(f"покупателей по заказам     {len(tx_buyers)}")
print(f"есть в обеих системах      {len(ev_buyers & tx_buyers)}")
print(f"только события             {len(ev_buyers - tx_buyers)}")
print(f"только заказы              {len(tx_buyers - ev_buyers)}")
print(f"совпадение                 {len(ev_buyers & tx_buyers) / len(tx_buyers) * 100:.1f} процента от заказов")`,
      note: `<p>Расхождение между аналитическими событиями и транзакционной базой есть всегда: блокировщики рекламы режут события, часть покупок идёт мимо фронтенда, ретраи создают дубли. Вопрос не в том, есть ли расхождение, а в том, знаете ли вы его размер. Фраза для команды: «событий purchase меньше, чем оплаченных заказов; для денежных метрик беру orders, для поведенческих events, расхождение такое-то».</p>`
    },
    {
      title: "Портрет покупателя против непокупателя",
      level: "mid",
      body: `<p>Сравните две группы пользователей: сделавшие хотя бы один оплаченный заказ и не сделавшие ни одного. Для каждой группы выведите распределение по каналам, городам и платформам в процентах.</p>
<p>Найдите разрез, где группы отличаются сильнее всего.</p>`,
      solution: `buyers = set(orders.loc[orders["status"] == "paid", "user_id"])
u = users.copy()
u["is_buyer"] = u["user_id"].isin(buyers)

for dim in ["channel", "city", "platform"]:
    print(f"--- {dim} ---")
    share = (u.groupby([dim, "is_buyer"]).size()
               .unstack(fill_value=0))
    share.columns = ["не купил", "купил"]
    pct = (share / share.sum() * 100).round(1)
    for cat in pct.index:
        print(f"  {cat}: не купил {pct.loc[cat, 'не купил']}, купил {pct.loc[cat, 'купил']}")
    print()`,
      note: `<p>Смотреть надо не на абсолютные доли, а на разницу между колонками. Если канал даёт 20 процентов непокупателей и 20 процентов покупателей, он нейтрален. Если 25 против 10 — этот канал приводит людей, которые не покупают. Такой разрез быстро находит сегменты, которые стоит обсудить с маркетингом.</p>`
    },
    {
      title: "Связь между чеком и числом заказов",
      level: "mid",
      body: `<p>Проверьте гипотезу: покупают ли повторные клиенты на большие суммы. Разбейте покупателей на группы по числу оплаченных заказов (1, 2, 3 и больше) и посчитайте для каждой группы: сколько покупателей, средний чек, медианный чек, суммарную выручку.</p>`,
      solution: `paid = orders[orders["status"] == "paid"]
per_user = paid.groupby("user_id").agg(orders_cnt=("order_id", "count"),
                                       total=("revenue", "sum"),
                                       avg_check=("revenue", "mean"))

def bucket(n):
    return "1 заказ" if n == 1 else ("2 заказа" if n == 2 else "3 и больше")

per_user["bucket"] = per_user["orders_cnt"].apply(bucket)

rep = per_user.groupby("bucket").agg(
    buyers=("orders_cnt", "count"),
    avg_check=("avg_check", "mean"),
    median_check=("avg_check", "median"),
    revenue=("total", "sum"),
).round(2)

print(rep.to_string())`,
      note: `<p>Гипотеза «повторные покупают на большие суммы» на этих данных не подтверждается: средний чек по группам почти одинаковый. Зато видно другое: группа «3 и больше» невелика по числу людей, но даёт непропорционально много выручки просто за счёт количества заказов. Вывод для продукта: работать надо не над размером чека, а над частотой покупок.</p>`
    },
    {
      title: "Собрать выводы",
      level: "hard",
      body: `<p>Финальное упражнение модуля, без кода. Напишите раздел «Выводы» для вашего ноутбука: пять пунктов, каждый с числом, плюс две гипотезы и список того, чего вам не хватает в данных.</p>
<p>Ограничение: пятьсот знаков на всё. Заказчик читает выводы, а не ноутбук, и длинный текст он не осилит.</p>`,
      solution: `Выводы

1. Данные по заказам обрываются 11.09, август и сентябрь
   неполные и в тренд не идут.
2. До покупки доходят 29,1% посетителей (64 из 220).
   Главный провал на оплате: из 121 платят 64.
3. Выручка 653 429 руб. за 9 месяцев. Средний чек 3457,
   медианный 2997: 7 крупных заказов дают 9,4% денег.
4. Из 104 покупателей 49 вернулись за вторым заказом (47,1%),
   в среднем 1,82 заказа на человека.
5. Канал social: 42 пользователя, конверсия 28,6% против
   47,3% по базе. Канал partner: 6 пользователей, 0 покупок.

Гипотезы
- Потери на оплате технические. Проверяю разрезом
  по платформам и логами платёжного шлюза.
- Social приводит нецелевую аудиторию либо ведёт
  на неподходящую страницу.

Чего не хватает
- Затрат по каналам: без них можно говорить только
  об объёмах, но не об эффективности.
- Логов ошибок оплаты.
- Данных за полный сентябрь.`,
      note: `<p>Обратите внимание на структуру: сначала ограничения данных, потом факты, потом гипотезы, в конце запрос. Именно в таком порядке это читает продакт. И на объём: пять пунктов, каждый в две строки. Ноутбук может быть на сто ячеек, выводы — на один экран.</p>`
    }
  ],

  quiz: [
    {
      q: "С чего начинается EDA?",
      opts: [
        "С расчёта ключевых метрик",
        "С построения графиков",
        "С формулировки гипотез",
        "С проверки объёма, периода и качества данных"
      ],
      right: 3,
      why: "Неполный период или дубли делают бессмысленными все последующие расчёты. Пять минут проверок экономят день переделки."
    },
    {
      q: "Какой вывод написан правильно?",
      opts: [
        "Конверсия в покупку 47,3 процента: 104 покупателя из 220 за девять месяцев",
        "Проведён анализ данных, построены графики распределений",
        "Данные проанализированы, выявлены закономерности",
        "Конверсия хорошая"
      ],
      right: 0,
      why: "Есть число, есть знаменатель, есть период. Такое утверждение можно проверить и с ним можно спорить, а значит, на нём можно строить решение."
    },
    {
      q: "Событий purchase 71, а оплаченных заказов 189. Что писать в выводах?",
      opts: [
        "Взять среднее из двух чисел",
        "Указать расхождение и объяснить, какой источник берётся для денег, а какой для поведения",
        "Использовать только события",
        "Ничего, это ошибка в данных"
      ],
      right: 1,
      why: "События и транзакции всегда расходятся. Профессионально не скрыть расхождение, а измерить его и явно сказать, какой источник считается истиной для какой метрики."
    },
    {
      q: "В выводах написано «в Казани конверсия 40 процентов, лучший город». Чего не хватает?",
      opts: [
        "Периода",
        "Графика",
        "Знаменателя: 19 покупателей из 47, сдвиг в три человека меняет вывод",
        "Названия других городов"
      ],
      right: 2,
      why: "Процент на маленькой выборке неустойчив. Без абсолютных чисел читатель примет случайное колебание за факт и потратит бюджет."
    },
    {
      q: "Где в ноутбуке место для оговорки про неполные данные?",
      opts: [
        "Нигде, это очевидно",
        "В примечании в самом конце",
        "В комментарии к коду",
        "Первым пунктом выводов, до всех остальных фактов"
      ],
      right: 3,
      why: "Если читатель узнает про обрыв данных после того, как увидел «падение в сентябре», он уже сделал неверный вывод. Ограничения идут первыми."
    },
    {
      q: "Что проверяют на собеседовании по вашему EDA-ноутбуку?",
      opts: [
        "Логику: почему такой порядок, откуда числа, что дальше",
        "Длину кода",
        "Использование редких библиотек",
        "Количество графиков"
      ],
      right: 0,
      why: "Ноутбук открывают и просят провести по нему. Ценится связность рассуждения и честность про ограничения, а не объём проделанной работы."
    }
  ],

  links: [
    { t: "Курс Data Visualization на Kaggle", url: "https://www.kaggle.com/learn/data-visualization", src: "kaggle.com", lang: "EN",
      d: "Практика построения графиков для EDA. Хорошо ложится сразу после этого модуля." },
    { t: "Датасеты для собственных проектов", url: "https://www.kaggle.com/datasets", src: "kaggle.com", lang: "EN",
      d: "Тысячи открытых наборов данных. Для портфолио берите тему, в которой разбираетесь: так выводы получатся содержательными." },
    { t: "Открытые данные России", url: "https://data.gov.ru/", src: "data.gov.ru", lang: "RU",
      d: "Государственные открытые данные. Хороший источник для проекта на локальную тему, который выделит вас среди типовых портфолио." },
    { t: "Cookiecutter Data Science", url: "https://cookiecutter-data-science.drivendata.org/", src: "drivendata.org", lang: "EN",
      d: "Как организовать папки проекта, чтобы репозиторий выглядел профессионально. Пригодится в модуле 6 при сборке портфолио." },
    { t: "Storytelling with Data", url: "https://www.storytellingwithdata.com/blog", src: "storytellingwithdata.com", lang: "EN",
      d: "Как превратить набор графиков в историю с выводом. Читать перед тем, как оформлять проект для портфолио." },
    { t: "Хаб «Анализ данных» на Хабре", url: "https://habr.com/ru/hubs/data_mining/articles/", src: "habr.com", lang: "RU",
      d: "Разборы реальных исследований на русском. Полезно посмотреть, как оформляют выводы практикующие аналитики." }
  ]
};
