"""服务运行时状态。"""
from __future__ import annotations

import queue
import subprocess
import threading
from dataclasses import dataclass, field

from .services import ServiceDef


@dataclass
class ServiceRuntime:
    service: ServiceDef
    proc: subprocess.Popen | None = None
    log_q: queue.Queue[str] = field(default_factory=queue.Queue)
    dynamic_url: str | None = None
    worker_lock: threading.Lock = field(default_factory=threading.Lock)
    busy: bool = False
    operation: str | None = None  # starting | stopping | restarting
    last_exit_code: int | None = None

    @property
    def log_tab(self) -> str:
        return self.service.log_tab or self.service.name
