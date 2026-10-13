#!/usr/bin/env python3
"""Генератор базы «Дельта Такси» для урока 6.4 «Чужая схема: такси».

    python3 инструменты/gen_taxi.py            # контрольные числа + data-taxi.js
    python3 инструменты/gen_taxi.py --check    # только сверить data-taxi.js

Детерминированный: одно зерно, только random.Random — тот же код даёт
побайтно тот же data-taxi.js. Сюжет, который находят задачи урока:
вечерний пик 18–20 ч — наценка и отказы «нет машины»; в Екатеринбурге
с апреля водителей меньше — растут no_driver и время подачи.
"""
import datetime as dt
import math
import pathlib
import random
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "data-taxi.js"
R = random.Random(2024)

CITIES = [("Москва", 0.5), ("Казань", 0.25), ("Екатеринбург", 0.25)]
START, END = dt.datetime(2024, 1, 1), dt.datetime(2024, 7, 1)
N_RIDERS, N_TRIPS = 1200, 4000
# часы суток: утренний пик 8–9, вечерний 18–20, ночью мало
HOUR_W = [2, 1, 1, 1, 1, 2, 4, 8, 12, 11, 7, 6, 6, 6, 6, 7, 8, 10, 14, 15, 13, 9, 6, 4]
TARIFF = [("econom", 0.65), ("comfort", 0.28), ("business", 0.07)]
FARE = {"econom": (99, 18), "comfort": (149, 24), "business": (299, 42)}   # подача, руб/км


def pick(pairs):
    x, acc = R.random(), 0.0
    for v, w in pairs:
        acc += w
        if x < acc:
            return v
    return pairs[-1][0]


def day(d):
    return d.strftime("%Y-%m-%d")


def minute(d):
    return d.strftime("%Y-%m-%d %H:%M")


def build():
    riders = []
    for i in range(1, N_RIDERS + 1):
        signup = dt.datetime(2023, 6, 1) + dt.timedelta(days=R.randrange(0, 380))
        riders.append((i, signup, pick(CITIES), "ios" if R.random() < 0.45 else "android",
                       R.random() ** 2))             # активность: немногие ездят много
    drivers = []
    for city, n in (("Москва", 150), ("Казань", 75), ("Екатеринбург", 75)):
        for _ in range(n):
            joined = dt.datetime(2022, 1, 1) + dt.timedelta(days=R.randrange(0, 850))
            cls = pick([("econom", 0.6), ("comfort", 0.3), ("business", 0.1)])
            # в Екатеринбурге треть водителей уходит в марте — с апреля не хватает машин
            left = dt.datetime(2024, 3, 1) + dt.timedelta(days=R.randrange(0, 31)) \
                if city == "Екатеринбург" and R.random() < 0.35 else END
            drivers.append([len(drivers) + 1, city, joined, cls, left])

    weights = [r[4] for r in riders]
    trips = []
    for t in range(1, N_TRIPS + 1):
        rid, signup, city, _, _ = R.choices(riders, weights)[0]
        lo = max(START, signup)
        d0 = lo + dt.timedelta(days=R.randrange(0, max(1, (END - lo).days)))
        hour = R.choices(range(24), HOUR_W)[0]
        req = d0.replace(hour=hour, minute=R.randrange(60))
        tariff = pick(TARIFF)
        evening, morning = 18 <= hour <= 20, 8 <= hour <= 9
        ekb_short = city == "Екатеринбург" and req >= dt.datetime(2024, 4, 1)
        ok_cls = {"econom": ("econom", "comfort"), "comfort": ("comfort", "business"),
                  "business": ("business",)}[tariff]
        pool = [d for d in drivers if d[1] == city and d[3] in ok_cls and d[2] <= req < d[4]]
        p_none = 0.03 + (0.08 if evening else 0) + (0.12 if ekb_short else 0) \
            + (0.05 if tariff == "business" else 0)
        surge = 1.0
        if evening and R.random() < 0.6:
            surge = round(1.2 + R.random() * 0.6, 1)
        elif (morning and R.random() < 0.3) or (ekb_short and R.random() < 0.3):
            surge = round(1.1 + R.random() * 0.4, 1)
        row = dict(trip_id=t, rider_id=rid, driver_id=None, city=city, tariff=tariff,
                   requested_at=req, pickup_at=None, ride_min=None, status="no_driver",
                   distance_km=None, price=None, surge=surge, rider_rating=None)
        if not pool or R.random() < p_none:
            trips.append(row)
            continue
        drv = R.choice(pool)
        row["driver_id"] = drv[0]
        wait = 3 + R.expovariate(1 / 4) + (3 if evening else 0) + (4 if ekb_short else 0)
        if R.random() < 0.03:
            row["status"] = "cancelled_driver"
        elif R.random() < 0.04 + 0.01 * max(0, wait - 8):
            row["status"] = "cancelled_rider"
        else:
            km = round(max(1.0, R.lognormvariate(math.log(7), 0.6)), 1)
            pickup = req + dt.timedelta(minutes=round(wait))
            ride = round(km * 2.5 + R.uniform(2, 12))
            base, per_km = FARE[tariff]
            row.update(status="completed", pickup_at=pickup, ride_min=ride, distance_km=km,
                       price=round((base + per_km * km) * surge))
            if R.random() < 0.6:
                bad = wait > 12
                row["rider_rating"] = R.choices([5, 4, 3, 2, 1],
                                                [40, 30, 15, 8, 7] if bad else [72, 20, 5, 2, 1])[0]
        trips.append(row)
    return riders, drivers, trips


def csv_rows(riders, drivers, trips):
    def v(x):
        if x is None:
            return ""
        if isinstance(x, dt.datetime):
            return minute(x)
        return str(x)
    r = ["rider_id,signup_date,city,platform"] + \
        ["%d,%s,%s,%s" % (i, day(s), c, p) for i, s, c, p, _ in riders]
    d = ["driver_id,city,joined,car_class"] + \
        ["%d,%s,%s,%s" % (i, c, day(j), k) for i, c, j, k, _ in drivers]
    cols = ["trip_id", "rider_id", "driver_id", "city", "tariff", "requested_at", "pickup_at",
            "ride_min", "status", "distance_km", "price", "surge", "rider_rating"]
    t = [",".join(cols)] + [",".join(v(row[c]) for c in cols) for row in trips]
    return "\n".join(r), "\n".join(d), "\n".join(t)


DDL = """CREATE TABLE riders (
  rider_id    INTEGER PRIMARY KEY,
  signup_date TEXT NOT NULL,
  city        TEXT NOT NULL,
  platform    TEXT NOT NULL
);
CREATE TABLE drivers (
  driver_id   INTEGER PRIMARY KEY,
  city        TEXT NOT NULL,
  joined      TEXT NOT NULL,
  car_class   TEXT NOT NULL
);
CREATE TABLE trips (
  trip_id      INTEGER PRIMARY KEY,
  rider_id     INTEGER NOT NULL,
  driver_id    INTEGER,
  city         TEXT NOT NULL,
  tariff       TEXT NOT NULL,
  requested_at TEXT NOT NULL,
  pickup_at    TEXT,
  ride_min     INTEGER,
  status       TEXT NOT NULL,
  distance_km  REAL,
  price        REAL,
  surge        REAL NOT NULL,
  rider_rating INTEGER
);"""


def render(riders, drivers, trips):
    rc, dc, tc = csv_rows(riders, drivers, trips)
    return ("/* База «Дельта Такси» для урока 6.4 «Чужая схема: такси».\n"
            "   Собрана инструменты/gen_taxi.py (зерно 2024), руками не править.\n"
            "   Грузится по требованию: Lazy.taxi() в app.js. Свой объект, а не\n"
            "   window.DATA: data.js, пришедший позже, затёр бы такси. */\n"
            "window.TAXI = {\n"
            "  sql: `%s`,\n"
            "  ridersCSV: `%s`,\n"
            "  driversCSV: `%s`,\n"
            "  tripsCSV: `%s`\n"
            "};\n") % (DDL, rc, dc, tc)


def report(trips):
    from collections import Counter
    st = Counter(t["status"] for t in trips)
    print("заказов", len(trips), dict(st))
    for city, _ in CITIES:
        for half, cond in (("янв–мар", lambda m: m <= 3), ("апр–июн", lambda m: m >= 4)):
            sub = [t for t in trips if t["city"] == city and cond(t["requested_at"].month)]
            nd = sum(t["status"] == "no_driver" for t in sub)
            done = [t for t in sub if t["status"] == "completed"]
            w = sum((t["pickup_at"] - t["requested_at"]).seconds / 60 for t in done) / max(1, len(done))
            print("  %-13s %s: заказов %4d, no_driver %4.1f%%, подача %.1f мин"
                  % (city, half, len(sub), 100 * nd / max(1, len(sub)), w))
    for h0, h1 in ((8, 9), (12, 15), (18, 20), (0, 5)):
        sub = [t for t in trips if h0 <= t["requested_at"].hour <= h1]
        print("  часы %02d–%02d: заказов %4d, поездок %.1f%%, наценка %.1f%%" % (
            h0, h1, len(sub), 100 * sum(t["status"] == "completed" for t in sub) / len(sub),
            100 * sum(t["surge"] > 1 for t in sub) / len(sub)))


if __name__ == "__main__":
    riders, drivers, trips = build()
    text = render(riders, drivers, trips)
    if "--check" in sys.argv:
        if not OUT.exists() or OUT.read_text(encoding="utf-8") != text:
            sys.exit("data-taxi.js устарел: python3 инструменты/gen_taxi.py")
        print("data-taxi.js совпадает с генератором")
    else:
        report(trips)
        OUT.write_text(text, encoding="utf-8")
        print("Готово: %s — %.0f КБ" % (OUT.name, OUT.stat().st_size / 1024))
