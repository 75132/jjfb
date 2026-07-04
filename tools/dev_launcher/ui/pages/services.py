"""服务详情页。"""
from __future__ import annotations

import customtkinter as ctk

from ...services import SERVICES
from ..widgets.service_card import ServiceCard


class ServicesPage(ctk.CTkScrollableFrame):
    def __init__(self, master: ctk.CTkFrame, app: object) -> None:
        super().__init__(master, fg_color="transparent")
        self._app = app
        self._cards: dict[str, ServiceCard] = {}
        self._last_ts = 0.0

        ctk.CTkLabel(
            self,
            text="服务管理 — 启停、端口与健康检查",
            font=ctk.CTkFont(size=15, weight="bold"),
        ).pack(anchor="w", padx=4, pady=(4, 12))

        tabs = ctk.CTkTabview(self)
        tabs.pack(fill="both", expand=True)

        for svc in SERVICES:
            tabs.add(svc.name)
            tab = tabs.tab(svc.name)
            card = ServiceCard(
                tab,
                svc,
                compact=False,
                on_start=lambda sid=svc.id: app.controller.start_service(sid),
                on_stop=lambda sid=svc.id: app.controller.stop_service(sid),
                on_restart=lambda sid=svc.id: app.controller.restart_service(sid),
                on_open_dir=lambda p=svc.cwd: app.open_path(p),
                on_open_url=lambda url, sid=svc.id: app.open_url(sid, url),
                on_copy_url=lambda url, sid=svc.id: app.copy_url(sid, url),
            )
            card.pack(fill="x", padx=8, pady=8)
            self._cards[svc.id] = card

            if svc.id == "juben":
                hint = ctk.CTkFrame(tab, fg_color=("gray90", "gray20"), corner_radius=6)
                hint.pack(fill="x", padx=8, pady=(0, 8))
                ctk.CTkLabel(
                    hint,
                    text="若启动失败，请在 Juben 目录运行: npm install",
                    font=ctk.CTkFont(size=11),
                    anchor="w",
                ).pack(side="left", padx=10, pady=8)
                ctk.CTkButton(
                    hint,
                    text="复制命令",
                    width=80,
                    height=26,
                    command=lambda: app.copy_text("cd Juben && npm install"),
                ).pack(side="right", padx=10, pady=8)

    def refresh(self, snap=None, **kwargs) -> None:
        del kwargs
        snap = snap or self._app.monitor.get_snapshot()
        if snap.ts == self._last_ts:
            return
        self._last_ts = snap.ts
        for sid, card in self._cards.items():
            svc_snap = snap.services.get(sid)
            if svc_snap:
                card.update_snapshot(svc_snap)
