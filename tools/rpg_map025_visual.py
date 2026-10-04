# -*- coding: utf-8 -*-
"""
Map025 分段拆层 —— 可视化产出（只读 RPG 工程，只写 tools/_preview/rpg_maps025/）

产出：
  Map025_LAYERS_2x2.png      四层 2×2 拼版（带标题），证明语义切分正确
  Map025_layer_exploded.png  合成图 vs 四层拆解对照
  Map025_contact_3x.png      逐 id 图块对照表（3 倍放大，可读）
"""
import os
import sys
import math
import collections

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rpg_map_render as M
import rpg_map_layers as L

OUT = L.OUT
FONT_CANDIDATES = [
    r"C:/Windows/Fonts/msyh.ttc",
    r"C:/Windows/Fonts/msyhbd.ttc",
    r"C:/Windows/Fonts/simhei.ttf",
    r"C:/Windows/Fonts/simsun.ttc",
]


def font(size):
    for p in FONT_CANDIDATES:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                continue
    return ImageFont.load_default()


# 四层语义（用户口径：地面 / 墙壁 / 路面 / 植物等不可通行）
LAYER_DEF = [
    ("B", "① 地面（草地）", (60, 190, 90)),
    ("C", "② 墙壁（石墙 / 栅栏 / 地图外框）", (200, 190, 170)),
    ("D", "③ 路面（黄色土路）", (230, 205, 110)),
    ("E", "④ 植物等不可通行（树 / 灌木 / 蘑菇 / 石堆）", (40, 140, 70)),
]


def render_band_layer(d, ts, band, z=None):
    """只画某一段的图块 → RGBA Image"""
    w, h = d["width"], d["height"]
    pl, _ = M.planes(d)
    im = Image.new("RGBA", (w * M.TILE, h * M.TILE), (0, 0, 0, 0))
    for y in range(h):
        for x in range(w):
            zs = range(4) if z is None else [z]
            for zz in zs:
                t = pl[zz][y][x]
                if M.is_visible(t) and L.band_of(t) == band:
                    M.draw_tile(im, ts, t, x, y)
    return im


def checker(size, a=58, b=74, step=24):
    im = Image.new("RGBA", size, (a, a, a, 255))
    dr = ImageDraw.Draw(im)
    for y in range(0, size[1], step):
        for x in range(0, size[0], step):
            if (x // step + y // step) % 2 == 0:
                dr.rectangle([x, y, x + step - 1, y + step - 1], fill=(b, b, b, 255))
    return im


def on_checker(rgba):
    bg = checker(rgba.size)
    bg.alpha_composite(rgba)
    return bg


def labeled(img, text, color, sub=None, pad=44):
    out = Image.new("RGBA", (img.width, img.height + pad), (22, 22, 26, 255))
    out.alpha_composite(img, (0, pad))
    dr = ImageDraw.Draw(out)
    dr.text((12, 8), text, font=font(24), fill=color)
    if sub:
        dr.text((12, 34), sub, font=font(15), fill=(170, 170, 180, 255))
    return out


def cmd_2x2(mid=25, scale=0.5):
    d, ts, name, _ = L.load_pair(mid)
    pl, _ = M.planes(d)
    w, h = d["width"], d["height"]

    tiles = []
    for band, label, col in LAYER_DEF:
        n = sum(1 for y in range(h) for x in range(w) for z in range(4)
                if M.is_visible(pl[z][y][x]) and L.band_of(pl[z][y][x]) == band)
        im = render_band_layer(d, ts, band)
        im = im.resize((int(im.width * scale), int(im.height * scale)), Image.LANCZOS)
        t = labeled(on_checker(im), label, col + (255,), sub="图块段 %s · %d 格" % (band, n))
        tiles.append(t)

    cw = max(t.width for t in tiles) + 16
    ch = max(t.height for t in tiles) + 16
    canvas = Image.new("RGBA", (cw * 2, ch * 2), (16, 16, 20, 255))
    for i, t in enumerate(tiles):
        canvas.alpha_composite(t, ((i % 2) * cw + 8, (i // 2) * ch + 8))
    fp = os.path.join(OUT, "Map025_LAYERS_2x2.png")
    canvas.save(fp)
    print("2x2 四层拼版 → %s  (%d×%d)" % (fp, canvas.width, canvas.height))


def cmd_exploded(mid=25, scale=0.45):
    """上排：完整合成图；下排：四层拆分"""
    d, ts, name, _ = L.load_pair(mid)
    pl, sh = M.planes(d)
    w, h = d["width"], d["height"]

    comp = M.render(d, ts, layers=False)["composite"]
    comp = comp.resize((int(comp.width * scale), int(comp.height * scale)), Image.LANCZOS)
    comp_l = labeled(comp, "完整地图（MV 渲染结果）", (255, 255, 255, 255),
                     sub="= 4 个语义层叠加 · 40×30 格 · 48px")

    layers = []
    for band, label, col in LAYER_DEF:
        im = render_band_layer(d, ts, band)
        im = im.resize((int(im.width * scale), int(im.height * scale)), Image.LANCZOS)
        layers.append(labeled(on_checker(im), label, col + (255,)))

    cw = comp_l.width
    total_w = cw * 2
    row1_h = comp_l.height
    row2_h = max(t.height for t in layers)
    canvas = Image.new("RGBA", (total_w, row1_h + row2_h), (16, 16, 20, 255))
    canvas.alpha_composite(comp_l, (cw // 2, 0))
    for i, t in enumerate(layers):
        canvas.alpha_composite(t, ((i % 2) * cw, row1_h + (i // 2) * row2_h))
    fp = os.path.join(OUT, "Map025_layer_exploded.png")
    canvas.save(fp)
    print("拆解对照 → %s  (%d×%d)" % (fp, canvas.width, canvas.height))


def cmd_contact(mid=25, z=3, scale=3):
    """放大版逐 id 对照表（默认只看 z3 可见层）"""
    d, ts, name, _ = L.load_pair(mid)
    w, h = d["width"], d["height"]
    pl, _ = M.planes(d)
    counter = collections.Counter()
    for y in range(h):
        for x in range(w):
            zs = range(4) if z is None else [z]
            for zz in zs:
                t = pl[zz][y][x]
                if M.is_visible(t):
                    counter[t] += 1

    groups = collections.defaultdict(list)
    for t in sorted(counter):
        groups[L.band_of(t)].append(t)

    CELL = 48 * scale + 8
    PAD = 40
    COLS = 8
    rows = sum((len(groups.get(b, [])) + COLS - 1) // COLS for b, _, _ in LAYER_DEF)
    total_rows = sum(max(1, (len(groups.get(b, [])) + COLS - 1) // COLS) for b, _, _ in LAYER_DEF)
    rows = total_rows + len(LAYER_DEF)          # 每段留一行标题
    canvas = Image.new("RGBA", (COLS * CELL, rows * CELL + 16), (30, 30, 36, 255))
    dr = ImageDraw.Draw(canvas)
    y = 8
    for band, label, col in LAYER_DEF:
        ids = groups.get(band, [])
        dr.text((10, y + 6), "%s   [%s 段]  %d 个 id" % (label, band, len(ids)),
                font=font(20), fill=col + (255,))
        y += CELL
        for i, t in enumerate(ids):
            cx, cy = (i % COLS) * CELL, y + (i // COLS) * CELL
            tile = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
            M.draw_tile(tile, ts, t, 0, 0)
            tile = tile.resize((48 * scale, 48 * scale), Image.NEAREST)
            canvas.alpha_composite(tile, (cx + 4, cy + 4))
            dr.rectangle([cx, cy, cx + CELL - 5, cy + CELL - 5], outline=(96, 96, 108, 255))
            dr.text((cx + 4, cy + 48 * scale + 6), "id=%d  x%d" % (t, counter[t]),
                    font=font(13), fill=(235, 235, 240, 255))
        y += ((len(ids) + COLS - 1) // COLS) * CELL
    fp = os.path.join(OUT, "Map025_contact_%sx_z%s.png" % (scale, z))
    canvas.save(fp)
    print("放大对照表 → %s  (%d×%d)" % (fp, canvas.width, canvas.height))


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    cmd_2x2()
    cmd_exploded()
    cmd_contact()
