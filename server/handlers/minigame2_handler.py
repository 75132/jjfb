"""
期货投资系统（MiniGame2）WS 接口
"""

from __future__ import annotations

from typing import Any, Dict, Optional, Tuple

from services.minigame2_service import build_sync_payload, get_today_return_history, place_bet
from services.idempotency_service import idempotency_service

from . import utils


async def handle_minigame2_sync(websocket, data, current_user_id, current_character_id):
    if not current_user_id:
        await utils.send_error_response(websocket, "minigame2_sync", "未登录", code=401, request_data=data)
        return current_user_id, current_character_id

    cid = current_character_id or data.get("character_id")
    if not cid:
        await utils.send_error_response(websocket, "minigame2_sync", "未选择角色", code=400, request_data=data)
        return current_user_id, current_character_id

    payload = await build_sync_payload(str(current_user_id), str(cid))
    if payload.get("error"):
        await utils.send_error_response(
            websocket,
            "minigame2_sync",
            payload.get("error", "sync_failed"),
            code=400,
            request_data=data,
        )
        return current_user_id, current_character_id

    await utils.send_success_response(websocket, "minigame2_sync", data=payload, request_data=data)
    return current_user_id, current_character_id


async def handle_minigame2_bet(websocket, data, current_user_id, current_character_id):
    if not current_user_id:
        await utils.send_error_response(websocket, "minigame2_bet", "未登录", code=401, request_data=data)
        return current_user_id, current_character_id

    cid = current_character_id or data.get("character_id")
    if not cid:
        await utils.send_error_response(websocket, "minigame2_bet", "未选择角色", code=400, request_data=data)
        return current_user_id, current_character_id

    req_id = data.get("request_id")
    if req_id:
        cached = idempotency_service.get_result(req_id)
        if cached is not None:
            await utils.send_success_response(websocket, "minigame2_bet", data=cached, request_data=data)
            return current_user_id, current_character_id

    selected_key = data.get("selected_key")
    bet_amount = data.get("bet_amount")

    ok, reason, payload = await place_bet(
        user_id=str(current_user_id),
        character_id=str(cid),
        selected_key=selected_key,
        bet_amount=bet_amount,
    )

    if not ok:
        code_map = {
            "betting_closed": 400,
            "round_drawn": 400,
            "already_bet": 400,
            "invalid_selected_key": 400,
            "invalid_bet_amount": 400,
            "insufficient_energy": 400,
            "service_not_ready": 500,
        }
        code = code_map.get(reason, 400)
        # 尽量把错误信息变成客户端可读文案
        msg_map = {
            "betting_closed": "下注已关闭",
            "round_drawn": "本期已开奖",
            "already_bet": "本期已下注（不可更改）",
            "invalid_selected_key": "无效的下注类目",
            "invalid_bet_amount": "无效的下注金额",
            "insufficient_energy": "能量块不足",
            "concurrent_bet_conflict": "下注冲突，请稍后重试",
        }
        msg = msg_map.get(reason, reason or "bet_failed")
        await utils.send_error_response(websocket, "minigame2_bet", msg, code=code, request_data=data)
        return current_user_id, current_character_id

    # 为了客户端 UI 状态一致：下注后直接返回一份最新 sync payload
    #（否则 minigame2_bet 只回执扣款结果，客户端按 sync 结构解析会错位）
    sync_payload = await build_sync_payload(str(current_user_id), str(cid))

    if req_id and sync_payload is not None:
        idempotency_service.mark_processed(req_id, sync_payload)

    await utils.send_success_response(websocket, "minigame2_bet", data=sync_payload, request_data=data)
    return current_user_id, current_character_id


async def handle_minigame2_return_history_sync(websocket, data, current_user_id, current_character_id):
    """
    返回：
    {
      day_key,
      total_profit,
      history: [{ close_time_hm, winner_category_name, profit }]
    }
    """
    if not current_user_id:
        await utils.send_error_response(websocket, "minigame2_return_history_sync", "未登录", code=401, request_data=data)
        return current_user_id, current_character_id

    cid = current_character_id or data.get("character_id")
    if not cid:
        await utils.send_error_response(websocket, "minigame2_return_history_sync", "未选择角色", code=400, request_data=data)
        return current_user_id, current_character_id

    payload = await get_today_return_history(str(cid))
    if payload.get("error"):
        await utils.send_error_response(
            websocket,
            "minigame2_return_history_sync",
            payload.get("error", "history_failed"),
            code=400,
            request_data=data,
        )
        return current_user_id, current_character_id

    await utils.send_success_response(websocket, "minigame2_return_history_sync", data=payload, request_data=data)
    return current_user_id, current_character_id

