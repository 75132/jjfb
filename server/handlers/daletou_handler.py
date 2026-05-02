"""每日大乐透 WS 接口"""
from . import utils
from services.daletou_service import build_sync_payload, claim_participation
from services.idempotency_service import idempotency_service


async def handle_daletou_sync(websocket, data, current_user_id, current_character_id):
    if not current_user_id:
        await utils.send_error_response(websocket, 'daletou_sync', '未登录', code=401, request_data=data)
        return current_user_id, current_character_id

    cid = current_character_id or data.get('character_id')
    if not cid:
        await utils.send_error_response(websocket, 'daletou_sync', '未选择角色', code=400, request_data=data)
        return current_user_id, current_character_id

    payload = build_sync_payload(utils.players_col, current_user_id, str(cid))
    if payload.get('error'):
        await utils.send_error_response(
            websocket, 'daletou_sync', payload.get('error', 'sync_failed'), code=400, request_data=data
        )
        return current_user_id, current_character_id

    await utils.send_success_response(websocket, 'daletou_sync', data=payload, request_data=data)
    return current_user_id, current_character_id


async def handle_daletou_claim(websocket, data, current_user_id, current_character_id):
    if not current_user_id:
        await utils.send_error_response(websocket, 'daletou_claim', '未登录', code=401, request_data=data)
        return current_user_id, current_character_id

    cid = current_character_id or data.get('character_id')
    if not cid:
        await utils.send_error_response(websocket, 'daletou_claim', '未选择角色', code=400, request_data=data)
        return current_user_id, current_character_id

    req_id = data.get('request_id')
    if req_id:
        cached = idempotency_service.get_result(req_id)
        if cached is not None:
            await utils.send_success_response(websocket, 'daletou_claim', data=cached, request_data=data)
            return current_user_id, current_character_id

    ok, reason, payload = claim_participation(utils.players_col, current_user_id, str(cid))
    if not ok:
        if reason == 'not_enough_online':
            await utils.send_error_response(
                websocket, 'daletou_claim', '当日在线未满3小时', code=400, request_data=data
            )
        else:
            await utils.send_error_response(
                websocket, 'daletou_claim', reason or 'claim_failed', code=400, request_data=data
            )
        return current_user_id, current_character_id

    if req_id and payload:
        idempotency_service.mark_processed(req_id, payload)

    await utils.send_success_response(websocket, 'daletou_claim', data=payload, request_data=data)
    return current_user_id, current_character_id
