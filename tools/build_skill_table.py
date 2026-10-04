# -*- coding: utf-8 -*-
"""从 RPG Maker MV 工程导出技能的战斗数据（目标范围 + 伤害公式 + 效果 + 技能等级），
合并本工程补充/悟性技能的元信息，生成 server/data/Skills.json。

数据源（只读）：
  D:/机甲风暴开发素材合集/机甲风暴2/data/Skills.json    技能定义（scope / damage.formula / effects / mpCost）
  D:/机甲风暴开发素材合集/机甲风暴2/data/Items.json      技能书 id ↔ 技能 id
  D:/机甲风暴开发素材合集/机甲风暴2/js/rpg_objects.js    伤害结算链源码
  D:/机甲风暴开发素材合集/机甲风暴2/js/plugins/Z_*.js    Z 插件（职业限制 / 技能等级 / 悟性 / 自动恢复 / 普攻覆写）

用法（安全优先：**默认只演练，不写盘**）：
  python tools/build_skill_table.py            # 打印解析结果（dry-run）
  python tools/build_skill_table.py --apply    # 真正写 server/data/Skills.json
"""
import hashlib
import io
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RPG = r"D:/机甲风暴开发素材合集/机甲风暴2"
# 权威数据（服务端读）+ 同源副本（Cocos resources.load('json/Skills') 读）—— **必须字节一致**
OUT = os.path.join(ROOT, "server", "data", "Skills.json")
OUT_CLIENT = os.path.join(ROOT, "assets", "resources", "json", "Skills.json")
COCOS_ITEMS = os.path.join(ROOT, "assets", "resources", "json", "Items.json")

# ---------------------------------------------------------------------------
# scope 语义（RPG Maker MV Game_Action / Window_BattleEnemy）
# ---------------------------------------------------------------------------
SCOPE_MAP = {
    0:  {"target": "none",   "side": "none",   "desc": "无目标"},
    1:  {"target": "single", "side": "enemy",  "desc": "单体敌人"},
    2:  {"target": "all",    "side": "enemy",  "desc": "全体敌人"},
    3:  {"target": "single", "side": "enemy",  "desc": "随机 1 名敌人"},
    4:  {"target": "multi",  "side": "enemy",  "desc": "随机 2 名敌人"},
    5:  {"target": "multi",  "side": "enemy",  "desc": "随机 3 名敌人"},
    6:  {"target": "multi",  "side": "enemy",  "desc": "随机 4 名敌人"},
    7:  {"target": "single", "side": "ally",   "desc": "单体己方（含自己）"},
    8:  {"target": "all",    "side": "ally",   "desc": "全体己方"},
    9:  {"target": "single", "side": "ally_dead", "desc": "单体己方（倒下）"},
    10: {"target": "all",    "side": "ally_dead", "desc": "全体己方（倒下）"},
    11: {"target": "single", "side": "self",   "desc": "自身"},
}

# damage.type 语义
DMG_TYPE_MAP = {
    0: "none", 1: "hp_damage", 2: "mp_damage",
    3: "hp_drain", 4: "mp_drain", 5: "hp_recover", 6: "mp_recover",
}

# effect code 语义（只列本表用到的）
EFFECT_CODE_MAP = {
    11: "hp_recover_ratio",   # value1 = 最大HP比例
    12: "mp_recover_ratio",   # value1 = 最大MP比例
    21: "add_state",
    22: "remove_state",
    31: "add_buff",           # dataId = 属性下标, value1 = 层数
    32: "remove_buff",
}

# 属性下标（System.json terms.params）
PARAM_NAMES = ["mhp", "mmp", "atk", "def", "mat", "mdf", "agi", "luk"]

# ---------------------------------------------------------------------------
# 公式缩放口径（2026-09-30 用户拍板 = **方案 A**）
# ---------------------------------------------------------------------------
# 背景：RPG 原式都是「高倍率 + 大常数」（如普攻 a.atk*3 + 1000），配的是原工程
#       HP/属性数千的量级；本工程满配攻击 = 17272（见 docs/数值体系审计报告_v4.md），
#       而现网战斗公式是 `damage = max(1, 攻击 - 装甲)`。
#
# 方案 A：`a.atk` 取值 ÷ ATK_DIVISOR(=3)，并**删除公式末尾的纯数字加项**。
#   效果：普攻 (a.atk*3 - b.def + 1000) → (a.atk/3)*3 - b.def = 攻击 - 装甲
#         —— 与现网公式**逐点等价**（满配 17272 完全对齐），零回归；
#         技能倍率则落在普攻的 0.67× ~ 2.0× 区间（肉搏/光刃 ×1.67、舍身 ×2.0、
#         群体 ×0.67~1.0），梯度自然。
#   注：`b.def`（装甲）**不缩放**，保持防御的减伤权重。
#
# 落地方式：`formula` = RPG 原式（仅溯源）；`formula_scaled` = 实际结算用式，
#           由本文件的 scale_formula() 从原式推导，两端（服务端 / 客户端）都读
#           `formula_scaled`，保证口径唯一。
# ---------------------------------------------------------------------------
SCALE = {
    "name": "A",
    "atk_divisor": 3,
    "drop_tail_constants": True,
    "desc": "a.atk ÷ 3，且删除公式末尾的纯数字加项（b.def 不缩放）",
    "effect": "普攻 (a.atk/3)*3 - b.def ≡ 攻击 - 装甲，与现网公式一致（满配 17272 对齐设计基准）",
}

# 公式末尾的纯数字加项：` + 1000` / ` + 2000` / ` + 900` …（仅末尾，不动倍率与 def 项）
_TAIL_CONST_RE = re.compile(r"\s*[+\-]\s*(\d+(?:\.\d+)?)\s*$")
_PURE_CONST_RE = re.compile(r"^(\d+(?:\.\d+)?)$")
_ATK_RE = re.compile(r"\ba\.atk\b")

# ---------------------------------------------------------------------------
# 技能图标（口径见 tools/skill_category_todo.md）
# ---------------------------------------------------------------------------
#   图标来源 = 图集 `assets/resources/SkillIcon/SkillIcon`（原名 assets/UI/Skill_icon，
#   2026-09-30 按文档「图标资源不在 resources/，需先移入」移入），帧名 `skill_1`…`skill_5`。
#   分类号 → 含义：
#     1 主动学习 · 攻击技能     2 主动学习 · 被动技能     3 主动学习 · 自动触发技能
#     4 升级概率习得 · 悟性攻击  5 升级概率习得 · 悟性被动
#   ⚠ 分类号取自 skill_category_todo.md 的**用户填表**，不要自行改动；
#     表里没列到的技能（纳米侵蚀）沿用缺省 `skill_1`。
# ---------------------------------------------------------------------------
ICON_ATLAS = "SkillIcon"
DEFAULT_ICON_CATEGORY = 1
ICON_CATEGORY_OVERRIDES = {
    "key": {
        "life_recover": 2,
        "energy_recover": 2,
        "leiting": 3,
        "ruodian": 3,
    },
}


def icon_index_for(key):
    """技能 key → 图集帧名（如 `skill_1`）。"""
    cat = ICON_CATEGORY_OVERRIDES["key"].get(key, DEFAULT_ICON_CATEGORY)
    return "skill_%d" % int(cat)


# ---------------------------------------------------------------------------
# 出招方式 / 距离口径（口径来源：`tools/skill_range_todo.md` 用户填表，2026-10-01 定稿）
#   melee   近身 —— 必须先位移贴到目标才能打
#   ranged  远程 —— 站在原地即可出招
#   dynamic 按条件判定（见 range_rule；当前只有 jisu：持枪 → 远程，否则近身）
#   none    不主动施放（自动触发被动），不涉及距离
#   ⚠ 以下三处取值**全部照用户填表**，不要自行「按职业线推断」：
#     ① 火焰风暴（格斗·全体）标 ranged；② 通用线 shengmingshequ / zhaqu / xiuli 标 ranged；
#     ③ jisu 为唯一 dynamic（持枪判定，gun_weapon_ids 同普攻）。
# ---------------------------------------------------------------------------
RANGE_MELEE = "melee"
RANGE_RANGED = "ranged"
RANGE_DYNAMIC = "dynamic"
RANGE_NONE = "none"

RANGE_BY_KEY = {
    # ---- 近身 7 条：格斗单体 + 通用线以外全部格斗单体技 ----
    "roubo": RANGE_MELEE,
    "guangrenzhan": RANGE_MELEE,
    "chaonengquan": RANGE_MELEE,
    "leitingzhenshe": RANGE_MELEE,
    "chongfeng": RANGE_MELEE,
    "kuangnuji": RANGE_MELEE,
    "lianxu": RANGE_MELEE,
    # ---- 远程 24 条：射击 / 全能全部 + 格斗全体 + 通用线 3 条 + 纳米侵蚀（原参考项）----
    "kuangnu": RANGE_RANGED,          # 格斗但为全体技 → 用户标远程
    "leitingchongji": RANGE_RANGED,
    "lizijiguang": RANGE_RANGED,
    "denglizidanmu": RANGE_RANGED,
    "xukongdaodan": RANGE_RANGED,
    "nengliangbaopo": RANGE_RANGED,
    "diancifengbao": RANGE_RANGED,
    "shikongniuqu": RANGE_RANGED,
    "yinliyazhi": RANGE_RANGED,
    "denglizipingzhang": RANGE_RANGED,
    "xukongchongji": RANGE_RANGED,
    "jingsheng": RANGE_RANGED,
    "jingu": RANGE_RANGED,
    "sheshen": RANGE_RANGED,
    "ganrao": RANGE_RANGED,
    "huiluganrao": RANGE_RANGED,
    "shengmingshequ": RANGE_RANGED,
    "zhaqu": RANGE_RANGED,
    "leiting": RANGE_RANGED,
    "ruodian": RANGE_RANGED,
    "nenglianghudun": RANGE_RANGED,
    "xinniandun": RANGE_RANGED,
    "xiuli": RANGE_RANGED,
    "nami_qinshi": RANGE_RANGED,
    # ---- 条件判定 1 条 ----
    "jisu": RANGE_DYNAMIC,
    # ---- 不主动施放 2 条 ----
    "life_recover": RANGE_NONE,
    "energy_recover": RANGE_NONE,
}

# dynamic 的判定规则名（供两端实现同一函数；gun = 与普攻同一份持枪 id 表）
RANGE_RULE_NAMES = {
    "gun": "按「是否持枪」判定：装备武器 id 28–51 → ranged；否则 melee",
}

# 每个技能附带的 range_rule 描述（写入 Skills.json，两端读同一份）
RANGE_RULE_BY_KEY = {
    "jisu": {
        "rule": "gun",
        "when_ranged": "持枪（武器 id 28–51）→ ranged",
        "when_melee": "未持枪 → melee",
        "desc": "用户口径：急速攻击「远程 or 近身，根据武器是不是枪械；没装备枪械就都是近身」",
    },
}


def range_for(key):
    """技能 key → (range, range_rule|None)。range 缺失时按 ranged 兜底并报警。"""
    rng = RANGE_BY_KEY.get(key)
    if rng is None:
        print("⚠ [range] 技能 %s 未登记出招方式，按 ranged 兜底（请补 tools/skill_range_todo.md）" % key)
        rng = RANGE_RANGED
    return rng, RANGE_RULE_BY_KEY.get(key)


def _num(v):
    """把数字格式化成公式里好看的字符串（整数不显示小数点）。"""
    f = float(v)
    return str(int(f)) if f.is_integer() else ("%.4f" % f).rstrip("0").rstrip(".")


def scale_formula(formula):
    """按 SCALE 口径把 RPG 原式转成实际结算用的缩放式；无公式返回 None。"""
    if formula is None:
        return None
    text = str(formula).strip()
    if not text:
        return None

    # 1) 纯常数式（固定值伤害，如 等离子屏障 2500 / 虚空冲击 2000）→ 整体 ÷ 除数（取整）
    m = _PURE_CONST_RE.match(text)
    if m:
        return str(int(round(float(m.group(1)) / float(SCALE["atk_divisor"]))))

    # 2) 删除末尾纯数字加项（+1000 / +2000 …）
    if SCALE["drop_tail_constants"]:
        text = _TAIL_CONST_RE.sub("", text).strip()

    # 3) a.atk → (a.atk / K)
    text = _ATK_RE.sub("(a.atk / %s)" % _num(SCALE["atk_divisor"]), text)

    # 4) 归一空白（原工程 12 号公式里有双空格）
    return re.sub(r"\s+", " ", text).strip()

# ---------------------------------------------------------------------------
# 能量消耗口径（用户定稿：**按最大 MP 百分比消耗**）
#   最强技能 4 次 → 25%；逐级往下 5 次 20% / 6 次 16% / 7 次 14%
# ---------------------------------------------------------------------------
MP_PCT_TEXT = {
    25: "25%（最多 4 次）",
    20: "20%（最多 5 次）",
    16: "16%（最多 6 次）",
    14: "14%（最多 7 次）",
    0:  "0%（被动不耗能）",
}

# 可学职业线（来源 Z_skill.js）
CLASSES_TEXT = {
    "fighter": "格斗",
    "shooter": "射击",
    "universal": "全能",
    "all": "通用（三职业线均可学）",
}

# ---------------------------------------------------------------------------
# 技能等级（来源 Z_SkillLevel.js，原样搬）
# ---------------------------------------------------------------------------
SKILL_LEVEL = {
    "max_level": 4,
    "multipliers": [1.0, 1.2, 1.3, 1.5],
    "multiplier_desc": "Lv1 ×1.0 / Lv2 ×1.2 / Lv3 ×1.3 / Lv4 ×1.5",
    "rounding": "floor",
    "scope_note": "原工程倍率在 makeDamageValue 里乘算 —— 只作用于**伤害结果**；"
                  "治疗 / 护盾等非伤害效果是否随等级提升，原插件未定义（本工程可后续开启）",
    "per": "每个机甲（角色）对每个技能独立记录等级",
    "auto_upgrade": {
        "trigger": "mech_level_up",
        "chance_formula": "comprehension / 100 * 0.1",
        "chance_desc": "机甲升级时逐个已学技能判定，概率 = 悟性 / 100 × 0.1；悟性 40~100 → 4%~10%",
        "cap": "低于 max_level 才判定",
    },
    "manual_upgrade": [
        {"to_level": 2, "books": 1, "mech_level": 25},
        {"to_level": 3, "books": 2, "mech_level": 40},
        {"to_level": 4, "books": 3, "mech_level": 50},
    ],
    "manual_upgrade_desc": "花技能书 + 达到机甲等级，Lv4 封顶；无对应技能书的技能不可手动升",
}

# ---------------------------------------------------------------------------
# 普通攻击：三职业线三公式（来源 Z_GamePlay.js attackSkillId 覆写）
#   装备枪械类武器（id 28-51）时，射击线 / 全能线改用自己的普攻技能；
#   格斗线始终用默认普攻。
# ---------------------------------------------------------------------------
GUN_WEAPON_IDS = list(range(28, 52))
NORMAL_ATTACK = {
    "desc": "普通攻击按「职业线 + 是否装备枪械」走不同公式（来源 Z_GamePlay.js 覆写 attackSkillId）",
    "class_field": "角色数据里的 Class 字段：1 格斗 / 2 射击 / 3 全能",
    "gun_weapon_ids": GUN_WEAPON_IDS,
    "gun_weapon_desc": "装备列表里含 id 28–51 的枪械类武器即视为「持枪」",
    # ⚠ 接入开关：默认关闭，避免数值量级不匹配直接接管战斗伤害
    "enabled": True,
    "enabled_note": (
        "已开启（2026-09-30 用户拍板口径 A）。公式按 SCALE 口径缩放后接管战斗：a.atk 先 ÷3 并去掉末尾常数。"
        "格斗线缩放后 = (a.atk/3)*3 - b.def ≡ 攻击 - 装甲，与缩放前的现网公式 atk-def 完全一致（零回归）；"
        "射击线 a.atk×2.5/3 - b.def ≈ 攻击×0.833 - 装甲；全能线 a.atk×3.5/3 - b.def ≈ 攻击×1.167 - 装甲。"
        "射击 / 全能线需持枪（武器 id 28–51）才生效，否则回落到格斗线。"
    ),
    "variance": 20,
    "critical": True,
    "by_class": [
        {"classes": "fighter", "name": "格斗·普通攻击", "rpg_skill_id": 1,
         "requires_gun": False, "formula": "a.atk * 3 - b.def * 1 + 1000",
         "formula_scaled": scale_formula("a.atk * 3 - b.def * 1 + 1000"),
         "note": "默认普攻，不持枪也是它"},
        {"classes": "shooter", "name": "射击·普通攻击", "rpg_skill_id": 11,
         "requires_gun": True, "formula": "a.atk * 2.5 - b.def * 1 + 1000",
         "formula_scaled": scale_formula("a.atk * 2.5 - b.def * 1 + 1000"),
         "note": "持枪时覆盖默认普攻"},
        {"classes": "universal", "name": "全能·普通攻击", "rpg_skill_id": 12,
         "requires_gun": True, "formula": "a.atk * 3.5 - b.def * 1 + 1200",
         "formula_scaled": scale_formula("a.atk * 3.5 - b.def * 1 + 1200"),
         "note": "持枪时覆盖默认普攻"},
    ],
}

# ---------------------------------------------------------------------------
# 本工程技能元信息
#   book         : 技能书 item id（None = 无书，悟性技）
#   key / anim   : 稳定英文短名 / 特效 AnimationClip 名
#   category     : skill_1..skill_5（分类图标）
#   rpg_skill_id : RPG Skills.json 里的 id，None = 本工程新增
#   mp_pct       : 能量消耗（占最大 MP 百分比）
#   lv_auto/lv_manual : 技能等级是否可自动 / 手动提升
#
# ⚠ 技能书号：原定 0057–0070，但 assets/resources/json/Items.json 里
#   id 57–75 已被「还原晶体 / 各机甲核心」占用 → 新增技能书改排 **0076–0089**。
# ---------------------------------------------------------------------------
META = [
    # ---- 16 本技能书（有 RPG 原公式）----
    dict(book=36, name="肉搏攻击",   key="roubo",            anim="quan01",            type="格斗", category="skill_1", rpg_skill_id=3,  mp_pct=25, classes="fighter"),
    dict(book=37, name="光刃斩",     key="guangrenzhan",     anim="guangrenzhan",      type="格斗", category="skill_1", rpg_skill_id=14, mp_pct=20, classes="fighter"),
    dict(book=38, name="超能拳",     key="chaonengquan",     anim="chaonengquan",      type="格斗", category="skill_1", rpg_skill_id=15, mp_pct=16, classes="fighter"),
    dict(book=39, name="雷霆震慑",   key="leitingzhenshe",   anim="leitingzhenshe",    type="格斗", category="skill_1", rpg_skill_id=16, mp_pct=20, classes="fighter"),
    dict(book=40, name="火焰风暴",   key="kuangnu",          anim="kuangnu",           type="格斗", category="skill_1", rpg_skill_id=17, mp_pct=20, classes="fighter"),
    dict(book=41, name="雷霆冲击",   key="leitingchongji",   anim="leitingchongji",    type="射击", category="skill_1", rpg_skill_id=18, mp_pct=16, classes="shooter"),
    dict(book=42, name="离子激光",   key="lizijiguang",      anim="lizijiguang",       type="射击", category="skill_1", rpg_skill_id=19, mp_pct=16, classes="shooter"),
    dict(book=43, name="等离子弹幕", key="denglizidanmu",    anim="denglizidanmu",     type="射击", category="skill_1", rpg_skill_id=20, mp_pct=20, classes="shooter"),
    dict(book=44, name="虚空导弹",   key="xukongdaodan",     anim="xukongdaodan",      type="射击", category="skill_1", rpg_skill_id=21, mp_pct=16, classes="shooter"),
    dict(book=45, name="能量爆破",   key="nengliangbaopo",   anim="nengliangbaopo",    type="射击", category="skill_1", rpg_skill_id=22, mp_pct=20, classes="shooter"),
    dict(book=46, name="电磁风暴",   key="diancifengbao",    anim="diancifengbao",     type="射击", category="skill_1", rpg_skill_id=23, mp_pct=16, classes="universal"),
    dict(book=47, name="时空扭曲",   key="shikongniuqu",     anim="shikongniuqu",      type="全能", category="skill_1", rpg_skill_id=24, mp_pct=20, classes="universal"),
    dict(book=48, name="能量护盾",   key="nenglianghudun",   anim="xinniandun",        type="全能", category="skill_1", rpg_skill_id=25, mp_pct=16, classes="universal"),
    dict(book=49, name="引力压制",   key="yinliyazhi",       anim="yinliyazhi",        type="全能", category="skill_1", rpg_skill_id=26, mp_pct=16, classes="universal"),
    dict(book=50, name="等离子屏障", key="denglizipingzhang", anim="denglizipingzhang", type="全能", category="skill_1", rpg_skill_id=27, mp_pct=25, classes="universal",
         note="⚠ 固定值伤害 2500（与 a.atk 无关）→ 口径 A 下按同比例 ÷3 = 833，待用户确认是否改为按攻击倍率计算"),
    dict(book=51, name="虚空冲击",   key="xukongchongji",    anim="xukongchongji",     type="全能", category="skill_1", rpg_skill_id=28, mp_pct=25, classes="universal",
         note="⚠ 固定值伤害 2000（与 a.atk 无关）→ 口径 A 下按同比例 ÷3 = 667，待用户确认是否改为按攻击倍率计算"),

    # ---- 补充技能（本工程新增；公式 = 按同类型档位推荐，用户已确认）----
    dict(book=76, name="冲锋",     key="chongfeng",     anim="chongfeng",     type="格斗", category="skill_1", rpg_skill_id=None, scope=1, mp_pct=14, classes="fighter",
         formula="a.atk * 4 - b.def * 1 + 1000",   note="格斗-中档，与雷霆冲击同倍率"),
    dict(book=77, name="狂怒一击", key="kuangnuji",     anim="kuangnu",       type="格斗", category="skill_1", rpg_skill_id=None, scope=1, mp_pct=20, classes="fighter",
         formula="a.atk * 5 - b.def * 0.8 + 1500", note="格斗-高档 + 小穿防"),
    dict(book=78, name="连续攻击", key="lianxu",        anim="lianxu",        type="格斗", category="skill_1", rpg_skill_id=None, scope=1, mp_pct=14, classes="fighter",
         repeats=3, formula="a.atk * 2 - b.def * 1 + 400", note="多段，单段低倍率 ×3"),
    dict(book=79, name="精神攻击", key="jingsheng",     anim="jingsheng",     type="射击", category="skill_1", rpg_skill_id=None, scope=1, mp_pct=14, classes="shooter",
         formula="a.atk * 3 - b.def * 0.5 + 1000", note="射击-中档 + 穿防"),
    dict(book=80, name="禁锢",     key="jingu",         anim="jingu",         type="射击", category="skill_1", rpg_skill_id=None, scope=1, mp_pct=14, classes="shooter",
         formula="a.atk * 2 - b.def * 1 + 500",    note="低伤 + 附加状态「禁锢」（对照 RPG 引力压制）"),
    dict(book=81, name="舍身一击", key="sheshen",       anim="sheshen",       type="射击", category="skill_1", rpg_skill_id=None, scope=1, mp_pct=25, classes="shooter",
         formula="a.atk * 6 - b.def * 0.7 + 1500", note="全表最高倍率，代价为自伤"),
    dict(book=82, name="干扰攻击", key="ganrao",        anim="ganrao",        type="全能", category="skill_1", rpg_skill_id=None, scope=1, mp_pct=14, classes="universal",
         formula="a.atk * 2 - b.def * 1 + 500",    note="低伤 + 降敌攻击 buff"),
    dict(book=83, name="回路干扰", key="huiluganrao",   anim="huiluganrao",   type="全能", category="skill_1", rpg_skill_id=None, scope=1, mp_pct=14, classes="universal",
         formula="a.atk * 2 - b.def * 1 + 500",    note="低伤 + 驱散敌方 buff"),
    dict(book=84, name="信念盾",   key="xinniandun",    anim="xinniandun",    type="全能", category="skill_1", rpg_skill_id=None, scope=7, mp_pct=16, classes="universal",
         damage_type="none", formula="0",          note="纯护盾，同能量护盾模板",
         effects=[
             {"code": 31, "kind": "add_buff", "param": "def", "value1": 2, "value2": 0},
             {"code": 11, "kind": "hp_recover_ratio", "param": 0, "value1": 0.1, "value2": 0},
         ]),
    dict(book=85, name="紧急修理", key="xiuli",         anim="xiuli",         type="通用", category="skill_1", rpg_skill_id=None, scope=7, mp_pct=14, classes="all",
         damage_type="none", formula="0",          note="纯治疗 HP（比例 30%，暂定值待用户确认）",
         effects=[
             {"code": 11, "kind": "hp_recover_ratio", "param": 0, "value1": 0.30, "value2": 0},
         ]),
    dict(book=86, name="急速攻击", key="jisu",          anim="jisu",          type="通用", category="skill_1", rpg_skill_id=None, scope=1, mp_pct=14, classes="all",
         formula="a.atk * 2 - b.def * 1 + 500",    note="低伤 + 高先制"),
    dict(book=87, name="生命摄取", key="shengmingshequ", anim="shengmingshequ", type="通用", category="skill_1", rpg_skill_id=None, scope=1, mp_pct=14, classes="all",
         damage_type="hp_drain", formula="a.atk * 2 - b.def * 1 + 500", drain_ratio=0.5,
         note="吸血：伤害的 50% 回自身 HP（drain_ratio 可调，1.0 = RPG 原义全吸）"),
    dict(book=88, name="能量榨取", key="zhaqu",         anim="zhaqu",         type="通用", category="skill_1", rpg_skill_id=None, scope=1, mp_pct=14, classes="all",
         damage_type="mp_drain", formula="a.atk * 2 - b.def * 1 + 500", drain_ratio=0.5,
         note="吸蓝：伤害的 50% 回自身 MP（drain_ratio 可调，1.0 = RPG 原义全吸）"),

    # ---- 自动触发（每回合结束结算；恢复量定稿 15% 最大属性）----
    # 原工程技能 29「自动恢复」不在 SKILL_BOOK_MAP 内 → 不可手动升级，这里照搬（★=用户指定 15%）
    dict(book=55, name="生命恢复", key="life_recover",   anim="shengminghuifu", type="通用", category="skill_3", rpg_skill_id=29, mp_pct=0, classes="all",
         trigger="end_of_round", restore_ratio=0.15, lv_auto=False, lv_manual=False),
    dict(book=89, name="能量恢复", key="energy_recover", anim="nenglianghuifu", type="通用", category="skill_3", rpg_skill_id=None, scope=7, mp_pct=0, classes="all",
         trigger="end_of_round", damage_type="none", formula="0", restore_ratio=0.15, lv_auto=False, lv_manual=False),

    # ---- 悟性（升级概率习得；★2026-09-30 补技能书 0090/0091 → 可用书「学会」，
    #        但仍 lv_manual=False（悟性技不开放用书升级）----
    dict(book=90, name="纳米攻击", key="leiting", anim="leiting", type="全能", category="skill_4", rpg_skill_id=None, scope=2, mp_pct=25, classes="universal", innate=True,
         formula="a.atk * 4 - b.def * 1 + 1200", note="悟性技，**群体**；技能书 0090 仅用于「学会」，不开放用书升级", lv_auto=True, lv_manual=False),
    dict(book=91, name="弱点攻击", key="ruodian", anim="ruodian", type="射击", category="skill_4", rpg_skill_id=None, scope=1, mp_pct=20, classes="shooter", innate=True,
         formula="a.atk * 4 - b.def * 0.5 + 1000", note="悟性技，高穿防；技能书 0091 仅用于「学会」，不开放用书升级", lv_auto=True, lv_manual=False),

    # ---- RPG 原技能（★2026-10-01 用户拍板：「纳米侵蚀开放所有（职业）可学习」）----
    #  原状态：`category="ref"` + `reference_only=True` + `classes="shooter"` → **任何职业都不可学不可施放**。
    #  现状态：普通主动攻击技能 —— `classes="all"`（三线通用）+ 去掉 `reference_only`
    #          + `category="skill_1"`（主动学习·攻击技能）+ `mp_pct=20`（与其它「群体敌人」技能同档；
    #          原 `None` 会让 mp_cost 算成 **0 消耗**）。
    #  公式 / scope 沿用 RPG 原值，供溯源对照；anim 按用户 2026-10-01 口径改为 `leiting`
    #  （与「纳米攻击」同动画；原 `jiguang01` 是 RPG 原值但表现不对）。
    dict(book=56, name="纳米侵蚀", key="nami_qinshi", anim="leiting", type="通用", category="skill_1", rpg_skill_id=10, mp_pct=20, classes="all",
         note="★2026-10-01 起开放所有职业可学（原为射击专属参考项）；RPG 原技能 10，群体敌人；特效动画 leiting（用户指定）"),
]

# category → (lv_auto, lv_manual) 默认值
CATEGORY_LV_DEFAULT = {
    "skill_1": (True, True),
    "skill_2": (True, True),
    "skill_3": (False, False),
    "skill_4": (True, False),
    "skill_5": (True, False),
    "ref": (False, False),
}


def load(name):
    with io.open(os.path.join(RPG, "data", name), encoding="utf-8") as f:
        return json.load(f)


def build_rows():
    rpg_skills = {s["id"]: s for s in load("Skills.json") if s}
    rows = []

    for m in META:
        sid = m.get("rpg_skill_id")
        src = rpg_skills.get(sid) if sid else None
        cat = m["category"]
        lv_default = CATEGORY_LV_DEFAULT.get(cat, (False, False))
        entry = {
            "key": m["key"],
            "name": m["name"],
            "book_id": m.get("book"),
            "rpg_skill_id": sid,
            "type": m["type"],
            "category": cat,
            "anim": m["anim"],
            "classes": m.get("classes"),
            "classes_desc": CLASSES_TEXT.get(m.get("classes"), ""),
            "mp_cost_percent": m.get("mp_pct", 0),
            "mp_cost_percent_desc": MP_PCT_TEXT.get(m.get("mp_pct", 0), ""),
            "lv_auto": m.get("lv_auto", lv_default[0]),
            "lv_manual": m.get("lv_manual", lv_default[1]),
            # 预留：后续追加的额外效果（灼烧 / 眩晕 / 护盾值 …）
            "extra_effects": [],
        }

        if src:
            dmg = src.get("damage") or {}
            scope = src.get("scope", 0)
            sc = SCOPE_MAP.get(scope, {"target": "unknown", "side": "unknown", "desc": "?"})
            entry.update({
                "scope": scope,
                "target": sc["target"],
                "side": sc["side"],
                "scope_desc": sc["desc"],
                "damage_type": DMG_TYPE_MAP.get(dmg.get("type", 0), "unknown"),
                "formula": dmg.get("formula"),
                "variance": dmg.get("variance", 20),
                "critical": bool(dmg.get("critical")),
                # 原工程 mpCost（多数为废弃的 2000，仅作溯源保留）
                "mp_cost_rpg": src.get("mpCost", 0),
                "repeats": src.get("repeats", 1),
                "success_rate": src.get("successRate", 100),
                "hit_type": src.get("hitType", 0),
                "effects": [
                    {
                        "code": e.get("code"),
                        "kind": EFFECT_CODE_MAP.get(e.get("code"), "code_%s" % e.get("code")),
                        "param": PARAM_NAMES[e["dataId"]] if e.get("code") in (31, 32) and e.get("dataId", 0) < len(PARAM_NAMES) else e.get("dataId"),
                        "value1": e.get("value1"),
                        "value2": e.get("value2"),
                    }
                    for e in (src.get("effects") or [])
                ],
                "data_source": "rpg",
                "formula_source": "rpg",
            })
            if m.get("restore_ratio") is not None:
                entry["restore_ratio"] = m["restore_ratio"]
        else:
            scope = m.get("scope", 1)
            sc = SCOPE_MAP.get(scope, {"target": "unknown", "side": "unknown", "desc": "?"})
            entry.update({
                "scope": scope,
                "target": sc["target"],
                "side": sc["side"],
                "scope_desc": sc["desc"],
                "damage_type": m.get("damage_type", "none" if scope in (7, 8, 11) else "hp_damage"),
                "formula": m.get("formula"),
                "variance": 20,
                "critical": False,
                "mp_cost_rpg": 0,
                "repeats": m.get("repeats", 1),
                "success_rate": 100,
                "hit_type": 0,
                "effects": m.get("effects", []),
                "data_source": "new",
                "scope_source": "proposed",
                "formula_source": "recommended" if m.get("formula") is not None else "todo",
            })
            if m.get("restore_ratio") is not None:
                entry["restore_ratio"] = m["restore_ratio"]
                if m["key"] == "energy_recover":
                    entry["effects"] = [{
                        "code": 12, "kind": "mp_recover_ratio", "param": 0,
                        "value1": m["restore_ratio"], "value2": 0,
                    }]
                elif m["key"] == "life_recover":
                    entry["effects"] = [{
                        "code": 11, "kind": "hp_recover_ratio", "param": 0,
                        "value1": m["restore_ratio"], "value2": 0,
                    }]

        # 实际结算用式（口径 A：a.atk ÷ K + 去掉末尾常数）；原式保留在 `formula` 供溯源
        if entry.get("formula") is not None:
            entry["formula_scaled"] = scale_formula(entry["formula"])
            if entry["formula_scaled"] != entry["formula"]:
                entry["formula_scale_note"] = (
                    "口径 A：a.atk ÷ %s 且去掉末尾常数（原式见 formula）" % _num(SCALE["atk_divisor"])
                )

        for k in ("trigger", "note", "reference_only", "innate", "drain_ratio"):
            if k in m:
                entry[k] = m[k]

        # 技能图标：图集帧名（`skill_1`…`skill_5`，口径见 tools/skill_category_todo.md）
        entry["iconIndex"] = icon_index_for(entry["key"])

        # 出招方式：近身 / 远程 / 条件判定 / 不主动施放（口径见 tools/skill_range_todo.md）
        rng, rng_rule = range_for(entry["key"])
        entry["range"] = rng
        if rng_rule:
            entry["range_rule"] = rng_rule

        rows.append(entry)

    return rows


def build_payload(rows):
    return {
        "version": 6,
        "source": "RPG Maker MV 机甲风暴2/data/Skills.json + js/rpg_objects.js + js/plugins/Z_*.js",
        "notes": [
            "formula 为 RPG Maker MV 原生表达式，变量 a=攻击方, b=被击方（a.atk / b.def 等）",
            "**formula_scaled 才是实际结算用式**（口径 A：a.atk ÷ 3 且去掉末尾纯数字加项，见 formula_scale 块）；formula 仅作溯源",
            "结算链见 server/services/skill_formula.py（复刻 rpg_objects.js makeDamageValue）",
            "target: single=单体 / all=群体 / multi=随机多名 / none=无目标",
            "data_source: rpg=原工程有公式 / new=本工程新增",
            "能量消耗按最大 MP 百分比：mp_cost_percent（25%=最多4次 / 20%=5次 / 16%=6次 / 14%=7次 / 0=被动）",
            "可学职业线 classes：fighter 格斗 / shooter 射击 / universal 全能 / all 三线通用（来源 Z_skill.js）",
            "自动触发技能（生命恢复 / 能量恢复）恢复量 restore_ratio = 0.15（15% 最大属性）",
            "技能等级 lv_auto / lv_manual：是否可自动升级 / 可花技能书手动升级；倍率见 skill_level.multipliers",
            "extra_effects 为预留数组，供后续追加额外效果（灼烧 / 眩晕 / 护盾值等），当前一律为空",
            "⚠ 技能书号：0036-0055 沿用原工程，新增技能书为 0076-0089（0057-0075 已被 Items.json 的还原晶体 / 机甲核心占用）",
            "iconIndex 为**技能图标图集帧名**（见 icon_atlas 块）：图集 assets/resources/SkillIcon/SkillIcon，帧 skill_1…skill_5；分类口径见 tools/skill_category_todo.md",
            "range 为**出招方式 / 距离口径**（见 range 块，2026-10-01 用户填表定稿）：melee 近身 / ranged 远程 / dynamic 条件判定 / none 不主动施放",
            "技能书使用口径见 book_use 块（职业限制来自 Z_skill.js，升级规则来自 Z_SkillLevel.onSkillUpgrade）",
        ],
        "range": {
            "source": "tools/skill_range_todo.md（用户填表，2026-10-01 定稿）",
            "desc": "每条技能的 `range` 字段 = 出招方式；决定「原地放」还是「必须先位移贴近目标」",
            "values": {
                RANGE_MELEE: "近身 —— 必须位移贴到目标身上才能打",
                RANGE_RANGED: "远程 —— 站在原地即可出招",
                RANGE_DYNAMIC: "按条件判定，规则见该技能的 range_rule（两端须用同一判定函数）",
                RANGE_NONE: "不主动施放（自动触发被动），不涉及距离",
            },
            "rule_names": dict(RANGE_RULE_NAMES),
            "gun_weapon_ids": GUN_WEAPON_IDS,
            "counts": {
                RANGE_MELEE: sum(1 for r in rows if r.get("range") == RANGE_MELEE),
                RANGE_RANGED: sum(1 for r in rows if r.get("range") == RANGE_RANGED),
                RANGE_DYNAMIC: sum(1 for r in rows if r.get("range") == RANGE_DYNAMIC),
                RANGE_NONE: sum(1 for r in rows if r.get("range") == RANGE_NONE),
            },
            "target_note": "己方 / 自身目标技能（护盾 / 治疗）不涉及「贴近敌人」，用户仍标了 ranged，"
                           "两端按 ranged 处理即可（无需位移）",
            "status_note": "出招方式的权威口径。战斗仍为 1v1、**伤害与距离无关**（不需要为靠近消耗回合并命中判定）；"
                           "客户端已按此口径实现「近身技位移贴近目标后再出招，打完归位」的**表现**"
                           "（BattleScene.moveInForMeleeSkill，2026-10-01），服务端未接入距离规则",
        },
        "icon_atlas": {
            "path": "SkillIcon/SkillIcon",
            "frames": ["skill_%d" % i for i in range(1, 6)],
            "categories": {
                1: "主动学习 · 攻击技能",
                2: "主动学习 · 被动技能",
                3: "主动学习 · 自动触发技能",
                4: "升级概率习得 · 悟性攻击技能",
                5: "升级概率习得 · 悟性被动技能",
            },
            "source": "tools/skill_category_todo.md（用户填表）",
        },
        "book_use": {
            "source": "js/plugins/Z_skill.js（职业限制）+ js/plugins/Z_SkillLevel.js Scene_Skill.onSkillUpgrade（升级）",
            "logic": "server/services/skill_book_service.py（判定）+ handlers/skill_handler.apply_skill_book（唯一落库入口）",
            "entry": "背包「使用技能书」**只能用来学会**；技能面板「升级技能」按钮走 skill_level_up（仅升级已学技能，GUI 用户后续做）",
            "learn_when_unlearned": True,
            "learn_when_unlearned_note": "未学该技能时用书学会（Lv1，消耗 1 本）—— 补全 Z_skill.js 里只弹提示、没写 learnSkill 的伪实现；skill_book_service.LEARN_WHEN_UNLEARNED=False 可关闭",
            "already_learned_note": "**已学该技能 → 直接拒绝「已经学会，不能再学习了」**（2026-09-30 用户拍板）；与原工程 Z_SkillLevel 的「已学→花书升级」不同，升级改由技能面板 UI 承担，免得同一本书被两种语义抢用",
            "upgrade_books": {"2": 1, "3": 2, "4": 3},
            "upgrade_mech_level": {"2": 25, "3": 40, "4": 50},
            "class_gate": {
                "fighter": [36, 37, 38, 39, 40],
                "shooter": [41, 42, 43, 44, 45],
                "universal": [46, 47, 48, 49, 50, 51],
                "all": [55],
            },
            "deny_note": "职业不匹配 / 未实装(reference_only，2026-10-01 起已无此类技能) / **已学** / 书不足 → 一律否决且**不扣书**",
            "order_note": "落库顺序 = **先写 `Skills`+`SkillLevels`** 再扣书；扣书失败则回滚（原本没有 `Skills` 字段时 `$unset` 删掉本次新建的字段）",
            "learned_field_note": "「已学技能」存机甲文档 `Skills`（key 数组）。机甲**初始 / 获得时为空甚至没有该字段**，只有用书学会才写入；`$set` 会自动创建 → 兼容旧玩家数据",
        },
        "formula_scale": dict(SCALE),
        "skill_level": SKILL_LEVEL,
        "normal_attack": NORMAL_ATTACK,
        "skills": rows,
    }


def main():
    rows = build_rows()
    payload = build_payload(rows)

    if "--apply" not in sys.argv:
        for r in rows:
            print("%-8s %-6s %-6s scope=%-2s %-9s mp=%-22s lv=%s/%s range=%-7s %s"
                  % (r["name"], r["category"], r.get("classes") or "-",
                     r.get("scope"), r.get("damage_type"),
                     r.get("mp_cost_percent_desc"),
                     "A" if r["lv_auto"] else "-",
                     "M" if r["lv_manual"] else "-",
                     r.get("range"),
                     r.get("formula")))
        print("共 %d 条（dry-run，未写盘；加 --apply 才写入 %s）" % (len(rows), OUT))
        return

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    # ⚠ 两份必须**字节一致**（md5 同）：统一 LF 换行写，别依赖平台默认（Windows 会写 CRLF 导致两份不同源）
    for path in (OUT, OUT_CLIENT):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with io.open(path, "w", encoding="utf-8", newline="\n") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print("已写出 %s" % path)
    print("共 %d 条，version %s；两份 md5 = %s" % (
        len(rows), payload["version"], hashlib.md5(
            io.open(OUT, "rb").read()).hexdigest()))


if __name__ == "__main__":
    main()
