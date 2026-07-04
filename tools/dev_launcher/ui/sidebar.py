"""左侧导航栏。"""
from __future__ import annotations

from collections.abc import Callable

import customtkinter as ctk

from .theme import NAV_PAGES, SIDEBAR_WIDTH


class Sidebar(ctk.CTkFrame):
    def __init__(
        self,
        master: ctk.CTkFrame,
        *,
        on_nav: Callable[[str], None],
        initial: str = "总览",
    ) -> None:
        super().__init__(master, width=SIDEBAR_WIDTH, corner_radius=0)
        self.grid_propagate(False)
        self._callback = on_nav
        self._buttons: dict[str, ctk.CTkButton] = {}
        self._active = initial

        title = ctk.CTkLabel(self, text="导航", font=ctk.CTkFont(size=13, weight="bold"))
        title.pack(anchor="w", padx=12, pady=(12, 8))

        for page in NAV_PAGES:
            btn = ctk.CTkButton(
                self,
                text=page,
                anchor="w",
                height=36,
                fg_color="transparent",
                text_color=("gray10", "gray90"),
                hover_color=("gray85", "gray25"),
                command=lambda p=page: self._navigate(p),
            )
            btn.pack(fill="x", padx=8, pady=2)
            self._buttons[page] = btn

        self.highlight(initial)

    def _navigate(self, page: str) -> None:
        self.highlight(page)
        self._callback(page)

    def highlight(self, page: str) -> None:
        self._active = page
        for name, btn in self._buttons.items():
            if name == page:
                btn.configure(fg_color=("#3b8ed0", "#1f6aa5"))
            else:
                btn.configure(fg_color="transparent")
