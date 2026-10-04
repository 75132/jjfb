# -*- coding: utf-8 -*-
"""根据 server/data/Skills.json 生成本工程新增技能书的 Items.json 条目。

新增技能书号 **0076–0089**（0076-0089，14 本）。
  ⚠ 原定 0057-0070 与现有 Items.json 冲突：0057=还原晶体、0058-0075=各机甲核心。

用法（安全优先：**默认只演练，不写盘**）：
  python tools/build_skill_books.py            # 打印 + 输出预览 JSON（dry-run）
  python tools/build_skill_books.py --apply    # 真正写 assets/resources/json/Items.json
"""
import io
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKILLS = os.path.join(ROOT, "server", "data", "Skills.json")
ITEMS = os.path.join(ROOT, "assets", "resources", "json", "Items.json")
PREVIEW = os.path.join(ROOT, "tools", "_preview", "skill_books_patch.json")

# 沿用现有技能书条目模板（见 0036-0051）
TEMPLATE = {
    "iconIndex": "IconSet2-232",
    "price": 2000,
    "consumable": True,
    "itypeId": 1,
    "UsageTarget": "Pet",
    "CanStack": True,
    "StackLimit": 64,
}


def build_entries():
    with io.open(SKILLS, encoding="utf-8") as f:
        data = json.load(f)

    entries = []
    for s in data["skills"]:
        book = s.get("book_id")
        if not book or book < 76:
            continue
        entries.append({
            "id": book,
            "name": "技能书-%s" % s["name"],
            "effect": s["name"],
            **TEMPLATE,
            "effecttext": s["name"],
        })
    entries.sort(key=lambda e: e["id"])
    return data, entries


def main():
    data, entries = build_entries()
    apply = "--apply" in sys.argv

    print("新增技能书 %d 本（id %s）" % (len(entries), [e["id"] for e in entries]))
    for e in entries:
        print("  %3d  %-20s effect=%s" % (e["id"], e["name"], e["effect"]))

    if not apply:
        os.makedirs(os.path.dirname(PREVIEW), exist_ok=True)
        with io.open(PREVIEW, "w", encoding="utf-8") as f:
            json.dump(entries, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print("\n[对照] 现有 id 57-75 占用情况：")
        with io.open(ITEMS, encoding="utf-8") as f:
            items = json.load(f)
        for it in items:
            if 55 <= it["id"] <= 62:
                print("  %3d  %s" % (it["id"], it["name"]))
        print("  ...（75 = %s）" % [i["name"] for i in items if i["id"] == 75][0])
        print("\n预览已写 %s\n（dry-run，未改 Items.json；加 --apply 才写入）" % PREVIEW)
        return

    with io.open(ITEMS, encoding="utf-8") as f:
        items = json.load(f)
    existing = {it["id"] for it in items}
    added, updated = 0, 0
    for e in entries:
        if e["id"] in existing:
            for i, it in enumerate(items):
                if it["id"] == e["id"]:
                    items[i] = e
                    updated += 1
                    break
        else:
            items.append(e)
            added += 1
    items.sort(key=lambda it: it["id"])
    with io.open(ITEMS, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print("\n已写入 %s（新增 %d / 更新 %d，共 %d 条）" % (ITEMS, added, updated, len(items)))


if __name__ == "__main__":
    main()
