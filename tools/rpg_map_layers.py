# -*- coding: utf-8 -*-
"""
Map025「按图块分区拆层」验证工具（只读 RPG 工程，只写 tools/_preview/rpg_maps025/）

背景：用户在 MV 里把同一张 MAP1.png 挂到 B/C/D 三个槽位，用 **tile id 段** 编码语义：
    A(1536-6143 自动块) / B(0-255) / C(256-511) / D(512-767) / E(768-1023)
目的：把一张图按 id 段拆成多张独立 PNG，验证「能不能分出图层」。

用法：
  python tools/rpg_map_layers.py --map 25 --band       # 按 id 段拆层输出 PNG
  python tools/rpg_map_layers.py --map 25 --slots      # 只看 tileset 槽位 → 图片映射
  python tools/rpg_map_layers.py --map 25 --ids        # 逐 id 图块对照表（裁原图块 + 标注）
  python tools/rpg_map_layers.py --map 25 --zsplit     # 按 z 拆层（对照用）
"""
import json
import os
import sys
import math
import collections

from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rpg_map_render as M   # 复用已复刻好的 MV 绘制规则

OUT = r"D:/jjfbol-cocos/jjfbol-cocos/jjfb/tools/_preview/rpg_maps025"

BANDS = [("A", 1536, 6144), ("B", 0, 256), ("C", 256, 512), ("D", 512, 768), ("E", 768, 1024)]
BAND_NAME = {"A": "自动图块", "B": "B段(0-255)", "C": "C段(256-511)", "D": "D段(512-767)", "E": "E段(768-1023)"}


def band_of(t):
    """返回图块所属 id 段。A 段含 A5(1536-2047) 与 A1..A4(2048-6143)"""
    if t == 0:
        return None
    if t >= 1536:
        return "A"
    return ["B", "C", "D", "E"][t // 256]


def slot_names(ts):
    """返回 {段: 图片名}"""
    out = {}
    for i, nm in enumerate(ts.names):
        out[M.SHEET_ORDER[i]] = nm or "(空)"
    return out


def load_pair(mid):
    mi = {x["id"]: x for x in M.load("MapInfos.json") if x}
    tss = {t["id"]: M.TS(t) for t in M.load("Tilesets.json") if t}
    d = M.load("Map%03d.json" % mid)
    ts = tss.get(d.get("tilesetId"))
    name = mi.get(mid, {}).get("name", "?")
    return d, ts, name, mi


def render_band(d, ts, band, out_name, z=None):
    """只画属于 band 的图块。z=None → 所有 z 合起来；否则只画该 z"""
    w, h = d["width"], d["height"]
    pl, sh = M.planes(d)
    im = Image.new("RGBA", (w * M.TILE, h * M.TILE), (0, 0, 0, 0))
    n = 0
    for y in range(h):
        for x in range(w):
            zs = range(4) if z is None else [z]
            for zz in zs:
                t = pl[zz][y][x]
                if not M.is_visible(t):
                    continue
                if band_of(t) != band:
                    continue
                M.draw_tile(im, ts, t, x, y)
                n += 1
    os.makedirs(OUT, exist_ok=True)
    fp = os.path.join(OUT, out_name)
    im.save(fp)
    return fp, n


def cmd_band(mid):
    d, ts, name, _ = load_pair(mid)
    print("=" * 92)
    print("Map%03d「%s」  %d×%d  tileset=%s(%s)" % (mid, name, d["width"], d["height"],
                                                   ts.id, ts.name))
    print("=" * 92)
    print("\n[槽位 → 图片]")
    for k in M.SHEET_ORDER:
        pass
    sn = slot_names(ts)
    for k in M.SHEET_ORDER:
        print("   %-3s → %s" % (k, sn[k]))

    w, h = d["width"], d["height"]
    pl, _ = M.planes(d)

    print("\n[各 z × 各 id 段 格数]")
    header = "z\\段 " + "".join("%12s" % b for b, _, _ in BANDS)
    print(header)
    stat = {}
    for z in range(4):
        row = []
        for b, _, _ in BANDS:
            c = sum(1 for y in range(h) for x in range(w)
                    if M.is_visible(pl[z][y][x]) and band_of(pl[z][y][x]) == b)
            stat[(z, b)] = c
            row.append("%12d" % c)
        print("z%-3d " % z + "".join(row))

    print("\n[拆层输出]")
    for b, _, _ in BANDS:
        tot = sum(stat[(z, b)] for z in range(4))
        if tot == 0:
            continue
        fp, n = render_band(d, ts, b, "Map%03d_BAND_%s.png" % (mid, b))
        print("   %-28s %5d 格  %6.0f KB" % (os.path.basename(fp), n, os.path.getsize(fp) / 1024))
    print("\n输出目录：%s" % OUT)


def cmd_zsplit(mid):
    d, ts, name, _ = load_pair(mid)
    print("[按 z 拆层]")
    for z in range(4):
        fp, n = render_band_z(d, ts, z)
        if n == 0:
            continue
        print("   %-28s %5d 格  %6.0f KB" % (os.path.basename(fp), n, os.path.getsize(fp) / 1024))


def render_band_z(d, ts, z):
    w, h = d["width"], d["height"]
    pl, _ = M.planes(d)
    im = Image.new("RGBA", (w * M.TILE, h * M.TILE), (0, 0, 0, 0))
    n = 0
    for y in range(h):
        for x in range(w):
            t = pl[z][y][x]
            if not M.is_visible(t):
                continue
            M.draw_tile(im, ts, t, x, y)
            n += 1
    os.makedirs(OUT, exist_ok=True)
    fp = os.path.join(OUT, "Map%03d_Z%d.png" % (d.get("_mid", 0), z))
    im.save(fp)
    return fp, n


def cmd_ids(mid):
    """逐 id 把源图块裁出来，拼成对照表（带 id 标注）"""
    d, ts, name, _ = load_pair(mid)
    w, h = d["width"], d["height"]
    pl, _ = M.planes(d)
    counter = collections.Counter()
    for y in range(h):
        for x in range(w):
            for z in range(4):
                t = pl[z][y][x]
                if M.is_visible(t):
                    counter[t] += 1

    print("distinct ids = %d" % len(counter))
    groups = collections.defaultdict(list)
    for t in sorted(counter):
        groups[band_of(t)].append(t)

    CELL = 96          # 每格 96px（48 图块 + 48 文字区）
    COLS = 8
    total = sum(len(v) for v in groups.values())
    rows = (total + COLS - 1) // COLS
    sheet = Image.new("RGBA", (COLS * CELL, max(rows, 1) * CELL), (32, 32, 38, 255))
    dr = ImageDraw.Draw(sheet)
    i = 0
    for b, _, _ in BANDS:
        for t in groups.get(b, []):
            cx, cy = (i % COLS) * CELL, (i // COLS) * CELL
            tile = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
            M.draw_tile(tile, ts, t, 0, 0)
            sheet.alpha_composite(tile, (cx + 24, cy + 4))
            dr.rectangle([cx, cy, cx + CELL - 1, cy + CELL - 1], outline=(90, 90, 100, 255))
            dr.text((cx + 4, cy + 56), "id=%d" % t, fill=(255, 255, 255, 255))
            dr.text((cx + 4, cy + 68), "%s  x%d" % (b, counter[t]), fill=(255, 210, 120, 255))
            slot = {"B": "MAP1", "C": "MAP1", "D": "MAP1", "E": "MAP15"}.get(b, b)
            dr.text((cx + 4, cy + 80), slot, fill=(150, 220, 150, 255))
            i += 1
    os.makedirs(OUT, exist_ok=True)
    fp = os.path.join(OUT, "Map%03d_tile_contact_sheet.png" % mid)
    sheet.save(fp)
    print("对照表 → %s  (%d×%d)" % (fp, sheet.width, sheet.height))

    print("\n逐 id 明细：")
    for b, _, _ in BANDS:
        if not groups.get(b):
            continue
        print("  --- %s (%s) ---" % (b, BAND_NAME[b]))
        for t in groups[b]:
            idx = M.sheet_index_normal(t)
            sx = (math.floor(t / 128) % 2 * 8 + t % 8) * M.TILE
            sy = (math.floor(t % 256 / 8) % 16) * M.TILE
            print("    id=%-5d 槽%-2d 图片=%-8s 源坐标(%4d,%4d)  用量 %5d"
                  % (t, idx, ts.names[idx] or "(空)", sx, sy, counter[t]))


def main():
    a = sys.argv
    mid = int(a[a.index("--map") + 1]) if "--map" in a else 25
    if "--ids" in a:
        cmd_ids(mid)
    elif "--zsplit" in a:
        cmd_zsplit(mid)
    elif "--slots" in a:
        d, ts, name, _ = load_pair(mid)
        for k, v in slot_names(ts).items():
            print("%-3s → %s" % (k, v))
    else:
        cmd_band(mid)


if __name__ == "__main__":
    main()
