"""后台服务状态监控（避免阻塞 Tk 主线程）。"""
from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

from .process_utils import (
    format_port_busy,
    pids_listening_on_ports,
    probe_health_checks,
    ports_ready_from_busy,
)

if TYPE_CHECKING:
    from .runtime import ServiceRuntime


@dataclass
class ServiceSnapshot:
    state: str = "stopped"
    label: str = "未启动"
    tooltip: str = ""
    detail: str = ""
    health_ok: bool = False


@dataclass
class StatusSnapshot:
    services: dict[str, ServiceSnapshot] = field(default_factory=dict)
    running_names: list[str] = field(default_factory=list)
    ts: float = 0.0


class StatusMonitor:
    """独立线程轮询端口/健康检查，主线程只读快照更新 UI。"""

    def __init__(self, runtimes: dict[str, "ServiceRuntime"], *, interval_sec: float = 3.0) -> None:
        self._runtimes = runtimes
        self._interval = interval_sec
        self._lock = threading.Lock()
        self._snapshot = StatusSnapshot()
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._stop.clear()
        self._thread = threading.Thread(target=self._loop, name="dev-launcher-status", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()

    def get_snapshot(self) -> StatusSnapshot:
        with self._lock:
            return StatusSnapshot(
                services={k: ServiceSnapshot(**vars(v)) for k, v in self._snapshot.services.items()},
                running_names=list(self._snapshot.running_names),
                ts=self._snapshot.ts,
            )

    def _loop(self) -> None:
        while not self._stop.is_set():
            try:
                snap = self._collect()
                with self._lock:
                    self._snapshot = snap
            except Exception:
                pass
            self._stop.wait(0.6 if any(rt.busy for rt in self._runtimes.values()) else self._interval)

    def _collect(self) -> StatusSnapshot:
        all_ports: set[int] = set()
        for rt in self._runtimes.values():
            all_ports.update(rt.service.ports)
        busy = pids_listening_on_ports(sorted(all_ports)) if all_ports else {}

        services: dict[str, ServiceSnapshot] = {}
        running_names: list[str] = []

        for sid, rt in self._runtimes.items():
            svc = rt.service
            proc_alive = rt.proc is not None and rt.proc.poll() is None
            partial_ports = any(p in busy for p in svc.ports)
            ports_all = ports_ready_from_busy(svc.ports, busy)

            health_ok = False
            health_reason = ""
            should_probe = rt.busy or proc_alive or any(p in busy for p in svc.ports)
            if should_probe and svc.health_checks:
                health_ok, health_reason = probe_health_checks(svc.health_checks, timeout=1.0)
                if health_ok and not ports_all:
                    health_ok = False
                    missing = [p for p in svc.ports if p not in busy]
                    health_reason = f"端口未监听: {', '.join(str(p) for p in missing)}"
            elif should_probe:
                health_ok = ports_all
                if not health_ok:
                    missing = [p for p in svc.ports if p not in busy]
                    health_reason = f"端口未监听: {', '.join(str(p) for p in missing)}"

            svc_busy = {p: busy[p] for p in svc.ports if p in busy}
            detail_parts: list[str] = []
            if proc_alive and rt.proc is not None:
                detail_parts.append(f"PID={rt.proc.pid}")
            elif rt.last_exit_code is not None:
                detail_parts.append(f"退出 code={rt.last_exit_code}")
            if svc_busy:
                detail_parts.append(format_port_busy(svc_busy))
            if rt.dynamic_url and svc.id == "juben":
                detail_parts.append(rt.dynamic_url)

            tooltip = health_reason or "无额外信息"

            op = rt.operation
            if op == "stopping":
                state, label = "stopping", "停止中…"
            elif op == "restarting":
                state, label = "starting", "重启中…"
            elif op == "starting" or rt.busy:
                state, label = "starting", "启动中…"
            elif rt.last_exit_code is not None and not proc_alive and not partial_ports:
                state, label = "exited", f"已退出 (code={rt.last_exit_code})"
            elif proc_alive and health_ok:
                state, label = "running", "运行中"
                running_names.append(svc.name)
            elif proc_alive and partial_ports:
                state = "partial"
                label = (health_reason or "部分就绪")[:40]
            elif partial_ports and not proc_alive:
                state = "partial"
                label = f"端口占用 {format_port_busy(svc_busy)}"[:40]
                tooltip = "可能为外部进程占用"
            else:
                state, label = "stopped", "未启动"

            services[sid] = ServiceSnapshot(
                state=state,
                label=label,
                tooltip=tooltip,
                detail=" · ".join(detail_parts),
                health_ok=health_ok,
            )

        return StatusSnapshot(services=services, running_names=running_names, ts=time.time())
