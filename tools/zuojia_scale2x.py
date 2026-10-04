# -*- coding: utf-8 -*-
"""座驾帧硬边缘 2 倍放大（NEAREST），保留 uuid，并重写 meta 尺寸。"""
from __future__ import annotations

import json
import uuid
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DIRS = [
    ROOT / "assets" / "Image" / "ZuoJia" / "pic",
    ROOT / "assets" / "resources" / "ZuoJia",
]
SCALE = 2
NEAREST = getattr(getattr(Image, "Resampling", Image), "NEAREST", Image.NEAREST)


def alpha_bbox(img: Image.Image):
    return img.convert("RGBA").getchannel("A").getbbox()


def make_meta(display_name, base_uuid, cw, ch, bbox, minfilter, magfilter):
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
                    "minfilter": minfilter,
                    "magfilter": magfilter,
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


def scale_dir(d: Path) -> int:
    n = 0
    for png in sorted(d.glob("*.png")):
        # skip non-frame files
        if png.name == "catalog.json":
            continue
        meta_path = Path(str(png) + ".meta")
        img = Image.open(png).convert("RGBA")
        w, h = img.size
        # 已放大过则跳过（按文件名对应的常见原尺寸阈值：原图最大约 96）
        # 用 meta rawWidth 判断更稳
        old_uuid = None
        minf, magf = "nearest", "nearest"
        if meta_path.exists():
            old = json.loads(meta_path.read_text(encoding="utf-8"))
            old_uuid = old.get("uuid")
            tex = (old.get("subMetas") or {}).get("6c48a") or {}
            ud = tex.get("userData") or {}
            minf = ud.get("minfilter", "nearest")
            magf = ud.get("magfilter", "nearest")
            sf = (old.get("subMetas") or {}).get("f9941") or {}
            sud = sf.get("userData") or {}
            raw_w = int(sud.get("rawWidth") or w)
            # 若 raw 已经明显是 2 倍（>= 140 且为偶数帧座驾），仍允许对当前文件再判断：
            # 以「当前 png 尺寸」为准：若宽>120 且已有 scale marker 则跳过
        marker = d / ".scaled2x"
        # 简单策略：若存在全局 marker 且该 png 宽>=120，跳过
        if marker.exists() and w >= 120:
            continue

        out = img.resize((w * SCALE, h * SCALE), NEAREST)
        out.save(png, "PNG")
        base_uuid = old_uuid or str(uuid.uuid4())
        meta = make_meta(png.stem, base_uuid, out.width, out.height, alpha_bbox(out), minf, magf)
        meta_path.write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"  {png.name}: {w}x{h} -> {out.width}x{out.height}")
        n += 1
    return n


def main():
    total = 0
    for d in DIRS:
        if not d.exists():
            print("skip missing", d)
            continue
        print("[scale]", d)
        total += scale_dir(d)
        (d / ".scaled2x").write_text("2\n", encoding="utf-8")
    print("DONE scaled", total)


if __name__ == "__main__":
    main()
