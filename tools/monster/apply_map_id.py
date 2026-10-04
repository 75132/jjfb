# -*- coding: utf-8 -*-
"""
在怪物分布表 xlsx 上做「分类」：
  1. 给每个段/地图分配 map_id（从 1 开始，全表连续）
     - 同名段视为同一地图，共用同一 map_id（按首次出现顺序编号）
     - 非地图段（活动/商店/押镖/公会/格子…）也分配 map_id，供后续识别区分
  2. 整理 isRobot（1=机甲 / 0=敌对阵容）与 是否敌群（1=属于刷怪遇敌列表 / 0=否）
  3. 按地图分组，重排 + 加分组标题，导出回 xlsx

输出：docs/monster_distribution.xlsx（原地覆盖，先备份到 docs/_backup/）
"""
import os
import re
import shutil
import zipfile
import collections
import datetime

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(BASE, "..", ".."))
DOCS = os.path.join(ROOT, "docs")
XLSX = os.path.join(DOCS, "monster_distribution.xlsx")

# ---------- 1. 读旧 xlsx ----------
COL_ORDER_LEGACY = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N"]


def read_xlsx(path):
    """用 openpyxl 读（兼容 共享字符串 / inline 两种写法）。"""
    import openpyxl
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb["怪物分布表"] if "怪物分布表" in wb.sheetnames else wb.worksheets[0]
    rows = []
    for row in ws.iter_rows(values_only=True):
        vals = ["" if v is None else str(v) for v in row]
        rows.append({COL_ORDER_LEGACY[i]: vals[i] for i in range(min(len(vals), len(COL_ORDER_LEGACY)))})
    return rows


SRC_CANDIDATES = [
    r"D:/Desktop/JJFBpojie/monster@monster.txt",
    r"D:/Desktop/JJFBpojie/JJFB机甲怪物完整资料包/08_数据对照/monster@monster.txt",
]


def load_forms():
    """从 monster@monster.txt 取 id → 形态（初/中/终）。"""
    src = next((p for p in SRC_CANDIDATES if os.path.isfile(p)), None)
    if not src:
        return {}
    m = {}
    with open(src, "r", encoding="utf-8-sig", errors="replace") as f:
        for line in f:
            if not line.startswith("@monster|"):
                continue
            fid = re.search(r"@id=(\d+)", line)
            fname = re.search(r"@name=([^|@\n]*)", line)
            fform = re.search(r"@name=[^|@\n]*\|([^|@\n]*)", line)
            if fid:
                m[int(fid.group(1))] = (fform.group(1).strip() if fform else "")
    return m


def main():
    # 先补 形态（用户表里该列被清空；从 monster@monster.txt 按 id 回填）
    form_map = load_forms()

    header_row = None
    data = []
    for d in read_xlsx(XLSX):
        # 兼容旧表头(段号) 与 新表头(map_id / 段名)
        if d.get("A") in ("段号", "map_id") or d.get("B") == "段名":
            header_row = d
            continue
        if str(d.get("F", "")).strip() not in ("", "None"):
            if not d.get("H"):
                try:
                    d["H"] = form_map.get(int(float(d["F"])), "")
                except (ValueError, TypeError):
                    d["H"] = ""
            data.append(d)
    assert header_row, "未找到表头"
    print("读入数据行:", len(data), " 形态表:", len(form_map))

    # ---------- 2. 按首次出现顺序给「段名」分配 map_id ----------
    name_order = []
    for d in data:
        n = d.get("B", "").strip()
        if n not in name_order:
            name_order.append(n)
    map_id_of = {n: i + 1 for i, n in enumerate(name_order)}
    print("唯一地图/段:", len(name_order))

    # ---------- 3. 判定每个 map_id 的类别（地图段 or 非地图段）----------
    # 非地图段关键字（活动/商店/押镖/公会/格子/任务/礼包/合成/抽奖等）
    NONE_MAP_KW = [
        "格子", "押镖", "联盟", "公会", "佣兵商店", "商店", "活动",
        "礼包", "合成", "抽奖", "任务", "神圣", "跑环", "机甲", "救",
        "十二宫", "来客", "赠送", "中秋", "七夕", "端午", "61", "7.1",
    ]
    def is_map(n):
        # 明确的城市/荒野/森林/荒原/洞/遗迹/空间站/行星/雪原等
        MAP_KW = ["荒原", "森林", "雷奥斯", "兵工厂", "魔虫洞", "莱温霍姆",
                  "极北雪原", "伦卡空间站", "拉诺斯", "潘多拉", "月球遗迹",
                  "郊外", "氪星来客", "赛博坦"]
        if any(k in n for k in MAP_KW) and not any(k in n for k in ("野怪", "补充")):
            return True
        return False

    # ---------- 4. 组装输出行 ----------
    # 世界提示映射（来自 bigWorldMap）
    out_rows = []
    for d in data:
        name = d.get("B", "").strip()
        out_rows.append({
            "map_id": map_id_of[name],
            "段名": name,
            "类型": "地图" if is_map(name) else "非地图",
            "旧段号": d.get("A", ""),
            "段内id": d.get("F", ""),
            "名称": d.get("G", ""),
            "形态": d.get("H", ""),
            "imgID": d.get("I", ""),
            "isRobot": d.get("J", ""),
            "是否敌群": d.get("N", ""),
            "baseAtt": d.get("K", ""),
            "jinLevel": d.get("L", ""),
            "世界提示": d.get("M", ""),
            "ID区间": d.get("C", ""),
        })

    # 排序：map_id 升序；同地图内 是否敌群降序（敌群在前）→ isRobot 降序 → 段内id
    out_rows.sort(key=lambda r: (r["map_id"],
                                 -int(r["是否敌群"] or 0),
                                 -int(r["isRobot"] or 0),
                                 int(r["段内id"] or 0)))

    # ---------- 5. 写 xlsx（用 openpyxl 若有，否则手写）----------
    write_xlsx(out_rows, map_id_of, name_order, is_map)

    # 摘要
    seg_stat = collections.OrderedDict()
    for r in out_rows:
        k = (r["map_id"], r["段名"])
        s = seg_stat.setdefault(k, {"n": 0, "enemy": 0, "robot": 0, "type": r["类型"]})
        s["n"] += 1
        s["enemy"] += int(r["是否敌群"] or 0)
        s["robot"] += int(r["isRobot"] or 0)
    print("\n== map_id 分配结果（%d 个）==" % len(seg_stat))
    for (mid, name), s in seg_stat.items():
        print("  %2d  %-24s [%s] %3d条  敌群%3d  机甲%3d"
              % (mid, name, s["type"], s["n"], s["enemy"], s["robot"]))


def write_xlsx(rows, map_id_of, name_order, is_map):
    try:
        import openpyxl
        from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    except ImportError:
        print("!! 未安装 openpyxl，改为写 CSV 备份")
        return

    # 备份
    bdir = os.path.join(DOCS, "_backup")
    os.makedirs(bdir, exist_ok=True)
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    shutil.copy2(XLSX, os.path.join(bdir, "monster_distribution_%s.xlsx" % ts))

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "怪物分布表"

    cols = ["map_id", "段名", "类型", "是否敌群", "isRobot", "段内id", "名称", "形态",
            "imgID", "baseAtt", "jinLevel", "世界提示", "旧段号", "ID区间"]
    hf = Font(bold=True, color="FFFFFF", size=11)
    hfill = PatternFill("solid", fgColor="1E3A5F")
    center = Alignment(horizontal="center", vertical="center")
    thin = Side(style="thin", color="D0D7DE")
    border = Border(left=thin, right=thin, top=thin, bottom=thin)

    ws.append(cols)
    for c in range(1, len(cols) + 1):
        cell = ws.cell(row=1, column=c)
        cell.font = hf
        cell.fill = hfill
        cell.alignment = center
        cell.border = border

    fill_map = PatternFill("solid", fgColor="EAF3FF")
    fill_non = PatternFill("solid", fgColor="FFF4E6")
    prev_mid = None
    for r in rows:
        ws.append([r["map_id"], r["段名"], r["类型"], r["是否敌群"], r["isRobot"],
                   r["段内id"], r["名称"], r["形态"], r["imgID"], r["baseAtt"],
                   r["jinLevel"], r["世界提示"], r["旧段号"], r["ID区间"]])
        rr = ws.max_row
        # 交替底色区分地图组
        if r["map_id"] != prev_mid:
            prev_mid = r["map_id"]
        f = fill_map if r["类型"] == "地图" else fill_non
        for c in range(1, len(cols) + 1):
            ws.cell(row=rr, column=c).border = border
            ws.cell(row=rr, column=c).fill = f

    widths = [8, 24, 8, 9, 8, 7, 16, 6, 7, 34, 8, 26, 7, 10]
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[openpyxl.utils.get_column_letter(i)].width = w
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = "A1:%s%d" % (openpyxl.utils.get_column_letter(len(cols)), ws.max_row)

    # 第二页：地图/段 索引
    ws2 = wb.create_sheet("地图索引")
    ws2.append(["map_id", "段名", "类型", "单位数", "敌群数", "机甲数"])
    for c in range(1, 7):
        cell = ws2.cell(row=1, column=c)
        cell.font = hf; cell.fill = hfill; cell.alignment = center; cell.border = border
    agg = collections.OrderedDict()
    for r in rows:
        k = r["map_id"]
        s = agg.setdefault(k, {"name": r["段名"], "type": r["类型"], "n": 0, "e": 0, "ro": 0})
        s["n"] += 1
        s["e"] += int(r["是否敌群"] or 0)
        s["ro"] += int(r["isRobot"] or 0)
    for mid in sorted(agg.keys()):
        s = agg[mid]
        ws2.append([mid, s["name"], s["type"], s["n"], s["e"], s["ro"]])
    for i, w in enumerate([8, 24, 8, 8, 8, 8], 1):
        ws2.column_dimensions[openpyxl.utils.get_column_letter(i)].width = w
    ws2.freeze_panes = "A2"

    wb.save(XLSX)
    print("\n== 已写入 %s ==" % XLSX)
    print("   备份: %s" % os.path.join(bdir, "monster_distribution_%s.xlsx" % ts))
    print("   工作表: 怪物分布表 + 地图索引")


if __name__ == "__main__":
    main()
