import json
import os
import shutil
import sys
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

try:
    import tkinter as tk
    from tkinter import filedialog, messagebox
    from tkinter import ttk
except Exception as e:  # pragma: no cover
    tk = None  # type: ignore
    filedialog = None  # type: ignore
    messagebox = None  # type: ignore
    ttk = None  # type: ignore
    _tk_import_error = e


"""
Meta 备份/还原工具（可视化）

需求：
- 扫描 assets/ 目录下全部 .meta 文件
- 按原有目录结构备份一份
- 记录备份时间
- 支持：单选某个 .meta 还原、全部还原

备份目录结构（默认放到项目根目录下 .meta_backups）：
.meta_backups/
  2026-01-21_19-30-12/
    manifest.json
    assets/xxx.meta
    assets/xxx/yyy.meta
"""


BACKUP_ROOT_DIRNAME = ".meta_backups"
MANIFEST_NAME = "manifest.json"


@dataclass
class BackupSnapshot:
    name: str  # 目录名（时间戳）
    path: Path  # 备份目录
    created_at: str  # ISO 时间
    asset_meta_count: int


def _repo_root_from_script() -> Path:
    # tools/meta_backup_tool.py -> repo root
    return Path(__file__).resolve().parents[1]


def _assets_dir(repo_root: Path) -> Path:
    return repo_root / "assets"


def _backup_root(repo_root: Path) -> Path:
    return repo_root / BACKUP_ROOT_DIRNAME


def _now_snapshot_name() -> str:
    # Windows 兼容：避免 ":" 等非法字符
    return datetime.now().strftime("%Y-%m-%d_%H-%M-%S")


def _iter_meta_files(assets_dir: Path) -> List[Path]:
    if not assets_dir.exists():
        return []
    return [p for p in assets_dir.rglob("*.meta") if p.is_file()]


def _rel_to_repo(repo_root: Path, p: Path) -> str:
    return str(p.resolve().relative_to(repo_root.resolve())).replace("\\", "/")


def _ensure_dir(p: Path) -> None:
    p.mkdir(parents=True, exist_ok=True)


def _write_json(p: Path, obj: Dict) -> None:
    _ensure_dir(p.parent)
    p.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")


def _read_json(p: Path) -> Dict:
    return json.loads(p.read_text(encoding="utf-8"))


def create_backup(repo_root: Path) -> BackupSnapshot:
    assets_dir = _assets_dir(repo_root)
    meta_files = _iter_meta_files(assets_dir)

    backup_root = _backup_root(repo_root)
    _ensure_dir(backup_root)

    snap_name = _now_snapshot_name()
    snap_dir = backup_root / snap_name
    _ensure_dir(snap_dir)

    copied: List[str] = []
    for src in meta_files:
        rel = src.relative_to(repo_root)
        dst = snap_dir / rel
        _ensure_dir(dst.parent)
        shutil.copy2(src, dst)
        copied.append(str(rel).replace("\\", "/"))

    created_iso = datetime.now().isoformat(timespec="seconds")
    manifest = {
        "schema_version": 1,
        "created_at": created_iso,
        "repo_root": str(repo_root.resolve()),
        "assets_dir": str(assets_dir.resolve()),
        "files": copied,
        "count": len(copied),
    }
    _write_json(snap_dir / MANIFEST_NAME, manifest)

    return BackupSnapshot(
        name=snap_name,
        path=snap_dir,
        created_at=created_iso,
        asset_meta_count=len(copied),
    )


def list_backups(repo_root: Path) -> List[BackupSnapshot]:
    backup_root = _backup_root(repo_root)
    if not backup_root.exists():
        return []

    snaps: List[BackupSnapshot] = []
    for p in sorted(backup_root.iterdir(), key=lambda x: x.name, reverse=True):
        if not p.is_dir():
            continue
        manifest_path = p / MANIFEST_NAME
        if not manifest_path.exists():
            continue
        try:
            m = _read_json(manifest_path)
            snaps.append(
                BackupSnapshot(
                    name=p.name,
                    path=p,
                    created_at=m.get("created_at", ""),
                    asset_meta_count=int(m.get("count", 0)),
                )
            )
        except Exception:
            # 跳过损坏的 manifest
            continue
    return snaps


def load_manifest(snapshot_dir: Path) -> Dict:
    return _read_json(snapshot_dir / MANIFEST_NAME)


def restore_all(repo_root: Path, snapshot_dir: Path) -> Tuple[int, List[str]]:
    """
    将 snapshot 中记录的 assets/*.meta 覆盖还原回 repo 中对应路径
    返回：(成功还原数量, 失败列表)
    """
    manifest = load_manifest(snapshot_dir)
    files: List[str] = manifest.get("files", []) or []
    failed: List[str] = []
    ok = 0

    for rel in files:
        src = snapshot_dir / rel
        dst = repo_root / rel
        try:
            if not src.exists():
                failed.append(rel + " (missing in backup)")
                continue
            _ensure_dir(dst.parent)
            shutil.copy2(src, dst)
            ok += 1
        except Exception as e:
            failed.append(f"{rel} ({e})")
    return ok, failed


def restore_folder(
    repo_root: Path,
    snapshot_dir: Path,
    rel_dir: str,
    manifest_files: List[str],
) -> Tuple[int, List[str]]:
    """
    还原某个文件夹下的所有 .meta（相对于仓库根目录的目录路径）
    """
    rel_dir = rel_dir.replace("\\", "/").strip("/")
    if rel_dir and not rel_dir.endswith("/"):
        rel_dir = rel_dir + "/"

    targets = [f for f in manifest_files if f.startswith(rel_dir)]
    failed: List[str] = []
    ok = 0
    for rel in targets:
        src = snapshot_dir / rel
        dst = repo_root / rel
        try:
            if not src.exists():
                failed.append(rel + " (missing in backup)")
                continue
            _ensure_dir(dst.parent)
            shutil.copy2(src, dst)
            ok += 1
        except Exception as e:
            failed.append(f"{rel} ({e})")
    return ok, failed


def restore_one(repo_root: Path, snapshot_dir: Path, rel_meta_path: str) -> Optional[str]:
    """
    还原单个 .meta
    - rel_meta_path：相对于 repo root 的路径（例如 assets/xxx.meta）
    返回：错误字符串（失败）或 None（成功）
    """
    rel_meta_path = rel_meta_path.replace("\\", "/").strip("/")
    src = snapshot_dir / rel_meta_path
    dst = repo_root / rel_meta_path
    if not src.exists():
        return f"备份中不存在该文件：{rel_meta_path}"
    try:
        _ensure_dir(dst.parent)
        shutil.copy2(src, dst)
        return None
    except Exception as e:
        return str(e)


class App:
    def __init__(self, repo_root: Path):
        if tk is None:
            raise RuntimeError(f"无法导入 tkinter：{_tk_import_error}")

        self.repo_root = repo_root
        self.root = tk.Tk()
        self.root.title("Assets .meta 备份/还原工具")
        self.root.geometry("980x620")

        self.snapshots: List[BackupSnapshot] = []
        self.current_snapshot: Optional[BackupSnapshot] = None
        self.current_manifest: Optional[Dict] = None

        self._build_ui()
        self.refresh_snapshots()

    def _build_ui(self) -> None:
        top = tk.Frame(self.root)
        top.pack(fill=tk.X, padx=10, pady=10)

        tk.Label(top, text=f"仓库根目录：{self.repo_root}").pack(anchor="w")

        btns = tk.Frame(top)
        btns.pack(fill=tk.X, pady=(8, 0))

        self.btn_backup = tk.Button(btns, text="一键备份 assets 下所有 .meta", command=self.on_backup)
        self.btn_backup.pack(side=tk.LEFT)

        self.btn_refresh = tk.Button(btns, text="刷新备份列表", command=self.refresh_snapshots)
        self.btn_refresh.pack(side=tk.LEFT, padx=(8, 0))

        mid = tk.PanedWindow(self.root, orient=tk.HORIZONTAL, sashrelief=tk.RAISED)
        mid.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

        # 左：备份列表
        left = tk.Frame(mid)
        mid.add(left, width=360)

        tk.Label(left, text="备份列表（按时间倒序）").pack(anchor="w")
        self.list_snapshots = tk.Listbox(left, height=18)
        self.list_snapshots.pack(fill=tk.BOTH, expand=True)
        self.list_snapshots.bind("<<ListboxSelect>>", self.on_select_snapshot)

        # 右：文件列表 + 操作
        right = tk.Frame(mid)
        mid.add(right)

        header = tk.Frame(right)
        header.pack(fill=tk.X)
        self.lbl_snapshot_info = tk.Label(header, text="未选择备份")
        self.lbl_snapshot_info.pack(anchor="w")

        ops = tk.Frame(right)
        ops.pack(fill=tk.X, pady=(8, 8))
        self.btn_restore_all = tk.Button(ops, text="全部还原（覆盖）", command=self.on_restore_all, state=tk.DISABLED)
        self.btn_restore_all.pack(side=tk.LEFT)
        self.btn_pick_one = tk.Button(ops, text="选择一个 .meta 还原", command=self.on_pick_one, state=tk.DISABLED)
        self.btn_pick_one.pack(side=tk.LEFT, padx=(8, 0))
        self.btn_restore_selected = tk.Button(
            ops, text="还原当前选中的 .meta", command=self.on_restore_selected, state=tk.DISABLED
        )
        self.btn_restore_selected.pack(side=tk.LEFT, padx=(8, 0))

        tk.Label(right, text="该备份包含的 .meta 文件（可展开）：").pack(anchor="w")

        tree_wrap = tk.Frame(right)
        tree_wrap.pack(fill=tk.BOTH, expand=True)

        # Treeview：像 Windows 一样按目录层级展开
        self.tree_files = ttk.Treeview(tree_wrap, show="tree")
        self.tree_files.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        tree_scroll = ttk.Scrollbar(tree_wrap, orient="vertical", command=self.tree_files.yview)
        tree_scroll.pack(side=tk.RIGHT, fill=tk.Y)
        self.tree_files.configure(yscrollcommand=tree_scroll.set)

        self.tree_files.bind("<<TreeviewSelect>>", self.on_select_file_node)

        bottom = tk.Frame(self.root)
        bottom.pack(fill=tk.X, padx=10, pady=(0, 10))
        self.txt_status = tk.Text(bottom, height=6)
        self.txt_status.pack(fill=tk.BOTH, expand=False)
        self._log("就绪。")

    def _log(self, msg: str) -> None:
        ts = time.strftime("%H:%M:%S")
        self.txt_status.insert("end", f"[{ts}] {msg}\n")
        self.txt_status.see("end")

    def refresh_snapshots(self) -> None:
        self.snapshots = list_backups(self.repo_root)
        self.list_snapshots.delete(0, "end")
        for s in self.snapshots:
            self.list_snapshots.insert("end", f"{s.name}  ({s.asset_meta_count} files)")
        self.current_snapshot = None
        self.current_manifest = None

        # 清空右侧树（如果已经初始化）
        if hasattr(self, "tree_files"):
            for item in self.tree_files.get_children(""):
                self.tree_files.delete(item)

        self.lbl_snapshot_info.config(text="未选择备份")
        self.btn_restore_all.config(state=tk.DISABLED)
        self.btn_pick_one.config(state=tk.DISABLED)
        self.btn_restore_selected.config(state=tk.DISABLED)
        self._log(f"已刷新备份列表，共 {len(self.snapshots)} 个。")

    def on_backup(self) -> None:
        assets_dir = _assets_dir(self.repo_root)
        if not assets_dir.exists():
            messagebox.showerror("错误", f"未找到 assets 目录：{assets_dir}")
            return
        if not messagebox.askyesno("确认", "将备份 assets 下所有 .meta 文件，继续？"):
            return
        snap = create_backup(self.repo_root)
        self._log(f"✅ 备份完成：{snap.name}，共 {snap.asset_meta_count} 个 .meta")
        self.refresh_snapshots()

    def on_select_snapshot(self, _evt=None) -> None:
        sel = self.list_snapshots.curselection()
        if not sel:
            return
        idx = int(sel[0])
        self.current_snapshot = self.snapshots[idx]
        try:
            self.current_manifest = load_manifest(self.current_snapshot.path)
        except Exception as e:
            self.current_manifest = None
            messagebox.showerror("错误", f"读取 manifest 失败：{e}")
            return

        # 重建右侧树
        for item in self.tree_files.get_children(""):
            self.tree_files.delete(item)

        files: List[str] = (self.current_manifest or {}).get("files", []) or []
        self._populate_tree(files)

        info = f"当前备份：{self.current_snapshot.name}  创建时间：{self.current_snapshot.created_at}  文件数：{len(files)}"
        self.lbl_snapshot_info.config(text=info)
        self.btn_restore_all.config(state=tk.NORMAL)
        self.btn_pick_one.config(state=tk.NORMAL)
        # 只有选中具体文件节点才启用
        self.btn_restore_selected.config(state=tk.DISABLED)
        self._log(f"已选择备份：{self.current_snapshot.name}")

    def _populate_tree(self, rel_files: List[str]) -> None:
        """
        把 manifest 里的 rel path 列表构建成目录树。
        - 目录节点 iid: "d|<path>"
        - 文件节点 iid: "f|<path>"
        """
        # 映射：父路径 -> tree iid
        dir_iids: Dict[str, str] = {"": ""}  # 根

        def ensure_dir(path: str) -> str:
            path = path.strip("/")
            if path in dir_iids:
                return dir_iids[path]
            parent = "/".join(path.split("/")[:-1])
            parent_iid = ensure_dir(parent) if parent != "" else ""
            name = path.split("/")[-1]
            iid = f"d|{path}"
            # 插入目录节点（可展开），前缀一个图标方便识别
            label = f"📁 {name}" if name else "assets"
            self.tree_files.insert(parent_iid, "end", iid=iid, text=label, open=False)
            dir_iids[path] = iid
            return iid

        # 先确保 assets 作为根目录节点（更像 Windows）
        ensure_dir("assets")

        for rel in sorted(rel_files):
            rel = rel.replace("\\", "/").strip("/")
            parts = rel.split("/")
            if len(parts) <= 1:
                # e.g. "assets.meta" 这种也放到根
                parent_iid = ""
            else:
                parent_dir = "/".join(parts[:-1])
                parent_iid = ensure_dir(parent_dir)
            file_name = parts[-1]
            file_iid = f"f|{rel}"
            # 文件节点，前缀文件图标
            label = f"📄 {file_name}"
            self.tree_files.insert(parent_iid, "end", iid=file_iid, text=label, open=False)

        # 默认展开 assets 目录
        try:
            self.tree_files.item("d|assets", open=True)
        except Exception:
            pass

    def on_select_file_node(self, _evt=None) -> None:
        """
        选中节点时：
        - 只有文件节点(f|...)才允许“还原当前选中的 .meta”
        """
        sel = self.tree_files.selection()
        if not sel:
            self.btn_restore_selected.config(state=tk.DISABLED)
            return
        iid = sel[0]
        if str(iid).startswith("f|"):
            self.btn_restore_selected.config(state=tk.NORMAL)
        else:
            self.btn_restore_selected.config(state=tk.DISABLED)

    def _require_snapshot(self) -> Optional[BackupSnapshot]:
        if not self.current_snapshot:
            messagebox.showwarning("提示", "请先选择一个备份。")
            return None
        return self.current_snapshot

    def on_restore_all(self) -> None:
        snap = self._require_snapshot()
        if not snap:
            return
        if not messagebox.askyesno("确认覆盖", "将覆盖还原该备份中的所有 .meta 文件，继续？"):
            return
        ok, failed = restore_all(self.repo_root, snap.path)
        self._log(f"✅ 全部还原完成：成功 {ok} 个")
        if failed:
            self._log(f"⚠️ 失败 {len(failed)} 个：")
            for f in failed[:50]:
                self._log(f" - {f}")
            if len(failed) > 50:
                self._log(" - ...（更多略）")
            messagebox.showwarning("部分失败", f"有 {len(failed)} 个文件还原失败，详见日志。")

    def on_restore_selected(self) -> None:
        snap = self._require_snapshot()
        if not snap:
            return
        sel = self.tree_files.selection()
        if not sel:
            messagebox.showwarning("提示", "请在右侧树中选择一个文件或文件夹。")
            return
        iid = str(sel[0])

        # 文件节点：还原单个 .meta
        if iid.startswith("f|"):
            rel = iid[2:]
            if not messagebox.askyesno("确认覆盖", f"将覆盖还原该文件：\n{rel}\n继续？"):
                return
            err = restore_one(self.repo_root, snap.path, rel)
            if err:
                self._log(f"❌ 单个还原失败：{rel}，原因：{err}")
                messagebox.showerror("失败", err)
            else:
                self._log(f"✅ 单个还原成功：{rel}")
            return

        # 文件夹节点：还原该目录下所有 .meta
        if iid.startswith("d|"):
            rel_dir = iid[2:]
            manifest_files: List[str] = (self.current_manifest or {}).get("files", []) or []
            targets = [f for f in manifest_files if f.startswith(rel_dir)]
            if not targets:
                messagebox.showinfo("提示", f"该目录下在此备份中没有记录的 .meta 文件：\n{rel_dir}")
                return
            if not messagebox.askyesno(
                "确认覆盖",
                f"将覆盖还原该目录下的 {len(targets)} 个 .meta 文件：\n{rel_dir}\n继续？",
            ):
                return
            ok, failed = restore_folder(self.repo_root, snap.path, rel_dir, manifest_files)
            self._log(f"✅ 目录还原完成：{rel_dir}，成功 {ok} 个")
            if failed:
                self._log(f"⚠️ 失败 {len(failed)} 个：")
                for f in failed[:50]:
                    self._log(f" - {f}")
                if len(failed) > 50:
                    self._log(" - ...（更多略）")
                messagebox.showwarning("部分失败", f"有 {len(failed)} 个文件还原失败，详见日志。")

    def on_pick_one(self) -> None:
        snap = self._require_snapshot()
        if not snap:
            return
        # 选择 repo 内任意一个 .meta 文件，自动转换为相对路径并尝试从备份中还原
        start_dir = str(_assets_dir(self.repo_root))
        chosen = filedialog.askopenfilename(
            title="选择要还原的 .meta 文件（repo 内）",
            initialdir=start_dir,
            filetypes=[("meta files", "*.meta")],
        )
        if not chosen:
            return
        chosen_path = Path(chosen).resolve()
        try:
            rel = _rel_to_repo(self.repo_root, chosen_path)
        except Exception:
            messagebox.showerror("错误", "请选择仓库内的 .meta 文件（在本仓库 assets 目录下）。")
            return
        if not messagebox.askyesno("确认覆盖", f"将覆盖还原该文件：\n{rel}\n继续？"):
            return
        err = restore_one(self.repo_root, snap.path, rel)
        if err:
            self._log(f"❌ 单个还原失败：{rel}，原因：{err}")
            messagebox.showerror("失败", err)
        else:
            self._log(f"✅ 单个还原成功：{rel}")

    def run(self) -> None:
        self.root.mainloop()


def main() -> int:
    repo_root = _repo_root_from_script()
    if not _assets_dir(repo_root).exists():
        # 允许通过参数指定 repo root
        if len(sys.argv) >= 2:
            repo_root = Path(sys.argv[1]).resolve()
        else:
            print("ERROR: 未找到 assets 目录。你可以传入仓库根目录作为参数：python tools/meta_backup_tool.py E:\\path\\to\\repo")
            return 2

    if tk is None:
        print(f"ERROR: tkinter 不可用：{_tk_import_error}")
        return 3

    App(repo_root).run()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

