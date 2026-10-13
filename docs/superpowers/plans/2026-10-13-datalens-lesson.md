# Урок BI в DataLens — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** урок `m4l8` «BI на практике: дашборд в DataLens» (4.7) — ученик собирает дашборд в DataLens по `app-journal.xlsx` и вводит числа с него, курс сверяет.

**Architecture:** готовый вид урока `kind: "sheet"` (как `m6l7`): кнопка «Скачать данные», поля `fields` с `check`-запросами, тренажёр `answer: "nums" | "text"`. Новый файл `app-journal.xlsx` собирает `инструменты/mkxlsx.py`; имя файла дописывается туда, где уже перечислен `delta-market.xlsx`. Новой механики в движке нет.

**Tech Stack:** чистый JS без сборщика, Python 3 + openpyxl 3.1.5, sqlite3 (`инструменты/shop.db`), Node для проверок.

**Spec:** `docs/superpowers/specs/2026-10-13-datalens-lesson-design.md`

## Global Constraints

- `id` уроков не меняются; новые `id` — `m4l8`. В `steps`, `practicum.steps`, `cards` новое только в конец (у нового урока массивы новые — ограничение касается чужих).
- Каждое число в тексте урока проверено запросом к `инструменты/shop.db`; рецепт и числа — в `ПРОГРЕСС.md`.
- Тон: без восклицаний, каждое утверждение с числом и знаменателем.
- `Тетрадь аналитика.html` руками не правится — его собирает `build.py` в коммите выпуска.
- Правки только на ветке `datalens` (хук запрещает Edit/Write на `main`).
- Коммит и PR — только с согласия владельца (слово «Давай»). Шаги «Commit» ниже выполняются одним коммитом содержания в конце, после согласия.
- Скриншотов DataLens нет; интерфейс — две SVG-схемы и пути меню из документации Яндекса.
- Пути меню сверять с yandex.cloud/ru/docs/datalens (подключение к файлу, датасеты, вычисляемые поля, селекторы, связи на дашборде, публикация). Firecrawl в этой сессии упёрся в лимит — читать через `curl -s URL` и вырезать текст.

## Review Focus

1. Ученик вводит ARPU, посчитанный по inner-связи (5570,15 вместо 753,64 для paid_search) — подсказка поля должна назвать именно эту ошибку. Покрыто `hint` поля 3, проверка — Task 2, шаг 4.
2. Ученик вводит MAU июня с несвязанным селектором (1072 вместо 381 для ios) — подсказка поля 5 называет связи на дашборде. Task 2.
3. Офлайн-файл: кнопка «Скачать данные» в собранном `Тетрадь аналитика.html` отдаёт `app-journal.xlsx` из `window.FILES`, а не 404. Task 1 шаг 6 + Task 7.
4. Нумерация: в меню и карте 4.7 — новый урок, 4.8 — записка; ссылки «урок 4.7» в текстах указывают на записку и сдвинуты. Task 5.
5. Ученик без Яндекс ID — урок прямо пишет, что он нужен, до скачивания файла (в `schema` и первом абзаце теории). Task 2 / Task 3, проверяет `student-walkthrough`.

## Проверенные числа (shop.db, проверено 2026-10-13)

```
app_users 4000 (регистрации 2024-01-01…2024-06-30), app_activity 28 567, app_orders 2027
выручка всего 7 369 360 ₽, платящих 888 из 4000 = 22,2%
MAU: май 1053 (строк 4666), июнь 1072 (строк 5016); июнь ios 381
DAU июня = 5016 / 30 = 167,2; DAU/MAU июня = 15,60%
ARPU по каналу (выручка / все пользователи канала) против ARPPU (inner-связь):
  paid_search 753,64 / 5570,15 (983 польз.); social 728,47 / 6379,05 (648);
  referral 3802,67; organic 2829,11; email 1963,54; partner 1271,43
ARPU referral при android: 4280,72 (250 польз.)
доля платящих по месяцу регистрации: 01 26,76; 02 26,54; 03 22,49; 04 20,44; 05 18,26; 06 21,05
  среднее шести долей 22,59 против общей 22,2
users ⋈ orders ⋈ activity в одном датасете: SUM(revenue) = 210 071 600 (в 28,5 раза больше)
```

## Файлы

- Modify: `инструменты/mkxlsx.py` — две книги вместо одной.
- Create: `app-journal.xlsx` (генерируется).
- Modify: `build.py:91-92` (`window.FILES`), `app.js:529` (офлайн-список), `инструменты/ci.sh:113` (текст шага), `инструменты/README.md:20`.
- Modify: `lessons.js` (урок между `m4l6` и `m4l7`, навык `case`).
- Modify: `content-m4.js` — новый `window.CONTENT.m4l8` после `m4l6`, перед `m4l7`; схемы `window.FIGS[...]` — через `figs.py`.
- Modify: `content-m6.js:3350, 3548` — «урок 4.7» → «урок 4.8».
- Modify: `ПРОГРЕСС.md` (числа урока, 96 и 347 — «4.7» → «4.8»), `README.md` (если перечисляет уроки модуля 4 или файлы xlsx).
- Modify: `инструменты/figs.py` (две схемы, через агента `figure-builder`).

---

### Task 1: Файл `app-journal.xlsx`

**Files:** Modify `инструменты/mkxlsx.py`, `build.py`, `app.js:529`, `инструменты/ci.sh:113`, `инструменты/README.md:20`. Create `app-journal.xlsx`.

**Interfaces:** Produces — файл `app-journal.xlsx` в корне (листы `app_users`, `app_activity`, `app_orders`), ключ `"app-journal.xlsx"` в `window.FILES`; Task 2 ссылается на него `file: "app-journal.xlsx"`.

- [ ] **Step 1: Проверка, которая падает.** Сначала научить `--check` сверять обе книги (Step 3), затем запустить его до сборки файла.

- [ ] **Step 2: Переписать сборку на список книг.** В `mkxlsx.py` вместо `OUT` и одного `build()`:

```python
BOOKS = {
    "delta-market.xlsx": (
        ("orders", "ordersCSV", (int, int, day, float, str), ((3, "yyyy-mm-dd"), (4, "0.00"))),
        ("users", "usersCSV", (int, day, str, str, str), ((2, "yyyy-mm-dd"),)),
        ("leads", "leadsCSV", None, ()),   # как есть: текст, пустые — пустые
    ),
    "app-journal.xlsx": (
        ("app_users", "appUsersCSV", (int, day, str, str, str), ((2, "yyyy-mm-dd"),)),
        ("app_activity", "appActivityCSV", (int, day), ((2, "yyyy-mm-dd"),)),
        ("app_orders", "appOrdersCSV", (int, day, float), ((2, "yyyy-mm-dd"), (3, "0.00"))),
    ),
}


def build(sheets):
    wb = Workbook()
    wb.properties.creator = "Тетрадь аналитика"
    wb.properties.created = wb.properties.modified = STAMP
    wb.remove(wb.active)
    for name, key, cast, fmts in sheets:
        data = rows(key)
        ws = wb.create_sheet(name)
        ws.append(data[0])
        for c in ws[1]:
            c.font = Font(bold=True)
        for r in data[1:]:
            ws.append([f(v) for f, v in zip(cast, r)] if cast else [v if v != "" else None for v in r])
        for col, fmt in fmts:
            for (c,) in ws.iter_rows(min_row=2, min_col=col, max_col=col):
                c.number_format = fmt
        ws.freeze_panes = "A2"
        ws.auto_filter.ref = ws.dimensions
    # дальше без изменений: raw → out с фиксированными датами zip, return out.getvalue()
```

`__main__`:

```python
if __name__ == "__main__":
    stale = []
    for name, sheets in BOOKS.items():
        out, blob = ROOT / name, build(sheets)
        if "--check" in sys.argv:
            if not out.exists() or parts(out.read_bytes()) != parts(blob):
                stale.append(name)
            else:
                print("%s совпадает с data.js" % name)
        else:
            out.write_bytes(blob)
            print("Готово: %s — %.0f КБ" % (name, out.stat().st_size / 1024))
    if stale:
        sys.exit("%s устарел: python3 инструменты/mkxlsx.py" % ", ".join(stale))
```

Docstring: «Собирает delta-market.xlsx (урок 6.5) и app-journal.xlsx (урок 4.7) из data.js», абзац про листы журнала: даты — датами Excel, `revenue` — числом.

- [ ] **Step 3: Запустить проверку до сборки.**
Run: `python3 инструменты/mkxlsx.py --check`
Expected: `delta-market.xlsx совпадает с data.js`, затем выход с `app-journal.xlsx устарел…`, код 1. Если `delta-market.xlsx` тоже «устарел» — рефакторинг сломал старую книгу, чинить до продолжения.

- [ ] **Step 4: Собрать и проверить.**
Run: `python3 инструменты/mkxlsx.py && python3 инструменты/mkxlsx.py --check && ls -la app-journal.xlsx`
Expected: обе книги «совпадает», размер ≈ 450 КБ; повторный запуск `mkxlsx.py` не меняет `git diff --stat delta-market.xlsx` (пусто).

- [ ] **Step 5: Имя файла в сборке, офлайне и CI.**
`build.py`:
```python
files = "<script>\nwindow.FILES = %s;\n</script>\n" % json.dumps(
    {n: data_uri(n, XLSX) for n in ("delta-market.xlsx", "app-journal.xlsx")})
```
`app.js:529` — `"delta-market.xlsx", "app-journal.xlsx",` в списке `own`. Комментарий над `Files` (`app.js:286`): «Файлы для скачивания (xlsx уроков 4.7 и 6.5)». `ci.sh:113`: `step "Файлы xlsx" "delta-market.xlsx или app-journal.xlsx не совпадает с data.js — запустите python3 инструменты/mkxlsx.py и закоммитьте файлы" python3 инструменты/mkxlsx.py --check`. `инструменты/README.md:20` — описание обеих книг. `sw.js:107` — комментарий упоминает xlsx в общем виде; если называет только delta-market, дописать «или app-journal.xlsx».

- [ ] **Step 6: Проверить сборку.**
Run: `python3 build.py >/dev/null && grep -c 'app-journal.xlsx' "Тетрадь аналитика.html" && git checkout "Тетрадь аналитика.html"`
Expected: число ≥ 1; собранный файл возвращается к версии ветки (пересборка — в коммите выпуска).

### Task 2: Каркас урока и основная задача

**Files:** Modify `lessons.js`, `content-m4.js`.

**Interfaces:** Consumes — `app-journal.xlsx` (Task 1). Produces — `window.CONTENT.m4l8` с ключами `intro, duration, plan, file, theory, ticket, schema, fields, hints, reference, drills, quiz, cards, links` (порядок и формат — как у `m6l7`, `content-m6.js:3645-4006`); Task 3 заполняет `theory`, Task 4 — `drills, quiz, cards, links`.

- [ ] **Step 1: Урок в карте курса.** `lessons.js`, между `m4l6` и `m4l7`:

```js
        { id: "m4l8", title: "BI на практике: дашборд в DataLens", kind: "sheet", ready: true,
          desc: "собрать дашборд из 4.6 руками и сверить числа",
          say: "дашборд, собранный руками, — строка в резюме",
          sayTask: "сначала датасет и связи, потом чарты",
          sayDrills: "«Выручка в 28 раз больше» — здесь спотыкаются почти все" },
```

Навык `case`: `lessons: ["m4l1", "m4l6", "m4l8", "m4l7", "m6l5"]`.

- [ ] **Step 2: Поля задачи — до остального текста.** В `content-m4.js` после объекта `m4l6` вставить `window.CONTENT.m4l8 = { … }` с `file: "app-journal.xlsx"`, `theory: ""` (временно, заполнит Task 3), `drills: [], quiz: [], cards: [], links: []` и полями:

```js
  fields: [
    { label: "Выручка за весь период (индикатор)", unit: "₽", answer: 7369360, tol: 1,
      hint: "Если число больше в десятки раз — в одном датасете связаны и заказы, и активность: каждая строка заказа повторилась по числу дней активности. Индикатор строится по датасету «пользователи + заказы».",
      check: "SELECT ROUND(SUM(revenue), 2) FROM app_orders;" },
    { label: "MAU за июнь 2024", answer: 1072, tol: 0,
      hint: "5016 — это строки активности, а не люди: нужна агрегация «Количество уникальных» (COUNTD), а дата — с группировкой по месяцу.",
      check: "SELECT COUNT(DISTINCT user_id) FROM app_activity WHERE activity_date BETWEEN '2024-06-01' AND '2024-06-30';" },
    { label: "ARPU канала paid_search", unit: "₽", answer: 753.64, tol: 0.5,
      hint: "5570,15 — выручка на платящего: при inner-связи пользователи без заказов выпали из знаменателя. Связь app_users → app_orders должна быть левой, а в формуле — COUNTD по user_id из app_users.",
      check: "SELECT ROUND((SELECT SUM(o.revenue) FROM app_orders o JOIN app_users u USING(user_id) WHERE u.channel = 'paid_search') * 1.0 / (SELECT COUNT(*) FROM app_users WHERE channel = 'paid_search'), 2);" },
    { label: "ARPU канала referral при селекторе «android»", unit: "₽", answer: 4280.72, tol: 0.5,
      hint: "3802,67 — ARPU по всем платформам: селектор не применился к таблице. Проверьте, что селектор и таблица — на одном датасете или связаны в настройке «Связи».",
      check: "SELECT ROUND((SELECT SUM(o.revenue) FROM app_orders o JOIN app_users u USING(user_id) WHERE u.channel = 'referral' AND u.platform = 'android') * 1.0 / (SELECT COUNT(*) FROM app_users WHERE channel = 'referral' AND platform = 'android'), 2);" },
    { label: "MAU за июнь 2024 при селекторе «ios»", answer: 381, tol: 0,
      hint: "Если осталось 1072 — селектор стоит на датасете «пользователи + заказы» и не связан с линией MAU из второго датасета. Свяжите поле platform двух датасетов в «Связях» дашборда.",
      check: "SELECT COUNT(DISTINCT a.user_id) FROM app_activity a JOIN app_users u USING(user_id) WHERE u.platform = 'ios' AND a.activity_date BETWEEN '2024-06-01' AND '2024-06-30';" },
    { label: "Доля платящих среди зарегистрированных в марте 2024", unit: "%", answer: 22.49, tol: 0.06,
      hint: "Знаменатель — все 667 зарегистрированных в марте, числитель — те из них, у кого есть хотя бы один заказ: COUNTD(user_id из app_orders) / COUNTD(user_id из app_users), месяц — по signup_date.",
      check: "SELECT ROUND(100.0 * SUM(user_id IN (SELECT user_id FROM app_orders)) / COUNT(*), 2) FROM app_users WHERE signup_date BETWEEN '2024-03-01' AND '2024-03-31';" }
  ],
```

- [ ] **Step 3: Запустить проверку полей.**
Run: `node инструменты/checknums.js`
Expected: без ошибок, «эталонов полей» больше прежнего на 6. Если `check` расходится с `answer` — пересчитать, а не подгонять допуск.

- [ ] **Step 4: Ловушки в подсказках действительно дают названные числа.**
Run:
```bash
sqlite3 инструменты/shop.db "SELECT ROUND(SUM(o.revenue)*1.0/COUNT(DISTINCT o.user_id),2) FROM app_orders o JOIN app_users u USING(user_id) WHERE u.channel='paid_search'; SELECT COUNT(*) FROM app_activity WHERE activity_date BETWEEN '2024-06-01' AND '2024-06-30'; SELECT ROUND(SUM(o.revenue)*1.0/(SELECT COUNT(*) FROM app_users WHERE channel='referral'),2) FROM app_orders o JOIN app_users u USING(user_id) WHERE u.channel='referral'; SELECT COUNT(*) FROM app_users WHERE signup_date BETWEEN '2024-03-01' AND '2024-03-31';"
```
Expected: `5570.15`, `5016`, `3802.67`, `667`.

- [ ] **Step 5: Остальное вокруг задачи.** По образцу `m6l7` (`content-m6.js:3645-3812`):
  - `intro` — одна фраза о том, что дашборд из 4.6 теперь собирается руками;
  - `duration: "≈ 2,5 часа"`, `plan` — 35 / 60 / 35 / 10 / 5 мин (теория и карточки; задача: дашборд и шесть чисел; тренажёр: пять разборов; самопроверка; заметки);
  - `ticket` — от «Олег, продакт»: к планёрке нужен дашборд по журналу приложения за январь–сентябрь 2024 и шесть чисел для слайда; список чартов из спецификации (индикатор выручки, MAU по месяцам, выручка по каналам, таблица ARPU по каналам, доля платящих по месяцу регистрации, селектор «Платформа» на все чарты); строка «Задание» и формат ввода, как в 6.5;
  - `schema` — листы и столбцы с числом строк; ключ `user_id`; регистрации только январь–июнь, активность и заказы до 30 сентября; два датасета: «пользователи + заказы» (левая связь) и «пользователи + активность» (левая связь) и почему не один — 210 071 600 против 7 369 360; путь «Подключения → Создать подключение → Файлы → Загрузить файлы»; «нужен Яндекс ID, тариф Community бесплатный»; «Как проверяется задание» — как в 6.5;
  - `hints` — три: (1) подключение и два датасета; (2) вычисляемое поле `ARPU = SUM([revenue]) / COUNTD([user_id])` с `user_id` из `app_users`; (3) селектор и «Связи» между датасетами;
  - `reference` — пошаговый разбор: подключение, два датасета со связями, шесть чартов (тип, что куда в X/Y/Цвет/Фильтры), формулы вычисляемых полей, селектор и связи, где на дашборде видно каждое из шести чисел. Под разбором — `<h3>Чек-лист дашборда</h3>` и `<ul>` из 9 пунктов: заголовок отвечает на вопрос; сверху главное число; подписан период; у доли рядом знаменатель; не больше 6–7 элементов; одна ось — одна единица; селектор действует на все чарты; даты сгруппированы по месяцу там, где сравниваются месяцы; публичная ссылка — только на учебные данные.

- [ ] **Step 6: Урок открывается.** Run: `node инструменты/checkorder.js && node инструменты/checkskills.js && node инструменты/checknums.js`
Expected: всё зелёное; `checkorder` не видит сдвигов ключей прогресса.

### Task 3: Теория

**Files:** Modify `content-m4.js` (`m4l8.theory`), `ПРОГРЕСС.md`.

**Interfaces:** Consumes — объект `m4l8` (Task 2). Produces — в теории места для схем `<figure class="fig" data-fig="bi-chain"><figcaption>Рис. …</figcaption></figure>` и то же с `data-fig="bi-chart-editor"` (так вставлена `dash-pyramid`, `content-m4.js:3746`); Task 6 рисует схемы с этими именами.

- [ ] **Step 1: Сверить пути меню по документации.**
Run (по одному на страницу): `curl -s https://yandex.cloud/ru/docs/datalens/operations/connection/create-file | python3 -c "import sys,re,html;t=re.sub(r'<[^>]+>',' ',sys.stdin.read());print(html.unescape(re.sub(r'\s+',' ',t))[:6000])"` для страниц: `operations/connection/create-file`, `dataset/create-dataset` (или найденная по разделу «Датасеты»), `concepts/calculations/index`, `operations/dashboard/add-selector`, `concepts/dashboard#links` (связи), `concepts/datalens-public` (публикация). Выписать точные названия кнопок и разделов в черновик.

- [ ] **Step 2: Написать теорию** по разделам спецификации («Устройство урока → Теория», пункты 1–5): `<p class="lead">` с «нужен Яндекс ID, тариф Community бесплатный, кнопка «Скачать данные» — в разделе «Основная задача»»; четыре объекта и схема `bi-chain`; датасет (левая против inner: ARPU paid_search 753,64 против 5570,15 — в 7,4 раза; измерения и показатели; `COUNTD` = `COUNT(DISTINCT)`, `SUM`, `AVG`; вычисляемые поля); редактор чарта и схема `bi-chart-editor`; дашборд (селекторы, «Связи», публичная ссылка и запрет на рабочие данные); пять ловушек с числами из блока «Проверенные числа»: `COUNT` против `COUNTD` (5016 против 1072), inner-связь (5570,15 против 753,64), три листа в одном датасете (210 071 600 против 7 369 360), среднее от средних (22,59% против 22,2% — 888 из 4000), день вместо месяца (линия из 274 точек вместо 9), несвязанный селектор (1072 против 381). Оговорка про меняющийся интерфейс — одной фразой. Тон — без восклицаний, у доли — знаменатель.

- [ ] **Step 3: Проверить «274 точки».**
Run: `sqlite3 инструменты/shop.db "SELECT COUNT(DISTINCT activity_date) FROM app_activity;"`
Expected: 274 (проверено при написании плана).

- [ ] **Step 4: Числа в ПРОГРЕСС.md.** Новый пункт рядом с числами модуля 4 (около строки 337): блок «4.7 DataLens» — копия блока «Проверенные числа» этого плана и запросы, которыми они получены.

- [ ] **Step 5:** Run: `node --check content-m4.js && node инструменты/checkorder.js` — Expected: без ошибок.

### Task 4: Тренажёр, квиз, карточки, ссылки

**Files:** Modify `content-m4.js` (`m4l8.drills, quiz, cards, links`).

**Interfaces:** Consumes — объект `m4l8`. Формат задач — как в `content-m6.js:3814-4006`; в уроке `sheet` задача только `answer: "nums"` или `answer: "text"` (проверяет `checknums.js`).

- [ ] **Step 1: Пять задач тренажёра.**

```js
  drills: [
    { title: "COUNT вместо COUNTD", level: "easy", answer: "nums",
      body: `<p>Коллега собрал линию MAU, и за май на ней 4666. В SQL-отчёте за тот же месяц — около тысячи. Какое число должно стоять на линии за май 2024?</p>`,
      fields: [{ label: "MAU за май 2024", answer: 1053, tol: 0,
        hint: "4666 — строки app_activity за май: один человек даёт столько строк, сколько дней заходил. Агрегация — «Количество уникальных».",
        check: "SELECT COUNT(DISTINCT user_id) FROM app_activity WHERE activity_date BETWEEN '2024-05-01' AND '2024-05-31';" }],
      solution: `Показатель: user_id, агрегация «Количество уникальных» (COUNTD).\nX: activity_date, группировка «Месяц».\nМай 2024: 1053 уникальных пользователя из 4666 строк.`,
      note: "COUNTD в DataLens — то же, что <code>COUNT(DISTINCT user_id)</code> в SQL." },
    { title: "ARPU по одним платящим", level: "mid", answer: "nums",
      body: `<p>В таблице «ARPU по каналам» у social стоит 6379,05 ₽. Маркетинг радуется: канал окупается. Какое ARPU канала social на самом деле?</p>`,
      fields: [{ label: "ARPU канала social", unit: "₽", answer: 728.47, tol: 0.5,
        hint: "6379,05 — выручка на платящего: inner-связь оставила только пользователей с заказами. В знаменателе — все 648 пользователей канала.",
        check: "SELECT ROUND((SELECT SUM(o.revenue) FROM app_orders o JOIN app_users u USING(user_id) WHERE u.channel = 'social') * 1.0 / (SELECT COUNT(*) FROM app_users WHERE channel = 'social'), 2);" }],
      solution: `Связь app_users → app_orders: левая.\nARPU = SUM([revenue]) / COUNTD([user_id]) — user_id из app_users.\nsocial: 472 050 ₽ / 648 = 728,47 ₽.`,
      note: "6379,05 ₽ — ARPPU, тоже полезная метрика, но подписанная своим именем." },
    { title: "DAU и липкость за июнь", level: "mid", answer: "nums",
      body: `<p>Продакт просит добавить на дашборд средний DAU за июнь 2024 и отношение DAU/MAU за тот же месяц (урок 4.4).</p>`,
      fields: [
        { label: "Средний DAU за июнь 2024", answer: 167.2, tol: 0.1,
          hint: "Сначала уникальные пользователи по дням (группировка «День»), потом среднее по 30 дням июня — 5016 строк / 30.",
          check: "SELECT ROUND(COUNT(*) * 1.0 / 30, 1) FROM app_activity WHERE activity_date BETWEEN '2024-06-01' AND '2024-06-30';" },
        { label: "DAU/MAU за июнь 2024", unit: "%", answer: 15.6, tol: 0.06,
          hint: "Средний DAU делится на MAU июня — 1072, не на 4000 пользователей базы.",
          check: "SELECT ROUND(100.0 * COUNT(*) / 30 / (SELECT COUNT(DISTINCT user_id) FROM app_activity WHERE activity_date BETWEEN '2024-06-01' AND '2024-06-30'), 2) FROM app_activity WHERE activity_date BETWEEN '2024-06-01' AND '2024-06-30';" }
      ],
      solution: `DAU по дням июня: COUNTD(user_id), X — activity_date с группировкой «День».\nСредний DAU = 5016 / 30 = 167,2.\nDAU/MAU = 167,2 / 1072 = 15,60%.`,
      note: "В app_activity одна строка на пользователя и день, поэтому сумма DAU за месяц равна числу строк." },
    { title: "Выручка в 28 раз больше", level: "mid", answer: "text",
      body: `<p>Индикатор выручки показывает 210 071 600 ₽, хотя в выгрузке заказов 7 369 360 ₽. Датасет один: app_users, к нему левой связью app_orders и app_activity. Объясните, откуда взялось число и как собрать датасеты.</p>`,
      solution: `Связь по user_id с двумя таблицами «многие» даёт все пары «заказ × день активности» одного пользователя.\nКаждый заказ повторился столько раз, сколько дней пользователь заходил: 210 071 600 / 7 369 360 ≈ 28,5.\nРешение: два датасета — «пользователи + заказы» и «пользователи + активность», селектор связать в «Связях» дашборда.`,
      note: "То же, что JOIN двух таблиц «многие» в SQL из урока 1.4: строки множатся, SUM растёт." },
    { title: "Селектор не действует", level: "hard", answer: "text",
      body: `<p>На дашборде селектор «Платформа» стоит на ios. Выручка по каналам изменилась, а линия MAU за июнь так и показывает 1072. Что не так и как починить?</p>`,
      solution: `Селектор создан на датасете «пользователи + заказы», линия MAU — из датасета «пользователи + активность».\nСелектор действует только на чарты своего датасета, пока поле platform двух датасетов не связано.\nРешение: «Связи» на дашборде — связать selector.platform с platform второго датасета. MAU июня для ios станет 381.`,
      note: "Проверка после правки: переключить селектор и посмотреть, что изменились все чарты, а не часть." }
  ],
```

Текстовые задачи (`answer: "text"`) используют `body` и `solution` — как в `content-m6.js:210-213`. Номер урока JOIN в `note` («1.4») сверить по `lessons.js` и меню: нумерация модуля 1 переставлена, `id` с номером не совпадает.

- [ ] **Step 2:** Run: `node инструменты/checknums.js && node инструменты/checkdrills.js` — Expected: зелёные; полей больше ещё на 4.

- [ ] **Step 3: Квиз (7 вопросов) и карточки (8).** Формат — `content-m6.js:3912-3995`. Квиз: что хранит датасет; COUNTD против COUNT; зачем левая связь для ARPU; почему два датасета; что делает «Связи»; можно ли публиковать рабочий дашборд по публичной ссылке; группировка даты. Карточки: подключение, датасет, измерение, показатель, COUNTD, вычисляемое поле, селектор, публичная ссылка. Ответы с числами — из блока «Проверенные числа».

- [ ] **Step 4: Ссылки** — 5 страниц документации из Task 3 Step 1, формат `links` как в `m6l7`.

- [ ] **Step 5:** Run: `node инструменты/checkcards.js && node инструменты/checkterms.js && node инструменты/checkorder.js` — Expected: зелёные.

### Task 5: Нумерация 4.7 → 4.8

**Files:** Modify `content-m6.js:3350, 3548`, `ПРОГРЕСС.md:96, 347`, остальные найденные.

- [ ] **Step 1: Найти ссылки.**
Run: `grep -n -E 'урок[а-я]* 4\.7|4\.7[ »)]|«4\.7' content-m*.js README.md ПРОГРЕСС.md lessons.js app.js interview.js cheats.js glossary.js инструменты/*.js инструменты/*.py .claude -r | grep -v 'FIGS\['`
Expected: строки 3350 и 3548 в `content-m6.js`, 96 и 347 в `ПРОГРЕСС.md`, возможно ещё. Каждую разобрать по смыслу: ссылка на «записку по итогам квартала» → 4.8; число 4,7 вне ссылки — не трогать.

- [ ] **Step 2: Заменить.** Ссылки на записку → «4.8». Ссылок на «4.6» не трогать.

- [ ] **Step 3:** Run: тот же grep — Expected: остались только числа, не ссылки на урок.

### Task 6: Две схемы

**Files:** Modify `инструменты/figs.py`, `content-m4.js` (вставка `window.FIGS[...]` — генерирует `figs.py`).

- [ ] **Step 1: Агент `figure-builder`, два вызова подряд.** Задание 1 — `bi-chain`: «цепочка подключение → датасет → чарт → дашборд для урока m4l8; под каждым объектом — что он хранит и пример из урока: подключение "app-journal.xlsx, 3 листа"; датасет "app_users + app_orders, левая связь по user_id"; чарт "ARPU по каналам"; дашборд "6 элементов и селектор Платформа"». Задание 2 — `bi-chart-editor`: «разметка окна редактора чарта DataLens без копирования интерфейса: слева список полей датасета (измерения и показатели), в центре зоны X, Y, Цвет, Фильтры, справа превью; подписаны зоны и пример раскладки для линии MAU: X — activity_date (месяц), Y — COUNTD(user_id)». Числа на схемах — только из блока «Проверенные числа».

- [ ] **Step 2:** Run: `node инструменты/checkfigs.js` — Expected: зелёный; скриншоты светлой и тёмной темы агент прикладывает в отчёте.

### Task 7: Проверка целиком

- [ ] **Step 1:** Run: `bash инструменты/ci.sh` — Expected: всё зелёное, кроме «Всё пересобрано» и VERSION (норма до выпуска).

- [ ] **Step 2: Браузер.** `python3 инструменты/devserver.py 8781` в фоне; на чистом origin (свободный порт или `127.0.0.1`) открыть `#m4l8`:
  - урок называется 4.7, записка — 4.8 в меню и на карте;
  - кнопка «Скачать данные · app-journal.xlsx» скачивает файл ≈ 450 КБ;
  - шесть правильных чисел дают зачёт; ввод `5570,15` в поле 3 показывает подсказку про inner-связь, `0,2249` в поле 6 — подсказку про доли;
  - схемы видны в светлой и тёмной теме, на ширине 375 px нет горизонтальной прокрутки.

- [ ] **Step 3: Офлайн-сборка.** `python3 build.py`, открыть `Тетрадь аналитика.html` файлом, урок 4.7 → «Скачать данные» отдаёт xlsx. Затем `git checkout "Тетрадь аналитика.html"`.

- [ ] **Step 4: Ревью параллельно.** Агенты `lesson-reviewer` (диф ветки) и `student-walkthrough` (урок `m4l8`) одним сообщением. Замечания разобрать, исправить, повторить Step 1.

- [ ] **Step 5: Живой проход владельца.** Попросить владельца пройти задачу в своём DataLens по тексту урока и сообщить: где путь меню не совпал, и совпали ли шесть чисел. Исправить текст.

- [ ] **Step 6: Commit (только после «Давай»).**

```bash
git add app-journal.xlsx инструменты/mkxlsx.py build.py app.js sw.js инструменты/ci.sh инструменты/README.md инструменты/figs.py lessons.js content-m4.js content-m6.js ПРОГРЕСС.md README.md docs/superpowers/specs/2026-10-13-datalens-lesson-design.md docs/superpowers/plans/2026-10-13-datalens-lesson.md
git commit -m "Урок 4.7: BI на практике, дашборд в DataLens

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
bash инструменты/release.sh "Урок BI в DataLens" --trailer "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

`docs/ПЛАН-УЛУЧШЕНИЙ.md` в коммит не входит. Затем PR в `main` и команды владельцу (`gh pr checks N --watch`, `gh pr merge N --merge`).
