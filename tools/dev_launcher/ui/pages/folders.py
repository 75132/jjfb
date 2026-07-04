"""文件夹快捷页。"""
from __future__ import annotations

import customtkinter as ctk

from ...services import FOLDER_GROUPS


class FoldersPage(ctk.CTkScrollableFrame):
    def __init__(self, master: ctk.CTkFrame, app: object) -> None:
        super().__init__(master, fg_color="transparent")
        self._app = app

        ctk.CTkLabel(
            self,
            text="文件夹 — 在资源管理器中打开（与服务启停无关）",
            font=ctk.CTkFont(size=15, weight="bold"),
        ).pack(anchor="w", padx=4, pady=(4, 12))

        for group in FOLDER_GROUPS:
            frame = ctk.CTkFrame(self, corner_radius=8)
            frame.pack(fill="x", padx=4, pady=(0, 10))
            ctk.CTkLabel(
                frame,
                text=group.title,
                font=ctk.CTkFont(size=13, weight="bold"),
            ).pack(anchor="w", padx=12, pady=(10, 6))

            for fs in group.items:
                row = ctk.CTkFrame(frame, fg_color="transparent")
                row.pack(fill="x", padx=12, pady=4)
                ctk.CTkButton(
                    row,
                    text=fs.label,
                    width=140,
                    anchor="w",
                    command=lambda p=fs.path: app.open_path(p),
                ).pack(side="left")
                ctk.CTkLabel(
                    row,
                    text=str(fs.path),
                    font=ctk.CTkFont(family="Consolas", size=11),
                    text_color="gray60",
                ).pack(side="left", padx=(12, 0))

            ctk.CTkLabel(frame, text="").pack(pady=4)

    def refresh(self, snap=None, **kwargs) -> None:
        pass
