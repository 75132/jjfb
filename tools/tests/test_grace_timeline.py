"""
PVP「空窗挽回期」端到端时序模拟。

要点：真实 asyncio.wait_for 用的是事件循环的真实时间，虚拟时钟无法欺骗它。
因此本测试**临时缩小常量**（GRACE_SECONDS / COMMAND_PHASE_SECONDS），用真实短延时驱动
真实等待循环，从而验证状态机推进逻辑（而不是时序精度）。

运行：envs/default/Scripts/python tools/tests/test_grace_timeline.py
"""
import asyncio
import os
import sys
import time

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "server")))

from services.battle_room_service import BattleRoomService  # noqa: E402


def build_service():
    s = BattleRoomService()
    # 临时缩小：0.2s 静默 + 0.4s 倒计时（真实时间跑，验证逻辑而非精度）
    s.GRACE_SECONDS = 0.2
    s.COMMAND_PHASE_SECONDS = 0.4

    room = {
        "room_id": "r1",
        "mode": "pvp",
        "status": "in_progress",
        "round": 1,
        "round_actions": {"player": None, "enemy": None},
        "auto_actions": {"player": False, "enemy": False},
        "noop_rounds": {"player": 0, "enemy": 0},
        "player_character_id": "P",
        "enemy_character_id": "E",
        "player": {"initiative": 10, "hp": 99999},
        "enemy": {"initiative": 5, "hp": 99999},
        "last_action_ts": time.time(),
        "created_at": time.time(),
    }
    s.rooms = {"r1": room}
    s.char_room_index = {"P": "r1", "E": "r1"}
    # 此时房间应处于「指令阶段开始」：手动初始化空窗期
    s._set_command_phase_deadline(room)

    s.get_room_by_id = lambda rid: s.rooms.get(rid)
    s._persist_room = lambda r: None

    def fake_advance(r):
        r["round"] = int(r.get("round", 1)) + 1
        r["updated_at"] = time.time()
        r["round_actions"] = {"player": None, "enemy": None}
        s._set_command_phase_deadline(r)

    s._compute_pvp_round_and_advance = fake_advance
    return s, room


async def test_r1_noop():
    """R1：玩家提交，对手挂机 → 空窗0.2s → 倒计时0.4s → 对手 +1 轮；玩家因主动提交清零"""
    s, room = build_service()
    t0 = time.time()
    await asyncio.wait_for(s.submit_pvp_action("r1", "P", "ATTACK"), timeout=3)
    elapsed = time.time() - t0
    assert room["round"] == 2, room["round"]
    # 空窗 0.2 + 倒计时 0.4 = 0.6s 左右才结算
    assert 0.5 <= elapsed <= 1.5, f"结算耗时 {elapsed:.2f}s 不符合预期"
    # 玩家主动提交 → 清零；对手挂机被补普攻 → +1
    assert room["noop_rounds"] == {"player": 0, "enemy": 1}, room["noop_rounds"]
    assert room["auto_actions"] == {"player": False, "enemy": False}, room["auto_actions"]
    print(f"PASS R1: 空窗+倒计时 {elapsed:.2f}s → 挂机方+1轮，提交方清零")


async def test_r2_takeover():
    """R2/R3：玩家持续提交、对手持续挂机 → 对手满 2 轮即永久接管"""
    s, room = build_service()
    await asyncio.wait_for(s.submit_pvp_action("r1", "P", "ATTACK"), timeout=3)
    assert room["noop_rounds"]["enemy"] == 1, room["noop_rounds"]
    await asyncio.wait_for(s.submit_pvp_action("r1", "P", "ATTACK"), timeout=3)
    assert room["round"] == 3, room["round"]
    assert room["noop_rounds"]["enemy"] >= 2, room["noop_rounds"]
    assert room["auto_actions"]["enemy"] is True, room["auto_actions"]
    assert room["auto_actions"]["player"] is False, "玩家持续操作，不该被接管"
    print("PASS R2: 对手持续挂机满2轮 → 对手永久接管（玩家不受影响）")


async def test_r3_resume():
    """R3：对手已接管后，对手玩家恢复操作 → 解除其接管"""
    s, room = build_service()
    await asyncio.wait_for(s.submit_pvp_action("r1", "P", "ATTACK"), timeout=3)
    await asyncio.wait_for(s.submit_pvp_action("r1", "P", "ATTACK"), timeout=3)
    assert room["auto_actions"]["enemy"] is True

    # 对手（E）恢复操作：应解除对手接管；玩家仍接管？玩家一直主动操作 → 不接管
    t0 = time.time()
    await asyncio.wait_for(s.submit_pvp_action("r1", "E", "DEFEND"), timeout=3)
    elapsed = time.time() - t0
    assert room["auto_actions"]["enemy"] is False, room["auto_actions"]
    assert room["noop_rounds"]["enemy"] == 0, room["noop_rounds"]
    assert room["auto_actions"]["player"] is False, room["auto_actions"]
    print(f"PASS R3: 挂机方恢复操作 → 解除接管，计数清零({elapsed:.3f}s)")


async def test_grace_not_activated_when_both_act():
    """静默期内双方都提交 → 不激活倒计时，立即结算，空窗计数保持 0"""
    s, room = build_service()
    t0 = time.time()

    async def enemy_acts():
        await asyncio.sleep(0.05)  # < 0.2s 静默期
        room["round_actions"]["enemy"] = "ATTACK"

    task_p = asyncio.create_task(s.submit_pvp_action("r1", "P", "ATTACK"))
    task_e = asyncio.create_task(enemy_acts())
    await asyncio.wait_for(asyncio.gather(task_p, task_e), timeout=3)
    elapsed = time.time() - t0
    assert elapsed < 0.5, f"双方尽快提交应立即结算，实际 {elapsed:.2f}s"
    assert room["round"] == 2, room["round"]
    assert room["noop_rounds"] == {"player": 0, "enemy": 0}, room["noop_rounds"]
    print(f"PASS 静默期内双方提交 → 立即结算({elapsed:.3f}s)，无空窗计数")


async def build_service_with_watcher():
    """构建服务并显式启动后台守望（模拟真实 create_pvp_room 行为）。"""
    s, room = build_service()
    s._ensure_pvp_grace_watcher("r1")
    return s, room


async def test_both_idle_autoprogression():
    """★核心场景★ 双方都完全不操作：由后台守望任务自动推进，2 轮后双方永久接管。"""
    s, room = await build_service_with_watcher()
    # 不做任何 submit，纯靠后台守望推进
    # R1: 静默0.2 + 倒计时0.4 ≈ 0.6s
    await asyncio.sleep(1.2)
    assert room["round"] >= 2, f"双方都不操作时后台应自动推进，实际 round={room['round']}"
    r_after_r1 = room["round"]
    assert room["noop_rounds"]["player"] >= 1 and room["noop_rounds"]["enemy"] >= 1, room["noop_rounds"]
    print(f"PASS 双方挂机 R1 自动推进: round={r_after_r1}, noop={room['noop_rounds']}")

    # R2: 再推进一轮 → 双方满 2 轮 → 永久接管
    await asyncio.sleep(1.2)
    assert room["round"] >= 3, room["round"]
    assert room["auto_actions"] == {"player": True, "enemy": True}, room["auto_actions"]
    print(f"PASS 双方挂机 R2 自动推进 → 双方永久接管, round={room['round']}")

    # 继续跑：已接管后应继续自动推进而不再等待
    prev_round = room["round"]
    await asyncio.sleep(1.0)
    assert room["round"] > prev_round, "接管后应继续自动推进"
    print(f"PASS 接管后持续自动推进: round {prev_round} → {room['round']}")

    s._cancel_pvp_grace_watcher("r1")


async def main():
    await test_r1_noop()
    await test_r2_takeover()
    await test_r3_resume()
    await test_grace_not_activated_when_both_act()
    await test_both_idle_autoprogression()
    print("\nALL GRACE TIMELINE SCENARIOS PASSED")


if __name__ == "__main__":
    asyncio.run(main())
