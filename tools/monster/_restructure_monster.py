#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""重构 MonsterBase：删除与 RobotBase 重复的野生机甲，保留怪物/虫族 + 特殊野生机甲，
统一加 Kind / Capturable 标记。输出 monsterbase_export.clean.json（用于导入）。"""
import json, re, os, shutil

HERE = os.path.dirname(os.path.abspath(__file__))
EXPORT = os.path.join(HERE, "monsterbase_export.json")
SCHEMA = os.path.join(HERE, "_robotbase_schema.json")
CLEAN = os.path.join(HERE, "monsterbase_export.clean.json")
PRE = os.path.join(HERE, "monsterbase_export.pre_restructure.json")


def fam(n):
    return re.split(r"[|｜]", n)[0].strip() if n else ""


exp = json.load(open(EXPORT, encoding="utf-8"))
docs = exp["docs"]
sch = json.load(open(SCHEMA, encoding="utf-8"))
rb_fams = set(fam(x) for x in sch.get("names", []))

kept, dropped = [], []
special_robot = 0
for d in docs:
    me = d.get("MonsterExtra") or {}
    is_robot = me.get("isRobot") == 1
    if is_robot and fam(d.get("RobotName", "")) in rb_fams:
        dropped.append(d.get("RobotName", ""))  # 改从 RobotBase 取，删除
        continue
    new = dict(d)
    if is_robot:
        new["Kind"] = "robot"
        new["Capturable"] = 1
        special_robot += 1
    else:
        new["Kind"] = "monster"
        new["Capturable"] = 0
    kept.append(new)

# 备份当前(重构前) export
if not os.path.exists(PRE):
    shutil.copy(EXPORT, PRE)
    print("已备份重构前 export ->", os.path.basename(PRE))

out = {"docs": kept}
json.dump(out, open(CLEAN, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

print("==== 重构结果 ====")
print("原 MonsterBase 条数:", len(docs))
print("删除(->RobotBase 野生机甲):", len(dropped), " 家族去重:", len(set(fam(x) for x in dropped)))
print("保留:", len(kept), " | 特殊野生机甲(robot标记):", special_robot,
      " | 怪物/虫族(monster标记):", len(kept) - special_robot)
print("写出 ->", os.path.basename(CLEAN))
print("删除样本(前15):", dropped[:15])
print("保留特殊野生机甲:", [d["RobotName"] for d in kept if d.get("Kind") == "robot"])
