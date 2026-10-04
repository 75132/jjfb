# 更新日志 Changelog

> 项目：JJFB《机甲风暴OL》Cocos 重制版
> 本次批次：2026-10-04（覆盖自 2026-09-19 起的全部未提交改动）
> 仓库：https://github.com/75132/jjfb.git

---

## 一、概述

本批次是自 2026-09-19 提交以来最大规模的一次产出汇总，覆盖：

- **技能系统 v6** 全链路落地（数据、服务端、客户端资源、构建工具、回归测试）
- **地图管线 + 图块工坊（tileset_studio）** 工具链成型
- **怪物数据修复**与可视化报表
- **战斗 / PVP / 挂机掉线重连** 服务端权威化与客户端同步
- **开局世界观 / 主线剧情** 文档与数值体系（v4）
- **性能审计**与多项 bug 修复

> 说明：本批次沿用既有仓库约定，`library/`（Cocos 资源元数据）、`temp/`（构建产物）、`logs/` 等自动生成目录一并纳入版本管理；项目记忆目录 `.workbuddy/` 出于安全考虑**不纳入**提交。

---

## 二、重大新增

### 1. 技能系统 v6（数据唯一入口 + 服务端权威）
- 新增服务端技能模块：
  - `server/handlers/skill_handler.py`（技能释放/查询入口）
  - `server/services/skill_service.py`、`skill_formula.py`、`skill_level_service.py`、`skill_book_service.py`
  - `server/data/Skills.json`（技能表权威数据，双份同写）
  - `server/tests/test_skill_book_use.py`、`test_battle_survive_and_levelup_restore.py`
- 新增客户端技能图标资源：`assets/resources/Skill/*`（虚空冲击、虚空导弹、引力压制、扎取、自动、作者技等序列帧）、`assets/resources/SkillIcon/`
- 新增构建/回填工具：
  - `tools/build_skill_table.py`（数据唯一入口，`--apply` 双份同写、md5 一致性校验）
  - `tools/build_skill_books.py`、`tools/patch_items_skillbooks.py`、`tools/_skill_regression.py`（回归 531 项）
  - `tools/skill_ani_port.py`、`skill_gif_port.py`、`skill_icon_extract.py`
- 技能设计文档：`tools/skill_system_handoff.md`、`skill_final_table.md`、`skill_anim_table.md`、`skill_list.md`、`skill_category_todo.md`、`skill_range_todo.md`
- 旧 `assets/UI/Skill_icon/`（plist 合图）已废弃删除，改用 `resources/Skill/` 逐帧资源

### 2. 地图管线 + 图块工坊
- 新增 `tools/tileset_studio/`（语义打标 → 整块贴/逐个铺 → 导出工程包，前端无构建、后端无状态零依赖）
- 新增 RPG 地图研究/移植工具链：
  - `tools/rpg_map_layers.py`、`rpg_map_events.py`、`rpg_map_recon.py`、`rpg_map_render.py`、`rpg_map025_*.py`
  - `tools/rpg_tileset_capacity.py` + 报告、`rpg_layer_strategy.md`、`rpg_map_pipeline_research.md`
- 世界地图/场景资源更新：`assets/Map/1/1-1.tmx`、`1-2.tmx`、`1-3.tmx`、`assets/Scene/Game.scene`、`Login.scene`、`assets/resources/Sample/素材/map_0.json`
- 文档：`tools/rpg_map025_layer_split_report.md`、`rpg_tileset_capacity_report.md`

### 3. 怪物数据修复与可视化
- 新增 `tools/monster/` 工具集与报表：`docs/monster_table.(csv|html|json)`、`docs/monster_distribution.(csv|html|json|xlsx)`、`docs/monster_distribution_db_snapshot.json`
- 关联 `MonsterBase` / `RobotBase` 同构修复与数值回填（显式判空 + clamp）

### 4. 开局 / 世界观 / 主线剧情
- 新增文档：`docs/开局世界观与剧情_Cocos.md`、`docs/主线剧情大纲v3.md`、`docs/主线剧情世界观v2.md`、`docs/世界观设定.md`
- 数值体系：`docs/数值结算规则v4.md`、`docs/开放世界满级属性_L60.html`

---

## 三、优化与修复

- **战斗/PVP 服务端权威**：`server/services/battle_room_service.py`、`story_service.py`、`world_presence_service.py`；PVP 对战结算与掉线重连文档 `docs/PVP对战结算与掉线重连.md`
- **挂机/在线同步（客户端）**：`assets/Script/Game/GameArea/PlayerStateSync.ts`、`WorldOnlineSync.ts`、`RemoteAvatarController.ts`、`PlayerAnimRuntime.ts`、`BattleResumeController.ts`、`BattleScene.ts`
- **角色选择与登录**：`assets/Script/CharacterSelect/*`、`assets/Script/login/*`、`Login.scene`
- **数值结算**：战败保底 1 血 / 升级必满血满蓝（`test_battle_survive_and_levelup_restore.py` 覆盖）
- **性能审计**：`docs/optimization-audit.md`（点名 async 内裸调 Mongo 67 处）
- **物品/装备/合成**：`server/handlers/equipment_advanced_handler.py`、`item_exp_handler.py`、`bag_handler.py`、`Items.json`（三份同改）
- 作者技（ZuoJia）资源与工具：`assets/resources/ZuoJia/`、`tools/zuojia_*.py`
- NPC 立绘更新：`assets/resources/Npc/Npc_01..16.png`

---

## 四、资源与杂项

- 新增 `intro_preview.html`（开局预览页）
- 服务端新增 `server/config_loader.py`、`server/data/story_maps/map_2_world_map2.json`
- 删除过期 e2e 测试产物 `artifacts/e2e_story_settlement/*`
- `.gitignore` 追加 `.testdeps/`（本地 pytest 依赖目录，勿提交）

---

## 五、已知问题 / 待办（延续）

- 怪物池稀薄、怪 MP 利用率偏低
- 服务端权威攻击次数结算尚未移植到线上
- 升级 UI 仍为用户自制方案
- 图块工坊 `img/tilesets/` 写入按钮需手动触发
- 性能审计 67 处裸调 Mongo 待改造
- `logs/`、`temp/` 等自动生成目录建议后续评估是否移出版本管理

---

_提交约定：本仓库历史采用「日期」或「1」式简短提交信息；本批次以 `20261004` 为提交主题，详细变更以本文件为准。_
