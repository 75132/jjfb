# MEMORY.md — JJFB 机甲风暴复刻（规则 / 铁律 / 索引）

> **只放规则**。全文快照 `memory/archive/MEMORY-full-2026-10-01.md`；成表明细 `memory/archive/2026-09-30-明细归档.md`；逐日经过 `memory/YYYY-MM-DD.md`（09-28 最全）；技能口径 `tools/skill_system_handoff.md`。

## 1. 通用硬规则（最高优先）
- 只做指定内容，不超范围、不主动提议、不替用户做决定；不劝放弃。
- 先结果后解释，被问才展开；先自测跑通再交付，有问题自己查；**不猜，口径不确定先问**。
- **禁止**新开对话/清会话/重置 session 腾上下文；压缩只归档不删除；**禁止删除任何归档/日志/memory**。
- 有竞态风险：**禁止并行编辑同一文件**，串行改。
- `_audit_bag_write(...)` 第三位置参数已叫 `action` → 调用**不能再传 `action=`**（改传 `skill_action=`）。
- **普攻不播技能特效**（`NORMAL_ATTACK_SKILL_CLIP/REPEAT` 已删，只弹数字）；特效仅由 `round_events[].anim` 驱动。
- **组件挂载偏好**：面板组件**零 `@property`**（靠节点名递归查找）+ 编辑器**显式挂载**；运行时 `addComponent` 只作兜底并打一次提示。
- 云端（8.140.236.16）**只保证 MongoDB 常驻**；不碰云端 ws_server / handlers / data、不重启云端服务。**开发/修复/验证只在本地**，云端由**用户自己上传**；仅用户明确要求才动云端（先备份）。

## 2. 关键路径
| 用途 | 路径 |
|---|---|
| 游戏工程（Cocos 3.8.7） | `D:\jjfbol-cocos\jjfbol-cocos\jjfb` |
| 单机复刻（RPGMaker MV，**只读权威源**） | `D:\机甲风暴开发素材合集\机甲风暴2` |
| 反汇编 / 逆向包 | `C:\Users\Administrator\Desktop\Huibian\玩法文档` · `D:\Desktop\JJFBpojie` |
| 生产库 | `8.140.236.16:27017`（SCRAM-SHA-256 / authSource=admin；**勿落地明文**）；`/www/wwwroot/default/server` |
| Python / Node（managed） | `~/.workbuddy/binaries/python/versions/3.13.12/python.exe` · `.../node/versions/22.22.2-3/node.exe` |

## 3. 数据 / 结构铁律
- **MonsterBase 与 RobotBase/RobotPet 同构**（`RobotID/RobotName/AniID/Form/Class/Level/Growth/Comprehension/StarLevel` + `Xxx`/`CurrentXxx` 成对 + `MaxHP/HP`、`MaxMP/MP`、`MaxEXP/EXP`、`Jin`）；怪物专属字段收进 **`MonsterExtra`**；`RobotID = 100000 + MonsterID`。
- **结构变更必须整集重建**（`col.drop()`；upsert 不清旧顶层字段）。新增集合须在 `handlers/utils.py` + `ws_server.py` + `migrations/m001_core_indexes.py` **三处**注册。
- `Items.json` **有三份**（`assets/resources/json/` → `server/data/` → `server/handlers/json/`）：改物品必须三份同改。排 item id 前**先扫占用**。
- 数值回填**一律显式判空 + clamp，绝不用 `or`**（`0 or max_hp` = 静默满血）。

## 4. Cocos 铁律
- **用到 cc 类型必须 import**（`JsonAsset`/`SpriteAtlas`…）。漏 import → **同步 ReferenceError** → 被 `try/catch` 吞成「静默降级」（10-01 事故：技能目录整份未加载 → 近身技全判成远程原地出招）。**`try/catch` 包住的初始化必须能被日志看见**。
- **运行时 `resources.load` 只能读 `assets/resources/`** → 资源**双写**（编辑器目录 + resources）。移资源必须 `.meta` 同迁（uuid 不变）；帧 `.meta` 需 subMetas `6c48a`/`f9941`。
- ★**素材重生成必须复用 uuid**（10-01 事故）：帧 `.png.meta` / clip `.anim.meta` 的 uuid 一重生成 → 场景/预制体（`UIPrefab/RobotShow.prefab` 的 Animation 播放列表）引用**全断 → 特效静默不播**。生成器一律用 `existing_uuid()` 续用旧值；改完必查「引用 == meta uuid」+「prefab 全命中」。守卫 `tools/_test_skill_anim_assets.py`。
- **特效画布两类两套口径（10-01 用户拍板）**：**RPG Maker 移植的 15 个 = 原比例 1×**（`rpg_anim_port.py` `UPSCALE=1`；用户自己的素材（xg1/xg2 导出）= 保持 2×，`skill_gif_port.py` `SCALE=2`）。
- ★**画布必须 = 全动画图元并集，禁止固定 192**（10-01 用户报「图被裁了」）：MV 是 **16 个独立 cell Sprite**（`rpg_sprites.js` `createCellSprites`，anchor 0.5 + `sprite.x=cell[1]`），**没有 192 画布**，`position=3`（画面级）图元偏移可达 ±408 → 固定 192 画布 + `Image.paste` **静默裁掉 211/251 个图元**。现由 `anim_window()` 先算并集（含旋转/缩放 AABB）再开画布，`PAD=4` 兜取整；自检 `--check`（四周 +64px 重渲染，bbox 只许平移）+ `tools/_sync_skill_library_cache.py`（**改尺寸后必须同步编辑器 `library/` 缓存**，否则刷 169 条 `Rect width exceeds maximum margin`）。
- **克隆节点/组件必须重新生成唯一 `_id`**（重复 → 反序列化串位 → 血条不更新/状态机卡死）。改后双校验 `__id__` 无越界 + `_id` 无重复。
- 写回 `json.dump(..., ensure_ascii=False, indent=2)`；**禁 `separators=(',',':')`**。编辑器弹「Scene 数据已经修改」→ **点「不保存」**。
- 排查异常**先看 `temp/logs/project.log`**；`.ts` 有 `SyntaxError` → 整 bundle 编译失败 → 全脚本 `Missing class`。
- `Logger.debug` 受 `DEBUG_MODE` 门控 → 诊断日志用 `Logger.warn`。`scheduleOnce` 以 `target+函数引用` 去重 → 递归调度须包匿名闭包；组件**未激活**时 `scheduleOnce/unschedule` 不可靠。
- 表现层判定口径不唯一时，**兜底必须与「既有同类逻辑」一致**（如技能距离兜底 = 普攻口径：持枪=远程），**不能兜底成看起来最“安全”的那一侧**。
- 工程 `package.json` 有 `"type": "module"` → Node 脚本必须 `.cjs`。

## 5. 怪物资源命名（拼音首字母）
`AniID` = 中文名逐字拼音首字母小写 + `_L{stage}`（`枯骨魔龙→kgml_L1`），`AniID == 帧前缀`。重名追加 `_2`/`_3`；**99 个机甲动画名是保留字**；同中文名按阶段族一次性锁后缀（`AniKeyAllocator`）；清理用 `--clean`（默认关）。细节见归档。

## 6. PVP 铁律
「空窗挽回期」无操作满 5s 才激活倒计时 → 归零自动普攻；每方满 2 轮转永久接管（`auto_actions`）；**仅双方真人**。回合结算**必须主动推送**（`_notify_pvp_round_settled` → `push_to_user`）。
⚠ **载荷层级**：`push_to_user` 把业务包进 `data` → 消费方读 **`msg.data.state`**（读 `msg.state` = undefined → 挂机方黑屏）。
PVP/PVE **共用表现层**。「攻击次数」语义 = **总段数**，总伤上限恒 +20% → **段数只影响打击感**。

## 7. 数值体系（v4 · 2026-09-28 定稿）
- **基准 = 满配玩家**：顶配普攻 17272 / 单体技能 ≈32000 / 群攻 ≈23000；普通怪满配必 1 刀。HP 分档（`monster_formula.is_elite()`）normal 1.35 上限 17500 / elite 2.30 上限 26000 / boss 3.60 无上限。
- **机甲曲线**（`Classes.json` note）：HP `lv*253+300`、MP `lv*174+150`、近战/射击 `lv*40+315`、装甲 `lv*13+16`、闪避 `lv*13+12`、先制 `lv*30+15`；**命中/致命/侵蚀/抗性 机甲恒 0**（靠装备）。
- **战斗结算（09-30 起）**：RPG MV 全链 —— `formula_scaled` → 元素/物理率 → 暴击(×3) → 浮动(±variance%) → 防御减半(`/(2×grd)`) → 技能等级倍率；**高防保底 `MIN_DAMAGE=1`**。
- **两条收尾铁律**：① **战败保底 1 血** —— 回写 `CurrentHP` 走 `battle_room_handler._survive_hp_after_battle()`（>0 原样，<=0 → 1），PVE/PVP 两处都换掉 `max(0,...)`，客户端 `finishBattle` 同步抬到 1。② **升级必满血满蓝** —— `apply_level_up_full_restore(attrs)`，**只认 `level_up_count > 0`**，放在升星/独特成长/技能**之后**用最终 Max。
- 抽怪按玩家等级匹配（`_generate_enemy_snapshot`，`MonsterExtra._nominalLevel` 邻近优先）——**这才是怪物强度主因**。
- **改数值铁律**：①每只怪独立公式；②HP/MP 先降级再长回；③整集重建 + 改前备份；④`_rebalance_apply.py` 幂等；⑤`_verify_rebalance.py` 校验本地 vs 云端 383/383。

## 8. 技能系统（v6 · 2026-10-01）
> 细节见 `tools/skill_system_handoff.md`。
- **数据** `server/data/Skills.json` v6（34 条）+ 同源副本 `assets/resources/json/Skills.json`（**md5 必须一致**）；唯一入口 `tools/build_skill_table.py --apply`（一次写出两份 + LF；**勿手改 JSON、勿手动 cp**）。**改 `classes`/`reference_only`/`category`/`mp_pct`/`anim` 一律改生成器 `META` 表再 `--apply`**。
- **图标** = 图集 `assets/resources/SkillIcon/SkillIcon` 帧 `skill_1..5`（分类 `tools/skill_category_todo.md`）。⚠ **别拿背包图集（IconSet2/UI2）当技能图标**。
- ★**纳米侵蚀 0056 开放所有职业可学（10-01 拍板）**：`classes→all`、**删 `reference_only`**（不删谁都学不了）、`category ref→skill_1`、`type→通用`、`mp_pct None→20`（⚠原 `None` 使 `mp_cost()` = **0 消耗**）、**`anim jiguang01→leiting`**（用户指定；`jiguang01` 是单帧静态）。**参考项现全表 0**（分支保留，测试用假技能）；图鉴各线 13/14/15/32。备份 `_backup/Skills.v6.bak-before-nami-{open,anim}.json`，细节 `handoff §22.8`。
- **出招方式 `range`**（口径 `tools/skill_range_todo.md`）：格斗单体 `melee`(7) / 其余主动 `ranged` / `急速攻击` `dynamic`(持枪 28–51 → 远程) / 自动触发被动 `none`(2)；**总数 7/24/1/2**。⚠ **不按职业线自行推断**。
  - 读取：服务端 `skill_service.skill_range_of`/`is_ranged_skill`，客户端 `SkillData.skillRangeOf`/`isRangedSkill`。**两端同口径：读不到技能定义 → 按普攻口径兜底（持枪=远程，否则近身）**，绝不兜底成 `ranged`。
  - **近身技位移** `BattleScene.moveInForMeleeSkill()`：贴到目标身前（`MELEE_CONTACT_GAP=30`）→ 播特效 → `restore()` 滑回（`MELEE_RETURN_TIME=0.14`，幂等 + 0.3s 兜底）；自身/己方技不位移。**纯表现层**，服务端无距离规则（1v1 出手即命中）。
- **公式口径 A**：结算**只用 `formula_scaled`**（`a.atk ÷ 3` + 删末尾纯数字加项，`b.def` 不缩放）；**普攻三职业** 格斗 `(a.atk/3)*3` / 射击 `*2.5` / 全能 `*3.5`（后两者需持枪，否则回落格斗）。
- **技能等级**：Lv1–4 倍率 `[1.0,1.2,1.3,1.5]`（`floor`，只放大**伤害结果**），存宠物 `SkillLevels`；自动 `悟性/100×0.1`（仅 `lv_auto`）；手动 1/2/3 本 + 25/40/50 级（仅 `lv_manual`）。
- ⚠ **取数口径（最终）**：`list_castable_skills(learned_only=True)` **默认只列「已学」**；**新机甲面板为空是预期行为**（技能唯一来源 = 技能书）。曾改 False 列 12~14 条被用户否掉。
- **已学判定**：`is_learned` 无 `Skills` 字段 = **False**；`can_cast_skill` 的**战斗施放**仍「读不到就放行」——两回事。
- **技能书**：背包用书**只能「学会」**（未学 → Lv1 扣 1 本；已学 → 否决）；升级只走面板 `skill_level_up`。唯一落库入口 `skill_handler.apply_skill_book()` → 一次 `$set` 写 `Skills`+`SkillLevels`；**先写技能状态 → 再扣书**，失败用 **`$unset`** 回滚。⚠ 分支必须在 `handle_bag_use_item` 的 **`if item_data:` 之外、加载物品配置之前**（否则**静默扣 1 个**）。
- **round_events**（契约 `tools/_fixtures/round_events_sample.json`）：`{side, action, skill_key, skill_name, anim, level, repeats, mp_cost, mp_after, targets[], heals[], effects, pending_effects, failed}`。**字段名是 `action` 不是 `type`**。
- **UI 两处同构**（`MechSkillPanel`/`SkillSelectPanel`）：槽 `Skill{N}`（`Skill\d+` 升序）内 `Icon/SkillName/Level/SkillLevel`；不足 → **克隆首槽 + `setPosition(上一槽.x, 上一槽.y − 50)`**；槽 Button `transition=SPRITE`、**不用 `ev.target` 取点击节点** → 闭包捕获；图标走 `SkillIconAtlas.ts`。
- ⚠ **挂载铁律**：`SkillSelectPanel` **只能挂 `SkillSelect`**，绝不能挂 `BattleScene`（递归查找 → 点遮罩 `close()` → 关掉整个战斗面板，09-30 实证）。防护 `ensurePanelRoot()`/`isPanelRoot()`；守卫 `_test_scene_panel_mount.cjs`。
- **战斗链路**：`onSkillClicked()` → `open(petId,{onConfirm})` → 选槽 → `Confirm` → `close(false)` 后回调 `castSkill(key)`。`Mask` = 返回；`backButton` 面板开着时先关面板；**30s 倒计时归零 → 关面板 + 普攻**。
- 回归：`python tools/_skill_regression.py`（13 项；python 87/46/54/104/88/90/**59** + tsc 0 + 202 客户端 + 12 挂载自检 + pytest 99）。

## 9. 待办
- 清单 `docs/玩法功能开发清单.md`；性能 `docs/optimization-audit.md`（async 内裸调 Mongo 67 处待修）。
- 数值待拍板：高阶/低阶怪池稀薄；怪 MP 利用率；**服务端权威攻击次数结算未移植**；`Items.json` 掉落概率缺失。
- 待清理：临时诊断日志 `[攻击诊断]`/`[数字诊断]`/`[方向诊断]`。
- 技能剩余：①buff/状态口径待拍板；②**升级 UI 由用户自制**；③近身技位移已接（客户端），**服务端距离规则**未做；④云端未部署。
