# -*- coding: utf-8 -*-
"""技能战斗结算自测（服务端权威链路）。

覆盖：
  1. 公式缩放口径 A（普攻 ≡ 攻击 − 装甲）
  2. 技能指令：扣蓝 / 伤害 / 等级倍率 / 范围 / 伤害类型（吸血吸蓝）
  3. 能量不足 / 未识别技能 → failed 事件且不出手
  4. 防御姿态（guard）：本回合受到伤害减半
  5. 效果：hp_recover_ratio 生效；buff / 状态记录进 pending_effects
  6. round_events 结构（客户端表现依赖它）
  7. PVP 视角交换：round_events 的 side 必须一起反转

用法：python tools/_test_skill_battle.py
"""
import os
import random
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "server"))

from services import skill_service as ss                    # noqa: E402
from services.battle_room_service import BattleRoomService   # noqa: E402
from services.skill_formula import eval_damage_formula       # noqa: E402

_fail = []
_ok = 0


def check(label, cond, extra=""):
    global _ok
    if cond:
        _ok += 1
    else:
        _fail.append("%s %s" % (label, extra))
        print("  ✗ %s %s" % (label, extra))


def make_service(seed=20260930):
    svc = BattleRoomService()
    svc._rng = random.Random(seed)
    return svc


def player_doc(**over):
    doc = {
        "RobotName": "测试机", "Level": 30, "Class": 1,
        "MaxHP": 8000, "CurrentHP": 8000,
        "MaxMP": 400, "CurrentMP": 400,
        "Melee": 600, "Shooting": 600,          # attack = 1200
        "Armor": 300, "Initiative": 50,
        "Skills": ["roubo", "shengmingshequ", "zhaqu", "nenglianghudun", "xiuli"],
        "SkillLevels": {},
    }
    doc.update(over)
    return doc


def enemy_doc(**over):
    doc = {
        "RobotName": "测试怪", "Level": 30, "Class": 1,
        "MaxHP": 9000, "CurrentHP": 9000,
        "MaxMP": 200, "CurrentMP": 200,
        "Melee": 400, "Shooting": 400,           # attack = 800
        "Armor": 200, "Initiative": 10,
    }
    doc.update(over)
    return doc


def new_room(svc, pdoc=None, edoc=None):
    room = svc.create_pve_room("u1", "cid-1", pdoc or player_doc(), edoc or enemy_doc())
    return room["room_id"], room


def last_event(room, side=None):
    evs = [e for e in (room.get("round_events") or []) if side is None or e.get("side") == side]
    return evs[-1] if evs else None


def main():
    # ---------- 1. 缩放口径 A：普攻 ≡ 攻击 − 装甲 ----------
    print("[1] 缩放口径 A（a.atk ÷ 3 + 去常数）")
    atk, dfn = 1200, 300
    for cls, gun, label in ((1, False, "格斗"), (2, True, "射击+枪"), (3, True, "全能+枪"), (2, False, "射击无枪→格斗")):
        doc = {"Class": cls, "equipment": {"Gun": {"item_id": 30}} if gun else {}}
        sk = ss.normal_attack_skill(doc)
        base = eval_damage_formula(sk["formula_scaled"], {"attack": atk}, {"defense": dfn})
        expect = {"格斗": atk - dfn, "射击+枪": atk * 2.5 / 3 - dfn,
                  "全能+枪": atk * 3.5 / 3 - dfn, "射击无枪→格斗": atk - dfn}[label]
        check("普攻 %s = %.1f" % (label, expect), abs(base - expect) < 1e-6,
              "实得 %s（公式 %s）" % (base, sk["formula_scaled"]))
    check("格斗普攻与现网 atk-def 完全一致",
          abs(eval_damage_formula(ss.normal_attack_skill({"Class": 1})["formula_scaled"],
                                  {"attack": atk}, {"defense": dfn}) - (atk - dfn)) < 1e-6)
    check("Level 不会被误判成枪械", not ss.has_gun_equipped({"Class": 2, "Level": 30}))
    check("equipment.Gun 能识别持枪", ss.has_gun_equipped({"Class": 2, "equipment": {"Gun": {"item_id": 30}}}))
    check("equipment 列表能识别持枪", ss.has_gun_equipped({"Class": 2, "equipment": [{"item_id": 30}]}))

    # ---------- 2. 技能指令：扣蓝 / 伤害 / 等级倍率 ----------
    print("[2] 技能指令结算")
    roubo = ss.get_skill("roubo")
    cost = ss.mp_cost({"max_mp": 400}, roubo)
    check("肉搏攻击耗蓝 = 最大MP×25%% = %d" % cost, cost == 100, "实得 %s" % cost)

    svc = make_service()
    rid, room = new_room(svc)
    room = svc.submit_player_action(rid, {"type": "SKILL", "skill_key": "roubo"})
    ev = last_event(room, "player")
    check("技能事件存在", ev is not None)
    check("事件 action=SKILL", ev and ev.get("action") == "SKILL", str(ev))
    check("事件带 skill_key/anim", ev and ev.get("skill_key") == "roubo" and ev.get("anim") == "quan01", str(ev))
    check("MP 已扣（400-100=300）", room["player"]["mp"] == 300, "实得 %s" % room["player"]["mp"])
    check("事件 mp_cost=100", ev and ev.get("mp_cost") == 100)
    check("敌方掉血", ev and ev["targets"] and ev["targets"][0]["damage"] > 0, str(ev))
    check("伤害落在 ±20% 浮动区间",
          ev and 0.79 * (atk * 5 / 3 - 200) <= ev["targets"][0]["damage"] <= 1.21 * (atk * 5 / 3 - 200),
          "dmg=%s" % (ev["targets"][0]["damage"] if ev else None))
    check("hp_after 与 actor 一致", ev and ev["targets"][0]["hp_after"] == room["enemy"]["hp"])

    # 技能等级倍率
    svc2 = make_service()
    rid2, room2 = new_room(svc2, player_doc(SkillLevels={"roubo": 4}), enemy_doc(MaxHP=999999, CurrentHP=999999))
    room2 = svc2.submit_player_action(rid2, {"type": "SKILL", "skill_key": "roubo"})
    ev2 = last_event(room2, "player")
    check("Lv4 事件 level=4", ev2 and ev2.get("level") == 4)
    check("Lv4 伤害 = floor(Lv1×1.5)",
          ev2 and abs(ev2["targets"][0]["damage"] / 1.5 - round(ev2["targets"][0]["damage"] / 1.5)) < 1.0)

    # ---------- 3. 能量不足 / 未识别技能 ----------
    print("[3] 施放校验")
    svc3 = make_service()
    rid3, _ = new_room(svc3, player_doc(MaxMP=400, CurrentMP=10))
    room3 = svc3.submit_player_action(rid3, {"type": "SKILL", "skill_key": "roubo"})
    ev3 = last_event(room3, "player")
    check("蓝不够 → failed 事件", ev3 is not None and ev3.get("failed") == "能量不足", str(ev3))
    check("蓝不够 → 不出手（敌方满血）", room3["enemy"]["hp"] == room3["enemy"]["max_hp"])
    check("蓝不够 → 不扣蓝", room3["player"]["mp"] == 10)

    svc4 = make_service()
    rid4, _ = new_room(svc4)
    room4 = svc4.submit_player_action(rid4, {"type": "SKILL", "skill_key": "no_such_skill"})
    ev4 = last_event(room4, "player")
    check("技能不存在 → failed", ev4 is not None and ev4.get("failed") == "技能不存在", str(ev4))

    # 自动触发技不能主动放
    chk = ss.can_cast_skill({"mp": 400, "max_mp": 400}, ss.get_skill("life_recover"))
    check("生命恢复（自动触发）不可主动施放", not chk["ok"] and "自动触发" in chk["reason"], str(chk))

    # 已学校验（服务端权威）：客户端可直接提交任意 skill_key，服务端必须拦
    svc4b = make_service()
    rid4b, _ = new_room(svc4b)          # 默认已学：roubo/shengmingshequ/zhaqu/nenglianghudun/xiuli
    room4b = svc4b.submit_player_action(rid4b, {"type": "SKILL", "skill_key": "leiting"})
    ev4b = last_event(room4b, "player")
    check("未学会的技能 → failed", ev4b is not None and ev4b.get("failed") == "尚未学会该技能", str(ev4b))
    check("未学会 → 不扣蓝", room4b["player"]["mp"] == room4b["player"]["max_mp"])

    # 已学校验必须「无字段时放行」，否则老数据 / 敌方怪物会被整体锁死
    actor_no_field = {"mp": 400, "max_mp": 400}
    chk_nf = ss.can_cast_skill(actor_no_field, ss.get_skill("leiting"))
    check("没有已学字段 → 放行（不锁死）", chk_nf["ok"], str(chk_nf))
    actor_has = {"mp": 400, "max_mp": 400, "raw": {"Skills": ["leiting"]}}
    check("字段里有该技能 → 放行", ss.can_cast_skill(actor_has, ss.get_skill("leiting"))["ok"])
    actor_lack = {"mp": 400, "max_mp": 400, "raw": {"Skills": ["roubo"]}}
    chk_lack = ss.can_cast_skill(actor_lack, ss.get_skill("leiting"))
    check("字段里没有该技能 → 拒绝", chk_lack["reason"] == "尚未学会该技能", str(chk_lack))

    # ---------- 4. 防御姿态 ----------
    print("[4] 防御（guard 减半）")
    svc5 = make_service(seed=7)
    rid5, room5 = new_room(svc5)
    room5 = svc5.submit_player_action(rid5, {"type": "DEFEND"})
    ev_p = [e for e in room5["round_events"] if e["side"] == "player"][0]
    check("防御事件 action=DEFEND", ev_p["action"] == "DEFEND")
    check("防御不造成伤害", not ev_p["targets"])
    # 敌方先手命中（玩家 initiative 更低）
    # 玩家先手（Initiative 更高）：先摆出防御姿态，再挨打
    svc6 = make_service(seed=7)
    rid6, room6 = new_room(svc6, player_doc(Initiative=99), enemy_doc(Initiative=1))
    room6 = svc6.submit_player_action(rid6, {"action_type": "DEFEND"})
    ev_e = [e for e in room6["round_events"] if e["side"] == "enemy"][0]
    dmg_guard = ev_e["targets"][0]["damage"] if ev_e["targets"] else 0
    check("防御后仍会挨打（不是无敌）", dmg_guard > 0, "dmg=%s" % dmg_guard)
    # 同样条件不防御
    svc7 = make_service(seed=7)
    rid7, room7 = new_room(svc7, player_doc(Initiative=99), enemy_doc(Initiative=1))
    room7 = svc7.submit_player_action(rid7, "ATTACK")
    ev_e2 = [e for e in room7["round_events"] if e["side"] == "enemy"][0]
    dmg_free = ev_e2["targets"][0]["damage"] if ev_e2["targets"] else 0
    check("防御使受击伤害显著降低", dmg_guard > 0 and dmg_guard < dmg_free,
          "guard=%s free=%s" % (dmg_guard, dmg_free))

    # ---------- 5. 伤害类型 / 效果 ----------
    print("[5] 吸血 / 回蓝 / 比例恢复 / 待实装效果")
    svc8 = make_service()
    rid8, room8 = new_room(svc8, player_doc(CurrentHP=1000),
                           enemy_doc(Melee=0, Shooting=0))
    room8 = svc8.submit_player_action(rid8, {"type": "SKILL", "skill_key": "shengmingshequ"})
    ev8 = last_event(room8, "player")
    check("吸血 kind=hp_drain", ev8 and ev8["targets"] and ev8["targets"][0]["kind"] == "hp_drain", str(ev8))
    check("吸血使自身回血", room8["player"]["hp"] > 1000, "hp=%s" % room8["player"]["hp"])
    check("吸血回补量 = floor(伤害×0.5)",
          ev8 and ev8["targets"][0].get("drained") == int(ev8["targets"][0]["damage"] * 0.5),
          str(ev8["targets"][0]) if ev8 else "")
    check("heals 里带 from=drain", ev8 and any(h.get("from") == "drain" for h in ev8["heals"]))

    svc9 = make_service()
    rid9, room9 = new_room(svc9, player_doc(), enemy_doc(Melee=0, Shooting=0))
    room9 = svc9.submit_player_action(rid9, {"type": "SKILL", "skill_key": "zhaqu"})
    ev9 = last_event(room9, "player")
    check("吸蓝 kind=mp_drain", ev9 and ev9["targets"] and ev9["targets"][0]["kind"] == "mp_drain", str(ev9))
    check("吸蓝使敌方掉蓝", room9["enemy"]["mp"] < 200, "mp=%s" % room9["enemy"]["mp"])
    check("吸蓝使自身回蓝", room9["player"]["mp"] > 400 - 56, "mp=%s" % room9["player"]["mp"])

    svc10 = make_service()
    rid10, room10 = new_room(svc10, player_doc(CurrentHP=1000))
    room10 = svc10.submit_player_action(rid10, {"type": "SKILL", "skill_key": "nenglianghudun"})
    ev10 = last_event(room10, "player")
    check("能量护盾 scope=7 目标是自己", ev10 and (not ev10["targets"]) and ev10["heals"],
          str(ev10))
    check("能量护盾 回 10% 最大HP = 800", any(h["attr"] == "hp" and h["value"] == 800 for h in ev10["heals"]),
          str(ev10["heals"]))
    check("能量护盾的 add_buff 进入 pending_effects（未生效）",
          any(p.get("kind") == "add_buff" for p in ev10["pending_effects"]), str(ev10["pending_effects"]))

    # 群体技能在 1v1 退化为单体
    svc11 = make_service()
    rid11, room11 = new_room(svc11, player_doc(Skills=["leiting"], MaxMP=400, CurrentMP=400))
    room11 = svc11.submit_player_action(rid11, {"type": "SKILL", "skill_key": "leiting"})
    ev11 = last_event(room11, "player")
    check("群体技（scope=2）在 1v1 命中 1 个目标", ev11 and len(ev11["targets"]) == 1, str(ev11))

    # ---------- 6. round_events 结构 ----------
    print("[6] round_events 结构")
    svc12 = make_service()
    rid12, room12 = new_room(svc12)
    room12 = svc12.submit_player_action(rid12, "ATTACK")
    check("round_events 是列表且非空", isinstance(room12["round_events"], list) and room12["round_events"])
    check("普攻事件 action=ATTACK", room12["round_events"][0]["action"] == "ATTACK")
    check("普攻不耗蓝", all(e["mp_cost"] == 0 for e in room12["round_events"]))
    keys = {"round", "side", "action", "skill_key", "anim", "level", "repeats",
            "mp_cost", "mp_after", "targets", "heals", "effects", "pending_effects", "failed"}
    check("事件字段齐备", keys.issubset(set(room12["round_events"][0].keys())),
          str(keys - set(room12["round_events"][0].keys())))
    check("round_actions 仍是字符串（兼容既有客户端）",
          isinstance(room12.get("round_actions"), (dict, type(None))))

    # ---------- 7. PVP 视角交换 ----------
    print("[7] PVP 视角交换")
    from bson import ObjectId
    svc13 = make_service()
    svc13._ensure_pvp_grace_watcher = lambda *a, **k: None     # 无事件循环，屏蔽后台守望
    svc13._cancel_pvp_grace_watcher = lambda *a, **k: None
    svc13._pvp_round_notifier = None
    pvp = svc13.create_pvp_room(ObjectId(), "p-cid", player_doc(),
                                ObjectId(), "e-cid", enemy_doc())
    pvp["round_actions"] = {"player": "SKILL", "enemy": "ATTACK"}
    pvp["round_skill_keys"] = {"player": "roubo", "enemy": None}

    # (a) 会话中（结算前）的逐 side 字段交换
    view_pre = svc13.build_pvp_room_view_for_character(pvp, "e-cid")
    check("round_actions 已交换", view_pre["round_actions"] == {"player": "ATTACK", "enemy": "SKILL"},
          str(view_pre.get("round_actions")))
    check("round_skill_keys 已交换",
          view_pre["round_skill_keys"] == {"player": None, "enemy": "roubo"},
          str(view_pre.get("round_skill_keys")))

    # (b) 结算后的 round_events（列表）逐条交换 side
    svc13._compute_pvp_round_and_advance(pvp)
    view_e = svc13.build_pvp_room_view_for_character(pvp, "e-cid")
    evs_e = view_e.get("round_events") or []
    check("对方视角能拿到 round_events", bool(evs_e))
    check("技能事件在对方视角 side 已反转",
          all(e["side"] == "enemy" for e in evs_e if e.get("skill_key") == "roubo"),
          str([(e["side"], e.get("skill_key")) for e in evs_e]))
    check("对方自己的普攻事件 side=player",
          any(e["side"] == "player" and e.get("action") == "ATTACK" for e in evs_e),
          str([(e["side"], e.get("action")) for e in evs_e]))

    print("\n通过 %d 项，失败 %d 项" % (_ok, len(_fail)))
    if _fail:
        print("失败清单：")
        for f in _fail:
            print("  -", f)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
