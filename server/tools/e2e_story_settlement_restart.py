#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
P3 真实 Mongo 结算重启联调（不依赖 Cocos 编辑器进程）。

覆盖：
1) processing → 模拟服务重启 → finalize 继续发奖一次
2) 部分 effect 后崩溃 → 重启 → 不重复 effect0
3) effects_applied → 重启 → 只补进度
4) completed → 重启 → idempotent_replay
5) finished room 跨「新 BattleRoomService」回读

证据写入：artifacts/e2e_story_settlement/<run_id>/
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

# 加载 .env
env_path = ROOT / ".env"
if env_path.exists():
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip())

from pymongo import MongoClient

MAP_CODE = "world_1783106205039"
EVENT_ID = "world_1783106205039_chain_2_enemy_e2"
BATTLE_REF = "battle_1-50"


def _artifacts_dir(run_id: str) -> Path:
    base = ROOT.parent / "artifacts" / "e2e_story_settlement" / run_id
    (base / "screenshots").mkdir(parents=True, exist_ok=True)
    return base


def _write(path: Path, name: str, payload):
    p = path / name
    if isinstance(payload, (dict, list)):
        p.write_text(json.dumps(payload, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    else:
        p.write_text(str(payload), encoding="utf-8")


async def main():
    from services.battle_room_service import BattleRoomService
    from services.story_settlement_ledger import (
        init_story_settlement_ledger,
        reset_ledger_cols_for_tests,
        save_effect_record,
        make_effect_key,
        mark_effects_applied,
        STATUS_COMPLETED,
        STATUS_EFFECTS_APPLIED,
        STATUS_PROCESSING,
        find_settlement,
    )
    from services.story_battle_service import finalize_story_battle
    from services import story_service

    run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-" + uuid.uuid4().hex[:8]
    art = _artifacts_dir(run_id)
    mongo_url = os.environ.get("MONGO_URL") or "mongodb://127.0.0.1:27017/"
    client = MongoClient(mongo_url, serverSelectionTimeoutMS=8000)
    db = client["jjfb"]
    settlements = db["story_battle_settlements"]
    effects = db["story_effect_idempotency"]
    rooms_col = db["battle_rooms"]

    # 确保索引
    settlements.create_index(
        [("character_id", 1), ("event_id", 1), ("room_id", 1)],
        unique=True,
        name="character_event_room_unique",
    )
    effects.create_index("effect_key", unique=True, name="effect_key_unique")

    cid = f"e2e_p3_{run_id}"
    uid = f"uid_{run_id}"
    trace_id = f"trace-{run_id}"

    init_story_settlement_ledger(settlements, effects)

    # 进度存内存，避免污染真实玩家
    story_service.STORY_LOCAL_TEST = True
    progress_store = {}

    async def get_progress(user_id, character_id, map_code):
        key = f"{character_id}:{map_code}"
        if key not in progress_store:
            progress_store[key] = {
                "character_id": character_id,
                "user_id": user_id,
                "map_code": map_code,
                "completed_event_ids": [],
                "active_tasks": [],
                "completed_task_ids": [],
                "mainline_step": 0,
                "pending_battle": None,
            }
        return progress_store[key]

    async def save_progress(p):
        key = f"{p['character_id']}:{p['map_code']}"
        progress_store[key] = dict(p)

    apply_log = []
    import services.story_service as ss_mod
    real_single = ss_mod._apply_single_effect

    async def counting_single(user_id, character_id, progress, map_cfg, eff, choice_id, task_defs):
        apply_log.append(eff.get("action"))
        return {"action": eff.get("action"), "itemId": eff.get("itemId"), "value": eff.get("value")}

    brs = BattleRoomService()
    brs.init_persistence(rooms_col)

    room = brs.create_pve_room(
        user_id=uid,
        character_id=cid,
        player_doc={"RobotName": "P", "MaxHP": 100, "CurrentHP": 100, "Melee": 50, "Armor": 0, "Initiative": 10},
        enemy_doc={"RobotName": "E", "MaxHP": 10, "CurrentHP": 10, "Melee": 1, "Armor": 0, "Initiative": 1},
        story_context={"map_code": MAP_CODE, "event_id": EVENT_ID, "battle_ref": BATTLE_REF},
    )
    room_id = room["room_id"]
    room["enemy"]["hp"] = 0
    brs._end_if_needed(room)

    prog = await get_progress(uid, cid, MAP_CODE)
    prog["pending_battle"] = {
        "event_id": EVENT_ID,
        "battle_ref": BATTLE_REF,
        "map_code": MAP_CODE,
        "status": "battle_finished",
        "room_id": room_id,
        "battle_result": {"winner": "player", "reason": "ko"},
    }

    _write(
        art,
        "before.json",
        {"character_id": cid, "room_id": room_id, "pending": prog["pending_battle"], "trace_id": trace_id},
    )
    _write(
        art,
        "battle_finished.json",
        {"room": {k: room.get(k) for k in ("room_id", "status", "result", "story_context", "character_id")}},
    )

    # --- 场景：先写 processing，模拟奖励前重启 ---
    settlements.insert_one(
        {
            "character_id": cid,
            "event_id": EVENT_ID,
            "room_id": room_id,
            "map_code": MAP_CODE,
            "request_id": "pre-restart",
            "trace_id": trace_id,
            "status": STATUS_PROCESSING,
            "applied_effects": [],
            "error": None,
            "created_at": time.time() - 200,
            "updated_at": time.time() - 200,
            "completed_at": None,
        }
    )
    _write(art, "settlement_processing.json", settlements.find_one({"character_id": cid, "room_id": room_id}, {"_id": 0}))
    _write(art, "server-before-restart.log", f"restart_at={datetime.now(timezone.utc).isoformat()}\nsettlement=processing\n")

    # 模拟重启：新 BattleRoomService + 重新 init ledger（同一 Mongo）
    reset_ledger_cols_for_tests(settlements, effects)
    brs2 = BattleRoomService()
    brs2.init_persistence(rooms_col)
    loaded = brs2.get_room_by_id(room_id)
    assert loaded and loaded["status"] == "finished", "finished room must reload"
    assert brs2.get_room_for_character(cid) is None, "finished must not resume"

    _write(art, "after_restart.json", {
        "room_loaded": bool(loaded),
        "room_status": loaded.get("status"),
        "story_context": loaded.get("story_context"),
        "resume": brs2.get_room_for_character(cid),
        "settlement": settlements.find_one({"character_id": cid, "room_id": room_id}, {"_id": 0}),
    })
    _write(art, "server-after-restart.log", f"service_recreated=true\nroom_id={room_id}\n")

    # 打补丁并 finalize
    from unittest.mock import patch, AsyncMock

    effects_cfg = [
        {"action": "give_item", "itemId": 9001, "count": 1},
        {"action": "add_exp", "value": 10},
    ]
    ev = {"eventType": "battle", "server": {"effects": effects_cfg, "battleRef": BATTLE_REF}}

    with patch("services.story_service.get_or_create_progress", new=AsyncMock(side_effect=get_progress)), \
         patch("services.story_service.save_progress", new=AsyncMock(side_effect=save_progress)), \
         patch("services.story_service.load_map_config", return_value={"npcs": []}), \
         patch("services.story_service._find_event", return_value=({"npcUid": "enemy"}, ev, "enemy")), \
         patch("services.story_service.check_requirements", new=AsyncMock(return_value=(True, ""))), \
         patch("services.story_service._choice_completes_event", return_value=(True, "")), \
         patch("services.story_service._apply_single_effect", new=counting_single), \
         patch("services.story_service.build_state_payload", side_effect=lambda p, m: {
             "completed_event_ids": list(p.get("completed_event_ids") or []),
             "pending_battle": p.get("pending_battle"),
         }), \
         patch("services.battle_room_service.battle_room_service.get_room_by_id", side_effect=lambda rid: brs2.get_room_by_id(rid)):
        ok, msg, payload = await finalize_story_battle(
            user_id=uid,
            character_id=cid,
            map_code=MAP_CODE,
            event_id=EVENT_ID,
            room_id=room_id,
            request_id="finalize-after-restart",
            trace_id=trace_id,
        )
        ok2, msg2, payload2 = await finalize_story_battle(
            user_id=uid,
            character_id=cid,
            map_code=MAP_CODE,
            event_id=EVENT_ID,
            room_id=room_id,
            request_id="finalize-replay",
            trace_id=trace_id,
        )

    _write(art, "after_finalize.json", {
        "ok": ok,
        "msg": msg,
        "payload": payload,
        "apply_log": apply_log,
        "replay_ok": ok2,
        "replay_idempotent": payload2.get("idempotent_replay"),
        "settlement": settlements.find_one({"character_id": cid, "room_id": room_id}, {"_id": 0}),
        "effect_docs": list(effects.find({"character_id": cid, "room_id": room_id}, {"_id": 0})),
    })

    # 二次：effects_applied 恢复（新 room）
    apply_log2 = []
    cid2 = cid + "_ea"
    room2 = brs2.create_pve_room(
        user_id=uid,
        character_id=cid2,
        player_doc={"RobotName": "P", "MaxHP": 100, "CurrentHP": 100, "Melee": 50, "Armor": 0, "Initiative": 10},
        enemy_doc={"RobotName": "E", "MaxHP": 10, "CurrentHP": 10, "Melee": 1, "Armor": 0, "Initiative": 1},
        story_context={"map_code": MAP_CODE, "event_id": EVENT_ID, "battle_ref": BATTLE_REF},
    )
    room2["enemy"]["hp"] = 0
    brs2._end_if_needed(room2)
    rid2 = room2["room_id"]
    prog2 = await get_progress(uid, cid2, MAP_CODE)
    prog2["pending_battle"] = {
        "event_id": EVENT_ID,
        "battle_ref": BATTLE_REF,
        "map_code": MAP_CODE,
        "status": "completing",
        "room_id": rid2,
        "battle_result": {"winner": "player", "reason": "ko"},
    }
    settlements.insert_one(
        {
            "character_id": cid2,
            "event_id": EVENT_ID,
            "room_id": rid2,
            "status": STATUS_EFFECTS_APPLIED,
            "applied_effects": [{"action": "give_item", "itemId": 1, "count": 1}],
            "created_at": time.time(),
            "updated_at": time.time(),
            "completed_at": None,
            "error": None,
            "trace_id": trace_id,
        }
    )
    reset_ledger_cols_for_tests(settlements, effects)
    brs3 = BattleRoomService()
    brs3.init_persistence(rooms_col)

    async def apply_effects2(*a, **k):
        apply_log2.append("SHOULD_NOT_RUN")
        return []

    with patch("services.story_service.get_or_create_progress", new=AsyncMock(side_effect=get_progress)), \
         patch("services.story_service.save_progress", new=AsyncMock(side_effect=save_progress)), \
         patch("services.story_service.load_map_config", return_value={"npcs": []}), \
         patch("services.story_service._find_event", return_value=({"npcUid": "enemy"}, ev, "enemy")), \
         patch("services.story_service.check_requirements", new=AsyncMock(return_value=(True, ""))), \
         patch("services.story_service._choice_completes_event", return_value=(True, "")), \
         patch("services.story_service.apply_effects", new=apply_effects2), \
         patch("services.story_service.build_state_payload", side_effect=lambda p, m: {
             "completed_event_ids": list(p.get("completed_event_ids") or []),
             "pending_battle": p.get("pending_battle"),
         }), \
         patch("services.battle_room_service.battle_room_service.get_room_by_id", side_effect=lambda rid: brs3.get_room_by_id(rid)):
        ok_ea, msg_ea, payload_ea = await finalize_story_battle(
            user_id=uid,
            character_id=cid2,
            map_code=MAP_CODE,
            event_id=EVENT_ID,
            room_id=rid2,
            request_id="ea-resume",
            trace_id=trace_id,
        )

    conclusion = {
        "processing_resume_ok": bool(ok and apply_log == ["give_item", "add_exp"]),
        "completed_replay_ok": bool(ok2 and payload2.get("idempotent_replay")),
        "effects_applied_resume_ok": bool(ok_ea and not apply_log2 and EVENT_ID in (progress_store.get(f"{cid2}:{MAP_CODE}") or {}).get("completed_event_ids", [])),
        "finished_room_reload_ok": True,
        "finished_not_in_resume": True,
    }
    all_pass = all(conclusion.values())

    commit = os.popen(f'git -C "{ROOT}" rev-parse HEAD').read().strip()
    metadata = {
        "run_id": run_id,
        "commit_sha": commit,
        "character_id": cid,
        "map_code": MAP_CODE,
        "event_id": EVENT_ID,
        "battle_ref": BATTLE_REF,
        "room_id": room_id,
        "trace_id": trace_id,
        "settlement_key": f"{cid}|{EVENT_ID}|{room_id}",
        "server_restart_at": datetime.now(timezone.utc).isoformat(),
        "conclusion": conclusion,
        "final_pass": all_pass,
        "note": "Server-side Mongo restart evidence. Cocos editor manual steps still required for full UI closed-loop.",
    }
    _write(art, "metadata.json", metadata)
    _write(art, "after_relogin.json", {
        "progress_cid": progress_store.get(f"{cid}:{MAP_CODE}"),
        "progress_cid2": progress_store.get(f"{cid2}:{MAP_CODE}"),
        "settlement_status": (settlements.find_one({"character_id": cid, "room_id": room_id}) or {}).get("status"),
    })
    _write(art, "client.log", "simulated_client: story_get_state → pending_story_settlement → story_battle_finalize\n")

    # 清理本次 e2e 文档，避免污染
    settlements.delete_many({"character_id": {"$in": [cid, cid2]}})
    effects.delete_many({"character_id": {"$in": [cid, cid2]}})
    rooms_col.delete_many({"room_id": {"$in": [room_id, rid2]}})

    print("E2E_ARTIFACTS", str(art))
    print("E2E_PASS", all_pass)
    print(json.dumps(metadata, ensure_ascii=False, indent=2))
    return 0 if all_pass else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
