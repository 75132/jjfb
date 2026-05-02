"""
大世界同图在线：进入房间、同步步进、主动离开。
"""
from . import utils
from services.world_presence_service import world_presence_service


def _cid_str(raw) -> str:
    if raw is None:
        return ''
    return str(raw)


async def handle_world_enter(websocket, data, current_user_id, current_character_id):
    if not current_character_id:
        await utils.send_error_response(websocket, 'world_enter', '请先选择角色', code=400, request_data=data)
        return

    cid = _cid_str(current_character_id)
    user = utils.get_user_by_id_or_token(user_id=str(current_user_id) if current_user_id else None, token=data.get('token'))
    if not user:
        await utils.send_error_response(websocket, 'world_enter', '用户不存在或未登录', code=401, request_data=data)
        return

    try:
        map_id = int(data.get('map_id', 1))
    except Exception:
        map_id = 1
    if map_id <= 0:
        map_id = 1

    player = await utils.async_mongo_operation_read(
        lambda: utils.players_col.find_one({'character_id': cid}),
        max_retries=3,
        timeout=3.0,
    )
    if not player or str(player.get('user_id')) != str(user.get('_id')):
        await utils.send_error_response(websocket, 'world_enter', '角色不存在', code=404, request_data=data)
        return

    pos = player.get('position') or {}
    try:
        px = float(data.get('x', pos.get('x', 120.0)))
        py = float(data.get('y', pos.get('y', -24.0)))
    except Exception:
        px, py = 120.0, -24.0

    facing = str(data.get('facing', 'down') or 'down')
    role_name = str(player.get('role_name', '') or '')
    try:
        sprite = int(player.get('Sprite', 0) or 0)
    except Exception:
        sprite = 0

    others = await world_presence_service.enter(
        websocket,
        str(user.get('_id')),
        cid,
        map_id,
        px,
        py,
        facing,
        role_name,
        sprite,
    )

    await utils.send_success_response(
        websocket,
        'world_enter',
        data={
            'map_id': map_id,
            'others': others,
            'character_id': cid,
        },
        request_data=data,
        immediate=True,
    )


async def handle_world_leave(websocket, data, current_user_id, current_character_id):
    if not current_character_id:
        await utils.send_success_response(websocket, 'world_leave', data={'ok': True}, request_data=data)
        return
    cid = _cid_str(current_character_id)
    try:
        map_id = int(data.get('map_id', 1))
    except Exception:
        map_id = 1
    await world_presence_service.leave_map(websocket, cid, map_id)
    await utils.send_success_response(websocket, 'world_leave', data={'ok': True}, request_data=data)


async def handle_world_step(websocket, data, current_user_id, current_character_id):
    if not current_character_id:
        await utils.send_error_response(websocket, 'world_step', '未选择角色', code=400, request_data=data)
        return
    cid = _cid_str(current_character_id)
    try:
        map_id = int(data.get('map_id', 1))
        x = float(data.get('x'))
        y = float(data.get('y'))
    except Exception:
        await utils.send_error_response(websocket, 'world_step', '坐标无效', code=400, request_data=data)
        return

    facing = str(data.get('facing', 'down') or 'down')
    moving = bool(data.get('moving', False))

    ok, reason = await world_presence_service.move_step(websocket, cid, map_id, x, y, facing, moving)
    if not ok:
        await utils.send_error_response(websocket, 'world_step', reason, code=400, request_data=data)
        return

    await utils.send_success_response(
        websocket,
        'world_step',
        data={'ok': True, 'character_id': cid},
        request_data=data,
    )
