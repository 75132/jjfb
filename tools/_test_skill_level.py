# -*- coding: utf-8 -*-
"""技能等级服务自测（存储结构 / 自动升级 / 手动升级）。

覆盖：
  1. 自动升级概率（悟性 / 100 × 0.1）
  2. 等级表归一化（夹取 / 认不出保留 / 名称与技能书 id 归一）
  3. 等级读写（缺省 Lv1 / 三字段兼容）
  4. 手动升级条件（书数 + 等级 + lv_manual + 封顶）
  5. 自动升级判定（确定性 rng / lv_auto 门控 / 跨多级 / 封顶 / 无已学字段）
  6. 与战斗链路对齐（skill_level_of / apply_skill_level 真的吃到等级）

用法：python tools/_test_skill_level.py
"""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "server"))

from services import skill_service as ss          # noqa: E402
from services import skill_level_service as sl    # noqa: E402

_fail = []
_ok = 0


def check(label, cond, extra=""):
    global _ok
    if cond:
        _ok += 1
    else:
        _fail.append(label)
        print("  ✗ %s %s" % (label, extra))


class FixedRng:
    """确定性随机源：把 random.random 固定成常量序列。"""

    def __init__(self, *values):
        self._values = list(values) or [0.0]
        self._i = 0

    def random(self):
        v = self._values[self._i % len(self._values)]
        self._i += 1
        return v


def pet(**over):
    d = {
        "RobotName": "测试机", "Level": 30, "Comprehension": 50,
        "Skills": ["roubo", "xiuli", "leiting", "life_recover"],
    }
    d.update(over)
    return d


# ---------------------------------------------------------------------------
print("[1] 自动升级概率")
check("悟性 40 → 4%", abs(sl.auto_upgrade_chance(40) - 0.04) < 1e-12, sl.auto_upgrade_chance(40))
check("悟性 100 → 10%", abs(sl.auto_upgrade_chance(100) - 0.1) < 1e-12)
check("悟性 0 → 0", sl.auto_upgrade_chance(0) == 0.0)
check("非法悟性 → 用默认 50（5%）", abs(sl.auto_upgrade_chance("abc") - 0.05) < 1e-12)

# ---------------------------------------------------------------------------
print("[2] 等级表归一化")
norm = sl.normalize_levels({"roubo": 3, "肉搏攻击": 5, "36": 2, "xiuli": 0, "unknown_skill": 2, "bad": "x"})
check("超上限夹到 4", norm.get("roubo") == 4, str(norm))
check("中文名归一到 key（同名取大）", norm.get("roubo") == 4)
check("技能书 id 归一到 key", norm.get("roubo") == 4)
check("0 级被丢弃", "xiuli" not in norm, str(norm))
check("认不出的 key 保留（不丢数据）", norm.get("unknown_skill") == 2, str(norm))
check("非数值被丢弃", "bad" not in norm, str(norm))
check("非 dict 输入 → 空表", sl.normalize_levels(None) == {})
check("level_max = 4", sl.level_max() == 4)
check("倍率表 = [1,1.2,1.3,1.5]", sl.level_multipliers() == [1.0, 1.2, 1.3, 1.5])

# ---------------------------------------------------------------------------
print("[3] 等级读写")
check("无字段 → Lv1", sl.level_of(pet(), "roubo") == 1)
check("读出已记录等级", sl.level_of(pet(SkillLevels={"roubo": 3}), "roubo") == 3)
check("兼容 skill_levels 小写", sl.level_of(pet(skill_levels={"roubo": 2}), "roubo") == 2)
check("兼容 SkillLevelMap", sl.level_of(pet(SkillLevelMap={"roubo": 4}), "roubo") == 4)
check("按技能名也能读", sl.level_of(pet(SkillLevels={"roubo": 3}), "肉搏攻击") == 3)
check("越界被夹到 4", sl.level_of(pet(SkillLevels={"roubo": 99}), "roubo") == 4)
check("认不出的技能 → Lv1", sl.level_of(pet(), "no_such") == 1)
check("levels_of 非 dict 文档 → 空表", sl.levels_of(None) == {})

# ---------------------------------------------------------------------------
print("[4] 手动升级条件")
chk = sl.can_manual_upgrade(pet(Level=25), "roubo", 1)
check("Lv1→2 1本+25级 → 通过", chk["ok"], str(chk))
check("返回 from/to 等级", chk["from_level"] == 1 and chk["to_level"] == 2)
check("返回 book_id=36", chk["book_id"] == 36)
check("Lv1→2 0本 → 拒绝", sl.can_manual_upgrade(pet(Level=25), "roubo", 0)["reason"] == "技能书数量不足，需要1个")
check("Lv1→2 24级 → 拒绝", sl.can_manual_upgrade(pet(Level=24), "roubo", 9)["reason"] == "角色等级不足，需要等级25")
check("Lv2→3 2本+40级 → 通过",
      sl.can_manual_upgrade(pet(Level=40, SkillLevels={"roubo": 2}), "roubo", 2)["ok"])
check("Lv2→3 只1本 → 拒绝",
      sl.can_manual_upgrade(pet(Level=40, SkillLevels={"roubo": 2}), "roubo", 1)["reason"] == "技能书数量不足，需要2个")
check("Lv3→4 3本+50级 → 通过",
      sl.can_manual_upgrade(pet(Level=50, SkillLevels={"roubo": 3}), "roubo", 3)["ok"])
check("已满级 → 拒绝",
      sl.can_manual_upgrade(pet(Level=99, SkillLevels={"roubo": 4}), "roubo", 9)["reason"] == "已达到最高等级")
check("不支持手动升的技能 → 拒绝（leiting 无技能书）",
      sl.can_manual_upgrade(pet(Class=3, Level=99), "leiting", 9)["reason"] == "该技能不支持升级")
check("不存在的技能 → 拒绝", sl.can_manual_upgrade(pet(), "no_such", 9)["reason"] == "技能不存在")

# 校验顺序对齐 RPG：Z_skill.js 的职业匹配**最先**拦，其次才是 Z_SkillLevel 的满级/等级/书数
check("职业不匹配优先于「不支持升级」（Class=1 用全能技 leiting）",
      sl.can_manual_upgrade(pet(Level=99), "leiting", 9)["reason"] == "职业不匹配，无法使用该技能书")
check("职业不匹配优先于满级（Class=3 用格斗技 roubo 且已满级）",
      sl.can_manual_upgrade(pet(Class=3, Level=99, SkillLevels={"roubo": 4}), "roubo", 9)["reason"]
      == "职业不匹配，无法使用该技能书")
check("已学校验优先于等级/书数（未学 guangrenzhan）",
      sl.can_manual_upgrade(pet(Skills=["roubo"]), "guangrenzhan", 9)["reason"] == "尚未学会该技能")
check("Class 字符串也认（'universal' + leiting）",
      sl.can_manual_upgrade(pet(Class="universal", Level=99), "leiting", 9)["reason"] == "该技能不支持升级")

levels, new_lv = sl.apply_manual_upgrade(pet(SkillLevels={"roubo": 1}), "roubo")
check("apply 后 +1", levels["roubo"] == 2 and new_lv == 2, str(levels))
levels, new_lv = sl.apply_manual_upgrade(pet(SkillLevels={"roubo": 4}), "roubo")
check("apply 封顶 4", levels["roubo"] == 4 and new_lv == 4)
levels, _ = sl.apply_manual_upgrade(pet(), "roubo")
check("apply 从缺省 1 → 2", levels["roubo"] == 2)

# ---------------------------------------------------------------------------
print("[5] 自动升级判定")
p = pet(Skills=["roubo", "xiuli"], SkillLevels={})
levels, ups = sl.roll_auto_upgrade(p, 1, FixedRng(0.0))
check("rng=0 必成 → roubo Lv2", levels.get("roubo") == 2, str(levels))
check("rng=0 必成 → xiuli Lv2", levels.get("xiuli") == 2, str(levels))
check("升级记录 2 条", len(ups) == 2, str(ups))
check("记录字段完整",
      all(set(u.keys()) == {"key", "name", "from_level", "to_level"} for u in ups), str(ups))
check("记录 from/to 正确",
      any(u["key"] == "roubo" and u["from_level"] == 1 and u["to_level"] == 2 for u in ups))

levels, ups = sl.roll_auto_upgrade(pet(Skills=["roubo"], SkillLevels={}), 1, FixedRng(0.99))
check("rng=0.99 不中（悟性50 → 5%）", levels.get("roubo", 1) == 1 and not ups, str(levels))

levels, ups = sl.roll_auto_upgrade(pet(Skills=["roubo"], SkillLevels={}), 3, FixedRng(0.0))
check("跨 3 级 → +3（1→4）", levels.get("roubo") == 4 and len(ups) == 3, str(levels))

levels, ups = sl.roll_auto_upgrade(pet(Skills=["roubo"], SkillLevels={"roubo": 4}), 5, FixedRng(0.0))
check("已满级不再升", levels.get("roubo") == 4 and not ups, str(levels))

levels, ups = sl.roll_auto_upgrade(pet(Skills=["roubo"], SkillLevels={"roubo": 3}), 5, FixedRng(0.0))
check("Lv3 再升只到 4（只记 1 条）", levels.get("roubo") == 4 and len(ups) == 1, str(ups))

# lv_auto 门控：自动触发技不参与自动升级
levels, ups = sl.roll_auto_upgrade(pet(Skills=["life_recover", "energy_recover"], SkillLevels={}),
                                  5, FixedRng(0.0))
check("自动触发技不升级", not ups, str(ups))
# ★2026-10-01 起纳米侵蚀是普通主动技（lv_auto=True）→ 参与自动升级
levels, ups = sl.roll_auto_upgrade(pet(Skills=["nami_qinshi"], SkillLevels={}), 5, FixedRng(0.0))
check("★纳米侵蚀（已开放为普通主动技）可自动升级", levels.get("nami_qinshi") == 4 and len(ups) == 3, str(levels))
levels, ups = sl.roll_auto_upgrade(pet(Skills=["leiting"], SkillLevels={}), 5, FixedRng(0.0))
check("悟性技（leiting）可自动升级", levels.get("leiting") == 4 and len(ups) == 3, str(levels))

levels, ups = sl.roll_auto_upgrade({"Level": 30, "Comprehension": 50}, 5, FixedRng(0.0))
check("无「已学技能」字段 → 不升不报错", levels == {} and not ups)

p_zero = pet(Skills=["roubo"], Comprehension=0)
levels, ups = sl.roll_auto_upgrade(p_zero, 5, FixedRng(0.0))
check("悟性 0 → 永不升", levels.get("roubo", 1) == 1 and not ups)

levels, ups = sl.roll_auto_upgrade(pet(Skills=["roubo"]), 0, FixedRng(0.0))
check("升级次数 0 → 不动", not ups)

levels, ups = sl.roll_auto_upgrade(pet(Skills=["roubo"], SkillLevels={"xiuli": 3}), 1, FixedRng(0.0))
check("未升级技能的既有等级保留", levels.get("xiuli") == 3, str(levels))

# ---------------------------------------------------------------------------
print("[6] 与战斗链路对齐")
actor = {"mp": 400, "max_mp": 400, "raw": pet(Skills=["roubo"], SkillLevels={"roubo": 4})}
check("skill_level_of 吃到 SkillLevels", ss.skill_level_of(actor, "roubo") == 4)
check("apply_skill_level 按 Lv4 ×1.5", ss.apply_skill_level(100, 4) == 150)
check("Lv1 不加成", ss.apply_skill_level(100, 1) == 100)
check("未记录 → Lv1", ss.skill_level_of({"raw": pet()}, "xiuli") == 1)

# ---------------------------------------------------------------------------
print("[7] 机甲升级链路挂钩（handlers/robot_upgrade）")
import handlers.robot_upgrade as ru    # noqa: E402

mgr = ru.RobotUpgradeManager()
orig_roll = ru.skill_level_svc.roll_auto_upgrade

# 打桩：必定升级 → 验证 SkillLevels 被并进 updated_attrs，且 ups 被回传
ru.skill_level_svc.roll_auto_upgrade = lambda p, n, rng=None: (
    {"roubo": 4}, [{"key": "roubo", "name": "肉搏攻击", "from_level": 1, "to_level": 4}])
out_ups = []
attrs = mgr._apply_skill_level_ups(pet(Skills=["roubo"]), 1, {"MaxHP": 999}, out_ups)
check("SkillLevels 并入 updated_attrs", attrs.get("SkillLevels") == {"roubo": 4}, str(attrs))
check("原有属性不丢", attrs.get("MaxHP") == 999)
check("升级记录回传调用方", len(out_ups) == 1 and out_ups[0]["key"] == "roubo", str(out_ups))
check("原字典未被就地改写（幂等友好）", "SkillLevels" not in {"MaxHP": 999})

# 没有升级 → 原样返回，不写字段
ru.skill_level_svc.roll_auto_upgrade = lambda p, n, rng=None: ({}, [])
attrs = mgr._apply_skill_level_ups(pet(Skills=["roubo"]), 1, {"MaxHP": 999}, None)
check("无升级 → updated_attrs 不变", attrs == {"MaxHP": 999}, str(attrs))

# 判定抛异常 → 绝不影响机甲升级主流程
def _boom(*a, **k):
    raise RuntimeError("boom")


ru.skill_level_svc.roll_auto_upgrade = _boom
attrs = mgr._apply_skill_level_ups(pet(Skills=["roubo"]), 1, {"MaxHP": 999}, None)
check("判定异常被吞掉（机甲升级不受影响）", attrs == {"MaxHP": 999}, str(attrs))

ru.skill_level_svc.roll_auto_upgrade = orig_roll

# 签名兼容：新增的 skill_ups_out 必须是可选参数（不破坏既有 3 处调用）
import inspect    # noqa: E402
sig = inspect.signature(ru.RobotUpgradeManager.add_exp_to_robot_atomic)
check("atomic 新参 skill_ups_out 有默认值",
      "skill_ups_out" in sig.parameters and sig.parameters["skill_ups_out"].default is None,
      str(sig))
sig2 = inspect.signature(ru.RobotUpgradeManager.add_exp_to_robot)
check("非 atomic 版同样可选", "skill_ups_out" in sig2.parameters and sig2.parameters["skill_ups_out"].default is None)

# ---------------------------------------------------------------------------
print("[8] 接口/路由注册")
import router    # noqa: E402
check("skill_level_up 已注册", "skill_level_up" in router.ROUTES)
check("skill_list 已注册", "skill_list" in router.ROUTES)
check("skill_level_up 处理器正确",
      router.ROUTES["skill_level_up"].handler_func.__name__ == "handle_skill_level_up")
check("skill_list 处理器正确",
      router.ROUTES["skill_list"].handler_func.__name__ == "handle_skill_list")
check("限流表含 skill_level_up", "skill_level_up" in __import__(
    "handlers.utils", fromlist=["utils"]).THROTTLE_CONFIG)
# ⚠ 幂等中间件当前是「可选且未启用」（middleware.py 里 use() 被注释掉，且其模块路径
#   被同目录的 middleware.py 遮蔽 → import 静默失败）。这里只校验「名单已登记」，
#   不依赖运行时是否挂载。
_idem_path = os.path.join(ROOT, "server", "middleware", "idempotency_middleware.py")
with open(_idem_path, encoding="utf-8") as _f:
    _idem_src = _f.read()
check("幂等名单已登记 skill_level_up（防重复扣书）", "'skill_level_up'" in _idem_src)

# ---------------------------------------------------------------------------
print("[9] 技能图标字段（供 MechSkill 面板）")
catalog_meta = ss.catalog_meta()
check("catalog 带 icon_atlas", (catalog_meta.get("icon_atlas") or {}).get("path") == "SkillIcon/SkillIcon",
      str(catalog_meta.get("icon_atlas")))
check("catalog 的图集帧 = skill_1..skill_5",
      (catalog_meta.get("icon_atlas") or {}).get("frames") == ["skill_1", "skill_2", "skill_3", "skill_4", "skill_5"])

_all = ss.all_skills()
check("每条技能都有 iconIndex", all(s.get("iconIndex") for s in _all),
      [s["key"] for s in _all if not s.get("iconIndex")])
check("iconIndex 都在 skill_1..skill_5 内",
      all(str(s.get("iconIndex")) in ("skill_1", "skill_2", "skill_3", "skill_4", "skill_5") for s in _all))
check("没有任何技能误用背包图集 IconSet2",
      not any("IconSet2" in str(s.get("iconIndex") or "") for s in _all))
check("生命恢复 → skill_2", (ss.get_skill("life_recover") or {}).get("iconIndex") == "skill_2")
check("纳米攻击 → skill_3", (ss.get_skill("leiting") or {}).get("iconIndex") == "skill_3")
check("纳米侵蚀（表内未列）→ skill_1", (ss.get_skill("nami_qinshi") or {}).get("iconIndex") == "skill_1")

_items = ss.list_castable_skills(
    {"mp": 999, "max_mp": 800, "raw": {"Skills": ["roubo", "leiting"]}}, learned_only=True)
check("list_castable_skills 带出 iconIndex",
      all(it.get("iconIndex") for it in _items), str(_items))
check("list_castable_skills 的图标与目录一致",
      {it["key"]: it["iconIndex"] for it in _items} == {"roubo": "skill_1", "leiting": "skill_3"},
      str({it["key"]: it["iconIndex"] for it in _items}))

# ---------------------------------------------------------------------------
print("[10] 技能面板取数口径：默认「只列已学」（机甲初始没技能 → 空列表）")
# 用户拍板（2026-09-30）：机甲**初始 / 获得时技能为空**（`Skills` 字段都没有），
# 只有用技能书学会才会写入；技能面板显示的就是「已学技能」。所以新机甲面板为空是**预期**的。
_a_f = {"mp": 300, "max_mp": 300, "raw": {"Class": 1, "Level": 44}}
_lst_f = ss.list_castable_skills(_a_f)
check("★无 Skills 字段（机甲初始）→ 空列表（默认只列已学）", _lst_f == [], str(_lst_f))

_a_l = {"mp": 300, "max_mp": 300,
        "raw": {"Class": 1, "Level": 44, "Skills": ["roubo"]}}
_lst_l = ss.list_castable_skills(_a_l)
check("★已学 roubo → 只列它", [x["key"] for x in _lst_l] == ["roubo"], str([x["key"] for x in _lst_l]))
check("learned=True", bool(_lst_l) and _lst_l[0]["learned"] is True)
check("带出 iconIndex（技能图标）", bool(_lst_l and _lst_l[0].get("iconIndex")))
check("带出 level（技能面板显示等级）", bool(_lst_l) and _lst_l[0]["level"] == 1)

_a_two = {"mp": 300, "max_mp": 300,
          "raw": {"Class": 1, "Level": 44, "Skills": ["roubo", "guangrenzhan"],
                  "SkillLevels": {"roubo": 3}}}
_lst_two = ss.list_castable_skills(_a_two)
check("已学 2 个 → 列 2 条且保持写入顺序",
      [x["key"] for x in _lst_two] == ["roubo", "guangrenzhan"], str([x["key"] for x in _lst_two]))
check("等级表生效 → roubo Lv3", _lst_two[0]["level"] == 3)
check("未学的职业线技能**不**出现在已学列表里",
      not any(x["key"] == "kuangnu" for x in _lst_two))

print("[10b] 「技能图鉴」模式（learned_only=False，按职业线列全量）供 UI 备用")
_all_f = ss.list_castable_skills(_a_f, learned_only=False)
# ⚠ 2026-10-01 纳米侵蚀开放所有职业可学 → 各线图鉴 +1 条（原 12/13/14/31）
check("图鉴模式 → 格斗线 13 条", len(_all_f) == 13, len(_all_f))
check("★格斗线图鉴含纳米侵蚀（三职业通用）",
      any(x["key"] == "nami_qinshi" for x in _all_f))
check("图鉴模式：格斗机甲只拿 fighter + all",
      all(x["classes"] in ("fighter", "all") for x in _all_f),
      str(sorted({x["classes"] for x in _all_f})))
check("自动触发技（生命/能量恢复）两模式都不进栏",
      not any(x["category"] == "skill_3" for x in _all_f))
_a_s = {"mp": 300, "max_mp": 300, "raw": {"Class": 2, "Level": 44}}
_all_s = ss.list_castable_skills(_a_s, learned_only=False)
check("射击线 14 条", len(_all_s) == 14, len(_all_s))
check("射击线含「弱点攻击」", any(x["key"] == "ruodian" for x in _all_s))
check("★射击线图鉴含纳米侵蚀（原为参考项，默认已带出）",
      any(x["key"] == "nami_qinshi" for x in _all_s))
check("纳米侵蚀条目已无 reference_only",
      not any(x.get("reference_only") for x in _all_s if x["key"] == "nami_qinshi"))
check("include_reference 开关保留（当前无参考项 → 条数不变）",
      len(ss.list_castable_skills(_a_s, learned_only=False, include_reference=True)) == len(_all_s))
_a_u = {"mp": 300, "max_mp": 300, "raw": {"Class": 3, "Level": 44}}
_all_u = ss.list_castable_skills(_a_u, learned_only=False)
check("全能线 15 条", len(_all_u) == 15, len(_all_u))
check("★全能线图鉴含纳米侵蚀", any(x["key"] == "nami_qinshi" for x in _all_u))
check("全能机甲只拿 universal + all",
      all(x["classes"] in ("universal", "all") for x in _all_u),
      str(sorted({x["classes"] for x in _all_u})))
check("Class 缺失 → 图鉴不过滤（32 条）",
      len(ss.list_castable_skills({"mp": 300, "max_mp": 300, "raw": {"Level": 1}},
                                  learned_only=False)) == 32)

print("")
if _fail:
    print("失败 %d 项：%s" % (len(_fail), _fail))
    sys.exit(1)
print("通过 %d 项，失败 0 项" % _ok)
