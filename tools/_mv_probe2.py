# -*- coding: utf-8 -*-
"""补充取证：页签 UI 组件 & 常量数组。只读。"""
import os

EXE = r"D:\Program Files (x86)\KADOKAWA\RPGMV\RPGMV.exe"
D = open(EXE, "rb").read()


def dump(kw, before=400, after=900, limit=3, enc="latin1"):
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
    print("### %s   命中=%d" % (kw, len(hits)))
    for h in hits:
        seg = D[max(0, h - before): h + after]
        txt = "".join(
            chr(c) if 32 <= c < 127 or c in (10, 13, 9) else "." for c in seg
        )
        print("--- @0x%X ---" % h)
        print(txt)
        print()


print("#" * 74)
print("# 1. 页签 UI 组件（QtQuick.Controls 1.2 用 TabView/Tab）")
print("#" * 74)
for k in ["TabView", "Tab {", "tabPosition", "TabBar", "currentIndex",
          "Constants.", "tilesetMode", "regionMode", "TilePalette"]:
    print("  %-16s count = %d" % (k, D.count(k.encode())))

print()
print("#" * 74)
print("# 2. 单字母页签标签的上下文")
print("#" * 74)
for k in ['"A"', '"B"', '"C"', '"D"', '"E"']:
    dump(k, before=250, after=250, limit=2)

print("#" * 74)
print("# 3. Constants 单例里的数组")
print("#" * 74)
dump("Constants.", before=100, after=1500, limit=1)
dump("TilePaletteBody {", before=200, after=1500, limit=1)
