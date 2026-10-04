# -*- coding: utf-8 -*-
"""
机甲（Robot）立绘 GIF -> Cocos 帧序列 + AnimationClip 重制脚本
==================================================================================
规格（用户指定）：
  · 硬边缘放大（NEAREST）2 倍
  · 画布以「底部居中」为锚点，向上 + 左右扩展到 140×140
    （放大后已 >= 140 的维度按实际，不再补空；底部贴地不补）
  · .anim 的帧时间按 gif 自身帧延时（GIF delay）换算，不再用固定 step

产物：
  assets/Image/Robot/pic/{ani}/{ani}-{k}.png  (+ .meta，uuid 沿用旧的)
  assets/Image/Robot/ani/{ani}.anim            (_times/_values 重写，.anim.meta 保持不动)
  assets/resources/Robot/{ani}-{k}.png          (+ .meta，运行时 resources.load 用)

用法：
  python robot_gif_port.py --dry     # 只打印映射与帧数，不写文件
  python robot_gif_port.py --apply   # 实际写入
"""
import os
import re
import json
import uuid
import argparse
from collections import defaultdict

GIF_ROOT = r"D:/jjfbol-cocos/JJFB-Project/JJFBpojie/jjfbtujian/gif"
COCOS    = r"D:/jjfbol-cocos/jjfbol-cocos/jjfb"
IMAGE_PIC_DIR = os.path.join(COCOS, "assets", "Image", "Robot", "pic")
IMAGE_ANI_DIR = os.path.join(COCOS, "assets", "Image", "Robot", "ani")
RES_ROBOT_DIR = os.path.join(COCOS, "assets", "resources", "Robot")
ROBOTBASE_JSON = os.path.join(COCOS, "tools", "monster", "_robotbase_full.json")

MECHA_CATS = ["合成机甲I", "合成机甲II", "普通机甲I", "普通机甲II", "顶级机甲", "黄金系列"]
FORM_MAP = {"初": 1, "中": 2, "终": 3}

FRAME_SCALE = 2
TARGET = 140

# 需要清理的超额旧帧（沙箱禁止 os.remove，导出清单由外部 rm）
STALE = []
STALE_TXT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_robot_stale.txt")

# 数值表登记在「其他」目录、但属于机甲的例外
EXTRA_GIFS = {
    "lsjj": "其他/67_1@monster7_战地援护Ⅰ型·临时机甲·罗斯特.gif",
}


# ---------------- 名称解析 ----------------
def _nearest_resample():
    from PIL import Image
    return getattr(getattr(Image, "Resampling", Image), "NEAREST", 0)


def split_gif_name(fname):
    """139_1@monster14-铁臂｜初.gif -> ('铁臂', 1)"""
    b = os.path.splitext(fname)[0]
    b = re.sub(r"^[0-9]+_[0-9]+@", "", b)      # 139_1@
    b = re.sub(r"^[a-z]+@", "", b)             # gs@ / yxte@
    b = re.sub(r"^monster[0-9]+[-_]", "", b)   # monster14-
    parts = b.split("｜", 1)
    nm = parts[0].strip()
    fo = parts[1] if len(parts) > 1 else ""
    form = None
    for k, v in FORM_MAP.items():
        if fo.startswith(k):
            form = v
            break
    return nm, form


def build_name_index():
    """机甲名 -> 前缀（来自 RobotBase 导出）"""
    rb = json.load(open(ROBOTBASE_JSON, encoding="utf-8"))
    name2pre, pre2name = {}, {}
    for r in rb:
        pre = r["AniID"].rsplit("_", 1)[0]
        name2pre[r["RobotName"]] = pre
        pre2name[pre] = r["RobotName"]
    return name2pre, pre2name


def match_prefix(raw_name, name2pre):
    """全名优先，再按 · 分段逐个尝试（如 阿迈刹·鬼王->阿迈刹、蝙蝠A1·闪影->闪影）"""
    if raw_name in name2pre:
        return name2pre[raw_name]
    for seg in raw_name.split("·"):
        seg = seg.strip()
        if seg in name2pre:
            return name2pre[seg]
    return None


def build_mapping():
    """返回 {prefix: {form: gif_abs_path}}，form 为 1/2/3，None 表示文件名里没写形态"""
    name2pre, pre2name = build_name_index()
    found = defaultdict(dict)
    unknown = []

    for cat in MECHA_CATS:
        d = os.path.join(GIF_ROOT, cat)
        if not os.path.isdir(d):
            continue
        for f in sorted(os.listdir(d)):
            if not f.lower().endswith(".gif"):
                continue
            nm, form = split_gif_name(f)
            pre = match_prefix(nm, name2pre)
            if pre is None:
                unknown.append(f"{cat}/{f}")
                continue
            found[pre][form] = os.path.join(d, f)

    for pre, rel in EXTRA_GIFS.items():
        p = os.path.join(GIF_ROOT, rel.replace("/", os.sep))
        if os.path.exists(p):
            found[pre][None] = p
        else:
            unknown.append(rel)

    return found, pre2name, unknown


def resolve_sources(found):
    """把 {prefix:{form:path}} 展开成 99 个 (aniName, gifPath, 说明)
    规则（用户确认）：
      · 3 形态机器人：L1/L2/L3 各自对应 初/中/终
      · 不足 3 形态：已有的按形态落位，缺的用「最后一个已存在的形态」复制补齐
        （gtjx 只有 初+终 -> L1=初, L3=终, L2=复制终；其余单张的 -> 复制三份）
    """
    out = []
    for pre in sorted(found):
        forms = found[pre]
        present = {k: v for k, v in forms.items() if k in (1, 2, 3)}
        if present:
            last = present[max(present)]
        else:
            last = forms[None]
        for lv in (1, 2, 3):
            src = present.get(lv, last)
            copied = lv not in present
            out.append((f"{pre}_L{lv}", src, copied))
    return out


# ---------------- 帧处理 ----------------
def load_gif_frames(path):
    from PIL import Image
    im = Image.open(path)
    n = getattr(im, "n_frames", 1)
    frames, delays = [], []
    for i in range(n):
        im.seek(i)
        frames.append(im.convert("RGBA").copy())
        d = im.info.get("duration", 0) or 0
        delays.append(max(d, 10) / 1000.0)      # 兜底 10ms，避免 0 时长
    return frames, delays


def plan_canvas(frames):
    max_w = max_h = 0
    for f in frames:
        max_w = max(max_w, int(round(f.width * FRAME_SCALE)))
        max_h = max(max_h, int(round(f.height * FRAME_SCALE)))
    return max(TARGET, max_w), max(TARGET, max_h)


def compose(frame, cw, ch):
    from PIL import Image
    w, h = int(round(frame.width * FRAME_SCALE)), int(round(frame.height * FRAME_SCALE))
    r = frame.resize((w, h), _nearest_resample())
    if w == cw and h == ch:
        return r
    canvas = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    canvas.paste(r, ((cw - w) // 2, ch - h))    # 底部居中：左右均分、贴底
    return canvas


def alpha_bbox(img):
    return img.convert("RGBA").getchannel("A").getbbox()


def make_meta(display_name, base_uuid, cw, ch, bbox, minfilter, magfilter):
    """按 Cocos image importer 的真实字段生成 meta（含 trim 顶点/uv）。"""
    if bbox is None:
        x0, y0, x1, y1 = 0, 0, cw, ch
    else:
        x0, y0, x1, y1 = bbox
    w, h = x1 - x0, y1 - y0
    half_w, half_h = w / 2.0, h / 2.0
    # GL 坐标（原点左下）
    y_bottom = ch - y1
    y_top = ch - y0
    uv = [x0, y_bottom, x1, y_bottom, x0, y_top, x1, y_top]
    nuv = [x0 / cw, y_bottom / ch, x1 / cw, y_bottom / ch,
           x0 / cw, y_top / ch, x1 / cw, y_top / ch]
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
                        "rawPosition": [-half_w, -half_h, 0, half_w, -half_h, 0,
                                        -half_w, half_h, 0, half_w, half_h, 0],
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


def read_existing_meta_settings(path):
    """沿用旧 meta 的 uuid / 过滤设置，避免引用来回变。"""
    if not os.path.exists(path):
        return None
    try:
        m = json.load(open(path, encoding="utf-8"))
    except Exception:
        return None
    tex = (m.get("subMetas") or {}).get("6c48a") or {}
    ud = tex.get("userData") or {}
    return {
        "uuid": m.get("uuid"),
        "minfilter": ud.get("minfilter", "nearest"),
        "magfilter": ud.get("magfilter", "nearest"),
    }


def write_frames(ani, frames, cw, ch, pic_dir, res_dir, dry=False):
    """写 pic/{ani}/{ani}-{k}.png(+meta) 与 resources/Robot/{ani}-{k}.png(+meta)。
    返回 [(uuid, png_name), ...]（Image/pic 侧的 uuid，供 anim 引用）"""
    from PIL import Image
    targets = [
        (os.path.join(pic_dir, ani), f"{ani}", True),
        (res_dir, f"{ani}", False),
    ]
    if not dry:
        os.makedirs(os.path.join(pic_dir, ani), exist_ok=True)
        os.makedirs(res_dir, exist_ok=True)

    result = []
    for d, prefix, is_image_side in targets:
        for i, fr in enumerate(frames):
            out = compose(fr, cw, ch)
            png_path = os.path.join(d, f"{prefix}-{i}.png")
            meta_path = png_path + ".meta"
            old = read_existing_meta_settings(meta_path)
            base_uuid = (old or {}).get("uuid") or str(uuid.uuid4())
            minf = (old or {}).get("minfilter", "nearest" if is_image_side else "linear")
            magf = (old or {}).get("magfilter", "nearest" if is_image_side else "linear")
            if not dry:
                out.save(png_path, "PNG")
                meta = make_meta(f"{prefix}-{i}", base_uuid, cw, ch, alpha_bbox(out), minf, magf)
                with open(meta_path, "w", encoding="utf-8") as mf:
                    mf.write(json.dumps(meta, indent=2, ensure_ascii=False) + "\n")
            if is_image_side:
                result.append((f"{base_uuid}@f9941", f"{prefix}-{i}"))
        # 收集超额旧帧（不在此处删除：沙箱会拦截 os.remove，统一导出清单后由外部删除）
        if not dry:
            for f in os.listdir(d):
                m = re.match(rf"^{re.escape(prefix)}-(\d+)\.png(\.meta)?$", f)
                if m and int(m.group(1)) >= len(frames):
                    STALE.append(os.path.join(d, f))
    return result


def write_anim(ani, frame_uuids, delays, dry=False):
    """重写 .anim：_times 按 gif 延时累加，_duration = 总时长。.anim.meta 保持不动。"""
    n = len(frame_uuids)
    times, acc = [], 0.0
    for i in range(n):
        times.append(round(acc, 6))
        acc += delays[i]
    duration = round(acc, 6)
    values = [{"__uuid__": u, "__expectedType__": "cc.SpriteFrame"} for u, _ in frame_uuids]
    clip = [
        {
            "__type__": "cc.AnimationClip", "_name": ani, "_objFlags": 0,
            "__editorExtras__": {"embeddedPlayerGroups": []},
            "_native": "", "sample": 60, "speed": 1.0, "wrapMode": 2,
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
        {"__type__": "cc.animation.ClipAdditiveSettings", "enabled": False, "refClip": None},
    ]
    # 修正 additive 类型名（与工程既有文件一致）
    clip[6]["__type__"] = "cc.AnimationClipAdditiveSettings"
    if not dry:
        os.makedirs(IMAGE_ANI_DIR, exist_ok=True)
        with open(os.path.join(IMAGE_ANI_DIR, ani + ".anim"), "w", encoding="utf-8") as f:
            f.write(json.dumps(clip, indent=2, ensure_ascii=False) + "\n")
    return times, duration


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry", action="store_true")
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()
    dry = not args.apply

    found, pre2name, unknown = build_mapping()
    plan = resolve_sources(found)

    print(f"机甲前缀数: {len(found)}   待处理动画数: {len(plan)}")
    if unknown:
        print("未匹配 gif:", unknown)
    print()
    print(f'{"动画":<9}{"机甲":<9}{"帧":<4}{"画布":<10}{"时长(s)":<9}{"源 gif":<46}复制')
    total_frames = 0
    for ani, gif, copied in plan:
        frames, delays = load_gif_frames(gif)
        cw, ch = plan_canvas(frames)
        total_frames += len(frames)
        name = pre2name.get(ani.rsplit("_", 1)[0], "?")
        print(f'{ani:<9}{name:<9}{len(frames):<4}{f"{cw}x{ch}":<10}{sum(delays):<9.2f}'
              f'{os.path.basename(gif):<46}{"复" if copied else ""}')
        if not dry:
            fu = write_frames(ani, frames, cw, ch, IMAGE_PIC_DIR, RES_ROBOT_DIR, dry=False)
            write_anim(ani, fu, delays)
    print()
    print(f"动画 {len(plan)} 个 | 帧合计 {total_frames} | 模式: {'演练(未写盘)' if dry else '已写盘'}")
    if not dry:
        with open(STALE_TXT, "w", encoding="utf-8") as f:
            f.write("\n".join(STALE))
        print(f"待清理超额旧帧: {len(STALE)} 个 -> {STALE_TXT}")


if __name__ == "__main__":
    main()
