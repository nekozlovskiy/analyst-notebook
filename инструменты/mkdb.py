import re, pathlib, sqlite3, os, csv, io

import pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
BASE = ROOT
W = ROOT / "инструменты"
s = (BASE / "data.js").read_text(encoding="utf-8")
sql = re.search(r"shopSQL: `(.*?)`,\n", s, re.S).group(1)
p = W / "shop.db"
if p.exists():
    p.unlink()
con = sqlite3.connect(p)
con.executescript(sql)
for key, table, cast in (("appUsersCSV", "app_users", (int, str, str, str, str)),
                         ("appActivityCSV", "app_activity", (int, str)),
                         ("appOrdersCSV", "app_orders", (int, str, float))):
    body = re.search(r"\n  %s: `(.*?)`" % key, s, re.S).group(1)
    rows = list(csv.reader(io.StringIO(body)))[1:]
    rows = [tuple(f(v) for f, v in zip(cast, r)) for r in rows if r]
    con.executemany("INSERT INTO %s VALUES (%s)" % (table, ",".join("?" * len(cast))), rows)
    print(table, len(rows))
# выгрузка лидов (урок 1.3): поля в кавычках, пустая ячейка — NULL
body = re.search(r"\n  leadsCSV: `(.*?)`", s, re.S).group(1)
rows = list(csv.reader(io.StringIO(body)))[1:]
rows = [(int(r[0]),) + tuple(v if v != "" else None for v in r[1:7]) for r in rows if r]
con.executemany("INSERT INTO leads VALUES (?,?,?,?,?,?,?)", rows)
print("leads", len(rows))
# база «Дельта Такси» (урок 6.4): DDL и CSV из data-taxi.js, пустая ячейка — NULL
t = (BASE / "data-taxi.js").read_text(encoding="utf-8")
con.executescript(re.search(r"\bsql: `(.*?)`", t, re.S).group(1))
num = lambda v, f: None if v == "" else f(v)
for key, table, cast in (("ridersCSV", "riders", (int, str, str, str)),
                         ("driversCSV", "drivers", (int, str, str, str)),
                         ("tripsCSV", "trips", (int, int, int, str, str, str, str, int,
                                                    str, float, float, float, int))):
    body = re.search(r"\b%s: `(.*?)`" % key, t, re.S).group(1)
    rows = [tuple(num(v, f) for f, v in zip(cast, r)) for r in list(csv.reader(io.StringIO(body)))[1:] if r]
    con.executemany("INSERT INTO %s VALUES (%s)" % (table, ",".join("?" * len(cast))), rows)
    print(table, len(rows))
con.commit()
con.close()
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
print("база собрана:", p, "и", pv)
