"""
PVP「空窗挽回期」状态机单元测试（不依赖 DB / 网络）。
只测纯 dict 逻辑：_set_command_phase_deadline / _activate_grace_countdown /
_mark_round_activity / _bump_side_noop / _clear_side_noop  + 累计接管阈值。

运行：python tools/tests/test_grace_window.py
"""
import os
import sys
import time

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "server")))

from services.battle_room_service import BattleRoomService  # noqa: E402


def _svc():
    # 直接实例化，绕过单例初始化（不碰 DB）
    return BattleRoomService()


def _new_room():
    return {
        "room_id": "test",
        "status": "in_progress",
        "round": 1,
        "round_actions": {"player": None, "enemy": None},
        "auto_actions": {"player": False, "enemy": False},
        "noop_rounds": {"player": 0, "enemy": 0},
    }


def test_constants():
    s = _svc()
    assert s.GRACE_SECONDS == 5, s.GRACE_SECONDS
    assert s.GRACE_TAKEOVER_ROUNDS == 2, s.GRACE_TAKEOVER_ROUNDS
    print("PASS test_constants")


def test_command_phase_not_active():
    """进入指令阶段：grace_active=False（静默期），command_deadline_ts=None"""
    s = _svc()
    r = _new_room()
    s._set_command_phase_deadline(r)
    assert r["grace_active"] is False
    assert r["command_deadline_ts"] is None
    assert r["remaining_command_seconds"] == 0
    now_ms = int(time.time() * 1000)
    assert abs(r["grace_deadline_ts"] - (now_ms + 5000)) < 1500, r["grace_deadline_ts"]
    print("PASS test_command_phase_not_active")


def test_activate_countdown():
    """空窗期满激活倒计时：grace_active=True，deadline = now + COMMAND_PHASE_SECONDS*1000"""
    s = _svc()
    r = _new_room()
    s._set_command_phase_deadline(r)
    s._activate_grace_countdown(r)
    assert r["grace_active"] is True
    assert r["command_deadline_ts"] is not None
    assert r["remaining_command_seconds"] == s.COMMAND_PHASE_SECONDS
    print("PASS test_activate_countdown")


def test_bump_and_takeover_after_two_rounds():
    """连续两轮空窗 → 永久接管"""
    s = _svc()
    r = _new_room()
    s._bump_side_noop(r, "player")
    assert r["noop_rounds"]["player"] == 1
    assert r["auto_actions"]["player"] is False, "1 轮还不该接管"
    s._bump_side_noop(r, "player")
    assert r["noop_rounds"]["player"] == 2
    assert r["auto_actions"]["player"] is True, "满 2 轮应永久接管"
    print("PASS test_bump_and_takeover_after_two_rounds")


def test_clear_side_noop():
    """玩家主动操作 → 清零计数 + 解除接管"""
    s = _svc()
    r = _new_room()
    s._bump_side_noop(r, "enemy")
    s._bump_side_noop(r, "enemy")
    assert r["auto_actions"]["enemy"] is True
    s._clear_side_noop(r, "enemy")
    assert r["noop_rounds"]["enemy"] == 0
    assert r["auto_actions"]["enemy"] is False
    print("PASS test_clear_side_noop")


def test_sides_independent():
    """双方计数互相独立"""
    s = _svc()
    r = _new_room()
    s._bump_side_noop(r, "player")
    s._bump_side_noop(r, "player")
    assert r["auto_actions"]["player"] is True
    assert r["auto_actions"]["enemy"] is False
    assert r["noop_rounds"]["enemy"] == 0
    print("PASS test_sides_independent")


def test_full_sequence():
    """完整链路模拟：
    R1 双方无操作 → 激活倒计时 → 补普攻 → 各 +1 轮
    R2 双方无操作 → 各 +1 轮 → 满 2 轮 → 双方永久接管
    R3 玩家主动操作 → 解除 player 接管，enemy 仍接管
    R4 玩家再操作（服务器立即用 ATTACK 补 enemy）
    """
    s = _svc()
    r = _new_room()

    # 回合 1：双方无操作
    for side in ("player", "enemy"):
        s._bump_side_noop(r, side)
    assert r["noop_rounds"] == {"player": 1, "enemy": 1}
    assert r["auto_actions"] == {"player": False, "enemy": False}

    # 回合 2：双方仍无操作 → 满 2 轮 → 双接管
    for side in ("player", "enemy"):
        s._bump_side_noop(r, side)
    assert r["auto_actions"] == {"player": True, "enemy": True}

    # 回合 3：玩家主动操作 → 解除玩家接管
    s._clear_side_noop(r, "player")
    s._mark_round_activity(r)
    assert r["auto_actions"]["player"] is False
    assert r["auto_actions"]["enemy"] is True, "对侧未被操作，保持接管"
    assert r["noop_rounds"]["player"] == 0
    print("PASS test_full_sequence")


if __name__ == "__main__":
    test_constants()
    test_command_phase_not_active()
    test_activate_countdown()
    test_bump_and_takeover_after_two_rounds()
    test_clear_side_noop()
    test_sides_independent()
    test_full_sequence()
    print("\nALL GRACE WINDOW TESTS PASSED")
