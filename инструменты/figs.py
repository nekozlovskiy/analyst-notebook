#!/usr/bin/env python3
"""Схемы в теории уроков (стиль «Тетрадь»).

Строит SVG из настоящих строк базы курса и записывает их блоком
/* FIGS:BEGIN … FIGS:END */ в content-mN.js как window.FIGS[id].
Цветов в SVG нет — только классы .f-* (styles.css, раздел «Схемы»),
поэтому тёмная тема работает сама. viewBox шириной W: схема рисуется
под телефон и на компьютере не растягивается шире 520 px. Рисовать
в пределах x от 0 до W - PAD: слева PAD уходит на поле.

    python3 инструменты/figs.py m1           # пересобрать схемы модуля 1
    python3 инструменты/figs.py m1 --check   # только сверить числа с базой
"""
import html
import json
import pathlib
import re
import sqlite3
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
DB = ROOT / "инструменты" / "shop.db"
W = 340
PAD = 4     # поле слева: рамка на x = 0 и почерк, выступающий левее точки, не обрезаются


def esc(s):
    return html.escape(str(s), quote=True)


def num(v):
    """Число так, как его показывает SQLite в курсе: 2822.77, 15301.0."""
    return repr(round(float(v), 2))


def db():
    return sqlite3.connect(DB)


class Svg:
    def __init__(self, fid, h, title, desc):
        self.fid, self.h, self.title, self.desc = fid, h, title, desc
        self.parts = []

    def text(self, x, y, s, cls="f-t", size=12.5, anchor=None):
        a = f' text-anchor="{anchor}"' if anchor else ""
        self.parts.append(f'<text class="{cls}" x="{x:g}" y="{y:g}" font-size="{size:g}"{a}>{esc(s)}</text>')

    def line(self, x1, y1, x2, y2, cls="f-row"):
        self.parts.append(f'<line class="{cls}" x1="{x1:g}" y1="{y1:g}" x2="{x2:g}" y2="{y2:g}"/>')

    def rect(self, x, y, w, h, cls="f-box", rx=5, extra=""):
        self.parts.append(f'<rect class="{cls}" x="{x:g}" y="{y:g}" width="{w:g}" height="{h:g}" rx="{rx:g}"{extra}/>')

    def path(self, d, cls="f-pen"):
        self.parts.append(f'<path class="{cls}" d="{d}"/>')

    def circle(self, cx, cy, r, cls="f-pen-fill"):
        self.parts.append(f'<circle class="{cls}" cx="{cx:g}" cy="{cy:g}" r="{r:g}"/>')

    def note(self, x, y, lines, size=15):
        for i, s in enumerate(lines):
            self.text(x, y + i * (size + 3), s, "f-note", size)

    def render(self):
        t, d = f"fig-{self.fid}-t", f"fig-{self.fid}-d"
        return (f'<svg class="fig-svg" viewBox="{-PAD} 0 {W} {self.h:g}" role="img" aria-labelledby="{t} {d}">'
                f'<title id="{t}">{esc(self.title)}</title><desc id="{d}">{esc(self.desc)}</desc>'
                + "".join(self.parts) + "</svg>")


def table(svg, x, y, w, title, cols, rows, row_h=26):
    """Таблица-рамка: заголовок над ней, подписи столбцов, строки.
    cols — [(подпись, dx, anchor)]: столбец стоит на x + dx, числа
    прижимают вправо (anchor="end"). Пробелами выравнивать нельзя —
    SVG схлопывает их. rows — кортежи значений. Возвращает центры
    строк по y."""
    svg.text(x + 2, y - 7, title, "f-hd", 12.5)
    hh = 22 if any(c[0] for c in cols) else 0      # без подписей столбцов — без пустой полосы
    h = hh + row_h * len(rows)
    svg.rect(x, y, w, h)
    for label, dx, anchor in cols:
        svg.text(x + dx, y + 15, label, "f-sub", 10.5, anchor)
    mids = []
    for i, r in enumerate(rows):
        top = y + hh + i * row_h
        if i or hh:
            svg.line(x, top, x + w, top)
        for (_, dx, anchor), v in zip(cols, r):
            svg.text(x + dx, top + row_h / 2 + 4.5, v, anchor=anchor)
        mids.append(top + row_h / 2)
    return mids


# ---------------------------------------------------------------- схемы m1

def fig_sql_order():
    written = ["SELECT", "FROM / JOIN", "WHERE", "GROUP BY", "HAVING", "ORDER BY", "LIMIT"]
    run = ["FROM / JOIN", "WHERE", "GROUP BY", "HAVING", "SELECT", "ORDER BY", "LIMIT"]
    svg = Svg("sql-order", 262,
              "Порядок записи и порядок выполнения SQL-запроса",
              "Пишем: SELECT, FROM, WHERE, GROUP BY, HAVING, ORDER BY, LIMIT. "
              "Выполняется: FROM и JOIN, WHERE, GROUP BY, HAVING, SELECT вместе с оконными функциями, ORDER BY, LIMIT. "
              "Поэтому псевдоним из SELECT нельзя использовать в WHERE: на этом шаге его ещё нет.")
    svg.text(0, 14, "пишем", "f-hd", 12.5)
    svg.text(196, 14, "выполняется", "f-hd", 12.5)
    y0, step = 34, 26
    ly = {}
    for i, w in enumerate(written):
        y = y0 + i * step
        svg.rect(0, y - 15, 118, 22, rx=4)
        svg.text(8, y, w)
        ly[w] = y - 4
    ry = {}
    for i, w in enumerate(run):
        y = y0 + i * step
        svg.rect(196, y - 15, 140, 22, rx=4)
        svg.text(204, y, f"{i + 1} {w}")
        ry[w] = y - 4
    svg.text(332, ry["SELECT"] + 4, "+ окна", "f-sub", 10.5, anchor="end")
    for w in written:
        cls = "f-pen" if w == "SELECT" else "f-soft"
        svg.path(f"M118 {ly[w]:g} C 157 {ly[w]:g}, 157 {ry[w]:g}, 196 {ry[w]:g}", cls)
    svg.note(0, 222, ["псевдоним из SELECT ещё", "не существует в WHERE"])
    return svg.render()


def join_data():
    """Пользователь с наименьшим id ровно с двумя заказами (любого статуса:
    JOIN в уроке без фильтра) и следующий за ним — ровно с одним."""
    c = db()
    two = c.execute("SELECT user_id FROM orders GROUP BY user_id HAVING COUNT(*) = 2 "
                    "ORDER BY user_id LIMIT 1").fetchone()[0]
    one = c.execute("SELECT user_id FROM orders GROUP BY user_id HAVING COUNT(*) = 1 AND user_id > ? "
                    "ORDER BY user_id LIMIT 1", (two,)).fetchone()[0]
    users = c.execute("SELECT user_id, city FROM users WHERE user_id IN (?, ?) ORDER BY user_id",
                      (two, one)).fetchall()
    orders = c.execute("SELECT user_id, revenue FROM orders WHERE user_id IN (?, ?) "
                       "ORDER BY user_id, order_date", (two, one)).fetchall()
    return users, orders


def fig_join_rows():
    users, orders = join_data()
    city = dict(users)
    dup = users[0][0]
    svg = Svg("join-rows", 318,
              "JOIN соединяет строки двух таблиц",
              f"У пользователя {dup} два заказа, у пользователя {users[1][0]} один. "
              f"После JOIN пользователь {dup} встречается в результате дважды: строк стало три, хотя пользователей два.")
    um = table(svg, 0, 22, 156, "users", [("user_id", 8, None), ("city", 54, None)],
               [(u, c) for u, c in users])
    om = table(svg, 234, 22, 102, "orders", [("user_id", 8, None), ("revenue", 94, "end")],
               [(u, num(r)) for u, r in orders])
    ui = {u: um[i] for i, (u, _) in enumerate(users)}
    for i, (u, _) in enumerate(orders):
        a, b = ui[u], om[i]
        svg.path(f"M156 {a:g} C 195 {a:g}, 195 {b:g}, 234 {b:g}")
    svg.circle(156, ui[dup], 3.4)
    table(svg, 0, 176, 214, "users JOIN orders",
          [("user_id", 8, None), ("city", 54, None), ("revenue", 206, "end")],
          [(u, city[u], num(r)) for u, r in orders])
    svg.note(0, 300, [f"у {dup}-го два заказа — две строки"])
    return svg.render()


def window_data():
    """Два первых пользователя с 3–4 оплаченными заказами; накопительная
    сумма — тем же окном, что в уроке."""
    c = db()
    ids = [r[0] for r in c.execute(
        "SELECT user_id FROM orders WHERE status = 'paid' GROUP BY user_id "
        "HAVING COUNT(*) BETWEEN 3 AND 4 ORDER BY user_id LIMIT 2")]
    return c.execute(
        "SELECT user_id, order_date, revenue, "
        "SUM(revenue) OVER (PARTITION BY user_id ORDER BY order_date) "
        "FROM orders WHERE status = 'paid' AND user_id IN (?, ?) "
        "ORDER BY user_id, order_date", ids).fetchall()


def fig_window_frame():
    rows = window_data()
    n1 = sum(1 for r in rows if r[0] == rows[0][0])
    y, rh, w = 22, 26, 282
    svg = Svg("window-frame", y + 22 + rh * len(rows) + 54,
              "Окна PARTITION BY user_id и накопительная сумма",
              "Оплаченные заказы двух пользователей по дате. SUM(revenue) OVER (PARTITION BY user_id ORDER BY order_date) "
              "копит сумму внутри окна пользователя и начинается заново в следующем окне: "
              f"{num(rows[n1 - 1][3])} у первого, {num(rows[-1][3])} у второго.")
    table(svg, 0, y, w, "orders, оплаченные",
                 [("user_id", 8, None), ("order_date", 54, None), ("revenue", 190, "end"), ("накопительно", 274, "end")],
                 [(u, d, num(r), num(s)) for u, d, r, s in rows])
    # граница окон — ручкой: здесь сумма начинается заново
    cut = y + 22 + n1 * rh
    svg.line(0, cut, w, cut, "f-pen")
    # рамка третьей строки второго окна: от начала окна до текущей строки
    a, b = cut + 3, cut + 3 * rh - 3
    svg.path(f"M{w + 5} {a:g} h7 V{b:g} h-7")
    svg.text(w + 15, (a + b) / 2 + 4, "рамка", "f-sub", 10.5)
    svg.note(0, y + 22 + rh * len(rows) + 26, ["сумма начинается заново", "в каждом окне"])
    return svg.render()


LAST_FULL = "2024-09-01"   # заказы в базе по 11.09.2024: август — последний полный месяц


def cohort_data():
    """Доля когорты, купившей хотя бы раз к концу N-го месяца жизни
    (N = 0 — месяц регистрации). Месяц, не прожитый целиком, — None."""
    c = db()
    out = []
    for cm, cs, n in c.execute(
            "SELECT strftime('%Y-%m', signup_date), date(signup_date, 'start of month'), COUNT(*) "
            "FROM users GROUP BY 1 ORDER BY 1").fetchall():
        vals = []
        for k in range(6):
            end = c.execute("SELECT date(?, ?)", (cs, f"+{k + 1} month")).fetchone()[0]
            if end > LAST_FULL:
                vals.append(None)
                continue
            got = c.execute(
                "SELECT COUNT(*) FROM users u WHERE strftime('%Y-%m', u.signup_date) = ? AND EXISTS ("
                "SELECT 1 FROM orders o WHERE o.user_id = u.user_id AND o.status = 'paid' AND o.order_date < ?)",
                (cm, end)).fetchone()[0]
            vals.append(round(got * 100.0 / n, 1))
        out.append((cm, n, vals))
    return out


def fig_cohort_triangle():
    data = cohort_data()
    top = max(v for _, _, vs in data for v in vs if v is not None)
    lx, cw, rh, y0 = 58, 46, 26, 30
    h = y0 + rh * len(data) + 64
    svg = Svg("cohort-triangle", h,
              "Когортная таблица: доля купивших по месяцам жизни",
              "Строки — когорты по месяцу регистрации, столбцы — месяцы жизни от 0 до 5, в ячейке — процент когорты, "
              "купившей хотя бы раз к концу этого месяца. "
              f"Мартовская когорта дошла до {data[2][2][3]:g}%, январская остановилась на {data[0][2][1]:g}%. "
              "Правый нижний угол пуст: свежие когорты ещё не прожили эти месяцы.")
    svg.text(0, 14, "когорта", "f-hd", 12)
    for k in range(6):
        svg.text(lx + k * cw + cw / 2, 14, f"мес {k}", "f-sub", 10.5, anchor="middle")
    svg.line(0, y0 - 8, lx + 6 * cw, y0 - 8)
    for i, (cm, n, vals) in enumerate(data):
        y = y0 + i * rh
        svg.text(0, y + 12, cm, "f-t", 11.5)
        for k, v in enumerate(vals):
            if v is None:
                continue
            x = lx + k * cw
            op = 0.06 + 0.24 * v / top
            svg.rect(x + 1, y - 4, cw - 2, rh - 2, "f-tint", 3, f' fill-opacity="{op:.2f}"')
            svg.text(x + cw / 2, y + 12, f"{v:g}", "f-t", 11.5, anchor="middle")
    # стрелка от реплики в пустой угол (месяцы 4–5 у майской и июньской когорт)
    ex, ey = lx + 4.5 * cw, y0 + 4.5 * rh
    sy = y0 + rh * len(data) + 22
    svg.path(f"M{ex - 40:g} {sy:g} C {ex - 10:g} {sy:g}, {ex:g} {sy - 14:g}, {ex:g} {ey + 8:g}")
    svg.note(0, y0 + rh * len(data) + 30, ["у свежих когорт хвоста ещё нет —", "это не падение"])
    return svg.render()


FIGS_M1 = {
    "sql-order": fig_sql_order,
    "join-rows": fig_join_rows,
    "window-frame": fig_window_frame,
    "cohort-triangle": fig_cohort_triangle,
}


# ---------------------------------------------------------------- проверка чисел

def check_m1():
    """Числа, которые стоят на схемах, — ровно те, что даёт база."""
    errs = []
    users, orders = join_data()
    if users != [(16, "Новосибирск"), (21, "Екатеринбург")]:
        errs.append(f"join-rows: пользователи {users}")
    if [(u, num(r)) for u, r in orders] != [(16, "2822.77"), (16, "1931.78"), (21, "5886.6")]:
        errs.append(f"join-rows: заказы {orders}")
    w = window_data()
    if [(u, d, num(r), num(s)) for u, d, r, s in w] != [
            (1, "2024-06-20", "2997.2", "2997.2"), (1, "2024-07-22", "4968.24", "7965.44"),
            (1, "2024-08-18", "1994.76", "9960.2"), (3, "2024-04-23", "1361.84", "1361.84"),
            (3, "2024-05-26", "9071.54", "10433.38"), (3, "2024-07-08", "3071.02", "13504.4"),
            (3, "2024-07-31", "1796.6", "15301.0")]:
        errs.append(f"window-frame: {w}")
    want = [
        ("2024-01", 33, [15.2, 45.5, 45.5, 45.5, 45.5, 45.5]),
        ("2024-02", 34, [11.8, 35.3, 38.2, 38.2, 38.2, 38.2]),
        ("2024-03", 49, [20.4, 55.1, 61.2, 63.3, 63.3, 63.3]),
        ("2024-04", 34, [11.8, 41.2, 47.1, 47.1, 47.1, None]),
        ("2024-05", 44, [9.1, 38.6, 45.5, 45.5, None, None]),
        ("2024-06", 26, [11.5, 30.8, 34.6, None, None, None]),
    ]
    got = cohort_data()
    if got != want:
        errs.append(f"cohort-triangle: {got}")
    return errs


# ---------------------------------------------------------------- запись

def write_block(module, figs):
    p = ROOT / f"content-{module}.js"
    s = p.read_text(encoding="utf8")
    body = "window.FIGS = window.FIGS || {};\n" + "".join(
        f"window.FIGS[{json.dumps(k)}] = {json.dumps(v, ensure_ascii=False)};\n" for k, v in figs.items())
    block = ("/* FIGS:BEGIN — схемы генерирует инструменты/figs.py, руками не править */\n"
             + body + "/* FIGS:END */")
    if "/* FIGS:BEGIN" in s:
        s = re.sub(r"/\* FIGS:BEGIN.*?/\* FIGS:END \*/", lambda m: block, s, flags=re.S)
    else:
        s = s.rstrip("\n") + "\n\n" + block + "\n"
    p.write_text(s, encoding="utf8")


# ---------------------------------------------------------------- схемы m2

def groupby_data():
    """По два первых оплаченных заказа трёх каналов — маленький пример,
    на котором видно все три шага groupby. Суммы — по этим шести строкам."""
    c = db()
    src = c.execute(
        "SELECT order_id, channel, revenue FROM ("
        " SELECT o.order_id, u.channel, o.revenue,"
        "  ROW_NUMBER() OVER (PARTITION BY u.channel ORDER BY o.order_id) AS rn"
        " FROM orders o JOIN users u USING (user_id)"
        " WHERE o.status = 'paid' AND u.channel IN ('organic', 'paid_search', 'social'))"
        " WHERE rn <= 2 ORDER BY order_id").fetchall()
    sums = {}
    for _, ch, r in src:
        sums[ch] = sums.get(ch, 0) + r
    return src, sorted((ch, round(v, 2)) for ch, v in sums.items())


def fig_groupby_sac():
    src, sums = groupby_data()
    groups = [ch for ch, _ in sums]
    rh = 24
    svg = Svg("groupby-sac", 420,
              "groupby: разделить, посчитать, собрать",
              "Шесть заказов трёх каналов. groupby сначала раскладывает строки по группам channel, "
              "потом считает сумму revenue в каждой группе отдельно, потом собирает по строке на группу: "
              + ", ".join(f"{ch} {num(v)}" for ch, v in sums) + ".")
    srcm = table(svg, 0, 22, 168, "orders", [("channel", 8, None), ("revenue", 160, "end")],
                 [(ch, num(r)) for _, ch, r in src], row_h=rh)
    svg.text(196, 15, "1 разделить", "f-hd", 12.5)
    svg.text(334, 15, "2 сумма", "f-hd", 12.5, anchor="end")
    gm = {}
    for i, ch in enumerate(groups):
        top = 40 + i * 66
        svg.text(198, top - 5, ch, "f-sub", 10.5)
        svg.rect(196, top, 70, 2 * rh)
        svg.line(196, top + rh, 266, top + rh)
        rows = [r for _, c2, r in src if c2 == ch]
        for k, r in enumerate(rows):
            svg.text(260, top + k * rh + rh / 2 + 4.5, num(r), anchor="end")
        gm[ch] = [top + rh / 2, top + rh * 1.5]
        mid = top + rh
        svg.path(f"M268 {mid:g} h8")
        svg.text(334, mid + 4.5, num(dict(sums)[ch]), "f-pen-t", anchor="end")
    used = {ch: 0 for ch in groups}
    for i, (_, ch, _) in enumerate(src):
        a, b = srcm[i], gm[ch][used[ch]]
        used[ch] += 1
        svg.path(f"M168 {a:g} C 182 {a:g}, 182 {b:g}, 196 {b:g}", "f-soft")
    svg.text(0, 250, "3 собрать", "f-hd", 12.5)
    table(svg, 0, 276, 200, 'groupby("channel")["revenue"].sum()',
          [("channel", 8, None), ("revenue", 192, "end")],
          [(ch, num(v)) for ch, v in sums], row_h=rh)
    svg.note(0, 394, ["в каждой группе — своя маленькая таблица,", "от неё остаётся одна строка"])
    return svg.render()


def iqr_data():
    """Квартили оплаченных чеков так, как их считает pandas (quantile,
    линейная интерполяция), граница q3 + 1.5 * IQR и что за ней."""
    r = sorted(v for (v,) in db().execute("SELECT revenue FROM orders WHERE status = 'paid'"))

    def q(p):
        i = (len(r) - 1) * p
        lo = int(i)
        return r[lo] + (r[min(lo + 1, len(r) - 1)] - r[lo]) * (i - lo)

    q1, med, q3 = q(.25), q(.5), q(.75)
    iqr = q3 - q1
    hi = q3 + 1.5 * iqr
    out = [v for v in r if v > hi]
    return {"n": len(r), "q1": q1, "med": med, "q3": q3, "iqr": iqr, "hi": hi, "out": out,
            "top": max(v for v in r if v <= hi), "low": r[0], "share": sum(out) / sum(r) * 100}


def fig_iqr_box():
    d = iqr_data()
    k = 330 / 11000                    # 0…11 000 рублей: самый крупный чек около 10 тысяч
    X = lambda v: v * k
    y0, h = 48, 36                     # ящик
    cy = y0 + h / 2
    svg = Svg("iqr-box", 318,
              "Ящик с усами и граница выбросов по методу IQR",
              f"Оплаченные чеки, {d['n']} заказов. Ящик — от первого квартиля {num(d['q1'])} до третьего {num(d['q3'])}, "
              f"внутри медиана {num(d['med'])}. Граница q3 + 1.5 × IQR = {num(d['hi'])} рубля. "
              f"За ней {len(d['out'])} заказов — {d['share']:.1f}% всей выручки.")
    svg.text(0, 14, "оплаченные чеки, руб.", "f-hd", 12.5)
    # ус, ящик, медиана
    svg.line(X(d["low"]), cy, X(d["q1"]), cy, "f-box")
    svg.line(X(d["q3"]), cy, X(d["top"]), cy, "f-box")
    for v in (d["low"], d["top"]):
        svg.line(X(v), cy - 8, X(v), cy + 8, "f-box")
    svg.rect(X(d["q1"]), y0, X(d["q3"]) - X(d["q1"]), h, rx=2)
    svg.line(X(d["med"]), y0, X(d["med"]), y0 + h, "f-box")
    # граница и выбросы
    svg.path(f"M{X(d['hi']):.1f} {y0 - 18} V{y0 + h + 10}")
    svg.text(X(d["hi"]) + 4, y0 - 8, num(d["hi"]), "f-pen-t", 11.5)
    for i, v in enumerate(d["out"]):
        svg.circle(X(v), cy + (-6 if i % 2 else 6), 3)
    svg.text(X(d["out"][-1]) - 20, y0 + h + 22, f"{len(d['out'])} выбросов", "f-pen-t", 11.5, anchor="end")
    # ось
    ay = y0 + h + 36
    svg.line(0, ay, 330, ay, "f-row")
    for v in (0, 5000, 10000):
        svg.line(X(v), ay, X(v), ay + 4, "f-row")
        svg.text(X(v), ay + 16, f"{v:,}".replace(",", " "), "f-sub", 10.5,
                 anchor="start" if v == 0 else "middle")
    table(svg, 0, ay + 48, 300, "как считается граница",
          [("", 8, None), ("", 292, "end")],
          [("q1 — 25%", num(d["q1"])), ("медиана — 50%", num(d["med"])), ("q3 — 75%", num(d["q3"])),
           ("IQR = q3 − q1", num(d["iqr"])), ("граница = q3 + 1.5 × IQR", num(d["hi"]))], row_h=22)
    svg.note(0, 308, [f"{len(d['out'])} заказов — {d['share']:.1f}% выручки: не выбрасывать"], 14)
    return svg.render()


FIGS_M2 = {
    "groupby-sac": fig_groupby_sac,
    "iqr-box": fig_iqr_box,
}


def check_m2():
    errs = []
    src, sums = groupby_data()
    if [(o, ch, num(r)) for o, ch, r in src] != [
            (1, "organic", "2997.2"), (2, "organic", "4968.24"), (8, "social", "5096.46"),
            (26, "social", "3670.6"), (40, "paid_search", "3368.34"), (42, "paid_search", "3734.48")]:
        errs.append(f"groupby-sac: строки {src}")
    if [(ch, num(v)) for ch, v in sums] != [
            ("organic", "7965.44"), ("paid_search", "7102.82"), ("social", "8767.06")]:
        errs.append(f"groupby-sac: суммы {sums}")
    q = iqr_data()
    got = (q["n"], num(q["q1"]), num(q["med"]), num(q["q3"]), num(q["iqr"]), num(q["hi"]),
           len(q["out"]), num(q["top"]), num(q["low"]), f"{q['share']:.1f}")
    if got != (189, "2136.56", "2997.2", "4260.25", "2123.69", "7445.78", 7, "7437.5", "791.47", "9.4"):
        errs.append(f"iqr-box: {got}")
    return errs


MODULES = {"m1": (FIGS_M1, check_m1), "m2": (FIGS_M2, check_m2)}

if __name__ == "__main__":
    mod = sys.argv[1] if len(sys.argv) > 1 else ""
    if mod not in MODULES:
        sys.exit("укажите модуль: " + ", ".join(MODULES))
    figs, check = MODULES[mod]
    errs = check()
    if errs:
        sys.exit("Числа не сошлись с базой:\n" + "\n".join(errs))
    if "--check" in sys.argv:
        print("Числа сходятся с базой.")
        sys.exit(0)
    write_block(mod, {k: f() for k, f in figs.items()})
    print(f"content-{mod}.js: схем {len(figs)} — " + ", ".join(figs))
