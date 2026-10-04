#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RPG Maker MV 图块容量核算 —— 「每一层最多能放多少个图块？」

引擎公式（rpg_core.js:5012 `Tilemap._drawNormalTile` 与 :5736 `ShaderTilemap._drawNormalTile`，
Canvas 与 WebGL 两版逐字一致，改不了）：
    sx = (floor(t / 128) % 2 * 8 + t % 8) * 48        # 取值 0..720  → 图宽需 >= 768
    sy = (floor(t % 256 / 8) % 16) * 48               # 取值 0..720  → 图高需 >= 768
    B/C/D/E : setNumber = 5 + floor(t / 256)          # t = 0..1023
    A5      : setNumber = 4                           # 仅 t = 1536..1663 不越界
=> B/C/D/E 每层 = 16 列 x 16 行 = 256 格   （图必须 768x768）
=> A5        =  8 列 x 16 行 = 128 格      （图必须 384x768）
=> 一个图块集普通图块总量 = 256*4 + 128 = 1152

用法：
    python tools/rpg_tileset_capacity.py --tilesets      # 全部图块集逐槽核算
    python tools/rpg_tileset_capacity.py --images        # 图集文件尺寸/内容统计
    python tools/rpg_tileset_capacity.py --map 25        # 某地图的引用越界统计
    python tools/rpg_tileset_capacity.py --all
"""
import json
import io
import os
import sys
import collections

try:
    from PIL import Image
except ImportError:
    Image = None

ROOT = r"D:/机甲风暴开发素材合集/机甲风暴2"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "_preview", "rpg_tileset_capacity")

TILE = 48
SLOTS = ["A1", "A2", "A3", "A4", "A5", "B", "C", "D", "E"]
# 普通图块槽的 id 段
NORMAL_RANGE = {
    "B": (0, 256),
    "C": (256, 512),
    "D": (512, 768),
    "E": (768, 1024),
    "A5": (1536, 2048),
}
# 自动图块槽的 id 段（kind 连续编号，kind = (t - 2048) / 48）
AUTO_RANGE = {
    "A1": (2048, 2816),
    "A2": (2816, 4352),
    "A3": (4352, 5888),
    "A4": (5888, 8192),
}
# 官方标称图规格
NOMINAL = {
    "A1": (768, 576, "自动图块（动画）"),
    "A2": (768, 576, "自动图块（地面/地面型）"),
    "A3": (768, 384, "自动图块（建筑墙面）"),
    "A4": (768, 720, "自动图块（墙壁/桌面）"),
    "A5": (384, 768, "普通图块 x128"),
    "B": (768, 768, "普通图块 x256"),
    "C": (768, 768, "普通图块 x256"),
    "D": (768, 768, "普通图块 x256"),
    "E": (768, 768, "普通图块 x256"),
}


def normal_cells(base, width, height):
    """返回该 id 段每个格在 MV 公式下的 (tile_id, sx, sy, col, row, 是否在图内)"""
    rows = []
    for t in range(base, base + 256):
        sx = ((t // 128) % 2 * 8 + t % 8) * TILE
        sy = ((t % 256 // 8) % 16) * TILE
        inside = (sx + TILE <= width) and (sy + TILE <= height)
        rows.append((t, sx, sy, sx // TILE, sy // TILE, inside))
    return rows


def image_info(path):
    if Image is None or not os.path.exists(path):
        return None
    im = Image.open(path).convert("RGBA")
    w, h = im.size
    cols, rows = w // TILE, h // TILE
    filled = 0
    for r in range(rows):
        for c in range(cols):
            sub = im.crop((c * TILE, r * TILE, c * TILE + TILE, r * TILE + TILE))
            if sub.getchannel("A").getextrema()[1] > 0:
                filled += 1
    return {"w": w, "h": h, "cols": cols, "rows": rows, "filled": filled}


def load_tilesets():
    with io.open(os.path.join(ROOT, "data", "Tilesets.json"), encoding="utf-8") as f:
        return json.load(f)


def cmd_tilesets(only=None):
    ts = load_tilesets()
    total_used = 0
    lines = []
    lines.append("=" * 100)
    lines.append("RPG Maker MV 图块容量核算 —— 逐图块集 / 逐槽")
    lines.append("=" * 100)
    lines.append("")

    for i, t in enumerate(ts):
        if not t:
            continue
        names = t["tilesetNames"]
        if only is not None and i != only:
            continue
        has_any = any(names)
        if not has_any:
            continue

        lines.append("-" * 100)
        lines.append("[%d] %s   mode=%s   flags_len=%d" % (i, t["name"] or "(无名)", t.get("mode"), len(t["flags"])))
        lines.append("  %-4s %-14s %-11s %-9s %-9s %s" % ("槽", "图集文件", "实际尺寸", "标称", "有效格数", "备注"))

        ts_normal_total = 0
        ts_nominal_total = 0
        for k, slot in enumerate(SLOTS):
            nm = names[k]
            nominal_w, nominal_h, note = NOMINAL[slot]
            if slot in NORMAL_RANGE:
                ts_nominal_total += 128 if slot == "A5" else 256
            if not nm:
                extra = ""
                if slot in NORMAL_RANGE:
                    extra = "**空槽 → 白丢 %d 格**" % (128 if slot == "A5" else 256)
                lines.append("  %-4s %-14s %-11s %-9s %-9s %s" % (slot, "(空)", "-", "%dx%d" % (nominal_w, nominal_h), "0", extra))
                continue
            info = image_info(os.path.join(ROOT, "img", "tilesets", nm + ".png"))
            if info is None:
                lines.append("  %-4s %-14s **文件缺失**" % (slot, nm))
                continue
            w, h = info["w"], info["h"]

            if slot in NORMAL_RANGE:
                base, _ = NORMAL_RANGE[slot]
                cells = normal_cells(base, w, h)
                ok = sum(1 for c in cells if c[5])
                # A5 只认 1536..1663（1664+ 的 sx 会跑到 384..720，384 宽的图放不下）
                if slot == "A5":
                    span = 128
                else:
                    span = 256
                usable = min(ok, span)
                if slot == "A5":
                    usable = ok
                ts_normal_total += usable
                flag = ""
                if usable < span:
                    flag = "  ⚠ 图被裁，越界 %d 格" % (span - usable)
                elif w > nominal_w or h > nominal_h:
                    flag = "  ⚠ 图偏大，多出的部分永远画不到"
                lines.append("  %-4s %-14s %-11s %-9s %-9s %s" % (
                    slot, nm, "%dx%d" % (w, h), "%dx%d" % (nominal_w, nominal_h), usable, note + flag))
            else:
                # 自动图块
                lo, hi = AUTO_RANGE[slot]
                kind_lo, kind_hi = (lo - 2048) // 48, (hi - 1 - 2048) // 48
                kinds = kind_hi - kind_lo + 1
                unit = "2x3" if slot in ("A1", "A2") else ("2x2" if slot == "A3" else "2x3")
                lines.append("  %-4s %-14s %-11s %-9s %-9s %s" % (
                    slot, nm, "%dx%d" % (w, h), "%dx%d" % (nominal_w, nominal_h), "%d 个" % kinds,
                    "自动图块 %s，kind %d..%d" % (unit, kind_lo, kind_hi)))

        lines.append("  → 本图块集**普通图块**可用合计 = %d 格（标称上限 %d）" % (ts_normal_total, ts_nominal_total))
        total_used += ts_normal_total
        lines.append("")

    lines.append("=" * 100)
    lines.append("【结论】一个图块集（tileset）的普通图块硬上限 =")
    lines.append("         A5(128) + B(256) + C(256) + D(256) + E(256) = 1152 格")
    lines.append("         一个地图只能用一个图块集 → 单图上限就是 1152 格")
    lines.append("=" * 100)

    txt = "\n".join(lines)
    print(txt)
    os.makedirs(OUT, exist_ok=True)
    with io.open(os.path.join(OUT, "tileset_capacity.txt"), "w", encoding="utf-8", newline="\n") as f:
        f.write(txt)
    return txt


def cmd_images():
    d = os.path.join(ROOT, "img", "tilesets")
    files = sorted(f for f in os.listdir(d) if f.lower().endswith(".png"))
    print("%-16s %-11s %-9s %-9s %s" % ("图集", "尺寸", "格网格", "有内容格", "备注"))
    print("-" * 78)
    recs = []
    for f in files:
        info = image_info(os.path.join(d, f))
        if not info:
            continue
        note = ""
        if info["w"] % TILE or info["h"] % TILE:
            note = "⚠ 不是 48 的整数倍"
        recs.append((f, info, note))
        print("%-16s %-11s %-9s %-9s %s" % (
            f, "%dx%d" % (info["w"], info["h"]),
            "%dx%d" % (info["cols"], info["rows"]), info["filled"], note))
    print()
    print("对比标称：B/C/D/E 应为 768x768（16x16=256），A5 应为 384x768（8x16=128）")
    os.makedirs(OUT, exist_ok=True)
    with io.open(os.path.join(OUT, "images.txt"), "w", encoding="utf-8", newline="\n") as fh:
        for fn, info, note in recs:
            fh.write("%s %dx%d %dx%d filled=%d %s\n" % (fn, info["w"], info["h"], info["cols"], info["rows"], info["filled"], note))


def cmd_map(mid):
    with io.open(os.path.join(ROOT, "data", "Map%03d.json" % mid), encoding="utf-8") as f:
        d = json.load(f)
    w, h = d["width"], d["height"]
    data = d["data"]
    tsid = d["tilesetId"]
    ts = load_tilesets()[tsid]
    names = ts["tilesetNames"]
    print("Map%03d  %dx%d  图块集[%d] %s" % (mid, w, h, tsid, ts["name"] or "(无名)"))
    print()

    # 每个槽的图片尺寸
    sizes = {}
    filled = {}
    for k, slot in enumerate(SLOTS):
        nm = names[k]
        if not nm:
            continue
        info = image_info(os.path.join(ROOT, "img", "tilesets", nm + ".png"))
        if info:
            sizes[slot] = (info["w"], info["h"])
            filled[slot] = info["filled"]

    tiles = collections.Counter()
    for t in data:
        if t:
            tiles[t] += 1

    use = collections.Counter()
    oob = collections.Counter()
    oob_list = []
    for t, n in tiles.items():
        slot = None
        if t in NORMAL_RANGE["A5"] or (1536 <= t < 2048):
            slot = "A5"
        elif t < 1024:
            slot = ["B", "C", "D", "E"][t // 256]
        if slot is None:
            use["<自动图块>"] += n
            continue
        use[slot] += n
        if slot in sizes:
            W, H = sizes[slot]
            sx = ((t // 128) % 2 * 8 + t % 8) * TILE
            sy = ((t % 256 // 8) % 16) * TILE
            if sx + TILE > W or sy + TILE > H:
                oob[slot] += n
                oob_list.append((t, slot, sx, sy, W, H, n))

    print("实际引用（按槽）：")
    for slot in SLOTS:
        if use.get(slot):
            print("  %-4s %6d 格   (图 %s  有内容 %d 格)" % (
                slot, use[slot], "%dx%d" % sizes.get(slot, (0, 0)), filled.get(slot, 0)))
    if use.get("<自动图块>"):
        print("  %-4s %6d 格" % ("A1-A4", use["<自动图块>"]))
    print()
    print("越界引用（画出来是空的）：")
    if not oob_list:
        print("  (无)")
    else:
        for slot, n in oob.items():
            print("  %-4s %6d 格" % (slot, n))
        print("  明细（前 30）：")
        for t, slot, sx, sy, W, H, n in oob_list[:30]:
            print("     id=%-5d [%s] src=(%3d,%3d) 图%dx%d  x%d" % (t, slot, sx, sy, W, H, n))
    print()
    print("去重后的不同图块数：", len(tiles))
    return {"use": dict(use), "oob": dict(oob), "tiles": len(tiles)}


def cmd_all():
    cmd_images()
    print()
    cmd_tilesets()
    print()
    for mid in range(1, 26):
        p = os.path.join(ROOT, "data", "Map%03d.json" % mid)
        if not os.path.exists(p):
            continue
        try:
            cmd_map(mid)
        except Exception as e:
            print("Map%03d 失败: %s" % (mid, e))
        print()


def main():
    a = sys.argv[1:]
    if not a or "--all" in a:
        cmd_all()
    elif "--images" in a:
        cmd_images()
    elif "--tilesets" in a:
        only = None
        if "--id" in a:
            only = int(a[a.index("--id") + 1])
        cmd_tilesets(only)
    elif "--map" in a:
        cmd_map(int(a[a.index("--map") + 1]))
    else:
        print(__doc__)


if __name__ == "__main__":
    main()
