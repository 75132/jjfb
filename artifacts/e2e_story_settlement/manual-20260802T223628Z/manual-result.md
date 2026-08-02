# Cocos 人工联调结果（待填写）

- commit: `53ebc51f28a73d029a84a6987fe28266efb699b7`
- map_code: `world_1783106205039`
- event_id: `world_1783106205039_chain_2_enemy_e2`
- battle_ref: `battle_1-50`
- runtime mode: `server-development`（禁止 local-preview）
- WS: `ws://localhost:8001`（先启动本机 ws_server）

## 场景结果

| 场景 | 结果 | 备注 |
|------|------|------|
| A 正常剧情战斗 | pending | |
| B 战斗中断线 | pending | |
| C finalize 前断线 | pending | |
| D 判胜后关服重启 | pending | |
| E effects_applied 后重启 | pending | |

## 证据文件

- client.log / server-before-restart.log / server-after-restart.log
- before.json / in_room.json / battle_finished.json / effects_applied.json / after_finalize.json / after_relogin.json
- screenshots/（至少 6 张）

## 总结果

pending_manual — 需在 Cocos 编辑器按清单人工完成。
