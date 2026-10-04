# 技能出招方式 / 距离口径 · 已定稿

> **状态：用户已填表（2026-10-01），已落地到 `server/data/Skills.json`（`range` 字段，version 6）。**
> 用户填表原文保留在文件末尾「附录：用户原表」。
> **本文件仍是唯一口径来源** —— 改口径先改这里，再跑 `python tools/build_skill_table.py --apply`。

## 1. 取值口径

| 取值       | 含义                                  | 条数 |
| -------- | ----------------------------------- | -- |
| `melee`  | 近身 —— 必须先位移贴到目标身上才能打                | 7  |
| `ranged` | 远程 —— 站在原地即可出招                      | 24 |
| `dynamic`| 按 `range_rule` 条件判定（当前只有「急速攻击」）      | 1  |
| `none`   | 不主动施放（自动触发被动），不涉及距离                 | 2  |

## 2. 定稿规则（用户口径，**不要按职业线自行推断**）

1. **格斗单体技 = 近身**：肉搏攻击 / 光刃斩 / 超能拳 / 雷霆震慑 / 冲锋 / 狂怒一击 / 连续攻击。
2. **格斗全体技 = 远程**：火焰风暴（唯一例外，虽是格斗但标远程）。
3. **射击 / 全能全部 = 远程**（含全体技与护盾）。
4. **通用线**：急速攻击 = **条件判定**（见下）；生命摄取 / 能量榨取 / 紧急修理 = 远程。
5. **自身 / 己方辅助 = 远程**：能量护盾 / 信念盾 / 紧急修理（不涉及「贴近敌人」，按远程处理即可，无需位移）。
6. **自动触发被动 = 不主动施放**：生命恢复 / 能量恢复 → `none`。
7. **纳米侵蚀**（原参考项，★2026-10-01 开放所有职业可学）= 远程（群体）。

### dynamic 规则：`jisu`（急速攻击）

> 用户原文：「远程 or 近身，根据他的武器是不是枪械，没准备枪械，那就都是近身」

- `range_rule = {"rule": "gun", ...}`，判定表 = **普攻同一份** `gun_weapon_ids`（武器 id **28–51**）。
- 持枪 → `ranged`；未持枪 → `melee`。
- 两端实现同一函数：服务端 `skill_service.is_ranged_skill(skill, actor)` / 客户端 `SkillData.isRangedSkill(skill, hasGun)`。

## 3. 落地位置

| 用途 | 位置 |
| --- | --- |
| 口径登记（改这里） | `tools/build_skill_table.py` → `RANGE_BY_KEY` / `RANGE_RULE_BY_KEY` |
| 权威数据 | `server/data/Skills.json` 每条技能 `range` + `range_rule`；元数据块 `range` |
| 同源副本（**字节一致**） | `assets/resources/json/Skills.json`（由生成器一并写出，**不要手动 cp**） |
| 服务端读取 | `services/skill_service.py` → `skill_range_of()` / `is_ranged_skill()`；`list_castable_skills` 条目带 `range` |
| 客户端读取 | `assets/Script/Game/SkillData.ts` → `skillRangeOf()` / `isRangedSkill()`；`listCastableSkills` 条目带 `range` |
| 客户端**表现**接入（近身技位移） | `assets/Script/Game/BattleScene.ts` → `moveInForMeleeSkill()`（第 3358 行附近） |
| 回归 | `python tools/_test_skill_range.py`（82 项，已进 `tools/_skill_regression.py`） |

生成命令：

```bash
python tools/build_skill_table.py --apply     # 一次写出 server/data + assets/resources 两份（LF，md5 一致）
```

> ⚠ 生成器必须用 `newline="\n"` 写 —— 曾在 Windows 下写成 CRLF，导致两份 md5 不一致。

## 4. 接入现状（2026-10-01 更新）

### ✅ 已接入：客户端「近身技位移」表现
`BattleScene.playOneRoundEvent()` 出招前按 `range` 分流：

| 判定 | 表现 |
| --- | --- |
| `isRangedSkill() === true`（远程 / 持枪的急速攻击 / 自身己方技） | **原地出招**（与之前一致） |
| `isRangedSkill() === false`（近身） | 机甲**先位移贴到目标身前**（间隔 30px，与普攻近战同口径）→ 播技能特效 + 结算 → **滑回原位** |

- 判定口径：`SkillData.isRangedSkill(skillDef, hasGun)`，`hasGun` 用 `SkillData.hasGunEquipped(equipmentOf(rawData))`（武器 id 28–51，与普攻同源）。
- 自身 / 己方目标技能（护盾、修理）目标不是敌人 → **不位移**。
- 位移只是**表现层**，伤害完全走服务端权威值，**与距离无关**。
- 共用常量：`BattleScene.MELEE_CONTACT_GAP`(30) / `KNOCKBACK_DELTA`(30) / `MELEE_RETURN_TIME`(0.14s)。

### ⏳ 未接入：服务端距离规则
战斗仍是 **1v1、出手即命中** —— *不需要*为「靠近」消耗回合，命中判定与距离无关。
若日后要做「离得远就打不到 / 靠近才生效」，用 `skill_service.skill_range_of()` / `is_ranged_skill()` 在服务端判分支即可。

---

## 附录：用户原表（2026-10-01 回填，原文照录）

| #  | 技能名   | key                 | 职业 | 目标     | 出招方式（用户填写）                |
| -- | ----- | ------------------- | -- | ------ | ------------------------- |
| 1  | 肉搏攻击  | `roubo`             | 格斗 | 单体     | 近身                        |
| 2  | 光刃斩   | `guangrenzhan`      | 格斗 | 单体     | 近身                        |
| 3  | 超能拳   | `chaonengquan`      | 格斗 | 单体     | 近身                        |
| 4  | 雷霆震慑  | `leitingzhenshe`    | 格斗 | 单体     | 近身                        |
| 5  | 火焰风暴  | `kuangnu`           | 格斗 | 全体     | **远程**                    |
| 6  | 雷霆冲击  | `leitingchongji`    | 射击 | 单体     | 远程                        |
| 7  | 离子激光  | `lizijiguang`       | 射击 | 单体     | 远程                        |
| 8  | 等离子弹幕 | `denglizidanmu`     | 射击 | 全体     | 远程                        |
| 9  | 虚空导弹  | `xukongdaodan`      | 射击 | 单体     | 远程                        |
| 10 | 能量爆破  | `nengliangbaopo`    | 射击 | 单体     | 远程                        |
| 11 | 电磁风暴  | `diancifengbao`     | 全能 | 单体     | 远程                        |
| 12 | 时空扭曲  | `shikongniuqu`      | 全能 | 全体     | 远程                        |
| 13 | 引力压制  | `yinliyazhi`        | 全能 | 单体     | 远程                        |
| 14 | 等离子屏障 | `denglizipingzhang` | 全能 | 全体     | 远程                        |
| 15 | 虚空冲击  | `xukongchongji`     | 全能 | 单体     | 远程                        |
| 16 | 冲锋    | `chongfeng`         | 格斗 | 单体     | 近身                        |
| 17 | 狂怒一击  | `kuangnuji`         | 格斗 | 单体     | 近身                        |
| 18 | 连续攻击  | `lianxu`            | 格斗 | 单体 ×3  | 近身                        |
| 19 | 精神攻击  | `jingsheng`         | 射击 | 单体     | 远程                        |
| 20 | 禁锢    | `jingu`             | 射击 | 单体     | 远程                        |
| 21 | 舍身一击  | `shenshen`→`sheshen` | 射击 | 单体     | 远程                        |
| 22 | 干扰攻击  | `ganrao`            | 全能 | 单体     | 远程                        |
| 23 | 回路干扰  | `huiluganrao`       | 全能 | 单体     | 远程                        |
| 24 | 急速攻击  | `jisu`              | 通用 | 单体     | **远程 or 近身，根据武器是不是枪械；没准备枪械就都是近身** |
| 25 | 生命摄取  | `shengmingshequ`    | 通用 | 单体     | 远程                        |
| 26 | 能量榨取  | `zhaqu`             | 通用 | 单体     | 远程                        |
| 27 | 纳米攻击  | `leiting`           | 全能 | 全体     | 远程                        |
| 28 | 弱点攻击  | `ruodian`           | 射击 | 单体     | 远程                        |
| 29 | 能量护盾  | `nenglianghudun`    | 全能 | 自身/己方  | 远程                        |
| 30 | 信念盾   | `xinniandun`        | 全能 | 自身/己方  | 远程                        |
| 31 | 紧急修理  | `xiuli`             | 通用 | 自身/己方  | 远程                        |
| 32 | 生命恢复  | `life_recover`      | 通用 | 被动     | （未填 → `none`）             |
| 33 | 能量恢复  | `energy_recover`    | 通用 | 被动     | （未填 → `none`）             |
| 34 | 纳米侵蚀  | `nami_qinshi`       | 射击 | 全体     | 远程（用户注：「这个也是远程群体」）        |
