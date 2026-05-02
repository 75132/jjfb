#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Cocos Creator 工程打包工具（仅图形界面）。

使用标准库 tkinter，双击或用解释器运行本脚本即打开窗口。
若提示没有 tkinter：请用官方 Python 安装程序并勾选 tcl/tk 与 IDLE 后修复安装（不可 pip 安装）。

默认打进 zip：assets/、settings/、package.json、package-lock.json（若有）、tsconfig.json；
可选勾选 .creator、server、tools 等。不含 library/temp/build/node_modules/.git 等大目录。
"""

from __future__ import annotations

import sys
import threading
import zipfile
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# 常量
# ---------------------------------------------------------------------------

ROOT_FILES: tuple[str, ...] = ("package.json", "package-lock.json", "tsconfig.json")
SERVER_DIRS: tuple[str, ...] = ("server", "PomeloServer")
ZIP_COMPRESS_LEVEL = 6


def default_project_root() -> Path:
    return Path(__file__).resolve().parent.parent


def _zip_add_tree(
    zf: zipfile.ZipFile,
    base: Path,
    rel_root: Path,
    arc_prefix: str,
) -> int:
    if not base.exists():
        return 0
    n = 0
    for p in base.rglob("*"):
        if not p.is_file():
            continue
        rel = p.relative_to(rel_root)
        zf.write(p, arcname=f"{arc_prefix}/{rel.as_posix()}")
        n += 1
    return n


def _zip_add_file(
    zf: zipfile.ZipFile,
    path: Path,
    rel_root: Path,
    arc_prefix: str,
) -> bool:
    if not path.is_file():
        return False
    rel = path.relative_to(rel_root)
    arc = f"{arc_prefix}/{rel.as_posix()}" if arc_prefix else rel.as_posix()
    zf.write(path, arcname=arc)
    return True


@dataclass
class PackOptions:
    with_server: bool = False
    with_tools: bool = False
    with_extensions: bool = False
    with_gitignore: bool = False
    with_root_py: bool = False
    with_creator: bool = False
    with_meta_backups: bool = False
    with_cursor: bool = False
    with_profiles: bool = False


def _fill_zip(
    zf: zipfile.ZipFile,
    root: Path,
    prefix: str,
    options: PackOptions,
) -> int:
    total = 0
    total += _zip_add_tree(zf, root / "assets", root, prefix)
    total += _zip_add_tree(zf, root / "settings", root, prefix)

    for name in ROOT_FILES:
        if _zip_add_file(zf, root / name, root, prefix):
            total += 1

    if options.with_gitignore:
        if _zip_add_file(zf, root / ".gitignore", root, prefix):
            total += 1

    if options.with_root_py:
        for p in root.glob("*.py"):
            if _zip_add_file(zf, p, root, prefix):
                total += 1

    if options.with_tools:
        total += _zip_add_tree(zf, root / "tools", root, prefix)

    if options.with_server:
        for d in SERVER_DIRS:
            total += _zip_add_tree(zf, root / d, root, prefix)

    if options.with_extensions:
        total += _zip_add_tree(zf, root / "extensions", root, prefix)

    if options.with_creator:
        total += _zip_add_tree(zf, root / ".creator", root, prefix)
    if options.with_meta_backups:
        total += _zip_add_tree(zf, root / ".meta_backups", root, prefix)
    if options.with_cursor:
        total += _zip_add_tree(zf, root / ".cursor", root, prefix)
    if options.with_profiles:
        total += _zip_add_tree(zf, root / "profiles", root, prefix)

    return total


def pack_cocos_project(
    root: Path,
    out_dir: Path | None,
    zip_base_name: str | None,
    options: PackOptions,
) -> tuple[Path | None, int, str | None]:
    """成功返回 (zip_path, 文件数, None)；失败返回 (None, 0, 错误信息)。"""
    root = root.resolve()
    if not root.is_dir():
        return None, 0, f"工程根目录不存在：{root}"

    assets = root / "assets"
    settings = root / "settings"
    if not assets.is_dir() or not settings.is_dir():
        return None, 0, f"未找到 Cocos 结构（需要 assets/ 与 settings/）：{root}"

    out = (out_dir or (root / "dist_pack")).resolve()
    out.mkdir(parents=True, exist_ok=True)

    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    base = (zip_base_name or "").strip()
    if not base:
        base = f"{root.name}_cocos_{stamp}"
    zip_path = out / f"{base}.zip"
    prefix = root.name

    try:
        with zipfile.ZipFile(
            zip_path,
            "w",
            compression=zipfile.ZIP_DEFLATED,
            compresslevel=ZIP_COMPRESS_LEVEL,
        ) as zf:
            total = _fill_zip(zf, root, prefix, options)
        return zip_path, total, None
    except OSError as e:
        return None, 0, f"写入 zip 失败：{e}"


# ---------------------------------------------------------------------------
# 图形界面（tkinter）
# ---------------------------------------------------------------------------


class PackGui:
    """单列表单 + 分区 LabelFrame；打包在后台线程执行，避免卡死界面。"""

    def __init__(self) -> None:
        import tkinter as tk
        from tkinter import filedialog, messagebox, scrolledtext, ttk

        self._tk = tk
        self._filedialog = filedialog
        self._messagebox = messagebox
        self._scrolledtext = scrolledtext
        self._ttk = ttk

        self._root = tk.Tk()
        self._root.title("Cocos 工程打包")
        self._root.minsize(580, 600)
        self._root.geometry("680x620")

        self._var_root = tk.StringVar(value=str(default_project_root()))
        self._var_out = tk.StringVar(value="")
        self._var_name = tk.StringVar(value="")
        # 默认尽量「工程全量」；根目录 *.py 易杂，默认不勾
        self._v_creator = tk.BooleanVar(value=True)
        self._v_meta_backups = tk.BooleanVar(value=True)
        self._v_cursor = tk.BooleanVar(value=True)
        self._v_profiles = tk.BooleanVar(value=True)
        self._v_server = tk.BooleanVar(value=True)
        self._v_tools = tk.BooleanVar(value=True)
        self._v_ext = tk.BooleanVar(value=True)
        self._v_git = tk.BooleanVar(value=True)
        self._v_py = tk.BooleanVar(value=False)

        self._log: Any
        self._btn: Any

        self._build()
        self._root.columnconfigure(0, weight=1)
        self._root.rowconfigure(0, weight=1)

    def _build(self) -> None:
        ttk = self._ttk
        outer = ttk.Frame(self._root, padding=12)
        outer.grid(row=0, column=0, sticky="nsew")
        outer.columnconfigure(0, weight=1)
        r = 0

        lf1 = ttk.LabelFrame(outer, text="工程根目录（需含 assets、settings）", padding=8)
        lf1.grid(row=r, column=0, sticky="ew", pady=(0, 8))
        lf1.columnconfigure(0, weight=1)
        ttk.Entry(lf1, textvariable=self._var_root).grid(row=0, column=0, sticky="ew", padx=(0, 6))
        ttk.Button(lf1, text="浏览…", width=8, command=self._pick_root).grid(row=0, column=1)
        r += 1

        lf2 = ttk.LabelFrame(outer, text="输出", padding=8)
        lf2.grid(row=r, column=0, sticky="ew", pady=(0, 8))
        lf2.columnconfigure(0, weight=1)
        ttk.Label(lf2, text="zip 保存目录（留空则用工程下 dist_pack）").grid(
            row=0, column=0, columnspan=2, sticky="w",
        )
        ttk.Entry(lf2, textvariable=self._var_out).grid(row=1, column=0, sticky="ew", padx=(0, 6), pady=(4, 0))
        ttk.Button(lf2, text="浏览…", width=8, command=self._pick_out).grid(row=1, column=1, pady=(4, 0))
        ttk.Label(lf2, text="zip 主文件名（留空则自动加时间戳；不要写 .zip）").grid(
            row=2, column=0, columnspan=2, sticky="w", pady=(8, 0),
        )
        ttk.Entry(lf2, textvariable=self._var_name).grid(row=3, column=0, columnspan=2, sticky="ew", pady=(4, 0))
        r += 1

        lf3 = ttk.LabelFrame(outer, text="附加打入 zip（默认已尽量全选）", padding=8)
        lf3.grid(row=r, column=0, sticky="ew", pady=(0, 8))
        for c in range(3):
            lf3.columnconfigure(c, weight=1)
        checks = [
            (self._v_creator, ".creator/"),
            (self._v_meta_backups, ".meta_backups/"),
            (self._v_cursor, ".cursor/"),
            (self._v_profiles, "profiles/"),
            (self._v_server, "server / PomeloServer"),
            (self._v_tools, "tools/"),
            (self._v_ext, "extensions/"),
            (self._v_git, ".gitignore"),
            (self._v_py, "根目录 *.py"),
        ]
        for i, (var, text) in enumerate(checks):
            ttk.Checkbutton(lf3, text=text, variable=var).grid(
                row=i // 3,
                column=i % 3,
                sticky="w",
                padx=(0, 8),
                pady=2,
            )
        r += 1

        self._btn = ttk.Button(outer, text="开始打包", command=self._on_pack)
        self._btn.grid(row=r, column=0, sticky="ew", pady=(0, 8))
        r += 1

        lf4 = ttk.LabelFrame(outer, text="日志", padding=6)
        lf4.grid(row=r, column=0, sticky="nsew")
        lf4.columnconfigure(0, weight=1)
        lf4.rowconfigure(0, weight=1)
        outer.rowconfigure(r, weight=1)

        self._log = self._scrolledtext.ScrolledText(lf4, height=12, wrap="word")
        self._log.grid(row=0, column=0, sticky="nsew")
        self._append_log(
            "默认已含：assets、settings、package.json、package-lock.json（若有）、tsconfig.json\n"
            "未含：library / temp / build / node_modules / .git\n",
            clear=True,
        )

        foot = ttk.Label(
            outer,
            text="不含：library / temp / build / local / native / node_modules / .git",
            foreground="#666",
        )
        foot.grid(row=r + 1, column=0, sticky="w", pady=(6, 0))

    def _append_log(self, text: str, *, clear: bool = False) -> None:
        tk = self._tk
        self._log.configure(state="normal")
        if clear:
            self._log.delete("1.0", tk.END)
        self._log.insert(tk.END, text)
        self._log.see(tk.END)

    def _pick_root(self) -> None:
        cur = self._var_root.get().strip()
        initial = cur if cur and Path(cur).is_dir() else str(Path.home())
        p = self._filedialog.askdirectory(title="选择 Cocos 工程根目录", initialdir=initial)
        if p:
            self._var_root.set(p)

    def _pick_out(self) -> None:
        cur = self._var_out.get().strip()
        initial = cur if cur and Path(cur).is_dir() else str(Path.home())
        p = self._filedialog.askdirectory(title="选择 zip 输出目录", initialdir=initial)
        if p:
            self._var_out.set(p)

    def _on_pack(self) -> None:
        root_s = self._var_root.get().strip()
        if not root_s:
            self._messagebox.showwarning("提示", "请填写工程根目录。", parent=self._root)
            return

        self._btn.state(["disabled"])
        self._append_log("\n正在打包，请稍候…\n", clear=False)

        out_s = self._var_out.get().strip()
        name_s = self._var_name.get().strip()

        opts = PackOptions(
            with_server=self._v_server.get(),
            with_tools=self._v_tools.get(),
            with_extensions=self._v_ext.get(),
            with_gitignore=self._v_git.get(),
            with_root_py=self._v_py.get(),
            with_creator=self._v_creator.get(),
            with_meta_backups=self._v_meta_backups.get(),
            with_cursor=self._v_cursor.get(),
            with_profiles=self._v_profiles.get(),
        )

        def work() -> None:
            zp: Path | None = None
            total = 0
            err: str | None = None
            try:
                zp, total, err = pack_cocos_project(
                    Path(root_s),
                    Path(out_s) if out_s else None,
                    name_s or None,
                    opts,
                )
            except Exception as e:
                err = f"打包异常：{e}"

            def finish() -> None:
                self._btn.state(["!disabled"])
                if err:
                    self._append_log(f"\n失败：{err}\n", clear=False)
                    self._messagebox.showerror("打包失败", err, parent=self._root)
                else:
                    self._append_log(
                        f"\n完成：{zp}\n文件数：{total}\n",
                        clear=False,
                    )

            self._root.after(0, finish)

        threading.Thread(target=work, daemon=True).start()

    def run(self) -> None:
        self._root.mainloop()


if __name__ == "__main__":
    try:
        import tkinter  # noqa: F401
    except ImportError as e:
        print(
            "未找到 tkinter，无法打开图形界面。\n"
            "请使用 python.org 的 Windows 安装包，并勾选「tcl/tk and IDLE」后修复或重装 Python。\n"
            f"当前解释器：{sys.executable}",
            file=sys.stderr,
        )
        raise SystemExit(1) from e
    PackGui().run()
