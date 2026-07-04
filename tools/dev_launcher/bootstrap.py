"""开发控制台启动前环境准备（bat 或 python -m tools.dev_launcher 时自动执行）。"""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

from .env_utils import juben_env_status
from .services import ROOT

JUBEN = ROOT / "Juben"
REQUIREMENTS = Path(__file__).resolve().parent / "requirements.txt"


def _log(msg: str) -> None:
    print(msg, flush=True)


def ensure_launcher_deps() -> bool:
    try:
        import customtkinter  # noqa: F401

        return True
    except ImportError:
        _log("[bootstrap] 安装开发控制台依赖 (customtkinter)…")
        cp = subprocess.run(
            [sys.executable, "-m", "pip", "install", "-r", str(REQUIREMENTS)],
            cwd=str(ROOT),
        )
        if cp.returncode != 0:
            _log("[bootstrap] pip install 失败，请手动运行：")
            _log(f"  {sys.executable} -m pip install -r {REQUIREMENTS}")
            return False
        try:
            import customtkinter  # noqa: F401
        except ImportError:
            _log("[bootstrap] 依赖安装后仍无法 import customtkinter。")
            return False
        return True


def ensure_juben_dotenv() -> None:
    env_path = JUBEN / ".env"
    example = JUBEN / ".env.example"
    if env_path.is_file():
        return
    if not example.is_file():
        _log("[bootstrap] 提示：未找到 Juben/.env，AI 需手动配置 DEEPSEEK_API_KEY。")
        return
    shutil.copy2(example, env_path)
    _log("[bootstrap] 已从 .env.example 创建 Juben/.env（可按需编辑 API Key）。")


def ensure_juben_node_modules() -> bool:
    node_modules = JUBEN / "node_modules"
    if node_modules.is_dir():
        return True
    npm = shutil.which("npm.cmd") or shutil.which("npm")
    if not npm:
        _log("[bootstrap] 错误：Juben 依赖未安装且 PATH 中找不到 npm。")
        _log("[bootstrap] 请安装 Node.js LTS：https://nodejs.org/")
        return False
    _log("[bootstrap] Juben/node_modules 不存在，正在 npm install（首次较慢，请稍候）…")
    popen_kw: dict = {"cwd": str(JUBEN)}
    if os.name == "nt":
        cp = subprocess.run(f'"{npm}" install', shell=True, **popen_kw)
    else:
        cp = subprocess.run([npm, "install"], **popen_kw)
    if cp.returncode != 0:
        _log("[bootstrap] npm install 失败。可在 Juben 目录手动运行 npm install。")
        return False
    return True


def log_env_hints() -> None:
    status = juben_env_status(JUBEN)
    if status.env_file_exists:
        _log(f"[bootstrap] Juben/.env 就绪（{status.var_count} 项，启动 Juben 时自动注入）")
    if not status.has_deepseek_key:
        _log("[bootstrap] 提示：未配置 DEEPSEEK_API_KEY，Juben AI 助手将返回 503。")
        _log("[bootstrap]        编辑 Juben/.env 填入密钥后，在控制台重启 Juben 即可。")


def run_bootstrap(*, skip_npm: bool = False) -> int:
    _log("[bootstrap] 机甲风暴 · 开发控制台")
    if not ensure_launcher_deps():
        return 1
    ensure_juben_dotenv()
    if not skip_npm and not ensure_juben_node_modules():
        return 1
    log_env_hints()
    _log("[bootstrap] 环境就绪，正在打开界面…")
    return 0


if __name__ == "__main__":
    raise SystemExit(run_bootstrap())
