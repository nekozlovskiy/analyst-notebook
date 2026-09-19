#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Собирает весь курс в один самодостаточный html-файл.

Запуск:  python3 build.py
Результат: «Тетрадь аналитика.html» — этот файл можно отправлять.

Редактировать надо исходники (index.html, styles.css, lessons.js,
content-*.js, data.js, app.js), а потом пересобирать. Править собранный
файл руками не нужно.

Работы без интернета это не касается: sw.js и манифест нужны сайту,
а файл с диска и так открывается без сети.

На сайте модули уроков и учебная база подгружаются по мере надобности,
а в собранный файл кладутся заранее: у файла, открытого с диска, рядом
нет других файлов, которые можно было бы подгрузить.
"""
import base64
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).parent
OUT = HERE / "Тетрадь аналитика.html"


def read(name):
    p = HERE / name
    if not p.exists():
        sys.exit("Не найден файл: " + name)
    return p.read_text(encoding="utf-8")


def data_uri(name, mime):
    p = HERE / name
    if not p.exists():
        sys.exit("Не найден файл: " + name)
    return "data:%s;base64,%s" % (mime, base64.b64encode(p.read_bytes()).decode())


def swap(html, old, new):
    if html.count(old) != 1:
        sys.exit("В index.html нет ровно одного вхождения: " + old)
    return html.replace(old, new)


def drop(html, old):
    return swap(html, old, "")


html = read("index.html")

# Манифест нужен сайту: он делает курс приложением, которое можно
# поставить на телефон. У файла, открытого с диска, рядом манифеста
# нет, а обслуживающий скрипт app.js в собранном файле не ищет сам —
# там и так всё внутри страницы.
html = drop(html, '<link rel="manifest" href="manifest.webmanifest">\n')

# подключены в index.html и встраиваются на своё место
EAGER = ("lessons.js", "content-core.js", "glossary.js", "app.js")
# на сайте грузятся по требованию — в файл кладём заранее, перед app.js
LAZY = ("content-m0.js", "content-m1.js", "content-m2.js", "content-m3.js",
        "content-m4.js", "content-m5.js", "content-m6.js", "data.js")

# закрывающий тег внутри скрипта разорвал бы страницу — проверяем заранее
for name in ("styles.css",) + EAGER + LAZY:
    if "</script" in read(name).lower():
        sys.exit("В файле %s есть </script — встраивание сломает страницу." % name)

html = swap(html, '<link rel="stylesheet" href="styles.css">',
            "<style>\n" + read("styles.css") + "\n</style>")

for name in ("lessons.js", "content-core.js", "glossary.js"):
    html = swap(html, '<script src="%s"></script>' % name,
                "<script>\n" + read(name) + "\n</script>")

lazy = "".join("<script>\n" + read(n) + "\n</script>\n" for n in LAZY)
html = swap(html, '<script src="app.js"></script>',
            lazy + "<script>\n" + read("app.js") + "\n</script>")

# иконки — внутрь: рядом с файлом их не будет
html = swap(html, 'href="favicon.svg"', 'href="%s"' % data_uri("favicon.svg", "image/svg+xml"))
html = swap(html, 'href="apple-touch-icon.png"', 'href="%s"' % data_uri("apple-touch-icon.png", "image/png"))

left = re.findall(r'<script[^>]+\bsrc="(?!https)([^"]+)"', html)
if left:
    sys.exit("Не встроились локальные файлы: " + ", ".join(left))

html = html.replace(
    "<title>",
    "<!-- Собрано автоматически из index.html, styles.css и скриптов курса.\n"
    "     Правьте исходники и запускайте build.py. -->\n<title>", 1)

OUT.write_text(html, encoding="utf-8")
print("Готово: %s — %.0f КБ" % (OUT.name, OUT.stat().st_size / 1024))
print("Внутри: шрифты, редактор кода, Python и SQLite подтягиваются из интернета при первом запуске.")
