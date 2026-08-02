# Cocos 编辑器联调清单（P3）

地图：`world_1783106205039`  
事件：`world_1783106205039_chain_2_enemy_e2`  
战斗：`battle_1-50`

## A. 完整胜利闭环

1. 启动 `ws_server`（先 `python tools/migrate_db.py` 应用 m002 索引）
2. 启动 Cocos 编辑器，登录并选角
3. 进入地图，与真实 NPC 交互 → 创建剧情战斗 → 打到胜利
4. 确认触发 `story_battle_finalize`
5. 确认 NPC / 任务 / 背包立即刷新
6. 退出角色 → 重登 → 进度与背包正确

## B. 战斗中断线

1. 战斗 `in_progress` 时断线
2. 重连后 `BattleResumeController` 恢复同一房间
3. 不得打开错误的 finished 房间

## C. 胜利后 finalize 前断线

1. 服务端已判胜、`pending=battle_finished`
2. 客户端断线后重登
3. `story_get_state` → `pending_story_settlement` → 自动 finalize
4. 不打开 BattleScene、不发 `battle_room_resume`、不重复奖励

## D. 服务器重启

1. 判胜后关掉 `ws_server` 再启动
2. 客户端重连/重登 → 自动 finalize
3. Mongo 中 `story_battle_settlements` 可见对应文档

## E. bag_has_items

1. 任务物品落在背包第 201 条以后
2. NPC 显隐 / requirement 仍能识别（不再依赖 `bag_get page_size=200`）

完成后把截图放到本目录 `screenshots/`，并更新 `metadata.json` 的 `cocos_editor.status=passed`。
