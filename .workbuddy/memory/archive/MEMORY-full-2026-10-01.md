# MEMORY.md — JJFB 机甲风暴复刻（规则 / 铁律 / 索引）

> **只放规则**，实现细节不外带。全文快照 `memory/archive/MEMORY-full-2026-09-30.md`；成表明细 `memory/archive/2026-09-30-明细归档.md`；逐日经过 `memory/YYYY-MM-DD.md`（09-28 最全）；技能口径 `tools/skill_system_handoff.md`。
> **§1–§6 是跨系统铁律（最重要），§7–§8 是分系统细节**（若本文件被截断，只会截掉后面两节）。

## 1. 通用硬规则（用户长期要求 · 最高优先）
- 只做指定内容，不超范围、不主动提议、不替用户做决定；不劝放弃。
- 先结果后解释，被问才展开；先自测跑通再交付，有问题自己查；**不猜，口径不确定先问**。
- **禁止**新开对话/清会话/重置 session 腾上下文；压缩只归档不删除；**禁止删除任何归档/日志/memory**。
- 有竞态风险：**禁止并行编辑同一文件**，串行改。
- `_audit_bag_write(user_id, character_id, action, **fields)` 第三个位置参数就叫 `action` → 调用**不能再传 `action=`**（`TypeError: got multiple values`）→ 改传 `skill_action=`。
- **普攻不播技能特效**：`NORMAL_ATTACK_SKILL_CLIP/REPEAT` 已删，普攻只弹伤害数字；特效仅由 `round_events[].anim` 驱动。
- **组件挂载偏好**：面板/功能组件要在编辑器里**显式挂载**；运行时 `addComponent` **只作兜底**且打一次提示。组件做成**零 `@property`**（靠节点名递归查找）。
- 云端（8.140.236.16）**只保证 MongoDB 常驻**；不碰云端 ws_server / handlers / data、不重启云端服务。**开发/修复/验证只在本地**（`D:\jjfbol-cocos\jjfbol-cocos\jjfb`），云端由**用户自己上传**。改好只告知「待你上传」；仅用户**明确要求**才动云端（先备份）。

## 2. 关键路径
| 用途 | 路径 |
|---|---|
| 游戏工程（Cocos 3.8.7） | `D:\jjfbol-cocos\jjfbol-cocos\jjfb` |
| 单机复刻（RPGMaker MV，**只读权威源**） | `D:\机甲风暴开发素材合集\机甲风暴2` |
| 反汇编 / 逆向包 | `C:\Users\Administrator\Desktop\Huibian\玩法文档` · `D:\Desktop\JJFBpojie` |
| 生产库 | `8.140.236.16:27017`（SCRAM-SHA-256 / authSource=admin；**勿落地明文**）；`/www/wwwroot/default/server` |
| Python / Node（managed） | `~/.workbuddy/binaries/python/versions/3.13.12/python.exe` · `.../node/versions/22.22.2-3/node.exe` |

## 3. 数据 / 结构铁律
- **MonsterBase 与 RobotBase/RobotPet 同构**：`RobotID/RobotName/AniID/Form/Class/Level/Growth/Comprehension/StarLevel` + 属性 `Xxx`/`CurrentXxx` 成对 + `MaxHP/CurrentHP`、`MaxMP/CurrentMP`、`MaxEXP/CurrentEXP`、`Jin`。怪物专属字段收进 **`MonsterExtra`**；`RobotID = 100000 + MonsterID`。
- **结构变更必须整集重建**（`col.drop()`；upsert 不清旧顶层字段）。新增集合须在 `handlers/utils.py` + `ws_server.py` + `migrations/m001_core_indexes.py` **三处**注册。
- `Items.json` **有三份**（`assets/resources/json/` → `server/data/` → `server/handlers/json/`）：改物品必须三份同改。排 item id 前**先扫占用**。
- 数值回填**一律显式判空 + clamp，绝不用 `or`**（`0 or max_hp` = 静默满血）。

## 4. Cocos 铁律
- **运行时 `resources.load` 只能读 `assets/resources/`** → 资源**双写**（编辑器目录 + resources）。移资源必须 `.meta` 同迁（uuid 不变，场景引用才不失效）；帧 `.meta` 需 subMetas `6c48a` / `f9941`。
- **克隆节点/组件必须重新生成唯一 `_id`**（重复 `_id` → 反序列化串位 → 血条不更新/状态机卡死）。改后双校验：`__id__` 无越界 + `_id` 无重复。
- 写回 `json.dump(..., ensure_ascii=False, indent=2)`；**禁 `separators=(',',':')`**。编辑器弹「Scene 数据已经修改」→ **点「不保存」**。
- 排查异常**先看 `temp/logs/project.log`**；`.ts` 有 `SyntaxError` → 整 bundle 编译失败 → 全脚本 `Missing class`。
- `Logger.debug` 受 `DEBUG_MODE` 门控 → 诊断日志用 `Logger.warn`。`scheduleOnce` 以 `target+函数引用` 去重 → 递归调度须包匿名闭包；组件**未激活**时 `scheduleOnce/unschedule` 不可靠。
- 工程 `package.json` 有 `"type": "module"` → Node 脚本必须 `.cjs`。

## 5. 怪物资源命名（拼音首字母）
文件名/AniID = 中文名逐字拼音首字母小写 + `_L{stage}`（`枯骨魔龙→kgml_L1`），`AniID == 帧前缀`。英文/数字保留（`山猫-RT→smrt`）；罗马数字 NFKC 归一；`· - ｜` 丢弃；`|初/中/终` 截断。重名追加 `_2`/`_3`；**99 个机甲动画名是保留字**（撞名播成机甲）；同中文名按阶段族一次性锁后缀（`AniKeyAllocator`）。pypinyin 缺失回退 GB2312 区位码；旧命名清理用显式 `--clean`（默认关）。

## 6. PVP 铁律
「空窗挽回期」：无操作满 5s 才激活倒计时 → 归零自动普攻；每方满 2 轮转永久接管（`auto_actions`）；提交/重连即解除。**仅双方真人**。
**回合结算必须主动推送**：`_notify_pvp_round_settled` → `_push_pvp_round_update` → `utils.push_to_user`（视角交换后 `pvp_round_update`）。
⚠ **载荷层级铁律**：`push_to_user` 把业务包进 `data` → 报文 `{type,success,code,timestamp,version,data:{...}}`；**消费方读 `msg.data.state`**（读 `msg.state` = undefined → 挂机方黑屏）。
PVP/PVE **共用表现层**（`state.*.raw` → `buildUnitFromRobotInfo` → `resolveAttackTimes` → `computeAttackSegments`）。
「攻击次数」`AttackCount`（+`CurrentAttackCount` 成对）、装备 JSON `attackCount`，默认 1，**语义 = 总段数**。优先级：`CurrentAttackCount` → `AttackCount`/`attackCount` → 装备各槽累加（1+Σ）→ effecttext「攻击次数+N」→ 兜底 1。**总伤上限恒 +20%**（`rand^1.6*0.20`，每段权重 ×0.65~1.35）→ **段数只影响打击感**。

## 7. 数值体系（v4 · 2026-09-28 定稿）
- **基准 = 满配玩家**：顶配普攻 17272 / 单体技能 ≈32000（×1.85）/ 群攻 ≈23000（×1.33）；普通怪满配必 1 刀。
- **HP 分档**（`monster_formula.is_elite()`）：normal 1.35 上限 17500 / elite 2.30 上限 26000 / boss 3.60 无上限。
- **机甲曲线**（`Classes.json` note）：HP `lv*253+300`、MP `lv*174+150`、近战/射击 `lv*40+315`、装甲 `lv*13+16`、闪避 `lv*13+12`、先制 `lv*30+15`；**命中/致命/侵蚀/抗性 机甲恒 0**（靠装备）。
- **战斗结算（09-30 起）**：RPG MV 全链 —— `formula_scaled` → 元素/物理率 → 暴击(×3) → 浮动(±variance%) → 防御减半(`/(2×grd)`) → 技能等级倍率；**高防保底 `MIN_DAMAGE=1`**。`attack = Melee + Shooting`、`defense = Armor`。
- **两条收尾铁律**：① **战败保底 1 血** —— 回写 `CurrentHP` 走 `battle_room_handler._survive_hp_after_battle()`（>0 原样，<=0 → `BATTLE_SURVIVE_HP=1`），PVE/PVP 两处都换掉 `max(0,...)`；客户端 `finishBattle` 同步抬到 1。② **升级必满血满蓝** —— `RobotUpgradeManager.apply_level_up_full_restore(attrs)`，**只认 `level_up_count > 0`**，放在升星/独特成长/技能**之后**用最终 Max。
- 引擎 `tools/monster/monster_formula.py`（`mech_curve`/`MONSTER_ONLY`/`tier_of`/`nominal_level`/`monster_coef`）；抽怪按玩家等级匹配（`_generate_enemy_snapshot`，`MonsterExtra._nominalLevel` 邻近优先）——**这才是怪物强度主因**。
- 经验曲线 `ROBOT_LEVEL_TOTAL_EXP`：L51~L60 走 1.20x 平滑递推，总累计 1.009 亿（v3）。
- **改数值铁律**：①每只怪独立公式；②HP/MP 先降级再长回；③整集重建 + 改前备份；④`_rebalance_apply.py` 幂等；⑤`_verify_rebalance.py` 校验本地 vs 云端 383/383。审计 `docs/数值体系审计报告_v4.md`。

## 8. 技能系统（v6 · 2026-10-01 起）
> 细节见 `tools/skill_system_handoff.md`；以下为必须记住的规则。
- **数据** `server/data/Skills.json` v6（34 条）+ 同源副本 `assets/resources/json/Skills.json`（**md5 必须一致**）；唯一入口 `tools/build_skill_table.py --apply`（**一次写出两份、LF 换行；勿手改 JSON、勿手动 cp**）。⚠ Windows 下曾写成 CRLF 导致两份 md5 不一致。
- **图标** = 图集 `assets/resources/SkillIcon/SkillIcon` 帧 `skill_1..5`（分类表 `tools/skill_category_todo.md`）。⚠ **别拿背包图集（IconSet2/UI2）当技能图标**。
- **出招方式 `range`（v6 新增 · 用户填表定稿）**：口径 `tools/skill_range_todo.md`（唯一来源）。格斗**单体**=`melee`（7 条）；格斗**全体**=`ranged`（火焰风暴）；射击/全能全部=`ranged`；通用线`急速攻击`=`dynamic`（持枪 id 28–51 → ranged，否则 melee）；自身/己方辅助+参考项=`ranged`；自动触发被动=`none`（2 条）。**总数 7/24/1/2**。⚠ **不要按职业线自行推断**。读取：服务端 `skill_service.skill_range_of` / `is_ranged_skill`，客户端 `SkillData.skillRangeOf` / `isRangedSkill`。**客户端已接入近身技位移**：`BattleScene.moveInForMeleeSkill()` —— 近身技先贴到目标身前（`MELEE_CONTACT_GAP=30`，与普攻近战同口径）→ 播特效结算 → `restore()` 滑回原位（`MELEE_RETURN_TIME=0.14`，幂等 + 0.3s 兜底）；自身/己方技不位移。⚠ **服务端仍无距离规则**（1v1 出手即命中，伤害与距离无关），位移纯表现层。源码守卫 `_test_skill_range.py` 第 8 节。
- **公式口径 A**：结算**只用 `formula_scaled`**（`a.atk ÷ 3` + 删末尾纯数字加项，`b.def` 不缩放）；`formula` 仅溯源。
- **普攻三职业**：格斗 `(a.atk/3)*3` / 射击 `*2.5` / 全能 `*3.5`（后两者需持枪 id 28–51，否则回落格斗）。
- **技能等级**：Lv1–4 倍率 `[1.0,1.2,1.3,1.5]`（`floor`，只放大**伤害结果**），存宠物 `SkillLevels`；自动 `悟性/100×0.1`（仅 `lv_auto`）；手动 1/2/3 本 + 25/40/50 级（仅 `lv_manual`）。
- ⚠ **取数口径（最终）**：`list_castable_skills(learned_only=True)` **默认只列「已学」**；**新机甲面板为空是预期行为**（技能唯一来源 = 技能书学会；云端 `RobotPet`/`RobotBase`/RM `Actors.json` 全无技能字段）。曾改 False 列 12~14 条，被用户否掉。
- **已学判定**：`is_learned` 无 `Skills` 字段 = **False**；`can_cast_skill` 的**战斗施放**仍保留「读不到就放行」——两回事。
- **技能书**：背包用书**只能「学会」**（未学 → Lv1 扣 1 本；**已学 → 否决「已经学会，不能再学习了」**）；升级只走面板 `skill_level_up`。落库唯一入口 `skill_handler.apply_skill_book()` → 一次 `$set` 写 `Skills`+`SkillLevels`（**无字段时自动创建** → 兼容旧玩家）；**先写技能状态 → 再扣书**，失败用 **`$unset`** 回滚。
- ⚠ 技能书分支必须在 `handle_bag_use_item` 的 **`if item_data:` 之外、加载物品配置之前**（否则**静默扣 1 个**）。⚠ `patch_items_skillbooks.py` 备份名必须带**目标路径**。
- **round_events**（契约 `tools/_fixtures/round_events_sample.json`）：`{side, action, skill_key, skill_name, anim, level, repeats, mp_cost, mp_after, targets[], heals[], effects, pending_effects, failed}`。**字段名是 `action` 不是 `type`**。
- **UI 两处同构**（`MechSkillPanel` / `SkillSelectPanel`）：槽 `Skill{N}`（`Skill\d+` 升序）内 `Icon/SkillName/Level/SkillLevel`；不足 → **克隆首槽 + `setPosition(上一槽.x, 上一槽.y − 50)`**（`SLOT_STEP_Y=50`）；槽 Button `transition=SPRITE`、**不用 `ev.target` 取点击节点**→ 闭包捕获。图标走 `SkillIconAtlas.ts`。
- ⚠ **挂载位置铁律**：`SkillSelectPanel` **只能挂 `SkillSelect`**，绝不能挂 `BattleScene`（面板查找递归 → 一点遮罩 `close()` → `node.active=false` 关掉整个战斗面板，09-30 实证）。防护 `ensurePanelRoot()`/`isPanelRoot()`（**直接**子节点含 `Mask`+`Confirm`）+ `enabled=false`；守卫 `tools/_test_scene_panel_mount.cjs`。
- **战斗链路**：`onSkillClicked()` → `open(petId,{onConfirm})` → 选槽 → `Confirm` → `close(false)` 后回调 `castSkill(key)` → `{action_type:'SKILL', skill_key}`。`Mask` = 返回；`backButton` 面板开着时先关面板；**30s 倒计时归零 → 关面板 + 普攻**。
- 回归：`python tools/_skill_regression.py --no-regen`（87/46/54/100/80 + tsc + 178 + 13 挂载自检 + pytest）。

## 9. 待办
- 清单 `docs/玩法功能开发清单.md`（P0×10/P1×15/P2×15）；性能 `docs/optimization-audit.md`（async 内裸调 Mongo 67 处待修）。
- 数值（待拍板）：高阶/低阶怪池稀薄（L50 仅 2 只、L60 仅 7 只全 elite）；怪 MP 利用率；**服务端权威攻击次数结算未移植**；`Items.json` 掉落概率缺失致经济闭环未闭。
- 待清理：临时诊断日志 `[攻击诊断]`/`[数字诊断]`/`[方向诊断]`。
- 技能剩余：①buff/状态口径待拍板（现仅 `pending_effects`）；②**升级 UI 由用户自制**；③`range` 口径已定稿（v6）且**客户端近身技位移已接**，仅**服务端距离规则**未做（战斗仍 1v1 出手即命中）；④云端未部署。
