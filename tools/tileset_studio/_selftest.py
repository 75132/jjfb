#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
图块工坊 Tileset Studio —— 后端回归自测

用法：
    先启动服务（python server.py --no-browser）
    再跑：python _selftest.py [--port 19850]
"""
import argparse
import base64
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request

PASS = 0
FAIL = 0


def check(name, cond, extra=""):
    global PASS, FAIL
    if cond:
        PASS += 1
        print("  [OK]   %s %s" % (name, extra))
    else:
        FAIL += 1
        print("  [FAIL] %s %s" % (name, extra))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=19850)
    a = ap.parse_args()
    B = "http://127.0.0.1:%d" % a.port

    def get(p, **q):
        u = B + p + ("?" + urllib.parse.urlencode(q) if q else "")
        with urllib.request.urlopen(u, timeout=10) as r:
            return r.status, r.read(), r.headers.get("Content-Type")

    def post(p, obj):
        d = json.dumps(obj).encode("utf-8")
        req = urllib.request.Request(B + p, d, {"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status, json.loads(r.read())

    # ---------- 等端口 ----------
    print("=" * 66)
    print("  图块工坊 · 后端回归自测")
    print("=" * 66)
    for _ in range(30):
        try:
            get("/")
            break
        except Exception:
            time.sleep(0.4)
    else:
        print("服务没有响应，请先运行：python server.py --no-browser")
        return 1

    # ---------- 1 静态资源 ----------
    print("\n[1] 静态资源")
    s, b, ct = get("/")
    html = b.decode("utf-8", "replace")
    check("GET /", s == 200 and "图块工坊" in html, "%d bytes" % len(b))
    for k in ["srcCanvas", "outCanvas", "tagList", "slotTabs", "btnVariantsAll"]:
        check("  首页含 #%s" % k, ('id="%s"' % k) in html)
    for f, need in [("/web/app.js", 20000), ("/web/style.css", 3000)]:
        s, b, ct = get(f)
        check("GET %s" % f, s == 200 and len(b) > need, "%d bytes" % len(b))

    # ---------- 2 roots ----------
    print("\n[2] /api/roots")
    s, b, _ = get("/api/roots")
    j = json.loads(b)
    check("返回 roots", s == 200 and len(j["roots"]) > 0, "%d 个根目录" % len(j["roots"]))
    check("含 rpgTilesets", bool(j.get("rpgTilesets")), j.get("rpgTilesets", ""))
    check("含 outDir", bool(j.get("outDir")))
    check("rpgTilesets 存在", os.path.isdir(j["rpgTilesets"]))

    # ---------- 3 列目录 ----------
    print("\n[3] /api/list")
    s, b, _ = get("/api/list", dir=j["rpgTilesets"], sizes="1")
    jl = json.loads(b)
    imgs = [x for x in jl["items"] if x["type"] == "img"]
    check("列出图集", s == 200 and len(imgs) > 10, "%d 张图片" % len(imgs))
    withsize = [x for x in imgs if x.get("w")]
    check("带尺寸信息", len(withsize) == len(imgs), "%d/%d" % (len(withsize), len(imgs)))
    by = {x["name"]: x for x in imgs}
    if "MAP1.png" in by:
        m = by["MAP1.png"]
        check("MAP1.png 尺寸", m["w"] == 768 and m["h"] == 720,
              "%dx%d -> %dx%d 格" % (m["w"], m["h"], m["cols"], m["rows"]))

    # ---------- 4 取图 ----------
    print("\n[4] /api/img")
    if imgs:
        s, b, ct = get("/api/img", path=imgs[0]["path"])
        check("取图返回 PNG", s == 200 and b[:8] == b"\x89PNG\r\n\x1a\n",
              "%s %d bytes" % (imgs[0]["name"], len(b)))

    # ---------- 5 目录穿越 / 越权 ----------
    print("\n[5] 安全边界")
    blocked = 0
    for bad in [r"C:\Windows\System32\drivers\etc\hosts",
                r"C:\Windows\win.ini",
                j["rpgTilesets"] + r"\..\..\..\..\..\Windows\win.ini"]:
        try:
            get("/api/img", path=bad)
        except urllib.error.HTTPError as e:
            if e.code in (403, 404):
                blocked += 1
        except Exception:
            blocked += 1
    check("越权路径被拦", blocked == 3, "%d/3" % blocked)

    # ---------- 6 写盘 ----------
    print("\n[6] 写盘接口")
    tmp_png = os.path.join(j["outDir"], "_selftest_1x1.png")
    tmp_txt = os.path.join(j["outDir"], "_selftest_text.json")
    # 1x1 透明 PNG 的 base64
    tiny = ("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk"
            "YPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==")
    s, r = post("/api/savePng", {"path": tmp_png, "b64": tiny})
    check("savePng", r.get("ok") and os.path.exists(tmp_png),
          "%d bytes" % (r.get("bytes") or 0))
    s, r = post("/api/saveText", {"path": tmp_txt, "text": json.dumps({"自测": 1}, ensure_ascii=False)})
    check("saveText", r.get("ok") and os.path.exists(tmp_txt))
    with open(tmp_txt, encoding="utf-8") as f:
        back = json.load(f)
    check("中文不被转义", "自测" in open(tmp_txt, encoding="utf-8").read())
    check("LF 换行", b"\r\n" not in open(tmp_txt, "rb").read())

    # dataURL 前缀也要能吃掉
    s, r = post("/api/savePng", {"path": tmp_png, "b64": "data:image/png;base64," + tiny})
    check("savePng 兼容 dataURL 前缀", r.get("ok"))

    for p in (tmp_png, tmp_txt):
        try:
            os.remove(p)
        except OSError:
            pass
    check("自测文件已清理", not os.path.exists(tmp_png))

    # ---------- 7 越权写 ----------
    print("\n[7] 越权写拦截")
    try:
        post("/api/saveText", {"path": r"C:\Windows\_evil.txt", "text": "x"})
        check("拦截越权写", False)
    except urllib.error.HTTPError as e:
        check("拦截越权写", e.code == 403, "HTTP %d" % e.code)

    # ---------- 8 404 ----------
    print("\n[8] 未知接口")
    try:
        get("/api/nope")
        check("未知接口 404", False)
    except urllib.error.HTTPError as e:
        check("未知接口 404", e.code == 404, "HTTP %d" % e.code)

    print("\n" + "=" * 66)
    print("  通过 %d  失败 %d" % (PASS, FAIL))
    print("=" * 66)
    return 0 if FAIL == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
