#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
独立构建 Vue 管理台（admin-ui/dist）。

用法:
  python tools/build_admin_ui.py
  python tools/build_admin_ui.py --force

ws_server 启动时不再自动 npm ci / npm install / npm run build。
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys


def needs_rebuild(admin_ui_dir: str, dist_index: str, package_json: str) -> bool:
    if not os.path.isfile(dist_index):
        return True
    dist_mtime = os.path.getmtime(dist_index)
    if os.path.getmtime(package_json) > dist_mtime:
        return True
    src_dir = os.path.join(admin_ui_dir, "src")
    if os.path.isdir(src_dir):
        for root, _dirs, files in os.walk(src_dir):
            for name in files:
                fp = os.path.join(root, name)
                try:
                    if os.path.getmtime(fp) > dist_mtime:
                        return True
                except OSError:
                    pass
    return False


def build_admin_ui(force: bool = False) -> int:
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    admin_ui_dir = os.path.join(base_dir, "admin-ui")
    dist_dir = os.path.join(admin_ui_dir, "dist")
    dist_index = os.path.join(dist_dir, "index.html")
    package_json = os.path.join(admin_ui_dir, "package.json")

    if not os.path.isdir(admin_ui_dir) or not os.path.isfile(package_json):
        print("[admin-ui] 未找到 server/admin-ui，无法构建")
        return 1

    if not force and not needs_rebuild(admin_ui_dir, dist_index, package_json):
        print(f"[admin-ui] 使用已有构建: {dist_index}")
        return 0

    npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"
    try:
        subprocess.run(
            [npm_cmd, "--version"], capture_output=True, check=True, cwd=admin_ui_dir
        )
    except (FileNotFoundError, subprocess.CalledProcessError):
        print("[admin-ui] 错误: 未检测到 Node.js/npm。请安装 Node.js 18+")
        return 1

    node_modules = os.path.join(admin_ui_dir, "node_modules")
    if not os.path.isdir(node_modules):
        print("[admin-ui] 正在 npm ci ...")
        r = subprocess.run([npm_cmd, "ci"], cwd=admin_ui_dir)
        if r.returncode != 0:
            print("[admin-ui] npm ci 失败，尝试 npm install ...")
            r = subprocess.run([npm_cmd, "install"], cwd=admin_ui_dir)
            if r.returncode != 0:
                print("[admin-ui] 依赖安装失败")
                return r.returncode

    print("[admin-ui] 正在 npm run build ...")
    r = subprocess.run([npm_cmd, "run", "build"], cwd=admin_ui_dir)
    if r.returncode != 0:
        print("[admin-ui] 构建失败")
        return r.returncode
    if os.path.isfile(dist_index):
        print(f"[admin-ui] 构建完成: {dist_index}")
        return 0
    print("[admin-ui] 构建结束但未找到 dist/index.html")
    return 1


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="构建 admin-ui")
    parser.add_argument("--force", action="store_true", help="强制重新构建")
    args = parser.parse_args(argv)
    return build_admin_ui(force=args.force)


if __name__ == "__main__":
    raise SystemExit(main())
