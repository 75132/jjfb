# -*- coding: utf-8 -*-
"""
自适应切主角头像（左右）：按每人轮廓找「脖子最窄处」，不固定高度比例。

源：Cocos Player 48×48（与当前游戏同尺度，不再放大）
出：assets/Image/ZuoJia/head + resources/ZuoJia/head
"""
from __future__ import annotations

import json
import uuid
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
PIC_ROOT = ROOT / "assets" / "Image" / "Player" / "pic"
OUT_DIR = ROOT / "assets" / "Image" / "ZuoJia" / "head"
RES_DIR = ROOT / "assets" / "resources" / "ZuoJia" / "head"

NEAREST = getattr(getattr(Image, "Resampling", Image), "NEAREST", Image.NEAREST)

# 在角色可见高度的这个区间内找脖子（避开头顶发尖与下半身）
NECK_SEARCH_TOP = 0.32
NECK_SEARCH_BOT = 0.72
# 脖子行之下再保留的像素（下巴余量；不含肩膀）
CHIN_PAD = 1


def frame_path(player_id: int, index: int) -> Path:
    d = PIC_ROOT / f"player{player_id}"
    for p in (
        d / f"{player_id}-{index}.png",
        d / f"{player_id}_{index:02d}.png",
        d / f"{player_id}_{index}.png",
    ):
        if p.exists():
            return p
    raise FileNotFoundError(f"player{player_id} frame {index}")


def alpha_bbox(im: Image.Image):
    return im.split()[-1].getbbox()


def row_opaque_counts(im: Image.Image) -> list[int]:
    px = im.load()
    w, h = im.size
    out = [0] * h
    for y in range(h):
        n = 0
        for x in range(w):
            if px[x, y][3] > 0:
                n += 1
        out[y] = n
    return out


def find_neck_row(im: Image.Image) -> tuple[int, int, int, dict]:
    """
    返回 (y0, neck_cut_exclusive, y1, debug)
    在头顶最宽之后向下找「第一道明显收窄」当作脖子，避免腿部更窄误判。
    """
    bbox = alpha_bbox(im)
    if not bbox:
        raise ValueError("empty sprite")
    x0, y0, x1, y1 = bbox
    body_h = y1 - y0
    counts = row_opaque_counts(im)

    s0 = y0 + int(body_h * NECK_SEARCH_TOP)
    s1 = y0 + int(body_h * NECK_SEARCH_BOT)
    s1 = min(s1, y1 - 3)
    s0 = max(s0, y0 + 4)

    # 上半最宽 = 头/发
    head_peak = max(range(y0, min(s0 + 1, y1)), key=lambda y: counts[y])
    peak_w = max(counts[head_peak], 1)

    neck = None
    scan_from = max(head_peak + 3, s0)
    for y in range(scan_from, s1 + 1):
        c = counts[y]
        if c <= 0:
            continue
        prev = counts[y - 1]
        nxt = counts[y + 1] if y + 1 < len(counts) else c
        # 峡谷：比头宽窄，且前后更宽（或持平）——真脖子，不是发丝收边
        before = max(counts[max(y0, y - 3) : y] or [c])
        after = max(counts[y + 1 : min(y1, y + 5)] or [c])
        is_valley = c <= before - 3 and after >= c + 2
        sharp_drop = prev >= 8 and c <= prev - 5 and after >= c
        narrow = c <= peak_w * 0.62
        if is_valley and narrow:
            neck = y
            break
        if sharp_drop and narrow and c <= nxt + 2:
            neck = y
            break

    if neck is None:
        # 回退：峰值后、搜索区内「前后都更宽」的最窄谷底
        valleys = []
        for y in range(scan_from, s1 + 1):
            c = counts[y]
            if c <= 0:
                continue
            before = max(counts[max(y0, y - 3) : y] or [c])
            after = max(counts[y + 1 : min(y1, y + 5)] or [c])
            if c <= before - 2 and after >= c + 1:
                valleys.append(y)
        if valleys:
            neck = valleys[0]
        else:
            neck = min(
                range(scan_from, s1 + 1),
                key=lambda y: counts[y] if counts[y] > 0 else 999,
            )
    # 只允许向下微调 0~2 行到真正局部最窄（下巴），禁止滑到腿
    for _ in range(2):
        if neck + 1 < y1 and 0 < counts[neck + 1] < counts[neck]:
            neck += 1
        else:
            break

    # 头下沿：含脖子行之上的下巴，通常 cut=neck（不含脖子阴影行）或 neck+pad
    # 若 neck 行本身已是极窄，用 neck 作为 exclusive cut（保留到 neck-1）
    # 实际脸常在 neck 上一两行，CHIN_PAD 把脖子线稍纳入
    cut = min(y1, neck + CHIN_PAD)
    min_cut = head_peak + max(8, int(body_h * 0.20))
    if cut < min_cut:
        cut = min(y1, min_cut)
    # 硬上限：不能超过搜索底（防止再滑下去）
    cut = min(cut, s1 + 2, y0 + int(body_h * 0.78))

    debug = {
        "bbox": [x0, y0, x1, y1],
        "search": [s0, s1],
        "head_peak_y": head_peak,
        "head_peak_w": peak_w,
        "neck_y": neck,
        "neck_w": counts[neck],
        "cut_y": cut,
        "head_h": cut - y0,
    }
    return y0, cut, y1, debug


def crop_head(im: Image.Image) -> tuple[Image.Image, dict]:
    im = im.convert("RGBA")
    y0, cut, _y1, debug = find_neck_row(im)
    # 水平：用「头顶到 cut」整段的 alpha 包围，保留宽发/双马尾
    band = im.crop((0, y0, im.width, cut))
    tb = alpha_bbox(band)
    if not tb:
        raise ValueError("empty head")
    head = band.crop(tb)
    debug["out_size"] = [head.width, head.height]
    return head, debug


def make_meta(display_name: str, base_uuid: str, cw: int, ch: int, bbox):
    if bbox is None:
        x0, y0, x1, y1 = 0, 0, cw, ch
    else:
        x0, y0, x1, y1 = bbox
    w, h = x1 - x0, y1 - y0
    half_w, half_h = w / 2.0, h / 2.0
    y_bottom = ch - y1
    y_top = ch - y0
    uv = [x0, y_bottom, x1, y_bottom, x0, y_top, x1, y_top]
    nuv = [
        x0 / cw, y_bottom / ch, x1 / cw, y_bottom / ch,
        x0 / cw, y_top / ch, x1 / cw, y_top / ch,
    ]
    offset_x = (x0 + x1) / 2.0 - cw / 2.0
    offset_y = (ch - y0 - y1) / 2.0
    return {
        "ver": "1.0.27",
        "importer": "image",
        "imported": True,
        "uuid": base_uuid,
        "files": [".json", ".png"],
        "subMetas": {
            "6c48a": {
                "importer": "texture",
                "uuid": f"{base_uuid}@6c48a",
                "displayName": display_name,
                "id": "6c48a",
                "name": "texture",
                "userData": {
                    "wrapModeS": "clamp-to-edge",
                    "wrapModeT": "clamp-to-edge",
                    "imageUuidOrDatabaseUri": base_uuid,
                    "isUuid": True,
                    "visible": False,
                    "minfilter": "nearest",
                    "magfilter": "nearest",
                    "mipfilter": "none",
                    "anisotropy": 0,
                },
                "ver": "1.0.22",
                "imported": True,
                "files": [".json"],
                "subMetas": {},
            },
            "f9941": {
                "importer": "sprite-frame",
                "uuid": f"{base_uuid}@f9941",
                "displayName": display_name,
                "id": "f9941",
                "name": "spriteFrame",
                "userData": {
                    "trimThreshold": 1,
                    "rotated": False,
                    "offsetX": offset_x,
                    "offsetY": offset_y,
                    "trimX": x0,
                    "trimY": y0,
                    "width": w,
                    "height": h,
                    "rawWidth": cw,
                    "rawHeight": ch,
                    "borderTop": 0,
                    "borderBottom": 0,
                    "borderLeft": 0,
                    "borderRight": 0,
                    "packable": True,
                    "pixelsToUnit": 100,
                    "pivotX": 0.5,
                    "pivotY": 0.5,
                    "meshType": 0,
                    "vertices": {
                        "rawPosition": [
                            -half_w, -half_h, 0, half_w, -half_h, 0,
                            -half_w, half_h, 0, half_w, half_h, 0,
                        ],
                        "indexes": [0, 1, 2, 2, 1, 3],
                        "uv": uv,
                        "nuv": nuv,
                        "minPos": [-half_w, -half_h, 0],
                        "maxPos": [half_w, half_h, 0],
                    },
                    "isUuid": True,
                    "imageUuidOrDatabaseUri": f"{base_uuid}@6c48a",
                    "atlasUuid": "",
                    "trimType": "auto",
                },
                "ver": "1.0.12",
                "imported": True,
                "files": [".json"],
                "subMetas": {},
            },
        },
        "userData": {
            "type": "sprite-frame",
            "hasAlpha": True,
            "fixAlphaTransparencyArtifacts": False,
            "redirect": f"{base_uuid}@6c48a",
        },
    }


def write_png(path: Path, im: Image.Image):
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, "PNG")
    meta_path = Path(str(path) + ".meta")
    old_uuid = None
    if meta_path.exists():
        try:
            old_uuid = json.loads(meta_path.read_text(encoding="utf-8")).get("uuid")
        except Exception:
            pass
    base_uuid = old_uuid or str(uuid.uuid4())
    meta = make_meta(path.stem, base_uuid, im.width, im.height, alpha_bbox(im))
    meta_path.write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def make_preview(items: list[tuple[str, Image.Image, Image.Image, dict]]):
    scale = 3
    cell_w = max(max(r.width, l.width) for _, r, l, _ in items) * scale + 20
    cell_h = max(max(r.height, l.height) for _, r, l, _ in items) * scale + 36
    canvas_w = 120 + 2 * (cell_w + 28)
    canvas_h = 48 + len(items) * (cell_h + 14)
    canvas = Image.new("RGBA", (canvas_w, canvas_h), (32, 34, 40, 255))
    draw = ImageDraw.Draw(canvas)
    try:
        font = ImageFont.truetype(r"C:\Windows\Fonts\msyh.ttc", 15)
        font_s = ImageFont.truetype(r"C:\Windows\Fonts\msyh.ttc", 12)
    except Exception:
        font = font_s = ImageFont.load_default()
    draw.text((12, 10), "自适应切头预览（按脖子最窄，每人高度不同）", fill=(235, 238, 245), font=font)

    y = 40
    for name, right, left, dbg in items:
        info = f"{name}  h={dbg['head_h']} neck_y={dbg['neck_y']}"
        draw.text((10, y + 8), info, fill=(120, 190, 255), font=font_s)
        x = 120
        for label, im in (("right", right), ("left", left)):
            big = im.resize((im.width * scale, im.height * scale), NEAREST)
            for yy in range(y, y + cell_h - 22, 8):
                for xx in range(x, x + cell_w, 8):
                    c = (60, 64, 74, 255) if ((xx // 8 + yy // 8) % 2 == 0) else (44, 48, 56, 255)
                    draw.rectangle(
                        [xx, yy, min(xx + 7, x + cell_w - 1), min(yy + 7, y + cell_h - 23)],
                        fill=c,
                    )
            ox = x + (cell_w - big.width) // 2
            oy = y + (cell_h - 22 - big.height) // 2
            canvas.alpha_composite(big, (ox, oy))
            draw.text(
                (x + 4, y + cell_h - 18),
                f"{label} {im.width}x{im.height}",
                fill=(170, 176, 190),
                font=font_s,
            )
            x += cell_w + 28
        y += cell_h + 14

    out = OUT_DIR / "_preview_heads.png"
    canvas.convert("RGB").save(out, quality=95)
    print("wrote", out)


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    RES_DIR.mkdir(parents=True, exist_ok=True)
    catalog = []
    preview = []

    for pid in range(1, 8):
        right_src = Image.open(frame_path(pid, 1)).convert("RGBA")
        left_src = Image.open(frame_path(pid, 4)).convert("RGBA")
        right_head, dbg_r = crop_head(right_src)
        left_head, dbg_l = crop_head(left_src)

        r_name = f"player{pid}_head_right.png"
        l_name = f"player{pid}_head_left.png"
        for folder in (OUT_DIR, RES_DIR):
            write_png(folder / r_name, right_head)
            write_png(folder / l_name, left_head)

        entry = {
            "id": f"player{pid}",
            "right": f"Image/ZuoJia/head/{r_name}",
            "left": f"Image/ZuoJia/head/{l_name}",
            "rightSize": [right_head.width, right_head.height],
            "leftSize": [left_head.width, left_head.height],
            "cutRight": dbg_r,
            "cutLeft": dbg_l,
            "note": "adaptive neck-pinch; source=Cocos 48x48 no extra scale",
        }
        catalog.append(entry)
        preview.append((f"player{pid}", right_head, left_head, dbg_r))
        print(
            f"player{pid}: R {right_head.size} (neck={dbg_r['neck_y']} h={dbg_r['head_h']})  "
            f"L {left_head.size} (neck={dbg_l['neck_y']} h={dbg_l['head_h']})"
        )

    text = json.dumps(catalog, ensure_ascii=False, indent=2) + "\n"
    (OUT_DIR / "catalog.json").write_text(text, encoding="utf-8")
    (RES_DIR / "catalog.json").write_text(text, encoding="utf-8")
    make_preview(preview)
    print("DONE", OUT_DIR)


if __name__ == "__main__":
    main()
