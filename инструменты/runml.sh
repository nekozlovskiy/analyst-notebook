#!/bin/sh
# Прогоняет решение python-урока модуля 5 локально и печатает вывод.
# Использование: sh инструменты/runml.sh m5l1 [drill N]
cd "$(dirname "$0")/.."
sh инструменты/mlprelude.sh > /tmp/_ml.py
node инструменты/runpy.js "$@" > /tmp/_sol.py
cat /tmp/_ml.py /tmp/_sol.py | python3 -
