"""机甲风暴 · 开发控制台（CustomTkinter）。"""
from __future__ import annotations

import os
import queue
import sys
import webbrowser
from pathlib import Path
from tkinter import messagebox

import customtkinter as ctk

from .config import load_config, save_config
from .env_utils import juben_env_status
from .service_controller import ServiceController
from .services import ROOT
from .status_monitor import StatusMonitor
from .ui.log_panel import LOG_DRAIN_MS, LogPanel
from .ui.pages.folders import FoldersPage
from .ui.pages.overview import OverviewPage
from .ui.pages.ports import PortsPage
from .ui.pages.services import ServicesPage
from .ui.pages.settings import SettingsPage
from .ui.pages.tools import ToolsPage
from .ui.sidebar import Sidebar
from .ui.theme import LOG_MIN_HEIGHT, apply_appearance

UI_REFRESH_IDLE_MS = 450
UI_REFRESH_ACTIVE_MS = 160


def open_path_in_explorer(path: Path) -> None:
    if not path.exists():
        messagebox.showwarning("路径不存在", f"目录不存在：\n{path}")
        return
    try:
        if os.name == "nt":
            os.startfile(str(path))  # noqa: S606
        elif sys.platform == "darwin":
            import subprocess

            subprocess.run(["open", str(path)], check=False)
        else:
            import subprocess

            subprocess.run(["xdg-open", str(path)], check=False)
    except OSError as e:
        messagebox.showerror("打开失败", str(e))


class DevLauncherApp(ctk.CTk):
    def __init__(self) -> None:
        self.config = load_config()
        apply_appearance(self.config.get("theme", "dark"))

        super().__init__()
        self.title("机甲风暴 · 开发控制台")
        self.geometry(self.config.get("geometry", "1280x780"))
        self.minsize(1100, 640)

        self._system_log_q: queue.Queue[str] = queue.Queue()
        self._status_var = ctk.StringVar(value="就绪")
        self._busy = False
        self._service_btn_refs: list[ctk.CTkButton] = []

        self.controller = ServiceController(
            system_log_q=self._system_log_q,
            on_preflight_fail=self._on_preflight_fail,
            on_busy_change=self._on_busy_change,
        )
        self.controller.set_config(self.config)
        self.controller.set_port_spec(self.config.get("port_spec", ""))

        poll = float(self.config.get("health_poll_sec", 3.0))
        self.monitor = StatusMonitor(self.controller.runtimes, interval_sec=poll)
        self.monitor.start()

        self._pages: dict = {}
        self._page_factories: dict = {}
        self._current_page_name = self.config.get("nav_page", "总览")
        self._current_page_widget = None
        self._last_snap_ts = 0.0

        self._build_layout()
        self._show_page(self._current_page_name)

        self.protocol("WM_DELETE_WINDOW", self._on_close)
        self.after(100, self._drain_logs)
        self.after(UI_REFRESH_IDLE_MS, self._refresh_ui)

        env_status = juben_env_status(ROOT / "Juben")
        env_line = (
            f"Juben/.env：已就绪（{env_status.var_count} 项，启动 Juben 时自动注入）\n"
            if env_status.env_file_exists
            else "Juben/.env：未找到（可从 .env.example 复制；AI 需 DEEPSEEK_API_KEY）\n"
        )
        ai_line = (
            ""
            if env_status.has_deepseek_key
            else "AI 提示：未配置 DEEPSEEK_API_KEY，助手将返回 503；编辑 Juben/.env 后重启 Juben。\n"
        )
        self.log_panel.append_system(
            f"工作区：{ROOT}\n"
            f"{env_line}"
            f"{ai_line}"
            "ws_server 数据库连接以 server/ws_server.py / 环境变量 MONGO_URL 为准。\n"
            "Juben 就绪后访问 http://localhost:5173\n"
        )

        if self.config.get("auto_start"):
            self.after(1000, lambda: self.controller.start_all(self.monitor))

    def _build_layout(self) -> None:
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(1, weight=1)
        self.grid_rowconfigure(2, minsize=LOG_MIN_HEIGHT)

        # 顶栏
        header = ctk.CTkFrame(self, corner_radius=0, height=48)
        header.grid(row=0, column=0, sticky="ew")
        header.grid_propagate(False)

        ctk.CTkLabel(header, text="机甲风暴 · 开发控制台", font=ctk.CTkFont(size=16, weight="bold")).pack(
            side="left", padx=12
        )

        for text, cmd in [
            ("全部启动", lambda: self.controller.start_all(self.monitor)),
            ("全部停止", self.controller.stop_all),
            ("清理端口", self.controller.cleanup_ports),
        ]:
            btn = ctk.CTkButton(header, text=text, width=88, height=30, command=cmd)
            btn.pack(side="left", padx=(0, 6), pady=8)
            self._service_btn_refs.append(btn)

        ctk.CTkLabel(header, textvariable=self._status_var, font=ctk.CTkFont(size=12)).pack(
            side="right", padx=12
        )

        # 主体：侧栏 + 内容
        body = ctk.CTkFrame(self, corner_radius=0, fg_color="transparent")
        body.grid(row=1, column=0, sticky="nsew")
        body.grid_columnconfigure(1, weight=1)
        body.grid_rowconfigure(0, weight=1)

        self.sidebar = Sidebar(
            body,
            on_nav=self._show_page,
            initial=self._current_page_name,
        )
        self.sidebar.grid(row=0, column=0, sticky="ns")

        self.content_host = ctk.CTkFrame(body, corner_radius=0)
        self.content_host.grid(row=0, column=1, sticky="nsew", padx=(0, 4), pady=4)
        self.content_host.grid_rowconfigure(0, weight=1)
        self.content_host.grid_columnconfigure(0, weight=1)

        self._init_pages()

        # 日志坞
        log_height = int(self.config.get("log_panel_height", 240))
        self.grid_rowconfigure(2, minsize=LOG_MIN_HEIGHT)
        self._log_row = 2
        self.log_panel = LogPanel(
            self,
            runtimes=self.controller.runtimes,
            system_log_q=self._system_log_q,
            max_lines=int(self.config.get("log_max_lines", 8000)),
            auto_scroll=bool(self.config.get("log_auto_scroll", True)),
            initial_tab=self.config.get("last_log_tab", "系统"),
        )
        self.log_panel.grid(row=2, column=0, sticky="nsew", padx=4, pady=(0, 4))
        self._set_log_height(log_height)

        footer = ctk.CTkFrame(self, corner_radius=0, height=28)
        footer.grid(row=3, column=0, sticky="ew")
        footer.grid_propagate(False)
        ctk.CTkLabel(footer, text=f"根目录: {ROOT}", font=ctk.CTkFont(size=11), text_color="gray60").pack(
            side="left", padx=12, pady=4
        )

    def _init_page_factories(self) -> None:
        self._page_factories = {
            "总览": lambda: OverviewPage(self.content_host, self),
            "服务": lambda: ServicesPage(self.content_host, self),
            "文件夹": lambda: FoldersPage(self.content_host, self),
            "工具": lambda: ToolsPage(self.content_host, self),
            "端口": lambda: PortsPage(self.content_host, self),
            "设置": lambda: SettingsPage(self.content_host, self),
        }

    def _ensure_page(self, name: str):
        if name not in self._pages and name in self._page_factories:
            self._pages[name] = self._page_factories[name]()
        return self._pages.get(name)

    def _init_pages(self) -> None:
        self._init_page_factories()

    def _show_page(self, name: str) -> None:
        if name == self._current_page_name and self._current_page_widget is not None:
            self.sidebar.highlight(name)
            return

        if self._current_page_widget is not None:
            self._current_page_widget.pack_forget()

        self._current_page_name = name
        self.config["nav_page"] = name
        page = self._ensure_page(name)
        if page:
            page.pack(fill="both", expand=True)
            self._current_page_widget = page
            if hasattr(page, "on_show"):
                page.on_show()
            elif hasattr(page, "refresh"):
                page.refresh(force_scan=False) if name == "端口" else page.refresh()
        else:
            self._current_page_widget = None
        self.sidebar.highlight(name)
        self._last_snap_ts = 0.0

    def set_log_height(self, height: int) -> None:
        self._set_log_height(height)
        self.config["log_panel_height"] = height

    def _set_log_height(self, height: int) -> None:
        h = max(LOG_MIN_HEIGHT, min(480, height))
        self.grid_rowconfigure(self._log_row, minsize=h)

    def persist_config(self) -> None:
        save_config(self.config)

    def _on_preflight_fail(self, _service_id: str, pf) -> None:
        self.after(0, lambda: messagebox.showerror("启动前检查", pf.message))

    def _on_busy_change(self, busy: bool, reason: str) -> None:
        def _apply() -> None:
            self._busy = busy
            self._status_var.set(reason)
            state = "disabled" if busy else "normal"
            for btn in self._service_btn_refs:
                btn.configure(state=state)

        self.after(0, _apply)

    def open_path(self, path: Path) -> None:
        open_path_in_explorer(path)

    def open_url(self, service_id: str, default_url: str) -> None:
        url = self.controller.service_url(service_id, default_url)
        webbrowser.open(url)

    def copy_url(self, service_id: str, default_url: str) -> None:
        url = self.controller.service_url(service_id, default_url)
        self.clipboard_clear()
        self.clipboard_append(url)
        self._status_var.set(f"已复制: {url}")

    def copy_text(self, text: str) -> None:
        self.clipboard_clear()
        self.clipboard_append(text)
        self._status_var.set("已复制到剪贴板")

    def _drain_logs(self) -> None:
        pending = self.log_panel.drain_queues()
        delay = 80 if pending else LOG_DRAIN_MS
        self.after(delay, self._drain_logs)

    def _refresh_ui(self) -> None:
        snap = self.monitor.get_snapshot()
        title = "机甲风暴 · 开发控制台"
        if snap.running_names:
            title += " · " + " · ".join(snap.running_names)
        if self.title() != title:
            self.title(title)

        page = self._current_page_widget
        if page and page.winfo_ismapped() and hasattr(page, "refresh") and snap.ts != self._last_snap_ts:
            if self._current_page_name == "端口":
                page.refresh(force_scan=False)
            elif self._current_page_name in ("总览", "服务"):
                page.refresh(snap=snap)
            else:
                page.refresh()
            self._last_snap_ts = snap.ts

        any_busy = self._busy or any(
            s.state in ("starting", "stopping") for s in snap.services.values()
        )
        delay = UI_REFRESH_ACTIVE_MS if any_busy else UI_REFRESH_IDLE_MS
        self.after(delay, self._refresh_ui)

    def _on_close(self) -> None:
        self.monitor.stop()
        self.config["geometry"] = self.geometry()
        self.config["last_log_tab"] = self.log_panel.get_current_tab()
        self.config["nav_page"] = self._current_page_name
        self.config["log_auto_scroll"] = self.log_panel.get_auto_scroll()
        save_config(self.config)
        self.destroy()


def main() -> int:
    app = DevLauncherApp()
    app.mainloop()
    return 0
