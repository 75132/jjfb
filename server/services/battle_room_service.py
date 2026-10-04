"""
战斗房间服务（房间制回合战斗，单人 PVE 版）

设计目标（首版）：
- 一场战斗 = 一个房间（room_id）
- 每个房间绑定一个角色 + 一只敌方机甲（PVE）
- 服务器负责结算伤害与胜负，客户端只发送指令和做表现
- 支持短时间断线重连：房间状态常驻内存，超时自动清理

注意：
- 当前实现只在内存中保存房间状态，适合短时间断线/返回面板的恢复
- 如果需要“服务器重启后继续战斗”，可以在此基础上增加持久化（将 rooms 同步到 MongoDB）
"""

from __future__ import annotations

import time
import asyncio
import random
import uuid
from typing import Any, Awaitable, Callable, Dict, Optional, Literal, Tuple, Union
from bson import ObjectId
import inspect

from services import skill_service as skills_svc
from services.skill_formula import make_damage_value, resolve_scope

Side = Literal["player", "enemy"]
ActionType = Literal["ATTACK", "DEFEND", "ESCAPE", "SKILL"]
# 动作可以是字符串（"ATTACK"）或结构体（{"type": "SKILL", "skill_key": "roubo"}）
ActionSpec = Union[ActionType, Dict[str, Any]]
EnemyFactory = Callable[[], Union[Dict[str, Any], Awaitable[Dict[str, Any]]]]


# ======================================================================
# 被动技能：每回合结束自动结算
# ----------------------------------------------------------------------
# 解锁条件：机甲文档的 Skills / skills / LearnedSkills 数组里含对应技能 ID
#           （大小写不敏感，也接受中文技能名 / 拼音短名）。
#
# 结算时机（重要）：
#   双方出手结算完毕 → **死亡判定 _end_if_needed()** → 仍存活才结算被动。
#   hp <= 0 的单位一律跳过 —— 即「死亡空血优先于恢复」：
#   恢复永远不会把已倒下的单位拉回来（不存在复活，也不会出现空血但回血的情况）。
#   战斗已结束（status == finished）时整体不结算。
#
# 数值：amount = floor(属性上限 × ratio) + flat，至少 1 点；不能超过上限。
#       ratio 已定稿 **15%**（对齐原工程 Z_GamePlay.js 技能 29「自动恢复」的 15% 最大 HP）。
#       改这张表即可，客户端只负责表现。
# ======================================================================
PASSIVE_END_OF_ROUND: Dict[str, Dict[str, Any]] = {
    "life_recover": {
        "name": "生命恢复",
        "attr": "hp",
        "max": "max_hp",
        "ratio": 0.15,
        "flat": 0,
        "anim": "shengminghuifu",
    },
    "energy_recover": {
        "name": "能量恢复",
        "attr": "mp",
        "max": "max_mp",
        "ratio": 0.15,
        "flat": 0,
        "anim": "nenglianghuifu",
    },
}

# 别名 → 技能 ID（兼容把中文名 / 拼音短名直接写进 Skills 数组）
PASSIVE_SKILL_ALIASES: Dict[str, str] = {
    "生命恢复": "life_recover",
    "shengminghuifu": "life_recover",
    "life_recover": "life_recover",
    "能量恢复": "energy_recover",
    "nenglianghuifu": "energy_recover",
    "energy_recover": "energy_recover",
}


def resolve_passive_skill_id(raw: Any) -> Optional[str]:
    """把 Skills 数组里的一项归一化成被动技能 ID；不认识则返回 None。"""
    if raw is None:
        return None
    key = str(raw).strip()
    if not key:
        return None
    if key in PASSIVE_END_OF_ROUND:
        return key
    hit = PASSIVE_SKILL_ALIASES.get(key) or PASSIVE_SKILL_ALIASES.get(key.lower())
    return hit


def _clean_objectid_for_json(obj: Any) -> Any:
    """
    递归清理数据中的 ObjectId，转换为字符串，确保可以 JSON 序列化
    参考成熟方案：所有返回给客户端的数据都必须清理 ObjectId
    """
    if isinstance(obj, ObjectId):
        return str(obj)
    elif isinstance(obj, dict):
        return {k: _clean_objectid_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_clean_objectid_for_json(item) for item in obj]
    elif isinstance(obj, tuple):
        return tuple(_clean_objectid_for_json(item) for item in obj)
    else:
        return obj


def _flip_side(value: Any) -> Any:
    """把 player/enemy 互换（其它值原样返回）。"""
    if value == "player":
        return "enemy"
    if value == "enemy":
        return "player"
    return value


def _swap_event_sides(event: Any) -> Any:
    """把一条回合事件明细的视角反转（PVP 客户端视角交换用）。"""
    if not isinstance(event, dict):
        return event
    out = dict(event)
    out["side"] = _flip_side(event.get("side"))
    for key in ("targets", "heals", "effects"):
        items = event.get(key)
        if isinstance(items, list):
            swapped = []
            for it in items:
                if isinstance(it, dict):
                    it = dict(it)
                    if "side" in it:
                        it["side"] = _flip_side(it["side"])
                swapped.append(it)
            out[key] = swapped
    return out


class BattleRoomService:
    """简单的战斗房间管理服务（单机 PVE，一人一房间）"""

    # 每回合指令阶段时长（秒），客户端倒计时以此为准，重连时从 state 恢复
    COMMAND_PHASE_SECONDS = 30

    # 「空窗挽回期」机制（PVP 双方真人）：
    #   - 进入指令阶段后不立即倒计时；任一方/双方无操作满 GRACE_SECONDS 秒才「激活倒计时」；
    #   - 倒计时归零自动普攻；每方独立累计「连续空窗轮数」，满 GRACE_TAKEOVER_ROUNDS 轮后
    #     该方进入永久接管（auto_actions=True，无需再等待/倒计时，直接自动普攻）；
    #   - 玩家一旦主动提交动作（或重连）即解除接管并清零空窗计数，之后再次无操作则重新走一遍。
    GRACE_SECONDS = 5
    GRACE_TAKEOVER_ROUNDS = 2

    # request_id 幂等缓存 TTL（秒）
    IDEMPOTENCY_TTL_SECONDS = 30 * 60

    # 「高防保底」伤害下限：命中即至少掉这么多（旧公式 max(1, 攻击−装甲) 的口径）。
    # RPG 原版是 0（防够高就是 0 伤害），但那样容易出现双方都打不动的僵局 → 保底 1。
    MIN_DAMAGE = 1

    def __init__(self) -> None:
        # room_id -> room_state
        self.rooms: Dict[str, Dict[str, Any]] = {}
        # character_id(str) -> room_id，方便通过角色快速找到房间
        self.char_room_index: Dict[str, str] = {}
        self._persist_col = None

        # PvP：并发等待（存放在 room dict 外，避免序列化到客户端）
        self._pvp_room_locks: Dict[str, asyncio.Lock] = {}
        # (room_id, round) -> event
        self._pvp_round_events: Dict[str, asyncio.Event] = {}
        # room_id -> 后台「空窗挽回期」守望任务（保证双方都不操作时也能自动推进）
        self._pvp_grace_watchers: Dict[str, asyncio.Task] = {}
        # PVP 回合结算后的通知回调：async (room, settled_round) -> None
        #   由 handler 层注入（负责向双方在线连接推送 pvp_round_update），
        #   使「挂机方」也能收到新 state 并播放动画（PVP 无服务端推送的原始缺陷）。
        self._pvp_round_notifier: Optional[Callable[[Dict[str, Any], int], Awaitable[None]]] = None

        # PVE 创建：角色级锁，防止并发重复 create
        self._pve_create_locks: Dict[str, asyncio.Lock] = {}
        # (character_id, request_id) -> (room_id, created_at)
        self._pve_create_idempotency: Dict[Tuple[str, str], Tuple[str, float]] = {}

        # 房间空闲超时时间（秒），超过则自动清理（仅 in_progress）
        self.ROOM_IDLE_TIMEOUT = 10 * 60  # 10 分钟
        # finished 剧情房间保留期（秒），供 finalize 跨重启回读；不沿用 10 分钟空闲清理
        self.FINISHED_ROOM_RETENTION_SECONDS = 48 * 3600  # 48 小时

        # 伤害浮动 / 暴击的随机源（可被测试注入替换）
        self._rng = random.Random()

    def _get_pve_create_lock(self, character_id: str) -> asyncio.Lock:
        cid = str(character_id)
        lock = self._pve_create_locks.get(cid)
        if lock is None:
            lock = asyncio.Lock()
            self._pve_create_locks[cid] = lock
        return lock

    def _cleanup_expired_idempotency(self, now: Optional[float] = None) -> None:
        now = now if now is not None else self._now()
        expired = [
            key
            for key, (_rid, ts) in self._pve_create_idempotency.items()
            if now - ts > self.IDEMPOTENCY_TTL_SECONDS
        ]
        for key in expired:
            self._pve_create_idempotency.pop(key, None)

    def _clear_idempotency_for_room(self, room_id: str) -> None:
        dead = [key for key, (rid, _ts) in self._pve_create_idempotency.items() if rid == room_id]
        for key in dead:
            self._pve_create_idempotency.pop(key, None)

    def _maybe_drop_pve_lock(self, character_id: str) -> None:
        """无活跃请求后清理角色锁，避免字典无限增长。"""
        cid = str(character_id)
        lock = self._pve_create_locks.get(cid)
        if lock is not None and not lock.locked():
            self._pve_create_locks.pop(cid, None)

    async def get_or_create_pve_room(
        self,
        *,
        user_id: Any,
        character_id: str,
        player_doc: Dict[str, Any],
        enemy_factory: EnemyFactory,
        request_id: Optional[str] = None,
        story_context: Optional[Dict[str, Any]] = None,
    ) -> Tuple[Dict[str, Any], bool]:
        """
        角色级原子 get-or-create。

        Returns:
            (room, created) — created=True 表示本调用新建了房间。
            同 request_id 重试返回同房间且 created=False。
            已有活动房间时返回已有房间且 created=False。

        story_context（可选）: event_id / map_code / user_id 等，用于成功后绑定 pending。
        """
        cid = str(character_id)
        lock = self._get_pve_create_lock(cid)
        await lock.acquire()
        created = False
        room: Optional[Dict[str, Any]] = None
        try:
            self._cleanup_expired_idempotency()

            existing = self.get_room_for_character(cid)
            if existing and existing.get("status") == "in_progress":
                return existing, False

            if request_id:
                key = (cid, str(request_id))
                cached = self._pve_create_idempotency.get(key)
                if cached:
                    rid, _ts = cached
                    cached_room = self.get_room_by_id(rid)
                    if cached_room and cached_room.get("status") == "in_progress":
                        return cached_room, False

            enemy_doc = enemy_factory()
            if inspect.isawaitable(enemy_doc):
                enemy_doc = await enemy_doc
            if not isinstance(enemy_doc, dict):
                raise RuntimeError("enemy_factory must return dict")

            room = self.create_pve_room(
                user_id=user_id,
                character_id=cid,
                player_doc=player_doc,
                enemy_doc=enemy_doc,
                story_context=story_context if (story_context and story_context.get("event_id")) else None,
            )
            created = True

            if request_id:
                self._pve_create_idempotency[(cid, str(request_id))] = (
                    room["room_id"],
                    self._now(),
                )

            if story_context and story_context.get("event_id"):
                from services.story_battle_service import transition_pending_to_in_room

                await transition_pending_to_in_room(
                    story_context.get("user_id") or user_id,
                    cid,
                    story_context.get("map_code") or "test_base",
                    str(story_context["event_id"]),
                    room["room_id"],
                )

            return room, True
        except Exception:
            # 创建异常不得留下孤儿 room / 错误索引
            if created and room is not None:
                rid = room.get("room_id")
                if rid:
                    self._clear_idempotency_for_room(str(rid))
                    self._destroy_room(str(rid))
            if story_context and story_context.get("event_id"):
                try:
                    from services.story_battle_service import rollback_pending_to_authorized

                    await rollback_pending_to_authorized(
                        story_context.get("user_id") or user_id,
                        cid,
                        story_context.get("map_code") or "test_base",
                        str(story_context["event_id"]),
                    )
                except Exception:
                    pass
            raise
        finally:
            lock.release()
            self._maybe_drop_pve_lock(cid)

    # ----------------------
    # 房间生命周期
    # ----------------------

    def _now(self) -> float:
        return time.time()

    def _now_ms(self) -> int:
        return int(time.time() * 1000)

    def _set_command_phase_deadline(self, room: Dict[str, Any]) -> None:
        """设置本回合指令阶段截止时间（服务器权威，供客户端倒计时与重连恢复）

        「空窗挽回期」机制下：
        - 进入指令阶段时**不激活倒计时**（grace_active=False），客户端此时不显示「剩余时间」；
        - 任一方/双方无操作满 GRACE_SECONDS 秒后，才调用 `_activate_grace_countdown` 激活真实倒计时。
        """
        now_ms = self._now_ms()
        room["command_phase_start_ts"] = now_ms
        # 空窗观察截止时间（达到即激活倒计时）
        room["grace_deadline_ts"] = now_ms + self.GRACE_SECONDS * 1000
        room["grace_active"] = False
        # 倒计时真正的截止时间在激活时才设置；先兜底为 None，避免客户端误读
        room["command_deadline_ts"] = None
        room["remaining_command_seconds"] = 0
        # 空窗方向量记录最后一次「见到动作/激活」的时间，用于精确判断无操作 5 秒
        room["grace_last_activity_ts"] = now_ms

    def _activate_grace_countdown(self, room: Dict[str, Any]) -> None:
        """激活本回合的倒计时（空窗满 5 秒后被调用）"""
        now_ms = self._now_ms()
        room["grace_active"] = True
        room["command_deadline_ts"] = now_ms + self.COMMAND_PHASE_SECONDS * 1000
        room["remaining_command_seconds"] = self.COMMAND_PHASE_SECONDS

    def _mark_round_activity(self, room: Dict[str, Any]) -> None:
        """记录本回合有玩家活动（提交动作/重连），用于空窗计时"""
        room["grace_last_activity_ts"] = self._now_ms()

    def _bump_side_noop(self, room: Dict[str, Any], side: Side) -> None:
        """某方本回合被自动补普攻 → 空窗轮数 +1；满 GRACE_TAKEOVER_ROUNDS 轮则永久接管。"""
        counts = room.get("noop_rounds") or {"player": 0, "enemy": 0}
        counts[side] = int(counts.get(side, 0) or 0) + 1
        room["noop_rounds"] = counts
        if counts[side] >= self.GRACE_TAKEOVER_ROUNDS:
            auto_actions = room.get("auto_actions") or {"player": False, "enemy": False}
            auto_actions[side] = True
            room["auto_actions"] = auto_actions

    def _clear_side_noop(self, room: Dict[str, Any], side: Side) -> None:
        """某方主动提交动作/重连 → 解除其接管并清零空窗轮数。"""
        counts = room.get("noop_rounds") or {"player": 0, "enemy": 0}
        if int(counts.get(side, 0) or 0) != 0:
            counts[side] = 0
            room["noop_rounds"] = counts
        auto_actions = room.get("auto_actions") or {"player": False, "enemy": False}
        if auto_actions.get(side):
            auto_actions[side] = False
            room["auto_actions"] = auto_actions

    # ----------------------
    # PVP 空窗挽回期：后台守望任务
    # ----------------------
    # 为什么需要后台任务：submit_pvp_action 的等待循环只在「有人提交」时才运行。
    # 若双方都完全不操作，则没有任何协程在等待 → 回合会永久挂起。
    # 因此每个 PVP 房间在进入指令阶段时启动一个后台任务，负责推进：
    #   静默 5s → 激活倒计时 → 倒计时 30s → 缺动作方补普攻 → 结算 → 为下一回合重新启动。
    def _ensure_pvp_grace_watcher(self, room_id: str) -> None:
        """幂等地为某个 PVP 房间启动/复用「空窗挽回期」守望任务。不阻塞调用方。"""
        room = self.rooms.get(room_id)
        if not room or room.get("mode") != "pvp" or room.get("status") != "in_progress":
            return
        existing = self._pvp_grace_watchers.get(room_id)
        if existing is not None and not existing.done():
            # 已有守望任务在跑：它会在回合推进后自行重启，无需重复创建
            return
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            # 无事件循环（如同步单测）→ 跳过后台任务
            return
        task = loop.create_task(self._pvp_grace_watch_loop(room_id))
        self._pvp_grace_watchers[room_id] = task

    async def _pvp_grace_watch_loop(self, room_id: str) -> None:
        """后台循环：逐回合推进空窗观察期 → 倒计时 → 自动补普攻结算。"""
        try:
            while True:
                room = self.rooms.get(room_id)
                if not room or room.get("mode") != "pvp" or room.get("status") != "in_progress":
                    return

                watched_round = int(room.get("round", 1))
                now_ms = self._now_ms()

                if not bool(room.get("grace_active")):
                    # 阶段一：等待静默观察期结束
                    grace_dl = room.get("grace_deadline_ts")
                    wait_sec = (
                        max(0.0, (float(grace_dl) - now_ms) / 1000.0)
                        if isinstance(grace_dl, (int, float))
                        else self.GRACE_SECONDS
                    )
                    if wait_sec > 0:
                        await asyncio.sleep(wait_sec)
                    lock = self._pvp_room_locks.setdefault(room_id, asyncio.Lock())
                    async with lock:
                        cur = self.rooms.get(room_id)
                        if not cur or cur.get("status") != "in_progress":
                            return
                        if int(cur.get("round", 1)) != watched_round:
                            continue  # 回合已被推进，重新从新回合开始
                        acts = cur.get("round_actions") or {"player": None, "enemy": None}
                        if acts.get("player") is not None and acts.get("enemy") is not None:
                            # 双方都已提交（由 submit 路径结算），退出等它推进
                            await asyncio.sleep(0.05)
                            continue
                        if not bool(cur.get("grace_active")):
                            self._activate_grace_countdown(cur)
                            cur["last_action_ts"] = self._now()
                            self._persist_room(cur)
                    continue

                # 阶段二：倒计时已激活，等待到点 → 自动补普攻并结算
                dl = room.get("command_deadline_ts")
                wait_sec = (
                    max(0.0, (float(dl) - now_ms) / 1000.0)
                    if isinstance(dl, (int, float))
                    else self.COMMAND_PHASE_SECONDS
                )
                if wait_sec > 0:
                    await asyncio.sleep(wait_sec)

                lock = self._pvp_room_locks.setdefault(room_id, asyncio.Lock())
                async with lock:
                    cur = self.rooms.get(room_id)
                    if not cur or cur.get("status") != "in_progress":
                        return
                    if int(cur.get("round", 1)) != watched_round:
                        continue
                    acts = cur.get("round_actions") or {"player": None, "enemy": None}
                    if acts.get("player") is not None and acts.get("enemy") is not None:
                        await asyncio.sleep(0.05)
                        continue
                    filled = False
                    if acts.get("player") is None:
                        acts["player"] = "ATTACK"
                        self._bump_side_noop(cur, "player")
                        filled = True
                    if acts.get("enemy") is None:
                        acts["enemy"] = "ATTACK"
                        self._bump_side_noop(cur, "enemy")
                        filled = True
                    if not filled:
                        continue
                    cur["round_actions"] = acts
                    self._compute_pvp_round_and_advance(cur)
                    # 唤醒可能正在等待的 submit 协程
                    ev = self._pvp_round_events.pop(f"{room_id}:{watched_round}", None)
                    if ev is not None:
                        ev.set()
        except asyncio.CancelledError:
            return
        except Exception as e:  # 守望任务绝不能因单次异常而静默死掉
            try:
                import logging as _logging
                _logging.getLogger("game_server").error(
                    f"[PVP] 空窗守望任务异常 room={room_id}: {e}"
                )
            except Exception:
                pass

    def _cancel_pvp_grace_watcher(self, room_id: str) -> None:
        task = self._pvp_grace_watchers.pop(room_id, None)
        if task is not None and not task.done():
            task.cancel()

    def _gen_room_id(self) -> str:
        return uuid.uuid4().hex

    def set_pvp_round_notifier(
        self, notifier: Optional[Callable[[Dict[str, Any], int], Awaitable[None]]]
    ) -> None:
        """由 handler 层注入「PVP 回合结算通知」回调（用于主动推送给双方客户端）。"""
        self._pvp_round_notifier = notifier

    def _notify_pvp_round_settled(self, room: Dict[str, Any], settled_round: int) -> None:
        """
        回合结算后异步通知双方（不阻塞当前协程）。
        挂机方原本永远不会收到新 state，导致看不到动画/血条不更新 —— 由此回调修复。
        """
        notifier = self._pvp_round_notifier
        if notifier is None:
            return
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            return
        try:
            loop.create_task(notifier(room, settled_round))
        except Exception as _e:
            try:
                import logging as _logging
                _logging.getLogger("game_server").error(
                    f"[PVP] notifier 调度失败 round={settled_round}: {_e}"
                )
            except Exception:
                pass

    def create_pve_room(
        self,
        user_id: Any,
        character_id: str,
        player_doc: Dict[str, Any],
        enemy_doc: Dict[str, Any],
        story_context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        创建一场 PVE 战斗房间。

        player_doc / enemy_doc 为“机甲属性快照”，应包含：
        - RobotName / Level / MaxHP / CurrentHP / Melee / Shooting / Armor / Initiative 等
        - MaxMP / CurrentMP（被动「能量恢复」用）
        - **Skills**（已学技能数组，被动技能由此解锁；不填则不触发任何被动）
        story_context: 剧情房间必填 {map_code, event_id, battle_ref}；普通 PVE 为 None
        """
        room_id = self._gen_room_id()
        now = self._now()

        player_actor = self._build_actor_from_doc("player", character_id, player_doc)
        enemy_actor = self._build_actor_from_doc("enemy", None, enemy_doc)

        room = {
            "room_id": room_id,
            "mode": "pve",
            "user_id": user_id,
            "character_id": str(character_id),
            "created_at": now,
            "updated_at": now,
            "last_action_ts": now,
            "status": "in_progress",  # waiting | in_progress | finished
            "round": 1,
            "seed": int(now * 1000) & 0xFFFFFFFF,
            "player": player_actor,
            "enemy": enemy_actor,
            "result": None,  # {'winner': 'player'|'enemy', 'reason': 'ko'|'escape'|'timeout'}
            # 本回合结算明细（按出手顺序），客户端据此播技能光效/伤害数字/治疗数字
            "round_events": [],
        }
        if story_context and isinstance(story_context, dict) and story_context.get("event_id"):
            room["story_context"] = {
                "map_code": str(story_context.get("map_code") or ""),
                "event_id": str(story_context.get("event_id") or ""),
                "battle_ref": str(story_context.get("battle_ref") or ""),
            }
        self._set_command_phase_deadline(room)

        self.rooms[room_id] = room
        self.char_room_index[str(character_id)] = room_id
        self._persist_room(room)
        return room

    def create_pvp_room(
        self,
        player_user_id: ObjectId,
        player_character_id: str,
        player_doc: Dict[str, Any],
        enemy_user_id: ObjectId,
        enemy_character_id: str,
        enemy_doc: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        创建一场 PVP 战斗房间（双方真人回合制）。

        注意：
        - 内部 room 中固定：player 作为“内部玩家A”，enemy 作为“内部玩家B”
        - 给客户端返回 state 时，会根据当前 character_id 做 player/enemy 视图交换（见 build_pvp_room_view_for_character）
        """
        room_id = self._gen_room_id()
        now = self._now()

        player_character_id = str(player_character_id)
        enemy_character_id = str(enemy_character_id)

        player_actor = self._build_actor_from_doc("player", player_character_id, player_doc)
        enemy_actor = self._build_actor_from_doc("enemy", enemy_character_id, enemy_doc)

        room = {
            "room_id": room_id,
            "mode": "pvp",
            "user_id": None,  # 兼容字段（PVP 不再使用）
            # 内部固定左右：player / enemy
            "player_character_id": player_character_id,
            "enemy_character_id": enemy_character_id,
            "player_user_id": player_user_id,
            "enemy_user_id": enemy_user_id,
            "created_at": now,
            "updated_at": now,
            "last_action_ts": now,
            "status": "in_progress",  # waiting | in_progress | finished
            "round": 1,
            "seed": int(now * 1000) & 0xFFFFFFFF,
            "player": player_actor,
            "enemy": enemy_actor,
            "result": None,  # {'winner': 'player'|'enemy', 'reason': 'ko'|'escape'|'timeout'}
            # 本回合指令阶段双方动作（在提交都完成后由服务器结算）
            # 保持**字符串**（ATTACK | DEFEND | ESCAPE | SKILL | None）以兼容既有客户端与模拟端；
            # 技能 key 放在并列的 round_skill_keys 里（避免改变已下发字段的类型）。
            "round_actions": {"player": None, "enemy": None},
            "round_skill_keys": {"player": None, "enemy": None},
            # PvP：逐 side 的自动战斗模式
            # - 初始 False；
            # - 某 side 连续「空窗挽回」满 GRACE_TAKEOVER_ROUNDS 轮后置 True（永久接管，直接自动普攻）；
            # - 该 side 一旦主动提交动作（或重连），立即复位为 False 并清零 noop_rounds。
            "auto_actions": {"player": False, "enemy": False},
            # 逐 side 连续空窗轮数（每轮只要该 side 是被自动补 ATTACK 的，就 +1；主动提交则清零）
            "noop_rounds": {"player": 0, "enemy": 0},
            # 本回合结算明细（按出手顺序），客户端据此播技能光效/伤害数字/治疗数字
            "round_events": [],
        }
        self._set_command_phase_deadline(room)

        self.rooms[room_id] = room
        self.char_room_index[player_character_id] = room_id
        self.char_room_index[enemy_character_id] = room_id
        self._persist_room(room)
        # 启动「空窗挽回期」后台守望：保证双方都不操作时也能自动推进（首次进入指令阶段）
        self._ensure_pvp_grace_watcher(room_id)
        return room

    def build_pvp_room_view_for_character(self, room: Dict[str, Any], character_id: str) -> Dict[str, Any]:
        """
        给“当前 character_id 的客户端”返回一个 view：
        - 确保 view.player 永远表示当前客户端自己的那一方（便于沿用 BattleScene 逻辑）

        除 player/enemy 两个 actor 外，还需**同步交换**逐 side 的字段，
        否则客户端按 "player" 读取时会把对方的数据当成自己的：
          - round_actions（本回合自己/对方出的招）
          - auto_actions（自己/对方是否已被永久接管）
          - noop_rounds（自己/对方的连续空窗轮数）
        """
        if not room or room.get("mode") != "pvp":
            return room

        cid = str(character_id)
        player_cid = str(room.get("player_character_id") or "")
        if cid == player_cid:
            return room

        # 对方在内部 enemy：交换 player/enemy，并重映射 result.winner
        view = dict(room)
        view["player"], view["enemy"] = room.get("enemy"), room.get("player")

        # 逐 side 字典字段一并交换，保证客户端视角一致
        #   round_passive_effects：回合结束被动恢复（生命/能量恢复），必须按视角交换，
        #   否则对方视角会把敌方的恢复放到自己身上。
        for key in ("round_actions", "auto_actions", "noop_rounds", "round_passive_effects",
                    "round_skill_keys"):
            val = room.get(key)
            if isinstance(val, dict):
                view[key] = {"player": val.get("enemy"), "enemy": val.get("player")}

        # round_events 是**列表**（本回合出手明细），需逐条交换事件自身的 side 与各目标的 side，
        # 否则对方视角会把自己的技能动画/伤害数字播到对面身上。
        events = room.get("round_events")
        if isinstance(events, list):
            view["round_events"] = [_swap_event_sides(ev) for ev in events]

        const_result = room.get("result")
        if const_result and isinstance(const_result, dict) and const_result.get("winner"):
            winner = const_result.get("winner")
            swapped_winner = "enemy" if winner == "player" else "player"
            view["result"] = {**const_result, "winner": swapped_winner}

        return view

    def _build_actor_from_doc(
        self, side: Side, character_id: Optional[str], doc: Dict[str, Any]
    ) -> Dict[str, Any]:
        """从机甲/敌方文档构建战斗用 actor 状态"""
        name = doc.get("RobotName") or doc.get("name") or ("玩家机甲" if side == "player" else "敌方机甲")
        level = int(doc.get("Level", doc.get("level", 1)) or 1)

        max_hp = int(doc.get("MaxHP", doc.get("HP", 100)) or 100)
        # ⚠ 绝不能用 `or max_hp` 回填：CurrentHP=0（空血/已倒下）会被当成"字段缺失"→ 变成满血。
        #   这会直接破坏「死亡空血优先于恢复」—— 空血单位被静默复活成满血。
        hp_raw = doc.get("CurrentHP", doc.get("current_hp"))
        hp = int(hp_raw) if hp_raw is not None and str(hp_raw).strip() != "" else max_hp
        hp = max(0, min(hp, max_hp))

        # 能量（MP）：被动「能量恢复」的载体。老数据没有 MaxMP 时取 0 → 该单位不参与能量恢复
        max_mp = int(doc.get("MaxMP", doc.get("MP", 0)) or 0)
        mp_raw = doc.get("CurrentMP", doc.get("current_mp"))
        mp = int(mp_raw) if mp_raw is not None and str(mp_raw).strip() != "" else max_mp
        mp = max(0, min(mp, max_mp))

        # 已学技能（被动技能据此解锁）。兼容 Skills / skills / LearnedSkills 三种写法
        skills_raw = doc.get("Skills", doc.get("skills", doc.get("LearnedSkills")))
        if isinstance(skills_raw, str):
            skills = [skills_raw]
        elif isinstance(skills_raw, (list, tuple, set)):
            skills = [str(s) for s in skills_raw]
        else:
            skills = []

        melee = int(doc.get("CurrentMelee", doc.get("Melee", 0)) or 0)
        shoot = int(doc.get("CurrentShooting", doc.get("Shooting", 0)) or 0)
        armor = int(doc.get("CurrentArmor", doc.get("Armor", 0)) or 0)
        initiative = int(doc.get("CurrentInitiative", doc.get("Initiative", 10)) or 10)

        attack = melee + shoot
        defense = armor

        # 技能系统：职业线（决定普攻公式）/ 是否持枪 / 逐技能等级
        class_line = skills_svc.class_line_of(doc)
        gun_equipped = skills_svc.has_gun_equipped(doc)
        skill_levels = {}
        for holder in (doc.get("SkillLevels"), doc.get("skill_levels"), doc.get("SkillLevelMap")):
            if isinstance(holder, dict):
                skill_levels = {str(k): v for k, v in holder.items()}
                break

        # 清理 raw 字段中的 ObjectId，确保可以 JSON 序列化
        cleaned_raw = _clean_objectid_for_json(doc)
        
        return {
            "side": side,
            "character_id": str(character_id) if character_id is not None else None,
            "name": name,
            "level": level,
            "max_hp": max_hp,
            "hp": hp,
            "max_mp": max_mp,
            "mp": mp,
            "skills": skills,          # 被动技能解锁依据
            "skill_levels": skill_levels,  # 每机甲每技能独立等级（skill key -> Lv）
            "class_line": class_line,      # fighter / shooter / universal（普攻三公式）
            "gun_equipped": gun_equipped,  # 是否装备枪械（武器 id 28–51）
            "attack": attack,
            "defense": defense,
            "initiative": initiative,
            "guarding": False,         # 本回合是否处于「防御」姿态（RPG applyGuard 减半）
            "raw": cleaned_raw,  # 原始数据快照（已清理 ObjectId），方便客户端展示
        }

    def init_persistence(self, col) -> None:
        self._persist_col = col

    def _persist_room(self, room: Dict[str, Any]) -> None:
        if self._persist_col is None or not room:
            return
        try:
            from handlers import utils as handler_utils

            doc = _clean_objectid_for_json(dict(room))
            doc['room_id'] = room.get('room_id')
            cid = room.get('character_id') or room.get('player_character_id')
            if cid:
                doc['character_id'] = str(cid)
            handler_utils.safe_mongo_operation(
                lambda: self._persist_col.update_one(
                    {'room_id': doc['room_id']},
                    {'$set': doc},
                    upsert=True,
                )
            )
        except Exception as e:
            print(f'⚠️ [BattleRoom] persist failed: {e}')

    def _load_room_from_db(self, room_id: str) -> Optional[Dict[str, Any]]:
        if self._persist_col is None:
            return None
        try:
            from handlers import utils as handler_utils

            doc = handler_utils.safe_mongo_operation(
                lambda: self._persist_col.find_one({'room_id': room_id})
            )
            if doc:
                doc.pop('_id', None)
                return doc
        except Exception:
            pass
        return None

    def _delete_room_from_db(self, room_id: str) -> None:
        if self._persist_col is None or not room_id:
            return
        try:
            from handlers import utils as handler_utils

            handler_utils.safe_mongo_operation(
                lambda: self._persist_col.delete_one({"room_id": room_id})
            )
        except Exception as e:
            print(f"⚠️ [BattleRoom] delete persist failed: {e}")

    def _story_settlement_pending(self, room: Dict[str, Any]) -> bool:
        """finished 剧情房若结算未完成，不得删除持久化数据。"""
        ctx = room.get("story_context")
        if not isinstance(ctx, dict) or not ctx.get("event_id"):
            return False
        try:
            from services.story_settlement_ledger import get_settlements_col, STATUS_COMPLETED
            from handlers import utils as handler_utils

            cid = str(room.get("character_id") or "")
            eid = str(ctx.get("event_id") or "")
            rid = str(room.get("room_id") or "")
            if not (cid and eid and rid):
                return True
            col = get_settlements_col()
            if col is None:
                return True
            doc = handler_utils.safe_mongo_operation(
                lambda: col.find_one(
                    {"character_id": cid, "event_id": eid, "room_id": rid}
                )
            )
            if not doc:
                return True
            return doc.get("status") != STATUS_COMPLETED
        except Exception:
            return True

    def get_room_by_id(self, room_id: str) -> Optional[Dict[str, Any]]:
        room = self.rooms.get(room_id)
        if not room:
            room = self._load_room_from_db(room_id)
            if room:
                self.rooms[room_id] = room
                cid = str(room.get("character_id") or room.get("player_character_id") or "")
                # finished 房间不得重新加入 char_room_index（避免 resume）
                if cid and room.get("status") == "in_progress":
                    self.char_room_index[cid] = room_id
                # 服务重启/跨实例恢复：为进行中的 PVP 房间重建「空窗挽回期」守望任务
                if room.get("status") == "in_progress" and room.get("mode") == "pvp":
                    self._ensure_pvp_grace_watcher(str(room.get("room_id")))
        if not room:
            return None

        status = room.get("status")
        now = self._now()
        if status == "finished":
            finished_at = float(
                room.get("updated_at")
                or room.get("last_action_ts")
                or room.get("created_at")
                or 0
            )
            if now - finished_at > self.FINISHED_ROOM_RETENTION_SECONDS:
                if self._story_settlement_pending(room):
                    return room
                self._destroy_room(room_id, delete_db=True)
                return None
            return room

        if now - room.get("last_action_ts", room.get("created_at", 0)) > self.ROOM_IDLE_TIMEOUT:
            self._destroy_room(room_id)
            return None
        return room

    def get_room_for_character(self, character_id: str) -> Optional[Dict[str, Any]]:
        """只返回进行中的房间；已结束的视为无房间（索引在 _end_if_needed 时已清理，此处再校验一次以防旧数据）。"""
        room_id = self.char_room_index.get(str(character_id))
        if not room_id:
            return None
        room = self.get_room_by_id(room_id)
        if not room or room.get("status") != "in_progress":
            return None
        return room

    def get_all_rooms(self) -> list:
        """返回当前所有房间的快照（用于管理端/监控页），含 ObjectId 清理与剩余秒数刷新。"""
        now_ms = self._now_ms()
        out = []
        for room_id, room in list(self.rooms.items()):
            r = _clean_objectid_for_json(dict(room))
            deadline = r.get("command_deadline_ts")
            if deadline is not None and isinstance(deadline, (int, float)) and r.get("status") == "in_progress":
                r["remaining_command_seconds"] = max(0.0, (deadline - now_ms) / 1000.0)
            out.append(r)
        return out

    def _destroy_room(self, room_id: str, *, delete_db: bool = False) -> None:
        self._cancel_pvp_grace_watcher(room_id)
        room = self.rooms.pop(room_id, None)
        if not room:
            self._clear_idempotency_for_room(room_id)
            if delete_db:
                self._delete_room_from_db(room_id)
            return
        if room.get("mode") == "pvp":
            for cid_raw in [room.get("player_character_id"), room.get("enemy_character_id")]:
                cid = str(cid_raw or "")
                if cid and self.char_room_index.get(cid) == room_id:
                    self.char_room_index.pop(cid, None)
        else:
            cid = str(room.get("character_id") or "")
            if cid and self.char_room_index.get(cid) == room_id:
                self.char_room_index.pop(cid, None)
        self._clear_idempotency_for_room(room_id)
        if delete_db:
            self._delete_room_from_db(room_id)

    # ----------------------
    # 战斗指令与结算
    # ----------------------

    def submit_player_action(
        self, room_id: str, action_type: ActionSpec
    ) -> Optional[Dict[str, Any]]:
        """
        玩家提交指令：
        - "ATTACK" / "DEFEND" / "ESCAPE"
        - {"type": "SKILL", "skill_key": "roubo"}（主动技能）
        提交后立即结算一整个回合（敌方默认普攻）
        """
        room = self.get_room_by_id(room_id)
        if not room:
            return None

        if room.get("status") != "in_progress":
            return room

        player_action = skills_svc.normalize_action(action_type) or {"type": "ATTACK"}

        room["last_action_ts"] = self._now()

        player = room["player"]
        enemy = room["enemy"]

        # 如果任意一方已经死亡，直接结束
        if player["hp"] <= 0 or enemy["hp"] <= 0:
            self._end_if_needed(room)
            return room

        # 逃跑优先：直接失败
        if player_action["type"] == "ESCAPE":
            room["result"] = {"winner": "enemy", "reason": "escape"}
            room["status"] = "finished"
            self._end_if_needed(room)
            return room

        # 敌方默认普攻
        enemy_action: ActionSpec = {"type": "ATTACK"}

        # 先后手：initiative 大的先
        player_first = player["initiative"] > enemy["initiative"] or (
            player["initiative"] == enemy["initiative"]
        )

        order: list[tuple[Side, ActionSpec]] = (
            [("player", player_action), ("enemy", enemy_action)]
            if player_first
            else [("enemy", enemy_action), ("player", player_action)]
        )

        self._begin_round_events(room)
        for side, act in order:
            if room["status"] != "in_progress":
                break
            self._exec_action(room, side, act)

        room["round"] = int(room.get("round", 1)) + 1
        room["updated_at"] = self._now()
        self._end_if_needed(room)
        # 死亡判定**之后**才结算被动恢复 —— 死亡空血优先（见 _apply_end_of_round_passives）
        self._apply_end_of_round_passives(room)
        # 若仍在进行中，进入下一回合指令阶段，设置服务器权威的截止时间（客户端倒计时与重连用）
        if room.get("status") == "in_progress":
            self._set_command_phase_deadline(room)
        self._persist_room(room)
        return room

    def _compute_pvp_round_and_advance(self, room: Dict[str, Any]) -> None:
        """
        内部方法：在 room 已锁定情况下，结算当前 round 并推进到下一回合（或 finished）。

        只负责“结算和推进”，不负责事件唤醒/等待逻辑。
        """
        actions = room.get("round_actions") or {"player": None, "enemy": None}
        skill_keys = room.get("round_skill_keys") or {}
        player_action: ActionSpec = self._compose_action(actions.get("player"), skill_keys.get("player"))
        enemy_action: ActionSpec = self._compose_action(actions.get("enemy"), skill_keys.get("enemy"))
        settled_round = int(room.get("round", 1))

        player = room["player"]
        enemy = room["enemy"]

        # ESCAPE 优先：直接结束战斗（winner 为另一方）
        if player_action["type"] == "ESCAPE":
            room["result"] = {"winner": "enemy", "reason": "escape"}
            room["status"] = "finished"
            self._end_if_needed(room)
            self._cancel_pvp_grace_watcher(str(room.get("room_id")))
            self._notify_pvp_round_settled(room, settled_round)
            return
        if enemy_action["type"] == "ESCAPE":
            room["result"] = {"winner": "player", "reason": "escape"}
            room["status"] = "finished"
            self._end_if_needed(room)
            self._cancel_pvp_grace_watcher(str(room.get("room_id")))
            self._notify_pvp_round_settled(room, settled_round)
            return

        # 先后手：initiative 大的先；initiative 相同则 player 先（保持与 PVE 一致）
        player_first = player["initiative"] > enemy["initiative"] or (player["initiative"] == enemy["initiative"])
        order: list[tuple[Side, ActionSpec]] = (
            [("player", player_action), ("enemy", enemy_action)]
            if player_first
            else [("enemy", enemy_action), ("player", player_action)]
        )

        self._begin_round_events(room)
        for side, act in order:
            if room["status"] != "in_progress":
                break
            self._exec_action(room, side, act)

        room["round"] = int(room.get("round", 1)) + 1
        room["updated_at"] = self._now()
        self._end_if_needed(room)
        # 死亡判定**之后**才结算被动恢复 —— 死亡空血优先（见 _apply_end_of_round_passives）
        self._apply_end_of_round_passives(room)

        if room.get("status") == "in_progress":
            # 重置下一回合指令
            room["round_actions"] = {"player": None, "enemy": None}
            room["round_skill_keys"] = {"player": None, "enemy": None}
            self._set_command_phase_deadline(room)
        self._persist_room(room)
        # 推进到新回合后，为其重新启动「空窗挽回期」守望（旧任务会在下一轮循环自然退出）
        if room.get("status") == "in_progress":
            self._ensure_pvp_grace_watcher(str(room.get("room_id")))
        else:
            self._cancel_pvp_grace_watcher(str(room.get("room_id")))
        # 主动通知双方客户端本回合已结算（含挂机方，修复其看不到动画/血条不更新）
        self._notify_pvp_round_settled(room, settled_round)

    async def submit_pvp_action(
        self,
        room_id: str,
        character_id: str,
        action_type: ActionSpec,
    ) -> Optional[Dict[str, Any]]:
        """
        提交 PVP 行为并结算一整个回合：
        - action_type 可以是 "ATTACK" / "DEFEND" / "ESCAPE"，或 {"type":"SKILL","skill_key":"roubo"}
        - 等待双方在当前命令阶段都提交动作后才结算
        - 如果超出 deadline，缺失方自动视为 ATTACK 结算
        """
        room = self.get_room_by_id(room_id)
        if not room:
            return None

        if room.get("mode") != "pvp":
            return None

        if room.get("status") != "in_progress":
            return room

        cid = str(character_id)
        player_cid = str(room.get("player_character_id") or "")
        enemy_cid = str(room.get("enemy_character_id") or "")
        if cid == player_cid:
            side: Side = "player"
        elif cid == enemy_cid:
            side = "enemy"
        else:
            return None

        room["last_action_ts"] = self._now()

        lock = self._pvp_room_locks.setdefault(room_id, asyncio.Lock())
        async with lock:
            # 锁内重新取最新房间，避免锁外快照过期（另一协程可能已推进回合）
            room = self.get_room_by_id(room_id) or room
            if room.get("status") != "in_progress":
                return room
            # 若已切换到下一回合，直接走新的 round_actions
            current_round = int(room.get("round", 1))
            event_key = f"{room_id}:{current_round}"
            event = self._pvp_round_events.get(event_key)
            if event is None:
                event = asyncio.Event()
                self._pvp_round_events[event_key] = event

            # 写入本方动作（若已写过同一回合，不覆盖也没关系）
            #   round_actions 存字符串类型；技能 key 单独存 round_skill_keys（保持既有字段类型不变）
            spec = skills_svc.normalize_action(action_type) or {"type": "ATTACK"}
            act_type = str(spec.get("type") or "ATTACK").upper()
            actions = room.get("round_actions") or {"player": None, "enemy": None}
            actions[side] = act_type
            room["round_actions"] = actions
            skill_keys = room.get("round_skill_keys") or {"player": None, "enemy": None}
            skill_keys[side] = spec.get("skill_key") if act_type == "SKILL" else None
            room["round_skill_keys"] = skill_keys

            # === 空窗挽回期：本方主动提交动作 → 解除本方接管 + 清零空窗计数 + 刷新活动时间 ===
            self._clear_side_noop(room, side)
            self._mark_round_activity(room)

            # PvP 自动战斗模式：
            # 如果另一方已进入 auto_actions（意味着它已连续空窗满 N 轮被永久接管），
            # 则本方提交任意动作后，服务器无需再等待对方，直接用 ATTACK 补齐并结算。
            auto_actions = room.get("auto_actions") or {"player": False, "enemy": False}
            other_side: Side = "enemy" if side == "player" else "player"
            if actions.get(other_side) is None and bool(auto_actions.get(other_side)):
                actions[other_side] = "ATTACK"
                room["round_actions"] = actions
                # 对侧是被永久接管自动补的，空窗轮数继续累计（保持接管状态）
                self._bump_side_noop(room, other_side)
                self._compute_pvp_round_and_advance(room)
                event.set()
                self._pvp_round_events.pop(event_key, None)
                return room

            # 如果双方动作齐全，直接结算并唤醒等待者
            if actions.get("player") is not None and actions.get("enemy") is not None:
                self._compute_pvp_round_and_advance(room)
                event.set()
                self._pvp_round_events.pop(event_key, None)
                return room

        # 在锁外循环等待：等待对方提交完毕结算，或依次经历「空窗观察期 → 倒计时 → 自动普攻结算」。
        #   用循环而非一次性 wait：空窗观察期满后只激活倒计时（不结算），需继续等到真正倒计时结束。
        while True:
            async with lock:
                latest = self.get_room_by_id(room_id)
                if not latest or latest.get("status") != "in_progress":
                    return latest
                if int(latest.get("round", 1)) != current_round:
                    # 回合已被推进
                    return latest
                # 双方动作是否已齐全（可能由对方提交或另一协程补全）
                acts = latest.get("round_actions") or {"player": None, "enemy": None}
                if acts.get("player") is not None and acts.get("enemy") is not None:
                    self._compute_pvp_round_and_advance(latest)
                    ev = self._pvp_round_events.get(event_key)
                    if ev is not None:
                        ev.set()
                        self._pvp_round_events.pop(event_key, None)
                    return latest

                now_ms = self._now_ms()
                if not bool(latest.get("grace_active")):
                    # 空窗观察期：等到 grace_deadline_ts
                    grace_dl = latest.get("grace_deadline_ts")
                    wait_sec = max(0.0, (float(grace_dl) - float(now_ms)) / 1000.0) if isinstance(grace_dl, (int, float)) else 0.0
                    phase = "grace"
                else:
                    # 倒计时已激活：等到 command_deadline_ts
                    dl = latest.get("command_deadline_ts")
                    wait_sec = max(0.0, (float(dl) - float(now_ms)) / 1000.0) if isinstance(dl, (int, float)) else 0.0
                    phase = "countdown"

            if wait_sec > 0:
                try:
                    await asyncio.wait_for(event.wait(), timeout=wait_sec)
                    # event 被置位：对方已提交并结算 → 跳出由下一轮循环检查判定
                    async with lock:
                        latest2 = self.get_room_by_id(room_id)
                        if latest2 and int(latest2.get("round", 1)) != current_round:
                            return latest2
                        acts2 = (latest2 or {}).get("round_actions") or {"player": None, "enemy": None}
                        if acts2.get("player") is not None and acts2.get("enemy") is not None:
                            self._compute_pvp_round_and_advance(latest2)
                            return latest2
                    continue
                except asyncio.TimeoutError:
                    pass

            # 等待到点（或无需等待）：在锁内推进状态机
            async with lock:
                latest = self.get_room_by_id(room_id)
                if not latest or latest.get("status") != "in_progress":
                    return latest
                if int(latest.get("round", 1)) != current_round:
                    return latest
                acts = latest.get("round_actions") or {"player": None, "enemy": None}
                if acts.get("player") is not None and acts.get("enemy") is not None:
                    self._compute_pvp_round_and_advance(latest)
                    return latest

                if not bool(latest.get("grace_active")):
                    # A) 空窗观察期满（任一方/双方无操作满 5 秒）→ 激活倒计时，不结算，回到循环继续等
                    self._activate_grace_countdown(latest)
                    latest["last_action_ts"] = self._now()
                    self._persist_room(latest)
                    continue

                # B) 倒计时结束 → 缺失方补普攻、累计空窗轮数（满 N 轮即永久接管），结算
                if acts.get("player") is None:
                    acts["player"] = "ATTACK"
                    self._bump_side_noop(latest, "player")
                if acts.get("enemy") is None:
                    acts["enemy"] = "ATTACK"
                    self._bump_side_noop(latest, "enemy")
                latest["round_actions"] = acts
                self._compute_pvp_round_and_advance(latest)

                ev = self._pvp_round_events.get(event_key)
                if ev is not None:
                    ev.set()
                    self._pvp_round_events.pop(event_key, None)
                return latest

    # ----------------------
    # 技能结算
    # ----------------------
    # 伤害链完全复刻 RPG Maker MV：
    #   公式（Skills.json 的 formula_scaled）→ 元素/物理率 → 暴击(×3) → 浮动(±variance%) → 防御减半
    #   → 技能等级倍率（floor(值 × 倍率)）
    # 服务端是唯一权威：HP/MP/伤害结果都在这里落地，客户端只按 round_events 做表现。

    @staticmethod
    def _compose_action(action_value: Any, skill_key: Any = None) -> Dict[str, Any]:
        """把「动作字符串（+技能 key）」组装成 _exec_action 认的结构体。

        round_actions 里存的一直是字符串（ATTACK / DEFEND / ESCAPE / SKILL），
        技能 key 单独放在 round_skill_keys —— 这样既不动已下发字段的类型，又能带技能信息。
        """
        atype = str(action_value or "ATTACK").strip().upper() or "ATTACK"
        if atype == "SKILL":
            return {"type": "SKILL", "skill_key": skill_key}
        return {"type": atype}

    def _begin_round_events(self, room: Dict[str, Any]) -> None:
        """回合开始：清空上回合的表现明细，并复位双方「防御」姿态。"""
        room["round_events"] = []
        for side in ("player", "enemy"):
            actor = room.get(side)
            if isinstance(actor, dict):
                actor["guarding"] = False

    def _push_round_event(self, room: Dict[str, Any], event: Dict[str, Any]) -> Dict[str, Any]:
        events = room.get("round_events")
        if not isinstance(events, list):
            events = []
            room["round_events"] = events
        events.append(event)
        return event

    def _resolve_targets(
        self, room: Dict[str, Any], side: Side, skill: Dict[str, Any]
    ) -> list:
        """按 scope 解析被作用方。

        ⚠ 当前房间是 **1v1**（每个 side 只有 1 个单位），因此 scope=2（全体敌人）
          在此退化为单体。要支持真·多单位，只需在这里按队伍成员展开，
          结算与表现链路无需改动。
        """
        info = resolve_scope(int(skill.get("scope") or 1))
        enemy_side: Side = "enemy" if side == "player" else "player"
        target_side: Side = enemy_side if info.get("side") == "enemy" else side
        actor = room.get(target_side)
        if not isinstance(actor, dict):
            return []
        return [{"side": target_side, "actor": actor}]

    def _exec_action(self, room: Dict[str, Any], side: Side, action: ActionSpec) -> None:
        """结算一次出手（普攻 / 技能 / 防御）。

        action 兼容旧写法 "ATTACK" 与新写法 {"type": "SKILL", "skill_key": "roubo"}。
        结算明细写入 room["round_events"]，供客户端演绎本回合。
        """
        act = skills_svc.normalize_action(action) or {"type": "ATTACK"}
        atype = str(act.get("type") or "ATTACK")

        attacker = room.get(side) or {}
        other_side: Side = "enemy" if side == "player" else "player"
        defender = room.get(other_side) or {}

        if not isinstance(attacker, dict) or not isinstance(defender, dict):
            return

        event: Dict[str, Any] = {
            "round": int(room.get("round", 1)),
            "side": side,
            "action": atype,
            "skill_key": None,
            "skill_name": None,
            "anim": None,
            "level": 1,
            "repeats": 1,
            "mp_cost": 0,
            "mp_after": int(attacker.get("mp", 0) or 0),
            "targets": [],
            "heals": [],
            "effects": [],
            "pending_effects": [],
            "failed": None,
        }

        # 「防御」：本回合不出手，并置防御姿态 → 本回合内受到的伤害按 RPG applyGuard 减半
        if atype == "DEFEND":
            attacker["guarding"] = True
            self._push_round_event(room, event)
            return

        if atype not in ("ATTACK", "SKILL"):
            return  # ESCAPE 由上层处理

        if int(attacker.get("hp", 0) or 0) <= 0 or int(defender.get("hp", 0) or 0) <= 0:
            return

        # ---- 选技能 ----
        if atype == "SKILL":
            skill = skills_svc.get_skill(act.get("skill_key"))
            if not skill:
                event["failed"] = "技能不存在"
                self._push_round_event(room, event)
                return
            event["skill_key"] = skill.get("key")
            event["skill_name"] = skill.get("name")
            event["anim"] = skill.get("anim")
            chk = skills_svc.can_cast_skill(attacker, skill)
            if not chk["ok"]:
                event["failed"] = chk["reason"]
                self._push_round_event(room, event)
                return
            cost = int(chk["mp_cost"])
        else:
            skill = skills_svc.normal_attack_skill(attacker, attacker.get("gun_equipped"))
            cost = 0

        formula = skills_svc.formula_of(skill)
        level = skills_svc.skill_level_of(attacker, skill.get("key"))
        repeats = max(1, int(skill.get("repeats") or 1))
        variance = float(skill.get("variance") or 0)
        critical_on = bool(skill.get("critical"))
        dmg_code = skills_svc.damage_code(skill)

        event["level"] = level
        event["repeats"] = repeats
        if skill.get("is_normal_attack"):
            event["skill_name"] = skill.get("name")

        # ---- 扣蓝（技能才有消耗；不足已在 can_cast_skill 拦下）----
        if cost > 0:
            attacker["mp"] = max(0, int(attacker.get("mp") or 0) - cost)
            event["mp_cost"] = cost
        event["mp_after"] = int(attacker.get("mp") or 0)

        targets = self._resolve_targets(room, side, skill)

        # ---- 伤害 / 吸取 ----
        if formula is not None and dmg_code in (1, 2, 3, 4):
            for tgt in targets:
                actor = tgt["actor"]
                total = 0
                crit_hit = False
                for _ in range(repeats):
                    if dmg_code in (1, 3) and int(actor.get("hp", 0) or 0) <= 0:
                        break
                    if dmg_code in (2, 4) and int(actor.get("mp", 0) or 0) <= 0:
                        break
                    res = make_damage_value(
                        formula,
                        attacker,
                        actor,
                        variance=variance,
                        critical_enabled=critical_on,
                        damage_type=1,          # 统一按正向求值，吸取由下面按 drain_ratio 处理
                        rng=self._rng,
                        min_value=self.MIN_DAMAGE,
                    )
                    value = skills_svc.apply_skill_level(res["value"], level)
                    if value < 0:
                        value = 0
                    crit_hit = crit_hit or bool(res["critical"])
                    total += value
                    if dmg_code == 1:
                        actor["hp"] = max(0, int(actor.get("hp") or 0) - value)
                    elif dmg_code == 2:
                        actor["mp"] = max(0, int(actor.get("mp") or 0) - value)
                    elif dmg_code == 3:
                        actor["hp"] = max(0, int(actor.get("hp") or 0) - value)
                    elif dmg_code == 4:
                        actor["mp"] = max(0, int(actor.get("mp") or 0) - value)

                entry = {
                    "side": tgt["side"],
                    "kind": str(skill.get("damage_type") or "none"),
                    "damage": int(total),
                    "crit": bool(crit_hit),
                    "hp_after": int(actor.get("hp") or 0),
                    "mp_after": int(actor.get("mp") or 0),
                }

                # 吸取：按 drain_ratio 回补自身（默认 0.5）
                if dmg_code in (3, 4) and total > 0:
                    ratio = float(skill.get("drain_ratio", 0.5) or 0.0)
                    back = int(total * ratio)
                    if back > 0:
                        attr = "hp" if dmg_code == 3 else "mp"
                        cap = "max_hp" if attr == "hp" else "max_mp"
                        limit = int(attacker.get(cap) or 0)
                        cur = int(attacker.get(attr) or 0)
                        after = min(limit, cur + back) if limit > 0 else cur + back
                        gained = after - cur
                        entry["drained"] = gained
                        # ⚠ 只有真的回了血/蓝才记 heals（已满时 gained=0）——
                        #   否则会给客户端下发「恢复 0 点」的空事件，表现层白白播一次治疗特效。
                        if gained > 0:
                            attacker[attr] = after
                            event["heals"].append({
                                "side": side, "attr": attr, "value": gained,
                                "cur": after, "max": limit, "from": "drain",
                            })

                event["targets"].append(entry)

        # ---- 效果（比例恢复 已生效；buff / 状态 仅记录，待用户给口径）----
        for eff in (skill.get("effects") or []):
            kind = eff.get("kind")
            if kind in ("hp_recover_ratio", "mp_recover_ratio"):
                attr = "hp" if kind == "hp_recover_ratio" else "mp"
                cap = "max_hp" if attr == "hp" else "max_mp"
                for tgt in targets:
                    actor = tgt["actor"]
                    limit = int(actor.get(cap) or 0)
                    if limit <= 0:
                        continue
                    amount = int(limit * float(eff.get("value1") or 0))
                    if amount < 1:
                        amount = 1
                    cur = int(actor.get(attr) or 0)
                    after = min(limit, cur + amount)
                    gained = after - cur
                    if gained <= 0:
                        continue
                    actor[attr] = after
                    event["heals"].append({
                        "side": tgt["side"], "attr": attr, "value": gained,
                        "cur": after, "max": limit, "from": kind,
                    })
                    event["effects"].append({
                        "kind": kind, "applied": True,
                        "target": tgt["side"], "value": gained,
                    })
            else:
                # add_buff / remove_buff / add_state / remove_state
                # → 结构与数值已记录，但「层数 / 持续回合 / 强度」口径待用户拍板，暂不改属性
                event["pending_effects"].append({
                    "kind": kind,
                    "param": eff.get("param"),
                    "value1": eff.get("value1"),
                    "value2": eff.get("value2"),
                    "applied": False,
                    "reason": "额外效果（buff / 状态）待口径，暂不改属性",
                })

        self._push_round_event(room, event)

    def _apply_end_of_round_passives(self, room: Dict[str, Any]) -> None:
        """
        回合结束被动结算（生命恢复 / 能量恢复）。

        ⚠ 必须紧跟在 _end_if_needed() **之后** 调用 —— 这里就是「死亡空血优先于恢复」的落点：
          1) 先做死亡判定；战斗已结束（有人倒下）则整体不结算任何恢复；
          2) 即使战斗继续，hp <= 0 的单位也一律跳过 —— 空血不回复、不复活。
        结算结果写入 room["round_passive_effects"]（按 side 分组），客户端据此播特效 + 治疗数字。
        """
        if room.get("status") != "in_progress":
            # 有单位倒下导致战斗结束 → 本回合不结算恢复
            room["round_passive_effects"] = {"player": [], "enemy": []}
            return

        effects: Dict[str, list] = {"player": [], "enemy": []}
        for side in ("player", "enemy"):
            actor = room.get(side) or {}

            # —— 死亡空血优先：倒下单位不享受任何恢复 ——
            if int(actor.get("hp", 0) or 0) <= 0:
                continue

            for raw_skill in (actor.get("skills") or []):
                skill_id = resolve_passive_skill_id(raw_skill)
                if not skill_id:
                    continue
                cfg = PASSIVE_END_OF_ROUND.get(skill_id) or {}
                attr = str(cfg.get("attr") or "")
                cap_key = str(cfg.get("max") or "")
                if not attr or not cap_key:
                    continue

                cap = int(actor.get(cap_key, 0) or 0)
                cur = int(actor.get(attr, 0) or 0)
                if cap <= 0 or cur >= cap:
                    continue  # 无该属性（如老数据没有 MaxMP）或已满 → 不产生效果

                amount = int(cap * float(cfg.get("ratio", 0.0) or 0.0)) + int(cfg.get("flat", 0) or 0)
                if amount < 1:
                    amount = 1
                after = min(cap, cur + amount)
                healed = after - cur
                if healed <= 0:
                    continue

                actor[attr] = after
                effects[side].append({
                    "skill_id": skill_id,
                    "name": cfg.get("name") or skill_id,
                    "anim": cfg.get("anim"),
                    "attr": attr,
                    "value": healed,   # 本次实际恢复量
                    "cur": after,
                    "max": cap,
                })

        room["round_passive_effects"] = effects

    def _end_if_needed(self, room: Dict[str, Any]) -> None:
        player = room["player"]
        enemy = room["enemy"]
        if room.get("status") != "finished":
            if player["hp"] <= 0 and enemy["hp"] <= 0:
                room["result"] = {"winner": "enemy", "reason": "ko"}  # 双方同归，暂定玩家失败
                room["status"] = "finished"
            elif enemy["hp"] <= 0:
                room["result"] = {"winner": "player", "reason": "ko"}
                room["status"] = "finished"
            elif player["hp"] <= 0:
                room["result"] = {"winner": "enemy", "reason": "ko"}
                room["status"] = "finished"

        if room.get("status") == "finished":
            room["updated_at"] = self._now()
            # 修复点：房间结束后从 char_room_index 移除，避免 resume 再找到该房间，后续战斗必须走 create 开新局
            rid = room.get("room_id")
            if room.get("mode") == "pvp":
                for cid_raw in [room.get("player_character_id"), room.get("enemy_character_id")]:
                    cid = str(cid_raw or "")
                    if cid and self.char_room_index.get(cid) == rid:
                        self.char_room_index.pop(cid, None)
            else:
                cid = str(room.get("character_id") or "")
                if cid and self.char_room_index.get(cid) == rid:
                    self.char_room_index.pop(cid, None)
            if rid:
                self._clear_idempotency_for_room(str(rid))
            # 持久化 finished（含 story_context），供 story_battle_finalize 按 room_id 校验
            self._persist_room(room)


# 全局单例，供 handler 使用
battle_room_service = BattleRoomService()

