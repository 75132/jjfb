# -*- coding: utf-8 -*-
"""在 RPGMV.exe 里定位「图块调色板页签」的真身 —— 判断页签是硬编码还是遍历 tilesetNames。

只读。不修改任何文件。
"""
import os
import re
import sys

EXE = r"D:\Program Files (x86)\KADOKAWA\RPGMV\RPGMV.exe"

if not os.path.exists(EXE):
    print("EXE not found:", EXE)
    sys.exit(1)

D = open(EXE, "rb").read()
print("exe size = %d bytes" % len(D))
print()


def show(title, kw, before=350, after=900, limit=2, enc="latin1"):
    b = kw.encode(enc)
    i = 0
    n = 0
    hits = []
    while n < limit:
        i = D.find(b, i)
        if i < 0:
            break
        hits.append(i)
        i += 1
        n += 1
    print("=" * 74)
    print("### %s   [%s]  命中 %d" % (title, kw, len(hits)))
    for h in hits:
        seg = D[max(0, h - before): h + after]
        txt = "".join(
            chr(c) if 32 <= c < 127 or c in (10, 13, 9) else "." for c in seg
        )
        print("--- @0x%X ---" % h)
        print(txt)
        print()


print("#" * 74)
print("# PART 1  页签模型：maxPages / pageIndex 附近")
print("#" * 74)
show("maxPages", "maxPages", limit=3)
show("pageIndex", "pageIndex", limit=2)

print("#" * 74)
print("# PART 2  页签标签本身是否硬编码")
print("#" * 74)
for k in ['"A1"', '"A2"', '"A3"', '"A4"', '"A5"', '"B"', '"C"', '"D"', '"E"']:
    n = D.count(k.encode())
    print("  %-6s count = %d" % (k, n))
print()
show("tilesetNames", "tilesetNames", limit=3)

print("#" * 74)
print("# PART 3  QML 侧：是否用 Repeater/model 动态生成")
print("#" * 74)
for k in ["Repeater", "model:", "import QtQuick", "TabBar", "TabButton"]:
    print("  %-16s count = %d" % (k, D.count(k.encode())))
print()
show("Repeater", "Repeater", before=500, after=700, limit=2)
show("TilePaletteBody", "TilePaletteBody", before=200, after=1200, limit=2)
