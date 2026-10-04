# -*- coding: utf-8 -*-
"""把「技能特效帧」的尺寸同步进编辑器资源库缓存 `library/`（消除 Rect 超界报错）

背景
----
2026-10-01 修「RPG 特效被裁」时，15 个 clip 的帧画布从 192×192 放大到真实并集尺寸
（最大 1246×696）。帧文件是**原地替换**（uuid 保持不变，因为 `.anim` 与
`RobotShow.prefab` 都按 uuid 引用），但编辑器 `library/` 里仍留着旧尺寸的
spriteFrame 记录：

    [Scene] Rect width exceeds maximum margin: yinliyazhi-8/ 384 192

= `SpriteFrame.checkRect()` 拿 `library` 里的旧 `rect`（384）去比新纹理（192）。
引擎虽然会 `reset()` 自愈，但控制台会刷 169 条红字（用户直接看到就是「报错了」）。

本脚本按**源 `assets/resources/Skill/*.png.meta`** 把 `library/` 里的
spriteFrame 记录与 png 副本对齐（编辑器重新导入时写的也是同一份内容，属幂等补齐）。

用法
----
    python tools/_sync_skill_library_cache.py            # 演练，只报告差异
    python tools/_sync_skill_library_cache.py --apply    # 真正写盘
"""
from __future__ import annotations

import glob
import io
import json
import os
import re
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES_SKILL = os.path.join(ROOT, "assets", "resources", "Skill")
LIBRARY = os.path.join(ROOT, "library")

# RPG 移植的 15 个 clip（其余特效的帧也可能被原地重生成，一并处理更稳）
RPG_CLIPS = [
    "guangrenzhan", "chaonengquan", "leitingzhenshe", "leitingchongji", "lizijiguang",
    "denglizidanmu", "xukongdaodan", "nengliangbaopo", "diancifengbao", "shikongniuqu",
    "yinliyazhi", "denglizipingzhang", "xukongchongji", "shengminghuifu", "nenglianghuifu",
]


def read_json(p):
    with io.open(p, encoding="utf-8") as f:
        return json.load(f)


def write_json(p, d):
    with io.open(p, "w", encoding="utf-8", newline="\n") as f:
        f.write(json.dumps(d, indent=2, ensure_ascii=False) + "\n")


def lib_paths(uuid):
    sub = os.path.join(LIBRARY, uuid[:2])
    return (os.path.join(sub, uuid + ".png"),
            os.path.join(sub, uuid + "@f9941.json"))


def frame_meta_to_content(ud, name, uuid):
    """按编辑器 `library/**@f9941.json` 的既有结构，从源 meta 的 userData 反推 content。"""
    w, h = int(ud.get("width") or 0), int(ud.get("height") or 0)
    return {
        "name": name, "atlas": "",
        "rect": {"x": 0, "y": 0, "width": w, "height": h},
        "offset": {"x": 0, "y": 0},
        "originalSize": {"width": w, "height": h},
        "rotated": False,
        "capInsets": [0, 0, 0, 0],
        "vertices": ud.get("vertices"),
        "texture": uuid + "@6c48a",
        "packable": True, "pixelsToUnit": 100,
        "pivot": {"x": 0.5, "y": 0.5}, "meshType": 0,
    }


def main():
    apply = "--apply" in sys.argv
    clips = sorted(set(RPG_CLIPS) | {os.path.basename(p)[:-4]
                                     for p in glob.glob(os.path.join(RES_SKILL, "*.png"))})
    fixed = missing = same = 0
    for short in clips:
        pats = glob.glob(os.path.join(RES_SKILL, "%s-*.png" % short))
        if not pats:
            continue
        for png in sorted(pats, key=lambda p: int(re.search(r"-(\d+)\.png$", p).group(1))):
            meta = read_json(png + ".meta")
            uuid = meta.get("uuid")
            ud = meta.get("subMetas", {}).get("f9941", {}).get("userData", {})
            libpng, libjson = lib_paths(uuid)
            if not os.path.exists(libjson):
                missing += 1
                continue
            cur = read_json(libjson)
            c = cur.setdefault("content", {})
            want = frame_meta_to_content(ud, os.path.basename(png)[:-4], uuid)
            if (c.get("rect") == want["rect"] and c.get("originalSize") == want["originalSize"]
                    and os.path.exists(libpng)
                    and _png_size(libpng) == (want["rect"]["width"], want["rect"]["height"])):
                same += 1
                continue
            fixed += 1
            if fixed <= 5 or "--verbose" in sys.argv:
                print("  补 %s: library rect %s -> %s"
                      % (os.path.basename(png), c.get("rect"), want["rect"]))
            if apply:
                c.update(want)
                write_json(libjson, cur)
                os.makedirs(os.path.dirname(libpng), exist_ok=True)
                shutil.copyfile(png, libpng)
    print("library 缓存同步：需补 %d | 已一致 %d | 库中无记录 %d | 模式 %s"
          % (fixed, same, missing, "写盘" if apply else "演练"))
    return 0


def _png_size(p):
    with open(p, "rb") as f:
        head = f.read(24)
    if head[:8] != b"\x89PNG\r\n\x1a\n":
        return None
    return (int.from_bytes(head[16:20], "big"), int.from_bytes(head[20:24], "big"))


if __name__ == "__main__":
    sys.exit(main())
