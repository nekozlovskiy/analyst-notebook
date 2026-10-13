#!/usr/bin/env python3
"""Собирает delta-market.xlsx для урока 6.5 из data.js.

    python3 инструменты/mkxlsx.py           # записать файл в корень сайта
    python3 инструменты/mkxlsx.py --check   # сверить с файлом в ветке

Листы orders, users — как в базе (даты — датами Excel, суммы — числами),
leads — сырые строки выгрузки CRM, для задач на чистку. Сверка идёт по
распакованному содержимому листов, а не по байтам: zlib на разных
системах сжимает по-разному.
"""
import csv, datetime, io, pathlib, re, sys, zipfile
from openpyxl import Workbook
from openpyxl.styles import Font

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "delta-market.xlsx"
STAMP = datetime.datetime(2024, 9, 30)
SRC = (ROOT / "data.js").read_text(encoding="utf-8")


def rows(key):
    body = re.search(r"\n  %s: `(.*?)`" % key, SRC, re.S).group(1)
    return [r for r in csv.reader(io.StringIO(body)) if r]


def day(s):
    return datetime.datetime.strptime(s, "%Y-%m-%d")


def build():
    wb = Workbook()
    wb.properties.creator = "Тетрадь аналитика"
    wb.properties.created = wb.properties.modified = STAMP
    sheets = (
        ("orders", rows("ordersCSV"), (int, int, day, float, str)),
        ("users", rows("usersCSV"), (int, day, str, str, str)),
        ("leads", rows("leadsCSV"), None),   # как есть: текст, пустые — пустые
    )
    wb.remove(wb.active)
    for name, data, cast in sheets:
        ws = wb.create_sheet(name)
        ws.append(data[0])
        for c in ws[1]:
            c.font = Font(bold=True)
        for r in data[1:]:
            ws.append([f(v) for f, v in zip(cast, r)] if cast else [v if v != "" else None for v in r])
        for col, fmt in ((3, "yyyy-mm-dd"), (4, "0.00")) if name == "orders" else ((2, "yyyy-mm-dd"),) if name == "users" else ():
            for (c,) in ws.iter_rows(min_row=2, min_col=col, max_col=col):
                c.number_format = fmt
        ws.freeze_panes = "A2"
        ws.auto_filter.ref = ws.dimensions
    raw = io.BytesIO()
    wb.save(raw)
    # одинаковые даты у файлов внутри zip — иначе каждая сборка «новая»
    out = io.BytesIO()
    with zipfile.ZipFile(raw) as src, zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as dst:
        for info in src.infolist():
            z = zipfile.ZipInfo(info.filename, date_time=STAMP.timetuple()[:6])
            z.compress_type = zipfile.ZIP_DEFLATED
            data = src.read(info.filename)
            if info.filename == "docProps/core.xml":
                # openpyxl при сохранении ставит modified = сейчас — возвращаем STAMP
                data = re.sub(rb"(<dcterms:modified[^>]*>)[^<]*", rb"\g<1>" + STAMP.strftime("%Y-%m-%dT%H:%M:%SZ").encode(), data)
            dst.writestr(z, data)
    return out.getvalue()


def parts(blob):
    with zipfile.ZipFile(io.BytesIO(blob)) as z:
        return {n: z.read(n) for n in z.namelist()}


if __name__ == "__main__":
    blob = build()
    if "--check" in sys.argv:
        if not OUT.exists() or parts(OUT.read_bytes()) != parts(blob):
            sys.exit("delta-market.xlsx устарел: python3 инструменты/mkxlsx.py")
        print("delta-market.xlsx совпадает с data.js")
    else:
        OUT.write_bytes(blob)
        print("Готово: %s — %.0f КБ" % (OUT.name, OUT.stat().st_size / 1024))
