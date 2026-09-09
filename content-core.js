/* ============================================================
   Содержание уроков — общая часть.

   Ключ объекта CONTENT = id урока из lessons.js.

   Поля урока:
     intro      — одна фраза под заголовком
     duration   — «≈ 2 часа»
     plan       — [{m:"30 мин", w:"что делаем"}] — план занятия
     theory     — HTML теории (читается 25–35 минут)
     ticket     — основная задача в формате рабочего тикета
     schema     — описание входных данных
     starter    — начальный код в редакторе
     expected   — эталон: {columns, rows, ordered} | {stdout} | {reference, criteria}
     hints      — 3 подсказки, от наводящего вопроса к разбору
     solution   — эталонный код с комментариями
     drills     — [{title, level, body, solution, note}] — тренажёр
     quiz       — [{q, opts, right, why}] — самопроверка
     links      — [{t, url, src, d, lang}] — что почитать
   ============================================================ */

window.CONTENT = {};

/* Куски, которые повторяются во многих уроках, — чтобы не дублировать
   один и тот же текст сорок раз и чинить его в одном месте.        */
window.SH = {

  /* описание базы для SQL-уроков */
  sqlSchema: `
<p>База <strong>«Дельта Маркет»</strong> — интернет-магазин. Данные за январь–сентябрь 2024, сгенерированы детерминированно, поэтому у всех числа одинаковые.</p>
<pre><code>users                       -- 220 строк
  user_id      INTEGER      -- id пользователя
  signup_date  TEXT         -- дата регистрации, 'YYYY-MM-DD'
  channel      TEXT         -- organic | paid_search | social | email | referral | partner
  city         TEXT         -- Москва | Санкт-Петербург | Новосибирск | Екатеринбург | Казань
  platform     TEXT         -- ios | android | web

orders                      -- 215 строк
  order_id     INTEGER
  user_id      INTEGER      -- ссылка на users.user_id
  order_date   TEXT
  revenue      REAL         -- сумма заказа в рублях
  status       TEXT         -- paid | refunded | pending

events                      -- 1488 строк
  event_id     INTEGER
  user_id      INTEGER      -- ссылка на users.user_id
  event_date   TEXT
  event_name   TEXT         -- visit | view_product | add_to_cart | checkout | purchase</code></pre>
<p>Диалект — SQLite (движок sql.js работает прямо в браузере). <code>JOIN</code>, <code>GROUP BY</code>, <code>CTE</code> и оконные функции здесь такие же, как в PostgreSQL. Отличаются функции для дат: вместо <code>DATE_TRUNC</code> используется <code>strftime</code>.</p>
`,

  /* шпаргалка по датам в SQLite — нужна в половине SQL-уроков */
  sqlDates: `
<p><strong>Даты в SQLite.</strong> Хранятся текстом <code>'YYYY-MM-DD'</code>, поэтому сравнение строк работает как сравнение дат.</p>
<pre><code>strftime('%Y-%m', order_date)        -- '2024-03'  месяц
strftime('%Y-%W', order_date)        -- '2024-12'  номер недели
date(order_date, 'start of month')   -- '2024-03-01'
julianday(d2) - julianday(d1)        -- разница в днях (число)
date(order_date, '+7 day')           -- сдвиг на 7 дней</code></pre>
`,

  /* описание данных для Python-уроков */
  pySchema: `
<p>Данные уже загружены — <code>read_csv</code> писать не нужно. Доступны три DataFrame:</p>
<pre><code>users    (220, 5)   user_id, signup_date, channel, city, platform
orders   (215, 5)   order_id, user_id, order_date, revenue, status
events  (1488, 4)   event_id, user_id, event_date, event_name</code></pre>
<p>Это та же база «Дельта Маркет», что и в SQL-уроках, — можно сверять ответы между модулями. Уже импортированы <code>pandas as pd</code> и <code>numpy as np</code>, даты приведены к типу <code>datetime64</code>.</p>
<p>Первый запуск Python занимает 15–40 секунд: браузер скачивает интерпретатор. Дальше мгновенно.</p>
`,

  /* общий пролог для Python-уроков на базе магазина */
  pyPrelude: `import io
import warnings
warnings.filterwarnings("ignore")   # предупреждения библиотек не должны мешать читать вывод

import pandas as pd
import numpy as np

pd.set_option("display.width", 200)
pd.set_option("display.max_columns", 50)

users  = pd.read_csv(io.StringIO(usersCSV))
orders = pd.read_csv(io.StringIO(ordersCSV))
events = pd.read_csv(io.StringIO(eventsCSV))

users["signup_date"] = pd.to_datetime(users["signup_date"])
orders["order_date"] = pd.to_datetime(orders["order_date"])
events["event_date"] = pd.to_datetime(events["event_date"])
`,

  pyData: ["usersCSV", "ordersCSV", "eventsCSV"],

  /* Пролог для уроков по статистике: scipy в браузер не тянем,
     всё нужное считается через math.erf. Заодно студент видит формулы,
     а не вызов чёрного ящика. */
  statsPrelude: `import math
import random


def norm_cdf(x):
    """Функция нормального распределения (стандартного)."""
    return 0.5 * (1 + math.erf(x / math.sqrt(2)))


def mean(v):
    return sum(v) / len(v)


def var(v):
    """Несмещённая дисперсия выборки: делим на n-1."""
    mu = mean(v)
    return sum((x - mu) ** 2 for x in v) / (len(v) - 1)


def sd(v):
    return math.sqrt(var(v))


def median(v):
    s = sorted(v)
    n = len(s)
    return s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2
`,

  /* Тот же пролог плюс данные магазина: нужен там, где статистику
     считают на реальных заказах. */
  statsDataPrelude: null   /* собирается ниже */
};

window.SH.statsDataPrelude = window.SH.pyPrelude + "\n" + window.SH.statsPrelude;

/* Пролог для проекта 3.7: итоги A/B-теста новой страницы оплаты.
   Данные собираются генератором с фиксированным зерном, поэтому у всех
   получаются одни и те же числа, а файл курса не растёт на мегабайт.
   В генераторе только random() и choice(): обе операции построены на
   целочисленном генераторе, так что результат одинаков в любом браузере. */
window.SH.abPrelude = `import warnings
warnings.filterwarnings("ignore")

import pandas as pd

` + window.SH.statsPrelude + `

def _build_ab():
    """Логи эксперимента: одна строка на пользователя."""
    rnd = random.Random(20240501)
    platforms = ["android"] * 44 + ["ios"] * 34 + ["web"] * 22
    sources = (["organic"] * 34 + ["paid_search"] * 26 + ["social"] * 20
               + ["email"] * 13 + ["referral"] * 7)
    prices = [590, 890, 1290, 1490, 1990, 2490, 2990, 3490, 4290, 5990, 7990, 11990]
    cheap = prices[:6]
    items_bag = [1] * 58 + [2] * 29 + [3] * 13
    base = {"android": 0.047, "ios": 0.055, "web": 0.049}

    rows = []
    for i in range(40000):
        group = "test" if rnd.random() < 0.5 else "control"
        platform = rnd.choice(platforms)
        source = rnd.choice(sources)
        p = base[platform] + (0.0060 if group == "test" else 0.0)
        converted = rnd.random() < p
        revenue = 0
        if converted:
            pool = cheap if (group == "test" and rnd.random() < 0.10) else prices
            revenue = sum(rnd.choice(pool) for _ in range(rnd.choice(items_bag)))
        rows.append((10000 + i, group, platform, source, int(converted), revenue))

    return pd.DataFrame(rows, columns=["user_id", "group", "platform",
                                       "source", "converted", "revenue"])


ab = _build_ab()
`;

/* ============================================================
   Модуль 4 работает на втором наборе данных: журнал мобильного
   приложения «Дельта Маркет». Он нужен потому, что удержание и
   когорты на 220 пользователях считать бессмысленно — в месячной
   когорте оказалось бы по 35 человек, и кривая скакала бы от шума.

   Данные лежат в data.js одним CSV и используются и SQL-уроками
   (app.js заливает их в SQLite при старте), и Python-уроками.
   Один источник — значит, числа в модуле сходятся между уроками.
   ============================================================ */

window.SH.appSchema = `
<p>Журнал <strong>мобильного приложения «Дельта Маркет»</strong>: 4000 установок с января по июнь 2024, наблюдение до 30 сентября. Это отдельный продукт со своей нумерацией пользователей — с таблицами <code>users</code> и <code>orders</code> из прошлых модулей он не связан.</p>
<pre><code>app_users                    -- 4000 строк, одна на установку
  user_id       INTEGER      -- id пользователя приложения (1001..5000)
  signup_date   TEXT         -- дата установки, 'YYYY-MM-DD'
  channel       TEXT         -- organic | paid_search | social | email | referral | partner
  platform      TEXT         -- ios | android | web
  city          TEXT

app_activity                 -- 28 567 строк: день, когда пользователь заходил
  user_id       INTEGER
  activity_date TEXT         -- одна строка на пару «пользователь + день»

app_orders                   -- 2027 строк
  user_id       INTEGER
  order_date    TEXT
  revenue       REAL         -- сумма заказа в рублях</code></pre>
<p>В <code>app_activity</code> одна строка на <em>день</em>, а не на сессию: если человек заходил трижды за день, строка всё равно одна. Так устроены почти все витрины удержания — считать надо уникальные дни, иначе активный пользователь утянет метрику вверх в одиночку.</p>
`;

/* Пролог Python-уроков модуля 4 */
window.SH.appPrelude = `import io
import warnings
warnings.filterwarnings("ignore")

import pandas as pd
import numpy as np

pd.set_option("display.width", 200)
pd.set_option("display.max_columns", 50)

app_users    = pd.read_csv(io.StringIO(appUsersCSV))
app_activity = pd.read_csv(io.StringIO(appActivityCSV))
app_orders   = pd.read_csv(io.StringIO(appOrdersCSV))

app_users["signup_date"]       = pd.to_datetime(app_users["signup_date"])
app_activity["activity_date"]  = pd.to_datetime(app_activity["activity_date"])
app_orders["order_date"]       = pd.to_datetime(app_orders["order_date"])

# конец окна наблюдения: данные обрезаны 30 сентября
LAST_DAY = pd.Timestamp("2024-09-30")
`;

window.SH.appData = ["appUsersCSV", "appActivityCSV", "appOrdersCSV"];

/* ============================================================
   Модуль 5 работает на тех же данных приложения, но в виде
   таблицы признаков: одна строка на пользователя, поведение
   первой недели против того, что он принёс за 90 дней.
   Это стандартная постановка задачи раннего прогноза LTV.

   sklearn и scipy в браузер не тянем: обе регрессии считаются
   руками через numpy. Так студент видит формулу, а не вызов
   чёрного ящика, и понимает, что именно подбирается.
   ============================================================ */

window.SH.mlSchema = `
<p>Таблица <code>feat</code> — одна строка на каждого из 4000 пользователей приложения. Собрана из <code>app_users</code>, <code>app_activity</code> и <code>app_orders</code> прологом урока.</p>
<pre><code>feat                        -- 4000 строк
  user_id     INTEGER
  channel     TEXT          -- organic | paid_search | social | email | referral | partner
  platform    TEXT          -- ios | android | web
  days7       INTEGER       -- дней активности в первую неделю жизни (1..7)
  orders7     INTEGER       -- заказов в первую неделю
  rev7        FLOAT         -- выручка первой недели
  days90      INTEGER       -- дней активности за 90 дней
  rev90       FLOAT         -- выручка за 90 дней  <- целевая переменная
  converted   INTEGER       -- 1, если rev90 > 0</code></pre>
<p>Готовые матрицы для регрессии тоже собраны заранее:</p>
<pre><code>CHANNELS   список каналов без organic (organic — базовая категория)
D          матрица 4000 x 5: фиктивные переменные каналов
P          матрица 4000 x 2: фиктивные переменные ios и web (база — android)
y          вектор rev90
yb         вектор converted</code></pre>
<p>Загружены <code>pandas as pd</code> и <code>numpy as np</code>. Библиотек машинного обучения нет намеренно: всё, что нужно, — это <code>np.linalg.solve</code> и арифметика.</p>
`;

window.SH.mlPrelude = window.SH.appPrelude + `
import numpy as np

def _build_features():
    """Поведение первой недели против результата за 90 дней."""
    act = app_activity.merge(app_users[["user_id", "signup_date"]], on="user_id")
    act["age"] = (act["activity_date"] - act["signup_date"]).dt.days
    ord_ = app_orders.merge(app_users[["user_id", "signup_date"]], on="user_id")
    ord_["age"] = (ord_["order_date"] - ord_["signup_date"]).dt.days

    d7  = act[act["age"] <= 6].groupby("user_id").size().rename("days7")
    d90 = act[act["age"] <= 90].groupby("user_id").size().rename("days90")
    g7  = ord_[ord_["age"] <= 6].groupby("user_id").agg(
              orders7=("revenue", "size"), rev7=("revenue", "sum"))
    r90 = ord_[ord_["age"] <= 90].groupby("user_id")["revenue"].sum().rename("rev90")

    t = (app_users.set_index("user_id")[["channel", "platform"]]
         .join([d7, d90, g7, r90]).fillna(0))
    t["converted"] = (t["rev90"] > 0).astype(int)
    return t.reset_index()

feat = _build_features()

# Фиктивные переменные. Одну категорию всегда выбрасывают:
# иначе столбцы линейно зависимы и матрица необратима.
CHANNELS = ["email", "paid_search", "partner", "referral", "social"]   # база — organic
PLATFORMS = ["ios", "web"]                                            # база — android

D = np.column_stack([(feat["channel"] == c).to_numpy(float) for c in CHANNELS])
P = np.column_stack([(feat["platform"] == p).to_numpy(float) for p in PLATFORMS])
y  = feat["rev90"].to_numpy(float)
yb = feat["converted"].to_numpy(float)
`;
