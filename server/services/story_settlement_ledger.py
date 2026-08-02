"""
剧情战斗结算账本（MongoDB 权威）+ effect 幂等记录。

唯一键：character_id + event_id + room_id
状态：processing → effects_applied → completed（failed 仅记录错误，不删除重来）

短时内存缓存可选；权威状态源永远是 MongoDB（或测试注入的 FakeCollection）。
普通 PVE/PVP 不创建账本。
"""
from __future__ import annotations

import logging
import time
from typing import Any, Dict, List, Optional, Tuple

from handlers import utils

logger = logging.getLogger("game_server")

STATUS_PROCESSING = "processing"
STATUS_EFFECTS_APPLIED = "effects_applied"
STATUS_COMPLETED = "completed"
STATUS_FAILED = "failed"

# processing 超时后允许恢复（秒）
PROCESSING_TIMEOUT_SECONDS = 90.0

_settlements_col = None
_effects_col = None
# 短时缓存（非权威）
_cache: Dict[Tuple[str, str, str], Dict[str, Any]] = {}


def init_story_settlement_ledger(settlements_col, effects_col=None) -> None:
    global _settlements_col, _effects_col
    _settlements_col = settlements_col
    _effects_col = effects_col if effects_col is not None else settlements_col


def get_settlements_col():
    return _settlements_col


def get_effects_col():
    return _effects_col


def clear_settlement_cache_for_tests() -> None:
    """仅清内存缓存；不删 Mongo/Fake 中的权威文档。"""
    _cache.clear()


def reset_ledger_cols_for_tests(settlements_col=None, effects_col=None) -> None:
    """测试用：切换集合并清空缓存（模拟新 Service 实例读同一库）。"""
    global _settlements_col, _effects_col
    _settlements_col = settlements_col
    _effects_col = effects_col if effects_col is not None else settlements_col
    _cache.clear()


def settlement_key(character_id: str, event_id: str, room_id: str) -> Tuple[str, str, str]:
    return (str(character_id), str(event_id), str(room_id))


def make_effect_key(character_id: str, event_id: str, room_id: str, effect_index: int) -> str:
    return f"story:{character_id}:{event_id}:{room_id}:{int(effect_index)}"


def _now() -> float:
    return time.time()


def _strip_id(doc: Optional[dict]) -> Optional[dict]:
    if not doc:
        return None
    out = dict(doc)
    out.pop("_id", None)
    return out


def _cache_put(doc: dict) -> None:
    key = settlement_key(doc["character_id"], doc["event_id"], doc["room_id"])
    _cache[key] = dict(doc)


def _cache_get(character_id: str, event_id: str, room_id: str) -> Optional[dict]:
    return _cache.get(settlement_key(character_id, event_id, room_id))


def _require_col():
    if _settlements_col is None:
        raise RuntimeError("story_settlement_ledger 未 init（缺少 story_battle_settlements 集合）")


async def find_settlement(character_id: str, event_id: str, room_id: str) -> Optional[Dict[str, Any]]:
    """从权威源读取结算账本。"""
    key = settlement_key(character_id, event_id, room_id)
    if _settlements_col is None:
        return _cache_get(character_id, event_id, room_id)
    doc = await utils.async_mongo_operation(
        lambda: _settlements_col.find_one(
            {
                "character_id": str(character_id),
                "event_id": str(event_id),
                "room_id": str(room_id),
            }
        ),
        timeout=3.0,
    )
    cleaned = _strip_id(doc)
    if cleaned:
        _cache_put(cleaned)
    else:
        _cache.pop(key, None)
    return cleaned


async def claim_or_get_settlement(
    *,
    character_id: str,
    event_id: str,
    room_id: str,
    map_code: str = "",
    request_id: Optional[str] = None,
    trace_id: Optional[str] = None,
) -> Tuple[Dict[str, Any], str]:
    """
    原子创建或读取结算账本。

    返回 (doc, action)：
      - replay_completed
      - resume_effects_applied
      - resume_processing
      - processing_in_flight（未超时，他方处理中）
      - claimed（本调用抢占为 processing）
    """
    _require_col()
    cid, eid, rid = str(character_id), str(event_id), str(room_id)
    now = _now()

    existing = await find_settlement(cid, eid, rid)
    if existing:
        status = existing.get("status")
        if status == STATUS_COMPLETED:
            return existing, "replay_completed"
        if status == STATUS_EFFECTS_APPLIED:
            if request_id and not existing.get("request_id"):
                existing = await _patch_settlement(cid, eid, rid, {"request_id": request_id})
            return existing, "resume_effects_applied"
        if status == STATUS_PROCESSING:
            updated_at = float(existing.get("updated_at") or existing.get("created_at") or 0)
            if now - updated_at < PROCESSING_TIMEOUT_SECONDS:
                return existing, "processing_in_flight"
            # 超时：允许恢复，刷新 updated_at / request_id
            patched = await _patch_settlement(
                cid,
                eid,
                rid,
                {
                    "updated_at": now,
                    "request_id": request_id or existing.get("request_id"),
                    "trace_id": trace_id or existing.get("trace_id"),
                    "error": None,
                },
            )
            logger.info(
                "settlement reclaim after processing timeout | cid=%s event=%s room=%s trace=%s",
                cid,
                eid,
                rid,
                trace_id,
            )
            return patched or existing, "resume_processing"
        if status == STATUS_FAILED:
            # 不得删除；允许从失败恢复为 processing 继续
            patched = await _patch_settlement(
                cid,
                eid,
                rid,
                {
                    "status": STATUS_PROCESSING,
                    "updated_at": now,
                    "request_id": request_id or existing.get("request_id"),
                    "trace_id": trace_id or existing.get("trace_id"),
                    "error": None,
                },
            )
            return patched or existing, "resume_processing"

    # 原子 upsert：仅当不存在时插入 processing
    base = {
        "character_id": cid,
        "event_id": eid,
        "room_id": rid,
        "map_code": str(map_code or ""),
        "request_id": request_id,
        "trace_id": trace_id,
        "status": STATUS_PROCESSING,
        "applied_effects": [],
        "error": None,
        "created_at": now,
        "updated_at": now,
        "completed_at": None,
    }

    def _upsert():
        # 先尝试 insert；若唯一冲突则读回
        try:
            _settlements_col.insert_one(dict(base))
            return dict(base), "claimed"
        except Exception as exc:
            # DuplicateKey
            name = type(exc).__name__
            if "Duplicate" not in name and "duplicate" not in str(exc).lower():
                # 某些 FakeCollection 用自定义异常
                if getattr(exc, "code", None) not in (11000,):
                    raise
            doc = _settlements_col.find_one(
                {"character_id": cid, "event_id": eid, "room_id": rid}
            )
            if not doc:
                raise
            return _strip_id(doc), "race_read"

    doc, action = await utils.async_mongo_operation(_upsert, timeout=3.0)
    assert doc is not None
    if action == "claimed":
        _cache_put(doc)
        logger.info(
            "settlement claimed | cid=%s event=%s room=%s req=%s trace=%s",
            cid,
            eid,
            rid,
            request_id,
            trace_id,
        )
        return doc, "claimed"

    # 竞态读回后按已有状态分支
    status = doc.get("status")
    if status == STATUS_COMPLETED:
        _cache_put(doc)
        return doc, "replay_completed"
    if status == STATUS_EFFECTS_APPLIED:
        _cache_put(doc)
        return doc, "resume_effects_applied"
    if status == STATUS_PROCESSING:
        updated_at = float(doc.get("updated_at") or doc.get("created_at") or 0)
        if _now() - updated_at < PROCESSING_TIMEOUT_SECONDS:
            _cache_put(doc)
            return doc, "processing_in_flight"
        patched = await _patch_settlement(
            cid, eid, rid, {"updated_at": _now(), "request_id": request_id or doc.get("request_id")}
        )
        return patched or doc, "resume_processing"
    _cache_put(doc)
    return doc, "resume_processing"


async def _patch_settlement(
    character_id: str,
    event_id: str,
    room_id: str,
    fields: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    _require_col()
    now = _now()
    update = {**fields, "updated_at": fields.get("updated_at", now)}

    def _op():
        _settlements_col.update_one(
            {
                "character_id": str(character_id),
                "event_id": str(event_id),
                "room_id": str(room_id),
            },
            {"$set": update},
        )
        return _settlements_col.find_one(
            {
                "character_id": str(character_id),
                "event_id": str(event_id),
                "room_id": str(room_id),
            }
        )

    doc = await utils.async_mongo_operation(_op, timeout=3.0)
    cleaned = _strip_id(doc)
    if cleaned:
        _cache_put(cleaned)
    return cleaned


async def mark_effects_applied(
    character_id: str,
    event_id: str,
    room_id: str,
    applied_effects: List[dict],
) -> Optional[Dict[str, Any]]:
    return await _patch_settlement(
        character_id,
        event_id,
        room_id,
        {
            "status": STATUS_EFFECTS_APPLIED,
            "applied_effects": list(applied_effects or []),
            "error": None,
        },
    )


async def mark_completed(
    character_id: str,
    event_id: str,
    room_id: str,
    applied_effects: Optional[List[dict]] = None,
) -> Optional[Dict[str, Any]]:
    fields: Dict[str, Any] = {
        "status": STATUS_COMPLETED,
        "completed_at": _now(),
        "error": None,
    }
    if applied_effects is not None:
        fields["applied_effects"] = list(applied_effects)
    return await _patch_settlement(character_id, event_id, room_id, fields)


async def mark_failed(
    character_id: str,
    event_id: str,
    room_id: str,
    error: str,
) -> Optional[Dict[str, Any]]:
    """记录失败；不删除账本。"""
    return await _patch_settlement(
        character_id,
        event_id,
        room_id,
        {"status": STATUS_FAILED, "error": str(error)[:500]},
    )


async def get_effect_record(effect_key: str) -> Optional[Dict[str, Any]]:
    col = _effects_col
    if col is None:
        return None
    doc = await utils.async_mongo_operation(
        lambda: col.find_one({"effect_key": str(effect_key)}),
        timeout=2.0,
    )
    return _strip_id(doc)


async def save_effect_record(
    effect_key: str,
    *,
    character_id: str,
    event_id: str,
    room_id: str,
    effect_index: int,
    result: dict,
) -> None:
    """effect 成功后立即持久化执行记录。"""
    col = _effects_col
    if col is None:
        raise RuntimeError("story effect idempotency 集合未初始化")
    now = _now()
    doc = {
        "effect_key": str(effect_key),
        "character_id": str(character_id),
        "event_id": str(event_id),
        "room_id": str(room_id),
        "effect_index": int(effect_index),
        "result": dict(result or {}),
        "created_at": now,
        "updated_at": now,
    }

    def _op():
        try:
            col.insert_one(doc)
        except Exception as exc:
            name = type(exc).__name__
            if "Duplicate" in name or "duplicate" in str(exc).lower() or getattr(exc, "code", None) == 11000:
                # 已存在：保留首次结果
                return
            raise

    await utils.async_mongo_operation(_op, timeout=2.0)
    logger.info(
        "effect persisted | key=%s action=%s cid=%s event=%s room=%s",
        effect_key,
        (result or {}).get("action"),
        character_id,
        event_id,
        room_id,
    )


async def list_applied_effects_for_settlement(
    character_id: str,
    event_id: str,
    room_id: str,
) -> List[dict]:
    """按 effect_index 排序汇总已执行 effect 结果。"""
    col = _effects_col
    if col is None:
        return []
    prefix = f"story:{character_id}:{event_id}:{room_id}:"

    def _op():
        cursor = col.find(
            {
                "character_id": str(character_id),
                "event_id": str(event_id),
                "room_id": str(room_id),
            }
        )
        rows = list(cursor)
        rows.sort(key=lambda r: int(r.get("effect_index", 0)))
        return rows

    rows = await utils.async_mongo_operation(_op, timeout=3.0)
    out = []
    for r in rows or []:
        res = r.get("result")
        if isinstance(res, dict):
            out.append(res)
    return out
