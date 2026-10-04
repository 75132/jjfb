# -*- coding: utf-8 -*-
"""数值体系整体审计 —— 拉齐所有数值源，检查合理性。"""
import json, re, os, statistics

BASE = r"D:\jjfbol-cocos\jjfbol-cocos\jjfb\server\data"


def load(n):
    return json.load(open(os.path.join(BASE, n + ".json"), encoding="utf-8"))


# ---------- 1. 装备加成解析 ----------
def parse_effect(txt):
    out = {}
    if not txt:
        return out
    for part in re.split(r"[|｜]", txt):
        m = re.match(r"([\u4e00-\u9fa5A-Za-z]+)\s*([+\-])\s*(\d+)", part.strip())
        if m:
            out[m.group(1)] = out.get(m.group(1), 0) + (int(m.group(3)) * (1 if m.group(2) == "+" else -1))
    return out


print("=" * 70)
print("【1】装备体系")
print("=" * 70)
for slot in ["Weapon", "Gun", "Armor", "Dun", "Wing"]:
    data = load(slot)
    rows = []
    for it in data:
        if not isinstance(it, dict):
            continue
        eff = parse_effect(it.get("effecttext", ""))
        rows.append((it.get("id"), it.get("name"), it.get("price", 0),
                     it.get("requiredLevel", 0), eff))
    if not rows:
        continue
    prices = sorted(r[2] for r in rows)
    reqs = [r[3] for r in rows if r[3]]
    print(f"\n-- {slot} ({len(rows)} 件) 价格 {prices[0]}~{prices[-1]}  需求等级 {min(reqs) if reqs else 0}~{max(reqs) if reqs else 0}")
    # 统计各属性加成范围
    attr_range = {}
    for _, _, _, _, eff in rows:
        for k, v in eff.items():
            attr_range.setdefault(k, []).append(v)
    for k, vs in sorted(attr_range.items(), key=lambda kv: -len(kv[1])):
        vs2 = sorted(vs)
        print(f"     {k:12s} n={len(vs):>3} {vs2[0]:>6}~{vs2[-1]:>6} (中位 {vs2[len(vs2)//2]})")
    # 需求等级分布
    if reqs:
        import collections
        print("     需求等级分布:", dict(sorted(collections.Counter(reqs).items())))

# ---------- 2. 机甲属性 vs 装备加成 占比 ----------
print("\n" + "=" * 70)
print("【2】机甲底子 vs 装备加成（L60 对比）")
print("=" * 70)
cls = load("Classes")
coef = load("ClassCoefficient")


def parse_formula(note):
    out = {}
    for part in (note or "").split(","):
        m = re.match(r"\s*([a-o])\s*=\s*level\s*\*\s*(\(?[0-9./\s]+\)?)\s*\+\s*([\-0-9.]+)", part)
        if m:
            try:
                out[m.group(1)] = (eval(m.group(2), {"__builtins__": {}}, {}), float(m.group(3)))
            except Exception:
                pass
    return out


LETTER = {"HP": "a", "MP": "b", "Melee": "c", "Shooting": "d", "Armor": "e",
          "Evasion": "f", "Accuracy": "g", "Lethality": "h", "Corrosion": "i",
          "Resistance": "j", "Initiative": "k"}
# 铁臂 L60 作为样本
note = cls[1]["note"]
f = parse_formula(note)
cobj = coef[1]
print("铁臂|初 L60 底子（含系数）:")
for k, L in LETTER.items():
    if L in f:
        v = int(round((f[L][0] * 60 + f[L][1]) * cobj.get(L, 1)))
        print(f"    {k:10s} = {v}")

# 装备最大加成（各槽取最高单件）
print("\n各槽最高单件加成（需求等级最高者）:")
for slot in ["Weapon", "Gun", "Armor", "Dun", "Wing"]:
    data = [x for x in load(slot) if isinstance(x, dict)]
    data.sort(key=lambda x: (x.get("requiredLevel", 0), x.get("price", 0)))
    top = data[-1]
    eff = parse_effect(top.get("effecttext", ""))
    print(f"    {slot:8s} {top.get('name'):10s} Lv{top.get('requiredLevel',0):>2} {top.get('price')} : {eff}")

# ---------- 3. 经验曲线 ----------
print("\n" + "=" * 70)
print("【3】经验曲线（机甲 1~60 级）")
print("=" * 70)
import sys
sys.path.insert(0, r"D:\jjfbol-cocos\jjfbol-cocos\jjfb\server\handlers")
try:
    from robot_upgrade import ROBOT_LEVEL_TOTAL_EXP
    e = ROBOT_LEVEL_TOTAL_EXP
    print(f"单级经验(索引) 1~10:", e[:10])
    print(f"            50~60:", e[49:60])
    print(f"总累计 = {sum(e):,}")
    # 相邻级增长倍率检查
    print("增长倍率(后/前) 抽样:")
    for i in [0, 9, 19, 29, 39, 49, 54, 58]:
        if i + 1 < len(e):
            print(f"    L{i+1}->L{i+2}: {e[i+1]/max(1,e[i]):.2f}x  ({e[i]} -> {e[i+1]})")
except Exception as ex:
    print("ERR", ex)

# ---------- 4. 伤害平衡模型 ----------
print("\n" + "=" * 70)
print("【4】战斗平衡推演")
print("=" * 70)
mb = json.load(open(r"D:\jjfbol-cocos\jjfbol-cocos\jjfb\tools\monster\monsterbase_export.json",
                   encoding="utf-8"))["docs"]


def mech_at(lv, idx=1):
    note = cls[idx]["note"]
    f = parse_formula(note)
    c = coef[idx]
    return {
        "HP": int(round((f["a"][0] * lv + f["a"][1]) * c.get("a", 1))),
        "Atk": int(round((f["c"][0] * lv + f["c"][1]) * c.get("c", 1)) * 2),
        "Def": int(round((f["e"][0] * lv + f["e"][1]) * c.get("e", 1))),
    }


print(f"{'等级':>4} {'机甲HP':>8} {'机甲Atk':>8} {'机甲Def':>8} | {'同级怪HP':>9} {'怪Atk':>8} | {'机甲击杀回合':>10} {'怪击杀回合':>10}")
for lv in [1, 10, 20, 30, 40, 50, 60]:
    m = mech_at(lv)
    # 同级怪（_nominalLevel 最接近）
    cands = [x for x in mb if (x.get("MonsterExtra") or {}).get("_nominalLevel") == lv]
    if not cands:
        cands = sorted(mb, key=lambda x: abs((x.get("MonsterExtra") or {}).get("_nominalLevel", 0) - lv))[:5]
    mh = statistics.median([x.get("MaxHP", 0) for x in cands])
    ma = statistics.median([(x.get("Melee", 0) or 0) + (x.get("Shooting", 0) or 0) for x in cands])
    mde = statistics.median([x.get("Armor", 0) for x in cands])
    tt_kill_mon = mh / max(1, m["Atk"] - mde)      # 玩家击杀怪回合数
    tt_kill_mech = m["HP"] / max(1, ma - m["Def"])  # 怪击杀玩家回合数
    print(f"{lv:>4} {m['HP']:>8} {m['Atk']:>8} {m['Def']:>8} | {mh:>9.0f} {ma:>8.0f} | {tt_kill_mon:>10.1f} {tt_kill_mech:>10.1f}")
