# Служебные скрипты курса

В сборку `Тетрадь аналитика.html` не входят. Нужны, чтобы проверять
числа в уроках и пересобирать данные.

| Файл | Зачем |
|---|---|
| `gen_app.py` | Генератор журнала приложения для модуля 4 (4000 установок, 28 567 дней активности, 2027 заказов). Печатает контрольные срезы: удержание по когортам, доли каналов, деньги. |
| `emit_app.py` | Выгружает результат генератора в три CSV. Их содержимое вставлено в `data.js` как `appUsersCSV`, `appActivityCSV`, `appOrdersCSV`. |
| `balance_quiz.py` | Перемешивает варианты ответов в квизах и раскладывает верный по позициям равномерно. Запуск: `python3 balance_quiz.py ../content-m5.js`. |
| `mkdb.py` | Собирает `shop.db` из `data.js` — база для локальной проверки SQL-задач. |
| `appprelude.py` | Пролог python-уроков модуля 4 для локального прогона: читает CSV прямо из `data.js`. |
| `runpy.js` | Достаёт из урока решение, эталон или код тренажёра. `node runpy.js m4l4 expected`. |
| `checksql.js`, `drillsql.js` | То же для SQL-уроков и их тренажёров. |

## Порядок проверки урока

    python3 инструменты/mkdb.py                       # если менялись данные
    node инструменты/runpy.js m4l4 > /tmp/sol.py
    cat инструменты/appprelude.py /tmp/sol.py | python3 -   # сверить с эталоном

После записи текста в `content-*.js` — проверка на посторонние символы:

    python3 -c "import pathlib,sys; s=pathlib.Path(sys.argv[1]).read_text(encoding='utf-8'); print(sorted({c for c in s if 0x2E00 < ord(c) < 0xFF00}))" content-m5.js
