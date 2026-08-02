"""
服务端集中配置：从环境变量读取并校验。

ENVIRONMENT=development|production
- development: 允许默认本机 MongoDB；ENCRYPTION_KEY 缺失时可生成临时密钥（仅开发）
- production: 缺少 MONGO_URL 或 ENCRYPTION_KEY 时拒绝启动；禁止自动生成密钥
"""
from __future__ import annotations

import os
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

# 开发环境默认本机 Mongo（无凭据）
_DEV_DEFAULT_MONGO_URL = "mongodb://127.0.0.1:27017/"


class ConfigError(ValueError):
    """配置无效，应拒绝启动。"""


@dataclass(frozen=True)
class ServerConfig:
    environment: str
    ws_host: str
    ws_port: int
    admin_host: str
    admin_port: int
    mongo_url: str
    encryption_key: str
    encryption_key_ephemeral: bool = False


def _load_dotenv_if_present() -> None:
    """若存在 server/.env，则加载（不覆盖已有环境变量）。"""
    env_path = Path(__file__).resolve().parent / ".env"
    if not env_path.is_file():
        return
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    load_dotenv(env_path, override=False)


def _normalize_environment(raw: Optional[str]) -> str:
    value = (raw or "development").strip().lower()
    if value in ("prod", "production"):
        return "production"
    if value in ("dev", "development", "local"):
        return "development"
    # 未知值按 production 严格处理，避免误放宽
    if value in ("staging", "test", "testing"):
        return value
    return value


def _parse_port(name: str, raw: Optional[str], default: int) -> int:
    text = (raw if raw is not None and str(raw).strip() != "" else str(default)).strip()
    try:
        port = int(text)
    except ValueError as exc:
        raise ConfigError(f"{name} 必须是整数端口，当前值: {raw!r}") from exc
    if not (1 <= port <= 65535):
        raise ConfigError(f"{name} 超出合法范围 1-65535: {port}")
    return port


def load_config(environ: Optional[dict] = None) -> ServerConfig:
    """
    读取并校验服务端配置。

    Args:
        environ: 可选，注入环境字典（测试用）；默认 os.environ。
    """
    if environ is None:
        _load_dotenv_if_present()
        env = os.environ
    else:
        env = environ

    environment = _normalize_environment(env.get("ENVIRONMENT"))
    is_production = environment == "production"

    ws_host = (env.get("WS_HOST") or "0.0.0.0").strip()
    ws_port = _parse_port("WS_PORT", env.get("WS_PORT"), 8001)
    admin_host = (env.get("ADMIN_HOST") or "127.0.0.1").strip()
    admin_port = _parse_port("ADMIN_PORT", env.get("ADMIN_PORT"), 8080)

    mongo_url = (env.get("MONGO_URL") or "").strip()
    encryption_key = (env.get("ENCRYPTION_KEY") or "").strip()
    encryption_key_ephemeral = False

    if is_production:
        missing = []
        if not mongo_url:
            missing.append("MONGO_URL")
        if not encryption_key:
            missing.append("ENCRYPTION_KEY")
        if missing:
            raise ConfigError(
                "production 环境缺少必填配置: "
                + ", ".join(missing)
                + "。请通过环境变量或 server/.env 提供，禁止使用内置默认凭据。"
            )
    else:
        if not mongo_url:
            mongo_url = _DEV_DEFAULT_MONGO_URL
        if not encryption_key:
            encryption_key = uuid.uuid4().hex
            encryption_key_ephemeral = True

    if not ws_host:
        raise ConfigError("WS_HOST 不能为空")
    if not admin_host:
        raise ConfigError("ADMIN_HOST 不能为空")
    if not mongo_url:
        raise ConfigError("MONGO_URL 不能为空")
    if not encryption_key:
        raise ConfigError("ENCRYPTION_KEY 不能为空")

    return ServerConfig(
        environment=environment,
        ws_host=ws_host,
        ws_port=ws_port,
        admin_host=admin_host,
        admin_port=admin_port,
        mongo_url=mongo_url,
        encryption_key=encryption_key,
        encryption_key_ephemeral=encryption_key_ephemeral,
    )


def redact_mongo_url(url: str) -> str:
    """日志用：隐藏连接串中的用户名与密码。"""
    if not url:
        return ""
    try:
        # mongodb://user:pass@host → mongodb://***:***@host
        if "://" not in url:
            return url
        scheme, rest = url.split("://", 1)
        if "@" in rest and ":" in rest.split("@", 1)[0]:
            creds, hostpart = rest.split("@", 1)
            return f"{scheme}://***:***@{hostpart}"
        return url
    except Exception:
        return "<redacted>"
