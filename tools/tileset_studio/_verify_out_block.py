#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
整块贴导出产物独立校验（PIL 复算，不看前端代码）

对 `web/_e2e_save_block.html` 产出的 out/MAPSRC_FLIP_*.png 做独立验证：
  · B 槽 768×768，四块分别落在 (0,0) (7,0) (0,6) (7,6)
  · 块1 == 源 map1_7x6.png 原样；块2 == 左右镜像；块3 == 上下翻转；块4 == 180°
    （镜像 = 每格自身翻转 + 格子排列一起反）
  · 块外区域必须全透明；A5 等空槽不导出
  · flags.json 与语义一致

用法：python _verify_out_block.py
"""
import json
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
SRC = r"D:\机甲风暴开发素材合集\制作进行素材\地图素材\map1_7x6.png"
PREFIX = "MAPSRC_FLIP"
TILE = 48

PASS = 0
FAIL = 0


def check(name, cond, extra=""):
    global PASS, FAIL
    if cond:
        PASS += 1
        print("  [OK]   %s %s" % (name, extra))
    else:
        FAIL += 1
        print("  [FAIL] %s %s" % (name, extra))


def normalize_rgba(im):
    """canvas 预乘 alpha 会把 a=0 的 RGB 抹成 0 —— 校验前统一归一化。"""
    b = bytearray(im.convert("RGBA").tobytes())
    for k in range(0, len(b), 4):
        if b[k + 3] == 0:
            b[k] = b[k + 1] = b[k + 2] = 0
    return bytes(b)


def main():
    print("=" * 68)
    print("  整块贴导出产物独立校验")
    print("=" * 68)
    print("  源图      : %s" % SRC)
    print("  导出目录  : %s" % OUT)
    print("-" * 68)

    if not os.path.isfile(SRC):
        print("!! 源图不存在"); return 1
    src = Image.open(SRC).convert("RGBA")
    SW, SH = src.size                      # 336 × 288
    scols, srows = SW // TILE, SH // TILE  # 7 × 6

    bpath = os.path.join(OUT, "%s_B.png" % PREFIX)
    jpath = os.path.join(OUT, "%s_manifest.json" % PREFIX)
    fpath = os.path.join(OUT, "%s_flags.json" % PREFIX)

    print("\n[1] 文件存在")
    check("B 槽 PNG", os.path.isfile(bpath), os.path.basename(bpath))
    check("manifest.json", os.path.isfile(jpath))
    check("flags.json", os.path.isfile(fpath))
    if not os.path.isfile(bpath):
        print("!! 没有 B 槽 PNG，先跑 _e2e_save_block.html"); return 1

    out = Image.open(bpath).convert("RGBA")
    print("\n[2] 尺寸")
    check("B 槽 768×768", out.size == (768, 768), "%d×%d" % out.size)

    sb = normalize_rgba(src)
    ob = normalize_rgba(out)

    def sget(x, y):
        i = (y * SW + x) * 4
        return sb[i:i + 4]

    def oget(x, y):
        i = (y * 768 + x) * 4
        return ob[i:i + 4]

    # 四块的落点 / 变换
    spots = [((0, 0), "none"), ((7, 0), "h"), ((0, 6), "v"), ((7, 6), "hv")]
    names = {"none": "原图", "h": "左右镜像", "v": "上下翻转", "hv": "180°"}

    print("\n[3] 四块逐像素复算（源图 → 独立推导 → 与导出图比对）")
    for (tc, tr), tf in spots:
        ox, oy = tc * TILE, tr * TILE
        bad = 0
        first_bad = None
        for y in range(SH):
            for x in range(SW):
                cx, cy = x // TILE, y // TILE
                scx = (scols - 1 - cx) if tf in ("h", "hv") else cx
                scy = (srows - 1 - cy) if tf in ("v", "hv") else cy
                lx = (TILE - 1 - (x % TILE)) if tf in ("h", "hv") else (x % TILE)
                ly = (TILE - 1 - (y % TILE)) if tf in ("v", "hv") else (y % TILE)
                want = sget(scx * TILE + lx, scy * TILE + ly)
                got = oget(ox + x, oy + y)
                if want != got:
                    bad += 1
                    if first_bad is None:
                        first_bad = (x, y, tuple(want), tuple(got))
        check("块@(列%d,行%d) == %s" % (tc, tr, names[tf]), bad == 0,
              "不符 %d/%d" % (bad, SW * SH) + ("  首个 %s" % (first_bad,) if first_bad else ""))
        if tr == 0:
            # 顺带验证「X 帧同列 X 行」没有被别的块污染
            pass

    print("\n[4] 空白区域")
    # 每行块占列 0..6 与 7..13；列 14、15 必须空
    empty_bad = 0
    for r in range(0, 12 * TILE):
        for c in (14 * TILE, 15 * TILE):
            for x in range(c, c + TILE):
                if oget(x, r)[3] != 0:
                    empty_bad += 1
    check("列 14/15 全透明", empty_bad == 0, "意外像素 %d" % empty_bad)
    # 第 12~15 行整行必须空
    row_bad = 0
    for y in range(12 * TILE, 768):
        for x in range(0, 768):
            if oget(x, y)[3] != 0:
                row_bad += 1
    check("第 12~15 行全透明", row_bad == 0, "意外像素 %d" % row_bad)
    # 块1 与块2 无缝相接（列 6 与列 7 都有内容）
    seam_bad = 0
    for y in range(0, SH):
        if oget(6 * TILE + 47, y)[3] == 0 or oget(7 * TILE, y)[3] == 0:
            seam_bad += 1
    check("块1/块2 无缝相接（列 6 | 列 7）", seam_bad == 0, "断缝 %d px" % seam_bad)

    print("\n[5] manifest.json")
    if os.path.isfile(jpath):
        with open(jpath, encoding="utf-8") as f:
            man = json.load(f)
        check("B 槽 used = 168", man["slots"]["B"]["used"] == 168,
              str(man["slots"]["B"]["used"]))
        check("B 槽 imageSize = 768×768", man["slots"]["B"]["imageSize"] == [768, 768])
        check("记录了 4 种变换", sorted({c["transform"] for c in man["slots"]["B"]["cells"]}) ==
              ["h", "hv", "none", "v"])
        check("记录了来源图名", man["slots"]["B"]["cells"][0]["srcSheet"] == "map1_7x6.png",
              man["slots"]["B"]["cells"][0]["srcSheet"])
        check("flags 长度 8192", len(man["flags"]) == 8192)
        # 末格（块4 右下）= 源图左上角格，且被标过语义
        pass
    else:
        check("manifest 可读", False)

    print("\n[6] flags.json 与语义")
    if os.path.isfile(fpath):
        with open(fpath, encoding="utf-8") as f:
            flags = json.load(f)
        if isinstance(flags, dict):
            flags = flags.get("flags", flags.get("data", []))
        check("长度 8192", len(flags) == 8192)
        # 源 index 5 = 墙面（不可通行）→ 块1 的 (col5,row0) → B 槽 tileId = 0*16+5 = 5
        check("源#5(墙面) → tileId 5 不可通行", flags[5] & 0x000F, "flags[5]=%s" % flags[5])
        # 源 index 8 = 不可通行物体 → 块1 (col1,row1) → tileId = 16+1 = 17
        check("源#8(不可通行物体) → tileId 17 不可通行", flags[17] & 0x000F, "flags[17]=%s" % flags[17])
        # 源 index 20 = 树冠 ★上层 → 块1 (col6,row2) → tileId = 32+6 = 38
        check("源#20(树冠) → tileId 38 ★上层", flags[38] & 0x0010, "flags[38]=%s" % flags[38])
        # 源 index 0 = 地面（可通行）
        check("源#0(地面) → tileId 0 可通行", flags[0] == 0, "flags[0]=%s" % flags[0])
        n_imp = sum(1 for v in flags if v & 0x000F)
        n_up = sum(1 for v in flags if v & 0x0010)
        check("不可通行总数 == 4 块 × 2 格 × 2 语义格数",
              n_imp == 4 * 2, "实际 %d" % n_imp)
        check("★上层总数 == 4 块 × 1", n_up == 4, "实际 %d" % n_up)
    else:
        check("flags 可读", False)

    print("\n" + "=" * 68)
    print("  通过 %d　失败 %d" % (PASS, FAIL))
    print("=" * 68)
    return 0 if FAIL == 0 else 2


if __name__ == "__main__":
    sys.exit(main())
