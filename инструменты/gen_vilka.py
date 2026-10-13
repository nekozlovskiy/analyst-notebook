#!/usr/bin/env python3
"""Генератор базы «Вилка» (доставка еды) для модуля 7 «Финальный проект».

    python3 инструменты/gen_vilka.py            # контрольные числа + data-vilka.js
    python3 инструменты/gen_vilka.py --check    # только сверить data-vilka.js

Детерминированный: одно зерно, только random.Random — тот же код даёт
побайтно тот же data-vilka.js. Сюжет: в мае 2025 четыре недели шёл
эксперимент «бесплатная доставка от 1500 ₽». У test чаще заказывают и
добирают корзину до порога, но «Вилка» теряет плату за доставку.
Ловушки выгрузки: дубли строк заказов, внутренние тестовые аккаунты
(platform = internal), отменённые заказы.
"""
import datetime as dt
import pathlib
import random
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "data-vilka.js"
R = random.Random(2025)

START, END = dt.date(2025, 1, 1), dt.date(2025, 7, 1)
EXP_START, EXP_END = dt.date(2025, 5, 5), dt.date(2025, 6, 2)    # 4 недели, пн–пн
N_CUST, N_INTERNAL, N_REST = 7000, 30, 150
CITIES = [("Москва", 0.45), ("Санкт-Петербург", 0.25), ("Казань", 0.15), ("Новосибирск", 0.15)]
PLATFORMS = [("android", 0.45), ("ios", 0.38), ("web", 0.17)]
CHANNELS = [("organic", 0.36), ("paid_search", 0.24), ("social", 0.18), ("referral", 0.12), ("promo", 0.10)]
CUISINES = [("пицца", 0.2), ("суши", 0.2), ("бургеры", 0.15), ("грузинская", 0.1),
            ("азиатская", 0.15), ("здоровая", 0.1), ("пекарня", 0.1)]
THRESHOLD = 1500
FEE_LOW, FEE_HIGH = 249, 149          # до порога / от порога — обычный тариф
CANCEL = 0.06
DUP = 0.01


def pick(pairs):
    x, acc = R.random(), 0.0
    for v, w in pairs:
        acc += w
        if x < acc:
            return v
    return pairs[-1][0]


def rday(a, b):
    return a + dt.timedelta(days=R.randrange((b - a).days))


def basket():
    s = int(R.lognormvariate(7.05, 0.42) / 10) * 10
    return max(290, min(s, 9990))


def build():
    rests = []
    for i in range(N_REST):
        rests.append((101 + i, pick(CITIES), pick(CUISINES)))
    by_city = {}
    for r in rests:
        by_city.setdefault(r[1], []).append(r[0])

    custs = []
    for i in range(N_CUST):
        # регистрации растут к лету
        d = START + dt.timedelta(days=int((R.random() ** 0.8) * 150))
        custs.append({"id": 10001 + i, "signup": d, "city": pick(CITIES), "platform": pick(PLATFORMS),
                      "channel": pick(CHANNELS), "rate": R.lognormvariate(-3.65, 0.9)})
    for i in range(N_INTERNAL):
        custs.append({"id": 90001 + i, "signup": START + dt.timedelta(days=R.randrange(20)),
                      "city": "Москва", "platform": "internal", "channel": "organic", "rate": 0.5})

    # эксперимент: активные до мая клиенты, назначение в первую неделю
    exp = {}
    pool = [c for c in custs if c["signup"] < EXP_START]
    for c in pool:
        if c["platform"] == "internal" or R.random() < 0.82:
            exp[c["id"]] = ("test" if R.random() < 0.5 else "control",
                            EXP_START + dt.timedelta(days=R.randrange(7)))

    orders, oid = [], 500001
    d = START
    while d < END:
        in_exp = EXP_START <= d < EXP_END
        for c in custs:
            if d < c["signup"]:
                continue
            p = c["rate"]
            g = exp.get(c["id"])
            test = in_exp and g and g[0] == "test" and d >= g[1]
            if test:
                p *= 1.20
            if R.random() >= p:
                continue
            n = 1 if c["platform"] != "internal" else R.choice([1, 1, 2, 3])
            for _ in range(n):
                s = basket() if c["platform"] != "internal" else R.choice([100, 150, 200])
                if test and 1100 <= s < THRESHOLD and R.random() < 0.45:
                    s = THRESHOLD + 10 * R.randrange(0, 25)
                fee = FEE_LOW if s < THRESHOLD else FEE_HIGH
                if test and s >= THRESHOLD:
                    fee = 0
                rest = R.choice(by_city[c["city"]] if c["city"] in by_city else by_city["Москва"])
                t = dt.datetime.combine(d, dt.time(R.choice([9, 11, 12, 13, 14, 18, 19, 19, 20, 20, 21, 22]),
                                                   R.randrange(60)))
                st = "cancelled" if R.random() < CANCEL else "delivered"
                orders.append((oid, c["id"], rest, t, s, fee, st))
                oid += 1
        d += dt.timedelta(days=1)

    out = []
    for o in orders:
        out.append(o)
        if R.random() < DUP:
            out.append(o)
    return custs, rests, out, exp


def report(custs, rests, orders, exp):
    from collections import Counter
    plat = {c["id"]: c["platform"] for c in custs}
    print("клиентов", len(custs), "ресторанов", len(rests), "строк заказов", len(orders),
          "уникальных", len({o[0] for o in orders}), "в эксперименте", len(exp))
    clean = {o[0]: o for o in orders if plat[o[1]] != "internal"}.values()
    dl = [o for o in clean if o[6] == "delivered"]
    print("чистых заказов", len(clean), "доставлено", len(dl),
          "GMV", sum(o[4] for o in dl), "плата за доставку", sum(o[5] for o in dl),
          "internal заказов", sum(plat[o[1]] == "internal" for o in {o[0]: o for o in orders}.values()))
    g = Counter(v[0] for k, v in exp.items() if plat[k] != "internal")
    print("группы без internal", dict(g))
    for grp in ("control", "test"):
        ids = {k for k, v in exp.items() if v[0] == grp and plat[k] != "internal"}
        eo = [o for o in dl if o[1] in ids and EXP_START <= o[3].date() < EXP_END and o[3].date() >= exp[o[1]][1]]
        buyers = {o[1] for o in eo}
        gmv, fee = sum(o[4] for o in eo), sum(o[5] for o in eo)
        rev = 0.2 * gmv + fee
        print("  %-7s польз %d конв %.2f%% заказов %d чек %.1f выручка Вилки %.0f на польз %.2f доля>=1500 %.1f%%" % (
            grp, len(ids), 100 * len(buyers) / len(ids), len(eo), gmv / len(eo), rev, rev / len(ids),
            100 * sum(o[4] >= THRESHOLD for o in eo) / len(eo)))


def day(d):
    return d.strftime("%Y-%m-%d")


def render(custs, rests, orders, exp):
    c = ["customer_id,signup_date,city,platform,channel"] + \
        ["%d,%s,%s,%s,%s" % (x["id"], day(x["signup"]), x["city"], x["platform"], x["channel"]) for x in custs]
    r = ["restaurant_id,city,cuisine"] + ["%d,%s,%s" % x for x in rests]
    o = ["order_id,customer_id,restaurant_id,created_at,items_sum,delivery_fee,status"] + \
        ["%d,%d,%d,%s,%d,%d,%s" % (a, b, rr, t.strftime("%Y-%m-%d %H:%M"), s, f, st)
         for a, b, rr, t, s, f, st in orders]
    e = ["customer_id,group,assigned_at"] + \
        ["%d,%s,%s" % (k, v[0], day(v[1])) for k, v in sorted(exp.items())]
    return ("/* База «Вилка» (доставка еды) для модуля 7 «Финальный проект».\n"
            "   Собрана инструменты/gen_vilka.py (зерно 2025), руками не править.\n"
            "   Сайт этот файл не грузит: из него собираются vilka.xlsx (mkxlsx.py)\n"
            "   и инструменты/vilka.db (mkdb.py) для проверок. */\n"
            "window.VILKA = {\n"
            "  customersCSV: `%s`,\n"
            "  restaurantsCSV: `%s`,\n"
            "  ordersCSV: `%s`,\n"
            "  experimentCSV: `%s`\n"
            "};\n") % ("\n".join(c), "\n".join(r), "\n".join(o), "\n".join(e))


if __name__ == "__main__":
    custs, rests, orders, exp = build()
    text = render(custs, rests, orders, exp)
    if "--check" in sys.argv:
        if not OUT.exists() or OUT.read_text(encoding="utf-8") != text:
            sys.exit("data-vilka.js устарел: python3 инструменты/gen_vilka.py")
        print("data-vilka.js совпадает с генератором")
    else:
        report(custs, rests, orders, exp)
        if "--dry" not in sys.argv:
            OUT.write_text(text, encoding="utf-8")
            print("Готово: %s — %.0f КБ" % (OUT.name, OUT.stat().st_size / 1024))
