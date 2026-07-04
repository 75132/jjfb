"""辅助工具页。"""
from __future__ import annotations

import os
import subprocess
import sys

import customtkinter as ctk
from tkinter import messagebox

from ...services import TOOLS

TOOL_HINTS = {
    "pack_cocos": "将 Cocos 工程打包为 zip，便于分发或备份。",
    "tilemap_viewer": "查看 Tilemap 坐标，编辑地图摆点时对照使用。",
}


class ToolsPage(ctk.CTkScrollableFrame):
    def __init__(self, master: ctk.CTkFrame, app: object) -> None:
        super().__init__(master, fg_color="transparent")
        self._app = app

        ctk.CTkLabel(
            self,
            text="工具 — 独立辅助程序（单独进程，不影响 Juben / ws_server）",
            font=ctk.CTkFont(size=15, weight="bold"),
        ).pack(anchor="w", padx=4, pady=(4, 12))

        for tool in TOOLS:
            frame = ctk.CTkFrame(self, corner_radius=8)
            frame.pack(fill="x", padx=4, pady=(0, 10))
            ctk.CTkLabel(frame, text=tool.label, font=ctk.CTkFont(size=13, weight="bold")).pack(
                anchor="w", padx=12, pady=(10, 4)
            )
            ctk.CTkLabel(
                frame,
                text=TOOL_HINTS.get(tool.id, tool.script.name),
                font=ctk.CTkFont(size=11),
                text_color="gray60",
                wraplength=500,
                justify="left",
            ).pack(anchor="w", padx=12, pady=(0, 8))
            ctk.CTkButton(
                frame,
                text=f"启动 {tool.label}",
                command=lambda t=tool: self._launch(t),
            ).pack(anchor="w", padx=12, pady=(0, 12))

    def _launch(self, tool) -> None:
        if tool.requires_pillow:
            try:
                import PIL  # noqa: F401
            except ImportError:
                messagebox.showerror(
                    "缺少依赖",
                    "Tilemap 坐标查看器需要 Pillow。\n\n"
                    "pip install -r Juben/AItools/requirements-tilemap-viewer.txt",
                )
                return
        if not tool.script.is_file():
            messagebox.showerror("找不到脚本", str(tool.script))
            return
        try:
            subprocess.Popen(
                [sys.executable, str(tool.script)],
                cwd=str(tool.cwd),
                creationflags=subprocess.CREATE_NEW_CONSOLE if os.name == "nt" else 0,
            )
            self._app.log_panel.append_system(f"[工具] 已启动：{tool.label}\n")
        except OSError as e:
            messagebox.showerror("启动失败", str(e))

    def refresh(self, snap=None, **kwargs) -> None:
        pass
