"""底部日志坞。"""
from __future__ import annotations

import queue
from typing import TYPE_CHECKING

import customtkinter as ctk

from ..services import SERVICES

if TYPE_CHECKING:
    from ..runtime import ServiceRuntime


LOG_BATCH_MAX = 80
LOG_DRAIN_MS = 120


class LogPanel(ctk.CTkFrame):
    def __init__(
        self,
        master: ctk.CTkFrame,
        *,
        runtimes: dict[str, "ServiceRuntime"],
        system_log_q: queue.Queue[str],
        max_lines: int = 8000,
        auto_scroll: bool = True,
        initial_tab: str = "系统",
    ) -> None:
        super().__init__(master, corner_radius=0)
        self._runtimes = runtimes
        self._system_log_q = system_log_q
        self._max_lines = max_lines
        self._auto_scroll = auto_scroll
        self._filter_text = ""
        self._textboxes: dict[str, ctk.CTkTextbox] = {}
        self._raw_buffers: dict[str, list[str]] = {}

        header = ctk.CTkFrame(self, fg_color="transparent")
        header.pack(fill="x", padx=8, pady=(6, 4))

        ctk.CTkLabel(header, text="运行日志", font=ctk.CTkFont(weight="bold")).pack(side="left")

        self._search_var = ctk.StringVar()
        search = ctk.CTkEntry(header, placeholder_text="搜索日志…", textvariable=self._search_var, width=180)
        search.pack(side="right", padx=(8, 0))
        search.bind("<KeyRelease>", lambda _e: self._apply_filter())

        self._auto_scroll_var = ctk.BooleanVar(value=auto_scroll)
        ctk.CTkCheckBox(
            header,
            text="自动滚动",
            variable=self._auto_scroll_var,
            command=self._on_auto_scroll_toggle,
            width=90,
        ).pack(side="right", padx=4)

        ctk.CTkButton(header, text="清空", width=60, command=self._clear_current).pack(side="right", padx=4)

        self._tabs = ctk.CTkTabview(self)
        self._tabs.pack(fill="both", expand=True, padx=8, pady=(0, 8))

        tab_ids = [s.log_tab or s.name for s in SERVICES] + ["系统"]
        for tab_id in tab_ids:
            self._tabs.add(tab_id)
            box = ctk.CTkTextbox(
                self._tabs.tab(tab_id),
                font=ctk.CTkFont(family="Consolas", size=12),
                wrap="word",
                activate_scrollbars=True,
            )
            box.pack(fill="both", expand=True)
            box.configure(state="disabled")
            self._textboxes[tab_id] = box
            self._raw_buffers[tab_id] = []

        if initial_tab in tab_ids:
            self._tabs.set(initial_tab)

    def _on_auto_scroll_toggle(self) -> None:
        self._auto_scroll = bool(self._auto_scroll_var.get())

    def get_auto_scroll(self) -> bool:
        return bool(self._auto_scroll_var.get())

    def get_current_tab(self) -> str:
        return self._tabs.get()

    def append_system(self, text: str) -> None:
        self._append_to_tab("系统", text)

    def _append_to_tab(self, tab_id: str, text: str) -> None:
        buf = self._raw_buffers.setdefault(tab_id, [])
        buf.append(text)
        if len(buf) > self._max_lines:
            del buf[: len(buf) - self._max_lines]
        if tab_id == self._tabs.get() or not self._filter_text:
            self._render_tab(tab_id)

    def _render_tab(self, tab_id: str) -> None:
        box = self._textboxes.get(tab_id)
        if not box:
            return
        buf = self._raw_buffers.get(tab_id, [])
        filt = self._filter_text.strip().lower()
        if filt:
            lines = [ln for ln in buf if filt in ln.lower()]
            content = "".join(lines) if lines else f"（无匹配 \"{self._filter_text}\"）\n"
        else:
            content = "".join(buf)
        box.configure(state="normal")
        box.delete("1.0", "end")
        box.insert("1.0", content)
        box.configure(state="disabled")
        if self._auto_scroll:
            box.see("end")

    def _apply_filter(self) -> None:
        self._filter_text = self._search_var.get()
        self._render_tab(self._tabs.get())

    def _clear_current(self) -> None:
        tab = self._tabs.get()
        self._raw_buffers[tab] = []
        self._render_tab(tab)

    def drain_queues(self) -> bool:
        pending = False
        for rt in self._runtimes.values():
            tab = rt.log_tab
            batch: list[str] = []
            try:
                while len(batch) < LOG_BATCH_MAX:
                    batch.append(rt.log_q.get_nowait())
            except queue.Empty:
                pass
            if batch:
                pending = True
                for chunk in batch:
                    self._append_to_tab(tab, chunk)

        try:
            while True:
                line = self._system_log_q.get_nowait()
                pending = True
                self._append_to_tab("系统", line)
        except queue.Empty:
            pass

        return pending

    def schedule_drain(self, after_fn) -> None:
        pending = self.drain_queues()
        delay = 80 if pending else LOG_DRAIN_MS
        after_fn(delay, self.schedule_drain, after_fn)
