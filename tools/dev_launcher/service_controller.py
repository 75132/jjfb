"""服务启停编排（与 UI 解耦）。"""
from __future__ import annotations

import os
import queue
import shutil
import subprocess
import threading
import time
from collections.abc import Callable
from typing import TYPE_CHECKING

from .env_utils import subprocess_env_for_service
from .preflight import PreflightResult, check_service_preflight
from .process_utils import (
    cleanup_ports,
    detect_vite_url,
    format_port_busy,
    kill_process_tree,
    parse_port_spec,
    pids_listening_on_ports,
    start_stdout_reader,
    wait_service_ready,
)
from .runtime import ServiceRuntime
from .services import ALL_SERVICE_PORTS, SERVICES, ServiceDef

if TYPE_CHECKING:
    from .status_monitor import StatusMonitor


OnPreflightFail = Callable[[str, PreflightResult], None]
OnSystemLog = Callable[[str], None]
OnBusyChange = Callable[[bool, str], None]


class ServiceController:
    def __init__(
        self,
        *,
        system_log_q: queue.Queue[str] | None = None,
        on_preflight_fail: OnPreflightFail | None = None,
        on_system_log: OnSystemLog | None = None,
        on_busy_change: OnBusyChange | None = None,
    ) -> None:
        self._runtimes: dict[str, ServiceRuntime] = {
            s.id: ServiceRuntime(service=s) for s in SERVICES
        }
        self._global_lock = threading.Lock()
        self._system_log_q = system_log_q or queue.Queue()
        self._on_preflight_fail = on_preflight_fail
        self._on_system_log = on_system_log
        self._on_busy_change = on_busy_change
        self._port_spec = ALL_SERVICE_PORTS
        self._config: dict = {}

    @property
    def runtimes(self) -> dict[str, ServiceRuntime]:
        return self._runtimes

    def set_config(self, config: dict) -> None:
        self._config = config

    def set_port_spec(self, raw: str) -> None:
        parsed = parse_port_spec(raw, ALL_SERVICE_PORTS)
        self._port_spec = parsed if parsed else ALL_SERVICE_PORTS

    def parse_cleanup_ports(self) -> list[int]:
        return self._port_spec

    def _log_system(self, text: str) -> None:
        self._system_log_q.put(text)
        if self._on_system_log:
            self._on_system_log(text)

    def _set_busy(self, busy: bool, reason: str = "就绪") -> None:
        if self._on_busy_change:
            self._on_busy_change(busy, reason)

    def try_begin(self, reason: str) -> bool:
        if not self._global_lock.acquire(blocking=False):
            self._log_system(f"[控制台] 另有批量操作进行中，请稍候再试（{reason}）\n")
            return False
        self._set_busy(True, reason)
        return True

    def end(self, reason: str = "就绪") -> None:
        self._set_busy(False, reason)
        self._global_lock.release()

    def is_fully_ready(self, service_id: str, monitor: "StatusMonitor | None" = None) -> bool:
        if monitor is None:
            rt = self._runtimes.get(service_id)
            if not rt:
                return False
            return rt.proc is not None and rt.proc.poll() is None
        snap = monitor.get_snapshot()
        svc_snap = snap.services.get(service_id)
        return bool(svc_snap and svc_snap.health_ok)

    def _wait_ports_clear(self, ports: list[int], *, timeout: float = 10.0) -> bool:
        if not ports:
            return True
        deadline = time.time() + timeout
        while time.time() < deadline:
            if not pids_listening_on_ports(ports):
                return True
            time.sleep(0.25)
        cleanup_ports(ports, retries=2, pause_sec=0.35)
        time.sleep(0.3)
        return not pids_listening_on_ports(ports)

    def _begin_service_op(self, rt: ServiceRuntime, operation: str) -> bool:
        if not rt.worker_lock.acquire(blocking=False):
            rt.log_q.put(f"[控制台] {rt.service.name} 正在执行其它操作，请稍候\n")
            return False
        rt.busy = True
        rt.operation = operation
        return True

    def _end_service_op(self, rt: ServiceRuntime) -> None:
        rt.operation = None
        rt.busy = False
        rt.worker_lock.release()

    def start_service(self, service_id: str, *, wait_ready: bool = False) -> None:
        rt = self._runtimes.get(service_id)
        if not rt:
            return

        def _run() -> None:
            if not self._begin_service_op(rt, "starting"):
                return
            try:
                pf = check_service_preflight(rt.service)
                if not pf.ok:
                    rt.log_q.put(f"[控制台] 启动前检查失败: {pf.message}\n")
                    if self._on_preflight_fail:
                        self._on_preflight_fail(service_id, pf)
                    return
                self._start_worker(rt)
                if wait_ready:
                    ok, reason = wait_service_ready(rt.service, proc=rt.proc, timeout=90.0)
                    if not ok:
                        rt.log_q.put(f"[控制台] 等待就绪失败: {reason}\n")
                        self._log_system(f"[控制台] {rt.service.name} 未就绪: {reason}\n")
                    else:
                        rt.log_q.put(f"[控制台] {rt.service.name} 已就绪\n")
            finally:
                self._end_service_op(rt)

        threading.Thread(target=_run, daemon=True, name=f"start-{service_id}").start()

    def stop_service(self, service_id: str) -> None:
        rt = self._runtimes.get(service_id)
        if not rt:
            return

        def _run() -> None:
            if not self._begin_service_op(rt, "stopping"):
                return
            try:
                self._stop_worker(rt)
                ports = rt.service.ports_to_clean()
                if not self._wait_ports_clear(ports, timeout=8.0):
                    rt.log_q.put(f"[控制台] 警告：停止后端口仍占用 {ports}\n")
            finally:
                self._end_service_op(rt)

        threading.Thread(target=_run, daemon=True, name=f"stop-{service_id}").start()

    def restart_service(self, service_id: str) -> None:
        rt = self._runtimes.get(service_id)
        if not rt:
            return

        def _run() -> None:
            if not self._begin_service_op(rt, "restarting"):
                return
            try:
                pf = check_service_preflight(rt.service)
                if not pf.ok:
                    rt.log_q.put(f"[控制台] 重启前检查失败: {pf.message}\n")
                    if self._on_preflight_fail:
                        self._on_preflight_fail(service_id, pf)
                    return
                self._stop_worker(rt)
                ports = rt.service.ports_to_clean()
                if not self._wait_ports_clear(ports, timeout=12.0):
                    rt.log_q.put(f"[控制台] 警告：重启前端口未完全释放，继续尝试启动…\n")
                self._start_worker(rt)
                ok, reason = wait_service_ready(rt.service, proc=rt.proc, timeout=90.0)
                if ok:
                    rt.log_q.put(f"[控制台] {rt.service.name} 重启完成\n")
                else:
                    rt.log_q.put(f"[控制台] 重启后未就绪: {reason}\n")
                    self._log_system(f"[控制台] {rt.service.name} 重启未就绪: {reason}\n")
            finally:
                self._end_service_op(rt)

        threading.Thread(target=_run, daemon=True, name=f"restart-{service_id}").start()

    def start_all(self, monitor: "StatusMonitor | None" = None) -> None:
        if not self.try_begin("全部启动…"):
            return
        stop_on_failure = bool(self._config.get("stop_on_failure", False))
        auto_ids = self._config.get("auto_start_services", [s.id for s in SERVICES])

        def _run() -> None:
            try:
                for svc in SERVICES:
                    if svc.id not in auto_ids:
                        continue
                    rt = self._runtimes[svc.id]
                    if (
                        rt.proc is not None
                        and rt.proc.poll() is None
                        and self.is_fully_ready(svc.id, monitor)
                    ):
                        rt.log_q.put(f"[控制台] {svc.name} 已在运行，跳过\n")
                        continue
                    if not rt.worker_lock.acquire(blocking=True):
                        continue
                    rt.busy = True
                    rt.operation = "starting"
                    try:
                        pf = check_service_preflight(svc)
                        if not pf.ok:
                            rt.log_q.put(f"[控制台] 启动前检查失败: {pf.message}\n")
                            self._log_system(f"[控制台] {svc.name} 跳过: {pf.message}\n")
                            if stop_on_failure:
                                break
                            continue
                        self._start_worker(rt)
                        ok, reason = wait_service_ready(svc, proc=rt.proc, timeout=90.0)
                        if not ok:
                            self._log_system(f"[控制台] {svc.name} 未就绪: {reason}\n")
                            if stop_on_failure:
                                break
                    finally:
                        rt.operation = None
                        rt.busy = False
                        rt.worker_lock.release()
            finally:
                self.end("就绪")

        threading.Thread(target=_run, daemon=True).start()

    def stop_all(self) -> None:
        if not self.try_begin("全部停止…"):
            return

        def _run() -> None:
            try:
                for svc in reversed(SERVICES):
                    rt = self._runtimes[svc.id]
                    if not rt.worker_lock.acquire(blocking=True):
                        continue
                    rt.busy = True
                    rt.operation = "stopping"
                    try:
                        self._stop_worker(rt)
                        self._wait_ports_clear(svc.ports_to_clean(), timeout=6.0)
                    finally:
                        rt.operation = None
                        rt.busy = False
                        rt.worker_lock.release()
            finally:
                self.end("就绪")

        threading.Thread(target=_run, daemon=True).start()

    def cleanup_ports(self) -> None:
        if not self.try_begin("清理端口…"):
            return

        def _run() -> None:
            try:
                ports = self.parse_cleanup_ports()
                killed = cleanup_ports(ports, retries=3, pause_sec=0.4)
                self._log_system(f"[控制台] 端口清理结果: {killed if killed else '无占用'}\n")
            finally:
                self.end("就绪")

        threading.Thread(target=_run, daemon=True).start()

    def scan_ports(self, ports: list[int] | None = None) -> dict[int, list[int]]:
        target = ports if ports is not None else self.parse_cleanup_ports()
        return pids_listening_on_ports(target)

    def _start_worker(self, rt: ServiceRuntime) -> None:
        svc = rt.service
        service_ports = svc.ports_to_clean()
        rt.last_exit_code = None

        rt.log_q.put(f"[控制台] 清理端口 {service_ports}…\n")
        killed = cleanup_ports(service_ports, retries=5, pause_sec=0.45)
        if killed:
            rt.log_q.put(f"[控制台] 已清理: {killed}\n")

        time.sleep(0.35)
        busy = pids_listening_on_ports(service_ports)
        if busy:
            rt.log_q.put(f"[控制台] 警告：仍有端口占用 {format_port_busy(busy)}，再次尝试…\n")
            killed2 = cleanup_ports(list(busy.keys()), retries=3, pause_sec=0.5)
            if killed2:
                rt.log_q.put(f"[控制台] 二次清理: {killed2}\n")
            time.sleep(0.35)
            busy = pids_listening_on_ports([5173] if svc.id == "juben" else service_ports)
            if svc.id == "juben" and busy.get(5173):
                rt.log_q.put(
                    f"[控制台] 5173 仍被占用 {format_port_busy({5173: busy[5173]})}，"
                    "请手动结束 node.exe 或以管理员运行控制台\n"
                )

        service_env = subprocess_env_for_service(svc.id, svc.cwd)

        if svc.use_npm:
            npm = shutil.which("npm.cmd") or shutil.which("npm")
            if not npm:
                rt.log_q.put("[控制台] 错误：未找到 npm\n")
                return
            rt.dynamic_url = svc.primary_url
            if svc.id == "juben" and (svc.cwd / ".env").is_file():
                rt.log_q.put("[控制台] 已注入 Juben/.env 到子进程环境\n")
            popen_kw: dict = {
                "cwd": str(svc.cwd),
                "stdout": subprocess.PIPE,
                "stderr": subprocess.STDOUT,
                "shell": True,
                "env": service_env,
            }
            if os.name == "nt":
                popen_kw["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP  # type: ignore[attr-defined]
            cmd = f'"{npm}" run dev:full'
            rt.log_q.put(f"[控制台] 启动: {cmd}\n")
        else:
            popen_kw = {
                "cwd": str(svc.cwd),
                "stdout": subprocess.PIPE,
                "stderr": subprocess.STDOUT,
                "shell": False,
                "env": service_env,
            }
            if os.name == "nt":
                popen_kw["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP  # type: ignore[attr-defined]
            cmd = svc.start_cmd
            rt.log_q.put(f"[控制台] 启动: {' '.join(cmd)}\n")

        try:
            proc = subprocess.Popen(cmd, **popen_kw)
        except OSError as e:
            rt.log_q.put(f"[控制台] 启动失败: {e}\n")
            return

        rt.proc = proc

        def on_line(line: str) -> None:
            if svc.id == "juben":
                url = detect_vite_url(line)
                if url:
                    rt.dynamic_url = url

        def on_exit() -> None:
            code = proc.poll()
            rt.last_exit_code = code
            rt.log_q.put(f"\n[控制台] {svc.name} 子进程已退出 (code={code})。\n")
            rt.proc = None

        start_stdout_reader(proc, rt.log_q, on_line=on_line, on_exit=on_exit)

    def _stop_worker(self, rt: ServiceRuntime) -> None:
        svc = rt.service
        if rt.proc is not None and rt.proc.poll() is None:
            kill_process_tree(rt.proc.pid)
            t0 = time.time()
            while time.time() - t0 < 3.0:
                if rt.proc.poll() is not None:
                    rt.last_exit_code = rt.proc.returncode
                    break
                time.sleep(0.05)
            if rt.proc.poll() is None:
                try:
                    rt.proc.kill()
                except OSError:
                    pass
            elif rt.last_exit_code is None:
                rt.last_exit_code = rt.proc.returncode
        rt.proc = None
        time.sleep(0.35)
        service_ports = svc.ports_to_clean()
        killed = cleanup_ports(service_ports, retries=4, pause_sec=0.45)
        rt.log_q.put(f"[控制台] 已停止，端口清理: {killed if killed else '无占用'}\n")
        busy = pids_listening_on_ports([5173] if svc.id == "juben" else service_ports)
        if svc.id == "juben" and busy.get(5173):
            rt.log_q.put(
                f"[控制台] 5173 仍占用 {format_port_busy({5173: busy[5173]})}，"
                "可点「清理端口」或结束 node.exe\n"
            )

    def get_runtime(self, service_id: str) -> ServiceRuntime | None:
        return self._runtimes.get(service_id)

    def service_url(self, service_id: str, default_url: str) -> str:
        rt = self._runtimes.get(service_id)
        return (rt.dynamic_url if rt and rt.dynamic_url else None) or default_url
