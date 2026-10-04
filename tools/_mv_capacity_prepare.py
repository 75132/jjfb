# -*- coding: utf-8 -*-
"""生成 RPG Maker MV「图块槽扩容」实测包 → D:\\_mv_capacity_test

验证三件事（引擎公式说"不行"，但编辑器行为要实测）：
  (1) A2 图做成 768x1152（8 列 x 8 行单元）→ 编辑器能不能给出第 5-8 行的 tileId？
      预期：kind 只到 47，48+ 落在 A3 段 → 要么不可选，要么错位成 A3
  (2) A5 图做成 768x768（16 列）→ 能不能突破官方 128 格（384 宽 = 8 列）？
  (3) B  图做成 768x1536（32 行）→ 第 17-32 行给不给 id（_drawNormalTile 的 %16 写死）

用法：python tools/_mv_capacity_prepare.py
然后双击 D:\\_mv_capacity_test\\RUN_TEST.bat
"""
import io
import json
import os
import shutil
import sys

from PIL import Image, ImageDraw, ImageFont

NEWDATA = r"D:\Program Files (x86)\KADOKAWA\RPGMV\NewData"
EXE = r"D:\Program Files (x86)\KADOKAWA\RPGMV\RPGMV.exe"
DEST = r"D:\_mv_capacity_test"
TSID = 2  # NewData 里只有 0-6，用「外观」(Outside) 当测试位（独立副本，覆盖无妨）

GREEN = (58, 138, 58)
RED = (168, 48, 48)
BLUE = (48, 96, 170)
ORANGE = (176, 110, 40)


def font(size):
    for p in (r"C:/Windows/Fonts/msyh.ttc", r"C:/Windows/Fonts/simhei.ttf"):
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                pass
    return ImageFont.load_default()


def grid_image(path, cols, rows, cw, ch, color_a, color_b, split_c, split_r,
               label_start, label_step, prefix, title_lines):
    """画一张"编号色块矩阵"图：前半区 color_a（合法），后半区 color_b（超限）。"""
    W, H = cols * cw, rows * ch
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    f = font(max(10, min(cw, ch) // 5))
    for r in range(rows):
        for c in range(cols):
            over = (r >= split_r) or (c >= split_c)
            col = color_b if over else color_a
            x0, y0 = c * cw, r * ch
            d.rectangle([x0, y0, x0 + cw - 1, y0 + ch - 1],
                        fill=col + (255,), outline=(250, 250, 250, 200), width=1)
            if cw >= 48 and ch >= 48:
                n = label_start + (r * cols + c) * label_step
                d.text((x0 + 4, y0 + 3), "%s%d" % (prefix, n),
                       fill=(255, 255, 255, 255), font=f)
    im.save(path)
    return W, H


def build():
    if os.path.exists(DEST):
        print("清空旧目录 …")
        shutil.rmtree(DEST, ignore_errors=True)
    print("拷贝 NewData → %s" % DEST)
    shutil.copytree(NEWDATA, DEST)

    tsdir = os.path.join(DEST, "img", "tilesets")

    # --- (1) A2 = 768x1152 → 8 列 x 8 行「单元」（每单元 96x144） ---
    a2 = os.path.join(tsdir, "Test_A2.png")
    W = grid_image(a2, 8, 8, 96, 144, GREEN, RED, 8, 4, 16, 1, "kind ",
                   ["A2 测试：8 列 x 8 行单元，每单元 96x144",
                    "上 4 行 = kind 16-47（合法）  下 4 行 = kind 48-79（落到 A3 段，看能不能选）"])

    # --- (2) A5 = 768x768 → 16 列 x 16 行（官方只有 8 列 x 16 行 = 128） ---
    a5 = os.path.join(tsdir, "Test_A5.png")
    grid_image(a5, 16, 16, 48, 48, GREEN, RED, 8, 16, 1536, 1, "",
               ["A5 测试：16 列 x 16 行 = 256 格",
                "左 8 列 = id 1536-1663 官方 128 格  右 8 列 = 超限（看能不能选）"])

    # --- (3) B = 768x1536 → 16 列 x 32 行（官方 16x16 = 256） ---
    b = os.path.join(tsdir, "Test_B.png")
    grid_image(b, 16, 32, 48, 48, GREEN, RED, 16, 16, 0, 1, "",
               ["B 测试：16 列 x 32 行 = 512 格",
                "上 16 行 = id 0-255（合法）  下 16 行 = 超限（引擎 %16 取不到，看编辑器给不给）"])

    # --- 对照组 C = 768x768 标准 ---
    c = os.path.join(tsdir, "Test_C.png")
    grid_image(c, 16, 16, 48, 48, BLUE, BLUE, 16, 16, 0, 1, "", ["对照"])

    # --- 改 Tilesets.json：把 [20] 挂上测试图 ---
    tsp = os.path.join(DEST, "data", "Tilesets.json")
    ts = json.load(io.open(tsp, encoding="utf-8"))
    t = ts[TSID]
    names = list(t["tilesetNames"])
    names[1] = "Test_A2"       # A2
    names[4] = "Test_A5"       # A5
    names[5] = "Test_B"        # B
    names[6] = "Test_C"        # C
    t["tilesetNames"] = names
    t["name"] = "容量测试"
    t["mode"] = 1
    if len(t["flags"]) < 8192:
        t["flags"] = t["flags"] + [0] * (8192 - len(t["flags"]))
    json.dump(ts, io.open(tsp, "w", encoding="utf-8", newline="\n"),
              ensure_ascii=False, indent=2)
    print("tileset[%d] → %s" % (TSID, names))

    # --- 铺一张演示地图：Map001 用 tileset 20，把 A2 的 32 个 kind 间隔摆开 ---
    mp = os.path.join(DEST, "data", "Map001.json")
    m = json.load(io.open(mp, encoding="utf-8"))
    w, h, D = m["width"], m["height"], m["data"]
    m["tilesetId"] = TSID
    m["displayName"] = "容量测试"

    def put(x, y, t, z=3):
        if 0 <= x < w and 0 <= y < h:
            D[(z * h + y) * w + x] = t

    # A2 的 32 个 kind，间隔一格摆，避免自动拼接
    for r in range(4):
        for cc in range(8):
            kind = 16 + r * 8 + cc
            put(cc * 2 + 1, r * 2 + 1, 2048 + kind * 48)
    # A5 前几个
    for i in range(8):
        put(i + 1, h - 2, 1536 + i)
    json.dump(m, io.open(mp, "w", encoding="utf-8", newline="\n"),
              ensure_ascii=False, indent=2)
    print("Map001 %dx%d 用 tileset %d，已摆 A2 的 32 个 kind" % (w, h, TSID))

    # --- RUN_TEST.bat ---
    bat = os.path.join(DEST, "RUN_TEST.bat")
    with io.open(bat, "w", encoding="gbk", newline="\r\n") as f:
        f.write("@echo off\r\n")
        f.write("start \"\" \"%s\" \"%s\\Game.rpgproject\"\r\n" % (EXE, DEST))
    print("RUN_TEST.bat → %s" % bat)

    print()
    print("=" * 70)
    print("看什么：")
    print("  1) 图块面板 → 选 tileset [%d]「容量测试」（原「外观」，已换图）" % TSID)
    print("     · A2 页签：只有 4 行 → 硬上限；出现 8 行 → 可扩（但 id 会落到 A3 段）")
    print("     · A5 页签：只有 8 列 → 硬上限；出现 16 列 → 可扩")
    print("     · B  页签：只有 16 行 → 硬上限；出现 32 行 → 可扩（走空白 id 1024-1535）")
    print("  2) 地图上左上方摆了 A2 的 32 个 kind（间隔摆，不自动拼接）")
    print("=" * 70)


if __name__ == "__main__":
    build()
