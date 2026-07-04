"""可复用服务卡片。"""
from __future__ import annotations

from collections.abc import Callable

import customtkinter as ctk

from ...services import ServiceDef
from ...status_monitor import ServiceSnapshot
from ..theme import STATUS_COLORS


class ServiceCard(ctk.CTkFrame):
    def __init__(
        self,
        master: ctk.CTkFrame,
        svc: ServiceDef,
        *,
        compact: bool = False,
        on_start: Callable[[], None],
        on_stop: Callable[[], None],
        on_restart: Callable[[], None],
        on_open_dir: Callable[[], None],
        on_open_url: Callable[[str], None],
        on_copy_url: Callable[[str], None],
    ) -> None:
        super().__init__(master, corner_radius=8)
        self._svc = svc
        self._status_dot: ctk.CTkLabel | None = None
        self._status_label: ctk.CTkLabel | None = None
        self._detail_label: ctk.CTkLabel | None = None
        self._action_buttons: dict[str, ctk.CTkButton] = {}
        self._last_snap_key: tuple | None = None

        head = ctk.CTkFrame(self, fg_color="transparent")
        head.pack(fill="x", padx=12, pady=(10, 4))

        self._status_dot = ctk.CTkLabel(head, text="●", font=ctk.CTkFont(size=16), width=20)
        self._status_dot.pack(side="left")
        ctk.CTkLabel(head, text=svc.name, font=ctk.CTkFont(size=14, weight="bold")).pack(
            side="left", padx=(4, 0)
        )
        self._status_label = ctk.CTkLabel(head, text="未启动", font=ctk.CTkFont(size=12))
        self._status_label.pack(side="right")

        self._detail_label = ctk.CTkLabel(
            self, text="", font=ctk.CTkFont(size=11), text_color="gray60", anchor="w", justify="left"
        )
        self._detail_label.pack(fill="x", padx=12, pady=(0, 4))

        ports = ", ".join(str(p) for p in svc.ports)
        ctk.CTkLabel(self, text=f"端口: {ports}", font=ctk.CTkFont(size=11), anchor="w").pack(
            fill="x", padx=12
        )

        if not compact and svc.notes:
            ctk.CTkLabel(
                self,
                text=svc.notes,
                font=ctk.CTkFont(size=11),
                text_color="gray55",
                anchor="w",
                wraplength=420,
                justify="left",
            ).pack(fill="x", padx=12, pady=(2, 4))

        btn_row = ctk.CTkFrame(self, fg_color="transparent")
        btn_row.pack(fill="x", padx=12, pady=(8, 4))
        for text, key, cmd in [
            ("启动", "start", on_start),
            ("停止", "stop", on_stop),
            ("重启", "restart", on_restart),
            ("目录", "dir", on_open_dir),
        ]:
            btn = ctk.CTkButton(btn_row, text=text, width=64, height=28, command=cmd)
            btn.pack(side="left", padx=(0, 6))
            self._action_buttons[key] = btn

        if svc.urls:
            url_row = ctk.CTkFrame(self, fg_color="transparent")
            url_row.pack(fill="x", padx=12, pady=(0, 10))
            for u in svc.urls:
                ctk.CTkButton(
                    url_row,
                    text=u.label,
                    width=80,
                    height=26,
                    command=lambda url=u.url: on_open_url(url),
                ).pack(side="left", padx=(0, 4))
                ctk.CTkButton(
                    url_row,
                    text="复制",
                    width=50,
                    height=26,
                    fg_color="gray40",
                    command=lambda url=u.url: on_copy_url(url),
                ).pack(side="left", padx=(0, 8))

        self.update_snapshot(ServiceSnapshot())

    def update_snapshot(self, snap: ServiceSnapshot) -> None:
        snap_key = (snap.state, snap.label, snap.detail, snap.health_ok)
        if snap_key == self._last_snap_key:
            return
        self._last_snap_key = snap_key

        color = STATUS_COLORS.get(snap.state, STATUS_COLORS["stopped"])
        if self._status_dot:
            self._status_dot.configure(text_color=color)
        if self._status_label:
            self._status_label.configure(text=snap.label)
        if self._detail_label:
            self._detail_label.configure(text=snap.detail or snap.tooltip)

        busy = snap.state in ("starting", "stopping")
        running = snap.state in ("running", "partial") or snap.health_ok
        can_start = not busy and snap.state in ("stopped", "exited", "partial")
        can_stop = not busy and running
        can_restart = not busy

        if "start" in self._action_buttons:
            self._action_buttons["start"].configure(state="normal" if can_start else "disabled")
        if "stop" in self._action_buttons:
            self._action_buttons["stop"].configure(state="normal" if can_stop else "disabled")
        if "restart" in self._action_buttons:
            self._action_buttons["restart"].configure(state="normal" if can_restart else "disabled")
