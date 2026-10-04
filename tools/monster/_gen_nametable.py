# -*- coding: utf-8 -*-
"""从导出 JSON 生成「怪物名 → 拼音 key / AniID / 立绘」对照表 markdown。"""
import os
import json

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, "tools", "monster", "monsterbase_export.json")
DST = os.path.join(ROOT, "docs", "怪物资源命名对照表.md")

d = json.load(open(SRC, encoding="utf-8"))
docs = {x["MonsterExtra"]["MonsterID"]: x for x in d["docs"]}
rows = d["name_table"]

lines = []
lines.append("# 怪物资源命名对照表（中文名 → 拼音首字母）")
lines.append("")
lines.append("由 `tools/monster/monster_port.py --mode assets --scope full` 生成，源文件 `tools/monster/monsterbase_export.json`。")
lines.append("")
lines.append(f"- 生成时间：{d['generated_at']}")
lines.append(f"- 怪物总数：**{len(d['docs'])}**；有立绘：**{d['count_with_art']}**；临时机甲（无立绘）：**{d['count_no_art']}**")
lines.append(f"- 命名表条目：**{len(rows)}**（同一份立绘被多个等级复用时会出现多行同名）")
lines.append("- 规则：中文逐字拼音首字母小写 + `_L{形态}`；英文/数字保留；罗马数字归一保留；符号丢弃；重名追加 `_2`/`_3`；避开 99 个机甲动画名。")
lines.append("")
lines.append("| # | 中文名 | 拼音 key | AniID | 帧数 | 立绘 |")
lines.append("|---|--------|----------|-------|------|------|")
for r in rows:
    dr = docs.get(r["MonsterID"], {})
    extra = dr.get("MonsterExtra", {})
    fc = extra.get("FrameCount", "-")
    art = "临时机甲" if extra.get("TempArt") else "真实立绘"
    lines.append(f"| {r['MonsterID']} | {r['Name']} | `{r['PinyinKey']}` | `{r['AniID']}` | {fc} | {art} |")

open(DST, "w", encoding="utf-8").write("\n".join(lines) + "\n")
print("written:", DST, len(lines), "lines")
