#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
图块工坊 —— 导出产物独立校验

不依赖浏览器：直接用 PIL 复算 manifest 里声明的「源图块 + 变换」，
与导出的 PNG 逐格逐像素比对。

用法：python _verify_out.py [--dir out] [--prefix MAP1_FLIP]
"""
import argparse
import io
import json
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
TILE = 48
RPG_TS = r"D:\机甲风暴开发素材合集\机甲风暴2\img\tilesets"

PASS = 0
FAIL = 0


def ck(name, cond, extra=""):
    global PASS, FAIL
    if cond:
        PASS += 1
        print("  [OK]   %s %s" % (name, extra))
    else:
        FAIL += 1
        print("  [FAIL] %s %s" % (name, extra))


def transform(im, tf):
    if tf == "h":
        return im.transpose(Image.FLIP_LEFT_RIGHT)
    if tf == "v":
        return im.transpose(Image.FLIP_TOP_BOTTOM)
    if tf == "hv":
        return im.transpose(Image.ROTATE_180)
    return im


def normalize_rgba(im):
    """把全透明像素的 RGB 归零。

    canvas 2D 内部用预乘 alpha，导出往返会把 a=0 的像素 RGB 抹成 0。
    工具端已提前做同样规范化，所以这里对「源图块」也做一次，
    两边才能逐字节比对（可见像素一个都没动）。
    """
    b = bytearray(im.convert("RGBA").tobytes())
    for k in range(0, len(b), 4):
        if b[k + 3] == 0:
            b[k] = b[k + 1] = b[k + 2] = 0
    return bytes(b)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", default=os.path.join(HERE, "out"))
    ap.add_argument("--prefix", default="MAP1_FLIP")
    a = ap.parse_args()

    print("=" * 68)
    print("  图块工坊 · 导出产物独立校验")
    print("=" * 68)
    print("  目录: %s" % a.dir)

    mp = os.path.join(a.dir, a.prefix + "_manifest.json")
    if not os.path.exists(mp):
        print("找不到 manifest：%s" % mp)
        return 1
    man = json.load(io.open(mp, encoding="utf-8"))

    ck("manifest 可读", True, "%d 字节" % os.path.getsize(mp))
    ck("含 5 个槽", len(man["slots"]) == 5, list(man["slots"].keys()))
    ck("flags 长度 8192", len(man["flags"]) == 8192)

    # 源图集缓存
    srccache = {}

    def src_sheet(name):
        if name not in srccache:
            p = os.path.join(RPG_TS, name)
            srccache[name] = Image.open(p).convert("RGBA") if os.path.exists(p) else None
        return srccache[name]

    total_cells = 0
    total_mismatch = 0

    for sid, s in man["slots"].items():
        png = os.path.join(a.dir, a.prefix + "_" + sid + ".png")
        size = tuple(s["imageSize"])
        if not os.path.exists(png):
            if not s["used"]:
                ck("%s 槽为空 → 不导出（符合预期）" % sid, True)
            else:
                ck("%s 槽 PNG 存在" % sid, False, png)
            continue
        im = Image.open(png).convert("RGBA")
        used = s["used"]
        ck("%s 槽 PNG %dx%d" % (sid, size[0], size[1]), im.size == size,
            "实际 %dx%d，%d 格" % (im.width, im.height, used))

        if not used:
            # 空槽必须整张全透明
            ext = im.getchannel("A").getextrema()
            ck("  空槽整张透明", ext[1] == 0, "alpha max=%d" % ext[1])
            continue

        mism = 0        # 归一化后逐字节不符
        alpha_mism = 0  # alpha 通道不符
        checked = 0
        for c in s["cells"]:
            sh = src_sheet(c["srcSheet"])
            if sh is None:
                mism += 1
                continue
            sc, sr = c["srcIndex"] % (sh.width // TILE), c["srcIndex"] // (sh.width // TILE)
            piece = sh.crop((sc * TILE, sr * TILE, sc * TILE + TILE, sr * TILE + TILE))
            piece = transform(piece, c["transform"])
            got = im.crop((c["col"] * TILE, c["row"] * TILE,
                           c["col"] * TILE + TILE, c["row"] * TILE + TILE))
            if normalize_rgba(piece) != normalize_rgba(got):
                mism += 1
            if piece.getchannel("A").tobytes() != got.getchannel("A").tobytes():
                alpha_mism += 1
            checked += 1
        total_cells += checked
        total_mismatch += mism
        ck("  %d 格 alpha 通道逐像素一致" % checked, alpha_mism == 0, "不符 %d 格" % alpha_mism)
        ck("  %d 格 归一化后逐字节 == 源图块+变换" % checked, mism == 0, "不符 %d 格" % mism)

        # 空位必须透明
        filled = set((c["col"], c["row"]) for c in s["cells"])
        holes = 0
        a_ch = im.getchannel("A")
        for r in range(s["rows"]):
            for col in range(s["cols"]):
                if (col, r) in filled:
                    continue
                box = a_ch.crop((col * TILE, r * TILE, col * TILE + TILE, r * TILE + TILE))
                if box.getextrema()[1] > 0:
                    holes += 1
        ck("  未使用格全透明", holes == 0, "%d 个非空格" % holes)

    print()
    print("  合计核验 %d 格，像素不符 %d 格" % (total_cells, total_mismatch))

    # ---- flags ----
    print("\n[flags 通行表]")
    f = man["flags"]
    ck("长度 8192", len(f) == 8192)
    used_ids = []
    for sid, s in man["slots"].items():
        for c in s["cells"]:
            used_ids.append((c["tileId"], c["tag"], c["passable"], c.get("upper")))
    bad = 0
    for tid, tag, passable, upper in used_ids:
        want = 0
        if not passable:
            want |= 0x000F
        if upper:
            want |= 0x0010
        if f[tid] != want:
            bad += 1
    ck("每个图块的 flags 与语义一致", bad == 0, "不符 %d 个 / 共 %d 个" % (bad, len(used_ids)))
    n_imp = sum(1 for v in f if v & 0x000F)
    n_up = sum(1 for v in f if v & 0x0010)
    print("     不可通行 %d 格 / ★上层 %d 格" % (n_imp, n_up))

    # ---- 与源图集交叉：B 槽第 0 格必须是 MAP1 的第 0 格原图 ----
    print("\n[与源图集交叉核验]")
    b = man["slots"]["B"]
    if b["cells"]:
        c0 = b["cells"][0]
        sh = src_sheet(c0["srcSheet"])
        if sh:
            orig = sh.crop((0, 0, TILE, TILE))
            bim = Image.open(os.path.join(a.dir, a.prefix + "_B.png")).convert("RGBA")
            got = bim.crop((0, 0, TILE, TILE))
            ck("B[0] == %s#%d 原图" % (c0["srcSheet"], c0["srcIndex"]),
                normalize_rgba(orig) == normalize_rgba(got))
            if len(b["cells"]) > 1:
                c1 = b["cells"][1]
                want = transform(sh.crop((0, 0, TILE, TILE)), c1["transform"])
                got1 = bim.crop((TILE, 0, 2 * TILE, TILE))
                ck("B[1] == 同一图块的 %s" % c1["transform"],
                    normalize_rgba(want) == normalize_rgba(got1))
            if len(b["cells"]) > 4:
                c4 = b["cells"][4]
                sc4, sr4 = c4["srcIndex"] % (sh.width // TILE), c4["srcIndex"] // (sh.width // TILE)
                want4 = transform(sh.crop((sc4 * TILE, sr4 * TILE, sc4 * TILE + TILE, sr4 * TILE + TILE)), c4["transform"])
                got4 = bim.crop((4 * TILE, 0, 5 * TILE, TILE))
                ck("B[4] == 第 2 个源图块的原图", normalize_rgba(want4) == normalize_rgba(got4))

            # 四张变体互不相同（取一个非对称图块）
            n0 = normalize_rgba(sh.crop((0, 0, TILE, TILE)))
            vs = [normalize_rgba(transform(sh.crop((0, 0, TILE, TILE)), t)) for t in ("none", "h", "v", "hv")]
            uniq = len(set(vs))
            ck("该图块的 4 个变体互不相同", uniq >= 3, "不同变体 %d / 4" % uniq)

    print("\n" + "=" * 68)
    print("  通过 %d  失败 %d" % (PASS, FAIL))
    print("=" * 68)
    return 0 if FAIL == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
