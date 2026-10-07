# MEMORY.md — JJFB 机甲风暴复刻（规则 / 铁律 / 索引）

> **只放规则**。全文快照 `memory/archive/MEMORY-full-2026-10-01.md`；成表明细 `memory/archive/2026-09-30-明细归档.md`；逐日经过 `memory/YYYY-MM-DD.md`；技能口径 `tools/skill_system_handoff.md`；地图管线 `tools/rpg_map_pipeline_research.md`。

## 1. 通用硬规则（最高优先）
- 只做指定内容，不超范围、不主动提议、不替用户做决定；不劝放弃。
- 先结果后解释，被问才展开；先自测跑通再交付，有问题自己查；**不猜，口径不确定先问**。
- **禁止**新开对话/清会话/重置 session 腾上下文；压缩只归档不删除；**禁止删除任何归档/日志/memory**。
- **禁止并行编辑同一文件**（竞态），串行改。
- `_audit_bag_write(...)` 第三位置参数已叫 `action` → 调用**不能再传 `action=`**（改传 `skill_action=`）。
- **普攻不播技能特效**（只弹数字）；特效仅由 `round_events[].anim` 驱动。
- **组件挂载偏好**：面板组件**零 `@property`**（靠节点名递归查找）+ 编辑器**显式挂载**；运行时 `addComponent` 只作兜底并打一次提示。
- 云端（8.140.236.16）**只保证 MongoDB 常驻**；不碰云端 ws_server / handlers / data、不重启云端服务。**开发/修复/验证只在本地**，云端由**用户自己上传**；仅用户明确要求才动云端（先备份）。

## 2. 关键路径
| 用途 | 路径 |
|---|---|
| 游戏工程（Cocos 3.8.7） | `D:\jjfbol-cocos\jjfbol-cocos\jjfb` |
| 剧本编辑器 Juben（拟弃用） | `D:\jjfbol-cocos\Juben` |
| 单机复刻（RPGMaker MV 1.6.1，**只读权威源**） | `D:\机甲风暴开发素材合集\机甲风暴2` |
| 反汇编 / 逆向包 | `C:\Users\Administrator\Desktop\Huibian\玩法文档` · `D:\Desktop\JJFBpojie` |
| 生产库 | `8.140.236.16:27017`（SCRAM-SHA-256 / authSource=admin；**勿落地明文**）；`/www/wwwroot/default/server` |
| Python / Node（managed） | `~/.workbuddy/binaries/python/versions/3.13.12/python.exe` · `.../node/versions/22.22.2-3/node.exe` |

## 3. 数据 / 结构铁律
- **MonsterBase 与 RobotBase/RobotPet 同构**（`RobotID/RobotName/AniID/Form/Class/Level/Growth/Comprehension/StarLevel` + `Xxx`/`CurrentXxx` 成对 + `MaxHP/HP`、`MaxMP/MP`、`MaxEXP/EXP`、`Jin`）；怪物专属字段收进 **`MonsterExtra`**；`RobotID = 100000 + MonsterID`。
- **结构变更必须整集重建**（`col.drop()`；upsert 不清旧顶层字段）。新增集合须在 `handlers/utils.py` + `ws_server.py` + `migrations/m001_core_indexes.py` **三处**注册。
- `Items.json` **有三份**（`assets/resources/json/` → `server/data/` → `server/handlers/json/`）：改物品必须三份同改。排 item id 前**先扫占用**。
- 数值回填**一律显式判空 + clamp，绝不用 `or`**（`0 or max_hp` = 静默满血）。

## 4. Cocos 铁律
- **用到 cc 类型必须 import**（`JsonAsset`/`SpriteAtlas`…）；漏 → `ReferenceError` 被 `try/catch` 吞成「静默降级」→ **包住的初始化必须能被日志看见**。
- **运行时 `resources.load` 只能读 `assets/resources/`** → 资源**双写**。移资源必须 `.meta` 同迁；帧 `.meta` 需 subMetas `6c48a`/`f9941`。
- ★**素材重生成必须复用 uuid**：换 uuid → 场景/预制体（`RobotShow.prefab`）引用**全断→静默不播**。生成器用 `existing_uuid()`；改完查「引用==meta uuid」+「prefab 全命中」。守卫 `tools/_test_skill_anim_assets.py`。
- ★**画布 = 全动画图元并集，禁止固定 192**：MV 是 16 个独立 cell Sprite，`position=3` 偏移可达 ±408 → 固定画布**静默裁掉 211/251 个图元**。自检 `--check`；改尺寸后**必须同步 `library/` 缓存**。
- **克隆节点/组件必须重新生成唯一 `_id`**（重复 → 反序列化串位 → 血条不更新/状态机卡死）。改后双校验 `__id__` 无越界 + `_id` 无重复。
- 写回 `json.dump(..., ensure_ascii=False, indent=2)`；**禁 `separators=(',',':')`**。编辑器弹「Scene 数据已经修改」→ **点「不保存」**。
- 排查异常**先看 `temp/logs/project.log`**；`.ts` 有 `SyntaxError` → 整 bundle 编译失败 → 全脚本 `Missing class`。
- `Logger.debug` 受 `DEBUG_MODE` 门控 → 诊断日志用 `Logger.warn`。`scheduleOnce` 以 `target+函数引用` 去重 → 递归调度须包匿名闭包；组件**未激活**时不可靠。
- 表现层兜底**必须与「既有同类逻辑」一致**（如技能距离兜底 = 普攻口径：持枪=远程），不能兜底成看起来最"安全"的那侧。
- 工程 `package.json` 有 `"type": "module"` → Node 脚本必须 `.cjs`。

## 5. 怪物资源命名（拼音首字母）
`AniID` = 中文名逐字拼音首字母小写 + `_L{stage}`（`枯骨魔龙→kgml_L1`），`AniID == 帧前缀`。重名追加 `_2`/`_3`；**99 个机甲动画名是保留字**；同中文名按阶段族一次性锁后缀（`AniKeyAllocator`）；清理用 `--clean`（默认关）。细节见归档。

## 6. PVP 铁律
「空窗挽回期」无操作满 5s 才激活倒计时 → 归零自动普攻；每方满 2 轮转永久接管；**仅双方真人**。回合结算**必须主动推送**。
⚠ **载荷层级**：`push_to_user` 把业务包进 `data` → 消费方读 **`msg.data.state`**（读 `msg.state` = undefined → 挂机方黑屏）。
PVP/PVE **共用表现层**。「攻击次数」语义 = **总段数**，总伤上限恒 +20% → **段数只影响打击感**。

## 7. 数值体系（v4 · 09-28 定稿）
基准 = **满配玩家**（普攻 17272 / 单体 ≈32000 / 群攻 ≈23000，普通怪满配必 1 刀）；HP 分档 `is_elite()` normal 1.35≤17500 / elite 2.30≤26000 / boss 3.60 无上限。机甲曲线见 `Classes.json` note（HP `lv*253+300`、MP `lv*174+150`、近战/射击 `lv*40+315`、装甲 `lv*13+16`、闪避 `lv*13+12`、先制 `lv*30+15`；**命中/致命/侵蚀/抗性 机甲恒 0**）。
战斗结算 = `formula_scaled` → 元素/物理率 → 暴击(×3) → 浮动(±variance%) → 防御减半(`/(2×grd)`) → 技能等级倍率；**高防保底 `MIN_DAMAGE=1`**。抽怪按 `MonsterExtra._nominalLevel` 邻近匹配（**怪物强度主因**）。
**两条收尾铁律**：①**战败保底 1 血**（`_survive_hp_after_battle()`；PVE/PVP + 客户端 `finishBattle` 三处）；②**升级必满血满蓝**（`apply_level_up_full_restore()`，只认 `level_up_count>0`，放升星/成长/技能**之后**）。
**改数值铁律**：①每只怪独立公式 ②HP/MP 先降级再长回 ③整集重建 + 改前备份 ④`_rebalance_apply.py` 幂等 ⑤`_verify_rebalance.py` 校验本地 vs 云端 383/383。

## 8. 技能系统（v6 · 10-01）
> **全部细节见 `tools/skill_system_handoff.md`**，此处只留最易踩的几条。
- **数据唯一入口** `tools/build_skill_table.py --apply`（一次写 `server/data/` + `assets/resources/json/` 两份 + LF，**md5 必须一致**）。改 `classes`/`reference_only`/`category`/`mp_pct`/`anim` 一律改生成器 `META` 再 `--apply`，**勿手改 JSON**。**图标** = `assets/resources/SkillIcon/SkillIcon` 帧 `skill_1..5`（分类 `tools/skill_category_todo.md`）；⚠ **别拿背包图集（IconSet2/UI2）当技能图标**。
- **`range` 出招方式**：`melee`(7) / `ranged`(24) / `dynamic`(1，持枪 28–51→远程) / `none`(2 被动)。**读不到技能定义 → 按普攻口径兜底（持枪=远程）**，绝不兜底成 `ranged`。`moveInForMeleeSkill()` 是**纯表现层**，服务端无距离规则。
- **公式口径 A**：结算**只用 `formula_scaled`**（`a.atk÷3` + 删末尾纯数字加项）；**普攻三职业** 格斗 `(a.atk/3)*3` / 射击 `*2.5` / 全能 `*3.5`（后两者需持枪）。**等级** Lv1–4 倍率 `[1.0,1.2,1.3,1.5]`（只放大伤害结果）；`lv_auto` 靠升级悟（`悟性/100×0.1`），`lv_manual` 靠面板 + 1/2/3 本书 + 25/40/50 级。
- ⚠ **取数口径**：`list_castable_skills(learned_only=True)` **默认只列「已学」**；**新机甲面板为空是预期行为**（技能唯一来源 = 技能书）。曾改 False 被用户否掉。
- **技能书**：背包用书**只能「学会」**（未学→Lv1 扣 1 本；已学→否决）；升级只走面板。唯一落库入口 `skill_handler.apply_skill_book()`（一次 `$set` 写 `Skills`+`SkillLevels`，**先写状态→再扣书**，失败 `$unset` 回滚）。⚠ 分支必须在 `handle_bag_use_item` 的 **`if item_data:` 之外**（否则**静默扣 1 个**）。
- **round_events** 字段名是 **`action` 不是 `type`**。**UI 两处同构**（`MechSkillPanel`/`SkillSelectPanel`）：槽 `Skill{N}` 内 `Icon/SkillName/Level/SkillLevel`，不足则**克隆首槽 + y − 50**；**不用 `ev.target`** → 闭包捕获。⚠ `SkillSelectPanel` **只能挂 `SkillSelect`**，绝不能挂 `BattleScene`（递归查找 → 点遮罩 → 关掉整个战斗面板）。
- 回归：`python tools/_skill_regression.py`（13 项；python 87/46/54/104/88/90/85 + tsc 0 + 202 客户端 + 12 挂载自检 + pytest 99）。

## 9. RPG Maker MV 地图管线（10-01 · 待拍板）
> 报告 `tools/rpg_map_pipeline_research.md` + `rpg_map025_layer_split_report.md`；技能 `~/.workbuddy/skills/rm-map-port/`。**未开工。**
- **可行**：24 张 / 39,221 格 / 48px；`rpg_map_render.py` 完整复刻 MV 绘制规则（普通图块 + A1–A4 形状表 + 阴影 + lower/upper 两趟），**24/24 正确**。`data[]` 索引 `(z*h+y)*w+x`；只画 z0–z3，**z4=阴影位**（`w*h*6` 伪 6 层）；**★上层块=0**。
- **现有 24 张无真分层**：z2 独有格数**全 0**（z2 ⊆ z3）→ 要分层得在 MV 重画。
- **剧情不在 RPG**：对话仅 28 行（全功能文案）；真身在 `assets/resources/Sample/剧情脚本/map_*.json` + `server/data/story_maps/`（Juben 双写）→ **弃 Juben 的前提＝剧情以后写进 MV 事件**。
- **点位** 140 条（95 条 201 传送门）；`逻辑.x=rpgX*48+24`、`逻辑.y=24-rpgY*48`（同 `tilemap-coords.ts`）。
- **体积**：分层 PNG 磁盘仅 **4.9 MB**；瓶颈是**显存 703 MB**（最大图单层 38.7 MB）→ 切块 + 相机 streaming。
- **路线**：**TMX 优先**（客户端零改动、原生分层、显存低、分块现成；`MAP1/MAP4/ITEM01.png` 与 RPG 工程逐像素一致）；**分层 PNG 次之**（需新渲染组件）。
- ⚠ **坑**：①`MAP1/MAP15/ITEM01` 被裁 → **3.1% 越界**；②Map001 625 格 A2 引空槽（死数据）；③Map022「剧情」零图块；④10 种插件命令 + `CreatePet` 需人工映射；⑤立绘↔行走图非一一对应。
- **⭐ Map025 语义分层（已验证无损）**：**分层依据＝tile id 段，不是 z 层**。B/C/D **同挂 MAP1**，用户靠「从哪页签取图块」编码语义：**B=地面(草地) / C=墙壁(石墙·外框) / D=路面(黄土路) / E=植物等不可通行**；z3 四段正好铺满 1200 格；按「地面→墙壁→路面→植物」叠加 **md5 == MV 原生渲染（逐字节一致）**。z2 仍是假分层（`E779` 与 `B238` 完全同格，且 **E779 像素全透明=空图块**）→ **导出只取 z3**。
  - ⚠ B/C/D 同图 → **240 组「同像素不同 id」** → 编辑器三页签一样、**靠记忆必错**（已抓到 `C481/C486` 画成草地）；tileset 18 的 **`flags` 长度只有 1** → **通行性未标记**（不可通行只在约定里）。
  - ⚠ **地面层 11 个洞**：那 11 格 z2/z3 画的都是石墙（C 段，z2 下半截 + z3 上半截）→ 两层都没地面；**不是填充漏了，是画墙落错层**。补洞版 `Map025_L1_ground_filled.png`（补 id238）与 MV 合成 **0 像素差异** → Cocos 用这张做底图。另 **z2 有 728 格是空图块 `E779`**（MAP15.png 透明区，"填了＝没填"，被 z3 草地盖住看不出）。
  - 工具：`tools/rpg_map_layers.py`（`--map N --band/--ids/--zsplit`）+ `rpg_map025_visual.py` + `rpg_map025_holes.py`；产物 `_preview/rpg_maps025/layers/`（`Map025_L{1..4}_*.png` + `_ground_filled` + manifest）。

## 10. 待办
- 清单 `docs/玩法功能开发清单.md`；性能 `docs/optimization-audit.md`（async 内裸调 Mongo 67 处待修）。待清理：临时日志 `[攻击诊断]`/`[数字诊断]`/`[方向诊断]`。
- 数值待拍板：高阶/低阶怪池稀薄；怪 MP 利用率；**服务端权威攻击次数结算未移植**；`Items.json` 掉落概率缺失。
- 技能剩余：①buff/状态口径 ②**升级 UI 用户自制** ③服务端距离规则 ④云端未部署。地图管线：等拍板报告 §7 五问。
