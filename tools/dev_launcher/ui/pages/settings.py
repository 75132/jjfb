"""设置页。"""
from __future__ import annotations

import customtkinter as ctk


class SettingsPage(ctk.CTkScrollableFrame):
    def __init__(self, master: ctk.CTkFrame, app: object) -> None:
        super().__init__(master, fg_color="transparent")
        self._app = app

        ctk.CTkLabel(self, text="设置", font=ctk.CTkFont(size=15, weight="bold")).pack(
            anchor="w", padx=4, pady=(4, 12)
        )

        frame = ctk.CTkFrame(self, corner_radius=8)
        frame.pack(fill="x", padx=4, pady=(0, 10))

        self._auto_start = ctk.BooleanVar(value=bool(app.config.get("auto_start", False)))
        ctk.CTkCheckBox(frame, text="启动控制台时自动「全部启动」", variable=self._auto_start).pack(
            anchor="w", padx=12, pady=(12, 6)
        )

        self._stop_on_fail = ctk.BooleanVar(value=bool(app.config.get("stop_on_failure", False)))
        ctk.CTkCheckBox(frame, text="全部启动时，某服务失败则中止后续", variable=self._stop_on_fail).pack(
            anchor="w", padx=12, pady=6
        )

        ctk.CTkLabel(frame, text="外观主题", anchor="w").pack(anchor="w", padx=12, pady=(8, 4))
        self._theme_var = ctk.StringVar(value=app.config.get("theme", "dark"))
        ctk.CTkOptionMenu(frame, variable=self._theme_var, values=["dark", "system"]).pack(
            anchor="w", padx=12, pady=(0, 8)
        )

        ctk.CTkLabel(frame, text="日志坞高度 (160–480)", anchor="w").pack(anchor="w", padx=12, pady=(8, 4))
        self._log_height = ctk.IntVar(value=int(app.config.get("log_panel_height", 240)))
        ctk.CTkSlider(
            frame,
            from_=160,
            to=480,
            number_of_steps=16,
            variable=self._log_height,
            command=lambda _v: app.set_log_height(int(self._log_height.get())),
        ).pack(fill="x", padx=12, pady=(0, 8))

        ctk.CTkLabel(frame, text="健康检查间隔 (秒)", anchor="w").pack(anchor="w", padx=12, pady=(8, 4))
        self._health_sec = ctk.DoubleVar(value=float(app.config.get("health_poll_sec", 3.0)))
        ctk.CTkOptionMenu(
            frame,
            variable=self._health_sec,
            values=["2.0", "3.0", "5.0", "10.0"],
        ).pack(anchor="w", padx=12, pady=(0, 12))

        ctk.CTkButton(frame, text="保存设置", command=self._save).pack(anchor="w", padx=12, pady=(0, 12))

        ctk.CTkLabel(
            self,
            text="主题变更需重启控制台后完全生效。",
            font=ctk.CTkFont(size=11),
            text_color="gray60",
        ).pack(anchor="w", padx=8, pady=4)

    def _save(self) -> None:
        cfg = self._app.config
        cfg["auto_start"] = bool(self._auto_start.get())
        cfg["stop_on_failure"] = bool(self._stop_on_fail.get())
        cfg["theme"] = self._theme_var.get()
        cfg["log_panel_height"] = int(self._log_height.get())
        cfg["health_poll_sec"] = float(self._health_sec.get())
        self._app.controller.set_config(cfg)
        self._app.persist_config()
        self._app.set_log_height(cfg["log_panel_height"])

    def refresh(self, snap=None, **kwargs) -> None:
        pass
