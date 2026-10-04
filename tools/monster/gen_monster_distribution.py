# -*- coding: utf-8 -*-
"""
从 `monster@monster.txt` 的原始 `////` 注释段还原「怪物分布表」——即官方对玩法分区的原始划分。

来源（权威）：D:/Desktop/JJFBpojie/monster@monster.txt （也含 JJFBpojie/JJFB机甲怪物完整资料包/08_数据对照/）
产出：
  docs/monster_distribution.json  分段 + 每段完整怪物列表（id/名称/形态/imgID/isRobot/baseAtt）
  docs/monster_distribution.csv   逐行：段号/段名/id/名称/形态/…
  docs/monster_distribution.html  可视化（按段折叠 + 搜索 + 世界地图等级提示）

规则：
  - 段 = 文件里 `//` 开头的注释行（`/////尼利亚荒原` / `//黄金吉尼奥` 等）
  - `@count=449` 之后（原文件第 450 行起）为追加段，按「后定义覆盖」处理
  - 同一 id 出现多次 → 取最后一次
"""
import os
import re
import json
import csv
import html
import collections

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(BASE, "..", ".."))
OUTDIR = os.path.join(ROOT, "docs")

CANDIDATES = [
    r"D:/Desktop/JJFBpojie/monster@monster.txt",
    r"D:/Desktop/JJFBpojie/JJFB机甲怪物完整资料包/08_数据对照/monster@monster.txt",
    r"D:/Desktop/jjfbtujian/data/monster@monster.txt",
    os.path.join(ROOT, "..", "..", "..", "Desktop", "jjfbtujian", "data", "monster@monster.txt"),
]

# 段号 → 世界地图 dangerLevel / 敌人等级提示（来自 bigWorldMap.txt 的 @str）
WORLD_HINT = {
    "塔拉斯森林": "敌人等级5~15（danger=2）",
    "尼利亚荒原": "敌人等级15~27（danger=3）",
    "无尽森林": "敌人等级16~28（danger=2）",
    "雷奥斯": "敌人等级17~29（danger=4）",
    "兵工厂": "敌人等级31~37（danger=4）",
    "魔虫洞": "敌人等级32~37（danger=3）",
    "安魂森林": "敌人等级33~37（danger=2）",
    "莱温霍姆": "敌人等级36~40（danger=4）",
    "死亡之地": "活动地图（danger=3）",
    "极寒雪原": "45级精英（danger=3）",
    "伦卡空间站": "45-50级精英（danger=3）",
    "潘多拉行星": "47-50级精英（danger=3）",
    "月球遗迹": "50级精英（danger=3）",
    "粽子山": "端午活动（danger=2）",
    "星际渔场": "休闲娱乐（danger=3）",
    "钓鱼行星": "15-50级精英（danger=3）",
    "极北雪原": "20-50级精英（danger=3）",
    "法西城": "城市中无敌人",
    "卡布雷萨": "城市中无敌人",
    "埃塞克": "城市中无敌人",
    "迪卡城": "城市中无敌人",
}

# 后定义覆盖补丁段（第 450 行起）需要归并进对应玩法段
PATCH_MERGE = {
    "黄道十二宫": "黄道十二宫",
}

FIELD_RE = re.compile(r"@(\w+)=([^|@\n]*)")


def find_source():
    for p in CANDIDATES:
        if os.path.isfile(p):
            return p
    raise FileNotFoundError("找不到 monster@monster.txt")


def parse_field(line):
    return {m.group(1): m.group(2).strip() for m in FIELD_RE.finditer(line)}


def main():
    src = find_source()
    with open(src, "r", encoding="utf-8-sig", errors="replace") as f:
        lines = f.read().splitlines()

    segments = []          # [{name, start_line, entries:[...]}]
    cur = None
    seen = {}              # id -> 最终条目（后定义覆盖）
    total_lines = len(lines)

    for ln, raw in enumerate(lines, 1):
        s = raw.strip()
        if not s:
            continue
        if s.startswith("//"):
            # 去掉所有 // 与首尾空白（源里 "/////尼利亚荒原" / "//黄金吉尼奥" / "20级//////" 混用）
            name = s.strip("/").strip()
            if not name:
                name = "(无名段)"
            # 合并同名连续段
            if segments and segments[-1]["name"] == name:
                cur = segments[-1]
                continue
            cur = {"name": name, "start_line": ln, "entries": []}
            segments.append(cur)
            continue
        if s.startswith("@monster|"):
            f = parse_field(s)
            mid = f.get("id")
            if mid is None:
                continue
            name = f.get("name", "")
            form = f.get("form", "")
            # 名称里含形态的（如 "铁臂|初"）解析：@name=铁臂|初
            if "|" in name:
                parts = name.split("|", 1)
                name, form = parts[0], parts[1]
            rec = {
                "id": int(mid),
                "name": name,
                "form": form,
                "occ_id": f.get("occID"),
                "img_id": f.get("monsterimgID"),
                "is_robot": int(f.get("isRobot") or 0),
                "base_att": f.get("baseAtt", ""),
                "jin_level": f.get("jinLevel"),
                "next_jin": f.get("nextJin"),
                "line": ln,
            }
            if cur is None:
                cur = {"name": "(表头·初始机甲与引导怪)", "start_line": ln, "entries": []}
                segments.append(cur)
            cur["entries"].append(rec)
            seen[rec["id"]] = rec

    # 去掉 (无名段) 空段
    segments = [s for s in segments if s["entries"]]

    # 计算每段 ID 区间与统计
    for i, s in enumerate(segments, 1):
        ids = [e["id"] for e in s["entries"]]
        s["no"] = i
        s["id_min"], s["id_max"] = min(ids), max(ids)
        s["count"] = len(s["entries"])
        s["has_player_mech"] = any(e["is_robot"] == 1 for e in s["entries"])
        s["robots"] = sorted({e["name"] for e in s["entries"] if e["is_robot"] == 1})
        s["monsters"] = sorted({e["name"] for e in s["entries"] if e["is_robot"] != 1})
        s["hint"] = WORLD_HINT.get(s["name"], "")
        # 段内最高 HP 单位（baseAtt 第 0 位 = HP 基数）
        def hp(e):
            try:
                return int(e["base_att"].split(",")[0])
            except Exception:
                return -1
        top = max(s["entries"], key=hp)
        s["top_hp_unit"] = top["name"]
        s["top_hp"] = hp(top)

    os.makedirs(OUTDIR, exist_ok=True)

    out = {
        "_desc": "怪物分布表 —— 官方玩法分区（由 monster@monster.txt 的 // 注释段还原）",
        "_source": src,
        "_total_lines": total_lines,
        "_segments": len(segments),
        "_total_unique_ids": len(seen),
        "segments": segments,
    }
    with open(os.path.join(OUTDIR, "monster_distribution.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    # CSV
    with open(os.path.join(OUTDIR, "monster_distribution.csv"), "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["段号", "段名", "ID区间", "段内数量", "含玩家机甲",
                    "id", "名称", "形态", "imgID", "isRobot", "baseAtt", "jinLevel", "世界提示"])
        for s in segments:
            for e in s["entries"]:
                w.writerow([s["no"], s["name"], "%d~%d" % (s["id_min"], s["id_max"]),
                            s["count"], "是" if s["has_player_mech"] else "否",
                            e["id"], e["name"], e["form"], e["img_id"],
                            e["is_robot"], e["base_att"], e["jin_level"], s["hint"]])

    write_html(segments, out, os.path.join(OUTDIR, "monster_distribution.html"))

    print("== 怪物分布表生成完成 ==")
    print("  源:", src)
    print("  段数:", len(segments), " 唯一 id:", len(seen))
    for s in segments:
        print("  [%2d] %-22s %3d只  ID %3d~%3d  机甲%s  topHP=%d(%s)"
              % (s["no"], s["name"], s["count"], s["id_min"], s["id_max"],
                 "有" if s["has_player_mech"] else "无", s["top_hp"], s["top_hp_unit"]))


def write_html(segments, out, path):
    cards = []
    for s in segments:
        mech = "是" if s["has_player_mech"] else "否"
        mech_color = "#059669" if s["has_player_mech"] else "#94a3b8"
        rows = []
        for e in s["entries"]:
            typ = "[机甲]" if e["is_robot"] == 1 else "[怪/NPC]"
            tc = "#0d9488" if e["is_robot"] == 1 else "#7c3aed"
            rows.append(
                "<tr><td class='num'>%d</td><td class='name'>%s</td>"
                "<td class='form'>%s</td>"
                "<td><span class='pill' style='background:%s'>%s</span></td>"
                "<td class='num'>%s</td><td class='att'>%s</td></tr>"
                % (e["id"], html.escape(e["name"]), html.escape(e["form"] or "-"),
                   tc, typ, e["img_id"] or "-", html.escape(e["base_att"]))
            )
        hint = ("<div class='hint'>🗺 %s</div>" % html.escape(s["hint"])) if s["hint"] else ""
        cards.append("""
<details class="seg" open>
<summary>
  <span class="no">#%d</span>
  <span class="segname">%s</span>
  <span class="meta">%d 只 · ID %d~%d</span>
  <span class="mech" style="color:%s">机甲:%s</span>
  <span class="top">最高HP %s(%d)</span>
</summary>
%s
<table><thead><tr><th>id</th><th>名称</th><th>形态</th><th>类型</th><th>imgID</th><th>baseAtt</th></tr></thead>
<tbody>%s</tbody></table>
</details>""" % (s["no"], html.escape(s["name"]), s["count"], s["id_min"], s["id_max"],
                 mech_color, mech, html.escape(s["top_hp_unit"]), s["top_hp"],
                 hint, "\n".join(rows)))

    doc = """<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>怪物分布表（官方玩法分区）</title>
<style>
:root{color-scheme:light}
body{background:#f7f8fa;color:#0f172a;font:14px/1.6 "Microsoft YaHei",system-ui,sans-serif;margin:0;padding:24px}
.wrap{max-width:1200px;margin:0 auto}
h1{font-size:24px;margin:0 0 6px}
.sub{color:#64748b;font-size:13px;margin-bottom:14px}
.stat{display:flex;flex-wrap:wrap;gap:10px;margin:12px 0}
.chip{background:#fff;border:1px solid #e2e8f0;border-radius:20px;padding:5px 14px;font-size:13px}
.chip b{color:#0f172a}
input{width:260px;padding:8px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;margin-bottom:12px}
details.seg{background:#fff;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:12px;overflow:hidden}
summary{cursor:pointer;padding:11px 14px;display:flex;flex-wrap:wrap;gap:12px;align-items:center;background:#f8fafc;font-size:13.5px}
summary::-webkit-details-marker{color:#94a3b8}
.no{font-weight:700;color:#0f172a;font-variant-numeric:tabular-nums}
.segname{font-weight:700;color:#0369a1;font-size:15px}
.meta{color:#64748b}
.mech{font-weight:600}
.top{color:#b45309;margin-left:auto}
.hint{padding:7px 14px;background:#eff6ff;color:#1d4ed8;font-size:12.5px}
table{width:100%;border-collapse:collapse}
th,td{padding:6px 12px;text-align:left;border-bottom:1px solid #f1f5f9;white-space:nowrap}
th{background:#fbfcfe;font-size:12px;color:#475569}
td.num{font-variant-numeric:tabular-nums;text-align:right;color:#334155}
td.name{font-weight:600}
td.form{color:#64748b}
td.att{font-family:Consolas,monospace;font-size:11.5px;color:#6b7280}
.pill{display:inline-block;padding:1px 8px;border-radius:10px;color:#fff;font-size:11.5px}
tr:hover td{background:#f0f9ff}
.hide{display:none}
</style></head><body><div class="wrap">
<h1>怪物分布表 · 官方玩法分区</h1>
<div class="sub">来源：__SRC__ · 由 <code>////</code> 注释段还原 · 共 __SEG__ 段 / __IDS__ 个唯一 id</div>
<div class="stat">__STATS__</div>
<input id="q" placeholder="搜索 段名 / 怪物名 / id …">
<div id="body">__BODY__</div>
</div>
<script>
var q=document.getElementById('q');
q.addEventListener('input',function(){
  var s=q.value.trim().toLowerCase();
  document.querySelectorAll('details.seg').forEach(function(d){
    var hit=false;
    d.querySelectorAll('tbody tr').forEach(function(tr){
      var ok=!s||tr.innerText.toLowerCase().indexOf(s)>=0;
      tr.classList.toggle('hide',!ok); if(ok)hit=true;
    });
    var headOk=!s||d.querySelector('summary').innerText.toLowerCase().indexOf(s)>=0;
    d.classList.toggle('hide', !hit && !headOk);
    if(s && (hit||headOk)) d.open=true;
  });
});
</script></body></html>"""

    stats = [("玩法段", len(segments)), ("唯一怪物ID", len(out["_total_unique_ids"]) if False else sum(s["count"] for s in segments)),
             ("含玩家机甲的段", sum(1 for s in segments if s["has_player_mech"]))]
    chip_html = "".join("<div class='chip'>%s <b>%s</b></div>" % (k, v) for k, v in stats)
    doc = (doc.replace("__SRC__", html.escape(out["_source"]))
              .replace("__SEG__", str(len(segments)))
              .replace("__IDS__", str(out["_total_unique_ids"]))
              .replace("__STATS__", chip_html)
              .replace("__BODY__", "\n".join(cards)))
    with open(path, "w", encoding="utf-8") as f:
        f.write(doc)


if __name__ == "__main__":
    main()
