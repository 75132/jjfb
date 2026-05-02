# 2D回合制网游 - 地图管理系统 专业设计方案
**适用场景**：Cocos Creator 2D、回合制、PVP、捉宠、宠物出战、多人在线网游
**设计原则**：前后端统一、配置化、安全可靠、专业商用级

---

## 1. 方案定位
本方案为**网游级地图核心配置与管理系统**，仅负责你明确需要的地图基础规则，不包含战斗、宠物、PVP逻辑，干净、可直接嵌入项目、可直接交给 AI 生成代码。

核心管理内容：
- 地图ID与基础标识
- 一个地图对应一个 JSON
- 地图内 NPC 事件统一配置（对话/战斗/传送等仅类型不同）

---

## 2. 核心设计思想（网游专业标准）
1. **配置与逻辑分离**
   所有地图规则写在配置表，不写死代码，支持热更新、策划编辑。

2. **前后端共用同一套数据结构**
   客户端、服务端使用完全一致的字段定义，避免协议错误。

3. **客户端只做表现，服务端做权威判断**
   所有 NPC 事件（对话/战斗/传送等）均由服务端验证，客户端仅发送请求、展示结果。

4. **可无限扩展地图**
   结构稳定，支持10～1000张地图不混乱、不重构。

---

## 3. 统一数据结构（前后端通用）

---

## 3.X Cocos Creator / Tilemap 落地约定（强烈建议写进项目规范）
**目标引擎**：Cocos Creator **3.8.7**  
**地图形态**：2D Tilemap，采用**拼接地图**方案（规避单张地图尺寸/性能限制）。

### 3.X.1 坐标与格子
- **配置坐标单位**：`x/y` 使用**像素（世界坐标）**存储与传输（便于摆点与调试）。
- **格子规格**：tileSize = **48×48**。
- **对齐规则**：角色/NPC 默认尺寸约 **48×48**，并且**站在格子中心点**；即使个别实体尺寸例外，也仍以“中心点对齐格子中心”为准。

### 3.X.2 Tiled 左上原点坐标转换（约定）
你当前使用 **Tiled 左上为原点、Y 向下**的坐标习惯，因此运行时需要统一转换到 Cocos 世界坐标（Y 向上）。

转换（示意）：若 Tiled 像素坐标为 `(tx, ty)`，地图像素高度为 `mapPixelH`，则
- `wx = tx`
- `wy = mapPixelH - ty`

> 注意：实际项目里 Tilemap 节点原点/锚点与父节点变换会影响最终公式。无论采用哪种方式，都必须在项目中固定一套“参考节点 + 转换函数”，并在导表与运行时统一使用。

### 3.X.3 mapId 与资源组织（约定）
- **mapId**：你将以“一张拼接后的地图（一个可加载单位）”作为一个 `mapId`。
- **图层模板**：地图图层模板一致（便于批量制作与解析），例如阻挡层/效果层等。

### 3.X.4 传送/阻挡/效果的实现口径（当前项目做法）
- **传送触发**：传送也作为 NPC 事件类型之一（`eventType=teleport`），触发方式可来自点击 NPC 或碰撞触发后转为 NPC 事件请求。
- **不可通行/特殊效果**：以 Tilemap 图层来表达（例如某图层代表不可通行/某图层代表某种效果），并配合 2D 碰撞实现移动限制或触发。

### 3.1 单文件结构（一个地图一个 JSON）
```
map_{mapId}.json   // 例如 map_1001.json
├─ mapId: 数字      // 地图唯一ID
└─ npcs: 数组       // 该地图内全部NPC
   └─ 每个NPC对象
      ├─ npcUid: 字符串      // 地图内NPC实例唯一ID（建议 mapId_npcId）
      ├─ npcName: 字符串     // NPC名称
      ├─ prefabKey: 字符串   // NPC表现资源标识（可选）
      ├─ x: 数字
      ├─ y: 数字
      └─ events: 数组        // 该NPC的全部事件（统一模型）
         └─ 每个事件对象
            ├─ eventType: 字符串 // dialog(对话)/battle(战斗)/teleport(传送)/shop(商店)/task(任务)/capture(捉宠)/pvp(竞技)
            ├─ eventTypeDesc: 字符串 // 中文备注（仅便于策划阅读，程序可忽略）
            ├─ eventParam: 任意   // 事件参数
            └─ order: 数字        // 执行优先级（数值越小越先）
```

### 3.2 事件类型总表（统一命名）
- `dialog`：对话事件
- `battle`：战斗事件
- `teleport`：传送事件
- `shop`：商店事件
- `task`：任务事件
- `capture`：捉宠事件
- `pvp`：PVP 事件

---

## 4. 地图配置表示例（JSON）
用于让 AI 理解格式。注意：**一个地图一个 JSON 文件**（如 `map_1001.json`）。

### 4.1 eventParam 建议字段规范（推荐）
- `dialog`（对话）：`dialogId`
- `battle`（战斗）：`battleId`, `enemyGroupId`
- `teleport`（传送）：`toMapId`, `toX`, `toY`
- `shop`（商店）：`shopId`
- `task`（任务）：`taskId`, `phase`
- `capture`（捉宠）：`capturePoolId`, `captureRate`
- `pvp`（竞技）：`roomType`, `ratingMin`, `ratingMax`

### 4.2 完整案例：每种事件类型 2 个 NPC
说明：示例里增加了 `eventTypeDesc` 中文备注字段，方便阅读；代码里可选用或忽略。
```json
{
  "mapId": 1001,
  "npcs": [
    {
      "npcUid": "1001_dialog_01",
      "npcName": "村口老者",
      "prefabKey": "npc_oldman",
      "x": 120,
      "y": 240,
      "events": [
        {
          "eventType": "dialog",
          "eventTypeDesc": "对话",
          "eventParam": {
            "dialogId": 10001
          },
          "order": 1
        }
      ]
    },
    {
      "npcUid": "1001_dialog_02",
      "npcName": "酒馆老板",
      "prefabKey": "npc_innkeeper",
      "x": 168,
      "y": 240,
      "events": [
        {
          "eventType": "dialog",
          "eventTypeDesc": "对话",
          "eventParam": {
            "dialogId": 10002
          },
          "order": 1
        }
      ]
    },
    {
      "npcUid": "1001_battle_01",
      "npcName": "巡逻兵",
      "prefabKey": "npc_guard",
      "x": 216,
      "y": 240,
      "events": [
        {
          "eventType": "battle",
          "eventTypeDesc": "战斗",
          "eventParam": {
            "battleId": 30001,
            "enemyGroupId": 5001
          },
          "order": 1
        }
      ]
    },
    {
      "npcUid": "1001_battle_02",
      "npcName": "竞技教官",
      "prefabKey": "npc_trainer",
      "x": 264,
      "y": 240,
      "events": [
        {
          "eventType": "battle",
          "eventTypeDesc": "战斗",
          "eventParam": {
            "battleId": 30002,
            "enemyGroupId": 5002
          },
          "order": 1
        }
      ]
    },
    {
      "npcUid": "1001_teleport_01",
      "npcName": "东门传送使",
      "prefabKey": "npc_gatekeeper",
      "x": 312,
      "y": 240,
      "events": [
        {
          "eventType": "teleport",
          "eventTypeDesc": "传送",
          "eventParam": {
            "toMapId": 1002,
            "toX": 96,
            "toY": 144
          },
          "order": 1
        }
      ]
    },
    {
      "npcUid": "1001_teleport_02",
      "npcName": "西门传送使",
      "prefabKey": "npc_gatekeeper",
      "x": 360,
      "y": 240,
      "events": [
        {
          "eventType": "teleport",
          "eventTypeDesc": "传送",
          "eventParam": {
            "toMapId": 1003,
            "toX": 48,
            "toY": 96
          },
          "order": 1
        }
      ]
    },
    {
      "npcUid": "1001_shop_01",
      "npcName": "道具商人",
      "prefabKey": "npc_merchant",
      "x": 408,
      "y": 240,
      "events": [
        {
          "eventType": "shop",
          "eventTypeDesc": "商店",
          "eventParam": {
            "shopId": 7001
          },
          "order": 1
        }
      ]
    },
    {
      "npcUid": "1001_shop_02",
      "npcName": "装备商人",
      "prefabKey": "npc_merchant",
      "x": 456,
      "y": 240,
      "events": [
        {
          "eventType": "shop",
          "eventTypeDesc": "商店",
          "eventParam": {
            "shopId": 7002
          },
          "order": 1
        }
      ]
    },
    {
      "npcUid": "1001_task_01",
      "npcName": "任务发布员",
      "prefabKey": "npc_quest",
      "x": 504,
      "y": 240,
      "events": [
        {
          "eventType": "task",
          "eventTypeDesc": "任务",
          "eventParam": {
            "taskId": 8001,
            "phase": "accept"
          },
          "order": 1
        }
      ]
    },
    {
      "npcUid": "1001_task_02",
      "npcName": "任务回收员",
      "prefabKey": "npc_quest",
      "x": 552,
      "y": 240,
      "events": [
        {
          "eventType": "task",
          "eventTypeDesc": "任务",
          "eventParam": {
            "taskId": 8001,
            "phase": "submit"
          },
          "order": 1
        }
      ]
    },
    {
      "npcUid": "1001_capture_01",
      "npcName": "驯宠师",
      "prefabKey": "npc_tamer",
      "x": 600,
      "y": 240,
      "events": [
        {
          "eventType": "capture",
          "eventTypeDesc": "捉宠",
          "eventParam": {
            "capturePoolId": 9001,
            "captureRate": 35
          },
          "order": 1
        }
      ]
    },
    {
      "npcUid": "1001_capture_02",
      "npcName": "野外研究员",
      "prefabKey": "npc_researcher",
      "x": 648,
      "y": 240,
      "events": [
        {
          "eventType": "capture",
          "eventTypeDesc": "捉宠",
          "eventParam": {
            "capturePoolId": 9002,
            "captureRate": 20
          },
          "order": 1
        }
      ]
    },
    {
      "npcUid": "1001_pvp_01",
      "npcName": "竞技场管理员",
      "prefabKey": "npc_arena",
      "x": 696,
      "y": 240,
      "events": [
        {
          "eventType": "pvp",
          "eventTypeDesc": "竞技",
          "eventParam": {
            "roomType": "ladder_1v1",
            "ratingMin": 0,
            "ratingMax": 1499
          },
          "order": 1
        }
      ]
    },
    {
      "npcUid": "1001_pvp_02",
      "npcName": "冠军赛管理员",
      "prefabKey": "npc_arena",
      "x": 744,
      "y": 240,
      "events": [
        {
          "eventType": "pvp",
          "eventTypeDesc": "竞技",
          "eventParam": {
            "roomType": "champion_3v3",
            "ratingMin": 1500,
            "ratingMax": 9999
          },
          "order": 1
        }
      ]
    }
  ]
}
```

---

## 5. 客户端地图管理器（功能说明，非代码）
### 功能清单
1. 单例全局调用，任何脚本可访问
2. 加载地图配置表
3. 进入/切换地图
4. 获取当前地图所有NPC
5. 按坐标检测附近NPC
6. 查询指定NPC的事件列表（events）
7. 按事件类型筛选（dialog/battle/teleport/...）
8. 提供给玩家角色调用统一NPC事件交互

### 客户端定位（网游标准）
- 只做表现、查询、触发
- 不做任何逻辑判断
- 不存储权威数据
- 所有交互发消息给服务端

---

## 6. 服务端地图管理器（功能说明，网游核心）
### 功能清单
1. 启动时预加载所有地图配置
2. 管理玩家进入/离开地图
3. 权威判断：玩家是否点击/触发有效NPC
4. 权威判断：NPC事件是否可执行（条件、距离、顺序）
5. 执行 NPC 事件（对话/战斗/传送等）
6. 向客户端推送：事件执行结果

### 服务端安全规则
- 客户端不能决定 NPC 事件结果
- 客户端不能决定传送目标
- 客户端不能篡改 NPC 事件参数
- 所有行为必须经过服务端验证

---

## 7. 业务流程（极简、专业、网游标准）
### 7.1 NPC事件流程（统一）
1. 玩家点击NPC
2. 客户端发送 mapId + npcUid
3. 服务端验证位置与NPC配置
4. 服务端按 events.order 选择并执行可用事件（对话/战斗/传送/商店/任务）
5. 服务端返回事件结果，客户端只做表现

---

## 8. 扩展性设计（商用必备）
- 可新增地图区域配置
- 可新增是否允许PVP字段
- 可新增是否允许捉宠字段
- 可新增背景音乐、天气配置
- 不破坏原有结构

---

## 9. 为什么这是「网游专业级别」
1. **工业级结构**：与主流回合制网游地图系统一致
2. **前后端统一**：无协议错误、无同步问题
3. **安全无漏洞**：逻辑不下放客户端
4. **配置化驱动**：支持热更新、Excel编辑
5. **轻量不冗余**：只做你需要的功能，不增加项目负担

---

## 10. 交给 AI 生成代码时的提示词（你可直接复制）
```
根据这份网游地图管理系统方案，生成 Cocos Creator 3.8.7 TypeScript 代码（2D Tilemap 拼接地图）：

1. 生成代码与配置文件：
   - MapDefine.ts 数据结构接口
   - MapManager.ts 客户端单例地图管理器
   - `map_{mapId}.json` 地图配置文件（例如 `map_1001.json`，一地图一文件）

2. 功能只做：
   - 地图ID
   - 一个地图一个 JSON 文件（文件名 `map_{mapId}.json`）
   - NPC 内嵌在每个 map 文件的 `npcs`（不生成独立 npc 配置文件）
   - 地图内 NPC 字段：npcUid、npcName、prefabKey、坐标
   - 单个 NPC 支持 events 多事件（dialog/battle/teleport/shop/task/capture/pvp）
   - 按坐标检测NPC
   - 按事件类型筛选并触发 NPC 事件
   - 进入地图

3. 坐标与落地约定：
   - 配置 `x/y` 为像素（世界坐标），tileSize = 48×48
   - 角色/NPC 默认站格子中心点（中心对齐）
   - 若使用 Tiled 左上原点坐标，需提供统一的转换函数（按项目固定参考节点实现）
   - 传送触发优先走 2D 碰撞触发口径（并保留按坐标检测作为兜底/辅助）

4. 代码简洁、商用规范、无冗余、可直接用于2D回合制网游项目。
```

---

## 文档结束
