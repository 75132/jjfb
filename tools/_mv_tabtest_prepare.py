# -*- coding: utf-8 -*-
"""搭一个最小 MV 测试工程，用来实测「手改 tilesetNames 能不能多出页签」。

只写 D:\\_mv_tabtest，不碰用户工程、不碰 Juben。
"""
import io
import json
import os
import shutil

SRC = r"D:\Program Files (x86)\KADOKAWA\RPGMV\NewData"
DST = r"D:\_mv_tabtest"

if os.path.exists(DST):
    shutil.rmtree(DST)
os.makedirs(DST)

# 1) 工程标识文件
with io.open(os.path.join(DST, "Game.rpgproject"), "w", encoding="ascii", newline="\n") as f:
    f.write("RPGMV 1.6.1\n")

# 2) data 全量
shutil.copytree(os.path.join(SRC, "data"), os.path.join(DST, "data"))

# 3) img：system 全量 + tilesets 需要的几张 + 其余目录建空
shutil.copytree(os.path.join(SRC, "img", "system"), os.path.join(DST, "img", "system"))
os.makedirs(os.path.join(DST, "img", "tilesets"))
NEED = [
    "Outside_A1", "Outside_A2", "Outside_A3", "Outside_A4", "Outside_A5",
    "Outside_B", "Outside_C", "Inside_B", "Inside_C",
    "World_A1", "World_A2", "World_B", "World_C",
]
for nm in NEED:
    for ext in (".png", ".txt"):
        p = os.path.join(SRC, "img", "tilesets", nm + ext)
        if os.path.exists(p):
            shutil.copy2(p, os.path.join(DST, "img", "tilesets", nm + ext))
for d in ["animations", "battlebacks1", "battlebacks2", "characters", "enemies",
          "faces", "parallaxes", "sv_actors", "sv_enemies", "titles1", "titles2"]:
    os.makedirs(os.path.join(DST, "img", d), exist_ok=True)

# 4) 两张纯色测试图（768x768，正好一个标准普通图块表）
from PIL import Image  # noqa: E402

Image.new("RGBA", (768, 768), (216, 56, 56, 255)).save(
    os.path.join(DST, "img", "tilesets", "Test_F.png"))
Image.new("RGBA", (768, 768), (48, 96, 208, 255)).save(
    os.path.join(DST, "img", "tilesets", "Test_G.png"))

# 5) 改 Tilesets.json：把 Outside 的 D/E 换成有图的，末尾再加 2 个槽
tp = os.path.join(DST, "data", "Tilesets.json")
ts = json.load(io.open(tp, encoding="utf-8"))
t = ts[2]
print("BEFORE:", t["name"], t["tilesetNames"])
t["tilesetNames"] = [
    "Outside_A1", "Outside_A2", "Outside_A3", "Outside_A4", "Outside_A5",
    "Outside_B", "Outside_C", "Inside_B", "Inside_C", "Test_F", "Test_G",
]
print("AFTER :", t["name"], t["tilesetNames"])

# 6) 让默认地图用 tileset 2
mp = os.path.join(DST, "data", "Map001.json")
m = json.load(io.open(mp, encoding="utf-8"))
print("Map001 tilesetId:", m["tilesetId"], "->", 2)
m["tilesetId"] = 2
io.open(mp, "w", encoding="utf-8", newline="\n").write(
    json.dumps(m, ensure_ascii=False, indent=2))

io.open(tp, "w", encoding="utf-8", newline="\n").write(
    json.dumps(ts, ensure_ascii=False, indent=2))

print("done ->", DST)
