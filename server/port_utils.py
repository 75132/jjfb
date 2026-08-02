"""端口占用检查：只报告，不杀进程。"""
from __future__ import annotations

import socket
import subprocess
import sys
from dataclasses import dataclass
from typing import List, Optional


@dataclass(frozen=True)
class PortOccupant:
    port: int
    pid: Optional[str]
    detail: str = ""


def find_listening_pids(port: int) -> List[str]:
    """查找监听指定端口的 PID 列表（尽力而为，失败返回空列表）。"""
    pids: List[str] = []
    try:
        if sys.platform == "win32":
            result = subprocess.run(
                ["netstat", "-ano"],
                capture_output=True,
                text=True,
                encoding="gbk",
                errors="replace",
            )
            for line in result.stdout.split("\n"):
                if f":{port}" not in line or "LISTENING" not in line.upper():
                    continue
                parts = line.split()
                if len(parts) >= 5:
                    pid = parts[-1]
                    if pid.isdigit() and pid not in pids:
                        pids.append(pid)
        else:
            result = subprocess.run(
                ["lsof", "-ti", f":{port}"],
                capture_output=True,
                text=True,
            )
            if result.returncode == 0:
                for pid in result.stdout.strip().split():
                    if pid and pid not in pids:
                        pids.append(pid)
    except Exception:
        pass
    return pids


def is_port_in_use(host: str, port: int) -> bool:
    """检测端口是否已被占用。Windows 避免使用 SO_REUSEADDR 导致误判。"""
    # 1) 连接探测：已有进程在 LISTEN 时通常成功
    sock = None
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(0.5)
        result = sock.connect_ex(("127.0.0.1", port))
        if result == 0:
            return True
    except Exception:
        pass
    finally:
        if sock is not None:
            try:
                sock.close()
            except Exception:
                pass

    # 2) 独占绑定探测（不用 SO_REUSEADDR，Windows 上否则可能与占用端口“共享”）
    sock = None
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        if sys.platform == "win32" and hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        bind_host = "0.0.0.0" if host in ("0.0.0.0", "") else host
        sock.bind((bind_host, port))
        return False
    except OSError:
        return True
    finally:
        if sock is not None:
            try:
                sock.close()
            except Exception:
                pass


def check_port_available(host: str, port: int) -> Optional[PortOccupant]:
    """
    若端口可用返回 None；若占用返回 PortOccupant（含 PID，若能解析）。
    绝不强制结束占用进程。
    """
    if not is_port_in_use(host, port):
        return None
    pids = find_listening_pids(port)
    pid = pids[0] if pids else None
    detail = f"PIDs={','.join(pids)}" if pids else "未能解析 PID"
    return PortOccupant(port=port, pid=pid, detail=detail)
