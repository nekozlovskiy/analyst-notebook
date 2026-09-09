# -*- coding: utf-8 -*-
"""Перемешивает варианты ответов в квизах content-m*.js.

Правильный ответ раскладывается по позициям равномерно (round-robin),
дистракторы тасуются детерминированным генератором. Форматирование
массива opts сохраняется: однострочный остаётся однострочным.
"""
import pathlib
import random
import re
import sys


def find_array(text, start):
    """Возвращает (i_open, i_close) для массива, начинающегося на start."""
    i = text.index("[", start)
    depth = 0
    j = i
    in_str = False
    quote = ""
    while j < len(text):
        ch = text[j]
        if in_str:
            if ch == "\\":
                j += 2
                continue
            if ch == quote:
                in_str = False
        else:
            if ch in "\"'`":
                in_str = True
                quote = ch
            elif ch in "[{(":
                depth += 1
            elif ch in "]})":
                depth -= 1
                if depth == 0:
                    return i, j
        j += 1
    raise ValueError("незакрытый массив")


def split_items(inner):
    """Делит содержимое массива на элементы по запятым верхнего уровня."""
    items, buf, depth, in_str, quote = [], [], 0, False, ""
    j = 0
    while j < len(inner):
        ch = inner[j]
        if in_str:
            buf.append(ch)
            if ch == "\\":
                buf.append(inner[j + 1])
                j += 2
                continue
            if ch == quote:
                in_str = False
        elif ch in "\"'`":
            in_str = True
            quote = ch
            buf.append(ch)
        elif ch in "[{(":
            depth += 1
            buf.append(ch)
        elif ch in "]})":
            depth -= 1
            buf.append(ch)
        elif ch == "," and depth == 0:
            items.append("".join(buf).strip())
            buf = []
        else:
            buf.append(ch)
        j += 1
    tail = "".join(buf).strip()
    if tail:
        items.append(tail)
    return items


def process(path, counter):
    text = pathlib.Path(path).read_text(encoding="utf-8")
    rnd = random.Random(sum(ord(c) for c in pathlib.Path(path).name) * 7919)
    out = []
    pos = 0
    changed = 0
    for m in re.finditer(r"\bopts:\s*", text):
        if m.start() < pos:
            continue
        i, j = find_array(text, m.end() - 1)
        inner = text[i + 1:j]
        items = split_items(inner)
        # следом должен идти right: N
        tail = text[j:j + 200]
        rm = re.search(r"\bright:\s*(\d+)", tail)
        if not rm:
            continue
        right = int(rm.group(1))
        k = len(items)
        target = counter[k] % k
        counter[k] += 1

        correct = items[right]
        others = [x for n, x in enumerate(items) if n != right]
        rnd.shuffle(others)
        new_items = others[:target] + [correct] + others[target:]

        multiline = "\n" in inner
        if multiline:
            indent = re.match(r"\n(\s*)", inner).group(1)
            close_indent = indent[:-2] if len(indent) >= 2 else indent
            body = "\n" + (",\n").join(indent + x for x in new_items) + "\n" + close_indent
        else:
            body = ", ".join(new_items)

        out.append(text[pos:i + 1])
        out.append(body)
        out.append(text[j:j + rm.start()])
        out.append("right: %d" % target)
        pos = j + rm.end()
        changed += 1
    out.append(text[pos:])
    pathlib.Path(path).write_text("".join(out), encoding="utf-8")
    return changed


if __name__ == "__main__":
    counter = {}
    for k in range(2, 8):
        counter[k] = 0
    total = 0
    for p in sys.argv[1:]:
        n = process(p, counter)
        print("%s: %d вопросов" % (p, n))
        total += n
    print("всего:", total)
