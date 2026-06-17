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
import uuid
from typing import Any, Dict, Optional, Literal
from bson import ObjectId

Side = Literal["player", "enemy"]
ActionType = Literal["ATTACK", "DEFEND", "ESCAPE"]


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


class BattleRoomService:
    """简单的战斗房间管理服务（单机 PVE，一人一房间）"""

    # 每回合指令阶段时长（秒），客户端倒计时以此为准，重连时从 state 恢复
    COMMAND_PHASE_SECONDS = 30

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

        # 房间空闲超时时间（秒），超过则自动清理
        self.ROOM_IDLE_TIMEOUT = 10 * 60  # 10 分钟

    # ----------------------
    # 房间生命周期
    # ----------------------

    def _now(self) -> float:
        return time.time()

    def _now_ms(self) -> int:
        return int(time.time() * 1000)

    def _set_command_phase_deadline(self, room: Dict[str, Any]) -> None:
        """设置本回合指令阶段截止时间（服务器权威，供客户端倒计时与重连恢复）"""
        now_ms = self._now_ms()
        room["command_phase_start_ts"] = now_ms
        room["command_deadline_ts"] = now_ms + self.COMMAND_PHASE_SECONDS * 1000
        room["remaining_command_seconds"] = self.COMMAND_PHASE_SECONDS

    def _gen_room_id(self) -> str:
        return uuid.uuid4().hex

    def create_pve_room(
        self,
        user_id: Any,
        character_id: str,
        player_doc: Dict[str, Any],
        enemy_doc: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        创建一场 PVE 战斗房间。

        player_doc / enemy_doc 为“机甲属性快照”，应包含：
        - RobotName / Level / MaxHP / CurrentHP / Melee / Shooting / Armor / Initiative 等
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
            "round_actions": {"player": None, "enemy": None},  # ATTACK | DEFEND | ESCAPE | None
            # PvP：逐 side 的自动战斗模式
            # - 第 1 回合：仍允许等待（由客户端/超时补 ATTACK）
            # - 一旦某一 side 在回合内因未提交而触发“超时补 ATTACK”，则从下一回合开始该 side 自动选择 ATTACK
            "auto_actions": {"player": False, "enemy": False},
        }
        self._set_command_phase_deadline(room)

        self.rooms[room_id] = room
        self.char_room_index[player_character_id] = room_id
        self.char_room_index[enemy_character_id] = room_id
        self._persist_room(room)
        return room

    def build_pvp_room_view_for_character(self, room: Dict[str, Any], character_id: str) -> Dict[str, Any]:
        """
        给“当前 character_id 的客户端”返回一个 view：
        - 确保 view.player 永远表示当前客户端自己的那一方（便于沿用 BattleScene 逻辑）
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
        hp = int(doc.get("CurrentHP", doc.get("current_hp", max_hp)) or max_hp)

        melee = int(doc.get("CurrentMelee", doc.get("Melee", 0)) or 0)
        shoot = int(doc.get("CurrentShooting", doc.get("Shooting", 0)) or 0)
        armor = int(doc.get("CurrentArmor", doc.get("Armor", 0)) or 0)
        initiative = int(doc.get("CurrentInitiative", doc.get("Initiative", 10)) or 10)

        attack = melee + shoot
        defense = armor

        # 清理 raw 字段中的 ObjectId，确保可以 JSON 序列化
        cleaned_raw = _clean_objectid_for_json(doc)
        
        return {
            "side": side,
            "character_id": str(character_id) if character_id is not None else None,
            "name": name,
            "level": level,
            "max_hp": max_hp,
            "hp": max_hp if hp > max_hp else hp,
            "attack": attack,
            "defense": defense,
            "initiative": initiative,
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

    def get_room_by_id(self, room_id: str) -> Optional[Dict[str, Any]]:
        room = self.rooms.get(room_id)
        if not room:
            room = self._load_room_from_db(room_id)
            if room:
                self.rooms[room_id] = room
                cid = str(room.get('character_id') or room.get('player_character_id') or '')
                if cid and room.get('status') == 'in_progress':
                    self.char_room_index[cid] = room_id
        if not room:
            return None
        # 检查超时
        if self._now() - room.get("last_action_ts", room.get("created_at", 0)) > self.ROOM_IDLE_TIMEOUT:
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

    def _destroy_room(self, room_id: str) -> None:
        room = self.rooms.pop(room_id, None)
        if not room:
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

    # ----------------------
    # 战斗指令与结算
    # ----------------------

    def submit_player_action(
        self, room_id: str, action_type: ActionType
    ) -> Optional[Dict[str, Any]]:
        """
        玩家提交指令：
        - ATTACK / DEFEND / ESCAPE
        提交后立即结算一整个回合（敌方默认普攻）
        """
        room = self.get_room_by_id(room_id)
        if not room:
            return None

        if room.get("status") != "in_progress":
            return room

        room["last_action_ts"] = self._now()

        player = room["player"]
        enemy = room["enemy"]

        # 如果任意一方已经死亡，直接结束
        if player["hp"] <= 0 or enemy["hp"] <= 0:
            self._end_if_needed(room)
            return room

        # 逃跑优先：直接失败
        if action_type == "ESCAPE":
            room["result"] = {"winner": "enemy", "reason": "escape"}
            room["status"] = "finished"
            self._end_if_needed(room)
            return room

        # 敌方默认普攻
        enemy_action: ActionType = "ATTACK"

        # 先后手：initiative 大的先
        player_first = player["initiative"] > enemy["initiative"] or (
            player["initiative"] == enemy["initiative"]
        )

        order: list[tuple[Side, ActionType]] = (
            [("player", action_type), ("enemy", enemy_action)]
            if player_first
            else [("enemy", enemy_action), ("player", action_type)]
        )

        for side, act in order:
            if room["status"] != "in_progress":
                break
            self._exec_action(room, side, act)

        room["round"] = int(room.get("round", 1)) + 1
        room["updated_at"] = self._now()
        self._end_if_needed(room)
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
        player_action: ActionType = actions.get("player") or "ATTACK"
        enemy_action: ActionType = actions.get("enemy") or "ATTACK"

        player = room["player"]
        enemy = room["enemy"]

        # ESCAPE 优先：直接结束战斗（winner 为另一方）
        if player_action == "ESCAPE":
            room["result"] = {"winner": "enemy", "reason": "escape"}
            room["status"] = "finished"
            self._end_if_needed(room)
            return
        if enemy_action == "ESCAPE":
            room["result"] = {"winner": "player", "reason": "escape"}
            room["status"] = "finished"
            self._end_if_needed(room)
            return

        # 先后手：initiative 大的先；initiative 相同则 player 先（保持与 PVE 一致）
        player_first = player["initiative"] > enemy["initiative"] or (player["initiative"] == enemy["initiative"])
        order: list[tuple[Side, ActionType]] = (
            [("player", player_action), ("enemy", enemy_action)]
            if player_first
            else [("enemy", enemy_action), ("player", player_action)]
        )

        for side, act in order:
            if room["status"] != "in_progress":
                break
            self._exec_action(room, side, act)

        room["round"] = int(room.get("round", 1)) + 1
        room["updated_at"] = self._now()
        self._end_if_needed(room)

        if room.get("status") == "in_progress":
            # 重置下一回合指令
            room["round_actions"] = {"player": None, "enemy": None}
            self._set_command_phase_deadline(room)
        self._persist_room(room)

    async def submit_pvp_action(
        self,
        room_id: str,
        character_id: str,
        action_type: ActionType,
    ) -> Optional[Dict[str, Any]]:
        """
        提交 PVP 行为并结算一整个回合：
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
            actions = room.get("round_actions") or {"player": None, "enemy": None}
            actions[side] = action_type
            room["round_actions"] = actions

            # PvP 自动战斗模式：
            # 如果另一方已进入 auto_actions（意味着上一回合它超时未提交），
            # 则本方提交任意动作后，服务器无需再等待对方到 deadline，直接用 ATTACK 补齐并结算。
            auto_actions = room.get("auto_actions") or {"player": False, "enemy": False}
            other_side: Side = "enemy" if side == "player" else "player"
            if actions.get(other_side) is None and bool(auto_actions.get(other_side)):
                actions[other_side] = "ATTACK"
                room["round_actions"] = actions
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

            deadline_ts = room.get("command_deadline_ts")
            now_ms = self._now_ms()
            # deadline_ts 的单位为毫秒
            remaining_sec = 0.0
            if isinstance(deadline_ts, (int, float)):
                remaining_sec = max(0.0, (float(deadline_ts) - float(now_ms)) / 1000.0)

        # 在锁外等待：等待对方提交完毕结算，或直到 deadline 超时
        try:
            await asyncio.wait_for(event.wait(), timeout=remaining_sec if remaining_sec > 0 else 0.0)
        except asyncio.TimeoutError:
            async with lock:
                # 检查是否已经因为对方提交而推进过回合
                latest_room = self.get_room_by_id(room_id)
                if not latest_room or latest_room.get("status") != "in_progress":
                    return latest_room
                if int(latest_room.get("round", 1)) != current_round:
                    return latest_room

                # 超时结算：缺失方补 ATTACK
                actions = latest_room.get("round_actions") or {"player": None, "enemy": None}
                auto_actions = latest_room.get("auto_actions") or {"player": False, "enemy": False}
                if actions.get("player") is None:
                    actions["player"] = "ATTACK"
                    auto_actions["player"] = True
                if actions.get("enemy") is None:
                    actions["enemy"] = "ATTACK"
                    auto_actions["enemy"] = True
                latest_room["auto_actions"] = auto_actions
                latest_room["round_actions"] = actions
                self._compute_pvp_round_and_advance(latest_room)

                # 唤醒等待者（当前 coroutine 仍持有 event 引用）
                event.set()
                self._pvp_round_events.pop(event_key, None)
                return latest_room

        # event 已被置位，意味着 round 已推进完毕
        return self.get_room_by_id(room_id)

    def _exec_action(self, room: Dict[str, Any], side: Side, action: ActionType) -> None:
        if action == "DEFEND":
            # 当前简化为“跳过本回合”，以后可加入减伤等效果
            return

        player = room["player"]
        enemy = room["enemy"]
        attacker = player if side == "player" else enemy
        defender = enemy if side == "player" else player

        if attacker["hp"] <= 0 or defender["hp"] <= 0:
            return

        if action != "ATTACK":
            return

        raw_damage = int(attacker["attack"]) - int(defender["defense"])
        damage = max(1, raw_damage)
        defender["hp"] = max(0, int(defender["hp"]) - damage)

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
            if room.get("mode") == "pvp":
                for cid_raw in [room.get("player_character_id"), room.get("enemy_character_id")]:
                    cid = str(cid_raw or "")
                    if cid and self.char_room_index.get(cid) == room.get("room_id"):
                        self.char_room_index.pop(cid, None)
            else:
                cid = str(room.get("character_id") or "")
                if cid and self.char_room_index.get(cid) == room.get("room_id"):
                    self.char_room_index.pop(cid, None)


# 全局单例，供 handler 使用
battle_room_service = BattleRoomService()

