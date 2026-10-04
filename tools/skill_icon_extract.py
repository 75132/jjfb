# -*- coding: utf-8 -*-
"""从 SkillIcon.plist 图集切出 5 个技能分类图标，并生成标注对照图。

用法:
  python tools/skill_icon_extract.py            # 切图 + 生成对照图
  python tools/skill_icon_extract.py --dry      # 只看解析结果
"""
import os
import re
import sys
import plistlib
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# 图集位置：2026-09-30 按「图标资源不在 resources/，需先移入」从 assets/UI/Skill_icon 移入
UI_DIR = os.path.join(ROOT, "assets", "resources", "SkillIcon")
PLIST = os.path.join(UI_DIR, "SkillIcon.plist")
ATLAS = os.path.join(UI_DIR, "SkillIcon.png")
OUT_DIR = os.path.join(ROOT, "tools", "_preview", "skill_icons")

CATS = {
    "skill_1": "主动学习 · 攻击技能",
    "skill_2": "主动学习 · 被动技能",
    "skill_3": "主动学习 · 自动触发技能",
    "skill_4": "升级概率习得 · 悟性攻击技能",
    "skill_5": "升级概率习得 · 悟性被动技能",
}

RECT_RE = re.compile(r"\{\{(-?\d+),(-?\d+)\},\{(\d+),(\d+)\}\}")


def parse_plist():
    with open(PLIST, "rb") as f:
        data = plistlib.load(f)
    frames = []
    for name, info in data["frames"].items():
        m = RECT_RE.match(info["textureRect"])
        if not m:
            raise ValueError("无法解析 textureRect: %s" % info["textureRect"])
        x, y, w, h = (int(v) for v in m.groups())
        frames.append({
            "name": name,
            "rect": (x, y, x + w, y + h),
            "size": (w, h),
            "rotated": info.get("textureRotated", False),
        })
    # 图集内按 x 排序 = 「从第一个开始」
    frames.sort(key=lambda f: f["rect"][0])
    return frames


def main():
    frames = parse_plist()
    print("图集: %s" % ATLAS)
    for i, f in enumerate(frames, 1):
        print("  第%d个  %-14s rect=%s size=%s rotated=%s"
              % (i, f["name"], f["rect"], f["size"], f["rotated"]))
    if "--dry" in sys.argv:
        return

    atlas = Image.open(ATLAS).convert("RGBA")
    print("图集尺寸: %s (期望 170x34)" % (atlas.size,))
    os.makedirs(OUT_DIR, exist_ok=True)

    tiles = []
    for f in frames:
        key = os.path.splitext(f["name"])[0]
        tile = atlas.crop(f["rect"])
        tile.save(os.path.join(OUT_DIR, key + ".png"))
        tiles.append((key, tile))

    # 标注对照图：2x 放大 + 棋盘底（看清透明区）+ 文字
    SCALE = 3
    CW, CH = 32 * SCALE, 32 * SCALE
    PAD, GAP, LBL = 14, 18, 46
    W = PAD * 2 + len(tiles) * CW + (len(tiles) - 1) * GAP
    H = PAD * 2 + CH + LBL
    sheet = Image.new("RGB", (W, H), (250, 250, 252))
    d = ImageDraw.Draw(sheet)

    for i, (key, tile) in enumerate(tiles):
        x0 = PAD + i * (CW + GAP)
        y0 = PAD
        # 棋盘底
        for yy in range(0, CH, 12):
            for xx in range(0, CW, 12):
                c = (232, 232, 236) if ((xx // 12 + yy // 12) % 2 == 0) else (245, 245, 248)
                d.rectangle([x0 + xx, y0 + yy, x0 + xx + 11, y0 + yy + 11], fill=c)
        big = tile.resize((CW, CH), Image.NEAREST)
        sheet.paste(big, (x0, y0), big)
        d.rectangle([x0, y0, x0 + CW - 1, y0 + CH - 1], outline=(180, 180, 190))
        d.text((x0, y0 + CH + 6), key, fill=(30, 30, 40))
        d.text((x0, y0 + CH + 22), CATS.get(key, "?")[:18], fill=(90, 90, 100))

    out = os.path.join(OUT_DIR, "_cat_sheet.png")
    sheet.save(out)
    print("对照图: %s" % out)
    print("切图: %s/skill_1..5.png" % OUT_DIR)


if __name__ == "__main__":
    main()
