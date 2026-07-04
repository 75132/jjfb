"""开发控制台管理的服务与快捷入口定义。"""
from __future__ import annotations

import sys
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent


@dataclass(frozen=True)
class ServiceUrl:
    label: str
    url: str


@dataclass(frozen=True)
class HealthCheck:
    url: str
    require_ok: bool = True


@dataclass(frozen=True)
class ServiceDef:
    id: str
    name: str
    cwd: Path
    start_cmd: list[str]
    ports: list[int]
    urls: list[ServiceUrl] = field(default_factory=list)
    health_checks: list[HealthCheck] = field(default_factory=list)
    log_tab: str = ""
    shell: bool = False
    use_npm: bool = False
    notes: str = ""
    cleanup_ports: list[int] | None = None

    @property
    def primary_url(self) -> str | None:
        return self.urls[0].url if self.urls else None

    def ports_to_clean(self) -> list[int]:
        return self.cleanup_ports if self.cleanup_ports is not None else self.ports


@dataclass(frozen=True)
class FolderShortcut:
    label: str
    path: Path


@dataclass(frozen=True)
class FolderGroup:
    title: str
    items: tuple[FolderShortcut, ...]


@dataclass(frozen=True)
class ToolDef:
    id: str
    label: str
    script: Path
    cwd: Path
    requires_pillow: bool = False


DEFAULT_PORT_SPEC = "5173,8787,8001,8080-8081"

JUBEN_CLEANUP_PORTS = [5173, *range(5174, 5180), 8787]


def _python_exe() -> str:
    return sys.executable


SERVICES: list[ServiceDef] = [
    ServiceDef(
        id="juben",
        name="Juben 剧本编辑器",
        cwd=ROOT / "Juben",
        start_cmd=["npm", "run", "dev:full"],
        ports=[5173, 8787],
        urls=[
            ServiceUrl("编辑器", "http://localhost:5173"),
            ServiceUrl("Storage API", "http://localhost:8787/api/health"),
        ],
        health_checks=[
            HealthCheck("http://127.0.0.1:8787/api/health", require_ok=True),
            HealthCheck("http://127.0.0.1:5173/", require_ok=False),
        ],
        log_tab="Juben",
        use_npm=True,
        shell=True,
        cleanup_ports=JUBEN_CLEANUP_PORTS,
    ),
    ServiceDef(
        id="ws_server",
        name="游戏 ws_server",
        cwd=ROOT / "server",
        start_cmd=[_python_exe(), "ws_server.py"],
        ports=[8001, 8080],
        urls=[ServiceUrl("管理后台", "http://127.0.0.1:8080/")],
        health_checks=[HealthCheck("http://127.0.0.1:8080/", require_ok=False)],
        log_tab="ws_server",
        notes="MongoDB：使用 server/ws_server.py 默认远端库（或环境变量 MONGO_URL），控制台不会修改",
    ),
]

FOLDER_GROUPS: list[FolderGroup] = [
    FolderGroup(
        "Juben 剧本",
        (
            FolderShortcut("Juben 剧本工程", ROOT / "Juben"),
            FolderShortcut("Juben data", ROOT / "Juben" / "data"),
            FolderShortcut("Juben Map", ROOT / "Juben" / "Map"),
            FolderShortcut("Juben Npc", ROOT / "Juben" / "Npc"),
            FolderShortcut("AItools", ROOT / "Juben" / "AItools"),
        ),
    ),
    FolderGroup(
        "Cocos 游戏资源",
        (
            FolderShortcut("Cocos assets", ROOT / "assets"),
            FolderShortcut("剧情脚本 JSON", ROOT / "assets" / "resources" / "Sample" / "剧情脚本"),
            FolderShortcut("运行时 maps", ROOT / "assets" / "resources" / "maps"),
        ),
    ),
    FolderGroup(
        "服务端",
        (
            FolderShortcut("游戏 server", ROOT / "server"),
            FolderShortcut("logs", ROOT / "logs"),
        ),
    ),
    FolderGroup(
        "工程与其他",
        (
            FolderShortcut("仓库根目录", ROOT),
            FolderShortcut("tools 工具目录", ROOT / "tools"),
        ),
    ),
]

FOLDER_SHORTCUTS: list[FolderShortcut] = [item for group in FOLDER_GROUPS for item in group.items]

TOOLS: list[ToolDef] = [
    ToolDef(
        id="pack_cocos",
        label="Cocos 工程打包",
        script=ROOT / "tools" / "pack_cocos_project.py",
        cwd=ROOT,
    ),
    ToolDef(
        id="tilemap_viewer",
        label="Tilemap 坐标查看器",
        script=ROOT / "Juben" / "AItools" / "tilemap_coordinate_viewer.py",
        cwd=ROOT / "Juben" / "AItools",
        requires_pillow=True,
    ),
]

ALL_SERVICE_PORTS: list[int] = sorted({p for s in SERVICES for p in s.ports})
