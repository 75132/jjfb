"""
邮件 WebSocket 处理器
"""
from . import utils
from services.mail_service import list_mails, mark_read, claim_attachments, delete_mail, send_mail


async def _resolve(websocket, data, current_user_id, current_character_id):
    user = utils.get_user_by_id_or_token(user_id=current_user_id, token=data.get("token"))
    if not user:
        await utils.send_error_response(websocket, data.get("type", "mail"), "未登录", code=401, request_data=data)
        return None, None, None
    cid = data.get("character_id") or current_character_id
    if not cid:
        await utils.send_error_response(websocket, data.get("type", "mail"), "未选择角色", code=400, request_data=data)
        return None, None, None
    return user, user["_id"], cid


async def handle_mail_list(websocket, data, current_user_id, current_character_id):
    user, uid, cid = await _resolve(websocket, data, current_user_id, current_character_id)
    if not user:
        return current_user_id, current_character_id
    mails = await list_mails(cid)
    await utils.send_success_response(websocket, "mail_list", data={"mails": mails}, request_data=data)
    return current_user_id, current_character_id


async def handle_mail_read(websocket, data, current_user_id, current_character_id):
    user, uid, cid = await _resolve(websocket, data, current_user_id, current_character_id)
    if not user:
        return current_user_id, current_character_id
    mail_id = data.get("mail_id")
    if not mail_id:
        await utils.send_error_response(websocket, "mail_read", "缺少 mail_id", code=400, request_data=data)
        return current_user_id, current_character_id
    await mark_read(cid, mail_id)
    await utils.send_success_response(websocket, "mail_read", data={"mail_id": mail_id}, request_data=data)
    return current_user_id, current_character_id


async def handle_mail_claim(websocket, data, current_user_id, current_character_id):
    user, uid, cid = await _resolve(websocket, data, current_user_id, current_character_id)
    if not user:
        return current_user_id, current_character_id
    mail_id = data.get("mail_id")
    if not mail_id:
        await utils.send_error_response(websocket, "mail_claim", "缺少 mail_id", code=400, request_data=data)
        return current_user_id, current_character_id
    result = await claim_attachments(uid, cid, mail_id)
    if not result.get("success"):
        await utils.send_error_response(websocket, "mail_claim", result.get("error", "领取失败"), code=400, request_data=data)
        return current_user_id, current_character_id
    await utils.send_success_response(websocket, "mail_claim", data=result, request_data=data)
    return current_user_id, current_character_id


async def handle_mail_delete(websocket, data, current_user_id, current_character_id):
    user, uid, cid = await _resolve(websocket, data, current_user_id, current_character_id)
    if not user:
        return current_user_id, current_character_id
    mail_id = data.get("mail_id")
    if not mail_id:
        await utils.send_error_response(websocket, "mail_delete", "缺少 mail_id", code=400, request_data=data)
        return current_user_id, current_character_id
    ok = await delete_mail(cid, mail_id)
    await utils.send_success_response(websocket, "mail_delete", data={"deleted": ok, "mail_id": mail_id}, request_data=data)
    return current_user_id, current_character_id


async def handle_admin_send_mail(websocket, data):
    character_id = data.get("character_id")
    if not character_id:
        await utils.send_error_response(websocket, "admin_send_mail", "缺少 character_id", code=400, request_data=data)
        return
    player = utils.safe_mongo_operation(lambda: utils.players_col.find_one({"character_id": character_id}))
    if not player:
        await utils.send_error_response(websocket, "admin_send_mail", "角色不存在", code=404, request_data=data)
        return
    mail_id = await send_mail(
        player["user_id"],
        character_id,
        title=str(data.get("title", "GM邮件")),
        body=str(data.get("body", "")),
        attachments=data.get("attachments") or [],
        source="admin",
    )
    await utils.send_success_response(websocket, "admin_send_mail", data={"mail_id": mail_id}, request_data=data)
