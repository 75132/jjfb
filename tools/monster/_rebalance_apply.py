# -*- coding: utf-8 -*-
"""
按怪物独立成长公式重建 MonsterBase 属性，输出新 export（整集重建用）。
==================================================================================
- 读取 monsterbase_export.json（canonical，383 条）
- 逐条 recompute_monster()，覆盖属性字段（HP/MP/9项战斗属性 + Current*）
- 写入 MonsterExtra：_nominalLevel / _tier / _rebalanced=1（标记本次重建）
- 备份旧文件 -> monsterbase_export.pre_rebalance.json
输出：monsterbase_export.json（覆盖，383 条）
"""
import os
import json
import shutil
import sys
from datetime import datetime

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from monster_formula import recompute_monster, nominal_level, tier_of

EXPORT = os.path.join(HERE, "monsterbase_export.json")
BACKUP = os.path.join(HERE, "monsterbase_export.pre_rebalance.json")

ATTRS = ["Melee", "Shooting", "Armor", "Evasion", "Accuracy",
         "Lethality", "Corrosion", "Resistance", "Initiative",
         "Counterattack", "Block", "ArmorPenetration", "AttackCount"]


def main():
    raw = json.load(open(EXPORT, encoding="utf-8"))
    docs = raw["docs"] if isinstance(raw, dict) else raw

    # 备份（仅当备份不存在时创建，避免覆盖真正的原始备份）
    if not os.path.exists(BACKUP):
        shutil.copy2(EXPORT, BACKUP)
        print(f"[备份] {BACKUP}")
    else:
        print(f"[备份已存在] {BACKUP}（保留原始，不覆盖）")

    # 若已重建过，从原始备份重算，避免缩放被二次应用
    if any((d.get("MonsterExtra") or {}).get("_rebalanced") for d in docs):
        print("[幂等] 检测到已重建过，改从原始备份重算")
        braw = json.load(open(BACKUP, encoding="utf-8"))
        docs = braw["docs"] if isinstance(braw, dict) else braw
        if isinstance(raw, dict):
            raw["docs"] = docs
        else:
            raw = docs

    changed = 0
    for d in docs:
        new_attrs, lv, tier = recompute_monster(d)

        # 只覆盖属性字段，其他字段（RobotID/Name/AniID/MonsterExtra...)原样保留
        for k, v in new_attrs.items():
            d[k] = v

        # 顶层 Level 同步为名义等级（原来恒为 1，战斗/客户端显示都会用）
        d["Level"] = lv

        # v4 字段迁移：ParticleShield → AttackCount（显式移除旧字段，避免残留）
        d.pop("ParticleShield", None)
        d.pop("CurrentParticleShield", None)
        me0 = d.get("MonsterExtra")
        if isinstance(me0, dict):
            me0.pop("ParticleShield", None)
            me0.pop("CurrentParticleShield", None)

        me = d.setdefault("MonsterExtra", {})
        me["_nominalLevel"] = lv
        me["_tier"] = tier
        me["_eliteClass"] = new_attrs.get("_eliteClass", "normal")
        me["_rebalanced"] = 1
        me["_formulaVersion"] = "monster_formula_v4 (满配天花板倒推 / 普通怪1刀 / 攻击次数分段)"
        changed += 1

    # 保持原有包装结构
    if isinstance(raw, dict):
        raw["docs"] = docs
        raw["_rebalanced_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        raw["_formula"] = "monster_formula_v4 (mech_curve x per-monster coef / 满配基准)"
        out = raw
    else:
        out = docs

    json.dump(out, open(EXPORT, "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    print(f"[完成] 重建 {changed} 条 -> {EXPORT}")

    # 抽样打印
    print("\n--- 抽样 ---")
    for d in docs[:5]:
        me = d["MonsterExtra"]
        print(f"[{me.get('MonsterID'):>4}] {d['RobotName'][:20]:22s} lv={me['_nominalLevel']:>2} "
              f"tier={me['_tier']} HP={d['MaxHP']:>6} 格={d['Melee']:>5} 射={d['Shooting']:>5} "
              f"甲={d['Armor']:>5} 闪={d['Evasion']:>5} 中={d['Accuracy']:>5} 致={d['Lethality']:>5} "
              f"侵={d['Corrosion']:>5} 抗={d['Resistance']:>5} 手={d['Initiative']:>5}")


if __name__ == "__main__":
    main()
