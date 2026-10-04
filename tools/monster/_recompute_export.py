# -*- coding: utf-8 -*-
"""对本地 monsterbase_export.json 套用 convert_attributes（只重算属性，不动结构/立绘），写回。
不生成资源、不写库。"""
import json, os, sys, shutil
from collections import Counter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import monster_port as M

EXPORT = os.path.join(M.COCOS_ROOT, "tools/monster/monsterbase_export.json")
BACKUP = os.path.join(M.COCOS_ROOT, "tools/monster/monsterbase_export.pre_recompute.json")


def classify(nm, me, en_by_name, en_by_fam, hp_fams, cls_fam):
    """复刻 convert_attributes 的策略判定（仅用于统计，不写值）。"""
    if nm in hp_fams or M._fam(nm) in hp_fams:
        return "keep_hardcoded"
    if me.get("isRobot") == 1 and M._fam(nm) in cls_fam:
        return "formula"
    if M._match_enemy(nm, en_by_name, en_by_fam):
        return "enemies_params"
    if M._aggressive_match(nm, en_by_name, en_by_fam):
        return "aggressive_params"
    rb = (me.get("raw_baseAtt") or "").split(",")
    try:
        rbnum = [int(x) for x in rb[:8]]
    except Exception:
        rbnum = []
    if len(rbnum) >= 8 and rbnum[:8] != M._PLACEHOLDER[:8]:
        return "baseatt_real"
    return "estimated"


def main():
    # 永远从原始备份重放，保证幂等、不被上一轮结果污染
    shutil.copy(BACKUP, EXPORT)
    exp = json.load(open(EXPORT, encoding="utf-8"))
    docs = exp["docs"]
    en_by_name, en_by_fam, hp_fams, classes, cls_fam, hp_en_by_name, hp_en_by_fam = M._load_rpg_data()
    strat = Counter()
    for d in docs:
        nm = d.get("RobotName", "")
        me = d.get("MonsterExtra", {})
        strat[classify(nm, me, en_by_name, en_by_fam, hp_fams, cls_fam)] += 1
        M.convert_attributes(d)
    exp["docs"] = docs
    exp["generated_at"] = __import__("datetime").datetime.now().isoformat(timespec="seconds")
    exp["converted"] = True
    json.dump(exp, open(EXPORT, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
    print("策略分布:", dict(strat), " 共", len(docs))
    print("已写回:", EXPORT)
    # 抽样核对（覆盖各策略代表）
    picks = []
    seen = set()
    want = ("铁臂", "枯骨魔龙", "多基态狼", "暗夜潜伏蝎", "水银怪", "山猫-RT·土著死士",
            "独眼铁臂", "寄生卡古", "变异水银怪", "无序触手怪", "野马Ⅲ", "死亡蜥蜴", "飞翼暴龙")
    for d in docs:
        key = d["RobotName"]
        if key in seen:
            continue
        if key in want:
            picks.append(d); seen.add(key)
    for d in picks:
        print("  %-16s MaxHP=%-7s Melee=%-6s Shooting=%-6s est=%s raw=%s" % (
            d["RobotName"], d.get("MaxHP"), d.get("Melee"), d.get("Shooting"),
            d["MonsterExtra"].get("estimated", 0), d["MonsterExtra"].get("raw_baseAtt")))


if __name__ == "__main__":
    main()
