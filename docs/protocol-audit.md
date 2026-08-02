# WebSocket 协议审计报告

> 基线：`jjfb` 仓库 `main`（含 `2267d9c` 启动收敛 + `228389d` 全量上传）  
> 生成日期：2026-08-02  
> 范围：客户端 `assets/Script/**/*.ts`、服务端 `server/router.py` + `handlers/**`、`Juben`（无游戏 WS 协议）

## 1. 审计约定

| 项 | 说明 |
|----|------|
| 默认成功响应 | `{route}_response`（`utils.send_success_response` / `send_error_response`） |
| 例外 | `send_direct_response` 可自定义 `type`（如 `bag_items`、`robot_pet_info_response`） |
| `request_id` | 传入 `request_data` 时由工具函数自动回传 |
| Auth | `router.ROUTES[route].require_auth` |
| Char | Handler 内是否强制 `character_id` / 会话角色 |
| Push | 无对应客户端请求的服务端主动推送 |

路由字典：`server/data/route_dictionary.json` 与 `router.ROUTES` 共 **93** 条，名称 1:1 对齐。

---

## 2. 重点检查结论

### 2.1 `bag_get` ↔ `bag_items`

| 侧 | 行为 |
|----|------|
| 服务端成功 | `type: bag_items`（根字段 `items`，非 `data.slots`） |
| 服务端错误（本轮已修） | 统一为 `type: bag_items` + `success: false`（此前为 `bag_get_response`，与 `request()` 监听不一致） |
| 客户端 `request()` | 已映射监听 `bag_items` |
| `BagItem` | 使用 `send()` + `.on(BAG_ITEMS)`，不走超时重试 |
| `StoryManager` | `request('bag_get')` 后读 `resp.data?.slots`，与服务端根级 `items` **形状仍不一致**（本轮未改业务载荷） |

### 2.2 `story_interact` / `story_battle_start` / `battle_room_create` 重叠

| 路由 | 职责 | 客户端 |
|------|------|--------|
| `story_interact` | 交互预校验 / pending battle | `StoryManager` |
| `story_battle_start` | 仅生成剧情敌方 | **无游戏客户端调用**（服务端仍注册） |
| `battle_room_create` | 创建 PVE 房；带 `story_event_id` 时复用 pending 并生成敌方 | `BattleScene` |

生产路径：`story_interact` → `battle_room_create(story_event_id)`。`story_battle_start` 为冗余/备用，本轮保留。

### 2.3 `story_event_complete`

| 项 | 详情 |
|----|------|
| 成功类型 | `story_event_complete_response`（与 `request()` 默认一致） |
| 幂等 | Handler 内按 `request_id` 缓存命中直接回放；成功后 `mark_processed` |
| 中间件列表 | 不在全局 `IDEMPOTENT_ROUTES`，由 handler 自管 |

### 2.4 `battle_room_resume` 重复调用

| 调用方 | 用途 |
|--------|------|
| `BattleScene.enterBattleRoom` / `_onNetworkReconnect` | 恢复或创建战斗房 |
| `Test.ts` `_checkInBattleAndOpenPanel` | 检测 `has_room` 后自动打开面板 |

二者可能竞态，本轮**未改**战斗流程（属中风险，列入暂未修复）。

### 2.5 配置了重试但未走 `request()` 的路径

`RETRY_ON_TIMEOUT_ROUTES`：`bag_get`, `get_robot_pets`, `get_character_info`, `get_player`, `get_chat_history`, `get_announcements_history`, `battle_room_resume`, `world_enter`

| 路由 | 走 `request()`（可重试） | 走 `send`/`notify`（无超时重试） |
|------|--------------------------|----------------------------------|
| `bag_get` | StoryManager / CharacterSelect | **BagItem** |
| `get_robot_pets` | RobotList | **BattleScene notify** |
| `get_player` | GameCommonData 等 | **BattleScene send** |

### 2.6 仅服务端存在（游戏客户端未调用）

含全部 `admin_*`，以及：`story_battle_start`, `mail_delete`, `equip_socket`, `create_initial_pet`, `fix_robot_pet_form`, `upgrade_robot`, `delete_account`, `post_announcement` 等。  
（`refresh_token` 仅 WebSocketManager 内部使用。）

### 2.7 仅客户端调用 / 服务端未注册

| 类型 | 状态 | 本轮 |
|------|------|------|
| `battle_start` | BattleScene 曾发送，服务端无路由 → Unknown | **已删除客户端发送** |
| `pong` | 心跳应答，`ws_server` 特殊处理，不在 ROUTES | 正常 |
| `update_player_position` | Handler 存在但未挂 ROUTES（410 下线） | 保留文档，未删代码 |

---

## 3. 本轮已修复的协议问题

| # | 问题 | 修复 |
|---|------|------|
| 1 | `get_player` 的 `request()` 监听 `get_player_response`，服务端返回 `player_info_response` | 客户端映射 |
| 2 | `get_robot_pet_info` 监听 `get_robot_pet_info_response`，服务端返回 `robot_pet_info_response` | 客户端映射 |
| 3 | `bag_get` 错误响应类型为 `bag_get_response`，与成功/`request()` 不一致 | 错误也回 `bag_items` + `request_id` |
| 4 | 客户端发送未注册 `battle_start` | 移除该发送（不改本地开战逻辑） |
| 5 | 客户端批处理最终仍逐条发送且无服务端批量协议 | 删除批处理层，直发并保持离线队列顺序 |

---

## 4. 暂未修复（超出本轮低风险范围）

| # | 问题 | 原因 |
|---|------|------|
| 1 | StoryManager `bag_get` 载荷期望 `data.slots` vs 服务端 `items` | 涉及剧情/背包业务解析 |
| 2 | `story_battle_start` 与 `battle_room_create` 职责重叠 | 可能仍有工具/压力测试依赖 |
| 3 | Test.ts 与 BattleScene 双路 `battle_room_resume` | 改动可能影响战斗恢复 |
| 4 | BagItem/BattleScene 部分只读查询未改用 `request()` | 行为面更大，需联调 UI |
| 5 | `update_player_position` 死代码未注册 | 非活跃路径 |
| 6 | 管理后台鉴权 / 账号安全 | 本轮明确不做 |
| 7 | 拆分 StoryManager / BattleScene / BagItem / WebSocketManager | 本轮禁止 |

---

## 5. 服务端主动推送

| Push `type` | 来源 |
|-------------|------|
| `ping` | `ws_server` 心跳 |
| `announcement` | `chat_handler` |
| `chat_message` | `channel_service` |
| `bag_items_update` | bag / admin / character |
| `robot_pets_update` | robot / character / admin |
| `robotcount_update` | character / admin |
| `battle_team_update` | set_battle_team / release |
| `player_info_update` | admin 改资源 |
| `world_player_join` / `world_player_move` / `world_player_leave` | `world_presence_service` |

---

## 6. 路由总表（游戏侧摘要）

列说明：**Auth** = require_auth；**Char** = 需角色；**RID** = 回传 request_id（经统一工具）；**Push** = 否表示请求-响应。

### 6.1 连接 / 鉴权

| Request | Client Expected | Server Actual | Auth | Char | RID | Client | Server |
|---------|-----------------|---------------|------|------|-----|--------|--------|
| handshake | handshake_ack | handshake_ack | N | N | Y | WebSocketManager | connection_handler |
| connection_init | connection_init_response | same | N | N | Y | WebSocketManager | connection_handler |
| login / register | *_response | same | N | N | Y | login.ts | login_handler |
| auth_request | auth_response | same | N | N | Y | login / AutoLogin / CharacterSelect | login_handler |
| logout / full_logout | *_response | same | Y | N | Y | WSM / BaseSceneController | login_handler |
| change_password | *_response | same | N | N | Y | ChangePasswordPanel | login_handler |
| refresh_token | *_response | same | N | N | Y | WSM 内部 | login_handler |
| pong | — | 特殊处理 | — | — | — | WSM | ws_server（非 ROUTES） |

### 6.2 角色 / 玩家 / 大世界

| Request | Expected | Actual | Auth | Char | Client | Server |
|---------|----------|--------|------|------|--------|--------|
| get_all_characters | all_characters_response | same | Y | N | WSM / CharacterSelect | character_handler |
| get_character_info | character_info_response | same | Y | slot | CharacterSelect | character_handler |
| select/create/delete_character | *_response | same | Y | — | CharacterSelect / Panel | character_handler |
| get_player | player_info_response（已映射） | player_info_response | Y | preferred | GameCommonData 等 | player_handler |
| world_enter/leave/step | *_response | same | Y | Y/soft | WorldOnlineSync | world_handler |

### 6.3 好友 / 聊天

| Request | Actual | Auth | Client | Server |
|---------|--------|------|--------|--------|
| get_friend_list / requests / search / add / approve / reject / delete | *_response | Y | FriendPanel 等 | friend_handler |
| get_chat_history / get_announcements_history / post_chat | *_response | Y | ChatRoomFull 等 | chat_handler |
| post_announcement | *_response | Y | 无游戏调用 | chat_handler |

### 6.4 机甲 / 战斗 / PVP

| Request | Expected | Actual | Auth | Char | Client | Server |
|---------|----------|--------|------|------|--------|--------|
| get_robot_pets | robot_pets_response | same | Y | soft | RobotList / BattleScene | robot_handler |
| get_robot_pet_info | robot_pet_info_response（已映射） | robot_pet_info_response | Y | soft | MechEquipment 等 | robot_handler |
| get_battle_team / set_battle_team | *_response | same | Y | Y | RobotList / BattleScene | robot_handler |
| battle_generate_enemy | *_response | same | Y | soft | BattleScene | battle_handler |
| battle_room_create/action/resume/result | *_response | same | Y | Y/soft | BattleScene (+Test resume) | battle_room_handler |
| pvp_flat_match | *_response | same | Y | soft | BattleScene | pvp_match_handler |
| story_battle_start | *_response | same | Y | Y | **无** | story_handler |

### 6.5 背包 / 物品 / 装备

| Request | Expected | Actual | Auth | Char | Client | Server |
|---------|----------|--------|------|------|--------|--------|
| bag_get | bag_items | bag_items（含错误） | Y | Y | BagItem / StoryManager | bag_handler |
| bag_write_random / use / discard / move / sort | *_response | same | Y | Y | BagItem | bag_handler |
| unequip_item / equip_enhance | *_response | same | Y | Y/soft | MechEquipment | bag / equipment_advanced |
| equip_socket | *_response | same | Y | soft | **无** | equipment_advanced |
| add / add_exp | *_response | same | Y | Y | CharacterSelectControl / Test | item_exp_handler |

### 6.6 剧情 / 邮件 / 小游戏

| Request | Actual | Auth | Char | Client | Server |
|---------|--------|------|------|--------|--------|
| story_get_state / interact / event_complete | *_response | Y | Y | StoryManager | story_handler |
| mail_list / read / claim | *_response | Y | Y | MailPanel | mail_handler |
| mail_delete | *_response | Y | Y | **无** | mail_handler |
| daletou_* / minigame2_* | *_response | Y | soft | MiniGame1/2 | 对应 handler |

### 6.7 Admin（`require_auth=False`，无 Cocos 游戏客户端）

见 `admin_handler` / `story_handler` / `mail_handler` 中 `admin_*` 路由；响应类型多为 `admin_search_response`、`admin_modify_response`、`admin_*_response` 等自定义短名。

---

## 7. 重复 / 废弃

| 项 | 说明 |
|----|------|
| `story_battle_start` vs `battle_room_create`+story | 敌方生成路径重复 |
| `connection_init` | 遗留；优先 handshake |
| `update_player_position` | 410 下线且未注册 |
| Admin 搜索/修改 | 多路由共享同一 response type（有意设计） |
| 服务端 `message_queue` / `batch_message_processor` | 已在 `2267d9c` 从 `ws_server` 移除；本轮确认无生产者 |
| 客户端消息批处理层 | 本轮已删除（原最终仍逐条 `send`） |

---

## 8. Juben

无游戏 WebSocket 协议。`event_done` / `task_active` 等为剧情 requirement schema。HTTP 为编辑器 `/api/*`，不纳入本表。

---

## 9. 扫描方法备忘

```text
server/router.py → ROUTES keys
server/data/route_dictionary.json → 双向 id
assets/Script：.request( / .send( / .notify( / MESSAGE_TYPES
handlers：send_success_response / send_direct_response / type:
```
