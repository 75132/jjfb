"""端口管理页。"""
from __future__ import annotations

import customtkinter as ctk

from ...process_utils import format_port_busy


class PortsPage(ctk.CTkScrollableFrame):
    def __init__(self, master: ctk.CTkFrame, app: object) -> None:
        super().__init__(master, fg_color="transparent")
        self._app = app
        self._cached_busy: dict[int, list[int]] | None = None
        self._scanning = False

        ctk.CTkLabel(
            self,
            text="端口 — 规格编辑、占用扫描与清理",
            font=ctk.CTkFont(size=15, weight="bold"),
        ).pack(anchor="w", padx=4, pady=(4, 12))

        spec_frame = ctk.CTkFrame(self, corner_radius=8)
        spec_frame.pack(fill="x", padx=4, pady=(0, 10))
        ctk.CTkLabel(spec_frame, text="清理端口规格（逗号/范围）", anchor="w").pack(
            anchor="w", padx=12, pady=(10, 4)
        )
        row = ctk.CTkFrame(spec_frame, fg_color="transparent")
        row.pack(fill="x", padx=12, pady=(0, 10))
        self._port_var = ctk.StringVar(value=app.config.get("port_spec", ""))
        ctk.CTkEntry(row, textvariable=self._port_var, width=360).pack(side="left", padx=(0, 8))
        ctk.CTkButton(row, text="保存", width=60, command=self._save_spec).pack(side="left", padx=(0, 8))
        ctk.CTkButton(row, text="清理端口", command=lambda: app.controller.cleanup_ports()).pack(
            side="left"
        )

        scan_frame = ctk.CTkFrame(self, corner_radius=8)
        scan_frame.pack(fill="both", expand=True, padx=4, pady=(0, 10))
        head = ctk.CTkFrame(scan_frame, fg_color="transparent")
        head.pack(fill="x", padx=12, pady=(10, 6))
        ctk.CTkLabel(head, text="端口占用", font=ctk.CTkFont(weight="bold")).pack(side="left")
        self._scan_btn = ctk.CTkButton(head, text="刷新扫描", width=90, command=lambda: self.refresh(force_scan=True))
        self._scan_btn.pack(side="right")

        self._table = ctk.CTkTextbox(
            scan_frame,
            font=ctk.CTkFont(family="Consolas", size=12),
            height=200,
        )
        self._table.pack(fill="both", expand=True, padx=12, pady=(0, 12))
        self._table.configure(state="disabled")
        self._render_table(None, hint="点击「刷新扫描」查看端口占用（避免频繁 netstat 拖慢界面）")

    def on_show(self) -> None:
        if self._cached_busy is None and not self._scanning:
            self.refresh(force_scan=True)

    def _save_spec(self) -> None:
        spec = self._port_var.get()
        self._app.config["port_spec"] = spec
        self._app.controller.set_port_spec(spec)
        self._app.persist_config()

    def _render_table(self, busy: dict[int, list[int]] | None, *, hint: str = "") -> None:
        lines = ["端口\tPID\n", "-" * 32 + "\n"]
        if hint:
            lines.append(f"{hint}\n")
        elif not busy:
            lines.append("（无占用）\n")
        else:
            for port in sorted(busy):
                for pid in busy[port]:
                    lines.append(f"{port}\t{pid}\n")
            lines.append(f"\n汇总: {format_port_busy(busy)}\n")
        text = "".join(lines)
        self._table.configure(state="normal")
        self._table.delete("1.0", "end")
        self._table.insert("1.0", text)
        self._table.configure(state="disabled")

    def refresh(self, *, force_scan: bool = False, snap=None, **kwargs) -> None:
        del snap, kwargs
        if self._scanning:
            return
        if not force_scan:
            if self._cached_busy is not None:
                self._render_table(self._cached_busy)
            return

        self._scanning = True
        if self._scan_btn:
            self._scan_btn.configure(state="disabled", text="扫描中…")

        def _work() -> None:
            try:
                busy = self._app.controller.scan_ports()
            except Exception:
                busy = {}
            self._cached_busy = busy
            self.after(0, self._finish_scan)

        import threading

        threading.Thread(target=_work, daemon=True, name="port-scan").start()

    def _finish_scan(self) -> None:
        self._scanning = False
        if self._scan_btn:
            self._scan_btn.configure(state="normal", text="刷新扫描")
        self._render_table(self._cached_busy)
