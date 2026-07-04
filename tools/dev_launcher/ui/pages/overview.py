"""总览页。"""
from __future__ import annotations

import customtkinter as ctk

from ...services import SERVICES
from ..widgets.service_card import ServiceCard


class OverviewPage(ctk.CTkScrollableFrame):
    def __init__(self, master: ctk.CTkFrame, app: object) -> None:
        super().__init__(master, fg_color="transparent")
        self._app = app
        self._cards: dict[str, ServiceCard] = {}
        self._last_ts = 0.0

        ctk.CTkLabel(
            self,
            text="服务总览 — 一键查看全部开发服务状态",
            font=ctk.CTkFont(size=15, weight="bold"),
        ).pack(anchor="w", padx=4, pady=(4, 12))

        grid = ctk.CTkFrame(self, fg_color="transparent")
        grid.pack(fill="both", expand=True)
        grid.columnconfigure(0, weight=1)
        grid.columnconfigure(1, weight=1)

        for i, svc in enumerate(SERVICES):
            card = ServiceCard(
                grid,
                svc,
                compact=True,
                on_start=lambda sid=svc.id: app.controller.start_service(sid),
                on_stop=lambda sid=svc.id: app.controller.stop_service(sid),
                on_restart=lambda sid=svc.id: app.controller.restart_service(sid),
                on_open_dir=lambda p=svc.cwd: app.open_path(p),
                on_open_url=lambda url, sid=svc.id: app.open_url(sid, url),
                on_copy_url=lambda url, sid=svc.id: app.copy_url(sid, url),
            )
            card.grid(row=i // 2, column=i % 2, sticky="nsew", padx=6, pady=6)
            self._cards[svc.id] = card

    def refresh(self, snap=None, **kwargs) -> None:
        del kwargs
        snap = snap or self._app.monitor.get_snapshot()
        if snap.ts == getattr(self, "_last_ts", 0):
            return
        self._last_ts = snap.ts
        for sid, card in self._cards.items():
            svc_snap = snap.services.get(sid)
            if svc_snap:
                card.update_snapshot(svc_snap)
