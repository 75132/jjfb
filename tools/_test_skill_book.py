# -*- coding: utf-8 -*-
"""技能书使用逻辑自测（服务端权威）。

每条规则都在注释里标出 RPG Maker 原工程出处，便于回溯核对：
  Z_skill.js          → 职业限制 + 「技能学习成功！」（原工程只弹提示 = 伪实现）
  Z_SkillLevel.js     → 等级升级的校验链（本工程**不用技能书升级**，改由技能面板 UI 承担）

⚠ 2026-09-30 用户拍板的口径：
  - 机甲**初始 / 获得时技能为空**（`Skills` 字段都没有）；
  - **只有用技能书学会才会写入**；
  - **已学会再用书 → 直接拒绝「已经学会，不能再学习了」**（升级走 GUI，用户后续做）。

用法：python tools/_test_skill_book.py
"""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "server"))

from services import skill_service as ss            # noqa: E402
from services import skill_level_service as sl      # noqa: E402
from services import skill_book_service as sb       # noqa: E402

_fail = []
_ok = 0


def check(label, cond, extra=""):
    global _ok
    if cond:
        _ok += 1
    else:
        _fail.append(label)
        print("  ✗ %s %s" % (label, extra))


def pet(**over):
    """格斗机甲（默认已学 roubo / 书 36），可按需覆盖。"""
    d = {
        "RobotName": "测试机", "Level": 30, "Class": 1, "Comprehension": 50,
        "Skills": ["roubo"],
        "SkillLevels": {},
    }
    d.update(over)
    return d


# ---------------------------------------------------------------------------
print("[1] 技能书识别（book_id → 技能 key）")
check("book_map 非空", len(sb.book_map()) >= 20, len(sb.book_map()))
check("书 36 → roubo（肉搏攻击）", sb.skill_of_book(36) == "roubo", sb.skill_of_book(36))
check("书 41 → leitingchongji（雷霆冲击）", sb.skill_of_book(41) == "leitingchongji")
check("书 46 → diancifengbao（电磁风暴）", sb.skill_of_book(46) == "diancifengbao")
check("书 55 → life_recover（生命恢复，三职业通用书）", sb.skill_of_book(55) == "life_recover")
check("书 56 → nami_qinshi（纳米侵蚀，★2026-10-01 起三职业通用）", sb.skill_of_book(56) == "nami_qinshi")
check("书 87 → shengmingshequ", sb.skill_of_book(87) == "shengmingshequ")
check("书 90 → leiting（纳米攻击，2026-09-30 补）", sb.skill_of_book(90) == "leiting")
check("书 91 → ruodian（弱点攻击，2026-09-30 补）", sb.skill_of_book(91) == "ruodian")
check("★全表 34 个技能现在都有技能书", len(sb.book_map()) == 34, len(sb.book_map()))
check("非技能书物品 → None", sb.skill_of_book(1) is None)
check("is_skill_book(36)=True", sb.is_skill_book(36) is True)
check("is_skill_book(1)=False", sb.is_skill_book(1) is False)
check("非法入参不抛异常", sb.skill_of_book(None) is None and sb.skill_of_book("abc") is None)

# ---------------------------------------------------------------------------
print("[2] 职业匹配（Z_skill.js：格斗36-40 / 射击41-45 / 全能46-51，55 通用）")
r = sb.plan_use_book(pet(Class=1, Skills=[]), 36, 9)
check("格斗机甲 + 格斗书36（未学）→ 学会", r["ok"] and r["action"] == "learn", str(r))
r = sb.plan_use_book(pet(Class=1, Skills=[]), 41, 9)
check("格斗机甲 + 射击书41 → 职业不匹配",
      r["reason"] == "职业不匹配，无法使用该技能书", str(r))
r = sb.plan_use_book(pet(Class=2, Skills=[], Level=99), 41, 9)
check("射击机甲 + 射击书41（未学）→ 学会", r["ok"] and r["action"] == "learn", str(r))
r = sb.plan_use_book(pet(Class=3, Skills=[], Level=99), 46, 9)
check("全能机甲 + 全能书46（未学）→ 学会", r["ok"] and r["action"] == "learn", str(r))
r = sb.plan_use_book(pet(Class=2, Skills=[], Level=99), 46, 9)
check("射击机甲 + 全能书46 → 职业不匹配", not r["ok"] and "职业不匹配" in r["reason"], str(r))
for cls in (1, 2, 3):
    r = sb.plan_use_book(pet(Class=cls, Skills=[], Level=99), 55, 9)
    check("通用书55 + 职业线%d → 学会" % cls, r["ok"] and r["action"] == "learn", str(r))
check("Class 字符串（'shooter'）也认",
      sb.plan_use_book(pet(Class="shooter", Skills=[], Level=99), 41, 9)["ok"])
check("职业不匹配时 need_books=0（绝不扣书）",
      sb.plan_use_book(pet(Class=1, Skills=[]), 41, 9)["need_books"] == 0)

# ---------------------------------------------------------------------------
print("[3] 未学 → 学会 Lv1（补全 Z_skill.js 的「技能学习成功！」）")
r = sb.plan_use_book(pet(Skills=["roubo"]), 37, 1)          # 书37=光刃斩，未学
check("未学 + 1本 → action=learn", r["ok"] and r["action"] == "learn", str(r))
check("学会消耗 1 本", r["need_books"] == 1)
check("学会目标等级 = 1", r["to_level"] == 1)
check("未学 + 0本 → 书不足",
      sb.plan_use_book(pet(Skills=["roubo"]), 37, 0)["reason"] == "技能书数量不足，需要1个")
out = sb.use_book(pet(Skills=["roubo"]), 37, 1)
check("use_book 产出完整等级表", isinstance(out.get("levels"), dict) and out["levels"].get("guangrenzhan") == 1, str(out))
check("use_book 产出完整已学数组（落库写 Skills 用）",
      out.get("skills") == ["roubo", "guangrenzhan"], str(out.get("skills")))
check("use_book 带出技能名", out.get("name") == "光刃斩", str(out))
check("原已学顺序保留、新技能 append 在尾部（不覆盖旧数据）",
      out.get("skills", [])[0] == "roubo")
r = sb.plan_use_book(pet(Skills=["roubo"]), 37, 1)
r2 = sb.plan_use_book(pet(Skills=["roubo"]), 37, 1)
check("判定幂等（纯函数不改入参）", r == r2)
check("apply_learn 幂等（已在该数组里不重复 append）",
      sb.apply_learn(pet(Skills=["roubo"]), "roubo")[0] == ["roubo"])

# 关掉 LEARN_WHEN_UNLEARNED → 未学直接否决
_old = sb.LEARN_WHEN_UNLEARNED
sb.LEARN_WHEN_UNLEARNED = False
check("开关关闭后：未学 → 尚未学会该技能",
      sb.plan_use_book(pet(Skills=["roubo"]), 37, 9)["reason"] == "尚未学会该技能")
sb.LEARN_WHEN_UNLEARNED = _old

# ---------------------------------------------------------------------------
print("[4] 已学 → 拒绝「不能再学习了」（技能书只用来学会；升级走 GUI）")
for lv, books, mech in ((1, 1, 25), (2, 2, 40), (3, 3, 50), (4, 9, 99)):
    r = sb.plan_use_book(pet(Level=mech, Skills=["roubo"], SkillLevels={"roubo": lv}), 36, books)
    check("已学 roubo（Lv%d）+ %d本 → 不能再学习了" % (lv, books),
          (not r["ok"]) and ("不能再学习了" in r["reason"]), str(r))
    check("已学时 need_books=0（绝不扣书）", r["need_books"] == 0)
check("拒绝文案带技能名",
      "肉搏攻击" in sb.plan_use_book(pet(Skills=["roubo"]), 36, 9)["reason"])
check("重复判定幂等",
      sb.plan_use_book(pet(Skills=["roubo"]), 36, 9) == sb.plan_use_book(pet(Skills=["roubo"]), 36, 9))
check("已学 → 不产出落库数据（skills/levels 都不在）",
      "skills" not in sb.use_book(pet(Skills=["roubo"]), 36, 9)
      and "levels" not in sb.use_book(pet(Skills=["roubo"]), 36, 9))

print("[4b] 升级改由技能面板接口承担（Z_SkillLevel 的校验链保留）")
check("can_manual_upgrade 仍在（供 skill_level_up）", callable(sl.can_manual_upgrade))
r = sl.can_manual_upgrade(pet(Level=25, Skills=["roubo"], SkillLevels={"roubo": 1}), "roubo", 1)
check("Lv1→2 1本+25级 → 通过", r["ok"] and r["to_level"] == 2, str(r))
check("Lv2→3 需要 2 本", sl.can_manual_upgrade(
    pet(Level=40, Skills=["roubo"], SkillLevels={"roubo": 2}), "roubo", 2)["need_books"] == 2)
check("Lv2→3 只 1 本 → 书不足", sl.can_manual_upgrade(
    pet(Level=40, Skills=["roubo"], SkillLevels={"roubo": 2}), "roubo", 1)["reason"] == "技能书数量不足，需要2个")
check("Lv1→2 24 级 → 等级不足", sl.can_manual_upgrade(
    pet(Level=24, Skills=["roubo"], SkillLevels={"roubo": 1}), "roubo", 9)["reason"] == "角色等级不足，需要等级25")
check("Lv4 → 已达到最高等级", sl.can_manual_upgrade(
    pet(Level=99, Skills=["roubo"], SkillLevels={"roubo": 4}), "roubo", 9)["reason"] == "已达到最高等级")
check("未学技能不能升级",
      sl.can_manual_upgrade(pet(Skills=["roubo"]), "guangrenzhan", 9)["reason"] == "尚未学会该技能")

# ---------------------------------------------------------------------------
print("[5] ★2026-10-01：纳米侵蚀（书 56）开放所有职业可学")
_nami = ss.get_skill("nami_qinshi") or {}
check("纳米侵蚀 classes=all", _nami.get("classes") == "all", _nami.get("classes"))
check("纳米侵蚀已非参考项", not _nami.get("reference_only"))
check("纳米侵蚀 mp_cost_percent=20（原 None=0 消耗）", _nami.get("mp_cost_percent") == 20)
check("纳米侵蚀仍是远程群体（range=ranged / scope=2）",
      _nami.get("range") == "ranged" and _nami.get("scope") == 2)
for _cls, _name in ((1, "格斗"), (2, "射击"), (3, "全能")):
    _r = sb.plan_use_book(pet(Class=_cls, Skills=[]), 56, 1)
    check("Class=%d(%s) 未学纳米侵蚀 + 书56 → 学会" % (_cls, _name),
          _r["ok"] and _r["action"] == "learn", str(_r))
_r = sb.plan_use_book(pet(Class=1, Skills=["nami_qinshi"]), 56, 9)
check("已学后再用书56 → 不能再学习了",
      (not _r["ok"]) and "不能再学习了" in _r["reason"], str(_r))

print("[5-] reference_only 分支保留（当前已无此类技能 → 用假技能验证）")
_orig_get_skill = ss.get_skill
ss.get_skill = lambda k: ({"key": k, "name": "假参考技", "classes": "all", "reference_only": True}
                          if k == "nami_qinshi" else _orig_get_skill(k))
try:
    r = sb.plan_use_book(pet(Class=2, Skills=["leitingchongji"]), 56, 9)
    check("假参考技 → 仅为参考项", r["reason"] == "该技能仅为参考项，未实装", str(r))
    check("假参考技 need_books=0", r["need_books"] == 0)
finally:
    ss.get_skill = _orig_get_skill

# ---------------------------------------------------------------------------
print("[5b] 悟性技补书（0090 纳米攻击 / 0091 弱点攻击）：只能「学会」")
r = sb.plan_use_book(pet(Class=3, Level=99, Skills=["roubo"]), 90, 1)
check("全能机甲未学纳米攻击 + 书90 → learn", r["ok"] and r["action"] == "learn", str(r))
r = sb.plan_use_book(pet(Class=3, Level=99, Skills=["leiting"]), 90, 9)
check("已学纳米攻击再用书90 → 不能再学习了", (not r["ok"]) and "不能再学习了" in r["reason"], str(r))
r = sb.plan_use_book(pet(Class=2, Level=99, Skills=["leitingchongji"]), 91, 1)
check("射击机甲未学弱点攻击 + 书91 → learn", r["ok"] and r["action"] == "learn", str(r))
check("格斗机甲用射击书91 → 职业不匹配",
      sb.plan_use_book(pet(Class=1, Skills=["roubo"]), 91, 9)["reason"] == "职业不匹配，无法使用该技能书")
check("悟性技仍保留自动升级通道（lv_auto）",
      bool((ss.get_skill("leiting") or {}).get("lv_auto")) and not bool((ss.get_skill("leiting") or {}).get("lv_manual")))

# ---------------------------------------------------------------------------
print("[6] 失败一律不产生数据变更（保证调用方不会误扣书）")
bad_cases = [
    ("职业不匹配", sb.plan_use_book(pet(Class=1, Skills=[]), 41, 9)),
    ("非技能书", sb.plan_use_book(pet(), 1, 9)),
    ("书不足（未学）", sb.plan_use_book(pet(Skills=[]), 37, 0)),
    ("已学", sb.plan_use_book(pet(Skills=["roubo"]), 36, 9)),
    ("已学（纳米侵蚀，原参考项位置）", sb.plan_use_book(pet(Skills=["nami_qinshi"]), 56, 9)),
]
for name, res in bad_cases:
    check("%s → ok=False 且无 levels/skills" % name,
          (not res["ok"]) and ("levels" not in res) and ("skills" not in res), str(res))

# ---------------------------------------------------------------------------
print("[7] 与战斗/升级链路同口径")
check("class_matches 对 all 通用技能恒真",
      all(sl.class_matches(pet(Class=c), ss.get_skill("xiuli")) for c in (1, 2, 3)))
check("★is_learned：无 Skills 字段 → False（机甲默认没技能，可被书学会）",
      sl.is_learned({"Level": 1}, "roubo") is False)
check("★无 Skills 字段的机甲可以直接用书学会",
      sb.plan_use_book({"Class": 1, "Level": 9}, 36, 1)["ok"] is True)
check("is_learned：有字段但不含 → False", sl.is_learned(pet(Skills=["roubo"]), "guangrenzhan") is False)
check("is_learned：含 → True", sl.is_learned(pet(Skills=["roubo"]), "roubo") is True)
check("can_manual_upgrade 已含职业校验",
      sl.can_manual_upgrade(pet(Class=1, Skills=["leitingchongji"]), "leitingchongji", 9)["reason"]
      == "职业不匹配，无法使用该技能书")

print("[7b] 落库形状（Skills 字段可被 $set 自动创建 → 兼容旧玩家数据）")
_old_pet = {"Class": 1, "Level": 9}          # 旧数据：没有 Skills / SkillLevels
_out = sb.use_book(_old_pet, 36, 1)
check("旧数据（无字段）学会 → 产出 skills=['roubo']", _out.get("skills") == ["roubo"], str(_out.get("skills")))
check("旧数据（无字段）学会 → 产出 levels={'roubo': 1}", _out.get("levels") == {"roubo": 1}, str(_out.get("levels")))
check("纯函数：不改传入的文档", "Skills" not in _old_pet and "SkillLevels" not in _old_pet)

print("[8] 调用点静态检查（防 _audit_bag_write 参数冲突）")
# 2026-09-30 实际踩过：`_audit_bag_write(user_id, character_id, action, **fields)` 的第三个
# 位置参数就叫 action，调用时再用 `action=` 传关键字 → TypeError: got multiple values。
# 客户端日志里表现为「使用物品失败: _audit_bag_write() got multiple values for argument 'action'」。
import io as _io           # noqa: E402
import re as _re           # noqa: E402

_bag_src = _io.open(os.path.join(ROOT, "server", "handlers", "bag_handler.py"),
                    encoding="utf-8").read()
_conflicts = [
    m.group(0).replace("\n", " ")[:90]
    for m in _re.finditer(r"_audit_bag_write\((?:[^()]|\([^()]*\))*\)", _bag_src)
    if _re.search(r"\baction\s*=", m.group(0))
]
check("没有 _audit_bag_write(..., action=...) 冲突调用", not _conflicts, _conflicts)
check("审计函数签名确为 (user_id, character_id, action, **fields)",
      "def _audit_bag_write(user_id, character_id, action: str, **fields)" in _bag_src)

print("[9] 技能书分支必须放在 `if item_data:` 之前（否则取不到配置会静默扣 1 个）")
# 只看 handle_bag_use_item 函数体内部，并按「整行」匹配，避免命中注释里的同名文字
_lines = _bag_src.splitlines()
_fn_line = next((i for i, l in enumerate(_lines)
                 if l.startswith("async def handle_bag_use_item")), -1)
check("定位到 handle_bag_use_item", _fn_line >= 0)
_skill_line = next((i for i in range(_fn_line, len(_lines))
                    if "is_skill_book(" in _lines[i]), -1)
_item_line = next((i for i in range(_fn_line, len(_lines))
                   if _lines[i].strip().startswith("if item_data:")), -1)
check("两条定位都成功", _skill_line > 0 and _item_line > 0,
      "skill=%s item_data=%s" % (_skill_line, _item_line))
check("技能书分支在 `if item_data:` 之前（行号更小）",
      0 <= _skill_line < _item_line, "skill=%s item_data=%s" % (_skill_line, _item_line))
check("技能书分支调用 apply_skill_book 落库",
      any("apply_skill_book" in _lines[i] for i in range(_skill_line, _item_line + 1)))

print("")
if _fail:
    print("失败 %d 项：%s" % (len(_fail), _fail))
    sys.exit(1)
print("通过 %d 项，失败 0 项" % _ok)
