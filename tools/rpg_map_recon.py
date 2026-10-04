# -*- coding: utf-8 -*-
"""
RPG Maker MV 地图可移植性普查（只读，不改任何文件）

用途：评估「摒弃 Juben、直接用 RPG Maker MV 制作并提取地图（分层/格子/事件/点位）」
      这一方案的可行性与工作量。

输出：
  1. 每张地图的尺寸、像素、图块集、图层占用
  2. 图块 ID 编码分布（A1/A2/A3/A4/A5/B/C/D/E 各多少格）→ 判定是否用到自动图块
  3. 事件命令 code 词频 → 判定「对话/剧情/点位」提取的工作量
  4. 事件页条件 / 触发器 / 优先级 分布
  5. 点位类命令明细（场所移动 / 事件位置 / 玩家位置）

用法：
  python tools/rpg_map_recon.py
  python tools/rpg_map_recon.py --events      # 额外打印事件命令样例
"""
import json
import os
import sys
import glob
from collections import Counter, defaultdict

RPG = r"D:/机甲风暴开发素材合集/机甲风暴2"
DATA = os.path.join(RPG, "data")
TILE = 48
OUT = r"D:/jjfbol-cocos/jjfbol-cocos/jjfb/tools/_preview/rpg_map_recon.txt"

# ---- MV 图块 ID 分区（js/rpg_core.js Tilemap.*）----
ZONES = [
    (2048, 2816, "A1 瀑布/水（动画自动图块，4 帧）"),
    (2816, 4352, "A2 地面自动图块（48 形状连接）"),
    (4352, 5888, "A3 建筑自动图块（48 形状连接）"),
    (5888, 8192, "A4 墙自动图块（16 形状连接）"),
    (1536, 2048, "A5 普通图块（无连接）"),
    (0, 256, "B 普通图块"),
    (256, 512, "C 普通图块"),
    (512, 768, "D 普通图块"),
    (768, 1536, "E 普通图块"),
]


def zone_of(tid):
    for lo, hi, name in ZONES:
        if lo <= tid < hi:
            return name.split()[0]
    return "?"


def load(name):
    with open(os.path.join(DATA, name), encoding="utf-8") as f:
        return json.load(f)


def main(with_events=False):
    lines = []

    def p(s=""):
        lines.append(s)

    mi = [x for x in load("MapInfos.json") if x]
    tilesets = {t["id"]: t for t in load("Tilesets.json") if t}

    p("=" * 100)
    p("RPG Maker MV 地图普查")
    p("=" * 100)
    p(f"地图数 = {len(mi)}   tile 尺寸 = {TILE}px")
    p()

    # ---------- 1. 地图清单 ----------
    p("[1] 地图清单 / 像素尺寸 / 图块集")
    p(f"{'id':>3} {'名称':<14}{'w×h':>10}{'像素':>13}{'tileset':>9}  {'用到的图块集图':<28} 图层(z)含内容")
    total_px = 0
    map_meta = {}
    for m in sorted(mi, key=lambda x: x["id"]):
        fn = os.path.join(DATA, "Map%03d.json" % m["id"])
        if not os.path.exists(fn):
            p(f"{m['id']:>3} {m['name']:<14}  !! 缺 Map{m['id']:03d}.json")
            continue
        d = load("Map%03d.json" % m["id"])
        w, h = d["width"], d["height"]
        tsid = d.get("tilesetId")
        ts = tilesets.get(tsid)
        imgs = ""
        if ts:
            names = [ts.get("tilesetNames", [None] * 9)[i] for i in range(9)]
            imgs = "+".join(x for x in names if x)
        nz = []
        for z in range(6):
            n = sum(1 for y in range(h) for x in range(w) if d["data"][(z * h + y) * w + x])
            if n:
                nz.append(f"z{z}:{n}")
        ne = sum(1 for e in d.get("events", []) if e)
        map_meta[m["id"]] = dict(name=m["name"], w=w, h=h, ts=tsid, imgs=imgs, events=ne)
        total_px += w * h
        p(f"{m['id']:>3} {m['name']:<14}{f'{w}×{h}':>10}{f'{w*TILE}×{h*TILE}':>13}{tsid:>9}  {imgs:<28} {' '.join(nz)}  事件{ne}")
    p(f"{'':>3} {'合计':<14}{'':>10}{str(total_px)+' 格':>13}")
    p()

    # ---------- 2. 图块编码分布 ----------
    p("[2] 图块 ID 编码分布（全地图合计）—— 判定是否用到自动图块")
    zc = Counter()
    per_map_auto = {}
    for mid in map_meta:
        d = load("Map%03d.json" % mid)
        w, h = d["width"], d["height"]
        zs = set()
        for z in range(6):
            for y in range(h):
                base = (z * h + y) * w
                for x in range(w):
                    v = d["data"][base + x]
                    if v:
                        k = zone_of(v)
                        zc[k] += 1
                        if k.startswith("A"):
                            zs.add(k)
        per_map_auto[mid] = sorted(zs)
    tot = sum(zc.values())
    for k, v in zc.most_common():
        p(f"  {k:<4} {v:>7} 格  ({v*100.0/tot:5.1f}%)")
    auto_maps = {k: v for k, v in per_map_auto.items() if v}
    p(f"  → 用到自动图块(A*)的地图：{auto_maps if auto_maps else '无'}")
    p(f"  → 纯普通图块(B/C/D/E/A5)即可渲染的地图："
      f"{[m for m in map_meta if m not in auto_maps]}")
    p()

    # ---------- 3. 事件命令词频 ----------
    CODES = {
        0: "空行/分支标记", 101: "显示文字(首行)", 401: "显示文字(续行)", 102: "显示选项",
        402: "选项分支(当)", 403: "选项分支(取消)", 404: "选项结束", 111: "条件分支",
        411: "条件(否则)", 412: "条件结束", 112: "循环", 413: "循环结束", 113: "中断循环",
        115: "退出事件处理", 117: "调用公共事件", 118: "标签", 119: "跳转标签",
        121: "开关操作", 122: "变量操作", 123: "独立开关", 124: "计时器",
        125: "增减金钱", 126: "增减物品", 127: "增减武器", 128: "增减防具",
        129: "队伍入队", 201: "场所移动", 202: "设置事件位置", 203: "设置移动路线",
        204: "滚动画面", 205: "设置移动路线(玩家)", 206: "等待移动结束",
        212: "播放动画", 213: "显示战斗动画", 214: "显示气球图标", 221: "淡出画面",
        222: "淡入画面", 223: "画面色调", 224: "闪烁", 225: "震动", 230: "等待",
        231: "显示图片", 232: "移动图片", 235: "擦除图片", 236: "天气",
        241: "播放BGM", 242: "淡出BGM", 245: "播放BGS", 249: "播放ME", 250: "播放SE",
        251: "停止SE", 261: "播放影片", 281: "更改地图名", 282: "更改图块集",
        283: "更改战斗背景", 284: "更改远景", 285: "获取位置信息", 301: "战斗处理",
        302: "商店处理", 303: "名字输入", 311: "更改HP", 312: "更改MP", 313: "更改TP",
        314: "更改状态", 315: "恢复全满", 316: "更改经验", 317: "更改等级",
        318: "更改能力值", 319: "更改技能", 320: "更改装备", 321: "更改名字",
        322: "更改职业", 323: "更改角色图像", 324: "更改载具图像", 325: "更改昵称",
        331: "更改敌人HP", 332: "更改敌人MP", 333: "更改敌人TP", 334: "更改敌人状态",
        335: "敌人出现", 336: "敌人变身", 337: "显示战斗动画(敌)", 340: "中止战斗",
        351: "打开菜单画面", 352: "打开存档画面", 353: "游戏结束", 354: "返回标题",
        355: "脚本", 356: "插件命令", 357: "更改窗口外观", 655: "脚本(续)", 108: "注释",
        408: "注释(续)", 405: "选项(续)", 605: "选项(续)",
    }
    p("[3] 事件命令 code 词频（全地图合计）—— 决定剧情/点位提取的工作量")
    freq = Counter()
    per_map_cmd = defaultdict(Counter)
    tot_ev = 0
    for mid in map_meta:
        d = load("Map%03d.json" % mid)
        for e in d.get("events", []):
            if not e:
                continue
            tot_ev += 1
            for pg in e.get("pages", []):
                for c in pg.get("list", []):
                    freq[c["code"]] += 1
                    per_map_cmd[mid][c["code"]] += 1
    p(f"  事件总数 = {tot_ev}   命令总数 = {sum(freq.values())}")
    p(f"  {'code':>5} {'命令':<22}{'次数':>7}  占比")
    for code, n in freq.most_common(60):
        p(f"  {code:>5} {CODES.get(code, '???'):<22}{n:>7}  {n*100.0/sum(freq.values()):5.2f}%")
    unknown = {c: n for c, n in freq.items() if c not in CODES}
    p(f"  → 词典未收录的 code：{sorted(unknown.items(), key=lambda x: -x[1]) if unknown else '无'}")
    p()

    # ---------- 4. 点位类命令明细 ----------
    p("[4] 点位 / 转移类命令明细")
    for mid in map_meta:
        d = load("Map%03d.json" % mid)
        rows = []
        for e in d.get("events", []):
            if not e:
                continue
            for pi, pg in enumerate(e.get("pages", [])):
                for c in pg.get("list", []):
                    if c["code"] in (201, 202, 205, 206):
                        rows.append((e["name"], e["x"], e["y"], pi, c["code"], c["parameters"]))
        if rows:
            p(f"  -- Map{mid:03d} {map_meta[mid]['name']} ({len(rows)} 条)")
            for r in rows[:12]:
                p(f"     {r[0]:<14} @({r[1]},{r[2]}) p{r[3]}  code={r[4]}  {str(r[5])[:80]}")
            if len(rows) > 12:
                p(f"     ... 另 {len(rows)-12} 条")
    p()

    # ---------- 5. 事件页条件 / 触发器 ----------
    p("[5] 事件页属性分布")
    trig = Counter()
    prio = Counter()
    cond = Counter()
    TR = {0: "确定键", 1: "玩家接触", 2: "事件接触", 3: "自动执行", 4: "并行处理"}
    PR = {0: "在玩家下方", 1: "与玩家同层", 2: "在玩家上方"}
    for mid in map_meta:
        d = load("Map%03d.json" % mid)
        for e in d.get("events", []):
            if not e:
                continue
            for pg in e.get("pages", []):
                trig[pg.get("trigger")] += 1
                prio[pg.get("priorityType")] += 1
                for k, v in (pg.get("conditions") or {}).items():
                    if isinstance(v, bool) and v:
                        cond[k] += 1
                    elif not isinstance(v, bool):
                        pass
    p("  触发器：" + "  ".join(f"{TR.get(k,k)}={v}" for k, v in trig.most_common()))
    p("  优先级：" + "  ".join(f"{PR.get(k,k)}={v}" for k, v in prio.most_common()))
    p("  条件：" + "  ".join(f"{k}={v}" for k, v in cond.most_common()))
    p()

    # ---------- 6. 事件图像（角色图）----------
    p("[6] 事件使用的角色图（image.characterName）")
    imgs = Counter()
    for mid in map_meta:
        d = load("Map%03d.json" % mid)
        for e in d.get("events", []):
            if not e:
                continue
            for pg in e.get("pages", []):
                im = pg.get("image") or {}
                if im.get("characterName"):
                    imgs[im["characterName"]] += 1
    for k, v in imgs.most_common(40):
        p(f"  {k:<28}{v:>4}")
    p()

    if with_events:
        p("[7] 事件命令样例（每个 code 取 1 例）")
        seen = {}
        for mid in map_meta:
            d = load("Map%03d.json" % mid)
            for e in d.get("events", []):
                if not e:
                    continue
                for pg in e.get("pages", []):
                    for c in pg.get("list", []):
                        seen.setdefault(c["code"], (mid, e["name"], c["parameters"]))
        for code in sorted(seen):
            mid, nm, prm = seen[code]
            p(f"  {code:>5} {CODES.get(code,'???'):<22} Map{mid:03d}/{nm:<12} {str(prm)[:95]}")

    txt = "\n".join(lines)
    print(txt)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write(txt + "\n")
    print("\n[写入] " + OUT)


if __name__ == "__main__":
    main("--events" in sys.argv)
