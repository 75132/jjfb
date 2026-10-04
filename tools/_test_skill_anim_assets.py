# -*- coding: utf-8 -*-
"""技能特效资源资产自检（RPG 移植特效「原比例 + 不裁切」口径 + uuid 引用完整性）

口径来源
--------
用户 2026-10-01 两条相邻指令：
  ① 「**从 RPG 里搬出来的特效不要放大，他本来是贴合的，你放大了导致我的特效不全；
      所以 RPG 移植过来的特效就原比例，我自己的素材的不用维持原样就好**」
  ② 「**你给我这个图怎么是不全的，被裁了？**」（看了预览图后）

→ 两类特效，两套口径，不许混：

| 来源 | 生成器 | 缩放 |
|---|---|---|
| **RPG Maker 特写动画**（15 个） | `tools/rpg_anim_port.py` | **1×（原比例）** |
| **用户自己的素材**（xg1/xg2 导出 gif，24 个） | `tools/skill_gif_port.py` | 2×（**不变**） |

② 的根因不是缩放，是**画布**：MV 的 `position=3`（画面级）动画图元偏移远超 192 格
（虚空导弹 x ∈ [-408, 312]，251 个图元里 211 个在 192 格之外），原先固定 192×192 画布
+ `Image.paste` → **超出的部分被静默裁掉**。现在画布 = 全动画图元并集（`anim_window()`）。

覆盖
----
1. 两个生成器的缩放常量正确（`UPSCALE == 1` / `SCALE == 2`）；
2. 15 个 RPG clip **逐条**：帧数快照 + 同一 clip 内帧尺寸一致 + 画布 ≥ 192（保留原生取景）；
3. ★**防裁**：把画布四周各放大 64px 重渲染，alpha 并集 bbox 必须只是整体平移
   （`rpg_anim_port.check_not_clipped()`）—— 画布一动就少内容，这条会立刻红；
4. `_values` 引用的 spriteFrame uuid **与帧 meta 完全一致**；
5. `assets/UIPrefab/RobotShow.prefab` 引用的 15 个 clip uuid **全部命中**
   （clip uuid 漂移 → Animation 播放列表断链 → 特效静默不播）；
6. ★编辑器资源库 `library/` 缓存的 spriteFrame 尺寸与源帧一致
   （不一致 → 控制台刷 `Rect width exceeds maximum margin`）。
7. 生成器带 **uuid 复用**（`existing_uuid`）——防止再次重生成时 uuid 漂移。

运行：`python tools/_test_skill_anim_assets.py`
"""
from __future__ import annotations

import glob
import io
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

PASS = 0
FAIL = 0
FAILED: list = []


def ck(name, cond, detail=None):
    global PASS, FAIL
    if cond:
        PASS += 1
        print("  ok   %s" % name)
    else:
        FAIL += 1
        FAILED.append(name)
        print("  FAIL %s%s" % (name, ("  -> %s" % detail) if detail is not None else ""))


# RPG Maker 移植的 15 个 clip（短名）——与 `rpg_anim_port.py` 的 `MAPPING` 一一对应
RPG_CLIPS = [
    "guangrenzhan", "chaonengquan", "leitingzhenshe", "leitingchongji", "lizijiguang",
    "denglizidanmu", "xukongdaodan", "nengliangbaopo", "diancifengbao", "shikongniuqu",
    "yinliyazhi", "denglizipingzhang", "xukongchongji", "shengminghuifu", "nenglianghuifu",
]
# 帧数快照（防批量丢帧）。★2026-10-01 修画布后 +4：lizijiguang/xukongdaodan 各 +1、
# shengminghuifu +2 —— 这几个「首尾帧」原先内容全在 192 格之外，被当成空帧剔掉了。
RPG_FPS_EXPECT = {
    "guangrenzhan": 5, "chaonengquan": 5, "leitingzhenshe": 10, "leitingchongji": 12,
    "lizijiguang": 14, "denglizidanmu": 16, "xukongdaodan": 65, "nengliangbaopo": 26,
    "diancifengbao": 44, "shikongniuqu": 20, "yinliyazhi": 29, "denglizipingzhang": 37,
    "xukongchongji": 62, "shengminghuifu": 21, "nenglianghuifu": 17,
}
FRAMES_TOTAL = 383
CELL = 192                   # MV 图集格边长 = 最小画布（原生取景，不许更小）
RES_SKILL = os.path.join(ROOT, "assets", "resources", "Skill")
ANI_DIR = os.path.join(ROOT, "assets", "Image", "Skill", "ani")
PREFAB = os.path.join(ROOT, "assets", "UIPrefab", "RobotShow.prefab")
LIBRARY = os.path.join(ROOT, "library")


def read(path):
    with io.open(path, encoding="utf-8", errors="replace") as f:
        return f.read()


def meta_of(path):
    with io.open(path, encoding="utf-8") as f:
        return json.load(f)


def frame_paths(short):
    fs = glob.glob(os.path.join(RES_SKILL, "%s-*.png" % short))
    return sorted(fs, key=lambda p: int(re.search(r"-(\d+)\.png$", p).group(1)))


def frame_size(png_meta_path):
    d = meta_of(png_meta_path)
    u = d.get("subMetas", {}).get("f9941", {}).get("userData", {})
    return int(u.get("width") or 0), int(u.get("height") or 0)


def clip_uuids(anim_path):
    """取出 clip 的 `_values` 里引用到的 spriteFrame uuid（去掉 @f9941 后缀）。"""
    found: set = set()

    def walk(v):
        if isinstance(v, str):
            if "@f9941" in v:
                found.add(v.split("@")[0])
        elif isinstance(v, dict):
            for x in v.values():
                walk(x)
        elif isinstance(v, list):
            for x in v:
                walk(x)

    walk(json.loads(read(anim_path)))
    return found


def main():
    rpg_src = read(os.path.join(ROOT, "tools", "rpg_anim_port.py"))
    gif_src = read(os.path.join(ROOT, "tools", "skill_gif_port.py"))

    # ---------- 1. 生成器缩放口径 ----------
    print("[1] 生成器缩放口径（两类特效两套口径）")
    m = re.search(r"^UPSCALE\s*=\s*(\d+)", rpg_src, re.M)
    ck("rpg_anim_port.py 有 UPSCALE 常量", bool(m))
    ck("★RPG 移植特效 UPSCALE = 1（原比例，不放大）", m and int(m.group(1)) == 1,
       m.group(1) if m else None)
    m2 = re.search(r"^SCALE\s*=\s*(\d+)", gif_src, re.M)
    ck("skill_gif_port.py 有 SCALE 常量", bool(m2))
    ck("用户自己的素材 SCALE = 2（保持不动）", m2 and int(m2.group(1)) == 2,
       m2.group(1) if m2 else None)

    ck("rpg_anim_port.py 定义 existing_uuid（uuid 复用）", "def existing_uuid" in rpg_src)
    ck("帧 meta 走 uuid 复用", 'existing_uuid(png + ".meta")' in rpg_src)
    ck("clip meta 走 uuid 复用", 'existing_uuid(ap + ".meta")' in rpg_src)

    # ---------- 1b. ★防裁实现守卫 ----------
    print("[1b] ★防裁实现守卫（画布 = 全动画图元并集）")
    ck("定义 anim_window()（全动画图元并集）", "def anim_window(" in rpg_src)
    ck("定义 _tile_extent()（含旋转/缩放的图元包围盒）", "def _tile_extent(" in rpg_src)
    ck("render_frame 走 win 画布（不再写死 CELL）",
       "def render_frame(anim, frame, win=None)" in rpg_src)
    ck("画布按 anim_window 开", "win = anim_window(a)" in rpg_src)
    ck("有画布安全边 PAD", re.search(r"^PAD\s*=\s*\d+", rpg_src, re.M) is not None)
    ck("定义 check_not_clipped()（自检）", "def check_not_clipped(" in rpg_src)
    ck("docstring 标了「防裁」口径", "特效被裁" in rpg_src)

    # ---------- 2/3. 15 个 clip 逐条 ----------
    print("[2] RPG 移植 15 个 clip：帧数快照 + 尺寸自洽")
    total_frames = 0
    for s in RPG_CLIPS:
        fs = frame_paths(s)
        exp = RPG_FPS_EXPECT[s]
        ck("%s 帧数 = %d" % (s, exp), len(fs) == exp, len(fs))
        total_frames += len(fs)
        sizes = [frame_size(p + ".meta") for p in fs] if fs else []
        ck("%s 15 帧尺寸一致（首个 %s）" % (s, sizes[0] if sizes else "-"),
           bool(sizes) and len(set(sizes)) == 1, sorted(set(sizes))[:3])
        small = [z for z in sizes if z[0] < CELL or z[1] < CELL]
        ck("%s 画布不小于原生 %d 格" % (s, CELL), bool(sizes) and not small, small[:2])
    ck("15 个 clip 帧合计 = %d" % FRAMES_TOTAL, total_frames == FRAMES_TOTAL, total_frames)

    print("[3] clip 的 _values 引用与帧 meta 一一对应")
    for s in RPG_CLIPS:
        anim = clip_uuids(os.path.join(ANI_DIR, "%s.anim" % s))
        frames = {meta_of(p + ".meta")["uuid"] for p in frame_paths(s)}
        ck("%s 引用帧 %d 个全部对上" % (s, len(frames)),
           bool(frames) and anim == frames,
           "缺 %d 多 %d" % (len(frames - anim), len(anim - frames)))

    # ---------- 3b. ★防裁实证（真渲染比对） ----------
    print("[3b] ★防裁实证：画布四周 +64px 重渲染，bbox 必须只是平移")
    try:
        import rpg_anim_port as M

        plan, problems = M.build()
        ck("生成器可复算 15 个 clip", len(plan) == 15, len(plan))
        ck("生成器无问题项", not problems, problems[:2])
        by = {p["short"]: p for p in plan}
        mismatch = []
        for s in RPG_CLIPS:
            p = by.get(s)
            if not p:
                mismatch.append(s + ":未算出")
                continue
            if (p["w"], p["h"]) != frame_size(frame_paths(s)[0] + ".meta"):
                mismatch.append("%s:盘上 %s ≠ 算出 %s"
                                % (s, frame_size(frame_paths(s)[0] + ".meta"), (p["w"], p["h"])))
        ck("盘上帧尺寸 == 生成器复算尺寸", not mismatch, mismatch[:2])
        bad = M.check_not_clipped(plan)
        ck("★15 个 clip 放大画布重渲染后 bbox 一致（一点没裁）", not bad,
           [b["short"] for b in bad][:3])
        # 内存实况（仅报告，不作断言）
        mb = sum(p["w"] * p["h"] * 4 * p["n"] for p in plan) / 1048576.0
        print("  info 15 个 clip 逐帧 RGBA 合计 ≈ %.0f MB（画面级动画本就一屏大小）" % mb)
    except Exception as e:                                     # noqa: BLE001
        ck("★防裁实证可运行", False, "导入/渲染失败：%r" % (e,))

    # ---------- 4. prefab 引用完整性 ----------
    print("[4] RobotShow.prefab 引用完整性（clip uuid 不许漂移）")
    ck("RobotShow.prefab 存在", os.path.exists(PREFAB))
    prefab = read(PREFAB)
    miss = []
    for s in RPG_CLIPS:
        uid = meta_of(os.path.join(ANI_DIR, "%s.anim.meta" % s))["uuid"]
        if uid not in prefab:
            miss.append(s)
    ck("15 个 clip uuid 在 prefab 中全部命中", not miss, miss)

    # ---------- 5. 编辑器资源库缓存一致 ----------
    print("[5] 编辑器 library 缓存与源帧尺寸一致（防 Rect 超界报错刷屏）")
    ck("library 目录存在", os.path.isdir(LIBRARY))
    if os.path.isdir(LIBRARY):
        out = subprocess.run(
            [sys.executable, os.path.join(ROOT, "tools", "_sync_skill_library_cache.py")],
            capture_output=True, text=True, cwd=ROOT, encoding="utf-8", errors="replace")
        tail = (out.stdout or "").strip().splitlines()[-1:] or [""]
        ck("★library 缓存无需补齐（需补 0）", "需补 0" in tail[0], tail[0])

    # ---------- 6. 动画 clip 总账 ----------
    print("[6] 动画 clip 总账")
    clips = sorted(os.path.basename(p)[:-5] for p in glob.glob(os.path.join(ANI_DIR, "*.anim")))
    ck("动画 clip 总数 = 39", len(clips) == 39, len(clips))
    ck("15 个 RPG clip 全部在目录中", all(s in clips for s in RPG_CLIPS))

    print("\n技能特效资源自检：通过 %d / 失败 %d" % (PASS, FAIL))
    if FAILED:
        print("失败项：" + "；".join(FAILED))
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
