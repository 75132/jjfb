#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成「图块容量」实测包 —— 验证编辑器对超规格图块图的处理规则。

要回答的问题：
  Q1  B 的图做成 768x1536（16 列 x 32 行）时，编辑器显示几行？第 17-32 行能选中吗？
      选中后保存到 Map.json 的 tileId 是什么？（0-255 之外？256-511？1024-1535？）
  Q2  A5 的图做成 768x768（而不是官方的 384x768）时，能否用满 256 格？

做法：在 D:\\_mv_tabtest 里新建图块集 [20]「容量测试」
  A5 = TestA5_768   768x768   绿底，编号 0..255
  B  = TestBig_B    768x1536  上半红底 0..255 / 下半蓝底 256..511
  C  = TestBig_C    768x768   橙底，编号 0..255（对照组：标准尺寸长什么样）
并把 Map001 指向该图块集、清空画布。
"""
import io
import json
import os
import shutil

from PIL import Image, ImageDraw

ROOT = r"D:/_mv_tabtest"
TS_DIR = os.path.join(ROOT, "img", "tilesets")
DATA = os.path.join(ROOT, "data")
TILE = 48

FONT_CANDIDATES = [
    r"C:/Windows/Fonts/consola.ttf",
    r"C:/Windows/Fonts/arial.ttf",
    r"C:/Windows/Fonts/msyh.ttc",
]


def get_font(size=15):
    from PIL import ImageFont
    for p in FONT_CANDIDATES:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                pass
    return ImageFont.load_default()


def make_sheet(cols, rows, halves):
    """halves: [(行数, 底色, 起始编号), ...] 从第 0 行开始依次铺"""
    W, H = cols * TILE, rows * TILE
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    font = get_font(15)
    r = 0
    for nrows, color, base in halves:
        for i in range(nrows):
            for c in range(cols):
                idx = base + i * cols + c
                x, y = c * TILE, r * TILE
                d.rectangle([x, y, x + TILE - 1, y + TILE - 1], fill=color, outline=(255, 255, 255, 255))
                d.text((x + 4, y + 15), str(idx), fill=(255, 255, 255, 255), font=font)
            r += 1
    return im


def main():
    os.makedirs(TS_DIR, exist_ok=True)

    jobs = [
        ("TestA5_768.png", 8, 16, [(16, (40, 130, 70, 255), 0)]),        # 8x16=128 ... 这里先做 8 列
        ("TestA5w_768.png", 16, 16, [(16, (30, 150, 90, 255), 0)]),      # 16x16=256，测 A5 能否 768 宽
        ("TestBig_B.png", 16, 32, [(16, (170, 50, 50, 255), 0),
                                   (16, (50, 80, 180, 255), 256)]),
        ("TestBig_C.png", 16, 16, [(16, (200, 130, 40, 255), 0)]),
    ]
    for fn, cols, rows, halves in jobs:
        im = make_sheet(cols, rows, halves)
        p = os.path.join(TS_DIR, fn)
        im.save(p)
        print("  生成 %-20s %dx%d  (%d列 x %d行 = %d 格)" % (fn, im.width, im.height, cols, rows, cols * rows))

    # --- 写入 Tilesets.json ---
    tp = os.path.join(DATA, "Tilesets.json")
    ts = json.load(io.open(tp, encoding="utf-8"))
    entry = {
        "id": 20,
        "mode": 1,
        "name": "容量测试",
        "note": "B=768x1536 超长图 / A5=768x768 超宽图 / C=768x768 标准",
        "tilesetNames": ["", "", "", "", "TestA5w_768", "TestBig_B", "TestBig_C", "", ""],
        "flags": [0] * 8192,
    }
    entry["flags"][0] = 16
    # 补齐长度到 index 20
    while len(ts) <= 20:
        ts.append(None)
    ts[20] = entry
    with io.open(tp, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(ts, fh, ensure_ascii=False, indent=None, separators=(",", ":"))
    print("  Tilesets.json 写入 [20] %s" % entry["name"])

    # --- 把 Map001 指向 [20] 并清空 ---
    mp = os.path.join(DATA, "Map001.json")
    m = json.load(io.open(mp, encoding="utf-8"))
    w, h = 20, 15
    m["width"], m["height"] = w, h
    m["tilesetId"] = 20
    m["data"] = [0] * (w * h * 6)
    m["events"] = []
    with io.open(mp, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(m, fh, ensure_ascii=False, indent=None, separators=(",", ":"))
    print("  Map001.json → tilesetId=20, 清空为 %dx%d" % (w, h))

    # --- RUN_TEST.bat ---
    bat = os.path.join(ROOT, "RUN_TEST.bat")
    with io.open(bat, "w", encoding="gbk", newline="\r\n") as fh:
        fh.write(
            "@echo off\r\n"
            "chcp 936 >nul\r\n"
            "echo ================================================\r\n"
            "echo  RPG Maker MV 图块容量实测（只读工程，随便关）\r\n"
            "echo ================================================\r\n"
            "echo.\r\n"
            "echo  1) 打开「数据库 - 图块集」，选 [20] 容量测试\r\n"
            "echo  2) 打开 Map001，看图块面板\r\n"
            "echo.\r\n"
            "echo  === 请看三件事，记下答案 ===\r\n"
            "echo.\r\n"
            "echo  (Q1) B 页签（红色区 + 蓝色区，共 16x32 格）\r\n"
            "echo       面板里能显示到第几行？蓝色区（256 起）能选中吗？\r\n"
            "echo       把蓝色区左上角那格画到地图 (1,1)，保存\r\n"
            "echo.\r\n"
            "echo  (Q2) A5 页签（绿色，16 列宽）\r\n"
            "echo       能显示 16 列吗？还是只有 8 列？\r\n"
            "echo.\r\n"
            "echo  (Q3) C 页签（橙色，标准 768x768）\r\n"
            "echo       应该是 16 列 x 16 行 = 256 格\r\n"
            "echo.\r\n"
            "echo  3) 保存工程后关掉编辑器，告诉我答案\r\n"
            "echo.\r\n"
            "echo  （看完整个 D:\\_mv_tabtest 目录可直接删除）\r\n"
            "echo ================================================\r\n"
            "pause\r\n"
            'start "" "D:\\Program Files (x86)\\KADOKAWA\\RPGMV\\RPGMV.exe" "%~dp0Game.rpgproject"\r\n'
        )
    print("  RUN_TEST.bat 已更新")
    print()
    print("完成。测试包 → %s" % ROOT)


if __name__ == "__main__":
    main()
