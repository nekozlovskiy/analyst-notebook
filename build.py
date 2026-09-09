#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Собирает весь курс в один самодостаточный html-файл.

Запуск:  python3 build.py
Результат: «Тетрадь аналитика.html» — этот файл можно отправлять.

Редактировать надо исходники (lessons.js, content.js, styles.css, app.js),
а потом пересобирать. Править собранный файл руками не нужно.
"""
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

html = read("index.html")

# закрывающий тег внутри скрипта разорвал бы страницу — проверяем заранее
SRC = ("lessons.js", "content-core.js", "content-m1.js", "content-m2.js", "content-m3.js",
          "content-m4.js", "content-m5.js", "content-m6.js", "data.js", "app.js")

for name in ("styles.css",) + SRC:
    if "</script" in read(name).lower():
        sys.exit("В файле %s есть </script — инлайн сломает страницу." % name)

# стили внутрь
html = html.replace(
    '<link rel="stylesheet" href="styles.css">',
    "<style>\n" + read("styles.css") + "\n</style>")

# скрипты внутрь, в том же порядке
for name in SRC:
    html = html.replace(
        '<script src="%s"></script>' % name,
        "<script>\n" + read(name) + "\n</script>")

left = re.findall(r'<script[^>]+\bsrc="(?!https)([^"]+)"', html)
if left:
    sys.exit("Не заинлайнились локальные файлы: " + ", ".join(left))

html = html.replace(
    "<title>",
    "<!-- Собрано автоматически из index.html, styles.css, lessons.js,\n"
    "     content.js, data.js, app.js. Правьте исходники и запускайте build.py. -->\n<title>")

OUT.write_text(html, encoding="utf-8")
print("Готово: %s — %.0f КБ" % (OUT.name, OUT.stat().st_size / 1024))
print("Внутри: шрифты, редактор кода, Python и SQLite подтягиваются из интернета при первом запуске.")
