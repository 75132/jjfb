#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
「导出到桌面」独立校验

复用 _verify_out_block.py 的全套像素复算逻辑，只把
  · 目录  → 桌面\图块工坊导出\桌面试写_map1_7x6\   （★ 每工程一个文件夹）
  · 前缀  → 桌面试写_map1_7x6                      （文件名前缀 = 工程名）
换掉，用来证明「保存的图真的落到桌面那个工程文件夹里了，而且内容是对的」。

用法：python _verify_desktop.py
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import _verify_out_block as V   # noqa: E402


def desktop_dir() -> str:
    home = os.path.expanduser("~")
    cand = [
        os.path.join(os.environ.get("OneDrive", ""), "Desktop") if os.environ.get("OneDrive") else "",
        os.path.join(home, "Desktop"),
        os.path.join(home, "桌面"),
        os.path.join(os.environ.get("USERPROFILE", home), "Desktop"),
    ]
    for p in cand:
        if p and os.path.isdir(p):
            return os.path.abspath(p)
    return os.path.join(home, "Desktop")


def main() -> int:
    root = os.path.join(desktop_dir(), "图块工坊导出")
    # ★ 新口径：每个工程一个文件夹 —— 包和导出图都落 <导出根>\<工程名>\
    #   自测用的工程名 = 桌面试写_<源图名去后缀>（见 web/_e2e_save_desktop.html）
    sub = "桌面试写_map1_7x6"
    d = os.path.join(root, sub)
    print("")
    print("  ── 这一份是「导出到桌面」的复算 ──")
    print("  导出根目录: %s" % root)
    print("  工程文件夹: %s" % sub)
    print("")
    if not os.path.isdir(root):
        print("!! 桌面导出目录还不存在：%s" % root)
        print("   （先在工坊里点一次「保存本槽 PNG」）")
        return 1
    if not os.path.isdir(d):
        print("!! 工程文件夹还不存在：%s" % d)
        print("   （先跑 web/_e2e_save_desktop.html，或手动存一次工程）")
        return 1

    V.OUT = d
    V.PREFIX = sub                     # 文件名前缀 = 工程名
    return V.main()


if __name__ == "__main__":
    sys.exit(main())
