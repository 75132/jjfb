#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成「整块贴 + 一变四」成品说明图
  tools/_preview/studio/studio_block_result.png

用法：python _make_preview_block.py
"""
import json
import os

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
PREVIEW = os.path.join(os.path.dirname(HERE), "_preview", "studio")
SRC = r"D:\机甲风暴开发素材合集\制作进行素材\地图素材\map1_7x6.png"
PREFIX = "MAPSRC_FLIP"
TILE = 48

FONT_CAND = [r"C:\Windows\Fonts\msyh.ttc", r"C:\Windows\Fonts\msyhbd.ttc",
             r"C:\Windows\Fonts\simhei.ttf", r"C:\Windows\Fonts\arial.ttf"]


def font(size, bold=False):
    for p in ([r"C:\Windows\Fonts\msyhbd.ttc"] if bold else []) + FONT_CAND:
        if os.path.isfile(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                pass
    return ImageFont.load_default()


def checker(w, h, s=12, a=(38, 40, 46), b=(46, 49, 56)):
    im = Image.new("RGB", (w, h), a)
    d = ImageDraw.Draw(im)
    for y in range(0, h, s):
        for x in range(0, w, s):
            if ((x // s) + (y // s)) % 2:
                d.rectangle([x, y, x + s - 1, y + s - 1], fill=b)
    return im


def paste_alpha(bg, im, xy):
    bg.paste(im, xy, im)


def main():
    os.makedirs(PREVIEW, exist_ok=True)
    src = Image.open(SRC).convert("RGBA")
    bpath = os.path.join(OUT, "%s_B.png" % PREFIX)
    if not os.path.isfile(bpath):
        print("!! 缺少 %s，先跑 web/_e2e_save_block.html" % bpath)
        return 1
    out = Image.open(bpath).convert("RGBA")

    # 四个块：从导出图里切出来
    spots = [((0, 0), "原图"), ((7, 0), "左右镜像 H"), ((0, 6), "上下翻转 V"), ((7, 6), "180° HV")]
    W37, H36 = 7 * TILE, 6 * TILE
    blocks = [(out.crop((c * TILE, r * TILE, c * TILE + W37, r * TILE + H36)), lab) for (c, r), lab in spots]

    PAD = 22
    GAP = 18
    ZS = 2           # 源图放大
    ZB = 1           # 变体放大
    srcW, srcH = src.width * ZS, src.height * ZS
    rowW = 4 * W37 * ZB + 3 * GAP
    W = max(srcW, rowW, 760) + PAD * 2
    titleH = 66
    capH = 26
    H = titleH + 22 + srcH + 34 + capH + H36 * ZB + PAD * 2 + 8

    canvas = checker(W, H, 14)
    d = ImageDraw.Draw(canvas)

    # 标题
    d.text((PAD, 16), "整块贴 · 一变四", font=font(26, True), fill=(238, 242, 248))
    d.text((PAD + 210, 26), "一张 7×6 的地图片 → 原图 / 左右镜像 / 上下翻转 / 180°，每块形状完整、不拆散",
           font=font(14), fill=(150, 158, 170))

    y = titleH + 22
    # ---- 源图 ----
    d.text((PAD, y - 20), "① 源素材  map1_7x6.png  (7×6 = 42 格)", font=font(15, True), fill=(255, 206, 84))
    s2 = src.resize((srcW, srcH), Image.NEAREST)
    # 格子线
    grid = Image.new("RGBA", (srcW, srcH), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grid)
    for c in range(1, 7):
        x = c * TILE * ZS
        gd.line([(x, 0), (x, srcH)], fill=(255, 255, 255, 46), width=1)
    for r in range(1, 6):
        yy = r * TILE * ZS
        gd.line([(0, yy), (srcW, yy)], fill=(255, 255, 255, 46), width=1)
    s2 = Image.alpha_composite(s2, grid)
    paste_alpha(canvas, s2, (PAD, y))

    # 右侧说明
    tx = PAD + srcW + 30
    notes = [
        ("框选 = 一整块", (238, 242, 248), 17, True),
        ("在左边按住左键拖出一个矩形，就得到「块」。", (176, 184, 196), 13, False),
        ("块内 42 格的相对位置被完整记住。", (176, 184, 196), 13, False),
        ("", (0, 0, 0), 8, False),
        ("落块不会被拆散", (238, 242, 248), 17, True),
        ("「整块贴」→ 找一块空地整块落下；", (176, 184, 196), 13, False),
        ("「刷块」→ 在输出区拖多大就平铺多大。", (176, 184, 196), 13, False),
        ("", (0, 0, 0), 8, False),
        ("块翻转 = 整块镜像", (238, 242, 248), 17, True),
        ("每格自身翻转 + 排列一起反 →", (176, 184, 196), 13, False),
        ("出来就是整块地图的镜像，可拼对称地图。", (176, 184, 196), 13, False),
        ("（另一档「只翻每格」= 排列不动，做图块集用）", (150, 158, 170), 12, False),
        ("", (0, 0, 0), 8, False),
        ("语义直接落通行表", (238, 242, 248), 17, True),
        ("地面/墙面/路面/不可通行物体/树冠 → flags", (176, 184, 196), 13, False),
        ("不可通行 = 0x000F，树冠 = 0x0010（\u2605上层）", (176, 184, 196), 13, False),
    ]
    ty = y + 2
    for txt, col, sz, bd in notes:
        if txt:
            d.text((tx, ty), txt, font=font(sz, bd), fill=col)
        ty += sz + 7

    y += srcH + 34
    # ---- 四块 ----
    d.text((PAD, y - 22), "② 落到 B 槽的四个变体（同一张图的 4 种镜像）", font=font(15, True), fill=(255, 206, 84))
    x = PAD
    for im, lab in blocks:
        w2, h2 = im.width * ZB, im.height * ZB
        im2 = im.resize((w2, h2), Image.NEAREST)
        paste_alpha(canvas, im2, (x, y))
        d.rectangle([x - 1, y - 1, x + w2, y + h2], outline=(255, 206, 84, 200), width=1)
        tw = d.textlength(lab, font=font(14, True))
        d.rectangle([x, y + h2 + 3, x + tw + 14, y + h2 + 3 + capH - 4], fill=(28, 30, 36))
        d.text((x + 7, y + h2 + 6), lab, font=font(14, True), fill=(255, 206, 84))
        x += w2 + GAP

    y += H36 * ZB + capH + 14
    d.text((PAD, y), "每块占 7×6 格；B 槽 16×16 正好排成 2×2 —— 蓝线框 = 一个完整的块，格子没有被拆散。",
           font=font(13), fill=(140, 148, 160))

    p = os.path.join(PREVIEW, "studio_block_result.png")
    canvas.save(p)
    print("已生成:", p, canvas.size)


if __name__ == "__main__":
    raise SystemExit(main() or 0)
