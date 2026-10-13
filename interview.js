/* ============================================================
   Пробное собеседование (#mock): пул заданий

   Страницу рисует app.js (renderMock, Mock, MockCore). Файл грузится
   по требованию, как модули уроков. В попытку берутся по одной
   SQL-задаче каждого уровня, один кейс и пять вопросов из quiz уроков.

   SQL-задача (база «Дельта Такси»):
     id       — на него ссылается история попыток; не меняется
     level    — easy / mid / hard, по 4 задачи каждого уровня
     lesson   — урок, к которому вернуться, если задача не сошлась
     title, body — заголовок и условие (HTML)
     solution — эталонное решение
     expected — что должно получиться: columns, rows, ordered;
                собирается из solution: node инструменты/checkinterview.js --print <id>
   Кейс:
     id, title, body — как у задачи
     ref      — эталонный ответ (HTML)
     check    — 5–6 пунктов чек-листа самопроверки

   Решения и ожидания проверяет node инструменты/checkinterview.js.
   ============================================================ */
window.MOCK = {
  "sql": [
    {
      "id": "nodrv-tariff",
      "level": "easy",
      "lesson": "m1l3",
      "title": "«Нет машины» по тарифу",
      "body": "<p>По каждому тарифу: <code>tariff</code>, <code>orders</code> — все заказы и <code>no_driver_pct</code> — доля заказов со статусом <code>no_driver</code> в процентах с одним знаком. Сортировка — по убыванию доли.</p>",
      "solution": "SELECT tariff, COUNT(*) AS orders,\n       ROUND(100.0 * SUM(status = 'no_driver') / COUNT(*), 1) AS no_driver_pct\nFROM trips GROUP BY tariff ORDER BY no_driver_pct DESC;",
      "expected": {
        "columns": [
          "tariff",
          "orders",
          "no_driver_pct"
        ],
        "rows": [
          [
            "business",
            275,
            12.4
          ],
          [
            "comfort",
            1096,
            6.8
          ],
          [
            "econom",
            2629,
            6.7
          ]
        ],
        "ordered": true
      }
    },
    {
      "id": "platform-rev",
      "level": "easy",
      "lesson": "m1l1",
      "title": "Выручка по платформе",
      "body": "<p>По завершённым поездкам и платформе пассажира (<code>riders.platform</code>): <code>platform</code>, <code>trips</code>, <code>revenue</code> — выручка, округлённая до рубля, и <code>avg_check</code> — средний чек с двумя знаками. Сортировка — по убыванию выручки.</p>",
      "solution": "SELECT r.platform, COUNT(*) AS trips, ROUND(SUM(t.price)) AS revenue, ROUND(AVG(t.price), 2) AS avg_check\nFROM trips t JOIN riders r ON r.rider_id = t.rider_id\nWHERE t.status = 'completed' GROUP BY r.platform ORDER BY revenue DESC;",
      "expected": {
        "columns": [
          "platform",
          "trips",
          "revenue",
          "avg_check"
        ],
        "rows": [
          [
            "android",
            1809,
            590484,
            326.41
          ],
          [
            "ios",
            1563,
            522015,
            333.98
          ]
        ],
        "ordered": true
      }
    },
    {
      "id": "rub-per-km",
      "level": "easy",
      "lesson": "m1l3",
      "title": "Рубль за километр",
      "body": "<p>По завершённым поездкам и тарифу: <code>tariff</code>, <code>avg_km</code> — средняя дистанция с одним знаком и <code>rub_per_km</code> — сумма цен, делённая на сумму километров, с одним знаком. Сортировка — по возрастанию <code>rub_per_km</code>.</p>",
      "solution": "SELECT tariff, ROUND(AVG(distance_km), 1) AS avg_km, ROUND(SUM(price) / SUM(distance_km), 1) AS rub_per_km\nFROM trips WHERE status = 'completed' GROUP BY tariff ORDER BY rub_per_km;",
      "expected": {
        "columns": [
          "tariff",
          "avg_km",
          "rub_per_km"
        ],
        "rows": [
          [
            "econom",
            8.3,
            32.8
          ],
          [
            "comfort",
            8.4,
            45.9
          ],
          [
            "business",
            8.3,
            83.5
          ]
        ],
        "ordered": true
      }
    },
    {
      "id": "weekday",
      "level": "easy",
      "lesson": "m1l6",
      "title": "День недели",
      "body": "<p><code>weekday</code> — день недели заказа числом (<code>strftime('%w', requested_at)</code>, 0 — воскресенье), <code>orders</code> — заказы и <code>done_pct</code> — доля завершённых в процентах с одним знаком. Сортировка — по <code>weekday</code>.</p>",
      "solution": "SELECT CAST(strftime('%w', requested_at) AS INTEGER) AS weekday, COUNT(*) AS orders,\n       ROUND(100.0 * SUM(status = 'completed') / COUNT(*), 1) AS done_pct\nFROM trips GROUP BY weekday ORDER BY weekday;",
      "expected": {
        "columns": [
          "weekday",
          "orders",
          "done_pct"
        ],
        "rows": [
          [
            0,
            564,
            82.3
          ],
          [
            1,
            549,
            81.2
          ],
          [
            2,
            580,
            87.1
          ],
          [
            3,
            618,
            85.4
          ],
          [
            4,
            548,
            84.5
          ],
          [
            5,
            567,
            85.7
          ],
          [
            6,
            574,
            83.6
          ]
        ],
        "ordered": true
      }
    },
    {
      "id": "loyal-riders",
      "level": "mid",
      "lesson": "m1l4",
      "title": "Постоянные пассажиры",
      "body": "<p>Возьмите пассажиров хотя бы с одной завершённой поездкой. По городу поездки: <code>city</code>, <code>riders</code> — сколько таких пассажиров, <code>loyal</code> — сколько из них сделали 5 и больше завершённых поездок, <code>loyal_pct</code> — их доля с одним знаком. Сортировка — по убыванию <code>loyal_pct</code>.</p>",
      "solution": "WITH c AS (SELECT rider_id, city, COUNT(*) AS n FROM trips WHERE status = 'completed' GROUP BY rider_id, city)\nSELECT city, COUNT(*) AS riders, SUM(n >= 5) AS loyal, ROUND(100.0 * SUM(n >= 5) / COUNT(*), 1) AS loyal_pct\nFROM c GROUP BY city ORDER BY loyal_pct DESC;",
      "expected": {
        "columns": [
          "city",
          "riders",
          "loyal",
          "loyal_pct"
        ],
        "rows": [
          [
            "Казань",
            211,
            85,
            40.3
          ],
          [
            "Москва",
            413,
            163,
            39.5
          ],
          [
            "Екатеринбург",
            218,
            67,
            30.7
          ]
        ],
        "ordered": true
      }
    },
    {
      "id": "surge-revenue",
      "level": "mid",
      "lesson": "m1l3",
      "title": "Сколько приносит наценка",
      "body": "<p>По завершённым поездкам и городу: <code>city</code>, <code>revenue</code> — выручка до рубля, <code>surge_rev_pct</code> — доля выручки от поездок с <code>surge &gt; 1</code> и <code>surge_trips_pct</code> — доля таких поездок. Доли — в процентах с одним знаком. Сортировка — по убыванию <code>surge_rev_pct</code>.</p>",
      "solution": "SELECT city, ROUND(SUM(price)) AS revenue,\n       ROUND(100.0 * SUM(CASE WHEN surge > 1 THEN price END) / SUM(price), 1) AS surge_rev_pct,\n       ROUND(100.0 * SUM(surge > 1) / COUNT(*), 1) AS surge_trips_pct\nFROM trips WHERE status = 'completed' GROUP BY city ORDER BY surge_rev_pct DESC;",
      "expected": {
        "columns": [
          "city",
          "revenue",
          "surge_rev_pct",
          "surge_trips_pct"
        ],
        "rows": [
          [
            "Екатеринбург",
            262844,
            40.5,
            32.9
          ],
          [
            "Казань",
            283499,
            27.4,
            18.9
          ],
          [
            "Москва",
            566156,
            23.2,
            18.4
          ]
        ],
        "ordered": true
      }
    },
    {
      "id": "msk-growth",
      "level": "mid",
      "lesson": "m1l2",
      "title": "Рост Москвы",
      "body": "<p>Завершённые поездки Москвы по месяцам: <code>month</code> (вида <code>'2024-01'</code>), <code>trips</code> и <code>growth_pct</code> — рост к прошлому месяцу в процентах с одним знаком; у первого месяца роста нет, там пусто. Сортировка — по месяцам.</p>",
      "solution": "WITH m AS (SELECT strftime('%Y-%m', requested_at) AS month, COUNT(*) AS trips\n           FROM trips WHERE status = 'completed' AND city = 'Москва' GROUP BY month)\nSELECT month, trips,\n       ROUND(100.0 * (trips - LAG(trips) OVER (ORDER BY month)) / LAG(trips) OVER (ORDER BY month), 1) AS growth_pct\nFROM m ORDER BY month;",
      "expected": {
        "columns": [
          "month",
          "trips",
          "growth_pct"
        ],
        "rows": [
          [
            "2024-01",
            183,
            null
          ],
          [
            "2024-02",
            176,
            -3.8
          ],
          [
            "2024-03",
            236,
            34.1
          ],
          [
            "2024-04",
            277,
            17.4
          ],
          [
            "2024-05",
            377,
            36.1
          ],
          [
            "2024-06",
            477,
            26.5
          ]
        ],
        "ordered": true
      }
    },
    {
      "id": "activation-14d",
      "level": "mid",
      "lesson": "m1l6",
      "title": "Первая поездка после регистрации",
      "body": "<p>Пассажиры, зарегистрированные с 1 января по 31 мая 2024. По месяцу регистрации: <code>month</code> (вида <code>'2024-01'</code>), <code>signups</code> — сколько зарегистрировались и <code>active_14d</code> — сколько из них завершили поездку в день регистрации или в следующие 13 дней. Считайте по датам, время суток заказа не учитывайте. Сортировка — по месяцам.</p>",
      "solution": "SELECT strftime('%Y-%m', r.signup_date) AS month, COUNT(DISTINCT r.rider_id) AS signups,\n       COUNT(DISTINCT CASE WHEN julianday(date(t.requested_at)) - julianday(r.signup_date) BETWEEN 0 AND 13\n                           THEN r.rider_id END) AS active_14d\nFROM riders r LEFT JOIN trips t ON t.rider_id = r.rider_id AND t.status = 'completed'\nWHERE r.signup_date >= '2024-01-01' AND r.signup_date < '2024-06-01'\nGROUP BY month ORDER BY month;",
      "expected": {
        "columns": [
          "month",
          "signups",
          "active_14d"
        ],
        "rows": [
          [
            "2024-01",
            104,
            14
          ],
          [
            "2024-02",
            76,
            16
          ],
          [
            "2024-03",
            88,
            28
          ],
          [
            "2024-04",
            95,
            30
          ],
          [
            "2024-05",
            123,
            61
          ]
        ],
        "ordered": true
      }
    },
    {
      "id": "median-wait",
      "level": "hard",
      "lesson": "m1l2",
      "title": "Медиана подачи",
      "body": "<p>Медиана минут подачи — от <code>requested_at</code> до <code>pickup_at</code> — по завершённым поездкам каждого города: <code>city</code>, <code>median_wait</code> с одним знаком. При чётном числе поездок медиана — среднее двух серединных значений. Сортировка — по городу.</p><p>Функции <code>MEDIAN</code> в SQLite нет.</p>",
      "solution": "WITH w AS (SELECT city, (julianday(pickup_at) - julianday(requested_at)) * 1440 AS m FROM trips WHERE status = 'completed'),\nr AS (SELECT city, m, ROW_NUMBER() OVER (PARTITION BY city ORDER BY m) AS rn, COUNT(*) OVER (PARTITION BY city) AS n FROM w)\nSELECT city, ROUND(AVG(m), 1) AS median_wait FROM r WHERE rn IN ((n + 1) / 2, (n + 2) / 2) GROUP BY city ORDER BY city;",
      "expected": {
        "columns": [
          "city",
          "median_wait"
        ],
        "rows": [
          [
            "Екатеринбург",
            9
          ],
          [
            "Казань",
            7
          ],
          [
            "Москва",
            7
          ]
        ],
        "ordered": true
      }
    },
    {
      "id": "repeat-7d",
      "level": "hard",
      "lesson": "m1l2",
      "title": "Вернулся за неделю",
      "body": "<p>Возьмите завершённые поездки до 24 июня 2024 — так у каждой есть полная неделя наблюдения. Какая доля из них такая, что тот же пассажир снова завершил поездку не позже чем через 7 суток? Следующую поездку ищите среди всех завершённых — она может быть и после 24 июня, срез касается только исходных поездок. Интервал — между моментами <code>requested_at</code>, а не между датами. <code>city</code>, <code>trips</code> и <code>repeat_7d_pct</code> с одним знаком. Сортировка — по убыванию доли.</p><p><code>LEAD</code> — пара к <code>LAG</code>: значение из следующей строки окна.</p>",
      "solution": "WITH s AS (SELECT city, requested_at,\n                  LEAD(requested_at) OVER (PARTITION BY rider_id ORDER BY requested_at, trip_id) AS nxt\n           FROM trips WHERE status = 'completed')\nSELECT city, COUNT(*) AS trips,\n       ROUND(100.0 * SUM(nxt IS NOT NULL AND julianday(nxt) - julianday(requested_at) <= 7) / COUNT(*), 1) AS repeat_7d_pct\nFROM s WHERE requested_at < '2024-06-24' GROUP BY city ORDER BY repeat_7d_pct DESC;",
      "expected": {
        "columns": [
          "city",
          "trips",
          "repeat_7d_pct"
        ],
        "rows": [
          [
            "Москва",
            1593,
            23.2
          ],
          [
            "Екатеринбург",
            735,
            22.7
          ],
          [
            "Казань",
            823,
            22.4
          ]
        ],
        "ordered": true
      }
    },
    {
      "id": "streaks",
      "level": "hard",
      "lesson": "m6l3",
      "title": "Серии рабочих дней",
      "body": "<p>Рабочий день водителя — день хотя бы с одной его завершённой поездкой; день поездки — <code>date(requested_at)</code>. Для каждого водителя найдите самую длинную серию рабочих дней подряд и выведите распределение: <code>longest_streak</code> — длина серии и <code>drivers</code> — у скольких водителей самая длинная серия такая. Сортировка — по <code>longest_streak</code>.</p>",
      "solution": "WITH d AS (SELECT DISTINCT driver_id, date(requested_at) AS day FROM trips WHERE status = 'completed'),\ng AS (SELECT driver_id, julianday(day) - ROW_NUMBER() OVER (PARTITION BY driver_id ORDER BY day) AS grp FROM d),\ns AS (SELECT driver_id, COUNT(*) AS len FROM g GROUP BY driver_id, grp),\nb AS (SELECT driver_id, MAX(len) AS best FROM s GROUP BY driver_id)\nSELECT best AS longest_streak, COUNT(*) AS drivers FROM b GROUP BY best ORDER BY best;",
      "expected": {
        "columns": [
          "longest_streak",
          "drivers"
        ],
        "rows": [
          [
            1,
            147
          ],
          [
            2,
            126
          ],
          [
            3,
            18
          ],
          [
            4,
            4
          ]
        ],
        "ordered": true
      }
    },
    {
      "id": "top-decile",
      "level": "hard",
      "lesson": "m1l2",
      "title": "Десятая часть водителей",
      "body": "<p>В каждом городе разбейте водителей по выручке завершённых поездок на 10 групп через <code>NTILE(10)</code> — от больших к меньшим, при равной выручке по <code>driver_id</code>. <code>NTILE(10) OVER (PARTITION BY … ORDER BY …)</code> нумерует строки окна группами от 1 до 10 почти равного размера; если строки не делятся поровну, лишние достаются первым группам. Какую долю выручки города приносит первая группа? <code>city</code>, <code>top10_share</code> в процентах с одним знаком. Сортировка — по убыванию доли.</p>",
      "solution": "WITH r AS (SELECT city, driver_id, SUM(price) AS rev FROM trips WHERE status = 'completed' GROUP BY city, driver_id),\nn AS (SELECT city, rev, NTILE(10) OVER (PARTITION BY city ORDER BY rev DESC, driver_id) AS dec FROM r)\nSELECT city, ROUND(100.0 * SUM(CASE WHEN dec = 1 THEN rev END) / SUM(rev), 1) AS top10_share\nFROM n GROUP BY city ORDER BY top10_share DESC;",
      "expected": {
        "columns": [
          "city",
          "top10_share"
        ],
        "rows": [
          [
            "Екатеринбург",
            27.3
          ],
          [
            "Москва",
            26.5
          ],
          [
            "Казань",
            22.6
          ]
        ],
        "ordered": true
      }
    }
  ],
  "cases": [
    {
      "id": "ekb-april",
      "title": "Екатеринбург в апреле",
      "body": "<p>Доля заказов Екатеринбурга, закончившихся поездкой, упала с 87,7% в марте (130 заказов) до 71,7% в апреле (159 заказов). Продакт спрашивает, что случилось. Напишите, как будете разбираться: что проверите, в каком порядке и что скажете в конце.</p>",
      "ref": "<p>Сначала — данные и определение: метрика считается от заказов, а не от поездок, апрель в выгрузке полный, новых статусов не появилось.</p><p>Потом — разложить падение по статусам. Из 16,0 процентного пункта падения 11,2 — рост доли «нет машины» (7,7% → 18,9%), 1,7 — отмены пассажиром (4,6% → 6,3%) и 3,1 — отмены водителем, которых в марте не было вовсе (0 из 130, в апреле 5 из 159). Около 70% потерь — заказы, на которые не нашлось машины. Дальше — по часам и тарифам, где именно не хватает машин, и сравнение с Москвой и Казанью: там доля завершённых за те же месяцы не упала (Казань 86,0% → 86,6%, Москва 84,3% → 87,1%), значит, причина местная.</p><p>Вывод для продакта: заказов в Екатеринбурге стало больше (130 → 159), а водителей с поездками — меньше (47 → 41). Следующий шаг — число активных водителей по неделям и наценка в часы нехватки как рычаг.</p>",
      "check": [
        "Проверил данные и определение метрики",
        "Разложил падение по статусам и назвал главный",
        "Разрезал по часу или тарифу",
        "Сравнил с Москвой и Казанью",
        "Предложил следующий шаг с метрикой — например, число активных водителей"
      ]
    },
    {
      "id": "evening-surge",
      "title": "Вечерняя наценка",
      "body": "<p>Продакт хочет поднять вечернюю наценку на 10%. Сейчас в 18, 19 и 20 часов наценка стоит у 63,1% из 1 010 заказов. Как проверить, что идея хорошая?</p>",
      "ref": "<p>Гипотеза: выручка вырастет, а доля завершённых заказов почти не упадёт. Главная метрика — выручка на заказ: она учитывает и цену, и потерянные заказы. Предохранители — доля отмен пассажиром, доля «нет машины» и время подачи.</p><p>Делить пассажиров случайно, как в A/B-тестах курса, здесь нельзя: водители общие, и группы влияют друг на друга — дорогая группа отдаёт машины дешёвой. Такой дизайн в курсе не разбирался, но о нём часто спрашивают: чередование по дням или по городам (switchback) — в один вечер наценка выше во всём городе, в другой — прежняя.</p><p>Длительность — целые недели, чтобы дни недели были в обеих группах поровну; число вечеров — по оценке мощности. Решение принимают заранее: при каком росте выручки и каком падении доли завершённых раскатываем.</p>",
      "check": [
        "Сформулировал гипотезу и главную метрику",
        "Назвал предохранители: отмены, подача",
        "Заметил, что водители общие и группы влияют друг на друга",
        "Предложил, как разделить группы, чтобы они не мешали друг другу",
        "Оценил длительность или мощность",
        "Сказал заранее, как примет решение"
      ]
    },
    {
      "id": "check-up",
      "title": "Чек вырос",
      "body": "<p>Средний чек завершённой поездки вырос с 314,44 ₽ в марте до 334,73 ₽ в апреле — на 6,5%. Финансовый директор доволен. Это хорошая новость?</p>",
      "ref": "<p>Не обязательно. Средний чек — среднее по смеси поездок, и смесь поменялась: доля поездок с наценкой выросла с 17,1% до 25,0%, доля поездок не в econom — с 32,2% до 35,6%. Чек мог вырасти без того, чтобы хоть одна поездка подорожала.</p><p>Проверка — пересчитать апрельский чек при мартовском составе (тариф × наценка): вышло бы 320,03 ₽. Значит, из 20,29 ₽ роста 14,70 ₽ (72%) дал состав и только 5,59 ₽ — цены внутри групп. Поэтому внутри econom чек тоже вырос (257,33 → 278,24 ₽), но меньше, чем кажется по общему среднему. Потом — объём и доля завершённых: наценка растёт, когда не хватает машин, а нехватка машин — это потерянные заказы.</p><p>Вывод: рост чека примерно на три четверти объясняется составом поездок; хорошая это новость или нет, зависит от того, сколько заказов при этом потеряно.</p>",
      "check": [
        "Заподозрил эффект состава",
        "Назвал разрезы: тариф и наценка",
        "Предложил сравнить чек внутри тарифа",
        "Посмотрел на объём и долю завершённых",
        "Сформулировал вывод с оговоркой"
      ]
    },
    {
      "id": "dashboard",
      "title": "Дашборд на каждый день",
      "body": "<p>Операционный менеджер такси просит дашборд, который он будет открывать каждое утро. Что на нём будет и почему?</p>",
      "ref": "<p>Одна главная метрика сверху — доля заказов, закончившихся поездкой, за вчера. Под ней — её составляющие: число заказов и доли статусов («нет машины», отмены пассажиром и водителем), время подачи и средний чек.</p><p>Разрезы — город × час и тариф: потери почти всегда сосредоточены в нескольких клетках. Каждое число — рядом с базой: вчера против того же дня неделю назад, иначе понедельник будут сравнивать с воскресеньем.</p><p>Пороги и оповещения — чтобы менеджер узнавал о провале, не открывая дашборд. Не больше 5–7 графиков: всё остальное — в отдельном отчёте для разбора.</p>",
      "check": [
        "Выбрал одну главную метрику",
        "Разложил её на составляющие",
        "Назвал разрезы: город, час, тариф",
        "Предложил сравнение с базой: вчера, неделя назад",
        "Подумал о порогах или оповещениях",
        "Ограничил число графиков"
      ]
    }
  ]
};
