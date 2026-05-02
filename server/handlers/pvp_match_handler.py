from __future__ import annotations

import asyncio
import time
from typing import Any, Dict, Optional

from handlers import utils
from services.battle_room_service import battle_room_service
from services.pvp_match_service import FlatMatchTicket, pvp_match_service

# 复用已有 battle_room_handler 的“加载玩家机甲快照/清理 ObjectId/刷新剩余秒数”
from handlers import battle_room_handler as brh


async def handle_pvp_flat_match(websocket, data: Dict[str, Any], current_character_id: Any):
    """
    PVP 平匹配：
    - 两个在线玩家都点击平匹配后配对
    - 5 秒内若匹配不到则返回失败（前端关闭战斗）
    - 配对成功后创建 pvp room，并返回当前玩家视图 state（player=自己）
    """
    token = data.get("token")
    user_id = data.get("user_id")
    user = utils.get_user_by_id_or_token(user_id=user_id, token=token)
    if not user:
        await utils.send_error_response(
            websocket,
            "pvp_flat_match",
            "用户不存在或未登录",
            code=401,
            request_data=data,
        )
        return

    cid = data.get("character_id") or current_character_id
    if cid is not None:
        cid = str(cid).strip() or None
    if not cid:
        await utils.send_error_response(
            websocket,
            "pvp_flat_match",
            "未选择角色",
            code=400,
            request_data=data,
        )
        return

    # 关键修复：无机甲角色不允许进入匹配队列，避免污染队列影响其它玩家
    current_player_pet = await brh._load_player_pet_snapshot(user, cid)
    if not current_player_pet:
        await utils.send_error_response(
            websocket,
            "pvp_flat_match",
            "当前角色没有可用机甲",
            code=400,
            request_data=data,
        )
        return

    # 防止已在战斗中再次匹配
    existing_room = battle_room_service.get_room_for_character(str(cid))
    if existing_room and existing_room.get("status") == "in_progress":
        await utils.send_error_response(
            websocket,
            "pvp_flat_match",
            "角色已在战斗中",
            code=409,
            request_data=data,
        )
        return

    # 只做“在线匹配”层面的校验：socket 仍应保持在线
    if not user or "is_online" in user:
        # 这里不强依赖 user 字段；服务端 Session 会控制 websocket 的在线状态
        pass

    match_timeout_sec = 5

    # 等待票据：第一位点击的人会把自己放入队列并等待事件
    ticket = FlatMatchTicket(
        user=user,
        character_id=cid,
        created_at=time.time(),
        event=asyncio.Event(),
        matched_result=None,
    )

    opponent_ticket = await pvp_match_service.enqueue_or_get_opponent(ticket)
    if opponent_ticket:
        # 第二位进入：配对成功，创建 room，并把视图 state 写入两边 ticket
        player_user = opponent_ticket.user
        player_character_id = opponent_ticket.character_id
        enemy_user = user
        enemy_character_id = cid

        # 创建双方机甲快照
        player_pet = await brh._load_player_pet_snapshot(player_user, player_character_id)
        enemy_pet = current_player_pet
        if not player_pet or not enemy_pet:
            await utils.send_error_response(
                websocket,
                "pvp_flat_match",
                "双方角色没有可用机甲",
                code=400,
                request_data=data,
            )
            # 唤醒等待方，避免其一直等
            opponent_ticket.matched_result = None
            opponent_ticket.event.set()
            return

        player_snapshot = brh._build_attrs_from_pet(player_pet)
        enemy_snapshot = brh._build_attrs_from_pet(enemy_pet)

        # 创建 PVP room：内部固定 player=opponent_ticket，enemy=当前请求者
        room = battle_room_service.create_pvp_room(
            player_user_id=player_user["_id"],
            player_character_id=player_character_id,
            player_doc=player_snapshot,
            enemy_user_id=enemy_user["_id"],
            enemy_character_id=enemy_character_id,
            enemy_doc=enemy_snapshot,
        )

        # 生成两边 view state（player=自己）
        view_for_opponent = battle_room_service.build_pvp_room_view_for_character(room, player_character_id)
        view_for_self = battle_room_service.build_pvp_room_view_for_character(room, enemy_character_id)

        # 刷新 remaining_command_seconds（匹配发生耗时后仍尽量准确）
        brh._refresh_remaining_command_seconds(view_for_opponent)
        brh._refresh_remaining_command_seconds(view_for_self)

        # 写入 ticket，并唤醒等待方
        opponent_ticket.matched_result = {
            "room_id": room["room_id"],
            "state": brh._clean_objectid_for_json(view_for_opponent),
        }
        opponent_ticket.event.set()

        # 当前请求者直接返回
        await utils.send_success_response(
            websocket,
            "pvp_flat_match",
            data={
                "room_id": room["room_id"],
                "state": brh._clean_objectid_for_json(view_for_self),
            },
            request_data=data,
        )
        return

    # 第一位：等待配对
    try:
        await asyncio.wait_for(ticket.event.wait(), timeout=match_timeout_sec)
    except asyncio.TimeoutError:
        await pvp_match_service.remove_ticket(ticket)
        await utils.send_error_response(
            websocket,
            "pvp_flat_match",
            "匹配超时",
            code=408,
            request_data=data,
        )
        return

    if not ticket.matched_result or not ticket.matched_result.get("state"):
        await utils.send_error_response(
            websocket,
            "pvp_flat_match",
            "匹配失败",
            code=400,
            request_data=data,
        )
        return

    await utils.send_success_response(
        websocket,
        "pvp_flat_match",
        data=ticket.matched_result,
        request_data=data,
    )

