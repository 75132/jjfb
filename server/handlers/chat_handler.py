"""
聊天和公告相关操作处理器
处理：get_announcements_history, post_announcement, get_chat_history, post_chat
"""
import json
import datetime
from . import utils
import asyncio
from services.channel_service import channel_service

# 广播函数（将在初始化时设置）
_broadcast_to_all_async = None

def init_chat_handler(broadcast_func):
    """初始化聊天处理器"""
    global _broadcast_to_all_async
    _broadcast_to_all_async = broadcast_func

async def handle_get_announcements_history(websocket, data):
    """处理获取公告历史请求"""
    limit = int(data.get('limit', 8))
    cur = utils.messages_col.find({'type': 'announcement'}).sort('created_at', -1).limit(limit)
    lst = []
    for m in cur:
        lst.append({
            'text': m.get('text', ''),
            'created_at': m.get('created_at').isoformat() if m.get('created_at') else ''
        })
    # 使用直接发送格式（自动添加request_id）
    await utils.send_direct_response(websocket, {
        'type': 'get_announcements_history_response',
        'success': True,
        'announcements': lst
    }, request_data=data)

async def handle_post_announcement(websocket, data):
    """处理发布公告请求"""
    text = str(data.get('text', '')).strip()
    if not text:
        await utils.send_direct_response(websocket, {
            'type': 'post_announcement_response',
            'success': False,
            'message': '公告内容不能为空'
        }, request_data=data)
        return
    
    doc = {
        'type': 'announcement',
        'text': text,
        'created_at': datetime.datetime.utcnow()
    }
    utils.messages_col.insert_one(doc)
    payload = {'type': 'announcement', 'text': text}
    
    # MMO级优化：异步广播，不阻塞
    if _broadcast_to_all_async:
        asyncio.create_task(_broadcast_to_all_async(payload, max_concurrent=50))
    
    # 使用直接发送格式（自动添加request_id）
    await utils.send_direct_response(websocket, {
        'type': 'post_announcement_response',
        'success': True,
        'message': '公告发布成功'
    }, request_data=data)

async def handle_get_chat_history(websocket, data):
    """处理获取聊天历史请求"""
    limit = int(data.get('limit', 8))
    cur = utils.messages_col.find({'type': 'chat'}).sort('created_at', -1).limit(limit)
    lst = []
    for m in cur:
        lst.append({
            'text': m.get('text', ''),
            'sender': m.get('sender', ''),
            'character_id': str(m.get('character_id')) if m.get('character_id') else '',
            'created_at': m.get('created_at').isoformat() if m.get('created_at') else ''
        })
    # 使用直接发送格式（自动添加request_id）
    await utils.send_direct_response(websocket, {
        'type': 'get_chat_history_response',
        'success': True,
        'messages': lst
    }, request_data=data)

async def handle_post_chat(websocket, data, current_character_id):
    """处理发送聊天消息请求"""
    token = data.get('token')
    text = str(data.get('text', '')).strip()
    if not text:
        await utils.send_direct_response(websocket, {
            'type': 'post_chat_response',
            'success': False,
            'message': '聊天内容不能为空'
        }, request_data=data)
        return
    
    user_id = data.get('user_id')  # 测试模式
    user = utils.get_user_by_id_or_token(user_id=user_id, token=token)
    if not user:
        await utils.send_direct_response(websocket, {
            'type': 'post_chat_response',
            'success': False,
            'message': '用户不存在或未登录'
        }, request_data=data)
        return
    
    cid = data.get('character_id') or current_character_id
    sender = ''
    if cid:
        p = utils.players_col.find_one({'user_id': user['_id'], 'character_id': cid})
        if p:
            sender = p.get('role_name', '')
    
    doc = {
        'type': 'chat',
        'text': text,
        'user_id': user['_id'],
        'character_id': cid,
        'sender': sender,
        'created_at': datetime.datetime.utcnow()
    }
    utils.messages_col.insert_one(doc)
    payload = {
        'text': text,
        'sender': sender,
        'character_id': cid
    }
    
    # MMO级优化：使用 Channel 服务广播（参考 Pomelo Channel/Room 设计）
    # 注意：不再使用旧的 _broadcast_to_all_async，避免重复广播
    await channel_service.push_message(
        channel_name='global_chat',
        route='chat_message',
        msg=payload
    )
    
    # 使用直接发送格式（自动添加request_id）
    await utils.send_direct_response(websocket, {
        'type': 'post_chat_response',
        'success': True,
        'message': '消息发送成功'
    }, request_data=data)
