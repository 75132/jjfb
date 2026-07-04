"""过滤开发控制台启动时的无害控制台噪音（libpng / subprocess 缓冲警告）。"""
from __future__ import annotations

import sys
import warnings


class _FilteredStderr:
    __slots__ = ("_real",)

    def __init__(self, stream) -> None:
        self._real = stream

    def write(self, s: str) -> None:
        if "libpng warning:" in s and "iCCP" in s:
            return
        self._real.write(s)

    def flush(self) -> None:
        self._real.flush()

    def __getattr__(self, name: str):
        return getattr(self._real, name)


_installed = False


def install_console_filters() -> None:
    global _installed
    if _installed:
        return
    _installed = True

    if not isinstance(sys.stderr, _FilteredStderr):
        sys.stderr = _FilteredStderr(sys.stderr)

    warnings.filterwarnings(
        "ignore",
        message=r".*line buffering \(buffering=1\) isn't supported in binary mode.*",
        category=RuntimeWarning,
    )
