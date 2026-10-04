# -*- coding: utf-8 -*-
"""清空 Monster 旧产物（png/meta/anim），这些全部可由 monster_port.py 从源重建。"""
import os
import shutil

ROOT = r"D:\jjfbol-cocos\jjfbol-cocos\jjfb"
DIRS = [
    os.path.join(ROOT, "assets", "resources", "Monster"),
    os.path.join(ROOT, "assets", "resources", "Monster", "ani"),
    os.path.join(ROOT, "assets", "Image", "Monster", "ani"),
]

removed = 0
for d in DIRS:
    if not os.path.isdir(d):
        continue
    for fn in os.listdir(d):
        if fn.lower().endswith((".png", ".png.meta", ".anim", ".anim.meta")):
            os.remove(os.path.join(d, fn))
            removed += 1

print(f"已删除 {removed} 个旧产物文件")
for d in DIRS:
    left = os.listdir(d) if os.path.isdir(d) else []
    print(f"  {d}  剩余 {len(left)}")
