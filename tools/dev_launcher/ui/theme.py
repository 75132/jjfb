"""CustomTkinter 主题与颜色。"""
from __future__ import annotations

STATUS_COLORS = {
    "stopped": "#64748b",
    "starting": "#f59e0b",
    "stopping": "#f97316",
    "running": "#22c55e",
    "partial": "#eab308",
    "exited": "#ef4444",
}

NAV_PAGES = ["总览", "服务", "文件夹", "工具", "端口", "设置"]

SIDEBAR_WIDTH = 160
LOG_MIN_HEIGHT = 160
LOG_DEFAULT_HEIGHT = 240


def apply_appearance(theme: str) -> None:
    import customtkinter as ctk

    mode = "dark" if theme == "dark" else "light"
    ctk.set_appearance_mode(mode)
    ctk.set_default_color_theme("blue")
