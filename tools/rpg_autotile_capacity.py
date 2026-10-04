# -*- coding: utf-8 -*-
"""RPG Maker MV 自动图块槽（A1-A4）容量核算 + 网格标注图。

引擎硬事实（js/rpg_core.js，逐行核对过）：
  5292  getAutotileKind  = floor((tileId - 2048) / 48)      TILE_ID_A1 = 2048
  5296  getAutotileShape = (tileId - 2048) % 48
  5044  tx = kind % 8 ; ty = floor(kind / 8)
  5080  A2: bx = tx*2 ; by = (ty -  2) * 3        单元 = 2 格宽 x 3 格高
  5085  A3: bx = tx*2 ; by = (ty -  6) * 2        单元 = 2 x 2
  5090  A4: bx = tx*2 ; by = floor((ty-10)*2.5 + (ty%2? 0.5:0))   单元 = 2 x 2
  5106  sx = (bx*2 + qsx) * 24 ; sy = (by*2 + qsy) * 24

=> 每个槽的 kind 数与图片尺寸都是**写死的**，图片做大也没有对应的 tileId。
"""
import io
import os
import sys

from PIL import Image, ImageDraw

ROOT = r"D:/机甲风暴开发素材合集/机甲风暴2"
TS_DIR = os.path.join(ROOT, "img", "tilesets")
OUT = r"D:/jjfbol-cocos/jjfbol-cocos/jjfb/tools/_preview/rpg_autotile"

TILE = 48
T_A1, T_A2, T_A3, T_A4, T_A5 = 2048, 2816, 4352, 5888, 1536
T_MAX = 8192

# name, kind_lo, kind_hi, 单元宽(格), 单元高(格), 标准图尺寸, y 起点列表(格)
SLOTS = [
    ("A1", 0, 15, 2, 3, (768, 576), None),
    ("A2", 16, 47, 2, 3, (768, 576), [0, 144, 288, 432]),
    ("A3", 48, 79, 2, 2, (768, 384), [0, 96, 192, 288]),
    ("A4", 80, 127, 2, 2, (768, 720), [0, 144, 240, 384, 480, 624]),
]

# 普通（非自动）图块槽
NORMAL = [
    ("A5", 1536, 1663, 8, 16, (384, 768)),
    ("B", 0, 255, 16, 16, (768, 768)),
    ("C", 256, 511, 16, 16, (768, 768)),
    ("D", 512, 767, 16, 16, (768, 768)),
    ("E", 768, 1023, 16, 16, (768, 768)),
]

SHEET_OF = {
    "A1": "Outside_A1",
    "A2": "Outside_A2",
    "A3": "Outside_A3",
    "A4": "Outside_A4",
}


def kind_range(tile_a, tile_b):
    """某槽的 kind 区间（闭区间）。"""
    lo = (tile_a - T_A1) // 48
    hi = (tile_b - T_A1) // 48
    return lo, hi


def report():
    lines = []
    lines.append("=" * 96)
    lines.append("RPG Maker MV 图块槽容量总表（引擎写死，非推断）")
    lines.append("=" * 96)
    lines.append("")
    lines.append("【一、自动图块槽 A1-A4】—— 会自动拼接边缘，不能当独立图块用")
    lines.append("")
    lines.append("%-5s %-14s %6s  %-10s %-12s %-14s %s" % (
        "槽", "kind 区间", "数量", "单元(格)", "单元(px)", "标准图尺寸", "网格"))
    lines.append("-" * 96)
    total_auto = 0
    for name, lo, hi, uw, uh, std, ys in SLOTS:
        n = hi - lo + 1
        total_auto += n
        if name == "A1":
            grid = "水面/瀑布专用（3 帧动画）"
        else:
            rows = len(ys)
            grid = "%d 列 x %d 行" % (8, rows)
        lines.append("%-5s %-14s %6d  %-10s %-12s %-14s %s" % (
            name, "%d-%d" % (lo, hi), n,
            "%dx%d" % (uw, uh), "%dx%d" % (uw * TILE, uh * TILE),
            "%dx%d" % std, grid))
    lines.append("-" * 96)
    lines.append("小计：%d 个自动图块位" % total_auto)
    lines.append("")
    lines.append("【二、普通图块槽 A5 + B/C/D/E】—— 一格一个独立图块")
    lines.append("")
    lines.append("%-5s %-16s %6s  %-12s %s" % ("槽", "tileId 区间", "数量", "标准图尺寸", "网格"))
    lines.append("-" * 96)
    total_n = 0
    for name, lo, hi, cols, rows, std in NORMAL:
        n = hi - lo + 1
        total_n += n
        lines.append("%-5s %-16s %6d  %-12s %d 列 x %d 行" % (
            name, "%d-%d" % (lo, hi), n, "%dx%d" % std, cols, rows))
    lines.append("-" * 96)
    lines.append("小计：%d 格" % total_n)
    lines.append("")
    lines.append("【三、合计】")
    lines.append("  自动图块位 %d 个（不能放独立图块）" % total_auto)
    lines.append("  普通图块格 %d 个（这才是放翻转图块的地方）" % total_n)
    lines.append("")
    lines.append("【四、id 空间占用（tileId 0-8191）】")
    lines.append("  B   0%6d-%6d  %5d id" % (0, 255, 256))
    lines.append("  C   256-511   256 id")
    lines.append("  D   512-767   256 id")
    lines.append("  E   768-1023  256 id")
    lines.append("  空  1024-1535 %5d id  **无页签入口**" % (1536 - 1024))
    lines.append("  A5  1536-1663 128 id  (1664-2047 空 %d id，无入口)" % (T_A1 - 1664))
    lines.append("  A1  2048-2815 768 id  = 16 kind x 48 shape")
    lines.append("  A2  2816-4351 1536 id = 32 kind x 48 shape")
    lines.append("  A3  4352-5887 1536 id = 32 kind x 48 shape")
    lines.append("  A4  5888-8191 2304 id = 48 kind x 48 shape")
    text = "\n".join(lines)
    print(text)
    os.makedirs(OUT, exist_ok=True)
    with io.open(os.path.join(OUT, "autotile_capacity.txt"), "w",
                 encoding="utf-8", newline="\n") as f:
        f.write(text)
    return text


def font(size):
    for p in (r"C:/Windows/Fonts/msyh.ttc", r"C:/Windows/Fonts/simhei.ttf",
              r"C:/Windows/Fonts/arial.ttf"):
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                pass
    return ImageFont.load_default()


from PIL import ImageFont  # noqa: E402


def annotate(slot, scale=1):
    """在真实图集上画网格 + kind 编号。"""
    name, lo, hi, uw, uh, std, ys = [s for s in SLOTS if s[0] == slot][0]
    sheet = SHEET_OF[slot]
    p = os.path.join(TS_DIR, sheet + ".png")
    if not os.path.exists(p):
        print("  (%s 不存在，跳过)" % p)
        return None
    im = Image.open(p).convert("RGBA")
    im = im.resize((im.width * scale, im.height * scale), Image.NEAREST)

    # 底层：把透明区域填成棋盘格，便于看清
    bg = Image.new("RGBA", im.size, (26, 26, 32, 255))
    for y in range(0, im.height, 24):
        for x in range(0, im.width, 24):
            if (x // 24 + y // 24) % 2 == 0:
                bg.paste((38, 38, 46, 255), (x, y, min(x + 24, im.width), min(y + 24, im.height)))
    bg.alpha_composite(im)

    # 外框留白
    PAD = 46 * scale
    W = bg.width + PAD * 2
    H = bg.height + PAD + 96 * scale
    canvas = Image.new("RGBA", (W, H), (16, 16, 20, 255))
    canvas.alpha_composite(bg, (PAD, PAD))

    d = ImageDraw.Draw(canvas)
    f_num = font(max(11, 13 * scale))
    f_small = font(max(9, 10 * scale))

    unit_w = uw * TILE * scale
    unit_h = uh * TILE * scale

    if ys is None:
        # A1 特殊，只标外框
        d.rectangle([PAD, PAD, PAD + bg.width - 1, PAD + bg.height - 1],
                    outline=(200, 160, 60, 255), width=2)
    else:
        k = lo
        for r, y0 in enumerate(ys):
            for c in range(8):
                x0 = c * unit_w
                y1 = y0 * scale
                box = [PAD + x0, PAD + y1, PAD + x0 + unit_w - 1, PAD + y1 + unit_h - 1]
                d.rectangle(box, outline=(255, 96, 96, 255), width=2)
                label = "kind %d" % k
                tid = T_A1 + k * 48
                d.rectangle([box[0] + 3, box[1] + 3, box[0] + 3 + len(label) * 7 * scale, box[1] + 15 * scale],
                            fill=(180, 30, 30, 230))
                d.text((box[0] + 6, box[1] + 3), label, fill=(255, 255, 255, 255), font=f_num)
                d.text((box[0] + 6, box[3] - 15 * scale), "id %d" % tid,
                       fill=(255, 210, 120, 255), font=f_small)
                k += 1

    # 顶部标题
    d.text((PAD, 10), "%s 槽 —— 标准图 %s  ( %s )" % (
        slot, "%dx%d" % std, os.path.basename(p)), fill=(245, 245, 245, 255), font=font(17 * scale))
    d.text((PAD, 32 * scale), "红框 = 一个自动图块单元 %dx%d px（%d 格 x %d 格）；整槽 %d 个" % (
        unit_w // scale, unit_h // scale, uw, uh, hi - lo + 1),
        fill=(188, 188, 196, 255), font=font(12 * scale))
    d.text((PAD, H - 30 * scale),
           "自动图块会按邻居自动选 shape（48 种拼法），铺到地图上看到的是拼接结果，不是这里的原图",
           fill=(255, 170, 90, 255), font=font(12 * scale))

    fp = os.path.join(OUT, "%s_grid.png" % slot)
    canvas.save(fp)
    print("  标注图 → %s  (%dx%d)" % (fp, canvas.width, canvas.height))
    return fp


def main():
    a = sys.argv[1:]
    if not a or "--report" in a:
        report()
    if "--annotate" in a or not a:
        os.makedirs(OUT, exist_ok=True)
        for s in ("A2", "A3", "A4"):
            annotate(s, scale=2 if s == "A2" else 1)
    if "--map" in a:
        pass


if __name__ == "__main__":
    main()
