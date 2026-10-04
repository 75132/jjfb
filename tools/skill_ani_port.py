# -*- coding: utf-8 -*-
"""
技能帧序列(resources/Skill) -> Cocos AnimationClip(.anim)
==================================================================================
背景：
  上一版 skill_gif_port.py 只把 GIF 拆成散帧写进 assets/resources/Skill/。
  本脚本补上「动画」这一环：为每个技能生成 cc.AnimationClip，
  与工程既有 Monster / Robot 的 ani 目录同格式。

产物：
  assets/Image/Skill/            (+ Skill.meta, directory)
  assets/Image/Skill/ani/        (+ ani.meta, directory)
  assets/Image/Skill/ani/{short}.anim      (+ .anim.meta, animation-clip)

引用：
  _values 引用 assets/resources/Skill/{short}-{k}.png 的 spriteFrame
  （即 {base_uuid}@f9941，base_uuid 从既有 .png.meta 读取，保持稳定）
  _times 按 gif 自身帧延时累加，_duration = 总时长

用法：
  python skill_ani_port.py --dry      # 演练，只打印
  python skill_ani_port.py --apply    # 写盘
"""
import os
import re
import sys
import json
import uuid

from PIL import Image

GIF_DIR = r"D:/jjfbol-cocos/JJFB-Project/JJFBpojie/jjfb_成品汇总/特效导出/导出结果/gif"
COCOS = r"D:/jjfbol-cocos/jjfbol-cocos/jjfb"
RES_SKILL = os.path.join(COCOS, "assets", "resources", "Skill")
IMG_SKILL = os.path.join(COCOS, "assets", "Image", "Skill")
ANI_DIR = os.path.join(IMG_SKILL, "ani")

NAME_RE = re.compile(r"^xg\d+\.mrp__files_gunz__(.+)_xg\d+\.gif$", re.I)

WRAP_MODE = 2          # 与工程既有 anim 一致（2 = Loop）
SAMPLE = 60


# ---------------- 工具 ----------------
def read_meta_uuid(png_meta_path):
    """读 .png.meta 的 base uuid；已由编辑器导入过则同时拿 spriteFrame 子 uuid。"""
    if not os.path.exists(png_meta_path):
        return None
    try:
        m = json.load(open(png_meta_path, encoding="utf-8"))
    except Exception:
        return None
    base = m.get("uuid")
    if not base:
        return None
    sub = (m.get("subMetas") or {}).get("f9941") or {}
    sf_uuid = sub.get("uuid") or f"{base}@f9941"
    return {"base": base, "sprite_frame": sf_uuid}


def dir_meta(path):
    """目录 meta：schema 与工程既有 directory meta 一致；已存在则沿用 uuid。"""
    mp = path + ".meta"
    if os.path.exists(mp):
        try:
            return json.load(open(mp, encoding="utf-8"))
        except Exception:
            pass
    return {
        "ver": "1.2.0",
        "importer": "directory",
        "imported": True,
        "uuid": str(uuid.uuid4()),
        "files": [],
        "subMetas": {},
        "userData": {},
    }


def make_anim_meta(name, path):
    mp = path + ".meta"
    if os.path.exists(mp):
        try:
            m = json.load(open(mp, encoding="utf-8"))
            m.setdefault("userData", {})["name"] = name
            return m
        except Exception:
            pass
    return {
        "ver": "2.0.4",
        "importer": "animation-clip",
        "imported": True,
        "uuid": str(uuid.uuid4()),
        "files": [".bin"],
        "subMetas": {},
        "userData": {"name": name},
    }


def make_clip(name, times, duration, sf_uuids):
    values = [{"__uuid__": u, "__expectedType__": "cc.SpriteFrame"} for u in sf_uuids]
    return [
        {
            "__type__": "cc.AnimationClip", "_name": name, "_objFlags": 0,
            "__editorExtras__": {"embeddedPlayerGroups": []},
            "_native": "", "sample": SAMPLE, "speed": 1.0, "wrapMode": WRAP_MODE,
            "enableTrsBlending": False, "_duration": duration, "_hash": 0,
            "_tracks": [{"__id__": 1}], "_exoticAnimation": None, "_events": [],
            "_embeddedPlayers": [],
            "_additiveSettings": {"__id__": 6},
            "_auxiliaryCurveEntries": [],
        },
        {
            "__type__": "cc.animation.ObjectTrack",
            "_binding": {"__type__": "cc.animation.TrackBinding",
                         "path": {"__id__": 2}, "proxy": None},
            "_channel": {"__id__": 4},
        },
        {"__type__": "cc.animation.TrackPath", "_paths": [{"__id__": 3}, "spriteFrame"]},
        {"__type__": "cc.animation.ComponentPath", "component": "cc.Sprite"},
        {"__type__": "cc.animation.Channel", "_curve": {"__id__": 5}},
        {"__type__": "cc.ObjectCurve", "_times": times, "_values": values},
        {"__type__": "cc.AnimationClipAdditiveSettings", "enabled": False, "refClip": None},
    ]


def gif_delays(path):
    """返回 [delay秒, ...]，按帧；0 延时兜底 10ms。"""
    im = Image.open(path)
    n = getattr(im, "n_frames", 1)
    out = []
    for i in range(n):
        im.seek(i)
        d = im.info.get("duration", 0) or 0
        out.append(max(int(d), 10) / 1000.0)
    return out


# ---------------- 主流程 ----------------
def main():
    dry = "--apply" not in sys.argv

    if not os.path.isdir(GIF_DIR):
        print("源目录不存在:", GIF_DIR)
        return 1

    gifs = sorted(f for f in os.listdir(GIF_DIR) if f.lower().endswith(".gif"))
    plan, problems = [], []
    for f in gifs:
        m = NAME_RE.match(f)
        if not m:
            problems.append(f"未解析短名: {f}")
            continue
        short = m.group(1)
        delays = gif_delays(os.path.join(GIF_DIR, f))
        n = len(delays)

        # 逐帧取 spriteFrame uuid（必须已存在对应的 {short}-{k}.png.meta）
        sf = []
        miss = []
        for k in range(n):
            info = read_meta_uuid(os.path.join(RES_SKILL, f"{short}-{k}.png.meta"))
            if not info:
                miss.append(k)
            else:
                sf.append(info["sprite_frame"])
        if miss:
            problems.append(f"{short}: 缺少帧 meta {miss}")
            continue

        times, acc = [], 0.0
        for i in range(n):
            times.append(round(acc, 6))
            acc += delays[i]
        duration = round(acc, 6)
        plan.append({"short": short, "gif": f, "n": n,
                     "times": times, "duration": duration, "sf": sf})

    print(f"{'技能':<18}{'帧':>4}{'时长(s)':>10}  首帧延时/统一性")
    print("-" * 78)
    for p in plan:
        d = p["times"]
        step = [round(p["times"][i + 1] - p["times"][i], 4) for i in range(len(d) - 1)]
        uni = "统一" if len(set(step)) <= 1 else f"混合{len(set(step))}种"
        print(f"{p['short']:<18}{p['n']:>4}{p['duration']:>10.3f}  "
              f"{step[0] if step else 0:.4f}s({uni})")
    print("-" * 78)
    print(f"技能 {len(plan)} 个 | 帧合计 {sum(p['n'] for p in plan)} | "
          f"模式: {'演练(未写盘)' if dry else '已写盘'}")
    if problems:
        print("!! 问题:")
        for x in problems:
            print("   -", x)

    if dry:
        return 0

    os.makedirs(ANI_DIR, exist_ok=True)
    for d in (IMG_SKILL, ANI_DIR):
        with open(d + ".meta", "w", encoding="utf-8", newline="\n") as fp:
            fp.write(json.dumps(dir_meta(d), indent=2, ensure_ascii=False) + "\n")

    for p in plan:
        ap = os.path.join(ANI_DIR, p["short"] + ".anim")
        clip = make_clip(p["short"], p["times"], p["duration"], p["sf"])
        with open(ap, "w", encoding="utf-8", newline="\n") as fp:
            fp.write(json.dumps(clip, indent=2, ensure_ascii=False) + "\n")
        with open(ap + ".meta", "w", encoding="utf-8", newline="\n") as fp:
            fp.write(json.dumps(make_anim_meta(p["short"], ap), indent=2,
                                ensure_ascii=False) + "\n")

    print(f"写出 {len(plan)} 个 .anim(+meta) → {ANI_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
