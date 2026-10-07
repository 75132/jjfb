# 数值体系 v4（2026-09-28 定稿）—— 从 MEMORY.md §7 迁出

> 热记忆 `MEMORY.md` 只留指针。审计 `docs/数值体系审计报告_v4.md`；对比 `docs/全量生物机甲属性对比_L60.html`；
> 生成器 `tools/monster/gen_attr_html.py`；公式引擎 `tools/monster/monster_formula.py`。

## 基准 = 满配玩家
- 顶配普攻 **17272** / 单体技能 **≈32000**（×1.85）/ 群攻满伤 **≈23000**（×1.33）。**普通怪满配必须 1 刀**。
- **HP 分档**（`monster_formula.is_elite()`）：normal 系数 **1.35** 上限 **17500** / elite **2.30** 上限 **26000** / boss **3.60** 无上限（38617~60826）。

## 机甲基准曲线（以 `server/data/Classes.json` 的 note 为准，`a~o`）
- HP `lv*253+300` / MP `lv*174+150` / 近战·射击 `lv*40+315` / 装甲 `lv*13+16` / 闪避 `lv*13+12` / 先制 `lv*30+15`。
- **命中 / 致命 / 侵蚀 / 抗性：机甲恒 0**（靠装备补）。

## 战斗结算（2026-09-30 起走 RPG Maker MV 全链）
`formula_scaled` → 元素 / 物理率 → 暴击(×3) → 浮动(±variance%) → 防御减半(`/(2×grd)`) → 技能等级倍率。
- **高防保底 `MIN_DAMAGE=1`**（RPG 原义 0，本工程扩展）。`attack = Melee + Shooting`、`defense = Armor` 不变。
- 公式引擎 `monster_formula.py`：`mech_curve()` + `MONSTER_ONLY`（命中=`lv*22+180` / 致命=`lv*18+150` / 侵蚀·抗性=`lv*9+80`）
  + `tier_of()` 1~7 + `nominal_level()` + `monster_coef()`（**每只怪每属性独立确定性系数**）+ `is_elite()`；
  参数 `ATK_SCALE=0.75` / `DEF_SCALE=0.90` / `TIER_COEF`。
- **抽怪按玩家等级匹配**（`battle_room_handler._generate_enemy_snapshot`）：优先 `MonsterExtra._nominalLevel ∈ [玩家等级-6, +10]` → ±18 → 不限。
  **这才是怪物强度主因**。
- 经验曲线 `robot_upgrade.py` `ROBOT_LEVEL_TOTAL_EXP`：L51~L60 走 1.20x 平滑递推，总累计 **1.009 亿**（v3）。

## 收尾铁律
1. **战败保底 1 血**（`_survive_hp_after_battle()`，PVE/PVP + 客户端 `finishBattle`）。
2. **升级必满血满蓝**（`apply_level_up_full_restore()`，只认 `level_up_count>0`，放在升星/成长/技能**之后**）。

## 改数值铁律
① 每只怪独立公式；② HP/MP **先降级再长回**；③ **整集重建 + 改前备份**；④ `_rebalance_apply.py` **幂等**（从 `monsterbase_export.pre_rebalance.json` 重推）；⑤ `_verify_rebalance.py` 校验本地 vs 云端 **383/383**。
