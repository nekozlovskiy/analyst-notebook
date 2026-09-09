"""Пролог python-уроков модуля 4 для локального прогона.

Читает CSV прямо из data.js, поэтому данные всегда те же, что в курсе.
Работает и при запуске файлом, и когда его склеивают с решением
через `cat appprelude.py sol.py | python3 -`: корень проекта ищется
от текущего каталога вверх по наличию data.js.
"""
import io
import os
import pathlib
import re
import warnings

warnings.filterwarnings("ignore")

import pandas as pd
import numpy as np

pd.set_option("display.width", 200)
pd.set_option("display.max_columns", 50)


def _find_root():
    here = pathlib.Path(os.getcwd()).resolve()
    for d in [here] + list(here.parents):
        if (d / "data.js").exists():
            return d
    raise SystemExit("не нашёл data.js: запускайте из каталога курса")


ROOT = _find_root()
_s = (ROOT / "data.js").read_text(encoding="utf-8")


def _csv(key):
    return re.search(r"\n  %s: `(.*?)`" % key, _s, re.S).group(1)


app_users    = pd.read_csv(io.StringIO(_csv("appUsersCSV")))
app_activity = pd.read_csv(io.StringIO(_csv("appActivityCSV")))
app_orders   = pd.read_csv(io.StringIO(_csv("appOrdersCSV")))

app_users["signup_date"]      = pd.to_datetime(app_users["signup_date"])
app_activity["activity_date"] = pd.to_datetime(app_activity["activity_date"])
app_orders["order_date"]      = pd.to_datetime(app_orders["order_date"])

LAST_DAY = pd.Timestamp("2024-09-30")
