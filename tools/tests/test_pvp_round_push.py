"""
PVP 回合推送 + 视角交换 测试。

覆盖：
1. build_pvp_room_view_for_character 正确交换 player/enemy actor + round_actions/auto_actions/noop_rounds
2. _compute_pvp_round_and_advance 结算后触发 notifier（含 settled_round 与最终 room）
3. 挂机方（internal enemy）在推送 view 中看到「自己的动作」= round_actions.player

运行：envs/default/Scripts/python tools/tests/test_pvp_round_push.py
"""
import asyncio
import os
import sys
import time

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "server")))

from services.battle_room_service import BattleRoomService  # noqa: E402


def build_room():
    return {
        "room_id": "r1",
        "mode": "pvp",
        "status": "in_progress",
        "round": 1,
        "round_actions": {"player": "ATTACK", "enemy": "ATTACK"},
        "auto_actions": {"player": False, "enemy": True},
        "noop_rounds": {"player": 0, "enemy": 2},
        "player_character_id": "P",
        "enemy_character_id": "E",
        "player_user_id": "UP",
        "enemy_user_id": "UE",
        "player": {"initiative": 10, "hp": 900},
        "enemy": {"initiative": 5, "hp": 800},
    }


def test_view_swap_actor():
    s = BattleRoomService()
    room = build_room()
    # P 自己看 → 原样
    v_p = s.build_pvp_room_view_for_character(room, "P")
    assert v_p["player"]["hp"] == 900
    # E 看 → 交换
    v_e = s.build_pvp_room_view_for_character(room, "E")
    assert v_e["player"]["hp"] == 800, v_e["player"]
    assert v_e["enemy"]["hp"] == 900, v_e["enemy"]
    print("PASS test_view_swap_actor")


def test_view_swap_per_side_dicts():
    """逐 side 字典字段必须同步交换（否则挂机方会把自己看成对方）"""
    s = BattleRoomService()
    room = build_room()
    v_e = s.build_pvp_room_view_for_character(room, "E")
    # E 是内部 enemy：E 自己的动作 = 内部 enemy 的动作
    assert v_e["round_actions"]["player"] == "ATTACK"
    assert v_e["auto_actions"]["player"] is True, "E 自己被接管，view 里应体现 player=True"
    assert v_e["auto_actions"]["enemy"] is False
    assert v_e["noop_rounds"]["player"] == 2, v_e["noop_rounds"]
    assert v_e["noop_rounds"]["enemy"] == 0
    print("PASS test_view_swap_per_side_dicts")


def test_view_swap_result_winner():
    s = BattleRoomService()
    room = build_room()
    room["status"] = "finished"
    room["result"] = {"winner": "player", "reason": "ko"}
    v_e = s.build_pvp_room_view_for_character(room, "E")
    assert v_e["result"]["winner"] == "enemy", v_e["result"]
    print("PASS test_view_swap_result_winner")


async def test_notifier_fired_on_settle():
    """结算后必须触发 notifier，且带上正确的 settled_round"""
    s = BattleRoomService()
    s.GRACE_SECONDS = 0.2
    s.COMMAND_PHASE_SECONDS = 0.4

    calls = []

    async def notifier(room, settled_round):
        calls.append((room.get("room_id"), settled_round, int(room.get("round", 1))))

    s.set_pvp_round_notifier(notifier)

    room = build_room()
    room["round"] = 3
    room["round_actions"] = {"player": "ATTACK", "enemy": "ATTACK"}
    s.rooms = {"r1": room}
    s._persist_room = lambda r: None
    s._end_if_needed = lambda r: None
    s._exec_action = lambda r, side, act: None  # 不真打，只验证通知

    s._compute_pvp_round_and_advance(room)
    # notifier 通过 create_task 异步触发，给事件循环一拍
    await asyncio.sleep(0.05)
    assert len(calls) == 1, calls
    assert calls[0][1] == 3, f"settled_round 应为 3，实际 {calls[0][1]}"
    assert calls[0][2] == 4, f"结算后 round 应推进为 4，实际 {calls[0][2]}"
    print("PASS test_notifier_fired_on_settle")


async def test_notifier_on_escape():
    """ESCAPE 结束战斗也要通知（否则对方看不到胜负）"""
    s = BattleRoomService()
    calls = []

    async def notifier(room, settled_round):
        calls.append((settled_round, room.get("status")))

    s.set_pvp_round_notifier(notifier)

    room = build_room()
    room["round_actions"] = {"player": "ESCAPE", "enemy": "ATTACK"}
    s.rooms = {"r1": room}
    s._persist_room = lambda r: None
    s._end_if_needed = lambda r: None
    s._cancel_pvp_grace_watcher = lambda rid: None

    s._compute_pvp_round_and_advance(room)
    await asyncio.sleep(0.05)
    assert len(calls) == 1, calls
    assert calls[0][0] == 1, calls
    assert calls[0][1] == "finished", calls
    print("PASS test_notifier_on_escape")


async def test_watcher_triggers_notifier_on_both_idle():
    """双方都挂机 → 后台守望自动结算 → 必须触发 notifier（挂机方靠它拿状态）"""
    s = BattleRoomService()
    s.GRACE_SECONDS = 0.15
    s.COMMAND_PHASE_SECONDS = 0.3

    calls = []

    async def notifier(room, settled_round):
        calls.append(settled_round)

    s.set_pvp_round_notifier(notifier)

    room = build_room()
    room["round"] = 1
    room["round_actions"] = {"player": None, "enemy": None}
    room["auto_actions"] = {"player": False, "enemy": False}
    room["noop_rounds"] = {"player": 0, "enemy": 0}
    room["last_action_ts"] = time.time()
    s.rooms = {"r1": room}
    s._persist_room = lambda r: None
    s._end_if_needed = lambda r: None
    s._exec_action = lambda r, side, act: None
    s._set_command_phase_deadline(room)
    s._ensure_pvp_grace_watcher("r1")

    await asyncio.sleep(1.0)
    s._cancel_pvp_grace_watcher("r1")
    assert len(calls) >= 1, f"双方挂机也应触发推送通知，实际 {calls}"
    assert room["round"] >= 2, room["round"]
    print(f"PASS 双方挂机 → 守望结算并通知 {calls}")


async def main():
    test_view_swap_actor()
    test_view_swap_per_side_dicts()
    test_view_swap_result_winner()
    await test_notifier_fired_on_settle()
    await test_notifier_on_escape()
    await test_watcher_triggers_notifier_on_both_idle()
    print("\nALL PVP ROUND PUSH TESTS PASSED")


if __name__ == "__main__":
    asyncio.run(main())
