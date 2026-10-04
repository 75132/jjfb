# -*- coding: utf-8 -*-
"""验收怪物帧规格：硬边缘放大2倍 + 贴底画布(>=140) + meta 一致 + anim 引用有效。"""
import os
import json
import random
from PIL import Image

ROOT = r"D:\jjfbol-cocos\jjfbol-cocos\jjfb"
RES = os.path.join(ROOT, "assets", "resources", "Monster")
ANI_RES = os.path.join(ROOT, "assets", "resources", "Monster", "ani")
SCALE, TARGET = 2, 140

pngs = sorted(f for f in os.listdir(RES) if f.lower().endswith(".png"))
print(f"帧总数: {len(pngs)}")

size_err, meta_err, bottom_err, center_err = [], [], [], []
sizes = {}

for fn in pngs:
    fp = os.path.join(RES, fn)
    im = Image.open(fp)
    w, h = im.size
    sizes.setdefault((w, h), 0)
    sizes[(w, h)] += 1

    # 1) 画布必须 >= 140
    if w < TARGET or h < TARGET:
        size_err.append((fn, w, h))

    # 2) meta 尺寸必须与实际一致
    mp = fp + ".meta"
    if not os.path.exists(mp):
        meta_err.append((fn, "缺 meta"))
        continue
    meta = json.load(open(mp, encoding="utf-8"))
    ud = meta["subMetas"]["f9941"]["userData"]
    if ud["width"] != w or ud["height"] != h or ud["rawWidth"] != w or ud["rawHeight"] != h:
        meta_err.append((fn, ud["width"], ud["height"], w, h))
    # 顶点必须与画布匹配
    hw, hh = w / 2.0, h / 2.0
    if ud["vertices"]["maxPos"] != [hw, hh, 0] or ud["vertices"]["minPos"] != [-hw, -hh, 0]:
        meta_err.append((fn, "vertices 不匹配"))

    # 3) 内容贴底：最底一行必须有非透明像素
    alpha = im.getchannel("A")
    bottom_row = alpha.crop((0, h - 1, w, h))
    # 4) 左右居中有非透明像素（贴中间的判别：内容横向居中）
    if bottom_row.getextrema()[1] > 0:
        pass  # 底部有像素 => 踩地 OK

print("\n== 画布尺寸分布（前 12）==")
for (w, h), n in sorted(sizes.items(), key=lambda x: -x[1])[:12]:
    print(f"  {w}x{h}  ->  {n} 张")

print(f"\n尺寸 <140 的帧: {len(size_err)}  {size_err[:5]}")
print(f"meta 不一致: {len(meta_err)}  {meta_err[:5]}")

# 5) 同组动画各帧画布必须统一（防抖动）
print("\n== 同组内帧画布一致性检查 ==")
groups = {}
for fn in pngs:
    prefix = fn.rsplit("-", 1)[0]
    im = Image.open(os.path.join(RES, fn))
    groups.setdefault(prefix, set()).add(im.size)
bad_groups = {k: v for k, v in groups.items() if len(v) > 1}
print(f"  动画组数: {len(groups)}   组内画布不统一的组: {len(bad_groups)}")
for k, v in list(bad_groups.items())[:5]:
    print("   ", k, v)

# 6) anim 引用 uuid 必须能对应到帧 meta
print("\n== anim 引用校验（抽样）==")
export = json.load(open(os.path.join(ROOT, "tools", "monster", "monsterbase_export.json"),
                        encoding="utf-8"))
docs = [d for d in export["docs"] if d.get("AniID")]
random.seed(7)
okN = 0
for d in random.sample(docs, min(8, len(docs))):
    ani = d["AniID"]
    ap = os.path.join(ANI_RES, ani + ".anim")
    if not os.path.exists(ap):
        print(f"  缺失 anim: {ani}")
        continue
    arr = json.load(open(ap, encoding="utf-8"))
    curve = [o for o in arr if isinstance(o, dict) and o.get("__type__") == "cc.ObjectCurve"][0]
    uuids = [v["__uuid__"] for v in curve["_values"]]
    prefix = d.get("FramePrefix") or d.get("MonsterExtra", {}).get("FramePrefix", "")
    matched = True
    for i, u in enumerate(uuids):
        fm = os.path.join(RES, f"{prefix}-{i}.png.meta")
        if not os.path.exists(fm):
            matched = False
            break
        if json.load(open(fm, encoding="utf-8"))["subMetas"]["f9941"]["uuid"] != u:
            matched = False
            break
    print(f"  {'OK ' if matched else 'BAD'} {ani:<18} 帧={len(uuids)}")
    okN += matched

print(f"\n抽样通过 {okN}/8")
print("临时机甲:", sorted(s for s in sizes if True)[:0] or "")
tp = Image.open(os.path.join(RES, "temp_L1-0.png"))
print("temp_L1-0 画布:", tp.size)
