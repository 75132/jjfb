# 剧情系统完善 · 主计划表

> **用途**：后续所有剧情相关开发以本文档为唯一排期与验收依据。  
> **状态标记**：`⬜ 未开始` · `🟡 进行中` · `✅ 完成` · `⏸ 暂停` · `❌ 取消`  
> **最后更新**：2026-08-29  
> **当前阶段**：阶段 2（运行时闭环）· P2-01 手动 E2E 待签字

---

## 0. 目标与边界

### 0.1 什么叫「完完全全完善」

满足以下 **6 条** 才算剧情系统封板，之后做装备/副本/活动只在 manifest 扩展能力，不重做架构：

| # | 验收项 | 说明 |
|---|--------|------|
| A | **契约闭环** | manifest 为单一真相源；Juben / Server / Client 能力 1:1 |
| B | **发布闭环** | Juben 发布双写 Cocos + Server，hash/版本一致 |
| C | **运行时闭环** | 单条任务链：interact → 对话/选项 → 战斗 → finalize → 交任务 |
| D | **战斗 FSM 闭环** | pending_battle 状态机文档化 + 断线/重启可恢复 |
| E | **编辑器生产力** | 策划独立完成战斗任务链，无需改代码 |
| F | **可回归** | 自动化测试 + Cocos 手动清单全通过 |

### 0.2 不在本计划内（避免 scope 膨胀）

- 装备强化/镶嵌 UI、背包仓库/交易、战斗 SKILL/ITEM 深度
- 管理后台鉴权、公网部署、压力测试常态化
- 全游戏 Cocos UI 自动化测试框架

### 0.3 架构原则（对标成熟网游方案）

| 原则 | 说明 | 本项目落点 |
|------|------|------------|
| 蓝图 vs 实例 | 地图 JSON = 蓝图；Mongo progress = 实例 | `map_*.json` + `story_progress` |
| 三层分离 | 编辑器 → 编译数据 → 轻量运行时 | Juben → publish → StoryManager / story_service |
| 服务端权威 | 客户端只发命令，不发奖不判完成 | `story_interact` / `event_complete` / `battle_finalize` |
| Manifest 契约 | 编辑器只能配运行时支持的能力 | `Juben/data/client-runtime-manifest.json` |
| 幂等可恢复 | request_id + settlement ledger | `story_settlement_ledger`、effect 幂等 |

### 0.4 关键路径与文件索引

```
契约层
  Juben/data/client-runtime-manifest.json
  docs/story-system-spec.md          ← 阶段 0 产出（技术规范）
  assets/Script/Game/STORY_MIGRATION.md  ← 策划操作手册（已有）

编辑器
  Juben/src/editor/map-export-pipeline.ts
  Juben/src/editor/battle-enemy-bind.ts
  Juben/juben_战斗摆点与全量排查.md

客户端
  assets/Script/Game/StoryManager.ts
  assets/Script/Game/story-requirements.ts
  assets/Script/Game/story-event-flow.ts
  assets/Script/Game/story-npc-visibility.ts
  assets/Script/Game/BattleResumeController.ts
  assets/Script/Game/story-runtime-mode.ts

服务端
  server/services/story_service.py
  server/services/story_battle_service.py
  server/handlers/story_handler.py
  server/data/story_maps/
  server/data/battle_refs.json

测试与验收
  server/tests/test_story_*.py
  Juben/tests/story-*.test.ts
  tests/runtime/
  artifacts/e2e_story_settlement/.../COCOS_MANUAL_CHECKLIST.md
```

---

## 1. 阶段总览

| 阶段 | 名称 | 目标 | 预估 | 状态 |
|------|------|------|------|------|
| **0** | 冻结契约 | manifest v2 + 技术规范 + 三端对齐规则 | 1 周 | ✅ 完成 |
| **1** | 编辑器可量产 | Juben 摆点/保存/导出加固 | 1–2 周 | ✅ 完成（P1-10 自动化 OK，人工签字可选） |
| **2** | 运行时闭环 | Cocos E2E + 战斗恢复 + db-atomic | 1–2 周 | 🟡 进行中 |
| **3** | 能力补齐 | warnOnly → supported 的 effect/requirement | 按内容迭代 | ⬜ 未开始 |
| **4** | 工业化 | round-trip 测试、热更新、运营工具 | 持续 | ⬜ 未开始 |

**依赖关系**：`0 → 1 → 2` 必须顺序做；`3` 可在 `2` 通过后并行；`4` 持续。

---

## 2. 阶段 0：冻结契约

> **阶段出口**：manifest v2 落地；`story-system-spec.md` 写完；三端「未知类型」行为统一；CI 门禁就绪。 ✅ **已达成**

| ID | 任务 | 主要文件 | 依赖 | 验收标准 | 状态 |
|----|------|----------|------|----------|------|
| **P0-01** | 编写剧情系统技术规范（状态机、WS 命令、数据模型） | `docs/story-system-spec.md` | — | 含 progress FSM、pending_battle FSM、5 条 story WS 命令表 | ✅ 完成 |
| **P0-02** | manifest 升级 v2：拆分 supported / serverOnly / planned | `Juben/data/client-runtime-manifest.json`、`client-runtime-manifest-types.ts` | P0-01 | JSON schema 有三级分类 | ✅ 完成 |
| **P0-03** | Juben 导出：planned=error、serverOnly 不告警 | `map-export-pipeline.ts`、`client-runtime-manifest.ts` | P0-02 | 导出含 planned 类型时失败；单测更新 | ✅ 完成 |
| **P0-04** | 客户端 requirement：未知类型默认 **false**（local-preview 可放宽） | `story-requirements.ts`、`StoryManager.ts` | P0-02 | runtime 测试 | ✅ 完成 |
| **P0-05** | 服务端 requirement 与 manifest 对齐清单 | `story_service.py` | P0-02 | 模块 docstring 对齐 manifest | ✅ 完成 |
| **P0-06** | 标记废弃：`story_battle_start`、生产环境 `skipServerRequirements` | `STORY_MIGRATION.md` | P0-01 | 文档标注 deprecated | ✅ 完成 |
| **P0-07** | 新增能力扩展 PR 检查清单 | `Juben/CONTRIBUTING.md` | P0-01 | 五步法 checklist | ✅ 完成 |
| **P0-08** | CI 门禁脚本（本地可跑） | `package.json` | P0-03 | `npm run test:story-gate` | ✅ 完成 |

### 阶段 0 能力矩阵（契约基线 · 已落地）

| type / action | Server | Client | manifest 档位 |
|---------------|--------|--------|---------------|
| `event_done` / `task_*` / `level` / `mainline_step` / `item_owned` | ✅ | ✅ | **supported** |
| `story_var_equals` / `has_pet` / `bag_space_at_least` | ❌ | strict=false | **planned（禁止导出）** |
| `task_accept` / `task_complete` / `teleport` / `spawn_npc` / `reveal_npc` | ✅ | ✅ | **supported** |
| `give_item` / `add_exp` / `send_mail` | ✅ | Tips | **serverOnly** |
| `take_item` / `set_story_var` | ❌ | ❌ | **planned** |

---

## 3. 阶段 1：编辑器可量产

> **阶段出口**：策划在 Juben 独立完成「单 NPC 战斗任务链」并发布，无需开发改代码。

| ID | 任务 | 主要文件 | 依赖 | 验收标准 | 状态 |
|----|------|----------|------|----------|------|
| **P1-01** | 战斗敌人坐标物化 `materializeBattleEnemySpawnCoords` | `battle-enemy-bind.ts` | P0-08 | 拖 NPC 后敌人不跟随；单测 | ✅ 完成 |
| **P1-02** | 加固 `patchBattleEnemySpawn`（缺 appear 节点自动补） | `battle-enemy-bind.ts`、`EditorRoot.vue` | P1-01 | 旧链可拖敌人保存；失败有 reason | ✅ 完成 |
| **P1-03** | NPC 拖拽 autosave | `EditorRoot.vue` | — | `patchGameMapNpc` 改坐标触发保存 | ✅ 完成 |
| **P1-04** | 地图拖拽：click 选中 / pointerdown 拖拽分离 | `MapEditorView.vue` | — | 拖敌人不触发 rebuild 竞态 | ✅ 完成 |
| **P1-05** | 扩展 battle-enemy-bind 单测 | `Juben/tests/battle-enemy-bind.test.ts` | P1-01~04 | `npm test` 全绿 | ✅ 完成 |
| **P1-06** | export tasks 按当前 map 过滤 | `map-export.ts` | P0-03 | 导出不含其他地图 quest 污染 | ✅ 完成 |
| **P1-07** | AI 生成期间 suspend autosave | `EditorRoot.vue`、`AiAssistantPanel.vue` | — | 流式生成不产生半成品存档 | ✅ 完成 |
| **P1-08** | import 后 `syncQuestsFromTimeline` | `map-import.ts` | — | 导入后 quest 与 timeline 一致 | ✅ 完成 |
| **P1-09** | global check：patch 失败 toast + export appear 预检 | `global-check-repair.ts`、`map-export-pipeline.ts` | P1-02 | 全局检查可见错误 | ✅ 完成 |
| **P1-10** | 策划验收：独立配置一条完整战斗任务链并发布 | Juben UI | P1-01~09 | 双写 Cocos+Server；`audit:story-maps` 无 error | 🟡 自动化已通过，待人工签字 |

**参考文档**：`Juben/juben_战斗摆点与全量排查.md`

---

## 4. 阶段 2：运行时闭环

> **阶段出口**：`COCOS_MANUAL_CHECKLIST.md` A–E 全通过；战斗恢复无竞态；多进程 settlement 安全。

| ID | 任务 | 主要文件 | 依赖 | 验收标准 | 状态 |
|----|------|----------|------|----------|------|
| **P2-01** | Cocos 手动 E2E：完整胜利闭环（清单 A） | `artifacts/.../COCOS_MANUAL_CHECKLIST.md` | P1-10 | 截图 + metadata `cocos_editor.status=passed` | ⬜ 未开始 |
| **P2-02** | Cocos 手动 E2E：战斗中断线（清单 B） | `BattleResumeController.ts` | P2-01 | 重连恢复同一房间 | ⬜ 未开始 |
| **P2-03** | Cocos 手动 E2E：finalize 前断线（清单 C） | `StoryManager.ts`、`story_battle_service.py` | P2-01 | 自动 finalize，不重复奖励 | ⬜ 未开始 |
| **P2-04** | Cocos 手动 E2E：服务端重启（清单 D） | `e2e_story_settlement_restart.py` | P2-01 | 重登后结算正确 | ⬜ 未开始 |
| **P2-05** | Cocos 手动 E2E：bag_has_items 超 200 格（清单 E） | `bag_handler.py`、`StoryManager.ts` | P2-01 | 任务物品条件可识别 | ⬜ 未开始 |
| **P2-06** | 去重 `battle_room_resume`：`Test.ts` 不再与 BattleScene 竞态 | `Test.ts`、`BattleResumeController.ts` | P2-02 | protocol-audit #3 关闭 | ✅ 完成 |
| **P2-07** | `story_battle_service` Mongo 条件更新（db-atomic） | `story_battle_service.py` | P2-03 | 多进程下无重复 finalize；单测 | ✅ 完成 |
| **P2-08** | （可选）接取任务时 snapshot task_defs | `story_service.py`、progress schema | P2-01 | 改 JSON 不影响已接任务 | ⬜ 未开始 |
| **P2-09** | 清理地图资产漂移：Cocos 仅 `map_0` vs Server 多文件 | `server/data/story_maps/`、`Game.scene` | P1-10 | 活跃地图单一 canonical；旧图归档 | ⬜ 未开始 |
| **P2-10** | 阶段 2 回归：全量 story 自动化测试 | `server/tests/`、`Juben/tests/`、`tests/runtime/` | P2-01~07 | 三条测试命令全绿 | ⬜ 未开始 |

---

## 5. 阶段 3：能力补齐（按内容需求迭代）

> **规则**：每项必须走 §6 五步法；未在 manifest supported 的禁止上线用。

| ID | 任务 | 主要文件 | 依赖 | 验收标准 | 状态 |
|----|------|----------|------|----------|------|
| **P3-01** | `give_item` / `add_exp` 升格 supported + 客户端 Tips | manifest、StoryManager、story_service | P2-10 | 任务奖励可见；单测 | ⬜ 未开始 |
| **P3-02** | `send_mail` 剧情发信 supported | 同上 + MailPanel 提示 | P3-01 | 剧情 effect 可发邮件 | ⬜ 未开始 |
| **P3-03** | `level` / `mainline_step` Juben Inspector 可配 | `Inspector.vue`、manifest | P0-02 | 策划可配等级门槛 | ⬜ 未开始 |
| **P3-04** | `story_var_equals` 三端实现或永久 planned | story_service、story-requirements | P0-05 | 不再恒 true | ⬜ 未开始 |
| **P3-05** | 跨地图 `teleport`（换 scene + 坐标） | StoryManager、world/story | P2-10 | 清单内新增 teleport 用例 | ⬜ 未开始 |
| **P3-06** | `take_item` / `set_story_var` 实现或文档禁止 | manifest | — | 编辑器无法导出 | ⬜ 未开始 |

---

## 6. 阶段 4：工业化（持续）

| ID | 任务 | 主要文件 | 依赖 | 验收标准 | 状态 |
|----|------|----------|------|----------|------|
| **P4-01** | Juben 导出 → 服务端 simulate interact  round-trip 测试 | `server/tests/`、`Juben/scripts/` | P2-10 | CI 可跑 | ⬜ 未开始 |
| **P4-02** | `configVersion` 变更触发客户端 `story_get_state` 刷新 | StoryManager、story_service | P2-10 | 热更新不重登 | ⬜ 未开始 |
| **P4-03** | Admin 剧情重置 / settlement 重放工具 | `admin_handler.py`、admin-ui | P2-10 | 运营可重置单角色剧情 | ⬜ 未开始 |
| **P4-04** | story 命令 trace 日志规范 | `story_handler.py`、StoryManager | P2-10 | 可按 trace 查一条链 | ⬜ 未开始 |

---

## 7. 新增能力五步法（PR 必查）

每新增一个 `requirement` 或 `effect`：

1. [ ] 更新 `Juben/data/client-runtime-manifest.json`（supported 档）
2. [ ] 实现 `server/services/story_service.py`（check 或 apply）
3. [ ] 实现 `assets/Script/Game/story-requirements.ts` 或 StoryManager effect 处理
4. [ ] Juben Inspector 可配置 + `map-export-pipeline` 校验
5. [ ] 测试：`Juben/tests` + `server/tests` + `tests/runtime` 至少各 1 例

---

## 8. 每日/每会话执行约定

### 8.1 开工前

```bash
# 仓库根：jjfb/
cd Juben && npm test
cd ../server && python -m pytest tests/test_story_*.py -q
cd .. && npm run test:runtime
```

### 8.2 会话结束时更新本文档

1. 将完成任务 ID 状态改为 `✅`
2. 在 §9「会话日志」追加一行：日期、完成任务、阻塞项、下一步 ID
3. 不要跳阶段；若阻塞，标 `⏸` 并写原因

### 8.3 对话衔接口令

后续对话可说：

> 「按 `docs/story-system-plan.md` 继续，从 **P1-01** 开始」

AI/开发者应只改计划中当前阶段任务，不擅自扩 scope。

---

## 9. 会话日志

| 日期 | 完成 | 阻塞 | 下一步 |
|------|------|------|--------|
| 2026-08-29 | 创建主计划表；环境修复（Cocos 缓存、ws_server、Juben 启动） | — | P0-01 |
| 2026-08-29 | **阶段 0 完成**：manifest v2、strict requirement、导出校验、test:story-gate | — | **P1-01** |
| 2026-08-29 | **阶段 1 代码项完成**：P1-01~09（物化坐标、patch 加固、autosave、拖拽分离、单测、tasks 过滤、AI suspend、import sync、global check）；Juben 268 passed | — | **P1-10** |
| 2026-08-29 | **test:story-gate 全绿**（runtime 41 + Juben 269 + audit 0 error + story pytest 43）；**P2-06/07** 完成（resume 去重、pending creating 原子更新） | — | **P2-01** |

---

## 10. 相关文档

| 文档 | 用途 |
|------|------|
| [story-system-spec.md](./story-system-spec.md) | 技术规范（阶段 0 产出，P0-01） |
| [protocol-audit.md](./protocol-audit.md) | WS 协议审计 |
| [../assets/Script/Game/STORY_MIGRATION.md](../assets/Script/Game/STORY_MIGRATION.md) | 策划发布与验收 |
| [../Juben/juben_战斗摆点与全量排查.md](../Juben/juben_战斗摆点与全量排查.md) | 编辑器摆点修复细则 |
| [../artifacts/e2e_story_settlement/.../COCOS_MANUAL_CHECKLIST.md](../artifacts/e2e_story_settlement/20260802T142147Z-3d5d4694/COCOS_MANUAL_CHECKLIST.md) | Cocos 手动 E2E |

---

## 11. 当前基线快照（2026-08-29）

**已完成（计划外前置工作）**

- Cocos 引擎缓存修复（`tools/fix_cocos_cache.ps1`）
- 脚本编译缓存清理（`temp/programming`）
- ws_server + Juben 本地启动验证
- 服务端 story 自动化测试 65 passed（历史基线）
- Juben story 相关 vitest 264 passed（历史基线）

**已知未关闭问题（已纳入计划）**

- Juben 战斗摆点回弹 → P1-01~05
- `story_var_equals` 客户端恒 true → P0-04 / P3-04
- `Test.ts` 与 BattleScene resume 竞态 → P2-06
- Cocos 手动 E2E 未签字 → P2-01~05
- `story_battle_service` db-atomic TODO → P2-07
