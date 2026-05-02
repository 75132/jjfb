"""
好友系统相关处理器
功能（首期）：
- get_friend_list       获取好友列表
- get_friend_requests   获取好友申请列表
- search_friend         通过六位好友ID搜索
- add_friend            发送好友申请
- approve_friend        同意好友申请
- reject_friend         拒绝好友申请
- delete_friend         删除好友

设计原则（参考 PomeloServer / 网游级）：
- 服务器权威：所有好友关系、申请列表都仅在服务器修改
- 使用 players_col 作为好友数据主表，避免额外集合，字段：
    - friend_id: 六位好友码（已在 character_handler 中生成）
    - friends: [friend_id, ...]        好友列表（按好友ID存）
    - friend_requests: [friend_id, ...] 收到的好友申请
- 使用统一响应格式：handlers.utils.send_response
"""

import json
from typing import List, Dict, Any

from . import utils


def _get_online_status_by_user_id(user_id) -> bool:
    """
    根据 user_id 判断是否在线
    通过 utils.user_clients 中是否存在连接来判断
    """
    try:
        if utils.user_clients is None:
            return False
        key = str(user_id)
        ws_set = utils.user_clients.get(key)
        return bool(ws_set)
    except Exception:
        return False


def _build_friend_payload(player_doc: Dict[str, Any]) -> Dict[str, Any]:
    """把 players_col 里的文档转换为前端需要的好友数据"""
    if not player_doc:
        return {}
    user_id = player_doc.get("user_id")
    online = _get_online_status_by_user_id(user_id)
    return {
        "character_id": str(player_doc.get("character_id") or ""),
        "friend_id": player_doc.get("friend_id") or "",
        "role_name": player_doc.get("role_name", ""),
        "Sprite": int(player_doc.get("Sprite", 0) or 0),
        "online": online,
    }


async def _get_self_player(user, character_id):
    """
    获取当前角色对应的 player 文档（MMO级优化：异步查询）
    """
    if not user or not character_id:
        return None
    return await utils.async_mongo_operation(
        lambda: utils.players_col.find_one(
            {"user_id": user["_id"], "character_id": character_id}
        ),
        timeout=2.0  # 2秒超时
    )


async def handle_get_friend_list(websocket, data, current_user_id, current_character_id):
    """获取好友列表（MMO级优化：使用缓存和批量查询）"""
    user = utils.get_user_by_id_or_token(
        user_id=current_user_id, token=data.get("token")
    )
    if not user:
        await utils.send_error_response(
            websocket, "get_friend_list", "用户不存在或未登录", code=401, request_data=data
        )
        return current_user_id, current_character_id

    cid = data.get("character_id") or current_character_id
    player = await _get_self_player(user, cid)
    if not player:
        await utils.send_error_response(
            websocket, "get_friend_list", "角色不存在", code=400, request_data=data
        )
        return current_user_id, current_character_id

    friend_ids: List[str] = player.get("friends", []) or []
    
    # MMO级优化：使用缓存（缓存键：character_id + friend_ids的hash）
    if friend_ids:
        cache_key = f"friend_list_{cid}_{hash(tuple(sorted(friend_ids)))}"
        cached_result = utils.get_cached_query(cache_key)
        if cached_result is not None:
            await utils.send_success_response(
                websocket, "get_friend_list", data={"list": cached_result}, request_data=data
            )
            return current_user_id, current_character_id
        
        # MMO级优化：使用异步数据库操作，避免阻塞事件循环
        try:
            # 批量查询好友（MMO级优化：使用list()一次性获取，而不是游标）
            friends_docs = await utils.async_mongo_operation(
                lambda: list(utils.players_col.find(
                    {"friend_id": {"$in": friend_ids}},
                    {"_id": 1, "character_id": 1, "friend_id": 1, "role_name": 1, 
                     "Sprite": 1, "user_id": 1}  # 只查询需要的字段
                )),
                timeout=3.0  # 3秒超时
            )
            
            # 构建好友列表
            friends: List[Dict[str, Any]] = []
            for doc in friends_docs:
                friends.append(_build_friend_payload(doc))
            
            # 缓存结果（30秒）
            utils.set_cached_query(cache_key, friends)
        except TimeoutError:
            # 查询超时，返回空列表
            await utils.send_error_response(
                websocket, "get_friend_list", "查询超时，请稍后重试", code=500, request_data=data
            )
            return current_user_id, current_character_id
        except Exception as e:
            await utils.send_error_response(
                websocket, "get_friend_list", f"查询失败: {str(e)}", code=500, request_data=data
            )
            return current_user_id, current_character_id
    else:
        friends = []
    
    await utils.send_success_response(
        websocket, "get_friend_list", data={"list": friends}, request_data=data
    )
    return current_user_id, current_character_id


async def handle_get_friend_requests(
    websocket, data, current_user_id, current_character_id
):
    """获取收到的好友申请列表（MMO级优化：使用缓存和批量查询）"""
    user = utils.get_user_by_id_or_token(
        user_id=current_user_id, token=data.get("token")
    )
    if not user:
        await utils.send_error_response(
            websocket, "get_friend_requests", "用户不存在或未登录", code=401, request_data=data
        )
        return current_user_id, current_character_id

    cid = data.get("character_id") or current_character_id
    player = await _get_self_player(user, cid)
    if not player:
        await utils.send_error_response(
            websocket, "get_friend_requests", "角色不存在", code=400, request_data=data
        )
        return current_user_id, current_character_id

    req_ids: List[str] = player.get("friend_requests", []) or []
    
    # MMO级优化：使用缓存
    if req_ids:
        cache_key = f"friend_requests_{cid}_{hash(tuple(sorted(req_ids)))}"
        cached_result = utils.get_cached_query(cache_key)
        if cached_result is not None:
            await utils.send_success_response(
                websocket, "get_friend_requests", data={"list": cached_result}, request_data=data
            )
            return current_user_id, current_character_id
        
        # MMO级优化：使用异步数据库操作，避免阻塞事件循环
        try:
            # 批量查询（MMO级优化：使用list()一次性获取）
            req_docs = await utils.async_mongo_operation(
                lambda: list(utils.players_col.find(
                    {"friend_id": {"$in": req_ids}},
                    {"_id": 1, "character_id": 1, "friend_id": 1, "role_name": 1,
                     "Sprite": 1, "user_id": 1}  # 只查询需要的字段
                )),
                timeout=3.0  # 3秒超时
            )
            
            req_list: List[Dict[str, Any]] = []
            for doc in req_docs:
                req_list.append(_build_friend_payload(doc))
            
            # 缓存结果（30秒）
            utils.set_cached_query(cache_key, req_list)
        except TimeoutError:
            # 查询超时，返回空列表
            await utils.send_error_response(
                websocket, "get_friend_requests", "查询超时，请稍后重试", code=500, request_data=data
            )
            return current_user_id, current_character_id
        except Exception as e:
            await utils.send_error_response(
                websocket, "get_friend_requests", f"查询失败: {str(e)}", code=500, request_data=data
            )
            return current_user_id, current_character_id
    else:
        req_list = []

    await utils.send_success_response(
        websocket, "get_friend_requests", data={"list": req_list}, request_data=data
    )
    return current_user_id, current_character_id


async def handle_search_friend(websocket, data, current_user_id, current_character_id):
    """通过六位好友ID搜索玩家"""
    friend_id = str(data.get("friend_id", "")).strip()
    if not friend_id or len(friend_id) != 6:
        await utils.send_error_response(
            websocket, "search_friend", "好友ID必须是6位数字", code=400, request_data=data
        )
        return current_user_id, current_character_id

    # 查找目标玩家（MMO级优化：异步查询）
    try:
        target = await utils.async_mongo_operation(
            lambda: utils.players_col.find_one({"friend_id": friend_id}),
            timeout=2.0
        )
    except (TimeoutError, Exception) as e:
        await utils.send_error_response(websocket, "search_friend", f"查询失败: {str(e)}", 500, request_data=data)
        return current_user_id, current_character_id
    if not target:
        await utils.send_error_response(websocket, "search_friend", "未找到该好友", 404, request_data=data)
        return current_user_id, current_character_id

    payload = _build_friend_payload(target)
    await utils.send_success_response(
        websocket, "search_friend", data={"friend": payload}, request_data=data
    )
    return current_user_id, current_character_id


async def handle_add_friend(websocket, data, current_user_id, current_character_id):
    """发送好友申请（把自己加到对方的 friend_requests 列表中）"""
    token = data.get("token")
    user = utils.get_user_by_id_or_token(user_id=current_user_id, token=token)
    if not user:
        await utils.send_error_response(
            websocket, "add_friend", "用户不存在或未登录", code=401, request_data=data
        )
        return current_user_id, current_character_id

    cid = data.get("character_id") or current_character_id
    self_player = await _get_self_player(user, cid)
    if not self_player:
        await utils.send_error_response(
            websocket, "add_friend", "角色不存在", code=400, request_data=data
        )
        return current_user_id, current_character_id

    my_friend_id = self_player.get("friend_id")
    if not my_friend_id:
        await utils.send_error_response(
            websocket, "add_friend", "当前角色没有好友ID", code=500, request_data=data
        )
        return current_user_id, current_character_id

    target_friend_id = str(
        data.get("target_friend_id") or data.get("friend_id") or ""
    ).strip()
    if not target_friend_id:
        await utils.send_error_response(
            websocket, "add_friend", "缺少目标好友ID", code=400, request_data=data
        )
        return current_user_id, current_character_id

    if target_friend_id == my_friend_id:
        await utils.send_error_response(
            websocket, "add_friend", "不能添加自己为好友", code=400, request_data=data
        )
        return current_user_id, current_character_id

    # 查找目标玩家（MMO级优化：异步查询）
    try:
        target_player = await utils.async_mongo_operation(
            lambda: utils.players_col.find_one({"friend_id": target_friend_id}),
            timeout=2.0
        )
    except (TimeoutError, Exception) as e:
        await utils.send_error_response(
            websocket, "add_friend", f"查询失败: {str(e)}", code=500, request_data=data
        )
        return current_user_id, current_character_id
    if not target_player:
        await utils.send_error_response(
            websocket, "add_friend", "目标好友不存在", code=404, request_data=data
        )
        return current_user_id, current_character_id

    # 检查是否已经是好友
    self_friends = set(self_player.get("friends", []) or [])
    if target_friend_id in self_friends:
        await utils.send_error_response(
            websocket, "add_friend", "已经是好友", code=400, request_data=data
        )
        return current_user_id, current_character_id

    # 把我的 friend_id 加入对方的 friend_requests
    target_reqs = set(target_player.get("friend_requests", []) or [])
    if my_friend_id in target_reqs:
        # 已经发过申请了，直接返回成功（幂等）
        await utils.send_success_response(
            websocket, "add_friend", data={"pending": True}, message="已发送申请", request_data=data
        )
        return current_user_id, current_character_id

    target_reqs.add(my_friend_id)
    try:
        await utils.async_mongo_operation(
            lambda: utils.players_col.update_one(
                {"_id": target_player["_id"]},
                {"$set": {"friend_requests": list(target_reqs)}},
            ),
            timeout=2.0
        )
    except (TimeoutError, Exception) as e:
        await utils.send_error_response(
            websocket, "add_friend", f"更新失败: {str(e)}", code=500, request_data=data
        )
        return current_user_id, current_character_id

    await utils.send_success_response(
        websocket, "add_friend", data={"pending": True}, message="好友申请已发送", request_data=data
    )
    return current_user_id, current_character_id


async def handle_approve_friend(
    websocket, data, current_user_id, current_character_id
):
    """同意好友申请：两边互相加入 friends，并从 friend_requests 移除"""
    token = data.get("token")
    user = utils.get_user_by_id_or_token(user_id=current_user_id, token=token)
    if not user:
        await utils.send_error_response(
            websocket, "approve_friend", "用户不存在或未登录", code=401, request_data=data
        )
        return current_user_id, current_character_id

    cid = data.get("character_id") or current_character_id
    self_player = await _get_self_player(user, cid)
    if not self_player:
        await utils.send_error_response(
            websocket, "approve_friend", "角色不存在", code=400, request_data=data
        )
        return current_user_id, current_character_id

    my_friend_id = self_player.get("friend_id")
    if not my_friend_id:
        await utils.send_error_response(
            websocket, "approve_friend", "当前角色没有好友ID", code=500, request_data=data
        )
        return current_user_id, current_character_id

    from_friend_id = str(data.get("friend_id") or "").strip()
    if not from_friend_id:
        await utils.send_error_response(
            websocket, "approve_friend", "缺少申请方好友ID", code=400, request_data=data
        )
        return current_user_id, current_character_id

    # 申请必须存在于我的 friend_requests
    my_reqs = set(self_player.get("friend_requests", []) or [])
    if from_friend_id not in my_reqs:
        await utils.send_error_response(
            websocket, "approve_friend", "没有找到对应的好友申请", code=400, request_data=data
        )
        return current_user_id, current_character_id

    # 查找对方 player（MMO级优化：异步查询）
    try:
        other_player = await utils.async_mongo_operation(
            lambda: utils.players_col.find_one({"friend_id": from_friend_id}),
            timeout=2.0
        )
    except (TimeoutError, Exception) as e:
        await utils.send_error_response(
            websocket, "approve_friend", f"查询失败: {str(e)}", code=500, request_data=data
        )
        return current_user_id, current_character_id
    if not other_player:
        await utils.send_error_response(
            websocket, "approve_friend", "对方角色不存在", code=404, request_data=data
        )
        return current_user_id, current_character_id

    # 更新我这边（MMO级优化：异步更新）
    my_friends = set(self_player.get("friends", []) or [])
    my_friends.add(from_friend_id)
    my_reqs.discard(from_friend_id)
    try:
        await utils.async_mongo_operation(
            lambda: utils.players_col.update_one(
                {"_id": self_player["_id"]},
                {
                    "$set": {
                        "friends": list(my_friends),
                        "friend_requests": list(my_reqs),
                    }
                },
            ),
            timeout=2.0
        )
    except (TimeoutError, Exception) as e:
        await utils.send_error_response(
            websocket, "approve_friend", f"更新失败: {str(e)}", code=500, request_data=data
        )
        return current_user_id, current_character_id

    # 更新对方（MMO级优化：异步更新）
    other_friends = set(other_player.get("friends", []) or [])
    other_friends.add(my_friend_id)
    try:
        await utils.async_mongo_operation(
            lambda: utils.players_col.update_one(
                {"_id": other_player["_id"]},
                {"$set": {"friends": list(other_friends)}},
            ),
            timeout=2.0
        )
    except (TimeoutError, Exception) as e:
        # 即使对方更新失败，也返回成功（因为我已经更新了）
        pass

    await utils.send_success_response(websocket, "approve_friend", data={}, request_data=data)
    return current_user_id, current_character_id


async def handle_reject_friend(
    websocket, data, current_user_id, current_character_id
):
    """拒绝好友申请：仅从自己的 friend_requests 中移除"""
    token = data.get("token")
    user = utils.get_user_by_id_or_token(user_id=current_user_id, token=token)
    if not user:
        await utils.send_error_response(
            websocket, "reject_friend", "用户不存在或未登录", code=401, request_data=data
        )
        return current_user_id, current_character_id

    cid = data.get("character_id") or current_character_id
    self_player = await _get_self_player(user, cid)
    if not self_player:
        await utils.send_error_response(
            websocket, "reject_friend", "角色不存在", code=400, request_data=data
        )
        return current_user_id, current_character_id

    from_friend_id = str(data.get("friend_id") or "").strip()
    if not from_friend_id:
        await utils.send_error_response(
            websocket, "reject_friend", "缺少申请方好友ID", code=400, request_data=data
        )
        return current_user_id, current_character_id

    my_reqs = set(self_player.get("friend_requests", []) or [])
    if from_friend_id in my_reqs:
        my_reqs.discard(from_friend_id)
        try:
            await utils.async_mongo_operation(
                lambda: utils.players_col.update_one(
                    {"_id": self_player["_id"]},
                    {"$set": {"friend_requests": list(my_reqs)}},
                ),
                timeout=2.0
            )
        except (TimeoutError, Exception) as e:
            # 更新失败，但继续返回成功（幂等）
            pass

    await utils.send_success_response(websocket, "reject_friend", data={}, request_data=data)
    return current_user_id, current_character_id


async def handle_delete_friend(
    websocket, data, current_user_id, current_character_id
):
    """删除好友：两边各自从 friends 中移除对方"""
    token = data.get("token")
    user = utils.get_user_by_id_or_token(user_id=current_user_id, token=token)
    if not user:
        await utils.send_error_response(
            websocket, "delete_friend", "用户不存在或未登录", code=401, request_data=data
        )
        return current_user_id, current_character_id

    cid = data.get("character_id") or current_character_id
    self_player = await _get_self_player(user, cid)
    if not self_player:
        await utils.send_error_response(
            websocket, "delete_friend", "角色不存在", code=400, request_data=data
        )
        return current_user_id, current_character_id

    my_friend_id = self_player.get("friend_id")
    if not my_friend_id:
        await utils.send_error_response(
            websocket, "delete_friend", "当前角色没有好友ID", code=500, request_data=data
        )
        return current_user_id, current_character_id

    target_friend_id = str(data.get("friend_id") or "").strip()
    if not target_friend_id:
        await utils.send_error_response(
            websocket, "delete_friend", "缺少目标好友ID", code=400, request_data=data
        )
        return current_user_id, current_character_id

    # 更新我这边（MMO级优化：异步更新）
    my_friends = set(self_player.get("friends", []) or [])
    if target_friend_id in my_friends:
        my_friends.discard(target_friend_id)
        try:
            await utils.async_mongo_operation(
                lambda: utils.players_col.update_one(
                    {"_id": self_player["_id"]},
                    {"$set": {"friends": list(my_friends)}},
                ),
                timeout=2.0
            )
        except (TimeoutError, Exception) as e:
            # 更新失败，但继续处理对方
            pass

    # 更新对方（MMO级优化：异步查询和更新）
    try:
        other_player = await utils.async_mongo_operation(
            lambda: utils.players_col.find_one({"friend_id": target_friend_id}),
            timeout=2.0
        )
        if other_player:
            other_friends = set(other_player.get("friends", []) or [])
            if my_friend_id in other_friends:
                other_friends.discard(my_friend_id)
                try:
                    await utils.async_mongo_operation(
                        lambda: utils.players_col.update_one(
                            {"_id": other_player["_id"]},
                            {"$set": {"friends": list(other_friends)}},
                        ),
                        timeout=2.0
                    )
                except (TimeoutError, Exception) as e:
                    # 对方更新失败，但继续返回成功
                    pass
    except (TimeoutError, Exception) as e:
        # 查询对方失败，但继续返回成功（因为我已经更新了）
        pass

    await utils.send_success_response(websocket, "delete_friend", data={}, request_data=data)
    return current_user_id, current_character_id



