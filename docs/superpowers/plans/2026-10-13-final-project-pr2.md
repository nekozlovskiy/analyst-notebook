# Модуль 7 «Финальный проект», PR 2 — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** уроки 7.5 «A/B: бесплатная доставка», 7.6 «Дашборд проекта», 7.7 «Записка заказчику» — модуль 7 готов целиком.

**Architecture:** те же виды, что в PR 1: `sheet` (7.5, 7.6) с полями, `check` которых идёт в `инструменты/vilka.db` (`db: "vilka"`), и `text` (7.7). Эталонный код Colab — `window.VILKA_CODE.m7l5`, `.m7l6` в `content-m7.js`; `checkvilka.py` прогоняет его на pandas 3 и 2.2. p-value через `math.erf`, как в модуле 3 (`SH.statsPrelude`): scipy в CI и локально нет. Поля с p-value SQL-проверке не поддаются — новый признак поля `py: true`: `checknums.js` не ищет у него `check`, число сверяет `checkvilka.py`.

**Tech Stack:** чистый JS, Python 3 (pandas 3.x и 2.2 в `~/.cache/analyst-notebook/v312/bin/python`), sqlite3, Node, Playwright (`~/.npm/_npx/9833c18b2d85bc59/node_modules/playwright`).

**Spec:** `docs/superpowers/specs/2026-10-13-final-project-design.md`

## Global Constraints

- `id` уроков не меняются; новые шаги, карточки, вопросы — только в конец массивов. Уроки m7l5–m7l7 получают содержимое впервые.
- Каждое число в тексте урока проверено запуском на базе «Вилки» (`sqlite3 инструменты/vilka.db` или код на обоих pandas) и записано в `ПРОГРЕСС.md`.
- Тон: без восклицаний, каждое утверждение с числом и знаменателем.
- Python печатает только скаляры; текстовые Series не печатать.
- Теория, квиз и карточки не называют ответы полей и тренажёра своего урока (урок PR 1 это нарушал — ревью поймало).
- В тексте нет ссылок на уроки, которые идут позже.
- По 6 карточек на урок (`checkcards --require` требует 6–12), квиз 4 вопроса, тренажёр 2 задачи.
- Чистые данные: без строк-дублей, без `platform = 'internal'`; выручка «Вилки» = 20% `items_sum` + `delivery_fee` доставленных.
- `Тетрадь аналитика.html` руками не правится. Коммит и PR — после «Давай»: коммит содержания, затем `release.sh`.

## Review Focus

1. Урок с `ready: true` без содержимого вешает страницу (цикл `Lazy.content`) — Task 1 добавляет проверку в `checknums.js`.
2. p-value вводят по-разному: `0,0031`, `0.003`, `3,1e-3`, `0,31%` — Task 3 проверяет разбор `Nums.parse` на этих строках в браузере и выбирает допуск, при котором `0,003` засчитывается, а `0,03` — нет.
3. Окно эксперимента: заказ считается, если `created_at >= assigned_at` и `created_at < 2025-06-02`; в Colab `assigned_at` — datetime, в `vilka.db` — строка `YYYY-MM-DD`: сравнение строк должно дать те же числа — Task 2 (SQL `check` против кода pandas).
4. CSV для DataLens: `to_csv` пишет `created_at` как `2025-01-01 14:30:00` и `revenue` дробью — DataLens должен прочитать дату датой; текст урока говорит, какой тип поставить, — Task 5.
5. Записка 7.7: пустой ответ с ключевыми словами не должен проходить — Task 6 проверяет эталон (зачёт) и общую отписку (отказ).

## Проверенные числа (pandas 3.0.3 и 2.2.3 дают одинаковый вывод)

```
эксперимент без internal: control 2264, test 2269 (всего 4533)
SRM: хи-квадрат 0,0055, p = 0,9408
окно: assigned_at <= created_at < 2025-06-02, доставленные чистые
покупатели: control 1117 (49,34%), test 1219 (53,72%); z = 2,955, p = 0,0031
заказов: control 2053 (0,9068 на польз.), test 2372 (1,0454)
средний чек: control 1230,15, test 1278,92 (z = 2,988, p = 0,0028)
доля заказов от 1500 ₽: control 24,79%, test 37,86%; 1500–1749 ₽: 10,13% / 22,34%
на пользователя: выручка «Вилки» 426,41 / 429,15 (+2,74; z = 0,148, p = 0,8826)
                 GMV 1115,50 / 1336,98 (+221,47; z = 4,034)
                 плата за доставку 203,31 / 161,76 (−41,55; z = −4,907)
выручка «Вилки» в окне: control 965 397, test 973 746
бесплатных доставок в test в окне: 898; по тарифу 149 ₽ это 133 802 ₽
дашборд (чистые доставленные): выручка 11 636 428; апрель 2 270 421;
  Казань 1 869 932; ios 4 395 916 (android 5 193 141, web 2 047 371);
  клиентов с заказом в июне 3714 (ios — 1407); сырая выгрузка 12 956 308
```

## Файлы

- Modify: `content-m7.js` (m7l5, m7l6, m7l7, `VILKA_CODE.m7l5`, `.m7l6`), `lessons.js` (ready, say*, навык `final`), `инструменты/checknums.js` (ready ⇒ содержимое, `C.file` у text, `py: true`), `инструменты/README.md`, `README.md`, `index.html`, `manifest.webmanifest`, `ПРОГРЕСС.md`.

---

### Task 1: Проверки в `checknums.js`

**Files:** Modify `инструменты/checknums.js`, `инструменты/README.md`.

**Interfaces:** Produces — признак поля `py: true` (поле без `check`, его число сверяет `checkvilka.py`; разрешён только в уроке с `db: "vilka"`); ошибка «урок готов, а содержимого нет»; ошибка «нет файла» и для text-урока с `C.file`.

- [ ] **Step 1: RED.** Временно в `lessons.js` у `m7l5` поставить `ready: true`. Run: `node инструменты/checknums.js` — Expected сейчас: зелёный (проверки нет; `if (!C) continue`). Вернуть `ready: false`.
- [ ] **Step 2: Правка.** В цикле по урокам до `if (!C) continue;`:

```js
  if (!C) {
    // урок с ready: true без содержимого: движок грузил бы модуль по кругу
    if (L.ready) bad.push(L.id + ": урок готов (ready: true), а в content-*.js его нет");
    continue;
  }
```

Условие на файл: `if (L.kind === "sheet" || C.file)` вокруг проверки `fs.existsSync`, текст ошибки прежний. В `checkFields` в начале цикла по полю:

```js
    if (f.py) {
      // p-value и другие числа без SQL: их сверяет checkvilka.py по коду урока
      if (!f.label || !f.hint) bad.push(w + ": нет label или hint");
      if (typeof f.answer !== "number") bad.push(w + ": answer не число");
      if (dbPath === db) bad.push(w + ": py: true — только в уроке с db: \"vilka\"");
      fields++;
      return;
    }
```

Шапка файла: «поле с py: true проверяет инструменты/checkvilka.py».
- [ ] **Step 3: GREEN.** Снова `ready: true` у m7l5 → Run `node инструменты/checknums.js` — Expected: «m7l5: урок готов (ready: true), а в content-*.js его нет», код 1. Вернуть `ready: false`, Run — Expected: зелёный. Строку `checknums.js` в `инструменты/README.md` дополнить: «урок ready без содержимого и `py: true` (сверяет checkvilka.py)».

### Task 2: Урок 7.5 — код и поля

**Files:** Modify `content-m7.js`.

**Interfaces:** Consumes — `VILKA_CODE.load`, `.clean`, `py: true` (Task 1). Produces — `VILKA_CODE.m7l5`, `window.CONTENT.m7l5.fields` (6 полей).

- [ ] **Step 1: Код** `VILKA_CODE.m7l5` (после load + clean; печать — по строке на поле в порядке полей):

```python
import math

def norm_cdf(x):
    return 0.5 * (1 + math.erf(x / math.sqrt(2)))

def p_two_sided(z):
    return 2 * (1 - norm_cdf(abs(z)))

n = experiment.groupby("group").size()
nc, nt = n["control"], n["test"]
z_srm = (nt - (nc + nt) / 2) / math.sqrt((nc + nt) * 0.25)

w = delivered.merge(experiment, on="customer_id")
w = w[(w["created_at"] >= w["assigned_at"]) & (w["created_at"] < "2025-06-02")]
per = w.groupby("customer_id").agg(orders=("order_id", "size"), revenue=("revenue", "sum"))
u = experiment.set_index("customer_id").join(per).fillna({"orders": 0, "revenue": 0})

buyers = u[u["orders"] > 0].groupby("group").size()
pc, pt = buyers["control"] / nc, buyers["test"] / nt
pool = buyers.sum() / (nc + nt)
z_conv = (pt - pc) / math.sqrt(pool * (1 - pool) * (1 / nc + 1 / nt))

check_test = w.loc[w["group"] == "test", "items_sum"].mean()
m = u.groupby("group")["revenue"].mean()
v = u.groupby("group")["revenue"].var()
z_rev = (m["test"] - m["control"]) / math.sqrt(v["test"] / nt + v["control"] / nc)

print(f"p-value SRM: {p_two_sided(z_srm):.4f}")
print(f"конверсия test, %: {100 * pt:.2f}")
print(f"p-value конверсии: {p_two_sided(z_conv):.4f}")
print(f"средний чек test: {check_test:.2f}")
print(f"выручка Вилки на пользователя test: {m['test']:.2f}")
print(f"p-value выручки на пользователя: {p_two_sided(z_rev):.4f}")
```

(`w["created_at"] < "2025-06-02"` — сравнение datetime со строкой pandas разбирает сам на 2.2 и 3; если на одной из версий падает — `pd.Timestamp("2025-06-02")`, ledger.)

- [ ] **Step 2: Поля.** Общий префикс `check` (подставлять строкой целиком):

```sql
WITH x AS (SELECT e.customer_id, e."group" AS g, e.assigned_at AS a FROM experiment e JOIN customers c USING(customer_id) WHERE c.platform <> 'internal'), d AS (SELECT DISTINCT o.* FROM orders o JOIN customers c USING(customer_id) WHERE c.platform <> 'internal' AND o.status = 'delivered'), w AS (SELECT x.g, d.* FROM d JOIN x USING(customer_id) WHERE d.created_at >= x.a AND d.created_at < '2025-06-02')
```

1. «p-value проверки SRM», `answer: 0.9408, tol: 0.005, py: true`; hint: ожидаемое — поровну, 4533 / 2; z = (2269 − 2266,5) / √(4533 · 0,25).
2. «Конверсия в заказ в test», `unit: "%"`, `answer: 53.72, tol: 0.06`; check `… SELECT ROUND(100.0 * COUNT(DISTINCT customer_id) / (SELECT COUNT(*) FROM x WHERE g = 'test'), 2) FROM w WHERE g = 'test';`; hint: знаменатель — все 2269 участников test, а не заказавшие; заказ считается с `assigned_at` по 1 июня.
3. «p-value разницы конверсий», `answer: 0.0031, tol: 0.0006, py: true`; hint: z-тест для двух долей с общей долей — где он в курсе, найти `grep -n "pool\|общая доля" content-m3.js` и сослаться на номер урока по позиции в модуле (m3l9 = 3.1, m3l2 = 3.2, m3l1 = 3.3, m3l3 = 3.4, m3l4 = 3.5, m3l5 = 3.6, m3l6 = 3.7 «Ловушки A/B: SRM», m3l8 = 3.8, m3l7 = 3.9).
4. «Средний чек заказа в test», `unit: "₽"`, `answer: 1278.92, tol: 0.5`; check `… SELECT ROUND(AVG(items_sum), 2) FROM w WHERE g = 'test';`.
5. «Выручка «Вилки» на пользователя test», `unit: "₽"`, `answer: 429.15, tol: 0.5`; check `… SELECT ROUND(SUM(0.2 * items_sum + delivery_fee) / (SELECT COUNT(*) FROM x WHERE g = 'test'), 2) FROM w WHERE g = 'test';`; hint: 798,81 — поделено на 1219 заказавших, знаменатель — все участники.
6. «p-value разницы выручки на пользователя», `answer: 0.883, tol: 0.005, py: true`; hint: у каждого участника выручка, у незаказавших — 0; z = разница средних / √(var_t/n_t + var_c/n_c).

Подсказки с ошибочными значениями — только те, что отличаются от ответа больше допуска (посчитать запросом каждое).
- [ ] **Step 3:** Run: `node инструменты/checknums.js && python3 инструменты/checkvilka.py && python3 инструменты/checkvilka.py ~/.cache/analyst-notebook/v312/bin/python` — Expected: зелёные, «полей 19».

### Task 3: Урок 7.5 — содержимое

**Files:** Modify `content-m7.js`.

- [ ] **Step 1:** По образцу 7.3: `intro`, `duration`, `plan`, `file`, `db`, `theory` — SRM как первая проверка; окно эксперимента; конверсия против денег (выручка на пользователя = заказы на пользователя × чек × доля «Вилки»); экономика: GMV на пользователя +221,47 ₽, плата за доставку −41,55 ₽, выручка +2,74 ₽ при p = 0,8826 — без чисел полей (конверсия test, чек test, выручка test, p-value SRM и конверсии в теории не называть; control-числа можно: 49,34%, 1230,15, 426,41); смещение чека к порогу (1500–1749 ₽: 10,13% → 22,34%); решение не по p-value конверсии. `ticket` от Арины: «конверсия выросла — раскатываем?». `schema`: окно, группы, формулы. `hints` 3, `reference` — код с выводом. `drills` 2 `nums`: «Сколько платы за доставку не получили» (898 · 149 = 133 802; check: `… SELECT COUNT(*) * 149 FROM w WHERE g = 'test' AND delivery_fee = 0;`), «Доля заказов от 1500 ₽ в test» (37,86; check `… SELECT ROUND(100.0 * SUM(items_sum >= 1500) / COUNT(*), 2) FROM w WHERE g = 'test';`). `quiz` 4, `cards` 6, `links` 3.
- [ ] **Step 2: Разбор p-value в браузере** (Review Focus 2): devserver на свободном порту, `#m7l5`, в поле 3 по очереди `0,0031`, `0.003`, `3,1e-3`, `0,31%`, `0,03` → ожидание: первые два «верно», `0,03` — «неверно»; что движок делает с `3,1e-3` и `0,31%` — записать; если `0,31%` разбирается как 0,31, подсказка поля говорит «долей, не процентом».
- [ ] **Step 3:** Run: `node инструменты/checknums.js && node инструменты/checkcards.js && node инструменты/checkorder.js && node инструменты/checkdrills.js` — Expected: зелёные.

### Task 4: Урок 7.6 — экспорт и поля

**Files:** Modify `content-m7.js`.

**Interfaces:** Produces — `VILKA_CODE.m7l6`: экспорт `vilka_clean.csv` и пять чисел из него (проверяет, что CSV правильный).

- [ ] **Step 1: Код:**

```python
clean = delivered.merge(customers[["customer_id", "city", "platform"]], on="customer_id")
clean.to_csv("vilka_clean.csv", index=False)

csv = pd.read_csv("vilka_clean.csv", parse_dates=["created_at"])
month = csv["created_at"].dt.strftime("%Y-%m")
print(f"выручка за полугодие: {csv['revenue'].sum():.2f}")
print(f"выручка за апрель: {csv.loc[month == '2025-04', 'revenue'].sum():.2f}")
print(f"выручка Казани: {csv.loc[csv['city'] == 'Казань', 'revenue'].sum():.2f}")
print(f"клиентов с заказом в июне: {csv.loc[month == '2025-06', 'customer_id'].nunique()}")
print(f"выручка ios: {csv.loc[csv['platform'] == 'ios', 'revenue'].sum():.2f}")
```

Скачивание — только в теории (вне `VILKA_CODE`: в checkvilka нет Colab): `from google.colab import files` / `files.download("vilka_clean.csv")`.
- [ ] **Step 2: Поля** (`check` на сырых таблицах с чисткой в CTE `d AS (SELECT DISTINCT o.*, c.city, c.platform FROM orders o JOIN customers c USING(customer_id) WHERE c.platform <> 'internal' AND o.status = 'delivered')`): выручка за полугодие 11 636 428 (`tol: 1`; hint: 12 956 308 — дашборд на сыром xlsx); апрель 2 270 421; Казань 1 869 932; клиентов с заказом в июне 3714 (`tol: 0`; hint: 7450 — «Количество» вместо «Количество уникальных»); выручка ios при селекторе 4 395 916.
- [ ] **Step 3:** Run `checknums` и `checkvilka` на обоих pandas — Expected: «полей 24».

### Task 5: Урок 7.6 — содержимое

- [ ] **Step 1:** По образцу `m4l8` (DataLens, `content-m4.js`): теория только о новом — дашборд по готовой чистой таблице вместо связей трёх листов; почему не грузить сырой xlsx (дубли и internal; 12 956 308 против верного — без чисел полей своего урока: «на 1 319 880 ₽ больше» допустимо, т.к. сумма — ответ поля; переписать как «на 11,34% больше»); тип `created_at` в DataLens — «Дата и время», `revenue` — «Дробное число» (Review Focus 4); состав дашборда: индикатор выручки, линия выручки по месяцам, столбцы по городам, линия клиентов по месяцам (COUNTD), селектор «Платформа»; публичная ссылка — на учебных данных. `ticket`, `schema`, `hints` 3, `reference` (код экспорта + шаги DataLens), `drills` 2 `nums`: «Дашборд на сыром файле» (12 956 308; check по `orders` без чистки), «Клиентов в июне на ios» (1407). `quiz` 4, `cards` 6, `links` 3.
- [ ] **Step 2:** Run `checknums`, `checkcards`, `checkorder`, `checkdrills` — зелёные.

### Task 6: Урок 7.7 — записка (`text`)

- [ ] **Step 1:** По образцу `m4l7` (`content-m4.js:4544`, `minCriteria: 7`, `minWords: 160`): теория — структура записки (решение в первом абзаце, три числа с знаменателями, чистка одной строкой, ограничения, следующий шаг), чек-лист портфолио: ноутбук Colab с публичной ссылкой («Настройки доступа → Все, у кого есть ссылка»), дашборд DataLens по публичной ссылке на учебных данных, записка; README по уроку 6.2. `ticket` от Арины: «нужна записка на страницу к пятнице». `criteria` (10, `minCriteria: 7`): решение («не раскатыв», «рекоменд», «решени»), конверсия («конверси»), выручка на пользователя («на пользовател», «на клиент»), значимость («p-value», «значим», «случайн»), плата за доставку («плат за доставк», «доставк»), GMV ресторанов («gmv», «ресторан»), качество данных («дубл», «служебн», «тестов аккаунт»), удержание («удержан», «когорт»), ограничения («огранич», «четыре недели», «4 недел», «сезон»), следующий шаг («предлагаю», «порог», «следующ», «повторить»). `reference` — записка 200–260 слов с числами урока 7.2–7.6. `drills` 2 `text`: «Первый абзац» (переписать вывод «конверсия выросла на 4,38 п. п., p = 0,0031» в решение), «Что не так с этой запиской» (GMV вместо выручки, нет знаменателей). `quiz` 4, `cards` 6, `links` 3.
- [ ] **Step 2:** Критерии без браузера (`Check.text` из `app.js`): эталон — зачёт; общая отписка 160 слов про «данные интересные, конверсия, доставка» — отказ (не больше 4 блоков).

### Task 7: Готовность модуля

- [ ] **Step 1:** `lessons.js`: m7l5–m7l7 `ready: true` и `say`, `sayTask`, `sayDrills` по содержимому; навык `final` — все семь уроков. `index.html`, `manifest.webmanifest` — «58 уроков»; `ПРОГРЕСС.md` — «58 уроков, все готовы», сводка, раздел «Ключевые числа модуля 7» (блок «Проверенные числа» этого плана + числа теорий и ошибок подсказок), «Тесты: итоговое состояние», «Карточки».
- [ ] **Step 2:** Run: `bash инструменты/ci.sh` — Expected: всё зелёное, кроме «Всё пересобрано» и «Версия сайта»; `checkcards --require m0 … m7` — без ошибок по m7.
- [ ] **Step 3: Браузер** (свой Playwright, devserver на свободном порту, сторожевой таймер): уроки 7.5–7.7 открываются на 1280 и 375 px без горизонтальной прокрутки; верные числа 7.5 и 7.6 засчитывают, одно неверное — подсказка; эталон 7.7 — зачёт; итоговый тест модуля 7 строится; офлайн-файл — урок 7.6 и кнопка `vilka.xlsx`.
- [ ] **Step 4: Ревью параллельно:** `lesson-reviewer`, `student-walkthrough` (7.5–7.7), `engine-reviewer` (только `checknums.js`). Замечания — одним проходом, Step 2 снова.
- [ ] **Step 5 (после «Давай»):** коммит содержания (вместе с этим планом), `bash инструменты/release.sh "Финальный проект: уроки 7.5–7.7" --trailer "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`, PR в `main`.
