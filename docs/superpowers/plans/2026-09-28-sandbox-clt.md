# Песочница ЦПТ — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** схема `clt-means` в уроке 3.1 (`m3l2`) становится песочницей: одна гистограмма и ползунок n, числа совпадают с текстом урока.

**Architecture:** `инструменты/figs.py` заранее считает гистограммы для 10 значений n и пишет их в `window.SANDBOX` внутри блока FIGS файла `content-m3.js`. Новый файл `sandbox.js` содержит чистые функции `Sandbox.draw[id]` / `Sandbox.label[id]` (их проверяет node) и `Sandbox.mount(root)`, который на странице заменяет статичную SVG живой. `app.js` вызывает `Sandbox.mount` сразу после `Figs.mount`.

**Tech Stack:** Python 3 (sqlite3, random), чистый JS без фреймворков, node для проверок.

**Spec:** `docs/superpowers/specs/2026-09-28-sandboxes-design.md`

**Отступление от спецификации (согласовать с владельцем):** функции песочницы живут в отдельном `sandbox.js`, а не в `app.js` — `app.js` в node не загружается (ему нужны `lessons.js` и DOM), а чистые функции должен проверять `checkfigs.js`. Для ученика ничего не меняется.

## Global Constraints

- Числа в песочнице совпадают с уроком: n = 5 → разброс 778,80 (показ 779), теория 773,11 (773); n = 30 → 323,06 (323), теория 316.
- Положения ползунка: 1, 2, 3, 5, 10, 20, 30, 50, 100, 200; исходное — n = 30 (индекс 6).
- Корзины по 250 руб., ось 0–11 000, вертикаль среднего 3457.
- SVG: `viewBox` шириной не больше 340, цвета только классами `.f-*` (иначе ломается тёмная тема).
- Анимаций нет; в курсе одна анимация — `ink-in`.
- Без данных песочницы или без JS остаётся статичная схема.
- Не менять `id` уроков и порядок элементов в `cards`, `steps`, `practicum.steps`.
- Выпуск: `VERSION` в `sw.js`, `python3 build.py`, `bash инструменты/ci.sh`, PR; вливает владелец курса.

## Review Focus

- Повторная отрисовка урока (вернулись в урок) — ползунок не удваивается: `mount` пропускает фигуру, где уже есть `.sbx`.
- Тёмная тема — всё, что рисует `Sandbox.draw`, раскрашено классами `.f-*`; `checkfigs.js` прогоняет запрет на прямые цвета по выводу всех положений.
- Экранный чтец и клавиатура — `aria-valuetext` обновляется при каждом `input`; проверяется глазами в задаче 3 (стрелки ←/→ двигают по положениям).
- Офлайн-файл «Тетрадь аналитика.html» — `sandbox.js` встраивается `build.py`; если забыть, `build.py` падает «Не встроились локальные файлы».
- Вернувшиеся ученики со старым кешем — `./sandbox.js` в `SHELL` сервис-воркера и новая `VERSION`; `ci.sh` требует поднять версию при изменении `sandbox.js`.

---

### Task 1: Данные песочницы в `figs.py`

**Files:**
- Modify: `инструменты/figs.py` — `clt_sandbox()`, `SANDBOX_M3`, `write_block()` (аргумент `sandboxes`), `check_m3()`, `MODULES` (третий элемент), блок `__main__`
- Regenerate: `content-m3.js` (блок FIGS)

**Interfaces:**
- Produces: `window.SANDBOX["clt-means"]` =
  `{"ns": [1,2,3,5,10,20,30,50,100,200], "start": 6, "ticks": [1,5,30,200], "step": 250, "top": 11000, "mean": 3457.3, "bins": [[int×44] ×10], "sd": [float×10], "sdf": [float×10], "caption": str}` — `sd` разброс по опыту, `sdf` σ/√n, `bins[i]` счётчики 44 корзин по 250 руб. для `ns[i]`.

- [ ] **Step 1: Проверка в `check_m3`, которая пока падает**

В `check_m3()` после проверок `clt-means`:

```python
    sb = clt_sandbox()
    i5, i30 = sb["ns"].index(5), sb["ns"].index(30)
    got = (f"{sb['sd'][i5]:.2f}", f"{sb['sdf'][i5]:.2f}", f"{sb['sd'][i30]:.2f}", f"{sb['sdf'][i30]:.0f}")
    if got != ("778.80", "773.11", "323.06", "316"):
        errs.append(f"clt-sandbox: {got} — не совпало с уроком 3.1")
    if any(sum(b) != 2000 for b in sb["bins"]) or sb["ns"][sb["start"]] != 30:
        errs.append("clt-sandbox: в каждой гистограмме 2000 средних, исходное n = 30")
```

- [ ] **Step 2: Убедиться, что падает**

Run: `python3 инструменты/figs.py m3 --check`
Expected: `NameError: name 'clt_sandbox' is not defined`

- [ ] **Step 3: Функция данных** — рядом с `fig_clt_means()`:

```python
SANDBOX_NS = (1, 2, 3, 5, 10, 20, 30, 50, 100, 200)


def clt_sandbox():
    """Песочница урока 3.1: те же выборки, что в задаче (Random(42) заново
    для каждого n), гистограммы по 250 руб. на оси 0–11 000. sd — разброс
    по опыту, sdf — по формуле σ/√n."""
    import random
    rev = [r for (r,) in db().execute(
        "SELECT revenue FROM orders WHERE status = 'paid' ORDER BY order_id")]
    mu = sum(rev) / len(rev)
    sigma = sd(rev)
    step, top = 250, 11000
    bins, sds, sdfs = [], [], []
    for n in SANDBOX_NS:
        rnd = random.Random(42)
        means = [sum(rnd.choice(rev) for _ in range(n)) / n for _ in range(2000)]
        cnt = [0] * (top // step)
        for m in means:
            cnt[min(int(m // step), len(cnt) - 1)] += 1
        bins.append(cnt)
        sds.append(round(sd(means), 2))
        sdfs.append(round(sigma / n ** .5, 2))
    return {"ns": list(SANDBOX_NS), "start": SANDBOX_NS.index(30), "ticks": [1, 5, 30, 200],
            "step": step, "top": top, "mean": round(mu, 2), "bins": bins, "sd": sds, "sdf": sdfs,
            "caption": "Рис. Двигайте ползунок: средние 2000 выборок из одних и тех же чеков — "
                       "с ростом n разброс падает, а форма становится колоколом"}


SANDBOX_M3 = {"clt-means": clt_sandbox}
```

Если `sdf` при n = 5 выйдет не 773,11, значит урок считает σ с `ddof=0`: заменить `sigma = sd(rev)` на `sigma = (sum((x - mu) ** 2 for x in rev) / len(rev)) ** .5`. Критерий один — проверка из шага 1.

- [ ] **Step 4: Запись в блок FIGS**

`write_block(module, figs, sandboxes=None)` — после строк `window.FIGS[...]`:

```python
    if sandboxes:
        body += "window.SANDBOX = window.SANDBOX || {};\n" + "".join(
            f"window.SANDBOX[{json.dumps(k)}] = {json.dumps(v, ensure_ascii=False, separators=(',', ':'))};\n"
            for k, v in sandboxes.items())
```

`MODULES`: третий элемент кортежа — словарь песочниц (`SANDBOX_M3` для `m3`, `{}` для остальных). В `__main__`:

```python
    figs, check, boxes = MODULES[mod]
    ...
    write_block(mod, {k: f() for k, f in figs.items()}, {k: f() for k, f in boxes.items()})
```

`ci.sh` не трогаем: `fig_modules()` читает только ключи `MODULES`.

- [ ] **Step 5: Проверка проходит, блоки пересобраны**

Run: `python3 инструменты/figs.py m3 --check && python3 инструменты/figs.py m3 && node инструменты/checkfigs.js && grep -c 'window.SANDBOX\["clt-means"\]' content-m3.js`
Expected: `Числа сходятся с базой.`, `Ошибок нет.`, `1`

Run: `for m in m1 m2 m4 m5 m6; do python3 инструменты/figs.py $m >/dev/null; done; git diff --stat -- content-m1.js content-m2.js content-m4.js content-m5.js content-m6.js`
Expected: пустой вывод — блоки других модулей не изменились.

- [ ] **Step 6: Commit**

```bash
git add инструменты/figs.py content-m3.js
git commit -m "Песочница ЦПТ: данные для 10 значений n в window.SANDBOX"
```

---

### Task 2: `sandbox.js` — рисование и подпись, проверка в node

**Files:**
- Create: `sandbox.js`
- Modify: `инструменты/checkfigs.js`, `index.html`, `build.py`, `sw.js` (`SHELL`), `инструменты/ci.sh` (`syntax`, `version_bumped`)

**Interfaces:**
- Consumes: `window.SANDBOX["clt-means"]` из задачи 1.
- Produces: `window.Sandbox = { draw: {"clt-means": (data, i) → строка SVG}, label: {"clt-means": (data, i) → {text, aria}}, mount: (root) → void }`. `mount` пишется здесь, вызывается в задаче 3.

- [ ] **Step 1: Проверка в `checkfigs.js`, которая пока падает** — перед итоговым `console.log("Схем: …")`:

```js
const sbxFile = path.join(base, "sandbox.js");
if (fs.existsSync(sbxFile)) vm.runInContext(fs.readFileSync(sbxFile, "utf8"), ctx);
const SBX = ctx.window.SANDBOX || {}, S = ctx.window.Sandbox || { draw: {}, label: {} };
for (const [id, data] of Object.entries(SBX)) {
  if (!used[id]) bad.push("песочница " + id + " — схемы нет в теории");
  if (!S.draw[id] || !S.label[id]) { bad.push("песочница " + id + ": нет Sandbox.draw/label в sandbox.js"); continue; }
  data.ns.forEach(function (n, i) {
    const svg = S.draw[id](data, i), l = S.label[id](data, i);
    const vb = svg.match(/^<svg[^>]*viewBox="-?[\d.]+ -?[\d.]+ ([\d.]+) /);
    if (!vb || +vb[1] > 340) bad.push(id + " n=" + n + ": нет viewBox или он шире 340");
    if (/NaN|undefined/.test(svg + l.text + l.aria)) bad.push(id + " n=" + n + ": NaN или undefined");
    if (/#[0-9a-f]{3,8}\b|rgba?\(|(fill|stroke)="(?!none)[a-z]/i.test(svg))
      bad.push(id + " n=" + n + ": цвет задан напрямую — только классы .f-*");
    if (l.text.indexOf(String(Math.round(data.sd[i]))) < 0)
      bad.push(id + " n=" + n + ": в подписи нет разброса " + Math.round(data.sd[i]));
  });
}
for (const id of Object.keys(S.draw)) if (!SBX[id]) bad.push("Sandbox.draw[" + id + "] есть, а данных нет — запустите figs.py");
console.log("Песочниц: " + Object.keys(SBX).length);
```

`ctx` уже создан с `window`; `sandbox.js` пишет `window.Sandbox`, поэтому отдельного контекста не нужно.

Run: `node инструменты/checkfigs.js`
Expected: FAIL `песочница clt-means: нет Sandbox.draw/label в sandbox.js`

- [ ] **Step 2: Создать `sandbox.js`**

```js
/* ============================================================
   Песочницы в теории («покрути»)

   Данные — window.SANDBOX (блок FIGS в content-mN.js, пишет
   инструменты/figs.py). draw[id](data, i) рисует положение i
   ползунка строкой SVG, label[id](data, i) — строка чисел и текст
   для диктора. Это чистые функции: их проверяет checkfigs.js в node.
   mount(root) заменяет статичную схему живой — вызывает app.js
   после Figs.mount. Нет данных или функции — остаётся статичная.
   ============================================================ */

window.Sandbox = (function () {
  function fmt(v) { return String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, " "); }

  function histPath(cnt, X, base, h) {
    const hi = Math.max.apply(null, cnt) || 1;
    let d = "M" + X(0).toFixed(1) + " " + base;
    cnt.forEach(function (c, k) {
      const y = (base - h * c / hi).toFixed(1);
      d += " L" + X(k).toFixed(1) + " " + y + " L" + X(k + 1).toFixed(1) + " " + y;
    });
    return d + " L" + X(cnt.length).toFixed(1) + " " + base;
  }

  const label = {
    "clt-means": function (data, i) {
      const n = data.ns[i], sd = fmt(data.sd[i]), sdf = fmt(data.sdf[i]);
      return { text: "n = " + n + " · разброс " + sd + " · по формуле σ/√n " + sdf,
               aria: "n = " + n + ", разброс " + sd };
    }
  };

  const draw = {
    "clt-means": function (data, i) {
      const x1 = 330, base = 170, h = 128;
      const X = function (k) { return x1 * k * data.step / data.top; };   /* k — номер корзины */
      const Xv = function (v) { return x1 * v / data.top; };              /* v — рубли */
      let s = '<svg class="fig-svg" viewBox="-4 0 340 236" role="img" aria-label="' +
              label["clt-means"](data, i).aria + '">';
      s += '<text class="f-hd" x="0" y="14" font-size="12.5">средние 2000 выборок, руб.</text>';
      s += '<path class="f-raw" d="' + histPath(data.bins[0], X, base, h) + '"/>';
      s += '<path class="f-pen" d="' + histPath(data.bins[i], X, base, h) + '"/>';
      s += '<line class="f-row" x1="0" y1="' + base + '" x2="' + x1 + '" y2="' + base + '"/>';
      s += '<path class="f-soft" d="M' + Xv(data.mean).toFixed(1) + ' 26 V' + (base + 4) + '"/>';
      s += '<text class="f-sub" x="' + (Xv(data.mean) + 4).toFixed(1) + '" y="30" font-size="10.5">среднее ' +
           fmt(data.mean) + '</text>';
      [0, 5000, 10000].forEach(function (v) {
        s += '<text class="f-sub" x="' + Xv(v).toFixed(1) + '" y="' + (base + 16) + '" font-size="10.5" text-anchor="' +
             (v ? "middle" : "start") + '">' + fmt(v) + '</text>';
      });
      s += '<text class="f-sub" x="330" y="' + (base + 32) + '" font-size="10.5" text-anchor="end">серым — сами чеки</text>';
      s += '<text class="f-note" x="0" y="' + (base + 56) + '" font-size="15">двигайте n — колокол сужается как √n</text>';
      return s + "</svg>";
    }
  };

  function mount(root) {
    if (!root) return;
    Array.prototype.forEach.call(root.querySelectorAll("figure[data-fig]"), function (f) {
      const id = f.getAttribute("data-fig"), data = (window.SANDBOX || {})[id];
      if (!data || !draw[id] || !label[id] || f.querySelector(".sbx")) return;
      const last = data.ns.length - 1;
      const box = document.createElement("div");
      box.className = "sbx";
      box.innerHTML = '<div class="sbx-pic"></div>' +
        '<input class="sbx-range" type="range" min="0" max="' + last + '" step="1" value="' + data.start +
        '" aria-label="Размер выборки n">' +
        '<div class="sbx-ticks" aria-hidden="true">' + data.ticks.map(function (t) {
          return '<span style="left:' + (100 * data.ns.indexOf(t) / last) + '%">' + t + '</span>';
        }).join("") + '</div>' +
        '<p class="sbx-read" aria-hidden="true"></p>';
      const pic = box.querySelector(".sbx-pic"), range = box.querySelector(".sbx-range"),
            read = box.querySelector(".sbx-read");
      function show(i) {
        const l = label[id](data, i);
        pic.innerHTML = draw[id](data, i);
        read.textContent = l.text;
        range.setAttribute("aria-valuetext", l.aria);
      }
      range.addEventListener("input", function () { show(+range.value); });
      const old = f.querySelector("svg.fig-svg");
      if (old) old.replaceWith(box); else f.insertBefore(box, f.firstChild);
      const cap = f.querySelector("figcaption");
      if (cap && data.caption) cap.textContent = data.caption;
      show(data.start);
    });
  }

  return { draw: draw, label: label, mount: mount };
})();
```

- [ ] **Step 3: Проверка проходит**

Run: `node инструменты/checkfigs.js`
Expected: `Песочниц: 1`, `Ошибок нет.`

- [ ] **Step 4: Подключить файл везде, где перечислены файлы сайта**

- `index.html` — перед `<script src="app.js"></script>`: `<script src="sandbox.js"></script>`
- `build.py`: `EAGER = ("lessons.js", "content-core.js", "glossary.js", "sandbox.js", "app.js")` и цикл встраивания `for name in ("lessons.js", "content-core.js", "glossary.js", "sandbox.js"):`
- `sw.js` — в `SHELL` после `"./glossary.js",`: `"./sandbox.js",`
- `инструменты/ci.sh`: в `syntax()` — `for f in app.js sw.js data.js glossary.js lessons.js sandbox.js content-*.js`; в `version_bumped()` — `sandbox.js` в список файлов сайта после `lessons.js`.

- [ ] **Step 5: Сборка и синтаксис**

Run: `node --check sandbox.js && python3 build.py && grep -c "window.Sandbox = " "Тетрадь аналитика.html"`
Expected: без ошибок, `1`

- [ ] **Step 6: Commit**

```bash
git add sandbox.js инструменты/checkfigs.js index.html build.py sw.js инструменты/ci.sh "Тетрадь аналитика.html"
git commit -m "sandbox.js: рисование песочницы ЦПТ и проверка всех положений в checkfigs"
```

---

### Task 3: Песочница на странице

**Files:**
- Modify: `app.js` (строка после `Figs.mount($("#s-theory .theory"));`), `styles.css` (после `.fig-svg .f-dash`)

**Interfaces:**
- Consumes: `window.Sandbox.mount(root)` из задачи 2.

- [ ] **Step 1: Вызов** — в `app.js` сразу после `Figs.mount($("#s-theory .theory"));`:

```js
  if (window.Sandbox) Sandbox.mount($("#s-theory .theory"));
```

- [ ] **Step 2: Стили** — в `styles.css` после строки `.fig-svg .f-dash …`:

```css
/* Песочница: живая схема + ползунок (sandbox.js) */
.sbx-range { display: block; width: 100%; margin: .6rem 0 0; accent-color: var(--pen); }
.sbx-ticks { position: relative; height: 1.1rem; margin: 0 .55rem; font: 11px var(--sans); color: var(--ink-3); }
.sbx-ticks span { position: absolute; transform: translateX(-50%); }
.sbx-read { margin: .4rem 0 0; font: 13px var(--mono); color: var(--ink-2); text-align: center; }
```

- [ ] **Step 3: Глазами на телефоне (390 px), светлая тема**

Run: `python3 инструменты/devserver.py 8779`, открыть `http://localhost:8779/#m3l2`, сбросить сервис-воркер и кеш.
Expected: одна гистограмма, n = 30, строка «n = 30 · разброс 323 · по формуле σ/√n 316». n = 1 — ручка совпадает с серым контуром, разброс 1 778; n = 5 — «разброс 779 · … 773»; n = 200 — узкий пик. Горизонтальной прокрутки нет. Скриншоты n = 1, 30, 200.

- [ ] **Step 4: Тёмная тема, клавиатура, повторный заход, запасной вариант**

- Тёмная тема: ручка, серый контур, подписи видны.
- Фокус на ползунке, стрелки ←/→ двигают по положениям; `document.querySelector('.sbx-range').getAttribute('aria-valuetext')` меняется.
- Уйти в другой урок и вернуться: ползунок один.
- Запасной вариант: `delete window.SANDBOX["clt-means"]`, заново открыть урок — статичная схема «1 / 5 / 30».

- [ ] **Step 5: Commit**

```bash
git add app.js styles.css
git commit -m "Песочница ЦПТ в уроке 3.1: ползунок вместо статичной схемы"
```

---

### Task 4: Выпуск

**Files:**
- Modify: `sw.js` (`VERSION`), `Тетрадь аналитика.html` (пересборка)

- [ ] **Step 1: Версия и сборка** — `VERSION` в `sw.js`: следующая буква после версии на main (при слитых #31 и #32 там `2026-09-28h`, значит `2026-09-28i`). Затем `python3 build.py`.

- [ ] **Step 2: Полная проверка**

Run: `bash инструменты/ci.sh`
Expected: все шаги `✓`.

- [ ] **Step 3: Commit, push, PR**

```bash
git add sw.js "Тетрадь аналитика.html"
git commit -m "Песочница ЦПТ: выпуск 2026-09-28i"
git push -u origin stage3-sandbox-clt
gh pr create --base main --title "Песочница ЦПТ в уроке 3.1" --body "<что сделано, чем проверено>"
```

Дождаться зелёной «Проверки курса», дать владельцу команду слияния для Run.
