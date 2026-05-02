# 精英副本（非主线）与 JSON 落地示例

## 1. 精英副本组（完成主线后开放）

### 1) 伦卡空间站（dungeonId: 201）
- mapId：2011 / 2012 / 2013
- 主题：零重力战区、能量护盾敌群
- 关键 NPC：`elite_brief`、`elite_battle`、`elite_warp`

### 2) 潘多拉行星（dungeonId: 202）
- mapId：2021 / 2022 / 2023
- 主题：异星生态、高侵蚀敌人

### 3) 月球遗迹（dungeonId: 203）
- mapId：2031 / 2032 / 2033
- 主题：古代遗构、防御机关联动

### 4) 极北雪原（dungeonId: 204）
- mapId：2041 / 2042 / 2043
- 主题：极寒减益、长线消耗

## 2. 精英副本对话语气样例
- `精英行动不是主线补课，失败成本更高。`
- `你的输出够，但生存策略不够。`
- `这里每一步都要算资源与冷却。`

## 3. 单地图 JSON 示例（可直接改 mapId 复用）
```json
{
  "mapId": 1081,
  "mapName": "莱温霍姆-1层",
  "mapType": "normal_dungeon",
  "canEncounter": true,
  "encounterRate": 18,
  "enemyIds": [5101, 5102, 5103],
  "npcs": [
    {
      "npcUid": "1081_brief_01",
      "npcName": "前线简报官",
      "prefabKey": "npc_officer",
      "x": 192,
      "y": 240,
      "events": [
        {
          "eventType": "dialog",
          "eventTypeDesc": "对话",
          "eventParam": { "dialogId": 108101 },
          "order": 1
        },
        {
          "eventType": "task",
          "eventTypeDesc": "任务",
          "eventParam": { "taskId": 408101, "phase": "accept" },
          "order": 2
        }
      ]
    },
    {
      "npcUid": "1081_gate_01",
      "npcName": "层间引导员",
      "prefabKey": "npc_gatekeeper",
      "x": 576,
      "y": 240,
      "events": [
        {
          "eventType": "teleport",
          "eventTypeDesc": "传送",
          "eventParam": { "toMapId": 1082, "toX": 96, "toY": 144, "unlockKey": "clear_1081_boss" },
          "order": 1
        }
      ]
    }
  ],
  "copyInfo": {
    "copyType": "normal",
    "dungeonId": 108,
    "layer": 1,
    "refreshTime": "04:00",
    "isMainLine": true
  }
}
```

## 4. 对话 ID 与任务 ID 规划建议
- 对话：`mapId * 100 + 序号`（如 `108101`）
- 任务：`4 + mapId + 序号`（如 `408101`）
- 战斗：`3 + mapId + 序号`（如 `310811`）

