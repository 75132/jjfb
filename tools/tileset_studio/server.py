#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
图块工坊 Tileset Studio —— 本地服务端

把「原始地图素材（图集 PNG）」加工成：
  · 带语义标签（地面 / 墙面 / 路面 / 可通行植物 / 不可通行物体 / 树冠覆盖）
  · 带镜像、翻转、180 度旋转变体
  · 带通行性 flags（真正写进 MV 数据，不再是口头约定）
的新图集，并直接写回磁盘。

启动：  python server.py            （默认 http://127.0.0.1:19850）
       python server.py --port 9090
       python server.py --no-browser

零第三方依赖（PIL 仅用于读取图片尺寸，缺失时降级为不显示尺寸）。
"""
from __future__ import annotations

import argparse
import base64
import io
import json
import mimetypes
import os
import re
import sys
import threading
import time
import traceback
import webbrowser
import zipfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlparse, parse_qs

try:
    from PIL import Image
except Exception:  # pragma: no cover
    Image = None

HERE = os.path.dirname(os.path.abspath(__file__))
WEB_DIR = os.path.join(HERE, "web")
OUT_DIR = os.path.join(HERE, "out")          # 工具自带目录（次要）
DEFAULT_PORT = 19850

IMG_EXT = (".png", ".jpg", ".jpeg", ".bmp", ".gif", ".webp")

# ----------------------------------------------------------------- 工程包
PROJ_EXT = ".tsproj"        # 其实就是 zip：project.json + source.png + preview.png + flags.txt
PROJ_VERSION = 1

# ----------------------------------------------------------------- 允许访问的根
RPG_ROOT = r"D:\机甲风暴开发素材合集\机甲风暴2"
COCOS_ROOT = r"D:\jjfbol-cocos\jjfbol-cocos\jjfb"
ASSETS_ROOT = r"D:\机甲风暴开发素材合集"
WORK_ROOT = os.path.join(ASSETS_ROOT, "制作进行素材")
MAPSRC_ROOT = os.path.join(WORK_ROOT, "地图素材")


def find_desktop() -> str:
    """定位当前用户桌面（OneDrive 重定向也认）。"""
    home = os.path.expanduser("~")
    cand = [
        os.path.join(os.environ.get("OneDrive", ""), "Desktop") if os.environ.get("OneDrive") else "",
        os.path.join(os.environ.get("OneDriveCommercial", ""), "Desktop")
        if os.environ.get("OneDriveCommercial") else "",
        os.path.join(home, "Desktop"),
        os.path.join(home, "桌面"),
        os.path.join(os.environ.get("USERPROFILE", home), "Desktop"),
    ]
    for p in cand:
        if p and os.path.isdir(p):
            return os.path.abspath(p)
    return os.path.abspath(os.path.join(home, "Desktop"))


DESKTOP_DIR = find_desktop()
EXPORT_DIR = os.path.join(DESKTOP_DIR, "图块工坊导出")   # ★ 默认导出到这里，好找


def build_mounts() -> list:
    """[(显示名, 路径)] —— 目录白名单 + 前端「素材目录」下拉。"""
    cand = [
        ("制作进行素材 / 地图素材", MAPSRC_ROOT),
        ("制作进行素材", WORK_ROOT),
        ("工程图块集 img/tilesets", os.path.join(RPG_ROOT, "img", "tilesets")),
        ("RPG 单机工程", RPG_ROOT),
        ("机甲风暴素材总目录", ASSETS_ROOT),
        ("Cocos 工程", COCOS_ROOT),
        ("工坊目录", os.path.join(COCOS_ROOT, "tools", "tileset_studio")),
        ("★ 导出目录（桌面）", EXPORT_DIR),
        ("工具 out 目录", OUT_DIR),
        ("D:\\_mv_tabtest", r"D:\_mv_tabtest"),
        ("D:\\_mv_capacity_test", r"D:\_mv_capacity_test"),
        ("桌面", DESKTOP_DIR),
        ("下载", os.path.join(os.path.expanduser("~"), "Downloads")),
    ]
    out, seen = [], set()
    for label, p in cand:
        ap = os.path.abspath(p)
        if os.path.isdir(ap) and ap not in seen:
            seen.add(ap)
            out.append({"label": label, "path": ap})
    return out


try:
    os.makedirs(EXPORT_DIR, exist_ok=True)
except OSError:
    EXPORT_DIR = OUT_DIR          # 桌面不可写时退回工具目录

MOUNTS = build_mounts()
ROOTS = [m["path"] for m in MOUNTS]


def _norm(p: str) -> str:
    return os.path.normcase(os.path.realpath(os.path.abspath(p)))


ROOTS_N = [_norm(r) for r in ROOTS]


def is_allowed(p: str) -> bool:
    n = _norm(p)
    for r in ROOTS_N:
        if n == r or n.startswith(r + os.sep):
            return True
    return False


def safe_path(p: str):
    """把前端传来的路径解析成绝对路径，并做根目录白名单校验。"""
    if not p:
        raise ValueError("空路径")
    ap = os.path.abspath(unquote(p))
    if not is_allowed(ap):
        raise PermissionError("路径不在允许的根目录内：%s" % ap)
    return ap


# ----------------------------------------------------------------- 工具函数
def list_dir(d: str) -> dict:
    dirs, imgs = [], []
    with os.scandir(d) as it:
        for e in it:
            try:
                if e.is_dir(follow_symlinks=False):
                    dirs.append({"type": "dir", "name": e.name, "path": e.path})
                elif e.is_file() and e.name.lower().endswith(IMG_EXT):
                    imgs.append({"type": "img", "name": e.name, "path": e.path})
            except OSError:
                continue
    dirs.sort(key=lambda x: x["name"].lower())
    imgs.sort(key=lambda x: x["name"].lower())
    return {"dir": d, "parent": os.path.dirname(d) if _norm(d) not in ROOTS_N else None,
            "items": dirs + imgs}


def image_info(p: str) -> dict:
    info = {"path": p, "name": os.path.basename(p), "bytes": os.path.getsize(p)}
    if Image is not None:
        try:
            with Image.open(p) as im:
                info["w"], info["h"] = im.size
                info["mode"] = im.mode
                info["cols"] = im.size[0] // 48
                info["rows"] = im.size[1] // 48
        except Exception as e:
            info["error"] = str(e)
    return info


# ----------------------------------------------------------------- 工程包（.tsproj = zip）
def _safe_name(name: str) -> str:
    """文件名去非法字符 + 补后缀。"""
    name = re.sub(r'[\\/:*?"<>|\r\n\t]+', "_", (name or "").strip()) or "map"
    if not name.lower().endswith(PROJ_EXT):
        name += PROJ_EXT
    return name


def _b64(b64: str) -> bytes:
    if not b64:
        return b""
    if "," in b64[:64]:
        b64 = b64.split(",", 1)[1]
    return base64.b64decode(b64)


def _uniq_path(p: str) -> str:
    """★ 导出**绝不覆盖已有文件**：重名就加 -2、-3 …（用户明确要求「必须不要重名」）。

    例：`OUT_B.png` 已存在 → 返回 `OUT_B-2.png`；再有 → `OUT_B-3.png`。
    """
    if not os.path.exists(p):
        return p
    d, base = os.path.dirname(p), os.path.basename(p)
    stem, ext = os.path.splitext(base)
    for i in range(2, 1000):
        q = os.path.join(d, "%s-%d%s" % (stem, i, ext))
        if not os.path.exists(q):
            return q
    raise ValueError("同名文件超过 999 个，先清理一下：" + base)


def proj_save(data: dict) -> dict:
    """把「源图 + 全部状态」打成一个 .tsproj（zip）。"""
    d = safe_path(data.get("dir") or EXPORT_DIR)
    fname = _safe_name(data.get("name"))
    if data.get("subdir"):          # ★ 每个工程一个文件夹：<导出目录>/<工程名>/<工程名>.tsproj
        d = os.path.join(d, os.path.splitext(fname)[0])
    os.makedirs(d, exist_ok=True)
    p = os.path.join(d, fname)
    state = data.get("state") or {}
    sheet = state.get("sheet") or {}

    # ---- 源图字节：优先本地路径；其次从「上一个工程包」里继承
    sp = (data.get("sheetPath") or "").strip()
    from_proj = (data.get("fromProj") or "").strip()
    src, src_name = b"", ""
    if sp and not sp.startswith("proj://"):
        ap = safe_path(sp)
        with open(ap, "rb") as f:
            src = f.read()
        src_name = os.path.basename(ap)
    elif from_proj:
        ap = safe_path(from_proj)
        with zipfile.ZipFile(ap) as z:
            src = z.read("source.png") if "source.png" in z.namelist() else b""
        src_name = sheet.get("name") or os.path.basename(ap)
    if not src:
        raise ValueError("源图拿不到：工程包内没有 source.png，也没给可用的本地路径")

    flags = data.get("flags") or []
    meta = {
        "app": "TilesetStudio",
        "version": PROJ_VERSION,
        "savedAt": time.strftime("%Y-%m-%d %H:%M:%S"),
        "sheet": {"name": src_name,
                  "w": sheet.get("w"), "h": sheet.get("h"),
                  "cols": sheet.get("cols"), "rows": sheet.get("rows"),
                  "origin": sp or ("proj:" + os.path.basename(from_proj))},
        "cells": data.get("cells") or {},
        "flags": len(flags),
        "tags": data.get("tags") or {},
    }

    # 人可读的说明（解压后也能看懂这个包里是什么、怎么导回去）
    cells = meta["cells"]
    readme = "\n".join([
        "图块工坊 Tileset Studio —— 地图工程包",
        "=" * 46,
        "保存时间 : " + meta["savedAt"],
        "源图     : %s（%s×%s = %s 格）" % (src_name, sheet.get("w") or "?",
                                           sheet.get("h") or "?",
                                           (sheet.get("cols") or 0) * (sheet.get("rows") or 0)),
        "占用     : " + (", ".join("%s槽 %s 格" % (k, v)
                                  for k, v in sorted(cells.items()) if v) or "（空）"),
        "语义标注 : " + (", ".join("%s×%s" % (k, v)
                                  for k, v in sorted((data.get("tags") or {}).items())) or "（无）"),
        "",
        "包内文件：",
        "  project.json   全部状态（五个槽的布局 / 每格来源与变换 / 语义）",
        "  source.png     原始素材图集（原样拷入，导入时不依赖原文件）",
        "  preview.png    当前槽缩略图（列表里好认）",
        "  flags.txt      8192 项通行表（MV 口径：0x000F 不可通行 / 0x0010 ★上层）",
        "  manifest.json  图块清单（tileId / 语义 / 来源 / 变换）",
        "",
        "怎么导回去：",
        "  打开图块工坊 → 顶栏「📂 开工程」→ 选这个 .tsproj 文件",
        "  （本文件就是一个 zip，把后缀改成 .zip 也能直接解压查看）",
        "",
    ])

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("project.json",
                   json.dumps({"meta": meta, "state": state}, ensure_ascii=False, indent=1))
        z.writestr("source.png", src)
        z.writestr("README.txt", readme)
        prev = _b64(data.get("preview") or "")
        if prev:
            z.writestr("preview.png", prev)
        if flags:
            z.writestr("flags.txt", "\n".join(str(int(x)) for x in flags) + "\n")
        if data.get("manifest"):
            z.writestr("manifest.json",
                       json.dumps(data["manifest"], ensure_ascii=False, indent=1))
    blob = buf.getvalue()
    with open(p, "wb") as f:
        f.write(blob)
    return {"ok": True, "path": p, "name": os.path.basename(p), "bytes": len(blob),
            "dir": d, "srcBytes": len(src)}


def proj_upload(data: dict) -> dict:
    """浏览器拖进来的 .tsproj（拿不到磁盘路径，只能收字节）→ 落到 out/_drop/ 再按普通包读。"""
    name = _safe_name(data.get("name") or "dropped")
    blob = _b64(data.get("b64") or "")
    if not blob:
        raise ValueError("没收到内容")
    with zipfile.ZipFile(io.BytesIO(blob)) as z:          # 先验是不是合法 zip 包
        if "project.json" not in z.namelist():
            raise ValueError("这不是工程包（zip 里没有 project.json）")
    d = os.path.join(OUT_DIR, "_drop")
    os.makedirs(d, exist_ok=True)
    p = os.path.join(d, name)
    with open(p, "wb") as f:
        f.write(blob)
    return {"ok": True, "path": p, "name": os.path.basename(p), "bytes": len(blob)}


def proj_load(p: str) -> dict:
    ap = safe_path(p)
    with zipfile.ZipFile(ap) as z:
        names = z.namelist()
        doc = json.loads(z.read("project.json").decode("utf-8"))
    return {"ok": True, "path": ap, "name": os.path.basename(ap),
            "meta": doc.get("meta", {}), "state": doc.get("state", {}), "entries": names}


def _proj_item(p: str, folder: str = "") -> dict:
    item = {"name": os.path.basename(p), "path": p, "bytes": os.path.getsize(p),
            "folder": folder,                      # 所在工程文件夹（顶层包为空串）
            "mtime": time.strftime("%Y-%m-%d %H:%M", time.localtime(os.path.getmtime(p)))}
    try:
        with zipfile.ZipFile(p) as z:
            doc = json.loads(z.read("project.json").decode("utf-8"))
            m = doc.get("meta", {})
            item["sheet"] = (m.get("sheet") or {}).get("name", "")
            item["savedAt"] = m.get("savedAt", "")
            item["cells"] = m.get("cells", {})
            item["hasPreview"] = "preview.png" in z.namelist()
    except Exception as e:
        item["error"] = str(e)
    return item


def proj_list(d: str) -> list:
    """列出导出目录下的工程包 —— **同时扫一层工程子文件夹**
    （新口径：每个工程一个文件夹；老包直接躺在根目录，也要还能列出来）。"""
    d = safe_path(d or EXPORT_DIR)
    if not os.path.isdir(d):
        return []
    out = []
    for n in sorted(os.listdir(d), key=lambda x: x.lower()):
        p = os.path.join(d, n)
        if os.path.isdir(p):                                    # 工程文件夹
            for g in sorted(os.listdir(p), key=lambda x: x.lower()):
                q = os.path.join(p, g)
                if g.lower().endswith(PROJ_EXT) and os.path.isfile(q):
                    out.append(_proj_item(q, folder=n))
            continue
        if n.lower().endswith(PROJ_EXT) and os.path.isfile(p):   # 老包（裸放根目录）
            out.append(_proj_item(p))
    return out


def proj_file(p: str, entry: str) -> tuple:
    """从工程包里取一个成员：(bytes, ctype)。只放行白名单成员名。"""
    if entry not in ("source.png", "preview.png", "project.json", "flags.txt",
                     "manifest.json", "README.txt"):
        raise ValueError("不允许读取的成员：%s" % entry)
    ap = safe_path(p)
    with zipfile.ZipFile(ap) as z:
        blob = z.read(entry)
    ctype = mimetypes.guess_type(entry)[0] or "application/octet-stream"
    if entry.endswith((".json", ".txt")):
        ctype = "text/plain; charset=utf-8"
    return blob, ctype


# ----------------------------------------------------------------- HTTP
class Handler(BaseHTTPRequestHandler):
    server_version = "TilesetStudio/1.0"

    # ---- 输出小工具 ----
    def _send(self, code: int, body: bytes, ctype: str, extra=None):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionAbortedError):
            pass

    def _json(self, obj, code: int = 200):
        body = json.dumps(obj, ensure_ascii=False, indent=1).encode("utf-8")
        self._send(code, body, "application/json; charset=utf-8")

    def _err(self, code: int, msg: str):
        self._json({"ok": False, "error": msg}, code)

    def _file(self, p: str):
        if not os.path.isfile(p):
            self._err(404, "文件不存在")
            return
        ctype = mimetypes.guess_type(p)[0] or "application/octet-stream"
        if p.lower().endswith(".js"):
            ctype = "text/javascript; charset=utf-8"
        elif p.lower().endswith(".css"):
            ctype = "text/css; charset=utf-8"
        elif p.lower().endswith(".html"):
            ctype = "text/html; charset=utf-8"
        elif p.lower().endswith((".json", ".txt", ".md")):
            ctype = "text/plain; charset=utf-8"
        with open(p, "rb") as f:
            self._send(200, f.read(), ctype)

    def log_message(self, fmt, *args):
        pass  # 静音，避免刷屏

    # ---- GET ----
    def do_GET(self):
        try:
            u = urlparse(self.path)
            q = parse_qs(u.query)
            path = u.path

            if path in ("/", "/index.html"):
                self._file(os.path.join(WEB_DIR, "index.html"))
                return
            if path.startswith("/web/"):
                rel = path[5:]
                self._file(os.path.join(WEB_DIR, rel))
                return
            if path == "/api/roots":
                self._json({"ok": True, "roots": ROOTS, "mounts": MOUNTS,
                            "outDir": EXPORT_DIR,          # 前端默认落盘目录 = 桌面
                            "exportDir": EXPORT_DIR,
                            "toolOut": OUT_DIR,
                            "desktop": DESKTOP_DIR,
                            "mapSrc": MAPSRC_ROOT,
                            "rpgTilesets": os.path.join(RPG_ROOT, "img", "tilesets")})
                return
            if path == "/api/list":
                d = safe_path(q.get("dir", [""])[0])
                if not os.path.isdir(d):
                    self._err(400, "不是目录：%s" % d)
                    return
                res = list_dir(d)
                if q.get("sizes", ["0"])[0] == "1":
                    for it in res["items"]:
                        if it["type"] == "img":
                            it.update(image_info(it["path"]))
                self._json({"ok": True, **res})
                return
            if path == "/api/img":
                p = safe_path(q.get("path", [""])[0])
                self._file(p)
                return
            if path == "/api/info":
                p = safe_path(q.get("path", [""])[0])
                self._json({"ok": True, "info": image_info(p)})
                return
            if path == "/api/proj/list":
                d = safe_path(q.get("dir", [""])[0] or EXPORT_DIR)
                self._json({"ok": True, "dir": d, "items": proj_list(d)})
                return
            if path == "/api/proj/file":
                p = safe_path(q.get("path", [""])[0])
                entry = q.get("entry", ["source.png"])[0]
                try:
                    blob, ctype = proj_file(p, entry)
                    self._send(200, blob, ctype)
                except KeyError:
                    self._err(404, "包里没有 %s" % entry)
                return
            self._err(404, "未知接口 %s" % path)
        except PermissionError as e:
            self._err(403, str(e))
        except Exception as e:
            traceback.print_exc()
            self._err(500, "%s: %s" % (type(e).__name__, e))

    # ---- POST ----
    def do_POST(self):
        try:
            u = urlparse(self.path)
            n = int(self.headers.get("Content-Length") or 0)
            raw = self.rfile.read(n) if n else b"{}"
            data = json.loads(raw.decode("utf-8") or "{}")

            if u.path == "/api/savePng":
                p = safe_path(data.get("path", ""))
                b64 = data.get("b64", "")
                if "," in b64[:64]:
                    b64 = b64.split(",", 1)[1]
                blob = base64.b64decode(b64)
                os.makedirs(os.path.dirname(p) or ".", exist_ok=True)
                orig = p
                if data.get("noClobber"):          # ★ 不重名：存在就 -2、-3 …
                    p = _uniq_path(p)
                with open(p, "wb") as f:
                    f.write(blob)
                self._json({"ok": True, "path": p, "bytes": len(blob),
                            "renamed": p != orig})
                return

            if u.path == "/api/saveText":
                p = safe_path(data.get("path", ""))
                os.makedirs(os.path.dirname(p) or ".", exist_ok=True)
                orig = p
                if data.get("noClobber"):
                    p = _uniq_path(p)
                with open(p, "w", encoding="utf-8", newline="\n") as f:
                    f.write(data.get("text", ""))
                self._json({"ok": True, "path": p, "chars": len(data.get("text", "")),
                            "renamed": p != orig})
                return

            if u.path == "/api/mkdir":
                p = safe_path(data.get("path", ""))
                os.makedirs(p, exist_ok=True)
                self._json({"ok": True, "path": p})
                return

            if u.path == "/api/reveal":
                p = safe_path(data.get("path", ""))
                target = p if os.path.isdir(p) else os.path.dirname(p)
                try:
                    os.startfile(target)  # noqa: 仅 Windows 本地工具
                    self._json({"ok": True, "opened": target})
                except Exception as e:
                    self._json({"ok": False, "error": str(e), "path": target})
                return

            if u.path == "/api/proj/save":
                self._json(proj_save(data))
                return

            if u.path == "/api/proj/load":
                self._json(proj_load(data.get("path", "")))
                return

            if u.path == "/api/proj/upload":
                self._json(proj_upload(data))
                return

            if u.path == "/api/quit":
                self._json({"ok": True})
                threading.Thread(target=self.server.shutdown, daemon=True).start()
                return

            self._err(404, "未知接口 %s" % u.path)
        except PermissionError as e:
            self._err(403, str(e))
        except Exception as e:
            traceback.print_exc()
            self._err(500, "%s: %s" % (type(e).__name__, e))


# ----------------------------------------------------------------- 启动
def pick_port(start: int, tries: int = 20) -> int:
    import socket
    for i in range(tries):
        p = start + i
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            s.bind(("127.0.0.1", p))
            s.close()
            return p
        except OSError:
            s.close()
        finally:
            pass
    return start


def main():
    ap = argparse.ArgumentParser(description="图块工坊 Tileset Studio")
    ap.add_argument("--port", type=int, default=DEFAULT_PORT)
    ap.add_argument("--no-browser", action="store_true")
    args = ap.parse_args()

    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

    os.makedirs(OUT_DIR, exist_ok=True)
    try:
        os.makedirs(EXPORT_DIR, exist_ok=True)
    except OSError:
        pass
    port = pick_port(args.port)
    url = "http://127.0.0.1:%d/" % port

    srv = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    srv.daemon_threads = True

    print("=" * 64)
    print("  图块工坊  Tileset Studio")
    print("=" * 64)
    print("  地址     : %s" % url)
    print("  素材目录 :")
    for m in MOUNTS:
        print("             · %-24s %s" % (m["label"], m["path"]))
    print("  导出目录 : %s   ★ 保存的图直接落这里" % EXPORT_DIR)
    print("  工具目录 : %s" % OUT_DIR)
    print("  PIL      : %s" % ("OK" if Image is not None else "缺失(不显示尺寸)"))
    print("-" * 64)
    print("  浏览器关掉本页不会停止服务；停止请在本窗口按 Ctrl+C")
    print("=" * 64)

    if not args.no_browser:
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()

    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止。")
    finally:
        srv.server_close()


if __name__ == "__main__":
    main()
