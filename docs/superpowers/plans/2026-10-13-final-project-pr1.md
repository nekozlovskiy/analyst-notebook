# Модуль 7 «Финальный проект», PR 1 — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** база «Вилки» (генератор, `vilka.xlsx`, `vilka.db`), модуль 7 в курсе и уроки 7.1–7.4; уроки 7.5–7.7 в карте с `ready: false`.

**Architecture:** генератор `gen_vilka.py` пишет `data-vilka.js` (CSV-строки, сайт его не грузит); из него `mkxlsx.py` собирает `vilka.xlsx`, `mkdb.py` — `инструменты/vilka.db` для проверок. Уроки — существующие виды: `text` (7.1) и `sheet` (7.2–7.4) с полями, `check`-запросы которых идут в `vilka.db` (новый ключ урока `db: "vilka"`). Эталонный код для Colab лежит в `window.VILKA_CODE` в `content-m7.js`; `checkvilka.py` прогоняет его на pandas 2.2 и 3 и сверяет напечатанное с полями.

**Tech Stack:** чистый JS, Python 3 + openpyxl 3.1.5, pandas 2.2 (`~/.cache/analyst-notebook`) и 3.x, sqlite3, Node.

**Spec:** `docs/superpowers/specs/2026-10-13-final-project-design.md`

## Global Constraints

- `id` уроков не меняются; новые — `m7l1` … `m7l7`, модуль `m7`.
- Каждое число в тексте урока проверено запуском на базе «Вилки»; рецепт и числа — в `ПРОГРЕСС.md`.
- Тон: без восклицаний, каждое утверждение с числом и знаменателем.
- Python-код проверяется по напечатанному построчно на pandas 2.2 и 3; текстовые Series в печать не выводить.
- Выручка «Вилки» = 20% от `items_sum` + `delivery_fee` доставленных заказов; GMV = `items_sum` доставленных. Чистые данные: без строк-дублей, без `platform = 'internal'`.
- `Тетрадь аналитика.html` руками не правится. Правки только на ветке `final-project`.
- Коммит и PR — только после «Давай» владельца; один коммит содержания в конце, затем `release.sh`.

## Review Focus

1. Карта зависимостей на главной: узел m7 и стрелка к нему не пересекают другие узлы ни в широкой, ни в узкой раскладке — Task 5, шаг со скриншотами 1280 и 375 px.
2. Уроки 7.5–7.7 с `ready: false` не ломают «продолжить», план на день, итоговый тест модуля 7 и страницу модуля — Task 5, проверка в браузере.
3. Ученик в Colab читает xlsx на pandas, который там стоит (2.x): `read_excel` даёт даты типом datetime, и `to_sql` кладёт их строкой `YYYY-MM-DD HH:MM:SS` — запросы урока опираются на `strftime`/`substr` от этой строки — Task 6 (код загрузки) и Task 10 (прогон).
4. Дубли: `to_sql` не ставит первичный ключ, дубли доезжают до SQLite — поле «строк-дублей» в 7.2 не обнулится случайно — Task 7, `checkvilka.py`.
5. Офлайн-файл: «Скачать данные» в собранном `Тетрадь аналитика.html` отдаёт `vilka.xlsx` из `window.FILES` — Task 11.

## Проверенные числа генератора (прототип, зерно 2025)

```
клиентов 7030 (из них internal 30), ресторанов 150
строк заказов 31 387, уникальных order_id 31 071 → строк-дублей 316
заказов internal 4524 (уникальных); чистых заказов 26 547, доставлено 24 948
GMV 31 137 390, плата за доставку 5 408 950 (чистые доставленные)
эксперимент: 4563 строки, internal 30; без internal control 2264, test 2269
  control: конверсия 49,34%, заказов 2053, чек 1230,2, выручка Вилки на польз. 426,41
  test:    конверсия 53,72%, заказов 2372, чек 1278,9, выручка Вилки на польз. 429,15
  z конверсии 2,95; SRM: хи-квадрат по 2264 / 2269 — сплит в порядке
```

Числа уроков 7.2–7.4 получаются запросами из задач ниже на `vilka.db` после Task 2; в тексты попадают только они.

## Файлы

- Create: `инструменты/gen_vilka.py`, `data-vilka.js` (генерируется), `vilka.xlsx` (генерируется), `инструменты/vilka.db` (генерируется), `content-m7.js`, `инструменты/checkvilka.py`.
- Modify: `инструменты/mkxlsx.py` (третья книга), `инструменты/mkdb.py` (vilka.db), `инструменты/checknums.js` (`db: "vilka"`), `инструменты/ci.sh`, `инструменты/README.md`, `build.py` (`LAZY`, `window.FILES`), `app.js` (`Offline.files`, `Route` координаты), `lessons.js` (модуль 7, навык), `content-m6.js` (вступление `m6l6`), `инструменты/checkskills.js` (число навыков), `инструменты/checkcards.js` и другие скрипты, где перечислены `content-m0..m6` (поиск), `README.md`, `ПРОГРЕСС.md`, `index.html` (счётчики, если есть).

---

### Task 1: Генератор «Вилки»

**Files:** Create `инструменты/gen_vilka.py`, `data-vilka.js`. Modify `инструменты/ci.sh`, `инструменты/README.md`.

**Interfaces:** Produces — `data-vilka.js` с `window.VILKA = { customersCSV, restaurantsCSV, ordersCSV, experimentCSV }`; заголовки CSV:
`customer_id,signup_date,city,platform,channel` / `restaurant_id,city,cuisine` / `order_id,customer_id,restaurant_id,created_at,items_sum,delivery_fee,status` / `customer_id,group,assigned_at`. Даты `YYYY-MM-DD`, `created_at` — `YYYY-MM-DD HH:MM`.

- [ ] **Step 1: Проверка, которая падает.** Run: `python3 инструменты/gen_vilka.py --check` — Expected: ошибка «нет файла» (скрипта ещё нет).

- [ ] **Step 2: Создать `инструменты/gen_vilka.py`** с кодом:

```python
#!/usr/bin/env python3
"""Генератор базы «Вилка» (доставка еды) для модуля 7 «Финальный проект».

    python3 инструменты/gen_vilka.py            # контрольные числа + data-vilka.js
    python3 инструменты/gen_vilka.py --check    # только сверить data-vilka.js

Детерминированный: одно зерно, только random.Random — тот же код даёт
побайтно тот же data-vilka.js. Сюжет: в мае 2025 четыре недели шёл
эксперимент «бесплатная доставка от 1500 ₽». У test чаще заказывают и
добирают корзину до порога, но «Вилка» теряет плату за доставку.
Ловушки выгрузки: дубли строк заказов, внутренние тестовые аккаунты
(platform = internal), отменённые заказы.
"""
import datetime as dt
import pathlib
import random
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "data-vilka.js"
R = random.Random(2025)

START, END = dt.date(2025, 1, 1), dt.date(2025, 7, 1)
EXP_START, EXP_END = dt.date(2025, 5, 5), dt.date(2025, 6, 2)    # 4 недели, пн–пн
N_CUST, N_INTERNAL, N_REST = 7000, 30, 150
CITIES = [("Москва", 0.45), ("Санкт-Петербург", 0.25), ("Казань", 0.15), ("Новосибирск", 0.15)]
PLATFORMS = [("android", 0.45), ("ios", 0.38), ("web", 0.17)]
CHANNELS = [("organic", 0.36), ("paid_search", 0.24), ("social", 0.18), ("referral", 0.12), ("promo", 0.10)]
CUISINES = [("пицца", 0.2), ("суши", 0.2), ("бургеры", 0.15), ("грузинская", 0.1),
            ("азиатская", 0.15), ("здоровая", 0.1), ("пекарня", 0.1)]
THRESHOLD = 1500
FEE_LOW, FEE_HIGH = 249, 149          # до порога / от порога — обычный тариф
CANCEL = 0.06
DUP = 0.01


def pick(pairs):
    x, acc = R.random(), 0.0
    for v, w in pairs:
        acc += w
        if x < acc:
            return v
    return pairs[-1][0]


def rday(a, b):
    return a + dt.timedelta(days=R.randrange((b - a).days))


def basket():
    s = int(R.lognormvariate(7.05, 0.42) / 10) * 10
    return max(290, min(s, 9990))


def build():
    rests = []
    for i in range(N_REST):
        rests.append((101 + i, pick(CITIES), pick(CUISINES)))
    by_city = {}
    for r in rests:
        by_city.setdefault(r[1], []).append(r[0])

    custs = []
    for i in range(N_CUST):
        # регистрации растут к лету
        d = START + dt.timedelta(days=int((R.random() ** 0.8) * 150))
        custs.append({"id": 10001 + i, "signup": d, "city": pick(CITIES), "platform": pick(PLATFORMS),
                      "channel": pick(CHANNELS), "rate": R.lognormvariate(-3.65, 0.9)})
    for i in range(N_INTERNAL):
        custs.append({"id": 90001 + i, "signup": START + dt.timedelta(days=R.randrange(20)),
                      "city": "Москва", "platform": "internal", "channel": "organic", "rate": 0.5})

    # эксперимент: активные до мая клиенты, назначение в первую неделю
    exp = {}
    pool = [c for c in custs if c["signup"] < EXP_START]
    for c in pool:
        if c["platform"] == "internal" or R.random() < 0.82:
            exp[c["id"]] = ("test" if R.random() < 0.5 else "control",
                            EXP_START + dt.timedelta(days=R.randrange(7)))

    orders, oid = [], 500001
    d = START
    while d < END:
        in_exp = EXP_START <= d < EXP_END
        for c in custs:
            if d < c["signup"]:
                continue
            p = c["rate"]
            g = exp.get(c["id"])
            test = in_exp and g and g[0] == "test" and d >= g[1]
            if test:
                p *= 1.20
            if R.random() >= p:
                continue
            n = 1 if c["platform"] != "internal" else R.choice([1, 1, 2, 3])
            for _ in range(n):
                s = basket() if c["platform"] != "internal" else R.choice([100, 150, 200])
                if test and 1100 <= s < THRESHOLD and R.random() < 0.45:
                    s = THRESHOLD + 10 * R.randrange(0, 25)
                fee = FEE_LOW if s < THRESHOLD else FEE_HIGH
                if test and s >= THRESHOLD:
                    fee = 0
                rest = R.choice(by_city[c["city"]] if c["city"] in by_city else by_city["Москва"])
                t = dt.datetime.combine(d, dt.time(R.choice([9, 11, 12, 13, 14, 18, 19, 19, 20, 20, 21, 22]),
                                                   R.randrange(60)))
                st = "cancelled" if R.random() < CANCEL else "delivered"
                orders.append((oid, c["id"], rest, t, s, fee, st))
                oid += 1
        d += dt.timedelta(days=1)

    out = []
    for o in orders:
        out.append(o)
        if R.random() < DUP:
            out.append(o)
    return custs, rests, out, exp


def report(custs, rests, orders, exp):
    from collections import Counter
    plat = {c["id"]: c["platform"] for c in custs}
    print("клиентов", len(custs), "ресторанов", len(rests), "строк заказов", len(orders),
          "уникальных", len({o[0] for o in orders}), "в эксперименте", len(exp))
    clean = {o[0]: o for o in orders if plat[o[1]] != "internal"}.values()
    dl = [o for o in clean if o[6] == "delivered"]
    print("чистых заказов", len(clean), "доставлено", len(dl),
          "GMV", sum(o[4] for o in dl), "плата за доставку", sum(o[5] for o in dl),
          "internal заказов", sum(plat[o[1]] == "internal" for o in {o[0]: o for o in orders}.values()))
    g = Counter(v[0] for k, v in exp.items() if plat[k] != "internal")
    print("группы без internal", dict(g))
    for grp in ("control", "test"):
        ids = {k for k, v in exp.items() if v[0] == grp and plat[k] != "internal"}
        eo = [o for o in dl if o[1] in ids and EXP_START <= o[3].date() < EXP_END and o[3].date() >= exp[o[1]][1]]
        buyers = {o[1] for o in eo}
        gmv, fee = sum(o[4] for o in eo), sum(o[5] for o in eo)
        rev = 0.2 * gmv + fee
        print("  %-7s польз %d конв %.2f%% заказов %d чек %.1f выручка Вилки %.0f на польз %.2f доля>=1500 %.1f%%" % (
            grp, len(ids), 100 * len(buyers) / len(ids), len(eo), gmv / len(eo), rev, rev / len(ids),
            100 * sum(o[4] >= THRESHOLD for o in eo) / len(eo)))


def day(d):
    return d.strftime("%Y-%m-%d")


def render(custs, rests, orders, exp):
    c = ["customer_id,signup_date,city,platform,channel"] + \
        ["%d,%s,%s,%s,%s" % (x["id"], day(x["signup"]), x["city"], x["platform"], x["channel"]) for x in custs]
    r = ["restaurant_id,city,cuisine"] + ["%d,%s,%s" % x for x in rests]
    o = ["order_id,customer_id,restaurant_id,created_at,items_sum,delivery_fee,status"] + \
        ["%d,%d,%d,%s,%d,%d,%s" % (a, b, rr, t.strftime("%Y-%m-%d %H:%M"), s, f, st)
         for a, b, rr, t, s, f, st in orders]
    e = ["customer_id,group,assigned_at"] + \
        ["%d,%s,%s" % (k, v[0], day(v[1])) for k, v in sorted(exp.items())]
    return ("/* База «Вилка» (доставка еды) для модуля 7 «Финальный проект».\n"
            "   Собрана инструменты/gen_vilka.py (зерно 2025), руками не править.\n"
            "   Сайт этот файл не грузит: из него собираются vilka.xlsx (mkxlsx.py)\n"
            "   и инструменты/vilka.db (mkdb.py) для проверок. */\n"
            "window.VILKA = {\n"
            "  customersCSV: `%s`,\n"
            "  restaurantsCSV: `%s`,\n"
            "  ordersCSV: `%s`,\n"
            "  experimentCSV: `%s`\n"
            "};\n") % ("\n".join(c), "\n".join(r), "\n".join(o), "\n".join(e))


if __name__ == "__main__":
    custs, rests, orders, exp = build()
    text = render(custs, rests, orders, exp)
    if "--check" in sys.argv:
        if not OUT.exists() or OUT.read_text(encoding="utf-8") != text:
            sys.exit("data-vilka.js устарел: python3 инструменты/gen_vilka.py")
        print("data-vilka.js совпадает с генератором")
    else:
        report(custs, rests, orders, exp)
        if "--dry" not in sys.argv:
            OUT.write_text(text, encoding="utf-8")
            print("Готово: %s — %.0f КБ" % (OUT.name, OUT.stat().st_size / 1024))
```

- [ ] **Step 3: Собрать и сверить контрольные числа.**
Run: `python3 инструменты/gen_vilka.py && python3 инструменты/gen_vilka.py --check`
Expected: первые строки отчёта совпадают с блоком «Проверенные числа генератора» (клиентов 7030, строк заказов 31387, уникальных 31071, control 2264 / test 2269, конверсия 49,34% / 53,72%, на польз. 426,41 / 429,15); затем «data-vilka.js совпадает с генератором». Повторный запуск не меняет `git diff --stat data-vilka.js`.

- [ ] **Step 4: CI и описание.** `ci.sh` — после строки «База такси»:
```bash
step "База «Вилки»" "data-vilka.js не совпадает с генератором — python3 инструменты/gen_vilka.py" python3 инструменты/gen_vilka.py --check
```
`инструменты/README.md` — строка таблицы после `gen_taxi.py`: «`gen_vilka.py [--check]` | Генератор базы «Вилка» (модуль 7): зерно 2025, только `random.Random` — побайтно тот же `data-vilka.js`. Печатает контрольные числа: дубли, internal, группы эксперимента, конверсия и выручка на пользователя. `--check` сверяет файл с генератором.»

- [ ] **Step 5:** Run: `bash -n инструменты/ci.sh && python3 инструменты/gen_vilka.py --check` — Expected: без ошибок.

### Task 2: `vilka.xlsx` и `vilka.db`

**Files:** Modify `инструменты/mkxlsx.py`, `инструменты/mkdb.py`, `build.py:91-92`, `app.js:529`, `sw.js:107`, `инструменты/ci.sh`, `инструменты/README.md`. Create `vilka.xlsx`, `инструменты/vilka.db`.

**Interfaces:** Consumes — `data-vilka.js` (Task 1). Produces — `vilka.xlsx` (листы `customers`, `restaurants`, `orders`, `experiment`), `инструменты/vilka.db` (те же таблицы, без первичных ключей — дубли сохраняются), ключ `"vilka.xlsx"` в `window.FILES`.

- [ ] **Step 1: `mkxlsx.py` читает и `data-vilka.js`.** Функция `rows(key)` сейчас ищет ключ только в `data.js`. Заменить на:

```python
SRC = (ROOT / "data.js").read_text(encoding="utf-8")
VILKA = (ROOT / "data-vilka.js").read_text(encoding="utf-8")


def rows(key):
    for src in (SRC, VILKA):
        m = re.search(r"\n  %s: `(.*?)`" % key, src, re.S)
        if m:
            return [r for r in csv.reader(io.StringIO(m.group(1))) if r]
    raise KeyError(key)


def stamp(s):
    return datetime.datetime.strptime(s, "%Y-%m-%d %H:%M")
```

В `BOOKS` — третья книга:

```python
    "vilka.xlsx": (
        ("customers", "customersCSV", (int, day, str, str, str), ((2, "yyyy-mm-dd"),)),
        ("restaurants", "restaurantsCSV", (int, str, str), ()),
        ("orders", "ordersCSV", (int, int, int, stamp, int, int, str), ((4, "yyyy-mm-dd hh:mm"),)),
        ("experiment", "experimentCSV", (int, str, day), ((3, "yyyy-mm-dd"),)),
    ),
```

Docstring: «… и vilka.xlsx (модуль 7) из data.js и data-vilka.js».

- [ ] **Step 2:** Run: `python3 инструменты/mkxlsx.py --check` — Expected: две книги совпадают, `vilka.xlsx устарел`, код 1.

- [ ] **Step 3:** Run: `python3 инструменты/mkxlsx.py && python3 инструменты/mkxlsx.py --check && ls -la vilka.xlsx` — Expected: три «совпадает», ≈ 1,4 МБ.

- [ ] **Step 4: `mkdb.py` собирает `vilka.db`.** В конец файла, перед `print("база собрана:", p)`:

```python
# база «Вилки» (модуль 7): отдельный файл — имена таблиц совпадают с «Дельта Маркетом»;
# без первичных ключей, как после to_sql в Colab: дубли выгрузки остаются
v = (BASE / "data-vilka.js").read_text(encoding="utf-8")
pv = W / "vilka.db"
if pv.exists():
    pv.unlink()
cv = sqlite3.connect(pv)
cv.executescript("""
CREATE TABLE customers (customer_id INTEGER, signup_date TEXT, city TEXT, platform TEXT, channel TEXT);
CREATE TABLE restaurants (restaurant_id INTEGER, city TEXT, cuisine TEXT);
CREATE TABLE orders (order_id INTEGER, customer_id INTEGER, restaurant_id INTEGER, created_at TEXT,
                     items_sum INTEGER, delivery_fee INTEGER, status TEXT);
CREATE TABLE experiment (customer_id INTEGER, "group" TEXT, assigned_at TEXT);
""")
for key, table, cast in (("customersCSV", "customers", (int, str, str, str, str)),
                         ("restaurantsCSV", "restaurants", (int, str, str)),
                         ("ordersCSV", "orders", (int, int, int, lambda s: s + ":00", int, int, str)),
                         ("experimentCSV", "experiment", (int, str, str))):
    body = re.search(r"\b%s: `(.*?)`" % key, v, re.S).group(1)
    rows = [tuple(f(x) for f, x in zip(cast, r)) for r in list(csv.reader(io.StringIO(body)))[1:] if r]
    cv.executemany("INSERT INTO %s VALUES (%s)" % (table, ",".join("?" * len(cast))), rows)
    print("vilka", table, len(rows))
cv.commit()
cv.close()
```

`created_at` хранится как `YYYY-MM-DD HH:MM:SS` — так же, как его положит `to_sql` из pandas в Colab (Review Focus 3).

- [ ] **Step 5:** Run: `python3 инструменты/mkdb.py | tail -6 && sqlite3 инструменты/vilka.db "SELECT COUNT(*), COUNT(DISTINCT order_id) FROM orders; SELECT created_at FROM orders LIMIT 1;"`
Expected: `orders 31387`, `31387|31071`, дата вида `2025-01-01 19:07:00`. `git diff --stat инструменты/shop.db` — без изменений содержимого (если бинарно отличается, сверить `sqlite3 инструменты/shop.db .dump | md5` с версией из `git show HEAD:инструменты/shop.db`; разница только в порядке страниц — не коммитить `shop.db`).

- [ ] **Step 6: Имя файла в сборке, офлайне, CI.** `build.py`: кортеж имён в `window.FILES` — `("delta-market.xlsx", "app-journal.xlsx", "vilka.xlsx")`. `app.js:529` — `"vilka.xlsx"` после `"app-journal.xlsx"`. `sw.js:107` — «delta-market.xlsx или другой xlsx урока». `ci.sh` шаг «Файлы xlsx» — текст «xlsx-файлы уроков не совпадают с data.js / data-vilka.js — python3 инструменты/mkxlsx.py». `инструменты/README.md` — строка `mkxlsx.py` (три книги) и `mkdb.py` (vilka.db).

- [ ] **Step 7:** Run: `node --check app.js sw.js && python3 build.py >/dev/null && grep -c '"vilka.xlsx"' "Тетрадь аналитика.html"; git checkout "Тетрадь аналитика.html"` — Expected: число ≥ 1.

### Task 3: `checknums.js` — поля на базе «Вилки»

**Files:** Modify `инструменты/checknums.js`.

**Interfaces:** Produces — ключ содержимого урока `db: "vilka"`: `check` полей урока и его задач тренажёра идёт в `инструменты/vilka.db`, иначе в `shop.db`. Движок ключ не читает.

- [ ] **Step 1: Сценарий, который падает.** В конец первой части (`parsed` сценарии) не трогать; во вторую — временно в `content-m7.js` ещё нет уроков, поэтому проверка через тестовый вызов: добавить в `checkFields` третий аргумент `dbPath` и вызвать его до цикла по курсу:

```js
checkFields("самопроверка vilka.db", [{ label: "строк orders", hint: "-", check: "SELECT COUNT(*) FROM orders;", answer: 31387, tol: 0 }],
            path.join(__dirname, "vilka.db"));
```

Run: `node инструменты/checknums.js` — Expected до правки сигнатуры: ошибка (в `shop.db` в `orders` 215 строк → «в базе 215, в уроке 31387»).

- [ ] **Step 2: Правка.** `function checkFields(where, list, dbPath)`, внутри `execFileSync("sqlite3", [dbPath || db], …)`. В цикле по урокам: `const dbPath = C.db === "vilka" ? path.join(__dirname, "vilka.db") : db;` и передавать его в оба вызова `checkFields`. Комментарий в шапке: «урок с db: "vilka" сверяется с инструменты/vilka.db».

- [ ] **Step 3:** Run: `node инструменты/checknums.js` — Expected: зелёный, эталонов на 1 больше. Самопроверку оставить — она ловит пересборку `vilka.db` из чужого генератора.

### Task 4: Эталонный код и `checkvilka.py`

**Files:** Create `инструменты/checkvilka.py`. Modify `инструменты/ci.sh`, `инструменты/README.md`.

**Interfaces:** Consumes — `vilka.xlsx`; `window.VILKA_CODE` из `content-m7.js` (Task 5 создаёт файл, Tasks 6–9 наполняют): объект `{ load: str, clean: str, m7l2: str, m7l3: str, m7l4: str }`. Контракт: код этапа печатает по одной строке на поле урока в порядке `fields`, число — последним словом строки (`print(f"дублей: {n}")`). Produces — `python3 инструменты/checkvilka.py [python]`: для каждого `mNlK` из `VILKA_CODE` с уроком `kind: "sheet"` склеивает `load` + (`clean`, если этап не `m7l2`) + код этапа, запускает в временной папке рядом с копией `vilka.xlsx`, сравнивает числа с `answer ± tol` полей.

- [ ] **Step 1: Скрипт.**

```python
#!/usr/bin/env python3
"""Прогон эталонного кода модуля 7 (window.VILKA_CODE в content-m7.js).

    python3 инструменты/checkvilka.py                 # системный python
    python3 инструменты/checkvilka.py ~/.cache/analyst-notebook/bin/python   # pandas 2.2

Код этапа = load + clean (кроме 7.2) + код урока; печатает по строке на поле
урока, число — последнее слово. Сверка с answer ± tol полей урока."""
import json, pathlib, re, shutil, subprocess, sys, tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
PY = sys.argv[1] if len(sys.argv) > 1 else sys.executable
dump = subprocess.run(["node", "-e", r"""
const fs = require("fs"), vm = require("vm");
const ctx = { window: { SH: {}, CONTENT: {}, FIGS: {} } }; vm.createContext(ctx);
for (const f of ["content-core.js", "content-m7.js"]) vm.runInContext(fs.readFileSync(f, "utf8"), ctx);
const W = ctx.window, out = { code: W.VILKA_CODE, fields: {} };
for (const id in W.CONTENT) out.fields[id] = W.CONTENT[id].fields || null;
console.log(JSON.stringify(out));
"""], cwd=ROOT, capture_output=True, text=True, check=True).stdout
D = json.loads(dump)
code, bad, n = D["code"], [], 0
ver = subprocess.run([PY, "-c", "import pandas; print(pandas.__version__)"], capture_output=True, text=True).stdout.strip()
with tempfile.TemporaryDirectory() as tmp:
    shutil.copy(ROOT / "vilka.xlsx", tmp)
    for lid in sorted(k for k in code if re.fullmatch(r"m7l\d+", k)):
        fields = D["fields"].get(lid)
        if not fields:
            continue
        src = code["load"] + "\n" + ("" if lid == "m7l2" else code["clean"] + "\n") + code[lid]
        r = subprocess.run([PY, "-c", src], cwd=tmp, capture_output=True, text=True)
        if r.returncode:
            bad.append("%s: ошибка\n%s" % (lid, r.stderr.strip().splitlines()[-1]))
            continue
        lines = [l for l in r.stdout.splitlines() if l.strip()]
        if len(lines) != len(fields):
            bad.append("%s: напечатано %d строк, полей %d" % (lid, len(lines), len(fields)))
            continue
        for f, line in zip(fields, lines):
            n += 1
            got = float(line.split()[-1].replace(",", "."))
            if abs(got - f["answer"]) > f.get("tol", 0.5):
                bad.append("%s «%s»: код печатает %s, в уроке %s" % (lid, f["label"], got, f["answer"]))
if bad:
    sys.exit("pandas %s — ошибки:\n%s" % (ver, "\n".join(bad)))
print("pandas %s: эталонный код модуля 7 сходится, полей %d" % (ver, n))
```

- [ ] **Step 2:** Run: `python3 инструменты/checkvilka.py` — Expected сейчас: ошибка node (нет `content-m7.js`) — до Task 5. После Task 5 — «полей 0».

- [ ] **Step 3: CI и описание.** `ci.sh` после «Числовые ответы»:
```bash
step "Код модуля 7" "эталонный код Colab в content-m7.js не печатает числа полей (python3 инструменты/checkvilka.py)" python3 инструменты/checkvilka.py
```
`инструменты/README.md` — строка `checkvilka.py` с запуском на pandas 2.2 (`~/.cache/analyst-notebook/bin/python`).
Если в CI нет pandas или openpyxl для python — шаг пропускается с сообщением: сверить, как `ci.sh` делает это для `checkcheats.js`, и повторить тот же приём.

### Task 5: Модуль 7 в курсе

**Files:** Create `content-m7.js`. Modify `lessons.js`, `build.py:65-66`, `app.js:529` и `Route` (`app.js:2530-2541`), `content-m6.js` (`m6l6.intro`), `инструменты/checkskills.js`, скрипты с перечнем `content-m0…m6`, `README.md`, `ПРОГРЕСС.md`, `index.html`.

**Interfaces:** Produces — `window.CONTENT.m7l1 … m7l4` (Tasks 6–9), `window.VILKA_CODE` (Tasks 6–9 наполняют), модуль в `COURSE.modules`.

- [ ] **Step 1: Модуль в `lessons.js`** после модуля `m6`:

```js
    {
      id: "m7", num: 7, short: "Финальный проект", needs: ["m4"],
      title: "Финальный проект: тестовое задание",
      sub: "Незнакомая база, четыре–пять вечеров и всё сразу: SQL, pandas, A/B, дашборд и записка.",
      say: "так выглядит тестовое, которое пришлют после отклика",
      sayDone: "в портфолио — ноутбук, дашборд и записка на одной базе",
      weeks: "3–5 вечеров",
      lessons: [
        { id: "m7l1", title: "Техзадание и рабочее место", kind: "text", ready: true,
          desc: "письмо заказчика, Colab и план работы",
          say: "сначала вопросы, потом запросы",
          sayTask: "ответьте заказчику до того, как считать",
          sayDrills: "«Что спросить у Арины» — здесь решается половина тестового" },
        { id: "m7l2", title: "Качество данных", kind: "sheet", ready: true,
          desc: "дубли, тестовые аккаунты и отмены до любого расчёта",
          say: "грязная выгрузка — норма, а не исключение",
          sayTask: "почистить, сосчитать, записать, сколько выбросили",
          sayDrills: "«Сколько стоили дубли» — посчитайте, а не прикиньте" },
        { id: "m7l3", title: "SQL-выгрузка: GMV и выручка", kind: "sheet", ready: true,
          desc: "деньги ресторанов и деньги сервиса — разные числа",
          say: "GMV на слайде вместо выручки — частая ошибка тестового",
          sayTask: "одна чистая CTE, от неё все числа",
          sayDrills: "«Выручка или GMV» — проверьте, что подписано" },
        { id: "m7l4", title: "pandas: когорты и средний чек", kind: "sheet", ready: true,
          desc: "удержание по месяцам регистрации и чек на клиента",
          say: "когорта отвечает на вопрос, который выручка прячет",
          sayTask: "сначала таблица когорт, потом выводы",
          sayDrills: "«Знаменатель когорты» — тут теряют проценты" },
        { id: "m7l5", title: "A/B: бесплатная доставка", kind: "sheet", ready: false,
          desc: "конверсия выросла — а деньги?" },
        { id: "m7l6", title: "Дашборд проекта", kind: "sheet", ready: false,
          desc: "дашборд DataLens по чистым данным" },
        { id: "m7l7", title: "Записка заказчику", kind: "text", ready: false,
          desc: "решение по эксперименту и деньги" }
      ]
    }
```

Навык в `COURSE.skills` (после `sheets`): `{ id: "final", group: "Продукт", title: "Финальный проект", lessons: ["m7l1", "m7l2", "m7l3", "m7l4", "m7l5", "m7l6", "m7l7"] }`.

Ruling, вписанный в план: `needs: ["m4"]` вместо `["m3", "m4"]` из спецификации — m4 уже требует m3, вторая стрелка на карте лишняя.

- [ ] **Step 2: `content-m7.js`** — заготовка:

```js
/* Модуль 7 «Финальный проект»: тестовое задание «Вилки».
   Данные — vilka.xlsx (инструменты/gen_vilka.py → data-vilka.js → mkxlsx.py).
   Эталонный код Colab — window.VILKA_CODE: load + clean + код этапа;
   инструменты/checkvilka.py прогоняет его и сверяет с полями. */
window.CONTENT = window.CONTENT || {};
window.VILKA_CODE = {};
```

(сверить первые строки с `content-m6.js` — если там иначе объявляется `window.CONTENT`, повторить.)

- [ ] **Step 3: Списки файлов.** `build.py` `LAZY` — `"content-m7.js"` после `"content-m6.js"`. `app.js:529` `Offline.files` — то же. Найти остальные перечни: `grep -rn 'content-m6' app.js build.py sw.js инструменты .claude | grep -v '^content-m6.js'` — в каждом скрипте, который перебирает модули списком (а не `readdirSync` по маске), добавить m7. `checkskills.js` — ожидаемое число навыков 17 → 18.

- [ ] **Step 4: Конец курса.** `m6l6.intro` начинается «Последний урок курса — про то, что происходит после.» → «Урок про то, что происходит после курса.» (остальное без изменений). Найти другие «последний урок/модуль», «шесть модулей», «КУРС ЗАКОНЧЕН»: `grep -rn -i 'последний урок\|последний модуль\|шест[ьи] модул\|курс закончен\|[0-9][0-9] урок' README.md ПРОГРЕСС.md index.html content-m*.js app.js` — поправить счётчики (уроков станет 51 + 7 = 58, готовых — 55 в этом PR; модулей — 7 плюс вводный). Фраза «Это был последний модуль» (`app.js:2461`) — вычисляется сама, не трогать.

- [ ] **Step 5: Карта зависимостей (`Route`).** Прочитать `Route` целиком (`app.js` от `const Route` до функции рисования путей) и подобрать координаты m7 и изгиб стрелки `m4>m7` для `wide` и `tall` так, чтобы стрелка не проходила через узлы m5 и m6 и не сливалась со стрелками `m1>m4`, `m4>m6`, `m5>m6`. Кандидаты: wide — `m7: [1000, 100]`, `w: 1164`, `"m4>m7": ["t", "t", "mid"]` или узел над m6 `m7: [800, 10]` с `"m4>m7": ["r", "l", "hv"]`; tall — `m7: [202, 430]`, `h: 486`, обход справа. Решение — по скриншоту.
Run: devserver на свободном порту, главная на 1280 и 375 px, скриншоты карты. Expected: m7 виден, стрелка от m4 к m7 не пересекает узлы; ledger — Ruling с выбранными координатами.

- [ ] **Step 6:** Run: `node --check lessons.js content-m7.js app.js && node инструменты/checkorder.js && node инструменты/checkskills.js && python3 инструменты/checkvilka.py`
Expected: зелёные; `checkvilka` — «полей 0».

- [ ] **Step 7: Браузер.** Чистый origin: главная — модуль 7 в списке, 7.5–7.7 помечены как не готовые так же, как раньше помечались неготовые уроки; страница модуля `#toc-m7`; урок `#m7l1` открывается (пусть пока пустой); «Продолжить» и план на день не ведут в 7.5–7.7; итоговый тест модуля 7 не падает (если он строится из квизов — с вопросами 7.1–7.4). Expected: без ошибок в консоли.

### Task 6: Урок 7.1 «Техзадание и рабочее место» (`text`)

**Files:** Modify `content-m7.js`.

**Interfaces:** Produces — `window.VILKA_CODE.load` (чтение xlsx и SQLite в памяти), используемый Tasks 7–9 и `checkvilka.py`.

- [ ] **Step 1: Код загрузки** в `VILKA_CODE.load`:

```python
import sqlite3
import pandas as pd

sheets = pd.read_excel("vilka.xlsx", sheet_name=None)
con = sqlite3.connect(":memory:")
for name, df in sheets.items():
    df.to_sql(name, con, index=False)
orders, customers = sheets["orders"], sheets["customers"]
experiment, restaurants = sheets["experiment"], sheets["restaurants"]
```

Проверка контракта Review Focus 3: Run в `~/.cache/analyst-notebook/bin/python` и системном python из папки с копией `vilka.xlsx`: тот же код + `print(pd.read_sql("SELECT created_at FROM orders LIMIT 1", con).iloc[0, 0])` — Expected: `2025-01-01 HH:MM:SS` в обоих.

- [ ] **Step 2: Содержимое `m7l1`** по образцу текстового урока `m6l5` (`content-m6.js:4007-4180`: `intro, duration, plan, theory, ticket, schema, criteria, minCriteria, minWords, hints, reference, drills, quiz, cards, links`):
  - `intro` — тестовое как в компанию: незнакомая база, 3–5 вечеров, сдаётся ссылками;
  - `theory` — что проверяют в тестовом (вопросы до расчёта, чистка, подписанные числа, решение в первом абзаце); рабочее место: Google Colab («Файл → Создать блокнот», значок папки → «Загрузить», `vilka.xlsx`), код загрузки из `VILKA_CODE.load` в `<pre><code>` (экранировать `<` и `&`), как писать SQL: `pd.read_sql("""…""", con)`; как держать ноутбук для портфолио (разделы markdown, вывод первым); рекомендация «3–5 вечеров, этапы 7.2–7.7 по порядку»;
  - `ticket` — от «Арина, руководитель продукта «Вилки»»: выгрузка за январь–июнь 2025, вопросы: сколько зарабатываем и на чём, держатся ли клиенты, стоит ли раскатывать бесплатную доставку от 1500 ₽ после майского теста; комиссия — 20% от суммы заказа, плата за доставку — наша; срок — неделя;
  - задание: ответить Арине до начала расчётов — уточняющие вопросы, план этапов, сроки, допущения;
  - `schema` — четыре листа со столбцами и числом строк (`customers` 7030, `restaurants` 150, `orders` 31 387, `experiment` 4563), смысл полей, правила выручки и GMV;
  - `criteria` (`minCriteria: 4`, `minWords: 80`): вопросы заказчику (`уточн`, `вопрос`, `спрош`, `правильно ли я понимаю`), определение выручки (`выручк`, `комисси`, `доставк`, `gmv`), качество данных (`дубл`, `тестов`, `провер`, `чист`, `отмен`), план этапов (`sql`, `pandas`, `a/b`, `дашборд`, `записк`, `этап`), сроки (`день`, `вечер`, `срок`, `к пятниц`, `недел`), допущения (`допущ`, `предполаг`, `если`, `считаю, что`);
  - `hints` — три; `reference` — образцовый ответ Арине (6–9 предложений);
  - `drills` — 2 задачи `answer: "text"`: «Что спросить у Арины» (5 вопросов и зачем каждый), «Код загрузки упал» (ошибка `FileNotFoundError` в Colab — файл не загружен или загружен в другую папку);
  - `quiz` — 4 вопроса, `cards` — 4, `links` — документация Colab (загрузка файлов), `pandas.read_excel`, `DataFrame.to_sql`, `pandas.read_sql`.

- [ ] **Step 3:** Run: `node --check content-m7.js && node инструменты/checkcards.js && node инструменты/checkorder.js` — Expected: зелёные.

- [ ] **Step 4: Критерии в браузере.** `#m7l1`: образцовый ответ из `reference` (текст без HTML) даёт зачёт; ответ «нужно посчитать данные» 20 раз подряд — отказ. Как в ПРОГРЕСС.md (`window.__runText(id, text)`).

### Task 7: Урок 7.2 «Качество данных» (`sheet`)

**Files:** Modify `content-m7.js`.

**Interfaces:** Consumes — `VILKA_CODE.load`. Produces — `VILKA_CODE.clean` (чистые данные для 7.3–7.4) и `VILKA_CODE.m7l2`.

- [ ] **Step 1: Поля** (`db: "vilka"`, `file: "vilka.xlsx"`):

```js
  fields: [
    { label: "Строк-дублей в orders (лишних строк)", answer: 316, tol: 0,
      hint: "Строк 31 387, а разных order_id меньше: дубль — та же строка целиком. Нужна разница между числом строк и числом уникальных order_id.",
      check: "SELECT COUNT(*) - COUNT(DISTINCT order_id) FROM orders;" },
    { label: "Тестовых аккаунтов (platform = internal)", answer: 30, tol: 0,
      hint: "Посмотрите уникальные значения platform: кроме android, ios и web там есть служебное значение.",
      check: "SELECT COUNT(*) FROM customers WHERE platform = 'internal';" },
    { label: "Заказов тестовых аккаунтов (без дублей)", answer: 4524, tol: 0,
      hint: "Сначала уберите дубли, потом соедините с customers и оставьте internal.",
      check: "SELECT COUNT(DISTINCT o.order_id) FROM orders o JOIN customers c USING(customer_id) WHERE c.platform = 'internal';" },
    { label: "Доставленных заказов в чистых данных", answer: 24948, tol: 0,
      hint: "Три фильтра сразу: без дублей, без internal, status = delivered.",
      check: "SELECT COUNT(DISTINCT o.order_id) FROM orders o JOIN customers c USING(customer_id) WHERE c.platform <> 'internal' AND o.status = 'delivered';" }
  ],
```

Числа в `answer` — из прототипа; Step 3 сверит их с `vilka.db`.

- [ ] **Step 2: Код.** `VILKA_CODE.m7l2`:

```python
dups = len(orders) - orders["order_id"].nunique()
internal = customers.loc[customers["platform"] == "internal", "customer_id"]
uniq = orders.drop_duplicates()
print(f"строк-дублей: {dups}")
print(f"тестовых аккаунтов: {len(internal)}")
print(f"заказов тестовых аккаунтов: {uniq['customer_id'].isin(internal).sum()}")
clean = uniq[~uniq["customer_id"].isin(internal)]
print(f"доставленных в чистых данных: {(clean['status'] == 'delivered').sum()}")
```

`VILKA_CODE.clean`:

```python
internal = customers.loc[customers["platform"] == "internal", "customer_id"]
orders = orders.drop_duplicates()
orders = orders[~orders["customer_id"].isin(internal)]
customers = customers[customers["platform"] != "internal"]
experiment = experiment[~experiment["customer_id"].isin(internal)]
delivered = orders[orders["status"] == "delivered"].copy()
delivered["revenue"] = 0.2 * delivered["items_sum"] + delivered["delivery_fee"]
for name, df in (("orders", orders), ("customers", customers), ("experiment", experiment), ("delivered", delivered)):
    df.to_sql(name, con, index=False, if_exists="replace")
```

- [ ] **Step 3:** Run: `node инструменты/checknums.js && python3 инструменты/checkvilka.py && python3 инструменты/checkvilka.py ~/.cache/analyst-notebook/bin/python` — Expected: зелёные, у `checkvilka` «полей 4» на pandas 3.x и 2.2.

- [ ] **Step 4: Остальное содержимое** по образцу `m4l8` (`content-m4.js`, урок DataLens): `intro`; `duration ≈ 2 часа`; `plan`; `theory` — три вида грязи (дубли выгрузки, служебные аккаунты, статусы), как их искать (`nunique` против `len`, `value_counts` по `platform`, `drop_duplicates`), почему чистить до расчётов — с числами: выручка «Вилки» по всем строкам против чистой (посчитать запросом и вписать), доля заказов internal среди уникальных (4524 из 31 071); правило «записать, сколько выбросили»; `ticket` (Арина: «прежде чем считать, проверь выгрузку»); `schema` (листы, напоминание про `VILKA_CODE.load`); `hints` (3); `reference` — код `m7l2` и `clean` в `<pre><code>` с пояснениями; `drills` — 2 задачи `nums`: «Сколько стоили дубли» (выручка «Вилки» дублей: `SELECT ROUND(SUM(0.2*items_sum+delivery_fee),2)` по лишним строкам доставленных не-internal — запрос: сумма по всем строкам минус сумма по `DISTINCT`), «Internal в эксперименте» (`SELECT COUNT(*) FROM experiment e JOIN customers c USING(customer_id) WHERE c.platform='internal'` → 30); `quiz` 4, `cards` 4, `links` (pandas `drop_duplicates`, `nunique`).

- [ ] **Step 5:** Run: `node инструменты/checknums.js && node инструменты/checkcards.js && node инструменты/checkorder.js` — Expected: зелёные.

### Task 8: Урок 7.3 «SQL-выгрузка: GMV и выручка» (`sheet`)

**Files:** Modify `content-m7.js`.

**Interfaces:** Consumes — `VILKA_CODE.load`, `VILKA_CODE.clean` (таблица `delivered` в SQLite с `revenue`). Produces — `VILKA_CODE.m7l3`.

- [ ] **Step 1: Поля** (`check` — на сырых таблицах `vilka.db` с той же чисткой в CTE; `answer` — заполнить выводом `check`, округление как в `ROUND`):

```js
const V73 = "WITH o AS (SELECT DISTINCT o.* FROM orders o JOIN customers c USING(customer_id) WHERE c.platform <> 'internal'), d AS (SELECT * FROM o WHERE status = 'delivered') ";
```

(в `check` подставить строку целиком, без переменной — `checknums` читает поле как есть; `V73` здесь только для плана):

1. «GMV за июнь 2025, ₽», `tol: 1` — `… SELECT SUM(items_sum) FROM d WHERE substr(created_at, 1, 7) = '2025-06';`
2. «Выручка «Вилки» за июнь 2025, ₽», `tol: 1` — `… SELECT ROUND(SUM(0.2 * items_sum + delivery_fee), 2) FROM d WHERE substr(created_at, 1, 7) = '2025-06';`
3. «Доля отменённых заказов за полугодие, %», `unit: "%"`, `tol: 0.06` — `… SELECT ROUND(100.0 * SUM(status = 'cancelled') / COUNT(*), 2) FROM o;`
4. «Доля Москвы в выручке «Вилки» за полугодие, %», `unit: "%"`, `tol: 0.06` — `… SELECT ROUND(100.0 * SUM(CASE WHEN c.city = 'Москва' THEN 0.2*items_sum + delivery_fee END) / SUM(0.2*items_sum + delivery_fee), 2) FROM d JOIN customers c USING(customer_id);`
5. «Средний чек доставленного заказа за полугодие, ₽», `tol: 0.5` — `… SELECT ROUND(AVG(items_sum), 2) FROM d;`

Подсказки называют ошибку по числу: GMV вместо выручки (число ≈ в 5 раз больше), дубли и internal (число больше на N), отмены в выручке, город ресторана против города клиента (`restaurants.city` — проверить запросом, совпадают ли; если совпадают всегда, подсказку про это не писать).

- [ ] **Step 2: Вписать `answer`.** Run каждый `check` в `sqlite3 инструменты/vilka.db` и вписать результат. Run: `node инструменты/checknums.js` — Expected: зелёный.

- [ ] **Step 3: Код** `VILKA_CODE.m7l3` — тот же расчёт через `pd.read_sql` на таблице `delivered` / `orders` после `clean`; пять `print(f"…: {x:.2f}")` в порядке полей. Run: `python3 инструменты/checkvilka.py && python3 инструменты/checkvilka.py ~/.cache/analyst-notebook/bin/python` — Expected: «полей 9».

- [ ] **Step 4: Содержимое урока** по образцу Task 7 Step 4: теория — GMV против выручки сервиса (с числами июня), одна CTE чистки и всё от неё, выручка по месяцам (`substr(created_at,1,7)`), доли со знаменателем; тикет («сколько зарабатываем и где»); тренажёр 2 `nums` (выручка «Вилки» за январь; месяц с наибольшим числом доставленных заказов — ответ числом заказов), квиз 4, карточки 4, ссылки (SQLite `strftime`/`substr`, `pandas.read_sql`).

- [ ] **Step 5:** Run: `node инструменты/checknums.js && node инструменты/checkcards.js && node инструменты/checkorder.js` — Expected: зелёные.

### Task 9: Урок 7.4 «pandas: когорты и средний чек» (`sheet`)

**Files:** Modify `content-m7.js`.

**Interfaces:** Consumes — `VILKA_CODE.load`, `VILKA_CODE.clean`. Produces — `VILKA_CODE.m7l4`.

- [ ] **Step 1: Поля** (`check` на `vilka.db`; `answer` из вывода):
1. «Клиентов в мартовской когорте (регистрация в марте 2025)», `tol: 0` — `SELECT COUNT(*) FROM customers WHERE platform <> 'internal' AND substr(signup_date,1,7) = '2025-03';`
2. «Удержание M1 мартовской когорты, %» — доля клиентов мартовской когорты с доставленным заказом в апреле 2025: `WITH c AS (SELECT customer_id FROM customers WHERE platform <> 'internal' AND substr(signup_date,1,7)='2025-03') SELECT ROUND(100.0 * COUNT(DISTINCT o.customer_id) / (SELECT COUNT(*) FROM c), 2) FROM orders o JOIN c USING(customer_id) WHERE o.status='delivered' AND substr(o.created_at,1,7)='2025-04';`, `unit: "%"`, `tol: 0.06`
3. «Удержание M1 январской когорты, %» — то же для января → февраля.
4. «Средняя выручка «Вилки» на клиента за полугодие, ₽» — сумма выручки чистых доставленных / все не-internal клиенты (7000): `WITH d AS (SELECT DISTINCT o.* FROM orders o JOIN customers c USING(customer_id) WHERE c.platform <> 'internal' AND o.status='delivered') SELECT ROUND(SUM(0.2*items_sum+delivery_fee) / (SELECT COUNT(*) FROM customers WHERE platform <> 'internal'), 2) FROM d;`, `tol: 0.5`

Подсказки: знаменатель когорты — все зарегистрированные, а не заказавшие; месяц заказа — календарный, не «30 дней»; ARPU делится на 7000, а не на заказавших.

- [ ] **Step 2: Вписать `answer`** запуском `check`; `node инструменты/checknums.js` — зелёный.

- [ ] **Step 3: Код** `VILKA_CODE.m7l4` на pandas (`dt.to_period("M")`, `groupby`, таблица когорт `pivot_table` — печатать только четыре числа полей). Run `checkvilka.py` на обоих pandas — Expected: «полей 13».

- [ ] **Step 4: Содержимое урока**: теория — когорта по месяцу регистрации, M1 как доля когорты, таблица когорт (печатать её в уроке нельзя — текстовые Series/DataFrame с подписью dtype; показывать числами в тексте), средний чек против выручки на клиента; тренажёр 2 `nums` (размер январской когорты; M1 апрельской когорты), квиз 4, карточки 4, ссылки (`Series.dt.to_period`, `pivot_table`).

- [ ] **Step 5:** Run: `node инструменты/checknums.js && node инструменты/checkcards.js && node инструменты/checkorder.js && python3 инструменты/checkvilka.py ~/.cache/analyst-notebook/bin/python` — Expected: зелёные.

### Task 10: Числа в ПРОГРЕСС.md

- [ ] **Step 1:** Раздел «Ключевые числа модуля 7»: блок «Проверенные числа генератора», числа полей 7.2–7.4 и чисел из теорий с запросами (`sqlite3 инструменты/vilka.db`) и командами проверки (`gen_vilka.py --check`, `checkvilka.py` на двух pandas). В «Сводке курса» — строка модуля 7 (7 уроков, 4 готовы).

### Task 11: Проверка целиком

- [ ] **Step 1:** Run: `bash инструменты/ci.sh` — Expected: всё зелёное, кроме «Всё пересобрано» и «Версия сайта».
- [ ] **Step 2: Браузер** на чистом origin: главная и карта (1280 и 375 px), `#toc-m7`, уроки 7.1–7.4 открываются, «Скачать данные · vilka.xlsx» отдаёт ≈ 1,4 МБ, верные числа засчитывают, одно неверное — подсказка; 7.5–7.7 не ведут в пустоту; нет горизонтальной прокрутки на 375 px.
- [ ] **Step 3: Офлайн:** `python3 build.py`, файл открывается, `#m7l2` → «Скачать данные» отдаёт data:-ссылку; `git checkout "Тетрадь аналитика.html"`.
- [ ] **Step 4: Ревью параллельно:** `lesson-reviewer` (диф), `student-walkthrough` (уроки 7.1–7.4, ученик видит базу впервые и работает в Colab), `engine-reviewer` (`app.js`, `build.py`, `lessons.js`). Замечания — одним проходом, затем Step 1 снова.
- [ ] **Step 5 (после «Давай»):** коммит содержания — все файлы задач, спецификация и план, без `docs/ПЛАН-УЛУЧШЕНИЙ.md`; `bash инструменты/release.sh "Финальный проект: уроки 7.1–7.4" --trailer "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`; PR в `main`.
