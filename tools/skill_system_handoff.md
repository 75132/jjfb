# JJFB 技能制作系统 · 交接文档

> **文档版本**：2026-09-30 · v1
> **交接对象**：接手「技能制作系统」的专用 AI / 开发者
> **工程根目录**：`D:\jjfbol-cocos\jjfbol-cocos\jjfb`
> **当前状态**：**数据层 100% 完成并落库**；表现层（动画/特效）已通；**战斗结算尚未接管**（有意为之，见 §14）。
>
> 本文档自包含，读完即可独立接手。配套详表：`tools/skill_final_table.md`（技能总表 v11）、
> `server/docs/技能战斗数据-目标与公式.md`（公式与范围详表）、`tools/skill_list.md`（技能 × 动画对照）。

---

## 0. 快速上手（TL;DR）

| 问题 | 答案 |
|---|---|
| 技能数据的**权威源**在哪？ | `server/data/Skills.json`（version 3，34 条） |
| 客户端怎么拿？ | `assets/resources/json/Skills.json`（同源副本，带 `.meta`） |
| 战斗伤害算了吗？ | **没有**。服务端仍是 `max(1, atk - def)`，技能公式已就位但未接管 |
| 特效动画接了吗？ | **接了**。普攻在受击方播 `leiting` ×2，回合结束播恢复特效 |
| 数据改了怎么落库？ | 改 `tools/build_skill_table.py` 的 `META` 常量 → `python tools/build_skill_table.py --apply` |
| 一改就会踩的坑是什么？ | `Items.json` **有三份**；`Animation` 隐藏节点 `getState` 返回 null；`0 or max_hp` 静默满血 |

---

## 1. 环境与工具链

### 1.1 运行时（**必须用绝对路径**，不要用裸命令）

| 用途 | 路径 |
|---|---|
| Python（脚本/测试） | `C:/Users/Administrator/.workbuddy/binaries/python/versions/3.13.12/python.exe` |
| Node（TS 编译/自测） | `C:/Users/Administrator/.workbuddy/binaries/node/versions/22.22.2-3/node.exe` |
| pytest 依赖目录 | `<工程根>/.testdeps`（已 gitignore，需 `PYTHONPATH=.testdeps` 才能跑 pytest） |

> ⚠ 若 `.testdeps` 不存在（换机器 / 被清理），重建：
> ```bash
> cd "D:/jjfbol-cocos/jjfbol-cocos/jjfb"
> "C:/Users/Administrator/.workbuddy/binaries/python/versions/3.13.12/python.exe" -m pip install --quiet --target .testdeps pytest pytest-asyncio websockets python-dotenv
> ```

### 1.2 引擎

- **Cocos Creator 3.8.7**（`package.json` → `creator.version`）
- ⚠ 工程 `package.json` 有 **`"type": "module"`** → 所有 Node 侧脚本必须用 **`.cjs`** 扩展名，
  编译产物目录需放一个 `{"type":"commonjs"}` 的 `package.json`。

### 1.3 外部数据源（只读，勿改）

**RPG Maker MV 原工程**：`D:/机甲风暴开发素材合集/机甲风暴2/`

| 路径 | 内容 |
|---|---|
| `data/Skills.json` | 技能定义：`scope`（目标范围）/ `damage.formula` / `effects` / `mpCost` |
| `data/Items.json` | 技能书 id ↔ 技能 id 映射（0036–0056） |
| `data/Classes.json` | 职业属性成长曲线、`learnings`（自带技能） |
| `data/States.json` / `System.json` | 状态定义、属性名（`terms.params`）、元素表 |
| `js/rpg_objects.js` | **伤害结算链源码权威**（`makeDamageValue` / `applyVariance` / `applyCritical` / `applyGuard`） |
| `js/plugins/Z_skill.js` | **技能书职业限制**（3 条职业线分组） |
| `js/plugins/Z_SkillLevel.js` | **技能等级** Lv1–4 + 升级条件 + `SKILL_BOOK_MAP` |
| `js/plugins/Z_GamePlay.js` | **普攻三职业三公式**（覆写 `attackSkillId`）+ 自动恢复原型 |
| `js/plugins/Z_Xinglevel.js` | **悟性**（`_comprehension` 40–100）、升星成长 |
| `js/plugins/Z_MechEvolutionSystem.js` | 机甲进化门槛 |
| `js/plugins/Z_EquipmentClassRestriction.js` | 武器职业限制 |
| `img/animations/*.png` | 技能特效图集（转为本工程 AnimationClip 的源） |

---

## 2. 系统架构与数据流

```
┌─────────────────────────── RPG Maker MV 原工程（只读） ──────────────────────────┐
│  data/Skills.json · data/Items.json · js/rpg_objects.js · js/plugins/Z_*.js      │
└───────────────────────────────────┬──────────────────────────────────────────────┘
                                    │  tools/build_skill_table.py  (--apply 才写盘)
                                    ▼
                   ┌────────────────────────────────────┐
                   │  server/data/Skills.json  (权威)    │  ← 唯一手工维护入口
                   │  version 3 · 34 条 · skill_level    │
                   │  normal_attack · 每技能 extra_effects│
                   └───────┬────────────────────┬────────┘
                           │ cp                 │ 读取
                           ▼                    ▼
        ┌──────────────────────────┐   ┌──────────────────────────────────┐
        │ assets/resources/json/   │   │ server/services/skill_formula.py │
        │   Skills.json (+.meta)   │   │  AST 白名单求值器（不用 eval）    │
        │   ← 客户端 resources.load │   │  复刻 makeDamageValue 全链        │
        └───────────┬──────────────┘   └───────────────┬──────────────────┘
                    ▼                                   ▼
   assets/Script/Game/SkillData.ts        server/services/battle_room_service.py
   （纯逻辑：职业线/持枪/公式/等级判定）      （回合结算 · 被动恢复 · ⚠ 未接技能公式）
                    │                                   │
                    ▼                                   ▼
      assets/Script/Game/BattleScene.ts ──────► RobotShow.ts
      （回合编排 · 伤害表现 · 被动特效演出）      （playSkillEffect 技能光效 / 伤害数字 / 血蓝条）
                    │
                    ▼
      assets/Image/Skill/ani/*.anim（39 个 AnimationClip）
      assets/resources/Skill/*.png（539 帧图，最近邻 ×2）
```

**关键分工原则**：
- **服务端是权威**（HP / MP / 伤害结果）。客户端只做**表现**（用服务端回传的 HP 差播数字、播特效）。
- 任何伤害公式改动**必须两端同改**，否则显示与实际不一致。

---

## 3. 文件清单（按职责）

### 3.1 数据（权威 + 副本）

| 文件 | 角色 | 说明 |
|---|---|---|
| `server/data/Skills.json` | **权威** | version 3，34 条技能 + `skill_level` + `normal_attack` |
| `assets/resources/json/Skills.json` | 客户端副本 | 必须与上面**完全一致**；`.meta` uuid = `5f5cf69d-69f4-475c-9314-3c90910443d1` |
| `assets/resources/json/Items.json` | 客户端物品 | **83 条**（含新技能书 76–89），2 空格缩进 |
| `server/data/Items.json` | 服务端首选 | 同上 83 条，**全字段版** |
| `server/handlers/json/Items.json` | 服务端兜底 | 同上 83 条，**精简 6 字段版**（`id/name/effect/iconIndex/price/consumable/itypeId`） |
| `server/data/Classes.json` | 属性成长 | `note` 里含成长公式（lv1 MaxHP≈553、攻击≈355）—— 数值量级基准 |
| `server/data/battle_refs.json` | 战斗参考 | 属性/系数参考 |

> ⚠ **`Items.json` 有三份**，由 `server/config_loader.py` 按 `server/data/` → `server/handlers/json/` → `assets/resources/json/` 顺序查找。
> **只改一份必出两端不一致 bug。** 统一用 `tools/patch_items_skillbooks.py` 一次改三份。

### 3.2 客户端代码（TypeScript）

| 文件 | 职责 | 关键 API / 常量 |
|---|---|---|
| `assets/Script/Game/SkillData.ts` | **技能数据读取层**（纯逻辑，无 cc 依赖，可单测） | `resolveClassLine()` `isGunItemId()` `hasGunEquipped()` `resolveNormalAttack()` `evalSkillFormula()` `calcNormalAttackDamage()` `skillLevelMultiplier()` `applySkillLevel()` `rollAutoUpgrade()` `checkManualUpgrade()` |
| `assets/Script/Game/RobotShow.ts` | 单个机甲的表现组件 | `playSkillEffect(clipName, playCount, onDone?)` `stopSkillEffect(hide?)` `showDamageNumber(value, isHeal)` `updateBattleBars(hp, maxHp, mp?, maxMp?)` `resolveSkillNode()` |
| `assets/Script/Game/BattleScene.ts` | 战斗场景编排 | `NORMAL_ATTACK_SKILL_CLIP='leiting'`、`NORMAL_ATTACK_SKILL_REPEAT=2`、`PASSIVE_EFFECT_GAP=0.6`、`playPassiveRecoverEffects()`、`performAttack()`、`performAttackWithDamage()` |
| `assets/UIPrefab/RobotShow.prefab` | 预制体 | RobotShow 组件需绑定 `skillNode`（指向子节点 `Skill`）；`Skill` 节点**默认 active=false** |
| `assets/Script/Game/MechAttributeTEST.ts` | 机甲属性面板（参考） | 有 `Class` 字段的显示逻辑（1 格斗 / 2 射击 / 3 全能） |

### 3.3 服务端代码（Python）

| 文件 | 职责 | 关键位置 |
|---|---|---|
| `server/services/skill_formula.py` | **伤害结算链**（复刻 `rpg_objects.js`），AST 白名单求值器 | `eval_damage_formula()` `make_damage_value()` `apply_variance()` `apply_critical()` `apply_guard()` `item_cri()` `resolve_scope()` `CRITICAL_MULTIPLIER=3.0` |
| `server/services/battle_room_service.py` | 回合结算 / actor 构建 / 被动恢复 | `_build_actor_from_doc()`（L640）、`_exec_action()`（L1145，**⚠ 未接技能**）、`_apply_end_of_round_passives()`（L1165）、`_end_if_needed()`（L1223）、`PASSIVE_END_OF_ROUND`（L45） |
| `server/handlers/battle_handler.py` | PVE 战斗 handler | 敌方快照含 `Skills` |
| `server/handlers/battle_room_handler.py` | PVP 房间 handler | 同上 |

### 3.4 资产

| 路径 | 内容 | 数量 |
|---|---|---|
| `assets/Image/Skill/ani/*.anim` + `.anim.meta` | **技能 AnimationClip** | **39 个** |
| `assets/resources/Skill/{短名}-{k}.png` + meta | 帧图（最近邻 ×2 放大） | **539 帧** |
| `assets/UI/Skill_icon/SkillIcon.png` + `.plist` | **分类图标图集**（5 帧 32×32，整图 170×34） | 5 帧 |

**39 个 AnimationClip 名单**：
```
buff chaonengquan chongfeng debuff denglizidanmu denglizipingzhang diancifengbao
ganrao guangrenzhan huiluganrao jiguang01 jingsheng jingu jinji jisu kuangnu leiting
leitingchongji leitingzhenshe lianxu lizi lizijiguang nengliangbaopo nenglianghuifu
quan01 roubo ruodian shengminghuifu shengmingshequ sheshen shikongniuqu tecshan
xinniandun xiuli xukongchongji xukongdaodan yinliyazhi zhaqu zidong
```
> 技能表实际用 **32 个**；多余 7 个（`buff` `debuff` `jinji` `lizi` `roubo` `tecshan` `zidong`）为预留/未挂。

### 3.5 脚本（tools/）

| 脚本 | 职责 | 落盘开关 |
|---|---|---|
| `build_skill_table.py` | **主生成器**：RPG 源 → `server/data/Skills.json`（`META` 常量是唯一维护入口） | **默认 dry-run**，`--apply` 才写 |
| `build_skill_books.py` | 从 Skills.json 生成 14 本新技能书条目 → 预览 JSON | 默认 dry-run |
| `patch_items_skillbooks.py` | **三份 `Items.json` 同步**（+14 技能书 + 4 处 effect 修正） | 默认 dry-run，`--apply` 才写（自动备份到 `tools/_backup/`） |
| `skill_ani_port.py` | Gif 散帧 → `.anim`（24 个） | `--apply` |
| `rpg_anim_port.py` | RPG Maker 动画 → `.anim`（13 个）；`RPG` 常量 + `MAPPING`；复刻 MV `updateFrame` | `--dry / --only / --preview / --apply` |
| `skill_gif_preview.py` | 33 个技能 GIF 预览 + HTML 筛选页 | 直接产出到 `tools/_preview/` |
| `skill_gif_port.py` | GIF 素材接入 | — |
| `skill_icon_extract.py` | 解析 `SkillIcon.plist` → 切 5 个分类图标 + 放大对照图 | 产出 `tools/_preview/skill_icons/` |
| `convert_equipment_txt_to_json.py` | 装备 txt → json | — |
| `meta_backup_tool.py` | meta 备份 | — |
| `pack_cocos_project.py` | 工程打包 | — |

### 3.6 测试（**改完必跑**）

| 命令 | 覆盖 | 当前结果 |
|---|---|---|
| `python tools/_test_skill_formula.py` | 公式求值（含与 Node 原生 `eval` 逐条比对）+ 注入拦截 + variance/guard/暴击 | **87 / 87** |
| `python tools/_test_passive_recover.py` | 被动恢复（死亡空血优先 / 上限截断 / 端到端 PVE） | **45 / 45** |
| `node tools/_test_skilldata_client.cjs` | 客户端 SkillData 逻辑（职业线/持枪/公式/等级/升级） | **52 / 52** |
| `PYTHONPATH=".testdeps" python -m pytest server/tests -q` | 服务端回归 | **74 passed** |
| `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` | TS 类型检查 | **0 个非 MAP4 错误** |

> `.cjs` 自测依赖编译产物：`tools/_preview/sd/`（内含 `package.json {"type":"commonjs"}`）。
> 改了 `SkillData.ts` 后需重新编译：`node node_modules/typescript/bin/tsc assets/Script/Game/SkillData.ts --outDir tools/_preview/sd --target es2017 --module commonjs --skipLibCheck`

---

## 4. 数据 Schema 详解：`Skills.json`

### 4.1 顶层结构

```jsonc
{
  "version": 3,
  "source": "RPG Maker MV 机甲风暴2/data/Skills.json + js/rpg_objects.js + js/plugins/Z_*.js",
  "notes": [ /* 10 条口径说明，见文件 */ ],
  "skill_level": { /* 见 §7 */ },
  "normal_attack": { /* 见 §8 */ },
  "skills": [ /* 34 条，见 §5 */ ]
}
```

### 4.2 单条技能全字段（以「肉搏攻击」为例）

```jsonc
{
  "key": "roubo",                    // 稳定英文短名（脚本/存档用，勿随意改）
  "name": "肉搏攻击",                 // 中文名
  "book_id": 36,                     // 技能书 item id（null = 无书，悟性技）
  "rpg_skill_id": 3,                 // RPG Skills.json 的 id（null = 本工程新增）
  "type": "格斗",                     // 风格标签（格斗/射击/全能/通用）—— 与可学职业是两个维度
  "category": "skill_1",             // 分类图标（见 §6）
  "anim": "quan01",                  // 特效 AnimationClip 名（对应 Image/Skill/ani/{anim}.anim）
  "classes": "fighter",              // 可学职业线（见 §6.3）
  "classes_desc": "格斗",
  "mp_cost_percent": 25,             // 能量消耗（占最大 MP 百分比）
  "mp_cost_percent_desc": "25%（最多 4 次）",
  "lv_auto": true,                   // 是否可自动升级
  "lv_manual": true,                 // 是否可手动升级（花技能书）
  "extra_effects": [],               // ★ 预留：后续额外效果（灼烧/眩晕/护盾值…）

  // ---- 来自 RPG 原工程 ----
  "scope": 1,                        // RPG 目标范围码（见 §4.3）
  "target": "single",                // single / all / multi / none
  "side": "enemy",                   // enemy / ally / ally_dead / self / none
  "scope_desc": "单体敌人",
  "damage_type": "hp_damage",        // hp_damage / mp_damage / hp_drain / mp_drain / hp_recover / mp_recover / none
  "formula": "a.atk * 5 - b.def * 1 + 2000",  // MV 表达式，a=攻方 b=守方
  "variance": 20,                    // 伤害浮动 ±20%（三角分布）
  "critical": true,                  // 是否可暴击（×3.0）
  "mp_cost_rpg": 2043,               // ⚠ 原工程 mpCost（废弃值，仅溯源）
  "repeats": 1,                      // 攻击段数
  "success_rate": 100,
  "hit_type": 0,
  "effects": [ /* 原工程效果数组（code/kind/param/value1/value2） */ ],

  // ---- 溯源标记 ----
  "data_source": "rpg",              // rpg = 原工程原样搬 / new = 本工程新增
  "formula_source": "rpg"            // rpg / recommended（推荐值）/ todo（待定）
}
```

**本工程新增技能额外字段**：`scope_source: "proposed"`（scope 为建议值）。
**可选字段**：`trigger`（`end_of_round` 被动触发）、`restore_ratio`（恢复比例）、`note`、`reference_only`、`innate`。

### 4.3 `scope` 语义（RPG Maker MV）

| scope | target | side | 含义 |
|---|---|---|---|
| 0 | none | none | 无目标 |
| 1 | single | enemy | 单体敌人 |
| 2 | **all** | enemy | **全体敌人** |
| 3 | single | enemy | 随机 1 名 |
| 4/5/6 | multi | enemy | 随机 2/3/4 名 |
| 7 | single | ally | 单体己方（含自己） |
| 8 | all | ally | 全体己方 |
| 9/10 | single/all | ally_dead | 己方倒下单位（复活类） |
| 11 | single | self | 自身 |

### 4.4 `damage_type` 语义

`0=none` `1=hp_damage` `2=mp_damage` `3=hp_drain`（吸血）`4=mp_drain`（吸蓝）`5=hp_recover` `6=mp_recover`

---

## 5. 技能总表（34 条）

> 完整分组表见 `tools/skill_final_table.md`。以下为**索引**。

### 5.1 按职业线分组

**格斗线（8 个）**：肉搏攻击 0036｜光刃斩 0037｜超能拳 0038｜雷霆震慑 0039｜火焰风暴 0040（**群**）｜冲锋 0076★｜狂怒一击 0077★｜连续攻击 0078★（3 段）

**射击线（8 个）**：雷霆冲击 0041｜离子激光 0042｜等离子弹幕 0043（**群**）｜虚空导弹 0044｜能量爆破 0045｜精神攻击 0079★｜禁锢 0080★｜舍身一击 0081★

**全能线（9 个）**：电磁风暴 0046｜时空扭曲 0047（**群**）｜能量护盾 0048（己方）｜引力压制 0049（己方）｜等离子屏障 0050（**群**，固定 2500）｜虚空冲击 0051（固定 2000）｜干扰攻击 0082★｜回路干扰 0083★｜信念盾 0084★（己方）

**三线通用（7 个）**：紧急修理 0085★（己方）｜急速攻击 0086★｜生命摄取 0087★（吸血）｜能量榨取 0088★（吸蓝）｜生命恢复 0055（skill_3 被动）｜能量恢复 0089★（skill_3 被动）｜**纳米侵蚀 0056（群，★2026-10-01 由参考项开放为所有职业可学）**

**悟性技能（2 个，不可学）**：纳米攻击（**群**，无书，skill_4）｜弱点攻击（无书，skill_4）

**参考项（0 个）**：~~纳米侵蚀 0056~~ —— ★2026-10-01 用户拍板「纳米侵蚀开放所有可学习」→ 已转为**普通主动攻击技能**（`classes: all` / `category: skill_1` / `mp_cost_percent: 20`），`reference_only` **全表已无条目**（机制与分支保留）。

> ★ = 本工程新增（`data_source: "new"`），共 **16 个**：
> 13 个 `skill_1` + 1 个 `skill_3`（能量恢复）+ 2 个 `skill_4`（纳米攻击 / 弱点攻击）。
> 用户口径里的「15 条新增技能公式」= 这 16 个去掉**无伤害公式**的能量恢复（13 + 2 = 15）。
>
> 数据构成：34 条 = `data_source: "rpg"` **18 条**（16 技能书 + 生命恢复 0055 + 纳米侵蚀 0056）
> + `data_source: "new"` **16 条**。

### 5.2 按范围统计

| 范围 | 数量 | 技能 |
|---|---|---|
| **群体**（敌方全体） | **6** | 火焰风暴、等离子弹幕、时空扭曲、等离子屏障、纳米攻击、纳米侵蚀（★2026-10-01 开放） |
| 单体 · 敌方 | 22 | 其余攻击技 |
| 己方 / 自己 | 6 | 能量护盾、信念盾、紧急修理、引力压制、生命恢复、能量恢复 |
| 固定值伤害 | 2 | 等离子屏障 `2500`（群）、虚空冲击 `2000`（单） |
| 纯效果无伤害 | 4 | 能量护盾、引力压制、信念盾、紧急修理 |

### 5.3 能量消耗分档（用户定稿：**按最大 MP 百分比**）

| 档 | 消耗 | 满能量可放 | 技能 |
|---|---|---|---|
| 顶级 | **25%** | 4 次 | 肉搏攻击、等离子屏障、虚空冲击、舍身一击、纳米攻击 |
| 高阶 | **20%** | 5 次 | 光刃斩、雷霆震慑、火焰风暴、等离子弹幕、能量爆破、时空扭曲、狂怒一击、弱点攻击 |
| 中阶 | **16%** | 6 次 | 超能拳、雷霆冲击、离子激光、虚空导弹、电磁风暴、能量护盾、引力压制、信念盾 |
| 低阶 | **14%** | 7 次 | 冲锋、连续攻击、精神攻击、禁锢、干扰攻击、回路干扰、紧急修理、急速攻击、生命摄取、能量榨取 |
| 无 | **0%** | — | 生命恢复、能量恢复（自动触发） |

> ⚠ **原工程 `mpCost` 全是 2000，是废弃值**（原工程满 MP 只有几十点）→ 已降级为 `mp_cost_rpg` 仅溯源，**不要照搬**。
> 新口径依据：本工程新手机甲 `MaxMP = 300`，「最强放 4 次、最弱放 7 次」。

---

## 6. 分类 / 图标系统

### 6.1 五个分类图标（`assets/UI/Skill_icon/SkillIcon.plist`，5 帧 32×32）

| 序 | 帧名 | 图案 | 语义 | spriteFrame uuid |
|---|---|---|---|---|
| 1 | `skill_1` | **主**（红） | 主动学习 · 攻击技能 | `c7533286-bd2d-4dde-b3d3-7680ef444383@bf082` |
| 2 | `skill_2` | **被**（蓝） | 主动学习 · 被动技能 | `c7533286-bd2d-4dde-b3d3-7680ef444383@9d75b` |
| 3 | `skill_3` | **自**（黄） | 主动学习 · 自动触发技能 | `c7533286-bd2d-4dde-b3d3-7680ef444383@636fd` |
| 4 | `skill_4` | **悟**（红） | 升级概率习得 · 悟性攻击技能 | `c7533286-bd2d-4dde-b3d3-7680ef444383@82bb1` |
| 5 | `skill_5` | **悟**（蓝） | 升级概率习得 · 悟性被动技能 | `c7533286-bd2d-4dde-b3d3-7680ef444383@dee53` |

> 图集 uuid：`c7533286-bd2d-4dde-b3d3-7680ef444383`（plist，atlas）
> 贴图 uuid：`7e45e506-9181-4d41-936d-1cda5f72c0b6`（png，texture `@6c48a`）

配色规律：**红 = 攻击 / 蓝 = 被动 / 黄 = 自动触发**；「悟」= 悟性线。

### 6.2 当前分布

| category | 数量 | 技能 |
|---|---|---|
| `skill_1` 主动学习·攻击 | **30** | 16 本技能书 + 补充 13 个 + 纳米侵蚀（原 `ref`，★2026-10-01 转正） |
| `skill_2` 主动学习·被动 | **0** | 空 |
| `skill_3` 自动触发 | **2** | 生命恢复、能量恢复 |
| `skill_4` 悟性攻击 | **2** | 纳米攻击、弱点攻击 |
| `skill_5` 悟性被动 | **0** | 空 |
| `ref` 参考项 | **0** | 空（纳米侵蚀已于 2026-10-01 转 `skill_1`） |

> **口径**：「被动」(`skill_2`/`skill_5`) 单指**常驻生效、既不施放也不触发**的那类；
> 生命恢复 / 能量恢复是**每回合自动触发** → 归 `skill_3`，**不是** `skill_2`。
>
> ⚠ **图标资源不在 `resources/` 下** → 运行时不能 `resources.load`，只能编辑器拖 SpriteFrame。
> 要动态加载需把 `SkillIcon.png` + `.plist`（+meta）复制到 `assets/resources/UI/Skill_icon/`。
>
> ⚠ `0036–0051` 十八本技能书的 `iconIndex` **全是占位 `IconSet2-232`**（同一图标），尚未接入分类图标。

---

## 7. 技能等级（来源 `Z_SkillLevel.js`，原样搬）

### 7.1 规则

| 项 | 值 |
|---|---|
| 最高等级 | **Lv4** |
| 倍率 | `[1.0, 1.2, 1.3, 1.5]` → Lv1 ×1.0 / Lv2 ×1.2 / Lv3 ×1.3 / Lv4 ×1.5 |
| 取整 | `Math.floor(baseDamage × multiplier)` |
| 作用对象 | **伤害结果**（原插件在 `makeDamageValue` 里乘算）；治疗 / 护盾是否随等级提升**原插件未定义** |
| 记录粒度 | **每个机甲对每个技能独立记录等级** |

### 7.2 升级途径

| 途径 | 条件 |
|---|---|
| **自动升级** | 机甲升级时逐个已学技能独立判定；概率 = `悟性 / 100 × 0.1` → 悟性 40~100 时 **4%~10%**；只有未满 Lv4 才判定 |
| **手动升级** | 花技能书 + 达到机甲等级：Lv2 = **1 本 + 25 级**｜Lv3 = **2 本 + 40 级**｜Lv4 = **3 本 + 50 级** |

> ⚠ **原插件注释与代码不一致**：插件 help 写「comprehension×10%」，代码实际是 `comprehension/100*0.1`
> → **4%~10%**（不是 400%~1000%）。**以代码为准**，已按代码落地。

### 7.3 各类技能的等级开关

| 类别 | lv_auto | lv_manual | 数量 | 原因 |
|---|---|---|---|---|
| `skill_1` 主动攻击 / 辅助 | ✅ | ✅ | 29 | 都有技能书 |
| `skill_3` 自动触发 | ❌ | ❌ | 2 | 原工程技能 29 不在 `SKILL_BOOK_MAP` → 不可升（**要开需用户点头**） |
| `skill_4` 悟性 | ✅ | ❌ | 2 | 无技能书，只能靠升级自动提升 |

---

## 8. 普通攻击：三职业三公式（来源 `Z_GamePlay.js` 覆写 `attackSkillId`）

**装备枪械类武器（武器 id 28–51）时**，同一个普攻按钮按职业线打出不同公式：

| 职业线 | 等价 RPG 技能 | 公式 | 前置条件 |
|---|---|---|---|
| 格斗 `fighter` | 技能 1（默认普攻） | `a.atk * 3 - b.def * 1 + 1000` | 无（不持枪也是它） |
| 射击 `shooter` | 技能 11 | `a.atk * 2.5 - b.def * 1 + 1000` | **需持枪**（id 28–51） |
| 全能 `universal` | 技能 12 | `a.atk * 3.5 - b.def * 1 + 1200` | **需持枪**（id 28–51） |

**职业字段来源**：角色文档里的 `Class`（`1` 格斗 / `2` 射击 / `3` 全能）。
客户端读取点：`BattleScene.ts` L889 / L1257 / L1551（`playerRaw?.Class ?? playerRaw?.data?.Class ?? 1`）。

### ⚠⚠ 接入警戒：配置已写好但**默认关闭**

`Skills.json` → `normal_attack.enabled = false`。

**原因**：原公式是「高倍率 + 大常数」（如格斗 `atk×3 + 1000`），对应原工程**属性数千**的量级；
本工程 `Classes.json` 成长（**lv1 MaxHP≈553、攻击≈355**）量级小得多 →
**直接接管会让低等级普攻逼近一击必杀**。

**开启前提**：先定「公式缩放口径」——例如整体除以 K，或只取倍率去掉大常数。
开启时**必须两端同改**（服务端 `_exec_action` + 客户端 `performAttack`），否则显示与实际不一致。

关闭状态下：服务端普攻仍为 `max(1, attack - defense)`，客户端表现不变。

---

## 9. 职业机制核查（6 处）

### 9.1 可跨职业学习 —— 全工程只有 1 本

来源 `Z_skill.js`：

`Z_skill.js` 原文（第 22–24 行）：

```js
const FIGHTER_BOOKS   = [36, 37, 38, 39, 40, 55];
const SHOOTER_BOOKS   = [41, 42, 43, 44, 45, 55];
const UNIVERSAL_BOOKS = [46, 47, 48, 49, 50, 51, 55];
```

| 技能书 | 可学职业线 |
|---|---|
| 0036–0040 | **仅格斗线** |
| 0041–0045 | **仅射击线** |
| 0046–0051 | **仅全能线** |
| **0055（生命恢复）** | **三线通用** ← 原工程唯一跨职业书（同时在三个白名单里） |
| **0056（纳米侵蚀）** | **三线通用** ← ★2026-10-01 用户拍板开放（`classes: "all"`，原为射击专属参考项） |
| 新增 0076–0089 | 原插件无此段白名单，按本工程 `classes` 字段执行 |

> **新增 0076–0089** 按技能定位归属；其中标 `classes: "all"`（三线通用）的 5 个：
> 紧急修理、急速攻击、生命摄取、能量榨取、**能量恢复**。
>
> **三线职业 ID 分组**（`Z_skill.js` / `Z_GamePlay.js` / `Z_ShuxingWindow.js` 三处一致）：
> - 格斗 fighter：1–3, 19–24, 28–30, 37–39, 46–51, 61–63, 70–75, 82–84, 97–99
> - 全能 universal：7–9, 13–18, 34–36, 43–45, 55–60, 64–66, 79–81, 85–87, 91–93
> - 射击 shooter：4–6, 10–12, 25–27, 31–33, 40–42, 52–54, 67–69, 76–78, 88–90, 94–96

### 9.2 释放效果不一样 —— 就是「普通攻击」

见 §8。`Z_GamePlay.js` 第 17–24 行覆写 `attackSkillId`：同一个普攻按钮，三条线三种公式。

### 9.3 其余 4 处

| 机制 | 来源 | 规则 |
|---|---|---|
| 悟性学技能 | `Z_Xinglevel.js` | 全局固定学**一个**技能；⚠ 原插件 `Math.random()*10 < 悟性(40~100)` **恒真** → 每次升级必学；语义应为「悟性% 概率」 |
| 技能等级 | `Z_SkillLevel.js` | 见 §7 |
| 机甲进化门槛 | `Z_MechEvolutionSystem.js` | 中级进化需**等级 25 + 已学技能 8**；终极进化需**等级 45 + 已学技能 9** |
| 武器职业限制 | `Z_EquipmentClassRestriction.js` | 格斗 = 重/轻武器；全能 = 轻武器 + 轻机枪；射击 = 重机枪 + 轻机枪 |

### 9.4 ⚠ 归属修正（教训）

**电磁风暴（0046）**：技能名和特效都是射击风，但 `Z_skill.js` 把它归在**全能书**（0046–0051）
→ 原工程里**只有全能线能学**。已修正 `classes: "universal"`（`type` 字段仍记射击，是风格标签）。

> **教训**：**可学职业看技能书号，不看技能名。**

---

## 10. 被动恢复（生命恢复 / 能量恢复）

### 10.1 实现位置

**服务端**（权威）：`server/services/battle_room_service.py`

| 位置 | 内容 |
|---|---|
| L45 `PASSIVE_END_OF_ROUND` | 配置表：`attr` / `max` / `ratio: 0.15` / `flat` / `anim` |
| L65 `PASSIVE_SKILL_ALIASES` | 别名表（中文名 / 拼音短名 → 技能 ID） |
| L75 `resolve_passive_skill_id()` | 归一化 Skills 数组里的项 |
| L1165 `_apply_end_of_round_passives()` | 结算主体，结果写 `room["round_passive_effects"]` |
| L915 / L969 | **调用点**：PVE / PVP 两处，**必须在 `_end_if_needed()` 之后** |

**客户端**（表现）：`BattleScene.ts` → `playPassiveRecoverEffects()`（L2357），
在攻击动画后、胜负收尾前演出恢复特效 + 治疗数字 + 血蓝条（间隔 `PASSIVE_EFFECT_GAP = 0.6s`）。

### 10.2 核心规则

- **数值**：`amount = floor(属性上限 × ratio) + flat`，至少 1 点，不能超上限。**`ratio = 0.15`（15%）**。
- **触发时机**：回合结束（双方出手 → **死亡判定** → 仍存活才结算）。
- **⚠ 死亡空血优先**：`hp <= 0` 的单位**一律跳过** —— 恢复永远不会把已倒下的单位拉回来（不存在复活）；
  战斗已结束（`status == "finished"`）时**整体不结算**。
- 兼容 `Skills` / `skills` / `LearnedSkills` 三种写法；兼容中文名直接写进数组。

### 10.3 ⚠⚠ 已修 bug：`0 or max_hp` 静默满血

`_build_actor_from_doc()` 里读 `CurrentHP` 时**绝不能用 `or` 回填**：

```python
# ❌ 错：CurrentHP=0（空血/已倒下）被当成"字段缺失" → 变成满血（静默复活）
hp = int(doc.get("CurrentHP") or max_hp)

# ✅ 对：显式判空 + clamp
hp_raw = doc.get("CurrentHP", doc.get("current_hp"))
hp = int(hp_raw) if hp_raw is not None and str(hp_raw).strip() != "" else max_hp
hp = max(0, min(hp, max_hp))
```

> 同一 bug 在 `battle_handler.py` / `battle_room_handler.py` 也已修。**任何新读数值的代码都要照此写。**

---

## 11. 动画系统

### 11.1 AnimationClip 结构（Cocos 3.x）

7 元素的 JSON 数组：

| 索引 | 内容 |
|---|---|
| `[0]` | `{"__type__":"cc.AnimationClip","_name":..., "_duration":..., "wrapMode":..., "sample":...}` |
| `[5]` | `{"__type__":"cc.animation.ObjectTrack","_times":[...], "_values":[{"__uuid__":"<spriteFrame uuid>"}, ...]}` |

**引用帧图**：`spriteFrame.subMetas.f9941.uuid`。

**`.anim.meta` 结构**：`imported: false` + 空 `subMetas` → 编辑器自动补全 texture / spriteFrame / `f9941`。

### 11.2 ⚠⚠ 关键坑：隐藏节点 state = null

**Animation 组件的 `__preload` 只在节点 `active = true` 时才为 `_clips` 逐个 `createState`。**
Skill 节点默认 `active = false` → `getState(name)` 返回 `null` → 动画永远播不出来。

**正确顺序**：`node.active = true` → 再 `getState()` → 再 `play()`；并留 `createState` 兜底。
见 `RobotShow.playSkillEffect()`（L590–673，含 FINISHED 监听 + 时长兜底 `scheduleOnce`）。

### 11.3 RPG Maker MV 动画转换（`rpg_anim_port.py`）

- 源：`data/Animations.json` + `img/animations/*.png`
- `pattern >= 100` 表示第二个图集（索引 = `pattern - 100`）
- ⚠ **本工程图集非标准 5×4** —— 实测为**定尺 192×192**（列 = W/192，行 = H/192），`nmqs` 例外
- 复刻 MV `updateFrame`：`translate → rotate → mirror → alpha → blendMode(加算/乘数/屏幕) → drawImage`
- 帧时长：4 tick @ 60fps = **0.0667s**

### 11.4 GIF 预览（`skill_gif_preview.py`）

- 输出 `tools/_preview/skill_gifs/`（33 个技能 GIF，**文件名 = 技能名**）+ `skill_preview.html` 筛选页
- ⚠ **GIF 时长量化**：10ms 量化直接取整会累积偏差（64 帧 +213ms）→ 必须**按累积误差分配**。

### 11.5 已挂 / 未挂

| 技能 | 动画 | 说明 |
|---|---|---|
| 普攻 | `leiting` ×2 | 在**受击方**播放（敌我通用：谁挨打谁播），命中瞬间触发 |
| 生命恢复 / 能量恢复 | `shengminghuifu` / `nenglianghuifu` | 回合结束被动演出 |

> ⚠ **Skill 节点的播放列表（`Animation.clips`）需要手动挂全部动画**（含新增的
> `shengminghuifu` / `nenglianghuifu`）——否则只出数字无光效。这是编辑器操作，脚本无法代劳。

---

## 12. 战斗接入现状

| 环节 | 位置 | 现状 |
|---|---|---|
| 伤害结算 | `battle_room_service._exec_action()` L1145 | ❌ **仍是临时** `max(1, attack - defense)`，无技能概念 |
| 技能公式 | `skill_formula.py` | ✅ 已就绪（AST 白名单求值器，复刻 `makeDamageValue` 全链） |
| 回合编排 | `BattleScene.ts` | ✅ 已通（行动条、双方出手、动画、伤害数字） |
| 技能光效 | `RobotShow.playSkillEffect()` | ✅ 已通 |
| 被动恢复 | `_apply_end_of_round_passives()` | ✅ 已通 |
| 房间规模 | — | ⚠ 当前 **1v1**；`scope=2`（群体）会退化成单体 |
| 主动技能 UI | `BattleScene.ts` + `SkillSelectPanel.ts` | ✅ 已通（战斗面板「技能」按钮 → `SkillSelect` 面板选技 → 确认施放，见 §21） |

**接入要动的地方**（按依赖顺序）：
1. `ActionType` 扩成可携带 `skill_key` 的指令 —— ✅ 已完成（`castSkill()` + `{type:'SKILL', skill_key}`）
2. `_exec_action` 改查 `Skills.json` → 调 `make_damage_value()` —— ✅ 已完成
3. `_exec_action` 也要处理 `mp_cost_percent` 扣蓝与「蓝不够不能放」 —— ✅ 已完成
4. 群体 / 己方目标：把 `resolve_scope()` 的结果映射到房间单位（当前 1v1 需先扩多单位）
5. 客户端 `BattleScene` 加技能选择 UI → 发指令 → 用服务端回传 HP/MP 差做表现 —— ✅ 已完成（§21）
6. `Skills` 数组目前**同时兼「已学技能」和「被动解锁」** → 建议拆出 `PassiveSkills`

---

## 13. 技能书与物品

### 13.1 ⚠ 编号冲突修正

用户原定 `0057–0070`，但 `Items.json` 里 **已被占用**：

- **0057** = 还原晶体（`PET_RESET`，售价 10000）
- **0058–0075** = 18 个机甲核心（铁壁 / 鹰眼 / 钢板 …克努核心）

→ 新增技能书改排 **0076–0089**（紧接当前最大 id 75）。**编号变了，内容不变。**

> **教训**：**排 id 前必须先扫现有 id 占用**，不能只看「往下排」。

### 13.2 技能书号总表

| 书号 | 技能 | 线 | 状态 |
|---|---|---|---|
| 0036–0051 | 16 本技能书（见 §5.1） | 格斗 5 / 射击 5 / 全能 6 | Items.json 已存在 |
| 0055 | 生命恢复 | 三线通用 | 已存在（原工程名「技能书-自动恢复」） |
| 0056 | 纳米侵蚀 | **三线通用**（原射击） | 已存在；★2026-10-01 开放所有职业可学 |
| **0076–0089** | 冲锋 / 狂怒一击 / 连续攻击 / 精神攻击 / 禁锢 / 舍身一击 / 干扰攻击 / 回路干扰 / 信念盾 / 紧急修理 / 急速攻击 / 生命摄取 / 能量榨取 / 能量恢复 | 见 §5.1 | **已新增**（三份同步） |

### 13.3 物品字段结构

```jsonc
// 全字段版（assets/resources/json/ + server/data/）
{ "id": 76, "name": "技能书-冲锋", "effect": "冲锋", "iconIndex": "IconSet2-232",
  "price": 2000, "consumable": true, "itypeId": 1,
  "UsageTarget": "Pet", "CanStack": true, "StackLimit": 64, "effecttext": "冲锋" }

// 精简版（server/handlers/json/）
{ "id": 76, "name": "技能书-冲锋", "effect": "冲锋", "iconIndex": "IconSet2-232",
  "price": 2000, "consumable": true, "itypeId": 1 }
```

### 13.4 顺带修正的历史数据错误（已改）

| id | 原值 | 现为 |
|---|---|---|
| 0036 技能书-肉搏攻击 | `effect: "会心一击"` | `肉搏攻击` |
| 0039 技能书-雷霆震慑 | `effect: "虚空踢"` | `雷霆震慑` |
| 0055 / 0056 | `effect: "光刃斩"`（占位） | `自动恢复` / `纳米侵蚀` |

另：`server/handlers/bag_handler.py` 的「Items.json 加载失败兜底 id 范围」由 `1-75` → **`1-89`**。

---

## 14. 已完成 / 未完成

### ✅ 已完成

| 项 | 产物 |
|---|---|
| 技能数据表（34 条，含范围/公式/能量/职业/等级开关） | `server/data/Skills.json` v3 |
| 客户端同源副本 + meta | `assets/resources/json/Skills.json` |
| 伤害结算链复刻（AST 求值器） | `server/services/skill_formula.py` |
| 客户端技能数据层 | `assets/Script/Game/SkillData.ts` |
| 14 本新技能书 + 4 处 effect 修正（三份同步） | 三份 `Items.json`（各 83 条） |
| 39 个技能 AnimationClip + 539 帧图 | `assets/Image/Skill/ani/`、`assets/resources/Skill/` |
| 普攻特效接入（受击方 `leiting` ×2） | `BattleScene.ts` + `RobotShow.ts` |
| 被动恢复（生命/能量，死亡空血优先） | 服务端 + 客户端表现 |
| 技能等级规则 + 普攻三公式配置 | `Skills.json` 的 `skill_level` / `normal_attack` |
| 5 个分类图标切图 + 对照图 | `tools/_preview/skill_icons/` |
| 33 个技能 GIF 预览 | `tools/_preview/skill_gifs/` + `skill_preview.html` |
| 机甲面板技能栏（`MechSkill` + `MechSkillPanel`） | 图标 / 技能名 / 等级，槽位不足自动 y−50 克隆 |
| **战斗内技能选择面板**（`SkillSelect` + `SkillSelectPanel`） | 「技能」按钮 → 选技 → `Confirm`（选中才出现）→ 施放；0/30s 超时自动关面板普攻（§21） |
| 技能图标加载器（两面板共用） | `assets/Script/Game/SkillIconAtlas.ts` |
| 全套自测 | 87/87 · 46/46 · 54/54 · 100/100 · 80/80 · 178/178 · pytest 88 · tsc 0 错误 |

### ⏸ 未完成（按优先级）

| # | 待办 | 依赖 / 说明 |
|---|---|---|
| 1 | 群体技能落地（房间 1v1 → 多单位） | 服务端房间模型改造 |
| 2 | 技能**升级** UI（`skill_level_up` 接口已就绪） | UI 由用户自制后再叫我接入 |
| 3 | buff / 状态类效果（层数 / 持续回合 / 强度） | 现仅记 `pending_effects`，口径待用户拍板 |
| 4 | `extra_effects` 具体效果（灼烧 / 眩晕 / 护盾值…） | 结构已预留，等用户给需求 |
| 5 | 生命/能量恢复是否开放升级 | 待用户点头（现 `lv_auto`/`lv_manual` 都 false） |
| 6 | 治疗 / 护盾是否吃技能等级倍率 | 原插件未定义 |
| 7 | MP 是否跨战斗持久化 | 目前只回写 `CurrentHP` |
| 8 | `Skill` 节点播放列表补齐全部动画 | **编辑器手工操作** |
| 9 | 分类图标接入物品栏（`iconIndex` 仍是占位） | 图集已在 `assets/resources/SkillIcon/` |
| 10 | 两个孤立 gif（`shengmingshequ_xg2`、`zhaqu_xg2`）是否清理 | 待定 |
| 11 | 长动画是否压缩 | 用户已定：**不压缩**（虚空导弹 4.27s 原速保留） |

---

## 15. 铁律与坑（**接手必读，逐条都是踩过的**）

| # | 坑 | 正确做法 |
|---|---|---|
| 1 | **`Items.json` 有三份** | 只改一份必不一致 → 用 `patch_items_skillbooks.py` 一次改三份 |
| 2 | **`Animation` 隐藏节点 `getState` 返回 null** | 先 `node.active = true`，再 `getState()`；留 `createState` 兜底 |
| 3 | **`0 or max_hp` 静默满血** | 数值回填一律**显式判空 + clamp**，绝不用 `or` |
| 4 | **排 id 前不扫占用** | 先 `Items.json` 全量 id 扫一遍再排（0057–0075 冲突教训） |
| 5 | **职业归属看名字** | **看书号**（电磁风暴教训） |
| 6 | **RPG 图集套标准 5×4** | 实测**定尺 192×192**，先量再切 |
| 7 | **GIF 时长直接取整** | 按**累积误差分配**（64 帧差 +213ms） |
| 8 | **原插件注释信以为真** | 悟性概率 / 技能等级倍率**以代码为准**（注释与代码不一致） |
| 9 | **原工程 `mpCost` 照搬** | 原值是废弃的 2000 → 已降级 `mp_cost_rpg`，用 `mp_cost_percent` |
| 10 | **数值量级不核对** | 原工程属性数千 vs 本工程 lv1 ≈ 553 → 直接接管会一击必杀 |
| 11 | **工程 `type: module`** | Node 脚本用 `.cjs`；编译产物目录放 `{"type":"commonjs"}` |
| 12 | **改完不跑测试** | 至少跑 §3.6 的 5 条命令 |
| 13 | **禁删归档** | 备份只移不乱删；数据落地优先备份到 `tools/_backup/` |
| 14 | **并行编辑同一文件** | 有竞态风险，串行改 |

---

## 16. 修改工作流 SOP

### 16.1 改技能数据（最常见）

```bash
cd "D:/jjfbol-cocos/jjfbol-cocos/jjfb"

# 1. 改 tools/build_skill_table.py 里的 META 常量（唯一维护入口）
# 2. 演练（不写盘）
"C:/Users/Administrator/.workbuddy/binaries/python/versions/3.13.12/python.exe" tools/build_skill_table.py

# 3. 确认输出无误 → 写盘
"C:/Users/Administrator/.workbuddy/binaries/python/versions/3.13.12/python.exe" tools/build_skill_table.py --apply

# 4. 同步客户端副本
cp server/data/Skills.json assets/resources/json/Skills.json

# 5. 回归
"C:/Users/Administrator/.workbuddy/binaries/python/versions/3.13.12/python.exe" tools/_test_skill_formula.py
"C:/Users/Administrator/.workbuddy/binaries/python/versions/3.13.12/python.exe" tools/_test_passive_recover.py
node tools/_test_skilldata_client.cjs
PYTHONPATH=".testdeps" "C:/Users/Administrator/.workbuddy/binaries/python/versions/3.13.12/python.exe" -m pytest server/tests -q
```

### 16.2 改物品 / 技能书

```bash
python tools/build_skill_books.py            # 生成预览 → tools/_preview/skill_books_patch.json
python tools/patch_items_skillbooks.py       # 演练（三份一起）
python tools/patch_items_skillbooks.py --apply   # 写盘（自动备份到 tools/_backup/）
```

### 16.3 加新技能动画

1. 准备 GIF / 帧序列 → `tools/skill_gif_port.py` 或 `rpg_anim_port.py`
2. 生成 `.anim` + `.anim.meta` 到 `assets/Image/Skill/ani/`
3. 帧图落 `assets/resources/Skill/{短名}-{k}.png`
4. **编辑器**：把新 clip 拖进 `RobotShow.prefab` → `Skill` 节点的 `Animation.clips` 列表
5. 在 `tools/build_skill_table.py` 的 `META` 里把该技能的 `anim` 指向新名 → `--apply`

### 16.4 改完的验收清单

- [ ] `_test_skill_formula.py` 全绿
- [ ] `_test_passive_recover.py` 全绿
- [ ] `_test_skilldata_client.cjs` 全绿
- [ ] `server/tests` 74 passed
- [ ] `tsc --noEmit` 无非 MAP4 错误
- [ ] `server/data/Skills.json` 与 `assets/resources/json/Skills.json` **内容一致**
- [ ] 三份 `Items.json` **id 集合一致**

---

## 17. 待用户决策（不要自作主张）

| # | 事项 | 现状 | 需要用户给什么 |
|---|---|---|---|
| 1 | **公式缩放口径** | `normal_attack.enabled = false` | 「整体除以 K」还是「去掉大常数」，或给出机甲实际 HP / 攻击区间 |
| 2 | **额外效果清单** | `extra_effects: []` 空 | 灼烧 / 眩晕 / 护盾值 / 减速… 的具体数值与持续回合 |
| 3 | 生命 / 能量恢复是否开放升级 | 都关 | 开 / 不开 |
| 4 | 治疗 / 护盾是否吃技能等级倍率 | 原插件只作用于伤害 | 是否扩展到治疗 / 护盾 |
| 5 | MP 是否跨战斗持久化 | 只回写 `CurrentHP` | 是否也存 `CurrentMP` |
| 6 | 分类图标是否移入 `resources/` | 不在 resources，只能拖 | 是否移入以便动态加载 |
| 7 | 技能书图标（`iconIndex` 占位） | 18 本同一图标 | 是否用技能专属图标 |
| 8 | 群体技能何时做（房间 1v1） | 未做 | 是否先扩多单位 |
| 9 | 两个孤立 gif 是否清 | 待定 | 清 / 留 |
| 10 | `0018 会心一击` / `0055 自动恢复` / `0056 纳米侵蚀` | 不在 16 本清单内 | 是否纳入 |

---

## 18. 术语表

| 术语 | 含义 |
|---|---|
| **code（`rumbo` / `leiting` …）** | 技能稳定英文短名，脚本 / 存档 / `Classes.json` 引用用 |
| **anim** | 特效 AnimationClip 名，对应 `Image/Skill/ani/{anim}.anim` |
| **scope** | RPG Maker 目标范围码（1 单体 / 2 全体 / 7 己方 / 11 自身） |
| **category** | 分类图标（`skill_1`..`skill_5`，见 §6） |
| **classes** | 可学职业线（`fighter` / `shooter` / `universal` / `all`） |
| **type** | 风格标签（格斗 / 射击 / 全能 / 通用）—— 与 `classes` 是两个维度 |
| **悟性 comprehension** | 机甲属性 40–100，决定技能自动升级概率与升级学技能概率 |
| **专注 / 成长 growth** | `Z_Xinglevel.js` 里的升星参数（40–100） |
| **extra_effects** | 预留的额外效果数组（当前全空） |
| **normal_attack** | 普攻三职业三公式配置块（默认 `enabled: false`） |

---

## 19. 相关文档索引

| 文档 | 内容 |
|---|---|
| `tools/skill_final_table.md` | **技能总表 v11**（34 条全字段分组 + 口径确认 + 职业机制核查） |
| `server/docs/技能战斗数据-目标与公式.md` | 范围与公式详表（含接入差异分析） |
| `tools/skill_list.md` | 技能 × 分类图标 × 特效动画对照表（v8） |
| `tools/skill_anim_table.md` | 动画对照表 |
| `tools/skill_category_todo.md` | 分类待指定表（用户尚未填写） |
| `server/docs/升星概率计算说明.md` | 升星概率 |
| `server/docs/物品效果系统文档.md` | 物品效果 |
| `C:/Users/Administrator/.workbuddy/skills/rm-battle-data-port/SKILL.md` | **RPG Maker 战斗数据搬运技能**（本系统的可复用方法论） |
| `C:/Users/Administrator/.workbuddy/skills/cocos-gif-anim-port/SKILL.md` | Cocos 帧动画接入技能 |

---

## 20. 附录：给接手 AI 的开场指令（可直接复制粘贴）

> 把下面这段发给接手的 AI，再把本文档路径一并给出即可。

```
你现在接手《机甲风暴OL · 虫祸纷争》（JJFB）Cocos 工程的「技能制作系统」。

工程根目录：D:\jjfbol-cocos\jjfbol-cocos\jjfb
交接文档：  D:\jjfbol-cocos\jjfbol-cocos\jjfb\tools\skill_system_handoff.md

请先完整读一遍交接文档，再按需读配套详表：
  - tools/skill_final_table.md                       技能总表 v11（34 条全字段）
  - server/docs/技能战斗数据-目标与公式.md            范围与公式详表
  - tools/skill_list.md                              技能 × 动画对照
  - server/data/Skills.json                          权威数据（version 3，34 条）

必须遵守的硬约束：
  1. 数据权威源是 server/data/Skills.json；改数据只能改 tools/build_skill_table.py 的 META
     常量，然后 python tools/build_skill_table.py --apply，最后 cp 到 assets/resources/json/。
  2. Items.json 有三份（assets/resources/json/、server/data/、server/handlers/json/），
     必须用 tools/patch_items_skillbooks.py 一起改，只改一份必出不一致 bug。
  3. 排任何 item id 前，先扫一遍现有 id 占用（0057–0075 已被占用的教训）。
  4. 数值回填一律显式判空 + clamp，绝不用 `or`（`0 or max_hp` 会静默满血复活）。
  5. 伤害公式改动必须服务端 + 客户端两端同改（服务端是权威）。
  6. 改完必须跑齐 5 条验证：_test_skill_formula.py、_test_passive_recover.py、
     _test_skilldata_client.cjs、server/tests（pytest）、tsc --noEmit。
  7. 备份只移不乱删；禁止删除任何归档 / 日志 / memory。

当前第一优先级待办（等用户给口径才能动）：
  - 服务端 battle_room_service._exec_action 接入技能公式（现为临时 max(1, atk - def)）
  - 客户端 BattleScene.performAttack 接入普攻三职业三公式
  - 前提：先定「公式缩放口径」——原公式 atk×3+1000 配的是原工程数千属性量级，
    本工程 lv1 MaxHP≈553 / 攻击≈355，直接接管会一击必杀。
    （Skills.json 里 normal_attack.enabled 目前是 false）

不确定的口径先问我，不要猜。
```

---


## 21. 战斗内技能选择面板（SkillSelect）

> 2026-09-30 追加。机甲面板的「技能栏」是**展示**；本节是**战斗中「选技 → 确认 → 施放」**的完整链路。

### 21.1 节点结构（场景 `Game.scene`）

```
BattleScene
  ├─ BattleSelectButton              ← 战斗操作面板（格斗/射击/技能/防御/…/逃跑）
  │    └─ Skill (Label=「技能」)     ← 【技能按钮】新绑定（cc.Button）
  └─ SkillSelect                     ← 【技能选择面板】运行时挂 SkillSelectPanel
       ├─ Mask    (cc.Button)        ← 点空白处 = 「返回」→ 关面板
       ├─ BG1 / BG2
       ├─ Skill1  (cc.Button)        ← 技能槽模板（不够就克隆 Skill2…，y − 50）
       │    ├─ Icon       (Sprite)   ┐
       │    ├─ SkillName  (Label)    │ 与机甲面板 MechSkill 的槽**完全同构**
       │    ├─ Level      (Label)    │ 静态「【等级】」
       │    └─ SkillLevel (Label)    ┘ 等级数字
       ├─ Title   (Label=「选择机甲技能」)
       └─ Confirm (cc.Button，默认 active=false) ← **选中技能后才出现**
```

### 21.2 代码分工

| 文件 | 职责 |
|---|---|
| `assets/Script/Game/SkillSelectPanel.ts` | 面板本体（零挂载：按名字递归找节点；`Confirm` 由「是否选中」控制显隐） |
| `assets/Script/Game/SkillIconAtlas.ts` | 技能图标图集加载 / 取帧 / 缺帧回退 —— **与 `MechSkillPanel` 共用同一份缓存** |
| `assets/Script/Game/BattleScene.ts` | 绑定「技能」按钮 + 开关面板 + 把确认的技能交给 `castSkill()` |

### 21.3 交互口径

1. 点「技能」按钮 → `onSkillClicked()` → `SkillSelectPanel.open(playerUnit.petId, {onConfirm})`；
   再点一次 = 收起。
2. 面板数据走服务端 `skill_list`（**默认只列已学且可主动施放**的技能）。机甲初始没有技能 →
   面板为空并显示「尚未学会任何技能」（预期行为，用技能书学会后才有）。
3. 点技能槽 = **选中**（槽高亮金色）→ `Confirm` 才出现；`usable=false`（能量不足）的槽置灰，
   点击只在标题提示原因，**不选中**。
4. 点 `Confirm` → 面板自行关闭 → 回调 `BattleScene.castSkill(key)` → 发
   `{action_type:'SKILL', skill_key}`。
5. 点 `Mask`（=「返回」）→ 只关面板，不提交指令。
6. **倒计时归零（30s，游戏原机制）→ 关技能面板 + 自动普攻**（`update()` 里 `closeSkillSelectPanel()`）。
7. 提交指令 / 播放服务器回合 / 战斗结束 / 战斗重置 → 一律顺手关面板。
8. `BattleScene` 的「返回」键与面板联动：技能面板开着时，「返回」**先关技能面板**。

### 21.4 与机甲面板的关系（复用点）

- **同构**：槽命名 `Skill{N}`、槽内 `Icon / SkillName / SkillLevel`、图标帧 `skill_{1..5}`、
  「槽位不足 → 克隆首槽 + 下移 50」的排布规则**完全一致**。
- **复用**：图标加载 / 取帧 / 回退抽到 `SkillIconAtlas.ts`（`MechSkillPanel` 已改为调用它）。
- **差异**：多了「选中 → 确认」两步，以及 `usable=false`（能量不足）的置灰态。

### 21.5 可挂 / 可不挂

`BattleScene` 新增两个 `@property`：`skillButton`（按钮）、`skillSelectPanel`（面板组件）。
**不挂也能跑** —— 运行时按名字找 `BattleSelectButton/Skill` 与 `BattleScene/SkillSelect`，
面板组件缺失时 `addComponent` 兜底（与 `RobotAttributePanel.ensureSkillPanel` 同一套思路）。
想显式挂到 Inspector 也可以（便于日后查找）。

### 21.6 ⚠ 挂载位置铁律（2026-09-30 实际踩坑）

**`SkillSelectPanel` 只能挂在 `SkillSelect` 节点上 —— 绝不能挂到 `BattleScene`（或更上层）。**

坑的机理：面板内部所有查找都是**递归**的（`findChildByName` / findSlotNodes），
所以挂在 `BattleScene` 上的副本一样能"找到" `SkillSelect/Mask`、`Confirm`、`Skill1`，
于是它把 `Mask` 的点击绑到了**自己的** `close()`，而它的 `this.node` 是 `BattleScene`
→ `close()` 里 `node.active = false` → **点技能面板外的空白处 = 整个战斗面板被关掉**。
副作用还有：Confirm 被那个副本抢先处理 → 日志里反复出现
`[SkillSelectPanel] 未选中技能，确认被忽略`。

两层防护（都已落地）：

1. **运行期自检**：`ensurePanelRoot()` / `isPanelRoot()` 用「**直接**子节点是否含 `Mask` + `Confirm`」
   判定自己是不是面板根；不是则打一条 `Logger.error` + `this.enabled = false`，
   且 `open()` / `close()` 都先过这道守卫（**误挂副本永远改不到 `active`**）。
2. **静态自检**：`tools/_test_scene_panel_mount.cjs`（已进 `tools/_skill_regression.py` 第 8 步）
   —— 扫 `Game.scene`，**启用状态**的副本必须挂在面板根上，否则回归直接红。

场景现状（2026-10-01 复核）：**只剩 `Canvas/BattleScene/SkillSelect` 上一份（启用）** ——
用户已在编辑器里把误挂在 `BattleScene` 上的那份删掉了，挂载自检仍会拦住再次误挂。

---

## 22. 出招方式 / 距离口径（range · 2026-10-01 用户填表定稿）

> 口径原文与用户回填表：`tools/skill_range_todo.md`（**唯一口径来源**）

### 22.1 取值（`Skills.json` 每条技能的 `range` 字段）

| 取值 | 含义 | 条数 |
|---|---|---|
| `melee` | 近身 —— 必须先位移贴到目标才能打 | 7 |
| `ranged` | 远程 —— 原地即可出招 | 24 |
| `dynamic` | 按 `range_rule` 条件判定 | 1 |
| `none` | 不主动施放（自动触发被动），不涉及距离 | 2 |

### 22.2 定稿规则（⚠ 不要按职业线自行推断）

1. 格斗**单体**技 = `melee`（肉搏攻击 / 光刃斩 / 超能拳 / 雷霆震慑 / 冲锋 / 狂怒一击 / 连续攻击）。
2. 格斗**全体**技 = `ranged`（火焰风暴，唯一例外）。
3. 射击 / 全能全部 = `ranged`（含全体与护盾）。
4. 通用线：急速攻击 = `dynamic`；生命摄取 / 能量榨取 / 紧急修理 = `ranged`。
5. 自身 / 己方辅助（能量护盾 / 信念盾 / 紧急修理）= `ranged`（不涉及贴近敌人，按远程处理，无需位移）。
6. 自动触发被动（生命恢复 / 能量恢复）= `none`。
7. 未实装参考项（纳米侵蚀）= `ranged`。

**dynamic 规则 `gun`**（急速攻击）：持枪（武器 id **28–51**，同普攻 `gun_weapon_ids`）→ `ranged`；否则 `melee`。

### 22.3 两端读取（同口径）

| 端 | 函数 |
|---|---|
| 服务端 | `services/skill_service.skill_range_of(skill)` / `is_ranged_skill(skill, actor=None, gun_equipped=None)` |
| 客户端 | `SkillData.skillRangeOf(skill)` / `isRangedSkill(skill, hasGun=false)` |

`list_castable_skills` / `listCastableSkills` 的每条条目都带出 `range` 与 `range_rule`。

### 22.4 维护方式

```bash
python tools/build_skill_table.py --apply   # 一次写出 server/data + assets/resources 两份（LF，md5 一致）
python tools/_test_skill_range.py           # 71 项口径回归（已进 _skill_regression.py）
```

- 口径登记表在生成器里：`RANGE_BY_KEY` / `RANGE_RULE_BY_KEY`；**新增技能漏登记会打印告警并按 `ranged` 兜底**，
  测试会直接报「RANGE_BY_KEY 覆盖全部技能 key」失败。
- ⚠ 生成器必须 `newline="\n"` 写两份 —— 曾在 Windows 下写出 CRLF 导致两份 md5 不一致（md5 一致性是硬约定）。

### 22.5 客户端表现接入：近身技位移（2026-10-01）

`BattleScene.playOneRoundEvent()` 在播技能前按 `range` 分流（ATTACK 路径不变，普攻近战本来就会贴上去）：

| 判定 | 表现 |
| --- | --- |
| 远程（`isRangedSkill()===true`） | 原地出招，特效打在目标身上（**原有行为不变**） |
| 近身（`false`） | 机甲**先位移贴到目标身前**（`MELEE_CONTACT_GAP=30px`）→ 目标被击退一点再拉回 → 播技能特效 + 结算 → 机甲滑回原位（`MELEE_RETURN_TIME=0.14s`） |

- 新函数：`BattleScene.moveInForMeleeSkill(attackerShow, targetShow, skillName)` → 返回 `{restore(cb)} | null`。
  - `null`（节点缺失 / 敌我同一节点）→ 调用方直接推进，不做位移。
  - `restore(cb)`：特效与伤害结算结束后归位再 `cb`；内部**幂等**（tween 回调 + 0.3s 兜底调度只推进一次），tween 抛错则直接 `setPosition` 归位。
  - 归位点优先用缓存的 `battlePlayerPos` / `battleEnemyPos`（不受上一次击退残留影响），没有才用当前坐标。
- 判定输入：`skillDef = SkillData.getSkillDef(ev.skill_key)`；`hasGun = SkillData.hasGunEquipped(equipmentOf(rawData) || equipmentOf(rawData.data))`。
- **自身 / 己方目标技能（护盾、修理）不位移** —— 条件是「近身 **且** 特效目标不是攻击者自己」。
- 共用常量（**普攻近战与近身技同口径，改一处两处一起变**）：
  `MELEE_CONTACT_GAP=30`、`KNOCKBACK_DELTA=30`、`MELEE_RETURN_TIME=0.14`。
- 源码守卫在 `tools/_test_skill_range.py` 第 8 节（11 项）：漏接位移 / 漏归位 / 常量被写死回 30 都会红。

### 22.6 尚未接入：服务端距离规则

战斗仍 **1v1、出手即命中**，**伤害与距离无关**（不需要为「靠近」消耗回合）。
客户端位移纯属表现层。若日后要做「离得远打不到」，用 `skill_service.skill_range_of()` / `is_ranged_skill()` 在服务端判分支。

### 22.7 ⚠ 事故复盘：近身技「还是原地出招」（2026-10-01）

用户实测「肉搏攻击释放时机甲仍原地不动」，日志（`temp/logs/project.log`）实证两条原因叠加：

```
[W] [BattleScene] 技能目录加载异常: ReferenceError: JsonAsset is not defined   ← ①
    然后整回合**完全没有** [近身技] 日志、也没有 performAttackWithDamage       ← ② 静默走远程分支
```

① **`BattleScene.ts` 的 `from 'cc'` import 漏了 `JsonAsset`** → `loadSkillCatalog()` 里
   `resources.load('json/Skills', JsonAsset, …)` **同步抛 ReferenceError** → 被 `try/catch` 吞掉
   → `SkillData.setSkillCatalog()` 从未执行（`_catalog = null`）→ `getSkillDef()` 全返回 `null`。
② **`skillRangeOf(null)` 兜底是 `ranged`** → 近身技也被判成远程 → `meleeMove` 不创建 → 原地出招；
   而当时的 `[近身技]` 诊断日志写在 `if (!skillRanged)` 分支里 → **连日志都不打**，彻底静默。

**修复后的口径（两端必须一致，改一处要改两处）**
- `SkillData.isRangedSkill(skill, hasGun)`：**`!skill` → `return !!hasGun`**（= 普攻口径），
  `none` 显式 return false，`dynamic` 未知规则同样按普攻口径；**不再兜底成 `ranged`**。
- `skill_service.is_ranged_skill(skill, actor, gun_equipped)`：`not isinstance(skill, dict)` → 同一兜底。
- `BattleScene` 的 `[近身技]` 日志**改为无条件打印**：
  `「技能名」(key=…) range=melee 持枪=false → 近身/位移`；目录未命中时会打 `目录未命中→按普攻口径`。
  **以后遇到「技能表现不对」先 grep 这一行，一眼定位。**
- 防复发守卫：`_test_skill_range.py` 第 8 节校验 **cc import 里必须含 `JsonAsset`**、
  `SkillData.ts` 必须含 `if (!skill) return !!hasGun;`；`_test_skilldata_client.cjs` 加了
  `isRangedSkill(null,false)===false` / `(null,true)===true` 两项。

**通用教训**：任何被 `try/catch` 包住的**初始化**（配表加载、目录注入、资源加载）都必须在日志里可见；
表现层的「兜底值」要跟**既有同类逻辑**对齐，不能选看起来最安全的那一侧。

### 22.8 ★技能开放口径：纳米侵蚀（2026-10-01 用户拍板）

用户原话：「**把纳米侵蚀开放所有可学习**」。

改前（数据在 `tools/build_skill_table.py` 的 `META` 表最后一条）：

| 字段 | 旧值 | 新值 | 说明 |
|---|---|---|---|
| `classes` | `shooter` | **`all`** | 三职业线通用 |
| `reference_only` | `True` | **删除** | 不删就**谁都学不了**（`plan_use_book` 第 ② 步直接否决） |
| `category` | `ref` | **`skill_1`** | 转正为「主动学习·攻击技能」→ `lv_auto/lv_manual` 随 category 默认变 **True/True**（可自动悟 / 可花书升级） |
| `type` | `射击` | **`通用`** | 展示用职业归属 |
| `mp_cost_percent` | `None` | **`20`** | ⚠ 原 `None` 会让 `mp_cost()` 算成 **0 消耗**（`mp_cost()` 只认 `mp_cost_percent`）；20% 与其它「群体敌方」技能（火焰风暴 / 等离子弹幕 / 时空扭曲）同档 |

沿用不变：`book_id=56`（三份 `Items.json` 里 `0056 技能书-纳米侵蚀` 已存在且 `effect` 正确）、
`rpg_skill_id=10`、`scope=2`（敌方全体）、`formula`（RPG 原式，仅供溯源）、`range=ranged`。

> **★2026-10-01 追加（同一轮，用户后续反馈）**：特效动画 `anim` 由 `jiguang01` 改为 **`leiting`**
> （用户原话「纳米侵蚀的动画不对，动画应该是 leiting」）。`jiguang01` 是 RPG 原值但表现不对；
> 改后 **`jiguang01` 全表无人引用**（`leiting` 由「纳米攻击」与「纳米侵蚀」共用，同一动画资源可多技能共享）。
> 改动仍只在生成器 `META` 一条 + `--apply` 重生成；备份 `tools/_backup/Skills.v6.bak-before-nami-anim.json`
> （同源副本另存 `Skills.v6.bak-before-nami-anim.assets.json`）。`version` 保持 6（纯数据修正，无结构变化）。

**连带影响（已同步改完，勿以为是回归）**
- 技能图鉴（`learned_only=False`）各线 +1 条：格斗 **13** / 射击 **14** / 全能 **15** / Class 缺失 **32**（原 12/13/14/31）。
- **参考项（`reference_only`）全表清零**：`SkillSelectPanel` / `skill_service.can_cast_skill` / `canCastSkill`
  的「该技能仅为参考项，未实装」分支**保留**（防将来再引入参考项），测试改用**假技能**验证该分支。
- 测试同步：`_test_skill_book.py` [5] 重写为「三职业都能学会」+ 假技能分支验证；`_test_skill_level.py`
  计数与 `roll_auto_upgrade` 断言更新；`_test_skilldata_client.cjs` 计数 31→32 + 三线图鉴断言；
  `server/tests/test_skill_book_use.py` 新增 `test_nami_open_to_all_classes` / `test_nami_already_learned_no_write`。

**回滚方式**：把 `META` 里那条改回（`classes="shooter"` + `reference_only=True` + `mp_pct=None` + `category="ref"` + `type="射击"`），
再 `python tools/build_skill_table.py --apply`；本次备份 `tools/_backup/Skills.v6.bak-before-nami-open.json`。

### 22.9 ★特效画布缩放口径：RPG 移植特效**原比例**（2026-10-01 用户拍板）

用户原话：「**从 RPG 里搬出来的特效不要放大，他本来是贴合的，你放大了导致我的特效不全，
所以 RPG 移植过来的特效就原比例，我自己的素材的不用维持原样就好。**」

**两类特效，两套口径（不许混）**

| 来源 | 数量 | 生成器 | 缩放 | 说明 |
|---|---|---|---|---|
| **RPG Maker 特写动画** | 15 | `tools/rpg_anim_port.py` | **1×（原比例）** | MV 图集格固定 192，原生尺寸本就贴合；先前误放大 2× → 画布 384 → 超出可视范围「特效不全」 |
| **用户自己的素材**（xg1/xg2 导出 gif） | 24 | `tools/skill_gif_port.py` | **2×（保持不动）** | 用户口径「不用维持原样」→ 不改 |

**改动**：`rpg_anim_port.py` 的 `UPSCALE: 2 → 1`，`--apply` 重生成 15 个 clip 的帧 PNG + `.anim`。
帧数不变（合计 379），画布 384 → 192（`denglizipingzhang` 192×133 / `shengminghuifu` 192×147 /
`nenglianghuifu` 192×163 —— 非正方形来自「并集 bbox 裁剪」）。

**⚠ 血泪点：重生成必须保 uuid（本次踩过）**
首次 `--apply` 后，帧 `.png.meta` 与 clip `.anim.meta` 的 uuid **全部重新生成**，而
`assets/UIPrefab/RobotShow.prefab` 的 Animation 播放列表是**按 uuid 引用 clip** 的 →
**15 个技能特效会全部静默播不出来**（跟 §21.6 的「漏 import 被 try/catch 吞掉」同一类静默故障）。
修复：
1. 生成器加 `existing_uuid(path)` —— 帧 meta 与 clip meta **一律复用已存在的 uuid**（幂等，可反复 `--apply`）；
2. 本次已从备份 `tools/_backup/skill_anim_upscale2_20261001/` 把 379 帧 + 15 clip 的 uuid 全部还原，
   再复跑一次 `--apply`（uuid 续用），校验「帧 uuid == 备份 uuid」「clip 引用 == 帧 uuid 集合」「prefab 全命中」三项零异常。

**守卫**：新增 `tools/_test_skill_anim_assets.py`（**59 项**，已进 `_skill_regression.py` 第 1-6 组）——
`UPSCALE==1` / `SCALE==2` / `existing_uuid` 存在且两处调用、15 clip 帧数快照、画布 ≤192、
`_values` 与帧 meta uuid 一一对应、prefab 引用全命中、clip 总数 39、无 2× 残留。

**帧资源引用**：`assets/resources/Skill/{短名}-{k}.png` 的 spriteFrame 只被同名 `.anim` 引用
（已扫全工程 scene/prefab，外部引用 = 0），所以帧 uuid 只需与 `.anim` 自洽，不必与别的资源对齐。

**回滚**：`UPSCALE: 1 → 2` + `--apply`（uuid 会被复用，不会再漂移）；或从
`tools/_backup/skill_anim_upscale2_20261001/` 整体覆盖回去。

---

### 22.10 ★特效画布 = 全动画图元并集（2026-10-01 二次修正 · 用户报「图被裁了」）

用户看完 22.9 的预览图后反馈：「**你给我这个图怎么是不全的，被裁了？**」

#### 根因：不是缩放，是**画布写死 192**

22.9 只改了 `UPSCALE`。但 MV 的渲染方式**根本不是「一张 192×192 位图」**，
而是 16 个独立 cell Sprite 叠在动画层上（`js/rpg_sprites.js`）：

```js
Sprite_Animation.prototype.createCellSprites = function() {
    this._cellSprites = [];
    for (var i = 0; i < 16; i++) {
        var sprite = new Sprite();
        sprite.anchor.x = 0.5;
        sprite.anchor.y = 0.5;
        this._cellSprites.push(sprite);
        this.addChild(sprite);
    }
};
Sprite_Animation.prototype.updateCellSprite = function(sprite, cell) {
    sprite.setFrame(sx, sy, 192, 192);
    sprite.x = cell[1];                          // ← 偏移可远超 ±96
    sprite.y = cell[2];
    sprite.rotation = cell[4] * Math.PI / 180;
    sprite.scale.x = cell[3] / 100;
    sprite.opacity = cell[6];
    sprite.blendMode = cell[7];
};
Sprite_Animation.prototype.updatePosition = function() {
    if (this._animation.position === 3) {        // 画面级：锚在**屏幕中心**，不是目标
        this.x = this.parent.width / 2;
        this.y = this.parent.height / 2;
    } else { ... this.x = this._target.x; ... }  // 0/1/2：锚在目标
};
```

**MV 从不裁**（没有 192 画布这个概念）。而移植脚本用固定 192×192 画布 + `Image.paste`
→ 超出的图元被**静默丢弃**：

| clip | RPG id | position | 图元 x 范围 | 超出 192 格的图元 |
|---|---|---|---|---|
| 虚空导弹 | 110 | 3 | [-408, 312] | **211 / 251** |
| 能量爆破 | 109 | 3 | [-300, 312] | 18 / 58 |
| 虚空冲击 | 105 | 3 | [-24, 0] | 10 / 110 |

#### 修法

1. `anim_window(anim)`：遍历整段动画所有图元，按 `_tile_extent()`（缩放 + **旋转的精确 AABB**，
   `w·|cos|+h·|sin|` / `w·|sin|+h·|cos|`）求并集 → 画布范围（四周再加 `PAD=4` 兜 `PIL.rotate(expand)` 的取整误差）；
   **下限锁死原生 `[0, CELL]`** —— 贴目标的普通动画取景**完全不变**。
2. `render_frame(anim, frame, win)` 按该画布渲染（画布左上角即坐标原点，`ox=-win[0]`），再统一裁到
   全部帧的 alpha 并集 bbox（保证同 clip 内帧尺寸一致、不抖）。
3. `--check` 自检 `check_not_clipped()`：把画布四周各 +64px 重渲染，alpha 并集 bbox **只许整体平移**；
   一变就是又被裁了。15/15 一致。

#### 连带结果

- 帧合计 **379 → 383**（+4）：`lizijiguang` +1 / `xukongdaodan` +1 / `shengminghuifu` +2 ——
  这几帧原先图元全在 192 格外，被判「全空帧」剔掉了。
- 画布：192×192 → 234×742 ~ **1246×696**（逐 clip 见 `skill_anim_table.md §四`）。
- ⚠ **内存代价（已知，未规避）**：15 个 clip 逐帧 RGBA ≈ **747 MB**（旧方案 ≈54 MB）。
  根因是「一帧一张 PNG」的帧序列，而 MV 是 16 个 cell Sprite 共享图集。
  要压只能改成 cell 分层播放，**不是**裁画布。

#### 附带修：编辑器 `library/` 缓存（169 条红字）

帧是**原地替换**（uuid 必须不变，见 22.9），但尺寸变了 → 编辑器 `library/**@f9941.json`
还留着旧 `rect: 384`，加载时 `SpriteFrame.checkRect()` 拿它比新纹理（192）：

```
[Scene] Rect width exceeds maximum margin: yinliyazhi-8/ 384 192   （共 169 条）
```

引擎会 `reset()` 自愈（不影响显示），但控制台刷屏 = 用户眼里的「报错了」。
新增幂等补齐脚本 **`tools/_sync_skill_library_cache.py`**（演练 / `--apply`）：
按源 `assets/resources/Skill/*.png.meta` 的 userData 重写 `library/**@f9941.json` 的
`content.rect / originalSize / vertices`，并把新 PNG 复制进 `library/`。
已跑：需补 379 / 已一致 0 → 复验**需补 0**。测试第 [5] 组会在不一致时直接失败。

#### 回滚

`tools/_backup/skill_anim_preclip_20261001/`（改前 383→379 帧版；含 15 clip 的 png+meta+anim+anim.meta）。
回滚后需再跑一次 `_sync_skill_library_cache.py --apply`。

---

*交接文档结束。有任何口径不确定的，先问，不要猜。*


---

## 附录 A · 铁律速查（2026-10-01 从 MEMORY.md 迁出，避免热记忆超限）

## 8. 技能系统（v6 · 10-01）
> **细节全在 `tools/skill_system_handoff.md`**，此处只留铁律。
- **数据唯一入口** `tools/build_skill_table.py --apply`（两份同写 + LF，**md5 必须一致**）；改 `META` 再 `--apply`，**勿手改 JSON**。**图标** = `SkillIcon/SkillIcon` 帧 `skill_1..5`（⚠ 别拿背包图集当技能图标）。
- **`range`**：`melee`/`ranged`/`dynamic`(持枪 28–51→远程)/`none`。**读不到定义 → 按普攻口径兜底（持枪=远程）**；`moveInForMeleeSkill()` 是**纯表现层**，服务端无距离规则。
- **公式口径 A**：只用 `formula_scaled`（`a.atk÷3` + 删末尾纯数字加项）；普攻 格斗 `(a.atk/3)*3` / 射击 `*2.5` / 全能 `*3.5`（后两者需持枪）。**等级** Lv1–4 倍率 `[1.0,1.2,1.3,1.5]`；`lv_auto` 靠升级悟，`lv_manual` 靠面板 + 1/2/3 本书 + 25/40/50 级。
- ⚠ `list_castable_skills(learned_only=True)` **默认只列「已学」**；**新机甲面板为空是预期**（唯一来源＝技能书）。曾改 False 被否。
- **技能书**：背包用书**只能「学会」**；升级只走面板。唯一落库入口 `skill_handler.apply_skill_book()`（**先写状态→再扣书**，失败 `$unset` 回滚）。⚠ 分支必须在 `handle_bag_use_item` 的 **`if item_data:` 之外**（否则静默扣 1 个）。
- **`round_events` 字段名是 `action` 不是 `type`**。UI 两处同构（`MechSkillPanel`/`SkillSelectPanel`）：槽 `Skill{N}` 内 `Icon/SkillName/Level/SkillLevel`，不足则**克隆首槽 + y − 50**；**不用 `ev.target`**。⚠ `SkillSelectPanel` **只能挂 `SkillSelect`**，绝不能挂 `BattleScene`。
- 回归 `python tools/_skill_regression.py`（13 项：python + tsc 0 + 客户端 202 + 挂载自检 12 + pytest 99）。
