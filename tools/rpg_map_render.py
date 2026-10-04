# -*- coding: utf-8 -*-
"""
RPG Maker MV 地图 → 分层 PNG 原型渲染器（研究用，只读 RPG 工程，只写 tools/_preview/）

完全复刻 MV 引擎 rpg_core.js 的绘制规则：
  · Tilemap.prototype._drawNormalTile   （B/C/D/E/A5 普通图块）
  · Tilemap.prototype._drawAutotile     （A1/A2/A3/A4 自动图块 + FLOOR/WALL/WATERFALL 形状表）
  · Tilemap.prototype._drawShadow       （z4 阴影位）
  · Tilemap.prototype._paintTiles       （z0..z3 的 lower/upper 分层顺序）

用法：
  python tools/rpg_map_render.py --audit             # 只统计（★上层块 / 自动图块 / 阴影 / 分层内存）
  python tools/rpg_map_render.py --map 1 --layers    # 渲染单图的分层 PNG
  python tools/rpg_map_render.py --map 5 --merge     # 渲染单图合并 PNG
  python tools/rpg_map_render.py --all-layers        # 全部地图分层渲染（慢）
  python tools/rpg_map_render.py --sheet 2           # 渲染 z2/z3 对比图（判定图层语义）
"""
import json
import os
import sys
import math

from PIL import Image

RPG = r"D:/机甲风暴开发素材合集/机甲风暴2"
DATA = os.path.join(RPG, "data")
IMG_TS = os.path.join(RPG, "img", "tilesets")
OUT = r"D:/jjfbol-cocos/jjfbol-cocos/jjfb/tools/_preview/rpg_maps"

TILE = 48
HALF = TILE // 2

SHEET_ORDER = ["A1", "A2", "A3", "A4", "A5", "B", "C", "D", "E"]

T_A1, T_A2, T_A3, T_A4, T_A5 = 2048, 2816, 4352, 5888, 1536
T_MAX = 8192

FLOOR_AUTOTILE_TABLE = [
    [[2,4],[1,4],[2,3],[1,3]],[[2,0],[1,4],[2,3],[1,3]],
    [[2,4],[3,0],[2,3],[1,3]],[[2,0],[3,0],[2,3],[1,3]],
    [[2,4],[1,4],[2,3],[3,1]],[[2,0],[1,4],[2,3],[3,1]],
    [[2,4],[3,0],[2,3],[3,1]],[[2,0],[3,0],[2,3],[3,1]],
    [[2,4],[1,4],[2,1],[1,3]],[[2,0],[1,4],[2,1],[1,3]],
    [[2,4],[3,0],[2,1],[1,3]],[[2,0],[3,0],[2,1],[1,3]],
    [[2,4],[1,4],[2,1],[3,1]],[[2,0],[1,4],[2,1],[3,1]],
    [[2,4],[3,0],[2,1],[3,1]],[[2,0],[3,0],[2,1],[3,1]],
    [[0,4],[1,4],[0,3],[1,3]],[[0,4],[3,0],[0,3],[1,3]],
    [[0,4],[1,4],[0,3],[3,1]],[[0,4],[3,0],[0,3],[3,1]],
    [[2,2],[1,2],[2,3],[1,3]],[[2,2],[1,2],[2,3],[3,1]],
    [[2,2],[1,2],[2,1],[1,3]],[[2,2],[1,2],[2,1],[3,1]],
    [[2,4],[3,4],[2,3],[3,3]],[[2,4],[3,4],[2,1],[3,3]],
    [[2,0],[3,4],[2,3],[3,3]],[[2,0],[3,4],[2,1],[3,3]],
    [[2,4],[1,4],[2,5],[1,5]],[[2,0],[1,4],[2,5],[1,5]],
    [[2,4],[3,0],[2,5],[1,5]],[[2,0],[3,0],[2,5],[1,5]],
    [[0,4],[3,4],[0,3],[3,3]],[[2,2],[1,2],[2,5],[1,5]],
    [[0,2],[1,2],[0,3],[1,3]],[[0,2],[1,2],[0,3],[3,1]],
    [[2,2],[3,2],[2,3],[3,3]],[[2,2],[3,2],[2,1],[3,3]],
    [[2,4],[3,4],[2,5],[3,5]],[[2,0],[3,4],[2,5],[3,5]],
    [[0,4],[1,4],[0,5],[1,5]],[[0,4],[3,0],[0,5],[1,5]],
    [[0,2],[3,2],[0,3],[3,3]],[[0,2],[1,2],[0,5],[1,5]],
    [[0,4],[3,4],[0,5],[3,5]],[[2,2],[3,2],[2,5],[3,5]],
    [[0,2],[3,2],[0,5],[3,5]],[[0,0],[1,0],[0,1],[1,1]],
]
WALL_AUTOTILE_TABLE = [
    [[2,2],[1,2],[2,1],[1,1]],[[0,2],[1,2],[0,1],[1,1]],
    [[2,0],[1,0],[2,1],[1,1]],[[0,0],[1,0],[0,1],[1,1]],
    [[2,2],[3,2],[2,1],[3,1]],[[0,2],[3,2],[0,1],[3,1]],
    [[2,0],[3,0],[2,1],[3,1]],[[0,0],[3,0],[0,1],[3,1]],
    [[2,2],[1,2],[2,3],[1,3]],[[0,2],[1,2],[0,3],[1,3]],
    [[2,0],[1,0],[2,3],[1,3]],[[0,0],[1,0],[0,3],[1,3]],
    [[2,2],[3,2],[2,3],[3,3]],[[0,2],[3,2],[0,3],[3,3]],
    [[2,0],[3,0],[2,3],[3,3]],[[0,0],[3,0],[0,3],[3,3]],
]
WATERFALL_AUTOTILE_TABLE = [
    [[2,0],[1,0],[2,1],[1,1]],[[0,0],[1,0],[0,1],[1,1]],
    [[2,0],[3,0],[2,1],[3,1]],[[0,0],[3,0],[0,1],[3,1]],
]


def is_visible(t):
    return 0 < t < T_MAX


def is_autotile(t):
    return t >= T_A1


def load(name):
    with open(os.path.join(DATA, name), encoding="utf-8") as f:
        return json.load(f)


_CACHE = {}


def img_of(sheet):
    if sheet not in _CACHE:
        p = os.path.join(IMG_TS, sheet + ".png")
        _CACHE[sheet] = Image.open(p).convert("RGBA") if os.path.exists(p) else None
    return _CACHE[sheet]


class TS:
    """一个 tileset：9 张图 + 8192 长 flags"""

    def __init__(self, d):
        self.id = d["id"]
        self.name = d["name"]
        self.names = [d.get("tilesetNames", [None] * 9)[i] or "" for i in range(9)]
        self.flags = d.get("flags") or []

    def flag(self, tid):
        return self.flags[tid] if 0 <= tid < len(self.flags) else 0

    def is_higher(self, tid):
        return bool(self.flag(tid) & 0x10)      # ★ 画在角色上方

    def is_table(self, tid):
        return T_A2 <= tid < T_A3 and bool(self.flag(tid) & 0x80)

    def sheet(self, idx):
        nm = self.names[idx] if idx < 9 else ""
        return (img_of(nm) if nm else None), nm

    def missing(self):
        return [n for i, n in enumerate(self.names) if n and img_of(n) is None]


def blit_src(canvas, src, sx, sy, w, h, dx, dy):
    if src is None or dx + w <= 0 or dy + h <= 0 or dx >= canvas.width or dy >= canvas.height:
        return
    if sx < 0 or sy < 0 or sx + w > src.width or sy + h > src.height:
        return
    canvas.alpha_composite(src.crop((sx, sy, sx + w, sy + h)), (dx, dy))


def sheet_index_normal(tid):
    """复刻 Tilemap._drawNormalTile 的 setNumber：
       A5(1536..2047) → 4；B/C/D/E → 5 + tid//256（E 只有 idx 8，故 1024 以上无图）"""
    if T_A5 <= tid < T_A1:
        return 4
    return 5 + tid // 256


def draw_normal(canvas, ts, tid, dx, dy):
    idx = sheet_index_normal(tid)
    if idx > 8:
        return
    src, _ = ts.sheet(idx)
    sx = (math.floor(tid / 128) % 2 * 8 + tid % 8) * TILE
    sy = (math.floor(tid % 256 / 8) % 16) * TILE
    blit_src(canvas, src, sx, sy, TILE, TILE, dx, dy)


def draw_autotile(canvas, ts, tid, dx, dy, frame=0):
    table = FLOOR_AUTOTILE_TABLE
    kind = (tid - T_A1) // 48
    shape = (tid - T_A1) % 48
    tx, ty = kind % 8, kind // 8
    bx = by = 0
    set_idx = 0
    is_table = False

    if T_A1 <= tid < T_A2:
        water = [0, 1, 2, 1][frame % 4]
        set_idx = 0
        if kind == 0:
            bx, by = water * 2, 0
        elif kind == 1:
            bx, by = water * 2, 3
        elif kind == 2:
            bx, by = 6, 0
        elif kind == 3:
            bx, by = 6, 3
        else:
            bx = (tx // 4) * 8
            by = ty * 6 + (tx // 2) % 2 * 3
            if kind % 2 == 0:
                bx += water * 2
            else:
                bx += 6
                table = WATERFALL_AUTOTILE_TABLE
                by += frame % 3
    elif T_A2 <= tid < T_A3:
        set_idx, bx, by = 1, tx * 2, (ty - 2) * 3
        is_table = ts.is_table(tid)
    elif T_A3 <= tid < T_A4:
        set_idx, bx, by = 2, tx * 2, (ty - 6) * 2
        table = WALL_AUTOTILE_TABLE
    elif T_A4 <= tid < T_MAX:
        set_idx, bx, by = 3, tx * 2, int((ty - 10) * 2.5 + (0.5 if ty % 2 == 1 else 0))
        if ty % 2 == 1:
            table = WALL_AUTOTILE_TABLE

    src, _ = ts.sheet(set_idx)
    if shape >= len(table):
        return
    t = table[shape]
    for i in range(4):
        qsx, qsy = t[i]
        sx1 = (bx * 2 + qsx) * HALF
        sy1 = (by * 2 + qsy) * HALF
        dx1 = dx + (i % 2) * HALF
        dy1 = dy + (i // 2) * HALF
        if is_table and qsy in (1, 5):
            qsx2 = [0, 3, 2, 1][qsx] if qsy == 1 else qsx
            blit_src(canvas, src, (bx * 2 + qsx2) * HALF, (by * 2 + 3) * HALF, HALF, HALF, dx1, dy1)
            blit_src(canvas, src, sx1, sy1, HALF, HALF // 2, dx1, dy1 + HALF // 2)
        else:
            blit_src(canvas, src, sx1, sy1, HALF, HALF, dx1, dy1)


def draw_tile(canvas, ts, tid, x, y):
    if not is_visible(tid):
        return
    dx, dy = x * TILE, y * TILE
    if is_autotile(tid):
        draw_autotile(canvas, ts, tid, dx, dy)
    else:
        draw_normal(canvas, ts, tid, dx, dy)


def draw_shadow(canvas, bits, x, y):
    if not bits & 0x0F:
        return
    dx, dy = x * TILE, y * TILE
    for i in range(4):
        if bits & (1 << i):
            box = (dx + (i % 2) * HALF, dy + (i // 2) * HALF,
                   dx + (i % 2) * HALF + HALF, dy + (i // 2) * HALF + HALF)
            canvas.alpha_composite(Image.new("RGBA", (HALF, HALF), (0, 0, 0, 128)), box[:2])


def planes(d):
    """返回 z0..z3 与 shadow 的二维数组"""
    w, h = d["width"], d["height"]
    data = d["data"]
    out = []
    for z in range(4):
        out.append([[data[(z * h + y) * w + x] for x in range(w)] for y in range(h)])
    sh = [[data[(4 * h + y) * w + x] for x in range(w)] for y in range(h)]
    return out, sh


def render(d, ts, layers=True):
    """layers=True → 返回 {z: Image}；False → 返回合并后的单张 Image（复刻 MV lower/upper 顺序）"""
    w, h = d["width"], d["height"]
    pl, sh = planes(d)
    if layers:
        out = {}
        for z in range(4):
            if not any(any(r) for r in pl[z]):
                continue
            im = Image.new("RGBA", (w * TILE, h * TILE), (0, 0, 0, 0))
            for y in range(h):
                for x in range(w):
                    draw_tile(im, ts, pl[z][y][x], x, y)
            out[z] = im
        # 阴影单独一层
        if any(any(r) for r in sh):
            im = Image.new("RGBA", (w * TILE, h * TILE), (0, 0, 0, 0))
            for y in range(h):
                for x in range(w):
                    draw_shadow(im, sh[y][x], x, y)
            out["shadow"] = im
        return out

    # ---- 合并：复刻 _paintTiles 的 lower / upper 两趟 ----
    low = Image.new("RGBA", (w * TILE, h * TILE), (0, 0, 0, 0))
    up = Image.new("RGBA", (w * TILE, h * TILE), (0, 0, 0, 0))
    for y in range(h):
        for x in range(w):
            t0, t1, t2, t3 = (pl[z][y][x] for z in range(4))
            s = sh[y][x]
            lower, upper = [], []
            for t in (t0, t1):
                (upper if ts.is_higher(t) else lower).append(t)
            lower.append(-s)
            for t in (t2, t3):
                (upper if ts.is_higher(t) else lower).append(t)
            for t in lower:
                if t < 0:
                    draw_shadow(low, -t, x, y)
                else:
                    draw_tile(low, ts, t, x, y)
            for t in upper:
                draw_tile(up, ts, t, x, y)
    low.alpha_composite(up)
    return {"composite": low}


def audit():
    mi = [x for x in load("MapInfos.json") if x]
    tss = {t["id"]: TS(t) for t in load("Tilesets.json") if t}
    L = []

    def p(s=""):
        L.append(s)

    p("=" * 108)
    p("[A] 分层 / 特殊图块审计（★上层块 = 会画在角色之上，影响「分层导出」是否 100% 忠实）")
    p("=" * 108)
    p(f"{'id':>3} {'名称':<12}{'w×h':>9}{'像素':>12}{'z用':>10}{'自动块':>8}{'★上层':>8}{'z4阴影':>8}  {'分层内存RGBA':>12}")
    tot_mem = 0
    tot_star = 0
    for m in sorted(mi, key=lambda x: x["id"]):
        fn = "Map%03d.json" % m["id"]
        d = load(fn)
        ts = tss.get(d.get("tilesetId"))
        w, h = d["width"], d["height"]
        pl, sh = planes(d)
        zs = [z for z in range(4) if any(any(r) for r in pl[z])]
        star = auto = sc = 0
        for z in range(4):
            for y in range(h):
                for x in range(w):
                    t = pl[z][y][x]
                    if not is_visible(t):
                        continue
                    if is_autotile(t):
                        auto += 1
                    elif ts and ts.is_higher(t):
                        star += 1
        sc = sum(1 for y in range(h) for x in range(w) if sh[y][x] & 0x0F)
        mem = w * TILE * h * TILE * 4 * max(1, len(zs)) / 1048576
        tot_mem += mem
        tot_star += star
        p(f"{m['id']:>3} {m['name']:<12}{f'{w}×{h}':>9}{f'{w*TILE}×{h*TILE}':>12}"
          f"{('z'+','.join(map(str,zs))):>10}{auto:>8}{star:>8}{sc:>8}  {mem:>10.1f} MB")
    p("-" * 108)
    p(f"合计：★上层块 {tot_star} 格；分层 PNG 显存（RGBA，全部层）≈ {tot_mem:.0f} MB")
    p()
    p("[B] 图块集素材缺失检查")
    for tid, ts in sorted(tss.items()):
        if tid > 17:
            continue
        miss = ts.missing()
        if ts.name or any(ts.names):
            p(f"  tileset {tid:>2} {ts.name:<10} 图：{'+'.join(n for n in ts.names if n):<40} 缺失={miss or '无'}")
    p()
    p("[C] 结论提示")
    p("  · ★上层块 = 0 → 「按 z 层各导一张 PNG、Cocos 里从下往上叠」= 与 MV 渲染 100% 一致")
    p("  · ★上层块 > 0 → 需要用 lower/upper 两趟渲染，或把 ★ 块单独出一层")

    txt = "\n".join(L)
    print(txt)
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, "audit.txt"), "w", encoding="utf-8", newline="\n") as f:
        f.write(txt + "\n")
    print("\n[写入] " + os.path.join(OUT, "audit.txt"))


def do_map(mid, layers=True):
    mi = {x["id"]: x for x in load("MapInfos.json") if x}
    tss = {t["id"]: TS(t) for t in load("Tilesets.json") if t}
    d = load("Map%03d.json" % mid)
    ts = tss.get(d.get("tilesetId"))
    name = mi.get(mid, {}).get("name", "?")
    keys = "%s" % ("layers" if layers else "merge")
    os.makedirs(OUT, exist_ok=True)
    res = render(d, ts, layers=layers)
    info = []
    for k, im in res.items():
        tag = f"z{k}" if isinstance(k, int) else str(k)
        fp = os.path.join(OUT, f"Map{mid:03d}_{name}_{tag}_{keys}.png")
        im.save(fp)
        info.append((fp, im.size, os.path.getsize(fp)))
    for fp, sz, by in info:
        print(f"  {os.path.basename(fp):<48} {sz[0]}×{sz[1]}  {by/1024:.0f} KB")
    return info


def main():
    a = sys.argv
    if "--audit" in a:
        audit()
        return
    if "--all-layers" in a or "--all-merge" in a:
        lay = "--all-layers" in a
        for m in sorted(x["id"] for x in load("MapInfos.json") if x):
            print(f"-- Map{m:03d}")
            do_map(m, layers=lay)
        return
    if "--map" in a:
        mid = int(a[a.index("--map") + 1])
        do_map(mid, layers=("--merge" not in a))
        return
    if "--sheet" in a:
        # 输出某张图的 z0..z3 单独平面，用于肉眼判定图层语义
        mid = int(a[a.index("--sheet") + 1]) if a.index("--sheet") + 1 < len(a) else 2
        do_map(mid, layers=True)
        return
    print(__doc__)


if __name__ == "__main__":
    main()
