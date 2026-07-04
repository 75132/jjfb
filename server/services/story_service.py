"""
剧情/任务服务 - 服务端权威进度与事件校验
"""
from __future__ import annotations

import json
import os
import datetime
from typing import Any, Dict, List, Optional, Tuple

from bson import ObjectId

from handlers import utils

_story_progress_col = None
_map_cache: Dict[str, dict] = {}
_battle_refs_cache: Optional[dict] = None
# 剧情进度持久化（默认写 Mongo；仅 STORY_LOCAL_TEST=1 时仅存内存，重启即丢）
STORY_LOCAL_TEST = os.getenv("STORY_LOCAL_TEST", "0").strip().lower() in ("1", "true", "yes", "on")
# 选角时是否清空剧情（调剧本时用 STORY_RESET_ON_SELECT=1；默认保留进度）
STORY_RESET_ON_SELECT = os.getenv("STORY_RESET_ON_SELECT", "0").strip().lower() in ("1", "true", "yes", "on")
_local_progress: Dict[str, dict] = {}


def _progress_key(character_id: str, map_code: str) -> str:
    return f"{character_id}:{map_code}"


def clear_story_progress_for_character(character_id: str, map_code: Optional[str] = None) -> None:
    """清除角色剧情进度（本地缓存；非本地模式时删 Mongo）。"""
    if not character_id:
        return
    if STORY_LOCAL_TEST:
        if map_code:
            _local_progress.pop(_progress_key(character_id, map_code), None)
        else:
            prefix = f"{character_id}:"
            for key in list(_local_progress.keys()):
                if key.startswith(prefix):
                    _local_progress.pop(key, None)
        return
    if _story_progress_col is None:
        return
    filt: dict = {"character_id": character_id}
    if map_code:
        filt["map_code"] = map_code
    utils.safe_mongo_operation(lambda: _story_progress_col.delete_many(filt))


def init_story_service(story_progress_col) -> None:
    global _story_progress_col
    _story_progress_col = story_progress_col


def _data_dir() -> str:
    return os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")


def load_battle_refs() -> dict:
    global _battle_refs_cache
    if _battle_refs_cache is not None:
        return _battle_refs_cache
    path = os.path.join(_data_dir(), "battle_refs.json")
    with open(path, "r", encoding="utf-8") as f:
        _battle_refs_cache = json.load(f)
    return _battle_refs_cache


def load_map_config(map_code: str) -> Optional[dict]:
    story_dir = os.path.join(_data_dir(), "story_maps")
    if not os.path.isdir(story_dir):
        return None
    for fname in os.listdir(story_dir):
        if not fname.endswith(".json"):
            continue
        path = os.path.join(story_dir, fname)
        with open(path, "r", encoding="utf-8") as f:
            cfg = json.load(f)
        code = cfg.get("mapCode") or cfg.get("map_code")
        if code == map_code:
            cached = _map_cache.get(map_code)
            if cached and cached.get("configVersion") == cfg.get("configVersion"):
                return cached
            _map_cache[map_code] = cfg
            return cfg
    return None


def _default_progress(character_id: str, user_id: ObjectId, map_code: str, story_version: str) -> dict:
    return {
        "character_id": character_id,
        "user_id": user_id,
        "map_code": map_code,
        "completed_event_ids": [],
        "active_tasks": [],
        "completed_task_ids": [],
        "mainline_step": 0,
        "story_version": story_version,
        "pending_battle": None,
        "revealed_npc_uids": [],
        "spawned_npc_uids": [],
        "dynamic_npcs": [],
        "updated_at": datetime.datetime.utcnow(),
    }


async def get_or_create_progress(user_id: ObjectId, character_id: str, map_code: str) -> dict:
    if STORY_LOCAL_TEST:
        key = _progress_key(character_id, map_code)
        cached = _local_progress.get(key)
        if cached:
            return cached
        cfg = load_map_config(map_code) or {}
        version = str(cfg.get("configVersion", "1.0.0"))
        progress = _default_progress(character_id, user_id, map_code, version)
        _local_progress[key] = progress
        return progress
    if _story_progress_col is None:
        raise RuntimeError("story_progress_col not initialized")
    doc = await utils.async_mongo_operation(
        lambda: _story_progress_col.find_one({"character_id": character_id, "map_code": map_code}),
        timeout=2.0,
    )
    if doc:
        return doc
    cfg = load_map_config(map_code) or {}
    version = str(cfg.get("configVersion", "1.0.0"))
    progress = _default_progress(character_id, user_id, map_code, version)
    await utils.async_mongo_operation(
        lambda: _story_progress_col.insert_one(progress),
        timeout=2.0,
    )
    return progress


def _find_event(map_cfg: dict, event_id: str) -> Optional[Tuple[dict, dict, str]]:
    for npc in map_cfg.get("npcs", []) or []:
        npc_uid = npc.get("npcUid", "")
        for ev in npc.get("events", []) or []:
            if ev.get("eventId") == event_id:
                return npc, ev, npc_uid
    return None


def _task_defs(map_cfg: dict) -> Dict[int, dict]:
    out: Dict[int, dict] = {}
    raw_tasks = map_cfg.get("tasks") or map_cfg.get("quests") or []
    for t in raw_tasks or []:
        tid = t.get("taskId")
        if tid is not None:
            out[int(tid)] = t
    return out


def _get_choice_script(map_cfg: dict, script_id: Optional[str]) -> Optional[dict]:
    if not script_id:
        return None
    client = map_cfg.get("client") or {}
    scripts = client.get("choiceScripts") or {}
    return scripts.get(script_id)


def _choice_completes_event(map_cfg: dict, ev: dict, choice_id: Optional[str]) -> Tuple[bool, str]:
    if not choice_id:
        return True, ""
    server = ev.get("server") or {}
    allowed = server.get("allowedChoiceIds")
    if allowed and choice_id not in allowed:
        return False, "该选项无法推进此事件"
    client = ev.get("client") or {}
    script = _get_choice_script(map_cfg, client.get("choiceScriptId"))
    if not script:
        return True, ""
    for opt in script.get("options") or []:
        if opt.get("id") != choice_id:
            continue
        if opt.get("completesEvent") is False:
            return False, ""
        forced = opt.get("forcedResult")
        if forced in ("block", "none"):
            return False, ""
        return True, ""
    return True, ""


async def _apply_teleport(user_id: ObjectId, character_id: str, eff: dict) -> dict:
    to_map = int(eff.get("toMapId", eff.get("to_map_id", 0)) or 0)
    to_x = float(eff.get("toX", eff.get("to_x", 0)) or 0)
    to_y = float(eff.get("toY", eff.get("to_y", 0)) or 0)
    pos = {
        "map_id": to_map,
        "x": to_x,
        "y": to_y,
        "updated_at": datetime.datetime.utcnow(),
    }
    await utils.async_mongo_operation(
        lambda: utils.players_col.update_one(
            {"user_id": user_id, "character_id": character_id},
            {"$set": {"position": pos}},
        ),
        timeout=2.0,
    )
    return {"action": "teleport", "toMapId": to_map, "toX": to_x, "toY": to_y}


def _event_completed(progress: dict, event_id: str) -> bool:
    return event_id in (progress.get("completed_event_ids") or [])


def _task_status(progress: dict, task_id: int) -> Optional[str]:
    if task_id in (progress.get("completed_task_ids") or []):
        return "completed"
    for t in progress.get("active_tasks") or []:
        if int(t.get("taskId", -1)) == task_id:
            return t.get("status", "accepted")
    return None


async def _player_level(user_id: ObjectId, character_id: str) -> int:
    player = await utils.async_mongo_operation(
        lambda: utils.players_col.find_one({"user_id": user_id, "character_id": character_id}),
        timeout=2.0,
    )
    if not player:
        return 1
    return int(player.get("level", 1) or 1)


async def _player_has_item(user_id: ObjectId, character_id: str, item_id: int) -> bool:
    inv = await utils.async_mongo_operation(
        lambda: utils.inventory_col.find_one({"user_id": user_id, "character_id": character_id}),
        timeout=2.0,
    )
    if not inv:
        return False
    for slot in inv.get("slots", []) or []:
        if int(slot.get("item_id", 0) or 0) == item_id and int(slot.get("count", 0) or 0) > 0:
            return True
    return False


async def check_requirements(
    user_id: ObjectId,
    character_id: str,
    progress: dict,
    requirements: List[dict],
) -> Tuple[bool, str]:
    for req in requirements or []:
        if not isinstance(req, dict):
            continue
        rtype = req.get("type") or req.get("action")
        if rtype in ("event_done", "event_completed"):
            eid = req.get("eventId")
            if eid and not _event_completed(progress, eid):
                return False, f"需先完成事件 {eid}"
        elif rtype in ("task_completed", "task_done"):
            tid = int(req.get("taskId", 0))
            if _task_status(progress, tid) != "completed":
                return False, f"需先完成任务 {tid}"
        elif rtype in ("task_active", "task_accepted"):
            tid = int(req.get("taskId", 0))
            st = _task_status(progress, tid)
            if st not in ("accepted", "completed"):
                return False, f"需先接取任务 {tid}"
        elif rtype == "level":
            need = int(req.get("value", req.get("min", 1)))
            lvl = await _player_level(user_id, character_id)
            if lvl < need:
                return False, f"需要等级 {need}"
        elif rtype == "item_owned":
            iid = int(req.get("itemId", 0))
            if not await _player_has_item(user_id, character_id, iid):
                return False, f"需要物品 {iid}"
        elif rtype == "mainline_step":
            need = int(req.get("value", 0))
            if int(progress.get("mainline_step", 0) or 0) < need:
                return False, "主线进度不足"
    return True, ""


def _find_npc_row(map_cfg: dict, npc_uid: str) -> Optional[dict]:
    for npc in map_cfg.get("npcs", []) or []:
        if str(npc.get("npcUid", "")) == npc_uid:
            return npc
    return None


async def apply_effects(
    user_id: ObjectId,
    character_id: str,
    progress: dict,
    map_cfg: dict,
    effects: List[dict],
    choice_id: Optional[str] = None,
) -> List[dict]:
    applied: List[dict] = []
    task_defs = _task_defs(map_cfg)
    for eff in effects or []:
        if not isinstance(eff, dict):
            continue
        eff_choice = eff.get("choiceId")
        if eff_choice and eff_choice != choice_id:
            continue
        action = eff.get("action")
        if action == "task_accept":
            tid = int(eff.get("taskId", 0))
            if tid <= 0:
                continue
            st = _task_status(progress, tid)
            if st is None or st == "completed":
                completed = list(progress.get("completed_task_ids") or [])
                if tid in completed:
                    progress["completed_task_ids"] = [x for x in completed if int(x) != tid]
                active = [t for t in (progress.get("active_tasks") or []) if int(t.get("taskId", -1)) != tid]
                active.append({"taskId": tid, "status": "accepted"})
                progress["active_tasks"] = active
                tdef = task_defs.get(tid, {})
                step = int(tdef.get("mainlineStep", 0) or 0)
                if step > int(progress.get("mainline_step", 0) or 0):
                    progress["mainline_step"] = step
                applied.append({"action": "task_accept", "taskId": tid})
        elif action == "task_complete":
            tid = int(eff.get("taskId", 0))
            active = progress.get("active_tasks") or []
            progress["active_tasks"] = [t for t in active if int(t.get("taskId", -1)) != tid]
            completed = progress.get("completed_task_ids") or []
            if tid not in completed:
                completed.append(tid)
            progress["completed_task_ids"] = completed
            applied.append({"action": "task_complete", "taskId": tid})
        elif action == "give_item":
            from handlers import bag_handler

            iid = int(eff.get("itemId", 0))
            count = int(eff.get("count", 1))
            if iid > 0:
                await bag_handler.add_item_to_bag(user_id, character_id, iid, count)
                applied.append({"action": "give_item", "itemId": iid, "count": count})
        elif action == "add_exp":
            exp_val = int(eff.get("value", eff.get("exp", 0)))
            if exp_val > 0:
                from handlers import item_exp_handler

                await item_exp_handler.add_exp_to_character(user_id, character_id, exp_val)
                applied.append({"action": "add_exp", "value": exp_val})
        elif action == "send_mail":
            from services import mail_service

            await mail_service.send_mail(
                user_id,
                character_id,
                title=str(eff.get("title", "系统邮件")),
                body=str(eff.get("body", "")),
                attachments=eff.get("attachments") or [],
            )
            applied.append({"action": "send_mail"})
        elif action == "teleport":
            tp = await _apply_teleport(user_id, character_id, eff)
            applied.append(tp)
        elif action == "reveal_npc":
            uid = str(eff.get("npcUid", "")).strip()
            if not uid:
                continue
            row = _find_npc_row(map_cfg, uid)
            if not row:
                continue
            revealed = list(progress.get("revealed_npc_uids") or [])
            if uid not in revealed:
                revealed.append(uid)
            progress["revealed_npc_uids"] = revealed
            applied.append({"action": "reveal_npc", "npcUid": uid})
        elif action == "spawn_npc":
            uid = str(eff.get("npcUid", "")).strip()
            if not uid:
                continue
            spawned = list(progress.get("spawned_npc_uids") or [])
            if uid in spawned:
                applied.append({"action": "spawn_npc", "npcUid": uid, "already_spawned": True})
                continue
            existing = _find_npc_row(map_cfg, uid)
            if existing and not existing.get("initialHidden"):
                continue
            x = eff.get("x")
            y = eff.get("y")
            if x is not None and y is not None:
                try:
                    x_f, y_f = float(x), float(y)
                    if x_f < 0 or y_f < 0:
                        continue
                except (TypeError, ValueError):
                    continue
            spawned.append(uid)
            progress["spawned_npc_uids"] = spawned
            dyn = {
                "npcUid": uid,
                "npcName": eff.get("npcName") or existing.get("npcName") if existing else eff.get("npcName"),
                "prefabKey": eff.get("prefabKey") or (existing.get("prefabKey") if existing else None),
                "x": eff.get("x") if eff.get("x") is not None else (existing.get("x") if existing else None),
                "y": eff.get("y") if eff.get("y") is not None else (existing.get("y") if existing else None),
            }
            dynamic = list(progress.get("dynamic_npcs") or [])
            if not any(str(d.get("npcUid", "")) == uid for d in dynamic):
                dynamic.append(dyn)
            progress["dynamic_npcs"] = dynamic
            applied.append({"action": "spawn_npc", "npcUid": uid, **{k: v for k, v in dyn.items() if v is not None}})
    return applied


async def save_progress(progress: dict) -> None:
    progress["updated_at"] = datetime.datetime.utcnow()
    cid = progress.get("character_id")
    map_code = progress.get("map_code")
    if STORY_LOCAL_TEST:
        if cid and map_code:
            _local_progress[_progress_key(str(cid), str(map_code))] = progress
        return
    await utils.async_mongo_operation(
        lambda: _story_progress_col.update_one(
            {"character_id": cid, "map_code": map_code},
            {"$set": {k: v for k, v in progress.items() if k != "_id"}},
            upsert=True,
        ),
        timeout=2.0,
    )


def build_state_payload(progress: dict, map_cfg: dict) -> dict:
    tasks_out = []
    task_defs = _task_defs(map_cfg)
    for tid, tdef in sorted(task_defs.items()):
        st = _task_status(progress, tid)
        if st:
            tasks_out.append(
                {
                    "taskId": tid,
                    "taskName": tdef.get("taskName", ""),
                    "mainlineStep": tdef.get("mainlineStep", 0),
                    "status": st,
                }
            )
    return {
        "map_code": progress.get("map_code"),
        "completed_event_ids": list(progress.get("completed_event_ids") or []),
        "active_tasks": progress.get("active_tasks") or [],
        "completed_task_ids": progress.get("completed_task_ids") or [],
        "mainline_step": int(progress.get("mainline_step", 0) or 0),
        "story_version": progress.get("story_version"),
        "tasks": tasks_out,
        "pending_battle": progress.get("pending_battle"),
        "revealed_npc_uids": list(progress.get("revealed_npc_uids") or []),
        "spawned_npc_uids": list(progress.get("spawned_npc_uids") or []),
        "dynamic_npcs": list(progress.get("dynamic_npcs") or []),
    }


async def interact(
    user_id: ObjectId,
    character_id: str,
    map_code: str,
    event_id: str,
    choice_id: Optional[str] = None,
) -> Tuple[bool, str, dict]:
    map_cfg = load_map_config(map_code)
    if not map_cfg:
        return False, f"未知地图 {map_code}", {}
    found = _find_event(map_cfg, event_id)
    if not found:
        return False, f"未知事件 {event_id}", {}
    _npc, ev, npc_uid = found

    progress = await get_or_create_progress(user_id, character_id, map_code)
    if _event_completed(progress, event_id):
        return False, "事件已完成", {}

    server = ev.get("server") or {}
    ok, msg = await check_requirements(user_id, character_id, progress, server.get("requirements") or [])
    if not ok:
        return False, msg, {}

    event_type = ev.get("eventType", "")
    client = ev.get("client") or {}
    payload: dict = {
        "event_id": event_id,
        "npc_uid": npc_uid,
        "event_type": event_type,
        "allowed": True,
    }

    if event_type == "battle":
        battle_ref = server.get("battleRef")
        if not battle_ref:
            return False, "战斗事件缺少 battleRef", {}
        progress["pending_battle"] = {
            "event_id": event_id,
            "battle_ref": battle_ref,
            "npc_uid": npc_uid,
        }
        await save_progress(progress)
        payload["action"] = "battle"
        payload["battle_ref"] = battle_ref
        if client.get("choiceScriptId"):
            payload["action"] = "choice_then_battle"
            payload["choice_script_id"] = client.get("choiceScriptId")
        return True, "", payload

    if event_type == "choice" or client.get("choiceScriptId"):
        if choice_id:
            payload["action"] = "choice_submitted"
            payload["choice_id"] = choice_id
        else:
            payload["action"] = "choice"
            payload["choice_script_id"] = client.get("choiceScriptId")
        return True, "", payload

    if event_type == "dialog":
        payload["action"] = "dialog"
        payload["dialogue_script_id"] = client.get("dialogueScriptId")
        return True, "", payload

    if event_type == "task":
        payload["action"] = "task"
        return True, "", payload

    payload["action"] = event_type or "unknown"
    return True, "", payload


async def complete_event(
    user_id: ObjectId,
    character_id: str,
    map_code: str,
    event_id: str,
    battle_won: bool = True,
    choice_id: Optional[str] = None,
) -> Tuple[bool, str, dict]:
    map_cfg = load_map_config(map_code)
    if not map_cfg:
        return False, f"未知地图 {map_code}", {}
    found = _find_event(map_cfg, event_id)
    if not found:
        return False, f"未知事件 {event_id}", {}
    _npc, ev, npc_uid = found
    progress = await get_or_create_progress(user_id, character_id, map_code)

    if _event_completed(progress, event_id):
        return True, "already_completed", build_state_payload(progress, map_cfg)

    event_type = ev.get("eventType", "")
    server = ev.get("server") or {}

    if event_type == "battle":
        if not battle_won:
            progress["pending_battle"] = None
            await save_progress(progress)
            return False, "战斗失败", build_state_payload(progress, map_cfg)
        pending = progress.get("pending_battle") or {}
        if pending.get("event_id") != event_id:
            return False, "请先通过 story_interact 发起战斗", build_state_payload(progress, map_cfg)

    ok, msg = await check_requirements(user_id, character_id, progress, server.get("requirements") or [])
    if not ok:
        return False, msg, build_state_payload(progress, map_cfg)

    can_complete, choice_msg = _choice_completes_event(map_cfg, ev, choice_id)
    if not can_complete:
        if choice_msg:
            return False, choice_msg, build_state_payload(progress, map_cfg)
        return True, "choice_blocked", build_state_payload(progress, map_cfg)

    completed = progress.get("completed_event_ids") or []
    if event_id not in completed:
        completed.append(event_id)
    progress["completed_event_ids"] = completed
    progress["pending_battle"] = None

    applied = await apply_effects(
        user_id, character_id, progress, map_cfg, server.get("effects") or [], choice_id=choice_id
    )
    await save_progress(progress)

    return True, "", {
        **build_state_payload(progress, map_cfg),
        "applied_effects": applied,
        "npc_uid": npc_uid,
        "choice_id": choice_id,
    }


def get_battle_ref_config(battle_ref: str) -> Optional[dict]:
    refs = load_battle_refs()
    return refs.get(battle_ref)


async def reset_progress(character_id: str, map_code: str) -> bool:
    if STORY_LOCAL_TEST:
        key = _progress_key(character_id, map_code)
        existed = key in _local_progress
        _local_progress.pop(key, None)
        return existed
    if _story_progress_col is None:
        return False
    r = await utils.async_mongo_operation(
        lambda: _story_progress_col.delete_one({"character_id": character_id, "map_code": map_code}),
        timeout=2.0,
    )
    return r.deleted_count > 0
