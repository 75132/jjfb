# -*- coding: utf-8 -*-
"""
座驾（ZuoJia）帧序列 -> Cocos AnimationClip
==================================================================================
参考：tools/robot_gif_port.py / tools/monster/monster_port.py

规格：
  · 帧时间按 GIF 自身 delay（实测均为 120ms）
  · 按 segment_map.json 拆成 4 个 clip：
      {id}_walk_ul / {id}_idle_ul / {id}_walk_dr / {id}_idle_dr
  · 双写 Image/ZuoJia/ani + resources/ZuoJia/ani（运行时 resources.load）
  · SpriteFrame uuid 取自 Image/ZuoJia/pic/{id}-{i}.png.meta

用法：
  python tools/zuojia_ani_port.py --dry
  python tools/zuojia_ani_port.py --apply
"""
from __future__ import annotations

import argparse
import json
import os
import uuid
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PIC_DIR = ROOT / "assets" / "Image" / "ZuoJia" / "pic"
GIF_DIR = ROOT / "assets" / "Image" / "ZuoJia" / "gif"
SEG_MAP = ROOT / "assets" / "Image" / "ZuoJia" / "preview" / "segment_map.json"
ANI_IMAGE = ROOT / "assets" / "Image" / "ZuoJia" / "ani"
ANI_RES = ROOT / "assets" / "resources" / "ZuoJia" / "ani"

# label -> clip suffix（与运行时 MountController 约定一致）
LABEL_TO_CLIP = {
    "朝左静态待机": "idle_ul",
    "左走 / 上走": "walk_ul",
    "下走 / 右走": "walk_dr",
    "朝右静态待机": "idle_dr",
    "左上走": "walk_ul",
    "左上循环待机": "idle_ul",
    "左待机": "idle_ul",
    "右下走": "walk_dr",
    "右下待机": "idle_dr",
    "右待机": "idle_dr",
    "右循环待机": "idle_dr",
}


def load_gif_delays(gif_path: Path) -> list[float]:
    """返回每帧 delay（秒）。缺省 0.12。"""
    im = Image.open(gif_path)
    delays: list[float] = []
    try:
        while True:
            ms = im.info.get("duration", 120) or 120
            delays.append(max(0.01, float(ms) / 1000.0))
            im.seek(im.tell() + 1)
    except EOFError:
        pass
    return delays


def read_frame_uuid(mount_id: str, idx: int) -> str:
    meta_path = PIC_DIR / f"{mount_id}-{idx}.png.meta"
    if not meta_path.exists():
        raise FileNotFoundError(meta_path)
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    base = meta.get("uuid")
    if not base:
        raise ValueError(f"meta 缺 uuid: {meta_path}")
    return f"{base}@f9941"


def make_anim(name: str, frame_uuids: list[str], delays: list[float]) -> list:
    times: list[float] = []
    acc = 0.0
    for i in range(len(frame_uuids)):
        times.append(round(acc, 6))
        acc += delays[i] if i < len(delays) else 0.12
    duration = round(acc, 6)
    values = [{"__uuid__": u, "__expectedType__": "cc.SpriteFrame"} for u in frame_uuids]
    return [
        {
            "__type__": "cc.AnimationClip",
            "_name": name,
            "_objFlags": 0,
            "__editorExtras__": {"embeddedPlayerGroups": []},
            "_native": "",
            "sample": 60,
            "speed": 1.0,
            "wrapMode": 2,
            "enableTrsBlending": False,
            "_duration": duration,
            "_hash": 0,
            "_tracks": [{"__id__": 1}],
            "_exoticAnimation": None,
            "_events": [],
            "_embeddedPlayers": [],
            "_additiveSettings": {"__id__": 6},
            "_auxiliaryCurveEntries": [],
        },
        {
            "__type__": "cc.animation.ObjectTrack",
            "_binding": {
                "__type__": "cc.animation.TrackBinding",
                "path": {"__id__": 2},
                "proxy": None,
            },
            "_channel": {"__id__": 4},
        },
        {
            "__type__": "cc.animation.TrackPath",
            "_paths": [{"__id__": 3}, "spriteFrame"],
        },
        {"__type__": "cc.animation.ComponentPath", "component": "cc.Sprite"},
        {"__type__": "cc.animation.Channel", "_curve": {"__id__": 5}},
        {"__type__": "cc.ObjectCurve", "_times": times, "_values": values},
        {
            "__type__": "cc.AnimationClipAdditiveSettings",
            "enabled": False,
            "refClip": None,
        },
    ]


def make_anim_meta(ani_id: str, base_uuid: str | None = None) -> dict:
    return {
        "ver": "2.0.4",
        "importer": "animation-clip",
        "imported": True,
        "uuid": base_uuid or str(uuid.uuid4()),
        "files": [".bin"],
        "subMetas": {},
        "userData": {"name": ani_id},
    }


def write_anim(ani_id: str, frame_uuids: list[str], delays: list[float], dry: bool) -> tuple[list[float], float]:
    clip = make_anim(ani_id, frame_uuids, delays)
    times = clip[5]["_times"]
    duration = clip[0]["_duration"]
    if dry:
        return times, duration

    text = json.dumps(clip, indent=2, ensure_ascii=False) + "\n"
    for out_dir in (ANI_IMAGE, ANI_RES):
        out_dir.mkdir(parents=True, exist_ok=True)
        anim_path = out_dir / f"{ani_id}.anim"
        anim_path.write_text(text, encoding="utf-8")
        meta_path = Path(str(anim_path) + ".meta")
        if meta_path.exists():
            old = json.loads(meta_path.read_text(encoding="utf-8"))
            base_uuid = old.get("uuid") or str(uuid.uuid4())
        else:
            base_uuid = str(uuid.uuid4())
        meta_path.write_text(
            json.dumps(make_anim_meta(ani_id, base_uuid), indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
    return times, duration


def build_clips_for_mount(mount_id: str, groups: list[dict], all_delays: list[float], dry: bool) -> int:
    count = 0
    for g in groups:
        label = g["label"]
        frames = list(g["frames"])
        suffix = LABEL_TO_CLIP.get(label)
        if not suffix:
            raise ValueError(f"{mount_id}: 未知分段 label={label!r}")
        ani_id = f"{mount_id}_{suffix}"
        uuids = [read_frame_uuid(mount_id, i) for i in frames]
        delays = [all_delays[i] if i < len(all_delays) else 0.12 for i in frames]
        times, duration = write_anim(ani_id, uuids, delays, dry=dry)
        print(
            f"  {ani_id:<22} frames={frames} duration={duration:.3f}s "
            f"step≈{delays[0]*1000:.0f}ms dry={dry}"
        )
        count += 1
    return count


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry", action="store_true")
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()
    dry = not args.apply

    seg = json.loads(SEG_MAP.read_text(encoding="utf-8"))
    total = 0
    for mount_id, info in seg.items():
        gif = GIF_DIR / f"{mount_id}.gif"
        if not gif.exists():
            raise FileNotFoundError(gif)
        delays = load_gif_delays(gif)
        print(f"[{mount_id}] gif_frames={len(delays)} delay_ms={sorted(set(int(d*1000) for d in delays))}")
        total += build_clips_for_mount(mount_id, info["groups"], delays, dry=dry)
    print(f"\nDONE clips={total} dry={dry}")
    if dry:
        print("提示: 加 --apply 才会写入 .anim")


if __name__ == "__main__":
    main()
