#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
图集内容分布可视化 —— 一眼看清每张图还剩多少空位、哪些格越界。

绿 = 有内容    深灰 = 空位（能放新图块）    深红 = 越界（图不够大，摆下去画不出来）
对每张图都按 B/C/D/E 的标称 16 列 × 16 行来画，越界一目了然。
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rpg_tileset_capacity as C

OUT = os.path.join(C.HERE, "_preview", "rpg_tileset_capacity")
TILE = 48
CELL = 11
COLS, ROWS = 16, 16
LEFT = 168
GW = COLS * CELL
PANEL = 372
TOP = 164
ROW_GAP = 30

FONTS = [r"C:/Windows/Fonts/msyh.ttc", r"C:/Windows/Fonts/simhei.ttf", r"C:/Windows/Fonts/arial.ttf"]

TARGETS = [
    ("MAP1", "B / C / D 三槽都挂它"),
    ("MAP2", "Map002/004/013/017/018"),
    ("MAP3", "尼利亚荒原"),
    ("MAP4", "城市"),
    ("MAP8", "训练室 / 商城"),
    ("MAP15", "E 槽植物"),
    ("ITEM01", "城市 / 训练室的 D 槽"),
    ("CSDT", "世界地图 C 槽"),
]


def font(sz):
    for p in FONTS:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, sz)
            except Exception:
                pass
    return ImageFont.load_default()


def main():
    os.makedirs(OUT, exist_ok=True)
    recs = []
    for nm, note in TARGETS:
        p = os.path.join(C.ROOT, "img", "tilesets", nm + ".png")
        if not os.path.exists(p):
            continue
        im = Image.open(p).convert("RGBA")
        W, H = im.size
        cols, rows = W // TILE, H // TILE
        filled = empty = oob = 0
        for r in range(ROWS):
            for c in range(COLS):
                if r >= rows or c >= cols:
                    oob += 1
                    continue
                sub = im.crop((c * TILE, r * TILE, c * TILE + TILE, r * TILE + TILE))
                if sub.getchannel("A").getextrema()[1] > 0:
                    filled += 1
                else:
                    empty += 1
        recs.append((nm, note, W, H, cols, rows, filled, empty, oob))

    Wc = LEFT + GW + PANEL
    Hc = TOP + len(recs) * (ROWS * CELL + ROW_GAP) + 96
    im = Image.new("RGB", (Wc, Hc), (22, 22, 26))
    d = ImageDraw.Draw(im)

    f_title = font(21)
    f_sub = font(14)
    f_mono = font(14)
    f_name = font(16)
    f_big = font(17)

    d.text((26, 22), "图集内容分布 —— 每张图还剩多少空位", fill=(245, 245, 245), font=f_title)
    d.text((26, 56), "每格 = 一个 48×48 图块位；按 B/C/D/E 的标称 16 列 × 16 行 = 256 格来画", fill=(158, 158, 164), font=f_sub)
    d.text((26, 80), "绿 = 已有内容     深灰 = 空位（能放你的翻转图块）", fill=(176, 176, 182), font=f_sub)
    d.text((26, 104), "深红 = 越界（图不够大，摆下去是空的）", fill=(176, 176, 182), font=f_sub)
    d.text((26, 132), "你的图都是 768×720 —— 比标准 768×768 少一行，末行整行越界",
           fill=(226, 96, 96), font=f_sub)

    y = TOP
    for nm, note, W, H, cols, rows, filled, empty, oob in recs:
        d.text((26, y + 4), nm + ".png", fill=(240, 240, 240), font=f_name)
        d.text((26, y + 26), "%d×%d" % (W, H), fill=(150, 150, 155), font=f_mono)
        d.text((26, y + 46), note, fill=(126, 126, 132), font=font(12))

        im2 = Image.open(os.path.join(C.ROOT, "img", "tilesets", nm + ".png")).convert("RGBA")
        for r in range(ROWS):
            for c in range(COLS):
                x, yy = LEFT + c * CELL, y + r * CELL
                if r >= rows or c >= cols:
                    d.rectangle([x, yy, x + CELL - 2, yy + CELL - 2], fill=(74, 40, 40))
                else:
                    sub = im2.crop((c * TILE, r * TILE, c * TILE + TILE, r * TILE + TILE))
                    if sub.getchannel("A").getextrema()[1] > 0:
                        d.rectangle([x, yy, x + CELL - 2, yy + CELL - 2], fill=(76, 175, 80))
                    else:
                        d.rectangle([x, yy, x + CELL - 2, yy + CELL - 2], fill=(62, 62, 70))

        d.text((LEFT + GW + 14, y + 8), "有内容 %d 格" % filled, fill=(120, 220, 130), font=f_mono)
        d.text((LEFT + GW + 14, y + 30), "空位   %d 格" % empty, fill=(150, 200, 255), font=f_mono)
        d.text((LEFT + GW + 14, y + 52), "越界   %d 格" % oob, fill=(226, 96, 96), font=f_mono)
        if oob == 0 and empty == 0:
            d.text((LEFT + GW + 14, y + 76), "★ 已满，放不下了", fill=(240, 180, 80), font=f_mono)

        y += ROWS * CELL + ROW_GAP

    d.text((26, Hc - 96), "一个页签最多 256 格（16 列 × 16 行），图片必须 768×768", fill=(190, 190, 196), font=f_sub)
    d.text((26, Hc - 74), "A5 是 8 列 × 16 行 = 128 格，图片 384×768（宽度只有一半）", fill=(190, 190, 196), font=f_sub)
    d.text((26, Hc - 50), "你现在 B/C/D 三个槽挂的是同一张 MAP1 —— 只有那 240 格是真在用的",
           fill=(226, 96, 96), font=f_sub)
    d.text((26, Hc - 28), "另外全工程已因缺行产生 2,073 格越界黑格（占 3.00%）",
           fill=(226, 96, 96), font=f_sub)

    fp = os.path.join(OUT, "capacity_grid.png")
    im.save(fp)
    print("→ %s  (%dx%d)" % (fp, im.width, im.height))
    return fp


if __name__ == "__main__":
    main()
