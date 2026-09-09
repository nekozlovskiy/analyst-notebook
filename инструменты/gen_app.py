# -*- coding: utf-8 -*-
"""Генератор журнала мобильного приложения «Дельта Маркет» для модуля 4.

Работает офлайн, результат кладётся в data.js текстом, поэтому
детерминизм в браузере обеспечен самим фактом фиксации данных.
"""
import datetime
import math
import random

START = datetime.date(2024, 1, 1)
END = datetime.date(2024, 9, 30)
HORIZON = (END - START).days          # 273
LAST_SIGNUP = 181                     # 2024-06-30

rnd = random.Random(20240115)

# Состав трафика меняется по месяцам: с апреля маркетинг резко
# наращивает платную закупку. Внутри каналов ничего не меняется —
# падение сводного удержания будет чистым эффектом микса.
MIX = {
    1: {"organic": 37, "referral": 17, "email": 15, "partner": 10,
        "paid_search": 14, "social": 7},
    2: {"organic": 36, "referral": 16, "email": 15, "partner": 10,
        "paid_search": 15, "social": 8},
    3: {"organic": 34, "referral": 15, "email": 14, "partner": 11,
        "paid_search": 17, "social": 9},
    4: {"organic": 22, "referral": 10, "email": 11, "partner": 11,
        "paid_search": 28, "social": 18},
    5: {"organic": 17, "referral": 8, "email": 9, "partner": 10,
        "paid_search": 33, "social": 23},
    6: {"organic": 15, "referral": 7, "email": 8, "partner": 10,
        "paid_search": 35, "social": 25},
}
CHANNEL_BAGS = {m: sum(([k] * v for k, v in sorted(w.items())), [])
                for m, w in MIX.items()}
PLATFORMS = ["android"] * 47 + ["ios"] * 38 + ["web"] * 15
CITIES = (["Москва"] * 31 + ["Санкт-Петербург"] * 17 + ["Новосибирск"] * 13
          + ["Екатеринбург"] * 12 + ["Казань"] * 10 + ["Нижний Новгород"] * 9
          + ["Ростов-на-Дону"] * 8)

# доля «однодневок» и характерное время жизни в днях
QUALITY = {
    "organic":     (0.30, 34),
    "referral":    (0.27, 38),
    "email":       (0.35, 27),
    "partner":     (0.44, 19),
    "paid_search": (0.50, 15),
    "social":      (0.56, 12),
}

FREQ = [0.10, 0.16, 0.24, 0.34, 0.48, 0.66]
PRICES = [390, 590, 790, 990, 1290, 1590, 1990, 2490, 2990,
          3490, 4290, 5490, 6990, 9900]
ORDER_RATE = [0.02, 0.04, 0.07, 0.12, 0.20]


def signup_weights():
    """Регистрации растут с января по июнь, в выходные меньше."""
    w = []
    for d in range(LAST_SIGNUP + 1):
        day = START + datetime.timedelta(days=d)
        base = 1.0 + 0.55 * d / LAST_SIGNUP
        if day.weekday() >= 5:
            base *= 0.72
        if day.month == 1 and day.day <= 8:
            base *= 0.62          # новогодние праздники
        w.append(base)
    return w


def build():
    weights = signup_weights()
    days = list(range(LAST_SIGNUP + 1))
    users, activity, orders = [], [], []

    signups = rnd.choices(days, weights=weights, k=4000)
    signups.sort()

    for i, s in enumerate(signups):
        uid = 1001 + i
        month = (START + datetime.timedelta(days=s)).month
        ch = rnd.choice(CHANNEL_BAGS[month])
        users.append((uid, s, ch, rnd.choice(PLATFORMS), rnd.choice(CITIES)))

        q, tau = QUALITY[ch]
        activity.append((uid, s))                     # день установки

        if rnd.random() < q:
            continue                                  # больше не вернулся

        life = int(-tau * math.log(1 - rnd.random())) + 1
        freq = rnd.choice(FREQ)
        orate = rnd.choice(ORDER_RATE)
        limit = min(life, HORIZON - s)

        for d in range(1, limit + 1):
            p = freq * (1 + 2.2 * math.exp(-d / 3.5))
            if p > 0.92:
                p = 0.92
            if rnd.random() >= p:
                continue
            activity.append((uid, s + d))
            # покупают чаще после того, как освоились
            po = orate * (0.45 if d < 3 else 1.0)
            if rnd.random() < po:
                n = 1 if rnd.random() < 0.82 else 2
                rev = sum(rnd.choice(PRICES) for _ in range(n))
                orders.append((uid, s + d, rev))

    return users, activity, orders


users, activity, orders = build()
activity.sort()
orders.sort()
print("пользователей", len(users))
print("строк активности", len(activity))
print("заказов", len(orders), "выручка", sum(o[2] for o in orders))

# --- проверка кривой удержания ---
act = {}
for uid, d in activity:
    act.setdefault(uid, set()).add(d)
sign = {u[0]: u[1] for u in users}
chan = {u[0]: u[2] for u in users}


def retention(day, subset=None):
    num = den = 0
    for uid, s in sign.items():
        if subset and chan[uid] != subset:
            continue
        if s + day > HORIZON:
            continue
        den += 1
        if s + day in act[uid]:
            num += 1
    return num, den, (num / den * 100 if den else 0)


print("\nклассическое удержание (активен ровно в день N):")
for d in (1, 3, 7, 14, 30, 60, 90):
    n, m, p = retention(d)
    print("  D%-3d %5d/%-5d %5.1f%%" % (d, n, m, p))

print("\nпо каналам, D7 и D30:")
for c in ["organic", "referral", "email", "partner", "paid_search", "social"]:
    _, _, p7 = retention(7, c)
    _, _, p30 = retention(30, c)
    print("  %-12s D7=%5.1f%%  D30=%5.1f%%" % (c, p7, p30))


def week_ret(week, subset=None):
    """Активен хотя бы раз в неделю N после установки."""
    lo, hi = week * 7, week * 7 + 6
    num = den = 0
    for uid, s in sign.items():
        if subset and chan[uid] != subset:
            continue
        if s + hi > HORIZON:
            continue
        den += 1
        if any(s + d in act[uid] for d in range(lo, hi + 1)):
            num += 1
    return num, den, (num / den * 100 if den else 0)


print("\nнедельное удержание (хотя бы раз за неделю N):")
for w in range(0, 9):
    n, m, p = week_ret(w)
    print("  W%-2d %5d/%-5d %5.1f%%" % (w, n, m, p))

print("\nразмер месячных когорт:")
from collections import Counter
coh = Counter((START + datetime.timedelta(days=s)).strftime("%Y-%m")
              for s in sign.values())
for k in sorted(coh):
    print("  %s  %4d" % (k, coh[k]))

print("\nкогорта x неделя (доля активных, %):")
print("           " + "".join("  W%-4d" % w for w in range(0, 8)))
for k in sorted(coh):
    row = "  %s " % k
    for w in range(0, 8):
        lo, hi = w * 7, w * 7 + 6
        num = den = 0
        for uid, s in sign.items():
            if (START + datetime.timedelta(days=s)).strftime("%Y-%m") != k:
                continue
            if s + hi > HORIZON:
                continue
            den += 1
            if any(s + d in act[uid] for d in range(lo, hi + 1)):
                num += 1
        row += "%6.1f " % (num / den * 100) if den else "     . "
    print(row)


print("\nW4 внутри канала по когортам (доля, %):")
months = sorted(coh)
print("            " + "".join("%9s" % m for m in months))
for c in ["organic", "referral", "email", "partner", "paid_search", "social"]:
    row = "  %-11s" % c
    for k in months:
        num = den = 0
        for uid, s in sign.items():
            if chan[uid] != c:
                continue
            if (START + datetime.timedelta(days=s)).strftime("%Y-%m") != k:
                continue
            if s + 34 > HORIZON:
                continue
            den += 1
            if any(s + d in act[uid] for d in range(28, 35)):
                num += 1
        row += "%9s" % (("%.1f" % (num / den * 100)) if den >= 30 else "·")
    print(row)

print("\nдоля каналов по когортам (%):")
print("            " + "".join("%9s" % m for m in months))
for c in ["organic", "referral", "email", "partner", "paid_search", "social"]:
    row = "  %-11s" % c
    for k in months:
        tot = sum(1 for uid, s in sign.items()
                  if (START + datetime.timedelta(days=s)).strftime("%Y-%m") == k)
        n = sum(1 for uid, s in sign.items()
                if chan[uid] == c
                and (START + datetime.timedelta(days=s)).strftime("%Y-%m") == k)
        row += "%9.1f" % (n / tot * 100)
    print(row)

print("\nденьги:")
ord_by_user = {}
for uid, d, r in orders:
    ord_by_user.setdefault(uid, []).append(r)
print("  заказов", len(orders), "покупателей", len(ord_by_user),
      "конверсия в покупку %.1f%%" % (len(ord_by_user) / len(sign) * 100))
print("  средний чек %.0f" % (sum(o[2] for o in orders) / len(orders)))
print("  ARPU %.0f  ARPPU %.0f" % (sum(o[2] for o in orders) / len(sign),
                                   sum(o[2] for o in orders) / len(ord_by_user)))
for k in months:
    us = [u for u, s in sign.items()
          if (START + datetime.timedelta(days=s)).strftime("%Y-%m") == k]
    rev = sum(sum(ord_by_user.get(u, [])) for u in us)
    buyers = sum(1 for u in us if u in ord_by_user)
    print("  %s  n=%3d  ARPU=%6.0f  покупателей=%5.1f%%"
          % (k, len(us), rev / len(us), buyers / len(us) * 100))
