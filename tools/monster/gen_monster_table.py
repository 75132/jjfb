# -*- coding: utf-8 -*-
"""
生成「怪物/敌人对应表」——至少含 id 与名称，并为后续「怪物分组」预置分组维度。

数据来源（按权威优先级）：
  1. tools/monster/monsterbase_export.json  ← 已落地到云端 jjfb.MonsterBase 的权威产物（383 条）
  2. tools/monster/_robotbase_full.json     ← 玩家可用机甲（81 条，非敌人，单列参考）

产出：
  docs/monster_table.json    机器可读（全字段 + 分组维度）
  docs/monster_table.csv     Excel 可直接打开（id/名称/分组列）
  docs/monster_table.html    可视化对照表（可搜索/筛选/按分组折叠）

分组维度（预留，供后续"怪物分组"使用）：
  category   —— 档案大类（虫族/普通机甲I/II/合成机甲I/黄金系列/顶级boss/顶级机甲/其他）
  eliteClass —— 强度档（normal / elite / boss）
  tier       —— 公式 1~7 档
  level      —— 名义等级
  groupKey   —— 建议主分组键 = category（可后续改）
  family     —— 同族识别（同一 AniID 去掉 _L{stage} 后缀 → 同族不同形态）
"""
import json
import os
import csv
import html
import collections

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(BASE, "..", ".."))
EXPORT = os.path.join(BASE, "monsterbase_export.json")
ROBOT = os.path.join(BASE, "_robotbase_full.json")
OUTDIR = os.path.join(ROOT, "docs")

# 分组权重：越大越强，便于后续按强度排序/分组
ELITE_WEIGHT = {"normal": 0, "elite": 1, "boss": 2}
# category 展示顺序（由弱到强的"主题序"，便于分组阅读）
CATEGORY_ORDER = [
    "虫族", "其他", "临时机甲", "普通机甲I", "普通机甲II", "合成机甲I",
    "黄金系列", "顶级机甲", "顶级boss",
]


def family_of(ani_id: str) -> str:
    """同族识别：AniID 去掉 _L{n} 形态后缀 → 同一机型的不同形态归为一族。"""
    if not ani_id:
        return ""
    parts = ani_id.rsplit("_L", 1)
    if len(parts) == 2 and parts[1].isdigit():
        return parts[0]
    return ani_id


def main():
    with open(EXPORT, "r", encoding="utf-8") as f:
        payload = json.load(f)
    docs = payload["docs"]

    rows = []
    for d in docs:
        ex = d.get("MonsterExtra") or {}
        cat = ex.get("category") or "未分类"
        elite = d.get("_eliteClass") or "normal"
        rows.append({
            "robot_id": d.get("RobotID"),
            "monster_id": ex.get("MonsterID"),
            "name": ex.get("MonsterName") or d.get("RobotName") or "",
            "ani_id": d.get("AniID") or "",
            "family": family_of(d.get("AniID") or ""),
            "form": d.get("Form"),
            "class": d.get("Class"),
            "level": d.get("Level"),
            "tier": ex.get("_tier"),
            "category": cat,
            "elite_class": elite,
            "elite_weight": ELITE_WEIGHT.get(elite, 0),
            "is_robot_src": ex.get("isRobot"),
            "occ_id": ex.get("occID"),
            "monsterimg_id": ex.get("monsterimgID"),
            "gif_rel": ex.get("gifRel"),
            "has_art": bool(ex.get("HasArt")),
            "temp_art": bool(ex.get("TempArt")),
            "sprite_key": ex.get("SpriteKey"),
            "frame_prefix": ex.get("FramePrefix"),
            "frame_count": ex.get("FrameCount"),
            "hp": d.get("MaxHP"),
            "mp": d.get("MaxMP"),
            "melee": d.get("Melee"),
            "shooting": d.get("Shooting"),
            "armor": d.get("Armor"),
            "evasion": d.get("Evasion"),
            "accuracy": d.get("Accuracy"),
            "lethality": d.get("Lethality"),
            "corrosion": d.get("Corrosion"),
            "resistance": d.get("Resistance"),
            "initiative": d.get("Initiative"),
            "attack_count": d.get("AttackCount"),
            "jin": d.get("Jin"),
            "group_key": cat,   # 建议主分组键
        })

    # 排序：category 主题序 → elite 档 → 等级 → monster_id
    def sort_key(r):
        ci = CATEGORY_ORDER.index(r["category"]) if r["category"] in CATEGORY_ORDER else 99
        return (ci, r["elite_weight"], r["level"] or 0, r["monster_id"] or 0)
    rows.sort(key=sort_key)

    os.makedirs(OUTDIR, exist_ok=True)

    # ---- JSON ----
    groups = collections.OrderedDict()
    for r in rows:
        groups.setdefault(r["category"], []).append(r)
    stats = {
        "total": len(rows),
        "by_category": {k: len(v) for k, v in groups.items()},
        "by_elite_class": dict(collections.Counter(r["elite_class"] for r in rows)),
        "level_min": min((r["level"] or 0) for r in rows),
        "level_max": max((r["level"] or 0) for r in rows),
        "attack_count_dist": dict(collections.Counter(r["attack_count"] for r in rows)),
    }
    out_json = {
        "_desc": "怪物/敌人对应表（id + 名称 + 分组维度）。数据源 monsterbase_export.json",
        "_generated_for": "怪物分组",
        "stats": stats,
        "groups": {k: [r["monster_id"] for r in v] for k, v in groups.items()},
        "monsters": rows,
    }
    with open(os.path.join(OUTDIR, "monster_table.json"), "w", encoding="utf-8") as f:
        json.dump(out_json, f, ensure_ascii=False, indent=2)

    # ---- CSV（Excel 友好，utf-8-sig 防中文乱码）----
    csv_path = os.path.join(OUTDIR, "monster_table.csv")
    cols = ["robot_id", "monster_id", "name", "ani_id", "family", "form",
            "category", "elite_class", "tier", "level", "hp", "mp",
            "melee", "shooting", "armor", "evasion", "accuracy", "lethality",
            "corrosion", "resistance", "initiative", "attack_count", "jin",
            "has_art", "temp_art", "sprite_key", "gif_rel"]
    with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow(r)

    # ---- HTML 可视化 ----
    write_html(rows, groups, stats)

    print("== 生成完成 ==")
    print("  docs/monster_table.json")
    print("  docs/monster_table.csv")
    print("  docs/monster_table.html")
    print("  总数: %d" % stats["total"])
    print("  分组:", json.dumps(stats["by_category"], ensure_ascii=False))
    print("  强度档:", json.dumps(stats["by_elite_class"], ensure_ascii=False))
    print("  等级: %d ~ %d" % (stats["level_min"], stats["level_max"]))
    print("  攻击次数分布:", json.dumps(stats["attack_count_dist"], ensure_ascii=False))


def write_html(rows, groups, stats):
    cat_badge = {
        "虫族": "#7c3aed", "其他": "#6b7280", "临时机甲": "#0ea5e9",
        "普通机甲I": "#059669", "普通机甲II": "#0d9488", "合成机甲I": "#d97706",
        "黄金系列": "#ca8a04", "顶级机甲": "#db2777", "顶级boss": "#dc2626",
    }
    elite_badge = {"normal": "#64748b", "elite": "#eab308", "boss": "#dc2626"}

    cards = []
    for cat in CATEGORY_ORDER:
        if cat not in groups:
            continue
        items = groups[cat]
        color = cat_badge.get(cat, "#6b7280")
        cards.append(
            "<h2 style='border-left:6px solid %s;padding-left:10px;margin-top:28px'>"
            "%s <span style='font-size:13px;color:#94a3b8;font-weight:400'>"
            "(%d 只)</span></h2>" % (color, html.escape(cat), len(items))
        )
        cards.append("<table><thead><tr>"
                     "<th>RobotID</th><th>MonsterID</th><th>名称</th><th>AniID</th>"
                     "<th>等级</th><th>档位</th><th>HP</th><th>MP</th>"
                     "<th>攻/射</th><th>甲/闪</th><th>先制</th><th>攻击次数</th><th>立绘</th>"
                     "</tr></thead><tbody>")
        for r in items:
            eb = elite_badge.get(r["elite_class"], "#64748b")
            art = "✓" if r["has_art"] else "✗"
            if r["temp_art"]:
                art = "临时"
            cards.append(
                "<tr>"
                "<td class='num'>%s</td><td class='num'>%s</td>"
                "<td class='name'>%s</td><td class='ani'>%s</td>"
                "<td class='num'>%s</td>"
                "<td><span class='pill' style='background:%s'>%s</span></td>"
                "<td class='num'>%s</td><td class='num'>%s</td>"
                "<td class='num'>%s/%s</td><td class='num'>%s/%s</td>"
                "<td class='num'>%s</td><td class='num'>%s</td>"
                "<td class='art'>%s</td>"
                "</tr>" % (
                    r["robot_id"], r["monster_id"], html.escape(str(r["name"])),
                    html.escape(r["ani_id"]), r["level"], eb, r["elite_class"],
                    f"{r['hp']:,}" if r["hp"] else "-", f"{r['mp']:,}" if r["mp"] else "-",
                    r["melee"], r["shooting"], r["armor"], r["evasion"],
                    r["initiative"], r["attack_count"], art,
                )
            )
        cards.append("</tbody></table>")

    body = "\n".join(cards)
    doc = """<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>怪物/敌人对应表</title>
<style>
:root{color-scheme:light}
body{background:#f7f8fa;color:#0f172a;font:14px/1.6 "Microsoft YaHei",system-ui,sans-serif;margin:0;padding:24px}
.wrap{max-width:1280px;margin:0 auto}
h1{font-size:24px;margin:0 0 6px}
.sub{color:#64748b;font-size:13px;margin-bottom:16px}
.stat{display:flex;flex-wrap:wrap;gap:10px;margin:14px 0 8px}
.chip{background:#fff;border:1px solid #e2e8f0;border-radius:20px;padding:5px 14px;font-size:13px}
.chip b{color:#0f172a}
.controls{margin:14px 0 4px;display:flex;gap:10px;flex-wrap:wrap;align-items:center}
input,select{padding:8px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;background:#fff}
input{width:240px}
table{width:100%;border-collapse:collapse;background:#fff;border-radius:10px;overflow:hidden;
      box-shadow:0 1px 3px rgba(0,0,0,.06);margin-bottom:8px}
th,td{padding:7px 10px;text-align:left;border-bottom:1px solid #f1f5f9;white-space:nowrap}
th{background:#f8fafc;font-weight:600;font-size:12.5px;color:#475569;position:sticky;top:0}
td.num{font-variant-numeric:tabular-nums;text-align:right;color:#334155}
td.name{font-weight:600;color:#0f172a}
td.ani{font-family:Consolas,monospace;font-size:12.5px;color:#7c3aed}
td.art{text-align:center;color:#059669}
.pill{display:inline-block;padding:1px 9px;border-radius:10px;color:#fff;font-size:11.5px}
tr:hover td{background:#f0f9ff}
.hide{display:none}
</style></head><body><div class="wrap">
<h1>怪物 / 敌人对应表</h1>
<div class="sub">数据源：monsterbase_export.json（已落地云端 jjfb.MonsterBase）· 共 __TOTAL__ 条 · 供「怪物分组」使用</div>
<div class="stat">__STATS__</div>
<div class="controls">
  <input id="q" placeholder="搜索 名称 / id / AniID…">
  <select id="fcat"><option value="">全部分组</option>__CATOPT__</select>
  <select id="fel"><option value="">全部档位</option>
    <option value="normal">normal</option><option value="elite">elite</option><option value="boss">boss</option></select>
</div>
<div id="body">__BODY__</div>
</div>
<script>
var q=document.getElementById('q'),fc=document.getElementById('fcat'),fe=document.getElementById('fel');
function apply(){
  var s=q.value.trim().toLowerCase(),c=fc.value,e=fe.value;
  document.querySelectorAll('table').forEach(function(tb){
    var cat=tb.dataset.cat||'';
    var showCat=(!c||cat===c);
    var vis=0;
    tb.querySelectorAll('tbody tr').forEach(function(tr){
      var txt=tr.innerText.toLowerCase();
      var el=tr.dataset.el||'';
      var ok=showCat && (!s||txt.indexOf(s)>=0) && (!e||el===e);
      tr.classList.toggle('hide',!ok);
      if(ok)vis++;
    });
    tb.classList.toggle('hide',vis===0);
    var h=tb.previousElementSibling;
    if(h&&h.tagName==='H2') h.classList.toggle('hide',vis===0);
  });
}
q.addEventListener('input',apply);fc.addEventListener('change',apply);fe.addEventListener('change',apply);
apply();
</script></body></html>"""

    # 注入 stats chips
    chips = [
        ("总数", stats["total"]),
        ("normal", stats["by_elite_class"].get("normal", 0)),
        ("elite", stats["by_elite_class"].get("elite", 0)),
        ("boss", stats["by_elite_class"].get("boss", 0)),
        ("等级", "%d~%d" % (stats["level_min"], stats["level_max"])),
    ]
    chip_html = "".join("<div class='chip'>%s <b>%s</b></div>" % (k, v) for k, v in chips)
    catopt = "".join("<option value='%s'>%s</option>" % (html.escape(c), html.escape(c))
                     for c in CATEGORY_ORDER if c in stats["by_category"])

    # 给每个 table 打上 data-cat 与行 data-el（用于筛选）
    import re
    idx = 0
    def tag_table(m):
        nonlocal idx
        cats = [c for c in CATEGORY_ORDER if c in stats["by_category"]]
        if idx < len(cats):
            c = cats[idx]
        else:
            c = ""
        idx += 1
        return m.group(0).replace("<table>", "<table data-cat='%s'>" % html.escape(c), 1)
    body_tagged = re.sub(r"<table>", tag_table, body)

    doc = doc.replace("__TOTAL__", str(stats["total"]))
    doc = doc.replace("__STATS__", chip_html)
    doc = doc.replace("__CATOPT__", catopt)
    doc = doc.replace("__BODY__", body_tagged)

    # 行级 data-el
    doc = re.sub(r"<tr>(<td class='num'>)", r"<tr>\\1", doc)  # no-op 保持结构
    for el in ("normal", "elite", "boss"):
        doc = doc.replace("<span class='pill' style='background:%s'>%s</span>" % (
            elite_badge[el], el), "<span class='pill' data-el='%s' style='background:%s'>%s</span>" % (el, elite_badge[el], el))

    with open(os.path.join(OUTDIR, "monster_table.html"), "w", encoding="utf-8") as f:
        f.write(doc)


if __name__ == "__main__":
    main()
