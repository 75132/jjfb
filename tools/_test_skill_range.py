# -*- coding: utf-8 -*-
"""技能「出招方式 / 距离口径」回归（纯逻辑，不连库）

口径来源：`tools/skill_range_todo.md`（用户填表，2026-10-01 定稿）。

覆盖
----
1. 两份 `Skills.json`（`server/data/` 与 `assets/resources/json/`）字节一致；
2. 34 条技能的 `range` 与用户填表**逐条对齐**（近身 7 / 远程 24 / 条件 1 / 无 2）；
3. `range` 元数据块（values / rule_names / gun_weapon_ids / counts）齐全；
4. 生成器 `RANGE_BY_KEY` 覆盖全部技能 key（新增技能漏登记 → 直接报错）；
5. 服务端 `skill_service.skill_range_of` / `is_ranged_skill` 与客户端 `SkillData` 同口径
   （含「急速攻击」持枪动态判定）；
6. `list_castable_skills` 条目带出 `range` / `range_rule`；
7. 客户端 `SkillData` 的 `skillRangeOf` / `isRangedSkill` 与 fill 表同口径；
8. 客户端 `BattleScene` **确实按 range 分流**（源码守卫）：近身技先位移贴近再出招、打完归位。

运行：`python tools/_test_skill_range.py`
"""
from __future__ import annotations

import hashlib
import importlib.util
import io
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "server"))

PASS = 0
FAIL = 0
FAILED: list = []


def ck(name, cond, detail=None):
    global PASS, FAIL
    if cond:
        PASS += 1
    else:
        FAIL += 1
        FAILED.append(name)
        print("  ✗ %s%s" % (name, ("  → " + str(detail)) if detail is not None else ""))


def section(t):
    print("\n== %s ==" % t)


def load(p):
    with io.open(p, encoding="utf-8") as f:
        return json.load(f)


# ---------------------------------------------------------------------------
# 用户填表（2026-10-01，原文见 tools/skill_range_todo.md）
# ---------------------------------------------------------------------------
EXPECT_MELEE = [
    "roubo", "guangrenzhan", "chaonengquan", "leitingzhenshe",   # 格斗单体 ×4
    "chongfeng", "kuangnuji", "lianxu",                          # 格斗单体 ×3
]
EXPECT_RANGED = [
    "kuangnu",                                                   # 格斗·全体 → 用户标远程
    "leitingchongji", "lizijiguang", "denglizidanmu", "xukongdaodan", "nengliangbaopo",
    "diancifengbao", "shikongniuqu", "yinliyazhi", "denglizipingzhang", "xukongchongji",
    "jingsheng", "jingu", "sheshen", "ganrao", "huiluganrao",
    "shengmingshequ", "zhaqu",                                   # 通用线 2 条 → 用户标远程
    "leiting", "ruodian",
    "nenglianghudun", "xinniandun", "xiuli",                     # 自身/己方辅助
    "nami_qinshi",                                               # 原参考项（★2026-10-01 开放所有职业可学）
]
EXPECT_DYNAMIC = ["jisu"]
EXPECT_NONE = ["life_recover", "energy_recover"]

EXPECT = {}
for k in EXPECT_MELEE:
    EXPECT[k] = "melee"
for k in EXPECT_RANGED:
    EXPECT[k] = "ranged"
for k in EXPECT_DYNAMIC:
    EXPECT[k] = "dynamic"
for k in EXPECT_NONE:
    EXPECT[k] = "none"

SERVER_JSON = os.path.join(ROOT, "server", "data", "Skills.json")
CLIENT_JSON = os.path.join(ROOT, "assets", "resources", "json", "Skills.json")


def md5(p):
    with open(p, "rb") as f:
        return hashlib.md5(f.read()).hexdigest()


def main():
    global PASS, FAIL

    section("1) 两份 Skills.json 同源")
    ck("server/data 与 assets/resources/json 字节一致（md5 相同）",
       md5(SERVER_JSON) == md5(CLIENT_JSON),
       "%s vs %s" % (md5(SERVER_JSON), md5(CLIENT_JSON)))

    data = load(SERVER_JSON)
    skills = data.get("skills") or []
    by_key = {s["key"]: s for s in skills}
    ck("技能条数 = 34", len(skills) == 34, len(skills))
    ck("version = 6（新增 range 字段）", data.get("version") == 6, data.get("version"))

    section("2) 逐条与用户填表对齐")
    for key, want in sorted(EXPECT.items()):
        s = by_key.get(key)
        ck("%s(%s) range=%s" % (key, (s or {}).get("name", "缺失"), want),
           bool(s) and s.get("range") == want,
           (s or {}).get("range"))
    ck("无未登记 range 的技能", all(s.get("range") for s in skills),
       [s["key"] for s in skills if not s.get("range")])
    ck("无表外技能（key 集合一致）", set(by_key) == set(EXPECT),
       sorted(set(by_key) ^ set(EXPECT)))

    section("3) 分类计数")
    counts = {}
    for s in skills:
        counts[s["range"]] = counts.get(s["range"], 0) + 1
    ck("melee=7", counts.get("melee") == 7, counts)
    ck("ranged=24", counts.get("ranged") == 24, counts)
    ck("dynamic=1", counts.get("dynamic") == 1, counts)
    ck("none=2", counts.get("none") == 2, counts)

    section("4) range 元数据块")
    rb = data.get("range") or {}
    for k in ("melee", "ranged", "dynamic", "none"):
        ck("range.values 有 %s 说明" % k, k in (rb.get("values") or {}))
    ck("rule_names 含 gun", "gun" in (rb.get("rule_names") or {}))
    ck("gun_weapon_ids = 28..51", rb.get("gun_weapon_ids") == list(range(28, 52)),
       rb.get("gun_weapon_ids"))
    ck("counts 与实算一致",
       rb.get("counts") == {"melee": 7, "ranged": 24, "dynamic": 1, "none": 2},
       rb.get("counts"))
    note = str(rb.get("status_note", ""))
    ck("标注客户端已做「近身技位移」表现", "近身技位移" in note, note)
    ck("标注服务端未接入距离规则", "服务端未接入距离规则" in note, note)

    section("5) 生成器登记完整性（新增技能漏登记 → 报错）")
    spec = importlib.util.spec_from_file_location(
        "_build_skill_table", os.path.join(ROOT, "tools", "build_skill_table.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    ck("RANGE_BY_KEY 覆盖全部技能 key", set(mod.RANGE_BY_KEY) == set(by_key),
       sorted(set(mod.RANGE_BY_KEY) ^ set(by_key)))
    ck("生成的 range 与登记表一致",
       all(mod.range_for(k)[0] == EXPECT[k] for k in EXPECT))
    ck("jisu 为 dynamic 且带 gun 规则",
       (mod.RANGE_RULE_BY_KEY.get("jisu") or {}).get("rule") == "gun",
       mod.RANGE_RULE_BY_KEY.get("jisu"))

    section("6) 服务端口径函数")
    from services import skill_service as ss  # noqa: E402

    ck("常量值", (ss.SKILL_RANGE_MELEE, ss.SKILL_RANGE_RANGED,
                  ss.SKILL_RANGE_DYNAMIC, ss.SKILL_RANGE_NONE)
       == ("melee", "ranged", "dynamic", "none"))
    ck("skill_range_of(肉搏攻击) = melee", ss.skill_range_of(by_key["roubo"]) == "melee")
    ck("skill_range_of(离子激光) = ranged", ss.skill_range_of(by_key["lizijiguang"]) == "ranged")
    ck("skill_range_of(生命恢复) = none", ss.skill_range_of(by_key["life_recover"]) == "none")
    ck("skill_range_of(None) 兜底 ranged", ss.skill_range_of(None) == "ranged")
    ck("skill_range_of(非法值) 兜底 ranged",
       ss.skill_range_of({"range": "teleport"}) == "ranged")

    jisu = by_key["jisu"]
    ck("急速攻击 未持枪 → 近身", ss.is_ranged_skill(jisu, {}, gun_equipped=False) is False)
    ck("急速攻击 持枪 → 远程", ss.is_ranged_skill(jisu, {}, gun_equipped=True) is True)
    ck("急速攻击 由文档判定（Weapon=Gun id）",
       ss.is_ranged_skill(jisu, {"Weapon": {"item_id": 30}}) is True)
    ck("急速攻击 由文档判定（无武器）",
       ss.is_ranged_skill(jisu, {"Level": 30, "Class": 2}) is False)   # Level 不能误判成枪械
    ck("近身技给枪也仍是近身", ss.is_ranged_skill(by_key["roubo"], {"Weapon": {"item_id": 30}}) is False)
    ck("远程技无枪也仍是远程", ss.is_ranged_skill(by_key["lizijiguang"], {}) is True)
    ck("被动(none) 不判距离 → False", ss.is_ranged_skill(by_key["life_recover"], {}) is False)
    # ⚠ 2026-10-01 事故回归：读不到技能定义时必须按普攻口径兜底，绝不能兜底成远程
    ck("无技能定义 未持枪 → 近身（普攻口径兜底）",
       ss.is_ranged_skill(None, {}) is False)
    ck("无技能定义 持枪 → 远程（普攻口径兜底）",
       ss.is_ranged_skill(None, {"Weapon": {"item_id": 30}}) is True)
    ck("无技能定义 + gun_equipped=False → 近身",
       ss.is_ranged_skill(None, {}, gun_equipped=False) is False)
    ck("无技能定义 不会被 Level/Class 误判成持枪",
       ss.is_ranged_skill(None, {"Level": 30, "Class": 2}) is False)

    section("7) list_castable_skills 带出 range")
    actor = {"Class": 2, "Skills": ["lizijiguang", "jisu"], "MaxMP": 1000, "CurrentMP": 1000}
    rows = ss.list_castable_skills(actor, learned_only=True)
    ck("已学 2 条", len(rows) == 2, [r["key"] for r in rows])
    ck("每条都带 range", all(r.get("range") in ("melee", "ranged", "dynamic", "none") for r in rows))
    got = {r["key"]: r["range"] for r in rows}
    ck("lizijiguang=ranged / jisu=dynamic",
       got.get("lizijiguang") == "ranged" and got.get("jisu") == "dynamic", got)
    ck("dynamic 条目带 range_rule",
       [r for r in rows if r["key"] == "jisu"][0].get("range_rule", {}).get("rule") == "gun")

    section("8) 客户端 BattleScene 已按 range 分流（源码守卫）")
    ts_path = os.path.join(ROOT, "assets", "Script", "Game", "BattleScene.ts")
    with io.open(ts_path, encoding="utf-8") as f:
        ts = f.read()

    ck("读取技能出招方式：SkillData.isRangedSkill 被调用",
       "SkillData.isRangedSkill(" in ts)
    ck("持枪判定与口径一致：SkillData.hasGunEquipped 被调用",
       "SkillData.hasGunEquipped(" in ts)
    ck("近身技位移函数存在 moveInForMeleeSkill", "private moveInForMeleeSkill(" in ts)
    ck("近身技分支只对「打对方」的技能位移",
       "!skillRanged && effectShow && effectShow !== attackerShow" in ts)
    ck("近身技在特效前先位移（meleeMove 赋值早于 playSkillEffect 调用）",
       ts.index("const meleeMove =") < ts.index("effectShow.playSkillEffect("))
    ck("近身技打完要归位：finish() 调 meleeMove.restore",
       "if (meleeMove) meleeMove.restore(() => done());" in ts)
    ck("归位有兜底调度（tween 回调丢失也不死锁）",
       "BattleScene.MELEE_RETURN_TIME + 0.3" in ts)
    ck("近战接触间隔常量与普攻共用", "BattleScene.MELEE_CONTACT_GAP" in ts)
    ck("击退位移常量与普攻共用", "BattleScene.KNOCKBACK_DELTA" in ts)
    ck("remote 路径不变：远程技仍原地出招（无 meleeMove 时不位移）",
       "else done();" in ts and "const skillRanged = SkillData.isRangedSkill(skillDef, attackerHasGun);" in ts)
    # ⚠ 2026-10-01 事故回归：`loadSkillCatalog()` 里用了 JsonAsset，漏 import 会让整份技能目录
    #   加载失败（ReferenceError）→ getSkillDef 全部返回 null → 近身技被当成远程原地出招。
    cc_import = [ln for ln in ts.splitlines() if ln.startswith("import {") and "'cc'" in ln]
    ck("BattleScene 的 cc import 里有 JsonAsset（技能目录可加载）",
       bool(cc_import) and "JsonAsset" in cc_import[0], cc_import[:1])
    ck("技能目录加载失败会告警（不再是静默）",
       "技能目录加载异常" in ts or "技能目录 json/Skills 加载失败" in ts)

    sd_path = os.path.join(ROOT, "assets", "Script", "Game", "SkillData.ts")
    with io.open(sd_path, encoding="utf-8") as f:
        sd = f.read()
    ck("客户端 SkillData.isRangedSkill 无定义时按普攻口径兜底",
       "if (!skill) return !!hasGun;" in sd)
    ck("客户端 SkillData 同口径识别 none（不位移）",
       "if (r === 'none') return false;" in sd)

    print("\n技能出招方式回归：通过 %d / 失败 %d" % (PASS, FAIL))
    if FAILED:
        print("失败项：" + "；".join(FAILED))
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
