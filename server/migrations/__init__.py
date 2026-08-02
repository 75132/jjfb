"""
数据库迁移注册表。

普通启动 ws_server 不得执行本模块；请使用：
  python tools/migrate_db.py
  python tools/migrate_db.py --dry-run
"""
from __future__ import annotations

from typing import Callable, List, Sequence, Tuple

from . import m001_core_indexes

MigrationFn = Callable[[object, bool], List[str]]

# (id, description, runner)
MIGRATIONS: Sequence[Tuple[str, str, MigrationFn]] = (
    (
        "m001_core_indexes",
        "核心集合索引与 players 无效文档清理（原 ws_server 导入时副作用）",
        m001_core_indexes.run,
    ),
)


def list_migrations() -> List[Tuple[str, str]]:
    return [(mid, desc) for mid, desc, _ in MIGRATIONS]


def run_all(db, dry_run: bool = False) -> List[str]:
    """按顺序执行全部迁移；返回日志行。重复执行应安全（幂等）。"""
    lines: List[str] = []
    mode = "DRY-RUN" if dry_run else "APPLY"
    lines.append(f"[{mode}] 共 {len(MIGRATIONS)} 个迁移")
    for mid, desc, runner in MIGRATIONS:
        lines.append(f"[{mode}] >>> {mid}: {desc}")
        try:
            step_lines = runner(db, dry_run=dry_run)
            lines.extend(step_lines or [])
            lines.append(f"[{mode}] <<< {mid}: OK")
        except Exception as exc:
            lines.append(f"[{mode}] <<< {mid}: FAILED: {type(exc).__name__}: {exc}")
            raise
    return lines
