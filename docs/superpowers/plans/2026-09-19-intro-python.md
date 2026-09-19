# Вводный урок 0.2 «Python с нуля» — план реализации

> **Для исполнителя:** план исполняется в этой сессии, по одной задаче;
> после каждой — коммит, короткий отчёт и ожидание «продолжай».
> Шаги отмечаются `- [ ]`.

**Цель:** пошаговый урок 0.2 «Python с нуля» (9 шагов) на движке шагов
урока 0.1, который проходят перед модулем 2.

**Архитектура:** `Steps.render` получает второй язык — для урока с
`kind: "python"` код шага запускается в Pyodide с прологом модуля 2 и
сверяется по напечатанному (`Check.python`). `Course` строит порядок
прохождения с учётом поля `before`, не трогая карту курса и номера.

**Стек:** статический сайт без сборщика: `app.js`, `lessons.js`,
`content-m0.js`, `content-m2.js`, Pyodide 0.26.4 (pandas 2.2), node-скрипты
в `инструменты/`, `build.py`.

**Спецификация:** `docs/superpowers/specs/2026-09-19-intro-python-design.md`

## Общие требования

- Тексты — по-русски, без восклицаний; один акцент `var(--pen)`; рамка
  только у редактора и вывода; единственная анимация — ink-in.
- Читатель-эталон не знает программирования и Excel.
- Пролог и данные Python — ровно `window.SH.pyPrelude` и `window.SH.pyData`
  (как в модуле 2); пакеты — `["pandas"]`.
- Эталоны шагов не печатают `dtypes` и `Series` текстовых значений.
- Ключи прогресса урока 0.2: шаги `m0l2:0…8`, код `m0l2:s0…8` (как у 0.1).
- Перед выкладкой: `VERSION` в `sw.js`, `python3 build.py`.
- Проверка в браузере — course-dev (порт 8779), адрес `127.0.0.1`.

---

### Task 1: Python в движке шагов и первые два шага урока

**Files:**
- Modify: `app.js` — `Engine.python`, `Steps` (запуск, проверка, подпись
  файла, режим редактора), `renderStepsLesson`, ветка `C.steps` в
  `renderLesson`
- Modify: `styles.css` — `.st-warm`
- Modify: `content-m0.js` — `m0l1.finish`; новый `window.CONTENT.m0l2`
  с шагами 1–2
- Modify: `lessons.js` — урок `m0l2` в модуле 0 (пока без `before`)
- Modify: `инструменты/checksteps.js` — Python-шаги через локальный `python3`

**Interfaces:**
- Produces: `Steps.render(L, S, box, onFinish, tag)` — сигнатура прежняя;
  язык берётся из `L.kind`. Для Python `S` несёт `packages`, `data`,
  `prelude`, `schema`, шаги — `expected: { stdout }`.
- Produces: `C.finish` — HTML итоговой фразы пошагового урока.
- Produces: `Engine.python(pkgs)` безопасен при одновременных вызовах.
- Сделано сверх плана (найдено при проверке): каждый запуск шага — в
  чистом пространстве имён (`runPythonAsync(code, { globals: ns })`),
  иначе переменные соседних шагов «помогали»; трассировка — с кадра
  `File "<exec>"`; в выводе «Выполняю…»; прогрев заранее делает
  `import pandas`.

- [x] **Step 1: Проверка, которая пока падает**

`node инструменты/checksteps.js m0l2` → «m0l2: нет урока с шагами» (урока нет).

- [x] **Step 2: `Engine.python` — одна загрузка на всех**

Сейчас два одновременных вызова (прогрев и «Запустить») оба видят
`!Engine.py` и грузят Pyodide дважды. Заменить на общие обещания:

```js
  python: async function (pkgs) {
    /* прогрев урока и «Запустить» могут прийти одновременно —
       интерпретатор и пакеты грузятся один раз */
    if (!Engine.pyReady) {
      Engine.pyReady = loadScript(CDN.pyBase + "pyodide.js").then(function () {
        return window.loadPyodide({ indexURL: CDN.pyBase });
      });
      Engine.pyReady.catch(function () { Engine.pyReady = null; });
    }
    Engine.py = await Engine.pyReady;
    for (const p of (pkgs || [])) {
      if (!Engine.pyPkgs[p]) {
        Engine.pyPkgs[p] = Engine.py.loadPackage(p);
        Engine.pyPkgs[p].catch(function () { delete Engine.pyPkgs[p]; });
      }
      await Engine.pyPkgs[p];
    }
    return Engine.py;
  }
```

В объекте `Engine` добавить поле `pyReady: null`.

- [x] **Step 3: `Steps` — запуск и проверка Python**

В `Steps.render`: `const py = L.kind === "python";`, переменная `lastOut`
рядом с `last`. Подпись файла `(py ? ".py" : ".sql")`. Редактор:
`mountEditor(q(".st-ta"), py ? "python" : "sql", …)`.

`run()` делится на общую часть и два запуска:

```js
      async function run() {
        if (open !== n || !document.body.contains(li)) return false;
        status(null);
        const code = editor ? editor.get() : q(".st-ta").value;
        if (!code.trim()) {
          status("warn", "Пусто", py ? "Сначала напишите код." : "Сначала напишите запрос.");
          return false;
        }
        const rb = q(".st-run");
        rb.disabled = true;
        try { return await (py ? runPy(code) : runSql(code)); }
        finally { if (document.body.contains(rb)) rb.disabled = false; }
      }
```

`runSql(code)` — прежнее тело `run()` от `if (!Engine.db)` до `catch`
включительно, без `finally`. `runPy(code)`:

```js
      async function runPy(code) {
        if (!Engine.py) q(".st-res").innerHTML =
          '<div class="empty">Готовлю Python в браузере — первый раз 15–40 секунд…</div>';
        let pyi;
        try {
          const got = await Promise.all([Engine.python(S.packages || []), Lazy.data()]);
          pyi = got[0];
        } catch (e) {
          lastOut = null;
          q(".st-res").innerHTML = '<pre><span class="err">' + esc(String(e && e.message ? e.message : e)) + "</span></pre>";
          status("bad", "Python не загрузился", "Похоже, пропал интернет. Попробуйте ещё раз, когда связь вернётся.");
          return false;
        }
        if (open !== n || !document.body.contains(li)) return false;
        (S.data || []).forEach(function (k) { pyi.globals.set(k, window.DATA[k]); });
        const out = [];
        pyi.setStdout({ batched: function (s) { out.push(s); } });
        pyi.setStderr({ batched: function () {} });
        try {
          if (S.prelude) await pyi.runPythonAsync(S.prelude);
          await pyi.runPythonAsync(code);
        } catch (e) {
          lastOut = null;
          const lines = String(e.message || e).split("\n").filter(function (l) {
            return l.indexOf("/lib/python") < 0 && l.indexOf("pyodide") < 0;
          });
          q(".st-res").innerHTML = '<pre><span class="err">' + esc(lines.slice(-8).join("\n")) + "</span></pre>";
          status("bad", "Код упал с ошибкой",
            "Прочитайте последнюю строку вывода: там сказано, что не понравилось Python.");
          return false;
        }
        lastOut = out.join("\n");
        q(".st-res").innerHTML = lastOut.trim()
          ? "<pre>" + esc(lastOut) + "</pre>"
          : '<div class="empty">Код отработал без ошибок, но ничего не напечатал. Нужен print().</div>';
        return true;
      }
```

`check()` для Python — с подробной причиной (у шага нет окна
«ожидаемый результат», поэтому строку эталона показываем в причине, как
значения в SQL-шагах):

```js
      async function check() {
        const ran = await run();
        if (!ran || open !== n) return;
        if (py) {
          const want = S.steps[n].expected.stdout;
          const r = Check.python(lastOut, want);
          if (r.ok) { pass(n); return; }
          const a = Check.normLines(lastOut)[r.line], b = Check.normLines(want)[r.line];
          status("bad", "Пока не совпадает", esc(a !== undefined && b !== undefined
            ? "строка " + (r.line + 1) + ": получилось «" + a + "», ожидается «" + b + "»" : r.why));
          return;
        }
        const r = Check.sql(last, S.steps[n].expected);
        if (r.ok) { pass(n); return; }
        if (last) showRows(r.row === undefined ? -1 : r.row);
        status("bad", "Пока не совпадает", esc(r.why));
      }
```

- [x] **Step 4: Страница пошагового урока**

`renderStepsLesson`: подпись `lessonHeadHtml(L, C, L.kind === "python" ?
"Python с нуля" : "SQL с нуля")`; в `finished()` вместо зашитого текста
про соединение таблиц — `(C.finish || "Все шаги решены.")`. Над
`#stepsBox` — строка прогрева для Python:

```js
      (L.kind === "python" ? '<div class="st-warm" id="pyWarm">Готовлю Python в браузере — ' +
        "15–40 секунд, можно читать первый шаг.</div>" : "") +
```

После `app.appendChild(main)`:

```js
  /* Python качается долго — начинаем сразу, пока человек читает */
  if (L.kind === "python") {
    const warm = $("#pyWarm");
    Engine.python(C.packages || []).then(function () {
      if (document.body.contains(warm)) warm.remove();
    }, function () {
      if (document.body.contains(warm)) warm.textContent =
        "Python не загрузился — похоже, пропал интернет. «Запустить» попробует ещё раз.";
    });
  } else {
    idle(function () { Engine.sql().catch(function () {}); });
  }
```

В `renderLesson` в ветке `if (C.steps)` убрать `idle(… Engine.sql …)` —
прогрев теперь в `renderStepsLesson`. Стиль в разделе 11а `styles.css`:

```css
.st-warm { margin: 0 0 12px; font-family: var(--sans); font-size: 14px; color: var(--ink-3); }
```

- [x] **Step 5: Итог 0.1 — в содержимое**

В `content-m0.js`, `window.CONTENT.m0l1`, после `plan`:

```js
  finish: "Все шаги решены. Следующий урок — соединение таблиц, и его задача опирается ровно на то, что вы здесь написали.",
```

- [x] **Step 6: Урок 0.2 — карта и шаги 1–2**

`lessons.js`, модуль 0, вторым уроком:

```js
        { id: "m0l2", title: "Python с нуля", kind: "python", ready: true, steps: true,
          desc: "print, списки и таблица pandas на знакомых заказах — перед модулем 2",
          say: "pandas — это тот же SQL, только другими словами",
          sayTask: "печатайте всё: print — ваши глаза в Python" }
```

`content-m0.js`, в конец — `window.CONTENT.m0l2` с полями `intro`,
`duration: "≈ 55 минут"`, `plan`, `schema: window.SH.pySchema`,
`data: window.SH.pyData`, `packages: ["pandas"]`,
`prelude: window.SH.pyPrelude`, `finish: "Все шаги решены. Следующий урок
— pandas всерьёз: тот же отчёт по каналам, что в SQL, и первый merge."`
и `steps` с двумя шагами:

- Шаг 1 «Python как калькулятор: print» — задание: напечатать число всех
  заказов как сумму `189 + 13 + 13`; заготовка `print(1 + 1)`; эталон
  `215`; решение `print(189 + 13 + 13)`.
- Шаг 2 «Переменные и текст» — заготовка `paid = 189\ntotal = 215\n
  print(paid)`; задание: напечатать `Оплачено: 189 из 215` одной строкой
  через `print("Оплачено:", paid, "из", total)`; эталон
  `Оплачено: 189 из 215`.

- [x] **Step 7: `checksteps.js` — Python-шаги**

Урок считается Python-овым, если у шагов `expected.stdout`. Решение
прогоняется локальным `python3` (`child_process.spawnSync("python3",
["-"], { input })`): сначала строки `имяCSV = <JSON-строка>` для каждого
ключа `S.data`, потом `S.prelude`, потом код. Сверка — по правилам
`Check.python` (строки без пробелов по краям, внутренние пробелы
схлопнуты, пустые выкинуты); при расхождении печатаются обе строки. В
начале печатается версия локального pandas и напоминание: «в браузере
pandas 2.2 — окончательная проверка там». `--try N "код"` работает и
для Python.

- [x] **Step 8: Проверка**

- `node инструменты/checksteps.js m0l2` — шаги 1–2 «ок»;
  `m0l1`, `m1l2`, `m1l3`, `m1l4` — «ок».
- Браузер, `#m0l2`: строка прогрева исчезает; шаг 1 — заготовка →
  «Проверить» → «строка 1: получилось «2», ожидается «215»»; подсказка →
  решение → засчитано; шаг 2 так же; после двух шагов — итог с фразой
  `finish`. Ошибка в коде (`print(`) показывает красную трассировку и
  «Код упал с ошибкой».
- `#m0l1` — проходится, итоговая фраза прежняя.

- [x] **Step 9: Коммит**

```bash
git add app.js styles.css lessons.js content-m0.js инструменты/checksteps.js
git commit -m "Движок шагов запускает Python; урок 0.2, шаги 1–2"
```

---

### Task 2: Шаги 3–9 урока 0.2

**Files:**
- Modify: `content-m0.js` — `CONTENT.m0l2.steps[2…8]`, `intro`, `plan`

**Interfaces:**
- Consumes: формат шага из Task 1 (`title, body, ba?, task, starter,
  expected: { stdout }, hint, solution`).

- [x] **Step 1:** написать шаги 3–9 по таблице спецификации. Эталоны
  получить прогоном решений (`node инструменты/checksteps.js m0l2`
  печатает расхождение с фактическим выводом). Таблицы «было → стало» —
  в шагах 6–8 (строки заказов пользователей 196 и 3, как в практикумах).
  Шаг 6 «стало»: `order_id, status` и столбец проверки со значениями
  True/False, `keep` — строки с True.
- [x] **Step 2:** `node инструменты/checksteps.js m0l2` — 9 шагов «ок»;
  `--try` для типичных ошибок: шаг 6 с одним `=` (ошибка синтаксиса),
  шаг 7 без `ascending=False`, шаг 9 без фильтра (первым возврат 196).
- [x] **Step 3:** браузер: урок проходится целиком; вывод совпадает с
  эталоном в браузерном pandas; итог — фраза `finish`; телефон 375px без
  прокрутки вбок.
- [x] **Step 4:** коммит `Урок 0.2: шаги 3–9 — от функций до группировки`.

---

### Task 3: Порядок прохождения — 0.2 перед модулем 2

**Files:**
- Modify: `app.js` — `Course` (порядок `ready`)
- Modify: `lessons.js` — `before: "m2l1"` у `m0l2`; `sub`, `weeks` модуля 0
- Modify: `content-m2.js` — строка-ссылка в начале теории `m2l1`
- Modify: `styles.css` — `.theory .lead-note`

**Interfaces:**
- Produces: `Course.ready` — порядок прохождения; `Course.flat` не меняется.
- Сделано сверх плана: итог модуля (`renderSummary`) зовёт «дальше» в
  первый непройденный урок по порядку прохождения, а не в следующий
  модуль по карте (иначе итог модуля 0 звал в модуль 1, итог модуля 1 —
  мимо 0.2); `sayDone` модуля 0 — «первый запрос и первые строки на
  Python позади».

- [x] **Step 1: Проверка, которая пока падает.** Браузер, `#m0l1`:
  ссылка «дальше» в `#lnav` ведёт на `#m0l2` (должна на `#m1l1`).
- [x] **Step 2: `Course`.** После сборки `flat`:

```js
  /* Порядок прохождения: урок с полем before встаёт прямо перед
     указанным уроком (0.2 «Python с нуля» — перед 2.1). Карта курса и
     номера уроков остаются по местам в модулях. */
  const order = flat.filter(function (l) { return !l.before; });
  flat.forEach(function (l) {
    if (!l.before) return;
    const at = order.findIndex(function (x) { return x.id === l.before; });
    order.splice(at < 0 ? order.length : at, 0, l);
  });
  const readyList = order.filter(function (l) { return l.ready; });
```

- [x] **Step 3: `lessons.js`.** У `m0l2` — `before: "m2l1"`. Модуль 0:
  `sub: "Первый запрос к базе и первые строки на Python — каждый урок в
  своё время."`, `weeks: "≈ 45 минут + час"`.
- [x] **Step 4: 2.1.** Первым абзацем теории `m2l1`:

```html
<p class="lead-note">Python впервые? Начните с урока <a href="#m0l2">0.2 «Python с нуля»</a>: около часа, и код ниже станет читаться.</p>
```

  и стиль рядом с `.theory .lead`:

```css
.theory .lead-note { font-family: var(--sans); font-size: 15px; color: var(--ink-2); }
```

- [x] **Step 5: Проверка.** `#m0l1` → «дальше» `#m1l1`; `#m1l8` →
  `#m0l2`; `#m0l2` → назад `#m1l8`, дальше `#m2l1`; `#m2l1` → назад
  `#m0l2`. Главная: оглавление модуля 0 — 0.1 и 0.2 с «перед модулем 2»;
  прогресс «0 из 42». В `#m2l1` строка со ссылкой видна.
- [x] **Step 6:** коммит `0.2 проходят перед модулем 2: порядок прохождения по полю before`.

---

### Task 4: Выкладка

**Files:**
- Modify: `README.md`, `sw.js`, `Тетрадь аналитика.html` (сборка)

- [ ] **Step 1:** README: «все 41 урок, включая вводный 0.1» → «все 42
  урока, включая вводные 0.1 и 0.2»; в «Как добавить шаги в пошаговый
  урок» — абзац про Python-шаги (`kind: "python"`, `expected.stdout`,
  `packages/data/prelude`, `C.finish`, локальный pandas новее браузерного)
  и про поле `before`.
- [ ] **Step 2:** `sw.js` VERSION → следующая; `python3 build.py`.
- [ ] **Step 3:** все проверки: `checksteps` m0l1, m0l2, m1l2–m1l4;
  `checkterms`; `checkcards`. Однофайловая сборка открывает `#m0l2`.
- [ ] **Step 4:** коммит, пуш ветки `intro-python`, PR в `main`, слияние
  (если фильтр не пустит — команда для Run), дождаться
  pages-build-deployment, проверить файлы сайта `curl`.
