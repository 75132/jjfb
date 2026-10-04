# -*- coding: utf-8 -*-
"""技能书落库修补：三份 Items.json 同步

1) 追加 14 本新增技能书（id 0076-0089，来自 server/data/Skills.json）
2) 修正 4 条旧条目的 effect / effecttext 占位错误：
     0036 会心一击 -> 肉搏攻击
     0039 虚空踢   -> 雷霆震慑
     0055 光刃斩   -> 自动恢复
     0056 光刃斩   -> 纳米侵蚀

目标文件（config_loader.py 有三段查找链，全部同步）：
  assets/resources/json/Items.json     客户端（11 字段，完整）
  server/data/Items.json               服务端首选（11 字段，完整）
  server/handlers/json/Items.json      服务端兜底（6 字段，精简）

用法（安全优先：**默认只演练，不写盘**）：
  python tools/patch_items_skillbooks.py            # 打印变更清单
  python tools/patch_items_skillbooks.py --apply    # 备份后写盘
"""
import io
import json
import os
import shutil
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKILLS = os.path.join(ROOT, "server", "data", "Skills.json")
BACKUP_DIR = os.path.join(ROOT, "tools", "_backup")

TARGETS = [
    ("assets/resources/json/Items.json", "full"),
    ("server/data/Items.json", "full"),
    ("server/handlers/json/Items.json", "slim"),
]

# 旧条目 effect 占位错误修正（id -> 正确值），effect 与 effecttext 同时改
FIX_EFFECT = {
    36: "肉搏攻击",
    39: "雷霆震慑",
    55: "自动恢复",
    56: "纳米侵蚀",
}

# 技能书号起点（0057-0075 已被还原晶体 / 机甲核心占用）
BOOK_START = 76


def make_entry(iid, name, style):
    if style == "full":
        return {
            "id": iid,
            "name": "技能书-%s" % name,
            "effect": name,
            "iconIndex": "IconSet2-232",
            "price": 2000,
            "consumable": True,
            "itypeId": 1,
            "UsageTarget": "Pet",
            "CanStack": True,
            "StackLimit": 64,
            "effecttext": name,
        }
    return {
        "id": iid,
        "name": "技能书-%s" % name,
        "effect": name,
        "iconIndex": "IconSet2-232",
        "price": 2000,
        "consumable": True,
        "itypeId": 1,
    }


def build_new_entries():
    with io.open(SKILLS, encoding="utf-8") as f:
        data = json.load(f)
    out = []
    for s in data["skills"]:
        book = s.get("book_id")
        if not book or book < BOOK_START:
            continue
        out.append((book, s["name"]))
    out.sort(key=lambda x: x[0])
    return out


def patch_file(rel, style, entries, apply):
    path = os.path.join(ROOT, rel)
    if not os.path.exists(path):
        print("  [跳过] 不存在：%s" % rel)
        return None

    with io.open(path, encoding="utf-8") as f:
        raw = f.read()
    items = json.loads(raw)
    by_id = {it.get("id"): it for it in items}

    changes = []

    # 1) 修 effect 占位
    for iid, want in sorted(FIX_EFFECT.items()):
        it = by_id.get(iid)
        if not it:
            continue
        old = it.get("effect")
        if old != want:
            it["effect"] = want
            if "effecttext" in it:
                it["effecttext"] = want
            changes.append("  修正  id=%-3d %-14s effect: %r -> %r"
                           % (iid, it.get("name"), old, want))

    # 2) 追加新技能书
    added = []
    for iid, name in entries:
        if iid in by_id:
            existing = by_id[iid]
            if existing.get("effect") == name:
                continue
            existing["effect"] = name
            if "effecttext" in existing:
                existing["effecttext"] = name
            changes.append("  修书  id=%-3d 已存在，effect 对齐为 %r" % (iid, name))
            continue
        items.append(make_entry(iid, name, style))
        added.append((iid, name))

    if added:
        changes.append("  新增  %d 本技能书：id %s"
                       % (len(added), [i for i, _ in added]))

    if not changes:
        print("  [无需改动] %s" % rel)
        return None

    items.sort(key=lambda it: it.get("id", 0))
    new_raw = json.dumps(items, ensure_ascii=False, indent=2)

    print("  %s  (%d -> %d 条)" % (rel, len(json.loads(raw)), len(items)))
    for c in changes:
        print(c)

    if not apply:
        return new_raw

    # 备份（只归档，不删原文件）
    # ⚠ 备份名必须带上**目标路径**：三份 Items.json 基名相同，若只用「时间戳+basename」，
    #   同一秒写入会互相覆盖 → 前两份备份被冲掉（2026-09-30 实际踩到过）。
    os.makedirs(BACKUP_DIR, exist_ok=True)
    stamp = time.strftime("%Y%m%d_%H%M%S")
    tag = rel.replace("\\", "/").replace("/", "_")
    bak = os.path.join(BACKUP_DIR, "%s_%s" % (stamp, tag))
    shutil.copy2(path, bak)
    print("  ✓ 备份 → %s" % os.path.relpath(bak, ROOT))

    with io.open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(new_raw)
    print("  ✓ 已写入 %s" % rel)
    return new_raw


def main():
    apply = "--apply" in sys.argv
    entries = build_new_entries()
    print("新增技能书 %d 本（id %s）" % (len(entries), [i for i, _ in entries]))
    for iid, name in entries:
        print("   %3d  技能书-%s" % (iid, name))
    print("")
    for rel, style in TARGETS:
        patch_file(rel, style, entries, apply)
    print("")
    if not apply:
        print("dry-run，未改任何文件；加 --apply 才写盘（会先备份到 tools/_backup/）")


if __name__ == "__main__":
    main()
