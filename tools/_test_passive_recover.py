# -*- coding: utf-8 -*-
"""
被动技能（生命恢复 / 能量恢复）回合结束结算 —— 自测。

覆盖：
  1. 正常恢复（双方存活、技能已学）
  2. **死亡空血优先**：hp <= 0 跳过；战斗已结束则整体不结算
  3. 满属性不产生效果
  4. 没有 MaxMP 的老单位不参与能量恢复
  5. 不认识的技能 ID 被忽略
  6. 中文名 / 拼音短名别名
  7. _build_actor_from_doc 是否正确带出 mp / max_mp / skills

直接跑：python tools/_test_passive_recover.py
"""
import os
import sys
import random

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "server"))

from services.battle_room_service import BattleRoomService, resolve_passive_skill_id  # noqa: E402

ok = fail = 0


def check(name, cond, extra=""):
    global ok, fail
    if cond:
        ok += 1
        print(f"  ✓ {name}")
    else:
        fail += 1
        print(f"  ✗ {name}  {extra}")


def actor(hp=1000, max_hp=1000, mp=0, max_mp=0, skills=None, side="player"):
    return {
        "side": side, "character_id": "c1", "name": "机甲", "level": 1,
        "max_hp": max_hp, "hp": hp, "max_mp": max_mp, "mp": mp,
        "skills": list(skills or []), "attack": 10, "defense": 1, "initiative": 10,
    }


def room(player, enemy, status="in_progress"):
    return {"status": status, "round": 1, "player": player, "enemy": enemy}


svc = BattleRoomService()
svc._rng = random.Random(20260930)   # 固定随机源：暴击/浮动不抖动

print("1) 正常恢复（双方存活）")
p = actor(hp=500, max_hp=1000, mp=100, max_mp=1000, skills=["life_recover", "energy_recover"])
e = actor(hp=500, max_hp=1000, skills=["life_recover"], side="enemy")
r = room(p, e)
svc._apply_end_of_round_passives(r)
check("玩家 HP 500→650（15%）", p["hp"] == 650, p["hp"])
check("玩家 MP 100→250", p["mp"] == 250, p["mp"])
check("敌人 HP 500→650", e["hp"] == 650, e["hp"])
check("敌人无能量技能 → 无 mp 效果", len(r["round_passive_effects"]["enemy"]) == 1)
check("玩家两条效果", len(r["round_passive_effects"]["player"]) == 2,
      r["round_passive_effects"]["player"])
check("效果体含 anim/attr/value",
      r["round_passive_effects"]["player"][0]["anim"] == "shengminghuifu"
      and r["round_passive_effects"]["player"][0]["value"] == 150,
      r["round_passive_effects"]["player"][0])

print("2) 死亡空血优先")
p = actor(hp=0, max_hp=1000, mp=0, max_mp=1000, skills=["life_recover", "energy_recover"])
e = actor(hp=300, max_hp=1000, skills=["life_recover"], side="enemy")
r = room(p, e, status="finished")      # 玩家倒下 → 战斗结束
svc._apply_end_of_round_passives(r)
check("战斗已结束 → 玩家效果为空（不复活）", r["round_passive_effects"]["player"] == [])
check("战斗已结束 → 敌人也不结算", r["round_passive_effects"]["enemy"] == [], "死亡优先")
check("玩家 HP 仍为 0", p["hp"] == 0)
check("玩家 MP 仍为 0（不回复）", p["mp"] == 0)

# 战斗仍在进行，但某一方空血（例如服务器尚未判结束）
p = actor(hp=0, max_hp=1000, mp=0, max_mp=1000, skills=["life_recover", "energy_recover"])
e = actor(hp=300, max_hp=1000, skills=["life_recover"], side="enemy")
r = room(p, e, status="in_progress")
svc._apply_end_of_round_passives(r)
check("进行中但空血 → 跳过该单位", r["round_passive_effects"]["player"] == [])
check("空血单位 HP/MP 不变", p["hp"] == 0 and p["mp"] == 0)
check("存活方照常结算", e["hp"] == 450, e["hp"])

print("3) 满属性不产生效果")
p = actor(hp=1000, max_hp=1000, mp=1000, max_mp=1000, skills=["life_recover", "energy_recover"])
r = room(p, actor())
svc._apply_end_of_round_passives(r)
check("满血满蓝 → 无效果", r["round_passive_effects"]["player"] == [])

print("4) 老单位没有 MaxMP")
p = actor(hp=500, max_hp=1000, mp=0, max_mp=0, skills=["energy_recover"])
r = room(p, actor())
svc._apply_end_of_round_passives(r)
check("MaxMP=0 → 能量恢复不生效", r["round_passive_effects"]["player"] == [])
check("MP 仍为 0（未出现 NaN/负数）", p["mp"] == 0)

print("5) 未学 / 未知技能")
p = actor(hp=500, max_hp=1000, skills=[])
r = room(p, actor())
svc._apply_end_of_round_passives(r)
check("没学技能 → 无效果", r["round_passive_effects"]["player"] == [])
p = actor(hp=500, max_hp=1000, skills=["乱写的技能"])
r = room(p, actor())
svc._apply_end_of_round_passives(r)
check("未知技能被忽略", r["round_passive_effects"]["player"] == [])

print("6) 别名（中文名 / 拼音短名）")
check("生命恢复 → life_recover", resolve_passive_skill_id("生命恢复") == "life_recover")
check("shengminghuifu → life_recover", resolve_passive_skill_id("shengminghuifu") == "life_recover")
check("能量恢复 → energy_recover", resolve_passive_skill_id("能量恢复") == "energy_recover")
check("大小写不敏感", resolve_passive_skill_id("LIFE_RECOVER") == "life_recover")
check("空/None → None", resolve_passive_skill_id("") is None and resolve_passive_skill_id(None) is None)
p = actor(hp=500, max_hp=1000, skills=["生命恢复"])
r = room(p, actor())
svc._apply_end_of_round_passives(r)
check("中文名可直接写在 Skills 里生效", p["hp"] == 650, p["hp"])

print("7) 恢复量上限截断")
p = actor(hp=990, max_hp=1000, skills=["life_recover"])
r = room(p, actor())
svc._apply_end_of_round_passives(r)
check("990 +150 → 截到 1000", p["hp"] == 1000, p["hp"])
check("效果量记为实际恢复 10", r["round_passive_effects"]["player"][0]["value"] == 10,
      r["round_passive_effects"]["player"][0])

print("8) _build_actor_from_doc 带出 mp / max_mp / skills")
doc = {
    "RobotName": "测试机甲", "Level": 5,
    "MaxHP": 1200, "CurrentHP": 900, "MaxMP": 800, "CurrentMP": 300,
    "CurrentMelee": 100, "CurrentShooting": 50, "CurrentArmor": 30, "CurrentInitiative": 12,
    "Skills": ["life_recover", "能量恢复", "xx"],
}
a = svc._build_actor_from_doc("player", "c1", doc)
check("hp/max_hp", a["hp"] == 900 and a["max_hp"] == 1200, a)
check("mp/max_mp", a["mp"] == 300 and a["max_mp"] == 800, a)
check("skills 保留原始列表", a["skills"] == ["life_recover", "能量恢复", "xx"], a["skills"])
a2 = svc._build_actor_from_doc("enemy", None, {"MaxHP": 100, "CurrentHP": 100})
check("老数据无 MP → 0 且不报错", a2["max_mp"] == 0 and a2["mp"] == 0 and a2["skills"] == [], a2)
a3 = svc._build_actor_from_doc("player", "c", {"MaxHP": 10, "CurrentHP": 10, "Skills": "life_recover"})
check("Skills 为字符串也能吃", a3["skills"] == ["life_recover"], a3["skills"])
a4 = svc._build_actor_from_doc("player", "c", {"MaxHP": 10, "CurrentHP": 10, "MaxMP": 50, "CurrentMP": 999})
check("MP 超过上限被截断", a4["mp"] == 50, a4)

print("9) 端到端：真实跑一轮 PVE 房间")
import asyncio  # noqa: E402

svc2 = BattleRoomService()
svc2._rng = random.Random(20260930)
player_doc = {
    "RobotName": "玩家机甲", "Level": 10,
    "MaxHP": 1000, "CurrentHP": 200, "MaxMP": 500, "CurrentMP": 0,
    "CurrentMelee": 100, "CurrentShooting": 0, "CurrentArmor": 1000, "CurrentInitiative": 20,
    "Skills": ["生命恢复", "能量恢复"],
}
enemy_doc = {
    "RobotName": "测试敌人", "Level": 10,
    "MaxHP": 1000, "CurrentHP": 1000, "MaxMP": 500, "CurrentMP": 0,
    "CurrentMelee": 100, "CurrentShooting": 0, "CurrentArmor": 0, "CurrentInitiative": 1,
    "Skills": [],
}
room = svc2.create_pve_room("uid", "cid", player_doc, enemy_doc)
check("房间创建后 actor 带 skills", room["player"]["skills"] == ["生命恢复", "能量恢复"], room["player"]["skills"])
room = svc2.submit_player_action(room["room_id"], "ATTACK")
p, e = room["player"], room["enemy"]
# 注：普攻已接入 RPG 公式（缩放口径 A）→ 伤害 = 攻击 − 装甲，带 ±20% 浮动与暴击，
#     因此这里断言区间/语义，不再断言精确值。
check("玩家先手 → 敌人掉 80~120（攻击100 − 装甲0，±20% 浮动）", 880 <= e["hp"] <= 920, e["hp"])
taken = 200 - (p["hp"] - 150)   # 玩家先受击、回合末才回血
check("敌人反击 → 被高防保底挡住（1~3 点）", 1 <= taken <= 3, taken)
effects = room.get("round_passive_effects", {}).get("player", [])
check("玩家 HP 恢复 150（15% × 1000）",
      any(x.get("attr") == "hp" and x.get("value") == 150 for x in effects), effects)
check("玩家 MP 恢复 75（15% × 500）",
      any(x.get("attr") == "mp" and x.get("value") == 75 for x in effects), effects)
check("恢复后不超上限", p["hp"] <= p["max_hp"] and p["mp"] <= p["max_mp"], (p["hp"], p["mp"]))
check("上一回合记录 2 条效果", len(effects) == 2, effects)
check("敌人无技能 → 无效果", room["round_passive_effects"]["enemy"] == [])
check("房间仍在进行", room["status"] == "in_progress")

print("10) 端到端：击杀回合不结算被动（死亡空血优先）")
svc3 = BattleRoomService()
svc3._rng = random.Random(20260930)
player_doc2 = dict(player_doc)
player_doc2.update({"CurrentHP": 1, "CurrentArmor": 0})
enemy_doc2 = dict(enemy_doc)
enemy_doc2.update({"CurrentMelee": 1000, "CurrentInitiative": 99})
room3 = svc3.create_pve_room("uid", "cid", player_doc2, enemy_doc2)
room3 = svc3.submit_player_action(room3["room_id"], "ATTACK")
check("玩家被击杀 → 战斗结束", room3["status"] == "finished" and room3["result"]["winner"] == "enemy",
      room3.get("result"))
check("玩家 HP = 0 且**未**被恢复（无复活）", room3["player"]["hp"] == 0, room3["player"]["hp"])
check("玩家 MP 也未被恢复", room3["player"]["mp"] == 0, room3["player"]["mp"])
check("击杀回合 passive effects 全空",
      room3.get("round_passive_effects") == {"player": [], "enemy": []},
      room3.get("round_passive_effects"))

print()
print("11) 视角交换：round_passive_effects 必须跟着换 side")
from services.battle_room_service import BattleRoomService as _BRS  # noqa: E402
svc4 = _BRS()
room4 = svc4.create_pvp_room(
    "u1", "c1", player_doc, "u2", "c2", enemy_doc,
) if hasattr(svc4, "create_pvp_room") else None
if room4:
    room4["round_passive_effects"] = {"player": [{"attr": "hp", "value": 50}], "enemy": [{"attr": "mp", "value": 25}]}
    view = svc4.build_pvp_room_view_for_character(room4, "c2")   # 以敌方视角查看
    check("敌方视角下自己拿到原本 enemy 的效果",
          view["round_passive_effects"]["player"] == [{"attr": "mp", "value": 25}],
          view["round_passive_effects"])
else:
    print("  (跳过：create_pvp_room 签名不匹配)")

print()
print(f"结果：通过 {ok} / 失败 {fail}")
sys.exit(1 if fail else 0)
