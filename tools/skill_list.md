# JJFB 技能表（v8）

> **v8 改动**：补全**群体 / 单体**与**伤害公式**（全部来自 RPG Maker 原工程，未改一字）。
> 权威数据落盘 → `server/data/Skills.json`（34 条），求值器 `server/services/skill_formula.py`，
> 说明文档 `server/docs/技能战斗数据-目标与公式.md`。
> v7：技能分类口径定稿 —— 按 `Skill_icon` 图集的 5 个图标给每个技能打标。
> **技能总数 33 个，全部有特效动画。**

---

## 零、分类图标（`assets/UI/Skill_icon/`）

图集 `SkillIcon.png`（170×34，5 帧 ×32×32）+ `SkillIcon.plist`，**从第一个开始**：

| 图标 | 帧名 | 图案 | 分类 | 获取 | 行为 | UUID |
|---|---|---|---|---|---|---|
| 1 | `skill_1` | **主**（红） | 主动学习 · **攻击技能** | 技能书 | 战斗中选目标主动施放 | `c7533286-bd2d-4dde-b3d3-7680ef444383@bf082` |
| 2 | `skill_2` | **被**（蓝） | 主动学习 · **被动技能** | 技能书 | 常驻生效，不施放、不触发 | `c7533286-bd2d-4dde-b3d3-7680ef444383@9d75b` |
| 3 | `skill_3` | **自**（黄） | 主动学习 · **自动触发技能** | 技能书 | 每回合结束自动结算 | `c7533286-bd2d-4dde-b3d3-7680ef444383@636fd` |
| 4 | `skill_4` | **悟**（红） | 升级概率习得 · **悟性攻击技能** | 悟性 | 主动施放 | `c7533286-bd2d-4dde-b3d3-7680ef444383@82bb1` |
| 5 | `skill_5` | **悟**（蓝） | 升级概率习得 · **悟性被动技能** | 悟性 | 常驻生效 | `c7533286-bd2d-4dde-b3d3-7680ef444383@dee53` |

**配色规律**：**红 = 攻击** / **蓝 = 被动** / **黄 = 自动触发**；
「悟」字 = 悟性线（升级概率习得），与技能书线同色系对应。

> 图集已被 Cocos 正确导入为 sprite-atlas（`SkillIcon.plist.meta` importer=`sprite-atlas`，
> 5 个 `sprite-frame` 子资源已生成）。
> ⚠ **注意**：`assets/UI/Skill_icon/` **不在 `resources/` 下**，运行时不能用
> `resources.load` 动态取，只能在编辑器里把 `skill_1..5` 拖到 Sprite 的 SpriteFrame 上。
> 若后续要按名动态加载，需把这两个文件复制/移到 `assets/resources/UI/Skill_icon/`。

---

## 一、技能书 · 攻击技能（`skill_1`，29 个）

### 1.1 十六本技能书（0036–0051，类型 + 动画 + 公式全部就位）

| # | 技能书ID | 技能名 | 类型 | 分类图标 | **范围** | **伤害公式（RPG 原式）** | 特效动画 | 帧 | 时长 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 0036 | 肉搏攻击 | 格斗 | `skill_1` | 单体 | `a.atk * 5 - b.def * 1 + 2000` | `quan01` | 7 | 0.70s |
| 2 | 0037 | 光刃斩 | 格斗 | `skill_1` | 单体 | `a.atk * 5 - b.def * 1 + 1000` | `guangrenzhan` ▲ | 5 | 0.33s |
| 3 | 0038 | 超能拳 | 格斗 | `skill_1` | 单体 | `a.atk * 3 - b.def * 0.8 + 1000` | `chaonengquan` ▲ | 5 | 0.33s |
| 4 | 0039 | 雷霆震慑 | 格斗 | `skill_1` | 单体 | `a.atk * 5 - b.def * 1 + 1000` | `leitingzhenshe` ▲ | 10 | 0.67s |
| 5 | 0040 | 火焰风暴 | 格斗 | `skill_1` | **群体** | `a.atk * 2 - b.def * 1.1 + 1000` | `kuangnu`（与狂怒一击共用） | 4 | 0.40s |
| 6 | 0041 | 雷霆冲击 | 射击 | `skill_1` | 单体 | `a.atk * 4 - b.def * 0.7 + 1000` | `leitingchongji` ▲ | 12 | 0.80s |
| 7 | 0042 | 离子激光 | 射击 | `skill_1` | 单体 | `a.atk * 3 - b.def * 1 + 1000` | `lizijiguang` ▲ | 13 | 0.87s |
| 8 | 0043 | 等离子弹幕 | 射击 | `skill_1` | **群体** | `a.atk * 3 - b.def * 1 + 900` | `denglizidanmu` ▲ | 16 | 1.07s |
| 9 | 0044 | 虚空导弹 | 射击 | `skill_1` | 单体 | `a.atk * 3 - b.def * 1 + 800` | `xukongdaodan` ▲ | 64 | 4.27s ⚠ |
| 10 | 0045 | 能量爆破 | 射击 | `skill_1` | 单体 | `a.atk * 3 - b.def * 1 + 2000` | `nengliangbaopo` ▲ | 26 | 1.73s |
| 11 | 0046 | 电磁风暴 | 射击 | `skill_1` | 单体 | `a.atk * 3 - b.def * 1 + 1500` | `diancifengbao` ▲ | 44 | 2.93s ⚠ |
| 12 | 0047 | 时空扭曲 | 全能 | `skill_1` | **群体** | `a.atk * 3 - b.def * 1 + 1200` | `shikongniuqu` ▲ | 20 | 1.33s |
| 13 | 0048 | 能量护盾 | 全能 | `skill_1` | 自身 | `0`（纯效果：防御 buff+2、回 10% HP） | `xinniandun`（与信念盾共用） | 11 | 1.10s |
| 14 | 0049 | 引力压制 | 全能 | `skill_1` | 单体 | `0`（纯效果：附加状态 11 **禁锢**） | `yinliyazhi` ▲ | 29 | 1.93s |
| 15 | 0050 | 等离子屏障 | 全能 | `skill_1` | **群体** | `2500`（固定值） | `denglizipingzhang` ▲ | 37 | 2.47s |
| 16 | 0051 | 虚空冲击 | 全能 | `skill_1` | 单体 | `2000`（固定值） | `xukongchongji` ▲ | 62 | 4.13s ⚠ |

> ▲ = 从 RPG Maker 转换（共 15 个）
> ⚠ = 时长偏长（> 2.5s），战斗节奏里可能需要抽帧或提速
> **公式变量**：`a` = 攻击方、`b` = 被击方；`atk`↔`attack`、`def`↔`defense`、
> `agi`↔`initiative`，`hp / mhp / mp / mmp / level` 同名对应。
> 完整结算链（暴击 ×3 / variance ±20% 三角分布 / 防御减半）见第十一节。
>
> ⚠ `diancifengbao`（电磁风暴）与 `xukongdaodan`（虚空导弹）在原工程是**单体**，
> 名字看着像群体——以原工程为准。

### 1.2 补充技能（13 个，全部有动画）

| # | 技能名 | 类型 | 分类图标 | **范围**（建议） | 伤害公式 | 特效动画 | 帧 | 时长 |
|---|---|---|---|---|---|---|---|---|
| 17 | 冲锋 | 格斗 | `skill_1` | 单体 | 待定 | `chongfeng` | 6 | 0.60s |
| 18 | 狂怒一击 | 格斗 | `skill_1` | 单体 | 待定 | `kuangnu`（与火焰风暴共用） | 4 | 0.40s |
| 19 | 连续攻击 | 格斗 | `skill_1` | 单体（3 段） | 待定 | `lianxu` | 9 | 0.90s |
| 20 | 精神攻击 | 射击 | `skill_1` | 单体 | 待定 | `jingsheng` | 15 | 1.50s |
| 21 | 禁锢 | 射击 | `skill_1` | 单体 | 待定（对照：附加状态 11 禁锢） | `jingu` | 3 | 0.30s |
| 22 | 舍身一击 | 射击 | `skill_1` | 单体 | 待定 | `sheshen` | 5 | 0.50s |
| 23 | 干扰攻击 | 全能 | `skill_1` | 单体 | 待定 | `ganrao` | 6 | 0.60s |
| 24 | 回路干扰 | 全能 | `skill_1` | 单体 | 待定 | `huiluganrao` | 12 | 1.20s |
| 25 | 信念盾 | 全能 | `skill_1` | 自身 | 待定 | `xinniandun`（与能量护盾共用） | 11 | 1.10s |
| 26 | 紧急修理 | 通用 | `skill_1` | 自身 | 待定 | `xiuli` | 8 | 0.80s |
| 27 | 急速攻击 | 通用 | `skill_1` | 单体 | 待定 | `jisu` | 2 | 0.20s |
| 28 | 生命摄取 | 通用 | `skill_1` | 单体 | 待定（HP 吸收） | `shengmingshequ` | 11 | 1.10s |
| 29 | 能量榨取 | 通用 | `skill_1` | 单体 | 待定（MP 吸收） | `zhaqu` | 11 | 1.10s |

> 这 13 个是**本工程新增**，RPG 原工程里没有对应技能 → `server/data/Skills.json` 里
> `formula: null`、`data_source: "new"`；「范围」列是**建议值**（`scope_source: "proposed"`），
> 你确认或改一下即可。
>
> ⚠ **5 个语义偏辅助**（`能量护盾` / `信念盾` / `紧急修理` / `生命摄取` / `能量榨取`）
> 目前按「主动学习 + 主动施放」统一归 `skill_1`。若你要给护盾 / 治疗单开一类图标，需补图。

## 二、技能书 · 自动触发技能（`skill_3`，2 个）

| # | 技能名 | 类型 | 获取 | 分类图标 | 范围 | 释放 | 效果 | 特效动画 | 帧 | 时长 |
|---|---|---|---|---|---|---|---|---|---|---|
| 30 | **生命恢复** | 通用 | 技能书 | `skill_3` | 自身 | **自动触发** | 回 HP（原工程为 15%） | `shengminghuifu` ▲ | 19 | 1.27s |
| 31 | **能量恢复** | 通用 | 技能书 | `skill_3` | 自身 | **自动触发** | 回 MP（对称新增） | `nenglianghuifu` ▲ | 17 | 1.13s |

> v7 口径修正：这两个**不是广义「被动」**，而是 **`skill_3` 自动触发**（每回合结束自动结算）。
> 广义「被动」（`skill_2`/`skill_5`）指**常驻生效、不施放也不触发**的效果，目前**暂无技能**。
>
> RPG 原型是 `Z_GamePlay.js`：升级 10% 概率学会技能 29「自动恢复」，
> 之后每回合 `onTurnEnd` 自动 `action.apply(this)`；技能 29 的效果是
> `{code:11, value1:0.15}` = 恢复 15% 最大 HP。
>
> **死亡空血优先** —— 结算顺序是「双方出手 → 死亡判定 → 仍存活才恢复」，
> `hp ≤ 0` 的单位一律跳过，恢复永远不会把倒下的单位拉回来。
> 特效配色刻意拉开：生命恢复 = 绿色光环（Recovery1），能量恢复 = 青蓝波纹（Cure1）。

## 三、悟性攻击技能（`skill_4`，2 个）

> 不进技能书体系，无法通过道具学习。按机甲指定，由机甲**升级时概率领悟**解锁。

| # | 技能名 | 类型 | 获取 | 分类图标 | 范围（建议） | 释放 | 特效动画 | 帧 | 时长 |
|---|---|---|---|---|---|---|---|---|---|
| 32 | 纳米攻击 | **全能** | 悟性（不可学） | `skill_4` | 单体 | 主动 | `leiting` | 13 | 1.30s |
| 33 | 弱点攻击 | **射击** | 悟性（不可学） | `skill_4` | 单体 | 主动 | `ruodian` | 3 | 0.30s |

- 两者**无技能书 ID**（0036–0051 区间内无此项），确认为纯悟性线。
- 与 `Items.json` 的 **0056 技能书-纳米侵蚀** 不是同一条（那本是可学道具，`effect` 还错写成「光刃斩」）。
- **悟性概率**来源 `Z_Xinglevel.js`：升级时 `Math.random()*10 < comprehension(40–100)` → 恒真（原插件 bug）。
  本工程按修正语义实现：**概率 = 悟性%**。

## 四、空置分类（已定义图标，暂无技能）

| 图标 | 分类 | 说明 |
|---|---|---|
| `skill_2` | 主动学习 · 被动技能 | 技能书可学、常驻生效（如「攻击力 +10%」）——泛用被动占位 |
| `skill_5` | 升级概率习得 · 悟性被动技能 | 升级概率习得、常驻生效 —— 悟性被动占位 |

## 五、汇总（33 个 · 全部有动画）

### 5.1 按分类图标

| 分类图标 | 分类 | 数量 | 技能 |
|---|---|---|---|
| `skill_1` | 主动学习 · 攻击技能 | **29** | 0036–0051（16）+ 补充 13 |
| `skill_2` | 主动学习 · 被动技能 | 0 | —— |
| `skill_3` | 主动学习 · 自动触发技能 | **2** | 生命恢复、能量恢复 |
| `skill_4` | 升级概率习得 · 悟性攻击技能 | **2** | 纳米攻击、弱点攻击 |
| `skill_5` | 升级概率习得 · 悟性被动技能 | 0 | —— |
| | **合计** | **33** | |

### 5.2 按类型（机甲职业）

| 类型 | skill_1 | skill_3 | skill_4 | 合计 |
|---|---|---|---|---|
| 格斗 | 8 | 0 | 0 | 8 |
| 射击 | 9 | 0 | 1（弱点攻击） | 10 |
| 全能 | 8 | 0 | 1（纳米攻击） | 9 |
| 通用 | 4 | 2 | 0 | 6 |

### 5.3 按范围（群体 / 单体）

| 范围 | 数量 | 技能 |
|---|---|---|
| **群体**（scope 2） | **6** | 火焰风暴、等离子弹幕、时空扭曲、等离子屏障、纳米侵蚀（★2026-10-01 由参考项开放） |
| 单体（scope 1） | 24 | 0036/0037/0038/0039/0041/0042/0044/0045/0046/0049/0051 + 补充 12 + 悟性 2 |
| 自身向（scope 7） | 6 | 能量护盾、信念盾、紧急修理、生命恢复、能量恢复 |

> 自 5.3 起「单体」含建议值（新增技能）。

**按获取**：技能书 31 · 悟性 2
**按行为**：主动施放 31 · 自动触发 2

## 六、39 个 AnimationClip 总账

| 类别 | 数量 | 说明 |
|---|---|---|
| 已挂技能 | 31 | 服务 33 个技能（`kuangnu`、`xinniandun` 各服务 2 个） |
| 空置 | 5 | `jiguang01`、`lizi`、`roubo`、`jinji`、`zidong` |
| 不做 | 3 | `tecshan`、`buff`、`debuff` |
| **合计** | **39** | 24 原有（xg1/xg2）+ 15 新增（RPG Maker） |

## 七、RPG Maker 特写动画转换记录

**数据源**：`D:/机甲风暴开发素材合集/机甲风暴2/`
- `data/Animations.json`（133 个动画定义）
- `img/animations/*.png`（120 张图集）

**图集布局**（实测，非 MV 标准 5×4）：格边长固定 **192**，列数 = W/192，行数 = H/192，索引行优先。
判定依据：各图集 pattern 最大值普遍 > 20，但均 < (W/192)×(H/192)。`pattern ≥ 100` 表示用第二个图集。

**渲染规则**：复刻 MV `Sprite_Animation.updateFrame` —— 每帧清空 192×192 画布，按 `frames[i]` 顺序
绘制各 cell（translate → rotate → mirror → globalAlpha → blendMode → drawImage）。

**映射表**：

| 技能 | RPG 动画 | id | 图集 | 帧 |
|---|---|---|---|---|
| 光刃斩 | 斩击/特效 | 7 | Slash + SlashPhoton | 5 |
| 超能拳 | 打击/特效 | 2 | Hit1 + HitPhoton | 5 |
| 雷霆震慑 | 打击/雷 | 5 | Hit2 + HitThunder | 10 |
| 雷霆冲击 | 雷/单体 2 | 77 | Thunder2 | 12 |
| 离子激光 | 激光/单发 | 115 | Laser1 | 13 |
| 等离子弹幕 | 铳击/全体 | 113 | Gun1 | 16 |
| 虚空导弹 | 无属性/全体 3 | 110 | Meteor + Gun2 | 64 |
| 能量爆破 | 无属性/全体 2 | 109 | Explosion2 + Explosion1 | 26 |
| 电磁风暴 | 雷/全体 3 | 80 | PreSpecial1 + Thunder5 | 44 |
| 时空扭曲 | 通用/必杀技 1 | 30 | Special1 + Special2 | 20 |
| 引力压制 | 通用/必杀技 2 | 31 | Special3 | 29 |
| 等离子屏障 | 光柱 2 | 118 | Light2 | 37 |
| 虚空冲击 | 暗/全体 3 | 105 | PreSpecial3 + Darkness5 | 62 |
| 生命恢复 | 恢复/单体 1 | 41 | Recovery1 | 19 |
| 能量恢复 | 治疗/单体 1 | 45 | Cure1 | 17 |

**产物**：
```
assets/resources/Skill/{短名}-{k}.png(+.png.meta)   ×539 帧（硬边缘 ×2，384 宽）
assets/Image/Skill/ani/{短名}.anim(+.anim.meta)     ×15
```
- 帧时长按 MV 原生 4 tick @60fps = **0.0667s/帧**
- 首尾全空帧自动剔除；全部帧统一取并集 bbox 后放大，保证帧尺寸一致不抖
- 校验：15/15 通过（`_values` uuid 序列 == 帧 meta 的 @f9941、时间轴单调、帧尺寸唯一）

**脚本**：`tools/rpg_anim_port.py`（`--dry` / `--preview` / `--apply` / `--only`）

## 八、两处共用动画

`kuangnu`（火焰风暴／狂怒一击）与 `xinniandun`（能量护盾／信念盾）**共用同一 AnimationClip**：
两个技能在配置里指向同一动画名即可。若后续需要不同速度/帧率/循环次数，再拆独立资源。

## 九、GIF 预览

`tools/skill_gif_preview.py` → `tools/_preview/skill_gifs/{技能名}.gif`（33 个）+ 总览页 `skill_preview.html`。

## 十、自动触发结算规则（已实现）

| 项 | 说明 |
|---|---|
| 触发 | 每回合结束（双方出手结算完毕之后） |
| **顺序** | 双方出手 → **死亡判定** → 仍 `in_progress` 才结算 |
| **死亡优先** | `hp ≤ 0` 一律跳过；战斗已结束则整体不结算 → 不存在"被恢复救活" |
| 恢复量 | `floor(属性上限 × ratio) + flat`，至少 1 点、不超过上限（⚠ 数值待定） |
| 解锁 | 机甲数据 `Skills` 数组含 `life_recover` / `energy_recover`（也接受 `生命恢复` / `能量恢复` / 拼音短名） |
| 服务端 | `server/services/battle_room_service.py`：`PASSIVE_END_OF_ROUND` + `_apply_end_of_round_passives()` |
| 客户端 | `BattleScene.playPassiveRecoverEffects()`：对应特效 + 治疗数字 + 血条/蓝条刷新 |
| 兼容 | 无 `MaxMP` 的老机甲不参与能量恢复；满血/满蓝不产生效果（也不会空播特效） |

**接入方式**：给机甲数据加 `Skills: ["生命恢复", "能量恢复"]` 即生效（PVE / PVP 都走同一套服务端结算）。

## 十一、群体/单体 与 伤害公式（v8 新增）

### 11.1 落地产物

| 文件 | 作用 |
|---|---|
| `server/data/Skills.json` | 权威技能表（34 条）：范围 / 公式 / 效果 / 数值 |
| `server/services/skill_formula.py` | 公式求值器，复刻 `rpg_objects.js` 的 `makeDamageValue` 全链路 |
| `tools/build_skill_table.py` | 从 RPG 工程重新导出上表（`--dry` 预演） |
| `tools/_test_skill_formula.py` | 校验 71 项：Python vs Node 原生 `eval` 逐条对齐 + 安全 + 手算 |
| `server/docs/技能战斗数据-目标与公式.md` | 完整说明文档 |

### 11.2 伤害结算链（复刻 `Game_Action.makeDamageValue`）

```
1. base  = max(eval(公式), 0)                ← 负值夹到 0
           ×(-1) 若 damage_type ∈ {3 HP吸收, 4 MP吸收}
2. value = base × 属性倍率                    ← 本工程暂为 1
3. if 物理: value ×= 目标.pdr                 ← 暂为 1
4. if 魔法: value ×= 目标.mdr                 ← 暂为 1
5. if base < 0: value ×= 目标.rec             ← 暂为 1
6. if 暴击: value ×= 3                        ← applyCritical，固定 ×3
7. value = applyVariance(value, variance)    ← 三角分布 ±variance%
8. value /= (2 × 目标.grd) 若目标防御中        ← applyGuard，防御减半
9. value = round(value)
```

调用示例：

```python
from services.skill_formula import make_damage_value
r = make_damage_value("a.atk * 5 - b.def * 1 + 2000", attacker, defender,
                      variance=20, critical_enabled=True)
r["value"]      # 最终伤害
r["critical"]   # 是否暴击
```

### 11.3 Z_ 插件里挖到的机制

| 插件 | 机制 |
|---|---|
| `Z_Xinglevel.js` | 星级 / 成长值 40–100 / **悟性值 40–100**；升星 `random()*240 < growth`，每星 +8%~12%；升级时按悟性概率学技能 |
| `Z_SkillLevel.js` | 技能等级 Lv1–4，倍率 `[1.0, 1.2, 1.3, 1.5]`；自动升级率 `悟性/100 × 0.1`（0.4%~1%）；手动升级需技能书 + 角色等级 25/40/50 |
| `Z_GamePlay.js` | 「自动恢复」原型：升级 10% 学会技能 29，每回合 `onTurnEnd` 自动施放，恢复 15% 最大 HP |
| `Z_skill.js` | 技能书职业限制：格斗 36–40、射击 41–45、全能 46–51，55（自动恢复）三职业通用 |

### 11.4 与现有战斗服务的差异（接入前必看）

`battle_room_service._exec_action` 现在还是临时的线性减法
（`damage = max(1, attack - defense)`），没有技能、公式、暴击、浮动。

接入要动的点：
1. `ActionType` 需扩一个带 `skill_key` 的指令；
2. `_exec_action` 改查 `Skills.json` → `make_damage_value(...)`；
3. **战斗房间目前是 1v1**，`scope=2`（群体）会退化成单体，等多人战斗落地后才真正生效；
4. `mp / max_mp` 已存在，技能 `mp_cost` 可直接扣；
5. `Skills` 数组现在同时承担「已学技能」和「被动解锁」，建议拆出 `PassiveSkills`；
6. **`mpCost` 需要换算**：原工程 MP 是几千量级（技能动辄 2000），本工程单位不同。

## 十二、待你定的 5 处

1. **15 个新增技能的公式**：`Skills.json` 里 `formula: null`、`formula_source: "todo"`。
   给我公式我直接写进去，或我按同类型档位推荐一版。
2. **新增技能的 `scope` 建议值**（见 1.2 / 第三节）是否照用，
   特别是 `纳米攻击` 要不要群体（原工程「纳米侵蚀」是群体）。
3. **`mpCost` 换算口径**：按上限百分比 / 直接重设 / 暂时全部 0。
4. **恢复数值**：当前按「属性上限 5%，至少 1 点」跑。RPG 原型是 15%。
   改 `PASSIVE_END_OF_ROUND` 里的 `ratio` / `flat` 即可（一行配置）。
5. **长动画是否压缩**：`xukongdaodan` 4.27s、`xukongchongji` 4.13s、`diancifengbao` 2.93s、
   `denglizipingzhang` 2.47s。一次普攻收尾约 0.5s，这几个会跨回合。抽帧还是提速？

> 另：`Skill` 节点的播放列表目前是 24 个，33 个技能还需再拖 9 个
> （或改成按名 `resources.load` 动态加载，以后加动画就不用再手动拖）。
