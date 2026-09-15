#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Локальный сервер для разработки курса.

То же, что python3 -m http.server, но запрещает браузеру кэшировать
файлы. Модули уроков подгружаются скриптом по требованию, без меток
версии в адресе, — с обычным сервером браузер показывает старую копию
после правки. Здесь правка видна сразу после перезагрузки страницы.

Запуск из корня проекта:  python3 инструменты/devserver.py 8779
"""
import functools
import http.server
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8779
handler = functools.partial(NoCache, directory=str(ROOT))
print("Курс: http://localhost:%d  (без кэша)" % port)
http.server.ThreadingHTTPServer(("127.0.0.1", port), handler).serve_forever()
