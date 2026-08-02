"""
m001: 从 ws_server 导入时副作用迁出的索引与数据清理。

幂等约定：
- create_index：同名/同键已存在则跳过或由 Mongo 幂等接受
- drop_index：仅在目标索引确实存在时删除
- delete_many：清理 character_id 为 null / 不存在的 players 文档（可重复执行）
"""
from __future__ import annotations

from typing import Any, List


def _index_names(col) -> set:
    try:
        return {idx["name"] for idx in col.list_indexes()}
    except Exception:
        return set()


def _ensure_index(col, keys, dry_run: bool, label: str, **kwargs) -> List[str]:
    lines = []
    name = kwargs.get("name")
    existing = _index_names(col)
    # 若显式 name 且已存在，视为已应用
    if name and name in existing:
        lines.append(f"  skip create_index {label} (name={name} exists)")
        return lines
    if dry_run:
        lines.append(f"  would create_index {label} keys={keys!r} kwargs={kwargs!r}")
        return lines
    try:
        col.create_index(keys, **kwargs)
        lines.append(f"  create_index OK {label}")
    except Exception as exc:
        # 已存在且定义冲突时记录，不中断后续（与旧启动路径 try/except 一致）
        lines.append(f"  create_index WARN {label}: {type(exc).__name__}: {exc}")
    return lines


def _drop_index_if_exists(col, index_name: str, dry_run: bool) -> List[str]:
    lines = []
    if index_name not in _index_names(col):
        lines.append(f"  skip drop_index {index_name} (not found)")
        return lines
    if dry_run:
        lines.append(f"  would drop_index {index_name}")
        return lines
    try:
        col.drop_index(index_name)
        lines.append(f"  drop_index OK {index_name}")
    except Exception as exc:
        lines.append(f"  drop_index WARN {index_name}: {type(exc).__name__}: {exc}")
    return lines


def _delete_many(col, filt: dict, dry_run: bool, label: str) -> List[str]:
    lines = []
    try:
        count = col.count_documents(filt)
    except Exception as exc:
        lines.append(f"  count_documents FAIL {label}: {exc}")
        return lines
    if dry_run:
        lines.append(f"  would delete_many {label}: match={count}")
        return lines
    if count == 0:
        lines.append(f"  skip delete_many {label}: match=0")
        return lines
    result = col.delete_many(filt)
    lines.append(f"  delete_many OK {label}: deleted={result.deleted_count}")
    return lines


def run(db: Any, dry_run: bool = False) -> List[str]:
    lines: List[str] = []

    users_col = db["users"]
    account_limits_col = db["account_limits"]
    players_col = db["players"]
    messages_col = db["messages"]
    robotbase_col = db["RobotBase"]
    robotpet_col = db["RobotPet"]
    inventory_col = db["inventory"]
    daletou_draws_col = db["daletou_draws"]
    minigame2_rounds_col = db["minigame2_rounds"]
    minigame2_bets_col = db["minigame2_bets"]
    story_progress_col = db["story_progress"]
    mails_col = db["mails"]
    battle_rooms_col = db["battle_rooms"]

    # --- 原早期 create_index 块 ---
    lines.extend(_ensure_index(daletou_draws_col, "day", dry_run, "daletou_draws.day", unique=True))
    lines.extend(
        _ensure_index(minigame2_rounds_col, "issue_key", dry_run, "minigame2_rounds.issue_key", unique=True)
    )
    lines.extend(
        _ensure_index(
            minigame2_bets_col,
            [("issue_key", 1), ("character_id", 1), ("selected_key", 1)],
            dry_run,
            "minigame2_bets.uk",
            unique=True,
        )
    )
    lines.extend(
        _ensure_index(
            minigame2_rounds_col, "close_time", dry_run, "minigame2_rounds.close_time", unique=False
        )
    )
    lines.extend(
        _ensure_index(
            minigame2_bets_col,
            [("character_id", 1), ("issue_key", 1)],
            dry_run,
            "minigame2_bets.character_issue",
            unique=False,
        )
    )
    lines.extend(
        _ensure_index(
            story_progress_col,
            [("character_id", 1), ("map_code", 1)],
            dry_run,
            "story_progress.uk",
            unique=True,
        )
    )
    lines.extend(
        _ensure_index(
            mails_col, [("character_id", 1), ("created_at", -1)], dry_run, "mails.character_created"
        )
    )
    lines.extend(_ensure_index(mails_col, "mail_id", dry_run, "mails.mail_id", unique=True))
    lines.extend(
        _ensure_index(battle_rooms_col, "room_id", dry_run, "battle_rooms.room_id", unique=True)
    )
    lines.extend(
        _ensure_index(
            battle_rooms_col,
            [("character_id", 1), ("status", 1)],
            dry_run,
            "battle_rooms.character_status",
        )
    )

    # --- users ---
    lines.extend(_ensure_index(users_col, "account", dry_run, "users.account", unique=True))
    # token sparse unique：若旧非 sparse 索引冲突，先 drop 再创建（仅迁移工具）
    token_names = _index_names(users_col)
    if "token_1" in token_names:
        # 无法在 dry-run 中可靠解析是否 sparse；若 recreate 需要则 drop+create
        # 幂等：若 create 已成功则后续仅 skip
        pass
    try:
        if dry_run:
            lines.append("  would ensure users.token sparse unique")
        else:
            try:
                users_col.create_index("token", unique=True, sparse=True)
                lines.append("  create_index OK users.token sparse unique")
            except Exception as exc:
                lines.append(f"  create_index users.token conflict: {exc}; try drop+recreate")
                lines.extend(_drop_index_if_exists(users_col, "token_1", dry_run=False))
                users_col.create_index("token", unique=True, sparse=True)
                lines.append("  recreate OK users.token sparse unique")
    except Exception as exc:
        lines.append(f"  users.token WARN: {exc}")

    # --- players：清理无效文档后建立 partial unique ---
    lines.extend(_drop_index_if_exists(players_col, "user_id_1", dry_run))
    lines.extend(_delete_many(players_col, {"character_id": None}, dry_run, "players.character_id=null"))
    lines.extend(
        _delete_many(
            players_col,
            {"character_id": {"$exists": False}},
            dry_run,
            "players.character_id missing",
        )
    )
    lines.extend(_drop_index_if_exists(players_col, "character_id_1", dry_run))
    lines.extend(
        _ensure_index(
            players_col,
            "character_id",
            dry_run,
            "players.character_id_partial",
            unique=True,
            name="character_id_partial",
            partialFilterExpression={"character_id": {"$exists": True}},
        )
    )
    lines.extend(
        _ensure_index(
            players_col,
            [("user_id", 1), ("slot_index", 1)],
            dry_run,
            "players.user_slot",
            unique=True,
        )
    )
    lines.extend(
        _ensure_index(
            players_col,
            [("user_id", 1), ("slot_index", 1), ("character_id", 1)],
            dry_run,
            "players.user_slot_character",
        )
    )
    lines.extend(
        _ensure_index(
            players_col,
            [("user_id", 1), ("character_id", 1)],
            dry_run,
            "players.user_character",
        )
    )
    lines.extend(
        _ensure_index(
            players_col, "friend_id", dry_run, "players.friend_id", unique=True, sparse=True
        )
    )

    lines.extend(
        _ensure_index(
            messages_col, [("type", 1), ("created_at", -1)], dry_run, "messages.type_created"
        )
    )
    lines.extend(
        _ensure_index(
            robotbase_col, "RobotID", dry_run, "RobotBase.RobotID", unique=True, sparse=True
        )
    )
    lines.extend(
        _ensure_index(
            robotpet_col, [("user_id", 1), ("character_id", 1)], dry_run, "RobotPet.user_character"
        )
    )
    lines.extend(
        _ensure_index(
            robotpet_col,
            [("user_id", 1), ("character_id", 1), ("Level", 1)],
            dry_run,
            "RobotPet.user_character_level",
        )
    )
    lines.extend(
        _ensure_index(
            robotpet_col,
            [("user_id", 1), ("character_id", 1), ("slot_index", 1)],
            dry_run,
            "RobotPet.user_character_slot",
        )
    )
    lines.extend(_ensure_index(robotpet_col, "robot_base_id", dry_run, "RobotPet.robot_base_id"))
    lines.extend(
        _ensure_index(
            inventory_col,
            [("user_id", 1), ("character_id", 1)],
            dry_run,
            "inventory.user_character",
            unique=True,
        )
    )
    lines.extend(
        _ensure_index(
            account_limits_col,
            [("username", 1), ("ip", 1)],
            dry_run,
            "account_limits.username_ip",
            unique=True,
            name="username_ip_unique",
        )
    )
    lines.extend(
        _ensure_index(account_limits_col, "update_time", dry_run, "account_limits.update_time")
    )

    return lines
