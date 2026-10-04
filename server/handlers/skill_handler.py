# -*- coding: utf-8 -*-
"""技能系统接口（服务端权威）

对外消息
--------
- `skill_level_up`  技能面板「升级技能」按钮：升级某机甲**已学**技能（消耗技能书，GUI 后续做）
- `skill_list`      列出某机甲的技能（**默认只列已学**；`learned_only=false` 切图鉴模式）
- `apply_skill_book()`（非消息）**技能书使用的唯一落库入口**，由 `bag_handler` 的
  「使用道具」调用 —— **只用来「学会」**；已学则拒绝。

设计要点
--------
- 已学技能存在机甲宠物文档的 `Skills` 字段（key 数组），每机甲每技能等级存在
  `SkillLevels`（`{key: lv}`）。**机甲初始 / 获得时两者都为空**，只有用技能书学会才写入。
- 条件判定（职业匹配 / 已学 / 书数 / 机甲等级 / `lv_manual` / 封顶）全在
  `skill_level_service` + `skill_book_service`，本模块只负责：
  鉴权 → 读机甲 + 背包 → 判定 → **写技能状态 → 扣书** → 回执。
- **顺序铁律**：先写技能状态、后扣技能书。若扣书失败则把技能状态回滚（含 `$unset`
  本次新建的 `Skills` 字段）——最坏情况是「玩家白得一个技能」，绝不会出现
  「扣了书没学会」（玩家丢道具更不可接受）。
- 扣书复用背包既有 `consume_item_from_bag`（数量不足直接失败，不会扣成负数）。
- 两条入口（背包用书 / 面板按钮）**共用 `commit_skill_state` / `consume_books` /
  `rollback_skill_state`**，避免口径分叉。
"""
from __future__ import annotations

import asyncio
import json
from typing import Any, Dict, Optional

from bson import ObjectId

from . import utils
from .bag_handler import consume_item_from_bag
from services import skill_service as skills_svc
from services import skill_level_service as skill_level_svc
from services import skill_book_service as skill_book_svc

__all__ = [
    "handle_skill_level_up",
    "handle_skill_list",
    "apply_skill_book",
    "commit_skill_state",
    "commit_levels",
    "consume_books",
    "rollback_skill_state",
    "rollback_levels",
]

# 手动升级请求锁（按 pet_id 串行化，避免连点导致重复升级 / 重复扣书）
_LEVEL_UP_LOCKS: Dict[str, asyncio.Lock] = {}


def _lock_for(pet_id: str) -> asyncio.Lock:
    lock = _LEVEL_UP_LOCKS.get(pet_id)
    if lock is None:
        lock = asyncio.Lock()
        _LEVEL_UP_LOCKS[pet_id] = lock
    return lock


async def _load_pet(pet_object_id: ObjectId, user_id) -> Optional[Dict[str, Any]]:
    return await utils.async_mongo_operation_read(lambda: utils.robotpet_col.find_one({
        '_id': pet_object_id,
        'user_id': user_id,
    }))


async def _count_item(user_id, character_id: str, item_id: int) -> int:
    """统计背包里某道具的总数量（跨格子求和）。"""
    doc = await utils.async_mongo_operation_read(lambda: utils.inventory_col.find_one({
        'user_id': user_id,
        'character_id': character_id,
    }))
    if not doc:
        return 0
    from .bag_handler import merge_inventory_items
    items = merge_inventory_items(doc)
    return sum(int(it.get('quantity', 0) or 0) for it in items
               if int(it.get('item_id', 0) or 0) == int(item_id))


# ---------------------------------------------------------------------------
# 【共享落库入口】技能等级写入 / 技能书扣除 / 回滚
#   背包「使用技能书」与技能面板「升级技能」两条路**共用这三个函数**，
#   保证口径唯一（不会出现「用书能升、点按钮不能升」之类的分歧）。
# ---------------------------------------------------------------------------
async def commit_skill_state(
    user_id,
    pet_object_id: ObjectId,
    levels: Optional[Dict[str, int]] = None,
    skills: Optional[list] = None,
) -> bool:
    """把技能状态写进机甲文档（`SkillLevels` / `Skills`）；返回是否真的写到了文档。

    ⚠ **`$set` 会自动创建不存在的字段** —— 旧玩家数据没有 `Skills` 时，
      学会第一个技能的这次写入就会把它建出来（用户明确要求这样兼容旧数据）。
    """
    sets: Dict[str, Any] = {}
    if levels is not None:
        sets[skill_level_svc.LEVELS_FIELD] = levels
    if skills is not None:
        sets[skills_svc.LEARNED_FIELD] = list(skills)
    if not sets:
        return True
    res = await utils.async_mongo_operation(lambda: utils.robotpet_col.update_one(
        {'_id': pet_object_id, 'user_id': user_id},
        {'$set': sets},
    ))
    return bool(res and int(getattr(res, 'matched_count', 0) or 0) > 0)


async def commit_levels(user_id, pet_object_id: ObjectId, levels: Dict[str, int]) -> bool:
    """只写技能等级表（技能面板「升级」链路用）。"""
    return await commit_skill_state(user_id, pet_object_id, levels=levels)


async def consume_books(user_id, character_id: str, book_id: int, count: int) -> Dict[str, Any]:
    """扣技能书（数量不足会失败，不会扣成负数）。"""
    return await consume_item_from_bag(user_id, character_id, int(book_id), int(count))


async def rollback_skill_state(
    user_id,
    pet_object_id: ObjectId,
    old_levels: Optional[Dict[str, int]] = None,
    old_skills: Optional[list] = None,
) -> None:
    """扣书失败时把技能状态回滚（best-effort，失败只记日志）。

    ⚠ 原本没有 `Skills` 字段（`old_skills` 为空）时用 `$unset` **删掉本次新建的字段**，
      而不是留一个空数组 —— 保持「没学过 = 没这个字段」的原始状态。
    """
    sets: Dict[str, Any] = {}
    unsets: Dict[str, str] = {}
    if old_levels is not None:
        sets[skill_level_svc.LEVELS_FIELD] = old_levels
    if old_skills is not None:
        if len(old_skills) == 0:
            unsets[skills_svc.LEARNED_FIELD] = ""
        else:
            sets[skills_svc.LEARNED_FIELD] = list(old_skills)
    if not sets and not unsets:
        return
    update: Dict[str, Any] = {}
    if sets:
        update['$set'] = sets
    if unsets:
        update['$unset'] = unsets
    try:
        await utils.async_mongo_operation(lambda: utils.robotpet_col.update_one(
            {'_id': pet_object_id, 'user_id': user_id},
            update,
        ))
    except Exception as exc:  # noqa: BLE001
        print(f'⚠️ [技能] 技能状态回滚失败 pet={pet_object_id}: {exc}')


async def rollback_levels(user_id, pet_object_id: ObjectId, old_levels: Dict[str, int]) -> None:
    """只回滚技能等级表。"""
    await rollback_skill_state(user_id, pet_object_id, old_levels=old_levels)


async def apply_skill_book(user_id, character_id: str, pet_id: Any, item_id: Any) -> Dict[str, Any]:
    """【技能书使用的唯一落库入口】对某机甲使用一本技能书（学会 / 升级）。

    规则与出处见 `services/skill_book_service.py`（Z_skill.js + Z_SkillLevel.onSkillUpgrade）。

    顺序铁律：**先写等级 → 再扣书**；扣书失败则回滚等级 ——
    最坏情况是「玩家白得一级」，绝不出现「扣了书没升」（吞玩家道具更不可接受）。

    返回 `{ok, reason, action, skill_key, name, from_level, to_level, levels,
           book_id, books_consumed, books_left}`；`ok=False` 时 `reason` 可直接展示。
    """
    try:
        pet_object_id = ObjectId(str(pet_id))
    except Exception:
        return {'ok': False, 'reason': '无效的机甲ID'}

    pet = await _load_pet(pet_object_id, user_id)
    if not pet:
        return {'ok': False, 'reason': '机甲不存在或不属于该用户'}

    key = skill_book_svc.skill_of_book(item_id)
    if not key:
        return {'ok': False, 'reason': '该物品不是技能书'}

    book_id = int(item_id)
    book_count = await _count_item(user_id, character_id, book_id)

    plan = skill_book_svc.use_book(pet, item_id, book_count)
    if not plan.get('ok'):
        return {'ok': False, 'reason': plan.get('reason') or '无法使用该技能书',
                'skill_key': key, 'action': plan.get('action')}

    old_levels = skill_level_svc.levels_of(pet)
    old_skills = skills_svc.learned_skill_list(pet)
    need_books = int(plan.get('need_books') or 1)

    # ① 先写技能状态（`Skills` + `SkillLevels`）——
    #    `Skills` 不存在时 `$set` 会自动创建，所以旧玩家数据能无缝接入。
    #    写不进去 → 尚未扣书，玩家无损失。
    try:
        wrote = await commit_skill_state(
            user_id, pet_object_id,
            levels=plan['levels'],
            skills=plan.get('skills'),
        )
    except Exception as exc:  # noqa: BLE001
        print(f'❌ [技能书] 写入技能状态失败 pet={pet_id} item={item_id}: {exc}')
        return {'ok': False, 'reason': '技能使用失败，请稍后再试'}
    if not wrote:
        return {'ok': False, 'reason': '机甲不存在或不属于该用户'}

    # ② 再扣书；扣不动就把技能状态（含本次新建的 `Skills` 字段）一并回滚
    consumed = await consume_books(user_id, character_id, book_id, need_books)
    if not consumed.get('success'):
        await rollback_skill_state(user_id, pet_object_id, old_levels, old_skills)
        return {'ok': False, 'reason': consumed.get('error') or '技能书数量不足',
                'skill_key': key, 'action': plan.get('action')}

    utils.invalidate_robot_pets_cache(user_id, character_id)
    action_cn = '学会' if plan.get('action') == 'learn' else '升级'
    print(f'✅ [技能书] 机甲 {pet.get("RobotName", "")} 「{plan.get("name")}」{action_cn}'
          f'（Lv{plan.get("to_level")}），消耗技能书 ×{need_books}')

    return {
        'ok': True,
        'reason': '',
        'action': plan.get('action'),
        'skill_key': plan.get('skill_key'),
        'name': plan.get('name'),
        'from_level': plan.get('from_level'),
        'to_level': plan.get('to_level'),
        'levels': plan.get('levels'),
        'skills': plan.get('skills'),
        'book_id': book_id,
        'books_consumed': need_books,
        'books_left': max(0, book_count - need_books),
        'pet_id': str(pet_id),
        'pet_name': pet.get('RobotName', ''),
    }


# ---------------------------------------------------------------------------
# 手动升级技能
# ---------------------------------------------------------------------------
async def handle_skill_level_up(websocket, data, current_character_id):
    """手动升级技能：消耗技能书 + 达到机甲等级。

    请求：`{token/user_id, character_id, pet_id, skill_key}`
      - `skill_key` 兼容技能名 / 技能书 id（服务端会归一成 key）
    响应：`{success, skill_key, name, from_level, to_level, levels, books_consumed, book_id}`
    """
    route = 'skill_level_up'
    user = utils.get_user_by_id_or_token(user_id=data.get('user_id'), token=data.get('token'))
    if not user:
        await utils.send_error_response(websocket, route, '用户不存在或未登录',
                                        code=401, request_data=data)
        return

    cid = data.get('character_id') or current_character_id
    pet_id = data.get('pet_id')
    skill_ref = (data.get('skill_key') or data.get('skillKey')
                 or data.get('skill') or data.get('skill_id'))

    if not cid:
        await utils.send_error_response(websocket, route, '缺少 character_id',
                                        code=400, request_data=data)
        return
    if not pet_id:
        await utils.send_error_response(websocket, route, '缺少 pet_id',
                                        code=400, request_data=data)
        return

    key = skills_svc.resolve_skill_ref(skill_ref)
    if not key:
        await utils.send_error_response(websocket, route, '技能不存在或无法识别',
                                        code=400, request_data=data,
                                        error_code='SKILL_NOT_FOUND')
        return

    try:
        pet_object_id = ObjectId(str(pet_id))
    except Exception:
        await utils.send_error_response(websocket, route, '无效的机甲ID',
                                        code=400, request_data=data)
        return

    lock = _lock_for(str(pet_id))
    if lock.locked():
        await utils.send_error_response(websocket, route, '该机甲正在升级技能，请稍后再试',
                                        code=429, request_data=data,
                                        error_code='SKILL_LEVEL_BUSY')
        return

    async with lock:
        pet = await _load_pet(pet_object_id, user['_id'])
        if not pet:
            await utils.send_error_response(websocket, route, '机甲不存在或不属于该用户',
                                            code=404, request_data=data)
            return

        skill = skills_svc.get_skill(key) or {}
        book_id = skill.get('book_id')
        if book_id is None:
            await utils.send_error_response(websocket, route, '该技能不支持升级',
                                            code=400, request_data=data,
                                            error_code='SKILL_NO_BOOK')
            return

        book_count = await _count_item(user['_id'], cid, int(book_id))
        chk = skill_level_svc.can_manual_upgrade(pet, key, book_count)
        if not chk['ok']:
            await utils.send_error_response(websocket, route, chk['reason'],
                                            code=400, request_data=data,
                                            error_code='SKILL_LEVEL_DENIED')
            return

        old_levels = skill_level_svc.levels_of(pet)
        new_levels, new_level = skill_level_svc.apply_manual_upgrade(pet, key)

        # 1) 先写等级（写入失败 → 尚未扣书，直接报错返回，玩家无损失）
        try:
            wrote = await commit_levels(user['_id'], pet_object_id, new_levels)
        except Exception as exc:  # noqa: BLE001
            print(f'❌ [技能升级] 写入等级失败 pet={pet_id} key={key}: {exc}')
            await utils.send_error_response(websocket, route, '技能升级失败，请稍后再试',
                                            code=500, request_data=data)
            return
        if not wrote:
            await utils.send_error_response(websocket, route, '机甲不存在或不属于该用户',
                                            code=404, request_data=data)
            return

        # 2) 再扣技能书；扣不动就把等级回滚（宁可白送一级，也不吞玩家道具）
        need_books = int(chk.get('need_books') or 1)
        consumed = await consume_books(user['_id'], cid, int(book_id), need_books)
        if not consumed.get('success'):
            await rollback_levels(user['_id'], pet_object_id, old_levels)
            await utils.send_error_response(
                websocket, route, consumed.get('error') or '技能书不足',
                code=400, request_data=data, error_code='SKILL_BOOK_SHORT')
            return

        utils.invalidate_robot_pets_cache(user['_id'], cid)
        print(f'✅ [技能升级] 机甲 {pet.get("RobotName", "")} 「{skill.get("name")}」 '
              f'Lv{chk["from_level"]} -> Lv{new_level}，消耗技能书 ×{need_books}')

        await utils.send_success_response(
            websocket, route,
            data={
                'pet_id': str(pet_id),
                'skill_key': key,
                'name': skill.get('name'),
                'from_level': chk['from_level'],
                'to_level': new_level,
                'levels': new_levels,
                'book_id': int(book_id),
                'books_consumed': need_books,
                'books_left': max(0, book_count - need_books),
            },
            message='技能升级成功',
            request_data=data,
        )


# ---------------------------------------------------------------------------
# 技能列表（供技能面板接入）
# ---------------------------------------------------------------------------
async def handle_skill_list(websocket, data, current_character_id):
    """列出某机甲当前可主动施放的技能（含等级 / 能量消耗 / 可用性与原因）。

    请求：`{token/user_id, character_id, pet_id, learned_only?}`
    响应：`{success, catalog_version, pet_id, max_level, skills:[...]}`
    """
    route = 'skill_list'
    user = utils.get_user_by_id_or_token(user_id=data.get('user_id'), token=data.get('token'))
    if not user:
        await utils.send_error_response(websocket, route, '用户不存在或未登录',
                                        code=401, request_data=data)
        return

    pet_id = data.get('pet_id')
    if not pet_id:
        await utils.send_error_response(websocket, route, '缺少 pet_id',
                                        code=400, request_data=data)
        return

    try:
        pet_object_id = ObjectId(str(pet_id))
    except Exception:
        await utils.send_error_response(websocket, route, '无效的机甲ID',
                                        code=400, request_data=data)
        return

    pet = await _load_pet(pet_object_id, user['_id'])
    if not pet:
        await utils.send_error_response(websocket, route, '机甲不存在或不属于该用户',
                                        code=404, request_data=data)
        return

    # actor 视图：技能等级 / 已学技能都从 raw（机甲文档）读，与战斗链路同口径
    actor = {
        'mp': int(pet.get('CurrentMP') or 0),
        'max_mp': int(pet.get('MaxMP') or 0),
        'raw': pet,
    }
    # 默认 **只列已学**：机甲初始 / 获得时技能为空（`Skills` 字段都没有），
    # 只有用技能书学会才会出现 —— 所以新机甲的技能面板本来就是空的（预期行为）。
    # 传 `learned_only=False` 可切成「技能图鉴」模式（按职业线列全量）。
    learned_only = data.get('learned_only')
    learned_only = True if learned_only is None else bool(learned_only)
    include_reference = bool(data.get('include_reference') or False)
    class_line = data.get('class_line') or None

    try:
        items = skills_svc.list_castable_skills(
            actor,
            learned_only=learned_only,
            class_line=class_line,
            include_reference=include_reference,
        )
    except Exception as exc:  # noqa: BLE001
        print(f'❌ [技能列表] 生成失败 pet={pet_id}: {exc}')
        await utils.send_error_response(websocket, route, '技能列表生成失败',
                                        code=500, request_data=data)
        return

    meta = skills_svc.catalog_meta()
    await utils.send_success_response(
        websocket, route,
        data={
            'pet_id': str(pet_id),
            'catalog_version': meta.get('version'),
            'max_level': skill_level_svc.level_max(),
            'class_line': (skills_svc.class_line_of(pet)
                           if pet.get('Class') is not None else None),
            'learned_only': learned_only,
            'levels': skill_level_svc.levels_of(pet),
            'skills': items,
        },
        request_data=data,
    )
