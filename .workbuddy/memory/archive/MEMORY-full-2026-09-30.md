# MEMORY.md — JJFB 机甲风暴复刻（规则 / 铁律 / 索引）

> 只放**规则与索引**。成表明细见 `memory/archive/2026-09-30-明细归档.md`；逐日经过见 `memory/YYYY-MM-DD.md`（2026-09-28.md 最全）。

## 0. 最高优先 · 云端策略（用户拍板）
- 云端（8.140.236.16）**只保证 MongoDB 常驻**；不碰云端 ws_server / handlers / data / 不重启云端服务。
- **所有开发/修复/验证只在本地做**（`D:\jjfbol-cocos\jjfbol-cocos\jjfb`）。云端代码/数据由**用户自己上传**。
- 部署口径：本地改好 → 告知用户「已改好，待你上传」。仅当用户**明确要求**才动云端（且先备份）。

## 1. 关键路径
| 用途 | 路径 |
|---|---|
| 游戏工程（Cocos 3.8.7） | `D:\jjfbol-cocos\jjfbol-cocos\jjfb` |
| 单机复刻（RPGMaker MV，**只读权威源**） | `D:\机甲风暴开发素材合集\机甲风暴2` |
| 反汇编资料 | `C:\Users\Administrator\Desktop\Huibian\玩法文档` |
| 逆向包（21 ext / 22 世界节点） | `D:\Desktop\JJFBpojie` |
| 产出备份 / 剧本 | `C:\Users\Administrator\Desktop\JJFB机甲风暴_产出备份` |
| 生产库 MongoDB | `8.140.236.16:27017`（SCRAM-SHA-256 / authSource=admin；**勿落地明文**）；服务端 `/www/wwwroot/default/server` |
| Python（managed） | `C:/Users/Administrator/.workbuddy/binaries/python/versions/3.13.12/python.exe` |
| Node（managed） | `C:/Users/Administrator/.workbuddy/binaries/node/versions/22.22.2-3/node.exe` |

## 2. 数据 / 结构硬约定
- **MonsterBase 与 RobotBase/RobotPet 完全同构**：`RobotID/RobotName/AniID/Form/Class/Level/Growth/Comprehension/StarLevel` + 属性 `Xxx`/`CurrentXxx` 成对 + `MaxHP/CurrentHP`、`MaxMP/CurrentMP`、`MaxEXP/CurrentEXP`、`Jin`。
- 怪物专属字段全部收进 **`MonsterExtra`**；`RobotID = 100000 + MonsterID`。
- **结构变更后必须整集重建**（`col.drop()`，upsert 不清旧顶层字段）。新增集合须在 `handlers/utils.py` + `ws_server.py` + `migrations/m001_core_indexes.py` **三处**注册。
- `Items.json` **有三份**（`assets/resources/json/` → `server/data/` → `server/handlers/json/`）：改物品必须三份同改。
- 数值回填**一律显式判空 + clamp，绝不用 `or`**（`0 or max_hp` 会静默满血复活）。
- 排任何 item id 前**先扫现有 id 占用**。

## 3. 怪物资源命名（拼音首字母）
- 文件名/AniID = 中文名逐字拼音首字母小写 + `_L{stage}`（`枯骨魔龙→kgml_L1`），`AniID == 帧前缀`。
- 英文/数字保留（`山猫-RT→smrt`）；罗马数字 NFKC 归一（`野马Ⅲ→ymiii`）；`· - ｜` 丢弃；`|初/中/终` 截断。
- 重名追加 `_2`/`_3`；**99 个机甲动画名是保留字**（撞名会播成机甲）；同一中文名按阶段族一次性锁后缀（`AniKeyAllocator`）。
- pypinyin 缺失回退 GB2312 区位码；旧命名清理用显式 `--clean`（默认关）。

## 4. Cocos 资源 / 动画铁律
- 帧 + `.meta`（uuid + subMetas `6c48a` texture / `f9941` spriteFrame）；**运行时 `resources.load` 只能读 `assets/resources/`** → 动画常**双写**（编辑器目录 + resources 目录）。
- **克隆节点/组件必须重新生成唯一 `_id`**（重复 `_id` → 反序列化串位 → 血条不更新/状态机卡死）。改后双校验：`__id__` 无越界 + `_id` 无重复。
- 写回 `json.dump(..., ensure_ascii=False, indent=2)`；**禁用 `separators=(',',':')`**。
- 编辑器弹窗「Scene 数据已经修改」**必须点「不保存」**。
- 排查客户端异常**先看 `temp/logs/project.log`**；`.ts` 有 `SyntaxError` → 整 bundle 编译失败 → 全脚本报 `Missing class`。
- `scheduleOnce(callback, delay)` 以 `target+函数引用` 为键去重 → 递归调度同名函数必须包匿名闭包。
- `Logger.debug` 受 `DEBUG_MODE` 门控 → 诊断日志用 `Logger.warn`。
- 工程 `package.json` 有 `"type": "module"` → Node 脚本必须 `.cjs`；编译产物目录放 `{"type":"commonjs"}`。

## 5. 数值体系（v4 · 2026-09-28 定稿）
- **基准参照系 = 满配玩家**：顶配普攻 17272 / 单体技能 ≈32000（×1.85）/ 群攻满伤 ≈23000（×1.33）。普通怪满配必须 1 刀。
- **HP 分档**（`monster_formula.is_elite()`）：normal 系数 1.35 上限 17500 / elite 2.30 上限 26000 / boss 3.60 无上限（38617~60826）。
- **机甲基准曲线**（`server/data/Classes.json` note，`a~o`）：HP `lv*253+300`、MP `lv*174+150`、近战/射击 `lv*40+315`、装甲 `lv*13+16` / 闪避 `lv*13+12`、先制 `lv*30+15`；**命中/致命/侵蚀/抗性 机甲恒 0**（靠装备）。
- **战斗结算（2026-09-30 起）**：走 RPG Maker MV 全链 —— 公式（`Skills.json` 的 `formula_scaled`）→ 元素/物理率 → 暴击(×3) → 浮动(±variance%) → 防御减半(`/(2×grd)`) → 技能等级倍率。**高防保底 `MIN_DAMAGE=1`**（RPG 原义 0，本工程扩展）。`attack = Melee + Shooting`、`defense = Armor` 不变。
- **收尾两条铁律（2026-09-30 用户拍板）**：
  - **战败保底 1 血**：战斗结束回写 `CurrentHP` 一律走 `battle_room_handler._survive_hp_after_battle()`（>0 原样，<=0 → `BATTLE_SURVIVE_HP=1`）；PVE/PVP 两处都换掉了 `max(0, ...)`（0 血 = 死尸，出不了战）。客户端 `BattleScene.finishBattle` 同步把 `playerUnit.hp` 抬到 1。
  - **升级必满血满蓝**：`RobotUpgradeManager.apply_level_up_full_restore(attrs)`（CurrentHP=MaxHP、CurrentMP=MaxMP，缺 Max 不动）。**只认 `level_up_count > 0`**，放在升星/独特成长/技能之后用最终 Max；四处升级路径全接（`add_exp_to_robot` / `_atomic` / `robot_handler` 批量升级 / 等级修正）。
  - ⚠ 判断「倒下/空蓝」**绝不用 `or`**（`0 or max_hp` → 静默满血）。

- 公式引擎 `tools/monster/monster_formula.py`（v4）：`mech_curve()` + `MONSTER_ONLY`（命中=lv*22+180 / 致命=lv*18+150 / 侵蚀·抗性=lv*9+80）+ `tier_of()` 1~7 + `nominal_level()` + `monster_coef()`（每只怪每属性独立确定性系数）+ `is_elite()`。参数 `ATK_SCALE=0.75` / `DEF_SCALE=0.90` / `TIER_COEF`。
- 抽怪按玩家等级匹配（`battle_room_handler._generate_enemy_snapshot`）：优先 `MonsterExtra._nominalLevel ∈ [玩家等级-6,+10]` → ±18 → 不限。**这才是怪物强度主因**。
- 经验曲线 `robot_upgrade.py` `ROBOT_LEVEL_TOTAL_EXP`：L51~L60 走 1.20x 平滑递推，总累计 1.009 亿（v3）。
- **改数值铁律**：①每只怪独立公式；②HP/MP 先降级再长回；③整集重建 + 改前备份；④`_rebalance_apply.py` 幂等（从 `monsterbase_export.pre_rebalance.json` 重推）；⑤`_verify_rebalance.py` 校验本地 vs 云端 383/383。
- 审计/可视化：`docs/数值体系审计报告_v4.md`、`docs/全量生物机甲属性对比_L60.html`（生成器 `tools/monster/gen_attr_html.py`）。

## 6. 技能系统（v5 · 2026-09-30 落地）
- **权威数据**：`server/data/Skills.json` v5（34 条）+ 同源副本 `assets/resources/json/Skills.json`（**md5 必须一致**）。唯一维护入口 `tools/build_skill_table.py`（改完重生成，勿手改 JSON）。
- **技能图标口径（用户拍板）**：图标 = 图集 `assets/resources/SkillIcon/SkillIcon` 的帧 `skill_{分类}`（1–5），分类见 **`tools/skill_category_todo.md`**（用户填表，缺省 `skill_1`）。`Skills.json` 每条带 `iconIndex`。
  - ⚠ 资源原在 `assets/UI/Skill_icon/`（不可 `resources.load`），**2026-09-30 已移入 `assets/resources/SkillIcon/`**（uuid 未变）。
  - ⚠ **不要拿背包图集（IconSet2 / UI2）当技能图标** —— 那是 `BagItem.ts` 的物品图标。
- **公式缩放口径 A（用户拍板）**：实际结算**只用 `formula_scaled`** = `a.atk ÷ 3` 且删末尾纯数字加项（`b.def` 不缩放）；`formula` 是 RPG 原式，**仅溯源不参与结算**。格斗普攻 ≡ `攻击 − 装甲`（零回归）。
- **普攻三职业三公式**（`normal_attack.enabled=true`）：格斗 `(a.atk/3)*3`、射击 `*2.5`（需持枪 id 28–51）、全能 `*3.5`（需持枪）；不持枪回落格斗。variance 20 / critical true。
- **技能等级**：Lv1–4、倍率 `[1.0,1.2,1.3,1.5]`（`floor(base×mult)`，只放大**伤害结果**）；存机甲宠物文档 `SkillLevels`（每机甲每技能独立）。
  - 自动升级：机甲**每升 1 级**逐技能判定 `悟性/100 × 0.1`（4%~10%），仅 `lv_auto` 技能参与 → 挂钩 `RobotUpgradeManager._apply_skill_level_ups`（`skill_ups_out` 为**可选**参数，不破坏旧调用）。
  - 手动升级：Lv2/3/4 需技能书 1/2/3 本 + 等级 25/40/50，仅 `lv_manual` 技能可升。
- **新增服务/模块**：`services/skill_service.py`（目录+归一+普攻+消耗+可施放）、`services/skill_formula.py`（AST 白名单求值，**禁 eval**，`min_value` 扩展）、`services/skill_level_service.py`（等级存储/升级）、`handlers/skill_handler.py`（`skill_level_up` / `skill_list`）。
- **「已学」校验**：`can_cast_skill` 校验已学（客户端本可提交任意 skill_key）；**读不到 `Skills` 字段时一律放行**（老数据/怪物不然会被整体锁死）。两端同口径。
- **技能面板取数口径（2026-09-30 用户拍板 · 最终）**：`list_castable_skills(actor, learned_only=True, class_line=None, include_reference=False)` —— **默认只列「已学」**。
  - ⚠ **机甲初始 / 获得时技能为空**（云端只读实测 `RobotPet` 15 只**连 `Skills` 字段都没有**；`RobotBase` 81 条也没有；原工程 `Actors.json` 200 个角色 `skills` 全是 `None`）。技能**唯一来源 = 技能书学会** ⇒ **新机甲面板为空是预期行为**，不是 bug。
  - 过滤顺序：`reference_only` → `category=="skill_3"`（自动触发技恒剔除）→ `learned_only`（只留已学）；若 `learned_only=False`（「技能图鉴」模式）则改按**职业线**（`classes == 本机线` 或 `all`；推断不出则不过滤）。图鉴模式实测：格斗 **12** / 射击 **13** / 全能 **14** / Class 缺失 31。
  - 条目带 `learned` / `reference_only` / `iconIndex` / `level`。客户端 `SkillData.listCastableSkills` 完全同口径（`learnedOnly` 默认 **true**、`classLine` / `includeReference` / `CastContext.classLine`）。
  - ⚠ **反面教训**：曾一度把默认改成 `learned_only=False`（按职业线列 12~14 条）—— 被用户否掉：「**每个机甲默认就该没技能**」。
- **客户端**：`assets/Script/Game/SkillData.ts`（纯逻辑，与服务端同函数名）+ `BattleScene.ts`：`castSkill(key)` 提交技能指令、`playRoundEvents()` 按 `round_events` 演绎整回合（**无 round_events 自动回落 HP 差值路径**）、`onLoad` 注入 `json/Skills` 目录。
- **技能面板（MechSkill）**：`assets/Script/Game/MechSkillPanel.ts` —— **零 `@property`**（挂上去不用拖任何属性），用户已**显式挂在 `MechSkill` 节点**；`RobotAttributePanel.ensureSkillPanel()` 先 `getComponent` 取显式挂的那个、取不到才 `addComponent` 兜底（兜底打一次 info 提示）。递归找 `Skill{N}` 槽（升序）、槽内按名找 `Icon`/`SkillName`/`SkillLevel`、不足则克隆首槽、`resources.load` 取图集。节点约定：`MechSkill → BG → Skill1 → {Icon, SkillName, Level(静态标题), SkillLevel}`。
  - **槽位排布（用户约定）**：技能多于已有槽位时，**往下复制一份、y 轴 − 50** → 新槽 y = **上一个**槽 y − 50（`SLOT_STEP_Y = 50`，基于上一个槽而非模板，连续复制才逐级递减）；多余槽隐藏。场景里美术若已手搭 `Skill2/Skill3`，直接按名识别使用、不改其位置。
- **round_events 结构**（契约测试 `tools/_fixtures/round_events_sample.json`，生成器 `tools/_gen_round_events_fixture.py`）：`{side, action, skill_key, skill_name, anim, level, repeats, mp_cost, mp_after, targets[{side,kind,damage,crit,hp_after,mp_after,drained}], heals[{side,attr,value,cur,max,from}], effects, pending_effects, failed}`。**字段名是 `action` 不是 `type`**。
- buff / 状态类效果**只记录不改属性**（`pending_effects`，口径待拍板）；治疗/护盾不吃等级倍率；吸血 `drain_ratio=0.5`。
- **技能书使用（v5 起）**：口径出处 —— `Z_skill.js`（**职业限制**：格斗书 36–40 / 射击 41–45 / 全能 46–51，**55 三职业通用**；提示文案「技能学习成功！」但**没写 learnSkill = 伪实现**）+ `Z_SkillLevel.onSkillUpgrade`（升级：满级 → 不支持升级 → 机甲等级 25/40/50 → 书 1/2/3 本 → `loseItem` → `setSkillLevel`）。
  - 本工程口径（`services/skill_book_service.py`）：背包「使用技能书」= ①职业不匹配/②参考项 → 否决（**不扣书**）；③**已学 → 否决「已经学会，不能再学习了」**（★2026-09-30 用户拍板：技能书**只用来「学会」**）；④**未学 → 学会 Lv1**（消耗 1 本，补全 `Z_skill.js` 伪实现，`LEARN_WHEN_UNLEARNED=False` 可关）。
  - **升级**只能在技能面板 UI 点「升级技能」→ `skill_level_up`（1/2/3 本 + 25/40/50 级，仅 `lv_manual`）—— 两条入口互不重叠。
  - **唯一落库入口** `handlers/skill_handler.apply_skill_book()`（背包用书调用）。两者共用 `commit_skill_state` / `consume_books` / `rollback_skill_state`（`commit_levels` / `rollback_levels` 保留为薄包装）。
  - **落库形状（兼容旧数据）**：学会时一次 `$set` 写 **`Skills`（key 数组）+ `SkillLevels`**；**字段不存在时 `$set` 自动创建** → 旧玩家无缝接入。`is_learned` 口径已改：**无 `Skills` 字段 = 一个技能都没学（False）**，不再返回 None（`can_cast_skill` 的**战斗施放**仍保留「读不到就放行」，那是为了不锁死怪物/老数据，两回事）。
  - **顺序铁律**：先写技能状态 → 再扣书；扣书失败**回滚**（原本没有 `Skills` 时用 **`$unset`** 删掉本次新建的字段，而不是留空数组）。
  - ⚠ 技能书分支必须放在 `handle_bag_use_item` 里 **`if item_data:` 之外、加载物品配置之前** —— `item_data` 取不到时下面的流程会**静默扣 1 个**。
  - 客户端：`bag_use_item` 响应带 `target_type='Pet'` + `pet_id` + `effect_result` + 结构化 `skill_book`；`BagItem.onUseItemResponse` 据此自定义提示并调 `MechSkillPanel.refreshForPet()`（面板节点默认 inactive，`getComponentInChildren` 找不到 → 用静态实例登记表）。
  - **技能书 id（2026-09-30 起 34 个技能全有书）**：0036–0051 / 0076–0089 沿用原规划；**0090 纳米攻击 / 0091 弱点攻击**为本次补（原先「无书」的 2 个悟性技）。生成链：`build_skill_table.py --apply`（分配 `book_id`）→ `patch_items_skillbooks.py --apply`（三份 Items.json 落库，脚本只补 `book_id ≥ 76` 的）。
  - 回归：`tools/_test_skill_book.py`（80 项纯逻辑）+ `server/tests/test_skill_book_use.py`（14 项 FakeMongo 落库/回滚/旧数据兼容集成）。
- ⚠ **所有技能书的「背包使用」都只能「学会」**；`lv_manual` 只影响**技能面板升级**那条路（悟性技 `lv_manual=false` → 连 GUI 升级也不给，只能靠升级自动悟）。
  - ⚠ `patch_items_skillbooks.py` 备份名必须带**目标路径**（三份同名 Items.json 曾因只用「时间戳+basename」互相覆盖，2026-09-30 已修）。
- 回归入口：`python tools/_skill_regression.py`（10 项：87/46/54/100/80 python + tsc + 178 客户端 + 13 挂载自检 + pytest）。
- **技能 UI 两处（同构）**：
  - 机甲面板 `MechSkill` + `assets/Script/Game/MechSkillPanel.ts`（展示：图标/名字/等级）。
  - 战斗内技能选择 `SkillSelect` + `assets/Script/Game/SkillSelectPanel.ts`（选中 → `Confirm` 才出现 → 施放）。
  - 共同约定：槽节点 `Skill{N}`（正则 `Skill\d+` 升序），槽内 `Icon/SkillName/Level/SkillLevel`；
    槽位不足 → **克隆首槽 + `setPosition(上一个槽.x, 上一个槽.y − 50)`**；槽 Button `transition=SPRITE`、
    **不要用 `ev.target` 取点击节点**（click 事件参数是 Button 组件本身）→ 用闭包捕获节点。
  - 图标加载/取帧/缺帧回退**统一走 `assets/Script/Game/SkillIconAtlas.ts`**（全局单例缓存，两面板共用）；
    图标帧 = `iconIndex`（`skill_1..5`，缺省 `skill_1`），图集在 `assets/resources/SkillIcon/`。
  - ⚠ **挂载位置铁律**：`SkillSelectPanel` **只能挂 `SkillSelect`**，绝不能挂 `BattleScene` 等父节点。
    面板内查找是递归的 → 挂在父节点上的副本也能找到 `SkillSelect/Mask`，一点遮罩就 `close()`
    → `node.active=false` 作用在父节点 = **整个战斗面板被关掉**（2026-09-30 实证）。
    防护：`ensurePanelRoot()` / `isPanelRoot()` 用「**直接**子节点含 `Mask`+`Confirm`」自检，
    不通过就 `Logger.error` + `enabled=false`（误挂副本永不改 `active`）；静态守卫
    `tools/_test_scene_panel_mount.cjs`（扫 `Game.scene`，启用副本必须在面板根，已进回归第 8 步）。
- **战斗技能链路（2026-09-30 完成）**：`BattleScene.onSkillClicked()` → `SkillSelectPanel.open(playerUnit.petId, {onConfirm})`
  → 点槽选中 → `Confirm` → `close(false)` 后回调 `BattleScene.castSkill(key)` → `{action_type:'SKILL', skill_key}`。
  `Mask` 点击 = 「返回」（只关面板）；`backButton` 在面板开着时**先关技能面板**；
  **30s 倒计时归零 → `closeSkillSelectPanel()` + 普通攻击**；另有 6 处流程节点顺手关面板
  （onEnable / startNewBattle / sendBattleRoomAction / tryResolveRound / 服务器回合动画 / finishBattle）。
  两个 `@property`（`skillButton` / `skillSelectPanel`）**可挂可不挂**（运行时按名查找 + `addComponent` 兜底）。
- `Component.scheduleOnce/unschedule` 在**未激活节点**的组件上不可靠（`SkillSelect` 场景初始 inactive）
  → 这类面板的临时提示别用定时器，改成「下次渲染/关闭时还原」。

## 7. 「攻击次数」AttackCount
- 字段：主字段 `AttackCount`（+`CurrentAttackCount` 成对）、装备 JSON `attackCount`；已全面取代 `ParticleShield`，默认 1。
- **语义 = 总段数**；客户端 `computeAttackSegments(baseDamage, attackCount)` 直接当段数。
- 取值优先级：顶层 `CurrentAttackCount` → `AttackCount`/`attackCount` → 装备各槽 `attackCount` 累加（=1+Σ）→ effecttext「攻击次数+N」→ 兜底 1。
- **总伤上限恒 +20%**：`boost=rand^1.6*0.20`；每段权重 ×(0.65~1.35)，末段吸收误差使 Σ段=floor(base×(1+boost))。**段数只影响打击感**。
- 明细见归档 §D。

## 8. PVP 机制铁律
- 「空窗挽回期」：无操作满 5s 才激活倒计时 → 归零自动普攻；每方满 2 轮转永久接管（`auto_actions`）；玩家提交/重连即解除。**仅 PVP 双方真人**。
- **回合结算必须主动推送**：`_notify_pvp_round_settled` → handler `_push_pvp_round_update` → `utils.push_to_user`（视角交换后 `pvp_round_update`）。
- **【推送载荷层级铁律】`push_to_user` 把业务载荷包进 `data` 字段** → 报文是 `{type, success, code, timestamp, version, data:{...}}`；**消费方必须读 `msg.data.state`**（读 `msg.state` 得 undefined = 挂机方黑屏）。
- PVP 与 PVE **共用同一表现层**：actor 构建 → `state.*.raw` → `buildUnitFromRobotInfo` → `resolveAttackTimes` → `computeAttackSegments`。
- 明细见归档 §E/§F/§G。

## 9. 开发清单与待办
- 三方比对清单 `docs/玩法功能开发清单.md`（P0×10/P1×15/P2×15）；性能 `docs/optimization-audit.md`（async 内裸调 Mongo 67 处待修）。
- 数值后续（待拍板）：高阶怪池稀薄（L50 仅 2 只、L60 仅 7 只全 elite）；低阶怪池稀薄；怪 MP 利用率；**服务端权威攻击次数结算未移植**；`Items.json` 掉落概率缺失致经济闭环未闭。
- 待清理：临时诊断日志 `[攻击诊断]`/`[数字诊断]`/`[方向诊断]`（三组 `Logger.warn`）。
- 技能系统：**逻辑层已完成**（§6）；**技能书使用已接入**（§6）；**战斗内选技 UI 已接入**（`SkillSelect` + `SkillSelectPanel`，§6）。剩余：①buff/状态（层数/持续回合/强度）口径待用户拍板（现仅 `pending_effects` 记录）；②**技能「升级」UI 由用户自制**，做好后叫我接 `skill_list` / `skill_level_up` / `castSkill`；③云端未部署（按最高优先策略，等用户上传）。

## 10. 通用硬规则（用户长期要求）
- 只做指定内容，不超范围、不主动提议、不替用户做决定；不劝放弃。
- 先结果后解释，被问才展开；先自测跑通再交付，有问题自己查。
- **禁止**通过新开对话/清会话/重置 session 腾上下文；压缩只归档不删除；**禁止删除任何归档/日志/memory**。
- 有竞态风险：**禁止并行编辑同一文件**，串行改。
- 口径不确定**先问，不猜**。
- 回头写日志用 `_audit_bag_write(user_id, character_id, action, **fields)` —— **第三个位置参数就叫 `action`**，
  调用时**不能**再传 `action=`（否则 `TypeError: got multiple values`，客户端只看到「使用物品失败」）。
  改传 `skill_action=` 之类。已有静态守卫：`tools/_test_skill_book.py` 第 8 节扫调用点。
- **普通攻击不播技能特效**（2026-09-30 用户要求）：`BattleScene` 的 `NORMAL_ATTACK_SKILL_CLIP/REPEAT` 已删除，
  普攻 `onImpact` 只弹伤害数字。技能特效仅由 `round_events[].anim` 驱动。
- **组件挂载偏好（用户）**：面板/功能组件要在编辑器里**显式挂载**（可发现性优先，避免以后找不到对应关系）；
  运行时 `addComponent` **只作兜底**，且要打一次提示让人知道漏挂了。组件本身做成**零 `@property`**
  （靠节点名递归查找），这样显式挂载时也不用拖任何引用。
