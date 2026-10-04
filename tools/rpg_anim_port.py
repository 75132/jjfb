# -*- coding: utf-8 -*-
"""
RPG Maker MV 战斗动画  ->  Cocos 帧序列 + AnimationClip
==================================================================================
背景：
  技能表里 13 个技能暂无特效动画（0037/0038/0039/0041~0047/0049~0051）。
  用户要求：把 RPG Maker 工程里的"特写动画"转成 Cocos 动画补进来。

数据源：
  D:/机甲风暴开发素材合集/机甲风暴2/data/Animations.json     (133 个动画定义)
  D:/机甲风暴开发素材合集/机甲风暴2/img/animations/*.png      (120 张图集)

图集布局（本工程实测，非 MV 标准 5x4）：
  格边长固定 192；列数 = W/192；行数 = H/192；索引行优先线性。
  （验证依据：pattern 最大值普遍超过 20，但均 < (W/192)*(H/192)；
    唯一例外 nmqs，本批未使用）
  pattern >= 100 表示使用第二个图集(animation2Name)，实际索引 = pattern - 100

渲染规则（复刻 MV Sprite_Animation.updateFrame + canvas context）：
  每帧清空画布，按 frames[i] 顺序绘制各 cell：
    ctx.translate(fw/2 + x, fh/2 + y)
    ctx.rotate(rotation 度, 顺时针)
    ctx.scale(mirror ? -1 : 1, 1)
    ctx.globalAlpha = opacity/255
    ctx.globalCompositeOperation = [source-over, lighter, multiply, screen][blend]
    drawImage(atlas, sx, sy, 192, 192,
              -192*scale/200, -192*scale/200, 192*scale/100, 192*scale/100)

★ 画布尺寸（2026-10-01 修「特效被裁」）：
  MV 的 `position=3`（画面级）动画，图元偏移可以远超 192 格（虚空导弹 x ∈ [-408, 312]，
  251 个图元里 211 个在 192 格之外）。原先固定用 192×192 画布 + `Image.paste` →
  **超出的部分被静默裁掉**（预览图里魔法阵左侧缺一块就是这个原因）。
  现在改为 `anim_window()` 先算出「整段动画所有图元（含旋转/缩放后的包围盒）」的并集范围，
  画布按该范围开（最少仍是 192×192 以保持普通动画原有取景），再统一裁到实际 alpha 并集 bbox。
  判定标准：把画布再放大一圈重渲染，alpha bbox 不变 = 一点没裁（见 `_test_skill_anim_assets.py`）。

输出：
  assets/resources/Skill/{短名}-{k}.png(+.png.meta)   原比例（UPSCALE=1，★2026-10-01 用户口径），
                                                     画布 = 全动画图元并集，统一裁到全部帧的 alpha 并集 bbox
  assets/Image/Skill/ani/{短名}.anim(+.anim.meta)     cc.AnimationClip，_values 引用帧的 @f9941

帧时长：MV 每帧 4 tick @60fps = 0.0667s（原生节奏，保留原始手感）。
        首尾全空帧自动剔除，避免 Cocos 里出现无意义空白。

用法：
  python rpg_anim_port.py --dry       演练，打印计划
  python rpg_anim_port.py --check     防「被裁」自检（画布放大一圈重渲染比对）
  python rpg_anim_port.py --preview   生成预览拼图（不写 assets）
  python rpg_anim_port.py --apply     写盘
  python rpg_anim_port.py --only guangrenzhan,xukongchongji --apply
"""
import os
import re
import sys
import json
import math
import uuid

from PIL import Image, ImageChops

RPG = r"D:/机甲风暴开发素材合集/机甲风暴2"
COCOS = r"D:/jjfbol-cocos/jjfbol-cocos/jjfb"
RES_SKILL = os.path.join(COCOS, "assets", "resources", "Skill")
IMG_SKILL = os.path.join(COCOS, "assets", "Image", "Skill")
ANI_DIR = os.path.join(IMG_SKILL, "ani")
PREVIEW = os.path.join(COCOS, "tools", "_preview")

CELL = 192            # 图集格边长
UPSCALE = 1           # ★2026-10-01 用户口径：RPG 移植的特效**原比例**（MV 原生 192 格尺寸本就贴合，
                      #   放大 2x 会导致特效超出可视觉范围/被裁，表现「不全」）。
                      #   ⚠ 用户自己的素材（`skill_gif_port.py`，xg1/xg2 导出）**保持 2x 不动**。
FRAME_SEC = 4 / 60.0  # MV 每帧时长
SAMPLE = 60
WRAP_MODE = 2
PAD = 4               # 画布安全边：吸收旋转/取整误差，保证不会有 1px 被裁
BLEND_NAMES = ["normal", "add", "multiply", "screen"]

# (技能名, 输出短名, RPG动画 id)
MAPPING = [
    ("光刃斩",     "guangrenzhan",       7),    # 斩击/特效      Slash + SlashPhoton
    ("超能拳",     "chaonengquan",       2),    # 打击/特效      Hit1 + HitPhoton
    ("雷霆震慑",   "leitingzhenshe",     5),    # 打击/雷        Hit2 + HitThunder
    ("雷霆冲击",   "leitingchongji",    77),    # 雷/单体2       Thunder2
    ("离子激光",   "lizijiguang",      115),    # 激光/单发      Laser1
    ("等离子弹幕", "denglizidanmu",    113),    # 铳击/全体      Gun1
    ("虚空导弹",   "xukongdaodan",     110),    # 无属性/全体3   Meteor + Gun2
    ("能量爆破",   "nengliangbaopo",   109),    # 无属性/全体2   Explosion2 + Explosion1
    ("电磁风暴",   "diancifengbao",     80),    # 雷/全体3       PreSpecial1 + Thunder5
    ("时空扭曲",   "shikongniuqu",      30),    # 通用/必杀技1   Special1 + Special2
    ("引力压制",   "yinliyazhi",        31),    # 通用/必杀技2   Special3
    ("等离子屏障", "denglizipingzhang", 118),   # 光柱2          Light2
    ("虚空冲击",   "xukongchongji",    105),    # 暗/全体3       PreSpecial3 + Darkness5
    ("生命恢复",   "shengminghuifu",    41),    # 恢复/单体1     Recovery1（绿色光环）
    ("能量恢复",   "nenglianghuifu",    45),    # 治疗/单体1     Cure1（青蓝波纹）
]

_ATLAS = {}


def atlas(name):
    """返回 (Image, cols, rows)；按 192 定尺切格。"""
    if name not in _ATLAS:
        p = os.path.join(RPG, "img", "animations", name + ".png")
        if not os.path.exists(p):
            _ATLAS[name] = None
        else:
            im = Image.open(p).convert("RGBA")
            _ATLAS[name] = (im, im.width // CELL, im.height // CELL)
    return _ATLAS[name]


def tile(a, idx):
    if a is None or idx < 0:
        return None
    im, cols, rows = a
    if idx >= cols * rows:
        return None
    x = (idx % cols) * CELL
    y = (idx // cols) * CELL
    return im.crop((x, y, x + CELL, y + CELL))


# ---------------- 混合（纯 PIL，无 numpy） ----------------
def _rgb(im):
    return im.convert("RGB")


def blend(base, layer, mode):
    """把 layer(RGBA) 按混合模式叠到 base(RGBA) 上。"""
    if mode == 0:                                  # source-over
        return Image.alpha_composite(base, layer)

    ba, la = base.getchannel("A"), layer.getchannel("A")

    # layer RGB 预乘自身 alpha（canvas 的 globalAlpha / 非全不透明像素）
    lr, lg, lb = layer.split()[:3]
    pr = ImageChops.multiply(lr, la)
    pg = ImageChops.multiply(lg, la)
    pb = ImageChops.multiply(lb, la)
    prem = Image.merge("RGB", (pr, pg, pb))

    if mode == 1:                                  # lighter（加算）
        rgb = ImageChops.add(_rgb(base), prem)
    elif mode == 2:                                # multiply
        inv = ImageChops.invert(la)
        # base*(1-a) + base*layer*a
        rgb = ImageChops.add(
            ImageChops.multiply(_rgb(base), inv),
            ImageChops.multiply(ImageChops.multiply(_rgb(base), _rgb(layer)), la),
        )
    elif mode == 3:                                # screen
        # 255-(255-base)(255-layer)/255
        scr = ImageChops.invert(ImageChops.multiply(
            ImageChops.invert(_rgb(base)), ImageChops.invert(_rgb(layer))))
        rgb = ImageChops.add(
            ImageChops.multiply(_rgb(base), ImageChops.invert(la)),
            ImageChops.multiply(scr, la),
        )
    else:
        return Image.alpha_composite(base, layer)

    out = Image.merge("RGBA", (*rgb.split()[:3], ImageChops.add(ba, la)))
    return out


# ---------------- 画布范围（★修「特效被裁」） ----------------
def _tile_extent(cell):
    """单个图元绘制后的包围盒（相对 192 格坐标系，单位 px）。

    复刻 MV：`ctx.translate(CELL/2 + x, CELL/2 + y)` 后以**格中心**为锚点绘制，
    缩放 `scale`、旋转 `rotation`。旋转用精确的 AABB（|cos|/|sin| 展开），
    `PIL.rotate(expand=True)` 的实际外接框与之相差 ≤1px，再由 `PAD` 兜住。
    """
    if not cell or len(cell) < 8:
        return None
    pattern = cell[0]
    if pattern is None or pattern < 0:
        return None
    x = cell[1] or 0
    y = cell[2] or 0
    scale = (cell[3] or 100) / 100.0
    rot = cell[4] or 0
    w = h = CELL * scale
    if rot:
        a = math.radians(rot)
        ca, sa = abs(math.cos(a)), abs(math.sin(a))
        w, h = w * ca + h * sa, w * sa + h * ca
    cx, cy = CELL / 2 + x, CELL / 2 + y
    return (cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2)


def anim_window(anim):
    """整段动画所有图元的并集范围 → `(left, top, right, bottom)`（整数，含 PAD）。

    下限锁死到原生 192 格 `[0, CELL]`：普通（贴目标）动画取景**完全不变**，
    只有真正越界的图元（画面级动画）才会把画布撑大。
    """
    minx = miny = 0.0
    maxx = maxy = float(CELL)
    for frame in anim.get("frames", []):
        for cell in frame:
            e = _tile_extent(cell)
            if e is None:
                continue
            minx, miny = min(minx, e[0]), min(miny, e[1])
            maxx, maxy = max(maxx, e[2]), max(maxy, e[3])
    return (int(math.floor(minx)) - PAD, int(math.floor(miny)) - PAD,
            int(math.ceil(maxx)) + PAD, int(math.ceil(maxy)) + PAD)


# ---------------- 单帧渲染 ----------------
def render_frame(anim, frame, win=None):
    """把 Animations.json 的一个 frames[i] 渲染成 RGBA（画布 = `win`，默认 192 格）。"""
    if win is None:
        win = (0, 0, CELL, CELL)
    ox, oy = -win[0], -win[1]
    cw, ch = win[2] - win[0], win[3] - win[1]
    canvas = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    a1 = atlas(anim.get("animation1Name") or "")
    a2 = atlas(anim.get("animation2Name") or "")

    for cell in frame:
        if not cell or len(cell) < 8:
            continue
        pattern = cell[0]
        if pattern is None or pattern < 0:
            continue
        if pattern >= 100:
            src, idx = a2, pattern - 100
        else:
            src, idx = a1, pattern

        t = tile(src, idx)
        if t is None:
            continue

        x, y = cell[1], cell[2]
        scale = (cell[3] or 100) / 100.0
        rotation = cell[4] or 0
        mirror = bool(cell[5])
        opacity = 255 if cell[6] is None else cell[6]
        mode = cell[7] or 0

        if mirror:
            t = t.transpose(Image.FLIP_LEFT_RIGHT)

        w = max(1, int(round(CELL * scale)))
        h = max(1, int(round(CELL * scale)))
        if (w, h) != t.size:
            t = t.resize((w, h), Image.NEAREST)

        if rotation:
            # canvas.rotate 顺时针为正；PIL 逆时针为正
            t = t.rotate(-rotation, resample=Image.NEAREST, expand=True)

        if opacity < 255:
            t.putalpha(t.getchannel("A").point(lambda v: v * opacity // 255))

        layer = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
        layer.paste(t, (int(round(ox + CELL / 2 + x - t.width / 2)),
                        int(round(oy + CELL / 2 + y - t.height / 2))), t)
        canvas = blend(canvas, layer, mode)

    return canvas


def render_clip(anim, win=None):
    """渲染整个动画，返回 frames[Image]（画布 = win）。"""
    if win is None:
        win = anim_window(anim)
    return [render_frame(anim, frame, win) for frame in anim.get("frames", [])]


# ---------------- 产物写盘 ----------------
def png_meta(base_uuid, name, w, h):
    """照抄工程既有 image meta 全量结构，uuid 立即生效，编辑器无需补全。"""
    return {
        "ver": "1.0.27", "importer": "image", "imported": True,
        "uuid": base_uuid, "files": [".json", ".png"],
        "subMetas": {
            "6c48a": {
                "importer": "texture", "uuid": f"{base_uuid}@6c48a",
                "displayName": name, "id": "6c48a", "name": "texture",
                "userData": {
                    "wrapModeS": "clamp-to-edge", "wrapModeT": "clamp-to-edge",
                    "imageUuidOrDatabaseUri": base_uuid, "isUuid": True,
                    "visible": False, "minfilter": "linear", "magfilter": "linear",
                    "mipfilter": "none", "anisotropy": 0,
                },
                "ver": "1.0.22", "imported": True, "files": [".json"], "subMetas": {},
            },
            "f9941": {
                "importer": "sprite-frame", "uuid": f"{base_uuid}@f9941",
                "displayName": name, "id": "f9941", "name": "spriteFrame",
                "userData": {
                    "trimThreshold": 1, "rotated": False, "offsetX": 0, "offsetY": 0,
                    "trimX": 0, "trimY": 0, "width": w, "height": h,
                    "rawWidth": w, "rawHeight": h,
                    "borderTop": 0, "borderBottom": 0, "borderLeft": 0, "borderRight": 0,
                    "packable": True, "pixelsToUnit": 100,
                    "pivotX": 0.5, "pivotY": 0.5, "meshType": 0,
                    "vertices": {
                        "rawPosition": [-w // 2, -h // 2, 0, w // 2, -h // 2, 0,
                                        -w // 2, h // 2, 0, w // 2, h // 2, 0],
                        "indexes": [0, 1, 2, 2, 1, 3],
                        "uv": [0, h, w, h, 0, 0, w, 0],
                        "nuv": [0, 0, 1, 0, 0, 1, 1, 1],
                        "minPos": [-w // 2, -h // 2, 0],
                        "maxPos": [w // 2, h // 2, 0],
                    },
                    "isUuid": True,
                    "imageUuidOrDatabaseUri": f"{base_uuid}@6c48a",
                    "atlasUuid": "", "trimType": "none",
                },
                "ver": "1.0.12", "imported": True, "files": [".json"], "subMetas": {},
            },
        },
        "userData": {
            "type": "sprite-frame", "hasAlpha": True,
            "fixAlphaTransparencyArtifacts": False, "redirect": f"{base_uuid}@6c48a",
        },
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
            "_embeddedPlayers": [], "_additiveSettings": {"__id__": 6},
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


def anim_meta(name, uid=None):
    return {
        "ver": "2.0.4", "importer": "animation-clip", "imported": True,
        "uuid": uid or str(uuid.uuid4()), "files": [".bin"], "subMetas": {},
        "userData": {"name": name},
    }


def existing_uuid(path):
    """★幂等：目标 `.meta` 已存在则**复用其 uuid**。

    否则重新生成会换 uuid，而 `assets/UIPrefab/RobotShow.prefab` 的 Animation
    播放列表是按 uuid 引用 clip 的 → 换 uuid 会让技能特效静默播不出来。
    （2026-10-01 踩过：UPSCALE 2→1 重生成后 15 个 anim uuid 全变，prefab 引用全断。）
    """
    try:
        if os.path.exists(path):
            return json.load(open(path, encoding="utf-8")).get("uuid")
    except Exception:
        pass
    return None


# ---------------- 主流程 ----------------
def build(only=None):
    d = json.load(open(os.path.join(RPG, "data", "Animations.json"), encoding="utf-8"))
    by_id = {a["id"]: a for a in d[1:] if a}

    plan, problems = [], []
    for skill, short, aid in MAPPING:
        if only and short not in only:
            continue
        a = by_id.get(aid)
        if not a:
            problems.append(f"{skill}: 找不到 RPG 动画 id={aid}")
            continue

        # ★画布 = 整段动画所有图元的并集（不再固定 192 → 画面级动画不会被裁）
        win = anim_window(a)
        frames = render_clip(a, win)

        # 剔除首尾全空帧
        def empty(im):
            return im.getbbox() is None
        lo, hi = 0, len(frames)
        while lo < hi and empty(frames[lo]):
            lo += 1
        while hi > lo and empty(frames[hi - 1]):
            hi -= 1
        if hi <= lo:
            problems.append(f"{skill}: 动画 id={aid} 渲染结果全空")
            continue
        frames = frames[lo:hi]

        # 全部帧的并集 bbox，统一裁剪（保证各帧尺寸一致，动画不抖）
        union = None
        for im in frames:
            bb = im.getbbox()
            if bb is None:
                continue
            union = bb if union is None else (
                min(union[0], bb[0]), min(union[1], bb[1]),
                max(union[2], bb[2]), max(union[3], bb[3]),
            )
        if union is None:
            problems.append(f"{skill}: 并集 bbox 为空")
            continue

        w = (union[2] - union[0]) * UPSCALE
        h = (union[3] - union[1]) * UPSCALE
        plan.append({
            "skill": skill, "short": short, "rpg_id": aid, "rpg_name": a["name"],
            "atlas": "+".join(x for x in (a.get("animation1Name"), a.get("animation2Name")) if x),
            "n": len(frames), "duration": round(len(frames) * FRAME_SEC, 6),
            "frames": frames, "box": union, "w": w, "h": h, "window": win,
            "anim": a, "position": a.get("position"),
        })
    return plan, problems


# ---------------- 防「被裁」自检 ----------------
CLIP_SLACK = 64      # 复检时四周额外放大的像素


def _union_bbox(frames):
    u = None
    for im in frames:
        bb = im.getbbox()
        if bb is None:
            continue
        u = bb if u is None else (min(u[0], bb[0]), min(u[1], bb[1]),
                                  max(u[2], bb[2]), max(u[3], bb[3]))
    return u


def check_not_clipped(plan, slack=CLIP_SLACK, tol=1):
    """★防「特效被裁」：把画布四周再放大 `slack` 像素重渲染。

    画布够大 → alpha 并集 bbox 只是整体平移，形状一模一样；
    画布裁掉了内容 → bbox 会变小/变形。返回不一致的条目列表。
    """
    bad = []
    for p in plan:
        w0 = p["window"]
        w1 = (w0[0] - slack, w0[1] - slack, w0[2] + slack, w0[3] + slack)
        big = _union_bbox(render_clip(p["anim"], w1))
        if big is None:
            continue
        shift = (w1[0] - w0[0], w1[1] - w0[1])          # 负数 = 画布往左上扩
        moved = (big[0] + shift[0], big[1] + shift[1],
                 big[2] + shift[0], big[3] + shift[1])  # 换算回原画布坐标
        if any(abs(moved[i] - p["box"][i]) > tol for i in range(4)):
            bad.append({"short": p["short"], "box": p["box"], "big": moved})
    return bad


def main():
    argv = sys.argv[1:]
    dry = "--apply" not in argv
    do_preview = "--preview" in argv
    only = None
    if "--only" in argv:
        only = set(argv[argv.index("--only") + 1].split(","))

    plan, problems = build(only)

    print(f"{'技能':<12}{'RPG动画':<14}{'id':>4}{'帧':>5}{'时长':>8}{'画布':>12}{'窗口':>12}  {'图集':<30}")
    print("-" * 108)
    for p in plan:
        wn = (p["window"][2] - p["window"][0], p["window"][3] - p["window"][1])
        print(f"{p['skill']:<12}{p['rpg_name']:<14}{p['rpg_id']:>4}{p['n']:>5}"
              f"{p['duration']:>7.2f}s{str((p['w'], p['h'])):>12}{str(wn):>12}  {p['atlas']:<30}")
    print("-" * 108)
    print(f"技能 {len(plan)} | 帧合计 {sum(p['n'] for p in plan)} | "
          f"放大 {UPSCALE}x | 帧时长 {FRAME_SEC:.4f}s | "
          f"模式 {'演练' if dry else '写盘'}{' + 预览' if do_preview else ''}")
    if problems:
        print("!! 问题:")
        for x in problems:
            print("   -", x)

    if "--check" in argv:
        bad = check_not_clipped(plan)
        print("[防裁自检] 画布四周 +%dpx 重渲染比对：%s"
              % (CLIP_SLACK, "全部一致 ✓" if not bad else "%d 条不一致 ✗" % len(bad)))
        for b in bad:
            print("   - %s 原 bbox=%s 放大后 bbox=%s" % (b["short"], b["box"], b["big"]))
        return 1 if bad else 0

    if do_preview and plan:
        os.makedirs(PREVIEW, exist_ok=True)
        for p in plan:
            cols = min(p["n"], 8)
            rows = (p["n"] + cols - 1) // cols
            cw, ch = p["w"], p["h"]
            sheet = Image.new("RGBA", (cols * (cw + 6) + 6, rows * (ch + 6) + 6),
                              (24, 24, 28, 255))
            for k, im in enumerate(p["frames"]):
                crop = im.crop(p["box"]).resize((cw, ch), Image.NEAREST)
                sheet.alpha_composite(crop, (6 + (k % cols) * (cw + 6),
                                             6 + (k // cols) * (ch + 6)))
            sheet.save(os.path.join(PREVIEW, f"rpg_{p['short']}.png"))
        print(f"预览图 -> {PREVIEW}/rpg_*.png")

    if dry:
        return 0

    os.makedirs(ANI_DIR, exist_ok=True)
    for p in plan:
        short = p["short"]
        sf = []
        for k, im in enumerate(p["frames"]):
            crop = im.crop(p["box"]).resize((p["w"], p["h"]), Image.NEAREST)
            png = os.path.join(RES_SKILL, f"{short}-{k}.png")
            # ★幂等：`.meta` 已存在则复用旧 uuid（重生成只换图片内容，不换身份）
            base = existing_uuid(png + ".meta") or str(uuid.uuid4())
            crop.save(png)
            with open(png + ".meta", "w", encoding="utf-8", newline="\n") as fp:
                fp.write(json.dumps(png_meta(base, f"{short}-{k}", p["w"], p["h"]),
                                    indent=2, ensure_ascii=False) + "\n")
            sf.append(f"{base}@f9941")

        times = [round(i * FRAME_SEC, 6) for i in range(len(sf))]
        ap = os.path.join(ANI_DIR, short + ".anim")
        # ★幂等：clip 的 uuid 必须稳定 —— `assets/UIPrefab/RobotShow.prefab` 的
        #   Animation 播放列表按 uuid 引用 clip，换 uuid = 特效静默不播。
        uid = existing_uuid(ap + ".meta")
        with open(ap, "w", encoding="utf-8", newline="\n") as fp:
            fp.write(json.dumps(make_clip(short, times, p["duration"], sf),
                                indent=2, ensure_ascii=False) + "\n")
        with open(ap + ".meta", "w", encoding="utf-8", newline="\n") as fp:
            fp.write(json.dumps(anim_meta(short, uid), indent=2, ensure_ascii=False) + "\n")

    print(f"写出 {len(plan)} 个技能（帧 png + meta + .anim + meta）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
