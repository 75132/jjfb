# -*- coding: utf-8 -*-
"""生成「服务端出手明细」样例（round_events），供客户端读取层做跨端契约测试。

用途
----
客户端 `assets/Script/Game/SkillData.ts` 与 `BattleScene.playRoundEvents()` 消费的是
服务端 `battle_room_service._exec_action()` 产出的 `round_events`。两端字段一旦漂移，
客户端就会「读不到技能名 / 播不出特效 / 血条不更新」。因此这里把服务端**真实产出**
的样例落盘，由 `tools/_test_skilldata_client.cjs` 反向校验客户端能否正确解读。

产物：`tools/_fixtures/round_events_sample.json`（可重复生成，幂等）

用法：python tools/_gen_round_events_fixture.py
"""
import io
import json
import os
import random
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "server"))

from services import skill_service as ss                      # noqa: E402
from services.battle_room_service import BattleRoomService     # noqa: E402

OUT_DIR = os.path.join(ROOT, "tools", "_fixtures")
OUT_PATH = os.path.join(OUT_DIR, "round_events_sample.json")


def make_service(seed=20260930):
    svc = BattleRoomService()
    svc._rng = random.Random(seed)      # 固定随机源 → 样例可复现
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


def scenario(name, action, pdoc=None, edoc=None, seed=20260930):
    """跑一整个回合，返回 (事件列表, 结算后单位快照)。"""
    svc = make_service(seed)
    room = svc.create_pve_room("u1", "cid-1", pdoc or player_doc(), edoc or enemy_doc())
    room_id = room["room_id"]
    after = svc.submit_player_action(room_id, action)
    events = list((after or {}).get("round_events") or [])
    return {
        "name": name,
        "action": action,
        "events": events,
        "player": {
            "hp": (after or {}).get("player", {}).get("hp"),
            "mp": (after or {}).get("player", {}).get("mp"),
        },
        "enemy": {
            "hp": (after or {}).get("enemy", {}).get("hp"),
            "mp": (after or {}).get("enemy", {}).get("mp"),
        },
    }


def main():
    cases = [
        # 普攻：验证 ATTACK 事件（客户端走既有 performAttackWithDamage 链路）
        scenario("attack", "ATTACK"),
        # 技能·单体伤害：验证 SKILL 事件的 skill_key / anim / targets
        scenario("skill_damage", {"type": "SKILL", "skill_key": "roubo"}),
        # 技能·吸血：验证 hp_drain 的 drain_ratio 回补 → heals[attr=hp]
        #   ⚠ 玩家必须**不满血**，否则 gained=0 服务端不会下发 heals（已满时不该播治疗特效）
        scenario("skill_drain_hp", {"type": "SKILL", "skill_key": "shengmingshequ"},
                 pdoc=player_doc(CurrentHP=2000)),
        # 技能·吸蓝：验证 mp_drain → heals[attr=mp]（同理必须不满蓝）
        scenario("skill_drain_mp", {"type": "SKILL", "skill_key": "zhaqu"},
                 pdoc=player_doc(CurrentMP=100)),
        # 技能·纯治疗：验证 effects（hp_recover_ratio）→ heals + effects
        scenario("skill_heal", {"type": "SKILL", "skill_key": "xiuli"},
                 pdoc=player_doc(CurrentHP=2000)),
        # 技能·护盾（damage_type=none，scope=7）：验证无伤害事件仍有 targets/hp_after
        scenario("skill_shield", {"type": "SKILL", "skill_key": "nenglianghudun"}),
        # 防御：验证 DEFEND 事件（无 targets，客户端只提示）
        scenario("defend", "DEFEND"),
        # 能量不足：验证 failed 事件（客户端只提示不改数值）
        scenario("failed_mp", {"type": "SKILL", "skill_key": "roubo"},
                 pdoc=player_doc(CurrentMP=0)),
        # 未学会的技能：验证 failed 事件（reason = 尚未学会 / 能量不足）
        scenario("failed_unknown", {"type": "SKILL", "skill_key": "leiting"}),
    ]

    payload = {
        "generated_by": "tools/_gen_round_events_fixture.py",
        "skills_version": ss.catalog_meta().get("version"),
        "normal_attack_enabled": ss.catalog_meta().get("normal_attack_enabled"),
        "formula_scale": ss.catalog_meta().get("formula_scale"),
        "scenarios": cases,
    }

    os.makedirs(OUT_DIR, exist_ok=True)
    with io.open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    total = sum(len(c["events"]) for c in cases)
    print("已生成 %s" % OUT_PATH)
    print("  场景 %d 个 / 事件 %d 条" % (len(cases), total))
    for c in cases:
        kinds = ", ".join("%s/%s" % (e.get("side"), e.get("action")) for e in c["events"])
        flag = " [failed]" if any(e.get("failed") for e in c["events"]) else ""
        print("  - %-18s %s%s" % (c["name"], kinds or "(空)", flag))
    return 0


if __name__ == "__main__":
    sys.exit(main())
