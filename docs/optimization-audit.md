# jjfb 性能优化审计清单（可执行版）

> 生成日期：2026-09-19
> 审计范围：`assets/Script/**/*.ts`（客户端 Cocos Creator 3.x，75 个 TS）+ `server/**/*.py`（Python asyncio WS 服务端，排除 `admin-ui/`、`tools/`、`node_modules/`）
> 用途：**交给执行方 AI / 开发者逐条落地**。每条都给了定位、成因、改法、验收方式。

---

## 0. 执行约定（先读）

1. **一次只改一条**，改完立刻跑 §6 回归命令，全绿再进入下一条。
2. 不得修改业务逻辑语义。本文所有条目都是「等价改写」，若发现某条改动会改变行为 —— **停下来，不要猜**。
3. 每完成一条，在 §5 状态表里把 `⬜` 改成 `✅`，并补一行 `改动摘要`。
4. **禁止区**（见 §4）：拆分三大客户端文件、改 WS 协议路由结构、动 `docs/story-system-plan.md` 里的 P2/P3 任务范围。
5. 不得使用 `parallel tools` 同时编辑**同一个文件**（会产生写竞争，历史教训）。

---

## 1. 基线数据（本次扫描实测）

### 客户端体积

| 文件 | 行数 | 备注 |
|------|------|------|
| `assets/Script/Game/StoryManager.ts` | 3077 | 剧情主状态机 |
| `assets/Script/Game/BattleScene.ts` | 2625 | 战斗场景 |
| `assets/Script/Game/BagItem.ts` | 2599 | 背包 UI |
| `assets/Script/Game/RobotList.ts` | 1398 | 机甲列表 |
| `assets/Script/CharacterSelect/CharacterSelect.ts` | 1322 | 选人界面 |
| `assets/Script/global/WebSocketManager.ts` | 1270 | WS 收发中枢 |
| `assets/Script/Game/GameArea/PlayerGridMove.ts` | 1136 | 大世界移动 |

### 服务端体积

| 文件 | 行数 |
|------|------|
| `server/handlers/bag_handler.py` | 1931 |
| `server/handlers/admin_handler.py` | 1921 |
| `server/handlers/robot_handler.py` | 1838 |
| `server/ws_server.py` | 1511 |
| `server/handlers/item_effect.py` | 1314 |
| `server/handlers/equipment_handler.py` | 1279 |

### 关键计数

| 指标 | 数量 | 说明 |
|------|------|------|
| 客户端 `console.*` 裸调用 | **786** | 无分级门控 |
| `async def` 内直接调用同步 Mongo 封装 | **114** | 见 P0-1，最严重 |
| `safe_mongo_operation` 调用总数 | 141 | 内含 `time.sleep` |
| `async_mongo_operation*` 调用总数 | 122 | 正确姿势 |
| Mongo `find`/`find_one` 未带 projection | **157** | 拉全文档 |
| `Items.json` 路径解析重复实现 | 4 处 | 且 fallback 顺序不一致 |
| 未配对的 `setTimeout/setInterval` | 多文件 | 见 P1-5 |

---

## 2. P0 级（可用性与吞吐，优先做）

### P0-1 · `safe_mongo_operation` 在事件循环内同步阻塞

**优先级**：最高。这是全站最严重的可用性隐患。

**位置**
- 定义：`server/handlers/utils.py:91`（`safe_mongo_operation`），内含 `time.sleep(delay)`，行 **106 / 116**
- 退避序列：`delay = 1.0 * (attempt + 1)`，`max_retries=5` → 单次调用最坏 **1+2+3+4 = 10 秒**

**调用分布**（在 `async def` 函数体内直接调用的，单位：处）

| 文件 | 次数 |
|------|------|
| `server/handlers/admin_handler.py` | 57 |
| `server/handlers/robot_handler.py` | 13 |
| `server/handlers/character_handler.py` | 12 |
| `server/handlers/login_handler.py` | 10 |
| `server/handlers/battle_room_handler.py` | 8 |
| `server/handlers/utils.py` | 4 |
| `server/services/story_battle_shared.py` | 3 |
| 其余（battle/item_effect/mail/player/story/middleware） | 各 1–2 |
| **合计** | **114** |

样例（可直接跳转）：
```
server/handlers/battle_room_handler.py:58,72,78,87  [_load_player_pet_snapshot]  (async def)
server/handlers/admin_handler.py:45,48              [handle_admin_search_account]
server/handlers/admin_handler.py:306,314,323        [handle_admin_modify_gold]
server/middleware.py:87                             [admin_auth_middleware]
```

**成因与影响**
`async def` handler 里写 `utils.safe_mongo_operation(lambda: col.find_one(...))` 是**同步调用**。它在事件循环线程上直接执行 Mongo 查询。一旦 Mongo 抖动（AutoReconnect / ConnectionResetError），退避里的 `time.sleep` 会把**整个 asyncio 事件循环阻塞最长 10 秒**——期间这台服务器上的**所有** WebSocket 连接全部停止响应（心跳、聊天、移动、战斗全卡死）。

这是典型的「平时一切正常，网络一抖全线雪崩」问题，本地测试极难复现。

**修复方案**

把 `async def` 内的 `safe_mongo_operation(op)` 替换为已有的异步封装：

- 只读路径 → `await utils.async_mongo_operation_read(op)`（`server/handlers/utils.py:126`，线池内单次执行 + async 层短退避，超时 12s）
- 写路径 → `await utils.async_mongo_operation(op)`（`server/handlers/utils.py:175`）

改法模板：
```python
# before
doc = utils.safe_mongo_operation(lambda: utils.players_col.find_one({'character_id': cid}))

# after
doc = await utils.async_mongo_operation_read(
    lambda: utils.players_col.find_one({'character_id': cid})
)
```

**执行顺序**
1. 先改**非 admin** 的文件：`battle_room_handler` / `battle_handler` / `story_battle_shared` / `mail_handler` / `player_handler` / `story_handler` / `item_effect` / `character_handler` / `login_handler` / `robot_handler` —— 这些在游戏主路径上。
2. `admin_handler.py`（57 处）最后单独改，它不在玩家主路径，风险最低但改动量最大。
3. `server/middleware.py:87` 单独确认：若 `admin_auth_middleware` 挂在全局中间件链上，优先级提前到最高。

**验证方式**
```bash
# 静态检查：应输出 0
grep -rn "safe_mongo_operation" server/ --include=*.py | grep -v admin-ui | wc -l
# 期望：只剩 sync def 上下文里的合法调用（目标 < 30）
```
运行时验收：断开 Mongo（`systemctl stop mongod`）2 秒后恢复，**服务端不得出现全场停顿**；单连接请求应快速报错而不是卡满 10 秒。

---

### P0-1b · `async def` 内**直接裸调 Mongo**（未走任何封装）

> ⚠️ 本条为 2026-09-19 验收时补录。原清单 P0-1 只统计了 `safe_mongo_operation` 这一种写法，**漏掉了直接 `col.find_one()` 的裸调用**。P0-1 已修完 114 处，但下面这 67 处同样是「同步调用阻塞事件循环」。

**统计**（`async def` 函数体内，非 lambda 包裹的裸 Mongo 调用）：**9 个文件 / 67 处**

| 文件 | 处数 | 样例行 |
|------|------|--------|
| `server/handlers/item_effect.py` | 24 | 200, 211, 247, 265, 290 |
| `server/handlers/equipment_handler.py` | 15 | 510, 555, 670, 796, 866 |
| `server/services/minigame2_service.py` | 8 | 207, 230, 245, 333, 342 |
| `server/handlers/character_handler.py` | 7 | 248, 424, 621, 663, 667 |
| `server/handlers/chat_handler.py` | 5 | 22, 52, 69, 110, 122 |
| `server/handlers/item_exp_handler.py` | 4 | 51, 66, 223, 240 |
| `server/handlers/admin_handler.py` | 2 | 1740, 1773 |
| `server/handlers/battle_room_handler.py` | 1 | 248 |
| `server/services/mail_service.py` | 1 | 55 |

**影响**
虽然这些不像 P0-1 那样带 `time.sleep` 退避（所以不会卡满 10 秒），但同步 Mongo 往返的网络等待仍在事件循环线程上完成。单次通常几毫秒到几十毫秒，但：
- Mongo 慢查询 / 锁等待时会直接放大成百毫秒级停顿
- `item_effect`、`equipment_handler`、`character_handler` 都在**玩家主路径**（用物品、穿装备、切角色）
- `chat_handler` 的 `insert_one` 在聊天发送路径上

**修复方案**
与 P0-1 相同，包进异步封装：
```python
# before
player = utils.players_col.find_one({'character_id': cid})

# after
player = await utils.async_mongo_operation_read(
    lambda: utils.players_col.find_one({'character_id': cid})
)
```
写操作用 `await utils.async_mongo_operation(lambda: ...)`。

**注意**：
- `minigame2_service.py:245` 的 `bulk_write`、`battle_room_handler.py:248` 的 `find()` 游标要整体包进 lambda，别把游标带出 executor 再迭代。
- 同一函数内多次调用可用 `asyncio.gather` 并行（参考 `robot_handler.py:787` 的既有写法）。

**执行顺序**：`item_effect` → `equipment_handler` → `character_handler` → `item_exp_handler` → `chat_handler` → `minigame2_service` → 其余。

**验证方式**
```bash
# 改完后应显著下降（目标 0，允许 sync def 与 lambda 内的合法调用）
# 对照命令：在 async def 内搜索 _col.<mongo方法>( 且非 lambda
```
配合 `python -m pytest server/tests -q` 全绿。

---

### P0-2 · 写操作仍把 10 秒退避丢进 50 线程的池子（`async_mongo_operation` 自身缺陷）

**位置**：`server/handlers/utils.py:175-210`，第 200 行：
```python
result = await asyncio.wait_for(
    loop.run_in_executor(db_executor, safe_mongo_operation, operation, max_retries),
    timeout=timeout
)
```
线程池大小：`server/ws_server.py:171` `DB_THREAD_POOL_SIZE = 50`

**成因与影响**
`async_mongo_operation` 本身不阻塞事件循环（OK），但它把**带 `time.sleep` 退避的整个 `safe_mongo_operation`** 提交给 `db_executor`。Mongo 抖动时，每个写操作会**占住一个池线程最长 10 秒**。50 个线程 → 约 51 个并发写请求就能让线程池饱和，之后所有 DB 操作（包括只读）在队列里排队，整体表现为「请求逐渐变慢直到全卡」。

**修复方案**
参考同文件里 `async_mongo_operation_read` 的正确做法（126-171 行）：线程池内**只做单次 `operation()`**，重试和退避放在 async 层用 `asyncio.sleep`。

改造 `async_mongo_operation`：
```python
async def async_mongo_operation(operation, max_retries=5, timeout=10.0):
    from ws_server import db_executor
    import asyncio, time as time_module
    if db_executor is None:
        return safe_mongo_operation(operation, max_retries=min(max_retries, 2))
    loop = asyncio.get_event_loop()
    deadline = time_module.monotonic() + timeout
    last_err = None
    for attempt in range(max_retries):
        remaining = deadline - time_module.monotonic()
        if remaining <= 0:
            break
        try:
            return await asyncio.wait_for(
                loop.run_in_executor(db_executor, mongo_op_once, operation),
                timeout=max(remaining, 0.02),
            )
        except (asyncio.TimeoutError, AutoReconnect, ConnectionFailure,
                ServerSelectionTimeoutError, NetworkTimeout, ConnectionResetError) as e:
            last_err = e
            if attempt < max_retries - 1:
                await asyncio.sleep(min(0.05 * (2 ** attempt), 0.25))
            continue
        except Exception:
            raise
    raise last_err if last_err else TimeoutError(f'MongoDB 写操作超时（{timeout}秒）')
```
> ⚠️ 语义变化提示：`mongo_op_once` 是单次执行不重试的版本（已在 read 路径使用）。改造后单次操作的重试语义由 async 层接管，**重试总次数语义保持一致**，但退避从 1/2/3/4 秒变为 0.05/0.1/0.2/0.25 秒。若业务依赖「长退避等待 Mongo 恢复」，需先确认 —— 默认建议采用短退避 + 快速失败，由客户端重试。

**验证方式**
`server/tests/` 全绿；人为让 Mongo 不可用 3 秒，观察大量并发写请求时**只读接口仍能在百毫秒级返回**。

---

### P0-3 · 客户端日志面板：每条日志触发一次全量文本重渲染

**位置**：`assets/Script/global/log.ts`

**成因**
`Log.onLoad()`（行 18）劫持了 `console.log / warn / error`：
```ts
console.log = (...args: any[]) => { this.origLog(...args); append('INFO', args); };
```
`append()`（22-31）每来一条日志就 push 到 `this.lines` 并调用 `this.render()`；
`render()`（62-74）干的是：
```ts
this.text.string = this.lines.join('\n');   // 全量字符串拼接，O(n)
// getComponent + setContentSize + scrollToBottom
```

三个叠加问题：
1. **`lines` 数组无上限**：只增不减 → 内存持续增长，且 `join` 越来越慢（随时间劣化）。
2. **每条日志一次全量重绘**：全仓有 **786 处** `console.*`，WS 每收到一条 push 消息都可能触发。
3. **面板没打开也在渲染**：`render()` 没判断 `scrollView.node.active`。

**影响**：在中低端机型上，聊天/大世界消息频繁时会出现明显掉帧，且随时间越玩越卡。

**修复方案**
```ts
private static readonly MAX_LINES = 300;
private dirty = false;
private flushScheduled = false;

private append(level: string, args: any[]) {
    try {
        const msg = args.map(v => { try { return typeof v === 'string' ? v : JSON.stringify(v); } catch { return String(v); } }).join(' ');
        this.lines.push(`[${level}] ${msg}`);
        if (this.lines.length > Log.MAX_LINES) this.lines.splice(0, this.lines.length - Log.MAX_LINES);
        this.dirty = true;
        this.scheduleFlush();
    } catch {}
}

private scheduleFlush() {
    if (this.flushScheduled) return;
    this.flushScheduled = true;
    setTimeout(() => { this.flushScheduled = false; if (this.dirty) { this.dirty = false; this.render(); } }, 100);
}

private render() {
    if (this.scrollView && this.scrollView.node && !this.scrollView.node.activeInHierarchy) return; // 不可见不渲染
    // ...原逻辑
}
```
另外：`openPanel()` / `togglePanel()` 打开时需要立刻 `render()` 一次补上。

**验证方式**
用 Cocos 模拟器挂机 10 分钟的世界频道刷屏场景，对比改动前后：帧率稳定性 + 内存曲线不应持续上涨。

> 备注：该组件在 `assets/Script` 中**没有任何 import 引用**，疑似通过编辑器挂在场景/预制体上。动手前先确认它是否挂载、挂在哪个常驻场景。

---

### P0-4 · 日志没有分级门控

**位置**：全仓 786 处，热点文件：

| 文件 | console 数量 |
|------|-------------|
| `assets/Script/Game/BagItem.ts` | 83 |
| `assets/Script/CharacterSelect/CharacterSelect.ts` | 74 |
| `assets/Script/Game/Test.ts` | 71 |
| `assets/Script/Game/CharacterProfile.ts` | 64 |
| `assets/Script/Game/GameControl.ts` | 63 |
| `assets/Script/Game/BattleScene.ts` | 39 |
| `assets/Script/Game/GameCommonData.ts` | 33 |
| `assets/Script/global/WebSocketManager.ts` | 31 |

**现状**
已有开关：`GameConfig.DEBUG_MODE`（`GameConfig.ts:141`）默认 `false`，`GameConfig.LOG_WS_TRAFFIC`（142 行）默认 `false` —— 但**只有 WebSocketManager 的两处**用了它们，其余 700+ 处仍是裸 `console.*`。

**修复方案**
新增统一 logger（建议 `assets/Script/global/log.ts` 内或单独 `Logger.ts`）：
```ts
export const enum Level { Debug, Info, Warn, Error }
export class Logger {
    static enabled = GameConfig.DEBUG_MODE;
    static debug(...a: any[]) { if (Logger.enabled) console.log('[D]', ...a); }
    static info (...a: any[]) { console.log('[I]', ...a); }
    static warn (...a: any[]) { console.warn('[W]', ...a); }
    static error(...a: any[]) { console.error('[E]', ...a); }
}
```
**分批替换**（不要一次全量替换，容易引入语法错误）：
1. 第一批：仅 `WebSocketManager.ts`、`GameCommonData.ts`、`BattleScene.ts`（91 处）
2. 第二批：`BagItem.ts`、`GameControl.ts`、`CharacterProfile.ts`（210 处）
3. 第三批：其余

调试用的临时日志（打印对象、追踪流程）→ `Logger.debug`；用户可见异常 → 保留 `Logger.warn/error`。

**验证方式**：`GameConfig.DEBUG_MODE = false` 时，控制台除 warn/error 外应基本静默。

---

## 3. P1 级（交互流畅度 / 正确性）

### P1-1 · `RobotList` 出战队伍一变就全量重建列表

**位置**：`assets/Script/Game/RobotList.ts:241`
```ts
private onBattleTeamUpdate(data: any) {
    ...
    if (this.node?.active && this.currentPets.length > 0) this.refreshListUI();
}
```
`refreshListUI()`（602-621）执行链：`sortByBattleTeam()` 重排 → `bgColorMap.clear()` → `renderList(全量)` → 按 pet_id `findIndex` 重新选中并 `onRowClick`。

**影响**：拖拽/点击出战位时，每次 `battle_team_update` 推送都触发一次完整列表重建 + 一次额外选中回调（可能连带触发网络请求）。玩家感知为列表闪烁、操作迟滞。

**修复方案**：`onBattleTeamUpdate` 内做**局部更新**——只遍历已存在的行节点，更新选中态/背景色，不重排、不重建、不重触发 `onRowClick`。仅当队伍成员集合**真的发生增删**时才走 `refreshListUI()`。

---

### P1-2 · `CharacterSelect.refreshAllSlots()` 调用过载

**位置**：`assets/Script/CharacterSelect/CharacterSelect.ts`
调用点：行 **274、317、411、443、902、927、968、985**（共 9 次）
定义：行 414（内部还会检查 wsManager / token / 连接状态，失败即 `console.warn`）

**影响**：多个事件连续触发时，同一个 `refreshAllSlots` 在一帧内被执行多次，每次全量刷新全部角色槽位（含数据请求）。

**修复方案**：改为脏标记 + 下一帧合并。
```ts
private _slotsDirty = false;
private requestRefreshAllSlots() {
    if (this._slotsDirty) return;
    this._slotsDirty = true;
    this.scheduleOnce(() => { this._slotsDirty = false; this.refreshAllSlots(); }, 0);
}
```
把 9 个调用点改为 `requestRefreshAllSlots()`（首次立即刷新处除外）。

---

### P1-3 · `FriendPanel` 每次打开都全量重建

**位置**：`assets/Script/Game/FriendPanel.ts:136-144`
```ts
onEnable() {
    this.scheduleOnce(() => { if (this.node.active) this.switchTab('friend'); }, 0.1);
}
```
→ `switchTab` → `refreshCurrentList()`（159）→ `clearContent()`（169，`removeAllChildren()`）+ 重新发起网络请求。

**影响**：面板反复开关会重复拉取好友列表并整块重建 UI。
**修复方案**：加 TTL 缓存（如 5 秒内数据未变化则复用），命中缓存时跳过请求与 `clearContent`，仅刷新差异行。

---

### P1-4 · 每帧 / 循环内的 `getComponent`

| 位置 | 说明 |
|------|------|
| `assets/Script/Game/GameArea/WorldFollow.ts:53-54` | `update()` 内每帧 `getComponent(UITransform)` ×2 |
| `assets/Script/Game/RobotShow.ts:287` | 循环体内 `n.getComponent(UIOpacity)` |

**修复方案**：在 `start()` / `onLoad()` 里取一次存成员，`update` 只做判空。这是 Cocos 常规优化，改动安全。

---

### P1-5 · 未清理的定时器

| 文件 | set 次数 | clear 次数 |
|------|---------|-----------|
| `assets/Script/CharacterSelect/CharacterSelect.ts` | 15 | 10 |
| `assets/Script/Game/RobotShow.ts` | 5 | 0 |
| `assets/Script/Game/GameMenu.ts` | 2 | 0 |
| `assets/Script/Game/ResourceManager.ts` | 2 | 0 |
| `assets/Script/CharacterSelect/CharacterPanel.ts` | 1 | 0 |
| `assets/Script/Game/GameCommonData.ts` | 1 | 0 |
| `assets/Script/Game/MechAttributeTEST.ts` | 1 | 0 |
| `assets/Script/Game/MechEquipment.ts` | 1 | 0 |
| `assets/Script/Game/RobotAttributePanel.ts` | 1 | 0 |
| `assets/Script/global/SceneLoadMonitor.ts` | 1 | 0 |

**影响**：场景切换后回调仍会在已销毁节点上执行（`isValid` 未判的情况下会抛错或误改状态）。
**修复方案**：所有 `setTimeout/setInterval` 句柄存成成员，在 `onDisable()` / `onDestroy()` 统一清理；回调体首行加 `if (!this.node?.isValid) return;`。

补充：`CharacterSelect.ts` 中存在 `checkAuth` 100ms 轮询（445、451）与多个 fallback 定时器（`staleSessionFallbackTimer` / `slotDataFallbackTimer` / `selectCharacterTimeout`），属于「用延时编排掩盖竞态」。**本轮只要求清理句柄，不要求重构时序**（重构属 §4 禁止区，需另行立项）。

---

### P1-6 · 服务端：Items.json 路径解析重复且不一致

**位置**（4 份独立实现，候选路径顺序各不相同）：
| 文件 | 行 |
|------|-----|
| `server/handlers/bag_handler.py` | 243-248（6 条候选） |
| `server/handlers/equipment_handler.py` | 135-137（3 条） |
| `server/handlers/item_effect.py` | 25-28（4 条） |
| `server/ws_server.py` | 1421-1427（2 条 + 兜底返回） |

**风险**：不是单纯冗余 —— **fallback 顺序不一致意味着不同模块在特定环境下可能读到不同版本的 `Items.json`**，造成「背包显示有但用不了」这类诡异问题，且难以排查。

**修复方案**：抽到单一位置（建议新建 `server/config_loader.py`）：
```python
_ITEMS_CACHE = {'mtime': None, 'data': None}

def load_items_json():
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    for path in (os.path.join(base, 'data', 'Items.json'),
                 os.path.join(base, 'handlers', 'json', 'Items.json'),
                 os.path.join(base, 'assets', 'resources', 'json', 'Items.json')):
        if os.path.exists(path):
            mt = os.path.getmtime(path)
            if _ITEMS_CACHE['mtime'] != mt:
                with open(path, 'r', encoding='utf-8') as f:
                    _ITEMS_CACHE = {'mtime': mt, 'data': json.load(f)}
            return _ITEMS_CACHE['data']
    return []
```
顺带解决 P2-1（每次 json.load 的重复 IO）。改完后 4 处调用改为 `from config_loader import load_items_json`。

**验证**：`python -c "from handlers.bag_handler import *"` 及各 story/bag 测试通过；改动后 `Items.json` 内容 small edit 应立即生效（mtime 失效策略）。

---

### P1-7 · 服务端：admin 批量操作 N 次往返

**位置**：`server/handlers/admin_handler.py`
- 103（循环内 `find_one`）
- 306 / 314 / 323（`find_one` → `update_one` → `find_one` 回读）
- 378 / 388 / 400（同上）

**影响**：批量改玩家时每个对象 3 次 DB 往返。
**修复方案**：合并为 `find_one_and_update(..., return_document=ReturnDocument.AFTER)`，一次往返拿到更新后文档；批量场景改用 `bulk_write`。

---

## 4. P2 级（长期维护 / 资源占用）

### P2-1 · 配置 JSON 重复加载无缓存

位置：`server/handlers/equipment_handler.py:88,143`、`server/handlers/item_effect.py:34,50`、`server/handlers/robot_upgrade.py:166,181`、`server/services/story_service.py:75,88`
方案：随 P1-6 一并接入带 mtime 校验的统一 loader。注意 `equipment_handler.py:1186,1198` 已有 `_sets_cache` / `_enhance_cfg_cache` 类级缓存先例，可作为范例。

### P2-2 · `query_cache` 无容量上限 + 前缀失效 O(n)

位置：`server/handlers/utils.py:799-830`（`get_cached_query` / `set_cached_query` / `invalidate_cached_query` / `invalidate_cached_query_prefix`）
问题：
- `query_cache` 是普通 dict，只靠 kv 失效，长时间运行会膨胀
- 新加的 `invalidate_cached_query_prefix`（825）用 `[k for k in query_cache.keys() if ...]` 全表遍历，缓存大时每次失效都扫全表
方案：改为按前缀分桶 `{prefix: {key: entry}}` + LRU 上限（如 2000）+ 定时清理过期项。

### P2-3 · Mongo 查询普遍缺 projection

统计：**157 处** `find`/`find_one` 未带 projection。
热点：`admin_handler.py` 28 处、`robot_handler.py` 17、`bag_handler.py` 13、`item_effect.py` 13、`daletou_service.py` 10、`character_handler.py` 9。
方案：只对**返回给客户端的大文档**（`players`、`robotpets`）优先加 projection，按字段白名单取用，避免整文档网络传输 + 反序列化开销。不必一次改完，按接口热度排序。

### P2-4 · 巨型文件

见 §1 基线表。客户端 `StoryManager`(3077) / `BattleScene`(2625) / `BagItem`(2599)，服务端 `bag_handler`(1931) / `admin_handler`(1921) / `robot_handler`(1838)。
`docs/protocol-audit.md` §4.7 明确写着「拆分 StoryManager / BattleScene / BagItem / WebSocketManager —— 本轮禁止」。**属 §4 禁止区，不要擅自动手。**

---

## 5. 状态表（执行方回填）

| 编号 | 条目 | 主要文件 | 状态 | 改动摘要 |
|------|------|---------|------|---------|
| P0-1 | async 内 `safe_mongo_operation` 同步阻塞 | utils.py + 13 个 handler | ✅ 已验收 | `async def` 内的 `safe_mongo_operation` 改为 `await async_mongo_operation(_read)`。含 admin 58 处与全局 `admin_auth_middleware`。同步函数里的合法调用保留。`pytest tests` 74 passed |
| P0-1b | async 内**裸调 Mongo**（清单补录） | 9 个文件 / 67 处 | ✅ | `async def` 内 67 处裸 `find/update/insert/delete/bulk_write` 改为 `await async_mongo_operation(_read)`。`find()` 在线程里 `list()` 完再返回。`battle_room_handler` 与 `mail_service` 样例行已在 lambda 内，未再包一层。`minigame2_service` 补了 `from handlers import utils`。`pytest tests` 74 passed |
| P0-2 | 写操作占满线程池 | utils.py:175-210 | ✅ 已验收 | 线程池只跑单次 `mongo_op_once`；连接类错误在 async 层短退避（0.05–0.25s）。`pytest tests` 74 passed |
| P0-3 | 日志面板全量重绘 | global/log.ts | ✅ 已验收 | 行数上限 300；100ms 合并刷新；面板不可见不渲染；打开时补绘一次。当前场景未挂这个组件。`test:runtime` 41 passed |
| P0-4 | 日志分级门控 | 786 处 console | ✅ 已验收 | 新增 `Logger.ts`。流程 `console.log` 改 `Logger.debug`（`DEBUG_MODE=false` 时静默），`warn`/`error` 仍始终输出。`LOG_WS_TRAFFIC` 五处走 `Logger.ws`。`log.ts` 对 console 的劫持、JSDoc 示例未动。`StoryManager.storyLog` 按原级别转发。第三批 32 个文件、463 处。`test:runtime` 41 passed |
| P1-1 | RobotList 全量重建 | RobotList.ts:241 | ✅ 已验收 | `battle_team_update` 只在出战成员集合增删时 `refreshListUI`。成员不变只改已有行的「出战」标记和底色，不重排、不重建、不重触发 `onRowClick`。顺序变化不再整表刷新。`test:runtime` 41 passed |
| P1-2 | refreshAllSlots 过载 | CharacterSelect.ts | ✅ 已验收 | 新增 `requestRefreshAllSlots`，同一帧多次刷新合并到下一帧一次。首次进场景选中第 0 槽仍立刻 `refreshAllSlots`。销毁时取消未执行的合并回调。`test:runtime` 41 passed |
| P1-3 | FriendPanel 全量重建 | FriendPanel.ts:136 | ✅ 已验收 | 好友/申请列表各缓存 5 秒。命中则不请求、不 `clearContent`；名单有差异才改对应行。删/拒/加强制刷新；同意申请同时丢掉好友列表缓存。换角色后缓存作废。`test:runtime` 41 passed |
| P1-4 | 每帧 getComponent | WorldFollow / RobotShow | ✅ | `WorldFollow.lateUpdate` 复用 `start` 时取的两个 `UITransform`，节点换了才重取。伤害数字在克隆时记下 `UIOpacity`，渐隐不再每帧 `getComponent`。`test:runtime` 41 passed |
| P1-5 | 定时器未清理 | 10 个文件 | ✅ 已验收 | 组件侧句柄此前已在 onDestroy 清理。本轮补：`ResourceManager` 预加载错峰定时器按会话跟踪，结束或新开一轮时 `clearTimeout`；`RobotShow` 静态配表/图集错峰进 `configLoadTimers`，触发后出队，**不在实例销毁时打断**全局预加载；实例 `applyReadyTimers` 触发后也会出队。`test:runtime` 41 passed |
| P1-6 | Items.json 重复解析 | 4 个文件 | ✅ 已验收 | 新增 `server/config_loader.py`，固定路径顺序并按 mtime 缓存。背包/装备/效果/管理台静态路径都改走这里。命中 `server/data/Items.json`（69 条）。`pytest tests` 74 passed |
| P1-7 | admin N 次往返 | admin_handler.py | ✅ 已验收 | 按角色名搜索改为一次 `$in` 取账号。改金币、改等级改为 `find_one_and_update` 返回更新后文档，不再查、写、再查。这两处是单角色写入，没有批量写，未用 `bulk_write`。角色在更新瞬间被删时，原先的「更新失败」并入「角色不存在」。响应字段未改。`pytest tests` 74 passed |
| P2-1 | 配置重复加载 | 4 个文件 | ✅ 已验收 | `config_loader.load_json_file` 按绝对路径 + mtime 缓存。装备五件套、`Classes.json`、`ClassCoefficient.json`、`battle_refs.json`、剧情地图 JSON 都走这里；文件改过才重新解析。套装/强化原有进程内缓存未动。成功日志只在真正读盘时打。`pytest tests` 74 passed |
| P2-2 | query_cache 无上限 | utils.py:799-830 | ✅ 已验收 | 查询缓存按前缀分桶：`robot_pets` 按角色一桶，好友/数量各一桶。失效只删命中的桶，不再扫全表。上限 2000，超出丢掉最久未用的。读到过期项立刻删；原 5 分钟清理改为 `purge_expired_query_cache`。TTL 仍是 30 秒。`pytest tests` 74 passed |
| P2-3 | 缺 projection | 157 处 | ✅ 已验收 | 本轮只改高频读路径：`get_player`、选角槽位、`get_battle_team`、放生存在性检查、机甲详情、登录角色校验。`get_robot_pets` 原先已有 `$project`。背包/管理台/物品效果等整文档读写未动。响应字段未改。`pytest tests` 74 passed |
| P2-4 | 巨型文件拆分 | — | ⛔ 禁止 | |

---

## 6. 回归命令（每改完一条必须跑）

```bash
# 仓库根目录 jjfb/

# 1) 服务端 story 测试
cd server && python -m pytest tests/test_story_*.py -q

# 2) 服务端全量（若有）
cd server && python -m pytest tests/ -q

# 3) 客户端运行时测试
npm run test:runtime

# 4) 剧情门禁（含协议审计）
npm run test:story-gate

# 5) Juben 编辑器测试（改动涉及 Juben 时）
cd Juben && npm test
```

历史基线（2026-08-29）：
- `test:runtime` 41 passed
- `Juben` 269 passed
- `audit` 0 error
- `story pytest` 43 passed

低于基线即为回归，不要继续下一条。

---

## 7. 禁止区（红线）

1. **禁止拆分** `StoryManager.ts` / `BattleScene.ts` / `BagItem.ts` / `WebSocketManager.ts`（`docs/protocol-audit.md` §4.7）。
2. **禁止改动 WS 路由名 / 响应 type 结构**（会导致客户端 `request()` 监听失配；历史踩坑：`get_player` vs `player_info_response`）。
3. **禁止扩大 scope** 到 `docs/story-system-plan.md` 里 P2-01~05、P2-08/09/10、P3-* 的任务范围 —— 那是独立排期，别混进来。
4. **禁止为了通过测试而弱化断言**。
5. 工作区当前有 **4 个未提交改动**（`GameConfig.ts`、`PerformanceMonitor.ts`、`WebSocketManager.ts`、`server/handlers/utils.py`，均为上一轮日志降噪成果）。开工前先 `git status` 确认，别覆盖。

---

## 8. 建议执行顺序

```
第一梯队（可用性，风险最低收益最大）
  P0-2  →  P0-1（先非 admin 后 admin）  →  P1-6

第二梯队（客户端流畅度）
  P0-3  →  P0-4  →  P1-5

第三梯队（交互体验）
  P1-1  →  P1-2  →  P1-3  →  P1-4

第四梯队（维护成本）
  P1-7  →  P2-1  →  P2-2  →  P2-3

P2-4 需另行立项，不在本清单执行范围内。
```
