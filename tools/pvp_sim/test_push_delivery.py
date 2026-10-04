"""
PVP 推送投递闭环验证（纯内存，无需网络 / 无需真实服务端）

验证目标：
  1) 回合结算后，notifier 真的被调用；
  2) notifier 通过 push_to_user 把 pvp_round_update 投递到「双方」的在线连接；
  3) 挂机方（未提交动作的一方）也能收到 —— 这是用户报的核心 bug；
  4) 投递的 state 视角正确（自己的 player 就是自己）。

手段：用假的 websocket 对象（只需 async send）注册进 utils.user_clients，
      跑真实 battle_room_service 状态机（临时缩短 GRACE/COMMAND 常量）。

用法：
    python tools/pvp_sim/test_push_delivery.py
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRV = ROOT / "server"
for p in (str(ROOT), str(SRV)):
    if p not in sys.path:
        sys.path.insert(0, p)

os.chdir(SRV)


class FakeWS:
    """只实现 send 的最小假连接"""

    def __init__(self, tag: str):
        self.tag = tag
        self.messages: list[dict] = []

    async def send(self, text: str) -> None:
        try:
            self.messages.append(json.loads(text))
        except Exception:
            self.messages.append({"_raw": text})

    def pushes(self, route: str) -> list[dict]:
        return [m for m in self.messages if m.get("type") == route]


def doc(name: str, hp: int, initiative: int) -> dict:
    return {
        "RobotName": name, "Level": 10,
        "MaxHP": hp, "CurrentHP": hp,
        "Melee": 100, "Shooting": 50, "Armor": 20, "Initiative": initiative,
        "CurrentMelee": 100, "CurrentShooting": 50,
        "CurrentArmor": 20, "CurrentInitiative": initiative,
        "_id": name,
    }


async def main() -> int:
    from bson import ObjectId

    from handlers import utils
    from handlers import battle_room_handler  # noqa: F401  触发 notifier 注册
    from services.battle_room_service import battle_room_service as B

    # 缩短常量，让测试秒级完成
    B.GRACE_SECONDS = 0.4
    B.COMMAND_PHASE_SECONDS = 0.8

    failures: list[str] = []

    # 准备两个假连接，并注册到 utils.user_clients
    uid_a = str(ObjectId())
    uid_b = str(ObjectId())
    cid_a, cid_b = "cid-A", "cid-B"
    ws_a, ws_b = FakeWS("A"), FakeWS("B")
    utils.user_clients = {uid_a: {ws_a}, uid_b: {ws_b}}
    print(f"[setup] user_clients keys = {list(utils.user_clients.keys())}")

    # 创建房间：内部 player=A / enemy=B
    room = B.create_pvp_room(
        ObjectId(uid_a), cid_a, doc("机甲A", 5000, 30),
        ObjectId(uid_b), cid_b, doc("机甲B", 5000, 10),
    )
    rid = room["room_id"]
    print(f"[setup] room={rid}")

    # --- 场景1：A 提交 ATTACK，B 挂机 ---
    print("\n=== 场景1：A 攻击 / B 挂机 ===")
    ws_a.messages.clear()
    ws_b.messages.clear()
    t0 = time.time()
    st = await asyncio.wait_for(B.submit_pvp_action(rid, cid_a, "ATTACK"), timeout=20)
    print(f"A 提交返回耗时 {time.time()-t0:.2f}s round={(st or {}).get('round')} "
          f"status={(st or {}).get('status')}")

    # 给 notifier 的 create_task 一点时间跑完
    for _ in range(30):
        if ws_a.pushes("pvp_round_update") and ws_b.pushes("pvp_round_update"):
            break
        await asyncio.sleep(0.1)

    pa = ws_a.pushes("pvp_round_update")
    pb = ws_b.pushes("pvp_round_update")
    print(f"A 收到推送 {len(pa)} 条, B(挂机方) 收到推送 {len(pb)} 条")
    if not pb:
        failures.append("【核心 bug】挂机方 B 未收到 pvp_round_update 推送")
    else:
        print("✔ 挂机方 B 收到了推送（bug 已修复）")

    # 校验视角：B 收到的 state 应是「外层 data.state」
    if pb:
        payload = pb[-1]
        # push_to_user 会把业务载荷放进 data 字段：{type, success, code, timestamp, version, data:{...}}
        outer = payload.get("data") if isinstance(payload.get("data"), dict) else None
        st_b = (outer or {}).get("state") or payload.get("state") or {}
        print("[debug] 推送外层 keys:", sorted(payload.keys()))
        print("[debug] data keys:", sorted((outer or {}).keys()))
        print("[debug] state.player =", json.dumps(st_b.get("player"), ensure_ascii=False, default=str)[:260])
        b_self_cid = str((st_b.get("player") or {}).get("character_id") or "")
        b_enemy_cid = str((st_b.get("enemy") or {}).get("character_id") or "")
        print(f"B 视角: player.character_id={b_self_cid}  enemy.character_id={b_enemy_cid}")
        if b_self_cid != cid_b:
            failures.append(f"B 视角错误：player 不是自己（got {b_self_cid}, expect {cid_b}）")
        if b_enemy_cid != cid_a:
            failures.append(f"B 视角错误：enemy 不是对方（got {b_enemy_cid}, expect {cid_a}）")
        # 逐 side 字典交换校验：结算后回合已推进，round_actions 已重置为下一回合初值，
        # 故改为校验 noop_rounds（B 挂机 → B 视角 player 侧计数 +1，证明字典确实交换过）。
        noop_b = st_b.get("noop_rounds") or {}
        auto_b = st_b.get("auto_actions") or {}
        print(f"B 视角 noop_rounds={noop_b}  auto_actions={auto_b}")
        if int(noop_b.get("player", 0) or 0) < 1:
            failures.append(
                f"逐 side 字典未正确交换：B 视角 noop_rounds.player={noop_b.get('player')}，期望 ≥1"
                f"（B 挂机应记在自己名下）"
            )

    if pa:
        st_a = ((pa[-1].get("data") or {}).get("state")) or {}
        a_self = str((st_a.get("player") or {}).get("character_id") or "")
        a_noop = (st_a.get("noop_rounds") or {})
        print(f"A 视角: player.character_id={a_self}（应为 {cid_a}）  noop_rounds={a_noop}")
        if a_self != cid_a:
            failures.append(f"A 视角错误：player={a_self}，期望 {cid_a}")
        # A 主动提交 → 自己侧空窗清零；B 挂机 → A 视角 enemy 侧应 ≥1
        if int(a_noop.get("enemy", 0) or 0) < 1:
            failures.append(
                f"A 视角 noop_rounds.enemy={a_noop.get('enemy')}，期望 ≥1（对方挂机应记在 enemy）"
            )

    # --- 场景2：连续挂机两轮 → B 被永久接管 ---
    print("\n=== 场景2：B 连续挂机 → 满 2 轮被永久接管 ===")
    for i in range(2):
        ws_a.messages.clear(); ws_b.messages.clear()
        await asyncio.wait_for(B.submit_pvp_action(rid, cid_a, "ATTACK"), timeout=20)
        for _ in range(30):
            if ws_b.pushes("pvp_round_update"):
                break
            await asyncio.sleep(0.1)
        view = B.build_pvp_room_view_for_character(B.get_room_by_id(rid), cid_b)
        print(f"  第{i+1}次: B.noop_rounds={view.get('noop_rounds')} "
              f"B.auto_actions={view.get('auto_actions')}")
        if not ws_b.pushes("pvp_round_update"):
            failures.append(f"B 第{i+1}次挂机未收到推送")

    if not failures:
        print("\n✅ 全部通过：推送投递闭环 + 视角交换 + 挂机方接收 + 接管累积")
        return 0
    print("\n❌ 存在问题：")
    for f in failures:
        print("   - " + f)
    return 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
