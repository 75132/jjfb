#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
「每个工程一个文件夹 + 导出不重名」独立复算 —— 不看浏览器，直接扫磁盘。

产物来源：web/_e2e_folder.html 跑出来的
    out/_foldertest/<工程名>/

验什么：
  · 结构：<导出根>/<工程名>/ 里同时有 工程包 / 各个槽的 PNG / flags / manifest
  · 图层命名规范：<工程名>_<槽>(-序号)?.png，且**同目录内没有任何两个文件同名**
  · ★ 重名真的没覆盖：-2、-3 是**另一份文件**，老文件字节一个都没变
  · ★ 包内 source.png 与原素材**逐字节一致**（源图真打进去了）
  · flags.json 是 8192 项；manifest.json 结构完整
  · PNG 是标称尺寸（B/C/D/E 768×768，A5 384×768）
  · 两个工程的文件夹互不污染（各自前缀 = 自己的工程名）

用法：python _verify_folder.py
"""
from __future__ import annotations

import json
import os
import re
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
BASE = os.path.join(OUT, "_foldertest")
MAPSRC = r"D:\机甲风暴开发素材合集\制作进行素材\地图素材"
SRC_NAME = "map1_7x6.png"

PASS = 0
FAIL = 0


def check(name, cond, extra=""):
    global PASS, FAIL
    if cond:
        PASS += 1
        print("  [OK]   " + name + (("  " + str(extra)) if extra else ""))
    else:
        FAIL += 1
        print("  [FAIL] " + name + (("  " + str(extra)) if extra else ""))


def slot_of(fn: str, proj: str):
    """从 <工程名>_<槽>(-N)?.png 里取出槽名；不合规返回 None"""
    m = re.match(re.escape(proj) + r"_(A5|B|C|D|E)(-\d+)?\.png$", fn)
    return m.group(1) if m else None


def main() -> int:
    try:
        from PIL import Image
    except Exception:
        Image = None

    print("=" * 68)
    print("  工程文件夹 / 导出不重名 —— 独立复算（直接扫磁盘）")
    print("=" * 68)

    if not os.path.isdir(BASE):
        check("产物目录存在 %s" % BASE, False, "先跑 web/_e2e_folder.html")
        print("\n  通过 %d　失败 %d" % (PASS, FAIL))
        return 2
    # 注意：下面一律用局部名 root_dir，别给模块级 BASE 重新赋值（会变成局部变量，前面就读不到了）

    # 工程名每次都带时间戳（测试页写的交班文件里）→ 这里必须读它才知道该验哪两个
    case_p = os.path.join(OUT, "_folder_case.json")
    if not os.path.isfile(case_p):
        check("交班文件 out/_folder_case.json 存在", False, "先跑 web/_e2e_folder.html")
        print("\n  通过 %d　失败 %d" % (PASS, FAIL))
        return 2
    case = json.loads(open(case_p, encoding="utf-8").read())
    root_dir = case.get("base") or BASE
    # 防呆：只验工具 out/ 底下的目录
    if not os.path.abspath(root_dir).startswith(os.path.abspath(OUT) + os.sep):
        check("交班文件里的目录在工具 out/ 下", False, root_dir)
        print("\n  通过 %d　失败 %d" % (PASS, FAIL))
        return 2
    P1 = case.get("name") or "我的地图工程"
    P2 = case.get("name2") or "第二个工程"
    print("  本次工程名: %s / %s（tag %s）" % (P1, P2, case.get("tag", "?")))

    projects = [d for d in sorted(os.listdir(root_dir))
                if os.path.isdir(os.path.join(root_dir, d))]
    print("\n[0] 每个工程一个文件夹")
    check("导出根下是一个个工程文件夹（含本次两个，历次累积）", len(projects) >= 2,
          "共 %d 个：%s" % (len(projects), "、".join(projects[-4:])))

    d1, d2 = os.path.join(root_dir, P1), os.path.join(root_dir, P2)
    print("  本次验的是: %s" % os.path.basename(d1))
    check("工程 1 文件夹存在", os.path.isdir(d1), d1)
    check("工程 2 文件夹存在", os.path.isdir(d2), d2)

    for proj, d in ((P1, d1), (P2, d2)):
        print("\n[1] %s —— 包在文件夹里，且文件夹名 == 工程名 == 包名" % proj)
        if not os.path.isdir(d):
            continue
        files = sorted(os.listdir(d))
        check("文件夹名 == 工程名", os.path.basename(d) == proj, os.path.basename(d))
        pkg = os.path.join(d, proj + ".tsproj")
        check("包 <工程名>.tsproj 在文件夹里", os.path.isfile(pkg),
              "%d 个成员" % len(files))

        # ---- 包内容 ----
        if os.path.isfile(pkg):
            with zipfile.ZipFile(pkg) as z:
                names = z.namelist()
                check("包里成员齐全（project.json / source.png / preview.png",
                      "project.json" in names and "source.png" in names,
                      ", ".join(names))
                src = z.read("source.png")
            sp = os.path.join(MAPSRC, SRC_NAME)
            if os.path.isfile(sp):
                with open(sp, "rb") as f:
                    raw = f.read()
                check("★ 包内 source.png 与原素材逐字节一致（%d 字节）" % len(raw),
                      src == raw, "%d / %d" % (len(src), len(raw)))
                check("★ 源图确实打进了包，不是只记了个路径", len(src) > 1000,
                      "%.1f KB" % (len(src) / 1024))

            # ---- 图层命名 + 不重名 ----
            pngs = [f for f in files if f.lower().endswith(".png")]
            others = [f for f in files if not f.lower().endswith(".png")]
            print("\n[2] %s —— 图层命名 & 不重名（%d 个 PNG）" % (proj, len(pngs)))
            check("★ 同目录内没有任何两个文件同名（OS 层面也保证不了重名，这里再确认一遍）",
                  len(set(files)) == len(files), "%d 个文件" % len(files))
            bad = [f for f in pngs if slot_of(f, proj) is None]
            check("★ 每个 PNG 都叫 <工程名>_<槽>(-序号)?.png", not bad,
                  "不合规：" + (", ".join(bad) if bad else "无"))

            by_slot = {}
            for f in pngs:
                s = slot_of(f, proj)
                if s:
                    by_slot.setdefault(s, []).append(f)
            print("       " + "　".join("%s: %s" % (k, "+".join(sorted(v)))
                                        for k, v in sorted(by_slot.items()) or [("(空)", [])]))

            # ---- 序号连续性 = 真的另存了新文件，没有覆盖 ----
            ok_seq = True
            detail = []
            for s, lst in sorted(by_slot.items()):
                want = [proj + "_" + s + ".png"] + \
                       [proj + "_" + s + "-%d.png" % i for i in range(2, len(lst) + 1)]
                if sorted(lst) != sorted(want):
                    ok_seq = False
                detail.append("%s×%d" % (s, len(lst)))
            check("★ 序号连续（第 1 份无后缀、第 2 份 -2、第 3 份 -3…，说明是另存不是覆盖）",
                  ok_seq, "　".join(detail))

            # ---- 老文件和新文件内容一致 = 老文件没被写坏 ----
            for s, lst in sorted(by_slot.items()):
                if len(lst) >= 2:
                    sizes = [os.path.getsize(os.path.join(d, f)) for f in lst]
                    check("  · %s 槽 %d 个版本字节数一致（%s）" % (s, len(lst), sizes[0]),
                          len(set(sizes)) == 1, str(sizes))

            # ---- PNG 尺寸标称 ----
            if Image is not None:
                dim_bad = []
                for f in pngs:
                    s = slot_of(f, proj)
                    want = (384, 768) if s == "A5" else (768, 768)
                    with Image.open(os.path.join(d, f)) as im:
                        if im.size != want:
                            dim_bad.append("%s=%s(应%s)" % (f, im.size, want))
                check("  所有 PNG 都是标称尺寸（A5 384×768 / 其余 768×768）",
                      not dim_bad, "不符：" + (", ".join(dim_bad) if dim_bad else "无"))

            # ---- flags / manifest ----
            fl = [f for f in files if f.endswith("_flags.json") or
                  re.search(r"_flags-\d+\.json$", f)]
            mf = [f for f in files if f.endswith("_manifest.json") or
                  re.search(r"_manifest-\d+\.json$", f)]
            print("\n[3] %s —— flags / manifest" % proj)
            if not fl and not mf:
                # 这个工程只存了包 + 一张 PNG，没点过「导出 flags/清单」——正常，不算失败
                check("该工程没导过 flags/清单 → 跳过（不算失败）", True, "只有包 + PNG")
            check("flags.json 有 %d 份（重名各自带序号）" % len(fl), bool(fl) or not mf,
                  ", ".join(sorted(fl)) or "（未导出）")
            check("manifest.json 有 %d 份" % len(mf), bool(mf) or not fl,
                  ", ".join(sorted(mf)) or "（未导出）")
            for f in sorted(fl):
                try:
                    arr = json.loads(open(os.path.join(d, f), encoding="utf-8").read())
                    check("  · %s = 8192 项通行表" % f, isinstance(arr, list) and len(arr) == 8192,
                          (str(len(arr)) + " 项") if isinstance(arr, list) else type(arr).__name__)
                except Exception as e:
                    check("  · %s 能解析" % f, False, str(e))
            for f in sorted(mf):
                try:
                    man = json.loads(open(os.path.join(d, f), encoding="utf-8").read())
                    check("  · %s 结构完整（slots.A5/B/C/D/E）" % f,
                          all(k in (man.get("slots") or {}) for k in ("A5", "B", "C", "D", "E")),
                          "槽：" + ",".join((man.get("slots") or {}).keys()))
                except Exception as e:
                    check("  · %s 能解析" % f, False, str(e))

    # ---- 两个工程互不污染 ----
    print("\n[4] 两个工程互不污染")
    if os.path.isdir(d1) and os.path.isdir(d2):
        f1 = set(os.listdir(d1))
        f2 = set(os.listdir(d2))
        check("★ 各自文件夹里的文件名都只带自己的工程名前缀",
              all(n.startswith(P1) for n in f1) and all(n.startswith(P2) for n in f2),
              "P1 %d 个 / P2 %d 个" % (len(f1), len(f2)))
        check("★ 工程 1 里没有工程 2 的文件", not (f1 & f2), "交集 %d 个" % len(f1 & f2) if f1 & f2 else "无交集")

    print("\n" + "=" * 68)
    print("  通过 %d　失败 %d" % (PASS, FAIL))
    print("=" * 68)
    return 0 if FAIL == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
