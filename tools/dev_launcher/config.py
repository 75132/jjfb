"""开发控制台配置读写与迁移。"""
from __future__ import annotations

import json
from pathlib import Path

from .services import DEFAULT_PORT_SPEC

CONFIG_PATH = Path(__file__).resolve().parent.parent / "dev_launcher_config.json"

DEFAULTS: dict = {
    "geometry": "1280x780",
    "port_spec": DEFAULT_PORT_SPEC,
    "theme": "dark",
    "auto_start": False,
    "auto_start_services": ["juben", "ws_server"],
    "stop_on_failure": False,
    "last_log_tab": "系统",
    "nav_page": "总览",
    "log_panel_height": 240,
    "log_auto_scroll": True,
    "log_max_lines": 8000,
    "health_poll_sec": 3.0,
}


def migrate_config(raw: dict) -> dict:
    """移除旧 Tk PanedWindow 字段，合并默认值。"""
    merged = {**DEFAULTS, **raw}
    if merged.get("paned_sash", 400) <= 100:
        merged.pop("paned_sash", None)
    merged.pop("paned_sash", None)
    merged.pop("last_left_tab", None)
    merged.pop("folders_collapsed", None)
    merged.pop("tools_collapsed", None)
    height = int(merged.get("log_panel_height", 240))
    merged["log_panel_height"] = max(160, min(480, height))
    return merged


def load_config() -> dict:
    if not CONFIG_PATH.is_file():
        return dict(DEFAULTS)
    try:
        raw = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return dict(DEFAULTS)
    return migrate_config(raw)


def save_config(data: dict) -> None:
    try:
        CONFIG_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    except OSError:
        pass
