/* ============================================================
   Шпаргалки на одну страницу: SQL, pandas, статистика, метрики

   Страницы #cheats (список) и #cheat-<id> (одна шпаргалка) рисует
   app.js (renderCheats). Файл грузится по требованию, как модули
   уроков. На бумаге каждая шпаргалка занимает ровно один лист A4
   в две колонки — после правки текста проверьте печать
   (инструменты/README.md, «Шпаргалки»).

   Поля шпаргалки:
     id       — часть адреса #cheat-<id>; не меняется
     title    — заголовок
     sub      — одна строка под заголовком
     module   — модуль, чей итог ведёт на эту шпаргалку
     sections — разделы: h — заголовок, html — текст

   Код в разделах проверяет node инструменты/checkcheats.js:
     <pre><code class="sql"> — запрос выполняется на учебной базе
                               и должен вернуть хотя бы одну строку;
     <pre><code class="py">  — выполняется после пролога Python-уроков
                               (users, orders, events) на pandas 2.2 и 3;
     <pre><code>             — формула или схема, не выполняется.
   Знаки < > & внутри кода пишутся как &lt; &gt; &amp;.
   ============================================================ */

window.CHEATS = [
  {
    id: "sql",
    title: "SQL",
    sub: "Порядок выполнения, JOIN, NULL, окна и шаблоны задач с собеседований. Примеры — на базе «Дельта Маркета», диалект SQLite.",
    module: "m1",
    sections: [
      { h: "Порядок выполнения",
        html: `<pre><code>FROM / JOIN → WHERE → GROUP BY → HAVING
→ SELECT (и окна) → DISTINCT → ORDER BY → LIMIT</code></pre>
<p>Отсюда два правила: псевдоним из <code>SELECT</code> не виден в <code>WHERE</code>, а оконную функцию нельзя фильтровать в <code>WHERE</code> — её считают в CTE и фильтруют снаружи.</p>` },

      { h: "Агрегаты, WHERE и HAVING",
        html: `<ul>
<li><code>COUNT(*)</code> — строки, <code>COUNT(col)</code> — строки, где <code>col</code> не <code>NULL</code>, <code>COUNT(DISTINCT col)</code> — разные значения.</li>
<li><code>WHERE</code> отбирает строки до группировки, <code>HAVING</code> — группы после.</li>
<li>Всё в <code>SELECT</code> — либо в <code>GROUP BY</code>, либо внутри агрегата.</li>
</ul>
<pre><code class="sql">SELECT city, COUNT(*) AS users
FROM users
WHERE platform = 'ios'
GROUP BY city
HAVING COUNT(*) &gt;= 10
ORDER BY users DESC;</code></pre>` },

      { h: "JOIN и его ловушки",
        html: `<ul>
<li><code>INNER JOIN</code> — только пары с совпадением, <code>LEFT JOIN</code> — все строки слева, справа <code>NULL</code>, если пары нет.</li>
<li>Условие на правую таблицу в <code>WHERE</code> превращает <code>LEFT</code> в <code>INNER</code>: строки с <code>NULL</code> отсеются. Такое условие пишут в <code>ON</code>.</li>
<li>Один ко многим размножает строки: после JOIN пользователей с заказами <code>COUNT(*)</code> считает заказы, а не людей. Сверяйте число строк до и после.</li>
<li>Кого нет справа — <code>LEFT JOIN</code> и <code>WHERE</code> правый ключ <code>IS NULL</code>.</li>
</ul>
<pre><code class="sql">-- зарегистрировались, но ни разу не оплатили
SELECT COUNT(*) AS never_paid
FROM users u
LEFT JOIN orders o
  ON o.user_id = u.user_id AND o.status = 'paid'
WHERE o.order_id IS NULL;</code></pre>` },

      { h: "NULL, деление и строки",
        html: `<ul>
<li><code>NULL = NULL</code> — не истина: сравнивают через <code>IS NULL</code>. <code>COALESCE(x, 0)</code> подставляет замену, <code>NULLIF(x, 'n/a')</code> делает из заглушки <code>NULL</code>.</li>
<li>Целое на целое в SQLite — целое: <code>13 / 215 = 0</code>. Пишите <code>100.0 * a / b</code>. Деление на 0 SQLite молча превращает в <code>NULL</code>, PostgreSQL падает с ошибкой — поэтому знаменатель пишут как <code>NULLIF(b, 0)</code>.</li>
<li><code>LIKE '%ab%'</code>: <code>%</code> — любые символы, <code>_</code> — один. В SQLite <code>LIKE</code> и <code>LOWER</code> не трогают регистр кириллицы — русские написания сводят через <code>CASE</code>.</li>
<li><code>UNION</code> убирает одинаковые строки, <code>UNION ALL</code> оставляет все и работает быстрее.</li>
</ul>` },

      { h: "Даты в SQLite",
        html: `<ul>
<li><code>strftime('%Y-%m', d)</code> — месяц, <code>strftime('%w', d)</code> — день недели (0 — воскресенье).</li>
<li><code>date(d, '+7 day')</code> — сдвиг даты, <code>julianday(a) - julianday(b)</code> — дни между датами.</li>
</ul>
<pre><code class="sql">SELECT strftime('%Y-%m', order_date) AS month,
       ROUND(SUM(revenue)) AS revenue
FROM orders
WHERE status = 'paid'
GROUP BY month
ORDER BY month;</code></pre>` },

      { h: "Оконные функции",
        html: `<p>Окно считает по группе строк, но, в отличие от <code>GROUP BY</code>, не схлопывает их: число строк не меняется.</p>
<ul>
<li><code>ROW_NUMBER()</code> — 1, 2, 3; <code>RANK()</code> — 1, 1, 3; <code>DENSE_RANK()</code> — 1, 1, 2.</li>
<li><code>LAG(col)</code> / <code>LEAD(col)</code> — значение из прошлой / следующей строки.</li>
<li><code>SUM(x) OVER (PARTITION BY u ORDER BY d)</code> — накопительная сумма.</li>
<li><code>AVG(x) OVER (ORDER BY d ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)</code> — скользящее среднее за 7 строк.</li>
</ul>` },

      { h: "Шаблон: первые N в группе",
        html: `<p>Окно — в CTE, фильтр — снаружи. Тот же приём даёт первый заказ каждого (<code>rn = 1</code>) и последний (<code>ORDER BY ... DESC</code>).</p>
<pre><code class="sql">WITH ranked AS (
  SELECT user_id, order_date, revenue,
         ROW_NUMBER() OVER (PARTITION BY user_id
                            ORDER BY revenue DESC) AS rn
  FROM orders
  WHERE status = 'paid'
)
SELECT user_id, order_date, revenue
FROM ranked
WHERE rn &lt;= 2;</code></pre>` },

      { h: "Шаблоны: дубликаты и когорты",
        html: `<pre><code class="sql">-- повторы: один и тот же пользователь и день
SELECT user_id, event_date, event_name, COUNT(*) AS n
FROM events
GROUP BY user_id, event_date, event_name
HAVING COUNT(*) &gt; 1;</code></pre>
<pre><code class="sql">-- когорта по месяцу регистрации: доля купивших
-- в первые 30 дней
SELECT strftime('%Y-%m', u.signup_date) AS cohort,
       COUNT(DISTINCT u.user_id) AS users,
       ROUND(100.0 * COUNT(DISTINCT o.user_id)
             / COUNT(DISTINCT u.user_id), 1) AS pct_30d
FROM users u
LEFT JOIN orders o
  ON o.user_id = u.user_id AND o.status = 'paid'
 AND julianday(o.order_date)
     - julianday(u.signup_date) &lt; 30
GROUP BY cohort
ORDER BY cohort;</code></pre>` }
    ]
  },

  {
    id: "pandas",
    title: "pandas",
    sub: "Осмотр таблицы, отбор, группировка, merge, сводные, чистка и даты. Примеры — на таблицах users и orders из Python-уроков.",
    module: "m2",
    sections: [
      { h: "Первый осмотр",
        html: `<pre><code class="py">orders.shape               # (строк, столбцов)
orders.head()
orders.info()              # типы и пропуски
orders.describe()          # среднее, квартили
orders["status"].value_counts()
orders.isna().sum()        # пропуски по столбцам
orders.duplicated().sum()  # полные дубли строк</code></pre>
<p>Сначала — сколько строк и какого типа столбцы. Даты строкой и числа строкой — частая причина странных ответов.</p>` },

      { h: "Отбор строк и столбцов",
        html: `<pre><code class="py">paid = orders[orders["status"] == "paid"]
big = orders[(orders["revenue"] &gt; 5000)
             &amp; (orders["status"] == "paid")]
mob = users[users["platform"].isin(["ios", "android"])]
cols = orders.loc[orders["revenue"] &gt; 5000,
                  ["user_id", "revenue"]]
q = orders.query("status == 'paid' and revenue &gt; 5000")</code></pre>
<ul>
<li>Условия соединяют <code>&amp;</code>, <code>|</code>, <code>~</code>, каждое в скобках. <code>and</code> и <code>or</code> дают ошибку «truth value of a Series is ambiguous».</li>
<li>Отфильтровали и собираетесь менять — сделайте <code>.copy()</code>, иначе SettingWithCopyWarning.</li>
</ul>` },

      { h: "Группировка",
        html: `<pre><code class="py">by_user = (paid.groupby("user_id")
               .agg(orders=("order_id", "count"),
                    revenue=("revenue", "sum"),
                    avg_check=("revenue", "mean"))
               .reset_index())

# доля заказа в выручке своего пользователя
paid = paid.copy()
by = paid.groupby("user_id")["revenue"]
paid["share"] = paid["revenue"] / by.transform("sum")</code></pre>
<p><code>agg</code> схлопывает группу в строку, <code>transform</code> возвращает значение группы каждой строке. После <code>groupby</code> ключ уходит в индекс — <code>reset_index()</code> возвращает его в столбец.</p>` },

      { h: "merge",
        html: `<pre><code class="py">m = users.merge(paid, on="user_id", how="left",
                validate="one_to_many", indicator=True)
m["_merge"].value_counts()  # left_only — без оплат
len(users), len(m)          # стало больше — это заказы</code></pre>
<ul>
<li><code>how</code>: <code>inner</code>, <code>left</code>, <code>right</code>, <code>outer</code> — как JOIN в SQL.</li>
<li><code>validate</code> падает, если связь не та, что вы думали: дубль ключа справа размножит строки молча.</li>
</ul>` },

      { h: "Сводная таблица",
        html: `<pre><code class="py">t = users.merge(paid, on="user_id")
pv = t.pivot_table(index="channel", columns="platform",
                   values="revenue", aggfunc="sum",
                   fill_value=0)
sh = pd.crosstab(users["channel"], users["platform"],
                 normalize="index")</code></pre>
<p><code>normalize="index"</code> — доли по строке, <code>"columns"</code> — по столбцу, <code>"all"</code> — от всей таблицы.</p>` },

      { h: "Чистка",
        html: `<pre><code class="py">users.drop_duplicates(subset="user_id")
orders["revenue"].fillna(0)
raw = pd.Series(["1 500", "300", "n/a"])
pd.to_numeric(raw.str.replace(" ", ""),
              errors="coerce")      # не число → NaN
users["city"].str.strip().str.capitalize()</code></pre>
<p>Порядок для текста: убрать пробелы → привести регистр → свести синонимы словарём через <code>.replace({...})</code>. Пропуск — не ноль: <code>fillna(0)</code> только там, где отсутствие и правда значит ноль.</p>` },

      { h: "Даты и ряды",
        html: `<pre><code class="py">d = pd.to_datetime(orders["order_date"])  # в уроках уже
orders["month"] = d.dt.to_period("M")
orders["weekday"] = d.dt.dayofweek    # 0 — понедельник
s = paid.set_index("order_date")["revenue"]
weekly = s.resample("W-MON").sum()
monthly = s.resample("MS").sum()      # от 1-го числа
smooth = weekly.rolling(4).mean()</code></pre>
<p><code>resample</code> заполняет и пустые периоды, а <code>groupby</code> по месяцу их пропускает — на графике это разные линии.</p>` },

      { h: "Частые ошибки",
        html: `<ul>
<li><code>KeyError: 'col'</code> — такого столбца нет: опечатка или пробел в имени, смотрите <code>df.columns</code>.</li>
<li><code>TypeError</code> при сравнении дат — столбец остался строкой: нужен <code>pd.to_datetime</code>.</li>
<li>Среднее «по средним» групп разного размера — не среднее по всем: считайте сумму и делите на число.</li>
<li><code>count()</code> не считает <code>NaN</code>, <code>size()</code> считает.</li>
</ul>` }
    ]
  },

  {
    id: "stats",
    title: "Статистика и A/B",
    sub: "Интервалы, выбор критерия, размер выборки, поправки, ловушки тестов и вероятность — формулы и правила из модуля 3.",
    module: "m3",
    sections: [
      { h: "Словарь теста",
        html: `<ul>
<li><strong>p-value</strong> — вероятность увидеть такую же или бо́льшую разницу, если эффекта на самом деле нет. Это не вероятность того, что гипотеза верна.</li>
<li><strong>α = 0,05</strong> — допустимая доля ложных находок, <strong>мощность 80%</strong> — доля настоящих эффектов размера MDE, которые тест поймает.</li>
<li><strong>Ошибка I рода</strong> — нашли эффект, которого нет; <strong>II рода</strong> — пропустили настоящий.</li>
</ul>` },

      { h: "Стандартная ошибка и интервал",
        html: `<pre><code>SE среднего = s / √n          SE доли = √(p(1 − p) / n)
SE разницы = √(SE₁² + SE₂²)
95% интервал = оценка ± 1,96 · SE</code></pre>
<p>Интервал разницы не содержит ноль — разница значима на уровне 5%. По ЦПТ среднее распределено почти нормально при большой выборке, даже когда сами чеки скошены вправо.</p>` },

      { h: "Какой критерий",
        html: `<table>
<tr><th>Метрика</th><th>Критерий</th></tr>
<tr><td>доля, две группы</td><td>z-тест долей или хи-квадрат</td></tr>
<tr><td>доля, три группы и больше</td><td>хи-квадрат на таблице сопряжённости</td></tr>
<tr><td>непрерывная, две группы</td><td>t-тест Уэлча (не Стьюдента)</td></tr>
<tr><td>тяжёлые хвосты, мало данных</td><td>Манна-Уитни или бутстрап</td></tr>
<tr><td>ratio: средний чек, CTR</td><td>бутстрап по пользователям или дельта-метод</td></tr>
</table>
<p>Манна-Уитни проверяет не средние и не медианы, а то, что случайное наблюдение одной группы чаще больше, чем другой. Для решения о деньгах нужна разница средних.</p>` },

      { h: "Дизайн A/B",
        html: `<ul>
<li>Одна главная метрика, вспомогательные объясняют, предохранители не должны просесть.</li>
<li>MDE — наименьший эффект, ради которого стоит запускать; от него и считают размер.</li>
<li>Длительность — целыми неделями: у трафика недельный цикл.</li>
</ul>
<pre><code>n на группу ≈ 16 · p(1 − p) / d²   доля p, разница d
16 ≈ 2 · (1,96 + 0,84)²     α = 0,05, мощность 80%</code></pre>
<p>Вдвое меньший MDE — вчетверо больше пользователей.</p>` },

      { h: "Много сравнений",
        html: `<pre><code>P(хотя бы одна ложная) = 1 − 0,95^m   m метрик
Бонферрони: p &lt; α / m
Холм: p по возрастанию, p(i) &lt; α / (m − i + 1),
      до первого провала
Бенджамини-Хохберг: наибольшее i, где p(i) ≤ i / m · α</code></pre>
<p>Бонферрони и Холм берегут от любой ложной находки, Холм находит не меньше. Бенджамини-Хохберг держит долю ложных среди найденного — для просмотра десятков сегментов.</p>` },

      { h: "Ловушки",
        html: `<ul>
<li><strong>SRM</strong> — группы разошлись с задуманным сплитом сильнее случайности (хи-квадрат против 50/50). Результат такого теста не читают, пока не найдут причину.</li>
<li><strong>Подглядывание</strong> — смотреть результат каждый день две недели: 14 проверок, и при полном отсутствии эффекта значимость хотя бы раз появляется в 21,8% тестов вместо 5%. Размер и срок — заранее.</li>
<li><strong>Сегменты после теста</strong> — те же множественные сравнения: найденное проверяют новым тестом.</li>
<li><strong>Тест по заказам</strong> при делении по пользователям: заказы одного человека зависимы, обычная SE занижена.</li>
</ul>` },

      { h: "CUPED",
        html: `<pre><code>Y_cuped = Y − θ · (X − X̄)      θ = cov(X, Y) / var(X)
дисперсия падает до (1 − ρ²) от исходной</code></pre>
<p><code>X</code> — та же метрика у пользователя до теста, <code>θ</code> — одна на обе группы. <code>X</code>, на который тест мог повлиять, вычтет часть эффекта.</p>` },

      { h: "Вероятность",
        html: `<pre><code>P(A | B) = P(A и B) / P(B)
P(A | B) = P(B | A) · P(A) / P(B)         Байес
P(B) = P(B | A) · P(A) + P(B | не A) · P(не A)
P(хотя бы один) = 1 − P(ни одного)
C(n, k) = n! / (k! · (n − k)!)       сочетания
E[X] = Σ x · P(x)                  матожидание</code></pre>
<p>Редкое событие и неточный детектор: алерт ловит 90% поломок и ложно срабатывает в 10% обычных дней, поломки — 2 дня из 100. Сработал — поломка настоящая с вероятностью 0,018 / 0,116 = 15,5%.</p>` }
    ]
  },

  {
    id: "metrics",
    title: "Продуктовые метрики",
    sub: "Формулы метрик, когорты, воронка, RFM, разбор «метрика упала» и приоритизация — по урокам модуля 4.",
    module: "m4",
    sections: [
      { h: "Дерево метрик",
        html: `<pre><code>выручка = активные × доля платящих
        × заказов на платящего × средний чек</code></pre>
<ul>
<li>Ветки вместе дают ровно верхнее число. В дереве-произведении перемножают изменения множителей, а не складывают проценты.</li>
<li><strong>North Star</strong> — одна метрика, которая растёт, только когда пользователи получают пользу (например, оплаченные не отменённые заказы за неделю). Рядом — <strong>предохранители</strong>: возвраты, время доставки, чек.</li>
</ul>` },

      { h: "Аудитория и деньги",
        html: `<table>
<tr><th>Метрика</th><th>Формула</th></tr>
<tr><td>DAU, MAU</td><td>уникальные люди за день, за месяц</td></tr>
<tr><td>DAU / MAU</td><td>липучесть: частота заходов, не довольство</td></tr>
<tr><td>ARPU</td><td>выручка / все пользователи</td></tr>
<tr><td>ARPPU</td><td>выручка / платящие</td></tr>
<tr><td>средний чек</td><td>выручка / заказы</td></tr>
<tr><td>конверсия в платящего</td><td>платящие / все пользователи</td></tr>
</table>
<p>Проверка: ARPU = ARPPU × доля платящих. «ARPU 8 300 ₽» чаще всего — ARPPU под чужим именем: спросите, что в знаменателе.</p>` },

      { h: "Удержание и LTV",
        html: `<table>
<tr><th>Удержание дня N</th><th>Активен</th></tr>
<tr><td>классическое</td><td>ровно в день N</td></tr>
<tr><td>скользящее (N+)</td><td>в день N или позже</td></tr>
<tr><td>интервальное</td><td>хотя бы раз в дни с 1 по N</td></tr>
</table>
<pre><code>churn = 1 − retention
LTV за N дней = выручка когорты за N дней
                / размер когорты
LTV ≈ A / c     A — платёж в месяц, c — отток в месяц
ROI канала = LTV / CAC</code></pre>
<p>LTV без горизонта ничего не значит. <code>A / c</code> — только оценка порядка: со средним оттоком базы завышает, с оттоком первого месяца занижает. Если LTV вышел на плато ниже CAC, канал не окупится никогда.</p>` },

      { h: "Когорты и воронка",
        html: `<ul>
<li>Когорта — пользователи с одним месяцем первого действия. В таблице сравнивают когорты одного возраста — по столбцу, а не по строке.</li>
<li>Незаконченные когорты (возраст больше окна наблюдения) не сравнивают с полными.</li>
<li>Воронка: уникальные люди на каждом шаге, шаги по порядку и в заданном окне. Конверсия шага — от предыдущего, сквозная — от первого.</li>
<li>Общая конверсия — среднее по каналам с весами их долей: сдвиг трафика в слабый канал роняет её, даже если внутри каждого стало лучше (парадокс Симпсона).</li>
</ul>` },

      { h: "RFM",
        html: `<ul>
<li><strong>R</strong>ecency — дней с последней покупки, <strong>F</strong>requency — число заказов, <strong>M</strong>onetary — сумма.</li>
<li>Баллы 1–5 по квантилям; у R меньше дней — выше балл.</li>
<li>Частота на квинтили не делится: половина покупателей сделала один заказ, и <code>pd.qcut</code> падает. Лечат <code>rank(method="first")</code> или границами вручную: 1 / 2–3 / 4+.</li>
<li>Recency считают от конца выгрузки, а не от сегодняшней даты.</li>
<li>125 клеток укрупняют в сегменты под действие: чемпионы, лояльные, перспективные, уходят ценные, спящие.</li>
</ul>` },

      { h: "Метрика упала: пять шагов",
        html: `<ol>
<li><strong>Уточнить вопрос:</strong> какая метрика, с чем сравниваем, проценты или пункты, резко или плавно.</li>
<li><strong>Проверить данные:</strong> события, разметка, ETL, логика дашборда, неполный период.</li>
<li><strong>Локализовать:</strong> платформа, версия, канал, гео, новые и старые, шаг воронки. Везде понемногу — общая причина, в одном сегменте сильно — поломка или релиз.</li>
<li><strong>Разложить по дереву:</strong> какой множитель упал.</li>
<li><strong>Что изменилось:</strong> релизы, эксперименты, цены; сезон, праздники, конкуренты, состав трафика.</li>
</ol>
<p>Ответ заканчивают списком гипотез с порядком и временем проверки, а не одной угаданной причиной.</p>` },

      { h: "Что делать: ICE и RICE",
        html: `<pre><code>ICE  = Impact × Confidence × Ease     каждое 1–10
RICE = Reach × Impact × Confidence / Effort
Impact      0,25 / 0,5 / 1 / 2 / 3
Confidence  1 / 0,8 / 0,5
Effort      человеко-месяцы</code></pre>
<p>В ICE нет охвата: сильная идея для малой доли пользователей обгоняет среднюю для всех. Баллы субъективны — сравнивают идеи одного списка, оценённые одними людьми.</p>` },

      { h: "Дашборд",
        html: `<ul>
<li>Сверху — 3–5 главных чисел с изменением к прошлому периоду, ниже — разрезы, которые объясняют движение.</li>
<li>У каждого числа — период, знаменатель и источник; у графика — ответ на один вопрос.</li>
</ul>` }
    ]
  }
];
