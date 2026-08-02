#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
数据库迁移工具（索引 / 一次性数据清理）。

用法（在 server 目录或任意目录）:
  python tools/migrate_db.py --dry-run
  python tools/migrate_db.py
  python tools/migrate_db.py --list

连接串来自 server/config.py（环境变量 / server/.env）。
普通启动 ws_server 不会执行本脚本。
"""
from __future__ import annotations

import argparse
import os
import sys
from typing import List, Optional

# 保证可 import server 包内模块
_SERVER_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _SERVER_DIR not in sys.path:
    sys.path.insert(0, _SERVER_DIR)


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="JJFB MongoDB 迁移工具")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="只打印将要执行的操作，不写入数据库",
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="列出已注册迁移后退出",
    )
    args = parser.parse_args(argv)

    from migrations import list_migrations, run_all

    if args.list:
        for mid, desc in list_migrations():
            print(f"{mid}\t{desc}")
        return 0

    from config import ConfigError, load_config, redact_mongo_url
    from pymongo import MongoClient

    try:
        cfg = load_config()
    except ConfigError as exc:
        print(f"[migrate_db] 配置错误: {exc}", file=sys.stderr)
        return 2

    print(f"[migrate_db] environment={cfg.environment}")
    print(f"[migrate_db] mongo={redact_mongo_url(cfg.mongo_url)}")
    if args.dry_run:
        print("[migrate_db] DRY-RUN 模式：不会修改数据")

    client = MongoClient(
        cfg.mongo_url,
        serverSelectionTimeoutMS=10000,
        connectTimeoutMS=10000,
    )
    try:
        # 触发一次连通性检查
        client.admin.command("ping")
        db = client["jjfb"]
        lines = run_all(db, dry_run=args.dry_run)
        for line in lines:
            print(line)
        print("[migrate_db] 完成")
        return 0
    except Exception as exc:
        print(f"[migrate_db] 失败: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 1
    finally:
        client.close()


if __name__ == "__main__":
    raise SystemExit(main())
