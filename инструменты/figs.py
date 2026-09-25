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
    h = 22 + row_h * len(rows)
    svg.rect(x, y, w, h)
    for label, dx, anchor in cols:
        svg.text(x + dx, y + 15, label, "f-sub", 10.5, anchor)
    mids = []
    for i, r in enumerate(rows):
        top = y + 22 + i * row_h
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


FIGS_M1 = {
    "sql-order": fig_sql_order,
    "join-rows": fig_join_rows,
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


MODULES = {"m1": (FIGS_M1, check_m1)}

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
