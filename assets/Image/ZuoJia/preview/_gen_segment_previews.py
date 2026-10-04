# -*- coding: utf-8 -*-
"""Generate labeled mount frame-segment preview images."""
from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

PIC = Path(__file__).resolve().parents[1] / "pic"
OUT = Path(__file__).resolve().parent
OUT.mkdir(parents=True, exist_ok=True)

# Frame segment definitions taught by user
SPECS = {
    "car4": {
        "name": "神行座驾 car4",
        "groups": [
            ("朝左静态待机", [0]),
            ("左走 / 上走", [1, 2, 3, 4]),
            ("下走 / 右走", [5, 6, 7, 8]),
            ("朝右静态待机", [9]),
        ],
    },
    "zuojia4": {
        "name": "座驾-宙斯 zuojia4",
        "groups": [
            ("左上走", [0, 1, 2, 3, 4]),
            ("左上循环待机", [5, 6]),
            ("右下走", [7, 8, 9, 10, 11]),
            ("右下待机", [12, 13]),
        ],
    },
    "zuojia5": {
        "name": "座驾-阿瑞斯 zuojia5",
        "groups": [
            ("左上走", [0, 1, 2, 3, 4]),
            ("左上循环待机", [5, 6]),
            ("右下走", [7, 8, 9, 10, 11]),
            ("右下待机", [12, 13]),
        ],
    },
    "zuojia6": {
        "name": "座驾-波塞冬 zuojia6",
        "groups": [
            ("左上走", [0, 1, 2, 3, 4]),
            ("左上循环待机", [5, 6]),
            ("右下走", [7, 8, 9, 10, 11]),
            ("右下待机", [12, 13]),
        ],
    },
    "zuojia7": {
        "name": "座驾-哈迪斯 zuojia7",
        "groups": [
            ("左上走", [0, 1, 2, 3, 4]),
            ("左上循环待机", [5, 6]),
            ("右下走", [7, 8, 9, 10, 11]),
            ("右下待机", [12, 13]),
        ],
    },
    "zuojia8": {
        "name": "新座驾5 zuojia8",
        "groups": [
            ("左上走", [0, 1, 2, 3, 4]),
            ("左待机", [5, 6]),
            ("右下走", [7, 8, 9, 10, 11, 12]),
            ("右待机", [13]),
        ],
    },
    "zuojia9": {
        "name": "新座驾6 zuojia9",
        "groups": [
            ("左上走", [0, 1, 2, 3, 4, 5]),
            ("左待机", [6, 7]),
            ("右下走", [8, 9, 10, 11, 12, 13]),
            ("右循环待机", [14, 15]),
        ],
    },
}

font_candidates = [
    Path(r"C:\Windows\Fonts\msyh.ttc"),
    Path(r"C:\Windows\Fonts\simhei.ttf"),
    Path(r"C:\Windows\Fonts\simsun.ttc"),
]
FONT_PATH = next((p for p in font_candidates if p.exists()), None)

PAD = 16
CELL_GAP = 8
GROUP_GAP = 28
BG = (32, 34, 40, 255)
PANEL = (48, 52, 62, 255)
TEXT = (235, 238, 245, 255)
ACCENT = (120, 190, 255, 255)
MUTED = (170, 176, 190, 255)


def get_font(size: int) -> ImageFont.ImageFont:
    if FONT_PATH:
        try:
            return ImageFont.truetype(str(FONT_PATH), size)
        except Exception:
            pass
    return ImageFont.load_default()


TITLE_FONT = get_font(28)
GROUP_FONT = get_font(20)
LABEL_FONT = get_font(14)
NOTE_FONT = get_font(16)


def load_frame(mid: str, idx: int) -> Image.Image:
    path = PIC / f"{mid}-{idx}.png"
    if not path.exists():
        raise FileNotFoundError(path)
    return Image.open(path).convert("RGBA")


def draw_checker(draw: ImageDraw.ImageDraw, x: int, y: int, w: int, h: int) -> None:
    for yy in range(y, y + h, 8):
        for xx in range(x, x + w, 8):
            c = (60, 64, 74, 255) if ((xx // 8 + yy // 8) % 2 == 0) else (44, 48, 56, 255)
            draw.rectangle(
                [xx, yy, min(xx + 7, x + w - 1), min(yy + 7, y + h - 1)],
                fill=c,
            )


def make_preview(mid: str, spec: dict) -> Path:
    groups = []
    max_fw = max_fh = 0
    for gname, idxs in spec["groups"]:
        frames = []
        for i in idxs:
            im = load_frame(mid, i)
            frames.append((i, im))
            max_fw = max(max_fw, im.width)
            max_fh = max(max_fh, im.height)
        groups.append((gname, frames))

    scale = 2 if max_fw < 120 else 1
    cell_w = max_fw * scale
    cell_h = max_fh * scale

    title_h = 44
    note_h = 36
    row_heights = []
    for _gname, frames in groups:
        n = len(frames)
        row_heights.append(28 + cell_h + 22)

    canvas_w = max(
        PAD * 2
        + max(len(frames) for _, frames in groups) * cell_w
        + max(0, max(len(frames) for _, frames in groups) - 1) * CELL_GAP,
        720,
    )
    canvas_h = PAD + title_h + note_h + sum(row_heights) + GROUP_GAP * (len(groups) - 1) + PAD

    canvas = Image.new("RGBA", (canvas_w, canvas_h), BG)
    draw = ImageDraw.Draw(canvas)
    draw.text((PAD, PAD), spec["name"], font=TITLE_FONT, fill=TEXT)
    draw.text((PAD, PAD + 34), "帧分段预览（按你教的方向/状态）", font=NOTE_FONT, fill=MUTED)

    y = PAD + title_h + note_h
    for gi, (gname, frames) in enumerate(groups):
        row_h = row_heights[gi]
        draw.rounded_rectangle(
            [PAD // 2, y - 6, canvas_w - PAD // 2, y + row_h + 6],
            radius=10,
            fill=PANEL,
        )
        idxs = [i for i, _ in frames]
        label = f"{gname}   [{','.join(str(i) for i in idxs)}]"
        draw.text((PAD, y), label, font=GROUP_FONT, fill=ACCENT)

        x = PAD
        cy = y + 30
        for idx, im in frames:
            if scale != 1:
                im = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
            draw_checker(draw, x, cy, cell_w, cell_h)
            ox = x + (cell_w - im.width) // 2
            oy = cy + (cell_h - im.height) // 2
            canvas.alpha_composite(im, (ox, oy))
            draw.rectangle([x, cy, x + cell_w - 1, cy + cell_h - 1], outline=(90, 98, 112, 255))
            tag = f"{mid}-{idx}"
            tw = draw.textlength(tag, font=LABEL_FONT)
            draw.text((x + (cell_w - tw) / 2, cy + cell_h + 2), tag, font=LABEL_FONT, fill=MUTED)
            x += cell_w + CELL_GAP

        y += row_h + GROUP_GAP

    out = OUT / f"{mid}_segments.png"
    canvas.convert("RGB").save(out, quality=95)
    print("wrote", out, canvas.size)
    return out


def make_overview() -> Path:
    rows = []
    for mid, spec in SPECS.items():
        cells = []
        for gname, idxs in spec["groups"]:
            im = load_frame(mid, idxs[0])
            cells.append((f"{gname}\n{mid}-{idxs[0]}", im))
        rows.append((spec["name"], cells))

    scale = 2
    max_fw = max(im.width for _, cells in rows for _, im in cells)
    max_fh = max(im.height for _, cells in rows for _, im in cells)
    cell_w, cell_h = max_fw * scale, max_fh * scale
    title_w = 280
    canvas_w = title_w + PAD + 4 * (cell_w + CELL_GAP) + PAD
    canvas_h = PAD + 40 + len(rows) * (cell_h + 70) + PAD
    canvas = Image.new("RGBA", (canvas_w, canvas_h), BG)
    draw = ImageDraw.Draw(canvas)
    draw.text((PAD, 8), "座驾帧分段总览（每组取首帧）", font=TITLE_FONT, fill=TEXT)

    y = 50
    for name, cells in rows:
        draw.text((PAD, y + cell_h // 2 - 10), name, font=GROUP_FONT, fill=ACCENT)
        x = title_w
        for label, im in cells:
            im2 = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
            draw_checker(draw, x, y, cell_w, cell_h)
            ox = x + (cell_w - im2.width) // 2
            oy = y + (cell_h - im2.height) // 2
            canvas.alpha_composite(im2, (ox, oy))
            draw.rectangle([x, y, x + cell_w - 1, y + cell_h - 1], outline=(90, 98, 112, 255))
            draw.multiline_text((x + 4, y + cell_h + 2), label, font=LABEL_FONT, fill=MUTED, spacing=1)
            x += cell_w + CELL_GAP
        y += cell_h + 70

    out = OUT / "_overview_segments.png"
    canvas.convert("RGB").save(out, quality=95)
    print("wrote", out, canvas.size)
    return out


def main() -> None:
    for mid, spec in SPECS.items():
        make_preview(mid, spec)
    make_overview()

    seg = {
        mid: {
            "name": spec["name"],
            "groups": [{"label": g, "frames": idxs} for g, idxs in spec["groups"]],
        }
        for mid, spec in SPECS.items()
    }
    seg_path = OUT / "segment_map.json"
    seg_path.write_text(json.dumps(seg, ensure_ascii=False, indent=2), encoding="utf-8")
    print("wrote", seg_path)
    print("ALL OK")


if __name__ == "__main__":
    main()
