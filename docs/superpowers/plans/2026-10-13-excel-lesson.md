# Урок 6.5 «Excel и Google Таблицы на тестовом» — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** новый урок `m6l7` вида `sheet`: ученик скачивает `delta-market.xlsx`, считает в Excel или Google Таблицах и вводит числа в поля, сайт сверяет каждое с допуском; тот же компонент — в тренажёре (`answer: "nums"`).

**Architecture:** объект `Nums` в `app.js` (разбор ввода, сверка, разметка, монтирование полей) используют основная задача урока `sheet` и задача тренажёра `nums`. Файл xlsx собирает `инструменты/mkxlsx.py` из `data.js`; в собранный HTML он попадает `data:`-ссылкой через `window.FILES`. Эталоны полей подтверждает `инструменты/checknums.js` запросом `check` к `shop.db`.

**Tech Stack:** чистый JS без сборщика, Python 3 + openpyxl 3.1.5 (только инструмент), sqlite3, Playwright (ручная проверка).

**Spec:** `docs/superpowers/specs/2026-10-13-excel-lesson-design.md`

## Global Constraints

- `id` уроков не меняются; новое в `steps`, `practicum.steps`, `cards`, `quiz`, `drills` — только в конец (у нового урока массивы новые). `node инструменты/checkorder.js` зелёный.
- Каждое число в тексте урока проверено запуском на `инструменты/shop.db`; эталон каждого поля — запросом `check`.
- Тон: без восклицаний, каждое утверждение с числом и знаменателем; на «вы».
- Новые цвета, радиусы и тени на экране — только через переменные из `:root` (`styles.css`).
- Прогресс: новых разделов нет; ввод полей — в `code[id]` (урок) и `code["m6l7:dN"]` (тренажёр) строкой JSON; решено — `done[id]` и `drills["m6l7:N"]`, как у остальных.
- Коммитов по задачам НЕТ: правило курса — один PR = коммит содержания + коммит выпуска (`bash инструменты/release.sh "<что>" --trailer "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`), и оба только с согласия владельца. Спек уже закоммичен отдельно.
- Собранный `Тетрадь аналитика.html` руками не правится; после `ci.sh` вернуть его `git checkout -- "Тетрадь аналитика.html"` (пересоберёт `release.sh`).
- openpyxl: в GitHub-проверке ставить `openpyxl==3.1.5`.

## Review Focus

1. Ввод с пробелами-разделителями тысяч из Excel (неразрывный U+00A0 и узкий U+202F), с `₽`, `%`, запятой — должен засчитываться; «1,842,000» и «abc» — «Введите число», а не «неверно» (Task 2, сценарии `checknums.js`).
2. Пустые поля при «Проверить» — не попытка и не провал: статус «Заполните все поля», счётчик попыток не растёт (Task 3, Task 4: ручная проверка + условие в коде).
3. Повторный заход на урок: введённые числа и отметки на месте, урок пройденный — статус «Урок уже пройден» (Task 3, проверка в браузере).
4. Собранный офлайн-файл: «Скачать данные» отдаёт xlsx из `data:`, а не битую относительную ссылку (Task 3, Playwright по `file://`).
5. Повреждённый `code[id]` (не JSON, старый текст) не ломает урок — поля просто пустые (Task 2, `Nums.load`, сценарий в `checknums.js`).

---

### Task 1: Файл `delta-market.xlsx` и его сборка

**Files:**
- Create: `инструменты/mkxlsx.py`
- Create: `delta-market.xlsx` (результат скрипта)
- Modify: `инструменты/ci.sh` (шаг «Файл xlsx»), `.github/workflows/check.yml` (`pip install … openpyxl==3.1.5`)

**Interfaces:**
- Produces: файл `delta-market.xlsx` в корне; листы `orders` (order_id, user_id, order_date, revenue, status), `users` (user_id, signup_date, channel, city, platform), `leads` (сырые строки из `leadsCSV`). Команды `python3 инструменты/mkxlsx.py` (записать) и `python3 инструменты/mkxlsx.py --check` (код 1, если содержимое файла в ветке отличается от собранного).

- [ ] **Step 1: Написать скрипт**

```python
#!/usr/bin/env python3
"""Собирает delta-market.xlsx для урока 6.5 из data.js.

    python3 инструменты/mkxlsx.py           # записать файл в корень сайта
    python3 инструменты/mkxlsx.py --check   # сверить с файлом в ветке

Листы orders, users — как в базе (даты — датами Excel, суммы — числами),
leads — сырые строки выгрузки CRM, для задач на чистку. Сверка идёт по
распакованному содержимому листов, а не по байтам: zlib на разных
системах сжимает по-разному.
"""
import csv, datetime, io, pathlib, re, sys, zipfile
from openpyxl import Workbook
from openpyxl.styles import Font

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "delta-market.xlsx"
STAMP = datetime.datetime(2024, 9, 30)
SRC = (ROOT / "data.js").read_text(encoding="utf-8")


def rows(key):
    body = re.search(r"\n  %s: `(.*?)`" % key, SRC, re.S).group(1)
    return [r for r in csv.reader(io.StringIO(body)) if r]


def day(s):
    return datetime.datetime.strptime(s, "%Y-%m-%d")


def build():
    wb = Workbook()
    wb.properties.creator = "Тетрадь аналитика"
    wb.properties.created = wb.properties.modified = STAMP
    sheets = (
        ("orders", rows("ordersCSV"), (int, int, day, float, str)),
        ("users", rows("usersCSV"), (int, day, str, str, str)),
        ("leads", rows("leadsCSV"), None),   # как есть: текст, пустые — пустые
    )
    wb.remove(wb.active)
    for name, data, cast in sheets:
        ws = wb.create_sheet(name)
        ws.append(data[0])
        for c in ws[1]:
            c.font = Font(bold=True)
        for r in data[1:]:
            ws.append([f(v) for f, v in zip(cast, r)] if cast else [v if v != "" else None for v in r])
        for col, fmt in ((3, "yyyy-mm-dd"), (4, "0.00")) if name == "orders" else ((2, "yyyy-mm-dd"),) if name == "users" else ():
            for (c,) in ws.iter_rows(min_row=2, min_col=col, max_col=col):
                c.number_format = fmt
        ws.freeze_panes = "A2"
        ws.auto_filter.ref = ws.dimensions
    raw = io.BytesIO()
    wb.save(raw)
    # одинаковые даты у файлов внутри zip — иначе каждая сборка «новая»
    out = io.BytesIO()
    with zipfile.ZipFile(raw) as src, zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as dst:
        for info in src.infolist():
            z = zipfile.ZipInfo(info.filename, date_time=STAMP.timetuple()[:6])
            z.compress_type = zipfile.ZIP_DEFLATED
            dst.writestr(z, src.read(info.filename))
    return out.getvalue()


def parts(blob):
    with zipfile.ZipFile(io.BytesIO(blob)) as z:
        return {n: z.read(n) for n in z.namelist()}


if __name__ == "__main__":
    blob = build()
    if "--check" in sys.argv:
        if not OUT.exists() or parts(OUT.read_bytes()) != parts(blob):
            sys.exit("delta-market.xlsx устарел: python3 инструменты/mkxlsx.py")
        print("delta-market.xlsx совпадает с data.js")
    else:
        OUT.write_bytes(blob)
        print("Готово: %s — %.0f КБ" % (OUT.name, OUT.stat().st_size / 1024))
```

- [ ] **Step 2: `--check` без файла падает**

Run: `python3 инструменты/mkxlsx.py --check; echo $?`
Expected: «delta-market.xlsx устарел…», код 1.

- [ ] **Step 3: Собрать и проверить**

Run: `python3 инструменты/mkxlsx.py && python3 инструменты/mkxlsx.py && python3 инструменты/mkxlsx.py --check && git status --short delta-market.xlsx`
Expected: «Готово … КБ» (порядок 20–40 КБ), затем «совпадает». Две сборки подряд дают одинаковые байты: `python3 инструменты/mkxlsx.py && shasum delta-market.xlsx` дважды — одна и та же сумма.

- [ ] **Step 4: Содержимое верное**

Run:
```bash
python3 - <<'EOF'
from openpyxl import load_workbook
wb = load_workbook("delta-market.xlsx")
print(wb.sheetnames, [wb[n].max_row - 1 for n in wb.sheetnames])
o = wb["orders"]
print(o["C2"].value, type(o["C2"].value).__name__, o["D2"].value, type(o["D2"].value).__name__)
print(sum(r[3] for r in o.iter_rows(min_row=2, values_only=True) if r[4] == "paid"))
EOF
```
Expected: `['orders', 'users', 'leads'] [215, 220, 63]`, дата — `datetime`, сумма — `float`, сумма оплаченных ≈ 653428.78 (сверить: `sqlite3 инструменты/shop.db "SELECT ROUND(SUM(revenue),2) FROM orders WHERE status='paid'"`).

- [ ] **Step 5: Шаг в `ci.sh` и workflow**

В `инструменты/ci.sh` после шага «Шпаргалки»:
```bash
step "Файл xlsx" "delta-market.xlsx не совпадает с data.js — запустите python3 инструменты/mkxlsx.py и закоммитьте файл" python3 инструменты/mkxlsx.py --check
```
В `.github/workflows/check.yml`: `pip install --quiet pandas matplotlib openpyxl==3.1.5` и в названии шага «…, openpyxl для xlsx урока 6.5».

Run: `bash инструменты/ci.sh 2>&1 | grep "Файл xlsx"`
Expected: `✓ Файл xlsx`.

---

### Task 2: Объект `Nums` и проверка разбора ввода

**Files:**
- Modify: `app.js` — новый раздел перед `const Drills = {` (около строки 4776)
- Create: `инструменты/checknums.js` (первая часть — сценарии разбора)
- Modify: `инструменты/ci.sh` (шаг «Числовые ответы»)

**Interfaces:**
- Produces (глобальный `const Nums` в app.js):
  - `Nums.parse(s: string) → number | null`
  - `Nums.judge(f: Field, s: string) → "ok" | "bad" | "nan" | "empty"`; `Field = {label, unit?, answer: number, tol?: number, hint, check}`; допуск по умолчанию `0.5`.
  - `Nums.load(raw: string|null, n: number) → string[]` (длина n, битое — пустые строки)
  - `Nums.html(fields: Field[], prefix: string) → string` (разметка `<ol class="nums">`)
  - `Nums.mount(root: Element, fields: Field[], values: string[], save: (values: string[]) => void) → { values(): string[], check(): {ok: boolean, empty: number, bad: number, nan: number} }`
- `checknums.js` вырезает из app.js текст от `const Nums = {` до строки `};` перед `const Drills` и выполняет его в `vm` (как `checkskills.js` вырезает `Skills`).

- [ ] **Step 1: Написать сценарии (падают — `Nums` ещё нет)**

```js
#!/usr/bin/env node
/* Проверка числовых ответов (уроки kind: "sheet", задачи тренажёра
   answer: "nums"):
   1. разбор ввода — Nums.parse / judge / load из app.js на сценариях;
   2. эталоны — у каждого поля запрос check на инструменты/shop.db даёт
      answer в пределах tol (см. ниже, вторая часть).
   Запуск: node инструменты/checknums.js            */
const fs = require("fs"), vm = require("vm"), path = require("path");
const base = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(base, "app.js"), "utf8");
const m = app.match(/\nconst Nums = \{[\s\S]*?\n\};\n/);
if (!m) { console.log("В app.js не найден объект Nums"); process.exit(1); }
const ctx = {}; vm.createContext(ctx);
vm.runInContext(m[0].replace("const Nums", "var Nums"), ctx);
const N = ctx.Nums, bad = [];
const eq = (what, got, want) => { if (got !== want) bad.push(what + ": получилось " + JSON.stringify(got) + ", нужно " + JSON.stringify(want)); };

eq("parse 1842", N.parse("1842"), 1842);
eq("parse пробел", N.parse("1 842"), 1842);
eq("parse неразрывный", N.parse("1 842,00 ₽"), 1842);
eq("parse узкий", N.parse("271 926,54"), 271926.54);
eq("parse точка", N.parse("1842.5"), 1842.5);
eq("parse процент", N.parse("47,3%"), 47.3);
eq("parse минус", N.parse("−12,5"), -12.5);
eq("parse две запятые", N.parse("1,842,000"), null);
eq("parse буквы", N.parse("abc"), null);
eq("parse пусто", N.parse(""), null);
const f = { answer: 47.27, tol: 0.06 };
eq("judge ok", N.judge(f, "47,3"), "ok");
eq("judge bad", N.judge(f, "0,473"), "bad");
eq("judge nan", N.judge(f, "сорок"), "nan");
eq("judge empty", N.judge(f, "  "), "empty");
eq("judge tol по умолчанию", N.judge({ answer: 3457.3 }, "3457"), "ok");
eq("judge вне допуска", N.judge({ answer: 3457.3 }, "3456"), "bad");
eq("load битый", JSON.stringify(N.load("не json", 2)), '["",""]');
eq("load старый текст-массив другой длины", JSON.stringify(N.load('["1"]', 3)), '["1","",""]');
eq("load null", JSON.stringify(N.load(null, 1)), '[""]');

let parsed = 19;  // число сценариев выше — для строки итога
if (bad.length) { console.log("Разбор ввода:\n" + bad.join("\n")); process.exit(1); }
console.log("Разбор ввода: " + parsed + " сценариев");
```

- [ ] **Step 2: Убедиться, что падает**

Run: `node инструменты/checknums.js; echo $?`
Expected: «В app.js не найден объект Nums», код 1.

- [ ] **Step 3: Написать `Nums` в app.js (перед `const Drills = {`)**

```js
/* ============================================================
   Поля для чисел: урок kind: "sheet" и задача тренажёра answer: "nums"

   Ученик считает в Excel или Google Таблицах и приносит числа. Поле —
   { label, unit, answer, tol, hint, check }: tol — допуск по модулю
   (по умолчанию 0,5), check — SQL-эталон для инструменты/checknums.js.
   Ввод понимается так, как его копируют из таблицы: пробелы тысяч
   (и неразрывные), ₽ и %, запятая вместо точки.
   ============================================================ */

const Nums = {
  parse: function (s) {
    const t = String(s == null ? "" : s).replace(/[\s  ]/g, "")
      .replace(/[₽%]/g, "").replace(/^[−–]/, "-").replace(",", ".");
    return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : null;
  },
  judge: function (f, s) {
    if (!String(s == null ? "" : s).trim()) return "empty";
    const v = Nums.parse(s);
    if (v === null) return "nan";
    return Math.abs(v - f.answer) <= (f.tol === undefined ? 0.5 : f.tol) ? "ok" : "bad";
  },
  /* сохранённое — строка JSON с массивом; всё остальное (старый текст,
     обрезанная запись) — пустые поля, а не сломанный урок */
  load: function (raw, n) {
    let a = [];
    try { a = JSON.parse(raw); } catch (e) { a = []; }
    if (!Array.isArray(a)) a = [];
    const out = [];
    for (let i = 0; i < n; i++) out.push(typeof a[i] === "string" ? a[i] : "");
    return out;
  },
  html: function (fields, prefix) {
    return '<ol class="nums">' + fields.map(function (f, i) {
      const id = prefix + "-" + i;
      return '<li class="nm" data-i="' + i + '">' +
        '<label class="nm-l" for="' + id + '">' + f.label +
          (f.unit ? ', <span class="nm-u">' + esc(f.unit) + "</span>" : "") + "</label>" +
        '<span class="nm-row"><input class="nm-in" id="' + id + '" type="text" inputmode="decimal" ' +
          'autocomplete="off" spellcheck="false" aria-describedby="' + id + '-h">' +
        '<span class="nm-mark" aria-hidden="true"></span></span>' +
        '<p class="nm-h" id="' + id + '-h" hidden></p></li>';
    }).join("") + "</ol>";
  },
  mount: function (root, fields, values, save) {
    const ins = Array.prototype.slice.call(root.querySelectorAll(".nm-in"));
    ins.forEach(function (inp, i) {
      inp.value = values[i] || "";
      inp.addEventListener("input", function () {
        const li = inp.closest(".nm");
        li.classList.remove("ok", "bad");
        $(".nm-h", li).hidden = true;
        $(".nm-mark", li).innerHTML = "";
        inp.removeAttribute("aria-invalid");
        save(ins.map(function (x) { return x.value; }));
      });
    });
    return {
      values: function () { return ins.map(function (x) { return x.value; }); },
      check: function () {
        const r = { ok: true, empty: 0, bad: 0, nan: 0 };
        ins.forEach(function (inp, i) {
          const v = Nums.judge(fields[i], inp.value), li = inp.closest(".nm"), h = $(".nm-h", li);
          li.classList.toggle("ok", v === "ok");
          li.classList.toggle("bad", v === "bad" || v === "nan");
          $(".nm-mark", li).innerHTML = v === "ok" ? ICON.ok : "";
          if (v === "ok") inp.removeAttribute("aria-invalid"); else if (v !== "empty") inp.setAttribute("aria-invalid", "true");
          h.hidden = v === "ok" || v === "empty";
          h.textContent = v === "nan" ? "Введите число: цифры, запятая или точка." : v === "bad" ? fields[i].hint : "";
          if (v !== "ok") r.ok = false;
          if (v === "empty") r.empty++; else if (v === "bad") r.bad++; else if (v === "nan") r.nan++;
        });
        return r;
      }
    };
  }
};
```

Перед вставкой: `grep -n "^const Nums\b\|Nums\." app.js` — имя свободно.

- [ ] **Step 4: Сценарии зелёные**

Run: `node --check app.js && node инструменты/checknums.js`
Expected: `Разбор ввода: 19 сценариев`.

- [ ] **Step 5: Шаг в `ci.sh`**

После «Файл xlsx»:
```bash
step "Числовые ответы" "разбор ввода в полях для чисел сломан или эталон поля разошёлся с базой (node инструменты/checknums.js)" node инструменты/checknums.js
```

---

### Task 3: Основная задача урока `sheet`, скачивание файла, стили

**Files:**
- Modify: `app.js` — `renderLesson` (около 5056–5660), `CodeKit.lesson` (около 3838), `Offline.files` (около 512), поиск/оглавление (подписи вида урока около 2377 и 5706), новый объект `Files`
- Modify: `build.py` — `window.FILES` для офлайн-файла
- Modify: `styles.css` — блок «Поля для чисел» после стилей тренажёра

**Interfaces:**
- Consumes: `Nums.html`, `Nums.mount`, `Nums.load` (Task 2).
- Produces: `Files.url(name: string) → string` (`window.FILES[name]` или сам `name`); у урока `kind: "sheet"` поля `C.file`, `C.fields`, `C.ticket`, `C.schema`, `C.hints`, `C.reference` (разбор), без `starter`/`expected`/`solution`.

- [ ] **Step 1: `Files` и офлайн**

Рядом с `Lazy` в app.js:
```js
/* Файлы для скачивания (xlsx урока 6.5). В собранном офлайн-файле
   рядом ничего нет — build.py кладёт их в window.FILES data:-ссылками. */
const Files = {
  url: function (name) { return (window.FILES && window.FILES[name]) || name; }
};
```
В `Offline.files` к списку `own` добавить `"delta-market.xlsx"`.

В `build.py` перед строкой `lazy = "".join(...)`:
```python
# файлы для скачивания из уроков — data:-ссылками, app.js берёт их из window.FILES
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
files = "<script>\nwindow.FILES = %s;\n</script>\n" % json.dumps(
    {"delta-market.xlsx": data_uri("delta-market.xlsx", XLSX)})
```
и `html = swap(html, '<script src="app.js"></script>', files + lazy + "<script>\n" + read("app.js") + "\n</script>")` (в `build.py` импортов `json` нет — добавить `import json` к `import base64 …` в начале файла).

- [ ] **Step 2: Вид урока в подписях и CodeKit**

- Обе строки `const kind = l.kind === "text" ? "разбор" : l.kind === "sql" ? "SQL" : "Python";` → `l.kind === "text" ? "разбор" : l.kind === "sheet" ? "таблицы" : l.kind === "sql" ? "SQL" : "Python"`.
- `CodeKit.lesson`: `L.kind === "text" || L.kind === "sheet" ? [] : CodeKit.parse(C.schema)`.
- `if (L.kind !== "text") idle(... Lazy.data() ...)` → `if (L.kind !== "text" && L.kind !== "sheet")`.

- [ ] **Step 3: Разметка задачи**

В `renderLesson`: рядом с `const isText = L.kind === "text";` — `const isSheet = L.kind === "sheet"; const noCode = isText || isSheet;`, `kindLabel`: `isText ? "разбор кейса" : isSheet ? "Excel и таблицы" : …`.

Вместо `(isText ? '<textarea class="answer" …>' : '<div class="editor-shell">…')`:
```js
(isSheet
  ? '<p class="nm-file"><a class="btn" id="fileBtn" href="' + Files.url(C.file) + '" download="' + C.file + '">' +
      ICON.down + "Скачать данные · " + esc(C.file) + "</a></p>" + Nums.html(C.fields, "nm-" + id)
  : isText ? '<textarea class="answer" id="answer" …></textarea>' : '<div class="editor-shell">…</div>')
```
`ICON.down` в app.js нет (есть mark, play, check, bulb, key, moon, sun, ok, bad, warn, arrow, menu, find) — добавить после `arrow` по образцу `ICON.check` (тот же `viewBox`, `stroke="currentColor"`, `aria-hidden`): стрелка вниз над чертой, `M8 2v8 M4.5 6.5 8 10l3.5-3.5 M3 13h10` в координатах 16×16 (пересчитать под `viewBox` соседей).

`runBtn` — только при `!noCode`. Подписи io-блоков: «разбор вашего ответа» / «эталонный разбор» — при `noCode`; пустой текст для sheet — «Введите числа и нажмите «Проверить».». Эталон (`refBox`): ветка `if (isText)` → `if (noCode)`. Решение (`solBtn`): `(noCode ? "" : …код…) + (C.solutionNote || C.reference || "")`. `Cmd+Enter`: `if (noCode) check(); else run();`. `if (!isText) $("#runBtn")…` → `if (!noCode)`.

- [ ] **Step 4: Сохранение и проверка**

В блоке редактора:
```js
let nums = null;
if (isSheet) {
  nums = Nums.mount($("#s-task"), C.fields, Nums.load(savedCode, C.fields.length),
    function (v) { Store.set("code", id, JSON.stringify(v)); });
} else if (isText) { … как было … } else { … как было … }
```
`getCode()`: `if (isSheet) return JSON.stringify(nums.values());`.

Новая функция рядом с `checkText`:
```js
function checkNums() {
  const r = nums.check();
  const n = C.fields.length, good = n - r.empty - r.bad - r.nan;
  $("#outBox").innerHTML = '<div class="nm-sum">Верно ' + good + " из " + n + "</div>";
  if (r.ok) return pass("Все " + n + " " + plural(n, "число", "числа", "чисел") + " сошлись с расчётом на той же базе. " +
                        "Откройте эталонный разбор справа: там формулы, которыми их удобнее всего получить.");
  if (r.empty) { setStatus("warn", "Заполните все поля", "Пустых полей: " + r.empty + " из " + n + ". Попытка не засчитана."); return; }
  if (r.nan && !r.bad) { setStatus("warn", "Не похоже на число", "Под полем написано, что поправить. Попытка не засчитана."); return; }
  fail("Не сошлось " + (r.bad + r.nan) + " из " + n + ". Под каждым таким полем — что проверить.");
}
```
`check()`: `if (isSheet) return checkNums();` перед `if (isText)`.

- [ ] **Step 5: Стили** (`styles.css`, после блока тренажёра)

```css
/* поля для чисел (урок «Excel и таблицы», задачи тренажёра nums) */
.nm-file { margin: 0 0 18px; }
.nums { list-style: none; margin: 0 0 18px; padding: 0; counter-reset: nm; }
.nm { padding: 12px 0; border-top: 1px solid var(--rule-soft); }
.nm:first-child { border-top: 0; }
.nm-l { display: block; font-size: 15px; line-height: 1.45; color: var(--ink); margin-bottom: 6px; }
.nm-u { color: var(--ink-3); }
.nm-row { display: flex; align-items: center; gap: 10px; }
.nm-in {
  width: 100%; max-width: 220px; font: 15px var(--mono); color: var(--ink);
  background: var(--card); border: 1px solid var(--rule); border-radius: var(--r);
  padding: 8px 10px; font-variant-numeric: tabular-nums;
}
.nm-in:focus-visible { outline: 2px solid var(--pen); outline-offset: 1px; }
.nm.ok .nm-in { border-color: var(--green); }
.nm.bad .nm-in { border-color: var(--red); }
.nm-mark { color: var(--green); width: 18px; height: 18px; }
.nm-h { margin: 6px 0 0; font-size: 13.5px; line-height: 1.45; color: var(--ink-2); }
.nm-sum { font: 13px var(--mono); color: var(--ink-3); }
```
`--green` и `--red` определены в обеих темах (`styles.css:117-118`, `173-174`).

- [ ] **Step 6: Проверка на временном уроке**

Урока ещё нет — подложить в консоли страницы курса (devserver 8781) нельзя (`CONTENT` грузится с модулем). Поэтому Task 3 проверяется вместе с Task 6 в браузере (Task 8). Здесь: `node --check app.js && python3 build.py && grep -c "window.FILES" "Тетрадь аналитика.html"` → `1`; затем `git checkout -- "Тетрадь аналитика.html"`.

---

### Task 4: Задача тренажёра `nums`

**Files:**
- Modify: `app.js` — `Drills.kind`, `Drills.itemHtml`, `Drills.mountOne`
- Modify: `инструменты/checkdrills.js` — счёт `nums` отдельно

**Interfaces:**
- Consumes: `Nums.html`, `Nums.mount`, `Nums.load`.
- Produces: задача тренажёра `{ title, level, answer: "nums", body, fields: Field[], solution, note }`; `Drills.kind(L, d) === "nums"`.

- [ ] **Step 1: `Drills.kind`** — первой строкой: `if (d.answer === "nums") return "nums";`

- [ ] **Step 2: `itemHtml`** — перед `if (k === "text")`:
```js
if (k === "nums") {
  return '<div class="dr-work">' + Nums.html(d.fields, "nm-" + L.id + "-d" + i) +
    '<div class="st-actions"><button class="btn check dr-check" type="button">' + ICON.check + "Проверить</button></div>" +
    '<div class="status dr-status"></div></div>';
}
```

- [ ] **Step 3: `mountOne`** — перед `if (k === "text")`:
```js
if (k === "nums") {
  const box = q(".dr-work");
  const nm = Nums.mount(box, d.fields, Nums.load(Store.get("code", codeKey, null), d.fields.length),
    function (v) { Store.set("code", codeKey, JSON.stringify(v)); });
  q(".dr-check").addEventListener("click", function () {
    const r = nm.check();
    if (r.ok) { solve(); status("ok", "Сошлось", "Разбор ниже — сверьте, той ли формулой шли."); return; }
    if (r.empty) { status("warn", "Заполните все поля", "Попытка не засчитана."); return; }
    tried();
    status("bad", "Не сошлось", "Под полем — что проверить. Разбор открыт ниже.");
  });
  return;
}
```

- [ ] **Step 4: `checkdrills.js`**

В цикле перед `const kind = …`: `if (d.answer === "nums") { nums++; return; }`; объявить `let … nums = 0`; в итоговой строке — `", числами: " + nums`. Эталоны `nums` проверяет `checknums.js`.

- [ ] **Step 5:** `node --check app.js && node инструменты/checkdrills.js` — зелёный, в строке есть «числами: 0».

---

### Task 5: Эталоны полей в `checknums.js`

**Files:**
- Modify: `инструменты/checknums.js` — вторая часть

**Interfaces:**
- Consumes: `window.CONTENT` (все `content-m*.js`), `COURSE` из `lessons.js`, `инструменты/shop.db`.

- [ ] **Step 1: Дописать в конец `checknums.js`** (вместо финальных строк итога)

```js
/* 2. Эталоны полей: урок kind "sheet" — C.fields и C.file; задачи
   answer: "nums" — d.fields. У поля обязательны label, answer, hint,
   check; check возвращает одно число, оно совпадает с answer ± tol.
   В уроке "sheet" задачи тренажёра — только nums или text. */
const { execFileSync } = require("child_process");
const C0 = { window: { SH: {}, CONTENT: {}, DATA: {} }, console };
vm.createContext(C0);
for (const f of ["data.js", "content-core.js"].concat(
       fs.readdirSync(base).filter(f => /^content-m\d+\.js$/.test(f)).sort(), ["lessons.js"]))
  vm.runInContext(fs.readFileSync(path.join(base, f), "utf8"), C0);
const db = path.join(__dirname, "shop.db");
let fields = 0;
function checkFields(where, list) {
  if (!Array.isArray(list) || !list.length) { bad.push(where + ": нет fields"); return; }
  list.forEach(function (f, i) {
    const w = where + ", поле " + (i + 1);
    for (const k of ["label", "hint", "check"]) if (!f[k]) bad.push(w + ": нет " + k);
    if (typeof f.answer !== "number") { bad.push(w + ": answer не число"); return; }
    fields++;
    try {
      const out = execFileSync("sqlite3", [db], { input: f.check, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
      const v = Number(out);
      if (out === "" || isNaN(v)) bad.push(w + ": check вернул «" + out + "», а не одно число");
      else if (Math.abs(v - f.answer) > (f.tol === undefined ? 0.5 : f.tol)) bad.push(w + ": в базе " + v + ", в уроке " + f.answer);
    } catch (e) { bad.push(w + ": " + String(e.stderr || e.message).trim().split("\n").pop()); }
  });
}
for (const mod of C0.window.COURSE.modules) for (const L of mod.lessons) {
  const C = C0.window.CONTENT[L.id];
  if (!C) continue;
  if (L.kind === "sheet") {
    checkFields(L.id + " задача", C.fields);
    if (!C.file || !fs.existsSync(path.join(base, C.file))) bad.push(L.id + ": нет файла " + C.file);
  }
  (C.drills || []).forEach(function (d, i) {
    const where = L.id + " тренажёр " + (i + 1) + " «" + d.title + "»";
    if (d.answer === "nums") checkFields(where, d.fields);
    else if (L.kind === "sheet" && d.answer !== "text") bad.push(where + ": в уроке sheet задача — nums или text");
  });
}
if (bad.length) { console.log("Ошибки:\n" + bad.join("\n")); process.exit(1); }
console.log("Разбор ввода: " + parsed + " сценариев; эталонов полей: " + fields);
```
И убрать прежние две строки итога после сценариев (кроме `if (bad.length) …exit` — его перенести сюда целиком, как выше).

- [ ] **Step 2:** `node инструменты/checknums.js` → «эталонов полей: 0» до урока; после Task 6 — 5 + число полей тренажёра.

- [ ] **Step 3: Проверка, что ловит** — во временной копии (как для `checkcheats.js`: scratchpad, `data.js content-core.js content-m*.js lessons.js app.js` и `инструменты/{checknums.js,shop.db}`, `delta-market.xlsx`) поменять `answer` одного поля на +10 → сообщение «в базе …, в уроке …», код 1.

---

### Task 6: Урок `m6l7` и место в курсе

**Files:**
- Modify: `lessons.js` — урок пятым в `m6`, навык `sheets`
- Modify: `content-m6.js` — объект `m6l7` после `m6l4` (с заголовком-комментарием `/* 6.5 Excel и Google Таблицы на тестовом */`)
- Modify: `инструменты/checkskills.js` — ожидание 16 навыков (найти число 15 в проверке)
- Modify: `glossary.js` — термины, если нужны (ВПР, сводная таблица); `node инструменты/checkterms.js`

**Interfaces:**
- Consumes: формат `sheet` (Task 3), `nums` (Task 4), проверка эталонов (Task 5).

- [ ] **Step 1: `lessons.js`** — после `m6l4`:
```js
{ id: "m6l7", title: "Excel и Google Таблицы на тестовом", kind: "sheet", ready: true,
  desc: "сводная, ВПР и СУММЕСЛИМН на тех же данных",
  say: "тестовое в xlsx — та же аналитика, другим инструментом",
  sayTask: "сначала ВПР, потом сводная — не наоборот",
  sayDrills: "«Закрытые лиды» — чистка, на которой режут тестовые" },
```
В `skills` — `{ id: "sheets", group: "Продукт", title: "Excel и Google Таблицы", lessons: ["m6l7"] }` последней строкой; комментарий над `skills` (строка ~80) про карьерные уроки — номера поправит Task 7.

- [ ] **Step 2: Поля задачи** (эталоны посчитаны на `shop.db` 2026-10-13):

| # | label | unit | answer | tol | check |
|---|---|---|---|---|---|
| 1 | Выручка оплаченных заказов пользователей из канала organic | ₽ | 271926.54 | 1 | `SELECT ROUND(SUM(o.revenue),2) FROM orders o JOIN users u USING(user_id) WHERE o.status='paid' AND u.channel='organic';` |
| 2 | То же для канала paid_search | ₽ | 141330.95 | 1 | то же с `'paid_search'` |
| 3 | Средний чек оплаченного заказа | ₽ | 3457.3 | 0.5 | `SELECT ROUND(AVG(revenue),2) FROM orders WHERE status='paid';` |
| 4 | Оплаченных заказов от пользователей из Москвы | — | 53 | 0 | `SELECT COUNT(*) FROM orders o JOIN users u USING(user_id) WHERE o.status='paid' AND u.city='Москва';` |
| 5 | Доля пользователей с хотя бы одним оплаченным заказом | % | 47.27 | 0.06 | `SELECT ROUND(100.0*COUNT(DISTINCT user_id)/(SELECT COUNT(*) FROM users),2) FROM orders WHERE status='paid';` |

`hint` для каждого — что чаще всего ломает именно это число: (1–2) «В сумму попали и возвраты? Нужны только строки со status = paid; канал подтягивается ВПР из листа users по user_id.»; (3) «Среднее по всем заказам и по оплаченным — разные числа: СРЗНАЧЕСЛИ с условием на status.»; (4) «Город лежит в users — сначала ВПР города к заказам, потом СЧЁТЕСЛИМН по двум условиям.»; (5) «Знаменатель — все 220 пользователей листа users, а не покупатели; числитель — уникальные user_id с оплатой.».

- [ ] **Step 3: Тренажёр** (5 задач `nums`, эталоны посчитаны):

| # | title, level | поле | answer | tol | check |
|---|---|---|---|---|---|
| 1 | «СЧЁТЕСЛИМН: iOS из Казани», easy | пользователей ios из Казани | 20 | 0 | `SELECT COUNT(*) FROM users WHERE platform='ios' AND city='Казань';` |
| 2 | «Средний чек за июнь», mid | средний чек оплаченных заказов с 1 по 30 июня 2024, ₽ | 3233.19 | 0.5 | `SELECT ROUND(AVG(revenue),2) FROM orders WHERE status='paid' AND order_date BETWEEN '2024-06-01' AND '2024-06-30';` |
| 3 | «Сводная в два измерения», mid | оплаченная выручка android-пользователей канала referral, ₽ | 6037.09 | 1 | `SELECT ROUND(SUM(o.revenue),2) FROM orders o JOIN users u USING(user_id) WHERE o.status='paid' AND u.channel='referral' AND u.platform='android';` |
| 4 | «Доля возвратов», easy | доля заказов со статусом refunded от всех заказов, % | 6.05 | 0.06 | `SELECT ROUND(100.0*SUM(status='refunded')/COUNT(*),2) FROM orders;` |
| 5 | «Закрытые лиды», hard | лидов в статусе «закрыт» в любом написании | 19 | 0 | `SELECT COUNT(*) FROM leads WHERE TRIM(status) IN ('Закрыт','закрыт');` |

У каждой — `body` (условие, какой лист и какая функция), `solution` (формулы для русского Excel и для Google Таблиц, например `=СЧЁТЕСЛИМН(users!E:E;"ios";users!D:D;"Казань")` и `=COUNTIFS(users!E:E,"ios",users!D:D,"Казань")`), `note`. Задача 5: статусы в `leads` записаны 8 способами (`Закрыт` 10, `закрыт` 9, `Новый` 10, `НОВЫЙ` 9, `новый` 7, `в работе` 10, `В работе` 3, `отказ` 5 — проверить запросом `SELECT status, COUNT(*) FROM leads GROUP BY 1` перед текстом); решение — СЖПРОБЕЛЫ + СТРОЧН или СЧЁТЕСЛИ (он не различает регистр в Excel и Google Таблицах).

- [ ] **Step 4: Теория** — разделы по спеку («Содержание урока → Теория», пункты 1–4), оформление по README («Правила оформления»): `lead`, `callout jobs` «Что закрывает урок в вакансиях», `callout trap` для ВПР без ЛОЖЬ, таблица перевода «SQL / pandas → Excel → Google Таблицы»:

| Что делаем | SQL | Excel (рус.) | Google Таблицы |
|---|---|---|---|
| отобрать строки | `WHERE` | Фильтр | Фильтр |
| агрегат с условием | `SUM … WHERE` | `СУММЕСЛИМН` | `SUMIFS` |
| подтянуть столбец по ключу | `LEFT JOIN` | `ВПР(…;…;…;ЛОЖЬ)` / `ПРОСМОТРX` | `VLOOKUP(…,…,…,FALSE)` / `XLOOKUP` |
| группировка | `GROUP BY` | Сводная таблица | Сводная таблица |

Каждое число в теории — из запросов этой задачи (например, «оплаченных заказов 189 из 215» — проверить `SELECT COUNT(*) FROM orders WHERE status='paid'`). Ссылки — справка Microsoft по ВПР и ПРОСМОТРX, справка Google по VLOOKUP/XLOOKUP и сводным (`links`, 3 шт., поле `lang`).

- [ ] **Step 5: Остальные поля урока** — `intro`, `duration`, `plan` (как у `m6l5`: теория и карточки / задача / тренажёр / самопроверка / заметки), `ticket` (от «Ира, маркетинг»: «Пришлите до вечера цифры по каналам, файл во вложении»), `schema` (листы xlsx и их столбцы + «как открыть в Google Таблицах: Файл → Импорт → Загрузка»), `hints` (3 уровня), `reference` (разбор: формулы по каждому полю в двух вариантах), `quiz` (6: ВПР без ЛОЖЬ, `;` против `,`, сводная не обновилась, число как текст, ВПР влево, СЧЁТЕСЛИ и регистр), `cards` (6), `file: "delta-market.xlsx"`, `fields` (Step 2).

- [ ] **Step 6: Проверки урока**

Run: `node --check content-m6.js lessons.js && node инструменты/checknums.js && node инструменты/checkdrills.js && node инструменты/checkcards.js && node инструменты/checkterms.js && node инструменты/checkskills.js && node инструменты/checkorder.js`
Expected: всё зелёное; `checknums` — «эталонов полей: 10»; `checkskills` — 16 навыков.

---

### Task 7: Сдвиг номеров 6.5 → 6.6, 6.6 → 6.7

**Files:**
- Modify: `lessons.js:80` («карьерные 6.1, 6.2, 6.6» → «6.1, 6.2, 6.7»), `README.md:113` (то же), `ПРОГРЕСС.md:103-104,130,397-399`, `инструменты/figs.py:2410,2462` (комментарии «урока 6.6» → «6.7»), заголовки-комментарии `/* 6.5 … */`, `/* 6.6 … */` в `content-m6.js`.

- [ ] **Step 1:** Найти все: `grep -rnE "6\.[56]" content-*.js glossary.js lessons.js app.js README.md ПРОГРЕСС.md инструменты/*.py инструменты/*.js | grep -v "window.FIGS"` и разобрать по смыслу (числа 6,5 / 6.5 в данных не трогать). Сначала 6.6 → 6.7, потом 6.5 → 6.6.
- [ ] **Step 2:** `ПРОГРЕСС.md`: «Модуль 6: 6.1-6.7», строка про текстовые уроки (6.1, 6.2, 6.6, 6.7), ключевые числа 6.5 → 6.6 (подписка), 6.6 → 6.7 (воронка найма); добавить блок ключевых чисел 6.5 Excel (поля и тренажёр из Task 6) и сводку уроков/карточек/вопросов (взять из вывода `checkcards.js` и подсчёта).
- [ ] **Step 3:** `python3 инструменты/figs.py m6 --check` (комментарии в figs.py не влияют на SVG) и `bash инструменты/ci.sh` — красные только «Всё пересобрано» и «Версия сайта»; `git checkout -- "Тетрадь аналитика.html"`.

---

### Task 8: Документация, браузер, ревью

**Files:**
- Modify: `README.md` — таблица файлов (`delta-market.xlsx`, `инструменты/mkxlsx.py`), раздел «Как устроен урок вида sheet» (поля `file`, `fields`, формат поля, `answer: "nums"` в тренажёре, где хранится ввод); `инструменты/README.md` — строки `mkxlsx.py`, `checknums.js`.

- [ ] **Step 1: README** — описать формат поля дословно как в Task 2 Interfaces и правило «эталон — запрос `check`».

- [ ] **Step 2: Браузер** (devserver 8781, свой Playwright со `serviceWorkers: "block"`, чистый origin — см. память о локальных проверках):
  - `#m6l7` на 390 px и 1280 px, светлая и тёмная: нет горизонтальной прокрутки, поля видны.
  - Ввести неверные числа → под полями подсказки, «Попытка 1»; пустое поле → «Заполните все поля», попытка не растёт; «1 842» с неразрывным пробелом в поле 3 → «bad» (не «nan»).
  - Ввести верные (271926.54, «141 330,95 ₽», 3457,3, 53, «47,3%») → «Задание выполнено», галочка; перезагрузка → значения на месте, «Урок уже пройден».
  - Тренажёр: задача 1 → 20 → «Сошлось», счётчик «Решено 1 из 5».
  - «Скачать данные» на сайте отдаёт файл ≈ размер `delta-market.xlsx`; в собранном файле (`python3 build.py`, `file://…#m6l7`) ссылка начинается с `data:application/vnd.openxmlformats`; потом `git checkout -- "Тетрадь аналитика.html"`.
  - `#skills` — навык «Excel и Google Таблицы» в группе «Продукт»; главная — урок 6.5 в оглавлении, 6.6/6.7 сдвинулись.
- [ ] **Step 3: Агенты параллельно** — `engine-reviewer` (Nums, sheet, drills nums, Files, build.py, mkxlsx, ci), `lesson-reviewer` (урок, числа, сдвиг номеров), `student-walkthrough` (`m6l7`). Применить замечания, повторить Task 6 Step 6 и `ci.sh`.
- [ ] **Step 4: Согласие владельца** → коммит содержания «Урок 6.5: Excel и Google Таблицы на тестовом» (`git add` по списку файлов, без `docs/ПЛАН-УЛУЧШЕНИЙ.md`), затем `bash инструменты/release.sh "Урок 6.5: Excel и Google Таблицы" --trailer "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`, push, PR в `main`, команды владельцу `gh pr checks N --watch -R nekozlovskiy/analyst-notebook` и `gh pr merge N --merge -R nekozlovskiy/analyst-notebook`.
