# PVP「空窗挽回期」倒计时机制设计

> 定稿：2026-09-28（用户拍板）
> 适用模式：**PVP 双方真人**（PVE 不受影响）

## 1. 问题背景

PVP 房间采用「双方各提交一次指令 → 服务器结算一整回合」的 request/response 模式。
若一方点完操作后另一方长时间挂机，先手玩家会一直卡在动画等待态（客户端 ANIMATING）无所事事，
既消耗耐心又浪费服务器连接。需要一套「无人操作就自动补普攻」的兜底机制。

**关键缺陷（2026-09-28 修复）**：PVP 原是纯 request/response、**没有任何服务端推送**，
因此「挂机方」从不发请求 → **永远拿不到新 state**：
- 看不到对方攻击自己的动画；
- 血条/状态停留在旧值不更新；
- 其客户端倒计时归零后还会自行发 ATTACK，被写进**下一回合**，造成数据错乱。

修复方案：**服务端在每回合结算后主动向房间内两名玩家推送 `pvp_round_update`**
（见第 4.6 节），客户端监听后按同一套逻辑演绎整回合。

## 2. 术语

- **空窗挽回期（grace window）**：进入指令阶段后，先静默观察 `GRACE_SECONDS = 5` 秒。
  期间**不显示**「剩余时间」面板，让有机会立刻操作的玩家感受不到倒计时压力。
- **倒计时（countdown）**：空窗期满后激活，沿用既有 `COMMAND_PHASE_SECONDS = 30` 秒（不新设独立秒数）。
- **接管（auto takeover）**：某方连续空窗满 `GRACE_TAKEOVER_ROUNDS = 2` 轮后，
  该方进入永久接管态（`auto_actions[side] = True`），后续回合服务器直接代打普攻，不再等待。
- **等待对方（waitingOpponent）**：自己已提交指令、对方未提交。此时「剩余时间」**继续显示并倒计时**，
  让玩家能看出对方是否挂机（若对方随后提交则立即结算）。

## 3. 时间线

```
进入指令阶段
  │
  ├─ [静默观察期 0~5s]  面板隐藏，双方自由操作
  │     └─ 任一方提交动作 / 重连 → 该方计数清零、解除接管（本回合继续等另一方）
  │
  ├─ [激活倒计时 5s]    「剩余时间」面板显示，开始 30s 倒计时
  │
  ├─ [倒计时归零]       缺动作的一方补 ATTACK（普通攻击），该方 noop_rounds += 1
  │                     → 结算本回合并推进到下一回合
  │
  └─ 下一回合重复上述流程
        └─ 某方连续 2 轮被补普攻 → auto_actions[side] = True（永久接管）
              └─ 此后该方无需再等：对方一提交动作，服务器立即用 ATTACK 补齐并结算
              └─ 该方玩家重新开始操作 → 解除接管、计数清零，回到「静默 5s」正常流程
```

## 4. 服务端实现（`server/services/battle_room_service.py`）

### 4.1 常量
```python
GRACE_SECONDS = 5            # 空窗静默观察期
GRACE_TAKEOVER_ROUNDS = 2    # 连续空窗多少轮后永久接管
COMMAND_PHASE_SECONDS = 30   # 倒计时秒数（沿用既有）
```

### 4.2 房间新增字段
| 字段 | 类型 | 含义 |
|------|------|------|
| `grace_active` | bool | 是否已激活倒计时（False = 仍在静默观察期） |
| `grace_deadline_ts` | int/None | 静默观察期截止时间戳（ms） |
| `command_deadline_ts` | int/None | 倒计时截止时间戳；静默期恒为 None |
| `command_phase_start_ts` | int | 本回合指令阶段开始时间戳（ms） |
| `remaining_command_seconds` | float | 倒计时剩余秒数（仅为客户端展示刷新） |
| `noop_rounds` | `{player:int, enemy:int}` | 每方连续空窗轮数 |
| `auto_actions` | `{player:bool, enemy:bool}` | 每方是否已被永久接管 |

### 4.3 关键方法
- `_set_command_phase_deadline(room)`：进入指令阶段时调用。
  `grace_active=False`、`command_deadline_ts=None`、`remaining_command_seconds=0`、
  `grace_deadline_ts = now + GRACE_SECONDS*1000`。
- `_activate_grace_countdown(room)`：静默期满调用。
  `grace_active=True`、`command_deadline_ts = now + COMMAND_PHASE_SECONDS*1000`。
- `_mark_round_activity(room)`：刷新 `last_action_ts`（防止房间被 idle 超时清理）。
- `_bump_side_noop(room, side)`：某方被补普攻 → 计数 +1；满 `GRACE_TAKEOVER_ROUNDS` → 置接管。
- `_clear_side_noop(room, side)`：某方主动操作/重连 → 计数清零 + 解除接管。

### 4.4 `submit_pvp_action` 等待循环

本方提交动作后（持锁）：
1. `_clear_side_noop(room, side)` + `_mark_round_activity(room)`
2. 若对侧已被永久接管且未提交 → 立即补 ATTACK + `_bump_side_noop(other)` → 结算返回
3. 若双方动作齐全 → 结算返回
4. 否则进入**锁外 `while True` 循环**：
   - 本次快照若双方齐全 → 结算返回
   - 未激活倒计时 → 等到 `grace_deadline_ts`
   - 已激活倒计时 → 等到 `command_deadline_ts`
   - 被 `event` 提前唤醒（对方提交）→ 回到循环检查
   - 等到点后（持锁）：
     - 仍在静默期 → `_activate_grace_countdown` + persist + **continue**（不结算）
     - 倒计时结束 → 缺动作方补 ATTACK + `_bump_side_noop` → 结算返回

**为什么用 while 循环而非一次性 wait**：静默期满只激活倒计时、不结算，
需要继续等到真正倒计时结束，故必须循环推进状态机。

### 4.5 后台守望任务（关键补充）

**问题**：`submit_pvp_action` 的等待循环只在「有人提交」时才运行。
若**双方都完全不操作**，没有任何协程在等待 → 回合永久挂起，倒计时也不会启动。

**解决**：每个 PVP 房间在进入指令阶段时启动一个后台守望任务
`_pvp_grace_watch_loop(room_id)`，独立负责推进：
```
等待静默期满 → 激活倒计时 → 等待倒计时到点 → 缺动作方补 ATTACK + bump_noop
→ 结算并推进回合 → 自动进入下一轮循环
```

- `_ensure_pvp_grace_watcher(room_id)`：幂等启动/复用；无事件循环（同步单测）时安全跳过。
- 启动点：① `create_pvp_room`；② `_compute_pvp_round_and_advance`（推进回合后）；
  ③ `get_room_by_id` 从 DB 恢复房间时（服务重启后自愈）。
- 取消点：`_destroy_room`、房间判定 finished 时。
- **防双结算**：守望任务与 `submit_pvp_action` 的等待循环共用 `_pvp_room_locks[room_id]`，
  且两者在持锁后都先校验 `round` 是否仍等于自己记录的 `watched_round`/`current_round`；
  谁先结算就把 `round` +1，后者校验失败即返回。结算后统一 `event.set()` 唤醒等待方。
- 任务内 `except Exception` 兜底记录日志，绝不静默死掉。

### 4.6 回合结算主动推送 `pvp_round_update`（修复挂机方黑屏）

**触发点**：`_compute_pvp_round_and_advance` 每次结算后（含 ESCAPE 提前结束的路径）调用
`_notify_pvp_round_settled(room, settled_round)`，通过 `loop.create_task` 异步触发，不阻塞结算。

**回调注册**：服务层不依赖 handler 层，通过 `set_pvp_round_notifier(fn)` 由
`server/handlers/battle_room_handler.py` 在模块导入时注入 `_push_pvp_round_update`。

**推送内容**：对房间内 `player` / `enemy` **两个内部方各推一份**，
每份都经过 `build_pvp_room_view_for_character(room, 该方cid)` 做**视角交换**，再清理 ObjectId、
刷新 `remaining_command_seconds`，载荷：
```json
{ "type": "pvp_round_update",
  "data": { "room_id": "...", "settled_round": 3, "state": { ...视角交换后的 room... } } }
```

**投递**：`utils.push_to_user(user_id, route, data)` —— 按 `user_clients[user_id]` 找到该用户所有在线
WebSocket 连接逐个 `send`；单个连接失败不影响其它连接。

**视角交换必须同步交换逐 side 字典**（`round_actions`/`auto_actions`/`noop_rounds`），
否则挂机方会把「对方的动作」读成「自己的动作」。

### 4.7 客户端接收与播放

- `WebSocketManager.handleMessage` 对任何带 `type` 的消息 `node.emit(type, data)`
  → 客户端无需协议改造，直接 `this.ws.on('pvp_round_update', handler, this)` 即可监听。
- `BattleScene.onPvpRoundUpdate(msg)`：
  1. 过滤非本房间推送；
  2. **去重**：`settled_round <= _lastPlayedPvpRound` → 忽略（防止与自己的请求回调重复播）；
  3. `isRequestingAction`（自己的请求还在飞）→ 交给请求回调统一处理，避免重复播；
  4. `isAnimating`（已在播动画）→ 忽略；
  5. 否则调用 `playRoundFromServerState(state, myAction, 基线HP…)` 演绎整回合。
- `playRoundFromServerState(...)` 是**请求回调与推送共用**的播放核心
  （原来内联在 `battle_room_request` 回调里，现抽出复用）。

### 4.8 倒计时归零的自动普攻归属

**服务器制 PVP 下，倒计时归零的「自动补普攻」完全由服务端权威执行**，客户端不再自行发送
`ATTACK`（否则该动作会被写进「下一回合」，玩家未决策却自动出招）。
客户端仅做：
- 显示倒计时归零；
- 等待服务端 `pvp_round_update`；
- **兜底**：归零后仍等不到推送满 3 秒（`_afterZeroWait >= 3`），才自行提交普攻，防网络丢包永久卡死。

**需求 2（自己已操作后倒计时继续）**：提交动作后设 `_waitingOpponent = true`，
`update(dt)` 在 `ANIMATING && isRequestingAction && _waitingOpponent` 期间**继续推进倒计时**，
`updateTimerLabel` 也保持面板可见 —— 玩家据此判断对方是否挂机；对方一旦提交，服务端立即结算并推送。

## 5. 客户端实现（`assets/Script/Game/BattleScene.ts`）

### 5.1 状态
```typescript
private readonly GRACE_SECONDS = 5;   // 与服务端一致
private graceTimeLeft: number = 0;    // 静默观察期剩余秒
private graceActive: boolean = false; // 是否已激活倒计时
```

### 5.2 方法
- `enterGraceWindow()`：`startCommandPhase()` 调用。置 `graceActive=false`、`graceTimeLeft=5`、
  `turnTimeLeft=TURN_TIME_LIMIT`、隐藏 `timerRoot`。
- `activateGraceCountdown()`：静默期满调用。置 `graceActive=true`、`turnTimeLeft=TURN_TIME_LIMIT`、
  显示 `timerRoot`。
- `releaseGraceWindow()`：玩家主动操作时调用（在 `sendBattleRoomAction` 开头）。
  置 `graceActive=false`、`graceTimeLeft=5`、隐藏 `timerRoot`，与服务端 `_clear_side_noop` 对应。
- `restoreGraceWindowFromState(state)`：重连恢复时调用。
  按 `state.grace_active` 决定显示与否；静默期用 `grace_deadline_ts` / `command_phase_start_ts` 推算剩余。
- `updateTimerLabel()`：`timerRoot.active = state===WAITING_COMMANDS && graceActive`。

### 5.3 `update(dt)` 两阶段
```typescript
if (state === WAITING_COMMANDS) {
    if (!graceActive) {
        graceTimeLeft -= dt;
        if (graceTimeLeft <= 0) activateGraceCountdown();
    } else {
        turnTimeLeft -= dt;
        if (turnTimeLeft <= 0) { /* 自动 sendBattleRoomAction('ATTACK') */ }
    }
}
```

### 5.4 超时阈值联动（易踩坑）
服务端 PVP 最坏等待 = 静默 5s + 倒计时 30s = **35s**，因此：
- `battle_room_action` 请求超时：PVP = **45000ms**（原 35000 不足）
- `animWatchdog`（isRequestingAction 期间）：PVP = **45s**（原 20s 会提前打断请求）

## 6. 测试
- `tools/tests/test_grace_window.py`：7 项纯 dict 状态机单测（常量 / 静默期 / 激活 / 2 轮接管 /
  解除 / 双方独立 / 完整链路），全部通过。
- `tools/tests/test_grace_timeline.py`：5 项真实 asyncio 时序模拟（临时缩小常量为
  GRACE=0.2s / COMMAND=0.4s 驱动真实等待循环）：
  ① 单方挂机 → 挂机方+1；② 持续挂机满 2 轮 → 永久接管；③ 挂机方恢复 → 解除接管；
  ④ 静默期内双方提交 → 立即结算；⑤ **双方都挂机 → 后台守望自动推进 + 接管**。
- `tools/tests/test_pvp_round_push.py`：6 项 —— 视角交换（actor / 逐 side 字典 / result.winner）、
  结算触发 notifier（含 `settled_round`）、ESCAPE 也通知、双方挂机守望结算也通知。全部通过。
- 客户端 `npx tsc -p tsconfig.json --noEmit` 全绿（assets/Script）。
- 运行环境：`C:\Users\Administrator\.workbuddy\binaries\python\envs\default\Scripts\python.exe`（已装 pymongo）。

## 7. 边界与已知限制
- **仅 PVP**：PVE 无空窗概念（`enterGraceWindow` 只在房间制路径生效，且 PVE 服务端走 `submit_player_action` 立即结算）。
- **本地模拟模式**（`useServerRoomBattle=false`）不走该机制，倒计时归零仍本地自动普攻。
- 客户端静默计时与服务端 `grace_deadline_ts` 存在约一个 RTT 的偏差，属可接受范围。
- 推送依赖 `user_clients` 注册表（`register_client_user` 时写入）；玩家完全离线时推送自然失败，
  其重连后走 `battle_room_resume` 全量恢复，不依赖推送。
