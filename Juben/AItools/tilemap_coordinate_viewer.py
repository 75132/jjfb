"""
Tilemap + 剧情地图 JSON：48×48 格心；X 向右增大；Y 为逻辑坐标（向上为正），
往下每一格减 48（左上第一格格心 24,24，正下方一格为 24,-24）。画布仍为像素 Y 向下，内部换算。
"""
from __future__ import annotations

import json
import math
import sys
from dataclasses import dataclass
from pathlib import Path
from types import SimpleNamespace

try:
    from PIL import Image, ImageTk
except ImportError:
    print("需要安装 Pillow: pip install Pillow", file=sys.stderr)
    sys.exit(1)

import tkinter as tk
from tkinter import filedialog, messagebox, ttk

TILE = 48
ZOOM_MIN = 0.25
ZOOM_MAX = 8.0
ZOOM_STEP = 1.1
MARKER_HIT_PX = 22  # image-space radius for picking


def tile_tx_max(map_w: int) -> int:
    if map_w <= TILE // 2:
        return 0
    return max(0, (map_w - TILE // 2 - 1) // TILE)


def tile_ty_max(map_h: int) -> int:
    if map_h <= TILE // 2:
        return 0
    return max(0, (map_h - TILE // 2 - 1) // TILE)


def snap_image_xy_to_logical(ix: float, iy: float, map_w: int, map_h: int) -> tuple[int, int]:
    """像素 (向下为正) → 逻辑格心：lx=24+tx·48，ly=24−ty·48。"""
    imx = int(round(ix))
    imy = int(round(iy))
    imx = max(0, min(map_w - 1, imx))
    imy = max(0, min(map_h - 1, imy))
    tx = max(0, min(tile_tx_max(map_w), (imx - TILE // 2) // TILE))
    ty = max(0, min(tile_ty_max(map_h), (imy - TILE // 2) // TILE))
    lx = tx * TILE + TILE // 2
    ly = TILE // 2 - ty * TILE
    return lx, ly


def clamp_logical_xy(lx: int, ly: int, map_w: int, map_h: int) -> tuple[int, int]:
    tx = int(round((lx - TILE // 2) / TILE))
    ty = int(round((TILE // 2 - ly) / TILE))
    tx = max(0, min(tile_tx_max(map_w), tx))
    ty = max(0, min(tile_ty_max(map_h), ty))
    return tx * TILE + TILE // 2, TILE // 2 - ty * TILE


def logical_y_to_image_py(ly: int, map_h: int) -> int:
    ty = int(round((TILE // 2 - ly) / TILE))
    ty = max(0, min(tile_ty_max(map_h), ty))
    return ty * TILE + TILE // 2


def migrate_pixel_y_to_logical_y(y_pix: int, map_h: int) -> int:
    """旧 JSON：Y 为图像像素（上小下大）→ 逻辑 Y（上为大、下减 48）。已小于格心者视为已是逻辑 Y。"""
    ipy = int(y_pix)
    if ipy < TILE // 2:
        return ipy
    ipy = max(TILE // 2, min(map_h - 1, ipy))
    ty = (ipy - TILE // 2) // TILE
    ty = max(0, min(tile_ty_max(map_h), ty))
    return TILE // 2 - ty * TILE


def _resample_high_quality() -> int:
    return Image.Resampling.LANCZOS if hasattr(Image, "Resampling") else Image.LANCZOS  # type: ignore[attr-defined]


def script_dir() -> Path:
    return Path(__file__).resolve().parent


def default_map_path() -> Path:
    return script_dir() / "1.png"


def default_story_path() -> Path:
    return script_dir() / "Sample" / "剧情脚本" / "map_0_test_base_shared.json"


def _nav(root: dict, parts: tuple) -> dict:
    cur: object = root
    for p in parts:
        if isinstance(p, int):
            cur = cur[p]  # type: ignore[index]
        else:
            cur = cur[p]  # type: ignore[index]
    if not isinstance(cur, dict):
        raise TypeError(f"路径 {parts} 未指向对象")
    return cur


@dataclass
class MapPoint:
    pid: str
    kind: str
    label: str
    detail: str
    path_prefix: tuple
    x_key: str
    y_key: str
    draw_on_map: bool

    def read_xy(self, data: dict) -> tuple[int, int]:
        parent = _nav(data, self.path_prefix)
        return int(parent[self.x_key]), int(parent[self.y_key])

    def write_xy(self, data: dict, x: int, y: int) -> None:
        parent = _nav(data, self.path_prefix)
        parent[self.x_key] = int(x)
        parent[self.y_key] = int(y)


def collect_map_points(data: dict) -> list[MapPoint]:
    points: list[MapPoint] = []
    mid = int(data.get("mapId", -1))

    for i, npc in enumerate(data.get("npcs") or []):
        uid = str(npc.get("npcUid", f"npc_{i}"))
        points.append(
            MapPoint(
                pid=f"npc:{uid}",
                kind="NPC",
                label=str(npc.get("npcName", uid)),
                detail=uid,
                path_prefix=("npcs", i),
                x_key="x",
                y_key="y",
                draw_on_map=True,
            )
        )

    for bi, battle in enumerate(data.get("battles") or []):
        bid = battle.get("battleId", bi)
        server = battle.get("server") or {}
        client = battle.get("client") or {}
        disp = str(client.get("displayName") or battle.get("battleCode") or str(bid))
        for j, sp in enumerate(server.get("spawnPoints") or []):
            pid_sp = str(sp.get("pointId", j))
            points.append(
                MapPoint(
                    pid=f"spawn:{bid}:{pid_sp}",
                    kind="刷怪点",
                    label=pid_sp,
                    detail=disp,
                    path_prefix=("battles", bi, "server", "spawnPoints", j),
                    x_key="x",
                    y_key="y",
                    draw_on_map=True,
                )
            )

    for i, npc in enumerate(data.get("npcs") or []):
        uid = str(npc.get("npcUid", f"npc_{i}"))
        name = str(npc.get("npcName", uid))
        for ei, ev in enumerate(npc.get("events") or []):
            server = ev.get("server") or {}
            for eff_i, eff in enumerate(server.get("effects") or []):
                if eff.get("action") != "teleport":
                    continue
                to_map = eff.get("toMapId")
                draw = to_map == mid
                eid = str(ev.get("eventId", f"e{ei}"))
                points.append(
                    MapPoint(
                        pid=f"tp:{uid}:{eid}:{eff_i}",
                        kind="传送目标",
                        label=f"{name} / {eid}",
                        detail=f"toMapId={to_map}{'（本图）' if draw else '（其他图，仅列表）'}",
                        path_prefix=("npcs", i, "events", ei, "server", "effects", eff_i),
                        x_key="toX",
                        y_key="toY",
                        draw_on_map=draw,
                    )
                )

    return points


def parse_battle_ref(ref: object) -> int | None:
    if ref is None or not isinstance(ref, str):
        return None
    s = ref.strip()
    if not s.startswith("battle_"):
        return None
    tail = s[7:]
    try:
        return int(tail)
    except ValueError:
        return None


def npc_linked_battle_ids(npc: dict) -> list[int]:
    out: list[int] = []
    seen: set[int] = set()
    for ev in npc.get("events") or []:
        if ev.get("eventType") != "battle":
            continue
        server = ev.get("server") or {}
        bid = parse_battle_ref(server.get("battleRef"))
        if bid is not None and bid not in seen:
            seen.add(bid)
            out.append(bid)
    return out


class TilemapViewer(tk.Tk):
    def __init__(self, image_path: Path, story_path: Path | None = None) -> None:
        super().__init__()
        self.title("地图 + 剧情 JSON 编辑")
        self.minsize(720, 480)
        self.geometry("1200x760")

        self.image_path = image_path
        self._story_path: Path | None = None
        self._story_data: dict | None = None
        self._points: list[MapPoint] = []
        self._point_index: dict[str, MapPoint] = {}
        self._dirty = False

        self._pil_source: Image.Image | None = None
        self._photo: ImageTk.PhotoImage | None = None
        self._img_w = 0
        self._img_h = 0
        self._disp_w = 0
        self._disp_h = 0
        self._zoom = 1.0
        self._sel_tile_x = -1
        self._sel_tile_y = -1
        self._selection_rect: int | None = None

        self._b1_start: tuple[int, int] | None = None
        self._b1_moved = False
        self._drag_pid: str | None = None

        self._build_ui()

        sp = story_path if story_path is not None else default_story_path()
        self.story_path_var.set(str(sp) if sp.exists() else "")

        self._load_image()
        if sp.is_file():
            self._load_story_json(sp, show_error=False)

    def _build_ui(self) -> None:
        top = ttk.Frame(self, padding=4)
        top.pack(fill=tk.X)

        row1 = ttk.Frame(top)
        row1.pack(fill=tk.X)
        ttk.Label(row1, text="地图:").pack(side=tk.LEFT)
        self.path_var = tk.StringVar(value=str(self.image_path))
        ttk.Entry(row1, textvariable=self.path_var, width=42).pack(side=tk.LEFT, fill=tk.X, expand=True, padx=4)
        ttk.Button(row1, text="打开地图…", command=self._browse_map).pack(side=tk.LEFT)

        zoom_f = ttk.Frame(row1)
        zoom_f.pack(side=tk.LEFT, padx=(10, 0))
        ttk.Button(zoom_f, text="−", width=2, command=lambda: self._zoom_by_factor(1 / ZOOM_STEP)).pack(side=tk.LEFT, padx=1)
        self.zoom_var = tk.StringVar(value="100%")
        ttk.Label(zoom_f, textvariable=self.zoom_var, width=6).pack(side=tk.LEFT, padx=2)
        ttk.Button(zoom_f, text="+", width=2, command=lambda: self._zoom_by_factor(ZOOM_STEP)).pack(side=tk.LEFT, padx=1)
        ttk.Button(zoom_f, text="1:1", width=4, command=self._zoom_reset).pack(side=tk.LEFT, padx=4)

        row2 = ttk.Frame(top)
        row2.pack(fill=tk.X, pady=(4, 0))
        ttk.Label(row2, text="JSON:").pack(side=tk.LEFT)
        self.story_path_var = tk.StringVar(value="")
        ttk.Entry(row2, textvariable=self.story_path_var, width=42).pack(side=tk.LEFT, fill=tk.X, expand=True, padx=4)
        ttk.Button(row2, text="浏览…", command=self._browse_story).pack(side=tk.LEFT)
        ttk.Button(row2, text="加载", command=self._load_story_from_field).pack(side=tk.LEFT, padx=2)
        ttk.Button(row2, text="保存", command=self._save_story).pack(side=tk.LEFT, padx=2)
        ttk.Button(row2, text="另存为…", command=self._save_story_as).pack(side=tk.LEFT, padx=2)
        ttk.Button(row2, text="Y:像素→逻辑", command=self._migrate_all_y_from_pixel).pack(side=tk.LEFT, padx=(8, 0))

        info = ttk.Frame(self, padding=(4, 2))
        info.pack(fill=tk.X)
        self.info_var = tk.StringVar(value="")
        ttk.Label(info, textvariable=self.info_var, font=("Segoe UI", 9)).pack(anchor=tk.W)

        paned = ttk.Panedwindow(self, orient=tk.HORIZONTAL)
        paned.pack(fill=tk.BOTH, expand=True, padx=4, pady=(0, 4))

        left = ttk.Frame(paned)
        right = ttk.Frame(paned, width=360)
        paned.add(left, weight=4)
        paned.add(right, weight=1)

        outer = ttk.Frame(left)
        outer.pack(fill=tk.BOTH, expand=True)

        self.canvas = tk.Canvas(outer, highlightthickness=1, highlightbackground="#888")
        vsb = ttk.Scrollbar(outer, orient=tk.VERTICAL, command=self.canvas.yview)
        hsb = ttk.Scrollbar(outer, orient=tk.HORIZONTAL, command=self.canvas.xview)
        self.canvas.configure(yscrollcommand=vsb.set, xscrollcommand=hsb.set)
        self.canvas.grid(row=0, column=0, sticky="nsew")
        vsb.grid(row=0, column=1, sticky="ns")
        hsb.grid(row=1, column=0, sticky="ew")
        outer.rowconfigure(0, weight=1)
        outer.columnconfigure(0, weight=1)

        self.canvas.bind("<Configure>", self._on_canvas_configure)
        self.canvas.bind("<MouseWheel>", self._on_zoom_wheel)
        self.canvas.bind("<Button-4>", self._on_zoom_wheel)
        self.canvas.bind("<Button-5>", self._on_zoom_wheel)
        self.canvas.bind("<ButtonPress-2>", self._pan_start)
        self.canvas.bind("<B2-Motion>", self._pan_move)
        self.canvas.bind("<ButtonPress-3>", self._pan_start)
        self.canvas.bind("<B3-Motion>", self._pan_move)
        self.canvas.bind("<Enter>", lambda _e: self.canvas.focus_set())

        self.canvas.bind("<ButtonPress-1>", self._on_b1_press)
        self.canvas.bind("<B1-Motion>", self._on_b1_motion)
        self.canvas.bind("<ButtonRelease-1>", self._on_b1_release)

        self._build_right_panel(right)

    def _build_right_panel(self, parent: ttk.Frame) -> None:
        ttk.Label(parent, text="地图点位（按 NPC 与关联战斗）", font=("Segoe UI", 10, "bold")).pack(anchor=tk.W, pady=(0, 4))

        tree_frame = ttk.Frame(parent)
        tree_frame.pack(fill=tk.BOTH, expand=True)
        cols = ("kind", "x", "y")
        self._tree = ttk.Treeview(tree_frame, columns=cols, show="tree headings", selectmode="browse", height=18)
        self._tree.heading("#0", text="名称")
        self._tree.heading("kind", text="类型")
        self._tree.heading("x", text="X")
        self._tree.heading("y", text="Y")
        self._tree.column("#0", width=130, stretch=True)
        self._tree.column("kind", width=72, stretch=False)
        self._tree.column("x", width=48, stretch=False)
        self._tree.column("y", width=48, stretch=False)
        vs = ttk.Scrollbar(tree_frame, orient=tk.VERTICAL, command=self._tree.yview)
        self._tree.configure(yscrollcommand=vs.set)
        self._tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        vs.pack(side=tk.RIGHT, fill=tk.Y)
        self._tree.bind("<<TreeviewSelect>>", self._on_tree_select)

        edit = ttk.LabelFrame(parent, text="逻辑坐标（Y 向上为正，每下一格 Y−48）", padding=6)
        edit.pack(fill=tk.X, pady=8)
        gf = ttk.Frame(edit)
        gf.pack(fill=tk.X)
        ttk.Label(gf, text="X").grid(row=0, column=0, sticky=tk.W)
        self.x_var = tk.StringVar(value="")
        ttk.Entry(gf, textvariable=self.x_var, width=10).grid(row=0, column=1, padx=4)
        ttk.Label(gf, text="Y").grid(row=0, column=2, sticky=tk.W)
        self.y_var = tk.StringVar(value="")
        ttk.Entry(gf, textvariable=self.y_var, width=10).grid(row=0, column=3, padx=4)

        bf = ttk.Frame(edit)
        bf.pack(fill=tk.X, pady=(6, 0))
        ttk.Button(bf, text="写入 JSON", command=self._apply_xy_from_fields).pack(side=tk.LEFT)
        ttk.Button(bf, text="对齐格心", command=self._snap_selected_to_tile_center).pack(side=tk.LEFT, padx=6)

        hint = ttk.Label(
            parent,
            text="提示：JSON 中 Y 为逻辑值（左上格心 24,24，往下 24,−24,−72…）。旧数据点「Y:像素→逻辑」。\n"
            "列表按 NPC 剧情线分组；仅本图传送落点画在图上；中键/右键拖地图。",
            font=("Segoe UI", 8),
            foreground="#444",
            justify=tk.LEFT,
        )
        hint.pack(anchor=tk.W, pady=(8, 0))

    def _update_title_dirty(self) -> None:
        base = "地图 + 剧情 JSON 编辑"
        self.title(base + (" *" if self._dirty else ""))

    def _on_canvas_configure(self, _event: tk.Event) -> None:
        self._redraw_selection()
        self._draw_markers()

    def _pan_start(self, event: tk.Event) -> None:
        self.canvas.scan_mark(event.x, event.y)

    def _pan_move(self, event: tk.Event) -> None:
        self.canvas.scan_dragto(event.x, event.y, gain=1)

    def _wheel_delta(self, event: tk.Event) -> int:
        d = getattr(event, "delta", 0)
        if d:
            return d
        if event.num == 4:
            return 120
        if event.num == 5:
            return -120
        return 0

    def _on_zoom_wheel(self, event: tk.Event) -> None:
        d = self._wheel_delta(event)
        if d == 0:
            return
        z1 = self._zoom * ZOOM_STEP if d > 0 else self._zoom / ZOOM_STEP
        z1 = max(ZOOM_MIN, min(ZOOM_MAX, z1))
        self._apply_zoom(z1, anchor_event=event)

    def _viewport_center_anchor(self) -> SimpleNamespace:
        cx = max(0, self.canvas.winfo_width() // 2)
        cy = max(0, self.canvas.winfo_height() // 2)
        return SimpleNamespace(x=cx, y=cy)

    def _zoom_by_factor(self, mult: float) -> None:
        z1 = max(ZOOM_MIN, min(ZOOM_MAX, self._zoom * mult))
        self._apply_zoom(z1, anchor_event=self._viewport_center_anchor())

    def _zoom_reset(self) -> None:
        self._apply_zoom(1.0, anchor_event=self._viewport_center_anchor())

    def _apply_zoom(self, z1: float, anchor_event: SimpleNamespace | None) -> None:
        if self._pil_source is None:
            return
        z0 = self._zoom
        if abs(z1 - z0) < 1e-9:
            return

        left0 = top0 = mx = my = 0.0
        if anchor_event is not None:
            mx = self.canvas.canvasx(anchor_event.x)
            my = self.canvas.canvasy(anchor_event.y)
            left0 = self.canvas.canvasx(0)
            top0 = self.canvas.canvasy(0)

        self._zoom = z1
        self._rebuild_canvas_image()

        if anchor_event is not None and self._disp_w > 0 and self._disp_h > 0:
            new_left = left0 + mx * (z1 / z0 - 1)
            new_top = top0 + my * (z1 / z0 - 1)
            fx = new_left / self._disp_w
            fy = new_top / self._disp_h
            self.canvas.xview_moveto(max(0.0, min(1.0, fx)))
            self.canvas.yview_moveto(max(0.0, min(1.0, fy)))

        self.zoom_var.set(f"{int(round(self._zoom * 100))}%")
        self._refresh_info_line()

    def _browse_map(self) -> None:
        p = filedialog.askopenfilename(
            title="选择地图 PNG",
            filetypes=[("PNG", "*.png"), ("Images", "*.png;*.jpg;*.jpeg;*.gif;*.webp"), ("All", "*.*")],
        )
        if p:
            self.path_var.set(p)
            self.image_path = Path(p)
            self._load_image()

    def _browse_story(self) -> None:
        p = filedialog.askopenfilename(
            title="选择剧情地图 JSON",
            filetypes=[("JSON", "*.json"), ("All", "*.*")],
        )
        if p:
            self.story_path_var.set(p)
            self._load_story_json(Path(p))

    def _load_story_from_field(self) -> None:
        p = Path(self.story_path_var.get().strip())
        if not p.is_file():
            messagebox.showerror("错误", f"找不到 JSON:\n{p}")
            return
        self._load_story_json(p)

    def _load_story_json(self, path: Path, show_error: bool = True) -> None:
        try:
            text = path.read_text(encoding="utf-8")
            data = json.loads(text)
        except OSError as e:
            if show_error:
                messagebox.showerror("错误", f"无法读取:\n{e}")
            return
        except json.JSONDecodeError as e:
            if show_error:
                messagebox.showerror("错误", f"JSON 无效:\n{e}")
            return

        if not isinstance(data, dict):
            if show_error:
                messagebox.showerror("错误", "根节点必须是对象")
            return

        self._story_path = path
        self.story_path_var.set(str(path))
        self._story_data = data
        self._points = collect_map_points(data)
        self._point_index = {p.pid: p for p in self._points}
        self._dirty = False
        self._update_title_dirty()
        self._rebuild_tree()
        self._draw_markers()
        self._refresh_info_line()

    def _rebuild_tree(self) -> None:
        for item in self._tree.get_children():
            self._tree.delete(item)
        if self._story_data is None:
            return
        d = self._story_data
        npcs = d.get("npcs") or []
        battles = d.get("battles") or []

        battle_meta: dict[int, tuple[int, dict]] = {}
        for bi, battle in enumerate(battles):
            bid = int(battle.get("battleId", bi))
            battle_meta[bid] = (bi, battle)

        claimed_battles: set[int] = set()
        teleports_placed: set[str] = set()

        for npc in npcs:
            uid = str(npc.get("npcUid", ""))
            name = str(npc.get("npcName", uid))
            line_id = f"grp:line:{uid}"
            self._tree.insert("", tk.END, iid=line_id, text=name, values=("剧情线", "", ""), open=True)

            pid_npc = f"npc:{uid}"
            if pid_npc in self._point_index:
                p = self._point_index[pid_npc]
                x, y = p.read_xy(d)
                self._tree.insert(line_id, tk.END, iid=p.pid, text="角色站位", values=(p.kind, x, y))

            for bid in npc_linked_battle_ids(npc):
                if bid not in battle_meta:
                    continue
                claimed_battles.add(bid)
                _bi, battle = battle_meta[bid]
                client = battle.get("client") or {}
                disp = str(client.get("displayName") or battle.get("battleCode") or str(bid))
                bgrp = f"grp:line:{uid}:battle:{bid}"
                self._tree.insert(line_id, tk.END, iid=bgrp, text=f"战斗 · {disp}", values=("战斗", "", ""), open=True)
                prefix = f"spawn:{bid}:"
                for p in self._points:
                    if p.pid.startswith(prefix):
                        x, y = p.read_xy(d)
                        self._tree.insert(bgrp, tk.END, iid=p.pid, text=f"刷怪 · {p.label}", values=(p.kind, x, y))

            for p in self._points:
                if p.pid.startswith(f"tp:{uid}:"):
                    x, y = p.read_xy(d)
                    self._tree.insert(line_id, tk.END, iid=p.pid, text=p.label, values=(p.kind, x, y))
                    teleports_placed.add(p.pid)

        orphan_bids = [b.get("battleId", i) for i, b in enumerate(battles)]
        orphan_bids = [int(b) for b in orphan_bids if int(b) not in claimed_battles]
        if orphan_bids:
            orphan_root = self._tree.insert(
                "",
                tk.END,
                iid="grp:battles:orphan",
                text="未绑定 NPC 的战斗（JSON 中无 battleRef 指向）",
                values=("分组", "", ""),
                open=True,
            )
            for bid in orphan_bids:
                if bid not in battle_meta:
                    continue
                _bi, battle = battle_meta[bid]
                client = battle.get("client") or {}
                disp = str(client.get("displayName") or battle.get("battleCode") or str(bid))
                bgrp = f"grp:orphan:battle:{bid}"
                self._tree.insert(orphan_root, tk.END, iid=bgrp, text=f"战斗 · {disp}", values=("战斗", "", ""), open=True)
                prefix = f"spawn:{bid}:"
                for p in self._points:
                    if p.pid.startswith(prefix):
                        x, y = p.read_xy(d)
                        self._tree.insert(bgrp, tk.END, iid=p.pid, text=f"刷怪 · {p.label}", values=(p.kind, x, y))

        loose_tp = [p for p in self._points if p.pid.startswith("tp:") and p.pid not in teleports_placed]
        if loose_tp:
            self._tree.insert(
                "",
                tk.END,
                iid="grp:teleport:loose",
                text="传送落点（未归类）",
                values=("分组", "", ""),
                open=True,
            )
            for p in loose_tp:
                x, y = p.read_xy(d)
                self._tree.insert("grp:teleport:loose", tk.END, iid=p.pid, text=p.label, values=(p.kind, x, y))

    def _refresh_tree_row(self, pid: str) -> None:
        if self._story_data is None:
            return
        p = self._point_index.get(pid)
        if not p:
            return
        x, y = p.read_xy(self._story_data)
        if self._tree.exists(pid):
            self._tree.item(pid, values=(p.kind, x, y))

    def _on_tree_select(self, _event: tk.Event) -> None:
        sel = self._tree.selection()
        if not sel or self._story_data is None:
            return
        pid = sel[0]
        if str(pid).startswith("grp:"):
            self.x_var.set("")
            self.y_var.set("")
            self._draw_markers()
            return
        p = self._point_index.get(pid)
        if not p:
            return
        x, y = p.read_xy(self._story_data)
        self.x_var.set(str(x))
        self.y_var.set(str(y))
        self._draw_markers()

    def _apply_xy_from_fields(self) -> None:
        sel = self._tree.selection()
        if not sel or self._story_data is None:
            messagebox.showinfo("提示", "请先在列表中选择一项。")
            return
        pid = sel[0]
        if str(pid).startswith("grp:"):
            messagebox.showinfo("提示", "请展开分组并选择具体点位。")
            return
        p = self._point_index.get(pid)
        if not p:
            return
        try:
            x = int(self.x_var.get().strip())
            y = int(self.y_var.get().strip())
        except ValueError:
            messagebox.showerror("错误", "X / Y 须为整数")
            return
        sx, sy = clamp_logical_xy(x, y, self._img_w, self._img_h)
        self.x_var.set(str(sx))
        self.y_var.set(str(sy))
        p.write_xy(self._story_data, sx, sy)
        self._dirty = True
        self._update_title_dirty()
        self._refresh_tree_row(pid)
        self._draw_markers()
        self._refresh_info_line()

    def _snap_selected_to_tile_center(self) -> None:
        sel = self._tree.selection()
        if not sel or self._story_data is None:
            messagebox.showinfo("提示", "请先在列表中选择一项。")
            return
        pid = sel[0]
        if str(pid).startswith("grp:"):
            messagebox.showinfo("提示", "请展开分组并选择具体点位。")
            return
        p = self._point_index.get(pid)
        if not p:
            return
        x, y = p.read_xy(self._story_data)
        cx, cy = clamp_logical_xy(x, y, self._img_w, self._img_h)
        self.x_var.set(str(cx))
        self.y_var.set(str(cy))
        p.write_xy(self._story_data, cx, cy)
        self._dirty = True
        self._update_title_dirty()
        self._refresh_tree_row(pid)
        self._draw_markers()

    def _save_story(self) -> None:
        if self._story_data is None:
            messagebox.showinfo("提示", "没有已加载的 JSON。")
            return
        path = self._story_path
        if path is None or not path.parent.is_dir():
            self._save_story_as()
            return
        self._write_story_path(path)

    def _save_story_as(self) -> None:
        if self._story_data is None:
            messagebox.showinfo("提示", "没有已加载的 JSON。")
            return
        p = filedialog.asksaveasfilename(
            title="另存为 JSON",
            defaultextension=".json",
            filetypes=[("JSON", "*.json"), ("All", "*.*")],
        )
        if p:
            self._write_story_path(Path(p))

    def _write_story_path(self, path: Path) -> None:
        assert self._story_data is not None
        try:
            path.write_text(json.dumps(self._story_data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        except OSError as e:
            messagebox.showerror("错误", f"保存失败:\n{e}")
            return
        self._story_path = path
        self.story_path_var.set(str(path))
        self._dirty = False
        self._update_title_dirty()
        messagebox.showinfo("已保存", str(path))

    def _migrate_all_y_from_pixel(self) -> None:
        if self._story_data is None or not self._points:
            messagebox.showinfo("提示", "请先加载 JSON。")
            return
        h = self._img_h
        if h < TILE:
            messagebox.showerror("错误", "请先加载有效地图高度。")
            return
        if not messagebox.askyesno(
            "确认",
            "将当前 JSON 里所有点位的 Y 从「图像像素（上小下大）」\n"
            "转换为「逻辑 Y（上为大，每下一格减 48）」。\n\n"
            "依据当前已加载地图高度裁剪行号。是否继续？",
        ):
            return
        for p in self._points:
            x, y_pix = p.read_xy(self._story_data)
            y_log = migrate_pixel_y_to_logical_y(y_pix, h)
            p.write_xy(self._story_data, x, y_log)
        self._dirty = True
        self._update_title_dirty()
        self._rebuild_tree()
        self._draw_markers()
        self._refresh_info_line()
        sel = self._tree.selection()
        if sel and not str(sel[0]).startswith("grp:"):
            self._on_tree_select(tk.Event())
        messagebox.showinfo("完成", "已按当前地图高度转换全部 Y。请检查并保存 JSON。")

    def _load_image(self) -> None:
        path = Path(self.path_var.get().strip())
        if not path.is_file():
            messagebox.showerror("错误", f"找不到文件:\n{path}")
            return

        try:
            pil = Image.open(path).convert("RGBA")
        except OSError as e:
            messagebox.showerror("错误", f"无法打开图片:\n{e}")
            return

        self.image_path = path
        self._pil_source = pil
        self._img_w, self._img_h = pil.size
        self._zoom = 1.0
        self._sel_tile_x = -1
        self._sel_tile_y = -1
        self._selection_rect = None
        self.zoom_var.set("100%")

        self.canvas.delete("all")
        self._rebuild_canvas_image()
        self._refresh_info_line()

    def _rebuild_canvas_image(self) -> None:
        if self._pil_source is None:
            return

        z = self._zoom
        nw = max(1, int(round(self._img_w * z)))
        nh = max(1, int(round(self._img_h * z)))
        self._disp_w, self._disp_h = nw, nh

        resized = self._pil_source.resize((nw, nh), _resample_high_quality())
        self._photo = ImageTk.PhotoImage(resized)

        self.canvas.delete("map")
        self.canvas.delete("marker")
        self.canvas.delete("marker_label")
        if self._selection_rect is not None:
            self.canvas.delete(self._selection_rect)
            self._selection_rect = None

        self.canvas.create_image(0, 0, anchor=tk.NW, image=self._photo, tags=("map",))
        self.canvas.configure(scrollregion=(0, 0, nw, nh))
        self._redraw_selection()
        self._draw_markers()

    def _refresh_info_line(self) -> None:
        if self._pil_source is None:
            self.info_var.set("")
            return
        tiles_w = math.ceil(self._img_w / TILE)
        tiles_h = math.ceil(self._img_h / TILE)
        jname = ""
        if self._story_data is not None:
            mid = self._story_data.get("mapId", "?")
            mname = self._story_data.get("mapName", "")
            jname = f" | JSON mapId={mid} {mname}"
            if self._story_path:
                jname += f" | {self._story_path.name}"
        pts = len(self._points) if self._points else 0
        self.info_var.set(
            f"地图 {self._img_w}×{self._img_h} px · 格子约 {tiles_w}×{tiles_h} · 缩放 {int(round(self._zoom * 100))}%"
            f"{jname} · 点位 {pts} · 逻辑Y向上为正（JSON）"
        )

    def _img_xy_from_event(self, event: tk.Event) -> tuple[float, float]:
        z = self._zoom
        return self.canvas.canvasx(event.x) / z, self.canvas.canvasy(event.y) / z

    def _hit_test_point(self, ix: float, iy: float) -> str | None:
        if self._story_data is None:
            return None
        best: tuple[float, str | None] = (1e18, None)
        for p in self._points:
            if not p.draw_on_map:
                continue
            px, ly = p.read_xy(self._story_data)
            py_img = logical_y_to_image_py(ly, self._img_h)
            d = (ix - px) ** 2 + (iy - py_img) ** 2
            if d < MARKER_HIT_PX**2 and d < best[0]:
                best = (d, p.pid)
        return best[1]

    def _on_b1_press(self, event: tk.Event) -> None:
        if not self._photo or self._pil_source is None:
            return
        self._b1_start = (event.x, event.y)
        self._b1_moved = False
        ix, iy = self._img_xy_from_event(event)
        if ix < 0 or iy < 0 or ix >= self._img_w or iy >= self._img_h:
            self._drag_pid = None
            return
        pid = self._hit_test_point(ix, iy)
        self._drag_pid = pid
        if pid:
            self._tree.selection_set(pid)
            self._tree.see(pid)
            self._on_tree_select(tk.Event())

    def _on_b1_motion(self, event: tk.Event) -> None:
        if self._b1_start is None:
            return
        if (event.x - self._b1_start[0]) ** 2 + (event.y - self._b1_start[1]) ** 2 > 9:
            self._b1_moved = True
        if not self._drag_pid or self._story_data is None:
            return
        p = self._point_index.get(self._drag_pid)
        if not p:
            return
        ix, iy = self._img_xy_from_event(event)
        ix = max(0, min(self._img_w - 1, ix))
        iy = max(0, min(self._img_h - 1, iy))
        sx, sy = snap_image_xy_to_logical(ix, iy, self._img_w, self._img_h)
        p.write_xy(self._story_data, sx, sy)
        self._dirty = True
        self._update_title_dirty()
        self.x_var.set(str(sx))
        self.y_var.set(str(sy))
        self._refresh_tree_row(self._drag_pid)
        self._draw_markers()

    def _on_b1_release(self, event: tk.Event) -> None:
        if not self._photo or self._pil_source is None:
            self._b1_start = None
            self._drag_pid = None
            return
        ix, iy = self._img_xy_from_event(event)

        if self._drag_pid and self._b1_moved:
            self._refresh_info_line()
            self._b1_start = None
            self._drag_pid = None
            return

        if self._drag_pid and not self._b1_moved:
            self._b1_start = None
            self._drag_pid = None
            return

        # 空白处：格子选中
        if ix < 0 or iy < 0 or ix >= self._img_w or iy >= self._img_h:
            self._b1_start = None
            return

        z = self._zoom
        tx = int(ix // TILE)
        ty = int(iy // TILE)
        center_x = tx * TILE + TILE // 2
        center_y_log = TILE // 2 - ty * TILE
        self._sel_tile_x = tx
        self._sel_tile_y = ty
        self._redraw_selection()
        self.info_var.set(
            f"格子 tile=({tx},{ty})  |  逻辑格心=({center_x},{center_y_log})  |  "
            f"像素格心Y={ty * TILE + TILE // 2}（画布）  |  缩放 {int(round(z * 100))}%"
        )
        self._b1_start = None

    def _marker_style(self, kind: str) -> str:
        if kind == "NPC":
            return "#2563eb"
        if kind == "刷怪点":
            return "#ea580c"
        if kind == "传送目标":
            return "#9333ea"
        return "#64748b"

    def _draw_markers(self) -> None:
        self.canvas.delete("marker")
        self.canvas.delete("marker_label")
        if self._story_data is None or self._photo is None:
            return
        z = self._zoom
        sel = self._tree.selection()
        sel_pid = sel[0] if sel else None

        for p in self._points:
            if not p.draw_on_map:
                continue
            x, ly = p.read_xy(self._story_data)
            py_img = logical_y_to_image_py(ly, self._img_h)
            cx, cy = x * z, py_img * z
            color = self._marker_style(p.kind)
            r = max(5, int(round(8 * min(z, 2.0))))
            if p.pid == sel_pid:
                r = int(r * 1.35)
            self.canvas.create_oval(
                cx - r,
                cy - r,
                cx + r,
                cy + r,
                outline="#facc15" if p.pid == sel_pid else color,
                width=3 if p.pid == sel_pid else 2,
                fill=color if p.pid == sel_pid else "",
                tags=("marker",),
            )
            if p.pid == sel_pid:
                cap = p.label[:16]
                if p.kind == "刷怪点" and p.detail:
                    cap = f"{p.detail} · {p.label}"[:22]
                self.canvas.create_text(
                    cx,
                    cy - r - 10,
                    text=cap,
                    fill="#111",
                    font=("Segoe UI", 9, "bold"),
                    tags=("marker_label",),
                )

        self.canvas.tag_raise("marker")
        self.canvas.tag_raise("marker_label")
        self.canvas.tag_raise("selection")

    def _redraw_selection(self) -> None:
        if self._selection_rect is not None:
            self.canvas.delete(self._selection_rect)
            self._selection_rect = None
        if self._sel_tile_x < 0 or self._photo is None:
            return
        z = self._zoom
        x0 = self._sel_tile_x * TILE * z
        y0 = self._sel_tile_y * TILE * z
        span = TILE * z
        self._selection_rect = self.canvas.create_rectangle(
            x0,
            y0,
            x0 + span,
            y0 + span,
            outline="#ffcc00",
            width=max(1, int(round(2 * min(z, 2)))),
            tags=("selection",),
        )
        self.canvas.tag_raise("selection")


def main() -> None:
    if len(sys.argv) > 1 and sys.argv[1] in ("-h", "--help"):
        print(
            "用法: py tilemap_coordinate_viewer.py [地图.png] [剧情.json]\n"
            f"坐标约定: tileSize={TILE}, origin=top-left, 与 Juben/src/editor/tilemap-coords.ts 一致",
        )
        sys.exit(0)

    map_path = Path(sys.argv[1]) if len(sys.argv) > 1 else default_map_path()
    story_arg = Path(sys.argv[2]) if len(sys.argv) > 2 else None

    if not map_path.is_file():
        print(
            f"错误：地图文件不存在或不是文件: {map_path}\n"
            "用法: py tilemap_coordinate_viewer.py [地图.png] [剧情.json]",
            file=sys.stderr,
        )
        sys.exit(2)

    if map_path.suffix.lower() not in (".png", ".jpg", ".jpeg", ".webp", ".bmp"):
        print(f"警告：不常见的图片扩展名 {map_path.suffix}，仍将尝试打开", file=sys.stderr)

    try:
        app = TilemapViewer(map_path, story_path=story_arg)
        app.mainloop()
    except OSError as e:
        print(f"无法打开地图: {e}", file=sys.stderr)
        sys.exit(3)


if __name__ == "__main__":
    main()
