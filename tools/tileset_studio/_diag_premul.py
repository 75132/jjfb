#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
诊断：导出的 PNG 与「源图块 + 变换」逐像素差异有多大？

结论预期：canvas 2D 内部使用 premultiplied alpha，带抗锯齿（半透明）
边缘的图块往返后会引入 ±1 级舍入误差 —— 肉眼看不出，但逐字节比对不等。
"""
import io
import json
import os
import sys

from PIL import Image, ImageChops

TS = r"D:\机甲风暴开发素材合集\机甲风暴2\img\tilesets"
HERE = os.path.dirname(os.path.abspath(__file__))
T = 48


def tf(im, t):
    return {"h": im.transpose(Image.FLIP_LEFT_RIGHT),
            "v": im.transpose(Image.FLIP_TOP_BOTTOM),
            "hv": im.transpose(Image.ROTATE_180)}.get(t, im)


def main():
    man = json.load(io.open(os.path.join(HERE, "out", "MAP1_FLIP_manifest.json"), encoding="utf-8"))
    bim = Image.open(os.path.join(HERE, "out", "MAP1_FLIP_B.png")).convert("RGBA")
    sh = Image.open(os.path.join(TS, "MAP1.png")).convert("RGBA")

    bad = []
    for c in man["slots"]["B"]["cells"]:
        sc, sr = c["srcIndex"] % 16, c["srcIndex"] // 16
        piece = tf(sh.crop((sc * T, sr * T, sc * T + T, sr * T + T)), c["transform"])
        got = bim.crop((c["col"] * T, c["row"] * T, c["col"] * T + T, c["row"] * T + T))
        if piece.tobytes() != got.tobytes():
            d = ImageChops.difference(piece, got)
            ex = [d.getchannel(i).getextrema()[1] for i in range(4)]
            # 差异像素个数 + 其中「带半透明」的个数
            dp = 0
            semi = 0
            pa = piece.getchannel("A").tobytes()
            ga = got.getchannel("A").tobytes()
            pr = list(piece.getdata())
            gr = list(got.getdata())
            for i in range(len(pr)):
                if pr[i] != gr[i]:
                    dp += 1
                    if 0 < pr[i][3] < 255 or 0 < gr[i][3] < 255:
                        semi += 1
            bad.append((c["index"], c["srcIndex"], c["transform"], ex, dp, semi))

    print("B 槽 256 格中，逐字节不等 = %d 格" % len(bad))
    print()
    print("%-5s %-6s %-4s %-20s %-8s %s" % ("格", "源格", "变换", "各通道最大差RGBA", "差异像素", "含半透明"))
    for x in bad[:16]:
        print("%-5d %-6d %-4s %-20s %-8d %d" % (x[0], x[1], x[2], str(tuple(x[3])), x[4], x[5]))
    if len(bad) > 16:
        print("  … 其余 %d 格省略" % (len(bad) - 16))
    print()

    # 关键判据
    mx = [max(x[3][i] for x in bad) for i in range(4)]
    print("全部不符格的最大通道差： R=%d  G=%d  B=%d  A=%d" % tuple(mx))
    all_semi = all(x[5] > 0 for x in bad)
    print("每一格的不符像素里都含半透明像素: %s" % all_semi)
    print("差异像素中半透明占比: %.1f%%" % (
        100.0 * sum(x[5] for x in bad) / max(1, sum(x[4] for x in bad))))

    # 用「容差 ≤1」判据重算
    ok = 0
    for c in man["slots"]["B"]["cells"]:
        sc, sr = c["srcIndex"] % 16, c["srcIndex"] // 16
        piece = tf(sh.crop((sc * T, sr * T, sc * T + T, sr * T + T)), c["transform"])
        got = bim.crop((c["col"] * T, c["row"] * T, c["col"] * T + T, c["row"] * T + T))
        d = ImageChops.difference(piece, got)
        if max(d.getchannel(i).getextrema()[1] for i in range(4)) <= 1:
            ok += 1
    print()
    print("按「各通道最大差 ≤ 1」判据：%d / 256 格通过" % ok)


if __name__ == "__main__":
    sys.exit(main())
