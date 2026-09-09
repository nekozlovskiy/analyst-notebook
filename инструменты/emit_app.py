# -*- coding: utf-8 -*-
"""Выгружает сгенерированный журнал приложения в три CSV."""
import datetime
import runpy
import io
import sys
import pathlib

import pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent

W = ROOT / "инструменты"
buf = io.StringIO()
old = sys.stdout
sys.stdout = buf
g = runpy.run_path(str(ROOT / "инструменты" / "gen_app.py"))
sys.stdout = old

users, activity, orders = g["users"], g["activity"], g["orders"]
START = g["START"]


def d(n):
    return (START + datetime.timedelta(days=n)).isoformat()


lines = ["user_id,signup_date,channel,platform,city"]
for uid, s, ch, pl, city in users:
    lines.append("%d,%s,%s,%s,%s" % (uid, d(s), ch, pl, city))
(W / "app_users.csv").write_text("\n".join(lines), encoding="utf-8")

lines = ["user_id,activity_date"]
for uid, day in activity:
    lines.append("%d,%s" % (uid, d(day)))
(W / "app_activity.csv").write_text("\n".join(lines), encoding="utf-8")

lines = ["user_id,order_date,revenue"]
for uid, day, rev in orders:
    lines.append("%d,%s,%d" % (uid, d(day), rev))
(W / "app_orders.csv").write_text("\n".join(lines), encoding="utf-8")

for f in ["app_users.csv", "app_activity.csv", "app_orders.csv"]:
    p = W / f
    print("%-20s %6d строк  %7.0f КБ" %
          (f, p.read_text(encoding="utf-8").count("\n"), p.stat().st_size / 1024))
