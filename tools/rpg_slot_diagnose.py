# -*- coding: utf-8 -*-
"""
RPG Maker MV 图块槽位诊断工具
------------------------------------------------
回答：「每一层（槽位）最多支持多少图块」——把引擎常量、工程实际占用、
以及「跨类挂图导致取图错位」一次性算清并可视化。

口径全部来自 js/rpg_core.js（MV 1.6.1，Canvas :5012 与 WebGL :5736 逐字一致）：
    getAutotileKind(t) = floor((t - 2048) / 48)        <- 每 48 个 id = 1 个单元
    tx = kind % 8 ; ty = floor(kind / 8)
    A2: bx = tx*2 ; by = (ty - 2) * 3
    A3: bx = tx*2 ; by = (ty - 6) * 2
    A4: bx = tx*2 ; by = floor((ty - 10) * 2.5 + (ty % 2 ? 0.5 : 0))
    sx = (bx*2 + qsx) * 24 ; sy = (by*2 + qsy) * 24    <- qsx/qsy 取 0/1

用法：
    python rpg_slot_diagnose.py --report
    python rpg_slot_diagnose.py --image [--img Dungeon_A4]
    python rpg_slot_diagnose.py --all
"""
import os
import sys
import json
import io
import argparse

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = r"D:/机甲风暴开发素材合集/机甲风暴2"
OUT = os.path.join(HERE, "_preview", "rpg_slot")
IMG_TS = os.path.join(ROOT, "img", "tilesets")

SLOTS = ["A1", "A2", "A3", "A4", "A5", "B", "C", "D", "E"]

# ---- 自动图块槽（A1-A4）：单格 = 一组「拼图零件」，不能放独立图块 ----
AUTO = {
    "A1": dict(kind=(0, 15),   cw=96, ch=144, img=(768, 576), grid=(8, 2), table="WATERFALL"),
    "A2": dict(kind=(16, 47),  cw=96, ch=144, img=(768, 576), grid=(8, 4), table="FLOOR"),
    "A3": dict(kind=(48, 79),  cw=96, ch=96,  img=(768, 384), grid=(8, 4), table="WALL"),
    "A4": dict(kind=(80, 127), cw=96, ch=96,  img=(768, 720), grid=(8, 6), table="WALL"),
}
# ---- 普通图块槽（A5 + B/C/D/E）：每格 = 一张 48x48 独立图块 ----
NORMAL = {
    "A5": dict(img=(384, 768), grid=(8, 16),  n=128),
    "B":  dict(img=(768, 768), grid=(16, 16), n=256),
    "C":  dict(img=(768, 768), grid=(16, 16), n=256),
    "D":  dict(img=(768, 768), grid=(16, 16), n=256),
    "E":  dict(img=(768, 768), grid=(16, 16), n=256),
}


def a2_row_y():
    """A2 各行在图上的 y 起点（每行 144px，共 4 行）"""
    ys = []
    for ty in (2, 3, 4, 5):
        by = (ty - 2) * 3
        ys.append((by * 2) * 24)
    return ys


def a4_row_y():
    """A4 各行在图上的 y 起点（行高 144/96 交替，共 6 行）"""
    ys = []
    for ty in (10, 11, 12, 13, 14, 15):
        by = int((ty - 10) * 2.5 + (0.5 if ty % 2 else 0))
        ys.append((by * 2) * 24)
    return ys


def kind_of(tile_id, slot):
    """给槽位 + 单元序号，返回起始 tileId 与 kind"""
    base = {"A1": 2048, "A2": 2816, "A3": 4352, "A4": 5888}[slot]
    k0 = AUTO[slot]["kind"][0]
    return base + k0 * 48, k0


# ---------------- 报告 ----------------
def report():
    print("=" * 78)
    print("一、每个槽位的容量上限（引擎写死，图片做大了也改不了）")
    print("=" * 78)
    print("%-4s %-12s %-6s %-10s %-12s %-8s %s" % (
        "槽", "kind 区间", "单元数", "单元(px)", "标准图", "拼法表", "能放独立图块"))
    print("-" * 78)
    tot_auto = 0
    for s in ("A1", "A2", "A3", "A4"):
        a = AUTO[s]
        n = a["kind"][1] - a["kind"][0] + 1
        tot_auto += n
        print("%-4s %-12s %-6d %-10s %-12s %-8s %s" % (
            s, "%d-%d" % a["kind"], n, "%dx%d" % (a["cw"], a["ch"]),
            "%dx%d" % a["img"], a["table"], "不能（是碎片）"))
    print("-" * 78)
    tot_free = 0
    for s in ("A5", "B", "C", "D", "E"):
        d = NORMAL[s]
        tot_free += d["n"]
        print("%-4s %-12s %-6d %-10s %-12s %-8s %s" % (
            s, "-", d["n"], "48x48", "%dx%d" % d["img"], "-", "能"))
    print("-" * 78)
    print("自动图块单元合计 = %d（放不了独立图块）" % tot_auto)
    print("普通图块格数合计 = %d（A5 128 + B/C/D/E 各 256）  <- 你的翻转图块只能放这里" % tot_free)
    print()
    print("A2 各行 y 起点 :", a2_row_y(), "（行高 144，共 4 行 -> 32 个单元）")
    print("A4 各行 y 起点 :", a4_row_y(), "（行高 144/96 交替，共 6 行 -> 48 个单元）")
    print()
    print("=" * 78)
    print("二、工程内 99 个图块集的槽位占用 / 空余")
    print("=" * 78)
    ts = json.load(io.open(os.path.join(ROOT, "data", "Tilesets.json"), encoding="utf-8"))
    tot_empty_normal = 0
    used_rows = []
    for i, t in enumerate(ts):
        if not t or i < 1:
            continue
        used, empty = [], []
        for k, nm in enumerate(t["tilesetNames"]):
            s = SLOTS[k]
            if nm:
                p = os.path.join(IMG_TS, nm + ".png")
                sz = "%dx%d" % Image.open(p).size if os.path.exists(p) else "缺"
                used.append("%s=%s(%s)" % (s, nm, sz))
            elif s in NORMAL:
                empty.append(s)
        if not used and not empty:
            continue
        if used or empty:
            c = len(empty) * 256 if "A5" not in empty else len(
                [e for e in empty if e != "A5"]) * 256 + 128
            tot_empty_normal += c
            if i <= 20:
                used_rows.append((i, t["name"] or "", " ".join(used), " ".join(empty) or "-", c))
    print("%-4s %-14s %-46s %-14s %s" % ("id", "名称", "已用槽位", "空的普通槽", "空余格数"))
    print("-" * 100)
    for i, nm, u, e, c in used_rows:
        print("%-4d %-14s %-46s %-14s %d" % (i, nm[:12], u[:44], e[:12], c))
    print("-" * 100)
    print("（只列 id<=20；全部 99 个图块集的空余普通槽合计 ≈ %d 格）" % tot_empty_normal)
    return ts


# ---------------- 可视化：跨类挂图的取图错位 ----------------
def font(sz):
    for p in (r"C:/Windows/Fonts/msyh.ttc", r"C:/Windows/Fonts/simhei.ttf",
              r"C:/Windows/Fonts/arial.ttf"):
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, sz)
            except Exception:
                pass
    return ImageFont.load_default()


def offset_image(name="Dungeon_A4"):
    """把一张 A4 类的图分别按「挂在 A2 槽」和「挂在 A4 槽」的规则标注取图区域"""
    src = os.path.join(IMG_TS, name + ".png")
    if not os.path.exists(src):
        print("找不到图:", src)
        return
    im = Image.open(src).convert("RGBA")
    W, H = im.size
    print("%s 尺寸 %dx%d" % (name, W, H))

    def panel(mode):
        c = im.copy()
        d = ImageDraw.Draw(c)
        f = font(14)
        if mode == "A2":
            ys = a2_row_y()
            color = (255, 72, 72, 255)
            cw, nrow = 96, 4
            title = "按 A2 槽规则取图（kind 16-47：%d 个单元）" % (8 * 4)
        else:
            ys = a4_row_y()
            color = (60, 220, 120, 255)
            cw, nrow = 96, 6
            title = "按 A4 槽规则取图（kind 80-127：%d 个单元）" % (8 * 6)
        # 行分割线
        for i, y in enumerate(ys):
            y2 = ys[i + 1] if i + 1 < len(ys) else H
            d.rectangle([0, y, W - 1, y2 - 1], outline=color, width=2)
            # 行内 8 列分割
            for cx in range(1, 8):
                d.line([(cx * cw, y), (cx * cw, y2 - 1)], fill=color[:3] + (120,), width=1)
            d.text((6, y + 4), "row%d  y=%d" % (i + 1, y), fill=color, font=f)
        # 高亮「A2 取不到」的区域（仅 A2 视角）
        if mode == "A2" and H > ys[-1] + 144:
            y0 = ys[-1] + 144
            d.rectangle([0, y0, W - 1, H - 1], fill=(255, 72, 72, 70), outline=(255, 72, 72, 255), width=2)
            d.text((6, y0 + 6), "A2 取不到（y>=%d，剩 %d px）" % (y0, H - y0), fill=(255, 220, 220, 255), font=font(15))
        return c, title

    a2, t2 = panel("A2")
    a4, t4 = panel("A4")

    PAD, TOP = 18, 52
    canvas = Image.new("RGBA", (W * 2 + PAD * 3, H + TOP + PAD), (18, 18, 22, 255))
    d = ImageDraw.Draw(canvas)
    d.text((PAD, 14), "%s  —— 同一张图，挂 A2 槽 vs 挂 A4 槽（红线=A2 只取前 4 行 32 个；绿线=A4 取满 6 行 48 个）" % name,
           fill=(240, 240, 244, 255), font=font(17))
    for idx, (img, ttl) in enumerate(((a2, t2), (a4, t4))):
        x = PAD + idx * (W + PAD)
        canvas.alpha_composite(img, (x, TOP))
        d.rectangle([x - 1, TOP - 1, x + W, TOP + H], outline=(90, 90, 100, 255), width=1)
        d.text((x, TOP + H + 6), ttl, fill=(210, 210, 218, 255), font=font(15))
    os.makedirs(OUT, exist_ok=True)
    fp = os.path.join(OUT, "a2_vs_a4_offset.png")
    canvas.save(fp)
    print("错位对照图 →", fp, canvas.size)


def capacity_chart():
    """各槽容量一览图"""
    W, H = 1080, 580
    c = Image.new("RGBA", (W, H), (20, 20, 24, 255))
    d = ImageDraw.Draw(c)
    d.text((26, 20), "RPG Maker MV 每个槽位的图块容量", fill=(245, 245, 248, 255), font=font(22))
    d.text((26, 52), "一个图块集只有 9 个槽；蓝色=自动图块（放不了独立图块），绿色=普通图块（能放）",
           fill=(160, 160, 168, 255), font=font(14))

    CX = dict(slot=30, cnt=74, ok=132, cell=288, spec=388, bar=512)
    y = 96
    for k, t in (("slot", "槽"), ("cnt", "数量"), ("ok", "能否放独立图块"),
                 ("cell", "每格单元"), ("spec", "标准图规格"), ("bar", "容量占比（满格 256）")):
        d.text((CX[k], y), t, fill=(150, 150, 158, 255), font=font(14))
    y += 26
    d.line([(26, y), (W - 26, y)], fill=(70, 70, 78, 255), width=1)
    y += 10

    rows = []
    for s in ("A1", "A2", "A3", "A4"):
        a = AUTO[s]
        n = a["kind"][1] - a["kind"][0] + 1
        rows.append((s, n, "%dx%d" % (a["cw"], a["ch"]), "%dx%d" % a["img"], "不能（碎片）", False))
    for s in ("A5", "B", "C", "D", "E"):
        dd = NORMAL[s]
        rows.append((s, dd["n"], "48x48", "%dx%d" % dd["img"], "能", True))

    maxn, barw = 256.0, 430
    for s, n, cell, spec, ok, is_normal in rows:
        col = (72, 190, 120, 255) if is_normal else (86, 140, 230, 255)
        d.text((CX["slot"] + 2, y + 2), s, fill=col, font=font(16))
        d.text((CX["cnt"], y + 2), str(n), fill=(235, 235, 240, 255), font=font(16))
        okc = (72, 200, 130, 255) if is_normal else (230, 110, 110, 255)
        d.text((CX["ok"], y + 3), ok, fill=okc, font=font(14))
        d.text((CX["cell"], y + 3), cell, fill=(190, 190, 198, 255), font=font(13))
        d.text((CX["spec"], y + 3), spec, fill=(190, 190, 198, 255), font=font(13))
        bw = int(barw * n / maxn)
        d.rectangle([CX["bar"], y + 2, CX["bar"] + bw, y + 18], fill=col)
        d.text((CX["bar"] + bw + 8, y + 3), "%d" % n, fill=(170, 170, 178, 255), font=font(12))
        y += 26
    d.line([(26, y), (W - 26, y)], fill=(70, 70, 78, 255), width=1)
    y += 10
    d.text((30, y), "自动图块单元", fill=(140, 160, 220, 255), font=font(15))
    d.text((190, y), "128 个 —— 放不了独立图块（每格是 48 个「拼图零件」拼出来的形状）",
           fill=(200, 200, 208, 255), font=font(14))
    y += 26
    d.text((30, y), "普通图块格数", fill=(90, 200, 140, 255), font=font(15))
    d.text((190, y), "1152 个（A5 128 + B/C/D/E 各 256）   <<  你的翻转图块只能放这里",
           fill=(245, 235, 160, 255), font=font(15))
    y += 34
    for line in [
        "A1-A4 没法扩：kind 区间写死在 isTileA1..isTileA4 的 id 段里，图做大了也取不到第 5 行",
        "A2 = 8 列 × 4 行 = 32 个；A4 = 8 列 × 6 行 = 48 个（A4 是自动图块里唯一能到 48 的）",
        "A5 看着有 512 个 id（1536-2047），官方图只有 384 宽 → 实际 128 格",
        "跨类挂图（A4 的图挂 A2 槽）会取图错位：A2 行起点 0/144/288/432，A4 是 0/144/240/384/480/624",
    ]:
        d.text((30, y), "· " + line, fill=(170, 170, 178, 255), font=font(13))
        y += 20
    os.makedirs(OUT, exist_ok=True)
    fp = os.path.join(OUT, "slot_capacity.png")
    c.save(fp)
    print("容量图 →", fp, c.size)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--report", action="store_true")
    ap.add_argument("--image", action="store_true")
    ap.add_argument("--img", default="Dungeon_A4")
    ap.add_argument("--chart", action="store_true")
    a = ap.parse_args()
    if not (a.report or a.image or a.chart):
        a.report = a.image = a.chart = True
    if a.report:
        report()
    if a.chart:
        capacity_chart()
    if a.image:
        offset_image(a.img)


if __name__ == "__main__":
    main()
