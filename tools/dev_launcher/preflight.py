"""启动前环境检查。"""
from __future__ import annotations

import shutil
from dataclasses import dataclass

from .services import ServiceDef


@dataclass(frozen=True)
class PreflightResult:
    ok: bool
    message: str


def check_service_preflight(svc: ServiceDef) -> PreflightResult:
    if svc.id == "juben":
        npm = shutil.which("npm.cmd") or shutil.which("npm")
        if not npm:
            return PreflightResult(False, "未在 PATH 中找到 npm。\n\n请安装 Node.js 后重试。")
        if not shutil.which("node"):
            return PreflightResult(False, "未在 PATH 中找到 node。\n\n请安装 Node.js 后重试。")
        node_modules = svc.cwd / "node_modules"
        if not node_modules.is_dir():
            return PreflightResult(
                False,
                f"未找到 Juben 依赖目录：\n{node_modules}\n\n请在 Juben 目录运行：\nnpm install",
            )
        return PreflightResult(True, "")

    if svc.id == "ws_server":
        script = svc.cwd / "ws_server.py"
        if not script.is_file():
            return PreflightResult(False, f"找不到 ws_server 脚本：\n{script}")
        return PreflightResult(True, "")

    if not svc.cwd.is_dir():
        return PreflightResult(False, f"工作目录不存在：\n{svc.cwd}")
    return PreflightResult(True, "")
