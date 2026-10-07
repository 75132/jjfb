# MEMORY.md — JJFB 机甲风暴复刻（索引 / 铁律）

> **只放索引与最硬的规则，刻意保持短（<3000 字）**。逐日经过 `memory/YYYY-MM-DD.md`；
> 全文快照 `memory/archive/MEMORY-full-*.md`。专题正文：
> `cocos_rules.md`（Cocos + 怪物命名）· `game_numeric.md`（数值 v4）· `pvp_rules.md` ·
> `rpg_map_pipeline.md`（地图管线 + 图块工坊）· `tools/skill_system_handoff.md`（技能系统 v6）。

## 1. 通用硬规则
- 只做指定内容，**不超范围、不主动提议、不替用户做决定、不劝放弃**。先结果后解释，被问才展开；**先自测跑通再交付**；口径不确定先问。
- **禁止**新开对话/清会话/重置 session 腾上下文；压缩只归档**不删除**；**禁止删任何归档/日志/memory**。**禁止并行编辑同一文件**（竞态），串行改。
- 云端（8.140.236.16）**只保证 MongoDB 常驻**：不碰云端 ws_server / handlers / data、不重启云端服务；**开发/验证只在本地**，云端由**用户自己上传**（仅用户明确要求才动，且先备份）。
- `_audit_bag_write(...)` 第三位置参数已叫 `action` → **不能再传 `action=`**（改传 `skill_action=`）。
- **普攻不播技能特效**；特效只由 `round_events[].anim` 驱动。

## 2. 关键路径
- 游戏工程（Cocos 3.8.7）`D:\jjfbol-cocos\jjfbol-cocos\jjfb`；剧本编辑器 Juben（拟弃用）`D:\jjfbol-cocos\Juben`
- 单机复刻（**只读权威源**，RPGMaker MV 1.6.1）`D:\机甲风暴开发素材合集\机甲风暴2`；MV 编辑器 `D:\Program Files (x86)\KADOKAWA\RPGMV\RPGMV.exe`（页签/调色板不可改）
- 制作进行素材（整块地图碎片）`D:\机甲风暴开发素材合集\制作进行素材`（地图素材在其 `\地图素材`）
- 反汇编 `C:\Users\Administrator\Desktop\Huibian\玩法文档` · 逆向包 `D:\Desktop\JJFBpojie`
- 生产库 `8.140.236.16:27017`（SCRAM-SHA-256 / authSource=admin；**勿落地明文**）· 服务端 `/www/wwwroot/default/server`
- Python / Node（managed）`~/.workbuddy/binaries/python/versions/3.13.12/python.exe` · `.../node/versions/22.22.2-3/node.exe`

## 3. 数据 / 结构铁律
- **MonsterBase 与 RobotBase/RobotPet 同构**（`RobotID/RobotName/AniID/Form/Class/Level/Growth/Comprehension/StarLevel` + `Xxx`/`CurrentXxx` 成对 + `MaxHP/HP`、`MaxMP/MP`、`MaxEXP/EXP`、`Jin`）；怪物专属字段收进 **`MonsterExtra`**；`RobotID = 100000 + MonsterID`。
- **结构变更必须整集重建**（`col.drop()`；upsert 不清旧顶层字段）。新增集合须在 `handlers/utils.py` + `ws_server.py` + `migrations/m001_core_indexes.py` **三处**注册。
- `Items.json` **有三份**（`assets/resources/json/` → `server/data/` → `server/handlers/json/`）：改物品三份同改；排 item id 前**先扫占用**。
- 数值回填**一律显式判空 + clamp，绝不用 `or`**（`0 or max_hp` = 静默满血）。

## 4. Cocos / 怪物命名 → `cocos_rules.md`
最常踩的：`resources.load` 只读 `assets/resources/`（资源双写）· **重生成素材必须复用 uuid**（否则 prefab 引用全断、静默不播）· **克隆节点必须重生成 `_id`** · 诊断日志用 `Logger.warn`。

## 5. 数值体系 v4 → `game_numeric.md`
最常踩的：**每只怪独立公式** · 改 HP/MP **先降级再长回** · 整集重建 + 改前备份 · **战败保底 1 血 / 升级必满血满蓝**。

## 6. PVP → `pvp_rules.md`
最常踩的：推送载荷读 **`msg.data.state`**（读 `msg.state` = 挂机方黑屏）· 回合结算必须主动推送。

## 7. 技能系统 v6 → 细节 `tools/skill_system_handoff.md` §附录A
- **数据唯一入口** `build_skill_table.py --apply`（两份同写 + LF，**md5 一致**）；**勿手改 JSON**。
- **公式口径 A**：只用 `formula_scaled`；普攻 格斗 `(a.atk/3)*3` / 射击 `*2.5` / 全能 `*3.5`（后两者需持枪）。等级 Lv1–4 倍率 `[1.0,1.2,1.3,1.5]`；`lv_auto` 靠升级悟，`lv_manual` 靠面板 + 书 + 25/40/50 级。
- ⚠ `list_castable_skills` **默认只列「已学」**；**新机甲面板为空是预期**（唯一来源＝技能书），曾改 `False` 被否。
- **技能书**：背包用书**只能「学会」**；升级只走面板（`apply_skill_book()` **先写状态 → 再扣书**，失败 `$unset` 回滚）。⚠ 分支必须在 `handle_bag_use_item` 的 **`if item_data:` 之外**。
- `round_events` 字段名是 **`action`** 不是 `type`；UI 两处同构，槽 `Skill{N}` 不足则**克隆首槽 + y − 50**，**不用 `ev.target`**。
- 回归 `python tools/_skill_regression.py`。

## 8. 地图管线 + 图块工坊 → 细节 `memory/rpg_map_pipeline.md` §附录A
- 地图管线**未开工**（等报告 §7 五问拍板）；**分层依据 = tile id 段而非 z 层 → 导出只取 z3**；独立图块只有 **1152 格**（A5 128 + B/C/D/E 各 256），**A1–A4 是自动图块放不了**；**⛔ 编辑器加不了页签 → 层 = 地图**。
- ★**图块工坊** `tools/tileset_studio/`（`start.bat` → `127.0.0.1:19850`）：语义打标 → **整块贴/逐个铺** → 落 B/C/D/E → 导出（默认 `~/Desktop/图块工坊导出`）。
  - **翻转口径＝按框选自动**：多格 → 整块镜像；1 格 → 只翻这格；③ 区「只翻每格」= 后门。**变换是叠加**。
  - **撤回** `Ctrl+Z` · **橡皮擦** `E` · 语义直接落 `flags` · 导出一律补足标称尺寸。
  - ★**工程包 `.tsproj`**：一张地图 = **一个 zip 单文件**（**源图逐字节拷入**）；「💾存工程 / 📂开工程」、`Ctrl+Shift+S` / `Ctrl+O`；支持**拖入**。
  - 回归：**`python tools/tileset_studio/_regress.py`**（一键；**418 项全绿**基线）。

## 9. 待办
- 清单 `docs/玩法功能开发清单.md`；性能 `docs/optimization-audit.md`（async 内裸调 Mongo 67 处待修）。待清临时日志 `[攻击诊断]`/`[数字诊断]`/`[方向诊断]`。
- 数值待拍板：高阶/低阶怪池稀薄；怪 MP 利用率；**服务端权威攻击次数结算未移植**；`Items.json` 掉落概率缺失。
- 技能剩余：①buff/状态口径 ②**升级 UI 用户自制** ③服务端距离规则 ④云端未部署。地图管线：等报告 §7 五问。
- 图块工坊：`img/tilesets/` 写入按钮**尚未替用户按下**（等确认）；自测包 `D:\_mv_tabtest` / `D:\_mv_capacity_test` 的 `RUN_TEST.bat` 需用户双击。
