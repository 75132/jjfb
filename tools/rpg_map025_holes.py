# -*- coding: utf-8 -*-
"""
Map025 地面层 11 个洞 —— 取证可视化 + 补洞版地面层

洞的成因：这 11 格在 z2 与 z3 里画的都是 **石墙（C 段）**，两层都没画地面 → 拆「地面」段时留洞。
本工具：
  1) 出「合成 / z2 / z3 / 地面段(红框标洞)」四联放大图，看清那 11 格到底是什么
  2) 出「补洞版」地面层（洞位补上 B238 草地）—— 墙是全不透明图块，视觉零差异
"""
import os
import sys
import json
import hashlib

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rpg_map_render as M
import rpg_map_layers as L
import rpg_map025_visual as V

OUT = L.OUT
TILE = 48


def holes_of(d):
    w, h = d["width"], d["height"]
    pl, _ = M.planes(d)
    out = []
    for y in range(h):
        for x in range(w):
            a, b = pl[2][y][x], pl[3][y][x]
            if a and L.band_of(a) == "B":
                continue
            if b and L.band_of(b) == "B":
                continue
            out.append((x, y, a, b))
    return out


def zoom(im, x0, y0, cols, rows, scale):
    box = (x0 * TILE, y0 * TILE, (x0 + cols) * TILE, (y0 + rows) * TILE)
    c = im.crop(box)
    return c.resize((c.width * scale, c.height * scale), Image.NEAREST)


def gridify(im, cols, rows, scale, x0, y0, holes, mark=True):
    """叠棋盘底 + 格线 + 洞位红框"""
    bg = V.checker(im.size)
    bg.alpha_composite(im)
    im = bg
    dr = ImageDraw.Draw(im)
    for i in range(cols + 1):
        dr.line([(i * TILE * scale, 0), (i * TILE * scale, rows * TILE * scale)], fill=(120, 120, 135, 200))
    for j in range(rows + 1):
        dr.line([(0, j * TILE * scale), (cols * TILE * scale, j * TILE * scale)], fill=(120, 120, 135, 200))
    if mark:
        for (hx, hy, _, _) in holes:
            if x0 <= hx < x0 + cols and y0 <= hy < y0 + rows:
                cx, cy = (hx - x0) * TILE * scale, (hy - y0) * TILE * scale
                dr.rectangle([cx + 2, cy + 2, cx + TILE * scale - 3, cy + TILE * scale - 3],
                             outline=(255, 60, 60, 255), width=3)
    return im


def cmd_zoom(mid=25, scale=2):
    d, ts, name, _ = L.load_pair(mid)
    holes = holes_of(d)
    comp = M.render(d, ts, layers=False)["composite"]
    pl, _ = M.planes(d)

    z2 = Image.new("RGBA", comp.size, (0, 0, 0, 0))
    z3 = Image.new("RGBA", comp.size, (0, 0, 0, 0))
    for y in range(d["height"]):
        for x in range(d["width"]):
            M.draw_tile(z2, ts, pl[2][y][x], x, y)
            M.draw_tile(z3, ts, pl[3][y][x], x, y)
    ground = V.render_band_layer(d, ts, "B")

    # 区域 A（中央墙簇）与区域 B（右上竖墙）
    regions = [("区域A · 中央墙簇", 14, 4, 8, 8), ("区域B · 右侧竖墙", 27, 2, 8, 7)]
    layers = [("合成", comp, False), ("z2（编辑器第3层）", z2, True), ("z3（编辑器第4层）", z3, True)]

    made = []
    for rname, x0, y0, cols, rows in regions:
        for lname, img, need_grid in layers:
            crop = zoom(img, x0, y0, cols, rows, scale)
            if need_grid:
                crop = V.checker(crop.size) if False else crop
                bg = V.checker(crop.size)
                bg.alpha_composite(crop)
                crop = bg
                dr = ImageDraw.Draw(crop)
                for i in range(cols + 1):
                    dr.line([(i * TILE * scale, 0), (i * TILE * scale, rows * TILE * scale)],
                            fill=(120, 120, 135, 190))
                for j in range(rows + 1):
                    dr.line([(0, j * TILE * scale), (cols * TILE * scale, j * TILE * scale)],
                            fill=(120, 120, 135, 190))
            # 红框标洞
            dr = ImageDraw.Draw(crop)
            cnt = 0
            for (hx, hy, _, _) in holes:
                if x0 <= hx < x0 + cols and y0 <= hy < y0 + rows:
                    cx, cy = (hx - x0) * TILE * scale, (hy - y0) * TILE * scale
                    dr.rectangle([cx + 2, cy + 2, cx + TILE * scale - 3, cy + TILE * scale - 3],
                                 outline=(255, 60, 60, 255), width=3)
                    cnt += 1
            made.append(V.labeled(crop, "%s · %s" % (rname, lname), (255, 255, 255, 255),
                                  sub="x%d..%d y%d..%d  %dx  洞 %d 个" %
                                      (x0, x0 + cols - 1, y0, y0 + rows - 1, scale, cnt)))

    cw = max(m.width for m in made) + 10
    ch = max(m.height for m in made) + 10
    total = Image.new("RGBA", (cw * 3, ch * 2), (16, 16, 20, 255))
    for i, m in enumerate(made):
        total.alpha_composite(m, ((i % 3) * cw + 5, (i // 3) * ch + 5))
    fp = os.path.join(OUT, "Map025_holes_zoom.png")
    total.save(fp)
    print("洞位放大图 → %s  (%d×%d)" % (fp, total.width, total.height))

    # 全图标记版
    ov = []
    for title, img in [("合成（你看到的样子）", comp), ("拆出的「地面」段", ground)]:
        bg = V.checker(img.size)
        bg.alpha_composite(img)
        small = bg.resize((int(img.width * 0.5), int(img.height * 0.5)), Image.LANCZOS)
        dr = ImageDraw.Draw(small)
        for (hx, hy, _, _) in holes:
            cx, cy = hx * TILE * 0.5, hy * TILE * 0.5
            dr.rectangle([cx + 1, cy + 1, cx + TILE * 0.5 - 2, cy + TILE * 0.5 - 2],
                         outline=(255, 60, 60, 255), width=2)
        ov.append(V.labeled(small, title + "（红框 = 11 个洞位）", (255, 255, 255, 255)))
    W = max(m.width for m in ov)
    tot2 = Image.new("RGBA", (W * 2 + 10, max(m.height for m in ov)), (16, 16, 20, 255))
    for i, m in enumerate(ov):
        tot2.alpha_composite(m, (i * (W + 10), 0))
    fp2 = os.path.join(OUT, "Map025_holes_marked.png")
    tot2.save(fp2)
    print("全图标记 → %s  (%d×%d)" % (fp2, tot2.width, tot2.height))
    return holes


def cmd_fix(mid=25, fill_tid=238):
    """补洞版地面层：洞位补上 fill_tid"""
    d, ts, name, _ = L.load_pair(mid)
    holes = holes_of(d)
    w, h = d["width"], d["height"]
    pl, _ = M.planes(d)
    im = Image.new("RGBA", (w * TILE, h * TILE), (0, 0, 0, 0))
    for y in range(h):
        for x in range(w):
            for z in range(4):
                t = pl[z][y][x]
                if M.is_visible(t) and L.band_of(t) == "B":
                    M.draw_tile(im, ts, t, x, y)
    for (x, y, _, _) in holes:
        M.draw_tile(im, ts, fill_tid, x, y)

    fp = os.path.join(OUT, "layers", "Map025_L1_ground_filled.png")
    im.save(fp)
    print("补洞版地面 → %s  (%d 格补了 id%d)" % (fp, len(holes), fill_tid))

    # 视觉零差异校验：把补洞后的四层叠起来，与 MV 合成逐像素比
    A = M.render(d, ts, layers=False)["composite"]
    B = Image.new("RGBA", A.size, (0, 0, 0, 0))
    B.alpha_composite(im)
    for band in ("C", "D", "E"):
        B.alpha_composite(V.render_band_layer(d, ts, band))
    da, db = A.tobytes(), B.tobytes()
    diff = sum(1 for i in range(0, len(da), 4) if da[i:i + 4] != db[i:i + 4])
    print("  与 MV 合成逐像素比对：不同像素 %d / %d  → %s" % (diff, A.width * A.height,
          "视觉完全一致" if diff == 0 else "有差异！"))
    return len(holes), diff


if __name__ == "__main__":
    os.makedirs(os.path.join(OUT, "layers"), exist_ok=True)
    holes = cmd_zoom()
    print("\n洞清单：", [(x, y) for x, y, _, _ in holes])
    cmd_fix()
