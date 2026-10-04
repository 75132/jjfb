#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""扫描全部图集：非空格数 + 图块「不对称度」，用来挑演示 / 验证素材。"""
import glob
import os

from PIL import Image

TS = r"D:\机甲风暴开发素材合集\机甲风暴2\img\tilesets"
T = 48


def diff(a, b):
    da, db = a.tobytes(), b.tobytes()
    return sum(1 for i in range(0, len(da), 4) if da[i:i + 4] != db[i:i + 4])


def main():
    rows = []
    for p in sorted(glob.glob(os.path.join(TS, "*.png"))):
        im = Image.open(p).convert("RGBA")
        cols, rws = im.width // T, im.height // T
        if cols == 0 or rws == 0:
            continue
        nonblank = 0
        asym = []
        uniq = set()
        for r in range(rws):
            for c in range(cols):
                cell = im.crop((c * T, r * T, c * T + T, r * T + T))
                if cell.getchannel("A").getextrema()[1] == 0:
                    continue
                nonblank += 1
                uniq.add(cell.tobytes())
                asym.append(diff(cell, cell.transpose(Image.FLIP_LEFT_RIGHT)) +
                            diff(cell, cell.transpose(Image.FLIP_TOP_BOTTOM)))
        if not nonblank:
            continue
        # 不看全透明的空白差异，只看有内容的格子
        avg = sum(asym) / len(asym)
        mx = max(asym)
        rows.append((os.path.basename(p), cols, rws, nonblank, len(uniq), avg, mx))

    rows.sort(key=lambda x: -x[5])
    print("%-16s %-9s %-7s %-7s %-8s %s" % ("图集", "网格", "非空格", "去重", "平均不对称", "最大"))
    print("-" * 74)
    for n, c, r, nb, uq, av, mx in rows[:22]:
        print("%-16s %dx%-6d %-7d %-7d %-8.0f %d" % (n, c, r, nb, uq, av, mx))
    print()
    print("=> 候选（非空格>=64 且平均不对称最高）:")
    for n, c, r, nb, uq, av, mx in rows:
        if nb >= 64:
            print("   %-16s 非空 %d，平均不对称 %.0f，最大 %d" % (n, nb, av, mx))
            break


if __name__ == "__main__":
    main()
