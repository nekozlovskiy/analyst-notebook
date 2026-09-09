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
con.commit()
con.close()
print("база собрана:", p)
