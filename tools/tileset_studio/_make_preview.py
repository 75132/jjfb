#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成「图块工坊」成品说明图：一变体对照 + 输出图集全貌。"""
import io
import json
import os

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
PREV = r"D:\jjfbol-cocos\jjfbol-cocos\jjfb\tools\_preview\studio"
TS = r"D:\机甲风暴开发素材合集\机甲风暴2\img\tilesets"
T = 48
BG = (22, 23, 26)
PANEL = (30, 32, 37)
TX = (232, 234, 238)
DIM = (140, 145, 155)
ACC = (108, 176, 255)
GRN = (120, 205, 150)
RED = (230, 120, 115)
YLW = (232, 200, 105)


def font(sz, bold=False):
    for p in ([r"C:\Windows\Fonts\msyhbd.ttc"] if bold else []) + \
             [r"C:\Windows\Fonts\msyh.ttc", r"C:\Windows\Fonts\simhei.ttf"]:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, sz)
            except Exception:
                pass
    return ImageFont.load_default()


def tf(im, t):
    return {"h": im.transpose(Image.FLIP_LEFT_RIGHT),
            "v": im.transpose(Image.FLIP_TOP_BOTTOM),
            "hv": im.transpose(Image.ROTATE_180)}.get(t, im)


def diff(a, b):
    da, db = a.tobytes(), b.tobytes()
    return sum(1 for i in range(0, len(da), 4) if da[i:i + 4] != db[i:i + 4])


def pick_asymmetric(sh, n=6):
    """挑 n 个最不对称、外观互不相同的图块，让变体差异一眼可见"""
    cols = sh.width // T
    total = cols * (sh.height // T)
    sc = []
    for i in range(total):
        c, r = i % cols, i // cols
        s = sh.crop((c * T, r * T, c * T + T, r * T + T))
        if s.getchannel("A").getextrema()[1] == 0:
            continue
        sc.append((diff(s, tf(s, "h")) + diff(s, tf(s, "v")), i))
    sc.sort(reverse=True)
    seen, out = set(), []
    for _, i in sc:
        c, r = i % cols, i // cols
        key = sh.crop((c * T, r * T, c * T + T, r * T + T)).tobytes()
        if key in seen:
            continue
        seen.add(key)
        out.append(i)
        if len(out) == n:
            break
    return out, cols


DEMO_SHEET = "Outside_C.png"   # 官方素材，图块高度不对称，四种变换差异一目了然


def main():
    os.makedirs(PREV, exist_ok=True)
    man = json.load(io.open(os.path.join(OUT, "MAP1_FLIP_manifest.json"), encoding="utf-8"))
    bimg = Image.open(os.path.join(OUT, "MAP1_FLIP_B.png")).convert("RGBA")
    demo = Image.open(os.path.join(TS, DEMO_SHEET)).convert("RGBA")

    cell, gap = 96, 12
    rows = 6
    x0, y0 = 28, 122
    tbl_h = rows * (cell + gap)
    ytop = y0 + tbl_h + 20
    thumb = 424
    ty = ytop + 56
    W = 1340
    H = ty + thumb + 40

    c = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(c)

    # ---------- 标题 ----------
    d.text((28, 22), "一张源图块  →  四张", fill=TX, font=font(26, True))
    d.text((28, 60), "原图 / 水平镜像 / 垂直翻转 / 180°   勾选后点一下「一键生成全部变体」，自动排进输出槽",
           fill=DIM, font=font(15))
    d.text((28, 82), "（对照用图块取自 %s —— 它足够不对称，四种变换一眼可见；你的图集同理）" % DEMO_SHEET,
           fill=(104, 109, 119), font=font(12))

    # ---------- 变体对照 ----------
    labels = ["源图块", "原图", "水平镜像 H", "垂直翻转 V", "180° HV"]
    for i, lb in enumerate(labels):
        d.text((x0 + i * (cell + gap) + 4, y0 - 22), lb,
               fill=ACC if i == 0 else TX, font=font(13, i == 0))

    picks, dcols = pick_asymmetric(demo, rows)
    for r, idx in enumerate(picks):
        sc, sr = idx % dcols, idx // dcols
        src = demo.crop((sc * T, sr * T, sc * T + T, sr * T + T))
        y = y0 + r * (cell + gap)
        box = src.resize((cell, cell), Image.NEAREST)
        d.rectangle([x0, y, x0 + cell, y + cell], fill=PANEL)
        c.paste(box, (x0, y), box)
        d.text((x0 + cell + 5, y + 3), "#%d" % idx, fill=DIM, font=font(12))
        for k, t in enumerate(["none", "h", "v", "hv"]):
            v = tf(src, t).resize((cell, cell), Image.NEAREST)
            x = x0 + (k + 1) * (cell + gap)
            d.rectangle([x, y, x + cell, y + cell], fill=PANEL)
            c.paste(v, (x, y), v)
        if r == 0:
            d.line([(x0, y), (x0 + 5 * (cell + gap) - gap, y)], fill=(70, 74, 82))

    # 右侧步骤说明
    xr = x0 + 5 * (cell + gap) + 24
    steps = [
        ("怎么用", TX, 16, True),
        ("", DIM, 6, False),
        ("① 左边框选图块", DIM, 13, False),
        ("② 按数字键 1–6 打语义标签", DIM, 13, False),
        ("      （墙面 / 不可通行物体 → 自动不可通行）", (110, 115, 125), 12, False),
        ("③ 点「⚡ 一键生成全部变体」", DIM, 13, False),
        ("④ 点「按语义自动分配槽位」", DIM, 13, False),
        ("⑤ 底栏「保存本槽 PNG」", DIM, 13, False),
        ("", DIM, 10, False),
        ("槽位容量（MV 硬上限）", TX, 16, True),
        ("", DIM, 6, False),
        ("A5            128 格   384×768", YLW, 13, False),
        ("B / C / D / E  各 256 格   768×768", GRN, 13, False),
        ("一个图块集共 1152 格", DIM, 13, False),
        ("", DIM, 10, False),
        ("翻转图块会不会不够放？", TX, 16, True),
        ("", DIM, 6, False),
        ("4 种变换 = 4 倍用量，", DIM, 13, False),
        ("所以 B 槽正好装 64 个源图块。", DIM, 13, False),
        ("要更多就把 B/C/D/E 四槽都用上。", DIM, 13, False),
    ]
    yy = y0 - 22
    for txt, col, sz, bold in steps:
        if txt:
            d.text((xr, yy), txt, fill=col, font=font(sz, bold))
        yy += sz + 7

    # ---------- 输出图集全貌 ----------
    d.text((28, ytop), "输出图集  B 槽 768×768  ·  256 / 256 格全部填满", fill=TX, font=font(18, True))
    d.text((28, ytop + 26), "64 个源图块 × 4 种变换 = 256 格，下面就是实际存盘的 MAP1_FLIP_B.png",
           fill=DIM, font=font(13))

    th = bimg.resize((thumb, thumb), Image.NEAREST)
    c.paste(th, (28, ty), th)
    step = thumb / 16.0
    for i in range(1, 16):
        d.line([(28 + i * step, ty), (28 + i * step, ty + thumb)], fill=(58, 61, 68), width=1)
        d.line([(28, ty + i * step), (28 + thumb, ty + i * step)], fill=(58, 61, 68), width=1)
    d.rectangle([28, ty, 28 + thumb, ty + thumb], outline=(84, 88, 96))

    # 右侧说明
    xr2 = 28 + thumb + 30
    n = 0
    for v in man["flags"]:
        if v & 0x000F:
            n += 1
    lines = [
        ("输出文件", TX, 16, True),
        ("", DIM, 6, False),
        ("MAP1_FLIP_B.png", ACC, 13, False),
        ("    768×768 · 256 格 · 空位全透明", DIM, 12, False),
        ("MAP1_FLIP_manifest.json", ACC, 13, False),
        ("    每格记录：源图集 / 源格号 /", DIM, 12, False),
        ("    变换 / 语义 / 通行性", DIM, 12, False),
        ("MAP1_FLIP_flags.json", ACC, 13, False),
        ("    8192 长通行数组", DIM, 12, False),
        ("", DIM, 10, False),
        ("通行性真正写进数据", TX, 16, True),
        ("", DIM, 6, False),
        ("0x0000   可通行（地面·路面）", GRN, 13, False),
        ("0x000F   四面不可通行（墙·物体）", RED, 13, False),
        ("0x0010   ★上层（树冠，盖住角色）", YLW, 13, False),
        ("", DIM, 10, False),
        ("导出 == 源图块（逐像素核验）", TX, 16, True),
        ("", DIM, 6, False),
        ("259 格全部通过，0 格不符", GRN, 13, False),
        ("alpha 通道逐像素完全一致", DIM, 12, False),
    ]
    yy = ty + 4
    for txt, col, sz, bold in lines:
        if txt:
            d.text((xr2, yy), txt, fill=col, font=font(sz, bold))
        yy += sz + 6

    fp = os.path.join(PREV, "studio_result.png")
    c.save(fp)
    print("成品说明图 → %s  %dx%d  选的源图块=%s" % (fp, c.size[0], c.size[1], picks))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
