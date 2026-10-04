#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
图块工坊 Tileset Studio —— 一键全量回归。

它做的事（和手工一条条敲完全一样，只是省事）：
  1. 确认 http://127.0.0.1:19850 活着（没活就自己拉起来）
  2. 跑后端接口自测            _selftest.py
  3. 跑 N 个无头浏览器端到端页  web/_e2e*.html   → 抓 title 里的 "通过 X 失败 Y"
  4. 跑产物独立复算            _verify_out*.py / _verify_desktop.py
  5. 打一张总表，有失败就 exit 1

用法：
    python tools/tileset_studio/_regress.py            # 全跑
    python tools/tileset_studio/_regress.py v4 block   # 只跑名字里含这些字样的项
"""
import io
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
PORT = 19850
BASE = "http://127.0.0.1:%d" % PORT
OUT = os.path.join(HERE, "out")

PY = sys.executable
EDGE_CANDIDATES = [
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
]

# (名字, 类型, 目标)
E2E_PAGES = [
    ("e2e 基础", "web/_e2e.html"),
    ("e2e 整块贴", "web/_e2e_block.html"),
    ("e2e 第三波(撤回/框选/橡皮)", "web/_e2e_v3.html"),
    ("e2e 第四波(镜像口径)", "web/_e2e_v4.html"),
    ("e2e 图集列表(默认打开哪张)", "web/_e2e_sheet.html"),
]
PY_TESTS = [
    ("后端接口自测", "_selftest.py"),
]

# 存盘链路：(名字, 先跑哪个页面真存盘, 再跑哪个脚本复算)—— 产物都落工具自己的 out/，零外部足迹
CHAINS = [
    ("链路 逐个铺导出", "web/_e2e_save.html", "_verify_out.py"),
    ("链路 整块贴导出", "web/_e2e_save_block.html", "_verify_out_block.py"),
    ("链路 工程包 .tsproj", "web/_e2e_proj.html", "_verify_proj.py"),
    # 这条链**不清目录**：测试页每次用带时间戳的工程名（从零开始，
    # 断言才准），并把自己的工程名写进 out/_folder_case.json 给复算脚本读。
    ("链路 工程文件夹(不重名)", "web/_e2e_folder.html", "_verify_folder.py"),
]

# 真往「桌面\图块工坊导出」写的链路：**默认不跑**（会在用户桌面留 7 个自测文件，
# 删它们属于动桌面文件、会触发安全删除拦截），要验就显式 `python _regress.py 桌面`
DESKTOP_CHAIN = ("链路 桌面导出（会往桌面写）", "web/_e2e_save_desktop.html", "_verify_desktop.py")

DESKTOP = os.path.join(os.path.expanduser("~"), "Desktop", "图块工坊导出")


def find_edge():
    for p in EDGE_CANDIDATES:
        if os.path.exists(p):
            return p
    return None


def server_alive():
    try:
        urllib.request.urlopen(BASE + "/api/roots", timeout=2).read()
        return True
    except Exception:
        return False


def ensure_server():
    if server_alive():
        return None
    proc = subprocess.Popen([PY, os.path.join(HERE, "server.py")], cwd=HERE,
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(40):
        time.sleep(0.25)
        if server_alive():
            return proc
    print("[x] 起不来：%s" % BASE)
    sys.exit(2)


def run_py(rel):
    """返回 (通过, 失败, 摘要行)"""
    p = subprocess.run([PY, os.path.join(HERE, rel)], cwd=HERE,
                       stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    txt = p.stdout.decode("utf-8", "replace")
    io.open(os.path.join(OUT, rel.replace("/", "_") + ".log"), "w",
            encoding="utf-8").write(txt)
    m = re.search(r"通过\s*(\d+)\s*[/／,，]?\s*失败\s*(\d+)", txt)
    if not m:
        m = re.search(r"(\d+)\s*/\s*(\d+)", txt)
        if m:
            ok, tot = int(m.group(1)), int(m.group(2))
            return ok, tot - ok, "（从 %s/%s 推）" % (ok, tot)
        ok, bad = (0, 1) if p.returncode else (1, 0)
        return ok, bad, "（无汇总行，退出码 %d）" % p.returncode
    ok, bad = int(m.group(1)), int(m.group(2))
    return ok, bad, ""


def run_e2e(edge, rel):
    profile = os.path.join(os.environ.get("TEMP", "/tmp"), "_ts_edge_prof")
    subprocess.run(["rm", "-rf", profile], shell=False,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    dom = os.path.join(OUT, rel.replace("/", "_"))
    with io.open(dom, "w", encoding="utf-8", errors="replace") as f:
        subprocess.run([edge, "--headless=new", "--disable-gpu", "--no-first-run",
                        "--user-data-dir=" + profile, "--window-size=1920,1400",
                        "--virtual-time-budget=30000", "--dump-dom",
                        BASE + "/" + rel],
                       stdout=f, stderr=subprocess.DEVNULL, timeout=180)
    h = io.open(dom, encoding="utf-8", errors="replace").read()
    m = re.search(r"<title>([^<]*)</title>", h)
    title = m.group(1) if m else ""
    m2 = re.search(r"通过\s*(\d+)\s*失败\s*(\d+)", h)
    if m2:
        return int(m2.group(1)), int(m2.group(2)), title
    m3 = re.search(r"(\d+)\s*/\s*(\d+)", title)          # e2e 53/53 这种写进 title 的
    if m3:
        ok = int(m3.group(1))
        return ok, int(m3.group(2)) - ok, title
    # 存盘链路页没有计数，只标 DONE OK / FAIL
    if "DONE OK" in h or re.search(r"\bDONE\b", title):
        return 1, 0, (title or "") + "（存盘完成）"
    return 0, 1, "无法判定 title=%r" % title


def dump_desktop():
    """自测往桌面写的产物收进 out/_desktop_selftest/<本次时间戳>/，桌面目录留空（用户好找自己的导出）。

    注意：**每次用一个新文件夹，不删旧文件** —— 删文件会触发安全删除拦截，
    而且要清理的是用户桌面目录，宁可不删也别误删。
    """
    if not os.path.isdir(DESKTOP):
        return
    keep = os.path.join(OUT, "_desktop_selftest", time.strftime("run_%Y%m%d_%H%M%S"))
    os.makedirs(keep, exist_ok=True)
    n = 0
    for f in os.listdir(DESKTOP):
        src, dst = os.path.join(DESKTOP, f), os.path.join(keep, f)
        if os.path.isfile(src):
            shutil.move(src, dst)          # 跨盘（C:→D:）不能用 os.replace
            n += 1
    if n:
        print("  · 桌面自测产物 %d 个已收进 %s" % (n, keep))


def main():
    want = [a.lower() for a in sys.argv[1:]]
    os.makedirs(OUT, exist_ok=True)
    edge = find_edge()
    proc = ensure_server()

    rows, allok = [], True
    for name, rel in E2E_PAGES:
        if want and not any(w in name.lower() or w in rel.lower() for w in want):
            continue
        if not edge:
            rows.append((name, "-", "-", "找不到 Edge/Chrome"))
            allok = False
            continue
        ok, bad, note = run_e2e(edge, rel)
        rows.append((name, ok, bad, note))
        allok &= (bad == 0)

    for name, rel in PY_TESTS:
        if want and not any(w in name.lower() or w in rel.lower() for w in want):
            continue
        ok, bad, note = run_py(rel)
        rows.append((name, ok, bad, note))
        allok &= (bad == 0)

    chains = list(CHAINS)
    # 「真往桌面写」的链路只在显式要的时候加（默认零桌面足迹）
    if any(w in ("桌面", "desktop", "desk") for w in want):
        chains.insert(0, DESKTOP_CHAIN)

    for name, page, verifier in chains:
        if want and not any(w in name.lower() or w in page.lower() or w in verifier.lower()
                            for w in want):
            continue
        if not edge:
            rows.append((name, "-", "-", "找不到 Edge/Chrome"))
            allok = False
            continue
        ok, bad, note = run_e2e(edge, page)          # 先真存盘
        rows.append((name + " · 存盘", ok, bad, note))
        allok &= (bad == 0)
        ok2, bad2, note2 = run_py(verifier)          # 再独立复算
        rows.append((name + " · 复算", ok2, bad2, note2))
        allok &= (bad2 == 0)

    if any(name.startswith("链路 桌面") for name, _, _, _ in rows):
        print("  · 桌面链路会往 %s 写 7 个自测文件（没自动删，动桌面文件需你点头）" % DESKTOP)

    print()
    print("=" * 66)
    print("图块工坊 · 全量回归　%s" % time.strftime("%Y-%m-%d %H:%M:%S"))
    print("-" * 66)
    for name, ok, bad, note in rows:
        flag = "OK  " if bad == 0 else "FAIL"
        print("  [%s] %-28s %s / %s   %s" % (flag, name, ok, ok + bad, note))
    print("-" * 66)
    tot = sum(r[1] + r[2] for r in rows)
    print("  合计 %d 项　%s" % (tot, "全绿 ✅" if allok else "有失败 ❌"))
    print("=" * 66)

    if proc:
        proc.terminate()
    sys.exit(0 if allok else 1)


if __name__ == "__main__":
    main()
