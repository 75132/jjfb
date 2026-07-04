"""Juben .env 解析与注入子进程环境。"""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from .process_utils import utf8_subprocess_env


def parse_dotenv(path: Path) -> dict[str, str]:
    """解析 KEY=VALUE 格式 .env（不依赖 python-dotenv）。"""
    if not path.is_file():
        return {}
    result: dict[str, str] = {}
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return {}
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:].strip()
        if "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        if not key:
            continue
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'"):
            value = value[1:-1]
        result[key] = value
    return result


def merge_dotenv_into(base: dict[str, str], dotenv_path: Path) -> dict[str, str]:
    """将 .env 写入 env；已有系统/父进程变量不覆盖。"""
    merged = dict(base)
    for key, value in parse_dotenv(dotenv_path).items():
        merged.setdefault(key, value)
    return merged


def subprocess_env_for_service(service_id: str, cwd: Path) -> dict[str, str]:
    base = utf8_subprocess_env()
    if service_id == "juben":
        return merge_dotenv_into(base, cwd / ".env")
    return base


@dataclass(frozen=True)
class JubenEnvStatus:
    env_file_exists: bool
    loaded_from_file: bool
    var_count: int
    has_deepseek_key: bool


def juben_env_status(juben_dir: Path) -> JubenEnvStatus:
    env_path = juben_dir / ".env"
    exists = env_path.is_file()
    parsed = parse_dotenv(env_path) if exists else {}
    key = parsed.get("DEEPSEEK_API_KEY", "").strip() or os.environ.get("DEEPSEEK_API_KEY", "").strip()
    return JubenEnvStatus(
        env_file_exists=exists,
        loaded_from_file=exists and bool(parsed),
        var_count=len(parsed),
        has_deepseek_key=bool(key),
    )
