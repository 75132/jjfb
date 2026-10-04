# -*- coding: utf-8 -*-
"""
技能特效 GIF → Cocos 帧序列（resources/Skill）
规格（用户 2026-09-30 确认）：
  - 源  : JJFB-Project/JJFBpojie/jjfb_成品汇总/特效导出/导出结果/gif/*.gif  （24 个）
  - 放大: 硬边缘（NEAREST）× 2
  - 画布: **不扩展**（输出尺寸 = 原帧 ×2，不补边、不加锚点偏移）
  - 落位: assets/resources/Skill/{短名}-{k}.png
  - 命名: 短技能名（buff / leiting / zhaqu …，即 xg1/xg2 的技能 id）
用法:
  python skill_gif_port.py --dry      # 演练，不写盘
  python skill_gif_port.py --apply    # 写盘
"""
import os
import re
import sys
import json
import uuid

from PIL import Image

GIF_DIR = r"D:/jjfbol-cocos/JJFB-Project/JJFBpojie/jjfb_成品汇总/特效导出/导出结果/gif"
DEST_DIR = r"D:/jjfbol-cocos/jjfbol-cocos/jjfb/assets/resources/Skill"

SCALE = 2
NAME_RE = re.compile(r"^xg\d+\.mrp__files_gunz__(.+)_xg\d+\.gif$", re.I)

META_TMPL = """{{
  "ver": "1.0.27",
  "importer": "image",
  "imported": false,
  "uuid": "{uid}",
  "files": [],
  "subMetas": {{}},
  "userData": {{
    "type": "sprite-frame",
    "hasAlpha": true,
    "fixAlphaTransparencyArtifacts": false
  }}
}}
"""


def parse_short(fname: str):
    m = NAME_RE.match(fname)
    return m.group(1) if m else None


def build_frame(gif_path: str, idx: int) -> Image.Image:
    """取第 idx 帧 → 最近邻 ×2。不扩展画布。"""
    im = Image.open(gif_path)
    im.seek(idx)
    fr = im.convert("RGBA")
    w, h = int(round(fr.width * SCALE)), int(round(fr.height * SCALE))
    return fr.resize((w, h), Image.NEAREST)


def main():
    dry = "--apply" not in sys.argv

    if not os.path.isdir(GIF_DIR):
        print("源目录不存在:", GIF_DIR)
        return 1
    if not os.path.isdir(DEST_DIR):
        print("目标目录不存在:", DEST_DIR)
        return 1

    gifs = sorted(f for f in os.listdir(GIF_DIR) if f.lower().endswith(".gif"))
    plan = []
    unknown = []
    for f in gifs:
        short = parse_short(f)
        if not short:
            unknown.append(f)
            continue
        im = Image.open(os.path.join(GIF_DIR, f))
        n = getattr(im, "n_frames", 1)
        durs = []
        sizes = set()
        for i in range(n):
            im.seek(i)
            durs.append(im.info.get("duration", 0) or 0)
            sizes.add(im.convert("RGBA").size)
        plan.append({
            "gif": f, "short": short, "frames": n,
            "src_size": im.size, "out_size": (im.size[0] * SCALE, im.size[1] * SCALE),
            "durs": durs, "size_set": sorted(sizes),
        })

    # 重名检查
    seen = {}
    dup = []
    for p in plan:
        if p["short"] in seen:
            dup.append((p["short"], seen[p["short"]], p["gif"]))
        seen[p["short"]] = p["gif"]
    # 源帧尺寸是否在动画内一致（不一致会导致输出抖动）
    jitter = [p for p in plan if len(p["size_set"]) > 1]

    print(f"{'技能':<18}{'源gif':<46}{'帧':>4}{'源尺寸':>10}{'输出尺寸':>12}  延时")
    print("-" * 108)
    total = 0
    for p in plan:
        total += p["frames"]
        d0 = p["durs"][0] if p["durs"] else 0
        same = "统一" if len(set(p["durs"])) == 1 else f"混合{set(p['durs'])}"
        print(f"{p['short']:<18}{p['gif']:<46}{p['frames']:>4}"
              f"{str(p['src_size']):>10}{str(p['out_size']):>12}  {d0}ms({same})")
    print("-" * 108)
    print(f"技能 {len(plan)} 个 | 帧合计 {total} | 模式: {'演练(未写盘)' if dry else '已写盘'}")
    if dup:
        print("!! 短名重复:", dup)
    if jitter:
        print("!! 动画内尺寸不一致:", [p["short"] for p in jitter])
    if unknown:
        print("!! 未能解析短名的文件:", unknown)

    if dry:
        return 0

    written = 0
    for p in plan:
        src = os.path.join(GIF_DIR, p["gif"])
        for k in range(p["frames"]):
            img = build_frame(src, k)
            out_png = os.path.join(DEST_DIR, f"{p['short']}-{k}.png")
            img.save(out_png)
            meta = META_TMPL.format(uid=str(uuid.uuid4()))
            with open(out_png + ".meta", "w", encoding="utf-8", newline="\n") as fp:
                fp.write(meta)
            written += 2

    # 汇总表
    rep = os.path.join(DEST_DIR, "_skill_frames_report.json")
    with open(rep, "w", encoding="utf-8") as fp:
        json.dump([{k: (list(v) if isinstance(v, tuple) else v) for k, v in p.items()}
                   for p in plan], fp, ensure_ascii=False, indent=1)
    print(f"写出文件 {written} 个 → {DEST_DIR}")
    print(f"清单 → {rep}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
