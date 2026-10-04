# -*- coding: utf-8 -*-
"""
修复存量 RobotPet 的 AttackCount / Current* 字段
================================================================
背景：云端 server/data/*.json 曾为旧版（只有 particleShield 没有 attackCount），
      导致历史装备操作时 attackCount 加成从未写入 Current* 字段。
现在 JSON 已修复，需要把每只机甲的 Current* 重算为「基础 + 装备加成」。

策略（不改动基础属性 Melee/Armor/... 本身，因为它们是升级/升星算出来的）：
  1. 读该机甲当前装备槽（equipment）
  2. 用修复后的 JSON 配置累加每件装备的 attackCount（及可重算的 Current* 增量）
  3. 对 AttackCount / CurrentAttackCount 做**幂等式重建**：
     - AttackCount = 1 + Σ(装备 attackCount)   ← 因为基础机甲 AttackCount 恒为 1
     - CurrentAttackCount = 同 AttackCount
  4. 只有 AttackCount 相关字段做强制重建（其它 Current* 涉及升级/升星历史，不在此脚本处理）

幂等：重复执行结果一致（每次都从 equipment 重算，不累加）。
"""
import sys, os, json
sys.path.insert(0, "/www/wwwroot/default/server")
os.chdir("/www/wwwroot/default/server")

import ws_server, pymongo

BASE_ATTACK_COUNT = 1          # 机甲基础攻击次数（无装备时 = 1）
FILES = ["Weapon.json", "Gun.json", "Wing.json", "Dun.json", "Armor.json"]

# 1) 载入修复后的装备配置（id -> attackCount）
cfg = {}
for fn in FILES:
    d = json.load(open("data/" + fn, encoding="utf-8"))
    d = d if isinstance(d, list) else d.get("items", [])
    for it in d:
        iid = it.get("id")
        if iid is not None:
            cfg[iid] = int(it.get("attackCount") or 0)
print("LOADED configs:", len(cfg), "| attackCount>0:", sum(1 for v in cfg.values() if v > 0))

cl = pymongo.MongoClient(ws_server.mongo_url, serverSelectionTimeoutMS=8000)
db = cl["jjfb"]

changed = 0
detail = []
for pet in db["RobotPet"].find({}):
    eq = pet.get("equipment") or {}
    if not isinstance(eq, dict):
        eq = {}
    eq_sum = 0
    for slot, item in eq.items():
        if not isinstance(item, dict):
            continue
        iid = item.get("item_id")
        eq_sum += cfg.get(iid, 0)
    target = BASE_ATTACK_COUNT + eq_sum

    cur_ac = pet.get("AttackCount")
    cur_cac = pet.get("CurrentAttackCount")
    if cur_ac == target and cur_cac == target:
        continue

    db["RobotPet"].update_one(
        {"_id": pet["_id"]},
        {"$set": {"AttackCount": target, "CurrentAttackCount": target}},
    )
    changed += 1
    detail.append((pet.get("RobotName"), cur_ac, cur_cac, target,
                   {k: (v.get("name") if isinstance(v, dict) else v) for k, v in eq.items()}))

print("FIXED RobotPet:", changed)
for d in detail[:30]:
    print("  %-24s AC %s->%s, CAC %s->%s | equip=%s" % (d[0], d[1], d[3], d[2], d[3], d[4]))

# 3) 校验分布
import collections
cnt = collections.Counter()
for p in db["RobotPet"].find({}, {"AttackCount": 1, "CurrentAttackCount": 1}):
    cnt[(p.get("AttackCount"), p.get("CurrentAttackCount"))] += 1
print("AFTER (AttackCount,CurrentAttackCount) 分布:", dict(cnt))
