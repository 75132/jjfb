"""进程与端口工具（从 Juben/dev_gui.py 提取，供开发控制台复用）。"""
from __future__ import annotations

import os
import queue
import re
import subprocess
import threading
import time
import urllib.error
import urllib.request
from typing import Callable, TYPE_CHECKING

if TYPE_CHECKING:
    from .services import HealthCheck, ServiceDef

_CREATE_NO_WINDOW = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
ANSI_RE = re.compile(r"\x1b\[[0-9;]*m")
VITE_LOCAL_RE = re.compile(r"http://localhost:(\d+)", re.I)


def run_netstat_once() -> list[str]:
    """合并 TCP/IPv6 监听表；仅 -p tcp 会漏掉 [::1]:port（Windows 上 Vite 默认 IPv6）。"""
    lines: list[str] = []
    seen: set[str] = set()
    for proto in ("tcp", "tcpv6"):
        cp = subprocess.run(
            ["netstat", "-ano", "-p", proto],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            creationflags=_CREATE_NO_WINDOW,
        )
        if cp.returncode != 0:
            continue
        for line in cp.stdout.splitlines():
            if line not in seen:
                seen.add(line)
                lines.append(line)
    if lines:
        return lines
    cp = subprocess.run(
        ["netstat", "-ano"],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        creationflags=_CREATE_NO_WINDOW,
    )
    if cp.returncode != 0:
        return []
    return cp.stdout.splitlines()


def pids_listening_on_ports(ports: list[int]) -> dict[int, list[int]]:
    if not ports:
        return {}
    wanted = set(ports)
    found: dict[int, list[int]] = {}
    for line in run_netstat_once():
        if "LISTENING" not in line:
            continue
        parts = line.split()
        if len(parts) < 5:
            continue
        local_addr = parts[1]
        if ":" not in local_addr:
            continue
        port_str = local_addr.rsplit(":", 1)[-1]
        try:
            port = int(port_str)
        except ValueError:
            continue
        if port not in wanted:
            continue
        try:
            pid = int(parts[-1])
        except ValueError:
            continue
        found.setdefault(port, []).append(pid)
    for port in found:
        found[port] = sorted(set(found[port]))
    return found


def kill_pid_tree(pid: int) -> bool:
    if pid <= 0:
        return False
    if os.name == "nt":
        cp = subprocess.run(
            ["taskkill", "/PID", str(pid), "/T", "/F"],
            capture_output=True,
            text=True,
            creationflags=_CREATE_NO_WINDOW,
        )
        return cp.returncode == 0
    try:
        os.kill(pid, 15)
        return True
    except OSError:
        return False


def kill_process_tree(pid: int) -> bool:
    return kill_pid_tree(pid)


def cleanup_ports(ports: list[int], *, retries: int = 2, pause_sec: float = 0.35) -> dict[int, list[int]]:
    killed: dict[int, list[int]] = {}
    for attempt in range(max(1, retries)):
        busy = pids_listening_on_ports(ports)
        if not busy:
            break
        for port, pids in busy.items():
            for pid in pids:
                if kill_pid_tree(pid):
                    killed.setdefault(port, [])
                    if pid not in killed[port]:
                        killed[port].append(pid)
        if attempt + 1 < retries:
            time.sleep(pause_sec)
    for port in killed:
        killed[port] = sorted(killed[port])
    return killed


def parse_port_spec(raw: str, default: list[int] | None = None) -> list[int]:
    raw = raw.strip()
    if not raw:
        return list(default or [])
    ports: list[int] = []
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            a, b = part.split("-", 1)
            try:
                start = int(a.strip())
                end = int(b.strip())
                if end < start:
                    start, end = end, start
                ports.extend(range(start, end + 1))
                continue
            except ValueError:
                pass
        try:
            ports.append(int(part))
        except ValueError:
            pass
    return sorted(set(ports))


def ports_ready(ports: list[int]) -> bool:
    if not ports:
        return False
    busy = pids_listening_on_ports(ports)
    return ports_ready_from_busy(ports, busy)


def ports_ready_from_busy(ports: list[int], busy: dict[int, list[int]]) -> bool:
    if not ports:
        return False
    return all(p in busy for p in ports)


def any_port_ready(ports: list[int]) -> bool:
    if not ports:
        return False
    busy = pids_listening_on_ports(ports)
    return any(p in busy for p in ports)


def decode_subprocess_bytes(raw: bytes) -> str:
    """Windows 子进程日志可能是 UTF-8 或 GBK，容错解码避免 reader 线程崩溃。"""
    if not raw:
        return ""
    if raw.startswith(b"\xef\xbb\xbf"):
        return raw[3:].decode("utf-8", errors="replace")
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError:
        pass
    for enc in ("gbk", "cp936"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    if os.name == "nt":
        try:
            import locale

            pref = locale.getpreferredencoding(False) or "mbcs"
            return raw.decode(pref, errors="replace")
        except (LookupError, UnicodeDecodeError, ValueError):
            pass
    return raw.decode("utf-8", errors="replace")


def start_stdout_reader(
    proc: subprocess.Popen,
    log_q: queue.Queue[str],
    *,
    on_line: Callable[[str], None] | None = None,
    on_exit: Callable[[], None] | None = None,
) -> threading.Thread:
    def _reader() -> None:
        try:
            stdout = proc.stdout
            if stdout is None:
                return
            for raw in iter(stdout.readline, b""):
                if not raw:
                    break
                line = decode_subprocess_bytes(raw)
                if on_line:
                    on_line(line)
                log_q.put(line)
        except Exception as exc:
            log_q.put(f"[控制台] 日志读取异常: {exc}\n")
        finally:
            if on_exit:
                on_exit()

    t = threading.Thread(target=_reader, daemon=True, name="stdout-reader")
    t.start()
    return t


def strip_ansi(text: str) -> str:
    return ANSI_RE.sub("", text)


def detect_vite_url(line: str) -> str | None:
    m = VITE_LOCAL_RE.search(strip_ansi(line))
    if not m:
        return None
    return f"http://localhost:{int(m.group(1))}"


def utf8_subprocess_env() -> dict[str, str]:
    """Windows 子进程 stdout 默认 GBK，piped 模式下 emoji 会 UnicodeEncodeError。"""
    env = os.environ.copy()
    env.setdefault("PYTHONIOENCODING", "utf-8")
    env.setdefault("PYTHONUTF8", "1")
    return env


def probe_http(url: str, timeout: float = 2.0) -> tuple[bool, int | None]:
    """探测 HTTP 端点。返回 (有响应, 状态码)。"""
    try:
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return True, resp.status
    except urllib.error.HTTPError as exc:
        return True, exc.code
    except (urllib.error.URLError, TimeoutError, OSError, ValueError):
        return False, None


def check_health(hc: "HealthCheck", timeout: float = 2.0) -> bool:
    ok, code = probe_http(hc.url, timeout=timeout)
    if not ok:
        return False
    if hc.require_ok:
        return code is not None and 200 <= code < 300
    return True


def probe_health_checks(checks: list["HealthCheck"], timeout: float = 1.0) -> tuple[bool, str]:
    for hc in checks:
        ok, code = probe_http(hc.url, timeout=timeout)
        if not ok:
            return False, f"{hc.url} 无响应"
        if hc.require_ok and not (code is not None and 200 <= code < 300):
            return False, f"{hc.url} HTTP {code}"
    return True, ""


def service_health_ready(svc: "ServiceDef", timeout: float = 2.0) -> tuple[bool, str]:
    if svc.health_checks:
        ok, reason = probe_health_checks(svc.health_checks, timeout=timeout)
        if not ok:
            return False, reason

    if ports_ready(svc.ports):
        return True, ""
    busy = pids_listening_on_ports(svc.ports)
    missing = [p for p in svc.ports if p not in busy]
    return False, f"端口未监听: {', '.join(str(p) for p in missing)}"


def format_port_busy(busy: dict[int, list[int]]) -> str:
    if not busy:
        return ""
    parts = []
    for port in sorted(busy):
        pids = busy[port]
        parts.append(f"{port}=PID{','.join(str(p) for p in pids)}")
    return ", ".join(parts)


def wait_service_ready(
    svc: "ServiceDef",
    *,
    proc: subprocess.Popen | None = None,
    timeout: float = 90.0,
    poll_sec: float = 0.5,
) -> tuple[bool, str]:
    """轮询直到端口 + health 就绪，或超时/进程退出。"""
    t0 = time.time()
    last_reason = ""
    while time.time() - t0 < timeout:
        if proc is not None and proc.poll() is not None:
            return False, f"进程已退出 (code={proc.returncode})"
        ready, reason = service_health_ready(svc, timeout=2.0)
        last_reason = reason
        if ready:
            return True, ""
        time.sleep(poll_sec)
    return False, last_reason or "等待就绪超时"
