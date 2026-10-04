# -*- coding: utf-8 -*-
"""生成 怪物属性换算对照表.md：RPGMaker 基准值 vs Cocos 落库值 逐只对照。"""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import monster_port as M

EXPORT = os.path.join(M.COCOS_ROOT, "tools/monster/monsterbase_export.json")
OUT = os.path.join(M.COCOS_ROOT, "docs", "怪物属性换算对照表.md")

en_by_name, en_by_fam, hp_fams, classes, cls_fam, hp_en_by_name, hp_en_by_fam = M._load_rpg_data()


def rpg_source(d):
    """返回 (策略, rpg_dict) —— rpg_dict 为 RPGMaker 基准属性（HP/MP/Melee/Shooting/Armor/Evasion/Accuracy/Lethality）。"""
    nm = d.get("RobotName", "")
    me = d.get("MonsterExtra", {})
    level = d.get("Level", 1)
    # 写死
    if nm in hp_fams or M._fam(nm) in hp_fams:
        en = hp_en_by_name.get(nm) or hp_en_by_fam.get(M._fam(nm))
        if en and en.get("params"):
            return "写死<hp>", dict(zip(["HP","MP","Melee","Shooting","Armor","Evasion","Accuracy","Lethality"], en["params"]))
    # 机器人公式
    if me.get("isRobot") == 1 and M._fam(nm) in cls_fam:
        idx = cls_fam[M._fam(nm)]
        ce = classes[idx]
        if ce:
            formulas = M._parse_formula(ce.get("note", ""))
            lv = M._calc_formula(formulas, level)
            # RPGMaker 基准用 Enemies 同名（若有），Cocos 用公式
            en = M._match_enemy(nm, en_by_name, en_by_fam)
            rpg = dict(zip(["HP","MP","Melee","Shooting","Armor","Evasion","Accuracy","Lethality"], en["params"])) if en and en.get("params") else {}
            return "机甲公式(Lv%d)" % level, rpg
    # 非机甲 Enemies
    en = M._match_enemy(nm, en_by_name, en_by_fam)
    if en and en.get("params"):
        return "Enemies.params", dict(zip(["HP","MP","Melee","Shooting","Armor","Evasion","Accuracy","Lethality"], en["params"]))
    # baseAtt
    rb = (me.get("raw_baseAtt") or "").split(",")
    try:
        vals = [int(x) for x in rb[:8]]
    except Exception:
        vals = []
    if len(vals) < 8:
        vals += [50] * (8 - len(vals))
    return "解包baseAtt", dict(zip(["HP","MP","Melee","Shooting","Armor","Evasion","Accuracy","Lethality"], vals))


# Cocos 落库字段（注意 HP 在 doc 中存为 MaxHP）；RPG 基准 dict 用 HP
FIELDS_COCOS = ["MaxHP","Melee","Shooting","Armor","Evasion","Accuracy","Lethality"]
FIELDS_RPG = ["HP","Melee","Shooting","Armor","Evasion","Accuracy","Lethality"]

def main():
    exp = json.load(open(EXPORT, encoding="utf-8"))
    docs = exp["docs"]
    strat = {}
    rows = []
    for i, d in enumerate(docs, 1):
        strat_name, rpg = rpg_source(d)
        strat[strat_name] = strat.get(strat_name, 0) + 1
        cocos = {f: d.get(f) for f in FIELDS_COCOS}
        rpg_s = " / ".join(str(rpg.get(f, "-")) for f in FIELDS_RPG)
        cocos_s = " / ".join(str(cocos.get(f, "-")) for f in FIELDS_COCOS)
        flag = ""
        if strat_name == "解包baseAtt" and rpg.get("HP") == 50:
            flag = " ⚠占位"
        rows.append((i, d.get("RobotName",""), strat_name, rpg_s, cocos_s, flag))
    lines = []
    lines.append("# 怪物属性换算对照表（RPGMaker 基准 → Cocos 落库）\n")
    lines.append("> 生成时间：%s  | 共 %d 只\n" % (exp.get("generated_at",""), len(docs)))
    lines.append("> 策略分布：%s\n" % "，".join("%s=%d" % (k, v) for k, v in sorted(strat.items())))
    lines.append("> 说明：非机甲怪 `Enemies.params` 与 `解包baseAtt` 为直接取值（RPG=Cocos）；机甲怪 RPG 列为 RPGMaker 同名敌人基准、Cocos 列为 Classes.json 公式结果；`⚠占位` 表示无 RPGMaker 参照、baseAtt 为占位默认 HP=50。\n")
    lines.append("| # | 怪物名 | 策略 | RPG基准[HP/Melee/Shoot/Armor/Eva/Acc/Leth] | Cocos落库[同序] | 备注 |")
    lines.append("|---|--------|------|------|------|------|")
    for r in rows:
        lines.append("| %d | %s | %s | %s | %s | %s |" % r)
    open(OUT, "w", encoding="utf-8").write("\n".join(lines) + "\n")
    print("已生成:", OUT, " 行数:", len(rows))
    print("策略:", strat)

if __name__ == "__main__":
    main()
