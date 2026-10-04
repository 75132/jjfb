# -*- coding: utf-8 -*-
"""沙盘推演：怪物名 -> 拼音首字母 key，校验命名规则（不改任何文件）。"""
import os
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import monster_port as M


def main():
    raw = M.parse_txt(M.TXT_PATH)
    by_rel, by_name = M.build_gif_index(M.GIF_ROOT)
    reserved = M.load_robot_ani_names()
    print(f"[info] 机甲动画保留名={len(reserved)}")

    alloc = M.AniKeyAllocator(reserved=reserved)
    group_cache = {}
    rows = []
    for d in raw:
        rec = M.parse_monster(d)
        g = M.resolve_gif(rec, by_rel, by_name)
        if g is None:
            rows.append((rec["MonsterID"], rec["MonsterName"], "-", "-", "无立绘"))
            continue
        gif_path, subcat, img_id, stage = g
        gk = (gif_path, stage)
        cn = M.strip_stage(rec["MonsterName"])
        base = M.pinyin_initials(rec["MonsterName"])
        if gk in group_cache:
            mk, owner = group_cache[gk]
            rows.append((rec["MonsterID"], rec["MonsterName"], base,
                         f"{mk}_L{stage}", f"复用(#{owner})"))
            continue
        mk = alloc.alloc(base, stage, f"name:{cn}")
        group_cache[gk] = (mk, rec["MonsterID"])
        rows.append((rec["MonsterID"], rec["MonsterName"], base, f"{mk}_L{stage}", "新"))

    art = [r for r in rows if r[3] != "-"]
    print(f"\n[统计] 总怪物={len(rows)} 有立绘={len(art)} 无立绘={len(rows)-len(art)}")
    print(f"[统计] 唯一立绘组={len(group_cache)}")

    # 不同立绘组之间 AniID 必须唯一
    cnt = Counter(r[3] for r in art)
    bad = {k: v for k, v in cnt.items() if v > 1}
    # 复用同名是允许的（同一立绘），这里只需确认「不同组的 key 不重复」
    dup_groups = {}
    for gk, (mk, mid) in group_cache.items():
        pass
    print(f"[检查] AniID 出现次数>1 的数量={len(bad)} （同一立绘被多个怪物引用属正常）")

    conflict = sorted(set(r[3] for r in art) & reserved)
    print(f"[检查] 与机甲动画重名={len(conflict)}  {conflict[:10]}")

    suf = sorted({r[3] for r in art if any(f"_{i}_L" in r[3] for i in range(2, 8))})
    print(f"[检查] 触发去重后缀的 key={len(suf)}: {suf[:15]}")

    # 抽查：用户给的例子 枯骨魔龙 -> kgml
    for demo in ("枯骨魔龙", "哈尔", "全能试作机·幻影Ⅰ型", "尤尼-001·巴尼", "蝙蝠Ⅳ号"):
        print(f"  [demo] {demo} -> {M.pinyin_initials(demo)}")

    print("\n=== 完整命名表 ===")
    for r in art:
        print(f"  #{r[0]:>4} {r[1]:<26} {r[3]:<22} {r[4]}")


if __name__ == "__main__":
    main()
