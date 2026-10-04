#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
工程包（.tsproj）独立复算 —— 不依赖浏览器，直接用 zipfile/PIL 拆包验真。

产物来源：web/_e2e_proj.html 跑出来的
    out/_e2e_proj_test.tsproj      （源图 = 本地素材）
    out/_e2e_proj_test_2.tsproj    （源图 = 从上一个包继承）

验什么：
  · 包结构是 zip，成员齐全（project.json / source.png / preview.png / flags.txt / manifest.json）
  · 包内 source.png 与原素材**逐字节一致**（源图真的打进去了，不是记个路径）
  · project.json 的 state 能自洽：每格 src/tf/tag/blk 结构完整
  · flags.txt 8192 项，且与「按 tag 独立重算」的通行表完全一致
  · preview.png 是真 PNG、边长被压到 320 以内
"""
from __future__ import annotations

import io
import json
import os
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
MAPSRC = r"D:\机甲风暴开发素材合集\制作进行素材\地图素材"

PASS = 0
FAIL = 0


def check(name, cond, extra=""):
    global PASS, FAIL
    if cond:
        PASS += 1
        print("  [OK]   " + name + (("  " + str(extra)) if extra else ""))
    else:
        FAIL += 1
        print("  [FAIL] " + name + (("  " + str(extra)) if extra else ""))


def main():
    try:
        from PIL import Image
    except Exception:
        Image = None

    def find_pkg(stem):
        """新口径「每工程一个文件夹」优先：out/<名>/<名>.tsproj；兼容老口径 out/<名>.tsproj"""
        new = os.path.join(OUT, stem, stem + ".tsproj")
        old = os.path.join(OUT, stem + ".tsproj")
        return new if os.path.isfile(new) else old

    p1 = find_pkg("_e2e_proj_test")
    p2 = find_pkg("_e2e_proj_test_2")
    src = os.path.join(MAPSRC, "map1_7x6.png")

    print("=" * 68)
    print("  工程包独立复算（PIL/zipfile，不看前端代码）")
    print("=" * 68)

    if not os.path.isfile(p1):
        check("产物存在 %s" % p1, False, "先跑 web/_e2e_proj.html")
        print("\n  通过 %d　失败 %d" % (PASS, FAIL))
        return 2
    if not os.path.isfile(src):
        check("素材存在 %s" % src, False)
        print("\n  通过 %d　失败 %d" % (PASS, FAIL))
        return 2

    raw_src = open(src, "rb").read()

    # ---------------- 包 1 ----------------
    print("\n[1] %s" % os.path.basename(p1))
    with zipfile.ZipFile(p1) as z:
        names = z.namelist()
        check("是合法 zip", True, "%d 个成员" % len(names))
        for need in ("project.json", "source.png", "preview.png", "flags.txt",
                     "manifest.json", "README.txt"):
            check("包含 %s" % need, need in names)

        blob_src = z.read("source.png")
        check("★ 包内 source.png 与原素材逐字节一致", blob_src == raw_src,
              "%d / %d bytes" % (len(blob_src), len(raw_src)))

        doc = json.loads(z.read("project.json").decode("utf-8"))
        meta, state = doc.get("meta", {}), doc.get("state", {})

        check("meta.app == TilesetStudio", meta.get("app") == "TilesetStudio", meta.get("app"))
        check("meta 记了源图格数 7×6",
              meta.get("sheet", {}).get("cols") == 7 and meta.get("sheet", {}).get("rows") == 6,
              meta.get("sheet"))
        check("meta.sheet.name == map1_7x6.png", meta.get("sheet", {}).get("name") == "map1_7x6.png")

        out = state.get("out", {})
        check("state 含 5 个槽", all(k in out for k in ("A5", "B", "C", "D", "E")), list(out.keys()))
        cells_B = [c for c in out.get("B", []) if c]
        cells_C = [c for c in out.get("C", []) if c]
        check("B 槽有格子", len(cells_B) >= 4, "%d 格" % len(cells_B))
        check("C 槽有格子", len(cells_C) >= 4, "%d 格" % len(cells_C))
        bad = [i for i, c in enumerate(cells_B)
               if not (isinstance(c.get("src", {}).get("index"), int)
                       and c.get("tf") in ("none", "h", "v", "hv"))]
        check("B 每格结构完整（src.index 是整数 / tf 合法）", not bad, bad[:5])
        check("B 里存在被镜像过的格子", any(c.get("tf") != "none" for c in cells_B))
        check("至少一格带块信息 blk", any(c.get("blk") for c in cells_B))
        check("src.index 全在源图范围内（0..41）",
              all(0 <= c["src"]["index"] < 42 for c in cells_B + cells_C))

        # ---- flags 独立重算 ----
        flags_txt = z.read("flags.txt").decode("utf-8").strip().split("\n")
        check("flags.txt = 8192 项", len(flags_txt) == 8192, len(flags_txt))
        SLOT_BASE = {"A5": 1536, "B": 0, "C": 256, "D": 512, "E": 768}
        PASSABLE = {"ground", "road", "plant_p", "over", "none"}
        UPPER = {"over"}
        mine = [0] * 8192
        for sid, arr in out.items():
            base = SLOT_BASE.get(sid)
            if base is None:
                continue
            for i, c in enumerate(arr):
                if not c:
                    continue
                t = c.get("tag", "none")
                v = 0
                if t not in PASSABLE:
                    v |= 0x000F
                if t in UPPER:
                    v |= 0x0010
                mine[base + i] = v
        got = [int(x) for x in flags_txt]
        diff = sum(1 for a, b in zip(mine, got) if a != b)
        check("★ flags.txt == 按 tag 独立重算的通行表", diff == 0, "不符 %d 项" % diff)

        rd = z.read("README.txt").decode("utf-8")
        check("README.txt 写清了源图名和导入方法",
              "map1_7x6.png" in rd and "开工程" in rd and ".tsproj" in rd)

        man = json.loads(z.read("manifest.json").decode("utf-8"))
        n_man = sum(len(v.get("cells", [])) for v in man.get("slots", {}).values())
        n_state = sum(1 for arr in out.values() for c in arr if c)
        check("manifest 条目数 == state 格子数", n_man == n_state, "%d / %d" % (n_man, n_state))

        if Image is not None:
            im = Image.open(io.BytesIO(z.read("preview.png")))
            check("preview.png 是真 PNG", im.format == "PNG", im.format)
            check("preview 已压到 ≤320px", max(im.size) <= 320, im.size)
        else:
            check("PIL 可用（跳过 preview 校验）", False, "PIL 缺失")

    # ---------------- 包 2：源图来自工程包 ----------------
    print("\n[2] %s（源图继承，不是本地路径）" % os.path.basename(p2))
    if os.path.isfile(p2):
        with zipfile.ZipFile(p2) as z:
            d2 = json.loads(z.read("project.json").decode("utf-8"))
            check("meta.sheet.origin 以 proj: 开头",
                  str(d2["meta"]["sheet"].get("origin", "")).startswith("proj:"),
                  d2["meta"]["sheet"].get("origin"))
            check("★ 继承来的 source.png 仍与原素材逐字节一致", z.read("source.png") == raw_src)
            check("state 也在", bool(d2.get("state", {}).get("out")))
    else:
        check("第二个包存在", False, p2)

    print("\n" + "=" * 68)
    print("  通过 %d　失败 %d" % (PASS, FAIL))
    print("=" * 68)
    return 0 if FAIL == 0 else 2


if __name__ == "__main__":
    sys.exit(main())
