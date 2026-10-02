#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Локальный сервер для разработки курса.

То же, что python3 -m http.server, но запрещает браузеру кэшировать
файлы. Модули уроков подгружаются скриптом по требованию, без меток
версии в адресе, — с обычным сервером браузер показывает старую копию
после правки. Здесь правка видна сразу после перезагрузки страницы.

Именно перезагрузки: переход на тот же index.html с другим #хэшем
документ не перезагружает, и в памяти остаются прежние app.js и уроки.
Поэтому сервер ещё отдаёт /__mtime — время последней правки файлов сайта
в миллисекундах. Проверка в браузере сравнивает его с
performance.timeOrigin и перезагружает страницу, если она старше правок
(.claude/skills/new-practicum/scripts/browser-check.js).

Запуск из корня проекта:  python3 инструменты/devserver.py 8779
Чистый прогресс ученика — другой origin: второй сервер на свободном порту.
"""
import functools
import http.server
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = (".js", ".css", ".html", ".webmanifest")
BUILT = "Тетрадь аналитика.html"     # офлайн-сборка, страница её не грузит


def site_mtime():
    """Время последней правки файлов сайта в корне, мс."""
    return max(int(p.stat().st_mtime * 1000) for p in ROOT.iterdir()
               if p.is_file() and p.suffix in SITE and p.name != BUILT)


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        if self.path.split("?")[0] == "/__mtime":
            body = json.dumps({"mtime": site_mtime()}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8779
handler = functools.partial(NoCache, directory=str(ROOT))
print("Курс: http://localhost:%d  (без кэша)" % port)
http.server.ThreadingHTTPServer(("127.0.0.1", port), handler).serve_forever()
