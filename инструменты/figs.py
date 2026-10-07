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
import math
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


# Положения песочницы рамки: (две строки ROWS BETWEEN …, реплика почерком).
FRAMES = [
    ("CURRENT ROW", "AND CURRENT ROW", "рамка — одна текущая строка"),
    ("1 PRECEDING", "AND CURRENT ROW", "текущая и одна перед ней"),
    ("2 PRECEDING", "AND CURRENT ROW", "скользящая сумма за 3 строки"),
    ("UNBOUNDED PRECEDING", "AND CURRENT ROW", "так по умолчанию при ORDER BY"),
    ("UNBOUNDED PRECEDING", "AND UNBOUNDED FOLLOWING", "всё окно в каждой строке"),
]


def frame_sandbox():
    """Песочница урока 1.2: те же строки, что в схеме window-frame; столбец
    «в рамке» для каждой рамки считает сама SQLite. span — рамка последней
    строки второго окна (номера строк с нуля)."""
    rows = window_data()
    c = db()
    ids = sorted({r[0] for r in rows})
    sums, spans = [], []
    last = len(rows) - 1
    start = next(k for k, r in enumerate(rows) if r[0] == rows[-1][0])
    for a, b, _ in FRAMES:
        clause = "ROWS BETWEEN " + ("CURRENT ROW" if a == "CURRENT ROW" else a) + " " + b
        got = [v for (v,) in c.execute(
            f"SELECT SUM(revenue) OVER (PARTITION BY user_id ORDER BY order_date {clause}) "
            "FROM orders WHERE status = 'paid' AND user_id IN (?, ?) ORDER BY user_id, order_date", ids)]
        sums.append([num(v) for v in got])
        k = {"CURRENT ROW": 0, "1 PRECEDING": 1, "2 PRECEDING": 2}.get(a, last)
        spans.append([max(start, last - k), last])
    return {"pos": [f[0] + " " + f[1] for f in FRAMES], "start": 3, "name": "Рамка окна",
            "ticks": [[0, "0"], [1, "1"], [2, "2"], [3, "с начала"], [4, "всё окно"]],
            "frames": [[a, b, n] for a, b, n in FRAMES],
            "rows": [[u, d, num(r)] for u, d, r, _ in rows], "cut": start,
            "sums": sums, "span": spans, "expect": [v[-1] for v in sums],
            "caption": "Рис. Двигайте ползунок: рамка ROWS BETWEEN решает, какие строки окна попадут в сумму "
                       "для текущей строки. Окно — PARTITION BY user_id, рамка никогда не выходит за его границу"}


SANDBOX_M1 = {"window-frame": frame_sandbox}


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


# Игрушечные заказы к уроку 1.1: клиент, статус, сумма. Смысл схемы —
# без WHERE у B было бы 7000 и группа прошла бы HAVING.
WH_ORDERS = [("A", "paid", 1000), ("A", "paid", 3000), ("B", "paid", 2000),
             ("B", "cancelled", 5000), ("C", "paid", 1000), ("C", "paid", 2000),
             ("C", "paid", 3000)]
WH_LIMIT = 3000


def where_having_data():
    sums = {}
    for u, st, r in WH_ORDERS:
        if st == "paid":
            sums[u] = sums.get(u, 0) + r
    return sums


def fig_where_having():
    sums = where_having_data()
    w, rh, ax = 170, 20, 184                        # ширина таблиц, строка, колонка подписей
    rub = lambda v: f"{v:,}".replace(",", " ")
    svg = Svg("where-having", 392,
              "WHERE фильтрует строки до группировки, HAVING — группы после",
              "Семь заказов трёх клиентов. WHERE status = paid выбрасывает отменённый заказ клиента B "
              "на 5 000 ещё до группировки. GROUP BY user_id сжимает строки: одна строка — один клиент, "
              f"суммы A {rub(sums['A'])}, B {rub(sums['B'])}, C {rub(sums['C'])}. "
              f"HAVING SUM(revenue) >= {rub(WH_LIMIT)} выбрасывает целую группу B. Без WHERE у B было бы "
              "7 000, и группа прошла бы фильтр.")
    mids = table(svg, 0, 30, w, "orders: строка = заказ",
                 [("user", 12, "start"), ("status", 44, "start"), ("revenue", w - 10, "end")],
                 [(u, st, rub(r)) for u, st, r in WH_ORDERS], rh)
    k = next(i for i, o in enumerate(WH_ORDERS) if o[1] != "paid")
    svg.line(4, mids[k], w - 4, mids[k], "f-pen")
    svg.text(ax, mids[k] - 4, "WHERE", "f-pen-t", 11.5)
    svg.text(ax, mids[k] + 11, "status = 'paid'", "f-pen-t", 11.5)
    svg.text(ax, mids[k] + 26, "строку выбросили", "f-sub", 10.5)
    svg.text(ax, mids[k] + 40, "до группировки", "f-sub", 10.5)
    top2 = mids[-1] + rh / 2 + 44
    svg.text(w / 2, top2 - 26, "↓ GROUP BY user_id", "f-hd", 11.5, anchor="middle")
    g = sorted(sums.items())
    mids2 = table(svg, 0, top2 + 14, w, "строка = клиент",
                  [("user", 12, "start"), ("SUM(revenue)", w - 10, "end")],
                  [(u, rub(v)) for u, v in g], rh)
    for (u, v), m in zip(g, mids2):
        if v < WH_LIMIT:
            svg.line(4, m, w - 4, m, "f-pen")
            svg.text(ax, m - 11, "HAVING", "f-pen-t", 11.5)
            svg.text(ax, m + 4, "SUM(revenue)", "f-pen-t", 11.5)
            svg.text(ax, m + 19, f">= {rub(WH_LIMIT)}", "f-pen-t", 11.5)
            svg.text(ax, m + 34, "выбросили всю группу", "f-sub", 10.5)
    svg.note(0, mids2[-1] + 44, ["без WHERE у B было бы 7 000 —", "и группа прошла бы HAVING"], 15)
    return svg.render()


def cte_avg():
    return db().execute(
        "WITH paid AS (SELECT * FROM orders WHERE status = 'paid'), "
        "per_user AS (SELECT user_id, SUM(revenue) AS total FROM paid GROUP BY user_id) "
        "SELECT ROUND(AVG(total), 2) FROM per_user").fetchone()[0]


def fig_cte_chain():
    """Пример из теории урока 1.5 как конвейер. Числа строк не пишем:
    189 оплаченных — ответ шага практикума, вместо них стопки черт."""
    avg = cte_avg()
    money = f"{avg:,.2f}".replace(",", " ").replace(".", ",")
    steps = [("orders", "строка = заказ", 6, None),
             ("paid", "строка = оплаченный заказ", 5, "WHERE status = 'paid'"),
             ("per_user", "строка = клиент", 3, "GROUP BY user_id, SUM"),
             ("итог", f"одна строка: {money}", 1, "AVG(total)")]
    bw, bh, gap, y = 118, 46, 32, 30
    svg = Svg("cte-chain", 366,
              "CTE как конвейер именованных шагов",
              "Запрос из примера читается сверху вниз: таблица orders, где строка — заказ; шаг paid "
              "оставляет только оплаченные заказы; шаг per_user сворачивает их до одной строки на клиента "
              f"с суммой; финальный SELECT усредняет суммы и возвращает одну строку, {money} рубля. "
              "С каждым шагом строк меньше, а смысл строки меняется.")
    svg.text(0, 14, "WITH читается сверху вниз", "f-hd", 12.5)
    for i, (name, sub, n, op) in enumerate(steps):
        if op:
            svg.path(f"M{bw / 2} {y - gap + 4} V{y - 4}", "f-soft")
            svg.text(bw / 2 + 10, y - gap / 2 + 4, op, "f-pen-t", 11.5)
        svg.rect(0, y, bw, bh, "f-pen" if i == len(steps) - 1 else "f-box", 5)
        svg.text(10, y + 18, name, "f-hd", 12)
        for k in range(n):                          # стопка «строк»: чем меньше, тем короче
            svg.line(10, y + 27 + k * 3.2, 10 + 16 * n, y + 27 + k * 3.2, "f-raw")
        svg.text(bw + 12, y + bh / 2 + 4, sub, "f-sub", 10.5)
        y += bh + gap
    svg.note(0, y + 4, ["каждый шаг можно запустить отдельно:"], 15)
    svg.text(0, y + 24, "SELECT * FROM paid;", "f-pen-t", 11.5)
    return svg.render()


CORR_USERS = (16, 20)                               # не 3, 13, 103, 215 — они в тренажёре 1.5


def corr_data():
    q = ",".join("?" * len(CORR_USERS))
    rows = db().execute(f"SELECT user_id, order_id, order_date FROM orders WHERE user_id IN ({q}) "
                        "ORDER BY user_id, order_date", CORR_USERS).fetchall()
    last = {u: max(d for uu, _, d in rows if uu == u) for u in CORR_USERS}
    return rows, last


def fig_corr_subquery():
    rows, last = corr_data()
    w, rh, ax = 150, 26, 166
    svg = Svg("corr-subquery", 270,
              "Коррелированный подзапрос выполняется для каждой строки",
              f"Пять заказов двух пользователей, {CORR_USERS[0]} и {CORR_USERS[1]}. Для каждой строки внешнего "
              "запроса подзапрос запускается заново и ищет последнюю дату заказов этого пользователя. "
              "Строка остаётся, если её дата совпала с найденной: по одной на пользователя. "
              "Пять строк снаружи — пять запусков внутри.")
    mids = table(svg, 0, 30, w, "FROM orders o",
                 [("user_id", 12, "start"), ("order_date", w - 10, "end")],
                 [(str(u), d) for u, _, d in rows], rh)
    svg.text(ax, 23, "подзапрос для строки", "f-hd", 12.5)
    for i, ((u, _, d), m) in enumerate(zip(rows, mids)):
        ok = d == last[u]
        svg.text(ax, m + 4, f"{i + 1}) MAX у {u} = {last[u][5:]}", "f-pen-t" if ok else "f-sub",
                 11.5 if ok else 10.5)
        svg.text(330, m + 4, "✓" if ok else "✗", "f-pen-t" if ok else "f-sub", 12.5, anchor="end")
        if ok:
            svg.rect(1, m - rh / 2 + 2, w - 2, rh - 4, "f-pen", 4)
    y = mids[-1] + rh / 2 + 26
    svg.text(330, y, f"{len(rows)} строк снаружи — {len(rows)} запусков внутри", "f-sub", 10.5, anchor="end")
    svg.note(0, y + 30, ["на миллионе строк — миллион запусков;", "окно справится за один проход"], 15)
    return svg.render()


def storage_data():
    """Три заказа со схемы JOIN (пользователи 16 и 21): id, пользователь, выручка."""
    return db().execute("SELECT order_id, user_id, revenue FROM orders WHERE user_id IN (16, 21) "
                        "ORDER BY order_id").fetchall()


def fig_row_vs_column():
    rows = storage_data()
    cw, ch, gap = 25.5, 26, 8                       # ячейка и зазор между группами
    cols = ["order_id", "user_id", "revenue", "…"]
    val = lambda r, j: ("…" if j == 3 else f"{r[2]:.0f}" if j == 2 else str(r[j]))
    svg = Svg("row-vs-column", 262,
              "Хранение по строкам и по колонкам",
              "Три заказа лежат на диске двумя способами. По строкам: подряд идут все поля первого "
              "заказа, потом второго, потом третьего. По колонкам: подряд идут все номера заказов, "
              "потом все пользователи, потом все суммы. Запрос SUM(revenue) в строковой базе читает "
              "все двенадцать ячеек, включая остальные колонки, а в колоночной — только три ячейки revenue.")
    svg.text(0, 14, "что читает SELECT SUM(revenue)", "f-hd", 12.5)

    def strip(y, title, groups, labels, hot):
        svg.text(0, y - 8, title, "f-hd", 11.5)
        x = 0
        for g, (cells, lab) in enumerate(zip(groups, labels)):
            for k, (v, is_hot) in enumerate(cells):
                svg.rect(x, y, cw, ch, "f-pen" if is_hot else "f-box", 2)
                svg.text(x + cw / 2, y + ch / 2 + 4, v, "f-pen-t" if is_hot else "f-sub",
                         9.5, anchor="middle")
                x += cw
            svg.text(x - len(cells) * cw / 2, y + ch + 14, lab, "f-sub", 10, anchor="middle")
            x += gap
        svg.text(330, y + ch + 32, hot, "f-pen-t", 11.5, anchor="end")

    strip(44, "по строкам (PostgreSQL)",
          [[(val(r, j), True) for j in range(4)] for r in rows],
          [f"заказ {r[0]}" for r in rows], "прочитано 12 ячеек из 12")
    strip(142, "по колонкам (ClickHouse)",
          [[(val(r, j), j == 2) for r in rows] for j in range(4)],
          cols, "прочитано 3 ячейки из 12")
    svg.note(0, 240, ["чем больше колонок в таблице,", "тем больше выигрыш колоночной базы"], 15)
    return svg.render()


# Учебная воронка к проекту 1.7: реальная (220 -> ... -> 64) — ответ проекта.
TWO_CONV = [("визит", 1000), ("карточка", 600), ("корзина", 300), ("оплата", 240)]


def fig_two_conversions():
    n = [v for _, v in TWO_CONV]
    step = [None] + [100 * n[i] / n[i - 1] for i in range(1, len(n))]
    worst = min(range(1, len(n)), key=lambda i: step[i])
    bx, bw, bh, gap, y0 = 96, 100, 22, 16, 50         # полосы правее подписей
    cs, cp = 250, 324                               # правые края колонок
    svg = Svg("two-conversions", 250,
              "Сквозная и пошаговая конверсия",
              "Учебная воронка: " + " → ".join(f"{t} {v}" for t, v in TWO_CONV) + ". Сквозная конверсия — "
              "доля от первого шага: " + ", ".join(f"{100 * v / n[0]:.0f}" for v in n) + " процентов. "
              "Пошаговая — доля от предыдущего: " + ", ".join(f"{v:.0f}" for v in step[1:]) + ". "
              f"Хуже всего переход на шаг «{TWO_CONV[worst][0]}»: {step[worst]:.0f} процентов.")
    svg.text(0, 14, "учебная воронка, 1000 человек", "f-hd", 12.5)
    svg.text(cs, 38, "сквозная", "f-sub", 10.5, anchor="end")
    svg.text(cp, 38, "пошаговая", "f-sub", 10.5, anchor="end")
    for i, (t, v) in enumerate(TWO_CONV):
        y = y0 + i * (bh + gap)
        svg.rect(bx, y, bw * v / n[0], bh, "f-box", 3)
        svg.text(0, y + 15, f"{t} · {v}", "f-hd", 11)
        svg.text(cs, y + 15, f"{100 * v / n[0]:.0f}%", "f-sub", 10.5, anchor="end")
        hot = i == worst
        svg.text(cp, y + 15, "—" if step[i] is None else f"{step[i]:.0f}%",
                 "f-pen-t" if hot else "f-sub", 11.5 if hot else 10.5, anchor="end")
        if hot:
            svg.rect(cp - 40, y + 1, 44, bh - 2, "f-pen", 4)
    y = y0 + len(n) * (bh + gap) + 14
    svg.note(0, y, ["сквозная — сколько потеряли всего,", "пошаговая — где именно чинить"], 15)
    return svg.render()


FIGS_M1 = {
    "where-having": fig_where_having,
    "two-conversions": fig_two_conversions,
    "row-vs-column": fig_row_vs_column,
    "cte-chain": fig_cte_chain,
    "corr-subquery": fig_corr_subquery,
    "sql-order": fig_sql_order,
    "join-rows": fig_join_rows,
    "window-frame": fig_window_frame,
    "cohort-triangle": fig_cohort_triangle,
}


# ---------------------------------------------------------------- проверка чисел

def check_m1():
    """Числа, которые стоят на схемах, — ровно те, что даёт база."""
    errs = []
    if [v for _, v in TWO_CONV] != [1000, 600, 300, 240]:
        errs.append("two-conversions: поменялась учебная воронка — проверьте подпись схемы")
    if where_having_data() != {"A": 4000, "B": 2000, "C": 6000}:
        errs.append(f"where-having: суммы {where_having_data()}")
    if num(cte_avg()) != "6282.97":
        errs.append(f"cte-chain: среднее {cte_avg()} вместо 6282.97 из урока 1.1")
    rows, last = corr_data()
    if [d for _, _, d in rows] != ["2024-04-17", "2024-05-17", "2024-04-06", "2024-04-25", "2024-04-29"]:
        errs.append(f"corr-subquery: даты {rows}")
    if [(i, u, num(r)) for i, u, r in storage_data()] != [(18, 16, "2822.77"), (19, 16, "1931.78"), (23, 21, "5886.6")]:
        errs.append(f"row-vs-column: {storage_data()}")
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
    fb = frame_sandbox()
    if fb["sums"][3] != [num(s) for _, _, _, s in w]:
        errs.append("frame-sandbox: рамка «с начала» должна совпасть с накопительной суммой схемы")
    if fb["sums"][4][-1] != fb["sums"][3][-1] or fb["sums"][0] != [r for _, _, r in fb["rows"]]:
        errs.append(f"frame-sandbox: {fb['sums']}")
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

def write_block(module, figs, sandboxes=None):
    p = ROOT / f"content-{module}.js"
    s = p.read_text(encoding="utf8")
    body = "window.FIGS = window.FIGS || {};\n" + "".join(
        f"window.FIGS[{json.dumps(k)}] = {json.dumps(v, ensure_ascii=False)};\n" for k, v in figs.items())
    if sandboxes:                                   # данные песочниц «покрути», см. tinker.js
        body += "window.TINKER = window.TINKER || {};\n" + "".join(
            f"window.TINKER[{json.dumps(k)}] = {json.dumps(v, ensure_ascii=False, separators=(',', ':'))};\n"
            for k, v in sandboxes.items())
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


def weekly_data(last="2024-08-26"):
    """Недельная выручка по оплаченным, как resample("W-MON").sum():
    неделя заканчивается понедельником и им подписана. Хвост после
    last — незакрытый период (урок 2.4 его отрезает). Третий столбец —
    rolling(4).mean(): первые три недели без среднего (None)."""
    import datetime as dt
    wk = {}
    for d, r in db().execute("SELECT order_date, revenue FROM orders WHERE status = 'paid'"):
        d = dt.date.fromisoformat(d)
        lab = d + dt.timedelta(days=(0 - d.weekday()) % 7)
        wk[lab] = wk.get(lab, 0) + r
    k, end, out = min(wk), dt.date.fromisoformat(last), []
    while k <= end:
        out.append([k.isoformat(), round(wk.get(k, 0), 2), None])
        k += dt.timedelta(days=7)
    for i in range(3, len(out)):
        out[i][2] = round(sum(v for _, v, _ in out[i - 3:i + 1]) / 4, 2)
    return [tuple(r) for r in out]


def fig_rolling_ma():
    wk = weekly_data()
    top = 50000
    x0, x1, y0, y1 = 26, 334, 48, 200            # поле графика
    X = lambda i: x0 + (x1 - x0) * i / (len(wk) - 1)
    Y = lambda v: y1 - (y1 - y0) * v / top
    # неделя из примера урока: «в середине августа рост на 104 процента»
    spike = [d for d, _, _ in wk].index("2024-08-19")
    svg = Svg("rolling-ma", 272,
              "Недельная выручка: сырой ряд и скользящее среднее за 4 недели",
              "Сырые недельные суммы с января по август скачут от недели к неделе. "
              "Среднее за четыре недели показывает рост до весны, плато и спад в августе. "
              f"Всплеск недели {wk[spike][0]} ({num(wk[spike][1])}) на сглаженном ряду — просто неделя внутри спада.")
    svg.text(0, 14, "выручка за неделю, тыс. руб.", "f-hd", 12.5)
    svg.line(0, 30, 18, 30, "f-raw")
    svg.text(24, 34, "как есть", "f-sub", 10.5)
    svg.line(90, 30, 108, 30, "f-pen")
    svg.text(114, 34, "среднее за 4 недели", "f-sub", 10.5)
    for v in (0, 25000, 50000):
        svg.line(x0, Y(v), x1, Y(v), "f-row")
        svg.text(x0 - 4, Y(v) + 4, f"{v // 1000}", "f-sub", 10.5, anchor="end")
    svg.path("M" + " L".join(f"{X(i):.1f} {Y(v):.1f}" for i, (_, v, _) in enumerate(wk)), "f-raw")
    svg.path("M" + " L".join(f"{X(i):.1f} {Y(m):.1f}" for i, (_, _, m) in enumerate(wk) if m is not None))
    months = "янв фев мар апр май июн июл авг".split()
    seen = set()
    for i, (d, _, _) in enumerate(wk):
        mo = int(d[5:7])
        if mo not in seen:
            seen.add(mo)
            svg.text(X(i), y1 + 15, months[mo - 1], "f-sub", 10.5, anchor="middle")
    svg.circle(X(spike), Y(wk[spike][1]), 3)
    svg.note(0, 244, ["«рост на 104%» — одна неделя,", "тренд по среднему идёт вниз"], 14)
    svg.path(f"M186 236 C 230 232, {X(spike) - 6:.1f} 222, {X(spike):.1f} {Y(wk[spike][1]) + 6:.1f}")
    return svg.render()


# Игрушечные написания города к уроку 2.2. Порядок strip/capitalize — ровно
# тот, о котором абзац «Порядок важен». Без СПб: capitalize() делает из
# «Санкт-Петербург» «Санкт-петербург», это отвлекло бы от главного.
CITY_RAW = [" Москва ", "москва", "МОСКВА ", "Казань"]


def city_orders():
    good = [c.strip().capitalize() for c in CITY_RAW]
    bad = [c.capitalize().strip() for c in CITY_RAW]
    return good, bad


def fig_clean_order():
    good, bad = city_orders()
    q = lambda v: "«" + v.replace(" ", "·") + "»"   # пробелы видимыми точками
    cols = [("как в выгрузке", 6, "start"), ("strip → capitalize", 118, "start"),
            ("capitalize → strip", 232, "start")]
    svg = Svg("clean-order", 262,
              "Порядок чистки справочника",
              "Четыре написания: пробел вокруг «Москва», «москва», «МОСКВА» с пробелом, «Казань». "
              "Если сначала убрать пробелы, а потом привести регистр, получится два города: Москва и Казань. "
              "Если наоборот, capitalize видит пробел первым символом и делает «москва» строчными, "
              f"пробел потом убирается, и городов становится {len(set(bad))}.")
    mids = table(svg, 0, 30, 330, "city: пробелы показаны точками", cols,
                 [(q(r), q(g), q(b)) for r, g, b in zip(CITY_RAW, good, bad)], 26)
    for m, g, b in zip(mids, good, bad):
        if b not in good:
            svg.rect(228, m - 11, 98, 22, "f-pen", 4)
    y = mids[-1] + 13
    svg.line(0, y + 26, 330, y + 26, "f-row")
    svg.text(118, y + 44, f"уникальных: {len(set(good))}", "f-hd", 11.5)
    svg.text(232, y + 44, f"уникальных: {len(set(bad))}", "f-pen-t", 11.5)
    svg.note(0, y + 76, ["сначала пробелы, потом регистр —", "иначе один город станет двумя"], 15)
    return svg.render()


# Пример из урока 2.5: столбцы 98 и 100 при оси от 0 и от 97 до 101.
AXIS_BARS, AXIS_CUT = (98, 100), (97, 101)


def fig_axis_cut():
    pw, gap, top, ph = 150, 30, 50, 150
    svg = Svg("axis-cut", 284,
              "Обрезанная ось на столбцах",
              f"Одни и те же числа, {AXIS_BARS[0]} и {AXIS_BARS[1]}, на двух графиках. Слева ось с нуля: "
              "столбцы почти равны, разница два процента. Справа ось от 97 до 101: столбцы "
              "выглядят как 1 и 3, то есть разница кажется трёхкратной.")
    svg.text(0, 14, "те же числа, другая ось", "f-hd", 12.5)
    for j, (lo, hi) in enumerate(((0, 105), AXIS_CUT)):
        x0 = j * (pw + gap)
        base = top + ph
        cut = j == 1
        svg.line(x0, base, x0 + pw, base, "f-row")
        svg.line(x0, top, x0, base, "f-row")
        svg.text(x0 + 3, base + 13, str(lo), "f-sub", 10)   # подписи оси: низ и верх
        if cut:                                     # у оси с нуля верх не подписываем
            svg.text(x0 + 3, top - 3, str(hi), "f-sub", 10)
        for k, v in enumerate(AXIS_BARS):
            h = ph * (v - lo) / (hi - lo)
            bx = x0 + 34 + k * 56
            svg.rect(bx, base - h, 36, h, "f-pen" if cut else "f-box", 2)
            svg.text(bx + 18, base - h - 6, str(v), "f-pen-t" if cut else "f-sub",
                     11.5 if cut else 10.5, anchor="middle")
        svg.text(x0 + pw / 2, base + 30, "ось от 0" if not cut else f"ось от {lo} до {hi}",
                 "f-pen-t" if cut else "f-hd", 11.5, anchor="middle")
    svg.note(0, top + ph + 62, ["столбец кодирует величину длиной —", "его ось начинается с нуля"], 15)
    return svg.render()


def fig_return_vs_print():
    svg = Svg("return-vs-print", 330,
              "Функция возвращает или печатает",
              "Сверху: channel_report принимает таблицы и статус и возвращает DataFrame. Его можно "
              "напечатать, сохранить в файл, нарисовать графиком или передать в следующий расчёт. "
              "Снизу: функция, которая печатает внутри себя, выводит таблицу на экран и возвращает None — "
              "дальше с результатом ничего сделать нельзя.")
    svg.text(0, 14, "функция возвращает", "f-hd", 12.5)
    for i, a in enumerate(("users_df", "orders_df", 'status="paid"')):
        svg.text(0, 44 + i * 16, a, "f-sub", 10.5)
    svg.path("M86 60 H104", "f-soft")
    svg.rect(108, 44, 116, 30, "f-pen", 5)
    svg.text(166, 63, "channel_report()", "f-pen-t", 11, anchor="middle")
    svg.path("M166 74 V96", "f-soft")
    svg.rect(120, 98, 92, 24, "f-box", 4)
    svg.text(166, 114, "DataFrame", "f-hd", 11, anchor="middle")
    uses = [("print(rep)", "показать"), ("rep.to_csv", "сохранить"),
            ("rep.plot", "нарисовать"), ("rep.merge", "считать дальше")]
    for i, (code, what) in enumerate(uses):
        x = 4 + i * 82
        svg.path(f"M166 122 L{x + 36} 148", "f-soft")
        svg.text(x + 36, 162, code, "f-pen-t", 10, anchor="middle")
        svg.text(x + 36, 176, what, "f-sub", 10, anchor="middle")
    y = 214
    svg.text(0, y, "функция печатает", "f-hd", 12.5)
    svg.rect(0, y + 14, 150, 30, "f-box", 5)
    svg.text(75, y + 33, "channel_report_print()", "f-sub", 10.5, anchor="middle")
    svg.path(f"M150 {y + 29} H176", "f-soft")
    svg.text(182, y + 26, "таблица на экране", "f-sub", 10.5)
    svg.text(182, y + 41, "вернула None", "f-pen-t", 11.5)
    svg.note(0, y + 82, ["результат увидели глазами —", "и больше ничего с ним не сделать"], 15)
    return svg.render()


# Пример из ловушки урока 2.7: «Казань, 40 процентов при 47 наблюдениях,
# сдвиньте трёх человек». Для сравнения — город вдесятеро больше.
SMALL_GROUPS = [("Казань", 19, 47), ("город вдесятеро больше", 190, 470)]
SHIFT = 3


def fig_small_group():
    lo, hi, x0, x1 = .30, .45, 20, 320
    X = lambda v: x0 + (x1 - x0) * (v - lo) / (hi - lo)
    p1 = lambda v: f"{100 * v:.1f}".replace(".", ",") + "%"
    rows = [(name, k / n, (k - SHIFT) / n, k, n) for name, k, n in SMALL_GROUPS]
    svg = Svg("small-group", 248,
              "Три человека и маленькая группа",
              "Две группы с одинаковой конверсией 40,4 процента. В Казани 19 покупателей из 47: "
              f"если трое не купили бы, конверсия упадёт до {p1(rows[0][2])}. В городе на 470 человек "
              f"те же трое сдвигают её только до {p1(rows[1][2])}.")
    svg.text(0, 14, "минус три покупателя", "f-hd", 12.5)
    for i, (name, a, b, k, n) in enumerate(rows):
        y = 58 + i * 70
        svg.text(0, y - 20, f"{name}: {k} из {n}", "f-hd", 11.5)
        svg.line(x0, y, x1, y, "f-row")
        svg.circle(X(a), y, 3.2, "f-sub")
        svg.circle(X(b), y, 3.2)
        svg.path(f"M{X(a) - 5:.1f} {y} L{X(b) + 6:.1f} {y}", "f-pen")
        svg.text(X(a) + 2, y + 18, p1(a), "f-sub", 10.5)            # было — справа от точки
        svg.text(X(b) - 2, y + 18, p1(b), "f-pen-t", 11.5, anchor="end")  # стало — слева
        d = f"{100 * (a - b):.1f}".replace(".", ",")
        svg.text(x1, y - 20, f"−{d} п.п.", "f-pen-t", 11.5, anchor="end")
    for v in (.30, .35, .40, .45):
        svg.text(X(v), 188, f"{v * 100:.0f}%", "f-sub", 10, anchor="middle")
        svg.line(X(v), 174, X(v), 178, "f-row")
    svg.line(x0, 176, x1, 176, "f-row")
    svg.note(0, 218, ["маленькую группу три человека двигают", "в десять раз сильнее"], 15)
    return svg.render()


FIGS_M2 = {
    "small-group": fig_small_group,
    "return-vs-print": fig_return_vs_print,
    "axis-cut": fig_axis_cut,
    "clean-order": fig_clean_order,
    "groupby-sac": fig_groupby_sac,
    "iqr-box": fig_iqr_box,
    "rolling-ma": fig_rolling_ma,
}


def check_m2():
    errs = []
    got = [f"{100 * k / n:.1f}/{100 * (k - SHIFT) / n:.1f}" for _, k, n in SMALL_GROUPS]
    if got != ["40.4/34.0", "40.4/39.8"]:
        errs.append(f"small-group: {got}")
    good, bad = city_orders()
    if (len(set(good)), len(set(bad))) != (2, 3):
        errs.append(f"clean-order: {good} / {bad} — ждали 2 города против 3")
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
    wk = weekly_data()
    tail = [(d, num(v), num(m)) for d, v, m in wk[-4:]]
    if tail != [("2024-08-05", "8970.0", "15927.75"), ("2024-08-12", "6578.38", "15763.65"),
                ("2024-08-19", "13420.73", "11167.22"), ("2024-08-26", "1963.54", "7733.16")]:
        errs.append(f"rolling-ma: хвост {tail}")
    if (wk[0][0], len(wk), wk[0][2], wk[3][2] is None) != ("2024-01-08", 34, None, False):
        errs.append(f"rolling-ma: начало {wk[:4]}")
    return errs


# ---------------------------------------------------------------- схемы m3

def clt_data():
    """Средние 2000 выборок с возвращением из оплаченных чеков — ровно
    как в задаче урока 3.1: Random(42) заново для каждого n, choice
    n раз. Строки в порядке order_id, как их читает pandas из data.js.
    Возвращает {n: список средних} и среднее совокупности."""
    import random
    rev = [r for (r,) in db().execute(
        "SELECT revenue FROM orders WHERE status = 'paid' ORDER BY order_id")]
    out = {}
    for n in (1, 5, 30):
        rnd = random.Random(42)
        out[n] = [sum(rnd.choice(rev) for _ in range(n)) / n for _ in range(2000)]
    return out, sum(rev) / len(rev)


def sd(v):
    m = sum(v) / len(v)
    return (sum((x - m) ** 2 for x in v) / (len(v) - 1)) ** .5


def fig_clt_means():
    means, mu = clt_data()
    top, step = 11000, 250                          # ось и ширина корзины, руб.
    x0, x1 = 0, 330
    X = lambda v: x0 + (x1 - x0) * v / top
    svg = Svg("clt-means", 372,
              "Центральная предельная теорема на оплаченных чеках",
              "Три гистограммы на одной оси: средние 2000 случайных выборок из оплаченных чеков. "
              f"При n=1 это сами чеки — скошенная форма с хвостом вправо, разброс {sd(means[1]):.0f} руб. "
              f"При n=5 форма ближе к симметричной, разброс {sd(means[5]):.0f}. "
              f"При n=30 — узкий симметричный колокол вокруг {mu:.0f}, разброс {sd(means[30]):.0f}: "
              "падает как корень из n, а центр остаётся на месте.")
    svg.text(0, 14, "средние 2000 выборок, руб.", "f-hd", 12.5)
    ph, gap, y = 70, 26, 34                         # высота панели, зазор, верх первой
    for n in (1, 5, 30):
        v = means[n]
        cnt = [0] * (top // step)
        for m in v:
            cnt[int(m // step)] += 1
        base, hi = y + ph, max(cnt)
        cls = "f-pen" if n == 30 else "f-raw"
        d = f"M{X(0):.1f} {base}"
        for i, c in enumerate(cnt):
            h = base - (ph - 8) * c / hi
            d += f" L{X(i * step):.1f} {h:.1f} L{X((i + 1) * step):.1f} {h:.1f}"
        svg.path(d + f" L{X(top):.1f} {base}", cls)
        svg.line(x0, base, x1, base, "f-row")
        svg.text(x1, y + 10, f"n = {n}", "f-hd", 12.5, anchor="end")
        svg.text(x1, y + 26, f"разброс {sd(v):.0f}", "f-pen-t" if n == 30 else "f-sub",
                 11.5 if n == 30 else 10.5, anchor="end")
        y = base + gap
    svg.path(f"M{X(mu):.1f} 26 V{y - gap + 4}", "f-soft")
    svg.text(X(mu) + 4, 30, f"среднее {mu:.0f}", "f-sub", 10.5)
    axis = y - gap + 4
    for v in (0, 5000, 10000):
        svg.line(X(v), axis, X(v), axis + 4, "f-row")
        svg.text(X(v), axis + 16, f"{v:,}".replace(",", " "), "f-sub", 10.5,
                 anchor="start" if v == 0 else "middle")
    svg.note(0, axis + 46, ["чеки остаются скошенными —", "колоколом становится среднее"], 15)
    return svg.render()


def ci_data():
    """100 повторов группы A из задачи урока 3.2: истинная конверсия 5%,
    n=4820. Random(42), по одному random() на визит. Возвращает
    список (низ, верх) 95%-интервалов в долях."""
    import random
    p, n = .05, 4820
    rnd = random.Random(42)
    out = []
    for _ in range(100):
        q = sum(rnd.random() < p for _ in range(n)) / n
        se = (q * (1 - q) / n) ** .5
        out.append((q - 1.96 * se, q + 1.96 * se))
    return out


def fig_ci_100():
    ci, p = ci_data(), .05
    miss = [i for i, (a, b) in enumerate(ci) if not a <= p <= b]
    lo, hi = .035, .065                             # ось, доли
    x0, x1 = 0, 330
    X = lambda v: x0 + (x1 - x0) * (v - lo) / (hi - lo)
    top, dy = 40, 2.6
    svg = Svg("ci-100", 382,
              "Сто доверительных интервалов для одной и той же конверсии",
              "Сто раз набрали по 4820 визитов при истинной конверсии 5 процентов и каждый раз "
              "построили 95-процентный интервал. Интервалы скачут вокруг 5 процентов; "
              f"{100 - len(miss)} из них накрывают истинное значение, {len(miss)} промахиваются "
              "и выделены ручкой. По одному интервалу нельзя сказать, промах он или нет.")
    svg.text(0, 14, "100 повторов теста, n = 4820", "f-hd", 12.5)
    bottom = top + dy * 99
    svg.path(f"M{X(p):.1f} {top - 8} V{bottom + 6}", "f-soft")
    svg.text(X(p) + 4, top - 10, "истина 5%", "f-sub", 10.5)
    for i, (a, b) in enumerate(ci):
        y = top + i * dy
        svg.line(round(X(a), 1), round(y, 1), round(X(b), 1), round(y, 1),
                 "f-pen" if i in miss else "f-raw")
    axis = bottom + 8
    for v in (.04, .05, .06):
        svg.line(X(v), axis, X(v), axis + 4, "f-row")
        svg.text(X(v), axis + 16, f"{v * 100:.0f}%", "f-sub", 10.5, anchor="middle")
    svg.text(x1, axis + 40, f"накрыли: {100 - len(miss)}", "f-sub", 10.5, anchor="end")
    svg.text(x1, axis + 54, f"промахнулись: {len(miss)}", "f-pen-t", 11.5, anchor="end")
    svg.note(0, axis + 42, ["какой из них ваш,", "заранее не узнать"], 15)
    return svg.render()


def Phi(x):
    return .5 * (1 + math.erf(x / 2 ** .5))


def power_data():
    """База 5%, лифт 10% (5,00 -> 5,50), alpha 0,05 двусторонний — как в
    уроке 3.4. Для n на группу: стандартные ошибки разницы при H0 и H1,
    порог значимости и мощность. n: из теории (31 234) и неделя трафика
    задачи (1750 * 7 / 2 = 6125)."""
    p0, p1, za = .05, .055, 1.959963984540054
    pb = (p0 + p1) / 2
    out = []
    for n in (31234, 6125):
        se0 = (2 * pb * (1 - pb) / n) ** .5
        se1 = ((p0 * (1 - p0) + p1 * (1 - p1)) / n) ** .5
        c = za * se0
        out.append((n, se0, se1, c, 1 - Phi((c - (p1 - p0)) / se1)))
    return p1 - p0, out


# Положения песочницы MDE — n на группу. 6125 и 31 234 есть в тексте урока;
# 12 250 (ответ задачи, мощность 41,9%) и n тренажёра «Кривая мощности»
# (5–25, 40, 60 тысяч) не берём, чтобы песочница не выдавала ответы.
MDE_NS = (1000, 2500, 4000, 6125, 9000, 17000, 23000, 31234, 45000, 70000, 100000)
MDE_HIDDEN = (12250, 5000, 10000, 15000, 20000, 25000, 40000, 60000)


def mde_for(n, p0=.05, za=1.959963984540054, zb=.8416212335729143):
    """Относительный MDE при мощности 80%: подбираем лифт, для которого
    формула размера группы урока даёт ровно n."""
    lo, hi = 1e-4, 5.0
    for _ in range(100):
        m = (lo + hi) / 2
        p1 = p0 * (1 + m)
        pb = (p0 + p1) / 2
        need = (za * (2 * pb * (1 - pb)) ** .5 + zb * (p0 * (1 - p0) + p1 * (1 - p1)) ** .5) ** 2 / (p1 - p0) ** 2
        lo, hi = (m, hi) if need > n else (lo, m)
    return (lo + hi) / 2


def mde_sandbox():
    """Песочница урока 3.4: один кадр схемы power-bells (база 5%, лифт 10%),
    ползунок — размер группы. Колокола JS рисует сам по se0/se1/c."""
    p0, p1, za = .05, .055, 1.959963984540054
    pb = (p0 + p1) / 2
    se0 = [(2 * pb * (1 - pb) / n) ** .5 for n in MDE_NS]
    se1 = [((p0 * (1 - p0) + p1 * (1 - p1)) / n) ** .5 for n in MDE_NS]
    c = [za * s for s in se0]
    pw = [1 - Phi((ci - (p1 - p0)) / s) for ci, s in zip(c, se1)]
    mde = [mde_for(n) for n in MDE_NS]
    return {"pos": list(MDE_NS), "start": MDE_NS.index(31234), "name": "Размер группы",
            "ticks": [[0, "1 000"], [3, "6 125"], [7, "31 234"], [len(MDE_NS) - 1, "100 000"]],
            "d": round(p1 - p0, 6), "lo": -.012, "hi": .018,
            "se0": [round(v, 7) for v in se0], "se1": [round(v, 7) for v in se1], "c": [round(v, 7) for v in c],
            "power": [round(v, 4) for v in pw], "mde": [round(v, 4) for v in mde],
            "expect": [(f"{v * 100:.1f}".replace(".", ",") if v >= .995 else f"{v * 100:.0f}") + "%"
                       for v in pw],                # 99,9% — не округлять до «100%»
            "caption": "Рис. Двигайте ползунок: база 5%, настоящий эффект +10%. Больше людей в группе — "
                       "уже колокола, выше мощность и меньше эффект, который тест способен поймать"}


def fig_power_bells():
    d, panels = power_data()
    lo, hi = -.012, .018                            # ось: наблюдаемая разница, доли
    x0, x1 = 0, 330
    X = lambda v: x0 + (x1 - x0) * (v - lo) / (hi - lo)
    pdf = lambda v, m, s: math.exp(-((v - m) / s) ** 2 / 2)
    svg = Svg("power-bells", 334,
              "Два колокола: ошибка первого рода, ошибка второго рода и мощность",
              "Где окажется наблюдаемая разница конверсий, если эффекта нет (колокол вокруг нуля) "
              "и если он есть, плюс 10 процентов, с 5,00 до 5,50 (колокол вокруг 0,5 пункта). "
              "Вертикальная черта — порог значимости: правее неё тест объявляет победу. "
              "Штриховка слева от порога под вторым колоколом — пропущенный эффект, бета. "
              f"При {panels[0][0]} на группу колокола узкие и мощность {panels[0][4] * 100:.0f} процентов; "
              f"при {panels[1][0]} (неделя трафика) колокола широкие, слиплись, и мощность "
              f"{panels[1][4] * 100:.0f} процентов.")
    svg.text(0, 14, "разница конверсий B − A, п.п.", "f-hd", 12.5)
    ph, y = 104, 30
    for k, (n, se0, se1, c, pw) in enumerate(panels):
        base = y + ph
        H = lambda v, m, s: base - (ph - 30) * pdf(v, m, s)
        step = (hi - lo) / 220
        xs = [lo + i * step for i in range(221)]
        svg.path("M" + " L".join(f"{X(v):.1f} {H(v, 0, se0):.1f}" for v in xs), "f-raw")
        svg.path("M" + " L".join(f"{X(v):.1f} {H(v, d, se1):.1f}" for v in xs), "f-pen")
        # бета: штриховка под колоколом «эффект есть» левее порога
        v = lo
        while v < c:
            if pdf(v, d, se1) > .03:
                svg.line(round(X(v), 1), base, round(X(v), 1), round(H(v, d, se1), 1), "f-soft")
            v += 4 * (hi - lo) / (x1 - x0)
        svg.line(0, base, x1, base, "f-row")
        svg.path(f"M{X(c):.1f} {y + 18} V{base}", "f-box")
        svg.text(X(c) + 3, y + 26, "порог", "f-sub", 10.5)
        svg.text(0, y + 10, f"n = {n:,} на группу".replace(",", " "), "f-hd", 12.5)
        svg.text(x1, y + 10, f"мощность {pw * 100:.0f}%", "f-pen-t", 11.5, anchor="end")
        if k == 0:
            svg.text(X(0) - 20, y + 52, "эффекта нет", "f-sub", 10.5, anchor="end")
            svg.text(X(d) + 20, y + 52, "эффект +10%", "f-pen-t", 11.5)
            svg.text(X(c) + 3, base - 6, "α", "f-sub", 10.5)
        y = base + 24
    axis = y - 24
    for v in (-.01, 0, .01):
        svg.line(X(v), axis, X(v), axis + 4, "f-row")
        svg.text(X(v), axis + 16, f"{v * 100:+.0f}".replace("+0", "0").replace("-", "−"),
                 "f-sub", 10.5, anchor="middle")
    svg.text(x1, axis + 16, "штриховка — β", "f-sub", 10.5, anchor="end")
    svg.note(0, axis + 44, ["мало данных — колокола слиплись,", "и настоящий эффект чаще пропускают"], 15)
    return svg.render()


def fwer(k, alpha=.05):
    """Вероятность хотя бы одной ложной находки из k независимых сравнений."""
    return 1 - (1 - alpha) ** k


def fig_fwer_curve():
    x0, x1, yt, yb = 34, 316, 34, 214               # поле графика
    X = lambda k: x0 + (x1 - x0) * (k - 1) / 19
    Y = lambda v: yb - (yb - yt) * v
    svg = Svg("fwer-curve", 290,
              "Риск ложной находки растёт с числом метрик",
              "Вероятность хотя бы одной ложной находки при уровне 0,05 на каждое сравнение: "
              f"одна метрика — {fwer(1) * 100:.1f} процента, три — {fwer(3) * 100:.1f}, "
              f"пять — {fwer(5) * 100:.1f}, десять — {fwer(10) * 100:.1f}, "
              f"двадцать — {fwer(20) * 100:.1f}. С поправкой Бонферрони риск остаётся "
              "около 5 процентов при любом числе метрик.")
    svg.text(0, 14, "шанс хотя бы одной ложной находки", "f-hd", 12.5)
    for v in (0, .25, .5, .75, 1):
        svg.line(x0, Y(v), x1, Y(v), "f-row")
        svg.text(x0 - 6, Y(v) + 4, f"{v * 100:.0f}%", "f-sub", 10.5, anchor="end")
    bonf = [1 - (1 - .05 / k) ** k for k in range(1, 21)]
    svg.path("M" + " L".join(f"{X(k):.1f} {Y(b):.1f}" for k, b in zip(range(1, 21), bonf)), "f-raw")
    svg.text(x1, Y(bonf[-1]) - 6, "с поправкой Бонферрони", "f-sub", 10.5, anchor="end")
    svg.path("M" + " L".join(f"{X(k):.1f} {Y(fwer(k)):.1f}" for k in range(1, 21)), "f-pen")
    for k in (1, 5, 10, 20):
        svg.circle(X(k), Y(fwer(k)), 2.6)
        s = f"{fwer(k) * 100:.1f}%".replace(".", ",")
        svg.text(X(k) + (-4 if k == 20 else 0), Y(fwer(k)) - 8, s, "f-pen-t", 11.5,
                 anchor="end" if k == 20 else "middle")
    for k in (1, 5, 10, 20):
        svg.line(X(k), yb, X(k), yb + 4, "f-row")
        svg.text(X(k), yb + 16, str(k), "f-sub", 10.5, anchor="middle")
    svg.text(x1, yb + 32, "метрик в тесте", "f-sub", 10.5, anchor="end")
    svg.note(0, yb + 54, ["двадцать метрик — «находка»", "почти наверняка"], 15)
    return svg.render()


# Игрушечные чеки к уроку 3.3: у A один гигантский заказ.
MW_A, MW_B, MW_BIG, MW_SMALL = [1200, 2500, 3100, 100000], [900, 1500, 2000, 2800], 100000, 10000


def mw_data(a=MW_A):
    allv = sorted([(v, "A") for v in a] + [(v, "B") for v in MW_B])
    ranks = [(v, g, i + 1) for i, (v, g) in enumerate(allv)]
    ra = sum(r for _, g, r in ranks if g == "A")
    return ranks, ra, ra - len(a) * (len(a) + 1) // 2


def fig_mw_ranks():
    ranks, ra, u = mw_data()
    small = [MW_SMALL if v == MW_BIG else v for v in MW_A]
    _, ra2, _ = mw_data(small)
    rub = lambda v: f"{v:,}".replace(",", " ")
    mean = lambda v: sum(v) / len(v)
    cw, y = 330 / len(ranks), 40
    svg = Svg("mw-ranks", 250,
              "Ранги в критерии Манна-Уитни",
              "Восемь чеков двух групп в общем ряду по возрастанию с рангами от 1 до 8. У группы A ранги "
              f"{', '.join(str(r) for _, g, r in ranks if g == 'A')}, сумма {ra}, U = {u}. Самый большой чек A, "
              f"{rub(MW_BIG)}, получает ранг 8. Если бы он был {rub(MW_SMALL)}, среднее A упало бы с "
              f"{rub(round(mean(MW_A)))} до {rub(round(mean(small)))}, а ранг и сумма рангов не изменились бы.")
    svg.text(0, 14, "общий ряд двух групп по возрастанию", "f-hd", 12.5)
    for i, (v, g, r) in enumerate(ranks):
        x = i * cw
        a = g == "A"
        svg.rect(x + 1, y, cw - 2, 26, "f-pen" if a else "f-box", 3)
        svg.text(x + cw / 2, y + 17, rub(v), "f-sub", 9.5, anchor="middle")  # моноширинный не влезает
        svg.text(x + cw / 2, y + 42, g, "f-pen-t" if a else "f-sub", 11, anchor="middle")
        svg.text(x + cw / 2, y + 60, str(r), "f-hd", 11.5, anchor="middle")
    svg.text(330, y + 84, f"ранги A: {' + '.join(str(r) for _, g, r in ranks if g == 'A')} = {ra};  U = {ra} − 10 = {u}",
             "f-sub", 10.5, anchor="end")
    t = y + 118
    svg.text(0, t, f"если {rub(MW_BIG)} заменить на {rub(MW_SMALL)}:", "f-hd", 11.5)
    svg.text(0, t + 20, f"среднее A: {rub(round(mean(MW_A)))} → {rub(round(mean(small)))}", "f-pen-t", 11.5)
    svg.text(0, t + 38, f"сумма рангов A: {ra} → {ra2}", "f-sub", 10.5)
    svg.note(0, t + 72, ["выброс важен только тем, кого обогнал"], 15)
    return svg.render()


def peek_data(seed=33, per_day=500, p=.05, days=14):
    """Один A/A-тест: обе группы с конверсией 5%, по 500 человек в день.
    p-value z-теста по накопленным данным после каждого дня. Seed подобран
    как наглядный пример: один раз ныряет ниже 0,05 и возвращается."""
    import random
    rnd = random.Random(seed)
    ca = cb = n = 0
    out = []
    for _ in range(days):
        ca += sum(rnd.random() < p for _ in range(per_day))
        cb += sum(rnd.random() < p for _ in range(per_day))
        n += per_day
        pb = (ca + cb) / (2 * n)
        z = (cb - ca) / n / (pb * (1 - pb) * 2 / n) ** .5
        out.append(2 * (1 - Phi(abs(z))))
    return out


def fig_peeking():
    pv = peek_data()
    x0, x1, yt, yb = 34, 322, 36, 206
    X = lambda d: x0 + (x1 - x0) * (d - 1) / (len(pv) - 1)
    Y = lambda v: yb - (yb - yt) * v
    stop = next(i for i, v in enumerate(pv) if v < .05)
    f = lambda v: f"{v:.3f}".replace(".", ",")
    svg = Svg("peeking", 302,
              "Подглядывание в A/A-тесте",
              "Один A/A-тест, где эффекта нет по построению. p-value по накопленным данным после каждого из "
              f"14 дней бродит от {f(min(pv))} до {f(max(pv))}. На {stop + 1}-й день оно опускается до {f(pv[stop])}, "
              "ниже порога 0,05: если остановить тест в этот момент, шум будет записан как победа. "
              f"К концу теста p-value {f(pv[-1])}.")
    svg.text(0, 14, "p-value после каждого дня, эффекта нет", "f-hd", 12.5)
    for v in (0, .5, 1):
        svg.line(x0, Y(v), x1, Y(v), "f-row")
        svg.text(x0 - 6, Y(v) + 4, f"{v:g}".replace(".", ","), "f-sub", 10.5, anchor="end")
    svg.line(x0, Y(.05), x1, Y(.05), "f-soft")
    svg.text(x1, Y(.05) - 4, "порог 0,05", "f-sub", 10, anchor="end")
    svg.path("M" + " L".join(f"{X(i + 1):.1f} {Y(v):.1f}" for i, v in enumerate(pv)), "f-raw")
    for i, v in enumerate(pv):
        svg.circle(round(X(i + 1), 1), round(Y(v), 1), 3 if i == stop else 1.8,
                   "f-pen-fill" if i == stop else "f-sub")
    svg.text(X(len(pv)), Y(pv[-1]) - 8, f"день 14: {f(pv[-1])}", "f-sub", 10.5, anchor="end")
    for d, anc in ((1, "start"), (7, "middle"), (14, "end")):
        svg.text(X(d), yb + 16, f"день {d}", "f-sub", 10.5, anchor=anc)
    # выноска вниз, под ось: внутри графика подписи некуда встать
    svg.line(X(stop + 1), Y(pv[stop]) + 4, X(stop + 1), yb + 26, "f-pen")
    svg.text(X(stop + 1) - 4, yb + 40, f"день {stop + 1}: p = {f(pv[stop])} — «победа», стоп",
             "f-pen-t", 11.5)
    svg.note(0, yb + 72, ["чем чаще смотрите, тем вернее", "поймаете шум ниже порога"], 15)
    return svg.render()


# Учебное разложение ARPU к проекту 3.8 (в тексте урока +32/−26 — ответ проекта).
ARPU_A, ARPU_B = (.04, 5000), (.05, 4500)            # (конверсия, средний чек)


def arpu_parts():
    (c0, a0), (c1, a1) = ARPU_A, ARPU_B
    return c0 * a0, c1 * a1, (c1 - c0) * a0, c0 * (a1 - a0), (c1 - c0) * (a1 - a0)


def fig_arpu_split():
    arpu0, arpu1, d_cr, d_aov, d_joint = arpu_parts()
    (c0, a0), (c1, a1) = ARPU_A, ARPU_B
    x0, yb, sx, sy = 40, 200, 52 / .01, 160 / 5000     # px на процентный пункт и на рубль
    X = lambda c: x0 + sx * c
    Y = lambda a: yb - sy * a
    r = lambda v: f"{v:+.0f}".replace("-", "−")
    svg = Svg("arpu-split", 312,
              "Разложение выручки на пользователя на конверсию и чек",
              f"Выручка на пользователя — площадь прямоугольника: конверсия по горизонтали, средний чек по "
              f"вертикали. Контроль: 4 процента на 5 000, ARPU {arpu0:.0f}. Тест: 5 процентов на 4 500, "
              f"ARPU {arpu1:.0f}. Полоса справа — вклад конверсии, {r(d_cr)} рублей. Полоса сверху — "
              f"потеря от чека, {r(d_aov)}. Угол — совместный вклад, {r(d_joint)}. Итого {r(arpu1 - arpu0)}.")
    svg.text(0, 14, "ARPU = конверсия × чек = площадь", "f-hd", 12.5)
    svg.rect(X(0), Y(a0), sx * c0, sy * a0, "f-box", 0)            # контроль
    svg.rect(X(0), Y(a1), sx * c1, sy * a1, "f-pen", 0)            # тест
    k = 0                                                         # штриховка полосы «конверсия»
    while X(c0) + 4 * k < X(c1):
        xx = X(c0) + 4 * k
        svg.line(round(xx, 1), Y(a1), round(xx, 1), yb, "f-soft")
        k += 1
    svg.text((X(c0) + X(c1)) / 2, Y(a1 / 2), r(d_cr), "f-pen-t", 12, anchor="middle")
    svg.text(X(c0 / 2), (Y(a0) + Y(a1)) / 2 + 4, f"{r(d_aov)} чек", "f-sub", 10.5, anchor="middle")
    # вклад конверсии — вся полоса до старого чека; угол над новым чеком из неё срезан
    svg.rect(X(c0), Y(a0), sx * (c1 - c0), sy * a0, "f-soft", 0)
    svg.text(X(c1), Y(a0) - 6, f"угол {r(d_joint)}", "f-sub", 10, anchor="end")
    svg.text(X(c0 / 2), Y(a1 / 2), f"контроль {arpu0:.0f}", "f-sub", 10.5, anchor="middle")
    for c in (0, c0, c1):
        svg.text(X(c), yb + 16, f"{c * 100:.0f}%", "f-sub", 10.5, anchor="middle")
    for a in (a1, a0):
        svg.text(x0 - 6, Y(a) + (10 if a == a1 else 0), f"{a:,}".replace(",", " "), "f-sub", 10, anchor="end")
    svg.text(X(c1) + 70, yb + 16, "конверсия →", "f-sub", 10.5, anchor="middle")
    y = yb + 44
    svg.text(0, y, f"ARPU: {arpu0:.0f} → {arpu1:.0f}, то есть {r(arpu1 - arpu0)} ₽ =", "f-hd", 11.5)
    svg.text(0, y + 18, f"{r(d_cr)} конверсия  {r(d_aov)} чек  {r(d_joint)} совместный", "f-pen-t", 11.5)
    svg.note(0, y + 48, ["рост ARPU складывается из плюса", "и минуса — важно, за счёт чего"], 15)
    return svg.render()


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
    return {"pos": list(SANDBOX_NS), "start": SANDBOX_NS.index(30), "name": "Размер выборки n",
            "ticks": [[SANDBOX_NS.index(n), str(n)] for n in (1, 5, 30, 200)],
            "expect": [f"{v:.0f}" for v in sds],
            "step": step, "top": top, "mean": round(mu, 2), "bins": bins, "sd": sds, "sdf": sdfs,
            "caption": "Рис. Двигайте ползунок: средние 2000 выборок из одних и тех же чеков — "
                       "с ростом n разброс падает, а форма становится колоколом"}


SANDBOX_M3 = {"clt-means": clt_sandbox, "power-bells": mde_sandbox}


FIGS_M3 = {
    "arpu-split": fig_arpu_split,
    "peeking": fig_peeking,
    "mw-ranks": fig_mw_ranks,
    "clt-means": fig_clt_means,
    "ci-100": fig_ci_100,
    "power-bells": fig_power_bells,
    "fwer-curve": fig_fwer_curve,
}


def check_m3():
    errs = []
    got = [round(v, 6) for v in arpu_parts()]
    if got != [200, 225, 50, -20, -5] or abs(got[2] + got[3] + got[4] - (got[1] - got[0])) > 1e-9:
        errs.append(f"arpu-split: {got}")
    pv = peek_data()
    if [f"{v:.3f}" for v in (pv[3], pv[-1])] != ["0.043", "0.595"] or sum(v < .05 for v in pv) != 1:
        errs.append(f"peeking: {[round(v, 3) for v in pv]}")
    ranks, ra, u = mw_data()
    if (ra, u, mw_data([MW_SMALL if v == MW_BIG else v for v in MW_A])[1]) != (22, 12, 22):
        errs.append(f"mw-ranks: сумма рангов {ra}, U {u}")
    means, mu = clt_data()
    got = [(n, f"{sum(v) / len(v):.2f}", f"{sd(v):.2f}") for n, v in means.items()]
    if got != [(1, "3505.93", "1777.50"), (5, "3459.17", "778.80"), (30, "3454.78", "323.06")]:
        errs.append(f"clt-means: {got} — не совпало с эталоном задачи урока 3.1")
    if f"{mu:.2f}" != "3457.30":
        errs.append(f"clt-means: среднее совокупности {mu:.2f}")
    miss = [i for i, (a, b) in enumerate(ci_data()) if not a <= .05 <= b]
    if miss != [4, 16, 52, 54, 76, 90]:
        errs.append(f"ci-100: промахи {miss} вместо [4, 16, 52, 54, 76, 90]")
    got = [(n, f"{c * 100:.3f}", f"{pw * 100:.1f}") for n, _, _, c, pw in power_data()[1]]
    if got != [(31234, "0.350", "80.0"), (6125, "0.790", "23.6")]:
        errs.append(f"power-bells: {got} — 31 234 из теории урока 3.4 должны давать мощность 80%")
    got = [f"{fwer(k) * 100:.1f}" for k in (1, 3, 5, 10, 20)]
    if got != ["5.0", "14.3", "22.6", "40.1", "64.2"]:
        errs.append(f"fwer-curve: {got} — не совпало с таблицей урока 3.5")
    mb = mde_sandbox()
    i = mb["start"]
    if (f"{mb['power'][i] * 100:.1f}", f"{mb['mde'][i] * 100:.1f}", f"{mb['power'][3] * 100:.1f}") != ("80.0", "10.0", "23.6"):
        errs.append(f"mde-sandbox: 31 234 → {mb['power'][i]}, MDE {mb['mde'][i]}; 6125 → {mb['power'][3]}")
    if set(MDE_NS) & set(MDE_HIDDEN):
        errs.append("mde-sandbox: среди положений есть n из ответа задачи или тренажёра")
    if f"{mde_for(12250) * 100:.1f}" != "16.2":
        errs.append(f"mde-sandbox: MDE при 12 250 = {mde_for(12250):.4f}, в эталоне задачи 16,2%")
    sb = clt_sandbox()
    i5, i30 = sb["pos"].index(5), sb["pos"].index(30)
    got = (f"{sb['sd'][i5]:.2f}", f"{sb['sdf'][i5]:.2f}", f"{sb['sd'][i30]:.2f}", f"{sb['sdf'][i30]:.0f}")
    if got != ("778.80", "773.11", "323.06", "316"):
        errs.append(f"clt-sandbox: {got} — не совпало с уроком 3.1")
    if any(sum(b) != 2000 for b in sb["bins"]) or sb["pos"][sb["start"]] != 30:
        errs.append("clt-sandbox: в каждой гистограмме 2000 средних, исходное n = 30")
    return errs


# ---------------------------------------------------------------- схемы m4

FUNNEL = [("visit", "визит"), ("view_product", "карточка"), ("add_to_cart", "корзина"),
          ("checkout", "оформление"), ("purchase", "оплата")]


def funnel_data():
    """Уникальные пользователи на каждом шаге — как в задаче урока 4.2,
    без временного окна."""
    con = db()
    return [con.execute("SELECT COUNT(DISTINCT user_id) FROM events WHERE event_name = ?",
                        (e,)).fetchone()[0] for e, _ in FUNNEL]


def pct(v, digits=1):
    return f"{v:.{digits}f}".replace(".", ",")


def fig_funnel_steps():
    users = funnel_data()
    worst = min(range(1, 5), key=lambda i: users[i] / users[i - 1])
    cx, wmax, bh, gap, y = 165, 300, 24, 26, 30
    svg = Svg("funnel-steps", 318,
              "Воронка «Дельта Маркет» по шагам",
              "Пять шагов, ширина полосы — число людей: "
              + ", ".join(f"{n} {u}" for (_, n), u in zip(FUNNEL, users))
              + ". Конверсии шагов: "
              + ", ".join(pct(100 * users[i] / users[i - 1]) for i in range(1, 5))
              + f" процента. Хуже всего переход в оплату: там теряем {users[worst - 1] - users[worst]} человек. "
              f"Сквозная конверсия {pct(100 * users[-1] / users[0])} процента.")
    svg.text(0, 14, "уникальные пользователи, без окна", "f-hd", 12.5)
    for i, ((_, name), u) in enumerate(zip(FUNNEL, users)):
        w = wmax * u / users[0]
        svg.rect(cx - w / 2, y, w, bh, "f-box", 4)
        svg.text(cx, y + 16, f"{name} · {u}", "f-hd", 11.5, anchor="middle")
        if i < 4:
            c = 100 * users[i + 1] / u
            hot = i + 1 == worst
            s = f"↓ {pct(c)}%" + (f"   −{u - users[i + 1]} человек" if hot else "")
            svg.text(cx, y + bh + 17, s, "f-pen-t" if hot else "f-sub", 11.5 if hot else 10.5,
                     anchor="middle")
        y += bh + gap
    y -= gap
    svg.text(330, y + 22, f"сквозная {pct(100 * users[-1] / users[0])}%", "f-sub", 10.5, anchor="end")
    svg.note(0, y + 44, ["здесь теряем больше всего —", "и в процентах, и в людях"], 15)
    return svg.render()


def retention_data():
    """Удержание дня N для N = 0..30 по двум определениям из урока 4.3:
    классическое (активен ровно в день N) и скользящее (в день N или позже).
    Знаменатель — все пользователи приложения. Доли, в процентах."""
    con = db()
    days = {}
    for u, d in con.execute(
            "SELECT u.user_id, CAST(julianday(a.activity_date) - julianday(u.signup_date) AS INTEGER) "
            "FROM app_users u JOIN app_activity a USING (user_id)"):
        days.setdefault(u, set()).add(d)
    total = con.execute("SELECT COUNT(*) FROM app_users").fetchone()[0]
    last = {u: max(v) for u, v in days.items()}
    classic = [100 * sum(n in v for v in days.values()) / total for n in range(31)]
    rolling = [100 * sum(m >= n for m in last.values()) / total for n in range(31)]
    return classic, rolling


def fig_retention_defs():
    classic, rolling = retention_data()
    x0, x1, yt, yb = 34, 322, 40, 220
    X = lambda n: x0 + (x1 - x0) * n / 30
    Y = lambda v: yb - (yb - yt) * v / 100
    marks = (1, 7, 14, 30)
    svg = Svg("retention-defs", 300,
              "Удержание по двум определениям на одних и тех же пользователях",
              "Две кривые удержания с нулевого по тридцатый день. Скользящее (активен в день N или позже): "
              + ", ".join(f"D{n} {pct(rolling[n])}" for n in marks)
              + " процента. Классическое (активен ровно в день N): "
              + ", ".join(f"D{n} {pct(classic[n])}" for n in marks)
              + ". На тридцатом дне разница в два с половиной раза.")
    svg.text(0, 14, "удержание дня N, 4000 пользователей", "f-hd", 12.5)
    for v in (0, 25, 50, 75, 100):
        svg.line(x0, Y(v), x1, Y(v), "f-row")
        svg.text(x0 - 6, Y(v) + 4, f"{v}%", "f-sub", 10.5, anchor="end")
    svg.path("M" + " L".join(f"{X(n):.1f} {Y(v):.1f}" for n, v in enumerate(classic)), "f-raw")
    svg.path("M" + " L".join(f"{X(n):.1f} {Y(v):.1f}" for n, v in enumerate(rolling)), "f-pen")
    for n in marks:
        svg.circle(X(n), Y(rolling[n]), 2.6)
        svg.text(X(n) + (3 if n == 1 else 0), Y(rolling[n]) - 8, pct(rolling[n]), "f-pen-t", 11.5,
                 anchor="end" if n == 30 else "start" if n == 1 else "middle")
        svg.circle(X(n), Y(classic[n]), 2.2, "f-sub")
        svg.text(X(n) + (6 if n == 1 else 0), Y(classic[n]) + (-4 if n == 1 else 15), pct(classic[n]), "f-sub", 10.5,
                 anchor="end" if n == 30 else "start" if n == 1 else "middle")
    for n in marks:
        svg.line(X(n), yb, X(n), yb + 4, "f-row")
        svg.text(X(n), yb + 16, f"D{n}", "f-sub", 10.5, anchor="middle")
    svg.text(X(21), Y(rolling[21]) - 22, "скользящее", "f-pen-t", 11.5, anchor="middle")
    svg.text(X(21), Y(classic[21]) + 26, "классическое", "f-sub", 10.5, anchor="middle")
    svg.note(0, yb + 44, ["одни и те же люди — а числа", "расходятся в два с половиной раза"], 15)
    return svg.render()


# Учебный пример к теории урока 4.1 — числа свои, не из тренажёров
# (там десктоп/мобильные в 4.1 и каналы базы в 4.3): визиты и покупки.
SIMPSON = {"поиск": ((7500, 300), (3000, 126)), "реклама": ((2500, 30), (7000, 91))}


def simpson_data():
    tot = [tuple(sum(v[t][i] for v in SIMPSON.values()) for i in (0, 1)) for t in (0, 1)]
    return {**SIMPSON, "итого": tuple(tot)}


def fig_simpson_mix():
    data = simpson_data()
    xa, xb, yt, yb = 96, 236, 44, 204
    Y = lambda v: yb - (yb - yt) * v / 5
    cr = lambda vp: 100 * vp[1] / vp[0]
    share = [100 * SIMPSON["реклама"][t][0] / data["итого"][t][0] for t in (0, 1)]
    svg = Svg("simpson-mix", 300,
              "Парадокс Симпсона: конверсия выросла в каждом канале и упала в целом",
              "Два канала, было и стало, по 10 000 визитов. Поиск: "
              f"{pct(cr(data['поиск'][0]))} → {pct(cr(data['поиск'][1]))} процента. Реклама: "
              f"{pct(cr(data['реклама'][0]))} → {pct(cr(data['реклама'][1]))}. В целом: "
              f"{pct(cr(data['итого'][0]), 2)} → {pct(cr(data['итого'][1]), 2)}. "
              f"Причина — доля рекламы выросла с {share[0]:.0f} до {share[1]:.0f} процентов.")
    svg.text(0, 14, "конверсия в покупку", "f-hd", 12.5)
    for x, t in ((xa, "было"), (xb, "стало")):
        svg.line(x, yt - 8, x, yb, "f-row")
        svg.text(x, yb + 16, t, "f-sub", 10.5, anchor="middle")
    svg.line(xa - 10, yb, xb + 10, yb, "f-row")
    for name, (a, b) in data.items():
        tot = name == "итого"
        d = 2 if tot else 1
        cls, tcls, size = ("f-pen", "f-pen-t", 11.5) if tot else ("f-raw", "f-sub", 10.5)
        svg.path(f"M{xa} {Y(cr(a)):.1f} L{xb} {Y(cr(b)):.1f}", cls)
        svg.circle(xa, Y(cr(a)), 2.6 if tot else 2.2, "f-pen-fill" if tot else "f-sub")
        svg.circle(xb, Y(cr(b)), 2.6 if tot else 2.2, "f-pen-fill" if tot else "f-sub")
        svg.text(xa - 8, Y(cr(a)) + 4, f"{pct(cr(a), d)}%", tcls, size, anchor="end")
        svg.text(xb + 8, Y(cr(b)) + 4, f"{pct(cr(b), d)}%", tcls, size)
        svg.text(0, Y(cr(a)) + 4, name, "f-hd" if tot else "f-sub", 11.5 if tot else 10.5)
    svg.text(330, yb + 40, f"доля рекламы: {share[0]:.0f}% → {share[1]:.0f}%", "f-pen-t", 11.5, anchor="end")
    svg.note(0, yb + 64, ["каждый канал вырос —", "а сумма упала: сдвинулся микс"], 15)
    return svg.render()


LTV_CH = ("referral", "organic", "paid_search", "social")   # как в таблице урока 4.4


def ltv_curves(days=260):
    """Накопленная выручка на установившего по дням жизни (age <= d),
    как в уроке 4.4: знаменатель — все пользователи канала."""
    con = db()
    size = dict(con.execute("SELECT channel, COUNT(*) FROM app_users GROUP BY channel"))
    per = {ch: [0.0] * (days + 1) for ch in LTV_CH}
    for ch, age, rev in con.execute(
            "SELECT u.channel, julianday(o.order_date) - julianday(u.signup_date), o.revenue "
            "FROM app_orders o JOIN app_users u USING (user_id)"):
        if ch in per:
            per[ch][min(days, max(0, int(-(-age // 1))))] += rev
    out = {}
    for ch in LTV_CH:
        acc, cur = [], 0.0
        for v in per[ch]:
            cur += v
            acc.append(cur / size[ch])
        out[ch] = acc
    return out


def fig_ltv_horizon():
    cur = ltv_curves()
    days = len(cur[LTV_CH[0]]) - 1
    x0, x1, yt, yb = 40, 238, 34, 214        # справа место под подписи каналов
    X = lambda d: x0 + (x1 - x0) * d / days
    Y = lambda v: yb - (yb - yt) * v / 4000
    svg = Svg("ltv-horizon", 298,
              "LTV по каналам растёт по-разному",
              "Накопленная выручка на привлечённого пользователя по дням жизни. Referral растёт до конца "
              f"наблюдения, до {cur['referral'][-1]:.0f} рублей, organic — до {cur['organic'][-1]:.0f}. "
              f"Paid_search и social выходят на плато к шестидесятому дню: {cur['paid_search'][-1]:.0f} и "
              f"{cur['social'][-1]:.0f}. На седьмом дне referral лучше paid_search вдвое, в итоге — в пять раз.")
    svg.text(0, 14, "накопленный LTV, ₽ на пользователя", "f-hd", 12.5)
    for v in (0, 2000, 4000):
        svg.line(x0, Y(v), x1, Y(v), "f-row")
        svg.text(x0 - 6, Y(v) + 4, f"{v:,}".replace(",", " "), "f-sub", 10, anchor="end")
    for d in (7, 60):
        svg.path(f"M{X(d):.1f} {yt} V{yb}", "f-soft")
        svg.text(X(d), yb + 16, f"{d} дн", "f-sub", 10.5, anchor="middle")
    svg.text(x1, yb + 16, f"{days} дн", "f-sub", 10.5, anchor="end")
    ends = {"referral": 0, "organic": 0, "paid_search": -7, "social": 7}   # разнести близкие подписи
    for ch in LTV_CH:
        v = cur[ch]
        hot = ch == "referral"
        svg.path("M" + " L".join(f"{X(d):.1f} {Y(v[d]):.1f}" for d in range(0, days + 1, 2)),
                 "f-pen" if hot else "f-raw")
        svg.text(x1 + 4, Y(v[-1]) + 4 + ends[ch], f"{ch} {v[-1]:.0f}",
                 "f-pen-t" if hot else "f-sub", 10.5 if hot else 10)
    svg.note(0, yb + 46, ["платные каналы после 60 дней не приносят", "ничего — горизонт решает, кто лучше"], 15)
    return svg.render()


def rfm_segment(r, f):
    """Правила из условия задачи урока 4.5, в том же порядке."""
    if r >= 4 and f >= 4:
        return "чемпионы"
    if r >= 3 and f >= 3:
        return "лояльные"
    if r >= 4 and f <= 2:
        return "перспективные"
    if r <= 2 and f >= 4:
        return "уходят ценные"
    if r <= 2 and f <= 2:
        return "спящие"
    return "прочие"


def fig_rfm_map():
    c, x0, y0 = 50, 44, 34                          # клетка и левый верхний угол сетки
    X = lambda r: x0 + (r - 1) * c                  # левый край столбца R
    Y = lambda f: y0 + (5 - f) * c                  # верх строки F (F = 5 сверху)
    svg = Svg("rfm-map", 364,
              "Карта сегментов RFM по оценкам давности и частоты",
              "Сетка пять на пять: по горизонтали оценка давности R, справа недавние, по вертикали оценка "
              "частоты F, сверху частые. Правый верхний угол — чемпионы, правый нижний — перспективные, "
              "левый верхний — уходят ценные, левый нижний — спящие. Лояльные — уголок вокруг чемпионов, "
              "остальное — прочие. Перспективные и уходящие ценные выделены: с ними основная работа.")
    svg.text(0, 14, "сегменты по оценкам R и F", "f-hd", 12.5)
    for k in range(1, 5):                           # сетка линиями: у f-row нет fill: none
        svg.line(X(k + 1), Y(5), X(k + 1), Y(1) + c, "f-row")
        svg.line(X(1), Y(k), X(5) + c, Y(k), "f-row")
    # границы между разными сегментами — толще
    for r in range(1, 6):
        for f in range(1, 6):
            seg = rfm_segment(r, f)
            if r < 5 and rfm_segment(r + 1, f) != seg:
                svg.line(X(r + 1), Y(f), X(r + 1), Y(f) + c, "f-raw")
            if f < 5 and rfm_segment(r, f + 1) != seg:
                svg.line(X(r), Y(f), X(r) + c, Y(f), "f-raw")
    svg.rect(X(1), Y(5), 5 * c, 5 * c, "f-box", 0)
    for r0, f0 in ((4, 2), (1, 5)):                 # перспективные и уходят ценные: блоки 2×2
        svg.rect(X(r0) + 2, Y(f0) + 2, 2 * c - 4, 2 * c - 4, "f-pen", 4)
    lab = [("чемпионы", 4.5, 4.5, "f-hd"), ("перспективные", 4.5, 1.5, "f-pen-t"),
           ("спящие", 1.5, 1.5, "f-sub"), ("лояльные", 3, 4.5, "f-sub"), ("лояльные", 4.5, 3, "f-sub"), ("прочие", 3, 1.5, "f-sub"),
           ("прочие", 1.5, 3, "f-sub")]
    for t, r, f, cls in lab:
        svg.text(X(r) + c / 2, Y(f) + c / 2 + 4, t, cls, 10 if cls != "f-pen-t" else 9.5, anchor="middle")
    svg.text(X(1.5) + c / 2, Y(4.5) + c / 2 - 3, "уходят", "f-pen-t", 10.5, anchor="middle")
    svg.text(X(1.5) + c / 2, Y(4.5) + c / 2 + 11, "ценные", "f-pen-t", 10.5, anchor="middle")
    for k in range(1, 6):
        svg.text(X(k) + c / 2, Y(1) + c + 14, str(k), "f-sub", 10.5, anchor="middle")
        svg.text(x0 - 8, Y(k) + c / 2 + 4, str(k), "f-sub", 10.5, anchor="end")
    svg.text(X(1), Y(1) + c + 32, "R: давно ←  → недавно", "f-sub", 10.5)
    svg.text(0, y0 - 8, "F", "f-sub", 10.5)
    svg.note(0, Y(1) + c + 62, ["основная работа — с двумя", "выделенными углами"], 15)
    return svg.render()


def fig_dash_pyramid():
    """Эскиз дашборда из урока 4.6. Числа условные: это макет, не отчёт."""
    import math
    w, ax = 206, 218                                # ширина макета, колонка подписей
    svg = Svg("dash-pyramid", 354,
              "Дашборд в три этажа",
              "Эскиз дашборда. Верх: три главных числа с изменением к прошлой неделе — отвечает на вопрос "
              "«всё в порядке?» за пять секунд. Середина: график по дням с полосой обычного разброса и разрез "
              "по сегментам — «где именно», за минуту. Низ: таблица деталей, которую открывают раз в месяц.")
    svg.text(0, 14, "сверху вниз — по частоте использования", "f-hd", 12.5)
    tiles = [("DAU", "4 010", "+2%"), ("конверсия", "3,2%", "−0,1 п.п."), ("ARPU", "1 842 ₽", "+3%")]
    tw = (w - 8) / 3
    for i, (name, val, d) in enumerate(tiles):
        x = i * (tw + 4)
        svg.rect(x, 30, tw, 52, "f-pen", 4)
        svg.text(x + 6, 44, name, "f-sub", 9)
        svg.text(x + 6, 62, val, "f-hd", 12)
        svg.text(x + 6, 76, f"{d} к нед.", "f-sub", 8.5)
    # середина: линия по дням в полосе нормы и разрез по сегментам
    top, h = 96, 64
    svg.rect(0, top, w, h, "f-box", 4)
    band = lambda x, k: top + h / 2 + k * 10 + 4 * math.sin(x / 30)
    xs = range(6, w - 5, 6)
    svg.path("M" + " L".join(f"{x} {band(x, -1):.1f}" for x in xs), "f-soft")
    svg.path("M" + " L".join(f"{x} {band(x, 1):.1f}" for x in xs), "f-soft")
    svg.path("M" + " L".join(f"{x} {band(x, 0) + 5 * math.sin(x / 7) * math.cos(x / 17):.1f}" for x in xs), "f-raw")
    svg.text(6, top + 12, "по дням, полоса — норма", "f-sub", 8.5)
    for i, (seg, v) in enumerate((("iOS", .9), ("Android", .7), ("web", .45))):
        y = top + h + 10 + i * 14
        svg.text(0, y + 9, seg, "f-sub", 9)
        svg.rect(48, y + 2, (w - 50) * v, 8, "f-box", 2)
    # низ: таблица
    tt = top + h + 60
    svg.rect(0, tt, w, 70, "f-box", 4)
    for k in range(1, 5):
        svg.line(0, tt + k * 14, w, tt + k * 14, "f-row")
    svg.line(w * .45, tt, w * .45, tt + 70, "f-row")
    svg.text(6, tt + 10, "детали", "f-sub", 8.5)
    notes = [(56, "всё в порядке?", "5 секунд", True), (top + 50, "где именно?", "минута", False),
             (tt + 38, "детали", "раз в месяц", False)]
    for y, q, t, hot in notes:
        svg.text(ax, y - 6, q, "f-hd" if hot else "f-sub", 11 if hot else 10.5)
        svg.text(ax, y + 10, t, "f-pen-t" if hot else "f-sub", 11.5 if hot else 10.5)
    svg.note(0, tt + 104, ["рядом с каждым числом — база", "сравнения: неделя, план или норма"], 15)
    return svg.render()


def fig_answer_first():
    """Урок 4.7: вывод первым. Доли дочитавших условные — иллюстрация
    фразы урока «до последнего абзаца доходит меньшинство»."""
    reach = [100, 60, 35, 15]
    acad = ["метод", "расчёты", "оговорки", "вывод"]
    memo = ["вывод и деньги", "обоснование", "оговорки", "детали"]
    bh, gap, y0 = 34, 8, 52
    ca, cm, cw = 78, 206, 122                       # левые края столбцов и ширина
    svg = Svg("answer-first", 290,
              "Вывод первым: где его прочтут",
              "Слева условные доли читателей, дошедших до каждой части текста: 100, 60, 35 и 15 процентов. "
              "В академическом тексте вывод стоит последним, и его увидят немногие. В деловой записке вывод "
              "и деньги стоят первыми и доходят до всех, а детали внизу нужны тем, кто хочет проверить.")
    svg.text(0, 14, "сколько читателей дошло до строки", "f-hd", 12.5)
    svg.text(0, y0 - 10, "дочитали", "f-sub", 10)
    svg.text(ca, y0 - 10, "академический текст", "f-sub", 10)
    svg.text(cm, y0 - 10, "деловая записка", "f-hd", 10.5)
    for i, (r, a, m) in enumerate(zip(reach, acad, memo)):
        y = y0 + i * (bh + gap)
        svg.rect(0, y + 8, 64 * r / 100, bh - 16, "f-box", 2)
        svg.text(0, y + bh + 2, f"{r}%", "f-sub", 9.5)
        for x, t, hot in ((ca, a, a == "вывод"), (cm, m, i == 0)):
            svg.rect(x, y, cw, bh, "f-pen" if hot else "f-box", 4)
            svg.text(x + cw / 2, y + bh / 2 + 4, t, "f-pen-t" if hot else "f-sub",
                     11 if hot else 10.5, anchor="middle")
    y = y0 + 4 * (bh + gap)
    svg.text(0, y + 6, "доли условные", "f-sub", 9.5)
    svg.note(0, y + 34, ["первые три предложения: что происходит,", "сколько стоит и что предлагаете"], 15)
    return svg.render()


FIGS_M4 = {
    "answer-first": fig_answer_first,
    "dash-pyramid": fig_dash_pyramid,
    "rfm-map": fig_rfm_map,
    "ltv-horizon": fig_ltv_horizon,
    "simpson-mix": fig_simpson_mix,
    "funnel-steps": fig_funnel_steps,
    "retention-defs": fig_retention_defs,
}


def check_m4():
    errs = []
    cur = ltv_curves()
    got = {ch: [round(cur[ch][h]) for h in (7, 30, 60, 90)] + [round(cur[ch][-1])] for ch in LTV_CH}
    if got != {"referral": [575, 1991, 2871, 3386, 3803], "organic": [607, 1763, 2456, 2722, 2829],
               "paid_search": [287, 674, 731, 754, 754], "social": [374, 684, 728, 728, 728]}:
        errs.append(f"ltv-horizon: {got} — не совпало с таблицей урока 4.4")
    if funnel_data() != [220, 206, 175, 121, 64]:
        errs.append(f"funnel-steps: {funnel_data()} вместо 220 → 206 → 175 → 121 → 64 из урока 4.2")
    c, r = retention_data()
    got = [(n, pct(c[n]), pct(r[n])) for n in (1, 7, 14, 30)]
    if got != [(1, "40,1", "56,8"), (7, "18,8", "41,1"), (14, "12,2", "30,4"), (30, "6,5", "15,9")]:
        errs.append(f"retention-defs: {got} — не совпало с теорией урока 4.3")
    d = simpson_data()
    got = [f"{100 * p / v:.2f}" for a, b in d.values() for v, p in (a, b)]
    if got != ["4.00", "4.20", "1.20", "1.30", "3.30", "2.17"]:
        errs.append(f"simpson-mix: {got} — пример должен расти в каналах и падать в целом")
    return errs


# ---------------------------------------------------------------- схемы m5
# Учебные точки: схемы объясняют идею и не повторяют числа задач.

OLS_PTS = [(1, 2.0), (2, 3.4), (3, 2.9), (4, 5.2), (5, 4.1), (6, 6.4), (7, 5.6), (8, 9.4)]


def ols_line(pts):
    n = len(pts)
    mx = sum(x for x, _ in pts) / n
    my = sum(y for _, y in pts) / n
    b1 = sum((x - mx) * (y - my) for x, y in pts) / sum((x - mx) ** 2 for x, _ in pts)
    return my - b1 * mx, b1


def fig_ols_squares():
    b0, b1 = ols_line(OLS_PTS)
    x0, yb, k = 20, 222, 22                         # начало осей и px на единицу по обеим осям
    X = lambda v: x0 + k * v
    Y = lambda v: yb - k * (v - 1.2)                # ось y начинается не с нуля
    big = max(OLS_PTS, key=lambda p: abs(p[1] - b0 - b1 * p[0]))
    svg = Svg("ols-squares", 290,
              "Метод наименьших квадратов: квадраты остатков",
              "Восемь точек и прямая, подобранная методом наименьших квадратов. От каждой точки "
              "до прямой — вертикальный отрезок, остаток, и на нём построен квадрат. Прямая "
              "выбрана так, чтобы суммарная площадь квадратов была наименьшей. Самый крупный "
              "промах даёт самый большой квадрат и сильнее всего тянет прямую к себе.")
    svg.text(0, 14, "факт, прогноз и квадраты остатков", "f-hd", 12.5)
    svg.line(x0, yb, 330, yb, "f-row")
    svg.line(x0, yb, x0, 26, "f-row")
    svg.text(330, yb + 16, "признак x", "f-sub", 10.5, anchor="end")
    svg.text(x0 + 4, 34, "y", "f-sub", 10.5)
    for x, y in OLS_PTS:
        f = b0 + b1 * x
        e = abs(y - f) * k
        top = min(Y(y), Y(f))
        # квадрат справа от отрезка; у самой правой точки — слева, чтобы не вылезти за край
        left = X(x) if X(x) + e < 330 else X(x) - e
        svg.rect(round(left, 1), round(top, 1), round(e, 1), round(e, 1),
                 "f-pen" if (x, y) == big else "f-soft", 0)
        svg.line(X(x), round(Y(y), 1), X(x), round(Y(f), 1), "f-raw")
        svg.circle(X(x), round(Y(y), 1), 2.6, "f-sub")
    svg.path(f"M{X(0.3):.1f} {Y(b0 + b1 * 0.3):.1f} L{X(10):.1f} {Y(b0 + b1 * 10):.1f}", "f-pen")
    svg.text(X(10) + 4, Y(b0 + b1 * 10) + 4, "прогноз ŷ", "f-pen-t", 11.5)
    svg.note(0, yb + 40, ["крупный промах — большой квадрат,", "его штрафуют сильнее всего"], 15)
    return svg.render()


def resid_samples():
    """Три учебных облака остатков по 70 точек: шум, изогнутое среднее, воронка.
    x — прогноз от 0 до 1."""
    import random
    rnd = random.Random(7)
    out = {"ok": [], "curve": [], "fan": []}
    for i in range(70):
        x = (i + rnd.random()) / 70
        g = rnd.gauss(0, 1)
        out["ok"].append((x, .28 * g))
        out["curve"].append((x, 1.1 * (x - .5) ** 2 * 4 - .37 + .16 * g))
        out["fan"].append((x, (.05 + .5 * x) * g))
    return out


def fig_resid_patterns():
    data = resid_samples()
    pw, gap, top, ph = 102, 12, 34, 120
    svg = Svg("resid-patterns", 262,
              "Три картины остатков",
              "Три облака остатков против прогноза. Первое — ровная полоса вокруг нуля: остатки "
              "похожи на шум, модель в порядке. Второе — облако изогнуто дугой: среднее остатков "
              "меняется по диапазону, связь не линейна. Третье — облако расширяется вправо, как "
              "воронка: разброс растёт с прогнозом, это гетероскедастичность.")
    svg.text(0, 14, "остаток против прогноза", "f-hd", 12.5)
    titles = {"ok": ["шум —", "всё в порядке"], "curve": ["дуга —", "связь не линейна"],
              "fan": ["воронка — разброс", "растёт с прогнозом"]}
    for j, key in enumerate(("ok", "curve", "fan")):
        x0 = j * (pw + gap)
        mid = top + ph / 2
        svg.rect(x0, top, pw, ph, "f-box", 4)
        svg.line(x0, mid, x0 + pw, mid, "f-soft")
        for x, e in data[key]:
            e = max(-1, min(1, e))
            svg.circle(round(x0 + 6 + (pw - 12) * x, 1), round(mid - (ph / 2 - 6) * e, 1), 1.5,
                       "f-pen-fill" if key != "ok" else "f-sub")
        for i, t in enumerate(titles[key]):
            svg.text(x0 + pw / 2, top + ph + 18 + 14 * i, t, "f-hd" if i == 0 else "f-sub",
                     11.5 if i == 0 else 10.5, anchor="middle")
    svg.text(330, top + ph + 56, "по горизонтали — прогноз, по вертикали — остаток", "f-sub", 10.5, anchor="end")
    svg.note(0, top + ph + 84, ["ищут не число, а форму облака"], 15)
    return svg.render()


# Учебные оценки модели: 1 — купил, 0 — нет. Не из задачи (там AUC 0,8617)
# и не из тренажёра на восьми наблюдениях.
ROC_PTS = [(.92, 1), (.81, 1), (.74, 0), (.66, 1), (.52, 1),
           (.45, 0), (.38, 0), (.30, 1), (.21, 0), (.12, 0)]


def roc_auc(pts):
    pos = [s for s, y in pts if y]
    neg = [s for s, y in pts if not y]
    return sum((p > n) + .5 * (p == n) for p in pos for n in neg) / (len(pos) * len(neg))


def fig_roc_steps():
    pts = sorted(ROC_PTS, reverse=True)
    npos = sum(y for _, y in pts)
    nneg = len(pts) - npos
    x0, yb, side = 44, 236, 190
    X = lambda f: x0 + side * f
    Y = lambda t: yb - side * t
    auc = roc_auc(pts)
    svg = Svg("roc-steps", 312,
              "ROC-кривая строится ступеньками по отсортированным оценкам",
              f"Десять человек, {npos} покупателей и {nneg} непокупателей, отсортированы по оценке модели. "
              "Идём сверху вниз: покупатель — шаг вверх, непокупатель — шаг вправо. Получается ступенчатая "
              f"ROC-кривая, площадь под ней AUC = {pct(auc, 2)}. Диагональ — случайное угадывание, AUC 0,5. "
              "Порог 0,5 — одна точка на кривой: поймано 4 покупателя из 5, ложная тревога 1 из 5.")
    svg.text(0, 14, "доля пойманных покупателей", "f-hd", 12.5)
    svg.rect(x0, Y(1), side, side, "f-box", 0)
    svg.line(X(0), Y(0), X(1), Y(1), "f-soft")
    svg.text(X(.62), Y(.5) + 8, "угадывание", "f-sub", 10.5)
    for v in (0, .5, 1):
        svg.text(x0 - 6, Y(v) + 4, f"{v * 100:.0f}%", "f-sub", 10.5, anchor="end")
        svg.text(X(v), yb + 16, f"{v * 100:.0f}%", "f-sub", 10.5, anchor="middle")
    svg.text(X(1), yb + 32, "доля ложных тревог", "f-sub", 10.5, anchor="end")
    tp = fp = 0
    d = f"M{X(0):.1f} {Y(0):.1f}"
    cut = None
    for sc, y in pts:
        if sc < .5 and cut is None:
            cut = (fp / nneg, tp / npos)
        if y:
            tp += 1
        else:
            fp += 1
        d += f" L{X(fp / nneg):.1f} {Y(tp / npos):.1f}"
    svg.path(d, "f-pen")
    svg.circle(X(cut[0]), Y(cut[1]), 3.2)
    svg.text(X(cut[0]) + 8, Y(cut[1]) + 16, "порог 0,5", "f-pen-t", 11.5)
    svg.text(X(.5), Y(.12), f"AUC = {pct(auc, 2)}", "f-hd", 12.5, anchor="middle")
    # столбик оценок: как из него получается каждая ступенька
    cx, ry = 300, (side - 10) / len(pts)
    svg.text(cx, Y(1) - 8, "оценки", "f-sub", 10.5, anchor="middle")
    for i, (sc, y) in enumerate(pts):
        yy = Y(1) + 10 + i * ry
        svg.text(cx - 6, yy + 4, f"{sc:.2f}".replace(".", ","), "f-pen-t" if y else "f-sub",
                 11.5 if y else 10.5, anchor="end")
        svg.text(cx + 6, yy + 4, "↑" if y else "→", "f-pen-t" if y else "f-sub", 11.5)
        if i < len(pts) - 1 and sc >= .5 > pts[i + 1][0]:
            svg.line(cx - 34, yy + ry / 2, cx + 22, yy + ry / 2, "f-pen")
    svg.note(0, yb + 60, ["покупатель — шаг вверх, непокупатель —", "вправо; порог — точка на ступеньках"], 15)
    return svg.render()


# Пороги песочницы: по одному в каждом промежутке между оценками ROC_PTS,
# от «никого не берём» до «берём всех». Правило: «купит», если оценка ≥ порога.
ROC_THR = (.95, .9, .8, .7, .6, .5, .4, .35, .25, .15, .05)


def roc_sandbox():
    """Песочница урока 5.3: тот же учебный пример, что в схеме roc-steps,
    ползунок идёт по порогам сверху вниз — точка ползёт по ступенькам."""
    pts = sorted(ROC_PTS, reverse=True)
    npos = sum(y for _, y in pts)
    tp = [sum(y for sc, y in pts if sc >= t) for t in ROC_THR]
    fp = [sum(1 - y for sc, y in pts if sc >= t) for t in ROC_THR]
    return {"pos": list(ROC_THR), "start": ROC_THR.index(.5), "name": "Порог классификации",
            "ticks": [[0, "0,95"], [ROC_THR.index(.5), "0,5"], [len(ROC_THR) - 1, "0,05"]],
            "pts": [[sc, y] for sc, y in pts], "npos": npos, "nneg": len(pts) - npos,
            "auc": roc_auc(pts), "tp": tp, "fp": fp,
            "expect": [f"{t / npos * 100:.0f}%" for t in tp],
            "caption": "Рис. Двигайте ползунок: чем ниже порог, тем больше покупателей поймано — "
                       "и тем больше ложных тревог. Точка идёт по ступенькам ROC-кривой"}


# Учебная чаша L(b) = b²: вторая производная 2, граница шага 2/2 = 1.
# Шаги свои, не 0,5 и 1,1 из задачи урока 5.5.
GD_STEPS = [(.1, -1.0, "шаг 0,1 — мал", "ползёт к минимуму"),
            (.35, -1.0, "шаг 0,35 — в самый раз", "доходит за пару шагов"),
            (1.05, -.8, "шаг 1,05 — велик", "перепрыгивает и уходит")]


def gd_path(lr, b, n=6):
    out = [b]
    for _ in range(n - 1):
        b = b - lr * 2 * b                          # градиент b² равен 2b
        out.append(b)
    return out


# Шаги песочницы. Не берём шаги задачи урока 5.5 (0,01; 0,1 там на другой
# задаче; 0,5; 1,1) кроме 0,1 из статичной схемы, и шаги тренажёра
# «Найти границу устойчивости» (0,05 0,2 0,4 0,6 0,8 0,9 0,95 1,0).
GD_LRS = (.03, .1, .15, .25, .35, .45, .7, .85, .98, 1.02, 1.05)
GD_HIDDEN = (.01, .5, 1.1, .05, .2, .4, .6, .8, .9, .95, 1.0)
GD_BOTTOM = .01                                     # «дно»: |b| < 0,01 при старте из −1


def gd_note(lr):
    if lr < .2:
        return "шаг мал — ползёт к минимуму"
    if lr < .5:
        return "в самый раз — доходит быстро"
    if lr < 1:
        return "скачет со склона на склон, но сходится"
    return "перепрыгивает и уходит вверх"


def gd_sandbox():
    """Песочница урока 5.5: чаша L = b² из схемы gd-steps, старт b = −1,
    десять шагов; bottom — сколько шагов до |b| < 0,01 (None — расходится)."""
    paths, bottom = [], []
    for lr in GD_LRS:
        paths.append([round(b, 6) for b in gd_path(lr, -1.0, 11)])
        q = abs(1 - 2 * lr)                         # каждый шаг умножает b на (1 − 2η)
        bottom.append(None if q >= 1 else math.ceil(math.log(GD_BOTTOM) / math.log(q) - 1e-9))
    return {"pos": list(GD_LRS), "start": GD_LRS.index(.35), "name": "Длина шага",
            "ticks": [[0, "0,03"], [GD_LRS.index(.35), "0,35"], [GD_LRS.index(.98), "0,98"],
                      [len(GD_LRS) - 1, "1,05"]],
            "paths": paths, "bottom": bottom, "notes": [gd_note(lr) for lr in GD_LRS], "lim": 1.3,
            "expect": ["расходится" if b is None else str(b) for b in bottom],
            "caption": "Рис. Двигайте ползунок: та же чаша L = b², десять шагов спуска из b = −1. "
                       "Медленно и при слишком малом шаге, и у самой границы η = 1, а за ней спуск расходится"}


SANDBOX_M5 = {"roc-steps": roc_sandbox, "gd-steps": gd_sandbox}



def fig_gd_steps():
    lim, w, ph, gap, y = 1.3, 200, 74, 22, 30
    X = lambda b: w * (b + lim) / (2 * lim)
    svg = Svg("gd-steps", 360,
              "Градиентный спуск по параболе при трёх длинах шага",
              "Три копии одной чаши, потеря равна b в квадрате, минимум в нуле. Шаг 0,1: точки медленно "
              "ползут по одному склону. Шаг 0,35: за два шага почти в минимуме. Шаг 1,05: каждая точка "
              "перепрыгивает на другой склон и оказывается выше предыдущей — спуск расходится. "
              "Для этой чаши граница шага равна 1.")
    svg.text(0, 14, "шесть шагов спуска по чаше L = b²", "f-hd", 12.5)
    for lr, b0, title, sub in GD_STEPS:
        base = y + ph
        Y = lambda b: base - (ph - 6) * b * b / lim ** 2
        k = 60
        svg.path("M" + " L".join(f"{X(-lim + 2 * lim * i / k):.1f} {Y(-lim + 2 * lim * i / k):.1f}"
                                 for i in range(k + 1)), "f-soft")
        svg.line(0, base, w, base, "f-row")
        svg.line(X(0), base, X(0), base + 4, "f-row")
        pts = gd_path(lr, b0)
        svg.path("M" + " L".join(f"{X(b):.1f} {Y(b):.1f}" for b in pts), "f-pen")
        for i, b in enumerate(pts):
            svg.circle(round(X(b), 1), round(Y(b), 1), 3 if i == 0 else 2.2,
                       "f-sub" if i == 0 else "f-pen-fill")
        svg.text(330, y + ph / 2 - 2, title, "f-hd", 11.5, anchor="end")
        svg.text(330, y + ph / 2 + 14, sub, "f-pen-t" if lr > 1 else "f-sub",
                 11.5 if lr > 1 else 10.5, anchor="end")
        y = base + gap
    svg.text(X(0), y - gap + 16, "минимум", "f-sub", 10.5, anchor="middle")
    svg.note(0, y + 20, ["граница η < 2/λ: здесь λ = 2,", "значит, шаг больше 1 уже расходится"], 15)
    return svg.render()


def arrow(svg, x1, y1, x2, y2, cls="f-pen", head=6):
    """Стрелка от (x1, y1) к (x2, y2) с двумя усиками на конце."""
    import math
    a = math.atan2(y2 - y1, x2 - x1)
    h = [(x2 - head * math.cos(a - s), y2 - head * math.sin(a - s)) for s in (.45, -.45)]
    svg.path(f"M{x1:.1f} {y1:.1f} L{x2:.1f} {y2:.1f} M{h[0][0]:.1f} {h[0][1]:.1f} "
             f"L{x2:.1f} {y2:.1f} L{h[1][0]:.1f} {h[1][1]:.1f}", cls)


def fig_four_causes():
    pw, ph, gx, gy, top = 160, 104, 10, 16, 30
    svg = Svg("four-causes", 318,
              "Четыре объяснения корреляции",
              "Четыре маленькие схемы. Причинность: скидка вызывает продажи. Обратная причинность: уход "
              "вызывает обращения в поддержку, а не наоборот. Общая причина: жара вызывает и продажи "
              "мороженого, и утопления, между которыми прямой связи нет. Артефакт отбора: балл и спорт "
              "оба ведут к поступлению, и среди поступивших между ними появляется связь. Пунктир — "
              "наблюдаемая корреляция, стрелка — причина.")
    svg.text(0, 14, "стрелка — причина, пунктир — видимая связь", "f-hd", 12.5)

    def node(x, y, t, cls="f-box"):
        w = 9 + 6.2 * len(t)
        svg.rect(x - w / 2, y - 11, w, 22, cls, 4)
        svg.text(x, y + 4, t, "f-sub" if cls == "f-box" else "f-hd", 10, anchor="middle")
        return w / 2

    panels = ["причинность", "обратная причинность", "общая причина", "артефакт отбора"]
    for k, title in enumerate(panels):
        x0 = (k % 2) * (pw + gx)
        y0 = top + (k // 2) * (ph + gy)
        svg.rect(x0, y0, pw, ph, "f-soft", 5)             # у f-row нет fill: none
        svg.text(x0 + 8, y0 + 16, title, "f-hd", 11)
        cx, l, r, yy = x0 + pw / 2, x0 + 40, x0 + pw - 40, y0 + 66
        if k == 0:
            a = node(l, yy, "скидка"); b = node(r, yy, "продажи")
            arrow(svg, l + a + 2, yy, r - b - 4, yy)
        elif k == 1:
            a = node(l, yy, "поддержка"); b = node(r, yy, "уход")
            arrow(svg, r - b - 2, yy + 6, l + a + 4, yy + 6)
            svg.path(f"M{l + a + 2:.1f} {yy - 6} L{r - b - 2:.1f} {yy - 6}", "f-dash")
        elif k == 2:
            node(cx, y0 + 40, "жара", "f-pen")
            l, r = x0 + 36, x0 + pw - 36                 # раздвинуть: иначе пунктир не виден
            a = node(l, y0 + 84, "мороженое"); b = node(r, y0 + 84, "утопления")
            arrow(svg, cx - 10, y0 + 51, l + 6, y0 + 72)
            arrow(svg, cx + 10, y0 + 51, r - 6, y0 + 72)
            svg.path(f"M{l + a + 2:.1f} {y0 + 84} L{r - b - 2:.1f} {y0 + 84}", "f-dash")
        else:
            a = node(l, y0 + 40, "балл"); b = node(r, y0 + 40, "спорт")
            node(cx, y0 + 84, "поступили", "f-pen")
            arrow(svg, l + 6, y0 + 51, cx - 14, y0 + 72)
            arrow(svg, r - 6, y0 + 51, cx + 14, y0 + 72)
            svg.path(f"M{l + a + 2:.1f} {y0 + 40} L{r - b - 2:.1f} {y0 + 40}", "f-dash")
    y = top + 2 * ph + gy
    svg.note(0, y + 34, ["причинность — только одна", "из четырёх версий"], 15)
    return svg.render()


FIGS_M5 = {
    "four-causes": fig_four_causes,
    "ols-squares": fig_ols_squares,
    "resid-patterns": fig_resid_patterns,
    "roc-steps": fig_roc_steps,
    "gd-steps": fig_gd_steps,
}


def check_m5():
    errs = []
    b0, b1 = ols_line(OLS_PTS)
    if f"{b0:.3f} {b1:.3f}" != "1.007 0.860":
        errs.append(f"ols-squares: прямая {b0:.3f} + {b1:.3f}x — поменялись учебные точки?")
    if roc_auc(ROC_PTS) != .8:
        errs.append(f"roc-steps: AUC {roc_auc(ROC_PTS)} вместо 0,80")
    sb = roc_sandbox()
    if any(sum(sc >= a for sc, _ in ROC_PTS) != sum(sc >= b for sc, _ in ROC_PTS) - 1
           for a, b in zip(ROC_THR, ROC_THR[1:])):
        errs.append("roc-sandbox: между соседними порогами должна быть ровно одна оценка")
    i = sb["start"]
    if (sb["tp"][i], sb["fp"][i], sb["tp"][-1], sb["fp"][-1]) != (4, 1, 5, 5):
        errs.append(f"roc-sandbox: при пороге 0,5 {sb['tp'][i]} из 5 и {sb['fp'][i]} из 5 — в схеме 4 и 1")
    gb = gd_sandbox()
    if set(GD_LRS) & set(GD_HIDDEN):
        errs.append("gd-sandbox: среди шагов есть шаг из задачи или тренажёра урока 5.5")
    got = dict(zip(GD_LRS, gb["bottom"]))
    if (got[.35], got[.45], got[.1], got[1.02]) != (4, 2, 21, None):
        errs.append(f"gd-sandbox: шагов до дна {got}")
    if any(b is not None and abs(gd_path(lr, -1.0, b + 1)[-1]) >= GD_BOTTOM for lr, b in got.items()):
        errs.append("gd-sandbox: за bottom шагов |b| не опустился ниже 0,01")
    ends = [abs(gd_path(lr, b)[-1]) < abs(b) for lr, b, _, _ in GD_STEPS]
    if ends != [True, True, False]:
        errs.append(f"gd-steps: сходимость {ends} — два первых шага должны сходиться, третий расходиться")
    return errs


# ---------------------------------------------------------------- схемы m6
# Уроки про поиск работы: схемы без данных базы, только структура.

def fig_cv_gates():
    svg = Svg("cv-gates", 262,
              "Три фильтра на пути отклика",
              "Слева миниатюра резюме, верхняя треть выделена: её видят все фильтры. Справа три шага: "
              "автоматический фильтр по ключевым словам, тридцать секунд рекрутера на первый экран и пять "
              "минут нанимающего менеджера на проекты.")
    svg.text(0, 14, "что видит каждый фильтр", "f-hd", 12.5)
    px, py, pw, ph = 0, 32, 104, 150                # миниатюра страницы
    svg.rect(px, py, pw, ph, "f-box", 3)
    for i, w in enumerate((70, 50, 84, 80, 60)):     # строки первого экрана
        svg.line(px + 10, py + 14 + i * 8, px + 10 + w, py + 14 + i * 8, "f-raw")
    for i in range(9):                              # остальное резюме
        svg.line(px + 10, py + 64 + i * 9, px + 10 + (84 if i % 3 else 60), py + 64 + i * 9, "f-row")
    svg.rect(px + 3, py + 4, pw - 6, ph / 3, "f-pen", 3)
    svg.text(px + pw / 2, py + ph + 16, "первый экран", "f-pen-t", 11, anchor="middle")
    steps = [("ключевые слова", "часто автомат", "SQL, Python — дословно"),
             ("30 секунд", "рекрутер", "первый экран: опыт, конкретика"),
             ("5 минут", "нанимающий менеджер", "проекты: задача, метод, вывод")]
    x, y = 122, 32
    for i, (t, who, what) in enumerate(steps):
        svg.rect(x, y, 208, 42, "f-pen" if i == 1 else "f-box", 4)
        svg.text(x + 8, y + 17, t, "f-hd", 11.5)
        svg.text(x + 200, y + 17, who, "f-sub", 10, anchor="end")
        svg.text(x + 8, y + 33, what, "f-sub", 10)
        if i < 2:
            arrow(svg, x + 104, y + 43, x + 104, y + 55, "f-raw", 4)
        y += 56
    svg.note(0, py + ph + 50, ["в верхней трети нет конкретики —", "до проектов не дочитают"], 15)
    return svg.render()


def fig_notebook_scan():
    pw, ph, top = 150, 220, 34
    svg = Svg("notebook-scan", 318,
              "Ноутбук глазами проверяющего",
              "Два ноутбука при беглом пролистывании. Слева только ячейки кода и длинные полотна вывода — "
              "взгляду не за что зацепиться, такой закрывают. Справа заголовок, короткий код, график и "
              "вывод текстом с числом — вывод виден без чтения кода, такой досматривают.")
    svg.text(0, 14, "минута пролистывания", "f-hd", 12.5)
    for k, x0 in enumerate((0, pw + 30)):
        svg.rect(x0, top, pw, ph, "f-box", 4)
        y = top + 10
        if k == 0:
            for blk in range(4):                        # код + полотно вывода
                svg.rect(x0 + 8, y, pw - 16, 22, "f-soft", 2)
                for j in range(2):
                    svg.line(x0 + 14, y + 7 + j * 8, x0 + 14 + (90 if j else 110), y + 7 + j * 8, "f-raw")
                y += 28
                for j in range(4):                      # полотно вывода: густо и заметно
                    svg.line(x0 + 10, y + j * 5, x0 + pw - 12 - (j % 2) * 20, y + j * 5, "f-soft")
                y += 22
        else:
            svg.text(x0 + 10, y + 10, "Отток по каналам", "f-hd", 11)
            svg.rect(x0 + 8, y + 18, pw - 16, 16, "f-soft", 2)
            svg.line(x0 + 14, y + 26, x0 + 100, y + 26, "f-raw")
            y += 44
            svg.rect(x0 + 10, y, pw - 20, 78, "f-soft", 2)   # график
            for i, v in enumerate((.8, .55, .4, .25)):
                svg.rect(x0 + 18, y + 8 + i * 17, (pw - 40) * v, 10, "f-box", 2)
            y += 90
            svg.rect(x0 + 6, y - 4, pw - 12, 42, "f-pen", 4)
            svg.text(x0 + 12, y + 12, "Вывод: social теряет", "f-pen-t", 10)
            svg.text(x0 + 12, y + 28, "вдвое больше, 41%", "f-pen-t", 10)
            y += 50
            svg.line(x0 + 10, y, x0 + pw - 30, y, "f-row")
            svg.line(x0 + 10, y + 8, x0 + pw - 60, y + 8, "f-row")
        svg.text(x0 + pw / 2, top + ph + 18, "закрывают" if k == 0 else "досмотрят",
                 "f-sub" if k == 0 else "f-pen-t", 11 if k == 0 else 11.5, anchor="middle")
    svg.note(0, top + ph + 50, ["выводы видны без чтения кода"], 15)
    return svg.render()


STREAK_DAYS = [1, 2, 3, 7, 8]                        # пример из таблицы урока 6.3, март 2024


def streak_keys():
    import datetime as dt
    out = []
    for n, d in enumerate(STREAK_DAYS, 1):
        day = dt.date(2024, 3, d)
        out.append((day, n, day - dt.timedelta(days=n)))
    return out


def fig_streak_key():
    rows = streak_keys()
    cw, x0, y0 = 36, 42, 36                         # слева место под подписи строк
    X = lambda d: x0 + (d - 1) * cw
    svg = Svg("streak-key", 222,
              "Ключ серии: дата минус номер",
              "Полоса календаря с 1 по 8 марта, активные дни 1, 2, 3, 7 и 8. Под активными днями — номер по "
              "порядку и разность «дата минус номер»: 29 февраля у первых трёх дней и 3 марта у двух последних. "
              "Одинаковый ключ собирает дни в серию: три дня и два дня.")
    svg.text(0, 14, "март: дни с заходом обведены", "f-hd", 12.5)
    act = {r[0].day: r for r in rows}
    for d in range(1, 9):
        hot = d in act
        svg.rect(X(d) + 2, y0, cw - 4, 30, "f-pen" if hot else "f-box", 4)
        svg.text(X(d) + cw / 2, y0 + 20, str(d), "f-pen-t" if hot else "f-sub",
                 12 if hot else 10.5, anchor="middle")
    svg.text(0, y0 + 56, "№", "f-sub", 10.5)
    svg.text(0, y0 + 82, "ключ", "f-sub", 10)
    for d, (day, n, key) in act.items():
        svg.text(X(d) + cw / 2, y0 + 56, str(n), "f-hd", 11.5, anchor="middle")
        svg.text(X(d) + cw / 2, y0 + 82, key.strftime("%d.%m"), "f-pen-t", 10.5, anchor="middle")
    # скобки серий
    groups = {}
    for d, (_, _, key) in act.items():
        groups.setdefault(key, []).append(d)
    by = y0 + 96
    for key, ds in groups.items():
        a, b = X(min(ds)) + 4, X(max(ds)) + cw - 4
        svg.path(f"M{a} {by} V{by + 6} H{b} V{by}", "f-raw")
        svg.text((a + b) / 2, by + 22, f"серия: {len(ds)} " + ("дня" if len(ds) < 5 else "дней"),
                 "f-hd", 11, anchor="middle")
    svg.note(0, by + 58, ["пропуск в датах — и ключ", "сразу меняется"], 15)
    return svg.render()


AT_ROWS = [("A", 10), ("A", 30), ("B", 20)]           # игрушечная таблица к уроку 6.4


def fig_agg_transform():
    sums = {}
    for k, v in AT_ROWS:
        sums[k] = sums.get(k, 0) + v
    rh = 24
    svg = Svg("agg-transform", 222,
              "agg и transform у groupby",
              "Исходная таблица из трёх строк: A 10, A 30, B 20. agg со суммой схлопывает группы в две "
              "строки: A 40, B 20. transform со суммой возвращает столбец той же длины, что исходный: "
              "40, 40, 20 — его можно приписать к таблице как новый столбец.")
    svg.text(0, 14, "df.groupby(\"k\")[\"v\"]", "f-hd", 12.5)
    m0 = table(svg, 0, 44, 96, "исходная", [("k", 12, "start"), ("v", 84, "end")],
               [(k, str(v)) for k, v in AT_ROWS], rh)
    m1 = table(svg, 124, 44, 80, ".agg(\"sum\")", [("k", 12, "start"), ("v", 68, "end")],
               [(k, str(v)) for k, v in sums.items()], rh)
    m2 = table(svg, 232, 44, 98, ".transform(\"sum\")", [("k", 12, "start"), ("v", 86, "end")],
               [(k, str(sums[k])) for k, _ in AT_ROWS], rh)
    svg.rect(232, 42, 98, 22 + rh * len(AT_ROWS) + 4, "f-pen", 5)
    y = m0[-1] + rh / 2 + 22
    svg.text(164, y, f"{len(sums)} строки", "f-sub", 10.5, anchor="middle")
    svg.text(330, y, f"{len(AT_ROWS)} строки, как было", "f-pen-t", 11, anchor="end")
    svg.note(0, y + 34, ["agg — сводка по группам, transform —", "новый столбец к исходной таблице"], 15)
    return svg.render()


def fig_metric_levels():
    """Урок 6.5, свой пример: видео в карточке товара (не фичи задачи и тренажёра)."""
    levels = [("ключевая — одна", "решение по ней", ["конверсия карточки в покупку"]),
              ("вспомогательные", "за счёт чего", ["смотрели видео, %", "в корзину после видео"]),
              ("предохранители", "что не сломать", ["загрузка карточки", "доля возвратов"])]
    bh, y = 30, 50
    svg = Svg("metric-levels", 326,
              "Три уровня метрик на примере",
              "Фича: видео в карточке товара. Ключевая метрика одна — конверсия карточки в покупку. "
              "Вспомогательные объясняют механизм: доля посмотревших видео и переход в корзину после видео. "
              "Предохранители не должны ухудшиться: скорость загрузки карточки и доля возвратов.")
    svg.text(0, 14, "фича: видео в карточке товара", "f-hd", 12.5)
    prev = None
    for i, (lvl, why, boxes) in enumerate(levels):
        svg.text(0, y - 8, lvl, "f-hd" if i == 0 else "f-sub", 11 if i == 0 else 10.5)
        svg.text(330, y - 8, why, "f-sub", 10, anchor="end")
        n = len(boxes)
        bw = (330 - 10 * (n - 1)) / n
        cur = []
        for k, t in enumerate(boxes):
            x = k * (bw + 10)
            svg.rect(x, y, bw, bh, "f-pen" if i == 0 else "f-box", 5)
            svg.text(x + bw / 2, y + bh / 2 + 4, t, "f-pen-t" if i == 0 else "f-sub",
                     11 if i == 0 else 10.5, anchor="middle")
            cur.append(x + bw / 2)
        if prev is not None and i == 1:
            for cx in cur:
                svg.path(f"M{prev[0]:.1f} {y - 50} L{cx:.1f} {y}", "f-soft")   # от низа ключевой
        prev = cur
        y += bh + 50
    svg.text(0, y - 26, "предохранители смотрят, даже если ключевая выросла", "f-sub", 10)
    svg.note(0, y + 6, ["«будем смотреть на конверсию» —", "слабо; сильно — все три этажа"], 15)
    return svg.render()


# Воронка найма из таблицы урока 6.6: середины диапазонов конверсий.
HIRE_STEPS = [("отклики", None), ("ответ рекрутера", (.05, .15)), ("скрининг", (.6, .8)),
              ("тестовое", (.4, .6)), ("техсекция", (.5, .7)), ("финал", (.3, .5)), ("оффер", (.3, .5))]
HIRE_START = 300


def hire_funnel():
    n, out = HIRE_START, []
    for name, rng in HIRE_STEPS:
        if rng:
            n *= sum(rng) / 2
        out.append((name, n))
    return out


def fig_hire_funnel():
    rows = hire_funnel()
    lx, bx, bw, rh, y0 = 0, 112, 176, 26, 36
    svg = Svg("hire-funnel", 272,
              "Воронка найма от трёхсот откликов",
              "Триста откликов, конверсии шагов — середины диапазонов из таблицы урока. Ответ рекрутера "
              "получают около 30, скрининг проходят 21, тестовое делают около 10, до техсекции доходят 6, "
              "до финала 2–3, оффер один. Самый узкий — первый шаг: из трёхсот остаются тридцать.")
    svg.text(0, 14, f"{HIRE_START} откликов, середины диапазонов", "f-hd", 12.5)
    for i, (name, v) in enumerate(rows):
        y = y0 + i * rh
        hot = i == 1
        svg.text(lx, y + 13, name, "f-hd" if i in (0, len(rows) - 1) else "f-sub", 10.5)
        svg.rect(bx, y + 2, max(3, bw * v / HIRE_START), 14, "f-pen" if hot else "f-box", 2)
        lab = f"≈ {v:.0f}" if v >= 3.5 else ("2–3" if v >= 2 else f"≈ {v:.0f}")
        svg.text(bx + max(3, bw * v / HIRE_START) + 6, y + 13, lab, "f-pen-t" if hot else "f-sub",
                 11 if hot else 10.5)
    svg.text(330, y0 + rh + 13, "−90%: резюме", "f-pen-t", 11, anchor="end")
    y = y0 + len(rows) * rh
    svg.note(0, y + 26, ["первый шаг самый узкий — резюме", "окупается сильнее подготовки к финалу"], 15)
    return svg.render()


FIGS_M6 = {
    "hire-funnel": fig_hire_funnel,
    "metric-levels": fig_metric_levels,
    "agg-transform": fig_agg_transform,
    "streak-key": fig_streak_key,
    "notebook-scan": fig_notebook_scan,
    "cv-gates": fig_cv_gates,
}


def check_m6():
    """Чисел из базы на схемах m6 нет; сверяем только пример из урока 6.3."""
    rows = hire_funnel()
    if round(rows[-1][1], 2) != 1.01 or round(rows[1][1]) != 30:
        return [f"hire-funnel: {rows} — середины таблицы урока 6.6 должны давать ≈1 оффер на 300"]
    keys = [k.isoformat() for _, _, k in streak_keys()]
    if keys != ["2024-02-29"] * 3 + ["2024-03-03"] * 2:
        return [f"streak-key: ключи {keys} не совпали с таблицей урока 6.3"]
    return []


MODULES = {"m1": (FIGS_M1, check_m1, SANDBOX_M1), "m2": (FIGS_M2, check_m2, {}),
           "m3": (FIGS_M3, check_m3, SANDBOX_M3), "m4": (FIGS_M4, check_m4, {}),
           "m5": (FIGS_M5, check_m5, SANDBOX_M5), "m6": (FIGS_M6, check_m6, {})}

if __name__ == "__main__":
    mod = sys.argv[1] if len(sys.argv) > 1 else ""
    if mod not in MODULES:
        sys.exit("укажите модуль: " + ", ".join(MODULES))
    figs, check, boxes = MODULES[mod]
    errs = check()
    if errs:
        sys.exit("Числа не сошлись с базой:\n" + "\n".join(errs))
    if "--check" in sys.argv:
        print("Числа сходятся с базой.")
        sys.exit(0)
    write_block(mod, {k: f() for k, f in figs.items()}, {k: f() for k, f in boxes.items()})
    print(f"content-{mod}.js: схем {len(figs)} — " + ", ".join(figs))
