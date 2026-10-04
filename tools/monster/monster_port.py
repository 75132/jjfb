# -*- coding: utf-8 -*-
"""
野怪（Monster）数据 + 立绘资源移植脚本  ——  JJFB 机甲风暴复刻
==================================================================================
数据源（优先级：解包 > RPGMaker > Cocos 反推）
  - 数值表 : D:/Desktop/jjfbtujian/data/monster@monster.txt   (@count=502, 权威)
  - 立绘   : D:/Desktop/jjfbtujian/gif/                       (246 gif, 按分类子目录)
  - 单机   : D:/机甲风暴开发素材合集/机甲风暴机甲以及敌人以及武器/monster  (117 png 单帧, 备用)

产物（写入 Cocos 工程）
  - 帧 : assets/resources/Monster/{imgID}_L{n}-{k}.png  + 同名 .meta
  - 动画: assets/Image/Monster/ani/mon_{imgID}_L{n}.anim  (cc.AnimationClip 数组)
  - 数据: tools/monster/monsterbase_export.json  (归档)  +  MongoDB.MonsterBase (可选导入)

baseAtt 字段顺序（已由 occID×数值交叉验证确认）
  下标 0..10 -> a..k = HP,MP,Melee,Shooting,Armor,Evasion,Accuracy,Lethality,Corrosion,Resistance,Initiative
  下标 11    -> l = Counterattack (仅高数值怪物含，末位恒 50)
  下标 12..13-> m,n = Block,ArmorPenetration (缺省 50)；攻击次数 AttackCount 默认 1
  raw_baseAtt 原样保留，确认后可重跑覆盖。

用法
  python monster_port.py --mode assets  [--scope sample-zerg|sample-gifrel|full] [--limit N]
  python monster_port.py --mode import  [--mongo-uri mongodb://127.0.0.1:27017/] [--db jjfb] [--scope ...]
  python monster_port.py --mode all     [--scope ...]
  （--scope 控制处理哪些怪物；默认 full = 所有能解析到 gif 的怪物）
"""
import os
import sys
import re
import json
import uuid
import argparse
import unicodedata
from datetime import datetime

# ---------------- 路径配置 ----------------
TXT_PATH   = r"D:\Desktop\jjfbtujian\data\monster@monster.txt"
GIF_ROOT   = r"D:\Desktop\jjfbtujian\gif"
COCOS_ROOT = r"D:\jjfbol-cocos\jjfbol-cocos\jjfb"
CLASSES_JSON_PATH = os.path.join(COCOS_ROOT, "server", "data", "Classes.json")
RES_DIR    = os.path.join(COCOS_ROOT, "assets", "resources", "Monster")
ANI_DIR    = os.path.join(COCOS_ROOT, "assets", "Image", "Monster", "ani")
# 运行时动态加载用：动画同时放一份到 resources 下（Cocos 只能 resources.load 该目录）
ANI_RES_DIR = os.path.join(COCOS_ROOT, "assets", "resources", "Monster", "ani")
EXPORT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "monsterbase_export.json")

# ---------------- baseAtt 映射 ----------------
# 下标 -> (cocos 字段名, 默认值); 顺序严格对应 robot_upgrade.ATTRIBUTE_MAPPING 的 a..k
BASEATT_FIELDS = [
    ("HP", 50), ("MP", 50), ("Melee", 50), ("Shooting", 50), ("Armor", 50),
    ("Evasion", 50), ("Accuracy", 50), ("Lethality", 50), ("Corrosion", 50),
    ("Resistance", 50), ("Initiative", 50),
]
# 第 12 项起的字段（l,m,n,o），怪物表里缺失时取默认 50
EXTRA_FIELDS = [
    ("Counterattack", 50), ("Block", 50), ("ArmorPenetration", 50),
]

ROBOT_FRAME_VER   = "1.0.27"
TEXTURE_VER       = "1.0.22"
SPRITE_VER        = "1.0.12"

# 怪物机器人帧规格
#   RobotID 高位偏移：保证与 RobotBase.RobotID 不撞号，且便于识别来源
MONSTER_ROBOT_ID_BASE = 100000

# 立绘规格（用户指定）：硬边缘放大 2 倍；画布向上 + 左右扩展到 140，
# 以底部中心为锚点（机甲贴地）。若放大后已 >=140 则按实际尺寸，不再补空。
FRAME_SCALE = 2
TARGET_FRAME_SIZE = 140


# =========================================================================
# 1) 解析 monster@monster.txt
# =========================================================================
def parse_txt(path):
    monsters = []
    seen_ids = set()
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            line = line.rstrip("\n")
            if not line.strip():
                continue
            if line.startswith("////"):      # 区域分隔注释 (////尼利亚荒原)
                continue
            if line.startswith("@count"):
                continue
            if not line.startswith("@monster"):
                continue
            parts = line.split("|")
            d = {}
            for p in parts:
                if not p.startswith("@"):
                    continue
                # @key=value
                kv = p[1:].split("=", 1)
                if len(kv) == 2:
                    d[kv[0]] = kv[1]
            if "id" not in d:
                continue
            # 去重：源表存在极少数重复 @id 行，保留首条
            mid = d["id"]
            if mid in seen_ids:
                continue
            seen_ids.add(mid)
            monsters.append(d)
    return monsters


def parse_monster(d):
    """把 txt 单行字典转成结构化怪物记录（数值/字段）。"""
    def _int(v, default=0):
        try:
            return int(str(v).strip())
        except Exception:
            return default

    raw_att = d.get("baseAtt", "")
    att_list = [int(x) for x in raw_att.split(",") if x.strip() != ""]

    rec = {
        "MonsterID":   _int(d.get("id")),
        "MonsterName": d.get("name", ""),
        "occID":       _int(d.get("occID"), -1),
        "isRobot":     _int(d.get("isRobot"), 0),
        "category":    d.get("category", ""),
        "monsterimgID": _int(d.get("monsterimgID"), 0),
        "nextJin":     _int(d.get("nextJin"), -1),
        "jinLevel":    _int(d.get("jinLevel"), 0),
        "downCZ":      _int(d.get("downCZ"), 0),
        "upCZ":        _int(d.get("upCZ"), 0),
        "downLW":      _int(d.get("downLW"), 0),
        "upLW":        _int(d.get("upLW"), 0),
        "raw_baseAtt": raw_att,
        "gifRel":      d.get("gifRel", ""),
        "att_list":    att_list,
    }
    return rec


# =========================================================================
# 2) gif 解析 / 名称匹配
# =========================================================================
def build_gif_index(gif_root):
    """扫描 gif 根目录，建立：
         by_rel : 相对路径(去掉 gif_root 前缀, 正斜杠) -> 绝对路径
         by_name: 中文名(文件名 '-' 之后, 去扩展)     -> (绝对路径, 子分类)
    """
    by_rel = {}
    by_name = {}
    if not os.path.isdir(gif_root):
        return by_rel, by_name
    for subcat in sorted(os.listdir(gif_root)):
        subdir = os.path.join(gif_root, subcat)
        if not os.path.isdir(subdir):
            continue
        for fn in sorted(os.listdir(subdir)):
            if not fn.lower().endswith(".gif"):
                continue
            abs_path = os.path.join(subdir, fn)
            rel = f"{subcat}/{fn}".replace("\\", "/")
            by_rel[rel] = abs_path
            # 名称: 取 '-' 之后部分（如 devil1_devil1-饥饿腐蚀者.gif -> 饥饿腐蚀者）
            m = re.search(r"-(.+?)\.gif$", fn, re.IGNORECASE)
            name = m.group(1) if m else os.path.splitext(fn)[0]
            # 只保留 by_name 第一条（避免覆盖）；zerg 名称唯一
            if name not in by_name:
                by_name[name] = (abs_path, subcat)
    return by_rel, by_name


def strip_stage(name):
    """去掉阶段后缀，便于名称匹配：铁臂|初 -> 铁臂 ; 迅猛|终·吴庸·克雷 -> 迅猛"""
    n = name.split("|")[0].strip()
    # 进一步去掉 '初/中/终·...' 这类，但保留主体；这里仅取 '|' 前即可
    return n


def resolve_gif(rec, by_rel, by_name):
    """返回 (abs_gif_path, subcat, imgID, stage) 或 None。"""
    gifrel = rec.get("gifRel", "")
    if gifrel:
        # @gifRel 形如 普通机甲I/139_1@monster14-铁臂｜初.gif
        p = os.path.join(GIF_ROOT, gifrel.replace("/", os.sep))
        if os.path.exists(p):
            subcat = gifrel.split("/")[0]
            # 解析 imgID / stage：文件名 {imgID}_{stage}@...
            fn = os.path.basename(gifrel)
            m = re.match(r"(\d+)_(\d+)", fn)
            if m:
                return p, subcat, int(m.group(1)), int(m.group(2))
            return p, subcat, rec["monsterimgID"], 1
    # 回退：名称匹配（虫族等无 gifRel 的怪物）
    name = rec["MonsterName"]
    candidates = [name, strip_stage(name)]
    for cand in candidates:
        if cand in by_name:
            abs_path, subcat = by_name[cand]
            # 用 txt 的 monsterimgID（zerg gif 文件名不含 imgID）
            return abs_path, subcat, rec["monsterimgID"], 1
    return None


# =========================================================================
# 3) 生成帧 png + .meta
# =========================================================================
def make_frame_meta(base_uuid, display_name, w, h):
    """仿照 assets/resources/Robot/amc_L1-0.png.meta 生成无裁剪全图 sprite-frame meta。"""
    hw, hh = w / 2.0, h / 2.0
    meta = {
        "ver": ROBOT_FRAME_VER,
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
                    "minfilter": "linear",
                    "magfilter": "linear",
                    "mipfilter": "none",
                    "anisotropy": 0,
                },
                "ver": TEXTURE_VER,
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
                    "offsetX": 0,
                    "offsetY": 0,
                    "trimX": 0,
                    "trimY": 0,
                    "width": w,
                    "height": h,
                    "rawWidth": w,
                    "rawHeight": h,
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
                            -hw, -hh, 0,
                            hw, -hh, 0,
                            -hw, hh, 0,
                            hw, hh, 0,
                        ],
                        "indexes": [0, 1, 2, 2, 1, 3],
                        "uv": [
                            0, h,
                            w, h,
                            0, 0,
                            w, 0,
                        ],
                        "nuv": [
                            0.0, 1.0,
                            1.0, 1.0,
                            0.0, 0.0,
                            1.0, 0.0,
                        ],
                        "minPos": [-hw, -hh, 0],
                        "maxPos": [hw, hh, 0],
                    },
                    "isUuid": True,
                    "imageUuidOrDatabaseUri": f"{base_uuid}@6c48a",
                    "atlasUuid": "",
                    "trimType": "auto",
                },
                "ver": SPRITE_VER,
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
    return meta


def _nearest_resample():
    """最近邻（硬边缘）缩放常量，兼容新旧 Pillow。"""
    from PIL import Image
    return getattr(getattr(Image, "Resampling", Image), "NEAREST", 0)


def scaled_size(w, h, scale=FRAME_SCALE):
    """硬边缘放大后的尺寸。"""
    return int(round(w * scale)), int(round(h * scale))


def compose_on_canvas(img, canvas_w, canvas_h, scale=FRAME_SCALE):
    """把单帧硬边缘放大后贴到统一画布的底部中心（向上/左右留空）。"""
    from PIL import Image

    if scale != 1:
        img = img.resize(scaled_size(img.width, img.height, scale), _nearest_resample())
    if img.width == canvas_w and img.height == canvas_h:
        return img
    canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    x = (canvas_w - img.width) // 2      # 左右均分
    y = canvas_h - img.height            # 贴底：机甲踩地
    canvas.paste(img, (x, y))
    return canvas


def plan_canvas(sizes, scale=FRAME_SCALE, target=TARGET_FRAME_SIZE):
    """同一动画的所有帧共用一个画布尺寸（取组内最大），避免播放时抖动/踩地不平。
    sizes: [(w, h), ...] 原始尺寸序列；不足 target 的维度补到 target。"""
    max_w = max_h = 0
    for (w, h) in sizes:
        w2, h2 = scaled_size(w, h, scale)
        max_w = max(max_w, w2)
        max_h = max(max_h, h2)
    return max(target, max_w), max(target, max_h)


def split_gif_to_frames(gif_path, frame_prefix, res_dir):
    """拆 gif 为 N 张 png + meta，返回 [(frame_file_noext, uuid), ...]。
    每帧先硬边缘放大，再统一贴到组内最大画布的底部中心。"""
    from PIL import Image

    im = Image.open(gif_path)
    n_frames = getattr(im, "n_frames", 1)

    # 第一遍：收集原始帧并计算统一画布
    raw_frames = []
    for i in range(n_frames):
        im.seek(i)
        fr = im.convert("RGBA")
        raw_frames.append(fr.copy())          # 拷贝避免后续 seek 破坏
    canvas_w, canvas_h = plan_canvas([(f.width, f.height) for f in raw_frames])

    # 第二遍：合成并落地
    frames = []
    for i, fr in enumerate(raw_frames):
        out = compose_on_canvas(fr, canvas_w, canvas_h)
        fname = f"{frame_prefix}-{i}.png"
        fpath = os.path.join(res_dir, fname)
        out.save(fpath, "PNG")
        # 生成 meta（尺寸用最终画布尺寸，保证 sprite-frame 顶点/uv 正确）
        base_uuid = str(uuid.uuid4())
        meta = make_frame_meta(base_uuid, os.path.splitext(fname)[0], canvas_w, canvas_h)
        with open(fpath + ".meta", "w", encoding="utf-8") as mf:
            mf.write(json.dumps(meta, indent=2, ensure_ascii=False) + "\n")
        frames.append((os.path.splitext(fname)[0], f"{base_uuid}@f9941"))
    return frames


# =========================================================================
# 4) 生成 cc.AnimationClip
# =========================================================================
def make_anim(ani_name, frame_uuids):
    n = len(frame_uuids)
    if n == 0:
        return None
    step = 0.2
    times = [round(i * step, 6) for i in range(n)]
    duration = round((n - 1) * step, 6) if n > 1 else 0.0
    values = [{"__uuid__": u, "__expectedType__": "cc.SpriteFrame"} for u in frame_uuids]

    clip = {
        "__type__": "cc.AnimationClip",
        "_name": ani_name,
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
    }
    track = {
        "__type__": "cc.animation.ObjectTrack",
        "_binding": {
            "__type__": "cc.animation.TrackBinding",
            "path": {"__id__": 2},
            "proxy": None,
        },
        "_channel": {"__id__": 4},
    }
    path = {
        "__type__": "cc.animation.TrackPath",
        "_paths": [{"__id__": 3}, "spriteFrame"],
    }
    comp = {"__type__": "cc.animation.ComponentPath", "component": "cc.Sprite"}
    channel = {"__type__": "cc.animation.Channel", "_curve": {"__id__": 5}}
    curve = {"__type__": "cc.ObjectCurve", "_times": times, "_values": values}
    additive = {"__type__": "cc.AnimationClipAdditiveSettings", "enabled": False, "refClip": None}
    return [clip, track, path, comp, channel, curve, additive]


def make_anim_meta(ani_id, base_uuid=None):
    """仿 assets/Image/Robot/ani/*.anim.meta 生成 cc.AnimationClip 的 .meta。"""
    return {
        "ver": "2.0.4",
        "importer": "animation-clip",
        "imported": True,
        "uuid": base_uuid or str(uuid.uuid4()),
        "files": [".bin"],
        "subMetas": {},
        "userData": {"name": ani_id},
    }


def write_anim(ani_id, frame_uuids):
    """生成动画并双写：Image/Monster/ani（编辑器挂载用）+ resources/Monster/ani（运行时动态加载用）。
    两侧各带独立 uuid 的 .meta，保证 Cocos 资源系统可直接识别、无需手动导入。
    返回主路径（Image 侧）。"""
    anim = make_anim(ani_id, frame_uuids)
    if anim is None:
        return None
    text = json.dumps(anim, indent=2, ensure_ascii=False) + "\n"
    os.makedirs(ANI_DIR, exist_ok=True)
    os.makedirs(ANI_RES_DIR, exist_ok=True)

    for d in (ANI_DIR, ANI_RES_DIR):
        anim_path = os.path.join(d, ani_id + ".anim")
        with open(anim_path, "w", encoding="utf-8") as af:
            af.write(text)
        meta_path = anim_path + ".meta"
        if not os.path.exists(meta_path):      # 已存在则保留原 uuid，避免引用来回变
            with open(meta_path, "w", encoding="utf-8") as mf:
                mf.write(json.dumps(make_anim_meta(ani_id), indent=2, ensure_ascii=False) + "\n")

    return os.path.join(ANI_DIR, ani_id + ".anim")


# =========================================================================
# 5) 构建 MonsterBase 文档
# =========================================================================
# 与 RobotBase / RobotPet 完全同构：主字段一律沿用 robot 的命名与配对
# （Xxx 与 CurrentXxx 成对出现），怪物专属信息收进 MonsterExtra 子文档，
# 以便后续把怪物当宠物（RobotPet）使用时字段完全一致、可直接复用。
ATTRIBUTE_PAIRS = [
    "Melee", "Shooting", "Armor", "Accuracy", "Corrosion", "Initiative",
    "Block", "ArmorPenetration", "Evasion",
    "Lethality", "Resistance", "Counterattack",
]


def build_doc(rec, art):
    att = rec["att_list"]

    def _at(idx, default=50):
        return att[idx] if idx < len(att) else default

    # ---- 主属性（baseAtt 0..10 = a..k；11 = l Counterattack）----
    hp = _at(0)
    mp = _at(1)
    attr = {
        "Melee": _at(2),
        "Shooting": _at(3),
        "Armor": _at(4),
        "Evasion": _at(5),
        "Accuracy": _at(6),
        "Lethality": _at(7),
        "Corrosion": _at(8),
        "Resistance": _at(9),
        "Initiative": _at(10),
        "Counterattack": _at(11),
        # 12..14 = m,n,o；怪物表通常缺省
        "Block": _at(12),
        "ArmorPenetration": _at(13),
        "AttackCount": 1,
    }

    # ---- 主体：RobotBase 同构字段 ----
    doc = {
        "RobotID": MONSTER_ROBOT_ID_BASE + rec["MonsterID"],  # 高位偏移，避免与 RobotBase.RobotID 撞号
        "RobotName": rec["MonsterName"],      # 与 RobotBase 对齐名称
        "AniID": art["ani_id"] if art else "",
        "Form": max(1, int(art.get("stage", 1))) if art else 1,
        "Class": rec["occID"] + 1 if rec["occID"] >= 0 else 1,
        "Level": 1,
        "Growth": 0,
        "Comprehension": 0,
        "StarLevel": 0,
    }
    # 属性（两套字段名都保留：Xxx 为上限/基准，CurrentXxx 为当前值，与 RobotBase 一致）
    for field, val in attr.items():
        doc[field] = val
        doc["Current" + field] = val
    doc["MaxHP"] = hp
    doc["CurrentHP"] = hp
    doc["MaxMP"] = mp
    doc["CurrentMP"] = mp
    doc["MaxEXP"] = 0
    doc["CurrentEXP"] = 0
    doc["Jin"] = rec["jinLevel"]

    # ---- 立绘/资源辅助字段 ----
    # 注意：这些不是 RobotBase 字段，一律落进 MonsterExtra，避免污染机甲主字段结构
    art_extra = {}
    if art:
        art_extra = {
            "SpriteKey": f"Monster/{art['frame_prefix']}-0",
            "FramePrefix": art["frame_prefix"],
            "FrameCount": art["frame_count"],
        }
        if art.get("temp"):
            art_extra["TempArt"] = True

    # ---- 怪物专属信息（不污染 robot 主字段）----
    doc["MonsterExtra"] = {
        "MonsterID": rec["MonsterID"],
        "MonsterName": rec["MonsterName"],
        "occID": rec["occID"],
        "isRobot": rec["isRobot"],
        "category": rec["category"] or (art.get("subcat") if art else ""),
        "monsterimgID": rec["monsterimgID"],
        "gifRel": rec["gifRel"],
        "raw_baseAtt": rec["raw_baseAtt"],
        "nextJin": rec["nextJin"],
        "jinLevel": rec["jinLevel"],
        "downCZ": rec["downCZ"],
        "upCZ": rec["upCZ"],
        "downLW": rec["downLW"],
        "upLW": rec["upLW"],
        "HasArt": bool(art),
    }
    doc["MonsterExtra"].update(art_extra)
    # ---- 属性换算：RPGMaker -> Cocos（同 RobotBase 口径）----
    convert_attributes(doc)
    return doc


# =========================================================================
# 5.5) 属性换算：RPGMaker -> Cocos
# -------------------------------------------------------------------------
# 规则（与 _recompute_dryrun.py 沙盘一致，已和用户确认）：
#   1) 写死：Enemies.json note 含 <hp 标记 -> 保留 build_doc 的 raw 值不动
#   2) 野机甲(isRobot=1) 且家族名命中 Classes.json -> calculate_attributes(Level)（同 RobotBase）
#   3) 非机甲且命中 Enemies.json params -> 直接用 params（8 项成品值，已是 Cocos 量级）
#   4) 其余（非机甲无 Enemies 匹配）-> 用解包 raw_baseAtt（真怪物已是成品量级，占位 default=50 保持）
# =========================================================================
_ENEMIES_PATH = r"D:\机甲风暴开发素材合集\机甲风暴2\data\Enemies.json"
_RPG_CACHE = None   # (en_by_name, en_by_fam, hp_fams, classes, cls_fam)


def _fam(name):
    return re.split(r"[|｜]", name)[0].strip() if name else ""


def _load_rpg_data():
    global _RPG_CACHE
    if _RPG_CACHE is not None:
        return _RPG_CACHE
    import json as _json
    en = _json.load(open(_ENEMIES_PATH, encoding="utf-8"))
    # 同名存在多条（如 初/中/终 阶段、或低 id 占位模板 + 高 id 真值）。
    # 取「最高 id」那条作为真值；另单独记录带 <hp> 写死标记的条目。
    en_by_name, en_by_fam = {}, {}
    hp_fams = set()
    hp_en_by_name, hp_en_by_fam = {}, {}
    for e in en:
        if not e or not e.get("name"):
            continue
        n = e["name"]; f = _fam(n); eid = e.get("id", 0)
        for dct, key in ((en_by_name, n), (en_by_fam, f)):
            cur = dct.get(key)
            if cur is None or eid > cur.get("id", 0):
                dct[key] = e
        if re.search(r"<hp\b", e.get("note") or ""):
            hp_fams.add(n); hp_fams.add(f)
            hp_en_by_name[n] = e
            hp_en_by_fam[f] = e
    classes = _json.load(open(CLASSES_JSON_PATH, encoding="utf-8"))
    cls_fam = {}
    for i, e in enumerate(classes):
        if e:
            cls_fam.setdefault(_fam(e.get("name", "")), i)
    # 返回: (en_by_name, en_by_fam, hp_fams, classes, cls_fam, hp_en_by_name, hp_en_by_fam)
    _RPG_CACHE = (en_by_name, en_by_fam, hp_fams, classes, cls_fam, hp_en_by_name, hp_en_by_fam)
    return _RPG_CACHE


def _match_enemy(nm, en_by_name, en_by_fam):
    """非机甲怪物匹配 Enemies：整名 -> 家族 -> 拆 ·/・/| 子名，命中最高 id 真值。"""
    if nm in en_by_name:
        return en_by_name[nm]
    f = _fam(nm)
    if f in en_by_fam:
        return en_by_fam[f]
    for t in re.split(r"[·・|｜]", nm):
        t = t.strip()
        if not t:
            continue
        if t in en_by_name:
            return en_by_name[t]
        if t in en_by_fam:
            return en_by_fam[t]
    return None


_PREFIX_CUT = re.compile(
    r"^(亲卫队|傀儡|甲安|雷米|寄生|变异|灾难赋予者|独眼|血腥|残暴|邪恶|魔化|漆黑|"
    r"首脑|双足|水晶|光能|金甲|环刺|紫镰|异空|独角|飞翼|蠕动|挖掘|嗜血|生化|斯多|无序)"
    r"[A-Za-z0-9\-]*[·・]?")


def _aggressive_match(nm, en_by_name, en_by_fam):
    """激进匹配 Enemies（用于 _match_enemy 漏网的怪）：
    去修饰前缀 + 罗马数字归一 + 全词双向子串匹配，命中最高 id 真值。"""
    def rom(s):
        return (s.replace("Ⅲ", "3").replace("Ⅶ", "7").replace("Ⅱ", "2").replace("Ⅰ", "1")
                 .replace("Ⅸ", "9").replace("Ⅴ", "5").replace("Ⅵ", "6").replace("Ⅳ", "4")
                 .replace("Ⅷ", "8").replace("Ⅹ", "10"))
    cands = {nm, _PREFIX_CUT.sub("", nm).strip("·・ "), rom(nm),
             rom(_PREFIX_CUT.sub("", nm).strip("·・ "))}
    for t in re.split(r"[·・|｜\s]", nm):
        t = t.strip()
        if t:
            cands.add(t)
            cands.add(rom(t))
    for cn in list(cands):
        for en_name in en_by_name:
            if len(en_name) >= 2 and (en_name in cn or cn in en_name):
                cands.add(en_name)
    for cn in cands:
        cn = cn.strip("·・ ")
        if cn in en_by_name:
            return en_by_name[cn]
        if _fam(cn) in en_by_fam:
            return en_by_fam[_fam(cn)]
    return None


def _parse_formula(note):
    out = {}
    if not note:
        return out
    for part in note.split(","):
        part = part.strip()
        m = re.match(r"([a-o])\s*=\s*(.+)", part)
        if m:
            out[m.group(1)] = m.group(2).strip()
    return out


def _calc_formula(formulas, level):
    res = {}
    for letter, f in formulas.items():
        try:
            f2 = f.replace("level", str(level))
            if not re.match(r"^[0-9+\-*/().\s]+$", f2):
                continue
            res[letter] = int(round(eval(f2)))
        except Exception:
            pass
    return res


# 字母 -> cocos 字段（同 robot_upgrade.ATTRIBUTE_MAPPING 的 a-o）
_LETTER2FIELD = {"a": "HP", "b": "MP", "c": "Melee", "d": "Shooting", "e": "Armor",
    "f": "Evasion", "g": "Accuracy", "h": "Lethality", "i": "Corrosion",
    "j": "Resistance", "k": "Initiative", "l": "Counterattack", "m": "Block",
    "n": "ArmorPenetration"}
# Enemies.params 下标 -> cocos 字段
_PARAMS2FIELD = {0: "HP", 1: "MP", 2: "Melee", 3: "Shooting", 4: "Armor",
    5: "Evasion", 6: "Accuracy", 7: "Lethality"}


def _apply_attrs(doc, vals):
    """vals: {字段名: 值}（含 HP/MP 表示 MaxHP/MaxMP）。写 Xxx + CurrentXxx。"""
    for f in ATTRIBUTE_PAIRS:
        v = int(vals.get(f, 50))
        doc[f] = v
        doc["Current" + f] = v
    hp = int(vals.get("HP", doc.get("MaxHP", 50)))
    mp = int(vals.get("MP", doc.get("MaxMP", 40)))
    doc["MaxHP"], doc["CurrentHP"] = hp, hp
    doc["MaxMP"], doc["CurrentMP"] = mp, mp


# 解包占位默认值（monster.txt 未配的怪 baseAtt 全为 [50,40,30,6,10,12,11,12]）
_PLACEHOLDER = [50, 40, 30, 6, 10, 12, 11, 12]


def _estimate_level(nm):
    """无真值怪按名字强度词给一个名义等级（仅用于估算公式）。"""
    if any(w in nm for w in ("暴龙", "恶魔", "收割者", "污染者", "吞噬者", "首脑",
                              "赋予者", "追踪者", "漆黑", "血腥", "残暴", "魔化",
                              "灾难", "首领", "大王")):
        return 50
    if any(w in nm for w in ("幼虫", "植物", "食人菇", "侦查", "幼苗", "幼", "石兽")):
        return 18
    return 35


def _estimate_attrs(doc, nm):
    """无 RPGMaker 真值的怪：套通用线性公式（量级对齐已匹配 Enemies 怪）。"""
    lv = _estimate_level(nm)
    vals = {
        "HP": lv * 220 + 4000, "MP": lv * 28 + 700,
        "Melee": lv * 16 + 180, "Shooting": lv * 13 + 150,
        "Armor": lv * 13 + 110, "Evasion": lv * 11 + 100,
        "Accuracy": lv * 11 + 100, "Lethality": lv * 9 + 100,
        "Corrosion": lv * 5 + 80, "Resistance": lv * 5 + 80,
        "Initiative": lv * 5 + 80, "Counterattack": lv * 5 + 80,
        "Block": lv * 5 + 80, "ArmorPenetration": lv * 5 + 80,
        "AttackCount": 1,
    }
    _apply_attrs(doc, vals)
    doc.setdefault("MonsterExtra", {})["estimated"] = 1


def convert_attributes(doc):
    """按确认规则重算怪物属性（原地修改 doc）。"""
    nm = doc.get("RobotName", "")
    me = doc.get("MonsterExtra", {})
    level = doc.get("Level", 1)
    en_by_name, en_by_fam, hp_fams, classes, cls_fam, hp_en_by_name, hp_en_by_fam = _load_rpg_data()

    # 1) 写死（RPGMaker 固定写死，用 <hp> 标记条目的 params，不参与换算）
    if nm in hp_fams or _fam(nm) in hp_fams:
        en = hp_en_by_name.get(nm) or hp_en_by_fam.get(_fam(nm))
        if en and en.get("params"):
            params = en["params"]
            vals = {_PARAMS2FIELD[i]: params[i] for i in _PARAMS2FIELD if i < len(params)}
            _apply_attrs(doc, vals)
        return

    # 2) 野机甲 -> 公式
    if me.get("isRobot") == 1 and _fam(nm) in cls_fam:
        idx = cls_fam[_fam(nm)]
        ce = classes[idx]
        if ce:
            formulas = _parse_formula(ce.get("note", ""))
            letter_vals = _calc_formula(formulas, level)
            if letter_vals:
                vals = {_LETTER2FIELD[L]: v for L, v in letter_vals.items() if _LETTER2FIELD.get(L)}
                _apply_attrs(doc, vals)
                return

    # 3) 非机甲 -> Enemies params（整名/家族/拆词匹配，取最高 id 真值）
    en = _match_enemy(nm, en_by_name, en_by_fam)
    if en and en.get("params"):
        params = en["params"]
        vals = {_PARAMS2FIELD[i]: params[i] for i in _PARAMS2FIELD if i < len(params)}
        _apply_attrs(doc, vals)
        return

    # 3.5) 非机甲 -> 激进匹配 Enemies（去修饰前缀/罗马数字/子串双向，捞回近似同类真值）
    en2 = _aggressive_match(nm, en_by_name, en_by_fam)
    if en2 and en2.get("params"):
        params = en2["params"]
        vals = {_PARAMS2FIELD[i]: params[i] for i in _PARAMS2FIELD if i < len(params)}
        _apply_attrs(doc, vals)
        return

    # 4) 兜底 -> 解包 baseAtt 真实值；若 baseAtt 是占位默认值，则套通用估算公式
    rb = (me.get("raw_baseAtt") or "").split(",")
    def _i(x, d=50):
        try:
            return int(x)
        except Exception:
            return d
    try:
        rbnum = [int(x) for x in rb[:8]]
    except Exception:
        rbnum = []
    if len(rbnum) >= 8 and rbnum[:8] != _PLACEHOLDER[:8]:
        vals = {"HP": rbnum[0], "MP": rbnum[1]}
        flds = ["Melee", "Shooting", "Armor", "Evasion", "Accuracy", "Lethality",
                "Corrosion", "Resistance", "Initiative", "Counterattack", "Block",
                "ArmorPenetration", "AttackCount"]
        for k, f in enumerate(flds):
            vals[f] = rbnum[k + 2] if len(rbnum) > k + 2 else 50
        _apply_attrs(doc, vals)
    else:
        _estimate_attrs(doc, nm)


# =========================================================================
# 5.5) 临时机甲（无立绘怪物兜底）
# =========================================================================
TEMP_MECH_SRC_PREFIX = "amc_L1"      # 源机甲：基础机甲 amc，4 帧
TEMP_MECH_DST_PREFIX = "temp_L1"     # 目标帧前缀：Monster/temp_L1-*
TEMP_MECH_ANI_ID     = "mon_temp_L1" # 动画 id


def ensure_temp_mech_assets():
    """复制基础机甲 amc_L1 的帧为『临时机甲』(Monster/temp_L1-*)，生成 anim。幂等。返回 art dict 或 None。"""
    import shutil
    from PIL import Image

    n_frames = 4
    frame_uuids = []

    # 统一从 Robot 原图重新处理（源图本身未被放大，故不会重复叠加）。
    # 每次重建帧 + meta + anim，保证三者 uuid 一致；规格与怪物帧一致（放大 + 贴地画布）。
    raw_frames = []
    for i in range(n_frames):
        src = os.path.join(COCOS_ROOT, "assets", "resources", "Robot",
                           f"{TEMP_MECH_SRC_PREFIX}-{i}.png")
        if not os.path.exists(src):
            continue
        with Image.open(src) as srcim:
            raw_frames.append(srcim.convert("RGBA").copy())
    if not raw_frames:
        print("[temp-mech] 源机甲帧缺失，无法生成临时机甲")
        return None

    canvas_w, canvas_h = plan_canvas([(f.width, f.height) for f in raw_frames])

    for i, fr in enumerate(raw_frames):
        out = compose_on_canvas(fr, canvas_w, canvas_h)
        dst = os.path.join(RES_DIR, f"{TEMP_MECH_DST_PREFIX}-{i}.png")
        out.save(dst, "PNG")
        base_uuid = str(uuid.uuid4())
        meta = make_frame_meta(base_uuid, f"{TEMP_MECH_DST_PREFIX}-{i}", canvas_w, canvas_h)
        with open(dst + ".meta", "w", encoding="utf-8") as mf:
            mf.write(json.dumps(meta, indent=2, ensure_ascii=False) + "\n")
        frame_uuids.append(f"{base_uuid}@f9941")

    write_anim(TEMP_MECH_ANI_ID, frame_uuids)
    print(f"[temp-mech] 已生成临时机甲：{TEMP_MECH_ANI_ID} 帧={len(frame_uuids)} "
          f"画布={canvas_w}x{canvas_h}")
    return {"ani_id": TEMP_MECH_ANI_ID, "frame_prefix": TEMP_MECH_DST_PREFIX,
            "frame_count": len(frame_uuids), "subcat": "临时机甲", "stage": 1, "temp": True}


def _gb2312_initial(ch: str) -> str:
    """兜底：用 GB2312 区位码判断拼音首字母（一级字库按拼音排序）。

    仅当 pypinyin 不可用时使用 —— 本机 pip 走境外源易超时，
    为避免整条流水线卡死，保留这个零依赖兜底。
    """
    try:
        raw = ch.encode("gb2312")
    except Exception:
        return ""
    if len(raw) != 2:
        return ""
    code = (raw[0] << 8) | raw[1]
    # (起始码, 结束码, 拼音首字母)
    bounds = (
        (0xB0A1, 0xB0C4, "a"), (0xB0C5, 0xB2C0, "b"), (0xB2C1, 0xB4ED, "c"),
        (0xB4EE, 0xB6E9, "d"), (0xB6EA, 0xB7A1, "e"), (0xB7A2, 0xB8C0, "f"),
        (0xB8C1, 0xB9FD, "g"), (0xB9FE, 0xBBF6, "h"), (0xBBF7, 0xBFA5, "j"),
        (0xBFA6, 0xC0AB, "k"), (0xC0AC, 0xC2E7, "l"), (0xC2E8, 0xC4C2, "m"),
        (0xC4C3, 0xC5B5, "n"), (0xC5B6, 0xC5BD, "o"), (0xC5BE, 0xC6D9, "p"),
        (0xC6DA, 0xC8BA, "q"), (0xC8BB, 0xC8F5, "r"), (0xC8F6, 0xCBF9, "s"),
        (0xCBFA, 0xCDD9, "t"), (0xCDDA, 0xCEF3, "w"), (0xCEF4, 0xD1B8, "x"),
        (0xD1B9, 0xD4D0, "y"), (0xD4D1, 0xD7F9, "z"),
    )
    for lo, hi, letter in bounds:
        if lo <= code <= hi:
            return letter
    return ""


_PINYIN_BACKEND = None


def _chinese_initial(ch: str) -> str:
    """取单个汉字的拼音首字母：优先 pypinyin，缺失则回退 GB2312 表。"""
    global _PINYIN_BACKEND
    if _PINYIN_BACKEND is None:
        try:
            from pypinyin import lazy_pinyin as _lp
            _PINYIN_BACKEND = ("pypinyin", _lp)
        except Exception:
            _PINYIN_BACKEND = ("gb2312", None)
    kind, fn = _PINYIN_BACKEND
    if kind == "pypinyin":
        try:
            py = fn(ch)
            if py and py[0]:
                return py[0][0].lower()
        except Exception:
            pass
    return _gb2312_initial(ch)


def pinyin_initials(name: str) -> str:
    """中文名 -> 逐字拼音首字母（小写）。

    规则（用户指定）：
      - 中文取每个字的首字母：枯骨魔龙 -> kgml
      - 名称里夹杂的英文/数字保持（NFKC 归一后保留 ASCII 字母数字）
      - 符号（· | - 空格 等）丢弃，保证文件名合法
      - 罗马数字 Ⅰ/Ⅱ 经 NFKC 归一为 I/II 后保留
      - '|' 之后是进化阶段后缀（如 铁臂|初），不参与缩写（阶段由 _L1/_L2/_L3 表达）
    """
    # 先 NFKC 归一（全角｜-> |、Ⅰ-> I），再切掉进化阶段后缀
    base = unicodedata.normalize("NFKC", str(name or ""))
    base = base.split("|")[0].strip()
    out = []
    for ch in base:
        if "\u4e00" <= ch <= "\u9fff":          # 中文
            letter = _chinese_initial(ch)
            if letter:
                out.append(letter)
        elif ch.isascii() and ch.isalnum():     # 英文 / 数字：保持
            out.append(ch.lower())
        # 其余符号丢弃
    return "".join(out) or "mon"


# 同一怪物名的进化阶段（1/2/3 = 初/中/终）；同一 base key 必须同时能容下全部阶段
MONSTER_STAGES = (1, 2, 3)


class AniKeyAllocator:
    """动画名分配器：保证 AniID 全局唯一，且不与机甲(Robot)现有动画重名。

    为什么必须避开 Robot：RobotShow.prefab 已把 99 个机甲动画静态挂到 Animation 组件上，
    前端先在静态 clips 里按名字查找 —— 若怪物 AniID 撞上机甲名，会直接播成机甲动画。
    重名者按用户规则追加后缀：kgml -> kgml_2 / kgml_3 ...

    按「阶段族」分配：同一个中文名的 _L1/_L2/_L3 一次性占位，
    避免出现 铁臂 的 L1 叫 tb、L2 却叫 tb_2 这种前后不一致。
    """

    def __init__(self, reserved=(), stages=MONSTER_STAGES):
        self.stages = tuple(stages)
        self.used = {}          # ani_name -> 归属来源(source_key)
        for a in reserved:
            self.used[a] = "robot"

    def alloc(self, base_key: str, stage: int, source_key: str) -> str:
        """返回可用的 base key（不含 _L{stage}）。同一来源(source_key)可复用同名。"""
        n = 1
        while True:
            candidate = base_key if n == 1 else f"{base_key}_{n}"
            family = [f"{candidate}_L{s}" for s in self.stages]
            owners = {self.used.get(nm) for nm in family}
            owners.discard(None)
            if not owners or owners == {source_key}:
                for nm in family:
                    if self.used.get(nm) is None:
                        self.used[nm] = source_key
                return candidate
            n += 1


def load_robot_ani_names():
    """读取现有机甲动画名（assets/Image/Robot/ani/*.anim），作为保留字。"""
    d = os.path.join(COCOS_ROOT, "assets", "Image", "Robot", "ani")
    if not os.path.isdir(d):
        return set()
    return {os.path.splitext(f)[0] for f in os.listdir(d) if f.endswith(".anim")}


def clean_orphan_assets(keep_prefixes, keep_anis):
    """删除 Monster 目录下不在本轮产物清单里的 png/meta/anim（旧命名遗留）。"""
    removed = {"png": 0, "meta": 0, "anim": 0}
    for d, kinds in (
        (RES_DIR, ("png", "meta")),
        (ANI_DIR, ("anim",)),
        (ANI_RES_DIR, ("anim",)),
    ):
        if not os.path.isdir(d):
            continue
        for fn in os.listdir(d):
            base, ext = os.path.splitext(fn)
            if ext == ".meta":                       # xxx.png.meta -> xxx.png
                base, ext = os.path.splitext(base)
                if ext != ".png":
                    continue
                kind = "meta"
            elif ext == ".png":
                kind = "png"
            elif ext == ".anim":
                base2, ext2 = os.path.splitext(base)
                if ext2 == ".anim":                  # xxx.anim.meta -> xxx.anim
                    continue
                kind = "anim"
            else:
                continue

            ext = ext.lower()
            # png 与其 meta 共用同一个 frame_prefix（去掉尾部 -序号）
            if kind in ("png", "meta"):
                keep = base.rsplit("-", 1)[0] in keep_prefixes
            else:
                keep = base in keep_anis
            if not keep:
                try:
                    os.remove(os.path.join(d, fn))
                    removed[kind] += 1
                except Exception:
                    pass
    return removed


# =========================================================================
# 6) 执行：assets 模式
# =========================================================================
def run_assets(scope, limit, clean=False):
    os.makedirs(RES_DIR, exist_ok=True)
    os.makedirs(ANI_DIR, exist_ok=True)

    # 预生成临时机甲（无立绘怪物兜底用）
    temp_art = ensure_temp_mech_assets()

    raw = parse_txt(TXT_PATH)
    by_rel, by_name = build_gif_index(GIF_ROOT)
    print(f"[parse] 怪物总数={len(raw)}  gif 索引={len(by_rel)} (by_name={len(by_name)})")

    # 命名：中文名逐字拼音首字母（枯骨魔龙 -> kgml）；重名按 _2/_3 递进；
    # 已有机甲动画名作为保留字，避免 RobotShow 静态 clips 被误命中。
    allocator = AniKeyAllocator(reserved=load_robot_ani_names())
    group_key = {}      # (gif_path, stage) -> 已分配的 base key，同一立绘多处复用

    docs = []
    generated = []   # 资源生成清单
    skipped_no_art = []
    name_table = []  # (MonsterID, 中文名, base key, ani id)

    def select(rec, idx):
        g = resolve_gif(rec, by_rel, by_name)
        if g is None:
            return None  # 无立绘
        if scope == "sample-zerg":
            return g if g[1] == "虫族" else None
        if scope == "sample-gifrel":
            return g if rec.get("gifRel") else None
        return g  # full

    count = 0
    for raw_rec in raw:
        rec = parse_monster(raw_rec)
        g = select(rec, count)
        if g is None:
            # 无立绘：用临时机甲兜底（build_doc 内自动打 TempArt 标记）
            docs.append(build_doc(rec, temp_art))
            skipped_no_art.append(rec["MonsterID"])
            continue
        gif_path, subcat, img_id, stage = g
        # 命名 core：中文名 -> 拼音首字母；同一中文名（忽略 |阶段 后缀）共用同一 base key
        cn_key = strip_stage(rec["MonsterName"])
        base_key = pinyin_initials(rec["MonsterName"])
        gk = (gif_path, stage)
        if gk in group_key:
            mk = group_key[gk]
        else:
            mk = allocator.alloc(base_key, stage, f"name:{cn_key}")
            group_key[gk] = mk
        frame_prefix = f"{mk}_L{stage}"
        ani_id = frame_prefix
        name_table.append((rec["MonsterID"], rec["MonsterName"], base_key, ani_id))
        try:
            frames = split_gif_to_frames(gif_path, frame_prefix, RES_DIR)
        except Exception as e:
            print(f"  [WARN] 拆帧失败 id={rec['MonsterID']} {rec['MonsterName']}: {e}")
            skipped_no_art.append(rec["MonsterID"])
            docs.append(build_doc(rec, None))
            continue
        # 动画（双写：Image 挂载 + resources 运行时加载）
        uuids = [u for _, u in frames]
        anim_path = write_anim(ani_id, uuids)
        art = {
            "ani_id": ani_id,
            "frame_prefix": frame_prefix,
            "frame_count": len(frames),
            "subcat": subcat,
            "stage": stage,
        }
        docs.append(build_doc(rec, art))
        generated.append({
            "MonsterID": rec["MonsterID"],
            "Name": rec["MonsterName"],
            "ani_id": ani_id,
            "frame_prefix": frame_prefix,
            "AniID": ani_id,
            "Frames": len(frames),
            "Anim": os.path.relpath(anim_path, COCOS_ROOT),
        })
        count += 1
        if limit and count >= limit:
            break

    # 清理旧命名残留（默认关闭：需显式 --clean，且仅 full 全流程才做，避免 sample 模式误删）
    if clean and scope == "full" and not limit:
        keep_prefixes = {a["frame_prefix"] for a in generated} | {TEMP_MECH_DST_PREFIX}
        keep_anis = {a["ani_id"] for a in generated} | {TEMP_MECH_ANI_ID}
        removed = clean_orphan_assets(keep_prefixes, keep_anis)
        print(f"[clean] 清理旧命名残留 png={removed['png']} meta={removed['meta']} "
              f"anim={removed['anim']}")

    # 导出 JSON 归档
    with open(EXPORT_PATH, "w", encoding="utf-8") as ef:
        json.dump({
            "generated_at": datetime.now().isoformat(timespec="seconds"),
            "scope": scope,
            "count_with_art": len(generated),
            "count_no_art": len(skipped_no_art),
            "no_art_ids": skipped_no_art,
            "name_table": [
                {"MonsterID": m, "Name": n, "PinyinKey": k, "AniID": a}
                for (m, n, k, a) in name_table
            ],
            "docs": docs,
        }, ef, indent=2, ensure_ascii=False)

    print(f"[assets] 生成立绘怪物={len(generated)}  无立绘={len(skipped_no_art)}")
    print(f"[assets] 数据已写入: {EXPORT_PATH}")
    for row in name_table[:25]:
        print(f"   - #{row[0]:>3} {row[1]:<22} -> {row[3]}")
    if len(name_table) > 25:
        print(f"   ... 其余 {len(name_table)-25} 条见 EXPORT_PATH.name_table")
    return docs, generated, skipped_no_art


# =========================================================================
# 7) 执行：import 模式
# =========================================================================
def run_import(mongo_uri, db_name, export_path=None, drop_existing=True):
    if export_path is None:
        export_path = EXPORT_PATH
    if not os.path.exists(export_path):
        print(f"[import] 缺少数据文件 {export_path}，请先运行 --mode assets")
        return
    with open(export_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    docs = data["docs"]
    try:
        import pymongo
    except ImportError:
        print("[import] 未安装 pymongo，无法导入 MongoDB（JSON 归档已保留）")
        return
    try:
        client = pymongo.MongoClient(mongo_uri, serverSelectionTimeoutMS=3000)
        client.admin.command("ping")
    except Exception as e:
        print(f"[import] MongoDB 不可达 ({mongo_uri})：{e}")
        print("[import] JSON 归档已保留，待 mongod 启动后重跑: "
              f"python monster_port.py --mode import --mongo-uri {mongo_uri}")
        return
    db = client[db_name]
    col = db["MonsterBase"]
    # 结构变更为 RobotBase 同构后，旧文档残留顶层 MonsterID/occID 等字段，
    # upsert 不会清除 → 默认整集重建，保证字段结构纯净。
    if drop_existing:
        n_old = col.estimated_document_count()
        col.drop()
        print(f"[import] 已清空旧 MonsterBase（{n_old} 条），按新结构重建")
    # 与 RobotBase 同构：以 RobotID 为唯一键
    col.create_index([("RobotID", 1)], unique=True, sparse=True)
    col.create_index([("MonsterExtra.MonsterID", 1)], unique=True, sparse=True)
    n_upsert = 0
    for d in docs:
        col.update_one({"RobotID": d["RobotID"]}, {"$set": d}, upsert=True)
        n_upsert += 1
    print(f"[import] MonsterBase upsert 完成: {n_upsert} 条  (db={db_name}, 唯一键 RobotID)")


# =========================================================================
def main():
    ap = argparse.ArgumentParser(description="JJFB 野怪移植")
    ap.add_argument("--mode", choices=["assets", "import", "all"], default="assets")
    ap.add_argument("--scope", default="full",
                    help="sample-zerg | sample-gifrel | full")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--mongo-uri", default="mongodb://127.0.0.1:27017/")
    ap.add_argument("--db", default="jjfb")
    ap.add_argument("--keep-existing", action="store_true",
                    help="导入时不重建集合（默认整集重建，保证字段结构纯净）")
    ap.add_argument("--clean", action="store_true",
                    help="生成后清理 Monster 目录下不属于本轮产物的旧文件（改名后需跑一次）")
    args = ap.parse_args()

    if args.mode in ("assets", "all"):
        docs, gen, skip = run_assets(args.scope, args.limit, clean=args.clean)
        if args.mode == "all":
            run_import(args.mongo_uri, args.db, drop_existing=not args.keep_existing)
    elif args.mode == "import":
        run_import(args.mongo_uri, args.db, drop_existing=not args.keep_existing)


if __name__ == "__main__":
    main()
