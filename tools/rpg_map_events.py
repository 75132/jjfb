# -*- coding: utf-8 -*-
"""
RPG Maker MV 事件（点位/对话/功能）提取原型（只读 RPG 工程，输出到 tools/_preview/）

把 MapXXX.json 的 events[] 翻译成 Cocos 侧的「点位表」：
  · RPG 格子坐标 (x, y)（y 向下）→ Cocos 逻辑坐标（x=像素中心，y 向上为正）
      逻辑 x = evx*48 + 24
      逻辑 y = 24 - evy*48
    与 assets/Script/Game/tilemap-coords.ts 的 tileIndicesToLogical 完全一致。
  · 对话（101 头 + 401 续行）、选项（102 + 402/403/404）
  · 传送（201）、条件分支（111）、开关/变量（121/122/123）、物品/装备/队员（126/127/128/129）
  · 插件命令（356）/ 脚本（355）—— 需要人工映射表，本脚本原样列出待映射

用法：
  python tools/rpg_map_events.py                 # 汇总表 + 点位清单
  python tools/rpg_map_events.py --json          # 额外输出点位 JSON（Cocos 坐标）
"""
import json
import os
import sys
from collections import Counter

RPG = r"D:/机甲风暴开发素材合集/机甲风暴2"
DATA = os.path.join(RPG, "data")
OUTDIR = r"D:/jjfbol-cocos/jjfbol-cocos/jjfb/tools/_preview/rpg_maps"
TILE = 48

TRIGGER = {0: "确定键", 1: "玩家接触", 2: "事件接触", 3: "自动执行", 4: "并行处理"}
PRIORITY = {0: "在玩家下方", 1: "与玩家同层", 2: "在玩家上方"}
CMD = {
    101: "对话头", 401: "对话行", 102: "显示选项", 402: "选项·当", 403: "选项·取消",
    404: "选项结束", 405: "选项·续", 605: "选项·续", 111: "条件分支", 411: "条件·否则",
    412: "条件结束", 112: "循环", 413: "循环结束", 113: "中断循环", 115: "退出事件",
    117: "调用公共事件", 118: "标签", 119: "跳转标签", 121: "开关操作", 122: "变量操作",
    123: "独立开关", 124: "计时器", 125: "金钱", 126: "物品", 127: "武器", 128: "防具",
    129: "队员", 201: "场所移动", 202: "设置事件位置", 203: "移动路线", 204: "滚动画面",
    205: "移动路线(玩家)", 206: "等待移动", 211: "更改地图画面", 212: "播放动画",
    213: "显示战斗动画", 214: "气球图标", 221: "淡出", 222: "淡入", 223: "色调",
    224: "闪烁", 225: "震动", 230: "等待", 231: "显示图片", 232: "移动图片",
    235: "擦除图片", 236: "天气", 241: "播放BGM", 242: "淡出BGM", 245: "播放BGS",
    249: "播放ME", 250: "播放SE", 251: "停止SE", 281: "更改地图名", 282: "更改图块集",
    284: "更改远景", 285: "获取位置信息", 301: "战斗处理", 601: "战斗·胜利",
    602: "战斗·逃跑", 603: "战斗·失败", 604: "战斗·结束", 302: "商店处理",
    303: "名字输入", 311: "更改HP", 315: "恢复全满", 316: "更改经验", 317: "更改等级",
    319: "更改技能", 320: "更改装备", 331: "更改敌人HP", 335: "敌人出现",
    351: "打开菜单", 352: "打开存档", 353: "游戏结束", 354: "返回标题", 355: "脚本",
    356: "插件命令", 357: "更改窗口外观", 108: "注释", 408: "注释·续",
}


def load(name):
    with open(os.path.join(DATA, name), encoding="utf-8") as f:
        return json.load(f)


def logical(evx, evy):
    return evx * TILE + TILE // 2, TILE // 2 - evy * TILE


def parse_page(pg):
    """把一页命令列表解析成结构化摘要"""
    out = {"dialogue": [], "choices": [], "transfers": [], "other": [], "plugins": [], "scripts": []}
    i = 0
    lst = pg.get("list", [])
    while i < len(lst):
        c = lst[i]
        code, prm = c["code"], c["parameters"]
        if code == 101:                       # 对话头 → 收集后续 401
            lines = []
            j = i + 1
            while j < len(lst) and lst[j]["code"] == 401:
                lines.append(lst[j]["parameters"][0])
                j += 1
            out["dialogue"].append({"face": prm[0] if len(prm) > 0 else "",
                                    "faceIndex": prm[1] if len(prm) > 1 else 0,
                                    "lines": lines})
            i = j
            continue
        if code == 102:                       # 选项
            out["choices"].append({"options": list(prm[0] or []),
                                   "cancelType": prm[1] if len(prm) > 1 else 0})
        elif code == 201:                     # 场所移动 [mode, mapId, x, y, dir, fade]
            out["transfers"].append({"mapId": prm[1], "x": prm[2], "y": prm[3],
                                     "dir": prm[4] if len(prm) > 4 else 0})
        elif code == 356:
            out["plugins"].append(prm[0] if prm else "")
        elif code == 355:
            out["scripts"].append(prm[0] if prm else "")
        elif code in (121, 122, 123, 126, 127, 128, 129, 301, 111, 112, 117, 211):
            out["other"].append({"code": code, "name": CMD.get(code, "?"), "params": prm})
        i += 1
    return out


def main(want_json=False):
    mi = [x for x in load("MapInfos.json") if x]
    L = []

    def p(s=""):
        L.append(s)

    pois = []
    p("=" * 110)
    p("[1] 事件点位总表（RPG 格坐标 → Cocos 逻辑坐标；y 向上为正）")
    p("=" * 110)
    p(f"{'地图':<12}{'事件':<9}{'格(x,y)':>10}{'Cocos逻辑(x,y)':>18}{'触发':<10}{'形象':<14}  功能摘要")
    for m in sorted(mi, key=lambda x: x["id"]):
        fn = "Map%03d.json" % m["id"]
        if not os.path.exists(os.path.join(DATA, fn)):
            continue
        d = load(fn)
        for e in d.get("events", []):
            if not e:
                continue
            evx, evy = e["x"], e["y"]
            lx, ly = logical(evx, evy)
            imgs, trigs, summary = set(), set(), []
            for pi, pg in enumerate(e.get("pages", [])):
                im = pg.get("image") or {}
                if im.get("characterName"):
                    imgs.add(im["characterName"])
                trigs.add(TRIGGER.get(pg.get("trigger"), "?"))
                s = parse_page(pg)
                if s["dialogue"]:
                    summary.append("对话%d组" % len(s["dialogue"]))
                if s["choices"]:
                    summary.append("选项%d" % len(s["choices"]))
                if s["transfers"]:
                    summary.append("传送→Map%s" % ",".join(str(t["mapId"]) for t in s["transfers"]))
                if s["plugins"]:
                    summary.append("插件[%s]" % ",".join(s["plugins"]))
                if s["scripts"]:
                    summary.append("脚本%d" % len(s["scripts"]))
                cnt = Counter(x["name"] for x in s["other"])
                if cnt:
                    summary.append("+".join("%s×%d" % (k, v) for k, v in cnt.items()))
                pois.append({
                    "mapId": m["id"], "mapName": m["name"], "eventId": e["id"],
                    "eventName": e["name"], "page": pi,
                    "tile": {"x": evx, "y": evy}, "logical": {"x": lx, "y": ly},
                    "trigger": TRIGGER.get(pg.get("trigger")),
                    "priority": PRIORITY.get(pg.get("priorityType")),
                    "characterName": (pg.get("image") or {}).get("characterName", ""),
                    "conditions": pg.get("conditions"),
                    "detail": s,
                })
            p(f"{m['name']:<12}{e['name']:<9}{f'({evx},{evy})':>10}{f'({lx},{ly})':>18}"
              f"{'/'.join(sorted(trigs)):<10}{','.join(sorted(imgs)) or '-':<14}  {' ; '.join(summary)}")
    p()
    p("[2] 统计")
    p(f"  事件页总数（点位条目）= {len(pois)}")
    p(f"  含对话的点位 = {sum(1 for x in pois if x['detail']['dialogue'])}")
    p(f"  含选项的点位 = {sum(1 for x in pois if x['detail']['choices'])}")
    p(f"  含传送的点位 = {sum(1 for x in pois if x['detail']['transfers'])}")
    p(f"  含插件命令的点位 = {sum(1 for x in pois if x['detail']['plugins'])}")
    p(f"  含脚本的点位 = {sum(1 for x in pois if x['detail']['scripts'])}")
    plugs = Counter(pl for x in pois for pl in x["detail"]["plugins"])
    p(f"  插件命令种类 = {len(plugs)} → {dict(plugs)}")
    p()
    p("[3] 坐标换算公式（与 assets/Script/Game/tilemap-coords.ts 一致）")
    p("  Cocos逻辑.x = rpgX*48 + 24")
    p("  Cocos逻辑.y = 24 - rpgY*48")
    p("  校验：rpg(0,0) → (24,24)；rpg(3,4) → (168,-168)")

    txt = "\n".join(L)
    print(txt)
    os.makedirs(OUTDIR, exist_ok=True)
    with open(os.path.join(OUTDIR, "events_poi.txt"), "w", encoding="utf-8", newline="\n") as f:
        f.write(txt + "\n")
    if want_json:
        jf = os.path.join(OUTDIR, "events_poi.json")
        with open(jf, "w", encoding="utf-8", newline="\n") as f:
            json.dump(pois, f, ensure_ascii=False, indent=1)
        print("\n[写入] " + jf)
    print("[写入] " + os.path.join(OUTDIR, "events_poi.txt"))


if __name__ == "__main__":
    main("--json" in sys.argv)
