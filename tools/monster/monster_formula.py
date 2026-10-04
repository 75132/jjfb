# -*- coding: utf-8 -*-
"""
怪物（Monster）独立成长公式引擎  ——  JJFB 机甲风暴复刻
==================================================================================
背景：
  从 RPGMaker 迁移过来的怪物，Level 恒为 1、战斗属性(格斗/射击/护甲/闪避/命中/致命/
  侵蚀/抗性/出手)只有百级，而机甲 L60 已达千级 —— 数值完全跟不上。

目标（用户拍板）：
  1. 以「机甲公式(level) × 怪物分级系数」为基准重建怪物属性；
  2. 每只怪物一个**独立随机公式**（系数/截距各不同），不统一；
  3. HP/MP 已固定的，先按比例降级到公式量级，再乘系数长回（允许与固定值有误差）；
  4. 机甲公式里恒为 0 的项（命中/致命/侵蚀/抗性）—— 怪物无装备 —— 单独设计非零公式；
  5. 区间随机：每只怪在其档位区间内取确定性随机系数（同一只怪每次结果一致）。

设计：
  名义等级 NominalLevel：由 category 基线 + Form 阶段加成 + 每只怪确定性抖动。
  机甲基准曲线 MechCurve(level)：
    HP   = level*253 + 300      (取自 Classes 铁臂 a: level*(506/2)+300)
    MP   = level*174 + 150      (铁臂 b)
    Melee/Shooting = level*40 + 315   (铁臂 c/d)
    Armor  = level*13 + 16      (铁臂 e)
    Evasion= level*13 + 12      (铁臂 f)
    Initiative = level*30 + 15  (铁臂 k)
    命中/致命/侵蚀/抗性：机甲为 0（装备补），怪物改独立曲线 ← 见 MONSTER_ONLY
  每只怪系数：由 (MonsterID, 属性) 做确定性随机，落在档位区间 [lo, hi]。

  确定性随机：random.Random(hash) —— 保证可复现、每只怪独立。
"""
import json
import hashlib
import random

# ---------------------------------------------------------------------------
# 机甲基准曲线（抄自 Classes.json 铁臂|初 的 a,b,c,d,e,f,k 公式）
#   返回“基准值”，再乘怪物自己的系数
# ---------------------------------------------------------------------------
def mech_curve(attr: str, level: int) -> float:
    L = level
    table = {
        "HP":         lambda l: l * 253 + 300,      # level*(506/2)+300
        "MP":         lambda l: l * 174 + 150,
        "Melee":      lambda l: l * 40 + 315,
        "Shooting":   lambda l: l * 40 + 315,
        "Armor":      lambda l: l * 13 + 16,
        "Evasion":    lambda l: l * 13 + 12,
        "Initiative": lambda l: l * 30 + 15,
    }
    fn = table.get(attr)
    return fn(L) if fn else 0.0


# 怪物专属曲线（机甲该属性=0，靠装备补；怪物无装备，必须单独给非零成长）
MONSTER_ONLY = {
    # 命中：与格斗/射击同源但更缓，保证怪能打中
    "Accuracy":    lambda l: l * 22 + 180,
    # 致命：暴击量级，缓于主属性
    "Lethality":   lambda l: l * 18 + 150,
    # 侵蚀：元素类，最缓
    "Corrosion":   lambda l: l * 9 + 80,
    # 抗性：同侵蚀
    "Resistance":  lambda l: l * 9 + 80,
}

# ---------------------------------------------------------------------------
# 输出缩放层（v3 回调）：伤害公式 = max(1, 攻击 - 防御)，攻击=Melee+Shooting。
#   v2 曾把 ATK_SCALE 提到 2.2，但配合等级匹配后怪物严重超模（一击秒杀玩家）。
#   目标：同级怪与玩家双方击杀回合都在 3~6 回合（"险胜"手感）。
#   → 攻击类回调到 0.75、防御类回调到 0.9；HP/MP 不缩放。
# ---------------------------------------------------------------------------
ATK_SCALE = 0.75  # 攻击类（近战/射击/命中/致命）
DEF_SCALE = 0.90  # 防御类（装甲/闪避/侵蚀/抗性）
ATK_ATTRS = {"Melee", "Shooting", "Accuracy", "Lethality"}
DEF_ATTRS = {"Armor", "Evasion", "Corrosion", "Resistance"}

# ---------------------------------------------------------------------------
# v4 基准校正（2026-09-28 用户口径）
#   用户纠正：正确的参照系是「满配玩家」而非「机甲 L60 裸值」。
#     满配 = 弗雷萨(双修 4882) + 昆古尼尔(攻5760) + 月光微波炮(攻5590) + 霸者之翼(1040)
#     → 普攻 Attack = 17272
#     → 群体技能满伤 ≈ 23000（×1.33）
#     → 单体技能最强 ≈ 32000（×1.85）
#     20000 血精英 → 满配普攻 1 刀 / 技能稳秒（这是设计中的正常表现，不是异常）
#
#   因此普通怪（非精英）HP 目标 = 「满配 1 刀可秒」区间，即 ≈ 1.0万 ~ 1.7万；
#   精英/Boss 保持 2 万+，值得用技能打、打多回合。
#   → 普通怪 HP_ENEMY_COEF 由 1.9 下调；精英/Boss 维持高系数。
# ---------------------------------------------------------------------------
HP_ENEMY_COEF_NORMAL = 1.35   # 普通怪 HP 目标系数（原 1.9 → 下调，对齐满配 1 刀区间）
HP_ENEMY_COEF_ELITE = 2.30    # 精英（黄金系列/顶级机甲）→ 约 2万+，技能可秒、普攻2刀
HP_ENEMY_COEF_BOSS = 3.60     # BOSS（顶级boss）→ 更高血（3.5万+），需技能+多回合

# 普通怪 HP 绝对上限（满配普攻 17272 可 1 刀秒；略留余量到 1.75 万）
NORMAL_HP_CAP = 17500
# 精英 HP 绝对上限（对齐用户口径「2万血精英」；满配需技能或 2 刀普攻）
ELITE_HP_CAP = 26000

# ---------------------------------------------------------------------------
# 档位：由 category + Form 决定 (名义等级下限, 上限)
# ---------------------------------------------------------------------------
CATEGORY_TIER = {
    "普通机甲I":   (1, 3),    # 新手区 低阶
    "普通机甲II":  (2, 4),
    "虫族":        (1, 4),    # 虫族按 Form 再拉
    "合成机甲I":   (3, 5),    # 中阶
    "黄金系列":    (4, 6),    # 精英
    "顶级机甲":    (5, 7),    # 高阶
    "顶级boss":    (6, 7),    # BOSS 最高
    "临时机甲":    (1, 2),    # 兜底用，弱
    "其他":        (2, 5),    # 杂项：范围宽
}

# 档位 -> 该档怪物的属性系数区间 (lo, hi)；每只怪在区间内确定性取值
#   v3 收窄：原 0.8~3.6（4.5 倍跨度）导致同级怪强弱悬殊 → 改为 0.85~1.6（1.9 倍），
#   强度梯度主要靠「等级」拉开，而非系数叠乘。
TIER_COEF = {
    1: (0.85, 1.00),
    2: (0.92, 1.08),
    3: (1.00, 1.18),
    4: (1.08, 1.28),
    5: (1.16, 1.38),
    6: (1.26, 1.50),
    7: (1.36, 1.60),
}

# 名义等级：档位主导，覆盖 15~60；HP 仅轻微修正。
#   杂兵 15~35、精英 30~48、BOSS 45~60，形成清晰梯度且不全部顶满。
LEVEL_SCALE = 6.0
LEVEL_JITTER = 3
FORM_BONUS = {1: 0, 2: 5, 3: 10}   # 形态越高，名义等级越高

# HP 反推等级的温和权重（仅轻微上抬，避免所有怪被拉满 60）
HP_LEVEL_WEIGHT = 0.12
# 各档位 HP 折算等级时的期望上限（用于压制 HP 反推爆表）
HP_LEVEL_CAP = {1: 25, 2: 35, 3: 42, 4: 48, 5: 52, 6: 56, 7: 60}


def _rng(key: str) -> random.Random:
    """由字符串派生确定性随机源（同一 key 每次结果一致）。"""
    h = int(hashlib.md5(key.encode("utf-8")).hexdigest()[:12], 16)
    return random.Random(h)


def nominal_level(doc: dict) -> int:
    """
    推算怪物名义等级：档位等级 × LEVEL_SCALE + Form 加成 + 每只怪确定性抖动。
    HP 只作温和上抬（×HP_LEVEL_WEIGHT，且受 HP_LEVEL_CAP 压制）。
    """
    me = doc.get("MonsterExtra", {})
    cat = me.get("category", "其他")
    form = int(doc.get("Form") or 1)
    lo, hi = CATEGORY_TIER.get(cat, (2, 5))
    base = (lo + hi) / 2.0
    jitter = _rng(f"lvj-{me.get('MonsterID')}").uniform(-0.8, 0.8)
    lv = base * LEVEL_SCALE + FORM_BONUS.get(form, 0) + jitter

    # HP 温和上抬（受档位上限压制）
    tier_now = tier_of(doc)
    old_hp = float(doc.get("MaxHP") or 0)
    if old_hp > 0:
        hp_lv = min((old_hp - 300) / 253.0 * 1.6, HP_LEVEL_CAP.get(tier_now, 40))
        lv = lv + max(0.0, hp_lv - lv) * HP_LEVEL_WEIGHT
    return int(round(max(1, min(60, lv))))


def monster_coef(monster_id: int, attr: str, tier: int) -> float:
    """每只怪每个属性的独立确定性系数（区间随机）。"""
    lo, hi = TIER_COEF.get(tier, (0.6, 1.0))
    # 属性偏置：格斗/射击是主属性略高，侵蚀/抗性略低
    bias = {
        "Melee": 1.06, "Shooting": 1.06,
        "Armor": 1.0, "Evasion": 1.0, "Initiative": 1.0,
        "Accuracy": 1.02, "Lethality": 0.98,
        "Corrosion": 0.95, "Resistance": 0.95,
    }.get(attr, 1.0)
    lo2, hi2 = lo * bias, hi * bias
    return _rng(f"{monster_id}-{attr}").uniform(lo2, hi2)


def is_elite(doc: dict) -> str:
    """
    怪物强度分档（用于 HP 目标与是否「值得打」）：
      "boss"  —— 顶级boss 分类（最高血，需技能+多回合）
      "elite" —— 黄金系列 / 顶级机甲（精英，2 万+）
      "normal"—— 其余（普通怪 / 虫族杂兵，满配 1 刀可秒）
    """
    cat = doc.get("MonsterExtra", {}).get("category", "其他")
    if cat == "顶级boss":
        return "boss"
    if cat in ("黄金系列", "顶级机甲"):
        return "elite"
    return "normal"


def tier_of(doc: dict) -> int:
    """怪物档位 1~7（取 category/Form 综合）。"""
    me = doc.get("MonsterExtra", {})
    cat = me.get("category", "其他")
    form = int(doc.get("Form") or 1)
    lo, hi = CATEGORY_TIER.get(cat, (2, 5))
    t = int(round((lo + hi) / 2.0))
    # Form 提升档位（最多 +1）
    if form >= 3 and t < 7:
        t += 1
    return max(1, min(7, t))


# ---------------------------------------------------------------------------
# 主入口：重建一只怪的全部属性
# ---------------------------------------------------------------------------
ATTRS = ["Melee", "Shooting", "Armor", "Evasion", "Accuracy",
         "Lethality", "Corrosion", "Resistance", "Initiative"]


def recompute_monster(doc: dict) -> dict:
    """
    返回新的属性字典（含 HP/MP 与 Current* 同步）。
    规则：
      - HP/MP：现有固定值先“按比例降级”到公式量级，再乘系数长回（有误差）。
      - 战斗属性：机甲曲线 × 独立系数。
      - 命中/致命/侵蚀/抗性：怪物专属曲线 × 独立系数。
    """
    me = doc.get("MonsterExtra", {})
    mid = int(me.get("MonsterID"))
    lv = nominal_level(doc)
    tier = tier_of(doc)
    out = {}

    # --- HP / MP：现有固定值先“按比例降级”到公式量级，再按公式乘系数长回 ---
    #   公式目标值 = 机甲曲线(名义等级) × 该怪独立系数
    #   最终值 = 公式目标值（保证“按公式算上去”）+ 保留原值相对强度的误差项
    #   即：新值 ≈ 目标量级，且每只怪因系数/等级不同而各异，允许与固定值有偏差。
    old_hp = float(doc.get("MaxHP") or 0)
    old_mp = float(doc.get("MaxMP") or 0)
    base_hp = mech_curve("HP", lv)
    base_mp = mech_curve("MP", lv)
    coef_hp = monster_coef(mid, "HP", tier)
    coef_mp = monster_coef(mid, "MP", tier)

    # 公式目标（怪物 HP 天然高于同级机甲；分档给系数）
    #   v4：普通怪对齐「满配 1 刀可秒」区间，精英/Boss 保持高血。
    cls = is_elite(doc)
    if cls == "boss":
        hp_coef = HP_ENEMY_COEF_BOSS
    elif cls == "elite":
        hp_coef = HP_ENEMY_COEF_ELITE
    else:
        hp_coef = HP_ENEMY_COEF_NORMAL
    target_hp = base_hp * coef_hp * hp_coef
    target_mp = base_mp * coef_mp * 1.0

    # “按比例降级”：把原值向目标量级收敛（lerp，权重 0.25 保留原值味道，误差即来源于此）
    if old_hp > 0:
        hp = target_hp * 0.75 + old_hp * 0.25
    else:
        hp = target_hp
    # v4：普通怪 HP 绝对上限，确保满配 1 刀可秒；精英/Boss 不受此限
    if cls == "normal":
        hp = min(hp, NORMAL_HP_CAP)
    elif cls == "elite":
        hp = min(hp, ELITE_HP_CAP)
    if old_mp > 0:
        mp = target_mp * 0.75 + old_mp * 0.25
    else:
        mp = target_mp

    hp = int(round(max(1, hp)))
    mp = int(round(max(0, mp)))
    out["MaxHP"] = hp
    out["CurrentHP"] = hp
    out["MaxMP"] = mp
    out["CurrentMP"] = mp
    out["HP"] = hp
    out["MP"] = mp

    # --- 战斗属性 & 怪物专属属性 ---
    for a in ATTRS:
        if a in MONSTER_ONLY:
            base = MONSTER_ONLY[a](lv)
        else:
            base = mech_curve(a, lv)
        coef = monster_coef(mid, a, tier)
        val = int(round(base * coef))
        # 输出缩放层：整体提高战斗力
        if a in ATK_ATTRS:
            val = int(round(val * ATK_SCALE))
        elif a in DEF_ATTRS:
            val = int(round(val * DEF_SCALE))
        out[a] = val
        out["Current" + a] = val

    # 其余字段（反击/格挡/护穿）保持原有量级，按系数微调
    for a, base_default in [("Counterattack", 50), ("Block", 50),
                            ("ArmorPenetration", 50)]:
        cur = doc.get(a)
        if cur is None or cur == 0:
            cur = int(round(base_default * monster_coef(mid, a, tier)))
        out[a] = cur
        out["Current" + a] = cur

    # 攻击次数 AttackCount（= 一次攻击拆成几段，默认 1；取代原 ParticleShield）
    #   怪物默认 1 段；精英/Boss 可给 2 段增强压迫感（可由数据覆盖）
    ac = doc.get("AttackCount")
    if ac is None:
        ac = 2 if cls in ("elite", "boss") else 1
    ac = max(1, int(ac or 1))
    out["AttackCount"] = ac
    out["CurrentAttackCount"] = ac

    out["_eliteClass"] = cls
    return out, lv, tier


if __name__ == "__main__":
    p = r"D:\jjfbol-cocos\jjfbol-cocos\jjfb\tools\monster\monsterbase_export.json"
    d = json.load(open(p, encoding="utf-8"))["docs"]
    for x in d[:6]:
        attrs, lv, tier = recompute_monster(x)
        me = x["MonsterExtra"]
        print(f"[{me.get('MonsterID'):>4}] {x['RobotName'][:22]:24s} lv={lv:>2} tier={tier} "
              f"HP={attrs['MaxHP']:>7} 格={attrs['Melee']:>5} 射={attrs['Shooting']:>5} "
              f"甲={attrs['Armor']:>4} 闪={attrs['Evasion']:>4} 中={attrs['Accuracy']:>4} "
              f"致={attrs['Lethality']:>4} 侵={attrs['Corrosion']:>4} 抗={attrs['Resistance']:>4} "
              f"手={attrs['Initiative']:>4}")
